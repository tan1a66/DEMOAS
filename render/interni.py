"""Interni della villa per i panorami 360°: dettagli del livello mare, camera padronale, bagno, ballatoio,
passaggio in pietra, luci interne e camere panoramiche. Usato da villa.py (stesse coordinate).

Riferimenti: foto 09/13 (boiserie, camino a parete, bar, cantinette), 10/14 (cucina, isola), 15 (ballatoio),
28/29 (camera: vetrata sul vuoto, pannelli neri girevoli, parete verde oliva, letto in velluto), 23 (bagno in
cantiere: parete verde salvia, lungo top con due lavabi, pavimento scuro), 22 (passaggio cemento/pietra).
"""
import math

import bpy

import lib
from lib import B, box, beam, cushion, rounded_block, cylinder

SLAB, H2 = (2.70, 3.50), 6.30
VOID = (0.0, 4.6, 0.2, 5.9)
U = SLAB[1]  # quota del pavimento del livello strada


def materials(M):
    M["rug_dark"] = lib.mat_rug("TappetoScuro", (0.2, 0.19, 0.17))
    M["sage"] = lib.mat_color("VerdeSalvia", (0.36, 0.42, 0.34), rough=0.85)
    M["bath_floor"] = lib.mat_pbr("PavBagno", "granite_tile", size=1.2, tint=(0.3, 0.3, 0.31), normal_strength=0.3)
    M["bath_top"] = lib.mat_pbr("TopBagno", "granite_tile", size=1.0, tint=(0.55, 0.55, 0.55), normal_strength=0.2, rough_add=-0.1)
    M["ceramic"] = lib.mat_color("Ceramica", (0.85, 0.85, 0.83), rough=0.15, coat=0.6)
    M["mirror"] = lib.mat_color("Specchio", (0.9, 0.9, 0.9), rough=0.02, metal=1.0)
    M["chrome"] = lib.mat_color("Cromo", (0.8, 0.8, 0.8), rough=0.12, metal=1.0)
    M["shell"] = lib.mat_color("GuscioSgabello", (0.04, 0.04, 0.04), rough=0.35, coat=0.3)
    M["bottle"] = lib.mat_color("Bottiglie", (0.04, 0.06, 0.03), rough=0.1, spec=0.8)
    M["wine_led"] = lib.mat_emission("LEDCantina", (1.0, 0.82, 0.62), 4)
    M["concrete_board"] = lib.mat_pbr("CementoCassero", "concrete_layers_02", size=2.2, hsv=(0.5, 0.12, 0.7), normal_strength=1.5)
    M["stone_dark"] = lib.mat_pbr("PietraScura", "rustic_stone_wall_02", size=2.2, hsv=(0.5, 0.35, 0.55), normal_strength=1.6)
    M["duvet"] = lib.mat_fabric("Piumone", (0.62, 0.62, 0.58), bump=0.1)
    M["linen"] = lib.mat_fabric("Lino", (0.7, 0.68, 0.62), bump=0.1)
    M["towel"] = lib.mat_fabric("Asciugamano", (0.8, 0.78, 0.74), bump=0.2, bump_scale=300)


# ---------------------------------------------------------------- livello mare: dettagli

def lower_details(M):
    # camino a parete nella boiserie (foto 09 e 13), a est della scala
    box("CaminoParete", 5.6, 7.6, 0.42, 0.9, 0.0, 0.06, M["black"], bevel=0.003)
    box("CaminoVetro", 5.68, 7.52, 0.5, 0.82, 0.055, 0.065, M["smoked"], bevel=0)
    box("CaminoFiamma", 5.8, 7.4, 0.52, 0.6, 0.02, 0.05, M["flame"], bevel=0)
    # mobili alti neri con cantinette retroilluminate e nicchie in rovere (foto 13): parete nord, dopo la boiserie
    for i, (a, b) in enumerate(((9.0, 9.15), (9.7, 9.9), (10.95, 11.1), (12.15, 12.3), (12.85, 13.95))):
        box(f"MobiliBar{i}", a, b, 0.0, 2.6, 0.0, 0.62, M["black"], bevel=0.003)
    for i, x0 in enumerate((9.9, 11.1)):
        x1 = x0 + 1.05
        box(f"CantinaFondo{i}", x0, x1, 0.0, 2.6, 0.0, 0.15, M["black"], bevel=0)
        box(f"CantinaBase{i}", x0, x1, 0.0, 0.12, 0.15, 0.62, M["black"], bevel=0.002)
        box(f"CantinaCielo{i}", x0, x1, 2.1, 2.6, 0.15, 0.62, M["black"], bevel=0.002)
        box(f"CantinaVetro{i}", x0 + 0.02, x1 - 0.02, 0.12, 2.1, 0.6, 0.61, M["smoked"], bevel=0)
        for k in range(9):
            y = 0.3 + k * 0.2
            box(f"CantinaLED{i}{k}", x0 + 0.05, x1 - 0.05, y, y + 0.012, 0.54, 0.56, M["wine_led"], bevel=0)
            box(f"CantinaRip{i}{k}", x0 + 0.02, x1 - 0.02, y - 0.012, y, 0.15, 0.58, M["steel"], bevel=0)
            for j in range(7):
                cx = x0 + 0.1 + j * 0.14
                cylinder(f"Bott{i}{k}{j}", cx, 0.37, y + 0.0, y + 0.075, 0.035, M["bottle"], segments=12, bevel=0)
    for i, x0 in enumerate((9.15, 12.3)):
        x1 = x0 + 0.55
        box(f"NicchiaFondo{i}", x0, x1, 0.0, 2.6, 0.0, 0.05, M["boiserie"], bevel=0)
        box(f"NicchiaBase{i}", x0, x1, 0.0, 0.12, 0.05, 0.62, M["black"], bevel=0.002)
        box(f"NicchiaCielo{i}", x0, x1, 2.5, 2.6, 0.05, 0.62, M["black"], bevel=0.002)
        for k in range(4):
            y = 0.5 + k * 0.5
            box(f"NicchiaRipiano{i}{k}", x0 + 0.01, x1 - 0.01, y, y + 0.03, 0.05, 0.6, M["boiserie"], bevel=0.001)
        box(f"NicchiaLED{i}", x0 + 0.02, x1 - 0.02, 2.48, 2.5, 0.08, 0.5, M["wine_led"], bevel=0)
    # bancone del bar più scuro, sgabelli e lampade a sospensione
    for i, x in enumerate((10.1, 10.95, 11.8)):
        stool(M, f"Sgabello{i}", x, 2.1)
    for i, x in enumerate((10.4, 11.6)):
        beam(f"CavoBar{i}", (x, 1.95, 1.42), (x, SLAB[0], 1.42), 0.004, 0.004, M["black"])
        cylinder(f"LampadaBar{i}", x, 1.42, 1.7, 1.95, 0.07, M["black"], segments=32, bevel=0.003)
        cylinder(f"LampadaBarLuce{i}", x, 1.42, 1.69, 1.7, 0.055, M["lamp_warm"], segments=32, bevel=0)
    # madia sotto il quadro (parete sud) e lavello sull'isola
    box("Madia", 4.7, 6.9, 0.0, 0.62, 10.45, 10.9, M["boiserie"], bevel=0.003)
    box("MadiaZoccolo", 4.75, 6.85, 0.0, 0.06, 10.5, 10.85, M["black"], bevel=0)
    box("Lavello", 8.2, 8.9, 0.88, 0.925, 6.35, 6.75, M["steel"], bevel=0.003)
    beam("Rubinetto", (8.55, 0.92, 6.2), (8.55, 1.25, 6.2), 0.025, 0.025, M["black"])
    beam("RubinettoB", (8.55, 1.25, 6.2), (8.55, 1.25, 6.45), 0.022, 0.022, M["black"])
    lib.append_model("ceramic_vase_01", (7.2, 0.92, 6.55), rot_deg=40, scale=1.2)


def stool(M, name, cx, cz):
    """Sgabello da bar: guscio nero, stelo e base tonda (foto 13)."""
    cylinder(f"{name}_Base", cx, cz, 0.0, 0.02, 0.22, M["black"], segments=32, bevel=0.004)
    cylinder(f"{name}_Stelo", cx, cz, 0.02, 0.62, 0.025, M["black"], segments=16, bevel=0)
    cylinder(f"{name}_Pog", cx, cz, 0.25, 0.27, 0.2, M["black"], segments=32, bevel=0.003)
    seat = rounded_block(f"{name}_Seduta", cx - 0.21, cx + 0.21, 0.62, 0.7, cz - 0.2, cz + 0.2, M["shell"], radius=0.035)
    back = rounded_block(f"{name}_Schienale", cx - 0.2, cx + 0.2, 0.7, 0.92, cz + 0.15, cz + 0.2, M["shell"], radius=0.02)
    return seat, back


# ---------------------------------------------------------------- livello strada

def upper(M):
    x0, x1, z0, z1 = VOID
    box("PavStrada", 0.0, 14.7, U - 0.01, U, -0.0, z0, M["oak"], bevel=0)
    box("PavStradaE", x1, 14.7, U - 0.01, U, z0, 10.9, M["oak"], bevel=0)
    box("PavStradaS", 0.0, x1, U - 0.01, U, z1, 10.9, M["oak"], bevel=0)
    box("Parapetto", x1, x1 + 0.12, U, U + 1.0, 1.25, z1, M["plaster"])
    # vetrata della camera sul vuoto (foto 28): telaio nero spesso, due ante
    lib_glass(M, "VetrataCamera", (0.3, z1 + 0.04), (x1, z1 + 0.04), U, H2 - 0.02, mullions=2)
    # ballatoio: parete di fondo con porta filo muro e binario luci
    box("FondoStrada", 6.0, 6.12, U, H2, 0.2, 4.95, M["plaster"], bevel=0)
    box("FondoStradaS", 6.0, 6.12, U, H2, 5.75, z1, M["plaster"], bevel=0)
    box("PortaBagnoSopra", 6.0, 6.12, U + 2.3, H2, 4.95, 5.75, M["plaster"], bevel=0)
    for zz in (4.95, 5.75):  # stipiti neri sottili
        box(f"PortaBagnoStipite{zz}", 5.99, 6.13, U, U + 2.3, zz - 0.015, zz + 0.015, M["black"], bevel=0.002)
    box("PortaBagnoTraverso", 5.99, 6.13, U + 2.285, U + 2.315, 4.95, 5.75, M["black"], bevel=0.002)
    box("PortaFondo", 5.98, 6.0, U, U + 2.4, 2.4, 3.3, M["black"], bevel=0.002)
    beam("BinarioBallatoio", (5.3, H2 - 0.03, 0.4), (5.3, H2 - 0.03, 5.6), 0.035, 0.04, M["black"])
    for k, z in enumerate((1.2, 2.8, 4.4)):
        cylinder(f"FarettoBall{k}", 5.3, z, H2 - 0.24, H2 - 0.05, 0.035, M["black"], segments=24, bevel=0.003)
    bedroom(M)
    bathroom(M)
    guest_room(M)


def guest_room(M):
    """Seconda camera nell'angolo sud-est del livello strada (x 9.62..13.3, z 6..10.9): si vede nella sezione."""
    xa, xb, za, zb = 9.62, 13.3, 6.0, 10.88
    box("Camera2ParetN", xa, xb, U, H2, za - 0.1, za, M["plaster"], bevel=0)
    box("Camera2ParetS", xa, xb, U, H2, zb, zb + 0.02, M["plaster"], bevel=0)
    box("Camera2ParetE", xb - 0.02, xb, U, H2, za, zb, M["plaster"], bevel=0)
    box("Camera2Boiserie", xb - 0.06, xb - 0.02, U, U + 1.2, 7.2, 9.8, M["boiserie"], bevel=0.002)
    rounded_block("Letto2", 11.3, xb - 0.06, U, U + 0.32, 7.6, 9.4, M["linen"], radius=0.06)
    cushion("Letto2Piumone", 11.25, 12.8, U + 0.3, U + 0.42, 7.62, 9.38, M["duvet"], puff=0.02, radius=0.05)
    for zz in (8.05, 8.95):
        pl = lib.pillow(f"Letto2Guanciale{zz}", 12.95, U + 0.55, zz, 0.62, 0.42, 0.15, M["linen"])
        pl.rotation_mode = "ZYX"
        pl.rotation_euler = (0, math.radians(-20), math.radians(90))
    for zz in (7.3, 9.7):
        cylinder(f"Comodino2{zz}", 12.95, zz, U, U + 0.45, 0.2, M["black"], segments=40, bevel=0.01)
        cylinder(f"Lampada2{zz}", 12.95, zz, U + 0.45, U + 0.75, 0.1, M["lamp_warm"], segments=24, bevel=0.01)
    box("Camera2Tappeto", 10.4, 12.6, U, U + 0.012, 7.2, 9.8, M["rug_dark"], bevel=0.004)
    box("Camera2Scrivania", 9.75, 10.45, U + 0.72, U + 0.76, 9.6, 10.75, M["boiserie"], bevel=0.003)
    beam("BinarioCamera2", (10.2, H2 - 0.03, 8.4), (12.8, H2 - 0.03, 8.4), 0.035, 0.04, M["black"])


def lib_glass(M, name, a, b, y0, y1, mullions=2):
    import salon
    salon.glass_wall(name, a, b, y0, y1, M, mullions=mullions)


def bedroom(M):
    """Camera padronale (x 0..6, z 5.9..8.85): letto verso il mare, parete verde oliva con fascia nera,
    pannelli neri girevoli lungo la parete sud, binario luci."""
    zb0, zb1 = 6.7, 8.3            # larghezza del letto lungo z
    # parete del letto: verde oliva sopra, fascia nera con luci di lettura
    box("CameraParete", 6.0, 6.12, U, H2, 5.9, 8.85, M["olive"], bevel=0)
    box("FasciaTestiera", 5.92, 6.0, U + 0.95, U + 1.25, 6.25, 8.75, M["black"], bevel=0.003)
    for zz in (6.45, 8.55):
        box(f"LuceLettura{zz}", 5.88, 5.92, U + 1.02, U + 1.06, zz - 0.1, zz + 0.1, M["lamp_warm"], bevel=0.002)
    # letto imbottito in velluto verde (foto 28/29)
    rounded_block("LettoTelaio", 3.75, 5.92, U, U + 0.3, zb0, zb1, M["velvet_green"], radius=0.08, segments=5)
    tb = cushion("Testata", 5.6, 5.92, U + 0.25, U + 1.0, zb0 + 0.02, zb1 - 0.02, M["velvet_green"], puff=0.04, radius=0.1)
    cushion("Materasso", 3.85, 5.6, U + 0.28, U + 0.52, zb0 + 0.08, zb1 - 0.08, M["linen"], puff=0.015, radius=0.06)
    duv = cushion("Piumone", 3.8, 5.0, U + 0.48, U + 0.58, zb0 + 0.04, zb1 - 0.04, M["duvet"], puff=0.03, radius=0.05)
    lib.wrinkles(duv, 0.012, 0.25)
    # (lib.pillow: larghezza su x, spessore su y, altezza su z di Blender; ordine ZYX = prima gira, poi inclina)
    for zz, tw in ((7.12, -2), (7.88, 3)):
        pl = lib.pillow(f"Guanciale{zz}", 5.43, U + 0.74, zz, 0.68, 0.46, 0.17, M["linen"])
        pl.rotation_mode = "ZYX"
        pl.rotation_euler = (0, math.radians(22), math.radians(90 + tw))
    pl = lib.pillow("CuscinoRighe", 5.2, U + 0.7, 7.5, 0.5, 0.36, 0.13, M["sofa"])
    pl.rotation_mode = "ZYX"
    pl.rotation_euler = (0, math.radians(30), math.radians(94))
    box("Plaid", 4.05, 4.5, U + 0.56, U + 0.6, zb0 - 0.02, zb1 + 0.02, M["velvet_green"], bevel=0.02)
    # comodini tondi neri
    for zz in (6.35, 8.65):
        cylinder(f"Comodino{zz}", 5.6, zz, U, U + 0.42, 0.21, M["black"], segments=48, bevel=0.01)
    # pannelli neri girevoli a tutta altezza lungo la parete sud (cabina armadio dietro)
    box("CameraFondoO", 0.3, 3.3, U, H2, 8.85, 8.9, M["olive"], bevel=0)
    box("CameraFondoE", 3.95, 6.0, U, H2, 8.85, 8.9, M["olive"], bevel=0)
    box("CameraFondoSopra", 3.3, 3.95, U + 2.4, H2, 8.85, 8.9, M["olive"], bevel=0)
    # cabina armadio (x 1.6..6, z 8.9..10.9): ripiani e appenderia in rovere, porta verso il bagno
    box("CabinaFondo", 1.6, 6.0, U, H2, 10.86, 10.9, M["plaster"], bevel=0)
    box("CabinaArmadio", 1.7, 5.9, U, U + 2.5, 10.35, 10.86, M["boiserie"], bevel=0.003)
    for k in range(3):
        y = U + 0.4 + k * 0.7
        box(f"CabinaVano{k}", 1.75, 5.85, y, y + 0.5, 10.34, 10.36, M["black"], bevel=0)
    for i in range(7):
        x = 0.9 + i * 0.68
        ang = (0, 0, 18, 0, 65, 0, 0)[i]
        pnl = box(f"Pannello{i}", -0.3, 0.3, U + 0.01, H2 - 0.03, -0.02, 0.02, M["black"], bevel=0.003)
        pnl.location = B(x, 0, 8.6)
        pnl.rotation_euler = (0, 0, math.radians(ang))
    # binario luci sul soffitto (foto 28)
    beam("BinarioCamera", (0.5, H2 - 0.03, 6.4), (5.6, H2 - 0.03, 6.4), 0.035, 0.04, M["black"])
    for k, x in enumerate((1.2, 2.6, 4.0)):
        cylinder(f"FarettoCam{k}", x, 6.4, H2 - 0.24, H2 - 0.05, 0.035, M["black"], segments=24, bevel=0.003)
    # tappeto e poltroncina verso il mare
    box("TappetoCamera", 1.6, 4.4, U, U + 0.012, 6.4, 8.6, M["rug_dark"], bevel=0.004)
    import salon
    salon.armchair(M, "PoltronaCamera", 1.0, 8.0, facing_deg=150)
    for ob in [o for o in bpy.data.objects if o.name.startswith("PoltronaCamera")]:
        ob.location.z += U


def ellipse_block(name, cx, cz, y0, y1, rx, rz, material, bevel=0.02, segments=48):
    """Blocco a pianta ellittica (rx lungo x, rz lungo z della villa), con spigoli arrotondati."""
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=1.0, radius2=1.0, depth=y1 - y0)
    for v in bm.verts:
        v.co.x *= rx
        v.co.y *= rz
    bmesh.ops.translate(bm, verts=bm.verts, vec=B(cx, (y0 + y1) / 2, cz))
    ob = lib.mesh_obj(name, bm, material, bevel, segments=4, smooth=True)
    if bevel:
        ob.modifiers["Bevel"].limit_method = "NONE"
    return ob


def sanitary(M, name, cx, z_wall, y_top, lid=True):
    """Wc o bidet sospeso: corpo ovale attaccato alla parete (z_wall), profondo 0,54 m."""
    ellipse_block(f"{name}_Corpo", cx, z_wall + 0.3, y_top - 0.3, y_top, 0.18, 0.24, M["ceramic"], bevel=0.05)
    box(f"{name}_Attacco", cx - 0.17, cx + 0.17, y_top - 0.3, y_top, z_wall, z_wall + 0.22, M["ceramic"], bevel=0.04)
    if lid:
        ellipse_block(f"{name}_Sedile", cx, z_wall + 0.32, y_top + 0.005, y_top + 0.03, 0.18, 0.23, M["ceramic"], bevel=0.012)
    else:
        ellipse_block(f"{name}_Bacino", cx, z_wall + 0.31, y_top - 0.02, y_top + 0.002, 0.13, 0.17, M["mirror"], bevel=0.0)
        beam(f"{name}_Rubinetto", (cx, y_top, z_wall + 0.08), (cx, y_top + 0.12, z_wall + 0.08), 0.03, 0.03, M["black"])
        beam(f"{name}_Bocca", (cx, y_top + 0.12, z_wall + 0.08), (cx, y_top + 0.12, z_wall + 0.17), 0.02, 0.02, M["black"])


def sanitary_x(M, name, x_wall, cz, y_top, lid=True):
    """Come sanitary(), ma su una parete lungo z (x = x_wall): il corpo sporge verso +x."""
    ellipse_block(f"{name}_Corpo", x_wall + 0.3, cz, y_top - 0.3, y_top, 0.24, 0.18, M["ceramic"], bevel=0.05)
    box(f"{name}_Attacco", x_wall, x_wall + 0.22, y_top - 0.3, y_top, cz - 0.17, cz + 0.17, M["ceramic"], bevel=0.04)
    if lid:
        ellipse_block(f"{name}_Sedile", x_wall + 0.32, cz, y_top + 0.005, y_top + 0.03, 0.23, 0.18, M["ceramic"], bevel=0.012)
    else:
        ellipse_block(f"{name}_Bacino", x_wall + 0.31, cz, y_top - 0.02, y_top + 0.002, 0.17, 0.13, M["mirror"], bevel=0.0)
        beam(f"{name}_Rubinetto", (x_wall + 0.08, y_top, cz), (x_wall + 0.08, y_top + 0.12, cz), 0.03, 0.03, M["black"])
        beam(f"{name}_Bocca", (x_wall + 0.08, y_top + 0.12, cz), (x_wall + 0.17, y_top + 0.12, cz), 0.02, 0.02, M["black"])


def bathroom(M):
    """Bagno padronale (x 6.12..9.5, z 5.9..10.9): parete verde salvia, pavimento scuro, top lungo con due
    lavabi e specchio retroilluminato, doccia a filo con vetro, wc sospeso; finestra sul lato sud."""
    xa, xb, za, zb = 6.12, 9.5, 4.95, 10.9
    box("BagnoPav", xa, xb, U, U + 0.012, za, zb, M["bath_floor"], bevel=0)
    box("BagnoParetN", xa, xb, U, H2, za - 0.1, za, M["plaster"], bevel=0)
    # lato bagno della parete ovest (dietro c'è la camera, verde oliva): salvia, con il vano della porta
    box("BagnoPelleO", xa, xa + 0.02, U, H2, 5.75, zb, M["sage"], bevel=0)
    box("BagnoParetE", xb, xb + 0.12, U, H2, za, zb, M["sage"], bevel=0)
    box("BagnoParetO", 6.0, 6.12, U, H2, 8.85, zb, M["sage"], bevel=0)
    for nm, (a, b, y0, y1) in (("BagnoS1", (xa, 6.8, U, H2)), ("BagnoS2", (8.4, xb, U, H2)),
                               ("BagnoS3", (6.8, 8.4, U, U + 0.8)), ("BagnoS4", (6.8, 8.4, U + 2.3, H2))):
        box(nm, a, b, y0, y1, zb - 0.02, zb, M["sage"], bevel=0)
    # top lungo con due lavabi sulla parete est
    box("BagnoTop", xb - 0.55, xb, U + 0.82, U + 0.88, 6.4, 9.6, M["bath_top"], bevel=0.004)
    box("BagnoMobile", xb - 0.53, xb, U + 0.45, U + 0.82, 6.45, 9.55, M["boiserie"], bevel=0.003)
    for i, zz in enumerate((7.25, 8.75)):
        box(f"Lavabo{i}", xb - 0.45, xb - 0.1, U + 0.88, U + 0.98, zz - 0.25, zz + 0.25, M["ceramic"], bevel=0.02)
        beam(f"RubinettoB{i}", (xb - 0.04, U + 1.15, zz), (xb - 0.2, U + 1.15, zz), 0.02, 0.02, M["black"])
    box("Specchio", xb - 0.03, xb, U + 1.1, U + 2.2, 6.6, 9.4, M["mirror"], bevel=0.002)
    box("SpecchioLuce", xb - 0.02, xb - 0.005, U + 1.08, U + 1.1, 6.6, 9.4, M["lamp_warm"], bevel=0)
    # doccia a filo nell'angolo sud-ovest, con parete in vetro e soffione
    box("DocciaPiatto", xa, 7.8, U + 0.012, U + 0.02, 9.95, zb, M["bath_floor"], bevel=0)
    box("DocciaVetro", 6.3, 7.15, U + 0.02, U + 2.1, 9.95, 9.96, M["glass"], bevel=0)
    beam("DocciaProfilo", (6.3, U + 2.1, 9.955), (7.15, U + 2.1, 9.955), 0.02, 0.02, M["black"])
    cylinder("Soffione", 6.9, 10.45, H2 - 0.33, H2 - 0.3, 0.15, M["black"], segments=32, bevel=0.003)
    beam("SoffioneBraccio", (6.9, H2 - 0.3, 10.45), (6.9, H2, 10.45), 0.015, 0.015, M["black"])
    # wc sospeso sulla parete nord, asciugamani
    # sanitari sospesi in ceramica bianca: wc con sedile e bidet con rubinetto
    # wc e bidet sulla parete ovest, di fronte ai lavabi (richiesta di Alessia)
    xw = xa + 0.02
    sanitary_x(M, "WC", xw, 7.1, U + 0.42, lid=True)
    sanitary_x(M, "Bidet", xw, 7.85, U + 0.4, lid=False)
    box("PlaccaWC", xw, xw + 0.008, U + 0.95, U + 1.1, 7.03, 7.17, M["black"], bevel=0.002)
    beam("Portasciugamani", (xb - 0.06, U + 1.0, 9.75), (xb - 0.06, U + 1.0, 10.5), 0.015, 0.015, M["black"])
    box("Asciugamano", xb - 0.1, xb - 0.04, U + 0.55, U + 1.02, 9.8, 10.45, M["towel"], bevel=0.01)
    # binario luci
    beam("BinarioBagno", (7.8, H2 - 0.03, 6.2), (7.8, H2 - 0.03, 10.6), 0.035, 0.04, M["black"])


# ---------------------------------------------------------------- passaggio in pietra (foto 22)

def ramp_y(x):
    return max(0.0, min(U, (x - 4.2) / (14.7 - 4.2) * U))


def passage(M):
    """Passaggio a gradoni lungo il lato sud: muro in pietra della casa a nord, cemento a cassero a sud.
    Scende dal piazzale (3,5 m) al portico (0) e si apre sul tavolo esterno e sul mare."""
    n = 20
    for i in range(n):
        xa = 4.2 + (14.7 - 4.2) * i / n
        xb = 4.2 + (14.7 - 4.2) * (i + 1) / n
        y = ramp_y(xb) - 0.0
        box(f"Gradone{i}", xa, xb + 0.02, -0.4, max(0.02, y), 11.35, 12.45, M["slate"], bevel=0.004)
    box("MuroCassero", 4.2, 15.15, -0.4, U + 0.45, 12.45, 12.75, M["concrete_board"], bevel=0.004)
    box("GradoniBordo", 4.2, 14.7, -0.4, 0.0, 12.3, 12.45, M["slate"], bevel=0)
    # luci basse nel muro in cemento
    for i, x in enumerate((6.0, 8.6, 11.2, 13.8)):
        y = ramp_y(x) + 0.3
        box(f"LucePassaggio{i}", x - 0.08, x + 0.08, y, y + 0.05, 12.43, 12.45, M["lamp_warm"], bevel=0)


# ---------------------------------------------------------------- luci interne

def spot(name, pos, energy, color=(1.0, 0.78, 0.55), size_deg=55, aim=(0, -1, 0), soft=0.02):
    d = bpy.data.lights.new(name, "SPOT")
    d.energy = energy
    d.color = color
    d.spot_size = math.radians(size_deg)
    d.spot_blend = 0.5
    d.shadow_soft_size = soft
    ob = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(ob)
    ob.location = B(*pos)
    a = B(*aim) - B(0, 0, 0)
    ob.rotation_euler = a.to_track_quat("-Z", "Y").to_euler() if abs(a.z) < 0.999 else (0, 0, 0)
    return ob


def lights(M, k):
    """Luci interne accese (k = intensità relativa: 1 di notte, ~0,35 al tramonto)."""
    warm = (1.0, 0.76, 0.5)
    # faretti sui binari del soggiorno/cucina (salon.ceiling): orientati un po' verso pareti e tavoli
    for z, x0 in ((7.4, 4.0), (3.0, 5.0)):
        for kk in range(5):
            x = x0 + 0.8 + kk * 1.8
            aim = (0.15 * (1 if kk % 2 else -1), -1, 0.25 * (1 if z < 6 else -1))
            spot(f"SpotBin{z}{kk}", (x, SLAB[0] - 0.25, z), 55 * k, warm, 45, aim)
    # anello LED sospeso nella doppia altezza
    for i, (dx, dz) in enumerate(((0, -0.85), (0, 0.85), (-0.85, 0), (0.85, 0))):
        d = bpy.data.lights.new(f"AnelloL{i}", "AREA")
        d.energy = 45 * k
        d.color = warm
        d.size, d.size_y = (1.7, 0.03) if dx == 0 else (0.03, 1.7)
        ob = bpy.data.objects.new(f"AnelloL{i}", d)
        bpy.context.collection.objects.link(ob)
        ob.location = B(2.3 + dx, 4.82, 3.05 + dz)
        ob.visible_camera = False
        ob.visible_glossy = False
    # lampada lineare del tavolo, lampade del bar, cantinette, camini
    d = bpy.data.lights.new("TavoloL", "AREA")
    d.energy, d.color, d.size, d.size_y = 70 * k, warm, 1.55, 0.05
    ob = bpy.data.objects.new("TavoloL", d)
    bpy.context.collection.objects.link(ob)
    ob.location = B(2.05, 1.94, 7.42)
    ob.visible_camera = False
    for i, x in enumerate((10.4, 11.6)):
        spot(f"SpotBar{i}", (x, 1.68, 1.42), 30 * k, warm, 70)
    for nm, pos, e in (("FuocoCamino", (2.45, 0.6, 0.68), 25), ("FuocoParete", (6.6, 0.7, 0.25), 20)):
        d = bpy.data.lights.new(nm, "POINT")
        d.energy, d.color, d.shadow_soft_size = e * max(k, 0.4), (1.0, 0.45, 0.15), 0.3
        ob = bpy.data.objects.new(nm, d)
        bpy.context.collection.objects.link(ob)
        ob.location = B(*pos)
    # livello strada: ballatoio, camera, bagno
    for kk, z in enumerate((1.2, 2.8, 4.4)):
        spot(f"SpotBall{kk}", (5.3, H2 - 0.26, z), 35 * k, warm, 50, (-0.2, -1, 0))
    for kk, x in enumerate((1.2, 2.6, 4.0)):
        spot(f"SpotCam{kk}", (x, H2 - 0.26, 6.4), 35 * k, warm, 50, (0.0, -1, 0.35))
    for zz in (6.45, 8.55):
        spot(f"Lettura{zz}", (5.86, U + 1.0, zz), 12 * k, warm, 60, (-0.6, -1, 0))
    for kk, z in enumerate((6.8, 8.4, 10.0)):
        spot(f"SpotBagno{kk}", (7.8, H2 - 0.26, z), 30 * k, warm, 55, (0.3, -1, 0))
    d = bpy.data.lights.new("SpecchioL", "AREA")
    d.energy, d.color, d.size, d.size_y = 40 * k, warm, 0.04, 2.8
    ob = bpy.data.objects.new("SpecchioL", d)
    bpy.context.collection.objects.link(ob)
    ob.location = B(9.42, U + 1.07, 8.0)
    ob.visible_camera = False
    for zz in (7.3, 9.7):
        d = bpy.data.lights.new(f"Lampada2L{zz}", "POINT")
        d.energy, d.color, d.shadow_soft_size = 18 * max(k, 0.5), warm, 0.08
        ob = bpy.data.objects.new(f"Lampada2L{zz}", d)
        bpy.context.collection.objects.link(ob)
        ob.location = B(12.95, U + 0.62, zz)
    # passaggio
    for i, x in enumerate((6.0, 8.6, 11.2, 13.8)):
        spot(f"SpotPass{i}", (x, ramp_y(x) + 0.32, 12.4), 10 * k, warm, 120, (0, -0.4, -1))


def portals():
    """Portali sulle vetrate: guidano i campioni del cielo verso l'interno (meno rumore di giorno)."""
    for name, pos, sx, sy in (("PortaleBasso", (0.03, 1.33, 4.45), 8.9, 2.65), ("PortaleAlto", (0.03, 4.9, 4.45), 8.9, 2.75),
                              ("PortaleNord", (3.75, 4.9, -0.03), 7.5, 2.75)):
        ob = lib.area_light(name, pos, sx, 1.0, direction=(1, 0, 0), size_y=sy)
        ob.data.cycles.is_portal = True
        inward = B(0, 0, 1) if name == "PortaleNord" else B(1, 0, 0)
        ob.rotation_euler = (inward - B(0, 0, 0)).to_track_quat("-Z", "Y").to_euler()  # X orizzontale, Y verticale


# ---------------------------------------------------------------- panorami

# punto di vista (x, quota occhi, z), direzione iniziale dello sguardo, esposizione in più rispetto all'esterno
PANOS = {  # exp = esposizione in più rispetto all'esterno per (mattina, tramonto, notte)
    "soggiorno": dict(pos=(4.15, 1.55, 3.3), look=(-1.0, 1.4, 3.6), exp=(3.0, 0.9, -0.5)),
    "cucina": dict(pos=(7.6, 1.55, 4.6), look=(2.0, 1.4, 4.0), exp=(3.0, 0.9, -0.5)),
    "ballatoio": dict(pos=(5.25, U + 1.55, 2.2), look=(0.0, U + 0.5, 3.0), exp=(2.6, 0.8, -0.5)),
    "camera": dict(pos=(3.2, U + 1.5, 7.5), look=(0.0, U + 1.4, 7.4), exp=(2.9, 0.9, -0.6)),
    "bagno": dict(pos=(7.4, U + 1.55, 7.6), look=(9.5, U + 1.4, 8.0), exp=(3.3, 1.1, -0.3)),
    "terrazza": dict(pos=(-3.4, 1.6, 4.4), look=(-12.0, 1.0, 4.4), exp=(0.0, 0.0, 0.0)),
    "passaggio": dict(pos=(5.2, ramp_y(5.2) + 1.6, 11.9), look=(-6.0, 0.5, 11.9), exp=(1.2, 0.4, 0.0)),
}


def pano_camera(name):
    p = PANOS[name]
    cam = lib.camera(pos=p["pos"], target=p["look"], lens=20)
    d = cam.data
    d.type = "PANO"
    try:
        d.panorama_type = "EQUIRECTANGULAR"
    except (AttributeError, TypeError):
        d.cycles.panorama_type = "EQUIRECTANGULAR"
    # orizzonte dritto: guarda in orizzontale verso il bersaglio
    px, py, pz = p["pos"]
    lx, _, lz = p["look"]
    cam.rotation_euler = (B(lx, py, lz) - B(px, py, pz)).to_track_quat("-Z", "Y").to_euler()
    return cam
