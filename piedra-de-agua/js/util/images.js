// Carga de fotos con alternativa elegante: si una imagen falta se dibuja un
// marcador con el nombre del archivo, sin romper la página.
import { CONFIG } from '../config.js?v=2';
import { t } from '../i18n.js?v=2';
import { placeholderCanvas } from './textures.js?v=2';

const cache = new Map();

function tryLoad(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// names: string o lista de archivos alternativos (se usa el primero que exista).
export function loadImage(names) {
  const list = Array.isArray(names) ? names : [names];
  const key = list.join('|');
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      for (const n of list) {
        const img = await tryLoad(CONFIG.imagesPath + n);
        if (img) return { ok: true, img, name: n };
      }
      return { ok: false, img: null, name: list[0] };
    })());
  }
  return cache.get(key);
}

const phCache = new Map();
export function placeholderURL(name, w = 1200, h = 800) {
  const key = `${name}@${w}x${h}`;
  if (!phCache.has(key)) phCache.set(key, placeholderCanvas(name, w, h, t('img.missing')).toDataURL('image/jpeg', 0.86));
  return phCache.get(key);
}

// Asigna la foto a un <img>; si falta, pone el marcador.
export async function setImg(el, names, w = 1200, h = 800) {
  const res = await loadImage(names);
  if (res.ok) {
    el.src = res.img.src;
    el.classList.remove('is-placeholder');
  } else {
    el.src = placeholderURL(res.name, w, h);
    el.classList.add('is-placeholder');
  }
  return res;
}

export function imgEl(names, alt = '', w = 1200, h = 800, cls = '') {
  const el = new Image();
  el.alt = alt;
  el.decoding = 'async';
  if (cls) el.className = cls;
  setImg(el, names, w, h);
  return el;
}
