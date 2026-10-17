"""Prepara las fotos reales del restaurante para la experiencia 3D.

Para cada foto:
  1. quita el velo oscuro de las fotos publicadas (si el blanco más claro no llega a ~90 %);
  2. la guarda en WebP;
  3. calcula su mapa de profundidad con Depth Anything V2 (ONNX): disparidad (1/distancia)
     normalizada 0..1 en 12 bits, empaquetada en un PNG (R = byte alto, G = byte bajo), a un
     tercio de resolución. La web reconstruye con ella la geometría 3D de la sala.

Uso:
  pip install onnxruntime pillow numpy
  # modelo (Apache-2.0): https://github.com/fabio-sim/Depth-Anything-ONNX/releases
  python3 scripts/preparar-fotos.py --modelo depth_anything_v2_vitb.onnx \
      --salida public/assets/casa  entrada=foto10.jpg salon=foto04.jpg ...

"""
import argparse
import os

import numpy as np
from PIL import Image, ImageFilter

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


def quitar_velo(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32) / 255
    top = np.percentile(a.max(axis=2), 99.9)
    if top >= 0.9:
        return im.convert('RGB')
    x = a * (0.985 / top)
    k = 0.86  # compresión suave de las altas luces
    x = np.where(x > k, k + (1 - k) * (1 - np.exp(-(x - k) / (1 - k))), x)
    return Image.fromarray((np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8))


def profundidad(sess, im):
    name = sess.get_inputs()[0].name
    size = sess.get_inputs()[0].shape[-1] or 518

    def infer(img):
        x = np.asarray(img.resize((size, size), Image.BICUBIC), np.float32) / 255.0
        x = ((x - MEAN) / STD).transpose(2, 0, 1)[None]
        return sess.run(None, {name: x})[0][0]

    # Media con el espejo horizontal: menos ruido en los bordes.
    d = (infer(im) + infer(im.transpose(Image.FLIP_LEFT_RIGHT))[:, ::-1]) * 0.5
    lo, hi = np.percentile(d, 0.5), np.percentile(d, 99.5)
    d = np.clip((d - lo) / (hi - lo), 0, 1).astype(np.float32)
    w, h = im.size
    d = np.asarray(Image.fromarray(d, 'F').resize((w // 3, h // 3), Image.BICUBIC), np.float32)
    # Mediana 3×3: quita el ruido sin redondear las siluetas.
    d = np.asarray(Image.fromarray(d, 'F').filter(ImageFilter.MedianFilter(3)), np.float32)
    q = ((np.clip(d, 0, 1) * 4095 + 0.5).astype(np.uint32)) << 4  # 12 bits: comprime mucho mejor
    rgb = np.stack([(q >> 8) & 255, q & 255, np.zeros_like(q)], axis=-1).astype(np.uint8)
    return Image.fromarray(rgb, 'RGB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--modelo', required=True)
    ap.add_argument('--salida', required=True)
    ap.add_argument('--calidad', type=int, default=86)
    ap.add_argument('fotos', nargs='+')
    args = ap.parse_args()
    import onnxruntime as ort

    sess = ort.InferenceSession(args.modelo, providers=['CPUExecutionProvider'])
    os.makedirs(args.salida, exist_ok=True)
    for spec in args.fotos:
        nombre, ruta = spec.split('=', 1)
        im = quitar_velo(Image.open(ruta))
        im.save(os.path.join(args.salida, f'{nombre}.webp'), quality=args.calidad, method=6)
        profundidad(sess, im).save(os.path.join(args.salida, f'{nombre}-depth.png'), optimize=True)
        print(nombre, im.size)


if __name__ == '__main__':
    main()
