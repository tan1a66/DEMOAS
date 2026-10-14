# CARNAL — sitio de una sola página (carnicería boutique, Mérida)

Recorrido de scroll continuo en 8 escenas, sin menú, como una película. Todo el sitio en español (México).

```bash
cd carnal
npm install
npm run dev            # http://localhost:5173
npm run build          # producción en dist/ (rutas relativas: funciona en cualquier subcarpeta)
npm run build:preview  # un solo HTML en dist-preview/index.html (doble clic para presentarlo)
```

## Stack

**Vite + React + TypeScript · Three.js con @react-three/fiber · GSAP ScrollTrigger · Lenis · GLSL propio.**
Es el stack del brief, con cuatro decisiones de rendimiento:

1. **Un solo `<canvas>` fijo para todo el recorrido.** Cada escena 3D es una "toma" con su propia escena y
   cámara; un director (`src/tres/director.ts`) renderiza solo las tomas presentes. Sin WebGL contexts
   múltiples, sin recompilar al cambiar de escena.
2. **Un solo reloj.** El ticker de GSAP mueve Lenis, después ScrollTrigger y después el 3D
   (`frameloop="never"` + `advance`), así texto e imagen avanzan en el mismo cuadro. Si ninguna escena 3D
   está en pantalla, no se renderiza nada.
3. **Anclaje con `position: sticky`** (no con el pin de ScrollTrigger): más estable en móvil (barra de
   direcciones de iOS) y sin "pin-spacers". Las secciones se solapan una pantalla para que los anclajes vayan
   seguidos: no hay pantallas muertas entre escenas. ScrollTrigger solo hace el *scrub* de las coreografías.
4. **Carga diferida.** El primer pintado solo descarga React, GSAP y Lenis (~140 kB gzip). Three.js y el hero
   se descargan mientras el umbral dibuja sus vetas; Rotonda, Brasas, Fachada y Cortina se descargan y
   compilan (`compileAsync`) cuando el recorrido se acerca a ellas. Sin post-processing: el grano y la viñeta
   son CSS estático.

Todo el 3D es **procedural** (sin modelos ni texturas que descargar): geometría de los cortes, marmoleo,
mármol, brasas, piedra caliza y terciopelo son shaders.

## El recorrido

| # | Escena | DOM | 3D |
|---|--------|-----|----|
| 1 | Umbral | `escenas/Umbral.tsx`: vetas SVG procedurales que se dibujan (es el loader) y la frase | Las brasas de "El fuego" se encienden de fondo; el corte del hero nace de sus vetas mientras se apagan |
| 2 | El corte | `escenas/Corte.tsx`: wordmark **detrás** del corte, frases | `tres/escenas/CorteHero.tsx`: wagyu con marmoleo (Worley + fbm), una luz lateral que lo recorre; al final se disuelve y quedan las vetas como líneas de luz |
| 3 | Orígenes | `escenas/Origenes.tsx` + `ui/Mapa.tsx`: mapa de puntos (Pacífico al centro), rutas que viajan a Mérida, 3 capítulos | — |
| 4 | La Colección | `escenas/Coleccion.tsx`: ficha técnica en monospace | `tres/escenas/Rotonda.tsx`: columnas de mármol negro en círculo, vitrinas de cristal (transmisión), spot cenital fijo: el círculo gira y cada corte "entra en la luz" |
| 5 | El fuego | `escenas/Fuego.tsx`: productos y tres reglas | `tres/escenas/Brasas.tsx`: lecho de brasas con distorsión térmica, brasas que suben, humo |
| 6 | Visítanos | `escenas/Visitanos.tsx`: dirección, horarios, mapa de marcador | `tres/escenas/Fachada.tsx`: muro colonial de piedra caliza y estuco, portón con luz cálida, rejas, placa |
| 7 | El privado | `escenas/Privado.tsx`: "Hay un lugar más.", invitación "Reservar el privado" | `tres/escenas/Cortina.tsx`: cortina de terciopelo morado que se abre con el scroll |
| 8 | La mesa servida | `escenas/Final.tsx`: carta con los 5 botones (colección, WhatsApp, cómo llegar, reservar, Instagram) | — |

**Reservar** (`ui/Reserva.tsx`): una sola reserva para todo el sitio (nombre, fecha, hora, personas,
comentarios) con la opción **En el privado**. Se abre desde la carta final, desde el privado (con la opción
ya marcada) o con el enlace directo `/#reservar`, y se envía como mensaje de WhatsApp. Las horas y el máximo
de personas están en `sitio.json → reservas`.

Interfaz (`ui/Interfaz.tsx`): logo pequeño, línea fina de avance, botón discreto de WhatsApp siempre visible e
"Ir al final" (salto con fundido a negro, sin atravesar todo el ritual). Enlaces directos: `/#final`,
`/#coleccion`, `/#privado`, `/#visitanos`, `/#reservar`.

## Datos editables (`src/data/`)

- `sitio.json`: nombre, **WhatsApp** (número y plantillas de mensaje), **Instagram**, **dirección y
  coordenadas**, **horarios**, **horas de reserva**, textos SEO. De aquí salen también el `<title>`, Open Graph y los datos
  estructurados `schema.org/ButcherShop` del HTML estático (`seo.ts`).
- `cortes.json`: la colección (nombre, origen, raza, grado, peso, notas, cocción). `forma` elige la
  geometría (`ribeye`, `striploin`, `tomahawk`, `picana`, `filete`) y `bms` la densidad del marmoleo en 3D.
  Agregar o quitar cortes ajusta solo el círculo de columnas y el largo de la escena.
- `origenes.json`: los tres orígenes (texto, datos, punto de salida en el mapa).
- `ritual.json`: productos para el ritual en casa y las tres reglas.
- `textos.json`: todo el copy del recorrido.
- Fotos: campo `foto`, ruta dentro de `src/assets/fotos/` (p. ej. `origenes/japon.webp`); Vite las optimiza y
  las incluye también en el HTML único. Mientras falte el archivo se muestra un marcador oscuro con el formato
  correcto y la descripción de la toma. Las fotos de Orígenes y de los productos son **provisionales,
  generadas con IA (Higgsfield, Nano Banana)**: sustituir por fotografía real antes de publicar. La foto del
  privado (`privado/sala.webp`) es la sala real.
- Logotipo: `src/assets/marca/carnal.svg`, vectorizado del rótulo a pincel del cliente (`ui/Marca.tsx`); se usa
  en el hero, la cabecera, la carta final, la reserva, la placa de la fachada y el favicon.

## Accesibilidad, respaldo y SEO

- `prefers-reduced-motion`: sin scroll suave, sin giros ni partículas; la rotonda cambia con fundido de luz y
  la cortina se desvanece en vez de deslizarse.
- Sin WebGL: imágenes estáticas (`src/assets/estaticos/`, renderizadas desde el propio 3D) y cortina en CSS.
- Botones y enlaces reales, foco visible, la colección completa también como lista para lectores de pantalla.
  El formulario del privado no recibe foco mientras la cortina está cerrada.
- Móvil: calidad 3D reducida automáticamente (menos geometría, sin sombras, cristal sin transmisión,
  resolución adaptativa si bajan los fps).

Parámetros de prueba en la URL: `?rm` (movimiento reducido), `?nogl` (sin WebGL), `?calidad=baja|alta`,
`?rapido` (sin espera del loader), `?limpio` (solo el 3D, para capturas).

## Scripts

- `npm run mapa -- world.json`: regenera `src/data/mapa.json` (puntos del mapa) desde Natural Earth 1:50m.
- `npm run estaticos`: con `npx vite --port 5199` corriendo, regenera las imágenes sin WebGL y `public/og.jpg`.
- `npm run capturas -- "http://localhost:5199/?rapido" capturas 1440x900 corte:0.1 coleccion:0.3`: capturas
  de revisión en Chromium (WebGL por software).
- `node scripts/video.mjs http://localhost:5199/ capturas/video`: video demo de ≈38 s grabado fotograma a
  fotograma con reloj virtual (el guion está al inicio del script); luego `ffmpeg` (comando en el script).

## Pendiente del cliente (hoy son marcadores)

- Número de WhatsApp, Instagram, dirección, coordenadas, horarios y dominio (`sitio.json`).
- Lista real de cortes (`cortes.json`) y productos (`ritual.json`).
- Fotos reales de orígenes y productos (hoy son provisionales, generadas con IA) y, si se quiere, de los cortes.
- Logotipo en vector original (hoy está vectorizado de una captura pequeña).
- Modelos 3D / fotogrametría: cuando existan, sustituir la geometría de `tres/geometria.ts` por GLB con Draco
  (y texturas KTX2); el material de marmoleo puede quedarse como respaldo o como detalle.
- Tipografía display con licencia (Editorial New o Canela) o la del cliente, si existe como fuente: cambiar
  `--serif` en `src/estilos/base.css`.
