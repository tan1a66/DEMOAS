#!/usr/bin/env python3
"""Genera las variantes web de las fotografías (AVIF + JPEG en varios anchos) y sus metadatos.

Uso:  python3 scripts/images.py <carpeta-con-los-originales>

- Originales: las fotos del sitio oficial de Picheta a resolución completa (ver README, "Fotografías").
- Salida: public/img/<id>-<ancho>.avif|.jpg  y  src/data/photoMeta.json (dimensiones, anchos, color medio).
- El vídeo de la terraza se procesa aparte con scripts/video.sh.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'img'
META = ROOT / 'src' / 'data' / 'photoMeta.json'

# id en la web → archivo original (nombres de la descarga del sitio oficial)
PHOTOS = {
    'terraza-atardecer': 'terraza-atardecer.jpg',
    'terraza-panoramica': 'terraza-panoramica.jpg',
    'salon-boveda': 'salon-boveda.jpg',
    'salon-piedra': 'salon-piedra.jpg',
    'balcon': 'balcon.jpg',
    'sala-privada': 'sala-privada.jpg',
    'catedral-calle': 'catedral-calle.jpg',
    'terraza-flores': 'terraza-flores.jpg',
    'terraza-mesa': 'terraza-mesa.jpg',
    'terraza-servicio': 'terraza-servicio.jpg',
    'terraza-barra-noche': 'terraza-barra-noche.jpg',
    'terraza-plato': 'terraza-plato.png',
    'terraza-brindis': 'terraza-brindis.jpg',
    'cocina-manos': 'cocina-manos.jpg',
    'maiz': 'maiz.jpg',
    'plato-salmon': 'plato-salmon.jpg',
    # fotogramas del vídeo oficial (scripts/video.sh los extrae)
    'barra-noche': 'video-barra-noche.png',
    'aereo-merida': 'video-aereo.png',
}

AVIF_WIDTHS = (640, 1080, 1600, 2000)
JPEG_WIDTHS = (1080, 1600)


def main(src_dir: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {}
    for pid, name in PHOTOS.items():
        src = src_dir / name
        if not src.exists():
            print('FALTA', src)
            continue
        im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
        w, h = im.size
        widths = sorted({min(x, w) for x in AVIF_WIDTHS})
        for x in widths:
            r = im if x == w else im.resize((x, round(h * x / w)), Image.LANCZOS)
            r.save(OUT / f'{pid}-{x}.avif', 'AVIF', quality=58, speed=4)
        jpeg_widths = sorted(set(min(x, w) for x in JPEG_WIDTHS))
        for x in jpeg_widths:
            r = im if x == w else im.resize((x, round(h * x / w)), Image.LANCZOS)
            r.save(OUT / f'{pid}-{x}.jpg', 'JPEG', quality=80, optimize=True, progressive=True)
        avg = im.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
        meta[pid] = {
            'width': w,
            'height': h,
            'widths': widths,
            'jpeg': jpeg_widths,
            'color': '#%02x%02x%02x' % tuple(avg),
        }
        size = sum((OUT / f'{pid}-{x}.avif').stat().st_size for x in widths) // 1024
        print(f'{pid:22s} {w}x{h}  avif {widths}  jpeg {jpeg_widths}  ({size} KB avif)')
    META.write_text(json.dumps(meta, indent=2) + '\n')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
