# Genera sprite di cumuli "volumetrici": densità 3D (sfere + rumore fBm), luce dal sole con ombra propria
# (trasmittanza cumulata dall'alto), integrazione lungo la vista. Esce PNG RGBA non premoltiplicato.
# uso: python3 make_clouds.py cartella_uscita
import sys, numpy as np
from PIL import Image
from scipy import ndimage

out = sys.argv[1]
X, Y, Z = 224, 128, 96

def vnoise(shape, cells, rng):
    g = rng.random(cells)
    return ndimage.zoom(g, [s / c for s, c in zip(shape, cells)], order=3, mode='wrap')[:shape[0], :shape[1], :shape[2]]

def cloud(seed, wide=1.0):
    rng = np.random.default_rng(seed)
    x = np.linspace(-1.75, 1.75, X)[:, None, None] * 1.0
    y = np.linspace(-0.55, 1.45, Y)[None, :, None]
    z = np.linspace(-1.0, 1.0, Z)[None, None, :]
    shape = np.full((X, Y, Z), -1.0, np.float32)
    # massa di base allungata e cupole che salgono
    blobs = [(0, 0.0, 0, 1.15 * wide, 0.45, 0.75)]
    n = rng.integers(5, 9)
    for i in range(n):
        bx = rng.uniform(-1.0, 1.0) * wide
        r = rng.uniform(0.38, 0.72) * (1.0 - 0.35 * abs(bx) / max(wide, 1e-3))
        by = rng.uniform(0.05, 0.45) + r * 0.6
        bz = rng.uniform(-0.35, 0.35)
        blobs.append((bx, by, bz, r, r, r * 0.9))
    for bx, by, bz, rx, ry, rz in blobs:
        d = np.sqrt(((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 + ((z - bz) / rz) ** 2)
        shape = np.maximum(shape, 1 - d)
    n1 = vnoise((X, Y, Z), (14, 8, 6), rng)
    n2 = vnoise((X, Y, Z), (36, 20, 16), rng)
    n3 = vnoise((X, Y, Z), (80, 46, 34), rng)
    noise = 0.55 * n1 + 0.3 * n2 + 0.15 * n3
    # il rumore erode i bordi della forma (non riempie il volume)
    dens = shape * 1.7 + 0.55 * (noise - 0.5)
    dens *= np.clip((shape + 0.03) / 0.1, 0, 1)
    base = np.clip((y + 0.38) / 0.16, 0, 1)            # base piatta, tipica del cumulo
    win = np.clip((1.72 - np.abs(x)) / 0.45, 0, 1) * np.clip((0.98 - np.abs(z)) / 0.2, 0, 1) * np.clip((1.42 - y) / 0.15, 0, 1)
    dens = np.clip(dens * 2.4, 0, 1) ** 1.2 * base * win
    # luce: sole alto e un po' a sinistra → trasmittanza cumulata dall'alto (con spostamento laterale)
    dy = 2.0 / Y
    lit = dens.copy()
    acc = np.zeros((X, Z), np.float32)
    Tl = np.zeros_like(dens)
    for j in range(Y - 1, -1, -1):
        Tl[:, j, :] = np.exp(-acc * 3.0)
        acc = np.roll(acc, -1, axis=0) * 0.5 + acc * 0.5 + dens[:, j, :] * dy * 2.4
    yy = np.broadcast_to(np.clip((y + 0.55) / 2.0, 0, 1), dens.shape)
    sun = np.array([1.0, 0.975, 0.94])
    amb_top, amb_bot = np.array([0.74, 0.8, 0.9]), np.array([0.5, 0.55, 0.66])
    # integrazione lungo z (davanti → dietro)
    T = np.ones((X, Y), np.float32)
    C = np.zeros((X, Y, 3), np.float32)
    dz = 2.0 / Z
    for k in range(Z):
        d = dens[:, :, k]
        a = 1 - np.exp(-d * dz * 26.0)
        tl = Tl[:, :, k][..., None]
        amb = amb_bot + (amb_top - amb_bot) * yy[:, :, k][..., None]
        # luce diretta + diffusione multipla (anche in ombra il cumulo resta chiaro, azzurrino)
        col = sun * (0.3 + 0.78 * tl ** 0.6) + amb * 0.5
        C += (T * a)[..., None] * col
        T *= 1 - a
    alpha = 1 - T
    rgb = np.where(alpha[..., None] > 1e-4, C / np.maximum(alpha[..., None], 1e-4), 1)
    rgb = rgb / max(1.0, float(np.percentile(rgb, 99.5)))
    img = np.concatenate([np.clip(rgb, 0, 1), alpha[..., None]], -1)
    img = np.transpose(img, (1, 0, 2))[::-1]          # y verso l'alto
    im = Image.fromarray((img * 255).astype(np.uint8), 'RGBA').resize((X * 2, Y * 2), Image.BICUBIC)
    return im

for i, (seed, wide) in enumerate([(3, 1.0), (11, 0.8), (23, 1.15), (41, 0.65), (57, 0.95), (71, 1.1)]):
    im = cloud(seed, wide)
    im.save(f'{out}/cumulus_{i}.png', optimize=True)
    print('cumulus', i, im.size)
