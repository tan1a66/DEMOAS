# Avv. Roberto Pusceddu — «Caratteri mobili»

Sito personale dell'Avv. Roberto Pusceddu, Foro di Cagliari. Concept: la tipografia a piombo.
Astro + TypeScript, contenuti in HTML statico.

```bash
cd pusceddu
npm install
npm run dev       # http://localhost:4321
npm run build     # controllo dei tipi + build statica in dist/ (a fine build elenca i dati mancanti)
npm run preview   # serve dist/
```

Serve Node ≥ 22.22 (richiesto da Astro 7).

## Dove si modificano i contenuti

Tutto in **`src/content/site.ts`**: frase di apertura, bio, formazione, ambiti, pubblicazioni, sedi, contatti.
I valori `null` sono «da fornire»: il sito mostra un segnaposto rosso tratteggiato e `npm run build` li elenca.

- Copertine: in `public/images/copertine/`, poi il percorso in `pubblicazioni[].copertina`.
- Audio di «La Costituzione all'ascolto»: in `public/audio/`, poi il percorso in `audio.src`.
- Dominio: `dominio` in `site.ts`. Senza dominio non si generano canonical, `og:url`, URL assoluto dell'immagine Open Graph e sitemap.

## Struttura

| Percorso | Cosa |
| --- | --- |
| `src/pages/index.astro` | Home: sezioni 0-5 e indice delle sezioni |
| `src/pages/assistenza-riservata.astro` | Pagina per donne vittime di violenza (regole sotto) |
| `src/pages/privacy.astro`, `cookie.astro` | Informative (la privacy è una bozza da completare) |
| `src/components/sezioni/` | Apertura, Chi sono, Ambiti, Formazione, Pubblicazioni, Contatti |
| `src/components/Compositoio.astro` | Righe di caratteri di piombo **a specchio** (decorative, `aria-hidden`) |
| `src/components/Fregio.astro` | Fregi tipografici SVG al posto delle icone |
| `src/styles/global.css` | Palette, tipografia, carta, focus |
| `scripts/texture.py` | Rigenera le texture ripetibili (carta con fibra, legno) |

## Regole rispettate

**Deontologia.** Solo i dati forniti; niente superlativi, promesse, percentuali, confronti.
Footer con Ordine degli Avvocati di Cagliari, P.IVA, PEC, privacy e cookie policy.

**Assistenza riservata.** Nessun 3D, animazione, suono, popup, banner, analytics, cookie o storage.
Unico script: l'uscita rapida (pulsante fisso o Esc premuto due volte → `location.replace('https://www.google.it')`,
la pagina non resta nel tasto Indietro). È il primo elemento raggiungibile con Tab.
In alto 1522 e 112, poi il contatto dello studio, poi come cancellare la cronologia.
In `netlify.toml`: `Referrer-Policy: no-referrer` e `Cache-Control: no-store` su questa pagina.

**Accessibilità.** `lang="it"`, un solo `h1`, focus visibile, target ≥ 44 px, testo accessibile anche
dove il testo visivo è a specchio o spezzato. axe-core: 0 violazioni (WCAG 2.2 AA) su tutte le pagine.

Contrasti della palette:

| Testo | Fondo | Rapporto |
| --- | --- | --- |
| grigio `#4A4A47` | avorio `#F3EDE1` | 7,6:1 |
| nero `#141414` | avorio | 15,8:1 |
| rosso `#B3261E` | avorio | 5,6:1 |
| rosso | carta vecchia `#E8E0CF` | 5,0:1 |
| avorio tenue `#CDC6B8` | nero | 10,8:1 |
| avorio | rosso («Esci subito») | 5,6:1 |

Il piombo `#5E6166` sul nero (3:1) è usato solo per filetti e fregi, mai per il testo.

**Font.** Bodoni Moda (asse `opsz`) e IBM Plex Sans, self-hosted tramite l'API Fonts di Astro:
`font-display: swap`, preload dei soli tondi latini, fallback con metriche corrette (niente salti di layout).

## Deploy

Netlify: base directory `pusceddu` (legge `netlify.toml`). Vercel: root directory `pusceddu`, preset Astro.

## Stato

- [x] **Fase 1** — Astro, pagine, contenuti in HTML statico, tipografia e palette, pagina Assistenza riservata completa
- [ ] Fase 2 — Scena 3D dell'apertura (lettere a specchio, composizione, fallback, reduced motion)
- [ ] Fase 3 — Animazioni delle sezioni 1-5
- [ ] Fase 4 — Ottimizzazione e misure Lighthouse
