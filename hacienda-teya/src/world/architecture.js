// ─────────────────────────────────────────────────────────────────────────────
//  Mattoni dell'architettura: muri con archi, fasce, cornici, gradini,
//  colonne, finestre con "copete", campane, lanterne, scritte dipinte.
//  Tutte le misure sono in metri. Convenzione dei muri: facciata principale
//  sul piano z = 0 rivolta verso +z, spessore verso −z, base a y = 0.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const ARC_SEG = 40;

/**
 * Muro con aperture.
 * openings: { x (centro), w (larghezza), spring (imposta dell'arco o altezza
 *            del vano rettangolare), y0 (davanzale, 0 = fino a terra),
 *            kind: 'round' | 'rect' }
 * Le aperture che toccano terra diventano "tacche" del contorno; le altre fori.
 * Gruppi del materiale: 0 = facce (intonaco), 1 = spallette/coronamento (calce).
 */
export function wallGeometry({ width, height, depth, openings = [], topProfile = null }) {
  const s = new THREE.Shape();
  const W = width / 2;
  const ground = openings.filter((o) => !o.y0).sort((a, b) => a.x - b.x);
  const raised = openings.filter((o) => o.y0);
  s.moveTo(-W, 0);
  for (const o of ground) {
    const x0 = o.x - o.w / 2;
    const x1 = o.x + o.w / 2;
    s.lineTo(x0, 0);
    s.lineTo(x0, o.spring);
    if (o.kind === 'rect') s.lineTo(x1, o.spring);
    else s.absarc(o.x, o.spring, o.w / 2, Math.PI, 0, true);
    s.lineTo(x1, 0);
  }
  s.lineTo(W, 0);
  if (topProfile) {
    // profilo superiore personalizzato (da destra a sinistra)
    for (const [x, y] of topProfile) s.lineTo(x, y);
  } else {
    s.lineTo(W, height);
    s.lineTo(-W, height);
  }
  s.lineTo(-W, 0);
  for (const o of raised) {
    const h = new THREE.Path();
    const x0 = o.x - o.w / 2;
    const x1 = o.x + o.w / 2;
    h.moveTo(x0, o.y0);
    h.lineTo(x1, o.y0);
    h.lineTo(x1, o.spring);
    if (o.kind === 'rect') h.lineTo(x0, o.spring);
    else h.absarc(o.x, o.spring, o.w / 2, 0, Math.PI, false);
    h.lineTo(x0, o.y0);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: ARC_SEG });
  g.translate(0, 0, -depth);
  return g;
}

/** Fascia bianca attorno a un arco (archivolto + stipiti) sulla faccia z = 0 */
export function archBandGeometry({ x, w, spring, band = 0.3, thick = 0.04, y0 = 0, kind = 'round' }) {
  const r = w / 2;
  const s = new THREE.Shape();
  s.moveTo(x - r - band, y0);
  s.lineTo(x - r - band, spring);
  if (kind === 'round') s.absarc(x, spring, r + band, Math.PI, 0, true);
  else {
    s.lineTo(x - r - band, spring + band);
    s.lineTo(x + r + band, spring + band);
  }
  s.lineTo(x + r + band, y0);
  s.lineTo(x + r, y0);
  s.lineTo(x + r, spring);
  if (kind === 'round') s.absarc(x, spring, r, 0, Math.PI, false);
  else s.lineTo(x - r, spring);
  s.lineTo(x - r, y0);
  s.lineTo(x - r - band, y0);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: ARC_SEG,
  });
  return g;
}

/**
 * Cornice modanata lungo x, aggettante verso +z.
 * profile: punti [sporgenza, altezza] dal basso verso l'alto (la parete è a sporgenza 0)
 */
export const PROFILE_CORNICE = [
  [0, 0],
  [0.05, 0],
  [0.05, 0.06],
  [0.11, 0.1],
  [0.16, 0.18],
  [0.24, 0.22],
  [0.24, 0.3],
  [0, 0.3],
];
export const PROFILE_SMALL = [
  [0, 0],
  [0.04, 0],
  [0.04, 0.05],
  [0.09, 0.09],
  [0.12, 0.14],
  [0.12, 0.18],
  [0, 0.18],
];

export function corniceGeometry(length, profile = PROFILE_CORNICE, scale = 1) {
  const s = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z * scale, y * scale)));
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false });
  g.rotateY(-Math.PI / 2);
  g.translate(length / 2, 0, 0);
  return g;
}

/** Gradini: count gradini dal basso, il primo a z = 0 e gli altri verso −z */
export function stepsGeometry({ width, count, rise, run, nosing = 0.03 }) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    // ogni gradino va dal suo spigolo (z = −run·i + nosing) fino al fondo della scala
    const depth = run * (count - i) + nosing;
    const b = new THREE.BoxGeometry(width, rise, depth);
    b.translate(0, rise * (i + 0.5), -run * i - depth / 2 + nosing);
    parts.push(b);
  }
  return mergeGeometries(parts);
}

/** Colonna tuscanica in cantera (base, fusto rastremato, capitello) */
export function columnGeometry(height, radius = 0.22) {
  const H = height;
  const r = radius;
  const pts = [
    [0, 0],
    [r * 1.45, 0],
    [r * 1.45, 0.1],
    [r * 1.3, 0.12],
    [r * 1.3, 0.2],
    [r * 1.12, 0.26],
    [r, 0.3],
  ];
  // fusto con leggera entasi
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    pts.push([r * (1 - 0.14 * Math.pow(t, 1.4) + 0.02 * Math.sin(Math.PI * t)), 0.3 + t * (H - 0.75)]);
  }
  pts.push(
    [r * 0.96, H - 0.4],
    [r * 1.02, H - 0.36],
    [r * 0.94, H - 0.32],
    [r * 1.25, H - 0.2],
    [r * 1.4, H - 0.18],
    [r * 1.4, H],
    [0, H],
  );
  const g = new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    24,
  );
  // abaco quadrato
  const abacus = new THREE.BoxGeometry(r * 3.1, 0.12, r * 3.1);
  abacus.translate(0, H + 0.06, 0);
  const plinth = new THREE.BoxGeometry(r * 3.2, 0.12, r * 3.2);
  plinth.translate(0, 0.06, 0);
  return mergeGeometries([g.toNonIndexed(), abacus.toNonIndexed(), plinth.toNonIndexed()]);
}

/**
 * "Copete": il cappello bianco sopra le finestre delle haciendas yucateche
 * (curvo ai lati e appuntito al centro) + il davanzale con pendaglio.
 * Restituisce { hood, sill } da posizionare sulla facciata.
 */
export function copeteGeometry(w, h = 0.75) {
  const s = new THREE.Shape();
  const W = w / 2 + 0.14;
  s.moveTo(-W, 0);
  s.lineTo(W, 0);
  s.quadraticCurveTo(W * 0.92, h * 0.55, W * 0.3, h * 0.78);
  s.quadraticCurveTo(0.06, h * 0.88, 0, h);
  s.quadraticCurveTo(-0.06, h * 0.88, -W * 0.3, h * 0.78);
  s.quadraticCurveTo(-W * 0.92, h * 0.55, -W, 0);
  const hood = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2, curveSegments: 16 });
  const p = new THREE.Shape();
  const S = w / 2 + 0.1;
  p.moveTo(-S, 0);
  p.lineTo(S, 0);
  p.lineTo(S, -0.08);
  p.quadraticCurveTo(S * 0.4, -0.12, 0.05, -0.32);
  p.lineTo(-0.05, -0.32);
  p.quadraticCurveTo(-S * 0.4, -0.12, -S, -0.08);
  p.lineTo(-S, 0);
  const sill = new THREE.ExtrudeGeometry(p, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.01, bevelSegments: 2, curveSegments: 12 });
  return { hood, sill };
}

/** Inferriata: barre verticali + due traversi, centrata in x, base a y = 0 */
export function grilleGeometry(w, h, bars = 7, r = 0.014) {
  const parts = [];
  for (let i = 0; i < bars; i++) {
    const x = -w / 2 + ((i + 0.5) / bars) * w;
    const c = new THREE.CylinderGeometry(r, r, h, 6);
    c.translate(x, h / 2, 0);
    parts.push(c);
  }
  for (const y of [h * 0.12, h * 0.88]) {
    const b = new THREE.BoxGeometry(w, 0.03, 0.025);
    b.translate(0, y, 0);
    parts.push(b);
  }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()));
}

/** Campana in bronzo (profilo classico) con il ceppo */
export function bellGeometry(height = 0.55) {
  const h = height;
  const pts = [
    [0.0, h],
    [0.12, h],
    [0.17, h * 0.92],
    [0.19, h * 0.7],
    [0.22, h * 0.45],
    [0.3, h * 0.18],
    [0.37, h * 0.05],
    [0.39, 0],
    [0.35, 0],
    [0.33, h * 0.05],
  ].map(([x, y]) => new THREE.Vector2(x * (h / 0.55), y));
  const g = new THREE.LatheGeometry(pts, 24);
  const yoke = new THREE.BoxGeometry(0.62 * (h / 0.55), 0.08, 0.1);
  yoke.translate(0, h + 0.06, 0);
  return mergeGeometries([g.toNonIndexed(), yoke.toNonIndexed()]);
}

/**
 * Lanterna da muro in ferro con vetri caldi.
 * Restituisce un Group (origine = punto d'attacco al muro, lanterna verso +z).
 */
export function createLantern(mats, scale = 1) {
  const g = new THREE.Group();
  const iron = mats.iron;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.32), iron);
  arm.position.set(0, 0.2, 0.16);
  const body = new THREE.Group();
  body.position.set(0, -0.05, 0.36);
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.34, 6, 1, true), iron);
  cage.material = iron;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.07, 0.3, 6), mats.glow);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.14, 6), iron);
  roof.position.y = 0.24;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), iron);
  finial.position.y = 0.33;
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 0.06, 6), iron);
  bottom.position.y = -0.2;
  // gabbia a barrette: si rende con una wireframe sottile sopra il vetro
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.1, 0.075, 0.31, 6)), new THREE.LineBasicMaterial({ color: '#141210' }));
  body.add(glass, roof, finial, bottom, frame);
  g.add(arm, body);
  g.scale.setScalar(scale);
  g.userData.lightOffset = new THREE.Vector3(0, -0.05, 0.36).multiplyScalar(scale);
  return g;
}

/**
 * Scritta dipinta a calce (lettere maiuscole serif) su un piano trasparente.
 * text: stringa; h: altezza delle lettere in metri. Restituisce una Mesh.
 */
export function paintedText(text, { h = 0.4, font = 'Cormorant Garamond', weight = 600, spacing = 0.12, color = '#f1eadf' } = {}) {
  const px = 128; // pixel per altezza lettera
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `${weight} ${px}px "${font}", "Times New Roman", serif`;
  const letters = [...text];
  const widths = letters.map((ch) => ctx.measureText(ch).width);
  const gap = px * spacing;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (letters.length - 1);
  c.width = Math.ceil(total + px * 0.4);
  c.height = Math.ceil(px * 1.35);
  ctx.font = `${weight} ${px}px "${font}", "Times New Roman", serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  let x = px * 0.2;
  letters.forEach((ch, i) => {
    ctx.fillText(ch, x, px * 1.05);
    x += widths[i] + gap;
  });
  // pittura a calce non perfetta: qualche punto più sottile
  const img = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 3; i < img.data.length; i += 4) {
    if (img.data[i] > 0 && Math.random() < 0.08) img.data[i] *= 0.7;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const w = (c.width / c.height) * h * 1.35;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    roughness: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h * 1.35), mat);
  mesh.userData.width = w;
  return mesh;
}

/** Utility: mesh con ombre e materiale (o array di materiali per i gruppi) */
export function mesh(geometry, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}
