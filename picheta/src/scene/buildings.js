// Fondo: edificios coloniales bajos alrededor de la plaza (con portales), el Palacio
// Municipal con su torre del reloj y, más lejos, los techos planos de la ciudad.
// La composición está "acomodada" para el encuadre: no es un plano topográfico.

import * as THREE from 'three';
import { GeoBag, arcadeGeometry, at, rng } from './build.js';
import { GROUND_Y } from './plaza.js';

/** Recoge ventanas (planos) para dibujarlas con dos InstancedMesh: apagadas y encendidas. */
class Windows {
  constructor(rand) {
    this.rand = rand;
    this.off = [];
    this.on = [];
  }
  /** (x, y, z) centro, w × h, rotación Y; `lit` forzado o aleatorio. */
  add(matrixBase, x, y, z, w, h, lit = null) {
    const m = new THREE.Matrix4().makeTranslation(x, y, z).scale(new THREE.Vector3(w, h, 1));
    const world = matrixBase.clone().multiply(m);
    const isLit = lit ?? this.rand() < 0.38;
    (isLit ? this.on : this.off).push(world);
  }
  meshes(mat) {
    const plane = new THREE.PlaneGeometry(1, 1);
    return [
      [this.off, mat.clayShade],
      [this.on, mat.windowLit],
    ].map(([list, material]) => {
      const im = new THREE.InstancedMesh(plane, material, Math.max(1, list.length));
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.count = list.length;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      return im;
    });
  }
}

/**
 * Casa colonial en coordenadas locales: fachada en z = 0 mirando a +Z, base en y = 0,
 * centrada en x. Con `portal`, la planta baja es un portal de arcos.
 */
function colonialBlock(bag, win, base, { width, height, depth = 14, portal = false, bays }) {
  const n = bays ?? Math.max(2, Math.round(width / 3.6));
  const step = width / n;
  const floor1 = portal ? 5.2 : 4.8;

  if (portal) {
    const recess = 3.2;
    bag.addMatrix(new THREE.BoxGeometry(width, height, depth - recess).translate(0, height / 2, -recess - (depth - recess) / 2), base);
    bag.addMatrix(new THREE.BoxGeometry(width, height - floor1, recess).translate(0, floor1 + (height - floor1) / 2, -recess / 2), base);
    bag.addMatrix(
      arcadeGeometry({ width, height: floor1, depth: 0.7, arches: n, archWidth: step * 0.7, archHeight: floor1 - 0.7 }),
      base,
    );
    // Fondo del portal: tiendas y cafés que se encienden de noche.
    for (let i = 0; i < n; i++) {
      win.add(base, -width / 2 + step * (i + 0.5), 2.0, -recess + 0.02, step * 0.62, 3.2, win.rand() < 0.75);
    }
  } else {
    bag.addMatrix(new THREE.BoxGeometry(width, height, depth).translate(0, height / 2, -depth / 2), base);
    for (let i = 0; i < n; i++) {
      win.add(base, -width / 2 + step * (i + 0.5), 1.9, 0.03, 1.5, 3.2, win.rand() < 0.3);
    }
  }
  // Planta alta: balcones con puerta-ventana.
  for (let i = 0; i < n; i++) {
    const x = -width / 2 + step * (i + 0.5);
    win.add(base, x, floor1 + 2.3, 0.03, 1.15, 2.5);
    bag.addMatrix(new THREE.BoxGeometry(1.6, 0.14, 0.5).translate(x, floor1 + 1.0, 0.25), base);
    bag.addMatrix(new THREE.BoxGeometry(1.6, 0.5, 0.04).translate(x, floor1 + 1.3, 0.48), base);
  }
  // Cornisa y pretil.
  bag.addMatrix(new THREE.BoxGeometry(width + 0.3, 0.35, 0.5).translate(0, height - 0.55, 0.12), base);
  bag.addMatrix(new THREE.BoxGeometry(width, 0.7, 0.3).translate(0, height + 0.35, -0.15), base);
  // Impostas entre plantas.
  bag.addMatrix(new THREE.BoxGeometry(width + 0.1, 0.18, 0.2).translate(0, floor1 + 0.15, 0.05), base);
}

/** Torre del reloj del Palacio Municipal (local: base en y = 0). */
function clockTower(bag, win, base) {
  bag.addMatrix(new THREE.BoxGeometry(5, 6.5, 5).translate(0, 3.25, 0), base);
  bag.addMatrix(new THREE.BoxGeometry(5.4, 0.35, 5.4).translate(0, 6.6, 0), base);
  bag.addMatrix(new THREE.BoxGeometry(4.2, 4.2, 4.2).translate(0, 8.9, 0), base);
  // Esferas del reloj: discos un poco salientes, encendidos de noche.
  for (let k = 0; k < 4; k++) {
    const r = at(0, 0, 0, (k * Math.PI) / 2);
    const m = base.clone().multiply(r);
    win.add(m, 0, 9.1, 2.13, 1.9, 1.9, true);
  }
  bag.addMatrix(new THREE.BoxGeometry(4.6, 0.3, 4.6).translate(0, 11.15, 0), base);
  // Campanario abierto: cuatro pilares (el cielo se ve a través).
  for (const [x, z] of [[1.4, 1.4], [-1.4, 1.4], [1.4, -1.4], [-1.4, -1.4]]) {
    bag.addMatrix(new THREE.BoxGeometry(0.7, 2.6, 0.7).translate(x, 12.6, z), base);
  }
  bag.addMatrix(new THREE.BoxGeometry(3.8, 0.4, 3.8).translate(0, 14.1, 0), base);
  bag.addMatrix(new THREE.ConeGeometry(2.3, 2.4, 4).rotateY(Math.PI / 4).translate(0, 15.5, 0), base);
  bag.addMatrix(new THREE.CylinderGeometry(0.06, 0.1, 1.4, 4).translate(0, 17.3, 0), base);
}

/** Torre de iglesia lejana (silueta). */
function churchTower(bag, base, h) {
  bag.addMatrix(new THREE.BoxGeometry(3.4, h, 3.4).translate(0, h / 2, 0), base);
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    bag.addMatrix(new THREE.BoxGeometry(0.6, 2.4, 0.6).translate(x * 1.1, h + 1.2, z * 1.1), base);
  }
  bag.addMatrix(new THREE.BoxGeometry(3.2, 0.3, 3.2).translate(0, h + 2.55, 0), base);
  bag.addMatrix(new THREE.SphereGeometry(1.4, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, h + 2.7, 0), base);
  bag.addMatrix(new THREE.ConeGeometry(0.25, 1.4, 4).translate(0, h + 4.6, 0), base);
}

export function buildBuildings(mat) {
  const group = new THREE.Group();
  const rand = rng(21);
  const near = new GeoBag();
  const far = new GeoBag();
  const win = new Windows(rand);
  const G = GROUND_Y;

  // ---------------------------------------------------------------- lado sur (al fondo)
  // [ancho, alto, portal]. Empieza junto a la catedral (izquierda) y sigue hacia la derecha.
  const southZ = -93;
  const south = [[12, 11.5, true], [10, 10.5, false]];
  let x = -9;
  for (const [w, h, portal] of south) {
    colonialBlock(near, win, at(x + w / 2, G, southZ), { width: w, height: h, portal });
    x += w;
  }
  // Palacio Municipal: dos plantas con portal y la torre del reloj al centro.
  const palX = x + 13;
  colonialBlock(near, win, at(palX, G, southZ), { width: 26, height: 12.5, portal: true, bays: 7 });
  clockTower(near, win, at(palX, G + 12.5, southZ - 3.5));
  x += 26;
  for (const [w, h, portal] of [[9, 9.8, false], [14, 12, true], [16, 12, true], [12, 11, false], [14, 12, true]]) {
    colonialBlock(near, win, at(x + w / 2, G, southZ), { width: w, height: h, portal });
    x += w;
  }

  // ---------------------------------------------------------------- lados este y oeste
  // Solo se ven en pantallas anchas, al borde del encuadre.
  const sides = [
    { x: -48, ry: Math.PI / 2, z0: -16, z1: -70 }, // este (izquierda), mira a +X
    { x: 48, ry: -Math.PI / 2, z0: -16, z1: -92 }, // oeste (derecha), mira a -X
  ];
  for (const s of sides) {
    let z = s.z0;
    while (z > s.z1) {
      const w = 9 + rand() * 7;
      const h = 9.5 + rand() * 3;
      colonialBlock(near, win, at(s.x, G, z - w / 2, s.ry), { width: w, height: h, portal: rand() > 0.5 });
      z -= w;
    }
  }

  // ---------------------------------------------------------------- la ciudad detrás
  // Techos planos con tinacos y alguna torre de iglesia; la niebla los funde con el cielo.
  for (let gz = -112; gz > -340; gz -= 13) {
    for (let gx = -190; gx < 190; gx += 11) {
      if (rand() < 0.28) continue;
      if (gz > -150 && gx > -50 && gx < 0) continue; // detrás de la catedral
      const w = 6 + rand() * 7;
      const d = 6 + rand() * 7;
      const h = 4.5 + rand() * rand() * 10;
      const bx = gx + rand() * 3;
      const bz = gz - rand() * 3;
      far.box(w, h, d, bx, G, bz);
      if (rand() < 0.45) {
        far.add(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 6), { x: bx + (rand() - 0.5) * w * 0.6, y: G + h + 0.6, z: bz + (rand() - 0.5) * d * 0.6 });
      }
    }
  }
  for (const [tx, tz, h] of [[62, -180, 20], [-105, -230, 17], [130, -260, 22], [22, -300, 18]]) {
    churchTower(far, at(tx, G, tz), h);
  }

  // Los edificios reciben sombra pero no la proyectan: al atardecer sus sombras larguísimas
  // dejarían a oscuras la fachada de la catedral, que es justo la que debe encenderse.
  group.add(near.mesh(mat.clay, { cast: false }));
  const farMesh = far.mesh(mat.clay, { cast: false, receive: false });
  group.add(farMesh);
  group.add(...win.meshes(mat));
  return { group };
}
