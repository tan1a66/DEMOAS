// ─────────────────────────────────────────────────────────────────────────────
//  Filo di henequén che scrive "Hacienda Teya"
//
//  Percorso completo, in ordine:
//    1. nasce nel cogollo della pianta e sale con una curva morbida;
//    2. segue la linea centrale delle lettere (src/data/thread-paths.json,
//       generato da scripts/build-thread.mjs con opentype.js);
//    3. tra tratti staccati "passa dietro" un tessuto invisibile (piano z):
//       il filo si immerge e riemerge, come l'ago in un ricamo;
//    4. il puntino della "i" è un nodo francese (piccola spirale).
//
//  Il tubo è costruito a mano (frame a trasporto parallelo) per avere: crescita
//  con drawRange, attributo di tempo per la scia luminosa, attributo di "clip"
//  per le parti nascoste. Lo shader aggiunge la torsione a tre capi e le fibre.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import paths from '../data/thread-paths.json';
import { PALETTE, THREAD } from '../config.js';
import { mulberry32 } from './agave.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ── Posizionamento della scritta sullo schermo ───────────────────────────────
// Punto del piano z = planeZ visto in (ndcX, ndcY) dalla camera
function ndcToPlane(camera, ndcX, ndcY, planeZ) {
  const p = V(ndcX, ndcY, 0.5).unproject(camera);
  const dir = p.sub(camera.position).normalize();
  const t = (planeZ - camera.position.z) / dir.z;
  return camera.position.clone().addScaledVector(dir, t);
}

/**
 * Calcola scala e centro della scritta perché occupi il rettangolo voluto.
 * @param camera   camera nella posa finale dell'apertura
 * @param frame    { layout: 'wide'|'tall', centerY (NDC), width (frazione dello schermo), maxHeight (NDC) }
 */
export function placeText(camera, frame) {
  const L = paths.layouts[frame.layout];
  const [x1, y1, x2, y2] = L.bbox;
  const planeZ = THREAD.planeZ;
  const left = ndcToPlane(camera, -frame.width, frame.centerY, planeZ);
  const right = ndcToPlane(camera, frame.width, frame.centerY, planeZ);
  const top = ndcToPlane(camera, 0, frame.centerY + frame.maxHeight / 2, planeZ);
  const bottom = ndcToPlane(camera, 0, frame.centerY - frame.maxHeight / 2, planeZ);
  const scale = Math.min((right.x - left.x) / (x2 - x1), (top.y - bottom.y) / (y2 - y1));
  const center = ndcToPlane(camera, 0, frame.centerY, planeZ);
  const cam = camera.clone();
  return {
    layout: frame.layout,
    scale,
    planeZ,
    // conversioni schermo ↔ mondo con la camera nella posa finale
    ndcToWorld: (x, y, z) => ndcToPlane(cam, x, y, z),
    toNdc: (v) => v.clone().project(cam),
    // em → mondo
    toWorld: (x, y, z = 0) => V((x - (x1 + x2) / 2) * scale + center.x, (y - (y1 + y2) / 2) * scale + center.y, planeZ + z * scale),
    bottomWorld: V(center.x, ((y1 - y2) / 2) * scale + center.y, planeZ),
    topWorld: V(center.x, ((y2 - y1) / 2) * scale + center.y, planeZ),
  };
}

// ── Costruzione del percorso (polilinea 3D con etichette) ────────────────────
// Ogni punto: { p: Vector3, clip: 0|1 (parte "dietro il tessuto"), pace: costo di tempo relativo }
function buildPolyline(place, heart) {
  const L = paths.layouts[place.layout];
  const s = place.scale;
  const out = [];
  const push = (p, clip = 0, pace = 1) => out.push({ p, clip, pace });

  const strokes = L.strokes.map((st) => {
    if (st.dot) return { dot: place.toWorld(st.dot[0], st.dot[1]) };
    const pts = [];
    for (let i = 0; i < st.p.length; i += 3) pts.push(place.toWorld(st.p[i], st.p[i + 1], st.p[i + 2]));
    return { pts };
  });
  const firstLine = strokes.find((st) => st.pts);
  const startDir = (pts) => pts[Math.min(4, pts.length - 1)].clone().sub(pts[0]).normalize();
  const endDir = (pts) => pts.at(-1).clone().sub(pts[Math.max(0, pts.length - 5)]).normalize();

  // 1. dal cuore della pianta alla prima lettera. Il percorso è pensato in
  //    coordinate di schermo, così funziona in orizzontale e in verticale:
  //    il filo esce dal cogollo, piega a sinistra all'altezza della pianta
  //    (sotto "Desde 1683" e il pulsante), risale lungo il lato sinistro e
  //    scende nell'attacco della prima lettera dall'alto, come una penna.
  {
    const first = firstLine.pts;
    const P = first[0];
    const t0 = startDir(first);
    const z = place.planeZ;
    const hN = place.toNdc(heart);
    const pN = place.toNdc(P);
    const C = place.ndcToWorld(THREE.MathUtils.lerp(hN.x, pN.x, 0.5), hN.y + 0.03, z * 0.35);
    const D = place.ndcToWorld(pN.x - 0.05, THREE.MathUtils.lerp(hN.y, pN.y, 0.6), z * 0.85);
    const way = [
      heart.clone().add(V(0, -0.14, 0)), // dentro il cogollo
      heart.clone().add(V(0, 0.06, 0.02)),
      heart.clone().add(V(-0.12, 0.1, 0.1)),
      C,
      D,
      P.clone().addScaledVector(t0, -0.28 * s).add(V(-0.05 * s, 0.06 * s, 0)),
      P,
    ];
    const curve = new THREE.CatmullRomCurve3(way, false, 'centripetal');
    const n = 260;
    for (let i = 0; i < n; i++) push(curve.getPoint(i / n), 0, 0.8);
  }

  // salto dietro il "tessuto": affonda, viaggia nascosto, riemerge
  const dive = (from, fromDir, to, toDir) => {
    const back = V(0, 0, -1);
    const d = from.distanceTo(to);
    const depth = 0.12 + d * 0.25;
    const pts = [
      from,
      from.clone().addScaledVector(fromDir, 0.07 * s).addScaledVector(back, 0.04),
      from.clone().lerp(to, 0.5).addScaledVector(back, depth),
      to.clone().addScaledVector(toDir, -0.07 * s).addScaledVector(back, 0.04),
      to,
    ];
    const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const n = Math.max(24, Math.round(d * 40));
    for (let i = 1; i < n; i++) push(c.getPoint(i / n), 1, 0.45);
  };

  // nodo francese per il puntino della "i"
  const knot = (center) => {
    const r = 0.026 * s;
    const pts = [];
    const turns = 1.75;
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * turns * Math.PI * 2 + Math.PI;
      const rr = r * (1 - 0.35 * (i / n));
      pts.push(center.clone().add(V(Math.cos(a) * rr, Math.sin(a) * rr, (i / n) * 0.9 * THREAD.radius * s)));
    }
    return pts;
  };

  // 2–4. lettere, salti e nodo
  let last = null;
  let lastDir = null;
  for (const st of strokes) {
    const pts = st.pts || knot(st.dot);
    const dirIn = st.pts ? startDir(pts) : pts[1].clone().sub(pts[0]).normalize();
    if (last) dive(last, lastDir, pts[0], dirIn);
    pts.forEach((p) => push(p, 0, st.pts ? 1 : 2.2));
    last = pts.at(-1);
    lastDir = st.pts ? endDir(pts) : pts.at(-1).clone().sub(pts.at(-2)).normalize();
  }
  // piccola coda finale che si stacca dalla "a"
  push(last.clone().addScaledVector(lastDir, 0.06 * s).add(V(0, 0, 0.004)), 0, 1);
  return out;
}

// ricampiona la polilinea a passo costante; ogni campione eredita clip e passo
function resample(poly, count) {
  const cum = [0];
  for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + poly[i].p.distanceTo(poly[i - 1].p));
  const total = cum.at(-1);
  const samples = [];
  let j = 0;
  for (let k = 0; k <= count; k++) {
    const d = (k / count) * total;
    while (j < poly.length - 2 && cum[j + 1] < d) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const f = THREE.MathUtils.clamp((d - cum[j]) / seg, 0, 1);
    const a = poly[j];
    const b = poly[j + 1];
    samples.push({
      p: a.p.clone().lerp(b.p, f),
      clip: f < 0.5 ? a.clip : b.clip,
      pace: f < 0.5 ? a.pace : b.pace,
      s: d,
    });
  }
  return { samples, total };
}

// ── Geometria del tubo ───────────────────────────────────────────────────────
function buildTube(samples, radiusAt, radial) {
  const n = samples.length;
  const T = [];
  for (let i = 0; i < n; i++) {
    const a = samples[Math.max(0, i - 1)].p;
    const b = samples[Math.min(n - 1, i + 1)].p;
    T.push(b.clone().sub(a).normalize());
  }
  // frame a trasporto parallelo (niente torsioni improvvise come con Frenet)
  const N = [];
  const B = [];
  let n0 = Math.abs(T[0].y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  n0 = n0.sub(T[0].clone().multiplyScalar(n0.dot(T[0]))).normalize();
  N.push(n0);
  B.push(T[0].clone().cross(n0));
  for (let i = 1; i < n; i++) {
    const prev = N[i - 1];
    const ni = prev.clone().sub(T[i].clone().multiplyScalar(prev.dot(T[i])));
    if (ni.lengthSq() < 1e-10) ni.copy(prev);
    ni.normalize();
    N.push(ni);
    B.push(T[i].clone().cross(ni));
  }

  const R = radial;
  const pos = new Float32Array(n * (R + 1) * 3);
  const nor = new Float32Array(n * (R + 1) * 3);
  const uv = new Float32Array(n * (R + 1) * 2);
  const aTime = new Float32Array(n * (R + 1));
  const aClip = new Float32Array(n * (R + 1));
  let v = 0;
  for (let i = 0; i < n; i++) {
    const r = radiusAt(i);
    for (let j = 0; j <= R; j++) {
      const a = (j / R) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const nx = c * N[i].x + sn * B[i].x;
      const ny = c * N[i].y + sn * B[i].y;
      const nz = c * N[i].z + sn * B[i].z;
      pos[v * 3] = samples[i].p.x + r * nx;
      pos[v * 3 + 1] = samples[i].p.y + r * ny;
      pos[v * 3 + 2] = samples[i].p.z + r * nz;
      nor[v * 3] = nx;
      nor[v * 3 + 1] = ny;
      nor[v * 3 + 2] = nz;
      uv[v * 2] = samples[i].s;
      uv[v * 2 + 1] = j / R;
      aTime[v] = samples[i].time;
      aClip[v] = samples[i].clip;
      v++;
    }
  }
  const index = new Uint32Array((n - 1) * R * 6);
  let k = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j;
      const b = a + R + 1;
      index[k++] = a;
      index[k++] = b;
      index[k++] = a + 1;
      index[k++] = b;
      index[k++] = b + 1;
      index[k++] = a + 1;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aTime', new THREE.BufferAttribute(aTime, 1));
  g.setAttribute('aClip', new THREE.BufferAttribute(aClip, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  return { geometry: g, T, N, B };
}

// Tempo di scrittura: la "mano" rallenta nelle curve strette e accelera nei
// tratti dritti; i passaggi nascosti sono rapidi.
function computeTiming(samples, lengthScale) {
  const n = samples.length;
  const curv = new Float32Array(n);
  for (let i = 1; i < n - 1; i++) {
    const a = samples[i].p.clone().sub(samples[i - 1].p);
    const b = samples[i + 1].p.clone().sub(samples[i].p);
    const ds = (a.length() + b.length()) / 2 || 1e-6;
    curv[i] = a.angleTo(b) / ds; // 1/m
  }
  // media mobile per evitare scatti di velocità
  const W = 12;
  const smoothC = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    let c = 0;
    for (let k = Math.max(0, i - W); k <= Math.min(n - 1, i + W); k++) {
      acc += curv[k];
      c++;
    }
    smoothC[i] = acc / c;
  }
  let t = 0;
  samples[0].time = 0;
  for (let i = 1; i < n; i++) {
    const ds = samples[i].p.distanceTo(samples[i - 1].p);
    const k = smoothC[i] * lengthScale; // curvatura adimensionale
    t += ds * samples[i].pace * (1 + 0.55 * Math.min(k, 6));
    samples[i].time = t;
  }
  for (const smp of samples) smp.time /= t;
}

// ── Materiale del filo ───────────────────────────────────────────────────────
function createThreadMaterial(uniforms) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#efe4c6', // un filo più chiaro della palette: la luce dorata lo scalda già
    roughness: 0.55,
    metalness: 0,
    sheen: 0.25,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#fff0cc'),
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aTime; attribute float aClip;
        varying float vTime; varying float vClip; varying float vWorldZ; varying vec2 vFiberUv;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vTime = aTime; vClip = aClip; vFiberUv = uv;
        vWorldZ = (modelMatrix * vec4(transformed, 1.0)).z;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uPlaneZ; uniform float uHead; uniform float uSweep; uniform float uTwist; uniform float uBump;
        uniform vec3 uGlow;
        varying float vTime; varying float vClip; varying float vWorldZ; varying vec2 vFiberUv;
        float h21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
        float vn(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
        // altezza della superficie: tre capi ritorti + fibre lungo l'elica
        // (i dettagli più piccoli di un pixel sfumano nella media → niente sfarfallio)
        float fiberHeight(vec2 uv) {
          float helix = uv.y * 3.0 + uv.x * uTwist;
          float fw = fwidth(helix);
          float ply = mix(0.5 + 0.5 * cos(helix * 6.2831853), 0.5, smoothstep(0.18, 0.45, fw));
          float strands = mix(vn(vec2(helix * 9.0, uv.x * 26.0)), 0.5, smoothstep(0.03, 0.08, fw));
          return ply * 0.8 + strands * 0.35;
        }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        // tratti "dietro il tessuto": spariscono oltre il piano della scritta
        if (vClip > 0.5 && vWorldZ < uPlaneZ - 0.0015) discard;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float fh = fiberHeight(vFiberUv);
        float fibK = vFiberUv.y * 3.0 + vFiberUv.x * uTwist;
        float fib = mix(vn(vec2(fibK * 14.0, vFiberUv.x * 90.0)), 0.5, smoothstep(0.02, 0.06, fwidth(fibK)));
        diffuseColor.rgb *= mix(0.8, 1.05, fh) * (0.94 + 0.1 * fib);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.04, 0.97, 0.86), fib * 0.25);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          // rilievo dei capi ritorti (bump analitico con derivate di schermo)
          vec3 dpx = dFdx(-vViewPosition); vec3 dpy = dFdy(-vViewPosition);
          float hx = dFdx(fh); float hy = dFdy(fh);
          vec3 r1 = cross(dpy, normal); vec3 r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (hx * r1 + hy * r2);
          normal = normalize(abs(det) * normal - uBump * grad);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          // il tratto appena cucito è ancora "caldo" e si raffredda
          float age = max(0.0, uHead - vTime);
          float fresh = exp(-age * 16.0) * step(vTime, uHead);
          // riflesso che percorre tutta la scritta alla fine
          float sweep = exp(-pow((vTime - uSweep) * 18.0, 2.0));
          totalEmissiveRadiance += uGlow * (fresh * 0.9 + sweep * 0.75);
        }`,
      );
  };
  return mat;
}

// ── Fibre sfilacciate (linee sottilissime attorno al filo) ───────────────────
function createFuzz(samples, frames, radiusAt, count, uniforms) {
  const rnd = mulberry32(60);
  const pos = new Float32Array(count * 6);
  const aTime = new Float32Array(count * 2);
  const aTip = new Float32Array(count * 2);
  const n = samples.length;
  let k = 0;
  let guard = 0;
  while (k < count && guard++ < count * 6) {
    const i = Math.floor(rnd() * (n - 2)) + 1;
    if (samples[i].clip > 0.5) continue;
    const a = rnd() * Math.PI * 2;
    const T = frames.T[i];
    const out = frames.N[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.B[i], Math.sin(a));
    const r = radiusAt(i);
    const base = samples[i].p.clone().addScaledVector(out, r * 0.85);
    const len = r * (0.35 + rnd() * rnd() * 1.9);
    const dir = out.clone().multiplyScalar(0.55).addScaledVector(T, (rnd() - 0.5) * 2.2).normalize();
    const tip = base.clone().addScaledVector(dir, len);
    pos.set([base.x, base.y, base.z, tip.x, tip.y, tip.z], k * 6);
    aTime[k * 2] = aTime[k * 2 + 1] = samples[i].time;
    aTip[k * 2] = 0;
    aTip[k * 2 + 1] = 1;
    k++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, k * 6), 3));
  g.setAttribute('aTime', new THREE.BufferAttribute(aTime.subarray(0, k * 2), 1));
  g.setAttribute('aTip', new THREE.BufferAttribute(aTip.subarray(0, k * 2), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uHead: uniforms.uHead, uColor: { value: new THREE.Color(PALETTE.fiber) }, uOpacity: { value: 0.32 } },
    vertexShader: /* glsl */ `
      attribute float aTime; attribute float aTip;
      varying float vTip; varying float vTime;
      void main() { vTip = aTip; vTime = aTime; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uHead; uniform vec3 uColor; uniform float uOpacity;
      varying float vTip; varying float vTime;
      void main() {
        if (vTime > uHead) discard;
        gl_FragColor = vec4(uColor * mix(0.75, 1.15, vTip), uOpacity * (1.0 - vTip * 0.6));
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(g, mat);
  lines.frustumCulled = false;
  return lines;
}

// ── Oggetto pubblico ─────────────────────────────────────────────────────────
export class HenequenThread {
  constructor(quality) {
    this.quality = quality;
    this.group = new THREE.Group();
    this.uniforms = {
      uPlaneZ: { value: THREAD.planeZ },
      uHead: { value: 0 },
      uSweep: { value: -1 },
      uTwist: { value: 1 },
      uBump: { value: 0.35 },
      uGlow: { value: new THREE.Color(PALETTE.gold).multiplyScalar(0.9) },
    };
    this.material = createThreadMaterial(this.uniforms);
    // capocchia: chiude il tubo nel punto in cui il filo sta crescendo
    this.cap = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.fiber, emissive: PALETTE.gold, emissiveIntensity: 0.8, roughness: 0.6 }),
    );
    this.cap.castShadow = true;
    this.group.add(this.cap);
    this.progress = 0;
  }

  /** (Ri)costruisce il filo per la posizione della scritta e il cuore della pianta. */
  build(place, heart) {
    this.dispose();
    const poly = buildPolyline(place, heart);
    const { samples, total } = resample(poly, this.quality.threadSegments);
    computeTiming(samples, place.scale * 0.08);
    const radius = THREAD.radius * place.scale;
    this.radius = radius;
    const n = samples.length;
    // il filo nasce sottile dentro la pianta e si assottiglia appena in fondo
    const radiusAt = (i) => {
      const sFromStart = samples[i].s;
      const sToEnd = total - samples[i].s;
      return radius * THREE.MathUtils.smoothstep(sFromStart, 0, 0.12) * (0.55 + 0.45 * THREE.MathUtils.smoothstep(sToEnd, 0, 0.04));
    };
    const tube = buildTube(samples, radiusAt, this.quality.threadRadial);
    // torsione: un giro completo dei capi ogni ~7 raggi
    this.uniforms.uTwist.value = 1 / (radius * 7);
    this.uniforms.uPlaneZ.value = place.planeZ;
    this.mesh = new THREE.Mesh(tube.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.fuzz = createFuzz(samples, tube, radiusAt, this.quality.fuzz, this.uniforms);
    this.group.add(this.mesh, this.fuzz);
    this.samples = samples;
    this.times = Float32Array.from(samples, (smp) => smp.time);
    this.radiusAt = radiusAt;
    this.segmentsPerRing = this.quality.threadRadial * 6;
    this.setProgress(this.progress);
  }

  /** p ∈ [0,1] = tempo di scrittura (non lunghezza: la mano rallenta nelle curve) */
  setProgress(p) {
    this.progress = p;
    this.uniforms.uHead.value = p;
    if (!this.mesh) return;
    // indice del campione raggiunto (ricerca binaria sui tempi)
    const t = this.times;
    let lo = 0;
    let hi = t.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (t[mid] <= p) lo = mid;
      else hi = mid - 1;
    }
    const i = lo;
    this.mesh.geometry.setDrawRange(0, i * this.segmentsPerRing);
    const smp = this.samples[i];
    const r = this.radiusAt(i);
    this.cap.position.copy(smp.p);
    this.cap.scale.setScalar(Math.max(r, 1e-5));
    // la capocchia sparisce quando il filo è "dietro il tessuto" o non è ancora nato
    this.cap.visible = p > 0 && !(smp.clip > 0.5 && smp.p.z < this.uniforms.uPlaneZ.value - 0.002);
    this.headPosition = smp.p;
  }

  dispose() {
    if (this.mesh) {
      this.group.remove(this.mesh, this.fuzz);
      this.mesh.geometry.dispose();
      this.fuzz.geometry.dispose();
      this.fuzz.material.dispose();
      this.mesh = null;
    }
  }
}
