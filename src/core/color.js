export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
}

/** Lighten (f > 0) or darken (f < 0) a hex colour. */
export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
  return `rgb(${r},${g},${b})`;
}
