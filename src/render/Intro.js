import gsap from 'gsap';
import data from '../data/villa.json';
import { asset } from '../asset.js';
import { t, ui } from '../i18n.js';

/*
  Apertura da film: nero → "ALESSIA STUDIO presenta" → titolo, slogan, luogo e ENTRAR sopra il primo
  fotogramma del volo. Al tocco (che permette anche di far partire il suono) parte il volo dal mare
  verso la villa; dopo pochi secondi si dissolve nel giro esterno. "Saltar" lo interrompe.
*/

export class Intro {
  constructor(root, { time, onStart, onDone }) {
    this.onStart = onStart;
    this.onDone = onDone;
    this.time = time;
    this.el = document.createElement('div');
    this.el.className = 'intro';
    this.el.innerHTML = `
      <video class="intro__video" muted playsinline preload="auto"></video>
      <div class="intro__veil"></div>
      <p class="intro__by"><span>Alessia Studio</span> <em></em></p>
      <div class="intro__title">
        <h1>${data.villa.name}</h1>
        <p class="intro__tag"></p>
        <p class="intro__loc"></p>
        <button type="button" class="intro__go"><span></span></button>
      </div>
      <button type="button" class="intro__skip"></button>`;
    root.appendChild(this.el);
    this.video = this.el.querySelector('video');
    this.video.setAttribute('playsinline', '');
    const mp4 = this.video.canPlayType('video/mp4; codecs="avc1.4D401F"');
    this.video.poster = asset(`/renders/flight/poster_${time}.jpg`);
    this.video.src = asset(`/renders/flight/flight_${time}.${mp4 ? 'mp4' : 'webm'}`);
    this.el.querySelector('.intro__go').addEventListener('click', () => this.go());
    this.el.querySelector('.intro__skip').addEventListener('click', () => this.finish());
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.refreshLang();
    this.play();
  }

  refreshLang() {
    this.el.querySelector('.intro__by em').textContent = ui('presents');
    this.el.querySelector('.intro__tag').textContent = t(data.villa.tagline);
    this.el.querySelector('.intro__loc').textContent = t(data.villa.location);
    this.el.querySelector('.intro__go span').textContent = ui('enter');
    this.el.querySelector('.intro__skip').textContent = ui('skip');
  }

  play() {
    const q = (s) => this.el.querySelector(s);
    gsap.set([q('.intro__video'), q('.intro__veil'), q('.intro__by'), q('.intro__title'), q('.intro__skip')], { autoAlpha: 0 });
    gsap.set(q('.intro__title').children, { autoAlpha: 0, y: 14 });
    gsap.timeline()
      .to(q('.intro__by'), { autoAlpha: 1, duration: 1.1, ease: 'power2.out' }, 0.4)
      .to(q('.intro__by'), { autoAlpha: 0, duration: 0.8, ease: 'power2.in' }, 2.3)
      .to([q('.intro__video'), q('.intro__veil')], { autoAlpha: 1, duration: 1.6, ease: 'power1.inOut' }, 2.6)
      .set(q('.intro__title'), { autoAlpha: 1 }, 2.9)
      .to(q('.intro__title').children, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.18, ease: 'power3.out' }, 2.9);
  }

  /** ENTRAR: suono, volo dal mare, poi il giro esterno. */
  async go() {
    if (this.started) return;
    this.started = true;
    this.onStart?.();
    const q = (s) => this.el.querySelector(s);
    gsap.to(q('.intro__title'), { autoAlpha: 0, y: -10, duration: 0.6, ease: 'power2.in' });
    gsap.to(q('.intro__veil'), { autoAlpha: 0.15, duration: 1.2 });
    gsap.to(q('.intro__skip'), { autoAlpha: 1, duration: 0.6, delay: 0.8 });
    try {
      this.video.currentTime = 0;
      await this.video.play();
    } catch {
      this.finish();
      return;
    }
    // il volo arriva davanti alla facciata: a ~2,7 s si passa al giro esterno (stesso lato, dal mare)
    const check = () => {
      if (this.done) return;
      if (this.video.currentTime >= 2.7 || this.video.ended) this.finish();
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  finish() {
    if (this.done) return;
    this.done = true;
    if (!this.started) this.onStart?.();
    this.onDone?.();
    gsap.to(this.el, {
      autoAlpha: 0, duration: 1.1, ease: 'power1.inOut', delay: 0.15,
      onComplete: () => { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); this.el.remove(); },
    });
  }
}
