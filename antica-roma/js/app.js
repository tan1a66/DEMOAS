/* Antica Roma · Mérida — motor de la escena.
   Un único bucle (AR.onFrame) mueve todo: scroll → viaje Roma-Mérida, cursor → aereo, nubes, luz, platos.
   Sin transiciones CSS: en modo ?rec el video se graba fotograma a fotograma con un reloj virtual (window.__arTick). */
(function () {
  'use strict';
  const AR = (window.AR = window.AR || {});
  const CFG = AR.config || {};
  const qs = new URLSearchParams(location.search);
  AR.rec = qs.has('rec');

  /* ---------- utilidades ---------- */
  const clamp = (AR.clamp = (v, a, b) => (v < a ? a : v > b ? b : v));
  const lerp = (AR.lerp = (a, b, t) => a + (b - a) * t);
  const damp = (AR.damp = (c, t, l, dt) => c + (t - c) * (1 - Math.exp(-l * dt)));
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const E = (AR.ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  });
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, parent) => { const n = document.createElement(tag); if (cls) n.className = cls; if (parent) parent.appendChild(n); return n; };

  /* ---------- reloj y bucle ---------- */
  const hooks = [];
  AR.onFrame = (fn) => hooks.push(fn);
  AR.time = 0;

  /* ---------- entrada ---------- */
  const mouse = (AR.mouse = { x: innerWidth / 2, y: innerHeight * 0.45, sx: innerWidth / 2, sy: innerHeight * 0.45, nx: 0, ny: 0, vx: 0, vy: 0, moved: false });
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true;
  }, { passive: true });
  const finePointer = AR.rec || matchMedia('(pointer: fine)').matches;
  if (finePointer) document.documentElement.classList.add('has-cursor');

  /* ---------- datos de la escena ---------- */
  const ZONES = [
    { id: 'roma', src: 'assets/roma.webp', tone: 'linear-gradient(#7a5236,#5a3a26)',
      cap: { k: 'Italia · 41.890° N', t: 'Roma', s: 'Il Colosseo · punto de partida' } },
    { id: 'tirreno', src: 'assets/sea.webp',
      cap: { k: 'Costa del Lazio', t: 'Mar Tirreno', s: 'Rumbo al oeste, con la carta a bordo' } },
    { id: 'med', src: 'assets/zones/ocean.webp', alt: 'assets/sea.webp', crop: 'top',
      cap: { k: 'Entre Italia y España', t: 'Mediterráneo', s: 'Pecorino, guanciale y pasta en la bodega' } },
    { id: 'atl', src: 'assets/atlantic.webp', alt: 'assets/zones/ocean.webp',
      cap: { k: 'Sobre las nubes', t: 'Océano Atlántico', s: '9,411 km de sabor' } },
    { id: 'yuc', src: 'assets/yucatan.webp', alt: 'assets/zones/yucatan.webp',
      cap: { k: 'México', t: 'Península de Yucatán', s: 'Mar Caribe · selva maya' } },
    { id: 'mer', src: 'assets/monumento.webp',
      cap: { k: 'Mérida · 20.997° N', t: 'Monumento a la Patria', s: 'Paseo de Montejo · aterrizamos' } },
  ];
  const N = ZONES.length;
  const ZONE_ASPECT = 2304 / 1286;
  const ROMA = { cx: 0.507, cy: 0.455, park: { x: 0.665, y: 0.79 }, heroShift: 0.075 }; // Colosseo e viale (via di San Gregorio) in roma.webp
  const MONUMENT = { x: 0.5, y: 0.455 };

  const TD = AR.tableData || null; // manifest de la mesa (js/table-data.js) — opcional
  const TABLE_IMG = TD ? { w: TD.image.w, h: TD.image.h } : { w: 2304, h: 1303 };
  const TABLE_ASPECT = TABLE_IMG.w / TABLE_IMG.h;
  const PLATES = (TD && TD.plates) || [
    { id: 1, cx: 0.141, cy: 0.4868, r: 0.0842 },
    { id: 2, cx: 0.3719, cy: 0.4883, r: 0.083 },
    { id: 3, cx: 0.6124, cy: 0.4888, r: 0.0827 },
    { id: 4, cx: 0.8503, cy: 0.4899, r: 0.0824 },
  ];
  const PLATE_UI = [
    { open: 'menu', title: 'Menú', sub: 'La carta', ico: 'ico-book', big: true, aria: 'Menú — ver la carta' },
    { open: 'reserva', title: 'Reserva<br>ahora', sub: 'Por WhatsApp', ico: 'ico-wa', aria: 'Reserva ahora por WhatsApp' },
    { open: 'ubicacion', title: 'Ubicación', sub: 'Cómo llegar', ico: 'ico-pin', aria: 'Ubicación — cómo llegar' },
    { open: 'historia', title: 'Más de<br>nuestra<br>historia', sub: 'De Roma a Mérida', ico: 'ico-column', small: true, aria: 'Más de nuestra historia' },
  ];

  /* timeline (p = progreso del scroll 0..1) */
  const T = {
    heroOut: [0.012, 0.06],
    takeoff: [0.045, 0.165],
    cruise: [0.07, 0.745],
    approach: [0.705, 0.795],
    burst: 0.8,
    dive: [0.812, 0.93],
    worldFade: [0.858, 0.9],
    tableIn: [0.852, 0.9],
    match: [0.852, 0.952],
    flyDur: 0.1,
    labels: 0.935,
    ui: [0.962, 0.99],
  };

  /* ---------- DOM ---------- */
  const stage = $('#stage'), ground = $('#ground'), world = $('#world');
  const plane = $('#plane'), planeShadow = $('#plane-shadow');
  const cloudsLow = $('#clouds-low'), cloudsHigh = $('#clouds-high');
  const table = $('#table'), tableInner = $('#table-inner'), cloth = $('#cloth'), tableGlow = $('#table-glow');
  const ingLayer = $('#ingredients'), platesNav = $('#plates');
  const fxLight = $('#fx-light'), fxVig = $('#fx-vignette'), fxGrain = $('#fx-grain'), fxFlash = $('#fx-flash');
  const hero = $('#hero'), heroTitle = $('#hero-title'), hint = $('#scroll-hint'), hud = $('#hud');
  const hudFill = $('.hud-fill'), hudPlane = $('.hud-plane'), hudKm = $('#hud-km'), hudCoords = $('#hud-coords');
  const capsBox = $('#captions'), tableUI = $('#table-ui'), intro = $('#intro'), introBar = $('#intro-bar');
  const cursor = $('#cursor'), cRing = $('#cursor .ring'), cDot = $('#cursor .dot'), cLabel = $('#cursor .label');

  // los platos viven dentro de la escena (entre la mesa y los ingredientes)
  stage.removeAttribute('aria-hidden');
  [...stage.children].forEach((c) => c.setAttribute('aria-hidden', 'true'));
  stage.insertBefore(platesNav, ingLayer);
  platesNav.removeAttribute('aria-hidden');

  /* precarga */
  const loading = { total: 0, done: 0 };
  function track(img) {
    loading.total++;
    return new Promise((res) => {
      const fin = () => { loading.done++; res(); };
      if (img.complete && img.naturalWidth) { (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(fin); return; }
      img.addEventListener('load', () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(fin), { once: true });
      img.addEventListener('error', fin, { once: true });
    });
  }
  const waits = [];

  /* zonas */
  const zoneEls = ZONES.map((z, k) => {
    const box = el('div', 'zone' + (k > 0 ? ' fade' : ''), world);
    box.style.zIndex = String(k + 1);
    box.style.background = z.tone || '#123';
    const img = el('img', '', box);
    img.alt = ''; img.draggable = false; img.decoding = 'async';
    let tf = '';
    if (z.flip) tf += ' scaleX(-1)';
    if (z.flipY) tf += ' scaleY(-1)';
    if (tf) img.style.transform = tf.trim();
    if (z.crop === 'top') img.style.objectPosition = '50% 0%';
    img.addEventListener('error', () => { if (z.alt && img.dataset.alt !== '1') { img.dataset.alt = '1'; img.src = z.alt; } else img.style.visibility = 'hidden'; });
    img.src = z.src;
    waits.push(track(img));
    return { box, img, z };
  });
  waits.push(track(plane));
  waits.push(track(planeShadow));

  /* nubes */
  const cloudSrc = (i) => `assets/zones/rc-${(i % 7) + 1}.webp`; // nubes reales recortadas de atlantic.webp
  const clouds = [];
  (function buildClouds() {
    const r = rng(7);
    const add = (u, x, w, f, high, op) => {
      const parent = high ? cloudsHigh : cloudsLow;
      const c = el('div', 'cloud', parent);
      const img = el('img', '', c);
      img.alt = ''; img.draggable = false;
      img.addEventListener('error', () => { img.remove(); el('div', 'puff', c); }, { once: true });
      img.src = cloudSrc(clouds.length);
      const rot = r() * 360;
      clouds.push({ el: c, u, x, w, f, high, op, rot, ox: 0, oy: 0, vx: 0, vy: 0, aspect: 0.62 + r() * 0.2 });
    };
    // nubes bajas (bajo el avión)
    const low = [[0.55, 0.12, 0.34], [0.8, 0.86, 0.3], [1.35, 0.2, 0.4], [1.6, 0.78, 0.36], [1.95, 0.42, 0.3], [2.2, 0.1, 0.44],
      [2.45, 0.86, 0.42], [2.7, 0.55, 0.36], [2.95, 0.2, 0.48], [3.15, 0.8, 0.46], [3.4, 0.35, 0.4], [3.65, 0.9, 0.34], [3.9, 0.15, 0.32], [4.25, 0.72, 0.3]];
    low.forEach(([u, x, w]) => add(u, x, w, 1.22 + r() * 0.12, false, 0.92));
    // nubes altas (sobre el avión, pasan rápido)
    const high = [[1.25, 0.95, 0.62], [1.9, -0.02, 0.7], [2.55, 0.52, 0.8], [3.05, 1.02, 0.74], [3.55, 0.02, 0.8], [3.95, 0.6, 0.66], [4.35, 0.08, 0.5]];
    high.forEach(([u, x, w]) => add(u, x, w, 1.95 + r() * 0.25, true, 0.62));
  })();
  const cloudShadows = clouds.filter((c) => !c.high).map((c, i) => {
    const s = el('div', 'cloud-shadow', world);
    s.style.zIndex = '20';
    const img = el('img', '', s);
    img.alt = ''; img.style.width = '100%'; img.style.height = '100%';
    img.addEventListener('error', () => { img.remove(); s.style.background = 'radial-gradient(closest-side, rgba(0,10,25,.55), rgba(0,10,25,0))'; s.style.borderRadius = '50%'; }, { once: true });
    img.src = 'assets/zones/cloud-shadow.webp';
    return { s, c };
  });

  /* mesa */
  cloth.src = TD ? 'assets/table/' + TD.cloth : 'assets/table.webp';
  waits.push(track(cloth));

  const plates = PLATES.map((pd, i) => {
    const ui = PLATE_UI[i];
    const shadow = el('span', 'plate-shadow', platesNav);
    shadow.style.cssText = 'position:absolute;left:0;top:0;border-radius:50%;pointer-events:none;background:radial-gradient(closest-side, rgba(45,6,6,.62), rgba(45,6,6,.28) 62%, rgba(45,6,6,0) 100%);';
    const b = el('button', 'plate' + (ui.big ? ' big-title' : ''), platesNav);
    b.type = 'button';
    b.dataset.open = ui.open;
    b.dataset.cursor = 'Abrir';
    b.setAttribute('aria-label', ui.aria);
    const body = el('span', 'p-body', b);
    let img = null;
    if (TD && pd.src) {
      img = el('img', '', body); img.alt = ''; img.draggable = false; img.src = 'assets/table/' + pd.src;
      waits.push(track(img));
    } else {
      body.style.backgroundImage = 'url(assets/table.webp)';
    }
    const shine = el('span', 'p-shine', b);
    const label = el('span', 'p-label', b);
    label.innerHTML = `<svg class="p-ico" viewBox="0 0 32 32" aria-hidden="true"><use href="#${ui.ico}"/></svg>` +
      `<span class="p-title">${ui.title}</span><span class="p-rule"></span><span class="p-sub">${ui.sub}</span>`;
    if (ui.small) label.querySelector('.p-title').style.fontSize = '1.02em';
    b.addEventListener('click', () => openModal(ui.open, i));
    return { pd, ui, b, body, img, shine, label, shadow, hover: 0, press: 0, tx: 0, ty: 0, lift: 0, reveal: 0, cx: 0, cy: 0, d: 0 };
  });

  /* ingredientes: sprites recortados de la foto (vuelan desde el avión hasta la mesa) */
  const ings = [];
  if (TD && TD.ingredients) {
    const r = rng(11);
    const list = TD.ingredients.slice().sort((a, b) => (a.z || 0) - (b.z || 0));
    list.forEach((it, i) => {
      const n = el('img', 'ing', ingLayer);
      n.alt = ''; n.draggable = false; n.src = 'assets/table/' + it.src;
      n.style.zIndex = String(10 + (it.z || 0));
      waits.push(track(n));
      ings.push({ it, el: n, i, ang: 0, spin: (r() < 0.5 ? -1 : 1) * (140 + r() * 260), jx: (r() - 0.5) * 0.5, jy: (r() - 0.5) * 0.8,
        dir: 0, reach: 0.35 + r() * 0.35, ox: 0, oy: 0, vx: 0, vy: 0, ro: 0, vr: 0, start: 0 });
    });
    // orden de salida: del centro hacia fuera, alternando lados
    const order = ings.map((g, i) => ({ i, d: Math.abs(g.it.cx - 0.5) + Math.abs(g.it.cy - 0.5) * 0.4 })).sort((a, b) => a.d - b.d);
    order.forEach((o, k) => { ings[o.i].start = T.burst + k * 0.0042; });
    ings.forEach((g) => { g.dir = Math.atan2(g.it.cy - 0.5, g.it.cx - 0.5); });
  }
  // tarjeta con el nombre del restaurante (también cae del avión)
  const card = el('div', 'ing place-card', ingLayer);
  card.innerHTML = '<svg viewBox="0 0 64 40" aria-hidden="true"><use href="#ico-laurel"/></svg><b>Antica Roma</b><span>Cucina romana · Mérida</span>';
  const cardSpec = { it: { cx: 0.493, cy: 0.128, box: { x: 0.388, y: 0.06, w: 0.21, h: 0.136 } }, el: card, i: 99, spin: -24, jx: 0, jy: 0,
    dir: -Math.PI / 2, reach: 0.25, ox: 0, oy: 0, vx: 0, vy: 0, ro: 0, vr: 0, start: T.burst + 0.03, isCard: true };
  ings.push(cardSpec);

  /* título del hero letra por letra */
  heroTitle.innerHTML = ['Antica', 'Roma'].map((w) => `<span class="w">${[...w].map((c) => `<span class="ch">${c}</span>`).join('')}</span>`).join('');
  const heroChars = [...heroTitle.querySelectorAll('.ch')];

  /* rótulos de lugar */
  const caps = ZONES.map((z) => {
    const c = el('div', 'cap', capsBox);
    c.innerHTML = `<div class="c-k"><i></i>${z.cap.k}</div><div class="c-t">${z.cap.t}</div><div class="c-s">${z.cap.s}</div>`;
    return { el: c, w: 0 };
  });

  /* ---------- geometría ---------- */
  const G = {};
  function layout() {
    const vw = innerWidth, vh = innerHeight;
    G.vw = vw; G.vh = vh; G.portrait = vw / vh < 0.85;
    // mundo
    let ZW = vw * 1.16, ZH = ZW / ZONE_ASPECT;
    if (ZH < vh * 1.12) { ZH = vh * 1.12; ZW = ZH * ZONE_ASPECT; }
    G.ZW = ZW; G.ZH = ZH; G.S = ZH * 0.74; G.worldLeft = (vw - ZW) / 2;
    G.worldH = (N - 1) * G.S + ZH;
    world.style.width = ZW + 'px'; world.style.height = G.worldH + 'px';
    zoneEls.forEach((ze, k) => {
      const top = (N - 1 - k) * G.S;
      ze.top = top;
      ze.box.style.top = top + 'px'; ze.box.style.width = ZW + 'px'; ze.box.style.height = ZH + 'px';
      ze.box.style.setProperty('--solid', (100 * (1 - (ZH - G.S) / ZH)).toFixed(2) + '%');
    });
    G.center = (k) => (N - 1 - k) * G.S + ZH / 2;
    // avión
    G.planeW = Math.min(vw * 0.25, vh * 0.42, 470);
    plane.style.width = planeShadow.style.width = G.planeW + 'px';
    G.planeH = G.planeW * (746 / 760);
    // mesa (cover; en vertical se gira 90°)
    let TW, TH;
    if (!G.portrait) { TW = Math.max(vw, vh * TABLE_ASPECT); TH = TW / TABLE_ASPECT; }
    else { TW = Math.max(vh, vw * TABLE_ASPECT); TH = TW / TABLE_ASPECT; }
    G.TW = TW; G.TH = TH;
    tableInner.style.width = TW + 'px'; tableInner.style.height = TH + 'px';
    tableInner.style.left = (vw - TW) / 2 + 'px'; tableInner.style.top = (vh - TH) / 2 + 'px';
    tableInner.style.transform = G.portrait ? 'rotate(90deg)' : 'none';
    plates.forEach((pl) => {
      pl.body.style.transform = G.portrait ? 'rotate(90deg)' : 'none';
    });
    // sprites de ingredientes: tamaño final
    ings.forEach((g) => {
      const bx = g.it.box;
      g.w = bx.w * TW; g.h = bx.h * TH;
      g.el.style.width = g.w + 'px'; g.el.style.height = g.h + 'px';
      if (g.isCard) g.el.style.fontSize = (g.w / 17) + 'px';
    });
  }
  // imagen de la mesa (coords normalizadas) → pantalla, antes del encuadre de transición
  function tableToScreen(nx, ny) {
    const dx = (nx - 0.5) * G.TW, dy = (ny - 0.5) * G.TH;
    if (!G.portrait) return [G.vw / 2 + dx, G.vh / 2 + dy];
    return [G.vw / 2 - dy, G.vh / 2 + dx];
  }

  /* ---------- estado ---------- */
  const S = (AR.state = { p: 0, target: 0, steer: 0, steerV: 0, bank: 0, yaw: 0, intro: 0, ready: false, readyAt: 0,
    tiltX: 0, tiltY: 0, modalOpen: false, hoverPlate: -1, cur: { label: '', grow: 0, labelO: 0 } });

  function readScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    S.target = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
  }

  function greatCircle(f) {
    const toR = Math.PI / 180, a = CFG.from || { lat: 41.89, lon: 12.49 }, b = CFG.to || { lat: 20.99, lon: -89.62 };
    const la1 = a.lat * toR, lo1 = a.lon * toR, la2 = b.lat * toR, lo2 = b.lon * toR;
    const d = 2 * Math.asin(Math.sqrt(Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2));
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
    const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
    const z = A * Math.sin(la1) + B * Math.sin(la2);
    return [Math.atan2(z, Math.sqrt(x * x + y * y)) / toR, Math.atan2(y, x) / toR];
  }
  const fmtKm = (n) => Math.round(n).toLocaleString('en-US');

  /* ---------- modales ---------- */
  function openModal(name, plateIndex) {
    if (plateIndex != null) plates[plateIndex].press = 1;
    if (AR.modals && AR.modals.open) AR.modals.open(name);
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open]');
    if (t && !t.classList.contains('plate')) { e.preventDefault(); openModal(t.dataset.open); }
  });
  $('#brand').addEventListener('click', (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: AR.rec ? 'auto' : 'smooth' }); });
  $('#replay').addEventListener('click', () => scrollTo({ top: 0, behavior: AR.rec ? 'auto' : 'smooth' }));

  /* ---------- música (Vivaldi, La Primavera — dominio público) ---------- */
  const soundBtn = $('#sound'), bars = [...soundBtn.querySelectorAll('i')];
  let audio = null, soundOn = false, soundLvl = 0;
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) {
      if (!audio) { audio = new Audio('assets/audio/primavera.m4a'); audio.loop = true; audio.volume = 0; }
      audio.play().catch(() => { soundOn = false; });
    }
  });
  hooks.push((dt, t) => {
    soundLvl = damp(soundLvl, soundOn ? 1 : 0, 3, dt);
    if (audio) { audio.volume = clamp(soundLvl * 0.55, 0, 1); if (!soundOn && soundLvl < 0.01 && !audio.paused) audio.pause(); }
    bars.forEach((b, i) => { const h = 4 + soundLvl * (6 + 8 * Math.abs(Math.sin(t * (5 + i * 1.7) + i))); b.style.height = h.toFixed(1) + 'px'; });
  });

  /* ---------- fotograma ---------- */
  function frame(dt) {
    dt = clamp(dt, 0, 0.1);
    AR.time += dt;
    const t = AR.time, vw = G.vw, vh = G.vh;
    S.modalOpen = !!(AR.modals && AR.modals.isOpen && AR.modals.isOpen());

    // ratón suavizado
    const pmx = mouse.sx, pmy = mouse.sy;
    mouse.sx = damp(mouse.sx, mouse.x, 14, dt); mouse.sy = damp(mouse.sy, mouse.y, 14, dt);
    mouse.vx = dt > 0 ? (mouse.sx - pmx) / dt : 0; mouse.vy = dt > 0 ? (mouse.sy - pmy) / dt : 0;
    mouse.nx = clamp((mouse.sx / vw) * 2 - 1, -1, 1); mouse.ny = clamp((mouse.sy / vh) * 2 - 1, -1, 1);

    // intro
    if (S.ready) S.intro = Math.min(1, (t - S.readyAt) / 2.4);
    const introOut = E.inOutCubic(seg(S.intro, 0.08, 0.42));
    intro.style.opacity = String(1 - introOut);
    intro.style.display = introOut >= 1 ? 'none' : 'flex';
    introBar.style.setProperty('--p', S.ready ? 1 : loading.total ? loading.done / loading.total : 0);

    // progreso del scroll
    if (!S.modalOpen) readScroll();
    S.p = damp(S.p, S.target, AR.rec ? 7 : 5.2, dt);
    if (Math.abs(S.p - S.target) < 1e-5) S.p = S.target;
    const p = S.p;

    // inclinación del suelo con el cursor
    S.tiltX = damp(S.tiltX, mouse.nx, 3, dt); S.tiltY = damp(S.tiltY, mouse.ny, 3, dt);

    /* --- cámara --- */
    const cr = seg(p, T.cruise[0], T.cruise[1]);
    const c = E.inOutSine(cr);
    const cy = lerp(G.center(0), G.center(N - 1), c);
    const camTY = vh / 2 - cy;
    // inmersión final hacia el monumento
    const dv = seg(p, T.dive[0], T.dive[1]);
    const zoom = 1 + 4.2 * E.inQuad(dv);
    const O = [vw / 2, vh / 2 + (MONUMENT.y - 0.5) * G.ZH]; // centro del monumento en pantalla al final del viaje
    const toScreenZoom = (x, y) => [O[0] + (x - O[0]) * zoom, O[1] + (y - O[1]) * zoom];
    // en el hero el Coliseo se desplaza a la derecha para dejar sitio al título
    const wx = G.worldLeft + (G.portrait ? 0 : Math.min(ROMA.heroShift * vw, (G.ZW - vw) / 2 - 2) * (1 - E.inOutSine(seg(p, 0.03, 0.17))));
    world.style.transform = `translate(${O[0]}px,${O[1]}px) scale(${zoom}) translate(${-O[0]}px,${-O[1]}px) translate(${wx.toFixed(2)}px,${camTY.toFixed(2)}px)`;
    const wBlur = (zoom - 1) * 1.5;
    world.style.filter = wBlur > 0.05 ? `blur(${wBlur.toFixed(2)}px)` : 'none';
    const worldO = 1 - E.inOutCubic(seg(p, T.worldFade[0], T.worldFade[1]));
    world.style.opacity = String(worldO);
    ground.style.display = worldO <= 0.001 ? 'none' : 'block';
    const tiltK = 1 - seg(p, 0.8, 0.86);
    ground.style.transform = `translate3d(${(-S.tiltX * 16 * tiltK).toFixed(2)}px,${(-S.tiltY * 10 * tiltK).toFixed(2)}px,0) rotateX(${(-S.tiltY * 2.4 * tiltK).toFixed(3)}deg) rotateY(${(S.tiltX * 2.8 * tiltK).toFixed(3)}deg)`;

    // zona → pantalla (sin zoom)
    const zoneToScreen = (k, nx, ny) => [wx + nx * G.ZW, zoneEls[k].top + ny * G.ZH + camTY];

    /* --- nubes --- */
    const zf = c * (N - 1); // posición del viaje en "zonas"
    const cloudVis = 1 - seg(p, 0.76, 0.81);
    clouds.forEach((cl) => {
      const w = cl.w * vw * (cl.high ? 1 : 0.95), h = w * cl.aspect;
      const y = vh / 2 + (zf - cl.u) * G.S * cl.f;
      const x = cl.x * vw;
      const on = y > -h && y < vh + h && cloudVis > 0;
      if (!on) { if (cl.vis !== false) { cl.el.style.display = 'none'; cl.vis = false; } return; }
      if (cl.vis !== true) { cl.el.style.display = 'block'; cl.vis = true; }
      // el cursor aparta las nubes
      const dx = x + cl.ox - mouse.sx, dy = y + cl.oy - mouse.sy, d = Math.hypot(dx, dy) || 1, R = w * 0.75;
      let fx = 0, fy = 0;
      if (d < R && mouse.moved) { const k = Math.pow(1 - d / R, 2) * 2600; fx = (dx / d) * k; fy = (dy / d) * k; }
      cl.vx += (fx - cl.ox * 6) * dt; cl.vy += (fy - cl.oy * 6) * dt;
      cl.vx *= Math.exp(-4 * dt); cl.vy *= Math.exp(-4 * dt);
      cl.ox += cl.vx * dt; cl.oy += cl.vy * dt;
      cl.el.style.width = w + 'px'; cl.el.style.height = h + 'px';
      cl.el.style.opacity = String(cl.op * cloudVis);
      cl.el.style.transform = `translate3d(${(x + cl.ox - w / 2).toFixed(1)}px,${(y + cl.oy - h / 2).toFixed(1)}px,0) rotate(${cl.rot.toFixed(1)}deg)`;
    });
    cloudShadows.forEach(({ s, c: cl }) => {
      const w = cl.w * vw * 0.95, h = w * cl.aspect;
      // sombra pegada al suelo, desplazada hacia abajo-derecha (sol arriba-izquierda)
      const wy = G.center(0) - cl.u * G.S; // coordenada de mundo
      const x = cl.x * vw - G.worldLeft + cl.ox * 0.6 + w * 0.12;
      s.style.width = w + 'px'; s.style.height = h + 'px';
      s.style.transform = `translate(${(x - w / 2).toFixed(1)}px,${(wy - h / 2 + h * 0.18).toFixed(1)}px) rotate(${cl.rot.toFixed(1)}deg)`;
      s.style.opacity = String(0.3 * cloudVis);
    });

    /* --- avión --- */
    const tk = seg(p, T.takeoff[0], T.takeoff[1]);
    const ap = seg(p, T.approach[0], T.approach[1]);
    const park = zoneToScreen(0, ROMA.park.x, ROMA.park.y);
    // dirección con el cursor durante el vuelo
    const flying = tk > 0.5 && ap < 0.9 ? 1 : 0;
    const steerT = flying * mouse.nx * vw * (G.portrait ? 0.26 : 0.2);
    const prevSteer = S.steer;
    S.steer = damp(S.steer, steerT, 1.8, dt);
    const sv = dt > 0 ? (S.steer - prevSteer) / dt : 0;
    S.bank = damp(S.bank, clamp(sv * 0.07, -24, 24), 5, dt);
    const cruisePos = [vw / 2 + S.steer, vh * (G.portrait ? 0.56 : 0.6) + Math.sin(t * 0.9) * 4];
    const land = zoneToScreen(N - 1, MONUMENT.x, MONUMENT.y + 0.005);
    let px, py, ps, alt, rot;
    if (tk < 1) {
      const e = E.inOutCubic(tk);
      px = lerp(park[0], cruisePos[0], e); py = lerp(park[1], cruisePos[1], E.inCubic(tk) * 0.5 + e * 0.5);
      ps = lerp(0.42, 1, E.inOutSine(seg(tk, 0.25, 1)));
      alt = E.inOutSine(seg(tk, 0.22, 1));
    } else { px = cruisePos[0]; py = cruisePos[1]; ps = 1; alt = 1; }
    if (ap > 0) {
      const e = E.inOutCubic(ap);
      px = lerp(px, land[0], e); py = lerp(py, land[1], e);
      ps = lerp(ps, 0.4, E.inOutSine(ap)); alt = lerp(alt, 0, E.inOutSine(seg(ap, 0.2, 1)));
    }
    // en tierra (Roma): el morro sigue al cursor
    const parked = 1 - seg(tk, 0, 0.35);
    const yawT = parked * clamp(Math.atan2(mouse.sx - park[0], -(mouse.sy - park[1])) * 57.3, -16, 16) * (mouse.moved ? 1 : 0);
    S.yaw = damp(S.yaw, yawT, 3, dt);
    rot = S.yaw + S.bank * 0.55 * (1 - ap);
    const roll = 1 - Math.abs(S.bank) / 120;
    // pequeño rebote al tocar el monumento
    const touch = seg(p, 0.79, 0.806);
    ps *= 1 + Math.sin(touch * Math.PI) * 0.04;
    // con la inmersión el avión se queda en el suelo
    const [zx, zy] = toScreenZoom(px, py);
    const zs = ps * zoom;
    const planeO = 1 - seg(p, 0.83, 0.868);
    const pw = G.planeW, ph = G.planeH;
    plane.style.transform = `translate3d(${(zx - pw / 2).toFixed(1)}px,${(zy - ph / 2).toFixed(1)}px,0) rotate(${rot.toFixed(2)}deg) scale(${(zs * roll).toFixed(4)},${zs.toFixed(4)})`;
    plane.style.opacity = String(planeO);
    plane.style.display = planeO <= 0 ? 'none' : 'block';
    const sOff = 6 + alt * 70 * ps, sBlur = 2 + alt * 12;
    const [sx, sy] = toScreenZoom(px + sOff, py + sOff * 1.3);
    planeShadow.style.transform = `translate3d(${(sx - pw / 2).toFixed(1)}px,${(sy - ph / 2).toFixed(1)}px,0) rotate(${rot.toFixed(2)}deg) scale(${(zs * (0.92 + 0.08 * (1 - alt)) * roll).toFixed(4)},${(zs * (0.92 + 0.08 * (1 - alt))).toFixed(4)})`;
    planeShadow.style.filter = `brightness(0) blur(${sBlur.toFixed(1)}px)`;
    planeShadow.style.opacity = String((0.42 - alt * 0.2) * planeO);
    planeShadow.style.display = plane.style.display;

    /* --- mesa --- */
    const tIn = E.inOutCubic(seg(p, T.tableIn[0], T.tableIn[1]));
    const m = E.outCubic(seg(p, T.match[0], T.match[1]));
    const p2 = tableToScreen(PLATES[1].cx, PLATES[1].cy);
    const r2 = PLATES[1].r * G.TW;
    const k0 = Math.max(1.6, (0.205 * G.ZH * (1 + 4.2 * E.inQuad(seg(T.match[0], T.dive[0], T.dive[1])))) / r2);
    const tk2 = lerp(k0, 1, m);
    const settle = seg(p, 0.95, 1);
    const par = [-mouse.nx * 10 * settle, -mouse.ny * 7 * settle];
    const dX = (O[0] - p2[0]) * (1 - m) + par[0], dY = (O[1] - p2[1]) * (1 - m) + par[1];
    const tf = (x, y) => [p2[0] + (x - p2[0]) * tk2 + dX, p2[1] + (y - p2[1]) * tk2 + dY];
    table.style.opacity = String(tIn);
    table.style.display = tIn <= 0 ? 'none' : 'block';
    table.style.transformOrigin = `${p2[0]}px ${p2[1]}px`;
    table.style.transform = `translate3d(${dX.toFixed(2)}px,${dY.toFixed(2)}px,0) scale(${tk2.toFixed(4)})`;
    const tBlur = (tk2 - 1) * 1.6;
    table.style.filter = tBlur > 0.05 ? `blur(${tBlur.toFixed(2)}px)` : 'none';

    /* --- platos --- */
    const live = p > 0.975 && !S.modalOpen;
    let hoverIdx = -1;
    plates.forEach((pl, i) => {
      const [bx, by] = tableToScreen(pl.pd.cx, pl.pd.cy);
      const [cx2, cy2] = tf(bx, by);
      const d = pl.pd.r * 2 * G.TW * tk2;
      pl.cx = cx2; pl.cy = cy2; pl.d = d;
      const dist = Math.hypot(mouse.x - cx2, mouse.y - cy2);
      const over = live && dist < d / 2 ? 1 : 0;
      if (over) hoverIdx = i;
      pl.hover = damp(pl.hover, over, 9, dt);
      pl.press = damp(pl.press, 0, 6, dt);
      const rx = over ? clamp(-(mouse.sy - cy2) / (d / 2), -1, 1) : 0, ry = over ? clamp((mouse.sx - cx2) / (d / 2), -1, 1) : 0;
      pl.tx = damp(pl.tx, rx * 12, 8, dt); pl.ty = damp(pl.ty, ry * 12, 8, dt);
      const lift = pl.hover * 14 - pl.press * 10;
      const sc = 1 + pl.hover * 0.045 - pl.press * 0.04;
      pl.reveal = E.outCubic(seg(p, T.labels + i * 0.009, T.labels + 0.03 + i * 0.009));
      pl.b.style.width = pl.b.style.height = d + 'px';
      pl.b.style.setProperty('--d', d + 'px');
      if (!pl.img) { // recorte del plato desde la foto completa (sin sprites)
        const TWk = G.TW * tk2, THk = G.TH * tk2;
        pl.body.style.backgroundSize = `${TWk}px ${THk}px`;
        pl.body.style.backgroundPosition = `${-(pl.pd.cx * TWk - d / 2)}px ${-(pl.pd.cy * THk - d / 2)}px`;
      }
      pl.b.style.opacity = String(tIn);
      pl.b.style.transform = `translate3d(${(cx2 - d / 2).toFixed(1)}px,${(cy2 - d / 2 - lift).toFixed(1)}px,0) perspective(${(d * 3).toFixed(0)}px) rotateX(${pl.tx.toFixed(2)}deg) rotateY(${pl.ty.toFixed(2)}deg) scale(${sc.toFixed(4)})`;
      pl.b.classList.toggle('live', live);
      pl.b.tabIndex = live ? 0 : -1;
      // sombra en la mesa
      const sd = d * (1.02 + pl.hover * 0.06);
      pl.shadow.style.width = pl.shadow.style.height = sd + 'px';
      pl.shadow.style.opacity = String(tIn * (0.55 + pl.hover * 0.25));
      pl.shadow.style.transform = `translate3d(${(cx2 - sd / 2 + d * 0.025 + lift * 0.5).toFixed(1)}px,${(cy2 - sd / 2 + d * 0.04 + lift * 0.9).toFixed(1)}px,0)`;
      pl.shadow.style.filter = `blur(${(d * 0.025 + lift * 0.8).toFixed(1)}px)`;
      // brillo que sigue al cursor
      const hx = 50 + clamp((mouse.sx - cx2) / d, -0.8, 0.8) * 55, hy = 50 + clamp((mouse.sy - cy2) / d, -0.8, 0.8) * 55;
      pl.shine.style.background = `radial-gradient(circle at ${hx.toFixed(1)}% ${hy.toFixed(1)}%, rgba(255,255,255,${(0.35 + pl.hover * 0.5).toFixed(2)}), rgba(255,255,255,0) 52%)`;
      // rótulo
      pl.label.style.opacity = String(pl.reveal);
      pl.label.style.transform = `translate(-50%,-50%) translateY(${((1 - pl.reveal) * d * 0.05).toFixed(1)}px) scale(${(0.94 + 0.06 * pl.reveal + pl.hover * 0.02).toFixed(4)})`;
      pl.label.style.letterSpacing = `${((1 - pl.reveal) * 0.08).toFixed(3)}em`;
      pl.label.style.textShadow = pl.hover > 0.02 ? `0 0 ${(18 * pl.hover).toFixed(1)}px rgba(227,196,119,${(0.7 * pl.hover).toFixed(2)})` : 'none';
    });
    S.hoverPlate = hoverIdx;

    /* --- ingredientes --- */
    const showIng = p > T.burst - 0.002;
    const pc = toScreenZoom(px, py);
    ings.forEach((g) => {
      if (!showIng || p < g.start) { if (g.vis !== false) { g.el.style.display = 'none'; g.vis = false; } return; }
      if (g.vis !== true) { g.el.style.display = g.isCard ? 'flex' : 'block'; g.vis = true; }
      const u = seg(p, g.start, g.start + T.flyDur);
      const [bx, by] = tableToScreen(g.it.cx, g.it.cy);
      const [ex, ey] = tf(bx, by);
      // salida desde la bodega del avión
      const s0x = pc[0] + g.jx * G.planeW * ps * zoom * 0.35, s0y = pc[1] + g.jy * G.planeH * ps * zoom * 0.35;
      const reach = g.reach * Math.min(vw, vh);
      const c1x = s0x + Math.cos(g.dir) * reach, c1y = s0y + Math.sin(g.dir) * reach - reach * 0.35;
      const e = E.inOutSine(u);
      const ix = (1 - e) * (1 - e) * s0x + 2 * (1 - e) * e * c1x + e * e * ex;
      const iy = (1 - e) * (1 - e) * s0y + 2 * (1 - e) * e * c1y + e * e * ey;
      const bump = Math.sin(Math.PI * seg(u, 0.84, 1));
      const scale = lerp(0.1, 1, E.inCubic(Math.min(1, u / 0.86))) * tk2 * (1 + bump * 0.07);
      let rotI = g.spin * (1 - E.outCubic(u)) + (G.portrait ? 90 : 0);
      // física: el cursor empuja los ingredientes posados
      const landed = u >= 1;
      if (landed && !S.modalOpen) {
        const cxI = ex + g.ox, cyI = ey + g.oy;
        const dx = cxI - mouse.x, dy = cyI - mouse.y, dd = Math.hypot(dx, dy) || 1;
        const R = Math.max(g.w, g.h) * 0.5 + Math.min(vw, vh) * 0.08;
        let fx = 0, fy = 0;
        if (dd < R && mouse.moved) {
          const kf = Math.pow(1 - dd / R, 2) * 5200 * (g.isCard ? 0.5 : 1);
          fx = (dx / dd) * kf; fy = (dy / dd) * kf;
          g.vr += ((dx * mouse.vy - dy * mouse.vx) / (dd * 900)) * 60 * dt * 60;
        }
        g.vx += (fx - g.ox * 28) * dt; g.vy += (fy - g.oy * 28) * dt;
        g.vx *= Math.exp(-5.5 * dt); g.vy *= Math.exp(-5.5 * dt);
        g.ox += g.vx * dt; g.oy += g.vy * dt;
        const lim = Math.min(vw, vh) * 0.09;
        g.ox = clamp(g.ox, -lim, lim); g.oy = clamp(g.oy, -lim, lim);
        g.vr += -g.ro * 22 * dt; g.vr *= Math.exp(-4 * dt); g.ro = clamp(g.ro + g.vr * dt, -18, 18);
      } else { g.ox = damp(g.ox, 0, 8, dt); g.oy = damp(g.oy, 0, 8, dt); g.ro = damp(g.ro, 0, 8, dt); }
      const disp = Math.hypot(g.ox, g.oy);
      const x = ix + g.ox + par[0] * 0.8, y = iy + g.oy + par[1] * 0.8;
      g.el.style.transform = `translate3d(${(x - g.w / 2).toFixed(1)}px,${(y - g.h / 2).toFixed(1)}px,0) rotate(${(rotI + g.ro).toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      g.el.style.opacity = String(seg(u, 0, 0.06));
      const air = 1 - E.outCubic(u) + disp / 160;
      const sh = 3 + air * 26, bl = 3 + air * 20;
      g.el.style.filter = `drop-shadow(${(sh * 0.55).toFixed(1)}px ${sh.toFixed(1)}px ${bl.toFixed(1)}px rgba(48,8,8,${(0.42 - air * 0.12).toFixed(2)}))`;
    });

    /* --- interfaz --- */
    const heroO = (1 - E.inOutCubic(seg(p, T.heroOut[0], T.heroOut[1]))) * E.outCubic(seg(S.intro, 0.3, 0.7));
    hero.style.opacity = String(heroO);
    hero.style.display = heroO <= 0.001 ? 'none' : 'block';
    hero.style.transform = `translate3d(${(-mouse.nx * 10).toFixed(1)}px, calc(-50% + ${(-seg(p, 0, 0.06) * 60 - mouse.ny * 6).toFixed(1)}px), 0)`;
    heroChars.forEach((ch, i) => {
      const a = E.outCubic(seg(S.intro, 0.34 + i * 0.03, 0.62 + i * 0.03));
      const depth = (i % 5) - 2;
      ch.style.opacity = String(a);
      ch.style.transform = `translate3d(${(mouse.nx * depth * 2.4).toFixed(1)}px,${((1 - a) * 46 + mouse.ny * depth * 1.6).toFixed(1)}px,0)`;
    });
    const hintO = (1 - seg(p, 0.004, 0.025)) * E.outCubic(seg(S.intro, 0.75, 1));
    hint.style.opacity = String(hintO);
    hint.style.display = hintO <= 0.001 ? 'none' : 'flex';
    hint.style.transform = 'translateX(-50%)';
    const wheel = (t * 0.8) % 1;
    hint.querySelector('.mouse i').style.transform = `translateY(${(E.outCubic(wheel) * 12).toFixed(1)}px)`;
    hint.querySelector('.mouse i').style.opacity = String(1 - wheel);

    const hudO = seg(p, 0.07, 0.11) * (1 - seg(p, 0.775, 0.81));
    hud.style.opacity = String(hudO);
    hud.style.display = hudO <= 0.001 ? 'none' : 'flex';
    hud.style.transform = `translateX(-50%) translateY(${((1 - hudO) * -10).toFixed(1)}px)`;
    const jf = clamp((cr - 0.02) / 0.96, 0, 1);
    hudFill.style.width = (jf * 100).toFixed(2) + '%';
    hudPlane.style.left = (jf * 100).toFixed(2) + '%';
    hudKm.textContent = fmtKm((CFG.distanceKm || 9411) * jf);
    const [lat, lon] = greatCircle(jf);
    hudCoords.textContent = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'O'}`;

    caps.forEach((cp, k) => {
      let w = clamp(1 - Math.abs(zf - k) * 1.9, 0, 1);
      if (k === 0) w *= seg(p, 0.075, 0.11);
      if (k === N - 1) w *= 1 - seg(p, 0.79, 0.825);
      w *= seg(p, 0.07, 0.1) > 0 || k > 0 ? 1 : 0;
      cp.w = damp(cp.w, w, 10, dt);
      cp.el.style.opacity = String(E.inOutSine(cp.w));
      cp.el.style.display = cp.w < 0.002 ? 'none' : 'block';
      cp.el.style.transform = `translate3d(${(-mouse.nx * 6).toFixed(1)}px,${((1 - cp.w) * 26).toFixed(1)}px,0)`;
    });

    const uiO = E.outCubic(seg(p, T.ui[0], T.ui[1])) * (S.modalOpen ? 0 : 1);
    tableUI.style.opacity = String(uiO);
    tableUI.style.display = uiO <= 0.001 ? 'none' : 'flex';
    tableUI.querySelector('.replay').style.pointerEvents = uiO > 0.5 ? 'auto' : 'none';

    /* --- luz y efectos --- */
    const tPhase = seg(p, 0.88, 0.97);
    const lx = mouse.sx.toFixed(0), ly = mouse.sy.toFixed(0);
    const sunA = (0.26 * (1 - tPhase)).toFixed(3);
    const candleA = (0.55 * tPhase).toFixed(3);
    fxLight.style.background =
      `radial-gradient(circle at ${lx}px ${ly}px, rgba(255,214,150,${sunA}) 0, rgba(255,214,150,0) ${Math.round(Math.max(vw, vh) * 0.32)}px),` +
      `radial-gradient(circle at ${lx}px ${ly}px, rgba(255,196,120,${candleA}) 0, rgba(255,170,90,${(0.16 * tPhase).toFixed(3)}) ${Math.round(Math.max(vw, vh) * 0.14)}px, rgba(0,0,0,0) ${Math.round(Math.max(vw, vh) * 0.34)}px)`;
    tableGlow.style.background = `radial-gradient(circle at ${((mouse.sx / vw) * 100).toFixed(1)}% ${((mouse.sy / vh) * 100).toFixed(1)}%, rgba(255,236,200,${(0.25 * tPhase).toFixed(3)}), rgba(40,10,0,${(0.22 * tPhase).toFixed(3)}) 70%)`;
    fxVig.style.opacity = String(0.85 + tPhase * 0.35);
    const flash = Math.sin(Math.PI * seg(p, 0.862, 0.905));
    fxFlash.style.opacity = String((flash * 0.22).toFixed(3));
    fxFlash.style.display = flash > 0.001 ? 'block' : 'none';
    const gs = Math.floor(t * 24);
    fxGrain.style.backgroundPosition = `${(gs * 37) % 220}px ${(gs * 71) % 220}px`;

    /* --- cursor --- */
    if (finePointer) {
      const under = document.elementFromPoint(mouse.x, mouse.y);
      const tgt = under && under.closest ? under.closest('[data-cursor]') : null;
      let label = tgt ? tgt.dataset.cursor : '';
      if (tgt && tgt.classList.contains('plate') && !tgt.classList.contains('live')) label = '';
      if (label) S.cur.label = label;
      S.cur.grow = damp(S.cur.grow, label ? 1 : 0, 12, dt);
      S.cur.labelO = damp(S.cur.labelO, label ? 1 : 0, 14, dt);
      cLabel.textContent = S.cur.label;
      const size = 44 + S.cur.grow * 44;
      cRing.style.width = cRing.style.height = size + 'px';
      cRing.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`;
      cRing.style.background = `rgba(246,239,224,${(S.cur.grow * 0.92).toFixed(3)})`;
      cRing.style.borderColor = `rgba(246,239,224,${(0.9 - S.cur.grow * 0.4).toFixed(3)})`;
      cLabel.style.opacity = String(S.cur.labelO);
      cDot.style.opacity = String(1 - S.cur.grow);
      cursor.style.transform = `translate3d(${mouse.sx.toFixed(1)}px,${mouse.sy.toFixed(1)}px,0)`;
      cDot.style.transform = `translate3d(${(mouse.x - mouse.sx).toFixed(1)}px,${(mouse.y - mouse.sy).toFixed(1)}px,0)`;
      cursor.style.opacity = mouse.moved ? '1' : '0';
    }

    for (let i = 0; i < hooks.length; i++) hooks[i](dt, t);
  }

  /* ---------- arranque ---------- */
  layout();
  addEventListener('resize', layout);
  readScroll();
  S.p = S.target;

  const ready = Promise.all([Promise.all(waits), document.fonts ? document.fonts.ready : Promise.resolve()]).then(() => {
    S.ready = true; S.readyAt = AR.time;
  });
  window.__arReady = ready;

  if (AR.rec) {
    window.__arTick = (ms) => frame(ms / 1000);
    window.__arSkipIntro = () => { S.readyAt = AR.time - 3; S.intro = 1; };
  } else {
    let last = performance.now();
    const loop = (now) => { frame((now - last) / 1000); last = now; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
})();
