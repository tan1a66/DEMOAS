// Interfaz (todo en español): colores, medidas durante el arrastre, llamada a la acción.

import { COLORS, CONTACT, MEASURE, MEASURE_SCALE } from '../config.js';

const $ = (id) => document.getElementById(id);

export function fmtCm(m) {
  return `${Math.round(m * MEASURE_SCALE * 100)} cm`;
}
export function fmtM(m) {
  return `${(m * MEASURE_SCALE).toFixed(2)} m`;
}

export class UI {
  constructor({ onColor, getConfig }) {
    this.onColor = onColor;
    this.getConfig = getConfig;
    this.panel = $('panel');
    this.hint = $('hint');
    this.measure = $('measure');
    this.mMain = $('mMain');
    this.mSub = $('mSub');
    this.toastEl = $('toast');
    this.nameEl = $('swatchName');
    this.current = null;
    this._buildSwatches();
    this._bindCta();
  }

  _buildSwatches() {
    const box = $('swatches');
    this.buttons = COLORS.map((c, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', c.name);
      b.setAttribute('aria-checked', 'false');
      b.style.setProperty('--c', c.hex);
      b.dataset.id = c.id;
      b.tabIndex = -1;
      b.addEventListener('click', () => this.select(c.id, true));
      b.addEventListener('keydown', (e) => {
        const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!dir) return;
        e.preventDefault();
        const next = COLORS[(idx + dir + COLORS.length) % COLORS.length];
        this.select(next.id, true);
        this.buttons.find((x) => x.dataset.id === next.id).focus();
      });
      box.appendChild(b);
      return b;
    });
  }

  select(id, fromUser) {
    const c = COLORS.find((x) => x.id === id);
    if (!c || (this.current && this.current.id === id)) return;
    this.current = c;
    for (const b of this.buttons) {
      const on = b.dataset.id === id;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    this.nameEl.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: 'ease-out' });
    this.nameEl.textContent = c.name;
    this.onColor(c, fromUser);
  }

  show() {
    this.panel.classList.add('on');
  }

  hideHint() {
    this.hint.classList.add('gone');
  }

  // ---------------------------------------------------------------- medidas
  // Fija bajo el logotipo: nunca queda bajo el pulgar ni tapa la onda.
  showMeasure({ depth, tail }) {
    this.mMain.textContent = `Onda ${fmtCm(depth)}`;
    this.mSub.textContent = `Colas ${fmtM(tail)} · Largo total ${MEASURE.realLength.toFixed(2)} m`;
    this.measure.classList.add('on');
    document.body.classList.add('measuring');
  }

  hideMeasure() {
    this.measure.classList.remove('on');
    document.body.classList.remove('measuring');
  }

  // ---------------------------------------------------------------- llamada a la acción
  message() {
    const { depths } = this.getConfig();
    const color = this.current ? this.current.name : '';
    const a = Math.round(depths[0] * MEASURE_SCALE * 100);
    const b = Math.round(depths[1] * MEASURE_SCALE * 100);
    const ondas = Math.abs(a - b) <= 3 ? `ondas de unos ${Math.round((a + b) / 2)} cm` : `ondas de unos ${a} y ${b} cm`;
    return (
      `Hola Neutro Home, me encantó la Trenza Maya en color ${color}, ` +
      `de aprox. ${MEASURE.realLength.toFixed(2)} m de largo, colgada en 3 ganchos con ${ondas}. ` +
      '¿Me pueden dar información?'
    );
  }

  _bindCta() {
    const cta = $('cta');
    cta.href = CONTACT.instagram;
    $('catalog').href = CONTACT.catalog;
    // El enlace abre el DM de Instagram en el mismo gesto (necesario en iOS);
    // antes copiamos el mensaje, porque Instagram no permite precompletar el texto.
    cta.addEventListener('click', () => {
      const text = this.message();
      copyText(text).then(
        (ok) => this.toast(ok ? 'Mensaje copiado — pégalo en el chat' : 'Escríbenos por Instagram: @neutro_home'),
        () => this.toast('Escríbenos por Instagram: @neutro_home')
      );
    });
  }

  toast(text) {
    const el = this.toastEl;
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => el.classList.remove('on'), 4200);
  }
}

// Copia al portapapeles: API moderna y, si falla, el método clásico (síncrono).
function copyText(text) {
  const legacy = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  };
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => legacy()
    );
  }
  return Promise.resolve(legacy());
}
