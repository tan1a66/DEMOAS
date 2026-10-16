// Registro de secciones (se cargan bajo demanda la primera vez que se abren).
import { t } from '../i18n.js?v=2';

export const SECTION_IDS = ['nosotros', 'habitaciones', 'servicios', 'experiencias'];

const loaders = {
  nosotros: () => import('./nosotros.js?v=2'),
  habitaciones: () => import('./habitaciones.js?v=2'),
  servicios: () => import('./servicios.js?v=2'),
  experiencias: () => import('./experiencias.js?v=2'),
};

const cache = {};

export async function getSection(id, ctx) {
  if (!cache[id]) {
    cache[id] = loaders[id]().then((m) => m.create(ctx));
  }
  return cache[id];
}

export function backButton(onBack) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'back-btn';
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V11a7 7 0 0 1 14 0v9" /><path d="M14 13l-3.5 3.5L14 20" /></svg><span data-i18n="back.patio">${t('back.patio')}</span>`;
  b.addEventListener('click', onBack);
  return b;
}

export function pageFooter() {
  const f = document.createElement('footer');
  f.className = 'page-footer';
  f.innerHTML = `<p data-i18n="credit">${t('credit')}</p>`;
  return f;
}

// ───────────── hoja inferior para teléfono ─────────────
// En pantallas verticales el 3D ocupa toda la pantalla y el panel queda "asomado"
// abajo (peek). Al elegir algo se abre casi a pantalla completa para leer cómodo;
// se cierra con el botón, deslizando hacia abajo o tocando el asa.
export const SHEET_MQ = window.matchMedia('(max-width: 760px), (max-aspect-ratio: 9/10)');

export function mobileSheet({ el, panel, scroller, onOpen, onClose, onMeasure }) {
  const bar = panel.querySelector('.sheet-bar');
  let open = false;

  function measure() {
    if (!SHEET_MQ.matches || open) return;
    const kids = [...scroller.children].filter((c) => c.offsetParent !== null);
    const last = kids[kids.length - 1];
    const cs = getComputedStyle(scroller);
    const content = last ? last.offsetTop + last.offsetHeight + parseFloat(cs.paddingBottom) : 0;
    const h = Math.ceil(bar.offsetHeight + content);
    el.style.setProperty('--peek', `${h}px`);
    document.documentElement.style.setProperty('--peek', `${h}px`);
    onMeasure?.(h);
  }

  function apply(v, silent = false) {
    const next = !!v && SHEET_MQ.matches;
    if (next === open && !silent) return;
    open = next;
    el.classList.toggle('sheet-open', open);
    document.body.classList.toggle('sheet-open', open);
    if (open) scroller.scrollTop = 0;
    if (!silent) (open ? onOpen : onClose)?.();
    if (!open) requestAnimationFrame(() => requestAnimationFrame(measure));
  }

  const swipe = (target) => {
    let y0 = null, x0 = 0, st = 0;
    target.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; st = scroller.scrollTop; }, { passive: true });
    target.addEventListener('touchend', (e) => {
      if (y0 == null) return;
      const dy = e.changedTouches[0].clientY - y0, dx = e.changedTouches[0].clientX - x0;
      y0 = null;
      if (Math.abs(dx) > Math.abs(dy)) return; // desplazamiento horizontal (fichas)
      if (dy > 70 && open && st <= 0) apply(false);
      else if (dy < -40 && !open) apply(true);
    }, { passive: true });
  };
  swipe(bar);
  swipe(scroller);
  bar.querySelector('.grabber')?.addEventListener('click', () => apply(!open));
  bar.querySelector('.sheet-close')?.addEventListener('click', () => apply(false));
  SHEET_MQ.addEventListener?.('change', () => { apply(false, true); measure(); });

  return {
    open: () => apply(true),
    close: (silent = false) => apply(false, silent),
    measure,
    get isOpen() { return open; },
    get mobile() { return SHEET_MQ.matches; },
  };
}

export function sheetBar(closeKey) {
  return `<div class="sheet-bar">
    <button type="button" class="sheet-close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg><span data-i18n="${closeKey}"></span></button>
    <button type="button" class="grabber" data-i18n-aria="sheet.toggle"><span></span></button>
    <span class="sheet-spacer"></span>
  </div>`;
}
