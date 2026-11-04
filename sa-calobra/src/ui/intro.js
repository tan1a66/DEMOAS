// Intro: schermo crema con le curve di livello reali di Sa Calobra in filigrana, il logo al
// centro e una linea arancione che si riempie col caricamento. Al tocco su ENTRAR lo zoom entra
// nella "M" a zig-zag del logo, che diventa una strada (asfalto, mezzeria, linea arancione):
// la M si smolla come una corda lasciata andare (gli spigoli si arrotondano, un'onda la
// percorre) e scivola, dal Coll in giù, sulla carretera vera della scena 3D.
import gsap from 'gsap';
import contoursSvg from '../assets/contours.svg?raw';
import { resample, projectRoad, lerpPts } from './lineOverlay.js';
import { CONFIG } from '../config.js';

// la M del logo (coordinate sull'immagine del logo, 388 × 95 px): cinque tratti a zig-zag
const LOGO_W = 388;
const M_PTS = [[102, 62], [141, 19], [143, 61], [174, 19], [176, 61], [203, 45]];
const M_STROKE = 10.5;
const M_CENTER = [152, 40];
const N = 150; // punti della linea che si trasforma
const SOFT = 13; // quanto si arrotonda la M smollata (larghezza della media, in punti)
const FLOW = 0.7; // la M si posa sulla strada a partire dal Coll: ritardo dell'altro capo

// media gaussiana dei punti (gli estremi restano fermi): gli spigoli diventano curve
function soften(pts, sigma) {
  if (sigma < 0.3) return pts;
  const n = pts.length, r = Math.min(Math.ceil(sigma * 2.5), n - 1);
  const w = [];
  for (let k = -r; k <= r; k++) w.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const sum = w.reduce((a, b) => a + b, 0);
  const at = (j, c) => (j < 0 ? 2 * pts[0][c] - pts[-j][c] : j >= n ? 2 * pts[n - 1][c] - pts[2 * n - 2 - j][c] : pts[j][c]);
  return pts.map((_, i) => {
    let x = 0, y = 0;
    for (let k = -r; k <= r; k++) { x += w[k + r] * at(i + k, 0); y += w[k + r] * at(i + k, 1); }
    return [x / sum, y / sum];
  });
}
// un'onda che percorre la linea, perpendicolare a essa (nulla agli estremi)
function wave(pts, amp, phase, cycles = 2.2) {
  if (amp < 0.05) return pts;
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const u = i / (n - 1);
    const o = amp * Math.sin(Math.PI * u) * Math.sin(2 * Math.PI * cycles * u - phase);
    return [p[0] - (dy / l) * o, p[1] + (dx / l) * o];
  });
}
const smooth01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function createIntro() {
  const el = document.getElementById('intro');
  const bar = document.getElementById('intro-bar');
  const enter = document.getElementById('enter');
  const logoBox = document.getElementById('intro-logo');
  document.getElementById('intro-contours').innerHTML = contoursSvg;
  el.querySelector('.intro__meta').textContent = CONFIG.copy.introMeta;
  const entrance = [
    gsap.fromTo('#intro-contours', { opacity: 0, scale: 1.04 }, { opacity: 0.075, scale: 1, duration: 2.4, ease: 'power2.out' }),
    gsap.fromTo('.intro__center > :not(.intro__enter)', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.12, ease: 'power3.out', delay: 0.15 }),
  ];

  const t0 = performance.now();
  let shown = 0;
  const api = {
    el,
    covering: true, // lo schermo crema copre tutto: il 3D dietro non serve disegnarlo
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
    play({ camera, road, overlay, lineS, onReveal, onShift, target = null }) {
      el.classList.add('is-leaving');
      for (const t of entrance) t.progress(1).kill(); // un tocco veloce non deve trovare l'entrata ancora in corso
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        api.covering = false;
        return new Promise((resolve) => gsap.to(el, { opacity: 0, duration: 0.6, onComplete: () => { el.remove(); onReveal(); resolve(); } }));
      }
      const r = logoBox.getBoundingClientRect();
      const k = r.width / LOGO_W;
      const toScreen = ([x, y]) => [r.left + x * k, r.top + y * k];
      const mScreen = resample(M_PTS.map(toScreen), N);
      const c = toScreen(M_CENTER);
      const W = innerWidth, H = innerHeight;
      // dove si posa la M: i primi metri della strada, oppure punti già pronti (il globo)
      const roadPts = resample(target || projectRoad(camera, road, 0, lineS, N, W, H), N);
      const s = { zoom: 1, morph: 0, asphalt: 0, line: 0, slack: 0, wave: 0, phase: 0 };
      const ZMAX = 12;
      const render = () => {
        const z = s.zoom;
        const zoomed = mScreen.map(([x, y]) => [c[0] + (x - c[0]) * z, c[1] + (y - c[1]) * z]);
        // la M si smolla: spigoli arrotondati e un'onda lenta, come una corda che si allenta
        const loose = wave(soften(zoomed, s.slack * SOFT), s.wave * 4.5 * k * z, s.phase);
        // e si posa sulla strada a partire dal Coll: ogni punto parte un po' dopo il precedente
        const pts = loose.map((p, i) => {
          const m = smooth01(s.morph * (1 + FLOW) - FLOW * (i / (N - 1)));
          return [p[0] + (roadPts[i][0] - p[0]) * m, p[1] + (roadPts[i][1] - p[1]) * m];
        });
        const w = M_STROKE * k * z * 1.06 * (1 - s.morph);
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
          .to(s, { asphalt: 1, line: 1, duration: 0.5, ease: 'sine.out' }, 0.1)
          // la M si smolla (con il suono di un cambio di marcia): si arrotonda, un'onda la percorre
          .add(() => onShift?.(), 0.4)
          .to(s, { slack: 1, duration: 1.4, ease: 'sine.inOut' }, 0.4)
          .to(s, { phase: Math.PI * 5, duration: 2.8, ease: 'none' }, 0.4)
          .to(s, { keyframes: { wave: [0, 1, 0.55, 0], easeEach: 'sine.inOut' }, duration: 2.4, ease: 'none' }, 0.4)
          // zoom dentro la M: parte piano e rallenta posandosi, mentre la M scivola già sulla
          // strada (un solo movimento continuo, niente arresti bruschi)
          .to(s, { zoom: ZMAX, duration: 1.9, ease: 'power2.inOut' }, 0.45)
          .to(logoBox, { scale: ZMAX, transformOrigin: origin, duration: 1.9, ease: 'power2.inOut' }, 0.45)
          .to(logoBox, { opacity: 0, duration: 0.5, ease: 'sine.in' }, 0.4)
          .to('#intro-contours', { scale: 1.5, opacity: 0, duration: 1.6, ease: 'sine.inOut' }, 0.45)
          // si apre la scena: la strada-M si posa sulla carretera vera
          .add(() => { api.covering = false; }, 1.3) // da qui il 3D si vede: si torna a disegnarlo
          .to(el, { backgroundColor: 'rgba(237,232,223,0)', duration: 1.1, ease: 'sine.inOut' }, 1.45)
          .to(s, { morph: 1, duration: 1.6, ease: 'power2.inOut' }, 1.5)
          .add(() => onReveal(), 2.95)
          .to(s, { line: 0, duration: 0.45, ease: 'sine.out' }, 3.0);
        // sviluppo: ?introAt=1.4 ferma la transizione a quell'istante (per gli screenshot)
        const at = new URLSearchParams(location.search).get('introAt');
        if (at !== null) { tl.pause(Number(at)); render(); api.covering = Number(at) < 1.3; document.body.classList.add('intro-paused'); }
      });
    },
  };
  return api;
}
