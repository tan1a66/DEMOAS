import { t, onLangChange } from '../i18n/index.js';
import { CONFIG } from '../config.js';
import { formatPrice, onCurrencyChange } from './format.js';
import { drawMiniMap } from './minimap.js';
import { whatsappUrl } from './whatsapp.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Página de proyecto: galería, datos, distancias, mini mapa y llamadas a la acción.
export class ProjectPage {
  constructor(root, geo, onClose) {
    this.root = root;
    this.geo = geo;
    this.onClose = onClose;
    this.project = null;
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) this.onClose();
      const thumb = e.target.closest('[data-shot]');
      if (thumb) this.show(+thumb.dataset.shot);
    });
    onLangChange(() => this.project && this.render());
    onCurrencyChange(() => this.project && this.render());
  }

  // shots: imágenes de la galería ({src, caption, illustrative}).
  open(project, { shots, distances }) {
    this.project = project;
    this.shots = shots;
    this.distances = distances;
    this.current = 0;
    this.render();
    this.root.scrollTop = 0;
    this.root.querySelector('.page-scroll').scrollTop = 0;
    this.root.classList.add('open');
    this.root.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() =>
      drawMiniMap(this.root.querySelector('.mini canvas'), this.geo, project, distances.map((d) => d.poi))
    );
  }

  close() {
    this.root.classList.remove('open');
    this.root.setAttribute('aria-hidden', 'true');
  }

  show(i) {
    this.current = i;
    const s = this.shots[i];
    const img = this.root.querySelector('.g-main img');
    img.src = s.src;
    img.alt = `${this.project.nombre} — ${s.caption}`;
    this.root.querySelector('.g-caption').textContent = s.caption;
    this.root.querySelectorAll('[data-shot]').forEach((b) => b.classList.toggle('active', +b.dataset.shot === i));
  }

  render() {
    const p = this.project;
    const price = formatPrice(p.precio_desde_mxn);
    const facts = [
      [t('page.type'), p.tipo.map((x) => t(`tipo.${x}`)).join(' · ')],
      [t('page.price'), price ?? t('card.priceTbc')],
      [t('page.state'), p.estado ? t(`estado.${p.estado}`) : t('card.stateTbc')],
      [t('page.bedrooms'), p.recamaras?.length ? p.recamaras.join(', ') : null],
      [t('page.area'), p.m2?.min ? `${p.m2.min}${p.m2.max ? ' – ' + p.m2.max : '+'} ${p.m2.unidad ?? 'm²'}` : null],
      [t('page.units'), p.unidades ?? null],
      [t('page.payment'), p.esquema_pago ?? null],
      [t('page.location'), `${p.zona}, ${p.municipio}`],
    ].filter(([, v]) => v != null);

    const illustrative = this.shots.some((s) => s.illustrative);
    const links = [
      p.url_sitio && `<a class="btn-ghost" href="${esc(p.url_sitio)}" target="_blank" rel="noopener">${t('page.site')}</a>`,
      p.url_ficha && `<a class="btn-ghost" href="${esc(p.url_ficha)}" target="_blank" rel="noopener">${t('page.urbaz')}</a>`,
    ].filter(Boolean);

    this.root.querySelector('.page-scroll').innerHTML = `
      <div class="page-hero">
        <div class="gallery">
          <figure class="g-main">
            <img decoding="async" alt="" />
            <figcaption><span class="g-caption"></span>${illustrative ? `<em>${t('page.illustrative')}</em>` : ''}</figcaption>
          </figure>
          <div class="g-thumbs">
            ${this.shots
              .map((s, i) => `<button type="button" data-shot="${i}" aria-label="${esc(s.caption)}"><img loading="lazy" src="${s.src}" alt="" /></button>`)
              .join('')}
          </div>
        </div>
        <div class="page-head">
          <p class="kicker">${esc(p.zona)} · ${esc(p.municipio)}</p>
          <h1 class="page-title">${esc(p.nombre)}</h1>
          <span class="pill ${p.estado ? '' : 'tbc'}">${p.estado ? t(`estado.${p.estado}`) : t('card.stateTbc')}</span>
          <p class="page-price">${price ? `<small>${t('card.from')}</small><b>${price}</b>` : `<b class="tbc">${t('card.priceTbc')}</b>`}</p>
          <p class="page-desc">${esc(p.descripcion)}</p>
          <div class="page-ctas">
            <a class="btn-wa" href="${whatsappUrl(p)}" target="_blank" rel="noopener">${WA_ICON}<span>${t('page.wa')}</span></a>
            ${links.join('')}
          </div>
        </div>
      </div>

      <div class="page-grid">
        <section class="facts">
          <h2>${t('page.facts')}</h2>
          <dl>${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        </section>
        <section class="dist">
          <h2>${t('page.distances')}</h2>
          <ul>${this.distances
            .map((d) => `<li><span>${esc(d.poi.nombre)}</span><b>~${d.min} min</b><small>${d.km.toFixed(1)} km</small></li>`)
            .join('')}</ul>
          <p class="fine">${t('page.distNote')}</p>
        </section>
        <section class="mini">
          <h2>${t('page.map')}</h2>
          <canvas aria-label="${t('page.map')}"></canvas>
          <p class="fine">${t('page.mapNote')}</p>
        </section>
      </div>

      <section class="cta-band">
        <p class="cta-kicker">URBAZ</p>
        <h2>${t('page.ctaTitle', { name: esc(p.nombre) })}</h2>
        <a class="btn-wa big" href="${whatsappUrl(p)}" target="_blank" rel="noopener">${WA_ICON}<span>${t('page.wa')}</span></a>
      </section>

      <footer class="page-foot">
        <p>${t('page.sources')}</p>
        <p>${t('page.fx', { rate: CONFIG.exchange.mxnPerUsd })}</p>
      </footer>`;
    this.show(this.current ?? 0);
    if (this.root.classList.contains('open')) {
      drawMiniMap(this.root.querySelector('.mini canvas'), this.geo, p, this.distances.map((d) => d.poi));
    }
  }
}

export const WA_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.2 21.8l5.1-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.2z"/></svg>';
