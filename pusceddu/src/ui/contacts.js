import { CONFIG } from '../config.js';

// Sedi, contatti, link delle pubblicazioni e finestre legali, presi da src/config.js.
// Le foto delle sedi si caricano da sole da src/assets/sedi/<id>.jpg (se presenti).
// I dati mancanti non compaiono, a meno che CONFIG.mostraSegnaposto sia true.

const photos = import.meta.glob('../assets/sedi/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' });
const photoFor = (id) => Object.entries(photos).find(([path]) => path.split('/').pop().replace(/\.\w+$/, '') === id)?.[1];

const SHOW = CONFIG.mostraSegnaposto;
const placeholder = (label = 'da inserire') => `<span class="placeholder">${label}</span>`;
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function renderContacts() {
  const offices = document.getElementById('offices');
  offices.innerHTML = CONFIG.sedi
    .filter((s) => s.indirizzo || SHOW)
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
  const tel = (n) => esc(n.replace(/\s+/g, ''));
  const rows = [
    ['WhatsApp', c.whatsapp && esc(c.whatsapp)],
    ['Email', c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`],
    ['Telefono', c.telefono && `<a href="tel:${tel(c.telefono)}">${esc(c.telefono)}</a>`],
    ['PEC', c.pec && `<a href="mailto:${esc(c.pec)}">${esc(c.pec)}</a>`],
  ].filter(([, v]) => v || SHOW);
  const list = document.getElementById('contact-list');
  list.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v || placeholder()}</dd>`).join('');
  list.hidden = rows.length === 0;

  document.getElementById('year').textContent = String(new Date().getFullYear());
  const piva = c.partitaIva ? esc(c.partitaIva) : SHOW ? placeholder() : '';
  document.getElementById('piva').innerHTML = piva ? ` · P.IVA ${piva}` : '';
  for (const el of document.querySelectorAll('[data-piva-line]')) el.innerHTML = piva ? ` · P.IVA ${piva}` : '';
  for (const el of document.querySelectorAll('[data-email-line]')) el.innerHTML = c.email ? ` — ${esc(c.email)}` : '';

  for (const a of document.querySelectorAll('[data-pub]')) {
    const url = CONFIG.pubblicazioni[a.dataset.pub];
    if (url) {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
    } else if (SHOW) {
      a.title = 'Link da inserire';
      a.addEventListener('click', (e) => e.preventDefault());
    } else {
      a.hidden = true;
    }
  }

  // Finestre "Privacy" e "Note legali"
  for (const b of document.querySelectorAll('[data-legal]')) {
    const dialog = document.getElementById(b.dataset.legal);
    b.addEventListener('click', () => {
      document.body.classList.add('booking-open');
      dialog.showModal();
    });
  }
  for (const dialog of document.querySelectorAll('dialog.legal')) {
    dialog.addEventListener('close', () => document.body.classList.remove('booking-open'));
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
    });
  }
}
