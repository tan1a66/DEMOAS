"""Texture del modello esterno ritagliate dalle fotografie reali della villa.

Ogni ritaglio viene "appiattito" (si toglie la variazione di luce a grande scala dividendo per una
versione molto sfocata), poi reso ripetibile (mezza immagine sovrapposta e sfumata ai bordi).
Il risultato va in public/textures/<nome>.jpg.
Uso: python3 scripts/textures.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "source"
OUT = ROOT / "public" / "textures"

# nome: (sorgente, ritaglio normalizzato x0, y0, x1, y1, lato in px, rotazione, luminosità media, saturazione)
CROPS = {
    "stone": ("21-muro-pietra-giardino-tramonto.jpg", (0.665, 0.21, 0.772, 0.42), 512, 0, 150, 0.8),
    "concrete": ("22-passaggio-pietra-cemento-tramonto.jpg", (0.02, 0.18, 0.24, 0.80), 512, 0, 128, 0.25),
    "deck": ("05-drone-piscina-zenitale.jpg", (0.785, 0.14, 0.885, 0.66), 512, 0, 105, 1.0),
    "ground": ("26-esterno-collina-giorno.jpg", (0.28, 0.84, 0.72, 1.0), 512, 0, 120, 0.8),
    "mulch": ("05-drone-piscina-zenitale.jpg", (0.02, 0.73, 0.40, 0.99), 512, 0, 70, 0.7),
}


def flatten(im, radius):
    a = np.asarray(im, dtype=np.float32)
    low = np.asarray(im.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32)
    mean = a.reshape(-1, 3).mean(0)
    out = a / np.maximum(low, 1) * mean
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def grade(im, mean, sat):
    """Porta la luminosità media al valore indicato e regola la saturazione."""
    a = np.asarray(im, dtype=np.float32)
    grey = a.mean(2, keepdims=True)
    a = grey + (a - grey) * sat
    a = a * (mean / max(a.mean(), 1))
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def make_tileable(im, blend=0.22):
    """Sovrappone l'immagine spostata di mezzo lato e la sfuma: i bordi combaciano."""
    a = np.asarray(im, dtype=np.float32)
    h, w, _ = a.shape
    shifted = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    yy = np.minimum(np.arange(h), h - 1 - np.arange(h)) / (h * blend)
    xx = np.minimum(np.arange(w), w - 1 - np.arange(w)) / (w * blend)
    m = np.clip(np.minimum.outer(yy, xx), 0, 1)[..., None]  # 0 sui bordi, 1 all'interno
    out = a * m + shifted * (1 - m)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (src, (x0, y0, x1, y1), size, rot, mean, sat) in CROPS.items():
        im = Image.open(SRC / src).convert("RGB")
        w, h = im.size
        c = im.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)))
        if rot:
            c = c.rotate(rot, expand=True)
        c = flatten(c, max(c.size) / 4)
        c = grade(c, mean, sat)
        c = c.resize((size, size), Image.LANCZOS)
        c = make_tileable(c)
        c.save(OUT / f"{name}.jpg", quality=86, optimize=True)
        print(f"{name:9s} da {src} {c.size}")


if __name__ == "__main__":
    main()
