export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Deterministic 2D hash in [0, 1): the same tile always looks the same. */
export function hash(x, y, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((seed | 0) + 1, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Distance from point P to segment AB. */
export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Signed shortest angle from a to b, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Point along a polyline, given precomputed cumulative lengths. Returns [x, y, heading]. */
export function pointAlong(points, cumulative, s) {
  let k = 1;
  while (k < cumulative.length - 1 && cumulative[k] < s) k++;
  const [ax, ay] = points[k - 1];
  const [bx, by] = points[k];
  const t = clamp((s - cumulative[k - 1]) / (cumulative[k] - cumulative[k - 1] || 1), 0, 1);
  return [lerp(ax, bx, t), lerp(ay, by, t), Math.atan2(by - ay, bx - ax)];
}

export function cumulativeLengths(points) {
  const out = [0];
  for (let k = 1; k < points.length; k++) {
    const [ax, ay] = points[k - 1];
    const [bx, by] = points[k];
    out.push(out[k - 1] + Math.hypot(bx - ax, by - ay));
  }
  return out;
}

/** Random helpers that accept an injectable RNG (handy for tests). */
export const randRange = (lo, hi, rng = Math.random) => lo + rng() * (hi - lo);
export const randInt = (lo, hi, rng = Math.random) => lo + Math.floor(rng() * (hi - lo + 1));
export const pick = (list, rng = Math.random) => list[Math.floor(rng() * list.length)];

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
