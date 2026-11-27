import { DRINKS_MENU } from '../data/content.js';
import soBerry from '../assets/bebidas/so-berry-matcha.webp';
import dirty from '../assets/bebidas/dirty-matcha.webp';
import berryZesty from '../assets/bebidas/berry-zesty.webp';
import mocha from '../assets/bebidas/iced-mocha-latte.webp';
import americano from '../assets/bebidas/iced-americano.webp';
import blackTea from '../assets/bebidas/black-iced-tea.webp';
import collagenMatcha from '../assets/bebidas/collagen-matcha.webp';

// Fotos de bebidas del sitio actual (precio solo donde coincide con el menú)
const DRINKS = [
  { n: 'So Berry Matcha', k: 'Tea latte · colágeno', p: 210, img: soBerry },
  { n: 'Collagen Matcha', k: 'Glow on the go', img: collagenMatcha },
  { n: 'Dirty Matcha', k: 'Coffee latte · colágeno', p: 180, img: dirty },
  { n: 'Berry Zesty', k: 'Dewy tonic', p: 120, img: berryZesty },
  { n: 'Iced Mocha Latte', k: 'Coffee latte', img: mocha },
  { n: 'Iced Americano', k: 'Tea & coffee', img: americano },
  { n: 'Black Iced Tea', k: 'Tea & coffee', img: blackTea },
];

export const renderBar = () => {
  const board = document.getElementById('board');
  board.innerHTML = DRINKS_MENU.map(
    (g) => `
    <div class="board__col">
      <h3>${g.h}${g.script ? `<em>${g.script}</em>` : ''}</h3>
      <ul>${g.items.map(([n, p]) => `<li><span>${n}</span><i></i><b>${p}</b></li>`).join('')}</ul>
    </div>`
  ).join('');

  // Cinta de bebidas: se duplica para el bucle continuo (la copia es decorativa)
  const track = document.getElementById('drinks');
  const item = (d, hidden) => `
    <figure class="drink"${hidden ? ' aria-hidden="true"' : ''}>
      <img src="${d.img}" alt="${hidden ? '' : d.n}" loading="lazy" />
      <figcaption><b>${d.n}</b><span>${d.k}${d.p ? ` · $${d.p}` : ''}</span></figcaption>
    </figure>`;
  track.innerHTML = DRINKS.map((d) => item(d, false)).join('') + DRINKS.map((d) => item(d, true)).join('');
};
