# PICHETA MÉRIDA — *Above Mérida*

Propuesta independiente de rediseño digital para [Picheta](https://picheta.mx/) (gastronomía yucateca contemporánea
+ cocina de autores, centro de Mérida). **No es el sitio oficial**: es una demo comercial para presentar al propietario.
Mientras no se apruebe, las páginas llevan `noindex, nofollow`.

> La ciudad, desde otra perspectiva.

Vite + React 19 + TypeScript estricto, sin librerías de animación ni de 3D. Dirección: un sitio de hotel boutique
de alto nivel — fotografía real a pantalla completa, composición editorial, mucho espacio y la reserva siempre a un
toque — con **un solo momento 3D**: la terraza, donde la foto real lleva un mapa de profundidad y un pequeño
renderizador WebGL2 mueve la mirada con el ratón o el giroscopio.

```bash
cd picheta
npm install
npm run dev          # http://localhost:5180
npm run build        # comprobación de tipos + build de producción en dist/
npm run preview      # sirve dist/ en http://localhost:5181
npm run typecheck
```

## Rutas

| Ruta | Qué es |
| --- | --- |
| `/` | Portada: apertura fotográfica con **ENTRAR** y **AGENDAR**, y el recorrido por escenas (ver abajo). |
| `/#lugar`, `/#galeria`, `/#ubicacion`… | Ancla directa: se salta la portada y lleva a la sección. |
| `/menu/` | Menú: página tipográfica, rápida, sin animaciones. |
| `/agendar/` | Reservaciones: OpenTable (sistema oficial) + WhatsApp + teléfono + solicitud guiada. |
| `?lang=en` | Inglés en cualquier ruta. El idioma elegido se recuerda (localStorage) y viaja en los enlaces internos. |

Cada ruta es un HTML estático real (build multipágina de Vite): funciona en cualquier hosting sin reescrituras.

## La portada

| | Escena | Fotografías reales | Qué hace |
| --- | --- | --- | --- |
| — | Apertura (`Hero`) | Terraza al atardecer (mesa frente a la Catedral en el teléfono), salón, Catedral, barra al anochecer | Pase lento con fundido y acercamiento (7 s), pausa, puntos con progreso. **ENTRAR** baja a la bienvenida; **AGENDAR** abre `/agendar/`. |
| — | Bienvenida (`Intro`) | — | Una frase y tres datos verificados (+350 años, terraza con vista a la Catedral, cocina de autores). |
| 01 | El lugar (`Place`) | Salón abovedado, balcón, muros de piedra | Composición asimétrica con revelado y paralaje. |
| 02 | La terraza (`Terrace`) | Panorámica de la terraza | **Momento 3D**: profundidad real, el ratón o el giroscopio mueven la mirada, la cámara avanza al desplazarse. |
| 03 | La luz (`Light`) | Día, hora dorada, atardecer, anochecer | Escenario fijo: al desplazarse, la terraza pasa por cuatro atmósferas. |
| 04 | Gastronomía (`Gastronomy`) | Manos del cocinero, salmón, ingredientes | Filosofía oficial y enlace al menú. |
| 05 | Eventos (`Events`) | Sala comedor privada, brindis en la terraza | Sala para 8 y terraza para eventos; correo de eventos y WhatsApp. |
| 06 | Galería (`Gallery`) | Nueve fotos | Retícula editorial y visor accesible (`<dialog>`, flechas, Escape). |
| 07 | Invitación (`Invitation`) | Plato en la terraza frente a la Catedral | Reserva directa en OpenTable. |
| 08 | Ubicación (`Location`) | Vídeo aéreo nocturno real | Dirección, horario, contacto. |

En el teléfono, una barra fija con **Menú** y **Agendar una mesa** aparece al dejar atrás la apertura.
Con `prefers-reduced-motion`: sin pase automático ni paralaje, la luz en retícula, la terraza como foto fija.

## 3D: fotos con profundidad

- **Mapa de profundidad** (`public/depth/terraza-panoramica.png`, blanco cerca, negro lejos): Depth Anything V2
  (Large) calculado sobre la panorámica real de la terraza (job temporal de GitHub Actions, ya eliminado). Los mapas
  de las demás fotos, que usaba la versión anterior, siguen en el historial (commit `9b32741`).
- **Renderizador** (`src/lib/depthRenderer.ts`, ≈ 200 líneas, sin dependencias): un pase WebGL2 con *parallax occlusion
  mapping*: para cada píxel busca, de cerca a lejos, qué superficie de la foto se ve con la cámara desplazada, así el
  primer plano tapa de verdad a la Catedral y la Catedral al cielo. El *dolly* acerca la cámara (lo cercano crece más).
- **Terraza** (`src/components/DepthPhoto.tsx`): la `<Picture>` normal queda debajo (carga rápida, texto alternativo) y
  el lienzo reutiliza esa misma imagen como textura.
- **Cámara**: ratón en escritorio, giroscopio en móvil (`src/lib/motion.ts`), deriva lenta cuando no hay movimiento y
  movimientos ligados al desplazamiento por escena (amplitud, plano de foco y centro del dolly en cada escena).
- **Seguridad de rendimiento**: sin WebGL2, con WebGL por software (equipos sin aceleración gráfica) o con
  `prefers-reduced-motion`, se ve la foto normal. Si un dispositivo va lento, baja sola la resolución y la precisión;
  si aun así no llega, el efecto se apaga para el resto de la visita.
- `?gl=force` activa el 3D aunque el navegador use WebGL por software (solo para revisar en máquinas sin GPU).

## Fuentes y verificación

Todo dato visible se tomó del sitio oficial el **16-10-2026** (inicio, `/menu/`, `/contacto/`, `/reservas/`,
`/historia/`, `/terraza-para-eventos/`). El entorno de desarrollo no tenía acceso a picheta.mx, así que la consulta se
hizo con un job temporal de GitHub Actions (navegador real): página por página, capturas, imágenes y vídeo. El job y el
material crudo ya se eliminaron del repositorio (siguen en el historial, commit `19c956f`).

| Dato | Valor | Origen |
| --- | --- | --- |
| Dirección | Calle 61 x 60 y 62, Plataforma Picheta Centro, Mérida, Yucatán | Pie del sitio oficial |
| Teléfono | +52 999 506 0339 | Pie del sitio oficial (`tel:9995060339`) |
| WhatsApp | wa.me/529995060339 | Botón de WhatsApp del sitio oficial y “Reserva por WhatsApp” en `/reservas/` |
| Reservaciones | OpenTable, rid 1088797 | Enlace “Reserva una mesa” y widget de `/reservas/` |
| Horario | Lun–sáb 17:00–01:00 · dom 17:00–23:00 (restaurante y barra) | Pie del sitio oficial |
| Edificio | “más de 350 años”, “una discreta entrada” | `/historia/` |
| Vista | “Ubicada en la plaza central… vista de la majestuosa catedral” | `/terraza-para-eventos/` |
| Sala privada | 8 personas | `/terraza-para-eventos/` |
| Eventos | eventos@picheta.mx | Formulario de `/terraza-para-eventos/` |
| Redes | Instagram @pichetamx, Facebook, Tripadvisor | Iconos del encabezado oficial |
| Menú | 29 platos, precios y créditos de autor | `/menu/` (versión en español) |
| Filosofía | “Ofrecemos comida con corazón…” | Inicio del sitio oficial |

Notas:

- **Menú en inglés**: el menú inglés oficial está desactualizado (otros platos y precios). La página interna sigue el menú
  en español; en inglés se usa la redacción oficial cuando el plato existe allí y una traducción propia en los demás
  (`src/data/menu.ts`). Se corrigieron solo erratas evidentes.
- **El widget de OpenTable** no se incrusta: en las dos capturas automáticas no llegó a renderizar, así que la demo enlaza
  directamente a la página de reservación oficial de OpenTable (la misma URL que usa el sitio).
- **No hay backend**. El formulario de `/agendar/` valida los datos (fecha desde hoy, horas dentro del horario oficial,
  teléfono) y abre WhatsApp con el mensaje redactado; la página dice expresamente que la reserva no está confirmada hasta
  que el restaurante responda. Para conectar un servicio de reservas, ver `src/lib/reservations.ts` (`handoffUrl`).
- No se inventaron testimonios, premios, coordenadas, horarios de “última mesa” ni características arquitectónicas.
  Los pies de foto describen lo que se ve en cada imagen.

## Fotografías, logotipo y vídeo

- **Fotos** (22): todas del sitio oficial de Picheta, o fotogramas de su vídeo oficial de la terraza. El origen exacto de
  cada una está en `src/data/photos.ts` (`source`). Variantes AVIF (640–2000 px) + JPEG de respaldo, con dimensiones y
  color medio en `src/data/photoMeta.json`.
- **Logotipo**: la firma caligráfica oficial, vectorizada a partir de `Picheta_logo-white.png` (`src/components/Logo.tsx`);
  el isotipo (anillo) es el SVG oficial (`src/components/Isotype.tsx`, favicon).
- **Vídeo** (`public/video/`): fragmento aéreo de `picheta.mx/Picheta-TERRAZA.mp4` (4,25 s → 8,95 s), sin audio,
  1280 px (móvil) y 1920 px (escritorio), de fondo en Ubicación. Solo se descarga cuando esa sección está cerca.
  Los archivos están en el repositorio para que el build (y el zip para Netlify) los incluya.

Para regenerar las variantes (por ejemplo, con fotos nuevas):

```bash
git checkout 19c956f -- _source/full              # originales descargados del sitio oficial (o tus propias fotos)
python3 scripts/images.py _source/full            # → public/img/ y src/data/photoMeta.json (Pillow con AVIF)
bash scripts/video.sh _source/full/terraza-master.mp4 _source/full   # vídeo y fotogramas (ffmpeg)
rm -rf _source
```

## Dónde se cambia cada cosa

- Dirección, teléfono, WhatsApp, OpenTable, horario, redes: `src/config/site.ts` (un solo lugar).
- Textos ES / EN, metadatos SEO incluidos: `src/i18n/es.ts` y `src/i18n/en.ts` (TypeScript avisa si falta una clave en
  inglés). Las palabras entre `*asteriscos*` de los titulares se componen en cursiva.
- Menú: `src/data/menu.ts`.
- Fotos, textos alternativos y encuadres por pantalla: `src/data/photos.ts`.
- Colores, tipografía, espaciado: variables en `src/styles/base.css`.
- HTML estático de cada ruta (título, descripción, Open Graph, datos estructurados `Restaurant`): `index.html`,
  `menu/index.html`, `agendar/index.html`.

Antes de publicar en el dominio definitivo: quitar `noindex`, añadir `canonical` y `hreflang` con URLs absolutas y
poner `og:image` con URL absoluta.

## Sistema visual

- Negro carbón `#12110f`, marfil cálido `#efe8dc`, papel `#f3eee5`, piedra `#b5a995`; acento ámbar `#c4895b` (la luz de
  las lámparas de la barra), solo en estados y detalles.
- *Instrument Serif* (titulares en mayúsculas con una palabra en cursiva) + *Archivo* variable con eje de anchura
  (etiquetas expandidas, texto). Fuentes servidas desde el propio sitio (`@fontsource`), sin peticiones a terceros.
- Escenas claras y oscuras alternadas, retícula de 12 columnas, mucho espacio negativo; cada escena tiene composición
  propia. El encabezado detecta el tono de la sección que tiene debajo.

## Accesibilidad y rendimiento

- Navegación completa por teclado, enlace “Saltar al contenido”, foco visible, índice móvil con foco atrapado y Escape.
- `prefers-reduced-motion`: sin transiciones, escena 03 fija y sin vídeo, galería como carrusel.
- Titulares con texto completo para lectores de pantalla; formularios con `aria-invalid`, mensajes de error
  asociados y región `role="status"`.
- Primera pantalla sin pantallas de carga: la foto de la portada se precarga (AVIF) y el texto es visible al instante.
  Imágenes diferidas con `loading="lazy"` y dimensiones explícitas. JS inicial ≈ 100 KB gzip (React y el renderizador 3D incluidos);
  mapas de profundidad de 50–95 KB cada uno, cargados solo cuando su escena se acerca.
- Profundidad ligada al desplazamiento con `animation-timeline: view()` donde el navegador la soporta (mejora progresiva).
