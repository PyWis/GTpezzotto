import { angleDiff, clamp, hash, pick, pointAlong, randRange } from '../core/math.js';
import { CAR_COLORS, COMPLAINTS } from '../data/people.js';
import { collides, Solid } from '../world/map.js';
import { DRIVABLE, GATES, parkingLots } from '../world/roadnet.js';
import { sfx } from '../audio.js';
import { isOnStreet, player } from './player.js';
import { bump, vespas } from './vespas.js';
import { say, tickSpeech } from './speech.js';

const FLEET = 70;
const DESPAWN_DIST = 1800;
const GLIDE_DONE = 6; // px from the lane: back on the road

export const cars = [];

// Cars that live in the car parks (drawn but not simulated).
for (const lot of parkingLots)
  for (const [k, st] of lot.stalls.entries())
    st.color = CAR_COLORS[Math.floor(hash(lot.rect[0], k, 5) * CAR_COLORS.length)];

/** Static cars in the car parks, for the renderer. */
export const parkedCars = parkingLots.flatMap((lot) =>
  lot.stalls.filter((st) => st.parked).map((st) => ({ x: st.x, y: st.y, a: st.a, color: st.color, v: 0, blocked: 0 })),
);

const roadSpeed = (road) => (road.kind === 'hwy' ? randRange(150, 210) : randRange(70, 130));

/** Where a car should be: on its road, offset into its lane. */
function laneTarget(car) {
  const [x, y, heading] = pointAlong(car.road.points, car.road.cumulative, car.s);
  const h = heading + (car.dir < 0 ? Math.PI : 0);
  const offset = car.road.kind === 'street' ? 15 : 34;
  return { x: x - Math.sin(h) * offset, y: y + Math.cos(h) * offset, a: h };
}

function newCar(road, s, dir) {
  const taxi = Math.random() < 0.14;
  return {
    road,
    s,
    dir,
    v: 0,
    topSpeed: roadSpeed(road),
    color: taxi ? '#f4f4f0' : pick(CAR_COLORS),
    taxi,
    blocked: 0, // seconds stuck behind something
    ignoreCars: 0, // seconds to ignore other cars (anti-gridlock)
    glide: false, // driving across a junction/square to the next road
    park: null, // { stall, phase: 'in' | 'wait', t }
    say: '',
    sayT: 0,
  };
}

/** A car arriving from outside town, along a road that leaves the map. */
function spawnAtGate(minDist, maxDist) {
  const near = GATES.filter((g) => {
    const d = Math.hypot(g.x - player.x, g.y - player.y);
    return d >= minDist && d <= maxDist;
  });
  if (!near.length) return null;
  const g = pick(near);
  const car = newCar(g.road, g.end ? g.road.length : 0, g.end ? -1 : 1);
  car.v = car.topSpeed * 0.8;
  return Object.assign(car, laneTarget(car));
}

function spawn(minDist, maxDist) {
  if (Math.random() < 0.25) {
    const fromOutside = spawnAtGate(minDist, maxDist + 300);
    if (fromOutside) return fromOutside;
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    const road = pick(DRIVABLE);
    const car = newCar(road, Math.random() * road.length, Math.random() < 0.5 ? 1 : -1);
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
  if (car.ignoreCars <= 0 && cars.some((o) => o !== car && !o.park && Math.hypot(o.x - ax, o.y - ay) < 24)) return true;
  return vespas.some((v) => !v.ridden && Math.hypot(v.x - ax, v.y - ay) < 22);
}

/** Returns screen shake if the player crashed into a car. */
export function updateTraffic(dt) {
  let shake = 0;
  cars.forEach((car, i) => {
    if (Math.hypot(car.x - player.x, car.y - player.y) > DESPAWN_DIST) {
      replace(i, spawn(900, 1600));
      return;
    }
    tickSpeech(car, dt);
    if (car.ignoreCars > 0) car.ignoreCars -= dt;
    if (car.park) {
      driveInCarPark(car, dt);
      shake = Math.max(shake, pushPlayerAway(car));
      return;
    }

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

    if (car.glide) {
      // Crossing a junction or a square: head straight for the lane of the next road.
      const t = laneTarget(car);
      const d = Math.hypot(t.x - car.x, t.y - car.y);
      const step = Math.max(car.v, 50) * dt;
      if (d <= Math.max(GLIDE_DONE, step)) car.glide = false;
      else {
        car.x += ((t.x - car.x) / d) * step;
        car.y += ((t.y - car.y) / d) * step;
        car.a += angleDiff(car.a, Math.atan2(t.y - car.y, t.x - car.x)) * (1 - Math.exp(-dt * 8));
      }
    } else {
      car.s += car.v * car.dir * dt;
      if (car.s < 0 || car.s > car.road.length) {
        const gone = reachEnd(car, car.s < 0 ? 0 : 1);
        if (gone) {
          // Out of town: someone else drives in.
          replace(i, spawnAtGate(300, 1700) ?? spawn(900, 1600));
          return;
        }
      }
      if (!car.glide && !car.park) {
        const t = laneTarget(car);
        const k = 1 - Math.exp(-dt * 7);
        car.x += (t.x - car.x) * k;
        car.y += (t.y - car.y) * k;
        car.a += angleDiff(car.a, t.a) * k;
      }
    }

    shake = Math.max(shake, pushPlayerAway(car));
  });
  for (const car of parkedCars)
    if (Math.abs(car.x - player.x) < 40 && Math.abs(car.y - player.y) < 40)
      shake = Math.max(shake, pushPlayerAway(car));
  return shake;
}

function replace(i, next) {
  const old = cars[i];
  if (old.park) old.park.stall.car = null;
  if (next) cars[i] = next;
  else {
    // Nowhere to respawn right now: park it far away (it will be retried next frame).
    old.park = null;
    old.glide = false;
  }
}

/**
 * The car got to the end of its road. Returns true if it left the map.
 * Otherwise it turns into a connecting road, pulls into the car park, or (last resort) turns around.
 */
function reachEnd(car, end) {
  const info = car.road.ends[end];
  car.s = end ? car.road.length : 0;
  if (info.exit) return true;
  if (info.links.length) {
    const link = pick(info.links);
    car.road = link.road;
    car.s = link.s;
    car.dir = pick(link.dirs);
    car.topSpeed = roadSpeed(link.road);
    car.glide = true;
    return false;
  }
  if (info.parking >= 0) {
    const free = parkingLots[info.parking].stalls.filter((st) => !st.parked && !st.car);
    if (free.length) {
      const stall = pick(free);
      stall.car = car;
      car.park = { stall, phase: 'in', t: randRange(8, 30), end };
      return false;
    }
  }
  car.dir = end ? -1 : 1;
  return false;
}

/** In the car park: drive into the stall, wait, then back out onto the road. */
function driveInCarPark(car, dt) {
  const { park } = car;
  const { stall } = park;
  if (park.phase === 'in') {
    const d = Math.hypot(stall.x - car.x, stall.y - car.y);
    const step = 45 * dt;
    if (d <= step) {
      Object.assign(car, { x: stall.x, y: stall.y, v: 0 });
      park.phase = 'wait';
    } else {
      car.x += ((stall.x - car.x) / d) * step;
      car.y += ((stall.y - car.y) / d) * step;
      car.v = 45;
    }
    const want = d > 12 ? Math.atan2(stall.y - car.y, stall.x - car.x) : stall.a;
    car.a += angleDiff(car.a, want) * (1 - Math.exp(-dt * 5));
    return;
  }
  park.t -= dt;
  car.a += angleDiff(car.a, stall.a) * (1 - Math.exp(-dt * 5));
  if (park.t > 0) return;
  // Leave: back to the road, heading the other way.
  stall.car = null;
  car.park = null;
  car.dir = park.end ? -1 : 1;
  car.s = park.end ? car.road.length : 0;
  car.v = 20;
  car.glide = true;
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
  bump(v, v.v);
  if (Math.abs(v.v) > 80) {
    shake = Math.min(10, Math.abs(v.v) / 28);
    say(car, pick(COMPLAINTS), 1.8);
  }
  v.v *= -0.3;
  player.x = v.x;
  player.y = v.y;
  return shake;
}
