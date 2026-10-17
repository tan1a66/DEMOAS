import gsap from 'gsap';

// Pequeño gestor de estados: Intro → Inmersión → Llegada → Terraza (hub).
// Las escenas se cargan bajo demanda (import dinámico) y comparten motor.
// Interfaz de una escena: init(progress) · enter(opts) · exit(next) · update(dt, t)
//                         beforeRender(renderer) · resize(view) · scene (THREE.Scene)
const LOADERS = {
  intro: () => import('../scenes/intro/IntroScene.js'),
  inmersion: () => import('../scenes/inmersion/InmersionScene.js'),
  llegada: () => import('../scenes/llegada/LlegadaScene.js'),
  terraza: () => import('../scenes/terraza/TerrazaScene.js'),
};

export class Director {
  constructor(engine, ctx) {
    this.engine = engine;
    this.ctx = ctx;
    this.scenes = new Map();
    this.pending = new Map();
    this.current = null;
    this.name = null;
    engine.onResize((view) => {
      for (const s of this.scenes.values()) s.resize?.(view);
    });
  }

  has(name) {
    return name in LOADERS;
  }

  load(name, progress = () => {}) {
    if (this.scenes.has(name)) return Promise.resolve(this.scenes.get(name));
    if (!this.pending.has(name)) {
      const job = LOADERS[name]()
        .then(async (mod) => {
          const scene = new mod.default(this.engine, this.ctx, this);
          await scene.init?.(progress);
          scene.resize?.(this.engine.view);
          this.scenes.set(name, scene);
          return scene;
        })
        .finally(() => this.pending.delete(name));
      this.pending.set(name, job);
    }
    return this.pending.get(name);
  }

  // Precarga silenciosa de la escena siguiente.
  preload(name) {
    if (this.has(name)) this.load(name).catch(() => {});
  }

  // opts.fade: fundido a negro antes de cambiar (saltos que no tienen transición propia).
  async go(name, opts = {}) {
    const next = await this.load(name);
    const prev = this.current;
    if (opts.fade && prev && prev !== next) {
      await new Promise((r) => gsap.to('#veil', { opacity: 1, duration: 0.5, ease: 'power2.in', onComplete: r }));
    }
    if (prev && prev !== next) await prev.exit?.(name);
    this.current = next;
    this.name = name;
    document.documentElement.dataset.scene = name;
    this.engine.setScene(next);
    await next.enter?.(opts);
  }
}
