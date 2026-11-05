#!/usr/bin/env python3
"""
Texture del globo dai contorni Natural Earth (esportati da scripts/build_land.mjs).
Tre livelli, in proiezione equirettangolare (riga 0 = nord):
  world  — tutto il mondo, coste 1:50m
  med    — Europa e Mediterraneo, coste 1:10m (la zona che si esplora)
  bal    — Baleari, coste 1:10m (per lo zoom su Mallorca)
Canali: R = terra (antialias), G = linea di costa, B = confini tra stati.
Uscita: public/data/globe_{world,med,bal}.webp e public/data/globe.json (riquadri).
In più la Terra vera: NASA Blue Marble (colori) e il rilievo, dominio pubblico, presi dal
mirror jsDelivr degli esempi di three-globe → public/data/globe_earth.webp, globe_topo.webp.
Per l'Europa e il Mediterraneo una foto molto più nitida: NASA Blue Marble Next Generation dal
servizio GIBS (dominio pubblico), con i colori di mare e terra adattati a quelli del globo così
che il bordo della zona non si veda → public/data/globe_eu.webp.
"""
import urllib.request
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "land"
DATA = ROOT / "public" / "data"

LEVELS = {
    "world": {"src": "50m", "box": [-180, -90, 180, 90], "w": 4096, "q": 80},
    "med": {"src": "10m", "box": [-18, 27, 36, 63], "ppd": 66, "q": 82},
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
    # sempre anche ±360°: l'anello di Eurasia-Africa parte da -180 e, reso continuo, finisce
    # tutto spostato di un giro (senza le copie i riquadri regionali restavano senza continente)
    shifts = (-360, 0, 360)
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


EARTH = "https://cdn.jsdelivr.net/gh/vasturiano/three-globe@master/example/img/"


def earth(meta):
    """Blue Marble (colori, 4096×2048) e rilievo (2048×1024) in WebP"""
    cache = ROOT / ".cache" / "earth"
    cache.mkdir(parents=True, exist_ok=True)
    for src, name, q in (("earth-blue-marble.jpg", "earth", 82), ("earth-topology.png", "topo", 80)):
        f = cache / src
        if not f.exists():
            f.write_bytes(urllib.request.urlopen(EARTH + src, timeout=120).read())
        im = Image.open(f).convert("RGB" if name == "earth" else "L")
        out = DATA / f"globe_{name}.webp"
        im.save(out, "WEBP", quality=q, method=6)
        meta[name] = {"file": out.name, "width": im.width, "height": im.height}
        print(f"{name}: {im.width}x{im.height} → {out.name} {out.stat().st_size // 1024} KB")


GIBS = ("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap"
        "&VERSION=1.3.0&LAYERS=BlueMarble_NextGeneration&STYLES=&CRS=EPSG:4326&FORMAT=image/jpeg")


def photo(meta, name, box, mask):
    """la foto nitida di una zona (NASA Blue Marble NG via GIBS), stesso riquadro e risoluzione
    della maschera `mask`, con i colori della terra portati a quelli della texture del mondo e il
    mare del globo (sfumato)"""
    import numpy as np
    x0, y0, x1, y1 = box
    W, H = mask.size
    f = ROOT / ".cache" / "earth" / f"gibs-{name}-{W}x{H}.jpg"
    if not f.exists():
        url = f"{GIBS}&BBOX={y0},{x0},{y1},{x1}&WIDTH={W}&HEIGHT={H}"
        f.write_bytes(urllib.request.urlopen(url, timeout=600).read())
    eu = np.asarray(Image.open(f).convert("RGB"), dtype=np.float32) / 255
    land = np.asarray(mask.split()[0], dtype=np.float32)[..., None] / 255
    # la stessa zona nella texture del mondo, alla stessa scala
    w = Image.open(DATA / "globe_earth.webp").convert("RGB")
    WW, WH = w.size
    crop = ((x0 + 180) / 360 * WW, (90 - y1) / 180 * WH, (x1 + 180) / 360 * WW, (90 - y0) / 180 * WH)
    ref = np.asarray(w.transform((W, H), Image.EXTENT, crop, Image.BICUBIC), dtype=np.float32) / 255
    lin = lambda c: np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    srgb = lambda c: np.where(c <= 0.0031308, c * 12.92, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055)
    # la terra: la foto nitida, con i colori portati a quelli del globo
    sel = land[..., 0] > 0.95
    g_land = lin(ref)[sel].mean(0) / np.maximum(lin(eu)[sel].mean(0), 1e-4)
    print("terra guadagno", g_land.round(2))
    # il mare: il colore del globo, sfumato e senza la terra che vi sbava vicino alle coste
    # (nella foto NASA il mare è quasi nero: schiarirlo tirerebbe fuori il rumore)
    sea = 1 - land
    def run(a, r, axis):  # media mobile lungo un asse
        c = np.cumsum(np.pad(a, [(r + 1, r) if i == axis else (0, 0) for i in range(a.ndim)], mode="edge"), axis=axis)
        hi = np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis)
        lo = np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)
        return (hi - lo) / (2 * r + 1)
    def blur(a):  # tre passate di media mobile ≈ gaussiana
        for _ in range(3):
            a = run(run(a, 14, 0), 14, 1)
        return a
    sea_col = blur(lin(ref) * sea) / np.maximum(blur(sea), 1e-3)
    out = land * lin(eu) * g_land + sea * sea_col
    img = Image.fromarray((np.clip(srgb(out), 0, 1) * 255 + 0.5).astype("uint8"))
    o = DATA / f"globe_{name}.webp"
    img.save(o, "WEBP", quality=76, method=6)
    meta[name] = {"file": o.name, "box": list(box), "width": W, "height": H}
    print(f"{name}: {W}x{H} → {o.name} {o.stat().st_size // 1024} KB")


# il Messico centrale, da Città del Messico (dove parte Nomads): la pagina Nosotros ci vola sopra
MX = {"box": [-110, 12, -88, 28], "ppd": 120}


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
        if name == "med":
            med_mask = img
        f = DATA / f"globe_{name}.webp"
        img.save(f, "WEBP", quality=L["q"], method=6)
        meta[name] = {"file": f.name, "box": L["box"], "width": W, "height": H}
        print(f"{name}: {W}x{H} → {f.name} {f.stat().st_size // 1024} KB")
    earth(meta)
    photo(meta, "eu", LEVELS["med"]["box"], med_mask)
    x0, y0, x1, y1 = MX["box"]
    W = int(round((x1 - x0) * MX["ppd"])); H = int(round(W * (y1 - y0) / (x1 - x0)))
    photo(meta, "mx", MX["box"], render(cache["10m"], MX["box"], W, H))
    meta["source"] = "Natural Earth (dominio pubblico) via world-atlas; Terra: NASA Blue Marble (dominio pubblico), Europa e Messico: NASA Blue Marble Next Generation via GIBS"
    (DATA / "globe.json").write_text(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
