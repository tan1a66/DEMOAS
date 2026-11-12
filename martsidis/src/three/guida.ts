/**
 * Il modello come guida fuori dalla Home: intestazioni delle pagine interne e menu a tutto schermo.
 * Stesso modello e stessa trasformazione della Home (massa → modello), poi lo stato della pagina.
 * Il bundle di Three.js si scarica solo qui, quando serve.
 */
import { webglDisponibile, riduciMovimento, disattivatoDaUrl } from './shared/capacita';
import type { IdStato } from './pelvi/stati';

type Opzioni = {
  stato: IdStato;
  /** pagina: si compone all'arrivo e gira con lo scroll · menu: già composto, gira piano da solo */
  modo: 'pagina' | 'menu';
};

export const puoMontare = () => webglDisponibile() && !riduciMovimento() && !disattivatoDaUrl();

export async function montaGuida(host: HTMLElement, { stato, modo }: Opzioni) {
  const { monta } = await import('./esperienza/scena');
  const area = () => ({ x: 0, y: 0, w: host.clientWidth, h: host.clientHeight });
  const scena = await monta(host, { montaggio: modo === 'menu' ? 1 : 0, stato: 'normale', area: area() });
  host.classList.add('is-pronto');

  const fine = new AbortController();
  const { signal } = fine;
  let raf = 0;

  // la trasformazione all'arrivo: dalla massa al modello, poi lo stato della pagina
  const t0 = performance.now();
  const durata = modo === 'menu' ? 0 : 1800;
  const passo = (adesso: number) => {
    const p = durata ? Math.min((adesso - t0) / durata, 1) : 1;
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const giroAuto = modo === 'menu' ? (adesso - t0) / 1000 * 0.18 : 0;
    const giroScroll = modo === 'pagina' ? window.scrollY * 0.0025 : 0;
    scena.comanda({
      montaggio: e,
      stato: p >= 1 ? stato : 'normale',
      giro: giroAuto + giroScroll,
      area: area(),
    });
    if (p < 1 || modo === 'menu') raf = requestAnimationFrame(passo);
  };
  raf = requestAnimationFrame(passo);

  if (modo === 'pagina') {
    const suScroll = () => scena.comanda({ giro: window.scrollY * 0.0025 });
    window.addEventListener('scroll', suScroll, { passive: true, signal });
    new ResizeObserver(() => scena.comanda({ area: area() })).observe(host);
  }

  // trascinando si ruota (sul touch solo in orizzontale: lo scroll verticale resta libero)
  let x0: number | null = null;
  let y0 = 0;
  host.addEventListener('pointerdown', (e) => {
    x0 = e.clientX;
    y0 = e.clientY;
  }, { signal });
  window.addEventListener('pointermove', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    x0 = e.clientX;
    y0 = e.clientY;
    scena.trascina(dx, e.pointerType === 'touch' ? 0 : dy);
  }, { signal });
  window.addEventListener('pointerup', () => (x0 = null), { signal });
  window.addEventListener('pointercancel', () => (x0 = null), { signal });

  return {
    dispose() {
      cancelAnimationFrame(raf);
      fine.abort();
      scena.dispose();
      host.classList.remove('is-pronto');
    },
  };
}
