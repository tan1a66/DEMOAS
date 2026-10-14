import { env } from './env';
import { irA, type SeccionId } from './scroll';

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Salto con fundido a negro: para quien regresa y solo quiere pedir, sin atravesar todo el ritual
 * a toda velocidad (ni cargar de golpe todas las escenas 3D intermedias).
 */
export async function saltarA(id: SeccionId, avance = 0) {
  const velo = document.querySelector<HTMLElement>('.velo');
  if (!velo || env.movimientoReducido) {
    irA(id, { avance, inmediato: true });
    return;
  }
  velo.classList.add('velo--activo');
  await espera(550);
  irA(id, { avance, inmediato: true });
  await espera(120);
  velo.classList.remove('velo--activo');
}
