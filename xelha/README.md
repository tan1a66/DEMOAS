# XELHA — demo 3D (Alessia Studio)

Demo per sviluppatori immobiliari: hotel & residenze a Mérida in 3D (Vite + Three.js + GSAP).
Progetto **fittizio**: nomi, superfici, appartamenti e disponibilità sono illustrativi (`src/data/hotel.js`).

```bash
npm install
npm run dev:xelha      # http://localhost:5174  (?skip salta l'intro su Mérida, ?auto entra senza clic)
npm run build:xelha    # un solo file: xelha/dist-preview/index.html (si apre con doppio clic)
```

## Percorso
1. **Ingresso**: logo XELHA + DEMO ALESSIA STUDIO.
2. **Prologo Mérida**: mappa 3D della penisola (riusa la mappa della demo URBAZ), strada al mare (≈ 30 km, 25 min), centro, aeroporto, Tren Maya.
3. **Hotel**: volo d'arrivo, giorno / tramonto / notte.
4. **Departamentos**: torre "spenta" (ora blu), pannello ascensore per piano con numero di appartamenti; tocco su un appartamento → si accende, aura dorata, 2 info e pulsante **Entra**.
5. **Visita**: taglio di sezione del piano (pianta con muri dorati e disponibilità), poi interni a misura d'occhio (sala, terrazza, camera).
6. **Recorrido** aereo con didascalie e modulo "Agendar visita" (demo: non invia dati).

## Struttura
- `src/data/hotel.js`: tre tipologie (A Estudio, B 1 Recámara, C 2 Recámaras) ripetute per piano, stati, distanze di Mérida (**approssimative**)
- `src/hotel/building.js`: edificio ad arco con terrazze e giardini pensili, arredi di lusso per tipologia
- `src/hotel/materials.js`: materiali, piano di taglio, "poché" dorato della sezione
- `src/hotel/site.js`, `foliage.js`: giardino, alberca, palme, flamboyanes, città intorno
- `src/hotel/atmosphere.js`: cielo, acqua, ore del giorno; `aura.js`: appartamento acceso
- `src/map/merida.js`: prologo su Mérida
