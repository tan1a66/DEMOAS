import * as THREE from 'three';
import { CameraRig } from '../../../src/scene/cameraRig.js';
import { ATMO, Atmosphere, buildSky, waterMaterial } from './atmosphere.js';
import { buildBuilding } from './building.js';
import { buildSite } from './site.js';
import { cutPlane, CUT_OFF, setCutY } from './materials.js';

// Escena del hotel (metros). Devuelve todo lo que la interfaz necesita controlar.
export function buildHotelScene({ renderer, canvas, resolution, quality }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe8bb9a, 130, 820);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 2500);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(quality.shadowMap);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 10, far: 420 });
  sun.target.position.set(0, 0, -20);
  // Luz cálida que acompaña a la cámara dentro de un departamento (apagada fuera).
  const inner = new THREE.PointLight(0xffc98f, 0, 13, 1.4);
  scene.add(hemi, sun, sun.target, inner);

  const sky = buildSky();
  scene.add(sky);

  // Mapa de entorno a partir del cielo (reflejos del vidrio).
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(sky.geometry, sky.material));
  let envRT = pmrem.fromScene(envScene, 0.02);
  const env = envRT.texture;
  // Luz ambiental basada en imagen: todo el entorno se ilumina con el cielo del momento.
  scene.environment = env;
  scene.environmentIntensity = 0.75;

  const water = waterMaterial();
  const building = buildBuilding({ envMap: env, water, resolution, lite: quality.mobile });
  scene.add(building.group);
  const site = buildSite({ water, envMap: env });
  scene.add(site.group);

  const all = [...building.levels.map((l) => l.mats), building.core.mats];
  const refreshEnv = () => {
    const next = pmrem.fromScene(envScene, 0.02);
    for (const mats of all) for (const m of Object.values(mats)) if (m.envMap) m.envMap = next.texture;
    building.core.signMat.envMap = next.texture;
    scene.environment = next.texture;
    envRT.dispose();
    envRT = next;
  };

  const rig = new CameraRig(camera, canvas);
  Object.assign(rig.controls, { maxPolarAngle: 1.48, minDistance: 6, maxDistance: 420, enabled: false });

  const atmo = new Atmosphere({ scene, sun, hemi, renderer, onEnv: refreshEnv });

  const update = (t, dt) => {
    ATMO.uTime.value = t;
    // Luces de ventanas: dependen de la hora y del piso resaltado.
    for (const l of building.levels) {
      const glow = Math.max(atmo.windows, (l.focus ?? 0) * 0.9);
      l.mats.light.color.setScalar(glow * 1.25);
      l.mats.lamp.color.setRGB(1, 0.74, 0.46).multiplyScalar(0.6 + atmo.windows * 1.4 + (l.lampBoost ?? 0));
      l.shell.material.uniforms.uTime.value = t;
    }
    building.core.signMat.emissiveIntensity = atmo.state.night * 1.6;
    const lamps = site.group.children.at(-1).userData.lamps;
    if (lamps) lamps.visible = atmo.state.night > 0.15;
  };

  return {
    scene, camera, rig, building, site, atmo, sky, inner, sun, update,
    setCut(y) {
      setCutY(y ?? CUT_OFF);
    },
    get cut() {
      return cutPlane.constant;
    },
  };
}
