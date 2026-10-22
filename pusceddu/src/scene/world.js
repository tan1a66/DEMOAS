import * as THREE from 'three';
import { createMarble } from './marble.js';
import { Monument } from './monument.js';
import { lightPool } from './geometry.js';

// La scena: un solo monumento al centro del pavimento rosso, mai visto per intero.
// Il percorso segue il viaggio di Dante: si apre sulla bilancia della Giustizia in cima,
// il drone scende fino all'Inferno, risale le cornici del Purgatorio e torna alla bilancia.
//   0 bilancia (apertura) · 1 anello dell'Inferno (Chi sono) · 2 anello del Purgatorio (Chi sono)
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
  scene.add(monument.group);
  world.monument = monument;
  world.justice = monument.justice;
  world.knot = monument.knot;
  world.book = monument.book;
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
// I fotogrammi `via` sono tappe di passaggio (senza scheda): il drone si allontana un poco
// e mostra un tratto del monumento, mai tutto, poi torna a zoomare sul dettaglio successivo.
export function keyframes(world, narrow) {
  const p = world.monument.points;
  // Su mobile lo schermo è stretto: il drone resta più lontano per far stare il dettaglio.
  const near = narrow ? 2.1 : 1;
  const farK = narrow ? 1.35 : 1;
  const side = (s) => (narrow ? 0 : s);
  const lift = narrow ? 0.3 : 0;
  const station = (view, sx) => ({ ...view, sx: side(sx), sy: lift, fov: 34 });
  const via = (view, { at = 0.45 } = {}) => ({ ...view, sx: 0, sy: lift * 0.5, fov: 34, via: true, at });
  const c = (y) => new THREE.Vector3(0, y, 0);

  const kfs = [
    { ...around(p.scales, -16, 3.0 * (narrow ? 1.55 : 1), narrow ? -0.25 : 0.12), sx: side(0.38), sy: narrow ? 0.52 : 0, fov: 34 },
    via(around(c(3.4), -30, 4.2 * farK, 0.3)),
    station(around(p.inferno, -32, 2.2 * near, 0.15), -0.34),
    station(around(p.purgatorio, 6, 2.0 * near, 0.2), -0.36),
    via(around(c(3.1), 22, 4.4 * farK, 0.6)),
    station(around(p.shield.pos, p.shield.az + 6, 1.0 * near, 0.22), 0.32),
    via(around(c(3.4), 98, 4.2 * farK, 0.7)),
    station(around(p.knot.pos, p.knot.az - 7, 1.15 * near, 0.22), -0.34),
    via(around(c(3.8), 205, 4.0 * farK, 0.8)),
    station(around(p.book.pos, p.book.az + 7, 0.78 * near, 0.36), 0.32),
    via(around(c(4.5), 315, 3.6 * farK, 0.5)),
    station(around(p.scales, 4, 1.6 * near, 0.08), -0.42),
  ];
  // Foschia lontana: qui non deve nascondere nulla, solo sfumare il pavimento all'orizzonte.
  for (const k of kfs) {
    const d = k.position.distanceTo(k.target);
    k.fog = [d + 25, d + 50];
  }
  return kfs;
}

// Volo d'ingresso: parte a pochi centimetri da un piatto e dalle catenelle, poi si
// allontana e rivela la bilancia (la struttura sotto resta fuori campo).
export function introPath(world, heroKf) {
  const s = world.monument.points.scales;
  return {
    positions: [
      new THREE.Vector3(-0.1, s.y - 0.2, 0.4),
      new THREE.Vector3(0.35, s.y - 0.02, 0.95),
      new THREE.Vector3(-0.55, s.y + 0.08, 1.9),
      heroKf.position.clone(),
    ],
    targets: [
      new THREE.Vector3(-0.28, s.y - 0.27, 0),
      new THREE.Vector3(0, s.y - 0.05, 0),
      s.clone(),
      heroKf.target.clone(),
    ],
  };
}
