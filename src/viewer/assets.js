import {
  DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RedFormat, SRGBColorSpace, Texture,
} from 'three';
import { asset, hasAsset } from '../asset.js';

/*
  Carica foto e mappe di profondità delle scene, le tiene in cache e le libera (dispose)
  quando la scena non è più vicina a quella corrente: su Safari mobile la memoria delle
  texture è il primo limite.
*/

const FULL_THRESHOLD = 2560;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
    img.src = url;
  });
}

function flatDepth() {
  const tex = new DataTexture(new Uint8Array([128]), 1, 1, RedFormat);
  tex.colorSpace = NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export class AssetCache {
  constructor(renderer) {
    this.renderer = renderer;
    this.maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    this.entries = new Map(); // id -> Promise<asset>
    this.ready = new Map(); // id -> asset
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.variant = Math.max(screen.width, screen.height) * dpr > FULL_THRESHOLD ? 'full' : 'mobile';
  }

  load(scene) {
    if (this.entries.has(scene.id)) return this.entries.get(scene.id);
    const p = this.#create(scene).then((asset) => {
      this.ready.set(scene.id, asset);
      return asset;
    });
    p.catch(() => this.entries.delete(scene.id));
    this.entries.set(scene.id, p);
    return p;
  }

  get(id) {
    return this.ready.get(id) || null;
  }

  async #create(scene) {
    const full = `${scene.image}_full.jpg`;
    const src = this.variant === 'full' && hasAsset(full) ? full : `${scene.image}_mobile.jpg`;
    const [img, depthImg] = await Promise.all([
      loadImage(asset(src)),
      loadImage(asset(scene.depth)).catch(() => null),
    ]);

    const image = new Texture(img);
    image.colorSpace = SRGBColorSpace;
    image.anisotropy = this.maxAnisotropy;
    image.minFilter = LinearMipmapLinearFilter;
    image.magFilter = LinearFilter;
    image.generateMipmaps = true;
    image.needsUpdate = true;

    let depth;
    let sampler;
    if (depthImg) {
      depth = new Texture(depthImg);
      depth.colorSpace = NoColorSpace;
      depth.minFilter = LinearFilter;
      depth.magFilter = LinearFilter;
      depth.generateMipmaps = false;
      depth.needsUpdate = true;
      sampler = makeSampler(depthImg);
    } else {
      // Senza mappa: la foto resta ferma in profondità (nessuna parallasse), il resto funziona.
      depth = flatDepth();
      sampler = () => 0.5;
    }

    // Caricamento anticipato sulla GPU: niente scatti al momento della transizione.
    this.renderer.initTexture(image);
    this.renderer.initTexture(depth);

    return {
      id: scene.id,
      image,
      depth,
      sampleDepth: sampler,
      hasDepth: !!depthImg,
      width: img.naturalWidth,
      height: img.naturalHeight,
      aspect: img.naturalWidth / img.naturalHeight,
    };
  }

  /** Tiene in memoria solo le scene indicate; le altre vengono liberate. */
  keepOnly(ids) {
    const keep = new Set(ids);
    for (const [id, promise] of this.entries) {
      if (keep.has(id)) continue;
      this.entries.delete(id);
      this.ready.delete(id);
      promise.then((asset) => {
        asset.image.dispose();
        asset.depth.dispose();
      }).catch(() => {});
    }
  }
}

/** Lettura della profondità sulla CPU (per tenere i marcatori incollati alla superficie). */
function makeSampler(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  // u, v in [0,1], v verso l'alto (come le uv della texture).
  return (u, v) => {
    const x = Math.min(w - 1, Math.max(0, Math.round(u * (w - 1))));
    const y = Math.min(h - 1, Math.max(0, Math.round((1 - v) * (h - 1))));
    return data[(y * w + x) * 4] / 255;
  };
}
