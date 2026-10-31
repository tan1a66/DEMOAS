"""Pilota un Pod Runpod con GPU per i render (API REST, chiave in RUNPOD_API_KEY).

Comandi:
  python3 render/runpod.py up [--gpu "NVIDIA GeForce RTX 4090"] [--cloud COMMUNITY|SECURE]
  python3 render/runpod.py status            stato del Pod e dell'installazione di Blender
  python3 render/runpod.py push              invia render/*.py e src/data/villa.json
  python3 render/runpod.py run ID -- render/villa.py --preview   (lancia in background)
  python3 render/runpod.py job ID            stato e log del lavoro
  python3 render/runpod.py wait ID           aspetta la fine del lavoro
  python3 render/runpod.py pull REMOTO LOCALE   scarica un file (o una cartella) da /work
  python3 render/runpod.py down              TERMINA il Pod (smette di costare)

Lo stato (id del Pod, token del server) è in render/.runpod.json (fuori dal repository).
La chiave non viene mai stampata né scritta su file.
"""
import argparse
import base64
import io
import json
import os
import secrets
import sys
import tarfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
STATE = ROOT / ".runpod.json"
API = "https://rest.runpod.io/v1"
IMAGE = "nvidia/cuda:12.6.3-base-ubuntu24.04"
UA = "villa-render/1.0 (+curl compatible)"  # Cloudflare rifiuta "Python-urllib" (errore 1010)


def key():
    k = os.environ.get("RUNPOD_API_KEY")
    if not k:
        sys.exit("RUNPOD_API_KEY non impostata nell'ambiente.")
    return k


def api(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Authorization", f"Bearer {key()}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", UA)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"API {method} {path}: {e.code} {e.read().decode(errors='replace')[:500]}")


def load():
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def save(s):
    STATE.write_text(json.dumps(s, indent=2))


def farm(method, path, data=None, raw=False, timeout=600):
    s = load()
    url = f"https://{s['pod']}-8000.proxy.runpod.net{path}"
    req = urllib.request.Request(url, method=method, data=data)
    req.add_header("X-Token", s["token"])
    req.add_header("User-Agent", UA)
    if isinstance(data, (bytes, bytearray)) and path.startswith("/run"):
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            b = r.read()
            return b if raw else json.loads(b)
    except urllib.error.HTTPError as e:
        return {"http_error": e.code, "body": e.read().decode(errors="replace")[:500]}
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}


def cmd_up(a):
    s = load()
    if s.get("pod"):
        print("Pod già creato:", s["pod"])
        return
    token = secrets.token_hex(16)
    srv = base64.b64encode((ROOT / "farm_server.py").read_bytes()).decode()
    body = {
        "name": "villa-render",
        "imageName": IMAGE,
        "computeType": "GPU",
        "cloudType": a.cloud,
        "gpuTypeIds": [a.gpu],
        "gpuCount": 1,
        "containerDiskInGb": 60,
        "volumeInGb": 0,
        "ports": ["8000/http"],
        "env": {"FARM_TOKEN": token, "FARM_SRV": srv, "NVIDIA_DRIVER_CAPABILITIES": "all"},
        "dockerStartCmd": ["bash", "-c",
                           "apt-get update -q && apt-get install -y -q python3 >/dev/null && "
                           "echo \"$FARM_SRV\" | base64 -d > /farm_server.py && python3 /farm_server.py"],
    }
    r = api("POST", "/pods", body)
    save({"pod": r["id"], "token": token, "created": time.time(), "gpu": a.gpu})
    print("Pod creato:", r["id"], r.get("costPerHr", ""), "$/h")


def cmd_status(a):
    s = load()
    if not s.get("pod"):
        print("Nessun Pod.")
        return
    p = api("GET", f"/pods/{s['pod']}")
    print("Pod", s["pod"], p.get("desiredStatus"), "costo/h", p.get("costPerHr"))
    print(json.dumps(farm("GET", "/health", timeout=20), indent=1)[:2500])


def cmd_push(a):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        for f in sorted(ROOT.glob("*.py")):
            tf.add(f, arcname=f"render/{f.name}")
        tf.add(REPO / "src/data/villa.json", arcname="src/data/villa.json")
    r = farm("POST", "/upload", buf.getvalue())
    print(r)


def cmd_run(a):
    r = farm("POST", "/run", json.dumps({"id": a.id, "args": a.args}).encode())
    print(r)


def cmd_job(a):
    r = farm("GET", f"/job?id={a.id}&n=30", timeout=30)
    print(json.dumps(r, indent=1) if "log" not in r else f"running={r['running']} rc={r['returncode']}\n{r['log']}")


def cmd_wait(a):
    while True:
        r = farm("GET", f"/job?id={a.id}&n=3", timeout=30)
        if r.get("running") is False:
            print("rc", r["returncode"], "\n", r["log"])
            return
        time.sleep(10)


def cmd_pull(a):
    s = farm("GET", f"/ls?path={a.remote}", timeout=60)
    dest = Path(a.local)
    if isinstance(s, list) and s:
        dest.mkdir(parents=True, exist_ok=True)
        for it in s:
            if not it["dir"]:
                (dest / it["name"]).write_bytes(farm("GET", f"/file?path={a.remote}/{it['name']}", raw=True))
                print("  ", it["name"])
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(farm("GET", f"/file?path={a.remote}", raw=True))
        print("  ", dest)


def cmd_down(a):
    s = load()
    if not s.get("pod"):
        print("Nessun Pod.")
        return
    api("DELETE", f"/pods/{s['pod']}")
    hours = (time.time() - s.get("created", time.time())) / 3600
    print(f"Pod {s['pod']} terminato dopo {hours:.2f} h.")
    STATE.unlink()


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    u = sp.add_parser("up")
    u.add_argument("--gpu", default="NVIDIA GeForce RTX 4090")
    u.add_argument("--cloud", default="COMMUNITY")
    sp.add_parser("status")
    sp.add_parser("push")
    r = sp.add_parser("run")
    r.add_argument("id")
    r.add_argument("args", nargs=argparse.REMAINDER)
    j = sp.add_parser("job")
    j.add_argument("id")
    w = sp.add_parser("wait")
    w.add_argument("id")
    p = sp.add_parser("pull")
    p.add_argument("remote")
    p.add_argument("local")
    sp.add_parser("down")
    a = ap.parse_args()
    if a.cmd == "run" and a.args and a.args[0] == "--":
        a.args = a.args[1:]
    globals()[f"cmd_{a.cmd}"](a)


if __name__ == "__main__":
    main()
