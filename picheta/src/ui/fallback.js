import { renderSection, renderFooter } from './sections.js';

// Versión estática (sin WebGL o con ?static): mismas imágenes, textos y menú,
// en una sola página con anclas (#historia, #menu…).
export function renderFallback(root, { content, config }) {
  document.documentElement.classList.add('static');
  const ids = Object.keys(content.sections);
  root.innerHTML = `
    <div class="static-page">
      <header class="static-hero" id="inicio" style="--hero:url('${config.assets.photos.terraza}')">
        <img class="static-logo" src="${config.assets.logo}" alt="" width="220" height="200" crossorigin="anonymous" />
        <h1 class="brand">${content.brand}</h1>
        <p class="tagline">${content.tagline}</p>
      </header>
      <nav class="static-nav" aria-label="Navegación">
        <ul class="nav-list">
          ${content.nav
            .map(
              (row) =>
                `<li>${row
                  .map((it) =>
                    it.external
                      ? `<a href="${config.links.facturacion}" target="_blank" rel="noopener">${it.label}</a>`
                      : `<a href="#${it.id}">${it.label}</a>`,
                  )
                  .join('<span class="nav-dot" aria-hidden="true">·</span>')}</li>`,
            )
            .join('')}
        </ul>
      </nav>
      ${ids
        .map((id) => `<section class="static-section" id="${id}" data-section="${id}">${renderSection(id, { content, config, isStatic: true })}</section>`)
        .join('')}
      ${renderFooter({ content, config })}
    </div>`;
  root.querySelectorAll('.reveal, .phrase, .text, .meta').forEach((n) => n.classList.add('in'));
  transparentLogo(root.querySelector('.static-logo'));
}

// El PNG del logo tiene fondo oscuro: se convierte su luminancia en transparencia
// para que sólo quede el trazo de tiza sobre la foto de la portada.
function transparentLogo(img) {
  const run = () => {
    try {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < d.data.length; i += 4) {
        const l = (d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11) / 255;
        d.data[i + 3] = Math.max(0, Math.min(255, (l - 0.25) * 1.6 * 255));
        d.data[i] = d.data[i + 1] = d.data[i + 2] = 239;
      }
      g.putImageData(d, 0, 0);
      img.src = c.toDataURL();
      img.style.mixBlendMode = 'normal';
    } catch {
      /* si el lienzo no se puede leer, queda la imagen original */
    }
  };
  if (img.complete && img.naturalWidth) run();
  else img.addEventListener('load', run, { once: true });
}
