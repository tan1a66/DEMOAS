"""
Filigrana dell'intro: curve di livello reali dell'area di Sa Calobra (dalla heightmap base),
esportate come SVG leggero in src/assets/contours.svg.
Uso: python3 -I scripts/contours.py
"""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = json.load(open(os.path.join(ROOT, 'public/data/terrain.json')))['levels']['base']
q = np.asarray(Image.open(os.path.join(ROOT, 'public/data', meta['file'])), dtype=np.float64)
h = meta['hMin'] + q / 65535 * (meta['hMax'] - meta['hMin'])
# griglia più rada (32 m): curve morbide e file piccolo
k = 4
h = h[: h.shape[0] // k * k, : h.shape[1] // k * k].reshape(h.shape[0] // k, k, h.shape[1] // k, k).mean(axis=(1, 3))
H, W = h.shape
VW = 1000.0
sc = VW / (W - 1)


def march(level):
    """marching squares: segmenti dell'isolinea"""
    segs = []
    a, b, c, d = h[:-1, :-1], h[:-1, 1:], h[1:, 1:], h[1:, :-1]
    idx = (a > level) * 1 + (b > level) * 2 + (c > level) * 4 + (d > level) * 8
    ys, xs = np.nonzero((idx > 0) & (idx < 15))
    for y, x in zip(ys, xs):
        va, vb, vc, vd = h[y, x], h[y, x + 1], h[y + 1, x + 1], h[y + 1, x]
        t = lambda p, q_: (level - p) / (q_ - p) if q_ != p else 0.5
        top = (x + t(va, vb), y); right = (x + 1, y + t(vb, vc))
        bottom = (x + t(vd, vc), y + 1); left = (x, y + t(va, vd))
        e = {1: [(left, top)], 2: [(top, right)], 3: [(left, right)], 4: [(right, bottom)], 5: [(left, top), (right, bottom)],
             6: [(top, bottom)], 7: [(left, bottom)], 8: [(bottom, left)], 9: [(bottom, top)], 10: [(top, right), (bottom, left)],
             11: [(bottom, right)], 12: [(right, left)], 13: [(right, top)], 14: [(top, left)]}[idx[y, x]]
        segs.extend(e)
    return segs


def join(segs):
    """unisce i segmenti in polilinee"""
    key = lambda p: (round(p[0], 3), round(p[1], 3))
    ends = {}
    for i, (p, q_) in enumerate(segs):
        ends.setdefault(key(p), []).append(i); ends.setdefault(key(q_), []).append(i)
    used = [False] * len(segs); lines = []
    for i in range(len(segs)):
        if used[i]: continue
        used[i] = True
        line = [segs[i][0], segs[i][1]]
        for direction in (1, 0):
            while True:
                tip = line[-1] if direction else line[0]
                nxt = [j for j in ends.get(key(tip), []) if not used[j]]
                if not nxt: break
                j = nxt[0]; used[j] = True
                p, q_ = segs[j]
                other = q_ if key(p) == key(tip) else p
                if direction: line.append(other)
                else: line.insert(0, other)
        lines.append(line)
    return lines


def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0]), np.array(pts[-1])
    ab = b - a; L = np.hypot(*ab) or 1
    d = [abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / L for p in pts[1:-1]]
    i = int(np.argmax(d)) + 1
    if d[i - 1] > eps: return rdp(pts[: i + 1], eps)[:-1] + rdp(pts[i:], eps)
    return [pts[0], pts[-1]]


paths = []
for level in range(50, 1300, 50):
    for line in join(march(level)):
        if len(line) < 6: continue
        line = rdp([(x * sc, y * sc) for x, y in line], 0.6)
        major = level % 250 == 0
        d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in line)
        paths.append((major, d))
VH = (H - 1) * sc
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW:.0f} {VH:.0f}" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round">']
svg.append('<path stroke-width="0.8" d="' + ' '.join(d for m, d in paths if not m) + '"/>')
svg.append('<path stroke-width="1.6" d="' + ' '.join(d for m, d in paths if m) + '"/>')
svg.append('</svg>')
out = os.path.join(ROOT, 'src/assets/contours.svg')
open(out, 'w').write('\n'.join(svg))
print(out, os.path.getsize(out) // 1024, 'kB', len(paths), 'curve')
