import { getText, BRAND_NAME, CONTACT_LINKS, LANGS, DEFAULT_LANG, waLink } from './src/content.js';

// Quello che Google e le anteprime nei social leggono senza eseguire il 3D, scritto nell'HTML al
// build dai testi di src/content.js (nella lingua predefinita), così resta uguale al sito:
// - in <head>: titolo, descrizione, icone, Open Graph e X (immagine di anteprima public/og-image.jpg),
//   dati strutturati schema.org (Organization) e, se c'è il dominio, link canonico e lingue alternative
// - in <body>: i testi del sito in HTML semplice dentro <noscript>, per chi non esegue JavaScript
// Nel sito il titolo e la descrizione seguono poi la lingua scelta (src/overlay.js).

// Indirizzo pubblico del sito, con la barra finale (es. 'https://www.dominio.com/'). Serve per
// l'immagine di anteprima, il link canonico e le lingue alternative, che devono essere assoluti:
// finché è vuoto l'immagine resta relativa (Google la trova; WhatsApp e Facebook vogliono il dominio).
export const SITE_URL = '';

const LOCALE = { es: 'es_MX', it: 'it_IT', en: 'en_US', pt: 'pt_BR' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const abs = (path) => (SITE_URL ? new URL(path, SITE_URL).href : path);

function head() {
  const T = getText(DEFAULT_LANG);
  const title = T.seo.title;
  const description = `${T.seo.description} ${T.origin.join(' · ')}.`;
  const image = abs('og-image.jpg');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Alessia Studio',
    ...(SITE_URL ? { url: SITE_URL, logo: abs('icon-192.png') } : {}),
    image,
    description,
    slogan: T.vision.title,
    areaServed: T.origin,
    knowsAbout: T.services.groups.flatMap((g) => g.items),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: `+${CONTACT_LINKS.whatsapp.replace(/\D/g, '')}`,
      url: waLink(T.ui.whatsappMsg),
      availableLanguage: LANGS.map((l) => l.name),
    },
  };
  const meta = (attr, key, value) => `<meta ${attr}="${key}" content="${esc(value)}" />`;
  return [
    `<title>${esc(title)}</title>`,
    meta('name', 'description', description),
    meta('name', 'robots', 'index, follow'),
    '<link rel="icon" href="favicon.svg" type="image/svg+xml" />',
    '<link rel="icon" href="icon-192.png" type="image/png" sizes="192x192" />',
    '<link rel="apple-touch-icon" href="apple-touch-icon.png" />',
    ...(SITE_URL ? [
      `<link rel="canonical" href="${esc(SITE_URL)}" />`,
      ...LANGS.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${esc(abs(`?lang=${l.code}`))}" />`),
      `<link rel="alternate" hreflang="x-default" href="${esc(SITE_URL)}" />`,
      meta('property', 'og:url', SITE_URL),
    ] : []),
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', 'Alessia Studio'),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    meta('property', 'og:image', image),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('property', 'og:image:alt', T.seo.imageAlt),
    meta('property', 'og:locale', LOCALE[DEFAULT_LANG]),
    ...LANGS.filter((l) => l.code !== DEFAULT_LANG).map((l) => meta('property', 'og:locale:alternate', LOCALE[l.code])),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', image),
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');
}

function body() {
  const T = getText(DEFAULT_LANG);
  const p = (s, cls) => `<p${cls ? ` class="${cls}"` : ''}>${esc(s)}</p>`;
  return `<noscript>
      <article class="static">
        <h1>${esc(BRAND_NAME)}</h1>
        ${p(T.tagline, 'tagline')}
        ${p(T.origin.join(' · '), 'origin')}
        <section>
          <h2>${esc(T.vision.label)}</h2>
          ${p(T.vision.title, 'title')}
          ${p(T.vision.text)}
          ${p(T.vision.world)}
        </section>
        <section>
          <h2>${esc(T.services.label)}</h2>
          ${p(T.services.title, 'title')}
          ${p(T.services.text)}
          ${T.services.groups.map((g) => `<h3>${esc(g.label)}</h3><ul>${g.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('\n          ')}
        </section>
        <section>
          <h2>${esc(T.contact.label)}</h2>
          ${p(T.contact.title, 'title')}
          ${p(T.contact.text)}
          <p><a href="${esc(waLink(T.ui.whatsappMsg))}">${esc(T.contact.cta)}</a></p>
        </section>
      </article>
    </noscript>`;
}

export function seo() {
  return {
    name: 'alessia-seo',
    transformIndexHtml(html) {
      return html.replace('<!-- seo:head -->', head()).replace('<!-- seo:body -->', body());
    },
  };
}
