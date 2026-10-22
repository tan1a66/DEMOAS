# Avv. Roberto Pusceddu — sito con percorso 3D

Sito one-page con un percorso "a drone" tra opere in marmo (Vite + Three.js + GSAP).
**Demo: la pagina ha `noindex`; toglierlo solo alla pubblicazione definitiva.**

```bash
cd pusceddu
npm install
npm run dev            # http://localhost:5173
npm run build          # sito statico in dist/ (qualsiasi hosting statico)
npm run build:preview  # un unico file dist-preview/index.html, si apre con doppio clic
```

## Il percorso
1. **Caricamento**: fondo crema, barra rossa. A fine caricamento la barra si allarga e
   invade lo schermo di rosso pompeiano (#9E1B22).
2. **Apertura**: la colonnina dorica sale dal pavimento; sopra, *Iustitia* senza figura:
   spada piantata nel basamento, bilancia in equilibrio sul pomolo (oscilla e ritrova
   l'equilibrio, reagisce allo scroll), benda annodata all'impugnatura. Il drone arriva
   dall'alto, gira attorno alla scultura, zooma sulla bilancia e si ferma.
3. Scorrendo, il drone visita le opere disposte ad anello alle spalle della colonnina:
   - **I · Chi sono** — il cosmo di Dante: Inferno (imbuto a nove gironi), al centro la
     fascia con il nome, Purgatorio (monte a cornici), Paradiso (cieli concentrici che
     ruotano). Su tre anelli girevoli sono incisi:
     «Giustizia mosse il mio alto fattore» (Inf. III, 4),
     «Libertà va cercando, ch'è sì cara» (Purg. I, 71),
     «Diligite iustitiam, qui iudicatis terram» (Par. XVIII, 91-93).
   - **II · Servizi** — Tutela della donna e Codice Rosso: scudo di marmo con un filo rosso
     intarsiato. Legal Design: un nodo di marmo che si scioglie in un anello perfetto.
   - **III · Pubblicazioni** — libro aperto su un leggio: le pagine si girano scorrendo.
   - **IV · Sedi e contatti** — il drone sale e mostra dall'alto tutto il percorso.

## Da completare (segnaposto visibili sul sito come "da inserire")
In `src/config.js`:
- `contatti`: email, telefono, PEC, partita IVA
- `sedi`: indirizzo e nome della seconda sede
- `pubblicazioni`: link dei tre "Scopri di più"

Foto delle sedi: salvarle come `src/assets/sedi/maracalagonis.jpg` e
`src/assets/sedi/sede-2.jpg` (si caricano da sole).

Titolo completo di *Diritto e [è] Musica*: nello screenshot era troncato
("…delle regole ed …"); va completato in `index.html`.

## Struttura
- `index.html`: tutti i testi del sito (presi dal sito attuale)
- `src/main.js`: caricamento, intro, scroll → percorso del drone, luci
- `src/scene/drone.js`: camera con inerzia, ondeggiamento, virate e lens shift
- `src/scene/world.js`: disposizione delle opere e fotogrammi chiave del drone
- `src/scene/marble.js`: marmo statuario procedurale (venature 3D nello shader)
- `src/scene/justice.js`, `column.js`, `dante.js`, `shield.js`, `knot.js`, `book.js`: le opere
- `src/ui/`: barra di caricamento e sipario rosso, sedi e contatti

Accessibilità: tutti i contenuti sono HTML normale (il 3D è decorativo); con
"riduci movimento" attivo l'intro è breve e il drone non ondeggia; senza WebGL il sito
resta navigabile.
