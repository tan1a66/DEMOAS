import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FOG_GLSL } from './water-glsl.js';
import { PALETTE } from './layout.js';
import { SEABED_Y } from './camera-path.js';

// Il banco di pesci di vetro: qualche centinaio di pesciolini quasi trasparenti, bioluminescenti, con
// lo scheletro, l'occhio e gli organi verde neon che si vedono attraverso il corpo. Il banco gira
// attorno alla scultura: le passa da dietro, viene verso lo schermo e riparte.
// Interazione: il puntatore li fa scostare, trascinare il dito se li porta dietro, un tocco li fa
// scappare (e si accendono); gli squaletti che passano aprono un varco.
// Simulazione sulla CPU (una legge di sterzata per pesce, senza confronti tra coppie), disegno in
// un'unica chiamata (instancing). Il corpo è un guscio di vetro: dove il raggio di vista incontra il
// piano di mezzo del pesce, lo shader disegna lo scheletro come visto ai raggi X.

const L = 0.22; // lunghezza di un pesce (m)

function fishGeometry() {
  // corpo: profilo ruotato attorno all'asse (muso verso +z), stretto di lato
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12; // 0 coda, 1 muso
    pts.push(new THREE.Vector2(Math.max(1e-3, 0.05 * Math.sin(Math.PI * t ** 1.45) ** 0.8), (t - 0.5) * L));
  }
  const body = new THREE.LatheGeometry(pts, 10).rotateX(Math.PI / 2).scale(0.42, 1, 1).toNonIndexed();
  body.deleteAttribute('uv');
  // coda a forcella, visibile dai due lati
  const z0 = -L / 2 + 0.012, z1 = -L / 2 - 0.06, zn = z1 + 0.026;
  const tri = [[0, 0, z0], [0, 0.05, z1], [0, 0, zn], [0, 0, z0], [0, 0, zn], [0, -0.05, z1]];
  const both = [...tri, ...tri.map((_, i) => tri[i - (i % 3) + 2 - (i % 3)])];
  const tail = new THREE.BufferGeometry();
  tail.setAttribute('position', new THREE.Float32BufferAttribute(both.flat(), 3));
  tail.setAttribute('normal', new THREE.Float32BufferAttribute(both.map((_, i) => [i < 6 ? 1 : -1, 0, 0]).flat(), 3));
  return mergeGeometries([body, tail]);
}

// art: { center, radius } della scultura (da non attraversare); cam: posizione della telecamera alla
// sosta (il banco le passa vicino); quality: livello
export function createSchool(shared, { art, cam, quality }) {
  const N = quality.tier === 'low' ? 130 : 220;
  const R = 1.3; // raggio del banco
  const geo = new THREE.InstancedBufferGeometry().copy(fishGeometry());
  const pos = new Float32Array(N * 4); // posizione, fase del colpo di coda
  const vel = new Float32Array(N * 3); // velocità
  const dir = new Float32Array(N * 3); // velocità smorzata (direzione del muso)
  const par = new Float32Array(N * 3); // scala, bagliore, seme
  const lane = new Float32Array(N * 4); // raggio, quota, velocità di giro, agilità
  const panic = new Float32Array(N);

  // ---------------- il giro attorno alla scultura ----------------
  // quattro punti attorno all'opera, ricalcolati dalla posizione della telecamera alla sosta: dietro,
  // a destra, vicino allo schermo, a sinistra
  const way = [0, 1, 2, 3].map(() => new THREE.Vector3());
  const ax = new THREE.Vector3(), rt = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function waypoints() {
    ax.subVectors(art.center, cam).setY(0);
    const D = ax.length();
    ax.multiplyScalar(1 / D);
    rt.crossVectors(ax, UP);
    const S = art.center;
    way[0].copy(S).addScaledVector(ax, 3.4).addScaledVector(UP, 0.9);
    way[1].copy(S).addScaledVector(rt, 3.9).addScaledVector(ax, 0.2).addScaledVector(UP, 0.3);
    way[2].copy(S).addScaledVector(ax, -D * 0.55).addScaledVector(rt, 0.5).addScaledVector(UP, -0.2);
    way[3].copy(S).addScaledVector(rt, -3.9).addScaledVector(ax, 0.4).addScaledVector(UP, 0.6);
  }
  // Catmull-Rom chiusa sui quattro punti, s in [0, 4)
  function loopAt(s, out) {
    const i = Math.floor(s), t = s - i;
    const p0 = way[(i + 3) % 4], p1 = way[i % 4], p2 = way[(i + 1) % 4], p3 = way[(i + 2) % 4];
    const t2 = t * t, t3 = t2 * t;
    for (const k of ['x', 'y', 'z']) {
      out[k] = 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3);
    }
    return out;
  }

  waypoints();
  const C = loopAt(0, new THREE.Vector3()), Cv = new THREE.Vector3(), goal = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const r = R * Math.sqrt(0.06 + 0.94 * Math.random());
    const h = (Math.random() * 2 - 1) * R * 0.6 * Math.sqrt(Math.max(0.05, 1 - (r / R) ** 2));
    lane.set([r, h, 0.45 + Math.random() * 0.45, 2.2 + Math.random() * 2.2], i * 4);
    const a = Math.random() * Math.PI * 2;
    pos.set([C.x + Math.cos(a) * r, C.y + h, C.z + Math.sin(a) * r, Math.random() * 6.28], i * 4);
    vel.set([Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], i * 3);
    dir.set([Math.sin(a), 0, -Math.cos(a)], i * 3);
    par.set([1.1 + Math.random() * 0.5, 0, Math.random()], i * 3); // lunghi 25-35 cm
  }
  const attr = (arr, n) => new THREE.InstancedBufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
  const posAttr = attr(pos, 4), dirAttr = attr(dir, 3), parAttr = attr(par, 3);
  geo.setAttribute('aPos', posAttr);
  geo.setAttribute('aVel', dirAttr);
  geo.setAttribute('aPar', parAttr);
  geo.instanceCount = N;

  const mat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uGreen: { value: new THREE.Color(PALETTE.cushion) } },
    transparent: true,
    depthWrite: false,
    // vetro: il corpo vela appena lo sfondo, la luce verde si somma (alfa premoltiplicata)
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `
      attribute vec4 aPos;
      attribute vec3 aVel;
      attribute vec3 aPar;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec3 vLocal;
      varying vec3 vRay;
      varying float vGlow;
      varying float vSeed;
      void main() {
        float sp = length(aVel);
        vec3 f = sp > 1e-4 ? aVel / sp : vec3(0.0, 0.0, 1.0);
        vec3 r = cross(vec3(0.0, 1.0, 0.0), f);
        float rl = length(r);
        r = rl > 1e-3 ? r / rl : vec3(1.0, 0.0, 0.0);
        vec3 u = cross(f, r);
        // colpo di coda: la parte posteriore ondeggia di lato, di più verso la coda
        vec3 p = position;
        float back = clamp(0.3 - p.z / 0.11, 0.0, 1.7);
        p.x += sin(aPos.w - p.z * 22.0) * 0.016 * back * back;
        vec3 wp = aPos.xyz + (r * p.x + u * p.y + f * p.z) * aPar.x;
        vNormal = r * normal.x + u * normal.y + f * normal.z;
        vWorldPos = wp;
        vLocal = position;
        vec3 d = wp - cameraPosition;
        vRay = vec3(dot(d, r), dot(d, u), dot(d, f));
        vGlow = aPar.y;
        vSeed = aPar.z;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uExposure;
      uniform vec3 uGreen;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec3 vLocal;
      varying vec3 vRay;
      varying float vGlow;
      varying float vSeed;
      ${FOG_GLSL}
      // px: dimensione di un pixel sul piano del pesce. Le linee più sottili di un pixel si attenuano
      // invece di sfarfallare, e le file fitte (costole, spine) diventano un bagliore uniforme
      float px;
      float band(float d, float w) {
        float ww = max(w, px * 1.25);
        return (1.0 - smoothstep(ww * 0.4, ww, abs(d))) * (w / ww);
      }
      float rows(float x, float step, float w) {
        float r = band((fract(x / step) - 0.5) * step, w);
        return mix(r, 1.3 * w / step, smoothstep(0.25 * step, 0.7 * step, px));
      }
      // lo scheletro ai raggi X sul piano di mezzo del pesce: q = (z, y), muso a z = +0.11
      float skeleton(vec2 q) {
        float t = clamp(q.x / 0.22 + 0.5, 0.0, 1.0);
        float hh = max(0.05 * pow(max(sin(3.14159 * pow(t, 1.45)), 0.0), 0.8), 1e-3);
        float yc = 0.002 + 0.01 * (t - 0.5);
        float dy = q.y - yc;
        float g = 0.0;
        // colonna, a vertebre
        g += band(dy, 0.0042) * step(-0.104, q.x) * step(q.x, 0.066) * (0.65 + 0.35 * smoothstep(0.15, 0.45, abs(fract(q.x / 0.009) - 0.5)));
        // costole sotto la colonna, inclinate all'indietro
        float below = clamp(-dy / hh, 0.0, 1.0);
        g += rows(q.x + dy * 0.6, 0.014, 0.0024) * step(dy, 0.0) * (1.0 - smoothstep(0.6, 0.85, below)) * smoothstep(-0.05, -0.034, q.x) * (1.0 - smoothstep(0.044, 0.056, q.x)) * 0.9;
        // spine dorsali sopra, più tenui
        float above = clamp(dy / hh, 0.0, 1.0);
        g += rows(q.x - dy * 0.8, 0.012, 0.0018) * step(0.0, dy) * (1.0 - smoothstep(0.45, 0.75, above)) * smoothstep(-0.1, -0.086, q.x) * (1.0 - smoothstep(0.045, 0.06, q.x)) * 0.5;
        // testa: occhio (anello e pupilla) e opercolo
        float de = length(q - vec2(0.08, yc + 0.012));
        g += band(de - 0.009, 0.0022) + (1.0 - smoothstep(max(0.0045, px) * 0.6, max(0.0045, px), de)) * 1.4;
        g += band(length(q - vec2(0.1, yc)) - 0.038, 0.0022) * step(q.x, 0.068) * step(abs(dy), 0.032) * 0.8;
        // organi: una sacca luminosa sotto la colonna
        g += (1.0 - smoothstep(0.5, 1.0, length((q - vec2(0.016, yc - 0.017)) / vec2(0.026, 0.011)))) * 0.6;
        // coda: raggi a ventaglio
        vec2 c = q - vec2(-0.104, yc);
        g += rows(atan(c.y, -c.x) * length(c), 0.01, 0.0018) * step(q.x, -0.106) * 0.7;
        return g;
      }
      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 2.0);
        // il raggio di vista attraversa il corpo: dove incontra il piano di mezzo c'è lo scheletro
        vec3 d = normalize(vRay);
        float side = smoothstep(0.12, 0.5, abs(d.x));
        float dx = abs(d.x) > 1e-3 ? d.x : 1e-3;
        vec3 m = vLocal + d * clamp(-vLocal.x / dx, 0.0, 0.08);
        px = length(fwidth(m.zy));
        float g = skeleton(m.zy) * side;
        // visto di fronte o di coda: la colonna è un punto luminoso al centro
        g += (1.0 - side) * 0.8 * (1.0 - smoothstep(0.006, 0.014, length(vLocal.xy)));
        // pulsa piano; spaventato si accende
        float pulse = 0.78 + 0.22 * sin(uTime * 1.6 + vSeed * 6.2831 + vLocal.z * 18.0) + vGlow * 1.4;
        float fog = waterFog(length(cameraPosition - vWorldPos), -vWorldPos.y);
        vec3 col = uGreen * min(g * 1.25 * pulse, 1.6) + mix(vec3(0.82, 0.97, 1.0), uGreen, 0.3) * fres * 0.22;
        gl_FragColor = vec4(col * fog * uExposure, (0.05 + 0.38 * fres) * fog);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  const group = new THREE.Group();
  group.add(mesh);

  // ---------------- interazione ----------------
  let follow = 0, loopS = 0;
  const ray = { o: new THREE.Vector3(), d: new THREE.Vector3(), on: false };
  const tmp = new THREE.Vector3(), T = new THREE.Vector3();
  // punto del raggio alla profondità del banco
  const atSchool = (r, out) => r.at(Math.max(0.8, tmp.subVectors(C, r.origin).dot(r.direction)), out);
  // il dito trascina il banco (per hold secondi)
  function point(r, hold = 1.2) {
    // a metà strada tra la telecamera e la scultura, fuori dall'opera
    r.at(Math.max(1.6, tmp.subVectors(art.center, r.origin).dot(r.direction) * 0.5), goal);
    goal.y = THREE.MathUtils.clamp(goal.y, SEABED_Y + 1.3, -1.5); // né nella sabbia né in superficie
    follow = hold;
    avoid(r);
  }
  // il puntatore (raggio dall'occhio) fa scostare i pesci; null = niente
  function avoid(r) {
    ray.on = !!r;
    if (r) {
      ray.o.copy(r.origin);
      ray.d.copy(r.direction);
    }
  }
  // un tocco: i pesci vicini scappano e si accendono
  function scatter(r) {
    atSchool(r, T);
    for (let i = 0; i < N; i++) {
      const k = i * 4, j = i * 3;
      const ex = pos[k] - T.x, ey = pos[k + 1] - T.y, ez = pos[k + 2] - T.z;
      const l = Math.hypot(ex, ey, ez) || 1e-3;
      if (l > 2.2) continue;
      const f = 1 - l / 2.2, s = (2.5 + 4.5 * f) / l;
      vel[j] += ex * s + (Math.random() - 0.5);
      vel[j + 1] += ey * s + (Math.random() - 0.5);
      vel[j + 2] += ez * s + (Math.random() - 0.5);
      panic[i] = Math.max(panic[i], 0.35 + 0.65 * f);
    }
  }
  // il raggio passa sul banco?
  const hit = (r) => r.distanceToPoint(C) < R * 1.25;

  // ---------------- simulazione ----------------
  const A = new THREE.Vector3(), prevC = new THREE.Vector3();
  function update(dt, time, predators = [], camPos = null) {
    if (dt <= 0) return;
    waypoints();
    // avanza lungo il giro a ~1,6 m/s (un giro in una quindicina di secondi)
    const i0 = Math.floor(loopS);
    loopS = (loopS + (dt * 1.6) / Math.max(1, way[i0].distanceTo(way[(i0 + 1) % 4]))) % 4;
    follow -= dt;
    if (follow <= 0) loopAt(loopS, goal);
    // il centro insegue il punto del giro (o il dito), con una velocità massima
    prevC.copy(C);
    tmp.subVectors(goal, C);
    const gl = tmp.length(), maxStep = dt * (follow > 0 ? 3.8 : 2.4);
    C.addScaledVector(tmp, Math.min(1 - Math.exp(-dt * 2.5), gl > 1e-6 ? maxStep / gl : 0));
    Cv.lerp(tmp.subVectors(C, prevC).multiplyScalar(1 / dt), 1 - Math.exp(-dt * 3));
    // asse del giro, un po' inclinato e mobile
    A.set(Math.sin(time * 0.31) * 0.2, 1, Math.cos(time * 0.23) * 0.2).normalize();
    const tight = follow > 0 ? 0.8 : 1;
    const S = art.center, SR = art.radius;
    for (let i = 0; i < N; i++) {
      const k = i * 4, j = i * 3, l4 = i * 4;
      const rx = pos[k] - C.x, ry = pos[k + 1] - C.y, rz = pos[k + 2] - C.z;
      const ya = rx * A.x + ry * A.y + rz * A.z;
      let qx = rx - A.x * ya, qy = ry - A.y * ya, qz = rz - A.z * ya;
      const dist = Math.hypot(qx, qy, qz) || 1e-3;
      qx /= dist;
      qy /= dist;
      qz /= dist;
      // il banco gira attorno al suo asse mentre viaggia
      const tx = A.y * qz - A.z * qy, ty = A.z * qx - A.x * qz, tz = A.x * qy - A.y * qx;
      const calm = 1 - 0.85 * panic[i], s = lane[l4 + 2];
      const pull = THREE.MathUtils.clamp((lane[l4] * tight - dist) * 1.8, -2.5, 2.5) * calm;
      const lift = THREE.MathUtils.clamp((lane[l4 + 1] * tight - ya) * 1.5, -2, 2) * calm;
      let dx = Cv.x * calm + tx * s + qx * pull + A.x * lift;
      let dy = Cv.y * calm + ty * s + qy * pull + A.y * lift;
      let dz = Cv.z * calm + tz * s + qz * pull + A.z * lift;
      // fuori dalla scultura, dalla telecamera e dagli squali
      const away = (cx, cy, cz, rad, k0) => {
        const ex = pos[k] - cx, ey = pos[k + 1] - cy, ez = pos[k + 2] - cz, e2 = ex * ex + ey * ey + ez * ez;
        if (e2 < rad * rad) {
          const e = Math.sqrt(e2) || 1e-3, f = ((rad - e) * k0) / e;
          dx += ex * f;
          dy += ey * f;
          dz += ez * f;
        }
      };
      away(S.x, S.y, S.z, SR, 6);
      if (camPos) away(camPos.x, camPos.y, camPos.z, 1.3, 7);
      for (const P of predators) away(P.x, P.y, P.z, 1.5, 5);
      // il puntatore: i pesci si scostano dal raggio
      if (ray.on) {
        const ox = pos[k] - ray.o.x, oy = pos[k + 1] - ray.o.y, oz = pos[k + 2] - ray.o.z;
        const t = ox * ray.d.x + oy * ray.d.y + oz * ray.d.z;
        const cx = ox - ray.d.x * t, cy = oy - ray.d.y * t, cz = oz - ray.d.z * t, c2 = cx * cx + cy * cy + cz * cz;
        if (t > 0 && c2 < 0.3) {
          const c = Math.sqrt(c2) || 1e-3, f = ((0.55 - c) * 7) / c;
          dx += cx * f;
          dy += cy * f;
          dz += cz * f;
        }
      }
      // sterzata (meno agili quando scappano: la spinta dura un po')
      const a = 1 - Math.exp(-dt * lane[l4 + 3] * (1 - 0.65 * panic[i]));
      let vx = vel[j] + (dx - vel[j]) * a, vy = vel[j + 1] + (dy - vel[j + 1]) * a, vz = vel[j + 2] + (dz - vel[j + 2]) * a;
      const sp = Math.hypot(vx, vy, vz);
      if (sp > 6) {
        vx *= 6 / sp;
        vy *= 6 / sp;
        vz *= 6 / sp;
      }
      vel[j] = vx;
      vel[j + 1] = vy;
      vel[j + 2] = vz;
      pos[k] += vx * dt;
      pos[k + 1] += vy * dt;
      pos[k + 2] += vz * dt;
      pos[k + 3] += dt * (8 + 6 * Math.min(sp, 4)); // colpo di coda più rapido quando corrono
      const b = 1 - Math.exp(-dt * 9);
      dir[j] += (vx - dir[j]) * b;
      dir[j + 1] += (vy - dir[j + 1]) * b;
      dir[j + 2] += (vz - dir[j + 2]) * b;
      panic[i] *= Math.exp(-dt * 1.3);
      par[j + 1] = panic[i];
    }
    posAttr.needsUpdate = dirAttr.needsUpdate = parAttr.needsUpdate = true;
  }

  return { group, update, point, avoid, scatter, hit, center: C };
}
