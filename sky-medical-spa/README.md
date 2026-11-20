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
1. **Apertura**: si parte direttamente da SKY (in malva, come nel logo) sotto la seta.
   L'intro "Toca para entrar" (SKY che respira, le lettere che volano nel nome) è spenta:
   `?soglia=1` la riaccende.
2. **Scroll**: S·K·Y salgono e si stringono al centro della barra; poi la frase e il menu.
3. **Menu**: SKY Medical Spa (Faciales · Masajes · Depilación láser) · SKY Beauty Center
   (lashes, nails, hair, manos y pies) · Ubicación · Agendar. Ogni voce è un luogo sulla
   seta: la camera ci vola. Dentro SKY Medical Spa ci sono le tre voci; nelle loro pagine
   "SKY Medical Spa / Faciales" riporta su (come il tasto indietro).

| Sezione | Stato |
| --- | --- |
| SKY Medical Spa | pagina con Faciales, Masajes, Depilación láser |
| Faciales | completa (vedi sotto) |
| Masajes, Depilación láser, SKY Beauty Center | **Work in progress** · Alessia Studio (da costruire con la cliente) |
| Ubicación | indirizzo, mappa Google (in toni avorio), Cómo llegar, WhatsApp |
| Agendar | servizio, giorno (prossimi 14), fascia oraria, nome → messaggio pronto su WhatsApp |

In alto a destra: Instagram, Ubicación, WhatsApp (e il menu dentro le sezioni).

## Faciales, la sezione sviluppata
Lo scroll guida la camera sulla seta (`data-cam` sui capitoli: direzione x,y,z e distanza).
1. Titolo enorme in malva che entra lettera per lettera, "Tu piel, primero."
2. **Valoración**: PIEL che si compone.
3. **El ritual**: quattro passi, una linea malva che si disegna.
4. **Luz**: la seta si spegne (opaca) e ritrova il brillo mentre la luce le passa sopra
   (`uGloss` nello shader). "Mira la seda".
5. **De cerca**: la camera si tuffa a 18 cm dal tessuto; sugli schermi retina si vede la trama.
6. **¿Cómo sientes tu piel hoy?**: seca, grasa, mixta, sensible, con manchas → facial da cui
   partire (orientativo) e "Agenda este facial", che apre Agendar con servizio e nota
   (la nota arriva nel messaggio WhatsApp). Testi in `src/quiz.js`.

## Leggerezza
- **Avvio**: la forma a riposo della seta è calcolata una volta sola (`npm run bake` →
  `src/silk/baked.js`, 19 KB). All'apertura bastano 0,5 s di vento invece di 5 s di simulazione
  (su un processore medio: da ~1,6 s a ~0,35 s di pagina ferma). Da rilanciare se si cambiano
  misure, griglia o sotto-passi della seta (altrimenti il sito torna da solo al calcolo lento).
- **Stesso tessuto su ogni schermo** (griglia 48×48, 9 sotto-passi, come su iPhone). La griglia
  60×60 che usavano Mac e iPad con trackpad si drappeggiava con il bordo sinistro rigirato e un
  nodo in alto a destra (11% del telo al rovescio, contro l'1,5% della piega naturale), e la
  memoria della forma lo riportava sempre lì. Sul computer cambia solo la mesh, più fitta.
- **Grafica**: risoluzione massima 1,5× (prima 2×), mesh 208² su telefono e 320² su computer
  (prima 320² e 448²), riflesso dello studio con 3 campioni (prima 5).
- **Qualità automatica**: sotto i 48 fps per 2 s si scende a risoluzione 1×, poi a metà mesh.
- **Font dentro il sito** (niente Google Fonts), ridotti ai caratteri dello spagnolo con
  fonttools: Cormorant 500 e corsivo, Manrope, Archivo solo 600, larghezze 112–125% e solo
  maiuscole. In tutto ~71 KB (prima ~185 KB). SKY compare solo quando il suo carattere è pronto.
- Tolti il codice della seta-figura e gli effetti/stili della demo Sala non usati.

## Colori e caratteri
- La seta ha il colore dello sfondo del logo (salvia, `SILK_COLORS` in `src/silk/silk.js`).
  La base è più fredda del colore voluto perché la luce scalda il raso: sullo schermo torna
  al salvia del logo. `?seta=cipria` mostra la seta della demo Sala.
- Carattere del logo: **Cormorant Garamond** (titoli, SKY, testi); Archivo largo per menu ed
  etichette; Manrope per i bottoni. Tutti in `src/fonts/` con le licenze OFL. SKY è in malva come nel logo (`--mauve` in `styles.css`), e il malva torna
  in titoli, parole grandi, numeri, bottoni, scelte selezionate e "SKY" nel menu.

## Dati da confermare con la cliente
Presi da una scheda pubblica (Fresha), da verificare:
- WhatsApp **+52 999 256 7412** → `src/config.js` (numero e messaggi)
- Indirizzo: Plaza Solare, local 203, primer piso, Av. Cámara de Comercio, calle 49 n.º 230, Mérida
  (Google indica per Plaza Solare il CP 97120, Fresha 97116: il CP non è scritto)
- Profilo Instagram, testi di Faciales (proposti), orari se si vogliono aggiungere

## Anteprima del link
Il sito è su **https://demosky-alessiastudio.vercel.app**. L'anteprima che compare quando si
manda il link (WhatsApp, iMessage, Instagram, Facebook) è `public/og.jpg` (1200×630: seta,
SKY in malva, "Medical Spa · Beauty Center", Mérida). I tag `og:` e `twitter:` in
`index.html` puntano a quel dominio: se cambia, aggiornarli.

**Su Vercel va caricata la cartella intera** (`npm run build` → `dist/`: `index.html`,
`assets/`, `og.jpg`, icone). Con il solo file HTML unico l'immagine dell'anteprima non esiste
sul server e il link resta senza foto. WhatsApp ricorda le anteprime già viste: per vedere
quella nuova si può mandare il link con `?v=2` in fondo.
