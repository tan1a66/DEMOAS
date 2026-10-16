// Cascada de listones verdes y azules colgados del techo de cristal.
// Una sola malla instanciada; el viento y el giro se calculan en el vertex shader.
import * as THREE from 'three';

const VS = /* glsl */`
attribute vec4 aRib;     // x, z, largo, fase
attribute vec3 aColor;
attribute float aWidth;
uniform float uTime;
uniform float uTop;
uniform float uWind;
uniform float uGust;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vS;
#include <fog_pars_vertex>
void main() {
  float s = -position.y;              // 0 arriba → 1 abajo
  float L = aRib.z;
  float ph = aRib.w;
  float k = s * s;
  // brisa: ondas que bajan por el listón + ráfagas lentas comunes
  float gust = sin(uTime * 0.31 + aRib.x * 0.35) * 0.6 + sin(uTime * 0.17 + aRib.y * 0.5 + 1.3) * 0.4;
  vec2 sway = vec2(
    sin(uTime * 0.85 + ph + s * 3.2),
    cos(uTime * 0.67 + ph * 1.37 + s * 2.6)
  ) * 0.16 * k * (L / 9.0) * uWind;
  sway += vec2(0.22, 0.09) * (gust + uGust) * k * uWind;
  // el listón gira sobre su eje mientras cae
  float tw = ph * 2.0 + s * (5.0 + 2.0 * sin(ph)) + sin(uTime * 0.5 + ph) * 1.1 * uWind;
  vec2 dir = vec2(cos(tw), sin(tw));
  vec2 xz = aRib.xy + sway + dir * position.x * aWidth;
  vec3 wp = vec3(xz.x, uTop - s * L, xz.y);
  vNormal = normalize(vec3(-dir.y, 0.0, dir.x));
  vColor = aColor;
  vWorld = wp;
  vS = s;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FS = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform float uFade;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vS;
#include <fog_pars_fragment>
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0) N = -N;
  float diff = abs(dot(N, uSunDir));
  // seda: brillo según el ángulo de visión y translucidez a contraluz
  float sheen = pow(1.0 - abs(dot(N, V)), 2.5);
  float trans = pow(max(dot(-V, uSunDir), 0.0), 3.0) * 0.6;
  vec3 col = vColor * (uAmbient + uSunColor * (diff * 0.55 + trans));
  col += vColor * sheen * 0.35 + vec3(1.0, 0.98, 0.92) * pow(sheen, 4.0) * 0.12;
  // más luz cerca del techo de cristal
  col *= 0.8 + 0.45 * smoothstep(9.0, 13.0, vWorld.y);
  gl_FragColor = vec4(col * uFade, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

const PALETTE = ['#1f8a70', '#3fb59f', '#8fd0bf', '#2b7bb8', '#5fb3e0', '#14596e', '#a9dbe6', '#2e9e8a', '#4f9fd1', '#0f6b5c'];

export function makeRibbons({ count = 500, top = 13.4, radius = 2.3, bottomCenter = 2.5, bottomEdge = 4.3, segs = 26 } = {}) {
  const base = new THREE.PlaneGeometry(1, 1, 1, segs);
  base.translate(0, -0.5, 0); // y de 0 a −1
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const rib = new Float32Array(count * 4);
  const col = new Float32Array(count * 3);
  const wid = new Float32Array(count);
  const c = new THREE.Color();
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const rr = radius * Math.sqrt((i + 0.5) / count) * (0.96 + Math.random() * 0.08);
    const a = i * golden;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const tt = rr / radius;
    const bottom = bottomCenter + (bottomEdge - bottomCenter) * tt * tt + (Math.random() - 0.5) * 0.35;
    rib.set([x, z, top - bottom, Math.random() * Math.PI * 2], i * 4);
    c.set(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    col.set([c.r, c.g, c.b], i * 3);
    wid[i] = 0.038 + Math.random() * 0.02;
  }
  geo.setAttribute('aRib', new THREE.InstancedBufferAttribute(rib, 4));
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
  geo.setAttribute('aWidth', new THREE.InstancedBufferAttribute(wid, 1));
  geo.instanceCount = count;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, (top + bottomCenter) / 2, 0), 9);

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 }, uTop: { value: top }, uWind: { value: 1 }, uGust: { value: 0 },
      uSunDir: { value: new THREE.Vector3(-0.25, 1, 0.3).normalize() },
      uSunColor: { value: new THREE.Color('#fff1d6') },
      uAmbient: { value: new THREE.Color('#9fb4ae') },
      uFade: { value: 1 },
    },
  ]);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide, fog: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = true;
  return { mesh, uniforms: mat.uniforms };
}
