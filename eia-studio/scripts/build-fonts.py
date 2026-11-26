# Caratteri di ÉIA STUDIO (una volta sola; i file risultanti sono in src/fonts/).
#   python3 scripts/build-fonts.py <cartella files/ di @fontsource-variable/bodoni-moda>
# Bodoni Moda (Owen Earl / indestructible type*, OFL): marchio e titoli. Variabile, con gli assi
# peso (400–900) e grandezza ottica (6–96): grande, i filetti diventano sottilissimi, da rivista.
# Ridotto ai caratteri dello spagnolo. (Testi, menu e bottoni: gli stessi file della demo
# Esmaltadas: Cormorant Garamond, Archivo largo, Manrope.)
import sys
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

src = sys.argv[1].rstrip('/') + '/'
out = 'src/fonts/'
SPANISH = (
    ''.join(chr(c) for c in range(0x20, 0x7F))
    + 'áéíóúüñÁÉÍÓÚÜÑ¿¡«»·–—‘’“”…°ºª€'
)

for style in ('normal', 'italic'):
    f = TTFont(src + f'bodoni-moda-latin-standard-{style}.woff2')
    opt = Options()
    opt.flavor = 'woff2'
    opt.layout_features = ['kern', 'liga', 'lnum', 'pnum']
    opt.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    s = Subsetter(opt)
    s.populate(text=SPANISH)
    s.subset(f)
    f.flavor = 'woff2'
    f.save(out + f'bodoni-moda-{style}.woff2')
print('ok')
