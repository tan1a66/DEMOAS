// Plantas reales del patio: modelos escaneados de Poly Haven (CC0) — anthurium (hojas grandes, como los
// filodendros de las fotos), calathea orbifolia y helecho. Cada variante se dibuja instanciada.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { patch } from './core.js';

const URLS = {
  anthurium: new URL('../assets/plants/anthurium_botany_01.glb', import.meta.url).href,
  calathea: new URL('../assets/plants/calathea_orbifolia_01.glb', import.meta.url).href,
  fern: new URL('../assets/plants/fern_02.glb', import.meta.url).href,
  tree: new URL('../assets/plants/pachira_aquatica_01.glb', import.meta.url).href,
};

// [tipo, x, z, escala, giro] — arriates junto a los muros, según las fotos de Casa Skoura
const LAYOUT = [
  // muro oeste
  ['anthurium', -2.2, -3.45, 1.9, 0.4], ['calathea', -2.15, -2.6, 1.9, 1.2], ['fern', -2.2, -1.85, 1.9, 2.0],
  ['anthurium', -2.2, -0.95, 1.7, 2.6], ['calathea', -2.15, -0.05, 2.0, 0.3], ['fern', -2.2, 0.75, 2.0, 1.1],
  ['calathea', -2.2, 1.55, 2.1, 2.2],
  // junto a la casa sur (plátano y filodendro grandes)
  ['anthurium', -2.05, 3.4, 2.5, 1.0], ['anthurium', -1.6, 3.95, 2.1, 3.6], ['fern', -0.6, 4.05, 1.7, 0.2],
  // muro este
  ['anthurium', 2.15, -3.35, 1.9, 2.9], ['fern', 2.2, -2.45, 1.9, 0.8], ['calathea', 2.2, -1.65, 1.6, 1.9],
  ['fern', 2.25, 0.75, 1.7, 2.4], ['anthurium', 2.2, 1.35, 1.5, 0.1],
  // al norte, entre la grava y las ruinas
  ['fern', -1.15, -4.15, 1.5, 0.6], ['fern', 1.35, -4.2, 1.4, 1.7], ['calathea', -1.55, -3.75, 1.5, 0.9],
  // alberi veri (pachira aquatica, Poly Haven CC0) sulle terrazze — [tipo, x, z, scala, giro, quota]
  ['tree', -6.0, 2.6, 3.6, 0.3, 0], ['tree', 7.2, -6.2, 3.2, 2.0, 0], ['tree', -6.4, -4.6, 2.7, 4.1, 0], ['tree', 6.8, 5.6, 2.6, 1.2, 0],
  ['tree', 26.6, 3.6, 2.8, 0.7, 3.2], ['tree', 19.4, -4.6, 2.5, 2.6, 3.2], ['tree', 27.0, -11.0, 2.6, 1.4, 7.6],
  // macchie di verde ai piedi degli alberi
  ['anthurium', -6.2, 3.1, 1.6, 0.4], ['fern', -5.0, 1.6, 1.6, 2.2], ['calathea', 7.0, -4.9, 1.6, 1.1], ['fern', 6.0, 6.6, 1.5, 0.3],
];

function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export async function buildPlants3D(parent, manager) {
  const loader = new GLTFLoader(manager);
  const kinds = {};
  await Promise.all(Object.entries(URLS).map(async ([name, url]) => {
    const gltf = await loader.loadAsync(url);
    const variants = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      geo.computeBoundingBox();
      const b = geo.boundingBox;
      // le piante piccole sono varianti separate (si centrano); l'albero ha 4 varianti affiancate (a–d),
      // ognuna fatta di tronco + foglie: si riporta ogni variante all'origine e si tengono insieme le sue parti
      if (name !== 'tree') geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      else { const wp = o.getWorldPosition(new THREE.Vector3()); geo.translate(-wp.x, 0, -wp.z); }
      const mat = o.material;
      mat.side = THREE.DoubleSide;
      if (!mat.userData.patched) {
        mat.envMapIntensity = 0.7;
        patch(mat, { key: 'plant_' + name, gobo: true, reveal: true, grain: true });
        mat.userData.patched = true;
      }
      variants.push({ geo, mat, variant: o.name.slice(-1) });
    });
    kinds[name] = variants;
  }));

  const R = rnd(17);
  const byVariant = new Map();
  for (const [kind, x, z, s, rot, y = 0] of LAYOUT) {
    const vs = kinds[kind];
    const sc = s * (0.9 + R() * 0.2);
    let parts;
    if (kind === 'tree') { const keys = [...new Set(vs.map((v) => v.variant))]; const k = keys[Math.floor(R() * keys.length)]; parts = vs.filter((v) => v.variant === k); }
    else parts = [vs[Math.floor(R() * vs.length)]];
    for (const v of parts) {
      if (!byVariant.has(v)) byVariant.set(v, []);
      byVariant.get(v).push({ x, y, z, s: sc, rot, whole: kind === 'tree' });
    }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const [v, list] of byVariant) {
    const im = new THREE.InstancedMesh(v.geo, v.mat, list.length);
    list.forEach((p, i) => {
      q.setFromAxisAngle(up, p.rot);
      m4.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
      im.setMatrixAt(i, m4);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.name = 'plantas';
    parent.add(im);
  }
}
