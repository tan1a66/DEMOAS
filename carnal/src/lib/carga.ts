// Señales de "listo" para el loader del Umbral: fuentes + primera compilación del 3D.
type Clave = 'fuentes' | '3d';
const pendientes = new Map<Clave, () => void>();
const promesas = new Map<Clave, Promise<void>>();

function promesa(clave: Clave) {
  if (!promesas.has(clave)) promesas.set(clave, new Promise<void>((r) => pendientes.set(clave, r)));
  return promesas.get(clave)!;
}

export function marcarListo(clave: Clave) {
  promesa(clave);
  pendientes.get(clave)?.();
}

/** Resuelve cuando todo está listo o, como máximo, tras `limite` ms. */
export function esperarCarga(claves: Clave[], limite = 7000) {
  return Promise.race([
    Promise.all(claves.map(promesa)).then(() => undefined),
    new Promise<void>((r) => setTimeout(r, limite)),
  ]);
}
