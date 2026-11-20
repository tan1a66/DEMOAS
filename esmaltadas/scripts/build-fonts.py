# Caratteri di ESMALTADAS (una volta sola; i file risultanti sono in src/fonts/).
#   python3 scripts/build-fonts.py <italiana-400.ttf|woff2>
# Italiana (Santiago Orozco, OFL) dal pacchetto npm @fontsource/italiana.
# "Esmaltadas Mark": solo le lettere del nome, con la A senza traverso come nel logo
# (è la V ruotata di 180°: l'asta sottile resta a sinistra, quella spessa a destra).
# (I titoli sono in Bellefair: @fontsource/bellefair, ridotto ai caratteri dello spagnolo.)
import sys
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen

src = sys.argv[1]
out = 'src/fonts/'
SPANISH = (
    ''.join(chr(c) for c in range(0x20, 0x7F))
    + 'áéíóúüñÁÉÍÓÚÜÑ¿¡«»·–—‘’“”…°ºª'
)


def subset(font, text, layout=True):
    opt = Options()
    opt.flavor = 'woff2'
    opt.layout_features = ['kern', 'liga'] if layout else []
    opt.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    s = Subsetter(opt)
    s.populate(text=text)
    s.subset(font)
    return font


# il marchio
f = TTFont(src)
cmap = f.getBestCmap()
gA, gV = cmap[ord('A')], cmap[ord('V')]
glyf, hmtx = f['glyf'], f['hmtx']
v = glyf[gV]
adv, _ = hmtx[gV]
# V: x 30..560, y -5..700 → ruotata attorno al centro: la punta sale a 705 (come la A), i
# piedi poggiano sulla linea di base
pen = TTGlyphPen(f.getGlyphSet())
f.getGlyphSet()[gV].draw(TransformPen(pen, (-1, 0, 0, -1, v.xMin + v.xMax, 700)))
glyf[gA] = pen.glyph()
glyf[gA].recalcBounds(glyf)
hmtx[gA] = (adv, glyf[gA].xMin)
for t in ('GPOS', 'kern'):  # nel marchio niente crenatura: le lettere sono spaziate a mano
    if t in f:
        del f[t]
for rec in f['name'].names:
    if rec.nameID in (1, 4, 16):
        rec.string = 'Esmaltadas Mark'
    if rec.nameID == 6:
        rec.string = 'EsmaltadasMark-Regular'
subset(f, 'ESMALTD ', layout=False)
f.flavor = 'woff2'
f.save(out + 'esmaltadas-mark.woff2')
print('ok')
