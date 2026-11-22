// Salvataggio nel browser (localStorage): carriera, posizione di Gennaro e Vespe.
// Tutto è dentro try/catch: in navigazione privata il salvataggio può non esserci.

import { mount, player } from '../entities/player.js';
import { vespas } from '../entities/vespas.js';
import { DX, MAP_H, MAP_ID, MAP_W, OY, TILE } from '../data/city.js';
import { collides, Solid, snapToWalkable } from '../world/map.js';

// Ogni mappa ha il suo salvataggio (le coordinate non sono le stesse).
/** The shape of the map: a save made on a different layout of the same map can't trust its positions. */
const LAYOUT = `${MAP_ID}:${OY}:${DX}:${MAP_W}x${MAP_H}`;
const KEY = MAP_ID === 1 ? 'napule.save.v1' : `napule.save.mappa${MAP_ID}.v1`;
/** Kept apart from the saved game: a new game doesn't take it away. */
const BLESSING_KEY = 'napule.dio-del-calcio.v1';
const VERSION = 1;

/** Saves now. Skipped while riding the metro or a funicular (Gennaro is between two stations). */
export function saveGame(career, story) {
  if (career.status === 'broke') return clearSave(), false;
  if (player.mode !== 'foot' && player.mode !== 'vespa') return false;
  const data = {
    version: VERSION,
    layout: LAYOUT,
    savedAt: Date.now(),
    career: career.serialize(vespas),
    story: story?.serialize() ?? null,
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

/** Has Gennaro ever served the Dio del Calcio, in any game? */
export function readBlessing() {
  try {
    return localStorage.getItem(BLESSING_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveBlessing() {
  try {
    localStorage.setItem(BLESSING_KEY, '1');
  } catch {
    // senza localStorage vale solo per questa partita
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
export function loadGame(career, data, story) {
  try {
    career.restore(data.career, vespas);
    story?.restore(data.story ?? null);
    // Salvato su una versione diversa della mappa (es. prima che il centro si allargasse): la carriera resta,
    // ma Gennaro riparte da Piazza del Plebiscito e le Vespe dai loro posti.
    const sameLayout = (data.layout ?? '1:0:0:354x112') === LAYOUT;
    if (sameLayout)
      data.vespas.forEach((s, i) => {
        const v = vespas[i];
        if (!v) return;
        v.condition = s.condition;
        // Una Vespa finita dentro un palazzo resta dove l'avevano parcheggiata all'inizio.
        if (!collides(s.x, s.y, 9, Solid.VESPA)) Object.assign(v, { x: s.x, y: s.y, a: s.a, v: 0, ridden: false });
      });
    const p = data.player;
    if (sameLayout) {
      Object.assign(player, { x: p.x, y: p.y, a: p.a, mode: 'foot', vespa: null });
      if (p.mode === 'vespa' && vespas[p.vespa]) mount(vespas[p.vespa]);
    }
    // Mai dentro un muro: si riparte dal marciapiede più vicino.
    if (!player.vespa && collides(player.x, player.y, 6, Solid.FOOT))
      [player.x, player.y] = snapToWalkable(player.x / TILE, player.y / TILE);
    return true;
  } catch (err) {
    console.warn('Salvataggio non valido', err);
    clearSave();
    return false;
  }
}
