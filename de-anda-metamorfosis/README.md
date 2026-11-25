# Dr. Roberto de Anda — «Metamorfosis» (demo conceptual, Alessia Studio)

Scrollytelling 3D: una Venere di marmo in un tempio classico bianco affacciato sul mare
(archi con archivolti e chiavi di volta, colonne doriche scanalate, trabeazione, vasca
d'acqua che riflette, tende). Sempre al tramonto: il sole basso entra radente dagli archi.

La pagina è un'unica grande apertura che racconta (Mérida · La valoración · La precisión)
e arriva a un **indice**: *Quién soy* · *Procedimientos* · *Contacto*.
- **Quién soy**: presentazione con foto, formazione e certificazioni (UNAM, C.M.C.P.E.R.,
  A.M.C.P.E.R.), consulta a Mérida. Solo i dati che abbiamo, niente inventato.
- **Procedimientos**: solo le zone; il drone si ferma su ognuna scorrendo.
- **Contacto** e tutti gli altri pulsanti (Agendar, le singole zone…): *work in progress*.

I titoli dei capitoli giocano con la statua: le parole partono dietro di lei (lei le copre),
la attraversano con lo scroll e arrivano davanti, al loro posto. Epigrafe: Ovidio,
*Metamorfosi* («forme mutate in corpi nuovi»).

Stack: Vite + Three.js + GSAP ScrollTrigger + Lenis, three-mesh-bvh; una sola pagina,
build statica. Demo privata (`noindex`).

## Avvio in locale

```bash
cd de-anda-metamorfosis
npm install
npm run dev            # http://localhost:5173
```

| Parametro | Cosa fa |
| --- | --- |
| `?debug` | percorso del drone (oro), punti guardati (blu), sfere delle zone, fps. Tasto **O**: vista dall'alto |
| `?quality=mobile` / `?quality=desktop` | forza la versione leggera o quella completa |
| `?lang=en` | lingua iniziale |
| `?reduced` | simula `prefers-reduced-motion` (niente voli, solo dissolvenze) |
| `?noadapt` | spegne la qualità adattiva (per i test) |

## Pubblicazione

- **Netlify**: nuovo sito da Git con *Base directory* `de-anda-metamorfosis` (il resto è in `netlify.toml`).
  Senza Git: `npm run build` e trascina `dist/` su app.netlify.com/drop.
- **Vercel**: nuovo progetto con *Root Directory* `de-anda-metamorfosis` (impostazioni in `vercel.json`).

## Anteprima in un solo file HTML

```bash
npm run build:anteprima   # → anteprima/dr-de-anda-metamorfosis-anteprima.html
```

Un file con dentro codice, stili e modelli: si apre con doppio clic, senza server (serve
internet solo per i font). I modelli dell'anteprima sono compressi con meshopt invece che con
Draco. Se esiste `public/img/doctor.jpg`, la foto viene incorporata anche lei.

## Dove cambiare le cose

| File | Contenuto |
| --- | --- |
| `src/config.js` | **`DEMO_MODE`** (vedi sotto), **`WHATSAPP_NUMBER`** (vuoto = segnaposto), qualità desktop/mobile, levigatura, zone della statua, **tempi dei titoli che volano** (`TITLE_FLIGHTS`) |
| `src/three/titles3d.js` | i titoli 3D: parole ridisegnate dal titolo HTML, dietro/davanti alla statua leggendo la profondità della scena |
| `src/drone-path.js` | tappe del drone (anche le soste sulle zone nel capitolo 04), molle e inclinazione della camera, inquadratura nell'acqua (`DIVE`) e **atmosfere** (sole, cielo, mare, nebbia, tende, raggi, ombre d'ulivo) per ogni punto dello scroll |
| `src/three/temple.js` | l'architettura: piattaforma, vasca, piedistallo, muri con archi e decorazioni, colonne, tende (`CURTAINS`: il carattere di ognuna), cielo e mare |
| `src/three/post.js` | luce volumetrica (raggi calcolati dalle ombre del sole), profondità di campo, vista a pelo d'acqua |
| `src/i18n.js` | tutti i testi ES/EN (parole tra `*asterischi*` = corsivo azzurro) e messaggio WhatsApp |
| `src/styles.css` | palette, tipografia, altezze dei capitoli (= lunghezza dello scroll) |
| `index.html` | struttura dei testi; `data-window` = in quale parte del capitolo compare ogni testo |
| `public/img/doctor.jpg` | **foto del dottore** (da aggiungere: senza foto compare un segnaposto con il monogramma) |

**`DEMO_MODE = true`** (demo da mostrare): i pulsanti "Agendar", "Contacto" e le singole zone non aprono nulla. La camera
scende nella vasca e si ferma con l'obiettivo a pelo d'acqua, metà sopra e metà sotto; compare
"Work in progress · alessia.studio" e un tocco riporta al racconto. Con `false` i pulsanti aprono
WhatsApp con il messaggio nella lingua scelta.

Il caricamento iniziale mostra solo una linea e la percentuale.

**Simmetria**: l'architettura è simmetrica, le cose vive no. Ogni tenda ha il suo carattere
(una sola tenda legata nell'arco di sinistra, al centro una raccolta e una lasciata al vento,
a destra una legata più in alto e una lunga sul pavimento); le raffiche di vento arrivano da un
lato e passano all'altro. La camera ha il peso di una camera vera: molle che si posano con un
piccolo assestamento, oscillazione non periodica, leggera inclinazione nelle curve, soste di
durata diversa sulle zone del capitolo 04.

Il racconto si guida con lo scroll. Dall'indice (e da *Menú* in alto, che porta all'indice) si va
alle sezioni: se sono vicine si scorre fin lì, se sono lontane c'è una breve dissolvenza calda
(`data-goto` nell'HTML, `GOTO` in `main.js`). In *Procedimientos* il drone si ferma su viso,
collo, petto e vita (`{ zone: '…', hold }` in `drone-path.js`), la zona si illumina e a
sinistra cambia la descrizione.

Le tappe del drone si scrivono come angoli attorno a un punto guardato (`az`, `el`, `dist`),
con `shift` per spostare la statua sullo schermo e `mobile` per i valori da telefono.
Con `?debug` si vede il percorso; il tasto **O** passa alla vista libera.

## Il modello

Sorgente: la Venere fornita da Alessia Studio (Meshy), ~900k triangoli. Non è nel repository:
va messa in `models-src/venus.glb`, poi:

```bash
npm run models   # → public/models/venus-desktop.glb (~300k) e venus-mobile.glb (~120k)
```

Lo script (`scripts/optimize-model.mjs`, gltf-transform + meshoptimizer + three-mesh-bvh + Draco):
1. tiene solo la geometria (texture e UV non servono: il marmo è uno shader)
2. `weld`, pulizia, normalizzazione (base a y = 0, altezza 2, lei guarda verso +Z)
3. `simplify` con viso e mani più densi del resto
4. occlusione ambientale per vertice, calcolata con raggi sulla mesh originale
   (dà profondità alle pieghe del panneggio)
5. compressione Draco (desktop 0,57 MB, mobile 0,25 MB)

Nota: se il modello è stato generato con il piano gratuito di Meshy, verificare le
condizioni di licenza di Meshy prima di pubblicare il sito.

## La luce

- **Raggi volumetrici** (desktop): un passaggio a mezza risoluzione cammina lungo ogni raggio di
  vista e legge la mappa d'ombra del sole, quindi i raggi entrano davvero dagli archi e sono
  tagliati da colonne e statua; più forti guardando verso il sole. Intensità in `post.js`
  (`acc * 0.03`) e per capitolo con `beams` in `drone-path.js`.
- **Pulviscolo**: brilla solo dove arriva il sole (legge la stessa mappa d'ombra).
- **Telefono / iPhone**: niente calcolo volumetrico; raggi leggeri disegnati, pulviscolo semplice,
  modello da 120k triangoli, ombre e riflesso a risoluzione ridotta, risoluzione massima 1,5×.

## Prestazioni

- Desktop: modello 300k, riflesso dell'acqua a metà risoluzione, ombre del sole 2048 e del
  gobo d'ulivo 1024, raggi volumetrici, profondità di campo, risoluzione massima 1,5×.
- Telefono: modello 120k, riflesso a 0,3, ombre 1024/512, shader più leggeri.
- Le ombre si calcolano una volta per frame (non di nuovo nel riflesso dell'acqua).
- Qualità adattiva: sotto 48 fps per 2 secondi si spegne la profondità di campo, poi i raggi
  volumetrici (tornano quelli disegnati), poi si abbassa la risoluzione.
- `prefers-reduced-motion`: niente scroll morbido né voli; inquadrature fisse per capitolo
  cambiate con una dissolvenza.
