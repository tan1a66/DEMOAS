// I primi 6 post Instagram (1080x1350, 4:5) -> brand/instagram/post/
//   node tools/shoot.mjs "<url>?still" <cartella> --device=insta --notext --q=high --points=0,0.238,0.88
//   node tools/ig-posts.mjs <cartella>
// Tre immagini del sito senza testi (la prima con il logo) e tre grafiche col testo grande, verde su
// rosa e rosa su verde, come nel brief (brand/BRIEF-instagram.md). Nella griglia del profilo l'ultimo
// post sta in alto a sinistra: in quest'ordine immagini e grafiche si alternano a scacchiera.
// Anche griglia.jpg: come appare la griglia del profilo (ritaglio 3:4).
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';
import { getText, CONTACT_LINKS } from '../src/content.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const shots = process.argv[2];
if (!shots) throw new Error('serve la cartella con le schermate del sito (vedi in cima al file)');
const out = `${root}brand/instagram/post`;
mkdirSync(out, { recursive: true });
const W = 1080, H = 1350, M = 96; // margine: oltre i 72 px del brief, la griglia 3:4 taglia 34 px per lato
const C = { verde: '#B8F03A', rosa: '#D4A39C' };
const T = getText('es');
const font = (f) => opentype.loadSync(`${root}brand/fonts/${f}.ttf`);
const SYNE = font('Syne-800'), INTER = font('Inter-600');

// una riga di testo -> tracciato (con spaziatura e crenatura), larghezza e riquadro
function line(f, text, size, tracking) {
  const glyphs = f.stringToGlyphs(text);
  glyphs.forEach((g) => { if (g.index === 0) throw new Error(`manca il carattere "${g.unicode && String.fromCodePoint(g.unicode)}" in ${f.names.fullName.en}`); });
  const scale = size / f.unitsPerEm;
  const p = new opentype.Path();
  let x = 0;
  glyphs.forEach((g, i) => {
    p.extend(g.getPath(x, 0, size));
    x += g.advanceWidth * scale + tracking * size;
    if (i < glyphs.length - 1) x += f.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  return { p, bb: p.getBoundingBox() };
}
// righe allineate a sinistra in x, la prima linea di base in y; restituisce il tracciato e l'altezza usata
function lines(f, rows, size, { x, y, lead = 1.0, tracking = -0.035 }) {
  const out = new opentype.Path();
  rows.forEach((t, i) => {
    const { p } = line(f, t, size, tracking);
    p.commands.forEach((c) => out.commands.push({ ...c, ...('x' in c ? { x: c.x + x } : {}), ...('y' in c ? { y: c.y + y + i * lead * size } : {}), ...('x1' in c ? { x1: c.x1 + x, y1: c.y1 + y + i * lead * size } : {}), ...('x2' in c ? { x2: c.x2 + x, y2: c.y2 + y + i * lead * size } : {}) }));
  });
  return out.toPathData(1);
}
// corpo più grande perché la riga più larga stia in w
function fit(f, rows, w, max, tracking = -0.035) {
  const widest = Math.max(...rows.map((t) => { const { bb } = line(f, t, 100, tracking); return bb.x2 - bb.x1; }));
  return Math.min(max, (100 * w) / widest);
}
// altezza delle maiuscole (per centrare i blocchi in verticale)
const capH = (f, size) => (f.tables.os2.sCapHeight / f.unitsPerEm) * size;

// un logo del marchio (SVG in brand/logo) a una certa larghezza
function logo(name, x, y, w) {
  const svg = readFileSync(`${root}brand/logo/${name}.svg`, 'utf8');
  const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[\s\S]*?<\/title>/, '');
  const h = (w * vb[3]) / vb[2];
  return { svg: `<svg x="${x}" y="${y}" width="${w}" height="${h.toFixed(1)}" viewBox="${vb.join(' ')}">${inner}</svg>`, h };
}
const page = (bg, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`);
// etichetta in Inter maiuscolo, spaziatura +22%
const label = (text, color, x, y, size = 30) => `<path fill="${color}" d="${lines(INTER, [text.toUpperCase()], size, { x, y, tracking: 0.22 })}"/>`;
// grande blocco in Syne, centrato in verticale tra top e bottom
function big(rows, color, top, bottom, max = 220) {
  const size = fit(SYNE, rows, W - 2 * M, max);
  const lead = 1.0, ch = capH(SYNE, size);
  const blockH = ch + (rows.length - 1) * lead * size;
  const y = top + (bottom - top - blockH) / 2 + ch;
  return `<path fill="${color}" d="${lines(SYNE, rows, size, { x: M, y, lead })}"/>`;
}
const jpg = (img, file) => sharp(img).jpeg({ quality: 88, mozjpeg: true }).toFile(`${out}/${file}`);

const posts = [];
// 1 · il muro rosa e la finestra tonda, con il logo
{
  const l = logo('logo-verde', M, 0, W - 2 * M);
  const y = H - M - 40 - l.h;
  const over = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${l.svg.replace(`y="0"`, `y="${y.toFixed(1)}"`)}</svg>`);
  posts.push(['01-logo.jpg', await sharp(`${shots}/p0000.png`).resize(W, H).composite([{ input: over }]).png().toBuffer()]);
}
// 2 · il manifesto, verde su rosa
{
  const l = logo('logo-verde', M, H - M - 30, 360);
  posts.push(['02-manifiesto.jpg', page(C.rosa, label(T.vision.label, C.verde, M, M + 30) +
    big(['UN SITIO', 'WEB PUEDE', 'SER UN', 'LUGAR,', 'NO UNA', 'PÁGINA.'], C.verde, M + 80, H - M - 80) + l.svg)]);
}
// 3 · il sito: i divani verdi
posts.push(['03-el-sitio.jpg', await sharp(`${shots}/p0238.png`).resize(W, H).png().toBuffer()]);
// 4 · da dove, rosa su verde
{
  const l = logo('logo-rosa', M, H - M - 30, 360);
  posts.push(['04-worldwide.jpg', page(C.verde, big(T.origin.map((s) => s.toUpperCase()), C.rosa, M, H - M - 80) + l.svg)]);
}
// 5 · sott'acqua: la statua
posts.push(['05-el-fondo.jpg', await sharp(`${shots}/p0880.png`).resize(W, H).png().toBuffer()]);
// 6 · il contatto, verde su rosa
{
  const phone = CONTACT_LINKS.whatsapp;
  const foot = `<path fill="${C.verde}" d="${lines(INTER, [T.contact.cta, phone], 40, { x: M, y: H - M - 60, lead: 1.4, tracking: 0 })}"/>`;
  posts.push(['06-contacto.jpg', page(C.rosa, label(T.contact.label, C.verde, M, M + 30) +
    big(['¿TIENES', 'UN LUGAR', 'QUE', 'CONSTRUIR?'], C.verde, M + 80, H - M - 160) + foot)]);
}
for (const [file, img] of posts) {
  await jpg(img, file);
  console.log(`instagram/post/${file}`);
}

// la griglia del profilo: 3 colonne, l'ultimo post in alto a sinistra, riquadri 3:4
const tw = 360, th = 480;
const tiles = await Promise.all([...posts].reverse().map(([, img]) => sharp(img).resize(tw, th, { fit: 'cover' }).toBuffer()));
await sharp({ create: { width: tw * 3 + 8, height: th * 2 + 4, channels: 3, background: '#ffffff' } })
  .composite(tiles.map((b, i) => ({ input: b, left: (i % 3) * (tw + 4), top: Math.floor(i / 3) * (th + 4) })))
  .jpeg({ quality: 86 })
  .toFile(`${out}/griglia.jpg`);
console.log('instagram/post/griglia.jpg');
