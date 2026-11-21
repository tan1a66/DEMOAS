// Final: en el muro del fondo de la galería, pintado con spray fucsia, "WORK IN PROGRESS" y la
// firma ALESSIA.STUDIO. Una textura de lienzo (máscara) con niebla de pulverizado, motas y
// chorreones; el color y la luz los pone el material (es pintura sobre la cal).

import * as THREE from 'three';

const W = 2048;
const H = 1280;

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// texto letra a letra (con su espaciado y un pulso de mano: cada letra algo girada)
function letters(ctx, text, cx, y, size, spacing, rnd, wobble) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = cx - total / 2;
  const out = [];
  [...text].forEach((ch, i) => {
    out.push({ ch, x: x + widths[i] / 2, y: y + (rnd() - 0.5) * wobble * size * 0.06, rot: (rnd() - 0.5) * wobble * 0.07, w: widths[i] });
    x += widths[i] + spacing;
  });
  return out;
}

function drawLetters(ctx, list) {
  for (const l of list) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.rot);
    ctx.fillText(l.ch, 0, 0);
    ctx.restore();
  }
}

export class WipWall {
  constructor({ position, width = 1.95 }) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.NoColorSpace;
    this.tex.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d81e7c'),
      alphaMap: this.tex,
      transparent: true,
      depthWrite: false,
      roughness: 0.82,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const g = new THREE.PlaneGeometry(width, (width * H) / W);
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.position.copy(position);
    this.mesh.rotation.y = -Math.PI / 2; // de cara a la galería (el muro mira hacia −x)
    this.draw();
  }

  draw() {
    const ctx = this.canvas.getContext('2d');
    const rnd = rng(2024);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const big = 370;
    ctx.font = `500 ${big}px Jost, 'Helvetica Neue', Arial, sans-serif`;
    const l1 = letters(ctx, 'WORK IN', W / 2, 470, big, 30, rnd, 1);
    const l2 = letters(ctx, 'PROGRESS', W / 2, 860, big, 24, rnd, 1);
    const sig = 128;
    ctx.font = `400 ${sig}px Italiana, 'Didot', serif`;
    const l3 = letters(ctx, 'ALESSIA.STUDIO', W / 2, 1120, sig, 34, rnd, 0.4);

    const layer = (font, list, alpha, blur) => {
      ctx.save();
      ctx.font = font;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
      if (blur) {
        // sólo la sombra (niebla del spray): el texto se dibuja fuera del lienzo
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = blur;
        ctx.shadowOffsetX = W * 2;
        ctx.translate(-W * 2, 0);
      }
      drawLetters(ctx, list);
      ctx.restore();
    };
    const fBig = `500 ${big}px Jost, 'Helvetica Neue', Arial, sans-serif`;
    const fSig = `400 ${sig}px Italiana, 'Didot', serif`;
    // niebla ancha y suave, luego el trazo
    layer(fBig, [...l1, ...l2], 0.35, 46);
    layer(fBig, [...l1, ...l2], 0.55, 14);
    layer(fSig, l3, 0.3, 26);
    layer(fBig, [...l1, ...l2], 1, 0);
    layer(fSig, l3, 1, 0);

    // motas sueltas alrededor de los trazos
    const img = ctx.getImageData(0, 0, W, H).data;
    const near = (x, y) => img[((y | 0) * W + (x | 0)) * 4];
    for (let i = 0; i < 26000; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const v = near(x, y);
      if (v < 20 || v > 235) continue;
      if (rnd() > v / 255) continue;
      ctx.globalAlpha = 0.35 + rnd() * 0.55;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + rnd() * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // chorreones: algunas letras gotean
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    const drips = [...l1, ...l2].filter((l) => l.ch !== ' ');
    for (let k = 0; k < 9; k++) {
      const l = drips[Math.floor(rnd() * drips.length)];
      const x = l.x + (rnd() - 0.5) * l.w * 0.7;
      // buscar el borde inferior de la letra en esa columna
      let y = l.y + 10;
      while (y > l.y - big * 0.8 && near(x, y) < 200) y -= 2;
      if (near(x, y) < 200) continue;
      const len = 40 + rnd() * 170;
      const w = 4 + rnd() * 5;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + (rnd() - 0.5) * 3, y + len);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + len, w * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.tex.needsUpdate = true;
  }
}
