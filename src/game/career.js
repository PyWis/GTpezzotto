// La carriera di Gennaro: calendario, assunzioni, consegne, licenziamenti e
// spese per vivere. Logica pura, senza DOM né canvas: riceve il tempo e la
// posizione del fattorino e notifica ciò che succede tramite `onEvent`.

import { pick, randInt, randRange, shuffle } from '../core/math.js';

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

const emptyLedger = (day) => ({ day, orders: [], pay: { base: 0, commission: 0, tips: 0 }, delivered: 0, missed: 0 });

export class Career {
  constructor({ pizzerias, menu, surnames, rules, findAddress, rng = Math.random, onEvent = () => {} }) {
    Object.assign(this, { pizzerias, menu, surnames, rules, findAddress, rng, onEvent });
    this.time = 0; // secondi di gioco dall'inizio
    this.status = 'unemployed'; // unemployed | employed | broke
    this.employer = null;
    this.job = null; // { pizzeria, nextOrderAt, orders, earlyOrder }
    this.bannedUntil = new Map(); // id → giorno da cui potrebbe riassumerti
    this.openings = []; // chi assume oggi: Gennaro non lo sa finché non chiede
    this.asked = new Set(); // pizzerie a cui ha già chiesto (da quando sono cambiate le offerte)
    this.wallet = 0;
    this.daysInRed = 0;
    this.ordersCreated = 0;
    this.ledger = emptyLedger(1); // conti della giornata in corso
    this.rollOpenings();
  }

  // ---------------------------------------------------------------- calendar
  get day() {
    return Math.floor(this.time / this.rules.dayLength) + 1;
  }

  get dayTimeLeft() {
    return this.rules.dayLength - (this.time % this.rules.dayLength);
  }

  endDay() {
    const { rules } = this;
    const ledger = this.ledger;
    const living = round2(randRange(...rules.livingCost, this.rng));
    this.wallet = round2(this.wallet - living);
    this.daysInRed = this.wallet < 0 ? this.daysInRed + 1 : 0;
    const pay = ledger.pay;
    this.emit('dayEnded', {
      ledger,
      earned: round2(pay.base + pay.commission + pay.tips),
      living,
      wallet: this.wallet,
      daysInRed: this.daysInRed,
    });
    this.ledger = emptyLedger(ledger.day + 1);

    if (this.daysInRed >= rules.maxDaysInRed) {
      this.status = 'broke';
      this.employer = null;
      this.job = null;
      this.emit('gameOver', { reason: 'broke' });
    } else if (this.status === 'unemployed') {
      this.rollOpenings(); // ogni mattina cambia chi cerca un fattorino
    }
  }

  // ---------------------------------------------------------------- hiring
  pizzeria(id) {
    return this.pizzerias.find((p) => p.id === id);
  }

  isBanned(id) {
    return (this.bannedUntil.get(id) ?? 0) > this.day;
  }

  rollOpenings() {
    const candidates = this.pizzerias.filter((p) => !this.isBanned(p.id)).map((p) => p.id);
    this.openings = shuffle(candidates, this.rng).slice(0, this.rules.openings);
    this.asked.clear();
  }

  /**
   * What Gennaro knows about a pizzeria. Whether it is hiring stays
   * 'unknown' until he walks in and asks.
   */
  standingWith(id) {
    if (this.employer === id) return 'employer';
    if (this.isBanned(id)) return 'banned';
    if (this.status !== 'unemployed') return 'busy';
    if (!this.asked.has(id)) return 'unknown';
    return this.openings.includes(id) ? 'hiring' : 'notHiring';
  }

  /** Gennaro asks at the counter. Returns the (now known) standing. */
  ask(id) {
    if (this.status === 'unemployed' && !this.isBanned(id)) this.asked.add(id);
    return this.standingWith(id);
  }

  hire(id) {
    if (this.status !== 'unemployed' || this.isBanned(id) || !this.openings.includes(id)) return false;
    this.status = 'employed';
    this.employer = id;
    this.openings = [];
    this.asked.clear();
    this.job = { pizzeria: this.pizzeria(id), nextOrderAt: this.time, orders: [], earlyOrder: false };
    this.emit('hired', { pizzeria: this.job.pizzeria });
    return true;
  }

  /** Gennaro se ne va: quella pizzeria non lo riprende per `rehireAfterDays` giorni. */
  quit() {
    if (this.status !== 'employed') return false;
    this.leaveJob('quit');
    return true;
  }

  leaveJob(reason) {
    const job = this.job;
    for (const order of this.activeOrders) this.closeOrder(order, { judged: false });
    this.bannedUntil.set(job.pizzeria.id, this.day + this.rules.rehireAfterDays);
    this.employer = null;
    this.job = null;
    this.status = 'unemployed';
    this.rollOpenings();
    this.emit(reason, { pizzeria: job.pizzeria, rehireDay: this.day + this.rules.rehireAfterDays });
  }

  // ---------------------------------------------------------------- orders
  get activeOrders() {
    return this.job ? this.job.orders.filter((o) => o.state === 'open') : [];
  }

  get nextOrderIn() {
    return this.job ? Math.max(0, this.job.nextOrderAt - this.time) : null;
  }

  createOrder() {
    const { rules, rng, job } = this;
    const total = randInt(...rules.pizzasPerOrder, rng);
    const counts = splitPizzas(total, rules.familiesPerOrder, rules.maxPizzasPerFamily, rng);
    const names = shuffle(this.surnames, rng);
    const taken = [job.pizzeria.pos];
    const stops = counts.map((n, i) => {
      const address = this.findAddress(rng, taken);
      taken.push([address.x, address.y]);
      const pizzas = Array.from({ length: n }, () => pick(this.menu, rng));
      return { family: names[i], address, pizzas, delivered: false, deliveredAt: null, tip: 0 };
    });
    const order = {
      number: ++this.ordersCreated,
      createdAt: this.time,
      deadline: this.time + rules.orderTime,
      pickedUp: false,
      state: 'open', // open | done | failed
      stops,
      pizzaCount: total,
    };
    job.orders = [...job.orders.filter((o) => o.state === 'open'), order];
    job.nextOrderAt = this.time + rules.orderInterval;
    job.earlyOrder = false;
    this.emit('orderCreated', { order });
    return order;
  }

  timeLeft(order) {
    return Math.max(0, order.deadline - this.time);
  }

  tipTimeLeft(order) {
    return Math.max(0, order.createdAt + this.rules.tipWindow - this.time);
  }

  deliver(order, stop) {
    stop.delivered = true;
    stop.deliveredAt = this.time;
    if (this.time - order.createdAt <= this.rules.tipWindow) {
      stop.tip = round2(orderValue(stop) * randRange(...this.rules.tipRange, this.rng));
    }
    this.emit('delivered', { order, stop });
    if (order.stops.every((x) => x.delivered)) this.closeOrder(order);
  }

  /** Pays the order and, if pizzas were left undelivered, rolls for the sack. */
  closeOrder(order, { judged = true } = {}) {
    const { rules, ledger } = this;
    const delivered = order.stops.filter((x) => x.delivered);
    const missed = sum(order.stops, (x) => (x.delivered ? 0 : x.pizzas.length));
    const pay = {
      base: delivered.length ? rules.basePay : 0, // il fisso solo se hai consegnato qualcosa
      commission: round2(rules.commission * sum(delivered, orderValue)),
      tips: round2(sum(delivered, (x) => x.tip)),
    };
    pay.total = round2(pay.base + pay.commission + pay.tips);

    Object.assign(order, { state: missed ? 'failed' : 'done', pay, missed });
    ledger.orders.push(order);
    ledger.pay.base += pay.base;
    ledger.pay.commission = round2(ledger.pay.commission + pay.commission);
    ledger.pay.tips = round2(ledger.pay.tips + pay.tips);
    ledger.delivered += order.pizzaCount - missed;
    ledger.missed += missed;
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
    if (this.status === 'broke') return;
    this.time += dt;
    while (this.status !== 'broke' && this.day > this.ledger.day) this.endDay();
    const job = this.job;
    if (!job) return;

    if (this.time >= job.nextOrderAt) this.createOrder();

    const [px, py] = job.pizzeria.pos;
    const atShop = Math.hypot(courier.x - px, courier.y - py) < PICKUP_RANGE;
    for (const order of this.activeOrders) {
      if (this.job !== job) return; // licenziato un attimo fa
      if (!order.pickedUp) {
        if (atShop) {
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
      if (order.state === 'open' && this.time >= order.deadline) this.closeOrder(order);
    }

    // Tornato in pizzeria a mani vuote prima del prossimo ordine? Ne arriva uno a breve.
    const [, maxDelay] = this.rules.earlyOrderDelay;
    if (this.job === job && atShop && !this.activeOrders.length && job.nextOrderAt > this.time + maxDelay) {
      job.nextOrderAt = this.time + randRange(...this.rules.earlyOrderDelay, this.rng);
      job.earlyOrder = true;
      this.emit('earlyOrder', { in: job.nextOrderAt - this.time });
    }
  }

  emit(type, data) {
    this.onEvent({ type, ...data });
  }
}
