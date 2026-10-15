// Interfaz sobre la escena: textos ES/EN, botón de reserva, control horario oculto (tecla T).

import { CONFIG, REDUCED_MOTION } from './config.js';
import { STRINGS, ctaState, ctaText, fmt } from './copy.js';
import { serviceState } from './sun.js';
import { toMerida, parseHM } from './time.js';

const $ = (id) => document.getElementById(id);

/** Cambia el texto de un elemento con un fundido suave (si el texto es distinto). */
function swapText(el, text, { html = false, instant = false } = {}) {
  const current = html ? el.innerHTML : el.textContent;
  if (current === text) return;
  const apply = () => (html ? (el.innerHTML = text) : (el.textContent = text));
  if (instant || REDUCED_MOTION || !el.textContent) {
    apply();
    return;
  }
  el.classList.add('is-fading');
  clearTimeout(el._swapTimer);
  el._swapTimer = setTimeout(() => {
    apply();
    el.classList.remove('is-fading');
  }, 450);
}

function initialLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'es' || q === 'en') return q;
  try {
    const saved = localStorage.getItem('picheta-lang');
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    /* almacenamiento bloqueado: se usa el idioma por defecto */
  }
  return CONFIG.defaultLang;
}

export class UI {
  constructor(clock) {
    this.clock = clock;
    this.lang = initialLang();
    this.last = {};
    this.cta = $('cta');
    this.cta.href = CONFIG.reservationsUrl;

    document.querySelectorAll('[data-lang]').forEach((b) =>
      b.addEventListener('click', () => this.setLang(b.dataset.lang)),
    );
    this.applyStatic(true);
    this.initSlider();
    this.initScroll();
  }

  /** Al bajar: el texto del hero se desvanece y la barra superior gana un fondo oscuro. */
  initScroll() {
    const hero = $('hero');
    const onScroll = () => {
      const p = Math.min(1, Math.max(0, scrollY / (hero.offsetHeight || innerHeight)));
      hero.style.setProperty('--p', p.toFixed(3));
      document.body.classList.toggle('is-scrolled', p > 0.55);
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  setLang(lang) {
    if (lang === this.lang || !STRINGS[lang]) return;
    this.lang = lang;
    try {
      localStorage.setItem('picheta-lang', lang);
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
    this.applyStatic(false);
    this.last = {};
    this.update(true);
  }

  /** Textos que no dependen de la hora. */
  applyStatic(instant) {
    const s = STRINGS[this.lang];
    document.documentElement.lang = this.lang;
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === this.lang)));
    swapText($('title'), `<span class="line">${s.title[0]}</span> <span class="line line-2">${s.title[1]}</span>`, { html: true, instant });
    swapText($('cocina-kicker'), s.kitchenKicker, { instant });
    swapText($('cocina-title'), `<span>${s.kitchenLine[0]}</span> <em>${s.kitchenLine[1]}</em>`, { html: true, instant });
    swapText($('address'), s.address, { instant });
    document.querySelectorAll('.cocina-grid img').forEach((img, i) => (img.alt = s.photoAlt[i] ?? ''));
    $('scroll-hint').setAttribute('aria-label', s.scroll);
    $('slider-live').textContent = s.slider.live;
    $('slider-label').textContent = s.slider.label;
  }

  /** Textos que dependen de la hora de Mérida. Barato: solo toca el DOM si algo cambia. */
  update(force = false) {
    const now = this.clock.now();
    const s = STRINGS[this.lang];
    const svc = serviceState(now);
    const instant = force && !this.started;

    const kicker = s.kicker(now);
    if (kicker !== this.last.kicker) {
      $('kicker').textContent = kicker; // el reloj cambia sin fundido
      this.last.kicker = kicker;
    }
    const sub = s.subtitle(svc.sunset, svc.minToSunset < 0);
    if (sub !== this.last.sub) {
      swapText($('subtitle'), sub, { instant });
      this.last.sub = sub;
    }
    const label = ctaText(this.lang, svc);
    if (label !== this.last.cta) {
      swapText($('cta-label'), label, { instant });
      this.cta.dataset.state = ctaState(svc);
      this.last.cta = label;
    }
    this.updateSlider(now);
  }

  /**
   * Tono de la interfaz según la luz: de día tinta oscura sobre velo crema, de noche al revés.
   * `day` llega ya suavizado (0 noche … 1 pleno día). Nunca se mezclan los dos tonos (a medio
   * camino tinta y velo serían del mismo color): el texto se funde, cambia el tono y reaparece.
   */
  setTone(day) {
    const next = this.tone === 'day' ? (day > 0.4 ? 'day' : 'night') : day > 0.6 ? 'day' : 'night';
    if (next === this.tone) return;
    const body = document.body;
    const apply = () => {
      body.classList.toggle('tone-day', next === 'day');
      this.tone = next;
    };
    if (!this.tone || !this.started || REDUCED_MOTION) {
      apply();
      return;
    }
    this.tone = next; // evita repetir la transición mientras está en curso
    body.classList.add('tone-swap');
    setTimeout(() => {
      body.classList.toggle('tone-day', next === 'day');
      setTimeout(() => body.classList.remove('tone-swap'), 350);
    }, 600);
  }

  /** Arranca la animación de entrada de los textos. */
  reveal() {
    this.started = true;
    document.body.classList.add('is-in');
  }

  // ---------------------------------------------------------------- control horario (tecla T)
  initSlider() {
    const panel = $('timebar');
    const range = $('slider');
    const show = (on) => {
      panel.hidden = !on;
      if (on) this.updateSlider(this.clock.now(), true);
    };
    if (new URLSearchParams(location.search).has('slider')) show(true);

    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (e.key === 't' || e.key === 'T') show(panel.hidden);
      if (e.key === 'Escape') show(false);
    });
    range.addEventListener('input', () => {
      this.clock.setManual(Number(range.value));
      this.update();
    });
    $('slider-live').addEventListener('click', () => {
      this.clock.setLive();
      this.update();
    });
    // Teclas rápidas dentro del panel: 1–9 saltan a horas clave para la presentación.
    this.presets = ['12:00', '16:30', '17:15', '17:45', '18:10', '18:40', '19:30', '21:30', '00:30'].map(parseHM);
    window.addEventListener('keydown', (e) => {
      if (panel.hidden || !/^[1-9]$/.test(e.key)) return;
      this.clock.setManual(this.presets[Number(e.key) - 1]);
      this.update();
    });
  }

  updateSlider(now, force = false) {
    const panel = $('timebar');
    if (panel.hidden && !force) return;
    const w = toMerida(now);
    const min = w.getUTCHours() * 60 + w.getUTCMinutes();
    const range = $('slider');
    if (document.activeElement !== range) range.value = String(min);
    $('slider-time').textContent = this.lang === 'en' ? fmt.en(now) : fmt.es(now);
    $('slider-live').classList.toggle('is-active', this.clock.mode === 'live');
  }
}
