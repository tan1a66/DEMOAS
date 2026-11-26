# Catalogo della Tienda: dalla pagina tienda-buenquerer del sito attuale (Wix) ai dati della demo.
#   python3 scripts/catalogo.py <products.json> <cartella foto originali> src/tienda src/productos.js
# products.json: la lista "productsWithMetaData" letta dalla pagina; foto da static.wixstatic.com.
import json, sys, os
from PIL import Image
d = json.load(open(sys.argv[1]))['products']
src, dst, out_js = sys.argv[2], sys.argv[3], sys.argv[4]
# (id, marca, nombre, sub, cat, [(talla, indice)], indice della foto)
C = [
 ('de-puff-eyes','Sepai','De-Puff Eyes','Contorno de ojos','sepai',[(None,0)],0),
 ('exo-glow','Sepai','Exo Glow','Sérum iluminador y tensor con exosomas','sepai',[('15 ml',1)],1),
 ('light-circles','Sepai','Light Circles','Sérum iluminador de ojos','sepai',[('15 ml',2)],2),
 ('egf-youth','Sepai','EGF Youth Molecule','Aceite de rescate multiuso','sepai',[(None,3)],3),
 ('lait-vip-o2','Biologique Recherche','Lait VIP O2','Leche limpiadora','limpieza',[('50 ml',6),('150 ml',5),('250 ml',4)],4),
 ('lait-ev','Biologique Recherche','Lait E.V.','Leche limpiadora','limpieza',[('150 ml',7),('250 ml',8)],8),
 ('lait-sr','Biologique Recherche','Lait S.R.','Leche limpiadora','limpieza',[('150 ml',10),('250 ml',9)],9),
 ('lait-dermo-s','Biologique Recherche','Lait Dermo-S','Leche limpiadora','limpieza',[('150 ml',12),('250 ml',11)],12),
 ('eau-micellaire','Biologique Recherche','Eau Micellaire Biosensible','Agua micelar','limpieza',[('250 ml',22)],22),
 ('eauxygenante',"Biologique Recherche","L'Eauxygénante",'Bruma oxigenante','limpieza',[('50 ml',23)],23),
 ('lotion-p50','Biologique Recherche','Lotion P50','Loción','lociones',[('50 ml',15),('150 ml',14),('250 ml',13)],13),
 ('lotion-p50v','Biologique Recherche','Lotion P50V','Loción','lociones',[('150 ml',17),('250 ml',16)],16),
 ('lotion-p50w','Biologique Recherche','Lotion P50W','Loción','lociones',[('150 ml',19),('250 ml',18)],18),
 ('lotion-p50-pigm','Biologique Recherche','Lotion P50 Pigm 400','Loción','lociones',[('150 ml',21),('250 ml',20)],20),
 ('serum-biosensible','Biologique Recherche','Sérum Biosensible','Sérum','serums',[('30 ml',24)],24),
 ('amniotique','Biologique Recherche','Sérum Amniotique','Sérum authentique','serums',[('8 ml',25)],25),
 ('iribiol','Biologique Recherche','Complexe Iribiol','Sérum authentique','serums',[('8 ml',26)],26),
 ('oligo-proteines','Biologique Recherche','Oligo-Protéines Marines','Sérum authentique','serums',[('8 ml',27)],27),
 ('dermopore','Biologique Recherche','Sérum Dermopore','Sérum authentique','serums',[('8 ml',28)],28),
 ('colostrum','Biologique Recherche','Colostrum VG','Sérum authentique','serums',[('8 ml',29)],29),
 ('iso-placenta-serum','Biologique Recherche','Iso-Placenta','Sérum authentique','serums',[('8 ml',30)],30),
 ('elastine-serum','Biologique Recherche','Élastine','Sérum authentique','serums',[('8 ml',31)],31),
 ('liposmose','Biologique Recherche','Liposmose','Sérum authentique','serums',[('8 ml',32)],32),
 ('tewl','Biologique Recherche','T.E.W.L.','Sérum authentique','serums',[('8 ml',33)],33),
 ('a-glyca','Biologique Recherche','A-Glyca','Sérum authentique','serums',[('8 ml',34)],34),
 ('collagene','Biologique Recherche','Collagène Originel','Sérum authentique','serums',[('8 ml',35)],35),
 ('vg-tensil','Biologique Recherche','VG Tensil','Sérum authentique','serums',[('8 ml',36)],36),
 ('yall-o2','Biologique Recherche','Yall-O₂','Sérum','serums',[('8 ml',37)],37),
 ('progeskin','Biologique Recherche','Progeskin','Sérum authentique','serums',[('8 ml',38)],38),
 ('extraits-tissulaires','Biologique Recherche','Extraits Tissulaires','Sérum authentique','serums',[('8 ml',39)],39),
 ('serum-pigm-400','Biologique Recherche','Sérum Pigm 400','Sérum','serums',[('8 ml',40),('30 ml',41)],41),
 ('matriciel-visage','Biologique Recherche','Sérum Matriciel Visage','Sérum','serums',[('30 ml',42)],42),
 ('matriciel-corps','Biologique Recherche','Sérum Matriciel Corps','Sérum corporal','serums',[('100 ml',43)],43),
 ('creme-dermopurifiante','Biologique Recherche','Crème Dermopurifiante','Crema','cremas',[('50 ml',44)],44),
 ('creme-verte-espoir','Biologique Recherche','Crème Verte Espoir A.R.','Crema','cremas',[('50 ml',45)],45),
 ('creme-iso-placenta','Biologique Recherche','Crème Iso-Placenta','Crema','cremas',[('50 ml',46)],46),
 ('creme-hydravits','Biologique Recherche',"Crème Hydravit's",'Crema','cremas',[('50 ml',47)],47),
 ('creme-vg-derm','Biologique Recherche','Crème VG Derm','Crema nutritiva','cremas',[('50 ml',48)],48),
 ('creme-elastine','Biologique Recherche','Crème Élastine','Crema','cremas',[('50 ml',49)],49),
]
used = set(); tot = 0; rows = []
for (pid, marca, nombre, sub, cat, vs, fi) in C:
    im = Image.open(os.path.join(src, d[fi]['img'])).convert('RGB')
    im.thumbnail((400, 400), Image.LANCZOS)
    p = os.path.join(dst, pid + '.webp'); im.save(p, 'WEBP', quality=78, method=6); tot += os.path.getsize(p)
    var = []
    for (talla, i) in vs:
        used.add(i)
        var.append({'talla': talla, 'precio': d[i]['price']})
    rows.append({'id': pid, 'marca': marca, 'nombre': nombre, 'sub': sub, 'cat': cat, 'variantes': var})
assert used == set(range(50)), sorted(set(range(50)) - used)
print(len(rows), 'prodotti,', tot // 1024, 'KB di foto')
js = '// Generato da scripts/catalogo (dati della tienda di www.buenquerer.com, novembre 2026):\n// prezzi IVA inclusa. Le taglie dello stesso prodotto sono raggruppate in una scheda.\nexport const PRODUCTOS = [\n'
for r in rows:
    js += '  ' + json.dumps(r, ensure_ascii=False) + ',\n'
js += '];\n'
open(out_js, 'w').write(js)
