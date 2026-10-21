import * as THREE from 'three';
import gsap from 'gsap';

// Loader: fondo rosa antico, una linea bianca di 1px (40% dello schermo) che si riempie
// con il caricamento reale degli asset. Alla fine la linea si allunga a tutta larghezza,
// diventa l'orizzonte e il rosa si dissolve nella scena.

export function createLoader({ reducedMotion = false } = {}) {
  const root = document.getElementById('loader');
  const line = root.querySelector('.loader-line');
  const fill = root.querySelector('.loader-fill');

  const manager = new THREE.LoadingManager();
  // byte per file (quando il server li fornisce), altrimenti si conta per elemento
  const files = new Map();
  let target = 0;
  let shown = 0;
  let extra = { done: 0, total: 0 }; // passi non di rete (es. generazione texture)

  function recompute() {
    let loaded = 0, total = 0, items = 0, itemsDone = 0;
    for (const f of files.values()) {
      items++;
      if (f.done) itemsDone++;
      if (f.total > 0) {
        loaded += Math.min(f.loaded, f.total);
        total += f.total;
      }
    }
    const byBytes = total > 0 ? loaded / total : 0;
    const byItems = items > 0 ? itemsDone / items : 0;
    const net = items === 0 ? 1 : Math.max(byBytes, byItems);
    const ext = extra.total > 0 ? extra.done / extra.total : 1;
    const wNet = items > 0 ? 0.85 : 0;
    const wExt = extra.total > 0 ? 1 - wNet : 0;
    target = Math.max(target, wNet + wExt > 0 ? (net * wNet + ext * wExt) / (wNet + wExt) : 0);
  }

  manager.onStart = (url) => {
    if (!files.has(url)) files.set(url, { loaded: 0, total: 0, done: false });
    recompute();
  };
  manager.itemStart = ((orig) => (url) => {
    if (!files.has(url)) files.set(url, { loaded: 0, total: 0, done: false });
    orig.call(manager, url);
  })(manager.itemStart);
  manager.itemEnd = ((orig) => (url) => {
    const f = files.get(url);
    if (f) {
      f.done = true;
      if (f.total) f.loaded = f.total;
    }
    recompute();
    orig.call(manager, url);
  })(manager.itemEnd);

  // da collegare all'onProgress dei loader: aggiorna i byte del singolo file
  function onFileProgress(url, e) {
    const f = files.get(url) || { loaded: 0, total: 0, done: false };
    f.loaded = e.loaded;
    if (e.lengthComputable) f.total = e.total;
    files.set(url, f);
    recompute();
  }

  function setExtraSteps(total) {
    extra = { done: 0, total };
    recompute();
  }
  function stepDone() {
    extra.done = Math.min(extra.total, extra.done + 1);
    recompute();
  }

  // la linea insegue il valore reale con un piccolo smorzamento (mai a scatti)
  let raf = 0;
  function tick() {
    shown += (target - shown) * 0.12;
    if (target - shown < 0.0005) shown = target;
    fill.style.transform = `scaleX(${shown.toFixed(4)})`;
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  function finish() {
    target = 1;
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: () => {
        cancelAnimationFrame(raf);
        root.remove();
        resolve();
      } });
      tl.to({}, { duration: reducedMotion ? 0.1 : 0.45, onUpdate: () => {} });
      tl.add(() => {
        cancelAnimationFrame(raf);
        fill.style.transform = 'scaleX(1)';
      });
      // la linea si allunga fino ai bordi
      tl.to(line, { width: '100%', duration: reducedMotion ? 0.01 : 1.0, ease: 'power3.inOut' });
      // crossfade del rosa nella scena; la linea svanisce poco dopo, sull'orizzonte reale
      tl.addLabel('fade');
      tl.to(root, { backgroundColor: 'rgba(217,165,160,0)', duration: 1.2, ease: 'power1.inOut' }, 'fade');
      tl.to(line, { opacity: 0, duration: 0.7, ease: 'power1.in' }, 'fade+=0.5');
    });
  }

  return { manager, onFileProgress, setExtraSteps, stepDone, finish };
}
