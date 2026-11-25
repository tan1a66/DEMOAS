// =============================================================================
//  text.js — titoli con parole che compaiono una dopo l'altra, testi in dissolvenza
// =============================================================================

import { gsap } from '../core/scroll.js';
import { t, richText } from '../i18n.js';

/** Scrive un titolo (data-i18n-title) dividendolo in parole animabili. */
export function renderTitle(el) {
  const tmp = document.createElement('div');
  tmp.innerHTML = richText(t(el.dataset.i18nTitle));
  const frag = document.createDocumentFragment();
  tmp.childNodes.forEach((node) => {
    const em = node.nodeName === 'EM';
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(' '));
        return;
      }
      const w = document.createElement('span');
      w.className = em ? 'w em' : 'w';
      w.setAttribute('aria-hidden', 'true');
      const wi = document.createElement('span');
      wi.className = 'wi';
      wi.textContent = part;
      w.appendChild(wi);
      frag.appendChild(w);
    });
  });
  el.replaceChildren(frag);
  el.setAttribute('aria-label', tmp.textContent);
}

export const renderAllTitles = (root = document) => root.querySelectorAll('[data-i18n-title]').forEach(renderTitle);

/**
 * Un "livello" di testo (data-layer) che entra ed esce con lo scroll.
 * Entrata: etichetta, poi le parole del titolo una dopo l'altra, poi i testi.
 */
export function createLayer(el, { reducedMotion }) {
  let tl = null;
  let active = false;

  const parts = () => ({
    words: [...el.querySelectorAll('.title .wi')],
    first: [...el.querySelectorAll('[data-reveal="first"]')],
    rest: [...el.querySelectorAll('[data-reveal="text"]')],
    portraits: [...el.querySelectorAll('[data-reveal="portrait"]')],
  });

  function show(instant = false) {
    active = true;
    el.classList.add('is-active');
    tl?.kill();
    const { words, first, rest, portraits } = parts();
    gsap.set(el, { autoAlpha: 1, y: 0 });
    if (instant) {
      gsap.set([...words, ...first, ...rest], { clearProps: 'all' });
      return;
    }
    // ritratto: si apre dal basso con una maschera ad arco, l'immagine si assesta
    const ARCH = 'round 999px 999px 1.1rem 1.1rem';
    tl = gsap.timeline();
    if (reducedMotion) {
      tl.fromTo([...first, ...words, ...rest, ...portraits], { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power1.out', stagger: 0.03 });
      return;
    }
    if (portraits.length) {
      tl.fromTo(portraits, { clipPath: `inset(100% 0% 0% 0% ${ARCH})` }, { clipPath: `inset(0% 0% 0% 0% ${ARCH})`, duration: 1.6, ease: 'expo.inOut' }, 0.2)
        .fromTo(portraits.map((p) => p.querySelector('img')), { scale: 1.22 }, { scale: 1, duration: 2.2, ease: 'expo.out' }, 0.35);
    }
    if (first.length) tl.fromTo(first, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 }, 0);
    if (words.length) tl.fromTo(words, { yPercent: 108, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.15, ease: 'power4.out', stagger: 0.07 }, 0.12);
    if (rest.length) tl.fromTo(rest, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.0, ease: 'power3.out', stagger: 0.12 }, 0.45);
  }

  function hide() {
    active = false;
    tl?.kill();
    tl = gsap.timeline({ onComplete: () => el.classList.remove('is-active') });
    tl.to(el, { autoAlpha: 0, y: reducedMotion ? 0 : -14, duration: 0.55, ease: 'power2.in' });
  }

  gsap.set(el, { autoAlpha: 0 });
  return {
    el,
    show,
    hide,
    get active() {
      return active;
    },
    /** dopo il cambio lingua: le parole nuove devono essere già visibili */
    refresh() {
      if (active) show(true);
    },
  };
}
