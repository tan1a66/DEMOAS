// Genera favicon.ico (32px) e apple-touch-icon.png (180px) da public/favicon.svg.
// Uso: node scripts/genera-icone.mjs   (sharp è già installato con Astro)
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url));

// apple-touch-icon: fondo pieno (iOS non gestisce la trasparenza)
await sharp(svg, { density: 600 }).resize(180, 180).flatten({ background: '#553872' }).png().toFile('public/apple-touch-icon.png');

// favicon.ico: contenitore ICO con un'immagine PNG 32×32
const png = await sharp(svg, { density: 300 }).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // riservato
header.writeUInt16LE(1, 2); // tipo: icona
header.writeUInt16LE(1, 4); // numero immagini
const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0); // larghezza
entry.writeUInt8(32, 1); // altezza
entry.writeUInt8(0, 2); // palette
entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4); // piani colore
entry.writeUInt16LE(32, 6); // bit per pixel
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(6 + 16, 12); // offset
await writeFile('public/favicon.ico', Buffer.concat([header, entry, png]));
console.log('Icone generate: public/favicon.ico, public/apple-touch-icon.png');
