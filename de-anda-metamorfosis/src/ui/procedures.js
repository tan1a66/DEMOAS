// =============================================================================
//  procedures.js — 04 · Procedimientos, tutto guidato dallo scroll
// =============================================================================
//  Nessun pulsante: scorrendo, il drone si ferma su ogni zona (le tappe
//  { zone: '…' } in drone-path.js), la zona si illumina d'oro e a sinistra
//  la voce corrispondente della lista si accende e compare la sua descrizione.

import { gsap } from '../core/scroll.js';
import { t } from '../i18n.js';
import { setZoneAmount } from '../three/statue.js';
import { PATH } from '../drone-path.js';

export function createProcedures({ statue, reducedMotion }) {
  const list = document.querySelector('.proc-list');
  const desc = document.querySelector('.proc-desc');
  const descText = desc.querySelector('.proc-text');
  const descLink = desc.querySelector('.proc-link');

  // le soste del drone sulle zone, in ordine di scroll
  const stops = PATH.filter((s) => s.zone && s.at.startsWith('procedimientos:')).map((s) => ({
    id: s.zone,
    p: Number(s.at.split(':')[1]),
    half: (s.hold || 0) / 2 + 0.075, // la zona resta accesa un po' prima e dopo la sosta
  }));
  const amounts = statue.zones.map(() => 0);
  let active = null;

  function renderTexts() {
    if (active) {
      descText.textContent = t(`proc.${active}.text`);
      descLink.textContent = t('proc.link');
    } else {
      descText.textContent = t('proc.hint');
      descLink.textContent = '';
    }
    desc.classList.toggle('has-zone', !!active);
  }

  function setActiveUI() {
    list.querySelectorAll('[data-zone]').forEach((li) => li.classList.toggle('is-active', li.dataset.zone === active));
    // la descrizione cambia in dissolvenza
    gsap.killTweensOf(desc);
    gsap.timeline()
      .to(desc, { autoAlpha: 0, y: reducedMotion ? 0 : 6, duration: 0.25, ease: 'power1.in' })
      .add(renderTexts)
      .to(desc, { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power2.out' });
  }

  function zoneAt(progress) {
    let best = null, dist = Infinity;
    for (const s of stops) {
      const d = Math.abs(progress - s.p);
      if (d <= s.half && d < dist) {
        best = s.id;
        dist = d;
      }
    }
    return best;
  }

  renderTexts();
  return {
    renderTexts,
    /** a ogni frame: capitolo corrente e avanzamento al suo interno */
    update(chapterId, progress, dt) {
      const id = chapterId === 'procedimientos' ? zoneAt(progress) : null;
      if (id !== active) {
        active = id;
        setActiveUI();
      }
      // il bagliore sfuma verso la zona attiva
      const k = 1 - Math.exp(-4 * Math.min(dt, 0.1));
      statue.zones.forEach((z, i) => {
        amounts[i] += ((z.id === active ? 1 : 0) - amounts[i]) * k;
        setZoneAmount(i, amounts[i]);
      });
    },
  };
}
