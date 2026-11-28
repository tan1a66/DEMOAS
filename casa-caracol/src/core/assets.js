import * as THREE from 'three';
import { CONFIG, PALETTE } from '../config.js';

// Carga de fotos reales con segmento de reemplazo automático si el archivo no existe.

export const loadImage = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = async () => {
      try {
        await img.decode?.();
      } catch {
        /* algunas versiones de Safari fallan en decode() con imágenes ya cargadas */
      }
      resolve(img.naturalWidth > 0 ? img : null);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });

// Reduce las fotos muy grandes antes de subirlas a la GPU (memoria en iPhone).
const fitToTexture = (img, max) => {
  const { naturalWidth: w, naturalHeight: h } = img;
  const s = Math.min(1, max / Math.max(w, h));
  if (s >= 1) return img;
  const c = document.createElement('canvas');
  c.width = Math.round(w * s);
  c.height = Math.round(h * s);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
};

export const loadPhotoTexture = async (name) => {
  const img = await loadImage(`${CONFIG.photos.base}${name}`);
  if (!img) return null;
  const source = fitToTexture(img, CONFIG.photos.maxTextureSize);
  const tex = source instanceof HTMLCanvasElement ? new THREE.CanvasTexture(source) : new THREE.Texture(source);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return { texture: tex, aspect: img.naturalWidth / img.naturalHeight, width: img.naturalWidth, height: img.naturalHeight };
};

// Recortes "cover" de la foto en iPhone (9:19,5) y en escritorio (16:9), en coordenadas 0–1.
const cropRect = (photoAspect, screenAspect) => {
  if (screenAspect < photoAspect) {
    const w = screenAspect / photoAspect;
    return [0.5 - w / 2, 0, w, 1];
  }
  const h = photoAspect / screenAspect;
  return [0, 0.5 - h / 2, 1, h];
};

// Rótulo transparente del segmento de reemplazo del match cut: nombre del archivo y
// las zonas que se verán en iPhone y en escritorio (guía para el fotógrafo).
export const matchcutLabel = (name, aspect, note) => {
  const W = 1200;
  const H = Math.round(W / aspect);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const guides = [
    ['iPhone', 390 / 844],
    ['16:9', 16 / 9],
  ];
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 12]);
  ctx.font = '500 26px "Inter Variable", system-ui, sans-serif';
  guides.forEach(([label, sa], i) => {
    const [x, y, w, h] = cropRect(aspect, sa);
    ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)';
    ctx.strokeRect(x * W + 6, y * H + 6, w * W - 12, h * H - 12);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText(label, x * W + 22, y * H + 44);
  });
  ctx.setLineDash([]);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = '400 60px "Fraunces Variable", Georgia, serif';
  ctx.fillText(name, W / 2, H * 0.86);
  ctx.font = '500 24px "Inter Variable", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(note, W / 2, H * 0.86 + 44);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

// Segmento de reemplazo genérico (secciones de la casa, Fase 2): paleta + nombre.
export const placeholderDataURL = (name, w = 1200, h = 1500, tint = PALETTE.sand) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, PALETTE.calce);
  g.addColorStop(1, tint);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(30,46,56,0.55)';
  ctx.textAlign = 'center';
  ctx.font = `300 ${Math.round(w / 18)}px "Fraunces Variable", Georgia, serif`;
  ctx.fillText(name, w / 2, h / 2);
  return c.toDataURL('image/jpeg', 0.8);
};
