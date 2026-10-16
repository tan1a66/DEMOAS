#!/usr/bin/env python3
"""TEMPORANEO — scarica a piena risoluzione le foto scelte e il video della terrazza dal sito ufficiale.

Le foto arrivano intatte in picheta/_source/full/ (l'ottimizzazione si fa in locale con scripts/images.py).
Il video si converte in un master 1920 px senza audio + fotogrammi di controllo. Da rimuovere dopo l'uso.
"""
import json
import subprocess
import urllib.request
from pathlib import Path

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
OUT = Path('picheta/_source/full')
OUT.mkdir(parents=True, exist_ok=True)
sel = json.loads(Path('.github/picheta/select.json').read_text())
log = []


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Referer': 'https://picheta.mx/'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


for name, url in sel['photos'].items():
    try:
        body = get(url)
        ext = url.rsplit('.', 1)[-1].lower()
        (OUT / f'{name}.{ext}').write_bytes(body)
        log.append(f'OK {name} {len(body)} {url}')
    except Exception as e:  # noqa: BLE001
        log.append(f'FAIL {name} {url} {e}')

try:
    raw = Path('/tmp/terraza.mp4')
    raw.write_bytes(get(sel['video']))
    log.append(f'VIDEO raw {raw.stat().st_size}')
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(raw)],
                           capture_output=True, text=True)
    (OUT / 'video-probe.json').write_text(probe.stdout)
    subprocess.run(['ffmpeg', '-y', '-i', str(raw), '-an', '-vf', "scale='min(1920,iw)':-2",
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
                    str(OUT / 'terraza-master.mp4')], check=True, capture_output=True)
    subprocess.run(['ffmpeg', '-y', '-i', str(raw), '-vf', 'fps=1/2,scale=480:-2,tile=4x4', '-frames:v', '1',
                    str(OUT / 'video-frames.jpg')], check=True, capture_output=True)
    log.append(f'VIDEO master {(OUT / "terraza-master.mp4").stat().st_size}')
except Exception as e:  # noqa: BLE001
    log.append(f'VIDEO FAIL {e}')

(OUT / 'log.txt').write_text('\n'.join(log))
print('\n'.join(log))
