"""Villa Pedramar: tutta la villa (esterno + soggiorno/cucina) con il sito, per i render navigabili.

Uso (sul Pod, vedi PIANO.md):
  python render/villa.py --time sunset --view front --preview
  python render/villa.py --time night --view orbit --frames 0-47        (giro esterno, 48 fotogrammi)
  python render/villa.py --time morning --view orbit --frames 0,12,24,36 --preview
Ore: morning (mattina), sunset (tramonto), night (notte).
Uscita: render/out/villa_<ora>_<vista>.jpg oppure render/out/orbit_<ora>/f00.jpg ...
Coordinate come in lib.py / src/data/villa.json: x verso la strada (est), y quota, z verso sud.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector, noise  # noqa: E402

import interni  # noqa: E402
import lib  # noqa: E402
import salon  # noqa: E402
from lib import B, box, beam, prism, cushion, rounded_block, cylinder  # noqa: E402

OUT = lib.ROOT / "out"
VILLA = json.loads((lib.ROOT.parent / "src/data/villa.json").read_text())

H1, SLAB, H2, ROOF = 2.70, (2.70, 3.50), 6.30, 7.00
VOID = (0.0, 4.6, 0.2, 5.9)
GRAVEL_Y = -0.95

# Ore del giorno: HDRI di solo cielo della stessa serie; azimut del sole come bussola (0 = nord, 90 = est)
TIMES = {
    "morning": dict(hdri="qwantani_mid_morning_puresky_4k.hdr", sun_compass=205, strength=1.0, exposure=-0.2,
                    haze=(0.62, 0.72, 0.86), haze_k=1.0, lights=False),
    "sunset": dict(hdri="qwantani_sunset_puresky_4k.hdr", sun_compass=245, strength=1.0, exposure=0.35,
                   haze=(0.95, 0.66, 0.48), haze_k=0.9, lights=True, lights_k=0.35),
    "night": dict(hdri="qwantani_dusk_2_puresky_4k.hdr", sun_compass=255, strength=0.12, exposure=1.2,
                  haze=(0.10, 0.12, 0.18), haze_k=0.12, lights=True, lights_k=1.0),
}


# ---------------------------------------------------------------- cielo

def hdri_sun_azimuth(img):
    """Azimut (Blender, atan2(Y, X), gradi) e altezza del punto più luminoso dell'HDRI equirettangolare."""
    import numpy as np
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    lum = px[..., 0] * 0.2126 + px[..., 1] * 0.7152 + px[..., 2] * 0.0722
    r, c = np.unravel_index(int(np.argmax(lum)), lum.shape)
    u, v = (c + 0.5) / w, (r + 0.5) / h
    az = math.degrees((0.5 - u) * 2 * math.pi)   # Cycles: u = 0.5 - atan2(y, x) / 2pi
    el = math.degrees((v - 0.5) * math.pi)
    return az, el


def sky(t):
    cfg = TIMES[t]
    path = lib.ASSETS / "hdri" / cfg["hdri"]
    img = bpy.data.images.load(str(path), check_existing=True)
    az, el = hdri_sun_azimuth(img)
    target = 90 - cfg["sun_compass"]          # bussola -> angolo Blender
    rot = target - az
    print(f"Sole nell'HDRI: az {az:.1f}°, altezza {el:.1f}° -> rotazione {rot:.1f}°")
    bpy.data.images.remove(img)
    lib.world_hdri(path, rotation_deg=rot, strength=cfg["strength"])
    w = bpy.context.scene.world
    w.cycles.sampling_method = "MANUAL"
    w.cycles.sample_map_resolution = 2048
    bpy.context.scene.view_settings.exposure = cfg["exposure"]
    return el


# ---------------------------------------------------------------- materiali in più

def mat_anthracite(name="Antracite", color=(0.05, 0.051, 0.054)):
    """Pannelli antracite opachi con leggera variazione (come le fasce nere della foto 19)."""
    m, nt, b = lib._nodes(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = 0.08
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 3.0
    n.inputs["Detail"].default_value = 6
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["To Min"].default_value = 0.3
    mr.inputs["To Max"].default_value = 0.48
    nt.links.new(n.outputs["Fac"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], b.inputs["Roughness"])
    return m


def mat_gravel(name="Ghiaia"):
    """Ghiaia scura (primo piano della foto 19): Voronoi per i sassi, colore variabile."""
    m, nt, b = lib._nodes(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vo = nt.nodes.new("ShaderNodeTexVoronoi")
    vo.inputs["Scale"].default_value = 28
    vo.feature = "F1"
    nt.links.new(tc.outputs["Object"], vo.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.035, 0.034, 0.033, 1)
    ramp.color_ramp.elements[1].color = (0.16, 0.15, 0.14, 1)
    nt.links.new(vo.outputs["Color"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "POWER"
    inv.inputs[1].default_value = 0.5
    nt.links.new(vo.outputs["Distance"], inv.inputs[0])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.8
    bp.inputs["Distance"].default_value = 0.02
    bp.invert = True
    nt.links.new(inv.outputs["Value"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = 0.8
    return m


def _haze(nt, shader_out, out_node, haze, k, near, far, max_mix=0.85):
    """Foschia atmosferica: mescola verso un colore emissivo in base alla distanza dalla camera."""
    lp = nt.nodes.new("ShaderNodeLightPath")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = near
    mr.inputs["From Max"].default_value = far
    mr.inputs["To Min"].default_value = 0.0
    mr.inputs["To Max"].default_value = max_mix
    nt.links.new(lp.outputs["Ray Length"], mr.inputs["Value"])
    cam = nt.nodes.new("ShaderNodeMath")
    cam.operation = "MULTIPLY"
    nt.links.new(mr.outputs["Result"], cam.inputs[0])
    nt.links.new(lp.outputs["Is Camera Ray"], cam.inputs[1])
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*haze, 1)
    em.inputs["Strength"].default_value = k
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(cam.outputs["Value"], mx.inputs["Fac"])
    nt.links.new(shader_out, mx.inputs[1])
    nt.links.new(em.outputs["Emission"], mx.inputs[2])
    nt.links.new(mx.outputs["Shader"], out_node.inputs["Surface"])


def mat_terrain(name, haze, haze_k):
    """Terreno secco con chiazze di macchia, variazione su grande scala e foschia in lontananza."""
    m = lib.mat_pbr(name, "dry_ground_rocks", size=5.0, hsv=(0.5, 0.55, 0.85), normal_strength=1.0)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    col_link = b.inputs["Base Color"].links[0]
    src = col_link.from_socket
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 0.06
    n.inputs["Detail"].default_value = 8
    n.inputs["Roughness"].default_value = 0.6
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[1].position = 0.62
    nt.links.new(n.outputs["Fac"], ramp.inputs["Fac"])
    scrub = nt.nodes.new("ShaderNodeMix")
    scrub.data_type = "RGBA"
    scrub.blend_type = "MULTIPLY"
    lib.sock(scrub.inputs, "B").default_value = (0.42, 0.5, 0.3, 1)
    nt.links.new(ramp.outputs["Color"], lib.sock(scrub.inputs, "Factor", "Float"))
    nt.links.new(src, lib.sock(scrub.inputs, "A"))
    # puntini di macchia (cespugli visti da lontano): Voronoi a chiazze, sfumati sotto i 50 m dalla camera
    vo = nt.nodes.new("ShaderNodeTexVoronoi")
    vo.inputs["Scale"].default_value = 0.22
    vo.inputs["Randomness"].default_value = 1.0
    nt.links.new(tc.outputs["Object"], vo.inputs["Vector"])
    dots = nt.nodes.new("ShaderNodeMapRange")
    dots.inputs["From Min"].default_value = 0.55
    dots.inputs["From Max"].default_value = 0.3
    nt.links.new(vo.outputs["Distance"], dots.inputs["Value"])
    patch = nt.nodes.new("ShaderNodeMapRange")
    patch.inputs["From Min"].default_value = 0.42
    patch.inputs["From Max"].default_value = 0.58
    nt.links.new(n.outputs["Fac"], patch.inputs["Value"])
    lp = nt.nodes.new("ShaderNodeLightPath")
    far = nt.nodes.new("ShaderNodeMapRange")
    far.inputs["From Min"].default_value = 40
    far.inputs["From Max"].default_value = 120
    nt.links.new(lp.outputs["Ray Length"], far.inputs["Value"])
    m1 = nt.nodes.new("ShaderNodeMath")
    m1.operation = "MULTIPLY"
    nt.links.new(dots.outputs["Result"], m1.inputs[0])
    nt.links.new(patch.outputs["Result"], m1.inputs[1])
    m2 = nt.nodes.new("ShaderNodeMath")
    m2.operation = "MULTIPLY"
    nt.links.new(m1.outputs["Value"], m2.inputs[0])
    nt.links.new(far.outputs["Result"], m2.inputs[1])
    bush = nt.nodes.new("ShaderNodeMix")
    bush.data_type = "RGBA"
    lib.sock(bush.inputs, "B").default_value = (0.045, 0.06, 0.03, 1)
    nt.links.new(m2.outputs["Value"], lib.sock(bush.inputs, "Factor", "Float"))
    nt.links.new(lib.sock(scrub.outputs, "Result"), lib.sock(bush.inputs, "A"))
    nt.links.new(lib.sock(bush.outputs, "Result"), b.inputs["Base Color"])
    out = nt.nodes["Material Output"]
    _haze(nt, b.outputs["BSDF"], out, haze, haze_k, 150, 6000, 0.75)
    return m


def mat_far(name, haze, haze_k):
    m, nt, b = lib._nodes(name)
    b.inputs["Base Color"].default_value = (0.09, 0.1, 0.08, 1)
    b.inputs["Roughness"].default_value = 0.95
    out = nt.nodes["Material Output"]
    _haze(nt, b.outputs["BSDF"], out, haze, haze_k, 2000, 30000, 0.92)
    return m


def mat_pool_water(name="AcquaPiscina"):
    """Acqua della piscina: rifrazione e riflessi per la camera, trasparente per le ombre (il sole illumina la vasca)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    pr = nt.nodes.new("ShaderNodeBsdfPrincipled")
    pr.inputs["Base Color"].default_value = (0.72, 0.9, 0.9, 1)
    pr.inputs["Roughness"].default_value = 0.03
    pr.inputs["Transmission Weight"].default_value = 1.0
    pr.inputs["IOR"].default_value = 1.333
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.0, 2.2, 1.0)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 1.4
    n.inputs["Detail"].default_value = 6
    n.inputs["Roughness"].default_value = 0.55
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.35
    bp.inputs["Distance"].default_value = 0.02
    nt.links.new(n.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], pr.inputs["Normal"])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = (0.8, 0.95, 0.95, 1)
    lp = nt.nodes.new("ShaderNodeLightPath")
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Shadow Ray"], mx.inputs["Fac"])
    nt.links.new(pr.outputs["BSDF"], mx.inputs[1])
    nt.links.new(tr.outputs["BSDF"], mx.inputs[2])
    nt.links.new(mx.outputs["Shader"], out.inputs["Surface"])
    return m


def mat_solar(name="Pannelli"):
    m, nt, b = lib._nodes(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs["Scale"].default_value = 6.0
    br.inputs["Mortar Size"].default_value = 0.01
    br.inputs["Color1"].default_value = (0.02, 0.03, 0.06, 1)
    br.inputs["Color2"].default_value = (0.025, 0.035, 0.07, 1)
    br.inputs["Mortar"].default_value = (0.5, 0.5, 0.5, 1)
    br.offset = 0.0
    nt.links.new(tc.outputs["Object"], br.inputs["Vector"])
    nt.links.new(br.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.08
    b.inputs["Coat Weight"].default_value = 0.5
    return m


def materials(t):
    M = salon.materials()
    cfg = TIMES[t]
    M["anth"] = mat_anthracite()
    M["anth2"] = lib.mat_fabric("TessutoEsternoScuro", (0.05, 0.05, 0.05), rough=0.9, sheen=0.1)
    M["roof"] = lib.mat_color("Copertura", (0.55, 0.55, 0.53), rough=0.85)
    M["gravel"] = mat_gravel()
    M["gravel_road"] = lib.mat_pbr("Sterrato", "dry_ground_rocks", size=3.0, hsv=(0.5, 0.45, 0.62), normal_strength=0.6)
    M["terrain"] = mat_terrain("Terreno", cfg["haze"], cfg["haze_k"])
    M["far"] = mat_far("Lontano", cfg["haze"], cfg["haze_k"])
    M["solar"] = mat_solar()
    M["concrete"] = lib.mat_pbr("Cemento", "concrete_layers_02", size=2.5, hsv=(0.5, 0.6, 1.0))
    M["stone"] = lib.mat_pbr("PietraMuri", "rustic_stone_wall_02", size=2.8, hsv=(0.5, 0.55, 1.15), normal_strength=1.2)
    sea = M["sea"].node_tree.nodes["Principled BSDF"]
    sea.inputs["Roughness"].default_value = 0.16
    sea.inputs["Specular IOR Level"].default_value = 0.35
    M["sea"].node_tree.nodes["Bump"].inputs["Strength"].default_value = 0.5
    sea.inputs["Base Color"].default_value = (0.006, 0.03, 0.05, 1)
    M["rug"] = lib.mat_rug("TappetoSogg", (0.36, 0.34, 0.31))
    M["deck"] = lib.mat_pbr("DeckEsterno", "wood_floor_deck", size=2.0, rot_deg=90, hsv=(0.5, 0.5, 0.75))
    M["coping"] = lib.mat_pbr("Bordo", "granite_tile", size=2.0, tint=(0.55, 0.55, 0.55), normal_strength=0.4)
    M["water"] = mat_pool_water()
    M["basin"] = lib.mat_pbr("Vasca", "granite_tile", size=1.6, tint=(0.42, 0.47, 0.48), normal_strength=0.3)
    interni.materials(M)
    M["olive"] = lib.mat_color("VerdeOliva", (0.16, 0.17, 0.09), rough=0.9)
    M["bedding"] = lib.mat_fabric("Lenzuola", (0.78, 0.76, 0.72))
    M["velvet_green"] = lib.mat_fabric("VellutoVerde", (0.12, 0.16, 0.08), sheen=0.9, rough=0.7)
    M["lamp_warm"] = lib.mat_emission("LuceCalda", (1.0, 0.72, 0.45), 25)
    M["pool_light"] = lib.mat_emission("LucePiscina", (0.55, 0.9, 1.0), 40)
    return M


# ---------------------------------------------------------------- terreno

PROFILE = [(-600, -75), (-260, -68), (-170, -50), (-90, -18), (-34, -5.3), (-22, -3.4), (-3, 0.9), (5, 3.5),
           (60, 4.5), (140, 10), (300, 30), (700, 90), (2000, 160)]
PLATFORMS = [  # x0, z0, x1, z1, altezza (o rampa in x), margine di raccordo (a pari merito vince la prima)
    (-24.0, -9.0, -9.8, 21.0, GRAVEL_Y, 5.0),
    (-9.8, -3.4, 0.0, 14.6, 0.0, 2.5),
    (-6.0, 14.4, 4.2, 19.0, 0.0, 4.0),
    (4.0, -6.5, 14.7, -1.0, 3.5, 3.0),
    (14.7, -6.5, 24.0, 12.3, 3.6, 4.0),
    (4.2, 10.9, 14.7, 12.3, ("ramp", 4.2, 0.0, 14.7, 3.5), 2.5),
]
HOLES = [(-9.8, -3.4, 0.0, 14.6), (0.0, -1.0, 14.7, 10.9), (0.0, 10.9, 4.2, 14.4), (0.0, -2.85, 4.0, -1.0),
         (4.2, 10.9, 15.15, 12.6)]  # niente terreno sotto casa, piscina e deck


def _interp(pts, x):
    if x <= pts[0][0]:
        return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            f = (x - x0) / (x1 - x0)
            f = f * f * (3 - 2 * f)
            return y0 + (y1 - y0) * f
    return pts[-1][1]


def _smooth(e0, e1, v):
    if e1 == e0:
        return 1.0 if v >= e1 else 0.0
    f = min(1.0, max(0.0, (v - e0) / (e1 - e0)))
    return f * f * (3 - 2 * f)


def ground_natural(x, z):
    h = _interp(PROFILE, x)
    h += 0.09 * max(0.0, -z - 6.0) * _smooth(-40, 10, x)        # sale verso nord
    h += 0.03 * max(0.0, z - 20.0)
    # monte alle spalle (foto 26) e colline intorno: solo lontano dalla casa
    r = math.hypot(x - 3, z - 5)
    hills = (150 * math.exp(-((x - 420) ** 2 + (z + 330) ** 2) / (2 * 210 ** 2))    # monte a nord-est (foto 26)
             + 70 * math.exp(-((x - 230) ** 2 + (z - 260) ** 2) / (2 * 140 ** 2))    # collina verde a sud-est (foto 19)
             + 55 * math.exp(-((x - 60) ** 2 + (z + 300) ** 2) / (2 * 120 ** 2)))
    h += hills * _smooth(60, 260, r) * _smooth(-120, 20, x)
    amp = 0.35 + min(1.0, r / 300) * 14 * _smooth(-150, 40, x)
    h += amp * noise.fractal(Vector((x * 0.018, z * 0.018, 0.3)), 0.55, 2.1, 6)
    h += 0.18 * noise.noise(Vector((x * 0.35, z * 0.35, 4.1)))
    return h


def ground(x, z):
    h = ground_natural(x, z)
    best = None
    for x0, z0, x1, z1, ph, m in PLATFORMS:
        dx = max(x0 - x, 0.0, x - x1)
        dz = max(z0 - z, 0.0, z - z1)
        d = math.hypot(dx, dz)
        if d > m:
            continue
        if isinstance(ph, tuple):
            _, rx0, ry0, rx1, ry1 = ph
            ph = ry0 + (ry1 - ry0) * min(1.0, max(0.0, (x - rx0) / (rx1 - rx0)))
        w = _smooth(0, m, d)
        if best is None or w < best[0]:
            best = (w, ph)
    if best:
        w, ph = best
        h = ph + (h - ph) * w
    return h


def _axis(lo, hi, fine_lo, fine_hi, step, breaks):
    vals = set()
    v = fine_lo
    while v <= fine_hi + 1e-6:
        vals.add(round(v, 3))
        v += step
    s = step
    v = fine_lo
    while v > lo:  # passo che cresce allontanandosi
        s *= 1.12
        v -= s
        vals.add(round(max(v, lo), 3))
    s = step
    v = fine_hi
    while v < hi:
        s *= 1.12
        v += s
        vals.add(round(min(v, hi), 3))
    vals.update(breaks)
    return sorted(vals)


def terrain(M):
    xs = _axis(-700, 2500, -70, 70, 0.5, [-24, -9.8, -2.4, 0.0, 4.0, 4.2, 14.7, 15.15])
    zs = _axis(-2200, 2200, -60, 75, 0.5, [-9, -6.5, -3.4, -2.85, -1.0, 0.0, 10.9, 12.3, 12.6, 14.4, 14.6, 19, 21])
    bm = bmesh.new()
    grid = [[bm.verts.new(B(x, ground(x, z), z)) for z in zs] for x in xs]
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            cx, cz = (xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2
            if any(x0 <= cx <= x1 and z0 <= cz <= z1 for x0, z0, x1, z1 in HOLES):
                continue
            bm.faces.new([grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    ob = lib.mesh_obj("Terreno", bm, M["terrain"], smooth=True)
    print("Terreno:", len(xs) * len(zs), "vertici")
    # ghiaia scura sul piazzale davanti alla piscina
    bm = bmesh.new()
    gx = [-24 + i * 0.5 for i in range(int(14.2 / 0.5) + 1)] + [-9.8]
    gz = [-9 + i * 0.5 for i in range(int(30 / 0.5) + 1)]
    g = [[bm.verts.new(B(x, ground(x, z) + 0.03, z)) for z in gz] for x in gx]
    for i in range(len(gx) - 1):
        for j in range(len(gz) - 1):
            bm.faces.new([g[i][j], g[i][j + 1], g[i + 1][j + 1], g[i + 1][j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    lib.mesh_obj("Ghiaia", bm, M["gravel"], smooth=True)
    return ob


ROAD = [(19.0, 3.0), (30.0, 1.5), (45.0, -6.0), (62.0, -18.0), (85.0, -30.0), (115.0, -36.0), (160.0, -34.0), (230.0, -20.0)]


def _road_dist(x, z):
    best = 1e9
    for (ax, az), (bx, bz) in zip(ROAD, ROAD[1:]):
        dx, dz = bx - ax, bz - az
        t = max(0.0, min(1.0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
        best = min(best, math.hypot(x - ax - t * dx, z - az - t * dz))
    return best


def road(M):
    """Strada sterrata: nastro largo 4,8 m che segue il terreno (appena sopra)."""
    bm = bmesh.new()
    pts = []
    for (ax, az), (bx, bz) in zip(ROAD, ROAD[1:]):
        L = math.hypot(bx - ax, bz - az)
        n = max(1, int(L / 1.0))
        pts += [(ax + (bx - ax) * i / n, az + (bz - az) * i / n) for i in range(n)]
    pts.append(ROAD[-1])
    rows = []
    for i, (x, z) in enumerate(pts):
        j = min(i + 1, len(pts) - 1)
        k = max(i - 1, 0)
        tx, tz = pts[j][0] - pts[k][0], pts[j][1] - pts[k][1]
        L = math.hypot(tx, tz) or 1.0
        nx, nz = -tz / L, tx / L
        row = []
        for w in (-2.4, -1.8, 0.0, 1.8, 2.4):
            px, pz = x + nx * w, z + nz * w
            row.append(bm.verts.new(B(px, ground(px, pz) + (0.06 if abs(w) < 2 else 0.01), pz)))
        rows.append(row)
    for i in range(len(rows) - 1):
        for k in range(4):
            bm.faces.new([rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    lib.mesh_obj("Strada", bm, M["gravel_road"], smooth=True)
    for nm, (x0, z0, x1, z1) in (("Piazzale", (15.15, -6.5, 24.0, 12.3)), ("Parcheggio", (4.0, -6.5, 15.15, -1.45))):
        bm = bmesh.new()
        xs = [x0 + (x1 - x0) * i / 12 for i in range(13)]
        zs = [z0 + (z1 - z0) * j / 12 for j in range(13)]
        g = [[bm.verts.new(B(x, ground(x, z) + 0.04, z)) for z in zs] for x in xs]
        for i in range(12):
            for j in range(12):
                bm.faces.new([g[i][j], g[i][j + 1], g[i + 1][j + 1], g[i + 1][j]])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for f in bm.faces:
            if f.normal.z < 0:
                f.normal_flip()
        lib.mesh_obj(nm, bm, M["gravel_road"], smooth=True)


def sea_and_coast(M):
    bm = bmesh.new()
    R = 60000
    vs = [bm.verts.new(B(x, -66.0, z)) for x, z in ((R, -R), (R, R), (-R, R), (-R, -R))]
    bm.faces.new(vs)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    lib.mesh_obj("Mare", bm, M["sea"])
    # costa lontana del golfo: crinale a 12-22 km verso ovest e sud-ovest (foto 02, 11)
    bm = bmesh.new()
    rows = []
    n = 160
    for i in range(n + 1):
        a = math.radians(140 + 100 * i / n)  # da nord-ovest a sud-ovest (angolo in pianta da +x, z = -sin)
        d = 16000 + 5000 * math.sin(i * 0.11)
        hgt = 380 + 320 * noise.fractal(Vector((i * 0.08, 1.3, 0)), 0.6, 2.0, 5) + 250 * math.sin(i * 0.035) ** 2
        row = []
        for k, (dd, yy) in enumerate(((d - 3000, -70), (d - 900, hgt * 0.55), (d, max(60, hgt)), (d + 2500, -70))):
            row.append(bm.verts.new(B(math.cos(a) * dd, yy, -math.sin(a) * dd)))
        rows.append(row)
    for i in range(n):
        for k in range(3):
            bm.faces.new([rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = lib.mesh_obj("CostaLontana", bm, M["far"], smooth=True)
    for p in ob.data.polygons:
        p.use_smooth = True


# ---------------------------------------------------------------- vegetazione e rocce

def grade_materials(objs, hsv):
    """Ritocca il colore di base dei materiali dei modelli (es. massi sudafricani -> granito sardo grigio)."""
    done = set()
    for ob in objs:
        for m in ob.data.materials:
            if m is None or m.name in done or not m.use_nodes:
                continue
            done.add(m.name)
            nt = m.node_tree
            for b in [n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"]:
                inp = b.inputs["Base Color"]
                if not inp.links:
                    continue
                src = inp.links[0].from_socket
                h = nt.nodes.new("ShaderNodeHueSaturation")
                h.inputs["Hue"].default_value, h.inputs["Saturation"].default_value, h.inputs["Value"].default_value = hsv
                nt.links.new(src, h.inputs["Color"])
                nt.links.new(h.outputs["Color"], inp)


def model_variants(asset_id, lod="LOD0", hsv=None):
    """Carica un modello Poly Haven e restituisce una collezione per variante (fuori scena, per istanze)."""
    d = lib.ASSETS / "models" / asset_id
    blend = next(d.glob("*.blend"))
    with bpy.data.libraries.load(str(blend), link=False) as (src, dst):
        dst.objects = [n for n in src.objects if lod in n or "LOD" not in n]
    out = []
    objs = [o for o in dst.objects if o is not None and o.type == "MESH" and max(o.dimensions) > 0.25]
    if hsv:
        grade_materials(objs, hsv)
    for ob in dst.objects:
        if ob is None or ob not in objs:
            continue
        c = bpy.data.collections.new(f"V_{ob.name}")
        c.objects.link(ob)
        c.instance_offset = ob.location.copy()
        dims = ob.dimensions
        out.append((c, max(dims.x, dims.y), dims.z))
    return out


def instance(coll, x, y, z, rot_deg, scale, name="I"):
    ob = bpy.data.objects.new(name, None)
    ob.instance_type = "COLLECTION"
    ob.instance_collection = coll
    bpy.context.scene.collection.objects.link(ob)
    ob.location = B(x, y, z)
    ob.rotation_euler = (0, 0, math.radians(rot_deg))
    ob.scale = (scale, scale, scale)
    return ob


def _free(x, z, pad=1.0):
    """Fuori da casa, piscina, deck, piazzali e strada."""
    for x0, z0, x1, z1 in ((-10.8, -4.4, 16.0, 15.6), (-24, -9, -9.8, 21), (4, -6.5, 24, -1), (14.7, -6.5, 24, 13.5),
                           (-6.0, 14.4, 4.2, 19.0)):
        if x0 - pad <= x <= x1 + pad and z0 - pad <= z <= z1 + pad:
            return False
    return True


def vegetation(seed=7):
    rnd = random.Random(seed)
    big = model_variants("searsia_burchellii", hsv=(0.51, 0.85, 0.9))
    mid = model_variants("searsia_lucida", hsv=(0.53, 0.42, 0.55))
    low = model_variants("didelta_spinosa", hsv=(0.54, 0.32, 0.36))
    dry = model_variants("wild_rooibos_bush", lod="") + model_variants("shrub_02")
    grey = (0.5, 0.35, 0.85)
    rocks = (model_variants("boulder_01", hsv=(0.5, 0.6, 0.95)) + model_variants("namaqualand_boulder_02", hsv=grey)
             + model_variants("namaqualand_boulder_04", hsv=grey))
    stones = model_variants("rock_07", hsv=grey) + model_variants("rock_09", hsv=grey)
    n = 0

    def place(pool, x, z, size, sink=0.08):
        nonlocal n
        c, w, hgt = rnd.choice(pool)
        s = size / max(w, hgt, 1e-3)
        instance(c, x, ground(x, z) - sink * size, z, rnd.uniform(0, 360), s, f"Veg{n}")
        n += 1

    def density(x, z):  # chiazze di macchia: rumore a bassa frequenza
        return 0.5 + 0.5 * noise.noise(Vector((x * 0.045, z * 0.045, 7.7)))

    # punti di villa.json
    for x, z, sz in VILLA["site"]["shrubs"]:
        if _free(x, z):
            place(big if sz > 1.5 else mid, x, z, sz * 1.4)
    # vicino (fino a ~170 m): macchia a chiazze, cespugli bassi, sassi
    for _ in range(40000):
        r = 8 + (rnd.random() ** 0.8) * 165
        a = rnd.uniform(0, 2 * math.pi)
        x, z = 3 + math.cos(a) * r, 5 + math.sin(a) * r
        if not _free(x, z, 0.6) or ground(x, z) < -60 or _road_dist(x, z) < 3.2:
            continue
        d = density(x, z)
        k = rnd.random()
        if k < d * 0.55:
            pick = rnd.random()
            if pick < 0.4:
                place(big, x, z, rnd.uniform(1.4, 3.2))
            elif pick < 0.75:
                place(mid, x, z, rnd.uniform(1.0, 2.2))
            else:
                place(low, x, z, rnd.uniform(0.7, 1.6))
        elif k < d * 0.55 + 0.05:
            place(dry, x, z, rnd.uniform(0.5, 1.0), sink=0.02)
        elif k < d * 0.55 + 0.08:
            place(stones, x, z, rnd.uniform(0.3, 0.9), sink=0.3)
    # massi di granito a gruppi (foto 26)
    for _ in range(70):
        r = rnd.uniform(14, 160)
        a = rnd.uniform(0, 2 * math.pi)
        cx, cz = 3 + math.cos(a) * r, 5 + math.sin(a) * r
        for _k in range(rnd.randint(2, 7)):
            x, z = cx + rnd.gauss(0, 2.5), cz + rnd.gauss(0, 2.5)
            if _free(x, z, 1.0) and ground(x, z) > -60:
                place(rocks, x, z, rnd.uniform(0.8, 3.8), sink=0.3)
    # lontano: macchia più rada e grande (i puntini del terreno fanno il resto)
    for _ in range(16000):
        r = 170 + rnd.random() ** 1.3 * 700
        a = rnd.uniform(0, 2 * math.pi)
        x, z = 3 + math.cos(a) * r, 5 + math.sin(a) * r
        if ground(x, z) < -62 or rnd.random() > density(x, z):
            continue
        place(big if rnd.random() < 0.8 else rocks, x, z, rnd.uniform(2.5, 5.0), sink=0.15)
    # piante vicino alla casa
    for x, z in ((-11.6, -2.0), (-11.4, 4.0), (-11.8, 10.5), (-11.0, 15.8), (6.0, 13.2), (9.5, 13.0), (12.5, 13.1)):
        place(mid, x, z, rnd.uniform(1.0, 1.6))
    print("Vegetazione e rocce:", n, "istanze")


# ---------------------------------------------------------------- casa

def glass(name, a, b, y0, y1, M, mullions=4, frame=0.05):
    salon.glass_wall(name, a, b, y0, y1, M, mullions=mullions)


def stone_wall_x(name, z, x0, x1, y0, y1, M, outward, openings=(), t=0.45):
    """Muro in pietra lungo x (faccia esterna verso +z se outward=+1). openings: (da, a, davanzale, architrave) lungo il muro."""
    za, zb = (z, z + t) if outward > 0 else (z - t, z)
    cuts = sorted(openings)
    pos = x0
    for (a, b, s, h) in cuts:
        a, b = x0 + a, x0 + b
        if a > pos:
            box(f"{name}_{pos:.1f}", pos, a, y0, y1, za, zb, M["stone"], bevel=0.01)
        box(f"{name}_dav{a:.1f}", a, b, y0, y0 + s, za, zb, M["stone"], bevel=0.01)
        box(f"{name}_arc{a:.1f}", a, b, y0 + h, y1, za, zb, M["stone"], bevel=0.01)
        box(f"{name}_v{a:.1f}", a, b, y0 + s, y0 + h, (za + zb) / 2 - 0.012, (za + zb) / 2 + 0.012, M["glass"], bevel=0)
        box(f"{name}_tel{a:.1f}", a, b, y0 + s - 0.02, y0 + s + 0.04, za + 0.05, zb - 0.05, M["frame"])
        box(f"{name}_telh{a:.1f}", a, b, y0 + h - 0.05, y0 + h, za + 0.05, zb - 0.05, M["frame"])
        pos = b
    if pos < x1:
        box(f"{name}_{pos:.1f}e", pos, x1, y0, y1, za, zb, M["stone"], bevel=0.01)


def stone_wall_z(name, x, z0, z1, y0, y1, M, outward, openings=(), t=0.45):
    xa, xb = (x, x + t) if outward > 0 else (x - t, x)
    pos = z0
    for (a, b, s, h) in sorted(openings):
        a, b = z0 + a, z0 + b
        if a > pos:
            box(f"{name}_{pos:.1f}", xa, xb, y0, y1, pos, a, M["stone"], bevel=0.01)
        box(f"{name}_dav{a:.1f}", xa, xb, y0, y0 + s, a, b, M["stone"], bevel=0.01)
        box(f"{name}_arc{a:.1f}", xa, xb, y0 + h, y1, a, b, M["stone"], bevel=0.01)
        box(f"{name}_v{a:.1f}", (xa + xb) / 2 - 0.012, (xa + xb) / 2 + 0.012, y0 + s, y0 + h, a, b, M["glass"], bevel=0)
        pos = b
    if pos < z1:
        box(f"{name}_{pos:.1f}e", xa, xb, y0, y1, pos, z1, M["stone"], bevel=0.01)


def railing(name, pts, y, h, M, post_every=1.6):
    """Parapetto in ferro: corrimano piatto, montanti e due tondini orizzontali."""
    for i, ((ax, az), (bx, bz)) in enumerate(zip(pts, pts[1:])):
        beam(f"{name}_C{i}", (ax, y + h, az), (bx, y + h, bz), 0.05, 0.012, M["steel"])
        for k, f in enumerate((0.36, 0.68)):
            beam(f"{name}_T{i}{k}", (ax, y + h * f, az), (bx, y + h * f, bz), 0.012, 0.012, M["steel"])
        L = math.hypot(bx - ax, bz - az)
        n = max(1, round(L / post_every))
        for k in range(n + 1):
            px, pz = ax + (bx - ax) * k / n, az + (bz - az) * k / n
            box(f"{name}_M{i}_{k}", px - 0.02, px + 0.02, y, y + h, pz - 0.02, pz + 0.02, M["steel"], bevel=0.001)


def house(M):
    # --- solai e coperture
    box("PlateaMare", 0.0, 14.7, -0.4, -0.3, -1.0, 14.4, M["concrete"], bevel=0)
    x0, x1, z0, z1 = VOID
    # solaio tra i livelli (con il vuoto della doppia altezza), più sporgente verso il mare come balcone
    box("SolaioN", 0.0, 14.7, SLAB[0], SLAB[1], -1.0, z0, M["plaster"], bevel=0)
    box("SolaioE", x1, 14.7, SLAB[0], SLAB[1], z0, z1, M["plaster"], bevel=0)
    box("SolaioS", 0.0, 14.7, SLAB[0], SLAB[1], z1, 10.9, M["plaster"], bevel=0)
    box("Balcone", -2.4, 0.0, SLAB[0] - 0.1, SLAB[1], -1.0, 8.9, M["anth"], bevel=0.004)
    box("BalconePav", -2.38, 0.0, SLAB[1], SLAB[1] + 0.03, -0.98, 8.9, M["deck"], bevel=0.002)
    box("CoperturaPortico", -2.4, 4.2, SLAB[0] - 0.1, SLAB[1], 8.9, 14.4, M["anth"], bevel=0.004)
    box("SolaioRientro", 13.3, 14.7, SLAB[1] - 0.05, SLAB[1], 5.6, 10.9, M["slate"], bevel=0)
    # fascia antracite con fughe dei pannelli (foto 19)
    for zz in [-1.0 + 1.25 * i for i in range(13)]:
        box(f"FugaBalc{zz:.1f}", -2.42, -2.40, SLAB[0] - 0.1, SLAB[1], zz - 0.004, zz + 0.004, M["black"], bevel=0)
    # copertura del livello strada (chiara, praticabile) con il bordo antracite
    roof_poly = [(0, 0), (14.7, 0), (14.7, 5.6), (13.3, 5.6), (13.3, 10.9), (-0.4, 10.9), (-0.4, 8.9), (0, 8.9)]
    prism("Copertura", roof_poly, H2, ROOF - 0.05, M["plaster"])
    prism("CoperturaManto", roof_poly, ROOF - 0.05, ROOF, M["roof"])
    # sbalzo verso il mare: telaio antracite con le doghe del frangisole
    box("SbalzoN", -5.0, 0.0, H2, ROOF, 0.0, 0.25, M["anth"], bevel=0.004)
    box("SbalzoS", -5.0, 0.0, H2, ROOF, 8.65, 8.9, M["anth"], bevel=0.004)
    box("SbalzoO", -5.0, -4.75, H2, ROOF, 0.0, 8.9, M["anth"], bevel=0.004)
    box("FasciaMare", -0.06, 0.0, H2, ROOF, 0.0, 8.9, M["anth"], bevel=0)
    for i in range(int(4.75 / 0.15)):
        x = -4.72 + i * 0.15
        box(f"Doga{i}", x, x + 0.07, 6.62, 6.95, 0.25, 8.65, M["deck"], bevel=0.003)
    # bordo antracite della copertura (fascia alta sugli altri lati)
    for nm, a in (("FasciaN", (0.0, 15.15, -0.45, 0.0)), ("FasciaE", (14.7, 15.15, 0.0, 6.05)),
                  ("FasciaRientro", (13.3, 14.7, 5.6, 6.05)), ("FasciaE2", (13.3, 13.75, 6.05, 11.35)),
                  ("FasciaS", (1.6, 13.3, 10.9, 11.35))):
        box(nm, a[0], a[1], H2 + 0.25, ROOF + 0.03, a[2], a[3], M["anth"], bevel=0.003)
    # pannelli solari, canna fumaria
    for i in range(4):
        zz = 0.9 + i * 0.98
        box(f"Solare{i}", 8.4, 13.9, ROOF + 0.12, ROOF + 0.17, zz, zz + 0.92, M["solar"], bevel=0.003)
        box(f"SolareSupp{i}", 8.5, 13.8, ROOF, ROOF + 0.12, zz + 0.4, zz + 0.5, M["steel"], bevel=0)
    box("CannaFumaria", 3.55, 3.85, ROOF, 8.3, 0.45, 0.75, M["anth"], bevel=0.004)
    # parapetti
    railing("ParapettoBalcone", [(-2.35, 8.85), (-2.35, -0.95), (0.0, -0.95)], SLAB[1], 1.05, M)
    railing("ParapettoTetto", [(0.05, 0.05), (14.65, 0.05), (14.65, 5.55), (13.35, 5.55)], ROOF, 1.1, M)
    railing("ParapettoTettoS", [(13.35, 10.85), (-0.35, 10.85), (-0.35, 8.95)], ROOF, 1.1, M)
    railing("ParapettoScalaNord", [(0.0, -1.03), (4.0, -1.03)], SLAB[1], 1.05, M)

    # --- torre in pietra e muri in pietra del livello strada
    box("TorrePietra", -0.4, 1.6, 0.0, 7.3, 8.9, 10.9, M["stone"], bevel=0.015)
    stone_wall_x("MuroN", 0.0, 8.8, 14.7, SLAB[1], H2 + 0.25, M, -1, openings=[(2.3, 3.6, 0.9, 2.2)])
    stone_wall_z("MuroE", 14.7, 0.0, 5.6, SLAB[1], H2 + 0.25, M, 1, openings=[(1.8, 3.2, 0.9, 2.2)])
    box("MuroRientro", 13.3, 14.7, SLAB[1], H2 + 0.25, 5.6, 6.05, M["stone"], bevel=0.01)
    stone_wall_z("MuroE2", 13.3, 5.6, 10.9, SLAB[1], H2 + 0.25, M, 1)
    stone_wall_x("MuroS", 10.9, 1.6, 13.3, SLAB[1], H2 + 0.25, M, 1, openings=[(5.2, 6.8, 0.8, 2.3)])
    # livello mare interrato: muri di contenimento in cemento a vista
    box("ContenimentoN", 0.0, 14.7, -0.4, SLAB[1], -1.45, -1.0, M["concrete"], bevel=0.005)
    box("ContenimentoE", 14.7, 15.15, -0.4, SLAB[1], -1.45, 10.9, M["concrete"], bevel=0.005)
    box("ContenimentoS", 4.2, 15.15, -0.4, SLAB[1], 10.92, 11.35, M["stone"], bevel=0.01)
    box("PorticoFondo", 4.2, 4.65, -0.4, SLAB[0], 12.75, 14.4, M["stone"], bevel=0.01)  # aperto sul passaggio

    # --- vetrate
    glass("VetrataMare", (0.0, 0.0), (0.0, 8.9), 0.0, SLAB[0] - 0.08, M, mullions=5)
    box("SpallaN", -0.3, 0.0, -0.3, SLAB[0], -1.0, 0.0, M["anth"], bevel=0.003)
    glass("VetrataAlta", (0.0, 0.0), (0.0, 8.9), SLAB[1], H2 - 0.05, M, mullions=5)
    glass("VetrataNord", (0.0, 0.0), (7.5, 0.0), SLAB[1], H2 - 0.05, M, mullions=4)
    box("Porta", 7.5, 8.8, SLAB[1], SLAB[1] + 2.4, -0.06, 0.0, M["boiserie"], bevel=0.004)
    box("PortaSopra", 7.5, 8.8, SLAB[1] + 2.4, H2 + 0.25, -0.35, 0.0, M["anth"], bevel=0.003)
    glass("VetrataPortico", (1.6, 10.9), (4.2, 10.9), 0.0, SLAB[0] - 0.08, M, mullions=2)

    # --- portico a sud: pilastri, cucina esterna, tavolo
    box("Pilastro1", 0.0, 0.25, 0.0, SLAB[0] - 0.1, 14.15, 14.4, M["anth"], bevel=0.003)
    box("Pilastro2", 3.95, 4.2, 0.0, SLAB[0] - 0.1, 14.15, 14.4, M["anth"], bevel=0.003)
    box("PavPortico", 0.0, 4.2, -0.05, 0.0, 10.9, 14.4, M["slate"], bevel=0)
    box("CucinaEsterna", 1.0, 3.9, 0.0, 0.92, 12.7, 13.5, M["stone"], bevel=0.008)
    box("CucinaEsternaPiano", 0.95, 3.95, 0.92, 0.96, 12.65, 13.55, M["marble"], bevel=0.003)

    # --- scala esterna in legno verso la copertura (lato strada)
    sx, sz, sy = VILLA["stairsExt"]["x"], VILLA["stairsExt"]["z"], VILLA["stairsExt"]["y"]
    n = VILLA["stairsExt"]["steps"]
    for i in range(n):
        f = (i + 1) / n
        zz = sz[0] + (sz[1] - sz[0]) * f
        yy = sy[0] + (sy[1] - sy[0]) * f
        box(f"ScalaEst{i}", sx[0], sx[1], yy - 0.05, yy, zz - 0.14, zz + 0.14, M["deck"], bevel=0.003)
    beam("ScalaEstCos", (sx[1] + 0.02, sy[0], sz[0]), (sx[1] + 0.02, sy[1], sz[1]), 0.02, 0.25, M["steel"])
    railing("ScalaEstPar", [(sx[1] + 0.02, sz[0]), (sx[1] + 0.02, sz[1])], SLAB[1], 1.0, M)

    # --- scala esterna con segnapasso dal piazzale nord al deck
    for i in range(20):
        x = 3.8 - i * 0.19
        yy = SLAB[1] - (i + 1) * 0.175
        box(f"ScalaNord{i}", x - 0.19, x + 0.02, yy - 0.04, yy, -2.5, -1.45, M["slate"], bevel=0.004)
        box(f"ScalaNordAlz{i}", x - 0.02, x + 0.0, -0.4, yy, -2.5, -1.45, M["concrete"], bevel=0)
    box("ScalaNordMuro", -0.2, 4.0, -0.4, SLAB[1] + 0.9, -2.85, -2.5, M["concrete"], bevel=0.005)


def interior_upper(M):
    """Livello strada visto da fuori: camera padronale sul vuoto, corridoio, camera sud-ovest."""
    x0, x1, z0, z1 = VOID
    box("PavStrada", 0.0, 14.7, SLAB[1] - 0.01, SLAB[1], -0.0, z0, M["oak"], bevel=0)
    box("PavStradaE", x1, 14.7, SLAB[1] - 0.01, SLAB[1], z0, 10.9, M["oak"], bevel=0)
    box("PavStradaS", 0.0, x1, SLAB[1] - 0.01, SLAB[1], z1, 10.9, M["oak"], bevel=0)
    box("Parapetto", x1, x1 + 0.12, SLAB[1], SLAB[1] + 1.0, 1.25, z1, M["plaster"])
    glass("VetrataCamera", (0.3, z1 + 0.04), (x1, z1 + 0.04), SLAB[1], H2 - 0.02, M, mullions=3)
    # camera padronale (z 5.9..8.9): parete verde oliva, letto in velluto verde, testiera nera
    box("CameraParete", 6.0, 6.12, SLAB[1], H2, z1, 10.5, M["olive"], bevel=0)
    box("CameraFondo", 0.3, 6.0, SLAB[1], H2, 8.85, 8.9, M["olive"], bevel=0)
    box("Testiera", 5.86, 6.0, SLAB[1], SLAB[1] + 1.3, 6.6, 8.4, M["black"], bevel=0.004)
    rounded_block("LettoBase", 3.7, 5.86, SLAB[1], SLAB[1] + 0.32, 6.7, 8.3, M["velvet_green"], radius=0.05)
    cushion("Materasso", 3.75, 5.82, SLAB[1] + 0.3, SLAB[1] + 0.55, 6.75, 8.25, M["bedding"], puff=0.02, radius=0.06)
    for zz in (7.05, 7.95):
        lib.pillow(f"Guanciale{zz}", 5.55, SLAB[1] + 0.68, zz, 0.6, 0.38, 0.16, M["bedding"], rot=(0, math.radians(-75), 0))
    box("Plaid", 3.7, 4.4, SLAB[1] + 0.52, SLAB[1] + 0.58, 6.72, 8.28, M["velvet_green"], bevel=0.02)
    box("LuceLettura", 5.84, 5.86, SLAB[1] + 1.05, SLAB[1] + 1.1, 6.7, 8.3, M["lamp_warm"], bevel=0)
    # corridoio e fondo
    box("FondoStrada", 6.0, 6.12, SLAB[1], H2, 0.2, z1, M["plaster"], bevel=0)


def interior_lower(M):
    """Soggiorno, scala, cucina: le stesse funzioni di salon.py, più le pareti interne."""
    box("Pavimento", 0.0, 14.7, -0.3, 0.0, 0.0, 10.9, M["oak"], bevel=0)
    box("ParetNord", 0.0, 14.7, 0.0, SLAB[1], -0.35, 0.0, M["plaster"], bevel=0)
    box("Boiserie", 0.0, 9.0, 0.0, SLAB[1], 0.0, 0.025, M["boiserie"], bevel=0.001)
    box("ParetEst", 14.4, 14.7, 0.0, SLAB[1], 0.0, 10.9, M["plaster"], bevel=0)
    box("ParetSud", 4.2, 14.7, 0.0, SLAB[0], 10.9, 10.92, M["plaster"], bevel=0)
    box("Pilastro", 0.12, 0.42, 0.0, SLAB[0], 5.9, 6.2, M["black"])
    salon.stair_and_fireplace(M)
    salon.living(M)
    salon.dining_kitchen(M)
    salon.ceiling(M)


def pool_and_deck(M):
    # terrazza in lastre sotto il balcone
    box("Terrazza", -2.4, 0.0, -0.4, 0.0, -1.0, 14.6, M["slate"], bevel=0)
    box("TerrazzaN", -2.4, 0.0, -0.4, 0.0, -3.4, -1.0, M["deck"], bevel=0.002)
    # deck a L e lingua di deck
    for nm, (a, b, c, d) in (("DeckN", (-9.8, -2.4, -3.4, 0.8)), ("DeckS", (-9.8, -2.4, 9.3, 14.6)), ("DeckL", (-4.4, -2.4, 0.8, 6.0))):
        box(nm, a, b, -0.4, 0.0, c, d, M["deck"], bevel=0.002)
    # vasca
    box("VascaFondo", -8.6, -4.4, -1.35, -1.1, 0.8, 9.3, M["basin"], bevel=0)
    box("VascaParetE", -4.45, -4.4, -1.35, -0.04, 0.8, 6.0, M["basin"], bevel=0)
    box("VascaParetN", -8.6, -4.4, -1.35, -0.04, 0.75, 0.8, M["basin"], bevel=0)
    box("VascaParetS", -8.6, -2.4, -1.35, -0.04, 9.3, 9.35, M["basin"], bevel=0)
    box("LinguaFondo", -4.4, -2.4, -0.7, -0.5, 6.0, 9.3, M["basin"], bevel=0)
    box("LinguaParet", -4.4, -2.4, -0.7, -0.04, 5.95, 6.0, M["basin"], bevel=0)
    box("LinguaParetE", -2.45, -2.4, -0.7, -0.04, 6.0, 9.3, M["basin"], bevel=0)
    water_surface("Acqua", [(-8.6, 0.8), (-4.4, 0.8), (-4.4, 6.0), (-2.45, 6.0), (-2.45, 9.3), (-8.6, 9.3)], -0.06, M)
    # passi in pietra sull'acqua
    for i, (x, z, w, l) in enumerate(VILLA["site"]["stones"]):
        box(f"Passo{i}", x - w / 2, x + w / 2, -0.06, 0.04, z, z + l, M["coping"], bevel=0.004)
    # sfioro: canale e bordo verso il mare, zoccolo grigio fino alla ghiaia
    water_surface("SfioroAcqua", [(-9.0, 0.8), (-8.65, 0.8), (-8.65, 9.3), (-9.0, 9.3)], -0.52, M)
    box("SfioroFondo", -9.0, -8.6, -0.8, -0.7, 0.8, 9.3, M["slate"], bevel=0)
    box("SfioroBordo", -8.65, -8.6, -1.35, -0.07, 0.8, 9.3, M["coping"], bevel=0.002)
    box("Zoccolo", -10.3, -9.0, GRAVEL_Y - 0.2, -0.45, -3.4, 14.6, M["coping"], bevel=0.006)
    box("ZoccoloDeck", -9.8, -9.0, -0.45, 0.0, -3.4, 0.8, M["deck"], bevel=0.002)
    box("ZoccoloDeckS", -9.8, -9.0, -0.45, 0.0, 9.3, 14.6, M["deck"], bevel=0.002)
    box("Gradino", -10.9, -10.3, GRAVEL_Y - 0.2, GRAVEL_Y + 0.22, -3.4, 14.6, M["coping"], bevel=0.006)
    for nm, zz in (("ZoccoloN", (-3.9, -3.4)), ("ZoccoloS", (14.6, 15.1))):
        box(nm, -10.3, 0.0, GRAVEL_Y - 0.2, 0.0, zz[0], zz[1], M["coping"], bevel=0.006)
    # luci della piscina (accese solo di sera)
    for i, (x, y, z) in enumerate(((-4.47, -0.45, 2.2), (-4.47, -0.45, 4.6), (-8.55, -0.45, 3.0), (-8.55, -0.45, 7.0))):
        box(f"LucePiscina{i}", x - 0.02, x + 0.02, y - 0.08, y + 0.08, z - 0.12, z + 0.12, M["pool_light"], bevel=0)


def water_surface(name, poly, y, M):
    """Pelo dell'acqua come superficie unica: la vasca sotto si vede per rifrazione."""
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new(B(x, y, z)) for x, z in poly])
    f.normal_update()
    if f.normal.z < 0:
        f.normal_flip()
    return lib.mesh_obj(name, bm, M["water"])


def outdoor_chair(M, name, cx, cz, facing):
    """Sedia da esterno: telaio in alluminio antracite, seduta e schienale in corda intrecciata scura."""
    s = 0.25
    zb = cz - facing * (s - 0.02)          # lato dello schienale (lontano dal tavolo)
    for dx in (-1, 1):
        x = cx + dx * (s - 0.02)
        beam(f"{name}_GA{dx}", (x, 0.0, cz + facing * (s - 0.03)), (x, 0.44, cz + facing * (s - 0.05)), 0.03, 0.03, M["steel"])
        beam(f"{name}_GP{dx}", (x, 0.0, zb - facing * 0.04), (x, 0.82, zb + facing * 0.02), 0.03, 0.03, M["steel"])
        beam(f"{name}_BR{dx}", (x, 0.62, zb), (x, 0.62, cz + facing * (s - 0.06)), 0.03, 0.03, M["steel"])
    for k in range(7):
        z = cz - s + 0.04 + k * (2 * s - 0.08) / 6
        beam(f"{name}_S{k}", (cx - s + 0.02, 0.44, z), (cx + s - 0.02, 0.44, z), 0.045, 0.012, M["anth2"])
    for k in range(5):
        y = 0.5 + k * 0.07
        beam(f"{name}_B{k}", (cx - s + 0.02, y, zb + facing * 0.012 * k), (cx + s - 0.02, y, zb + facing * 0.012 * k), 0.012, 0.045, M["anth2"])


def outdoor_furniture(M):
    # lettini sul deck nord (foto 19), divani sulla lingua, tavolo da pranzo sul deck sud
    for i, x in enumerate((-8.6, -7.4, -6.2, -5.0)):
        z0 = -2.95
        box(f"LettinoTelaio{i}", x - 0.33, x + 0.33, 0.0, 0.28, z0, z0 + 2.0, M["steel"], bevel=0.01)
        cushion(f"LettinoMat{i}", x - 0.32, x + 0.32, 0.26, 0.34, z0 + 0.02, z0 + 1.45, M["outdoor"], puff=0.02, radius=0.03)
        sch = cushion(f"LettinoSch{i}", x - 0.32, x + 0.32, 0.3, 0.38, z0 + 1.45, z0 + 1.98, M["outdoor"], puff=0.02, radius=0.03)
        sch.rotation_euler = (math.radians(-38), 0, 0)
        pv = B(x, 0.34, z0 + 1.45)
        sch.location = pv - sch.rotation_euler.to_matrix() @ pv
    for i, z in enumerate((1.6, 3.6)):
        rounded_block(f"DivanoEst{i}", -4.2, -2.8, 0.0, 0.32, z - 0.45, z + 0.45, M["outdoor"], radius=0.08)
        cushion(f"DivanoEstSch{i}", -4.2, -3.85, 0.3, 0.75, z - 0.42, z + 0.42, M["outdoor"], puff=0.05, radius=0.1)
    box("TavoloEstPiano", -9.1, -6.1, 0.72, 0.76, 10.5, 11.5, M["concrete"], bevel=0.006)
    for x in (-8.75, -6.45):
        box(f"TavoloEstGamba{x}", x - 0.05, x + 0.05, 0.0, 0.72, 10.65, 11.35, M["steel"], bevel=0.003)
    for i in range(4):
        x = -8.6 + i * 0.7
        for zz, fz in ((10.05, 1), (11.95, -1)):
            outdoor_chair(M, f"SediaEst{i}{fz}", x, zz, fz)
    # doccia sul deck nord
    box("Doccia", -2.9, -2.84, 0.0, 2.2, -3.1, -3.04, M["steel"], bevel=0.002)


def down_light(name, pos, sx, sz, energy, color):
    """Luce d'area rivolta verso il basso: sx lungo x della villa, sz lungo z."""
    d = bpy.data.lights.new(name, "AREA")
    d.energy = energy
    d.color = color
    d.shape = "RECTANGLE"
    d.size, d.size_y = sx, sz
    ob = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(ob)
    ob.location = B(*pos)
    ob.visible_glossy = False
    ob.visible_camera = False
    return ob


def lights(M, t):
    """Luci della casa: strisce LED sotto gli sbalzi, faretti nel frangisole, interni, giardino, piscina."""
    cfg = TIMES[t]
    if not cfg.get("lights"):
        for k in ("led", "lamp_warm", "pool_light"):
            M[k].node_tree.nodes["Emission"].inputs["Strength"].default_value = 0.0
        return
    k = cfg["lights_k"]
    warm = (1.0, 0.72, 0.45)
    # strisce LED (villa.json "leds")
    for i, led in enumerate(VILLA["leds"]):
        (ax, ay, az), (bx, by, bz) = led["from"], led["to"]
        box(f"LED{i}", min(ax, bx) - 0.015, max(ax, bx) + 0.015, ay - 0.01, ay, min(az, bz), max(az, bz), M["led"], bevel=0)
        L = math.hypot(bx - ax, bz - az)
        along_x = abs(ax - bx) > abs(az - bz)
        down_light(f"LEDLuce{i}", ((ax + bx) / 2, ay - 0.02, (az + bz) / 2), L if along_x else 0.05,
                   0.05 if along_x else L, 40 * L * k, warm)
    # faretti nel soffitto a doghe (villa.json "spots") e sotto il balcone
    for i, (x, y, z) in enumerate(VILLA["spots"] + [[-1.2, 2.58, 1.0], [-1.2, 2.58, 4.0], [-1.2, 2.58, 7.0]]):
        cylinder(f"FarettoV{i}", x, z, y - 0.01, y + 0.01, 0.04, M["lamp_warm"], segments=24, bevel=0)
        d = bpy.data.lights.new(f"Spot{i}", "SPOT")
        d.energy = 60 * k
        d.color = warm
        d.spot_size = math.radians(70)
        d.spot_blend = 0.6
        d.shadow_soft_size = 0.03
        ob = bpy.data.objects.new(f"Spot{i}", d)
        bpy.context.collection.objects.link(ob)
        ob.location = B(x, y - 0.03, z)
        ob.rotation_euler = (0, 0, 0)
    # interni accesi (faretti sui binari, anello LED, lampade, camini)
    interni.lights(M, k)
    # luci della piscina
    for i, (x, z, dx) in enumerate(((-4.5, 2.2, -1), (-4.5, 4.6, -1), (-8.5, 3.0, 1), (-8.5, 7.0, 1))):
        p = bpy.data.lights.new(f"Piscina{i}", "SPOT")
        p.energy = 45 * k
        p.color = (0.45, 0.85, 1.0)
        p.spot_size = math.radians(130)
        p.spot_blend = 1.0
        p.shadow_soft_size = 0.08
        ob = bpy.data.objects.new(f"Piscina{i}", p)
        bpy.context.collection.objects.link(ob)
        ob.location = B(x, -0.45, z)
        ob.rotation_euler = (B(dx, -0.35, 0) - B(0, 0, 0)).to_track_quat("-Z", "Z").to_euler()
    # segnapasso e luci da giardino (villa.json "lamps" con testa spike/up)
    for i, lp in enumerate(VILLA["lamps"]):
        if lp.get("head") not in ("spike", "up"):
            continue
        x, y, z = lp["p"]
        if lp["head"] == "spike":
            y = ground(x, z) if not (-9.8 <= x <= 0 and -3.4 <= z <= 14.6) else 0.0
        c = tuple(int(lp["c"][j:j + 2], 16) / 255 for j in (1, 3, 5))
        d = bpy.data.lights.new(f"Giardino{i}", "SPOT")
        d.energy = (30 if lp["head"] == "spike" else 70) * k
        d.color = c
        d.spot_size = math.radians(60 if lp["head"] == "up" else 100)
        d.spot_blend = 0.8
        d.shadow_soft_size = 0.02
        ob = bpy.data.objects.new(f"Giardino{i}", d)
        bpy.context.collection.objects.link(ob)
        ob.location = B(x, y + 0.15, z)
        ob.rotation_euler = (math.radians(180), 0, 0)  # verso l'alto
        cylinder(f"GiardinoCorpo{i}", x, z, y, y + 0.12, 0.035, M["steel"], segments=16, bevel=0)
    # segnapasso della scala nord
    for i in range(0, 20, 3):
        x = 3.8 - i * 0.19
        yy = SLAB[1] - (i + 1) * 0.175
        box(f"Segnapasso{i}", x - 0.1, x - 0.02, yy + 0.05, yy + 0.09, -2.51, -2.5, M["led"], bevel=0)


# ---------------------------------------------------------------- viste

CENTER = (2.5, 3.2, 6.0)


def orbit_camera(i, n=48, radius=42.0, height=17.0, lens=32.0):
    """Fotogramma i del giro: si parte dal mare (ovest) e si gira in senso orario visto dall'alto."""
    a = math.pi + 2 * math.pi * i / n
    x, z = CENTER[0] + math.cos(a) * radius, CENTER[2] - math.sin(a) * radius
    y = max(height, ground(x, z) + 3.0)
    return lib.camera(pos=(x, y, z), target=(CENTER[0], CENTER[1] + 0.5, CENTER[2]), lens=lens)


VIEWS = {
    "front": dict(pos=(-22.5, 0.15, 5.6), target=(0.0, 3.4, 5.6), lens=19.0, shift=(0.0, 0.08)),  # come la foto 19
    "aerial": dict(pos=(-34.0, 18.0, -16.0), target=(2.0, 2.0, 6.0), lens=30.0, shift=(0.0, 0.0)),
    "pool": dict(pos=(-1.6, 1.45, 15.6), target=(-8.0, 0.4, 2.0), lens=17.0, shift=(0.0, 0.0)),    # dal portico (foto 11)
    "pooltop": dict(pos=(-6.0, 14.0, 5.0), target=(-6.0, 0.0, 5.02), lens=22.0, shift=(0.0, 0.0)),
    "ne": dict(pos=(45.0, 28.0, -35.0), target=(8.0, 2.0, 2.0), lens=28.0, shift=(0.0, 0.0)),
    "east": dict(pos=(42.0, 9.0, 9.0), target=(12.0, 4.0, 5.0), lens=26.0, shift=(0.0, 0.0)),
    "hill": dict(pos=(-55.0, -6.0, -24.0), target=(4.0, 4.5, 6.0), lens=45.0, shift=(0.0, 0.0)),   # da valle (foto 26)
}


def build(t, preview):
    sc = lib.reset(samples=64 if preview else 512, res=(960, 540) if preview else (1920, 1080))
    sc.render.use_persistent_data = True
    sc.cycles.adaptive_threshold = 0.02 if preview else 0.01
    sky(t)
    M = materials(t)
    terrain(M)
    road(M)
    sea_and_coast(M)
    house(M)
    interior_lower(M)
    interni.lower_details(M)
    interni.upper(M)
    interni.passage(M)
    pool_and_deck(M)
    outdoor_furniture(M)
    vegetation()
    lights(M, t)
    lib.post(glare=0.06 if TIMES[t].get("lights") else 0.03, dispersion=0.006, vignette=0.22)
    return M


def parse_frames(s, n=48):
    if not s:
        return list(range(n))
    out = []
    for part in s.split(","):
        if "-" in part:
            a, b = part.split("-")
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--time", default="sunset", choices=list(TIMES))
    ap.add_argument("--view", default="front", help="front | aerial | pool | hill | orbit")
    ap.add_argument("--frames", default="", help="per orbit: es. 0-47 oppure 0,12,24,36")
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--samples", type=int, default=0)
    ap.add_argument("--res", default="", help="es. 1920x1080")
    ap.add_argument("--save-blend", action="store_true")
    ap.add_argument("--skip-existing", action="store_true", help="salta i fotogrammi/panorami già renderizzati")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    a = ap.parse_args(argv)
    OUT.mkdir(parents=True, exist_ok=True)
    build(a.time, a.preview)
    sc = bpy.context.scene
    if a.samples:
        sc.cycles.samples = a.samples
    if a.res:
        sc.render.resolution_x, sc.render.resolution_y = map(int, a.res.split("x"))
    if a.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT / f"villa_{a.time}.blend"))
    suffix = "_preview" if a.preview else ""
    if a.view.startswith("pano:"):
        names = a.view.split(":", 1)[1].split(",")
        if not a.res:
            sc.render.resolution_x, sc.render.resolution_y = (2000, 1000) if a.preview else (6000, 3000)
        if any(n not in ("terrazza", "passaggio") for n in names):
            interni.portals()
        base_exp = TIMES[a.time]["exposure"]
        ti = list(TIMES).index(a.time)
        for name in names:
            if a.skip_existing and (OUT / f"pano_{name}_{a.time}{suffix}.jpg").exists():
                continue
            cam = interni.pano_camera(name)
            sc.view_settings.exposure = base_exp + interni.PANOS[name]["exp"][ti]
            lib.render(OUT / f"pano_{name}_{a.time}{suffix}.jpg")
            bpy.data.objects.remove(cam, do_unlink=True)
            print(f"panorama {name} fatto", flush=True)
    elif a.view == "orbit":
        d = OUT / f"orbit_{a.time}{suffix}"
        d.mkdir(parents=True, exist_ok=True)
        for i in parse_frames(a.frames):
            if a.skip_existing and (d / f"f{i:02d}.jpg").exists():
                continue
            cam = orbit_camera(i)
            lib.render(d / f"f{i:02d}.jpg")
            bpy.data.objects.remove(cam, do_unlink=True)
            print(f"fotogramma {i} fatto", flush=True)
    else:
        for name in a.view.split(","):
            v = VIEWS[name]
            cam = lib.camera(pos=v["pos"], target=v["target"], lens=v["lens"], shift=v["shift"])
            lib.render(OUT / f"villa_{a.time}_{name}{suffix}.jpg")
            bpy.data.objects.remove(cam, do_unlink=True)


if __name__ == "__main__":
    main()
