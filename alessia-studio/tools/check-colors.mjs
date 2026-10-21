// Controllo automatico dei colori sugli screenshot di tools/shoot.mjs (--mask):
//  - "grigio": pixel poco saturi a luminosità media (il cielo #BFD3DC e il bianco sovraesposto esclusi)
//  - "verde fuori dai cuscini": tinte verdi dove la maschera non ha i cuscini
//   node tools/check-colors.mjs <dir>
import sharp from 'sharp';
import { readdirSync } from 'node:fs';

const dir = process.argv[2];
const files = readdirSync(dir).filter((f) => /^p\d+\.png$/.test(f)).sort();
const hsv = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx / 255];
};
let fail = false;
for (const f of files) {
  const img = await sharp(`${dir}/${f}`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = await sharp(`${dir}/mask-${f}`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = img.info;
  const isConcrete = (x, y) => {
    const i = (y * W + x) * 3;
    return m.data[i] < 40 && m.data[i + 1] < 40 && m.data[i + 2] > 215;
  };
  const isMask = (x, y) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = Math.min(W - 1, Math.max(0, x + dx)), yy = Math.min(H - 1, Math.max(0, y + dy));
      const i = (yy * W + xx) * 3;
      if (m.data[i] > 200 && m.data[i + 1] < 60 && m.data[i + 2] > 200) return true;
    }
    return false;
  };
  let grey = 0, green = 0, cushion = 0, concrete = 0, notPink = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 3;
      const [h, s, v] = hsv(img.data[i], img.data[i + 1], img.data[i + 2]);
      const isGreen = h > 65 && h < 170 && s > 0.28 && v > 0.12;
      if (isMask(x, y)) { cushion++; continue; }
      if (isGreen) green++;
      if (isConcrete(x, y)) {
        concrete++;
        // cemento: deve restare nella famiglia del rosa (tinta rosso-rosata, mai neutra a media luminosità)
        if (s < 0.08 && v < 0.88) grey++;
        else if (s >= 0.08 && v < 0.93 && !(h >= 330 || h <= 32)) notPink++;
      }
    }
  }
  const n = (W * H) / 4;
  const pct = (k) => ((k / n) * 100).toFixed(2);
  const ok = green / n < 0.0005 && grey / Math.max(1, concrete) < 0.002 && notPink / Math.max(1, concrete) < 0.002;
  if (!ok) fail = true;
  const pc = (k) => ((k / Math.max(1, concrete)) * 100).toFixed(2);
  console.log(`${f}: cemento ${pct(concrete)}% dello schermo (grigio ${pc(grey)}%, non rosa ${pc(notPink)}%)  cuscini ${pct(cushion)}%  verde fuori dai cuscini ${pct(green)}%  ${ok ? 'OK' : 'DA VERIFICARE'}`);
}
process.exit(fail ? 1 : 0);
