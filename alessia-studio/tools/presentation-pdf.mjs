// Presentazione dello studio per i clienti, in PDF (16:9, in spagnolo): chi siamo, cosa facciamo, perché
// un sito 3D, metodo, il nostro sito, progetti, come si comincia, contatto. Colori del marchio (verde e
// rosa), font Syne e Inter.
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
const foot = (dark = false) => `<div class="foot${dark ? ' dk' : ''}"><span class="fl">${svg(dark ? 'logo-rosa' : 'logo-verde')}</span><span>Presentación del estudio</span><span>${++page}</span></div>`;

const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Alessia Studio · Presentación del estudio</title><style>
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
h1 { font: 800 50px/1.1 Syne; letter-spacing: -.03em; color: ${V}; padding-bottom: .06em; margin-bottom: 22px; }
.g h1 { color: ${INK}; }
h3 { font: 800 21px/1.2 Syne; letter-spacing: -.02em; color: ${V}; padding-bottom: .05em; margin-bottom: 8px; }
.g h3 { color: ${INK}; }
.lead { font-size: 21px; line-height: 1.5; max-width: 820px; }
.cols { display: grid; gap: 34px; }
.c2 { grid-template-columns: 1fr 1fr; } .c3 { grid-template-columns: repeat(3, 1fr); } .c4 { grid-template-columns: repeat(4, 1fr); }
.c6 { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 22px; }
.rule { border-top: 1.5px solid rgba(0,0,0,.28); padding-top: 14px; }
ul.it { list-style: none; } ul.it li { padding: 7px 0; border-top: 1px solid rgba(0,0,0,.2); font-size: 15.5px; }
.n { font: 600 13px Inter; letter-spacing: .14em; margin-bottom: 10px; }
.foot { position: absolute; left: 72px; right: 72px; bottom: 26px; display: flex; align-items: center; gap: 18px; font: 500 10.5px Inter; letter-spacing: .2em; text-transform: uppercase; }
.foot span:nth-child(2) { flex: 1; } .fl svg { height: 11px; width: auto; display: block; }
.split { display: grid; grid-template-columns: 1fr 640px; padding: 0; }
.split .txt { padding: 60px 64px 74px 72px; display: flex; flex-direction: column; }
.split img { width: 640px; height: 720px; object-fit: cover; display: block; }
.split .foot { right: 704px; }
.cover .logo svg { width: 470px; height: auto; display: block; margin-top: auto; }
.cover .tag { font: 600 13px/1.6 Inter; letter-spacing: .2em; text-transform: uppercase; margin-top: 30px; }
.cover .org { font: 500 15px/1.6 Inter; margin-top: 8px; margin-bottom: auto; }
.big { font: 800 52px/1.12 Syne; letter-spacing: -.03em; padding-bottom: .06em; margin-bottom: 26px; }
.shots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 26px; margin-top: 8px; }
.shots img { width: 100%; height: 360px; object-fit: cover; object-position: top; border-radius: 10px; display: block; }
.cap { font-size: 13px; margin-top: 8px; }
.proj img { width: 100%; aspect-ratio: 16/10; object-fit: cover; border-radius: 8px; display: block; margin-bottom: 14px; }
.proj .t { font: 800 20px/1.2 Syne; letter-spacing: -.02em; color: ${V}; padding-bottom: .05em; }
.proj .kd { font: 600 10.5px/1.4 Inter; letter-spacing: .12em; text-transform: uppercase; margin: 5px 0 6px; }
.proj p { font-size: 14px; line-height: 1.5; }
.mail { font: 800 40px/1.2 Syne; letter-spacing: -.02em; color: ${V}; padding-bottom: .06em; }
</style><body>

<section class="s split cover">
  <div class="txt">
    <div class="logo">${svg('logo-verde-2-righe')}</div>
    <div class="tag">Branding · Dirección creativa · Sitios web 3D</div>
    <div class="org">Desde Italia · Con base en México · Trabajamos en todo el mundo</div>
  </div>
  <img src="${f(`${tmp}/cover.jpg`)}">
  ${foot()}
</section>

<section class="s split g">
  <div class="txt">
    <div class="k">Visión</div>
    <div class="big">Un sitio web puede ser un lugar, no una página.</div>
    <p class="lead">Diseñamos marcas y espacios digitales para recorrer: arquitecturas de luz, materia y movimiento que cuentan una marca como una visita. Cada scroll es un paso; cada detalle está hecho para quedarse.</p>
  </div>
  <img src="${f(`${tmp}/vision.jpg`)}">
  ${foot(true)}
</section>

<section class="s">
  <div class="k">Quiénes somos</div>
  <h1>Un estudio creativo,<br>de Italia al mundo.</h1>
  <p class="lead">Alessia Studio diseña marcas y sitios web 3D inmersivos. Nacimos en Italia, vivimos en México y trabajamos en remoto con marcas de todo el mundo.</p>
  <div class="cols c4" style="margin-top:auto">
    <div class="rule"><h3>Un solo equipo</h3><p>Del concepto a la publicación: estrategia, diseño, desarrollo y contenido.</p></div>
    <div class="rule"><h3>Cuatro idiomas</h3><p>Trabajamos en español, italiano, inglés y portugués.</p></div>
    <div class="rule"><h3>En todo el mundo</h3><p>En remoto, estés donde estés: reuniones en línea y entregas por etapas.</p></div>
    <div class="rule"><h3>Hecho para el celular</h3><p>Sitios ligeros que se adaptan a cada pantalla y a cada dispositivo.</p></div>
  </div>
  ${foot()}
</section>

<section class="s">
  <div class="k">Qué hacemos</div>
  <h1>Marcas, experiencias y contenido.</h1>
  <div class="cols c3" style="margin-top:auto">
    <div><h3>Marca</h3><p style="margin-bottom:12px">La identidad: qué dices y cómo te ves.</p>
      <ul class="it"><li>Estrategia y posicionamiento</li><li>Branding e identidad visual</li><li>Naming y tono de voz</li><li>Dirección creativa y de arte</li></ul></div>
    <div><h3>Digital</h3><p style="margin-bottom:12px">Sitios que se recorren, rápidos también en el celular.</p>
      <ul class="it"><li>Sitios web 3D inmersivos</li><li>Diseño UX/UI</li><li>Showrooms y configuradores 3D</li><li>Desarrollo, publicación y mantenimiento</li></ul></div>
    <div><h3>Contenido</h3><p style="margin-bottom:12px">Imágenes y movimiento para lanzar y comunicar.</p>
      <ul class="it"><li>Renders y animaciones 3D</li><li>Motion design y video</li><li>Contenido para redes sociales</li><li>Campañas y lanzamientos</li></ul></div>
  </div>
  ${foot()}
</section>

<section class="s g">
  <div class="k">Por qué un sitio 3D</div>
  <h1>Una visita se recuerda.<br>Una página se olvida.</h1>
  <div class="cols c4" style="margin-top:auto">
    <div class="rule"><h3>Se recuerda</h3><p>El recorrido hace que tu marca se quede en la memoria de quien la visita.</p></div>
    <div class="rule"><h3>Cuenta una historia</h3><p>Cada scroll es un paso: el contenido aparece en el orden y el momento justos.</p></div>
    <div class="rule"><h3>Te distingue</h3><p>Una experiencia propia, imposible de confundir con una plantilla.</p></div>
    <div class="rule"><h3>Funciona en todas partes</h3><p>Carga ligera y calidad que se adapta: en celular, tablet y computadora.</p></div>
  </div>
  ${foot(true)}
</section>

<section class="s">
  <div class="k">Cómo trabajamos</div>
  <h1>Del concepto a la publicación.</h1>
  <div class="cols c6" style="margin-top:auto">
    ${[
      ['Escuchar', 'Objetivos, público y referencias: entendemos qué necesitas.'],
      ['Concepto', 'La idea y el recorrido: qué se ve, en qué orden y por qué.'],
      ['Diseño', 'Identidad, escenas, materiales y textos.'],
      ['Desarrollo', '3D y web, con pruebas en celular, tablet y computadora.'],
      ['Publicación', 'Puesta en línea y ajustes finales.'],
      ['Seguimiento', 'Mantenimiento, nuevos contenidos y campañas.'],
    ].map(([t, d], i) => `<div class="rule"><div class="n">0${i + 1}</div><h3 style="font-size:15.5px">${t}</h3><p style="font-size:15px">${d}</p></div>`).join('')}
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

<section class="s g">
  <div class="k">Cómo empezamos</div>
  <h1>Tres pasos.</h1>
  <div class="cols c3" style="margin-top:auto">
    <div class="rule"><div class="n">01</div><h3>Nos cuentas tu proyecto</h3><p>Por correo o en una videollamada: qué haces, qué buscas y para cuándo.</p></div>
    <div class="rule"><div class="n">02</div><h3>Te enviamos una propuesta</h3><p>Concepto, alcance, tiempos y presupuesto, a la medida de tu proyecto.</p></div>
    <div class="rule"><div class="n">03</div><h3>Arrancamos</h3><p>Con un calendario claro y entregas por etapas, para que veas el avance.</p></div>
  </div>
  ${foot(true)}
</section>

<section class="s">
  <div class="k">Contacto</div>
  <h1 style="font-size:64px">¿Tienes un lugar<br>que construir?</h1>
  <p class="lead">Marca, sitio web o contenido: cuéntanos tu proyecto, estés donde estés.</p>
  <div style="margin-top:auto">
    <div class="k" style="margin-bottom:6px">Escríbenos</div>
    <div class="mail">alessiapir@icloud.com</div>
    <p style="margin-top:14px">Desde Italia · Con base en México · Trabajamos en todo el mundo · Español, italiano, inglés y portugués</p>
  </div>
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
