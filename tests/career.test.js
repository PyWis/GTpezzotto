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

function makeCareer({ rng = seeded(1), rules = {} } = {}) {
  const pizzerias = PIZZERIAS.map((p, i) => ({ ...p, pos: [i * 1000, 0] }));
  let n = 0;
  const findAddress = () => ({ x: 5000 + 500 * n++, y: 3000, label: `Via Test ${n}` });
  const events = [];
  const career = new Career({
    pizzerias,
    menu: MENU,
    surnames: SURNAMES,
    rules: { ...RULES, ...rules },
    findAddress,
    rng,
    onEvent: (e) => events.push(e),
  });
  return { career, events };
}

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

test('pizze non consegnate: 1% a pizza di essere licenziato', () => {
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
  // P(licenziato) con 3-7 pizze perse ≈ 3-7%.
  assert.ok(fired > 3 && fired < 50, `licenziato ${fired} volte su 400`);
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
