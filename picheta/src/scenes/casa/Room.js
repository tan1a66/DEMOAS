import * as THREE from 'three';

// Una sala de Picheta reconstruida en 3D a partir de una foto real.
// La foto se proyecta desde su propia cámara sobre la geometría que sale de su
// mapa de profundidad: el visitante ve la luz y los materiales reales, pero la
// cámara puede moverse dentro de la sala (paralaje verdadero, avanzar por el
// pasillo, subir la escalera). Dos capas:
//   · superficie: la sala nítida (se cortan los triángulos que unen un objeto
//     cercano con la pared del fondo);
//   · fondo: la misma sala con la profundidad "lejana" y suavizada, que rellena
//     lo que se abre detrás de las siluetas al moverse.
// La sala vive en su propio grupo: la escena la coloca en el mundo.

const MESH_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const MESH_FRAG = /* glsl */ `
uniform sampler2D tPhoto;
uniform float uExposure, uTime, uGlowAmt, uLod;
uniform vec4 uGlow;
uniform vec2 uEdge;
varying vec2 vUv;
void main() {
  vec3 c = uLod > 0.0 ? textureLod(tPhoto, vUv, uLod).rgb : texture2D(tPhoto, vUv).rgb;
  // Luz que respira (la escultura retroiluminada, las lámparas): sólo los píxeles
  // cálidos y claros de su zona.
  vec2 p = vec2(vUv.x, 1.0 - vUv.y);
  if (uGlowAmt > 0.0 && p.x > uGlow.x && p.x < uGlow.z && p.y > uGlow.y && p.y < uGlow.w) {
    float l = dot(c, vec3(0.3, 0.59, 0.11));
    float warm = smoothstep(0.02, 0.16, c.r - c.b);
    float k = smoothstep(0.1, 0.55, l) * warm;
    c *= 1.0 + k * uGlowAmt * (0.14 * sin(uTime * 1.1) + 0.05 * sin(uTime * 3.3 + 1.7));
  }
  // Los bordes de la foto se funden con la oscuridad (no hay un marco).
  float e = smoothstep(0.0, uEdge.x, p.x) * smoothstep(0.0, uEdge.x, 1.0 - p.x)
          * smoothstep(0.0, uEdge.y, p.y) * smoothstep(0.0, uEdge.y, 1.0 - p.y);
  gl_FragColor = vec4(c * uExposure * e, 1.0);
}
`;

export class Room {
  // Primero la profundidad (pesa poco): con ella se traza el recorrido. La foto llega después.
  static async loadDepth(def, base, quality) {
    return new Room(def, readDisparity(await loadImage(base + def.depth)), quality);
  }

  constructor(def, disp, q) {
    this.def = def;
    this.disp = disp;
    this.ready = false;
    this.aspect = disp.w / disp.h;
    this.tanV = Math.tan(THREE.MathUtils.degToRad(def.fov / 2));
    this.tanH = this.tanV * this.aspect;
    this.group = new THREE.Group();
    this.group.visible = false;

    const blank = new THREE.DataTexture(new Uint8Array([13, 12, 12, 255]), 1, 1);
    blank.needsUpdate = true;
    this.uniforms = {
      tPhoto: { value: blank },
      uExposure: { value: 1 },
      uTime: { value: 0 },
      uGlowAmt: { value: def.glow ? 1 : 0 },
      uGlow: { value: new THREE.Vector4(...(def.glow ?? [0, 0, 0, 0])) },
      uLod: { value: 0 },
      uEdge: { value: new THREE.Vector2(def.overscan ? 0.22 : 0.08, def.overscan ? 0.14 : 0.06) },
    };
    const nx = q.roomGrid;
    const ny = Math.round(nx / this.aspect);
    this.surface = new THREE.Mesh(this.grid(nx, ny, { cut: def.cut ?? 1.45 }), this.material(this.uniforms));
    this.surface.renderOrder = 1;

    // Fondo: profundidad "lejana" (mínima disparidad del entorno) y suavizada. Desde
    // la cámara de la foto se ve idéntico a la sala nítida (mismo rayo, mismo píxel);
    // al moverse, rellena lo que se abre detrás de las siluetas.
    const far = blurField(minField(disp, 4), 6);
    const backU = { ...this.uniforms, uLod: { value: 0.5 } };
    this.back = new THREE.Mesh(this.grid(Math.round(nx / 2), Math.round(ny / 2), { field: far }), this.material(backU));
    this.back.material.polygonOffset = true;
    this.back.material.polygonOffsetFactor = 4;
    this.back.material.polygonOffsetUnits = 4;
    this.back.renderOrder = 0;
    this.group.add(this.back, this.surface);
  }

  async loadPhoto(base) {
    const tex = await loadTexture(base + this.def.photo);
    this.photo = tex;
    this.uniforms.tPhoto.value = tex;
    this.ready = true;
    return tex;
  }

  material(uniforms) {
    return new THREE.ShaderMaterial({ vertexShader: MESH_VERT, fragmentShader: MESH_FRAG, uniforms, side: THREE.DoubleSide });
  }

  // Distancia (m) de la disparidad d (0 lejos … 1 cerca): 1/z es lineal en d.
  zOf(d) {
    const { near, far } = this.def;
    return 1 / (d * (1 / near - 1 / far) + 1 / far);
  }

  depthAt(u, v) {
    return this.zOf(sample(this.disp, u, v));
  }

  // Punto de la foto (u, v) a la distancia z, en coordenadas de la sala (cámara de la foto
  // en el origen, mirando hacia -z).
  project(u, v, z, out = new THREE.Vector3()) {
    return out.set((u - 0.5) * 2 * this.tanH * z, (0.5 - v) * 2 * this.tanV * z, -z);
  }

  // Punto de la superficie en (u, v), en coordenadas del mundo.
  point(u, v, out = new THREE.Vector3()) {
    this.project(u, v, this.depthAt(u, v) * 0.97, out);
    return this.group.localToWorld(out);
  }

  grid(nx, ny, { field = this.disp, cut = 0 } = {}) {
    const pos = new Float32Array((nx + 1) * (ny + 1) * 3);
    const uv = new Float32Array((nx + 1) * (ny + 1) * 2);
    const z = new Float32Array((nx + 1) * (ny + 1));
    const v3 = new THREE.Vector3();
    let k = 0;
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const u = i / nx;
        const v = j / ny;
        z[k] = this.zOf(sample(field, u, v));
        this.project(u, v, z[k], v3);
        pos.set([v3.x, v3.y, v3.z], k * 3);
        uv[k * 2] = u;
        uv[k * 2 + 1] = 1 - v;
        k++;
      }
    }
    const idx = [];
    const row = nx + 1;
    // Corte en los saltos de profundidad (una silla delante de la pared, una torre
    // contra el cielo): el triángulo no se estira de uno a otro.
    const keep = (a, b, c) => !cut || Math.max(z[a], z[b], z[c]) / Math.min(z[a], z[b], z[c]) < cut;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * row + i;
        const b = a + 1;
        const c = a + row;
        const e = c + 1;
        if (keep(a, c, b)) idx.push(a, c, b);
        if (keep(b, c, e)) idx.push(b, c, e);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return geo;
  }

  update(t) {
    this.uniforms.uTime.value = t;
  }
}

// ------------------------------------------------------------------ utilidades

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
    img.src = url;
  });
}

async function loadTexture(url) {
  const tex = await new THREE.TextureLoader().loadAsync(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// Disparidad de 12 bits empaquetada en R (alto) y G (bajo).
function readDisparity(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, w, h).data;
  const data = new Float32Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 65520;
  return { w, h, data };
}

function sample(f, u, v) {
  const x = Math.min(f.w - 1, Math.max(0, u * f.w - 0.5));
  const y = Math.min(f.h - 1, Math.max(0, v * f.h - 0.5));
  const x0 = x | 0;
  const y0 = y | 0;
  const x1 = Math.min(f.w - 1, x0 + 1);
  const y1 = Math.min(f.h - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const d = f.data;
  const a = d[y0 * f.w + x0] + (d[y0 * f.w + x1] - d[y0 * f.w + x0]) * fx;
  const b = d[y1 * f.w + x0] + (d[y1 * f.w + x1] - d[y1 * f.w + x0]) * fx;
  return a + (b - a) * fy;
}

// Mínimo (lo más lejano) en un radio, separable.
function minField(f, r) {
  const { w, h } = f;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = 1;
      for (let k = -r; k <= r; k++) m = Math.min(m, f.data[y * w + Math.min(w - 1, Math.max(0, x + k))]);
      tmp[y * w + x] = m;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = 1;
      for (let k = -r; k <= r; k++) m = Math.min(m, tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x]);
      out[y * w + x] = m;
    }
  return { w, h, data: out };
}

// Desenfoque de caja separable.
function blurField(f, r) {
  const { w, h } = f;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += f.data[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = s / n;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      out[y * w + x] = s / n;
    }
  return { w, h, data: out };
}
