// Presentazione dei servizi per i clienti, in PDF (16:9, in spagnolo): il problema, la visione, cos'è un
// sito immersivo, benefici, servizi, per chi lavoriamo, il nostro sito, progetti, chi siamo, studio remoto,
// metodo, tecnologia, livelli e prezzi, contatto. Colori del marchio (verde e rosa), font Syne e Inter.
//   node tools/presentation-pdf.mjs [cartella-immagini-del-sito]  ->  brand/alessia-studio-presentacion.pdf
// La cartella facoltativa contiene p0251.png (divani), p0359.png (lucernario), senza testi (?notext).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const brand = `${root}brand`;
const tmp = `${brand}/.build/deck`;
mkdirSync(tmp, { recursive: true });
const V = '#B8F03A', R = '#D4A39C', INK = '#111';
const svg = (f) => readFileSync(`${brand}/logo/${f}.svg`, 'utf8');
const f = (p) => `file://${p}`;
const gallery = JSON.parse(readFileSync(`${root}src/assets/gallery.json`, 'utf8'));

// immagini del sito senza testi (copertina e manifesto); in mancanza, quelle con i testi
const clean = process.argv[2];
const sitePic = async (name, fallback, out) => {
  const src = clean && existsSync(`${clean}/${name}.png`) ? `${clean}/${name}.png` : `${brand}/sito/${fallback}.jpg`;
  await sharp(src).resize(640 * 2, 720 * 2, { fit: 'cover' }).jpeg({ quality: 84, mozjpeg: true }).toFile(`${tmp}/${out}.jpg`);
};
await sitePic('p0251', '02-divani', 'cover');
await sitePic('p0359', '03-vision', 'vision');

const PROJECTS = [
  ['urbaz', 'URBAZ', 'Bienes raíces · Yucatán, México', 'La península de Yucatán en 3D: desarrollos para explorar, búsqueda con filtros y rutas animadas.', '03'],
  ['piedra-de-agua', 'Piedra de Agua', 'Hotel boutique · Mérida, México', 'Del agua al patio: un recorrido inmersivo por las habitaciones del hotel.', '02'],
  ['picheta', 'Picheta', 'Restaurante · Mérida, México', 'La casa se vuelve el sitio: de la entrada a la terraza, con menú, autores y reservas.', '03'],
  ['pusceddu', 'Avv. Pusceddu', 'Despacho de abogados · Cagliari, Italia', 'Un dron recorre un monumento de mármol inspirado en Dante: cada cornisa, un área de práctica.', '02'],
  ['hacienda-teya', 'Hacienda Teya', 'Hacienda y restaurante · Yucatán, México', 'Una espina de henequén borda el nombre sobre el lino; la historia se vuelve recorrido.', '02'],
  ['antica-roma', 'Antica Roma', 'Restaurante · Mérida, México', 'Un avión despega del Coliseo y aterriza en Paseo de Montejo; los platos son los botones.', '01'],
  ['carnal', 'CARNAL', 'Carnicería boutique · Mérida, México', 'Ocho escenas en una sola película con scroll: vitrinas, cortes, el privado y la reserva.', '01'],
  ['il-calabrese', 'Il Calabrese', 'Pizzería · Mérida, México', 'Del cielo de Calabria a la mesa familiar: menú, reservas y mapa son platos que se tocan.', '02'],
];
for (const p of PROJECTS) {
  const n = gallery[p[0]]?.includes(p[4]) ? p[4] : gallery[p[0]]?.[0];
  await sharp(`${root}public/gallery/${p[0]}/${n}-1280.webp`).resize(760).jpeg({ quality: 82, mozjpeg: true }).toFile(`${tmp}/${p[0]}.jpg`);
}

let page = 0;
const foot = (dark = false) => `<div class="foot"><span class="fl">${svg(dark ? 'logo-rosa' : 'logo-verde')}</span><span>Presentación de servicios · 2026</span><span>${++page}</span></div>`;
const cards = (list, cls = 'c3') => `<div class="cols ${cls}">${list.map(([t, d, hi]) => `<div class="card${hi ? ' hi' : ''}"><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>`;

const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Alessia Studio · Presentación de servicios</title><style>
@font-face { font-family: Syne; font-weight: 800; src: url(${f(`${brand}/fonts/Syne-800.ttf`)}); }
@font-face { font-family: Inter; font-weight: 400; src: url(${f(`${brand}/fonts/Inter-400.ttf`)}); }
@font-face { font-family: Inter; font-weight: 500; src: url(${f(`${brand}/fonts/Inter-500.ttf`)}); }
@font-face { font-family: Inter; font-weight: 600; src: url(${f(`${brand}/fonts/Inter-600.ttf`)}); }
@page { size: 1280px 720px; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font: 400 17px/1.55 Inter; color: ${INK}; }
.s { width: 1280px; height: 720px; padding: 60px 72px 74px; background: ${R}; position: relative; overflow: hidden; page-break-after: always; display: flex; flex-direction: column; }
.s.g { background: ${V}; }
.k { font: 600 12px/1.3 Inter; letter-spacing: .22em; text-transform: uppercase; margin-bottom: 14px; }
h1 { font: 800 48px/1.1 Syne; letter-spacing: -.03em; color: ${V}; padding-bottom: .06em; margin-bottom: 22px; }
.g h1 { color: ${INK}; }
h3 { font: 800 20px/1.2 Syne; letter-spacing: -.02em; color: ${V}; padding-bottom: .05em; margin-bottom: 8px; }
.g h3, .card.hi h3 { color: ${INK}; }
.lead { font-size: 20px; line-height: 1.5; max-width: 860px; }
.cols { display: grid; gap: 30px; }
.c2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .c3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.c4 { grid-template-columns: repeat(4, minmax(0, 1fr)); } .c5 { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 22px; }
.rule { border-top: 1.5px solid rgba(0,0,0,.28); padding-top: 14px; }
.card { border: 1.5px solid rgba(0,0,0,.22); border-radius: 14px; padding: 22px 24px; }
.card p { font-size: 15px; line-height: 1.5; }
.card.hi { background: ${V}; border-color: ${V}; }
.cols.tight { gap: 16px; }
.n { font: 600 13px Inter; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 10px; }
.num { font: 600 38px/1 Inter; color: ${V}; margin-bottom: 14px; }
.foot { position: absolute; left: 72px; right: 72px; bottom: 26px; display: flex; align-items: center; gap: 18px; font: 500 10.5px Inter; letter-spacing: .2em; text-transform: uppercase; }
.foot span:nth-child(2) { flex: 1; } .fl svg { height: 11px; width: auto; display: block; }
.split { display: grid; grid-template-columns: 1fr 640px; padding: 0; }
.split .txt { padding: 60px 64px 74px 72px; display: flex; flex-direction: column; }
.split img { width: 640px; height: 720px; object-fit: cover; display: block; }
.split .foot { right: 704px; }
.cover .logo svg { width: 330px; height: auto; display: block; }
.cover .big { margin-top: auto; font-size: 44px; color: ${INK}; margin-bottom: 18px; }
.cover .sub { font-size: 18px; line-height: 1.5; }
.cover .tag { font: 600 12px/1.6 Inter; letter-spacing: .2em; text-transform: uppercase; margin-top: auto; }
.big { font: 800 50px/1.12 Syne; letter-spacing: -.03em; padding-bottom: .06em; margin-bottom: 26px; }
.shots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 26px; margin-top: 8px; }
.shots img { width: 100%; height: 360px; object-fit: cover; object-position: top; border-radius: 10px; display: block; }
.cap { font-size: 13px; margin-top: 8px; }
.proj img { width: 100%; aspect-ratio: 16/10; object-fit: cover; border-radius: 8px; display: block; margin-bottom: 14px; }
.proj .t { font: 800 20px/1.2 Syne; letter-spacing: -.02em; color: ${V}; padding-bottom: .05em; }
.proj .kd { font: 600 10.5px/1.4 Inter; letter-spacing: .12em; text-transform: uppercase; margin: 5px 0 6px; }
.proj p { font-size: 14px; line-height: 1.5; }
.rows .row { display: grid; grid-template-columns: 470px 1fr; gap: 30px; align-items: baseline; padding: 15px 0; border-top: 1.5px solid rgba(0,0,0,.22); }
.rows .row:last-child { border-bottom: 1.5px solid rgba(0,0,0,.22); }
.rows h3 { font-size: 22px; margin: 0; }
.strip { margin-top: 22px; padding-top: 14px; border-top: 1.5px solid rgba(0,0,0,.28); font-size: 15px; }
.strip b { font-weight: 600; }
.price .tier { font: 800 22px Syne; color: ${V}; margin-bottom: 6px; }
.price .hi .tier { color: ${INK}; }
.price .p { font: 600 34px/1.15 Inter; letter-spacing: -.02em; margin-bottom: 14px; }
.price ul { padding-left: 18px; font-size: 15px; line-height: 1.55; }
.note { margin-top: auto; font-size: 13.5px; }
.mail { font: 600 34px/1.2 Inter; letter-spacing: -.01em; }
.ct .lab { font: 600 12px Inter; letter-spacing: .22em; text-transform: uppercase; margin-bottom: 6px; }
/* in Syne i numeri sono "all'antica" per impostazione: qui sempre allineati (3D). In fondo, perché la
   scorciatoia "font" delle regole sopra non la annulli */
.s h1, .s h3, .s .big, .s .t, .s .tier { font-feature-settings: "lnum" 1; font-variant-numeric: lining-nums; }
</style><body>

<section class="s split cover">
  <div class="txt">
    <div class="logo">${svg('logo-verde-2-righe')}</div>
    <div class="big">Sitios que se exploran, no solo se miran.</div>
    <p class="sub">Creamos sitios web 3D inmersivos para marcas que quieren ser recordadas, en cualquier parte del mundo.</p>
    <div class="tag">Branding · Dirección creativa · Sitios web 3D<br>Desde Italia · Con base en México · Trabajamos en todo el mundo</div>
  </div>
  <img src="${f(`${tmp}/cover.jpg`)}">
  ${foot()}
</section>

<section class="s g">
  <div class="k">El problema</div>
  <div class="big" style="font-size:56px;max-width:1040px;margin-top:auto">En internet todos los sitios se parecen. Y lo que se parece, se olvida.</div>
  <p class="lead" style="margin-bottom:auto">Mismas plantillas, mismas fotos, mismo scroll. Tu cliente visita tu sitio, luego el de un competidor, y ya no recuerda cuál era el tuyo.</p>
  ${foot(true)}
</section>

<section class="s split">
  <div class="txt">
    <div class="k">Nuestra visión</div>
    <div class="big" style="color:${V}">Un sitio web puede ser un lugar, no una página.</div>
    <p class="lead">Diseñamos marcas y espacios digitales para recorrer: arquitecturas de luz, materia y movimiento que cuentan una marca como una visita. Cada scroll es un paso; cada detalle está hecho para quedarse.</p>
  </div>
  <img src="${f(`${tmp}/vision.jpg`)}">
  ${foot()}
</section>

<section class="s">
  <div class="k">Sitios inmersivos</div>
  <h1>Qué es un sitio inmersivo.</h1>
  <div class="cols c3" style="margin-top:auto">
    ${[
      ['01', 'Se explora', 'El visitante se mueve dentro de un espacio 3D: entra a una habitación, gira alrededor de un producto, descubre los detalles.'],
      ['02', 'Reacciona', 'Cada gesto tiene respuesta: luces, animaciones y sonidos que siguen el mouse, el scroll o el dedo en el celular.'],
      ['03', 'Se recuerda', 'Una experiencia vivida se queda en la mente más que una página leída. Tu marca se vuelve de la que todos hablan.'],
    ].map(([n, t, d]) => `<div class="card" style="padding:28px"><div class="num">${n}</div><h3 style="font-size:24px">${t}</h3><p style="font-size:16px">${d}</p></div>`).join('')}
  </div>
  ${foot()}
</section>

<section class="s g">
  <div class="k">Por qué funciona</div>
  <h1 style="max-width:1040px">Un sitio que la gente explora es un sitio que la gente recuerda.</h1>
  <div class="cols c4" style="margin-top:auto">
    <div class="rule"><h3>Más tiempo en el sitio</h3><p>Explorar es una invitación a quedarse.</p></div>
    <div class="rule"><h3>Percepción premium</h3><p>El sitio comunica el valor de la marca.</p></div>
    <div class="rule"><h3>Recomendación</h3><p>Las experiencias bonitas se comparten.</p></div>
    <div class="rule"><h3>Funciona en todas partes</h3><p>Carga ligera y calidad que se adapta: celular, tablet y computadora.</p></div>
  </div>
  ${foot(true)}
</section>

<section class="s">
  <div class="k">Qué hacemos</div>
  <h1 style="margin-bottom:26px">Nuestros servicios.</h1>
  <div style="display:grid;grid-template-rows:auto auto;gap:16px">
    ${cards([
      ['Sitios web 3D', 'Sitios completos e inmersivos, del concepto al lanzamiento, rápidos también en el celular.'],
      ['Configuradores 3D', 'Tu cliente elige colores, materiales y variantes del producto y los ve en tiempo real.'],
      ['Recorridos virtuales', 'Hoteles, casas y espacios para visitar en línea antes de reservar o comprar.'],
    ], 'c3 tight')}
    ${cards([
      ['Landings de lanzamiento', 'Páginas de alto impacto para un nuevo producto, una colección o un evento.'],
      ['Modelos 3D', 'Productos, espacios y personajes modelados a medida y optimizados para la web.'],
      ['Motion y contenido', 'Videos y animaciones 3D del sitio, listos para redes sociales y campañas.'],
    ], 'c3 tight')}
  </div>
  <div class="strip"><b>Y también la marca:</b> estrategia y posicionamiento · branding e identidad visual · naming y tono de voz · dirección creativa y de arte.</div>
  ${foot()}
</section>

<section class="s">
  <div class="k">Para quién trabajamos</div>
  <h1>Marcas que quieren un lugar propio.</h1>
  <div class="rows" style="margin-top:auto">
    ${[
      ['Hoteles y resorts', 'Habitaciones, albercas y vistas para explorar antes de reservar.'],
      ['Inmobiliarias y arquitectura', 'Proyectos aún por construir, ya visitables en línea.'],
      ['Marcas de producto', 'Joyería, diseño, moda, tecnología: el producto en la mano, en la pantalla.'],
      ['Turismo y restaurantes', 'Lugares, experiencias y atmósferas que dan ganas de viajar.'],
      ['Eventos y lanzamientos', 'Experiencias digitales temporales que generan expectativa.'],
    ].map(([t, d]) => `<div class="row"><h3>${t}</h3><p>${d}</p></div>`).join('')}
  </div>
  ${foot()}
</section>

<section class="s">
  <div class="k">Nuestro sitio</div>
  <h1 style="margin-bottom:12px">Nuestro propio sitio es un recorrido.</h1>
  <p style="max-width:1000px">Un edificio de cemento rosa sobre el mar: se entra por una ventana circular, se descansa junto a los sofás verdes, se mira la luz del tragaluz y se termina bajo el agua, donde cada burbuja es un proyecto.</p>
  <div class="shots">
    <div><img src="${f(`${brand}/sito/02-divani.jpg`)}"><div class="cap">Los sofás verdes</div></div>
    <div><img src="${f(`${brand}/sito/03-vision.jpg`)}"><div class="cap">Bajo el tragaluz</div></div>
    <div><img src="${f(`${brand}/sito/05-proyectos.jpg`)}"><div class="cap">En el mar: cada burbuja es un proyecto</div></div>
  </div>
  ${foot()}
</section>

${[0, 1].map((k) => `<section class="s">
  <div class="k">Proyectos y propuestas${k ? ' · 2' : ''}</div>
  <h1 style="margin-bottom:${k ? 30 : 12}px">${k ? 'Cada proyecto, un lugar distinto.' : 'Una selección.'}</h1>
  ${k ? '' : '<p style="margin-bottom:22px">Proyectos y propuestas de concepto para marcas de México e Italia: hoteles, restaurantes, bienes raíces, despachos.</p>'}
  <div class="cols c4 proj" style="margin-top:auto;gap:26px">
    ${PROJECTS.slice(k * 4, k * 4 + 4).map(([id, t, kind, text]) => `<div><img src="${f(`${tmp}/${id}.jpg`)}"><div class="t">${t}</div><div class="kd">${kind}</div><p>${text}</p></div>`).join('')}
  </div>
  ${foot()}
</section>`).join('')}

<section class="s">
  <div class="k">Quiénes somos</div>
  <h1 style="margin-bottom:12px">Un núcleo creativo, una red de especialistas.</h1>
  <p class="lead" style="font-size:18px">Alessia Studio diseña marcas y sitios web 3D inmersivos. Para cada proyecto reunimos el talento adecuado, esté donde esté. Tú tienes un solo interlocutor, de principio a fin.</p>
  <div style="margin-top:auto">
    ${cards([
      ['Dirección creativa y desarrollo 3D', 'Idea, dirección del proyecto y código Three.js.', true],
      ['Artista 3D', 'Modelos, materiales y luces que hacen creíble el producto o el espacio.'],
      ['UI y diseño visual', 'Interfaz, tipografía e identidad visual coherentes con tu marca.'],
      ['Motion y sound design', 'Animaciones y sonidos que dan ritmo y atmósfera a la experiencia.'],
    ], 'c4 tight')}
  </div>
  ${foot()}
</section>

<section class="s g">
  <div class="k">Estudio remoto, clientes en todo el mundo</div>
  <h1 style="max-width:1000px">Trabajamos con marcas de todo el mundo, sin fronteras ni distancias.</h1>
  <div class="cols c3" style="margin-top:auto">
    <div class="rule"><h3>Cuatro idiomas</h3><p>Español, italiano, inglés y portugués.</p></div>
    <div class="rule"><h3>Tu zona horaria</h3><p>Las llamadas se agendan en tu horario, no en el nuestro.</p></div>
    <div class="rule"><h3>Base: Mérida, México</h3><p>Disponibles también para reuniones en persona.</p></div>
  </div>
  <p style="margin-top:26px;font:600 12px/1.6 Inter;letter-spacing:.2em;text-transform:uppercase">Desde Italia · Con base en México · Trabajamos en todo el mundo</p>
  ${foot(true)}
</section>

<section class="s">
  <div class="k">Cómo trabajamos</div>
  <h1>Del brief al lanzamiento.</h1>
  <div class="cols c5" style="margin-top:auto">
    ${[
      ['01 · Semana 1', 'Brief', 'Una llamada para entender marca, objetivos y público.'],
      ['02 · Semana 1–2', 'Concepto', 'Moodboard, narrativa de la experiencia y primeras escenas.'],
      ['03 · Semana 2–3', 'Prototipo', 'Una primera versión 3D navegable para probar desde el inicio.'],
      ['04 · Semana 3–6', 'Desarrollo', 'Sitio completo, probado en computadora, tablet y celular.'],
      ['05 · Lanzamiento', 'En línea', 'Publicación, capacitación y soporte después del lanzamiento.'],
    ].map(([n, t, d]) => `<div class="rule"><div class="n">${n}</div><h3>${t}</h3><p style="font-size:15.5px">${d}</p></div>`).join('')}
  </div>
  <p style="margin-top:30px;font-size:18px"><b style="font-weight:600">Una vista previa siempre activa:</b> ves crecer tu sitio semana a semana.</p>
  ${foot()}
</section>

<section class="s">
  <div class="k">Tecnología</div>
  <h1 style="margin-bottom:26px">Stack tecnológico.</h1>
  <div style="display:grid;gap:16px">
    ${cards([
      ['Rendering', 'Three.js con WebGPURenderer y fallback a WebGL 2. Materiales PBR y shaders a medida en TSL y GLSL.'],
      ['Framework', 'React Three Fiber y drei sobre Vite, Next.js o Astro con SSR para contenido indexable.'],
      ['Pipeline de assets', 'Blender → glTF 2.0. Geometrías comprimidas con Draco o Meshopt, texturas KTX2 con Basis Universal.'],
    ], 'c3 tight')}
    ${cards([
      ['Iluminación', 'Lightmaps y AO horneados, HDRI para IBL, tone mapping AgX o ACES, flujo de color lineal.'],
      ['Interacción', 'GSAP ScrollTrigger y Lenis, física con Rapier, raycasting y gestos táctiles nativos.'],
      ['Post-processing', 'Bloom selectivo, depth of field y SMAA en un único pipeline de pases optimizado.'],
    ], 'c3 tight')}
  </div>
  <p class="note" style="font-size:16px">Cada decisión está pensada para la calidad visual y el rendimiento, también en el celular.</p>
  ${foot()}
</section>

<section class="s price">
  <div class="k">Inversión</div>
  <h1 style="margin-bottom:26px">Tres niveles de experiencia.</h1>
  <div class="cols c3 tight" style="margin:auto 0">
    <div class="card" style="padding:26px 28px"><div class="tier">Esencial</div><div class="p">desde US$2,500</div>
      <ul><li>Landing page con una escena 3D</li><li>Animaciones con el scroll</li><li>Optimizada para el celular</li><li>Entrega en 3–4 semanas</li></ul></div>
    <div class="card hi" style="padding:26px 28px"><div class="tier">Inmersivo</div><div class="p">desde US$5,000</div>
      <ul><li>Sitio completo multisección en 3D</li><li>Modelos 3D a medida</li><li>Interacciones y microanimaciones</li><li>Entrega en 5–6 semanas</li></ul></div>
    <div class="card" style="padding:26px 28px"><div class="tier">Signature</div><div class="p">desde US$9,000</div>
      <ul><li>Experiencia 3D explorable</li><li>Configurador o recorrido virtual</li><li>Sound design y shaders únicos</li><li>Contenido en video para redes</li></ul></div>
  </div>
  <p class="note" style="margin-top:0">Precios indicativos en dólares estadounidenses (USD), impuestos no incluidos. Cotización a medida después de la primera llamada.</p>
  ${foot()}
</section>

<section class="s ct">
  <div class="k">Contacto</div>
  <h1 style="font-size:64px">Hablemos de<br>tu proyecto.</h1>
  <p class="lead">Primera llamada de 30 minutos, sin costo: nos cuentas sobre tu marca y te mostramos lo que podemos construir juntos.</p>
  <div class="cols c2" style="margin-top:auto;max-width:980px">
    <div><div class="lab">WhatsApp</div><div class="mail">+39 346 175 8562</div></div>
    <div><div class="lab">Correo</div><div class="mail">alessiapir@icloud.com</div></div>
  </div>
  <p style="margin-top:20px">Desde Italia · Con base en México · Trabajamos en todo el mundo · Español, italiano, inglés y portugués</p>
  ${foot()}
</section>
</body></html>`;
writeFileSync(`${tmp}/deck.html`, html);

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  pw = require(`${execSync('npm root -g').toString().trim()}/playwright`);
}
const browser = await pw.chromium.launch();
const tab = await browser.newPage();
await tab.goto(`file://${tmp}/deck.html`, { waitUntil: 'load' });
await tab.evaluate(() => document.fonts.ready);
await tab.pdf({ path: `${brand}/alessia-studio-presentacion.pdf`, preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log('brand/alessia-studio-presentacion.pdf');
