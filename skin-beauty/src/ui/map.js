import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BRAND } from '../data/content.js';

// Mapa vectorial (OpenFreeMap, sin clave) reteñido en rosa empolvado y crema.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

const recolor = (style) => {
  for (const l of style.layers) {
    const id = l.id;
    const p = (l.paint = l.paint || {});
    const lay = (l.layout = l.layout || {});
    if (l.type === 'background') p['background-color'] = '#F3E7E0';
    else if (l.type === 'fill') {
      delete p['fill-pattern'];
      if (/water/.test(id)) p['fill-color'] = '#E7D2CD';
      else if (/park|landcover|grass|wood|landuse/.test(id)) p['fill-color'] = '#EEE2D6';
      else if (/building/.test(id)) {
        p['fill-color'] = '#EADBD2';
        p['fill-outline-color'] = '#E0CBC1';
      } else p['fill-color'] = '#F0E4DC';
    } else if (l.type === 'fill-extrusion') {
      lay.visibility = 'none';
    } else if (l.type === 'line') {
      delete p['line-pattern'];
      if (/water|river|stream|canal/.test(id)) p['line-color'] = '#E2C9C3';
      else if (/rail|transit/.test(id)) p['line-color'] = '#D8C3B2';
      else if (/boundary|admin/.test(id)) p['line-color'] = '#DCC4BC';
      else if (/casing/.test(id)) p['line-color'] = '#E8D4CB';
      else if (/motorway|trunk|primary/.test(id)) p['line-color'] = '#FBF2EC';
      else p['line-color'] = '#FCF7F3';
    } else if (l.type === 'symbol') {
      if (/poi|housenumber/.test(id)) lay.visibility = 'none';
      if (lay['text-field']) {
        p['text-color'] = '#8C6A64';
        p['text-halo-color'] = '#F5EDE6';
        p['text-halo-width'] = 1.4;
      }
      if (lay['icon-image']) p['icon-opacity'] = 0.55;
    } else if (l.type === 'raster') {
      lay.visibility = 'none';
    }
  }
  return style;
};

// Arco suave (no es la ruta exacta, solo indica el paseo desde el metro)
const arc = (a, b, bend = 0.22, n = 40) => {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([
      (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * cx + t * t * b[0],
      (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * cy + t * t * b[1],
    ]);
  }
  return pts;
};

export const initMap = async (container, { mobile }) => {
  const res = await fetch(STYLE_URL);
  if (!res.ok) throw new Error('style');
  const style = recolor(await res.json());
  const center = [(BRAND.coords[0] + BRAND.metroCoords[0]) / 2, (BRAND.coords[1] + BRAND.metroCoords[1]) / 2 - 0.0002];

  const map = new maplibregl.Map({
    container,
    style,
    center,
    zoom: mobile ? 15.6 : 16.1,
    minZoom: 13,
    maxZoom: 18.5,
    attributionControl: { compact: true },
    scrollZoom: false,
    cooperativeGestures: mobile,
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.touchZoomRotate.disableRotation();

  const route = arc(BRAND.metroCoords, BRAND.coords);
  map.on('load', () => {
    container.querySelector('.map__fallback')?.remove();
    map.addSource('walk', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: route } } });
    map.addLayer({
      id: 'walk',
      type: 'line',
      source: 'walk',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#A8706F', 'line-width': 3.2, 'line-dasharray': [0.1, 2.2], 'line-opacity': 0.9 },
    });
  });

  const pin = document.createElement('div');
  pin.className = 'pin';
  pin.innerHTML = `<span class="pin__pulse"></span><span class="pin__dot"><span>SB</span></span>
    <span class="pin__label"><b>Skin Beauty</b>C/ Riera Blanca, 55</span>`;
  new maplibregl.Marker({ element: pin, anchor: 'bottom', offset: [0, 6] }).setLngLat(BRAND.coords).addTo(map);

  const metro = document.createElement('div');
  metro.className = 'metro-pin';
  metro.innerHTML = '<b>L5</b>Metro Badal';
  new maplibregl.Marker({ element: metro }).setLngLat(BRAND.metroCoords).addTo(map);

  const mid = route[Math.floor(route.length / 2)];
  const walk = document.createElement('div');
  walk.className = 'walk-label';
  walk.textContent = '5 min a pie';
  new maplibregl.Marker({ element: walk }).setLngLat(mid).addTo(map);

  return map;
};
