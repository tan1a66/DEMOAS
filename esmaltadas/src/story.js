// Ogni sezione come un unico racconto a capitoli, vicini tra loro (niente "diapositive"):
// ogni effetto parte quando il capitolo entra dal basso e si completa mentre attraversa lo
// schermo; avanza con lo scroll, in entrambe le direzioni. Il testo è sempre lo stesso per carattere e grandezza;
// gli effetti stanno negli accenti (numeri, parole grandi, filetti, la linea del percorso).

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => x * x * (3 - 2 * x);
// avanzamento locale: k tra a e b
const seg = (p, a, b) => clamp01((p - a) / (b - a));

/** Spezza il testo di un elemento in parole (span), lasciando gli spazi come testo. */
const splitWords = (el) => {
  const words = el.textContent.replace(/\s+/g, ' ').trim().split(' ');
  el.textContent = '';
  return words.map((w, i) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.textContent = w;
    el.appendChild(s);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    return s;
  });
};

/** Raggruppa le parole già spezzate in righe con una maschera (per far salire ogni riga). */
const wrapLines = (el, original) => {
  el.textContent = original;
  const words = splitWords(el);
  const lines = [];
  let top = null, cur = null;
  for (const w of words) {
    const t = w.offsetTop;
    if (top === null || Math.abs(t - top) > 2) {
      cur = [];
      lines.push(cur);
      top = t;
    }
    cur.push(w.textContent);
  }
  el.textContent = '';
  return lines.map((ws) => {
    const mask = document.createElement('span');
    mask.className = 'line';
    const inner = document.createElement('span');
    inner.className = 'line-in';
    inner.textContent = ws.join(' ');
    mask.appendChild(inner);
    el.appendChild(mask);
    return inner;
  });
};

/**
 * Racconto a capitoli dentro un contenitore che scorre.
 * `state` è letto dalla scena a ogni fotogramma: `cam` (direzione x,y,z e distanza della
 * camera, interpolate tra i capitoli che hanno data-cam), `gloss` (brillo della seta),
 * `light` (-1..1: la luce che passa sulla seta, oppure null).
 * `home`: la posa della camera in cima alla pagina [x, y, z, distanza].
 */
export const createStory = (chi, reduceMotion, { home = null } = {}) => {
  const chapters = [...chi.querySelectorAll('.ch')].map((el) => ({
    el,
    stage: el.querySelector('.ch-stage'),
    fx: el.dataset.fx,
    cam: el.dataset.cam ? el.dataset.cam.split(',').map(Number) : null,
    p: -1,
    gain: 1,
  }));
  const state = { cam: null, gloss: 1, light: null };
  if (reduceMotion) {
    chi.classList.add('story-static');
    return { measure() {}, update() {}, state };
  }

  // preparazione di ogni effetto
  for (const ch of chapters) {
    const q = (s) => ch.el.querySelector(s);
    if (ch.fx === 'letters') {
      const big = q('.big-word');
      const letters = big.textContent.trim().split('');
      big.textContent = '';
      ch.letters = letters.map((l, i) => {
        const s = document.createElement('span');
        s.textContent = l;
        s.style.setProperty('--r', ((i * 37) % 11) / 10 - 0.5); // posizione di partenza "casuale" ma stabile
        big.appendChild(s);
        return s;
      });
      ch.fade = q('.fx-fade');
    }
    if (ch.fx === 'lines' || ch.fx === 'gloss') {
      ch.lineEls = [...ch.el.querySelectorAll('.fx-lines')].map((el) => ({ el, text: el.textContent.replace(/\s+/g, ' ').trim() }));
    }
    if (ch.fx === 'focus') ch.focus = q('.fx-focus');
    if (ch.fx === 'gloss') {
      ch.fade = q('.fx-fade');
      ch.hint = q('.gloss-hint');
    }
    if (ch.fx === 'ritual') ch.steps = [...ch.el.querySelectorAll('.ritual li')];
  }

  let vh = 0;
  const measure = () => {
    vh = chi.clientHeight;
    for (const ch of chapters) {
      if (ch.lineEls) ch.lines = ch.lineEls.map(({ el, text }) => wrapLines(el, text));
    }
    // gli ultimi capitoli non salgono abbastanza per finire l'effetto (la pagina finisce prima):
    // il loro avanzamento si riscala, così alla fine dello scroll sono sempre completi
    const maxSt = Math.max(0, chi.scrollHeight - vh);
    for (const ch of chapters) {
      ch.top = ch.el.offsetTop;
      ch.h = ch.el.offsetHeight;
      ch.p = -1;
      const pEnd = (maxSt + vh * 0.95 - ch.top) / (ch.h + vh * 0.45);
      ch.gain = pEnd > 0.05 && pEnd < 1 ? 1 / pEnd : 1;
    }
    // le pose della camera: in cima la posa di casa, poi una per capitolo (quando è al centro)
    keys = [];
    if (home) keys.push({ s: 0, cam: home });
    for (const ch of chapters)
      if (ch.cam) keys.push({ s: Math.min(maxSt, Math.max(0, ch.top + ch.h / 2 - vh / 2)), cam: ch.cam });
    keys.sort((a, b) => a.s - b.s);
    update();
  };
  let keys = [];
  const camAt = (st) => {
    if (!keys.length) return null;
    if (st <= keys[0].s) return keys[0].cam;
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1], b = keys[i];
      if (st <= b.s) {
        const k = ease(clamp01((st - a.s) / Math.max(1, b.s - a.s)));
        return a.cam.map((v, j) => v + (b.cam[j] - v) * k);
      }
    }
    return keys[keys.length - 1].cam;
  };

  const update = () => {
    if (chi.offsetParent === null) return; // sezione nascosta
    const st = chi.scrollTop;
    state.cam = camAt(st);
    for (const ch of chapters) {
      // 0 quando il capitolo affiora dal basso, 1 quando la sua fine è a metà schermo
      const p = clamp01(((st + vh * 0.95 - ch.top) / (ch.h + vh * 0.45)) * ch.gain);
      // il capitolo successivo può già entrare: si aggiorna solo se è cambiato
      if (Math.abs(p - ch.p) < 0.002) continue;
      ch.p = p;
      FX[ch.fx]?.(ch, p);
    }
  };

  const FX = {
    // la parola grande: le lettere arrivano da posizioni sfocate e si compongono; poi la frase
    letters(ch, p) {
      const n = ch.letters.length;
      ch.letters.forEach((s, i) => {
        const k = ease(seg(p, 0.05 + i * 0.07, 0.3 + i * 0.07));
        const r = parseFloat(s.style.getPropertyValue('--r'));
        s.style.transform = `translate3d(${((1 - k) * r * 120).toFixed(1)}px,${((1 - k) * (60 + i * 8)).toFixed(1)}px,0) rotate(${((1 - k) * r * 30).toFixed(1)}deg)`;
        s.style.opacity = k.toFixed(3);
        s.style.filter = k < 1 ? `blur(${((1 - k) * 10).toFixed(1)}px)` : 'none';
      });
      const f = ease(seg(p, 0.05 + n * 0.07, 0.35 + n * 0.07));
      ch.fade.style.opacity = f.toFixed(3);
      ch.fade.style.transform = `translate3d(0,${((1 - f) * 18).toFixed(1)}px,0)`;
    },
    // le righe salgono da dietro una maschera, una dopo l'altra
    lines(ch, p) {
      if (!ch.lines) return;
      const all = ch.lines.flat();
      all.forEach((l, i) => {
        const k = ease(seg(p, 0.04 + i * 0.07, 0.24 + i * 0.07));
        l.style.transform = `translate3d(0,${(105 * (1 - k)).toFixed(1)}%,0)`;
      });
    },
    // il rituale: una linea malva si disegna e i quattro passi arrivano uno dopo l'altro
    ritual(ch, p) {
      ch.el.style.setProperty('--draw', ease(seg(p, 0.06, 0.8)).toFixed(3));
      ch.steps.forEach((li, i) => {
        const k = ease(seg(p, 0.06 + i * 0.15, 0.3 + i * 0.15));
        li.style.opacity = (0.08 + 0.92 * k).toFixed(3);
        li.style.transform = `translate3d(${((1 - k) * 26).toFixed(1)}px,0,0)`;
        li.style.setProperty('--k', k.toFixed(3));
      });
    },
    // la luce: la seta si spegne (opaca) e poi ritrova il brillo mentre la luce le passa sopra
    gloss(ch, p) {
      if (ch.lines) {
        ch.lines.flat().forEach((l, i) => {
          const k = ease(seg(p, 0.04 + i * 0.07, 0.24 + i * 0.07));
          l.style.transform = `translate3d(0,${(105 * (1 - k)).toFixed(1)}%,0)`;
        });
      }
      const f = ease(seg(p, 0.35, 0.6));
      ch.fade.style.opacity = f.toFixed(3);
      ch.fade.style.transform = `translate3d(0,${((1 - f) * 18).toFixed(1)}px,0)`;
      const h = ease(seg(p, 0.25, 0.4)) * (1 - ease(seg(p, 0.85, 0.97)));
      ch.hint.style.opacity = h.toFixed(3);
      state.gloss =
        p < 0.3 ? 1 - 0.88 * ease(seg(p, 0.02, 0.28)) : p < 0.86 ? 0.12 + 1.23 * ease(seg(p, 0.32, 0.8)) : 1.35 - 0.35 * ease(seg(p, 0.88, 1));
      state.light = p > 0.22 && p < 0.97 ? -1 + 2 * ease(seg(p, 0.3, 0.86)) : null;
    },
    // dallo sfocato al nitido (presto: il testo si legge nitido già a metà schermo)
    focus(ch, p) {
      const k = ease(seg(p, 0.02, 0.42));
      ch.focus.style.filter = k < 0.995 ? `blur(${((1 - k) * 7).toFixed(1)}px)` : 'none';
      ch.focus.style.opacity = (0.2 + 0.8 * k).toFixed(3);
      ch.focus.style.letterSpacing = `${((1 - k) * 0.12).toFixed(3)}em`;
    },
  };

  return { measure, update, state };
};
