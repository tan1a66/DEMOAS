import * as THREE from 'three';
import { createMarble } from './marble.js';
import { buildColumn, buildPlinth } from './column.js';
import { JusticeSculpture } from './justice.js';
import { DanteCosmos } from './dante.js';
import { buildShield } from './shield.js';
import { MorphKnot } from './knot.js';
import { OpenBook } from './book.js';
import { lightPool } from './geometry.js';

// Il "museo": le opere disposte lungo il percorso del drone, sul pavimento rosso.
//   0 colonnina con la Giustizia · 1-2 cosmo di Dante (Chi sono) · 3 scudo (Tutela)
//   4 nodo (Legal Design) · 5 libro (Pubblicazioni) · 6 vista aerea (Sedi e contatti)

const deg = THREE.MathUtils.degToRad;

// Le opere fanno corona alla colonnina, su un arco aperto verso sud, e ognuna guarda verso
// il centro: alle sue spalle resta solo il rosso. All'apertura sono troppo lontane e si
// dissolvono nello sfondo; dall'alto, alla fine, la Giustizia sta al centro di tutto.
const R = 6;
const onRing = (angleDeg) => {
  const a = deg(angleDeg);
  return { pos: new THREE.Vector3(Math.sin(a) * R, 0, -Math.cos(a) * R), rotY: -a };
};
export const LAYOUT = {
  hero: { pos: new THREE.Vector3(0, 0, 0), rotY: deg(-8) },
  dante: onRing(110),
  shield: onRing(22),
  knot: onRing(-22),
  book: onRing(-110),
};

export async function buildWorld(scene, step = async () => {}) {
  const marble = (o = {}) => createMarble(o);
  const world = { clipMaterials: [], works: [] };
  // Ogni opera (con il suo alone di luce) sta in un gruppo: nell'intro restano nascoste.
  const work = (...objs) => {
    const g = new THREE.Group();
    g.add(...objs);
    scene.add(g);
    world.works.push(g);
    return g;
  };

  // Pavimento: riceve solo le ombre (il rosso è lo sfondo della pagina).
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.ShadowMaterial({ color: 0x2a0306, opacity: 0.42 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  await step('pavimento');

  // --- 0. Colonnina + Giustizia
  const heroMat = marble({ seed: 1.3, scale: 1.4 });
  const columnMat = marble({ seed: 4.1, scale: 1.1, veinStrength: 0.62 });
  const ribbonMat = marble({ seed: 2.2, scale: 3, veinStrength: 0.45, side: THREE.DoubleSide, roughness: 0.36 });
  const hero = new THREE.Group();
  const column = buildColumn(columnMat);
  hero.add(column.group);
  const justice = new JusticeSculpture(heroMat, ribbonMat);
  justice.group.position.y = column.top;
  hero.add(justice.group);
  const heroRoot = new THREE.Group(); // sale dal pavimento nell'intro
  heroRoot.add(hero);
  heroRoot.position.copy(LAYOUT.hero.pos);
  hero.rotation.y = LAYOUT.hero.rotY;
  scene.add(heroRoot);
  scene.add(withPos(lightPool(1.9, 0.26), LAYOUT.hero.pos));
  world.clipMaterials.push(heroMat, columnMat, ribbonMat);
  world.hero = { root: hero, column, justice, top: column.top + 1.45, pivotY: column.top + 1.325 };
  await step('colonna');

  // --- 1-2. Il cosmo di Dante
  const danteMat = marble({ seed: 7.7, scale: 1.3, veinStrength: 0.6 });
  const dante = new DanteCosmos(danteMat, (o) => marble({ seed: 7.7, scale: 1.3, veinStrength: 0.6, ...o }));
  place(dante.group, LAYOUT.dante);
  work(dante.group, withPos(lightPool(1.8, 0.22), LAYOUT.dante.pos));
  world.dante = dante;
  await step('dante');

  // --- 3. Scudo con filo rosso
  const plinthMat = marble({ seed: 3.3, scale: 1.2, veinStrength: 0.5 });
  const shieldMat = marble({ seed: 9.1, scale: 2.2 });
  const threadMat = new THREE.MeshPhysicalMaterial({ color: 0xa3121b, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenColor: 0xff4040 });
  const shieldGroup = new THREE.Group();
  const p1 = buildPlinth(plinthMat, { w: 0.62, h: 0.95, d: 0.44 });
  shieldGroup.add(p1.group);
  const shield = buildShield(shieldMat, threadMat);
  shield.group.position.set(0, p1.top + 0.06 + 0.4, 0.02);
  shield.group.rotation.x = deg(-6);
  shieldGroup.add(shield.group);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 16), plinthMat);
  rod.position.set(0, p1.top + 0.15, -0.03);
  rod.castShadow = true;
  shieldGroup.add(rod);
  place(shieldGroup, LAYOUT.shield);
  work(shieldGroup, withPos(lightPool(1.4, 0.22), LAYOUT.shield.pos));
  world.shield = { group: shield.group, center: new THREE.Vector3(0, p1.top + 0.46, 0) };
  await step('scudo');

  // --- 4. Nodo → anello
  const knotMat = marble({ seed: 6.4, scale: 2.4, restAttribute: true });
  const knotGroup = new THREE.Group();
  const p2 = buildPlinth(plinthMat, { w: 0.5, h: 0.95, d: 0.5 });
  knotGroup.add(p2.group);
  const knot = new MorphKnot(knotMat);
  knot.mesh.position.y = p2.top + 0.5;
  knotGroup.add(knot.mesh);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.24, 16), plinthMat);
  pin.position.y = p2.top + 0.12;
  pin.castShadow = true;
  knotGroup.add(pin);
  place(knotGroup, LAYOUT.knot);
  work(knotGroup, withPos(lightPool(1.3, 0.22), LAYOUT.knot.pos));
  world.knot = knot;
  await step('nodo');

  // --- 5. Libro sul leggio
  const bookMat = marble({ seed: 8.8, scale: 1.6, veinStrength: 0.55 });
  const book = new OpenBook(bookMat, (o) => marble({ scale: 1.6, ...o }));
  place(book.group, LAYOUT.book);
  work(book.group, withPos(lightPool(1.5, 0.22), LAYOUT.book.pos));
  world.book = book;
  await step('libro');

  return world;
}

function place(obj, { pos, rotY }) {
  obj.position.copy(pos);
  obj.rotation.y = rotY;
}

function withPos(obj, pos) {
  obj.position.x = pos.x;
  obj.position.z = pos.z;
  return obj;
}

// Punto di vista davanti a un'opera: direzione frontale ruotata di `yaw`, distanza, quota.
function viewOf({ pos, rotY }, { y, dist, yaw = 0, up = 0, lookY = y }) {
  const a = rotY + yaw;
  const target = new THREE.Vector3(pos.x, lookY, pos.z);
  const position = new THREE.Vector3(pos.x + Math.sin(a) * dist, y + up, pos.z + Math.cos(a) * dist);
  return { position, target };
}

// Fotogrammi chiave del drone. `narrow` = schermo stretto (mobile): niente spostamento
// laterale, opera nella parte alta dello schermo e un po' più lontana.
// I fotogrammi `via` sono tappe di passaggio tra due capitoli (non hanno una scheda):
// il drone si volta e inquadra da lontano l'opera successiva, poi le si avvicina.
export function keyframes(narrow) {
  const far = narrow ? 1.4 : 1;
  const side = (s) => (narrow ? 0 : s);
  const lift = narrow ? 0.34 : 0;
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const via = (position, target, sx, { at = 0.42, fov = 34 } = {}) => ({ position, target, sx: side(sx), sy: lift * 0.6, fov, via: true, at });
  const kfs = [
    // Su mobile la colonnina sta piccola in alto, sopra il nome.
    { ...viewOf(LAYOUT.hero, { y: 2.1, dist: 7.1 * (narrow ? 2.15 : 1), yaw: deg(18), up: 0.5, lookY: 1.86 }), sx: side(0.34), sy: narrow ? 0.48 : 0, fov: 34, fogGap: [2.6, 4.5] },
    via(v3(0.9, 2.5, 3.6), LAYOUT.dante.pos.clone().setY(1.25), -0.15, { at: 0.38 }),
    { ...viewOf(LAYOUT.dante, { y: 1.28, dist: 4.3 * far, yaw: deg(-14), up: 0.35 }), sx: side(-0.36), sy: lift, fov: 34 },
    { ...viewOf(LAYOUT.dante, { y: 1.5, dist: 2.7 * far, yaw: deg(20), up: 0.1, lookY: 1.55 }), sx: side(-0.36), sy: lift, fov: 34 },
    via(v3(2.6, 2.8, -0.9), v3(0, 1.3, -5.56), 0.05, { fov: 40 }),
    { ...viewOf(LAYOUT.shield, { y: 1.38, dist: 2.6 * far, yaw: deg(-12), up: 0.25 }), sx: side(0.32), sy: lift, fov: 34 },
    via(v3(0, 3.6, -1.6), v3(0, 1.3, -5.56), 0, { at: 0.5, fov: 46 }),
    { ...viewOf(LAYOUT.knot, { y: 1.45, dist: 2.5 * far, yaw: deg(14), up: 0.2 }), sx: side(-0.36), sy: lift, fov: 34 },
    via(v3(-2.6, 2.6, -1.4), LAYOUT.book.pos.clone().setY(1.1), 0.1),
    { ...viewOf(LAYOUT.book, { y: 1.08, dist: 1.9 * far, yaw: deg(-12), up: 1.0 }), sx: side(0.32), sy: lift, fov: 34 },
    {
      // Vista aerea: la Giustizia al centro, le opere a corona.
      position: narrow ? v3(0, 50, 26) : v3(0, 27, 10.5),
      target: v3(0, 0, -1.6),
      sx: side(-0.45),
      sy: lift,
      fov: 34,
      fogGap: [60, 90],
    },
  ];
  // Foschia: oltre l'opera inquadrata tutto si dissolve nello sfondo.
  for (const k of kfs) {
    const d = k.position.distanceTo(k.target);
    const [n, f] = k.fogGap ?? [3, 14];
    k.fog = [d + n, d + f];
  }
  return kfs;
}

// Volo d'ingresso: da lontano e dall'alto (alle spalle della colonna), giro attorno
// alla scultura con "zoom" sulla bilancia, poi l'inquadratura iniziale.
export function introPath(world, heroKf) {
  const pv = world.hero.pivotY;
  return {
    positions: [
      new THREE.Vector3(-7, 9, -13),
      new THREE.Vector3(-5.2, 4.4, -3.6),
      new THREE.Vector3(-1.35, pv + 0.08, 1.3),
      new THREE.Vector3(0.5, pv - 0.2, 2.5),
      heroKf.position.clone(),
    ],
    targets: [
      new THREE.Vector3(0, 1.5, 0),
      new THREE.Vector3(0, 2.2, 0),
      new THREE.Vector3(0, pv - 0.18, 0),
      new THREE.Vector3(0, pv - 0.35, 0),
      heroKf.target.clone(),
    ],
  };
}
