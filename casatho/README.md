# Casa T'HŌ — Recorrido (demo 3D)

Concepto de sitio para Casa T'HŌ (Paseo de Montejo 498, Mérida), hecho por Alessia Studio – 3D web experience.
Es un recorrido en primera persona que avanza con el scroll: Paseo de Montejo → portón → zaguán → patio → portal de boutiques → T'HŌ Aperitivo → evento → salida.

Stack: Vite + Three.js + GSAP (ScrollTrigger, ScrollTo). Las fuentes son Google Fonts (Cormorant Garamond y Jost), servidas desde el propio sitio con Fontsource.

```bash
cd casatho
npm install
npm run dev        # http://127.0.0.1:5180
npm run build      # genera dist/ (lo que se publica)
```

En el teléfono (menos de 900 px de ancho) el sitio entra en modo "cine": la escena ocupa toda la pantalla y los textos aparecen como títulos sincronizados con la cámara, sobre un degradado verde palma. El scroll solo mueve la cámara. En escritorio los textos son tarjetas que entran con el scroll. En el teléfono la barra muestra "Reservar" (WhatsApp) y un menú con el índice del recorrido, "Cotizar evento" y "Cómo llegar".

Parámetros útiles en la URL:
- `?reduced` simula "movimiento reducido".
- `?nowebgl` muestra la versión estática.
- `?capture` desactiva la intro (para capturas).

## Estructura
- `index.html`: todos los textos (en español) y la versión estática si no hay WebGL.
- `src/main.js`: carga, intro (hojas + logo), scroll → cámara, puntos del recorrido, calidad adaptativa.
- `src/recorrido.js`: paradas y tramos de la cámara (CatmullRomCurve3), pausas y estados (reja, portón, evento).
- `src/scene/`: la casa (`house.js`), vegetación (`plants.js`), ramas de almendro de la intro (`foliage.js`), mobiliario y montaje del evento (`furniture.js`), sombras de contacto (`ao.js`), luz, cielo y reflejos (`world.js`), texturas procedurales (`textures.js`), planta en metros (`layout.js`).
- `public/`: fotos, favicon, `og.jpg`, `_headers` (noindex y caché), `robots.txt`.
- `scripts/`: capturas con Playwright (`shots.mjs`, `desk.mjs`, `intro.mjs`, `fallback.mjs`), generación de `og.jpg` y favicons (`og.mjs`), recorte de fotos (`fotos.py`).

## Publicar en Netlify
**Opción A: Netlify Drop**
1. Ejecuta `npm run build`, o usa el zip ya preparado.
2. Entra en https://app.netlify.com/drop y arrastra la carpeta `dist` (o el zip).
3. En *Site configuration → Change site name* ponle `casatho-demo`. Así coincide con la URL de la vista previa (`.env`).

**Opción B: repositorio conectado**
- Base directory: `casatho`
- Build command: `npm run build`
- Publish directory: `casatho/dist`

Ver `TODO.md` para los materiales pendientes.
