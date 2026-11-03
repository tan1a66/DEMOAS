// Verifica della modalità reale: scroll (Lenis + ScrollTrigger), sosta e trascinamento a 360°.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector('body.ready', { timeout: 300000 });
const info = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight, stops: window.__story.story.stops }));
console.log('altezza scroll', info.h, 'vh', info.vh, 'soste', JSON.stringify(info.stops));
// vai a metà della sosta 1 con la rotella (Lenis)
const target = (info.stops[0][0] + info.stops[0][1]) / 2 * (info.h - info.vh);
for (let y = 0; y < target; y += 400) await page.mouse.wheel(0, 400);
await page.waitForTimeout(6000);
const s1 = await page.evaluate(() => { const s = window.__story.rig.state; return { y: Math.round(scrollY), camS: Math.round(s.camS), dir: s.dir, drone: +s.drone.toFixed(2), stop: +s.stop.toFixed(2), progress: +window.__story.story.tl.progress().toFixed(3) }; });
console.log('stato nella sosta', JSON.stringify(s1));
// trascina orizzontalmente
await page.mouse.move(300, 500); await page.mouse.down();
for (let i = 0; i < 10; i++) await page.mouse.move(300 - i * 20, 500);
await page.mouse.up();
await page.waitForTimeout(1500);
console.log('yaw dopo il trascinamento', await page.evaluate(() => window.__story.rig.look.yaw.toFixed(3)));
await page.screenshot({ path: out });
console.log('errori', errors.length ? errors : 'nessuno');
await browser.close();
