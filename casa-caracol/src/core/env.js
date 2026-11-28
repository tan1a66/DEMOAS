// Detección del entorno: una sola vez al arrancar.

const params = new URLSearchParams(location.search);
const mq = (q) => window.matchMedia?.(q).matches ?? false;

const touch = mq('(hover: none) and (pointer: coarse)');
const ua = navigator.userAgent;
const ios = /iP(hone|ad|od)/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);

const hasWebGL = () => {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
};

export const ENV = {
  debug: params.has('debug'),
  touch,
  ios,
  mobile: touch || Math.min(screen.width, screen.height) < 700,
  reducedMotion: mq('(prefers-reduced-motion: reduce)') || params.has('reduced'),
  webgl: !params.has('nogl') && hasWebGL(),
  dpr: Math.min(window.devicePixelRatio || 1, 2),
};
