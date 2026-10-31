# Render della villa (Blender + Cycles)

Obiettivo: render così credibili da far venire il dubbio che siano foto, poi resi navigabili
(giro esterno trascinando, 360° nelle stanze, voli renderizzati tra fuori e dentro).

- `lib.py`: coordinate della villa (come `src/data/villa.json`), materiali fisici (texture Poly Haven CC0,
  vetro architettonico, marmo nero procedurale, tessuti, mare), geometrie, luci, camera.
- `salon.py`: soggiorno a doppia altezza con vista sul mare, inquadratura della foto 08.
- `fetch_assets.py`: scarica texture e HDRI CC0 in `render/assets/` (fuori dal repository).

```bash
python3 -m venv /home/user/.venv-blender && /home/user/.venv-blender/bin/pip install bpy==5.2.3
python3 render/fetch_assets.py
/home/user/.venv-blender/bin/python render/salon.py --preview   # ~3,5 min su 4 core CPU
```
Il file `render/out/salon.blend` si apre in Blender 5.2 e si può modificare a mano.
