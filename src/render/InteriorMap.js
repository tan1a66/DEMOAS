import gsap from 'gsap';
import data from '../data/villa.json';
import { asset } from '../asset.js';
import { t, ui } from '../i18n.js';
import { LEVELS, svgLevel } from './Plan.js';

/*
  Mappa degli interni, come l'aveva pensata Alessia:
  giro esterno → "Ver interiores" → la villa tagliata a metà; ogni ambiente toccato si accende con
  un'aura dorata, il secondo tocco (o ENTRAR) fa lo zoom nella stanza con il lampo caldo: BOOM.
  Seconda scheda: la piantina dei due livelli, con la stessa aura. Si apre anche dal pulsante in basso
  a sinistra (piantina) e dalla voce "Sección" dell'elenco laterale.
*/

const R = data.renders;

export class InteriorMap {
  constructor(root, panos, { onEnter }) {
    this.panos = panos;
    this.onEnter = onEnter;
    this.tab = 'section';
    this.time = R.defaultTime;
    this.selected = null;
    this.el = document.createElement('div');
    this.el.className = 'imap';
    this.el.setAttribute('aria-hidden', 'true');
    root.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });

    // pulsante in basso a sinistra: piantina in miniatura
    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.className = 'plan-btn';
    this.btn.innerHTML = `<span class="plan-btn__mini">${svgLevel(LEVELS[0], panos, true)}</span><span class="plan-btn__label"></span>`;
    this.btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.btn.addEventListener('click', (e) => { e.stopPropagation(); this.open('plan', this.time); });
    root.appendChild(this.btn);
    this.render();
  }

  static sectionSrc(time) { return asset(`/renders/section/section_${time === 'morning' ? 'sunset' : time}.jpg`); }

  render() {
    const spots = R.section.rooms.map((r) => {
      const [l, tp, rt, b] = r.rect;
      const p = this.panos.get(r.to);
      return `<button type="button" class="imap__spot" data-to="${r.to}" style="left:${l}%;top:${tp}%;width:${rt - l}%;height:${b - tp}%">
        <span class="imap__spot-label">${t(p.short || p.name)}</span></button>`;
    }).join('');
    this.el.innerHTML = `
      <div class="imap__head">
        <nav class="imap__tabs">
          <button type="button" data-tab="section">${ui('sectionTab')}</button>
          <button type="button" data-tab="plan">${ui('plan')}</button>
        </nav>
        <button type="button" class="panel__close imap__close" aria-label="${ui('close')}"><span></span></button>
      </div>
      <div class="imap__body">
        <div class="imap__view imap__view--section">
          <div class="imap__scroll"><div class="imap__frame">
            <img alt="${ui('sectionTitle')}" decoding="async" draggable="false" />${spots}
          </div></div>
        </div>
        <div class="imap__view imap__view--plan">
          ${LEVELS.map((lv) => `<figure class="plan__level"><figcaption>${t(data.levels.find((l) => l.id === lv.id)?.name)}</figcaption>${svgLevel(lv, this.panos)}</figure>`).join('')}
        </div>
      </div>
      <div class="imap__bar">
        <button type="button" class="imap__ext">← ${ui('exterior')}</button>
        <span class="imap__sel">${ui('sectionHint')}</span>
        <button type="button" class="imap__go" disabled>${ui('enter')}</button>
      </div>`;
    this.img = this.el.querySelector('.imap__frame img');
    this.el.querySelector('.imap__close').addEventListener('click', () => this.close());
    this.el.querySelector('.imap__ext').addEventListener('click', () => { this.close(); this.onEnter('exterior'); });
    this.el.querySelector('.imap__go').addEventListener('click', () => this.enter());
    this.el.querySelectorAll('.imap__tabs button').forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
    this.el.querySelectorAll('.imap__spot, .plan__room.is-link').forEach((n) => {
      n.addEventListener('click', () => {
        if (this.selected === n.dataset.to) this.enter();
        else this.select(n.dataset.to);
      });
    });
    this.btn.querySelector('.plan-btn__label').textContent = ui('plan');
    this.btn.setAttribute('aria-label', ui('plan'));
    this.setTab(this.tab);
    this.select(this.selected);
    this.setCurrent(this.current);
  }

  setTab(tab) {
    this.tab = tab;
    this.el.querySelectorAll('.imap__tabs button').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
    this.el.classList.toggle('is-plan', tab === 'plan');
    if (tab === 'section') this.#center();
  }

  #center() {
    const sc = this.el.querySelector('.imap__scroll');
    const go = () => { sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) * 0.42; };
    if (this.img.complete) requestAnimationFrame(go); else this.img.onload = go;
  }

  select(id) {
    this.selected = id && this.panos.has(id) ? id : null;
    this.el.querySelectorAll('[data-to]').forEach((n) => n.classList.toggle('is-selected', !!this.selected && n.dataset.to === this.selected));
    const p = this.selected && this.panos.get(this.selected);
    this.el.querySelector('.imap__sel').textContent = p ? t(p.name) : ui('sectionHint');
    this.el.querySelector('.imap__go').disabled = !p;
  }

  setCurrent(id) {
    this.current = id;
    this.el.querySelectorAll('[data-to]').forEach((n) => n.classList.toggle('is-current', n.dataset.to === id));
  }

  setTime(time) {
    this.time = time;
    if (this.isOpen) this.img.src = InteriorMap.sectionSrc(time);
  }

  open(tab = 'section', time = this.time) {
    this.time = time;
    this.img.src = InteriorMap.sectionSrc(time);
    this.isOpen = true;
    this.select(null);
    this.setTab(tab);
    gsap.set(this.el.querySelector('.imap__body'), { scale: 1, transformOrigin: '50% 50%' });
    this.el.setAttribute('aria-hidden', 'false');
    gsap.fromTo(this.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' });
    gsap.fromTo(this.el.querySelector('.imap__body'), { scale: 1.05 }, { scale: 1, duration: 1.2, ease: 'power3.out' });
  }

  /** BOOM: zoom verso l'ambiente selezionato, poi la regia apre il panorama. */
  async enter() {
    const id = this.selected;
    if (!id) return;
    const body = this.el.querySelector('.imap__body');
    const node = [...this.el.querySelectorAll(`[data-to="${id}"]`)].find((n) => n.getBoundingClientRect().width > 0);
    if (node) {
      const r = node.getBoundingClientRect();
      const b = body.getBoundingClientRect();
      body.style.transformOrigin = `${r.left + r.width / 2 - b.left}px ${r.top + r.height / 2 - b.top}px`;
    }
    await gsap.to(body, { scale: 2.6, duration: 0.9, ease: 'power2.in' }).then();
    this.onEnter(id, { boom: true });
    gsap.to(this.el, { autoAlpha: 0, duration: 0.6, delay: 0.25, onComplete: () => this.el.setAttribute('aria-hidden', 'true') });
    this.isOpen = false;
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    gsap.to(this.el, { autoAlpha: 0, duration: 0.4, onComplete: () => this.el.setAttribute('aria-hidden', 'true') });
    this.onClose?.();
  }

  refreshLang() { this.render(); }
}
