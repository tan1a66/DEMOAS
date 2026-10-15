// ─────────────────────────────────────────────────────────────────────────────
//  Il mondo dopo l'apertura: terreno, campo di henequén, hacienda,
//  vegetazione, scenografie delle sezioni, luci della sera e le epoche
//  (Antes → Hoy) che cambiano il paesaggio con la linea del tempo.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createMaterials, groundMaterial } from './materials.js';
import { buildHacienda, SITE } from './hacienda.js';
import { createField, createVegetation, FIELD } from './vegetation.js';
import { createProps, EVENT } from './props.js';
import { createEpochs, GARDEN_CENTER } from './epochs.js';

export function createWorld(quality) {
  const uniforms = {
    uNight: { value: 0 }, // 0 giorno → 1 notte (finestre, lanterne)
    uLights: { value: 0 }, // fili di lucine del ricevimento
    uTime: { value: 0 },
    // epoche (Antes → Hoy), vedi era.js
    uRuin: { value: 0 }, // muri in rovina
    uField: { value: 1 }, // solchi del henequén
    uWild: { value: 0 }, // monte cresciuto
    uClear: { value: 0 }, // monte tagliato attorno alla casa
    uGarden: { value: 0 }, // prato di oggi
  };
  const mats = createMaterials(uniforms);
  const group = new THREE.Group();

  // terreno unico con le sue zone (terra rossa, strada, cortile, prati)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    groundMaterial({
      road: new THREE.Vector4(SITE.roadX, 1.3, SITE.gateZ - 2, 40),
      court: new THREE.Vector4(SITE.courtMinX, SITE.courtMaxX, SITE.casaZ - 6, SITE.gateZ - 0.5),
      lawnA: new THREE.Vector4(EVENT.x - 7.5, EVENT.x + 7, EVENT.z - 6.5, EVENT.z + 6.5),
      lawnB: new THREE.Vector4(9, 26, -88, -66),
      rowStep: FIELD.rowStep,
      gardenCenter: GARDEN_CENTER,
    }, uniforms),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const field = createField(quality);
  group.add(field.mesh);

  const hacienda = buildHacienda(mats);
  group.add(hacienda.group);
  group.updateMatrixWorld(true);

  const vegetation = createVegetation(quality, mats, uniforms);
  group.add(vegetation);
  const props = createProps(quality, mats, uniforms, hacienda);
  group.add(props.group);
  const epochs = createEpochs(quality, mats, uniforms, { modern: vegetation.userData.modern });
  group.add(epochs.group);

  return {
    group,
    ground,
    uniforms,
    field,
    update(time, mood, era) {
      uniforms.uTime.value = time;
      uniforms.uNight.value = mood.night;
      uniforms.uLights.value = mood.lights;
      field.uniforms.uTime.value = time;
      props.update(mood.night);
      // l'epoca
      uniforms.uRuin.value = era.ruin;
      uniforms.uField.value = era.field;
      uniforms.uWild.value = era.wild;
      uniforms.uClear.value = era.clear;
      uniforms.uGarden.value = era.garden;
      field.uniforms.uWither.value = era.wither;
      field.mesh.visible = era.wither < 1.44;
      epochs.update(era);
    },
  };
}

export { SITE };
