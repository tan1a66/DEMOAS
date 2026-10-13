/* Antica Roma — Mérida · La carta: libro 3D interactivo (js/book.js)

   API:  AR.book = { mount(container), onOpen(), onClose(), update(dt, t) }   (+ next(), prev(), go(page), state())

   - El sistema de modales llama mount() una vez y onOpen()/onClose() al abrir/cerrar.
   - Todo el movimiento ocurre en update(), registrado con AR.onFrame: nada de transiciones CSS,
     setTimeout ni requestAnimationFrame propios (el video se graba con un reloj virtual).
   - Hojas de papel: tiras verticales encadenadas en 3D (curvatura real) con sombreado por tira.
     Tapas: tablero rígido con canto. Esquinas: pliegue diagonal 3D que sigue al puntero.
   - Si AR.config.menuPages trae imágenes, cada página muestra su imagen; si no, la carta de ejemplo. */
(function () {
  'use strict';
  var AR = (window.AR = window.AR || {});

  var REF_W = 560, REF_H = 800, REF_O = 16;          // página y vuelo de la tapa, en px de diseño
  var DEG = Math.PI / 180;
  var BREAK = 760;                                    // < 760px: una sola página

  /* ───────────────────────── utilidades ───────────────────────── */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function damp(c, t, l, dt) { return c + (t - c) * (1 - Math.exp(-l * dt)); }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function inOutSine(t) { return -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2; }
  function outCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function f2(v) { return Math.round(v * 100) / 100; }
  function f3(v) { return Math.round(v * 1000) / 1000; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ───────────────────────── carta de ejemplo ───────────────────────── */
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
  var SAMPLE = [
    { t: 'cover' },
    { t: 'welcome' },
    {
      t: 'list', kick: 'Para empezar', title: 'Antipasti',
      items: [
        ['Supplì al telefono', 'Croqueta romana de arroz al ragù con corazón de mozzarella que se estira como un cable de teléfono.', 185],
        ['Carciofi alla giudia', 'Alcachofas fritas dos veces, al estilo del antiguo gueto judío de Roma.', 265],
        ['Bruschetta al pomodoro', 'Pan tostado a la leña, jitomate maduro, albahaca y aceite de oliva extra virgen.', 185],
        ['Burrata e prosciutto di Parma', 'Burrata cremosa con prosciutto di Parma y focaccia de la casa.', 345],
        ['Fiori di zucca fritti', 'Flores de calabaza rellenas de mozzarella y anchoa, en tempura ligera.', 225],
      ],
    },
    {
      t: 'list', kick: 'La tradición de Roma', title: 'Le Paste Romane',
      note: 'Las cuatro recetas que definen la cocina romana, como en Roma: con pecorino romano D.O.P. y guanciale curado, sin crema y sin atajos.',
      items: [
        ['Cacio e pepe', 'Tonnarelli, pecorino romano y pimienta negra recién molida.', 265],
        ['Carbonara', 'Rigatoni, guanciale dorado, yema de huevo, pecorino y pimienta.', 295],
        ['Amatriciana', 'Bucatini, guanciale, jitomate San Marzano y pecorino romano.', 285],
        ['Gricia', 'Mezze maniche, guanciale y pecorino: la abuela de la amatriciana.', 275],
      ],
      badges: ['Pecorino romano', 'Guanciale', 'Pepe nero'],
    },
    {
      t: 'list', kick: 'Hecha a mano cada día', title: 'Pasta Fresca',
      note: 'Amasada cada mañana en nuestra cocina con harina de sémola y huevo, y cortada a cuchillo.',
      items: [
        ['Fettuccine al ragù', 'Ragù de res y cerdo cocinado a fuego lento durante seis horas.', 315],
        ['Tagliatelle ai funghi porcini', 'Hongos porcini, mantequilla, salvia y parmigiano reggiano.', 345],
        ['Ravioli di ricotta e spinaci', 'Rellenos de ricotta y espinaca, con mantequilla dorada y salvia.', 295],
        ['Lasagna della nonna', 'Capas de pasta al huevo, ragù, besciamella y parmigiano, gratinada al horno.', 325],
      ],
    },
    {
      t: 'list', kick: 'Platos fuertes', title: 'Secondi',
      items: [
        ['Saltimbocca alla romana', 'Escalopas de ternera con prosciutto y salvia, al vino blanco.', 385],
        ['Abbacchio a scottadito', 'Chuletas de cordero a la brasa con romero y papas al horno.', 410],
        ['Pollo alla romana con peperoni', 'Pollo guisado con pimientos, jitomate y vino blanco, el clásico del verano romano.', 335],
        ['Filetto al pepe verde', 'Filete de res con salsa de pimienta verde y un toque de brandy.', 420],
      ],
    },
    {
      t: 'list', kick: 'Para terminar', title: 'Dolci & Caffè',
      items: [
        ['Tiramisù', 'Mascarpone, savoiardi y café espresso, con cacao amargo.', 195],
        ['Maritozzo con la panna', 'Bollo dulce romano, abierto y relleno de nata montada.', 165],
        ['Panna cotta ai frutti rossi', 'Crema cocida de vainilla con coulis de frutos rojos.', 175],
        ['Cannolo siciliano', 'Barquillo crujiente relleno de ricotta dulce, pistache y naranja confitada.', 185],
      ],
      sec: 'Caffè e digestivi',
      items2: [
        ['Espresso', 'Tostado italiano, corto e intenso.', 65],
        ['Limoncello', 'Licor de limón de la costa amalfitana, servido helado.', 120],
      ],
    },
    { t: 'back' },
  ];

  /* ───────────────────────── ornamentos SVG ───────────────────────── */
  function leafAt(x, y, ang, L, w, fill) {
    var d = 'M0 0C' + f2(L * 0.22) + ' ' + f2(-w * 1.25) + ' ' + f2(L * 0.68) + ' ' + f2(-w * 0.95) + ' ' + f2(L) + ' 0C' +
      f2(L * 0.68) + ' ' + f2(w * 0.95) + ' ' + f2(L * 0.22) + ' ' + f2(w * 1.25) + ' 0 0Z';
    return '<path transform="translate(' + f2(x) + ' ' + f2(y) + ') rotate(' + f2(ang) + ')" d="' + d + '" fill="' + fill + '"/>' +
      '<path transform="translate(' + f2(x) + ' ' + f2(y) + ') rotate(' + f2(ang) + ')" d="M' + f2(L * 0.12) + ' 0L' + f2(L * 0.82) + ' 0" stroke="rgba(70,40,8,.45)" stroke-width=".55" fill="none"/>';
  }
  function polar(cx, cy, r, a) { return [cx + r * Math.cos(a * DEG), cy + r * Math.sin(a * DEG)]; }
  function laurelSVG(cls, opt) {
    opt = opt || {};
    var cx = 100, cy = 100, r = opt.r || 72, n = opt.n || 11, a0 = 102, a1 = opt.a1 || 252, fill = 'url(#bkGoldG)';
    var g = '', p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1);
    g += '<path d="M' + f2(p0[0]) + ' ' + f2(p0[1]) + 'A' + r + ' ' + r + ' 0 0 1 ' + f2(p1[0]) + ' ' + f2(p1[1]) + '" fill="none" stroke="url(#bkGoldS)" stroke-width="2.1" stroke-linecap="round"/>';
    for (var i = 0; i < n; i++) {
      var t = (i + 0.4) / n, a = a0 + (a1 - a0) * t, P = polar(cx, cy, r, a), tang = a + 90;
      var Lz = 26 * (1 - 0.42 * t), wz = Lz * 0.25;
      g += leafAt(P[0], P[1], tang - 44, Lz, wz, fill) + leafAt(P[0], P[1], tang + 36, Lz * 0.9, wz * 0.95, fill);
      if (i % 3 === 1) { var B = polar(cx, cy, r + 11, a + 4); g += '<circle cx="' + f2(B[0]) + '" cy="' + f2(B[1]) + '" r="2.7" fill="' + fill + '"/>'; }
    }
    g += leafAt(p1[0], p1[1], a1 + 86, 19, 4.6, fill);
    var ribbon = '<path d="M' + f2(p0[0]) + ' ' + f2(p0[1]) + 'Q100 ' + f2(p0[1] + 16) + ' 116 ' + f2(p0[1] + 20) + 'M' + f2(200 - p0[0]) + ' ' + f2(p0[1]) +
      'Q100 ' + f2(p0[1] + 16) + ' 84 ' + f2(p0[1] + 20) + '" fill="none" stroke="url(#bkGoldS)" stroke-width="2.1" stroke-linecap="round"/>' +
      '<circle cx="100" cy="' + f2(p0[1] + 11) + '" r="3.6" fill="' + fill + '"/>';
    return '<svg class="' + cls + '" viewBox="0 0 200 200" aria-hidden="true"><g>' + g + '</g><g transform="translate(200 0) scale(-1 1)">' + g + '</g>' + ribbon + '</svg>';
  }
  function sprigSVG(flip) {
    var g = '<path d="M44 9.5Q24 11.5 4 8" fill="none" stroke="#a9853d" stroke-width=".9"/>';
    for (var i = 0; i < 4; i++) {
      var t = (i + 0.55) / 4.4, x = 44 - 40 * t, y = 9.5 + Math.sin(t * Math.PI) * 0.9 - t * 1.6, L = 10.5 * (1 - 0.3 * t);
      g += leafAt(x, y, 180 + 34, L, L * 0.24, '#b28f45') + leafAt(x, y, 180 - 30, L * 0.9, L * 0.22, '#b28f45');
    }
    g += leafAt(4, 8, 186, 7.5, 1.8, '#b28f45');
    return '<svg viewBox="0 0 46 18" aria-hidden="true"' + (flip ? ' style="transform:scaleX(-1)"' : '') + '>' + g + '</svg>';
  }
  function dividerSVG(gold) {
    var c = gold ? '#cdae62' : '#ad8a41', f = gold ? 'url(#bkGoldG)' : '#b8964c';
    return '<svg class="bk-div" viewBox="0 0 220 12" aria-hidden="true">' +
      '<path d="M10 6H90M130 6H210" stroke="' + c + '" stroke-width="' + (gold ? 1.2 : 0.8) + '"/>' +
      '<path d="M110 .8L115.2 6 110 11.2 104.8 6Z" fill="' + f + '"/>' +
      '<path d="M110 3.6L112.4 6 110 8.4 107.6 6Z" fill="' + (gold ? '#5a0e12' : '#f6eddb') + '"/>' +
      '<circle cx="97" cy="6" r="1.7" fill="' + f + '"/><circle cx="123" cy="6" r="1.7" fill="' + f + '"/>' +
      '<circle cx="5" cy="6" r="1.2" fill="' + f + '"/><circle cx="215" cy="6" r="1.2" fill="' + f + '"/></svg>';
  }
  var CORNER = '<svg viewBox="0 0 22 22" aria-hidden="true"><path d="M1 21V7.5A6.5 6.5 0 0 1 7.5 1H21" fill="none" stroke="#a9823a" stroke-width="1"/>' +
    '<path d="M7 7l3.2 1.4L7 9.8 3.8 8.4z" fill="#b8964c"/><circle cx="7" cy="8.4" r=".9" fill="#f6eddb"/></svg>';
  var CV_CORNER = '<svg viewBox="0 0 34 34" aria-hidden="true"><path d="M2 32V14Q2 2 14 2H32" fill="none" stroke="url(#bkGoldS)" stroke-width="1.6"/>' +
    '<path d="M9 9l6 2.6L9 14.2 3 11.6z" transform="rotate(45 9 11.6)" fill="url(#bkGoldG)"/></svg>';
  var WA_ICON = '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="url(#bkGoldG)" d="M16 3.2A12.7 12.7 0 0 0 5.1 22.4L3.3 28.8l6.6-1.7A12.7 12.7 0 1 0 16 3.2zm0 23.2a10.5 10.5 0 0 1-5.4-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.5 10.5 0 1 1 16 26.4zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.6 8.6 0 0 1-4.3-3.7c-.3-.6.3-.5.9-1.7a.6.6 0 0 0 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .9 2.8.9 3.8.8a3.3 3.3 0 0 0 2.1-1.5 2.7 2.7 0 0 0 .2-1.5c-.1-.2-.3-.3-.6-.4z"/></svg>';
  var DEFS = '<svg class="bk-defs" aria-hidden="true" focusable="false"><defs>' +
    '<linearGradient id="bkGoldG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbeab0"/><stop offset=".3" stop-color="#ddb965"/>' +
    '<stop offset=".55" stop-color="#9a7428"/><stop offset=".78" stop-color="#e6c97b"/><stop offset="1" stop-color="#b08838"/></linearGradient>' +
    '<linearGradient id="bkGoldS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1d995"/><stop offset=".5" stop-color="#b38b3c"/><stop offset="1" stop-color="#e2c37a"/></linearGradient>' +
    '</defs></svg>';

  /* ───────────────────────── contenido de las páginas ───────────────────────── */
  function money(v) { return '$' + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function itemsHTML(list, sm) {
    return list.map(function (it) {
      return '<li class="bk-it' + (sm ? ' sm' : '') + '"><div class="bk-it-row"><span class="bk-it-name">' + esc(it[0]) +
        '</span><span class="bk-it-dots" aria-hidden="true"></span><span class="bk-it-price">' + money(it[2]) + '</span></div>' +
        '<div class="bk-it-desc">' + esc(it[1]) + '</div></li>';
    }).join('');
  }
  function frameHTML() {
    return '<div class="bk-frame" aria-hidden="true"></div>' +
      '<div class="bk-corner tl" aria-hidden="true">' + CORNER + '</div><div class="bk-corner tr" aria-hidden="true">' + CORNER + '</div>' +
      '<div class="bk-corner bl" aria-hidden="true">' + CORNER + '</div><div class="bk-corner br" aria-hidden="true">' + CORNER + '</div>';
  }
  function footHTML(num) {
    return '<div class="bk-foot"><div class="bk-num">' + (ROMAN[num] || num) + '</div><div class="bk-sample">Carta de ejemplo</div></div>';
  }
  function sampleContent(i) {
    var p = SAMPLE[i], num = i + 1;
    if (p.t === 'welcome') {
      return '<div class="bk-pg bk-welcome">' + frameHTML() +
        '<div class="bk-head"><div class="bk-kick">Antica Roma · Mérida</div>' +
        '<div class="bk-h">' + sprigSVG(false) + '<span>Benvenuti</span>' + sprigSVG(true) + '</div>' +
        '<div class="bk-sub">Bienvenidos a nuestra mesa</div></div>' +
        '<div class="bk-arch" role="img" aria-label="Manos cortando tagliatelle frescas sobre una tabla enharinada"><div class="bk-arch-in" style="background-image:url(\'assets/story.webp\')"></div></div>' +
        '<p class="bk-body">En Antica Roma cocinamos como en las trattorie de Roma: <em>cocina romana de tradición</em>, sin atajos. ' +
        'Cada mañana amasamos a mano nuestra <em>pasta fresca</em>, y los ingredientes que la hacen única —pecorino, guanciale, ' +
        'aceite de oliva, harina de sémola— viajan desde Italia hasta Mérida para llegar a su mesa.</p>' +
        '<div class="bk-sign">Buon appetito.</div>' + footHTML(num) + '</div>';
    }
    var h = '<div class="bk-pg">' + frameHTML() + '<div class="bk-head"><div class="bk-kick">' + esc(p.kick) + '</div>' +
      '<div class="bk-h">' + sprigSVG(false) + '<span>' + esc(p.title) + '</span>' + sprigSVG(true) + '</div>' + dividerSVG(false) +
      (p.note ? '<p class="bk-note">' + esc(p.note) + '</p>' : '') + '</div>' +
      '<ul class="bk-items">' + itemsHTML(p.items) +
      (p.items2 ? '<li class="bk-sec" aria-hidden="false">' + esc(p.sec) + '</li>' + itemsHTML(p.items2, true) : '') + '</ul>';
    if (p.badges) h += '<div class="bk-badges">' + p.badges.map(function (b) { return '<span class="bk-badge">' + esc(b) + '</span>'; }).join('') + '</div>';
    return h + footHTML(num) + '</div>';
  }
  function coverInner(side) {
    var c = '<div class="bk-cv ' + side + '"><div class="bk-cv-frame" aria-hidden="true"></div>' + cvCorners(side) + '<div class="bk-cv-in">' +
      '<div class="bk-cv-top bk-gold bk-emb">Cucina Romana · Mérida</div>' +
      '<div class="bk-cv-wreath bk-emb">' + laurelSVG('', {}) + '<div class="bk-cv-mono bk-gold">AR</div></div>' +
      '<div class="bk-cv-title bk-gold bk-emb">Antica<br>Roma</div>' +
      '<div class="bk-emb">' + dividerSVG(true) + '</div>' +
      '<div class="bk-cv-sub bk-gold bk-emb">La Carta</div>' +
      '</div></div>';
    return c;
  }
  function backInner(side) {
    var wa = (AR.config && AR.config.whatsapp && AR.config.whatsapp.display) || '';
    return '<div class="bk-cv ' + side + '"><div class="bk-cv-frame" aria-hidden="true"></div>' + cvCorners(side) + '<div class="bk-cv-in">' +
      '<div class="bk-cv-wreath bk-emb" style="width:170px;height:170px;margin-top:0">' + laurelSVG('', { n: 10 }) + '<div class="bk-cv-mono bk-gold" style="font-size:44px">AR</div></div>' +
      '<div class="bk-cv-grazie bk-gold bk-emb">Grazie · Gracias</div>' +
      '<div class="bk-emb">' + dividerSVG(true) + '</div>' +
      '<div class="bk-cv-name bk-gold bk-emb">Antica Roma</div>' +
      '<div class="bk-cv-small">Cucina romana · Mérida, Yucatán</div>' +
      '<div class="bk-cv-wa bk-emb">' + WA_ICON + '<span>Reserva por WhatsApp</span>' + (wa ? '<b>' + esc(wa) + '</b>' : '') + '</div>' +
      '</div></div>';
  }
  function cvCorners(side) {
    var l = side === 'r' ? 74 : 34, r = side === 'r' ? 34 : 74, s = '';
    s += '<div class="bk-cv-corner" style="left:' + (l + 12) + 'px;top:46px">' + CV_CORNER + '</div>';
    s += '<div class="bk-cv-corner" style="right:' + (r + 12) + 'px;top:46px;transform:scaleX(-1)">' + CV_CORNER + '</div>';
    s += '<div class="bk-cv-corner" style="left:' + (l + 12) + 'px;bottom:46px;transform:scaleY(-1)">' + CV_CORNER + '</div>';
    s += '<div class="bk-cv-corner" style="right:' + (r + 12) + 'px;bottom:46px;transform:scale(-1,-1)">' + CV_CORNER + '</div>';
    return s;
  }

  /* ───────────────────────── estado ───────────────────────── */
  var S = {
    mounted: false, open: false, built: false,
    host: null, root: null, stage: null, book: null, lStatic: null, lPeel: null, lFlip: null,
    mode: '', W: 0, H: 0, O: 0, k: 1, P: 2000, cw: 0, ch: 0, uiH: 100, bookX: 0, bookY: 0, shift: 0, nStrips: 12,
    pages: [], images: false, leaves: [], s: 0,
    now: 0, openAt: 0, lastLaunch: -9, intro: 1, interacted: false,
    tx: 0, ty: 0,
    pointer: { x: -1e4, y: -1e4, inside: false, rr: null },
    drag: null,
    peel: { leaf: -1, side: 'r', cy: 1, gx: 0, gy: 0, key: '', shown: false, clipEl: null },
    zones: {}, linesKey: '', ui: {},
  };

  function readPages() {
    var imgs = (AR.config && AR.config.menuPages) || [];
    if (imgs && imgs.length) {
      S.images = true;
      S.pages = imgs.map(function (src) { return { t: 'img', src: src }; });
    } else {
      S.images = false;
      S.pages = SAMPLE;
    }
  }
  function pageInner(i, side) {
    var p = S.pages[i], c;
    if (p.t === 'img') c = '<div class="bk-img" role="img" aria-label="Página ' + (i + 1) + ' de la carta" style="background-image:url(\'' + String(p.src).replace(/'/g, '%27') + '\')"></div>';
    else c = sampleContent(i);
    return c + '<div class="bk-gut ' + side + '"></div>';
  }

  /* ───────────────────────── caras y hojas ───────────────────────── */
  function isBoard(f) { return f.kind === 'cover' || f.kind === 'backcover' || f.kind === 'board' || f.kind === 'boardbare'; }
  function sheetHTML(f) {
    var side = f.side;
    if (f.kind === 'paper' || f.kind === 'image') return '<div class="bk-sc"><div class="bk-pp ' + side + '">' + pageInner(f.page, side) + '</div></div>';
    if (f.kind === 'blank') return '<div class="bk-sc"><div class="bk-pp ' + side + '"><div class="bk-gut ' + side + '"></div></div></div>';
    var inner = '', leatherCls = 'bk-leather ' + side;
    if (f.kind === 'cover') inner = coverInner(side);
    else if (f.kind === 'backcover') inner = backInner(side);
    else if (f.kind === 'board') { inner = '<div class="bk-pp bk-inset ' + side + '">' + pageInner(f.page, side) + '</div>'; leatherCls += ' in'; }
    else leatherCls += ' in';
    var sheen = (f.kind === 'cover' || f.kind === 'backcover') ? '<div class="bk-sheen" aria-hidden="true"><i></i></div>' : '';
    return '<div class="' + leatherCls + '"></div><div class="bk-sc bd">' + inner + '</div>' + sheen;
  }
  function sheetCls(f) { return 'bk-sheet ' + (isBoard(f) ? 'bk-bdsz' : 'bk-pgsz'); }

  function makeLeaves(mode) {
    var N = S.pages.length, sample = !S.images, out = [];
    function face(pi, side, hard) {
      if (pi == null || pi >= N) return { kind: hard ? 'boardbare' : 'blank', side: side, page: -1 };
      var p = S.pages[pi];
      if (p.t === 'cover') return { kind: 'cover', side: side, page: pi };
      if (p.t === 'back') return { kind: 'backcover', side: side, page: pi };
      if (p.t === 'img') return { kind: 'image', side: side, page: pi };
      return { kind: hard ? 'board' : 'paper', side: side, page: pi };
    }
    var i, hard;
    if (mode === 'double') {
      var n = Math.ceil(N / 2);
      for (i = 0; i < n; i++) {
        hard = sample && (i === 0 || i === n - 1);
        out.push(newLeaf(i, face(2 * i, 'r', hard), face(2 * i + 1 < N ? 2 * i + 1 : null, 'l', hard), hard));
      }
    } else {
      for (i = 0; i < N; i++) {
        hard = sample && (i === 0 || i === N - 1);
        out.push(newLeaf(i, face(i, 'r', hard), face(null, 'l', hard), hard));
      }
    }
    return out;
  }
  function newLeaf(i, front, back, hard) {
    return { i: i, front: front, back: back, hard: hard, theta: 0, vel: 0, goal: 0, q: null, curl: 0, dir: 1, lift: 0, liftT: 0,
      drag: false, flying: false, sf: null, sb: null, fl: null, strips: [], shF: null, shB: null, vf: null, vb: null, vfl: null, z: -1 };
  }

  function buildFlight(L) {
    var leaf = el('div', 'bk-leaf ' + (L.hard ? 'hard' : 'soft'));
    leaf.setAttribute('aria-hidden', 'true');
    if (L.hard) {
      leaf.innerHTML =
        '<div class="bk-hf f"><div class="' + sheetCls(L.front) + '">' + sheetHTML(L.front) + '</div><i class="bk-sh"></i></div>' +
        '<div class="bk-hf b"><div class="' + sheetCls(L.back) + '">' + sheetHTML(L.back) + '</div><i class="bk-sh"></i></div>' +
        '<div class="bk-hedge"></div>';
      L.shF = leaf.children[0].lastChild;
      L.shB = leaf.children[1].lastChild;
    } else {
      var n = S.nStrips, html = '', fh = sheetHTML(L.front), bh = sheetHTML(L.back), fc = sheetCls(L.front), bc = sheetCls(L.back);
      for (var j = 0; j < n; j++) {
        html += '<div class="bk-strip" style="width:calc(var(--bk-w) / ' + n + ' + 1px)">' +
          '<div class="bk-sf f"><div class="' + fc + '" style="left:calc(var(--bk-w) * ' + f3(-j / n) + ')">' + fh + '</div><i class="bk-sh"></i></div>' +
          '<div class="bk-sf b"><div class="' + bc + '" style="left:calc(var(--bk-w) * ' + f3((j + 1 - n) / n) + ' + 1px)">' + bh + '</div><i class="bk-sh"></i></div>' +
          '</div>';
      }
      leaf.innerHTML = html;
      L.strips = [];
      for (var k = 0; k < leaf.children.length; k++) {
        var st = leaf.children[k];
        L.strips.push({ el: st, shF: st.children[0].lastChild, shB: st.children[1].lastChild, tr: '', gf: '', gb: '' });
      }
    }
    return leaf;
  }

  function pageLabel(f) {
    if (f.page < 0) return '';
    return 'Página ' + (f.page + 1) + ' de ' + S.pages.length;
  }
  function build() {
    S.lStatic.innerHTML = '';
    S.lFlip.innerHTML = '';
    S.lPeel.innerHTML = '';
    S.leaves = makeLeaves(S.mode);
    var n = S.leaves.length;

    S.shadowL = el('div', 'bk-bshadow l'); S.shadowR = el('div', 'bk-bshadow r');
    S.book.insertBefore(S.shadowL, S.book.firstChild);
    S.book.insertBefore(S.shadowR, S.book.firstChild);
    S.linesR = el('div', 'bk-lay'); S.linesL = el('div', 'bk-lay');
    S.lStatic.appendChild(S.linesR); S.lStatic.appendChild(S.linesL);

    S.leaves.forEach(function (L, i) {
      L.sf = el('div', sheetCls(L.front) + ' bk-sface r', sheetHTML(L.front));
      L.sf.style.zIndex = String(60 - i);
      L.sf.setAttribute('role', 'group');
      if (pageLabel(L.front)) L.sf.setAttribute('aria-label', pageLabel(L.front));
      S.lStatic.appendChild(L.sf);
      if (S.mode === 'double') {
        L.sb = el('div', sheetCls(L.back) + ' bk-sface l', sheetHTML(L.back));
        L.sb.style.zIndex = String(10 + i);
        L.sb.setAttribute('role', 'group');
        if (pageLabel(L.back)) L.sb.setAttribute('aria-label', pageLabel(L.back));
        S.lStatic.appendChild(L.sb);
      }
      L.fl = buildFlight(L);
      S.lFlip.appendChild(L.fl);
      L.vf = L.vb = L.vfl = null;
    });

    S.castR = el('div', 'bk-cast r'); S.castL = el('div', 'bk-cast l');
    S.spine = el('div', 'bk-spine');
    S.peelSh = el('div', 'bk-peelsh');
    [S.castR, S.castL, S.spine, S.peelSh].forEach(function (e) { e.setAttribute('aria-hidden', 'true'); S.lStatic.appendChild(e); });

    S.peelW = el('div', 'bk-peelw');
    S.peelW.setAttribute('aria-hidden', 'true');
    S.flap = el('div', 'bk-flap');
    S.flapA = el('div', 'bk-pf a'); S.flapB = el('div', 'bk-pf b');
    S.flap.appendChild(S.flapA); S.flap.appendChild(S.flapB);
    S.peelW.appendChild(S.flap);
    S.lPeel.appendChild(S.peelW);
    S.peel = { leaf: -1, side: 'r', cy: 1, gx: 0, gy: 0, key: '', shown: false, clipEl: null };
    S.linesKey = '';
    S.root.classList.toggle('single', S.mode === 'single');
    S.built = true;
    applyState(true);
    updateUI();
  }

  /* reposiciona instantáneamente las hojas según S.s (sin animación) */
  function applyState(hard) {
    S.leaves.forEach(function (L, i) {
      var g = i < S.s ? 180 : 0;
      L.goal = g; L.q = null;
      if (hard) { L.theta = g; L.vel = 0; L.curl = 0; L.lift = 0; L.liftT = 0; L.drag = false; }
    });
  }

  /* ───────────────────────── geometría y layout ───────────────────────── */
  function layout() {
    var cw = S.cw, ch = S.ch;
    var mode = cw < BREAK ? 'single' : 'double';
    var uiH = mode === 'single' ? 112 : 112;
    var oR = REF_O / REF_H, H;
    var availH = Math.min(ch * (mode === 'single' ? 0.8 : 0.82), ch - uiH - (mode === 'single' ? 20 : 40));
    if (mode === 'double') {
      var maxW = Math.min(cw * 0.92, 1500);
      H = Math.min(availH / (1 + 2 * oR), maxW / (2 * (REF_W / REF_H) + 2 * oR));
    } else {
      H = Math.min(availH / (1 + 2 * oR), (cw - 28) / (REF_W / REF_H + oR));
    }
    H = Math.max(160, H);
    var W = Math.round(H * REF_W / REF_H);
    H = Math.round(W * REF_H / REF_W);
    S.W = W; S.H = H; S.k = W / REF_W; S.O = Math.round(REF_O * S.k * 100) / 100;
    S.uiH = uiH;
    S.P = mode === 'double' ? Math.round(W * 5) : Math.round(W * 4.4);
    var stageH = ch - uiH;
    S.bookX = (cw - 2 * W) / 2;
    S.bookY = Math.max(S.O + 6, (stageH - H) / 2 + (mode === 'double' ? 6 : 4));
    var r = S.root.style;
    r.setProperty('--bk-w', W + 'px');
    r.setProperty('--bk-h', H + 'px');
    r.setProperty('--bk-o', S.O + 'px');
    r.setProperty('--bk-k', String(f3(S.k)));
    r.setProperty('--bk-t', Math.max(3, Math.round(5 * S.k)) + 'px');
    S.stage.style.height = stageH + 'px';
    S.book.style.left = S.bookX + 'px';
    S.book.style.top = S.bookY + 'px';
    S.lFlip.style.perspective = S.P + 'px';
    S.lFlip.style.perspectiveOrigin = W + 'px ' + (H / 2) + 'px';
    S.ui.box.style.height = uiH + 'px';
    S.linesKey = '';
    if (mode !== S.mode) {
      var prevMode = S.mode, s = S.s;
      S.mode = mode;
      S.nStrips = mode === 'double' ? 14 : 10;
      // conservar la página que se está viendo al cambiar de modo
      if (prevMode === 'double' && mode === 'single') s = s <= 0 ? 0 : Math.min(S.pages.length - 1, 2 * s - 1);
      else if (prevMode === 'single' && mode === 'double') s = Math.floor((s + 1) / 2);
      S.s = s;
      build();
    }
    if (S.pointer.rr) S.pointer.rr = S.root.getBoundingClientRect();
  }

  /* ───────────────────────── navegación ───────────────────────── */
  function maxS() { return S.leaves.length; }
  function setS(ns) {
    ns = clamp(ns, 0, maxS());
    if (ns === S.s) return false;
    var fwd = ns > S.s;
    S.s = ns;
    var order = [];
    for (var i = 0; i < S.leaves.length; i++) order.push(i);
    if (!fwd) order.reverse();
    order.forEach(function (i) {
      var L = S.leaves[i], g = i < ns ? 180 : 0;
      if (L.drag) return;
      if (L.goal === g) { L.q = null; return; }
      if (L.q && L.q.goal === g) return;
      var at = Math.max(S.now, S.lastLaunch + 0.17);
      S.lastLaunch = at;
      L.q = { goal: g, at: at };
    });
    updateUI();
    return true;
  }
  function next() { S.interacted = true; return setS(S.s + 1); }
  function prev() { S.interacted = true; return setS(S.s - 1); }
  function go(page) {
    S.interacted = true;
    var p = clamp(Math.round(page) || 1, 1, S.pages.length);
    return setS(S.mode === 'double' ? Math.floor(p / 2) : p - 1);
  }
  function launch(L, goal) {
    L.goal = goal;
    L.dir = goal > L.theta ? 1 : -1;
    var P = S.peel;
    if (P.leaf === L.i) {
      var a = Math.min(1, Math.hypot(P.gx, P.gy) / (0.22 * S.W));
      L.curl = L.dir * 30 * a;
      L.theta = clamp(L.theta + L.dir * 4 * a, 0, 180);
      L.vel += L.dir * 60 * a;
      killPeel();
    }
  }

  /* ───────────────────────── entrada ───────────────────────── */
  function rootPoint(e) {
    var rr = S.pointer.rr || (S.pointer.rr = S.root.getBoundingClientRect());
    S.pointer.x = e.clientX - rr.left;
    S.pointer.y = e.clientY - rr.top;
  }
  function onPMove(e) {
    if (!S.open) return;
    S.pointer.rr = S.root.getBoundingClientRect();
    rootPoint(e);
    S.pointer.inside = true;
    var d = S.drag;
    if (d && d.id === e.pointerId && !d.active) {
      var dx = S.pointer.x - d.x0, dy = S.pointer.y - d.y0;
      if (dx * dx + dy * dy > 36) beginDrag(d, dx);
    }
  }
  function onPLeave(e) { if (e.pointerType !== 'touch' && !S.drag) S.pointer.inside = false; }
  function onPDown(e) {
    if (!S.open || S.drag || !S.built) return;
    if (e.button != null && e.button > 0) return;
    S.pointer.rr = S.root.getBoundingClientRect();
    rootPoint(e);
    S.pointer.inside = true;
    S.interacted = true;
    var zone = e.currentTarget.getAttribute('data-zone');
    S.drag = { id: e.pointerId, zone: zone, x0: S.pointer.x, y0: S.pointer.y, active: false, dead: false, leaf: -1, tgt: e.currentTarget };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
    e.preventDefault();
  }
  function beginDrag(d, dx) {
    var side = d.zone.charAt(0), idx, dir;
    if (S.mode === 'single') {
      if (dx < 0) { idx = S.s; dir = 1; } else { idx = S.s - 1; dir = -1; }
    } else if (side === 'r') { idx = S.s; dir = 1; } else { idx = S.s - 1; dir = -1; }
    d.active = true;
    if (idx < 0 || idx >= S.leaves.length) { d.dead = true; return; }
    var L = S.leaves[idx];
    L.q = null;
    var relX0 = d.x0 - (S.bookX + S.shift) - S.W;   // respecto al lomo
    d.leaf = idx; d.dir = dir;
    d.rel0 = relX0;
    d.cos0 = Math.cos(L.theta * DEG);
    d.r = (S.mode === 'single' && dir < 0) ? 0.55 * S.W : Math.max(Math.abs(relX0), 0.45 * S.W);
    var P = S.peel;
    if (P.leaf === idx) {
      var a = Math.min(1, Math.hypot(P.gx, P.gy) / (0.22 * S.W));
      L.curl = dir * 30 * a;
      killPeel();
    }
    L.drag = true; L.dir = dir;
  }
  function dragTheta(L) {
    var d = S.drag;
    var rel = S.pointer.x - (S.bookX + S.shift) - S.W;
    var c = clamp(d.cos0 + (rel - d.rel0) / d.r, -1, 1);
    return Math.acos(c) / DEG;
  }
  function onPUp(e) {
    var d = S.drag;
    if (!d || d.id !== e.pointerId) return;
    S.drag = null;
    try { d.tgt.releasePointerCapture(e.pointerId); } catch (_) { /* nada */ }
    if (e.pointerType === 'touch') S.pointer.inside = false;
    if (!d.active) {
      if (e.type === 'pointercancel') return;
      if (d.zone.charAt(0) === 'l') prev(); else next();
      return;
    }
    if (d.dead) return;
    var L = S.leaves[d.leaf];
    L.drag = false;
    var th = L.theta, v = L.vel, done;
    if (d.dir > 0) done = S.mode === 'single' ? (th > 48 && v > -160) || (v > 200 && th > 5) : (th > 90 && v > -220) || (v > 240 && th > 7);
    else done = S.mode === 'single' ? (th < 132 && v < 160) || (v < -200 && th < 175) : (th < 90 && v < 220) || (v < -240 && th < 173);
    if (e.type === 'pointercancel') done = false;
    var target = done ? (d.dir > 0 ? 180 : 0) : (d.dir > 0 ? 0 : 180);
    if (done) S.s = clamp(S.s + d.dir, 0, maxS());
    L.goal = target; L.q = null;
    L.dir = target > th ? 1 : -1;
    S.lastLaunch = S.now;
    updateUI();
  }
  function onKey(e) {
    if (!S.open || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); S.interacted = true; setS(0); }
    else if (e.key === 'End') { e.preventDefault(); S.interacted = true; setS(maxS()); }
  }

  /* ───────────────────────── esquina que se levanta ───────────────────────── */
  function killPeel() {
    var P = S.peel;
    P.leaf = -1; P.gx = 0; P.gy = 0;
    hidePeel();
  }
  function hidePeel() {
    var P = S.peel;
    if (P.clipEl) { P.clipEl.style.clipPath = ''; P.clipEl = null; }
    if (P.shown) { S.peelW.style.display = 'none'; S.peelSh.style.display = 'none'; P.shown = false; }
  }
  // objetivo del pliegue a partir del puntero (coordenadas canónicas: hacia dentro de la página = +,+)
  function peelTarget(lx, ly, side) {
    var W = S.W, H = S.H, best = null;
    var R = 0.38 * W, Lmax = 0.23 * W, m = 0.085 * W;
    for (var cy = 0; cy < 2; cy++) {
      var qx = side === 'r' ? W - lx : lx, qy = cy ? H - ly : ly;
      var dist = Math.hypot(qx, qy);
      if (dist > R) continue;
      if (qx < -0.06 * W || qy < -0.08 * W) continue;
      var full = 1 - sstep(0.62 * R, R, dist);
      var gx = Math.max(qx, 0), gy = Math.max(qy, 0), gl = Math.hypot(gx, gy);
      if (gl < m) {
        var dx = 0.86, dy = 0.5;
        if (gl > 0.001) { var b = gl / m; dx = lerp(dx, gx / gl, b); dy = lerp(dy, gy / gl, b); var dl = Math.hypot(dx, dy); dx /= dl; dy /= dl; }
        gx = dx * m; gy = dy * m; gl = m;
      }
      if (gl > Lmax) { gx *= Lmax / gl; gy *= Lmax / gl; }
      gx *= full; gy *= full;
      if (!best || dist < best.dist) best = { cy: cy, gx: gx, gy: gy, dist: dist };
    }
    return best;
  }
  function clipRect(W, H, M, n, sign) {
    var pts = [[0, 0], [W, 0], [W, H], [0, H]], out = [];
    for (var i = 0; i < 4; i++) {
      var A = pts[i], B = pts[(i + 1) % 4];
      var da = sign * ((A[0] - M[0]) * n[0] + (A[1] - M[1]) * n[1]);
      var db = sign * ((B[0] - M[0]) * n[0] + (B[1] - M[1]) * n[1]);
      if (da >= 0) out.push(A);
      if ((da >= 0) !== (db >= 0)) { var t = da / (da - db); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
    }
    return out;
  }
  function polyCSS(pts, mirrorW) {
    if (pts.length < 3) return 'polygon(0 0,0 0,0 0)';
    return 'polygon(' + pts.map(function (p) { return f2(mirrorW ? mirrorW - p[0] : p[0]) + 'px ' + f2(p[1]) + 'px'; }).join(',') + ')';
  }
  // degradado lineal CSS entre dos puntos de una caja W×H (paradas en 0..1)
  function gradAlong(W, H, P0, P1, stops) {
    var dx = P1[0] - P0[0], dy = P1[1] - P0[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    var ang = Math.atan2(ux, -uy) / DEG;
    var gl = Math.abs(W * ux) + Math.abs(H * uy);
    var sx = W / 2 - ux * gl / 2, sy = H / 2 - uy * gl / 2;
    var p0 = (P0[0] - sx) * ux + (P0[1] - sy) * uy, p1 = p0 + len;
    return 'linear-gradient(' + f2(ang) + 'deg,' + stops.map(function (s) { return s[1] + ' ' + f2(lerp(p0, p1, s[0])) + 'px'; }).join(',') + ')';
  }

  function peelLogic(dt) {
    var P = S.peel, W = S.W, n = S.leaves.length, target = null;
    var liftR = 0, liftL = 0;
    var ptr = S.pointer;
    var canHover = S.open && ptr.inside && !S.drag && S.intro > 0.7 && (!AR.mouse || AR.mouse.moved !== false || AR.rec || ptr.x > -1e3);
    if (canHover) {
      var bx = ptr.x - (S.bookX + S.shift), by = ptr.y - S.bookY;
      var LR = S.s < n ? S.leaves[S.s] : null, LL = S.s > 0 ? S.leaves[S.s - 1] : null;
      // página derecha
      if (LR && !LR.drag && !LR.q && LR.goal === 0 && LR.theta < 25) {
        var lx = bx - W, ly = by;
        if (LR.hard) {
          if (lx > 0.02 * W && lx < W + S.O + 14 && ly > -S.O - 10 && ly < S.H + S.O + 10) liftR = 4 + 12 * sstep(0.3 * W, W, lx);
        } else {
          var t1 = peelTarget(lx, ly, 'r');
          if (t1) target = { leaf: S.s, side: 'r', cy: t1.cy, gx: t1.gx, gy: t1.gy, dist: t1.dist };
        }
      }
      // página izquierda (solo libro abierto a doble página)
      if (S.mode === 'double' && LL && !LL.drag && !LL.q && LL.goal === 180 && LL.theta > 155) {
        if (LL.hard) {
          if (bx < W - 0.02 * W && bx > -S.O - 14 && by > -S.O - 10 && by < S.H + S.O + 10) liftL = 4 + 12 * sstep(0.7 * W, 0, bx);
        } else {
          var t2 = peelTarget(bx, by, 'l');
          if (t2 && (!target || t2.dist < target.dist)) target = { leaf: S.s - 1, side: 'l', cy: t2.cy, gx: t2.gx, gy: t2.gy, dist: t2.dist };
        }
      }
    }
    // invitación: la tapa se entreabre sola una vez al abrir la carta
    if (!S.interacted && S.s === 0 && S.leaves[0] && S.leaves[0].hard) {
      var pt = S.now - S.openAt - 1.35;
      if (pt > 0 && pt < 1.5) liftR = Math.max(liftR, 13 * Math.pow(Math.sin(Math.PI * pt / 1.5), 2));
    }
    for (var i = 0; i < n; i++) {
      var L = S.leaves[i];
      L.liftT = (i === S.s && L.hard) ? liftR : (i === S.s - 1 && L.hard) ? liftL : 0;
    }
    // máquina de estados del pliegue
    if (target && (P.leaf !== target.leaf || P.side !== target.side || P.cy !== target.cy)) {
      if (P.leaf < 0 || Math.hypot(P.gx, P.gy) < 0.6) { hidePeel(); P.leaf = target.leaf; P.side = target.side; P.cy = target.cy; P.gx = 0; P.gy = 0; }
      else target = null;
    }
    if (P.leaf >= 0) {
      var Lp = S.leaves[P.leaf];
      if (!Lp || Lp.flying || Lp.q || Lp.drag) { killPeel(); return; }
      var lam = 11;
      P.gx = damp(P.gx, target ? target.gx : 0, lam, dt);
      P.gy = damp(P.gy, target ? target.gy : 0, lam, dt);
      if (!target && Math.hypot(P.gx, P.gy) < 0.35) killPeel();
    }
  }

  function renderPeel() {
    var P = S.peel;
    if (P.leaf < 0) { hidePeel(); return; }
    var L = S.leaves[P.leaf], W = S.W, H = S.H;
    var amt = Math.hypot(P.gx, P.gy);
    if (amt < 0.35) { hidePeel(); return; }
    var side = P.side;
    var A = side === 'r' ? L.front : L.back, B = side === 'r' ? L.back : L.front;
    var key = P.leaf + side;
    if (P.key !== key) {
      S.flapA.innerHTML = '<div class="' + sheetCls(A) + '">' + sheetHTML(A) + '</div>';
      S.flapB.innerHTML = '<div class="' + sheetCls(B) + '">' + sheetHTML(B) + '</div><i class="bk-sh"></i>';
      S.flapBsh = S.flapB.lastChild;
      P.key = key;
    }
    var C = [side === 'r' ? W : 0, P.cy ? H : 0];
    var sx = side === 'r' ? -1 : 1, sy = P.cy ? -1 : 1;
    var v = [sx * P.gx, sy * P.gy], vl = Math.hypot(v[0], v[1]);
    var nrm = [v[0] / vl, v[1] / vl];
    var M = [C[0] + v[0] / 2, C[1] + v[1] / 2];
    var flapPoly = clipRect(W, H, M, nrm, -1), restPoly = clipRect(W, H, M, nrm, 1);
    var u = [-nrm[1], nrm[0]], r = [C[0] - M[0], C[1] - M[1]];
    if (u[0] * r[1] - u[1] * r[0] < 0) { u[0] = -u[0]; u[1] = -u[1]; }
    var a01 = clamp(amt / (0.23 * W), 0, 1);
    var alpha = 180 - (34 - 14 * a01);
    var face = side === 'r' ? L.sf : L.sb;
    if (P.clipEl !== face) { if (P.clipEl) P.clipEl.style.clipPath = ''; P.clipEl = face; }
    face.style.clipPath = polyCSS(restPoly);
    if (!P.shown) { S.peelW.style.display = 'block'; S.peelSh.style.display = 'block'; P.shown = true; }
    var pw = S.peelW.style;
    pw.left = side === 'r' ? W + 'px' : '0px';
    pw.perspective = S.P + 'px';
    pw.perspectiveOrigin = (side === 'r' ? 0 : W) + 'px ' + (H / 2) + 'px';
    S.flap.style.transformOrigin = f2(M[0]) + 'px ' + f2(M[1]) + 'px';
    S.flap.style.transform = 'rotate3d(' + f3(u[0]) + ',' + f3(u[1]) + ',0,' + f2(alpha) + 'deg)';
    S.flapA.style.clipPath = polyCSS(flapPoly);
    S.flapB.style.clipPath = polyCSS(flapPoly, W);
    var Mb = [W - M[0], M[1]], Cb = [W - C[0], C[1]];
    S.flapBsh.style.background = gradAlong(W, H, Mb, Cb, [
      [0, 'rgba(60,32,10,.30)'], [0.08, 'rgba(60,32,10,.10)'], [0.3, 'rgba(255,250,238,.16)'], [0.62, 'rgba(255,250,238,0)'], [1, 'rgba(60,32,10,.10)'],
    ]);
    var sh = S.peelSh.style;
    sh.left = side === 'r' ? W + 'px' : '0px';
    sh.clipPath = polyCSS(flapPoly);
    sh.background = gradAlong(W, H, M, C, [[0, 'rgba(24,12,4,.42)'], [0.45, 'rgba(24,12,4,.2)'], [1, 'rgba(24,12,4,.08)']]);
  }

  /* ───────────────────────── física ───────────────────────── */
  function physics(dt) {
    var K = 30, Cd = 9.2;    // ω≈5.5 rad/s, ζ≈0.84: arranque suave, aterrizaje decidido
    var n = S.leaves.length, i, L;
    for (i = 0; i < n; i++) {
      L = S.leaves[i];
      if (L.q && S.now >= L.q.at) { var g = L.q.goal; L.q = null; launch(L, g); }
      L.lift = damp(L.lift, L.liftT, 7, dt);
      if (L.lift < 0.01 && L.liftT === 0) L.lift = 0;
      var prevT = L.theta;
      if (L.drag && S.drag && S.drag.leaf === i) {
        L.theta = damp(L.theta, dragTheta(L), 24, dt);
        var iv = dt > 0 ? (L.theta - prevT) / dt : 0;
        L.vel = damp(L.vel, iv, 16, dt);
      } else {
        if (L.drag) L.drag = false;
        var tgt = L.goal === 0 ? L.lift : 180 - L.lift;
        var steps = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / steps;
        for (var k = 0; k < steps; k++) {
          var acc = K * (tgt - L.theta) - Cd * L.vel;
          L.vel += acc * h;
          L.theta += L.vel * h;
          if (L.theta < 0) { L.theta = 0; if (L.vel < 0) L.vel = 0; }
          if (L.theta > 180) { L.theta = 180; if (L.vel > 0) L.vel = 0; }
        }
        if (Math.abs(tgt - L.theta) < 0.03 && Math.abs(L.vel) < 1.5) { L.theta = tgt; L.vel = 0; }
      }
      L.flying = L.drag || (L.theta > 0.0005 && L.theta < 179.9995);
      // curvatura de la hoja: el borde libre adelanta al principio y se queda atrás al caer
      if (!L.hard) {
        var sn = Math.sin(L.theta * DEG), ct = 0;
        if (L.drag) ct = L.dir * 36 * sn;
        else if (L.flying) {
          // el borde adelanta al levantar la hoja y luego se queda atrás mientras cae
          var prog = L.dir > 0 ? L.theta / 180 : (180 - L.theta) / 180;
          ct = L.dir * Math.pow(sn, 0.6) * clamp(32 - 135 * prog, -44, 32);
        }
        L.curl = damp(L.curl, ct, L.drag ? 10 : 15, dt);
        if (!L.flying) L.curl = 0;
      }
    }
    // las hojas no se atraviesan
    for (i = 0; i < n - 1; i++) {
      var A = S.leaves[i], B = S.leaves[i + 1];
      if (B.theta > A.theta + 0.01) {
        if (A.drag && !B.drag) { B.theta = A.theta; B.vel = Math.min(B.vel, A.vel); }
        else if (B.drag && !A.drag) { A.theta = B.theta; A.vel = Math.max(A.vel, B.vel); }
        else if (A.goal === 180) { A.theta = B.theta; A.vel = Math.max(A.vel, B.vel); }
        else { B.theta = A.theta; B.vel = Math.min(B.vel, A.vel); }
        A.flying = A.drag || (A.theta > 0.0005 && A.theta < 179.9995);
        B.flying = B.drag || (B.theta > 0.0005 && B.theta < 179.9995);
      }
    }
  }

  /* ───────────────────────── luz ───────────────────────── */
  var LIGHT = (function () { var x = -0.32, y = -0.24, z = 1, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();
  var HALF = (function () { var x = LIGHT[0], y = LIGHT[1], z = LIGHT[2] + 1, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();
  var D0 = LIGHT[2], SP0 = Math.pow(HALF[2], 34);
  // normal de la cara frontal tras rotateY(-φ): (-sinφ, 0, cosφ); la trasera es la opuesta
  function lightAt(phi, back) {
    var s = Math.sin(phi * DEG), c = Math.cos(phi * DEG);
    var nx = back ? s : -s, nz = back ? -c : c;
    var d = nx * LIGHT[0] + nz * LIGHT[2];
    var sp = Math.pow(Math.max(0, nx * HALF[0] + nz * HALF[2]), 34);
    var shade = clamp((D0 - Math.max(d, -0.2)) * 0.62, 0, 0.62);
    var hi = clamp((sp - SP0) * 0.5, 0, 0.3);
    return [shade, hi];
  }
  function shadeGrad(a, b) {
    return 'linear-gradient(90deg,rgba(255,248,234,' + f3(a[1]) + '),rgba(255,248,234,' + f3(b[1]) + ')),' +
      'linear-gradient(90deg,rgba(26,13,5,' + f3(a[0]) + '),rgba(26,13,5,' + f3(b[0]) + '))';
  }

  /* ───────────────────────── render ───────────────────────── */
  function setDisp(L, key, elx, on) {
    if (L[key] === on) return;
    L[key] = on;
    elx.style.display = on ? 'block' : 'none';
  }
  function render(dt) {
    var W = S.W, H = S.H, o = S.O, n = S.leaves.length, i, L;
    var L0 = S.leaves[0], Ln = S.leaves[n - 1];
    var shift = S.mode === 'double'
      ? -(W + o) / 2 * (1 - inOutSine(L0.theta / 180)) + (W + o) / 2 * inOutSine(Ln.theta / 180)
      : -(W + o) / 2;
    S.shift = shift;

    // inclinación con el ratón + entrada
    var m = AR.mouse, nx = 0, ny = 0;
    if (m && (m.moved || AR.rec)) { nx = m.nx || 0; ny = m.ny || 0; }
    S.tx = damp(S.tx, nx, 3.2, dt); S.ty = damp(S.ty, ny, 3.2, dt);
    var ie = outCubic(S.intro);
    var bs = S.book.style;
    bs.transformOrigin = f2(W - shift) + 'px ' + f2(H / 2) + 'px';
    bs.transform = 'translate3d(' + f2(shift) + 'px,' + f2((1 - ie) * 64) + 'px,0) rotateX(' + f2(-S.ty * 2.6 + (1 - ie) * 18) + 'deg) rotateY(' +
      f2(S.tx * 3.2) + 'deg) scale(' + f3(0.9 + 0.1 * ie) + ')';
    var op = S.intro >= 1 ? '' : String(f3(sstep(0, 0.55, S.intro)));
    if (bs.opacity !== op) bs.opacity = op;
    var uo = S.intro >= 1 ? '' : String(f3(sstep(0.35, 1, S.intro)));
    if (S.ui.box.style.opacity !== uo) S.ui.box.style.opacity = uo;

    var anyR = false, anyL = false, castR = null, castL = null;
    for (i = 0; i < n; i++) {
      L = S.leaves[i];
      var restR = !L.flying && L.theta <= 0.0005, restL = !L.flying && L.theta >= 179.9995;
      setDisp(L, 'vf', L.sf, restR);
      if (L.sb) setDisp(L, 'vb', L.sb, restL);
      if (restR) anyR = true;
      if (restL) anyL = true;
      setDisp(L, 'vfl', L.fl, L.flying);
      if (!L.flying) continue;
      var sn = Math.sin(L.theta * DEG);
      var z = 20 + Math.round(sn * 100);
      if (L.z !== z) { L.z = z; L.fl.style.zIndex = String(z); }
      var ex, ez;
      if (L.hard) {
        L.fl.style.transform = 'rotateY(' + f2(-L.theta) + 'deg)';
        var lf = lightAt(L.theta, false), lb = lightAt(L.theta, true);
        var band = 130 - L.theta / 180 * 160;
        L.shF.style.background = 'linear-gradient(105deg,rgba(255,226,190,0) ' + f2(band - 22) + '%,rgba(255,226,190,' + f3(0.10 + lf[1]) + ') ' + f2(band) + '%,rgba(255,226,190,0) ' + f2(band + 22) + '%),rgba(20,4,4,' + f3(lf[0] * 0.9) + ')';
        L.shB.style.background = 'linear-gradient(255deg,rgba(255,226,190,0) ' + f2(band - 22) + '%,rgba(255,226,190,' + f3(0.08) + ') ' + f2(band) + '%,rgba(255,226,190,0) ' + f2(band + 22) + '%),rgba(20,4,4,' + f3(lb[0] * 0.9) + ')';
        ex = (W + o) * Math.cos(L.theta * DEG); ez = (W + o) * sn;
      } else {
        var N = L.strips.length, sw = W / N, x = 0, zz = 0, phis = [];
        for (var j = 0; j < N; j++) {
          var s = (j + 0.5) / N;
          phis.push(clamp(L.theta + L.curl * Math.pow(s, 1.35), 0, 180));
        }
        var joints = [];
        for (j = 0; j <= N; j++) joints.push(j === 0 ? phis[0] : j === N ? phis[N - 1] : (phis[j - 1] + phis[j]) / 2);
        var lights = joints.map(function (a) { return [lightAt(a, false), lightAt(a, true)]; });
        for (j = 0; j < N; j++) {
          var st = L.strips[j], ph = phis[j];
          var tr = 'translate3d(' + f2(x) + 'px,0,' + f2(zz) + 'px) rotateY(' + f2(-ph) + 'deg)';
          if (st.tr !== tr) { st.tr = tr; st.el.style.transform = tr; }
          var gf = shadeGrad(lights[j][0], lights[j + 1][0]);
          if (st.gf !== gf) { st.gf = gf; st.shF.style.background = gf; }
          var gb = shadeGrad(lights[j + 1][1], lights[j][1]);
          if (st.gb !== gb) { st.gb = gb; st.shB.style.background = gb; }
          x += sw * Math.cos(ph * DEG); zz += sw * Math.sin(ph * DEG);
        }
        ex = x; ez = zz;
      }
      var xp = ex * S.P / Math.max(1, S.P - ez);
      var c = { x: xp, z: ez, s: sn };
      if (xp >= 0) { if (!castR || ez > castR.z) castR = c; }
      else if (!castL || ez > castL.z) castL = c;
    }

    // sombras proyectadas por las hojas en vuelo sobre las páginas en reposo
    drawCast(S.castR, anyR ? castR : null, 'r');
    drawCast(S.castL, anyL ? castL : null, 'l');

    // lomo central y sombra del libro
    var pL, pR;
    if (S.mode === 'double') {
      pL = sstep(0, 130, L0.theta);
      pR = 1 - sstep(50, 180, Ln.theta);
    } else { pL = 0; pR = 1; }
    var so = String(f3(pL)), sr = String(f3(pR));
    if (S.shadowL.style.opacity !== so) S.shadowL.style.opacity = so;
    if (S.shadowR.style.opacity !== sr) S.shadowR.style.opacity = sr;
    var spo = S.mode === 'double' && anyL && anyR ? '1' : '0';
    if (S.spine.style.opacity !== spo) S.spine.style.opacity = spo;

    renderLines();
    renderPeel();
    renderSheen();
    renderZones();
  }
  function drawCast(node, c, side) {
    if (!c) { if (node._on) { node.style.display = 'none'; node._on = false; } return; }
    if (!node._on) { node.style.display = 'block'; node._on = true; }
    var W = S.W, ax = Math.abs(c.x);
    var lift = clamp(c.z / W, 0, 1);
    var a = 0.46 * (1 - 0.5 * lift) * sstep(0, 0.04, lift + 0.01);
    var spread = W * (0.035 + 0.4 * lift);
    var amb = 0.10 * Math.sin(Math.PI * clamp(lift, 0, 1));
    var col = 'rgba(26,12,4,';
    node.style.background = 'linear-gradient(' + (side === 'r' ? '90deg' : '270deg') + ',' +
      col + f3(a * 0.7 + amb) + ') 0px,' + col + f3(a + amb) + ') ' + f2(ax) + 'px,' + col + f3(amb) + ') ' + f2(ax + spread) + 'px,' + col + f3(amb * 0.6) + ') ' + f2(W) + 'px)';
  }

  // cantos apilados: más líneas cuantas más hojas quedan de ese lado
  function renderLines() {
    var n = S.leaves.length, right = [], left = [], i, L;
    for (i = 0; i < n; i++) {
      L = S.leaves[i];
      if (!L.flying && L.theta <= 0.0005) right.push(i);
      if (!L.flying && L.theta >= 179.9995) left.unshift(i);
    }
    var key = S.mode + S.W + '|' + right.join(',') + '|' + left.join(',');
    if (key === S.linesKey) return;
    S.linesKey = key;
    fillLines(S.linesR, right, 'r');
    fillLines(S.linesL, S.mode === 'double' ? left : [], 'l');
  }
  function fillLines(box, list, side) {
    var html = '', d = 0, dx = Math.max(0.9, 1.15 * S.k), dy = Math.max(1, 1.35 * S.k), items = [];
    for (var j = 1; j < list.length; j++) {
      var L = S.leaves[list[j]];
      var f = side === 'r' ? L.front : L.back;
      var cnt = L.hard ? 2 : 3;
      for (var c = 0; c < cnt; c++) { d++; items.push({ d: d, bd: isBoard(f) }); }
    }
    for (var k = items.length - 1; k >= 0; k--) {
      var it = items[k], ox = (side === 'r' ? 1 : -1) * it.d * dx, oy = it.d * dy;
      var left = side === 'r' ? S.W : 0, top = 0;
      if (it.bd) { top = -S.O; if (side === 'l') left = -S.O; }
      html += '<div class="bk-ln ' + (it.bd ? 'bd' : 'pg') + ' ' + side + '" style="left:' + f2(left + ox) + 'px;top:' + f2(top + oy) + 'px"></div>';
    }
    box.innerHTML = html;
  }

  // brillo del oro de la tapa que sigue al cursor
  function renderSheen() {
    var m = AR.mouse, nx = m && (m.moved || AR.rec) ? (m.nx || 0) : 0;
    for (var i = 0; i < S.leaves.length; i++) {
      var L = S.leaves[i];
      [[L.sf, L.vf], [L.sb, L.vb]].forEach(function (p) {
        if (!p[0] || !p[1]) return;
        var sh = p[0].querySelector('.bk-sheen i');
        if (!sh) return;
        var tx = -100 + (nx * 0.5 + 0.5) * 240 + S.ty * 20;
        sh.style.transform = 'translateX(' + f2(tx) + '%)';
      });
    }
  }

  /* ───────────────────────── zonas de interacción ───────────────────────── */
  var ZONE_NAMES = ['l', 'r', 'lt', 'lb', 'rt', 'rb'];
  function makeZones() {
    ZONE_NAMES.forEach(function (z) {
      var e = el('div', 'bk-z' + (z.length > 1 ? ' c' : ''));
      e.setAttribute('data-zone', z);
      e.addEventListener('pointerdown', onPDown);
      e.addEventListener('pointerup', onPUp);
      e.addEventListener('pointercancel', onPUp);
      e.addEventListener('lostpointercapture', function (ev) { if (S.drag && S.drag.id === ev.pointerId) onPUp(ev); });
      S.root.appendChild(e);
      S.zones[z] = { el: e, on: null, r: '', label: null };
    });
  }
  function setZone(name, on, x, y, w, h, label) {
    var z = S.zones[name];
    if (z.on !== on) { z.on = on; z.el.style.display = on ? 'block' : 'none'; }
    if (!on) return;
    var r = Math.round(x) + ',' + Math.round(y) + ',' + Math.round(w) + ',' + Math.round(h);
    if (z.r !== r) {
      z.r = r;
      var s = z.el.style;
      s.left = Math.round(x) + 'px'; s.top = Math.round(y) + 'px'; s.width = Math.round(w) + 'px'; s.height = Math.round(h) + 'px';
    }
    if (z.label !== label) { z.label = label; z.el.setAttribute('data-cursor', label); }
  }
  function renderZones() {
    var W = S.W, H = S.H, o = S.O, n = S.leaves.length;
    var bx = S.bookX + S.shift, by = S.bookY;
    var hasR = S.s < n, hasL = S.s > 0;
    if (S.mode === 'double') {
      var top = S.leaves[S.s];
      var lblR = S.s === 0 ? 'Abrir' : (top && top.hard && S.s === n - 1) ? 'Cerrar' : 'Pasar página';
      setZone('r', hasR, bx + W, by - o, W + o, H + 2 * o, lblR);
      setZone('l', hasL, bx - o, by - o, W + o, H + 2 * o, S.s === n ? 'Abrir' : 'Volver');
      var softR = hasR && top && !top.hard, lft = S.leaves[S.s - 1], softL = hasL && lft && !lft.hard;
      var cw = 0.3 * W, chh = 0.26 * H;
      setZone('rt', softR, bx + 2 * W - cw, by - o, cw + o, chh + o, 'Arrastra');
      setZone('rb', softR, bx + 2 * W - cw, by + H - chh, cw + o, chh + o, 'Arrastra');
      setZone('lt', softL, bx - o, by - o, cw + o, chh + o, 'Arrastra');
      setZone('lb', softL, bx - o, by + H - chh, cw + o, chh + o, 'Arrastra');
    } else {
      var x0 = bx + W, wl = hasL ? 0.3 * W : 0;
      var cur = S.leaves[Math.min(S.s, n - 1)];
      setZone('l', hasL, x0 - 4, by - o, wl + 4, H + 2 * o, 'Volver');
      setZone('r', hasR, x0 + wl, by - o, W + o - wl, H + 2 * o, S.s === 0 ? 'Abrir' : 'Pasar página');
      var soft = hasR && cur && !cur.hard;
      setZone('rt', soft, x0 + 0.7 * W, by - o, 0.3 * W + o, 0.26 * H + o, 'Arrastra');
      setZone('rb', soft, x0 + 0.7 * W, by + 0.74 * H, 0.3 * W + o, 0.26 * H + o, 'Arrastra');
      setZone('lt', false); setZone('lb', false);
    }
  }

  /* ───────────────────────── interfaz ───────────────────────── */
  var ICON_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5L16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_HINT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h11l5 5v11H4z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M15 4v5h5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M20 9l-5 0" stroke="currentColor" stroke-width="1.3"/></svg>';
  function makeUI() {
    var box = el('div', 'bk-ui');
    box.innerHTML =
      '<div class="bk-nav">' +
        '<button type="button" class="bk-btn bk-prev" aria-label="Página anterior" data-cursor="Anterior">' + ICON_L + '</button>' +
        '<div class="bk-ind" aria-live="polite"></div>' +
        '<button type="button" class="bk-btn bk-next" aria-label="Página siguiente" data-cursor="Siguiente">' + ICON_R + '</button>' +
      '</div>' +
      '<div class="bk-hint">' + ICON_HINT + '<span></span></div>';
    S.root.appendChild(box);
    S.ui = { box: box, prev: box.querySelector('.bk-prev'), next: box.querySelector('.bk-next'), ind: box.querySelector('.bk-ind'), hint: box.querySelector('.bk-hint span'), last: '' };
    S.ui.prev.addEventListener('click', function (e) { e.preventDefault(); prev(); });
    S.ui.next.addEventListener('click', function (e) { e.preventDefault(); next(); });
  }
  function indicator() {
    var N = S.pages.length, s = S.s, a, b;
    if (S.mode === 'single') { a = Math.min(s + 1, N); b = a; }
    else if (s === 0) { a = b = 1; }
    else if (s >= S.leaves.length) { a = b = Math.min(2 * s, N); }
    else { a = 2 * s; b = Math.min(2 * s + 1, N); }
    return { a: a, b: b, N: N };
  }
  function updateUI() {
    if (!S.ui.ind) return;
    var r = indicator();
    var txt = (r.a === r.b ? r.a : r.a + '–' + r.b) + '<span class="bk-sl">/</span><span class="bk-tot">' + r.N + '</span>';
    if (S.ui.last !== txt) {
      S.ui.last = txt;
      S.ui.ind.innerHTML = txt;
      S.ui.ind.setAttribute('aria-label', 'Página ' + (r.a === r.b ? r.a : r.a + ' y ' + r.b) + ' de ' + r.N);
    }
    S.ui.prev.disabled = S.s <= 0;
    S.ui.next.disabled = S.s >= maxS();
    var h = S.mode === 'single' ? 'Arrastra la esquina o toca para pasar la página' : 'Arrastra la esquina o haz clic para pasar la página';
    if (S.ui.hint.textContent !== h) S.ui.hint.textContent = h;
  }

  /* ───────────────────────── deckle (borde de papel hecho a mano) ───────────────────────── */
  function injectDeckle() {
    if (document.getElementById('bk-deckle')) return;
    var R = rng(20261012), pts = [], i;
    var nT = 30, nO = 54, nB = 30;
    pts.push([0, 0]);
    for (i = 1; i < nT; i++) pts.push([i / nT * 100, R() * 0.16]);
    pts.push([99.75, 0.18]);
    for (i = 1; i < nO; i++) pts.push([100 - R() * 0.34 - (i % 7 === 3 ? 0.18 : 0), i / nO * 100]);
    pts.push([99.75, 99.82]);
    for (i = nB - 1; i >= 1; i--) pts.push([i / nB * 100, 100 - R() * 0.16]);
    pts.push([0, 100]);
    function css(mir) {
      return 'polygon(' + pts.map(function (p) { return f3(mir ? 100 - p[0] : p[0]) + '% ' + f3(p[1]) + '%'; }).join(',') + ')';
    }
    var st = document.createElement('style');
    st.id = 'bk-deckle';
    st.textContent = '.bk-pp.r{clip-path:' + css(false) + '}.bk-pp.l{clip-path:' + css(true) + '}';
    document.head.appendChild(st);
  }

  /* ───────────────────────── API ───────────────────────── */
  function mount(container) {
    if (S.mounted || !container) return;
    S.host = container;
    try { if (getComputedStyle(container).position === 'static') container.style.position = 'relative'; } catch (_) { /* nada */ }
    injectDeckle();
    readPages();
    var root = el('div', 'bk-root');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-roledescription', 'libro');
    root.setAttribute('aria-label', 'La carta de Antica Roma');
    root.setAttribute('data-dismiss', '');
    root.innerHTML = DEFS;
    var stage = el('div', 'bk-stage');
    stage.setAttribute('data-dismiss', '');
    var book = el('div', 'bk-book');
    S.lStatic = el('div', 'bk-lay static');
    S.lPeel = el('div', 'bk-lay peel');
    S.lFlip = el('div', 'bk-lay flip');
    book.appendChild(S.lStatic); book.appendChild(S.lPeel); book.appendChild(S.lFlip);
    stage.appendChild(book);
    root.appendChild(stage);
    S.root = root; S.stage = stage; S.book = book;
    makeZones();
    makeUI();
    container.appendChild(root);
    root.addEventListener('pointermove', onPMove);
    root.addEventListener('pointerleave', onPLeave);
    S.mounted = true;
  }
  function onOpen() {
    if (!S.mounted) return;
    S.open = true;
    S.s = 0;
    S.intro = 0;
    S.openAt = S.now;
    S.interacted = false;
    S.drag = null;
    S.pointer.inside = false;
    S.pointer.rr = null;
    if (S.built) { killPeel(); applyState(true); updateUI(); }
    document.addEventListener('keydown', onKey);
    measure();
  }
  function onClose() {
    S.open = false;
    if (S.drag) {
      var L = S.leaves[S.drag.leaf];
      if (L) L.drag = false;
      S.drag = null;
    }
    if (S.built) killPeel();
    document.removeEventListener('keydown', onKey);
  }
  function measure() {
    if (!S.root) return false;
    var w = S.root.clientWidth, h = S.root.clientHeight;
    if (!w || !h) return false;
    if (w !== S.cw || h !== S.ch || !S.built) { S.cw = w; S.ch = h; layout(); }
    return true;
  }
  function update(dt, t) {
    if (!S.open || !S.mounted) return;
    dt = clamp(+dt || 0, 0, 0.05);
    S.now += dt;
    if (!measure() || !S.built) return;
    S.intro = Math.min(1, S.intro + dt / 1.1);
    peelLogic(dt);
    physics(dt);
    render(dt);
  }
  function state() {
    return { mode: S.mode, s: S.s, page: indicator(), leaves: S.leaves.map(function (L) { return { theta: f2(L.theta), flying: L.flying, curl: f2(L.curl) }; }), W: S.W, H: S.H };
  }

  AR.book = { mount: mount, onOpen: onOpen, onClose: onClose, update: update, next: next, prev: prev, go: go, state: state };

  var hooked = false;
  function hook() {
    if (hooked || typeof AR.onFrame !== 'function') return;
    hooked = true;
    AR.onFrame(function (dt, t) { AR.book.update(dt, t); });
  }
  hook();
  if (!hooked) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook);
    window.addEventListener('load', hook);
  }
})();
