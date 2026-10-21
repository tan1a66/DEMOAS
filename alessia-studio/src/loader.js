import * as THREE from 'three';
import gsap from 'gsap';

// Loader: fondo rosa antico, una linea bianca di 1px (40% dello schermo) che si riempie
// con il caricamento reale degli asset (byte ricevuti, via THREE.LoadingManager).
// Alla fine la linea si allunga a tutta larghezza, diventa l'orizzonte e il rosa si
// dissolve nella scena.

export function createLoader({ reducedMotion = false } = {}) {
  const root = document.getElementById('loader');
  const line = root.querySelector('.loader-line');
  const fill = root.querySelector('.loader-fill');

  const manager = new THREE.LoadingManager();
  const expected = new Map(); // url -> byte attesi (dal manifest)
  const received = new Map(); // url -> byte ricevuti
  let extra = { done: 0, total: 0 }; // passi non di rete (preparazione della scena)
  let target = 0;
  let shown = 0;

  function recompute() {
    let total = 0, loaded = 0;
    for (const [url, size] of expected) {
      total += size;
      loaded += Math.min(size, received.get(url) || 0);
    }
    // file non previsti dal manifest: contano come elementi (inizio/fine)
    for (const [url, got] of received) {
      if (!expected.has(url)) {
        total += 1;
        loaded += got < 0 ? 0 : 1;
      }
    }
    const net = total > 0 ? loaded / total : 0;
    const ext = extra.total > 0 ? extra.done / extra.total : 0;
    const wExt = extra.total > 0 ? (total > 0 ? 0.06 : 1) : 0;
    target = Math.max(target, net * (1 - wExt) + ext * wExt);
  }

  manager.itemStart = ((orig) => (url) => {
    if (!received.has(url)) received.set(url, expected.has(url) ? 0 : -1);
    recompute();
    orig.call(manager, url);
  })(manager.itemStart);
  manager.itemEnd = ((orig) => (url) => {
    received.set(url, expected.get(url) ?? 1);
    recompute();
    orig.call(manager, url);
  })(manager.itemEnd);

  function expect(url, bytes) {
    expected.set(url, Math.max(1, bytes || 1));
    recompute();
  }
  // da passare come onProgress ai loader di three
  function progressFor(url) {
    return (e) => {
      if (e && e.loaded) received.set(url, e.loaded);
      recompute();
    };
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
      const tl = gsap.timeline({
        onComplete: () => {
          cancelAnimationFrame(raf);
          root.remove();
          resolve();
        },
      });
      // lascia che la linea arrivi in fondo
      tl.to({}, { duration: reducedMotion ? 0.1 : 0.45 });
      tl.add(() => {
        cancelAnimationFrame(raf);
        fill.style.transform = 'scaleX(1)';
      });
      // la linea si allunga fino ai bordi dello schermo
      tl.to(line, { width: '100%', duration: reducedMotion ? 0.01 : 1.0, ease: 'power3.inOut' });
      // crossfade del rosa nella scena; la linea svanisce sull'orizzonte reale
      tl.addLabel('fade');
      tl.to(root, { backgroundColor: 'rgba(217,165,160,0)', duration: 1.2, ease: 'power1.inOut' }, 'fade');
      tl.to(line, { opacity: 0, duration: 0.7, ease: 'power1.in' }, 'fade+=0.5');
      // ?slowloader: transizione rallentata, per verificarla fotogramma per fotogramma nei test
      if (new URLSearchParams(location.search).has('slowloader')) tl.timeScale(0.15);
    });
  }

  return { manager, expect, progressFor, setExtraSteps, stepDone, finish };
}
