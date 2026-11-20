export const euro = (v) => (v < 0 ? '-' : '') + '€' + Math.abs(v).toFixed(2).replace('.', ',');

export function clock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
