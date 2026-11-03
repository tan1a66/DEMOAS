// Misura del movimento della camera lungo tutta la storia (senza disegnare):
// velocità di rotazione (°/s) e di spostamento (m/s) per uno scroll uniforme di DURATA secondi.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [url, durArg = '50', fpsArg = '30'] = process.argv.slice(2);
const DUR = Number(durArg), FPS = Number(fpsArg), N = DUR * FPS;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
await page.goto(`${url}${url.includes('?') ? '&' : '?'}capture`, { waitUntil: 'load' });
await page.waitForSelector('body.ready', { timeout: 300000 });
const res = await page.evaluate(([N, FPS]) => {
  const out = [];
  for (let i = 0; i < N; i++) out.push(window.__story.probe(i / (N - 1), 1 / FPS));
  return out;
}, [N, FPS]);
await browser.close();
const ang = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))) * 180 / Math.PI;
const rot = [], vel = [];
for (let i = 1; i < res.length; i++) {
  rot.push(ang(res[i - 1], res[i]) * FPS);
  vel.push(Math.hypot(res[i][4] - res[i - 1][4], res[i][5] - res[i - 1][5], res[i][6] - res[i - 1][6]) * FPS);
}
const pct = (a, q) => [...a].sort((x, y) => x - y)[Math.floor(q * (a.length - 1))];
console.log(JSON.stringify({
  durata_s: DUR,
  rotazione_gradi_al_s: { mediana: +pct(rot, 0.5).toFixed(1), p90: +pct(rot, 0.9).toFixed(1), p99: +pct(rot, 0.99).toFixed(1), max: +Math.max(...rot).toFixed(1) },
  velocita_m_al_s: { mediana: Math.round(pct(vel, 0.5)), p90: Math.round(pct(vel, 0.9)), max: Math.round(Math.max(...vel)) },
  // secondi in cui la rotazione supera 30°/s (soglia oltre la quale un movimento di camera inizia a dare fastidio)
  secondi_sopra_30: +(rot.filter((r) => r > 30).length / FPS).toFixed(1),
}));
// dove succede: tratti (in % della storia) con rotazione > 30°/s e i picchi di velocità
const spans = [];
rot.forEach((r, i) => {
  if (r <= 30) return;
  const p = Math.round((i / rot.length) * 1000) / 10;
  const last = spans[spans.length - 1];
  if (last && p - last[1] <= 0.5) { last[1] = p; last[2] = Math.max(last[2], Math.round(r)); } else spans.push([p, p, Math.round(r)]);
});
console.log('rotazione > 30°/s (da %, a %, picco °/s):', JSON.stringify(spans));
const vi = vel.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 5).map(([v, i]) => [Math.round(v), Math.round((i / vel.length) * 1000) / 10]);
console.log('picchi di velocità (m/s, %):', JSON.stringify(vi));
