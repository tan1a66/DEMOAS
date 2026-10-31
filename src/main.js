import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import './styles.css';

import gsap from 'gsap';
import data from './data/villa.json';
import { onLang, t, ui } from './i18n.js';
import { Viewer } from './viewer/Viewer.js';
import { Plastico } from './plastico/Plastico.js';
import { Markers } from './ui/markers.js';
import { MapMarkers } from './ui/mapMarkers.js';
import { Panel } from './ui/panel.js';
import { Chrome } from './ui/chrome.js';
import { setupDebug } from './ui/debug.js';

/*
  Regia: due palcoscenici sovrapposti.
  - "model": il plastico 3D (orbita, punti delle stanze, Entrar → BOOM);
  - "photo": le foto immersive (passi, finiture, scala).
  Si passa dall'uno all'altro con voli di camera e dissolvenze; solo il palcoscenico visibile
  viene disegnato.
*/

const params = new URLSearchParams(location.search);
const debug = params.get('debug') === '1';
const startScene = data.scenes.some((s) => s.id === params.get('scene')) ? params.get('scene') : null;

const app = document.getElementById('app');
const stagePhoto = document.getElementById('photo');
const stageModel = document.getElementById('model');
const flash = document.getElementById('flash');
const uiRoot = document.getElementById('ui');
const chrome = new Chrome(uiRoot);
const panel = new Panel(uiRoot);

const state = { mode: null, busy: false, visited: new Set() };

// Pulsanti principali
uiRoot.insertAdjacentHTML('beforeend', `
  <button type="button" class="cta-enter" hidden><span></span></button>
  <button type="button" class="btn-map" hidden><span class="btn-map__icon" aria-hidden="true"></span><span class="btn-map__label"></span></button>
`);
const btnEnter = uiRoot.querySelector('.cta-enter');
const btnMap = uiRoot.querySelector('.btn-map');

const viewer = new Viewer({
  canvas: document.getElementById('gl'),
  data,
  onSceneChange: (scene) => {
    state.visited.add(scene.id);
    markers.setScene(scene);
    chrome.setScene(scene);
  },
  onTransition: (busy) => {
    markers.setVisible(!busy);
    if (busy) panel.close();
  },
  onLoading: (on) => chrome.loading(on),
});

const markers = new Markers(document.getElementById('markers'), viewer, {
  route: data.route,
  onStep: (step) => viewer.goTo(step.to, { from: step, kind: 'step' }),
  onStairs: (st) => viewer.goTo(st.to, { from: st, kind: 'stairs', dir: st.dir }),
  onHotspot: (scene, i) => panel.open(scene, i),
});
viewer.onFrame(() => markers.update());

const plastico = new Plastico({ canvas: document.getElementById('plastico'), data });
const mapMarkers = new MapMarkers(document.getElementById('map-markers'), plastico, {
  scenes: data.scenes,
  onPick: (scene) => enterScene(scene.id),
});
plastico.onFrame(() => mapMarkers.update());

function nextSuggested() {
  return data.route.find((id) => !state.visited.has(id)) || data.route[0];
}

function refreshTexts() {
  btnEnter.querySelector('span').textContent = ui('enter');
  btnMap.querySelector('.btn-map__label').textContent = ui('maqueta');
  btnMap.setAttribute('aria-label', ui('maqueta'));
  if (state.mode === 'model') chrome.setPlace(ui('exterior'), ui('maqueta'));
}

function showStage(which) {
  stageModel.classList.toggle('is-active', which === 'model');
  stagePhoto.classList.toggle('is-active', which === 'photo');
}

/** Mostra il plastico (all'avvio o tornando da una scena). */
async function toModel({ fromScene } = {}) {
  if (state.busy) return;
  state.busy = true;
  panel.close();
  markers.setVisible(false);
  btnMap.hidden = true;
  plastico.start();
  mapMarkers.setNext(nextSuggested());
  mapMarkers.setVisible(false);
  if (fromScene?.map) plastico.home({ from: fromScene.map, duration: 1.8 });
  gsap.to(stageModel, { autoAlpha: 1, duration: fromScene ? 0.9 : 1.2, ease: 'power2.out' });
  await gsap.to(stagePhoto, { autoAlpha: 0, duration: 0.9, ease: 'power2.inOut' }).then();
  viewer.setActive(false);
  showStage('model');
  state.mode = 'model';
  refreshTexts();
  btnEnter.hidden = false;
  gsap.fromTo(btnEnter, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' });
  mapMarkers.setVisible(true);
  state.busy = false;
  viewer.preload(data.boom.scene).catch(() => {});
}

/** Dal plastico a una scena: BOOM per il soggiorno, avvicinamento per le altre. */
async function enterScene(id) {
  if (state.busy) return;
  state.busy = true;
  const scene = data.scenes.find((s) => s.id === id);
  const boom = id === data.boom.scene;
  gsap.to(btnEnter, { autoAlpha: 0, duration: 0.3 });
  mapMarkers.setVisible(false);
  const ready = viewer.preload(id);

  if (boom) {
    // Volo verso la vetrata, lampo caldo, dissolvenza nella foto.
    await new Promise((resolve) => {
      plastico.boom(async () => {
        await ready;
        gsap.timeline()
          .to(flash, { autoAlpha: 1, duration: 0.18, ease: 'power2.in' })
          .call(() => {
            viewer.setActive(true);
            viewer.show(id, { arrive: 'boom' });
            gsap.set(stagePhoto, { autoAlpha: 1 });
            gsap.set(stageModel, { autoAlpha: 0 });
          })
          .to(flash, { autoAlpha: 0, duration: 1.1, ease: 'power2.out' })
          .call(resolve);
      });
    });
  } else {
    await plastico.approach(scene.map);
    await ready;
    viewer.setActive(true);
    await viewer.show(id, { arrive: true });
    gsap.to(stageModel, { autoAlpha: 0, duration: 0.7, ease: 'power2.inOut' });
    await gsap.to(stagePhoto, { autoAlpha: 1, duration: 0.7, ease: 'power2.inOut' }).then();
  }
  plastico.stop();
  btnEnter.hidden = true;
  showStage('photo');
  state.mode = 'photo';
  markers.setVisible(true);
  btnMap.hidden = false;
  gsap.fromTo(btnMap, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, delay: 0.4 });
  state.busy = false;
}

btnEnter.addEventListener('click', () => enterScene(data.boom.scene));
btnMap.addEventListener('click', () => toModel({ fromScene: viewer.currentScene }));

onLang(() => {
  chrome.refreshLang();
  markers.refreshLang();
  mapMarkers.refreshLang();
  panel.refreshLang();
  refreshTexts();
});

// Giroscopio: su iOS il permesso si chiede dentro un gesto dell'utente (il primo tocco).
const askGyro = async () => {
  removeEventListener('click', askGyro);
  removeEventListener('touchend', askGyro);
  if (await viewer.motion.enableGyro()) chrome.toast(ui('motion'), 2600);
};
if (viewer.motion.gyroAvailable) {
  addEventListener('click', askGyro);
  addEventListener('touchend', askGyro);
}

if (debug) setupDebug({ app, viewer, plastico, chrome, getMode: () => state.mode });

refreshTexts();
gsap.set([stagePhoto, stageModel], { autoAlpha: 0 });
if (startScene) {
  viewer.show(startScene).then(() => {
    gsap.set(stagePhoto, { autoAlpha: 1 });
    showStage('photo');
    state.mode = 'photo';
    btnMap.hidden = false;
  }).catch((err) => chrome.toast(String(err.message || err), 6000));
} else {
  viewer.setActive(false);
  toModel();
}

// Per prove e debug dalla console.
window.__pedramar = { viewer, plastico, markers, mapMarkers, panel, data, state, t };
