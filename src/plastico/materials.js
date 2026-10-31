import {
  CanvasTexture, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace,
} from 'three';

/*
  Materiali del plastico: estetica da modello d'architetto materico, fedele alla palette della villa
  ma semplificata. Le texture sono disegnate al volo su canvas (nessun file da scaricare).
  Le UV delle geometrie sono in metri: repeat = 1 / dimensione del motivo in metri.
*/

function canvasTexture(size, draw, metres, anisotropy) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(1 / metres, 1 / metres);
  t.anisotropy = anisotropy;
  return t;
}

// Generatore pseudo-casuale ripetibile: il plastico è sempre uguale.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function stone(ctx, n) {
  const r = rng(7);
  ctx.fillStyle = '#b9ab95';
  ctx.fillRect(0, 0, n, n);
  // corsi irregolari di pietra a spacco
  let y = 0;
  while (y < n) {
    const h = n * (0.06 + r() * 0.07);
    let x = -r() * n * 0.1;
    while (x < n) {
      const w = n * (0.08 + r() * 0.16);
      const l = 62 + r() * 18;
      ctx.fillStyle = `hsl(${32 + r() * 10}, ${14 + r() * 10}%, ${l}%)`;
      ctx.beginPath();
      const j = () => (r() - 0.5) * n * 0.012;
      ctx.moveTo(x + 2 + j(), y + 2 + j());
      ctx.lineTo(x + w - 2 + j(), y + 2 + j());
      ctx.lineTo(x + w - 2 + j(), y + h - 2 + j());
      ctx.lineTo(x + 2 + j(), y + h - 2 + j());
      ctx.closePath();
      ctx.fill();
      x += w;
    }
    y += h;
  }
}

function planks(ctx, n) {
  const r = rng(3);
  const rows = 8; // doghe di 12,5 cm su 1 m
  for (let i = 0; i < rows; i++) {
    const l = 30 + r() * 8;
    ctx.fillStyle = `hsl(${24 + r() * 6}, ${42 + r() * 10}%, ${l}%)`;
    ctx.fillRect(0, (i * n) / rows, n, n / rows);
    ctx.fillStyle = 'rgba(30,16,8,0.55)';
    ctx.fillRect(0, ((i + 1) * n) / rows - 2, n, 2);
    const cut = r() * n;
    ctx.fillRect(cut, (i * n) / rows, 2, n / rows);
  }
}

function slate(ctx, n) {
  const r = rng(11);
  const cols = 2; const rows = 4; // lastre 60 x 120 cm su 1,2 m
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      ctx.fillStyle = `hsl(210, 4%, ${26 + r() * 5}%)`;
      ctx.fillRect((i * n) / cols, (j * n) / rows, n / cols, n / rows);
    }
  }
  ctx.strokeStyle = 'rgba(10,10,10,0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo((i * n) / cols, 0); ctx.lineTo((i * n) / cols, n); ctx.stroke(); }
  for (let j = 0; j <= rows; j++) { ctx.beginPath(); ctx.moveTo(0, (j * n) / rows); ctx.lineTo(n, (j * n) / rows); ctx.stroke(); }
}

export function createMaterials(renderer) {
  const an = renderer.capabilities.getMaxAnisotropy();
  const m = {};

  m.anthracite = new MeshStandardMaterial({ color: '#2b2b2c', roughness: 0.82, metalness: 0.05 });
  m.stone = new MeshStandardMaterial({ map: canvasTexture(512, stone, 2.4, an), roughness: 0.95 });
  m.solid = m.anthracite;
  m.glass = new MeshStandardMaterial({
    color: '#11181c', roughness: 0.05, metalness: 0.85, envMapIntensity: 1.4,
    transparent: true, opacity: 0.8, depthWrite: false,
  });
  m.frame = new MeshStandardMaterial({ color: '#141414', roughness: 0.55, metalness: 0.3 });
  m.wood = new MeshStandardMaterial({ map: canvasTexture(512, planks, 1, an), roughness: 0.72 });
  m.slats = new MeshStandardMaterial({ color: '#5a3b26', roughness: 0.7 });
  m.slate = new MeshStandardMaterial({ map: canvasTexture(256, slate, 1.2, an), roughness: 0.9 });
  m.stepStone = new MeshStandardMaterial({ color: '#2f3134', roughness: 0.85 });
  m.solar = new MeshStandardMaterial({ color: '#141b2a', roughness: 0.25, metalness: 0.6 });
  m.furniture = new MeshStandardMaterial({ color: '#8e8a84', roughness: 0.9 });
  m.terrain = new MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  m.board = new MeshStandardMaterial({ color: '#1b1b1c', roughness: 0.7 });
  m.tree = new MeshStandardMaterial({ color: '#a7ad97', roughness: 0.95, flatShading: true });
  m.trunk = new MeshStandardMaterial({ color: '#6b6560', roughness: 0.9 });
  m.parapet = new MeshStandardMaterial({ color: '#e9e4dc', roughness: 0.9 });
  m.railing = m.frame;
  m.door = m.frame;

  // Interni illuminati visti attraverso il vetro (come nella foto al crepuscolo).
  m.glow = new MeshBasicMaterial({ color: new Color('#e9a868'), side: DoubleSide });
  // Luci lineari e faretti: colore caldo delle strisce LED della villa.
  m.led = new MeshBasicMaterial({ color: new Color('#ffd49a').multiplyScalar(2.2) });

  // Acqua: superficie che si muove appena (normali perturbate nello shader) e luce interna.
  m.water = new MeshStandardMaterial({
    color: '#174f5c', roughness: 0.06, metalness: 0.1, emissive: '#1e9fb2', emissiveIntensity: 0.16,
    envMapIntensity: 1.2,
  });
  m.water.userData.time = { value: 0 };
  m.water.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = m.water.userData.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWorldPos;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 p = vWorldPos.xz;
          float t = uTime;
          vec2 g = vec2(
            cos(p.x * 3.1 + t * 1.3) * 0.5 + cos(p.x * 1.7 - p.y * 2.3 + t * 0.9) * 0.5,
            cos(p.y * 2.7 - t * 1.1) * 0.5 + cos(p.y * 1.3 + p.x * 2.1 + t * 0.7) * 0.5
          ) * 0.06;
          vec3 wn = normalize(vec3(-g.x, 1.0, -g.y));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
        }`);
  };

  return m;
}
