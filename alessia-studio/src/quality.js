// Livelli di qualità. Si parte da una stima del dispositivo e poi si adatta in base ai
// tempi di frame misurati (pixel ratio prima, poi dettagli del mare).

// Stima con un contesto WebGL di prova (prima di creare il renderer, per scegliere l'antialias)
export function detectTier() {
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch (e) {
    gpu = '';
  }
  const ua = navigator.userAgent;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const weakGpu = /Mali-[GT]?[4-7]\d|Adreno \(TM\) [3-5]\d\d|Adreno \(TM\) 6[0-1]\d|PowerVR|SwiftShader|llvmpipe|Intel\(R\) HD Graphics [2-5]/i.test(gpu);
  const oldIOS = /iPhone OS (1[0-4])_/.test(ua);
  const forced = new URLSearchParams(location.search).get('q');
  let tier = 'high';
  if (weakGpu || oldIOS || (coarse && (cores <= 4 && mem <= 3))) tier = 'low';
  if (forced === 'low' || forced === 'high') tier = forced;
  return {
    tier,
    gpu,
    mobile: coarse,
    maxDpr: Math.min(window.devicePixelRatio || 1, tier === 'low' ? 1.5 : 2),
    textureSize: tier === 'low' || coarse ? 512 : 1024,
    lightmapSize: tier === 'low' || coarse ? 1024 : 2048,
    realtimeShadows: tier === 'high' && !coarse,
    shadowInt: 1024,
    seaQuality: tier === 'low' ? 'low' : 'high',
    // post-processing (MSAA nel render target, bloom, grana) e riflessi del mare
    post: tier !== 'low',
    msaa: 4,
    reflection: tier !== 'low',
    reflectionScale: coarse ? 0.35 : 0.5,
  };
}

export function createAdaptiveResolution(renderer, quality, onChange) {
  let dpr = quality.maxDpr;
  const minDpr = Math.min(1, quality.maxDpr);
  let acc = 0, frames = 0, cooldown = 2.5, raisedOnce = false;
  renderer.setPixelRatio(dpr);
  return {
    get dpr() { return dpr; },
    sample(dt) {
      if (cooldown > 0) { cooldown -= dt; return; }
      acc += dt;
      frames++;
      if (acc < 2) return;
      const ms = (acc / frames) * 1000;
      acc = 0;
      frames = 0;
      if (ms > 21 && dpr > minDpr) {
        dpr = Math.max(minDpr, +(dpr - 0.25).toFixed(2));
        renderer.setPixelRatio(dpr);
        onChange?.(dpr);
        cooldown = 1.5;
      } else if (ms < 12.5 && dpr < quality.maxDpr && !raisedOnce) {
        dpr = Math.min(quality.maxDpr, +(dpr + 0.25).toFixed(2));
        raisedOnce = true;
        renderer.setPixelRatio(dpr);
        onChange?.(dpr);
        cooldown = 3;
      }
    },
  };
}
