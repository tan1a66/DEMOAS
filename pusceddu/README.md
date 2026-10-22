# Avv. Roberto Pusceddu — sito con percorso 3D

Sito one-page con un drone che esplora un unico monumento in marmo (Vite + Three.js + GSAP).
**Demo: la pagina ha `noindex`; toglierlo solo alla pubblicazione definitiva.**

```bash
cd pusceddu
npm install
npm run dev            # http://localhost:5173
npm run build          # sito statico in dist/ (qualsiasi hosting statico)
npm run build:preview  # un unico file dist-preview/index.html, si apre con doppio clic
```

## Il monumento
Il cosmo di Dante in marmo, su una colonnina scanalata. Non si vede mai per intero:
il drone resta sempre abbastanza vicino da mostrarne solo un tratto.
- **Inferno**: imbuto rovesciato a nove gironi; anello girevole con
  «Giustizia mosse il mio alto fattore» (Inf. III, 4)
- **Fascia centrale**: marmo liscio con due filetti incisi
- **Purgatorio**: sette cornici di pietra scalpellata collegate da scale che salgono a
  spirale; anello con «Libertà va cercando, ch'è sì cara» (Purg. I, 71). Sui gradini:
  lo **scudo in marmo rosso** (Tutela della donna e Codice Rosso), il **nodo rosso che si
  scioglie in anello** (Legal Design), il **libro che si sfoglia** (Pubblicazioni)
- **Paradiso**: sulla vetta la Giustizia (spada, bilancia con catenelle, benda), con l'anello
  «Diligite iustitiam, qui iudicatis terram» (Par. XVIII, 91-93) e due cieli sottili che
  ruotano. I cieli compaiono solo durante il viaggio: all'inizio e alla fine c'è solo la bilancia.

## Il percorso
1. **Caricamento**: fondo crema, barra rossa; a fine corsa la barra invade lo schermo di
   rosso pompeiano (#9E1B22).
2. **Intro**: si parte a pochi centimetri da un piatto della bilancia e ci si allontana
   (pulsante "Salta l'introduzione"; chi torna sul sito la vede più breve).
3. Il viaggio di Dante: dalla bilancia il drone scende all'Inferno (Chi sono), risale il
   Purgatorio (Servizi, Pubblicazioni) e torna alla bilancia (Contatti).
4. **Contatti**: primo piano sulla bilancia, con contatti, sedi e prenotazione su WhatsApp.

Luci: la luce principale è fissa (ombre stabili); un riempimento e un controluce seguono
il drone. Qualità adattiva: se il dispositivo fatica, la risoluzione del 3D scende da sola.

## Prenotazione su WhatsApp
Il pulsante "Prenota" (sempre visibile in alto, nei contatti e nelle due aree dei servizi) apre un
mini modulo: nome, questione, giorno e fascia oraria preferiti, nota. Il messaggio si
compone da solo, si vede in anteprima e si apre già pronto su WhatsApp (wa.me). Il sito
non salva né invia dati.

## Da completare
In `src/config.js` (finché un campo è vuoto non compare sul sito; con
`mostraSegnaposto: true` compare come "da inserire", utile per controllare):
- `contatti.whatsapp`: numero per le prenotazioni (finché manca, il modulo propone di
  copiare il messaggio)
- `contatti`: email, telefono, PEC, partita IVA
- `sedi`: indirizzo e nome della seconda sede (senza indirizzo non viene mostrata)
- `pubblicazioni`: link dei tre "Scopri di più" (senza link il pulsante non compare)

Foto delle sedi: salvarle come `src/assets/sedi/maracalagonis.jpg` e
`src/assets/sedi/sede-2.jpg` (si caricano da sole).

Da far verificare all'Avvocato:
- i testi di **Privacy** e **Note legali** (finestre in fondo alla pagina, in `index.html`)
- "Tirocinio presso la Corte d'Appello…" (prima era "Ex stagista") e la didascalia della foto
  (prima "Amministratore Unico")
- il titolo completo di *Diritto e [è] Musica* (nello screenshot era troncato)
- la terza copertina (oggi è il suo ritratto)

Alla pubblicazione: togliere `noindex` in `index.html` e mettere l'indirizzo completo del
sito in `og:image` (anteprima nelle condivisioni: `public/og.jpg`).

## Struttura
- `index.html`: tutti i testi del sito (presi dal sito attuale) e il modulo di prenotazione
- `src/main.js`: caricamento, intro, scroll → percorso del drone, luci
- `src/scene/monument.js`: il monumento (gironi, fascia, cornici con scale, cieli, oggetti)
- `src/scene/world.js`: scena, percorso del drone e volo d'ingresso
- `src/scene/drone.js`: camera con inerzia, ondeggiamento, virate e lens shift
- `src/scene/marble.js`: marmo statuario procedurale (venature 3D, lucidatura, traslucenza)
- `src/scene/environment.js`: lucernario e finestre che si riflettono sul marmo
- `src/scene/justice.js`, `column.js`, `shield.js`, `knot.js`, `book.js`: i singoli pezzi
- `src/ui/`: caricamento e sipario rosso, contatti, sedi, privacy, prenotazione WhatsApp
- Caratteri: Cormorant Garamond e Manrope ospitati sul sito (pacchetti `@fontsource`)

Accessibilità: tutti i contenuti sono HTML normale (il 3D è decorativo); con
"riduci movimento" attivo l'intro è breve e il drone non ondeggia; senza WebGL il sito
resta navigabile.
