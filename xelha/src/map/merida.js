import * as THREE from 'three';
import gsap from 'gsap';
// Reutiliza el mapa 3D de la península de la demo URBAZ (mismo repositorio).
import { toVec3, LAND_TOP } from '../../../src/geo/projection.js';
import { buildLand } from '../../../src/scene/land.js';
import { buildSea } from '../../../src/scene/sea.js';
import { buildSky } from '../../../src/scene/sky.js';
import { buildClouds } from '../../../src/scene/clouds.js';
import { GlowRoute } from '../../../src/scene/route.js';
import { CityMarker } from '../../../src/scene/markers.js';
import { CameraRig } from '../../../src/scene/cameraRig.js';
import { Labels } from '../../../src/ui/labels.js';
import geo from '../../../src/data/yucatan.geo.json';
import places from '../../../src/data/places.json';
import { HOTEL, MERIDA } from '../data/hotel.js';

// Prólogo: de la península a Mérida, la distancia al mar y los puntos clave, hasta el hotel.
export function buildMeridaScene({ canvas, resolution, quality, labelsEl, captions }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf0d2b4, 400, 3000);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 12000);
  const sunDir = new THREE.Vector3(-0.82, 0.4, 0.2).normalize();
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0xd6c3a2, 1.5));
  const sun = new THREE.DirectionalLight(0xffd4a8, 2.0);
  sun.position.copy(sunDir).multiplyScalar(400);
  scene.add(sun);

  const land = buildLand(geo, places, resolution);
  const sea = buildSea(geo, sunDir, { texSize: quality.mobile ? 768 : 1024 });
  const clouds = buildClouds(quality.clouds, toVec3({ lat: 20.5, lng: -88.45 }, 0));
  scene.add(land.group, sea.mesh, buildSky(sunDir), clouds.group);

  const hotelPos = toVec3(HOTEL.coordenadas, LAND_TOP);
  const marker = new CityMarker({ id: 'xelha', ...HOTEL.coordenadas });
  scene.add(marker.group);

  // Ruta al mar (carretera a Progreso) y líneas finas a los puntos clave.
  const toSea = new GlowRoute(
    [HOTEL.coordenadas, { lat: 21.07, lng: -89.622 }, { lat: 21.15, lng: -89.636 }, { lat: 21.22, lng: -89.656 }, MERIDA.mar],
    resolution,
    { width: 3, glow: 12, samples: 160 }
  );
  scene.add(toSea.group);
  const spokes = MERIDA.puntos
    .filter((p) => p.id !== 'progreso')
    .map((p) => {
      const r = new GlowRoute([HOTEL.coordenadas, p], resolution, { color: 0xfff1d6, width: 1.4, glow: 5, flow: false, samples: 40 });
      scene.add(r.group);
      return r;
    });

  const labels = new Labels(labelsEl);
  const tag = (html, pos, cls = '') => {
    const el = document.createElement('div');
    el.className = `map-tag ${cls}`;
    el.innerHTML = html;
    const item = labels.add(el, () => pos, { avoid: true });
    item.visible = false;
    return item;
  };
  const hotelTag = tag(`<b>Xelha</b><span>Norte de Mérida</span>`, hotelPos.clone().setY(LAND_TOP + 0.4), 'is-hotel');
  const seaTag = tag(`<b>Golfo de México</b><span>Playa de Progreso</span>`, toVec3(MERIDA.mar, LAND_TOP + 0.3), 'is-sea');
  const poiTags = MERIDA.puntos
    .filter((p) => p.id !== 'progreso')
    .map((p) => tag(`<b>${p.min} min</b><span>${p.nombre}</span>`, toVec3(p, LAND_TOP + 0.3)));

  const rig = new CameraRig(camera, canvas);
  rig.controls.enabled = false;
  const mid = hotelPos.clone().lerp(toVec3(MERIDA.mar), 0.5);
  // En pantallas verticales el encuadre se desplaza al sur: el mapa sube y deja sitio a los textos.
  const lift = (v, km) => (quality.mobile || innerWidth < innerHeight ? v.clone().add(new THREE.Vector3(0, 0, km)) : v);
  const VIEWS = {
    space: { target: toVec3({ lat: 20.6, lng: -88.9 }, 0), distance: 2900, polar: 0.02, azimuth: -0.35 },
    merida: { target: lift(hotelPos, 9), distance: 58, polar: 0.92, azimuth: 0.35 },
    coast: { target: lift(mid, 11), distance: 66, polar: 0.86, azimuth: 0.22 },
    pois: { target: lift(hotelPos.clone().add(new THREE.Vector3(0, 0, 2)), 9), distance: 52, polar: 0.78, azimuth: -0.15 },
    dive: { target: hotelPos, distance: 1.5, polar: 0.25, azimuth: 0.1 },
  };

  let tl = null;
  const state = { routeK: 0, spokeK: 0, focus: 0 };

  function reset() {
    tl?.kill();
    rig.set(VIEWS.space);
    Object.assign(state, { routeK: 0, spokeK: 0, focus: 0 });
    marker.appear = 0;
    [hotelTag, seaTag, ...poiTags].forEach((t) => (t.visible = false));
    captions.hide();
  }

  // Secuencia completa; `onDive` se llama al empezar la caída hacia el hotel.
  function play({ onDive, onDone }) {
    reset();
    tl = gsap.timeline();
    const fly = (view, opts) => () => rig.flyTo(view, opts);
    // Unos 12 s: Mérida, distancia al mar, puntos clave y caída hacia el hotel.
    tl.add(fly(VIEWS.merida, { duration: 3.6, ease: 'power2.inOut' }), 0)
      .add(() => captions.show('Mérida', 'Yucatán · México', 'Capital cultural del sureste, entre cenotes y haciendas.'), 0.5)
      .to(state, { focus: 1, duration: 1.6 }, 2.2)
      .to(marker, { appear: 1, duration: 0.8 }, 3.0)
      .add(() => (hotelTag.visible = true), 3.4)
      .add(fly(VIEWS.coast, { duration: 2.6 }), 4.2)
      .add(() => captions.show('A 25 minutos del mar', 'Distancia aprox.', `≈ ${MERIDA.mar.km} km por la carretera a Progreso.`, { stat: MERIDA.mar.min, unit: 'min' }), 4.4)
      .to(state, { routeK: 1, duration: 2.4, ease: 'power1.inOut' }, 4.4)
      .add(() => (seaTag.visible = true), 6.4)
      .add(() => (seaTag.visible = false), 7.6)
      .add(fly(VIEWS.pois, { duration: 2.2 }), 7.4)
      .add(() => captions.show('Todo a la mano', 'Conectividad', 'Centro, aeropuerto y Tren Maya en minutos (aprox.).'), 7.6)
      .to(state, { spokeK: 1, duration: 1.2, ease: 'power2.out' }, 8.0)
      .add(() => poiTags.forEach((t, i) => gsap.delayedCall(i * 0.18, () => (t.visible = true))), 8.3)
      .add(() => {
        poiTags.forEach((t) => (t.visible = false));
        hotelTag.visible = false;
        captions.show('Xelha', 'Bienvenido', HOTEL.lema);
        onDive?.();
      }, 10.6)
      .add(fly(VIEWS.dive, { duration: 2.0, ease: 'power3.in' }), 10.6)
      .add(() => onDone?.(), 12.4);
  }

  const update = (t, dt) => {
    sea.uniforms.uTime.value = t;
    clouds.update(camera, dt);
    land.setFocus(state.focus);
    toSea.setProgress(state.routeK);
    toSea.update(t, rig.distance);
    spokes.forEach((s) => s.setProgress(state.spokeK));
    marker.update(t, rig.distance, dt);
  };

  return {
    scene, camera, rig, labels, update, play, reset,
    stop() {
      tl?.kill();
      rig.kill();
      rig.controls.enabled = false;
      [hotelTag, seaTag, ...poiTags].forEach((t) => (t.visible = false));
    },
  };
}
