// Punto de entrada ligero: tipografías, estilos y textos. La experiencia 3D
// (three.js, postproceso…) se carga aparte, sólo si el navegador tiene WebGL2;
// si no, se muestra la versión estática con los mismos textos y menú.
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/cormorant-garamond/300-italic.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import './styles/main.css';

import { CONFIG } from './config.js';
import { content } from './content/es.js';
import { hasWebGL2 } from './core/quality.js';
import { renderFallback } from './ui/fallback.js';

const app = document.getElementById('app');
const fallback = () => renderFallback(app, { content, config: CONFIG });

if (!hasWebGL2() || new URLSearchParams(location.search).has('static')) {
  fallback();
} else {
  import('./experience.js')
    .then(({ startExperience }) => startExperience({ content, config: CONFIG }))
    .catch((err) => {
      console.error(err);
      fallback();
    });
}
