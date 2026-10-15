// El fuego del fogón: llamas (shader procedural), brasas que suben por el patio y humo.
// Es la otra fuente de color de la escena, junto al cielo: "Del fogón al cielo de Mérida".

import * as THREE from 'three';

const NOISE2 = /* glsl */ `
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm2(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; }
    return v;
  }
`;

/** Una lengua de fuego: plano que siempre mira a la cámara (girando en Y). */
function flameMaterial(seed) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uIntensity: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSeed;
      uniform float uIntensity;
      varying vec2 vUv;
      ${NOISE2}
      void main() {
        vec2 uv = vUv;
        float n = fbm2(vec2(uv.x * 3.2 + uSeed * 5.0, uv.y * 2.6 - uTime * 2.4 - uSeed));
        float m = fbm2(vec2(uv.x * 6.0 - uSeed, uv.y * 5.0 - uTime * 3.7));
        float x = (uv.x - 0.5) * 2.0 + (n - 0.5) * 0.9 * uv.y;
        float w = mix(0.9, 0.04, pow(uv.y, 0.75));
        float body = 1.0 - smoothstep(w * 0.45, w, abs(x));
        body *= smoothstep(0.0, 0.1, uv.y);
        body *= 1.0 - smoothstep(0.45, 0.95, uv.y + (m - 0.5) * 0.45);
        float core = (1.0 - smoothstep(0.0, w * 0.5, abs(x))) * (1.0 - smoothstep(0.05, 0.45, uv.y));
        vec3 col = mix(vec3(1.0, 0.22, 0.03), vec3(1.0, 0.55, 0.12), body);
        col = mix(col, vec3(1.0, 0.88, 0.62), core * 0.85);
        float a = body * (0.55 + 0.45 * m);
        gl_FragColor = vec4(col * a * uIntensity * 3.2, a);
      }`,
  });
}

export function buildFire(origin) {
  const group = new THREE.Group();
  group.position.copy(origin);

  // ---------------------------------------------------------------- llamas
  const flames = [];
  const flameGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const layout = [
    [0, 0, 0.75, 1.05, 0.1],
    [-0.32, 0.06, 0.55, 0.78, 0.6],
    [0.34, -0.05, 0.6, 0.85, 1.3],
    [-0.08, -0.12, 0.45, 0.62, 2.1],
    [0.15, 0.14, 0.4, 0.55, 2.9],
  ];
  for (const [x, z, w, h, seed] of layout) {
    const m = new THREE.Mesh(flameGeo, flameMaterial(seed));
    m.position.set(x, 0, z);
    m.scale.set(w, h, 1);
    m.renderOrder = 2;
    m.frustumCulled = false;
    flames.push(m);
    group.add(m);
  }

  // ---------------------------------------------------------------- brasas que suben
  const EMBERS = 140;
  const eGeo = new THREE.BufferGeometry();
  const seeds = new Float32Array(EMBERS * 4);
  for (let i = 0; i < EMBERS; i++) {
    const longLife = i % 3 === 0; // un tercio sube hasta el cielo, acompañando a la cámara
    seeds.set([Math.random(), 0.6 + Math.random() * 0.8, Math.random(), longLife ? 7 + Math.random() * 4 : 1.5 + Math.random() * 2.5], i * 4);
  }
  eGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  eGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EMBERS * 3), 3));
  const emberMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 800 }, uIntensity: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uScale;
      varying float vA;
      varying float vHot;
      void main() {
        float life = aSeed.w;
        float t = mod(uTime * (0.8 + aSeed.y * 0.3) + aSeed.x * life, life);
        float k = t / life;
        vec3 p = vec3((fract(aSeed.x * 13.7) - 0.5) * 0.9, 0.15, (fract(aSeed.x * 7.3) - 0.5) * 0.55);
        p.y += t * (0.75 + aSeed.y * 0.9);
        float sw = 0.18 + 0.5 * k;
        p.x += sin(t * 1.9 + aSeed.x * 6.28) * sw + (aSeed.z - 0.5) * 1.4 * k;
        p.z += cos(t * 1.5 + aSeed.x * 9.4) * sw * 0.8 + (fract(aSeed.z * 3.1) - 0.5) * 1.2 * k;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float flick = 0.6 + 0.4 * sin(uTime * (9.0 + aSeed.y * 7.0) + aSeed.x * 40.0);
        gl_PointSize = max(1.5, 0.045 * uScale * (1.0 - k * 0.5) / -mv.z);
        vA = (1.0 - smoothstep(0.55, 1.0, k)) * smoothstep(0.0, 0.04, k) * flick;
        vHot = 1.0 - k;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying float vA;
      varying float vHot;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d) * vA;
        vec3 col = mix(vec3(1.0, 0.32, 0.06), vec3(1.0, 0.75, 0.35), vHot);
        gl_FragColor = vec4(col * a * 4.0 * uIntensity, a);
      }`,
  });
  const embers = new THREE.Points(eGeo, emberMat);
  embers.frustumCulled = false;
  embers.renderOrder = 3;
  group.add(embers);

  // ---------------------------------------------------------------- humo
  // Bocanadas como cuadrados orientados a la cámara (billboard en el vertex shader).
  const PUFFS = 26;
  const base = new THREE.PlaneGeometry(1, 1);
  const sGeo = new THREE.InstancedBufferGeometry();
  sGeo.index = base.index;
  sGeo.setAttribute('position', base.getAttribute('position'));
  sGeo.setAttribute('uv', base.getAttribute('uv'));
  const sSeeds = new Float32Array(PUFFS * 4);
  for (let i = 0; i < PUFFS; i++) sSeeds.set([i / PUFFS, Math.random(), Math.random(), Math.random()], i * 4);
  sGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sSeeds, 4));
  sGeo.instanceCount = PUFFS;
  const smokeMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFire: { value: new THREE.Color('#ff8a3a') },
      uAmbient: { value: new THREE.Color('#bdb3a6') },
      uOpacity: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      varying vec2 vUv;
      varying float vK;
      varying float vA;
      varying float vSeed;
      void main() {
        float life = 11.0;
        float t = mod(uTime + aSeed.x * life, life);
        float k = t / life;
        vec3 c = vec3((aSeed.y - 0.5) * 0.5, 0.6 + t * 1.05, (aSeed.z - 0.5) * 0.4);
        c.x += sin(t * 0.45 + aSeed.w * 6.0) * 0.45 * k + k * k * 0.9;
        c.z += cos(t * 0.38 + aSeed.y * 6.0) * 0.4 * k;
        float size = mix(0.55, 4.2, sqrt(k)) * (0.8 + aSeed.w * 0.4);
        vec4 mv = modelViewMatrix * vec4(c, 1.0);
        float rot = aSeed.y * 6.28 + t * (aSeed.z - 0.5) * 0.4;
        vec2 q = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * position.xy;
        mv.xy += q * size;
        gl_Position = projectionMatrix * mv;
        vUv = uv;
        vK = k;
        vSeed = aSeed.w;
        // Se desvanece cerca de la cámara (cuando la atravesamos al subir).
        vA = smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.55, 1.0, k)) * smoothstep(1.2, 4.5, -mv.z + size * 0.5);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFire;
      uniform vec3 uAmbient;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;
      varying float vK;
      varying float vA;
      varying float vSeed;
      ${NOISE2}
      void main() {
        vec2 p = vUv - 0.5;
        float n = fbm2(p * 3.0 + vSeed * 10.0 + vec2(0.0, -uTime * 0.15));
        float a = smoothstep(0.5, 0.05, length(p) + (n - 0.5) * 0.35) * vA;
        vec3 col = mix(uFire, uAmbient, smoothstep(0.0, 0.35, vK));
        gl_FragColor = vec4(col, a * 0.16 * uOpacity);
      }`,
  });
  const smoke = new THREE.Mesh(sGeo, smokeMat);
  smoke.frustumCulled = false;
  smoke.renderOrder = 1;
  group.add(smoke);

  // ---------------------------------------------------------------- luz del fuego
  const light = new THREE.PointLight('#FF8236', 10, 30, 2);
  light.position.set(0.1, 1.15, 0.35);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024); // se calcula una sola vez: puede ser nítida
  light.shadow.bias = -0.005;
  light.shadow.normalBias = 0.05; // sin acné en los muros del patio
  light.shadow.radius = 1;
  light.shadow.camera.near = 0.2;
  light.shadow.camera.far = 26;
  light.shadow.autoUpdate = false; // estático: se calcula una vez
  light.shadow.needsUpdate = true;
  group.add(light);

  const camPos = new THREE.Vector3();
  const local = new THREE.Vector3();

  /** t en segundos; `camera` para orientar las llamas; `amb` color ambiente del humo. */
  function update(t, camera, { ambient, scale, night }) {
    camera.getWorldPosition(camPos);
    local.copy(camPos);
    group.worldToLocal(local);
    for (const f of flames) {
      f.rotation.y = Math.atan2(local.x - f.position.x, local.z - f.position.z);
      f.material.uniforms.uTime.value = t;
    }
    const flick = 1 + 0.12 * Math.sin(t * 11.0) + 0.08 * Math.sin(t * 17.3 + 1.1) + 0.05 * Math.sin(t * 29.0);
    light.intensity = (9 + 5 * night) * flick;
    emberMat.uniforms.uTime.value = t;
    emberMat.uniforms.uScale.value = scale;
    smokeMat.uniforms.uTime.value = t;
    smokeMat.uniforms.uAmbient.value.copy(ambient);
    smokeMat.uniforms.uOpacity.value = 0.75 + 0.25 * night;
  }

  // Mallas transparentes (no deben entrar en la oclusión ambiental).
  const transparent = [...flames, smoke];
  return { group, light, update, transparent };
}
