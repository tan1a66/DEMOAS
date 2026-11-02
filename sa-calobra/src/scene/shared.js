// Uniform condivisi da tutti i materiali della scena (stesso oggetto = un solo aggiornamento).
import { Color, Vector3 } from 'three';
import { CONFIG } from '../config.js';

export function sunDirection(cfg = CONFIG.sun) {
  const az = (cfg.azimuth * Math.PI) / 180, el = (cfg.elevation * Math.PI) / 180;
  // x = est, z = sud: azimut da nord in senso orario
  return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

export function createShared() {
  const c = CONFIG;
  const sunColor = new Color(c.sun.color).multiplyScalar(c.sun.intensity);
  return {
    uTime: { value: 0 },
    uSunDir: { value: sunDirection() },
    uSunColor: { value: sunColor },
    uAmbSky: { value: new Color(c.ambient.sky).multiplyScalar(c.ambient.intensity) },
    uAmbGround: { value: new Color(c.ambient.ground).multiplyScalar(c.ambient.intensity * 0.6) },
    uSkyCube: { value: null },
    uSkyExposure: { value: c.sky.exposure },
    uFogDensity: { value: c.fog.density },
    uFogFalloff: { value: c.fog.heightFalloff },
    uFogSun: { value: new Color(c.fog.sunGlow) },
    uFogSunPow: { value: c.fog.sunGlowPower },
    uFogMax: { value: c.fog.maxOpacity },
  };
}
