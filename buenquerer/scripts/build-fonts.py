# Caratteri di buenquerer (una volta sola; i file risultanti sono in src/fonts/).
#   python3 scripts/build-fonts.py <fraunces.woff2> <quicksand.woff2>
# Entrambi da Google Fonts (sottoinsieme "latin", OFL).
# - Quicksand (wght 300–700): il carattere del logo. Si copia così com'è (nome riservato
#   "Quicksand": niente modifiche).
# - Fraunces: al posto di Recoleta Alt, il carattere dei titoli del sito attuale (a pagamento,
#   licenza della cliente). Si fissa la versione morbida (SOFT 100, WONK 0) e si tiene solo il
#   peso 300–600 e l'asse delle dimensioni ottiche: pesa un terzo.
import shutil, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.subset import Subsetter, Options

fraunces, quicksand = sys.argv[1], sys.argv[2]
out = 'src/fonts/'
SPANISH = ''.join(chr(c) for c in range(0x20, 0x7F)) + 'áéíóúüñÁÉÍÓÚÜÑ¿¡«»·–—‘’“”…°ºª€@'

f = TTFont(fraunces)
f = instantiateVariableFont(f, {'SOFT': 100, 'WONK': 0, 'wght': (300, 600), 'opsz': (9, 144)})
opt = Options()
opt.flavor = 'woff2'
opt.layout_features = ['kern', 'liga', 'calt', 'lnum', 'pnum', 'tnum', 'case']
opt.name_IDs = ['*']
s = Subsetter(opt)
s.populate(text=SPANISH)
s.subset(f)
f.flavor = 'woff2'
f.save(out + 'fraunces-soft-latin.woff2')
shutil.copy(quicksand, out + 'quicksand-latin-wght.woff2')
print('ok')
