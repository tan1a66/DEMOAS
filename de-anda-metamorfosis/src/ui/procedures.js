// =============================================================================
//  procedures.js — 04 · Procedimientos: lista, punti sulla statua, voli del drone
// =============================================================================

import * as THREE from 'three';
import { gsap } from '../core/scroll.js';
import { t } from '../i18n.js';
import { setZoneAmount } from '../three/statue.js';
import { ZONE_FLIGHT } from '../config.js';

export function createProcedures({ statue, drone, reducedMotion, veil }) {
  const list = document.querySelector('.proc-list');
  const desc = document.querySelector('.proc-desc');
  const descText = desc.querySelector('.proc-text');
  const descLink = desc.querySelector('.proc-link');
  const hotspotsEl = document.getElementById('hotspots');

  const amounts = statue.zones.map(() => ({ v: 0 }));
  let active = null; // id della zona scelta
  let hovered = null;
  let enabled = false;

  // ---- bagliore: ogni zona sfuma verso il suo valore ----
  function glowTo(i, v, duration = 0.8) {
    gsap.to(amounts[i], { v, duration, ease: 'power2.out', overwrite: true, onUpdate: () => setZoneAmount(i, amounts[i].v) });
  }
  function refreshGlow() {
    statue.zones.forEach((z, i) => {
      const v = z.id === active ? 1 : z.id === hovered ? 0.5 : 0;
      glowTo(i, v, z.id === active ? 1.1 : 0.6);
    });
  }

  // ---- punti cliccabili sulla statua ----
  const hotspots = statue.zones.map((z) => {
    const b = document.createElement('button');
    b.className = 'hotspot';
    b.type = 'button';
    b.dataset.zone = z.id;
    b.innerHTML = '<span class="hotspot-ring"></span><span class="hotspot-dot"></span><span class="hotspot-label"></span>';
    hotspotsEl.appendChild(b);
    b.addEventListener('click', () => select(z.id));
    b.addEventListener('pointerenter', () => hover(z.id));
    b.addEventListener('pointerleave', () => hover(null));
    return b;
  });

  function renderTexts() {
    hotspots.forEach((b, i) => {
      const label = t(`proc.${statue.zones[i].id}`);
      b.querySelector('.hotspot-label').textContent = label;
      b.setAttribute('aria-label', label);
    });
    if (active) {
      descText.textContent = t(`proc.${active}.text`);
      descLink.textContent = t('proc.link');
    } else {
      descText.textContent = t('proc.hint');
      descLink.textContent = '';
    }
    desc.classList.toggle('has-zone', !!active);
  }

  // ---- lista ----
  list.querySelectorAll('button[data-zone]').forEach((btn) => {
    btn.addEventListener('click', () => select(btn.dataset.zone));
    btn.addEventListener('pointerenter', () => hover(btn.dataset.zone));
    btn.addEventListener('pointerleave', () => hover(null));
    btn.addEventListener('focus', () => hover(btn.dataset.zone));
    btn.addEventListener('blur', () => hover(null));
  });

  function hover(id) {
    hovered = id;
    refreshGlow();
    hotspots.forEach((b) => b.classList.toggle('is-hover', b.dataset.zone === id));
  }

  function setActiveUI() {
    list.querySelectorAll('button[data-zone]').forEach((b) => {
      const on = b.dataset.zone === active;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    hotspots.forEach((b) => b.classList.toggle('is-active', b.dataset.zone === active));
    // il testo cambia in dissolvenza
    gsap.timeline()
      .to(desc, { autoAlpha: 0, y: reducedMotion ? 0 : 6, duration: 0.25, ease: 'power1.in' })
      .add(renderTexts)
      .to(desc, { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power2.out' });
  }

  // ---- scelta di una zona: il drone vola là ----
  function select(id) {
    if (!enabled || id === active) return;
    active = id;
    const zone = statue.zones.find((z) => z.id === id);
    const shot = drone.zoneShot(zone, statue.toWorld(zone.center));
    setActiveUI();
    refreshGlow();
    const z = drone.zone;
    if (reducedMotion) {
      // niente voli: dissolvenza e nuova inquadratura
      veil(() => {
        drone.flyTo(shot);
        z.t = 1;
        z.blend = 1;
      });
      return;
    }
    drone.flyTo(shot);
    gsap.killTweensOf(z);
    gsap.to(z, { t: 1, duration: ZONE_FLIGHT.duration, ease: 'none' });
    gsap.to(z, { blend: 1, duration: ZONE_FLIGHT.duration * 0.6, ease: 'power2.out' });
  }

  /** Uscendo dal capitolo: la camera torna sul percorso, nessuna zona accesa */
  function release() {
    if (!active && drone.zone.blend === 0) return;
    active = null;
    hovered = null;
    setActiveUI();
    refreshGlow();
    gsap.killTweensOf(drone.zone);
    if (reducedMotion) {
      drone.zone.blend = 0;
      return;
    }
    gsap.to(drone.zone, { blend: 0, duration: 1.5, ease: 'power2.inOut' });
  }

  renderTexts();
  const v = new THREE.Vector3();
  return {
    renderTexts,
    setEnabled(on) {
      if (on === enabled) return;
      enabled = on;
      hotspotsEl.classList.toggle('is-visible', on);
      if (!on) release();
    },
    /** posizione dei punti sullo schermo, a ogni frame */
    update(camera, width, height) {
      if (!enabled) return;
      statue.zones.forEach((z, i) => {
        statue.toWorld(z.anchor, v).project(camera);
        const b = hotspots[i];
        const behind = v.z > 1;
        b.style.transform = `translate3d(${((v.x + 1) / 2) * width}px, ${((1 - v.y) / 2) * height}px, 0)`;
        b.classList.toggle('is-hidden', behind);
      });
    },
  };
}
