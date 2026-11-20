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

function makeCareer({ rng = seeded(1), rules = RULES } = {}) {
  const pizzerias = PIZZERIAS.map((p, i) => ({ ...p, pos: [i * 1000, 0] }));
  let n = 0;
  const findAddress = () => ({ x: 5000 + 500 * n++, y: 3000, label: `Via Test ${n}` });
  const events = [];
  const career = new Career({
    pizzerias,
    menu: MENU,
    surnames: SURNAMES,
    rules,
    findAddress,
    rng,
    onEvent: (e) => events.push(e),
  });
  return { career, events, pizzerias };
}

const far = { x: -1e6, y: -1e6, speed: 0 };
const at = ([x, y]) => ({ x, y, speed: 0 });
const types = (events) => events.map((e) => e.type);

function hireAndStart(career) {
  career.hire(career.openings[0]);
  career.startShift();
  return career.pizzeria(career.employer);
}

test('quando è disoccupato, solo 2 pizzerie su 5 assumono', () => {
  for (let seed = 1; seed < 30; seed++) {
    const { career } = makeCareer({ rng: seeded(seed) });
    assert.equal(career.openings.length, 2);
    const hiring = PIZZERIAS.filter((p) => career.standingWith(p.id) === 'hiring');
    assert.equal(hiring.length, 2);
    const notHiring = PIZZERIAS.find((p) => !career.openings.includes(p.id));
    assert.equal(career.hire(notHiring.id), false);
  }
});

test('ogni consegna ha 3-7 pizze per 3 famiglie, massimo 4 a testa', () => {
  for (let total = 3; total <= 7; total++)
    for (let seed = 1; seed < 50; seed++) {
      const counts = splitPizzas(total, 3, 4, seeded(seed));
      assert.equal(counts.length, 3);
      assert.equal(
        counts.reduce((a, b) => a + b),
        total,
      );
      assert.ok(counts.every((c) => c >= 1 && c <= 4));
    }
  const { career } = makeCareer();
  hireAndStart(career);
  career.update(0, far);
  const [order] = career.activeOrders;
  assert.ok(order.pizzaCount >= 3 && order.pizzaCount <= 7);
  assert.equal(order.stops.length, 3);
  assert.ok(order.stops.every((s) => s.pizzas.length <= 4 && s.pizzas.every((p) => MENU.includes(p))));
});

test('una nuova consegna ogni 2 minuti e mezzo, per un turno di 20 minuti', () => {
  const { career, events } = makeCareer({ rules: { ...RULES, firingChancePerPizza: 0 } });
  hireAndStart(career);
  for (let t = 0; t < 25 * 60; t++) career.update(1, far);
  const created = events.filter((e) => e.type === 'orderCreated').map((e) => e.order.createdAt);
  assert.deepEqual(created, [0, 150, 300, 450, 600, 750, 900, 1050]);
  const end = events.find((e) => e.type === 'shiftEnded');
  assert.equal(end.reason, 'end');
  assert.equal(career.onShift, false);
  assert.equal(career.status, 'employed'); // domani si ricomincia
});

test('le consegne si sovrappongono: 3 minuti di tempo, una nuova ogni 2:30', () => {
  const { career } = makeCareer({ rules: { ...RULES, firingChancePerPizza: 0 } });
  hireAndStart(career);
  for (let t = 0; t <= 160; t++) career.update(1, far);
  assert.equal(career.activeOrders.length, 2);
});

test('paga: 10€ + 20% del consegnato + mance entro il primo minuto', () => {
  const { career, events } = makeCareer();
  const shop = hireAndStart(career);
  career.update(0.1, at(shop.pos)); // crea l'ordine e ritira le pizze
  const [order] = career.activeOrders;
  assert.ok(order.pickedUp);
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
  assert.ok(types(events).includes('pickedUp'));
});

test('niente mancia dopo il primo minuto', () => {
  const { career } = makeCareer();
  const shop = hireAndStart(career);
  career.update(0.1, at(shop.pos));
  career.update(61, at(shop.pos));
  const [order] = career.activeOrders;
  const stop = order.stops[0];
  career.update(1, at([stop.address.x, stop.address.y]));
  assert.ok(stop.delivered);
  assert.equal(stop.tip, 0);
});

test('senza ritiro in pizzeria non si consegna, e bisogna rallentare', () => {
  const { career } = makeCareer();
  const shop = hireAndStart(career);
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

test('pizze non consegnate: 1% a pizza di essere licenziato, e quella pizzeria non ti riprende più', () => {
  let firedSeen = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const { career, events } = makeCareer({ rng: seeded(seed) });
    const shop = hireAndStart(career);
    career.update(181, far); // l'ordine scade senza consegne
    if (career.status !== 'unemployed') continue;
    firedSeen++;
    assert.ok(types(events).includes('fired'));
    assert.ok(career.banned.has(shop.id));
    assert.equal(career.standingWith(shop.id), 'banned');
    assert.ok(!career.openings.includes(shop.id));
    assert.equal(career.openings.length, 2);
  }
  // P(licenziato) con 3-7 pizze perse ≈ 3-7%: su 400 tentativi ne aspettiamo una manciata.
  assert.ok(firedSeen > 3 && firedSeen < 50, `licenziato ${firedSeen} volte su 400`);
});

test('con probabilità 100% si viene sempre licenziati al primo fallimento', () => {
  const { career, events } = makeCareer({ rules: { ...RULES, firingChancePerPizza: 1 } });
  hireAndStart(career);
  career.update(181, far);
  assert.equal(career.status, 'unemployed');
  assert.equal(career.onShift, false);
  assert.deepEqual(types(events).slice(-3), ['orderClosed', 'shiftEnded', 'fired']);
  assert.equal(events.find((e) => e.type === 'shiftEnded').reason, 'fired');
});

test('chi si dimette non viene più riassunto; senza pizzerie è game over', () => {
  const { career, events } = makeCareer();
  for (let k = 0; k < 5; k++) {
    const id = career.openings[0];
    assert.ok(career.hire(id));
    assert.ok(career.quit());
    assert.equal(career.standingWith(id), 'banned');
    assert.equal(career.openings.length, Math.min(2, 4 - k));
  }
  assert.equal(career.status, 'unemployable');
  assert.ok(types(events).includes('gameOver'));
});
