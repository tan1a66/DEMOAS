import { CONFIG } from '../config.js';

// Prenotazione su WhatsApp: il modulo compone il messaggio, mostra l'anteprima e apre
// WhatsApp con il testo già scritto (wa.me). Nessun dato viene salvato o inviato dal sito.

const AREAS = {
  tutela: 'Tutela della donna, vittime di genere e Codice Rosso',
  'legal-design': 'Legal Design nel Contratto',
  altro: 'Altra questione',
};

const $ = (id) => document.getElementById(id);
const waNumber = () => (CONFIG.contatti.whatsapp || '').replace(/\D/g, '');

function formatDay(value) {
  if (!value) return '';
  const d = new Date(`${value}T12:00:00`);
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function initBooking() {
  const dialog = $('booking');
  const form = $('booking-form');
  const preview = $('booking-preview');
  const warn = $('booking-warn');

  const message = () => {
    const d = new FormData(form);
    const nome = String(d.get('nome') || '').trim();
    const giorno = formatDay(String(d.get('giorno') || ''));
    const note = String(d.get('note') || '').trim();
    const lines = [
      'Buongiorno Avvocato Pusceddu,',
      `sono ${nome || '[nome e cognome]'} e vorrei prenotare una consulenza.`,
      '',
      `Questione: ${AREAS[d.get('area')] ?? AREAS.altro}`,
    ];
    if (giorno) lines.push(`Giorno preferito: ${giorno}`);
    lines.push(`Fascia oraria: ${String(d.get('fascia') || 'Indifferente').toLowerCase()}`);
    if (note) lines.push('', note);
    lines.push('', 'Grazie, cordiali saluti.');
    return lines.join('\n');
  };
  const refresh = () => {
    preview.textContent = message();
  };

  const open = (area) => {
    const radio = form.querySelector(`input[name="area"][value="${area || 'altro'}"]`);
    if (radio) radio.checked = true;
    warn.hidden = true;
    refresh();
    document.body.classList.add('booking-open');
    dialog.showModal();
    form.elements.nome.focus();
  };

  form.addEventListener('input', refresh);
  form.elements.giorno.min = new Date().toISOString().slice(0, 10);
  dialog.addEventListener('close', () => document.body.classList.remove('booking-open'));
  $('booking-close').addEventListener('click', () => dialog.close());
  // Clic sullo sfondo scuro: chiude.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.elements.nome.value.trim()) {
      warn.textContent = 'Scrivi nome e cognome, così lo studio sa chi sta scrivendo.';
      warn.hidden = false;
      form.elements.nome.focus();
      return;
    }
    const number = waNumber();
    if (!number) {
      warn.textContent = 'Numero WhatsApp dello studio da inserire (src/config.js). Intanto puoi copiare il messaggio.';
      warn.hidden = false;
      return;
    }
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message())}`, '_blank', 'noopener');
    dialog.close();
  });

  $('booking-copy').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(message());
      btn.textContent = 'Copiato';
    } catch {
      btn.textContent = 'Copia non riuscita';
    }
    setTimeout(() => (btn.textContent = 'Copia il messaggio'), 2200);
  });

  for (const b of document.querySelectorAll('[data-book]')) b.addEventListener('click', () => open(b.dataset.book));
}
