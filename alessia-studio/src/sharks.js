import * as THREE from 'three';
import { GLSL_COMMON } from './materials.js';
import { FOG_GLSL } from './water-glsl.js';

// Due squaletti che nuotano attorno ai testi dei servizi sott'acqua. Geometria procedurale (corpo a sezioni
// ellittiche, pinne piatte), nuoto nel vertex shader (onda laterale che cresce verso la coda),
// controombreggiatura (dorso blu, ventre chiaro), caustiche sul dorso. Se li si tocca, scattano via.

// profilo del corpo: s = 0 muso … 1 attacco della coda -> mezza larghezza, mezza altezza
function profile(s) {
  const w = s < 0.3
    ? 0.105 * Math.pow(Math.sin(((s / 0.3) * Math.PI) / 2), 0.7)
    : 0.105 * (1 - 0.84 * Math.pow((s - 0.3) / 0.7, 1.25));
  return { w, h: w * 1.18 };
}
const xOf = (s) => 0.5 - s; // muso a +x
const sOf = (x) => 0.5 - x;

function sharkGeometry() {
  const pos = [], aS = [], idx = [];
  const vert = (x, y, z) => {
    pos.push(x, y, z);
    aS.push(sOf(x));
    return pos.length / 3 - 1;
  };
  // corpo
  const NS = 34, NR = 18;
  const tip = vert(0.505, 0, 0);
  const rings = [];
  for (let i = 1; i <= NS; i++) {
    const s = 0.004 + (i / NS) * 0.996;
    const { w, h } = profile(s);
    const ring = [];
    for (let j = 0; j < NR; j++) {
      const t = (j / NR) * Math.PI * 2;
      const sy = Math.sin(t);
      ring.push(vert(xOf(s), h * sy * (sy < 0 ? 0.82 : 1) - 0.006 * s, w * Math.cos(t)));
    }
    rings.push(ring);
  }
  for (let j = 0; j < NR; j++) idx.push(tip, rings[0][(j + 1) % NR], rings[0][j]);
  for (let i = 0; i < NS - 1; i++) {
    for (let j = 0; j < NR; j++) {
      const a = rings[i][j], b = rings[i][(j + 1) % NR], c = rings[i + 1][j], d = rings[i + 1][(j + 1) % NR];
      idx.push(a, b, c, b, d, c);
    }
  }
  const end = vert(xOf(1) - 0.008, -0.006, 0);
  const last = rings[NS - 1];
  for (let j = 0; j < NR; j++) idx.push(end, last[j], last[(j + 1) % NR]);

  // pinne (piatte, a doppia faccia)
  const fin = (pts, tris) => {
    const ids = pts.map((p) => vert(p[0], p[1], p[2] || 0));
    tris.forEach((t) => idx.push(ids[t[0]], ids[t[1]], ids[t[2]]));
  };
  const H = (s) => profile(s).h, W = (s) => profile(s).w;
  // dorsale
  fin([[xOf(0.33), H(0.33) * 0.92], [xOf(0.4), H(0.4) + 0.085], [xOf(0.56), H(0.46) + 0.15], [xOf(0.5), H(0.5) * 0.92]], [[0, 1, 2], [0, 2, 3]]);
  // seconda dorsale e anale, piccole
  fin([[xOf(0.78), H(0.78) * 0.9], [xOf(0.88), H(0.84) + 0.04], [xOf(0.85), H(0.85) * 0.9]], [[0, 1, 2]]);
  fin([[xOf(0.76), -H(0.76) * 0.8], [xOf(0.86), -H(0.82) - 0.035], [xOf(0.84), -H(0.84) * 0.8]], [[0, 1, 2]]);
  // caudale (lobo superiore più lungo)
  fin([[-0.49, 0.022], [-0.74, 0.2], [-0.6, 0.004], [-0.68, -0.11], [-0.49, -0.024]], [[0, 1, 2], [0, 2, 4], [4, 2, 3]]);
  // pettorali
  for (const side of [-1, 1]) {
    fin([
      [xOf(0.27), -H(0.27) * 0.42, side * W(0.27) * 0.86],
      [xOf(0.38), -H(0.38) * 0.5, side * W(0.38) * 0.86],
      [xOf(0.47), -H(0.36) * 0.5 - 0.1, side * (W(0.36) + 0.15)],
    ], [[0, 1, 2]]);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createSharks(shared) {
  const geo = sharkGeometry();
  // occhio: sul fianco della testa
  const { w: we, h: he } = profile(0.1);
  const ey = 0.018, ez = we * Math.cos(Math.asin(Math.min(1, ey / he)));
  const lin = (hex) => new THREE.Color(hex);

  const sharks = [
    { len: 1.5, dir: 1, theta: 0.6, speed: 1.1, rx: 2.9, yK: 0.45, yAdd: 0.55, phase: 0, kick: 0 },
    { len: 1.15, dir: -1, theta: 3.4, speed: 0.95, rx: 2.3, yK: -0.5, yAdd: -0.75, phase: 2, kick: 0 },
  ].map((sh) => {
    const uniforms = {
      ...shared,
      uPhase: { value: 0 },
      uAmp: { value: 0.055 },
      uBack: { value: lin('#2C586F') },
      uBelly: { value: lin('#E6F0EF') },
      uEye: { value: new THREE.Vector3(xOf(0.1), ey, ez) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute float aS;
        uniform float uPhase, uAmp;
        varying vec3 vLocal, vWorld, vN, vNl;
        void main() {
          vec3 p = position;
          float s = aS;
          float k = 6.2;
          float sc = max(s, 0.0);
          float A = uAmp * (0.12 + pow(sc, 1.7));
          float wv = sin(k * s - uPhase);
          p.z += A * wv;
          // la normale segue la flessione del corpo
          float dA = uAmp * 1.7 * pow(max(sc, 0.001), 0.7);
          float f1 = dA * wv + A * k * cos(k * s - uPhase);
          vec3 n = normalize(normal + vec3(normal.z * f1, 0.0, 0.0));
          vLocal = position;
          vNl = n;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorld = wp.xyz;
          vN = normalize(mat3(modelMatrix) * n);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uExposure, uTime;
        uniform vec3 uBack, uBelly, uEye;
        varying vec3 vLocal, vWorld, vN, vNl;
        ${GLSL_COMMON}
        ${FOG_GLSL}
        void main() {
          vec3 N = normalize(vN);
          vec3 Nl = normalize(vNl);
          if (!gl_FrontFacing) { N = -N; Nl = -Nl; }
          vec3 V = normalize(cameraPosition - vWorld);
          // controombreggiatura: dorso scuro, ventre chiaro, confine morbido sui fianchi
          float back = smoothstep(-0.3, 0.35, Nl.y + vLocal.y * 5.0);
          vec3 base = mix(uBelly, uBack, back);
          // branchie: tre righe sottili sui fianchi
          float gx = (vLocal.x - 0.215) / 0.024;
          float gill = step(abs(fract(gx) - 0.5), 0.09) * step(0.0, gx) * step(gx, 3.0) * step(abs(vLocal.y - 0.008), 0.042) * step(0.55, abs(Nl.z));
          base *= 1.0 - 0.22 * gill;
          // luce dalla superficie, ambiente dell'acqua dal basso
          float up = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 light = mix(uDeep * 2.4, uShallow * 1.45, up);
          vec3 col = base * light;
          // caustiche tremolanti sul dorso
          float c = sin(vWorld.x * 3.1 + uTime * 1.3) * sin(vWorld.z * 2.7 - uTime * 1.1) + 0.35 * sin(vWorld.x * 7.3 - vWorld.z * 5.1 + uTime * 2.0);
          col += vec3(0.85, 1.0, 1.0) * pow(max(c, 0.0), 3.0) * smoothstep(0.55, 0.95, up) * 0.22;
          // bordo che si confonde con l'acqua
          float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
          col = mix(col, waterColor(-V) * 1.1, fres * 0.45);
          // occhi: neri, con un punto di luce
          vec3 e = vec3(vLocal.x - uEye.x, vLocal.y - uEye.y, abs(vLocal.z) - uEye.z);
          float eye = 1.0 - smoothstep(0.009, 0.013, length(e));
          float glint = 1.0 - smoothstep(0.0, 0.004, length(e - vec3(0.004, 0.004, 0.0)));
          col = mix(col, vec3(0.012, 0.018, 0.024), eye);
          col += vec3(0.9) * glint * eye;
          float dist = length(cameraPosition - vWorld);
          col = mix(waterColor(-V), col, waterFog(dist, -vWorld.y));
          col *= uExposure;
          gl_FragColor = vec4(softClip(col), 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(sh.len / 1.24);
    mesh.frustumCulled = false;
    return { ...sh, mesh, uniforms };
  });

  const group = new THREE.Group();
  sharks.forEach((sh) => group.add(sh.mesh));

  const C = new THREE.Vector3(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4(), bank = new THREE.Quaternion(), AX = new THREE.Vector3(1, 0, 0);
  let ez2 = 3, ey2 = 1, ex2 = 0;

  // centro ed estensione dei punti attorno a cui girare: cambiano passando da un testo all'altro,
  // e gli squali le seguono nuotando (centro smorzato, niente salti)
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

  function update(dt, points) {
    fit(points, dt);
    for (const sh of sharks) {
      const boost = 1 + sh.kick;
      sh.kick *= Math.exp(-dt * 0.9);
      const rz = ez2 + 2.1, rx = sh.rx + ex2;
      const r = Math.sqrt((rx * rx + rz * rz) / 2);
      sh.theta += (dt * sh.dir * sh.speed * boost) / r;
      sh.phase += dt * 5.2 * (0.8 + 0.7 * boost);
      sh.uniforms.uPhase.value = sh.phase;
      sh.uniforms.uAmp.value = 0.05 + 0.02 * Math.min(1, sh.kick);
      const t = sh.theta;
      const y0 = C.y + sh.yK * ey2 + sh.yAdd;
      sh.mesh.position.set(C.x + rx * Math.cos(t), y0 + 0.35 * Math.sin(2 * t + sh.len), C.z + rz * Math.sin(t));
      // direzione di nuoto = tangente al percorso
      X.set(-rx * Math.sin(t), 0.7 * Math.cos(2 * t + sh.len), rz * Math.cos(t)).multiplyScalar(sh.dir).normalize();
      Z.crossVectors(X, UP).normalize();
      Y.crossVectors(Z, X);
      m.makeBasis(X, Y, Z);
      sh.mesh.quaternion.setFromRotationMatrix(m);
      // si inclina verso l'interno della curva
      bank.setFromAxisAngle(AX, -0.28 * sh.dir);
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
