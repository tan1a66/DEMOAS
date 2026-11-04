// Il pannello dei capitoli in arrivo (02, 03): capitolo, batteria in carica, spiegazione, quello
// che si sa già (date, destino, itinerario) e la promessa Nomads. Il Capítulo 01 ha il suo
// pannello completo (giorni, livelli, cosa include) in ui/info.js.
import gsap from 'gsap';
import { CONFIG } from '../config.js';
import { battery } from './story.js';

export function createChapterPanel({ story }) {
  const G = CONFIG.globe;
  const el = document.createElement('section');
  el.className = 'info chapter-panel';
  el.id = 'chapter';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="chapter-panel__bg" aria-hidden="true"></div>
    <div class="info__scroll">
      <header class="info__head">
        <p class="kicker" data-k></p>
        <h2 class="info__title" data-t></h2>
        <p class="chapter-panel__status" data-s></p>
        <p class="info__lead" data-l></p>
      </header>
      <dl class="facts" data-f></dl>
      <div class="promise"><p class="label">La promesa Nomads</p><p class="promise__t">${G.copy.promise}</p></div>
      <div class="info__next"><button class="cta" type="button" data-c>${G.copy.notify} <span aria-hidden="true">→</span></button></div>
    </div>
    <button class="info__close" type="button" aria-label="Cerrar"><span aria-hidden="true">×</span></button>`;
  document.body.appendChild(el);
  const q = (s) => el.querySelector(s);
  const items = () => [q('.info__head'), q('.facts'), q('.promise'), q('.info__next')];
  let isOpen = false;

  const open = (ch) => {
    if (isOpen) return;
    isOpen = true;
    q('[data-k]').textContent = `Capítulo ${ch.n} · ${ch.when}`;
    q('[data-t]').textContent = ch.title;
    q('[data-s]').innerHTML = battery(ch.status);
    q('[data-l]').textContent = ch.lead;
    q('[data-f]').innerHTML = ch.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    story.pause();
    el.setAttribute('aria-hidden', 'false');
    gsap.set(el, { visibility: 'visible' });
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'sine.out' });
    gsap.fromTo(items(), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.07, ease: 'power3.out', delay: 0.15 });
  };
  const close = (then) => {
    if (!isOpen) return;
    gsap.to(el, {
      opacity: 0, duration: 0.45, ease: 'sine.in',
      onComplete: () => {
        gsap.set(el, { visibility: 'hidden' });
        el.setAttribute('aria-hidden', 'true');
        isOpen = false;
        story.resume();
        then?.();
      },
    });
  };
  q('.info__close').addEventListener('click', () => close());
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  // "quiero saberlo primero": il contatto (la schermata finale con WhatsApp)
  q('[data-c]').addEventListener('click', (e) => { const t = e.currentTarget; close(() => story.open({ currentTarget: t })); });
  return { open, close, get isOpen() { return isOpen; } };
}
