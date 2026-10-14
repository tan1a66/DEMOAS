import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Fuentes autoalojadas (solo el subconjunto latino: cubre á é í ó ú ñ ü ¿ ¡).
import '@fontsource/cormorant-garamond/latin-300.css';
import '@fontsource/cormorant-garamond/latin-300-italic.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import '@fontsource/manrope/latin-300.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-400.css';

import './estilos/base.css';
import './estilos/escenas.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
