// =============================================================================
//  loader.js — linea oro sottile + percentuale mentre si prepara la scena
// =============================================================================

import { gsap } from '../core/scroll.js';

export function createLoader() {
  const el = document.getElementById('loader');
  const line = el.querySelector('.loader-line i');
  const pct = el.querySelector('.loader-pct');
  const shown = { v: 0 };
  let target = 0;

  const render = () => {
    line.style.transform = `scaleX(${shown.v / 100})`;
    pct.textContent = String(Math.round(shown.v)).padStart(2, '0');
  };

  return {
    /** p: 0..1 */
    set(p) {
      const v = Math.max(target, Math.min(100, p * 100));
      if (v === target) return;
      target = v;
      gsap.to(shown, { v: target, duration: 0.6, ease: 'power2.out', overwrite: true, onUpdate: render });
    },
    async done() {
      target = 100;
      await gsap.to(shown, { v: 100, duration: 0.5, ease: 'power2.out', overwrite: true, onUpdate: render });
      await gsap.to(el, { autoAlpha: 0, duration: 0.9, ease: 'power2.inOut', delay: 0.15 });
      el.remove();
    },
    error() {
      el.classList.add('is-error');
    },
  };
}
