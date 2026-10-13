/* Antica Roma — Mérida · Sistema de modales
   API: AR.modals.open(name) · AR.modals.close() · AR.modals.isOpen() · AR.modals.current
   name ∈ 'menu' | 'reserva' | 'ubicacion' | 'historia'
   Todas las animaciones se calculan dentro de AR.onFrame (reloj virtual en modo ?rec):
   aquí no hay transiciones CSS, keyframes, setTimeout ni requestAnimationFrame. */
(function () {
  'use strict';

  var AR = (window.AR = window.AR || {});
  var NAMES = ['menu', 'reserva', 'ubicacion', 'historia'];

  /* ───────────────────────── utilidades ───────────────────────── */
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var clamp01 = function (v) { return clamp(v, 0, 1); };
  var damp = function (c, t, l, dt) { return c + (t - c) * (1 - Math.exp(-l * dt)); };
  var E = {
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inCubic: function (t) { return t * t * t; },
    outQuint: function (t) { return 1 - Math.pow(1 - t, 5); },
    inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  };
  // muelle amortiguado analítico (0 → 1 con un pequeño rebote), determinista con reloj virtual
  function spring(t, zeta, w) {
    if (t <= 0) return 0;
    var wd = w * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t));
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function cfg() { return AR.config || {}; }
  function fmtNum(n) { try { return Number(n).toLocaleString('es-MX'); } catch (_) { return String(n); } }

  /* ───────────────────────── iconos ───────────────────────── */
  var WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z';
  var I = {
    wa: '<svg class="mr-ico-wa" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="' + WA_PATH + '"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    ticks: '<svg class="rs-ticks" viewBox="0 0 18 11" aria-hidden="true"><path d="M1 6.2l2.9 2.9L10.6 1.6M7.4 9.1l.9.9L15.6 1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 7v5l3.2 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4zM9 4v13.5M15 6.5V20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l9.2 9.2-9.2 9.2L2.8 12 12 2.8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9.2 14.2v-2.4a1.4 1.4 0 011.4-1.4h4M13 8.4l2 2-2 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10.2 5.2 7.6 4.6 4 4.8v13.4c3.6-.2 6.2.4 8 1.7 1.8-1.3 4.4-1.9 8-1.7V4.8c-3.6-.2-6.2.4-8 1.7zM12 6.5v13.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<span class="mr-x" aria-hidden="true"><i></i><i></i></span>',
  };
  function closeBtn(extra) {
    return '<button type="button" class="mr-close' + (extra ? ' ' + extra : '') + '" aria-label="Cerrar" data-cursor="Cerrar">' + I.close + '</button>';
  }

  /* ───────────────────────── estado global ───────────────────────── */
  var root = null, backdrop = null, vignette = null, lastBd = -1, built = false, loopOn = false, preloaded = false;
  var M = {};
  var current = null;
  var bd = 0;                 // progreso del fondo 0..1
  var lastFocus = null;
  var locked = false, prevOverflow = '';
  var mx = 0, my = 0;         // ratón normalizado y suavizado (-1..1)
  var mqMobile = window.matchMedia ? window.matchMedia('(max-width: 760px)') : { matches: false };
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  var OPEN_SETTLE = 1.5;      // s hasta considerar la apertura terminada
  var CLOSE_DUR = 0.34;       // s de cierre del panel
  var SWITCH_DELAY = 0.16;    // s de solape al cambiar de un modal a otro

  /* ───────────────────────── API pública ───────────────────────── */
  var api = {
    open: open,
    close: close,
    isOpen: function () { return !!current; },
  };
  Object.defineProperty(api, 'current', { enumerable: true, get: function () { return current; } });
  AR.modals = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  function init() {
    if (built || !document.body) return;
    built = true;
    root = document.getElementById('modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'modal-root';
      document.body.appendChild(root);
    }
    root.innerHTML = '';
    root.hidden = true;
    backdrop = document.createElement('div');
    backdrop.className = 'mr-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.innerHTML = '<div class="mr-vignette"></div>';
    vignette = backdrop.firstChild;
    root.appendChild(backdrop);
    NAMES.forEach(makeModal);
    bindGlobal();
    ensureLoop();
    if (document.readyState === 'complete') preload();
    else window.addEventListener('load', preload, { once: true });
  }

  function ensureLoop() {
    if (loopOn) return;
    if (typeof AR.onFrame === 'function') { AR.onFrame(frame); loopOn = true; }
  }

  function preload() {
    if (preloaded || !root) return;
    preloaded = true;
    root.querySelectorAll('img[data-src]').forEach(function (img) {
      img.src = img.getAttribute('data-src');
      img.removeAttribute('data-src');
      // decodificamos por adelantado para que la primera aparición no muestre un hueco
      if (img.decode) img.decode().catch(function () { /* nada */ });
    });
  }

  function open(name) {
    if (NAMES.indexOf(name) < 0) return;
    init();
    if (!built) return;
    ensureLoop();
    preload();
    if (current === name) return;
    var prev = current ? M[current] : null;
    if (!prev) {
      var ae = document.activeElement;
      lastFocus = ae && ae !== document.body && !root.contains(ae) ? ae : null;
    }
    if (prev) startClose(prev);
    current = name;
    var m = M[name];
    root.hidden = false;
    lockScroll();
    m.mobile = !!mqMobile.matches;
    m.reduce = !!mqReduce.matches && !AR.rec;
    m.phase = 'opening';
    m.t = prev ? -SWITCH_DELAY : 0;
    m.started = false;
    m.clean = false;
    m.wrap.hidden = false;
    m.wrap.classList.remove('is-closing');
    if (m.hooks.prepare) m.hooks.prepare(m);
    if (m.t >= 0) startOpen(m);
    applyPanel(m);
    applyBackdrop();
    if (m.hooks.tick) m.hooks.tick(m, 0, 0);
    focusInto(m);
    if (!loopOn) finishInstant();
  }

  function close() {
    if (!current) return;
    var m = M[current];
    current = null;
    startClose(m);
    var lf = lastFocus;
    lastFocus = null;
    if (lf && document.contains(lf) && typeof lf.focus === 'function') {
      try { lf.focus({ preventScroll: true }); } catch (_) { /* nada */ }
    } else if (document.activeElement && root.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    if (!loopOn) finishInstant();
  }

  function startOpen(m) {
    m.started = true;
    if (m.hooks.onOpen) m.hooks.onOpen(m);
  }

  function startClose(m) {
    if (m.phase === 'closed' || m.phase === 'closing') return;
    var wasStarted = m.started;
    m.phase = 'closing';
    m.ct = 0;
    m.a0 = m.started ? (m.alpha == null ? 1 : m.alpha) : 0;
    m.k0 = m.k == null ? 1 : m.k;
    m.wrap.classList.add('is-closing');
    if (wasStarted && m.hooks.onClose) m.hooks.onClose(m);
  }

  function finishClose(m) {
    m.phase = 'closed';
    m.started = false;
    m.wrap.hidden = true;
    m.wrap.classList.remove('is-closing');
    m.panel.style.opacity = '';
    m.panel.style.transform = '';
    m.items.forEach(function (el) { el.style.opacity = ''; el.style.transform = ''; });
    if (m.hooks.onClosed) m.hooks.onClosed(m);
  }

  function finishInstant() {
    NAMES.forEach(function (n) {
      var m = M[n];
      if (m.phase === 'opening') {
        if (!m.started) startOpen(m);
        m.phase = 'open';
        applyPanel(m);
      } else if (m.phase === 'closing') finishClose(m);
    });
    bd = current ? 1 : 0;
    applyBackdrop();
    if (!current) { root.hidden = true; unlockScroll(); }
  }

  /* ───────────────────────── bucle de animación ───────────────────────── */
  function frame(dt, time) {
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    var am = AR.mouse || {};
    mx = damp(mx, am.nx || 0, 5, dt);
    my = damp(my, am.ny || 0, 5, dt);
    if (!root) return;

    if (current) bd = Math.min(1, bd + dt / 0.42);
    else bd = Math.max(0, bd - dt / 0.45);
    applyBackdrop();

    var anyVisible = false;
    for (var i = 0; i < NAMES.length; i++) {
      var m = M[NAMES[i]];
      if (!m || m.phase === 'closed') continue;
      anyVisible = true;
      if (m.phase === 'closing') {
        m.ct += dt;
        if (m.ct >= CLOSE_DUR) { finishClose(m); continue; }
      } else {
        m.t += dt;
        if (!m.started && m.t >= 0) startOpen(m);
        if (m.phase === 'opening' && m.t >= OPEN_SETTLE) m.phase = 'open';
      }
      applyPanel(m);
      if (m.hooks.tick) m.hooks.tick(m, dt, time || 0);
    }
    if (!current && bd === 0 && !anyVisible && !root.hidden) {
      root.hidden = true;
      unlockScroll();
    }
  }

  // el fondo no se anima con opacity (Chrome mezclaría la página nítida con la desenfocada):
  // se animan el radio del desenfoque y la opacidad del tinte → efecto de "enfoque" limpio
  function applyBackdrop() {
    if (!backdrop) return;
    var e = current ? E.outCubic(bd) : E.inOutSine(bd);
    if (Math.abs(e - lastBd) < 0.0005) return;
    lastBd = e;
    var f = e > 0.001 ? 'blur(' + (14 * e).toFixed(2) + 'px) saturate(' + (100 + 15 * e).toFixed(1) + '%)' : 'none';
    backdrop.style.backdropFilter = f;
    backdrop.style.webkitBackdropFilter = f;
    backdrop.style.backgroundColor = 'rgba(20,10,6,' + (0.72 * e).toFixed(4) + ')';
    vignette.style.opacity = e.toFixed(4);
  }

  function panelTransform(m, k, dir) {
    if (m.name === 'menu') return 'translate3d(0,' + ((1 - k) * 26 * dir).toFixed(2) + 'px,0) scale(' + (0.985 + 0.015 * k).toFixed(4) + ')';
    if (m.reduce) return 'none';
    if (m.mobile) return 'translate3d(0,' + ((1 - k) * 100).toFixed(3) + '%,0)';
    return 'perspective(1600px) translate3d(0,' + ((1 - k) * 64).toFixed(2) + 'px,0) rotateX(' + ((1 - k) * 7).toFixed(3) + 'deg) scale(' + (0.9 + 0.1 * k).toFixed(4) + ')';
  }

  function applyPanel(m) {
    var P = m.panel;
    if (m.phase === 'open') {
      if (!m.clean) {
        m.clean = true;
        m.alpha = 1; m.k = 1;
        P.style.opacity = '1';
        P.style.transform = 'none';
        m.items.forEach(function (el) { el.style.opacity = ''; el.style.transform = ''; });
      }
      return;
    }
    if (m.phase === 'opening') {
      var t = Math.max(0, m.t);
      var a, k;
      if (m.reduce) { a = E.outCubic(clamp01(t / 0.3)); k = 1; }
      else if (m.mobile && m.name !== 'menu') { a = E.outCubic(clamp01(t / 0.22)); k = E.outQuint(clamp01(t / 0.75)); }
      else if (m.name === 'menu') { a = E.outCubic(clamp01(t / 0.35)); k = E.outQuint(clamp01(t / 0.8)); }
      else { a = E.outCubic(clamp01((t - 0.02) / 0.24)); k = spring(t, 0.64, 12.5); }
      if (m.t < 0) a = 0;
      m.alpha = a; m.k = k;
      P.style.opacity = a.toFixed(4);
      P.style.transform = panelTransform(m, k, 1);
      // entrada escalonada del contenido
      var items = m.items;
      for (var i = 0; i < items.length; i++) {
        var d = 0.14 + Math.min(i, 14) * 0.05;
        var p = m.reduce ? 1 : clamp01((m.t - d) / 0.62);
        var e = E.outCubic(p);
        items[i].style.opacity = e.toFixed(4);
        items[i].style.transform = p >= 1 ? '' : 'translate3d(0,' + ((1 - e) * 22).toFixed(2) + 'px,0)';
      }
      return;
    }
    if (m.phase === 'closing') {
      var q = clamp01(m.ct / CLOSE_DUR);
      var eq = E.inOutSine(q);
      var alpha = m.a0 * (1 - E.outCubic(q));
      m.alpha = alpha;
      P.style.opacity = alpha.toFixed(4);
      if (m.reduce) P.style.transform = 'none';
      else if (m.mobile && m.name !== 'menu') P.style.transform = 'translate3d(0,' + (eq * 40).toFixed(3) + '%,0)';
      else if (m.name === 'menu') P.style.transform = 'translate3d(0,' + (eq * 18).toFixed(2) + 'px,0) scale(' + (1 - 0.02 * eq).toFixed(4) + ')';
      else P.style.transform = 'perspective(1600px) translate3d(0,' + (eq * 26).toFixed(2) + 'px,0) rotateX(' + (-eq * 3).toFixed(3) + 'deg) scale(' + (1 - 0.04 * eq).toFixed(4) + ')';
    }
  }

  /* ───────────────────────── eventos globales ───────────────────────── */
  function focusables(scope) {
    var sel = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.prototype.filter.call(scope.querySelectorAll(sel), function (el) {
      if (el.closest('[hidden]')) return false;
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  function focusInto(m) {
    var f = focusables(m.wrap).filter(function (el) {
      return !el.classList.contains('mr-close') && !(el.tagName === 'INPUT' && el.type !== 'date');
    });
    // en grabación enfocamos el propio panel para que no aparezca un anillo de foco en el video
    var target = AR.rec ? m.panel : (m.wrap.querySelector('[data-autofocus]') || f[0] || m.wrap.querySelector('.mr-close'));
    if (target) { try { target.focus({ preventScroll: true }); } catch (_) { /* nada */ } }
  }

  function bindGlobal() {
    document.addEventListener('keydown', function (e) {
      if (!current) return;
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (e.defaultPrevented) return;
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'Tab') {
        var m = M[current];
        var f = focusables(m.wrap);
        if (!f.length) { e.preventDefault(); return; }
        var first = f[0], last = f[f.length - 1];
        var ae = document.activeElement;
        if (!m.wrap.contains(ae)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && ae === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && ae === last) { e.preventDefault(); first.focus(); }
      }
    });
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var go = t.closest('[data-go]');
      if (go) { e.preventDefault(); open(go.getAttribute('data-go')); return; }
      var a = t.closest('a[target="_blank"]');
      if (a && AR.rec) e.preventDefault(); // en grabación no abrimos pestañas nuevas
    });
    var onMq = function () {
      NAMES.forEach(function (n) { if (M[n].hooks.resize) M[n].hooks.resize(M[n]); });
    };
    if (mqMobile.addEventListener) mqMobile.addEventListener('change', onMq);
  }

  function lockScroll() {
    if (locked) return;
    locked = true;
    prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
  }
  function unlockScroll() {
    if (!locked) return;
    locked = false;
    document.documentElement.style.overflow = prevOverflow || '';
  }

  /* ───────────────────────── construcción ───────────────────────── */
  function makeModal(name) {
    var wrap = document.createElement('div');
    wrap.className = 'mr-modal mr-modal--' + name;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'mr-t-' + name);
    wrap.hidden = true;
    var m = { name: name, wrap: wrap, panel: null, items: [], phase: 'closed', t: 0, ct: 0, started: false, hooks: {} };
    M[name] = m;
    root.appendChild(wrap);
    BUILD[name](m);
    m.panel = wrap.querySelector('.mr-panel');
    m.items = Array.prototype.slice.call(wrap.querySelectorAll('[data-st]'));
    // clic en el fondo (fuera del panel) cierra; se exige que el pointerdown también fuera en el fondo
    var isBg = function (el) { return el === wrap || (el && el.hasAttribute && el.hasAttribute('data-dismiss')); };
    var downBg = false;
    wrap.addEventListener('pointerdown', function (e) { downBg = isBg(e.target); });
    wrap.addEventListener('click', function (e) {
      if (downBg && isBg(e.target) && current === name) close();
      downBg = false;
    });
    wrap.querySelectorAll('.mr-close').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); if (current === name) close(); });
    });
  }

  var BUILD = {};

  /* ═════════════════════════ 1 · RESERVA ═════════════════════════ */
  var WD_IDX = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, 'miércoles': 3, jueves: 4, viernes: 5, sabado: 6, 'sábado': 6 };
  var WD_PLURAL = ['los domingos', 'los lunes', 'los martes', 'los miércoles', 'los jueves', 'los viernes', 'los sábados'];

  function closedWeekdays(hours) {
    var out = {};
    (hours || []).forEach(function (h) {
      if (!h || !/cerrad/i.test(String(h.time || ''))) return;
      var words = String(h.days || '').toLowerCase().split(/[^a-záéíóúñ]+/i);
      words.forEach(function (w) { if (w in WD_IDX) out[WD_IDX[w]] = true; });
    });
    return out;
  }
  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function isoDate(d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function parseIso(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function fmtLong(d) {
    var wd = d.toLocaleDateString('es-MX', { weekday: 'long' });
    var mo = d.toLocaleDateString('es-MX', { month: 'long' });
    return wd + ' ' + d.getDate() + ' de ' + mo;
  }
  function fmtShort(d) {
    var wd = d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');
    var mo = d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
    return wd + ' ' + d.getDate() + ' ' + mo;
  }

  BUILD.reserva = function (m) {
    var c = cfg(), wa = c.whatsapp || {};
    var num = String(wa.number || '').replace(/\D/g, '');
    var display = wa.display || (num ? '+' + num : '');
    var closed = closedWeekdays(c.hours);
    var TIMES = [
      ['Comida', ['13:00', '13:30', '14:00', '14:30', '15:00']],
      ['Cena', ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30']],
    ];
    var timeChips = TIMES.map(function (g) {
      return '<div class="rs-tgroup"><span class="rs-tname">' + g[0] + '</span><div class="rs-chips">' +
        g[1].map(function (h) {
          return '<button type="button" class="rs-chip rs-chip--time" data-time="' + h + '" aria-pressed="false" data-cursor="' + h + '">' + h + '</button>';
        }).join('') + '</div></div>';
    }).join('');

    m.wrap.innerHTML =
      '<section class="mr-panel rs" tabindex="-1">' + closeBtn() +
      '<div class="mr-scroll rs-grid">' +
        '<div class="rs-main">' +
          '<header class="rs-head" data-st>' +
            '<p class="mr-kicker"><span class="rs-wabadge">' + I.wa + '</span>Reservas por WhatsApp</p>' +
            '<h2 class="mr-title" id="mr-t-reserva">Reserva tu mesa</h2>' +
            '<p class="mr-lede">Elige el día, la hora y cuántos serán. Te enviamos la confirmación por WhatsApp.</p>' +
          '</header>' +
          '<div class="rs-row rs-row--top" data-st>' +
            '<div class="rs-field rs-field--people">' +
              '<span class="rs-label" id="rs-l-people">Personas</span>' +
              '<div class="rs-stepper" role="group" aria-labelledby="rs-l-people">' +
                '<button type="button" class="rs-step" data-step="-1" aria-label="Una persona menos" data-cursor="Menos">' + I.minus + '</button>' +
                '<div class="rs-count" aria-live="polite"><span class="rs-num"><b class="rs-n0"></b><b class="rs-n1">2</b></span><small class="rs-unit">personas</small></div>' +
                '<button type="button" class="rs-step" data-step="1" aria-label="Una persona más" data-cursor="Más">' + I.plus + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="rs-field rs-field--day">' +
              '<span class="rs-label" id="rs-l-day">Día</span>' +
              '<div class="rs-chips rs-chips--day" role="group" aria-labelledby="rs-l-day">' +
                '<button type="button" class="rs-chip rs-chip--day" data-day="hoy" aria-pressed="false" data-cursor="Hoy"><span>Hoy</span><small></small></button>' +
                '<button type="button" class="rs-chip rs-chip--day" data-day="manana" aria-pressed="false" data-cursor="Mañana"><span>Mañana</span><small></small></button>' +
                '<button type="button" class="rs-chip rs-chip--day" data-day="otro" aria-pressed="false" data-cursor="Elegir"><span>Otro día</span><small>Calendario</small></button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="rs-datebox" hidden>' +
            '<label class="rs-datefield"><span class="rs-label">Fecha</span><input type="date" class="rs-dateinput" data-cursor="Elegir"></label>' +
            '<span class="rs-datehuman"></span>' +
          '</div>' +
          '<p class="rs-warn" hidden role="status"></p>' +
          '<div class="rs-field rs-field--time" data-st>' +
            '<span class="rs-label">Hora</span>' +
            '<div class="rs-times">' + timeChips + '</div>' +
          '</div>' +
          '<div class="rs-row rs-row--inputs" data-st>' +
            '<label class="rs-input rs-input--name"><span class="rs-label">Nombre</span>' +
              '<input type="text" class="rs-name" autocomplete="name" maxlength="60" placeholder="¿A nombre de quién?" data-cursor="Escribir">' +
              '<span class="rs-hint" hidden>Añade tu nombre para que reconozcamos tu reserva — o vuelve a pulsar para enviar sin él.</span>' +
            '</label>' +
            '<label class="rs-input"><span class="rs-label">Nota <em>opcional</em></span>' +
              '<input type="text" class="rs-note" maxlength="140" placeholder="Cumpleaños, alergias, silla para bebé…" data-cursor="Escribir">' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<aside class="rs-side">' +
          '<div class="rs-sidehead" data-st>' +
            '<p class="rs-label">Tu mensaje</p>' +
            '<p class="rs-sidetext">Así lo recibiremos. Lo envías tú, desde tu WhatsApp: sin registros ni esperas.</p>' +
          '</div>' +
          '<div class="rs-phone" data-st>' +
            '<div class="rs-chathead">' +
              '<span class="rs-avatar" aria-hidden="true">AR</span>' +
              '<span class="rs-who"><b>Antica Roma</b><small>' + esc(display) + '</small></span>' +
              '<span class="rs-chatwa" aria-hidden="true">' + I.wa + '</span>' +
            '</div>' +
            '<div class="rs-chat">' +
              '<span class="rs-pill">Hoy</span>' +
              '<div class="rs-bubble"><p class="rs-msg" aria-live="polite"></p><span class="rs-meta">ahora ' + I.ticks + '</span></div>' +
            '</div>' +
          '</div>' +
        '</aside>' +
        '<div class="rs-ctawrap" data-st>' +
          '<a class="rs-cta" href="https://wa.me/' + num + '" target="_blank" rel="noopener" data-cursor="Enviar">' + I.wa + '<span>Reservar por WhatsApp</span></a>' +
          '<p class="rs-direct"><span class="rs-phoneNum">' + esc(display) + '</span><span class="rs-sep" aria-hidden="true">·</span>' +
            '<a href="https://wa.me/' + num + '" target="_blank" rel="noopener" data-cursor="Abrir">Escríbenos directamente</a></p>' +
        '</div>' +
      '</div></section>';

    var W = m.wrap;
    var $ = function (s) { return W.querySelector(s); };
    var $$ = function (s) { return Array.prototype.slice.call(W.querySelectorAll(s)); };
    var stepBtns = $$('.rs-step');
    var dayBtns = $$('.rs-chip--day');
    var timeBtns = $$('.rs-chip--time');
    var n0 = $('.rs-n0'), n1 = $('.rs-n1'), unit = $('.rs-unit');
    var dateBox = $('.rs-datebox'), dateInput = $('.rs-dateinput'), dateHuman = $('.rs-datehuman');
    var warn = $('.rs-warn');
    var nameIn = $('.rs-name'), noteIn = $('.rs-note'), hint = $('.rs-hint'), nameWrap = $('.rs-input--name');
    var msgEl = $('.rs-msg'), cta = $('.rs-cta'), bubble = $('.rs-bubble');

    var S = { n: 2, day: 'hoy', other: null, time: '20:00', name: '', note: '' };
    var nudged = false;
    var anim = { roll: 1, rollDir: 1, glow: 0, reveal: 0, revealH: 0, bubble: 0, press: 0 };
    var flash = {};
    var prevVals = {};

    function isClosed(d) { return !!closed[d.getDay()]; }
    function firstOpen(from) { for (var i = 0; i < 14; i++) { var d = addDays(from, i); if (!isClosed(d)) return d; } return from; }
    function dateFor(key) {
      var t0 = today();
      if (key === 'hoy') return t0;
      if (key === 'manana') return addDays(t0, 1);
      return S.other || firstOpen(addDays(t0, 2));
    }
    function refreshDayLabels() {
      dayBtns.forEach(function (b) {
        var k = b.getAttribute('data-day');
        var sm = b.querySelector('small');
        if (k === 'otro') {
          sm.textContent = S.other ? fmtShort(S.other) : 'Calendario';
          b.classList.toggle('is-closedday', !!(S.other && isClosed(S.other)));
          return;
        }
        var d = dateFor(k);
        sm.textContent = isClosed(d) ? 'Cerrado' : fmtShort(d);
        b.classList.toggle('is-closedday', isClosed(d));
      });
    }

    function parts() {
      var n = S.n;
      var d = dateFor(S.day);
      var when = S.day === 'hoy' ? 'hoy' : S.day === 'manana' ? 'mañana' : 'el ' + fmtLong(d);
      var name = S.name.trim().replace(/\s+/g, ' ');
      var note = S.note.trim().replace(/\s+/g, ' ');
      if (note && !/[.!?…)]$/.test(note)) note += '.';
      return { ppl: n + (n === 1 ? ' persona' : ' personas'), when: when, time: S.time, name: name, note: note, date: d };
    }
    function message(p) {
      var s = '¡Hola Antica Roma! 🍝 Quisiera reservar una mesa para ' + p.ppl + ' ' + p.when + ' a las ' + p.time + '.';
      if (p.name) s += ' A nombre de ' + p.name + '.';
      if (p.note) s += ' Nota: ' + p.note;
      return s;
    }
    function v(k, txt) { return '<b class="rs-v" data-k="' + k + '">' + esc(txt) + '</b>'; }
    function messageHTML(p) {
      var s = '¡Hola Antica Roma! 🍝 Quisiera reservar una mesa para ' + v('ppl', p.ppl) + ' ' + v('when', p.when) + ' a las ' + v('time', p.time) + '.';
      if (p.name) s += ' A nombre de ' + v('name', p.name) + '.';
      else s += ' <span class="rs-missing" data-k="name">A nombre de&nbsp;…</span>';
      if (p.note) s += ' <span class="rs-v rs-v--note" data-k="note">Nota: ' + esc(p.note) + '</span>';
      return s;
    }

    function render() {
      var p = parts();
      // valores que cambian → destello dorado en la vista previa
      ['ppl', 'when', 'time', 'name', 'note'].forEach(function (k) {
        if (prevVals[k] !== undefined && prevVals[k] !== p[k] && p[k]) flash[k] = 1;
        prevVals[k] = p[k];
      });
      msgEl.innerHTML = messageHTML(p);
      var text = message(p);
      cta.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(text);
      unit.textContent = S.n === 1 ? 'persona' : 'personas';
      stepBtns[0].disabled = S.n <= 1;
      stepBtns[1].disabled = S.n >= 20;
      dayBtns.forEach(function (b) {
        var on = b.getAttribute('data-day') === S.day;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      timeBtns.forEach(function (b) {
        var on = b.getAttribute('data-time') === S.time;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      refreshDayLabels();
      if (S.day === 'otro') dateHuman.textContent = fmtLong(p.date);
      var cl = isClosed(p.date);
      warn.hidden = !cl;
      if (cl) warn.textContent = 'Ojo: ' + WD_PLURAL[p.date.getDay()] + ' estamos cerrados. ¿Probamos otro día?';
      nameWrap.classList.toggle('is-missing', !p.name);
      if (p.name) { hint.hidden = true; nudged = false; }
    }

    function setN(n) {
      n = clamp(n, 1, 20);
      if (n === S.n) return;
      anim.rollDir = n > S.n ? 1 : -1;
      n0.textContent = S.n;
      n1.textContent = n;
      anim.roll = 0;
      S.n = n;
      render();
    }

    stepBtns.forEach(function (b) {
      b.addEventListener('click', function () { setN(S.n + Number(b.getAttribute('data-step'))); });
    });
    dayBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        S.day = b.getAttribute('data-day');
        if (S.day === 'otro') {
          if (!S.other) S.other = dateFor('otro');
          dateInput.value = isoDate(S.other);
          if (dateBox.hidden) { dateBox.hidden = false; anim.revealH = dateBox.scrollHeight; }
        }
        render();
      });
    });
    timeBtns.forEach(function (b) {
      b.addEventListener('click', function () { S.time = b.getAttribute('data-time'); render(); });
    });
    var onDate = function () {
      var d = parseIso(dateInput.value);
      if (!d) return;
      if (d < today()) { d = today(); dateInput.value = isoDate(d); }
      S.other = d;
      render();
    };
    dateInput.addEventListener('change', onDate);
    dateInput.addEventListener('input', onDate);
    nameIn.addEventListener('input', function () { S.name = nameIn.value; render(); });
    noteIn.addEventListener('input', function () { S.note = noteIn.value; render(); });
    cta.addEventListener('click', function (e) {
      render(); // href siempre al día
      if (!S.name.trim() && !nudged) {
        e.preventDefault();
        nudged = true;
        anim.glow = 1;
        hint.hidden = false;
        try { nameIn.focus({ preventScroll: false }); } catch (_) { nameIn.focus(); }
        return;
      }
      anim.press = 1;
    });

    m.hooks.prepare = function () {
      // valores por defecto razonables: si hoy cerramos, proponemos el siguiente día abierto
      if (!m.everOpened) {
        m.everOpened = true;
        var t0 = today();
        S.day = !isClosed(t0) ? 'hoy' : !isClosed(addDays(t0, 1)) ? 'manana' : 'otro';
        if (S.day === 'otro') { S.other = firstOpen(t0); dateInput.value = isoDate(S.other); dateBox.hidden = false; }
      }
      dateInput.min = isoDate(today());
      anim.roll = 1;
      anim.bubble = 0;
      prevVals = {};
      flash = {};
      render();
    };

    m.hooks.tick = function (mm, dt) {
      // contador que rueda
      if (anim.roll < 1) {
        anim.roll = Math.min(1, anim.roll + dt / 0.42);
        var e = E.outCubic(anim.roll), d = anim.rollDir;
        n1.style.transform = 'translate3d(0,' + ((1 - e) * 70 * d).toFixed(2) + '%,0)';
        n1.style.opacity = e.toFixed(3);
        n0.style.transform = 'translate3d(0,' + (-e * 70 * d).toFixed(2) + '%,0)';
        n0.style.opacity = (1 - e).toFixed(3);
      } else if (n0.style.opacity !== '0') {
        n1.style.transform = ''; n1.style.opacity = '';
        n0.style.opacity = '0'; n0.style.transform = '';
      }
      // destellos en la vista previa
      for (var k in flash) {
        if (!flash[k]) continue;
        flash[k] = flash[k] < 0.01 ? 0 : damp(flash[k], 0, 2.6, dt);
        var spans = msgEl.querySelectorAll('[data-k="' + k + '"]');
        for (var i = 0; i < spans.length; i++) {
          spans[i].style.backgroundColor = flash[k] ? 'rgba(201,162,74,' + (flash[k] * 0.42).toFixed(3) + ')' : '';
          spans[i].style.boxShadow = flash[k] ? '0 0 0 ' + (2 + flash[k] * 2).toFixed(1) + 'px rgba(201,162,74,' + (flash[k] * 0.42).toFixed(3) + ')' : '';
        }
      }
      // burbuja: entra un poco después que el panel
      if (anim.bubble < 1) {
        var bs = Math.max(0, mm.t - 0.6);
        if (mm.phase !== 'opening' || bs > 1.2) {
          anim.bubble = 1;
          bubble.style.opacity = '';
          bubble.style.transform = '';
        } else {
          var be = spring(bs, 0.55, 13);
          bubble.style.opacity = E.outCubic(clamp01(bs / 0.22)).toFixed(3);
          bubble.style.transform = 'translate3d(0,' + ((1 - be) * 18).toFixed(2) + 'px,0) scale(' + (0.9 + 0.1 * be).toFixed(4) + ')';
        }
      }
      // aviso suave en el nombre
      if (anim.glow > 0) {
        anim.glow = Math.max(0, anim.glow - dt / 2.2);
        var g = anim.glow * (0.6 + 0.4 * Math.cos((1 - anim.glow) * 2.2 * Math.PI * 2));
        nameWrap.style.boxShadow = g > 0.001 ? '0 0 0 ' + (4 + 6 * g).toFixed(1) + 'px rgba(201,162,74,' + (0.28 * g).toFixed(3) + ')' : '';
        nameWrap.style.backgroundColor = g > 0.001 ? 'rgba(201,162,74,' + (0.10 * g).toFixed(3) + ')' : '';
      }
      // botón: pulso al pulsar
      if (anim.press > 0) {
        anim.press = Math.max(0, anim.press - dt / 0.5);
        var pr = Math.sin((1 - anim.press) * Math.PI);
        cta.style.transform = anim.press > 0 ? 'scale(' + (1 - 0.03 * pr).toFixed(4) + ')' : '';
      }
      // revelado de la fecha
      var want = S.day === 'otro' ? 1 : 0;
      if (anim.reveal !== want || (want && dateBox.hidden)) {
        if (want && dateBox.hidden) { dateBox.hidden = false; anim.revealH = dateBox.scrollHeight; }
        anim.reveal = want ? Math.min(1, anim.reveal + dt / 0.4) : Math.max(0, anim.reveal - dt / 0.3);
        var re = E.inOutCubic(anim.reveal);
        if (!anim.revealH) anim.revealH = dateBox.scrollHeight || 64;
        dateBox.style.height = (re * anim.revealH).toFixed(1) + 'px';
        dateBox.style.opacity = re.toFixed(3);
        dateBox.style.transform = 'translate3d(0,' + ((1 - re) * -8).toFixed(2) + 'px,0)';
        if (anim.reveal === 0) { dateBox.hidden = true; }
        if (anim.reveal === 1) { dateBox.style.height = ''; dateBox.style.transform = ''; }
      }
    };
    m.hooks.onClosed = function () { nudged = false; hint.hidden = true; nameWrap.style.boxShadow = ''; nameWrap.style.backgroundColor = ''; };
    render();
  };

  /* ═════════════════════════ 2 · UBICACIÓN ═════════════════════════ */
  // Ilustración del centro de Mérida (no a escala). Calles pares de norte a sur, impares de oriente a poniente.
  var MAP = { W: 760, H: 780, pin: [385, 562], mon: [455, 96] };

  function mapBaseSVG() {
    var R = mulberry32(20261012);
    // calles pares (N–S): la 60 en x=350, crecen hacia el poniente; impares (O–E): la 47 en y=276, crecen hacia el sur
    var XS = [-70, 0, 70, 140, 210, 280, 350, 420, 490, 560, 630, 700, 770, 840];
    var XN = [0, 70, 68, 66, 64, 62, 60, 58, 56, 54, 52, 50, 48, 0];
    var YS = [-88, -36, 16, 68, 120, 172, 224, 276, 328, 380, 432, 484, 536, 588, 640, 692, 744, 796, 848];
    var hwX = function (i) { return XN[i] === 60 ? 9 : 7; };
    var FILL = ['#ecdcb9', '#efe3c8', '#e9d5b2', '#efdccb', '#f1e7d1', '#e7d6b6', '#f0dfc0'];
    var s = '';
    s += '<defs>' +
      '<radialGradient id="ubVig" cx="50%" cy="50%" r="72%"><stop offset="58%" stop-color="#3a2414" stop-opacity="0"/><stop offset="100%" stop-color="#3a2414" stop-opacity=".24"/></radialGradient>' +
      '<linearGradient id="ubNorth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8f1e1" stop-opacity=".6"/><stop offset="1" stop-color="#f8f1e1" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="ubTree" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#a9ba8b"/><stop offset="1" stop-color="#6c8354"/></radialGradient>' +
      '</defs>';
    s += '<rect x="-120" y="-120" width="1000" height="1020" fill="#f8f1e1"/>';
    // manzanas
    for (var j = 0; j < YS.length - 1; j++) {
      for (var i = 0; i < XS.length - 1; i++) {
        if (XS[i] === 280 && YS[j] === 640) continue; // Plaza Grande
        if (XS[i] === 350 && YS[j] === 640) continue; // Catedral
        if (XS[i] === 420 && YS[j] < 276) continue;   // Paseo de Montejo
        var x0 = XS[i] + hwX(i), x1 = XS[i + 1] - hwX(i + 1), y0 = YS[j] + 7, y1 = YS[j + 1] - 7;
        var w = x1 - x0, h = y1 - y0;
        s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" rx="2.5" fill="' + FILL[Math.floor(R() * FILL.length)] + '" stroke="#d6c096" stroke-width=".8"/>';
        var nl = 1 + Math.floor(R() * 3);
        for (var k = 0; k < nl; k++) {
          if (R() < 0.5) { var lx = (x0 + w * (0.22 + R() * 0.56)).toFixed(1); s += '<line x1="' + lx + '" y1="' + y0 + '" x2="' + lx + '" y2="' + y1 + '" stroke="#dcc79f" stroke-width=".7"/>'; }
          else { var ly = (y0 + h * (0.22 + R() * 0.56)).toFixed(1); s += '<line x1="' + x0 + '" y1="' + ly + '" x2="' + x1 + '" y2="' + ly + '" stroke="#dcc79f" stroke-width=".7"/>'; }
        }
        if (R() < 0.72) {
          var cw = w * (0.26 + R() * 0.24), ch = h * (0.28 + R() * 0.24);
          var cx = x0 + (w - cw) * (0.25 + R() * 0.5), cy = y0 + (h - ch) * (0.25 + R() * 0.5);
          var green = R() < 0.5;
          s += '<rect x="' + cx.toFixed(1) + '" y="' + cy.toFixed(1) + '" width="' + cw.toFixed(1) + '" height="' + ch.toFixed(1) + '" rx="1.5" fill="' + (green ? '#cdd1a6' : '#e2cfa7') + '"/>';
          if (green) {
            var nt = 1 + Math.floor(R() * 2);
            for (var q = 0; q < nt; q++) {
              s += '<circle cx="' + (cx + cw * (0.3 + R() * 0.4)).toFixed(1) + '" cy="' + (cy + ch * (0.3 + R() * 0.4)).toFixed(1) + '" r="' + (2.8 + R() * 2.4).toFixed(1) + '" fill="url(#ubTree)"/>';
            }
          }
        }
      }
    }
    // velo hacia el norte
    s += '<rect x="-80" y="-90" width="920" height="330" fill="url(#ubNorth)"/>';
    // Plaza Grande (entre calles 60/62 y 61/63)
    s += '<g class="ub-plaza">' +
      '<rect x="287" y="647" width="54" height="38" rx="2" fill="#b9c599" stroke="#9fb07e" stroke-width="1"/>' +
      '<path d="M287 647L341 685M341 647L287 685M314 647v38M287 666h54" stroke="#efe6cf" stroke-width="2.2"/>' +
      '<circle cx="314" cy="666" r="5" fill="#efe6cf" stroke="#c9a24a" stroke-width=".8"/>';
    for (var tx = 291; tx <= 338; tx += 7.8) {
      s += '<circle cx="' + tx.toFixed(1) + '" cy="651" r="2.9" fill="url(#ubTree)"/><circle cx="' + tx.toFixed(1) + '" cy="681" r="2.9" fill="url(#ubTree)"/>';
    }
    s += '</g>';
    // Catedral (lado oriente de la plaza, sobre la calle 60)
    s += '<g class="ub-cat">' +
      '<rect x="359" y="647" width="54" height="38" rx="2.5" fill="#e6d0a4" stroke="#d6c096" stroke-width=".8"/>' +
      '<rect x="363" y="657" width="38" height="18" fill="#dcc293" stroke="#c4a56f" stroke-width=".9"/>' +
      '<rect x="360" y="650" width="9" height="9" fill="#d4b783" stroke="#b9975f" stroke-width=".9"/>' +
      '<rect x="360" y="673" width="9" height="9" fill="#d4b783" stroke="#b9975f" stroke-width=".9"/>' +
      '<circle cx="398" cy="666" r="6" fill="#e9d6ae" stroke="#b9975f" stroke-width=".9"/>' +
      '<path d="M377 666h12M383 660v12" stroke="#b9975f" stroke-width=".9"/>' +
      '</g>';
    // Paseo de Montejo: bulevar arbolado desde la calle 47 hacia el norte
    var px = MAP.mon[0];
    s += '<g class="ub-paseo">' +
      '<rect x="' + (px - 35) + '" y="-90" width="70" height="373" fill="#f8f1e1"/>' +
      '<rect x="' + (px - 26) + '" y="-90" width="8" height="373" fill="#dcd3ad"/>' +
      '<rect x="' + (px + 18) + '" y="-90" width="8" height="373" fill="#dcd3ad"/>' +
      '<rect x="' + (px - 4) + '" y="-90" width="8" height="366" rx="3" fill="#bcc79c"/>';
    for (var ty = -84; ty <= 272; ty += 12) {
      if (Math.abs(ty - MAP.mon[1]) < 72) continue;
      s += '<circle cx="' + (px - 22) + '" cy="' + ty + '" r="4.8" fill="url(#ubTree)"/>' +
           '<circle cx="' + (px + 22) + '" cy="' + (ty + 6) + '" r="4.8" fill="url(#ubTree)"/>';
    }
    s += '<path d="M' + (px - 35) + ' 283h70" stroke="#c9a24a" stroke-width="1.2" stroke-dasharray="2 3"/>';
    s += '</g>';
    // Monumento a la Patria (glorieta)
    var mo = MAP.mon;
    s += '<g class="ub-mon" transform="translate(' + mo[0] + ' ' + mo[1] + ')">' +
      '<circle r="70" fill="#f8f1e1"/>' +
      '<circle r="70" fill="none" stroke="#e3d6b6" stroke-width="1"/>' +
      '<circle r="56" fill="#b9c599" stroke="#a3b282" stroke-width="1"/>';
    for (var a = 0; a < 24; a++) {
      var an = (a / 24) * Math.PI * 2;
      s += '<circle cx="' + (Math.cos(an) * 50).toFixed(1) + '" cy="' + (Math.sin(an) * 50).toFixed(1) + '" r="3.6" fill="url(#ubTree)"/>';
    }
    s += '<circle r="42" fill="#efe3c8" stroke="#c9a24a" stroke-width="1"/>' +
      '<path d="M-30 4A30 30 0 0 1 30 4" fill="none" stroke="#d2b98a" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M-30 4A30 30 0 0 1 30 4" fill="none" stroke="#efe3c8" stroke-width="1" stroke-dasharray="1.5 3.5"/>' +
      '<path d="M-14 16a14 9 0 0 0 28 0z" fill="#a9c7c3" stroke="#8fb1ad" stroke-width=".8"/>' +
      '<circle r="5.5" fill="#e9d6ae" stroke="#b9975f" stroke-width="1"/>' +
      '<circle r="2" fill="#c9a24a"/>' +
      '</g>';
    s += '<rect x="-120" y="-120" width="1000" height="1020" fill="url(#ubVig)"/>';
    return s;
  }

  function mapOverSVG() {
    var s = '';
    var st = function (x, y, txt, rot) {
      return '<text class="ub-st" x="' + x + '" y="' + y + '"' + (rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : '') + ' text-anchor="middle" dominant-baseline="central">' + txt + '</text>';
    };
    // nombres de calles (sobre el arroyo)
    s += '<g class="ub-sts">' +
      st(140, 562, 'CALLE 66', -90) + st(210, 406, 'CALLE 64', -90) + st(280, 510, 'CALLE 62', -90) + st(350, 406, 'CALLE 60', -90) +
      st(420, 458, 'CALLE 58', -90) + st(490, 354, 'CALLE 56', -90) + st(560, 562, 'CALLE 54', -90) + st(630, 406, 'CALLE 52', -90) +
      st(245, 276, 'CALLE 47') + st(595, 276, 'CALLE 47') + st(245, 380, 'CALLE 51') + st(595, 484, 'CALLE 55') +
      st(245, 588, 'CALLE 59') + st(595, 640, 'CALLE 61') + st(245, 692, 'CALLE 63') +
      '</g>';
    // lugares
    var lm = function (x, y, txt, anchor, cls) {
      return '<text class="ub-lm' + (cls ? ' ' + cls : '') + '" x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle') + '">' + txt + '</text>';
    };
    s += '<g class="ub-lms">' +
      '<g class="ub-lmp">' + lm(311, 714, 'Plaza Grande', 'middle', 'ub-lm--sm') + lm(392, 714, 'Catedral', 'start', 'ub-lm--sm') + '</g>' +
      '<g class="ub-mon-r">' + lm(535, 90, 'Monumento', 'start') + lm(535, 108, 'a la Patria', 'start') +
        '<path d="M531 98 L514 98" stroke="#8c6f4f" stroke-width=".8"/></g>' +
      '<g class="ub-mon-l">' + lm(377, 90, 'Monumento', 'end') + lm(377, 110, 'a la Patria', 'end') +
        '<path d="M381 98 L396 98" stroke="#8c6f4f" stroke-width=".8"/></g>' +
      '<text class="ub-lm ub-lm--paseo" x="455" y="222" text-anchor="middle" dominant-baseline="central" transform="rotate(-90 455 222)">Paseo de Montejo</text>' +
      '</g>';
    // cartela
    s += '<g class="ub-cartouche" transform="translate(66 52)">' +
      '<rect width="214" height="74" rx="3" fill="#f6efe0" fill-opacity=".95" stroke="#c9a24a" stroke-width="1"/>' +
      '<rect x="5" y="5" width="204" height="64" rx="2" fill="none" stroke="#c9a24a" stroke-opacity=".5" stroke-width=".8"/>' +
      '<text class="ub-ct1" x="110" y="38" text-anchor="middle">MÉRIDA</text>' +
      '<text class="ub-ct2" x="107" y="56" text-anchor="middle">CENTRO HISTÓRICO · YUCATÁN</text>' +
      '</g>';
    // rosa de los vientos
    s += '<g class="ub-compass" transform="translate(650 676)"><g class="ub-compass-r">' +
      '<circle r="30" fill="#f6efe0" fill-opacity=".94" stroke="#c9a24a" stroke-width="1"/>' +
      '<circle r="24" fill="none" stroke="#c9a24a" stroke-opacity=".45" stroke-width=".7" stroke-dasharray="1 3"/>' +
      '<path d="M0 -24L5 0L0 24L-5 0Z" fill="#c9a24a"/><path d="M0 -24L5 0L0 0Z" fill="#9e1b1f"/>' +
      '<path d="M-24 0L0 4L24 0L0 -4Z" fill="#d9c49a"/>' +
      '<circle r="2.4" fill="#f6efe0" stroke="#9e1b1f" stroke-width="1"/>' +
      '</g><text class="ub-cn" x="0" y="-36" text-anchor="middle">N</text></g>';
    // pin
    var p = MAP.pin;
    s += '<g class="ub-pin" transform="translate(' + p[0] + ' ' + p[1] + ')">' +
      '<circle class="ub-ring" r="10" fill="none" stroke="#c4262c" stroke-width="2"/>' +
      '<circle class="ub-ring" r="10" fill="none" stroke="#c4262c" stroke-width="2"/>' +
      '<ellipse class="ub-shadow" rx="11" ry="3.6" fill="#1c120d" fill-opacity=".32"/>' +
      '<g class="ub-pinbody">' +
        '<path d="M0 0C-3 -9 -17 -19 -17 -33A17 17 0 1 1 17 -33C17 -19 3 -9 0 0Z" fill="#9e1b1f" stroke="#6f1215" stroke-width="1"/>' +
        '<path d="M-11 -41A13 13 0 0 1 4 -46" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2.4" stroke-linecap="round"/>' +
        '<circle cy="-33" r="11" fill="#f6efe0" stroke="#c9a24a" stroke-width="1.2"/>' +
        '<text class="ub-pinmono" y="-29.2" text-anchor="middle">AR</text>' +
      '</g>' +
      '<g class="ub-flag">' +
        '<path d="M24 -64h132a3 3 0 0 1 3 3v30a3 3 0 0 1-3 3H38l-10 9v-9h-4a3 3 0 0 1-3-3v-30a3 3 0 0 1 3-3z" fill="#1c120d" fill-opacity=".92"/>' +
        '<path d="M28 -60h124v26H28z" fill="none" stroke="#c9a24a" stroke-opacity=".6" stroke-width=".8"/>' +
        '<text class="ub-flagt" x="90" y="-42.4" text-anchor="middle">ANTICA ROMA</text>' +
      '</g>' +
      '</g>';
    return s;
  }

  BUILD.ubicacion = function (m) {
    var c = cfg(), ad = c.address || {};
    var q = encodeURIComponent(ad.mapsQuery || [ad.line1, ad.line2].filter(Boolean).join(', ') || 'Antica Roma Mérida');
    var hours = (c.hours || []).map(function (h) {
      var isClosed = /cerrad/i.test(String(h.time || ''));
      return '<li class="ub-hrow' + (isClosed ? ' is-closed' : '') + '"><span class="ub-hdays">' + esc(h.days) + '</span><span class="ub-hdots" aria-hidden="true"></span><span class="ub-htime">' + esc(h.time) + '</span></li>';
    }).join('');
    var vb = '0 0 ' + MAP.W + ' ' + MAP.H;
    m.wrap.innerHTML =
      '<section class="mr-panel ub" tabindex="-1">' + closeBtn() +
      '<div class="mr-scroll ub-grid">' +
        '<div class="ub-mapcol" data-st>' +
          '<div class="ub-map" aria-hidden="true">' +
            '<div class="ub-tilt">' +
              '<svg class="ub-layer ub-base" viewBox="' + vb + '" preserveAspectRatio="xMidYMid slice">' + mapBaseSVG() + '</svg>' +
              '<svg class="ub-layer ub-over" viewBox="' + vb + '" preserveAspectRatio="xMidYMid slice">' + mapOverSVG() + '</svg>' +
            '</div>' +
            '<div class="ub-mapframe"></div>' +
          '</div>' +
          '<p class="ub-mapnote">Ilustración · no a escala</p>' +
        '</div>' +
        '<div class="ub-info">' +
          '<header class="ub-head" data-st>' +
            '<p class="mr-kicker">Ubicación</p>' +
            '<h2 class="mr-title" id="mr-t-ubicacion">Cómo llegar</h2>' +
            '<p class="mr-lede">Te esperamos en el centro de Mérida, con la mesa puesta y la pasta recién hecha.</p>' +
          '</header>' +
          '<div class="ub-block ub-addr" data-st>' +
            '<span class="ub-ico">' + I.pin + '</span>' +
            '<div><p class="ub-l1">' + esc(ad.line1 || 'Mérida, Yucatán') + '</p>' + (ad.line2 ? '<p class="ub-l2">' + esc(ad.line2) + '</p>' : '') + '</div>' +
          '</div>' +
          '<div class="ub-block ub-hours" data-st>' +
            '<span class="ub-ico">' + I.clock + '</span>' +
            '<div class="ub-hwrap"><p class="ub-htitle">Horario</p><ul class="ub-hlist">' + hours + '</ul></div>' +
          '</div>' +
          '<div class="ub-actions" data-st>' +
            '<a class="mr-btn mr-btn--primary" href="https://www.google.com/maps/search/?api=1&amp;query=' + q + '" target="_blank" rel="noopener" data-cursor="Abrir">' + I.map + '<span>Abrir en Google Maps</span></a>' +
            '<a class="mr-btn mr-btn--ghost" href="https://www.google.com/maps/dir/?api=1&amp;destination=' + q + '" target="_blank" rel="noopener" data-cursor="Ruta">' + I.route + '<span>Cómo llegar</span></a>' +
          '</div>' +
          '<p class="ub-more" data-st><button type="button" class="mr-link" data-go="reserva" data-cursor="Reservar">¿Vienes a comer? Reserva tu mesa' + I.arrow + '</button></p>' +
        '</div>' +
      '</div></section>';

    var W = m.wrap;
    var tilt = W.querySelector('.ub-tilt');
    var base = W.querySelector('.ub-base'), over = W.querySelector('.ub-over');
    var pinBody = W.querySelector('.ub-pinbody'), shadow = W.querySelector('.ub-shadow');
    var rings = W.querySelectorAll('.ub-ring'), flag = W.querySelector('.ub-flag');
    var compass = W.querySelector('.ub-compass-r'), compassG = W.querySelector('.ub-compass'), lms = W.querySelector('.ub-lms');
    var st = { tx: 0, ty: 0, t: 0, comp: 0 };

    function setViewBox() {
      // en móvil recortamos alrededor del centro para que se lean las etiquetas
      var mob = !!mqMobile.matches;
      var v = mob ? '135 -2 520 724' : '0 0 ' + MAP.W + ' ' + MAP.H;
      base.setAttribute('viewBox', v);
      over.setAttribute('viewBox', v);
      compassG.setAttribute('transform', mob ? 'translate(604 650)' : 'translate(650 676)');
    }
    m.hooks.resize = setViewBox;
    m.hooks.prepare = function () { setViewBox(); st.t = 0; };
    m.hooks.tick = function (mm, dt) {
      st.t += dt;
      var t = Math.max(0, mm.phase === 'closing' ? OPEN_SETTLE : mm.t);
      // inclinación y paralaje con el ratón
      st.tx = damp(st.tx, mx, 4, dt);
      st.ty = damp(st.ty, my, 4, dt);
      var rx = (-st.ty * 3.2).toFixed(3), ry = (st.tx * 4.2).toFixed(3);
      var intro = E.outCubic(clamp01((t - 0.1) / 1.1));
      tilt.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) scale(' + (1.045 + 0.06 * (1 - intro)).toFixed(4) + ')';
      base.style.transform = 'translate3d(' + (-st.tx * 8).toFixed(2) + 'px,' + (-st.ty * 8).toFixed(2) + 'px,0)';
      over.style.transform = 'translate3d(' + (-st.tx * 20).toFixed(2) + 'px,' + (-st.ty * 16).toFixed(2) + 'px,0)';
      lms.style.opacity = E.outCubic(clamp01((t - 0.45) / 0.7)).toFixed(3);
      // pin: cae con rebote y luego flota
      var pt = t - 0.55;
      var drop = pt <= 0 ? 0 : spring(pt, 0.42, 11);
      var bob = (0.5 - 0.5 * Math.cos(st.t * 2.4)) * 6 * clamp01((pt - 0.6) / 0.8);
      var y = -(1 - drop) * 150 - bob;
      pinBody.setAttribute('transform', 'translate(0 ' + y.toFixed(2) + ')');
      pinBody.style.opacity = pt <= 0 ? '0' : clamp01(pt / 0.12).toFixed(3);
      var hgt = clamp01(-y / 60);
      shadow.setAttribute('rx', (11 - 5 * hgt).toFixed(2));
      shadow.setAttribute('ry', (3.6 - 1.4 * hgt).toFixed(2));
      shadow.style.opacity = (pt <= 0 ? 0 : clamp01(pt / 0.3) * (1 - 0.6 * hgt)).toFixed(3);
      flag.setAttribute('transform', 'translate(0 ' + (y * 0.92).toFixed(2) + ')');
      var fl = E.outCubic(clamp01((pt - 0.45) / 0.5));
      flag.style.opacity = fl.toFixed(3);
      // anillos de pulso
      var ringOn = clamp01((pt - 0.35) / 0.4);
      for (var i = 0; i < rings.length; i++) {
        var ph = (st.t * 0.6 + i * 0.5) % 1;
        rings[i].setAttribute('r', (6 + 38 * E.outCubic(ph)).toFixed(2));
        rings[i].style.opacity = ((1 - ph) * 0.65 * ringOn).toFixed(3);
      }
      st.comp = damp(st.comp, st.tx * 14 + Math.sin(st.t * 0.7) * 3, 3, dt);
      compass.setAttribute('transform', 'rotate(' + st.comp.toFixed(2) + ')');
    };
  };

  /* ═════════════════════════ 3 · HISTORIA ═════════════════════════ */
  function colosseoSVG() {
    // alzado esquemático del Coliseo, con su perfil en ruina
    var out = 'M6 74V14h66l5 6h5l4 12h9l6 12h12v30z';
    var s = '<svg class="hs-colosseo" viewBox="0 0 120 80" aria-hidden="true"><defs><clipPath id="hsClip"><path d="' + out + '"/></clipPath></defs>';
    s += '<rect x="0" y="0" width="120" height="80" fill="#efe3c8"/>';
    s += '<g clip-path="url(#hsClip)" fill="none" stroke="#b08a3e" stroke-width=".9">';
    s += '<rect x="0" y="0" width="120" height="80" fill="#f3e7cf" stroke="none"/>';
    var tiers = [[56, 74], [38, 54], [22, 36]];
    tiers.forEach(function (tr) {
      s += '<path d="M0 ' + tr[0] + 'H120" />';
      for (var x = 9; x < 116; x += 11) {
        var y0 = tr[0] + 3, y1 = tr[1], r = 3.5;
        s += '<path d="M' + x + ' ' + y1 + 'V' + (y0 + r) + 'a' + r + ' ' + r + ' 0 0 1 ' + (2 * r) + ' 0V' + y1 + '"/>';
      }
    });
    s += '<path d="M0 20H120M0 21.5H120"/>';
    for (var x2 = 12; x2 < 72; x2 += 11) s += '<rect x="' + x2 + '" y="15.5" width="3" height="3"/>';
    s += '</g>';
    s += '<path d="' + out + '" fill="none" stroke="#9c7632" stroke-width="1.1" stroke-linejoin="round"/>';
    s += '<path d="M2 74.5H118" stroke="#9c7632" stroke-width="1"/>';
    s += '</svg>';
    return s;
  }

  BUILD.historia = function (m) {
    var c = cfg();
    var km = fmtNum(c.distanceKm || 9411);
    m.wrap.innerHTML =
      '<section class="mr-panel hs" tabindex="-1">' + closeBtn() +
      '<div class="mr-scroll hs-grid">' +
        '<figure class="hs-photo" data-st>' +
          '<div class="hs-photoin"><img data-src="assets/story.webp" alt="Manos cortando tagliatelle frescas sobre una tabla enharinada"></div>' +
          '<div class="hs-shade" aria-hidden="true"></div>' +
          '<span class="hs-badge">Antica Roma <i>·</i> Mérida</span>' +
          '<figcaption class="hs-cap"><span class="hs-capk">Fatto a mano · Hecho a mano</span><span class="hs-capt">Harina, huevo y paciencia.</span></figcaption>' +
        '</figure>' +
        '<article class="hs-text">' +
          '<header class="hs-head" data-st>' +
            '<p class="mr-kicker">Más de nuestra historia</p>' +
            '<h2 class="mr-title hs-title" id="mr-t-historia">De Roma <em>a</em> Mérida</h2>' +
            '<p class="mr-lede">Una receta nunca viaja sola: viaja con las manos que la aprendieron. Esta es la nuestra, contada en tres capítulos.</p>' +
          '</header>' +
          '<ol class="hs-chapters">' +
            '<li class="hs-line" aria-hidden="true"><span></span></li>' +
            '<li class="hs-ch" data-st>' +
              '<span class="hs-num" aria-hidden="true">I</span>' +
              '<div class="hs-body"><h3>Roma <em>La receta de la nonna</em></h3>' +
                '<p>Todo empieza en Roma, a la sombra del Coliseo, en una cocina donde la nonna amasaba sin receta escrita. De ella aprendimos lo esencial: guanciale dorado, pecorino romano recién rallado y mucha paciencia.</p></div>' +
              '<figure class="hs-thumb hs-thumb--art">' + colosseoSVG() + '<figcaption>Il Colosseo</figcaption></figure>' +
            '</li>' +
            '<li class="hs-ch" data-st>' +
              '<span class="hs-num" aria-hidden="true">II</span>' +
              '<div class="hs-body"><h3>El viaje <em>' + km + ' km de mar y cielo</em></h3>' +
                '<p>Cruzamos el Mediterráneo y el Atlántico con lo más valioso que teníamos: nuestras recetas y nuestros ingredientes. ' + km + ' kilómetros entre el Coliseo y el Monumento a la Patria, con el sabor de casa en la maleta.</p></div>' +
              '<figure class="hs-thumb"><div class="hs-thumbin"><img data-src="assets/sea.webp" alt=""></div><figcaption>Mar Tirreno</figcaption></figure>' +
            '</li>' +
            '<li class="hs-ch" data-st>' +
              '<span class="hs-num" aria-hidden="true">III</span>' +
              '<div class="hs-body"><h3>Mérida <em>La ciudad blanca</em></h3>' +
                '<p>Mérida nos recibió con su luz, su calor y su gente. Aquí, en el corazón de Yucatán, hacemos pasta fresca a mano cada día, como en Roma, para quien se siente a nuestra mesa.</p></div>' +
              '<figure class="hs-thumb"><div class="hs-thumbin"><img data-src="assets/monumento.webp" alt=""></div><figcaption>Paseo de Montejo</figcaption></figure>' +
            '</li>' +
          '</ol>' +
          '<footer class="hs-cta" data-st>' +
            '<button type="button" class="mr-btn mr-btn--primary" data-go="menu" data-cursor="Abrir">' + I.book + '<span>Ver la carta</span></button>' +
            '<button type="button" class="mr-btn mr-btn--ghost" data-go="reserva" data-cursor="Reservar">' + I.wa + '<span>Reservar</span></button>' +
            '<span class="hs-sign">Buon appetito.</span>' +
          '</footer>' +
        '</article>' +
      '</div></section>';

    var W = m.wrap;
    var img = W.querySelector('.hs-photoin img');
    var photoIn = W.querySelector('.hs-photoin');
    var line = W.querySelector('.hs-line span');
    var thumbs = W.querySelectorAll('.hs-thumbin img');
    var nums = W.querySelectorAll('.hs-num');
    var st = { kb: 0, px: 0, py: 0 };
    m.hooks.prepare = function () {
      st.kb = 0;
      var tx = W.querySelector('.hs-text');
      if (tx) tx.scrollTop = 0;
      var sc = W.querySelector('.mr-scroll');
      if (sc) sc.scrollTop = 0;
    };
    m.hooks.tick = function (mm, dt) {
      st.kb += dt;
      var t = mm.phase === 'closing' ? OPEN_SETTLE + 1 : Math.max(0, mm.t);
      st.px = damp(st.px, -mx, 3.2, dt);
      st.py = damp(st.py, -my, 3.2, dt);
      // Ken Burns lento + paralaje con el cursor
      var zoom = 1.16 - 0.07 * E.outCubic(clamp01(st.kb / 7)) + 0.012 * Math.sin(st.kb * 0.32);
      var dx = st.px * 22 + Math.sin(st.kb * 0.21) * 7;
      var dy = st.py * 14 + Math.cos(st.kb * 0.17) * 5;
      photoIn.style.transform = 'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0) scale(' + zoom.toFixed(4) + ')';
      for (var i = 0; i < thumbs.length; i++) {
        thumbs[i].style.transform = 'translate3d(' + (st.px * 7).toFixed(2) + 'px,' + (st.py * 5).toFixed(2) + 'px,0) scale(1.18)';
      }
      // línea del tiempo que se dibuja y medallones que aparecen
      var lp = E.inOutCubic(clamp01((t - 0.35) / 1.3));
      line.style.transform = 'scaleY(' + lp.toFixed(4) + ')';
      for (var j = 0; j < nums.length; j++) {
        var np = clamp01((t - 0.32 - j * 0.32) / 0.5);
        var ne = spring(np * 0.9, 0.5, 9);
        nums[j].style.transform = np >= 1 ? '' : 'scale(' + (0.6 + 0.4 * ne).toFixed(4) + ')';
      }
      if (img && !img.getAttribute('src') && img.getAttribute('data-src')) preload();
    };
  };

  /* ═════════════════════════ 4 · CARTA (libro) ═════════════════════════ */
  BUILD.menu = function (m) {
    m.wrap.innerHTML =
      '<section class="mr-panel mn" tabindex="-1">' +
        '<h2 class="mr-sr" id="mr-t-menu">La carta</h2>' +
        '<div class="mn-host" data-dismiss></div>' +
        closeBtn('mr-close--dark') +
      '</section>';
    var host = m.wrap.querySelector('.mn-host');
    var mounted = false, fallback = false;
    function mount() {
      if (mounted) return;
      if (AR.book && typeof AR.book.mount === 'function') {
        try { AR.book.mount(host); mounted = true; } catch (err) { if (window.console) console.error(err); }
      } else if (!fallback) {
        fallback = true;
        host.innerHTML = '<div class="mn-fallback"><p class="mr-kicker">La carta</p><p class="mr-lede">Muy pronto podrás hojear aquí nuestra carta.</p></div>';
      }
      if (mounted && fallback) {
        var fb = host.querySelector('.mn-fallback');
        if (fb) fb.remove();
      }
    }
    m.hooks.prepare = function () {
      if (!mounted && fallback && AR.book) { host.innerHTML = ''; fallback = false; }
      mount();
      m.items = Array.prototype.slice.call(m.wrap.querySelectorAll('.mn-fallback'));
    };
    m.hooks.onOpen = function () {
      if (mounted && AR.book && typeof AR.book.onOpen === 'function') AR.book.onOpen();
    };
    m.hooks.onClose = function () {
      if (mounted && AR.book && typeof AR.book.onClose === 'function') AR.book.onClose();
    };
  };
})();
