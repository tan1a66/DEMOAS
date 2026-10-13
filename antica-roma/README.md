# Antica Roma · Mérida — sito demo interattivo

Demo "effetto wow" per **Antica Roma**, cucina romana a Mérida (Yucatán).
Lo scroll racconta un viaggio dall'alto: l'aereo **ANTICA ROMA** parte dal **Colosseo**, sorvola Tirreno, Mediterraneo e Atlantico, arriva sulla costa dello Yucatán e atterra sul **Monumento a la Patria** (Paseo de Montejo). Dall'aereo cadono gli ingredienti (pecorino romano, fusilli, tagliatelle, spaghetti, guanciale, pomodori, basilico…) e la camera si tuffa nella rotonda, che diventa un piatto. Si arriva sulla tovaglia a quadretti bianchi e rossi con 4 piatti vuoti, che sono i pulsanti del sito:

| Piatto | Cosa apre |
|---|---|
| **MENÚ** | libro sfogliabile (si gira cliccando, trascinando l'angolo o con le frecce; l'angolo si solleva quando ci si avvicina col cursore) |
| **RESERVA AHORA** | modulo prenotazione → messaggio pronto su **WhatsApp** |
| **UBICACIÓN** | mappa illustrata di Mérida + pulsanti Google Maps / Cómo llegar |
| **MÁS DE NUESTRA HISTORIA** | racconto "De Roma a Mérida" |

**Il cursore cambia il sito**: inclina la scena, guida l'aereo (che vira e si inclina), sposta le nuvole, accende una luce calda sulla tovaglia, spinge gli ingredienti, solleva e inclina i piatti.

## Aprire

Doppio clic su `index.html` (funziona anche offline: font e immagini sono locali). Nessuna build, nessuna dipendenza.

## Da sostituire con i dati reali

Tutto in `js/config.js`:

- `whatsapp.number` / `whatsapp.display` — **numero segnaposto** (formato internazionale, solo cifre, es. `5219991234567`)
- `address` e `hours` — indirizzo e orari da confermare (l'indirizzo esatto non è stato trovato online)
- `menuPages` — quando arriva la carta vera: mettere le immagini delle pagine in `assets/menu/` e scrivere `menuPages: ['assets/menu/01.jpg', 'assets/menu/02.jpg', …]`. Il libro userà quelle al posto della carta di esempio (prezzi e piatti attuali sono **di esempio**).

Il testo di "Más de nuestra historia" è volutamente generico (nessuna data o nome inventato): va sostituito con la storia vera in `js/modals.js`.

## Immagini (Higgsfield)

Generate con Higgsfield (Nano Banana 2.1 con ricerca immagini per i monumenti reali, GPT Image 2.5): Colosseo, costa tirrenica, Atlantico con nuvole, costa dello Yucatán con cenote, Monumento a la Patria, aereo con livrea ANTICA ROMA, tavola con ingredienti, pasta fatta a mano. Dettagli in `assets/README.md`. Le nuvole sono ritagliate dalla foto dell'Atlantico; tovaglia, piatti e ingredienti sono livelli separati ricavati dalla foto della tavola (`assets/table/`).

## Struttura

- `index.html`, `css/site.css`, `js/app.js` — scena, timeline dello scroll, cursore, aereo, nuvole, tavola
- `js/book.js`, `css/book.css` — libro-menu sfogliabile
- `js/modals.js`, `css/modals.css` — Reserva / Ubicación / Historia
- `js/table-data.js` — posizione di piatti e ingredienti sulla foto
- `tools/` — screenshot e registrazione del video demo

Nessuna transizione o animazione CSS: tutto è animato da un unico ciclo JavaScript. Così il video si registra **fotogramma per fotogramma** con un orologio virtuale (`index.html?rec`) ed è perfettamente fluido a 60 fps, qualunque sia la velocità della macchina.

## Rigenerare il video demo

```bash
cd antica-roma
tools/record-parallel.sh ../video/antica-roma-demo.mp4 60 3 96   # 1920×1080, 60 fps, 3 processi in parallelo
```

La regia (scroll e movimenti del cursore, clic, testo digitato) è in `tools/scene.cjs`. Serve Chromium di Playwright e ffmpeg.
