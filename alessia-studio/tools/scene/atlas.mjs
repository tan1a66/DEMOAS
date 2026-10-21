// Atlante della lightmap: ogni faccia (chart) ha già coordinate 2D in metri (attributo uv);
// le impacchettiamo a scaffali con una densità comune, poi rasterizziamo i texel.

export function packAtlas(groups, size, pad = 3) {
  const charts = [];
  for (const g of groups) {
    const uv = g.geometry.attributes.uv.array;
    g.geometry.userData.charts.forEach((c, ci) => {
      let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
      for (let i = c.start; i < c.start + c.count; i++) {
        u0 = Math.min(u0, uv[i * 2]); u1 = Math.max(u1, uv[i * 2]);
        v0 = Math.min(v0, uv[i * 2 + 1]); v1 = Math.max(v1, uv[i * 2 + 1]);
      }
      charts.push({ g, c, ci, u0, v0, w: u1 - u0, h: v1 - v0 });
    });
  }

  function tryPack(scale) {
    const rects = charts.map((ch) => ({
      ch,
      tw: Math.max(2, Math.ceil(ch.w * scale * ch.c.density)) + 2 * pad,
      th: Math.max(2, Math.ceil(ch.h * scale * ch.c.density)) + 2 * pad,
    }));
    if (rects.some((r) => r.tw > size || r.th > size)) return null;
    rects.sort((a, b) => b.th - a.th || b.tw - a.tw);
    let x = 0, y = 0, shelf = 0;
    for (const r of rects) {
      if (x + r.tw > size) {
        y += shelf;
        x = 0;
        shelf = 0;
      }
      r.x = x;
      r.y = y;
      x += r.tw;
      shelf = Math.max(shelf, r.th);
    }
    if (y + shelf > size) return null;
    return rects;
  }

  let lo = 1, hi = 400, best = null;
  for (let it = 0; it < 30; it++) {
    const mid = (lo + hi) / 2;
    const r = tryPack(mid);
    if (r) { best = { scale: mid, rects: r }; lo = mid; } else hi = mid;
  }
  const { scale, rects } = best;

  const uv1 = new Map(groups.map((g) => [g.name, new Float32Array(g.geometry.attributes.uv.count * 2)]));
  for (const r of rects) {
    const { g, c, u0, v0 } = r.ch;
    const s = scale * c.density;
    const uv = g.geometry.attributes.uv.array;
    const out = uv1.get(g.name);
    for (let i = c.start; i < c.start + c.count; i++) {
      out[i * 2] = (r.x + pad + (uv[i * 2] - u0) * s) / size;
      out[i * 2 + 1] = (r.y + pad + (uv[i * 2 + 1] - v0) * s) / size;
    }
  }
  let used = 0;
  for (const r of rects) used += r.tw * r.th;
  return { scale, rects, uv1, fill: used / (size * size) };
}

// Rasterizza i triangoli di ogni chart nell'atlante: per ogni texel coperto, posizione e normale.
export function rasterize(groups, uv1, size) {
  const N = size * size;
  const pos = new Float32Array(N * 3);
  const nrm = new Float32Array(N * 3);
  const chart = new Int32Array(N).fill(-1);
  const zone = new Uint8Array(N);
  let chartId = 0;
  for (const g of groups) {
    const P = g.geometry.attributes.position.array;
    const Nn = g.geometry.attributes.normal.array;
    const idx = g.geometry.index.array;
    const T = uv1.get(g.name);
    for (const c of g.geometry.userData.charts) {
      for (let t = c.idxStart; t < c.idxEnd; t += 3) {
        const a = idx[t], b = idx[t + 1], d = idx[t + 2];
        const ax = T[a * 2] * size, ay = T[a * 2 + 1] * size;
        const bx = T[b * 2] * size, by = T[b * 2 + 1] * size;
        const cx = T[d * 2] * size, cy = T[d * 2 + 1] * size;
        const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
        if (Math.abs(area) < 1e-12) continue;
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx)));
        const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy)));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const px = x + 0.5, py = y + 0.5;
            const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / area;
            const w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / area;
            const w2 = 1 - w0 - w1;
            if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
            const i = y * size + x;
            if (chart[i] >= 0) continue;
            chart[i] = chartId;
            zone[i] = g.zone;
            for (let k = 0; k < 3; k++) {
              pos[i * 3 + k] = P[a * 3 + k] * w0 + P[b * 3 + k] * w1 + P[d * 3 + k] * w2;
              nrm[i * 3 + k] = Nn[a * 3 + k] * w0 + Nn[b * 3 + k] * w1 + Nn[d * 3 + k] * w2;
            }
            const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1;
            nrm[i * 3] /= l; nrm[i * 3 + 1] /= l; nrm[i * 3 + 2] /= l;
          }
        }
      }
      chartId++;
    }
  }
  return { pos, nrm, chart, zone };
}

// Filtro bilaterale semplice: media pesata solo tra texel validi dello stesso chart
export function denoise(values, chart, valid, size, radius, sigma) {
  const out = new Float32Array(values.length);
  const w = [];
  for (let k = -radius; k <= radius; k++) w.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (!valid[i]) continue;
      const c = chart[i];
      let s = 0, ws = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= size) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= size) continue;
          const j = yy * size + xx;
          if (!valid[j] || chart[j] !== c) continue;
          const ww = w[dy + radius] * w[dx + radius];
          s += values[j] * ww;
          ws += ww;
        }
      }
      out[i] = s / ws;
    }
  }
  return out;
}

// Estende i valori ai texel vuoti vicini (bordi dei chart), così il filtraggio non "sanguina"
export function dilate(values, valid, size, iterations) {
  let v = values.slice();
  let ok = valid.slice();
  for (let it = 0; it < iterations; it++) {
    const nv = v.slice(), nok = ok.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (ok[i]) continue;
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
            const j = yy * size + xx;
            if (ok[j]) { s += v[j]; n++; }
          }
        }
        if (n) { nv[i] = s / n; nok[i] = 1; }
      }
    }
    v = nv;
    ok = nok;
  }
  return { values: v, valid: ok };
}
