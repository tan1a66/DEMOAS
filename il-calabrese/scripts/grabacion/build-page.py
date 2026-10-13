# Prepara la página para grabar: build de un solo archivo + cursor visible + cartel final.
#   python3 scripts/grabacion/build-page.py <salida.html>   (después de `npm run build:artifact`)
import os, sys
here = os.path.dirname(os.path.abspath(__file__))
body = open(os.path.join(here, '..', '..', 'dist-artifact', 'il-calabrese.html')).read()
extra='''<style>
.demo-note,.demo-chip{display:none!important}
#vcursor{position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 0 0 2px rgba(42,26,16,.55),0 6px 18px rgba(0,0,0,.45);z-index:99999;pointer-events:none;opacity:0;transition:opacity .35s ease, transform .15s ease}
#vcursor.on{opacity:1}
#vcursor.down{transform:scale(.78)}
.vripple{position:fixed;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:2px solid rgba(255,255,255,.95);z-index:99998;pointer-events:none;animation:vrip .6s ease-out forwards}
@keyframes vrip{from{transform:scale(.6);opacity:1}to{transform:scale(3.2);opacity:0}}
#vend{position:fixed;inset:0;z-index:99990;display:grid;place-items:center;text-align:center;background:radial-gradient(ellipse at center,rgba(20,10,5,.55),rgba(10,5,2,.92));opacity:0;transition:opacity 1s ease;pointer-events:none;color:#f7f0e3;font-family:"Playfair Display",Georgia,serif}
#vend.on{opacity:1}
#vend b{display:block;font-size:84px;line-height:1}
#vend b i{color:#c9a24a;font-weight:400}
#vend span{display:block;font-family:Manrope,system-ui,sans-serif;font-size:16px;letter-spacing:.24em;text-transform:uppercase;color:#cdbb9c;margin-top:18px}
#vend .fl{width:64px;height:6px;margin:0 auto 26px;border-radius:3px;background:linear-gradient(90deg,#1f8a4c 33%,#f4f1ea 33% 66%,#d0262b 66%)}
</style>
<div id="vcursor"></div>
<div id="vend"><div><div class="fl"></div><b><i>Il</i> Calabrese</b><span>Pizzería italiana · Mérida, Yucatán</span></div></div>
'''
html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>\n'+body+extra+'</body></html>'
open(sys.argv[1],'w').write(html)
