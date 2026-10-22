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
Il cosmo di Dante in marmo, su una colonnina scanalata:
- **Inferno**: imbuto rovesciato a nove gironi; anello girevole con
  «Giustizia mosse il mio alto fattore» (Inf. III, 4)
- **Fascia del nome**: ROBERTO · PUSCEDDU
- **Purgatorio**: sette cornici collegate da scale scolpite che salgono a spirale;
  anello con «Libertà va cercando, ch'è sì cara» (Purg. I, 71). Sui gradini sono nascosti:
  lo **scudo col filo rosso** (Tutela della donna e Codice Rosso), il **nodo che si scioglie
  in anello** (Legal Design), il **libro che si sfoglia** (Pubblicazioni)
- **Paradiso**: sulla vetta la Giustizia (spada, bilancia con catenelle, benda) dentro i
  cieli che ruotano — il cielo di Giove — con «Diligite iustitiam, qui iudicatis terram»
  (Par. XVIII, 91-93)

## Il percorso
1. **Caricamento**: fondo crema, barra rossa; a fine corsa la barra invade lo schermo di
   rosso pompeiano (#9E1B22).
2. **Intro**: il monumento sale dal pavimento, il drone arriva dall'alto e zooma sulla bilancia.
3. Scorrendo, il drone sale a spirale: zoom sul dettaglio di ogni capitolo, poi si allontana
   e mostra tutto il monumento, poi di nuovo zoom sul dettaglio successivo.
4. **Contatti**: super zoom sulla bilancia, con contatti, sedi e prenotazione su WhatsApp.

## Prenotazione su WhatsApp
Il pulsante "Prenota una consulenza" (nei contatti e nelle due aree dei servizi) apre un
mini modulo: nome, questione, giorno e fascia oraria preferiti, nota. Il messaggio si
compone da solo, si vede in anteprima e si apre già pronto su WhatsApp (wa.me). Il sito
non salva né invia dati.

## Da completare (sul sito compaiono come "da inserire")
In `src/config.js`:
- `contatti.whatsapp`: numero per le prenotazioni (finché manca, il modulo permette solo
  di copiare il messaggio)
- `contatti`: email, telefono, PEC, partita IVA
- `sedi`: indirizzo e nome della seconda sede
- `pubblicazioni`: link dei tre "Scopri di più"

Foto delle sedi: salvarle come `src/assets/sedi/maracalagonis.jpg` e
`src/assets/sedi/sede-2.jpg` (si caricano da sole).

Titolo completo di *Diritto e [è] Musica*: nello screenshot era troncato
("…delle regole ed …"); va completato in `index.html`.

## Struttura
- `index.html`: tutti i testi del sito (presi dal sito attuale) e il modulo di prenotazione
- `src/main.js`: caricamento, intro, scroll → percorso del drone, luci
- `src/scene/monument.js`: il monumento (gironi, nome, cornici con scale, cieli, oggetti)
- `src/scene/world.js`: scena e fotogrammi chiave del drone
- `src/scene/drone.js`: camera con inerzia, ondeggiamento, virate e lens shift
- `src/scene/marble.js`: marmo statuario procedurale (venature 3D, lucidatura, traslucenza)
- `src/scene/environment.js`: lucernario e finestre che si riflettono sul marmo
- `src/scene/justice.js`, `column.js`, `shield.js`, `knot.js`, `book.js`: i singoli pezzi
- `src/ui/`: caricamento e sipario rosso, contatti e sedi, prenotazione WhatsApp

Accessibilità: tutti i contenuti sono HTML normale (il 3D è decorativo); con
"riduci movimento" attivo l'intro è breve e il drone non ondeggia; senza WebGL il sito
resta navigabile.
