"""
Anteprima 2D del checkpoint 1: heightmap in scala di grigi (con leggera ombreggiatura), strada in
arancione, punti chiave, ingrandimento sul Nus de sa Corbata e profilo altimetrico.
Con due file .npz mette a confronto due sorgenti di rilievo affiancate.

Uso: python3 -I scripts/preview.py <out.png> <A.npz> "<etichetta A>" [<B.npz> "<etichetta B>"]
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORANGE = (232, 98, 44)
CREAM = (237, 232, 223)
ANTH = (43, 43, 43)
BLUE = (126, 147, 166)
PROFILE_COLORS = [BLUE, ORANGE]


def font(size, bold=False):
    p = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def hillshade(h, cell):
    gy, gx = np.gradient(h, cell)
    az, alt = math.radians(315), math.radians(40)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    return np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)


def shaded(h, cell, lo, hi):
    g = np.clip((h - lo) / (hi - lo), 0, 1) * 255
    v = g * (0.55 + 0.45 * hillshade(h, cell))
    v[h < 0] = 30
    return Image.fromarray(v.astype(np.uint8)).convert("RGB")


def map_panel(d, kp, label, scale=1.25):
    carved, road = d["carved"], d["road"]
    W, H, cell = float(d["W"]), float(d["H"]), float(d["cell"])
    img = shaded(carved, cell, 0, 1000)
    img = img.resize((int(img.width * scale), int(img.height * scale)), Image.BILINEAR)
    dr = ImageDraw.Draw(img)
    px = lambda x, z: ((x + W / 2) / cell * scale, (z + H / 2) / cell * scale)
    dr.line([px(x, z) for x, z in road], fill=ORANGE, width=3, joint="curve")
    names = {"TOP": "TOP · Coll dels Reis", "CORBATA": "CORBATA · Nus de sa Corbata", "PORT": "PORT · Sa Calobra"}
    for k, name in names.items():
        x, y = px(kp[k]["x"], kp[k]["z"])
        dr.ellipse([x - 8, y - 8, x + 8, y + 8], fill=ORANGE, outline=CREAM, width=3)
        f = font(17, True)
        tw = dr.textlength(name, font=f)
        tx = x + 13 if x + 13 + tw < img.width - 8 else x - 13 - tw  # a sinistra se esce dal bordo
        dr.text((tx, y - 10), name, fill=CREAM, font=f, stroke_width=3, stroke_fill=ANTH)
    y0 = img.height - 30
    dr.line([(20, y0), (20 + 1000 / cell * scale, y0)], fill=CREAM, width=4)
    dr.text((20, y0 - 24), "1 km", fill=CREAM, font=font(17, True))
    dr.text((img.width - 36, 14), "N", fill=CREAM, font=font(22, True))
    dr.polygon([(img.width - 30, 42), (img.width - 23, 58), (img.width - 37, 58)], fill=CREAM)
    dr.rectangle([0, 0, img.width - 1, 44], fill=ANTH)
    dr.text((12, 10), label, fill=CREAM, font=font(20, True))
    return img


def zoom_panel(d, kp, size=360, half=170):
    carved, road, kind = d["carved"], d["road"], d["kind"]
    W, H, cell = float(d["W"]), float(d["H"]), float(d["cell"])
    cx, cz = kp["CORBATA"]["x"], kp["CORBATA"]["z"]
    i0, i1 = int((cx - half + W / 2) / cell), int((cx + half + W / 2) / cell)
    j0, j1 = int((cz - half + H / 2) / cell), int((cz + half + H / 2) / cell)
    sub = carved[j0:j1, i0:i1]
    img = shaded(sub, cell, sub.min(), sub.max()).resize((size, size), Image.BICUBIC)
    dr = ImageDraw.Draw(img)
    Z = size / (2 * half)
    px = lambda x, z: ((x - (cx - half)) * Z, (z - (cz - half)) * Z)
    for k in range(len(road) - 1):
        if abs(road[k, 0] - cx) > half * 1.3 or abs(road[k, 1] - cz) > half * 1.3:
            continue
        br = kind[k + 1] == "bridge"
        dr.line([px(*road[k]), px(*road[k + 1])], fill=CREAM if br else ORANGE, width=7 if br else 4)
    dr.text((10, 8), f"Nus de sa Corbata · {2*half} m", fill=CREAM, font=font(16, True), stroke_width=3, stroke_fill=ANTH)
    dr.text((10, 30), "crema = ponte", fill=CREAM, font=font(14), stroke_width=2, stroke_fill=ANTH)
    return img


def profile_panel(runs, PW=1000, PH=330):
    img = Image.new("RGB", (PW, PH), ANTH)
    dr = ImageDraw.Draw(img)
    m, top = 52, 86
    smax = max(r[0]["s"][-1] for r in runs)
    hmax = 800
    pp = lambda si, hi: (m + si / smax * (PW - 2 * m), PH - 36 - hi / hmax * (PH - 36 - top))
    for hh in range(0, hmax + 1, 200):
        y = pp(0, hh)[1]
        dr.line([(m, y), (PW - m, y)], fill=(68, 68, 68))
        dr.text((8, y - 8), f"{hh} m", fill=BLUE, font=font(13))
    for km in range(0, int(smax / 1000) + 1):
        dr.text((pp(km * 1000, 0)[0] - 4, PH - 28), f"{km} km", fill=BLUE, font=font(13))
    dr.text((m, 10), "Profilo della strada dal Coll dels Reis al porto", fill=CREAM, font=font(18, True))
    for n, (d, label) in enumerate(runs):
        s, raw, prof = d["s"], d["raw"], d["prof"]
        col = PROFILE_COLORS[n % 2] if len(runs) > 1 else ORANGE
        dim = tuple(int(c * 0.45 + 30) for c in col)
        dr.line([pp(a, max(b, 0)) for a, b in zip(s, raw)], fill=dim, width=1)
        dr.line([pp(a, b) for a, b in zip(s, prof)], fill=col, width=3)
        up = np.clip(np.diff(prof), 0, None).sum()
        dr.text((m, 36 + n * 19), f"■ {label}: {prof[0]:.0f} → {prof[-1]:.0f} m · salite spurie {up:.0f} m",
                fill=col, font=font(14, True))
    dr.text((PW - 330, PH - 52), "linea sottile = DEM grezzo · spessa = lisciata", fill=(150, 150, 150), font=font(12))
    return img


def main():
    out = sys.argv[1]
    runs = [(np.load(sys.argv[i]), sys.argv[i + 1]) for i in range(2, len(sys.argv), 2)]
    kp = json.load(open(os.path.join(ROOT, "data", "keypoints.json")))
    maps = [map_panel(d, kp, lab) for d, lab in runs]
    zooms = [zoom_panel(d, kp) for d, _ in runs]
    prof = profile_panel(runs)
    pad = 20
    mw = sum(m.width for m in maps) + pad * (len(maps) - 1)
    zw = sum(z.width for z in zooms) + pad * (len(zooms) - 1)
    Wt = pad * 2 + max(mw, zw + pad + prof.width if False else mw)
    Ht = pad * 2 + 50 + maps[0].height + pad + max(zooms[0].height, prof.height)
    Wt = max(Wt, pad * 3 + zw + prof.width)
    c = Image.new("RGB", (Wt, Ht), ANTH)
    dr = ImageDraw.Draw(c)
    dr.text((pad, 16), "Sa Calobra · checkpoint 1 · heightmap (grigi), MA-2141 da OpenStreetMap (arancione), punti chiave",
            fill=CREAM, font=font(22, True))
    x = pad
    for m in maps:
        c.paste(m, (x, 60)); x += m.width + pad
    y = 60 + maps[0].height + pad
    x = pad
    for z, (_, lab) in zip(zooms, runs):
        c.paste(z, (x, y))
        dr.text((x + 10, y + z.height - 26), lab, fill=CREAM, font=font(14, True), stroke_width=2, stroke_fill=ANTH)
        x += z.width + pad
    c.paste(prof, (x, y))
    c.save(out, optimize=True)
    print(out, c.size)


if __name__ == "__main__":
    main()
