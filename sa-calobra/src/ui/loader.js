// Caricamento: solo una sottile barra arancione; a dati pronti sfuma e lascia la scena.
import gsap from 'gsap';

export function createLoader() {
  const el = document.getElementById('loader');
  const bar = el.querySelector('span');
  let shown = 0;
  const api = {
    covering: true,
    setProgress(p) {
      shown = Math.max(shown, Math.min(p, 1));
      bar.style.transform = `scaleX(${shown.toFixed(3)})`;
    },
    done() {
      api.setProgress(1);
      return new Promise((resolve) => gsap.to(el, {
        opacity: 0, duration: 0.9, delay: 0.3, ease: 'sine.inOut',
        onStart: () => { api.covering = false; },
        onComplete: () => { el.remove(); resolve(); },
      }));
    },
  };
  return api;
}
