import * as THREE from 'three';
import { GLSL_COMMON } from './materials.js';
import { FOG_GLSL } from './water-glsl.js';
import { SEABED_Y, STATUE_H } from './camera-path.js';

// Il fondale e la statua: dopo il tuffo si scende sulla sabbia e si trova una statua di bronzo con la
// patina verde (due grandi volti), posata sul fondo. Il modello (assets/statue.glb, solo geometria, e
// le texture di colore e rilievo) si scarica dopo l'apertura del sito: finché non arriva la statua non
// c'è (setStatue). Sopra scorrono le caustiche della superficie; tutto si vela d'acqua con la distanza.
// Trascinandola col dito o col mouse la statua gira su se stessa, con un po' d'inerzia; lasciata
// stare torna piano verso il davanti, oscillando appena.

const lin = (hex) => new THREE.Color(hex);

// luce dall'alto (la superficie), caustiche, speculare e bordo color acqua
const LIT_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uExposure;
  uniform vec3 uColor;
  uniform float uShine;
  uniform float uGloss;
  uniform float uGrain;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  ${GLSL_COMMON}
  ${FOG_GLSL}
  float caustics(vec3 p) {
    vec2 q = p.xz * 1.2 + p.y * 0.15;
    float c1 = vnoise(q * 1.7 + vec2(uTime * 0.45, -uTime * 0.2));
    float c2 = vnoise(q * 2.9 - vec2(uTime * 0.32, uTime * 0.27));
    return pow(1.0 - abs(c1 - c2), 7.0);
  }
  vec3 shade(vec3 base, vec3 N) {
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(vec3(-0.3, 1.0, 0.2));
    float ndl = max(dot(N, L), 0.0);
    float c = caustics(vWorldPos) * smoothstep(-0.2, 0.6, N.y);
    // ambiente: l'acqua attorno (più chiara verso l'alto), con una parte di luce neutra perché il rosa
    // del cemento resti rosa e non diventi grigio
    vec3 amb = mix(vec3(0.82, 0.8, 0.8), mix(uDeep, uShallow, N.y * 0.5 + 0.5), 0.4) * 0.95;
    vec3 col = base * (amb + vec3(0.92, 1.0, 1.0) * ndl * (0.55 + 1.2 * c));
    vec3 H = normalize(L + V + vec3(1e-4, 0.0, 0.0));
    float spec = pow(clamp(dot(N, H), 0.0, 1.0), uShine) * uGloss;
    col += vec3(0.9, 1.0, 1.0) * spec * (0.55 + 1.4 * c);
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
    col += uShallow * fres * 0.3;
    float dist = length(cameraPosition - vWorldPos);
    return mix(waterColor(-V), col, waterFog(dist, -vWorldPos.y));
  }
`;

const LIT_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export function createSculpture(shared, { base }) {
  const group = new THREE.Group();

  // ---------------- fondale di sabbia rosata ----------------
  const sandGeo = new THREE.PlaneGeometry(170, 170, 1, 1);
  sandGeo.rotateX(-Math.PI / 2);
  const sand = new THREE.Mesh(sandGeo, new THREE.ShaderMaterial({
    uniforms: { ...shared, uColor: { value: lin('#C9A296') }, uShine: { value: 8 }, uGloss: { value: 0 }, uGrain: { value: 0 }, uArt: { value: base.clone() } },
    vertexShader: LIT_VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uArt;
      uniform vec4 uSharks[2]; // posizione e lunghezza degli squali, per le loro ombre
      ${LIT_GLSL}
      void main() {
        // increspature della sabbia (onde lente e rumore), come rilievo della normale
        vec2 p = vWorldPos.xz;
        float r = sin(p.x * 2.1 + vnoise(p * 0.35) * 5.0) * 0.5 + vnoise(p * 3.0) * 0.5;
        vec3 N = normalize(vec3(cos(p.x * 2.1 + vnoise(p * 0.35) * 5.0) * 0.12, 1.0, (vnoise(p * 1.7) - 0.5) * 0.2));
        vec3 base = uColor * (0.9 + r * 0.12) * (0.94 + 0.12 * vnoise(p * 0.4));
        vec3 col = shade(base, N);
        // ombra di contatto sotto la statua (luce dall'alto, appena spostata come il sole)
        vec2 o = (p - uArt.xz - vec2(0.15, -0.1)) / vec2(2.3, 2.5);
        col *= 1.0 - 0.55 * smoothstep(1.0, 0.25, length(o));
        // l'ombra morbida degli squali (più sfocata e chiara quanto più nuotano in alto)
        for (int i = 0; i < 2; i++) {
          vec4 sh = uSharks[i];
          float hgt = max(sh.y - vWorldPos.y, 0.1);
          vec2 c = sh.xz + vec2(0.3, -0.2) * hgt;
          float r = sh.w * 0.32 + hgt * 0.22;
          col *= 1.0 - 0.3 * exp(-hgt * 0.3) * smoothstep(1.0, 0.0, length(p - c) / r);
        }
        gl_FragColor = vec4(softClip(col * uExposure), 1.0);
        #include <colorspace_fragment>
      }
    `,
  }));
  sand.position.set(base.x - 10, SEABED_Y, base.z - 8);
  sand.renderOrder = 1;
  group.add(sand);

  // ---------------- la statua ----------------
  // bronzo: colore della patina e rilievo dalle texture del modello (normal map in spazio tangente,
  // ricostruito dalle derivate), luce dall'alto con le caustiche, riflesso caldo del metallo
  const blank = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  blank.needsUpdate = true;
  const bronze = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uColor: { value: new THREE.Color(1, 1, 1) },
      uShine: { value: 34 },
      uGloss: { value: 0.35 },
      uGrain: { value: 0 },
      uMap: { value: blank },
      uNormalMap: { value: blank },
      uNormalScale: { value: 1.0 },
      uLift: { value: 1.35 },
    },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uMap;
      uniform sampler2D uNormalMap;
      uniform float uNormalScale;
      uniform float uLift;
      varying vec2 vUv;
      ${LIT_GLSL}
      vec3 perturb(vec3 N, vec3 p, vec2 uv, vec3 m) {
        vec3 q0 = dFdx(p), q1 = dFdy(p);
        vec2 st0 = dFdx(uv), st1 = dFdy(uv);
        vec3 q1perp = cross(q1, N), q0perp = cross(N, q0);
        vec3 T = q1perp * st0.x + q0perp * st1.x;
        vec3 B = q1perp * st0.y + q0perp * st1.y;
        float det = max(dot(T, T), dot(B, B));
        float k = det == 0.0 ? 0.0 : inversesqrt(det);
        return normalize(T * (m.x * k) + B * (m.y * k) + N * m.z);
      }
      void main() {
        vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 m = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
        m.xy *= uNormalScale;
        N = perturb(N, vWorldPos, vUv, m);
        vec3 base = texture2D(uMap, vUv).rgb * uLift;
        gl_FragColor = vec4(softClip(shade(base, N) * uExposure), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  // segnaposto finché non arriva il modello (lo shader si compila subito, con il resto)
  const statue = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3))
    .setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
    .setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2)), bronze);
  statue.visible = false;
  const turn = new THREE.Group();
  turn.position.copy(base).add(new THREE.Vector3(0, -0.08, 0)); // appena affondata nella sabbia
  turn.add(statue);
  group.add(turn);
  // i volti (+z nel modello) guardano verso la telecamera, che arriva da +x
  statue.rotation.y = Math.PI / 2;
  statue.scale.setScalar(STATUE_H);
  // per il dito: un cilindro invisibile attorno alla statua (più leggero del modello)
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.0, STATUE_H, 20));
  proxy.position.copy(base).add(new THREE.Vector3(0, STATUE_H / 2, 0));
  proxy.updateMatrixWorld(true);

  function setStatue(geometry, colorTex, normalTex) {
    statue.geometry.dispose();
    statue.geometry = geometry;
    bronze.uniforms.uMap.value = colorTex;
    bronze.uniforms.uNormalMap.value = normalTex;
    statue.visible = true;
  }

  // rotazione: trascinando si imprime una velocità che si smorza; senza mani torna piano verso il
  // davanti, oscillando appena
  const rot = { yaw: 0, vy: 0, held: false, lastUser: -1e9 };
  function rotateBy(dx, dy, dt = 1 / 60) {
    rot.held = true;
    rot.lastUser = performance.now();
    const ky = dx * 0.0085;
    rot.yaw += ky;
    rot.vy = ky / Math.max(dt, 1 / 120);
  }
  function release() {
    rot.held = false;
  }

  const ray = new THREE.Raycaster();
  function hit(r) {
    ray.ray.copy(r);
    return statue.visible && ray.intersectObject(proxy, false).length > 0;
  }

  function update(time, dt) {
    if (!rot.held) {
      rot.yaw += rot.vy * dt;
      rot.vy *= Math.exp(-dt * 2.2);
      if (performance.now() - rot.lastUser > 2500) {
        // il giro più vicino al davanti, più un'oscillazione lenta
        const front = Math.round(rot.yaw / (Math.PI * 2)) * Math.PI * 2 + Math.sin(time * 0.22) * 0.18;
        rot.yaw += (front - rot.yaw) * (1 - Math.exp(-dt * 0.6));
      }
    }
    turn.rotation.y = rot.yaw;
  }

  return { group, hit, rotateBy, release, update, setStatue, center: base.clone().add(new THREE.Vector3(0, STATUE_H / 2, 0)) };
}
