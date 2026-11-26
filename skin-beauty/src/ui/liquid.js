// Líneas líquidas rosas (drenaje linfático): flujo continuo en la mitad izquierda
// (arriba en móvil). "merge" las lleva al centro cuando las dos técnicas se funden.

export const createLiquid = (canvas, { mobile }) => {
  const ctx = canvas.getContext('2d');
  const N = mobile ? 10 : 16;
  const lines = Array.from({ length: N }, (_, i) => {
    const r = (k) => {
      const x = Math.sin((i + 1) * 91.17 + k * 13.7) * 9137.31;
      return x - Math.floor(x);
    };
    return {
      base: N === 1 ? 0.5 : i / (N - 1),
      seed: r(1) * 10,
      speed: 0.28 + r(2) * 0.35,
      width: 0.8 + r(3) * 2.2,
      alpha: 0.22 + r(4) * 0.5,
      amp: 0.5 + r(5) * 0.8,
      drop: r(6),
    };
  });
  const state = { merge: 0, alpha: 1, running: false };
  let w = 0;
  let h = 0;
  let dpr = 1;
  let t = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
  };

  // u: a lo largo del flujo (0..1), v: posición transversal (0..1) → píxeles
  const map = (u, v) => (mobile ? [u * w, v * h] : [v * w, u * h]);

  const draw = (dt) => {
    t += dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (state.alpha <= 0.01) return;
    ctx.globalAlpha = state.alpha;
    ctx.lineCap = 'round';
    const m = state.merge;
    const along = mobile ? w : h;
    const steps = 34;
    for (const L of lines) {
      // banda: mitad izquierda / superior, centrada en 0.25 → con merge, al centro
      const spread = 0.42 * (1 - m * 0.82);
      const center = 0.25 + 0.25 * m;
      const v0 = center + (L.base - 0.5) * spread;
      const grad = mobile ? ctx.createLinearGradient(0, 0, w, 0) : ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, `rgba(168,112,111,${L.alpha * 0.2})`);
      grad.addColorStop(0.5, `rgba(168,112,111,${L.alpha})`);
      grad.addColorStop(1, `rgba(201,154,154,${L.alpha * 0.25})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = L.width * (1 + m * 0.4);
      ctx.beginPath();
      let px = 0;
      let py = 0;
      for (let s = 0; s <= steps; s++) {
        const u = -0.05 + (s / steps) * 1.1;
        const y = u * along;
        const wave =
          Math.sin(y * 0.0062 + t * L.speed * 1.4 + L.seed) * 0.045 * L.amp +
          Math.sin(y * 0.0141 - t * L.speed * 1.9 + L.seed * 2.3) * 0.018 * L.amp;
        // Con merge, las líneas se estrechan hacia el centro como un río que se une
        const pinch = 1 - m * 0.75 * Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
        const v = center + (v0 - center) * pinch + wave * (1 - m * 0.5);
        const [x, yy] = map(u, v);
        if (s === 0) ctx.moveTo(x, yy);
        else ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + yy) / 2);
        px = x;
        py = yy;
      }
      ctx.stroke();

      // Gotas que recorren cada línea
      const du = ((t * L.speed * 0.09 + L.drop) % 1.1) - 0.05;
      const y = du * along;
      const wave =
        Math.sin(y * 0.0062 + t * L.speed * 1.4 + L.seed) * 0.045 * L.amp +
        Math.sin(y * 0.0141 - t * L.speed * 1.9 + L.seed * 2.3) * 0.018 * L.amp;
      const pinch = 1 - m * 0.75 * Math.sin(Math.PI * Math.min(1, Math.max(0, du)));
      const v = center + (v0 - center) * pinch + wave * (1 - m * 0.5);
      const [dx, dy] = map(du, v);
      ctx.fillStyle = `rgba(168,112,111,${Math.min(1, L.alpha + 0.3)})`;
      ctx.beginPath();
      ctx.arc(dx, dy, 1.6 + L.width * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  resize();
  return { state, resize, draw };
};
