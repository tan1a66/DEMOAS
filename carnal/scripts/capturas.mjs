// Capturas del recorrido en Chromium (WebGL por software) para revisar escenas sin GPU.
//
//   npx vite --port 5199 &
//   node scripts/capturas.mjs "http://localhost:5199/?rapido" capturas 1440x900 corte:0.05 coleccion:0.3 ...
//
// Cada punto es seccion:avance (0..1). Opcional: espera=ms entre punto y captura (por defecto 2500).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const raizGlobal = execSync('npm root -g').toString().trim();
const { chromium } = require(`${raizGlobal}/playwright`);

const [url, salida = 'capturas', tam = '1440x900', ...puntos] = process.argv.slice(2);
const [w, h] = tam.split('x').map(Number);
const espera = Number(process.env.ESPERA ?? 2500);
const movil = w < 700;
mkdirSync(salida, { recursive: true });

const navegador = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const pagina = await navegador.newPage({
  viewport: { width: w, height: h },
  deviceScaleFactor: Number(process.env.DPR ?? 1),
  isMobile: movil,
  hasTouch: movil,
});
pagina.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text());
});
pagina.on('pageerror', (e) => console.log('[pageerror]', e.message));

await pagina.goto(url, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(Number(process.env.INICIO ?? 4000));
if (process.env.INICIAL) await pagina.screenshot({ path: `${salida}/00-inicio.png` });

for (const punto of puntos) {
  const [id, avance] = punto.split(':');
  await pagina.evaluate(([i, a]) => window.carnal.ir(i, Number(a)), [id, avance ?? '0']);
  await pagina.waitForTimeout(espera);
  const nombre = `${salida}/${id}-${String(avance).replace('.', '_')}-${w}x${h}.png`;
  await pagina.screenshot({ path: nombre });
  const h0 = await pagina.evaluate(() => window.carnal.estado.historia.toFixed(3));
  console.log('OK', nombre, 'historia', h0);
}
await navegador.close();
