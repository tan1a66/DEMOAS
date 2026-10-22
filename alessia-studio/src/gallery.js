import { PROJECTS, getText } from './content.js';

// Galleria di un progetto: si apre toccando la sua bolla. Screenshot del sito con frecce, contatore
// e miniature; accanto (sotto, sul telefono) la scheda del progetto. Tastiera: ← → per le immagini,
// Esc per chiudere; sul telefono si scorre tra le immagini con il dito. Le immagini si scaricano
// solo all'apertura.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ARROW = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function createGallery(root, { lang, onOpen, onClose } = {}) {
  const el = document.createElement('div');
  el.className = 'gallery';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'gal-title');
  el.hidden = true;
  el.innerHTML = `
    <div class="gal-backdrop" data-close></div>
    <div class="gal-panel">
      <div class="gal-stage">
        <div class="gal-frame"><img class="gal-img" alt="" decoding="async" /></div>
        <button type="button" class="gal-arrow prev">${ARROW('M15 5l-7 7 7 7')}</button>
        <button type="button" class="gal-arrow next">${ARROW('M9 5l7 7-7 7')}</button>
        <p class="gal-count" aria-live="polite"></p>
      </div>
      <div class="gal-thumbs"></div>
      <div class="gal-info">
        <p class="label gal-meta"></p>
        <h2 class="gal-title" id="gal-title"></h2>
        <p class="gal-kind"></p>
        <p class="gal-text"></p>
        <div class="gal-actions"></div>
        <div class="gal-projnav">
          <button type="button" class="gal-pp">${ARROW('M15 5l-7 7 7 7')}<span></span></button>
          <button type="button" class="gal-np"><span></span>${ARROW('M9 5l7 7-7 7')}</button>
        </div>
      </div>
    </div>
    <button type="button" class="gal-close">${ARROW('M6 6l12 12M18 6L6 18')}</button>`;
  root.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const img = $('.gal-img'), thumbs = $('.gal-thumbs'), count = $('.gal-count');

  let pi = -1, ii = 0, prevFocus = null;
  const shotsOf = (i) => {
    const p = PROJECTS[i];
    if (p.gallery?.length) return p.gallery;
    return p.image ? [{ full: p.image, mid: p.image, thumb: p.image }] : [];
  };

  function showImage(k) {
    const shots = shotsOf(pi);
    if (!shots.length) return;
    ii = (k + shots.length) % shots.length;
    const s = shots[ii];
    img.classList.add('loading');
    img.onload = () => img.classList.remove('loading');
    img.srcset = s.mid !== s.full ? `${s.mid} 720w, ${s.full} 1280w` : '';
    img.sizes = '(max-width: 720px) 100vw, 72vw';
    img.src = s.full;
    img.alt = `${PROJECTS[pi].title} · ${ii + 1}/${shots.length}`;
    count.textContent = `${ii + 1} / ${shots.length}`;
    thumbs.querySelectorAll('button').forEach((b, k2) => b.setAttribute('aria-current', k2 === ii ? 'true' : 'false'));
    thumbs.children[ii]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    // la successiva in anticipo
    const n = shots[(ii + 1) % shots.length];
    if (n && n !== s) new Image().src = window.innerWidth <= 720 ? n.mid : n.full;
    const multi = shots.length > 1;
    $('.gal-arrow.prev').hidden = $('.gal-arrow.next').hidden = !multi;
    thumbs.hidden = !multi;
  }

  function renderInfo() {
    if (pi < 0) return;
    const T = getText(lang);
    const p = PROJECTS[pi];
    const [kind, text] = T.projects.items[p.id] || ['', ''];
    $('.gal-meta').textContent = `${String(pi + 1).padStart(2, '0')} / ${String(PROJECTS.length).padStart(2, '0')}`;
    $('.gal-title').textContent = p.title;
    $('.gal-kind').textContent = kind;
    $('.gal-text').textContent = text;
    $('.gal-actions').innerHTML = p.url
      ? `<a class="cta primary" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(T.projects.cta)} <span aria-hidden="true">→</span></a>`
      : '';
    $('.gal-close').setAttribute('aria-label', T.ui.close);
    $('.gal-arrow.prev').setAttribute('aria-label', T.ui.prev);
    $('.gal-arrow.next').setAttribute('aria-label', T.ui.next);
    $('.gal-pp span').textContent = T.ui.prevProject;
    $('.gal-np span').textContent = T.ui.nextProject;
    thumbs.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-label', `${p.title} · ${k + 1}`));
  }

  function setProject(i) {
    pi = (i + PROJECTS.length) % PROJECTS.length;
    thumbs.innerHTML = shotsOf(pi)
      .map((s, k) => `<button type="button" data-k="${k}"><img src="${esc(s.thumb)}" alt="" loading="lazy" decoding="async" /></button>`)
      .join('');
    renderInfo();
    showImage(0);
    onOpen?.(pi);
  }

  function open(i) {
    if (el.hidden) prevFocus = document.activeElement;
    el.hidden = false;
    document.documentElement.classList.add('gallery-open');
    setProject(i);
    requestAnimationFrame(() => el.classList.add('on'));
    $('.gal-close').focus({ preventScroll: true });
  }

  function close() {
    if (el.hidden) return;
    el.classList.remove('on');
    document.documentElement.classList.remove('gallery-open');
    const done = () => {
      el.hidden = true;
      img.removeAttribute('src');
      img.removeAttribute('srcset');
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else setTimeout(done, 320);
    pi = -1;
    prevFocus?.focus?.({ preventScroll: true });
    onClose?.();
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close], .gal-close')) return close();
    if (e.target.closest('.gal-arrow.prev')) return showImage(ii - 1);
    if (e.target.closest('.gal-arrow.next')) return showImage(ii + 1);
    if (e.target.closest('.gal-pp')) return setProject(pi - 1);
    if (e.target.closest('.gal-np')) return setProject(pi + 1);
    const t = e.target.closest('[data-k]');
    if (t) showImage(+t.dataset.k);
  });

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return close();
    if (e.key === 'ArrowLeft') return showImage(ii - 1);
    if (e.key === 'ArrowRight') return showImage(ii + 1);
    if (e.key === 'Tab') {
      // il fuoco resta dentro la galleria
      const f = [...el.querySelectorAll('button:not([hidden]), a[href]')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && i === f.length - 1) {
        e.preventDefault();
        f[0].focus();
      }
    }
  });

  // swipe orizzontale sull'immagine
  let sx = null, sy = 0;
  const stage = $('.gal-stage');
  stage.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) showImage(ii + (dx < 0 ? 1 : -1));
  }, { passive: true });

  return {
    open,
    close,
    get isOpen() { return !el.hidden; },
    get project() { return pi; },
    setLang(l) {
      lang = l;
      renderInfo();
    },
  };
}
