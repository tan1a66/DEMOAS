// Pini low-poly (chioma irregolare tipo pino d'Aleppo) con InstancedMesh:
// solo sui pendii medi, lontano dalla strada, a gruppi. Un'unica draw call.
import {
  InstancedMesh, IcosahedronGeometry, CylinderGeometry, ShaderMaterial, Color, Matrix4, Quaternion,
  Vector3, Euler, BufferAttribute,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { BAKE_GLSL, LIGHT_GLSL, FOG_GLSL } from '../glsl/chunks.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// rumore a valori (per i gruppi di alberi)
function vnoise(x, z) {
  const h = (i, j) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = h(i, j) + (h(i + 1, j) - h(i, j)) * ux;
  const b = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * ux;
  return a + (b - a) * uz;
}

function pineGeometry() {
  const crown = new IcosahedronGeometry(1, 0);
  crown.deleteAttribute('normal');
  crown.deleteAttribute('uv');
  const c = mergeVertices(crown);
  c.scale(0.5, 0.3, 0.5);
  c.translate(0, 0.7, 0);
  const trunk = new CylinderGeometry(0.035, 0.05, 0.6, 3, 1, true);
  trunk.deleteAttribute('uv');
  trunk.deleteAttribute('normal');
  const t = mergeVertices(trunk);
  t.translate(0, 0.3, 0);
  const g = mergeGeometries([c, t]);
  g.computeVertexNormals();
  // 1 = chioma, 0 = tronco
  const part = new Float32Array(g.attributes.position.count);
  for (let i = 0; i < part.length; i++) part[i] = g.attributes.position.getY(i) > 0.45 ? 1 : 0;
  g.setAttribute('aPart', new BufferAttribute(part, 1));
  return g;
}

const vert = /* glsl */ `
  ${BAKE_GLSL}
  attribute float aPart;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vVis;
  varying float vPart;
  varying float vSeed;
  varying float vH;
  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vec3 o = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec4 bk = sampleBake(o.xz);
    vVis = bk.b;
    vPart = aPart;
    vH = position.y;
    vSeed = fract(sin(dot(o.xz, vec2(12.9898, 78.233))) * 43758.5453);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */ `
  ${LIGHT_GLSL}
  ${FOG_GLSL}
  uniform vec3 uLeaf, uTrunk;
  uniform float uVar;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vVis;
  varying float vPart;
  varying float vSeed;
  varying float vH;
  void main() {
    vec3 leaf = uLeaf * (1.0 - uVar + 2.0 * uVar * vSeed);
    leaf = mix(leaf, leaf * vec3(1.15, 1.05, 0.8), step(0.8, vSeed));   // qualche chioma più secca
    vec3 albedo = mix(uTrunk, leaf, vPart);
    vec3 n = normalize(vN);
    // luce "avvolgente": le chiome non hanno spigoli netti
    float ndl = clamp(dot(n, uSunDir) * 0.6 + 0.4, 0.0, 1.0);
    float ao = mix(0.55, 1.0, smoothstep(0.45, 0.95, vH));
    vec3 amb = mix(uAmbGround, uAmbSky, n.y * 0.5 + 0.5) * ao;
    vec3 col = albedo * (uSunColor * ndl * vVis * 0.9 + amb * 1.25);
    gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
  }
`;

export function createTrees(hf, road, shared, rects, bakeTex) {
  const c = CONFIG.trees;
  const rand = mulberry32(20261028);
  const items = [];
  const near = {};
  const { hi, base } = hf;
  const maxTries = c.count * 60;
  for (let tries = 0; items.length < c.count && tries < maxTries; tries++) {
    const L = rand() < 0.72 ? hi : base;
    const x = L.xMin + rand() * (L.xMax - L.xMin);
    const z = L.zMin + rand() * (L.zMax - L.zMin);
    const h = hf.height(x, z);
    if (h < c.height[0] || h > c.height[1]) continue;
    const s = hf.slope(x, z, 5);
    if (s < c.slope[0] || s > c.slope[1]) continue;
    // a gruppi: rumore a ~70 m, più rado in quota
    const clump = vnoise(x / 70, z / 70) * 0.7 + vnoise(x / 23, z / 23) * 0.3;
    if (clump < 0.45 + (h / c.height[1]) * 0.2) continue;
    if (road.nearest(x, z, c.minRoadDistance, false, near)) continue;
    items.push([x, h, z, rand(), rand(), rand()]);
  }

  const geo = pineGeometry();
  const mat = new ShaderMaterial({
    uniforms: {
      ...shared, ...rects,
      tBakeHi: { value: bakeTex.hi }, tBakeBase: { value: bakeTex.base }, tBakeFar: { value: bakeTex.far },
      uLeaf: { value: new Color(c.color) },
      uTrunk: { value: new Color('#4a3b2c') },
      uVar: { value: c.colorVar },
    },
    vertexShader: vert,
    fragmentShader: frag,
  });
  const mesh = new InstancedMesh(geo, mat, items.length);
  const m = new Matrix4(), q = new Quaternion(), e = new Euler(), p = new Vector3(), sc = new Vector3();
  items.forEach(([x, y, z, r1, r2, r3], k) => {
    const H = c.size[0] + (c.size[1] - c.size[0]) * r1 * r1;
    const w = H * (0.8 + 0.6 * r2);
    q.setFromEuler(e.set((r3 - 0.5) * 0.12, r3 * Math.PI * 2, 0));
    mesh.setMatrixAt(k, m.compose(p.set(x, y - 0.4, z), q, sc.set(w, H, w * (0.85 + 0.3 * r3))));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return { mesh, count: items.length, trisPerTree: geo.index.count / 3 };
}
