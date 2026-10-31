import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import './styles.css';

import gsap from 'gsap';
import data from './data/villa.json';
import { onLang, t, ui } from './i18n.js';
import { asset } from './asset.js';
import { OrbitView } from './render/OrbitView.js';
import { PanoView } from './render/PanoView.js';
import { Hud } from './render/Hud.js';
import { Panel } from './ui/panel.js';
import { Chrome } from './ui/chrome.js';

/*
  Villa Pedramar: solo render (Blender/Cycles), niente foto.
  Due palcoscenici sovrapposti:
  - "orbit": giro intorno alla villa a fotogrammi, con gli ingressi alle stanze;
  - "pano": panorami 360° collegati da passi, con le finiture.
  L'ora del giorno (mattina, tramonto, notte) vale per entrambi.
*/

const R = data.renders;
const panos = new Map(R.panos.map((p) => [p.id, p]));
const route = ['soggiorno', 'cucina', 'ballatoio', 'camera', 'bagno', 'terrazza', 'passaggio'];

const params = new URLSearchParams(location.search);
const state = {
  mode: null,
  busy: false,
  time: R.times.includes(params.get('time')) ? params.get('time') : R.defaultTime,
  visited: new Set(),
  hintShown: { orbit: false, pano: false },
};

const stageOrbit = document.getElementById('orbit');
const stagePano = document.getElementById('pano');
const flash = document.getElementById('flash');
const uiRoot = document.getElementById('ui');
const chrome = new Chrome(uiRoot);
const panel = new Panel(uiRoot);

uiRoot.insertAdjacentHTML('beforeend', `
  <nav class="times" aria-label=""></nav>
  <button type="button" class="btn-map btn-exterior" hidden><span class="btn-exterior__icon" aria-hidden="true"></span><span class="btn-map__label"></span></button>
  <a class="cta-visit" target="_blank" rel="noopener"><span></span></a>
  <p class="hint" aria-live="polite"></p>
`);
const timesNav = uiRoot.querySelector('.times');
const btnExterior = uiRoot.querySelector('.btn-exterior');
const ctaVisit = uiRoot.querySelector('.cta-visit');
const hint = uiRoot.querySelector('.hint');
R.times.forEach((id) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.time = id;
  b.innerHTML = `<i class="times__icon times__icon--${id}" aria-hidden="true"></i><span></span>`;
  b.addEventListener('click', () => setTime(id));
  timesNav.appendChild(b);
});

const orbit = new OrbitView({ canvas: document.getElementById('orbit-canvas'), orbit: R.orbit, onFrame: () => hudOrbit.update() });
const pano = new PanoView({ canvas: document.getElementById('pano-canvas'), panos: R.panos, onFrame: () => hudPano.update() });
const hudOrbit = new Hud(document.getElementById('orbit-markers'));
const hudPano = new Hud(document.getElementById('pano-markers'));
orbit.onInteract = () => hideHint();
pano.onInteract = () => hideHint();

const nextSuggested = () => route.find((id) => !state.visited.has(id)) || null;

function nextFrom(id) {
  const p = panos.get(id);
  const links = (p.links || []).map((l) => l.to);
  const n = route.find((r) => !state.visited.has(r) && links.includes(r));
  return n || null;
}

function showHint(kind) {
  if (state.hintShown[kind]) return;
  state.hintShown[kind] = true;
  hint.textContent = ui(kind === 'orbit' ? 'dragOrbit' : 'dragPano');
  gsap.fromTo(hint, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.8, delay: 1.2, ease: 'power3.out' });
  gsap.to(hint, { autoAlpha: 0, duration: 0.6, delay: 6 });
}
function hideHint() { gsap.to(hint, { autoAlpha: 0, duration: 0.4, overwrite: true }); }

function refreshTexts() {
  timesNav.setAttribute('aria-label', ui('timeLabel'));
  timesNav.querySelectorAll('button').forEach((b) => {
    b.querySelector('span').textContent = ui(b.dataset.time);
    b.classList.toggle('is-active', b.dataset.time === state.time);
    b.setAttribute('aria-pressed', String(b.dataset.time === state.time));
  });
  btnExterior.querySelector('.btn-map__label').textContent = ui('exterior');
  btnExterior.setAttribute('aria-label', ui('exterior'));
  const msg = encodeURIComponent(`${data.villa.name} — ${t(data.contact.cta)}`);
  ctaVisit.href = `https://wa.me/${data.contact.whatsapp}?text=${msg}`;
  ctaVisit.querySelector('span').textContent = t(data.contact.cta);
  if (state.mode === 'orbit') chrome.setPlace(ui('exterior'), ui(state.time));
  if (state.mode === 'pano') setWhere(pano.current.pano);
}

function setWhere(p) {
  const level = data.levels.find((l) => l.id === p.level);
  chrome.setPlace(level ? t(level.name) : '', t(p.name));
}

async function setTime(time) {
  if (time === state.time || state.busy) return;
  state.time = time;
  refreshTexts();
  chrome.loading(true);
  try {
    if (state.mode === 'pano') await pano.setTime(time);
    else await orbit.setTime(time);
  } catch (e) {
    chrome.toast(String(e.message || e), 5000);
  }
  chrome.loading(false);
}

function setOrbitHud() {
  hudOrbit.setOrbit(orbit, R.orbit.entries, panos, { onEnter: (en) => enterPano(en.to, en.at), next: nextSuggested() });
}

function setPanoHud(p) {
  hudPano.setPano(pano, p, panos, {
    next: nextFrom(p.id),
    onStep: (ln) => step(ln),
    onHotspot: (pp, i) => panel.open(pp.hotspots[i], asset(`/renders/crops/${pp.id}-${i + 1}.jpg`)),
  });
}

function arrived(p) {
  state.visited.add(p.id);
  setWhere(p);
  setPanoHud(p);
  ctaVisit.classList.toggle('is-final', !!p.final);
  (p.links || []).forEach((l) => pano.preload(l.to, state.time));
}

/** Dall'esterno a una stanza: avvicinamento sul giro, lampo caldo, panorama. */
async function enterPano(id, at) {
  if (state.busy) return;
  state.busy = true;
  panel.close();
  hudOrbit.setVisible(false);
  chrome.loading(true);
  const ready = pano.texture(id, state.time);
  const sp = at ? orbit.project(at) : null;
  if (sp) stageOrbit.style.transformOrigin = `${sp.x}px ${sp.y}px`;
  gsap.to(stageOrbit, { scale: 1.6, duration: 1.1, ease: 'power2.in' });
  try {
    await ready;
  } catch (e) {
    chrome.toast(String(e.message || e), 6000);
  }
  chrome.loading(false);
  await gsap.timeline()
    .to(flash, { autoAlpha: 0.85, duration: 0.25, ease: 'power2.in' })
    .call(async () => {
      const p = await pano.show(id, state.time);
      pano.setActive(true);
      gsap.set(stagePano, { autoAlpha: 1 });
      gsap.set(stageOrbit, { autoAlpha: 0, scale: 1 });
      orbit.setActive(false);
      state.mode = 'pano';
      arrived(p);
    })
    .to(flash, { autoAlpha: 0, duration: 0.9, ease: 'power2.out' })
    .then();
  btnExterior.hidden = false;
  gsap.fromTo(btnExterior, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 });
  hudPano.setVisible(true);
  showHint('pano');
  state.busy = false;
}

async function step(ln) {
  if (state.busy) return;
  state.busy = true;
  panel.close();
  hudPano.setVisible(false);
  chrome.loading(true);
  try {
    const p = await pano.goTo(ln.to, { via: ln.at });
    if (p) arrived(p);
  } catch (e) {
    chrome.toast(String(e.message || e), 6000);
  }
  chrome.loading(false);
  hudPano.setVisible(true);
  state.busy = false;
}

/** Torna al giro esterno (all'avvio o dal pulsante Exterior). */
async function toOrbit() {
  if (state.busy) return;
  state.busy = true;
  panel.close();
  hudPano.setVisible(false);
  chrome.loading(true);
  await orbit.setTime(state.time);
  chrome.loading(false);
  orbit.setActive(true);
  setOrbitHud();
  state.mode = 'orbit';
  refreshTexts();
  gsap.set(stageOrbit, { scale: 1.08, transformOrigin: '50% 50%' });
  gsap.to(stageOrbit, { autoAlpha: 1, scale: 1, duration: 1.2, ease: 'power3.out' });
  await gsap.to(stagePano, { autoAlpha: 0, duration: 0.8, ease: 'power2.inOut' }).then();
  pano.setActive(false);
  btnExterior.hidden = true;
  ctaVisit.classList.remove('is-final');
  hudOrbit.setVisible(true);
  showHint('orbit');
  state.busy = false;
}

btnExterior.addEventListener('click', () => toOrbit());

onLang(() => {
  chrome.refreshLang();
  hudOrbit.refreshLang();
  hudPano.refreshLang();
  panel.refreshLang();
  refreshTexts();
});

refreshTexts();
gsap.set([stageOrbit, stagePano, hint], { autoAlpha: 0 });
const startPano = panos.has(params.get('pano')) ? params.get('pano') : null;
if (startPano) {
  pano.show(startPano, state.time).then((p) => {
    pano.setActive(true);
    gsap.set(stagePano, { autoAlpha: 1 });
    state.mode = 'pano';
    arrived(p);
    refreshTexts();
    btnExterior.hidden = false;
  }).catch((err) => chrome.toast(String(err.message || err), 6000));
} else {
  toOrbit();
}

// Per prove dalla console.
window.__pedramar = { orbit, pano, hudOrbit, hudPano, panel, data, state, enterPano, toOrbit, setTime };
