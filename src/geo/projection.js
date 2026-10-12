import * as THREE from 'three';

// Proyección equirectangular local: 1 unidad de escena = 1 km.
// Norte = -Z, Este = +X. Suficiente para el área de la península.
export const ORIGIN = { lat: 20.4, lng: -88.6 };
const KY = 111.32;
const KX = 111.32 * Math.cos((ORIGIN.lat * Math.PI) / 180);

export const LAND_TOP = 1.0; // altura de la superficie de la península
export const CONTEXT_TOP = 0.7; // tierras vecinas, un poco más bajas

export const project = (lng, lat) => [(lng - ORIGIN.lng) * KX, -(lat - ORIGIN.lat) * KY];

export const toVec3 = ({ lat, lng }, y = LAND_TOP) => {
  const [x, z] = project(lng, lat);
  return new THREE.Vector3(x, y, z);
};

export const centroid = (points) => {
  const c = new THREE.Vector3();
  points.forEach((p) => c.add(toVec3(p)));
  return c.divideScalar(points.length);
};
