"""Soggiorno a doppia altezza del livello mare, con vista sulla terrazza, la piscina e il mare.

Prima prova di realismo: stessa inquadratura della foto 08 (public/source/08-...jpg).
Uso:
  /home/user/.venv-blender/bin/python render/salon.py --preview     (veloce, per l'inquadratura)
  /home/user/.venv-blender/bin/python render/salon.py               (qualità piena)
Il file .blend viene salvato in render/out/salon.blend: si può aprire e modificare in Blender.
"""
import argparse
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy  # noqa: E402
import lib  # noqa: E402
from lib import B, box, beam, prism, cushion, rounded_block, cylinder  # noqa: E402

OUT = lib.ROOT / "out"

# ------------------------------------------------------------------ parametri principali
H1 = 2.70          # altezza netta del livello mare (sotto il solaio)
SLAB = (2.70, 3.50)
H2 = 6.30          # soffitto della doppia altezza
VOID = (0.0, 4.6, 0.2, 5.9)  # x0, x1, z0, z1 del vuoto
SEA_Z = (-1.0, 8.9)          # facciata vetrata sul mare (z)


def materials():
    M = {}
    M["oak"] = lib.mat_pbr("Rovere", "laminate_floor_02", size=2.4, rot_deg=90, rough_add=0.05, hsv=(0.5, 0.75, 1.3))
    M["boiserie"] = lib.mat_pbr("Boiserie", "oak_veneer_01", size=1.6, rot_deg=0, rough_add=0.05, hsv=(0.5, 1.0, 0.85))
    M["plaster"] = lib.mat_color("Intonaco", (0.88, 0.87, 0.84), rough=0.9)
    M["black"] = lib.mat_color("NeroOpaco", (0.025, 0.025, 0.026), rough=0.55, metal=0.0)
    M["steel"] = lib.mat_color("AcciaioNero", (0.02, 0.02, 0.02), rough=0.38, metal=0.85)
    M["frame"] = lib.mat_color("Telaio", (0.03, 0.03, 0.032), rough=0.4, metal=0.6)
    M["glass"] = lib.mat_glass()
    M["smoked"] = lib.mat_color("VetroFume", (0.05, 0.05, 0.05), rough=0.02, metal=0.0, spec=1.0)
    M["marble"] = lib.mat_black_marble()
    M["bench"] = lib.mat_pbr("PietraNera", "granite_tile", size=3.0, tint=(0.25, 0.25, 0.26), rough_add=0.05, normal_strength=0.3)
    M["slate"] = lib.mat_pbr("Lastre", "granite_tile", size=2.4, tint=(0.8, 0.8, 0.82), normal_strength=0.8)
    M["deck"] = lib.mat_pbr("Deck", "wood_floor_deck", size=2.0, rot_deg=90, hsv=(0.5, 0.75, 0.9))
    M["stone"] = lib.mat_pbr("Pietra", "rustic_stone_wall_02", size=2.6, hsv=(0.5, 0.7, 1.1))
    M["ground"] = lib.mat_pbr("Terreno", "dry_ground_rocks", size=6.0, hsv=(0.5, 0.85, 0.9))
    M["scrub"] = lib.mat_pbr("Macchia", "dry_ground_rocks", size=14.0, tint=(0.42, 0.48, 0.3), hsv=(0.5, 0.9, 0.75))
    M["sea"] = lib.mat_sea()
    M["water"] = lib.mat_water()
    M["sofa"] = lib.mat_fabric("TessutoDivano", (0.42, 0.405, 0.385), bump=0.12, bump_scale=650)
    M["sofa_dark"] = lib.mat_fabric("TessutoScuro", (0.34, 0.32, 0.3))
    M["velvet"] = lib.mat_pbr("VellutoPoltrone", "velour_velvet", size=0.8, tint=(0.33, 0.26, 0.21), hsv=(0.08, 0.15, 1.0), normal_strength=0.4)
    for k in ("velvet",):
        bsdf = M[k].node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Sheen Weight"].default_value = 0.9
        bsdf.inputs["Sheen Roughness"].default_value = 0.35
    M["mustard"] = lib.mat_fabric("VellutoSenape", (0.62, 0.42, 0.05), sheen=0.9, rough=0.7)
    M["rug"] = lib.mat_fabric("Tappeto", (0.62, 0.6, 0.56), rough=0.95, sheen=0.4, bump=0.25, bump_scale=420)
    M["outdoor"] = lib.mat_fabric("TessutoEsterno", (0.32, 0.32, 0.31), rough=0.95, sheen=0.2)
    M["led"] = lib.mat_emission("LED", (1.0, 0.78, 0.55), 6)
    M["flame"] = lib.mat_emission("Fiamma", (1.0, 0.36, 0.08), 18)
    M["art"] = lib.mat_color("Quadro", (0.2, 0.21, 0.22), rough=0.8)
    M["artline"] = lib.mat_color("QuadroChiaro", (0.75, 0.74, 0.72), rough=0.8)
    M["pot"] = lib.mat_color("Vaso", (0.55, 0.5, 0.44), rough=0.75)
    M["brass"] = lib.mat_color("Ottone", (0.75, 0.55, 0.25), rough=0.35, metal=1.0)
    M["leaf"] = lib.mat_color("Foglie", (0.12, 0.16, 0.08), rough=0.6)
    return M


def architecture(M):
    # Pavimento in rovere e sottofondo
    box("Pavimento", 0.0, 14.7, -0.3, 0.0, 0.0, 10.9, M["oak"], bevel=0)
    # Solaio del livello strada con il vuoto della doppia altezza
    x0, x1, z0, z1 = VOID
    prism("Solaio", [(0, 0), (14.7, 0), (14.7, 10.9), (0, 10.9), (0, z1), (x1, z1), (x1, z0), (0, z0)], SLAB[0], SLAB[1], M["plaster"])
    # fascia nera sul bordo del vuoto (lato sud e lato est)
    box("BordoVuotoSud", 0.0, x1 + 0.02, SLAB[0] - 0.02, SLAB[1] + 0.02, z1 - 0.02, z1 + 0.02, M["black"])
    box("BordoVuotoEst", x1 - 0.02, x1 + 0.02, SLAB[0] - 0.02, SLAB[1] + 0.02, z0, z1, M["black"])
    # Copertura sopra la doppia altezza
    box("Copertura", -0.2, 14.9, H2, H2 + 0.6, -0.2, 11.1, M["plaster"], bevel=0)

    # Parete nord con boiserie (piano terra) e intonaco sopra
    box("ParetNord", 0.0, 14.7, 0.0, H2, -0.35, 0.0, M["plaster"], bevel=0)
    box("Boiserie", 0.0, 9.0, 0.0, SLAB[1], 0.0, 0.025, M["boiserie"], bevel=0.001)
    for i in range(1, 9):  # fughe verticali dei pannelli
        box(f"Fuga{i}", i * 1.0 - 0.003, i * 1.0 + 0.003, 0.0, SLAB[1], 0.024, 0.027, M["black"], bevel=0)
    # Parete est (dietro la cucina) e parete sud
    box("ParetEst", 14.7, 15.0, 0.0, H2, 0.0, 10.9, M["plaster"], bevel=0)
    box("ParetSud", 0.0, 14.7, 0.0, H2, 10.9, 11.25, M["plaster"], bevel=0)
    # Pilastro nero tra vetrata e zona pranzo (foto 08)
    box("Pilastro", 0.12, 0.42, 0.0, SLAB[0], 5.9, 6.2, M["black"])

    # Livello strada visto dal vuoto: parapetto bianco del ballatoio, vetrata della camera
    box("Parapetto", x1, x1 + 0.12, SLAB[1], SLAB[1] + 1.0, 1.25, z1, M["plaster"])
    glass_wall("VetrataCamera", (0.3, z1 + 0.04), (x1, z1 + 0.04), SLAB[1], H2 - 0.02, M, mullions=3)
    box("CameraFondo", 0.0, x1, SLAB[1], H2, z1 + 2.5, z1 + 2.6, M["plaster"], bevel=0)
    box("CameraPavimento", 0.0, x1, SLAB[1] - 0.01, SLAB[1], z1, z1 + 2.6, M["oak"], bevel=0)

    # Facciata vetrata sul mare: due livelli nel vuoto, uno altrove
    z_a, z_b = SEA_Z
    glass_wall("VetrataMare", (0.0, z_a + 1.0), (0.0, z_b), 0.0, SLAB[0] - 0.05, M, mullions=5)
    glass_wall("VetrataMareAlta", (0.0, z0), (0.0, z1), SLAB[1] + 0.05, H2 - 0.05, M, mullions=3)
    # fascia nera esterna (bordo del balcone) tra i due livelli
    box("FasciaBalcone", -2.45, 0.05, SLAB[0] - 0.12, SLAB[1] + 0.02, z_a, z_b + 5.5, M["black"])
    # vetrata alta dove non c'è il vuoto (camere): parete
    box("ParetAltaNord", -0.05, 0.0, SLAB[1], H2, z_a, z0, M["black"], bevel=0)
    box("ParetAltaSud", -0.35, 0.0, SLAB[1], H2, z1, 10.9, M["black"], bevel=0)
    # sbalzo della copertura verso il mare con il soffitto in doghe
    box("Sbalzo", -5.0, 0.0, H2 + 0.05, H2 + 0.7, -0.4, 9.3, M["black"])
    for i in range(int(4.9 / 0.12)):
        x = -4.95 + i * 0.12
        box(f"Doga{i}", x, x + 0.06, H2 - 0.02, H2 + 0.05, -0.3, 9.2, M["deck"], bevel=0.002)
    # torre in pietra a sud della vetrata (all'esterno)
    box("TorrePietra", -1.6, 0.0, 0.0, 7.3, 8.9, 10.9, M["stone"], bevel=0.01)
    box("ParetePranzo", 0.0, 0.3, 0.0, SLAB[0], 8.9, 10.9, M["black"], bevel=0.002)


def glass_wall(name, a, b, y0, y1, M, mullions=4):
    """Vetrata con telaio nero sottile: (x, z) da a a b, quote y0..y1."""
    (ax, az), (bx, bz) = a, b
    vertical = abs(ax - bx) < 1e-6
    t = 0.012
    if vertical:
        box(name, ax - t, ax + t, y0, y1, az, bz, M["glass"], bevel=0)
        for i in range(mullions + 1):
            z = az + (bz - az) * i / mullions
            box(f"{name}_M{i}", ax - 0.06, ax + 0.06, y0, y1, z - 0.03, z + 0.03, M["frame"], bevel=0.002)
        box(f"{name}_B", ax - 0.06, ax + 0.06, y0, y0 + 0.05, az, bz, M["frame"], bevel=0.002)
        box(f"{name}_T", ax - 0.06, ax + 0.06, y1 - 0.06, y1, az, bz, M["frame"], bevel=0.002)
    else:
        box(name, ax, bx, y0, y1, az - t, az + t, M["glass"], bevel=0)
        for i in range(mullions + 1):
            x = ax + (bx - ax) * i / mullions
            box(f"{name}_M{i}", x - 0.03, x + 0.03, y0, y1, az - 0.05, az + 0.05, M["frame"], bevel=0.002)
        box(f"{name}_B", ax, bx, y0, y0 + 0.05, az - 0.05, az + 0.05, M["frame"], bevel=0.002)
        box(f"{name}_T", ax, bx, y1 - 0.06, y1, az - 0.05, az + 0.05, M["frame"], bevel=0.002)


def stair_and_fireplace(M):
    # Panca nera del camino (fa anche da primo gradino), con bruciatore lineare
    box("Panca", 0.35, 4.3, 0.0, 0.42, 0.03, 1.25, M["bench"], bevel=0.006)
    box("Bruciatore", 1.5, 3.4, 0.405, 0.425, 0.62, 0.74, M["steel"], bevel=0.001)
    box("Fiamma", 1.6, 3.3, 0.42, 0.47, 0.66, 0.70, M["flame"], bevel=0)
    # Scala: pedate in rovere, cosciali in acciaio nero, sale verso est fino al ballatoio
    steps = 16
    x_start, x_end = 1.0, 4.55
    rise = (SLAB[1] - 0.42) / steps
    run = (x_end - x_start) / steps
    zf, zb = 0.08, 1.02
    for i in range(steps):
        x = x_start + i * run
        y = 0.42 + rise * (i + 1)
        box(f"Pedata{i}", x - 0.02, x + run + 0.03, y - 0.04, y, zf, zb, M["boiserie"], bevel=0.003)
    ang_len = math.hypot(x_end - x_start, SLAB[1] - 0.42)
    for z in (zf - 0.012, zb + 0.012):
        beam(f"Cosciale{z:.2f}", (x_start - 0.05, 0.36, z), (x_end + 0.05, SLAB[1] - 0.04, z), 0.012, 0.26, M["steel"])
    # ringhiera sul lato aperto: piatti sottili inclinati (foto 24)
    for k, h in enumerate((0.95, 0.62, 0.3)):
        beam(f"Corrimano{k}", (x_start, 0.42 + h, zb + 0.03), (x_end, SLAB[1] + h, zb + 0.03), 0.012, 0.03 if k == 0 else 0.012, M["steel"])
    for i in range(0, steps + 1, 4):
        x = x_start + i * run
        y = 0.42 + rise * i
        beam(f"Montante{i}", (x, y, zb + 0.03), (x, y + 0.98, zb + 0.03), 0.02, 0.02, M["steel"])


def living(M):
    # Tappeto
    box("Tappeto", 0.9, 4.5, 0.0, 0.014, 1.65, 5.45, M["rug"], bevel=0.004)
    # Tavolino: piano in vetro fumé, telaio sottile nero
    box("TavolinoPiano", 2.15, 3.45, 0.36, 0.38, 2.95, 3.75, M["smoked"], bevel=0.002)
    for (x, z) in ((2.18, 2.98), (3.42, 2.98), (2.18, 3.72), (3.42, 3.72)):
        box(f"TavGamba{x}{z}", x - 0.012, x + 0.012, 0.0, 0.36, z - 0.012, z + 0.012, M["steel"], bevel=0.001)
    for z in (2.98, 3.72):
        box(f"TavTraversa{z}", 2.18, 3.42, 0.34, 0.36, z - 0.012, z + 0.012, M["steel"], bevel=0.001)
    box("Vaso", 2.5, 2.62, 0.38, 0.52, 3.2, 3.32, M["smoked"], bevel=0.02)

    # Divano componibile basso (schienale a sud, guarda il camino)
    sofa(M, "DivanoA", x0=1.15, x1=4.25, z_back=5.55, depth=1.0, facing="north")
    # Poltrone in velluto vicino alla vetrata, rivolte verso il soggiorno
    armchair(M, "PoltronaN", 1.15, 2.25)
    armchair(M, "PoltronaS", 1.15, 3.6)


def sofa(M, name, x0, x1, z_back, depth, facing, xw=None):
    seat_h, base_h, back_h = 0.42, 0.22, 0.78
    if facing == "north":
        za, zb = z_back - depth, z_back
        rounded_block(f"{name}_Base", x0, x1, 0.04, base_h, za + 0.02, zb, M["sofa_dark"], radius=0.03)
        n = 3
        w = (x1 - x0) / n
        for i in range(n):
            cushion(f"{name}_Seduta{i}", x0 + i * w + 0.01, x0 + (i + 1) * w - 0.01, base_h, seat_h, za, zb - 0.22, M["sofa"], puff=0.04)
            cushion(f"{name}_Schienale{i}", x0 + i * w + 0.02, x0 + (i + 1) * w - 0.02, seat_h - 0.02, back_h, zb - 0.26, zb - 0.02, M["sofa"], puff=0.05, radius=0.08)
        cushion(f"{name}_Cuscino", x0 + 0.25, x0 + 0.7, seat_h, seat_h + 0.42, zb - 0.38, zb - 0.24, M["sofa_dark"], puff=0.1, radius=0.09)
    else:  # verso ovest, schienale a est in xw
        xa, xb = xw - depth, xw
        za, zb = x0, x1  # qui x0/x1 sono le z
        rounded_block(f"{name}_Base", xa + 0.02, xb, 0.04, base_h, za, zb, M["sofa_dark"], radius=0.03)
        n = 3
        w = (zb - za) / n
        for i in range(n):
            cushion(f"{name}_Seduta{i}", xa, xb - 0.22, base_h, seat_h, za + i * w + 0.01, za + (i + 1) * w - 0.01, M["sofa"], puff=0.04)
            cushion(f"{name}_Schienale{i}", xb - 0.26, xb - 0.02, seat_h - 0.02, back_h, za + i * w + 0.02, za + (i + 1) * w - 0.02, M["sofa"], puff=0.05, radius=0.08)
        cushion(f"{name}_Cuscino", xb - 0.38, xb - 0.24, seat_h, seat_h + 0.42, za + 0.3, za + 0.75, M["sofa_dark"], puff=0.1, radius=0.09)


def armchair(M, name, cx, cz):
    """Poltrona a pozzetto in velluto (forma a botte), seduta morbida."""
    shell = cylinder(f"{name}_Guscio", cx, cz, 0.04, 0.72, 0.42, M["velvet"], segments=48, bevel=0.06)
    shell.modifiers["Bevel"].limit_method = "NONE"
    shell.modifiers["Bevel"].segments = 5
    sol = shell.modifiers.new("Spessore", "SOLIDIFY")
    sol.thickness = 0.1
    # apertura verso est (davanti), con taglio dello schienale
    cutter = box(f"{name}_Taglio", cx, cx + 0.6, 0.38, 1.0, cz - 0.6, cz + 0.6, None, bevel=0)
    boolean = shell.modifiers.new("Taglio", "BOOLEAN")
    boolean.object = cutter
    boolean.operation = "DIFFERENCE"
    cutter.hide_render = True
    cutter.hide_viewport = True
    sub = shell.modifiers.new("Sub", "SUBSURF")
    sub.levels = sub.render_levels = 1
    seat = cylinder(f"{name}_Seduta", cx + 0.02, cz, 0.04, 0.44, 0.36, M["velvet"], segments=48, bevel=0.05)
    seat.modifiers["Bevel"].limit_method = "NONE"
    seat.modifiers["Bevel"].segments = 5


def dining_kitchen(M):
    # Tavolo da pranzo nero e sedie in velluto senape (foto 08 e 15)
    box("TavoloPiano", 0.85, 3.25, 0.72, 0.76, 6.9, 7.95, M["black"], bevel=0.004)
    for (x, z) in ((1.05, 7.05), (3.05, 7.05), (1.05, 7.8), (3.05, 7.8)):
        box(f"TavoloGamba{x}{z}", x - 0.03, x + 0.03, 0.0, 0.72, z - 0.03, z + 0.03, M["black"], bevel=0.002)
    for i, x in enumerate((1.2, 2.05, 2.9)):
        chair(M, f"SediaN{i}", x, 6.55, 1)
        chair(M, f"SediaS{i}", x, 8.3, -1)
    # lampada lineare sopra il tavolo
    box("Lampada", 1.25, 2.85, 1.95, 1.99, 7.38, 7.46, M["black"], bevel=0.002)
    box("LampadaLED", 1.27, 2.83, 1.946, 1.951, 7.39, 7.45, M["led"], bevel=0)
    for x in (1.4, 2.7):
        beam(f"Cavo{x}", (x, 1.99, 7.42), (x, SLAB[0], 7.42), 0.003, 0.003, M["black"])

    # Isola della cucina: piano in marmo nero, frontali in rovere
    box("IsolaCorpo", 6.4, 9.4, 0.0, 0.88, 6.1, 7.0, M["boiserie"], bevel=0.003)
    box("IsolaZoccolo", 6.45, 9.35, 0.0, 0.08, 6.15, 6.95, M["black"], bevel=0)
    box("IsolaPiano", 6.35, 9.45, 0.88, 0.92, 6.05, 7.05, M["marble"], bevel=0.003)
    # Colonne nere della cucina sulla parete est e bancone bar a nord
    box("Colonne", 13.95, 14.7, 0.0, 2.6, 1.0, 9.5, M["black"], bevel=0.003)
    box("Bancone", 9.6, 12.4, 0.0, 1.05, 1.1, 1.75, M["marble"], bevel=0.003)
    # Quadro sulla parete sud
    box("Quadro", 5.0, 6.6, 1.25, 2.05, 10.86, 10.9, M["art"], bevel=0.004)
    box("QuadroLinea", 5.1, 6.5, 1.62, 1.66, 10.855, 10.86, M["artline"], bevel=0)


def chair(M, name, cx, cz, facing):
    """Sedia imbottita (velluto senape) con gambe nere sottili."""
    s = 0.24
    cushion(f"{name}_Seduta", cx - s, cx + s, 0.42, 0.5, cz - s, cz + s, M["mustard"], puff=0.03, radius=0.04)
    zb = cz + facing * (s - 0.04)
    zb0, zb1 = (zb - 0.06, zb + 0.06)
    cushion(f"{name}_Schienale", cx - s + 0.02, cx + s - 0.02, 0.5, 0.86, min(zb0, zb1), max(zb0, zb1), M["mustard"], puff=0.04, radius=0.05)
    for (dx, dz) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        box(f"{name}_G{dx}{dz}", cx + dx * (s - 0.04) - 0.012, cx + dx * (s - 0.04) + 0.012, 0.0, 0.42, cz + dz * (s - 0.04) - 0.012, cz + dz * (s - 0.04) + 0.012, M["steel"], bevel=0.002)


def ceiling(M):
    # Anello LED quadrato sospeso nella doppia altezza (foto 08 e 15)
    cx, cz, s, y = 2.3, 3.05, 0.85, 4.85
    for (a, b) in (((cx - s, cz - s), (cx + s, cz - s)), ((cx + s, cz - s), (cx + s, cz + s)),
                   ((cx + s, cz + s), (cx - s, cz + s)), ((cx - s, cz + s), (cx - s, cz - s))):
        beam("AnelloLED", (a[0], y, a[1]), (b[0], y, b[1]), 0.035, 0.035, M["brass"])
        beam("AnelloLuce", (a[0], y - 0.019, a[1]), (b[0], y - 0.019, b[1]), 0.02, 0.004, M["led"])
    for (x, z) in ((cx - s, cz - s), (cx + s, cz + s)):
        beam("Sospensione", (x, y, z), (x, H2, z), 0.002, 0.002, M["black"])
    # binari luce neri sul soffitto del piano terra
    for z in (7.4, 3.0):
        x0 = 5.0 if z < 6 else 4.0
        beam(f"Binario{z}", (x0, SLAB[0] - 0.02, z), (13.5, SLAB[0] - 0.02, z), 0.035, 0.04, M["black"])
        for k in range(5):
            x = x0 + 0.8 + k * 1.8
            cylinder(f"Faretto{z}{k}", x, z, SLAB[0] - 0.22, SLAB[0] - 0.04, 0.035, M["black"], segments=24, bevel=0.003)


def exterior(M):
    # Terrazza coperta in lastre, deck, piscina, arredi esterni
    box("Terrazza", -2.4, 0.0, -0.05, 0.0, -1.0, 14.4, M["slate"], bevel=0)
    box("DeckNord", -9.8, -2.4, -0.07, 0.0, -3.4, 0.8, M["deck"], bevel=0)
    box("DeckSud", -9.8, -2.4, -0.07, 0.0, 9.3, 14.6, M["deck"], bevel=0)
    box("DeckLingua", -4.4, -2.4, -0.07, 0.0, 0.8, 6.0, M["deck"], bevel=0)
    # vasca: bordo in pietra, acqua quasi a filo (sfioro verso ovest)
    box("VascaFondo", -9.0, -4.4, -1.6, -1.2, 0.8, 9.3, M["slate"], bevel=0)
    box("Acqua", -9.0, -4.4, -1.2, -0.04, 0.8, 9.3, M["water"], bevel=0)
    box("AcquaLingua", -4.4, -2.4, -0.6, -0.04, 6.0, 9.3, M["water"], bevel=0)
    for i, x in enumerate((-2.55, -3.15, -3.75, -4.35)):
        box(f"Passo{i}", x - 0.25, x + 0.25, -0.06, 0.03, 7.15, 8.65, M["slate"], bevel=0.004)
    box("SfioroBordo", -9.4, -9.0, -1.6, -0.08, 0.6, 9.5, M["slate"], bevel=0)
    # versante che scende verso il mare oltre la piscina, e il mare
    slope(M)
    prism("TerrenoNord", [(-9.8, -3.4), (14.7, -3.4), (14.7, -30), (-9.8, -30)], -2.0, 1.2, M["ground"])
    # divani da esterno sulla lingua di deck (foto 08)
    for i, z in enumerate((1.5, 3.5)):
        rounded_block(f"DivanoEst{i}", -4.2, -2.8, 0.0, 0.32, z - 0.45, z + 0.45, M["outdoor"], radius=0.08)
        cushion(f"DivanoEstSchienale{i}", -4.2, -3.85, 0.3, 0.75, z - 0.42, z + 0.42, M["outdoor"], puff=0.05, radius=0.1)


def slope(M):
    """Versante con macchia mediterranea fino al mare (60 m più in basso), poi il mare aperto."""
    import bmesh
    bm = bmesh.new()
    xs = [-9.8, -20, -40, -80, -140, -220, -300]
    ys = [-0.7, -2.5, -8, -20, -38, -55, -61]
    zs = [-200, -40, 0, 15, 50, 200]
    grid = [[bm.verts.new(B(x, y, z)) for z in zs] for x, y in zip(xs, ys)]
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            bm.faces.new([grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    lib.mesh_obj("Versante", bm, M["scrub"])
    # mare: grande piano con onde e riflessi del cielo
    bm = bmesh.new()
    R = 30000
    vs = [bm.verts.new(B(x, -60.0, z)) for x, z in ((-280, -R), (-280, R), (-R, R), (-R, -R))]
    bm.faces.new(vs)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    lib.mesh_obj("Mare", bm, M["sea"])


def portals():
    """Portali di luce sulle vetrate: guidano i campioni del cielo verso l'interno (meno rumore)."""
    for name, pos, sx, sy in (("PortaleBasso", (0.05, 1.33, 3.95), 9.9, 2.65), ("PortaleAlto", (0.05, 4.9, 3.05), 5.7, 2.7)):
        ob = lib.area_light(name, pos, sx, 1.0, direction=(1, 0, 0), size_y=sy)
        ob.data.cycles.is_portal = True
        ob.rotation_euler = (B(1, 0, 0) - B(0, 0, 0)).to_track_quat("-Z", "X").to_euler()


def build(preview=False):
    lib.reset(samples=48 if preview else 640, res=(960, 640) if preview else (1800, 1200))
    hdri = lib.ASSETS / "hdri" / "white_cliff_top_4k.hdr"
    # Il sole dell'HDRI è a NO: ruotando di 67° finisce a ovest-sudovest, sopra il mare.
    lib.world_hdri(hdri, rotation_deg=67, strength=1.0, background_strength=0.55)
    el = math.radians(23.2)
    az = math.radians(135 + 67)
    sun_dir = (math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el))
    lib.sun(sun_dir, strength=4.5, angle_deg=0.53, color=(1.0, 0.88, 0.74))
    M = materials()
    architecture(M)
    stair_and_fireplace(M)
    living(M)
    dining_kitchen(M)
    ceiling(M)
    exterior(M)
    portals()
    # Camera come nella foto 08: dal fondo del soggiorno verso la vetrata, obiettivo grandangolare
    lib.camera(pos=(4.35, 1.28, 1.75), target=(0.0, 1.28, 3.7), lens=15.0, shift=(0.0, 0.1))
    # luce di riempimento morbida alle spalle della camera (come il flash di rimbalzo del fotografo)
    lib.area_light("Riempimento", (8.5, 2.2, 6.5), 3.0, 110, color=(1.0, 0.93, 0.85), direction=(-1, -0.15, -0.4), size_y=2.0)
    return M


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    a = ap.parse_args(argv)
    OUT.mkdir(parents=True, exist_ok=True)
    build(a.preview)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "salon.blend"))
    lib.render(OUT / ("salon_preview.jpg" if a.preview else "salon.jpg"))


if __name__ == "__main__":
    main()
