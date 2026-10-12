// ⚠️ DA VERIFICARE — tiempos en auto APROXIMADOS, calculados (no medidos):
//   distancia en línea recta × 1.3 (factor de trazado vial),
//   primeros 12 km a 40 km/h (ciudad) y el resto a 80 km/h (carretera).
// Antes de usarlos con clientes conviene sustituirlos por tiempos reales
// (p.ej. consultados a mano en un navegador de mapas) en TRAVEL_OVERRIDES.

const R = 6371;
export function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Minutos verificados a mano: { 'torre-triada:altabrisa': 12, ... }. Vacío por ahora.
export const TRAVEL_OVERRIDES = {};

export function driveMinutes(projectId, from, poi) {
  const key = `${projectId}:${poi.id}`;
  if (TRAVEL_OVERRIDES[key] != null) return TRAVEL_OVERRIDES[key];
  const road = haversineKm(from, poi) * 1.3;
  const city = Math.min(road, 12);
  const minutes = (city / 40) * 60 + (Math.max(0, road - 12) / 80) * 60;
  return Math.max(3, Math.round(minutes / 5) * 5 || 3);
}

// Grupo de puntos clave de cada ciudad (ver places.json → puntos_clave).
export const poiGroupFor = (city) => city;
