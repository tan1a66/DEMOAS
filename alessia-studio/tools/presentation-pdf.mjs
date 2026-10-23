// Presentazione dei servizi in orizzontale (16:9, in spagnolo): segue il percorso del sito. Ogni capitolo
// si apre con una scena del sito a tutta pagina e il testo sopra, come sul sito (muro con la finestra,
// divani, lucernario, fascio di sole, terrazza sul mare, tuffo, luce sott'acqua); in mezzo pagine rosa e
// verdi con i dettagli. Solo Alessia Studio: niente progetti di altri marchi, niente prezzi.
//   node tools/presentation-pdf.mjs [cartella-scene]  ->  brand/alessia-studio-presentacion.pdf
// La cartella contiene le scene senza testi in 16:9 (p0000.png, p0251.png…):
//   node tools/shoot.mjs "http://127.0.0.1:4173/?still" <cartella> --size=1600x900 --q=high --notext \
//     --points=0,0.1,0.251,0.359,0.445,0.555,0.612,0.675
// (niente scene sott'acqua con le bolle)
import { writeFileSync } from 'node:fs';
import { brand, V, R, INK, svg, fileUrl as f, fontFaces, workDir, sitePic, renderPdf } from './lib/presentacion.mjs';

const tmp = workDir('deck');
const clean = process.argv[2];
const IVORY = '#FFF6F2';

// scene del sito (nome dello scatto -> immagine di ripiego con i testi, se manca)
const SCENES = {
  wall: ['p0000', '01-muro'],
  sofa: ['p0251', '02-divani'],
  sky: ['p0359', '03-vision'],
  room: ['p0100', '01-muro'],
  terrace: ['p0612', '01-muro'],
  horizon: ['p0555', '01-muro'],
  skyAlt: ['p0445', '03-vision'],
  sunset: ['p0675', '01-muro'],
};
for (const [id, [shot, fallback]] of Object.entries(SCENES)) await sitePic(clean, shot, fallback, `${tmp}/${id}.jpg`, 1600, 900);
const img = (id) => f(`${tmp}/${id}.jpg`);

let page = 1; // la copertina è la pagina 1, senza numero
const foot = (cls = '', logo = 'logo-verde') => `<div class="foot ${cls}"><span class="fl">${svg(logo)}</span><span>Presentación de servicios · 2026</span><span>${String(++page).padStart(2, '0')}</span></div>`;
const chap = (n, t) => `<div class="chap"><span>${n}</span><span class="ln"></span><span>${t}</span></div>`;

// icone a tratto per i siti "smart"
const ico = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICONS = {
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M11 18.3h2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.7 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.7-3.8-9S9.4 5.6 12 3z"/>',
  chat: '<path d="M4 5h16v10.5H9.5L5 19v-3.5H4z"/><path d="M8 9.5h8M8 12.3h5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/>',
  access: '<circle cx="12" cy="4.6" r="1.9"/><path d="M5 8.6l7 1.5 7-1.5M12 10.1v4.6l-3.2 6.3M12 14.7l3.2 6.3"/>',
  update: '<path d="M20 11.5a8 8 0 1 1-2.4-5.7"/><path d="M20 4.5v5.2h-5.2"/>',
};

const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Alessia Studio · Presentación de servicios</title><style>
${fontFaces()}
@page { size: 1280px 720px; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font: 400 17px/1.55 Inter; color: ${INK}; }
.s { width: 1280px; height: 720px; padding: 58px 72px 76px; background: ${R}; position: relative; overflow: hidden; page-break-after: always; display: flex; flex-direction: column; }
.s.g { background: ${V}; }
.k { font: 600 12px/1.3 Inter; letter-spacing: .22em; text-transform: uppercase; margin-bottom: 14px; }
h1 { font: 800 50px/1.08 Syne; letter-spacing: -.03em; color: ${V}; padding-bottom: .06em; margin-bottom: 20px; }
.g h1 { color: ${INK}; }
h3 { font: 800 21px/1.2 Syne; letter-spacing: -.02em; color: ${V}; padding-bottom: .05em; margin-bottom: 8px; }
.g h3 { color: ${INK}; }
.lead { font-size: 19px; line-height: 1.5; max-width: 820px; }
.cols { display: grid; gap: 26px; }
.c2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .c3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.c4 { grid-template-columns: repeat(4, minmax(0, 1fr)); } .c5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.rule { border-top: 1.5px solid rgba(0,0,0,.28); padding-top: 14px; }
.card { border: 1.5px solid rgba(0,0,0,.22); border-radius: 16px; padding: 24px 26px; }
.card p { font-size: 15px; line-height: 1.5; }
.card.hi { background: ${V}; border-color: ${V}; }
.card.hi h3 { color: ${INK}; }
.n { font: 600 13px Inter; letter-spacing: .14em; text-transform: uppercase; }
.foot { position: absolute; left: 72px; right: 72px; bottom: 28px; display: flex; align-items: center; gap: 18px; font: 500 10.5px Inter; letter-spacing: .2em; text-transform: uppercase; z-index: 3; }
.foot span:nth-child(2) { flex: 1; } .fl svg { height: 11px; width: auto; display: block; }
.foot.ink { color: ${IVORY}; }

/* scene del sito a tutta pagina, con il testo sopra come sul sito */
.scene { padding: 0; color: ${IVORY}; }
.scene .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.shade-l { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(52,22,24,.78) 0%, rgba(52,22,24,.54) 40%, rgba(52,22,24,0) 72%); }
.shade-b { position: absolute; inset: 0; background: linear-gradient(0deg, rgba(52,22,24,.86) 0%, rgba(52,22,24,.56) 40%, rgba(52,22,24,0) 70%); }
.halo { position: absolute; left: 50%; transform: translate(-50%, -50%); background: radial-gradient(closest-side, rgba(48,20,22,.66), rgba(48,20,22,.36) 55%, rgba(48,20,22,0)); }
.box { position: absolute; z-index: 2; }
/* niente text-shadow né drop-shadow: nel PDF diventano riquadri attorno alle scritte; leggibilità dalle sfumature */
.scene .ink, .scene .box { color: ${IVORY}; }
.scene .big { font: 800 54px/1.08 Syne; letter-spacing: -.03em; padding-bottom: .06em; margin-bottom: 18px; }
.scene .lead { color: ${IVORY}; }
.scene .rule { border-top-color: rgba(255,246,242,.55); }
.scene h3 { color: ${IVORY}; }
.scene .hl { color: ${V}; }
.chap { display: flex; align-items: center; gap: 14px; font: 600 12px Inter; letter-spacing: .22em; text-transform: uppercase; margin-bottom: 18px; }
.chap .ln { width: 46px; height: 1.5px; background: currentColor; opacity: .75; }

/* panoramica dei servizi */
.areas { display: grid; grid-template-columns: 1.25fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 18px; flex: 1; }
.areas .card { display: flex; flex-direction: column; }
.areas .card:first-child { grid-row: span 2; justify-content: flex-end; padding: 34px; }
.areas .card:first-child h3 { font-size: 34px; line-height: 1.08; }
.areas .num { font: 600 34px/1 Inter; color: ${V}; margin-bottom: auto; }
.areas .card.hi .num { color: ${INK}; }
.areas .card:first-child .num { font-size: 54px; }
.tags { margin-top: 12px; font-size: 13.5px; line-height: 1.6; }

/* siti smart */
.feat { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 30px 38px; }
.feat svg { width: 30px; height: 30px; fill: none; stroke: ${INK}; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; margin-bottom: 12px; display: block; }
.feat p { font-size: 15.5px; }

/* righe (per chi lavoriamo) */
.rows .row { display: grid; grid-template-columns: 60px 430px 1fr; gap: 24px; align-items: baseline; padding: 15px 0; border-top: 1.5px solid rgba(0,0,0,.22); }
.rows .row:last-child { border-bottom: 1.5px solid rgba(0,0,0,.22); }
.rows h3 { font-size: 23px; margin: 0; }

/* metodo: linea del tempo */
.tl { position: relative; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 26px; padding-top: 34px; }
.tl::before { content: ''; position: absolute; left: 0; right: 0; top: 8px; height: 1.5px; background: rgba(0,0,0,.3); }
.tl .st { position: relative; }
.tl .st::before { content: ''; position: absolute; top: -34px; left: 0; width: 18px; height: 18px; border-radius: 50%; background: ${V}; box-shadow: 0 0 0 5px ${R}; }
.tl .n { margin-bottom: 10px; }
.tl p { font-size: 15.5px; }

/* il nostro sito: collage di tre viste */
.mosaic { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 600px; }
.mosaic img { width: 100%; display: block; border-radius: 14px; object-fit: cover; }
.mosaic img:first-child { grid-column: span 2; aspect-ratio: 16 / 9; }
.mosaic img:not(:first-child) { aspect-ratio: 16 / 9; }
.chap.dk { color: ${INK}; }
.ct .lab { font: 600 12px Inter; letter-spacing: .22em; text-transform: uppercase; margin-bottom: 6px; opacity: .9; }
.ct .val { font: 600 34px/1.2 Inter; letter-spacing: -.01em; }
/* in Syne i numeri sono "all'antica" per impostazione: qui sempre allineati (3D) */
.s h1, .s h3, .s .big { font-feature-settings: "lnum" 1; font-variant-numeric: lining-nums; }
</style><body>

<!-- portada: i divani verdi, ALESSIA STUDIO come alla sosta del sito -->
<section class="s scene">
  <img class="bg" src="${img('sofa')}">
  <div class="halo" style="top:150px;width:1300px;height:430px"></div>
  <div class="box" style="left:0;right:0;top:70px;text-align:center">
    <div style="width:940px;margin:0 auto">${svg('logo-verde').replace('<svg ', '<svg style="width:100%;height:auto;display:block" ')}</div>
    <p class="k" style="margin:26px 0 6px;font-size:13px">Branding · Dirección creativa · Sitios web 3D</p>
    <p class="k" style="margin:0;font-size:11px;opacity:.92">Desde Italia · Con base en México · Trabajamos en todo el mundo</p>
  </div>
  <div class="shade-b" style="background:linear-gradient(0deg, rgba(52,22,24,.8) 0%, rgba(52,22,24,.42) 26%, rgba(52,22,24,0) 46%)"></div>
  <div class="box" style="left:72px;bottom:66px;max-width:760px">
    <div class="big" style="font-size:44px;margin-bottom:12px">Sitios que se exploran, no solo se miran.</div>
    <p class="lead" style="font-size:18px">Creamos sitios web 3D inmersivos para marcas que quieren ser recordadas, en cualquier parte del mundo.</p>
  </div>
  <div class="foot ink"><span></span><span style="text-align:right">Presentación de servicios · 2026</span></div>
</section>

<!-- 01 · il problema: il muro rosa che riempie lo schermo -->
<section class="s scene">
  <img class="bg" src="${img('wall')}">
  <div class="shade-l"></div>
  <div class="box" style="left:72px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center">
    ${chap('01', 'El problema')}
    <div class="big">En internet todos los sitios se parecen.</div>
    <div class="big hl" style="font-size:40px">Y lo que se parece, se olvida.</div>
    <p class="lead" style="font-size:18px">Mismas plantillas, mismas fotos, mismo scroll. Tu cliente visita tu sitio, luego el de un competidor, y ya no recuerda cuál era el tuyo.</p>
  </div>
  ${foot('ink')}
</section>

<!-- 02 · la visione: il lucernario -->
<section class="s scene">
  <img class="bg" src="${img('sky')}">
  <div class="shade-l"></div>
  <div class="box" style="left:72px;top:0;bottom:0;width:600px;display:flex;flex-direction:column;justify-content:center">
    ${chap('02', 'Nuestra visión')}
    <div class="big" style="font-size:58px">Un sitio web puede ser un lugar, no una página.</div>
    <p class="lead" style="font-size:18px">Diseñamos marcas y espacios digitales para recorrer: arquitecturas de luz, materia y movimiento que cuentan una marca como una visita. Cada scroll es un paso; cada detalle está hecho para quedarse.</p>
  </div>
  ${foot('ink')}
</section>

<!-- qué hacemos: le quattro aree, il 3D per primo -->
<section class="s">
  <div class="k">Qué hacemos</div>
  <h1>Del 3D inmersivo a la página que trabaja por ti.</h1>
  <div class="areas" style="margin-top:6px">
    <div class="card hi">
      <div class="num">01</div>
      <h3>Experiencias web 3D inmersivas · UX/UI</h3>
      <p style="font-size:16px;max-width:420px">Sitios que se recorren como un lugar: escenas 3D, interacción y un diseño de interfaz pensado para que todo se entienda y se use.</p>
      <p class="tags">Sitios web 3D · Diseño UX/UI · Configuradores · Recorridos virtuales · Landings de lanzamiento · Modelos 3D</p>
    </div>
    <div class="card"><div class="num">02</div><h3>Sitios y páginas inteligentes</h3><p>Rápidos, en varios idiomas y con contacto directo: páginas claras que convierten visitas en clientes.</p></div>
    <div class="card"><div class="num">03</div><h3>Marca y dirección creativa</h3><p>Estrategia, identidad visual, naming y tono de voz: qué dices y cómo te ves.</p></div>
    <div class="card"><div class="num">04</div><h3>Contenido</h3><p>Renders, motion design y video para lanzar y comunicar en redes y campañas.</p></div>
    <div class="card" style="border-style:dashed"><div class="num" style="font-size:13px;letter-spacing:.16em">UN SOLO EQUIPO</div><p>Del concepto a la publicación: un solo interlocutor, de principio a fin.</p></div>
  </div>
  ${foot()}
</section>

<!-- 03 · esperienze immersive: dentro la casa, il pit e il mare in fondo -->
<section class="s scene">
  <img class="bg" src="${img('room')}">
  <div class="shade-l"></div>
  <div class="box" style="left:72px;top:0;bottom:0;width:470px;display:flex;flex-direction:column;justify-content:center">
    ${chap('03', 'Experiencias inmersivas')}
    <div class="big" style="font-size:48px">Qué es un sitio inmersivo.</div>
    <div class="rule" style="margin-top:6px"><h3>Se explora</h3><p style="font-size:15px">El visitante se mueve dentro de un espacio 3D: entra a una habitación, gira alrededor de un producto, descubre los detalles.</p></div>
    <div class="rule" style="margin-top:14px"><h3>Reacciona</h3><p style="font-size:15px">Cada gesto tiene respuesta: luces, animaciones y sonidos que siguen el mouse, el scroll o el dedo en el celular.</p></div>
    <div class="rule" style="margin-top:14px"><h3>Se recuerda</h3><p style="font-size:15px">Una experiencia vivida se queda en la mente más que una página leída. Tu marca se vuelve de la que todos hablan.</p></div>
  </div>
  ${foot('ink')}
</section>

<!-- servizi 3D e UX/UI -->
<section class="s">
  <div class="k">Experiencias web 3D · UX/UI</div>
  <h1 style="margin-bottom:28px">Nuestros servicios inmersivos.</h1>
  <div class="cols c3" style="gap:18px;margin-top:auto">
    ${[
      ['Sitios web 3D', 'Sitios completos e inmersivos, del concepto al lanzamiento, rápidos también en el celular.', true],
      ['Diseño UX/UI', 'Recorridos, interfaces y prototipos: cada pantalla pensada para entenderse y usarse.'],
      ['Configuradores 3D', 'Tu cliente elige colores, materiales y variantes del producto y los ve en tiempo real.'],
      ['Recorridos virtuales', 'Hoteles, casas y espacios para visitar en línea antes de reservar o comprar.'],
      ['Landings de lanzamiento', 'Páginas de alto impacto para un nuevo producto, una colección o un evento.'],
      ['Modelos 3D', 'Productos, espacios y personajes modelados a medida y optimizados para la web.'],
    ].map(([t, d, hi]) => `<div class="card${hi ? ' hi' : ''}" style="min-height:178px"><h3>${t}</h3><p>${d}</p></div>`).join('')}
  </div>
  ${foot()}
</section>

<!-- siti e pagine smart -->
<section class="s g">
  <div class="k">Sitios y páginas inteligentes</div>
  <h1 style="margin-bottom:14px">Páginas que trabajan por ti.</h1>
  <p class="lead" style="font-size:18px">No todo tiene que ser 3D: diseñamos y desarrollamos sitios web y landing pages claros, rápidos y pensados para convertir visitas en clientes.</p>
  <div class="feat" style="margin-top:auto">
    ${[
      ['phone', 'Rápidos en el celular', 'Carga ligera y diseño pensado primero para la pantalla del teléfono.'],
      ['globe', 'En varios idiomas', 'Español, italiano, inglés y portugués: el visitante elige.'],
      ['chat', 'Contacto directo', 'WhatsApp, formularios y reservas que llegan directo a ti.'],
      ['search', 'Encontrables en Google', 'Contenido indexable y una estructura clara para los buscadores.'],
      ['access', 'Accesibles', 'Texto real, legible por lectores de pantalla y navegable con el teclado.'],
      ['update', 'Siempre al día', 'Publicación, mantenimiento y nuevos contenidos cuando los necesites.'],
    ].map(([i, t, d]) => `<div>${ico(ICONS[i])}<h3>${t}</h3><p>${d}</p></div>`).join('')}
  </div>
  ${foot('', 'logo-rosa')}
</section>

<!-- marca e contenuti -->
<section class="s">
  <div class="k">Marca y contenido</div>
  <h1>Una identidad que se reconoce en todas partes.</h1>
  <div class="cols c2" style="margin-top:auto;gap:44px">
    <div>
      <h3 style="font-size:26px">Marca y dirección creativa</h3>
      <p style="margin-bottom:14px">La identidad: qué dices y cómo te ves.</p>
      ${['Estrategia y posicionamiento', 'Branding e identidad visual', 'Naming y tono de voz', 'Dirección creativa y de arte'].map((t, i) => `<div class="rule" style="margin-top:${i ? 10 : 0}px"><p>${t}</p></div>`).join('')}
    </div>
    <div>
      <h3 style="font-size:26px">Contenido</h3>
      <p style="margin-bottom:14px">Imágenes y movimiento para lanzar y comunicar.</p>
      ${['Renders y animaciones 3D', 'Motion design y video: animaciones 3D del sitio, listas para redes y campañas', 'Contenido para redes sociales', 'Campañas y lanzamientos'].map((t, i) => `<div class="rule" style="margin-top:${i ? 10 : 0}px"><p>${t}</p></div>`).join('')}
    </div>
  </div>
  ${foot()}
</section>

<!-- 04 · perché funziona: la terrazza sul mare -->
<section class="s scene">
  <img class="bg" src="${img('terrace')}">
  <div class="shade-b"></div>
  <div class="box" style="left:72px;right:72px;bottom:74px">
    ${chap('04', 'Por qué funciona')}
    <div class="big" style="max-width:980px">Un sitio que la gente explora es un sitio que la gente recuerda.</div>
    <div class="cols c4" style="margin-top:10px">
      <div class="rule"><h3>Más tiempo en el sitio</h3><p style="font-size:15px">Explorar es una invitación a quedarse.</p></div>
      <div class="rule"><h3>Percepción premium</h3><p style="font-size:15px">El sitio comunica el valor de la marca.</p></div>
      <div class="rule"><h3>Recomendación</h3><p style="font-size:15px">Las experiencias bonitas se comparten.</p></div>
      <div class="rule"><h3>Funciona en todas partes</h3><p style="font-size:15px">Carga ligera y calidad que se adapta a cada dispositivo.</p></div>
    </div>
  </div>
  ${foot('ink')}
</section>

<!-- per chi lavoriamo -->
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
    ].map(([t, d], i) => `<div class="row"><span class="n">0${i + 1}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}
  </div>
  ${foot()}
</section>

<!-- 05 · il nostro sito: tre viste del percorso -->
<section class="s" style="flex-direction:row;align-items:center;gap:48px">
  <div style="flex:1">
    <div class="chap dk">${'<span>05</span><span class="ln"></span><span>Nuestro sitio</span>'}</div>
    <h1 style="font-size:44px">Nuestro propio sitio es un recorrido.</h1>
    <p style="font-size:16.5px;margin-bottom:18px">Un edificio de cemento rosa sobre el mar: se entra por una ventana circular, se descansa junto a los sofás verdes, se mira la luz del tragaluz y se termina bajo el agua.</p>
    <div class="cols c2" style="gap:10px 24px">
      ${[
        'Recorrido 3D guiado: cada gesto lleva a la siguiente parada',
        'Cuatro idiomas, que el visitante elige',
        'WhatsApp siempre a la mano',
        'La escena sigue el mouse y el movimiento del celular',
        'Primera carga ligera, también en el celular',
        'Calidad que se adapta a cada dispositivo',
      ].map((t) => `<div class="rule" style="padding-top:8px"><p style="font-size:13.5px">${t}</p></div>`).join('')}
    </div>
  </div>
  <div class="mosaic">
    <img src="${img('room')}"><img src="${img('wall')}"><img src="${img('skyAlt')}">
  </div>
  ${foot()}
</section>

<!-- metodo -->
<section class="s">
  <div class="k">Cómo trabajamos</div>
  <h1>Del brief al lanzamiento.</h1>
  <p class="lead" style="font-size:18px"><b style="font-weight:600">Una vista previa siempre activa:</b> ves crecer tu sitio semana a semana.</p>
  <div class="tl" style="margin-top:auto">
    ${[
      ['Semana 1', 'Brief', 'Una llamada para entender marca, objetivos y público.'],
      ['Semana 1–2', 'Concepto', 'Moodboard, narrativa de la experiencia y primeras escenas.'],
      ['Semana 2–3', 'Prototipo', 'Una primera versión 3D navegable para probar desde el inicio.'],
      ['Semana 3–6', 'Desarrollo', 'Sitio completo, probado en computadora, tablet y celular.'],
      ['Lanzamiento', 'En línea', 'Publicación, capacitación y soporte después del lanzamiento.'],
    ].map(([n, t, d], i) => `<div class="st"><div class="n">0${i + 1} · ${n}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}
  </div>
  ${foot()}
</section>

<!-- chi siamo -->
<section class="s">
  <div class="k">Quiénes somos</div>
  <h1 style="margin-bottom:12px">Un núcleo creativo, una red de especialistas.</h1>
  <p class="lead" style="font-size:18px">Alessia Studio diseña marcas y sitios web 3D inmersivos. Para cada proyecto reunimos el talento adecuado, esté donde esté. Tú tienes un solo interlocutor, de principio a fin.</p>
  <div class="cols c4" style="margin-top:auto;gap:16px">
    ${[
      ['Dirección creativa y desarrollo 3D', 'Idea, dirección del proyecto y código Three.js.', true],
      ['Artista 3D', 'Modelos, materiales y luces que hacen creíble el producto o el espacio.'],
      ['UI y diseño visual', 'Interfaz, tipografía e identidad visual coherentes con tu marca.'],
      ['Motion y sound design', 'Animaciones y sonidos que dan ritmo y atmósfera a la experiencia.'],
    ].map(([t, d, hi]) => `<div class="card${hi ? ' hi' : ''}" style="min-height:210px;display:flex;flex-direction:column;justify-content:flex-end"><h3>${t}</h3><p>${d}</p></div>`).join('')}
  </div>
  ${foot()}
</section>

<!-- 06 · studio remoto: l'orizzonte -->
<section class="s scene">
  <img class="bg" src="${img('horizon')}">
  <div class="shade-b" style="background:linear-gradient(0deg, rgba(52,22,24,.86) 0%, rgba(52,22,24,.64) 42%, rgba(52,22,24,.3) 66%, rgba(52,22,24,0) 84%)"></div>
  <div class="box" style="left:72px;right:72px;bottom:74px">
    ${chap('06', 'Estudio remoto, clientes en todo el mundo')}
    <div class="big" style="max-width:1080px;font-size:48px">Trabajamos con marcas de todo el mundo, sin fronteras ni distancias.</div>
    <div class="cols c3" style="margin-top:10px;gap:34px">
      <div class="rule"><h3>Cuatro idiomas</h3><p style="font-size:15px">Español, italiano, inglés y portugués.</p></div>
      <div class="rule"><h3>Tu zona horaria</h3><p style="font-size:15px">Las llamadas se agendan en tu horario, no en el nuestro.</p></div>
      <div class="rule"><h3>Base: Mérida, México</h3><p style="font-size:15px">Disponibles también para reuniones en persona.</p></div>
    </div>
  </div>
  ${foot('ink')}
</section>

<!-- tecnologia -->
<section class="s">
  <div class="k">Tecnología</div>
  <h1 style="margin-bottom:26px">Stack tecnológico.</h1>
  <div class="cols c3" style="gap:16px">
    ${[
      ['Rendering', 'Three.js con WebGPURenderer y fallback a WebGL 2. Materiales PBR y shaders a medida en TSL y GLSL.'],
      ['Framework', 'React Three Fiber y drei sobre Vite, Next.js o Astro con SSR para contenido indexable.'],
      ['Pipeline de assets', 'Blender → glTF 2.0. Geometrías comprimidas con Draco o Meshopt, texturas KTX2 con Basis Universal.'],
      ['Iluminación', 'Lightmaps y AO horneados, HDRI para IBL, tone mapping AgX o ACES, flujo de color lineal.'],
      ['Interacción', 'GSAP ScrollTrigger y Lenis, física con Rapier, raycasting y gestos táctiles nativos.'],
      ['Post-processing', 'Bloom selectivo, depth of field y SMAA en un único pipeline de pases optimizado.'],
    ].map(([t, d]) => `<div class="card" style="padding:20px 24px"><h3>${t}</h3><p>${d}</p></div>`).join('')}
  </div>
  <p style="margin-top:auto;font-size:16px">Cada decisión está pensada para la calidad visual y el rendimiento, también en el celular.</p>
  ${foot()}
</section>

<!-- contatto: il tramonto sulla terrazza -->
<section class="s scene ct">
  <img class="bg" src="${img('sunset')}">
  <div class="shade-l"></div>
  <div class="shade-b" style="opacity:.7"></div>
  <div class="box" style="left:72px;top:0;bottom:0;width:820px;display:flex;flex-direction:column;justify-content:center">
    ${chap('07', 'Contacto')}
    <div class="big" style="font-size:72px;margin-bottom:16px">Hablemos de<br>tu proyecto.</div>
    <p class="lead" style="font-size:19px;max-width:640px">Primera llamada de 30 minutos, sin costo: nos cuentas sobre tu marca y te mostramos lo que podemos construir juntos.</p>
    <div style="margin-top:32px">
      <div class="lab">Escríbenos por WhatsApp</div><div class="val hl" style="font-size:54px">+39 346 175 8562</div>
    </div>
    <p class="k" style="margin:30px 0 0">Desde Italia · Con base en México · Trabajamos en todo el mundo</p>
  </div>
  ${foot('ink')}
</section>
</body></html>`;
writeFileSync(`${tmp}/deck.html`, html);
await renderPdf(`${tmp}/deck.html`, `${brand}/alessia-studio-presentacion.pdf`);
console.log('brand/alessia-studio-presentacion.pdf');
