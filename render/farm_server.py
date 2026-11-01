"""Piccolo server di lavoro che gira sul Pod Runpod (GPU) e renderizza con Blender (bpy).

Viene avviato da render/runpod.py (non va lanciato a mano). Solo libreria standard.
Al primo avvio installa Python 3.13 e bpy 5.2.3 (con supporto CUDA/OptiX) in /venv.

Tutte le richieste richiedono l'intestazione  X-Token: <FARM_TOKEN>.
  GET  /health                 stato dell'installazione e GPU
  POST /upload                 corpo = archivio .tar.gz, estratto in /work
  POST /run    {"id","args"}   esegue /venv/bin/python <args...> in /work (in background)
  GET  /job?id=                stato del lavoro e ultime righe del log
  GET  /ls?path=               elenco file in /work/<path>
  GET  /file?path=             scarica /work/<path>

Sicurezza sul credito: dopo FARM_IDLE_MIN minuti (45) senza lavori e senza richieste il Pod si termina
da solo con la chiave che Runpod gli assegna (RUNPOD_API_KEY / RUNPOD_POD_ID). Scaricare i risultati prima!
"""
import json
import os
import subprocess
import time
import urllib.request
import tarfile
import threading
import io
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

TOKEN = os.environ.get("FARM_TOKEN", "")
WORK = Path("/work")
WORK.mkdir(parents=True, exist_ok=True)
LOGS = WORK / "logs"
LOGS.mkdir(exist_ok=True)
SETUP_LOG = LOGS / "setup.log"
JOBS = {}
STATE = {"ready": False, "error": None}
IDLE_LIMIT = int(os.environ.get("FARM_IDLE_MIN", "45")) * 60
LAST = {"t": time.time()}


def busy():
    return any(j["proc"].poll() is None for j in JOBS.values())


def self_terminate():
    """Termina il Pod da solo (chiave che Runpod mette nel Pod): niente costi se la sessione si interrompe."""
    key, pod = os.environ.get("RUNPOD_API_KEY"), os.environ.get("RUNPOD_POD_ID")
    if not key or not pod:
        return "manca RUNPOD_API_KEY/RUNPOD_POD_ID nel Pod"
    tries = [("DELETE", f"https://rest.runpod.io/v1/pods/{pod}", None),
             ("POST", "https://api.runpod.io/graphql",
              json.dumps({"query": f'mutation {{ podTerminate(input: {{podId: "{pod}"}}) }}'}).encode())]
    for method, url, body in tries:
        try:
            req = urllib.request.Request(url, method=method, data=body)
            req.add_header("Authorization", f"Bearer {key}")
            req.add_header("Content-Type", "application/json")
            req.add_header("User-Agent", "villa-render/1.0")
            urllib.request.urlopen(req, timeout=30).read()
            return "ok"
        except Exception as e:  # noqa: BLE001
            err = str(e)
    return err


def watchdog():
    while True:
        time.sleep(60)
        if busy():
            LAST["t"] = time.time()
        elif time.time() - LAST["t"] > IDLE_LIMIT:
            STATE["shutdown"] = self_terminate()
            time.sleep(600)

SETUP = r"""
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q curl ca-certificates libx11-6 libxi6 libxxf86vm1 libxfixes3 libxrender1 libxkbcommon0 \
  libsm6 libice6 libgl1 libegl1 libglu1-mesa libxext6 libwayland-client0 >/dev/null
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
uv python install 3.13
uv venv /venv --python 3.13
uv pip install --python /venv/bin/python bpy==5.2.3 pillow numpy
/venv/bin/python -c "import bpy; print('bpy', bpy.app.version_string)"
nvidia-smi || true
"""


def setup():
    try:
        with open(SETUP_LOG, "w") as log:
            r = subprocess.run(["bash", "-c", SETUP], stdout=log, stderr=subprocess.STDOUT)
        if r.returncode != 0:
            STATE["error"] = f"setup exit {r.returncode}"
        else:
            STATE["ready"] = True
    except Exception as e:  # noqa: BLE001
        STATE["error"] = str(e)


def tail(path, n=40):
    try:
        return "".join(Path(path).read_text(errors="replace").splitlines(True)[-n:])
    except FileNotFoundError:
        return ""


def safe(rel):
    p = (WORK / (rel or "")).resolve()
    if not str(p).startswith(str(WORK)):
        raise ValueError("path")
    return p


class H(BaseHTTPRequestHandler):
    def _auth(self):
        if not TOKEN or self.headers.get("X-Token") != TOKEN:
            self._send(403, {"error": "token"})
            return False
        LAST["t"] = time.time()
        return True

    def _send(self, code, obj=None, raw=None, ctype="application/json"):
        body = raw if raw is not None else json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass

    def do_GET(self):
        if not self._auth():
            return
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path == "/health":
            gpu = subprocess.run(["bash", "-c", "nvidia-smi --query-gpu=name,memory.used,utilization.gpu --format=csv,noheader || true"],
                                 capture_output=True, text=True).stdout.strip()
            idle = 0 if busy() else int(time.time() - LAST["t"])
            return self._send(200, {**STATE, "gpu": gpu, "idle_s": idle, "idle_limit_s": IDLE_LIMIT,
                                    "self_kill": bool(os.environ.get("RUNPOD_API_KEY") and os.environ.get("RUNPOD_POD_ID")),
                                    "setup_log": tail(SETUP_LOG, 15)})
        if u.path == "/job":
            j = JOBS.get(q.get("id"))
            if not j:
                return self._send(404, {"error": "job"})
            rc = j["proc"].poll()
            return self._send(200, {"id": q["id"], "running": rc is None, "returncode": rc, "log": tail(j["log"], int(q.get("n", 40)))})
        if u.path == "/ls":
            p = safe(q.get("path", ""))
            items = [{"name": x.name, "size": x.stat().st_size, "dir": x.is_dir()} for x in sorted(p.iterdir())] if p.is_dir() else []
            return self._send(200, items)
        if u.path == "/file":
            p = safe(q.get("path", ""))
            if not p.is_file():
                return self._send(404, {"error": "file"})
            return self._send(200, raw=p.read_bytes(), ctype="application/octet-stream")
        self._send(404, {"error": "route"})

    def do_POST(self):
        if not self._auth():
            return
        u = urlparse(self.path)
        n = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(n) if n else b""
        if u.path == "/upload":
            with tarfile.open(fileobj=io.BytesIO(body), mode="r:gz") as tf:
                tf.extractall(WORK, filter="data")
            return self._send(200, {"ok": True, "bytes": n})
        if u.path == "/run":
            if not STATE["ready"]:
                return self._send(409, {"error": "not ready", **STATE})
            req = json.loads(body or b"{}")
            jid = req.get("id") or f"job{len(JOBS) + 1}"
            log = LOGS / f"{jid}.log"
            f = open(log, "w")
            env = {**os.environ, "PYTHONUNBUFFERED": "1"}
            proc = subprocess.Popen(["/venv/bin/python", *req["args"]], cwd=WORK, stdout=f, stderr=subprocess.STDOUT, env=env)
            JOBS[jid] = {"proc": proc, "log": log}
            return self._send(200, {"id": jid})
        self._send(404, {"error": "route"})


if __name__ == "__main__":
    threading.Thread(target=setup, daemon=True).start()
    threading.Thread(target=watchdog, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", 8000), H).serve_forever()
