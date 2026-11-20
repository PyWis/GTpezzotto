import { angleDiff, clamp, pick, pointAlong, randRange } from '../core/math.js';
import { ROADS } from '../data/city.js';
import { CAR_COLORS, COMPLAINTS } from '../data/people.js';
import { collides, Solid } from '../world/map.js';
import { sfx } from '../audio.js';
import { isOnStreet, player } from './player.js';
import { vespas } from './vespas.js';
import { say, tickSpeech } from './speech.js';

const FLEET = 70;
const DESPAWN_DIST = 1800;
const DRIVABLE = ROADS.filter((r) => r.kind !== 'vicolo');

export const cars = [];

/** Where a car should be: on its road, offset into its lane. */
function laneTarget(car) {
  const [x, y, heading] = pointAlong(car.road.points, car.road.cumulative, car.s);
  const h = heading + (car.dir < 0 ? Math.PI : 0);
  const offset = car.road.kind === 'street' ? 15 : 34;
  return { x: x - Math.sin(h) * offset, y: y + Math.cos(h) * offset, a: h };
}

function spawn(minDist, maxDist) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const road = pick(DRIVABLE);
    const taxi = Math.random() < 0.14;
    const car = {
      road,
      s: Math.random() * road.length,
      dir: Math.random() < 0.5 ? 1 : -1,
      v: 0,
      topSpeed: road.kind === 'hwy' ? randRange(150, 210) : randRange(70, 130),
      color: taxi ? '#f4f4f0' : pick(CAR_COLORS),
      taxi,
      blocked: 0, // seconds stuck behind something
      ignoreCars: 0, // seconds to ignore other cars (anti-gridlock)
      say: '',
      sayT: 0,
    };
    const t = laneTarget(car);
    const d = Math.hypot(t.x - player.x, t.y - player.y);
    if (d >= minDist && d <= maxDist) return Object.assign(car, t);
  }
  return null;
}

export function populate() {
  cars.length = 0;
  for (let k = 0; k < FLEET; k++) {
    const c = spawn(120, 1700);
    if (c) cars.push(c);
  }
}

function somethingAhead(car) {
  const ax = car.x + Math.cos(car.a) * 30;
  const ay = car.y + Math.sin(car.a) * 30;
  if (isOnStreet() && Math.hypot(player.x - ax, player.y - ay) < 26) return true;
  if (car.ignoreCars <= 0 && cars.some((o) => o !== car && Math.hypot(o.x - ax, o.y - ay) < 24)) return true;
  return vespas.some((v) => !v.ridden && Math.hypot(v.x - ax, v.y - ay) < 22);
}

/** Returns screen shake if the player crashed into a car. */
export function updateTraffic(dt) {
  let shake = 0;
  cars.forEach((car, i) => {
    if (Math.hypot(car.x - player.x, car.y - player.y) > DESPAWN_DIST) {
      cars[i] = spawn(900, 1600) ?? car;
      return;
    }
    tickSpeech(car, dt);
    if (car.ignoreCars > 0) car.ignoreCars -= dt;

    const stop = somethingAhead(car);
    if (stop) {
      car.blocked += dt;
      if (car.blocked > 2.2) {
        car.blocked = 0;
        if (Math.hypot(player.x - car.x, player.y - car.y) < 120) {
          say(car, 'Pìììì!', 1.2);
          if (Math.random() < 0.5) sfx.carHorn();
        } else {
          car.ignoreCars = 1.5;
        }
      }
    } else {
      car.blocked = 0;
    }
    car.v += clamp((stop ? 0 : car.topSpeed) - car.v, -320 * dt, 110 * dt);

    // Advance along the road; at the end, turn around.
    car.s += car.v * car.dir * dt;
    if (car.s < 0) [car.s, car.dir] = [0, 1];
    if (car.s > car.road.length) [car.s, car.dir] = [car.road.length, -1];
    const t = laneTarget(car);
    const k = 1 - Math.exp(-dt * 7);
    car.x += (t.x - car.x) * k;
    car.y += (t.y - car.y) * k;
    car.a += angleDiff(car.a, t.a) * k;

    shake = Math.max(shake, pushPlayerAway(car));
  });
  return shake;
}

function pushPlayerAway(car) {
  const body = player.vespa ?? (player.mode === 'foot' ? player : null);
  if (!body) return 0;
  const reach = player.vespa ? 20 : 17;
  const d = Math.hypot(body.x - car.x, body.y - car.y);
  if (d === 0 || d >= reach) return 0;

  const nx = (body.x - car.x) / d;
  const ny = (body.y - car.y) / d;
  const solid = player.vespa ? Solid.VESPA : Solid.FOOT;
  if (!collides(car.x + nx * reach, car.y + ny * reach, player.vespa ? 9 : 6, solid)) {
    body.x = car.x + nx * reach;
    body.y = car.y + ny * reach;
  }
  if (!player.vespa) return 0;

  const v = player.vespa;
  let shake = 0;
  if (Math.abs(v.v) > 80) {
    shake = Math.min(10, Math.abs(v.v) / 28);
    say(car, pick(COMPLAINTS), 1.8);
  }
  v.v *= -0.3;
  player.x = v.x;
  player.y = v.y;
  return shake;
}
