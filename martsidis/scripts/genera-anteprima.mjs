// Anteprima del sito in UN SOLO FILE HTML, da aprire con doppio clic (o da mandare al cliente).
// Uso:  npm run build:anteprima   →   anteprima/ginecologiacagliari-anteprima.html
//
// Come funziona (solo per l'anteprima, il sito vero resta multi-pagina):
// - ogni pagina diventa un <template>; un piccolo router a hash (#/contatti/) mostra quella richiesta;
// - CSS, font e immagini sono incorporati (data: URL);
// - i moduli JavaScript (Three.js compreso) diventano data: URL collegati da un import map.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Build dedicata (senza CSP e senza modulepreload), in dist-anteprima/. Funziona anche su Windows.
const build = spawnSync('npx', ['astro', 'build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, ANTEPRIMA: '1' },
});
if (build.status !== 0) process.exit(build.status ?? 1);

const DIST = 'dist-anteprima';
const OUT_DIR = 'anteprima';
const OUT = path.join(OUT_DIR, 'ginecologiacagliari-anteprima.html');
// Chunk caricati solo con un modello .glb: non servono all'anteprima.
const ESCLUSI = /^(DRACOLoader|GLTFLoader|draco_|meshopt_|glb\.)/;

const MIME = {
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};
const dataUrl = async (file) => {
  const buf = await readFile(path.join(DIST, file));
  return `data:${MIME[path.extname(file)] ?? 'application/octet-stream'};base64,${buf.toString('base64')}`;
};

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

// — 1. Moduli JS → import map con data: URL —
const astroDir = path.join(DIST, '_astro');
const chunkFiles = (await readdir(astroDir)).filter((f) => f.endsWith('.js') && !ESCLUSI.test(f));
const riscriviImport = (codice) =>
  codice
    // niente <link rel="modulepreload"> verso /_astro/ (i moduli sono già incorporati)
    .replace(/__vite__mapDeps\(\[[\d,]*\]\)/g, '[]')
    .replace(/(["'`])(?:\.\/|\/_astro\/)([\w.\-]+\.js)\1/g, (_m, q, nome) => `${q}astro-chunk/${nome}${q}`);
const glb = `data:model/gltf-binary;base64,${(await readFile(path.join(DIST, 'models/pelvi.glb'))).toString('base64')}`;
const importMap = { imports: {} };
const codiceChunk = {};
for (const f of chunkFiles) {
  const codice = riscriviImport(await readFile(path.join(astroDir, f), 'utf8')).replaceAll('/models/pelvi.glb', glb);
  codiceChunk[f] = codice;
  importMap.imports[`astro-chunk/${f}`] = `data:text/javascript;base64,${Buffer.from(codice).toString('base64')}`;
}

// — 2. Font e risorse nei CSS → data: URL —
const cacheData = new Map();
const incorpora = async (url) => {
  const file = url.replace(/^\//, '');
  if (!cacheData.has(file)) cacheData.set(file, await dataUrl(file));
  return cacheData.get(file);
};
const incorporaCss = async (css) => {
  // url(/_astro/…), url("/_astro/…") e url('/_astro/…')
  const trovati = [...css.matchAll(/url\((["']?)(\/_astro\/[^)"']+)\1\)/g)];
  for (const [intero, , u] of trovati) css = css.replaceAll(intero, `url(${await incorpora(u)})`);
  return css;
};

// — 3. Pagine —
const pagine = [];
const stiliVisti = new Set();
const stili = [];
for await (const file of walk(DIST)) {
  if (!file.endsWith('.html')) continue;
  const rel = '/' + path.relative(DIST, file).split(path.sep).join('/');
  const percorso = rel === '/404.html' ? '/404/' : rel.replace(/index\.html$/, '');
  pagine.push({ percorso, html: await readFile(file, 'utf8') });
}
pagine.sort((a, b) => (a.percorso === '/' ? -1 : b.percorso === '/' ? 1 : a.percorso.localeCompare(b.percorso)));

const templates = [];
for (const { percorso, html } of pagine) {
  const head = html.slice(0, html.indexOf('</head>'));
  let body = html.slice(html.indexOf('>', html.indexOf('<body')) + 1, html.lastIndexOf('</body>'));
  const titolo = (head.match(/<title>(.*?)<\/title>/s)?.[1] ?? '').trim();

  // CSS: fogli collegati e <style> nel head, raccolti una volta sola per tutto il file
  for (const m of head.matchAll(/<link rel="stylesheet" href="([^"]+)"[^>]*>/g)) {
    if (stiliVisti.has(m[1])) continue;
    stiliVisti.add(m[1]);
    stili.push(await incorporaCss(await readFile(path.join(DIST, m[1]), 'utf8')));
  }
  for (const m of head.matchAll(/<style[^>]*>(.*?)<\/style>/gs)) {
    if (stiliVisti.has(m[1])) continue;
    stiliVisti.add(m[1]);
    stili.push(await incorporaCss(m[1]));
  }

  // Script: quelli con src diventano inline (così si rieseguono a ogni cambio di pagina)
  body = body.replace(/<script type="module" src="\/_astro\/([^"]+)"><\/script>/g, (_m, f) => {
    if (!codiceChunk[f]) return '';
    return `<script type="module">${codiceChunk[f].replaceAll('</script', '<\\/script')}</script>`;
  });
  body = body.replace(/<script type="module">(.*?)<\/script>/gs, (_m, c) => `<script type="module">${riscriviImport(c)}</script>`);
  body = body.replace(/<script type="application\/ld\+json">.*?<\/script>/gs, '');

  // Immagini: <picture> → un solo <img> WebP (~800 px) incorporato
  const picture = [...body.matchAll(/<picture>.*?<\/picture>/gs)];
  for (const [blocco] of picture) {
    const webp = blocco.match(/<source[^>]*type="image\/webp"[^>]*srcset="([^"]+)"/)?.[1] ?? '';
    const candidati = webp.split(',').map((c) => c.trim().split(/\s+/)).filter((c) => c[0]);
    const scelto = candidati.find((c) => parseInt(c[1]) >= 800) ?? candidati.at(-1);
    let img = blocco.match(/<img[^>]*>/)?.[0] ?? '';
    img = img.replace(/\s(srcset|sizes)="[^"]*"/g, '');
    if (scelto) img = img.replace(/src="[^"]*"/, `src="${await incorpora(scelto[0])}"`);
    body = body.replace(blocco, img);
  }
  for (const m of [...body.matchAll(/<img[^>]*src="(\/_astro\/[^"]+)"/g)]) {
    body = body.replace(m[1], await incorpora(m[1]));
  }
  body = body.replace(/\s(srcset|sizes)="\/_astro[^"]*"/g, '');

  // Link interni → router a hash (#/pagina/), lasciando esterni, tel:, mailto:
  body = body.replace(/href="(\/(?!\/|_astro)[^"]*)"/g, (_m, u) => `href="#${u}"`);

  const id = `pagina:${percorso}`;
  templates.push(
    `<template id="${id}" data-titolo="${titolo.replaceAll('"', '&quot;')}">${body}</template>`,
  );
}

const favicon = await dataUrl('favicon.svg');
const router = `
(function () {
  function leggi() {
    var h = decodeURIComponent(location.hash || '');
    if (h.indexOf('#/') !== 0) return { percorso: '/', ancora: h.slice(1) };
    var resto = h.slice(1), i = resto.indexOf('#');
    var p = i < 0 ? resto : resto.slice(0, i);
    if (p.slice(-1) !== '/') p += '/';
    return { percorso: p, ancora: i < 0 ? '' : resto.slice(i + 1) };
  }
  var corrente = null;
  function mostra() {
    var r = leggi();
    var t = document.getElementById('pagina:' + r.percorso) || document.getElementById('pagina:/404/');
    if (corrente !== t.id) {
      document.documentElement.classList.remove('menu-aperto');
      document.body.replaceChildren(t.content.cloneNode(true));
      document.title = t.dataset.titolo;
      corrente = t.id;
      window.scrollTo(0, 0);
    }
    if (r.ancora) {
      setTimeout(function () {
        var b = document.querySelector('[data-stato-btn="' + r.ancora + '"]');
        if (b) { document.getElementById('pavimento-pelvico').scrollIntoView(); b.click(); return; }
        var el = document.getElementById(r.ancora);
        if (el) el.scrollIntoView();
      }, 200);
    }
  }
  window.addEventListener('hashchange', mostra);
  // Ancore interne alla pagina (#sintomi, Salta al contenuto…): scorrono senza cambiare pagina
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var h = a.getAttribute('href');
    if (h.indexOf('#/') === 0) return;
    e.preventDefault();
    var el = document.getElementById(h.slice(1));
    if (el) { el.scrollIntoView({ behavior: 'smooth' }); el.focus({ preventScroll: true }); }
  });
  mostra();
})();`;

const out = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Anteprima — Dott. Konstantinos Martsidis</title>
<link rel="icon" href="${favicon}" type="image/svg+xml">
<style>${stili.join('\n')}</style>
<script type="importmap">${JSON.stringify(importMap)}</script>
${templates.join('\n')}
</head>
<body>
<script>${router}</script>
</body>
</html>`;

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, out);
console.log(`Anteprima creata: ${OUT} (${(Buffer.byteLength(out) / 1024 / 1024).toFixed(1)} MB, ${pagine.length} pagine)`);
