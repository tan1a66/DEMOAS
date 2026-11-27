import { PHASES, WIPE_X } from '../phases.js';

// Coreografía: para cada herramienta, una pista de fotogramas clave ligados al scroll.
// Las posiciones van en coordenadas normalizadas de la ventana (x, y ∈ −1..1),
// z en unidades de mundo (0 = plano de enfoque) y s = escala relativa.

export const TOOL_SIZE = {
  guasha: 3.0,
  micro: 2.7,
  ball: 1.3,
  tube: 1.8,
  can: 1.9,
  polish: 1.35,
  drop: 1.3,
  serum: 1.6,
};

export const WIPE = { z: 2, s: 2.25 };

const TAU = Math.PI * 2;
const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t * t,
};

const P = (x, y, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => ({ x, y, z, rx, ry, rz, s });
const lerp = (a, b, t) => a + (b - a) * t;
export const lerpPose = (a, b, t) => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
  rx: lerp(a.rx, b.rx, t),
  ry: lerp(a.ry, b.ry, t),
  rz: lerp(a.rz, b.rz, t),
  s: lerp(a.s, b.s, t),
  still: lerp(+(a.still || 0), +(b.still || 0), t),
});

const resolve = (pose, ctx) => (typeof pose === 'function' ? pose(ctx) : pose);

export const evalTrack = (track, ctx) => {
  const s = ctx.scroll;
  let i = 0;
  while (i < track.length - 1 && s >= track[i + 1].at) i++;
  const a = track[i];
  if (i === track.length - 1 || s <= a.at) return resolve(a.pose, ctx);
  const b = track[i + 1];
  if (b.jump) return resolve(a.pose, ctx);
  const t = (s - a.at) / Math.max(1, b.at - a.at);
  return lerpPose(resolve(a.pose, ctx), resolve(b.pose, ctx), (b.ease || ease.inOut)(t));
};

// Punto (ax, ay) relativo a un rectángulo del documento → coordenadas normalizadas actuales
const anchor = (rect, ax, ay, ctx) => {
  const px = rect.x + ax * rect.w;
  const py = rect.y + ay * rect.h - ctx.scroll;
  return { x: (px / ctx.view.w) * 2 - 1, y: 1 - (py / ctx.view.h) * 2 };
};

const anchored = (rectKey, ax, ay, rest, scaleFn) => (ctx) => {
  const a = anchor(ctx.L[rectKey], ax, ay, ctx);
  const s = scaleFn ? scaleFn(ctx) * rest.s : rest.s;
  return { ...rest, x: a.x + (rest.dx || 0), y: a.y + (rest.dy || 0), s };
};

// ——— Poses de escritorio ———
const HERO_D = {
  guasha: P(-0.92, -0.02, 0.6, 0.1, 0.35, 0.07, 1.36),
  micro: P(0.7, 0.46, -0.7, 0.35, 0.2, -0.9, 1.18),
  ball: P(0.8, -0.42, 0.9, 0.2, 0.5, 0.55, 1.0),
  tube: P(-0.5, 0.7, -2.8, 0.2, 0.3, 1.2, 1.15),
  can: P(0.95, 0.1, 1.7, 0.3, -0.55, -0.25, 1.0),
  polish: P(-0.58, -0.62, 1.8, 0.5, 0.5, 0.55, 1.0),
  drop: P(0.47, 0.8, 1.4, 0.3, 0.4, 0.4, 0.9),
  serum: P(-0.68, 0.5, -0.2, 0.45, 0.2, -0.4, 1.0),
};

// Mitad derecha: "Tech & boosters"
const SPLIT_D = {
  micro: P(0.36, 0.5, -0.9, 0.4, 0.3, -0.75, 0.9),
  ball: P(0.86, 0.38, 0.2, 0.25, 0.6, 0.4, 0.8),
  can: P(0.87, -0.42, 0.9, 0.4, -0.4, -0.35, 0.72),
  drop: P(0.52, -0.64, 0.4, 0.5, 0.2, 0.3, 0.72),
  serum: P(0.62, 0.68, -1.4, 0.5, 0.2, 0.2, 0.76),
};

// En órbita alrededor de FACE WORKOUT. La gota y el sérum se "funden" en la palabra
// (reaparecen saliendo de la foto del masaje Deep Lift); el tubo y el esmalte vuelven a escena.
const ORBITERS_D = ['micro', 'ball', 'can', 'tube', 'polish'];

// Poses móviles (4 piezas)
const HERO_M = {
  guasha: P(-1.02, 0.02, 0.4, 0.1, 0.35, 0.06, 0.95),
  micro: P(0.74, 0.74, -1.2, 0.25, 0.4, -1.15, 0.5),
  drop: P(0.62, -0.76, 0.4, 0.55, 0.3, 0.35, 0.58),
  serum: P(-0.5, -0.78, 0.0, 0.5, 0.2, -0.4, 0.56),
};
const SPLIT_M = {
  micro: P(-0.62, -0.74, 0.2, 0.3, 0.5, 0.9, 0.42),
  drop: P(0.62, -0.7, 0.4, 0.5, 0.3, 0.3, 0.46),
  serum: P(0.02, -0.86, -0.6, 0.5, 0.2, -0.3, 0.42),
};
const ORBITERS_M = ['micro', 'guasha'];

export const buildTracks = (L, ids) => {
  const { mobile, vh } = L;
  const S = (f) => L.stage.start + f * (L.stage.end - L.stage.start);
  const HERO = mobile ? HERO_M : HERO_D;
  const SPLIT = mobile ? SPLIT_M : SPLIT_D;
  const ORBITERS = mobile ? ORBITERS_M : ORBITERS_D;
  const tracks = {};

  // Órbita alrededor de FACE WORKOUT (sube con la sección al soltarse el pin)
  const orbit = (k) => (ctx) => {
    const n = ORBITERS.length;
    const th = (k / n) * TAU + ctx.t * 0.17;
    const lift = (Math.max(0, ctx.scroll - L.stage.end) / vh) * 2;
    const rx = mobile ? 0.9 : 0.93;
    const ry = mobile ? 0.42 : 0.46;
    return {
      x: Math.cos(th) * rx,
      y: L.wordY + Math.sin(th) * ry + lift,
      z: -Math.sin(th) * (mobile ? 1.6 : 2.6),
      rx: 0.5 * Math.sin(ctx.t * 0.3 + k),
      ry: ctx.t * 0.22 + k,
      rz: th + Math.PI / 2,
      s: mobile ? 0.4 : 0.66,
    };
  };

  const merge = (k) => {
    const n = ORBITERS.length;
    const a = (k / n) * TAU;
    return P(Math.cos(a) * 0.1, L.wordY + Math.sin(a) * 0.1, -2.2 + (k % 3) * 0.6, 0.4, a, a, 0.34);
  };

  // Círculo final alrededor del botón "Reserva tu glow"
  const N = ids.length;
  const ring = (k, spread) => (ctx) => {
    const a = anchor(L.button, 0.5, 0.5, ctx);
    const th = (k / N) * TAU + ctx.t * 0.085 + (spread > 1 ? 0.6 : 0);
    const R = Math.min(L.vw, vh) * (mobile ? 0.4 : 0.3) * spread;
    return {
      x: a.x + ((Math.cos(th) * R) / L.vw) * 2,
      y: a.y + ((Math.sin(th) * R) / vh) * 2,
      z: spread > 1 ? -3.5 : Math.sin(th) * 0.5,
      rx: 0.35,
      ry: ctx.t * 0.15 + k,
      rz: th + Math.PI / 2,
      s: (mobile ? 0.36 : 0.5) * (spread > 1 ? 0.7 : 1),
    };
  };
  const finalIn = Math.min(L.final.y - vh * 0.2, L.maxScroll - 4);
  const finalKeys = (k) => [
    { at: L.final.y - vh * 1.05, pose: ring(k, 2.6), jump: true },
    { at: finalIn, pose: ring(k, 1), ease: ease.out },
  ];

  const treatVis = (ctx) => ctx.params.treatVis;
  const TREAT = mobile
    ? {
        guasha: anchored('grid', 0.08, 0.2, P(0, 0, -1.6, 0.3, 0.4, -0.45, 0.9), treatVis),
        micro: anchored('grid', 0.9, 0.62, P(0, 0, -1.8, 0.2, 0.5, 0.9, 0.75), treatVis),
      }
    : {
        guasha: anchored('grid', 0.3, 0.3, P(0, 0, -1.6, 0.3, 0.4, -0.95, 1.25), treatVis),
        micro: anchored('grid', 0.97, 0.42, P(0, 0, -1.4, 0.3, -0.4, 0.4, 1.15), treatVis),
        ball: anchored('grid', 0.8, 0.88, P(0, 0, -0.8, 0.2, 0.5, 1.3, 1.0), treatVis),
      };
  const treatKeys = (id) =>
    TREAT[id] ? [{ at: L.grid.y - vh * 1.1, pose: TREAT[id], jump: true }, { at: L.grid.y + L.grid.h + vh * 0.2, pose: TREAT[id] }] : [];

  // El espacio: la gota y el sérum salen de la foto del masaje (de las manos)
  const ABOUT = {
    drop: {
      hidden: anchored('photo', 0.62, 0.42, P(0, 0, -2.5, 0.2, 0, 0, 0.02)),
      out: anchored('photo', 0.98, 0.26, P(0, 0, 1.8, 0.55, 0.5, -0.45, mobile ? 0.5 : 0.72)),
      far: anchored('photo', 1.08, 0.05, P(0, 0, 2.6, 0.8, 1.2, -0.7, mobile ? 0.52 : 0.76)),
    },
    serum: {
      hidden: anchored('photo', 0.42, 0.48, P(0, 0, -2.5, 0.2, 0, 0, 0.02)),
      out: anchored('photo', 0.06, 0.82, P(0, 0, 2.2, -0.35, 0.4, 0.5, mobile ? 0.48 : 0.66)),
      far: anchored('photo', -0.04, 0.62, P(0, 0, 3.0, -0.6, 1.0, 0.8, mobile ? 0.5 : 0.7)),
    },
  };
  const aboutKeys = (id) => {
    const A = ABOUT[id];
    if (!A) return [];
    const ph = L.photo;
    return [
      { at: ph.y - vh * 0.85, pose: A.hidden, jump: true },
      { at: ph.y - vh * 0.42 + ph.h * 0.25, pose: A.out, ease: ease.out },
      { at: ph.y + ph.h, pose: A.far, ease: ease.inOut },
    ];
  };

  const exitAt = L.stage.end + vh * 1.2;
  const fused = (k) => ({ ...merge(k), s: 0.0, z: -3 });

  for (const id of ids) {
    const k = ORBITERS.indexOf(id);
    const inSplit = !!SPLIT[id];
    let track;
    if (id === 'guasha') {
      const wipeA = { x: WIPE_X.from, y: 0, z: WIPE.z, rx: 0, ry: 0.2, rz: 0, s: WIPE.s, still: true };
      const wipeB = { ...wipeA, x: WIPE_X.to };
      track = [
        { at: S(0), pose: HERO.guasha },
        { at: S(PHASES.wipe0), pose: wipeA, ease: ease.inOut },
        { at: S(PHASES.wipe1), pose: wipeB, ease: ease.linear },
      ];
      if (k >= 0) {
        // (móvil) vuelve a escena ya pequeño para orbitar
        track.push(
          { at: S(PHASES.merge1), pose: { ...wipeB, x: 1.7, s: 0.5, rz: 1.2 } },
          { at: S(PHASES.word), pose: orbit(k), ease: ease.out },
          { at: exitAt, pose: orbit(k) }
        );
      }
    } else if (inSplit) {
      track = [
        { at: S(0), pose: HERO[id] },
        { at: S(PHASES.wipe1 - 0.02), pose: SPLIT[id], ease: ease.inOut },
        { at: S(PHASES.merge0), pose: SPLIT[id] },
      ];
      if (k >= 0) {
        track.push(
          { at: S(PHASES.merge1), pose: merge(k), ease: ease.inOut },
          { at: S(PHASES.word), pose: orbit(k), ease: ease.out },
          { at: exitAt, pose: orbit(k) }
        );
      } else {
        const m = merge(ids.indexOf(id) % 6);
        track.push(
          { at: S(PHASES.merge1), pose: m, ease: ease.inOut },
          { at: S((PHASES.merge1 + PHASES.word) / 2), pose: fused(ids.indexOf(id) % 6), ease: ease.in }
        );
      }
    } else {
      // Se apartan durante el barrido; si orbitan, vuelven desde arriba al formarse la palabra
      const h = HERO[id];
      const away = { ...h, y: h.y + 2.3, z: h.z - 2, rz: h.rz + 1.2 };
      track = [
        { at: S(0), pose: h },
        { at: S(PHASES.wipe1 * 0.7), pose: away, ease: ease.in },
      ];
      if (k >= 0) {
        track.push(
          { at: S(PHASES.merge1), pose: { ...away, x: k % 2 ? 0.5 : -0.5, y: 1.9 } },
          { at: S(PHASES.word), pose: orbit(k), ease: ease.out },
          { at: exitAt, pose: orbit(k) }
        );
      }
    }
    track.push(...aboutKeys(id), ...treatKeys(id), ...finalKeys(ids.indexOf(id)));
    track.sort((a, b) => a.at - b.at);
    tracks[id] = track;
  }
  return tracks;
};
