import {
  CanvasTexture, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace,
} from 'three';

/*
  Materiali della maquette da studio, come un vero plastico d'architetto fotografato:
  - volumi in cartoncino bianco opaco, torre in pietra in carta goffrata chiara;
  - terreno a strati in legno di tiglio tagliato al laser (bordi appena più scuri);
  - vetro in acrilico trasparente, acqua in acrilico azzurro pallido, deck e frangisole in impiallacciatura;
  - alberi a sfera su stecchino, basamento laccato scuro.
  Niente colori "finti": la palette è quella dei materiali fisici di un plastico.
  Le UV delle geometrie sono in metri: repeat = 1 / dimensione del motivo in metri.
*/

function canvasTexture(size, draw, metres, anisotropy) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(1 / metres, 1 / metres);
  t.anisotropy = anisotropy;
  return t;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Carta goffrata a corsi irregolari, quasi monocroma (la torre in pietra). */
function stonePaper(ctx, n) {
  const r = rng(7);
  ctx.fillStyle = '#e4ddd2';
  ctx.fillRect(0, 0, n, n);
  ctx.strokeStyle = 'rgba(120,108,92,0.35)';
  ctx.lineWidth = 1.2;
  let y = 0;
  while (y < n) {
    const h = n * (0.07 + r() * 0.06);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(n, y + (r() - 0.5) * 3); ctx.stroke();
    let x = r() * n * 0.12;
    while (x < n) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 4, y + h); ctx.stroke();
      x += n * (0.1 + r() * 0.16);
    }
    y += h;
  }
}

/** Impiallacciatura chiara con venatura sottile e doghe appena incise. */
function veneer(ctx, n, rows = 8, base = [34, 38, 74]) {
  const r = rng(3);
  for (let i = 0; i < rows; i++) {
    ctx.fillStyle = `hsl(${base[0] + r() * 3}, ${base[1] + r() * 6}%, ${base[2] + r() * 4}%)`;
    ctx.fillRect(0, (i * n) / rows, n, n / rows);
    ctx.strokeStyle = 'rgba(120,90,60,0.12)';
    for (let k = 0; k < 4; k++) {
      const yy = (i * n) / rows + r() * (n / rows);
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.bezierCurveTo(n * 0.3, yy + 2, n * 0.6, yy - 2, n, yy + 1); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(90,64,40,0.28)';
    ctx.fillRect(0, ((i + 1) * n) / rows - 1, n, 1);
  }
}

export function createMaterials(renderer) {
  const an = renderer.capabilities.getMaxAnisotropy();
  const m = {};

  // Cartoncino bianco caldo (volumi, solai, sbalzi)
  m.anthracite = new MeshStandardMaterial({ color: '#f1ede6', roughness: 0.92 });
  m.solid = m.anthracite;
  m.stone = new MeshStandardMaterial({ map: canvasTexture(512, stonePaper, 2.4, an), roughness: 0.95 });
  m.parapet = m.anthracite;

  // Acrilico trasparente
  m.glass = new MeshStandardMaterial({
    color: '#dfe7ea', roughness: 0.04, metalness: 0, envMapIntensity: 1.6,
    transparent: true, opacity: 0.22, depthWrite: false,
  });
  // Telai e parapetti: cartoncino grigio chiaro e filo metallico sottile
  m.frame = new MeshStandardMaterial({ color: '#cfcac2', roughness: 0.85 });
  m.railing = new MeshStandardMaterial({ color: '#a9a7a3', roughness: 0.4, metalness: 0.6 });
  m.door = m.frame;

  m.wood = new MeshStandardMaterial({ map: canvasTexture(512, (c, n) => veneer(c, n, 8, [30, 40, 66]), 1, an), roughness: 0.75 });
  m.slats = new MeshStandardMaterial({ color: '#cfb48f', roughness: 0.78 });
  m.slate = new MeshStandardMaterial({ color: '#d9d4cc', roughness: 0.9 });
  m.stepStone = new MeshStandardMaterial({ color: '#c9c3ba', roughness: 0.9 });
  m.solar = new MeshStandardMaterial({ color: '#b9b6b1', roughness: 0.6 });
  m.furniture = new MeshStandardMaterial({ color: '#e6e1d9', roughness: 0.9 });

  // Terreno in tiglio a strati (colori per vertice: piani chiari, bordi tagliati appena più scuri)
  m.terrain = new MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  m.board = new MeshStandardMaterial({ color: '#1c1916', roughness: 0.45, metalness: 0.05 });

  // Alberi: sfere lisce in legno chiaro su stecchino
  m.tree = new MeshStandardMaterial({ color: '#e2d5bf', roughness: 0.85 });
  m.trunk = new MeshStandardMaterial({ color: '#b39a78', roughness: 0.8 });

  // Interni accesi e luci lineari: un accenno caldo, come i LED di un plastico illuminato.
  m.glow = new MeshBasicMaterial({ color: new Color('#f6dcb8'), side: DoubleSide, transparent: true, opacity: 0.55 });
  m.led = new MeshBasicMaterial({ color: new Color('#ffdcae').multiplyScalar(1.6) });

  // Acqua: acrilico azzurro pallido, ferma come in un plastico vero.
  m.water = new MeshStandardMaterial({
    color: '#bcd6d9', roughness: 0.03, metalness: 0, envMapIntensity: 1.5,
    transparent: true, opacity: 0.88,
  });
  m.water.userData.time = { value: 0 };

  return m;
}
