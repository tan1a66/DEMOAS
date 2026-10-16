// EXPERIENCIAS: la península de Yucatán como maqueta de museo. Losa de mar turquesa
// (bajos claros junto a la costa), tierra en relieve con sombreado de las colinas Puuc,
// Mérida como punto luminoso "Piedra de Agua", pines, ruta punteada y modelos 3D.
// Costas: Natural Earth 1:10m (dominio público).
import * as THREE from 'three';
import { QUALITY, motion, IS_MOBILE } from '../config.js?v=2';
import { makeCanvas, fbm, rng } from '../util/textures.js?v=2';
import { merge, place, box } from './patio/geo.js?v=2';
import { tween, ease, damp, clamp } from '../util/tween.js?v=2';

const LAT0 = 20.3, LNG0 = -89.3, KM = 10;
const KX = (111.32 * Math.cos((LAT0 * Math.PI) / 180)) / KM, KY = 111.32 / KM;
const BOX = { lng0: -93, lng1: -86.2, lat0: 17.6, lat1: 22.4 };
export const proj = (lng, lat) => [(lng - LNG0) * KX, -(lat - LAT0) * KY];
const X0 = proj(BOX.lng0, 0)[0], X1 = proj(BOX.lng1, 0)[0];
const Z0 = proj(0, BOX.lat1)[1], Z1 = proj(0, BOX.lat0)[1];   // Z0 = norte (negativo)
const TW = X1 - X0, TD = Z1 - Z0;
const LAND_H = 0.32;

function clipRing(ring) {
  const lerpAt = (a, b, axis, v) => { const t = (v - a[axis]) / (b[axis] - a[axis]); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  const edges = [
    [(p) => p[0] >= BOX.lng0, (a, b) => lerpAt(a, b, 0, BOX.lng0)],
    [(p) => p[0] <= BOX.lng1, (a, b) => lerpAt(a, b, 0, BOX.lng1)],
    [(p) => p[1] >= BOX.lat0, (a, b) => lerpAt(a, b, 1, BOX.lat0)],
    [(p) => p[1] <= BOX.lat1, (a, b) => lerpAt(a, b, 1, BOX.lat1)],
  ];
  let out = ring;
  for (const [inside, cut] of edges) {
    const input = out; out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) { if (!inside(prev)) out.push(cut(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(cut(prev, cur));
    }
    if (!out.length) return out;
  }
  return out;
}

// relieve (0..1) en función de lon/lat: Sierrita de Ticul (Puuc) y tierras altas del sur
function relief(lng, lat, n) {
  const ax = -90.15, ay = 20.0, bx = -89.2, by = 20.48;
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((lng - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  const d = Math.hypot(lng - (ax + dx * t), lat - (ay + dy * t));
  let h = 0.14 * Math.exp(-Math.pow(d / 0.13, 2)) * (0.7 + 0.6 * n);
  const south = clamp((19.9 - lat) / 1.6, 0, 1);
  h += south * south * (0.35 + 0.65 * n);
  h += n * 0.12;
  return h;
}

function buildTextures(polys, size = 2048) {
  const W = size, H = Math.round(size * TD / TW);
  const toPx = (x, z) => [((x - X0) / TW) * W, ((z - Z0) / TD) * H];
  const pathAll = (ctx, filter) => {
    ctx.beginPath();
    for (const p of polys) {
      if (filter && !filter(p)) continue;
      for (const ring of p.rings) {
        ring.forEach(([x, z], i) => { const [px, py] = toPx(x, z); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
        ctx.closePath();
      }
    }
  };
  // 1) relieve pintado a baja resolución con sombreado
  const sw = size >= 2048 ? 1024 : 640, sh = Math.round(sw * TD / TW);
  const small = makeCanvas(sw, sh);
  const sctx = small.getContext('2d');
  const id = sctx.createImageData(sw, sh);
  const n = fbm(sw, sh, { octaves: 5, px: 6, seed: 12 });
  const n2 = fbm(sw, sh, { octaves: 3, px: 24, seed: 3 });
  const hgt = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const lng = BOX.lng0 + (x / sw) * (BOX.lng1 - BOX.lng0);
    const lat = BOX.lat1 - (y / sh) * (BOX.lat1 - BOX.lat0);
    hgt[y * sw + x] = relief(lng, lat, n[y * sw + x]);
  }
  const L = [-0.6, -0.55, 0.58];
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const i = y * sw + x;
    const hx = (hgt[y * sw + Math.min(sw - 1, x + 1)] - hgt[y * sw + Math.max(0, x - 1)]) * 9 * (sw / 512);
    const hy = (hgt[Math.min(sh - 1, y + 1) * sw + x] - hgt[Math.max(0, y - 1) * sw + x]) * 9 * (sw / 512);
    const len = Math.hypot(hx, hy, 1);
    const shade = 0.78 + 0.55 * ((-hx * L[0] - hy * L[1] + L[2]) / len - 0.58);
    const lat = BOX.lat1 - (y / sh) * (BOX.lat1 - BOX.lat0);
    // norte seco (oliva) → selva profunda al sur
    const dry = clamp((lat - 20.4) / 1.0, 0, 1) * (0.6 + 0.4 * n2[i]);
    const h = hgt[i];
    let r = 48 + 70 * dry + 30 * h, g = 96 + 40 * dry + 18 * h - 10 * n2[i], b = 52 + 22 * dry;
    r *= shade; g *= shade; b *= shade;
    id.data[i * 4] = r; id.data[i * 4 + 1] = g; id.data[i * 4 + 2] = b; id.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(id, 0, 0);
  // 2) textura grande de la tierra
  const land = makeCanvas(W, H);
  const lctx = land.getContext('2d');
  lctx.imageSmoothingEnabled = true;
  lctx.drawImage(small, 0, 0, W, H);
  // tierras vecinas más apagadas
  lctx.save();
  pathAll(lctx, (p) => !p.main);
  lctx.clip();
  lctx.fillStyle = 'rgba(40,60,50,0.45)';
  lctx.fillRect(0, 0, W, H);
  lctx.restore();
  // fronteras estatales punteadas y playa
  lctx.setLineDash([W * 0.004, W * 0.003]);
  lctx.strokeStyle = 'rgba(240,225,190,0.35)';
  lctx.lineWidth = W * 0.0012;
  pathAll(lctx, (p) => p.main);
  lctx.stroke();
  lctx.setLineDash([]);
  lctx.strokeStyle = 'rgba(232,214,170,0.9)';
  lctx.lineWidth = W * 0.0014;
  pathAll(lctx);
  lctx.stroke();
  // nombres de los estados
  lctx.fillStyle = 'rgba(244,236,214,0.32)';
  lctx.textAlign = 'center';
  lctx.font = `500 ${Math.round(W * 0.009)}px "Cormorant Garamond", Georgia, serif`;
  const label = (txt, lng, lat) => {
    const [x, z] = proj(lng, lat);
    const [px, py] = toPx(x, z);
    const chars = [...txt];
    const sp = W * 0.005;
    const widths = chars.map((c) => lctx.measureText(c).width);
    let cx = px - (widths.reduce((a, b) => a + b, 0) + sp * (chars.length - 1)) / 2;
    chars.forEach((c, i) => { lctx.fillText(c, cx + widths[i] / 2, py); cx += widths[i] + sp; });
  };
  label('YUCATÁN', -88.9, 20.55);
  label('CAMPECHE', -90.2, 18.9);
  label('QUINTANA ROO', -88.2, 19.1);
  // 3) máscara de bajos: tierra difuminada
  const shallow = makeCanvas(1024, Math.round(1024 * TD / TW));
  const shctx = shallow.getContext('2d');
  shctx.fillStyle = '#000'; shctx.fillRect(0, 0, shallow.width, shallow.height);
  const k = 1024 / W;
  shctx.save(); shctx.scale(k, k);
  shctx.filter = 'blur(60px)'; shctx.fillStyle = '#fff'; pathAll(shctx); shctx.fill();
  shctx.filter = 'blur(18px)'; pathAll(shctx); shctx.fill();
  shctx.restore();
  return { land, shallow };
}

const SEA_VS = /* glsl */`
varying vec2 vUv;
varying vec3 vW;
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const SEA_FS = /* glsl */`
uniform sampler2D uShallow;
uniform float uTime;
uniform vec2 uLL0;   // lon/lat de la esquina noroeste
uniform vec2 uLLs;   // tamaño en grados
varying vec2 vUv;
varying vec3 vW;
void main() {
  float m = texture2D(uShallow, vUv).r;
  vec3 deep = vec3(0.03, 0.2, 0.3), mid = vec3(0.04, 0.42, 0.5), shallow = vec3(0.32, 0.82, 0.78);
  vec3 col = mix(deep, mid, smoothstep(0.02, 0.3, m));
  col = mix(col, shallow, smoothstep(0.35, 0.85, m));
  // oleaje: líneas que brillan
  float w = sin(vW.x * 1.3 + uTime * 0.6 + sin(vW.z * 0.7) * 1.5) * sin(vW.z * 1.7 - uTime * 0.5);
  col += vec3(0.6, 0.9, 1.0) * pow(max(w, 0.0), 14.0) * 0.18;
  // retícula de meridianos y paralelos (cada grado)
  vec2 ll = uLL0 + vec2(vUv.x, 1.0 - vUv.y) * uLLs * vec2(1.0, -1.0);
  vec2 g = abs(fract(ll + 0.5) - 0.5) / fwidth(ll);
  float grid = 1.0 - min(min(g.x, g.y), 1.0);
  col = mix(col, vec3(0.85, 0.75, 0.5), grid * 0.22);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const ROUTE_FS = /* glsl */`
uniform float uTime;
uniform float uReveal;
varying vec2 vUv;
void main() {
  if (vUv.x > uReveal) discard;
  float dash = step(0.5, fract(vUv.x * 26.0 - uTime * 1.2));
  if (dash < 0.5) discard;
  gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * 1.6, 1.0);
  #include <colorspace_fragment>
}
`;

// ── modelos simbólicos ──
function pyramidChichen(mat, temple) {
  const parts = [];
  const tiers = 9, base = 1.15, top = 0.42, th = 0.075;
  for (let i = 0; i < tiers; i++) {
    const s = base - (base - top) * (i / (tiers - 1));
    parts.push(box(s, th, s, 0, i * th, 0));
  }
  const H = tiers * th;
  for (let k = 0; k < 4; k++) {
    const st = new THREE.BoxGeometry(0.2, 0.04, Math.hypot(H, (base - top) / 2) + 0.02);
    st.rotateX(Math.atan2(H, (base - top) / 2));
    const a = (k / 4) * Math.PI * 2;
    parts.push(place(st, Math.sin(a) * (base + top) / 4, H / 2, Math.cos(a) * (base + top) / 4, 0, a, 0));
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge(parts), mat));
  g.add(new THREE.Mesh(merge([box(0.3, 0.16, 0.3, 0, H, 0), box(0.34, 0.03, 0.34, 0, H + 0.16, 0)]), temple));
  return g;
}
function pyramidUxmal(mat, temple) {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const r = 0.5 - i * 0.055;
    const c = new THREE.CylinderGeometry(r, r + 0.02, 0.13, 28);
    c.scale(1.55, 1, 1);
    parts.push(place(c, 0, 0.065 + i * 0.13, 0));
  }
  const st = new THREE.BoxGeometry(0.16, 0.04, 0.95);
  st.rotateX(Math.atan2(0.8, 0.45));
  parts.push(place(st, 0, 0.4, 0.3));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge(parts), mat));
  g.add(new THREE.Mesh(merge([box(0.42, 0.14, 0.22, 0, 0.78, 0), box(0.46, 0.03, 0.26, 0, 0.92, 0)]), temple));
  return g;
}
function convent(yellow, white) {
  const parts = [], trims = [];
  // atrio con arcos (muro perimetral) e iglesia
  for (const [w, d, x, z] of [[1.2, 0.06, 0, -0.55], [1.2, 0.06, 0, 0.55], [0.06, 1.1, -0.6, 0], [0.06, 1.1, 0.6, 0]]) parts.push(box(w, 0.16, d, x, 0, z));
  for (let i = -5; i <= 5; i++) trims.push(box(0.05, 0.1, 0.07, i * 0.105, 0.0, 0.55), box(0.05, 0.1, 0.07, i * 0.105, 0.0, -0.55));
  parts.push(box(0.36, 0.36, 0.62, 0, 0, -0.2));
  parts.push(box(0.4, 0.5, 0.06, 0, 0, 0.12));
  parts.push(box(0.12, 0.18, 0.06, 0, 0.5, 0.12));
  trims.push(box(1.24, 0.03, 1.2, 0, 0.16, 0));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge(parts), yellow), new THREE.Mesh(merge(trims), white));
  return g;
}
function flamingos(pink, dark) {
  const g = new THREE.Group();
  const body = new THREE.SphereGeometry(0.045, 10, 8); body.scale(1.4, 0.8, 0.9);
  const neck = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.05, 0.02, 0), new THREE.Vector3(0.1, 0.12, 0), new THREE.Vector3(0.06, 0.16, 0)), 8, 0.008, 4, false);
  const head = place(new THREE.SphereGeometry(0.016, 8, 6), 0.065, 0.165, 0);
  const one = merge([body, neck, head]);
  const legs = merge([box(0.006, 0.12, 0.006, -0.005, -0.12, 0.012), box(0.006, 0.12, 0.006, 0.005, -0.12, -0.012)]);
  const rand = rng(5);
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Group();
    m.add(new THREE.Mesh(one, pink), new THREE.Mesh(legs, dark));
    m.position.set((rand() - 0.5) * 1.1, 0.13, (rand() - 0.5) * 0.7);
    m.rotation.y = rand() * Math.PI * 2;
    m.scale.setScalar(1.4 + rand() * 0.5);
    g.add(m);
  }
  const lagoon = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), new THREE.MeshStandardMaterial({ color: '#4fb8b0', roughness: 0.2, transparent: true, opacity: 0.85 }));
  lagoon.rotation.x = -Math.PI / 2; lagoon.scale.set(1, 0.7, 1); lagoon.position.y = 0.005;
  g.add(lagoon);
  return g;
}
function cenoteMarker(rock, dark, water) {
  const g = new THREE.Group();
  const ring = new THREE.TorusGeometry(0.34, 0.09, 8, 28); ring.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(ring, rock));
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.32, 28), dark); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.01;
  const w = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), water); w.rotation.x = -Math.PI / 2; w.position.y = 0.015;
  g.add(hole, w);
  return g;
}

export async function createMap(engine, places, merida) {
  const renderer = engine.renderer;
  const hq = QUALITY.tier === 'high';
  // en la versión de un solo archivo los datos vienen incrustados en la página
  const geo = window.__PDA_GEO || await fetch('data/yucatan.geo.json').then((r) => r.json());
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a1d19');
  scene.fog = new THREE.Fog('#0a1d19', 60, 140);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);

  scene.add(new THREE.HemisphereLight('#f4ecd8', '#16302a', 1.1));
  const sun = new THREE.DirectionalLight('#fff0d8', 1.6);
  sun.position.set(-20, 40, -10);
  scene.add(sun);

  // polígonos proyectados y recortados al área de la maqueta
  const polys = [];
  for (const f of geo.features) {
    const g = f.geometry;
    const list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of list) {
      const rings = poly.map((ring) => clipRing(ring)).filter((r) => r.length >= 3).map((r) => r.map(([lng, lat]) => proj(lng, lat)));
      if (rings.length) polys.push({ main: f.properties.main, rings });
    }
  }
  const tex = buildTextures(polys, hq ? 2048 : 1280);

  // losa de mar
  const shallowTex = new THREE.CanvasTexture(tex.shallow);
  const seaTop = new THREE.Mesh(new THREE.PlaneGeometry(TW, TD), new THREE.ShaderMaterial({
    uniforms: { uShallow: { value: shallowTex }, uTime: { value: 0 }, uLL0: { value: new THREE.Vector2(BOX.lng0, BOX.lat1) }, uLLs: { value: new THREE.Vector2(BOX.lng1 - BOX.lng0, BOX.lat1 - BOX.lat0) } },
    vertexShader: SEA_VS, fragmentShader: SEA_FS,
  }));
  seaTop.rotation.x = -Math.PI / 2;
  seaTop.position.set(X0 + TW / 2, 0, Z0 + TD / 2);
  scene.add(seaTop);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(TW, 1.6, TD), new THREE.MeshStandardMaterial({ color: '#0b3a46', roughness: 0.35, metalness: 0.1 }));
  slab.position.set(X0 + TW / 2, -0.81, Z0 + TD / 2);
  scene.add(slab);
  // filete de latón alrededor de la maqueta
  const rim = merge([
    box(TW + 0.3, 0.08, 0.15, X0 + TW / 2, -0.02, Z0 - 0.07), box(TW + 0.3, 0.08, 0.15, X0 + TW / 2, -0.02, Z1 + 0.07),
    box(0.15, 0.08, TD, X0 - 0.07, -0.02, Z0 + TD / 2), box(0.15, 0.08, TD, X1 + 0.07, -0.02, Z0 + TD / 2),
  ]);
  scene.add(new THREE.Mesh(rim, new THREE.MeshStandardMaterial({ color: '#c49a5c', metalness: 1, roughness: 0.35 })));

  // tierra extruida
  const landTex = new THREE.CanvasTexture(tex.land);
  landTex.colorSpace = THREE.SRGBColorSpace;
  landTex.anisotropy = QUALITY.aniso;
  landTex.repeat.set(1 / TW, 1 / TD);
  landTex.offset.set(-X0 / TW, Z1 / TD);
  const shapes = [];
  for (const p of polys) {
    const [outer, ...holes] = p.rings;
    if (Math.abs(THREE.ShapeUtils.area(outer.map(([x, z]) => new THREE.Vector2(x, -z)))) < 0.05) continue;
    const s = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
    holes.forEach((h) => s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z)))));
    shapes.push(s);
  }
  const landGeo = new THREE.ExtrudeGeometry(shapes, { depth: LAND_H, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.05, bevelSegments: 1 });
  landGeo.rotateX(-Math.PI / 2);
  // grano fino de la selva (relieve repetido) para que de cerca no se vea borroso
  const grain = new THREE.CanvasTexture((() => { const c = makeCanvas(256); const ctx = c.getContext('2d'); const im = ctx.createImageData(256, 256); const nn = fbm(256, 256, { octaves: 3, px: 32, seed: 4 }); for (let i = 0; i < nn.length; i++) { const v = nn[i] * 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } ctx.putImageData(im, 0, 0); return c; })());
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(2.2, 2.2);
  const land = new THREE.Mesh(landGeo, [
    new THREE.MeshStandardMaterial({ map: landTex, bumpMap: grain, bumpScale: 1.2, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: '#d9c49a', roughness: 0.9 }),
  ]);
  scene.add(land);

  // rótulos del mar
  const seaLabel = (text, lng, lat, size = 2.2, rot = 0) => {
    const c = makeCanvas(1024, 160);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(214,236,232,0.55)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 500 92px "Cormorant Garamond", Georgia, serif`;
    ctx.fillText(text, 512, 80);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 6.4, size), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    const [x, z] = proj(lng, lat);
    m.rotation.set(-Math.PI / 2, 0, rot);
    m.position.set(x, 0.02, z);
    scene.add(m);
  };
  seaLabel('Golfo de México', -90.6, 22.0, 2.3);
  seaLabel('Mar Caribe', -86.55, 19.4, 1.7, -Math.PI / 2);

  // Mérida: punto luminoso con ondas
  const [mx, mz] = proj(merida.lng, merida.lat);
  const meridaPos = new THREE.Vector3(mx, LAND_H + 0.02, mz);
  const aqua = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9ef0e0').multiplyScalar(1.6) });
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 12), aqua);
  dot.position.copy(meridaPos).y += 0.12;
  scene.add(dot);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.3, 48), new THREE.MeshBasicMaterial({ color: '#9ef0e0', transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    r.rotation.x = -Math.PI / 2;
    r.position.copy(meridaPos).y += 0.02;
    scene.add(r);
    rings.push(r);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.12, 3.2, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#9ef0e0', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.position.copy(meridaPos).y += 1.6;
  scene.add(beam);

  // pines y modelos
  const stone = new THREE.MeshStandardMaterial({ color: '#dccfb4', roughness: 0.85 });
  const temple = new THREE.MeshStandardMaterial({ color: '#c4b391', roughness: 0.85 });
  const brass = new THREE.MeshStandardMaterial({ color: '#d4a862', metalness: 1, roughness: 0.3 });
  const pinGeo = merge([place(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 24), 0, 0.015, 0), place(new THREE.ConeGeometry(0.09, 0.32, 16), 0, 0.42, 0, Math.PI, 0, 0), place(new THREE.SphereGeometry(0.11, 16, 10), 0, 0.62, 0)]);
  const modelMaker = {
    pyramid: () => pyramidChichen(stone, temple),
    'pyramid-round': () => pyramidUxmal(stone, temple),
    convent: () => convent(new THREE.MeshStandardMaterial({ color: '#e7bf3e', roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: '#f6f0e2', roughness: 0.8 })),
    flamingo: () => flamingos(new THREE.MeshStandardMaterial({ color: '#f28aa3', roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: '#3a2a2a' })),
    cenote: () => cenoteMarker(new THREE.MeshStandardMaterial({ color: '#cbbd9e', roughness: 0.95 }), new THREE.MeshBasicMaterial({ color: '#06110f' }), new THREE.MeshBasicMaterial({ color: new THREE.Color('#38d6c8').multiplyScalar(1.3) })),
  };
  const pins = places.map((pl) => {
    const [x, z] = proj(pl.lng, pl.lat);
    const pos = new THREE.Vector3(x, LAND_H + 0.02, z);
    const pin = new THREE.Mesh(pinGeo, brass);
    pin.position.copy(pos);
    pin.userData.id = pl.id;
    scene.add(pin);
    const model = modelMaker[pl.kind]();
    model.position.copy(pos);
    model.position.x += pl.kind === 'cenote' ? 0 : 0.0;
    model.scale.setScalar(0.001);
    model.visible = false;
    scene.add(model);
    return { id: pl.id, place: pl, pos, pin, model, show: 0, label: pos.clone().add(new THREE.Vector3(0, 0.95, 0)) };
  });

  // ruta punteada Mérida → destino
  const routeUniforms = { uTime: { value: 0 }, uReveal: { value: 0 } };
  const routeMat = new THREE.ShaderMaterial({
    uniforms: routeUniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: ROUTE_FS,
  });
  let route = null;
  function setRoute(to) {
    if (route) { scene.remove(route); route.geometry.dispose(); route = null; }
    if (!to) return;
    const a = meridaPos.clone().setY(LAND_H + 0.06), b = to.clone().setY(LAND_H + 0.06);
    const mid = a.clone().lerp(b, 0.5); mid.y += a.distanceTo(b) * 0.28 + 0.3;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    route = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.035, 6, false), routeMat);
    scene.add(route);
    routeUniforms.uReveal.value = 0;
    tween({ duration: 1.3, easing: ease.inOutCubic, onUpdate: (v) => { routeUniforms.uReveal.value = v; } });
  }

  // ── cámara ──
  const center = new THREE.Vector3(-1.4, 0, -4.4);
  const rig = { pos: new THREE.Vector3(0, 90, 60), look: center.clone(), mode: 'overview', focus: null, orbit: 0 };
  const overview = () => {
    const portrait = engine.size.w / engine.size.h < 0.9;
    return { pos: center.clone().add(new THREE.Vector3(portrait ? -0.4 : 0.6, portrait ? 50 : 24, portrait ? 26 : 16.5)), look: center.clone().add(new THREE.Vector3(portrait ? -1.2 : 0, 0, portrait ? -0.2 : -1.2)) };
  };
  function fly(pos, look, duration = 1.6) {
    const p0 = rig.pos.clone(), l0 = rig.look.clone();
    const mid = p0.clone().lerp(pos, 0.5); mid.y = Math.max(p0.y, pos.y) + 2;
    return tween({
      duration, easing: ease.inOutCubic,
      onUpdate: (v) => {
        const a = p0.clone().multiplyScalar((1 - v) * (1 - v)), b = mid.clone().multiplyScalar(2 * v * (1 - v)), c = pos.clone().multiplyScalar(v * v);
        rig.pos.copy(a.add(b).add(c));
        rig.look.copy(l0).lerp(look, v);
      },
    });
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const canvas = engine.canvas;
  const pointer = { x: 0, y: 0 };
  let active = false, onPin = null, onLabels = null;
  canvas.addEventListener('pointermove', (e) => {
    if (!active) return;
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (e.pointerType === 'mouse') {
      ndc.set(pointer.x, -pointer.y);
      raycaster.setFromCamera(ndc, camera);
      canvas.style.cursor = raycaster.intersectObjects(pins.map((p) => p.pin), false).length ? 'pointer' : '';
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!active) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pins.map((p) => p.pin), false)[0];
    if (hit) onPin?.(hit.object.userData.id);
  });

  const tmp = new THREE.Vector3();
  const labelsOut = pins.map((p) => ({ id: p.id, x: 0, y: 0, visible: false }));
  const meridaLabel = { id: 'merida', x: 0, y: 0, visible: false };

  let insets = { top: 0, bottom: 0, right: 0 };
  const view = {
    scene, camera,
    setInsets(i) { insets = { ...insets, ...i }; this.resize(engine.size.w, engine.size.h); }, pins,
    on(name, fn) { if (name === 'pin') onPin = fn; if (name === 'labels') onLabels = fn; },
    async intro() {
      const o = overview();
      rig.pos.set(center.x, 75, center.z + 55);
      rig.look.copy(center);
      await fly(o.pos, o.look, motion.reduced ? 0.4 : 2.4);
    },
    async focus(id) {
      const p = pins.find((x) => x.id === id);
      rig.mode = 'focus';
      rig.focus = p;
      pins.forEach((q) => { q.target = q === p ? 1 : 0; });
      p.model.visible = true;
      setRoute(p.pos);
      const portrait = engine.size.w / engine.size.h < 0.9;
      const off = portrait ? new THREE.Vector3(2.2, 9.2, 9.0) : new THREE.Vector3(2.4, 4.2, 5.0);
      await fly(p.pos.clone().add(off), p.pos.clone().add(new THREE.Vector3(portrait ? 0 : -1.1, 0.4, portrait ? 0.8 : 0)), 1.7);
    },
    async diveTarget(id) {
      // la cámara baja hacia la boca del cenote
      const p = pins.find((x) => x.id === id);
      await fly(p.pos.clone().add(new THREE.Vector3(0.05, 1.1, 0.25)), p.pos.clone(), 1.2);
    },
    async overview() {
      rig.mode = 'overview';
      rig.focus = null;
      pins.forEach((q) => { q.target = 0; });
      setRoute(null);
      const o = overview();
      await fly(o.pos, o.look, 1.5);
    },
    resize(w, h) {
      camera.aspect = w / h;
      // la escena se centra en el espacio libre que dejan el panel o la ficha inferior
      camera.setViewOffset(w, h, insets.right / 2, (insets.bottom - insets.top) / 2, w, h);
      camera.updateProjectionMatrix();
    },
    onEnter() { active = true; },
    onExit() { active = false; canvas.style.cursor = ''; },
    update(dt, time) {
      const k = motion.reduced ? 0 : 1;
      camera.position.copy(rig.pos);
      camera.position.x += pointer.x * 0.6 * k;
      camera.position.y += -pointer.y * 0.4 * k;
      camera.lookAt(rig.look);
      seaTop.material.uniforms.uTime.value = time;
      routeUniforms.uTime.value = time;
      // Mérida late
      rings.forEach((r, i) => {
        const ph = ((time * 0.45 + i / 3) % 1);
        r.scale.setScalar(1 + ph * 3.2);
        r.material.opacity = (1 - ph) * 0.7;
      });
      dot.scale.setScalar(1 + Math.sin(time * 3) * 0.08);
      pins.forEach((p, i) => {
        p.pin.position.y = p.pos.y + Math.sin(time * 1.6 + i) * 0.04 * k;
        p.pin.rotation.y = time * 0.6;
        p.show = damp(p.show, p.target || 0, 5, dt);
        const s = p.show < 0.01 ? 0.001 : ease.outBack(Math.min(1, p.show)) * 1.7;
        p.model.scale.setScalar(s);
        p.model.visible = p.show > 0.01;
        if (p.model.visible) p.model.rotation.y = time * 0.15;
        p.pin.visible = p.show < 0.6;
      });
      if (onLabels) {
        const w = engine.size.w, h = engine.size.h;
        camera.updateMatrixWorld();
        pins.forEach((p, i) => {
          tmp.copy(p.label).project(camera);
          const o = labelsOut[i];
          o.x = (tmp.x * 0.5 + 0.5) * w; o.y = (-tmp.y * 0.5 + 0.5) * h;
          o.visible = tmp.z < 1 && o.x > 0 && o.x < w && o.y > 0 && o.y < h;
        });
        tmp.copy(meridaPos).add(new THREE.Vector3(0, 0.7, 0)).project(camera);
        meridaLabel.x = (tmp.x * 0.5 + 0.5) * w; meridaLabel.y = (-tmp.y * 0.5 + 0.5) * h; meridaLabel.visible = tmp.z < 1;
        onLabels(labelsOut, meridaLabel);
      }
    },
  };
  return view;
}
