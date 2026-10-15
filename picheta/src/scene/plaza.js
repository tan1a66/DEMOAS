// Plano medio: la Plaza Grande. Jardineras triangulares entre andadores en cruz y en
// diagonal, laureles redondeados y farolas.

import * as THREE from 'three';
import { GeoBag, rng } from './build.js';
import { canopyGeometries, trunkGeometry } from './trees.js';

export const GROUND_Y = -9.5; // nivel de la calle respecto al suelo de la terraza

// Plaza (sin las calles alrededor). La cámara está en x = 0, z = 0.
export const PLAZA = { x0: -36, x1: 36, z0: -13, z1: -83 };

/** Encoge un triángulo hacia su incentro: todos los lados se retiran `inset` metros. */
function insetTriangle([a, b, c], inset) {
  const la = b.distanceTo(c);
  const lb = a.distanceTo(c);
  const lc = a.distanceTo(b);
  const p = la + lb + lc;
  const inc = new THREE.Vector2(
    (la * a.x + lb * b.x + lc * c.x) / p,
    (la * a.y + lb * b.y + lc * c.y) / p,
  );
  const s = p / 2;
  const r = Math.sqrt(((s - la) * (s - lb) * (s - lc)) / s); // radio inscrito
  const k = Math.max(0.05, (r - inset) / r);
  return [a, b, c].map((v) => inc.clone().add(v.clone().sub(inc).multiplyScalar(k)));
}

export function buildPlaza(mat) {
  const group = new THREE.Group();
  const clay = new GeoBag();
  const rand = rng(7);
  const G = GROUND_Y;
  const { x0, x1, z0, z1 } = PLAZA;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;

  // Suelo de la ciudad: un plano grande que la niebla funde con el horizonte.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mat.clay);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, G, -200);
  ground.receiveShadow = true;
  group.add(ground);

  // Plataforma de la plaza (banqueta).
  clay.add(new THREE.BoxGeometry(x1 - x0, 0.25, z0 - z1), { x: cx, y: G + 0.125, z: cz });
  const top = G + 0.25;

  // Jardineras: 4 cuadrantes partidos por su diagonal → 8 triángulos, con andadores entre ellos.
  const path = 3; // medio ancho del andador en cruz
  const edge = 3.5; // andador perimetral
  const triangles = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const inner = new THREE.Vector2(cx + sx * path, cz + sz * path);
      const outer = new THREE.Vector2(sx > 0 ? x1 - edge : x0 + edge, sz > 0 ? z0 - edge : z1 + edge);
      // Esquinas del cuadrante y diagonal de la esquina exterior al centro.
      const a = new THREE.Vector2(inner.x, outer.y);
      const c = new THREE.Vector2(outer.x, inner.y);
      triangles.push(insetTriangle([a, outer, inner], 2.0));
      triangles.push(insetTriangle([outer, c, inner], 2.0));
    }
  }
  const planterH = 0.45;
  for (const tri of triangles) {
    const shape = new THREE.Shape(tri.map((v) => new THREE.Vector2(v.x, -v.y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: planterH, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); // la forma estaba en XY: la tumbamos al plano XZ
    clay.add(geo, { y: top });
  }
  // Glorieta central.
  clay.add(new THREE.CylinderGeometry(4.2, 4.4, 0.35, 12), { x: cx, y: top + 0.17, z: cz });
  clay.add(new THREE.CylinderGeometry(1.2, 1.4, 0.7, 8), { x: cx, y: top + 0.6, z: cz });

  // ---------------------------------------------------------------- laureles
  const trees = [];
  for (const tri of triangles) {
    const [a, b, c] = tri;
    const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
    const count = Math.max(1, Math.round(area / 70));
    let tries = 0;
    let placed = 0;
    while (placed < count && tries++ < 60) {
      let u = rand();
      let v = rand();
      if (u + v > 1) [u, v] = [1 - u, 1 - v];
      const p = a.clone().add(b.clone().sub(a).multiplyScalar(u)).add(c.clone().sub(a).multiplyScalar(v));
      if (trees.some((t) => t.p.distanceTo(p) < 7.5)) continue;
      trees.push({ p, r: 3.0 + rand() * 1.2, h: 4.4 + rand() * 1.3 });
      placed++;
    }
  }
  // Árboles en las banquetas laterales (la plaza tiene sombra por todas partes).
  for (let z = z0 - 4; z > z1 + 2; z -= 11) {
    for (const x of [x0 + 1.6, x1 - 1.6]) trees.push({ p: new THREE.Vector2(x, z + rand() * 3), r: 2.4 + rand() * 0.8, h: 4.0 + rand() });
  }

  // Copas: varias variantes de "nube" de arcilla, instanciadas. Giran solo en Y para que
  // la base aplanada quede siempre abajo.
  const variants = canopyGeometries(4, 5);
  const byVariant = variants.map(() => []);
  trees.forEach((t, i) => byVariant[i % variants.length].push(t));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  variants.forEach((geo, v) => {
    const list = byVariant[v];
    const im = new THREE.InstancedMesh(geo, mat.foliage, list.length);
    list.forEach((t, i) => {
      q.setFromAxisAngle(up, rand() * Math.PI * 2);
      m.compose(new THREE.Vector3(t.p.x, top + planterH + t.h, t.p.y), q, new THREE.Vector3(t.r * 1.15, t.r * 0.95, t.r * 1.15));
      im.setMatrixAt(i, m);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  });
  const trunks = new THREE.InstancedMesh(trunkGeometry(), mat.clay, trees.length);
  trees.forEach((t, i) => {
    const h = t.h + planterH;
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    m.compose(new THREE.Vector3(t.p.x, top, t.p.y), q, new THREE.Vector3(1, h, 1));
    trunks.setMatrixAt(i, m);
  });
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  trunks.computeBoundingSphere();
  group.add(trunks);

  // ---------------------------------------------------------------- farolas
  const lampPos = [];
  for (let x = x0 + 2; x <= x1 - 2; x += 12) {
    lampPos.push([x, z0 - 1.2], [x, z1 + 1.2]);
  }
  for (let z = z0 - 10; z > z1 + 6; z -= 13) lampPos.push([x0 + 1.2, z], [x1 - 1.2, z]);
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) lampPos.push([cx + dx * 5.5, cz + dz * 5.5]);

  const posts = new GeoBag();
  const globes = new GeoBag();
  const postGeo = new THREE.CylinderGeometry(0.05, 0.08, 3.6, 5);
  const globeGeo = new THREE.IcosahedronGeometry(0.24, 1);
  for (const [x, z] of lampPos) {
    posts.add(postGeo, { x, y: top + 1.8, z });
    globes.add(globeGeo, { x, y: top + 3.8, z });
  }
  group.add(clay.mesh(mat.clay));
  group.add(posts.mesh(mat.clay, { cast: false }));
  group.add(globes.mesh(mat.lamp, { cast: false, receive: false }));

  return { group };
}
