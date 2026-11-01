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
MAX_PARALLEL = 2   # processi villa.py insieme al massimo (RAM del Pod: 31 GB)


def running_villa():
    n = 0
    for d in Path("/proc").iterdir():
        try:
            if d.name.isdigit() and b"villa.py" in (d / "cmdline").read_bytes():
                n += 1
        except OSError:
            pass
    return n


args = sys.argv[1:]
if args and args[0].startswith("--max="):      # --max=1: parte solo quando nessun altro render è in corso
    MAX_PARALLEL = int(args.pop(0).split("=", 1)[1])
for cmd in args:
    while running_villa() >= MAX_PARALLEL:
        time.sleep(15)
    t0 = time.time()
    print(f"=== {cmd}", flush=True)
    r = subprocess.run([sys.executable, str(HERE / "villa.py"), *shlex.split(cmd)])
    print(f"=== fine rc={r.returncode} in {time.time() - t0:.0f} s", flush=True)
