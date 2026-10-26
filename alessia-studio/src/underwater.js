import * as THREE from 'three';
import { GLSL_COMMON } from './materials.js';
import { FOG_GLSL } from './water-glsl.js';
import { createSharks } from './sharks.js';
import { createSculpture } from './sculpture.js';
import { createSchool } from './school.js';

// Sott'acqua, sul fondale: la scultura da girare col dito (src/sculpture.js) e il banco di pesci di
// vetro che le gira attorno (src/school.js); bollicine che salgono verso la superficie, pulviscolo e
// due squaletti.
// Interazione: il puntatore (o il dito) scosta le bollicine e i pesci; un tocco nell'acqua libera uno
// sbuffo di bollicine e fa scappare i pesci vicini, trascinare lascia una scia; toccare uno squalo lo
// fa scattare via.
// Tutto sfuma nel colore dell'acqua con la distanza.

import { WATER } from './water-glsl.js';
export { WATER };

export function createUnderwater(lights, { art, artCam, quality }) {
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
  };

  // ---------------- il fondale, la scultura e il banco di pesci ----------------
  const sculpture = createSculpture(shared, { base: art.base });
  group.add(sculpture.group);
  const school = createSchool(shared, { art: { center: sculpture.center, radius: 2.5 }, cam: artCam, quality });
  group.add(school.group);

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

  // ---------------- bollicine che salgono ----------------
  const count = Math.round((quality.tier === 'low' ? 2.2 : 4.5) * Math.max(60, routeLen));
  const small = new THREE.InstancedBufferGeometry().copy(new THREE.IcosahedronGeometry(1, 2));
  const aOffset = new Float32Array(count * 3);
  const aParams = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    // più fitte vicino al punto del tuffo, poi sparse lungo il percorso
    const nearDive = i < count * 0.3;
    if (nearDive) tmpP.set(-28.5 + (Math.random() - 0.5) * 5, 0, -13.5 + (Math.random() - 0.5) * 5);
    else along(14, tmpP);
    aOffset[i * 3] = tmpP.x;
    aOffset[i * 3 + 1] = -Math.random() * 9 - 0.3;
    aOffset[i * 3 + 2] = tmpP.z;
    aParams[i * 4] = 0.008 + Math.random() ** 3 * 0.06; // raggio
    aParams[i * 4 + 1] = 0.35 + Math.random() * 0.6; // velocità di salita
    aParams[i * 4 + 2] = Math.random() * 100; // fase
    aParams[i * 4 + 3] = nearDive ? 1 : 0;
  }
  small.setAttribute('aOffset', new THREE.InstancedBufferAttribute(aOffset, 3));
  small.setAttribute('aParams', new THREE.InstancedBufferAttribute(aParams, 4));
  small.instanceCount = count;
  const smallMat = new THREE.ShaderMaterial({
    uniforms: shared,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uRayO, uRayD;
      uniform float uPush;
      attribute vec3 aOffset;
      attribute vec4 aParams;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        float H = 9.5;
        float t = uTime * aParams.y + aParams.z;
        vec3 o = aOffset;
        o.y = -H + mod(o.y + H + t, H) - 0.2;
        o.x += sin(t * 1.7 + aParams.z) * 0.12;
        o.z += cos(t * 1.3 + aParams.z * 0.7) * 0.12;
        float r = aParams.x * (0.8 + 0.2 * sin(t * 5.0));
        // il puntatore le scosta (distanza dal raggio che parte dall'occhio)
        vec3 rel = o - uRayO;
        vec3 off = rel - uRayD * max(dot(rel, uRayD), 0.0);
        float dd = length(off);
        o += off / max(dd, 1e-3) * uPush * 0.55 * smoothstep(1.0, 0.0, dd);
        vec4 wp = vec4(o + position * r, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normal;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uExposure;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      ${FOG_GLSL}
      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - min(abs(dot(normalize(vNormal), V)), 1.0), 2.0);
        float dist = length(cameraPosition - vWorldPos);
        float a = (0.12 + 0.75 * fres) * waterFog(dist, -vWorldPos.y);
        gl_FragColor = vec4(vec3(0.85, 0.95, 1.0) * a * uExposure, 1.0);
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
  const puffGeo = new THREE.InstancedBufferGeometry().copy(new THREE.IcosahedronGeometry(1, 1));
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
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec4 aSpawn;
      attribute vec4 aPar;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vLife;
      void main() {
        float age = uTime - aSpawn.w;
        float life = 2.6 + aPar.z * 1.4;
        float on = step(0.0, age) * step(age, life);
        float ph = aPar.z * 6.2831;
        // escono dal punto toccato, poi salgono ondeggiando e accelerando
        vec3 dir = normalize(vec3(cos(ph), sin(ph * 2.3) * 0.7, sin(ph)));
        vec3 o = aSpawn.xyz + dir * aPar.w * (1.0 - exp(-age * 4.5));
        o.y += aPar.y * age + 0.16 * age * age;
        o.x += sin(age * 5.0 + ph) * 0.05 * age;
        o.z += cos(age * 4.2 + ph) * 0.05 * age;
        float r = aPar.x * (0.5 + 0.5 * smoothstep(0.0, 0.35, age)) * (1.0 + 0.12 * sin(age * 9.0 + ph)) * on;
        vLife = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(life - 0.9, life, age));
        vec4 wp = vec4(o + position * r, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normal;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uExposure;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vLife;
      ${FOG_GLSL}
      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - min(abs(dot(normalize(vNormal), V)), 1.0), 2.0);
        float dist = length(cameraPosition - vWorldPos);
        float a = (0.16 + 0.95 * fres) * vLife * waterFog(dist, -vWorldPos.y);
        gl_FragColor = vec4(vec3(0.88, 0.97, 1.0) * a * uExposure, 1.0);
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
      pPar[i * 4] = (0.025 + Math.random() ** 2.5 * 0.12) * size;
      pPar[i * 4 + 1] = 0.45 + Math.random() * 0.7;
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
  // girano larghi attorno alla scultura (senza toccarla), passando tra i pesci
  const sharkSpots = [art.center.clone().add(new THREE.Vector3(-1.6, 0, -2.6)), art.center.clone().add(new THREE.Vector3(1.6, 0, 2.6))];
  const predators = sharks.sharks.map((sh) => sh.mesh.position);

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
    // i pesci vicini scappano
    school.scatter(ray);
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
    shared.uCamY.value = camera.position.y;
    dMat.uniforms.uPixelRatio.value = dpr;
    // visibile solo con la telecamera sott'acqua (da sopra l'acqua torbida non lascia vedere il fondo)
    group.visible = camera.position.y < 0.0 && camera.position.x < -20;
    sculpture.update(time, dt);
    if (group.visible) school.update(dt, time, predators, camera.position);
  }

  let hoverActive = false;
  return {
    group,
    sculpture,
    school,
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
