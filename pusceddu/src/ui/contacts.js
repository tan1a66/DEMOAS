import { CONFIG } from '../config.js';

// Sedi, contatti e link delle pubblicazioni presi da src/config.js.
// Le foto delle sedi si caricano da sole da src/assets/sedi/<id>.jpg (se presenti).

const photos = import.meta.glob('../assets/sedi/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' });
const photoFor = (id) => Object.entries(photos).find(([path]) => path.split('/').pop().replace(/\.\w+$/, '') === id)?.[1];

const placeholder = (label = 'da inserire') => `<span class="placeholder">${label}</span>`;
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function renderContacts() {
  const offices = document.getElementById('offices');
  offices.innerHTML = CONFIG.sedi
    .map((s) => {
      const photo = photoFor(s.id);
      return `<div class="office${photo ? '' : ' office--nophoto'}">
        ${photo ? `<img src="${photo}" alt="Studio di ${esc(s.nome)}" loading="lazy" />` : ''}
        <div>
          <h3>${esc(s.nome)}</h3>
          <p>${s.indirizzo ? esc(s.indirizzo) : `Indirizzo ${placeholder()}`}</p>
          ${s.mappa ? `<a class="more" href="${esc(s.mappa)}" target="_blank" rel="noopener">Apri la mappa</a>` : ''}
        </div>
      </div>`;
    })
    .join('');

  const c = CONFIG.contatti;
  const rows = [
    ['WhatsApp', c.whatsapp ? esc(c.whatsapp) : placeholder()],
    ['Email', c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : placeholder()],
    ['Telefono', c.telefono ? `<a href="tel:${esc(c.telefono.replace(/\s+/g, ''))}">${esc(c.telefono)}</a>` : placeholder()],
  ];
  if (c.pec) rows.push(['PEC', `<a href="mailto:${esc(c.pec)}">${esc(c.pec)}</a>`]);
  document.getElementById('contact-list').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

  document.getElementById('year').textContent = String(new Date().getFullYear());
  document.getElementById('piva').innerHTML = ` · P.IVA ${c.partitaIva ? esc(c.partitaIva) : placeholder()}`;

  for (const a of document.querySelectorAll('[data-pub]')) {
    const url = CONFIG.pubblicazioni[a.dataset.pub];
    if (url) {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
    } else {
      a.title = 'Link da inserire';
      a.addEventListener('click', (e) => e.preventDefault());
    }
  }
}
