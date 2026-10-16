// EL PATIO: portón de entrada + zaguán + patio de tres pisos (escena 3D principal).
// También gestiona la cámara: intro por el portón, mirada con paralaje/arrastre
// y vuelos hacia las cuatro puertas.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { QUALITY, motion, IS_MOBILE } from '../../config.js?v=2';
import { tileCanvas, plasterCanvas, woodCanvas, limestoneCanvas, plaqueCanvas, plaqueGlowCanvas, makeCanvas } from '../../util/textures.js?v=2';
import { toTexture } from '../../util/gltex.js?v=2';
import { merge, place, box, worldUV, wallPieces } from './geo.js?v=2';
import { corinthianColumn } from './column.js?v=2';
import { railingBay } from './ironwork.js?v=2';
import { makeLibertyDoor, makePortal } from './door.js?v=2';
import { makeRibbons } from './ribbons.js?v=2';
import { makeVines } from './vines.js?v=2';
import { lanternGeometry, makeGlows, makeShafts, makeDust, makeLightPools } from './lights.js?v=2';
import { tween, ease, damp, clamp, nextFrame } from '../../util/tween.js?v=2';
import { t } from '../../i18n.js?v=2';
import { playLatch, playWhoosh } from '../../util/audio.js?v=2';

// Medidas (metros)
const A = 4.5;                 // semilado del patio abierto
const W = 6.9;                 // cara interior de los muros exteriores
const WT = 0.45;               // grosor de muro
const FL = [0, 5.2, 9.4];      // niveles de piso
const ROOF = 13.4;
const SLAB = 0.32, BEAM_H = 0.6, BEAM_D = 0.46;
const COLS = [-4.5, -1.5, 1.5, 4.5];
const ZAG = { w: 3.2, z0: W, z1: 10.5 };   // zaguán
const FACADE = { z: 10.5, t: 0.7 };
const HUB = new THREE.Vector3(0, 1.62, 4.85);
const HUB_PITCH = 0.12;

export const DOOR_IDS = ['nosotros', 'habitaciones', 'servicios', 'experiencias'];
const DOOR_DEFS = {
  nosotros: { side: 'west', pos: [-W, -3] },
  habitaciones: { side: 'north', pos: [-3, -W] },
  servicios: { side: 'north', pos: [3, -W] },
  experiencias: { side: 'east', pos: [W, -3] },
};
const SIDES = {
  north: { origin: [0, -W], rotY: 0, local: (x, z) => x },
  south: { origin: [0, W], rotY: Math.PI, local: (x, z) => -x },
  west: { origin: [-W, 0], rotY: Math.PI / 2, local: (x, z) => -z },
  east: { origin: [W, 0], rotY: -Math.PI / 2, local: (x, z) => z },
};

function skyMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color('#5b8fb5') }, uHorizon: { value: new THREE.Color('#f3c99a') },
      uBottom: { value: new THREE.Color('#d9b38a') }, uSun: { value: sunDir.clone().normalize() },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; uniform vec3 uSun; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
        c = mix(uBottom, c, smoothstep(-0.15, 0.02, h));
        float s = max(dot(d, uSun), 0.0);
        c += vec3(1.0, 0.8, 0.55) * (pow(s, 8.0) * 0.35 + pow(s, 200.0) * 2.0);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function skylightCanvas() {
  const c = makeCanvas(512);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(256, 200, 20, 256, 256, 380);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#eef6f8'); g.addColorStop(1, '#bcd6e0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
  // nubes muy suaves
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 30 + Math.random() * 90;
    const cg = ctx.createRadialGradient(x, y, 0, x, y, r);
    cg.addColorStop(0, 'rgba(255,255,255,0.35)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

// Puerta de habitación (decorativa, cerrada): devuelve piezas por material.
function roomDoorParts(w = 1.3, h = 2.7, louvers = true) {
  const wood = [], dark = [];
  const fw = 0.12;
  dark.push(box(fw, h + 0.12, 0.08, -(w / 2 + fw / 2), 0, 0.04));
  dark.push(box(fw, h + 0.12, 0.08, w / 2 + fw / 2, 0, 0.04));
  dark.push(box(w + 2 * fw + 0.08, 0.16, 0.1, 0, h + 0.12, 0.05));
  dark.push(box(w + 2 * fw + 0.22, 0.05, 0.15, 0, h + 0.28, 0.07));
  // sopraluce de vidrio oscuro con travesaño
  dark.push(box(w, 0.06, 0.06, 0, h - 0.5, 0.03));
  for (const s of [-1, 1]) {
    const cx = s * w / 4;
    const lw = w / 2 - 0.02;
    wood.push(box(0.07, h - 0.5, 0.05, cx - lw / 2 + 0.035, 0, 0.03));
    wood.push(box(0.07, h - 0.5, 0.05, cx + lw / 2 - 0.035, 0, 0.03));
    wood.push(box(lw, 0.16, 0.05, cx, 0, 0.03));
    wood.push(box(lw, 0.08, 0.05, cx, h - 0.58, 0.03));
    wood.push(box(lw, 0.09, 0.05, cx, (h - 0.5) * 0.42, 0.03));
    wood.push(box(lw - 0.14, (h - 0.5) * 0.42 - 0.2, 0.035, cx, 0.18, 0.035));
    if (louvers) {
      const y0 = (h - 0.5) * 0.42 + 0.1, y1 = h - 0.6;
      for (let y = y0; y < y1; y += 0.075) wood.push(place(new THREE.BoxGeometry(lw - 0.14, 0.055, 0.012), cx, y + 0.03, 0.035, -0.6, 0, 0));
    } else {
      wood.push(box(lw - 0.14, h - 0.6 - ((h - 0.5) * 0.42 + 0.1), 0.035, cx, (h - 0.5) * 0.42 + 0.1, 0.035));
    }
  }
  return { wood, dark };
}

export async function createPatio(engine, { onProgress } = {}) {
  const hq = QUALITY.tier === 'high';
  const renderer = engine.renderer;
  const step = async (p) => { onProgress?.(p); await nextFrame(); };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.08, 160);
  const sunDir = new THREE.Vector3(-0.2, 1, 0.24).normalize();

  // ── materiales ──
  const aniso = Math.min(QUALITY.aniso, renderer.capabilities.getMaxAnisotropy());
  const plasterTex = toTexture(plasterCanvas(512, [244, 239, 229], 3), { aniso });
  const stoneTex = toTexture(plasterCanvas(256, [240, 237, 230], 9, 0.55), { aniso });
  const woodTex = toTexture(woodCanvas(512, 5), { aniso });
  const tileATex = toTexture(tileCanvas('rosette', QUALITY.texSize, 11), { aniso });
  const tileBTex = toTexture(tileCanvas('diamond', QUALITY.texSize / 2, 12), { aniso });
  const canteraTex = toTexture(plasterCanvas(512, [228, 216, 192], 31, 1.8), { aniso });
  const mats = {
    plaster: new THREE.MeshStandardMaterial({ map: plasterTex, color: '#f7f2e8', roughness: 0.93 }),
    ceiling: new THREE.MeshStandardMaterial({ map: plasterTex, color: '#fbf8f2', roughness: 0.95 }),
    paint: new THREE.MeshStandardMaterial({ map: plasterTex, color: '#93cbbf', roughness: 0.9 }),
    facade: new THREE.MeshStandardMaterial({ map: plasterTex, color: '#eedcbf', roughness: 0.92 }),
    stone: new THREE.MeshStandardMaterial({ map: stoneTex, color: '#fbf8f2', roughness: 0.72 }),
    cantera: new THREE.MeshStandardMaterial({ map: canteraTex, color: '#e2d6bf', roughness: 0.85 }),
    tileA: new THREE.MeshStandardMaterial({ map: tileATex, roughness: 0.5 }),
    tileB: new THREE.MeshStandardMaterial({ map: tileBTex, roughness: 0.55 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTex, color: '#9a7558', roughness: 0.55 }),
    woodDark: new THREE.MeshStandardMaterial({ map: woodTex, color: '#6b4c38', roughness: 0.6 }),
    viga: new THREE.MeshStandardMaterial({ map: woodTex, color: '#7a5a42', roughness: 0.7 }),
    iron: new THREE.MeshStandardMaterial({ color: '#171615', roughness: 0.42, metalness: 0.75 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c79c5e', roughness: 0.28, metalness: 1 }),
    glassWarm: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf8e').multiplyScalar(0.9), side: THREE.DoubleSide }),
    glassDay: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4dc').multiplyScalar(1.4), side: THREE.DoubleSide }),
    lantern: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd08a').multiplyScalar(2.2) }),
    street: new THREE.MeshStandardMaterial({ color: '#5f5a55', roughness: 0.95 }),
    sidewalk: new THREE.MeshStandardMaterial({ map: canteraTex, color: '#b7ad9d', roughness: 0.9 }),
  };
  const G = {}; for (const k of Object.keys(mats)) G[k] = [];
  await step(0.1);

  // ── suelos ──
  G.tileA.push(place(new THREE.PlaneGeometry(2 * A, 2 * A), 0, 0, 0, -Math.PI / 2));
  for (const s of [-1, 1]) {
    G.tileB.push(place(new THREE.PlaneGeometry(2 * W, W - A), 0, 0.002, s * (W + A) / 2, -Math.PI / 2));
    G.tileB.push(place(new THREE.PlaneGeometry(W - A, 2 * A), s * (W + A) / 2, 0.002, 0, -Math.PI / 2));
  }
  // cenefa de piedra en el borde del patio
  for (const s of [-1, 1]) {
    G.stone.push(box(2 * A + 0.3, 0.04, 0.15, 0, 0, s * (A + 0.075)));
    G.stone.push(box(0.15, 0.04, 2 * A, s * (A + 0.075), 0, 0));
  }
  G.tileB.push(place(new THREE.PlaneGeometry(ZAG.w, ZAG.z1 - ZAG.z0), 0, 0.002, (ZAG.z0 + ZAG.z1) / 2, -Math.PI / 2));

  // ── losas, techos y vigas ──
  for (const y of [FL[1], FL[2], ROOF]) {
    for (const s of [-1, 1]) {
      G.stone.push(box(2 * W + 2 * WT, SLAB, W - A, 0, y - SLAB, s * (W + A) / 2));
      G.stone.push(box(W - A, SLAB, 2 * A, s * (W + A) / 2, y - SLAB, 0));
    }
    // vigas de madera bajo la losa (techo de viguería)
    const yb = y - SLAB - 0.17;
    for (let x = -W + 0.3; x <= W - 0.2; x += 0.55) {
      for (const s of [-1, 1]) G.viga.push(box(0.12, 0.17, W - A, x, yb, s * (W + A) / 2));
    }
    for (let z = -A + 0.3; z <= A - 0.2; z += 0.55) {
      for (const s of [-1, 1]) G.viga.push(box(W - A, 0.17, 0.12, s * (W + A) / 2, yb, z));
    }
  }
  // techo del zaguán
  G.stone.push(box(ZAG.w + 2 * 0.4, SLAB, ZAG.z1 - ZAG.z0, 0, FL[1] - SLAB, (ZAG.z0 + ZAG.z1) / 2));
  for (let z = ZAG.z0 + 0.3; z < ZAG.z1; z += 0.5) G.viga.push(box(ZAG.w, 0.17, 0.12, 0, FL[1] - SLAB - 0.17, z));

  // ── entablamentos alrededor del patio ──
  for (const y of [FL[1], FL[2], ROOF]) {
    for (const s of [-1, 1]) {
      G.stone.push(box(2 * A + BEAM_D, BEAM_H, BEAM_D, 0, y - BEAM_H, s * A));
      G.stone.push(box(BEAM_D, BEAM_H, 2 * A + BEAM_D, s * A, y - BEAM_H, 0));
      // molduras: cornisa superior y filete inferior
      G.stone.push(box(2 * A + BEAM_D + 0.14, 0.07, BEAM_D + 0.14, 0, y - 0.07, s * A));
      G.stone.push(box(BEAM_D + 0.14, 0.07, 2 * A + BEAM_D + 0.14, s * A, y - 0.07, 0));
      G.stone.push(box(2 * A + BEAM_D + 0.06, 0.05, BEAM_D + 0.06, 0, y - BEAM_H + 0.06, s * A));
      G.stone.push(box(BEAM_D + 0.06, 0.05, 2 * A + BEAM_D + 0.06, s * A, y - BEAM_H + 0.06, 0));
      G.stone.push(box(2 * A + BEAM_D + 0.04, 0.035, BEAM_D + 0.04, 0, y - BEAM_H * 0.55, s * A));
      G.stone.push(box(BEAM_D + 0.04, 0.035, 2 * A + BEAM_D + 0.04, s * A, y - BEAM_H * 0.55, 0));
    }
  }
  // pretil sobre la azotea y marco del lucernario
  for (const s of [-1, 1]) {
    G.stone.push(box(2 * A + 0.9, 0.7, 0.3, 0, ROOF, s * (A + 0.15)));
    G.stone.push(box(0.3, 0.7, 2 * A + 0.9, s * (A + 0.15), ROOF, 0));
    G.stone.push(box(2 * A + 1.1, 0.08, 0.5, 0, ROOF + 0.62, s * (A + 0.15)));
    G.stone.push(box(0.5, 0.08, 2 * A + 1.1, s * (A + 0.15), ROOF + 0.62, 0));
  }
  await step(0.2);

  // ── muros exteriores con vanos ──
  const floorH = [FL[1], FL[2] - FL[1], ROOF - FL[2] + 0.7];
  const openings = { north: [], south: [{ c: 0, w: ZAG.w, h: FL[1] - SLAB }], west: [], east: [] };
  for (const id of DOOR_IDS) {
    const d = DOOR_DEFS[id];
    openings[d.side].push({ c: SIDES[d.side].local(d.pos[0], d.pos[1]), w: 1.7, h: 3.67 });
  }
  const roomDoorAt = { north: [0], south: [-3, 3], west: [0, -3], east: [0, 3] };
  const wallLen = 2 * W + 2 * WT;
  for (const [side, def] of Object.entries(SIDES)) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(def.origin[0], 0, def.origin[1]),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY),
      new THREE.Vector3(1, 1, 1),
    );
    const put = (list, geos) => geos.forEach((g) => list.push(g.applyMatrix4(m)));
    let y = 0;
    floorH.forEach((h, level) => {
      const ops = level === 0 ? openings[side] : [];
      put(G.plaster, wallPieces(wallLen, h, WT, ops, y).map((g) => g.translate(0, 0, -WT / 2)));
      if (level === 0) {
        // zócalo pintado en verde agua con filete
        const dado = wallPieces(2 * W, 1.15, 0.015, ops.map((o) => ({ ...o, h: 9 })), 0).map((g) => g.translate(0, 0, 0.0075));
        put(G.paint, dado);
        put(G.woodDark, wallPieces(2 * W, 0.035, 0.03, ops.map((o) => ({ ...o, h: 9 })), 1.15).map((g) => g.translate(0, 0, 0.015)));
        // puertas de habitación decorativas
        for (const c of roomDoorAt[side]) {
          const p = roomDoorParts(1.5, 3.0, false);
          put(G.wood, p.wood.map((g) => g.translate(c, 0, 0)));
          put(G.woodDark, p.dark.map((g) => g.translate(c, 0, 0)));
        }
      } else {
        for (const c of [-3, 0, 3]) {
          const p = roomDoorParts(1.3, 2.75, true);
          put(G.wood, p.wood.map((g) => g.translate(c, y, 0)));
          put(G.woodDark, p.dark.map((g) => g.translate(c, y, 0)));
        }
      }
      y += h;
    });
  }
  // muros del zaguán
  for (const s of [-1, 1]) {
    G.plaster.push(box(0.4, FL[1], ZAG.z1 - ZAG.z0 + 0.1, s * (ZAG.w / 2 + 0.2), 0, (ZAG.z0 + ZAG.z1) / 2));
    G.paint.push(box(0.015, 1.15, ZAG.z1 - ZAG.z0, s * (ZAG.w / 2 - 0.0075), 0, (ZAG.z0 + ZAG.z1) / 2));
    G.woodDark.push(box(0.03, 0.035, ZAG.z1 - ZAG.z0, s * (ZAG.w / 2 - 0.015), 1.15, (ZAG.z0 + ZAG.z1) / 2));
  }
  await step(0.3);

  // ── fachada con vano de medio punto ──
  {
    const pw = 2.5, spring = 3.3;
    const sh = new THREE.Shape();
    sh.moveTo(-9, -0.3); sh.lineTo(9, -0.3); sh.lineTo(9, 8.2); sh.lineTo(-9, 8.2); sh.lineTo(-9, -0.3);
    const hole = new THREE.Path();
    hole.moveTo(-pw / 2, 0); hole.lineTo(pw / 2, 0); hole.lineTo(pw / 2, spring);
    hole.absarc(0, spring, pw / 2, 0, Math.PI, false);
    hole.lineTo(-pw / 2, 0);
    sh.holes.push(hole);
    // ventanas laterales (vanos rectangulares)
    for (const s of [-1, 1]) {
      const wh = new THREE.Path();
      const x0 = s * 4.6 - 0.65, x1 = s * 4.6 + 0.65;
      wh.moveTo(x0, 0.9); wh.lineTo(x1, 0.9); wh.lineTo(x1, 3.7); wh.lineTo(x0, 3.7); wh.lineTo(x0, 0.9);
      sh.holes.push(wh);
    }
    const fg = new THREE.ExtrudeGeometry(sh, { depth: FACADE.t, bevelEnabled: false, curveSegments: hq ? 32 : 18 });
    G.facade.push(place(fg, 0, 0, FACADE.z));
    const zf = FACADE.z + FACADE.t;
    // marco de cantera del arco
    const fr = new THREE.Shape();
    const ro = pw / 2 + 0.3, ri = pw / 2;
    fr.moveTo(-ro, 0); fr.lineTo(-ro, spring); fr.absarc(0, spring, ro, Math.PI, 0, true); fr.lineTo(ro, 0);
    fr.lineTo(ri, 0); fr.lineTo(ri, spring); fr.absarc(0, spring, ri, 0, Math.PI, false); fr.lineTo(-ri, 0); fr.lineTo(-ro, 0);
    G.cantera.push(place(new THREE.ExtrudeGeometry(fr, { depth: 0.12, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: hq ? 32 : 18 }), 0, 0, zf));
    G.cantera.push(box(0.36, 0.5, 0.2, 0, spring + pw / 2 + 0.05, zf + 0.04));          // clave
    G.cantera.push(box(ro * 2 + 0.3, 0.22, 0.18, 0, spring - 0.11, zf + 0.02));       // impostas
    G.cantera.push(box(18, 0.55, 0.1, 0, 0, zf));                                   // zócalo
    G.cantera.push(box(18.2, 0.16, 0.3, 0, 7.4, zf));                               // cornisa
    G.cantera.push(box(18.4, 0.1, 0.4, 0, 7.56, zf));
    G.cantera.push(box(18, 0.5, 0.06, 0, 7.66, zf));
    // pilastras
    for (const x of [-7.2, -2.3, 2.3, 7.2]) G.cantera.push(box(0.5, 7.4, 0.08, x, 0, zf));
    // ventanas: marco, contraventanas de madera y reja de hierro
    for (const s of [-1, 1]) {
      const cx = s * 4.6;
      G.cantera.push(box(1.6, 0.18, 0.16, cx, 3.7, zf), box(1.7, 0.12, 0.22, cx, 0.8, zf));
      G.woodDark.push(box(1.3, 2.8, 0.06, cx, 0.9, FACADE.z + 0.25));
      for (let y = 1.0; y < 3.6; y += 0.09) G.wood.push(place(new THREE.BoxGeometry(0.58, 0.06, 0.015), cx - 0.31, y, FACADE.z + 0.3, -0.5, 0, 0), place(new THREE.BoxGeometry(0.58, 0.06, 0.015), cx + 0.31, y, FACADE.z + 0.3, -0.5, 0, 0));
      for (let x = -0.55; x <= 0.56; x += 0.11) G.iron.push(box(0.018, 2.8, 0.018, cx + x, 0.9, zf + 0.12));
      for (const y of [1.2, 2.3, 3.4]) G.iron.push(box(1.3, 0.025, 0.03, cx, y, zf + 0.12));
    }
    // planta alta: ventanas con balcones de hierro sobre ménsulas de piedra
    const upperWindow = (cx, y0, w, h, balcony) => {
      const zq = zf + 0.01;
      G.cantera.push(box(w + 0.32, 0.16, 0.12, cx, y0 - 0.16, zq), box(w + 0.44, 0.18, 0.2, cx, y0 + h, zq), box(w + 0.6, 0.07, 0.26, cx, y0 + h + 0.18, zq));
      G.cantera.push(box(0.16, h, 0.12, cx - w / 2 - 0.08, y0, zq), box(0.16, h, 0.12, cx + w / 2 + 0.08, y0, zq));
      G.woodDark.push(box(w, h, 0.04, cx, y0, zq));
      for (const sx of [-1, 1]) {
        G.wood.push(box(w / 2 - 0.08, h - 0.14, 0.03, cx + sx * w / 4, y0 + 0.07, zq + 0.03));
        for (let y = y0 + h * 0.45; y < y0 + h - 0.12; y += 0.085) G.woodDark.push(place(new THREE.BoxGeometry(w / 2 - 0.2, 0.05, 0.012), cx + sx * w / 4, y, zq + 0.06, -0.5, 0, 0));
      }
      if (balcony) {
        const bw = w + 0.7, bd = 0.62;
        G.cantera.push(box(bw, 0.12, bd, cx, y0 - 0.12, zf + bd / 2));
        G.cantera.push(box(bw + 0.06, 0.04, bd + 0.04, cx, y0 - 0.16, zf + bd / 2));
        for (const sx of [-1, 1]) G.cantera.push(place(new THREE.BoxGeometry(0.14, 0.34, 0.36), cx + sx * (bw / 2 - 0.25), y0 - 0.32, zf + 0.18));
        G.iron.push(place(railingBay(bw - 0.06, 0.95, hq), cx, y0, zf + bd - 0.04));
        for (const sx of [-1, 1]) G.iron.push(place(railingBay(bd - 0.08, 0.95, hq), cx + sx * (bw / 2 - 0.03), y0, zf + bd / 2, 0, Math.PI / 2, 0));
      }
    };
    upperWindow(0, 5.55, 1.3, 2.1, true);
    upperWindow(-4.6, 5.55, 1.2, 1.9, true);
    upperWindow(4.6, 5.55, 1.2, 1.9, true);
    // imposta corrida entre plantas
    G.cantera.push(box(18, 0.14, 0.14, 0, 5.05, zf));
    // acera y calle
    G.sidewalk.push(box(22, 0.16, 2.6, 0, -0.16, zf + 1.3));
    G.cantera.push(box(22, 0.2, 0.18, 0, -0.2, zf + 2.6));
    G.street.push(place(new THREE.PlaneGeometry(40, 18), 0, -0.18, zf + 11.6, -Math.PI / 2));
    // umbral de piedra
    G.cantera.push(box(pw + 0.2, 0.05, FACADE.t + 0.1, 0, 0, FACADE.z + FACADE.t / 2));
  }
  await step(0.4);

  // ── columnas corintias (instanciadas por nivel) ──
  const colPos = [];
  for (const x of COLS) { colPos.push([x, -A], [x, A]); }
  for (const z of [-1.5, 1.5]) { colPos.push([-A, z], [A, z]); }
  const colLevels = [
    { y: 0, h: FL[1] - BEAM_H, r: 0.2, detail: hq ? 2 : 1 },
    { y: FL[1], h: FL[2] - FL[1] - BEAM_H, r: 0.175, detail: hq ? 1 : 0 },
    { y: FL[2], h: ROOF - FL[2] - BEAM_H, r: 0.165, detail: hq ? 1 : 0 },
  ];
  const columnMeshes = [];
  for (const lv of colLevels) {
    const geo = corinthianColumn(lv.h, { radius: lv.r, detail: lv.detail });
    worldUV(geo, 1.5);
    const im = new THREE.InstancedMesh(geo, mats.stone, colPos.length);
    const m = new THREE.Matrix4();
    colPos.forEach(([x, z], i) => { m.makeTranslation(x, lv.y, z); im.setMatrixAt(i, m); });
    im.castShadow = true; im.receiveShadow = true;
    scene.add(im);
    columnMeshes.push(im);
    await step(0.45);
  }

  // ── barandales de hierro forjado ──
  {
    const geo = railingBay(2.45, 1.0, hq);
    const bays = [];
    for (const level of [1, 2]) {
      for (const c of [-3, 0, 3]) {
        bays.push([c, FL[level], -A, 0], [c, FL[level], A, Math.PI], [-A, FL[level], c, Math.PI / 2], [A, FL[level], c, -Math.PI / 2]);
      }
    }
    const im = new THREE.InstancedMesh(geo, mats.iron, bays.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    bays.forEach(([x, y, z, ry], i) => { m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, ry), one); im.setMatrixAt(i, m); });
    im.castShadow = true;
    scene.add(im);
  }
  await step(0.55);

  // ── lucernario: perfiles de hierro y cristal ──
  {
    const yG = ROOF + 0.7;
    for (let k = -3; k <= 3; k++) {
      G.iron.push(box(2 * A + 0.3, 0.09, 0.05, 0, yG - 0.09, k * 1.5));
      G.iron.push(box(0.05, 0.09, 2 * A + 0.3, k * 1.5, yG - 0.09, 0));
    }
    // cerchas en diagonal muy finas
    for (let k = -3; k < 3; k++) {
      G.iron.push(place(new THREE.BoxGeometry(0.025, 0.025, 2.1), k * 1.5 + 0.75, yG - 0.12, 0, 0, Math.PI / 4, 0));
    }
    const skyTex = new THREE.CanvasTexture(skylightCanvas());
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2 * A + 0.3, 2 * A + 0.3), new THREE.MeshBasicMaterial({ map: skyTex, color: new THREE.Color(1.7, 1.72, 1.7) }));
    glass.rotation.x = Math.PI / 2;
    glass.position.y = yG + 0.02;
    scene.add(glass);
  }

  // ── faroles ──
  const lanternSpots = [];
  const lg = lanternGeometry(hq, { rod: 0.9 });
  const gallM = (W + A) / 2;
  for (const c of [-1.5, 1.5]) lanternSpots.push([c, 3.45, -gallM], [c, 3.45, gallM]);
  for (const c of [1.1, 3.3]) lanternSpots.push([-gallM, 3.45, c], [gallM, 3.45, c]);
  lanternSpots.push([0, 3.4, (ZAG.z0 + ZAG.z1) / 2]);
  {
    const im = new THREE.InstancedMesh(lg.iron, mats.iron, lanternSpots.length);
    const ig = new THREE.InstancedMesh(lg.glass, mats.lantern, lanternSpots.length);
    const m = new THREE.Matrix4();
    lanternSpots.forEach(([x, y, z], i) => { m.makeTranslation(x, y, z); im.setMatrixAt(i, m); ig.setMatrixAt(i, m); });
    scene.add(im, ig);
    // apliques de fachada (brazo de hierro con voluta)
    const sconce = lanternGeometry(hq, { rod: 0.1 });
    for (const s of [-1, 1]) {
      const lx = s * 2.05, ly = 3.5, lz = FACADE.z + FACADE.t + 0.42;
      G.iron.push(place(sconce.iron.clone(), lx, ly, lz, 0, 0, 0, 0.8, 0.8, 0.8));
      G.iron.push(box(0.035, 0.035, 0.44, lx, ly + 0.4, lz - 0.22));
      G.iron.push(place(new THREE.TorusGeometry(0.12, 0.012, 4, 16, Math.PI * 1.3), lx, ly + 0.3, lz - 0.28, 0, Math.PI / 2, Math.PI * 0.85));
      G.iron.push(box(0.12, 0.2, 0.03, lx, ly + 0.28, FACADE.z + FACADE.t + 0.015));
      const gl = new THREE.Mesh(sconce.glass.clone(), mats.lantern);
      gl.position.set(lx, ly, lz); gl.scale.setScalar(0.8);
      scene.add(gl);
      lanternSpots.push([lx, ly, lz]);
    }
  }
  const glows = makeGlows(lanternSpots.map(([x, y, z]) => ({ pos: new THREE.Vector3(x, y, z), size: 1.25, color: '#ffbf75', intensity: 0.8 })));
  scene.add(glows.mesh);
  const pools = makeLightPools([
    ...lanternSpots.slice(0, 9).map(([x, , z]) => ({ pos: new THREE.Vector3(x, 0.012, z), size: 3.2 })),
  ]);
  if (!hq) pools.mat.color.multiplyScalar(1.6);
  scene.add(pools.mesh);
  await step(0.62);

  // ── ventiladores de techo con anillos metálicos ──
  const fans = [];
  {
    const spots = [[0, -gallM], [-gallM, -0.9], [gallM, -0.9], [3, gallM]];
    for (const [x, z] of spots) {
      const y = FL[1] - SLAB - 0.17;
      const fixed = merge([
        place(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6), 0, -0.275, 0),
        place(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 14), 0, -0.6, 0),
        place(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), 0, -0.02, 0),
      ]);
      const fm = new THREE.Mesh(fixed, mats.iron);
      fm.position.set(x, y, z);
      scene.add(fm);
      const rot = new THREE.Group();
      rot.position.set(x, y - 0.68, z);
      const blades = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        blades.push(place(new THREE.BoxGeometry(0.58, 0.012, 0.13), Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38, 0, -a, 0.06));
      }
      rot.add(new THREE.Mesh(merge(blades), mats.wood));
      const rings = merge([
        place(new THREE.TorusGeometry(0.1, 0.008, 6, 24), 0, 0, 0, Math.PI / 2),
        place(new THREE.TorusGeometry(0.74, 0.006, 4, 48), 0, 0.01, 0, Math.PI / 2),
        place(new THREE.SphereGeometry(0.05, 10, 8), 0, -0.04, 0),
      ]);
      rot.add(new THREE.Mesh(rings, mats.brass));
      scene.add(rot);
      fans.push(rot);
    }
  }

  // ── enredaderas desde los balcones ──
  const strands = [];
  {
    const rnd = (a, b) => a + Math.random() * (b - a);
    for (const level of [1, 2]) {
      for (const side of ['n', 's', 'w', 'e']) {
        for (const c of [-3, 0, 3]) {
          if (Math.random() < 0.25) continue;
          const n = 2 + Math.floor(Math.random() * 4);
          for (let k = 0; k < n; k++) {
            const along = c + rnd(-1.1, 1.1);
            const off = A - 0.32;
            const len = level === 2 ? rnd(1.4, 4.6) : rnd(1.0, 3.2);
            const y = FL[level] + rnd(0.0, 0.9);
            if (side === 'n') strands.push({ x: along, y, z: -off, len, nx: 0, nz: 1 });
            if (side === 's') strands.push({ x: along, y, z: off, len, nx: 0, nz: -1 });
            if (side === 'w') strands.push({ x: -off, y, z: along, len, nx: 1, nz: 0 });
            if (side === 'e') strands.push({ x: off, y, z: along, len, nx: -1, nz: 0 });
          }
        }
      }
    }
  }
  const vines = makeVines(strands, { maxLeaves: QUALITY.leaves, hq });
  scene.add(vines.mesh);
  await step(0.7);

  // ── listones ──
  const ribbons = makeRibbons({ count: QUALITY.ribbons, top: ROOF + 0.6, radius: 2.3, bottomCenter: 2.55, bottomEdge: 4.6, segs: hq ? 28 : 18 });
  scene.add(ribbons.mesh);
  // anillo de hierro del que cuelgan
  G.iron.push(place(new THREE.TorusGeometry(2.35, 0.03, 6, 64), 0, ROOF + 0.58, 0, Math.PI / 2));
  G.iron.push(place(new THREE.TorusGeometry(1.2, 0.025, 6, 48), 0, ROOF + 0.58, 0, Math.PI / 2));
  for (let i = 0; i < 4; i++) G.iron.push(place(new THREE.BoxGeometry(4.7, 0.03, 0.03), 0, ROOF + 0.6, 0, 0, (i / 4) * Math.PI, 0));

  // ── luz del lucernario y polvo ──
  const shaftStarts = [];
  for (const [x, z] of [[-2.6, 2.4], [-0.6, 0.4], [1.2, 2.8], [-2.9, -1.1], [0.9, -1.6], [2.6, 0.8]]) {
    shaftStarts.push(new THREE.Vector3(x, ROOF + 0.6, z));
  }
  const shafts = makeShafts(shaftStarts, sunDir, 15.5, 2.1);
  scene.add(shafts.mesh);
  const dust = makeDust(Math.round(900 * QUALITY.particles), sunDir, { half: A, top: ROOF + 0.6 });
  scene.add(dust.mesh);
  await step(0.76);

  // ── puertas del patio ──
  const doors = {};
  const plaqueOpts = { w: 1024, h: 256 };
  for (const id of DOOR_IDS) {
    const d = DOOR_DEFS[id];
    const side = SIDES[d.side];
    const label = t(`door.${id}`).toUpperCase();
    const pc = plaqueCanvas(label, plaqueOpts);
    const gc = plaqueGlowCanvas(label, plaqueOpts);
    const map = toTexture(pc, { wrap: false, aniso });
    const emap = toTexture(gc, { wrap: false, aniso });
    const plaqueMat = new THREE.MeshStandardMaterial({ map, emissiveMap: emap, emissive: new THREE.Color('#ffd590'), emissiveIntensity: 0.12, metalness: 0.65, roughness: 0.32 });
    const door = makeLibertyDoor(mats, plaqueMat, { hq, wallThick: WT });
    door.group.position.set(d.pos[0], 0, d.pos[1]);
    door.group.rotation.y = side.rotY;
    scene.add(door.group);
    door.group.updateMatrixWorld(true);
    const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), side.rotY);
    const center = new THREE.Vector3(d.pos[0], 0, d.pos[1]);
    const plaqueWorld = door.plaque.getWorldPosition(new THREE.Vector3());
    // caja invisible para detectar el puntero
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.3, 4.7, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, 2.35, 0.3);
    hit.userData.door = id;
    door.group.add(hit);
    doors[id] = { ...door, id, map, emap, plaqueMat, normal, center, plaqueWorld, hit, hover: 0, hoverT: 0, open: 0, openT: 0, label };
  }
  const hitList = DOOR_IDS.map((id) => doors[id].hit);
  // halos sobre las placas (se encienden al pasar el puntero)
  const plaqueGlows = makeGlows(DOOR_IDS.map((id) => ({ pos: doors[id].plaqueWorld.clone().add(doors[id].normal.clone().multiplyScalar(0.1)), size: 2.2, color: '#ffc574', intensity: 0 })));
  scene.add(plaqueGlows.mesh);
  await step(0.84);

  // ── portón de entrada ──
  const portal = makePortal(mats, { hq });
  portal.group.position.set(0, 0, FACADE.z + 0.36);
  scene.add(portal.group);
  // placa del hotel junto al portón
  {
    const pc = plaqueCanvas('PIEDRA DE AGUA', { w: 1024, h: 300, size: 0.34, spacing: 0.24 });
    const mat = new THREE.MeshStandardMaterial({ map: toTexture(pc, { wrap: false, aniso }), metalness: 0.7, roughness: 0.3, emissive: '#3a2a10', emissiveIntensity: 0.3 });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.28), mat);
    pl.position.set(2.0, 2.05, FACADE.z + FACADE.t + 0.09);
    scene.add(pl);
    const nc = plaqueCanvas('498', { w: 512, h: 256, size: 0.55, spacing: 0.1 });
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshStandardMaterial({ map: toTexture(nc, { wrap: false }), metalness: 0.7, roughness: 0.3 }));
    nm.position.set(0, 3.3 + 1.25 + 0.06, FACADE.z + FACADE.t + 0.25);
    scene.add(nm);
  }

  // ── cielo ──
  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), skyMaterial(new THREE.Vector3(-0.5, 0.35, 0.8)));
  scene.add(sky);

  // ── geometría estática fusionada ──
  const uvScale = { plaster: 1 / 2.2, ceiling: 1 / 2.2, paint: 1 / 2.2, facade: 1 / 2.4, stone: 1 / 1.6, cantera: 1 / 1.4, tileA: 1 / 0.8, tileB: 1 / 0.6, wood: 1 / 1.1, woodDark: 1 / 1.1, viga: 1 / 1.6, sidewalk: 1 / 1.2 };
  for (const [k, list] of Object.entries(G)) {
    if (!list.length) continue;
    const geo = merge(list);
    if (uvScale[k]) worldUV(geo, uvScale[k]);
    const mesh = new THREE.Mesh(geo, mats[k]);
    mesh.receiveShadow = !['iron', 'street'].includes(k);
    mesh.castShadow = !['tileA', 'tileB', 'street', 'sidewalk', 'paint'].includes(k);
    scene.add(mesh);
  }
  await step(0.9);

  // ── luces ──
  const hemi = new THREE.HemisphereLight('#dfecee', '#b98f68', 0.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffeed2', 5.2);
  sun.position.copy(sunDir).multiplyScalar(40);
  sun.target.position.set(0, 4, 0);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(QUALITY.shadowMap, QUALITY.shadowMap);
  const sc = sun.shadow.camera;
  sc.left = -11; sc.right = 11; sc.top = 13; sc.bottom = -12; sc.near = 10; sc.far = 75;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = hq ? 3 : 2;
  // luz de tarde sobre la fachada (se apaga al entrar)
  const facadeLight = new THREE.SpotLight('#ffcf9a', 260, 16, 0.75, 0.7, 1.2);
  facadeLight.position.set(-5.5, 6.5, 22);
  facadeLight.target.position.set(0.5, 2.6, FACADE.z + FACADE.t);
  scene.add(facadeLight, facadeLight.target);
  // calidez de los faroles en las galerías
  const warm = [];
  // en móvil, menos luces dinámicas: los faroles brillan con halos y charcos de luz
  for (const p of hq ? [[-3, 3.0, -gallM], [3, 3.0, -gallM], [0, 3.0, gallM - 0.5]] : []) {
    const L = new THREE.PointLight('#ffb866', hq ? 7 : 5, 7, 1.6);
    L.position.set(...p);
    scene.add(L);
    warm.push(L);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.3;
  pmrem.dispose();

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  await step(0.95);

  // ───────────────────────── cámara e interacción ─────────────────────────
  const rig = {
    mode: 'idle',
    pos: new THREE.Vector3(0, 1.7, 19.5), look: new THREE.Vector3(0, 2.4, FACADE.z),
    yaw: 0, pitch: HUB_PITCH, dragYaw: 0, dragPitch: 0, vYaw: 0, vPitch: 0,
    px: 0, py: 0, // ratón normalizado
    parYaw: 0, parPitch: 0, parX: 0,
  };
  const dirFrom = (yaw, pitch) => new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  const hubLook = () => HUB.clone().add(dirFrom(0, HUB_PITCH).multiplyScalar(10));
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;
  let listeners = { hover: null, labels: null, enter: null };
  const canvas = engine.canvas;
  let down = null;

  function setHover(id) {
    if (hovered === id) return;
    hovered = id;
    canvas.style.cursor = id ? 'pointer' : '';
    listeners.hover?.(id);
  }

  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(hitList, false);
    return hits.length ? hits[0].object.userData.door : null;
  }

  function onMove(e) {
    if (rig.mode !== 'hub') return;
    const r = canvas.getBoundingClientRect();
    rig.px = ((e.clientX - r.left) / r.width) * 2 - 1;
    rig.py = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) down.moved = true;
      const k = e.pointerType === 'mouse' ? 0.0032 : 0.0055;
      rig.vYaw = (e.clientX - down.lx) * k;
      rig.vPitch = (e.clientY - down.ly) * k * 0.8;
      rig.dragYaw = clamp(rig.dragYaw + rig.vYaw, -0.85, 0.85);
      rig.dragPitch = clamp(rig.dragPitch + rig.vPitch, -0.22, 0.8);
      down.lx = e.clientX; down.ly = e.clientY;
    }
    if (e.pointerType === 'mouse' && !down?.moved) setHover(pick(e.clientX, e.clientY));
  }
  function onDown(e) {
    if (rig.mode !== 'hub') return;
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, type: e.pointerType };
    canvas.setPointerCapture?.(e.pointerId);
  }
  function onUp(e) {
    if (!down) return;
    const wasTap = !down.moved;
    down = null;
    if (rig.mode !== 'hub' || !wasTap) return;
    const id = pick(e.clientX, e.clientY);
    if (!id) { if (e.pointerType !== 'mouse') setHover(null); return; }
    if (e.pointerType === 'mouse') listeners.enter?.(id);
    else {
      // en pantalla táctil: la placa se ilumina, la puerta se entreabre y luego entramos
      setHover(id);
      setTimeout(() => { if (rig.mode === 'hub') listeners.enter?.(id); }, motion.reduced ? 80 : 420);
    }
  }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => { down = null; });
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { rig.px = 0; rig.py = 0; setHover(null); } });

  // vuelo de cámara entre (pos, look) con curva suave
  function flyTo(pos, look, duration, easing = ease.inOutCubic, via = null) {
    const p0 = rig.pos.clone(), l0 = rig.look.clone();
    const mid = via || p0.clone().lerp(pos, 0.5);
    return tween({
      duration, easing,
      onUpdate: (v) => {
        // bezier cuadrática para la posición
        const a = p0.clone().multiplyScalar((1 - v) * (1 - v));
        const b = mid.clone().multiplyScalar(2 * (1 - v) * v);
        const c = pos.clone().multiplyScalar(v * v);
        rig.pos.copy(a.add(b).add(c));
        rig.look.copy(l0).lerp(look, ease.inOutSine(v));
      },
    });
  }

  function animateDoor(d, target, duration, easing = ease.inOutCubic) {
    const from = d.open;
    return tween({ duration, easing, onUpdate: (v) => { d.open = from + (target - from) * v; } });
  }

  const portalState = { open: 0 };
  let introTween = null;

  async function playIntro({ onExposure } = {}) {
    rig.mode = 'intro';
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.7, 19.5), new THREE.Vector3(0, 1.68, 14.2), new THREE.Vector3(0, 1.66, FACADE.z + 0.2),
      new THREE.Vector3(0, 1.64, 8.1), HUB.clone(),
    ], false, 'centripetal');
    const lookPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 2.45, FACADE.z), new THREE.Vector3(0, 2.5, 4), new THREE.Vector3(0, 4.6, -1),
      new THREE.Vector3(0, 5.6, -3), hubLook(),
    ], false, 'centripetal');
    rig.pos.copy(path.getPoint(0)); rig.look.copy(lookPath.getPoint(0));
    portalState.open = 0;
    facadeLight.intensity = 260;
    const k = motion.k;
    // apertura del portón
    setTimeout(() => playLatch(), 900 * k);
    const doorOpen = tween({
      duration: 2.6, delay: 1.0, easing: ease.inOutCubic,
      onUpdate: (v) => { portalState.open = v; renderer.shadowMap.needsUpdate = true; },
    });
    // la cámara avanza y entra
    setTimeout(() => playWhoosh(2.4), 2100 * k);
    introTween = tween({
      duration: 6.4, delay: 1.7, easing: ease.inOutQuad,
      onUpdate: (v) => {
        rig.pos.copy(path.getPointAt(v));
        const lv = ease.inOutSine(v);
        rig.look.copy(lookPath.getPoint(lv));
        facadeLight.intensity = 260 * (1 - clamp((v - 0.35) / 0.3, 0, 1));
        if (rig.mode === 'intro') listeners.progress?.(v);
      },
    });
    await Promise.all([doorOpen, introTween]);
    finishIntro();
  }

  function finishIntro() {
    if (rig.mode !== 'intro') return;
    introTween?.cancel?.();
    portalState.open = 1;
    facadeLight.intensity = 0;
    rig.pos.copy(HUB);
    rig.look.copy(hubLook());
    rig.dragYaw = 0; rig.dragPitch = 0; rig.vYaw = 0; rig.vPitch = 0;
    rig.yaw = 0; rig.pitch = HUB_PITCH;
    renderer.shadowMap.needsUpdate = true;
    rig.mode = 'hub';
    listeners.hubReady?.();
  }

  async function enterDoor(id) {
    if (rig.mode !== 'hub') return false;
    const d = doors[id];
    rig.mode = 'fly';
    setHover(id);
    const n = d.normal;
    const front = d.center.clone().add(n.clone().multiplyScalar(2.9)); front.y = 1.66;
    const target = d.center.clone(); target.y = 2.0;
    // curva que pasa por el patio sin rozar las columnas
    const via = rig.pos.clone().lerp(front, 0.55); via.y = 1.75;
    await flyTo(front, target, 1.7, ease.inOutCubic, via);
    playWhoosh(1.4);
    const opening = animateDoor(d, 1, 1.1, ease.inOutCubic);
    await new Promise((r) => setTimeout(r, 550 * motion.k));
    const inside = d.center.clone().add(n.clone().multiplyScalar(-1.1)); inside.y = 1.7;
    const lookIn = d.center.clone().add(n.clone().multiplyScalar(-4)); lookIn.y = 1.75;
    listeners.veil?.(true, motion.reduced ? 0.2 : 0.75);
    await Promise.all([opening, flyTo(inside, lookIn, 1.15, ease.inCubic)]);
    rig.mode = 'section';
    setHover(null);
    return true;
  }

  async function returnFrom(id) {
    const d = doors[id];
    rig.mode = 'fly';
    d.open = 1;
    const n = d.normal;
    rig.pos.copy(d.center).add(n.clone().multiplyScalar(-1.0)); rig.pos.y = 1.7;
    rig.look.copy(d.center).add(n.clone().multiplyScalar(-4)); rig.look.y = 1.75;
    const front = d.center.clone().add(n.clone().multiplyScalar(2.9)); front.y = 1.66;
    const target = d.center.clone(); target.y = 2.0;
    // retroceder mirando la puerta: el look gira hacia el marco
    await flyTo(front, target, 1.25, ease.outCubic);
    playWhoosh(1.0);
    animateDoor(d, 0, 1.2, ease.inOutCubic);
    const back = HUB.clone();
    const via = front.clone().lerp(back, 0.45); via.y = 1.75;
    rig.dragYaw = 0; rig.dragPitch = 0;
    await flyTo(back, hubLook(), 1.6, ease.inOutCubic, via);
    rig.mode = 'hub';
    return true;
  }

  // reposicionamiento instantáneo (enlaces profundos / sin animaciones)
  function jumpToHub() {
    rig.mode = 'hub';
    portalState.open = 1;
    facadeLight.intensity = 0;
    rig.pos.copy(HUB); rig.look.copy(hubLook());
    renderer.shadowMap.needsUpdate = true;
  }

  // ───────────────────────── actualización ─────────────────────────
  const tmpV = new THREE.Vector3();
  const labelOut = DOOR_IDS.map((id) => ({ id, x: 0, y: 0, visible: false, off: 0 }));

  const view = {
    scene, camera, doors, rig,
    on(name, fn) { listeners[name] = fn; },
    playIntro, finishIntro, enterDoor, returnFrom, jumpToHub,
    setHover(id) { if (rig.mode === 'hub' || id === null) setHover(id); },
    resize(w, h) {
      camera.aspect = w / h;
      // vertical más abierto en retrato para no perder el patio
      camera.fov = w / h < 0.8 ? 72 : w / h < 1.2 ? 64 : 56;
      camera.updateProjectionMatrix();
      dust.uniforms.uPixel.value = h * renderer.getPixelRatio() * 0.9 / Math.tan((camera.fov * Math.PI) / 360) * 0.02;
    },
    setLang() {
      for (const id of DOOR_IDS) {
        const d = doors[id];
        const label = t(`door.${id}`).toUpperCase();
        if (label === d.label) continue;
        d.label = label;
        d.map.image = plaqueCanvas(label, plaqueOpts); d.map.needsUpdate = true;
        d.emap.image = plaqueGlowCanvas(label, plaqueOpts); d.emap.needsUpdate = true;
      }
    },
    update(dt, time) {
      // mirada en el hub: paralaje del ratón + arrastre con inercia
      if (rig.mode === 'hub') {
        if (!down) {
          rig.vYaw *= Math.exp(-5 * dt); rig.vPitch *= Math.exp(-5 * dt);
          rig.dragYaw = clamp(rig.dragYaw + rig.vYaw * 0.5, -0.85, 0.85);
          rig.dragPitch = clamp(rig.dragPitch + rig.vPitch * 0.5, -0.22, 0.8);
        }
        const isTouch = IS_MOBILE;
        const tYaw = rig.dragYaw + (isTouch ? 0 : -rig.px * 0.32);
        // en retrato se mira un poco más arriba: balcones y listones
        const portrait = engine.size.w / engine.size.h < 0.8 ? 0.1 : 0;
        const tPitch = HUB_PITCH + portrait + rig.dragPitch + (isTouch ? 0 : -rig.py * 0.07);
        const breathe = motion.reduced ? 0 : Math.sin(time * 0.35) * 0.012;
        rig.yaw = damp(rig.yaw, tYaw, 4, dt);
        rig.pitch = damp(rig.pitch, tPitch + breathe, 4, dt);
        rig.parX = damp(rig.parX, isTouch ? 0 : rig.px * 0.22, 3, dt);
        const pos = HUB.clone();
        pos.x += rig.parX;
        pos.y += motion.reduced ? 0 : Math.sin(time * 0.5) * 0.01;
        rig.pos.lerp(pos, 1 - Math.exp(-6 * dt));
        rig.look.lerp(pos.clone().add(dirFrom(rig.yaw, rig.pitch).multiplyScalar(10)), 1 - Math.exp(-8 * dt));
      }
      camera.position.copy(rig.pos);
      camera.lookAt(rig.look);

      // puertas: hover suave, entreabrir, abrir
      DOOR_IDS.forEach((id, i) => {
        const d = doors[id];
        d.hoverT = hovered === id ? 1 : 0;
        d.hover = damp(d.hover, d.hoverT, 7, dt);
        const ang = Math.max(d.hover * 0.46, d.open * 1.62);
        d.leftPivot.rotation.y = ang;
        d.rightPivot.rotation.y = -ang;
        d.plaqueMat.emissiveIntensity = 0.12 + d.hover * 1.6 + d.open * 0.6;
        // vidrios ámbar apagados que se encienden: hay luz detrás de la puerta
        const lit = Math.max(d.hover, d.open);
        d.glassMat.color.setRGB(1, 0.78, 0.5).multiplyScalar(0.32 + lit * 1.5);
        d.roomMat.color.setRGB(1, 0.84, 0.62).multiplyScalar(0.7 + lit * 1.9);
        plaqueGlows.setIntensity(i, d.hover * 0.85 + d.open * 0.3);
      });
      // portón
      const pa = ease.inOutSine(portalState.open) * 1.68;
      portal.leftPivot.rotation.y = pa;
      portal.rightPivot.rotation.y = -pa;

      // vida del patio
      ribbons.uniforms.uTime.value = time;
      ribbons.uniforms.uWind.value = motion.reduced ? 0.35 : 1;
      vines.uTime.value = motion.reduced ? 0 : time;
      shafts.uniforms.uTime.value = time;
      dust.uniforms.uTime.value = motion.reduced ? time * 0.3 : time;
      glows.uniforms.uIntensity.value = 0.9 + Math.sin(time * 7.3) * 0.02 + Math.sin(time * 3.1) * 0.03;
      const fanSpeed = motion.reduced ? 0.3 : 1.6;
      fans.forEach((f, i) => { f.rotation.y += dt * fanSpeed * (1 + i * 0.07); });

      // etiquetas HTML ancladas a las placas
      if (listeners.labels && (rig.mode === 'hub' || rig.mode === 'fly')) {
        const w = engine.size.w, h = engine.size.h;
        camera.updateMatrixWorld();
        DOOR_IDS.forEach((id, i) => {
          const d = doors[id];
          tmpV.copy(d.plaqueWorld).project(camera);
          const o = labelOut[i];
          const behind = tmpV.z > 1;
          o.x = (tmpV.x * 0.5 + 0.5) * w;
          o.y = (-tmpV.y * 0.5 + 0.5) * h;
          if (behind) { o.x = w - o.x; o.y = h; }
          o.off = behind ? (o.x < w / 2 ? -1 : 1) : o.x < 0 ? -1 : o.x > w ? 1 : 0;
          o.visible = !behind && o.x > 0 && o.x < w && o.y > 0 && o.y < h;
        });
        listeners.labels(labelOut);
      }
    },
    // girar la mirada hacia una puerta (para etiquetas fuera de pantalla en móvil)
    lookToward(id) {
      const d = doors[id];
      const v = d.plaqueWorld.clone().sub(HUB);
      const yaw = Math.atan2(-v.x, -v.z);
      rig.dragYaw = clamp(yaw, -0.85, 0.85);
      rig.dragPitch = 0;
    },
    dispose() {},
  };

  // precompilar shaders para evitar tirones al entrar
  camera.position.copy(rig.pos); camera.lookAt(rig.look);
  view.resize(engine.size.w, engine.size.h);
  try { await renderer.compileAsync(scene, camera); } catch (e) { renderer.compile(scene, camera); }
  onProgress?.(1);
  return view;
}
