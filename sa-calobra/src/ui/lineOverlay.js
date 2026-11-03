// La linea che cambia forma sopra la scena 3D (SVG a tutto schermo):
// intro: la M del logo → la strada · INFO MALLORCA: la strada → la linea del tempo.
// Le forme si confrontano punto per punto dopo averle ricampionate alla stessa densità.
import { Vector3 } from 'three';
import { CONFIG } from '../config.js';

/** ricampiona una polilinea [[x,y],…] in n punti equidistanti */
export function resample(pts, n) {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const s = (d[d.length - 1] * k) / (n - 1);
    while (j < d.length - 2 && d[j + 1] < s) j++;
    const t = (s - d[j]) / (d[j + 1] - d[j] || 1);
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t]);
  }
  return out;
}

/** la strada tra s0 e s1 (m) proiettata sullo schermo, in pixel CSS */
export function projectRoad(camera, road, s0, s1, n, W, H) {
  const p = new Vector3(), out = [];
  const lift = CONFIG.road.lift + CONFIG.line.lift;
  for (let k = 0; k < n; k++) {
    road.at(s0 + ((s1 - s0) * k) / (n - 1), p);
    p.y += lift;
    p.project(camera);
    // dietro la camera: spinto fuori dallo schermo nella stessa direzione
    if (p.z > 1) { p.x = -p.x * 4; p.y = -p.y * 4; }
    out.push([(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H]);
  }
  return out;
}

export const lerpPts = (a, b, t) => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]);

export function createLineOverlay() {
  const svg = document.getElementById('morph');
  const [road, dash, glow, line] = ['road', 'dash', 'glow', 'line'].map((k) => svg.querySelector(`.morph__${k}`));
  const toAttr = (pts) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const resize = () => svg.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
  addEventListener('resize', resize);
  resize();
  return {
    show() { resize(); svg.style.visibility = 'visible'; },
    hide() { svg.style.visibility = 'hidden'; },
    /**
     * pts: punti in pixel CSS · style: spessori (px) e opacità di asfalto, mezzeria, alone e linea
     */
    draw(pts, s) {
      const a = toAttr(pts);
      for (const el of [road, dash, glow, line]) el.setAttribute('points', a);
      road.style.strokeWidth = s.roadWidth ?? 0;
      road.style.opacity = s.roadOpacity ?? 0;
      dash.style.strokeWidth = s.dashWidth ?? 0;
      dash.style.opacity = s.dashOpacity ?? 0;
      dash.style.strokeDasharray = s.dash ?? 'none';
      line.style.strokeWidth = s.lineWidth ?? CONFIG.line.width;
      line.style.opacity = s.lineOpacity ?? 1;
      glow.style.strokeWidth = (s.lineWidth ?? CONFIG.line.width) * CONFIG.line.haloWidth;
      glow.style.opacity = (s.lineOpacity ?? 1) * 0.22;
    },
  };
}
