// Cursor: punto preciso + mancha rosa con inercia que crece sobre enlaces y botones.
export const initCursor = (onMove) => {
  const root = document.querySelector('.cursor');
  const blob = root.querySelector('.cursor__blob');
  const dot = root.querySelector('.cursor__dot');
  document.body.classList.add('has-cursor');
  const p = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const b = { x: p.x, y: p.y };
  let seen = false;

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (!seen) {
        b.x = p.x;
        b.y = p.y;
        seen = true;
      }
      root.classList.remove('is-hidden');
      root.classList.add('is-on');
      dot.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      onMove?.(p.x, p.y, true);
    },
    { passive: true }
  );
  document.addEventListener('pointerleave', () => {
    root.classList.add('is-hidden');
    onMove?.(-9999, -9999, false);
  });
  document.addEventListener('pointerover', (e) => {
    const link = e.target.closest('a, button, [role="slider"], .card');
    root.classList.toggle('is-link', !!link);
  });

  return (dt) => {
    const k = 1 - Math.exp(-dt * 11);
    b.x += (p.x - b.x) * k;
    b.y += (p.y - b.y) * k;
    blob.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
  };
};
