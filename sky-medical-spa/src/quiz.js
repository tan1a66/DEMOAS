// Faciales: "¿Cómo sientes tu piel hoy?". Si sceglie il tipo di pelle, compare il facial da
// cui partire (orientativo) e il bottone porta ad Agendar con il servizio e la nota già pronti.
const SUGERENCIAS = {
  seca: { name: 'Hidratación profunda', text: 'Para devolver a tu piel el agua y la suavidad que le faltan.' },
  grasa: { name: 'Limpieza facial profunda', text: 'Para retirar impurezas y exceso de grasa, y equilibrar la piel.' },
  mixta: { name: 'Limpieza e hidratación', text: 'Equilibrar la zona T y nutrir las zonas más secas.' },
  sensible: { name: 'Facial calmante', text: 'Productos suaves y un protocolo pensado para no irritar.' },
  manchas: { name: 'Peeling, tras valoración', text: 'Para unificar el tono, siempre después de revisar tu piel.' },
};
const NOMBRE = { seca: 'seca', grasa: 'grasa', mixta: 'mixta', sensible: 'sensible', manchas: 'con manchas' };

export const createQuiz = (root, { onPick } = {}) => {
  const box = root.querySelector('.ch-quiz');
  if (!box) return;
  const out = box.querySelector('.quiz-out');
  const name = out.querySelector('.quiz-name');
  const text = out.querySelector('.quiz-text');
  const cta = box.querySelector('.quiz-cta');
  box.addEventListener('change', (e) => {
    const v = e.target.value;
    const s = SUGERENCIAS[v];
    if (!s) return;
    name.textContent = s.name;
    text.textContent = s.text;
    out.classList.add('is-on');
    cta.textContent = 'Agenda este facial';
    cta.dataset.nota = `piel ${NOMBRE[v]} · me interesa: ${s.name.toLowerCase()}`;
    onPick?.(out);
  });
};
