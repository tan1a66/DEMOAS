# Il Calabrese — demo del sitio (pizzería italiana en Mérida, Yucatán)

Demo interactiva en 3D (Vite + Three.js + GSAP), todo el sitio en español.

```bash
cd il-calabrese
npm install
npm run dev            # http://localhost:5173
npm run build:preview  # un solo HTML en dist-preview/index.html (doble clic para abrirlo)
```

Parámetros útiles: `?auto` (arranca sin pulsar "Entrar"), `?mesa` (salta la intro y va directo a la mesa),
`?t=12` (congela la intro en el segundo 12 para revisar una toma).

## Experiencia
1. **Intro**: vista de dron sobre la costa de Calabria → despega el avión con cola tricolor → cruza el Atlántico
   (plano general del planeta) → aterriza en Mérida. Costas reales de Natural Earth 1:50m; Italia y Yucatán
   en alta resolución.
2. **La mesa**: mesa de familia italiana (mantel de cuadros, vino Cirò, vela en fiasco, pan, peperoncini, albahaca).
   Tres platos interactivos:
   - **Menú**: la pizza gira; al tocarlo la cámara hace zoom y se abre la carta (nombre, ingredientes, foto al lado,
     animaciones al desplazarse, filtros por categoría).
   - **Reservar**: formulario (fecha, hora, personas, nombre, teléfono) que genera el mensaje de WhatsApp.
   - **Ubicación**: mapa, dirección, horario y botón "Cómo llegar".

## Por sustituir antes de publicar
- `src/config.js`: WhatsApp, teléfono, dirección y coordenadas (ahora son **de ejemplo**).
- `src/data/pizzas.js`: carta, precios y fotos (las fotos son de Unsplash como marcador; si no cargan,
  se dibuja la pizza automáticamente).
- `src/data/world.json`: generado con `npm run geo -- land.geojson borders.geojson` (ver script).

## Video de la demo (≈40 s, 1080p)
Grabación fotograma a fotograma con reloj virtual (sale fluida aunque el render sea por software):
```bash
npm run build:artifact
mkdir -p /tmp/rec && python3 scripts/grabacion/build-page.py /tmp/rec/index.html
(cd /tmp/rec && python3 -m http.server 5191 &)
export PW=$(npm root -g)/playwright W=1280 H=720 DPR=1.5 LITE=1 PR=1
node scripts/grabacion/capture.cjs A /tmp/rec/fA &   # loader + vuelo + llegada a la mesa
node scripts/grabacion/capture.cjs B /tmp/rec/fB     # mesa, menú, reserva, ubicación, cierre
# unir fA + fB numerados en orden en /tmp/rec/all y codificar (acelerado 1.2x):
ffmpeg -framerate 30 -i /tmp/rec/all/%05d.jpg -vf "setpts=PTS/1.2,fps=30" -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart demo.mp4
```
