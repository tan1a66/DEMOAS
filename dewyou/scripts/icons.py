"""Iconos del sitio: el unicornio DEWYOU en crema sobre círculo ciruela.
Uso: python3 scripts/icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
uni = Image.open(ROOT / 'src/assets/brand/unicorn.png').split()[3]
PLUM = (88, 64, 89, 255)
CREAM = (255, 252, 247, 255)


def icon(size, round_bg=True):
    s = size * 4
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0) if round_bg else PLUM)
    if round_bg:
        ImageDraw.Draw(im).ellipse((0, 0, s - 1, s - 1), fill=PLUM)
    h = int(s * 0.62)
    w = int(h * uni.width / uni.height)
    a = uni.resize((w, h), Image.LANCZOS)
    mark = Image.new('RGBA', (w, h), CREAM)
    mark.putalpha(a)
    im.alpha_composite(mark, ((s - w) // 2, (s - h) // 2 + int(s * 0.01)))
    return im.resize((size, size), Image.LANCZOS)


out = ROOT / 'public'
icon(32).save(out / 'favicon-32.png')
icon(180, round_bg=False).save(out / 'apple-touch-icon.png')
icon(64).save(out / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print('ok')
