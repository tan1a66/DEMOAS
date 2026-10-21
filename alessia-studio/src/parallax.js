// Parallasse leggero: mouse su desktop, giroscopio su mobile.
// Fallback: se il giroscopio non è disponibile (o il permesso è negato) si usa la posizione
// del dito; senza input resta una lievissima oscillazione automatica.

export function createParallax({ enabled = true } = {}) {
  const raw = { x: 0, y: 0 };
  const out = { x: 0, y: 0 };
  let source = 'none';
  let gyroBase = null;
  let strength = 0; // sale dopo il loader per non spostare l'orizzonte iniziale

  if (!enabled) {
    return { value: out, update() {}, enable() {}, get source() { return 'off'; } };
  }

  const coarse = window.matchMedia('(pointer: coarse)').matches;

  window.addEventListener('pointermove', (e) => {
    if (source === 'gyro') return;
    if (e.pointerType === 'mouse' || !coarse) {
      source = 'pointer';
      raw.x = (e.clientX / window.innerWidth) * 2 - 1;
      raw.y = -((e.clientY / window.innerHeight) * 2 - 1);
    }
  }, { passive: true });

  function onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    source = 'gyro';
    const portrait = window.innerHeight >= window.innerWidth;
    const a = portrait ? e.gamma : e.beta; // inclinazione laterale
    const b = portrait ? e.beta : -e.gamma; // inclinazione avanti/indietro
    if (!gyroBase) gyroBase = { a, b };
    // la base segue lentamente la postura: il parallasse resta centrato
    gyroBase.a += (a - gyroBase.a) * 0.004;
    gyroBase.b += (b - gyroBase.b) * 0.004;
    raw.x = Math.max(-1, Math.min(1, (a - gyroBase.a) / 18));
    raw.y = Math.max(-1, Math.min(1, -(b - gyroBase.b) / 18));
  }

  let gyroRequested = false;
  function requestGyro() {
    if (gyroRequested || typeof DeviceOrientationEvent === 'undefined') return;
    gyroRequested = true;
    const D = DeviceOrientationEvent;
    if (typeof D.requestPermission === 'function') {
      // iOS: il permesso va chiesto in risposta a un gesto dell'utente
      D.requestPermission()
        .then((s) => { if (s === 'granted') window.addEventListener('deviceorientation', onOrientation); })
        .catch(() => { gyroRequested = false; });
    } else {
      window.addEventListener('deviceorientation', onOrientation);
    }
  }
  if (coarse) {
    const ask = () => requestGyro();
    window.addEventListener('touchend', ask, { passive: true });
    window.addEventListener('click', ask, { passive: true });
    // Android: nessun permesso richiesto
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') requestGyro();
    window.addEventListener('touchmove', (e) => {
      if (source === 'gyro' || !e.touches[0]) return;
      source = 'touch';
      raw.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
      raw.y = -((e.touches[0].clientY / window.innerHeight) * 2 - 1) * 0.5;
    }, { passive: true });
  }

  function update(dt, time) {
    const k = 1 - Math.exp(-dt * 2.5);
    let tx = raw.x, ty = raw.y;
    if (source === 'none') {
      tx = Math.sin(time * 0.13) * 0.35;
      ty = Math.sin(time * 0.09 + 1.3) * 0.2;
    }
    out.x += (tx * strength - out.x) * k;
    out.y += (ty * strength - out.y) * k;
  }

  function enable(duration = 2) {
    const start = performance.now();
    const step = () => {
      strength = Math.min(1, (performance.now() - start) / (duration * 1000));
      if (strength < 1) requestAnimationFrame(step);
    };
    step();
  }

  return { value: out, update, enable, get source() { return source; } };
}
