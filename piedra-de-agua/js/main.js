// Orquestación: carga → HOME (agua) → destello → portón → PATIO (hub) ⇄ secciones.
// Este módulo no importa Three.js de forma estática: si la librería o WebGL no
// están disponibles se muestra la versión estática con fotografías.
import { IS_MOBILE, motion, waLink } from './config.js?v=2';
import { t, applyI18n, setLang, getLang, onLangChange } from './i18n.js?v=2';
import { unlockAudio, isSoundOn, setSound } from './util/audio.js?v=2';

const $ = (s, r = document) => r.querySelector(s);
const body = document.body;
const els = {
  canvas: $('#gl'), loader: $('#loader'), fill: $('#loader-fill'),
  flash: $('#flash'), flashBar: $('#flash-bar'), veil: $('#veil'),
  home: $('#home'), enter: $('#btn-enter'), homeHint: $('#home-hint-text'),
  hub: $('#hub'), hubHint: $('#hub-hint'), labels: [...document.querySelectorAll('.door-label')],
  skip: $('#btn-skip'), sections: $('#sections'), wa: $('#wa-float'),
  reserve: $('#btn-reserve'), sound: $('#btn-sound'), brand: $('#brand'),
};

const state = { phase: 'loading', section: null, busy: false };
let engine = null, home = null, patio = null, patioPromise = null;
let sectionsMod = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * motion.k));

// ───────────── textos e idioma ─────────────
function refreshTexts() {
  document.title = t('meta.title');
  els.homeHint.dataset.i18n = IS_MOBILE ? 'home.hint' : 'home.hint.desktop';
  els.hubHint.dataset.i18n = IS_MOBILE ? 'hub.hint' : 'hub.hint.desktop';
  applyI18n();
  splitTitle();
  els.wa.href = waLink(t('wa.msg'));
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
}

function splitTitle() {
  const h = $('#home-title');
  const text = h.textContent;
  h.setAttribute('aria-label', text);
  h.innerHTML = [...text].map((ch, i) => (ch === ' ' ? '<span class="sp"></span>' : `<span class="ch" aria-hidden="true" style="transition-delay:${(0.35 + i * 0.07).toFixed(2)}s">${ch}</span>`)).join('');
}

document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
onLangChange(() => { refreshTexts(); patio?.setLang(); });

els.sound.setAttribute('aria-pressed', String(isSoundOn()));
els.sound.addEventListener('click', () => {
  const on = !isSoundOn();
  setSound(on);
  els.sound.setAttribute('aria-pressed', String(on));
});
// el audio solo se activa tras la primera interacción
['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlockAudio, { once: true, passive: true }));

// ───────────── carga ─────────────
let shownProgress = 0;
function progress(p) {
  shownProgress = Math.max(shownProgress, p);
  els.fill.style.width = `${Math.round(shownProgress * 100)}%`;
}

function fontsReady(timeout = 2500) {
  if (!document.fonts?.load) return Promise.resolve();
  const loads = Promise.all([
    document.fonts.load('300 64px "Cormorant Garamond"'),
    document.fonts.load('500 64px "Cormorant Garamond"'),
    document.fonts.load('600 64px "Cormorant Garamond"'),
    document.fonts.load('italic 500 64px "Cormorant Garamond"'),
    document.fonts.load('400 16px Jost'),
  ]).catch(() => {});
  return Promise.race([loads, new Promise((r) => setTimeout(r, timeout))]);
}

function hideLoader() {
  els.loader.classList.add('is-done');
  body.classList.remove('is-loading');
}

// ───────────── versión estática ─────────────
async function goStatic(reason) {
  console.warn('Versión estática:', reason);
  const { initStatic } = await import('./static.js?v=2');
  els.canvas.hidden = true;
  els.home.hidden = true;
  body.classList.add('no-webgl');
  await initStatic($('#static'));
  hideLoader();
}

// ───────────── HOME ─────────────
async function showHome() {
  state.phase = 'home';
  engine.setActive(home);
  hideLoader();
  home.intro.value = 0;
  const { tween, ease } = await import('./util/tween.js?v=2');
  tween({ duration: 1.6, easing: ease.outCubic, onUpdate: (v) => { home.intro.value = v; } });
  setTimeout(() => home.splash(), motion.reduced ? 50 : 650);
  requestAnimationFrame(() => body.classList.add('home-ready'));
}

let keyboardIntro = false;
async function enterCasona(e) {
  if (state.phase !== 'home' || state.busy) return;
  state.busy = true;
  keyboardIntro = e?.detail === 0; // activado con teclado
  unlockAudio();
  const { tween, ease } = await import('./util/tween.js?v=2');
  // luz cegadora: el agua se aclara y la pantalla queda en blanco
  els.flash.classList.remove('is-fading');
  els.flash.classList.add('is-on');
  tween({ duration: 0.45, easing: ease.inQuad, onUpdate: (v) => { home.flash.value = v; } });
  els.home.classList.add('is-hidden');
  await sleep(480);
  if (!patio) {
    els.flash.classList.add('is-waiting');
    patio = await patioPromise;
    els.flash.classList.remove('is-waiting');
  }
  await sleep(motion.reduced ? 100 : 520);
  // del blanco aparece el portón: la exposición baja como el ojo que se acostumbra
  state.phase = 'intro';
  body.classList.add('is-intro');
  els.home.hidden = true;
  engine.setActive(patio);
  const r = engine.renderer;
  r.toneMappingExposure = 6;
  els.skip.hidden = false;
  history.replaceState(null, '', '#/patio');
  requestAnimationFrame(() => {
    els.flash.classList.add('is-fading');
    els.flash.classList.remove('is-on');
  });
  tween({ duration: 2.4, easing: ease.outCubic, onUpdate: (v) => { r.toneMappingExposure = 6 - 5 * v; } });
  await patio.playIntro();
  r.toneMappingExposure = 1;
  state.busy = false;
}

function onHubReady() {
  state.phase = 'hub';
  body.classList.remove('is-intro');
  els.skip.hidden = true;
  engine.renderer.toneMappingExposure = 1;
  els.hub.hidden = false;
  requestAnimationFrame(() => els.hub.classList.add('is-ready'));
  // quien entra con teclado continúa en las puertas
  if (keyboardIntro) setTimeout(() => els.labels[1]?.focus({ preventScroll: true }), 300);
}

// ───────────── etiquetas de las puertas ─────────────
function placeLabels(list) {
  for (const o of list) {
    const el = els.labelsById[o.id];
    let x = o.x, y = o.y;
    const w = el.offsetWidth || 120, h = el.offsetHeight || 34;
    const m = 14;
    el.classList.toggle('is-off-l', o.off < 0);
    el.classList.toggle('is-off-r', o.off > 0);
    if (o.off !== 0) {
      x = o.off < 0 ? m + w / 2 : engine.size.w - m - w / 2;
      y = Math.min(Math.max(y, 140), engine.size.h - 160);
    }
    x = Math.min(Math.max(x, m + w / 2), engine.size.w - m - w / 2);
    y = Math.min(Math.max(y - h - 18, 110), engine.size.h - 150);
    el.style.transform = `translate3d(${(x - w / 2).toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }
}

function setupLabels() {
  els.labelsById = {};
  els.labels.forEach((el) => {
    const id = el.dataset.door;
    els.labelsById[id] = el;
    el.addEventListener('mouseenter', () => patio?.setHover(id));
    el.addEventListener('mouseleave', () => patio?.setHover(null));
    el.addEventListener('focus', () => { patio?.setHover(id); if (el.classList.contains('is-off-l') || el.classList.contains('is-off-r')) patio?.lookToward(id); });
    el.addEventListener('blur', () => patio?.setHover(null));
    el.addEventListener('click', () => {
      if (el.classList.contains('is-off-l') || el.classList.contains('is-off-r')) {
        // fuera de pantalla: primero mirar hacia la puerta
        patio?.lookToward(id);
        patio?.setHover(id);
        setTimeout(() => openSection(id), motion.reduced ? 100 : 650);
      } else {
        openSection(id);
      }
    });
  });
}

// ───────────── secciones ─────────────
async function openSection(id, { instant = false } = {}) {
  if (state.busy || (state.phase !== 'hub' && !instant)) return;
  state.busy = true;
  els.hub.classList.add('is-busy');
  sectionsMod ??= await import('./sections/index.js?v=2');
  const secP = sectionsMod.getSection(id, { root: els.sections, engine, onBack: () => goPatio() });
  if (instant) {
    setVeil(true, 0.01);
  } else {
    const ok = await patio.enterDoor(id);
    if (!ok) { state.busy = false; els.hub.classList.remove('is-busy'); return; }
  }
  const sec = await secP;
  state.phase = 'section';
  state.section = id;
  els.hub.classList.remove('is-ready');
  els.hub.hidden = true;
  if (location.hash !== `#/${id}`) history.pushState({ id }, '', `#/${id}`);
  body.classList.toggle('on-light', sec.theme === 'paper');
  body.classList.toggle('own-credit', sec.theme === 'paper' || !!sec.ownCredit);
  engine.setActive(sec.view || null);
  sec.el.classList.add('is-open');
  sec.el.scrollTop = 0;
  await sec.enter?.();
  await sleep(80);
  setVeil(false, 0.7);
  (sec.el.querySelector('h1, h2') || sec.el).focus?.({ preventScroll: true });
  state.busy = false;
}

async function goPatio({ fromHistory = false } = {}) {
  if (state.phase !== 'section' || state.busy) return;
  state.busy = true;
  const id = state.section;
  const sec = await sectionsMod.getSection(id);
  setVeil(true, 0.45);
  await sleep(460);
  sec.el.classList.remove('is-open');
  await sec.exit?.();
  body.classList.remove('on-light', 'own-credit');
  engine.setActive(patio);
  els.hub.hidden = false;
  if (!fromHistory) history.pushState(null, '', '#/patio');
  const back = patio.returnFrom(id);
  await sleep(120);
  setVeil(false, 0.8);
  await back;
  state.phase = 'hub';
  state.section = null;
  els.hub.classList.remove('is-busy');
  els.hub.classList.add('is-ready');
  els.labelsById[id]?.focus({ preventScroll: true });
  state.busy = false;
}

function setVeil(on, seconds) {
  els.veil.style.transitionDuration = `${seconds * (motion.reduced ? 0.4 : 1)}s`;
  els.veil.classList.toggle('is-on', on);
}

window.addEventListener('popstate', () => {
  const h = location.hash.replace('#/', '');
  if (state.phase === 'section' && (h === 'patio' || h === '')) goPatio({ fromHistory: true });
  else if (state.phase === 'hub' && sectionsMod?.SECTION_IDS.includes(h)) openSection(h);
});

// ───────────── contacto ─────────────
async function openContact() {
  const { openContactPanel } = await import('./contact.js?v=2');
  openContactPanel($('#contact'));
}
els.reserve.addEventListener('click', openContact);
els.brand.addEventListener('click', (e) => {
  e.preventDefault();
  if (state.phase === 'section') goPatio();
});

// ───────────── arranque ─────────────
async function boot() {
  document.documentElement.lang = getLang();
  refreshTexts();
  setupLabels();
  progress(0.08);
  let mods;
  try {
    const eng = await import('./engine.js?v=2');
    if (!eng.hasWebGL()) throw new Error('WebGL no disponible');
    progress(0.2);
    mods = await Promise.all([import('./scenes/home.js?v=2'), import('./scenes/patio/index.js?v=2'), fontsReady()]);
    engine = eng.engine.init(els.canvas);
  } catch (err) {
    return goStatic(err);
  }
  progress(0.45);
  const [{ createHome }, { createPatio }] = mods;
  try {
    home = createHome(engine);
  } catch (err) {
    return goStatic(err);
  }
  progress(0.6);
  // un primer cuadro del agua tras la carga
  engine.setActive(home);
  await new Promise((r) => setTimeout(r, 350));
  progress(1);

  const deep = location.hash.replace('#/', '');
  const deepSection = ['nosotros', 'habitaciones', 'servicios', 'experiencias'].includes(deep) ? deep : null;
  const startPatio = () => createPatio(engine, {
    onProgress: (p) => { els.flashBar.style.width = `${Math.round(p * 100)}%`; },
  }).then((v) => {
    v.on('labels', placeLabels);
    v.on('hover', (id) => els.labels.forEach((el) => el.classList.toggle('is-hot', el.dataset.door === id)));
    v.on('enter', (id) => openSection(id));
    v.on('veil', (on, s) => setVeil(on, s));
    v.on('hubReady', onHubReady);
    return v;
  });

  if (deepSection || deep === 'patio') {
    // enlace directo: saltar el agua y la intro
    els.flash.classList.add('is-on', 'is-waiting');
    hideLoader();
    els.home.hidden = true;
    patio = await startPatio();
    els.flash.classList.remove('is-waiting');
    engine.setActive(patio);
    patio.jumpToHub();
    onHubReady();
    els.flash.classList.add('is-fading');
    els.flash.classList.remove('is-on');
    if (deepSection) openSection(deepSection, { instant: true });
    return;
  }

  await sleep(250);
  showHome();
  // el patio se construye en segundo plano mientras se mira el agua
  patioPromise = new Promise((r) => setTimeout(r, 900)).then(startPatio);
  patioPromise.then((v) => { patio = v; }).catch((err) => console.error(err));
}

// acceso para pruebas automáticas
window.__pda = {
  state,
  get patio() { return patio; },
  info: () => ({ phase: state.phase, dpr: engine?.dpr, calls: engine?.renderer.info.render.calls, tris: engine?.renderer.info.render.triangles, frameAvg: engine?.frameAvg?.toFixed(1) }),
};

els.enter.addEventListener('click', enterCasona);
els.skip.addEventListener('click', () => patio?.finishIntro());

boot();
