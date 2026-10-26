import gsap from 'gsap';

// Scroll guidato: ogni gesto (rotella, trackpad, dito, tastiera) porta alla sosta successiva o a
// quella precedente, e il passaggio tra due soste è un movimento continuo della telecamera.
// Un gesto vale una sosta: la coda d'inerzia del trackpad non fa saltare la sosta dopo.
// stops: [{ id, p }] in ordine; units: lunghezza del percorso (durate delle chiavi) per i tempi.
// Una sosta può avere un passo proprio per il tratto che arriva a lei (pace: secondi per unità,
// maxDur, ease): il tuffo è più lento e più dolce degli altri passaggi.

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function createGuide({ stops, units, setProgress, reducedMotion = false, onChange }) {
  const state = { p: 0 };
  let index = 0, dir = 0, tween = null, enabled = false;
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
    const duration = clamp(0.8 + dist * (seg.pace || 0.011), 1.2, seg.maxDur || 5.2) * (reducedMotion ? 0.6 : 1);
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
      },
    });
    emit();
  }

  // un gesto nella direzione d: fermi -> sosta successiva; in movimento, solo l'inversione conta
  function intent(d) {
    if (!enabled || !d) return;
    if (tween && d === dir) return;
    // appena arrivati a una sosta, un attimo di respiro prima della successiva
    if (!tween && performance.now() - arrivedAt < 450) return;
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
  let ty = null, tUsed = false;
  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    ty = e.touches[0].clientY;
    tUsed = false;
  }
  function onTouchMove(e) {
    if (ty === null || !enabled) return;
    e.preventDefault(); // niente scroll nativo né "tira per aggiornare"
    const dy = ty - e.touches[0].clientY;
    if (!tUsed && Math.abs(dy) > 34) {
      tUsed = true;
      intent(Math.sign(dy));
    }
  }
  function onTouchEnd() {
    ty = null;
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
