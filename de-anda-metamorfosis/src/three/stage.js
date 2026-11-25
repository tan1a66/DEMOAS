// =============================================================================
//  stage.js — renderer, luci, nebbia, riflessi
// =============================================================================
//  Luci:
//  - sole: luce direzionale calda da dietro, con ombre (archi e colonne a terra)
//  - "gobo": faretto con la sagoma di rami d'ulivo, ombre di foglie sulla statua
//    (le sue ombre sono anche quelle precise della statua su sé stessa)
//  - riempimento frontale morbido e luce d'ambiente cielo/terra

import * as THREE from 'three';
import { COLORS } from '../config.js';

/** Rami d'ulivo disegnati su canvas: nero = ombra delle foglie */
function oliveCookie(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, size, size);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.strokeStyle = g.fillStyle = 'rgba(0,0,0,0.8)';
  g.lineCap = 'round';
  // rami che attraversano tutto il disegno: le foglie cadono anche sulla statua
  const branches = [];
  for (let i = 0; i < 9; i++) {
    const x0 = rnd(), y0 = rnd();
    const ang = rnd() * Math.PI * 2, len = 0.35 + rnd() * 0.35;
    branches.push([x0, y0, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len]);
  }
  for (const [x0, y0, x1, y1] of branches) {
    const cx = (x0 + x1) / 2 + (rnd() - 0.5) * 0.2, cy = (y0 + y1) / 2 + (rnd() - 0.5) * 0.2;
    g.lineWidth = size * 0.005;
    g.beginPath();
    g.moveTo(x0 * size, y0 * size);
    g.quadraticCurveTo(cx * size, cy * size, x1 * size, y1 * size);
    g.stroke();
    // foglie lungo il ramo: ellissi strette, non troppo fitte (passa luce)
    for (let t = 0.04; t < 1; t += 0.045) {
      const it = 1 - t;
      const px = it * it * x0 + 2 * it * t * cx + t * t * x1;
      const py = it * it * y0 + 2 * it * t * cy + t * t * y1;
      for (const s of [-1, 1]) {
        if (rnd() < 0.35) continue;
        const a2 = Math.atan2(y1 - y0, x1 - x0) + s * (0.45 + rnd() * 0.6);
        const len2 = size * (0.03 + rnd() * 0.028);
        g.save();
        g.translate(px * size, py * size);
        g.rotate(a2);
        g.beginPath();
        g.ellipse(len2 * 0.55, 0, len2 * 0.55, len2 * 0.12, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  }
  // bordi morbidi (ombre lontane, sfocate)
  const blur = document.createElement('canvas');
  blur.width = blur.height = size;
  const b = blur.getContext('2d');
  b.filter = 'blur(2.5px)';
  b.drawImage(c, 0, 0);
  const tex = new THREE.CanvasTexture(blur);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createStage(canvas, quality) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.setClearColor(new THREE.Color(COLORS.ivory), 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // lo fanno i materiali (materials.js)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // le ombre si calcolano una volta per frame (non di nuovo nel riflesso dell'acqua)
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color(COLORS.ivory), 0.02);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 90);

  // ---- luci ----
  const hemi = new THREE.HemisphereLight(new THREE.Color('#f4f1ec'), new THREE.Color('#c9bba8'), 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(new THREE.Color('#ffe6c4'), 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  const gobo = new THREE.SpotLight(new THREE.Color('#fff1dc'), 0, 0, 0.42, 0.55, 0);
  gobo.castShadow = true;
  gobo.map = oliveCookie();
  gobo.shadow.mapSize.set(quality.goboShadow, quality.goboShadow);
  gobo.shadow.bias = -0.0004;
  gobo.shadow.normalBias = 0.02;
  gobo.shadow.camera.near = 3;
  gobo.shadow.camera.far = 20;
  scene.add(gobo, gobo.target);

  const fill = new THREE.DirectionalLight(new THREE.Color('#f7f2ea'), 0.6);
  scene.add(fill, fill.target);

  // ---- riflessi: ambiente generato dal cielo (aggiornato da main.js) ----
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = new THREE.Vector3(0, 1.7, 0);
  const tmp = new THREE.Vector3();
  const az = (deg) => THREE.MathUtils.degToRad(deg);

  return {
    renderer,
    scene,
    camera,
    lights: { hemi, sun, gobo, fill },

    /** Riflessi del marmo dal cielo attuale (costa: solo ogni tanto) */
    bakeEnvironment(skyMesh) {
      const envScene = new THREE.Scene();
      const clone = skyMesh.clone();
      envScene.add(clone);
      const rt = pmrem.fromScene(envScene, 0, 0.1, 100);
      if (scene.environment) scene.environment.dispose?.();
      scene.environment = rt.texture;
      scene.environmentIntensity = 0.55;
    },

    /** Applica uno stato luci (vedi LIGHTS in drone-path.js) */
    applyLights(state, cameraPos, time) {
      const sunDir = state.sunDir;
      sun.position.copy(target).addScaledVector(sunDir, 25);
      sun.target.position.copy(target);
      sun.intensity = state.sunIntensity;
      sun.color.copy(state.sunColor);
      // il gobo segue il sole ma dal lato davanti, e oscilla appena (foglie nel vento)
      const ga = az(state.goboAz), ge = az(state.goboEl);
      gobo.position.set(
        target.x + Math.cos(ge) * Math.sin(ga) * 9 + Math.sin(time * 0.35) * 0.08,
        target.y + Math.sin(ge) * 9,
        target.z + Math.cos(ge) * Math.cos(ga) * 9 + Math.cos(time * 0.27) * 0.08
      );
      gobo.target.position.copy(target);
      gobo.intensity = state.gobo * 3.2;
      gobo.color.copy(state.sunColor);
      // riempimento: dal lato della camera, morbido
      tmp.subVectors(cameraPos, target).setY(0).normalize();
      fill.position.copy(target).addScaledVector(tmp, 6).setY(target.y + 3);
      fill.target.position.copy(target);
      fill.intensity = state.fill;
      hemi.intensity = state.ambient;
      scene.fog.density = state.fog;
      scene.fog.color.copy(state.horizon);
    },

    setSize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
    },
  };
}
