import gsap from 'gsap';
import { detectQuality } from './core/quality.js';
import { Engine } from './core/Engine.js';
import { Pointer } from './core/Pointer.js';
import { Sound } from './core/Sound.js';
import { Director } from './core/Director.js';
import { Router, SECTIONS, ROOM_IDS } from './core/Router.js';
import { ROOM_OF } from './scenes/mundo/spaces.js';
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
  let fromIntro = false;
  ctx.director = director;
  ctx.chrome = new Chrome(ui, { content, config, sound, onNavigate: (r) => router.go(r) });
  ctx.panel = new Panel(ui, { content, config, engine, onClose: () => closeSection() });
  ctx.overlayOpen = () => ctx.chrome.open || ctx.panel.isOpen;
  // Un punto de luz (o el menú) pide una sección.
  ctx.navigate = (id) => router.go(id);
  // El círculo está dibujado: se entra en la casa por la primera sala.
  ctx.enterWorld = () => {
    fromIntro = true;
    router.go(ROOM_IDS[0]);
  };
  // La cámara pasa a otra sala del recorrido: la URL acompaña (sin llenar el historial).
  ctx.roomChanged = (id) => router.go(id, { replace: true });
  new Cursor(ui, engine, pointer);

  // ---------------------------------------------------------------- precarga
  preloader.set(0.08);
  await Promise.race([
    Promise.all([document.fonts.load('400 1em Jost'), document.fonts.load('italic 300 1em "Cormorant Garamond"')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});
  preloader.set(0.2);
  // Enlace directo a una sala o a una sección: se carga la casa en vez de la intro.
  const first = location.hash.replace(/^#\/?/, '').toLowerCase();
  const startInside = ROOM_IDS.includes(first) || SECTIONS.includes(first);
  const firstScene = await director.load(startInside ? 'casa' : 'intro', (p) => preloader.set(0.2 + p * 0.78));
  // Se renderiza la escena (aún invisible) detrás de la precarga: shaders y
  // postproceso quedan compilados antes de la primera imagen.
  if (!startInside) engine.setScene(firstScene);
  else gsap.set('#veil', { opacity: 1 });
  await preloader.finish();

  // ---------------------------------------------------------------- rutas
  async function onRoute(route) {
    if (SECTIONS.includes(route)) {
      // Cada sección vive en una sala: si no estamos allí, se va a ella.
      // La cámara va hasta el objeto de la sección y el panel se abre a su lado.
      const i = ROOM_OF[route];
      if (director.name !== 'casa') await director.go('casa', { room: i, instant: true, fade: !!director.current });
      const arrived = director.current.focus(route);
      await Promise.race([arrived, new Promise((r) => setTimeout(r, 1300))]);
      if (router.current !== route) return;
      ctx.panel.open(route, { back: content.casa.rooms[i].back, side: true });
      return;
    }
    ctx.panel.close();
    const room = ROOM_IDS.indexOf(route);
    if (room >= 0) {
      if (director.name === 'casa') {
        const casa = director.current;
        if (casa.state === 'focus') casa.unfocus();
        if (casa.index !== room) casa.goTo(room);
      } else {
        const intro = fromIntro && director.name === 'intro';
        fromIntro = false;
        director.go('casa', { room, from: intro ? 'intro' : null, instant: !intro, fade: !intro && !!director.current });
      }
    }
    if (route === 'inicio' && director.name !== 'intro') director.go('intro', { fade: !!director.current });
  }

  // Cerrar una sección: si se abrió desde la propia web, "atrás" en el
  // historial (coherente con el gesto atrás del teléfono); si se llegó por
  // enlace directo, se sustituye la URL por la de su sala.
  function closeSection() {
    if (router.depth > 0) history.back();
    else router.go(ROOM_IDS[ROOM_OF[router.current]] ?? 'inicio', { replace: true });
  }

  router = new Router(onRoute);
  router.notify(true);
  if (engine.manual) Object.assign(window.__picheta, { director, router, ctx });
}
