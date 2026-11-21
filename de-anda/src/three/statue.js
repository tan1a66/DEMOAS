// =============================================================================
//  statue.js — caricamento del modello, materiali, zone interattive
// =============================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshBVH } from 'three-mesh-bvh';
import { createMarbleMaterial, figureUniforms } from './materials.js';
import { ZONES } from '../config.js';

/** Scarica il GLB (Draco) e riporta l'avanzamento 0..1. */
export function loadModel(url, onProgress) {
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        draco.dispose();
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
    figureUniforms.uZones.value[i].set(center.x, center.y, center.z, radius);
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

/** Intensità del bagliore di ciascuna zona (0..1), animata da procedures.js */
export function setZoneAmount(index, amount) {
  const v = figureUniforms.uZoneAmt.value;
  v.setComponent(index, amount);
}
