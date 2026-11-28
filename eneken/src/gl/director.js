// Dirección de cámara.
// Entrada (automática, tras la carga): sobre el papel del cargador se abre un círculo sobre Casa Skoura
// vista desde el dron; el dron baja en espiral hasta la primera parada.
// Scroll: tres paradas — Nosotros (el sofá con la casa norte detrás), Visión (desde lo alto del muro oeste,
// el pit y el agua) y Contacto (detrás del respaldo, mirando la casa sur).
import * as THREE from 'three';
import { G } from './core.js';
import { HALO_MAT } from './courtyard.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const sine = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
const mix = THREE.MathUtils.lerp;

const _f = new THREE.Vector3();
function forward(yaw, pitch, out = _f) {
  return out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
}
// Catmull-Rom escalar (C1: la cámara no se detiene en cada punto de paso)
function cr(a, b, c, d, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}
function pathAt(K, p, out) {
  let i = 0;
  while (i < K.length - 2 && p > K[i + 1][0]) i++;
  const t = clamp01((p - K[i][0]) / (K[i + 1][0] - K[i][0]));
  const a = K[Math.max(0, i - 1)], b = K[i], c = K[i + 1], d = K[Math.min(K.length - 1, i + 2)];
  for (let j = 1; j < 7; j++) out[j - 1] = cr(a[j], b[j], c[j], d[j], t);
  return out;
}

// centro de cada parada en el progreso del scroll
export const STOPS = [0, 0.5, 1];

export function createDirector({ camera, water, courtyard, sun, scene, renderer, ui, sky }) {
  const PAPER = new THREE.Color('#f6f0e1');
  const PAPER_SRGB = new THREE.Vector3(246 / 255, 240 / 255, 225 / 255);
  const intro = { k: 0 };
  const state = { hub: false, shadowsDone: false };
  const portrait = () => camera.aspect < 0.9;

  // [x, y, z, yaw, pitch]
  const stopNosotros = () => (portrait() ? [0.1, 1.75, 3.3, 0.0, 0.1] : [0.1, 2.25, 3.9, 0.0, 0.07]);
  const stopVision = () => (portrait() ? [-1.95, 4.0, -0.75, -Math.PI / 2, -0.9] : [-1.95, 3.6, -0.75, -Math.PI / 2, -0.75]);
  const stopContacto = () => (portrait() ? [-0.45, 2.75, -4.3, -Math.PI + 0.06, -0.24] : [-0.5, 2.9, -4.4, -Math.PI + 0.06, -0.2]);
  const fovF = () => (portrait() ? 56 : 44);

  // entrada: del dron cenital a la primera parada. La altura inicial se calcula para que el ancho
  // del encuadre no pase de los muros del lote: nunca se ven los vecinos.
  function introKeys() {
    const f = fovF();
    const tanV = Math.tan(THREE.MathUtils.degToRad(37 / 2));
    const halfW = 2.45;                                   // medio ancho útil del lote (m)
    const topH = Math.min(17, 4.6 + halfW / (tanV * camera.aspect) * 0.95);
    const n = stopNosotros();
    return [
      [0.0, 0.0, topH, 0.4, 0.0, -Math.PI / 2 + 0.001, 37],
      [0.42, 0.35, Math.min(topH, 6.4), 2.6, 0.25, -1.12, 40],
      [0.78, 0.4, 3.0, 3.6, 0.1, -0.3, (40 + f) / 2],
      [1.0, ...n, f],
      [1.0001, ...n, f],
    ];
  }
  // scroll: Nosotros → Visión → Contacto, con pausas en cada parada
  function scrollKeys() {
    const f = fovF();
    return [
      [0.0, ...stopNosotros(), f],
      [0.1, ...stopNosotros(), f],
      [0.27, -1.45, 2.9, 2.3, -0.75, -0.42, f],
      [0.42, ...stopVision(), f],
      [0.58, ...stopVision(), f],
      [0.74, -1.55, 3.4, -3.1, -2.45, -0.42, f],
      [0.9, ...stopContacto(), f],
      [1.0, ...stopContacto(), f],
    ];
  }

  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  function place(x, y, z, yaw, pitch, fov, t, sway) {
    // respiración muy leve de la cámara (dron suspendido)
    const by = Math.sin(t * 0.21) * sway + Math.sin(t * 0.083) * sway * 0.6;
    const bp = Math.sin(t * 0.17 + 1.3) * sway * 0.45;
    euler.set(pitch + bp, yaw + by, 0);
    camera.quaternion.setFromEuler(euler);
    camera.position.set(x, y + Math.sin(t * 0.13) * sway * 0.6, z);
    if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }

  let introRunning = false;
  const tmp = new Array(6);

  function common(reveal, t) {
    renderer.setClearColor(PAPER, 1);
    G.uVoid.value.copy(PAPER_SRGB);
    G.uRevealC.value.set(0, -0.6);
    G.uRevealR.value = 1.6 * sine(seg(reveal, 0, 0.16)) + 46 * Math.pow(seg(reveal, 0.06, 0.62), 2.2);
    G.uRevealF.value = mix(0.8, 7.0, seg(reveal, 0.06, 0.62));
    sky.visible = reveal > 0.5;
    sun.intensity = 2.6;
    water.surfMat.uniforms.uSunInt.value = 1;
    scene.environmentIntensity = 1.25;   // luz rebotada del patio: las fachadas en sombra no quedan negras
    HALO_MAT.opacity = 0.5 * sine(seg(reveal, 0.55, 0.9));
    courtyard.group.visible = true;
    if (!state.shadowsDone) { renderer.shadowMap.needsUpdate = true; state.shadowsDone = true; }
    void t;
  }

  function frameIntro(t) {
    const k = intro.k;
    pathAt(introKeys(), k, tmp);
    place(tmp[0], tmp[1], tmp[2], tmp[3], tmp[4], tmp[5], t, 0.004 * k);
    common(k, t);
    state.hub = k > 0.9;
  }

  function frameScroll(p, t) {
    pathAt(scrollKeys(), p, tmp);
    place(tmp[0], tmp[1], tmp[2], tmp[3], tmp[4], tmp[5], t, 0.004);
    common(1, t);
    state.hub = true;
    ui(p);
  }

  return {
    intro, state,
    startIntro() { introRunning = true; },
    endIntro() { introRunning = false; },
    get introRunning() { return introRunning; },
    invalidateShadows() { state.shadowsDone = false; },
    frameIntro, frameScroll,
  };
}
