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
