import { generateFormwork, generateSmooth } from './concrete.js';

// Genera le superfici fuori dal thread principale (la linea del loader resta fluida).
self.onmessage = (e) => {
  const { kind, size } = e.data;
  const out = kind === 'smooth' ? generateSmooth(size) : generateFormwork(size);
  self.postMessage({ kind, size: out.size, tileM: out.tileM, data: out.data }, [out.data.buffer]);
};
