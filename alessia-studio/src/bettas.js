import * as THREE from 'three';
import { GLSL_COMMON } from './materials.js';
import { FOG_GLSL } from './water-glsl.js';

// Tre pesci combattenti (betta) che nuotano lenti attorno alla statua: passano dietro la testa, escono
// ai lati e vengono avanti verso lo schermo, poi tornano indietro. Corpo piccolo con le scaglie
// iridescenti, pinne enormi come veli di seta (caudale a mezzaluna, dorsale e anale lunghe, ventrali
// sottili). Colori dai riferimenti: magenta, blu con le pinne rosse, corallo.
// La coda si muove come nell'acqua: l'onda del corpo passa nella pinna e la percorre fino al bordo
// in ritardo, il velo ondeggia su due ritmi lenti, nelle curve il corpo si piega lungo la traiettoria
// e la coda, più lenta a girare, resta indietro; il bordo è increspato.
// Geometria procedurale: il corpo è un fuso a sezioni, ogni pinna una griglia di raggi che partono
// dalla base; il movimento è nel vertex shader. Sono molto più grandi di quelli veri (1-1,3 m con la
// coda), per leggersi accanto alla statua. Toccati, scattano via.
// Riferimento del pesce: muso a +x, dorso a +y, fianchi lungo z; lunghezza totale ~1.

// mezza altezza del corpo lungo t (0 muso … 1 attacco della coda)
const PROFILE = [[0, 0.022], [0.06, 0.052], [0.3, 0.086], [0.62, 0.076], [0.86, 0.05], [1, 0.034]];
function bodyH(t) {
  for (let i = 1; i < PROFILE.length; i++) {
    if (t <= PROFILE[i][0]) {
      const [t0, h0] = PROFILE[i - 1], [t1, h1] = PROFILE[i];
      const k = (t - t0) / (t1 - t0);
      return h0 + (h1 - h0) * k * k * (3 - 2 * k);
    }
  }
  return PROFILE[PROFILE.length - 1][1];
}
const X0 = 0.5, X1 = 0.0; // muso, attacco della coda
const xOf = (t) => X0 + (X1 - X0) * t;

function bettaGeometry() {
  const pos = [], fin = [], idx = [];
  const vert = (x, y, z, a = [0, 0, 0, 0]) => {
    pos.push(x, y, z);
    fin.push(...a);
    return pos.length / 3 - 1;
  };
  // ---------------- corpo ----------------
  const NS = 28, NR = 18;
  const tip = vert(X0 + 0.004, 0.004, 0);
  const rings = [];
  for (let i = 1; i <= NS; i++) {
    const t = i / NS, h = bodyH(t), w = h * 0.52;
    rings.push(Array.from({ length: NR }, (_, j) => {
      const a = (j / NR) * Math.PI * 2, sa = Math.sin(a);
      return vert(xOf(t), 0.006 + h * sa * (sa < 0 ? 0.9 : 1), w * Math.cos(a));
    }));
  }
  for (let j = 0; j < NR; j++) idx.push(tip, rings[0][(j + 1) % NR], rings[0][j]);
  for (let i = 0; i < NS - 1; i++) {
    for (let j = 0; j < NR; j++) {
      const a = rings[i][j], b = rings[i][(j + 1) % NR], c = rings[i + 1][j], d = rings[i + 1][(j + 1) % NR];
      idx.push(a, b, c, b, d, c);
    }
  }
  const end = vert(X1 - 0.004, 0.006, 0);
  for (let j = 0; j < NR; j++) idx.push(end, rings[NS - 1][j], rings[NS - 1][(j + 1) % NR]);
  const bodyCount = idx.length;

  // ---------------- pinne: griglie di raggi ----------------
  // ray(v in 0..1) -> { base: [x,y,z], dir: angolo nel piano xy (0 = indietro, + = in su), len, z }
  // I raggi si incurvano all'indietro verso la punta (curl), il velo ha pieghe a ventaglio (pleat) e
  // il bordo non è perfetto: i raggi sono appena più lunghi o più corti l'uno dell'altro.
  const finGrid = (id, nr, ns, ray, { droop = 0.05, curl = 0, pleat = 0 } = {}) => {
    const cols = [];
    for (let i = 0; i <= nr; i++) {
      const v = i / nr, r = ray(v);
      const len = r.len * (1 + 0.02 * Math.sin(v * 37 + id * 3.1) + 0.012 * Math.sin(v * 83 + id));
      const col = [];
      let x = r.base[0], y = r.base[1];
      for (let j = 0; j <= ns; j++) {
        const s = j / ns;
        if (j > 0) {
          const a = r.dir * (1 - curl * (s - 0.5 / ns));
          x -= (Math.cos(a) * len) / ns;
          y += (Math.sin(a) * len) / ns;
        }
        // il velo pesa nell'acqua: si abbassa e resta appena indietro verso il bordo
        const z = (r.base[2] || 0) + (r.z || 0) * s + pleat * Math.pow(s, 0.8) * Math.sin((i * Math.PI) / 3);
        col.push(vert(x - 0.04 * s * s, y - droop * s * s, z, [s, v, id, nr]));
      }
      cols.push(col);
    }
    for (let i = 0; i < nr; i++) {
      for (let j = 0; j < ns; j++) {
        const a = cols[i][j], b = cols[i + 1][j], c = cols[i][j + 1], d = cols[i + 1][j + 1];
        idx.push(a, b, c, b, d, c);
      }
    }
  };
  const top = (t) => 0.006 + bodyH(t) * 0.9, bot = (t) => 0.006 - bodyH(t) * 0.8;
  // caudale a mezzaluna: dalla coda, a ventaglio di quasi 200°
  finGrid(1, 66, 24, (v) => {
    const a = (v - 0.5) * 2.9;
    return { base: [X1 + 0.012, 0.006 + (v - 0.5) * 0.055, 0], dir: a, len: 0.5 * (0.9 + 0.1 * Math.cos(a * 1.2)) };
  }, { droop: 0.06, curl: 0.3, pleat: 0.009 });
  // dorsale: lunga, verso l'alto e indietro, fino a sovrapporsi alla caudale
  finGrid(2, 18, 10, (v) => {
    const t = 0.42 + v * 0.56;
    return { base: [xOf(t), top(t), 0], dir: 1.2 - v * 0.9, len: 0.12 + v * 0.24 };
  }, { droop: 0.03, curl: 0.35, pleat: 0.006 });
  // anale: più lunga ancora, verso il basso e indietro
  finGrid(3, 20, 12, (v) => {
    const t = 0.3 + v * 0.68;
    return { base: [xOf(t), bot(t), 0], dir: -1.35 + v * 0.85, len: 0.18 + v * 0.32 };
  }, { droop: 0.02, curl: 0.3, pleat: 0.007 });
  // ventrali: due nastri sottili sotto la testa
  for (const sd of [1, -1]) {
    finGrid(4, 3, 8, (v) => ({ base: [xOf(0.28) - v * 0.02, bot(0.28) + 0.006, sd * 0.016], dir: -1.15 - v * 0.15, len: 0.26 - v * 0.04, z: sd * 0.05 }), { droop: 0 });
  }
  // pettorali: piccole e trasparenti, ai lati dietro l'occhio
  for (const sd of [1, -1]) {
    finGrid(5, 6, 5, (v) => ({ base: [xOf(0.24) - v * 0.03, v * 0.02, sd * bodyH(0.24) * 0.48], dir: -0.4 + v * 0.5, len: 0.07, z: sd * 0.05 }), { droop: 0 });
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFin', new THREE.Float32BufferAttribute(fin, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.addGroup(0, bodyCount, 0);
  g.addGroup(bodyCount, idx.length - bodyCount, 1);
  return g;
}

// movimento: onda del corpo, piega nelle curve, il velo delle pinne
const VERT = /* glsl */ `
  attribute vec4 aFin; // s lungo il raggio, v tra i raggi, pinna (0 = corpo), numero di raggi
  uniform float uTime, uPhase, uSeed, uAmp, uBend, uPectoral;
  varying vec3 vLocal, vWorld, vN, vNl;
  varying vec4 vFin;
  varying float vFold;
  void main() {
    vec3 p = position;
    float s = aFin.x, fin = step(0.5, aFin.z);
    // quanto si è dietro la testa (0 al muso, ~1 all'attacco della coda, oltre nella coda)
    float b = max(0.42 - p.x, 0.0);
    // onda del corpo che corre dalla testa alla coda; nella pinna arriva in ritardo verso il bordo
    float tail = 1.0 - smoothstep(-0.55, 0.35, p.x);
    float A = 0.004 + uAmp * tail * tail;
    float w = p.x * 5.0 + uPhase - fin * s * 1.3;
    p.z += A * sin(w);
    // nelle curve il corpo si piega ad arco lungo la traiettoria; la coda, più lenta a girare, ancora di più
    p.z += uBend * b * b * (1.0 + 0.6 * fin * s);
    vec3 n = normal;
    n.x -= (A * 5.0 * cos(w) - 2.0 * uBend * b) * n.z;
    vFold = 0.0;
    if (aFin.z > 0.5) {
      float k = uSeed + aFin.z * 1.7;
      // il velo: due onde lente che vanno dalla base al bordo, più ampie verso la punta
      float ph = uTime * 1.4 - s * 4.0 - aFin.y * 2.6 + k;
      float ph2 = uTime * 0.83 - s * 2.4 + aFin.y * 1.9 + k * 1.3;
      float wave = 0.075 * pow(s, 1.4) * sin(ph) + 0.04 * pow(s, 1.7) * sin(ph2);
      // le pettorali battono veloci, come piccoli ventagli
      if (aFin.z > 4.5) wave = 0.03 * s * sin(uTime * uPectoral + aFin.y * 2.0 + k);
      p.z += wave;
      // il velo si allunga e si raccoglie appena, come trascinato dall'acqua
      p.y += 0.02 * s * s * sin(uTime * 1.05 + aFin.y * 2.5 + k);
      p.x -= 0.015 * s * s * (1.0 + sin(uTime * 0.9 + aFin.y * 3.1 + k));
      // bordo increspato
      p.z += 0.016 * pow(s, 4.0) * sin(aFin.y * aFin.w * 2.6 + uTime * 2.0 + k);
      // pendenza delle pieghe, per la luce che cambia sul velo
      vFold = -(cos(ph) * pow(s, 0.6) + 0.5 * cos(ph2) * pow(s, 0.7));
    }
    vLocal = position;
    vNl = normalize(n);
    vFin = aFin;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    vN = normalize(mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
// caustiche e luce dell'acqua: meno blu di quella degli altri oggetti, perché i colori si leggano
const LIGHT = /* glsl */ `
  float caustics(vec3 p) {
    vec2 q = p.xz * 1.2 + p.y * 0.15;
    float c1 = vnoise(q * 1.7 + vec2(uTime * 0.45, -uTime * 0.2));
    float c2 = vnoise(q * 2.9 - vec2(uTime * 0.32, uTime * 0.27));
    return pow(1.0 - abs(c1 - c2), 7.0);
  }
  vec3 ambient(float up) {
    vec3 a = mix(uDeep * 2.2, uShallow * 1.1, up * 0.5 + 0.5);
    return mix(a, vec3(dot(a, vec3(0.3, 0.5, 0.2))), 0.55);
  }
  const vec3 SUN = vec3(-0.287, 0.957, 0.191);
`;

export function createBettas(shared, { art }) {
  const geo = bettaGeometry();
  const lin = (hex) => new THREE.Color(hex);
  // magenta con le pinne più chiare in punta; blu con le pinne rosse e le punte azzurre; corallo
  const KINDS = [
    { body: '#B81874', iri: '#FF8AD0', finA: '#A0105E', finB: '#E2509C', edge: '#FFC4E4' },
    { body: '#2A4FC4', iri: '#8EC8FF', finA: '#C21C38', finB: '#E05278', edge: '#7C9CFF' },
    { body: '#D4485E', iri: '#FFB4C4', finA: '#B82A48', finB: '#F08C9C', edge: '#FFE0DA' },
  ];
  // stesso giro per tutti, distanziati di un terzo; scala, quota e velocità appena diverse
  const fish = [
    { kind: 0, len: 1.3, u: 0.0, speed: 0.4, scale: 1.0, dy: 0.0, seed: 0.7 },
    { kind: 1, len: 1.15, u: 0.34, speed: 0.38, scale: 1.05, dy: 0.3, seed: 2.3 },
    { kind: 2, len: 1.0, u: 0.67, speed: 0.42, scale: 0.96, dy: -0.2, seed: 4.1 },
  ].map((f) => {
    const K = KINDS[f.kind];
    const uniforms = { ...shared, uPhase: { value: 0 }, uSeed: { value: f.seed }, uAmp: { value: 0.04 }, uBend: { value: 0 }, uPectoral: { value: 7 + f.seed } };
    const body = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uBody: { value: lin(K.body) }, uIri: { value: lin(K.iri) } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uExposure, uTime;
        uniform vec3 uBody, uIri;
        varying vec3 vLocal, vWorld, vN, vNl;
        ${GLSL_COMMON}
        ${FOG_GLSL}
        ${LIGHT}
        void main() {
          vec3 N = normalize(vN);
          vec3 Nl = normalize(vNl);
          vec3 V = normalize(cameraPosition - vWorld);
          // scaglie: file sfalsate lungo il corpo, col bordo chiaro e metallico (sparisce da lontano)
          vec2 uv = vec2(vLocal.x * 64.0, atan(vLocal.y - 0.006, vLocal.z) / 6.2832 * 40.0);
          float row = floor(uv.y);
          vec2 q = vec2(fract(uv.x + 0.5 * mod(row, 2.0)), fract(uv.y));
          float d = length(vec2(q.x, (q.y - 0.5) * 1.15));
          float fw = fwidth(uv.x) + fwidth(uv.y);
          float edge = smoothstep(0.32, 0.5, d) * (1.0 - smoothstep(0.5, 0.7, d)) * (1.0 - smoothstep(0.3, 0.7, fw));
          // ogni scaglia riflette un po' diversa dalle vicine
          float scale = hash12(vec2(floor(uv.x + 0.5 * mod(row, 2.0)), row)) * (1.0 - smoothstep(0.3, 0.7, fw));
          // testa più scura, una leggera variazione lungo i fianchi
          vec3 base = uBody * (1.0 - 0.4 * smoothstep(0.36, 0.48, vLocal.x)) * (0.9 + 0.2 * vnoise(vLocal.xy * 30.0)) * (0.9 + 0.2 * scale);
          // riflessi iridescenti: di taglio e sui bordi delle scaglie
          float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.0);
          base = mix(base, uIri, 0.35 * fres + 0.2 * edge + 0.12 * scale * scale);
          float c = caustics(vWorld) * smoothstep(0.1, 0.8, N.y);
          float ndl = max(dot(N, SUN), 0.0);
          vec3 col = base * (ambient(N.y) + vec3(0.95, 1.0, 1.0) * ndl * (0.4 + 1.2 * c));
          col += uIri * pow(max(dot(N, normalize(SUN + V)), 0.0), 30.0) * (0.25 + 0.5 * edge);
          // bocca piccola e all'insù, sulla punta del muso
          float mouth = 1.0 - smoothstep(0.0015, 0.0035, abs(vLocal.y - 0.004 - (vLocal.x - 0.49) * 0.9));
          col *= 1.0 - 0.5 * mouth * smoothstep(0.47, 0.49, vLocal.x) * smoothstep(0.3, 0.6, abs(Nl.z));
          // occhio grande: nero, con l'anello del colore del corpo e un punto di luce
          float e = length(vec2(vLocal.x - 0.452, vLocal.y - 0.022));
          float side = smoothstep(0.4, 0.75, abs(Nl.z));
          float eye = (1.0 - smoothstep(0.0115, 0.0135, e)) * side;
          vec3 eyeCol = mix(vec3(0.01), uIri * 0.5, smoothstep(0.0075, 0.0105, e));
          eyeCol += vec3(0.8) * (1.0 - smoothstep(0.0, 0.003, length(vec2(vLocal.x - 0.455, vLocal.y - 0.026))));
          col = mix(col, eyeCol, eye);
          float dist = length(cameraPosition - vWorld);
          col = mix(waterColor(-V), col, waterFog(dist, -vWorld.y));
          gl_FragColor = vec4(softClip(col * uExposure), 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    const fins = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uFinA: { value: lin(K.finA) }, uFinB: { value: lin(K.finB) }, uEdge: { value: lin(K.edge) } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uExposure, uTime;
        uniform vec3 uFinA, uFinB, uEdge;
        varying vec3 vLocal, vWorld, vN;
        varying vec4 vFin;
        varying float vFold;
        ${GLSL_COMMON}
        ${FOG_GLSL}
        ${LIGHT}
        void main() {
          float s = vFin.x, v = vFin.y, nr = vFin.w;
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vWorld);
          // raggi sottili e più scuri che si biforcano verso il bordo, la membrana tra uno e l'altro
          float n2 = nr * mix(1.0, 2.0, smoothstep(0.45, 0.6, s));
          float k = fract(v * n2);
          float fw = fwidth(v * n2) * 1.5;
          float ray = (1.0 - smoothstep(0.0, 0.12 + fw, min(k, 1.0 - k))) * (1.0 - smoothstep(0.35, 0.8, fw));
          vec3 col = mix(uFinA, uFinB, smoothstep(0.05, 0.7, s));
          col = mix(col, uEdge, smoothstep(0.68, 1.0, s));
          col *= 1.0 - 0.18 * ray;
          // velo sottile: la luce lo attraversa da sopra, le pieghe la spostano, le caustiche ci danzano
          float c = caustics(vWorld);
          col *= ambient(abs(N.y)) * 0.8 + 0.45 + 0.35 * abs(dot(N, SUN)) + 0.22 * vFold + 0.7 * c;
          // iridescenza di taglio
          float fres = pow(1.0 - abs(dot(N, V)), 2.0);
          col = mix(col, uEdge * 1.15, fres * 0.3);
          float a = mix(0.96, 0.6, smoothstep(0.15, 1.0, s)) * (0.88 + 0.12 * ray);
          a *= 1.0 - smoothstep(0.84, 1.0, s) * 0.75; // bordo sottilissimo, quasi trasparente
          if (vFin.z > 4.5) a *= 0.22; // pettorali quasi trasparenti
          float dist = length(cameraPosition - vWorld);
          float f = waterFog(dist, -vWorld.y);
          col = mix(waterColor(-V), col, f);
          gl_FragColor = vec4(softClip(col * uExposure), a * mix(0.5, 1.0, f));
          #include <colorspace_fragment>
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, [body, fins]);
    mesh.scale.setScalar(f.len);
    mesh.frustumCulled = false;
    mesh.renderOrder = 8;
    return { ...f, mesh, uniforms, phase: f.seed, kick: 0, bend: 0, heading: null };
  });

  const group = new THREE.Group();
  fish.forEach((f) => group.add(f.mesh));

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
      // quanto gira (rad/s attorno alla verticale): il corpo si piega dalla parte opposta, con calma
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
      if (ray.distanceToPoint(f.mesh.position) < f.len * 0.6) {
        f.kick = 2.2;
        return f.mesh.position.clone();
      }
    }
    return null;
  }

  return { group, update, poke, fish };
}
