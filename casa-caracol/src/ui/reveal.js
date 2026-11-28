// Aparición palabra a palabra controlada por un valor 0–1 (tiempo o scroll).
// Cada palabra: opacidad + subida + desenfoque que se aclara, con un leve escalonado.

const easeOutCubic = (x) => 1 - (1 - x) ** 3;

export class WordReveal {
  constructor(el, { stagger = 0.32, blur = 7, rise = 0.38 } = {}) {
    this.el = el;
    this.stagger = stagger;
    this.blur = blur;
    this.rise = rise;
    this.value = -1;
    this.split();
  }

  // Se vuelve a llamar al cambiar de idioma.
  split() {
    const text = this.el.textContent.trim();
    this.el.setAttribute('aria-label', text);
    this.el.textContent = '';
    this.words = text.split(/\s+/).map((word) => {
      const outer = document.createElement('span');
      outer.className = 'w';
      outer.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.className = 'w__i';
      inner.textContent = word;
      outer.appendChild(inner);
      this.el.appendChild(outer);
      this.el.appendChild(document.createTextNode(' '));
      return inner;
    });
    const v = this.value;
    this.value = -1;
    this.set(Math.max(v, 0));
  }

  set(p) {
    if (Math.abs(p - this.value) < 0.0005) return;
    this.value = p;
    const n = this.words.length;
    const total = (n - 1) * this.stagger + 1;
    this.el.style.visibility = p <= 0 ? 'hidden' : 'visible';
    this.words.forEach((w, i) => {
      const local = easeOutCubic(Math.min(Math.max(p * total - i * this.stagger, 0), 1));
      w.style.opacity = local.toFixed(3);
      w.style.transform = `translate3d(0, ${((1 - local) * this.rise).toFixed(3)}em, 0)`;
      w.style.filter = local > 0.995 ? 'none' : `blur(${((1 - local) * this.blur).toFixed(2)}px)`;
    });
  }
}
