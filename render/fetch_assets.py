"""Scarica da Poly Haven (licenza CC0) le texture, gli HDRI e i modelli usati dal render della villa.

I file vanno in render/assets/ (fuori dal repository: si riscaricano con questo script).
Uso: python3 render/fetch_assets.py [--res 2k]
"""
import argparse
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "assets"
UA = {"User-Agent": "AlessiaStudio-VillaRender/1.0"}

# id Poly Haven: uso nella villa
TEXTURES = {
    "laminate_floor_02": "pavimento in rovere chiaro a doghe larghe",
    "oak_veneer_01": "boiserie e frontali in legno",
    "rustic_stone_wall_02": "muro in pietra a spacco",
    "concrete_layers_02": "cemento a vista con casseratura in tavole",
    "granite_tile": "lastre scure del portico",
    "wood_floor_deck": "deck esterno",
    "dry_ground_rocks": "terreno",
    "velour_velvet": "velluto delle poltrone",
}
MAPS = ["Diffuse", "Rough", "nor_gl", "Displacement"]
HDRIS = {"white_cliff_top": "4k"}  # cielo e mare dalle vetrate, luce di fine pomeriggio
MODELS = {}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def fetch_texture(asset_id, res):
    files = json.loads(get(f"https://api.polyhaven.com/files/{asset_id}"))
    d = OUT / "textures" / asset_id
    d.mkdir(parents=True, exist_ok=True)
    for m in MAPS:
        if m not in files:
            continue
        opts = files[m].get(res) or files[m][sorted(files[m])[0]]
        fmt = "jpg" if "jpg" in opts else "png"
        url = opts[fmt]["url"]
        dest = d / f"{m.lower()}.{fmt}"
        if not dest.exists():
            dest.write_bytes(get(url))
        print(f"  {asset_id}/{dest.name}")


def fetch_hdri(asset_id, res):
    files = json.loads(get(f"https://api.polyhaven.com/files/{asset_id}"))
    opts = files["hdri"].get(res) or files["hdri"]["2k"]
    dest = OUT / "hdri" / f"{asset_id}_{res}.hdr"
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        dest.write_bytes(get(opts["hdr"]["url"]))
    print(f"  hdri {dest.name}")


def fetch_model(asset_id, res):
    files = json.loads(get(f"https://api.polyhaven.com/files/{asset_id}"))
    blend = files["blend"].get(res) or files["blend"][sorted(files["blend"])[0]]
    d = OUT / "models" / asset_id
    d.mkdir(parents=True, exist_ok=True)
    main = blend["blend"]
    dest = d / Path(main["url"]).name
    if not dest.exists():
        dest.write_bytes(get(main["url"]))
    for rel, info in main.get("include", {}).items():
        p = d / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        if not p.exists():
            p.write_bytes(get(info["url"]))
    print(f"  model {asset_id}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--res", default="2k")
    a = ap.parse_args()
    for t in TEXTURES:
        fetch_texture(t, a.res)
    for h, res in HDRIS.items():
        fetch_hdri(h, res)
    for m in MODELS:
        fetch_model(m, a.res)


if __name__ == "__main__":
    main()
