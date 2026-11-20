// Nails: "¿De qué color hoy?". Si sceglie un tono: la seta si tinge di quel colore (la tavolozza
// è in src/silk/silk.js, POLISH), compare una riga sul tono e il bottone porta ad Agendar con il
// servizio e la nota già pronti.
const TONOS = {
  nude: { name: 'Nude', text: 'Natural y pulido: tus manos, en su mejor versión.' },
  rosa: { name: 'Rosa antiguo', text: 'Elegante y discreto: el tono de la casa.' },
  vino: { name: 'Vino', text: 'Profundo y elegante, un clásico de noche.' },
  rojo: { name: 'Rojo', text: 'El clásico que nunca falla.' },
  frances: { name: 'Francés', text: 'Base rosada y punta blanca: limpio y atemporal.' },
};

export const createQuiz = (root, { onPick } = {}) => {
  const box = root.querySelector('.ch-quiz');
  if (!box) return;
  const out = box.querySelector('.quiz-out');
  const name = out.querySelector('.quiz-name');
  const text = out.querySelector('.quiz-text');
  const cta = box.querySelector('.quiz-cta');
  box.addEventListener('change', (e) => {
    const v = e.target.value;
    const s = TONOS[v];
    if (!s) return;
    name.textContent = s.name;
    text.textContent = s.text;
    out.classList.add('is-on');
    cta.textContent = 'Agenda con este color';
    cta.dataset.nota = `color: ${s.name.toLowerCase()}`;
    onPick?.(v, out);
  });
};
