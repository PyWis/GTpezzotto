import { TILE } from '../data/city.js';
import { collides, isOnHighway, moveCircle, Solid, tileAtPoint } from '../world/map.js';
import { Tile } from '../world/tiles.js';
import { keys, steering } from '../input.js';
import { say } from './speech.js';
import { bump } from './vespas.js';

export const VESPA_TOP_SPEED = 330; // px/s
export const MOUNT_RANGE = 42;
const WALK_SPEED = 78;
const RUN_SPEED = 140;

export const SHIRT_RED = '#c8262b';
export const SHIRT_AZZURRA = '#1d9be0';

/** Gennaro. `mode` is one of: foot, vespa, funicular, metro. */
export const player = {
  name: 'Gennaro',
  x: (176 + 0.5) * TILE,
  y: (70 + 0.5) * TILE,
  a: -Math.PI / 2,
  mode: 'foot',
  vespa: null,
  walk: 0,
  moving: false,
  shirt: SHIRT_RED, // diventa azzurra dopo aver servito il Dio del Calcio
  hair: '#1d140e',
  skin: '#e8b994',
  say: '',
  sayT: 0,
};

export const isOnStreet = () => player.mode === 'foot' || player.mode === 'vespa';
export const speed = () => (player.vespa ? Math.abs(player.vespa.v) : 0);

export function mount(vespa) {
  vespa.ridden = true;
  player.vespa = vespa;
  player.mode = 'vespa';
}

/** Gets off the Vespa on whichever side is free. Returns false if not possible now. */
export function dismount() {
  const v = player.vespa;
  if (Math.abs(v.v) > 70) return false;
  if (isOnHighway(v.x, v.y)) {
    say(player, 'Non puoi scendere in tangenziale!', 1.8);
    return false;
  }
  for (const side of [1, -1]) {
    const x = v.x - Math.sin(v.a) * 18 * side;
    const y = v.y + Math.cos(v.a) * 18 * side;
    if (collides(x, y, 6, Solid.FOOT)) continue;
    Object.assign(player, { x, y, a: v.a, vespa: null, mode: 'foot' });
    v.v = 0;
    v.ridden = false;
    return true;
  }
  return false;
}

export function updateOnFoot(dt) {
  player.a += steering() * 3.6 * dt;
  const sp = keys.up ? (keys.run ? RUN_SPEED : WALK_SPEED) : keys.down ? -42 : 0;
  player.moving = sp !== 0;
  if (!sp) return;
  const hit = moveCircle(player, Math.cos(player.a) * sp * dt, Math.sin(player.a) * sp * dt, 6, Solid.FOOT);
  player.walk += dt * Math.abs(sp) * 0.17;
  if (hit.highway && player.sayT <= 0) say(player, 'Vietato ai pedoni!');
}

/**
 * Arcade Vespa physics. `boost` scales speed and acceleration (turbo × how dented the Vespa is).
 * Returns the impact strength (for screen shake), or 0.
 */
export function updateRiding(dt, boost = 1) {
  const v = player.vespa;
  const before = v.v;
  const topSpeed = (tileAtPoint(v.x, v.y) === Tile.PARK ? 160 : VESPA_TOP_SPEED) * boost;

  if (keys.up) v.v += (v.v < 0 ? 520 : 250 * boost) * dt;
  else if (keys.down) v.v -= (v.v > 0 ? 520 : 150) * dt;
  else v.v -= Math.sign(v.v) * Math.min(Math.abs(v.v), 95 * dt);
  if (keys.brake) v.v -= Math.sign(v.v) * Math.min(Math.abs(v.v), 420 * dt);
  if (v.v > topSpeed) v.v -= Math.min(v.v - topSpeed, 400 * dt);
  v.v = Math.max(v.v, -90);

  const grip = Math.min(1, Math.abs(v.v) / 70) * Math.sign(v.v);
  v.a += steering() * (keys.brake ? 3.6 : 2.8) * grip * dt;

  const hit = moveCircle(v, Math.cos(v.a) * v.v * dt, Math.sin(v.a) * v.v * dt, 9, Solid.VESPA);
  const touching = hit.hitX || hit.hitY;
  if (touching && !v.touching) bump(v, before); // un urto nuovo, non lo strisciare lungo il muro
  v.touching = touching;
  let impact = 0;
  if (hit.hitX && hit.hitY) {
    if (Math.abs(v.v) > 90) impact = Math.min(10, Math.abs(v.v) / 30);
    v.v *= -0.3;
  } else if (hit.hitX || hit.hitY) {
    v.v *= Math.pow(0.35, dt);
  }
  Object.assign(player, { x: v.x, y: v.y, a: v.a });
  return impact;
}

export const kmh = (pxPerSecond) => Math.round((Math.abs(pxPerSecond) / TILE) * 2.6 * 3.6);
