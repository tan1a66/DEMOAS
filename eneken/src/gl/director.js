// Dirección de cámara.
// Entrada (tras la carga): sobre el papel se abre un círculo; desde lo alto se ve el castillo sobre las
// nubes y el dron baja hasta la primera plaza.
// Scroll o puertas: Piazza 1 Nosotros (Casa Skoura) → puerta este y escalera → Piazza 2 Visión (el arco de
// ODA en el agua) → a través del arco y por la escalera curva → Piazza 3 Contacto (el disco de Miguel Tapia).
import * as THREE from 'three';
import { G } from './core.js';
import { HALO_MAT } from './courtyard.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const sine = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
const mix = THREE.MathUtils.lerp;

// Catmull-Rom escalar (C1: la cámara no se detiene en cada punto de paso)
function cr(a, b, c, d, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}
// claves: [p, px, py, pz, tx, ty, tz, fov]  (posición y punto mirado)
function pathAt(K, p, out) {
  let i = 0;
  while (i < K.length - 2 && p > K[i + 1][0]) i++;
  const t = clamp01((p - K[i][0]) / (K[i + 1][0] - K[i][0]));
  const a = K[Math.max(0, i - 1)], b = K[i], c = K[i + 1], d = K[Math.min(K.length - 1, i + 2)];
  for (let j = 1; j < 8; j++) out[j - 1] = cr(a[j], b[j], c[j], d[j], t);
  return out;
}

// centro de cada parada en el progreso del scroll
export const STOPS = [0, 0.5, 1];

export function createDirector({ camera, water, courtyard, world, sun, scene, renderer, ui, sky }) {
  const PAPER = new THREE.Color('#f6f0e1');
  const PAPER_SRGB = new THREE.Vector3(246 / 255, 240 / 255, 225 / 255);
  const intro = { k: 0 };
  const state = { hub: false, shadowsDone: false };
  const portrait = () => camera.aspect < 0.9;
  const fovF = () => (portrait() ? 56 : 44);
  void courtyard;

  // paradas: [px, py, pz, tx, ty, tz]
  // 1 lo studio (dentro il padiglione), 2 la nostra storia (il salotto e la piscina, con lo studio dietro),
  // 3 contatti (la terrazza alta con il disco di Miguel, oltre l'arco di ODA)
  const S1 = () => (portrait() ? [0.7, 1.75, -7.1, -1.5, 2.3, -14.5] : [0.8, 1.9, -6.9, -1.2, 2.4, -14.5]);
  const S2 = () => (portrait() ? [0.1, 2.0, 4.6, 0.1, 2.15, -1.6] : [0.1, 2.4, 5.4, 0.1, 2.5, -1.2]);
  const S3 = () => (portrait() ? [30.8, 9.4, -7.6, 31.0, 10.4, -17.85] : [30.8, 9.4, -8.4, 31.0, 10.2, -17.85]);

  // vista d'insieme: il castello intero sulle nuvole; la distanza si calcola sulla larghezza dello schermo
  const OV_T = new THREE.Vector3(15, -1, 2), OV_D = new THREE.Vector3(-0.62, 0.42, 0.66).normalize();
  function overview(scale, fov) {
    const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * camera.aspect);
    const dist = Math.max(64, 30 / Math.tan(hHalf)) * scale;
    const p = OV_T.clone().addScaledVector(OV_D, dist);
    return [p.x, p.y, p.z, OV_T.x, OV_T.y, OV_T.z];
  }
  function introKeys() {
    const f = fovF();
    return [
      [0.0, ...overview(1.0, 40), 40],
      [0.3, ...overview(0.84, 40), 40],
      [0.48, 12.8, -3.4, 30.0, 3.6, -1.2, 18.0, 52],         // giù sopra le nuvole, ai piedi della grande scala
      [0.6, 5.3, -3.7, 21.6, 1.8, -1.4, 16.6, 54],           // si sale, larga
      [0.71, 1.3, -1.0, 15.0, 0.1, 1.3, 10.4, 54],
      [0.8, 0.25, 2.1, 10.0, 0.15, 1.7, 3.0, (54 + f) / 2],  // arrivo sulla terrazza: il salotto e lo studio
      [0.91, 0.6, 2.0, -2.6, 0.3, 1.9, -10.0, f],            // sopra il salotto, dentro lo studio
      [1.0, ...S1(), f],
      [1.0001, ...S1(), f],
    ];
  }
  function scrollKeys() {
    const f = fovF();
    return [
      [0.0, ...S1(), f],
      [0.08, ...S1(), f],
      [0.2, 0.6, 2.0, -3.4, 0.2, 1.0, 1.5, f],            // esce dalla vetrata guardando il salotto
      [0.3, 3.6, 2.6, -1.6, 0.0, 0.7, -0.6, f],           // gira attorno al salotto
      [0.39, 3.4, 2.5, 3.6, 0.0, 1.2, -1.4, f],
      [0.46, ...S2(), f],
      [0.54, ...S2(), f],
      [0.6, 3.4, 2.3, 2.6, 9.3, 2.0, -0.4, f],            // verso l'arco sul bordo
      [0.66, 8.2, 2.3, -0.4, 13.5, 3.0, -0.4, f],         // attraverso l'arco
      [0.72, 13.4, 3.4, -0.3, 19.0, 5.0, -0.4, f],        // la scala larga
      [0.78, 19.6, 4.8, 0.6, 24.2, 5.3, -0.4, f],         // la piazza dell'arco di ODA
      [0.83, 26.4, 4.9, -0.4, 30.0, 5.6, -0.6, f],        // attraverso l'arco
      [0.88, 30.0, 6.0, -0.2, 33.4, 7.4, -3.6, f],        // ai piedi della scala curva
      [0.92, 32.8, 7.8, -4.4, 31.0, 9.5, -11.0, f],       // si sale
      [0.96, ...S3(), f],
      [1.0, ...S3(), f],
    ];
  }

  const tmp = new Array(7), tgt = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler();
  function place(v, t, sway) {
    camera.position.set(v[0], v[1] + Math.sin(t * 0.13) * sway * 0.6, v[2]);
    tgt.set(v[3], v[4], v[5]);
    camera.lookAt(tgt);
    // respiración muy leve (dron suspendido)
    e.set(Math.sin(t * 0.17 + 1.3) * sway * 0.45, Math.sin(t * 0.21) * sway + Math.sin(t * 0.083) * sway * 0.6, 0, 'YXZ');
    camera.quaternion.multiply(q.setFromEuler(e));
    if (Math.abs(camera.fov - v[6]) > 1e-3) { camera.fov = v[6]; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }

  let introRunning = false;
  function common(reveal) {
    renderer.setClearColor(PAPER, 1);
    G.uVoid.value.copy(PAPER_SRGB);
    G.uRevealC.value.set(0, -0.6);
    // il cerchio si apre sul castello e in fretta su tutto il cielo, poi la discesa
    G.uRevealR.value = 1.6 * sine(seg(reveal, 0, 0.06)) + 1800 * Math.pow(seg(reveal, 0.02, 0.36), 3.0);
    G.uRevealF.value = mix(0.8, 30.0, seg(reveal, 0.02, 0.36));
    sky.visible = reveal > 0.24;
    if (scene.fog) { scene.fog.near = 70; scene.fog.far = reveal > 0.24 ? 320 : 1e6; }
    world.puffMat.opacity = 0.85 * sine(seg(reveal, 0.2, 0.45));
    sun.intensity = 2.6;
    water.surfMat.uniforms.uSunInt.value = 1;
    scene.environmentIntensity = 1.25;
    HALO_MAT.opacity = 0.5 * sine(seg(reveal, 0.7, 0.95));
    if (!state.shadowsDone) { renderer.shadowMap.needsUpdate = true; state.shadowsDone = true; }
  }

  function frameIntro(t) {
    const k = intro.k;
    place(pathAt(introKeys(), k, tmp), t, 0.004 * k);
    common(k);
    world.reflector.visible = false;
    state.hub = k > 0.9;
  }

  function frameScroll(p, t) {
    place(pathAt(scrollKeys(), p, tmp), t, 0.004);
    common(1);
    // el espejo de agua de la piazza 2 sólo se dibuja cuando se ve
    world.reflector.visible = p > 0.62 && p < 0.9;
    // las hojas del arco de ODA se abren al acercarse
    world.setArchOpen(sine(seg(p, 0.7, 0.8)));
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
