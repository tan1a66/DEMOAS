// Primer plano de la intro: hojas de palma (areca) modeladas en geometría, foliolo por
// foliolo (plegados en V sobre la nervadura, caídos por su peso, puntas secas ocasionales).
// Se dibujan en una capa aparte que World desenfoca como una lente real enfocada en la casa.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './textures.js';

export const CURTAIN_LAYER = 1;

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const GREENS = [
  [0.16, 0.30, 0.09], [0.20, 0.36, 0.11], [0.13, 0.26, 0.08], [0.25, 0.40, 0.12], [0.18, 0.33, 0.10],
].map((c) => new THREE.Color().setRGB(...c, THREE.SRGBColorSpace));
const BASE_TINT = new THREE.Color().setRGB(0.42, 0.50, 0.18, THREE.SRGBColorSpace);
const DRY = new THREE.Color().setRGB(0.55, 0.44, 0.26, THREE.SRGBColorSpace);
const RIB = new THREE.Color().setRGB(0.55, 0.60, 0.30, THREE.SRGBColorSpace);

// Un foliolo: tira con nervadura central levantada (V), ancho máximo cerca del primer tercio,
// punta aguda, curvado hacia abajo por gravedad y con un leve giro.
function leaflet(base, dir, normal, L, W, r, out) {
  const SEG = 12;
  const side = new THREE.Vector3().crossVectors(dir, normal).normalize();
  const droop = 0.28 + r() * 0.3, twist = (r() - 0.5) * 0.6, fold = 0.35 + r() * 0.25;
  const green = GREENS[(r() * GREENS.length) | 0].clone().offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.08, (r() - 0.5) * 0.05);
  const dry = r() < 0.18 ? 0.78 + r() * 0.12 : 2;
  const pos = [], col = [], uv = [], idx = [];
  const c = new THREE.Color();
  for (let i = 0; i <= SEG; i++) {
    const s = i / SEG;
    const w = W * Math.pow(Math.sin(PI * Math.min(1, 0.12 + s * 0.95)), 0.7) * (1 - 0.15 * s);
    const sag = droop * s * s * L;
    const a = twist * s;
    const sx = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(normal, Math.sin(a));
    const nx = normal.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, -Math.sin(a));
    const center = base.clone().addScaledVector(dir, s * L * (1 - 0.12 * s)).addScaledVector(normal, -sag);
    for (let j = -1; j <= 1; j++) {
      const p = center.clone().addScaledVector(sx, j * w).addScaledVector(nx, (1 - Math.abs(j)) * fold * w);
      pos.push(p.x, p.y, p.z);
      c.copy(green).lerp(BASE_TINT, Math.max(0, 0.35 - s) * 1.2);
      if (j === 0) c.lerp(RIB, 0.18);
      if (s > dry) c.lerp(DRY, Math.min(1, (s - dry) / 0.06));
      col.push(c.r, c.g, c.b);
      uv.push(j, s);
    }
  }
  for (let i = 0; i < SEG; i++) {
    const a = i * 3;
    idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  out.push(g);
}

// Una hoja de palma que entra desde fuera del cuadro: raquis curvo con foliolos a ambos lados.
function frond(points, r, { pairs = 30, size = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => V(...p)));
  const rachis = new THREE.TubeGeometry(curve, 24, 0.012 * size, 6, false);
  // radio decreciente hacia la punta
  const rp = rachis.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const t = Math.floor(i / 7) / 24;
    const c = curve.getPoint(t);
    const p = V(rp.getX(i), rp.getY(i), rp.getZ(i)).sub(c).multiplyScalar(1.4 - t * 1.1).add(c);
    rp.setXYZ(i, p.x, p.y, p.z);
  }
  rachis.computeVertexNormals();
  const leaves = [];
  // "dorso" de la hoja: mira hacia la cámara (+z) y hacia arriba
  const up = V(0, 0.55, 1).normalize();
  for (let k = 0; k < pairs; k++) {
    const t = 0.06 + (k / (pairs - 1)) * 0.92;
    const p = curve.getPoint(t);
    const T = curve.getTangent(t);
    const N = up.clone().addScaledVector(T, -up.dot(T)).normalize();
    const S = new THREE.Vector3().crossVectors(T, N).normalize();
    const L = size * (0.32 + 0.34 * Math.sin(PI * (0.2 + 0.8 * t))) * (0.9 + r() * 0.2) * (1 - 0.45 * t * t);
    const W = L * (0.065 + r() * 0.015);
    for (const sd of [-1, 1]) {
      const ang = (0.62 - 0.28 * t + (r() - 0.5) * 0.12) * PI * 0.5;
      const D = T.clone().multiplyScalar(Math.cos(ang)).addScaledVector(S, sd * Math.sin(ang)).addScaledVector(N, -0.32 - r() * 0.12).normalize();
      const n = N.clone().addScaledVector(D, -N.dot(D)).normalize();
      const b = p.clone().addScaledVector(S, sd * 0.008 * size).addScaledVector(T, (r() - 0.5) * 0.012);
      leaflet(b, D, n, L, W, r, leaves);
    }
  }
  return { rachis, leaves: mergeGeometries(leaves), pivot: V(...points[0]) };
}

function frondMaterial(envMap) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.38, metalness: 0,
    envMapIntensity: 0.7,
  });
  if (envMap) m.envMap = envMap;
  // luz que atraviesa la hoja a contraluz + nervaduras paralelas muy finas
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLeafUv;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float vein = 0.5 + 0.5 * sin(vLeafUv.x * 46.0);
        diffuseColor.rgb *= 0.94 + 0.08 * vein;
        diffuseColor.rgb *= 1.0 - 0.18 * smoothstep(0.7, 1.0, abs(vLeafUv.x));`)
      .replace('#include <opaque_fragment>', `
        vec3 transLight = diffuseColor.rgb * vec3(1.05, 1.15, 0.55) * 0.55 * (gl_FrontFacing ? 0.35 : 1.0);
        outgoingLight += transLight;
        #include <opaque_fragment>`);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLeafUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvLeafUv = uv;');
  };
  m.customProgramCacheKey = () => 'palmFrond';
  return m;
}

// Grupo colocado en la posición inicial de la cámara de la intro (mira hacia -z).
export function buildCurtain(envMap) {
  const r = rng(58);
  const mat = frondMaterial(envMap);
  const stem = new THREE.MeshStandardMaterial({ color: '#7d8a4a', roughness: 0.6 });
  const group = new THREE.Group();
  const specs = [
    // [raquis (desde fuera del cuadro hacia adentro), opciones, lado]
    [[[-1.9, 1.7, -2.2], [-1.05, 1.05, -1.85], [-0.25, 0.42, -1.6], [0.35, 0.05, -1.5]], { pairs: 32, size: 1.15 }, -1],
    [[[2.0, 1.5, -2.3], [1.1, 1.0, -1.95], [0.35, 0.55, -1.75], [-0.25, 0.3, -1.7]], { pairs: 32, size: 1.1 }, 1],
    [[[1.9, -1.2, -1.5], [1.0, -0.55, -1.3], [0.3, -0.15, -1.2], [-0.15, 0.1, -1.15]], { pairs: 28, size: 0.95 }, 1],
    [[[-2.0, -1.0, -1.6], [-1.1, -0.45, -1.4], [-0.35, -0.12, -1.3], [0.1, 0.05, -1.25]], { pairs: 28, size: 0.95 }, -1],
    [[[0.6, 2.3, -2.9], [0.25, 1.5, -2.65], [0.0, 0.8, -2.5], [-0.1, 0.35, -2.45]], { pairs: 26, size: 1.05 }, 1],
    [[[-1.8, 0.3, -1.05], [-1.1, 0.25, -0.95], [-0.55, 0.05, -0.9]], { pairs: 22, size: 0.8 }, -1],
    [[[1.8, 0.6, -1.0], [1.15, 0.45, -0.92], [0.6, 0.2, -0.88]], { pairs: 22, size: 0.8 }, 1],
  ];
  const twigs = specs.map(([pts, opts, side], i) => {
    const f = frond(pts, r, opts);
    const pivot = new THREE.Group();
    pivot.position.copy(f.pivot);
    const rachis = new THREE.Mesh(f.rachis.translate(-f.pivot.x, -f.pivot.y, -f.pivot.z), stem);
    const leaves = new THREE.Mesh(f.leaves.translate(-f.pivot.x, -f.pivot.y, -f.pivot.z), mat);
    for (const m of [rachis, leaves]) { m.layers.set(CURTAIN_LAYER); m.frustumCulled = false; }
    pivot.add(rachis, leaves);
    pivot.userData = { side, phase: i * 1.7 };
    group.add(pivot);
    return pivot;
  });
  group.visible = false;
  const api = {
    group, twigs,
    blur: 0,
    // vaivén con brisa + apertura (0 cerrado → 1 fuera de cuadro)
    update(time, open) {
      for (const p of twigs) {
        const { side, phase } = p.userData;
        const w = Math.sin(time * 1.1 + phase) * 0.03 + Math.sin(time * 2.3 + phase * 0.7) * 0.012;
        const o = open * open * (3 - 2 * open);
        p.rotation.set(w * 0.5 - o * 0.4, side * o * 0.3, w - side * o * 1.0);
      }
      // la lente está enfocada en la casa: las hojas cercanas se ven desenfocadas,
      // y más aún al pasar junto a la cámara
      api.blur = 0.7 + 3.0 * Math.min(1, open * 1.3);
    },
    dispose() {
      if (!group.parent) return;
      group.visible = false;
      mat.dispose(); stem.dispose();
      group.traverse((o) => o.geometry && o.geometry.dispose());
      group.removeFromParent();
    },
  };
  return api;
}
