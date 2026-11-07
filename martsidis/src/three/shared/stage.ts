import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { config } from '@/config';
import { isMobile } from './capacita';

export type Stage = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  canvas: HTMLCanvasElement;
  /** Registra una funzione chiamata a ogni fotogramma (dt e tempo in secondi). */
  onFrame: (fn: (dt: number, t: number) => void) => void;
  /** Disegna un solo fotogramma (es. dopo un cambio di stato con animazioni spente). */
  renderOnce: () => void;
  /** Forza il ciclo attivo per un po' (es. durante una transizione), anche se la scena è "ferma". */
  sveglia: () => void;
  dispose: () => void;
};

type Opzioni = {
  fov?: number;
  /** Se false il ciclo si ferma quando non ci sono animazioni in corso (risparmio batteria). */
  continuo?: boolean;
};

/**
 * Crea renderer + scena + camera dentro `host` e gestisce:
 * - devicePixelRatio limitato (2 desktop, 1.5 mobile);
 * - ridimensionamento con il contenitore;
 * - pausa quando il canvas è fuori schermo o la scheda non è attiva.
 */
export function creaStage(host: HTMLElement, { fov = 35, continuo = true }: Opzioni = {}): Stage {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  const dprMax = isMobile() ? config.dprMax.mobile : config.dprMax.desktop;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprMax));
  renderer.setClearColor(0x000000, 0);

  const canvas = renderer.domElement;
  canvas.classList.add('stage-canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(fov, 1, 0.1, 100);

  const callbacks: Array<(dt: number, t: number) => void> = [];
  let visibile = false;
  let paginaVisibile = !document.hidden;
  let attivoFinoA = 0;
  let ultimo = performance.now();
  let tempo = 0;

  const disegna = () => renderer.render(scene, camera);

  const tick = (adesso: number) => {
    const dt = Math.min((adesso - ultimo) / 1000, 1 / 20);
    ultimo = adesso;
    tempo += dt;
    for (const fn of callbacks) fn(dt, tempo);
    disegna();
    if (!continuo && adesso > attivoFinoA) renderer.setAnimationLoop(null);
  };

  const aggiornaCiclo = () => {
    const deveGirare = visibile && paginaVisibile && (continuo || performance.now() < attivoFinoA);
    if (deveGirare) {
      ultimo = performance.now();
      renderer.setAnimationLoop(tick);
    } else {
      renderer.setAnimationLoop(null);
    }
  };

  const ridimensiona = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    disegna();
  };

  const ro = new ResizeObserver(ridimensiona);
  ro.observe(host);

  const io = new IntersectionObserver(
    (entries) => {
      visibile = entries.some((e) => e.isIntersecting);
      aggiornaCiclo();
    },
    { threshold: 0 },
  );
  io.observe(host);

  const suVisibilita = () => {
    paginaVisibile = !document.hidden;
    aggiornaCiclo();
  };
  document.addEventListener('visibilitychange', suVisibilita);

  ridimensiona();

  return {
    renderer,
    scene,
    camera,
    canvas,
    onFrame: (fn) => callbacks.push(fn),
    renderOnce: disegna,
    sveglia: () => {
      attivoFinoA = performance.now() + 2500;
      aggiornaCiclo();
    },
    dispose: () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', suVisibilita);
      renderer.dispose();
      canvas.remove();
    },
  };
}
