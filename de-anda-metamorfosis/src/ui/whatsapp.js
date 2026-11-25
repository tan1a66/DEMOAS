// =============================================================================
//  whatsapp.js — i pulsanti con classe .js-wa
// =============================================================================
//  DEMO_MODE (config.js) = true: la camera scende nella vasca e compare
//  "Work in progress · alessia.studio".
//  DEMO_MODE = false: aprono WhatsApp con il messaggio nella lingua scelta.

import { WHATSAPP_NUMBER, DEMO_MODE } from '../config.js';
import { t } from '../i18n.js';
import { gsap } from '../core/scroll.js';

export function whatsappUrl() {
  const text = encodeURIComponent(t('whatsapp'));
  const number = WHATSAPP_NUMBER.replace(/\D/g, '');
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}

// ---- velo "Work in progress" ----
//  All'apertura main.js porta la camera dentro la vasca (evento wip:open): il
//  messaggio compare quando la camera è arrivata a pelo d'acqua.
let wipOpen = false;
let wipOpenedAt = 0;
function showWip() {
  const el = document.querySelector('.wip');
  if (!el || wipOpen) return;
  wipOpen = true;
  wipOpenedAt = performance.now();
  window.dispatchEvent(new CustomEvent('wip:open'));
  el.setAttribute('aria-hidden', 'false');
  gsap.killTweensOf(el);
  gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, ease: 'power2.out' });
  gsap.fromTo(el.querySelectorAll('.wip-inner > *'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.12, ease: 'power3.out', delay: 1.5 });
}
function hideWip() {
  const el = document.querySelector('.wip');
  if (!el || !wipOpen) return;
  wipOpen = false;
  window.dispatchEvent(new CustomEvent('wip:close'));
  el.setAttribute('aria-hidden', 'true');
  gsap.to(el, { autoAlpha: 0, duration: 0.7, ease: 'power2.in' });
}
let wipBound = false;
function bindWipClose() {
  if (wipBound) return;
  wipBound = true;
  document.querySelector('.wip')?.addEventListener('click', hideWip);
  window.addEventListener('keydown', (e) => e.key === 'Escape' && hideWip());
  // anche provando a scorrere si torna al racconto (dopo la discesa, non per inerzia)
  const onScrollTry = () => wipOpen && performance.now() - wipOpenedAt > 1800 && hideWip();
  window.addEventListener('wheel', onScrollTry, { passive: true });
  window.addEventListener('touchmove', onScrollTry, { passive: true });
}

/** Da richiamare anche al cambio lingua: il messaggio precompilato cambia. */
export function bindWhatsApp(root = document) {
  if (DEMO_MODE) bindWipClose();
  root.querySelectorAll('.js-wa').forEach((a) => {
    if (DEMO_MODE) {
      a.href = '#';
      a.removeAttribute('target');
      if (!a.dataset.wip) {
        a.dataset.wip = '1';
        a.addEventListener('click', (e) => {
          e.preventDefault();
          showWip();
        });
      }
      return;
    }
    a.href = whatsappUrl();
    a.target = '_blank';
    a.rel = 'noopener';
  });
}
