import * as THREE from 'three';
import { GLSL_COMMON } from './materials.js';
import { FOG_GLSL } from './water-glsl.js';
import { createSharks } from './sharks.js';
import { createSculpture } from './sculpture.js';

// Sott'acqua, sul fondale: la statua da girare col dito (src/sculpture.js); bollicine che salgono verso
// la superficie, pulviscolo e due squaletti.
// Interazione: il puntatore (o il dito) scosta le bollicine; un tocco nell'acqua libera uno sbuffo di
// bollicine, trascinare lascia una scia; toccare uno squalo lo fa scattare via.
// Tutto sfuma nel colore dell'acqua con la distanza.

import { WATER } from './water-glsl.js';
export { WATER };

// Bolle d'aria come quelle vere. Forma: le piccole sono sfere, le grandi schiacciate e tremolanti.
// Luce: dove la luce incontra la superficie acqua-aria oltre l'angolo critico (~49°) si riflette
// tutta, quindi il bordo è un anello argentato che riflette l'acqua attorno (più chiara verso l'alto);
// il centro è quasi trasparente, con un riflesso del sole in alto e un chiarore in basso. Le bolle
// più piccole di un paio di pixel si attenuano invece di sfarfallare.
const BUBBLE_VERT = /* glsl */ `
  uniform float uViewH;
  vec3 bubbleShape(vec3 p, float r, float t, float seed, out vec3 n) {
    float big = smoothstep(0.016, 0.04, r);
    float sy = mix(1.0, 0.68, big);
    float wob = 1.0 + big * 0.08 * sin(dot(p, vec3(2.3, 3.7, 1.9)) * 1.9 + t * 12.0 + seed * 6.28);
    n = normalize(vec3(p.x, p.y / sy, p.z));
    return vec3(p.x, p.y * sy, p.z) * wob * r;
  }
  float bubbleFade(vec4 clip, float r) {
    float px = r * projectionMatrix[1][1] * uViewH * 0.5 / max(clip.w, 1e-3);
    return smoothstep(0.5, 1.8, px);
  }
`;
const BUBBLE_FRAG = /* glsl */ `
  vec4 bubbleColor(vec3 N, vec3 V, float dist, float depth) {
    float c = clamp(abs(dot(N, V)), 0.0, 1.0);
    float tir = 1.0 - smoothstep(0.6, 0.72, c);
    vec3 R = reflect(-V, N);
    vec3 env = mix(waterColor(R) * 1.5, vec3(0.92, 0.98, 1.0), 0.22) + vec3(0.85, 0.97, 1.0) * pow(max(R.y, 0.0), 3.0) * 0.9;
    float fr = 0.03 + 0.2 * pow(1.0 - c, 5.0);
    float spec = pow(max(dot(R, normalize(vec3(-0.25, 1.0, 0.2))), 0.0), 120.0) * 3.0;
    float lens = (1.0 - tir) * (1.0 - smoothstep(-0.75, 0.0, N.y)) * 0.22;
    vec3 col = env * mix(fr, 1.0, tir) + vec3(1.0) * spec + uShallow * lens;
    float f = waterFog(dist, depth);
    return vec4(col * f, mix(fr * 0.5, 0.88, tir) * f);
  }
`;
// vetro: la bolla vela lo sfondo dove riflette (anello), la luce si somma (alfa premoltiplicata)
const GLASS = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor };

export function createUnderwater(lights, { art, quality }) {
  const L = lights.uniforms;
  const group = new THREE.Group();
  const shared = {
    uTime: L.uTime,
    uExposure: L.uExposure,
    uSunDir: L.uSunExtDir,
    uSunColor: L.uSunExtColor,
    uRayO: { value: new THREE.Vector3() },
    uRayD: { value: new THREE.Vector3(0, 0, -1) },
    uPush: { value: 0 },
    uDeep: { value: WATER.deep },
    uMid: { value: WATER.mid },
    uShallow: { value: WATER.shallow },
    uCamY: { value: 1 },
    uViewH: { value: 900 },
    uSharks: { value: [new THREE.Vector4(0, 99, 0, 1), new THREE.Vector4(0, 99, 0, 1)] },
  };

  // ---------------- il fondale e la statua ----------------
  const sculpture = createSculpture(shared, { base: art.base });
  group.add(sculpture.group);

  // ---------------- tratto sott'acqua ----------------
  // dal tuffo fino alla scultura (e un po' oltre): bollicine e pulviscolo sono distribuiti lungo
  // questo percorso, in proporzione alla sua lunghezza
  const route = [new THREE.Vector3(-27, 0, -13.5), art.base.clone().setY(0)];
  route.push(route[1].clone().add(new THREE.Vector3(-8, 0, -4)));
  const seg = route.slice(1).map((b, i) => b.distanceTo(route[i]));
  const routeLen = seg.reduce((a, b) => a + b, 0);
  // punto a caso lungo il percorso, scostato di lato fino a ±spread/2 metri
  const along = (spread, out) => {
    let t = Math.random() * routeLen, i = 0;
    while (i < seg.length - 1 && t > seg[i]) t -= seg[i++];
    out.lerpVectors(route[i], route[i + 1], Math.min(1, t / seg[i]));
    const dx = route[i + 1].x - route[i].x, dz = route[i + 1].z - route[i].z, l = Math.hypot(dx, dz) || 1;
    const side = (Math.random() - 0.5) * spread;
    return out.set(out.x - (dz / l) * side, 0, out.z + (dx / l) * side);
  };
  const tmpP = new THREE.Vector3();

  // ---------------- bolle che salgono ----------------
  // Tre famiglie: lo sbuffo del tuffo (fitte attorno al punto in cui si entra in acqua), colonne che
  // salgono in fila dal fondo (una sorgente ciascuna; tre attorno alla statua: ai lati e una davanti)
  // e bolle sparse.
  // Le piccole salgono quasi dritte, le grandi a zigzag; tutte piano (20-35 cm al secondo) e si
  // allargano un po' verso la superficie, dove scoppiano.
  const count = Math.round((quality.tier === 'low' ? 3.5 : 7) * Math.max(60, routeLen));
  const H = 9.6; // colonna d'acqua percorsa, dal fondo a sotto la superficie
  const small = new THREE.InstancedBufferGeometry().copy(new THREE.IcosahedronGeometry(1, 2));
  const aOffset = new Float32Array(count * 3);
  const aParams = new Float32Array(count * 4);
  const NSTREAM = quality.tier === 'low' ? 5 : 7;
  const NEAR = [[-0.4, 2.7], [0.3, -2.9], [2.6, 1.9]]; // attorno alla statua (x verso la telecamera, z)
  const streams = Array.from({ length: NSTREAM }, (_, k) => {
    const p = k < NEAR.length
      ? art.base.clone().add(new THREE.Vector3(NEAR[k][0] + (Math.random() - 0.5) * 0.3, 0, NEAR[k][1] + (Math.random() - 0.5) * 0.3))
      : along(16, new THREE.Vector3());
    const r = k < NEAR.length ? 0.011 + Math.random() * 0.008 : 0.007 + Math.random() ** 2 * 0.014;
    return { x: p.x, z: p.z, r, speed: 0.22 + Math.random() * 0.08, seed: Math.random() * 100, n: 0 };
  });
  const nDive = Math.round(count * 0.25), nStream = Math.round(count * 0.5);
  const perStream = Math.ceil(nStream / NSTREAM);
  for (let i = 0; i < count; i++) {
    let r, speed, seed, x, y, z;
    if (i < nDive) {
      // lo sbuffo del tuffo: tante bollicine, più rapide (acqua mossa)
      x = -28.5 + (Math.random() - 0.5) * 5;
      z = -13.5 + (Math.random() - 0.5) * 5;
      y = -Math.random() * H;
      r = 0.006 + Math.random() ** 2.5 * 0.03;
      speed = 0.3 + Math.random() * 0.25;
      seed = Math.random() * 100;
    } else if (i < nDive + nStream) {
      // una colonna: stessa sorgente e stessa velocità, distanziate in altezza
      const st = streams[(i - nDive) % NSTREAM];
      const j = st.n++;
      x = st.x + (Math.random() - 0.5) * 0.02;
      z = st.z + (Math.random() - 0.5) * 0.02;
      y = -(j / perStream) * H - Math.random() * (H / perStream) * 0.8; // distanze irregolari, come quelle vere
      r = st.r * (0.75 + Math.random() * 0.5);
      speed = st.speed;
      seed = st.seed;
    } else {
      along(14, tmpP);
      x = tmpP.x;
      z = tmpP.z;
      y = -Math.random() * H;
      r = 0.007 + Math.random() ** 3 * 0.035;
      speed = 0.2 + r * 3.0 + Math.random() * 0.05;
      seed = Math.random() * 100;
    }
    aOffset.set([x, y, z], i * 3);
    aParams.set([r, speed, seed, 0], i * 4);
  }
  small.setAttribute('aOffset', new THREE.InstancedBufferAttribute(aOffset, 3));
  small.setAttribute('aParams', new THREE.InstancedBufferAttribute(aParams, 4));
  small.instanceCount = count;
  const smallMat = new THREE.ShaderMaterial({
    uniforms: shared,
    ...GLASS,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uRayO, uRayD;
      uniform float uPush;
      attribute vec3 aOffset;
      attribute vec4 aParams; // raggio, velocità di salita, seme
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vFade;
      ${BUBBLE_VERT}
      void main() {
        float H = ${H.toFixed(1)};
        float h = mod(aOffset.y + H + uTime * aParams.y + aParams.z, H); // quota dal fondo
        vec3 o = vec3(aOffset.x, -H - 0.2 + h, aOffset.z);
        // salendo la pressione cala e la bolla si allarga
        float r = aParams.x * (1.0 + 0.3 * h / H);
        // zigzag: quasi niente per le piccole, ampio per le grandi
        float amp = 0.004 + r * 1.4;
        float w = h * 7.0 + aParams.z + uTime * 0.3;
        o.x += sin(w) * amp;
        o.z += cos(w * 1.13) * amp;
        // il puntatore le scosta (distanza dal raggio che parte dall'occhio)
        vec3 rel = o - uRayO;
        vec3 off = rel - uRayD * max(dot(rel, uRayD), 0.0);
        float dd = length(off);
        o += off / max(dd, 1e-3) * uPush * 0.55 * smoothstep(1.0, 0.0, dd);
        vec3 n;
        vec4 wp = vec4(o + bubbleShape(position, r, uTime, aParams.z, n), 1.0);
        vWorldPos = wp.xyz;
        vNormal = n;
        gl_Position = projectionMatrix * viewMatrix * wp;
        // nascono sul fondo, scoppiano appena sotto la superficie
        vFade = bubbleFade(gl_Position, r) * smoothstep(0.0, 0.3, h) * (1.0 - smoothstep(-0.7, -0.25, o.y));
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uExposure;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vFade;
      ${FOG_GLSL}
      ${BUBBLE_FRAG}
      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec4 c = bubbleColor(normalize(vNormal), V, length(cameraPosition - vWorldPos), -vWorldPos.y);
        gl_FragColor = vec4(c.rgb * uExposure, c.a) * vFade;
        #include <colorspace_fragment>
      }
    `,
  });
  const smallMesh = new THREE.Mesh(small, smallMat);
  smallMesh.frustumCulled = false;
  smallMesh.renderOrder = 12;
  group.add(smallMesh);

  // ---------------- pulviscolo sospeso ----------------
  // pulviscolo in proporzione alla lunghezza del tratto sott'acqua
  const nDust = Math.round((quality.tier === 'low' ? 6 : 13) * Math.max(40, routeLen));
  const dPos = new Float32Array(nDust * 3);
  for (let i = 0; i < nDust; i++) {
    along(18, tmpP);
    dPos[i * 3] = tmpP.x;
    dPos[i * 3 + 1] = -Math.random() * 10 - 0.2;
    dPos[i * 3 + 2] = tmpP.z;
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uPixelRatio: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vA;
      void main() {
        vec3 p = position;
        p += vec3(sin(uTime * 0.11 + p.z), sin(uTime * 0.07 + p.x) * 0.5, cos(uTime * 0.09 + p.y)) * 0.25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        vA = exp(-d * 0.09) * smoothstep(0.4, 1.5, d);
        gl_PointSize = min(uPixelRatio * 5.0 / max(d, 0.5), 3.0 * uPixelRatio);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uExposure;
      uniform float uCamY;
      varying float vA;
      void main() {
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vA * 0.35 * step(uCamY, 0.0);
        gl_FragColor = vec4(vec3(0.8, 0.92, 0.95) * a * uExposure, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const dust = new THREE.Points(dGeo, dMat);
  dust.frustumCulled = false;
  dust.renderOrder = 11;
  group.add(dust);

  // ---------------- sbuffi di bollicine (al tocco, scia del dito) ----------------
  const MAXP = 360;
  const puffGeo = new THREE.InstancedBufferGeometry().copy(new THREE.IcosahedronGeometry(1, 2));
  const pSpawn = new Float32Array(MAXP * 4);
  const pPar = new Float32Array(MAXP * 4);
  for (let i = 0; i < MAXP; i++) pSpawn[i * 4 + 3] = -1e4;
  const spawnAttr = new THREE.InstancedBufferAttribute(pSpawn, 4);
  const parAttr = new THREE.InstancedBufferAttribute(pPar, 4);
  spawnAttr.setUsage(THREE.DynamicDrawUsage);
  parAttr.setUsage(THREE.DynamicDrawUsage);
  puffGeo.setAttribute('aSpawn', spawnAttr);
  puffGeo.setAttribute('aPar', parAttr);
  puffGeo.instanceCount = MAXP;
  const puffMat = new THREE.ShaderMaterial({
    uniforms: shared,
    ...GLASS,
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec4 aSpawn;
      attribute vec4 aPar;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vFade;
      ${BUBBLE_VERT}
      void main() {
        float age = uTime - aSpawn.w;
        float life = 4.0 + aPar.z * 2.0;
        float on = step(0.0, age) * step(age, life);
        float ph = aPar.z * 6.2831;
        // escono dal punto toccato, poi salgono a zigzag
        vec3 dir = normalize(vec3(cos(ph), sin(ph * 2.3) * 0.7, sin(ph)));
        vec3 o = aSpawn.xyz + dir * aPar.w * (1.0 - exp(-age * 4.5));
        o.y += aPar.y * age + 0.04 * age * age;
        float r = max(aPar.x * (0.6 + 0.4 * smoothstep(0.0, 0.3, age)) * on, 1e-5);
        float amp = 0.004 + r * 1.4;
        float w = age * 9.0 + ph;
        o.x += sin(w) * amp;
        o.z += cos(w * 1.13) * amp;
        vec3 n;
        vec4 wp = vec4(o + bubbleShape(position, r, uTime, aPar.z, n), 1.0);
        vWorldPos = wp.xyz;
        vNormal = n;
        gl_Position = projectionMatrix * viewMatrix * wp;
        vFade = on * smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(life - 1.2, life, age)) * bubbleFade(gl_Position, r) * (1.0 - smoothstep(-0.7, -0.25, o.y));
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uExposure;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vFade;
      ${FOG_GLSL}
      ${BUBBLE_FRAG}
      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec4 c = bubbleColor(normalize(vNormal), V, length(cameraPosition - vWorldPos), -vWorldPos.y);
        gl_FragColor = vec4(c.rgb * uExposure, c.a) * vFade;
        #include <colorspace_fragment>
      }
    `,
  });
  const puffs = new THREE.Mesh(puffGeo, puffMat);
  puffs.frustumCulled = false;
  puffs.renderOrder = 13;
  group.add(puffs);
  let head = 0, now = 0;
  const pt = new THREE.Vector3();
  function spawn(at, count, spread = 0.3, size = 1) {
    for (let k = 0; k < count; k++) {
      const i = head++ % MAXP;
      pSpawn[i * 4] = at.x + (Math.random() - 0.5) * 0.08;
      pSpawn[i * 4 + 1] = Math.min(at.y, -0.35) + (Math.random() - 0.5) * 0.08;
      pSpawn[i * 4 + 2] = at.z + (Math.random() - 0.5) * 0.08;
      pSpawn[i * 4 + 3] = now + Math.random() * 0.08 * (count > 3 ? 1 : 0);
      pPar[i * 4] = (0.01 + Math.random() ** 1.8 * 0.04) * size;
      pPar[i * 4 + 1] = 0.25 + Math.random() * 0.25;
      pPar[i * 4 + 2] = Math.random();
      pPar[i * 4 + 3] = spread * (0.3 + Math.random() * 0.7);
    }
    spawnAttr.needsUpdate = true;
    parAttr.needsUpdate = true;
  }
  // punto nell'acqua sotto il dito, a qualche metro
  const pointOn = (ray, d) => ray.at(d, pt);

  // ---------------- due squaletti ----------------
  const sharks = createSharks(shared);
  group.add(sharks.group);
  // girano larghi attorno alla statua (senza toccarla)
  const sharkSpots = [art.center.clone().add(new THREE.Vector3(-1.6, 0, -2.6)), art.center.clone().add(new THREE.Vector3(1.6, 0, 2.6))];

  // puntatore: raggio dall'occhio; per il dito resta attivo un attimo dopo il tocco
  let pushTarget = 0, pushHold = 0;
  function setPointer(ray, hold = 0) {
    if (ray) {
      shared.uRayO.value.copy(ray.origin);
      shared.uRayD.value.copy(ray.direction);
      pushTarget = 1;
      pushHold = hold;
    } else if (pushHold <= 0) pushTarget = 0;
  }
  function burst(ray) {
    const shark = sharks.poke(ray);
    if (shark) spawn(shark, 30, 0.4, 1.2);
    spawn(pointOn(ray, 4.2), 34, 0.5);
  }
  function trail(ray) {
    spawn(pointOn(ray, 4.0), 1 + (Math.random() < 0.5 ? 1 : 0), 0.1, 0.9);
  }

  let lastTime = 0;
  function update(camera, time, dpr) {
    const dt = Math.min(0.1, Math.max(0, time - lastTime));
    lastTime = time;
    now = time;
    pushHold -= dt;
    if (pushHold <= 0 && !hoverActive) pushTarget = 0;
    shared.uPush.value += (pushTarget - shared.uPush.value) * (1 - Math.exp(-dt * 6));
    sharks.update(dt, sharkSpots);
    sharks.sharks.forEach((sh, i) => shared.uSharks.value[i].set(sh.mesh.position.x, sh.mesh.position.y, sh.mesh.position.z, sh.len));
    shared.uCamY.value = camera.position.y;
    shared.uViewH.value = window.innerHeight * dpr;
    dMat.uniforms.uPixelRatio.value = dpr;
    // visibile solo con la telecamera sott'acqua (da sopra l'acqua torbida non lascia vedere il fondo)
    group.visible = camera.position.y < 0.0 && camera.position.x < -20;
    sculpture.update(time, dt);
  }

  let hoverActive = false;
  return {
    group,
    sculpture,
    update,
    shared,
    sharks,
    burst,
    trail,
    // ray: THREE.Ray o null; hover = true per il mouse (resta attivo finché si muove)
    setPointer(ray, { hold = 0, hover = false } = {}) {
      hoverActive = hover && !!ray;
      setPointer(ray, hold);
    },
  };
}
