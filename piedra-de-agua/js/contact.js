// Panel "Reservar · Contacto": dirección, mapa sencillo del Centro y WhatsApp.
import { CONFIG, waLink } from './config.js?v=2';
import { t, applyI18n, onLangChange } from './i18n.js?v=2';

export function centroMapSVG() {
  // Cuadrícula del Centro: calles pares N–S (60 al centro), impares E–O.
  return `
  <svg class="centro-map" viewBox="0 0 360 300" role="img" aria-label="${t('con.near')}">
    <defs>
      <pattern id="trees" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2.2" fill="#2f6b52"/></pattern>
    </defs>
    <rect width="360" height="300" fill="#0f2c26"/>
    <g fill="#17403a">
      <rect x="18" y="18" width="88" height="68" rx="3"/><rect x="132" y="18" width="96" height="68" rx="3"/><rect x="254" y="18" width="88" height="68" rx="3"/>
      <rect x="18" y="112" width="88" height="76" rx="3"/><rect x="132" y="112" width="96" height="76" rx="3"/><rect x="254" y="112" width="88" height="76" rx="3"/>
      <rect x="18" y="214" width="88" height="68" rx="3"/><rect x="254" y="214" width="88" height="68" rx="3"/>
    </g>
    <!-- Plaza Grande -->
    <rect x="132" y="214" width="96" height="68" rx="3" fill="#1e4e3f"/>
    <rect x="138" y="220" width="84" height="56" rx="2" fill="url(#trees)" opacity="0.9"/>
    <!-- Catedral (al oriente de la plaza, sobre Calle 60) -->
    <g transform="translate(262,222)">
      <rect width="72" height="52" rx="2" fill="#2a5a4c"/>
      <path d="M8 52V18h10V8l3-6 3 6v10h24V8l3-6 3 6v10h10v34" fill="none" stroke="#e3c591" stroke-width="1.6"/>
      <path d="M30 52V34a6 6 0 0 1 12 0v18" fill="none" stroke="#e3c591" stroke-width="1.2"/>
    </g>
    <!-- calles -->
    <g stroke="#f4efe6" stroke-opacity="0.18" stroke-width="10">
      <path d="M119 0v300M241 0v300"/><path d="M0 99h360M0 201h360"/>
    </g>
    <path d="M241 0v300" stroke="#c49a5c" stroke-width="10" stroke-opacity="0.55"/>
    <g font-family="Jost, sans-serif" font-size="9" letter-spacing="1.5" fill="#f4efe6" fill-opacity="0.7">
      <text x="246" y="12">C. 60</text><text x="124" y="12">C. 62</text>
      <text x="6" y="96">C. 59</text><text x="6" y="198">C. 61</text>
    </g>
    <text x="180" y="296" text-anchor="middle" font-family="Jost, sans-serif" font-size="8.5" letter-spacing="1.5" fill="#a9dccf">${t('con.plaza').toUpperCase()}</text>
    <text x="298" y="296" text-anchor="middle" font-family="Jost, sans-serif" font-size="8.5" letter-spacing="1.5" fill="#e3c591">${t('con.cathedral').toUpperCase()}</text>
    <!-- paseo de 2 minutos -->
    <path d="M241 150 V214" stroke="#e3c591" stroke-width="2" stroke-dasharray="3 5" fill="none" class="walk"/>
    <g transform="translate(241,150)">
      <circle r="16" fill="none" stroke="#7cc4b8" stroke-width="1.2" class="pulse"/>
      <circle r="7" fill="#7cc4b8" stroke="#0f2c26" stroke-width="2"/>
    </g>
    <g font-family="Cormorant Garamond, serif" font-size="15" fill="#f4efe6">
      <text x="262" y="146">Piedra de Agua</text>
    </g>
    <text x="250" y="186" font-family="Jost, sans-serif" font-size="9" letter-spacing="1.2" fill="#e3c591">2 MIN</text>
  </svg>`;
}

let panel = null;

function render(root) {
  root.innerHTML = `
    <div class="contact-card" role="dialog" aria-modal="true" aria-labelledby="contact-title">
      <button class="contact-close" type="button" data-close data-i18n-aria="con.close" aria-label="${t('con.close')}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <p class="kicker" data-i18n="con.kicker">${t('con.kicker')}</p>
      <h2 id="contact-title" data-i18n="con.title">${t('con.title')}</h2>
      <div class="contact-map">${centroMapSVG()}</div>
      <dl class="contact-data">
        <dt data-i18n="con.address">${t('con.address')}</dt>
        <dd>${CONFIG.address}</dd>
        <dd class="near" data-i18n="con.near">${t('con.near')}</dd>
      </dl>
      <a class="cta-wa" href="${waLink(t('wa.msg'))}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.2 21.8l5.1-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9z"/></svg>
        <span data-i18n="con.write">${t('con.write')}</span>
      </a>
      <a class="cta-line" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONFIG.mapsQuery)}" target="_blank" rel="noopener" data-i18n="con.maps">${t('con.maps')}</a>
      <p class="contact-credit" data-i18n="credit">${t('credit')}</p>
    </div>`;
}

export function openContactPanel(root) {
  if (!panel) {
    panel = root;
    render(root);
    onLangChange(() => render(root));
    root.addEventListener('click', (e) => {
      if (e.target === root || e.target.closest('[data-close]')) closeContactPanel();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) closeContactPanel(); });
  }
  panel.prevFocus = document.activeElement;
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('is-open'));
  setTimeout(() => root.querySelector('.contact-close')?.focus(), 60);
}

export function closeContactPanel() {
  if (!panel) return;
  panel.classList.remove('is-open');
  setTimeout(() => { panel.hidden = true; panel.prevFocus?.focus?.(); }, 450);
}
