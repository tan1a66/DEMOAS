"""Prepara le immagini del sito a partire dai file originali di DEWYOU.

Uso:  python3 scripts/build-assets.py <cartella-con-gli-originali>

Gli originali vengono dalla libreria pubblica di dewyou.com.mx (wp-json/wp/v2/media) e
dalla pagina AgendaPro. Qui si ritagliano, si ridimensionano e si salvano in src/assets/.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'src' / 'assets'


def save(im, rel, size=None, q=80):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    if size:
        im = im.copy()
        im.thumbnail((size, size), Image.LANCZOS)
    if p.suffix == '.png':
        im.save(p, optimize=True)
    else:
        im.save(p, quality=q, method=6)
    print(f'{rel:42s} {im.size[0]}x{im.size[1]}  {p.stat().st_size // 1024} KB')


def mask(name, rel, height):
    """Marchio monocromatico -> solo canale alfa (si colora con CSS mask)."""
    im = Image.open(SRC / name).convert('RGBA')
    a = im.split()[3]
    im = im.crop(a.getbbox())
    a = im.split()[3]
    w = round(im.width * height / im.height)
    a = a.resize((w, height), Image.LANCZOS)
    white = Image.new('RGBA', a.size, (255, 255, 255, 0))
    white.putalpha(a)
    save(white, rel)


def crop_label(im):
    """Toglie la scritta del nome sotto la bevanda: taglia nel primo spazio vuoto
    (almeno 20 righe di solo sfondo) che segue il bicchiere."""
    a = np.asarray(im.convert('RGB')).astype(int)
    full = (np.abs(a - a[5, 5]).sum(2) > 40).sum(1) > 2
    y = int(a.shape[0] * 0.6)
    while y < len(full):
        if not full[y]:
            e = y
            while e < len(full) and not full[e]:
                e += 1
            if e - y >= 20:
                return im.crop((0, 0, im.width, (y + e) // 2))
            y = e
        y += 1
    return im


# Marchi
mask('Logotipo-Dewyou_Morado.webp', 'brand/logo.png', 240)
mask('cropped-Dewyou-Unicorn_Morado.webp', 'brand/unicorn.png', 420)
mask('Dewyou-Signature_Morado.webp', 'brand/dy.png', 300)

# Foto del locale e dei workout
deep = Image.open(SRC / 'INICIO-WORKOUTS-FACIALES.png').convert('RGB')
save(deep.crop((180, 0, 180 + 1148, 1500)), 'fotos/deep-lift.webp', 1100)
save(Image.open(SRC / 'WhatsApp-Image-2025-08-01-at-2.14.08-PM.jpeg').convert('RGB'), 'fotos/espacio.webp')
save(Image.open(SRC / 'WhatsApp-Image-2025-08-01-at-2.14.34-PM.jpeg').convert('RGB'), 'fotos/collagen-bar.webp')
save(Image.open(SRC / 'manos-y-pies-nail-bar.jpg').convert('RGB'), 'fotos/nail-bar.webp', 720)

SERV = {
    'glow-on-the-go': 'WEB-SERV-GLOW-ON-THE-GO.webp',
    'you-dew-you': 'WEB-SERV-YOU-DEW-YOU.png',
    'holly-dew': 'WEB-SERV-HOLLY-DEW.png',
    'keep-it-cool': 'WEB-SERV-KEEP-IT-COOL.webp',
    'lyma-glow': 'WEB-SERV-LYMA-GLOW.webp',
    'glass-skin-please': 'WEB-SERV-GLASS-SKIN-PLEASE.webp',
}
for k, f in SERV.items():
    save(Image.open(SRC / f).convert('RGB'), f'servicios/{k}.webp', 720, 78)

DRINKS = {
    'so-berry-matcha': 'SO-BERRY-MATCHA-1.webp',
    'dirty-matcha': 'DIRTY-MATCHA-1.webp',
    'berry-zesty': 'BERRY-ZESTY-1.webp',
    'iced-mocha-latte': 'ICED-MOCHA-LATTE-1.webp',
    'iced-americano': 'ICED-AMERICANO-1.webp',
    'black-iced-tea': 'BLACK-ICED-TEA-1.webp',
}
for k, f in DRINKS.items():
    save(crop_label(Image.open(SRC / f).convert('RGB')), f'bebidas/{k}.webp', 640, 80)
save(Image.open(SRC / '4.webp').convert('RGB'), 'bebidas/collagen-matcha.webp', 640, 80)
