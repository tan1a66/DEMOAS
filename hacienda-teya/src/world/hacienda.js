// ─────────────────────────────────────────────────────────────────────────────
//  Hacienda San Ildefonso Teya — modello procedurale (dalle foto del cliente)
//
//  - Portada d'ingresso: rojo almagre, due grandi archi bianchi, porticina
//    centrale, cornice, scritta "HACIENDA SAN ILDEFONSO TEYA" e "1683",
//    espadaña con volute e tre aperture, cancelli in ferro, lanterne,
//    cantonali in pietra.
//  - Muri perimetrali del cortile con coronamento bianco.
//  - Casa Principal (il ristorante): terrazza su basamento, scalinata in
//    pietra, loggia a tre archi su colonne, finestre con "copete" bianco e
//    inferriata, scritta, espadaña con tre campane in bronzo, lanterne.
//
//  Coordinate mondo: la strada corre lungo z verso −z; la portada guarda +z.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import {
  wallGeometry,
  archBandGeometry,
  corniceGeometry,
  stepsGeometry,
  columnGeometry,
  copeteGeometry,
  grilleGeometry,
  bellGeometry,
  createLantern,
  paintedText,
  mesh,
  PROFILE_SMALL,
} from './architecture.js';

// Pianta generale (metri)
export const SITE = {
  roadX: 3.0, // asse della strada (passa nell'arco di destra)
  gateZ: -58, // facciata della portada
  gateDepth: 1.2,
  courtMinX: -22,
  courtMaxX: 28,
  casaZ: -94, // facciata della Casa Principal
  terraceDepth: 5.5,
  terraceH: 1.6,
};
SITE.gateX = SITE.roadX - 3.9; // centro della portada
SITE.stairFrontZ = SITE.casaZ + SITE.terraceDepth + 9 * 0.36;

// ── Espadaña: profilo mistilineo con volute (base a y = 0, centrato in x) ─────
function espadanaGeometry({ halfBase, halfTop, height, voluteH, niches, depth }) {
  const s = new THREE.Shape();
  s.moveTo(-halfBase, 0);
  s.lineTo(halfBase, 0);
  // voluta concava destra
  s.quadraticCurveTo(halfTop + 0.15, 0.12, halfTop, voluteH);
  s.lineTo(halfTop, height);
  s.lineTo(-halfTop, height);
  s.lineTo(-halfTop, voluteH);
  s.quadraticCurveTo(-halfTop - 0.15, 0.12, -halfBase, 0);
  for (const n of niches) {
    const h = new THREE.Path();
    h.moveTo(n.x - n.w / 2, n.y0);
    h.lineTo(n.x + n.w / 2, n.y0);
    h.lineTo(n.x + n.w / 2, n.spring);
    h.absarc(n.x, n.spring, n.w / 2, 0, Math.PI, false);
    h.lineTo(n.x - n.w / 2, n.y0);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 32 });
  g.translate(0, 0, -depth);
  return g;
}

// coronamento in cima all'espadaña: piccolo frontone curvo + pinnacolo
function crownGeometry(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h * 0.55);
  s.quadraticCurveTo(w / 2, h, 0, h);
  s.quadraticCurveTo(-w / 2, h, -w / 2, h * 0.55);
  s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false, curveSegments: 16 });
  g.translate(0, 0, -0.5);
  return g;
}

function finialGeometry(scale = 1) {
  const pts = [
    [0, 0],
    [0.16, 0],
    [0.16, 0.06],
    [0.09, 0.1],
    [0.07, 0.2],
    [0.13, 0.3],
    [0.13, 0.36],
    [0.05, 0.42],
    [0.0, 0.52],
  ].map(([x, y]) => new THREE.Vector2(x * scale, y * scale));
  return new THREE.LatheGeometry(pts, 16);
}

// ── Portada ──────────────────────────────────────────────────────────────────
function buildGate(m) {
  const g = new THREE.Group();
  const D = SITE.gateDepth;
  const W = 16;
  const H = 6.6;
  const arches = [
    { x: -3.9, w: 4.4, spring: 3.1 },
    { x: 3.9, w: 4.4, spring: 3.1 },
  ];
  const door = { x: 0, w: 1.25, spring: 2.15 };
  g.add(mesh(wallGeometry({ width: W, height: H, depth: D, openings: [...arches, door] }), [m.plaster, m.cal]));

  // fasce bianche degli archi, davanti e dietro
  for (const side of [0, 1]) {
    const bands = new THREE.Group();
    for (const a of arches) bands.add(mesh(archBandGeometry({ ...a, band: 0.32 }), m.cal));
    bands.add(mesh(archBandGeometry({ ...door, band: 0.2 }), m.cal));
    if (side) {
      bands.rotation.y = Math.PI;
      bands.position.z = -D;
    }
    g.add(bands);
  }

  // cornice e zoccolo del coronamento
  for (const side of [0, 1]) {
    const c = mesh(corniceGeometry(W + 0.3, undefined, 1.05), m.cal);
    c.position.set(0, H - 0.02, side ? -D : 0);
    if (side) c.rotation.y = Math.PI;
    g.add(c);
  }
  const top = mesh(new THREE.BoxGeometry(W + 0.2, 0.3, D + 0.35), m.cal);
  top.position.set(0, H + 0.3, -D / 2);
  g.add(top);

  // espadaña centrale con volute e tre aperture
  const esp = mesh(
    espadanaGeometry({
      halfBase: 6.2,
      halfTop: 3.0,
      height: 3.0,
      voluteH: 1.55,
      depth: 0.7,
      niches: [-1.85, 0, 1.85].map((x) => ({ x, w: 0.82, y0: 1.0, spring: 2.0 })),
    }),
    [m.plaster, m.cal],
  );
  esp.position.set(0, H + 0.45, -0.25);
  g.add(esp);
  for (const x of [-1.85, 0, 1.85]) {
    const b = mesh(archBandGeometry({ x, w: 0.82, spring: 2.0, band: 0.12, y0: 1.0, thick: 0.03 }), m.cal);
    b.position.set(0, H + 0.45, -0.25);
    g.add(b);
  }
  const espCornice = mesh(corniceGeometry(6.4, PROFILE_SMALL), m.cal);
  espCornice.position.set(0, H + 0.45 + 3.0, -0.25);
  g.add(espCornice);
  const crown = mesh(crownGeometry(2.0, 0.85), [m.plaster, m.cal]);
  crown.position.set(0, H + 0.45 + 3.18, -0.35);
  g.add(crown);
  const fin = mesh(finialGeometry(1.1), m.cal);
  fin.position.set(0, H + 0.45 + 3.18 + 0.85, -0.6);
  g.add(fin);
  for (const x of [-3.0, 3.0]) {
    const f = mesh(finialGeometry(0.8), m.cal);
    f.position.set(x, H + 0.45 + 3.18, -0.6);
    g.add(f);
  }

  // scritta e data, dipinte a calce
  const name = paintedText('HACIENDA SAN ILDEFONSO TEYA', { h: 0.36, spacing: 0.16 });
  name.position.set(0, H - 0.62, 0.004);
  g.add(name);
  const year = paintedText('1683', { h: 0.34, spacing: 0.14 });
  year.position.set(0, 3.55, 0.004);
  g.add(year);

  // cancelli in ferro aperti contro le spallette interne degli archi
  for (const a of arches) {
    for (const side of [-1, 1]) {
      const leaf = mesh(grilleGeometry(2.0, 2.9, 11, 0.016), m.iron);
      leaf.rotation.y = side * Math.PI / 2;
      leaf.position.set(a.x + side * (a.w / 2 - 0.06), 0.05, -D - 1.0); // incernierato al filo interno
      g.add(leaf);
    }
  }

  // porticina in legno (chiusa) dentro il vano centrale
  const leaf = mesh(new THREE.BoxGeometry(door.w, door.spring + door.w / 2, 0.08), m.wood);
  leaf.position.set(0, (door.spring + door.w / 2) / 2, -D * 0.55);
  g.add(leaf);
  const step = mesh(new THREE.BoxGeometry(1.7, 0.12, 0.45), m.cantera);
  step.position.set(0, 0.06, 0.2);
  g.add(step);

  // cantonali in pietra sul pilastro di destra (come nella foto)
  let y = 0;
  let i = 0;
  while (y < H - 0.3) {
    const h = 0.34;
    const w = i % 2 ? 0.38 : 0.62;
    const b = mesh(new THREE.BoxGeometry(w, h - 0.025, 0.06), m.cantera);
    b.position.set(W / 2 - w / 2 + 0.02, y + h / 2, 0.02);
    g.add(b);
    const s = mesh(new THREE.BoxGeometry(0.06, h - 0.025, w * 0.9), m.cantera);
    s.position.set(W / 2 + 0.02, y + h / 2, -w * 0.45);
    g.add(s);
    y += h;
    i++;
  }

  // lanterne
  const lanterns = [];
  for (const [x, yy] of [
    [-1.05, 2.75],
    [1.05, 2.75],
    [7.1, 2.9],
  ]) {
    const l = createLantern(m, 1.15);
    l.position.set(x, yy, 0);
    g.add(l);
    lanterns.push(l);
  }

  g.position.set(SITE.gateX, 0, SITE.gateZ);
  return { group: g, lanterns };
}

// ── Muri perimetrali ─────────────────────────────────────────────────────────
function buildWalls(m) {
  const g = new THREE.Group();
  const H = 2.7;
  const D = 0.45;
  const addWall = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const w = mesh(wallGeometry({ width: len, height: H, depth: D }), [m.plaster, m.cal]);
    w.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    w.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    g.add(w);
    // coronamento bianco aggettante e lesene ogni 6 m
    const cap = mesh(new THREE.BoxGeometry(len + 0.1, 0.12, D + 0.12), m.cal);
    cap.position.set(0, H + 0.06, -D / 2);
    w.add(cap);
    for (let t = -len / 2 + 3; t < len / 2 - 1; t += 6) {
      const p = mesh(new THREE.BoxGeometry(0.42, H, 0.1), m.plaster);
      p.position.set(t, H / 2, 0.05);
      w.add(p);
    }
  };
  const gx0 = SITE.gateX - 8;
  const gx1 = SITE.gateX + 8;
  const z = SITE.gateZ - 0.4;
  addWall(SITE.courtMinX, z, gx0, z);
  addWall(gx1, z, SITE.courtMaxX, z);
  // lati del cortile (il muro guarda verso l'interno)
  addWall(SITE.courtMinX, z, SITE.courtMinX, SITE.casaZ - 6);
  addWall(SITE.courtMaxX, SITE.casaZ - 6, SITE.courtMaxX, z);
  return g;
}

// ── Casa Principal ───────────────────────────────────────────────────────────
function buildCasa(m) {
  const g = new THREE.Group();
  const T = SITE.terraceH;
  const TD = SITE.terraceDepth;
  const W = 26;
  const H = 6.6; // altezza della facciata sopra la terrazza
  const FD = 0.6;

  // basamento della terrazza: muro rosso con bordo bianco, piano in pietra
  const base = mesh(new THREE.BoxGeometry(W + 4, T, TD), m.plaster);
  base.position.set(0, T / 2, TD / 2);
  g.add(base);
  const deck = mesh(new THREE.BoxGeometry(W + 4.1, 0.08, TD + 0.1), m.cantera);
  deck.position.set(0, T + 0.04, TD / 2);
  g.add(deck);
  // parapetti bassi bianchi ai lati della scalinata
  for (const side of [-1, 1]) {
    const len = (W + 4) / 2 - 3.4;
    const para = mesh(new THREE.BoxGeometry(len, 0.42, 0.34), m.plaster);
    para.position.set(side * (3.4 + len / 2), T + 0.21, TD - 0.17);
    g.add(para);
    const cap = mesh(new THREE.BoxGeometry(len + 0.06, 0.08, 0.44), m.cal);
    cap.position.set(side * (3.4 + len / 2), T + 0.46, TD - 0.17);
    g.add(cap);
  }

  // scalinata in pietra con muretti laterali inclinati
  const steps = mesh(stepsGeometry({ width: 6.4, count: 9, rise: T / 9, run: 0.36 }), m.cantera);
  steps.position.set(0, 0, TD + 9 * 0.36);
  g.add(steps);
  for (const side of [-1, 1]) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(9 * 0.36 + 0.3, 0);
    s.lineTo(9 * 0.36 + 0.3, 0.55);
    s.lineTo(0, T + 0.5);
    s.lineTo(0, 0);
    const cheek = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.34, bevelEnabled: false }), [m.plaster, m.cal]);
    cheek.rotation.y = -Math.PI / 2;
    cheek.position.set(side * 3.37 + 0.17, 0, TD);
    g.add(cheek);
  }

  // facciata con loggia a tre archi e finestre
  const arches = [-3.4, 0, 3.4].map((x) => ({ x, w: 3.0, spring: 3.0 }));
  const windows = [-10.4, -7.0, 7.0, 10.4].map((x) => ({ x, w: 1.1, y0: 1.0, spring: 3.1, kind: 'rect' }));
  const facade = mesh(wallGeometry({ width: W, height: H, depth: FD, openings: [...arches, ...windows] }), [m.plaster, m.cal]);
  facade.position.y = T;
  g.add(facade);
  for (const a of arches) {
    const b = mesh(archBandGeometry({ ...a, band: 0.26 }), m.cal);
    b.position.y = T;
    g.add(b);
  }
  // colonne in pietra davanti ai pilastri tra gli archi
  for (const x of [-1.7, 1.7]) {
    const c = mesh(columnGeometry(3.0, 0.2), m.cantera);
    c.position.set(x, T, 0.05);
    g.add(c);
  }
  const cornice = mesh(corniceGeometry(W + 0.4), m.cal);
  cornice.position.set(0, T + H - 0.05, 0);
  g.add(cornice);
  const parapet = mesh(new THREE.BoxGeometry(W + 0.2, 0.5, FD + 0.1), m.plaster);
  parapet.position.set(0, T + H + 0.5, -FD / 2);
  g.add(parapet);
  const pcap = mesh(new THREE.BoxGeometry(W + 0.3, 0.08, FD + 0.2), m.cal);
  pcap.position.set(0, T + H + 0.79, -FD / 2);
  g.add(pcap);

  // finestre: copete, davanzale, inferriata, vetro caldo
  for (const w of windows) {
    const { hood, sill } = copeteGeometry(w.w);
    const hm = mesh(hood, m.cal);
    hm.position.set(w.x, T + w.spring + 0.08, 0);
    const sm = mesh(sill, m.cal);
    sm.position.set(w.x, T + w.y0 - 0.02, 0);
    const gr = mesh(grilleGeometry(w.w - 0.05, w.spring - w.y0, 6), m.iron);
    gr.position.set(w.x, T + w.y0, -0.12);
    const glass = mesh(new THREE.PlaneGeometry(w.w, w.spring - w.y0), m.glow, { cast: false });
    glass.position.set(w.x, T + (w.y0 + w.spring) / 2, -FD + 0.05);
    g.add(hm, sm, gr, glass);
  }

  // scritta su tre righe tra gli archi e la cornice (come nella foto)
  const lines = [
    ['HACIENDA', 0.3, 5.75],
    ['SAN ILDEFONSO TEYA', 0.3, 5.3],
    ['1683', 0.22, 4.9],
  ];
  for (const [txt, h, y] of lines) {
    const t = paintedText(txt, { h, spacing: 0.14 });
    t.position.set(0, T + y, 0.004);
    g.add(t);
  }

  // loggia: pareti interne bianche, soffitto a travi, portone e lampadario
  const LD = 3.4;
  const back = mesh(wallGeometry({ width: 10, height: H, depth: 0.4, openings: [{ x: 0, w: 1.7, spring: 2.6 }, { x: -3.3, w: 1.0, y0: 0.9, spring: 2.6, kind: 'rect' }, { x: 3.3, w: 1.0, y0: 0.9, spring: 2.6, kind: 'rect' }] }), [m.cal, m.cantera]);
  back.position.set(0, T, -LD);
  g.add(back);
  const portal = mesh(archBandGeometry({ x: 0, w: 1.7, spring: 2.6, band: 0.22 }), m.cantera);
  portal.position.set(0, T, -LD + 0.001);
  g.add(portal);
  const doorLeaf = mesh(new THREE.BoxGeometry(1.7, 3.45, 0.1), m.wood);
  doorLeaf.position.set(0, T + 1.72, -LD - 0.25);
  g.add(doorLeaf);
  for (const x of [-3.3, 3.3]) {
    const gl = mesh(new THREE.PlaneGeometry(1.0, 1.7), m.glow, { cast: false });
    gl.position.set(x, T + 1.75, -LD - 0.3);
    g.add(gl);
  }
  for (const side of [-1, 1]) {
    const sw = mesh(new THREE.BoxGeometry(0.3, H, LD), m.cal);
    sw.position.set(side * 5.05, T + H / 2, -LD / 2);
    g.add(sw);
  }
  const ceil = mesh(new THREE.BoxGeometry(10.4, 0.25, LD + 0.6), m.wood);
  ceil.position.set(0, T + H - 0.6, -LD / 2);
  g.add(ceil);
  for (let x = -4.6; x <= 4.6; x += 0.7) {
    const beam = mesh(new THREE.BoxGeometry(0.14, 0.2, LD + 0.4), m.wood);
    beam.position.set(x, T + H - 0.82, -LD / 2);
    g.add(beam);
  }
  const loggiaFloor = mesh(new THREE.BoxGeometry(10, 0.06, LD), m.cantera);
  loggiaFloor.position.set(0, T + 0.03, -LD / 2);
  g.add(loggiaFloor);
  // lampadario: anello in ferro con candele luminose
  const chandelier = new THREE.Group();
  chandelier.position.set(0, T + H - 2.0, -LD / 2);
  const ring = mesh(new THREE.TorusGeometry(0.42, 0.018, 6, 32), m.iron, { cast: false });
  ring.rotation.x = Math.PI / 2;
  chandelier.add(ring);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const c = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 6), m.glow, { cast: false });
    c.position.set(Math.cos(a) * 0.42, 0.08, Math.sin(a) * 0.42);
    chandelier.add(c);
  }
  const chain = mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.2, 4), m.iron, { cast: false });
  chain.position.y = 0.6;
  chandelier.add(chain);
  g.add(chandelier);

  // massa dell'edificio dietro la facciata (tetto piano)
  for (const side of [-1, 1]) {
    const wing = mesh(new THREE.BoxGeometry(8, H + 0.4, 9.4), m.plaster);
    wing.position.set(side * 9, T + (H + 0.4) / 2, -FD - 4.7);
    g.add(wing);
  }
  const core = mesh(new THREE.BoxGeometry(10, H + 0.4, 6), m.plaster);
  core.position.set(0, T + (H + 0.4) / 2, -LD - 3.4);
  g.add(core);

  // espadaña con tre campane
  const espBase = T + H + 0.83;
  const esp = mesh(
    espadanaGeometry({
      halfBase: 4.4,
      halfTop: 2.3,
      height: 2.9,
      voluteH: 1.4,
      depth: 0.55,
      niches: [-1.35, 0, 1.35].map((x) => ({ x, w: 0.72, y0: 0.75, spring: 1.95 })),
    }),
    [m.plaster, m.cal],
  );
  esp.position.set(0, espBase, -0.1);
  g.add(esp);
  for (const x of [-1.35, 0, 1.35]) {
    const band = mesh(archBandGeometry({ x, w: 0.72, spring: 1.95, band: 0.1, y0: 0.75, thick: 0.03 }), m.cal);
    band.position.set(0, espBase, -0.1);
    g.add(band);
    const bell = mesh(bellGeometry(0.5), m.bronze);
    bell.position.set(x, espBase + 1.55, -0.38);
    g.add(bell);
    const beam = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 6), m.iron);
    beam.rotation.z = Math.PI / 2;
    beam.position.set(x, espBase + 2.2, -0.38);
    g.add(beam);
  }
  const ec = mesh(corniceGeometry(4.8, PROFILE_SMALL), m.cal);
  ec.position.set(0, espBase + 2.9, -0.1);
  g.add(ec);
  const crown = mesh(crownGeometry(1.5, 0.7), [m.plaster, m.cal]);
  crown.position.set(0, espBase + 3.08, -0.15);
  g.add(crown);
  const fin = mesh(finialGeometry(0.9), m.cal);
  fin.position.set(0, espBase + 3.78, -0.4);
  g.add(fin);

  // lanterne in facciata
  const lanterns = [];
  for (const x of [-5.4, 5.4]) {
    const l = createLantern(m, 1.1);
    l.position.set(x, T + 2.7, 0);
    g.add(l);
    lanterns.push(l);
  }

  g.position.set(SITE.roadX, 0, SITE.casaZ);
  return {
    group: g,
    lanterns,
    chandelierWorld: new THREE.Vector3(SITE.roadX, T + H - 2.1, SITE.casaZ - LD / 2),
  };
}

export function buildHacienda(materials) {
  const group = new THREE.Group();
  const gate = buildGate(materials);
  const walls = buildWalls(materials);
  const casa = buildCasa(materials);
  group.add(gate.group, walls, casa.group);
  return {
    group,
    lanterns: [...gate.lanterns, ...casa.lanterns],
    chandelier: casa.chandelierWorld,
  };
}
