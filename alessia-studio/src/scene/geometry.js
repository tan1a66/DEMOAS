import * as THREE from 'three';

// Costruttore di geometrie architettoniche: facce piane (anche con fori) e nastri estrusi.
// Ogni faccia è un "chart" con coordinate 2D in metri (uv), base per texture e lightmap.

// Assi di un piano: natural = coordinate mondo del piano (z: X,Y · x: Z,Y · y: X,Z)
function frameFor(axis, sign, coord) {
  switch (axis) {
    case 'z':
      return { o: [0, 0, coord], U: [sign, 0, 0], V: [0, 1, 0], su: sign, sv: 1 };
    case 'x':
      return { o: [coord, 0, 0], U: [0, 0, -sign], V: [0, 1, 0], su: -sign, sv: 1 };
    default:
      return { o: [0, coord, 0], U: [1, 0, 0], V: [0, 0, -sign], su: 1, sv: -sign };
  }
}

export class GeoBuilder {
  // density: densità relativa dei texel della lightmap per le facce di questo gruppo
  constructor(density = 1) {
    this.density = density;
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.idx = [];
    this.charts = [];
  }

  get vertexCount() {
    return this.pos.length / 3;
  }

  // Faccia piana perpendicolare a un asse. outer/holes in coordinate "naturali" del piano.
  face(axis, sign, coord, outer, holes = [], opts = {}) {
    const f = frameFor(axis, sign, coord);
    const map = (p) => [p[0] * f.su, p[1] * f.sv];
    this.planar({ o: f.o, u: f.U, v: f.V, outer: outer.map(map), holes: holes.map((h) => h.map(map)), ...opts });
  }

  planar({ o, u, v, outer, holes = [], uvOffset = [0, 0], density = this.density }) {
    const O = new THREE.Vector3(...o);
    const U = new THREE.Vector3(...u);
    const V = new THREE.Vector3(...v);
    const N = new THREE.Vector3().crossVectors(U, V).normalize();
    const contour = outer.map((p) => new THREE.Vector2(p[0], p[1]));
    const hs = holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1])));
    const tris = THREE.ShapeUtils.triangulateShape(contour, hs);
    const pts = contour.concat(...hs);
    const base = this.vertexCount;
    const idxStart = this.idx.length;
    const P = new THREE.Vector3();
    for (const p of pts) {
      P.copy(O).addScaledVector(U, p.x).addScaledVector(V, p.y);
      this.pos.push(P.x, P.y, P.z);
      this.nor.push(N.x, N.y, N.z);
      this.uv.push(p.x + uvOffset[0], p.y + uvOffset[1]);
    }
    for (const [a, b, c] of tris) {
      const pa = pts[a], pb = pts[b], pc = pts[c];
      const area = (pb.x - pa.x) * (pc.y - pa.y) - (pc.x - pa.x) * (pb.y - pa.y);
      if (Math.abs(area) < 1e-10) continue;
      if (area > 0) this.idx.push(base + a, base + b, base + c);
      else this.idx.push(base + a, base + c, base + b);
    }
    this.charts.push({ start: base, count: pts.length, idxStart: idxStart, idxEnd: this.idx.length, density });
  }

  // Nastro: una polilinea (punti + normali) estrusa lungo `ext`. uv = (ascissa curvilinea, distanza lungo ext).
  strip({ points, normals, ext, closed = false, uvOffset = [0, 0], density = this.density }) {
    const E = new THREE.Vector3(...ext);
    const h = E.length();
    const pts = points.map((p) => new THREE.Vector3(...p));
    const ns = normals.map((n) => new THREE.Vector3(...n).normalize());
    if (closed) {
      pts.push(pts[0].clone());
      ns.push(ns[0].clone());
    }
    const base = this.vertexCount;
    const idxStart = this.idx.length;
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) s += pts[i].distanceTo(pts[i - 1]);
      const p = pts[i], n = ns[i];
      this.pos.push(p.x, p.y, p.z, p.x + E.x, p.y + E.y, p.z + E.z);
      this.nor.push(n.x, n.y, n.z, n.x, n.y, n.z);
      this.uv.push(s + uvOffset[0], uvOffset[1], s + uvOffset[0], h + uvOffset[1]);
    }
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), gn = new THREE.Vector3();
    for (let i = 0; i < pts.length - 1; i++) {
      const b0 = base + 2 * i, t0 = b0 + 1, b1 = b0 + 2, t1 = b0 + 3;
      e1.subVectors(pts[i + 1], pts[i]);
      e2.copy(E);
      gn.crossVectors(e1, e2);
      const n = ns[i].clone().add(ns[i + 1]);
      if (gn.dot(n) >= 0) this.idx.push(b0, b1, t1, b0, t1, t0);
      else this.idx.push(b0, t1, b1, b0, t0, t1);
    }
    this.charts.push({ start: base, count: pts.length * 2, idxStart, idxEnd: this.idx.length, density });
  }

  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    g.userData.charts = this.charts;
    return g;
  }
}

// ---- Profili 2D ----

export function rect(x0, y0, x1, y1) {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

export function circle(cx, cy, r, n, start = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

// Quadrato con angoli arrotondati (antiorario), con normali uscenti.
export function roundedSquare(cx, cy, half, r, segs) {
  const pts = [];
  const nor = [];
  const c = half - r;
  const corners = [
    [c, c, 0],
    [-c, c, Math.PI / 2],
    [-c, -c, Math.PI],
    [c, -c, (3 * Math.PI) / 2],
  ];
  for (const [ox, oy, a0] of corners) {
    for (let i = 0; i <= segs; i++) {
      const a = a0 + (i / segs) * (Math.PI / 2);
      const nx = Math.cos(a), ny = Math.sin(a);
      pts.push([cx + ox + nx * r, cy + oy + ny * r]);
      nor.push([nx, ny]);
    }
  }
  return { pts, nor };
}
