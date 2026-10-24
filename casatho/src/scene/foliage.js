// Primer plano de la intro: ramitas de almendro con hojas modeladas una por una
// (forma obovada, plegadas en la nervadura, ligeramente cóncavas), brillo ceroso y
// un desenfoque de primer plano que depende de la distancia a la cámara.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, leafAtlasTexture } from './textures.js';

const PI = Math.PI;

// Hoja: tira de L x 0.52L; el contorno real lo da la transparencia de la textura.
function leafGeometry(L, cell, blur, r) {
  const g = new THREE.PlaneGeometry(1, 1, 6, 14);
  const pos = g.attributes.position, uv = g.attributes.uv;
  const fold = 0.16 + r() * 0.1, cup = 0.05 + r() * 0.05, bend = (r() - 0.35) * 0.22, twist = (r() - 0.5) * 0.25;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);            // -0.5..0.5
    const v = pos.getY(i) + 0.5;      // 0 base .. 1 punta
    const x = u * 0.52 * L, y = v * L;
    const ax = Math.abs(u) * 2;       // 0 nervadura .. 1 borde
    const z = fold * ax * 0.26 * L - cup * ax * ax * 0.26 * L + bend * v * v * L + twist * u * v * L;
    pos.setXYZ(i, x, y, z);
    uv.setXY(i, (cell + (u + 0.5)) / 4, v);
  }
  g.computeVertexNormals();
  const n = pos.count;
  g.setAttribute('aBlur', new THREE.Float32BufferAttribute(new Float32Array(n).fill(blur), 1));
  return g;
}

function leafMaterial(map, envMap) {
  const m = new THREE.MeshStandardMaterial({
    map, side: THREE.DoubleSide, roughness: 0.42, metalness: 0,
    alphaTest: 0.45, envMapIntensity: 0.9,
    emissive: new THREE.Color('#1c2a0e'), emissiveIntensity: 0.35,
  });
  if (envMap) m.envMap = envMap;
  m.alphaToCoverage = true;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBlur;\nvarying float vBlur;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvBlur = aBlur;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBlur;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv, vBlur );
          diffuseColor *= sampledDiffuseColor;
        #endif`);
  };
  m.customProgramCacheKey = () => 'leafAtlas';
  return m;
}

// Una ramita que entra desde fuera del cuadro y termina en una roseta de hojas.
function twig(points, leaves, r, cellBias) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const wood = new THREE.TubeGeometry(curve, 16, 0.013, 6, false);
  const tip = curve.getPoint(1);
  const tan = curve.getTangent(1);
  const parts = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < leaves; i++) {
    const L = 0.24 + r() * 0.12;
    const cell = r() < 0.12 ? 3 : r() < 0.5 ? cellBias : (r() * 3) | 0;
    const a = (i / leaves) * PI * 2 + r() * 0.4;
    // la hoja sale de la punta, girando alrededor de la ramita, abierta hacia afuera
    const out = new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.85, 0.25 * (r() - 0.5)).normalize();
    out.addScaledVector(tan, 0.35).normalize();
    const base = tip.clone().addScaledVector(out, 0.035);
    const dist = Math.abs(base.z); // la cámara de la intro está en el origen del grupo
    const blur = Math.max(0, Math.min(2.6, (1.55 - dist) * 2.4));
    const g = leafGeometry(L, cell, blur, r);
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out);
    // girar la hoja sobre su eje para que muestre la cara a la cámara (con variación)
    const n0 = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const t = new THREE.Vector3(0, 0, 1).addScaledVector(out, -out.z).normalize();
    let ang = Math.atan2(new THREE.Vector3().crossVectors(n0, t).dot(out), n0.dot(t));
    ang += (r() - 0.5) * 1.1;
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(out, ang));
    m.compose(base, q, new THREE.Vector3(1, 1, 1));
    parts.push(g.applyMatrix4(m));
  }
  return { wood, leaves: mergeGeometries(parts), pivot: new THREE.Vector3(...points[0]) };
}

// Grupo colocado en la posición inicial de la cámara de la intro (mira hacia -z).
export function buildCurtain(envMap) {
  const r = rng(58);
  const tex = leafAtlasTexture();
  const mat = leafMaterial(tex, envMap);
  const bark = new THREE.MeshLambertMaterial({ color: '#6d6155' });
  const group = new THREE.Group();
  const specs = [
    // [puntos de la ramita (desde fuera del cuadro hacia adentro), hojas, celda preferida, lado]
    [[[-1.6, 1.5, -1.9], [-0.9, 0.95, -1.55], [-0.32, 0.42, -1.3]], 9, 0, -1],
    [[[1.7, 1.4, -2.1], [0.95, 0.85, -1.75], [0.3, 0.28, -1.5]], 9, 1, 1],
    [[[1.6, -0.6, -1.25], [0.85, -0.3, -1.1], [0.36, -0.2, -1.0]], 7, 2, 1],
    [[[-1.7, -0.9, -1.45], [-0.95, -0.5, -1.25], [-0.34, -0.36, -1.12]], 7, 1, -1],
    [[[0.25, 1.9, -2.7], [0.1, 1.2, -2.45], [0.02, 0.52, -2.3]], 7, 0, 1],
    [[[-1.4, 0.2, -2.5], [-0.75, 0.15, -2.3], [-0.12, -0.02, -2.15]], 6, 2, -1],
    [[[1.5, 0.45, -1.15], [0.9, 0.3, -0.98], [0.44, 0.08, -0.9]], 6, 3, 1],
  ];
  const twigs = specs.map(([pts, n, cell, side], i) => {
    const t = twig(pts, n, r, cell);
    const pivot = new THREE.Group();
    pivot.position.copy(t.pivot);
    const wood = new THREE.Mesh(t.wood.translate(-t.pivot.x, -t.pivot.y, -t.pivot.z), bark);
    const leaves = new THREE.Mesh(t.leaves.translate(-t.pivot.x, -t.pivot.y, -t.pivot.z), mat);
    leaves.renderOrder = 5;
    pivot.add(wood, leaves);
    pivot.userData = { side, phase: i * 1.7, open: 0 };
    group.add(pivot);
    return pivot;
  });
  group.visible = false;
  return {
    group, twigs,
    // vaivén con viento + apertura (0 cerrado → 1 fuera de cuadro)
    update(time, open) {
      for (const p of twigs) {
        const { side, phase } = p.userData;
        const w = Math.sin(time * 1.3 + phase) * 0.035 + Math.sin(time * 2.1 + phase * 0.7) * 0.015;
        const o = open * open * (3 - 2 * open);
        p.rotation.set(w * 0.6 - o * 0.35, side * o * 0.25, w - side * o * 0.95);
      }
    },
    dispose() {
      if (!group.parent) return;
      group.visible = false;
      tex.dispose(); mat.dispose(); bark.dispose();
      group.traverse((o) => o.geometry && o.geometry.dispose());
      group.removeFromParent();
    },
  };
}
