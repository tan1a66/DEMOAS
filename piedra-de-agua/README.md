# Hotel Piedra de Agua · Mérida — demo 3D (proposta Alessia Studio)

Esperienza immersiva in Three.js per presentare al cliente un concept di sito.
**Non è il sito ufficiale dell'hotel** (lo dice anche il footer di ogni pagina).

Sito 100% statico: `index.html` + `css/` + `js/` + `images/`. Three.js **0.186.1** da CDN (jsDelivr) con import map,
nessun build, nessun modello esterno: tutto il 3D è procedurale (geometrie + shader), le foto si usano come texture.

## Provarlo in locale
Serve un server statico (i moduli ES non funzionano con `file://`):

```bash
cd piedra-de-agua
python3 -m http.server 8000      # oppure: npx serve .
# http://localhost:8000
```

Utili per rivedere le animazioni: `?slow=4` (tutto 4 volte più lento), `#/patio` (salta acqua e intro),
`#/habitaciones` ecc. (apre direttamente una sezione).

## Da completare prima di mandarlo al cliente
1. **Foto** in `images/` con i nomi indicati in `images/README.md`.
2. **WhatsApp**: numero provvisorio in `js/config.js` → `whatsapp: '5210000000000'`.
3. **Anteprima WhatsApp**: dopo la pubblicazione, in `index.html` sostituire `images/og-cover.jpg`
   nei meta `og:image` / `twitter:image` con l'URL assoluto (es. `https://nome.netlify.app/images/og-cover.jpg`).

## Pubblicazione
- **Netlify**: trascinare la cartella `piedra-de-agua` su app.netlify.com/drop, oppure collegare il repo con
  *Base directory* = `piedra-de-agua` (c'è già `netlify.toml`, nessun comando di build).
- **Vercel**: nuovo progetto dal repo, *Root Directory* = `piedra-de-agua`, framework "Other", nessun build.

## Struttura
```
index.html            meta Open Graph, import map, markup dell'interfaccia
css/styles.css        stile Liberty (ottone, calce, verde acqua), responsive, reduced-motion
js/main.js            orchestrazione: loader → acqua → flash → portone → patio ⇄ sezioni (hash routing)
js/engine.js          un solo WebGLRenderer, solo la scena attiva viene disegnata, DPR ≤ 2 e risoluzione dinamica
js/config.js          numero WhatsApp, indirizzo, livelli di qualità (desktop / mobile)
js/i18n.js            testi ES / EN
js/scenes/home.js     superficie d'acqua: simulazione onde su GPU, rifrazione, caustiche, foglie e fiori
js/scenes/patio/      portone, zaguán e patio: colonne corinzie, ferro battuto liberty, nastri, rampicanti, luci
js/sections/          Nosotros, Habitaciones, Servicios, Experiencias
js/contact.js         pannello Reservar / Contacto con mappa del Centro
js/static.js          versione con foto se WebGL non è disponibile
js/util/              texture procedurali (mattonelle di pasta, calce, legno, targhe in ottone), foto con segnaposto, audio, tween
```

## Stato
- [x] HOME: acqua interattiva (mouse e tocco), foglie e petali, titolo e "Entrar a la casona"
- [x] TRANSIZIONE: flash bianco → portone 3D con chiodi e sopraluce liberty → ingresso nel patio
- [x] PATIO: hub 3D con 4 porte, targhe in ottone, hover/tap, volo della camera e ritorno
- [ ] NOSOTROS · HABITACIONES · SERVICIOS · EXPERIENCIAS (in lavorazione)
