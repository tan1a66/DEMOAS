// Genera las imágenes estáticas de respaldo (navegadores sin WebGL) y la imagen para redes (OG)
// renderizando el propio 3D en Chromium, sin textos ni interfaz.
//
//   npx vite --port 5199 &
//   node scripts/estaticos.mjs http://localhost:5199/
//
// Salida: src/assets/estaticos/*.webp, src/assets/estaticos/cortes/<id>.webp y public/og.jpg
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(`${execSync('npm root -g').toString().trim()}/playwright`);
const base = process.argv[2] ?? 'http://localhost:5199/';
const raiz = new URL('..', import.meta.url).pathname;
const { cortes } = JSON.parse(readFileSync(`${raiz}src/data/cortes.json`, 'utf8'));
mkdirSync(`${raiz}src/assets/estaticos/cortes`, { recursive: true });

const navegador = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function abrir(url, w, h) {
  const pagina = await navegador.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await pagina.goto(url, { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(7000);
  return pagina;
}

/** Captura → recorte → WebP/JPEG codificado por el propio navegador. */
async function guardar(pagina, ruta, { recorte, tipo = 'image/webp', calidad = 0.84 } = {}) {
  const png = (await pagina.screenshot()).toString('base64');
  const datos = await pagina.evaluate(
    async ([b64, r, t, q]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const [x, y, w, h] = r ?? [0, 0, img.width, img.height];
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
      return c.toDataURL(t, q).split(',')[1];
    },
    [png, recorte, tipo, calidad],
  );
  writeFileSync(`${raiz}${ruta}`, Buffer.from(datos, 'base64'));
  console.log('OK', ruta);
}

async function ir(pagina, id, avance, espera = 6000) {
  await pagina.evaluate(([i, a]) => window.carnal.ir(i, a), [id, avance]);
  await pagina.waitForTimeout(espera);
}

// Fondos de escena (sin textos)
const p = await abrir(`${base}?rapido&limpio`, 1600, 1000);
await ir(p, 'corte', 0.03);
await guardar(p, 'src/assets/estaticos/corte.webp');
await ir(p, 'fuego', 0.3);
await guardar(p, 'src/assets/estaticos/fuego.webp');
await ir(p, 'visitanos', 0.16);
await guardar(p, 'src/assets/estaticos/fachada.webp');
await p.close();

// Cada corte en su vitrina (recorte 4:3 alrededor de la columna del frente)
const c = await abrir(`${base}?rapido&limpio`, 1280, 800);
for (let k = 0; k < cortes.length; k++) {
  const avance = 0.09 + ((k + 0.5) / cortes.length) * 0.86;
  await ir(c, 'coleccion', avance, 7000);
  await guardar(c, `src/assets/estaticos/cortes/${cortes[k].id}.webp`, { recorte: [280, 110, 400, 300] });
}
await c.close();

// Imagen para redes: el hero con el wordmark, sin interfaz.
const o = await abrir(`${base}?rapido`, 1200, 630);
await o.addStyleTag({ content: '.interfaz, .corte__bajada { visibility: hidden !important; }' });
await ir(o, 'corte', 0.13);
await guardar(o, 'public/og.jpg', { tipo: 'image/jpeg', calidad: 0.88 });
await o.close();

await navegador.close();
