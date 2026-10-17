import gsap from 'gsap';
import { detectQuality } from './core/quality.js';
import { Engine } from './core/Engine.js';
import { Pointer } from './core/Pointer.js';
import { Sound } from './core/Sound.js';
import { Director } from './core/Director.js';
import { Router, SECTIONS } from './core/Router.js';
import { Preloader } from './ui/Preloader.js';
import { Chrome } from './ui/Chrome.js';
import { Panel } from './ui/Panel.js';
import { Cursor } from './ui/Cursor.js';
import { Gyro } from './core/Gyro.js';

// Arranque de la experiencia 3D: motor, escenas, interfaz y rutas.
export async function startExperience({ content, config }) {
  const ui = document.getElementById('ui');
  const quality = detectQuality();
  document.documentElement.classList.toggle('touch', quality.coarse);

  const preloader = new Preloader(ui, content);
  const engine = new Engine(document.getElementById('gl'), quality);
  engine.start();

  const pointer = new Pointer(engine.canvas, () => engine.time);
  engine.onFrame((dt) => pointer.update(dt));
  const sound = new Sound();

  const ctx = { engine, pointer, sound, quality, content, config, ui, gyro: new Gyro() };
  const director = new Director(engine, ctx);
  let router;
  ctx.director = director;
  ctx.chrome = new Chrome(ui, { content, config, sound, onNavigate: (r) => router.go(r) });
  ctx.panel = new Panel(ui, { content, config, engine, onClose: () => closeSection() });
  ctx.overlayOpen = () => ctx.chrome.open || ctx.panel.isOpen;
  ctx.restart = () => (router.current === 'inicio' ? director.go('intro') : router.go('inicio'));
  // Un objeto de la terraza (o el menú) pide una sección.
  ctx.navigate = (id) => router.go(id);
  // Fin de la escalera: llegada a la terraza.
  ctx.arrive = () => router.go('terraza');
  new Cursor(ui, engine, pointer);

  // ---------------------------------------------------------------- precarga
  preloader.set(0.08);
  await Promise.race([
    Promise.all([document.fonts.load('400 1em Jost'), document.fonts.load('italic 300 1em "Cormorant Garamond"')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});
  preloader.set(0.2);
  // Enlace directo a la terraza o a una sección: se carga la terraza en vez de la intro.
  const first = location.hash.replace(/^#\/?/, '').toLowerCase();
  const startOnTerrace = first === 'terraza' || SECTIONS.includes(first);
  const firstScene = await director.load(startOnTerrace ? 'terraza' : 'intro', (p) => preloader.set(0.2 + p * 0.78));
  // Se renderiza la escena (aún invisible) detrás de la precarga: shaders y
  // postproceso quedan compilados antes de la primera imagen.
  if (!startOnTerrace) engine.setScene(firstScene);
  else gsap.set('#veil', { opacity: 1 });
  await preloader.finish();

  // ---------------------------------------------------------------- rutas
  async function onRoute(route) {
    if (SECTIONS.includes(route)) {
      // Las secciones viven sobre la terraza: si no estamos allí, se salta a ella.
      if (director.name !== 'terraza') await director.go('terraza', { instant: true, fade: !!director.current });
      director.current.focus(route);
      ctx.panel.open(route, { fromTerrace: true });
      return;
    }
    ctx.panel.close();
    if (route === 'terraza') {
      if (director.name === 'terraza') director.current.unfocus();
      else if (director.name === 'llegada') director.go('terraza');
      else director.go('terraza', { instant: true, fade: !!director.current });
    }
    if (route === 'inicio' && director.name !== 'intro') director.go('intro', { fade: !!director.current });
  }

  // Cerrar una sección: si se abrió desde la propia web, "atrás" en el
  // historial (coherente con el gesto atrás del teléfono); si se llegó por
  // enlace directo, se sustituye la URL.
  function closeSection() {
    if (router.depth > 0) history.back();
    else router.go(director.name === 'terraza' ? 'terraza' : 'inicio', { replace: true });
  }

  router = new Router(onRoute);
  router.notify(true);
  if (engine.manual) Object.assign(window.__picheta, { director, router, ctx });
}
