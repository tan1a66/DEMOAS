# Casa Caracol · Isla Mujeres — sito immersivo (demo Alessia Studio)

Vite + Three.js (vanilla) + GSAP/ScrollTrigger. Mobile first (iPhone in verticale), funziona anche su desktop.
Regola: il 3D è la cornice, il contenuto sono le foto reali.

```bash
cd casa-caracol
npm install
npm run dev        # http://localhost:5173 (anche in rete locale: l'indirizzo "Network" si apre dall'iPhone)
npm run build      # produzione in dist/
```

## Deploy su Vercel
1. Importa il repository su Vercel.
2. **Root Directory: `casa-caracol`** (il resto lo legge da `vercel.json`: framework Vite, output `dist`).
3. Ogni push sul branch genera un'anteprima con il suo URL: è quello da aprire sull'iPhone.

## Stato
- [x] **Fase 1**: setup, loader con caustica, spiaggia (sabbia, onda, caustiche), discesa della camera, match cut con pannello di debug, audio del mare, ES/EN
- [ ] Fase 2: tunnel di madreperla + sezioni della casa con foto reali
- [ ] Fase 3: finale in spiaggia, CTA, meta tag/OG, versione statica senza WebGL, rifiniture di performance

## Dove si cambia cosa
| Cosa | File |
|---|---|
| Tutti i testi (ES/EN) | `src/i18n/translations.js` |
| Valori del match cut (camera, conchiglia, cielo) | `src/story/matchcut.js` |
| Lunghezza dei tratti di scroll, onda, caustiche, audio, WhatsApp | `src/config.js` |
| Forma della conchiglia procedurale | `CONCH` in `src/gl/shell.js` |
| Inquadratura iniziale e percorso della camera | `INTRO` e `PATH` in `src/story/rig.js` |

## Pannello di debug del match cut (`?debug`)
Apri `…/?debug`. Con **Fijar en el corte** attivo la camera resta ferma nella posa del taglio e la foto `spires-sky.jpg` si sovrappone:
- **Foto encima**: `mezcla` (trasparenza, regolabile con *Opacidad foto*), `bordes` (contorni della foto in magenta sopra il 3D: il modo più preciso), `parpadeo` (alterna 3D e foto).
- Regola **Cámara del corte** (posizione, rotazione, FOV della foto intera) e **Concha** finché le punte coincidono.
- **Copiar valores** copia il blocco pronto da incollare in `src/story/matchcut.js` (se il telefono non permette di copiare, **Ver valores** lo mostra in un riquadro).
- I valori restano salvati nel browser mentre lavori; **Volver a los valores del código** li azzera.

L'allineamento vale per qualsiasi schermo: il FOV si riferisce alla foto intera e la foto viene proiettata con la stessa camera, quindi ciò che allinei sull'iPhone resta allineato su desktop (cambia solo quanto della foto si vede ai lati o sopra/sotto).

Altri parametri utili per i test: `?lang=en`, `?reduced` (simula movimento ridotto), `?nogl` (simula assenza di WebGL).

## Asset (in `public/`)
Finché un file manca, il sito usa un segnaposto automatico:
- `photos/spires-sky.jpg` → segnaposto generato dal 3D stesso, con le guide di ritaglio iPhone / 16:9
- `audio/sea.mp3` → mare sintetizzato in tempo reale, sincronizzato con l'onda
- `models/conch.glb` → conchiglia procedurale (strombo con corona di punte)

Foto previste: `spires-sky.jpg`, `entrance.jpg`, `living.jpg`, `kitchen.jpg`, `caracolito.jpg`, `pool.jpg`, `sea.jpg`, `bw-umbrella.jpg`, `models.jpg`.
