// La carriera di Gennaro: assunzioni, turni, consegne e licenziamenti.
// Logica pura, senza DOM né canvas: riceve il tempo e la posizione del
// fattorino e notifica ciò che succede tramite `onEvent`.

import { randInt, randRange, shuffle, pick } from '../core/math.js';

const round2 = (v) => Math.round(v * 100) / 100;
const sum = (list, fn) => list.reduce((acc, x) => acc + fn(x), 0);

export const PICKUP_RANGE = 48; // px dalla porta della pizzeria
export const DELIVERY_RANGE = 44; // px dal portone del cliente
export const MAX_HANDOFF_SPEED = 110; // px/s: per consegnare bisogna rallentare

/** Split `total` pizzas among `families`, each getting at least 1 and at most `max`. */
export function splitPizzas(total, families, max, rng = Math.random) {
  if (total < families || total > families * max) throw new RangeError(`can't split ${total} pizzas`);
  const counts = Array(families).fill(1);
  for (let left = total - families; left > 0; left--) {
    const open = counts.map((c, i) => (c < max ? i : -1)).filter((i) => i >= 0);
    counts[pick(open, rng)]++;
  }
  return counts;
}

export const orderValue = (order) => round2(sum(order.pizzas, (p) => p.prezzo));

export class Career {
  constructor({ pizzerias, menu, surnames, rules, findAddress, rng = Math.random, onEvent = () => {} }) {
    Object.assign(this, { pizzerias, menu, surnames, rules, findAddress, rng, onEvent });
    this.status = 'unemployed'; // unemployed | employed | unemployable
    this.employer = null;
    this.banned = new Set(); // pizzerie che non ti riprenderanno mai
    this.openings = [];
    this.wallet = 0;
    this.day = 0;
    this.shift = null;
    this.rollOpenings();
  }

  // ---------------------------------------------------------------- hiring
  pizzeria(id) {
    return this.pizzerias.find((p) => p.id === id);
  }

  rollOpenings() {
    const candidates = this.pizzerias.filter((p) => !this.banned.has(p.id)).map((p) => p.id);
    this.openings = shuffle(candidates, this.rng).slice(0, this.rules.openings);
    if (!candidates.length) this.status = 'unemployable';
  }

  /** What a pizzeria thinks of Gennaro right now. */
  standingWith(id) {
    if (this.employer === id) return 'employer';
    if (this.banned.has(id)) return 'banned';
    if (this.status === 'employed') return 'busy'; // lavori già altrove
    return this.openings.includes(id) ? 'hiring' : 'notHiring';
  }

  hire(id) {
    if (this.standingWith(id) !== 'hiring') return false;
    this.status = 'employed';
    this.employer = id;
    this.openings = [];
    this.emit('hired', { pizzeria: this.pizzeria(id) });
    return true;
  }

  /** Gennaro se ne va: quella pizzeria non lo riprenderà mai più. */
  quit() {
    if (this.status !== 'employed') return false;
    this.leaveJob('quit');
    return true;
  }

  leaveJob(reason) {
    const pizzeria = this.pizzeria(this.employer);
    this.banned.add(this.employer);
    this.employer = null;
    this.status = 'unemployed';
    this.rollOpenings(); // so the end-of-shift report already knows who is hiring
    if (this.shift) this.endShift(reason);
    this.emit(reason, { pizzeria });
    if (this.status === 'unemployable') this.emit('gameOver', {});
  }

  // ---------------------------------------------------------------- shifts
  get onShift() {
    return !!this.shift;
  }

  get activeOrders() {
    return this.shift ? this.shift.orders.filter((o) => o.state === 'open') : [];
  }

  startShift() {
    if (this.status !== 'employed' || this.shift) return false;
    this.day++;
    this.shift = {
      day: this.day,
      pizzeria: this.pizzeria(this.employer),
      elapsed: 0,
      nextOrderAt: 0,
      orders: [],
      pay: { base: 0, commission: 0, tips: 0 },
      delivered: 0,
      missed: 0,
    };
    this.emit('shiftStarted', { shift: this.shift });
    this.createOrder(); // la prima consegna parte subito
    return true;
  }

  get shiftTimeLeft() {
    return this.shift ? Math.max(0, this.rules.shiftLength - this.shift.elapsed) : 0;
  }

  get nextOrderIn() {
    const s = this.shift;
    if (!s || s.nextOrderAt >= this.rules.shiftLength) return null;
    return Math.max(0, s.nextOrderAt - s.elapsed);
  }

  endShift(reason) {
    const shift = this.shift;
    for (const order of this.activeOrders) this.closeOrder(order, { judged: false });
    this.shift = null;
    const pay = shift.pay;
    this.emit('shiftEnded', { shift, reason, total: round2(pay.base + pay.commission + pay.tips) });
  }

  // ---------------------------------------------------------------- orders
  createOrder() {
    const s = this.shift;
    const { rules, rng } = this;
    const total = randInt(...rules.pizzasPerOrder, rng);
    const counts = splitPizzas(total, rules.familiesPerOrder, rules.maxPizzasPerFamily, rng);
    const names = shuffle(this.surnames, rng);
    const taken = [s.pizzeria.pos];
    const stops = counts.map((n, i) => {
      const address = this.findAddress(rng, taken);
      taken.push([address.x, address.y]);
      const pizzas = Array.from({ length: n }, () => pick(this.menu, rng));
      return { family: names[i], address, pizzas, delivered: false, deliveredAt: null, tip: 0 };
    });
    const order = {
      number: s.orders.length + 1,
      createdAt: s.elapsed,
      deadline: s.elapsed + rules.orderTime,
      pickedUp: false,
      state: 'open', // open | done | failed
      stops,
      pizzaCount: total,
    };
    s.orders.push(order);
    s.nextOrderAt += rules.orderInterval;
    this.emit('orderCreated', { order });
    return order;
  }

  timeLeft(order) {
    return Math.max(0, order.deadline - this.shift.elapsed);
  }

  tipTimeLeft(order) {
    return Math.max(0, order.createdAt + this.rules.tipWindow - this.shift.elapsed);
  }

  deliver(order, stop) {
    const s = this.shift;
    stop.delivered = true;
    stop.deliveredAt = s.elapsed;
    if (s.elapsed - order.createdAt <= this.rules.tipWindow) {
      stop.tip = round2(orderValue(stop) * randRange(...this.rules.tipRange, this.rng));
    }
    this.emit('delivered', { order, stop });
    if (order.stops.every((x) => x.delivered)) this.closeOrder(order);
  }

  /** Pays the order and, if pizzas were left undelivered, rolls for the sack. */
  closeOrder(order, { judged = true } = {}) {
    const s = this.shift;
    const { rules } = this;
    const delivered = order.stops.filter((x) => x.delivered);
    const missed = sum(order.stops, (x) => (x.delivered ? 0 : x.pizzas.length));
    const pay = {
      base: rules.basePay,
      commission: round2(rules.commission * sum(delivered, orderValue)),
      tips: round2(sum(delivered, (x) => x.tip)),
    };
    pay.total = round2(pay.base + pay.commission + pay.tips);

    order.state = missed ? 'failed' : 'done';
    order.pay = pay;
    order.missed = missed;
    s.pay.base += pay.base;
    s.pay.commission = round2(s.pay.commission + pay.commission);
    s.pay.tips = round2(s.pay.tips + pay.tips);
    s.delivered += order.pizzaCount - missed;
    s.missed += missed;
    this.wallet = round2(this.wallet + pay.total);
    this.emit('orderClosed', { order, pay, missed });

    if (judged && missed) {
      let fired = false;
      for (let k = 0; k < missed && !fired; k++) fired = this.rng() < rules.firingChancePerPizza;
      if (fired) this.leaveJob('fired');
    }
  }

  // ---------------------------------------------------------------- tick
  /** Advance the clock. `courier` = { x, y, speed } in world px. */
  update(dt, courier) {
    const s = this.shift;
    if (!s) return;
    s.elapsed += dt;

    if (s.elapsed >= s.nextOrderAt && s.nextOrderAt < this.rules.shiftLength) this.createOrder();

    for (const order of this.activeOrders) {
      if (this.shift !== s) return; // fired a moment ago
      if (!order.pickedUp) {
        const [px, py] = s.pizzeria.pos;
        if (Math.hypot(courier.x - px, courier.y - py) < PICKUP_RANGE) {
          order.pickedUp = true;
          this.emit('pickedUp', { order });
        }
      } else if (courier.speed < MAX_HANDOFF_SPEED) {
        for (const stop of order.stops) {
          if (stop.delivered || order.state !== 'open') continue;
          if (Math.hypot(courier.x - stop.address.x, courier.y - stop.address.y) < DELIVERY_RANGE) {
            this.deliver(order, stop);
          }
        }
      }
      if (order.state === 'open' && s.elapsed >= order.deadline) this.closeOrder(order);
    }

    if (this.shift === s && s.elapsed >= this.rules.shiftLength && !this.activeOrders.length) this.endShift('end');
  }

  emit(type, data) {
    this.onEvent({ type, ...data });
  }
}
