import {
  BoxGeometry, Color, CylinderGeometry, ExtrudeGeometry, Group, InstancedMesh, Matrix4, Mesh, SphereGeometry,
  PlaneGeometry, Quaternion, Shape, Vector3, Euler,
} from 'three';
import { buildTerrain, heightFn } from './terrain.js';

/*
  Costruisce il modello esterno da villa.json: livelli (contorno, pareti, vuoti), parti (solai, sbalzi,
  torre in pietra…), scale, parapetti, frangisole, luci lineari, terreno, terrazza, deck, piscina,
  arredi, macchia mediterranea e luci del giardino. Unità: metri.
  Ogni mesh porta userData.level per la vista in sezione.
*/

const THICK = { stone: 0.35, solid: 0.35, glass: 0.06, door: 0.08, louvers: 0.05, parapet: 0.15 };

function shapeOf(poly) {
  // Il piano dello Shape è (x, -z): dopo la rotazione l'estrusione va verso +y.
  const s = new Shape();
  poly.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  return s;
}

export function prism(poly, y0, y1, material, holes = [], sideMaterial = null) {
  const shape = shapeOf(poly);
  holes.forEach((h) => shape.holes.push(shapeOf(h)));
  const g = new ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  // gruppi di ExtrudeGeometry: 0 = facce sopra/sotto, 1 = lati
  const m = new Mesh(g, sideMaterial ? [material, sideMaterial] : material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Trave/lastra tra due punti in pianta, con spessore t e quote y0..y1. */
function strip([ax, az], [bx, bz], t, y0, y1, material) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  const nx = (-dz / len) * (t / 2);
  const nz = (dx / len) * (t / 2);
  return prism([[ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz]], y0, y1, material);
}

function along([ax, az], [bx, bz], d) {
  const len = Math.hypot(bx - ax, bz - az);
  return [ax + ((bx - ax) * d) / len, az + ((bz - az) * d) / len];
}

function wall(w, y0, y1, M, group) {
  const len = Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1]);
  const add = (mesh) => { mesh.userData.wall = w.type; mesh.userData.interior = !!w.interior; group.add(mesh); return mesh; };

  if (w.type === 'glass') {
    const pane = add(strip(w.from, w.to, THICK.glass, y0 + 0.04, y1 - 0.04, M.glass));
    pane.castShadow = false;
    pane.renderOrder = 2;
    // telaio: traversi in basso e in alto, montanti ogni ~1,6 m
    add(strip(w.from, w.to, 0.1, y0, y0 + 0.05, M.frame));
    add(strip(w.from, w.to, 0.1, y1 - 0.06, y1, M.frame));
    const n = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i <= n; i++) {
      const c = along(w.from, w.to, (len * i) / n);
      const a = along(w.from, w.to, Math.max(0, (len * i) / n - 0.035));
      const b = along(w.from, w.to, Math.min(len, (len * i) / n + 0.035));
      if (c) add(strip(a, b, 0.12, y0, y1, M.frame));
    }
    return;
  }
  if (w.type === 'louvers') {
    const n = Math.round(len / 0.16);
    for (let i = 0; i <= n; i++) {
      const a = along(w.from, w.to, Math.max(0, (len * i) / n - 0.025));
      const b = along(w.from, w.to, Math.min(len, (len * i) / n + 0.025));
      add(strip(a, b, 0.14, y0, y1, M.slats));
    }
    return;
  }
  if (w.type === 'parapet') {
    add(strip(w.from, w.to, THICK.parapet, y0, y0 + 1.0, M.parapet));
    return;
  }
  const mat = w.type === 'door' ? M.door : (M[w.type] || M.solid);
  const t = THICK[w.type] || 0.35;
  const openings = (w.openings || []).slice().sort((a, b) => a[0] - b[0]);
  let cursor = 0;
  for (const [s, e, sill, head] of openings) {
    if (s > cursor) add(strip(along(w.from, w.to, cursor), along(w.from, w.to, s), t, y0, y1, mat));
    const a = along(w.from, w.to, s);
    const b = along(w.from, w.to, e);
    add(strip(a, b, t, y0, y0 + sill, mat));
    add(strip(a, b, t, y0 + head, y1, mat));
    // finestra profonda: vetro scuro arretrato con telaio nero (come nella foto del muro in pietra)
    const g = add(strip(a, b, 0.05, y0 + sill, y0 + head, M.glass));
    g.castShadow = false;
    add(strip(a, b, t + 0.06, y0 + sill - 0.05, y0 + sill, M.frame));
    cursor = e;
  }
  if (cursor < len) add(strip(along(w.from, w.to, cursor), w.to, t, y0, y1, mat));
}

function railing(r, M, group) {
  const pts = r.path;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    [r.h, r.h * 0.62, r.h * 0.3].forEach((hh, k) => {
      group.add(strip(a, b, 0.035, r.y + hh - (k ? 0.02 : 0.04), r.y + hh, M.railing));
    });
    const n = Math.max(1, Math.round(len / 1.5));
    for (let k = 0; k <= n; k++) {
      const c = along(a, b, (len * k) / n);
      const p = prism([[c[0] - 0.02, c[1] - 0.02], [c[0] + 0.02, c[1] - 0.02], [c[0] + 0.02, c[1] + 0.02], [c[0] - 0.02, c[1] + 0.02]], r.y, r.y + r.h, M.railing);
      p.castShadow = false;
      group.add(p);
    }
  }
}

function stairs(s, M, group) {
  const [x0, z0] = s.from;
  const [x1, z1] = s.to;
  const run = (x1 - x0) / s.steps;
  const riser = s.rise / s.steps;
  for (let i = 0; i < s.steps; i++) {
    const xa = x0 + i * run;
    const y = (i + 1) * riser;
    const tread = prism([[xa, z0], [xa + run + 0.02, z0], [xa + run + 0.02, z1], [xa, z1]], y - 0.05, y, M.slats);
    tread.userData.stairs = true;
    group.add(tread);
  }
  // cosciali in acciaio nero
  const len = Math.hypot(x1 - x0, s.rise);
  const ang = Math.atan2(s.rise, x1 - x0);
  [z0, z1].forEach((z) => {
    const g = new BoxGeometry(len, 0.28, 0.04);
    const m = new Mesh(g, M.frame);
    m.position.set((x0 + x1) / 2, s.rise / 2 - 0.1, z);
    m.rotation.z = ang;
    m.castShadow = true;
    m.userData.stairs = true;
    group.add(m);
  });
}

function line(from, to, thickness, material) {
  const a = new Vector3(...from);
  const b = new Vector3(...to);
  const len = a.distanceTo(b);
  const m = new Mesh(new BoxGeometry(len, thickness, thickness), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), b.clone().sub(a).normalize());
  return m;
}

export function buildPlastico(data, M) {
  const root = new Group();
  root.name = 'plastico';
  const tag = (obj, level) => { obj.traverse((o) => { o.userData.level = level; }); return obj; };

  // Livelli: pavimento, pareti, vuoti
  for (const lv of data.levels) {
    const g = new Group();
    g.name = lv.id;
    const y0 = lv.elevation;
    const y1 = lv.elevation + lv.wallHeight;
    if (lv.elevation === 0) g.add(prism(lv.outline, -0.3, 0.0, M.interior, lv.voids || [], M.anthracite));
    for (const w of lv.walls) wall(w, y0, y1, M, g);
    root.add(tag(g, lv.id));
  }

  // Parti: solai, sbalzi, torre in pietra, cucina esterna, interni illuminati…
  for (const p of data.parts) {
    let obj;
    if (p.prism) obj = prism(p.prism, p.y[0], p.y[1], M[p.mat], p.holes || [], p.matSide ? M[p.matSide] : null);
    if (p.glow) {
      const [[ax, az], [bx, bz]] = p.glow;
      const len = Math.hypot(bx - ax, bz - az);
      obj = new Mesh(new PlaneGeometry(len, p.y[1] - p.y[0]), M.glow);
      obj.position.set((ax + bx) / 2, (p.y[0] + p.y[1]) / 2, (az + bz) / 2);
      obj.rotation.y = Math.atan2(-(bz - az), bx - ax);
      obj.userData.glow = true;
    }
    if (!obj) continue;
    obj.name = p.id;
    root.add(tag(obj, p.level));
  }

  const stairGroup = new Group();
  stairs(data.stairs3d, M, stairGroup);
  root.add(tag(stairGroup, data.stairs3d.level));

  const rails = new Group();
  data.railings.forEach((r) => railing(r, M, rails));
  root.add(tag(rails, 'cubierta'));

  // Frangisole in doghe sotto lo sbalzo della copertura
  const pg = data.pergola;
  const nSlats = Math.floor((pg.x[1] - pg.x[0]) / pg.pitch);
  const slat = new BoxGeometry(pg.width, pg.y[1] - pg.y[0], pg.z[1] - pg.z[0]);
  const slats = new InstancedMesh(slat, M[pg.mat], nSlats);
  const mtx = new Matrix4();
  for (let i = 0; i < nSlats; i++) {
    mtx.makeTranslation(pg.x[0] + pg.pitch * (i + 0.5), (pg.y[0] + pg.y[1]) / 2, (pg.z[0] + pg.z[1]) / 2);
    slats.setMatrixAt(i, mtx);
  }
  slats.castShadow = true;
  slats.receiveShadow = true;
  root.add(tag(slats, 'cubierta'));

  // Luci lineari calde e faretti
  const lights = new Group();
  data.leds.forEach((l) => lights.add(line(l.from, l.to, 0.035, M.led)));
  data.spots.forEach(([x, y, z]) => {
    const s = new Mesh(new CylinderGeometry(0.07, 0.07, 0.02, 12), M.led);
    s.position.set(x, y, z);
    lights.add(s);
  });
  root.add(tag(lights, 'luces'));

  // Sito: terreno continuo, terrazza, deck, piscina, passi, arredi
  const site = data.site;
  const terrain = new Mesh(buildTerrain(site), M.terrain);
  terrain.receiveShadow = true;
  terrain.name = 'terreno';
  root.add(tag(terrain, 'sitio'));

  const ext = new Group();
  ext.add(prism(site.terrace, 0, 0.04, M.slate));
  site.deck.forEach((d) => ext.add(prism(d, 0, 0.07, M.wood)));
  site.pool.forEach((p) => {
    const w = prism(p.poly, p.y[0], p.y[1], M.water);
    w.castShadow = false;
    w.name = 'agua';
    ext.add(w);
  });
  site.stones.forEach(([cx, z0, w, len]) => ext.add(prism([[cx - w / 2, z0], [cx + w / 2, z0], [cx + w / 2, z0 + len], [cx - w / 2, z0 + len]], -0.06, 0.03, M.stepStone)));
  site.furniture.forEach(({ box: [cx, cz, w, d, h] }) => ext.add(prism([[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]], 0.07, 0.07 + h, M.furniture)));
  root.add(tag(ext, 'sitio'));

  // Scala esterna in legno lungo il muro in pietra sul lato strada (video del drone, prospetto A)
  if (data.stairsExt) {
    const se = data.stairsExt;
    const g = new Group();
    const dz = (se.z[1] - se.z[0]) / se.steps;
    const dy = (se.y[1] - se.y[0]) / se.steps;
    for (let i = 0; i < se.steps; i++) {
      const za = se.z[0] + dz * i;
      const y = se.y[0] + dy * (i + 1);
      g.add(prism([[se.x[0], za], [se.x[1], za], [se.x[1], za + dz], [se.x[0], za + dz]], y - 0.06, y, M[se.mat] || M.wood));
    }
    root.add(tag(g, 'sitio'));
  }

  // Macchia mediterranea: cespugli scuri dalla forma irregolare (sfere deformate), sparsi sul versante
  const h = heightFn(site);
  const bush = new SphereGeometry(1, 18, 12);
  const bp = bush.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i); const y = bp.getY(i); const z = bp.getZ(i);
    const n = 1 + 0.18 * Math.sin(x * 5.1 + y * 3.3) * Math.cos(z * 4.7 - y * 2.1) + 0.1 * Math.sin(z * 9.3 + x * 7.7);
    bp.setXYZ(i, x * n, Math.max(-0.35, y) * n * 0.72, z * n);
  }
  bush.computeVertexNormals();
  const shrubs = new InstancedMesh(bush, M.shrub, site.shrubs.length);
  const q = new Quaternion();
  site.shrubs.forEach(([x, z, sz], i) => {
    q.setFromEuler(new Euler(0, i * 2.39, 0));
    mtx.compose(new Vector3(x, h(x, z) + sz * 0.22, z), q, new Vector3(sz * (0.9 + (i % 3) * 0.12), sz, sz * (1.1 - (i % 4) * 0.07)));
    shrubs.setMatrixAt(i, mtx);
  });
  shrubs.castShadow = true;
  shrubs.receiveShadow = true;
  root.add(tag(shrubs, 'sitio'));

  // Luci del giardino: uniform per lo shader dei materiali + teste luminose visibili (bagliore)
  const lampsU = M.lamps;
  const heads = [];
  data.lamps.slice(0, lampsU.uLampPos.value.length).forEach((l, i) => {
    let [x, y, z] = l.p;
    if (l.head === 'spike' || l.head === 'up') y += h(x, z) > y && Math.abs(h(x, z) - y) < 4 ? h(x, z) - y : 0;
    const c = new Color(l.c);
    lampsU.uLampPos.value[i].set(x, y + (l.head === 'up' ? 0.25 : 0.15), z, l.r);
    lampsU.uLampCol.value[i].set(c.r * l.i, c.g * l.i, c.b * l.i, l.s || 1);
    if (l.head) heads.push([x, y, z, l.head]);
  });
  lampsU.uLampCount.value = Math.min(data.lamps.length, lampsU.uLampPos.value.length);
  const headGeo = new SphereGeometry(0.055, 10, 6);
  const headMesh = new InstancedMesh(headGeo, M.lampHead, heads.length);
  heads.forEach(([x, y, z, type], i) => {
    const sy = type === 'roof' ? 0.5 : 1;
    mtx.compose(new Vector3(x, y + (type === 'roof' ? 0.0 : 0.08), z), new Quaternion(), new Vector3(1, sy, 1));
    headMesh.setMatrixAt(i, mtx);
  });
  root.add(tag(headMesh, 'luces'));

  return root;
}
