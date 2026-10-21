import sharp from 'sharp';
import { generateFormwork, generateSmooth } from '../src/textures/concrete.js';
const out = process.argv[2];
for (const [name, fn] of [['form', generateFormwork], ['smooth', generateSmooth]]) {
  const t0 = performance.now();
  const { data, size } = fn(512);
  console.log(name, (performance.now() - t0).toFixed(0), 'ms');
  // preview: shaded with light from the left, albedo tinted pink
  const img = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    const nx = data[i*4]/127.5-1, ny = data[i*4+1]/127.5-1, nz = Math.sqrt(Math.max(0,1-nx*nx-ny*ny));
    const L = [-0.9, 0.2, 0.38]; const l = Math.hypot(...L);
    const ndl = Math.max(0, (nx*L[0]+ny*L[1]+nz*L[2])/l);
    const a = 0.7 + 0.6*data[i*4+2]/255;
    const v = (0.55 + 0.9*ndl) * a;
    img[i*3] = Math.min(255, 212*v*0.8); img[i*3+1] = Math.min(255,163*v*0.8); img[i*3+2] = Math.min(255,156*v*0.8);
  }
  // flip vertically (row 0 = bottom)
  await sharp(img, { raw: { width: size, height: size, channels: 3 } }).flip().png().toFile(`${out}/${name}.png`);
}
