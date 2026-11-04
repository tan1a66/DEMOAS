// Geometria del globo: raggio 1, x verso la longitudine 0, y verso il nord, est verso −z.
import { Vector3 } from 'three';

export const RAD = Math.PI / 180;

/** lat/lon in gradi → punto sul globo a distanza r dal centro */
export function ll2v(lat, lon, r = 1, out = new Vector3()) {
  const la = lat * RAD, lo = lon * RAD;
  return out.set(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r);
}

/** rotta ad arco di cerchio massimo tra due luoghi, che si alza di h a metà: n punti */
export function arcPoints(a, b, n, h) {
  const va = ll2v(a.lat, a.lon), vb = ll2v(b.lat, b.lon);
  const w = Math.acos(Math.min(Math.max(va.dot(vb), -1), 1));
  const s = Math.sin(w) || 1;
  const pts = [];
  const flat = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = va.clone().multiplyScalar(Math.sin((1 - t) * w) / s).add(vb.clone().multiplyScalar(Math.sin(t * w) / s));
    p.setLength(1 + h * Math.sin(Math.PI * t) * Math.min(1, w / 1.2));
    pts.push(p);
    p.toArray(flat, i * 3);
  }
  return { pts, flat };
}
