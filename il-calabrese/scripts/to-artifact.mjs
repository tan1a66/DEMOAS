// Convierte dist-artifact/index.html (un solo archivo, build con --mode artifact) en el formato de página
// privada de Claude: sin <!doctype>/<html>/<head>/<body> (los pone la plataforma), con el <title> al inicio.
//   npm run build:artifact  ->  dist-artifact/il-calabrese.html
import { readFile, writeFile } from 'node:fs/promises';

const src = new URL('../dist-artifact/index.html', import.meta.url);
const out = new URL('../dist-artifact/il-calabrese.html', import.meta.url);
const html = await readFile(src, 'utf8');

const once = (tag) => {
  const n = html.split(tag).length - 1;
  if (n !== 1) throw new Error(`Se esperaba exactamente un ${tag} y hay ${n}`);
};
['<head>', '</head>', '<body>', '</body>'].forEach(once);

const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
const rest = head
  .replace(title, '')
  .replace(/<meta charset="[^"]*"\s*\/?>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace(/<meta name="robots"[^>]*>/i, '');

await writeFile(out, `${title}\n${rest.trim()}\n${body.trim()}\n`);
console.log(`OK: ${out.pathname} (${(Buffer.byteLength(rest + body) / 1e6).toFixed(2)} MB)`);
