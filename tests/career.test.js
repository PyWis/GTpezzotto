import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Career, splitPizzas, orderValue, DELIVERY_RANGE } from '../src/game/career.js';
import { MENU, PIZZERIAS, RULES, SURNAMES } from '../src/data/pizza.js';

/** Seeded RNG (mulberry32) so every run is reproducible. */
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCareer({ rng = seeded(1), rules = {}, addressCalls = [], blessed = false } = {}) {
  const pizzerias = PIZZERIAS.map((p, i) => ({ ...p, pos: [i * 1000, 0] }));
  let n = 0;
  const findAddress = (r, avoid, options) => {
    addressCalls.push(options);
    return { x: 5000 + 500 * n++, y: 3000, label: `Via Test ${n}` };
  };
  const events = [];
  const career = new Career({
    pizzerias,
    menu: MENU,
    surnames: SURNAMES,
    rules: { ...RULES, ...rules },
    findAddress,
    stadium: STADIUM,
    blessed,
    rng,
    onEvent: (e) => events.push(e),
  });
  return { career, events };
}

const STADIUM = { x: 77777, y: 4444, label: 'Stadio, centrocampo' };
const far = { x: -1e6, y: -1e6, speed: 0 };
const at = ([x, y]) => ({ x, y, speed: 0 });
const types = (events) => events.map((e) => e.type);
const ofType = (events, type) => events.filter((e) => e.type === type);

/** Passes `seconds` one second at a time, with Gennaro at `where`. */
function wait(career, seconds, where = far) {
  for (let t = 0; t < seconds; t++) career.update(1, where);
}

function hire(career) {
  const id = career.openings[0];
  assert.ok(career.hire(id));
  return career.pizzeria(id);
}

function deliverAll(career, order) {
  for (const stop of order.stops) career.update(1, at([stop.address.x, stop.address.y]));
}

// ------------------------------------------------------------------ hiring

test('chi assume è segreto: bisogna chiedere in pizzeria, e 2 su 5 dicono sì', () => {
  for (let seed = 1; seed < 30; seed++) {
    const { career } = makeCareer({ rng: seeded(seed) });
    assert.ok(PIZZERIAS.every((p) => career.standingWith(p.id) === 'unknown'));
    const answers = PIZZERIAS.map((p) => career.ask(p.id));
    assert.equal(answers.filter((a) => a === 'hiring').length, 2);
    assert.equal(answers.filter((a) => a === 'notHiring').length, 3);
    const no = PIZZERIAS.find((p, i) => answers[i] === 'notHiring');
    assert.equal(career.hire(no.id), false);
  }
});

test('ogni giorno cambia chi assume, e le risposte vanno richieste', () => {
  const { career } = makeCareer({ rng: seeded(7), rules: { livingCost: [0, 0] } });
  career.ask(PIZZERIAS[0].id);
  const seen = new Set();
  for (let d = 0; d < 10; d++) {
    seen.add(career.openings.join());
    wait(career, RULES.dayLength);
    assert.equal(career.standingWith(PIZZERIAS[0].id), 'unknown');
  }
  assert.ok(seen.size > 1);
});

test('chi se ne va non viene riassunto per 10 giorni, poi potrebbe', () => {
  const { career, events } = makeCareer({ rng: seeded(3), rules: { livingCost: [0, 0] } });
  const shop = hire(career);
  career.quit();
  assert.equal(ofType(events, 'quit')[0].rehireDay, 11);
  let reopened = null;
  for (let day = 1; day <= 40; day++) {
    assert.equal(career.day, day);
    if (day < 11) {
      assert.equal(career.standingWith(shop.id), 'banned');
      assert.ok(!career.openings.includes(shop.id));
      assert.equal(career.hire(shop.id), false);
    } else if (career.openings.includes(shop.id)) {
      reopened = day;
      break;
    }
    wait(career, RULES.dayLength);
  }
  assert.ok(reopened >= 11, `riassume dal giorno ${reopened}`);
  assert.ok(career.hire(shop.id));
});

// ------------------------------------------------------------------ orders

test('ogni consegna ha 3-7 pizze per 3 famiglie, massimo 4 a testa', () => {
  for (let total = 3; total <= 7; total++)
    for (let seed = 1; seed < 50; seed++) {
      const counts = splitPizzas(total, 3, 4, seeded(seed));
      assert.equal(
        counts.reduce((a, b) => a + b),
        total,
      );
      assert.ok(counts.every((c) => c >= 1 && c <= 4));
    }
  const { career } = makeCareer();
  hire(career);
  career.update(0, far);
  const [order] = career.activeOrders;
  assert.ok(order.pizzaCount >= 3 && order.pizzaCount <= 7);
  assert.equal(order.stops.length, 3);
  assert.ok(order.stops.every((s) => s.pizzas.length <= 4 && s.pizzas.every((p) => MENU.includes(p))));
});

test('lontano dalla pizzeria arriva un ordine ogni 2:30', () => {
  const { career, events } = makeCareer({ rules: { firingChancePerPizza: 0 } });
  hire(career);
  wait(career, 1199);
  const created = ofType(events, 'orderCreated').map((e) => e.order.createdAt);
  assert.deepEqual(created, [1, 151, 301, 451, 601, 751, 901, 1051]);
});

test('tornando in pizzeria dopo le consegne, il nuovo ordine arriva dopo 5-15 secondi', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { career, events } = makeCareer({ rng: seeded(seed) });
    const shop = hire(career);
    career.update(0.1, at(shop.pos)); // primo ordine, ritirato subito
    deliverAll(career, career.activeOrders[0]);
    assert.equal(career.activeOrders.length, 0);
    const back = career.time;
    career.update(0.1, at(shop.pos));
    const early = ofType(events, 'earlyOrder');
    assert.equal(early.length, 1);
    assert.ok(early[0].in >= 5 && early[0].in <= 15, `tra ${early[0].in}s`);
    wait(career, 20, at(shop.pos));
    const second = ofType(events, 'orderCreated')[1].order;
    const delay = second.createdAt - back;
    assert.ok(delay >= 5 && delay <= 16, `nuovo ordine dopo ${delay}s`);
    assert.ok(second.pickedUp, 'ritirato perché Gennaro è già in pizzeria');
  }
});

test('senza ritiro in pizzeria non si consegna, e bisogna rallentare', () => {
  const { career } = makeCareer();
  const shop = hire(career);
  career.update(0.1, far);
  const [order] = career.activeOrders;
  const door = order.stops[0].address;
  career.update(1, at([door.x, door.y]));
  assert.equal(order.stops[0].delivered, false);
  career.update(1, at(shop.pos));
  career.update(1, { x: door.x, y: door.y + DELIVERY_RANGE / 2, speed: 300 });
  assert.equal(order.stops[0].delivered, false);
  career.update(1, { x: door.x, y: door.y, speed: 20 });
  assert.equal(order.stops[0].delivered, true);
});

// ------------------------------------------------------------------ money

test('paga: 10€ + 20% del consegnato + mance entro il primo minuto', () => {
  const { career } = makeCareer();
  const shop = hire(career);
  career.update(0.1, at(shop.pos));
  const [order] = career.activeOrders;
  for (const stop of order.stops) career.update(5, at([stop.address.x, stop.address.y]));

  assert.equal(order.state, 'done');
  const value = order.stops.reduce((a, s) => a + orderValue(s), 0);
  const tips = order.stops.reduce((a, s) => a + s.tip, 0);
  for (const s of order.stops) {
    const v = orderValue(s);
    assert.ok(s.tip >= v * 0.05 - 0.01 && s.tip <= v * 0.2 + 0.01, `mancia ${s.tip} su ${v}`);
  }
  assert.equal(order.pay.base, 10);
  assert.ok(Math.abs(order.pay.commission - value * 0.2) < 0.01);
  assert.ok(Math.abs(order.pay.total - (10 + value * 0.2 + tips)) < 0.02);
  assert.equal(career.wallet, order.pay.total);
});

test('la mancia si calcola su ogni singola consegna: il minuto riparte dopo ogni famiglia', () => {
  const { career } = makeCareer({ rules: { pizzasPerOrder: [3, 3] } });
  const shop = hire(career);
  career.update(0.1, at(shop.pos));
  const [order] = career.activeOrders;
  const [a, b, c] = order.stops;
  career.update(50, far);
  career.update(1, at([a.address.x, a.address.y])); // 51 s dal ritiro
  career.update(50, far);
  career.update(1, at([b.address.x, b.address.y])); // 51 s dalla prima, 102 s dal ritiro
  career.update(65, far);
  career.update(1, at([c.address.x, c.address.y])); // 66 s dalla seconda
  assert.ok(a.tip > 0 && b.tip > 0, 'mancia per le prime due famiglie');
  assert.equal(c.tip, 0, 'la terza è arrivata dopo più di un minuto');
  assert.equal(order.state, 'done');
});

test('niente mancia dopo il primo minuto', () => {
  const { career } = makeCareer();
  const shop = hire(career);
  career.update(0.1, at(shop.pos));
  career.update(61, at(shop.pos));
  const [order] = career.activeOrders;
  const stop = order.stops[0];
  career.update(1, at([stop.address.x, stop.address.y]));
  assert.ok(stop.delivered);
  assert.equal(stop.tip, 0);
});

test('i 10€ fissi si pagano solo se qualcosa è stato consegnato', () => {
  const { career } = makeCareer({ rules: { firingChancePerPizza: 0 } });
  const shop = hire(career);
  career.update(0.1, at(shop.pos));
  career.update(181, far);
  const [closed] = career.ledger.orders;
  assert.equal(closed.state, 'failed');
  assert.deepEqual([closed.pay.base, closed.pay.total], [0, 0]);
  assert.equal(career.wallet, 0);

  // Una sola famiglia servita: il fisso c'è.
  const order = career.activeOrders[0] ?? (career.update(150, far), career.activeOrders[0]);
  career.update(1, at(shop.pos));
  career.update(1, at([order.stops[0].address.x, order.stops[0].address.y]));
  career.update(200, far);
  assert.equal(order.pay.base, 10);
});

test('pizze non consegnate: 5% a pizza di essere licenziato', () => {
  let fired = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const { career, events } = makeCareer({ rng: seeded(seed) });
    const shop = hire(career);
    career.update(0.1, far);
    career.update(181, far);
    if (career.status !== 'unemployed') continue;
    fired++;
    assert.ok(types(events).includes('fired'));
    assert.equal(career.standingWith(shop.id), 'banned');
  }
  // P(licenziato) con 3-7 pizze perse ≈ 14-30%.
  assert.equal(RULES.firingChancePerPizza, 0.05);
  assert.ok(fired > 50 && fired < 130, `licenziato ${fired} volte su 400`);
});

test('ogni giorno Gennaro spende 100-200€ per vivere', () => {
  const { career, events } = makeCareer({ rng: seeded(5), rules: { maxDaysInRed: 99 } });
  career.wallet = 1000;
  wait(career, RULES.dayLength * 5);
  const days = ofType(events, 'dayEnded');
  assert.equal(days.length, 5);
  for (const d of days) assert.ok(d.living >= 100 && d.living <= 200, `spesa ${d.living}`);
  const spent = days.reduce((a, d) => a + d.living, 0);
  assert.ok(Math.abs(career.wallet - (1000 - spent)) < 0.01);
});

test('3 giorni di fila sotto zero: game over; tornare in positivo azzera il conto', () => {
  const { career, events } = makeCareer({ rng: seeded(9) });
  wait(career, RULES.dayLength * 2);
  assert.equal(career.daysInRed, 2);
  career.wallet += 1000; // un colpo di fortuna
  wait(career, RULES.dayLength);
  assert.equal(career.daysInRed, 0);
  assert.equal(career.status, 'unemployed');

  career.wallet = -1;
  wait(career, RULES.dayLength * 3);
  assert.equal(career.status, 'broke');
  assert.equal(ofType(events, 'gameOver').length, 1);
  assert.equal(ofType(events, 'gameOver')[0].reason, 'broke');
  wait(career, RULES.dayLength * 2);
  assert.equal(ofType(events, 'dayEnded').length, 6, 'il tempo si ferma col game over');
});

// ------------------------------------------------------------------ side jobs

test('le altre pizzerie hanno una consegna extra una volta su quattro', () => {
  let yes = 0;
  const tries = 400;
  for (let seed = 1; seed <= tries; seed++) {
    const { career } = makeCareer({ rng: seeded(seed) });
    if (career.askSideJob(PIZZERIAS[0].id)) yes++;
    assert.equal(career.canAskSideJob(PIZZERIAS[0].id), false, 'non si può richiedere subito');
  }
  assert.ok(yes > tries * 0.17 && yes < tries * 0.33, `${yes} sì su ${tries}`);
});

test('consegna extra: una famiglia, 5 pizze, ad almeno metà mappa; non fa licenziare', () => {
  const addressCalls = [];
  const { career } = makeCareer({ addressCalls, rules: { firingChancePerPizza: 1 } });
  const shop = hire(career);
  career.job.nextOrderAt = Infinity; // solo la consegna extra, niente ordini del datore di lavoro
  const other = PIZZERIAS.find((p) => p.id !== shop.id);
  assert.equal(career.canAskSideJob(shop.id), false, 'non dal proprio datore di lavoro');
  career.update(0.1, far);
  const order = career.takeSideJob(other.id);
  assert.equal(order.kind, 'side');
  assert.equal(order.stops.length, 1);
  assert.equal(order.pizzaCount, 5);
  assert.ok(order.pickedUp, 'le pizze si ritirano al bancone');
  assert.equal(addressCalls.at(-1).minDist, RULES.sideJob.minDistance);
  assert.ok(RULES.sideJob.minDistance >= (354 * 32) / 2);
  assert.equal(career.canAskSideJob(PIZZERIAS.at(-1).id), false, 'una consegna extra alla volta');

  career.update(RULES.sideJob.time + 1, far); // persa
  assert.equal(order.state, 'failed');
  assert.equal(order.missed, 5);
  assert.equal(career.employer, shop.id, 'il datore di lavoro non ne sa niente');
});

test('consegna extra pagata il doppio di una normale, anche da disoccupato', () => {
  const { career } = makeCareer();
  const order = career.takeSideJob(PIZZERIAS[2].id);
  const [stop] = order.stops;
  career.update(10, far);
  career.update(1, at([stop.address.x, stop.address.y]));
  assert.equal(order.state, 'done');
  assert.ok(stop.tip > 0);
  assert.ok(Math.abs(order.pay.total - 2 * (10 + orderValue(stop) * 0.2 + stop.tip)) < 0.02);
  assert.equal(career.status, 'unemployed');
});

// ------------------------------------------------------------------ footballer

function footballerCareer(extra = {}) {
  const rules = { ...RULES, footballer: { ...RULES.footballer, chance: 1 }, ...extra };
  return makeCareer({ rules });
}

test('il calciatore del Napoli: 1 pizza, 90 secondi, gratis', () => {
  const { career, events } = footballerCareer();
  const shop = hire(career);
  career.update(0.1, at(shop.pos));
  const [order] = career.activeOrders;
  assert.equal(order.kind, 'footballer');
  assert.equal(order.pizzaCount, 1);
  assert.equal(order.deadline - order.createdAt, 90);
  career.update(1, at([order.stops[0].address.x, order.stops[0].address.y]));
  assert.equal(order.state, 'done');
  assert.equal(order.pay.total, 0, 'la pizza è gratis');
  assert.equal(career.payMultiplier, 1.2);
  assert.equal(ofType(events, 'boost').length, 1);
});

test('bonus del calciatore: +20% per 2 giorni, si accumula, poi finisce', () => {
  const { career } = footballerCareer({ firingChancePerPizza: 0, livingCost: [0, 0] });
  const shop = hire(career);
  for (let k = 0; k < 2; k++) {
    career.job.nextOrderAt = career.time;
    career.update(0.1, at(shop.pos));
    const order = career.activeOrders.find((o) => o.kind === 'footballer');
    career.update(1, at([order.stops[0].address.x, order.stops[0].address.y]));
  }
  assert.ok(Math.abs(career.payMultiplier - 1.4) < 1e-9, 'due bonus: +40%');
  assert.equal(career.boostUntil, 3 * RULES.dayLength, 'fino alla fine del giorno 3');

  // Un ordine normale ora paga il 40% in più.
  career.rules = { ...career.rules, footballer: { ...career.rules.footballer, chance: 0 } };
  career.job.nextOrderAt = career.time;
  career.update(0.1, at(shop.pos));
  const order = career.activeOrders.find((o) => o.kind === 'regular');
  for (const stop of order.stops) career.update(1, at([stop.address.x, stop.address.y]));
  const base = order.pay.base + order.pay.commission + order.pay.tips;
  assert.ok(Math.abs(order.pay.bonus - base * 0.4) < 0.02);
  assert.ok(Math.abs(order.pay.total - base * 1.4) < 0.02);

  wait(career, 3 * RULES.dayLength - career.time + 1);
  assert.equal(career.payMultiplier, 1, 'il bonus è scaduto');
});

test('calciatore senza pizza: niente bonus', () => {
  const { career } = footballerCareer({ firingChancePerPizza: 0 });
  hire(career);
  career.update(0.1, far);
  career.update(91, far);
  assert.equal(career.payMultiplier, 1);
  assert.equal(career.ledger.orders[0].kind, 'footballer');
  assert.equal(career.ledger.orders[0].state, 'failed');
});

test('di norma il calciatore chiama nel 4% degli ordini', () => {
  let footballers = 0;
  let total = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const { career, events } = makeCareer({
      rng: seeded(seed),
      rules: { firingChancePerPizza: 0, livingCost: [0, 0] },
    });
    hire(career);
    wait(career, RULES.dayLength * 3);
    const created = ofType(events, 'orderCreated');
    total += created.length;
    footballers += created.filter((e) => e.order.kind === 'footballer').length;
  }
  const rate = footballers / total;
  assert.equal(RULES.footballer.chance, 0.04);
  assert.ok(rate > 0.015 && rate < 0.08, `${footballers} calciatori su ${total} ordini`);
});

// ------------------------------------------------------------------ officina

test("l'officina di Fuorigrotta modifica la Vespa per 1000€", () => {
  const { career } = makeCareer();
  const vespa = {};
  career.wallet = 999;
  assert.equal(career.tune(vespa), false, 'non bastano i soldi');
  career.wallet = 1500;
  assert.equal(career.tune(vespa), true);
  assert.equal(career.wallet, 500);
  assert.ok(career.isTuned(vespa));
  assert.equal(career.tune(vespa), false, 'già modificata');
  assert.equal(RULES.tuning.speed, 1.2);
});

// ------------------------------------------------------------------ officina di Via Gianturco

test('la riparazione a Via Gianturco costa 3€ per ogni punto perso e riporta la Vespa al 100%', () => {
  const { career, events } = makeCareer();
  const vespa = { condition: 0.9 };
  assert.equal(career.repairCost(vespa), 30);
  assert.equal(career.repairCost({ condition: 1 }), 0);
  assert.equal(career.repairCost({}), 0, 'una Vespa mai urtata è nuova');
  career.wallet = 29;
  assert.equal(career.repair(vespa), false, 'non bastano i soldi');
  career.wallet = 100;
  assert.equal(career.repair(vespa), true);
  assert.equal(vespa.condition, 1);
  assert.equal(career.wallet, 70);
  assert.equal(career.repair(vespa), false, 'niente da riparare');
  assert.equal(ofType(events, 'repaired').length, 1);
});

// ------------------------------------------------------------------ missione segreta

const DAY10 = (RULES.legend.day - 1) * RULES.dayLength;

test('missione segreta: giorno 10, dopo 10 minuti, una pizza per il Dio del Calcio allo stadio', () => {
  const { career } = makeCareer({ rules: { livingCost: [0, 0], maxDaysInRed: 99 } });
  career.update(DAY10 + RULES.legend.after - 1, far);
  assert.equal(career.activeOrders.length, 0, 'non prima dei 10 minuti');
  career.update(2, far);
  const [order] = career.activeOrders;
  assert.equal(order.kind, 'legend');
  assert.equal(order.pizzaCount, 1);
  assert.equal(order.stops[0].family, RULES.legend.name);
  assert.equal(order.stops[0].address, STADIUM);
  assert.equal(order.pizzeria.id, RULES.legend.pizzeria, 'da disoccupato si ritira vicino allo stadio');

  career.update(1, at(order.pizzeria.pos));
  assert.ok(order.pickedUp);
  career.update(1, at([STADIUM.x, STADIUM.y]));
  assert.equal(order.state, 'done');
  assert.equal(order.stops[0].tip, 115, 'mancia extra di 115€');
  assert.ok(Math.abs(order.pay.total - (10 + orderValue(order.stops[0]) * 0.2 + 115)) < 0.02);

  wait(career, RULES.dayLength, far);
  assert.equal(career.orders.filter((o) => o.kind === 'legend').length, 0, 'una volta sola');
});

test('missione segreta: da assunto arriva dal proprio datore di lavoro, e perderla non fa licenziare', () => {
  const { career } = makeCareer({ rules: { livingCost: [0, 0], maxDaysInRed: 99, firingChancePerPizza: 1 } });
  career.time = DAY10 + RULES.legend.after - 1;
  career.ledger.day = RULES.legend.day;
  career.rollOpenings();
  const shop = hire(career);
  career.job.nextOrderAt = Infinity;
  career.update(2, far);
  const order = career.activeOrders.find((o) => o.kind === 'legend');
  assert.equal(order.pizzeria, shop);
  career.update(RULES.legend.time + 1, far);
  assert.equal(order.state, 'failed');
  assert.equal(career.employer, shop.id);
});

test('missione segreta: niente negli altri giorni', () => {
  const { career } = makeCareer({ rules: { livingCost: [0, 0], maxDaysInRed: 99 } });
  wait(career, DAY10 - 1, far);
  assert.equal(career.legendFired, false);
  career.time = RULES.legend.day * RULES.dayLength + RULES.legend.after; // giorno 11
  career.ledger.day = RULES.legend.day + 1;
  career.update(1, far);
  assert.equal(career.legendFired, false);
});

// ------------------------------------------------------------------ salvataggio

test('salvataggio: la carriera si ricostruisce identica, ordini in corso compresi', () => {
  const { career } = makeCareer({ rng: seeded(3) });
  const shop = hire(career);
  career.update(0.1, at(shop.pos)); // primo ordine, ritirato
  career.wallet = 1234.5;
  career.bannedUntil.set('ferrovia', 12);
  const vespas = [{}, {}, {}];
  career.tunedVespas.add(vespas[1]);
  const json = JSON.parse(JSON.stringify(career.serialize(vespas)));

  const { career: copy } = makeCareer({ rng: seeded(4) });
  copy.restore(json, vespas);
  assert.equal(copy.status, 'employed');
  assert.equal(copy.employer, shop.id);
  assert.equal(copy.job.pizzeria, copy.pizzeria(shop.id));
  assert.equal(copy.wallet, 1234.5);
  assert.equal(copy.time, career.time);
  assert.ok(copy.isBanned('ferrovia'));
  assert.ok(copy.isTuned(vespas[1]) && !copy.isTuned(vespas[0]));
  const [order] = copy.activeOrders;
  assert.ok(order.pickedUp);
  assert.equal(order.pizzeria, copy.pizzeria(shop.id));

  // E si continua a giocare: le consegne funzionano.
  for (const stop of order.stops) copy.update(1, at([stop.address.x, stop.address.y]));
  assert.equal(order.state, 'done');
  assert.equal(copy.ledger.orders.at(-1), order);
});

// ------------------------------------------------------------------ maglia azzurra

test('servire il Dio del Calcio fa diventare Gennaro "benedetto"', () => {
  const { career, events } = makeCareer({ rules: { livingCost: [0, 0], maxDaysInRed: 99 } });
  assert.equal(career.blessed, false);
  career.update(DAY10 + RULES.legend.after + 1, far);
  const order = career.activeOrders.find((o) => o.kind === 'legend');
  career.update(1, at(order.pizzeria.pos));
  career.update(1, at([STADIUM.x, STADIUM.y]));
  assert.equal(career.blessed, true);
  assert.equal(ofType(events, 'blessed').length, 1);
});

test('da benedetto ogni calciatore dà 10€ in più (oltre al bonus), e vale anche in una partita nuova', () => {
  for (const blessed of [false, true]) {
    const rules = { ...RULES, footballer: { ...RULES.footballer, chance: 1 } };
    const { career } = makeCareer({ rules, blessed });
    const shop = hire(career);
    career.update(0.1, at(shop.pos));
    const [order] = career.activeOrders;
    career.update(1, at([order.stops[0].address.x, order.stops[0].address.y]));
    assert.equal(order.state, 'done');
    assert.equal(order.pay.total, blessed ? 10 : 0);
    assert.equal(career.payMultiplier, 1.2, 'il bonus normale resta');
  }
});
