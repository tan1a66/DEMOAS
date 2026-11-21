// =============================================================================
//  dust.js — polvere di marmo
// =============================================================================
//  1. Sbuffi di polvere legati ai frammenti: uno dove il frammento si stacca e
//     (sul computer) uno a terra dove cade. Come i frammenti, dipendono solo
//     dallo scroll (reversibili); un leggero movimento nel tempo li tiene vivi.
//  2. Pulviscolo sospeso nella luce, sempre presente, più visibile all'apertura.
//  Fuori fuoco le particelle diventano dischi morbidi più grandi (bokeh).

import * as THREE from 'three';

const VERT = /* glsl */ `
uniform float uProgress;
uniform float uTime;
uniform float uPx;        // pixel per unità a distanza 1
uniform float uSize;
uniform float uFocus;     // distanza messa a fuoco
uniform float uAperture;  // quantità di bokeh
attribute vec3 aOrigin;
attribute vec3 aVel;
attribute vec2 aTime;     // inizio, durata (in avanzamento dello scolpire)
attribute float aSeed;
varying float vAlpha;
varying float vSoft;
void main() {
  float t = (uProgress - aTime.x) / aTime.y;
  if (t <= 0.0 || t >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vAlpha = 0.0; return; }
  float e = 1.0 - pow(1.0 - t, 2.4);
  vec3 p = aOrigin + aVel * e;
  p.y += 0.2 * e * (0.5 + aSeed);
  p += 0.03 * e * vec3(sin(uTime * 0.6 + aSeed * 20.0), sin(uTime * 0.45 + aSeed * 11.0), cos(uTime * 0.5 + aSeed * 7.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 0.05);
  float px = uSize * (0.55 + aSeed) * (0.6 + 1.8 * e) * uPx / depth;
  float coc = uAperture * abs(depth - uFocus) / depth * uPx * 0.006;
  float total = clamp(px + coc, 1.5, 120.0);
  gl_PointSize = total;
  vSoft = clamp(coc / total, 0.0, 1.0);
  vAlpha = pow(sin(3.14159 * t), 1.3) * 0.15 * max(pow(px / total, 1.4), 0.12);
}`;

const MOTES_VERT = /* glsl */ `
uniform float uTime;
uniform float uPx;
uniform float uSize;
uniform float uAmount;
uniform float uFocus;
uniform float uAperture;
attribute vec3 aOrigin;
attribute float aSeed;
varying float vAlpha;
varying float vSoft;
void main() {
  float s = aSeed * 43.0;
  vec3 p = aOrigin + vec3(
    sin(uTime * 0.07 + s) * 0.35 + sin(uTime * 0.13 + s * 1.7) * 0.12,
    sin(uTime * 0.05 + s * 2.3) * 0.25 + uTime * 0.008 * (aSeed - 0.4),
    cos(uTime * 0.06 + s * 1.3) * 0.35);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 0.05);
  float px = uSize * (0.4 + aSeed) * uPx / depth;
  float coc = uAperture * abs(depth - uFocus) / depth * uPx * 0.006;
  float total = clamp(px + coc, 1.2, 26.0);
  gl_PointSize = total;
  vSoft = clamp(coc / total, 0.0, 1.0);
  float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed) + s);
  vAlpha = uAmount * twinkle * 0.7 * max(pow(px / total, 1.3), 0.06);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
varying float vSoft;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  // nitido: punto morbido; fuori fuoco: disco con il bordo appena più chiaro
  float dotA = smoothstep(1.0, 0.0, r);
  float disc = smoothstep(1.0, 0.82, r) * (0.75 + 0.25 * smoothstep(0.4, 0.95, r));
  float a = mix(dotA * dotA, disc, vSoft) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

function makeMaterial(vertexShader, uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: FRAG,
    uniforms: { uColor: { value: new THREE.Color('#fffaf1') }, ...uniforms },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

export function createDust({ chips, perFragment, fall, motes, random = Math.random }) {
  const shared = {
    uTime: { value: 0 },
    uPx: { value: 800 },
    uFocus: { value: 5 },
    uAperture: { value: 0 },
  };

  // ---- sbuffi legati ai frammenti ----
  const n = chips.length * perFragment;
  const aOrigin = new Float32Array(n * 3);
  const aVel = new Float32Array(n * 3);
  const aTime = new Float32Array(n * 2);
  const aSeed = new Float32Array(n);
  let k = 0;
  for (const ch of chips) {
    for (let j = 0; j < perFragment; j++, k++) {
      const atFloor = j === 1; // il secondo sbuffo nasce dove il frammento tocca terra
      const ang = random() * Math.PI * 2;
      const spread = atFloor ? 0.25 + random() * 0.3 : 0.08 + random() * 0.16;
      if (atFloor) {
        aOrigin.set([ch.x + ch.dx * 0.9, 0.02, ch.z + ch.dz * 0.9], k * 3);
        aTime.set([ch.threshold + fall * 0.85, 0.16 + random() * 0.08], k * 2);
      } else {
        aOrigin.set([ch.x, ch.y, ch.z], k * 3);
        aTime.set([ch.threshold + fall * 0.05, 0.1 + random() * 0.08], k * 2);
      }
      aVel.set([Math.cos(ang) * spread, atFloor ? 0.05 : 0.02, Math.sin(ang) * spread], k * 3);
      aSeed[k] = random();
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(aOrigin, 3)); // solo per three
  geo.setAttribute('aOrigin', new THREE.BufferAttribute(aOrigin, 3));
  geo.setAttribute('aVel', new THREE.BufferAttribute(aVel, 3));
  geo.setAttribute('aTime', new THREE.BufferAttribute(aTime, 2));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
  const puffs = new THREE.Points(
    geo,
    makeMaterial(VERT, { ...shared, uProgress: { value: 0 }, uSize: { value: 0.13 } })
  );
  puffs.frustumCulled = false;
  puffs.renderOrder = 5;

  // ---- pulviscolo sospeso ----
  const mo = new Float32Array(motes * 3);
  const ms = new Float32Array(motes);
  for (let i = 0; i < motes; i++) {
    // più fitto vicino alla statua, rado lontano
    const r = Math.pow(random(), 0.7) * 6.5;
    const a = random() * Math.PI * 2;
    mo.set([Math.cos(a) * r, 0.15 + Math.pow(random(), 1.3) * 4.2, Math.sin(a) * r - 0.2], i * 3);
    ms[i] = random();
  }
  const mgeo = new THREE.BufferGeometry();
  mgeo.setAttribute('position', new THREE.BufferAttribute(mo, 3));
  mgeo.setAttribute('aOrigin', new THREE.BufferAttribute(mo, 3));
  mgeo.setAttribute('aSeed', new THREE.BufferAttribute(ms, 1));
  const motesPoints = new THREE.Points(
    mgeo,
    makeMaterial(MOTES_VERT, { ...shared, uSize: { value: 0.016 }, uAmount: { value: 1 } })
  );
  motesPoints.frustumCulled = false;
  motesPoints.renderOrder = 6;

  const group = new THREE.Group();
  group.add(puffs, motesPoints);

  return {
    group,
    update({ time, progress, pxScale, focus, aperture, motesAmount }) {
      shared.uTime.value = time;
      shared.uPx.value = pxScale;
      shared.uFocus.value = focus;
      shared.uAperture.value = aperture;
      puffs.material.uniforms.uProgress.value = progress;
      puffs.visible = progress > 0 && progress < 1.45;
      motesPoints.material.uniforms.uAmount.value = motesAmount;
    },
  };
}
