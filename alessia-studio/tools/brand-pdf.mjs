// Il kit del marchio in un solo PDF, da dare a Claude (o a chiunque prepari i post): brief, colori, font,
// logo (anche in codice SVG), immagini del sito e dei progetti.
//   node tools/brand-kit.mjs && node tools/brand-pdf.mjs   ->  brand/alessia-studio-brand-kit.pdf
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const brand = `${root}brand`;
const tmp = `${brand}/.build`;
mkdirSync(tmp, { recursive: true });
const V = '#B8F03A', R = '#D4A39C';
const svg = (f) => readFileSync(`${brand}/logo/${f}.svg`, 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// codice del logo con spazi tra comandi e numeri: copiato o estratto dal PDF, va a capo solo sugli spazi
const spaced = (code) => code.replace(/d="([^"]+)"/, (_, d) => `d="${d.replace(/([MLQCZ])/g, ' $1 ').replace(/(\d)-/g, '$1 -').replace(/\s+/g, ' ').trim()}"`);
const gallery = JSON.parse(readFileSync(`${root}src/assets/gallery.json`, 'utf8'));

// un'immagine per progetto (JPEG, per un PDF leggero)
const PROJECTS = [
  ['inmobiliaria', 'Bienes raíces', 'Mapa 3D interactivo', 'Una península en 3D: desarrollos inmobiliarios para explorar, búsqueda con filtros y rutas animadas.', '01'],
  ['hotel', 'Hotel boutique', 'Casona histórica', 'Del agua al patio: un recorrido inmersivo por la casona y sus habitaciones, en 3D con fotos reales como materia.', '01'],
  ['restaurante', 'Restaurante de autor', 'Cocina regional', 'La casa se vuelve el sitio: de la entrada a la terraza, con menú, autores y reservas.', '02'],
  ['abogados', 'Despacho de abogados', 'Sitio profesional', 'Un monumento de mármol inspirado en el cosmos de Dante: cada cornisa cuenta un área de práctica.', '01'],
  ['hacienda', 'Hacienda', 'Restaurante y eventos', 'Una espina de henequén borda sobre el lino; después la historia de la casa, de ayer a hoy, se vuelve el recorrido 3D.', '01'],
  ['cocina-italiana', 'Restaurante italiano', 'Cocina romana', 'Un avión despega del Coliseo y aterriza en tu ciudad; sobre el mantel, los platos son los botones del sitio.', '02'],
  ['carniceria', 'Carnicería boutique', 'Cortes selectos', 'Ocho escenas en una sola película con scroll: vitrinas, cortes, el privado y la reserva.', '01'],
  ['pizzeria', 'Pizzería', 'Cocina del sur de Italia', 'Del cielo del sur de Italia a la mesa familiar: menú, reservas y mapa son platos que se tocan.', '01'],
];
for (const p of PROJECTS) {
  const n = gallery[p[0]]?.includes(p[4]) ? p[4] : gallery[p[0]]?.[0];
  await sharp(`${root}public/gallery/${p[0]}/${n}-1280.webp`).resize(1100).jpeg({ quality: 80, mozjpeg: true }).toFile(`${tmp}/${p[0]}.jpg`);
}

const SITE = [
  ['01-muro', 'La entrada: el muro de cemento rosa y la ventana circular'],
  ['02-divani', 'Los sofás verdes: ALESSIA STUDIO'],
  ['03-vision', 'Bajo el tragaluz: Visión'],
  ['04-que-hacemos', 'En la terraza, frente al mar: Qué hacemos'],
  ['05-proyectos', 'Bajo el agua: cada burbuja es un proyecto'],
  ['06-contacto', 'Hacia la luz: Contáctanos'],
];
const f = (p) => `file://${p}`;

const html = `<!doctype html><html lang="it"><meta charset="utf-8"><title>Alessia Studio · Brand kit</title><style>
@font-face { font-family: Syne; font-weight: 800; src: url(${f(`${brand}/fonts/Syne-800.ttf`)}); }
@font-face { font-family: Inter; font-weight: 400; src: url(${f(`${brand}/fonts/Inter-400.ttf`)}); }
@font-face { font-family: Inter; font-weight: 500; src: url(${f(`${brand}/fonts/Inter-500.ttf`)}); }
@font-face { font-family: Inter; font-weight: 600; src: url(${f(`${brand}/fonts/Inter-600.ttf`)}); }
@page { size: 210mm 297mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font: 400 10.2pt/1.5 Inter; color: #111; }
.page { width: 210mm; height: 297mm; padding: 18mm 18mm 16mm; background: ${R}; page-break-after: always; position: relative; overflow: hidden; display: flex; flex-direction: column; }
.page.green { background: ${V}; }
.foot { position: absolute; left: 18mm; right: 18mm; bottom: 9mm; display: flex; justify-content: space-between; font: 500 7.5pt Inter; letter-spacing: .18em; text-transform: uppercase; }
h1 { font: 800 30pt/1.08 Syne; letter-spacing: -.03em; color: ${V}; text-transform: uppercase; margin-bottom: 8mm; padding-bottom: .06em; }
.green h1 { color: ${R}; }
h2 { font: 600 8pt/1.3 Inter; letter-spacing: .22em; text-transform: uppercase; margin: 6mm 0 2mm; }
p + p { margin-top: 2mm; }
.big { font: 800 19pt/1.2 Syne; letter-spacing: -.02em; color: ${V}; padding-bottom: .06em; }
.green .big { color: ${R}; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
ul { padding-left: 4.5mm; } li + li { margin-top: 1mm; }
table { width: 100%; border-collapse: collapse; font-size: 9.2pt; }
td, th { text-align: left; padding: 2.2mm 2mm 2.2mm 0; border-top: .3mm solid rgba(0,0,0,.25); vertical-align: top; }
th { font: 600 7.5pt Inter; letter-spacing: .16em; text-transform: uppercase; }
.cover { justify-content: center; align-items: center; text-align: center; }
.cover .logo svg { width: 150mm; height: auto; }
.cover .sub { font: 800 13pt/1.3 Syne; letter-spacing: .02em; color: ${V}; margin-top: 14mm; text-transform: uppercase; }
.cover .line { margin-top: 5mm; font: 500 9pt Inter; letter-spacing: .2em; text-transform: uppercase; }
.sw { height: 72mm; display: flex; flex-direction: column; justify-content: flex-end; padding: 7mm; border-radius: 4mm; }
.sw .n { font: 800 15pt Syne; text-transform: uppercase; letter-spacing: -.01em; }
.sw .h { font: 600 30pt/1.1 Inter; letter-spacing: -.02em; }
.sw .r { font: 500 9pt Inter; margin-top: 1mm; }
.tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.tile { height: 52mm; border-radius: 4mm; display: grid; place-items: center; }
.tile svg { width: 70%; height: auto; }
.tile.mono svg { width: 34%; }
.cap { font: 500 7.8pt Inter; margin-top: 1.5mm; }
.site { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm 5mm; }
.site img { width: 100%; aspect-ratio: 4/5; object-fit: cover; border-radius: 2.5mm; display: block; }
.proj { display: grid; grid-template-columns: 1fr 1fr; gap: 7mm 7mm; }
.proj img { width: 100%; aspect-ratio: 16/10; object-fit: cover; border-radius: 2.5mm; display: block; margin-bottom: 2.5mm; }
.proj .t { font: 800 13pt/1.2 Syne; letter-spacing: -.02em; color: ${V}; padding-bottom: .05em; }
.proj .k { font: 600 7.2pt/1.4 Inter; letter-spacing: .12em; text-transform: uppercase; margin: 1mm 0 1.2mm; }
.proj p { font-size: 8.8pt; line-height: 1.45; }
.note { margin-top: auto; font-size: 8.6pt; padding-top: 4mm; border-top: .3mm solid rgba(0,0,0,.25); }
pre { font: 400 5.4pt/1.35 ui-monospace, Menlo, monospace; white-space: pre-wrap; overflow-wrap: anywhere; color: #111; }
.box { margin-top: auto; padding: 5mm 6mm; border-radius: 3mm; background: ${V}; font-size: 9.4pt; }
.n9 { counter-reset: n; list-style: none; padding: 0; }
.n9 li { counter-increment: n; padding-left: 9mm; position: relative; }
.n9 li::before { content: counter(n); position: absolute; left: 0; top: 0; font: 600 10.5pt Inter; }
</style><body>

<section class="page cover">
  <div class="logo">${svg('logo-verde-2-righe')}</div>
  <div class="sub">Brand kit · Instagram</div>
  <div class="line">Italia · México · Colombia · Worldwide</div>
</section>

<section class="page">
  <h1>Chi siamo</h1>
  <div class="big">Un sitio web puede ser un lugar, no una página.</div>
  <div class="cols" style="margin-top:6mm">
    <div>
      <h2>Nome</h2><p>ALESSIA STUDIO (nel logo sempre in maiuscolo).</p>
      <h2>Cosa fa</h2><p>Branding, direzione creativa e siti web 3D immersivi.</p>
      <h2>In una frase</h2><p>Diseñamos marcas y espacios digitales para recorrer: arquitecturas de luz, materia y movimiento que cuentan una marca como una visita. Cada scroll es un paso; cada detalle está hecho para quedarse.</p>
      <h2>Lingue</h2><p>Post in <b>spagnolo</b>; se serve, una riga in inglese. Lo studio lavora in spagnolo, italiano, inglese e portoghese.</p>
      <h2>Contatto</h2><p>alessiapir@icloud.com<br>WhatsApp +39 346 175 8562<br>Profilo Instagram: da aggiungere.</p>
    </div>
    <div>
      <h2>Posizionamento</h2>
      <p><b>ES</b> Italia · México · Colombia · Worldwide<br>
      <b>IT</b> Italia · Messico · Colombia · Worldwide<br>
      <b>EN</b> Italy · Mexico · Colombia · Worldwide<br>
      <b>PT</b> Itália · México · Colômbia · Worldwide</p>
      <p>Nacimos en Italia, trabajamos entre México y Colombia, con marcas de todo el mundo.</p>
      <h2>Tono di voce</h2>
      <p>Calmo, preciso, sensoriale. Frasi brevi. Parole di architettura e di luce: <i>lugar, luz, materia, recorrido, paso, detalle</i>. Niente gergo tecnico nei post. Il sito non si guarda: si visita, si attraversa.</p>
      <h2>Servizi</h2>
      <p><b>Marca:</b> estrategia y posicionamiento · branding e identidad visual · naming y tono de voz · dirección creativa y de arte</p>
      <p><b>Digital:</b> sitios web 3D inmersivos · diseño UX/UI · showrooms y configuradores 3D · desarrollo, publicación y mantenimiento</p>
      <p><b>Contenido:</b> renders y animaciones 3D · motion design y video · contenido para redes sociales · campañas y lanzamientos</p>
    </div>
  </div>
  <div class="box"><b>Per chi crea i post (anche Claude):</b> questo documento è il riferimento. Solo i due colori (pagina 3), font Syne ExtraBold e Inter, testi in spagnolo, tono calmo e architettonico; il logo è a pagina 4 e in codice a pagina 9; le idee per i primi 9 post sono a pagina 8.</div>
  <div class="foot"><span>Alessia Studio · brand kit</span><span>2</span></div>
</section>

<section class="page">
  <h1>Colori: solo due</h1>
  <div class="cols">
    <div class="sw" style="background:${V}"><div class="n">Verde Alessia</div><div class="h">#B8F03A</div><div class="r">RGB 184, 240, 58 · logo, titoli, accenti</div></div>
    <div class="sw" style="background:${R};box-shadow:inset 0 0 0 .4mm rgba(0,0,0,.3)"><div class="n">Rosa Alessia</div><div class="h">#D4A39C</div><div class="r">RGB 212, 163, 156 · fondo</div></div>
  </div>
  <h2 style="margin-top:8mm">Regole</h2>
  <ul>
    <li><b>Nessun altro colore</b> nella grafica: niente nero, grigi, blu, altri verdi o altri rosa. Le immagini (screenshot del sito e dei progetti) restano come sono.</li>
    <li>Due combinazioni: <b>verde su rosa</b> (la principale) e <b>rosa su verde</b>.</li>
    <li>Verde e rosa hanno chiarezza simile (contrasto 1,6:1): sulla grafica testi <b>grandi e corti</b> (titoli di 3–8 parole, almeno 60 px su un post largo 1080 px). Il testo lungo va nella didascalia.</li>
  </ul>
  <h1 style="margin-top:10mm">Font</h1>
  <div class="cols">
    <div><div class="big" style="font-size:24pt">Syne ExtraBold</div><p>Logo e titoli, preferibilmente in maiuscolo, spaziatura −3,5%. I numeri di Syne sono “all'antica” (lo 0 sembra una o): per date, prezzi e codici usare Inter.</p></div>
    <div><div class="big" style="font:600 24pt/1.2 Inter;color:${V}">Inter</div><p>Testi ed etichette (Regular 400, Medium 500, SemiBold 600). Etichette in maiuscolo con spaziatura +22%. Entrambi gratuiti su Google Fonts (licenza SIL Open Font License).</p></div>
  </div>
  <div class="foot"><span>Alessia Studio · brand kit</span><span>3</span></div>
</section>

<section class="page">
  <h1>Logo</h1>
  <div class="tiles">
    <div><div class="tile" style="background:${R};box-shadow:inset 0 0 0 .4mm rgba(0,0,0,.3)">${svg('logo-verde')}</div><div class="cap">Logo verde su rosa (principale)</div></div>
    <div><div class="tile" style="background:${V}">${svg('logo-rosa')}</div><div class="cap">Logo rosa su verde</div></div>
    <div><div class="tile" style="background:${R};box-shadow:inset 0 0 0 .4mm rgba(0,0,0,.3)">${svg('logo-verde-2-righe')}</div><div class="cap">Su due righe (post quadrati e verticali)</div></div>
    <div><div class="tile mono" style="background:${R};box-shadow:inset 0 0 0 .4mm rgba(0,0,0,.3)">${svg('monogramma-verde')}</div><div class="cap">Monogramma AS: immagine del profilo</div></div>
  </div>
  <h2 style="margin-top:8mm">Come si usa</h2>
  <ul>
    <li>Verde su fondo rosa, rosa su fondo verde. Mai su altri colori; mai deformato, ruotato, con contorni o ombre.</li>
    <li>Spazio libero attorno: almeno l'altezza di una lettera del logo. Larghezza minima 120 px.</li>
    <li>Il logo è la scritta ALESSIA STUDIO in Syne ExtraBold, spaziatura −3,5%. Il codice SVG esatto è nell'ultima pagina: per la versione rosa basta sostituire <b>#B8F03A</b> con <b>#D4A39C</b>.</li>
    <li>Immagine del profilo: il monogramma AS verde su rosa, centrato (Instagram la ritaglia in un cerchio).</li>
  </ul>
  <div class="foot"><span>Alessia Studio · brand kit</span><span>4</span></div>
</section>

<section class="page">
  <h1>Il sito</h1>
  <p style="margin-bottom:6mm">Un percorso in 3D guidato dallo scroll, in un edificio di cemento rosa sul mare: si entra dalla finestra circolare, ci si ferma accanto ai divani verdi, sotto il lucernario, fuori sulla terrazza davanti al mare, poi ci si tuffa: sott'acqua ogni scroll porta alla bolla successiva, ogni bolla è un progetto (con due squaletti attorno). Immagini in formato post (4:5).</p>
  <div class="site">
    ${SITE.map(([file, cap]) => `<div><img src="${f(`${brand}/sito/${file}.jpg`)}"><div class="cap">${cap}</div></div>`).join('')}
  </div>
  <div class="foot"><span>Alessia Studio · brand kit</span><span>5</span></div>
</section>

${[0, 1].map((k) => `<section class="page">
  <h1>Progetti${k ? ' (2)' : ''}</h1>
  <div class="proj">
    ${PROJECTS.slice(k * 4, k * 4 + 4).map(([id, t, kind, text]) => `<div><img src="${f(`${tmp}/${id}.jpg`)}"><div class="t">${t}</div><div class="k">${kind}</div><p>${text}</p></div>`).join('')}
  </div>
  <div class="note">${k ? 'Ogni progetto ha da 1 a 3 immagini nella galleria del sito.' : 'Sono <b>demo e proposte</b>, senza autorizzazione a mostrare nomi, marchi o dati dei clienti: si parla solo della categoria e si usano solo queste immagini (scene 3D senza testi, loghi, indirizzi o volti).'}</div>
  <div class="foot"><span>Alessia Studio · brand kit</span><span>${6 + k}</span></div>
</section>`).join('')}

<section class="page">
  <h1>Formati e primi post</h1>
  <h2>Formati</h2>
  <p>Post <b>1080 × 1350</b> (4:5) · quadrato 1080 × 1080 · storie e reel 1080 × 1920 (nelle storie lasciare liberi 250 px in alto e 340 in basso). Margini interni 72 px.</p>
  <h2 style="margin-top:7mm">I primi 9 post (la griglia 3 × 3 del profilo)</h2>
  <ol class="n9">
    <li>Logo verde su rosa: ALESSIA STUDIO</li>
    <li>Manifesto, verde su rosa: <i>Un sitio web puede ser un lugar, no una página.</i></li>
    <li>Il sito: i divani verdi</li>
    <li>Rosa su verde: <i>Italia · México · Colombia · Worldwide</i></li>
    <li>Carosello dei servizi: Marca / Digital / Contenido (una slide per gruppo)</li>
    <li>Il sito: il lucernario</li>
    <li>Un progetto (carosello con le immagini di progetti/): solo la categoria, nessun nome</li>
    <li>Il sito: le bolle dei progetti sott'acqua</li>
    <li>Verde su rosa: <i>¿Tienes un lugar que construir?</i> + contatto</li>
  </ol>
  <h2 style="margin-top:7mm">Hashtag possibili</h2>
  <p>#diseñoweb #webdesign #sitiosweb3d #branding #direccióncreativa #diseño3d #mérida #yucatán #méxico #italia</p>
  <div class="foot"><span>Alessia Studio · brand kit</span><span>8</span></div>
</section>

<section class="page" style="padding-top:14mm">
  <h1 style="font-size:16pt;margin-bottom:3mm">Il logo in codice (SVG)</h1>
  <p style="margin-bottom:3mm;font-size:8.6pt">Da copiare così com'è dentro una pagina o una grafica. Versione rosa: sostituire #B8F03A con #D4A39C.</p>
  <h2>In HTML, con il font di Google</h2>
  <pre>${esc(`<link href="https://fonts.googleapis.com/css2?family=Syne:wght@800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<span style="font-family:'Syne';font-weight:800;letter-spacing:-0.035em;text-transform:uppercase;color:#B8F03A">ALESSIA STUDIO</span>`)}</pre>
  <h2>SVG, una riga</h2><pre>${esc(spaced(svg('logo-verde')))}</pre>
  <div class="foot"><span>Alessia Studio · brand kit</span><span>9</span></div>
</section>

<section class="page" style="padding-top:14mm">
  <h2>SVG, due righe</h2><pre>${esc(spaced(svg('logo-verde-2-righe')))}</pre>
  <h2>SVG, monogramma</h2><pre>${esc(spaced(svg('monogramma-verde')))}</pre>
  <div class="foot"><span>Alessia Studio · brand kit</span><span>10</span></div>
</section>
</body></html>`;
writeFileSync(`${tmp}/kit.html`, html);

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  pw = require(`${execSync('npm root -g').toString().trim()}/playwright`);
}
const browser = await pw.chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${tmp}/kit.html`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: `${brand}/alessia-studio-brand-kit.pdf`, preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log('brand/alessia-studio-brand-kit.pdf');
