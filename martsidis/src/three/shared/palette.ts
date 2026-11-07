import { Color } from 'three';

/**
 * Legge i colori dai design token CSS (src/styles/tokens.css): un solo punto per cambiarli.
 * Se una variabile manca usa il valore di riserva.
 */
export function coloreToken(nome: string, riserva: string): Color {
  const valore = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return new Color(valore || riserva);
}

export function paletteBrand() {
  return {
    plum800: coloreToken('--c-plum-800', '#3e2955'),
    plum700: coloreToken('--c-plum-700', '#553872'),
    plum500: coloreToken('--c-plum-500', '#8559a0'),
    plum300: coloreToken('--c-plum-300', '#bba3cf'),
    plum100: coloreToken('--c-plum-100', '#ece3f2'),
    sage500: coloreToken('--c-sage-500', '#7e9c88'),
    sage200: coloreToken('--c-sage-200', '#cbdbcf'),
    sand200: coloreToken('--c-sand-200', '#e2d6c5'),
    sand100: coloreToken('--c-sand-100', '#eee5d8'),
    ivory: coloreToken('--c-ivory', '#fbf8f3'),
    ink: coloreToken('--c-ink', '#2a2430'),
  };
}
