# Dott.ssa Laura Sala — demo "Velata" (proposta Alessia Studio)

Demo privata del rifacimento del sito. **Non è il sito ufficiale** (`noindex`).
Vite + Three.js + GSAP. Pensata prima per iPhone (390×844), poi desktop.

```bash
cd laura-sala
npm install
npm run dev              # http://127.0.0.1:5180  (aggiungere ?debug per fps e tempi)
npm run build            # sito in dist/ (per Vercel)
npm run build:anteprima  # anteprima in UN file: anteprima/velata-anteprima.html
```

## Come è fatta la seta
- `src/silk/cloth.js` — simulazione del tessuto (XPBD a piccoli passi) con forze
  aerodinamiche per triangolo: è lei a dare i movimenti da "grande fazzoletto".
- `src/silk/wind.js` — brezza con raffiche lente e turbolenza che viaggia col vento.
- `src/silk/silk.js` — telo 1:2 verticale tenuto per i due angoli alti, vicini e fuori
  quadro: pieghe a cascata; gesto automatico del polso; presa e tocco con il dito.
- `src/silk/silkShaders.js` — vertex: B-spline cubica sulla simulazione (normali
  analitiche). Fragment: raso con speculare anisotropico a due lobi lungo l'ordito,
  riflesso di uno studio fotografico (softbox + striscia), sheen sui crinali, wrap
  lighting e trasmissione, rovescio opaco, orlo arrotolato, trama visibile solo da vicino.

## Interazioni
- Luce (e riflessi) seguono mouse / dito (±30°). Giroscopio: passo 5.
- Dito: trascinamento orizzontale = tira la seta; tocco = onda; verticale = scroll.
- Scroll continuo (tutto segue il dito): il nome sale al centro della barra, compare il menu; "Scorri" invita a scorrere.
- Se per 2 s si sta sotto 45 fps, la mesh passa a metà dei segmenti.

## Da completare con la cliente
Monogramma ufficiale, ritratto in alta risoluzione, link Instagram e MioDottore, testi tra [parentesi].
