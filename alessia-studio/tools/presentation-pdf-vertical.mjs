// Presentazione dei servizi in verticale (A4, in spagnolo), 6 pagine con due sezioni ciascuna. Solo
// Alessia Studio (niente progetti di altri marchi) e senza prezzi. Colori del marchio (verde e rosa),
// font Syne e Inter.
//   node tools/presentation-pdf-vertical.mjs [cartella-immagini-del-sito]
//     ->  brand/alessia-studio-presentacion-vertical.pdf
import { writeFileSync } from 'node:fs';
import { brand, V, R, INK, svg, fileUrl as f, fontFaces, workDir, sitePic, renderPdf } from './lib/presentacion.mjs';

const tmp = workDir('deck-vertical');
const clean = process.argv[2];
await sitePic(clean, 'p0251', '02-divani', `${tmp}/cover.jpg`, 1588, 1000);
await sitePic(clean, 'p0359', '03-vision', `${tmp}/vision.jpg`, 1364, 760);

let page = 1; // la copertina è la pagina 1, senza piè di pagina
const foot = (dark = false) => `<div class="foot"><span class="fl">${svg(dark ? 'logo-rosa' : 'logo-verde')}</span><span>Presentación de servicios · 2026</span><span>${++page}</span></div>`;
const cards = (list, cls) => `<div class="cols ${cls}">${list.map(([t, d, hi]) => `<div class="card${hi ? ' hi' : ''}"><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>`;

const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Alessia Studio · Presentación de servicios</title><style>
${fontFaces()}
@page { size: 794px 1123px; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font: 400 13.5px/1.55 Inter; color: ${INK}; }
.p { width: 794px; height: 1123px; background: ${R}; position: relative; overflow: hidden; page-break-after: always; display: flex; flex-direction: column; }
.sec { padding: 46px 56px 0; }
.band { background: ${V}; padding: 44px 56px 40px; }
.band.fill { flex: 1; padding-bottom: 70px; }
.band h1, .band h3, .band .big { color: ${INK}; }
.k { font: 600 10px/1.3 Inter; letter-spacing: .22em; text-transform: uppercase; margin-bottom: 10px; }
h1 { font: 800 32px/1.12 Syne; letter-spacing: -.03em; color: ${V}; padding-bottom: .06em; margin-bottom: 14px; }
h3 { font: 800 15.5px/1.22 Syne; letter-spacing: -.015em; color: ${V}; padding-bottom: .05em; margin-bottom: 5px; }
.card.hi h3 { color: ${INK}; }
.big { font: 800 30px/1.14 Syne; letter-spacing: -.03em; padding-bottom: .06em; margin-bottom: 12px; }
.lead { font-size: 15px; line-height: 1.55; }
.cols { display: grid; gap: 14px; }
.c2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .c3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.c4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.card { border: 1.2px solid rgba(0,0,0,.22); border-radius: 11px; padding: 15px 16px; }
.card p { font-size: 12.5px; line-height: 1.5; }
.card.hi { background: ${V}; border-color: ${V}; }
.rule { border-top: 1.2px solid rgba(0,0,0,.28); padding-top: 10px; }
.rule p { font-size: 12.5px; }
.num { font: 600 26px/1 Inter; color: ${V}; margin-bottom: 10px; }
.foot { position: absolute; left: 56px; right: 56px; bottom: 22px; display: flex; align-items: center; gap: 14px; font: 500 8.5px Inter; letter-spacing: .2em; text-transform: uppercase; }
.foot span:nth-child(2) { flex: 1; } .fl svg { height: 9px; width: auto; display: block; }
.rows .row { display: grid; grid-template-columns: 250px 1fr; gap: 18px; align-items: baseline; padding: 9px 0; border-top: 1.2px solid rgba(0,0,0,.22); }
.rows .row:last-child { border-bottom: 1.2px solid rgba(0,0,0,.22); }
.rows h3 { margin: 0; }
.rows p { font-size: 13px; }
.strip { margin-top: 12px; padding-top: 10px; border-top: 1.2px solid rgba(0,0,0,.28); font-size: 12.5px; }
.strip b, .note b { font-weight: 600; }
.shots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.shots img { width: 100%; aspect-ratio: 4/5; object-fit: cover; object-position: top; border-radius: 8px; display: block; }
.cap { font-size: 10.5px; margin-top: 5px; }
.steps .st { display: grid; grid-template-columns: 136px 150px 1fr; gap: 14px; align-items: baseline; padding: 13px 0; border-top: 1.2px solid rgba(0,0,0,.22); }
.steps .st:last-child { border-bottom: 1.2px solid rgba(0,0,0,.22); }
.steps .n { font: 600 10px Inter; letter-spacing: .12em; text-transform: uppercase; }
.steps h3 { margin: 0; }
.steps p { font-size: 13.5px; }
.steps h3 { font-size: 17px; }
.stack .card { padding: 18px; } .stack .card p { font-size: 13px; } .stack h3 { font-size: 16.5px; }
.note { font-size: 12.5px; margin-top: 12px; }
.cover .logo svg { width: 300px; height: auto; display: block; }
.cover img { width: 794px; height: 500px; object-fit: cover; display: block; margin-top: auto; }
.ct .lab { font: 600 10px Inter; letter-spacing: .22em; text-transform: uppercase; margin-bottom: 4px; }
.ct .val { font: 600 22px/1.2 Inter; letter-spacing: -.01em; }
/* in Syne i numeri sono "all'antica" per impostazione: qui sempre allineati (3D) */
.p h1, .p h3, .p .big { font-feature-settings: "lnum" 1; font-variant-numeric: lining-nums; }
</style><body>

<!-- 1 · portada -->
<section class="p cover">
  <div class="sec" style="padding-top:56px">
    <div class="logo">${svg('logo-verde-2-righe')}</div>
    <div class="big" style="font-size:38px;margin-top:44px;max-width:600px">Sitios que se exploran, no solo se miran.</div>
    <p class="lead" style="max-width:560px">Creamos sitios web 3D inmersivos para marcas que quieren ser recordadas, en cualquier parte del mundo.</p>
    <p class="k" style="margin-top:26px;line-height:1.7">Branding · Dirección creativa · Sitios web 3D<br>Desde Italia · Con base en México · Trabajamos en todo el mundo</p>
  </div>
  <img src="${f(`${tmp}/cover.jpg`)}">
</section>

<!-- 2 · el problema, la visión, nuestro sitio -->
<section class="p">
  <div class="band">
    <div class="k">El problema</div>
    <div class="big">En internet todos los sitios se parecen. Y lo que se parece, se olvida.</div>
    <p class="lead">Mismas plantillas, mismas fotos, mismo scroll. Tu cliente visita tu sitio, luego el de un competidor, y ya no recuerda cuál era el tuyo.</p>
  </div>
  <div class="sec">
    <div class="k">Nuestra visión</div>
    <h1 style="font-size:38px">Un sitio web puede ser un lugar, no una página.</h1>
    <p class="lead" style="font-size:16px">Diseñamos marcas y espacios digitales para recorrer: arquitecturas de luz, materia y movimiento que cuentan una marca como una visita. Cada scroll es un paso; cada detalle está hecho para quedarse.</p>
    <img src="${f(`${tmp}/vision.jpg`)}" style="width:100%;height:380px;object-fit:cover;border-radius:10px;display:block;margin-top:24px">
  </div>
  ${foot()}
</section>

<!-- 3 · qué es un sitio inmersivo, por qué funciona -->
<section class="p">
  <div class="sec">
    <div class="k">Sitios inmersivos</div>
    <h1>Qué es un sitio inmersivo.</h1>
    <div class="cols c3" style="margin-top:8px">
      ${[
        ['01', 'Se explora', 'El visitante se mueve dentro de un espacio 3D: entra a una habitación, gira alrededor de un producto, descubre los detalles.'],
        ['02', 'Reacciona', 'Cada gesto tiene respuesta: luces, animaciones y sonidos que siguen el mouse, el scroll o el dedo en el celular.'],
        ['03', 'Se recuerda', 'Una experiencia vivida se queda en la mente más que una página leída. Tu marca se vuelve de la que todos hablan.'],
      ].map(([n, t, d]) => `<div class="card" style="padding:18px"><div class="num">${n}</div><h3 style="font-size:17px">${t}</h3><p>${d}</p></div>`).join('')}
    </div>
    <h3 style="margin-top:24px;font-size:17px">Nuestro propio sitio es un recorrido</h3>
    <p style="margin-bottom:10px">Un edificio de cemento rosa sobre el mar: se entra por una ventana circular, se descansa junto a los sofás verdes, se mira la luz del tragaluz y se termina bajo el agua, donde cada burbuja es un proyecto.</p>
    <div class="shots">
      <div><img src="${f(`${brand}/sito/01-muro.jpg`)}"><div class="cap">La entrada: la ventana circular</div></div>
      <div><img src="${f(`${brand}/sito/02-divani.jpg`)}"><div class="cap">Los sofás verdes</div></div>
      <div><img src="${f(`${brand}/sito/03-vision.jpg`)}"><div class="cap">Bajo el tragaluz</div></div>
    </div>
  </div>
  <div class="band fill" style="margin-top:26px">
    <div class="k">Por qué funciona</div>
    <div class="big">Un sitio que la gente explora es un sitio que la gente recuerda.</div>
    <div class="cols c2" style="margin-top:18px;gap:18px 26px">
      <div class="rule"><h3>Más tiempo en el sitio</h3><p>Explorar es una invitación a quedarse.</p></div>
      <div class="rule"><h3>Percepción premium</h3><p>El sitio comunica el valor de la marca.</p></div>
      <div class="rule"><h3>Recomendación</h3><p>Las experiencias bonitas se comparten.</p></div>
      <div class="rule"><h3>Funciona en todas partes</h3><p>Carga ligera y calidad que se adapta: celular, tablet y computadora.</p></div>
    </div>
  </div>
  ${foot(true)}
</section>

<!-- 4 · servicios, para quién trabajamos -->
<section class="p">
  <div class="sec">
    <div class="k">Qué hacemos</div>
    <h1>Nuestros servicios.</h1>
    ${cards([
      ['Sitios web 3D', 'Sitios completos e inmersivos, del concepto al lanzamiento, rápidos también en el celular.'],
      ['Configuradores 3D', 'Tu cliente elige colores, materiales y variantes del producto y los ve en tiempo real.'],
      ['Recorridos virtuales', 'Hoteles, casas y espacios para visitar en línea antes de reservar o comprar.'],
      ['Landings de lanzamiento', 'Páginas de alto impacto para un nuevo producto, una colección o un evento.'],
      ['Modelos 3D', 'Productos, espacios y personajes modelados a medida y optimizados para la web.'],
      ['Motion y contenido', 'Videos y animaciones 3D del sitio, listos para redes sociales y campañas.'],
    ], 'c2')}
    <div class="strip"><b>Y también la marca:</b> estrategia y posicionamiento · branding e identidad visual · naming y tono de voz · dirección creativa y de arte.</div>
  </div>
  <div class="sec" style="padding-top:34px">
    <div class="k">Para quién trabajamos</div>
    <h1>Marcas que quieren un lugar propio.</h1>
    <div class="rows">
      ${[
        ['Hoteles y resorts', 'Habitaciones, albercas y vistas para explorar antes de reservar.'],
        ['Inmobiliarias y arquitectura', 'Proyectos aún por construir, ya visitables en línea.'],
        ['Marcas de producto', 'Joyería, diseño, moda, tecnología: el producto en la mano, en la pantalla.'],
        ['Turismo y restaurantes', 'Lugares, experiencias y atmósferas que dan ganas de viajar.'],
        ['Eventos y lanzamientos', 'Experiencias digitales temporales que generan expectativa.'],
      ].map(([t, d]) => `<div class="row"><h3>${t}</h3><p>${d}</p></div>`).join('')}
    </div>
  </div>
  ${foot()}
</section>

<!-- 5 · cómo trabajamos, stack tecnológico -->
<section class="p">
  <div class="sec">
    <div class="k">Cómo trabajamos</div>
    <h1>Del brief al lanzamiento.</h1>
    <div class="steps">
      ${[
        ['01 · Semana 1', 'Brief', 'Una llamada para entender marca, objetivos y público.'],
        ['02 · Semana 1–2', 'Concepto', 'Moodboard, narrativa de la experiencia y primeras escenas.'],
        ['03 · Semana 2–3', 'Prototipo', 'Una primera versión 3D navegable para probar desde el inicio.'],
        ['04 · Semana 3–6', 'Desarrollo', 'Sitio completo, probado en computadora, tablet y celular.'],
        ['05 · Lanzamiento', 'En línea', 'Publicación, capacitación y soporte después del lanzamiento.'],
      ].map(([n, t, d]) => `<div class="st"><div class="n">${n}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}
    </div>
    <p class="note"><b>Una vista previa siempre activa:</b> ves crecer tu sitio semana a semana.</p>
  </div>
  <div class="sec" style="padding-top:34px">
    <div class="k">Tecnología</div>
    <h1>Stack tecnológico.</h1>
    ${cards([
      ['Rendering', 'Three.js con WebGPURenderer y fallback a WebGL 2. Materiales PBR y shaders a medida en TSL y GLSL.'],
      ['Framework', 'React Three Fiber y drei sobre Vite, Next.js o Astro con SSR para contenido indexable.'],
      ['Pipeline de assets', 'Blender → glTF 2.0. Geometrías comprimidas con Draco o Meshopt, texturas KTX2 con Basis Universal.'],
      ['Iluminación', 'Lightmaps y AO horneados, HDRI para IBL, tone mapping AgX o ACES, flujo de color lineal.'],
      ['Interacción', 'GSAP ScrollTrigger y Lenis, física con Rapier, raycasting y gestos táctiles nativos.'],
      ['Post-processing', 'Bloom selectivo, depth of field y SMAA en un único pipeline de pases optimizado.'],
    ], 'c3 stack')}
    <p class="note">Cada decisión está pensada para la calidad visual y el rendimiento, también en el celular.</p>
  </div>
  ${foot()}
</section>

<!-- 6 · quiénes somos, contacto y estudio remoto -->
<section class="p">
  <div class="sec">
    <div class="k">Quiénes somos</div>
    <h1>Un núcleo creativo, una red de especialistas.</h1>
    <p class="lead" style="margin-bottom:18px">Alessia Studio diseña marcas y sitios web 3D inmersivos. Para cada proyecto reunimos el talento adecuado, esté donde esté. Tú tienes un solo interlocutor, de principio a fin.</p>
    ${cards([
      ['Dirección creativa y desarrollo 3D', 'Idea, dirección del proyecto y código Three.js.', true],
      ['Artista 3D', 'Modelos, materiales y luces que hacen creíble el producto o el espacio.'],
      ['UI y diseño visual', 'Interfaz, tipografía e identidad visual coherentes con tu marca.'],
      ['Motion y sound design', 'Animaciones y sonidos que dan ritmo y atmósfera a la experiencia.'],
    ], 'c2')}
  </div>
  <div class="band ct fill" style="margin-top:36px">
    <div class="k">Contacto</div>
    <div class="big" style="font-size:40px">Hablemos de tu proyecto.</div>
    <p class="lead" style="max-width:620px">Primera llamada de 30 minutos, sin costo: nos cuentas sobre tu marca y te mostramos lo que podemos construir juntos.</p>
    <div class="cols c2" style="margin-top:22px">
      <div><div class="lab">WhatsApp</div><div class="val">+39 346 175 8562</div></div>
      <div><div class="lab">Correo</div><div class="val">alessiapir@icloud.com</div></div>
    </div>
    <h3 style="margin-top:30px;font-size:17px">Trabajamos con marcas de todo el mundo, sin fronteras ni distancias.</h3>
    <div class="cols c3" style="margin-top:12px;gap:20px">
      <div class="rule"><h3>Cuatro idiomas</h3><p>Español, italiano, inglés y portugués.</p></div>
      <div class="rule"><h3>Tu zona horaria</h3><p>Las llamadas se agendan en tu horario, no en el nuestro.</p></div>
      <div class="rule"><h3>Base: Mérida, México</h3><p>Disponibles también para reuniones en persona.</p></div>
    </div>
    <p class="k" style="margin:18px 0 0">Desde Italia · Con base en México · Trabajamos en todo el mundo</p>
  </div>
  ${foot(true)}
</section>
</body></html>`;
writeFileSync(`${tmp}/deck.html`, html);
await renderPdf(`${tmp}/deck.html`, `${brand}/alessia-studio-presentacion-vertical.pdf`);
console.log('brand/alessia-studio-presentacion-vertical.pdf');
