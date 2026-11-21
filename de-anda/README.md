# Dr. Roberto de Anda — demo conceptual (Alessia Studio)

Scrollytelling 3D: il chirurgo come scultore. Un blocco di marmo grezzo viene scolpito
dall'esterno verso l'interno mentre si scorre, finché resta una giovane donna seduta su
un blocco di pietra grezza. La statua finita diventa interattiva (zone dei procedimenti).

Stack: Vite + Three.js + GSAP ScrollTrigger + Lenis, three-mesh-bvh; una sola pagina,
build statica. Demo privata (`noindex`): non è il sito ufficiale del dottore.

## Avvio in locale

```bash
cd de-anda
npm install
npm run dev            # http://localhost:5173
```

Parametri utili nell'indirizzo:

| Parametro | Cosa fa |
| --- | --- |
| `?debug` | percorso del drone (oro), punti guardati (blu), sfere delle zone, fps. Tasto **O**: vista dall'alto libera |
| `?quality=mobile` / `?quality=desktop` | forza la versione leggera o quella completa |
| `?lang=en` | lingua iniziale |
| `?reduced` | simula `prefers-reduced-motion` (niente voli, solo dissolvenze) |
| `?noadapt` | spegne la qualità adattiva (per i test) |

## Pubblicazione (sito statico)

```bash
npm run build          # crea dist/
npm run preview        # controllo locale della build
```

- **Netlify**: nuovo sito da Git e *Base directory* `de-anda`: il resto (build, cartella `dist`,
  cache dei modelli, `noindex`) è già in `netlify.toml`. Senza Git: `npm run build` e trascina la
  cartella `dist/` su app.netlify.com/drop.
- **Vercel**: nuovo progetto con *Root Directory* `de-anda`; impostazioni già in `vercel.json`.
  Da terminale: `npx vercel --cwd de-anda`.

## Dove cambiare le cose

| File | Contenuto |
| --- | --- |
| `src/config.js` | **`WHATSAPP_NUMBER`** (vuoto = segnaposto), qualità desktop/mobile, tempi dello scolpire, zone interattive |
| `src/drone-path.js` | tappe del drone (posizione, punto guardato, inquadratura per telefono) e luci per ogni punto dello scroll |
| `src/i18n.js` | tutti i testi ES/EN (le parole tra `*asterischi*` diventano corsivo oro) e il messaggio WhatsApp |
| `src/styles.css` | palette, tipografia, altezze dei capitoli (= lunghezza dello scroll) |
| `index.html` | struttura dei testi; `data-window` = in quale parte del capitolo compare ogni testo |
| `public/img/doctor.jpg` | **foto del dottore** (da aggiungere: senza foto compare un segnaposto con il monogramma) |

### Il percorso del drone

Ogni tappa in `PATH` (`src/drone-path.js`) ha:

- `at`: punto dello scroll, `'capitolo:avanzamento'` (es. `'precision:0.5'` = metà di "02 · La precisión")
- `target`: il punto guardato; `az` / `el` / `dist`: gradi attorno alla statua, elevazione, distanza
- `shift`: sposta la statua sullo schermo (`[0.25, 0]` = a destra, lascia spazio al testo)
- `dof`: profondità di campo (solo primi piani), `mobile`: valori diversi per lo schermo verticale

Con `?debug` si vede il percorso; il tasto **O** passa alla vista libera per guardarlo da fuori.

### Le zone (04 · Procedimientos)

In `ZONES` (`src/config.js`): `center` è in coordinate relative al bounding box del modello
(0..1 su x, y, z; lei guarda verso +z), `radius` in frazioni dell'altezza, `cam` è
l'inquadratura del drone sulla zona. Con `?debug` si vedono le sfere e il punto cliccabile.

## Il modello 3D

Sorgente: "statue of a young woman" di **lubenko** (Sketchfab, CC-BY 4.0), circa 1,5 milioni
di triangoli. Il credito è nel footer. La scansione originale (71 MB) **non** è nel repository:
va messa in `models-src/statue.glb`, poi:

```bash
npm run models         # → public/models/statue-desktop.glb (~300k) e statue-mobile.glb (~120k)
```

Lo script (`scripts/optimize-model.mjs`, gltf-transform + meshoptimizer + Draco):

1. unisce i 17 pezzi e scarta texture, UV e colori (il marmo è uno shader)
2. `weld`, poi ruota e centra la statua (lei guarda verso +Z)
3. taglia con un piano sotto il sedile, toglie i blocchi del basamento ai lati, il terreno e i
   frammenti scollegati della scansione; allunga di poco la base del sedile fino a terra
4. normalizza: pavimento a y = 0, altezza 2
5. `simplify` in più passate: sedile più leggero, viso e mani più densi del resto
6. separa figura e sedile e comprime con Draco (desktop 0,5 MB, mobile 0,2 MB)

Le misure del sedile (pareti e piano della seduta) sono ricavate dai dati e salvate nel GLB
(`extras`), il sito le legge da lì.

## Come funziona lo scolpire

- `src/three/fragments.js`: qualche migliaio di frammenti irregolari (instancing) riempiono il
  volume attorno alla figura. three-mesh-bvh misura la distanza di ognuno dalla superficie della
  figura: cadono prima i più lontani. La caduta (rotazione, piccolo salto, discesa, dissolvenza)
  è calcolata nello shader solo dall'avanzamento dello scroll, quindi tornando su si ricompone.
- `src/three/dust.js`: polvere dove i frammenti si staccano e dove cadono, pulviscolo nella luce.
- `src/three/materials.js` + `glsl.js`: marmo procedurale (rumore 3D in object space: le venature
  del blocco continuano sulla statua), segni di scalpello che spariscono con la levigatura,
  bagliore dorato delle zone, controluce caldo. Il sedile resta sempre grezzo.
- `src/three/post.js`: profondità di campo leggera solo nei primi piani.

## Note sul modello

- La scansione viene da una statua di fontana: il viso è consumato dal tempo (nell'originale ha
  circa 12.000 triangoli, la versione desktop li conserva quasi tutti). Per questo il "primo piano"
  dello slogan è testa e spalle, con luce che modella, e non un dettaglio stretto del viso.
- Nel capitolo 01 una dozzina di frammenti "eroi" vola accanto alla camera: la loro traiettoria
  è calcolata dal percorso del drone, quindi segue da sola eventuali modifiche a `drone-path.js`.

## Prestazioni

- Desktop: modello 300k, ~3.900 frammenti (grandi lontano dalla figura, piccoli vicino), ombre 2048,
  profondità di campo, risoluzione massima 1,5×.
- Telefono: modello 120k, ~1.700 frammenti, ombre 1024, shader più leggeri (meno ottave di rumore).
- Qualità adattiva: sotto 48 fps per 2 secondi si spegne la profondità di campo, poi si
  abbassa la risoluzione.
- `prefers-reduced-motion`: niente scroll morbido né voli; inquadrature fisse per capitolo
  cambiate con una dissolvenza.
