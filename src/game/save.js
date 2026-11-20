// Salvataggio nel browser (localStorage): carriera, posizione di Gennaro e Vespe.
// Tutto è dentro try/catch: in navigazione privata il salvataggio può non esserci.

import { mount, player } from '../entities/player.js';
import { vespas } from '../entities/vespas.js';

const KEY = 'napule.save.v1';
const VERSION = 1;

/** Saves now. Skipped while riding the metro or a funicular (Gennaro is between two stations). */
export function saveGame(career) {
  if (career.status === 'broke') return clearSave(), false;
  if (player.mode !== 'foot' && player.mode !== 'vespa') return false;
  const data = {
    version: VERSION,
    savedAt: Date.now(),
    career: career.serialize(vespas),
    player: { x: player.x, y: player.y, a: player.a, mode: player.mode, vespa: vespas.indexOf(player.vespa) },
    vespas: vespas.map((v) => ({ x: v.x, y: v.y, a: v.a, condition: v.condition ?? 1 })),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** The saved game, or null. */
export function readSave() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return data?.version === VERSION && data.career ? data : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // niente da cancellare
  }
}

/** Puts a saved game back in place. Returns false if the save is unreadable. */
export function loadGame(career, data) {
  try {
    career.restore(data.career, vespas);
    data.vespas.forEach((s, i) => {
      if (vespas[i]) Object.assign(vespas[i], { x: s.x, y: s.y, a: s.a, v: 0, condition: s.condition, ridden: false });
    });
    const p = data.player;
    Object.assign(player, { x: p.x, y: p.y, a: p.a, mode: 'foot', vespa: null });
    if (p.mode === 'vespa' && vespas[p.vespa]) mount(vespas[p.vespa]);
    return true;
  } catch (err) {
    console.warn('Salvataggio non valido', err);
    clearSave();
    return false;
  }
}
