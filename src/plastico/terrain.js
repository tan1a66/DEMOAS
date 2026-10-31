import { BufferAttribute, BufferGeometry, Color } from 'three';

/*
  Terreno del plastico a strati, come un modello d'architetto in cartone/sughero tagliato a curve
  di livello. La quota naturale viene da site.terrain (profilo ovest→est, salita a nord e a sud),
  poi le "platforms" scavano o riempiono: terrazza e piscina del livello mare, rampa del passaggio
  lungo il lato sud, quota strada a nord.
  Ogni strato è la regione {h >= L} estrusa per lo spessore dello strato; i bordi vengono da
  marching squares (contorni lisci, non a gradini di griglia).
*/

export function heightFn(site) {
  const t = site.terrain;
  const prof = t.profile;
  const natural = (x, z) => {
    let h = prof[0][1];
    for (let i = 0; i < prof.length - 1; i++) {
      const [x0, h0] = prof[i];
      const [x1, h1] = prof[i + 1];
      if (x >= x0 && x <= x1) { h = h0 + ((x - x0) / (x1 - x0)) * (h1 - h0); break; }
      if (x > x1) h = h1;
    }
    h += t.northRise * Math.max(0, -3.4 - z);
    h += t.southRise * Math.max(0, z - 14.6);
    // leggera ondulazione, perché non sembri un piano inclinato
    h += 0.35 * Math.sin(x * 0.17 + z * 0.11) * Math.min(1, Math.max(0, (-6 - x) / 10));
    return h;
  };
  return (x, z) => {
    let h = natural(x, z);
    for (const p of t.platforms) {
      const [x0, z0, x1, z1] = p.rect;
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      if (p.ramp) {
        const [ax, ah, bx, bh] = p.ramp;
        h = ah + ((Math.min(Math.max(x, ax), bx) - ax) / (bx - ax)) * (bh - ah);
      } else {
        h = p.h;
      }
    }
    return h;
  };
}

export function buildTerrain(site) {
  const t = site.terrain;
  const [xmin, zmin, xmax, zmax] = site.bounds;
  const cell = t.cell;
  const layer = t.layer;
  const nx = Math.round((xmax - xmin) / cell);
  const nz = Math.round((zmax - zmin) / cell);
  const h = heightFn(site);

  // Griglia con un anello esterno "infinitamente basso" nella stessa posizione del bordo:
  // così i lati del plastico mostrano gli strati.
  const W = nx + 3;
  const D = nz + 3;
  const X = new Float32Array(W);
  const Z = new Float32Array(D);
  for (let i = 0; i < W; i++) X[i] = xmin + Math.min(nx, Math.max(0, i - 1)) * cell;
  for (let j = 0; j < D; j++) Z[j] = zmin + Math.min(nz, Math.max(0, j - 1)) * cell;
  const H = new Float32Array(W * D);
  let maxH = -Infinity;
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) {
      const inside = i > 0 && i < W - 1 && j > 0 && j < D - 1;
      const v = inside ? h(X[i], Z[j]) : -1e6;
      H[j * W + i] = v;
      if (inside) maxH = Math.max(maxH, v);
    }
  }

  const pos = [];
  const nor = [];
  const col = [];
  const top = new Color();
  const side = new Color();
  const cTop = new Color('#e8dcc6');
  const cHigh = new Color('#efe5d3');
  const cSide = new Color('#c7ab83');

  const pushV = (x, y, z, nxv, nyv, nzv, c) => {
    pos.push(x, y, z); nor.push(nxv, nyv, nzv); col.push(c.r, c.g, c.b);
  };

  const levels = [];
  for (let L = t.base + layer; L <= maxH + 1e-6; L += layer) levels.push(Math.round(L * 1000) / 1000);

  const lerp = (a, b, va, vb, L) => {
    const k = Math.min(1, Math.max(0, (L - va) / (vb - va || 1e-9)));
    return a + (b - a) * k;
  };

  for (const L of levels) {
    const f = Math.min(1, Math.max(0, (L - t.base) / (maxH - t.base)));
    top.copy(cTop).lerp(cHigh, f * 0.6);
    side.copy(cSide);
    const yb = L - layer;
    for (let j = 0; j < D - 1; j++) {
      for (let i = 0; i < W - 1; i++) {
        const va = H[j * W + i];
        const vb = H[j * W + i + 1];
        const vc = H[(j + 1) * W + i + 1];
        const vd = H[(j + 1) * W + i];
        const ia = va >= L; const ib = vb >= L; const ic = vc >= L; const id = vd >= L;
        if (!ia && !ib && !ic && !id) continue;
        const x0 = X[i]; const x1 = X[i + 1]; const z0 = Z[j]; const z1 = Z[j + 1];
        const coveredAbove = va >= L + layer && vb >= L + layer && vc >= L + layer && vd >= L + layer;

        // Poligono {h >= L} nella cella, girando a → b → c → d.
        const corners = [
          [x0, z0, va, ia], [x1, z0, vb, ib], [x1, z1, vc, ic], [x0, z1, vd, id],
        ];
        const poly = [];
        const cross = [];
        for (let k = 0; k < 4; k++) {
          const p = corners[k];
          const q = corners[(k + 1) % 4];
          if (p[3]) poly.push([p[0], p[1]]);
          if (p[3] !== q[3]) {
            const pt = [lerp(p[0], q[0], p[2], q[2], L), lerp(p[1], q[1], p[2], q[2], L)];
            poly.push(pt);
            cross.push({ pt });
          }
        }

        // Faccia superiore (solo se non coperta dallo strato sopra), rivolta verso l'alto.
        if (!coveredAbove && poly.length >= 3 && x0 !== x1 && z0 !== z1) {
          for (let k = 1; k < poly.length - 1; k++) {
            const A = poly[0]; let B = poly[k]; let C = poly[k + 1];
            // (B-A)×(C-A) deve avere y > 0
            const cy = (B[1] - A[1]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[1] - A[1]);
            if (cy < 0) [B, C] = [C, B];
            pushV(A[0], L, A[1], 0, 1, 0, top);
            pushV(B[0], L, B[1], 0, 1, 0, top);
            pushV(C[0], L, C[1], 0, 1, 0, top);
          }
        }

        // Pareti verticali lungo i segmenti di livello (da L - strato a L).
        if (cross.length >= 2) {
          // Verso esterno = verso in cui la quota scende (gradiente della cella).
          const gx = (vb - va + vc - vd);
          const gz = (vd - va + vc - vb);
          for (let k = 0; k + 1 < cross.length; k += 2) {
            const [ax, az] = cross[k].pt;
            const [bx, bz] = cross[k + 1].pt;
            const dx = bx - ax;
            const dz = bz - az;
            const len = Math.hypot(dx, dz);
            if (len < 1e-6) continue;
            let nxv = -dz / len;
            let nzv = dx / len;
            if (nxv * gx + nzv * gz > 0) { nxv = -nxv; nzv = -nzv; }
            let P0 = [ax, yb, az]; let P1 = [bx, yb, bz]; const P2 = [bx, L, bz]; const P3 = [ax, L, az];
            // (P1-P0)×(P2-P0) deve puntare verso l'esterno
            const ux = P1[0] - P0[0]; const uz = P1[2] - P0[2];
            const vx = P2[0] - P0[0]; const vy = P2[1] - P0[1]; const vz = P2[2] - P0[2];
            const cx = 0 * vz - uz * vy; const cz = ux * vy - 0 * vx;
            const tri = (cx * nxv + cz * nzv) >= 0 ? [P0, P1, P2, P0, P2, P3] : [P1, P0, P3, P1, P3, P2];
            for (const p of tri) pushV(p[0], p[1], p[2], nxv, 0, nzv, side);
          }
        }
      }
    }
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeBoundingSphere();
  return g;
}
