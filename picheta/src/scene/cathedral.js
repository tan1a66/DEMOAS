// Catedral de San Ildefonso en silueta: fachada maciza y plana con el gran arco central,
// dos torres campanario delgadas y, detrás, la nave con su cúpula.
// Coordenadas locales: fachada en z = 0 mirando a +Z, base en y = 0, centrada en x = 0.

import * as THREE from 'three';
import { GeoBag, arcadeGeometry } from './build.js';
import { GROUND_Y } from './plaza.js';

const W = 30; // ancho de la fachada
const H = 22; // altura del muro de la fachada

function tower(bag, x) {
  const t = 4.6;
  bag.box(t, 30, t, x, 0, -t / 2);
  bag.box(t + 0.5, 0.45, t + 0.5, x, 30, -t / 2);
  // Campanario: pilares en las esquinas, se ve el cielo entre ellos.
  const c = t / 2 - 0.45;
  for (const [dx, dz] of [[c, c], [-c, c], [c, -c], [-c, -c]]) {
    bag.box(0.9, 5.2, 0.9, x + dx, 30.45, -t / 2 + dz);
  }
  bag.box(t + 0.3, 0.5, t + 0.3, x, 35.65, -t / 2);
  // Remate: cupulín y linterna.
  bag.add(new THREE.CylinderGeometry(1.75, 1.95, 1.1, 8), { x, y: 36.7, z: -t / 2 });
  bag.add(new THREE.SphereGeometry(1.75, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), { x, y: 37.25, z: -t / 2 });
  bag.add(new THREE.CylinderGeometry(0.42, 0.42, 1.3, 6), { x, y: 39.5, z: -t / 2 });
  bag.add(new THREE.ConeGeometry(0.5, 1.3, 6), { x, y: 40.8, z: -t / 2 });
  bag.add(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 4), { x, y: 42, z: -t / 2 });
}

export function buildCathedral(mat) {
  const bag = new GeoBag();
  const dark = new GeoBag();

  // Muro de la fachada (macizo y plano) con un ligero remate escalonado al centro.
  bag.box(W, H, 5, 0, 0, -2.5);
  bag.box(15, 3.2, 5, 0, H, -2.5);
  bag.box(7, 1.6, 5, 0, H + 3.2, -2.5);
  bag.box(W + 0.4, 0.45, 5.4, 0, H - 0.45, -2.5);

  // Gran arco central (marco saliente) y la puerta en sombra.
  bag.add(arcadeGeometry({ width: 13, height: 19.5, depth: 0.8, arches: 1, archWidth: 8.6, archHeight: 17, segments: 8 }), { z: 0.8 });
  dark.add(new THREE.PlaneGeometry(3.4, 6.4), { y: 3.2, z: 0.02 });
  // Ventanas pequeñas y altas, como en la fachada real.
  for (const x of [-9, 9]) dark.add(new THREE.PlaneGeometry(1.1, 2.2), { x, y: 14.5, z: 0.02 });
  dark.add(new THREE.CircleGeometry(1.0, 8), { y: 13.6, z: 0.03 });

  tower(bag, -W / 2 + 2.3);
  tower(bag, W / 2 - 2.3);

  // Nave, naves laterales y cúpula en el crucero.
  bag.box(17, 19, 52, 0, 0, -31);
  bag.box(W - 2, 12.5, 46, 0, 0, -30);
  bag.add(new THREE.CylinderGeometry(5.2, 5.2, 4, 8), { y: 21, z: -42 });
  bag.add(new THREE.SphereGeometry(5.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), { y: 23, z: -42 });
  bag.add(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 6), { y: 29.2, z: -42 });
  bag.add(new THREE.ConeGeometry(1.1, 1.4, 6), { y: 31, z: -42 });

  const group = new THREE.Group();
  group.add(bag.mesh(mat.clay));
  const darkMesh = dark.mesh(mat.clayShade, { cast: false });
  group.add(darkMesh);

  // Colocación en la escena: esquina izquierda del fondo, girada hacia la plaza
  // (y hacia el poniente, para que la fachada reciba la luz del atardecer).
  group.position.set(-16, GROUND_Y, -104);
  group.rotation.y = 1.0;
  group.updateMatrixWorld(true);

  // De noche la catedral está iluminada desde la plaza.
  const flood = new THREE.SpotLight('#FFC27A', 0, 70, 0.62, 0.7, 1.4);
  flood.position.copy(group.localToWorld(new THREE.Vector3(0, 0.5, 24)));
  flood.target.position.copy(group.localToWorld(new THREE.Vector3(0, 16, 0)));

  return { group, flood, facadeCenter: group.localToWorld(new THREE.Vector3(0, 15, 0)) };
}
