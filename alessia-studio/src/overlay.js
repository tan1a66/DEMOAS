import { BRAND, VISION, PROJECTS, CONTACT } from './content.js';

// Testi sopra il canvas (HTML vero: selezionabile, leggibile dagli screen reader).
// Ogni sezione ha una finestra di avanzamento [da, a] calcolata dal percorso: appare quando la
// telecamera arriva alla sosta e scompare quando riparte.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createOverlay(root, sections) {
  const items = [];
  const add = (html, range, cls) => {
    const el = document.createElement('section');
    el.className = `ov ${cls}`;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = html;
    root.appendChild(el);
    items.push({ el, range });
    return el;
  };

  add(`
    <h1 class="brand">${esc(BRAND.name)}</h1>
    <p class="tagline">${esc(BRAND.tagline)}</p>
  `, sections.brand, 'ov-brand');

  add(`
    <p class="label">${esc(VISION.label)}</p>
    <h2 class="title">${esc(VISION.title)}</h2>
    <p class="lead">${esc(VISION.text)}</p>
    <div class="cols">
      <div>
        <p class="label">${esc(VISION.whatLabel)}</p>
        <p>${esc(VISION.what)}</p>
      </div>
      <div>
        <p class="label">${esc(VISION.servicesLabel)}</p>
        <ul class="services">${VISION.services.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
    </div>
  `, sections.vision, 'ov-vision');

  add(`
    <p class="label">Progetti</p>
    <h2 class="title">Ogni bolla è un progetto.</h2>
  `, sections.projectsTitle, 'ov-projects-title');

  PROJECTS.forEach((p, i) => {
    const meta = [String(i + 1).padStart(2, '0'), p.year].filter(Boolean).join(' · ');
    add(`
      <p class="label">${esc(meta)}</p>
      <h3 class="project-title">${esc(p.title)}</h3>
      <p class="kind">${esc(p.kind)}</p>
      <p class="text">${esc(p.text)}</p>
      ${p.url ? `<a class="cta" href="${esc(p.url)}" target="_blank" rel="noopener">Apri la demo <span aria-hidden="true">→</span></a>` : ''}
    `, sections.projects[i], `ov-project${p.placeholder ? ' is-placeholder' : ''}`);
  });

  const links = [
    CONTACT.email && `<a class="cta primary" href="mailto:${esc(CONTACT.email)}">${esc(CONTACT.email)}</a>`,
    CONTACT.whatsapp && `<a class="cta" href="https://wa.me/${esc(CONTACT.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a>`,
    CONTACT.instagram && `<a class="cta" href="https://instagram.com/${esc(CONTACT.instagram.replace(/^@/, ''))}" target="_blank" rel="noopener">Instagram</a>`,
  ].filter(Boolean).join('');
  add(`
    <p class="label">${esc(CONTACT.label)}</p>
    <h2 class="title">${esc(CONTACT.title)}</h2>
    <p class="lead">${esc(CONTACT.text)}</p>
    <div class="links">${links}</div>
  `, sections.contact, 'ov-contact');

  // velatura dietro ai testi lunghi (a sinistra su desktop, in basso su telefono): leggibili su
  // qualunque sfondo, anche sul disco bianco del lucernario
  const scrim = document.createElement('div');
  scrim.className = 'ov-scrim';
  root.prepend(scrim);
  const scrimRanges = [sections.vision, ...sections.projects, sections.contact];

  let active = -1;
  function update(p) {
    scrim.classList.toggle('on', scrimRanges.some((r) => p >= r[0] && p <= r[1]));
    items.forEach(({ el, range }) => {
      const on = p >= range[0] && p <= range[1];
      if (on !== el.classList.contains('on')) {
        el.classList.toggle('on', on);
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
      }
    });
    // indice del progetto in sosta (la sua bolla si mette a fuoco)
    active = sections.projects.findIndex((r) => p >= r[0] && p <= r[1]);
    return active;
  }

  return { update, get active() { return active; } };
}
