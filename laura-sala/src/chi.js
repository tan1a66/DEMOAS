// Chi sono come una storia a capitoli. Ogni capitolo è alto più dello schermo e ha una
// "scena" che resta ferma (sticky) mentre lo si scorre: il suo effetto avanza con lo
// scroll, in entrambe le direzioni. Il testo è sempre lo stesso per carattere e grandezza;
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

export const createChiStory = (chi, chiHead, reduceMotion) => {
  const chapters = [...chi.querySelectorAll('.ch')].map((el) => ({
    el,
    stage: el.querySelector('.ch-stage'),
    fx: el.dataset.fx,
    p: -1,
  }));
  if (reduceMotion) {
    chi.classList.add('story-static');
    return { measure() {}, update() {} };
  }

  // preparazione di ogni effetto
  for (const ch of chapters) {
    const q = (s) => ch.el.querySelector(s);
    if (ch.fx === 'years' || ch.fx === 'converge') ch.words = splitWords(q('.fx-words'));
    if (ch.fx === 'years') {
      ch.y1 = q('.y1');
      ch.y2 = q('.y2');
    }
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
    if (ch.fx === 'lines') {
      ch.lineEls = [...ch.el.querySelectorAll('.fx-lines')].map((el) => ({ el, text: el.textContent.replace(/\s+/g, ' ').trim() }));
    }
    if (ch.fx === 'marks') ch.marks = [...ch.el.querySelectorAll('mark')];
    if (ch.fx === 'marquee') {
      ch.track = q('.marquee span');
      ch.fade = q('.fx-fade');
    }
    if (ch.fx === 'converge') ch.cv = [q('.cv-a'), q('.cv-b')];
    if (ch.fx === 'focus') ch.focus = q('.fx-focus');
  }

  let headH = 0, vh = 0;
  const measure = () => {
    headH = chiHead.offsetHeight;
    vh = chi.clientHeight;
    const stageH = vh - headH;
    for (const ch of chapters) {
      const len = parseFloat(getComputedStyle(ch.el).getPropertyValue('--len')) || 2;
      ch.stage.style.top = `${headH}px`;
      ch.stage.style.height = `${stageH}px`;
      ch.el.style.height = `${stageH * len}px`;
      ch.top = ch.el.offsetTop;
      ch.range = ch.el.offsetHeight - stageH;
      ch.p = -1;
      if (ch.fx === 'lines') ch.lines = ch.lineEls.map(({ el, text }) => wrapLines(el, text));
    }
    update();
  };

  const update = () => {
    if (chi.hidden) return;
    const st = chi.scrollTop;
    for (const ch of chapters) {
      const p = clamp01((st - (ch.top - headH)) / ch.range);
      // il capitolo successivo può già entrare: si aggiorna solo se è cambiato
      if (Math.abs(p - ch.p) < 0.002) continue;
      ch.p = p;
      FX[ch.fx]?.(ch, p);
    }
  };

  const FX = {
    // 2011 → 2017: il numero ruota come un contatore, il testo si accende parola per parola
    years(ch, p) {
      const k = ease(seg(p, 0.42, 0.62));
      ch.y1.style.transform = `translate3d(0,${(-105 * k).toFixed(1)}%,0)`;
      ch.y1.style.opacity = (1 - k).toFixed(3);
      ch.y2.style.transform = `translate3d(0,${(105 * (1 - k)).toFixed(1)}%,0)`;
      ch.y2.style.opacity = k.toFixed(3);
      paintWords(ch.words, seg(p, 0.05, 0.85));
    },
    // SICPRE: le lettere arrivano da posizioni sfocate e si compongono; poi la frase
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
    // un filetto d'oro si disegna sotto ogni competenza, una dopo l'altra
    marks(ch, p) {
      ch.marks.forEach((m, i) => {
        const k = ease(seg(p, 0.12 + i * 0.17, 0.32 + i * 0.17));
        m.style.setProperty('--draw', `${(k * 100).toFixed(1)}%`);
      });
    },
    // Milano · Lecco: la scritta scorre di lato con lo scroll; poi la frase
    marquee(ch, p) {
      ch.track.style.transform = `translate3d(${(-p * 48).toFixed(2)}%,0,0)`;
      const f = ease(seg(p, 0.3, 0.55));
      ch.fade.style.opacity = f.toFixed(3);
      ch.fade.style.transform = `translate3d(0,${((1 - f) * 18).toFixed(1)}px,0)`;
    },
    // "Dal consulto" da sinistra e "al trattamento" da destra si vengono incontro
    converge(ch, p) {
      const k = ease(seg(p, 0.04, 0.5));
      ch.cv[0].style.transform = `translate3d(${(-(1 - k) * 55).toFixed(2)}%,0,0)`;
      ch.cv[1].style.transform = `translate3d(${((1 - k) * 55).toFixed(2)}%,0,0)`;
      ch.cv[0].style.opacity = ch.cv[1].style.opacity = (0.15 + 0.85 * k).toFixed(3);
      paintWords(ch.words, seg(p, 0.38, 0.95));
    },
    // dallo sfocato al nitido
    focus(ch, p) {
      const k = ease(seg(p, 0.05, 0.6));
      ch.focus.style.filter = k < 1 ? `blur(${((1 - k) * 12).toFixed(1)}px)` : 'none';
      ch.focus.style.opacity = (0.2 + 0.8 * k).toFixed(3);
      ch.focus.style.letterSpacing = `${((1 - k) * 0.12).toFixed(3)}em`;
    },
  };

  const paintWords = (words, k) => {
    const n = words.length;
    for (let i = 0; i < n; i++) {
      const a = clamp01((k * (n + 8) - i) / 8);
      const o = (0.16 + 0.84 * a).toFixed(2);
      if (words[i]._o !== o) {
        words[i]._o = o;
        words[i].style.opacity = o;
      }
    }
  };

  return { measure, update };
};
