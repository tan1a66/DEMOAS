import gsap from 'gsap';

// Comparador antes/después. Las imágenes son ilustraciones provisionales (SVG)
// hasta tener fotos reales de clientas con su consentimiento.

const torso = (defined) => {
  const p = defined
    ? 'M135,-20 C132,60 150,130 170,190 C184,240 177,286 160,330 C140,386 128,432 126,580 L374,580 C372,432 360,386 340,330 C323,286 316,240 330,190 C350,130 368,60 365,-20 Z'
    : 'M126,-20 C121,60 133,130 143,192 C150,242 141,288 127,332 C111,388 104,434 102,580 L398,580 C396,434 389,388 373,332 C359,288 350,242 357,192 C367,130 379,60 374,-20 Z';
  const belly = defined
    ? ''
    : '<g filter="url(#b)"><ellipse cx="250" cy="396" rx="96" ry="40" fill="#B9806C" opacity=".2"/><ellipse cx="250" cy="250" rx="90" ry="26" fill="#B9806C" opacity=".1"/></g>';
  const glow = defined ? '<path d="M206,120 C214,200 214,300 204,430" stroke="#fff" stroke-opacity=".22" stroke-width="18" fill="none" stroke-linecap="round" filter="url(#b)"/>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 560" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${defined ? '#F4E6E0' : '#EEDDD6'}"/><stop offset="1" stop-color="${defined ? '#E9CFC8' : '#E2C7BF'}"/></linearGradient>
<linearGradient id="skin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#CF9C86"/><stop offset=".3" stop-color="#E8BFAC"/><stop offset=".55" stop-color="#F1CFBF"/><stop offset=".8" stop-color="#E4B7A3"/><stop offset="1" stop-color="#C9947E"/></linearGradient>
<radialGradient id="l" cx=".42" cy=".3" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<filter id="b"><feGaussianBlur stdDeviation="10"/></filter>
</defs>
<rect width="500" height="560" fill="url(#bg)"/>
<circle cx="400" cy="90" r="190" fill="#FAF1EC" opacity=".55" filter="url(#b)"/>
<path d="${p}" fill="url(#skin)"/>${belly}<path d="${p}" fill="url(#l)"/>${glow}
<ellipse cx="250" cy="318" rx="3.6" ry="6" fill="#A97564" opacity=".55"/>
<path d="M40,478 C160,452 340,452 460,478 L470,560 L30,560 Z" fill="#F5EDE6"/>
<path d="M90,490 C190,474 310,474 410,490" stroke="#E2CFC4" stroke-width="2" fill="none"/>
<path d="M120,512 C210,500 300,500 380,512" stroke="#E7D7CD" stroke-width="2" fill="none"/>
</svg>`;
};

const uri = (svg) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;

export const initCompare = ({ reduced }) => {
  const el = document.getElementById('compare');
  el.querySelector('.compare__layer--before').style.backgroundImage = uri(torso(false));
  el.querySelector('.compare__layer--after').style.backgroundImage = uri(torso(true));

  const state = { pos: 50 };
  const apply = () => {
    el.style.setProperty('--pos', `${state.pos}%`);
    el.setAttribute('aria-valuenow', String(Math.round(state.pos)));
  };
  apply();

  let dragging = false;
  const fromEvent = (e) => {
    const r = el.getBoundingClientRect();
    state.pos = Math.min(98, Math.max(2, ((e.clientX - r.left) / r.width) * 100));
    apply();
  };
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    gsap.killTweensOf(state);
    el.setPointerCapture(e.pointerId);
    fromEvent(e);
  });
  el.addEventListener('pointermove', (e) => dragging && fromEvent(e));
  const end = () => (dragging = false);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      state.pos = Math.min(98, Math.max(2, state.pos + (e.key === 'ArrowLeft' ? -5 : 5)));
      apply();
    }
  });

  // Pista de uso al entrar en pantalla
  return () => {
    if (reduced) return;
    gsap
      .timeline({ defaults: { ease: 'power3.inOut' } })
      .to(state, { pos: 26, duration: 1.1, onUpdate: apply })
      .to(state, { pos: 64, duration: 1.2, onUpdate: apply })
      .to(state, { pos: 50, duration: 0.9, onUpdate: apply });
  };
};
