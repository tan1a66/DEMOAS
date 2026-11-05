// Caricamento: crema Nomads, in filigrana le curve di livello reali di Sa Calobra che si muovono
// piano, e una sottile barra arancione; a dati pronti sfuma e lascia la scena.
import gsap from 'gsap';
import contoursSvg from '../assets/contours.svg?raw';

export function createLoader() {
  const el = document.getElementById('loader');
  const bar = el.querySelector('span');
  const mark = document.createElement('div');
  mark.className = 'loader__mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = contoursSvg;
  el.prepend(mark);
  gsap.fromTo(mark, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 2.6, ease: 'power2.out' });
  gsap.to(mark, { rotation: 1.5, xPercent: -1.5, duration: 14, ease: 'sine.inOut', yoyo: true, repeat: -1 });
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
