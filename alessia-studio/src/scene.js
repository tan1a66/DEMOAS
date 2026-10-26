import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import dracoWrapperUrl from 'three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?url';
import dracoWasmUrl from 'three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url';
import basisJsUrl from 'three/examples/jsm/libs/basis/basis_transcoder.js?url';
import basisWasmUrl from 'three/examples/jsm/libs/basis/basis_transcoder.wasm?url';
import manifest from '../assets/manifest.json';
import { makeConcreteMaterial, makeCushionMaterial, makeBeam, makeDust } from './materials.js';
import { createSea } from './sea.js';
import { createUnderwater } from './underwater.js';

// Asset generati dalla pipeline (npm run assets): GLB Draco + KTX2. Gli URL passano da Vite
// (hash nel build normale, incorporati nel build a file unico).
const ASSET_URLS = import.meta.glob('../assets/**/*.{glb,ktx2}', { query: '?url', import: 'default', eager: true });
const asset = (name) => ASSET_URLS[`../assets/${name}`];
const DECODERS = {
  'draco_wasm_wrapper.js': dracoWrapperUrl,
  'draco_decoder.wasm': dracoWasmUrl,
  'basis_transcoder.js': basisJsUrl,
  'basis_transcoder.wasm': basisWasmUrl,
};

const TILE = { formwork: 1.2, smooth: 2.0 };

export async function buildScene({ renderer, lights, quality, loader, art, artCam }) {
  const { manager } = loader;
  manager.setURLModifier((url) => (url.startsWith('decoders/') ? DECODERS[url.slice(9)] || url : url));
  for (const [name, url] of Object.entries(DECODERS)) loader.expect(url, manifest.files[`decoders/${name}`]);

  const texSize = quality.textureSize;
  const lmSize = quality.lightmapSize;
  const files = {
    glb: 'scene.glb',
    lightmap: `lightmap-${lmSize}.ktx2`,
    formwork: `tex/formwork-${texSize}.ktx2`,
    smooth: `tex/smooth-${texSize}.ktx2`,
  };
  for (const f of Object.values(files)) loader.expect(asset(f), manifest.files[f]);
  loader.setExtraSteps(2);

  const ktx2 = new KTX2Loader(manager).setTranscoderPath('decoders/').detectSupport(renderer);
  const draco = new DRACOLoader(manager).setDecoderPath('decoders/');
  const gltfLoader = new GLTFLoader(manager).setDRACOLoader(draco);
  const loadKTX = (f) => ktx2.loadAsync(asset(f), loader.progressFor(asset(f)));

  const [gltf, lightMap, formTex, smoothTex] = await Promise.all([
    gltfLoader.loadAsync(asset(files.glb), loader.progressFor(asset(files.glb))),
    loadKTX(files.lightmap),
    loadKTX(files.formwork),
    loadKTX(files.smooth),
  ]);
  draco.dispose();
  ktx2.dispose();

  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), quality.tier === 'low' ? 2 : 8);
  for (const t of [formTex, smoothTex]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
  }
  lightMap.minFilter = lightMap.magFilter = THREE.LinearFilter;
  lightMap.generateMipmaps = false;

  const scene = new THREE.Scene();
  const useShadowMap = quality.realtimeShadows;
  const shInt = useShadowMap ? lights.shadowUniforms(lights.shadows.int) : {};
  const byName = {};
  gltf.scene.traverse((o) => { if (o.isMesh) byName[o.name] = o; });

  const concrete = (name, form, interior) => {
    const mesh = byName[name];
    mesh.material = makeConcreteMaterial({
      map: form ? formTex : smoothTex,
      tileM: form ? TILE.formwork : TILE.smooth,
      interior,
      sun: interior ? 'int' : 'ext',
      lights,
      shadow: shInt,
      lightMap,
      shadowMap: interior && useShadowMap,
    });
    mesh.material.uniforms.uNormalStrength.value = form ? (interior ? 1.35 : 1.7) : 1.0;
    return mesh;
  };
  const meshes = {
    extForm: concrete('extForm', true, false),
    extSmooth: concrete('extSmooth', false, false),
    intForm: concrete('intForm', true, true),
    intSmooth: concrete('intSmooth', false, true),
  };
  const cushions = byName.cushions;
  cushions.material = makeCushionMaterial({ lights, shadow: shInt, shadowMap: useShadowMap });
  for (const m of [...Object.values(meshes), cushions]) {
    m.removeFromParent();
    if (m !== cushions) m.layers.enable(1); // visibili nel riflesso del mare
    m.matrixAutoUpdate = false;
    m.updateMatrixWorld(true);
    scene.add(m);
  }
  loader.stepDone();

  const sea = createSea(lights, { quality: quality.seaQuality, reflection: quality.reflection });
  scene.add(sea.mesh);
  const beam = makeBeam(lights);
  scene.add(beam);
  const dust = makeDust(lights, quality.tier === 'low' ? 220 : 420);
  scene.add(dust);

  // sott'acqua: la scultura, il banco di pesci, bollicine, pulviscolo, squaletti
  const underwater = createUnderwater(lights, { art, artCam, quality });
  scene.add(underwater.group);

  // ombre in tempo reale solo per il pit, e solo se il dispositivo lo permette (calcolate una volta)
  if (useShadowMap) lights.bakeShadows(renderer, [meshes.intSmooth, meshes.intForm, cushions]);
  loader.stepDone();

  const architecture = [...Object.values(meshes), cushions, beam, dust];
  function update(camera, dpr, time = 0) {
    sea.update(camera);
    dust.material.uniforms.uPixelRatio.value = dpr;
    underwater.update(camera, time, dpr);
    // sotto il pelo dell'acqua l'edificio non si vede (e non va disegnato)
    const above = camera.position.y > -0.05;
    for (const m of architecture) m.visible = above && m.userData.maskHidden !== true;
  }

  return { scene, update, sea, meshes, cushions, beam, dust, underwater };
}
