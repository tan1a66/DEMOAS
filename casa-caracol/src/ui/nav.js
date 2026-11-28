import { setLang, getLang, onLangChange, t } from '../i18n/index.js';
import { ENV } from '../core/env.js';
import { CONFIG } from '../config.js';

// Barra superior: logo, ES/EN, botón de sonido y "Reservar".

const toastEl = () => document.getElementById('toast');
let toastTimer = 0;

export const showToast = (text, ms = 4200) => {
  const el = toastEl();
  if (!el) return;
  el.textContent = text;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), ms);
};

export const whatsappUrl = () => {
  const msg = getLang() === 'en' ? 'Hello! I would like to book Casa Caracol.' : '¡Hola! Quiero reservar Casa Caracol.';
  return `https://wa.me/${CONFIG.whatsapp.number}?text=${encodeURIComponent(msg)}`;
};

export const initNav = ({ audio }) => {
  const nav = document.getElementById('nav');
  const langButtons = nav.querySelectorAll('[data-lang]');
  const syncLang = () => {
    langButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  };
  langButtons.forEach((b) =>
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      setLang(b.dataset.lang);
    }),
  );
  onLangChange(syncLang);
  syncLang();

  const book = document.getElementById('nav-book');
  const syncBook = () => {
    book.href = whatsappUrl();
  };
  book.target = '_blank';
  book.rel = 'noopener';
  onLangChange(syncBook);
  syncBook();

  const sound = document.getElementById('sound');
  let hinted = false;
  const syncSound = (playing) => {
    sound.classList.toggle('is-playing', playing);
    sound.setAttribute('aria-pressed', String(playing));
    sound.dataset.i18nAria = playing ? 'sound.off' : 'sound.on';
    sound.setAttribute('aria-label', t(sound.dataset.i18nAria));
    // en iPhone el interruptor de silencio apaga el audio web: se avisa una vez
    if (playing && ENV.ios && !hinted) {
      hinted = true;
      setTimeout(() => showToast(t('sound.silentHint')), 900);
    }
  };
  audio.onChange(syncSound);
  onLangChange(() => syncSound(audio.playing));
  sound.addEventListener('click', (ev) => {
    ev.stopPropagation();
    audio.toggle();
  });

  requestAnimationFrame(() => nav.classList.add('is-ready'));
};
