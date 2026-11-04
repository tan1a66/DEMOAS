#!/usr/bin/env python3
"""
Texture del globo dai contorni Natural Earth (esportati da scripts/build_land.mjs).
Tre livelli, in proiezione equirettangolare (riga 0 = nord):
  world  — tutto il mondo, coste 1:50m
  med    — Mediterraneo occidentale e Alpi, coste 1:10m
  bal    — Baleari, coste 1:10m (per lo zoom su Mallorca)
Canali: R = terra (antialias), G = linea di costa, B = confini tra stati.
Uscita: public/data/globe_{world,med,bal}.webp e public/data/globe.json (riquadri).
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "land"
DATA = ROOT / "public" / "data"

LEVELS = {
    "world": {"src": "50m", "box": [-180, -90, 180, 90], "w": 4096, "q": 80},
    "med": {"src": "10m", "box": [-8, 33, 20, 51], "ppd": 72, "q": 82},
    "bal": {"src": "10m", "box": [0.8, 38.4, 4.8, 40.4], "ppd": 420, "q": 85},
}
SS = 2  # sovracampionamento per l'antialias


def unwrap(pts):
    """longitudini continue (niente salti di 360° sul meridiano 180)"""
    out = [list(pts[0])]
    for lon, lat in pts[1:]:
        prev = out[-1][0]
        while lon - prev > 180: lon -= 360
        while lon - prev < -180: lon += 360
        out.append([lon, lat])
    return out


def render(src, box, W, H):
    x0, y0, x1, y1 = box
    sx, sy = W * SS / (x1 - x0), H * SS / (y1 - y0)
    P = lambda lon, lat: ((lon - x0) * sx, (y1 - lat) * sy)
    land = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(land)
    world = box[2] - box[0] >= 360
    shifts = (-360, 0, 360) if world else (0,)
    for r in src["rings"]:
        if len(r["pts"]) < 3:
            continue
        u = unwrap(r["pts"])
        if abs(u[-1][0] - u[0][0]) > 180:  # gira intorno al polo (Antartide): si chiude sul polo
            pole = -90 if sum(p[1] for p in u) < 0 else 90
            u = u + [[u[-1][0], pole], [u[0][0], pole]]
        for sh in shifts:
            pts = [P(lon + sh, lat) for lon, lat in u]
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            if max(xs) < 0 or min(xs) > W * SS or max(ys) < 0 or min(ys) > H * SS:
                continue
            d.polygon(pts, fill=0 if r["hole"] else 255)
    coast = land.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3))
    if world:  # i bordi dell'immagine non sono costa
        dc = ImageDraw.Draw(coast)
        dc.rectangle([0, 0, 2, H * SS], fill=0); dc.rectangle([W * SS - 3, 0, W * SS, H * SS], fill=0)
        dc.rectangle([0, H * SS - 3, W * SS, H * SS], fill=0)
    bord = Image.new("L", (W * SS, H * SS), 0)
    db = ImageDraw.Draw(bord)
    for line in src["borders"]:
        if len(line) < 2:
            continue
        u = unwrap(line)
        for sh in shifts:
            db.line([P(lon + sh, lat) for lon, lat in u], fill=255, width=max(1, SS))
    ch = [im.resize((W, H), Image.LANCZOS) for im in (land, coast, bord)]
    return Image.merge("RGB", ch)


def main():
    meta = {}
    cache = {}
    for name, L in LEVELS.items():
        src = cache.get(L["src"]) or json.loads((CACHE / f"land-{L['src']}.json").read_text())
        cache[L["src"]] = src
        x0, y0, x1, y1 = L["box"]
        W = L.get("w") or int(round((x1 - x0) * L["ppd"]))
        H = int(round(W * (y1 - y0) / (x1 - x0)))
        img = render(src, L["box"], W, H)
        f = DATA / f"globe_{name}.webp"
        img.save(f, "WEBP", quality=L["q"], method=6)
        meta[name] = {"file": f.name, "box": L["box"], "width": W, "height": H}
        print(f"{name}: {W}x{H} → {f.name} {f.stat().st_size // 1024} KB")
    meta["source"] = "Natural Earth (dominio pubblico) via world-atlas"
    (DATA / "globe.json").write_text(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
