// ─────────────────────────────────────────────────────────────────────────────
//  Atmosfera dell'apertura: luce dorata radente del tramonto yucateco
//
//  - environment map di tramonto generata al volo (PMREM da un cielo shader):
//    riflessi credibili senza scaricare un HDRI → l'apertura parte subito.
//    (L'HDRI fotografico arriverà con l'hacienda, caricato in background.)
//  - cupola del cielo: notte calda con il bagliore del sole dietro la pianta
//  - luci: sole radente con ombre morbide, riempimento caldo, controluce freddo
//  - terra rossa (kancab) che riceve le ombre lunghe delle foglie
//  - polvere sospesa che brilla quando è controluce
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { PALETTE } from '../config.js';

// direzione verso il sole (dietro a sinistra, basso sull'orizzonte)
export const SUN_DIR = new THREE.Vector3(-0.62, 0.3, -0.72).normalize();

const SKY_GLSL = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSun;
  uniform float uSunPower;
  vec3 skyColor(vec3 dir) {
    float h = dir.y;
    vec3 c = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));
    float s = max(0.0, dot(dir, uSunDir));
    c += uSun * (pow(s, 6.0) * 0.6 + pow(s, 64.0) * 1.5 + pow(s, 900.0) * uSunPower);
    // banda calda sull'orizzonte dal lato del sole
    c += uSun * 0.35 * exp(-abs(h) * 14.0) * (0.35 + 0.65 * s);
    // sotto l'orizzonte e appena sopra: stesso colore della nebbia → niente linea netta
    c = mix(uGround, c, smoothstep(-0.01, 0.16, h));
    return c;
  }
`;

function skyMaterial(params) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSunDir: { value: SUN_DIR.clone() },
      uZenith: { value: new THREE.Color(params.zenith) },
      uHorizon: { value: new THREE.Color(params.horizon) },
      uGround: { value: new THREE.Color(params.ground) },
      uSun: { value: new THREE.Color(params.sun) },
      uSunPower: { value: params.sunPower },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        vec4 p = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position, 1.0)).xyz, 1.0);
        gl_Position = p.xyww; // sempre sullo sfondo
      }`,
    fragmentShader: /* glsl */ `
      ${SKY_GLSL}
      varying vec3 vDir;
      void main() {
        gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// environment map: tramonto vero (luminoso) ma usata a bassa intensità
export function createSunsetEnvironment(renderer) {
  const scene = new THREE.Scene();
  const mat = skyMaterial({ zenith: '#2c3550', horizon: '#ff9c58', ground: '#3a2016', sun: '#ffc47a', sunPower: 30 });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  mat.dispose();
  return rt.texture;
}

// cupola visibile: notte calda, il sole è appena tramontato dietro la pianta
export function createSkyDome() {
  const mat = skyMaterial({ zenith: '#080504', horizon: '#2a130b', ground: PALETTE.night, sun: '#6e3418', sunPower: 0 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 24), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -1;
  return dome;
}

export function createLights(quality) {
  const group = new THREE.Group();
  // sole radente: dorato, da dietro a sinistra, ombre morbide e lunghe
  const sun = new THREE.DirectionalLight('#ffb468', 3.2);
  sun.position.copy(SUN_DIR).multiplyScalar(9).add(new THREE.Vector3(0, 0.5, 0));
  sun.target.position.set(0, 0.6, 0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  const sc = sun.shadow.camera;
  sc.left = -3.4;
  sc.right = 3.4;
  sc.top = 3.4;
  sc.bottom = -2.2;
  sc.near = 2;
  sc.far = 20;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  // riempimento caldo frontale: legge il filo e le facce delle foglie
  const fill = new THREE.DirectionalLight('#ffe4c8', 0.6);
  fill.position.set(2.5, 2.2, 6);
  // controluce freddo dall'alto: un filo di cielo blu sulle foglie
  const rim = new THREE.DirectionalLight('#8ea7c9', 0.7);
  rim.position.set(3, 5, -4);
  group.add(sun, sun.target, fill, rim);
  return { group, sun, fill, rim };
}

// terra rossa dello Yucatán con sassolini e polvere, che sfuma nel buio
export function createGround() {
  const mat = new THREE.MeshStandardMaterial({ color: PALETTE.soil, roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        varying vec3 vWPos;
        float gh(vec2 p) { p = fract(p * vec2(443.89, 441.42)); p += dot(p, p + 19.19); return fract(p.x * p.y); }
        float gn(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        {
          vec2 p = vWPos.xz;
          float n = gn(p * 1.3) * 0.5 + gn(p * 4.1) * 0.3 + gn(p * 13.0) * 0.2;
          vec3 c = diffuseColor.rgb * (0.72 + 0.5 * n);
          // chiazze più chiare e più scure (terra battuta, foglie secche, ombra di cespugli)
          c *= 0.85 + 0.3 * smoothstep(0.35, 0.75, gn(p * 0.35 + 3.0));
          diffuseColor.rgb = c;
        }`,
      );
  };
  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 64), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

// polvere dorata: deriva lenta verso l'alto; brilla controluce (diffusione in avanti)
export function createDust(count) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 9;
    pos[i * 3 + 1] = Math.random() * 4.2;
    pos[i * 3 + 2] = -3 + Math.random() * 7.5;
    seed[i] = Math.random();
    size[i] = 0.6 + Math.pow(Math.random(), 3) * 3.2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uPixelRatio: { value: 1 },
      uSunDir: { value: SUN_DIR.clone() },
      uColor: { value: new THREE.Color('#ffc27a') },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed; attribute float aSize;
      uniform float uTime; uniform float uPixelRatio; uniform vec3 uSunDir;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * (0.25 + aSeed * 0.35);
        p.y = mod(p.y + uTime * 0.035 * (0.4 + aSeed), 4.2);
        p.x += sin(t + aSeed * 31.0) * 0.22;
        p.z += cos(t * 0.8 + aSeed * 17.0) * 0.18;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = -mv.z;
        gl_PointSize = aSize * uPixelRatio * (16.0 / dist) * (1.0 + smoothstep(2.5, 0.8, dist) * 2.0);
        // controluce: più brillante guardando verso il sole
        vec3 view = normalize(p - cameraPosition);
        float fwd = pow(max(0.0, dot(view, uSunDir)), 3.0);
        float twinkle = 0.65 + 0.35 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 40.0);
        vAlpha = (0.12 + 1.1 * fwd) * twinkle * smoothstep(0.4, 1.4, dist) * smoothstep(0.0, 0.5, p.y) * smoothstep(4.2, 3.4, p.y);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor * a * a * vAlpha * uOpacity, 1.0);
      }`,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  return points;
}
