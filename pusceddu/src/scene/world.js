import * as THREE from 'three';
import { createMarble } from './marble.js';
import { Monument } from './monument.js';
import { lightPool } from './geometry.js';

// La scena: un solo monumento al centro del pavimento rosso. Il drone ci gira attorno
// salendo a spirale: zoom sul dettaglio, poi si allontana e mostra tutto, poi di nuovo zoom.
//   0 apertura · 1 nome (Chi sono) · 2 anello dell'Inferno (Chi sono)
//   3 scudo (Tutela) · 4 nodo (Legal Design) · 5 libro (Pubblicazioni)
//   6 super zoom sulla bilancia (Contatti)

const deg = THREE.MathUtils.degToRad;

export async function buildWorld(scene, step = async () => {}) {
  const world = {};

  // Pavimento: riceve solo le ombre (il rosso è lo sfondo della pagina).
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.ShadowMaterial({ color: 0x2a0306, opacity: 0.42 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  scene.add(lightPool(3.4, 0.24));
  await step();

  const monument = new Monument((o = {}) => createMarble(o));
  // Il monumento sale dal pavimento nell'intro: serve un gruppo da spostare.
  world.root = new THREE.Group();
  world.root.add(monument.group);
  scene.add(world.root);
  world.monument = monument;
  world.justice = monument.justice;
  world.knot = monument.knot;
  world.book = monument.book;
  world.clipMaterials = new Set();
  monument.group.traverse((o) => {
    if (!o.material) return;
    for (const m of [].concat(o.material)) world.clipMaterials.add(m);
  });
  await step();
  return world;
}

// Punto di vista: dal bersaglio, in direzione `az` (gradi, 0 = davanti), a distanza `dist`.
function around(target, az, dist, up = 0) {
  const a = deg(az);
  return { position: new THREE.Vector3(target.x + Math.sin(a) * dist, target.y + up, target.z + Math.cos(a) * dist), target: target.clone() };
}

// Fotogrammi chiave del drone. `narrow` = schermo stretto (mobile): niente spostamento
// laterale, dettaglio nella parte alta dello schermo e un po' più lontano.
// I fotogrammi `via` sono tappe di passaggio (senza scheda): il drone si allontana e
// mostra tutto il monumento, poi torna a zoomare sul dettaglio successivo.
export function keyframes(world, narrow) {
  const p = world.monument.points;
  // Su mobile lo schermo è stretto: il drone resta più lontano per far stare il dettaglio.
  const near = narrow ? 2.1 : 1;
  const farK = narrow ? 1.35 : 1;
  const side = (s) => (narrow ? 0 : s);
  const lift = narrow ? 0.3 : 0;
  const station = (view, sx) => ({ ...view, sx: side(sx), sy: lift, fov: 34 });
  const via = (view, { at = 0.42 } = {}) => ({ ...view, sx: 0, sy: lift * 0.5, fov: 34, via: true, at });
  const c = (y) => new THREE.Vector3(0, y, 0);
  const lifted = (v, dy) => v.clone().add(new THREE.Vector3(0, dy, 0));

  const kfs = [
    { ...around(c(2.65), 14, 9.6 * (narrow ? 2.15 : 1), 0.5), sx: side(0.3), sy: narrow ? 0.55 : 0, fov: 34 },
    station(around(lifted(p.name, 0.05), 8, 3.4 * near, 0.2), -0.42),
    station(around(p.inferno, -20, 2.2 * near, 0.15), -0.34),
    via(around(c(3.0), 12, 8.5 * farK, 0.9)),
    station(around(p.shield.pos, p.shield.az + 6, 1.0 * near, 0.22), 0.32),
    via(around(c(3.1), 95, 8.5 * farK, 1.2)),
    station(around(p.knot.pos, p.knot.az - 7, 1.15 * near, 0.22), -0.34),
    via(around(c(3.2), 205, 8.5 * farK, 1.4)),
    station(around(p.book.pos, p.book.az + 7, 0.78 * near, 0.36), 0.32),
    via(around(c(3.6), 318, 9 * farK, 2.6)),
    station(around(p.scales, 4, 1.35 * near, 0.08), -0.3),
  ];
  // Foschia lontana: qui non deve nascondere nulla, solo sfumare il pavimento all'orizzonte.
  for (const k of kfs) {
    const d = k.position.distanceTo(k.target);
    k.fog = [d + 25, d + 50];
  }
  return kfs;
}

// Volo d'ingresso: da lontano e dall'alto, giro attorno al monumento con "zoom" sulla
// bilancia in cima, poi l'inquadratura iniziale.
export function introPath(world, heroKf) {
  const s = world.monument.points.scales;
  return {
    positions: [
      new THREE.Vector3(-12, 13, -18),
      new THREE.Vector3(-8, 6, -5),
      new THREE.Vector3(-1.4, s.y + 0.2, 1.05),
      new THREE.Vector3(0.9, s.y - 0.35, 3.2),
      heroKf.position.clone(),
    ],
    targets: [
      new THREE.Vector3(0, 2, 0),
      new THREE.Vector3(0, 2.6, 0),
      s.clone(),
      new THREE.Vector3(0, s.y - 0.55, 0),
      heroKf.target.clone(),
    ],
  };
}
