// Faroles de hierro y vidrio, halos de luz, haces que bajan del techo de cristal,
// polvo luminoso y charcos de luz cálida en el suelo.
import * as THREE from 'three';
import { merge, place } from './geo.js?v=2';
import { glowCanvas } from '../../util/textures.js?v=2';

// Farol hexagonal colgante (origen en el centro del vidrio). Devuelve { iron, glass } geometrías.
export function lanternGeometry(hq = true, { rod = 0.6 } = {}) {
  const iron = [], glass = [];
  const sides = 6;
  const r = 0.15;
  iron.push(place(new THREE.ConeGeometry(r + 0.06, 0.16, sides), 0, 0.27, 0, 0, Math.PI / 6, 0));
  iron.push(place(new THREE.CylinderGeometry(r + 0.065, r + 0.065, 0.025, sides), 0, 0.19, 0, 0, Math.PI / 6, 0));
  iron.push(place(new THREE.SphereGeometry(0.03, 8, 6), 0, 0.37, 0));
  iron.push(place(new THREE.TorusGeometry(0.045, 0.008, 4, 10), 0, 0.42, 0));
  iron.push(place(new THREE.CylinderGeometry(0.008, 0.008, rod, 4), 0, 0.42 + rod / 2, 0));
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    iron.push(place(new THREE.CylinderGeometry(0.009, 0.009, 0.4, 4), Math.cos(a) * r, 0, Math.sin(a) * r));
    // volutas pequeñas en la parte baja
    iron.push(place(new THREE.TorusGeometry(0.03, 0.006, 3, 8, Math.PI * 1.4), Math.cos(a) * (r + 0.02), -0.2, Math.sin(a) * (r + 0.02), 0, -a, Math.PI / 2));
  }
  iron.push(place(new THREE.CylinderGeometry(r + 0.012, r + 0.012, 0.03, sides), 0, -0.2, 0, 0, Math.PI / 6, 0));
  iron.push(place(new THREE.ConeGeometry(0.08, 0.12, sides), 0, -0.28, 0, Math.PI, Math.PI / 6, 0));
  glass.push(place(new THREE.CylinderGeometry(r - 0.004, r - 0.004, 0.38, sides, 1, true), 0, 0, 0, 0, Math.PI / 6, 0));
  glass.push(new THREE.SphereGeometry(0.05, 8, 6));
  return { iron: merge(iron), glass: merge(glass) };
}

const GLOW_VS = /* glsl */`
attribute vec3 aCenter;
attribute float aSize;
attribute vec4 aColor;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vUv = uv;
  vColor = aColor;
  vec4 mv = viewMatrix * vec4(aCenter, 1.0);
  // un poco hacia la cámara para no cortarse con el farol
  mv.xyz += normalize(-mv.xyz) * 0.25;
  mv.xy += position.xy * aSize;
  gl_Position = projectionMatrix * mv;
}
`;
const GLOW_FS = /* glsl */`
uniform float uIntensity;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = exp(-d * d * 5.0) * 0.8 + exp(-d * 14.0) * 0.6;
  a *= smoothstep(1.0, 0.7, d);
  gl_FragColor = vec4(vColor.rgb * a * vColor.a * uIntensity, 1.0);
}
`;

// Halos billboard instanciados. items: [{ pos: Vector3, size, color, intensity }]
export function makeGlows(items) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const n = items.length;
  const center = new Float32Array(n * 3), size = new Float32Array(n), color = new Float32Array(n * 4);
  const c = new THREE.Color();
  items.forEach((it, i) => {
    center.set([it.pos.x, it.pos.y, it.pos.z], i * 3);
    size[i] = it.size;
    c.set(it.color || '#ffc27a');
    color.set([c.r, c.g, c.b, it.intensity ?? 1], i * 4);
  });
  const aColor = new THREE.InstancedBufferAttribute(color, 4);
  aColor.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aCenter', new THREE.InstancedBufferAttribute(center, 3));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
  geo.setAttribute('aColor', aColor);
  geo.instanceCount = n;
  const uniforms = { uIntensity: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: GLOW_VS, fragmentShader: GLOW_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return {
    mesh, uniforms,
    setIntensity(i, v) { aColor.setW(i, v); aColor.needsUpdate = true; },
  };
}

const SHAFT_VS = /* glsl */`
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const SHAFT_FS = /* glsl */`
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float facing = pow(abs(dot(normalize(vN), V)), 1.5);
  float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
  across = pow(across, 1.8);
  float along = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
  float flick = 0.85 + 0.15 * sin(uTime * 0.6 + vW.x * 1.7 + vW.z * 1.3);
  float a = across * along * facing * flick * uIntensity;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

// Haces de luz: planos cruzados orientados según la dirección del sol.
export function makeShafts(starts, sunDir, length = 15, width = 1.6) {
  const uniforms = { uTime: { value: 0 }, uIntensity: { value: 0.16 }, uColor: { value: new THREE.Color('#fff2d8') } };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: SHAFT_VS, fragmentShader: SHAFT_FS,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const parts = [];
  const down = sunDir.clone().negate().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), down);
  const m = new THREE.Matrix4();
  for (const [i, s] of starts.entries()) {
    const w = width * (0.7 + ((i * 37) % 10) / 16);
    for (const rot of [0, Math.PI / 2]) {
      const g = new THREE.PlaneGeometry(w, length, 1, 1);
      g.translate(0, -length / 2, 0);
      // uv.y: 0 arriba → 1 abajo
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - uv.getY(k));
      g.rotateY(rot + i * 0.4);
      m.compose(s, q, new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m);
      parts.push(g);
    }
  }
  const mesh = new THREE.Mesh(merge(parts), mat);
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

const DUST_VS = /* glsl */`
attribute vec4 aSeed;
uniform float uTime;
uniform float uPixel;
uniform vec3 uSunDir;
uniform float uTop;
uniform float uHalf;
varying float vLit;
varying float vTw;
void main() {
  vec3 p = position;
  float h = 11.5;
  p.y = 0.5 + mod(p.y + uTime * (0.05 + aSeed.y * 0.08), h);
  p.x += sin(uTime * 0.11 + aSeed.x * 6.283) * 0.35;
  p.z += cos(uTime * 0.09 + aSeed.z * 6.283) * 0.35;
  // ¿está esta mota dentro del volumen de sol que entra por el cristal?
  vec3 q = p + uSunDir * ((uTop - p.y) / uSunDir.y);
  float inside = smoothstep(uHalf + 0.2, uHalf - 0.6, abs(q.x)) * smoothstep(uHalf + 0.2, uHalf - 0.6, abs(q.z));
  vLit = mix(0.12, 1.0, inside);
  vTw = 0.6 + 0.4 * sin(uTime * (1.0 + aSeed.w * 2.0) + aSeed.x * 20.0);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_PointSize = (0.6 + aSeed.w * 1.4) * uPixel / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const DUST_FS = /* glsl */`
uniform float uIntensity;
varying float vLit;
varying float vTw;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  a *= a;
  gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * a * vLit * vTw * uIntensity, 1.0);
}
`;

export function makeDust(count, sunDir, { half = 4.5, top = 13.4 } = {}) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    pos.set([(Math.random() * 2 - 1) * 4.6, Math.random() * 11.5, (Math.random() * 2 - 1) * 4.6], i * 3);
    seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const uniforms = {
    uTime: { value: 0 }, uPixel: { value: 600 }, uSunDir: { value: sunDir.clone().normalize() },
    uTop: { value: top }, uHalf: { value: half }, uIntensity: { value: 0.9 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: DUST_VS, fragmentShader: DUST_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 6;
  return { mesh: pts, uniforms };
}

// Charcos de luz cálida en el suelo (decals aditivos).
export function makeLightPools(items) {
  const tex = new THREE.CanvasTexture(glowCanvas(128, 'rgba(255,214,150,1)', 'rgba(255,180,100,0.35)'));
  tex.colorSpace = THREE.SRGBColorSpace;
  const parts = items.map(({ pos, size, rot = [-Math.PI / 2, 0, 0] }) => {
    const g = new THREE.PlaneGeometry(size, size);
    return place(g, pos.x, pos.y, pos.z, rot[0], rot[1], rot[2]);
  });
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    color: new THREE.Color('#ffcf94').multiplyScalar(0.28), polygonOffset: true, polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(merge(parts), mat);
  mesh.renderOrder = 3;
  return { mesh, mat };
}
