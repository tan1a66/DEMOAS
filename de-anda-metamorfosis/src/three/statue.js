// =============================================================================
//  statue.js — caricamento della Venere, materiale, zone interattive
// =============================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshBVH } from 'three-mesh-bvh';
import { createFigureMaterial, figureUniforms } from './materials.js';
import { setupDecoder } from './model-source.js';
import { ZONES } from '../config.js';
import { LAYOUT } from './temple.js';

/** Scarica il GLB e riporta l'avanzamento 0..1. */
export function loadModel(url, onProgress) {
  const loader = new GLTFLoader();
  const dispose = setupDecoder(loader);
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        dispose();
        resolve(gltf);
      },
      (e) => {
        if (e.lengthComputable && e.total) onProgress(e.loaded / e.total);
      },
      reject
    );
  });
}

/**
 * Le versioni quantizzate (anteprima meshopt) hanno posizioni intere e una scala
 * sul nodo: qui si riportano in coordinate del modello, in float, nodo neutro.
 */
function bakeToModelSpace(mesh) {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  mesh.updateMatrix();
  if (pos.array instanceof Float32Array && !pos.normalized && mesh.matrix.equals(new THREE.Matrix4())) return;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    arr[i * 3] = pos.getX(i);
    arr[i * 3 + 1] = pos.getY(i);
    arr[i * 3 + 2] = pos.getZ(i);
  }
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('normal');
  g.applyMatrix4(mesh.matrix);
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
  mesh.updateMatrix();
}

export function createStatue(gltf, { physical, lowQuality }) {
  // il nodo con i dati scritti da optimize-model.mjs
  let root = null;
  gltf.scene.traverse((o) => {
    if (!root && o.userData && o.userData.bboxMin) root = o;
  });
  if (!root) throw new Error('Modello senza dati: rigenera i modelli con npm run models');
  const meta = root.userData;
  let figure = null;
  root.traverse((o) => {
    if (!figure && o.isMesh) figure = o;
  });
  bakeToModelSpace(figure);
  const g = figure.geometry;
  g.computeVertexNormals();
  // occlusione per vertice (se manca: tutto chiaro)
  if (!g.attributes._ao) g.setAttribute('_ao', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(1), 1));
  figure.material = createFigureMaterial({ physical, lowQuality });
  figure.castShadow = true;
  figure.receiveShadow = true;
  g.boundsTree = new MeshBVH(g);

  // la statua sta sul piedistallo e può girare su sé stessa (03 · El doctor)
  const pivot = new THREE.Group();
  pivot.name = 'statue-pivot';
  pivot.position.y = LAYOUT.PLINTH_TOP;
  pivot.add(root);

  // ---- zone: dal bounding box relativo (config) alle coordinate del modello ----
  const bmin = new THREE.Vector3(...meta.bboxMin);
  const bsize = new THREE.Vector3(...meta.bboxMax).sub(bmin);
  const ray = new THREE.Ray();
  const hit = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
  const zones = ZONES.map((z, i) => {
    const center = new THREE.Vector3(...z.center).multiply(bsize).add(bmin);
    const radius = z.radius * meta.height;
    // punto cliccabile: il primo punto di superficie visto dalla vista frontale
    const from = center.clone().add(new THREE.Vector3(-0.2, 0.12, 1).normalize().multiplyScalar(4));
    ray.set(from, center.clone().sub(from).normalize());
    const first = g.boundsTree.raycastFirst(ray, THREE.DoubleSide);
    let anchor;
    if (first) anchor = first.point.clone();
    else {
      g.boundsTree.closestPointToPoint(center, hit);
      anchor = hit.point.clone();
    }
    // il bagliore è centrato sul punto di superficie, appena dentro
    const glowAt = anchor.clone().lerp(center, Math.min(1, 0.03 / Math.max(anchor.distanceTo(center), 1e-4)));
    figureUniforms.uZones.value[i].set(glowAt.x, glowAt.y, glowAt.z, radius);
    return { ...z, index: i, center, radius, anchor };
  });

  return {
    object: pivot,
    root,
    figure,
    meta,
    zones,
    /** posizione nel mondo di un punto del modello */
    toWorld(v, out = new THREE.Vector3()) {
      return root.localToWorld(out.copy(v));
    },
    setPolish(v) {
      figureUniforms.uPolish.value = v;
    },
    setSpin(radians) {
      pivot.rotation.y = radians;
    },
  };
}

/** Intensità del bagliore di ciascuna zona (0..1), animata da procedures.js */
export function setZoneAmount(index, amount) {
  figureUniforms.uZoneAmt.value.setComponent(index, amount);
}
