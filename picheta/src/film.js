// Película de entrada (común al modo foto y al 3D): reloj de la película, momentos de los textos,
// tecla R / botón "▶ Intro" para repetirla, ?intro=0 para saltarla, ?introAt=3.4 para congelarla.

import { REDUCED_MOTION } from './config.js';

/**
 * @param {object} o
 * @param {number} o.end      duración (s)
 * @param {object} o.stages   { fire, sky, done } en segundos (ver ui.stage)
 * @param {() => number} o.now reloj en segundos (el mismo que recibe `time(t)`)
 */
export function createIntro({ ui, clock, end, stages, now }) {
  const q = new URLSearchParams(location.search);
  const freezeAt = parseFloat(q.get('introAt')); // depuración: congela la toma
  const intro = {
    end,
    skip: REDUCED_MOTION || q.get('intro') === '0',
    start: null, // segundos del reloj en que empieza (al quitarse el loader)
    done: {},
    running: false,
    time(t) {
      if (this.skip) return end;
      if (Number.isFinite(freezeAt)) return freezeAt;
      if (this.start === null) return 0;
      return t - this.start;
    },
    play() {
      ui.stage('reset');
      this.done = {};
      this.skip = false;
      this.running = true;
      this.start = now();
      if (clock.mode === 'timelapse') clock.tl.start = null; // el cielo espera a la película
    },
    finish() {
      this.start = now() - end;
    },
    stages(t) {
      if (this.skip || this.start === null) return;
      const it = this.time(t);
      for (const [name, at] of Object.entries(stages)) {
        if (!this.done[name] && it >= at) {
          this.done[name] = true;
          ui.stage(name);
          if (name === 'done') clock.startTimelapse();
        }
      }
      if (it >= end) this.running = false;
    },
  };

  addEventListener('keydown', (e) => {
    if ((e.key === 'r' || e.key === 'R') && !REDUCED_MOTION && !e.target.closest?.('input, textarea')) {
      scrollTo({ top: 0, behavior: 'instant' });
      intro.play();
    }
  });
  document.getElementById('slider-intro')?.addEventListener('click', () => {
    if (!REDUCED_MOTION) intro.play();
  });
  return intro;
}
