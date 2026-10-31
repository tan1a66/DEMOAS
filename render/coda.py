"""Coda di render sul Pod: esegue più comandi di villa.py uno dopo l'altro, in un solo lavoro.

Il container del Pod ha 31 GB di RAM: due processi Blender con tutta la villa ci stanno, sei no
(il kernel li termina con SIGKILL, rc -9). Uso:
  python render/runpod.py run coda -- render/coda.py "--time sunset --view orbit --frames 0-47 --skip-existing" "..."
"""
import shlex
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
for cmd in sys.argv[1:]:
    t0 = time.time()
    print(f"=== {cmd}", flush=True)
    r = subprocess.run([sys.executable, str(HERE / "villa.py"), *shlex.split(cmd)])
    print(f"=== fine rc={r.returncode} in {time.time() - t0:.0f} s", flush=True)
