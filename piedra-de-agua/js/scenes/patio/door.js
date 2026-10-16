// Puertas: el portón colonial de la entrada (clavos de hierro, sopraluce de medio
// punto con abanico liberty) y las cuatro puertas liberty del patio con placa de latón.
import * as THREE from 'three';
import { merge, place, box } from './geo.js';
import { fanTransom, leafGrille, crest } from './ironwork.js';

function raisedPanel(w, h, x, y0, z, depth = 0.03) {
  // marco biselado + campo en relieve
  return [
    box(w, h, depth * 0.5, x, y0, z),
    box(w * 0.78, h * 0.82, depth, x, y0 + h * 0.09, z),
  ];
}

function studs(cols, rows, x0, x1, y0, y1, z, r = 0.022, hq = true) {
  const parts = [];
  const sph = new THREE.SphereGeometry(r, hq ? 8 : 6, hq ? 5 : 3, 0, Math.PI * 2, 0, Math.PI / 2);
  sph.rotateX(Math.PI / 2);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = x0 + (x1 - x0) * (cols === 1 ? 0.5 : i / (cols - 1));
      const y = y0 + (y1 - y0) * (rows === 1 ? 0.5 : j / (rows - 1));
      parts.push(place(sph.clone(), x, y, z));
    }
  }
  return parts;
}

// Hoja de puerta con bisagra en x=0, se extiende hacia +x (sign=1) o −x (sign=−1).
function libertyLeaf(w, h, t, sign, mats, glassMat, hq) {
  const g = new THREE.Group();
  const cx = sign * w / 2;
  const st = 0.085;
  const wood = [];
  wood.push(box(st, h, t, sign * st / 2, 0, 0));
  wood.push(box(st, h, t, sign * (w - st / 2), 0, 0));
  wood.push(box(w, 0.2, t, cx, 0, 0));
  wood.push(box(w, 0.12, t, cx, h * 0.42, 0));
  wood.push(box(w, 0.1, t, cx, h - 0.1, 0));
  // panel inferior en relieve (ambas caras)
  const pw = w - 2 * st, ph = h * 0.42 - 0.2;
  wood.push(...raisedPanel(pw, ph, cx, 0.2, t * 0.25));
  wood.push(...raisedPanel(pw, ph, cx, 0.2, -t * 0.25));
  // tallas: molduras finas en el riel central
  wood.push(box(w - 0.04, 0.025, t + 0.02, cx, h * 0.42 + 0.05, 0));
  const woodMesh = new THREE.Mesh(merge(wood), mats.wood);
  woodMesh.castShadow = false; woodMesh.receiveShadow = true;
  g.add(woodMesh);
  // vidrio superior iluminado desde dentro
  const gh = h - 0.1 - (h * 0.42 + 0.12);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(pw, gh), glassMat);
  glass.position.set(cx, h * 0.42 + 0.12 + gh / 2, 0);
  g.add(glass);
  const grille = new THREE.Mesh(place(leafGrille(pw * 0.92, gh * 0.94, hq), cx, h * 0.42 + 0.12 + gh * 0.03, t * 0.18), mats.iron);
  g.add(grille);
  // manija de latón
  const knob = merge([
    place(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 8), sign * (w - 0.07), h * 0.46, t / 2 + 0.025, Math.PI / 2, 0, 0),
    place(new THREE.SphereGeometry(0.03, 10, 8), sign * (w - 0.07), h * 0.46, t / 2 + 0.055),
    place(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 8), sign * (w - 0.07), h * 0.46, -t / 2 - 0.025, Math.PI / 2, 0, 0),
  ]);
  g.add(new THREE.Mesh(knob, mats.brass));
  return g;
}

// Puerta liberty del patio. Origen: centro inferior del vano, cara del muro; +z hacia el patio.
export function makeLibertyDoor(mats, plaqueMat, { hq = true, wallThick = 0.4 } = {}) {
  const ow = 1.7, lh = 2.7, r = ow / 2, oh = lh + r + 0.12, t = 0.06;
  const group = new THREE.Group();
  const glassMat = mats.glassWarm.clone();
  // marco tallado en madera oscura
  const fw = 0.17;
  const frame = [
    box(fw, oh + 0.1, 0.09, -(ow / 2 + fw / 2), 0, 0.045),
    box(fw, oh + 0.1, 0.09, ow / 2 + fw / 2, 0, 0.045),
    box(ow + 2 * fw + 0.12, 0.2, 0.11, 0, oh, 0.055),
    box(ow + 2 * fw + 0.3, 0.06, 0.18, 0, oh + 0.2, 0.09),
    // basas de las jambas
    box(fw + 0.04, 0.3, 0.12, -(ow / 2 + fw / 2), 0, 0.06),
    box(fw + 0.04, 0.3, 0.12, ow / 2 + fw / 2, 0, 0.06),
    // filetes verticales tallados
    box(0.025, oh - 0.3, 0.025, -(ow / 2 + fw / 2), 0.3, 0.1),
    box(0.025, oh - 0.3, 0.025, ow / 2 + fw / 2, 0.3, 0.1),
  ];
  // enjutas sobre el arco del sopraluce
  const sp = new THREE.Shape();
  sp.moveTo(-r, 0); sp.lineTo(-r, oh - lh); sp.lineTo(r, oh - lh); sp.lineTo(r, 0);
  sp.absarc(0, 0, r, 0, Math.PI, false);
  const spG = new THREE.ExtrudeGeometry(sp, { depth: 0.07, bevelEnabled: false, curveSegments: hq ? 24 : 14 });
  frame.push(place(spG, 0, lh, -0.02));
  // relleno del fondo del muro (jambas interiores)
  frame.push(box(0.05, oh, wallThick, -ow / 2 - 0.025, 0, -wallThick / 2));
  frame.push(box(0.05, oh, wallThick, ow / 2 + 0.025, 0, -wallThick / 2));
  const frameMesh = new THREE.Mesh(merge(frame), mats.woodDark);
  frameMesh.receiveShadow = true;
  group.add(frameMesh);
  // cresta de latón sobre la cornisa
  const cr = new THREE.Mesh(place(crest(0.9, 0.22, hq), 0, oh + 0.26, 0.16), mats.brass);
  group.add(cr);
  // sopraluce: vidrio cálido + abanico de hierro
  const tg = new THREE.Mesh(new THREE.CircleGeometry(r - 0.02, hq ? 32 : 18, 0, Math.PI), glassMat);
  tg.position.set(0, lh, -0.03);
  group.add(tg);
  const fan = new THREE.Mesh(place(fanTransom(r - 0.03, hq, { rays: 7 }), 0, lh, 0.0), mats.iron);
  group.add(fan);
  // hojas sobre pivotes (bisagras)
  const leftPivot = new THREE.Group();
  leftPivot.position.set(-ow / 2, 0, -0.06);
  leftPivot.add(libertyLeaf(ow / 2 - 0.005, lh, t, 1, mats, glassMat, hq));
  const rightPivot = new THREE.Group();
  rightPivot.position.set(ow / 2, 0, -0.06);
  rightPivot.add(libertyLeaf(ow / 2 - 0.005, lh, t, -1, mats, glassMat, hq));
  group.add(leftPivot, rightPivot);
  // placa de latón
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.32), plaqueMat);
  plaque.position.set(0, oh + 0.62, 0.05);
  group.add(plaque);
  // marco de la placa
  const pf = merge([
    box(1.36, 0.035, 0.04, 0, oh + 0.44, 0.03),
    box(1.36, 0.035, 0.04, 0, oh + 0.765, 0.03),
    box(0.035, 0.36, 0.04, -0.68, oh + 0.44, 0.03),
    box(0.035, 0.36, 0.04, 0.68, oh + 0.44, 0.03),
  ]);
  group.add(new THREE.Mesh(pf, mats.brass));
  // estancia iluminada detrás del vano
  const roomMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd7a1').multiplyScalar(1.15), side: THREE.BackSide, fog: false });
  const room = new THREE.Mesh(new THREE.BoxGeometry(ow + 0.9, oh + 0.4, 2.4), roomMat);
  room.position.set(0, (oh + 0.4) / 2 - 0.01, -wallThick - 1.2);
  group.add(room);
  // halo de luz cálida que sale por la puerta
  return { group, leftPivot, rightPivot, plaque, glassMat, roomMat, size: { ow, oh, lh } };
}

// Portón de la entrada. Origen: centro inferior del vano en la cara interior del muro.
export function makePortal(mats, { hq = true } = {}) {
  const ow = 2.5, lh = 3.3, r = ow / 2, t = 0.11;
  const group = new THREE.Group();
  const makeLeaf = (sign) => {
    const w = ow / 2 - 0.01;
    const cx = sign * w / 2;
    const pivot = new THREE.Group();
    const wood = [];
    const st = 0.13;
    wood.push(box(st, lh, t, sign * st / 2, 0, 0));
    wood.push(box(st, lh, t, sign * (w - st / 2), 0, 0));
    wood.push(box(w, 0.22, t, cx, 0, 0));
    wood.push(box(w, 0.14, t, cx, lh * 0.5 - 0.07, 0));
    wood.push(box(w, 0.14, t, cx, lh - 0.14, 0));
    const pw = w - 2 * st;
    const ph1 = lh * 0.5 - 0.07 - 0.22, ph2 = lh - 0.14 - (lh * 0.5 + 0.07);
    for (const side of [1, -1]) {
      wood.push(...raisedPanel(pw, ph1, cx, 0.22, side * t * 0.3, 0.04));
      wood.push(...raisedPanel(pw, ph2, cx, lh * 0.5 + 0.07, side * t * 0.3, 0.04));
    }
    const woodMesh = new THREE.Mesh(merge(wood), mats.woodDark);
    woodMesh.castShadow = true; woodMesh.receiveShadow = true;
    pivot.add(woodMesh);
    // herrajes: clavos en retícula, pletinas y aldaba
    const iron = [];
    const zf = t / 2 + 0.005;
    iron.push(...studs(5, 4, sign * 0.07, sign * (w - 0.07), 0.11, 0.11, zf, 0.02, hq));
    iron.push(...studs(2, 9, sign * st / 2, sign * (w - st / 2), 0.35, lh - 0.25, zf, 0.024, hq));
    iron.push(...studs(4, 1, sign * (st + 0.06), sign * (w - st - 0.06), lh * 0.5, lh * 0.5, zf, 0.022, hq));
    iron.push(...studs(4, 1, sign * (st + 0.06), sign * (w - st - 0.06), lh - 0.07, lh - 0.07, zf, 0.022, hq));
    for (const y of [0.55, lh - 0.55]) {
      iron.push(box(w * 0.82, 0.05, 0.012, sign * w * 0.43, y, zf));
      iron.push(...studs(5, 1, sign * 0.1, sign * w * 0.8, y + 0.025, y + 0.025, zf + 0.008, 0.016, hq));
    }
    // aldaba (anillo) a media altura
    const ring = new THREE.TorusGeometry(0.075, 0.012, 6, hq ? 20 : 12);
    iron.push(place(ring, sign * (w - 0.24), lh * 0.52, zf + 0.03));
    iron.push(place(new THREE.SphereGeometry(0.03, 10, 6), sign * (w - 0.24), lh * 0.52 + 0.075, zf + 0.01));
    pivot.add(new THREE.Mesh(merge(iron), mats.iron));
    // tirador de latón por el lado interior
    pivot.add(new THREE.Mesh(place(new THREE.TorusGeometry(0.06, 0.01, 6, 14), sign * (w - 0.24), lh * 0.5, -zf - 0.02), mats.brass));
    return pivot;
  };
  const leftPivot = makeLeaf(1);
  leftPivot.position.set(-ow / 2, 0, -0.02);
  const rightPivot = makeLeaf(-1);
  rightPivot.position.set(ow / 2, 0, -0.02);
  group.add(leftPivot, rightPivot);
  // travesaño y sopraluce
  const transomMat = mats.glassDay.clone();
  const tg = new THREE.Mesh(new THREE.CircleGeometry(r - 0.02, hq ? 40 : 24, 0, Math.PI), transomMat);
  tg.position.set(0, lh + 0.06, -0.08);
  group.add(tg);
  const beam = new THREE.Mesh(box(ow, 0.12, 0.16, 0, lh, 0.02), mats.woodDark);
  group.add(beam);
  const fan = new THREE.Mesh(place(fanTransom(r - 0.02, hq, { rays: 11 }), 0, lh + 0.06, 0.02), mats.iron);
  group.add(fan);
  return { group, leftPivot, rightPivot, transomMat, size: { ow, lh, r } };
}
