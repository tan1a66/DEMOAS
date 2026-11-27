# Ricalco del logo: campo di "inchiostro" sub-pixel -> contorni per tratto (lasso a mano).
import sys, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage import measure

src, outdir = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB').crop((180, 80, 320, 230))
a = np.asarray(im).astype(float)
bg = np.array([246, 240, 225.]); ink = np.array([72, 85, 49.])
axis = ink - bg
t = ((a - bg) @ axis) / (axis @ axis)          # 0 = crema, 1 = inchiostro
t = np.clip(t, -0.2, 1.2)
Z = 8
H, W = t.shape
# upsampling cubico del campo (spline di ordine 3)
yy, xx = np.mgrid[0:H*Z, 0:W*Z]
T = ndimage.map_coordinates(t, [(yy + 0.5) / Z - 0.5, (xx + 0.5) / Z - 0.5], order=3, mode='nearest')

L = {
 'punto':  [(520,60),(740,60),(740,260),(520,260)],
 'tallo':  [(580,300),(670,300),(668,700),(648,790),(642,880),(632,972),(562,990),(536,935),(552,850),(584,600)],
 'hoja1':  [(215,615),(300,605),(365,700),(425,820),(470,905),(482,992),(420,1002),(392,962),(328,832),(225,692)],
 'hoja2':  [(488,612),(572,612),(562,700),(550,830),(558,936),(552,1000),(532,1090),(436,1090),(432,1000),(452,928),(478,800),(492,690)],
 'hoja3':  [(768,585),(825,595),(818,652),(702,792),(674,880),(634,884),(636,772),(758,618)],
 'hoja4':  [(1000,755),(1012,800),(930,832),(780,882),(662,952),(604,988),(560,984),(558,922),(642,872),(780,808),(958,768)],
 'base':   [(118,978),(410,984),(470,994),(556,972),(620,958),(952,986),(952,1018),(620,1008),(532,1036),(420,1042),(300,1034),(118,1046)],
}
order = ['base','hoja1','hoja2','tallo','hoja3','hoja4','punto']

def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    ab = b - a; n = np.hypot(*ab) or 1e-9
    d = np.abs(ab[0]*(pts[:,1]-a[1]) - ab[1]*(pts[:,0]-a[0])) / n
    i = int(np.argmax(d))
    if d[i] > eps:
        return np.vstack([rdp(pts[:i+1], eps)[:-1], rdp(pts[i:], eps)])
    return np.vstack([a, b])

out = {}
over = Image.fromarray((np.clip(1 - T, 0, 1) * 255).astype(np.uint8)).convert('RGB')
dr = ImageDraw.Draw(over)
cols = {'punto':(220,0,0),'tallo':(0,140,255),'hoja1':(255,140,0),'hoja2':(160,0,200),'hoja3':(0,170,90),'hoja4':(200,160,0),'base':(255,0,160)}
for k in order:
    m = Image.new('L', (W*Z, H*Z), 0)
    ImageDraw.Draw(m).polygon(L[k], fill=255)
    M = np.asarray(m).astype(float) / 255
    F = np.pad(T * M, 2)
    cs = measure.find_contours(F, 0.5)
    cs = [c - 2 for c in cs]
    c = max(cs, key=len)                      # contorno principale
    pts = c[:, ::-1] / Z                      # (x,y) in px del ritaglio
    far = int(np.argmax(np.hypot(*(pts - pts[0]).T)))
    pts = np.vstack([rdp(pts[:far+1], 0.035)[:-1], rdp(np.vstack([pts[far:], pts[:1]]), 0.035)[:-1]])
    # orientamento coerente (antiorario in coordinate SVG)
    area = 0.5 * np.sum(pts[:,0]*np.roll(pts[:,1],-1) - np.roll(pts[:,0],-1)*pts[:,1])
    if area < 0: pts = pts[::-1]
    out[k] = pts
    dr.polygon(L[k], outline=cols[k])
    dr.line([tuple(p*Z) for p in np.vstack([pts, pts[:1]])], fill=cols[k], width=2)
    print(k, len(pts), 'pts', 'contours', len(cs))
over.save(outdir + '/trace_check.png')

allp = np.vstack(list(out.values()))
x0, y0 = allp.min(0); x1, y1 = allp.max(0)
pad = 0.5
x0 -= pad; y0 -= pad; x1 += pad; y1 += pad
S = 1000 / (y1 - y0)                          # altezza = 1000 unità
paths = {}
for k in order:
    p = (out[k] - [x0, y0]) * S
    d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in p) + ' Z'
    paths[k] = d
vb = [0, 0, round((x1 - x0) * S, 1), 1000]
json.dump({'viewBox': vb, 'order': order, 'paths': paths}, open(outdir + '/logo_paths.json', 'w'))
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb[2]} {vb[3]}" width="{vb[2]/4}" height="250">' + \
      ''.join(f'<path id="{k}" d="{paths[k]}" fill="#485531"/>' for k in order) + '</svg>'
open(outdir + '/logo.svg', 'w').write(svg)
print('viewBox', vb)
