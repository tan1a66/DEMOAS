// Mini mapa 2D (canvas) alrededor del proyecto: costa, puntos clave y el proyecto.
// Ligero: se dibuja una sola vez al abrir la página del proyecto.
export function drawMiniMap(canvas, geo, project, pois, { spanDeg = 0.42 } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 360;
  const h = canvas.clientHeight || 260;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Encaje: proyecto + puntos clave, con un mínimo de amplitud.
  const pts = [project.coordenadas, ...pois];
  let minLng = Math.min(...pts.map((p) => p.lng));
  let maxLng = Math.max(...pts.map((p) => p.lng));
  let minLat = Math.min(...pts.map((p) => p.lat));
  let maxLat = Math.max(...pts.map((p) => p.lat));
  const cLat = (minLat + maxLat) / 2;
  const kx = Math.cos((cLat * Math.PI) / 180);
  let spanX = Math.max((maxLng - minLng) * kx, spanDeg) * 1.35;
  let spanY = Math.max(maxLat - minLat, spanDeg * 0.6) * 1.35;
  if (spanX / spanY > w / h) spanY = (spanX * h) / w;
  else spanX = (spanY * w) / h;
  const cx = ((minLng + maxLng) / 2) * kx;
  const cy = cLat;
  const X = (lng) => ((lng * kx - cx) / spanX + 0.5) * w;
  const Y = (lat) => (0.5 - (lat - cy) / spanY) * h;

  const sea = ctx.createLinearGradient(0, 0, 0, h);
  sea.addColorStop(0, '#5cc7c0');
  sea.addColorStop(1, '#2e9fa0');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, w, h);

  ctx.lineJoin = 'round';
  for (const f of geo.features) {
    for (const poly of f.geometry.coordinates) {
      ctx.beginPath();
      for (const ring of poly) {
        ring.forEach(([lng, lat], i) => (i ? ctx.lineTo(X(lng), Y(lat)) : ctx.moveTo(X(lng), Y(lat))));
        ctx.closePath();
      }
      ctx.fillStyle = f.properties.main ? '#f1e5cf' : '#e2d8c8';
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  const p0 = [X(project.coordenadas.lng), Y(project.coordenadas.lat)];
  ctx.font = '600 10px Manrope, system-ui, sans-serif';
  for (const poi of pois) {
    const x = X(poi.lng);
    const y = Y(poi.lat);
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(29,42,46,0.35)';
    ctx.beginPath();
    ctx.moveTo(...p0);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#1d2a2e';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(poi.nombre, x + 6, y + 3);
  }
  // Proyecto: halo + punto.
  ctx.fillStyle = 'rgba(63,224,208,0.35)';
  ctx.beginPath();
  ctx.arc(...p0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0c625d';
  ctx.beginPath();
  ctx.arc(...p0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
}
