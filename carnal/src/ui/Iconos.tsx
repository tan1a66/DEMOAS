export function IconoWhatsApp({ tam = 20 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.3 20.7l4.4-1.1A8.8 8.8 0 1 0 12 3.2Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M9.1 8.1c.2-.4.4-.4.6-.4h.5c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.4.7 1.6 2 3 2.5.2.1.4 0 .5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.3.2.3.4 0 .5-.2 1.1-.7 1.4-.5.4-1.4.6-2.6.2-1.5-.5-3.6-2-4.6-3.9-.6-1.1-.6-2.1-.3-2.8l.3-.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconoInstagram({ tam = 18 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function Flecha({ dir = 'abajo' }: { dir?: 'abajo' | 'derecha' }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" style={{ transform: dir === 'derecha' ? 'rotate(-90deg)' : undefined }}>
      <path d="M5 1v8M1.5 5.5 5 9l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
