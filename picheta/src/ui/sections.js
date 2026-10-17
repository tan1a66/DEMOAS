// Maquetación de cada sección (paneles sobre la sala 3D y versión estática).
// Devuelve HTML a partir de content/es.js y config.js.

export function renderSection(id, { content, config, isStatic = false }) {
  const s = content.sections[id];
  const photos = config.assets.photos;
  const head = `
    <header class="sec-head">
      <p class="sec-kicker">${content.brand}</p>
      <h2 class="sec-title" id="${isStatic ? `t-${id}` : 'panel-title'}">${s.title}</h2>
      <p class="sec-lead">${s.lead}</p>
    </header>`;
  const body = BODIES[id]?.(s, { photos, config, content, isStatic }) ?? '';
  return head + body;
}

export function renderFooter({ content, config }) {
  return `
    <footer class="sec-foot">
      <a href="${config.links.instagram}" target="_blank" rel="noopener">${content.footer.instagram}</a>
      <span aria-hidden="true">·</span>
      <a href="${config.links.facturacion}" target="_blank" rel="noopener">${content.footer.facturacion}</a>
      <p class="credit">${content.footer.credit}</p>
    </footer>`;
}

const photo = (src, alt = '', cls = '') =>
  `<figure class="ph ${cls}"><img src="${src}" alt="${alt}" loading="lazy" decoding="async" /></figure>`;

const BODIES = {
  historia(s, { photos }) {
    return `
      <div class="hist">
        ${s.phrases
          .map(
            (p, i) => `
          <section class="hist-step reveal ${i % 2 ? 'alt' : ''}">
            <div class="hist-art">${p.photo ? photo(photos[p.photo], '', 'engr') : ART[p.art] ?? ''}</div>
            <p class="phrase">${p.text}</p>
          </section>`,
          )
          .join('')}
        <div class="hist-body">${s.body.map((t) => `<p class="text reveal">${t}</p>`).join('')}</div>
      </div>`;
  },

  autores(s, { photos }) {
    return `
      <div class="people">
        ${s.people
          .map(
            (p) => `
          <article class="person reveal">
            ${photo(photos[p.photo], p.role, 'portrait')}
            <h3>${p.name}</h3>
            <p>${p.role}</p>
          </article>`,
          )
          .join('')}
      </div>
      <p class="text reveal">${s.note}</p>`;
  },

  menu(s, { photos, content, isStatic }) {
    const cards = s.dishes
      .map(
        (d, i) => `
        <article class="dish ${d.photo ? 'has-photo' : ''}" data-i="${i}">
          ${d.photo ? `<div class="dish-photo" style="background-image:url('${photos[d.photo]}')"></div>` : `<div class="dish-art">${ART.platillo}</div>`}
          <div class="dish-text">
            <p class="dish-n">${String(i + 1).padStart(2, '0')} / ${String(s.dishes.length).padStart(2, '0')} · ${d.course}</p>
            <h3>${d.name}</h3>
            <p>${d.text}</p>
          </div>
        </article>`,
      )
      .join('');
    if (isStatic) return `<div class="dishes-static">${cards}</div>`;
    return `
      <div class="deck" tabindex="0" aria-roledescription="carrusel">
        <div class="deck-stage">${cards}</div>
        <div class="deck-nav">
          <button class="deck-prev" type="button" aria-label="${content.ui.prev}">‹</button>
          <span class="deck-count"></span>
          <button class="deck-next" type="button" aria-label="${content.ui.next}">›</button>
        </div>
      </div>`;
  },

  reserva(s, { config }) {
    const L = config.links;
    const wa = L.whatsapp ? `https://wa.me/${L.whatsapp}?text=${encodeURIComponent('Hola, quisiera reservar una mesa en Picheta.')}` : '';
    return `
      <div class="ctas reveal">
        ${L.opentable ? `<a class="cta primary" href="${L.opentable}" target="_blank" rel="noopener">${s.ctaOnline}</a>` : ''}
        ${wa ? `<a class="cta" href="${wa}" target="_blank" rel="noopener">${s.ctaWhatsapp}</a>` : ''}
        <a class="cta" href="${L.maps}" target="_blank" rel="noopener">${s.ctaMaps}</a>
      </div>
      ${s.info.map((m) => `<p class="meta reveal"><span>${m.label}</span>${m.text}</p>`).join('')}`;
  },

  concurso(s) {
    return `
      <div class="cards">
        ${s.cards.map((c, i) => `<article class="card reveal"><p class="card-n">${String(i + 1).padStart(2, '0')}</p><h3>${c.title}</h3><p>${c.text}</p></article>`).join('')}
      </div>
      <div class="ctas reveal"><span class="cta disabled" aria-disabled="true">${s.cta}</span></div>`;
  },

  eventos(s, { config }) {
    const L = config.links;
    const contact = L.whatsapp
      ? `https://wa.me/${L.whatsapp}?text=${encodeURIComponent('Hola, quisiera información sobre eventos en Picheta.')}`
      : L.instagram;
    return `
      <div class="cards">
        ${s.cards
          .map((c, i) => `<article class="card reveal"><p class="card-n">${String(i + 1).padStart(2, '0')}</p><h3>${c.title}</h3><p>${c.text}</p></article>`)
          .join('')}
      </div>
      <div class="ctas reveal"><a class="cta primary" href="${contact}" target="_blank" rel="noopener">${s.cta}</a></div>`;
  },
};

// ------------------------------------------------------------ grabados (SVG originales)
// Fragmentos al estilo de la estampa satírica del siglo XIX: tramados de
// líneas, marcos y cartelas. Placeholders originales, no reproducen obras reales.
const HATCH = `
  <defs>
    <pattern id="h1" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" stroke-width="1.1"/></pattern>
    <pattern id="h2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)"><line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" stroke-width="0.8"/></pattern>
    <pattern id="h3" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(80)"><line x1="0" y1="0" x2="0" y2="3" stroke="currentColor" stroke-width="0.9"/></pattern>
  </defs>`;

const ART = {
  medallon: `<svg class="engr-svg" viewBox="0 0 200 240" aria-hidden="true">${HATCH}
    <ellipse cx="100" cy="112" rx="84" ry="104" fill="none" stroke="currentColor" stroke-width="2"/>
    <ellipse cx="100" cy="112" rx="76" ry="96" fill="none" stroke="currentColor" stroke-width="0.8"/>
    <ellipse cx="100" cy="112" rx="74" ry="94" fill="url(#h2)" opacity="0.35"/>
    <path d="M58 196 C60 160 78 150 92 146 C82 136 76 120 78 100 C80 74 96 62 112 64 C130 66 140 82 138 104 C137 118 132 132 122 142 C138 148 150 160 152 196 Z" fill="url(#h1)" stroke="currentColor" stroke-width="1.6"/>
    <path d="M100 118 C106 121 114 121 118 117" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M86 70 C96 58 122 58 134 76 C126 70 108 68 96 78 Z" fill="currentColor"/>
    <text x="100" y="232" text-anchor="middle" font-family="Jost, sans-serif" font-size="11" letter-spacing="3" fill="currentColor">1828 · 1899</text>
  </svg>`,
  cabecera: `<svg class="engr-svg wide" viewBox="0 0 320 150" aria-hidden="true">${HATCH}
    <rect x="6" y="6" width="308" height="138" fill="none" stroke="currentColor" stroke-width="2"/>
    <rect x="12" y="12" width="296" height="126" fill="none" stroke="currentColor" stroke-width="0.7"/>
    <path d="M40 58 L280 58 L268 74 L280 90 L40 90 L52 74 Z" fill="url(#h3)" stroke="currentColor" stroke-width="1.4"/>
    <text x="160" y="80" text-anchor="middle" font-family="Cormorant Garamond, serif" font-size="22" font-style="italic" fill="currentColor">Don Bullebulle</text>
    <circle cx="160" cy="34" r="12" fill="none" stroke="currentColor" stroke-width="1.2"/>
    <g stroke="currentColor" stroke-width="1">${Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      return `<line x1="${160 + Math.cos(a) * 15}" y1="${34 + Math.sin(a) * 15}" x2="${160 + Math.cos(a) * 21}" y2="${34 + Math.sin(a) * 21}"/>`;
    }).join('')}</g>
    <text x="160" y="118" text-anchor="middle" font-family="Jost, sans-serif" font-size="10" letter-spacing="4" fill="currentColor">MÉRIDA · 1847</text>
    <rect x="20" y="100" width="96" height="30" fill="url(#h2)" opacity="0.6"/>
    <rect x="204" y="100" width="96" height="30" fill="url(#h2)" opacity="0.6"/>
  </svg>`,
  buril: `<svg class="engr-svg" viewBox="0 0 220 180" aria-hidden="true">${HATCH}
    <path d="M30 120 L150 120 L190 150 L70 150 Z" fill="url(#h1)" stroke="currentColor" stroke-width="1.6"/>
    <path d="M30 120 L30 110 L150 110 L150 120" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="M150 110 L190 140 L190 150" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <g fill="none" stroke="currentColor" stroke-width="0.9">${Array.from({ length: 7 }, (_, i) => `<path d="M${52 + i * 12} 126 q6 10 12 0"/>`).join('')}</g>
    <path d="M70 30 L150 96 L156 92 L78 24 Z" fill="currentColor"/>
    <ellipse cx="66" cy="26" rx="22" ry="14" transform="rotate(40 66 26)" fill="url(#h2)" stroke="currentColor" stroke-width="1.6"/>
  </svg>`,
  placa: `<svg class="engr-svg wide" viewBox="0 0 300 120" aria-hidden="true">${HATCH}
    <rect x="10" y="20" width="280" height="80" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
    <rect x="18" y="28" width="264" height="64" fill="url(#h3)" opacity="0.25"/>
    <text x="150" y="56" text-anchor="middle" font-family="Jost, sans-serif" font-size="20" letter-spacing="6" fill="currentColor">CALLE 61</text>
    <text x="150" y="80" text-anchor="middle" font-family="Cormorant Garamond, serif" font-style="italic" font-size="16" fill="currentColor">Pasaje Picheta</text>
  </svg>`,
  arcos: `<svg class="engr-svg wide" viewBox="0 0 300 160" aria-hidden="true">${HATCH}
    <rect x="12" y="20" width="276" height="128" fill="url(#h3)" opacity="0.18"/>
    ${[0, 1, 2].map((i) => `<path d="M${30 + i * 86} 148 V78 a40 40 0 0 1 80 0 V148" fill="url(#h1)" opacity="0.5" stroke="currentColor" stroke-width="1.6"/>`).join('')}
    <path d="M12 20 H288 M12 30 H288" stroke="currentColor" stroke-width="1"/>
    <text x="150" y="16" text-anchor="middle" font-family="Cormorant Garamond, serif" font-style="italic" font-size="13" fill="currentColor">1639</text>
  </svg>`,
  platillo: `<svg class="engr-svg" viewBox="0 0 200 140" aria-hidden="true">${HATCH}
    <ellipse cx="100" cy="88" rx="86" ry="34" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <ellipse cx="100" cy="84" rx="62" ry="22" fill="url(#h1)" stroke="currentColor" stroke-width="1"/>
    <path d="M80 50 q8 -18 0 -34 M100 46 q8 -18 0 -34 M120 50 q8 -18 0 -34" fill="none" stroke="currentColor" stroke-width="1" opacity="0.7"/>
  </svg>`,
};

// Identificadores únicos por grabado (los patrones de tramado no chocan entre sí).
for (const k of Object.keys(ART)) ART[k] = ART[k].replaceAll('id="h', `id="${k}-h`).replaceAll('url(#h', `url(#${k}-h`);
