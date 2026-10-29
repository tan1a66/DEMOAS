// Immagine di anteprima per i social e icone del sito (in public/, copiati così come sono nel build).
//   node tools/shoot.mjs "<url>?still" <cartella> --size=1200x630 --notext --q=high --points=0
//   node tools/seo-assets.mjs <cartella>/p0000.png
// - og-image.jpg (1200x630): la prima schermata del sito (muro rosa, finestra tonda sul mare e sul
//   divano verde) con il logo verde in basso, senza ombre
// - favicon.svg, icon-192.png, apple-touch-icon.png: il monogramma verde su fondo rosa
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const bg = process.argv[2];
if (!bg) throw new Error('serve la schermata di partenza 1200x630 (vedi in cima al file)');
const out = `${root}public`;
mkdirSync(out, { recursive: true });
const PINK = '#D4A39C';

// contenuto e viewBox di un SVG del marchio
function logo(name) {
  const svg = readFileSync(`${root}brand/logo/${name}.svg`, 'utf8');
  const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[\s\S]*?<\/title>/, '');
  return { vb, inner };
}

// ---------------- og-image.jpg ----------------
{
  const { vb, inner } = logo('logo-verde');
  const w = 780, h = Math.round((w * vb[3]) / vb[2]), x = (1200 - w) / 2, y = 525;
  // verde sul rosa del muro, senza ombre (come vuole il brief del marchio)
  const over = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb.join(' ')}">${inner}</svg>
  </svg>`;
  await sharp(bg).resize(1200, 630).composite([{ input: Buffer.from(over), left: 0, top: 0 }]).jpeg({ quality: 86, mozjpeg: true }).toFile(`${out}/og-image.jpg`);
  console.log('og-image.jpg');
}

// ---------------- icone ----------------
{
  const { vb, inner } = logo('monogramma-verde');
  const w = 76, h = (w * vb[3]) / vb[2];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>Alessia Studio</title><rect width="100" height="100" fill="${PINK}"/><svg x="${(100 - w) / 2}" y="${(100 - h) / 2}" width="${w}" height="${h.toFixed(2)}" viewBox="${vb.join(' ')}">${inner}</svg></svg>\n`;
  writeFileSync(`${out}/favicon.svg`, svg);
  for (const [file, s] of [['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
    await sharp(Buffer.from(svg), { density: 600 }).resize(s, s).png().toFile(`${out}/${file}`);
  }
  console.log('favicon.svg, icon-192.png, apple-touch-icon.png');
}
