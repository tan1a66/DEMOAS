// =============================================================================
//  dust.js — pulviscolo sospeso nella luce
// =============================================================================
//  Particelle lente che brillano dove passa la luce del sole (nei raggi che
//  entrano dagli archi). Fuori fuoco diventano dischi morbidi (bokeh).

import * as THREE from 'three';

const VERT = /* glsl */ `
uniform float uTime;
uniform float uPx;
uniform float uSize;
uniform float uAmount;
uniform float uFocus;
uniform float uAperture;
uniform vec3 uSunDir;
attribute vec3 aOrigin;
attribute float aSeed;
varying float vAlpha;
varying float vSoft;
void main() {
  float s = aSeed * 43.0;
  vec3 p = aOrigin + vec3(
    sin(uTime * 0.07 + s) * 0.35 + sin(uTime * 0.13 + s * 1.7) * 0.12,
    sin(uTime * 0.05 + s * 2.3) * 0.25 + uTime * 0.01 * (aSeed - 0.4),
    cos(uTime * 0.06 + s * 1.3) * 0.35);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 0.05);
  float px = uSize * (0.4 + aSeed) * uPx / depth;
  float coc = uAperture * abs(depth - uFocus) / depth * uPx * 0.006;
  float total = clamp(px + coc, 1.2, 26.0);
  gl_PointSize = total;
  vSoft = clamp(coc / total, 0.0, 1.0);
  // più visibili nei corridoi di luce che entrano dagli archi in fondo
  vec3 toSun = normalize(uSunDir);
  float inBeam = 0.35 + 0.65 * smoothstep(0.6, 1.0, sin(p.x * 0.55 + p.z * 0.1 + 1.0) * 0.5 + 0.5);
  float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed) + s);
  vAlpha = uAmount * twinkle * inBeam * 0.8 * max(pow(px / total, 1.3), 0.06);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
varying float vSoft;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float dotA = smoothstep(1.0, 0.0, r);
  float disc = smoothstep(1.0, 0.82, r) * (0.75 + 0.25 * smoothstep(0.4, 0.95, r));
  float a = mix(dotA * dotA, disc, vSoft) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

export function createDust({ motes, random = Math.random }) {
  const uniforms = {
    uTime: { value: 0 },
    uPx: { value: 800 },
    uFocus: { value: 5 },
    uAperture: { value: 0 },
    uSize: { value: 0.014 },
    uAmount: { value: 1 },
    uSunDir: { value: new THREE.Vector3(0, 0.3, -1) },
    uColor: { value: new THREE.Color('#fff7ea') },
  };
  const pos = new Float32Array(motes * 3);
  const seed = new Float32Array(motes);
  for (let i = 0; i < motes; i++) {
    // dentro al cortile, più fitto attorno alla statua
    const r = Math.pow(random(), 0.6) * 6.2;
    const a = random() * Math.PI * 2;
    pos.set([Math.cos(a) * r, 0.2 + Math.pow(random(), 1.2) * 4.5, Math.sin(a) * r - 0.8], i * 3);
    seed[i] = random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aOrigin', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, toneMapped: false })
  );
  points.frustumCulled = false;
  points.renderOrder = 8;
  return {
    object: points,
    update({ time, pxScale, focus, aperture, amount, sunDir }) {
      uniforms.uTime.value = time;
      uniforms.uPx.value = pxScale;
      uniforms.uFocus.value = focus;
      uniforms.uAperture.value = aperture;
      uniforms.uAmount.value = amount;
      uniforms.uSunDir.value.copy(sunDir);
    },
  };
}
