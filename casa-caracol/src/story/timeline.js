import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG } from '../config.js';

gsap.registerPlugin(ScrollTrigger);
// iOS: la barra de Safari que aparece/desaparece no debe recalcular el scroll.
ScrollTrigger.config({ ignoreMobileResize: true });

// Estado de la historia: lo mueve el scroll (scrub) y lo lee el bucle de render.
export const createState = () => ({
  intro: 0, // 0 → 1: el texto de la intro se va
  descent: 0, // 0 → 1: bajada y giro de la cámara
  cut: 0, // 0 → 1: fundido 3D → foto
  push: 0, // 0 → 1: zoom/alabeo continuo durante el corte
  lineA: 0,
  lineB: 0,
  veil: 0, // velo de cal (transiciones en modo de movimiento reducido)
});

// La línea de tiempo se mide en "vh": 1 unidad de tiempo = 1 % de pantalla de scroll.
export const buildStory = ({ state, storyEl, reduced }) => {
  const S = CONFIG.story;
  const total = S.introHold + S.descent + S.cut + S.cutHold;
  storyEl.style.height = `calc(100svh + ${total}svh)`;

  const tDescent0 = S.introHold * 0.45;
  const tDescent1 = S.introHold + S.descent;
  const tCut0 = tDescent1 - 8;
  const tCut1 = tCut0 + S.cut * 0.62;

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  tl.to(state, { intro: 1, duration: S.introHold }, 0);
  tl.to(state, { descent: 1, duration: tDescent1 - tDescent0 }, tDescent0);
  tl.to(state, { lineA: 1, duration: 32, ease: 'power1.out' }, tDescent0 + S.descent * 0.4);
  tl.to(state, { cut: 1, duration: tCut1 - tCut0, ease: 'sine.inOut' }, tCut0);
  tl.to(state, { push: 1, duration: total - tCut0 + 10 }, tCut0 - 10);
  tl.to(state, { lineB: 1, duration: 30, ease: 'power1.out' }, tCut1 - 18);

  if (reduced) {
    // sin cámara en movimiento: la escena cambia oculta tras un velo de cal
    const mid = tDescent0 + (tDescent1 - tDescent0) * 0.5;
    tl.to(state, { veil: 1, duration: 12 }, mid - 12);
    tl.to(state, { veil: 0, duration: 12 }, mid);
  }
  tl.set({}, {}, total);

  const trigger = ScrollTrigger.create({
    trigger: storyEl,
    start: 'top top',
    end: 'bottom bottom',
    scrub: reduced ? true : 0.9,
    animation: tl,
  });

  return { tl, trigger, total, marks: { tDescent0, tDescent1, tCut0, tCut1 } };
};

export { gsap, ScrollTrigger };
