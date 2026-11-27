// Dirección de cámara: intro (logo plano → escultura) y secuencia guiada por el scroll
// (la esfera se suelta, cae, salpica y el dron sube hasta ver el pit desde arriba).
import * as THREE from 'three';
import { G, LAYER_UNDERWATER } from './core.js';
import { morphSphere } from './sculpture.js';
import { STOOL, POOL_R } from './courtyard.js';

export const YS = 22;           // altura del punto (la esfera) sobre el patio
const FOV = 35;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * 2;
const SPHERE_Z = 0.03;          // donde cae (casi el centro de la piscina)

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const sine = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
const cubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const expoOut = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const quint = (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2);
const mix = THREE.MathUtils.lerp;

const _f = new THREE.Vector3();
function forward(yaw, pitch, out = _f) {
  return out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
}

export function createDirector({ camera, room, water, courtyard, sun, scene, renderer, ui }) {
  camera.fov = FOV;
  room.group.position.set(0, YS, -0.35);
  G.uRoomY.value = YS;
  // la esfera vive en el mundo (la sala se oculta después de la caída)
  room.group.updateMatrixWorld(true);
  scene.attach(room.sphere);
  morphSphere(room.sphere, 0, room.sphereR, STOOL.r, STOOL.h);   // la esfera nace con el radio del punto
  room.sphere.position.copy(room.group.position);
  room.group.updateMatrixWorld(true);
  const dotW = room.group.position.clone();
  const sculptW = dotW.clone().add(room.center);
  const R = room.sphereR;
  const waterY = G.uWaterY.value;
  const stoolY = 0.062 + STOOL.h / 2;

  // luz rasante: ventana a la izquierda, casi paralela al muro
  const spotFrom = new THREE.Vector3(-4.6, 2.3, 2.9);
  const spotTo = new THREE.Vector3(0.45, -1.35, -0.34);
  const spotFront = new THREE.Vector3(-1.2, 0.6, 7.5);
  const goboCam = new THREE.PerspectiveCamera(48, 1, 0.5, 40);

  const intro = { k: 0, thick: 0, ink: 1, inkAlb: 1, paper: 1, rake: 0, dust: 0, carve: 0, spot: 0, fill: 0.0 };

  const VOID = new THREE.Color('#120d0a'), PAPER = new THREE.Color('#f6f0e1'), clearCol = new THREE.Color();
  const state = { splashed: false, morphK: -1, aspect: 1, hub: false, lastShadow: -1 };

  // distancias de encuadre según la proporción de pantalla
  const sculptDist = () => {
    const a = camera.aspect;
    const dh = (room.size.y + 0.5) / (0.6 * TAN);
    const dw = (room.size.x + 0.4) / (0.84 * TAN * a);
    return Math.max(dh, dw);
  };
  const hubDist = () => {
    const a = camera.aspect;
    return Math.max(7.2 / TAN, 5.7 / (TAN * a)) * 1.02;
  };
  const HUB_T = new THREE.Vector3(0.02, 0, -1.05);

  // pose del inicio del scroll (= final de la intro)
  const YAW0 = -0.08, PITCH0 = -0.05;
  const T0 = () => sculptW.clone().add(new THREE.Vector3(0.22, 0.02, 0));

  // --- esfera según el progreso del scroll
  const S = new THREE.Vector3();
  function spherePos(p) {
    const det = sine(seg(p, 0.02, 0.11));
    let x = dotW.x, y = dotW.y + Math.sin(Math.PI * det) * 0.05, z = mix(dotW.z, SPHERE_Z, det);
    const fall = seg(p, 0.1, 0.4);
    if (fall > 0) y = mix(dotW.y, waterY, Math.pow(fall, 1.75));
    // bajo el agua: se hunde y vuelve a flotar (la madera flota)
    const uw = seg(p, 0.4, 0.56);
    if (uw > 0) {
      const sink = Math.sin(Math.PI * Math.pow(uw, 0.55)) * 0.62;
      const floatY = waterY - R * 0.28;
      y = mix(waterY, floatY, sine(uw)) - sink;
    }
    // deriva hacia el borde norte, sale y se vuelve taburete
    const drift = sine(seg(p, 0.55, 0.68));
    const out = cubic(seg(p, 0.66, 0.82));
    if (drift > 0 || out > 0) {
      const bob = Math.sin(p * 140) * 0.012 * (1 - out);
      const fx = mix(x, STOOL.x, drift * 0.9), fz = mix(z, -(POOL_R - R - 0.1), drift);
      x = mix(fx, STOOL.x, out);
      z = mix(fz, STOOL.z, out);
      const floatY = waterY - R * 0.28 + bob;
      y = mix(floatY, stoolY, out) + Math.sin(Math.PI * out) * 0.34;
      if (drift > 0 && out === 0) y = floatY;
    }
    return S.set(x, y, z);
  }

  // --- pose de cámara del scroll: objetivo, yaw, pitch, distancia
  const tmpT = new THREE.Vector3();
  function pose(p, out) {
    const d1 = sculptDist();
    const dh = hubDist();
    const sp = spherePos(p);
    // objetivo
    const T = tmpT.copy(T0());
    const toDot = sine(seg(p, 0.0, 0.14));
    T.lerp(sp, toDot);
    const toPool = sine(seg(p, 0.4, 0.5));
    T.lerp(new THREE.Vector3(0, waterY, SPHERE_Z), toPool);
    const toHub = cubic(seg(p, 0.5, 0.9));
    T.lerp(HUB_T, toHub);
    // orientación
    const tilt = cubic(seg(p, 0.06, 0.3));
    let pitch = mix(PITCH0, -1.22, tilt);                              // cae mirando abajo, delante de la escultura
    pitch = mix(pitch, -Math.PI / 2, sine(seg(p, 0.34, 0.5)));        // cenital sobre el agua
    pitch += Math.sin(Math.PI * seg(p, 0.55, 0.92)) * 0.2;           // ligera inclinación al subir (paralaje)
    const yaw = mix(YAW0, 0.62, sine(seg(p, 0.08, 0.42))) * (1 - sine(seg(p, 0.48, 0.92)));
    // distancia
    let D = mix(d1, d1 * 0.82, sine(seg(p, 0.0, 0.1)));
    D = mix(D, 3.6, cubic(seg(p, 0.08, 0.32)));
    D = mix(D, 2.7, sine(seg(p, 0.38, 0.5)));
    D = Math.exp(mix(Math.log(D), Math.log(dh), cubic(seg(p, 0.5, 0.9))));
    D *= 1 + 0.035 * sine(seg(p, 0.9, 1));
    out.target.copy(T);
    out.yaw = yaw; out.pitch = pitch; out.dist = D;
    return out;
  }

  const P = { target: new THREE.Vector3(), yaw: 0, pitch: 0, dist: 10 };
  const camT = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  function applyCamera(target, yaw, pitch, dist, t) {
    // respiración: la cámara se mueve muy poco, nunca la escultura
    const br = 0.012;
    const by = Math.sin(t * 0.21) * br, bp = Math.sin(t * 0.17 + 1.3) * br * 0.6;
    euler.set(pitch + bp, yaw + by, 0);
    camera.quaternion.setFromEuler(euler);
    forward(yaw + by, pitch + bp);
    camera.position.copy(target).addScaledVector(_f, -dist);
    camera.updateMatrixWorld();
  }

  function setSpot(rake, t) {
    const sway = Math.sin(t * 0.09) * 0.25;
    const from = spotFront.clone().lerp(spotFrom, rake);
    from.z += sway * rake; from.y += Math.sin(t * 0.07) * 0.12 * rake;
    // el foco es hijo del grupo de la sala: coordenadas locales (origen = la esfera)
    room.spot.position.copy(from);
    room.spot.target.position.copy(spotTo);
    room.spot.angle = mix(0.62, 0.46, rake);
    room.spot.penumbra = 1.0;
    room.spot.target.updateMatrixWorld();
    room.spot.updateMatrixWorld();
    const wFrom = from.add(dotW), wTo = spotTo.clone().add(dotW);
    // proyector de sombras de hojas (misma posición que el foco)
    goboCam.position.copy(wFrom);
    goboCam.fov = THREE.MathUtils.radToDeg(room.spot.angle) * 2;
    goboCam.lookAt(wTo);
    goboCam.updateProjectionMatrix();
    goboCam.updateMatrixWorld();
    G.uSpotGoboMat.value.multiplyMatrices(goboCam.projectionMatrix, goboCam.matrixWorldInverse);
    G.uSpotGoboAmt.value = 0.9 * rake;
    room.dustU.uSpotPos.value.copy(wFrom);
    room.dustU.uSpotDir.value.copy(wTo).sub(wFrom).normalize();
    room.dustU.uSpotCos.value = Math.cos(room.spot.angle);
  }

  // --- posición exacta del logo plano (coincide con el SVG del cargador)
  const vb = room.vbLocal.clone().add(room.group.position);   // centro del viewBox en el mundo
  function flatDistance(logoPx, viewH) {
    return room.viewBoxH / ((logoPx / viewH) * TAN);
  }

  let flatPx = 84, introRunning = false;
  function applyLook() {
    room.thick.value = Math.max(0.002, intro.thick);
    G.uInkMix.value = intro.ink;
    G.uPaperMix.value = intro.paper;
    room.setInkAlbedo(intro.inkAlb);
    room.setCarve(intro.carve);
  }
  function frameIntro(t) {
    const k = intro.k;
    const d0 = flatDistance(flatPx, renderer.domElement.clientHeight);
    pose(0, P);
    // distancia en escala logarítmica: el crecimiento se percibe uniforme
    const d = Math.exp(mix(Math.log(d0), Math.log(P.dist), k));
    camT.copy(vb).lerp(P.target, k);
    applyCamera(camT, P.yaw * k, P.pitch * k, d, t * k);
    applyLook();
    setSpot(intro.rake, t);
    room.spot.intensity = intro.spot;
    room.fill.intensity = intro.fill;
    room.dustU.uDust.value = intro.dust;
    G.uRoomDark.value = 0;
    room.group.visible = true;
    room.wall.visible = true;
    courtyard.group.visible = false;
    // fondo: papel del logo al principio, sombra cálida después
    clearCol.copy(VOID).lerp(PAPER, intro.paper);
    renderer.setClearColor(clearCol, 1);
    scene.environmentIntensity = 0.08;
    sun.intensity = 0;
    G.uRevealR.value = 0;
  }

  function frameScroll(p, t, dt) {
    applyLook();
    renderer.setClearColor(VOID, 1);
    pose(p, P);
    applyCamera(P.target, P.yaw, P.pitch, P.dist, t);

    // esfera
    const sp = spherePos(p);
    room.sphere.position.copy(sp);
    const k = sine(seg(p, 0.68, 0.81));
    if (Math.abs(k - state.morphK) > 1e-4) {
      morphSphere(room.sphere, k, R, STOOL.r, STOOL.h);
      state.morphK = k;
    }
    const under = sp.y - R * 0.9 < waterY;
    if (under) room.sphere.layers.enable(LAYER_UNDERWATER); else room.sphere.layers.disable(LAYER_UNDERWATER);
    // salpicadura (en tiempo real, al cruzar la superficie)
    if (!state.splashed && sp.y - R * 0.2 < waterY && p > 0.3 && p < 0.5) {
      state.splashed = true;
      water.splash(sp.x, sp.z, 1);
    }
    if (state.splashed && (p < 0.3 || sp.y > waterY + 1.5)) state.splashed = false;

    // luces: de la sala oscura a la luz del día
    const dayK = sine(seg(p, 0.15, 0.38));
    setSpot(1, t);
    room.spot.intensity = intro.spot * (1 - sine(seg(p, 0.12, 0.3)));
    room.fill.intensity = intro.fill * (1 - dayK);
    room.dustU.uDust.value = intro.dust * (1 - sine(seg(p, 0.08, 0.22)));
    G.uRoomDark.value = sine(seg(p, 0.1, 0.24));
    sun.intensity = 3.1 * dayK;
    water.surfMat.uniforms.uSunInt.value = 1.0 * dayK;
    scene.environmentIntensity = mix(0.08, 0.95, dayK);
    // revelado circular: primero el agua, luego la luz inunda el patio
    G.uRevealR.value = 1.3 * sine(seg(p, 0.12, 0.25)) + 34 * Math.pow(seg(p, 0.25, 0.47), 2.0);
    G.uRevealF.value = mix(0.5, 4.0, seg(p, 0.22, 0.47));
    room.group.visible = p < 0.34;
    room.wall.visible = p < 0.24;   // ya en penumbra total: deja ver el patio que se revela
    courtyard.group.visible = p > 0.08;
    // sombras estáticas en el pit: se recalculan sólo cuando algo cambia
    const needAuto = p < 0.86;
    renderer.shadowMap.autoUpdate = needAuto;
    if (!needAuto && state.lastShadow !== Math.round(p * 200)) { renderer.shadowMap.needsUpdate = true; state.lastShadow = Math.round(p * 200); }
    state.hub = p > 0.88;
    ui(p);
  }

  return {
    intro, state,
    setFlatPx(px) { flatPx = px; },
    startIntro() { introRunning = true; },
    endIntro() { introRunning = false; },
    get introRunning() { return introRunning; },
    frameIntro, frameScroll, spherePos,
    waterY,
  };
}
