"""Prepara i render di Blender per il sito (public/renders/).

Da render/out/ (scaricati dal Pod) produce:
  - giro esterno: public/renders/orbit/<ora>/1920/fNN.jpg e .../1280/fNN.jpg
  - panorami:     public/renders/pano/<id>_<ora>.jpg (4096×2048, per tutti)
                  public/renders/pano/<id>_<ora>_full.jpg (risoluzione piena, per i desktop che la reggono)
  - finiture:     public/renders/crops/<id>-<n>.jpg, vista prospettica ravvicinata (dal panorama al tramonto)
                  calcolata dal punto 3D della finitura in src/data/villa.json.

Uso: python3 scripts/renders.py [--preview]   (--preview usa i file *_preview, per provare il sito)
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "render" / "out"
PUB = ROOT / "public" / "renders"
DATA = json.loads((ROOT / "src" / "data" / "villa.json").read_text())
R = DATA["renders"]


def save(im, path, q):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "JPEG", quality=q, optimize=True, progressive=True, subsampling="4:2:0")


def orbit(suffix):
    for t in R["times"]:
        src = OUT / f"orbit_{t}{suffix}"
        if not src.is_dir():
            continue
        for f in sorted(src.glob("f*.jpg")):
            im = Image.open(f).convert("RGB")
            w, h = R["orbit"]["size"]
            if im.size != (w, h):
                im = im.resize((w, h), Image.LANCZOS)
            save(im, PUB / "orbit" / t / "1920" / f.name, 82)
            save(im.resize((1280, 720), Image.LANCZOS), PUB / "orbit" / t / "1280" / f.name, 80)
        print("giro", t, len(list(src.glob("f*.jpg"))), "fotogrammi")


def perspective(eq, pano, point, out_w=1200, out_h=800, hfov_deg=48.0):
    """Vista prospettica dal panorama equirettangolare verso un punto 3D della villa."""
    H, W = eq.shape[:2]
    fx, fz = pano["look"][0] - pano["pos"][0], pano["look"][2] - pano["pos"][2]
    dx, dy, dz = (point[i] - pano["pos"][i] for i in range(3))
    a0 = math.atan2(dz, dx) - math.atan2(fz, fx)            # positivo = a destra dello sguardo iniziale
    l0 = math.atan2(dy, math.hypot(dx, dz))
    l0 = max(-1.0, min(1.0, l0))
    F = np.array([math.cos(l0) * math.cos(a0), math.sin(l0), math.cos(l0) * math.sin(a0)])
    Rt = np.cross(F, [0.0, 1.0, 0.0])
    Rt /= np.linalg.norm(Rt)
    Up = np.cross(Rt, F)
    tx = math.tan(math.radians(hfov_deg) / 2)
    xs = (2 * (np.arange(out_w) + 0.5) / out_w - 1) * tx
    ys = (1 - 2 * (np.arange(out_h) + 0.5) / out_h) * tx * out_h / out_w
    X, Y = np.meshgrid(xs, ys)
    d = F[None, None, :] + X[..., None] * Rt[None, None, :] + Y[..., None] * Up[None, None, :]
    alpha = np.arctan2(d[..., 2], d[..., 0])
    lat = np.arctan2(d[..., 1], np.hypot(d[..., 0], d[..., 2]))
    u = (0.5 + alpha / (2 * np.pi)) % 1.0 * W - 0.5
    v = (0.5 - lat / np.pi) * H - 0.5
    u0 = np.floor(u).astype(int)
    v0 = np.clip(np.floor(v).astype(int), 0, H - 2)
    fu = (u - u0)[..., None]
    fv = (v - v0)[..., None]
    u0 %= W
    u1 = (u0 + 1) % W
    top = eq[v0, u0] * (1 - fu) + eq[v0, u1] * fu
    bot = eq[v0 + 1, u0] * (1 - fu) + eq[v0 + 1, u1] * fu
    img = top * (1 - fv) + bot * fv
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


def panos(suffix):
    for p in R["panos"]:
        for t in R["times"]:
            f = OUT / f"pano_{p['id']}_{t}{suffix}.jpg"
            if not f.exists():
                continue
            im = Image.open(f).convert("RGB")
            save(im, PUB / "pano" / f"{p['id']}_{t}_full.jpg", 80)
            small = im if im.width <= 4096 else im.resize((4096, 2048), Image.LANCZOS)
            save(small, PUB / "pano" / f"{p['id']}_{t}.jpg", 82)
            print("panorama", p["id"], t, im.size)
        # ritagli delle finiture: dal tramonto (o dalla prima ora disponibile)
        srcs = [OUT / f"pano_{p['id']}_{t}{suffix}.jpg" for t in ("sunset", "morning", "night")]
        src = next((s for s in srcs if s.exists()), None)
        if not src:
            continue
        eq = np.asarray(Image.open(src).convert("RGB"), dtype=np.float32)
        for i, hs in enumerate(p.get("hotspots", [])):
            save(perspective(eq, p, hs["at"]), PUB / "crops" / f"{p['id']}-{i + 1}.jpg", 84)
        print("ritagli", p["id"], len(p.get("hotspots", [])))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--only", choices=["orbit", "pano"], default=None)
    a = ap.parse_args()
    suffix = "_preview" if a.preview else ""
    if a.only in (None, "orbit"):
        orbit(suffix)
    if a.only in (None, "pano"):
        panos(suffix)


if __name__ == "__main__":
    main()
