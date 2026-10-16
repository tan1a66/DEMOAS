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
2. **WhatsApp**: `js/config.js` → `whatsapp: '5215638581547'` (+52 56 3858 1547).
3. **Anteprima WhatsApp**: i meta `og:image` / `og:url` in `index.html` puntano a
   `https://piedradeagua-alessiastudio.netlify.app` (da cambiare se cambia il dominio).

## Pubblicazione
Online su **https://piedradeagua-alessiastudio.netlify.app** — Netlify è collegato al repository
(branch `claude/compassionate-goldberg-jib898`, base directory `piedra-de-agua`): ogni push si pubblica da solo.

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
js/sections/          Nosotros, Habitaciones, Servicios, Experiencias (UI)
js/scenes/            intercom.js (citofono), gallery.js (servizi), terrace.js (bodas), map.js + cenote.js (esperienze)
js/data.js            testi di camere, servizi, luoghi e attivazioni (ES/EN)
data/yucatan.geo.json coste e stati (Natural Earth 1:10m, dominio pubblico)
js/contact.js         pannello Reservar / Contacto con mappa del Centro
js/static.js          versione con foto se WebGL non è disponibile
js/util/              texture procedurali (mattonelle di pasta, calce, legno, targhe in ottone), foto con segnaposto, audio, tween
```

## Stato
- [x] HOME: acqua interattiva (mouse e tocco), foglie e petali, titolo e "Entrar a la casona"
- [x] TRANSIZIONE: flash bianco → portone 3D con chiodi e sopraluce liberty → ingresso nel patio
- [x] PATIO: hub 3D con 4 porte, targhe in ottone, hover/tap, volo della camera e ritorno
- [x] NOSOTROS: slider 1845/hoy (foto "invecchiata" in tempo reale), timeline, motivo henequén
- [x] HABITACIONES: citofono 3D in ottone, pianta della stanza che cresce fino ai m² reali
- [x] SERVICIOS: quadri liberty appesi ai nastri, foto a schermo intero + WhatsApp; Bodas = terrazza 3D dal giorno al tramonto
- [x] EXPERIENCIAS: plastico 3D della penisola (coste Natural Earth), pin, rotta, modelli, discesa nel cenote, Activaciones
- [x] Versione statica senza WebGL
