import { useEffect, useRef, type CSSProperties } from 'react';
import { Picture } from './Picture';
import { PHOTOS } from '../data/photos';
import { depthUrl, type DepthId } from '../data/depth';
import { DepthRenderer, webgl2Supported } from '../lib/depthRenderer';
import { listenMotion, motionTarget } from '../lib/motion';
import { useReducedMotion } from '../lib/hooks';

/** Estado de desplazamiento que recibe la cámara en cada fotograma. */
export interface CameraState {
  /** 0 con el borde superior de la foto arriba de la pantalla → 1 cuando ya salió por arriba. */
  exit: number;
  /** 0 cuando la foto asoma por abajo → 1 cuando sale por arriba. */
  through: number;
  /** Segundos desde que la foto cobró vida. */
  time: number;
}

/** Movimiento extra de la cámara: dolly (acercarse), desplazamiento (uv) y titileo de luces. */
export interface CameraMove {
  dolly?: number;
  x?: number;
  y?: number;
  sparkle?: number;
}

interface DepthPhotoProps {
  id: DepthId;
  sizes: string;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
  decorative?: boolean;
  /** Encuadre forzado (object-position) en lugar del de la foto. */
  position?: string;
  /** Amplitud del paralaje con el ratón o el giroscopio (en uv de pantalla). */
  strength?: number;
  /** Profundidad que no se mueve (0 lejos · 1 cerca). */
  focus?: number;
  /** Curva aplicada al mapa (< 1 separa más los planos lejanos). */
  curve?: number;
  /** Deriva lenta cuando no hay movimiento (multiplicador). */
  drift?: number;
  /** Centro hacia el que avanza el dolly (uv de la foto). */
  dollyCenter?: [number, number];
  /** Cámara guiada por el desplazamiento o por la escena. */
  camera?: (s: CameraState) => CameraMove;
  /** false: la foto queda fija y sin WebGL (por ejemplo, mientras otra capa la tapa). */
  active?: boolean;
  /** Se consulta en cada fotograma: false = no dibujar (capa invisible en ese momento). */
  enabled?: () => boolean;
}

/** Margen de encuadre para una amplitud dada (el lienzo y la foto de respaldo usan el mismo). */
export const overscanFor = (strength: number) => 1 + strength * 2.6;

let supported: boolean | null = null;
/** Si un dispositivo no sostiene el efecto ni en calidad mínima, se apaga para toda la visita. */
let degraded = false;
/** ?gl=force: efecto siempre activo y sin ajuste automático (revisión en máquinas sin GPU). */
const FORCED = typeof location !== 'undefined' && new URLSearchParams(location.search).get('gl') === 'force';
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const parsePos = (p: string): [number, number] => {
  const [x = '50%', y = '50%'] = p.trim().split(/\s+/);
  return [parseFloat(x) / 100, parseFloat(y) / 100];
};

/**
 * Fotografía real con profundidad: debajo, la <Picture> normal (carga rápida, texto alternativo, respaldo);
 * encima, un lienzo WebGL2 que reutiliza esa misma imagen y su mapa de profundidad para mover la cámara dentro
 * de la foto. El contexto WebGL se crea solo cuando la foto está cerca de la pantalla y se libera al alejarse.
 * Sin WebGL2 o con movimiento reducido, queda la fotografía tal cual.
 */
export function DepthPhoto({
  id,
  sizes,
  className = '',
  style,
  priority = false,
  decorative = false,
  position,
  strength = 0.022,
  focus = 0.45,
  curve = 0.7,
  drift = 1,
  dollyCenter = [0.5, 0.5],
  camera,
  active = true,
  enabled,
}: DepthPhotoProps) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const params = useRef({ strength, focus, curve, drift, dollyCenter, position });
  params.current = { strength, focus, curve, drift, dollyCenter, position };

  // Margen de encuadre para que el paralaje nunca muestre los bordes de la foto.
  const overscan = overscanFor(strength);

  useEffect(() => {
    if (reduced || !active || degraded) return;
    supported ??= webgl2Supported();
    if (!supported) return;
    const root = rootRef.current;
    const media = mediaRef.current;
    if (!root || !media) return;
    listenMotion();

    const photo = PHOTOS[id];
    const compact = matchMedia('(max-width: 760px)').matches;
    let renderer: DepthRenderer | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let depthImg: HTMLImageElement | null = null;
    let near = false;
    let visible = false;
    let cancelled = false;
    let raf = 0;
    let born = 0;
    let map: [number, number, number, number] = [0, 0, 1, 1];
    const cur = { x: 0, y: 0 };
    // Calidad adaptable: si los fotogramas tardan, baja la resolución y los pasos; si no basta, se apaga.
    let quality = 1;
    let lastFrame = 0;
    const slow: number[] = [];

    const measure = () => {
      if (!renderer || !canvas) return;
      const w = root.clientWidth;
      const h = root.clientHeight;
      let dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.5) * quality;
      if (w * h * dpr * dpr > 2_600_000) dpr = Math.sqrt(2_600_000 / (w * h));
      renderer.resize(Math.max(2, Math.round(w * dpr)), Math.max(2, Math.round(h * dpr)));
      // Mismo encuadre que object-fit: cover + object-position + el margen (escala desde el centro).
      const pos = parsePos(params.current.position ?? (compact ? (photo.positionCompact ?? photo.position) : photo.position) ?? '50% 50%');
      const imgAR = photo.width / photo.height;
      const canAR = w / Math.max(1, h);
      let sx = 1;
      let sy = 1;
      if (canAR > imgAR) sy = imgAR / canAR;
      else sx = canAR / imgAR;
      const ox = (1 - sx) * pos[0];
      const oy = (1 - sy) * pos[1];
      const k = overscanFor(params.current.strength);
      map = [ox + (sx - sx / k) / 2, oy + (sy - sy / k) / 2, sx / k, sy / k];
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!renderer || !visible || document.hidden || enabledRef.current?.() === false) {
        lastFrame = 0;
        return;
      }
      const now = performance.now();
      if (lastFrame && !FORCED) {
        slow.push(now - lastFrame);
        if (slow.length >= 24) {
          const sorted = [...slow].sort((a, b) => a - b);
          const median = sorted[12] ?? 0;
          slow.length = 0;
          if (median > 34) {
            if (quality > 0.55) {
              quality *= 0.75;
              renderer.steps = Math.max(10, Math.round(renderer.steps * 0.75));
              measure();
            } else {
              degraded = true;
              destroy();
              return;
            }
          }
        }
      }
      lastFrame = now;
      const t = (now - born) / 1000;
      const p = params.current;
      const m = motionTarget();
      cur.x += (m.x - cur.x) * 0.055;
      cur.y += (m.y - cur.y) * 0.055;
      const r = root.getBoundingClientRect();
      const vh = window.innerHeight;
      const exit = clamp01(-r.top / Math.max(1, r.height));
      const through = clamp01((vh - r.top) / (vh + r.height));
      const mv = cameraRef.current?.({ exit, through, time: t }) ?? {};
      // Deriva: respiración lenta de la cámara, que entra de forma progresiva.
      const amp = p.drift * Math.min(1, t / 2.5);
      const dx = (Math.sin(t * 0.23) * 0.45 + Math.sin(t * 0.11 + 1.7) * 0.25) * amp;
      const dy = Math.cos(t * 0.17 + 0.4) * 0.3 * amp;
      renderer.render({
        map,
        // La cámara va hacia el ratón: lo cercano se desplaza en sentido contrario.
        offset: [-(cur.x + dx) * p.strength + (mv.x ?? 0), -(cur.y + dy) * p.strength * 0.6 + (mv.y ?? 0)],
        dolly: mv.dolly ?? 0,
        focus: p.focus,
        dollyCenter: p.dollyCenter,
        time: t,
        sparkle: mv.sparkle ?? 0,
        curve: p.curve,
      });
    };

    const destroy = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      renderer?.dispose();
      renderer = null;
      root.classList.remove('is-live');
      const old = canvas;
      canvas = null;
      // El lienzo se retira tras el fundido (un contexto perdido no se puede reutilizar).
      if (old) window.setTimeout(() => old.remove(), 700);
    };

    const create = async () => {
      if (renderer || cancelled) return;
      const img = imgRef.current;
      if (!img) return;
      if (!img.complete || !img.naturalWidth) {
        await new Promise<void>((res) => img.addEventListener('load', () => res(), { once: true }));
      }
      try {
        if (!depthImg) {
          const d = new Image();
          d.decoding = 'async';
          d.src = depthUrl(id);
          await d.decode();
          depthImg = d;
        }
        await img.decode().catch(() => undefined);
      } catch {
        return; // sin mapa de profundidad: queda la foto
      }
      if (cancelled || !near || renderer) return;
      const c = document.createElement('canvas');
      c.className = 'depth__canvas';
      c.setAttribute('aria-hidden', 'true');
      c.addEventListener(
        'webglcontextlost',
        (e) => {
          e.preventDefault();
          destroy();
        },
        { once: true },
      );
      try {
        renderer = new DepthRenderer(c, img, depthImg, compact ? 14 : 26);
      } catch {
        renderer = null;
        return;
      }
      canvas = c;
      media.appendChild(c);
      born = performance.now();
      measure();
      frame();
      requestAnimationFrame(() => root.classList.add('is-live'));
    };

    const nearIo = new IntersectionObserver(
      ([e]) => {
        near = Boolean(e?.isIntersecting);
        if (near) void create();
        else destroy();
      },
      { rootMargin: '60% 0px' },
    );
    const visIo = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
    });
    const ro = new ResizeObserver(measure);
    nearIo.observe(root);
    visIo.observe(root);
    ro.observe(root);

    return () => {
      cancelled = true;
      nearIo.disconnect();
      visIo.disconnect();
      ro.disconnect();
      destroy();
    };
  }, [id, reduced, active]);

  return (
    <div ref={rootRef} className={`depth ${className}`} style={{ '--overscan': reduced ? 1 : overscan, ...style } as CSSProperties}>
      <div ref={mediaRef} className="depth__media">
        <Picture id={id} sizes={sizes} priority={priority} decorative={decorative} imgRef={imgRef} {...(position ? { position } : {})} />
      </div>
    </div>
  );
}
