"""Genera le texture ripetibili (tile senza giunture) usate dal CSS.

    python3 scripts/texture.py

Richiede numpy e Pillow. Scrive in src/assets/texture/.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "src" / "assets" / "texture"
rng = np.random.default_rng(1522)


def noise_periodica(h, w, scala, scala_y=None):
    """Rumore morbido e periodico: rumore bianco filtrato nello spazio delle frequenze.
    Con `scala_y` diversa da `scala` il rumore si allunga in verticale (venature, fibre)."""
    scala_y = scala if scala_y is None else scala_y
    bianco = rng.standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    filtro = np.exp(-((fx * scala) ** 2 + (fy * scala_y) ** 2))
    n = np.real(np.fft.ifft2(np.fft.fft2(bianco) * filtro))
    return (n - n.mean()) / (n.std() + 1e-9)


def carta(size=512):
    """Carta avorio #F3EDE1 con macchie leggere, grana fine e fibre."""
    base = np.array([243, 237, 225], dtype=np.float32)
    lum = 1.6 * noise_periodica(size, size, 60) + 0.9 * noise_periodica(size, size, 6)
    lum += 0.8 * rng.standard_normal((size, size))
    img = np.clip(base[None, None, :] + lum[..., None] * np.array([1.0, 1.0, 1.1]), 0, 255)

    # Fibre: tratti sottili e curvi, disegnati a 2x e ridotti per l'antialias.
    k = 2
    s = size * k
    strato = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(strato)
    for _ in range(1400):
        x, y = rng.uniform(0, s, 2)
        ang = rng.uniform(0, np.pi)
        lung = rng.uniform(6, 28) * k
        curva = rng.uniform(-0.012, 0.012) / k
        scura = rng.random() < 0.6
        col = (120, 105, 80) if scura else (255, 252, 244)
        a = int(rng.uniform(10, 30))
        punti = []
        for t in np.linspace(0, lung, 12):
            ang_t = ang + curva * t
            punti.append((x + np.cos(ang_t) * t, y + np.sin(ang_t) * t))
        for dx in (-s, 0, s):
            for dy in (-s, 0, s):
                d.line([(px + dx, py + dy) for px, py in punti], fill=col + (a,), width=k)
    strato = strato.resize((size, size), Image.LANCZOS)

    carta_img = Image.fromarray(img.astype(np.uint8), "RGB").convert("RGBA")
    carta_img.alpha_composite(strato)
    return carta_img.convert("RGB")


def legno(w=320, h=640):
    """Legno di una cassa tipografica: venatura dritta e verticale, toni caldi e scuri."""
    x = np.arange(w)[None, :] / w
    # Disturbo lento: le venature ondeggiano appena.
    deform = 0.012 * noise_periodica(h, w, 30, 160)
    # 7 anelli per larghezza (periodico in x), resi più netti da una potenza.
    anelli = np.sin(2 * np.pi * 7 * (x + deform))
    anelli = np.sign(anelli) * np.abs(anelli) ** 0.5
    # Fibre: strisce sottili allungate in verticale.
    fibra = noise_periodica(h, w, 1.5, 40)
    macchie = noise_periodica(h, w, 60, 120)
    t = 0.5 + 0.16 * anelli + 0.16 * fibra + 0.14 * macchie
    chiaro = np.array([138, 97, 62], dtype=np.float32)
    scuro = np.array([70, 45, 27], dtype=np.float32)
    img = scuro + (chiaro - scuro) * np.clip(t, 0, 1)[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    carta().save(OUT / "carta.webp", "WEBP", quality=86, method=6)
    legno().save(OUT / "legno.webp", "WEBP", quality=80, method=6)
    for f in sorted(OUT.glob("*.webp")):
        print(f"{f.name}: {f.stat().st_size / 1024:.1f} KB")
