// Datos de la demo. Proyecto FICTICIO: nombres, superficies, departamentos y disponibilidad
// son ilustrativos; se sustituyen por los reales del desarrollo.

export const HOTEL = {
  nombre: 'Xelha',
  ciudad: 'Mérida, Yucatán',
  lema: 'Hotel & residencias entre jardines colgantes, a 25 minutos del mar.',
  // Ubicación ilustrativa en el norte de Mérida.
  coordenadas: { lat: 21.035, lng: -89.605 },
};

// Tres tipologías de departamento que se repiten en todos los niveles.
export const TIPOS = {
  a: { nombre: 'Estudio', letra: 'A', m2: 43, ancho: 5.0, recamaras: 0, banos: 1, detalle: 'Cocineta, sala y terraza con jardín' },
  b: { nombre: '1 Recámara', letra: 'B', m2: 60, ancho: 7.0, recamaras: 1, banos: 1, detalle: 'Sala-comedor, cocina y terraza' },
  c: { nombre: '2 Recámaras', letra: 'C', m2: 81, ancho: 9.4, recamaras: 2, banos: 2, detalle: 'Esquina luminosa con doble terraza' },
};

export const ESTADOS = {
  disponible: { nombre: 'Disponible', color: '#3fbf8f' },
  apartado: { nombre: 'Apartado', color: '#e0a84a' },
  vendido: { nombre: 'Vendido', color: '#9aa1a6' },
};

// Mitad de cada ala, del núcleo hacia el extremo (el ala izquierda es simétrica):
// la secuencia A · B · C se repite y los pisos altos son más cortos (terrazas escalonadas).
const SECUENCIA = ['a', 'b', 'c'];
const ala = (n) => Array.from({ length: n }, (_, i) => SECUENCIA[i % 3]);
const ALAS = { 1: ala(7), 2: ala(7), 3: ala(6), 4: ala(5), 5: ala(4), 6: ala(3) };

// Disponibilidad determinista (misma en cada carga); los pisos altos, más vendidos.
function estado(nivel, i) {
  const h = Math.abs(Math.sin(nivel * 127.1 + i * 311.7) * 43758.5453) % 1;
  const vendido = 0.12 + nivel * 0.06;
  if (h < vendido) return 'vendido';
  if (h < vendido + 0.18) return 'apartado';
  return 'disponible';
}

function unidades(nivel) {
  const ala = ALAS[nivel];
  // Orden de izquierda a derecha: ala izquierda invertida + ala derecha.
  const lista = [...[...ala].reverse().map((t) => ({ tipo: t, lado: -1 })), ...ala.map((t) => ({ tipo: t, lado: 1 }))];
  return lista.map((u, i) => ({
    ...u,
    id: `${nivel}${String(i + 1).padStart(2, '0')}`,
    nivel,
    estado: estado(nivel, i),
  }));
}

export const PISOS = [
  {
    id: 'pb',
    nivel: 0,
    corto: 'PB',
    nombre: 'Planta Baja',
    lema: 'Lobby, restaurante y spa abiertos al jardín.',
    amenidades: ['Lobby de doble altura', 'Restaurante Ki’ik', 'Spa & temazcal', 'Gimnasio'],
  },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    id: `n${n}`,
    nivel: n,
    corto: String(n),
    nombre: `Nivel ${n}`,
    lema:
      n === 6
        ? 'El nivel más alto, junto al rooftop.'
        : n >= 4
          ? 'Terrazas escalonadas sobre los jardines.'
          : 'Todos los departamentos miran al patio y a la alberca.',
    unidades: unidades(n),
  })),
  {
    id: 'rooftop',
    nivel: 7,
    corto: 'R',
    nombre: 'Rooftop',
    lema: 'Alberca infinita y bar con el atardecer de Mérida.',
    amenidades: ['Alberca infinita', 'Sky bar', 'Pérgola al atardecer', 'Vista a la ciudad'],
  },
];

export const TOTAL_DEPARTAMENTOS = PISOS.reduce((s, p) => s + (p.unidades?.length ?? 0), 0);

// Resumen de un piso para el panel de información.
export function resumen(piso) {
  if (!piso.unidades) return null;
  const porTipo = {};
  const porEstado = { disponible: 0, apartado: 0, vendido: 0 };
  for (const u of piso.unidades) {
    porTipo[u.tipo] = (porTipo[u.tipo] ?? 0) + 1;
    porEstado[u.estado]++;
  }
  const m2 = piso.unidades.map((u) => TIPOS[u.tipo].m2);
  return { total: piso.unidades.length, porTipo, porEstado, m2: [Math.min(...m2), Math.max(...m2)] };
}

// Prólogo sobre Mérida. Distancias y minutos APROXIMADOS (en auto, sin tráfico), por verificar.
export const MERIDA = {
  mar: { nombre: 'Playa de Progreso', lat: 21.283, lng: -89.664, km: 30, min: 25 },
  puntos: [
    { id: 'centro', nombre: 'Centro Histórico', lat: 20.967, lng: -89.623, min: 20 },
    { id: 'aeropuerto', nombre: 'Aeropuerto MID', lat: 20.937, lng: -89.658, min: 20 },
    { id: 'tren', nombre: 'Tren Maya · Teya', lat: 20.995, lng: -89.56, min: 15 },
    { id: 'progreso', nombre: 'Playa de Progreso', lat: 21.283, lng: -89.664, min: 25 },
  ],
};
