/*
  Risolve il percorso di un file di public/ (foto, profondità, ritagli, texture).
  Nella versione "file unico" (npm run build:preview) i file sono incorporati nell'HTML
  come data URI in window.__ASSETS: così la demo si apre con doppio clic, senza server.
*/
// Percorsi relativi alla pagina: il sito funziona anche in una sottocartella o da uno ZIP caricato ovunque.
export const asset = (path) => (window.__ASSETS && window.__ASSETS[path]) || path.replace(/^\//, '');
export const hasAsset = (path) => !window.__ASSETS || !!window.__ASSETS[path];
