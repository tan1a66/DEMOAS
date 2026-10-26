import gsap from 'gsap';

// Scroll guidato: ogni gesto (rotella, trackpad, dito, tastiera) porta alla sosta successiva o a
// quella precedente, e il passaggio tra due soste è un movimento continuo della telecamera.
// Un gesto vale una sosta: la coda d'inerzia del trackpad non fa saltare la sosta dopo.
// stops: [{ id, p }] in ordine; units: lunghezza del percorso (durate delle chiavi) per i tempi.
// Una sosta può avere un passo proprio per il tratto che arriva a lei (pace: secondi per unità,
// maxDur, ease): il tuffo è più lento e più dolce degli altri passaggi.

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ignoreTouch(x, y): true se un tocco che parte lì non deve muovere lo scroll (il titolo liquido)
export function createGuide({ stops, units, setProgress, reducedMotion = false, onChange, ignoreTouch }) {
  const state = { p: 0 };
  let index = 0, dir = 0, tween = null, enabled = false, queued = 0;
  const last = stops.length - 1;

  function emit() {
    onChange?.(index, !!tween, last);
  }

  let arrivedAt = -Infinity;
  function go(i) {
    i = clamp(i, 0, last);
    if (i === index && !tween) return;
    const to = stops[i].p;
    const dist = Math.abs(to - state.p) * units;
    // più lungo il tratto, più tempo; il tratto prende il passo della sosta più avanti tra le due
    const seg = stops[Math.max(i, index)];
    const duration = clamp(0.7 + dist * (seg.pace || 0.0095), 1.0, seg.maxDur || 4.6) * (reducedMotion ? 0.6 : 1);
    dir = Math.sign(i - index) || dir;
    index = i;
    tween?.kill();
    tween = gsap.to(state, {
      p: to,
      duration,
      ease: seg.ease || 'power2.inOut',
      onUpdate: () => setProgress(state.p),
      onComplete: () => {
        tween = null;
        arrivedAt = performance.now();
        emit();
        // un gesto arrivato verso la fine del tratto: si prosegue subito alla sosta dopo
        if (queued) {
          const q = queued;
          queued = 0;
          go(index + q);
        }
      },
    });
    emit();
  }

  // un gesto nella direzione d: fermi -> sosta successiva; in movimento, l'inversione torna indietro
  // e un gesto nella stessa direzione verso la fine del tratto vale la sosta dopo (scroll di fila)
  function intent(d) {
    if (!enabled || !d) return;
    if (tween && d === dir) {
      if (tween.progress() > 0.55) queued = d;
      return;
    }
    // appena arrivati a una sosta, un attimo di respiro prima della successiva
    if (!tween && performance.now() - arrivedAt < 250) return;
    queued = 0;
    go(index + d);
  }

  // ---- rotella e trackpad ----
  let acc = 0, lastT = 0, lastAbs = 0, used = false;
  function onWheel(e) {
    if (e.ctrlKey || !enabled) return; // zoom del browser (pinch sul trackpad); galleria aperta
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    const dy = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * scale;
    // l'istante del gesto (non quello in cui la pagina lo elabora: con frame lenti arrivano in ritardo)
    const now = e.timeStamp || performance.now();
    const abs = Math.abs(dy);
    // nuovo gesto: una pausa nella sequenza di eventi, oppure una spinta netta sopra la coda d'inerzia
    if (now - lastT > 240 || (abs > lastAbs * 2.2 && abs > 24)) {
      used = false;
      acc = 0;
    }
    lastT = now;
    lastAbs = abs;
    if (used) return;
    acc += dy;
    if (Math.abs(acc) > 28) {
      used = true;
      intent(Math.sign(acc));
    }
  }

  // ---- dito ----
  // conta solo un gesto chiaramente verticale: abbastanza lungo, oppure uno swipe rapido alla fine;
  // movimenti di lato o in diagonale e i tocchi che tremano un po' non spostano niente
  const vertical = (dx, dy) => Math.abs(dy) > Math.abs(dx) * 1.6;
  let t0 = null, tUsed = false, tIgnored = false;
  function onTouchStart(e) {
    if (e.touches.length !== 1) {
      t0 = null;
      return;
    }
    const t = e.touches[0];
    t0 = { x: t.clientX, y: t.clientY, time: e.timeStamp || performance.now() };
    tUsed = false;
    tIgnored = !!ignoreTouch?.(t.clientX, t.clientY);
  }
  function onTouchMove(e) {
    if (!t0 || !enabled) return;
    e.preventDefault(); // niente scroll nativo né "tira per aggiornare"
    if (tUsed || tIgnored || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - t0.x, dy = t0.y - e.touches[0].clientY;
    if (Math.abs(dy) > 44 && vertical(dx, dy)) {
      tUsed = true;
      intent(Math.sign(dy));
    }
  }
  function onTouchEnd(e) {
    if (t0 && enabled && !tUsed && !tIgnored && e.changedTouches?.length) {
      const t = e.changedTouches[0];
      const dx = t.clientX - t0.x, dy = t0.y - t.clientY;
      const quick = (e.timeStamp || performance.now()) - t0.time < 300;
      if (quick && Math.abs(dy) > 24 && vertical(dx, dy)) intent(Math.sign(dy));
    }
    t0 = null;
  }

  // ---- tastiera ----
  function onKey(e) {
    if (!enabled || e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = e.target?.tagName;
    const onControl = tag === 'BUTTON' || tag === 'A' || tag === 'INPUT';
    let d = 0;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !onControl && !e.shiftKey)) d = 1;
    else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && !onControl && e.shiftKey)) d = -1;
    else if (e.key === 'Home') return e.preventDefault(), go(0);
    else if (e.key === 'End') return e.preventDefault(), go(last);
    if (d) {
      e.preventDefault();
      intent(d);
    }
  }

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });
  window.addEventListener('keydown', onKey);

  return {
    next: () => intent(1),
    prev: () => intent(-1),
    go,
    setEnabled(on) {
      enabled = on;
      if (on) emit();
    },
    // salto immediato (test): avanzamento p, sosta più vicina
    jump(p) {
      tween?.kill();
      tween = null;
      state.p = p;
      let best = 0;
      stops.forEach((s, i) => {
        if (Math.abs(s.p - p) < Math.abs(stops[best].p - p)) best = i;
      });
      index = best;
      setProgress(p);
      emit();
    },
    get index() { return index; },
    get moving() { return !!tween; },
  };
}
