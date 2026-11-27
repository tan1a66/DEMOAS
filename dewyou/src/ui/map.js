import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BRAND } from '../data/content.js';

// Mapa vectorial (OpenFreeMap, sin clave) reteñido en crema, lila y el azul suave de la laguna.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

const recolor = (style) => {
  for (const l of style.layers) {
    const id = l.id;
    const p = (l.paint = l.paint || {});
    const lay = (l.layout = l.layout || {});
    if (l.type === 'background') p['background-color'] = '#F6F1EA';
    else if (l.type === 'fill') {
      delete p['fill-pattern'];
      if (/water/.test(id)) p['fill-color'] = '#DCE3EA';
      else if (/park|landcover|grass|wood|landuse/.test(id)) p['fill-color'] = '#ECEBDD';
      else if (/building/.test(id)) {
        p['fill-color'] = '#ECE4EF';
        p['fill-outline-color'] = '#E0D4E6';
      } else p['fill-color'] = '#F2ECE6';
    } else if (l.type === 'fill-extrusion') {
      lay.visibility = 'none';
    } else if (l.type === 'line') {
      delete p['line-pattern'];
      if (/water|river|stream|canal/.test(id)) p['line-color'] = '#D3DCE5';
      else if (/rail|transit/.test(id)) p['line-color'] = '#DCD2DF';
      else if (/boundary|admin/.test(id)) p['line-color'] = '#DDD0E2';
      else if (/casing/.test(id)) p['line-color'] = '#E7DEEA';
      else if (/motorway|trunk|primary/.test(id)) p['line-color'] = '#FFFCF7';
      else p['line-color'] = '#FDFAF5';
    } else if (l.type === 'symbol') {
      if (/poi|housenumber/.test(id)) lay.visibility = 'none';
      if (lay['text-field']) {
        p['text-color'] = '#7C6A7E';
        p['text-halo-color'] = '#FFFCF7';
        p['text-halo-width'] = 1.4;
      }
      if (lay['icon-image']) p['icon-opacity'] = 0.55;
    } else if (l.type === 'raster') {
      lay.visibility = 'none';
    }
  }
  return style;
};

export const initMap = async (container, { mobile }) => {
  const res = await fetch(STYLE_URL);
  if (!res.ok) throw new Error('style');
  const style = recolor(await res.json());

  const map = new maplibregl.Map({
    container,
    style,
    center: [BRAND.coords[0] - (mobile ? 0 : 0.0016), BRAND.coords[1] + 0.0006],
    zoom: mobile ? 15.2 : 15.8,
    minZoom: 12,
    maxZoom: 18.5,
    attributionControl: { compact: true },
    scrollZoom: false,
    cooperativeGestures: mobile,
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.touchZoomRotate.disableRotation();
  map.on('load', () => container.querySelector('.map__fallback')?.remove());

  const pin = document.createElement('div');
  pin.className = 'pin';
  pin.innerHTML = `<span class="pin__pulse"></span><span class="pin__dot"><span class="mark mark--unicorn"></span></span>
    <span class="pin__label"><b>DEWYOU</b>Plaza ESPACIO · Local F2</span>`;
  new maplibregl.Marker({ element: pin, anchor: 'bottom', offset: [0, 6] }).setLngLat(BRAND.coords).addTo(map);

  return map;
};
