"""Genera le mappe di profondità delle scene con Depth Anything V2 Small (licenza Apache 2.0).

Per ogni scena di src/data/villa.json con "source" e "depth":
  public/depth/<id>.png  scala di grigi 8 bit, bianco = vicino, nero = lontano, lato lungo 1024 px

Requisiti (fuori dal repository):
  python3 -m venv /home/user/.venv-depth
  /home/user/.venv-depth/bin/pip install -r scripts/requirements.txt
Uso:
  npm run depth                 (tutte le scene)
  npm run depth -- salon cocina (solo alcune)
Opzioni: --size 770  risoluzione di inferenza (multiplo di 14; il modello è addestrato a 518)
         --model depth-anything/Depth-Anything-V2-Small-hf
"""
import argparse
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFilter
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "depth"
MAX_SIDE = 1024


def normalize(disp):
    """Disparità relativa -> [0, 1] robusta ai valori estremi (bianco = vicino)."""
    lo, hi = np.percentile(disp, [0.5, 99.5])
    d = np.clip((disp - lo) / max(hi - lo, 1e-6), 0, 1)
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--size", type=int, default=770)
    ap.add_argument("--model", default="depth-anything/Depth-Anything-V2-Small-hf")
    args = ap.parse_args()

    data = json.loads((ROOT / "src" / "data" / "villa.json").read_text(encoding="utf-8"))
    scenes = [s for s in data["scenes"] if s.get("source") and s.get("depth")]
    if args.ids:
        scenes = [s for s in scenes if s["id"] in args.ids]

    torch.set_num_threads(max(1, torch.get_num_threads()))
    processor = AutoImageProcessor.from_pretrained(args.model)
    model = AutoModelForDepthEstimation.from_pretrained(args.model).eval()
    OUT.mkdir(parents=True, exist_ok=True)

    for scene in scenes:
        im = Image.open(ROOT / "public" / "source" / scene["source"]).convert("RGB")
        w, h = im.size
        inputs = processor(images=im, return_tensors="pt", size={"height": args.size, "width": args.size},
                           keep_aspect_ratio=True, ensure_multiple_of=14)
        with torch.no_grad():
            pred = model(**inputs).predicted_depth  # disparità relativa, più alta = più vicino
        pred = torch.nn.functional.interpolate(pred.unsqueeze(1), size=(h, w), mode="bicubic", align_corners=False)
        d = normalize(pred.squeeze().cpu().numpy())

        s = min(1.0, MAX_SIDE / max(w, h))
        out = Image.fromarray((d * 255).round().astype(np.uint8), "L")
        if s < 1:
            out = out.resize((round(w * s), round(h * s)), Image.LANCZOS)
        # Piccola dilatazione dei primi piani e ammorbidimento: i bordi degli oggetti vicini
        # si spostano interi e il visore non mostra gradini.
        out = out.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
        path = OUT / Path(scene["depth"]).name
        out.save(path, optimize=True)
        print(f"{scene['id']:16s} {w}x{h} -> {out.size[0]}x{out.size[1]}  {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
