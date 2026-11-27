// Escena 2: el logo construido como las piezas de pared de Miguel Tapia (mata__oo__, "Wall study 11"):
// listones de madera maciza de sección cuadrada, paralelos, cortados a escuadra y escalonados.
// Cada trazo del logo se vuelve un haz de listones que sigue su dirección; los extremos quedan
// en escalera (la silueta del dibujo) y la profundidad también sube en escalones hacia el centro.
// Sin sala ni sombras proyectadas: sólo la pieza sobre el papel del logo.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { patch, QUALITY } from './core.js';
import { WOOD } from './glsl.js';
import { strokeSDF, parsePath, bbox } from './sdf.js';
import { LOGO_STROKES, LOGO_VIEWBOX, LOGO_INK } from '../logo-data.js';

export const SCULPT_HEIGHT = 3.0;                 // la pieza mide 3 m
const S = SCULPT_HEIGHT / LOGO_VIEWBOX[3];        // metros por unidad del viewBox
const BAR = 0.05;                                 // sección del listón (m)
const DIL = 15;                                   // engrosamiento del trazo (unidades del viewBox)
const STEP = BAR / 2;                             // los cortes y la profundidad van en medios listones

function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------------------------------------------------------------- listones de un trazo
function strokeBars(st, R, toLocal) {
  const sdf = strokeSDF(st.d, 0.8, 26 + DIL);
  const { raw, W, H, x0, y0, wU, hU } = sdf;
  const sample = (x, y) => {
    const gx = ((x - x0) / wU) * (W - 1), gy = ((y - y0) / hU) * (H - 1);
    if (gx < 0 || gy < 0 || gx > W - 1 || gy > H - 1) return -1e3;
    const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const i = iy * W + ix, ix1 = Math.min(ix + 1, W - 1) - ix, iy1 = (Math.min(iy + 1, H - 1) - iy) * W;
    return (raw[i] * (1 - fx) + raw[i + ix1] * fx) * (1 - fy) + (raw[i + iy1] * (1 - fx) + raw[i + iy1 + ix1] * fx) * fy;
  };
  const pts = parsePath(st.d);
  // eje principal del trazo (PCA); el punto va en vertical
  let mx = 0, my = 0;
  for (const [x, y] of pts) { mx += x; my += y; }
  mx /= pts.length; my /= pts.length;
  let ax = 0, ay = 1;
  if (st.id !== 'punto') {
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of pts) { const dx = x - mx, dy = y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    ax = Math.cos(th); ay = Math.sin(th);
  }
  const bx = -ay, by = ax;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, y] of pts) {
    const u = (x - mx) * ax + (y - my) * ay, v = (x - mx) * bx + (y - my) * by;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  u0 -= DIL; u1 += DIL; v0 -= DIL; v1 += DIL;
  const s = BAR / S, q = STEP / S;
  const n = Math.max(1, Math.round((v1 - v0) / s));
  const vc = (v0 + v1) / 2;
  const angle = Math.atan2(-ay, ax);           // eje en coordenadas locales (y hacia arriba)
  const bars = [];
  for (let k = 0; k < n; k++) {
    const v = vc + (k - (n - 1) / 2) * s;
    // tramos dentro del trazo engrosado a lo largo del carril
    const h = s / 6;
    let start = null;
    const runs = [];
    for (let u = u0; u <= u1 + h; u += h) {
      const x = mx + ax * u + bx * v, y = my + ay * u + by * v;
      const inside = u <= u1 && sample(x, y) + DIL > 0;
      if (inside && start === null) start = u;
      if (!inside && start !== null) { runs.push([start, u - h]); start = null; }
    }
    const rel = n > 1 ? Math.abs(k - (n - 1) / 2) / ((n - 1) / 2) : 0;
    const depth = Math.max(2, Math.round((0.1 + 0.17 * (1 - Math.pow(rel, 1.6))) / STEP)) * STEP;
    for (let [a, b] of runs) {
      a = Math.floor(a / q) * q; b = Math.ceil(b / q) * q;   // corte a escuadra, en medios listones
      if (b - a < s * 1.2) continue;
      // el listón se arma con piezas de distinto largo (juntas visibles, como en la pieza de Miguel)
      let t = a;
      while (t < b - 1e-6) {
        let len = Math.min(b - t, (0.3 + R() * 0.7) / S);
        if (b - (t + len) < s * 1.5) len = b - t;
        bars.push({ u: t + len / 2, v, len: len * S, depth, angle, mx, my, ax, ay, bx, by });
        t += len;
      }
    }
  }
  return bars.map((b) => {
    const x = b.mx + b.ax * b.u + b.bx * b.v, y = b.my + b.ay * b.u + b.by * b.v;
    const [X, Y] = toLocal(x, y);
    return { X, Y, angle: b.angle, len: b.len, depth: b.depth };
  });
}

// ---------------------------------------------------------------- material de los listones
function barMaterial(envMap) {
  const uniforms = {
    uBuild: { value: 0 },
    uBarDark: { value: new THREE.Color('#47200f') },
    uBarLight: { value: new THREE.Color('#7b3a1f') },
    uBarWarm: { value: new THREE.Color('#9a5327') },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0, envMap, envMapIntensity: 0.3 });
  patch(mat, {
    key: 'bars', grain: true, uniforms,
    vertHead: /* glsl */ `
      attribute vec3 aLocal;   // (a lo ancho, a lo largo, profundidad desde atrás) en metros
      attribute vec4 aInfo;    // profundidad, retardo, tono, semilla
      attribute vec2 aAxis;
      uniform float uBuild;
      varying vec3 vLocal;
      varying vec4 vInfo;
      varying float vEnd;
      varying float vSide;
    `,
    vertBegin: /* glsl */ `
      // los listones salen del dibujo uno a uno, de abajo arriba
      float g = smoothstep(aInfo.y, aInfo.y + 0.3, uBuild);
      g = g * g * (3.0 - 2.0 * g);
      float zb = transformed.z - aLocal.z;
      transformed.z -= (aInfo.x + zb + 0.05) * (1.0 - g);
      vLocal = aLocal; vInfo = aInfo;
      vEnd = abs(dot(objectNormal.xy, aAxis));
      vSide = (1.0 - abs(objectNormal.z)) * (1.0 - vEnd);
    `,
    fragHead: /* glsl */ `
      varying vec3 vLocal;
      varying vec4 vInfo;
      varying float vEnd;
      varying float vSide;
      uniform vec3 uBarDark, uBarLight, uBarWarm;
    `,
    fragNormal: /* glsl */ `
      {
        float fw = length(fwidth(vLocal)) + 1e-5;
        vec3 c = mix(uBarDark, uBarLight, vInfo.z);
        if (vInfo.w > 0.86) c = mix(c, uBarWarm, 0.55);
        // veta recta a lo largo del listón (fina y ancha), sin parpadeo a distancia
        float st = eNoise3(vec3(vLocal.x * 150.0, vLocal.y * 1.4, vLocal.z * 150.0 + vInfo.w * 31.0)) - 0.5;
        st *= 1.0 - smoothstep(0.15, 0.5, fw * 150.0);
        float st2 = eNoise3(vec3(vLocal.x * 34.0, vLocal.y * 0.55, vLocal.z * 34.0 + vInfo.w * 17.0));
        c *= (0.8 + 0.36 * st2) * (1.0 + 0.4 * st);
        // testa (corte transversal): más oscura, con anillos
        float ring = fract(length(vec2(vLocal.x, vLocal.z) - vec2(0.3, -0.25 - vInfo.w * 0.4)) * 90.0);
        c *= mix(1.0, 0.62 + 0.12 * smoothstep(0.3, 0.7, ring), vEnd);
        // los costados se oscurecen hacia atrás (contacto entre listones)
        c *= mix(1.0, mix(0.45, 1.0, smoothstep(0.0, 0.16, vLocal.z)), vSide);
        diffuseColor.rgb = c;
        roughnessFactor = 0.48 + 0.14 * st2 + 0.1 * vEnd;
      }`,
  });
  mat.userData.uniforms = uniforms;
  return mat;
}

function addBox(arr, b, zb, R, delay) {
  const g = new THREE.BoxGeometry(b.len - 0.003, BAR - 0.0025, b.depth);
  const p = g.attributes.position, nrm = g.attributes.normal;
  const c = Math.cos(b.angle), s = Math.sin(b.angle);
  const tone = R(), seed = R(), along0 = R() * 3;
  const base = arr.pos.length / 3;
  for (let i = 0; i < p.count; i++) {
    const lx = p.getX(i), ly = p.getY(i), lz = p.getZ(i) + b.depth / 2;
    arr.pos.push(b.X + lx * c - ly * s, b.Y + lx * s + ly * c, zb + lz);
    const nx = nrm.getX(i), ny = nrm.getY(i);
    arr.nor.push(nx * c - ny * s, nx * s + ny * c, nrm.getZ(i));
    arr.loc.push(ly, lx + along0, lz);
    arr.info.push(b.depth, delay, tone, seed);
    arr.axis.push(c, s);
  }
  for (let i = 0; i < g.index.count; i++) arr.idx.push(base + g.index.getX(i));
  g.dispose();
}

// ---------------------------------------------------------------- taburete (tres rodajas)
// Esfera de radio 1 (k = 0) o taburete de tres rodajas apiladas (k = 1).
export function shapeSphere(geo, polar, meanR, k = 0, stoolR = 1, stoolH = 2) {
  const base = geo.userData.base || (geo.userData.base = geo.attributes.position.array.slice());
  const pos = geo.attributes.position.array;
  const m = 2 + k * 8.0;
  for (let i = 0; i < pos.length; i += 3) {
    const x = base[i], y = base[i + 1], z = base[i + 2];
    const rr = Math.pow(Math.pow(Math.hypot(x, z), m) + Math.pow(Math.abs(y), m), 1 / m) || 1;
    const yy = y / rr;
    const joint = Math.max(Math.exp(-((yy - 0.333) ** 2) / 0.0035), Math.exp(-((yy + 0.333) ** 2) / 0.0035));
    const groove = 1 - 0.1 * joint * k;
    const rx = 1 + (stoolR - 1) * k, ry = 1 + (stoolH / 2 - 1) * k;
    pos[i] = (x / rr) * rx * groove;
    pos[i + 1] = yy * ry;
    pos[i + 2] = (z / rr) * rx * groove;
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

export function makeStool(r, h) {
  const geo = new THREE.SphereGeometry(1, 64, 64);
  shapeSphere(geo, null, 1, 1, 1, 2);
  const uniforms = {
    uRingAxis: { value: new THREE.Vector3(0.03, 0, -0.02) },
    uScale: { value: new THREE.Vector3(r, h / 2, r) },
    uWoodEarly: { value: new THREE.Color('#82462c') },
    uWoodLate: { value: new THREE.Color('#3a1a10') },
    uWoodPore: { value: new THREE.Color('#2a130c') },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0, envMapIntensity: 0.5 });
  patch(mat, {
    key: 'stool', gobo: true, reveal: true, uniforms,
    vertHead: 'varying vec3 vObj;',
    vertMain: 'vObj = transformed;',
    fragHead: `varying vec3 vObj; uniform vec3 uRingAxis; uniform vec3 uScale; ${WOOD}`,
    fragNormal: `{ float wr; diffuseColor.rgb = eWoodAlbedo(vObj * uScale - uRingAxis, wr); roughnessFactor = wr * 0.85; }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(r, h / 2, r);
  m.name = 'taburete';
  return m;
}

// ---------------------------------------------------------------- la pieza
export function buildLogo(scene, renderer) {
  const group = new THREE.Group();
  group.name = 'logo3d';
  scene.add(group);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // origen del grupo = centro del punto
  const dot = LOGO_STROKES.find((s) => s.id === 'punto');
  const db = bbox(parsePath(dot.d));
  const dcx = (db.x0 + db.x1) / 2, dcy = (db.y0 + db.y1) / 2;
  const toLocal = (x, y) => [(x - dcx) * S, -(y - dcy) * S];

  // 1) el dibujo plano en tinta (idéntico al SVG del cargador)
  const inkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(LOGO_INK), toneMapped: false, transparent: true, depthWrite: false });
  const ink = new THREE.Group();
  for (const st of LOGO_STROKES) {
    const shape = new THREE.Shape(parsePath(st.d).map(([x, y]) => new THREE.Vector2(...toLocal(x, y))));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), inkMat);
    m.position.z = 0.002;
    ink.add(m);
  }
  group.add(ink);

  // 2) los listones
  const R = rnd(11);
  // profundidad base de cada trazo (capas: el tallo al frente, la línea de base al fondo)
  const zBase = { base: 0.0, hoja1: 0.03, hoja2: 0.06, tallo: 0.1, hoja3: 0.05, hoja4: 0.02, punto: 0.07 };
  const arr = { pos: [], nor: [], loc: [], info: [], axis: [], idx: [] };
  const all = [];
  for (const st of LOGO_STROKES) for (const b of strokeBars(st, R, toLocal)) all.push({ ...b, zb: zBase[st.id] ?? 0 });
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, maxZ = 0;
  for (const b of all) {
    const hx = Math.abs(Math.cos(b.angle)) * b.len / 2 + BAR / 2, hy = Math.abs(Math.sin(b.angle)) * b.len / 2 + BAR / 2;
    minX = Math.min(minX, b.X - hx); maxX = Math.max(maxX, b.X + hx);
    minY = Math.min(minY, b.Y - hy); maxY = Math.max(maxY, b.Y + hy);
    maxZ = Math.max(maxZ, b.zb + b.depth);
  }
  for (const b of all) {
    const delay = 0.62 * (0.75 * (b.Y - minY) / (maxY - minY) + 0.25 * R());
    addBox(arr, b, b.zb, R, delay);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(arr.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(arr.nor, 3));
  geo.setAttribute('aLocal', new THREE.Float32BufferAttribute(arr.loc, 3));
  geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(arr.info, 4));
  geo.setAttribute('aAxis', new THREE.Float32BufferAttribute(arr.axis, 2));
  geo.setIndex(arr.idx);
  const barMat = barMaterial(studio);
  const bars = new THREE.Mesh(geo, barMat);
  bars.castShadow = true;
  bars.receiveShadow = true;
  bars.frustumCulled = false;
  bars.name = 'listones';
  // sombras propias entre listones: misma deformación (salida desde el dibujo)
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depthMat.onBeforeCompile = (sh) => {
    sh.uniforms.uBuild = barMat.userData.uniforms.uBuild;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aLocal; attribute vec4 aInfo; uniform float uBuild;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float g = smoothstep(aInfo.y, aInfo.y + 0.3, uBuild); g = g * g * (3.0 - 2.0 * g);
        float zb = transformed.z - aLocal.z;
        transformed.z -= (aInfo.x + zb + 0.05) * (1.0 - g);`);
  };
  depthMat.customProgramCacheKey = () => 'barsDepth';
  bars.customDepthMaterial = depthMat;
  group.add(bars);

  const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, maxZ / 2);
  const size = new THREE.Vector2(maxX - minX, maxY - minY);

  // luz de estudio: principal cálida arriba a la izquierda (con sombras propias), relleno y contraluz
  const key = new THREE.DirectionalLight(0xfff0e0, 0);
  key.position.set(center.x - 2.6, center.y + 3.2, 4.2);
  key.target.position.copy(center);
  key.castShadow = true;
  key.shadow.mapSize.set(QUALITY.shadow, QUALITY.shadow);
  Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 1, far: 14 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 2;
  const fill = new THREE.HemisphereLight(0xfff4e6, 0x8a6a55, 0);
  const rim = new THREE.DirectionalLight(0xffe6cc, 0);
  rim.position.set(center.x + 4, center.y + 2, -3);
  rim.target.position.copy(center);
  group.add(key, key.target, fill, rim, rim.target);

  const vbLocal = new THREE.Vector3(...toLocal(LOGO_VIEWBOX[2] / 2, LOGO_VIEWBOX[3] / 2), 0);
  return {
    group, bars, ink, center, size, vbLocal, viewBoxH: LOGO_VIEWBOX[3] * S, key, fill, rim, studio,
    count: all.length,
    set({ build, ink: inkK, light }) {
      barMat.userData.uniforms.uBuild.value = build;
      bars.visible = build > 0.001;
      inkMat.opacity = inkK;
      ink.visible = inkK > 0.001;
      key.intensity = 3.4 * light;
      fill.intensity = 0.55 * light;
      rim.intensity = 1.3 * light;
    },
  };
}
