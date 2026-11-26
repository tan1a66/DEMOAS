// Tienda: la cosmetica del sito attuale (Biologique Recherche e Sepai), con i prezzi veri.
// Filtro per categoria, taglie dello stesso prodotto in una scheda, una bolsa che si ricorda
// (in questo browser) e la pagina di pagamento come quella del negozio attuale (dati, entrega,
// pago, codice promozionale, riepilogo). È una demo: nessun dato parte e nessun pagamento viene
// fatto; "Pagar" mostra la conferma di prova (la pasarela vera si collega nel sito finale).
import { PRODUCTOS } from './productos.js';

const FOTOS = import.meta.glob('./tienda/*.webp', { eager: true, query: '?url', import: 'default' });
const fotoDe = (id) => FOTOS[`./tienda/${id}.webp`];
const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const BY_ID = new Map(PRODUCTOS.map((p) => [p.id, p]));
const KEY = 'bq-bolsa';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/**
 * root: la sezione #tienda; sheet: il pannello della bolsa; badge: i contatori (testata e
 * bottone). onAdd: la seta risponde quando si aggiunge qualcosa.
 */
export const createTienda = ({ root, sheet, onAdd = () => {} }) => {
  const grid = root.querySelector('.shop-grid');
  const filters = root.querySelector('.shop-filters');
  const fab = document.querySelector('.bag-fab');
  const headBag = document.querySelector('.ico-bag');
  const list = sheet.querySelector('.bag-list');
  const total = sheet.querySelector('.bag-total b');
  const send = sheet.querySelector('.bag-send');
  const empty = sheet.querySelector('.bag-empty');

  // la bolsa: [{id, talla, n}]
  let bolsa = [];
  try {
    bolsa = JSON.parse(localStorage.getItem(KEY) || '[]').filter((l) => BY_ID.has(l.id));
  } catch {
    bolsa = [];
  }
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(bolsa));
    } catch {
      /* navigazione privata: la bolsa vive finché la pagina è aperta */
    }
  };
  const precio = (l) => BY_ID.get(l.id).variantes.find((v) => v.talla === l.talla)?.precio ?? 0;
  const count = () => bolsa.reduce((s, l) => s + l.n, 0);
  const sum = () => bolsa.reduce((s, l) => s + l.n * precio(l), 0);

  // ---------- le schede ----------
  for (const p of PRODUCTOS) {
    const card = el('article', 'prod');
    card.dataset.cat = p.cat;
    const ph = el('div', 'prod-photo');
    const img = el('img');
    img.src = fotoDe(p.id);
    img.alt = `${p.nombre}, ${p.marca}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    ph.appendChild(img);
    const info = el('div', 'prod-info');
    info.append(el('p', 'prod-brand', p.marca), el('h3', 'prod-name', p.nombre), el('p', 'prod-sub', p.sub));
    // le taglie: si sceglie e il prezzo cambia (la più grande è quella di partenza)
    let v = p.variantes[p.variantes.length - 1];
    const price = el('p', 'prod-price', eur.format(v.precio));
    if (p.variantes.length > 1) {
      const sizes = el('div', 'prod-sizes');
      sizes.setAttribute('role', 'radiogroup');
      sizes.setAttribute('aria-label', `Tamaño de ${p.nombre}`);
      for (const opt of p.variantes) {
        const b = el('button', 'size', opt.talla);
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(opt === v));
        b.addEventListener('click', () => {
          v = opt;
          for (const o of sizes.children) o.setAttribute('aria-checked', String(o === b));
          price.textContent = eur.format(v.precio);
        });
        sizes.appendChild(b);
      }
      info.appendChild(sizes);
    } else if (v.talla) info.appendChild(el('p', 'prod-size', v.talla));
    const add = el('button', 'prod-add', 'Añadir');
    add.type = 'button';
    add.setAttribute('aria-label', `Añadir ${p.nombre} a la bolsa`);
    add.addEventListener('click', () => {
      const line = bolsa.find((l) => l.id === p.id && l.talla === v.talla);
      if (line) line.n++;
      else bolsa.push({ id: p.id, talla: v.talla, n: 1 });
      save();
      paint();
      add.textContent = 'Añadido';
      add.classList.add('is-added');
      clearTimeout(add._t);
      add._t = setTimeout(() => {
        add.textContent = 'Añadir';
        add.classList.remove('is-added');
      }, 1400);
      fab.classList.remove('bump');
      void fab.offsetWidth; // riparte l'animazione
      fab.classList.add('bump');
      onAdd();
    });
    const row = el('div', 'prod-buy');
    row.append(price, add);
    info.appendChild(row);
    card.append(ph, info);
    grid.appendChild(card);
  }

  // ---------- filtro ----------
  filters.addEventListener('change', (e) => {
    const cat = e.target.value;
    for (const c of grid.children) c.hidden = cat !== 'todo' && c.dataset.cat !== cat;
  });

  // ---------- la bolsa ----------
  const paint = () => {
    const n = count();
    for (const b of document.querySelectorAll('.bag-count')) {
      b.textContent = n;
      b.hidden = n === 0;
    }
    fab.querySelector('.bag-fab-total').textContent = eur.format(sum());
    document.documentElement.classList.toggle('has-bag', n > 0);
    headBag.setAttribute('aria-label', n ? `Bolsa: ${n} productos` : 'Bolsa');
    list.textContent = '';
    for (const l of bolsa) {
      const p = BY_ID.get(l.id);
      const li = el('li', 'bag-line');
      const img = el('img');
      img.src = fotoDe(p.id);
      img.alt = '';
      const txt = el('div', 'bag-txt');
      txt.append(el('p', 'bag-name', p.nombre), el('p', 'bag-meta', [p.marca, l.talla].filter(Boolean).join(' · ')));
      const qty = el('div', 'bag-qty');
      const minus = el('button', null, '−');
      const plus = el('button', null, '+');
      minus.type = plus.type = 'button';
      minus.setAttribute('aria-label', `Quitar uno de ${p.nombre}`);
      plus.setAttribute('aria-label', `Añadir otro de ${p.nombre}`);
      minus.addEventListener('click', () => {
        l.n--;
        if (l.n <= 0) bolsa = bolsa.filter((x) => x !== l);
        save();
        paint();
      });
      plus.addEventListener('click', () => {
        l.n++;
        save();
        paint();
      });
      qty.append(minus, el('span', null, String(l.n)), plus);
      li.append(img, txt, qty, el('p', 'bag-price', eur.format(l.n * precio(l))));
      list.appendChild(li);
    }
    total.textContent = eur.format(sum());
    empty.hidden = n > 0;
    send.hidden = n === 0;
    sheet.querySelector('.bag-foot').hidden = n === 0;
  };

  // ---------- la pagina di pagamento ----------
  const co = document.querySelector('.checkout');
  const coForm = co.querySelector('.co-form');
  const coBody = co.querySelector('.co-body');
  const coDone = co.querySelector('.co-done');
  const coErr = co.querySelector('.co-error');
  const coAddress = co.querySelector('.co-address');
  const promoMsg = co.querySelector('.co-promo-msg');
  const paintCheckout = () => {
    const n = count();
    co.querySelector('.co-items').textContent = `(${n} ${n === 1 ? 'producto' : 'productos'})`;
    const ul = co.querySelector('.co-list');
    ul.textContent = '';
    for (const l of bolsa) {
      const p = BY_ID.get(l.id);
      const li = el('li');
      const ph = el('span', 'co-ph');
      const img = el('img');
      img.src = fotoDe(p.id);
      img.alt = '';
      ph.append(img, el('i', null, String(l.n)));
      const txt = el('span', 'co-txt');
      txt.append(el('b', null, p.nombre), el('small', null, [p.marca, l.talla].filter(Boolean).join(' · ')));
      li.append(ph, txt, el('span', 'co-price', eur.format(l.n * precio(l))));
      ul.appendChild(li);
    }
    const envio = coForm.elements.entrega.value === 'envio';
    co.querySelector('.co-sub').textContent = eur.format(sum());
    co.querySelector('.co-ship').textContent = envio ? 'Se calcula con tu dirección' : 'Gratis';
    co.querySelector('.co-total').textContent = eur.format(sum());
    co.querySelector('.co-pay').textContent = `Pagar ${eur.format(sum())}`;
  };
  const openCheckout = () => {
    close();
    paintCheckout();
    coBody.hidden = false;
    coDone.hidden = true;
    co.hidden = false;
    co.scrollTop = 0;
    document.documentElement.classList.add('co-open');
    requestAnimationFrame(() => co.classList.add('is-open'));
  };
  const closeCheckout = () => {
    co.classList.remove('is-open');
    document.documentElement.classList.remove('co-open');
    setTimeout(() => (co.hidden = true), 450);
  };
  send.addEventListener('click', openCheckout);
  co.querySelector('.co-back').addEventListener('click', closeCheckout);
  co.querySelector('.co-done-back').addEventListener('click', closeCheckout);
  coForm.addEventListener('change', (e) => {
    if (e.target.name === 'entrega') {
      coAddress.hidden = e.target.value !== 'envio';
      paintCheckout();
    }
    e.target.closest('.co-field')?.classList.remove('is-bad');
  });
  co.querySelector('.co-promo button').addEventListener('click', () => {
    const v = co.querySelector('.co-promo input').value.trim();
    promoMsg.textContent = v ? `El código «${v}» no es válido.` : 'Escribe tu código.';
    promoMsg.hidden = false;
  });
  coForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // campi obbligatori (l'indirizzo solo con l'envío)
    const need = ['email', 'nombre', 'apellido', 'telefono'];
    if (coForm.elements.entrega.value === 'envio') need.push('direccion', 'cp', 'ciudad');
    let first = null;
    for (const name of need) {
      const input = coForm.elements[name];
      const ok = name === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim()) : input.value.trim().length > 1;
      input.closest('.co-field').classList.toggle('is-bad', !ok);
      if (!ok && !first) first = input;
    }
    coErr.hidden = !first;
    if (first) {
      first.focus();
      return;
    }
    // la conferma di prova: niente viene inviato; la bolsa si svuota come dopo un ordine vero
    co.querySelector('.co-done-name').textContent = `, ${coForm.elements.nombre.value.trim().split(' ')[0]}`;
    coBody.hidden = true;
    coDone.hidden = false;
    co.scrollTop = 0;
    bolsa = [];
    save();
    paint();
    onAdd();
  });

  // il pannello: si apre dal bottone della bolsa (o dall'icona in alto), si chiude con ✕,
  // con il fondo o con Esc
  const open = () => {
    sheet.hidden = false;
    document.documentElement.classList.add('bag-open');
    requestAnimationFrame(() => sheet.classList.add('is-open'));
    sheet.querySelector('.bag-close').focus({ preventScroll: true });
  };
  const close = () => {
    sheet.classList.remove('is-open');
    document.documentElement.classList.remove('bag-open');
    setTimeout(() => (sheet.hidden = true), 450);
  };
  fab.addEventListener('click', open);
  sheet.querySelector('.bag-close').addEventListener('click', close);
  sheet.querySelector('.bag-backdrop').addEventListener('click', close);
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!co.hidden) closeCheckout();
    else if (!sheet.hidden) close();
  });

  paint();
  return { open, close, count };
};
