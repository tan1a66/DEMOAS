"""Ricompone un file binario da PNG prodotti da b2png.py (trasporto di file dalla sandbox Higgsfield).
uso: python3 tools/png2bytes.py out.bin part0.png part1.png ..."""
import sys, hashlib
from PIL import Image
out, parts = sys.argv[1], sys.argv[2:]
chunks = {}; total = None
for p in parts:
    b = Image.open(p).convert('RGB').tobytes()
    total = int.from_bytes(b[:8], 'big'); idx = int.from_bytes(b[8:12], 'big'); ln = int.from_bytes(b[12:16], 'big')
    chunks[idx] = b[16:16 + ln]
data = b''.join(chunks[i] for i in sorted(chunks))
assert len(data) == total, (len(data), total)
open(out, 'wb').write(data)
print('bytes', len(data), 'md5', hashlib.md5(data).hexdigest())
