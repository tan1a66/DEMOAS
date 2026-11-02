"""
Sa Calobra — pipeline dei dati geografici (Fase 1).

Uso:
  python3 -I scripts/build_data.py --osm <map.osm> --cache <cartella tile> [--zoom 13|14] [--cell 8]

Input
  --osm    estratto OpenStreetMap (API v0.6 /map, bbox 2.790,39.820,2.830,39.860)
  --cache  cartella dove vengono scaricate (e riusate) le tile AWS Terrain (Terrarium)

Output (relativi alla cartella del progetto)
  data/road.geojson          strada MA-2141 originale OSM, unita e ordinata dalla cima al mare
  data/keypoints.json        TOP / CORBATA / PORT (lat/lon + coordinate locali)
  public/data/terrain.png    heightmap 16 bit (scala grigi) con la sede stradale scavata
  public/data/terrain.json   metadati della heightmap (estensione, quote min/max, origine)
  public/data/road.json      strada in coordinate locali: punti 3D lisciati ogni ROAD_STEP m
  docs/checkpoint1.png       anteprima 2D (heightmap + strada + punti chiave + profilo)

Sistema di coordinate locale (uguale a Three.js):
  origine al centro dell'area, x = est (m), y = quota (m s.l.m.), z = sud (m)  →  nord = -z
"""

import argparse, io, json, math, os, sys, time, urllib.request
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- parametri
MARGIN_M = 1500          # margine attorno alla strada
MARGIN_NORTH_M = 2300    # più margine a nord: il mare davanti al porto
ROAD_STEP = 2.0          # passo di ricampionamento della strada (m)
XY_SMOOTH_SIGMA = 2.5    # lisciatura planimetrica (m): arrotonda gli spigoli OSM
# lisciatura del profilo altimetrico, diversa per sorgente (DEM grossolano = più lisciatura)
PROFILE = {
    "aws": {"median_m": 80, "sigma_m": 45.0, "outlier_m": 12.0},  # ~30 m: molto rumore nelle gole
    "ign": {"median_m": 14, "sigma_m": 20.0, "outlier_m": 3.5},   # MDT05 LIDAR 5 m: strada già nel dato
}
OUTLIER_BASE_M = 120     # finestra della linea di base per lo scarto dei campioni anomali
BRIDGE_PAD_M = 12        # attorno a ponti/gallerie il DEM non vale: si interpola
CARVE_HALF = 4.0         # metà della fascia piana (8 m totali)
CARVE_FALLOFF = 18.0     # raccordo morbido ai lati (m)
CARVE_DEPTH = 0.25       # il terreno sta appena sotto l'asfalto (m)

TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
UA = "AlessiaStudio-SaCalobra-demo/1.0"

# WGS84
A_WGS = 6378137.0
E2 = 6.69437999014e-3


# ---------------------------------------------------------------- OSM
def load_osm(path):
    root = ET.parse(path).getroot()
    nodes = {}
    for n in root.iter("node"):
        tags = {t.get("k"): t.get("v") for t in n.findall("tag")}
        nodes[n.get("id")] = (float(n.get("lat")), float(n.get("lon")), tags)
    ways = []
    for w in root.iter("way"):
        tags = {t.get("k"): t.get("v") for t in w.findall("tag")}
        ways.append((w.get("id"), [nd.get("ref") for nd in w.findall("nd")], tags))
    return nodes, ways


def chain_ma2141(nodes, ways):
    """Unisce i tratti con ref=Ma-2141 in un'unica polilinea (cammino semplice)."""
    segs = [w for w in ways if w[2].get("ref", "").lower() == "ma-2141" and "highway" in w[2]]
    ends = {}
    for i, (_, nds, _) in enumerate(segs):
        ends.setdefault(nds[0], []).append(i)
        ends.setdefault(nds[-1], []).append(i)
    # un estremo con un solo tratto collegato = inizio o fine della strada
    terminals = [n for n, l in ends.items() if len(l) == 1]
    assert len(terminals) == 2, f"attesi 2 estremi liberi, trovati {len(terminals)}"
    # partiamo dall'estremo più a sud (incrocio con la Ma-10), arriviamo al porto
    start = min(terminals, key=lambda n: nodes[n][0])
    pts, flags, way_ids, used, cur = [], [], [], set(), start
    while True:
        nxt = [i for i in ends[cur] if i not in used]
        if not nxt:
            break
        i = nxt[0]
        used.add(i)
        wid, nds, tags = segs[i]
        if nds[0] != cur:
            nds = nds[::-1]
        kind = "bridge" if tags.get("bridge") == "yes" else "tunnel" if tags.get("tunnel") == "yes" else "road"
        for k, nid in enumerate(nds):
            if pts and k == 0:
                continue
            pts.append(nid)
            flags.append(kind if k > 0 else "road")  # flag del segmento che ARRIVA al punto
        way_ids.append(int(wid))
        cur = nds[-1]
    assert len(used) == len(segs), "alcuni tratti Ma-2141 non sono collegati"
    return pts, flags, way_ids


# ---------------------------------------------------------------- proiezione locale
class LocalProj:
    """Piano tangente locale (raggi di curvatura WGS84 all'origine). Errore < 0,1% su 7 km."""

    def __init__(self, lat0, lon0):
        self.lat0, self.lon0 = lat0, lon0
        s = math.sin(math.radians(lat0))
        w = 1 - E2 * s * s
        self.M = A_WGS * (1 - E2) / w ** 1.5
        self.N = A_WGS / math.sqrt(w)
        self.kx = self.N * math.cos(math.radians(lat0)) * math.pi / 180
        self.ky = self.M * math.pi / 180

    def fwd(self, lat, lon):
        """→ (x est, z sud) in metri"""
        return (np.asarray(lon) - self.lon0) * self.kx, -(np.asarray(lat) - self.lat0) * self.ky

    def inv(self, x, z):
        return self.lat0 - np.asarray(z) / self.ky, self.lon0 + np.asarray(x) / self.kx


# ---------------------------------------------------------------- tile Terrarium
def merc_px(lat, lon, z):
    n = 256 * 2 ** z
    lat = np.radians(lat)
    px = (np.asarray(lon) + 180) / 360 * n
    py = (1 - np.log(np.tan(lat) + 1 / np.cos(lat)) / math.pi) / 2 * n
    return px, py


def fetch_tile(cache, z, x, y):
    path = os.path.join(cache, f"{z}_{x}_{y}.png")
    if not os.path.exists(path):
        url = TERRARIUM.format(z=z, x=x, y=y)
        for attempt in range(4):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                data = urllib.request.urlopen(req, timeout=60).read()
                break
            except Exception as e:  # rete instabile: riprova
                if attempt == 3:
                    raise
                time.sleep(2 ** (attempt + 1))
        with open(path, "wb") as f:
            f.write(data)
    img = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)
    return img[..., 0] * 256 + img[..., 1] + img[..., 2] / 256 - 32768


class Mosaic:
    def __init__(self, cache, z, lat_min, lat_max, lon_min, lon_max):
        self.z = z
        x0, y1 = merc_px(lat_min, lon_min, z)
        x1, y0 = merc_px(lat_max, lon_max, z)
        tx0, tx1 = int(x0 // 256), int(x1 // 256)
        ty0, ty1 = int(y0 // 256), int(y1 // 256)
        self.ox, self.oy = tx0 * 256, ty0 * 256
        rows = []
        for ty in range(ty0, ty1 + 1):
            rows.append(np.hstack([fetch_tile(cache, z, tx, ty) for tx in range(tx0, tx1 + 1)]))
        self.h = np.vstack(rows)
        self.tiles = (tx1 - tx0 + 1) * (ty1 - ty0 + 1)
        self.bytes = sum(os.path.getsize(os.path.join(cache, f"{z}_{tx}_{ty}.png"))
                         for tx in range(tx0, tx1 + 1) for ty in range(ty0, ty1 + 1))

    def sample(self, lat, lon):
        """Interpolazione bilineare (valore del pixel al suo centro)."""
        px, py = merc_px(lat, lon, self.z)
        fx, fy = px - self.ox - 0.5, py - self.oy - 0.5
        ix, iy = np.floor(fx).astype(int), np.floor(fy).astype(int)
        tx, ty = fx - ix, fy - iy
        H = self.h
        ix = np.clip(ix, 0, H.shape[1] - 2)
        iy = np.clip(iy, 0, H.shape[0] - 2)
        a = H[iy, ix] * (1 - tx) + H[iy, ix + 1] * tx
        b = H[iy + 1, ix] * (1 - tx) + H[iy + 1, ix + 1] * tx
        return a * (1 - ty) + b * ty


class IGNMosaic:
    """MDT05 dell'IGN (CNIG) da WCS INSPIRE, EPSG:4258, passo 0,000045° (~5 m), interi in metri.
    I blocchi GeoTIFF sono scaricati da fetch_ign.sh; il mare vale 0."""

    def __init__(self, folder):
        tiles = []
        for fn in sorted(os.listdir(folder)):
            if not (fn.startswith("ign5_") and fn.endswith(".tif")):
                continue
            im = Image.open(os.path.join(folder, fn))
            sx, sy, _ = im.tag_v2[33550]
            _, _, _, lon0, lat0, _ = im.tag_v2[33922]
            tiles.append((lat0, lon0, sx, sy, np.asarray(im, dtype=np.float64)))
        assert tiles, "nessun blocco ign5_*.tif"
        self.d = tiles[0][2]
        lat_top = max(t[0] for t in tiles)
        lon_left = min(t[1] for t in tiles)
        ny = int(round((lat_top - min(t[0] - t[4].shape[0] * self.d for t in tiles)) / self.d))
        nx = int(round((max(t[1] + t[4].shape[1] * self.d for t in tiles) - lon_left) / self.d))
        self.h = np.zeros((ny, nx))
        for lat0, lon0, _, _, a in tiles:
            j = int(round((lat_top - lat0) / self.d)); i = int(round((lon0 - lon_left) / self.d))
            self.h[j:j + a.shape[0], i:i + a.shape[1]] = a
        self.lat_top, self.lon_left = lat_top, lon_left
        self.tiles = len(tiles)
        self.bytes = sum(os.path.getsize(os.path.join(folder, f)) for f in os.listdir(folder) if f.startswith("ign5_"))

    def sample(self, lat, lon):
        fx = (np.asarray(lon) - self.lon_left) / self.d - 0.5
        fy = (self.lat_top - np.asarray(lat)) / self.d - 0.5
        ix, iy = np.floor(fx).astype(int), np.floor(fy).astype(int)
        tx, ty = fx - ix, fy - iy
        H = self.h
        ix = np.clip(ix, 0, H.shape[1] - 2); iy = np.clip(iy, 0, H.shape[0] - 2)
        a = H[iy, ix] * (1 - tx) + H[iy, ix + 1] * tx
        b = H[iy + 1, ix] * (1 - tx) + H[iy + 1, ix + 1] * tx
        return a * (1 - ty) + b * ty


# ---------------------------------------------------------------- utilità 1D
def resample_polyline(xy, step):
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(xy, axis=0).T))]
    s = np.arange(0, d[-1], step)
    s = np.r_[s, d[-1]]
    return np.c_[np.interp(s, d, xy[:, 0]), np.interp(s, d, xy[:, 1])], s, d


def gauss1d(v, sigma_samples):
    """Gaussiana 1D con bordi 'nearest' (niente scipy)."""
    r = int(math.ceil(sigma_samples * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma_samples) ** 2)
    k /= k.sum()
    p = np.pad(v, (r, r), mode="edge")
    return np.convolve(p, k, mode="valid")


def median1d(v, win):
    r = win // 2
    p = np.pad(v, (r, r), mode="edge")
    w = np.lib.stride_tricks.sliding_window_view(p, win)
    return np.median(w, axis=1)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", required=True)
    ap.add_argument("--cache", required=True)
    ap.add_argument("--zoom", type=int, default=13)
    ap.add_argument("--cell", type=float, default=8.0)
    ap.add_argument("--compare", action="store_true", help="confronta zoom 13 e 14")
    ap.add_argument("--dem", choices=["aws", "ign"], default="aws", help="sorgente del rilievo")
    ap.add_argument("--ign", help="cartella con i blocchi ign5_*.tif (solo --dem ign)")
    ap.add_argument("--out-suffix", default="", help="suffisso per i file di anteprima/confronto")
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)

    nodes, ways = load_osm(args.osm)
    ids, flags, way_ids = chain_ma2141(nodes, ways)
    lat = np.array([nodes[i][0] for i in ids])
    lon = np.array([nodes[i][1] for i in ids])

    # --- punti chiave da OSM (cercati per nome/tag, non inventati)
    def find_node(**kv):
        for nid, (la, lo, t) in nodes.items():
            if all(t.get(k) == v for k, v in kv.items()):
                return nid, la, lo, t
        raise KeyError(kv)

    coll_id, coll_lat, coll_lon, coll_tags = find_node(name="Coll dels Reis", mountain_pass="yes")
    nus_id, nus_lat, nus_lon, _ = find_node(name="Nus de sa Corbata")
    port_id, port_lat, port_lon, _ = find_node(name="Sa Calobra", amenity="ferry_terminal")
    # il ponte del Nus: tratto Ma-2141 con bridge=yes più vicino al nodo "Nus de sa Corbata"
    bridges = [w for w in ways if w[2].get("ref", "").lower() == "ma-2141" and w[2].get("bridge") == "yes"]
    def wmid(w):
        return np.mean([nodes[n][0] for n in w[1]]), np.mean([nodes[n][1] for n in w[1]])
    nus_bridge = min(bridges, key=lambda w: (wmid(w)[0] - nus_lat) ** 2 + (wmid(w)[1] - nus_lon) ** 2)
    corb_lat, corb_lon = wmid(nus_bridge)

    # --- taglio: la strada inizia al Coll dels Reis (il tratto fino alla Ma-10 resta fuori)
    tmp = LocalProj(coll_lat, coll_lon)
    cx, cz = tmp.fwd(lat, lon)
    i0 = int(np.argmin(np.hypot(cx, cz)))
    lat, lon, flags, ids = lat[i0:], lon[i0:], flags[i0:], ids[i0:]
    flags[0] = "road"

    # --- road.geojson (geometria OSM originale, lon/lat)
    seg_l = np.hypot(*np.diff(np.c_[cx[i0:], cz[i0:]], axis=0).T)
    gj = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {
                "name": "Ma-2141 — Coll dels Reis → Port de Sa Calobra",
                "source": "© OpenStreetMap contributors (ODbL), API v0.6",
                "osm_ways": way_ids,
                "start_node": int(coll_id),
                "length_m": round(float(seg_l.sum()), 1),
                "segment_kind": flags[1:],
            },
            "geometry": {"type": "LineString", "coordinates": [[round(a, 7), round(b, 7)] for a, b in zip(lon, lat)]},
        }],
    }
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    with open(os.path.join(ROOT, "data", "road.geojson"), "w") as f:
        json.dump(gj, f)

    # --- area: strada + margini, origine al centro
    p0 = LocalProj(float(lat.mean()), float(lon.mean()))
    rx, rz = p0.fwd(lat, lon)
    x_min, x_max = rx.min() - MARGIN_M, rx.max() + MARGIN_M
    z_min, z_max = rz.min() - MARGIN_NORTH_M, rz.max() + MARGIN_M
    c_lat, c_lon = p0.inv((x_min + x_max) / 2, (z_min + z_max) / 2)
    P = LocalProj(float(c_lat), float(c_lon))
    cell = args.cell
    W = math.ceil((x_max - x_min) / cell) * cell
    H = math.ceil((z_max - z_min) / cell) * cell
    nx, nz = int(W / cell) + 1, int(H / cell) + 1
    gx = -W / 2 + np.arange(nx) * cell
    gz = -H / 2 + np.arange(nz) * cell        # riga 0 = nord (z negativo)
    GX, GZ = np.meshgrid(gx, gz)
    glat, glon = P.inv(GX, GZ)
    bb = (glat.min() - 0.002, glat.max() + 0.002, glon.min() - 0.002, glon.max() + 0.002)

    # --- confronto zoom 13 / 14
    report = {}
    mos = {}
    for z in ([13, 14] if args.compare else [args.zoom]):
        m = Mosaic(args.cache, z, *bb)
        mos[z] = m
        report[z] = {"tiles": m.tiles, "kB": round(m.bytes / 1024)}
    if args.compare:
        a = mos[13].sample(glat, glon)
        b = mos[14].sample(glat, glon)
        lap = lambda h: (np.abs(h[1:-1, 2:] + h[1:-1, :-2] + h[2:, 1:-1] + h[:-2, 1:-1] - 4 * h[1:-1, 1:-1])).mean()
        report["diff_rms_m"] = float(np.sqrt(np.mean((a - b) ** 2)))
        report["laplacian_z13"] = float(lap(a))
        report["laplacian_z14"] = float(lap(b))
        # quante coppie di pixel adiacenti uguali nella z14 (dato sovracampionato?)
        h14 = mos[14].h
        report["z14_equal_neighbours_%"] = float((h14[:, 1:] == h14[:, :-1]).mean() * 100)
        h13 = mos[13].h
        report["z13_equal_neighbours_%"] = float((h13[:, 1:] == h13[:, :-1]).mean() * 100)
    aws = mos[args.zoom]
    if args.dem == "ign":
        M = IGNMosaic(args.ign)
        report["ign"] = {"tiles": M.tiles, "kB": round(M.bytes / 1024)}
        terrain = M.sample(glat, glon)
        # mare: l'IGN vale 0, il fondale lo prende dalle tile AWS (batimetria), sempre ≤ -2 m
        sea = terrain <= 0.5
        terrain[sea] = np.minimum(aws.sample(glat, glon)[sea], -2.0)
    else:
        M = aws
        terrain = M.sample(glat, glon)

    # --- strada in coordinate locali, ricampionata e lisciata
    rx, rz = P.fwd(lat, lon)
    xy = np.c_[rx, rz]
    seg_len = np.hypot(*np.diff(xy, axis=0).T)
    d_orig = np.r_[0, np.cumsum(seg_len)]
    rs, s, _ = resample_polyline(xy, ROAD_STEP)
    sig = XY_SMOOTH_SIGMA / ROAD_STEP
    rs_s = np.c_[gauss1d(rs[:, 0], sig), gauss1d(rs[:, 1], sig)]
    rs_s[0], rs_s[-1] = rs[0], rs[-1]
    # tipo di segmento (strada / ponte / galleria) per ogni campione
    seg_idx = np.clip(np.searchsorted(d_orig, s, side="right") - 1, 0, len(flags) - 2)
    kind = np.array([flags[i + 1] for i in seg_idx])

    # profilo: campiona il DEM (non scavato), mediana + gaussiana
    slat, slon = P.inv(rs_s[:, 0], rs_s[:, 1])
    raw = M.sample(slat, slon)
    # su ponti e gallerie il DEM misura il suolo sotto/sopra la strada: si interpola tra i lati
    bad = np.zeros(len(raw), bool)
    pad = int(BRIDGE_PAD_M / ROAD_STEP)
    for k in np.where(kind != "road")[0]:
        bad[max(k - pad, 0):k + pad + 1] = True
    fixed = raw.copy()
    fixed[bad] = np.interp(s[bad], s[~bad], raw[~bad])
    pp = PROFILE[args.dem]
    win = int(pp["median_m"] / ROAD_STEP) | 1
    # scarto robusto: i campioni lontani da una linea di base molto liscia (rocce a strapiombo,
    # tracciato OSM spostato di qualche metro sul pendio) vengono sostituiti per interpolazione
    for _ in range(2):
        base = gauss1d(median1d(fixed, int(OUTLIER_BASE_M / ROAD_STEP) | 1), OUTLIER_BASE_M / 2 / ROAD_STEP)
        out = np.abs(fixed - base) > pp["outlier_m"]
        bad |= out
        fixed = raw.copy()
        fixed[bad] = np.interp(s[bad], s[~bad], raw[~bad])
    prof = gauss1d(median1d(fixed, win), pp["sigma_m"] / ROAD_STEP)
    # gli estremi tengono la quota del DEM lisciato localmente (niente "trascinamento")
    grade = np.diff(prof) / ROAD_STEP * 100

    # --- scavo della sede stradale nella heightmap
    carved = terrain.copy()
    best_d = np.full(terrain.shape, np.inf)
    best_h = np.zeros(terrain.shape)
    reach = CARVE_HALF + CARVE_FALLOFF
    r_cells = int(math.ceil(reach / cell)) + 1
    for k in range(len(rs_s)):
        if kind[k] != "road":
            continue  # sotto un ponte / sopra una galleria il terreno non segue questa strada
        px, pz = rs_s[k]
        ci = int(round((px + W / 2) / cell))
        cj = int(round((pz + H / 2) / cell))
        i0_, i1_ = max(ci - r_cells, 0), min(ci + r_cells + 1, nx)
        j0_, j1_ = max(cj - r_cells, 0), min(cj + r_cells + 1, nz)
        d = np.hypot(GX[j0_:j1_, i0_:i1_] - px, GZ[j0_:j1_, i0_:i1_] - pz)
        sub_d = best_d[j0_:j1_, i0_:i1_]
        upd = d < sub_d
        sub_d[upd] = d[upd]
        best_h[j0_:j1_, i0_:i1_][upd] = prof[k]
    t = smoothstep(CARVE_HALF, reach, best_d)
    mask = np.isfinite(best_d)
    carved[mask] = (best_h[mask] - CARVE_DEPTH) * (1 - t[mask]) + terrain[mask] * t[mask]

    # --- export heightmap 16 bit
    hmin, hmax = float(np.floor(carved.min())), float(np.ceil(carved.max()))
    q = np.round((carved - hmin) / (hmax - hmin) * 65535).astype(np.uint16)
    os.makedirs(os.path.join(ROOT, "public", "data"), exist_ok=True)
    Image.fromarray(q).save(os.path.join(ROOT, "public", "data", "terrain.png"), optimize=True)
    meta = {
        "width": nx, "height": nz, "cell": cell,
        "extent": {"xMin": -W / 2, "xMax": W / 2, "zMin": -H / 2, "zMax": H / 2},
        "hMin": hmin, "hMax": hmax,
        "encoding": "uint16 grayscale PNG: h = hMin + v/65535*(hMax-hMin); row 0 = zMin (nord), col 0 = xMin (ovest)",
        "origin": {"lat": round(float(c_lat), 7), "lon": round(float(c_lon), 7)},
        "axes": "x = est, y = quota (m s.l.m.), z = sud",
        "source": (f"IGN MDT05 (CNIG, CC-BY 4.0) + batimetria AWS Terrain Tiles z{args.zoom}, ricampionati a {cell} m"
                   if args.dem == "ign" else f"AWS Terrain Tiles (Terrarium) z{args.zoom}, ricampionate a {cell} m"),
        "carve": {"half": CARVE_HALF, "falloff": CARVE_FALLOFF, "depth": CARVE_DEPTH},
    }
    with open(os.path.join(ROOT, "public", "data", "terrain.json"), "w") as f:
        json.dump(meta, f, indent=1)

    # --- punti chiave
    def local(la, lo):
        x, z = P.fwd(la, lo)
        return float(x), float(z)
    def nearest_idx(x, z, skip_bridge=False):
        d = np.hypot(rs_s[:, 0] - x, rs_s[:, 1] - z)
        if skip_bridge:
            d[kind == "bridge"] = np.inf
        return int(np.argmin(d))
    tx_, tz_ = local(corb_lat, corb_lon)
    corb_idx = int(np.argmin(np.hypot(rs_s[:, 0] - tx_, rs_s[:, 1] - tz_) + np.where(kind == "bridge", 0, 1e3)))
    px_, pz_ = local(port_lat, port_lon)
    keypoints = {
        "TOP": {"name": "Coll dels Reis", "osm_node": int(coll_id), "lat": coll_lat, "lon": coll_lon,
                "ele_osm": float(coll_tags.get("ele", "nan")), "roadIndex": 0},
        "CORBATA": {"name": "Nus de sa Corbata (ponte, la strada passa sopra sé stessa)",
                    "osm_way": int(nus_bridge[0]), "lat": round(float(corb_lat), 7), "lon": round(float(corb_lon), 7),
                    "roadIndex": corb_idx},
        "PORT": {"name": "Port de Sa Calobra (terminal traghetti)", "osm_node": int(port_id),
                 "lat": port_lat, "lon": port_lon, "roadIndex": len(rs_s) - 1},
    }
    for k, v in keypoints.items():
        x, z = local(v["lat"], v["lon"])
        v["x"], v["z"] = round(x, 1), round(z, 1)
        v["roadY"] = round(float(prof[v["roadIndex"]]), 1)
        v["roadS"] = round(float(s[v["roadIndex"]]), 1)
    with open(os.path.join(ROOT, "data", "keypoints.json"), "w") as f:
        json.dump(keypoints, f, indent=1)

    # --- road.json (runtime): punti 3D lisciati
    kinds_rle = []
    for k in range(len(kind)):
        if not kinds_rle or kinds_rle[-1][0] != kind[k]:
            kinds_rle.append([str(kind[k]), k, k])
        kinds_rle[-1][2] = k
    road_out = {
        "step": ROAD_STEP,
        "length": round(float(s[-1]), 1),
        "points": [round(float(v), 2) for p in zip(rs_s[:, 0], prof, rs_s[:, 1]) for v in p],
        "spans": [r for r in kinds_rle if r[0] != "road"],  # [tipo, indice inizio, indice fine]
        "keypoints": {k: {"index": v["roadIndex"], "x": v["x"], "z": v["z"]} for k, v in keypoints.items()},
    }
    with open(os.path.join(ROOT, "public", "data", "road.json"), "w") as f:
        json.dump(road_out, f, separators=(",", ":"))

    # --- report
    rep = {
        "dem": args.dem, "zoom": args.zoom, "grid": f"{nx}×{nz} @ {cell} m", "area_km": f"{W/1000:.2f} × {H/1000:.2f}",
        "road_length_m": round(float(s[-1]), 1),
        "road_raw_osm_length_m": round(float(seg_l.sum()), 1),
        "profile_top_m": round(float(prof[0]), 1), "profile_port_m": round(float(prof[-1]), 1),
        "dem_raw_top_m": round(float(raw[0]), 1), "dem_raw_port_m": round(float(raw[-1]), 1),
        "grade_max_%": round(float(np.abs(grade).max()), 1),
        "grade_mean_%": round(float((prof[0] - prof[-1]) / s[-1] * 100), 2),
        "uphill_bits_m": round(float(np.clip(np.diff(prof), 0, None).sum()), 1),
        "climb_gain_m": round(float(np.clip(-np.diff(prof), 0, None).sum()), 1),
        "outliers_%": round(float(bad.mean() * 100), 1),
        "carve_change_p99_m": round(float(np.percentile(np.abs(carved - terrain)[np.abs(carved - terrain) > 0.01], 99)), 1),
        "carve_change_max_m": round(float(np.abs(carved - terrain).max()), 1),
        "h_range": [hmin, hmax],
        "spans": road_out["spans"],
        "png_kB": round(os.path.getsize(os.path.join(ROOT, "public", "data", "terrain.png")) / 1024),
        "road_json_kB": round(os.path.getsize(os.path.join(ROOT, "public", "data", "road.json")) / 1024),
        "tiles": report,
    }
    print(json.dumps(rep, indent=1, default=str))

    # dati per l'anteprima
    np.savez_compressed(os.path.join(args.cache, f"_preview_{args.dem}{args.out_suffix}.npz"), terrain=terrain, carved=carved,
                        road=rs_s, prof=prof, raw=raw, s=s, kind=kind, W=W, H=H, cell=cell,
                        port=np.array([px_, pz_]), corb=np.array([tx_, tz_]))


if __name__ == "__main__":
    main()
