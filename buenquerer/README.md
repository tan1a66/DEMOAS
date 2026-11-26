# buenquerer — demo (proposta Alessia Studio)

Demo privata del nuovo sito di buenquerer, Estética Avanzada in Chamberí (Madrid). **Non è il
sito ufficiale** (`noindex`). Testi in spagnolo (di Spagna). Stesso motore della demo ESMALTADAS
(Vite + Three.js + GSAP): seta simulata nel vento, **senza giroscopio**.

```bash
cd buenquerer
npm install
npm run dev              # http://127.0.0.1:5183  (?debug per fps e tempi)
npm run build            # sito in dist/ (per Vercel)
npm run build:anteprima  # anteprima in UN file: anteprima/buenquerer-anteprima.html
npm run build:vercel     # deploy/: index.html in un solo file + immagine dell'anteprima e icone
```

## Percorso
1. **Apertura**: "buenquerer" come nel logo (Quicksand, rosa) e "Estética Avanzada · Chamberí"
   in verde petrolio, sotto una seta **del rosa del logo** con un bordino verde petrolio.
2. **Scroll**: le dieci lettere salgono e diventano il marchio della barra, **bianco sulla seta**
   (come il logo bianco sul rosa dell'avatar Instagram); poi "¡Esto va de quererse bien!",
   "Positive beauty & hyper care" e il menu.
3. **Menu**: Diagnóstico · Tratamientos · Tienda · Filosofía · Ven a vernos · **Pide cita**.
   Ogni voce è un luogo sulla seta: la camera ci vola. Dentro le sezioni la seta scende allo
   stesso rosa, più profondo, e le scritte sono bianche.

| Sezione | Stato |
| --- | --- |
| Diagnóstico | **completa**: storia a capitoli (vedi sotto) |
| Tratamientos | lista delle 16 categorie del sito con le loro foto; Diagnóstico porta alla storia |
| Faciales, Corporales, Masajes… (15) | **Work in progress** · Alessia Studio, con la foto del sito e "Pide cita" già compilato |
| Tienda | **completa**: 39 prodotti veri (50 referenze), filtro, taglie, bolsa e pagina di pagamento (vedi sotto) |
| Filosofía | storia a capitoli con i testi del sito (Positive beauty, Hyper care, 20 años) e la foto del centro |
| Ven a vernos | indirizzo, orari, telefono, WhatsApp, email, foto vera del centro, mappa, Cómo llegar |
| Pide cita | trattamento, giorno (prossimi 12 giorni di apertura), fascia e **ora precisa** (sabato solo 10–13), nome → messaggio pronto su WhatsApp |

In alto a destra: Instagram (@_buenquerer_), Ven a vernos, WhatsApp e la **bolsa** con il numero
dei prodotti (come sul sito attuale).

## Diagnóstico, la sezione sviluppata
Lo scroll guida la camera sulla seta (`data-cam` sui capitoli: direzione x,y,z e distanza).
1. "Diagnóstico" che entra lettera per lettera: "Todas las pieles son diferentes. Las personas
   que hay debajo, también." (dalla Filosofía del sito).
2. **El instante de tu piel**: PIEL che si compone (il concetto "Instante de la Piel" di
   Biologique Recherche).
3. **Cómo lo hacemos**: Escucha, Análisis, Protocolo, Seguimiento, con una linea che si disegna.
4. **La cabina**: la foto vera della cabina di diagnosi si apre con lo scroll.
5. **Resultados visibles**: la seta si spegne (opaca) e ritrova il lucido mentre la luce le passa
   sopra, come la pelle (`uGloss` nello shader). "Mira la seda".
6. **Alta cosmética**: la camera si tuffa sul tessuto. Centro specializzato Biologique Recherche.
7. **Tu diagnóstico**: "Empieza por conocerte." → "Solicita tu diagnóstico" apre Pide cita con
   Diagnóstico già scelto.

## Tienda
- Dati in `src/productos.js` (dalla pagina `tienda-buenquerer` del sito attuale, prezzi IVA
  inclusa; script `scripts/catalogo.py`), foto in `src/tienda/`. Le taglie dello stesso prodotto
  sono **una sola scheda** con la scelta della taglia (Lait VIP O2 50/150/250 ml…).
- Categorie: Limpieza, Lociones P50, Sérums, Cremas, Sepai.
- "Añadir" fa fremere la seta; la bolsa si ricorda in questo browser (`localStorage`).
- **Pagina di pagamento** (come quella del negozio Wix): dati, entrega (recogida in centro
  gratis / envío con indirizzo), pago (tarjeta, PayPal, a plazos), codice promozionale, riepilogo.
  **È una demo**: nessun dato parte, nessun pagamento; "Pagar" mostra la conferma di prova e
  svuota la bolsa. Nel sito finale qui si collega la pasarela (Stripe/Redsys/PayPal).

## Colori e caratteri
- Fondo crema `#F3F0EA` (dal sito), seta del rosa del logo: **misurata sullo schermo**, la mediana
  del telo è `#BF8D92` contro `#BF8B8F` del logo su Instagram (`SILK_COLORS` in
  `src/silk/silk.js`); nelle sezioni `SILK_PROFONDO`. Secondo colore: verde petrolio `#004245`
  (il claim "Positive beauty & hyper care"): bordino della seta, bottoni, numeri.
- **Marchio e testi**: Quicksand (il carattere del logo e del sito, OFL).
- **Titoli**: Fraunces morbido (OFL) al posto di **Recoleta Alt** del sito attuale, che è a
  pagamento: se la cliente ha la licenza web, si può rimettere. `scripts/build-fonts.py`.

## Dati da confermare con la cliente
Dal sito e dal profilo Instagram, in `src/config.js` e `src/tratamientos.js`:
- WhatsApp **+34 683 13 76 69**, tel. 91 421 97 05, buenquerer@buenquerer.com
- Calle María de Guzmán 53 (esquina Alonso Cano), 28003 Madrid
- Orario: lunes a viernes 10–20 h, sábado 10–14 h
- Descrizioni brevi dei trattamenti (proposte) e i passi del diagnostico (proposti)
- Le foto sono quelle del sito attuale

## Anteprima del link
`public/og-buenquerer.jpg` (1200×630, composta con `scripts/og.html`), `public/favicon-96.png` e
`public/apple-touch-icon.png` (la "b" del logo). I tag in `index.html` puntano a
`https://buenquerer-demo-alessiastudio.vercel.app/`: se il progetto Vercel ha un altro nome,
cambiarli. Per pubblicare: caricare la cartella `deploy/` (dopo `npm run build:vercel`) oppure
`dist/`; se si carica solo il file HTML il link arriva senza anteprima.
