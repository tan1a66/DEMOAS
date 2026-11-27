// Plantas tropicales (palma areca, monstera, heliconia, helecho) como hojas instanciadas que
// se mecen despacio. Pensadas para verse desde arriba (dron) y desde el borde de la piscina.
import * as THREE from 'three';
import { patch, QUALITY } from './core.js';
import { makeLeafAtlas } from './textures.js';

// tipo: [tile, largo, ancho, elevación min/max (rad), altura base min/max, caída]
const TYPES = {
  palm: { tile: 0, L: [1.25, 1.9], W: 0.95, el: [0.35, 0.95], y: [0.6, 1.6], droop: 0.32, n: [10, 15], spread: 0.12 },
  monstera: { tile: 1, L: [0.5, 0.75], W: 0.95, el: [0.15, 0.55], y: [0.25, 0.8], droop: 0.08, n: [6, 10], spread: 0.35 },
  broad: { tile: 2, L: [0.9, 1.35], W: 0.5, el: [0.75, 1.2], y: [0.1, 0.4], droop: 0.25, n: [5, 8], spread: 0.15 },
  fern: { tile: 3, L: [0.55, 0.9], W: 0.6, el: [0.1, 0.45], y: [0.02, 0.15], droop: 0.18, n: [9, 14], spread: 0.05 },
  bigpalm: { tile: 0, L: [2.2, 3.0], W: 0.9, el: [0.05, 0.45], y: [4.6, 6.2], droop: 0.5, n: [11, 15], spread: 0.1 },
};

function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Plantas del patio según skoura_fosa_cenital.jpg (arriates junto a los muros) y vecinos.
function layout() {
  const P = [];
  const R = rnd(4);
  const put = (type, x, z, s = 1) => P.push({ type, x, z, s });
  // noroeste
  put('monstera', -2.05, -3.0); put('monstera', -1.75, -2.45, 0.9); put('palm', -2.1, -4.1); put('fern', -1.6, -3.45);
  put('broad', -2.2, -2.0, 0.9); put('fern', -2.25, -3.6, 0.8);
  // noreste
  put('palm', 1.95, -3.7, 1.1); put('palm', 2.15, -2.8); put('fern', 1.45, -3.25); put('broad', 2.2, -4.35);
  put('monstera', 1.65, -2.35, 0.8);
  // franja este
  for (let z = -1.7; z < 1.9; z += 0.75) put(R() < 0.5 ? 'fern' : 'monstera', 2.2 + R() * 0.1, z + R() * 0.3, 0.8 + R() * 0.3);
  put('palm', 2.2, 0.2, 0.9);
  // suroeste
  put('monstera', -2.05, 0.1); put('broad', -2.2, 0.9); put('monstera', -1.8, -0.55, 0.85); put('palm', -2.15, 1.7);
  put('fern', -1.65, 0.65, 0.9);
  // sureste
  put('palm', 2.0, 1.4); put('fern', 1.6, 1.9);
  // camino de entrada: arriates a ambos lados
  for (let z = 2.6; z < 13; z += 1.1) {
    put(['fern', 'monstera', 'broad', 'palm'][Math.floor(R() * 4)], -2.05 - R() * 0.2, z + R() * 0.4, 0.8 + R() * 0.4);
    put(['fern', 'monstera', 'broad', 'palm'][Math.floor(R() * 4)], 2.05 + R() * 0.2, z + R() * 0.4, 0.8 + R() * 0.4);
  }
  // vecinos: palmas altas y fronda
  const n = Math.round(70 * QUALITY.leaves);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (3.6 + R() * 7.5);
    const z = -12 + R() * 24;
    const roofs = [[-6.2, -8.5, 6, 11], [6.4, 7.5, 6.5, 12], [-6.6, 6.5, 6, 9], [6.8, -9.0, 6.5, 8]];
    const onRoof = roofs.some(([rx, rz, w, d]) => Math.abs(x - rx) < w / 2 && Math.abs(z - rz) < d / 2);
    const big = onRoof || R() < 0.4;
    put(big ? 'bigpalm' : ['monstera', 'broad', 'palm', 'palm'][Math.floor(R() * 4)], x, z, big ? 0.75 + R() * 0.3 : 1.2 + R() * 0.7);
  }
  return P;
}

export function buildPlants(parent) {
  const atlas = makeLeafAtlas();
  const plants = layout();
  const R = rnd(21);
  const leaves = [];
  for (const p of plants) {
    const T = TYPES[p.type];
    const n = Math.round(T.n[0] + R() * (T.n[1] - T.n[0]));
    const y0 = T.y[0] + R() * (T.y[1] - T.y[0]);
    const rot = R() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const L = (T.L[0] + R() * (T.L[1] - T.L[0])) * p.s;
      const yaw = rot + (i / n) * Math.PI * 2 + (R() - 0.5) * 0.5;
      const el = T.el[0] + R() * (T.el[1] - T.el[0]);
      const off = T.spread * p.s * (0.3 + R());
      leaves.push({
        tile: T.tile, L, W: L * T.W * (0.85 + R() * 0.3), yaw, el,
        x: p.x - Math.sin(yaw) * off, z: p.z - Math.cos(yaw) * off, y: y0 * (0.8 + R() * 0.4) * (p.type === 'bigpalm' ? 1 : p.s),
        droop: T.droop * (0.7 + R() * 0.6), phase: R(),
        tint: 0.75 + R() * 0.45,
      });
    }
  }

  const geo = new THREE.PlaneGeometry(1, 1, 1, 6);
  geo.translate(0, 0.5, 0);
  const count = leaves.length;
  const aTile = new Float32Array(count), aPhase = new Float32Array(count), aDroop = new Float32Array(count);
  const mat = new THREE.MeshStandardMaterial({
    map: atlas, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.62, metalness: 0, envMapIntensity: 0.5,
  });
  mat.alphaToCoverage = true;
  const vertHead = /* glsl */ `
    attribute float aTile; attribute float aPhase; attribute float aDroop;
  `;
  const bend = /* glsl */ `
    float yy = transformed.y;
    transformed.z -= aDroop * yy * yy;
    float sw = sin(uTime * (0.55 + aPhase * 0.35) + aPhase * 6.283) * 0.035 + sin(uTime * 1.3 + aPhase * 17.0) * 0.012;
    transformed.x += sw * yy * 1.4;
    transformed.z += sw * yy * 0.6;
  `;
  const uvFix = /* glsl */ `
    #ifdef USE_MAP
      vMapUv = uv * 0.5 + vec2(mod(aTile, 2.0) * 0.5, (1.0 - floor(aTile / 2.0)) * 0.5);
    #endif
  `;
  patch(mat, {
    key: 'leaves', gobo: true, reveal: true, vertHead, vertBegin: bend,
    onShader: (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n' + uvFix); },
    fragNormal: /* glsl */ `
      // translucidez: el sol atraviesa un poco la hoja
      diffuseColor.rgb *= 1.0 + 0.25 * max(0.0, -dot(normal, (viewMatrix * vec4(uSunDir, 0.0)).xyz));
    `,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), po = new THREE.Vector3();
  const col = new THREE.Color();
  leaves.forEach((l, i) => {
    e.set(-Math.PI / 2 + l.el, l.yaw, 0, 'YXZ');
    q.setFromEuler(e);
    sc.set(l.W, l.L, 1);
    po.set(l.x, l.y, l.z);
    m4.compose(po, q, sc);
    mesh.setMatrixAt(i, m4);
    col.setRGB(l.tint * 0.95, l.tint, l.tint * 0.9);
    mesh.setColorAt(i, col);
    aTile[i] = l.tile; aPhase[i] = l.phase; aDroop[i] = l.droop;
  });
  geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(aTile, 1));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
  geo.setAttribute('aDroop', new THREE.InstancedBufferAttribute(aDroop, 1));

  // sombras con el mismo recorte de la hoja
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: 0.45 });
  depth.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\n' + vertHead)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + bend)
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n' + uvFix);
  };
  depth.customProgramCacheKey = () => 'leafDepth';
  mesh.customDepthMaterial = depth;
  mesh.name = 'plantas';
  parent.add(mesh);
  return { mesh, count };
}
