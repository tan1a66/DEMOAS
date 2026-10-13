// Texturas procedurales en <canvas>: pizza vista desde arriba, mantel de cuadros, madera,
// mapa de Mérida y tarjetas. Todo se genera en el navegador (sin imágenes externas).

const rand = (seed) => {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};
const canvas = (w, h = w) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// ---------- Pizza ----------
const blob = (ctx, x, y, r, rnd, pts = 9) => {
  ctx.beginPath();
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const rr = r * (0.75 + rnd() * 0.45);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
};
const spots = (ctx, n, R, rnd, fn, inner = 0.78) => {
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * R * inner;
    fn(Math.cos(a) * d, Math.sin(a) * d, rnd() * Math.PI * 2);
  }
};

const TOPPING = {
  basil(ctx, R, rnd) {
    spots(ctx, 7, R, rnd, (x, y, a) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(-R * 0.08, 0, R * 0.08, 0);
      g.addColorStop(0, '#1f5a1a');
      g.addColorStop(0.5, '#3f8f2a');
      g.addColorStop(1, '#1d4d17');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.09, R * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,220,120,.5)';
      ctx.lineWidth = R * 0.005;
      ctx.beginPath();
      ctx.moveTo(-R * 0.08, 0);
      ctx.lineTo(R * 0.08, 0);
      ctx.stroke();
      ctx.restore();
    }, 0.65);
  },
  salami(ctx, R, rnd) {
    spots(ctx, 12, R, rnd, (x, y) => {
      const r = R * 0.1;
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, '#c4352a');
      g.addColorStop(0.85, '#8d1f17');
      g.addColorStop(1, '#5a120c');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,220,200,.55)';
      for (let k = 0; k < 7; k++) {
        ctx.beginPath();
        ctx.arc(x + (rnd() - 0.5) * r * 1.3, y + (rnd() - 0.5) * r * 1.3, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  },
  chili(ctx, R, rnd) {
    ctx.fillStyle = '#d42a14';
    spots(ctx, 40, R, rnd, (x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, R * 0.012, 0, Math.PI * 2);
      ctx.fill();
    });
  },
  nduja(ctx, R, rnd) {
    spots(ctx, 10, R, rnd, (x, y) => {
      ctx.fillStyle = 'rgba(190,40,15,.92)';
      blob(ctx, x, y, R * 0.07, rnd, 11);
      ctx.fill();
      ctx.fillStyle = 'rgba(230,90,20,.55)';
      blob(ctx, x + R * 0.04, y + R * 0.02, R * 0.06, rnd);
      ctx.fill();
    });
  },
  onion(ctx, R, rnd) {
    ctx.lineWidth = R * 0.014;
    spots(ctx, 14, R, rnd, (x, y, a) => {
      ctx.strokeStyle = 'rgba(150,40,110,.85)';
      ctx.beginPath();
      ctx.arc(x, y, R * (0.05 + rnd() * 0.04), a, a + Math.PI * (0.7 + rnd()));
      ctx.stroke();
    });
  },
  ham(ctx, R, rnd) {
    spots(ctx, 8, R, rnd, (x, y) => {
      ctx.fillStyle = '#e59a95';
      blob(ctx, x, y, R * 0.1, rnd, 7);
      ctx.fill();
    });
  },
  prosciutto(ctx, R, rnd) {
    spots(ctx, 7, R, rnd, (x, y, a) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(200,70,70,.9)';
      blob(ctx, 0, 0, R * 0.13, rnd, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,235,225,.8)';
      ctx.lineWidth = R * 0.015;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.1, 0.3, 1.8);
      ctx.stroke();
      ctx.restore();
    });
  },
  arugula(ctx, R, rnd) {
    spots(ctx, 45, R, rnd, (x, y, a) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = rnd() > 0.5 ? '#2f6b1f' : '#4a8a2a';
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.06, R * 0.015, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }, 0.6);
  },
  parmesan(ctx, R, rnd) {
    ctx.fillStyle = '#f3e3b5';
    spots(ctx, 18, R, rnd, (x, y, a) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillRect(-R * 0.03, -R * 0.01, R * 0.06, R * 0.02);
      ctx.restore();
    });
  },
  mushroom(ctx, R, rnd) {
    spots(ctx, 10, R, rnd, (x, y, a) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = '#b89a78';
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.06, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-R * 0.015, 0, R * 0.03, R * 0.05);
      ctx.restore();
    });
  },
  artichoke(ctx, R, rnd) {
    spots(ctx, 6, R, rnd, (x, y) => {
      ctx.fillStyle = '#9aa85c';
      blob(ctx, x, y, R * 0.07, rnd, 6);
      ctx.fill();
      ctx.fillStyle = '#c8c98a';
      blob(ctx, x, y, R * 0.035, rnd, 6);
      ctx.fill();
    });
  },
  olive(ctx, R, rnd) {
    spots(ctx, 12, R, rnd, (x, y) => {
      ctx.strokeStyle = '#1b1712';
      ctx.lineWidth = R * 0.02;
      ctx.beginPath();
      ctx.arc(x, y, R * 0.025, 0, Math.PI * 2);
      ctx.stroke();
    });
  },
  gorgonzola(ctx, R, rnd) {
    spots(ctx, 14, R, rnd, (x, y) => {
      ctx.fillStyle = 'rgba(245,240,215,.95)';
      blob(ctx, x, y, R * 0.06, rnd);
      ctx.fill();
      ctx.fillStyle = 'rgba(70,95,90,.6)';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + (rnd() - 0.5) * R * 0.06, y + (rnd() - 0.5) * R * 0.06, R * 0.01, R * 0.01);
    });
  },
  sausage(ctx, R, rnd) {
    spots(ctx, 16, R, rnd, (x, y) => {
      ctx.fillStyle = '#8b5a3c';
      blob(ctx, x, y, R * 0.04, rnd, 6);
      ctx.fill();
    });
  },
  potato(ctx, R, rnd) {
    spots(ctx, 10, R, rnd, (x, y) => {
      ctx.fillStyle = '#e8c76a';
      ctx.beginPath();
      ctx.arc(x, y, R * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,100,30,.6)';
      ctx.lineWidth = R * 0.008;
      ctx.stroke();
    });
  },
  rosemary(ctx, R, rnd) {
    ctx.strokeStyle = '#3d5a2a';
    ctx.lineWidth = R * 0.008;
    spots(ctx, 30, R, rnd, (x, y, a) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * R * 0.03, y + Math.sin(a) * R * 0.03);
      ctx.stroke();
    });
  },
  tuna(ctx, R, rnd) {
    spots(ctx, 16, R, rnd, (x, y) => {
      ctx.fillStyle = '#c9a98a';
      blob(ctx, x, y, R * 0.045, rnd, 7);
      ctx.fill();
    });
  },
  caper(ctx, R, rnd) {
    ctx.fillStyle = '#5c6b2c';
    spots(ctx, 20, R, rnd, (x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, R * 0.014, 0, Math.PI * 2);
      ctx.fill();
    });
  },
  eggplant(ctx, R, rnd) {
    spots(ctx, 7, R, rnd, (x, y) => {
      ctx.fillStyle = '#3b2340';
      ctx.beginPath();
      ctx.arc(x, y, R * 0.085, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c9a86a';
      ctx.beginPath();
      ctx.arc(x, y, R * 0.07, 0, Math.PI * 2);
      ctx.fill();
    });
  },
  zucchini(ctx, R, rnd) {
    spots(ctx, 7, R, rnd, (x, y) => {
      ctx.fillStyle = '#2f5a24';
      ctx.beginPath();
      ctx.arc(x, y, R * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d9d79a';
      ctx.beginPath();
      ctx.arc(x, y, R * 0.05, 0, Math.PI * 2);
      ctx.fill();
    });
  },
  pepper(ctx, R, rnd) {
    ctx.lineWidth = R * 0.03;
    spots(ctx, 8, R, rnd, (x, y, a) => {
      ctx.strokeStyle = rnd() > 0.5 ? '#c9361d' : '#e2a81c';
      ctx.beginPath();
      ctx.arc(x, y, R * 0.06, a, a + 1.4);
      ctx.stroke();
    });
  },
  cochinita(ctx, R, rnd) {
    ctx.lineCap = 'round';
    spots(ctx, 60, R, rnd, (x, y, a) => {
      ctx.strokeStyle = rnd() > 0.5 ? '#b5541c' : '#8f3d14';
      ctx.lineWidth = R * 0.018;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * R * 0.06, y + Math.sin(a) * R * 0.06);
      ctx.stroke();
    });
  },
  habanero(ctx, R, rnd) {
    ctx.fillStyle = '#f07d12';
    spots(ctx, 14, R, rnd, (x, y) => {
      blob(ctx, x, y, R * 0.018, rnd, 5);
      ctx.fill();
    });
  },
  cherry(ctx, R, rnd) {
    spots(ctx, 12, R, rnd, (x, y) => {
      const r = R * 0.055;
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      g.addColorStop(0, '#ff6a4a');
      g.addColorStop(1, '#a8160c');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  },
  garlic(ctx, R, rnd) {
    ctx.fillStyle = '#f2e6c4';
    spots(ctx, 16, R, rnd, (x, y, a) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.025, R * 0.015, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  },
  oregano(ctx, R, rnd) {
    ctx.fillStyle = 'rgba(70,90,40,.8)';
    spots(ctx, 160, R, rnd, (x, y) => ctx.fillRect(x, y, R * 0.008, R * 0.008));
  },
  nutella(ctx, R, rnd) {
    ctx.strokeStyle = '#4a2512';
    ctx.lineWidth = R * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 7; a += 0.1) {
      const r = (a / (Math.PI * 7)) * R * 0.75;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.stroke();
  },
  strawberry(ctx, R, rnd) {
    spots(ctx, 9, R, rnd, (x, y, a) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = '#d4202c';
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.07);
      ctx.quadraticCurveTo(R * 0.07, -R * 0.02, 0, R * 0.06);
      ctx.quadraticCurveTo(-R * 0.07, -R * 0.02, 0, -R * 0.07);
      ctx.fill();
      ctx.fillStyle = '#ffd0c8';
      ctx.beginPath();
      ctx.ellipse(0, -R * 0.01, R * 0.02, R * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  },
};

/** Pizza vista desde arriba, fondo transparente. */
export function drawPizza(pizza, size = 1024, seed = 7) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const rnd = rand(seed + pizza.name.length * 131);
  const R = size * 0.47;
  ctx.translate(size / 2, size / 2);

  // Cornicione (borde inflado con manchas de horno de leña).
  const crust = ctx.createRadialGradient(0, 0, R * 0.78, 0, 0, R);
  crust.addColorStop(0, '#c98b45');
  crust.addColorStop(0.45, '#e6b56f');
  crust.addColorStop(0.8, '#d4954d');
  crust.addColorStop(1, '#8a4f22');
  ctx.fillStyle = crust;
  blob(ctx, 0, 0, R, () => 0.72 + rnd() * 0.1, 40);
  ctx.fill();
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const d = R * (0.84 + rnd() * 0.12);
    ctx.fillStyle = `rgba(${40 + rnd() * 30},${20 + rnd() * 15},10,${0.35 + rnd() * 0.45})`;
    blob(ctx, Math.cos(a) * d, Math.sin(a) * d, R * (0.012 + rnd() * 0.03), rnd, 7);
    ctx.fill();
  }

  // Base: salsa, crema o masa (postre).
  const inner = R * 0.8;
  const base = ctx.createRadialGradient(0, 0, 0, 0, 0, inner);
  if (pizza.dessert) {
    base.addColorStop(0, '#d9a564');
    base.addColorStop(1, '#c58a47');
  } else if (pizza.white) {
    base.addColorStop(0, '#f4ead0');
    base.addColorStop(1, '#e7d3a6');
  } else {
    base.addColorStop(0, '#c4321c');
    base.addColorStop(0.8, '#ab2614');
    base.addColorStop(1, '#8f2410');
  }
  ctx.fillStyle = base;
  blob(ctx, 0, 0, inner, () => 0.86 + rnd() * 0.06, 30);
  ctx.fill();

  // Mozzarella fundida con puntos dorados.
  if (!pizza.noCheese) {
    for (let i = 0; i < (pizza.white ? 26 : 16); i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * inner * 0.75;
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d;
      const r = R * (0.08 + rnd() * 0.07);
      const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
      g.addColorStop(0, 'rgba(255,250,232,1)');
      g.addColorStop(0.7, 'rgba(250,238,205,.95)');
      g.addColorStop(1, 'rgba(240,220,170,0)');
      ctx.fillStyle = g;
      blob(ctx, x, y, r, rnd, 10);
      ctx.fill();
      if (rnd() > 0.5) {
        ctx.fillStyle = 'rgba(190,120,40,.35)';
        blob(ctx, x + r * 0.2, y, r * 0.25, rnd, 6);
        ctx.fill();
      }
    }
  }

  for (const t of pizza.toppings || []) TOPPING[t]?.(ctx, R, rnd);

  // Aceite brillante y ligera sombra interior para dar volumen.
  if (!pizza.dessert) {
    ctx.fillStyle = 'rgba(255,200,60,.08)';
    spots(ctx, 30, R, rnd, (x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, R * 0.02, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    spots(ctx, 300, R, rnd, (x, y) => ctx.fillRect(x, y, 2, 2), 0.95);
  }
  const shade = ctx.createRadialGradient(0, 0, R * 0.6, 0, 0, R);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(40,15,0,.25)');
  ctx.fillStyle = shade;
  blob(ctx, 0, 0, R, () => 1, 40);
  ctx.fill();
  return c;
}

// ---------- Mantel de cuadros rojo y blanco (tovaglia a quadretti) ----------
export function drawTablecloth(size = 2048, squares = 16) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const s = size / squares;
  ctx.fillStyle = '#f5efe4';
  ctx.fillRect(0, 0, size, size);
  // Franjas horizontales y verticales semitransparentes: el cruce queda más intenso (como el tejido real).
  ctx.fillStyle = 'rgba(160,18,24,.62)';
  for (let i = 0; i < squares; i += 2) {
    ctx.fillRect(i * s, 0, s, size);
    ctx.fillRect(0, i * s, size, s);
  }
  // Trama del tejido.
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const rnd = rand(3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const weave = ((x >> 1) + (y >> 1)) & 1 ? 8 : -6;
      const n = (rnd() - 0.5) * 18 + weave;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------- Madera rústica ----------
export function drawWood(w = 1024, h = 1024) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = rand(11);
  ctx.fillStyle = '#5b3418';
  ctx.fillRect(0, 0, w, h);
  const planks = 6;
  const ph = h / planks;
  for (let p = 0; p < planks; p++) {
    const tone = 0.85 + rnd() * 0.3;
    ctx.fillStyle = `rgb(${92 * tone},${56 * tone},${28 * tone})`;
    ctx.fillRect(0, p * ph + 2, w, ph - 4);
    for (let k = 0; k < 70; k++) {
      const y = p * ph + rnd() * ph;
      ctx.strokeStyle = `rgba(${30 + rnd() * 40},${15 + rnd() * 20},5,${0.15 + rnd() * 0.25})`;
      ctx.lineWidth = 0.5 + rnd() * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.01 + k) * 3 * rnd());
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(20,10,4,.8)';
    ctx.fillRect(0, p * ph, w, 3);
  }
  return c;
}

// ---------- Mapa estilizado del centro de Mérida ----------
export function drawMap(size = 1024) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const rnd = rand(21);
  ctx.fillStyle = '#d9c9a6';
  ctx.fillRect(0, 0, size, size);
  // Cuadrícula colonial (calles numeradas de Mérida).
  const step = size / 14;
  ctx.strokeStyle = '#fffaf0';
  ctx.lineWidth = step * 0.22;
  for (let i = 0; i <= 14; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  // Paseo de Montejo (diagonal) y parques.
  ctx.strokeStyle = '#e89a2c';
  ctx.lineWidth = step * 0.4;
  ctx.beginPath();
  ctx.moveTo(size * 0.55, size * 0.5);
  ctx.lineTo(size * 0.72, 0);
  ctx.stroke();
  ctx.fillStyle = '#7fae5a';
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rnd() * 13) * step;
    const y = Math.floor(rnd() * 13) * step;
    ctx.fillRect(x + step * 0.12, y + step * 0.12, step * 0.76, step * 0.76);
  }
  ctx.fillStyle = '#7a6a55';
  ctx.font = `600 ${size * 0.03}px Manrope, sans-serif`;
  ctx.fillText('CENTRO', size * 0.3, size * 0.58);
  ctx.fillText('MONTEJO', size * 0.66, size * 0.2);
  ctx.font = `italic 500 ${size * 0.06}px "Playfair Display", serif`;
  ctx.fillStyle = '#3a2a1a';
  ctx.fillText('Mérida', size * 0.06, size * 0.94);
  return c;
}

// ---------- Tarjeta "Riservato" ----------
export function drawCard(lines, w = 1024, h = 512) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbf6ea';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#b31b1f';
  ctx.lineWidth = 10;
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.fillStyle = '#1f6b3a';
  ctx.fillRect(24, 24, (w - 48) / 3, 10);
  ctx.fillStyle = '#b31b1f';
  ctx.fillRect(24 + ((w - 48) * 2) / 3, 24, (w - 48) / 3, 10);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2a1a10';
  ctx.font = `italic 500 ${h * 0.3}px "Playfair Display", serif`;
  ctx.fillText(lines[0], w / 2, h * 0.55);
  ctx.font = `600 ${h * 0.09}px Manrope, sans-serif`;
  ctx.fillStyle = '#7a6a55';
  ctx.fillText(lines[1], w / 2, h * 0.78);
  return c;
}

// ---------- Etiqueta de botella de vino ----------
export function drawLabel(w = 1024, h = 256) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#123018';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#efe2c0';
  ctx.fillRect(w * 0.35, 0, w * 0.3, h);
  ctx.fillStyle = '#6b1414';
  ctx.textAlign = 'center';
  ctx.font = `italic 600 ${h * 0.2}px "Playfair Display", serif`;
  ctx.fillText('Cirò', w * 0.5, h * 0.45);
  ctx.font = `600 ${h * 0.09}px Manrope, sans-serif`;
  ctx.fillText('ROSSO · CALABRIA', w * 0.5, h * 0.7);
  return c;
}

// ---------- Banda decorativa del plato (filo verde-blanco-rojo) ----------
export function drawPlateBand(size = 512) {
  const c = canvas(16, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbfaf6';
  ctx.fillRect(0, 0, 16, size);
  // v recorre el perfil del plato de centro (0) a borde (1).
  const band = (a, b, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(0, a * size, 16, (b - a) * size);
  };
  band(0.83, 0.845, '#1f6b3a');
  band(0.855, 0.87, '#b31b1f');
  band(0.965, 1, '#c9a24a');
  return c;
}
