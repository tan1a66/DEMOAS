import * as THREE from 'three';
import { mulberry32 } from '../scenes/intro/LogoParticles.js';

// Texturas procedurales pintadas en un lienzo 2D (sin descargas): piedra,
// madera, pasta (mosaico de cemento yucateco), fachadas con arcadas.

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = [1, 1], srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Ruido fino sobre todo el lienzo (poros de la piedra, grano de la madera).
function speckle(g, w, h, rnd, amount, alpha = 0.08) {
  for (let i = 0; i < amount; i++) {
    const v = rnd() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${alpha * rnd()})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

const gray = (v, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;

// Sillares de piedra caliza (gris): hiladas con juntas irregulares.
export function stoneBlocks({ base = 150, rows = 6, seed = 1, size = 512, repeat = [1, 1] } = {}) {
  const rnd = mulberry32(seed);
  const [c, g] = canvas(size);
  g.fillStyle = gray(base * 0.55);
  g.fillRect(0, 0, size, size);
  const rh = size / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * rh;
    while (x < size) {
      const w = rh * (1.2 + rnd() * 1.4);
      const v = base * (0.82 + rnd() * 0.3);
      g.fillStyle = gray(v);
      g.fillRect(x + 2, r * rh + 2, w - 4, rh - 4);
      // Desgaste: manchas suaves dentro del sillar.
      for (let k = 0; k < 4; k++) {
        g.fillStyle = gray(v * (0.85 + rnd() * 0.3), 0.35);
        g.beginPath();
        g.ellipse(x + rnd() * w, r * rh + rnd() * rh, rnd() * w * 0.3, rnd() * rh * 0.3, 0, 0, 6.28);
        g.fill();
      }
      x += w;
    }
  }
  speckle(g, size, size, rnd, size * 30);
  return toTexture(c, { repeat });
}

// Enlucido de cal (muros de la casona): manchas suaves, sin juntas marcadas.
export function plaster({ base = 214, seed = 6, size = 256, repeat = [1, 1] } = {}) {
  const rnd = mulberry32(seed);
  const [c, g] = canvas(size);
  g.fillStyle = gray(base);
  g.fillRect(0, 0, size, size);
  for (let k = 0; k < 140; k++) {
    g.fillStyle = gray(base * (0.86 + rnd() * 0.22), 0.18);
    g.beginPath();
    g.ellipse(rnd() * size, rnd() * size, 8 + rnd() * 40, 6 + rnd() * 30, rnd() * 3, 0, 6.28);
    g.fill();
  }
  speckle(g, size, size, rnd, size * 14, 0.06);
  return toTexture(c, { repeat });
}

// Losas grandes del suelo del pasaje.
export function floorSlabs({ base = 120, seed = 2, size = 512, repeat = [1, 1] } = {}) {
  const rnd = mulberry32(seed);
  const [c, g] = canvas(size);
  g.fillStyle = gray(base * 0.5);
  g.fillRect(0, 0, size, size);
  const n = 4;
  const s = size / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      g.fillStyle = gray(base * (0.8 + rnd() * 0.35));
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
  }
  speckle(g, size, size, rnd, size * 40, 0.1);
  return toTexture(c, { repeat });
}

// Tablones de madera (puertas, barra, mesas). tint: color base en hex.
export function wood({ tint = '#6b4a32', seed = 3, size = 256, vertical = true, repeat = [1, 1] } = {}) {
  const rnd = mulberry32(seed);
  const [c, g] = canvas(size);
  const col = new THREE.Color(tint);
  g.fillStyle = `#${col.getHexString()}`;
  g.fillRect(0, 0, size, size);
  const planks = 5;
  for (let p = 0; p < planks; p++) {
    const x0 = (p / planks) * size;
    const shade = 0.85 + rnd() * 0.3;
    g.fillStyle = `rgba(${col.r * 255 * shade},${col.g * 255 * shade},${col.b * 255 * shade},1)`;
    g.fillRect(x0 + 1, 0, size / planks - 2, size);
    for (let k = 0; k < 18; k++) {
      g.strokeStyle = `rgba(0,0,0,${0.05 + rnd() * 0.1})`;
      g.lineWidth = 1;
      g.beginPath();
      const x = x0 + rnd() * (size / planks);
      g.moveTo(x, 0);
      g.bezierCurveTo(x + rnd() * 6 - 3, size * 0.3, x + rnd() * 6 - 3, size * 0.7, x + rnd() * 4 - 2, size);
      g.stroke();
    }
  }
  speckle(g, size, size, rnd, size * 8, 0.06);
  const t = toTexture(c, { repeat });
  if (!vertical) t.rotation = Math.PI / 2;
  return t;
}

// Pasta: mosaico de cemento hidráulico típico de las casonas yucatecas.
export function pastaTiles({ seed = 4, size = 512, repeat = [1, 1] } = {}) {
  const rnd = mulberry32(seed);
  const [c, g] = canvas(size);
  const n = 4;
  const s = size / n;
  const cream = '#d6cbb8';
  const ochre = '#a8775c';
  const ink = '#5a544d';
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = i * s;
      const y = j * s;
      g.fillStyle = cream;
      g.fillRect(x, y, s, s);
      g.save();
      g.translate(x + s / 2, y + s / 2);
      g.rotate(((i + j) % 4) * (Math.PI / 2));
      // Flor central de cuatro pétalos y esquinas que forman círculos al juntarse.
      g.fillStyle = ochre;
      for (let k = 0; k < 4; k++) {
        g.rotate(Math.PI / 2);
        g.beginPath();
        g.ellipse(0, -s * 0.18, s * 0.08, s * 0.16, 0, 0, 6.28);
        g.fill();
      }
      g.fillStyle = ink;
      g.beginPath();
      g.arc(0, 0, s * 0.06, 0, 6.28);
      g.fill();
      g.strokeStyle = ink;
      g.lineWidth = s * 0.025;
      for (const [cx, cy] of [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ]) {
        g.beginPath();
        g.arc(cx * s, cy * s, s * 0.28, 0, 6.28);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = 'rgba(60,50,40,0.25)';
      g.lineWidth = 2;
      g.strokeRect(x, y, s, s);
    }
  }
  // Desgaste del uso.
  for (let k = 0; k < 60; k++) {
    g.fillStyle = `rgba(80,70,60,${rnd() * 0.08})`;
    g.beginPath();
    g.ellipse(rnd() * size, rnd() * size, rnd() * 60, rnd() * 30, rnd() * 3, 0, 6.28);
    g.fill();
  }
  speckle(g, size, size, rnd, size * 25, 0.08);
  return toTexture(c, { repeat });
}

// Fachada con arcada en planta baja y ventanas arriba. Devuelve color + emisivo
// (ventanas y arcos encendidos al anochecer).
export function arcadeFacade({ bays = 8, floors = 2, wall = '#cdbfa8', seed = 5, w = 1024, h = 512, lit = 0.6 } = {}) {
  const rnd = mulberry32(seed);
  const [c, g] = canvas(w, h);
  const [ce, ge] = canvas(w, h);
  g.fillStyle = wall;
  g.fillRect(0, 0, w, h);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, w, h);
  const bw = w / bays;
  const fh = h / floors;
  for (let b = 0; b < bays; b++) {
    const x = b * bw;
    // Planta baja: arco de medio punto.
    const aw = bw * 0.62;
    const ax = x + (bw - aw) / 2;
    const top = h - fh * 0.92;
    g.fillStyle = '#2a241f';
    g.beginPath();
    g.moveTo(ax, h);
    g.lineTo(ax, top + aw / 2);
    g.arc(ax + aw / 2, top + aw / 2, aw / 2, Math.PI, 0);
    g.lineTo(ax + aw, h);
    g.fill();
    if (rnd() < lit) {
      ge.fillStyle = `rgba(255,${190 + rnd() * 40},${120 + rnd() * 40},${0.5 + rnd() * 0.5})`;
      ge.beginPath();
      ge.moveTo(ax + 6, h);
      ge.lineTo(ax + 6, top + aw / 2 + 6);
      ge.arc(ax + aw / 2, top + aw / 2 + 6, aw / 2 - 6, Math.PI, 0);
      ge.lineTo(ax + aw - 6, h);
      ge.fill();
    }
    // Pisos altos: ventanas con balcón.
    for (let f = 1; f < floors; f++) {
      const wy = h - fh * (f + 1) + fh * 0.22;
      const ww = bw * 0.36;
      const wx = x + (bw - ww) / 2;
      g.fillStyle = '#322b25';
      g.fillRect(wx, wy, ww, fh * 0.55);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(wx - 6, wy + fh * 0.55, ww + 12, 5);
      if (rnd() < lit * 0.7) {
        ge.fillStyle = `rgba(255,${200 + rnd() * 40},${140 + rnd() * 40},${0.4 + rnd() * 0.5})`;
        ge.fillRect(wx + 4, wy + 4, ww - 8, fh * 0.55 - 8);
      }
    }
  }
  // Cornisa y pretil.
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 10, w, 6);
  speckle(g, w, h, rnd, w * 20, 0.07);
  return { map: toTexture(c), emissive: toTexture(ce) };
}

// Textura de sprite suave (halos de luz, bombillas, vapor).
export function softDot(size = 64) {
  const [c, g] = canvas(size);
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return toTexture(c, { srgb: false });
}
