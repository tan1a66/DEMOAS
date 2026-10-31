import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import './styles.css';

import data from './data/villa.json';
import { onLang, ui } from './i18n.js';
import { Viewer } from './viewer/Viewer.js';
import { Markers } from './ui/markers.js';
import { Panel } from './ui/panel.js';
import { Chrome } from './ui/chrome.js';
import { setupDebug } from './ui/debug.js';

const params = new URLSearchParams(location.search);
const debug = params.get('debug') === '1';
const start = params.get('scene') && data.scenes.some((s) => s.id === params.get('scene'))
  ? params.get('scene')
  : data.route[0];

const app = document.getElementById('app');
const chrome = new Chrome(document.getElementById('ui'));
const panel = new Panel(document.getElementById('ui'));

const viewer = new Viewer({
  canvas: document.getElementById('gl'),
  data,
  onSceneChange: (scene) => {
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

onLang(() => {
  chrome.refreshLang();
  markers.refreshLang();
  panel.refreshLang();
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

if (debug) setupDebug({ app, viewer, chrome });

viewer.show(start).catch((err) => {
  console.error(err);
  chrome.toast(String(err.message || err), 6000);
});

// Per prove e debug dalla console.
window.__pedramar = { viewer, markers, panel, data };
