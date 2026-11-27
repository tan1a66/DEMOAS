// Dirección de cámara.
// Intro: el logo plano crece y se vuelve escultura de madera (la pieza nunca gira: se mueve la cámara).
// Scroll: la cámara sobrevuela la escultura, mira hacia abajo, en el papel se abre un círculo sobre
// Casa Skoura vista desde el dron, y el dron baja en espiral hasta quedarse mirando el sofá.
import * as THREE from 'three';
import { G } from './core.js';
import { HALO_MAT } from './courtyard.js';

const FOV0 = 35;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const sine = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
const mix = THREE.MathUtils.lerp;
const tanH = (fov) => Math.tan(THREE.MathUtils.degToRad(fov / 2)) * 2;

const _f = new THREE.Vector3();
function forward(yaw, pitch, out = _f) {
  return out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
}
// Catmull-Rom escalar (C1: la cámara no se detiene en cada punto de paso)
function cr(a, b, c, d, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}

export function createDirector({ camera, logo, water, courtyard, sun, scene, renderer, ui, sky }) {
  const LOGO_POS = new THREE.Vector3(0, 30, 15);
  logo.group.position.copy(LOGO_POS);
  logo.group.updateMatrixWorld(true);
  const sculptW = LOGO_POS.clone().add(logo.center);
  const vb = logo.vbLocal.clone().add(LOGO_POS);
  const PAPER = new THREE.Color('#f6f0e1');
  const PAPER_SRGB = new THREE.Vector3(246 / 255, 240 / 255, 225 / 255);

  const intro = { k: 0, build: 0, ink: 1, light: 0 };
  const state = { hub: false, shadowsDone: false };

  const portrait = () => camera.aspect < 0.9;
  const sculptDist = () => {
    const a = camera.aspect, T = tanH(FOV0);
    const dh = logo.size.y / (0.72 * T);
    const dw = logo.size.x / (0.96 * T * a);
    return Math.max(dh, dw);
  };

  // puntos de paso [p, x, y, z, yaw, pitch, fov]
  function keys() {
    const d1 = sculptDist();
    const Y0 = 0.3, P0 = -0.07;
    const T0 = sculptW.clone().add(new THREE.Vector3(0.12, 0.12, 0.3));
    const c0 = T0.clone().addScaledVector(forward(Y0, P0), -d1);
    const L = LOGO_POS;
    const fovF = portrait() ? 70 : 60;
    const hubY = portrait() ? 34 : 26;
    const stop1 = portrait() ? [0.1, 1.75, 3.3, 0.0, 0.1] : [0.1, 2.25, 3.9, 0.0, 0.07];
    const stop2 = portrait() ? [-0.45, 2.75, -4.3, -Math.PI + 0.06, -0.24] : [-0.5, 2.9, -4.4, -Math.PI + 0.06, -0.2];
    return [
      [0.0, c0.x, c0.y, c0.z, Y0, P0, FOV0],
      [0.11, c0.x * 0.55 + 0.6, L.y + 1.6, L.z + d1 * 0.62, 0.22, -0.42, FOV0],
      [0.22, 0.35, L.y + 6.5, L.z + 0.6, 0.06, -1.3, FOV0],
      [0.34, 0.0, hubY, 0.9, 0.0, -Math.PI / 2 + 0.001, FOV0 + 2],
      [0.47, 2.7, 11.5, 5.6, 0.44, -1.02, 46],
      [0.58, 1.0, 3.6, 3.7, 0.15, -0.3, (58 + fovF) / 2],
      // tappa 1: dal lato della casa sud, il divano con la casa nord dietro
      [0.66, ...stop1, fovF],
      [0.74, ...stop1, fovF],
      // giro intorno alla piscina dal lato ovest
      [0.86, -1.9, 4.4, -0.6, -Math.PI / 2, -0.82, fovF],
      // tappa 2: dietro lo schienale, la casa sud con l'oculo
      [0.96, ...stop2, fovF],
      [1.0, ...stop2, fovF],
    ];
  }

  function pathAt(p, out) {
    const K = keys();
    let i = 0;
    while (i < K.length - 2 && p > K[i + 1][0]) i++;
    const t = clamp01((p - K[i][0]) / (K[i + 1][0] - K[i][0]));
    const a = K[Math.max(0, i - 1)], b = K[i], c = K[i + 1], d = K[Math.min(K.length - 1, i + 2)];
    for (let j = 1; j < 7; j++) out[j - 1] = cr(a[j], b[j], c[j], d[j], t);
    return out;
  }

  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  // respiración: la cámara orbita muy despacio alrededor de lo que mira (a orbitD metros),
  // así la pieza queda centrada y el movimiento revela su volumen
  function place(x, y, z, yaw, pitch, fov, t, sway, orbitD = 0) {
    const by = Math.sin(t * 0.21) * sway + Math.sin(t * 0.083) * sway * 0.6;
    const bp = Math.sin(t * 0.17 + 1.3) * sway * 0.45;
    let px = x, py = y, pz = z;
    if (orbitD > 0) {
      const f0 = forward(yaw, pitch).clone();
      const cx = x + f0.x * orbitD, cy = y + f0.y * orbitD, cz = z + f0.z * orbitD;
      const f1 = forward(yaw + by, pitch + bp);
      px = cx - f1.x * orbitD; py = cy - f1.y * orbitD; pz = cz - f1.z * orbitD;
    }
    euler.set(pitch + bp, yaw + by, 0);
    camera.quaternion.setFromEuler(euler);
    camera.position.set(px, py, pz);
    if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }

  let flatPx = 84, introRunning = false;
  const tmp = new Array(6), cam0 = new THREE.Vector3(), tgt = new THREE.Vector3();

  function applyLook(light) {
    logo.set({ ...intro, light });
  }

  function frameIntro(t) {
    const k = intro.k;
    applyLook(intro.light);
    const K0 = keys()[0];
    const d1 = sculptDist();
    const d0 = logo.viewBoxH / ((flatPx / renderer.domElement.clientHeight) * tanH(FOV0));
    const T0 = cam0.set(K0[1], K0[2], K0[3]).addScaledVector(forward(K0[4], K0[5]), d1);
    tgt.copy(vb).lerp(T0, k);
    const yaw = K0[4] * k, pitch = K0[5] * k;
    const d = Math.exp(mix(Math.log(d0), Math.log(d1), k));
    const f = forward(yaw, pitch);
    place(tgt.x - f.x * d, tgt.y - f.y * d, tgt.z - f.z * d, yaw, pitch, FOV0, t, 0.06 * k, d);
    logo.group.visible = true;
    courtyard.group.visible = false;
    sky.visible = false;
    sun.intensity = 0;
    renderer.shadowMap.needsUpdate = true;   // los listones se arman: sombras propias vivas
    renderer.setClearColor(PAPER, 1);
    G.uRevealR.value = 0;
    HALO_MAT.opacity = 0;
  }

  function frameScroll(p, t) {
    const toHouse = sine(seg(p, 0, 0.13));
    pathAt(p, tmp);
    place(tmp[0], tmp[1], tmp[2], tmp[3], tmp[4], tmp[5], t, mix(0.06, 0.005, toHouse), sculptDist() * (1 - toHouse));

    const logoLight = 1 - sine(seg(p, 0.17, 0.28));
    applyLook(intro.light * logoLight);
    logo.group.visible = p < 0.3;
    courtyard.group.visible = p > 0.16;
    sky.visible = p > 0.42;
    renderer.setClearColor(PAPER, 1);

    // el círculo de luz se abre en el papel: primero el agua, luego toda la casa
    G.uVoid.value.copy(PAPER_SRGB);
    G.uRevealC.value.set(0, -0.6);
    const r = seg(p, 0.2, 0.42);
    G.uRevealR.value = 1.6 * sine(seg(p, 0.2, 0.27)) + 46 * Math.pow(r, 2.2);
    G.uRevealF.value = mix(0.8, 7.0, r);

    const day = sine(seg(p, 0.18, 0.34));
    sun.intensity = 2.6 * day;
    water.surfMat.uniforms.uSunInt.value = day;
    scene.environmentIntensity = 1.25;
    HALO_MAT.opacity = 0.5 * sine(seg(p, 0.42, 0.56));   // luz rebotada del patio: las fachadas en sombra no quedan negras

    if (p < 0.31) renderer.shadowMap.needsUpdate = true;
    else if (!state.shadowsDone) { renderer.shadowMap.needsUpdate = true; state.shadowsDone = true; }
    if (p < 0.26) state.shadowsDone = false;
    state.hub = p > 0.62;
    ui(p);
  }

  return {
    intro, state,
    setFlatPx(px) { flatPx = px; },
    startIntro() { introRunning = true; },
    endIntro() { introRunning = false; },
    get introRunning() { return introRunning; },
    invalidateShadows() { state.shadowsDone = false; },
    frameIntro, frameScroll,
  };
}
