// Punto único de acceso a los datos editables del sitio (los JSON de esta carpeta).
import sitioJson from './sitio.json';
import textosJson from './textos.json';
import cortesJson from './cortes.json';
import origenesJson from './origenes.json';
import ritualJson from './ritual.json';

export type Forma = 'ribeye' | 'striploin' | 'tomahawk' | 'picana' | 'filete';

export interface Corte {
  id: string;
  nombre: string;
  origen: string;
  region: string;
  raza: string;
  grado: string;
  peso: string;
  notas: string;
  coccion: string;
  forma: Forma;
  bms: number;
  foto?: string;
}

export interface Origen {
  id: string;
  pais: string;
  acento: string;
  linea: string;
  lat: number;
  lng: number;
  datos: { etiqueta: string; valor: string }[];
  foto?: string;
  fotoDescripcion: string;
}

export const sitio = sitioJson;
export const textos = textosJson;
export const cortes = cortesJson.cortes as Corte[];
export const origenes = origenesJson.origenes as Origen[];
export const destino = origenesJson.destino;
export const ritual = ritualJson;

/** Enlace de WhatsApp con mensaje. `{clave}` en la plantilla se sustituye con `vars`. */
export function whatsappUrl(plantilla: string = sitio.whatsapp.mensajePedido, vars: Record<string, string> = {}) {
  const texto = plantilla.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
  return `https://wa.me/${sitio.whatsapp.numero}?text=${encodeURIComponent(texto)}`;
}

/** Ruta pública (respeta `base` de Vite para que funcione en subcarpetas). */
export const publico = (ruta: string) => (ruta ? `${import.meta.env.BASE_URL}${ruta.replace(/^\//, '')}` : '');
