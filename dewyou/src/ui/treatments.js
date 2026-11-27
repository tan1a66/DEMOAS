import gsap from 'gsap';
import { CATEGORIES, DEFAULT_CATEGORY, TREATMENTS, TOOL_CATEGORIES } from '../data/content.js';
import { priceLabel } from './format.js';

const icon = (id, cls = 'ico') => `<svg class="${cls}"><use href="#${id}" /></svg>`;

const cardHTML = (t, i) => `
  <article class="card${t.img ? ' card--img' : ''}${t.star ? ' card--star' : ''}" data-i="${i}">
    ${t.img ? `<div class="card__img"><img src="${t.img}" alt="" loading="lazy" width="720" height="720" /></div>` : ''}
    <div class="card__top">
      <div class="card__tags">
        ${t.star ? `<span class="tag tag--ex">${icon('i-spark')}${t.star}</span>` : ''}
        <span class="tag">${priceLabel(t)}</span>
      </div>
      ${t.d ? `<span class="dur">${icon('i-clock')}${t.d} min</span>` : ''}
    </div>
    <h3>${t.t}</h3>
    <p>${t.x}</p>
    <button class="card__more" type="button" data-open="${i}">Ver detalles${icon('i-arrow')}</button>
  </article>`;

export const initTreatments = ({ reduced, finePointer, onCategory, onLayoutChange, lockScroll }) => {
  const pills = document.querySelector('.pills');
  const grid = document.getElementById('grid');
  const sheet = document.getElementById('sheet');
  let current = DEFAULT_CATEGORY;
  let busy = false;

  pills.innerHTML = CATEGORIES.map(
    (c) =>
      `<button class="pill" role="tab" type="button" data-cat="${c.id}" aria-selected="${c.id === current}">${c.label}<sup>${TREATMENTS[c.id].length}</sup></button>`
  ).join('');

  const render = (cat) => {
    grid.innerHTML = TREATMENTS[cat].map(cardHTML).join('');
    grid.setAttribute('aria-label', CATEGORIES.find((c) => c.id === cat).label);
  };
  render(current);

  const select = (cat) => {
    if (cat === current || busy) return;
    const prev = current;
    current = cat;
    pills.querySelectorAll('.pill').forEach((p) => p.setAttribute('aria-selected', String(p.dataset.cat === cat)));
    onCategory?.(cat, TOOL_CATEGORIES.includes(cat), prev);
    if (reduced) {
      render(cat);
      onLayoutChange?.();
      return;
    }
    busy = true;
    const old = grid.querySelectorAll('.card');
    const h0 = grid.offsetHeight;
    gsap.to(old, {
      opacity: 0,
      y: -18,
      scale: 0.985,
      duration: 0.45,
      ease: 'power3.in',
      stagger: { each: 0.03, from: 'start' },
      onComplete: () => {
        render(cat);
        const cards = grid.querySelectorAll('.card');
        const h1 = grid.offsetHeight;
        gsap.fromTo(grid, { height: h0 }, { height: h1, duration: 0.7, ease: 'power3.inOut', clearProps: 'height' });
        gsap.fromTo(
          cards,
          { opacity: 0, y: 34, scale: 0.985 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.9,
            ease: 'expo.out',
            stagger: 0.06,
            clearProps: 'transform,opacity',
            onComplete: () => {
              busy = false;
              onLayoutChange?.();
            },
          }
        );
      },
    });
  };

  pills.addEventListener('click', (e) => {
    const b = e.target.closest('.pill');
    if (b) {
      select(b.dataset.cat);
      b.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
    }
  });
  pills.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const list = [...pills.querySelectorAll('.pill')];
    const i = list.findIndex((p) => p.dataset.cat === current);
    const next = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
    next.focus();
    select(next.dataset.cat);
  });

  // Inclinación 3D + brillo lila que sigue al cursor
  if (finePointer && !reduced) {
    grid.addEventListener('pointermove', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.classList.add('is-tilting');
      card.style.setProperty('--rx', `${(0.5 - py) * 8}deg`);
      card.style.setProperty('--ry', `${(px - 0.5) * 10}deg`);
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
    });
    grid.addEventListener(
      'pointerleave',
      (e) => {
        const card = e.target;
        if (!card.classList?.contains('card')) return;
        card.classList.remove('is-tilting');
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      },
      true
    );
  }

  // Ficha del servicio
  const $ = (id) => document.getElementById(id);
  let lastFocus = null;
  const open = (i) => {
    const t = TREATMENTS[current][i];
    $('sheet-cat').textContent = CATEGORIES.find((c) => c.id === current).label;
    $('sheet-title').textContent = t.t;
    $('sheet-chips').innerHTML = [t.d ? `${t.d} min` : '', `${priceLabel(t)} MXN`]
      .filter(Boolean)
      .map((c) => `<span>${c}</span>`)
      .join('');
    $('sheet-desc').textContent = t.x;
    $('sheet-extra').textContent = t.note || '';
    $('sheet-img').innerHTML = t.img ? `<img src="${t.img}" alt="" />` : '';
    lastFocus = document.activeElement;
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
    lockScroll?.(true);
    setTimeout(() => sheet.querySelector('.sheet__close').focus(), 50);
  };
  const close = () => {
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
    lockScroll?.(false);
    lastFocus?.focus?.();
  };
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) open(+card.dataset.i);
  });
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('is-open')) close();
  });

  return { get current() { return current; } };
};
