// La casa: Paseo de Montejo, reja, jardín, pórtico jónico, zaguán, portales y patio.
import * as THREE from 'three';
import { FL, GR, L } from './layout.js';
import {
  Batch, boxFromTo, floor, slab, place, archPanel, halfDisc, ionicColumn, baluster,
  instanced, mat4, mergeGeometries, clean,
} from './kit.js';

const PI = Math.PI;

const SHADOW = {
  asfalto: { cast: false, receive: true }, adoquin: { cast: false, receive: true },
  banqueta: { cast: false, receive: true }, pasto: { cast: false, receive: true },
  tierra: { cast: false, receive: true }, grava: { cast: false, receive: true },
  marmol: { cast: false, receive: true }, marmolSombra: { cast: false, receive: true },
  vidrio: { cast: false, receive: true }, interior: { cast: false, receive: false },
  letrero: { cast: false, receive: false }, cuadro1: { cast: false, receive: true },
  cuadro2: { cast: false, receive: true }, lino: { cast: false, receive: false },
  fleco: { cast: false, receive: false }, techo: { cast: false, receive: true },
  zaguan: { cast: false, receive: true },
};

// Puerta vidriada de boutique (marco blanco, vidrio oscuro, medio punto con celosía opcional).
// Se arma mirando a +z con la base en y=0 y luego se gira/traslada.
function glassDoor(b, { x, y = FL, z, rotY = 0, w = 1.7, h = 3.0, lattice = true }) {
  const parts = { puertaBlanca: [], vidrio: [], celosia: [], moldura: [] };
  const P = (key, g) => parts[key].push(g);
  const t = 0.05;
  // jambas y cabezal (moldura)
  P('moldura', boxFromTo(-w / 2 - 0.16, 0, -0.02, -w / 2, h + (lattice ? w / 2 : 0.12), 0.07));
  P('moldura', boxFromTo(w / 2, 0, -0.02, w / 2 + 0.16, h + (lattice ? w / 2 : 0.12), 0.07));
  if (lattice) {
    P('moldura', place(new THREE.TorusGeometry(w / 2 + 0.08, 0.075, 6, 24, PI), 0, h, 0.04));
    P('vidrio', place(halfDisc(w / 2, 22), 0, h, 0.015));
    const lg = new THREE.PlaneGeometry(w, w / 2 * 1.063);
    lg.translate(0, h + (w / 2 * 1.063) / 2, 0.03);
    P('celosia', lg);
    P('moldura', boxFromTo(-w / 2 - 0.02, h - 0.06, -0.02, w / 2 + 0.02, h + 0.04, 0.08));
  } else {
    P('moldura', boxFromTo(-w / 2 - 0.24, h + 0.1, -0.02, w / 2 + 0.24, h + 0.3, 0.1));
  }
  // dos hojas: tablero inferior + vidrio arriba
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -w / 2 : 0, x1 = s < 0 ? 0 : w / 2;
    P('puertaBlanca', boxFromTo(x0, 0, -0.02, x1, h, t));
    P('vidrio', boxFromTo(x0 + 0.1, 1.0, t, x1 - 0.1, h - 0.12, t + 0.012));
    P('puertaBlanca', boxFromTo(x0 + 0.12, 0.14, t, x1 - 0.12, 0.86, t + 0.03));
  }
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1));
  for (const [k, list] of Object.entries(parts)) for (const g of list) b.add(k, g.applyMatrix4(m));
}

function awning(b, { x, z, rotY = 0, w = 2.4, yTop = FL + 3.55 }) {
  const parts = [];
  const g = new THREE.PlaneGeometry(w, 1.05);
  const phi = -1.07;
  g.rotateX(phi);
  g.translate(0, yTop - 0.525 * Math.cos(phi), -0.525 * Math.sin(phi));
  parts.push(g);
  const v = new THREE.PlaneGeometry(w, 0.26);
  v.translate(0, yTop - 0.504 - 0.13, 0.924);
  parts.push(v);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1));
  for (const p of parts) {
    const uv = p.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (w / 1.1));
    b.add('toldo', p.applyMatrix4(m));
  }
}

function leafGeometry(w, h, t = 0.09) {
  const frame = [place(new THREE.BoxGeometry(w, h, t), w / 2, h / 2, 0)];
  const panel = [];
  const panels = [[0.16, 1.0], [1.2, 2.72], [2.92, h - 0.16]];
  for (const [y0, y1] of panels) {
    for (const s of [-1, 1]) {
      frame.push(place(new THREE.BoxGeometry(w - 0.24, y1 - y0, 0.025), w / 2, (y0 + y1) / 2, s * (t / 2 + 0.01)));
      panel.push(place(new THREE.BoxGeometry(w - 0.46, (y1 - y0) - 0.22, 0.03), w / 2, (y0 + y1) / 2, s * (t / 2 + 0.033)));
    }
  }
  return { frame: mergeGeometries(frame.map(clean)), panel: mergeGeometries(panel.map(clean)) };
}

export function buildHouse(root, M) {
  const b = new Batch();
  const anim = {};
  const add = (k, g) => b.add(k, g);

  // materiales extra de las casas de enfrente
  M.enfrente1 = new THREE.MeshLambertMaterial({ color: '#efe4d2' });
  M.enfrente2 = new THREE.MeshLambertMaterial({ color: '#e9ddd0' });
  M.enfrente3 = new THREE.MeshLambertMaterial({ color: '#f1ece2' });
  M.guarnicion = new THREE.MeshLambertMaterial({ color: '#a89c8d' });
  M.bronce = new THREE.MeshLambertMaterial({ color: '#5b544b' });

  /* ---------------- Paseo de Montejo ---------------- */
  const [s0, s1] = L.sidewalk;
  add('adoquin', slab(-80, 0, s0, 80, 0.15, s1, 2));
  add('guarnicion', boxFromTo(-80, 0, s1, 80, 0.16, s1 + 0.18));
  add('asfalto', floor(-80, L.road[0], 80, L.road[1], 0.0, 4));
  const A = L.across;
  add('guarnicion', boxFromTo(-80, 0, A - 0.15, 80, 0.16, A + 0.05));
  add('adoquin', slab(-80, 0, A + 0.05, 80, 0.15, A + 5.5, 2));
  // casas de enfrente: volúmenes suaves con cornisa
  const across = [[-46, -33, 7.2, 1], [-31, -19, 6.4, 2], [-17, -6, 7.6, 3], [-4, 8, 6.8, 1], [10, 22, 7.4, 2], [24, 37, 6.6, 3], [39, 52, 7.0, 1]];
  for (const [x0, x1, h, c] of across) {
    add('enfrente' + c, boxFromTo(x0, 0, A + 7, x1, h, A + 16));
    add('moldura', boxFromTo(x0 - 0.15, h - 0.4, A + 6.8, x1 + 0.15, h - 0.1, A + 7.2));
    for (let x = x0 + 1.6; x < x1 - 1; x += 3.2) add('interior', place(new THREE.PlaneGeometry(1.1, 2.6), x, 2.3, A + 6.98, PI));
  }
  // alcorques de los almendros de la banqueta
  for (const x of [-6.0, 6.4, -18.0, 18.6, -30, 31]) {
    const tz = L.streetTrees;
    add('grava', floor(x - 0.7, tz - 0.7, x + 0.7, tz + 0.7, 0.152, 1.4));
    for (const [a, c, d, e] of [[-0.7, -0.72, 0.7, -0.68], [-0.7, 0.68, 0.7, 0.72], [-0.72, -0.72, -0.68, 0.72], [0.68, -0.72, 0.72, 0.72]]) {
      add('bronce', boxFromTo(x + a, 0.15, tz + c, x + d, 0.22, tz + e));
    }
  }

  /* ---------------- Jardín y reja ---------------- */
  const F = L.fence;
  add('pasto', slab(-18, 0, L.porchFront, -1.3, 0.25, F - 0.16, 3));
  add('tierra', slab(1.3, 0, F - 2.4, 18, 0.25, F - 0.16, 2));
  add('pasto', slab(1.3, 0, L.porchFront, 18, 0.24, F - 2.4, 3));
  add('piedra', slab(-1.3, 0, 2.9, 1.3, 0.2, F + 0.2, 2.4));
  // patios laterales
  add('pasto', slab(-24, 0, -32, -13.2, 0.24, L.porchFront, 3));
  add('pasto', slab(13.2, 0, -32, 24, 0.24, L.porchFront, 3));
  for (const s of [-1, 1]) {
    add('calce', boxFromTo(s * 18, 0, -32, s * 18.3, 2.6, F - 0.16));
    add('moldura', boxFromTo(s * 17.95, 2.6, -32, s * 18.35, 2.7, F - 0.16));
  }
  for (const [x0, x1] of [[-18, -2.0], [2.0, 18]]) {
    add('calce', boxFromTo(x0, 0, F - 0.16, x1, 0.5, F + 0.16));
    add('moldura', boxFromTo(x0, 0.5, F - 0.2, x1, 0.57, F + 0.2));
    const len = x1 - x0;
    const g = new THREE.PlaneGeometry(len, 1.42);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (len / 1.2));
    add('reja', place(g, (x0 + x1) / 2, 0.57 + 0.71, F));
    const n = Math.round(len / 4);
    for (let i = 0; i <= n; i++) {
      const x = x0 + (i * len) / n;
      if (Math.abs(x) < 2.2) continue;
      add('calce', boxFromTo(x - 0.17, 0, F - 0.17, x + 0.17, 1.9, F + 0.17));
      add('moldura', boxFromTo(x - 0.22, 1.9, F - 0.22, x + 0.22, 1.98, F + 0.22));
    }
  }
  // pilares del portón
  for (const s of [-1, 1]) {
    add('calce', boxFromTo(s * 1.5, 0, F - 0.26, s * 2.02, 2.05, F + 0.26));
    add('moldura', boxFromTo(s * 1.42, 2.05, F - 0.33, s * 2.1, 2.16, F + 0.33));
    add('moldura', place(new THREE.ConeGeometry(0.24, 0.22, 4), s * 1.76, 2.27, F, PI / 4));
  }
  // hojas del portón (giran sobre su bisagra)
  const gw = 1.48, gh = 2.2;
  const gGeo = new THREE.PlaneGeometry(gw, gh); gGeo.translate(gw / 2, 0.2 + gh / 2, 0);
  const gGeoR = new THREE.PlaneGeometry(gw, gh); gGeoR.translate(-gw / 2, 0.2 + gh / 2, 0);
  const uvR = gGeoR.attributes.uv; for (let i = 0; i < uvR.count; i++) uvR.setX(i, 1 - uvR.getX(i));
  const gateL = new THREE.Group(); gateL.position.set(-1.5, 0, F);
  const gateR = new THREE.Group(); gateR.position.set(1.5, 0, F);
  for (const [grp, geo] of [[gateL, gGeo], [gateR, gGeoR]]) {
    const mesh = new THREE.Mesh(geo, M.porton); mesh.castShadow = true; mesh.receiveShadow = true;
    grp.add(mesh); root.add(grp);
  }
  anim.gateL = gateL; anim.gateR = gateR;

  /* ---------------- Basamento, escalinata y pórtico ---------------- */
  const P = L.porchFront, C = L.colLine, W = L.facade, H = L.houseHalf;
  add('calce', boxFromTo(-H, 0, W, H, FL, P));
  add('moldura', boxFromTo(-H - 0.08, 0, P - 0.02, H + 0.08, 0.24, P + 0.08));
  add('moldura', boxFromTo(-H - 0.08, FL - 0.1, P - 0.02, H + 0.08, FL, P + 0.08));
  add('marmol', floor(-H, W, H, P, FL + 0.003, 1.6));
  for (let k = 1; k <= 5; k++) add('piedra', slab(-1.7, 0, P, 1.7, 0.2 + 0.2 * k, 2.9 - 0.3 * (k - 1), 1.2));
  for (const s of [-1, 1]) {
    add('calce', boxFromTo(s * 1.7, 0, P, s * 2.15, 1.42, 3.0));
    add('moldura', boxFromTo(s * 1.64, 1.42, P - 0.02, s * 2.21, 1.5, 3.06));
  }
  // columnas jónicas del pórtico
  const colGeo = ionicColumn(4.5, 0.24);
  root.add(instanced(colGeo, M.moldura, L.porchCols.map((x) => mat4(x, FL, C))));
  // balaustrada
  const balGeo = baluster(0.62);
  const balM = [];
  const bays = [[-12.4, -7.0], [-7.0, -1.85], [1.85, 7.0], [7.0, 12.4]];
  for (const [x0, x1] of bays) {
    add('moldura', boxFromTo(x0 + 0.3, FL, C - 0.15, x1 - 0.3, FL + 0.1, C + 0.15));
    add('moldura', boxFromTo(x0 + 0.25, FL + 0.72, C - 0.17, x1 - 0.25, FL + 0.83, C + 0.17));
    for (let x = x0 + 0.48; x < x1 - 0.4; x += 0.27) balM.push(mat4(x, FL + 0.1, C));
  }
  for (const s of [-1, 1]) {
    add('moldura', boxFromTo(s * 12.25, FL, W + 0.2, s * 12.55, FL + 0.1, C - 0.3));
    add('moldura', boxFromTo(s * 12.23, FL + 0.72, W + 0.2, s * 12.57, FL + 0.83, C - 0.3));
    for (let z = C - 0.48; z > W + 0.3; z -= 0.27) balM.push(mat4(s * 12.4, FL + 0.1, z));
  }
  root.add(instanced(balGeo, M.moldura, balM));

  // entablamento, letrero, cornisa y pretil
  add('calce', boxFromTo(-H, 5.7, -9.6, H, 7.7, 1.3));
  add('moldura', boxFromTo(-H - 0.05, 5.7, 1.3, H + 0.05, 5.96, 1.37));
  add('moldura', boxFromTo(-H - 0.05, 5.92, 1.37, H + 0.05, 5.97, 1.4));
  add('moldura', boxFromTo(-H - 0.05, 6.42, 1.3, H + 0.05, 6.48, 1.38));
  add('moldura', boxFromTo(-H - 0.05, 7.0, 1.3, H + 0.05, 7.06, 1.38));
  add('moldura', boxFromTo(-H - 0.2, 7.42, 1.2, H + 0.2, 7.55, 1.5));
  add('moldura', boxFromTo(-H - 0.3, 7.55, 1.2, H + 0.3, 7.7, 1.62));
  add('calce', boxFromTo(-H, 7.7, -9.6, H, 8.32, 1.42));
  add('moldura', boxFromTo(-H - 0.1, 8.32, 1.1, H + 0.1, 8.44, 1.5));
  // retornos laterales del entablamento
  for (const s of [-1, 1]) {
    add('moldura', boxFromTo(s * H, 7.42, -9.6, s * (H + 0.3), 7.7, 1.62));
    add('moldura', boxFromTo(s * H, 5.7, -9.6, s * (H + 0.06), 5.97, 1.4));
  }
  // medallones ovalados y tableros del friso
  const medGeo = place(new THREE.SphereGeometry(0.5, 14, 8), 0, 0, 0, 0, 0, 0, 0.36, 0.17, 0.05);
  const medM = [], panM = [];
  for (const y of [6.2, 7.24]) {
    for (let x = -12.5, i = 0; x <= 12.51; x += 0.78, i++) {
      if (i % 2 === 0) medM.push(mat4(x, y, 1.32));
      else panM.push(mat4(x, y, 1.315));
    }
  }
  root.add(instanced(medGeo, M.moldura, medM));
  root.add(instanced(place(new THREE.BoxGeometry(0.42, 0.2, 0.04), 0, 0, 0), M.moldura, panM));
  // dentículos
  const denM = [];
  for (let x = -H; x <= H; x += 0.2) denM.push(mat4(x, 7.37, 1.33));
  root.add(instanced(new THREE.BoxGeometry(0.09, 0.1, 0.1), M.moldura, denM, { cast: false }));
  // letrero CASA T'HŌ
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 0.734), M.letrero);
  sign.position.set(0, 6.74, 1.315);
  sign.renderOrder = 2;
  root.add(sign);
  anim.sign = sign;

  // muro de fachada con puerta y ventanas
  const zf0 = W - L.facadeT, zf1 = W;
  const xs = [-H, -10.35, -8.85, -5.35, -3.85, -1.3, 1.3, 3.85, 5.35, 8.85, 10.35, H];
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i], x1 = xs[i + 1], cx = (x0 + x1) / 2;
    if (i === 5) {
      add('calce', boxFromTo(x0, 5.05, zf0, x1, 5.7, zf1));
    } else if ([1, 3, 7, 9].includes(i)) {
      add('calce', boxFromTo(x0, FL, zf0, x1, 1.65, zf1));
      add('calce', boxFromTo(x0, 5.05, zf0, x1, 5.7, zf1));
      add('interior', place(new THREE.PlaneGeometry(1.5, 3.4), cx, 3.35, zf0 + 0.05));
      add('rejilla', place(new THREE.PlaneGeometry(1.5, 3.4), cx, 3.35, W - 0.06));
      add('moldura', boxFromTo(cx - 0.9, 1.6, W - 0.02, cx - 0.75, 5.05, W + 0.06));
      add('moldura', boxFromTo(cx + 0.75, 1.6, W - 0.02, cx + 0.9, 5.05, W + 0.06));
      add('moldura', boxFromTo(cx - 0.98, 5.05, W - 0.02, cx + 0.98, 5.24, W + 0.09));
      add('moldura', boxFromTo(cx - 0.92, 1.55, W - 0.02, cx + 0.92, 1.65, W + 0.11));
    } else {
      add('calce', boxFromTo(x0, FL, zf0, x1, 5.7, zf1));
    }
  }
  for (const x of L.porchCols) add('moldura', boxFromTo(x - 0.26, FL, W, x + 0.26, 5.7, W + 0.06));
  // marco del portón
  add('moldura', boxFromTo(-1.5, FL, W - 0.02, -1.3, 5.05, W + 0.07));
  add('moldura', boxFromTo(1.3, FL, W - 0.02, 1.5, 5.05, W + 0.07));
  add('moldura', boxFromTo(-1.62, 5.05, W - 0.02, 1.62, 5.34, W + 0.11));
  // hojas del portón crema (abren hacia el zaguán)
  const lw = 1.3, lh = 5.05 - FL;
  const leafL = leafGeometry(lw, lh);
  const leafR = leafGeometry(lw, lh);
  leafR.frame.translate(-lw, 0, 0); leafR.panel.translate(-lw, 0, 0);
  M.puertaTablero = new THREE.MeshLambertMaterial({ color: '#e6d9b9' });
  M.laton = new THREE.MeshStandardMaterial({ color: '#b08d57', roughness: 0.35, metalness: 0.8 });
  const handle = (x) => mergeGeometries([
    place(new THREE.SphereGeometry(0.035, 10, 8), x, 1.5, 0.08),
    place(new THREE.SphereGeometry(0.035, 10, 8), x, 1.5, -0.08),
    place(new THREE.BoxGeometry(0.03, 0.16, 0.012), x, 1.5, 0.052),
  ].map(clean));
  const doorL = new THREE.Group(); doorL.position.set(-1.3, FL, W - 0.2);
  const doorR = new THREE.Group(); doorR.position.set(1.3, FL, W - 0.2);
  for (const [grp, geo, hx] of [[doorL, leafL, lw - 0.12], [doorR, leafR, -lw + 0.12]]) {
    for (const [g, mat] of [[geo.frame, M.puerta], [geo.panel, M.puertaTablero], [handle(hx), M.laton]]) {
      const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true;
      grp.add(mesh);
    }
    root.add(grp);
  }
  anim.doorL = doorL; anim.doorR = doorR;
  // muros laterales de la casa
  for (const s of [-1, 1]) add('calce', boxFromTo(s * (H - 0.3), 0, -30, s * H, 7.7, W));

  /* ---------------- Zaguán ---------------- */
  const zx = L.zaguanHalf, ze = L.zaguanEnd;
  add('marmolSombra', floor(-zx, ze, zx, zf0, FL + 0.003, 1.6));
  add('zaguan', boxFromTo(-zx - 0.3, FL, ze, -zx, 5.7, zf0));
  add('zaguan', boxFromTo(zx, FL, ze, zx + 0.3, 5.7, zf0));
  add('zaguan', place(new THREE.PlaneGeometry(2 * zx, zf0 - ze), 0, 5.69, (ze + zf0) / 2, 0, PI / 2));
  for (const z of [-5.0, -8.0]) {
    for (const s of [-1, 1]) {
      const rot = s < 0 ? PI / 2 : -PI / 2;
      add('vidrio', place(new THREE.PlaneGeometry(1.2, 3.0), s * (zx - 0.01), FL + 1.5, z, rot));
      add('vidrio', place(halfDisc(0.6, 16), s * (zx - 0.01), FL + 3.0, z, rot));
      add('puertaBlanca', boxFromTo(s * (zx - 0.06), FL, z - 0.72, s * zx, FL + 3.0, z - 0.6));
      add('puertaBlanca', boxFromTo(s * (zx - 0.06), FL, z + 0.6, s * zx, FL + 3.0, z + 0.72));
      add('puertaBlanca', boxFromTo(s * (zx - 0.05), FL, z - 0.03, s * zx, FL + 3.0, z + 0.03));
    }
  }
  // muro entre crujía frontal y portal, con el vano del zaguán
  add('calce', boxFromTo(L.leftWall, FL, ze, -zx, 7.4, ze + 0.4));
  add('calce', boxFromTo(zx, FL, ze, L.rightWall, 7.4, ze + 0.4));
  add('calce', boxFromTo(-zx, 5.7, ze, zx, 7.4, ze + 0.4));
  // marco de forja al final del zaguán
  const frame = place(new THREE.PlaneGeometry(2 * zx, 4.48), 0, FL + 2.24, ze - 0.02);
  add('marcoForja', frame);
  // puertas de las crujías hacia el portal frontal
  for (const x of [-11.0, -7.4, -3.8, 3.8, 7.4]) glassDoor(b, { x, z: ze, rotY: PI, w: 1.6, h: 3.1 });

  /* ---------------- Portales y patio ---------------- */
  const AZ = L.arcadeFront, AX = L.arcadeLeftX, LX = L.leftWall, RX = L.rightWall, BZ = L.backWall;
  // plataformas de los portales (escalón hacia la grava)
  add('piedra', boxFromTo(LX, GR - 0.3, AZ - 0.36, RX, FL, ze));
  add('piedra', boxFromTo(LX, GR - 0.3, BZ, AX + 0.36, FL, AZ - 0.36));
  add('marmolSombra', floor(LX, AZ - 0.36, RX, ze, FL + 0.003, 1.6));
  add('marmolSombra', floor(LX, BZ, AX + 0.36, AZ - 0.36, FL + 0.003, 1.6));
  add('grava', floor(AX + 0.36, BZ, RX, AZ - 0.36, GR, 3));
  // columnas de los portales sobre pedestal
  const arcCol = ionicColumn(3.3, 0.21);
  const arcM = [], plinthM = [];
  for (const x of L.frontArcadeCols) { arcM.push(mat4(x, FL + 0.5, AZ)); plinthM.push(mat4(x, FL, AZ)); }
  for (const z of L.leftArcadeCols) { arcM.push(mat4(AX, FL + 0.5, z)); plinthM.push(mat4(AX, FL, z)); }
  root.add(instanced(arcCol, M.moldura, arcM));
  root.add(instanced(place(new THREE.BoxGeometry(0.62, 0.5, 0.62), 0, 0.25, 0), M.moldura, plinthM));
  // pilastras adosadas en los extremos
  add('calce', boxFromTo(RX - 0.5, FL, AZ - 0.3, RX, 7.4, AZ + 0.3));
  add('calce', boxFromTo(AX - 0.3, FL, BZ, AX + 0.3, 7.4, BZ + 0.5));
  // arcos del portal frontal
  const yS = 5.0, yT = 7.4;
  const fBays = [[-9.2, -5.6], [-5.6, -2.0], [-2.0, 2.0], [2.0, 5.6], [5.6, RX - 0.5]];
  for (const [x0, x1] of fBays) {
    const r = (x1 - x0) / 2 - 0.25, mid = (x0 + x1) / 2;
    add('calce', archPanel(x0, x1, yS, yT, r, 0.5).translate(0, 0, AZ));
    for (const dz of [-0.27, 0.27]) add('moldura', place(new THREE.TorusGeometry(r + 0.07, 0.065, 6, 26, PI), mid, yS, AZ + dz));
  }
  // arcos del portal de T'HŌ Aperitivo (eje norte-sur)
  const lBays = [[AZ, -16.8], [-16.8, -20.4], [-20.4, -24.0], [-24.0, BZ + 0.5]];
  for (const [z0, z1] of lBays) {
    const a0 = -z0, a1 = -z1;
    const r = (a1 - a0) / 2 - 0.25, mid = (a0 + a1) / 2;
    add('calce', archPanel(a0, a1, yS, yT, r, 0.5).rotateY(PI / 2).translate(AX, 0, 0));
    for (const dx of [-0.27, 0.27]) {
      add('moldura', place(new THREE.TorusGeometry(r + 0.07, 0.065, 6, 26, PI), mid, yS, dx).rotateY(PI / 2).translate(AX, 0, 0));
    }
  }
  // cornisas sobre los arcos
  add('moldura', boxFromTo(AX - 0.3, 7.4, AZ - 0.42, RX, 7.53, AZ + 0.25));
  add('moldura', boxFromTo(AX - 0.42, 7.4, BZ, AX + 0.25, 7.53, AZ - 0.42));
  add('moldura', boxFromTo(AX - 0.5, 7.53, AZ - 0.55, RX, 7.66, AZ + 0.25));
  add('moldura', boxFromTo(AX - 0.55, 7.53, BZ, AX + 0.25, 7.66, AZ - 0.55));
  add('calce', boxFromTo(AX - 0.3, 7.66, AZ - 0.3, RX, 8.1, AZ));
  add('calce', boxFromTo(AX - 0.3, 7.66, BZ, AX, 8.1, AZ - 0.3));
  // azoteas y techos de vigas
  add('calce', boxFromTo(LX - 0.4, 7.4, AZ - 0.25, RX, 7.7, ze));
  add('calce', boxFromTo(LX - 0.4, 7.4, BZ, AX + 0.25, 7.7, AZ - 0.25));
  const beamGeo = [];
  for (let x = LX + 0.4; x < RX - 0.3; x += 0.75) beamGeo.push(boxFromTo(x - 0.07, 7.18, AZ, x + 0.07, 7.4, ze));
  for (let z = AZ - 0.4; z > BZ + 0.3; z -= 0.75) beamGeo.push(boxFromTo(LX, 7.18, z - 0.07, AX, 7.4, z + 0.07));
  beamGeo.forEach((g) => add('techo', g));
  // muros perimetrales del patio
  add('calceSombra', boxFromTo(LX - 0.4, FL, BZ, LX, 7.4, ze));
  add('calce', boxFromTo(LX - 0.4, GR - 0.3, BZ - 0.4, RX + 0.4, 8.6, BZ));
  add('moldura', boxFromTo(LX - 0.4, 8.6, BZ - 0.45, RX + 0.45, 8.72, BZ + 0.08));
  add('calce', boxFromTo(RX, GR - 0.3, BZ, RX + 0.4, 8.6, ze));
  add('moldura', boxFromTo(RX - 0.08, 8.6, BZ, RX + 0.45, 8.72, ze));
  // puertas de boutiques: muro del fondo y muro oriente
  for (const x of L.backDoors) {
    const aw = L.awnBack.includes(x);
    add('piedra', boxFromTo(x - 1.0, GR - 0.05, BZ, x + 1.0, FL, BZ + 0.4));
    glassDoor(b, { x, z: BZ, rotY: 0, lattice: !aw });
    if (aw) awning(b, { x, z: BZ, w: 2.5 });
  }
  for (const z of L.rightDoors) {
    const aw = L.awnRight.includes(z);
    add('piedra', boxFromTo(RX - 0.4, GR - 0.05, z - 1.0, RX, FL, z + 1.0));
    glassDoor(b, { x: RX, z, rotY: -PI / 2, lattice: !aw });
    if (aw) awning(b, { x: RX, z, rotY: -PI / 2, w: 2.5 });
  }
  // puerta y cuadros del portal de T'HŌ Aperitivo
  glassDoor(b, { x: LX, z: -25.8, rotY: PI / 2, w: 1.6, h: 3.1 });
  [-15.0, -18.6, -22.2].forEach((z, i) => {
    add('marco', boxFromTo(LX, 2.75, z - 0.5, LX + 0.04, 4.05, z + 0.5));
    add(i % 2 ? 'cuadro2' : 'cuadro1', place(new THREE.PlaneGeometry(0.86, 1.1), LX + 0.045, 3.4, z, PI / 2));
  });

  b.build(M, root, SHADOW);
  return anim;
}
