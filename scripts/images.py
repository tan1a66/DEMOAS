"""Prepara le immagini delle scene e i ritagli delle finiture a partire da src/data/villa.json.

Per ogni scena con "source":
  public/scenes/<id>_mobile.jpg  lato lungo max 2560 px, JPEG qualità 82
  public/scenes/<id>_full.jpg    risoluzione massima disponibile: copia esatta del JPEG originale
                                 (nessuna ricompressione); le sorgenti non JPEG vengono salvate a qualità 92
Per ogni hotspot con "crop" [x, y, w, h] (normalizzati sulla foto originale):
  public/crops/<id>-<n>.jpg      ritaglio alla risoluzione originale (n da 1), qualità 90

Le sorgenti non hanno profilo ICC: vengono trattate come sRGB e salvate senza conversioni di colore.
Uso: python3 scripts/images.py
"""
import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "source"
OUT_SCENES = ROOT / "public" / "scenes"
OUT_CROPS = ROOT / "public" / "crops"
MOBILE_MAX = 2560


def save_jpeg(im, path, quality):
    im.save(path, "JPEG", quality=quality, optimize=True, progressive=True, subsampling="4:4:4" if quality >= 90 else "4:2:0")


def main():
    data = json.loads((ROOT / "src" / "data" / "villa.json").read_text(encoding="utf-8"))
    OUT_SCENES.mkdir(parents=True, exist_ok=True)
    OUT_CROPS.mkdir(parents=True, exist_ok=True)

    for scene in data["scenes"]:
        src = scene.get("source")
        if not src:
            continue
        im = Image.open(SRC / src).convert("RGB")
        w, h = im.size
        name = Path(scene["image"]).name

        if Image.open(SRC / src).format == "JPEG":
            shutil.copyfile(SRC / src, OUT_SCENES / f"{name}_full.jpg")
        else:
            save_jpeg(im, OUT_SCENES / f"{name}_full.jpg", 92)
        mob = im
        if max(w, h) > MOBILE_MAX:
            s = MOBILE_MAX / max(w, h)
            mob = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
        save_jpeg(mob, OUT_SCENES / f"{name}_mobile.jpg", 82)

        for i, hs in enumerate(scene.get("hotspots", []), start=1):
            crop = hs.get("crop")
            if not crop:
                continue
            x, y, cw, ch = crop
            box = (round(x * w), round(y * h), round(min(1, x + cw) * w), round(min(1, y + ch) * h))
            save_jpeg(im.crop(box), OUT_CROPS / f"{scene['id']}-{i}.jpg", 90)

        print(f"{scene['id']:16s} {w}x{h}  hotspot: {len(scene.get('hotspots', []))}")


if __name__ == "__main__":
    main()
