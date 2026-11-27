# Reduce un .hdr (RGBE, con o sin RLE) a la mitad de resolución y lo guarda sin comprimir.
# uso: python3 hdr_half.py entrada.hdr salida.hdr
import sys
import numpy as np

def read_hdr(path):
    data = open(path, 'rb').read()
    i = 0
    while True:
        j = data.index(b'\n', i)
        line = data[i:j]; i = j + 1
        if line.startswith(b'-Y') or line.startswith(b'+Y'):
            parts = line.split(); H = int(parts[1]); W = int(parts[3]); break
    img = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        if data[i] == 2 and data[i + 1] == 2 and W >= 8:
            i += 4
            for c in range(4):
                x = 0
                while x < W:
                    n = data[i]; i += 1
                    if n > 128:
                        n -= 128; img[y, x:x + n, c] = data[i]; i += 1
                    else:
                        img[y, x:x + n, c] = np.frombuffer(data[i:i + n], np.uint8); i += n
                    x += n
        else:
            img[y] = np.frombuffer(data[i:i + W * 4], np.uint8).reshape(W, 4); i += W * 4
    e = img[..., 3].astype(np.int32)
    f = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)
    return img[..., :3].astype(np.float64) * f[..., None]

def write_hdr(path, rgb):
    H, W, _ = rgb.shape
    m = rgb.max(axis=2)
    mant, ex = np.frexp(m)
    scale = np.where(m > 1e-32, mant * 256.0 / np.maximum(m, 1e-32), 0)
    out = np.zeros((H, W, 4), np.uint8)
    out[..., :3] = np.clip(rgb * scale[..., None], 0, 255).astype(np.uint8)
    out[..., 3] = np.where(m > 1e-32, ex + 128, 0).astype(np.uint8)
    with open(path, 'wb') as fh:
        fh.write(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n')
        fh.write(f'-Y {H} +X {W}\n'.encode())
        fh.write(out.tobytes())

src = read_hdr(sys.argv[1])
H, W, _ = src.shape
half = src.reshape(H // 2, 2, W // 2, 2, 3).mean(axis=(1, 3))
# el sol se dibuja aparte (luz direccional con sombras): lo quitamos del cielo
lim = float(sys.argv[3]) if len(sys.argv) > 3 else 1e9
lum = half.max(axis=2, keepdims=True)
half = np.where(lum > lim, half / lum * lim, half)
write_hdr(sys.argv[2], half)
print('ok', src.shape, '->', half.shape, float(src.max()), float(half.max()))
