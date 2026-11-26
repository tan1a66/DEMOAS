# Skin Beauty — demo web (Barcelona)

Demo de rediseño para **Skin Beauty**, el centro de estética integral de Liyerlyn Galvis
(C/ Riera Blanca, 55 · Sants-Montjuïc). Una sola página en español, con la técnica
**Drenoredux** como protagonista y herramientas de maderoterapia en 3D.
**Uso de presentación: no publicar sin sustituir los marcadores de posición (ver abajo).**

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # versión de producción en dist/
npm run build:preview  # un único HTML autónomo en dist-preview/ (doble clic para abrir)
```

Parámetros útiles en desarrollo: `?static` fuerza la versión sin animaciones
(la misma que ve quien tiene activado «reducir movimiento»), `?slow=8` ralentiza las animaciones.
`dev/tools.html` muestra las nueve herramientas 3D juntas para retocar formas.

## Estructura

- `index.html` — todo el contenido y la estructura de las 8 secciones.
- `src/data/content.js` — datos reales: tratamientos (6 categorías), contacto, horarios, coordenadas.
- `src/main.js` — Lenis + GSAP ScrollTrigger: intro, sección fijada hero → Drenoredux, revelados, contador, navegación.
- `src/phases.js` — fases del pin compartidas entre el DOM y la escena 3D (barrido, división, fusión, palabra).
- `src/three/tools.js` — las 9 herramientas modeladas por código a partir de las fotos de referencia
  (rodillo curvo de engranajes, rodillo de dientes cuadrados, rodillo de 5 cuentas, cuerda de cuentas,
  tabla cola de ballena, gua sha media luna, copa sueca, seta con bolitas, herramienta en T).
- `src/three/wood.js` — veta de madera procedural (nogal y miel) y materiales satinados.
- `src/three/choreo.js` — coreografía: posición de cada herramienta en cada tramo del scroll.
- `src/three/stage.js` — render (un solo contexto WebGL), profundidad de campo, muelle del cursor, giroscopio.
- `src/ui/` — tratamientos (filtros, tarjetas 3D, ficha), comparador antes/después, reseñas, mapa, cursor, líneas líquidas.

## Rendimiento

- three.js se carga en un chunk aparte (import dinámico); el mapa (MapLibre) solo al acercarse a «Encuéntranos».
- Las herramientas no son GLB: se generan por código (≈0 KB de modelos que descargar, frente a varios MB
  de GLB con Draco) y la textura de madera se crea en un canvas.
- Profundidad de campo solo en escritorio, limitada a los rectángulos de pantalla donde hay herramientas;
  si los fps bajan de ~48, se desactiva sola. En móvil: 4 herramientas, sin desenfoque, pin más corto.
- `prefers-reduced-motion`: versión estática (sin pin, sin intro, escena 3D renderizada una sola vez).

## Pendiente antes de publicar

- **Reseñas**: las tarjetas son marcadores de ejemplo (`REVIEWS` en `content.js`). Sustituir por reseñas reales de Google.
- **Antes/después**: ilustración provisional (`src/ui/compare.js`). Sustituir por fotos reales con consentimiento.
- **Retrato**: recortado de una captura de su web actual; pedir la foto original en alta resolución
  y reemplazar `src/assets/liyerlyn.jpg` (mismo nombre).
- Mapa: teselas de OpenFreeMap (sin clave). La línea discontinua metro → centro es indicativa, no la ruta exacta.
