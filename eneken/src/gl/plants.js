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
  tree: { tile: 2, L: [0.5, 0.8], W: 0.55, el: [-0.6, 1.2], y: [0, 0], droop: 0.1, n: [0, 0], spread: 0 },
};
// pliegue en V de cada hoja (los folíolos suben desde el nervio) y tallos
const FOLD = { palm: 0.42, bigpalm: 0.35, monstera: 0.12, broad: 0.18, fern: 0.3, tree: 0.1 };
const STEM = { palm: 0.018, bigpalm: 0, monstera: 0.011, broad: 0.012, fern: 0, tree: 0 };

function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Plantas del patio según skoura_fosa_cenital.jpg (arriates junto a los muros) y vecinos.
function layout() {
  const P = [];
  // dentro del lote las plantas son modelos reales (plants3d.js); aquí sólo las copas de los árboles
  // árboles grandes detrás de la casa (en el video asoman por encima de la cubierta)
  for (const [x, z, h, r] of [[-3.6, -16.5, 8.6, 3.4], [4.2, -15.5, 9.4, 3.8], [0.8, -21, 10.5, 4.2], [-6.5, -11, 7.5, 3.0], [7.0, -9.5, 8.0, 3.2], [-0.6, 12.5, 10.5, 5.2], [4.5, 9.0, 8.5, 3.4]]) {
    P.push({ type: 'tree', x, z, s: 1, h, r });
  }
  return P;
}

export function buildPlants(parent) {
  const atlas = makeLeafAtlas();
  const plants = layout();
  const R = rnd(21);
  const leaves = [];
  const stems = [];
  const trunks = [];
  for (const p of plants) {
    const T = TYPES[p.type];
    if (p.type === 'tree') {
      // copa: hojas sobre un volumen esférico achatado, con tronco
      trunks.push({ x: p.x, z: p.z, h: p.h - p.r * 0.6, r: 0.16 + p.r * 0.03 });
      const n = Math.round(520 * QUALITY.leaves);
      for (let i = 0; i < n; i++) {
        const u = R() * 2 - 1, a = R() * Math.PI * 2, rr = Math.cbrt(R()) * 0.35 + 0.65;
        const sx = Math.sqrt(1 - u * u) * Math.cos(a), sz = Math.sqrt(1 - u * u) * Math.sin(a);
        const L = (T.L[0] + R() * (T.L[1] - T.L[0]));
        leaves.push({
          tile: T.tile, kind: 'tree', L, W: L * T.W, yaw: Math.atan2(-sx, -sz) + (R() - 0.5) * 0.8, el: u * 0.9 + (R() - 0.5) * 0.6,
          x: p.x + sx * p.r * rr, z: p.z + sz * p.r * rr, y: p.h + u * p.r * 0.72 * rr,
          droop: 0.1, phase: R(), tint: 0.62 + R() * 0.35,
        });
      }
      continue;
    }
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
        tint: 0.75 + R() * 0.45, kind: p.type,
      });
      // tallo desde el suelo hasta la base de la hoja
      const sr = STEM[p.type] * p.s;
      const lf = leaves[leaves.length - 1];
      if (sr > 0 && lf.y > 0.12) stems.push({ x0: p.x + (R() - 0.5) * 0.08, z0: p.z + (R() - 0.5) * 0.08, x1: lf.x, y1: lf.y, z1: lf.z, r: sr });
    }
  }

  const geo = new THREE.PlaneGeometry(1, 1, 2, 8);
  geo.translate(0, 0.5, 0);
  const count = leaves.length;
  const aTile = new Float32Array(count), aPhase = new Float32Array(count), aDroop = new Float32Array(count), aFold = new Float32Array(count);
  const mat = new THREE.MeshStandardMaterial({
    map: atlas, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.62, metalness: 0, envMapIntensity: 0.5,
  });
  mat.alphaToCoverage = true;
  const vertHead = /* glsl */ `
    attribute float aTile; attribute float aPhase; attribute float aDroop; attribute float aFold;
  `;
  const bend = /* glsl */ `
    float yy = transformed.y;
    transformed.z += abs(transformed.x) * aFold * (1.0 - yy * 0.5);
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
    aTile[i] = l.tile; aPhase[i] = l.phase; aDroop[i] = l.droop; aFold[i] = FOLD[l.kind] ?? 0.2;
  });
  geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(aTile, 1));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
  geo.setAttribute('aDroop', new THREE.InstancedBufferAttribute(aDroop, 1));
  geo.setAttribute('aFold', new THREE.InstancedBufferAttribute(aFold, 1));

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

  // tallos (palmas areca, monsteras) y troncos de los árboles
  const stemMat = patch(new THREE.MeshStandardMaterial({ color: new THREE.Color('#6f7432'), roughness: 0.7 }), { key: 'stems', gobo: true, reveal: true });
  const trunkMat = patch(new THREE.MeshStandardMaterial({ color: new THREE.Color('#6b5a4a'), roughness: 0.95 }), { key: 'trunks', gobo: true, reveal: true, mottle: 0.4 });
  const cyl = new THREE.CylinderGeometry(0.7, 1, 1, 6, 1, true).translate(0, 0.5, 0);
  const all = [...stems.map((s) => ({ ...s, mat: 0 })), ...trunks.map((t) => ({ x0: t.x, z0: t.z, x1: t.x + 0.3, y1: t.h, z1: t.z - 0.2, r: t.r, mat: 1 }))];
  for (const [mi, mat] of [[0, stemMat], [1, trunkMat]]) {
    const list = all.filter((s) => s.mat === mi);
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(cyl, mat, list.length);
    const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
    list.forEach((s, i) => {
      dir.set(s.x1 - s.x0, s.y1, s.z1 - s.z0);
      const len = dir.length();
      q.setFromUnitVectors(up, dir.normalize());
      m4.compose(po.set(s.x0, 0, s.z0), q, sc.set(s.r, len, s.r));
      im.setMatrixAt(i, m4);
    });
    im.castShadow = true; im.receiveShadow = true;
    parent.add(im);
  }
  return { mesh, count };
}
