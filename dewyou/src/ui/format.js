const nf = new Intl.NumberFormat('es-MX');
export const money = (n) => `$${nf.format(n)}`;

// Precio de un servicio: "$850", "$340 · gel $480", "desde $150", "$3,000 al mes"
export const priceLabel = (t) => {
  if (t.pg) return `${money(t.p)} · gel ${money(t.pg)}`;
  if (t.from) return `desde ${money(t.p)}`;
  if (t.month) return `${money(t.p)} al mes`;
  return money(t.p);
};
