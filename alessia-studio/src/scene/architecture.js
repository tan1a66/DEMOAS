import { GeoBuilder, rect, circle, roundedSquare } from './geometry.js';
import {
  FLOOR_Y, CEIL_Y, ROOF_Y, ROOM, SHELL, FRONT_WALL as FW, WINDOW as W, BACK_OPENING as BO,
  PIT, SKYLIGHT as SK, TERRACE as T,
} from '../layout.js';

// Volumi in cemento rosa. Quattro gruppi: zona (esterno/interno) × finitura (cassero/liscio).
// L'esterno è illuminato dal sole basso sul mare, l'interno dal sole che entra dal lucernario.

export function buildArchitecture() {
  const g = {
    extForm: new GeoBuilder(),
    extSmooth: new GeoBuilder(),
    intForm: new GeoBuilder(),
    intSmooth: new GeoBuilder(),
  };

  const winHole = circle(W.cx, W.cy, W.r, W.segments);
  const skyHoleXZ = circle(SK.cx, SK.cz, SK.r, SK.segments);
  const pitOuter = roundedSquare(PIT.cx, PIT.cz, PIT.half, PIT.r, PIT.cornerSegments);
  const pitR1 = roundedSquare(PIT.cx, PIT.cz, PIT.half - PIT.ring1.inset, PIT.r - PIT.ring1.inset, PIT.cornerSegments);
  const pitR2 = roundedSquare(PIT.cx, PIT.cz, PIT.half - PIT.ring2.inset, PIT.r - PIT.ring2.inset, PIT.cornerSegments);

  // ---------------- Esterno ----------------
  const E = g.extForm;
  // Muro frontale: faccia esterna con la finestra circolare
  E.face('z', 1, FW.zOut, rect(FW.x0, FW.y0, FW.x1, FW.y1), [winHole], { uvOffset: [0.37, 0.11] });
  E.face('x', -1, FW.x0, rect(FW.zIn, FW.y0, FW.zOut, FW.y1));
  E.face('x', 1, FW.x1, rect(FW.zIn, FW.y0, FW.zOut, FW.y1));
  E.face('y', 1, FW.y1, rect(FW.x0, FW.zIn, FW.x1, FW.zOut));
  // retro del muro frontale (le parti che sporgono dal volume)
  E.face('z', -1, FW.zIn, rect(FW.x0, FW.y0, SHELL.x0, FW.y1));
  E.face('z', -1, FW.zIn, rect(SHELL.x1, FW.y0, FW.x1, FW.y1));
  E.face('z', -1, FW.zIn, rect(SHELL.x0, ROOF_Y, SHELL.x1, FW.y1));
  // spessore della finestra circolare (normali verso l'asse)
  {
    const pts = [], nor = [];
    for (const [x, y] of winHole) {
      pts.push([x, y, FW.zOut]);
      nor.push([W.cx - x, W.cy - y, 0]);
    }
    E.strip({ points: pts, normals: nor, ext: [0, 0, FW.zIn - FW.zOut], closed: true });
  }
  // Fianchi del volume
  E.face('x', -1, SHELL.x0, rect(SHELL.z0, 0, SHELL.z1, ROOF_Y), [], { uvOffset: [0.2, 0.31] });
  E.face('x', 1, SHELL.x1, rect(SHELL.z0, 0, SHELL.z1, ROOF_Y), [], { uvOffset: [0.6, 0.43] });
  // Copertura con il foro del lucernario
  g.extSmooth.face('y', 1, ROOF_Y, rect(SHELL.x0, SHELL.z0, SHELL.x1, SHELL.z1), [skyHoleXZ]);
  // Muro di fondo, faccia esterna: sopra la terrazza (con l'apertura) e sotto la terrazza
  E.face('z', -1, SHELL.z0, [
    [SHELL.x0, FLOOR_Y], [BO.x0, FLOOR_Y], [BO.x0, BO.y1], [BO.x1, BO.y1], [BO.x1, FLOOR_Y],
    [SHELL.x1, FLOOR_Y], [SHELL.x1, ROOF_Y], [SHELL.x0, ROOF_Y],
  ], [], { uvOffset: [0.5, 0.0] });
  E.face('z', -1, SHELL.z0, rect(SHELL.x0, 0, SHELL.x1, T.bottom));
  // Spalle e architrave dell'apertura
  E.face('x', 1, BO.x0, rect(SHELL.z0, BO.y0, ROOM.z0, BO.y1));
  E.face('x', -1, BO.x1, rect(SHELL.z0, BO.y0, ROOM.z0, BO.y1));
  E.face('y', -1, BO.y1, rect(BO.x0, SHELL.z0, BO.x1, ROOM.z0));
  g.extSmooth.face('y', 1, FLOOR_Y, rect(BO.x0, SHELL.z0, BO.x1, ROOM.z0));
  // Terrazza a sbalzo
  g.extSmooth.face('y', 1, T.y, rect(T.x0, T.z0, T.x1, T.z1));
  E.face('y', -1, T.bottom, rect(T.x0, T.z0, T.x1, T.z1));
  E.face('z', -1, T.z0, rect(T.x0, T.bottom, T.x1, T.y));
  E.face('x', -1, T.x0, rect(T.z0, T.bottom, T.z1, T.y));
  E.face('x', 1, T.x1, rect(T.z0, T.bottom, T.z1, T.y));
  E.face('z', 1, T.z1, rect(T.x0, T.bottom, SHELL.x0, T.y));

  // ---------------- Interno ----------------
  const I = g.intForm;
  I.face('z', -1, FW.zIn, rect(ROOM.x0, FLOOR_Y, ROOM.x1, CEIL_Y), [winHole], { uvOffset: [0.13, 0.27] });
  I.face('x', 1, ROOM.x0, rect(ROOM.z0, FLOOR_Y, ROOM.z1, CEIL_Y), [], { uvOffset: [0.71, 0.05] });
  I.face('x', -1, ROOM.x1, rect(ROOM.z0, FLOOR_Y, ROOM.z1, CEIL_Y), [], { uvOffset: [0.29, 0.62] });
  I.face('z', 1, ROOM.z0, [
    [ROOM.x0, FLOOR_Y], [BO.x0, FLOOR_Y], [BO.x0, BO.y1], [BO.x1, BO.y1], [BO.x1, FLOOR_Y],
    [ROOM.x1, FLOOR_Y], [ROOM.x1, CEIL_Y], [ROOM.x0, CEIL_Y],
  ], [], { uvOffset: [0.44, 0.19] });
  // Soffitto con il lucernario
  I.face('y', -1, CEIL_Y, rect(ROOM.x0, ROOM.z0, ROOM.x1, ROOM.z1), [skyHoleXZ]);
  {
    const pts = [], nor = [];
    for (const [x, z] of skyHoleXZ) {
      pts.push([x, SK.y0, z]);
      nor.push([SK.cx - x, 0, SK.cz - z]);
    }
    I.strip({ points: pts, normals: nor, ext: [0, SK.y1 - SK.y0, 0], closed: true });
  }

  // Pavimento con il pit
  const S = g.intSmooth;
  S.face('y', 1, FLOOR_Y, rect(ROOM.x0, ROOM.z0, ROOM.x1, ROOM.z1), [pitOuter.pts]);
  S.face('y', 1, PIT.ring1.y, pitOuter.pts, [pitR1.pts]);
  S.face('y', 1, PIT.ring2.y, pitR1.pts, [pitR2.pts]);
  S.face('y', 1, PIT.floorY, pitR2.pts);
  const riser = (rs, y0, y1) => {
    const pts = rs.pts.map(([x, z]) => [x, y0, z]);
    const nor = rs.nor.map(([nx, nz]) => [-nx, 0, -nz]);
    I.strip({ points: pts, normals: nor, ext: [0, y1 - y0, 0], closed: true });
  };
  riser(pitOuter, PIT.ring1.y, FLOOR_Y);
  riser(pitR1, PIT.ring2.y, PIT.ring1.y);
  riser(pitR2, PIT.floorY, PIT.ring2.y);

  return {
    extForm: g.extForm.toGeometry(),
    extSmooth: g.extSmooth.toGeometry(),
    intForm: g.intForm.toGeometry(),
    intSmooth: g.intSmooth.toGeometry(),
  };
}
