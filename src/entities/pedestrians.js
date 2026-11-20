import { pick, randRange, TAU } from '../core/math.js';
import { COMPLAINTS, HAIRS, SHIRTS, SKINS } from '../data/people.js';
import { isPedestrianArea } from '../world/map.js';
import { player } from './player.js';
import { say, tickSpeech } from './speech.js';

const POPULATION = 85;
const DESPAWN_DIST = 1200;

export const pedestrians = [];

function spawn(minDist, maxDist) {
  for (let attempt = 0; attempt < 25; attempt++) {
    const a = Math.random() * TAU;
    const r = randRange(minDist, maxDist);
    const x = player.x + Math.cos(a) * r;
    const y = player.y + Math.sin(a) * r;
    if (!isPedestrianArea(x, y)) continue;
    return {
      x,
      y,
      a: Math.random() * TAU,
      speed: randRange(22, 38),
      turnIn: Math.random() * 4,
      walk: Math.random() * 6,
      shirt: pick(SHIRTS),
      hair: pick(HAIRS),
      skin: pick(SKINS),
      down: 0, // seconds left on the ground after being hit
      flee: 0,
      say: '',
      sayT: 0,
    };
  }
  return null;
}

export function populate() {
  pedestrians.length = 0;
  for (let k = 0; k < POPULATION; k++) {
    const p = spawn(200, 1100);
    if (p) pedestrians.push(p);
  }
}

/** Returns a screen-shake amount if the Vespa ran someone over. */
export function updatePedestrians(dt) {
  const vespa = player.vespa;
  let shake = 0;

  pedestrians.forEach((p, i) => {
    if (Math.hypot(p.x - player.x, p.y - player.y) > DESPAWN_DIST) {
      pedestrians[i] = spawn(650, 1100) ?? p;
      return;
    }
    tickSpeech(p, dt);

    if (p.down > 0) {
      p.down -= dt;
      if (p.down <= 0) say(p, pick(COMPLAINTS), 2.2);
      return;
    }

    if (vespa && Math.abs(vespa.v) > 30) {
      const d = Math.hypot(p.x - vespa.x, p.y - vespa.y);
      if (d < 13) {
        p.down = 2.4;
        p.a = vespa.a;
        p.x += Math.cos(vespa.a) * 10;
        p.y += Math.sin(vespa.a) * 10;
        vespa.v *= 0.6;
        shake = 4;
        return;
      }
      if (d < 85 && Math.abs(vespa.v) > 90 && p.flee <= 0) {
        p.a = Math.atan2(p.y - vespa.y, p.x - vespa.x) + (Math.random() - 0.5);
        p.flee = 0.9;
        if (Math.random() < 0.25) say(p, pick(COMPLAINTS), 1.5);
      }
    }

    p.turnIn -= dt;
    if (p.flee > 0) p.flee -= dt;
    if (p.turnIn <= 0) {
      p.a += (Math.random() - 0.5) * 2.2;
      p.turnIn = randRange(2, 7);
    }

    const sp = p.flee > 0 ? 95 : p.speed;
    const nx = p.x + Math.cos(p.a) * sp * dt;
    const ny = p.y + Math.sin(p.a) * sp * dt;
    if (isPedestrianArea(nx + Math.cos(p.a) * 6, ny + Math.sin(p.a) * 6)) {
      p.x = nx;
      p.y = ny;
      p.walk += dt * sp * 0.17;
    } else {
      p.a += (Math.PI / 2) * (Math.random() < 0.5 ? 1 : -1) + (Math.random() - 0.5);
      p.turnIn = randRange(1, 3);
    }

    // Don't walk through Gennaro.
    if (player.mode === 'foot') {
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d > 0 && d < 11) {
        p.x += ((p.x - player.x) / d) * (11 - d);
        p.y += ((p.y - player.y) / d) * (11 - d);
      }
    }
  });
  return shake;
}

export function honkAtPedestrians(replies) {
  for (const p of pedestrians) {
    if (p.down > 0 || Math.hypot(p.x - player.x, p.y - player.y) >= 140) continue;
    if (Math.random() < 0.5) say(p, pick(replies));
  }
}
