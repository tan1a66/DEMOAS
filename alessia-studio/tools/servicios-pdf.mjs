// Catalogo dei servizi da mandare ai clienti: 4 pagine 1080x1350 (4:5), in spagnolo.
//   node tools/servicios-pdf.mjs [uscita.pdf]   (predefinito: brand/Alessia-Studio-Servicios.pdf)
// Sfondo verde neon, titoli e nomi dei servizi in Syne ExtraBold rosa antico, testi in Inter rosa scuro;
// i prezzi in Inter ExtraBold (in Syne lo zero sembra una "o"). Font da brand/fonts, incorporati nel PDF.
// Prima di stampare controlla nel browser che nessun testo esca dai margini, venga tagliato o si
// sovrapponga al prezzo; i titoli e i nomi troppo lunghi rimpiccioliscono (tutti insieme, per gruppo).
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = process.argv[2] || `${root}brand/Alessia-Studio-Servicios.pdf`;
const tmp = `${root}tools/.cache/servicios`;
mkdirSync(tmp, { recursive: true });
const font = (f) => `file://${root}brand/fonts/${f}.ttf`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// nei testi in Syne le cifre vanno in Inter: in Syne sono "all'antica" (più basse, lo 0 sembra una o)
const syne = (s) => esc(s).replace(/\d+/g, '<span class="fig">$&</span>');

const C = { verde: '#C5EE5E', rosa: '#CCA59D', scuro: '#7D514B' };

// titoli su due righe (il testo resta quello del catalogo)
const SERVICES = [
  {
    label: '01 · MARCA Y ESTRATEGIA',
    title: ['MARCA Y', 'APERTURA.'],
    phrase: 'Para que tu negocio abra con una imagen clara y lista para comunicar.',
    priceLabel: 'DESDE · PAGO ÚNICO',
    price: '$12,000',
    items: [
      ['ANÁLISIS Y POSICIONAMIENTO', 'Tu competencia, tu cliente ideal y por qué te van a elegir.'],
      ['TONO DE VOZ', 'Cómo habla tu marca en cada mensaje.'],
      ['NAMING Y SLOGAN', 'Un nombre y una frase que se recuerdan.'],
      ['LOGOTIPO', 'Diseño original con todas sus versiones.'],
      ['COLORES Y TIPOGRAFÍAS', 'La paleta y las letras de tu marca.'],
      ['MANUAL DE MARCA', 'Las reglas para usar tu identidad siempre bien.'],
      ['MENÚ Y LETRERO', 'El menú y la imagen exterior de tu local.'],
      ['EMPAQUE Y PAPELERÍA', 'Bolsas, etiquetas y tarjetas.'],
      ['KIT PARA REDES', 'Perfil, portadas y plantillas de publicaciones.'],
      ['LANZAMIENTO', 'Concepto, promociones e inauguración.'],
    ],
  },
  {
    label: '02 · SITIOS WEB',
    title: ['SITIOS', 'WEB.'],
    phrase: 'Sitios rápidos, pensados para celular y diseñados para que te recuerden.',
    priceLabel: 'DESDE · PAGO ÚNICO',
    price: '$20,000',
    items: [
      ['SITIO WEB A MEDIDA', 'Diseño y desarrollo de tu sitio, sección por sección.'],
      ['LANDING PAGE', 'Una sola página para una oferta o un lanzamiento.'],
      ['SITIOS 3D E INMERSIVOS', 'Experiencias que se recorren con el scroll y no se olvidan.'],
      ['CONFIGURADORES 3D', 'Tus productos en 3D, para verlos y personalizarlos.'],
      ['ECOMMERCE', 'Tu tienda en línea, lista para vender.'],
      ['SEO Y GEO', 'Para que te encuentren en Google y en la IA.'],
    ],
  },
  {
    label: '03 · REDES SOCIALES',
    title: ['REDES', 'SOCIALES.'],
    phrase: 'Tu marca presente todos los meses, con una estrategia detrás.',
    priceLabel: 'DESDE · AL MES',
    price: '$7,000',
    items: [
      ['ESTRATEGIA DE CONTENIDO', 'Qué publicar, para quién y con qué objetivo.'],
      ['CALENDARIO MENSUAL', 'La planificación de todas tus publicaciones.'],
      ['DISEÑO DE PUBLICACIONES', 'Posts, carruseles e historias con tu identidad.'],
      ['EDICIÓN DE VIDEO', 'Reels y videos cortos listos para publicar.'],
      ['RENDERS Y MOTION', 'Imágenes 3D y animaciones que te hacen destacar.'],
      ['REPORTE DE RESULTADOS', 'Qué funcionó y qué mejorar cada mes.'],
    ],
  },
];
const STEPS = {
  label: 'CÓMO TRABAJAMOS',
  title: ['EN 5', 'PASOS.'],
  steps: [
    ['01', 'PLATICAMOS', 'Una videollamada para entender tu proyecto.'],
    ['02', 'PROPUESTA', 'Qué incluye, tiempos y precio cerrado.'],
    ['03', 'ARRANCAMOS', 'Con el 50% de anticipo empezamos a diseñar.'],
    ['04', 'REVISAMOS', 'Ajustamos juntos hasta que quede como lo imaginas.'],
    ['05', 'ENTREGAMOS', 'Con el 50% restante recibes todo tu proyecto.'],
  ],
  cta: '¿EMPEZAMOS?',
  contacts: [['Instagram', '@aless1astudio'], ['WhatsApp', '+39 346 175 8562']],
  note: 'Precios en pesos mexicanos. Cada proyecto se cotiza a la medida.',
};

const top = `<header class="top"><span class="logo">ALESSIA STUDIO</span><span class="tag">SERVICIOS 2026</span></header>`;
const foot = (n) => `<footer class="foot"><span class="url">www.alessia.studio</span><span class="tag">${String(n).padStart(2, '0')}</span></footer>`;
const title = (rows) => `<h1 class="title fit" data-fit="title">${rows.map(syne).join('<br>')}</h1>`;

const servicePage = (s, n) => `<section class="page">
  ${top}
  <div class="head">
    <p class="label">${esc(s.label)}</p>
    ${title(s.title)}
    <p class="phrase">${esc(s.phrase)}</p>
    <div class="price">
      <p class="label">${esc(s.priceLabel)}</p>
      <p class="amount">${esc(s.price)}</p>
    </div>
  </div>
  <div class="grid">
    ${s.items.map(([name, desc]) => `<article class="item"><h2 class="name fit wrap" data-fit="name">${syne(name)}</h2><p class="desc">${esc(desc)}</p></article>`).join('\n    ')}
  </div>
  ${foot(n)}
</section>`;

const stepsPage = (s, n) => `<section class="page">
  ${top}
  <div class="head">
    <p class="label">${esc(s.label)}</p>
    ${title(s.title)}
  </div>
  <ol class="steps">
    ${s.steps.map(([num, name, desc]) => `<li class="step"><span class="num">${num}</span><div><h2 class="name fit" data-fit="step">${syne(name)}</h2><p class="desc">${esc(desc)}</p></div></li>`).join('\n    ')}
  </ol>
  <div class="close">
    <p class="cta fit" data-fit="cta">${syne(s.cta)}</p>
    <div class="contacts">${s.contacts.map(([k, v]) => `<p><span class="k">${esc(k)}</span> <span class="v">${esc(v)}</span></p>`).join('')}</div>
  </div>
  <p class="note">${esc(s.note)}</p>
  ${foot(n)}
</section>`;

const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Alessia Studio · Servicios 2026</title><style>
@font-face { font-family: Syne; font-weight: 800; src: url(${font('Syne-800')}); }
@font-face { font-family: Inter; font-weight: 400; src: url(${font('Inter-400')}); }
@font-face { font-family: Inter; font-weight: 500; src: url(${font('Inter-500')}); }
@font-face { font-family: Inter; font-weight: 600; src: url(${font('Inter-600')}); }
@font-face { font-family: Inter; font-weight: 800; src: url(${font('Inter-800')}); }
@page { size: 1080px 1350px; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { background: ${C.verde}; color: ${C.scuro}; font: 400 21px/1.42 Inter; }
.page { width: 1080px; height: 1350px; padding: 80px 88px 64px; background: ${C.verde}; display: flex; flex-direction: column; overflow: hidden; break-after: page; }
.page:last-child { break-after: auto; }
/* Syne: maiuscolo, spaziatura -3,5%, rosa antico */
.logo, .title, .name, .cta { font-family: Syne; font-weight: 800; text-transform: uppercase; letter-spacing: -0.035em; color: ${C.rosa}; }
/* etichette piccole in maiuscolo, spaziatura larga */
.tag, .label, .url { font: 600 15px/1 Inter; letter-spacing: 0.22em; text-transform: uppercase; color: ${C.scuro}; }
.url { text-transform: none; letter-spacing: 0.08em; }
.fig { font-family: Inter; font-weight: 800; letter-spacing: -0.02em; }
.fit { white-space: nowrap; }
.fit.wrap { white-space: normal; }

/* righe alte quanto le lettere (accenti compresi): in alto e in fondo stanno dentro i margini */
.top { display: flex; justify-content: space-between; align-items: baseline; }
.logo { font-size: 32px; line-height: 1.3; }
.top .tag, .foot .tag, .foot .url { line-height: 1.3; }

/* intestazione: etichetta e titolo su tutta la larghezza; sotto la frase a sinistra e il prezzo a destra,
   allineati in basso */
.head { margin-top: 64px; display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 56px; }
.head > .label, .head > .title { grid-column: 1 / -1; }
.head > .label { margin-bottom: 26px; }
.title { font-size: 88px; line-height: 1; }
.phrase { grid-column: 1; align-self: end; margin-top: 40px; font-size: 24px; line-height: 1.4; }
.price { grid-column: 2; align-self: end; margin-top: 40px; text-align: right; }
.amount { margin-top: 14px; font: 800 80px/0.92 Inter; letter-spacing: -0.03em; color: ${C.scuro}; font-variant-numeric: lining-nums; }

.grid { margin-top: 56px; display: grid; grid-template-columns: 1fr 1fr; column-gap: 56px; row-gap: 26px; }
.item { border-top: 3px solid ${C.rosa}; padding-top: 16px; min-width: 0; }
.name { font-size: 26px; line-height: 1.08; }
.desc { margin-top: 8px; font-size: 20px; line-height: 1.4; }

.steps { list-style: none; margin-top: 56px; }
.step { display: grid; grid-template-columns: 96px 1fr; border-top: 3px solid ${C.rosa}; padding: 16px 0 18px; }
.step > div { min-width: 0; }
.num { font: 600 22px/1.45 Inter; letter-spacing: 0.08em; color: ${C.rosa}; }
.step .name { font-size: 36px; line-height: 1; }
.step .desc { margin-top: 8px; font-size: 21px; }

.close { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; gap: 48px; border-top: 3px solid ${C.rosa}; padding-top: 30px; }
.cta { flex: 1 1 auto; min-width: 0; font-size: 96px; line-height: 0.95; }
.contacts { flex: 0 0 auto; text-align: right; }
.contacts p + p { margin-top: 16px; }
.contacts .k { display: block; font: 600 14px/1 Inter; letter-spacing: 0.22em; text-transform: uppercase; margin-bottom: 8px; }
.contacts .v { display: block; font: 600 24px/1.2 Inter; }
.note { margin-top: 28px; font: 400 16px/1.4 Inter; }
.foot { margin-top: auto; padding-top: 32px; display: flex; justify-content: space-between; align-items: baseline; }
.page:last-child .foot { margin-top: 0; }
</style>
<body>
${SERVICES.map((s, i) => servicePage(s, i + 1)).join('\n')}
${stepsPage(STEPS, 4)}
</body></html>`;
writeFileSync(`${tmp}/servicios.html`, html);

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  pw = require(`${execSync('npm root -g').toString().trim()}/playwright`);
}
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
await page.emulateMedia({ media: 'print' });
await page.goto(`file://${tmp}/servicios.html`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const missing = await page.evaluate(() => ['800 20px Syne', '400 20px Inter', '500 20px Inter', '600 20px Inter', '800 20px Inter'].filter((f) => !document.fonts.check(f)));
if (missing.length) throw new Error(`font non caricati: ${missing.join(', ')}`);

// rimpicciolisce ogni gruppo (titoli, nomi dei servizi, passi, invito) finché il testo più lungo del
// gruppo sta nel suo spazio; poi tutto il gruppo prende quella dimensione. I nomi dei servizi possono
// andare su due righe (a corpo 17 su una riga sola sarebbero più piccoli delle descrizioni): si
// rimpiccioliscono solo se una parola non ci sta o servirebbero più di due righe
const sizes = await page.evaluate(() => {
  const spread = () => document.querySelectorAll('.grid').forEach((g) => {
    // pagine con meno servizi: le righe si allargano un po' (al massimo 72 px), invece di lasciare
    // tutto il vuoto in fondo
    const pg = g.closest('.page'), foot = pg.querySelector('.foot');
    const rows = Math.ceil(g.children.length / 2);
    const free = foot.getBoundingClientRect().top - 48 - g.getBoundingClientRect().bottom;
    const gap = parseFloat(getComputedStyle(g).rowGap);
    if (free > 0 && rows > 1) g.style.rowGap = `${Math.min(72, gap + free / rows)}px`;
  });
  const groups = {};
  for (const el of document.querySelectorAll('[data-fit]')) (groups[el.dataset.fit] ||= []).push(el);
  const result = {};
  for (const [g, els] of Object.entries(groups)) {
    let size = Math.min(...els.map((el) => {
      let s = parseFloat(getComputedStyle(el).fontSize);
      const tooBig = () => el.scrollWidth > el.clientWidth + 0.5 || (el.classList.contains('wrap') && el.getClientRects().length && el.offsetHeight > 2.2 * s * parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize));
      while (tooBig() && s > 8) el.style.fontSize = `${(s -= 0.5)}px`;
      return s;
    }));
    els.forEach((el) => (el.style.fontSize = `${size}px`));
    result[g] = size;
  }
  spread();
  result.rowGap = [...document.querySelectorAll('.grid')].map((g) => parseFloat(g.style.rowGap) || 26);
  return result;
});

// controlli: tutto dentro i margini, niente testo tagliato, niente sovrapposizioni tra blocchi vicini
const problems = await page.evaluate(() => {
  const out = [];
  const M = { top: 80, right: 1080 - 88, bottom: 1350 - 64, left: 88 };
  document.querySelectorAll('.page').forEach((pg, i) => {
    const o = pg.getBoundingClientRect();
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { l: r.left - o.left, t: r.top - o.top, r: r.right - o.left, b: r.bottom - o.top };
    };
    // il riquadro dell'inchiostro del testo, non della riga (le righe di Syne sono più alte delle lettere)
    const ink = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rs = [...range.getClientRects()];
      return rs.reduce((a, r) => ({ l: Math.min(a.l, r.left - o.left), t: Math.min(a.t, r.top - o.top), r: Math.max(a.r, r.right - o.left), b: Math.max(a.b, r.bottom - o.top) }), { l: 1e9, t: 1e9, r: -1e9, b: -1e9 });
    };
    const texts = pg.querySelectorAll('.logo, .tag, .url, .label, .title, .phrase, .amount, .name, .desc, .num, .cta, .contacts p, .note');
    for (const el of texts) {
      const b = ink(el);
      const what = `pagina ${i + 1}: "${el.textContent.trim().slice(0, 40)}"`;
      if (b.l < M.left - 0.5 || b.r > M.right + 0.5 || b.t < M.top - 0.5 || b.b > M.bottom + 0.5) out.push(`${what} esce dai margini (${b.l.toFixed(0)},${b.t.toFixed(0)} - ${b.r.toFixed(0)},${b.b.toFixed(0)})`);
      if (el.scrollWidth > el.clientWidth + 0.5) out.push(`${what} è tagliato (${el.scrollWidth} > ${el.clientWidth})`);
    }
    const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const pairs = [['.title', '.price'], ['.phrase', '.price'], ['.cta', '.contacts'], ['.head', '.grid'], ['.head', '.steps'], ['.steps', '.close'], ['.close', '.note'], ['.note', '.foot'], ['.grid', '.foot']];
    for (const [a, b] of pairs) {
      const ea = pg.querySelector(a), eb = pg.querySelector(b);
      if (ea && eb && hit(box(ea), box(eb))) out.push(`pagina ${i + 1}: ${a} si sovrappone a ${b}`);
    }
    const items = [...pg.querySelectorAll('.item, .step')];
    items.forEach((a, k) => items.slice(k + 1).forEach((b) => { if (hit(box(a), box(b))) out.push(`pagina ${i + 1}: voci sovrapposte`); }));
    if (pg.scrollHeight > pg.clientHeight + 0.5) out.push(`pagina ${i + 1}: il contenuto non sta nella pagina`);
  });
  return out;
});
console.log('dimensioni (px):', JSON.stringify(sizes));
if (problems.length) {
  console.log(problems.join('\n'));
  await browser.close();
  process.exit(1);
}
await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log(out);
