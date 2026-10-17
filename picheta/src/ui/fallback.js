// Versión estática (sin WebGL o con ?static): mismas imágenes, textos y menú,
// en una sola página con anclas (#historia, #menu…).
export function renderFallback(root, { content, config }) {
  document.documentElement.classList.add('static');
  const sections = Object.entries(content.sections);
  root.innerHTML = `
    <div class="static-page">
      <header class="static-hero" id="inicio">
        <img class="static-logo" src="${config.assets.logo}" alt="" width="240" height="240" />
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
      ${sections
        .map(
          ([id, s]) => `
        <section class="static-section" id="${id}">
          <h2 class="panel-title">${s.title}</h2>
          <p class="panel-lead">${s.lead}</p>
          ${s.blocks
            .map((b) =>
              b.type === 'meta'
                ? `<p class="meta in"><span>${b.label}</span>${b.text}</p>`
                : `<p class="${b.type === 'phrase' ? 'phrase' : b.type} in">${b.text}</p>`,
            )
            .join('')}
        </section>`,
        )
        .join('')}
      <footer class="panel-foot">
        <a href="${config.links.instagram}" target="_blank" rel="noopener">${content.footer.instagram}</a>
        <span aria-hidden="true">·</span>
        <a href="${config.links.facturacion}" target="_blank" rel="noopener">${content.footer.facturacion}</a>
        <p class="credit">${content.footer.credit}</p>
      </footer>
    </div>`;
}
