// Simulazione dell'economia di Gennaro: tante partite con un fattorino "robot", usando le vere regole
// (src/game/career.js), la vera mappa (indirizzi e pizzerie) e i veri numeri (src/data/pizza.js).
//
//   node tools/sim-economia.js [--partite 200] [--giorni 15] [--profilo medio] [--extra] [--trucca] [--seed 1]
//
// Profili: principiante | medio | esperto (velocità media effettiva della Vespa, strade comprese).
// --extra: a pizzeria chiusa (dopo il 12° ordine) Gennaro fa il giro delle altre per le consegne extra.
// --trucca: appena può (1000 € di anticipo) trucca la Vespa a rate.
//
// Cosa NON simula: traffico, urti e Vespa ammaccata, la storia di Filomena (licenziamento del giorno 5,
// pizzeria propria), la missione segreta, le chiacchierate dei clienti speciali. Il percorso è in linea
// d'aria moltiplicata per un fattore di deviazione.

import { Career, OrderKind } from '../src/game/career.js';
import { at } from '../src/data/city.js';
import { MENU, PIZZERIAS, RULES, SURNAMES } from '../src/data/pizza.js';
import { VIP_CUSTOMERS } from '../src/data/vip.js';
import { findAddress } from '../src/game/addresses.js';
import { snapToWalkable } from '../src/world/map.js';

// ------------------------------------------------------------------ opzioni
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : (args[i + 1] ?? def);
};
const flag = (name) => args.includes(`--${name}`);

const PROFILI = {
  // px/s di media effettiva (la Vespa al massimo fa 330 px/s), secondi persi a ogni fermata
  principiante: { speed: 140, dwell: 4 },
  medio: { speed: 190, dwell: 3 },
  esperto: { speed: 250, dwell: 2 },
};
const PARTITE = +opt('partite', 200);
const GIORNI = +opt('giorni', 15);
const PROFILO = opt('profilo', 'medio');
const EXTRA = flag('extra');
const TRUCCA = flag('trucca');
const SEED = +opt('seed', 1);
const DETOUR = 1.4; // le strade non vanno dritte
const ARRIVE = 24; // px: arrivato
if (!PROFILI[PROFILO]) throw new Error(`profilo sconosciuto: ${PROFILO}`);
const { speed: BASE_SPEED, dwell: DWELL } = PROFILI[PROFILO];

/** mulberry32 */
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PIZZERIA_POS = new Map(PIZZERIAS.map((p) => [p.id, snapToWalkable(...at(...p.at))]));
const VIPS = VIP_CUSTOMERS.map((c) => {
  const [x, y] = snapToWalkable(...at(...c.at));
  return { name: c.name, address: { x, y, street: c.place, label: c.place } };
});

// ------------------------------------------------------------------ una partita
function partita(seed) {
  const rng = seeded(seed);
  const pizzerias = PIZZERIAS.map((p) => ({ ...p, pos: PIZZERIA_POS.get(p.id) }));
  const stats = { days: [], fired: 0, brokeDay: null, tunedDay: null, extra: 0 };
  let today = { orders: 0, missed: 0, delivered: 0 };
  const career = new Career({
    pizzerias,
    menu: MENU,
    surnames: SURNAMES,
    rules: RULES,
    findAddress,
    vips: VIPS,
    rng,
    onEvent: (e) => {
      if (e.type === 'orderClosed' && e.order.kind !== OrderKind.FOOTBALLER) {
        today.orders++;
        today.missed += e.missed;
        today.delivered += e.order.pizzaCount - e.missed;
        if (e.order.kind === OrderKind.SIDE) stats.extra++;
      }
      if (e.type === 'fired') stats.fired++;
      if (e.type === 'dayEnded') {
        stats.days.push({
          earned: e.earned,
          living: e.living,
          charges: e.charges.reduce((a, c) => a + c.amount, 0),
          wallet: e.wallet,
          ...today,
        });
        today = { orders: 0, missed: 0, delivered: 0 };
      }
      if (e.type === 'gameOver') stats.brokeDay = career.day - 1;
    },
  });

  const vespa = {};
  const me = { x: 0, y: 0, speed: 0, dwell: 0 };
  [me.x, me.y] = snapToWalkable(...at(182, 64)); // più o meno Piazza del Plebiscito

  const dist = ([x, y]) => Math.hypot(x - me.x, y - me.y);
  const nearest = (points) => points.reduce((best, p) => (!best || dist(p.pos) < dist(best.pos) ? p : best), null);

  /** Dove deve andare adesso, e cosa fare quando arriva. */
  function goal() {
    if (career.status === 'employed') {
      const open = career.activeOrders;
      const toPick = open.filter((o) => !o.pickedUp && o.kind !== OrderKind.SIDE);
      const stops = open
        .filter((o) => o.pickedUp)
        .flatMap((o) =>
          o.stops.filter((s) => !s.delivered).map((s) => ({ pos: [s.address.x, s.address.y], order: o })),
        );
      // Prima le pizze da ritirare (se in pizzeria ci sono ordini nuovi), poi le consegne, la più vicina per prima.
      if (toPick.length && (!stops.length || dist(career.job.pizzeria.pos) < 2000))
        return { pos: career.job.pizzeria.pos };
      if (stops.length) {
        // Il cliente speciale ha solo 80 s: va servito per primo.
        const urgent = stops.filter((s) => s.order.kind === OrderKind.VIP || s.order.kind === OrderKind.FOOTBALLER);
        return nearest(urgent.length ? urgent : stops);
      }
      if (toPick.length) return { pos: career.job.pizzeria.pos };
      if (EXTRA && career.closedToday) return sideJobGoal();
      return { pos: career.job.pizzeria.pos }; // torna a mani vuote: arriva un ordine anticipato
    }
    if (career.status === 'unemployed') {
      const unasked = career.pizzerias.filter((p) => career.standingWith(p.id) === 'unknown');
      const hiring = career.pizzerias.filter((p) => career.standingWith(p.id) === 'hiring');
      if (hiring.length) return { ...nearest(hiring), act: (p) => career.hire(p.id) };
      if (unasked.length) return { ...nearest(unasked), act: (p) => career.ask(p.id) };
      const side = career.activeOrders
        .filter((o) => o.kind === OrderKind.SIDE)
        .flatMap((o) => o.stops.filter((s) => !s.delivered));
      if (side.length) return { pos: [side[0].address.x, side[0].address.y] };
      return EXTRA ? sideJobGoal() : null; // nessuno assume: aspetta domani
    }
    return null;
  }

  function sideJobGoal() {
    const side = career.activeOrders.find((o) => o.kind === OrderKind.SIDE);
    if (side) {
      const s = side.stops.find((x) => !x.delivered);
      return { pos: [s.address.x, s.address.y] };
    }
    const askable = career.pizzerias.filter((p) => career.canAskSideJob(p.id));
    if (!askable.length) return null;
    return { ...nearest(askable), act: (p) => career.askSideJob(p.id) && career.takeSideJob(p.id) };
  }

  const dayLimit = GIORNI * RULES.dayLength;
  while (career.time < dayLimit && career.status !== 'broke') {
    if (TRUCCA && !career.hasTunedVespa && career.wallet >= RULES.tuning.deposit + 200) {
      career.tune(vespa, 'installments'); // si suppone che il giro all'officina costi poco
      stats.tunedDay = career.day;
    }
    const speed = BASE_SPEED * (career.isTuned(vespa) ? RULES.tuning.speed : 1);
    const g = goal();
    if (me.dwell > 0) {
      me.dwell--;
      me.speed = 0;
    } else if (g) {
      const d = dist(g.pos);
      if (d <= ARRIVE) {
        me.speed = 0;
        if (g.act) g.act(g);
      } else {
        const step = Math.min(d, speed / DETOUR);
        me.x += ((g.pos[0] - me.x) / d) * step;
        me.y += ((g.pos[1] - me.y) / d) * step;
        me.speed = step >= d ? 0 : speed;
        if (step >= d) me.dwell = DWELL; // rallenta, consegna, riparte
      }
    } else me.speed = 0;
    career.update(1, me);
  }
  if (career.status !== 'broke' && career.time >= dayLimit) career.update(0, me);
  return stats;
}

// ------------------------------------------------------------------ statistiche
const runs = Array.from({ length: PARTITE }, (_, i) => partita(SEED + i));
const fmt = (v) => `${v >= 0 ? ' ' : ''}${v.toFixed(0).padStart(6)}`;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

console.log(
  `\nNAPULE · simulazione economica — ${PARTITE} partite, ${GIORNI} giorni, profilo «${PROFILO}»` +
    (EXTRA ? ', consegne extra' : '') +
    (TRUCCA ? ', Vespa truccata a rate' : ''),
);
console.log(`(velocità media ${BASE_SPEED} px/s, deviazione ×${DETOUR}, ${DWELL} s a fermata)\n`);
console.log('giorno  vivi   guadagno  spese   portaf.(mediana)  ordini  pizze perse  in game over');
for (let d = 0; d < GIORNI; d++) {
  const alive = runs.filter((r) => r.days[d]);
  const brokeSoFar = runs.filter((r) => r.brokeDay !== null && r.brokeDay <= d + 1).length;
  if (!alive.length) {
    console.log(`${String(d + 1).padStart(4)}   ${String(0).padStart(4)}   —  tutte le partite finite`);
    break;
  }
  const day = alive.map((r) => r.days[d]);
  console.log(
    `${String(d + 1).padStart(4)}   ${String(alive.length).padStart(4)}  ${fmt(mean(day.map((x) => x.earned)))}  ${fmt(mean(day.map((x) => x.living + x.charges)))}   ${fmt(median(day.map((x) => x.wallet)))}         ${mean(
      day.map((x) => x.orders),
    )
      .toFixed(1)
      .padStart(5)}  ${mean(day.map((x) => x.missed))
      .toFixed(1)
      .padStart(8)}     ${((100 * brokeSoFar) / PARTITE).toFixed(0).padStart(5)}%`,
  );
}
const broke = runs.filter((r) => r.brokeDay !== null);
console.log(
  `\nGame over: ${broke.length}/${PARTITE} (${((100 * broke.length) / PARTITE).toFixed(0)}%)` +
    (broke.length ? `, giorno mediano ${median(broke.map((r) => r.brokeDay))}` : ''),
);
console.log(`Licenziamenti per partita: ${mean(runs.map((r) => r.fired)).toFixed(2)}`);
if (EXTRA) console.log(`Consegne extra per partita: ${mean(runs.map((r) => r.extra)).toFixed(1)}`);
if (TRUCCA) {
  const tuned = runs.filter((r) => r.tunedDay);
  console.log(
    `Vespa truccata in ${tuned.length}/${PARTITE} partite` +
      (tuned.length ? `, giorno mediano ${median(tuned.map((r) => r.tunedDay))}` : ''),
  );
}
const allDays = runs.flatMap((r) => r.days).filter((d) => d.orders);
const perOrder = mean(allDays.map((d) => d.earned / d.orders));
console.log(
  `Guadagno medio per consegna: ${perOrder.toFixed(2)} €  ·  spese medie per vivere: ${mean(RULES.livingCost).toFixed(0)} €/giorno\n`,
);
