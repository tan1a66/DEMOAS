// Screenshot di verifica in viewport iPhone 15 (393×852, DPR 3).
// Uso: node scripts/shot.mjs <url> <out.png> [attesa ms]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // Playwright preinstallato (globale)

const [url, out, wait = '2500'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: Number(process.env.DPR || 3), isMobile: true, hasTouch: true });
page.on('console', (m) => console.log(`[${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector('body.ready, body.error', { timeout: 180000 });
if (url.includes('shot')) await page.waitForSelector('body.shot-done', { timeout: 300000 });
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out, timeout: 120000 });
await browser.close();
