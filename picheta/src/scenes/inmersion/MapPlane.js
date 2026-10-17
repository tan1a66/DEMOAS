import * as THREE from 'three';
import { NOISE } from '../../gl/noise.js';

// Mérida desde arriba: la foto del mapa sobre un plano con relieve sacado de
// su luminancia (las manzanas, más claras, se levantan un poco sobre las
// calles). El mapa se "revela" desde el doble círculo hacia el centro, como
// una foto que aparece en el revelador.

export const MAP_SIZE = 10; // unidades del mundo que ocupa la foto (lado)

const VERT = /* glsl */ `
uniform sampler2D tMap;
uniform float uHeight, uRelief;
uniform vec2 uCenter;
uniform float uRadius;
varying vec2 vUv;
varying vec3 vWorld;
varying float vLum;
void main() {
  vUv = uv;
  vec3 p = position;
  float lum = dot(texture2D(tMap, uv).rgb, vec3(0.299, 0.587, 0.114));
  vLum = lum;
  // Relieve sólo dentro del círculo (el spray y la piedra quedan planos).
  float inside = 1.0 - smoothstep(uRadius * 0.9, uRadius * 0.96, distance(uv, uCenter));
  p.z += pow(lum, 1.6) * uHeight * inside * uRelief;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

// Piedra oscura del fondo (tono lineal ≈ #1a1a1a), igual en el plano y fuera de él.
const STONE = /* glsl */ `
float stoneTone(vec2 p) {
  return 0.0065 + 0.0045 * fbm(p * 0.35) + 0.002 * (vnoise(p * 9.0) - 0.5);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D tMap;
uniform vec2 uCenter;
uniform float uRadius, uReveal, uStone, uTime;
uniform vec3 uLightDir;
varying vec2 vUv;
varying vec3 vWorld;
varying float vLum;
${NOISE}
${STONE}
void main() {
  vec3 tex = texture2D(tMap, vUv).rgb;
  float lum = dot(tex, vec3(0.299, 0.587, 0.114)); // la foto es B/N: se fuerza
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (dot(n, cameraPosition - vWorld) < 0.0) n = -n;
  float shade = 0.72 + 0.4 * max(dot(n, normalize(uLightDir)), 0.0);

  float rd = distance(vUv, uCenter) / uRadius;
  // Revelado: del círculo hacia dentro, con borde irregular (papel fotográfico).
  float edge = 1.0 - uReveal * 1.12 + (fbm(vUv * 18.0) - 0.5) * 0.12;
  float inner = smoothstep(edge, edge + 0.06, rd);
  float ring = smoothstep(0.9, 0.97, rd) * (1.0 - smoothstep(1.08, 1.16, rd));
  float outer = smoothstep(1.04, 1.12, rd);
  float vis = max(inner * (1.0 - outer), ring * step(0.001, uReveal)) + outer * uStone;
  vis = clamp(vis, 0.0, 1.0);

  vec3 col = vec3(lum) * shade * vis;
  // Bordes de la foto: se funden con la misma piedra procedural del fondo,
  // así cualquier foto (con viñeta o sin ella) no deja un recuadro.
  vec2 e = min(vUv, 1.0 - vUv);
  float frame = smoothstep(0.0, 0.12, min(e.x, e.y));
  col = mix(vec3(stoneTone(vWorld.xz)) * uStone, col, frame);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class MapPlane {
  constructor(texture, segments, map) {
    this.uniforms = {
      tMap: { value: texture },
      uHeight: { value: 0.16 },
      uRelief: { value: 0 },
      uCenter: { value: new THREE.Vector2(map.circle.x, 1 - map.circle.y) },
      uRadius: { value: map.circle.r - map.circle.band * 0.5 },
      uReveal: { value: 0 },
      uStone: { value: 0 },
      uTime: { value: 0 },
      uLightDir: { value: new THREE.Vector3(-0.5, 0.8, -0.35) },
    };
    const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, segments, segments);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms }),
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.frustumCulled = false;

    // Piedra que continúa más allá de la foto.
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.ShaderMaterial({
        uniforms: { uStone: this.uniforms.uStone },
        vertexShader: /* glsl */ `
          varying vec2 vP;
          void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uStone;
          varying vec2 vP;
          ${NOISE}
          ${STONE}
          void main() { gl_FragColor = vec4(vec3(stoneTone(vec2(vP.x, -vP.y))) * uStone, 1.0); }
        `,
      }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.02;
  }

  // Coordenadas normalizadas de la foto (x derecha, y abajo) → mundo.
  static toWorld(p, y = 0, target = new THREE.Vector3()) {
    return target.set((p.x - 0.5) * MAP_SIZE, y, (p.y - 0.5) * MAP_SIZE);
  }
}

// Lee la foto en un lienzo y devuelve los píxeles claros del doble círculo:
// los destinos donde "aterrizan" las partículas de la intro.
export function sampleRing(image, map, count) {
  const size = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(image, 0, 0, size, size);
  const data = g.getImageData(0, 0, size, size).data;
  const { x: cx, y: cy, r, band } = map.circle;
  const pts = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const d = Math.hypot(u - cx, v - cy);
      if (Math.abs(d - r) > band * 1.4) continue;
      const i = (y * size + x) * 4;
      const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      if (l > 0.55) pts.push(u, v);
    }
  }
  const out = new Float32Array(count * 2);
  const n = pts.length / 2;
  for (let i = 0; i < count; i++) {
    if (n) {
      const j = (Math.random() * n) | 0;
      out[i * 2] = pts[j * 2] + (Math.random() - 0.5) / size;
      out[i * 2 + 1] = pts[j * 2 + 1] + (Math.random() - 0.5) / size;
    } else {
      // Sin píxeles claros (foto distinta): círculo ideal.
      const a = Math.random() * Math.PI * 2;
      out[i * 2] = cx + Math.cos(a) * r;
      out[i * 2 + 1] = cy + Math.sin(a) * r;
    }
  }
  return out;
}
