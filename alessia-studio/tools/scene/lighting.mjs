import { SUN_EXT } from '../../src/layout.js';

// Modello di illuminazione del bake (grandezze scalari, nelle stesse unità del runtime:
// irradianza 1 = sole esterno perpendicolare).

const [Lx, Ly, Lz] = SUN_EXT.dir;

// Cielo di fine pomeriggio: più chiaro verso l'orizzonte, alone attorno al sole basso.
export function skyRadiance(dx, dy, dz) {
  const h = Math.max(dy, 0);
  const s = Math.max(dx * Lx + dy * Ly + dz * Lz, 0);
  return 0.2 + 0.13 * (1 - h) ** 3 + 0.3 * s ** 6 + 0.5 * s ** 48;
}

// Raggi che finiscono sul mare (non è geometria): riflesso del cielo, piuttosto scuro
export const SEA_RADIANCE = 0.075;

// Albedo per i rimbalzi. Il cuscino rimbalza come una superficie neutra:
// nessuna dominante verde arriva sul cemento.
export const ALBEDO = { concrete: 0.5, cushion: 0.42 };
