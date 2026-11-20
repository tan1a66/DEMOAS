# SKY Medical Spa — demo (proposta Alessia Studio)

Demo privata del nuovo sito. **Non è il sito ufficiale** (`noindex`). Testi in spagnolo.
Stesso codice della demo "Velata" della Dott.ssa Laura Sala (Vite + Three.js + GSAP):
seta simulata che si muove nel vento, stessa entrata ad effetto, **senza giroscopio**.

```bash
cd sky-medical-spa
npm install
npm run dev              # http://127.0.0.1:5181  (?debug per fps e tempi)
npm run build            # sito in dist/ (per Vercel)
npm run build:anteprima  # anteprima in UN file: anteprima/sky-medical-spa-anteprima.html
```

## Percorso
1. **Apertura**: si parte direttamente dal nome sotto la seta (richiesta della cliente).
   L'intro "Toca para entrar" (SKY che respira, le lettere che volano nel nome) è spenta:
   `?soglia=1` la riaccende.
2. **Scroll**: "Medical Spa" svanisce, S·K·Y salgono e si stringono al centro della barra;
   poi la frase e il menu.
3. **Menu**: Faciales · Masajes · Depilación láser · SKY Beauty Center (lashes, nails, hair,
   manos y pies) · Ubicación · Agendar. Ogni voce è un luogo sulla seta: la camera ci vola.

| Sezione | Stato |
| --- | --- |
| Faciales | completa: racconto a capitoli con effetti (lettere, filetti d'oro, messa a fuoco) |
| Masajes, Depilación láser, SKY Beauty Center | **Work in progress** · Alessia Studio (da costruire con la cliente) |
| Ubicación | indirizzo, mappa Google (in toni avorio), Cómo llegar, WhatsApp |
| Agendar | servizio, giorno (prossimi 14), fascia oraria, nome → messaggio pronto su WhatsApp |

In alto a destra: Instagram, Ubicación, WhatsApp (e il menu dentro le sezioni).

## Colori e caratteri
- La seta ha il colore dello sfondo del logo (salvia, `SILK_COLORS` in `src/silk/silk.js`).
  La base è più fredda del colore voluto perché la luce scalda il raso: sullo schermo torna
  al salvia del logo. `?seta=cipria` mostra la seta della demo Sala.
- Carattere del logo: **Cormorant Garamond** (titoli, SKY, testi); Archivo largo per menu ed
  etichette; Manrope per i bottoni.

## Dati da confermare con la cliente
Presi da una scheda pubblica (Fresha), da verificare:
- WhatsApp **+52 999 256 7412** → `src/config.js` (numero e messaggi)
- Indirizzo: Plaza Solare, local 203, primer piso, Av. Cámara de Comercio, calle 49 n.º 230, Mérida
  (Google indica per Plaza Solare il CP 97120, Fresha 97116: il CP non è scritto)
- Orari, profilo Instagram, elenco dei trattamenti di Faciales (testi proposti)

## Anteprima del link
`public/og.jpg` (1200×630), `public/apple-touch-icon.png` e `public/favicon-96.png` (SKY su salvia).
I tag in `index.html` puntano a `https://demo-skymedicalspa-alessiastudio.vercel.app/`:
se il dominio su Vercel è un altro, aggiornare `og:url` e `og:image`.
