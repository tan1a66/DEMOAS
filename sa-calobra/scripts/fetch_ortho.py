#!/usr/bin/env python3
"""
Ortofoto PNOA dell'IGN (WMS INSPIRE, CC BY 4.0 scne.es) per i livelli 'hi' e 'base' del terreno.

Scarica la foto aerea esattamente sull'area di ogni livello (stessa proiezione locale del
terreno: x e z sono lineari in longitudine e latitudine), poi la prepara come colore del suolo:
  - attenua le ombre del giorno già presenti nella foto (la scena è illuminata al tramonto),
  - toglie dal mare barche e scie (sul mare 3D sembrerebbero dipinte),
  - salva in WebP accanto alle heightmap: public/data/ortho_{hi,base}.webp
e trova i pini veri (chiome verde scuro) dalla foto a 1 m/px → public/data/trees.bin
(int16 x·2, int16 z·2 in metri locali, poi uint8 grandezza 0…255).

Uso:  python3 scripts/fetch_ortho.py [--cache .cache/ortho]
Le dimensioni in pixel e i metri per pixel sono in RES qui sotto.
"""
import argparse
import json
import math
import urllib.request
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
WMS = ("https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap"
       "&LAYERS=OI.OrthoimageCoverage&STYLES=&CRS=EPSG:4258&FORMAT=image/jpeg")
A_WGS, E2 = 6378137.0, 0.00669437999014

# metri per pixel del file finale e risoluzione dello scaricamento (più fine, poi ridotto)
MAX_TREES = 22000
RES = {"hi": {"m": 2.0, "fetch": 1.0, "q": 80}, "base": {"m": 5.0, "fetch": 2.5, "q": 76}}


class LocalProj:
    def __init__(self, lat0, lon0):
        self.lat0, self.lon0 = lat0, lon0
        s = math.sin(math.radians(lat0))
        w = 1 - E2 * s * s
        self.M = A_WGS * (1 - E2) / w ** 1.5
        self.N = A_WGS / math.sqrt(w)
        self.kx = self.N * math.cos(math.radians(lat0)) * math.pi / 180
        self.ky = self.M * math.pi / 180

    def inv(self, x, z):
        return self.lat0 - z / self.ky, self.lon0 + x / self.kx


def fetch(lat_s, lat_n, lon_w, lon_e, w, h, cache: Path):
    """WMS GetMap, a blocchi di al più 4096 px (limite del servizio)."""
    cache.mkdir(parents=True, exist_ok=True)
    out = Image.new("RGB", (w, h))
    TILE = 4000
    for y0 in range(0, h, TILE):
        for x0 in range(0, w, TILE):
            tw, th = min(TILE, w - x0), min(TILE, h - y0)
            la_n = lat_n - (lat_n - lat_s) * y0 / h
            la_s = lat_n - (lat_n - lat_s) * (y0 + th) / h
            lo_w = lon_w + (lon_e - lon_w) * x0 / w
            lo_e = lon_w + (lon_e - lon_w) * (x0 + tw) / w
            key = cache / f"pnoa_{la_s:.6f}_{lo_w:.6f}_{la_n:.6f}_{lo_e:.6f}_{tw}x{th}.jpg"
            if not key.exists():
                url = f"{WMS}&BBOX={la_s:.7f},{lo_w:.7f},{la_n:.7f},{lo_e:.7f}&WIDTH={tw}&HEIGHT={th}"
                with urllib.request.urlopen(url, timeout=240) as r:
                    data = r.read()
                if not data.startswith(b"\xff\xd8"):
                    raise RuntimeError(f"risposta non JPEG: {data[:200]!r}")
                key.write_bytes(data)
            out.paste(Image.open(key).convert("RGB"), (x0, y0))
    return out


def soften_daylight(img: Image.Image, strength=0.55, radius_px=6.0):
    """Attenua le ombre della foto (presa a mezzogiorno): porta la luminosità locale verso
    la media, conservando colore e dettaglio fine. strength 0 = foto originale."""
    a = np.asarray(img, dtype=np.float32) / 255.0
    lin = a ** 2.2
    lum = lin @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    lum_img = Image.fromarray(np.clip(lum * 255 / max(lum.max(), 1e-6), 0, 255).astype(np.uint8))
    blur = np.asarray(lum_img.filter(ImageFilter.GaussianBlur(radius_px)), np.float32) / 255 * max(lum.max(), 1e-6)
    mean = float(np.median(lum))
    target = blur ** (1 - strength) * mean ** strength  # luminosità locale compressa verso la media
    gain = np.clip(target / np.maximum(blur, 1e-4), 0.6, 2.6)
    lin = np.clip(lin * gain[..., None], 0, 1)
    return Image.fromarray(np.clip(lin ** (1 / 2.2) * 255, 0, 255).astype(np.uint8))


def level_heights(L, w, h):
    """quote del livello ricampionate sulla griglia della foto (w × h)"""
    im = Image.open(DATA / L["file"])
    a = np.asarray(im, dtype=np.float32)
    a = L["hMin"] + a / 65535.0 * (L["hMax"] - L["hMin"])
    return np.asarray(Image.fromarray(a, mode="F").resize((w, h), Image.BILINEAR))


def clean_sea(img: Image.Image, heights):
    """Nel mare (quota < 0,3 m) i pixel molto più chiari dell'acqua intorno (barche, scie)
    vengono sostituiti dal colore medio dell'acqua vicina."""
    a = np.asarray(img, dtype=np.float32) / 255.0
    sea = (heights < 0.3).astype(np.float32)
    def blur(x, r):
        im = Image.fromarray(np.clip(x * 255, 0, 255).astype(np.uint8)) if x.ndim == 2 else None
        return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) / 255.0
    msk = blur(sea, 6)
    avg = np.stack([blur(a[..., c] * sea, 6) for c in range(3)], -1) / np.maximum(msk[..., None], 1e-3)
    lum = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    alum = avg @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    boat = ((lum - alum) > 0.06).astype(np.float32) * sea
    boat = np.asarray(Image.fromarray((boat * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(2)), np.float32) / 255.0
    out = a * (1 - boat[..., None]) + avg * boat[..., None]
    return Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8)), int((boat > 0.5).sum())


def canopy_peaks(img: Image.Image, mpp, x0, z0, win, heights):
    """Chiome dei pini: verde scuro (il verde supera rosso E blu: l'acqua e le rocce in ombra
    tendono al blu), sopra il livello del mare; massimi locali ad almeno win m l'uno dall'altro."""
    a = np.asarray(img, dtype=np.float32) / 255.0
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    lum = 0.2126 * R + 0.7152 * G + 0.0722 * B
    green = np.clip((G - np.maximum(R, B) - 0.006) * 28.0, 0, 1)
    dark = np.clip((0.42 - lum) / 0.2, 0, 1)
    score = green * dark * (heights > 1.5)
    s8 = Image.fromarray((score * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0 / mpp))
    k = max(3, int(round(win / mpp)) | 1)
    mx = np.asarray(s8.filter(ImageFilter.MaxFilter(k)), np.int16)
    sv = np.asarray(s8, np.int16)
    peaks = (sv == mx) & (sv > 60)
    zz, xx = np.nonzero(peaks)
    return x0 + (xx + 0.5) * mpp, z0 + (zz + 0.5) * mpp, sv[zz, xx]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=str(ROOT / ".cache" / "ortho"))
    args = ap.parse_args()
    meta = json.loads((DATA / "terrain.json").read_text())
    proj = LocalProj(meta["origin"]["lat"], meta["origin"]["lon"])
    out_meta = {}
    trees = []
    for name, r in RES.items():
        L = meta["levels"][name]
        lat_n, lon_w = proj.inv(L["xMin"], L["zMin"])  # zMin = nord
        lat_s, lon_e = proj.inv(L["xMax"], L["zMax"])
        W, H = L["xMax"] - L["xMin"], L["zMax"] - L["zMin"]
        fw, fh = int(round(W / r["fetch"])), int(round(H / r["fetch"]))
        big = fetch(lat_s, lat_n, lon_w, lon_e, fw, fh, Path(args.cache))
        ow, oh = int(round(W / r["m"])), int(round(H / r["m"]))
        img = big.resize((ow, oh), Image.LANCZOS)
        img = soften_daylight(img)
        img, nb = clean_sea(img, level_heights(L, ow, oh))
        print(f"  {name}: {nb} pixel di barche/scie tolti dal mare")
        trees.append((name, canopy_peaks(big, r["fetch"], L["xMin"], L["zMin"], 4.5 if name == "hi" else 6.0,
                                         level_heights(L, big.width, big.height)), L))
        f = DATA / f"ortho_{name}.webp"
        img.save(f, "WEBP", quality=r["q"], method=6)
        out_meta[name] = {"file": f.name, "width": ow, "height": oh}
        print(f"{name}: {ow}x{oh} ({r['m']} m/px) → {f.name} {f.stat().st_size // 1024} KB")
    # pini: quelli del livello base solo fuori dall'area 'hi' (lì vale la foto a 1 m/px)
    hi = meta["levels"]["hi"]
    xs, zs, vs = [], [], []
    for name, (x, z, v), L in trees:
        if name == "base":
            inside = (x > hi["xMin"]) & (x < hi["xMax"]) & (z > hi["zMin"]) & (z < hi["zMax"])
            x, z, v = x[~inside], z[~inside], v[~inside]
        xs.append(x); zs.append(z); vs.append(v)
    x, z, v = np.concatenate(xs), np.concatenate(zs), np.concatenate(vs)
    keep = np.argsort(-v, kind="stable")[:MAX_TREES]  # i più sicuri (fluidità su iPhone)
    keep.sort()
    x, z, v = x[keep], z[keep], v[keep]
    n = len(x)
    buf = np.concatenate([np.stack([np.round(x * 2), np.round(z * 2)], 1).astype("<i2").ravel().view(np.uint8),
                          np.clip(v, 0, 255).astype(np.uint8)])
    (DATA / "trees.bin").write_bytes(np.uint32(n).tobytes() + buf.tobytes())
    print(f"pini dalla foto: {n} → trees.bin {(DATA / 'trees.bin').stat().st_size // 1024} KB")
    meta["trees"] = {"file": "trees.bin", "count": int(n), "source": "chiome riconosciute nell'ortofoto PNOA"}
    meta["ortho"] = {**out_meta, "source": "PNOA máxima actualidad © Instituto Geográfico Nacional (CC BY 4.0 scne.es)"}
    (DATA / "terrain.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
