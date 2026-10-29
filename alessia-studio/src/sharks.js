import * as THREE from 'three';
import { GLSL_COMMON } from './materials.js';
import { FOG_GLSL } from './water-glsl.js';

// Due squali (1,5 e 1,15 m) che girano attorno alla statua del fondale.
// Geometria procedurale: corpo a sezioni (muso conico appena schiacciato, dorso arrotondato, ventre
// piatto, peduncolo alto e stretto), pinne a falce con un po' di spessore (prima e seconda dorsale,
// pettorali, pelviche, anale) e coda asimmetrica col lobo superiore lungo.
// Nuoto nel vertex shader: un'onda laterale che cresce verso la coda (la testa oscilla appena).
// Pelle: controombreggiatura (dorso grigio-blu, fianchi argentei, ventre bianco), bordi scuri delle
// pinne, cinque fessure branchiali, bocca, grana fine e caustiche; pelle opaca, velata dall'acqua
// come nei video subacquei (contrasto basso a qualche metro), nuoto lento.
// Il giro non è un'ellisse perfetta: raggio e quota cambiano piano. Se li si tocca, scattano via.

// profilo del corpo: s = 0 muso … 1 attacco della coda -> mezza larghezza, mezza altezza
function profile(s) {
  const w = s < 0.32
    ? 0.1 * Math.pow(Math.sin(((s / 0.32) * Math.PI) / 2), 0.62)
    : 0.1 * (1 - 0.83 * Math.pow((s - 0.32) / 0.68, 1.1));
  // testa più larga che alta, corpo più alto che largo, peduncolo alto e stretto
  const hr = s < 0.3 ? 0.8 + 0.42 * (s / 0.3) : 1.22 + 0.25 * Math.max(0, (s - 0.6) / 0.4);
  return { w, h: w * hr };
}
const xOf = (s) => 0.5 - s; // muso a +x
const sOf = (x) => 0.5 - x;
const H = (s) => profile(s).h, W = (s) => profile(s).w;
const yc = (s) => -0.006 * s; // la linea del corpo scende appena verso la coda

function sharkGeometry() {
  const pos = [], aS = [], aFin = [], idx = [];
  const vert = (x, y, z, fin = 0) => {
    pos.push(x, y, z);
    aS.push(sOf(x));
    aFin.push(fin);
    return pos.length / 3 - 1;
  };
  const P = (i) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  // triangolo orientato: la normale della faccia deve guardare verso `out`
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
  const tri = (a, b, c, out) => {
    const pa = P(a);
    fn.crossVectors(e1.subVectors(P(b), pa), e2.subVectors(P(c), pa));
    if (fn.dot(out) < 0) idx.push(a, c, b);
    else idx.push(a, b, c);
  };

  // ---------------- corpo ----------------
  const NS = 40, NR = 20;
  const tip = vert(0.505, 0, 0);
  const rings = [];
  for (let i = 1; i <= NS; i++) {
    const s = 0.004 + (i / NS) ** 1.1 * 0.996;
    const { w, h } = profile(s);
    const ring = [];
    for (let j = 0; j < NR; j++) {
      const t = (j / NR) * Math.PI * 2;
      const sy = Math.sin(t), cz = Math.cos(t);
      // dorso tondo; ventre più piatto (più piatto ancora sotto la testa)
      const belly = s < 0.22 ? 0.66 : 0.8;
      const y = sy >= 0 ? h * sy : -h * belly * Math.pow(-sy, 0.78);
      const z = w * Math.sign(cz) * Math.pow(Math.abs(cz), 0.92);
      ring.push(vert(xOf(s), yc(s) + y, z));
    }
    rings.push(ring);
  }
  const axisOut = (a, b, c) => {
    const m = P(a).add(P(b)).add(P(c)).multiplyScalar(1 / 3);
    return m.sub(new THREE.Vector3(m.x, yc(sOf(m.x)), 0));
  };
  for (let j = 0; j < NR; j++) {
    const a = rings[0][(j + 1) % NR], b = rings[0][j];
    tri(tip, a, b, axisOut(tip, a, b).add(new THREE.Vector3(0.02, 0, 0)));
  }
  for (let i = 0; i < NS - 1; i++) {
    for (let j = 0; j < NR; j++) {
      const a = rings[i][j], b = rings[i][(j + 1) % NR], c = rings[i + 1][j], d = rings[i + 1][(j + 1) % NR];
      tri(a, b, c, axisOut(a, b, c));
      tri(b, d, c, axisOut(b, d, c));
    }
  }
  const end = vert(xOf(1) - 0.006, yc(1), 0);
  const last = rings[NS - 1];
  for (let j = 0; j < NR; j++) tri(end, last[j], last[(j + 1) % NR], new THREE.Vector3(-1, 0, 0));

  // ---------------- pinne: una lente sottile per lato ----------------
  // outline: contorno [x, y, z] (bordo, spessore zero); c: centro vicino alla radice; th: mezzo spessore
  const fin = (outline, c, th) => {
    const C = new THREE.Vector3(...c);
    const O = outline.map((p) => new THREE.Vector3(...p));
    // normale del piano della pinna (media delle normali dei triangoli del ventaglio)
    const n = new THREE.Vector3();
    O.forEach((p, i) => n.add(new THREE.Vector3().crossVectors(p.clone().sub(C), O[(i + 1) % O.length].clone().sub(C))));
    n.normalize();
    // anelli dal centro al bordo: lo spessore cala dolcemente (una lente), aFin cresce verso il bordo
    const RINGS = [[0.3, 0.88, 0.4], [0.6, 0.62, 0.62], [0.82, 0.34, 0.8], [1, 0, 1]];
    for (const sg of [1, -1]) {
      const off = n.clone().multiplyScalar(sg * th);
      const cId = vert(C.x + off.x, C.y + off.y, C.z + off.z, 0.2);
      const rings = RINGS.map(([f, t, a]) => O.map((p) => {
        const m = C.clone().lerp(p, f).addScaledVector(off, t);
        return vert(m.x, m.y, m.z, a);
      }));
      const out = n.clone().multiplyScalar(sg);
      for (let i = 0; i < O.length; i++) {
        const k = (i + 1) % O.length;
        tri(cId, rings[0][i], rings[0][k], out);
        for (let r = 0; r < rings.length - 1; r++) {
          tri(rings[r][i], rings[r + 1][i], rings[r + 1][k], out);
          tri(rings[r][i], rings[r + 1][k], rings[r][k], out);
        }
      }
    }
  };
  const top = (s, d) => [xOf(s), yc(s) + H(s) + d, 0];
  // prima dorsale, a falce, con la punta posteriore libera
  const hd = H(0.36);
  fin([
    [xOf(0.3), yc(0.3) + H(0.3) * 0.82, 0], [xOf(0.325), hd + 0.05, 0], [xOf(0.352), hd + 0.1, 0], [xOf(0.388), hd + 0.145, 0],
    [xOf(0.432), hd + 0.172, 0], [xOf(0.445), hd + 0.14, 0], [xOf(0.452), hd + 0.09, 0], [xOf(0.47), hd + 0.045, 0],
    [xOf(0.515), yc(0.5) + H(0.5) + 0.012, 0], [xOf(0.48), yc(0.48) + H(0.48) * 0.82, 0],
  ], [xOf(0.39), hd + 0.025, 0], 0.012);
  // seconda dorsale e anale, piccole
  fin([[xOf(0.765), yc(0.765) + H(0.765) * 0.8, 0], top(0.785, 0.03), top(0.81, 0.042), top(0.835, 0.008), [xOf(0.825), yc(0.825) + H(0.825) * 0.8, 0]],
    top(0.795, 0.006), 0.005);
  const bot = (s, d) => [xOf(s), yc(s) - H(s) * 0.8 - d, 0];
  fin([[xOf(0.775), yc(0.775) - H(0.775) * 0.6, 0], bot(0.795, 0.025), bot(0.82, 0.035), bot(0.845, 0.006), [xOf(0.835), yc(0.835) - H(0.835) * 0.6, 0]],
    bot(0.805, -0.006), 0.005);
  // pettorali: grandi, a falce, verso il basso e indietro
  const wp = W(0.3);
  for (const sd of [1, -1]) {
    fin([
      [xOf(0.235), -0.045, sd * wp * 0.84], [xOf(0.28), -0.07, sd * (wp + 0.06)], [xOf(0.35), -0.1, sd * (wp + 0.14)],
      [xOf(0.47), -0.142, sd * (wp + 0.21)], [xOf(0.43), -0.116, sd * (wp + 0.13)], [xOf(0.39), -0.09, sd * (wp + 0.06)],
      [xOf(0.34), -0.056, sd * wp * 0.84],
    ], [xOf(0.31), -0.066, sd * (wp + 0.035)], 0.01);
    // pelviche, piccole
    const wv = W(0.63), hv = H(0.63);
    fin([
      [xOf(0.6), yc(0.6) - hv * 0.72, sd * wv * 0.6], [xOf(0.64), yc(0.64) - hv - 0.025, sd * wv * 0.95],
      [xOf(0.715), yc(0.7) - hv - 0.045, sd * wv * 1.05], [xOf(0.68), yc(0.68) - hv * 0.8, sd * wv * 0.7],
    ], [xOf(0.64), yc(0.64) - hv * 0.85, sd * wv * 0.75], 0.006);
  }
  // coda: lobo superiore lungo e a falce, inferiore più corto, bordo posteriore concavo
  fin([
    [-0.47, 0.022, 0], [-0.56, 0.082, 0], [-0.66, 0.152, 0], [-0.775, 0.232, 0], [-0.745, 0.196, 0], [-0.705, 0.148, 0],
    [-0.668, 0.08, 0], [-0.648, 0.012, 0], [-0.666, -0.048, 0], [-0.705, -0.114, 0], [-0.64, -0.092, 0], [-0.56, -0.058, 0],
    [-0.47, -0.026, 0],
  ], [-0.56, 0.012, 0], 0.013);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
  g.setAttribute('aFin', new THREE.Float32BufferAttribute(aFin, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createSharks(shared) {
  const geo = sharkGeometry();
  // occhio: sul fianco della testa
  const { w: we, h: he } = profile(0.09);
  const ey = 0.016, ez = we * Math.pow(Math.cos(Math.asin(Math.min(1, ey / he))), 0.92);
  const lin = (hex) => new THREE.Color(hex);

  const sharks = [
    { len: 1.5, dir: 1, theta: 0.6, speed: 0.75, rx: 2.9, yK: 0.45, yAdd: 0.55, phase: 0, kick: 0, seed: 0.3 },
    { len: 1.15, dir: -1, theta: 3.4, speed: 0.65, rx: 2.3, yK: -0.5, yAdd: -0.75, phase: 2, kick: 0, seed: 2.1 },
  ].map((sh) => {
    const uniforms = {
      ...shared,
      uPhase: { value: 0 },
      uAmp: { value: 0.065 },
      uBack: { value: lin('#46545A') },
      uFlank: { value: lin('#98A2A3') },
      uBelly: { value: lin('#D9DEDB') },
      uEye: { value: new THREE.Vector3(xOf(0.09), ey, ez) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute float aS;
        attribute float aFin;
        uniform float uPhase, uAmp;
        varying vec3 vLocal, vWorld, vN, vNl;
        varying float vFin;
        void main() {
          vec3 p = position;
          float s = aS;
          float k = 6.2;
          float sc = max(s, 0.0);
          float A = uAmp * (0.1 + pow(sc, 1.7));
          float wv = sin(k * s - uPhase);
          p.z += A * wv;
          // la normale segue la flessione del corpo
          float dA = uAmp * 1.7 * pow(max(sc, 0.001), 0.7);
          float f1 = dA * wv + A * k * cos(k * s - uPhase);
          vec3 n = normalize(normal + vec3(normal.z * f1, 0.0, 0.0));
          vLocal = position;
          vNl = n;
          vFin = aFin;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorld = wp.xyz;
          vN = normalize(mat3(modelMatrix) * n);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uExposure, uTime;
        uniform vec3 uBack, uFlank, uBelly, uEye;
        varying vec3 vLocal, vWorld, vN, vNl;
        varying float vFin;
        ${GLSL_COMMON}
        ${FOG_GLSL}
        float caustics(vec3 p) {
          vec2 q = p.xz * 1.2 + p.y * 0.15;
          float c1 = vnoise(q * 1.7 + vec2(uTime * 0.45, -uTime * 0.2));
          float c2 = vnoise(q * 2.9 - vec2(uTime * 0.32, uTime * 0.27));
          return pow(1.0 - abs(c1 - c2), 7.0);
        }
        float line(float d, float w) { return 1.0 - smoothstep(w * 0.4, w, abs(d)); }
        void main() {
          vec3 N = normalize(vN);
          vec3 Nl = normalize(vNl);
          if (!gl_FrontFacing) { N = -N; Nl = -Nl; }
          vec3 V = normalize(cameraPosition - vWorld);
          float fin = step(0.1, vFin);
          // controombreggiatura: dorso grigio-blu, fianchi argentei, ventre bianco con un confine netto
          float yy = Nl.y + vLocal.y * 4.0;
          vec3 base = mix(uFlank, uBack, smoothstep(0.02, 0.4, yy));
          base = mix(base, uBelly, 1.0 - smoothstep(-0.5, -0.28, yy));
          // pinne: più scure verso il bordo d'uscita
          base *= 1.0 - fin * (0.08 + 0.38 * smoothstep(0.62, 1.0, vFin));
          // grana fine della pelle
          base *= 0.96 + 0.08 * vnoise(vLocal.xy * 140.0 + vLocal.z * 90.0);
          float side = smoothstep(0.35, 0.6, abs(Nl.z)) * (1.0 - fin);
          // cinque fessure branchiali, appena curve
          float gl = 0.0;
          for (int i = 0; i < 5; i++) {
            float fi = float(i);
            float x0 = 0.295 - fi * 0.0155 - 0.012 * pow((vLocal.y + 0.004) / 0.05, 2.0);
            gl = max(gl, line(vLocal.x - x0, 0.0032) * step(abs(vLocal.y + 0.004), 0.046 - fi * 0.003));
          }
          base *= 1.0 - 0.35 * gl * side;
          // bocca: una mezzaluna sotto il muso
          float mz = vLocal.z / 0.055;
          float mouth = line(vLocal.x - (0.375 - 0.028 * (1.0 - mz * mz)), 0.004) * step(abs(mz), 1.0) * smoothstep(-0.3, -0.6, Nl.y) * (1.0 - fin);
          base *= 1.0 - 0.45 * mouth;
          // luce dalla superficie con le caustiche; ambiente dell'acqua dal basso
          vec3 L = normalize(vec3(-0.3, 1.0, 0.2));
          float ndl = max(dot(N, L), 0.0);
          float c = caustics(vWorld) * smoothstep(0.1, 0.8, N.y);
          vec3 light = mix(uDeep * 2.3, uShallow * 1.1, N.y * 0.5 + 0.5) + vec3(0.92, 1.0, 1.0) * ndl * (0.22 + 1.3 * c);
          vec3 col = base * light;
          // bordo che si confonde con l'acqua
          float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
          col = mix(col, waterColor(-V), fres * 0.5);
          // occhi: scuri, con un punto di luce
          vec3 e = vec3(vLocal.x - uEye.x, vLocal.y - uEye.y, abs(vLocal.z) - uEye.z);
          float eye = (1.0 - smoothstep(0.008, 0.0115, length(e))) * (1.0 - fin);
          float glint = 1.0 - smoothstep(0.0, 0.0035, length(e - vec3(0.003, 0.004, 0.0)));
          col = mix(col, vec3(0.01, 0.016, 0.02), eye);
          col += vec3(0.9) * glint * eye;
          float dist = length(cameraPosition - vWorld);
          col = mix(waterColor(-V), col, waterFog(dist, -vWorld.y) * (0.88 * exp(-dist * 0.06)));
          col *= uExposure;
          gl_FragColor = vec4(softClip(col), 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(sh.len / 1.27);
    mesh.frustumCulled = false;
    return { ...sh, mesh, uniforms };
  });

  const group = new THREE.Group();
  sharks.forEach((sh) => group.add(sh.mesh));

  const C = new THREE.Vector3(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4(), bank = new THREE.Quaternion(), AX = new THREE.Vector3(1, 0, 0);
  let ez2 = 3, ey2 = 1, ex2 = 0;

  // centro ed estensione dei punti attorno a cui girare (smorzati: niente salti)
  const Ct = new THREE.Vector3();
  let placed = false;
  function fit(points, dt) {
    if (!points.length) return;
    Ct.set(0, 0, 0);
    points.forEach((b) => Ct.add(b));
    Ct.multiplyScalar(1 / points.length);
    let ex = 0, ez = 0, ey = 0;
    points.forEach((b) => {
      ex = Math.max(ex, Math.abs(b.x - Ct.x));
      ez = Math.max(ez, Math.abs(b.z - Ct.z));
      ey = Math.max(ey, Math.abs(b.y - Ct.y));
    });
    const k = placed ? 1 - Math.exp(-dt * 0.7) : 1;
    placed = true;
    C.lerp(Ct, k);
    ex2 += (ex - ex2) * k;
    ez2 += (ez - ez2) * k;
    ey2 += (ey - ey2) * k;
  }

  // il giro: un'ellisse deformata piano (raggio e quota cambiano lungo il percorso)
  function pathAt(sh, t, out) {
    const rz = ez2 + 2.1, rx = sh.rx + ex2;
    const k = 1 + 0.13 * Math.sin(2 * t + sh.seed * 3) + 0.07 * Math.sin(3 * t + sh.seed * 5);
    const y0 = C.y + sh.yK * ey2 + sh.yAdd;
    return out.set(C.x + rx * k * Math.cos(t), y0 + 0.35 * Math.sin(2 * t + sh.len) + 0.22 * Math.sin(1.3 * t + sh.seed), C.z + rz * k * Math.sin(t));
  }

  const ahead = new THREE.Vector3();
  function update(dt, points) {
    fit(points, dt);
    for (const sh of sharks) {
      const boost = 1 + sh.kick;
      sh.kick *= Math.exp(-dt * 0.9);
      const r = Math.sqrt(((sh.rx + ex2) ** 2 + (ez2 + 2.1) ** 2) / 2);
      sh.theta += (dt * sh.dir * sh.speed * boost) / r;
      sh.phase += dt * 4.4 * (0.8 + 0.7 * boost);
      sh.uniforms.uPhase.value = sh.phase;
      sh.uniforms.uAmp.value = 0.065 + 0.025 * Math.min(1, sh.kick);
      pathAt(sh, sh.theta, sh.mesh.position);
      // direzione di nuoto = tangente al percorso
      X.subVectors(pathAt(sh, sh.theta + 0.02 * sh.dir, ahead), sh.mesh.position).normalize();
      Z.crossVectors(X, UP).normalize();
      Y.crossVectors(Z, X);
      m.makeBasis(X, Y, Z);
      sh.mesh.quaternion.setFromRotationMatrix(m);
      // si inclina appena verso l'interno della curva
      bank.setFromAxisAngle(AX, -0.12 * sh.dir);
      sh.mesh.quaternion.multiply(bank);
    }
  }

  // un tocco vicino a uno squalo lo fa scattare; restituisce la sua posizione (per le bollicine)
  const tmp = new THREE.Vector3();
  function poke(ray) {
    for (const sh of sharks) {
      if (ray.distanceToPoint(sh.mesh.position) < sh.len * 0.75) {
        sh.kick = 2.4;
        return tmp.copy(sh.mesh.position);
      }
    }
    return null;
  }

  return { group, update, poke, sharks };
}
