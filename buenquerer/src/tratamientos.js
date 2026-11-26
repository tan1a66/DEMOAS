// I trattamenti di buenquerer (le categorie del sito attuale, con le loro foto).
// Diagnóstico è la sezione sviluppata; gli altri aprono una pagina "Work in progress" con la
// foto, da costruire con la cliente. Le descrizioni sono proposte (da confermare).
// `cita`: il trattamento già scelto quando da qui si va a "Pide cita".
const FOTOS = import.meta.glob('./fotos/*.webp', { eager: true, query: '?url', import: 'default' });
export const foto = (name) => FOTOS[`./fotos/${name}.webp`];

export const TRATAMIENTOS = [
  { id: 'diagnostico', nombre: 'Diagnóstico', desc: 'Tu piel, a fondo: el punto de partida de todo.', foto: 'diagnostico', cita: 'Diagnóstico' },
  { id: 'faciales', nombre: 'Faciales', desc: 'Protocolos Biologique Recherche, radiofrecuencia, microneedling y láser.', foto: 'faciales', cita: 'Facial' },
  { id: 'corporales', nombre: 'Corporales', desc: 'Maderoterapia, ondas de choque, presoterapia y envolturas.', foto: 'corporales', cita: 'Corporal' },
  { id: 'masajes', nombre: 'Masajes', desc: 'Técnicas manuales para soltar, respirar y volver a ti.', foto: 'masajes', cita: 'Masaje o ritual' },
  { id: 'rituales', nombre: 'Rituales', desc: 'Experiencias de aromas y texturas, de la cabeza a los pies.', foto: 'rituales', cita: 'Masaje o ritual' },
  { id: 'mirada', nombre: 'Mirada', desc: 'Pestañas y cejas, cuidadas al detalle.', foto: 'mirada', cita: 'Mirada' },
  { id: 'microblading', nombre: 'Microblading', desc: 'Cejas pelo a pelo, con naturalidad.', foto: 'microblading', cita: 'Mirada' },
  { id: 'manicura', nombre: 'Manicura & Pedicura', desc: 'Manos y pies cuidados, también de larga duración.', foto: 'manicura', cita: 'Manicura y pedicura' },
  { id: 'depilacion', nombre: 'Depilación', desc: 'Piel suave, con el método que mejor va contigo.', foto: 'depilacion', cita: 'Depilación' },
  { id: 'maquillaje', nombre: 'Maquillaje', desc: 'Para cada ocasión, a la medida de tu piel.', foto: 'maquillaje', cita: 'Otro' },
  { id: 'novias', nombre: 'Novias', desc: 'Tu piel y tu look, preparados para el gran día.', foto: 'novias', cita: 'Otro' },
  { id: 'medicina-estetica', nombre: 'Medicina Estética', desc: 'Resultados visibles, con criterio médico.', foto: 'medicina', cita: 'Otro' },
  { id: 'fisioterapia', nombre: 'Fisioterapia', desc: 'Para el cuerpo que te acompaña cada día.', foto: 'fisioterapia', cita: 'Otro' },
  { id: 'mamas', nombre: 'Mamás', desc: 'Cuidados para el embarazo y el posparto.', foto: 'mamas', cita: 'Otro' },
  { id: 'beauty-brunch', nombre: 'Beauty Brunch', desc: 'Belleza para compartir, en grupo.', foto: 'brunch', cita: 'Otro' },
  { id: 'piercing', nombre: 'Piercing', desc: 'Próximamente: anillado profesional de oreja.', foto: 'piercing', cita: 'Otro' },
];

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/** La lista di Tratamientos e le pagine "Work in progress" (prima che main.js legga le pagine). */
export const buildTratamientos = () => {
  const list = document.querySelector('#tratamientos .hub-list');
  const anchor = document.querySelector('#tratamientos');
  TRATAMIENTOS.forEach((t, i) => {
    // la riga della lista: foto, numero, nome e descrizione
    const li = el('li');
    const a = el('a');
    a.href = '#' + t.id;
    a.dataset.section = t.id;
    const ph = el('span', 'hub-photo');
    const img = el('img');
    img.src = foto(t.foto);
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    ph.appendChild(img);
    a.append(ph, el('span', 'hub-num', String(i + 1).padStart(2, '0')), el('span', 'hub-name', t.nombre), el('span', 'hub-desc', t.desc));
    li.appendChild(a);
    list.appendChild(li);
    if (t.id === 'diagnostico') return;

    // la pagina in lavorazione: la foto del sito sulla seta, il nome, "Work in progress"
    const sec = el('section', 'page page-wip');
    sec.id = t.id;
    sec.hidden = true;
    sec.setAttribute('aria-labelledby', 't-' + t.id);
    const wip = el('div', 'wip');
    const fig = el('figure', 'wip-photo');
    const big = el('img');
    big.src = foto(t.foto);
    big.alt = t.nombre;
    big.decoding = 'async';
    fig.appendChild(big);
    const kicker = el('p', 'wip-kicker has-crumb');
    const crumb = el('a', 'crumb', 'Tratamientos');
    crumb.href = '#tratamientos';
    crumb.dataset.up = 'tratamientos';
    const sep = el('span', 'crumb-sep', '/');
    sep.setAttribute('aria-hidden', 'true');
    kicker.append(crumb, sep, document.createTextNode(t.nombre));
    const title = el('h2', 'wip-title', 'Work in progress');
    title.id = 't-' + t.id;
    const cta = el('a', 'wip-cita', 'Pide cita');
    cta.href = '#pide-cita';
    cta.dataset.section = 'pide-cita';
    cta.dataset.servicio = t.cita;
    if (t.cita === 'Otro') cta.dataset.detalle = t.nombre;
    wip.append(fig, kicker, title, el('p', 'wip-studio', 'Alessia Studio'), el('p', 'wip-note', 'Esto lo construimos juntos.'), cta);
    sec.appendChild(wip);
    anchor.after(sec);
  });
  // le immagini nelle storie e in Ven a vernos
  for (const img of document.querySelectorAll('img[data-foto]')) img.src = foto(img.dataset.foto);
};
