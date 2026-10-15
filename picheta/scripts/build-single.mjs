// Versión de la demo en UN solo archivo HTML (código, estilos y fotos dentro), para abrirla con
// doble clic o mandarla por correo/WhatsApp:  npm run build:single  →  dist-single/picheta.html
// Las fuentes (Google Fonts) siguen cargándose de internet; sin conexión se usan las del sistema.

import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'dist-single');

await build({
  root,
  logLevel: 'warn',
  build: {
    outDir: out,
    emptyOutDir: true,
    copyPublicDir: false,
    chunkSizeWarningLimit: 2000,
    // Un único script: sin import() a otros archivos (no funcionarían abriendo el HTML desde el disco).
    rollupOptions: { output: { codeSplitting: false } },
  },
});

const MIME = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.png': 'image/png' };
const dataUri = (file) => `data:${MIME[extname(file)]};base64,${readFileSync(file).toString('base64')}`;
const pub = join(root, 'public');
let html = readFileSync(join(out, 'index.html'), 'utf8');

// Estilos y script en línea.
html = html.replace(/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/g, (_, f) =>
  `<style>${readFileSync(join(out, f), 'utf8')}</style>`,
);
html = html.replace(/<script type="module"[^>]*src="\/(assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, f) => {
  const js = readFileSync(join(out, f), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});

// Fotos del hero: las elige el código según el dispositivo → mapa ruta → data URI.
const files = {};
for (const f of readdirSync(join(pub, 'hero'))) files[`/hero/${f}`] = dataUri(join(pub, 'hero', f));
html = html.replace('<head>', `<head>\n    <script>window.__PICHETA_FILES = ${JSON.stringify(files)};</script>`);

// Fotos de "La cocina" y favicon: directamente en el atributo.
html = html.replace(/(src|href)="\/((?:photos\/[^"]+)|favicon\.svg)"/g, (_, attr, f) => `${attr}="${dataUri(join(pub, f))}"`);

// El logo enlaza a "/": abriendo el archivo desde el disco eso sería la raíz del disco.
html = html.replace('<a class="brand" href="/"', '<a class="brand" href="#"');

if (/(src|href)="\/(assets|hero|photos)\//.test(html)) throw new Error('Quedó alguna ruta sin incrustar');
const dest = join(out, 'picheta.html');
writeFileSync(dest, html);
console.log(`${dest}  ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MB`);
