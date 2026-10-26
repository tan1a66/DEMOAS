import * as THREE from 'three';
import { GLSL_COMMON } from './materials.js';
import { FOG_GLSL } from './water-glsl.js';
import { PALETTE } from './layout.js';
import { SEABED_Y } from './camera-path.js';

// Il fondale e la scultura: sotto il primo servizio (Sitios 3D inmersivos) si scende sulla sabbia e
// si trova un'opera 3D nei materiali del sito. Un grande anello di cemento rosa (come la finestra
// circolare dell'ingresso) su un basamento, e dentro un nodo verde acido lucido che gira piano.
// Sopra scorrono le caustiche della superficie; tutto si vela d'acqua con la distanza.
// Trascinandola col dito o col mouse la scultura gira, con un po' d'inerzia.

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

function litMaterial(shared, { color, shine, gloss, grain }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uColor: { value: lin(color) },
      uShine: { value: shine },
      uGloss: { value: gloss },
      uGrain: { value: grain },
    },
    vertexShader: LIT_VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${LIT_GLSL}
      void main() {
        vec3 N = normalize(vNormal);
        // cemento: pori e macchie leggere (uGrain); il verde è liscio
        float g = vnoise(vWorldPos.xy * 7.0 + vWorldPos.z * 5.0) * 0.6 + vnoise(vWorldPos.zy * 23.0 + vWorldPos.x * 17.0) * 0.4;
        vec3 base = uColor * (1.0 + (g - 0.5) * uGrain);
        gl_FragColor = vec4(softClip(shade(base, N) * uExposure), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

export function createSculpture(shared, { base }) {
  const group = new THREE.Group();

  // ---------------- fondale di sabbia rosata ----------------
  const sandGeo = new THREE.PlaneGeometry(170, 170, 1, 1);
  sandGeo.rotateX(-Math.PI / 2);
  const sand = new THREE.Mesh(sandGeo, new THREE.ShaderMaterial({
    uniforms: { ...shared, uColor: { value: lin('#C9A296') }, uShine: { value: 8 }, uGloss: { value: 0 }, uGrain: { value: 0 } },
    vertexShader: LIT_VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${LIT_GLSL}
      void main() {
        // increspature della sabbia (onde lente e rumore), come rilievo della normale
        vec2 p = vWorldPos.xz;
        float r = sin(p.x * 2.1 + vnoise(p * 0.35) * 5.0) * 0.5 + vnoise(p * 3.0) * 0.5;
        vec3 N = normalize(vec3(cos(p.x * 2.1 + vnoise(p * 0.35) * 5.0) * 0.12, 1.0, (vnoise(p * 1.7) - 0.5) * 0.2));
        vec3 base = uColor * (0.9 + r * 0.12) * (0.94 + 0.12 * vnoise(p * 0.4));
        gl_FragColor = vec4(softClip(shade(base, N) * uExposure), 1.0);
        #include <colorspace_fragment>
      }
    `,
  }));
  sand.position.set(base.x - 10, SEABED_Y, base.z - 8);
  sand.renderOrder = 1;
  group.add(sand);

  // ---------------- la scultura ----------------
  const concrete = litMaterial(shared, { color: PALETTE.concreteLight, shine: 24, gloss: 0.12, grain: 0.22 });
  const green = litMaterial(shared, { color: PALETTE.cushion, shine: 90, gloss: 0.9, grain: 0 });

  const art = new THREE.Group();
  art.position.copy(base);
  group.add(art);
  // basamento basso, appena affondato nella sabbia
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.7, 64), concrete);
  plinth.position.y = 0.25;
  art.add(plinth);
  // la parte che gira: anello rosa e nodo verde
  const turn = new THREE.Group();
  turn.position.y = 0.6 + 2.05;
  art.add(turn);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.3, 48, 160), concrete);
  turn.add(ring);
  // piede dell'anello sul basamento
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.5), concrete);
  foot.position.y = -1.92;
  turn.add(foot);
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.82, 0.19, 260, 36, 2, 3), green);
  turn.add(knot);
  const pickables = [ring, knot, plinth, foot];

  // rotazione: trascinando si imprime una velocità che si smorza; senza mani gira piano da sola
  const rot = { yaw: 0.4, pitch: 0, vy: 0, vp: 0, held: false, lastUser: -1e9 };
  function rotateBy(dx, dy, dt = 1 / 60) {
    rot.held = true;
    rot.lastUser = performance.now();
    const ky = dx * 0.0085, kp = dy * 0.006;
    rot.yaw += ky;
    rot.pitch = THREE.MathUtils.clamp(rot.pitch + kp, -0.4, 0.4);
    rot.vy = ky / Math.max(dt, 1 / 120);
    rot.vp = kp / Math.max(dt, 1 / 120);
  }
  function release() {
    rot.held = false;
  }

  const ray = new THREE.Raycaster();
  function hit(r) {
    ray.ray.copy(r);
    return ray.intersectObjects(pickables, false).length > 0;
  }

  function update(time, dt) {
    if (!rot.held) {
      // inerzia, poi torna a girare piano da sola (e a raddrizzarsi)
      rot.yaw += rot.vy * dt;
      rot.pitch = THREE.MathUtils.clamp(rot.pitch + rot.vp * dt, -0.4, 0.4);
      rot.vy *= Math.exp(-dt * 2.2);
      rot.vp *= Math.exp(-dt * 3.0);
      const idle = performance.now() - rot.lastUser > 2500;
      if (idle) {
        rot.yaw += dt * 0.18;
        rot.pitch += (0 - rot.pitch) * (1 - Math.exp(-dt * 0.8));
      }
    }
    turn.rotation.set(rot.pitch, rot.yaw, 0, 'YXZ');
    // il nodo gira dentro l'anello, per conto suo
    knot.rotation.set(time * 0.21, time * 0.33, time * 0.12);
  }

  return { group, hit, rotateBy, release, update, center: base.clone().add(new THREE.Vector3(0, 2.65, 0)) };
}
