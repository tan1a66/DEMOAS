// La camera non deve mai entrare nella montagna né avere la vista coperta:
// alza la posizione finché c'è margine sul terreno sottostante e lungo la linea di vista.
import { Vector3 } from 'three';

const _p = new Vector3();

export function groundMax(hf, x, z, r = 30) {
  let m = hf.height(x, z);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    m = Math.max(m, hf.height(x + Math.cos(a) * r, z + Math.sin(a) * r));
  }
  return m;
}

/** modifica pos.y; restituisce pos */
export function ensureClearance(hf, pos, target, { above = 25, sight = 4, sightUntil = 0.85 } = {}) {
  pos.y = Math.max(pos.y, groundMax(hf, pos.x, pos.z) + above);
  for (let iter = 0; iter < 4; iter++) {
    let raise = 0;
    for (let k = 1; k <= 48; k++) {
      const t = (k / 48) * sightUntil;
      _p.lerpVectors(pos, target, t);
      const need = hf.height(_p.x, _p.z) + sight - _p.y;
      // alzare la camera di d alza questo punto di d·(1−t)
      if (need > 0) raise = Math.max(raise, need / (1 - t));
    }
    if (raise <= 0.01) break;
    pos.y += raise;
  }
  return pos;
}

/** punto di vista sopra la strada all'indice i, guardando avanti lungo il percorso */
export function roadView(road, hf, i, { back = 80, up = 60, ahead = 300, side = 0 } = {}) {
  const s = i * road.step;
  const pos = road.at(s - back, new Vector3());
  const target = road.at(s + ahead, new Vector3());
  const k = Math.min(Math.max(i, 0), road.count - 1);
  pos.x += -road.tan[k * 2 + 1] * side;
  pos.z += road.tan[k * 2] * side;
  pos.y += up;
  return { pos: ensureClearance(hf, pos, target), target };
}
