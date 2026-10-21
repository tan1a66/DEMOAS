import * as THREE from 'three';
import { buildArchitecture } from './scene/architecture.js';
import { buildCushions } from './scene/cushions.js';
import { makeConcreteMaterial, makeCushionMaterial, makeBeam, makeDust } from './materials.js';
import { createSea } from './sea.js';
import TexWorker from './textures/worker.js?worker&inline';

function generateTexture(kind, size) {
  return new Promise((resolve, reject) => {
    const w = new TexWorker();
    w.onmessage = (e) => {
      w.terminate();
      const { data, size: s, tileM } = e.data;
      const tex = new THREE.DataTexture(data, s, s, THREE.RGBAFormat, THREE.UnsignedByteType);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.colorSpace = THREE.NoColorSpace;
      tex.needsUpdate = true;
      resolve({ tex, tileM });
    };
    w.onerror = reject;
    w.postMessage({ kind, size });
  });
}

export async function buildScene({ renderer, lights, quality, loader }) {
  loader.setExtraSteps(4);
  const [form, smooth] = await Promise.all([
    generateTexture('form', quality.textureSize).then((t) => (loader.stepDone(), t)),
    generateTexture('smooth', quality.textureSize).then((t) => (loader.stepDone(), t)),
  ]);
  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), quality.tier === 'low' ? 2 : 8);
  form.tex.anisotropy = smooth.tex.anisotropy = aniso;

  const scene = new THREE.Scene();
  const arch = buildArchitecture();
  const cushionsGeo = buildCushions();
  loader.stepDone();

  const shExt = lights.shadowUniforms(lights.shadows.ext);
  const shInt = lights.shadowUniforms(lights.shadows.int);
  const mk = (geo, map, interior) => {
    const mat = makeConcreteMaterial({
      map: map.tex, tileM: map.tileM, interior, sun: interior ? 'int' : 'ext', lights,
      shadow: interior ? shInt : shExt,
    });
    mat.uniforms.uNormalStrength.value = map === form ? (interior ? 1.35 : 1.7) : 1.0;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrixWorld();
    scene.add(mesh);
    return mesh;
  };
  const meshes = {
    extForm: mk(arch.extForm, form, false),
    extSmooth: mk(arch.extSmooth, smooth, false),
    intForm: mk(arch.intForm, form, true),
    intSmooth: mk(arch.intSmooth, smooth, true),
  };
  const cushions = new THREE.Mesh(cushionsGeo, makeCushionMaterial({ lights, shadow: shInt }));
  cushions.matrixAutoUpdate = false;
  cushions.updateMatrixWorld();
  scene.add(cushions);

  const sea = createSea(lights, { quality: quality.seaQuality });
  scene.add(sea.mesh);
  const beam = makeBeam(lights);
  scene.add(beam);
  const dust = makeDust(lights, quality.tier === 'low' ? 220 : 420);
  scene.add(dust);

  const all = [...Object.values(meshes), cushions];
  lights.bakeShadows(renderer, all, [meshes.intSmooth, meshes.intForm, cushions]);
  loader.stepDone();

  function update(camera, dpr) {
    sea.update(camera);
    dust.material.uniforms.uPixelRatio.value = dpr;
  }

  return { scene, update, sea, meshes, cushions };
}
