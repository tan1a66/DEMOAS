// Audio ambiente generato (nessun file): vento filtrato e, in discesa, il ticchettio della
// ruota libera, più fitto quanto più si va veloci. Parte solo dopo un gesto dell'utente.
export function createAudio() {
  let ctx = null, master = null, wind = null, on = false;
  let tickTimer = null, nextTick = 0, rate = 0;

  function noiseBuffer(sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // vento: rumore → passa-banda che "respira" lentamente
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(4);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.6;
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07; lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(bp.frequency);
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(bp).connect(g).connect(master);
    src.start(); lfo.start();
    wind = { g };

    // ruota libera: click brevissimi programmati in anticipo
    const click = noiseBuffer(0.006);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 3200;
    const cg = ctx.createGain();
    cg.gain.value = 0.05;
    hp.connect(cg).connect(master);
    tickTimer = setInterval(() => {
      if (!rate) { nextTick = ctx.currentTime; return; }
      while (nextTick < ctx.currentTime + 0.1) {
        const s = ctx.createBufferSource();
        s.buffer = click;
        s.playbackRate.value = 0.8 + Math.random() * 0.4;
        s.connect(hp);
        s.start(Math.max(nextTick, ctx.currentTime));
        nextTick += 1 / rate;
      }
    }, 25);
  }

  return {
    get on() { return on; },
    /** da chiamare dentro un gesto (tap / click) */
    toggle(force) {
      on = force ?? !on;
      if (on && !ctx) init();
      if (ctx?.state === 'suspended') ctx.resume();
      if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.4);
      return on;
    },
    /** dentro il tocco su ENTRAR: prepara l'audio (resta muto finché non si tocca l'icona) */
    unlock() {
      if (!ctx) init();
      if (ctx.state === 'suspended') ctx.resume();
    },
    /** speed: metri di strada al secondo (positivo in discesa) */
    update(speed, descending) {
      if (!ctx || !on) return;
      rate = descending && speed > 40 ? Math.min(6 + speed / 60, 22) : 0;
      wind.g.gain.setTargetAtTime(0.035 + Math.min(Math.abs(speed) / 4000, 0.05), ctx.currentTime, 0.5);
    },
  };
}
