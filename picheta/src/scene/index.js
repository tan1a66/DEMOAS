// Escena completa: cielo, terraza, plaza, edificios, catedral y luces.
// `update(sky)` aplica la paleta del momento (ya suavizada) a cielo, luces y niebla.

import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { buildSky } from './sky.js';
import { buildTerrace } from './terrace.js';
import { buildPlaza } from './plaza.js';
import { buildBuildings } from './buildings.js';
import { buildCathedral } from './cathedral.js';

// La cámara mira al sur (acimut 180°) desde el lado norte de la plaza: la catedral queda a la
// izquierda y el sol se pone a la derecha. Comprimimos los acimuts reales para que el
// resplandor del atardecer entre en el encuadre (licencia artística, el orden se respeta:
// este a la izquierda, oeste a la derecha).
// La luz directa usa una compresión menor: llega más de lado y "pinta" las fachadas.
export const VIEW_BEARING = 180;
export const SKY_AZIMUTH_SCALE = 0.45;
export const LIGHT_AZIMUTH_SCALE = 0.85;

const deg = THREE.MathUtils.degToRad;

/** Dirección (hacia el astro) en coordenadas de escena a partir de altitud y acimut reales. */
export function skyDirection(altitude, azimuth, out = new THREE.Vector3(), scale = SKY_AZIMUTH_SCALE) {
  let rel = azimuth - VIEW_BEARING;
  if (rel > 180) rel -= 360;
  if (rel < -180) rel += 360;
  const a = deg(rel * scale);
  const e = deg(altitude);
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}

// Zona que cubre el mapa de sombras (terraza + plaza + catedral).
const SHADOW_BOX = new THREE.Box3(new THREE.Vector3(-42, -10, -122), new THREE.Vector3(42, 36, 4));
const NIGHT_LIGHT_DIR = new THREE.Vector3(-0.35, 0.85, 0.4).normalize();

export function createScene({ shadowMapSize }) {
  const scene = new THREE.Scene();
  const mat = createMaterials();

  const sky = buildSky();
  scene.add(sky.mesh);

  const terrace = buildTerrace(mat);
  const plaza = buildPlaza(mat);
  const buildings = buildBuildings(mat);
  const cathedral = buildCathedral(mat);
  scene.add(terrace.group, plaza.group, buildings.group, cathedral.group);
  scene.add(cathedral.flood, cathedral.flood.target);

  scene.fog = new THREE.FogExp2(new THREE.Color(), 0.0034);

  // ---------------------------------------------------------------- luces
  const hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1);
  scene.add(hemi);

  // Relleno suave desde detrás de la cámara (el cielo a nuestra espalda): sin él, las
  // fachadas que miran a la terraza quedarían siempre a contraluz.
  const fill = new THREE.DirectionalLight('#ffffff', 0);
  fill.position.set(-30, 40, 80);
  fill.target.position.set(0, -6, -60);
  scene.add(fill, fill.target);

  const sun = new THREE.DirectionalLight('#ffffff', 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.radius = 4; // sombras suaves (PCF con disco de Vogel)
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  sun.target.position.set(0, -6, -55);
  scene.add(sun, sun.target);

  const tmp = new THREE.Vector3();
  const lightDir = new THREE.Vector3(0, 1, 0);
  const lastShadowDir = new THREE.Vector3(0, -1, 0);
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
  const look = new THREE.Matrix4();

  /** Ajusta la cámara ortográfica de la sombra a SHADOW_BOX vista desde la luz. */
  function fitShadow() {
    sun.position.copy(sun.target.position).addScaledVector(lightDir, 200);
    sun.updateMatrixWorld();
    look.lookAt(sun.position, sun.target.position, Math.abs(lightDir.y) > 0.98 ? tmp.set(0, 0, 1) : tmp.set(0, 1, 0));
    look.setPosition(sun.position);
    const inv = look.clone().invert();
    const { min, max } = SHADOW_BOX;
    let i = 0;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      corners[i++].set(x, y, z).applyMatrix4(inv);
    }
    const box = new THREE.Box3().setFromPoints(corners);
    const cam = sun.shadow.camera;
    cam.left = box.min.x;
    cam.right = box.max.x;
    cam.bottom = box.min.y;
    cam.top = box.max.y;
    cam.near = Math.max(0.1, -box.max.z - 5);
    cam.far = -box.min.z + 5;
    cam.updateProjectionMatrix();
  }

  const c = new THREE.Color();
  const setSRGB = (color, rgb) => color.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);

  /**
   * @param {object} s  estado suavizado: palette (paletteAt), sunDir, lightDir, moonDir, moon, time
   * @param {THREE.WebGLRenderer} renderer
   */
  function update(s, renderer) {
    const p = s.palette;
    const u = sky.uniforms;
    setSRGB(u.uZenith.value, p.zenith);
    setSRGB(u.uMid.value, p.mid);
    setSRGB(u.uHorizon.value, p.horizon);
    setSRGB(u.uGlow.value, p.glow);
    setSRGB(u.uSunColor.value, p.sun);
    u.uSunDir.value.copy(s.sunDir);
    u.uSunDisc.value = THREE.MathUtils.smoothstep(s.sunDir.y, -0.02, 0.01);
    u.uStars.value = p.stars;
    u.uTime.value = s.time;
    u.uMoonDir.value.copy(s.moonDir);
    u.uMoonPhase.value = s.moon.phase;
    u.uMoonLight.value = s.moon.fraction;
    u.uMoon.value = THREE.MathUtils.smoothstep(s.moonDir.y, -0.02, 0.04) * (0.35 + 0.65 * p.windows);

    // Niebla = color del horizonte (con un poco del resplandor): la ciudad se funde con el cielo.
    setSRGB(scene.fog.color, p.horizon).lerp(setSRGB(c, p.glow), 0.4);
    scene.fog.density = p.fog;

    // Luz ambiental del cielo: es la que tiñe la piedra de naranja, rosa o azul.
    setSRGB(hemi.color, p.hemiSky);
    setSRGB(hemi.groundColor, p.hemiGround);
    hemi.intensity = p.hemiI;
    setSRGB(fill.color, p.hemiSky);
    fill.intensity = p.hemiI * 0.55;

    // Sol de día; de noche una luz de luna azulada y tenue desde arriba.
    const night = p.moonlight;
    if (p.sunI > 0.001 || night < 0.5) {
      lightDir.copy(s.lightDir);
      if (lightDir.y < 0.02) lightDir.y = 0.02; // evita luz rasante desde abajo
      lightDir.normalize();
      setSRGB(sun.color, p.sun);
      sun.intensity = p.sunI;
    } else {
      lightDir.copy(s.moonDir.y > 0.25 ? s.moonDir : NIGHT_LIGHT_DIR);
      sun.color.set('#9DB0E0');
      sun.intensity = night * (0.25 + 0.35 * s.moon.fraction);
    }
    // El mapa de sombras solo se recalcula cuando la luz se ha movido de verdad.
    if (lightDir.angleTo(lastShadowDir) > 0.0015) {
      lastShadowDir.copy(lightDir);
      fitShadow();
      renderer.shadowMap.needsUpdate = true;
    }
    sun.castShadow = sun.intensity > 0.02;

    // Guirnaldas, faroles y ventanas: se encienden poco a poco con la puesta.
    const L = p.lanterns;
    const flicker = 1 + 0.05 * Math.sin(s.time * 7.1) + 0.035 * Math.sin(s.time * 12.7 + 1.3);
    mat.bulb.emissiveIntensity = 0.12 + L * 3.4; // de día, un leve brillo de cristal
    mat.lantern.emissiveIntensity = 0.08 + L * 1.6 * flicker;
    mat.lamp.emissiveIntensity = L * 3.0;
    mat.windowLit.emissiveIntensity = p.windows * 0.95;
    terrace.lights.forEach((l) => (l.intensity = L * 2.6));
    terrace.candle.intensity = L * 0.35 * flicker;
    cathedral.flood.intensity = p.windows * 70;

    renderer.toneMappingExposure = p.exposure;
  }

  return { scene, sky, update, materials: mat };
}
