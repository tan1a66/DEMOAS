import * as THREE from 'three';
import { GLSL_COMMON } from './materials.js';
import { FOG_GLSL } from './water-glsl.js';
import { createBettas } from './bettas.js';
import { createSculpture } from './sculpture.js';

// Sott'acqua, sul fondale: la statua da girare col dito (src/sculpture.js); bollicine che salgono verso
// la superficie, pulviscolo e tre pesci combattenti dalle pinne lunghe (src/bettas.js).
// Interazione: il puntatore (o il dito) scosta le bollicine; tenendo premuto nell'acqua sotto il dito
// cresce una bolla che, lasciata, sale fino alla superficie; un tocco breve libera qualche bollicina,
// trascinare lascia una scia; toccare un pesce lo fa scattare via.
// Tutto sfuma nel colore dell'acqua con la distanza.

import { WATER } from './water-glsl.js';
export { WATER };

// Bolle d'aria come quelle vere. Forma: sempre tonde; le grandi appena schiacciate, col bordo che
// trema. Ognuna è un quadrato rivolto alla telecamera e la sfera è calcolata pixel per pixel (normale,
// bordo morbido): tonda a qualsiasi grandezza, senza spigoli.
// Ottica: una bolla d'aria nell'acqua è una lente divergente. Al centro si vede quello che c'è dietro,
// rimpicciolito (la scena opaca, che three.js disegna prima in una texture per i materiali
// "trasmissivi"); oltre l'angolo critico (~49°) la luce si riflette tutta, quindi il bordo è un anello
// a specchio che riflette l'acqua attorno (più chiara verso l'alto), con il riflesso del sole in alto.
// Le bolle più piccole di un paio di pixel si attenuano invece di sfarfallare.
const BUBBLE_VERT = /* glsl */ `
  uniform float uViewH;
  varying vec2 vQ;
  varying vec3 vCenter;
  varying float vR;
  varying float vSeed;
  varying vec2 vCuv;
  varying vec2 vRuv;
  // il quadrato attorno al centro c (raggio r), rivolto alla telecamera; vCuv e vRuv: centro e raggio
  // della bolla sullo schermo (in coordinate di texture)
  vec4 bubbleQuad(vec2 corner, vec3 c, float r, float seed) {
    vQ = corner * 1.1;
    vCenter = c;
    vR = r;
    vSeed = seed;
    vec4 vc = viewMatrix * vec4(c, 1.0);
    vec4 cc = projectionMatrix * vc;
    vCuv = cc.xy / cc.w * 0.5 + 0.5;
    vRuv = vec2(projectionMatrix[0][0], projectionMatrix[1][1]) * r / max(cc.w, 1e-3) * 0.5;
    return projectionMatrix * vec4(vc.xyz + vec3(vQ * r, 0.0), 1.0);
  }
  float bubbleFade(vec4 clip, float r) {
    float px = r * projectionMatrix[1][1] * uViewH * 0.5 / max(clip.w, 1e-3);
    return smoothstep(0.5, 1.8, px);
  }
`;
const BUBBLE_FS = /* glsl */ `
  uniform float uTime;
  uniform float uExposure;
  uniform sampler2D transmissionSamplerMap;
  varying vec2 vQ;
  varying vec3 vCenter;
  varying float vR;
  varying float vSeed;
  varying vec2 vCuv;
  varying vec2 vRuv;
  varying float vFade;
  ${FOG_GLSL}
  void main() {
    // la sfera vista dalla telecamera: normale per pixel e bordo morbido
    float big = smoothstep(0.016, 0.04, vR);
    vec2 q = vec2(vQ.x, vQ.y / mix(1.0, 0.9, big));
    q /= 1.0 + big * 0.03 * sin(3.0 * atan(q.y, q.x) + uTime * 5.0 + vSeed * 6.28);
    float d = length(q);
    float cover = (1.0 - smoothstep(1.0 - max(fwidth(d) * 1.5, 1e-3), 1.0, d)) * vFade;
    if (cover <= 0.0) discard;
    // la normale nel riferimento della bolla rivolto alla telecamera (non allo schermo: ai lati dello
    // schermo una sfera si vede di sbieco), così l'anello resta uguale tutto attorno
    vec3 V = normalize(cameraPosition - vCenter);
    vec3 X = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    X = normalize(X - V * dot(X, V));
    vec3 N = normalize(q.x * X + q.y * cross(V, X) + sqrt(max(1.0 - d * d, 0.0)) * V);
    vec3 P = vCenter + N * vR;
    float c = clamp(dot(N, V), 0.0, 1.0);
    // dietro: dritto (per la nebbia) e attraverso la lente (rimpicciolito verso il bordo)
    vec3 behind = texture2D(transmissionSamplerMap, vCuv + vQ * vRuv).rgb;
    vec3 refr = texture2D(transmissionSamplerMap, vCuv + vQ * vRuv * (1.0 + 1.9 * d)).rgb;
    // riflesso: totale sull'anello esterno, debole al centro
    float tir = 1.0 - smoothstep(0.6, 0.72, c);
    float refl = mix(0.03 + 0.2 * pow(1.0 - c, 5.0), 1.0, tir);
    vec3 R = reflect(-V, N);
    vec3 env = mix(waterColor(R) * 1.5, vec3(0.92, 0.98, 1.0), 0.22) + vec3(0.85, 0.97, 1.0) * pow(max(R.y, 0.0), 3.0) * 0.9;
    float spec = pow(max(dot(R, normalize(vec3(-0.25, 1.0, 0.2))), 0.0), 120.0) * 3.0;
    // la scena dietro ha già l'esposizione; riflesso e sole no
    vec3 col = refr * (1.0 - refl) + (env * refl + spec) * uExposure;
    // un filo più scuro dove finisce la lente e comincia lo specchio
    col *= 1.0 - 0.22 * smoothstep(0.56, 0.66, c) * (1.0 - smoothstep(0.66, 0.78, c));
    // lontano la bolla si perde nell'acqua (dietro c'è già la nebbia giusta)
    col = mix(behind, col, waterFog(length(cameraPosition - P), -P.y));
    gl_FragColor = vec4(col * cover, cover);
    #include <colorspace_fragment>
  }
`;
// le bolle sono un materiale "trasmissivo" di three.js (così ricevono la texture della scena opaca
// dietro di loro) con lo shader sostituito dal nostro; alfa premoltiplicata
function bubbleMaterial(key, uniforms, vertexShader) {
  const m = new THREE.MeshPhysicalMaterial({
    transmission: 1,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  m.customProgramCacheKey = () => `bubble-${key}`;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = vertexShader;
    shader.fragmentShader = BUBBLE_FS;
  };
  return m;
}

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
    uFish: { value: [0, 1, 2].map(() => new THREE.Vector4(0, 99, 0, 1)) },
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
  const count = Math.round((quality.tier === 'low' ? 1.6 : 3) * Math.max(60, routeLen));
  const H = 9.6; // colonna d'acqua percorsa, dal fondo a sotto la superficie
  const small = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2));
  const aOffset = new Float32Array(count * 3);
  const aParams = new Float32Array(count * 4);
  const NSTREAM = quality.tier === 'low' ? 3 : 4;
  const NEAR = [[-0.4, 2.7], [0.3, -2.9], [2.6, 1.9]]; // attorno alla statua (x verso la telecamera, z)
  const streams = Array.from({ length: NSTREAM }, (_, k) => {
    const p = k < NEAR.length
      ? art.base.clone().add(new THREE.Vector3(NEAR[k][0] + (Math.random() - 0.5) * 0.3, 0, NEAR[k][1] + (Math.random() - 0.5) * 0.3))
      : along(16, new THREE.Vector3());
    // grandi e piccole: una colonna di bolle grandi accanto alla statua, le altre di misure diverse
    const r = k === 0 ? 0.026 + Math.random() * 0.01 : k < NEAR.length ? 0.009 + Math.random() * 0.006 : 0.006 + Math.random() ** 1.5 * 0.026;
    return { x: p.x, z: p.z, r, speed: 0.16 + Math.random() * 0.05, seed: Math.random() * 100, n: 0 };
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
      r = 0.006 + Math.random() ** 2 * 0.05;
      speed = 0.2 + Math.random() * 0.12;
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
      r = 0.006 + Math.random() ** 2.4 * 0.05;
      speed = 0.15 + r * 2.0 + Math.random() * 0.03;
      seed = Math.random() * 100;
    }
    aOffset.set([x, y, z], i * 3);
    aParams.set([r, speed, seed, 0], i * 4);
  }
  small.setAttribute('aOffset', new THREE.InstancedBufferAttribute(aOffset, 3));
  small.setAttribute('aParams', new THREE.InstancedBufferAttribute(aParams, 4));
  small.instanceCount = count;
  const smallMat = bubbleMaterial('small', shared, /* glsl */ `
      uniform float uTime;
      uniform vec3 uRayO, uRayD;
      uniform float uPush;
      attribute vec3 aOffset;
      attribute vec4 aParams; // raggio, velocità di salita, seme
      varying float vFade;
      ${BUBBLE_VERT}
      void main() {
        float H = ${H.toFixed(1)};
        float h = mod(aOffset.y + H + uTime * aParams.y + aParams.z, H); // quota dal fondo
        vec3 o = vec3(aOffset.x, -H - 0.2 + h, aOffset.z);
        // salendo la pressione cala e la bolla si allarga
        float r = aParams.x * (1.0 + 0.3 * h / H);
        // zigzag: quasi niente per le piccole, ampio per le grandi
        float amp = 0.002 + r * 0.45;
        float w = h * 4.0 + aParams.z + uTime * 0.12;
        o.x += sin(w) * amp;
        o.z += cos(w * 1.13) * amp;
        // il puntatore le scosta (distanza dal raggio che parte dall'occhio)
        vec3 rel = o - uRayO;
        vec3 off = rel - uRayD * max(dot(rel, uRayD), 0.0);
        float dd = length(off);
        o += off / max(dd, 1e-3) * uPush * 0.45 * smoothstep(1.0, 0.0, dd);
        gl_Position = bubbleQuad(position.xy, o, r, aParams.z);
        // nascono sul fondo, scoppiano appena sotto la superficie
        vFade = bubbleFade(gl_Position, r) * smoothstep(0.0, 0.3, h) * (1.0 - smoothstep(-0.7, -0.25, o.y));
      }
  `);
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
  const MAXP = 600;
  const puffGeo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2));
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
  const puffMat = bubbleMaterial('puff', shared, /* glsl */ `
      uniform float uTime;
      attribute vec4 aSpawn;
      attribute vec4 aPar;
      varying float vFade;
      ${BUBBLE_VERT}
      void main() {
        float age = uTime - aSpawn.w;
        // spread 0: la bolla cresciuta sotto il dito, libera: sale fino alla superficie
        float free = step(aPar.w, 0.0);
        float life = mix(4.0 + aPar.z * 2.0, 40.0, free);
        float on = step(0.0, age) * step(age, life);
        float ph = aPar.z * 6.2831;
        // escono dal punto toccato, poi salgono a zigzag
        vec3 dir = normalize(vec3(cos(ph), sin(ph * 2.3) * 0.7, sin(ph)));
        vec3 o = aSpawn.xyz + dir * aPar.w * (1.0 - exp(-age * 7.0));
        o.y += aPar.y * age + 0.04 * age * age * (1.0 - free); // la bolla libera sale costante
        float r = max(aPar.x * mix(0.6 + 0.4 * smoothstep(0.0, 0.3, age), 1.0, free) * on, 1e-5);
        float amp = 0.002 + r * 0.45;
        float w = age * 5.0 + ph;
        o.x += sin(w) * amp;
        o.z += cos(w * 1.13) * amp;
        gl_Position = bubbleQuad(position.xy, o, r, aPar.z);
        vFade = on * max(smoothstep(0.0, 0.1, age), free) * (1.0 - smoothstep(life - 1.2, life, age)) * bubbleFade(gl_Position, r) * (1.0 - smoothstep(-0.7, -0.25, o.y));
      }
  `);
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
      pPar[i * 4] = (0.008 + Math.random() ** 1.6 * 0.055) * size;
      pPar[i * 4 + 1] = 0.18 + Math.random() * 0.12;
      pPar[i * 4 + 2] = Math.random();
      pPar[i * 4 + 3] = spread * (0.3 + Math.random() * 0.7);
    }
    spawnAttr.needsUpdate = true;
    parAttr.needsUpdate = true;
  }
  // punto nell'acqua sotto il dito, a qualche metro
  const pointOn = (ray, d) => ray.at(d, pt);

  // ---------------- tre pesci combattenti ----------------
  const bettas = createBettas(shared, { art });
  group.add(bettas.group);

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
  // ---------------- la bolla che cresce sotto il dito ----------------
  const heldU = { uHeldPos: { value: new THREE.Vector3() }, uHeldR: { value: 0 } };
  const held = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bubbleMaterial('held', { ...shared, ...heldU }, /* glsl */ `
      uniform float uTime;
      uniform vec3 uHeldPos;
      uniform float uHeldR;
      varying float vFade;
      ${BUBBLE_VERT}
      void main() {
        gl_Position = bubbleQuad(position.xy, uHeldPos, uHeldR, 1.7);
        vFade = bubbleFade(gl_Position, uHeldR);
      }
  `));
  held.frustumCulled = false;
  held.renderOrder = 14;
  held.visible = false;
  group.add(held);
  const HELD_D = 3.4; // distanza dalla telecamera
  let hold = null;
  // premuto: nasce una bolla piccola sotto il dito
  function holdStart(ray) {
    hold = { t0: now };
    ray.at(HELD_D, heldU.uHeldPos.value).setY(Math.min(heldU.uHeldPos.value.y, -0.6));
    heldU.uHeldR.value = 0.012;
    held.visible = true;
  }
  function holdMove(ray) {
    if (hold) ray.at(HELD_D, heldU.uHeldPos.value).setY(Math.min(heldU.uHeldPos.value.y, -0.6));
  }
  // il dito si è spostato (uno swipe, non una pressione): niente bolla
  function holdCancel() {
    hold = null;
    held.visible = false;
  }
  // lasciato: dopo un tocco breve qualche bollicina (e il pesce toccato scatta via), altrimenti la
  // bolla cresciuta si stacca e sale, più veloce quanto più è grande
  function holdEnd(ray) {
    if (!hold) return;
    const at = heldU.uHeldPos.value, r = heldU.uHeldR.value;
    held.visible = false;
    if (now - hold.t0 < 0.25) {
      const fish = ray && bettas.poke(ray);
      if (fish) spawn(fish, 14, 0.3, 1.0);
      spawn(at, 8, 0.25, 0.6);
    } else {
      const i = head++ % MAXP;
      pSpawn.set([at.x, at.y, at.z, now], i * 4);
      pPar.set([r, 0.12 + r * 1.2, Math.random(), 0], i * 4);
      spawnAttr.needsUpdate = true;
      parAttr.needsUpdate = true;
    }
    hold = null;
  }
  function trail(ray) {
    spawn(pointOn(ray, 4.0), 1, 0.1, 1);
  }

  let lastTime = 0;
  function update(camera, time, dpr) {
    const dt = Math.min(0.1, Math.max(0, time - lastTime));
    lastTime = time;
    now = time;
    pushHold -= dt;
    if (pushHold <= 0 && !hoverActive) pushTarget = 0;
    shared.uPush.value += (pushTarget - shared.uPush.value) * (1 - Math.exp(-dt * 7));
    bettas.update(dt);
    bettas.fish.forEach((f, i) => shared.uFish.value[i].set(f.mesh.position.x, f.mesh.position.y, f.mesh.position.z, f.len));
    shared.uCamY.value = camera.position.y;
    shared.uViewH.value = window.innerHeight * dpr;
    dMat.uniforms.uPixelRatio.value = dpr;
    // visibile solo con la telecamera sott'acqua (da sopra l'acqua torbida non lascia vedere il fondo)
    group.visible = camera.position.y < 0.0 && camera.position.x < -20;
    sculpture.update(time, dt);
    // la bolla tenuta cresce piano (fino a ~8 cm di raggio) e trema appena
    if (hold) heldU.uHeldR.value = 0.01 + 0.07 * (1 - Math.exp(-(now - hold.t0) / 1.6));
  }

  let hoverActive = false;
  return {
    group,
    sculpture,
    update,
    shared,
    bettas,
    holdStart,
    holdMove,
    holdEnd,
    holdCancel,
    trail,
    // ray: THREE.Ray o null; hover = true per il mouse (resta attivo finché si muove)
    setPointer(ray, { hold = 0, hover = false } = {}) {
      hoverActive = hover && !!ray;
      setPointer(ray, hold);
    },
  };
}
