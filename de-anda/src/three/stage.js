// =============================================================================
//  stage.js — renderer, sfondo avorio, pavimento, luci
// =============================================================================

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COLORS } from '../config.js';
import { createShadowFloorMaterial } from './materials.js';

// ---------------------------------------------------------------------------
//  Sfondo: avorio con una sfumatura taupe che segue la statua sullo schermo.
//  Disegnato per primo, a tutto schermo, senza toccare la profondità.
// ---------------------------------------------------------------------------
const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;

const BG_FRAG = /* glsl */ `
uniform vec3 uIvory;
uniform vec3 uTaupe;
uniform vec2 uCenter;    // centro della statua (coordinate schermo -1..1)
uniform float uRadius;   // raggio della sfumatura (in altezze di schermo)
uniform float uStrength; // 0..1
uniform float uAspect;
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec2 d = (ndc - uCenter) * vec2(uAspect, 1.0) * vec2(0.82, 1.0);
  float r = length(d) / max(uRadius, 0.01);
  float g = 1.0 - smoothstep(0.0, 1.0, r);
  g = g * g * (3.0 - 2.0 * g);
  vec3 col = mix(uIvory, uTaupe, g * uStrength);
  // vignettatura appena accennata ai bordi
  float v = smoothstep(1.75, 0.55, length(ndc * vec2(0.92, 1.0)));
  col *= mix(0.955, 1.0, v);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  // grana finissima contro le bande della sfumatura
  gl_FragColor.rgb += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
}`;

/** Macchia morbida d'ombra a terra (texture disegnata su canvas). */
function contactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export function createStage(canvas, quality) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setClearColor(new THREE.Color(COLORS.ivory), 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // lo fanno i materiali (vedi materials.js)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 80);

  // riflessi morbidi per il marmo levigato
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  pmrem.dispose();

  // ---- sfondo ----
  const bgUniforms = {
    uIvory: { value: new THREE.Color(COLORS.ivory) },
    uTaupe: { value: new THREE.Color(COLORS.taupe) },
    uCenter: { value: new THREE.Vector2(0.3, 0) },
    uRadius: { value: 0.8 },
    uStrength: { value: 0.6 },
    uAspect: { value: 1 },
    uTime: { value: 0 },
  };
  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      uniforms: bgUniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
  );
  background.frustumCulled = false;
  background.renderOrder = -100;
  scene.add(background);

  // ---- pavimento: solo ombre (portata + macchia di contatto) ----
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), createShadowFloorMaterial());
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.renderOrder = -50;
  scene.add(floor);

  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#3d3127'),
      alphaMap: contactShadowTexture(),
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      toneMapped: false,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.002;
  contact.renderOrder = -40;
  scene.add(contact);

  // ---- luci ----
  const hemi = new THREE.HemisphereLight(new THREE.Color('#f9f7f3'), new THREE.Color('#bdb2a3'), 0.9);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  const sc = key.shadow.camera;
  sc.left = -3.4;
  sc.right = 3.4;
  sc.top = 3.4;
  sc.bottom = -3.4;
  sc.near = 0.5;
  sc.far = 20;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.024;
  scene.add(key, key.target);

  // controluce: sempre dalla parte opposta alla camera, stacca la statua dallo sfondo
  const rim = new THREE.DirectionalLight(new THREE.Color('#fff0dd'), 1);
  scene.add(rim, rim.target);

  const lightTarget = new THREE.Vector3(0, 1, -0.3);
  const tmp = new THREE.Vector3();

  return {
    renderer,
    scene,
    camera,
    floor,
    contact,
    background,
    bgUniforms,
    lights: { hemi, key, rim },

    /** Applica uno stato luci (vedi LIGHTS in drone-path.js) */
    applyLights(state, cameraPos) {
      const azr = THREE.MathUtils.degToRad(state.keyAz);
      const elr = THREE.MathUtils.degToRad(state.keyEl);
      key.position.set(
        lightTarget.x + Math.cos(elr) * Math.sin(azr) * 8,
        lightTarget.y + Math.sin(elr) * 8,
        lightTarget.z + Math.cos(elr) * Math.cos(azr) * 8
      );
      key.target.position.copy(lightTarget);
      key.intensity = state.keyIntensity;
      key.color.copy(state.keyColor);
      hemi.intensity = state.ambient;
      rim.intensity = state.rim;
      // controluce: dietro la statua rispetto alla camera, un po' dall'alto
      tmp.subVectors(lightTarget, cameraPos).setY(0).normalize();
      rim.position.copy(lightTarget).addScaledVector(tmp, 6).setY(lightTarget.y + 4);
      rim.target.position.copy(lightTarget);
      bgUniforms.uStrength.value = state.backdrop;
      floor.material.opacity = state.shadow;
    },

    setSize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      bgUniforms.uAspect.value = width / height;
    },
  };
}
