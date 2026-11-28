import * as THREE from 'three';
import { U } from './uniforms.js';
import { createSand, createWater, createSky } from './environment.js';
import { createShell } from './shell.js';
import { PhotoPass } from './photoPass.js';
import { Caustics, Ripples } from './caustics.js';
import { CONFIG } from '../config.js';
import { ENV } from '../core/env.js';
import { MATCH_CUT } from '../story/matchcut.js';
import { matchcutLabel } from '../core/assets.js';

const DEG = THREE.MathUtils.DEG2RAD;

// Construye la escena de la playa: cielo, arena, ola, concha y el pase de la foto.
export const createWorld = async (stage) => {
  const { scene, renderer } = stage;
  const size = ENV.mobile ? CONFIG.caustics.textureSize.mobile : CONFIG.caustics.textureSize.desktop;
  const caustics = new Caustics(renderer, size);
  const ripples = new Ripples();

  const sky = createSky();
  const sand = createSand();
  const water = createWater();
  const shell = await createShell();
  const photo = new PhotoPass();
  scene.add(sky, sand, shell, water, photo.mesh);

  const applyShellTransform = () => {
    const s = MATCH_CUT.shell;
    shell.scale.setScalar(s.scale);
    shell.rotation.set(s.rotation[0] * DEG, s.rotation[1] * DEG, s.rotation[2] * DEG, 'YXZ');
    shell.position.fromArray(s.position);
    shell.updateMatrixWorld(true);
    // huella aproximada sobre la arena (sombra, espuma, humedad)
    U.uShellFoot.value.set(s.position[0], s.position[2], 0.4 * s.scale, 1.06 * s.scale);
  };
  applyShellTransform();

  // ── Segmento de reemplazo de spires-sky.jpg: el propio 3D en versión "plana",
  //    visto por la cámara de la foto, con un rótulo y las zonas iPhone / 16:9.
  const PLACEHOLDER_ASPECT = 3 / 4; // vertical, como una foto de iPhone
  let placeholderRT = null;
  const placeholderCam = new THREE.PerspectiveCamera(MATCH_CUT.camera.fov, PLACEHOLDER_ASPECT, 0.03, 200);
  const renderPlaceholder = (label) => {
    if (!placeholderRT) {
      placeholderRT = new THREE.WebGLRenderTarget(1200, Math.round(1200 / PLACEHOLDER_ASPECT), {
        samples: 4,
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
      });
    }
    const c = MATCH_CUT.camera;
    placeholderCam.fov = c.fov;
    placeholderCam.updateProjectionMatrix();
    placeholderCam.position.fromArray(c.position);
    placeholderCam.rotation.set(c.rotation[0] * DEG, c.rotation[1] * DEG, c.rotation[2] * DEG, 'YXZ');
    placeholderCam.updateMatrixWorld(true);
    sky.position.copy(placeholderCam.position);
    const wasVisible = photo.mesh.visible;
    photo.mesh.visible = false;
    water.visible = false;
    U.uFlat.value = 1;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(placeholderRT);
    renderer.render(scene, placeholderCam);
    renderer.setRenderTarget(prev);
    U.uFlat.value = 0;
    water.visible = true;
    photo.mesh.visible = wasVisible;
    photo.setPhoto(placeholderRT.texture, PLACEHOLDER_ASPECT, { placeholder: true, label });
  };

  const usePlaceholder = (note) => {
    const label = matchcutLabel('spires-sky.jpg', PLACEHOLDER_ASPECT, note);
    renderPlaceholder(label);
    return label;
  };

  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  // punto de la arena bajo el puntero (para las ondas de las cáusticas)
  const pickGround = (clientX, clientY) => {
    ndc.set((clientX / stage.width) * 2 - 1, -(clientY / stage.height) * 2 + 1);
    raycaster.setFromCamera(ndc, stage.camera);
    return raycaster.ray.intersectPlane(ground, hit) ? hit : null;
  };

  return {
    scene,
    sky,
    sand,
    water,
    shell,
    photo,
    caustics,
    ripples,
    applyShellTransform,
    usePlaceholder,
    renderPlaceholder,
    pickGround,
  };
};
