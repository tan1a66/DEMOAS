// Capacidades del dispositivo y parámetros de prueba en la URL.
//   ?rm          simula prefers-reduced-motion
//   ?nogl        simula un navegador sin WebGL (muestra imágenes estáticas)
//   ?calidad=baja|alta   fuerza el nivel 3D (por defecto: automático)
//   ?rapido      salta la espera del loader
//   ?limpio      oculta textos e interfaz (para capturas del 3D)
const params = new URLSearchParams(window.location.search);

function hayWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function calidadAuto(): 'alta' | 'baja' {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const tactil = window.matchMedia('(pointer: coarse)').matches;
  const angosto = Math.min(window.innerWidth, window.innerHeight) < 700;
  const pocosNucleos = (nav.hardwareConcurrency ?? 8) <= 4;
  const pocaMemoria = (nav.deviceMemory ?? 8) <= 4;
  return tactil || angosto || pocosNucleos || pocaMemoria ? 'baja' : 'alta';
}

const calidadParam = params.get('calidad');

export const env = {
  movimientoReducido: params.has('rm') || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  webgl: !params.has('nogl') && hayWebGL(),
  calidad: (calidadParam === 'alta' || calidadParam === 'baja' ? calidadParam : calidadAuto()) as 'alta' | 'baja',
  tactil: window.matchMedia('(pointer: coarse)').matches,
  rapido: params.has('rapido'),
  limpio: params.has('limpio'),
};

document.documentElement.classList.toggle('rm', env.movimientoReducido);
document.documentElement.classList.toggle('sin-gl', !env.webgl);
document.documentElement.classList.toggle('limpio', env.limpio);
