// Interpolaciones mínimas (sin dependencias) con promesas.
import { motion } from '../config.js?v=2';

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outBack: (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

const active = new Set();

// tween({ duration, ease, delay, onUpdate(v, t) }) -> Promise. Devuelve también .cancel().
export function tween({ duration = 1, delay = 0, easing = ease.inOutCubic, from = 0, to = 1, onUpdate, reduce = true } = {}) {
  const k = reduce ? motion.k : 1;
  const dur = Math.max(0.0001, duration * k) * 1000;
  const del = delay * k * 1000;
  let raf = 0;
  let cancelled = false;
  let resolveFn;
  const p = new Promise((resolve) => {
    resolveFn = resolve;
    const start = performance.now() + del;
    const step = (now) => {
      if (cancelled) return;
      const tt = Math.min(1, Math.max(0, (now - start) / dur));
      if (now >= start) onUpdate?.(from + (to - from) * easing(tt), tt);
      if (tt < 1) raf = requestAnimationFrame(step);
      else { active.delete(handle); resolve(); }
    };
    raf = requestAnimationFrame(step);
  });
  const handle = {
    cancel() { cancelled = true; cancelAnimationFrame(raf); active.delete(handle); resolveFn(); },
  };
  active.add(handle);
  p.cancel = handle.cancel;
  return p;
}

export function wait(seconds, reduce = true) {
  const ms = seconds * (reduce ? motion.k : 1) * 1000;
  return new Promise((r) => setTimeout(r, ms));
}

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
