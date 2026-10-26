// ALESSIA STUDIO liquido: il titolo resta testo vero nel DOM (screen reader, selezione, SEO), ma
// viene disegnato in una texture e mostrato da un piccolo canvas WebGL nella stessa posizione.
// Passando col mouse o col dito il testo si deforma come un liquido (si trascina nella direzione
// del gesto, con increspature che si allargano) e torna fermo in meno di un secondo.
// Ogni tanto il titolo fa da sé una piccola onda (un invito a giocarci), anche dopo averlo toccato;
// mentre qualcuno ci gioca, l'onda aspetta.
// Senza WebGL2 o con "riduci movimento" resta il testo normale.

const MAX_PTS = 16;
const LIFE = 1.3; // s: oltre, un punto della scia non deforma più

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

// coordinate in px CSS del canvas, y verso il basso (come il DOM)
const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uText;
uniform vec2 uSize;     // px CSS
uniform float uDpr;
uniform float uFs;      // corpo del titolo (px)
uniform vec4 uPt[${MAX_PTS}];  // xy posizione, zw velocità (px/s)
uniform vec2 uAge[${MAX_PTS}]; // x età (s), y forza (0 = slot vuoto)
out vec4 outColor;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 off = vec2(0.0);
  // scala dell'effetto: il corpo del titolo, ma mai più piccola di un polpastrello (telefono)
  float S = max(uFs, 78.0);
  float R = S * 0.55;
  for (int i = 0; i < ${MAX_PTS}; i++) {
    float k = uAge[i].y;
    if (k <= 0.0) continue;
    float a = uAge[i].x;
    vec2 d = p - uPt[i].xy;
    float dist = length(d);
    float life = exp(-a * 3.4) * k;
    float fall = exp(-dist * dist / (R * R));
    // goccia: sotto il dito il testo si gonfia come visto attraverso l'acqua
    off -= d * (0.38 * fall * life);
    // scia: il liquido segue il gesto (si campiona da dietro)
    off -= uPt[i].zw * (0.085 * fall * life);
    // increspatura che si allarga dal punto toccato
    float front = dist - a * S * 2.4;
    float ring = sin(front / (S * 0.11)) * exp(-front * front / (S * S * 0.09));
    off += (d / max(dist, 1e-3)) * ring * S * 0.06 * life * exp(-dist / (S * 2.2));
  }
  float l = length(off), lim = S * 0.45;
  if (l > lim) off *= lim / l;
  vec4 c = texture(uText, (p + off) / uSize);
  // un filo di luce dove il liquido si muove
  c.rgb += vec3(0.16) * c.a * smoothstep(S * 0.02, S * 0.25, l);
  outColor = c;
}`;

export function createLiquidTitle(section) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'liquid-title';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = reduce ? null : canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  const none = { attach() {}, setActive() {}, relayout() {}, enabled: false };
  if (!gl) return none;

  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    console.warn('liquid title:', e);
    return none;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(['uText', 'uSize', 'uDpr', 'uFs', 'uPt', 'uAge'].map((n) => [n, gl.getUniformLocation(prog, n)]));
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.uniform1i(U.uText, 0);

  // texture: le lettere su un livello a parte, poi un solo alone per tutto il titolo (come il
  // text-shadow del CSS: dove gli aloni di due lettere si sovrappongono non si somma)
  const paint = document.createElement('canvas'), layer = document.createElement('canvas');
  const ctx = paint.getContext('2d'), lctx = layer.getContext('2d');
  const pts = Array.from({ length: MAX_PTS }, () => ({ x: 0, y: 0, vx: 0, vy: 0, t: -1e9, k: 0 }));
  const ptBuf = new Float32Array(MAX_PTS * 4), ageBuf = new Float32Array(MAX_PTS * 2);
  let head = 0;
  let title = null, ready = false, active = false, lost = false;
  let W = 1, H = 1, dpr = 1, fs = 100;
  let last = null, raf = 0, dirty = true;

  // disegna il titolo nella texture, lettera per lettera nelle posizioni del DOM (corpo, spaziatura,
  // a capo e crenatura restano quelli del CSS)
  async function relayout() {
    if (!title || lost) return;
    const cs = getComputedStyle(title);
    fs = parseFloat(cs.fontSize) || 100;
    const font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
    try {
      await document.fonts.load(font, title.textContent);
    } catch (e) {
      /* senza font caricato si disegna comunque con quello disponibile */
    }
    const node = title.firstChild;
    if (!node || node.nodeType !== 3) return;
    const sec = section.getBoundingClientRect();
    const range = document.createRange();
    const glyphs = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < node.length; i++) {
      const ch = node.data[i];
      if (!ch.trim()) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      if (!r.width) continue;
      glyphs.push({ ch, x: r.left - sec.left, y: r.top - sec.top, w: r.width, h: r.height });
      x0 = Math.min(x0, r.left - sec.left); x1 = Math.max(x1, r.right - sec.left);
      y0 = Math.min(y0, r.top - sec.top); y1 = Math.max(y1, r.bottom - sec.top);
    }
    if (!glyphs.length) return;
    // margine: la deformazione e l'alone sporgono dalle lettere
    const pad = Math.round(fs * 0.4 + 40);
    const left = Math.floor(x0 - pad), top = Math.floor(y0 - pad);
    W = Math.ceil(x1 - x0 + 2 * pad);
    H = Math.ceil(y1 - y0 + 2 * pad);
    dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2.4e6 / (W * H)));
    Object.assign(canvas.style, { left: `${left}px`, top: `${top}px`, width: `${W}px`, height: `${H}px` });
    canvas.width = paint.width = layer.width = Math.round(W * dpr);
    canvas.height = paint.height = layer.height = Math.round(H * dpr);
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.font = font;
    lctx.textBaseline = 'alphabetic';
    lctx.fillStyle = cs.color;
    const ascent = lctx.measureText('A').fontBoundingBoxAscent ?? fs * 0.95;
    for (const g of glyphs) lctx.fillText(g.ch, g.x - left, g.y - top + ascent);
    centers = glyphs.map((g) => ({ x: g.x - left + g.w / 2, y: g.y - top + g.h * 0.55 }));
    // lo stesso alone scuro del CSS (text-shadow: 0 2px 34px)
    ctx.clearRect(0, 0, paint.width, paint.height);
    ctx.shadowColor = 'rgba(46, 18, 20, 0.45)';
    ctx.shadowBlur = 34 * dpr;
    ctx.shadowOffsetY = 2 * dpr;
    ctx.drawImage(layer, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paint);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (!ready) {
      ready = true;
      title.classList.add('is-liquid');
    }
    dirty = true;
    kick();
  }

  function draw(now) {
    let alive = false;
    for (let i = 0; i < MAX_PTS; i++) {
      const q = pts[i];
      const age = now - q.t;
      const on = q.k > 0 && age < LIFE;
      alive ||= on;
      ptBuf.set([q.x, q.y, q.vx, q.vy], i * 4);
      ageBuf.set([age, on ? q.k : 0], i * 2);
    }
    gl.uniform2f(U.uSize, W, H);
    gl.uniform1f(U.uDpr, canvas.width / W);
    gl.uniform1f(U.uFs, fs);
    gl.uniform4fv(U.uPt, ptBuf);
    gl.uniform2fv(U.uAge, ageBuf);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return alive;
  }

  function frame() {
    raf = 0;
    if (!ready || lost) return;
    const alive = draw(performance.now() / 1000);
    dirty = false;
    if (alive && active) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && (dirty || active)) raf = requestAnimationFrame(frame);
  }

  // un gesto vero: le onde da sole aspettano che smetta
  function touch() {
    lastUser = performance.now();
  }
  // onda da sola: una passata breve su due lettere a caso, ogni ~5 s; se qualcuno ci ha appena
  // giocato aspetta che smetta
  let centers = [], teaseTimer = 0, lastUser = -1e9;
  function tease() {
    if (!active || !ready || !centers.length) return;
    if (performance.now() - lastUser < 3000) {
      teaseTimer = setTimeout(tease, 1500);
      return;
    }
    const c = centers[Math.floor(Math.random() * centers.length)];
    const len = Math.max(fs, 78) * 1.1, steps = 6, dt = 0.035;
    for (let i = 0; i <= steps; i++) {
      setTimeout(() => {
        if (!active) return;
        const x = c.x - len * 0.45 + (len * i) / steps;
        add(x, c.y + Math.sin(i * 0.9) * fs * 0.06, len / (steps * dt), 0, 0.7);
      }, i * dt * 1000);
    }
    teaseTimer = setTimeout(tease, 4800);
  }

  function add(x, y, vx, vy, k) {
    const q = pts[head];
    head = (head + 1) % MAX_PTS;
    const v = Math.hypot(vx, vy), vmax = 2600;
    const s = v > vmax ? vmax / v : 1;
    Object.assign(q, { x, y, vx: vx * s, vy: vy * s, t: performance.now() / 1000, k });
    kick();
  }

  // mouse e penna con i pointer event; il dito con i touch event, che continuano ad arrivare anche
  // se il browser prende il gesto per sé (pointercancel)
  function onMove(cx, cy, ts) {
    if (!active || !ready) return;
    const r = canvas.getBoundingClientRect();
    const x = cx - r.left, y = cy - r.top;
    const t = ts / 1000, sc = Math.max(fs, 78);
    if (x < -sc * 0.3 || y < -sc * 0.3 || x > r.width + sc * 0.3 || y > r.height + sc * 0.3) {
      last = null;
      return;
    }
    // un nuovo gesto (anche su dispositivi lenti gli eventi arrivano a ogni frame: soglia larga)
    if (!last || t - last.t > 0.3) {
      last = { x, y, t, vx: 0, vy: 0 };
      return;
    }
    const dt = Math.max(t - last.t, 1 / 240);
    const d = Math.hypot(x - last.x, y - last.y);
    if (d < 3) return;
    // velocità smorzata: la scia non scatta tra un evento e l'altro
    last.vx += ((x - last.x) / dt - last.vx) * 0.6;
    last.vy += ((y - last.y) / dt - last.vy) * 0.6;
    add(x, y, last.vx, last.vy, Math.min(1, 0.35 + d / (sc * 0.25)));
    touch();
    Object.assign(last, { x, y, t });
  }
  function onDown(cx, cy, ts) {
    if (!active || !ready) return;
    const r = canvas.getBoundingClientRect();
    const x = cx - r.left, y = cy - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) return;
    add(x, y, 0, 0, 1); // un tocco: solo l'increspatura
    touch();
    last = { x, y, t: ts / 1000, vx: 0, vy: 0 };
  }
  const opt = { passive: true };
  window.addEventListener('pointermove', (e) => e.pointerType !== 'touch' && onMove(e.clientX, e.clientY, e.timeStamp), opt);
  window.addEventListener('pointerdown', (e) => e.pointerType !== 'touch' && onDown(e.clientX, e.clientY, e.timeStamp), opt);
  window.addEventListener('touchmove', (e) => e.touches.length === 1 && onMove(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp), opt);
  window.addEventListener('touchstart', (e) => e.touches.length === 1 && onDown(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp), opt);

  let pending = 0;
  const later = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => relayout());
  };
  window.addEventListener('resize', later);
  const ro = new ResizeObserver(later);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    title?.classList.remove('is-liquid');
    canvas.remove();
  });

  return {
    // da chiamare dopo ogni render del titolo (anche al cambio di lingua)
    attach(el) {
      if (lost) return;
      if (title) ro.unobserve(title);
      title = el;
      ready = false;
      section.appendChild(canvas);
      ro.observe(title);
      relayout();
    },
    setActive(on) {
      if (on === active) return;
      active = on;
      clearTimeout(teaseTimer);
      if (!on) last = null;
      else teaseTimer = setTimeout(tease, 1400);
      kick();
    },
    relayout,
    enabled: true,
  };
}
