// Kit del marchio per i social: logo (vettoriale e PNG), varianti, immagini del profilo, tavola dei
// colori, colori in JSON. Il logo è la scritta ALESSIA STUDIO in Syne ExtraBold, convertita in
// tracciati (non serve il font per aprirlo).
//   node tools/brand-kit.mjs   ->  brand/
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import opentype from 'opentype.js';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}brand`;
for (const d of ['logo', 'instagram', '.build']) mkdirSync(`${out}/${d}`, { recursive: true });

// due colori soli: il verde e il rosa del sito
export const COLORS = [
  { id: 'verde', name: 'Verde Alessia', hex: '#B8F03A', role: 'Logo, titoli, accenti.' },
  { id: 'rosa', name: 'Rosa Alessia', hex: '#D4A39C', role: 'Fondo (il cemento rosa del sito).' },
];
const C = Object.fromEntries(COLORS.map((c) => [c.id, c.hex]));

// contrasto WCAG tra due colori
const lum = (hex) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// ---------------- logo: testo -> tracciati ----------------
const syne = opentype.loadSync(`${out}/fonts/Syne-800.ttf`);
const TRACK = -0.035; // come sul sito

function line(text, size, tracking = TRACK) {
  const glyphs = syne.stringToGlyphs(text);
  const scale = size / syne.unitsPerEm;
  const items = [];
  let x = 0;
  glyphs.forEach((g, i) => {
    items.push({ g, x });
    x += g.advanceWidth * scale + tracking * size;
    if (i < glyphs.length - 1) x += syne.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  const p = new opentype.Path();
  items.forEach(({ g, x: gx }) => p.extend(g.getPath(gx, 0, size)));
  return { items, size, bb: p.getBoundingBox() };
}

// righe centrate una sotto l'altra; pad in em della prima riga
function logoSvg(lines, color, { gap = 0.98, pad = 0.12, width = null, bg = null } = {}) {
  const size = 1000;
  const ls = lines.map((t) => line(t, size));
  const wMax = Math.max(...ls.map((l) => l.bb.x2 - l.bb.x1));
  const paths = [];
  let y0 = null, y1 = null;
  ls.forEach((l, k) => {
    const w = l.bb.x2 - l.bb.x1;
    const ox = (wMax - w) / 2 - l.bb.x1;
    const base = k * gap * size;
    const p = new opentype.Path();
    l.items.forEach(({ g, x }) => p.extend(g.getPath(x + ox, base, size)));
    const bb = p.getBoundingBox();
    y0 = y0 === null ? bb.y1 : Math.min(y0, bb.y1);
    y1 = y1 === null ? bb.y2 : Math.max(y1, bb.y2);
    paths.push(p.toPathData(1));
  });
  const P = pad * size;
  const vw = wMax + 2 * P, vh = y1 - y0 + 2 * P;
  const attrs = width ? ` width="${width}" height="${Math.round((width * vh) / vw)}"` : '';
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(-P).toFixed(1)} ${(y0 - P).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}"${attrs}>` +
      `<title>Alessia Studio</title>` +
      (bg ? `<rect x="${(-P).toFixed(1)}" y="${(y0 - P).toFixed(1)}" width="${vw.toFixed(1)}" height="${vh.toFixed(1)}" fill="${bg}"/>` : '') +
      `<path fill="${color}" d="${paths.join(' ')}"/></svg>`,
    ratio: vw / vh,
  };
}

const variants = [
  { file: 'logo-verde', lines: ['ALESSIA STUDIO'], color: C.verde },
  { file: 'logo-verde-2-righe', lines: ['ALESSIA', 'STUDIO'], color: C.verde },
  { file: 'monogramma-verde', lines: ['AS'], color: C.verde },
  { file: 'logo-rosa', lines: ['ALESSIA STUDIO'], color: C.rosa },
  { file: 'logo-rosa-2-righe', lines: ['ALESSIA', 'STUDIO'], color: C.rosa },
  { file: 'monogramma-rosa', lines: ['AS'], color: C.rosa },
];
for (const v of variants) {
  const { svg } = logoSvg(v.lines, v.color);
  writeFileSync(`${out}/logo/${v.file}.svg`, svg);
  const png = await sharp(Buffer.from(logoSvg(v.lines, v.color, { width: v.lines[0].length > 3 ? 3000 : 1600 }).svg)).png().toBuffer();
  writeFileSync(`${out}/logo/${v.file}.png`, png);
  console.log(`logo/${v.file}.svg + .png`);
}

// logo dentro un quadrato di colore, a una data larghezza
async function onColor(file, bg, size, logoWidth, { w = size, h = size, dy = 0 } = {}) {
  const v = variants.find((x) => x.file === file);
  const logo = await sharp(Buffer.from(logoSvg(v.lines, v.color, { width: Math.round(logoWidth), pad: 0 }).svg)).png().toBuffer();
  const meta = await sharp(logo).metadata();
  return sharp({ create: { width: w, height: h, channels: 4, background: bg } })
    .composite([{ input: logo, left: Math.round((w - meta.width) / 2), top: Math.round((h - meta.height) / 2 + dy) }])
    .png();
}

// immagini del profilo Instagram (1080, si vedono in un cerchio: il logo resta nel centro)
await (await onColor('monogramma-verde', C.rosa, 1080, 560)).toFile(`${out}/instagram/profilo-monogramma.png`);
await (await onColor('logo-verde-2-righe', C.rosa, 1080, 720)).toFile(`${out}/instagram/profilo-logo.png`);
await (await onColor('monogramma-rosa', C.verde, 1080, 560)).toFile(`${out}/instagram/profilo-monogramma-su-verde.png`);
console.log('instagram/profilo-*.png');

// il logo sugli sfondi giusti (anteprima)
const tiles = [['logo-verde-2-righe', C.rosa], ['logo-rosa-2-righe', C.verde]];
const tileImgs = await Promise.all(tiles.map(async ([f, bg]) => (await onColor(f, bg, 1080, 760, { h: 540 })).toBuffer()));
await sharp({ create: { width: 1080, height: 1080, channels: 4, background: C.rosa } })
  .composite(tileImgs.map((b, i) => ({ input: b, left: 0, top: i * 540 })))
  .png()
  .toFile(`${out}/instagram/logo-sugli-sfondi.png`);
console.log('instagram/logo-sugli-sfondi.png');

// ---------------- tavola dei colori (1080x1350, formato post) ----------------
const fontUrl = (f) => `file://${out}/fonts/${f}`;
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Syne; font-weight: 800; src: url(${fontUrl('Syne-800.ttf')}); }
@font-face { font-family: Inter; font-weight: 500; src: url(${fontUrl('Inter-500.ttf')}); }
@font-face { font-family: Inter; font-weight: 600; src: url(${fontUrl('Inter-600.ttf')}); }
* { box-sizing: border-box; margin: 0; }
body { width: 1080px; height: 1350px; font-family: Inter; }
.half { height: 675px; padding: 72px; display: flex; flex-direction: column; justify-content: space-between; }
.g { background: ${C.verde}; color: ${C.rosa}; }
.r { background: ${C.rosa}; color: ${C.verde}; }
.logo svg { width: 700px; height: auto; display: block; }
.nm { font: 800 44px/1.1 Syne; letter-spacing: -.02em; text-transform: uppercase; }
.hx { font: 600 112px/1.1 Inter; letter-spacing: -.02em; font-variant-numeric: lining-nums; }
.ty { font: 800 64px/1.1 Syne; letter-spacing: -.035em; }
.ty2 { font: 500 52px/1.2 Inter; }
</style><body>
<div class="half g">
  <div class="logo">${logoSvg(['ALESSIA STUDIO'], C.rosa, { pad: 0 }).svg}</div>
  <div><div class="nm">Verde Alessia</div><div class="hx">#B8F03A</div></div>
</div>
<div class="half r">
  <div><div class="ty">Syne ExtraBold</div><div class="ty2">Inter</div></div>
  <div><div class="nm">Rosa Alessia</div><div class="hx">#D4A39C</div></div>
</div>
</body>`;
writeFileSync(`${out}/.build/palette.html`, html);
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  pw = require(`${execSync('npm root -g').toString().trim()}/playwright`);
}
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
await page.goto(`file://${out}/.build/palette.html`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${out}/instagram/colori.png` });
await browser.close();
console.log('instagram/colori.png');

// colori in JSON (per chi prepara grafiche) con i contrasti utili
const pairs = [['verde', 'rosa']];
writeFileSync(`${out}/colori.json`, `${JSON.stringify({
  colori: COLORS,
  contrasti: pairs.map(([a, b]) => ({ testo: a, sfondo: b, rapporto: +contrast(C[a], C[b]).toFixed(2) })),
}, null, 2)}\n`);
console.log('colori.json');
pairs.forEach(([a, b]) => console.log(`  ${a} su ${b}: ${contrast(C[a], C[b]).toFixed(2)}`));
