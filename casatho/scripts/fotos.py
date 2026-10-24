# Recorta las flechas/puntos de los carruseles de Instagram y optimiza las fotos para el sitio.
# Uso: python3 -I scripts/fotos.py <carpeta_origen> public/fotos
import sys, os
from PIL import Image, ImageOps

src, dst = sys.argv[1], sys.argv[2]
# archivo origen -> (nombre destino, recorte izq, arriba, der, abajo en px)
FOTOS = {
    '8.jpg':  ('fachada.jpg',          0,  0,  0,  0),
    '2.jpg':  ('fachada-letrero.jpg',  0,  0, 70,  0),
    '9.jpg':  ('porton.jpg',           0,  0,  0,  0),
    '5.jpg':  ('patio-palmas.jpg',    60,  0, 60, 20),
    '6.jpg':  ('capitel.jpg',          0,  0,  0, 60),
    '7.jpg':  ('portal-mesas.jpg',     0,  0,  0,  0),
    '10.jpg': ('portal-tarde.jpg',    70,  0,  0, 40),
    '1.jpg':  ('puerta-boutique.jpg',  0,  0,  0, 40),
    '4.jpg':  ('portal-mecedora.jpg', 60,  0,  0, 40),
}
os.makedirs(dst, exist_ok=True)
for f, (name, l, t, r, b) in FOTOS.items():
    im = ImageOps.exif_transpose(Image.open(os.path.join(src, f))).convert('RGB')
    w, h = im.size
    im = im.crop((l, t, w - r, h - b))
    im.thumbnail((1100, 1100), Image.LANCZOS)
    out = os.path.join(dst, name)
    im.save(out, 'JPEG', quality=80, optimize=True, progressive=True)
    print(name, im.size, os.path.getsize(out) // 1024, 'KB')
