// Intro: schermo crema con le curve di livello reali di Sa Calobra in filigrana, il logo al
// centro e una linea arancione che si riempie col caricamento. Al tocco su ENTRAR lo zoom entra
// nella "M" a zig-zag del logo, che diventa una strada (asfalto, mezzeria, linea arancione) e
// si posa sulla carretera vera della scena 3D al Coll dels Reis.
import gsap from 'gsap';
import contoursSvg from '../assets/contours.svg?raw';
import { resample, projectRoad, lerpPts } from './lineOverlay.js';
import { CONFIG } from '../config.js';

// la M del logo (coordinate sull'immagine del logo, 388 × 95 px): cinque tratti a zig-zag
const LOGO_W = 388;
const M_PTS = [[102, 62], [141, 19], [143, 61], [174, 19], [176, 61], [203, 45]];
const M_STROKE = 10.5;
const M_CENTER = [152, 40];
const N = 72; // punti della linea che si trasforma

export function createIntro() {
  const el = document.getElementById('intro');
  const bar = document.getElementById('intro-bar');
  const enter = document.getElementById('enter');
  const logoBox = document.getElementById('intro-logo');
  document.getElementById('intro-contours').innerHTML = contoursSvg;
  gsap.fromTo('#intro-contours', { opacity: 0, scale: 1.04 }, { opacity: 0.075, scale: 1, duration: 2.4, ease: 'power2.out' });
  gsap.fromTo('.intro__center > :not(.intro__enter)', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.12, ease: 'power3.out', delay: 0.15 });

  const t0 = performance.now();
  let shown = 0;
  return {
    el,
    setProgress(p) {
      shown = Math.max(shown, Math.min(p, 1));
      bar.style.transform = `scaleX(${shown.toFixed(3)})`;
    },
    /** caricamento finito: dopo almeno 1 s compare ENTRAR; risolve al tocco */
    ready() {
      this.setProgress(1);
      return new Promise((resolve) => {
        const wait = Math.max(0, 1000 - (performance.now() - t0));
        setTimeout(() => {
          enter.disabled = false;
          enter.focus({ preventScroll: true });
          enter.addEventListener('click', () => resolve(), { once: true });
        }, wait + 300);
      });
    },
    /**
     * zoom nella M → strada → linea sulla carretera 3D.
     * onReveal: chiamata quando la scena è scoperta (la linea 3D deve comparire lì).
     */
    play({ camera, road, overlay, lineS, onReveal }) {
      el.classList.add('is-leaving');
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        return new Promise((resolve) => gsap.to(el, { opacity: 0, duration: 0.6, onComplete: () => { el.remove(); onReveal(); resolve(); } }));
      }
      const r = logoBox.getBoundingClientRect();
      const k = r.width / LOGO_W;
      const toScreen = ([x, y]) => [r.left + x * k, r.top + y * k];
      const mScreen = resample(M_PTS.map(toScreen), N);
      const c = toScreen(M_CENTER);
      const W = innerWidth, H = innerHeight;
      const roadPts = resample(projectRoad(camera, road, 0, lineS, N, W, H), N);
      const s = { zoom: 1, morph: 0, asphalt: 0, line: 0 };
      const ZMAX = 12;
      const render = () => {
        const z = s.zoom;
        const zoomed = mScreen.map(([x, y]) => [c[0] + (x - c[0]) * z, c[1] + (y - c[1]) * z]);
        const pts = lerpPts(zoomed, roadPts, s.morph);
        const w = M_STROKE * k * z * 1.06 * (1 - s.morph) + 0.0;
        overlay.draw(pts, {
          roadWidth: w, roadOpacity: s.asphalt * (1 - s.morph),
          dashWidth: Math.max(1, w * 0.045), dashOpacity: s.asphalt * Math.min(1, (z - 1) / 3) * (1 - s.morph),
          dash: `${(w * 0.35).toFixed(1)} ${(w * 0.55).toFixed(1)}`,
          lineWidth: Math.max(CONFIG.line.width, w * 0.09 * (1 - s.morph) + CONFIG.line.width * s.morph),
          lineOpacity: s.line,
        });
      };
      overlay.show();
      render();
      const origin = `${(M_CENTER[0] / LOGO_W) * 100}% ${(M_CENTER[1] / 95) * 100}%`;
      return new Promise((resolve) => {
        const tl = gsap.timeline({ onUpdate: render, onComplete: () => { overlay.hide(); el.remove(); resolve(); } });
        tl.to('.intro__bar, .intro__enter, .intro__meta', { opacity: 0, y: 8, duration: 0.35, ease: 'power2.in' }, 0)
          // la M diventa asfalto con la linea arancione
          .to(s, { asphalt: 1, line: 1, duration: 0.45, ease: 'power2.out' }, 0.1)
          // zoom dentro la M; le altre lettere e la filigrana svaniscono
          .to(s, { zoom: ZMAX, duration: 1.6, ease: 'power3.in' }, 0.35)
          .to(logoBox, { scale: ZMAX, transformOrigin: origin, duration: 1.6, ease: 'power3.in' }, 0.35)
          .to(logoBox, { opacity: 0, duration: 0.5, ease: 'power1.in' }, 0.75)
          .to('#intro-contours', { scale: 1.6, opacity: 0, duration: 1.5, ease: 'power3.in' }, 0.35)
          // si apre la scena: la strada-M si posa sulla carretera vera
          .to(el, { backgroundColor: 'rgba(237,232,223,0)', duration: 0.9, ease: 'power2.inOut' }, 1.5)
          .to(s, { morph: 1, duration: 1.15, ease: 'power3.inOut' }, 1.6)
          .add(() => onReveal(), 2.55)
          .to(s, { line: 0, duration: 0.35 }, 2.65);
        // sviluppo: ?introAt=1.4 ferma la transizione a quell'istante (per gli screenshot)
        const at = new URLSearchParams(location.search).get('introAt');
        if (at !== null) { tl.pause(Number(at)); render(); document.body.classList.add('intro-paused'); }
      });
    },
  };
}
