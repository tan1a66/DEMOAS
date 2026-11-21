// =============================================================================
//  statue.js — caricamento del modello, materiali, zone interattive
// =============================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setupDecoder } from './model-source.js';
import { MeshBVH } from 'three-mesh-bvh';
import { createMarbleMaterial, figureUniforms } from './materials.js';
import { ZONES } from '../config.js';

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

export function createStatue(gltf, { physical, lowQuality }) {
  // il nodo con i dati scritti da optimize-model.mjs (bounding box, sedile…)
  let root = null;
  gltf.scene.traverse((o) => {
    if (!root && o.userData && o.userData.bboxMin) root = o;
  });
  if (!root) throw new Error('Modello senza dati: rigenera i modelli con npm run models');
  const meta = root.userData;
  const figure = root.getObjectByName('figure');
  const seat = root.getObjectByName('seat');

  for (const mesh of [figure, seat]) {
    bakeToModelSpace(mesh);
    mesh.geometry.computeVertexNormals();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  figure.material = createMarbleMaterial({ kind: 'figure', physical, lowQuality });
  seat.material = createMarbleMaterial({ kind: 'seat', lowQuality });
  // BVH: serve ai frammenti (distanza dalla superficie) e ai punti cliccabili
  figure.geometry.boundsTree = new MeshBVH(figure.geometry);

  // La statua gira attorno al centro del busto (03 · El doctor)
  const pivot = new THREE.Group();
  pivot.name = 'statue-pivot';
  const pivotPoint = new THREE.Vector3(0, 0, -0.35);
  pivot.position.copy(pivotPoint);
  const holder = new THREE.Group();
  holder.position.copy(pivotPoint).multiplyScalar(-1);
  holder.add(root);
  pivot.add(holder);

  // ---- zone: dal bounding box relativo (config) alle coordinate del modello ----
  const bmin = new THREE.Vector3(...meta.bboxMin);
  const bsize = new THREE.Vector3(...meta.bboxMax).sub(bmin);
  const H = meta.height;
  const hit = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
  const ray = new THREE.Ray();
  const zones = ZONES.map((z, i) => {
    const center = new THREE.Vector3(...z.center).multiply(bsize).add(bmin);
    const radius = z.radius * H;
    // punto cliccabile: il primo punto della superficie visto dalla vista
    // frontale (04) lungo la linea verso il centro della zona
    const from = center.clone().add(new THREE.Vector3(0.28, 0.12, 1).normalize().multiplyScalar(4));
    ray.set(from, center.clone().sub(from).normalize());
    const first = figure.geometry.boundsTree.raycastFirst(ray, THREE.DoubleSide);
    let anchor;
    if (first) anchor = first.point.clone();
    else {
      figure.geometry.boundsTree.closestPointToPoint(center, hit);
      anchor = hit.point.clone();
    }
    // il bagliore è centrato sul punto di superficie, appena dentro: così si vede
    // sempre come una macchia di luce attorno al punto cliccabile
    const glowAt = anchor.clone().lerp(center, Math.min(1, 0.03 / Math.max(anchor.distanceTo(center), 1e-4)));
    figureUniforms.uZones.value[i].set(glowAt.x, glowAt.y, glowAt.z, radius);
    return { ...z, index: i, center, radius, anchor };
  });

  // la macchia d'ombra a terra copre sedile + figura
  const footprint = { x: bsize.x * 1.25, z: bsize.z * 1.08, cx: (meta.bboxMin[0] + meta.bboxMax[0]) / 2, cz: (meta.bboxMin[2] + meta.bboxMax[2]) / 2 };

  return {
    object: pivot,
    root,
    figure,
    seat,
    meta,
    zones,
    footprint,
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

/**
 * Le versioni quantizzate (anteprima meshopt) hanno posizioni intere e una scala
 * sul nodo: qui si riportano in coordinate del modello, in float, con il nodo
 * neutro. Lo shader del marmo, le zone e la BVH lavorano in queste coordinate.
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

/** Intensità del bagliore di ciascuna zona (0..1), animata da procedures.js */
export function setZoneAmount(index, amount) {
  const v = figureUniforms.uZoneAmt.value;
  v.setComponent(index, amount);
}
