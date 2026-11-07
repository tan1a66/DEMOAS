# ginecologiacagliari.com — sito del Dott. Konstantinos Martsidis

Uroginecologia, ginecologia e ostetricia a Cagliari. Sito statico realizzato da Alessia Studio.

- **Astro 7** + TypeScript, nessun framework UI. CSS moderno con custom properties (design token in `src/styles/tokens.css`).
- **Three.js** solo dove serve, caricato on demand: forma dell'hero e modello interattivo del pavimento pelvico.
- **Nessun modulo, nessun cookie, nessuna risorsa di terze parti al caricamento**: si prenota solo con WhatsApp o telefono.
- Testi delle pagine in **Content Collections** (Markdown con frontmatter tipizzato).

> Prima della pubblicazione: completare e far approvare tutto ciò che è in **[CONTENUTI-DA-VERIFICARE.md](./CONTENUTI-DA-VERIFICARE.md)**.

---

## Indice

1. [Avviare e fare la build](#1-avviare-e-fare-la-build)
2. [Struttura del progetto](#2-struttura-del-progetto)
3. [Modificare testi, orari e dati dello studio](#3-modificare-testi-orari-e-dati-dello-studio)
4. [Dove vanno le foto](#4-dove-vanno-le-foto)
5. [Sostituire il modello 3D](#5-sostituire-il-modello-3d)
6. [Pubblicare](#6-pubblicare)
7. [Attivare le statistiche](#7-attivare-le-statistiche)
8. [Aggiungere l'inglese](#8-aggiungere-linglese)
9. [Prestazioni, accessibilità e come misurarle](#9-prestazioni-accessibilità-e-come-misurarle)
10. [Regole sui contenuti sanitari](#10-regole-sui-contenuti-sanitari)

---

## 1. Avviare e fare la build

Serve **Node.js 22.23.4 o successivo** (Astro 7 lo richiede). La versione è indicata in `.node-version`.

```bash
cd martsidis
npm install
npm run dev        # sito in sviluppo su http://localhost:4321
npm run build      # sito pronto in dist/
npm run preview    # anteprima della build
npm run check      # controllo dei tipi TypeScript/Astro
npm run build:anteprima   # anteprima in UN file HTML: anteprima/ginecologiacagliari-anteprima.html
```

L'**anteprima in un file** si apre con doppio clic, senza server, e si può mandare al cliente. Contiene tutte le pagine (navigazione con `#/pagina/`), i font, le immagini e il 3D. Serve solo per far vedere il sito: non va pubblicata.

A fine build compare un **promemoria dei segnaposti** ancora da compilare (orari, foto…) e il numero di note `[DA VERIFICARE]` nel codice. Non blocca la build.

Se un testo di una pagina di condizione non rispetta lo schema obbligatorio (vedi sotto), **la build si ferma** con un messaggio che dice cosa manca.

Per misurare le prestazioni **senza 3D** basta aggiungere `?no3d` all'indirizzo (es. `http://localhost:4321/?no3d`).

## 2. Struttura del progetto

```
martsidis/
├─ astro.config.mjs        dominio, font, CSP, sitemap, variabili d'ambiente
├─ netlify.toml            configurazione Netlify
├─ wrangler.jsonc          configurazione Cloudflare (Workers), facoltativa
├─ CONTENUTI-DA-VERIFICARE.md
├─ public/
│  ├─ _redirects           redirect 301 dai vecchi URL (Netlify e Cloudflare)
│  ├─ _headers             intestazioni di sicurezza e cache
│  ├─ favicon.svg/.ico, apple-touch-icon.png
│  ├─ og/default.jpg       anteprima per social e WhatsApp
│  └─ models/              (facoltativo) pelvi.glb
├─ scripts/                genera-icone, genera-mappa, genera-og
└─ src/
   ├─ config.ts            interruttori tecnici (3D su mobile, modello .glb, DPR)
   ├─ data/
   │  ├─ sito.ts           telefono, WhatsApp, indirizzo, ORARI, P.IVA, Ordine, link Google
   │  ├─ medico.ts         curriculum (formazione, incarichi, pubblicazioni, corsi)
   │  └─ recensioni.ts     recensioni reali e autorizzate (vuoto = solo link a Google)
   ├─ i18n/                testi dell'interfaccia e voci del menu
   ├─ content/
   │  ├─ condizioni/       5 pagine /uroginecologia/<nome>/
   │  └─ pagine/           servizi, prima visita, laser, privacy, cookie…
   ├─ content.config.ts    schema dei campi (frontmatter) di ogni pagina
   ├─ assets/foto/         FOTO (vedi sezione 4)
   ├─ assets/mappa/        mappa statica dello studio (da OpenStreetMap)
   ├─ components/          Button, Card, Section, FAQ, CTA, StickyContactBar, Header, Footer…
   ├─ layouts/             Base (head, SEO, JSON-LD), Contenuto (pagine informative)
   ├─ pages/               una pagina per ogni indirizzo del sito
   ├─ styles/              tokens.css (colori, font, spazi), base.css, prose.css
   └─ three/               3D: shared/ (stage, palette), hero/, pelvi/
```

Pagine del menu (nell'ordine del vecchio sito): **Home · Prenota una visita · Servizi · Laser · Lo Studio · Curriculum Vitae · Contatti**. Le voci sono in `src/i18n/it.ts` (`menuIt`).

## 3. Modificare testi, orari e dati dello studio

### Orari, telefono, indirizzo, P.IVA, email
Tutto in **`src/data/sito.ts`**: si cambia lì e si aggiorna in tutto il sito (header, footer, contatti, barra mobile, dati strutturati per Google).

Orari, esempio:

```ts
orari: [
  { giorni: 'Lunedì e Mercoledì', orario: '15:30 – 19:30' },
  { giorni: 'Venerdì', orario: '9:00 – 13:00' },
],
```

Oggi la lista è **vuota per scelta dello studio**: si vede solo "Si riceve su appuntamento". Se in futuro si compila, gli orari compaiono in footer, contatti e prenotazione, e anche nei dati strutturati di Google (`openingHoursSpecification`).

Il messaggio WhatsApp precompilato (`whatsapp.messaggio`) deve restare **neutro**, senza riferimenti a sintomi (privacy).

### Curriculum
`src/data/medico.ts`: formazione, incarichi, società, premi, pubblicazioni, atti, corsi. Ogni voce è un oggetto: basta copiarne uno e cambiarne il testo.

### Pagine di condizione (`src/content/condizioni/*.md`)
In alto, tra i `---`, ci sono i campi (titolo, descrizione per Google, frase della card in home, FAQ, pagine collegate…). Sotto c'è il testo in Markdown, che **deve** avere questi titoli `##`, in quest'ordine:

```
## Non è un problema raro
## Sintomi
## Cause in breve
## Come si arriva alla diagnosi
## Le possibilità di trattamento
```

FAQ e invito al contatto li aggiunge il layout. Gli elenchi puntati (`- `) diventano punti con il pallino salvia; quelli numerati (`1. `) diventano "passi". Usarli per diagnosi e trattamenti, **dal più conservativo al più invasivo**.

Per aggiungere una condizione basta un nuovo file `.md` nella stessa cartella (es. `cistiti-ricorrenti.md`). Viene creata `/uroginecologia/cistiti-ricorrenti/` e la card compare anche in home e nella pagina Uroginecologia.

### Pagine di servizio (`src/content/pagine/*.md`)
Stesso principio, con testo libero. Campi utili:
- `card`: se presente, la pagina compare in `/servizi/` (con `ordine`);
- `inEvidenza`: riquadro verde con l'elenco in evidenza (es. "Cosa portare");
- `foto`: nome della foto in `src/assets/foto/`;
- `statoModello`: aggiunge il link al modello 3D in quello stato (`normale`, `incontinenza`, `prolasso`, `riabilitazione`);
- `faq`: domande e risposte (diventano anche dati strutturati `FAQPage`).

Un nuovo file `pagine/nome.md` crea la pagina `/nome/`.

### Note per chi scrive
Le righe che iniziano con `#` nel frontmatter sono **commenti interni**: non compaiono sul sito. Si usano per le note `[DA VERIFICARE]`.

### Recensioni
`src/data/recensioni.ts`: solo recensioni reali, già pubblicate, con consenso scritto (`autorizzata: true`), nome abbreviato e data. Ne vengono mostrate al massimo 3.

### Colori e caratteri
`src/styles/tokens.css`. Il 3D legge gli stessi colori. Ogni coppia testo/sfondo usata rispetta WCAG AA: se si cambia un colore, ricontrollare il contrasto (≥ 4.5:1 per il testo).

## 4. Dove vanno le foto

Copiare le foto in **`src/assets/foto/`** con questi nomi (formato `.jpg`, `.png` o `.webp`):

| File | Cosa | Formato consigliato |
| --- | --- | --- |
| `ritratto.jpg` | Ritratto del Dott. Martsidis (home e curriculum) | verticale 4:5, almeno 1200 px di altezza |
| `studio-1.jpg` | Sala d'attesa | orizzontale 4:3, almeno 1600 px |
| `studio-2.jpg` | Ambulatorio | orizzontale 4:3 |
| `ecografo.jpg` | Ecografo Samsung HM70A Plus | orizzontale 4:3 |
| `nutrizionista.jpg` | Dott.ssa Manuela Frau | orizzontale 4:3 o verticale |

Vengono trovate da sole e ottimizzate in AVIF/WebP alle dimensioni giuste. Finché un file manca resta un segnaposto ben visibile. **Niente foto stock di corpi**: solo foto reali.

Script di servizio (da rilanciare solo se serve):

```bash
node scripts/genera-icone.mjs                  # favicon.ico e apple-touch-icon da public/favicon.svg
node scripts/genera-mappa.mjs 39.2229 9.1062   # mappa statica da OpenStreetMap (lat lon)
node scripts/genera-og.cjs                     # immagine social (richiede Playwright)
```

## 5. Il modello 3D e l'esperienza della Home

- **Modello anatomico**: `public/models/pelvi.glb`, generato da codice con `npm run modello` (script in `scripts/modello/`: forme SDF → mesh → GLB quantizzato e compresso con Meshopt, ~300 kB). Nodi: `bacino`, `pavimento` (morph target `cedimento`, `iato`, `tensione`), `vescica` (con ureteri), `utero` (con tube e ovaie), `vagina`, `retto` (con sigma). Si può sostituire con un `.glb` fatto in Blender che usi gli stessi nomi.
- **Esperienza in Home** (`src/components/Esperienza.astro` + `src/three/esperienza/scena.ts`): la palla iniziale diventa l'utero e, scorrendo, gli organi si compongono attorno; poi l'**anello delle problematiche** gira attorno al modello (scroll, clic sulle voci, deep link `/#prolasso`), il modello mostra lo stato e si può ruotare trascinando.
- **Testi e stati** dell'anello: `src/three/pelvi/stati.ts` (`PROBLEMATICHE` e `PARAMETRI`).
- Il 3D parte solo alla prima interazione o dopo qualche secondo; senza WebGL, con "riduci movimento" o con `?no3d` si vede la versione statica (elenco leggibile).
- Controllo visivo del modello: `npx serve .` e aprire `/scripts/modello/visualizza.html?az=0.9&el=0.3`.

## 6. Pubblicare

Il sito è nella sottocartella **`martsidis/`** del repository. Le configurazioni per i due host sono già pronte: `_redirects` e `_headers` in `public/` funzionano su entrambi.

### Consigliato: Cloudflare Pages
Banda illimitata nel piano gratuito e rete veloce in Italia.
1. Cloudflare → Workers & Pages → Create → Pages → collega il repository.
2. **Root directory**: `martsidis` · **Build command**: `npm run build` · **Output**: `dist`.
3. Variabile d'ambiente `NODE_VERSION` = `22` (se la build lamenta la versione di Node: `22.23.4` o successiva).
4. Custom domain: `www.ginecologiacagliari.com`, più un redirect da `ginecologiacagliari.com` a `www`.

In alternativa, con Workers: `npm run build && npx wrangler deploy` (usa `wrangler.jsonc`).

### Netlify
1. Add new site → Import from Git → repository.
2. **Base directory**: `martsidis` (build e publish sono letti da `netlify.toml`).
3. Domain management → `www.ginecologiacagliari.com` come dominio principale.

### Prima di andare online
- [ ] `CONTENUTI-DA-VERIFICARE.md` approvato dal medico, segnaposti compilati (la build li elenca).
- [ ] Dominio definitivo in `astro.config.mjs` (`SITE`): con o senza *www*, uguale a quello principale sull'host.
- [ ] `public/_redirects` completato con i **vecchi URL reali** (Google Search Console).
- [ ] Dopo il passaggio: inviare la sitemap (`/sitemap-index.xml`) in Google Search Console e aggiornare il sito web nella scheda Google Business Profile.
- [ ] Verifica rapida da telefono: WhatsApp e Chiama nella barra in basso, modello 3D, mappa.

## 7. Attivare le statistiche

Spente di default. Sono previste due soluzioni **senza cookie**: Plausible o Umami. Nel pannello dell'host (o in un file `.env` in locale, vedi `.env.example`):

```
PUBLIC_ANALYTICS_PROVIDER=plausible            # oppure umami
PUBLIC_ANALYTICS_SCRIPT_URL=https://plausible.io/js/script.js
PUBLIC_ANALYTICS_SITE_ID=www.ginecologiacagliari.com   # Umami: il website-id
```

Poi rifare la build. La Content Security Policy autorizza da sola l'origine dello script. Per non caricare nulla da terze parti è meglio un'istanza self-hosted o un proxy sullo stesso dominio. Ricordarsi di **aggiornare privacy e cookie** con il servizio scelto.

## 8. Aggiungere l'inglese

Il sito è solo in italiano, ma è predisposto:
1. In `astro.config.mjs` → `i18n.locales: ['it', 'en']`.
2. Copiare `src/i18n/it.ts` in `en.ts`, tradurre i testi e il menu, registrarlo in `src/i18n/index.ts`.
3. Creare le pagine in `src/pages/en/` e i testi in `src/content/…/en/` (oppure una collection dedicata).
4. Aggiungere `hreflang` nel `<head>` di `src/layouts/Base.astro`.

L'attributo `lang` della pagina viene già preso dalla lingua dell'URL.

## 9. Prestazioni, accessibilità e come misurarle

### Come è costruito il 3D
- Three.js (~130 kB gzip) si scarica **solo** quando serve: il modello del pavimento pelvico quando la sezione si avvicina allo schermo, la forma dell'hero (solo desktop) alla prima interazione o dopo qualche secondo. Su mobile l'hero è un SVG statico (interruttore `hero3dSuMobile` in `src/config.ts`).
- È l'equivalente di `client:visible` senza framework: un custom element `<three-island>` (`src/components/ThreeIsland.astro`).
- In pausa quando è fuori schermo o la scheda non è attiva. Il modello disegna solo quando qualcosa si muove.
- DPR limitato a 2 su desktop e 1.5 su mobile. Shader compilati in modo asincrono dove il browser lo supporta.
- Senza WebGL, con "riduci movimento" attivo o con `?no3d` si vede la versione statica (SVG) con gli stessi contenuti.

### Risultati misurati (build di produzione, 7/11/2026)
Lighthouse 13, servito con compressione gzip:

| Pagina | Performance | Accessibilità | Best practice | SEO | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home, mobile | 100 | 100 | 100 | 100 | 1.1 s | 0 ms | 0 |
| Home, desktop | 100 | 100 | 100 | 100 | 0.3 s | 0 ms | 0 |
| Home, mobile `?no3d` | 100 | 100 | 100 | 100 | 1.1 s | 0 ms | 0 |
| Prolasso, mobile | 100 | 100 | 100 | 100 | 0.8 s | 0 ms | 0 |
| Uroginecologia, mobile | 100 | 100 | 100 | 100 | 0.8 s | 0 ms | 0 |
| Curriculum, mobile | 100 | 100 | 100 | 100 | 0.8 s | 0 ms | 0 |
| Contatti, mobile | 100 | 100 | 100 | 100 | 0.8 s | 0 ms | 0 |
| La prima visita, mobile | 100 | 100 | 100 | 100 | 0.8 s | 0 ms | 0 |

**INP** (clic sui pulsanti del modello, Playwright, CPU ×4):
- senza 3D: 24–56 ms;
- con 3D attivo: 190–320 ms.

La scomposizione mostra che il codice dei pulsanti impiega 0–1 ms. Il resto è il tempo di disegno del canvas WebGL, che in questo ambiente di test è **software** (SwiftShader, circa 43 ms a fotogramma). Su un computer o telefono con GPU un fotogramma richiede pochi millisecondi. Va quindi verificato **su un dispositivo reale**: estensione *Web Vitals* di Chrome, oppure DevTools → Performance → *Interactions*, cliccando i 4 stati del modello con e senza `?no3d`. Dopo la pubblicazione, i dati reali sono in PageSpeed Insights (sezione "Esperienza degli utenti reali").

**Accessibilità**: axe-core (WCAG 2.2 AA + best practice) con 0 violazioni su tutte le pagine a 360 e 1280 px. Un solo `h1` per pagina, link "Salta al contenuto", focus visibile, aree cliccabili ≥ 44 px, nessuno scorrimento orizzontale a 360, 768, 1280 e 1920 px. Il modello 3D si usa da tastiera (frecce per ruotare, + e − per lo zoom, 0 per la vista iniziale), ha il testo dello stato in una regione `aria-live` e una descrizione testuale completa.

**Privacy**: nessuna richiesta a terzi al caricamento (verificato). La mappa interattiva OpenStreetMap si carica solo al clic. Content Security Policy con hash in ogni pagina.

### Rifare le misure
```bash
npm run build
npx serve dist                                   # server con compressione
npx lighthouse http://localhost:3000/ --view     # mobile
npx lighthouse http://localhost:3000/ --preset=desktop --view
```
(oppure Chrome DevTools → Lighthouse, in finestra anonima).

## 10. Regole sui contenuti sanitari

Codice di Deontologia Medica, artt. 55–57 (informazione sanitaria):
- niente promesse di risultato ("guarigione garantita", "definitivo", "indolore e sicuro");
- niente superlativi comparativi ("il migliore di Cagliari");
- niente prezzi in forma promozionale o sconti;
- niente titoli, numeri, percentuali o anni di esperienza non documentati;
- in fondo a ogni pagina informativa: *"Le informazioni di questa pagina sono divulgative e non sostituiscono una visita medica."* (aggiunta automaticamente dal layout).

Tono: si dà del **Lei**, frasi brevi, caldo e diretto, mai allarmista.
