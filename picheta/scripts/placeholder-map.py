"""Genera la mappa PROVVISORIA di Mérida per la Scena 2 (public/assets/merida-mapa.jpg).

Stile del riferimento: foto in bianco e nero di una mappa a griglia del centro
di Mérida vista dall'alto, dentro un doppio cerchio bianco a spray, su pietra
scura con fessure, semi e aghi di pino. Basta sostituire il file con la foto
vera e regolare CONFIG.map in src/config.js (centro/raggio del cerchio, griglia,
Plaza Grande, Catedral, Pasaje Picheta) se le posizioni cambiano.

Uso:  python3 scripts/placeholder-map.py public/assets/merida-mapa.jpg
"""
import math
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "merida-mapa.jpg"
S = 2048
C = S / 2
rng = np.random.default_rng(1639)  # año del Ayuntamiento en el Pasaje
random.seed(1639)


def noise(scale, octaves=5):
    """Ruido de valor multi-octava en [0, 1] (S x S)."""
    acc = np.zeros((S, S), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        n = max(2, int(S / scale * (2 ** o)))
        small = Image.fromarray((rng.random((n, n)) * 255).astype(np.uint8))
        acc += np.asarray(small.resize((S, S), Image.BICUBIC), np.float32) / 255 * amp
        tot += amp
        amp *= 0.5
    return acc / tot


# ---------------------------------------------------------------- piedra
stone = 0.1 + 0.07 * noise(700) + 0.03 * (noise(60, 3) - 0.5)
img = Image.fromarray(np.clip(stone * 255, 0, 255).astype(np.uint8), "L")
d = ImageDraw.Draw(img)

# Fisuras: caminos aleatorios oscuros con ramas.
for _ in range(16):
    x, y = random.uniform(0, S), random.uniform(0, S)
    a = random.uniform(0, 6.28)
    for _ in range(random.randint(30, 90)):
        a += random.gauss(0, 0.35)
        nx, ny = x + math.cos(a) * 14, y + math.sin(a) * 14
        d.line((x, y, nx, ny), fill=random.randint(8, 18), width=random.choice([1, 2, 2, 3]))
        if random.random() < 0.04:
            bx, by, ba = nx, ny, a + random.choice([-1, 1]) * random.uniform(0.6, 1.2)
            for _ in range(random.randint(5, 18)):
                ba += random.gauss(0, 0.3)
                ex, ey = bx + math.cos(ba) * 10, by + math.sin(ba) * 10
                d.line((bx, by, ex, ey), fill=14, width=1)
                bx, by = ex, ey
        x, y = nx, ny

# ---------------------------------------------------------------- mapa
P = 126  # paso de manzana (px)
ST = 18  # ancho de calle (px)
R_MAP = 812
m = Image.new("L", (S, S), 52)
md = ImageDraw.Draw(m)
asphalt = (noise(40, 3) * 30).astype(np.uint8)
m = Image.fromarray(np.clip(np.asarray(m, np.int16) + asphalt - 15, 0, 255).astype(np.uint8))
md = ImageDraw.Draw(m)
x0 = C - P / 2


def block_rect(i, j):
    return (x0 + i * P + ST / 2, x0 + j * P + ST / 2, x0 + (i + 1) * P - ST / 2, x0 + (j + 1) * P - ST / 2)


def building(r, tone):
    x1, y1, x2, y2 = r
    md.rectangle((x1 + 3, y1 + 4, x2 + 3, y2 + 4), fill=max(0, tone - 90))  # sombra
    md.rectangle(r, fill=tone)


def tree(x, y, rad):
    for _ in range(9):
        ox, oy = random.gauss(0, rad * 0.35), random.gauss(0, rad * 0.35)
        rr = rad * random.uniform(0.45, 0.8)
        md.ellipse((x + ox - rr + 3, y + oy - rr + 4, x + ox + rr + 3, y + oy + rr + 4), fill=34)
    for _ in range(9):
        ox, oy = random.gauss(0, rad * 0.35), random.gauss(0, rad * 0.35)
        rr = rad * random.uniform(0.4, 0.75)
        md.ellipse((x + ox - rr, y + oy - rr, x + ox + rr, y + oy + rr), fill=random.randint(70, 118))


for i in range(-8, 9):
    for j in range(-8, 9):
        r = block_rect(i, j)
        cx, cy = (r[0] + r[2]) / 2, (r[1] + r[3]) / 2
        if math.hypot(cx - C, cy - C) > R_MAP + P:
            continue
        if (i, j) == (0, 0):
            # Plaza Grande: pavimento claro, senderos en diagonal, laureles y quiosco.
            md.rectangle(r, fill=196)
            md.line((r[0], r[1], r[2], r[3]), fill=226, width=7)
            md.line((r[2], r[1], r[0], r[3]), fill=226, width=7)
            for _ in range(26):
                tx, ty = random.uniform(r[0] + 8, r[2] - 8), random.uniform(r[1] + 8, r[3] - 8)
                if abs((tx - cx) - (ty - cy)) < 9 or abs((tx - cx) + (ty - cy)) < 9:
                    continue
                tree(tx, ty, random.uniform(8, 13))
            md.ellipse((cx - 9, cy - 9, cx + 9, cy + 9), fill=236)
            continue
        md.rectangle(r, fill=118)
        # Manzana colonial: crujías alrededor del perímetro y patios dentro.
        w = r[2] - r[0]
        h = r[3] - r[1]
        band = random.uniform(0.28, 0.36)
        for side in range(4):
            n = random.randint(3, 6)
            for k in range(n):
                u1, u2 = k / n, (k + 1) / n - 0.015
                tone = random.randint(138, 200)
                if side == 0:
                    rect = (r[0] + u1 * w, r[1], r[0] + u2 * w, r[1] + h * band * random.uniform(0.8, 1.15))
                elif side == 1:
                    rect = (r[0] + u1 * w, r[3] - h * band * random.uniform(0.8, 1.15), r[0] + u2 * w, r[3])
                elif side == 2:
                    rect = (r[0], r[1] + u1 * h, r[0] + w * band * random.uniform(0.8, 1.1), r[1] + u2 * h)
                else:
                    rect = (r[2] - w * band * random.uniform(0.8, 1.1), r[1] + u1 * h, r[2], r[1] + u2 * h)
                building(rect, tone)
        # Interior: patios con vegetación y alguna construcción suelta.
        for _ in range(random.randint(1, 3)):
            bx, by = random.uniform(r[0] + w * 0.3, r[2] - w * 0.45), random.uniform(r[1] + h * 0.3, r[3] - h * 0.45)
            building((bx, by, bx + random.uniform(10, 24), by + random.uniform(10, 24)), random.randint(150, 205))
        for _ in range(random.randint(0, 3)):
            tree(random.uniform(r[0] + w * 0.3, r[2] - w * 0.3), random.uniform(r[1] + h * 0.3, r[3] - h * 0.3), random.uniform(6, 10))
        if random.random() < 0.2:
            tx, ty = random.uniform(r[0] + 4, r[2] - 8), random.uniform(r[1] + 4, r[1] + 20)
            md.rectangle((tx, ty, tx + 5, ty + 5), fill=230)

# Catedral (lado oriente de la plaza): nave en cruz, dos torres y cúpula.
r = block_rect(1, 0)
cx0 = r[0] + 12
building((cx0, r[1] + 10, cx0 + 72, r[3] - 10), 232)
building((cx0 + 18, r[1] - 2, cx0 + 52, r[3] + 2), 240)
for ty in (r[1] + 8, r[3] - 26):
    building((cx0 - 2, ty, cx0 + 18, ty + 18), 250)
md.ellipse((cx0 + 44, (r[1] + r[3]) / 2 - 12, cx0 + 68, (r[1] + r[3]) / 2 + 12), fill=250, outline=120)
# Palacio de Gobierno y Pasaje Picheta (lado norte, calle 61).
r = block_rect(0, -1)
building((r[0] + 4, r[3] - 46, r[0] + 52, r[3] - 2), 228)
building((r[0] + 56, r[3] - 38, r[2] - 4, r[3] - 2), 214)
md.rectangle((r[0] + 70, r[3] - 26, r[0] + 84, r[3] - 12), fill=96)  # patio del Pasaje

roof = 0.82 + 0.3 * noise(9, 2)
m = Image.fromarray(np.clip(np.asarray(m, np.float32) * roof, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).ellipse((C - R_MAP, C - R_MAP, C + R_MAP, C + R_MAP), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(3))
img = Image.composite(m, img, mask)
d = ImageDraw.Draw(img)

# ---------------------------------------------------------------- semillas y agujas de pino
def needle(x, y):
    a = random.uniform(0, 6.28)
    L = random.uniform(90, 190)
    tone = random.randint(95, 150)
    for side in (-1, 1):
        pts = []
        for k in range(12):
            u = k / 11
            bend = math.sin(u * math.pi) * random.uniform(4, 10) * side
            px = x + math.cos(a) * L * u - math.sin(a) * bend
            py = y + math.sin(a) * L * u + math.cos(a) * bend
            pts.append((px, py))
        d.line(pts, fill=tone, width=3)
        d.line([(p[0] + 2, p[1] + 3) for p in pts], fill=10, width=2)


def seed(x, y):
    a = random.uniform(0, 180)
    rx, ry = random.uniform(9, 16), random.uniform(5, 9)
    s = Image.new("L", (64, 64), 0)
    sd = ImageDraw.Draw(s)
    sd.ellipse((32 - rx, 32 - ry, 32 + rx, 32 + ry), fill=255)
    s = s.rotate(a)
    tone = random.choice([60, 75, 140, 170])
    shade = Image.new("L", (64, 64), tone)
    img.paste(Image.new("L", (64, 64), 8), (int(x - 30), int(y - 29)), s)
    img.paste(shade, (int(x - 32), int(y - 32)), s)


for _ in range(60):
    a = random.uniform(0, 6.28)
    rr = random.uniform(R_MAP + 90, S * 0.75)
    needle(C + math.cos(a) * rr, C + math.sin(a) * rr)
for _ in range(70):
    a = random.uniform(0, 6.28)
    rr = random.uniform(R_MAP + 70, S * 0.72)
    seed(C + math.cos(a) * rr, C + math.sin(a) * rr)

# ---------------------------------------------------------------- doble círculo a spray
spray = np.zeros((S, S), np.float32)


def spray_ring(cx, cy, R, width, count):
    a = rng.uniform(0, 2 * math.pi, count)
    rr = R + rng.normal(0, width, count) * (1 + 0.15 * np.sin(a * 3))
    xs = (cx + np.cos(a) * rr).astype(int)
    ys = (cy + np.sin(a) * rr).astype(int)
    ok = (xs >= 0) & (xs < S) & (ys >= 0) & (ys < S)
    np.add.at(spray, (ys[ok], xs[ok]), 1)


spray_ring(C, C, 834, 4.5, 520_000)
spray_ring(C + 7, C - 6, 868, 5.5, 460_000)
spray_ring(C, C, 852, 24, 90_000)  # niebla del spray
spray_img = Image.fromarray(np.clip(spray * 46, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
sp = np.asarray(spray_img, np.float32) / 255

base = np.asarray(img, np.float32) / 255
out = base + (0.95 - base) * np.clip(sp * 1.25, 0, 1)

# ---------------------------------------------------------------- foto: viñeta, grano
yy, xx = np.mgrid[0:S, 0:S]
vig = 1 - 0.38 * (np.hypot(xx - C, yy - C) / (S * 0.72)) ** 2
out = out * vig + rng.normal(0, 0.022, (S, S))
Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8)).save(OUT, quality=86, optimize=True)
print("mapa provisional ->", OUT)
print("círculo: centro (0.5, 0.5), radio ~", round(854 / S, 4), "· paso de manzana", round(P / S, 5))
