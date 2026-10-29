import * as THREE from 'three';
import { GLSL_COMMON } from './materials.js';
import { FOG_GLSL } from './water-glsl.js';

// Tre pesci combattenti (betta) verdi e rosa che nuotano lenti attorno alla statua: passano dietro le
// teste, escono ai lati e vengono avanti verso lo schermo, poi tornano indietro. Il modello è quello
// di Meshy (tools/fish.mjs: geometria semplificata, colore e rilievo in KTX2), caricato dopo l'avvio
// come la statua; finché non arriva i pesci non si vedono.
// Il nuoto è nel vertex shader: l'onda del corpo passa nella coda e la percorre in ritardo, nelle
// curve il corpo si piega e la coda, più lenta a girare, resta indietro; le pinne ondeggiano come
// veli su due ritmi lenti, di più verso il bordo. Quali vertici sono pinna lo dice lo spessore del
// modello: il corpo è spesso, le pinne sono lamine sottili (setModel).
// Sono molto più grandi di quelli veri (1-1,3 m con la coda), per leggersi accanto alla statua.
// Toccati, scattano via.
// Riferimento del modello: muso a +x, dorso a +y, fianchi lungo z; lungo 1, centrato.

const VERT = /* glsl */ `
  attribute float aFin; // distanza dal corpo (0 sul corpo, cresce verso il bordo delle pinne)
  uniform float uTime, uPhase, uSeed, uAmp, uBend;
  varying vec3 vWorld, vN;
  varying vec2 vUv;
  varying float vFin;
  void main() {
    vec3 p = position;
    float r = aFin;
    // onda del corpo che corre dalla testa alla coda, più ampia dietro; nelle pinne arriva in ritardo
    float tail = 1.0 - smoothstep(-0.55, 0.35, p.x);
    float A = 0.004 + uAmp * tail * tail;
    float w = p.x * 5.0 + uPhase - r * 2.0;
    p.z += A * sin(w);
    // nelle curve il corpo si piega lungo la traiettoria; le pinne, più lente a girare, ancora di più
    float b = max(0.42 - p.x, 0.0);
    p.z += uBend * b * b * (1.0 + 2.0 * r);
    vec3 n = normal;
    n.x -= (A * 5.0 * cos(w) - 2.0 * uBend * b) * n.z;
    // il velo delle pinne: due onde lente che vanno dalla base al bordo
    float k = uSeed + (p.x + p.y) * 3.0;
    float ph = uTime * 1.4 - r * 9.0 + k;
    float ph2 = uTime * 0.83 - r * 5.0 - (p.x - p.y) * 2.0 + uSeed * 1.3;
    p.z += 0.16 * pow(r, 1.3) * sin(ph) + 0.08 * pow(r, 1.5) * sin(ph2);
    // e si allunga e si raccoglie appena, come trascinato dall'acqua
    p.x -= 0.04 * r * r * (1.0 + sin(uTime * 0.9 + k));
    p.y += 0.03 * r * r * sin(uTime * 1.05 + k * 0.7);
    vUv = uv;
    vFin = r;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    vN = normalize(mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const FRAG = /* glsl */ `
  precision highp float;
  uniform float uExposure, uTime;
  uniform sampler2D uMap, uNormalMap;
  varying vec3 vWorld, vN;
  varying vec2 vUv;
  varying float vFin;
  ${GLSL_COMMON}
  ${FOG_GLSL}
  float caustics(vec3 p) {
    vec2 q = p.xz * 1.2 + p.y * 0.15;
    float c1 = vnoise(q * 1.7 + vec2(uTime * 0.45, -uTime * 0.2));
    float c2 = vnoise(q * 2.9 - vec2(uTime * 0.32, uTime * 0.27));
    return pow(1.0 - abs(c1 - c2), 7.0);
  }
  // normal map in spazio tangente, ricostruito dalle derivate (come la statua)
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
  const vec3 SUN = vec3(-0.287, 0.957, 0.191);
  void main() {
    vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 V = normalize(cameraPosition - vWorld);
    N = perturb(N, vWorld, vUv, texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0);
    vec3 base = texture2D(uMap, vUv).rgb;
    float fin = smoothstep(0.0, 0.05, vFin);
    // luce dell'acqua (meno blu che sugli altri oggetti, perché i colori si leggano), sole e caustiche
    vec3 amb = mix(uDeep * 2.2, uShallow * 1.1, N.y * 0.5 + 0.5);
    amb = mix(amb, vec3(dot(amb, vec3(0.3, 0.5, 0.2))), 0.55);
    float c = caustics(vWorld) * smoothstep(0.1, 0.8, N.y);
    float ndl = max(dot(N, SUN), 0.0);
    vec3 col = base * (amb * 1.05 + vec3(0.95, 1.0, 1.0) * ndl * (0.45 + 1.2 * c));
    // le pinne sono sottili: la luce le attraversa e le accende da dietro
    col += base * fin * (0.35 * max(dot(-N, SUN), 0.0) + 0.6 * c);
    // pelle bagnata: un riflesso morbido sul corpo, iridescente di taglio
    col += vec3(0.8, 0.95, 1.0) * pow(max(dot(N, normalize(SUN + V)), 0.0), 40.0) * 0.3 * (1.0 - fin);
    float fres = pow(1.0 - abs(dot(N, V)), 3.0);
    col = mix(col, col + base * 0.5, fres * 0.5);
    float dist = length(cameraPosition - vWorld);
    col = mix(waterColor(-V), col, waterFog(dist, -vWorld.y));
    gl_FragColor = vec4(softClip(col * uExposure), 1.0);
    #include <colorspace_fragment>
  }
`;

// quanto ogni vertice è lontano dal corpo, nel piano del profilo (x, y): il corpo è dove il modello è
// spesso, le pinne sono lamine sottili attaccate al corpo. Distanze su una griglia (due passate di
// chamfer), poi lette per ogni vertice con interpolazione bilineare: niente salti tra vertici vicini
export function finDistance(geometry) {
  const pos = geometry.attributes.position.array, n = pos.length / 3;
  const C = 0.02; // lato delle celle (abbastanza grandi da contenere vertici di entrambi i fianchi)
  const minX = -0.52, minY = -0.5, NX = Math.ceil(1.04 / C), NY = Math.ceil(1.0 / C);
  const lo = new Float32Array(NX * NY).fill(Infinity), hi = new Float32Array(NX * NY).fill(-Infinity);
  const ix = (x) => Math.min(NX - 1, Math.max(0, Math.floor((x - minX) / C)));
  const iy = (y) => Math.min(NY - 1, Math.max(0, Math.floor((y - minY) / C)));
  for (let i = 0; i < n; i++) {
    const j = ix(pos[i * 3]) + NX * iy(pos[i * 3 + 1]);
    lo[j] = Math.min(lo[j], pos[i * 3 + 2]);
    hi[j] = Math.max(hi[j], pos[i * 3 + 2]);
  }
  // il nucleo del corpo: spessore oltre 6 cm (su 1 m di pesce), solo il pezzo più grande (dove le pinne
  // si sovrappongono piegate sembrano spesse anche loro, ma sono isole staccate dal corpo)
  let thick = new Uint8Array(NX * NY);
  for (let j = 0; j < NX * NY; j++) thick[j] = hi[j] - lo[j] > 0.06 ? 1 : 0;
  const label = new Int32Array(NX * NY).fill(-1);
  let best = -1, bestSize = 0;
  for (let j0 = 0; j0 < NX * NY; j0++) {
    if (!thick[j0] || label[j0] >= 0) continue;
    const stack = [j0];
    label[j0] = j0;
    let size = 0;
    while (stack.length) {
      const j = stack.pop();
      size++;
      const x = j % NX;
      for (const k of [x > 0 ? j - 1 : -1, x < NX - 1 ? j + 1 : -1, j - NX, j + NX]) {
        if (k >= 0 && k < NX * NY && thick[k] && label[k] < 0) {
          label[k] = j0;
          stack.push(k);
        }
      }
    }
    if (size > bestSize) { bestSize = size; best = j0; }
  }
  // chiusura (dilata e poi erode di una cella): riempie i piccoli buchi del corpo
  const grow = (src, on) => {
    const out = new Uint8Array(NX * NY);
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
      let v = on ? 0 : 1;
      for (let dy = -1; dy <= 1 && v === (on ? 0 : 1); dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        const s = xx >= 0 && yy >= 0 && xx < NX && yy < NY ? src[xx + NX * yy] : 0;
        if (on ? s : !s) { v = on ? 1 : 0; break; }
      }
      out[x + NX * y] = v;
    }
    return out;
  };
  // dal nucleo il corpo si allarga alle celle ancora abbastanza spesse (oltre 3 cm) attaccate a lui:
  // la testa e il peduncolo, più sottili del centro
  const core = [];
  for (let j = 0; j < NX * NY; j++) {
    thick[j] = label[j] === best ? 1 : 0;
    if (thick[j]) core.push(j);
  }
  while (core.length) {
    const j = core.pop(), x = j % NX;
    for (const k of [x > 0 ? j - 1 : -1, x < NX - 1 ? j + 1 : -1, j - NX, j + NX]) {
      if (k >= 0 && k < NX * NY && !thick[k] && hi[k] - lo[k] > 0.03) {
        thick[k] = 1;
        core.push(k);
      }
    }
  }
  thick = grow(grow(thick, true), false);
  // sotto il ventre (in questo modello a metà altezza del pesce) ci sono solo pinne: le ventrali, due
  // nastri sovrapposti, sembrerebbero spesse come il corpo
  for (let y = 0; y < NY; y++) if (minY + (y + 0.5) * C < -0.01) for (let x = 0; x < NX; x++) thick[x + NX * y] = 0;
  const D = new Float32Array(NX * NY);
  for (let j = 0; j < NX * NY; j++) D[j] = thick[j] ? 0 : 1e9;
  const d1 = C, d2 = C * Math.SQRT2;
  const relax = (j, k, w) => { if (D[k] + w < D[j]) D[j] = D[k] + w; };
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const j = x + NX * y;
    if (x > 0) relax(j, j - 1, d1);
    if (y > 0) {
      relax(j, j - NX, d1);
      if (x > 0) relax(j, j - NX - 1, d2);
      if (x < NX - 1) relax(j, j - NX + 1, d2);
    }
  }
  for (let y = NY - 1; y >= 0; y--) for (let x = NX - 1; x >= 0; x--) {
    const j = x + NX * y;
    if (x < NX - 1) relax(j, j + 1, d1);
    if (y < NY - 1) {
      relax(j, j + NX, d1);
      if (x < NX - 1) relax(j, j + NX + 1, d2);
      if (x > 0) relax(j, j + NX - 1, d2);
    }
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const fx = Math.min(NX - 1.001, Math.max(0, (pos[i * 3] - minX) / C - 0.5));
    const fy = Math.min(NY - 1.001, Math.max(0, (pos[i * 3 + 1] - minY) / C - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, j = x0 + NX * y0;
    const v = (D[j] * (1 - tx) + D[j + 1] * tx) * (1 - ty) + (D[j + NX] * (1 - tx) + D[j + NX + 1] * tx) * ty;
    out[i] = Math.max(0, v - C);
  }
  return out;
}

export function createFish(shared, { art }) {
  const blank = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  blank.needsUpdate = true;
  const tex = { uMap: { value: blank }, uNormalMap: { value: blank } };
  // stesso giro per tutti, distanziati di un terzo; scala, quota e velocità appena diverse
  const fish = [
    { len: 1.3, u: 0.0, speed: 0.4, scale: 1.0, dy: 0.0, seed: 0.7 },
    { len: 1.15, u: 0.34, speed: 0.38, scale: 1.05, dy: 0.3, seed: 2.3 },
    { len: 1.0, u: 0.67, speed: 0.42, scale: 0.96, dy: -0.2, seed: 4.1 },
  ].map((f) => {
    const uniforms = { ...shared, ...tex, uPhase: { value: 0 }, uSeed: { value: f.seed }, uAmp: { value: 0.04 }, uBend: { value: 0 } };
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    mesh.scale.setScalar(f.len);
    mesh.frustumCulled = false;
    mesh.visible = false;
    return { ...f, mesh, uniforms, phase: f.seed, kick: 0, bend: 0, heading: null };
  });
  const group = new THREE.Group();
  fish.forEach((f) => group.add(f.mesh));

  // arriva il modello: una sola geometria per i tre pesci
  function setModel(geometry, colorTex, normalTex) {
    geometry.setAttribute('aFin', new THREE.BufferAttribute(finDistance(geometry), 1));
    tex.uMap.value = colorTex;
    tex.uNormalMap.value = normalTex;
    fish.forEach((f) => {
      f.mesh.geometry.dispose();
      f.mesh.geometry = geometry;
      f.mesh.visible = true;
    });
  }

  // il giro, rispetto al centro della statua (x = profondità: la telecamera guarda verso -x; z = di lato):
  // dietro le teste (nascosti), fuori da un lato, lungo il fianco della statua e avanti verso lo
  // schermo, una virata larga e di nuovo dietro, più lontano; poi lo stesso dall'altro lato. Mai a
  // meno di 3,2 m dal centro, anche con la statua girata.
  const R = [[-3.2, 0.9, 0], [-2.6, 0.7, 2.9], [0, 0.4, 3.4], [2.3, 0.2, 3.1], [2.8, 0.4, 4.6], [0.4, 0.9, 5.4], [-3.0, 1.2, 4.4], [-4.6, 1.3, 0]];
  const loop = [...R, ...R.slice(1, -1).reverse().map(([x, y, z]) => [x, y, -z])];
  const curves = fish.map((f) => {
    const c = new THREE.CatmullRomCurve3(loop.map(([x, y, z]) => art.center.clone().add(new THREE.Vector3(x * f.scale, y + f.dy, z * f.scale))), true, 'centripetal');
    c.arcLengthDivisions = 600;
    c.L = c.getLength();
    return c;
  });

  const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const m = new THREE.Matrix4(), ahead = new THREE.Vector3();
  function update(dt) {
    fish.forEach((f, i) => {
      const c = curves[i];
      const boost = 1 + f.kick;
      f.kick *= Math.exp(-dt * 0.8);
      f.u = (f.u + (dt * f.speed * boost) / c.L) % 1;
      // coda più veloce e ampia quando scatta
      f.phase += dt * (2.2 + 3.5 * f.kick);
      f.uniforms.uPhase.value = f.phase;
      f.uniforms.uAmp.value = 0.04 + 0.03 * Math.min(1, f.kick);
      c.getPointAt(f.u, f.mesh.position);
      X.subVectors(c.getPointAt((f.u + 0.004) % 1, ahead), f.mesh.position).normalize();
      // quanto gira (rad/s attorno alla verticale): il corpo si piega verso l'interno della curva, con calma
      const h = Math.atan2(X.z, X.x);
      if (f.heading !== null && dt > 0) {
        let dh = h - f.heading;
        dh -= Math.round(dh / (2 * Math.PI)) * 2 * Math.PI;
        f.bend += (THREE.MathUtils.clamp(dh / dt, -1.2, 1.2) * 0.32 - f.bend) * (1 - Math.exp(-dt * 2.5));
      }
      f.heading = h;
      f.uniforms.uBend.value = f.bend;
      Z.crossVectors(X, UP).normalize();
      Y.crossVectors(Z, X);
      m.makeBasis(X, Y, Z);
      f.mesh.quaternion.setFromRotationMatrix(m);
    });
  }

  // un tocco vicino a un pesce lo fa scattare via; restituisce la sua posizione (per le bollicine)
  function poke(ray) {
    for (const f of fish) {
      if (f.mesh.visible && ray.distanceToPoint(f.mesh.position) < f.len * 0.6) {
        f.kick = 2.2;
        return f.mesh.position.clone();
      }
    }
    return null;
  }

  return { group, update, poke, fish, setModel };
}
