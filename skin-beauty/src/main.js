import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/manrope/index.css';
import './styles.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { PHASES, PIN_LENGTH, WIPE_X, INTRO_X } from './phases.js';
import { createLiquid } from './ui/liquid.js';
import { initTreatments } from './ui/treatments.js';
import { initCompare } from './ui/compare.js';
import { renderReviews } from './ui/reviews.js';
import { initCursor } from './ui/cursor.js';
import { DEFAULT_CATEGORY, WOOD_CATEGORIES } from './data/content.js';

gsap.registerPlugin(ScrollTrigger);

const html = document.documentElement;
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('static');
const mobile = matchMedia('(max-width: 760px)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
if (reduced) html.classList.add('rm');
// Solo desarrollo: ?slow=8 ralentiza las animaciones para revisarlas
if (import.meta.env.DEV && params.has('slow')) gsap.globalTimeline.timeScale(1 / (+params.get('slow') || 4));
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ——— Scroll suave ———
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, touchMultiplier: 1.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const lockScroll = (on) => {
  if (lenis) on ? lenis.stop() : lenis.start();
  else document.body.style.overflow = on ? 'hidden' : '';
};

// ——— Capa 3D (carga diferida: three.js va en su propio chunk) ———
const canvas = $('#gl');
let stage = null;
const pointer = { x: -9999, y: -9999, active: false };
const stagePromise = import('./three/stage.js')
  .then((m) => m.createStage({ canvas, mobile, reduced }))
  .then((s) => {
    stage = s;
    stage.params.treatVis = WOOD_CATEGORIES.includes(DEFAULT_CATEGORY) ? 1 : 0;
    if (reduced) stage.params.settle = 1;
    applyLayout();
    return s;
  })
  .catch((err) => {
    console.warn('[Skin Beauty] 3D no disponible:', err);
    canvas.remove();
    return null;
  });

// ——— Preparación del DOM ———
const word = $('#dreno-word');
const WORD = 'DRENOREDUX';
const mix = (a, b, t) => {
  const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',')})`;
};
word.innerHTML = WORD.split('')
  .map((c, i) => `<span class="ch" aria-hidden="true" style="color:${mix('a8706f', '8a5a3b', i / (WORD.length - 1))}">${c}</span>`)
  .join('');
const fitWord = () => {
  word.style.fontSize = '100px';
  const w = word.scrollWidth;
  const target = window.innerWidth * (mobile ? 0.92 : 0.86);
  word.style.fontSize = `${Math.min((100 * target) / w, window.innerHeight * 0.3)}px`;
};

const splitWords = (el, cls, wrap) => {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
          else {
            const s = document.createElement('span');
            s.className = cls;
            if (wrap) s.innerHTML = `<span>${part}</span>`;
            else s.textContent = part;
            frag.appendChild(s);
          }
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) {
        if (wrap && n.tagName === 'EM') {
          const s = document.createElement('span');
          s.className = cls;
          n.replaceWith(s);
          s.appendChild(document.createElement('span')).appendChild(n);
        } else walk(n);
      }
    });
  };
  walk(el);
};
splitWords($('.manifesto__text'), 'w', true);
splitWords($('[data-bio]'), 'bw', false);

const treatments = initTreatments({
  reduced,
  finePointer,
  lockScroll,
  onCategory: (cat, wood) => {
    if (stage) gsap.to(stage.params, { treatVis: wood ? 1 : 0, duration: 1.4, ease: 'power3.inOut' });
  },
  onLayoutChange: () => ScrollTrigger.refresh(),
});
const compareHint = initCompare({ reduced });
const reviewsTrack = renderReviews();
const liquid = createLiquid($('.dreno__liquid'), { mobile });

// ——— Cursor + giroscopio ———
let cursorTick = null;
if (finePointer && !reduced) {
  cursorTick = initCursor((x, y, active) => {
    pointer.x = x;
    pointer.y = y;
    pointer.active = active;
  });
}
if (mobile && !reduced && 'DeviceOrientationEvent' in window) {
  const onOrient = (e) => {
    if (!stage || e.gamma == null) return;
    stage.mouse.gyro = true;
    stage.mouse.gx = Math.max(-1, Math.min(1, e.gamma / 30));
    stage.mouse.gy = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
  };
  const ask = () => {
    const D = window.DeviceOrientationEvent;
    if (typeof D.requestPermission === 'function') {
      D.requestPermission()
        .then((r) => r === 'granted' && window.addEventListener('deviceorientation', onOrient))
        .catch(() => {});
    } else window.addEventListener('deviceorientation', onOrient);
  };
  window.addEventListener('touchend', ask, { once: true });
}

// ——— Botones magnéticos ———
if (finePointer && !reduced) {
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.32);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}

// ——— Sección fijada: hero → barrido del rodillo → Drenoredux ———
const stageEl = $('.stage');
const dreno = $('.dreno');
const shade = $('.wipe-shade');
const U = 10;
const at = (f) => f * U;
const pinLen = () => window.innerHeight * (mobile ? PIN_LENGTH.mobile : PIN_LENGTH.desktop);

const curve = () => stage?.wipeCurve() || { sag: window.innerHeight * 0.055, half: window.innerHeight * 0.62 };
const edgeAt = (cx, y, c) => {
  const yc = y - window.innerHeight / 2;
  return cx - c.sag / 2 + c.sag * (1 - (yc / c.half) ** 2);
};
// Polígono con el borde curvo del rodillo; keepLeft = conservar la parte izquierda
const curtain = (xNorm, keepLeft) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const c = curve();
  const cx = ((xNorm + 1) / 2) * vw;
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const y = (i / 14) * vh;
    pts.push(`${edgeAt(cx, y, c).toFixed(1)}px ${y.toFixed(1)}px`);
  }
  const side = keepLeft ? 0 : vw;
  return { poly: `polygon(${side}px 0px, ${pts.join(',')}, ${side}px ${vh}px)`, cx };
};

const wipe = { p: 0 };
const applyWipe = () => {
  const p = wipe.p;
  if (p <= 0.0001) {
    dreno.style.clipPath = 'inset(0 100% 0 0)';
    shade.style.opacity = '0';
    return;
  }
  if (p >= 0.9999) {
    dreno.style.clipPath = 'none';
    shade.style.opacity = '0';
    return;
  }
  const x = lerp(WIPE_X.from, WIPE_X.to, p);
  const { poly, cx } = curtain(x, true);
  dreno.style.clipPath = poly;
  // Sombra suave que proyecta el rodillo sobre el hero (lado aún sin barrer)
  shade.style.opacity = String(Math.min(1, p * 8, (1 - p) * 8));
  shade.style.clipPath = curtain(x, false).poly;
  shade.style.backgroundImage = `linear-gradient(90deg, transparent ${cx - 140}px, rgba(59,42,42,0.13) ${cx - 30}px, rgba(59,42,42,0) ${cx + window.innerWidth * 0.14}px)`;
};

let stageTL = null;
fitWord();
if (!reduced) {
  stageTL = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      id: 'stage',
      trigger: stageEl,
      start: 'top top',
      end: () => `+=${pinLen()}`,
      pin: true,
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
  stageTL.set({}, {}, U);

  const wipeDur = at(PHASES.wipe1 - PHASES.wipe0);
  stageTL.fromTo(wipe, { p: 0 }, { p: 1, duration: wipeDur, onUpdate: applyWipe }, at(PHASES.wipe0));
  stageTL.fromTo('.hero__inner', { x: 0 }, { x: () => -window.innerWidth * 0.06, duration: wipeDur }, at(PHASES.wipe0));
  stageTL.fromTo('.dreno__split', { x: () => -window.innerWidth * 0.05 }, { x: 0, duration: wipeDur, ease: 'power1.out' }, at(PHASES.wipe0));

  const mergeDur = at(PHASES.merge1 - PHASES.merge0);
  const m0 = at(PHASES.merge0);
  stageTL.to('.dreno__side--l', { x: mobile ? 0 : () => window.innerWidth * 0.14, y: mobile ? () => window.innerHeight * 0.1 : 0, opacity: 0, duration: mergeDur, ease: 'power2.in' }, m0);
  stageTL.to('.dreno__side--r', { x: mobile ? 0 : () => -window.innerWidth * 0.14, y: mobile ? () => -window.innerHeight * 0.1 : 0, opacity: 0, duration: mergeDur, ease: 'power2.in' }, m0);
  stageTL.to('.dreno__plus', { rotation: 135, scale: 0, duration: mergeDur, ease: 'power2.inOut' }, m0);
  stageTL.fromTo('.dreno__fusion', { clipPath: 'circle(0% at 50% 48%)' }, { clipPath: 'circle(80% at 50% 48%)', duration: mergeDur, ease: 'power2.inOut' }, m0 + mergeDur * 0.25);
  stageTL.to(liquid.state, { merge: 1, duration: mergeDur, ease: 'power2.inOut' }, m0);

  const wordDur = at(PHASES.word - PHASES.merge1);
  const w0 = at(PHASES.merge1);
  stageTL.to(liquid.state, { alpha: 0.16, duration: wordDur }, w0);
  $$('.dreno__word .ch').forEach((ch, i) => {
    const left = i < 5;
    const k = left ? 4 - i : i - 5;
    stageTL.fromTo(
      ch,
      { xPercent: left ? -140 - k * 55 : 140 + k * 55, opacity: 0, rotationY: left ? -75 : 75, scale: 1.2, transformPerspective: 700 },
      { xPercent: 0, opacity: 1, rotationY: 0, scale: 1, duration: wordDur * 0.72, ease: 'power3.out' },
      w0 + k * wordDur * 0.06
    );
  });
  stageTL.fromTo('.dreno__kicker', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: wordDur * 0.5, ease: 'power2.out' }, w0 + wordDur * 0.45);

  const tagDur = at(PHASES.tag - PHASES.word);
  const t0 = at(PHASES.word);
  stageTL.fromTo('.dreno__claim .m > span', { yPercent: 115 }, { yPercent: 0, duration: tagDur * 0.5, stagger: tagDur * 0.14, ease: 'power3.out' }, t0);
  stageTL.fromTo('.dreno__claim i', { opacity: 0 }, { opacity: 1, duration: tagDur * 0.3, stagger: tagDur * 0.14 }, t0 + tagDur * 0.12);
  stageTL.fromTo('.dreno__meta', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: tagDur * 0.4, ease: 'power2.out' }, t0 + tagDur * 0.35);
  stageTL.fromTo('.dreno__cta', { opacity: 0, y: 22, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: tagDur * 0.4, ease: 'power3.out' }, t0 + tagDur * 0.55);
} else {
  dreno.style.clipPath = 'none';
}

// ——— Revelados de secciones ———
const reveal = (targets, trigger, vars = {}) => {
  if (reduced) return;
  gsap.from(targets, {
    y: 36,
    opacity: 0,
    duration: 1.2,
    ease: 'expo.out',
    stagger: 0.09,
    ...vars,
    scrollTrigger: { trigger: trigger || targets, start: 'top 82%', ...(vars.scrollTrigger || {}) },
  });
};

if (!reduced) {
  gsap.from('.manifesto__text .w > span', {
    yPercent: 115,
    duration: 1.3,
    ease: 'expo.out',
    stagger: 0.04,
    scrollTrigger: { trigger: '.manifesto', start: 'top 78%' },
  });
  gsap.fromTo(
    '#photo',
    { clipPath: 'inset(100% 0% 0% 0% round 999px 999px 22px 22px)' },
    { clipPath: 'inset(0% 0% 0% 0% round 999px 999px 22px 22px)', duration: 1.7, ease: 'expo.inOut', scrollTrigger: { trigger: '#photo', start: 'top 85%' } }
  );
  gsap.fromTo('#photo img', { scale: 1.22 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '#photo', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.arch-line', { opacity: 0, x: 20, y: -20, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '#photo', start: 'top 70%' } });
  gsap.to('.ring', { rotation: 300, ease: 'none', scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.to('.about__bio .bw', {
    opacity: 1,
    stagger: 0.05,
    ease: 'none',
    scrollTrigger: { trigger: '.about__bio', start: 'top 85%', end: 'bottom 50%', scrub: true },
  });
  reveal(['.about__text .eyebrow', '.about__name', '.about__role'], '.about__text');
  reveal(['.about__quote', '.pillars li', '.stats > div'], '.about__quote');

  $$('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const dec = +(el.dataset.decimals || 0);
    const pre = el.dataset.prefix || '';
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () =>
        gsap.to(o, {
          v: end,
          duration: 2,
          ease: 'expo.out',
          onUpdate: () => (el.textContent = pre + o.v.toFixed(dec).replace('.', ',')),
        }),
    });
  });

  reveal(['.treat .sec-head > *'], '.treat .sec-head');
  reveal('.pill', '.pills', { y: 20, stagger: 0.05 });
  ScrollTrigger.create({
    trigger: '#grid',
    start: 'top 85%',
    once: true,
    onEnter: () =>
      gsap.fromTo('#grid .card', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1.3, ease: 'expo.out', stagger: 0.07, clearProps: 'transform,opacity' }),
  });
  gsap.set('#grid .card', { opacity: 0 });

  reveal(['.results__text > *'], '.results__text');
  gsap.from('#compare', { clipPath: 'inset(12% 12% 12% 12% round 28px)', duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: '#compare', start: 'top 80%' } });
  ScrollTrigger.create({ trigger: '#compare', start: 'top 60%', once: true, onEnter: () => compareHint() });

  // Reseñas: contador 0 → 4,7 y 0 → 177
  const num = $('#score-num');
  const cnt = $('#score-count');
  const c = { v: 0, n: 0 };
  const fmt = () => {
    num.textContent = c.v.toFixed(1).replace('.', ',');
    cnt.textContent = String(Math.round(c.n));
  };
  fmt();
  ScrollTrigger.create({
    trigger: '.reviews',
    start: 'top 65%',
    once: true,
    onEnter: () => {
      gsap.to(c, { v: 4.7, n: 177, duration: 2.6, ease: 'expo.out', onUpdate: fmt });
      gsap.fromTo('.score__star', { rotation: -120, scale: 0 }, { rotation: 0, scale: 1, duration: 1.8, ease: 'expo.out', delay: 0.4 });
    },
  });
  reveal(['.reviews__copy > *'], '.reviews__head');
  if (!mobile) {
    const dist = () => Math.max(0, reviewsTrack.scrollWidth - window.innerWidth);
    gsap.to(reviewsTrack, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: '.reviews',
        start: 'top top',
        end: () => `+=${dist() + window.innerHeight * 0.2}`,
        pin: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
  } else {
    reveal('.review', '.reviews__viewport', { stagger: 0.08 });
  }

  reveal(['.contact .sec-head > *'], '.contact .sec-head');
  reveal(['.map', '.contact__info'], '.contact__grid', { y: 60 });

  reveal(['.final > .eyebrow', '.final__title'], '.final');
  gsap.from('.final__btn', { scale: 0.6, opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.final__btn', start: 'top 85%' } });
  reveal('.final__sub', '.final__sub');

  // Flores: deriva lenta con el scroll
  $$('.flower').forEach((f, i) => {
    gsap.to(f, {
      y: (i % 2 ? -1 : 1) * 60,
      ease: 'none',
      scrollTrigger: { trigger: f.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // Navegación sólida al salir del hero
  ScrollTrigger.create({
    start: () => (stageTL ? stageTL.scrollTrigger.end : window.innerHeight) - 1,
    end: 'max',
    onToggle: (self) => $('#nav').classList.toggle('is-solid', self.isActive),
  });
}

// ——— Mapa (diferido) ———
const mapEl = $('#map');
const io = new IntersectionObserver(
  (entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    import('./ui/map.js')
      .then((m) => m.initMap(mapEl, { mobile }))
      .catch((err) => console.warn('[Skin Beauty] mapa no disponible:', err));
  },
  { rootMargin: '800px 0px' }
);
io.observe(mapEl);

// ——— Menú (tablet y móvil) ———
const menu = $('#menu');
const menuBtn = $('.menu-btn');
const setMenu = (open) => {
  menu.classList.toggle('is-open', open);
  menu.setAttribute('aria-hidden', String(!open));
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  lockScroll(open);
};
menuBtn.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
document.addEventListener('keydown', (e) => e.key === 'Escape' && menu.classList.contains('is-open') && setMenu(false));

// ——— Navegación interna ———
const scrollTargets = {
  top: () => 0,
  dreno: () => (stageTL ? stageTL.scrollTrigger.start + (stageTL.scrollTrigger.end - stageTL.scrollTrigger.start) * (PHASES.tag + 0.04) : $('#drenoredux')),
};
$$('[data-scroll]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    if (menu.classList.contains('is-open')) setMenu(false);
    const key = a.dataset.scroll;
    const t = scrollTargets[key] ? scrollTargets[key]() : $(`#${key}`);
    if (lenis) lenis.scrollTo(t, { duration: key === 'dreno' ? 2.6 : 1.8, easing: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2) });
    else (typeof t === 'number' ? window.scrollTo({ top: t }) : t.scrollIntoView());
  });
});

// ——— Medidas para la coreografía 3D ———
const docRect = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top + window.scrollY, w: r.width, h: r.height };
};
const measure = () => {
  const st = stageTL?.scrollTrigger;
  const wr = word.getBoundingClientRect();
  const sr = stageEl.getBoundingClientRect();
  const treat = docRect($('#tratamientos'));
  const vh = window.innerHeight;
  return {
    mobile,
    vw: window.innerWidth,
    vh,
    stage: st ? { start: st.start, end: st.end } : { start: 0, end: 1 },
    wordY: 1 - ((wr.top - sr.top + wr.height / 2) / vh) * 2,
    photo: docRect($('#photo')),
    grid: docRect($('#grid')),
    button: docRect($('#final-btn')),
    final: docRect($('#reserva')),
    maxScroll: ScrollTrigger.maxScroll(window),
    backRange: [treat.y - vh * 0.45, treat.y + treat.h - vh * 0.3],
  };
};
function applyLayout() {
  if (!stage) return;
  stage.setLayout(measure());
  if (reduced) stage.renderOnce();
}
ScrollTrigger.addEventListener('refresh', applyLayout);

let resizeT = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    fitWord();
    liquid.resize();
    stage?.resize();
    if (!reduced) applyWipe();
    else applyLayout();
  }, 120);
});

// ——— Bucle ———
gsap.ticker.add((time, deltaMS) => {
  const dt = deltaMS / 1000;
  cursorTick?.(dt);
  if (stage && !reduced) {
    stage.mouse.x = pointer.x;
    stage.mouse.y = pointer.y;
    stage.mouse.active = pointer.active;
    stage.tick(dt);
  }
  if (!reduced) {
    const st = stageTL?.scrollTrigger;
    const visible = wipe.p > 0 && st && window.scrollY < st.end + window.innerHeight;
    if (visible) liquid.draw(dt);
  }
});

// ——— Intro (≤ 1,5 s): el rodillo entra y la página se despliega tras él ———
const intro = $('#intro');
const heroBits = ['.hero__eyebrow', '.hero__sub', '.hero__cta', '.badge', '.hero__foot'];

const finishIntro = () => {
  intro.remove();
  html.classList.add('is-ready');
  lenis?.start();
};

const runIntro = async () => {
  await Promise.race([Promise.all([document.fonts?.ready, stagePromise]), wait(2600)]);
  fitWord();
  ScrollTrigger.refresh();
  if (reduced) {
    finishIntro();
    liquid.resize();
    liquid.draw(4);
    return;
  }
  gsap.set('.hero__title .word', { yPercent: 118 });
  gsap.set(heroBits, { opacity: 0, y: 24 });
  if (stage) canvas.classList.add('is-intro');

  const o = { p: 0 };
  const tl = gsap.timeline();
  tl.to(o, {
    p: 1,
    duration: 1.45,
    ease: 'power3.inOut',
    onUpdate: () => {
      const x = lerp(INTRO_X.from, INTRO_X.to, o.p);
      intro.style.clipPath = curtain(x, true).poly;
      if (stage) stage.params.introE = o.p;
    },
    onComplete: () => {
      finishIntro();
      canvas.classList.remove('is-intro');
      if (stage) {
        stage.params.introDone = true;
        gsap.to(stage.params, { settle: 1, duration: 1.3, ease: 'power3.inOut' });
      }
    },
  });
  tl.to('.hero__title .word', { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.09 }, 0.55);
  tl.to(heroBits, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08 }, 0.85);
};
runIntro();

// Acceso de depuración (solo en desarrollo)
if (import.meta.env.DEV) window.__sb = { lenis, get stage() { return stage; }, ScrollTrigger };
