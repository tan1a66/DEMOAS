import { Fragment, type CSSProperties, type ElementType, type ReactNode } from 'react';

/** "texto *cursiva*" → texto <em>cursiva</em>: el acento itálico de los titulares vive en las traducciones. */
export function rich(text: string): ReactNode {
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  return parts.map((p, i) => (p.startsWith('*') && p.endsWith('*') ? <em key={i}>{p.slice(1, -1)}</em> : <Fragment key={i}>{p}</Fragment>));
}

interface TitleProps {
  lines: readonly string[];
  as?: ElementType;
  className?: string;
  id?: string;
  /** Retraso inicial de la animación de líneas (ms). */
  delay?: number;
  tabIndex?: number;
}

/**
 * Titular en líneas que suben desde una máscara cuando el contenedor recibe `.is-in`.
 * El texto completo queda en una sola cadena accesible para lectores de pantalla.
 */
export function Title({ lines, as: Tag = 'h2', className = '', id, delay = 0, tabIndex }: TitleProps) {
  const label = lines.map((l) => l.replace(/\*/g, '')).join(' ');
  return (
    <Tag className={className} id={id} tabIndex={tabIndex}>
      <span className="visually-hidden">{label}</span>
      {lines.map((line, i) => (
        <span className="line" key={i} aria-hidden="true">
          <span className="line__inner" style={{ '--i': i, '--d': `${delay}ms` } as CSSProperties}>
            {rich(line)}
          </span>
        </span>
      ))}
    </Tag>
  );
}
