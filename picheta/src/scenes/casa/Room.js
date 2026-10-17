import * as THREE from 'three';

// Una sala de Picheta reconstruida en 3D a partir de una foto real.
// La foto se proyecta desde su propia cámara sobre la geometría que sale de su
// mapa de profundidad: el visitante ve la luz y los materiales reales, pero la
// cámara puede moverse dentro de la sala (paralaje verdadero, avanzar,
// subir la escalera). Tres capas:
//   · fondo: la misma sala con la profundidad suavizada y la foto desenfocada,
//     que rellena lo que queda detrás de las siluetas al moverse;
//   · superficie: la sala nítida (se cortan los triángulos que unen un objeto
//     cercano con la pared del fondo);
//   · polvo: la sala hecha de partículas, para que se forme y se deshaga en
//     las transiciones (el mismo polvo de tiza de la intro).

const MESH_VERT = /* glsl */ `
varying vec2 vUv;
varying float vDist;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const MESH_FRAG = /* glsl */ `
uniform sampler2D tPhoto;
uniform float uOpacity, uExposure, uTime, uGlowAmt, uLod;
uniform vec4 uGlow;
uniform vec2 uEdge;
varying vec2 vUv;
varying float vDist;
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
  gl_FragColor = vec4(c * uExposure * e, uOpacity);
}
`;

const DUST_VERT = /* glsl */ `
uniform sampler2D tPhoto;
uniform float uScatter, uTime, uPixelRatio, uSize, uOpacity, uChalk;
attribute vec2 aUv;
attribute vec4 aSeed;
varying vec3 vColor;
varying float vA;
void main() {
  vec3 p = position;
  float z = -p.z;
  // Cada mota se va (o llega) a su ritmo.
  float s = clamp(uScatter * (1.0 + aSeed.w * 0.8) - aSeed.w * 0.4, 0.0, 1.0);
  s = s * s * (3.0 - 2.0 * s);
  vec3 dir = normalize(aSeed.xyz * 2.0 - 1.0 + vec3(0.0, 0.0, 0.0001));
  float reach = min(z, 9.0);
  p += dir * reach * 0.5 * s + vec3(0.0, 0.0, reach * 0.9 * s);
  p += vec3(sin(uTime * 0.7 + aSeed.x * 20.0), cos(uTime * 0.6 + aSeed.y * 20.0), 0.0) * 0.06 * reach * s;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 0.05);
  float size = uSize * uPixelRatio * clamp(min(z, 12.0) / dist, 0.7, 6.0) * (1.0 + s * 0.8);
  gl_PointSize = min(size, 28.0 * uPixelRatio);
  vec3 c = texture2D(tPhoto, aUv).rgb;
  vColor = mix(c, vec3(0.94, 0.92, 0.88), uChalk * (0.35 + 0.65 * s));
  vA = uOpacity * (1.0 - s * 0.55) * smoothstep(0.08, 0.6, dist) / max(1.0, size / (6.0 * uPixelRatio));
}
`;

const DUST_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float m = smoothstep(0.5, 0.15, r);
  gl_FragColor = vec4(vColor, vA * m);
}
`;

export class Room {
  // Carga foto y profundidad y construye la sala.
  static async load(def, base, quality) {
    const [photo, depth] = await Promise.all([loadTexture(base + def.photo), loadImage(base + def.depth)]);
    return new Room(def, photo, readDisparity(depth), quality);
  }

  constructor(def, photo, disp, q) {
    this.def = def;
    this.photo = photo;
    this.disp = disp;
    this.aspect = photo.image.width / photo.image.height;
    this.tanV = Math.tan(THREE.MathUtils.degToRad(def.fov / 2));
    this.tanH = this.tanV * this.aspect;
    this.group = new THREE.Group();
    this.group.visible = false;

    this.uniforms = {
      tPhoto: { value: photo },
      uOpacity: { value: 1 },
      uExposure: { value: 1 },
      uTime: { value: 0 },
      uGlowAmt: { value: def.glow ? 1 : 0 },
      uGlow: { value: new THREE.Vector4(...(def.glow ?? [0, 0, 0, 0])) },
      uLod: { value: 0 },
      uEdge: { value: new THREE.Vector2(def.overscan ? 0.16 : 0.05, def.overscan ? 0.08 : 0.04) },
    };
    const nx = q.roomGrid;
    const ny = Math.round(nx / this.aspect);
    this.surface = new THREE.Mesh(this.grid(nx, ny, { cut: def.cut ?? 1.45 }), this.meshMaterial(this.uniforms));
    this.surface.renderOrder = 1;

    // Fondo: profundidad "lejana" (mínima disparidad del entorno) y suavizada. Desde
    // la cámara de la foto se ve idéntico a la sala nítida (mismo rayo, mismo píxel);
    // al moverse, rellena lo que se abre detrás de las siluetas.
    const far = blurField(minField(disp, 4), 6);
    const backU = { ...this.uniforms, uLod: { value: 0.5 }, uOpacity: this.uniforms.uOpacity };
    this.back = new THREE.Mesh(this.grid(Math.round(nx / 2), Math.round(ny / 2), { field: far }), this.meshMaterial(backU));
    this.back.material.polygonOffset = true;
    this.back.material.polygonOffsetFactor = 4;
    this.back.material.polygonOffsetUnits = 4;
    this.back.renderOrder = 0;

    this.dustU = {
      tPhoto: { value: photo },
      uScatter: { value: 0 },
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSize: { value: q.dustSize },
      uOpacity: { value: 0 },
      uChalk: { value: 0 },
    };
    this.dust = new THREE.Points(
      this.dustGeometry(q.roomDust),
      new THREE.ShaderMaterial({
        vertexShader: DUST_VERT,
        fragmentShader: DUST_FRAG,
        uniforms: this.dustU,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 2;
    this.dust.visible = false;

    this.group.add(this.back, this.surface, this.dust);
  }

  meshMaterial(uniforms) {
    return new THREE.ShaderMaterial({
      vertexShader: MESH_VERT,
      fragmentShader: MESH_FRAG,
      uniforms,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }

  // Distancia (m) de la disparidad d (0 lejos … 1 cerca): 1/z es lineal en d.
  zOf(d) {
    const { near, far } = this.def;
    return 1 / (d * (1 / near - 1 / far) + 1 / far);
  }

  // Punto 3D de la foto (u, v) a la distancia z, visto desde la cámara de la foto.
  project(u, v, z, out = new THREE.Vector3()) {
    return out.set((u - 0.5) * 2 * this.tanH * z, (0.5 - v) * 2 * this.tanV * z, -z);
  }

  point(u, v, out) {
    return this.project(u, v, this.zOf(sample(this.disp, u, v)) * 0.97, out);
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

  dustGeometry(count) {
    const pos = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const seed = new Float32Array(count * 4);
    const v3 = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      this.project(u, v, this.zOf(sample(this.disp, u, v)), v3);
      pos.set([v3.x, v3.y, v3.z], i * 3);
      uv[i * 2] = u;
      uv[i * 2 + 1] = 1 - v;
      for (let c = 0; c < 4; c++) seed[i * 4 + c] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    return geo;
  }

  // solid: opacidad de la sala nítida · dust: opacidad del polvo · scatter: 0 en su sitio … 1 disperso.
  setState({ solid, dust, scatter, chalk }) {
    if (solid !== undefined) this.uniforms.uOpacity.value = solid;
    if (dust !== undefined) this.dustU.uOpacity.value = dust;
    if (scatter !== undefined) this.dustU.uScatter.value = scatter;
    if (chalk !== undefined) this.dustU.uChalk.value = chalk;
  }

  update(t, dpr) {
    this.uniforms.uTime.value = t;
    this.dustU.uTime.value = t;
    this.dustU.uPixelRatio.value = dpr;
    // Sólo se dibuja lo que se ve.
    this.surface.visible = this.back.visible = this.uniforms.uOpacity.value > 0.002;
    this.dust.visible = this.dustU.uOpacity.value > 0.002;
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
