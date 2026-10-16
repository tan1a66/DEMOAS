/** Flecha diagonal ↗ dibujada (mismo trazo en todas las tipografías y sistemas). */
export function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg className={`arrow ${className}`} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M4 12 12 4M5.5 4H12v6.5" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
    </svg>
  );
}

/** Flecha hacia abajo (indicador de desplazamiento). */
export function ArrowDown({ className = '' }: { className?: string }) {
  return (
    <svg className={`arrow ${className}`} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M8 2v11M3.5 8.5 8 13l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
    </svg>
  );
}
