import * as THREE from 'three';
import logoUrl from '../assets/brand/logo.png';

// Materiales de las herramientas DEWYOU: acero cepillado, plástico blanco, goma índigo,
// vidrio con matcha, laca lila y la gota iridiscente. Las etiquetas con el logo se dibujan
// en canvas a partir del logotipo oficial (sin descargas extra).

const logoImg = new Image();
const logoReady = new Promise((res) => {
  logoImg.onload = () => res(logoImg);
  logoImg.onerror = () => res(null);
});
logoImg.src = logoUrl;

// Lienzo con el logo; draw(ctx, w, h, img) pinta el fondo y coloca el logo
const canvasTexture = (w, h, draw, { srgb = true } = {}) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  draw(ctx, w, h, null);
  logoReady.then((img) => {
    if (!img) return;
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h, img);
    tex.needsUpdate = true;
  });
  return tex;
};

// Logo teñido de un color (el PNG es blanco con alfa)
const tinted = (img, color, w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, w, h);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, w, h);
  return c;
};

// Vetas finas de acero cepillado (canvas en escala de grises para rugosidad)
const brushed = () =>
  canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#7a7a7a';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        const y = Math.random() * h;
        const g = 100 + Math.random() * 70;
        ctx.strokeStyle = `rgba(${g},${g},${g},${0.25 + Math.random() * 0.35})`;
        ctx.lineWidth = Math.random() * 1.4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + (Math.random() - 0.5) * 3);
        ctx.stroke();
      }
    },
    { srgb: false }
  );

export const createMaterials = () => {
  const rough = brushed();
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(2, 2);

  const M = {
    steel: new THREE.MeshPhysicalMaterial({
      color: '#c4c6d0',
      metalness: 1,
      roughness: 0.2,
      roughnessMap: rough,
      anisotropy: 0.7,
      clearcoat: 0.25,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.6,
    }),
    chrome: new THREE.MeshPhysicalMaterial({ color: '#f1f2f6', metalness: 1, roughness: 0.1, envMapIntensity: 1.3, flatShading: true }),
    alu: new THREE.MeshStandardMaterial({ color: '#d4d7dd', metalness: 1, roughness: 0.28, envMapIntensity: 1.1 }),
    white: new THREE.MeshPhysicalMaterial({ color: '#f6f3f6', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.3, sheenColor: new THREE.Color('#eadff3') }),
    coral: new THREE.MeshPhysicalMaterial({ color: '#f26262', roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.15 }),
    plum: new THREE.MeshPhysicalMaterial({ color: '#584059', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 }),
    lilac: new THREE.MeshPhysicalMaterial({ color: '#c6acdc', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.35, iridescenceIOR: 1.4 }),
    purple: new THREE.MeshPhysicalMaterial({ color: '#9473c4', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    purpleDeep: new THREE.MeshPhysicalMaterial({ color: '#76589f', roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.15 }),
    green: new THREE.MeshPhysicalMaterial({ color: '#69a079', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.4, sheenColor: new THREE.Color('#d9f0d2') }),
    rubber: new THREE.MeshPhysicalMaterial({ color: '#f2eff2', roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#ffffff') }),
    drop: new THREE.MeshPhysicalMaterial({
      color: '#efe4f8',
      roughness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      iridescence: 1,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [180, 620],
      sheen: 0.5,
      sheenColor: new THREE.Color('#ffe9f6'),
      envMapIntensity: 1.2,
    }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, transparent: true, opacity: 0.22, clearcoat: 1, depthWrite: false }),
  };

  // Matcha con leche: degradado vertical con remolinos (lata DEWYOU)
  M.matcha = new THREE.MeshPhysicalMaterial({
    map: canvasTexture(128, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#d9e6bf');
      g.addColorStop(0.35, '#b9cf8c');
      g.addColorStop(0.7, '#9fbd6b');
      g.addColorStop(1, '#86a957');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = `rgba(245,248,232,${0.12 + Math.random() * 0.2})`;
        ctx.lineWidth = 2 + Math.random() * 6;
        ctx.beginPath();
        const y = Math.random() * h * 0.7;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.3, y + 20, w * 0.6, y - 25, w, y + 8);
        ctx.stroke();
      }
    }),
    roughness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    sheen: 0.5,
    sheenColor: new THREE.Color('#f4fbe8'),
  });

  // Logo blanco impreso en la gua sha
  M.print = new THREE.MeshStandardMaterial({
    map: canvasTexture(1024, 164, (ctx, w, h, img) => img && ctx.drawImage(img, 0, 0, w, h)),
    transparent: true,
    roughness: 0.5,
    metalness: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  // Pelota índigo con el logo lavanda alrededor del ecuador
  M.ball = new THREE.MeshPhysicalMaterial({
    map: canvasTexture(1024, 512, (ctx, w, h, img) => {
      ctx.fillStyle = '#2d2d84';
      ctx.fillRect(0, 0, w, h);
      if (!img) return;
      const lw = w * 0.28;
      const lh = lw / 6.26;
      const logo = tinted(img, '#b6b2f0', lw, lh);
      ctx.drawImage(logo, w * 0.25 - lw / 2, h / 2 - lh / 2);
      ctx.drawImage(logo, w * 0.75 - lw / 2, h / 2 - lh / 2);
    }),
    roughness: 0.42,
    clearcoat: 0.55,
    clearcoatRoughness: 0.3,
    sheen: 0.5,
    sheenColor: new THREE.Color('#7a78e0'),
  });

  // Etiqueta redonda lila con el logo ciruela (como las de los vasos del Collagen Bar)
  M.sticker = new THREE.MeshPhysicalMaterial({
    map: canvasTexture(512, 512, (ctx, w, h, img) => {
      ctx.fillStyle = '#d9c9ea';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
      if (!img) return;
      const lw = w * 0.74;
      const lh = lw / 6.26;
      ctx.drawImage(tinted(img, '#584059', lw, lh), w / 2 - lw / 2, h / 2 - lh * 0.75);
      ctx.fillStyle = '#584059';
      ctx.font = `600 ${Math.round(w * 0.045)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('SNACK & COLLAGEN BAR', w / 2, h / 2 + lh * 0.95);
    }),
    transparent: true,
    roughness: 0.4,
    clearcoat: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    depthWrite: false,
  });

  return M;
};

// Entorno para los reflejos: una sala crema → lila con tiras de luz (como los LED de los
// espejos del local). El acero y el cromo reflejan la marca en vez de un gris neutro.
export const createEnvironment = (renderer) => {
  const env = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 48, 24);
  const top = new THREE.Color('#fffaf2');
  const mid = new THREE.Color('#f1e8f6');
  const low = new THREE.Color('#6d5a7a');
  const col = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 10;
    const c = t > 0 ? mid.clone().lerp(top, t) : mid.clone().lerp(low, Math.min(1, (-t * 1.6) ** 0.8));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const strip = (w, h, color, k, x, y, z, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    env.add(m);
  };
  strip(14, 1.4, '#ffffff', 5, 0, 7.5, -2, 0, Math.PI / 2.4); // panel cenital
  strip(1.1, 9, '#ffffff', 4, -8, 1, 3, Math.PI / 2.6); // ventana lateral
  strip(0.5, 10, '#ffd59a', 4, 7.5, 0, -3, -Math.PI / 2.8); // tira LED cálida
  strip(8, 0.45, '#ffe2b8', 3, 0, -1.5, -9); // LED del zócalo
  strip(5, 5, '#d9c2f5', 1.6, 6, -4, 6, -Math.PI / 4); // reflejo lila
  strip(4, 12, '#3a2f42', 1, 8.6, 0, 2, -Math.PI / 2); // pared oscura: da contraste al metal
  strip(3, 12, '#4a3d52', 1, -6, 0, -7, Math.PI / 5);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  geo.dispose();
  return tex;
};
