// Conversión de canvas a texturas de Three.js y carga de fotos como textura.
import * as THREE from 'three';
import { loadImage } from './images.js';
import { placeholderCanvas } from './textures.js';
import { t } from '../i18n.js';

export function toTexture(canvas, { repeat = 1, srgb = true, aniso = 4, wrap = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = aniso;
  tex.needsUpdate = true;
  return tex;
}

// Foto como textura; si falta, marcador con el nombre del archivo.
export async function loadTexture(names, w = 1024, h = 683) {
  const res = await loadImage(names);
  const src = res.ok ? res.img : placeholderCanvas(res.name, w, h, t('img.missing'));
  const tex = res.ok ? new THREE.Texture(src) : new THREE.CanvasTexture(src);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  tex.userData.ok = res.ok;
  tex.userData.aspect = (src.naturalWidth || src.width) / (src.naturalHeight || src.height);
  return tex;
}
