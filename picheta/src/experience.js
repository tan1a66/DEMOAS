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

  const ctx = { engine, pointer, sound, quality, content, config, ui };
  const director = new Director(engine, ctx);
  let router;
  ctx.director = director;
  ctx.chrome = new Chrome(ui, { content, config, sound, onNavigate: (r) => router.go(r) });
  ctx.panel = new Panel(ui, { content, config, engine, onClose: () => closeSection() });
  ctx.overlayOpen = () => ctx.chrome.open || ctx.panel.isOpen;
  ctx.restart = () => (router.current === 'inicio' ? director.go('intro') : router.go('inicio'));
  new Cursor(ui, engine, pointer);

  // ---------------------------------------------------------------- precarga
  preloader.set(0.08);
  await Promise.race([
    Promise.all([document.fonts.load('400 1em Jost'), document.fonts.load('italic 300 1em "Cormorant Garamond"')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});
  preloader.set(0.2);
  const intro = await director.load('intro', (p) => preloader.set(0.2 + p * 0.78));
  // Se renderiza la intro (aún invisible) detrás de la precarga: shaders y
  // postproceso quedan compilados antes de la primera imagen.
  engine.setScene(intro);
  await preloader.finish();

  // ---------------------------------------------------------------- rutas
  async function onRoute(route) {
    if (SECTIONS.includes(route)) {
      // Enlace directo a una sección: la escena queda detrás, ya formada.
      if (!director.current) await director.go('intro', { instant: true });
      ctx.panel.open(route, { fromTerrace: director.name === 'terraza' });
      return;
    }
    ctx.panel.close();
    if (route === 'inicio' && director.name !== 'intro') director.go('intro');
    // 'terraza': disponible cuando exista la escena (siguiente entrega).
    if (route === 'terraza' && director.has('terraza')) director.go('terraza');
    else if (route === 'terraza' && !director.current) director.go('intro');
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
}
