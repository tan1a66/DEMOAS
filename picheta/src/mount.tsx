import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { LangProvider, type PageId } from './i18n';

import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource-variable/archivo/wdth.css';
import './styles/base.css';
import './styles/components.css';

/** Monta una página dentro del proveedor de idioma. Cada HTML tiene su propia entrada (sin carga diferida). */
export function mount(page: PageId, Page: ComponentType) {
  const root = document.getElementById('root');
  if (!root) return;
  createRoot(root).render(
    <StrictMode>
      <LangProvider page={page}>
        <Page />
      </LangProvider>
    </StrictMode>,
  );
}
