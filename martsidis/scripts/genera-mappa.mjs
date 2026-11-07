// Genera l'immagine statica della mappa dello studio da OpenStreetMap (© OpenStreetMap contributors, ODbL).
// Così la pagina mostra la posizione SENZA collegarsi a servizi esterni al caricamento.
// Da rilanciare solo se cambia l'indirizzo:  node scripts/genera-mappa.mjs <lat> <lon>
// (scarica una ventina di tessere una sola volta, nel rispetto della tile usage policy di OSM)
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const lat = Number(process.argv[2] ?? 39.2228841);
const lon = Number(process.argv[3] ?? 9.1061653);
const zoom = 16;
const W = 1200;
const H = 720;
const TILE = 256;
const UA = 'AlessiaStudio-sito-ginecologiacagliari/1.0 (mappa statica, uso una tantum)';

const n = 2 ** zoom;
const gx = ((lon + 180) / 360) * n * TILE;
const gy = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n * TILE;
const left = Math.round(gx - W / 2);
const top = Math.round(gy - H / 2);
const tx0 = Math.floor(left / TILE);
const ty0 = Math.floor(top / TILE);
const tx1 = Math.floor((left + W) / TILE);
const ty1 = Math.floor((top + H) / TILE);

const tessere = [];
for (let tx = tx0; tx <= tx1; tx++) {
  for (let ty = ty0; ty <= ty1; ty++) {
    const url = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    tessere.push({ input: Buffer.from(await res.arrayBuffer()), left: (tx - tx0) * TILE, top: (ty - ty0) * TILE });
    await new Promise((r) => setTimeout(r, 120));
  }
}

const larghezza = (tx1 - tx0 + 1) * TILE;
const altezza = (ty1 - ty0 + 1) * TILE;
const mosaico = await sharp({ create: { width: larghezza, height: altezza, channels: 3, background: '#f2efe9' } })
  .composite(tessere)
  .png()
  .toBuffer();

// Ritaglio centrato sullo studio, colori più tenui e caldi per stare nella palette del sito.
const ritaglio = await sharp(mosaico)
  .extract({ left: left - tx0 * TILE, top: top - ty0 * TILE, width: W, height: H })
  .modulate({ saturation: 0.45, brightness: 1.03 })
  .tint({ r: 250, g: 244, b: 236 })
  .png()
  .toBuffer();

// Segnaposto della posizione (viola del brand) al centro.
const pin = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <circle cx="${W / 2}" cy="${H / 2}" r="46" fill="#553872" fill-opacity="0.14"/>
  <circle cx="${W / 2}" cy="${H / 2}" r="22" fill="#553872" fill-opacity="0.22"/>
  <g transform="translate(${W / 2 - 22} ${H / 2 - 58})">
    <path d="M22 0C9.8 0 0 9.6 0 21.6 0 37.8 22 58 22 58s22-20.2 22-36.4C44 9.6 34.2 0 22 0z" fill="#553872" stroke="#fff" stroke-width="3"/>
    <circle cx="22" cy="21" r="8" fill="#fff"/>
  </g>
</svg>`);

await mkdir('src/assets/mappa', { recursive: true });
await sharp(ritaglio).composite([{ input: pin }]).png({ compressionLevel: 9 }).toFile('src/assets/mappa/mappa-studio.png');
console.log(`Mappa generata: src/assets/mappa/mappa-studio.png (${tessere.length} tessere, zoom ${zoom})`);
