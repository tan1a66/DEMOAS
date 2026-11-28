# Empaqueta un .gltf (con .bin y texturas externas) en un único .glb, reduciendo las texturas.
# uso: python3 gltf2glb.py modelo.gltf salida.glb [lado_max_diff] [lado_max_resto]
import sys, json, struct, os, io
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
max_diff = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
max_other = int(sys.argv[4]) if len(sys.argv) > 4 else 512
base = os.path.dirname(src)
g = json.load(open(src))
binbuf = bytearray(open(os.path.join(base, g['buffers'][0]['uri']), 'rb').read())

def pad4(b):
    while len(b) % 4: b.append(0)

for img in g.get('images', []):
    uri = img.pop('uri')
    im = Image.open(os.path.join(base, uri))
    side = max_diff if '_diff' in uri else max_other
    if max(im.size) > side: im = im.resize((side, side), Image.LANCZOS)
    out = io.BytesIO()
    if im.mode == 'RGBA':
        im.save(out, 'PNG', optimize=True); mime = 'image/png'
    else:
        im.convert('RGB').save(out, 'JPEG', quality=80, optimize=True); mime = 'image/jpeg'
    data = out.getvalue()
    pad4(binbuf)
    g.setdefault('bufferViews', []).append({'buffer': 0, 'byteOffset': len(binbuf), 'byteLength': len(data)})
    binbuf.extend(data)
    img['bufferView'] = len(g['bufferViews']) - 1
    img['mimeType'] = mime
pad4(binbuf)
g['buffers'] = [{'byteLength': len(binbuf)}]
js = json.dumps(g, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
total = 12 + 8 + len(js) + 8 + len(binbuf)
with open(dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, total))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(binbuf), 0x004E4942)); f.write(binbuf)
print(dst, total)
