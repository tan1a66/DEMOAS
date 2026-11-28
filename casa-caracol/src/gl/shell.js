import * as THREE from 'three';
import { NOISE, TIME, WAVE, CAUSTICS, LIGHT } from './chunks.js';
import { U } from './uniforms.js';
import { CONFIG } from '../config.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Caracol rosado (Aliger gigas) procedural: tubo que crece en espiral logarítmica
//  alrededor del eje Y, con una corona de puntas en el hombro de cada vuelta y el
//  labio final abierto hacia arriba. Ápice arriba, como la casa.
//  Si existe /models/conch.glb se usa ese modelo con el mismo material.
// ─────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

export const CONCH = {
  turns: 20 / 3, // vueltas (6,67) · con 9 puntas por vuelta salen 60 puntas exactas
  spikesPerTurn: 9,
  ringsPerSpike: 10, // resolución a lo largo de la espiral
  segS: 72, // resolución de la sección
  expansion: 1.8, // crecimiento por vuelta
  radius: 0.27, // distancia del centro del tubo al eje (en la abertura)
  a: 0.3, // semieje radial de la sección
  bUp: 0.2, // semieje hacia arriba
  bLow: 0.56, // semieje hacia abajo (el cono del cuerpo)
  pinch: 0.86, // cuánto se estrecha la parte baja hacia el eje
  drop: 0.56, // altura de la espira
  apexY: 0.92,
  shoulder: 0.66, // ángulo del hombro en la sección (rad, 0 = hacia fuera)
  spikeLen: 0.32,
  spikeHalfT: 0.3, // semiancho de cada punta a lo largo de la espiral (fracción)
  spikeHalfS: 0.44, // semiancho en la sección (rad)
  spikeTilt: 1.12, // inclinación de las puntas hacia arriba (rad)
  lipTurns: 0.3, // tramo final: el labio (sin abrir, solo una leve curva)
  flare: 0.0,
  mouthTurns: 0.24, // tramo final en que la abertura se estrecha
  mouth: 0.8, // cuánto se estrecha (0 = tubo abierto, 1 = rendija)
};

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const rand = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const angDist = (x, y) => {
  let d = (x - y) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

export const buildConchGeometry = (P = CONCH) => {
  const segT = Math.round(P.turns * P.spikesPerTurn * P.ringsPerSpike);
  const { segS } = P;
  const Theta = P.turns * TAU;
  const k = Math.log(P.expansion) / TAU;
  const spacing = TAU / P.spikesPerTurn;
  const lipStart = Theta - P.lipTurns * TAU;
  const mouthStart = Theta - P.mouthTurns * TAU;

  const count = (segT + 1) * segS;
  const pos = new Float32Array(count * 3);
  const aParam = new Float32Array(count * 2);
  const aSpike = new Float32Array(count);
  const aAO = new Float32Array(count);
  const aInner = new Float32Array(count * 2);
  const lastWhorl = Theta - TAU;

  for (let i = 0; i <= segT; i += 1) {
    const th = (i / segT) * Theta;
    const g = Math.exp(k * (th - Theta));
    const phi = -th; // dextrógiro
    const erx = Math.cos(phi);
    const erz = Math.sin(phi);
    const cx = erx * P.radius * g;
    const cz = erz * P.radius * g;
    const cy = P.apexY - P.drop * g;

    const lip = smooth(lipStart, Theta, th);
    const mouth = smooth(mouthStart, Theta, th) * P.mouth;
    const growth = th / Theta;
    const spikeGrow = smooth(0.18, 0.55, growth) * (1 - smooth(lipStart - 0.6, Theta - 0.5, th));

    // punta más cercana a lo largo de la espiral
    const xs = th / spacing;
    const n = Math.floor(xs);
    const ft = xs - n - 0.5;
    const pt = Math.max(0, 1 - Math.abs(ft) / P.spikeHalfT);
    const spikeVar = 0.78 + 0.44 * rand(n);
    // las vueltas anteriores a la última quedan, por debajo de la sutura, dentro de la
    // siguiente: solo se ven a través de la abertura → se pintan como interior
    const hidden = smooth(lastWhorl + 0.15, lastWhorl - 0.15, th) * smooth(lastWhorl - 1.0, lastWhorl - 0.45, th);
    // escudo parietal: el inicio de la última vuelta, junto a la abertura, es rosado y brillante
    const callus = smooth(lastWhorl - 0.25, lastWhorl + 0.1, th) * smooth(lastWhorl + 0.5, lastWhorl + 0.25, th);

    for (let j = 0; j < segS; j += 1) {
      const s = (j / segS) * TAU;
      const cs = Math.cos(s);
      const ss = Math.sin(s);
      let u;
      let v;
      if (ss >= 0) {
        u = P.a * cs;
        v = P.bUp * ss;
      } else {
        const tt = -ss;
        u = THREE.MathUtils.lerp(P.a * cs, -P.radius * 0.8, P.pinch * tt ** 1.5);
        v = -P.bLow * tt;
      }

      // abertura: la pared interna se acerca al labio → rendija alta y estrecha
      if (mouth > 0 && cs < 0) {
        u = THREE.MathUtils.lerp(u, P.a * 0.12, mouth * Math.min(-cs * 1.4, 1));
      }

      // labio: se abre hacia fuera y hacia arriba en el último tramo
      if (lip > 0 && P.flare > 0) {
        const outer = Math.max(cs, 0) ** 0.7;
        const up = Math.max(ss, 0);
        u += P.flare * lip * outer * P.a * (0.8 + 0.6 * up);
        v += P.flare * lip * up * outer * P.bUp * 2.6;
      }

      let px = cx + (erx * u) * g;
      let py = cy + v * g;
      let pz = cz + (erz * u) * g;

      // corona de puntas en el hombro
      const ps = Math.max(0, 1 - Math.abs(angDist(s, P.shoulder)) / P.spikeHalfS);
      const shape = (pt * ps) ** 1.35;
      const spike = shape * spikeGrow;
      if (spike > 0) {
        const len = P.spikeLen * g * spikeVar * spike;
        const dx = erx * Math.cos(P.spikeTilt);
        const dy = Math.sin(P.spikeTilt);
        const dz = erz * Math.cos(P.spikeTilt);
        px += dx * len;
        py += dy * len;
        pz += dz * len;
      }

      const idx = i * segS + j;
      pos[idx * 3] = px;
      pos[idx * 3 + 1] = py;
      pos[idx * 3 + 2] = pz;
      aParam[idx * 2] = growth;
      aParam[idx * 2 + 1] = j / segS;
      aSpike[idx] = spike;
      const lower = smooth(-0.04, -0.3, ss);
      aInner[idx * 2] = hidden * lower;
      aInner[idx * 2 + 1] = callus * lower * (1 - hidden);

      // oclusión aproximada: sutura con la vuelta anterior y base de las puntas
      const suture = Math.exp(-(((s - 1.85) / 0.5) ** 2));
      const spikeBase = ps * pt > 0 ? (1 - shape) * Math.min(ps * pt * 3, 1) * spikeGrow : 0;
      aAO[idx] = Math.max(0.25, 1 - 0.62 * suture - 0.16 * spikeBase);
    }
  }

  const index = [];
  for (let i = 0; i < segT; i += 1) {
    for (let j = 0; j < segS; j += 1) {
      const a = i * segS + j;
      const b = i * segS + ((j + 1) % segS);
      const c = (i + 1) * segS + j;
      const d = (i + 1) * segS + ((j + 1) % segS);
      index.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aParam', new THREE.BufferAttribute(aParam, 2));
  geo.setAttribute('aSpike', new THREE.BufferAttribute(aSpike, 1));
  geo.setAttribute('aAO', new THREE.BufferAttribute(aAO, 1));
  geo.setAttribute('aInner', new THREE.BufferAttribute(aInner, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  orientOutward(geo);
  geo.computeBoundingSphere();
  return geo;
};

// Labio grueso: una banda que cierra el borde de la abertura (sin ella el borde
// parece de papel). Geometría aparte con normales propias (arista viva).
export const buildLipGeometry = (P = CONCH, thickness = 0.045) => {
  const full = buildConchGeometry(P);
  const { segS } = P;
  const pos = full.attributes.position;
  const last = pos.count - segS;
  const ring = [];
  const center = new THREE.Vector3();
  for (let j = 0; j < segS; j += 1) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, last + j);
    ring.push(v);
    center.add(v);
  }
  center.multiplyScalar(1 / segS);
  const prev = new THREE.Vector3();
  for (let j = 0; j < segS; j += 1) prev.add(new THREE.Vector3().fromBufferAttribute(pos, last - segS + j));
  prev.multiplyScalar(1 / segS);
  const tangent = center.clone().sub(prev).normalize();

  const positions = [];
  const normals = [];
  ring.forEach((v) => {
    const inset = v.clone().add(center.clone().sub(v).normalize().multiplyScalar(thickness));
    positions.push(v.x, v.y, v.z, inset.x, inset.y, inset.z);
    normals.push(tangent.x, tangent.y, tangent.z, tangent.x, tangent.y, tangent.z);
  });
  const index = [];
  for (let j = 0; j < segS; j += 1) {
    const a = j * 2;
    const b = ((j + 1) % segS) * 2;
    index.push(a, a + 1, b, b, a + 1, b + 1);
  }
  // orientación: la cara delantera mira en la dirección de crecimiento
  const p0 = new THREE.Vector3(positions[0], positions[1], positions[2]);
  const p1 = new THREE.Vector3(positions[3], positions[4], positions[5]);
  const p2 = new THREE.Vector3(positions[6], positions[7], positions[8]);
  const geoN = p1.clone().sub(p0).cross(p2.clone().sub(p0));
  if (geoN.dot(tangent) < 0) {
    for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
  }
  const n = segS * 2;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('aParam', new THREE.BufferAttribute(new Float32Array(n * 2).fill(0.999), 2));
  geo.setAttribute('aSpike', new THREE.BufferAttribute(new Float32Array(n), 1));
  geo.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(n).fill(0.92), 1));
  geo.setAttribute('aInner', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  geo.setIndex(index);
  full.dispose();
  return geo;
};

// Garantiza que las caras delanteras miren hacia fuera (el interior es rosa).
const orientOutward = (geo) => {
  const p = geo.attributes.position;
  const nrm = geo.attributes.normal;
  let score = 0;
  for (let i = 0; i < p.count; i += 97) {
    score += p.getX(i) * nrm.getX(i) + p.getZ(i) * nrm.getZ(i);
  }
  if (score >= 0) return;
  const idx = geo.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = t;
  }
  geo.index.needsUpdate = true;
  geo.computeVertexNormals();
};

// ── Material: blanco cal mate, luz envuelta (subsurface falso), interior rosado ──
const shellVertex = /* glsl */ `
attribute vec2 aParam;
attribute float aSpike;
attribute float aAO;
attribute vec2 aInner;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vParam;
varying float vSpike;
varying float vAO;
varying vec2 vInner;
void main() {
  vInner = aInner;
  vec4 wp = modelMatrix * vec4(position, 1.);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vParam = aParam;
  vSpike = aSpike;
  vAO = aAO;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const shellFragment = /* glsl */ `
${NOISE}
${TIME}
${LIGHT}
${WAVE}
${CAUSTICS}
uniform vec3 uCalce;
uniform vec3 uSand;
uniform vec3 uPink;
uniform vec3 uWater;
uniform float uHasParams;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vParam;
varying float vSpike;
varying float vAO;
varying vec2 vInner;

void main() {
  vec3 N = normalize(vNormalW);
  bool outside = gl_FrontFacing;
  if (!outside) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = uSunDir;
  float growth = vParam.x;

  // albedo: cal con líneas de crecimiento muy finas; el ápice algo más gastado
  float lines = sin(growth * 6.2831 * 230. + vParam.y * 2.) * .5 + .5;
  float speck = vnoise(vWorld.xz * 38. + vWorld.y * 21.);
  vec3 albedo = uCalce * (.965 + .035 * lines * uHasParams) * (.985 + .03 * speck);
  albedo *= mix(vec3(.92, .89, .85), vec3(1.), smoothstep(.0, .4, growth) * uHasParams + (1. - uHasParams));

  // interior (caras traseras): nácar rosado, más intenso hacia dentro
  float pinkAmt = 0.;
  if (!outside) {
    pinkAmt = mix(.75, 1., smoothstep(1., .9, growth) * uHasParams);
  } else if (vInner.x + vInner.y > .01) {
    pinkAmt = max(vInner.x, vInner.y * .85);
  } else {
    // cara interna del labio, junto a la abertura
    pinkAmt = smoothstep(.975, 1., growth) * smoothstep(.55, .9, abs(vParam.y - .5) * 2.) * .7 * uHasParams;
  }
  vec3 pink = mix(uPink, uPink * vec3(.95, .78, .74), smoothstep(.95, .8, growth));
  albedo = mix(albedo, pink, pinkAmt);

  // luz envuelta: la sombra no es gris, se calienta (subsurface falso)
  float ndl = dot(N, L);
  float wrap = .55;
  float diff = clamp((ndl + wrap) / (1. + wrap), 0., 1.);
  float hemi = N.y * .5 + .5;
  // rebote de la arena (casi blanca y al sol) por debajo, cielo por arriba
  vec3 amb = mix(mix(uCalce, uSand, .35) * 1.05, uSkyZenith * .5 + uSkyHorizon * .5, hemi);
  vec3 sss = vec3(1., .82, .72);
  vec3 light = uSunColor * diff * .7 + amb * .56 + sss * (1. - diff) * .12;

  float ao = vAO * mix(.62, 1., smoothstep(0., .2, vWorld.y));
  vec3 col = albedo * light * mix(1., ao, .85);
  col *= 1. - vInner.x * .35; // vueltas ocultas, vistas a través de la abertura

  // translucidez de las puntas a contraluz
  float back = pow(clamp(dot(-V, L), 0., 1.), 3.) * vSpike;
  col += sss * uCalce * back * .32;
  // brillo de nácar en el interior
  vec3 R = reflect(-V, N);
  col += pinkAmt * pow(max(dot(R, L), 0.), 18.) * .25;
  col += vInner.y * pow(max(dot(R, L), 0.), 40.) * .35; // brillo del escudo

  // humedad de la ola en la base
  vec4 w = waveCore(vWorld.xz);
  float wetH = smoothstep(.12, .0, vWorld.y);
  col *= 1. - w.y * wetH * .2;
  col = mix(col, col * uWater, w.x * smoothstep(.03, .0, vWorld.y) * .6);

  // cáusticas proyectadas desde arriba en la dirección del sol
  vec2 cp = vWorld.xz + L.xz / max(L.y, .2) * vWorld.y;
  vec3 rp = rippleField(cp);
  vec3 cs = causticSample(cp, rp.xy);
  float facing = clamp(ndl, 0., 1.);
  float ci = mix(uCausticIntensity * .8, uCausticWater, w.x * wetH);
  col += cs * ci * facing * .55 * (1. + rp.z) * (1. - uFlat);

  // borde suave con el color del cielo
  float fr = pow(1. - clamp(dot(N, V), 0., 1.), 3.);
  col += mix(uSkyHorizon, uSkyZenith, hemi) * fr * .12;

  // versión plana (segmento de reemplazo de la foto)
  vec3 flatCol = uCalce * mix(.8, 1.02, smoothstep(.35, .55, diff));
  col = mix(col, flatCol, uFlat);

  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}
`;

export const createShellMaterial = (hasParams = true) =>
  new THREE.ShaderMaterial({
    uniforms: { ...U, uHasParams: { value: hasParams ? 1 : 0 } },
    vertexShader: shellVertex,
    fragmentShader: shellFragment,
    side: THREE.DoubleSide,
  });

// Asegura los atributos que usa el material en geometrías externas (GLB).
const ensureAttributes = (geo) => {
  const n = geo.attributes.position.count;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.aParam) geo.setAttribute('aParam', new THREE.BufferAttribute(new Float32Array(n * 2).fill(0.5), 2));
  if (!geo.attributes.aSpike) geo.setAttribute('aSpike', new THREE.BufferAttribute(new Float32Array(n), 1));
  if (!geo.attributes.aAO) geo.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
  if (!geo.attributes.aInner) geo.setAttribute('aInner', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
};

// Intenta cargar /models/conch.glb. Comprueba la firma binaria "glTF" antes de
// importar el cargador (así no pesa nada si el archivo no existe).
const tryLoadGLB = async () => {
  try {
    const res = await fetch(CONFIG.model, { cache: 'force-cache' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const magic = new Uint32Array(buf, 0, 1)[0];
    if (buf.byteLength < 20 || magic !== 0x46546c67) return null;
    const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] = await Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/DRACOLoader.js'),
      import('three/examples/jsm/libs/meshopt_decoder.module.js'),
    ]);
    const loader = new GLTFLoader();
    // los decodificadores Draco vienen incluidos en el build (sin CDN externo)
    loader.setDRACOLoader(new DRACOLoader());
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.parseAsync(buf, '/models/');
    return gltf.scene;
  } catch (err) {
    console.warn('[casa-caracol] conch.glb no válido, uso la concha procedural', err);
    return null;
  }
};

// Normaliza el modelo externo: ápice a ~1,06, base ligeramente enterrada, centrado en el eje.
const normalizeExternal = (root) => {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = 1.16 / Math.max(size.y, 1e-6);
  root.position.set(-center.x * s, -box.min.y * s - 0.1, -center.z * s);
  root.scale.setScalar(s);
  const material = createShellMaterial(false);
  root.traverse((o) => {
    if (o.isMesh) {
      ensureAttributes(o.geometry);
      o.material = material;
    }
  });
  return { material };
};

// Devuelve un grupo "shell" (el transform del match cut se aplica a este grupo).
export const createShell = async () => {
  const group = new THREE.Group();
  group.name = 'shell';
  const external = await tryLoadGLB();
  if (external) {
    const { material } = normalizeExternal(external);
    group.add(external);
    group.userData = { source: 'glb', material };
    return group;
  }
  const material = createShellMaterial(true);
  const mesh = new THREE.Mesh(buildConchGeometry(), material);
  mesh.name = 'conch-procedural';
  const lip = new THREE.Mesh(buildLipGeometry(), material);
  lip.name = 'conch-lip';
  group.add(mesh, lip);
  group.userData = { source: 'procedural', material };
  return group;
};
