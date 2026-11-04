// La strada: nastro d'asfalto con mezzeria tratteggiata, muretti in pietra a valle
// (InstancedMesh), parapetti e impalcato dei ponti, e la linea arancione del percorso.
import {
  BufferGeometry, BufferAttribute, Mesh, ShaderMaterial, Color, InstancedMesh, BoxGeometry,
  Matrix4, Quaternion, Vector3, Vector2, Euler, Group, AdditiveBlending,
} from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { CONFIG } from '../config.js';
import { BAKE_GLSL, NOISE_GLSL, LIGHT_GLSL, FOG_GLSL } from '../glsl/chunks.js';
import { KIND } from './roadPath.js';

// ── nastro d'asfalto ──────────────────────────────────────────────────────────
function ribbonGeometry(road, halfWidth, lift) {
  const n = road.count;
  const pos = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  for (let i = 0; i < n; i++) {
    const nx = -road.tan[i * 2 + 1], nz = road.tan[i * 2];
    const x = road.x(i), y = road.y(i) + lift, z = road.z(i);
    for (let s = 0; s < 2; s++) {
      const k = i * 2 + s, sg = s === 0 ? -1 : 1;
      pos[k * 3] = x + nx * halfWidth * sg;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = z + nz * halfWidth * sg;
      uv[k * 2] = sg;
      uv[k * 2 + 1] = i * road.step;
    }
  }
  const idx = new Uint32Array((n - 1) * 6);
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.set([a, c, b, b, c, d], i * 6);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

const roadVert = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const roadFrag = /* glsl */ `
  ${BAKE_GLSL}
  ${NOISE_GLSL}
  ${LIGHT_GLSL}
  ${FOG_GLSL}
  uniform vec3 uAsphalt, uLine;
  uniform vec2 uDash;
  uniform float uHalfWidth;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vec4 bk = sampleBake(vWorld.xz);
    float across = vUv.x * uHalfWidth;             // metri dal centro
    float along = vUv.y;
    float mpp = fwidth(across);

    // asfalto: grana fine, tracce più scure delle ruote, bordi consumati
    float grain = mix(0.5, vnoise(vWorld.xz * 2.3), 1.0 - smoothstep(0.05, 0.3, mpp));
    vec3 col = uAsphalt * (0.88 + 0.24 * grain);
    float tracks = smoothstep(0.5, 0.0, abs(abs(across) - 1.5));
    col *= 1.0 - 0.12 * tracks;
    col = mix(col, col * 1.25, smoothstep(2.4, 3.0, abs(across)));

    // mezzeria tratteggiata, antialiasata e sfumata quando diventa più sottile di un pixel
    float w = 0.07;
    float lineMask = 1.0 - smoothstep(w - mpp, w + mpp, abs(across));
    float period = uDash.x + uDash.y;
    float dash = step(mod(along, period), uDash.x);
    lineMask *= dash * clamp(w * 2.0 / max(mpp, 1e-4), 0.0, 1.0);
    col = mix(col, uLine, lineMask * 0.9);

    vec3 n = vec3(0.0, 1.0, 0.0);
    vec3 lit = shade(col, n, bk.b, mix(1.0, bk.a, 0.6));
    gl_FragColor = vec4(applyFog(lit, vWorld), 1.0);
  }
`;

// ── muretti / parapetti / impalcato (un solo InstancedMesh di cubi scalati) ───
const wallVert = /* glsl */ `
  ${BAKE_GLSL}
  varying vec3 vWorld;
  varying vec3 vNormal2;
  varying float vVis;
  varying float vSeed;
  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormal2 = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vec3 o = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vVis = sampleBake(o.xz).b;
    vSeed = fract(sin(dot(o.xz, vec2(12.9898, 78.233))) * 43758.5453);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const wallFrag = /* glsl */ `
  ${NOISE_GLSL}
  ${LIGHT_GLSL}
  ${FOG_GLSL}
  uniform vec3 uStone;
  varying vec3 vWorld;
  varying vec3 vNormal2;
  varying float vVis;
  varying float vSeed;
  void main() {
    float mpp = length(fwidth(vWorld));
    float blocks = mix(0.5, vnoise(vec2(vWorld.x + vWorld.z, vWorld.y * 1.6) * 3.0), 1.0 - smoothstep(0.1, 0.5, mpp));
    vec3 col = uStone * (0.8 + 0.25 * vSeed + 0.2 * blocks);
    vec3 lit = shade(col, normalize(vNormal2), vVis, 0.85);
    gl_FragColor = vec4(applyFog(lit, vWorld), 1.0);
  }
`;

function buildWalls(road, hf, cfg) {
  const items = [];
  const len = road.step * 1.04;
  const hw = cfg.halfWidth;
  for (let i = 1; i < road.count - 1; i++) {
    const kind = road.kind[i];
    if (kind === KIND.tunnel) continue;
    const tx = road.tan[i * 2], tz = road.tan[i * 2 + 1];
    const nx = -tz, nz = tx;
    const x = road.x(i), y = road.y(i), z = road.z(i);
    const yaw = Math.atan2(-tz, tx);
    if (kind === KIND.bridge) {
      for (const s of [-1, 1]) items.push([x + nx * (hw + 0.25) * s, y - 0.3, z + nz * (hw + 0.25) * s, yaw, len, 1.25, 0.4]);
      items.push([x, y - 1.35, z, yaw, len, 1.35, hw * 2 + 1.0]); // impalcato
      continue;
    }
    // lato a valle: dove il terreno scende di più a 9 m dal bordo
    const dl = y - hf.height(x - nx * 9, z - nz * 9);
    const dr = y - hf.height(x + nx * 9, z + nz * 9);
    const s = dr > dl ? 1 : -1;
    const drop = Math.max(dl, dr);
    const hairpin = Math.abs(road.curv[i]) > cfg.wallMinCurvature && drop > 1.5;
    if (!hairpin && drop < cfg.wallMinDrop) continue;
    items.push([x + nx * (hw + 0.3) * s, y - 0.35, z + nz * (hw + 0.3) * s, yaw, len, cfg.wallHeight + 0.35, 0.42]);
  }
  const geo = new BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const m = new Matrix4(), q = new Quaternion(), e = new Euler(), p = new Vector3(), sc = new Vector3();
  return { geo, items, fill(mesh) {
    items.forEach(([x, y, z, yaw, l, h, t], k) => {
      q.setFromEuler(e.set(0, yaw, 0));
      mesh.setMatrixAt(k, m.compose(p.set(x, y, z), q, sc.set(l, h, t)));
    });
    mesh.instanceMatrix.needsUpdate = true;
  } };
}

// ── linee arancioni ──────────────────────────────────────────────────────────
// Line2 a spessore costante in pixel (come il tratto sopra le loro foto) + un alone morbido.
// setProgress disegna la linea fino a una frazione del percorso (instanceCount dei segmenti).
export function makeLine(points, { width, glow, haloWidth, haloOpacity }) {
  const geo = new LineGeometry();
  geo.setPositions(points);
  const mat = new LineMaterial({
    color: new Color(CONFIG.brand.orange).multiplyScalar(glow), linewidth: width, worldUnits: false, transparent: true,
  });
  const line = new Line2(geo, mat);
  line.frustumCulled = false;
  line.renderOrder = 2;
  const glowMat = new LineMaterial({
    color: new Color(CONFIG.brand.orange), linewidth: width * haloWidth, worldUnits: false,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  glowMat.fragmentShader = glowMat.fragmentShader.replace(
    'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
    `gl_FragColor = vec4( diffuseColor.rgb, alpha * exp( -vUv.x * vUv.x * 3.5 ) * ${haloOpacity.toFixed(3)} );`,
  );
  const halo = new Line2(geo, glowMat);
  halo.frustumCulled = false;
  halo.renderOrder = 3;
  line.add(halo);
  const segments = points.length / 3 - 1;
  return {
    line,
    /** p = 0…1: quanta parte della linea è disegnata */
    setProgress(p) {
      geo.instanceCount = Math.round(Math.min(Math.max(p, 0), 1) * segments);
      line.visible = geo.instanceCount > 0;
    },
    setOpacity(o) { mat.opacity = o; glowMat.opacity = o; },
    setResolution(w, h) { mat.resolution.set(w, h); glowMat.resolution.set(w, h); },
  };
}

function roadPoints(road, lift, reverse = false) {
  const pos = new Float32Array(road.count * 3);
  for (let k = 0; k < road.count; k++) {
    const i = reverse ? road.count - 1 - k : k;
    pos[k * 3] = road.x(i);
    pos[k * 3 + 1] = road.y(i) + CONFIG.road.lift + lift;
    pos[k * 3 + 2] = road.z(i);
  }
  return pos;
}

export function createRoad(road, hf, shared, rects, bakeTex) {
  const cfg = CONFIG.road;
  const group = new Group();
  const bakeU = { ...rects, tBakeHi: { value: bakeTex.hi }, tBakeBase: { value: bakeTex.base }, tBakeFar: { value: bakeTex.far } };

  const ribbon = new Mesh(
    ribbonGeometry(road, cfg.halfWidth, cfg.lift),
    new ShaderMaterial({
      uniforms: {
        ...shared, ...bakeU,
        uAsphalt: { value: new Color(cfg.asphalt) },
        uLine: { value: new Color(cfg.centerLine) },
        uDash: { value: new Vector2(...cfg.dash) },
        uHalfWidth: { value: cfg.halfWidth },
      },
      vertexShader: roadVert,
      fragmentShader: roadFrag,
    }),
  );
  group.add(ribbon);

  const w = buildWalls(road, hf, cfg);
  const walls = new InstancedMesh(w.geo, new ShaderMaterial({
    uniforms: { ...shared, ...bakeU, uStone: { value: new Color(cfg.wall) } },
    vertexShader: wallVert,
    fragmentShader: wallFrag,
  }), w.items.length);
  w.fill(walls);
  walls.computeBoundingSphere();
  group.add(walls);

  // discesa: dalla cima al mare · salita: dal porto verso la cima, più luminosa e appena più spessa
  const cl = CONFIG.line;
  const line = makeLine(roadPoints(road, cl.lift), cl);
  const climb = makeLine(roadPoints(road, cl.lift + 0.1, true), { ...cl, width: cl.width * 1.25, glow: cl.glow * 1.35, haloOpacity: cl.haloOpacity * 1.4 });
  climb.setProgress(0);
  group.add(line.line, climb.line);

  return { group, ribbon, walls, line, climb, stats: { walls: w.items.length } };
}
