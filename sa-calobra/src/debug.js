// Contatore FPS per la modalità ?debug (fps medi, draw call, triangoli, risoluzione).
export function createDebug(renderer) {
  const el = document.createElement('div');
  el.className = 'debug';
  document.body.appendChild(el);
  let acc = 0, frames = 0, low = 0;
  const state = {
    lowFor: 0,
    reset() { low = 0; state.lowFor = 0; },
    frame(dt) {
      acc += dt; frames++;
      if (acc >= 0.5) {
        const fps = frames / acc;
        low = fps < 50 ? low + acc : 0;
        state.lowFor = low;
        const i = renderer.info.render;
        const pr = renderer.getPixelRatio();
        el.textContent = `${fps.toFixed(0)} fps · ${i.calls} draw · ${(i.triangles / 1000).toFixed(0)}k tri · dpr ${pr.toFixed(2)}`;
        acc = 0; frames = 0;
      }
      return state;
    },
  };
  return state;
}
