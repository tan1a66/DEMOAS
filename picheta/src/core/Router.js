import { ROOMS } from '../scenes/casa/rooms.js';

// Rutas con hash: cada sala y cada sección tiene su URL (/#salon, /#menu…) para
// poder compartirla, y el botón "atrás" del teléfono vuelve al estado anterior.
export const ROOM_IDS = ROOMS.map((r) => r.id);
export const SECTIONS = ['historia', 'autores', 'menu', 'reserva', 'concurso', 'eventos'];
export const ROUTES = ['inicio', ...ROOM_IDS, ...SECTIONS];

export class Router {
  constructor(onChange) {
    this.onChange = onChange;
    this.last = null;
    // Entradas de historial creadas por la propia web (para saber si "volver" = history.back()).
    this.depth = 0;
    const check = () => this.notify();
    window.addEventListener('hashchange', check);
    window.addEventListener('popstate', () => {
      this.depth = Math.max(0, this.depth - 1);
      check();
    });
  }

  get current() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, '')).toLowerCase();
    return ROUTES.includes(h) ? h : 'inicio';
  }

  go(route, { replace = false } = {}) {
    const url = route === 'inicio' ? location.pathname + location.search : `#${route}`;
    if (route === this.current && this.last === route) return;
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
    if (!replace) this.depth++;
    this.notify();
  }

  notify(force = false) {
    const route = this.current;
    if (!force && route === this.last) return;
    const prev = this.last;
    this.last = route;
    this.onChange(route, prev);
  }
}
