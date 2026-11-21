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

const emptyLedger = (day) => ({
  day,
  orders: [],
  pay: { base: 0, commission: 0, tips: 0, bonus: 0 },
  delivered: 0,
  missed: 0,
});

/**
 * Order kinds: the normal job, a one-off run for another pizzeria, the footballer's pizza and the
 * secret mission of day 10 (the pizza for the Dio del Calcio, inside the stadium).
 */
export const OrderKind = Object.freeze({
  REGULAR: 'regular',
  SIDE: 'side',
  FOOTBALLER: 'footballer',
  LEGEND: 'legend',
  VIP: 'vip',
});

/** Orders that belong to the job (the others don't make the employer angry, nor stay behind if you quit). */
const isJobOrder = (o) => o.kind === OrderKind.REGULAR || o.kind === OrderKind.FOOTBALLER || o.kind === OrderKind.VIP;

export class Career {
  /**
   * `stadium`: the address of the pitch, where the secret mission ends ({ x, y, label… }).
   * `vips`: the special customers, [{ name, address }], each waiting next to a monument.
   */
  constructor({
    pizzerias,
    menu,
    surnames,
    rules,
    findAddress,
    stadium = null,
    vips = [],
    blessed = false,
    rng = Math.random,
    onEvent = () => {},
  }) {
    Object.assign(this, { pizzerias, menu, surnames, rules, findAddress, stadium, vips, rng, onEvent });
    // Benedetto dal Dio del Calcio: ogni calciatore dà una mancia. Vale per sempre, anche nelle partite nuove.
    this.blessed = blessed;
    this.time = 0; // secondi di gioco dall'inizio
    this.status = 'unemployed'; // unemployed | employed | broke
    this.employer = null;
    this.job = null; // { pizzeria, nextOrderAt, earlyOrder }
    this.orders = []; // tutti gli ordini della giornata (aperti e chiusi)
    this.bannedUntil = new Map(); // id → giorno da cui potrebbe riassumerti
    this.openings = []; // chi assume oggi: Gennaro non lo sa finché non chiede
    this.asked = new Set(); // pizzerie a cui ha già chiesto (da quando sono cambiate le offerte)
    this.wallet = 0;
    this.daysInRed = 0;
    this.ordersCreated = 0;
    this.boosts = []; // bonus del calciatore: [{ until }] in secondi di gioco
    this.sideAsked = new Map(); // pizzeria → quando ha chiesto l'ultima volta un lavoretto
    this.tunedVespas = new Set(); // Vespe modificate in officina
    this.legendFired = false; // la missione segreta arriva una volta sola
    this.dayOrders = 0; // ordini del datore di lavoro arrivati oggi
    this.vipDay = 0; // l'ultimo giorno in cui ha chiamato un cliente speciale (uno al giorno)
    this.vipVisits = new Map(); // cliente speciale → quante volte Gennaro gli ha portato le pizze
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
      earned: round2(pay.base + pay.commission + pay.tips + pay.bonus),
      living,
      wallet: this.wallet,
      daysInRed: this.daysInRed,
    });
    this.ledger = emptyLedger(ledger.day + 1);
    this.dayOrders = 0;
    this.orders = this.activeOrders;
    this.boosts = this.boosts.filter((b) => b.until > this.time);

    if (this.daysInRed >= rules.maxDaysInRed) {
      this.status = 'broke';
      this.employer = null;
      this.job = null;
      this.orders = this.activeOrders; // il tempo si ferma: niente più consegne
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
    this.job = { pizzeria: this.pizzeria(id), nextOrderAt: this.time, earlyOrder: false };
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
    for (const order of this.activeOrders) if (isJobOrder(order)) this.closeOrder(order, { judged: false });
    this.bannedUntil.set(job.pizzeria.id, this.day + this.rules.rehireAfterDays);
    this.employer = null;
    this.job = null;
    this.status = 'unemployed';
    this.rollOpenings();
    this.emit(reason, { pizzeria: job.pizzeria, rehireDay: this.day + this.rules.rehireAfterDays });
  }

  // ---------------------------------------------------------------- orders
  get activeOrders() {
    return this.orders.filter((o) => o.state === 'open');
  }

  get nextOrderIn() {
    return this.job ? Math.max(0, this.job.nextOrderAt - this.time) : null;
  }

  /** Builds an order and puts it on the board. `counts[i]` pizzas for family i. */
  addOrder({ kind, pizzeria, counts, time, families, addressOptions = {}, addresses }) {
    const { rng } = this;
    const names = families ?? shuffle(this.surnames, rng);
    const taken = [pizzeria.pos];
    const stops = counts.map((n, i) => {
      const address = addresses?.[i] ?? this.findAddress(rng, taken, { from: pizzeria.pos, ...addressOptions });
      taken.push([address.x, address.y]);
      const pizzas = Array.from({ length: n }, () => pick(this.menu, rng));
      return { family: names[i], address, pizzas, delivered: false, deliveredAt: null, tip: 0 };
    });
    const order = {
      number: ++this.ordersCreated,
      kind,
      pizzeria,
      createdAt: this.time,
      deadline: this.time + time,
      pickedUp: false,
      legStart: null, // da quando corre il minuto per la mancia della prossima famiglia
      state: 'open', // open | done | failed
      stops,
      pizzaCount: counts.reduce((a, b) => a + b, 0),
    };
    this.orders.push(order);
    return order;
  }

  /** Next order from the employer: usually a normal one, once in a while a special customer or the footballer. */
  createOrder() {
    const { rules, rng, job } = this;
    const vip = this.rollVip();
    const footballer = !vip && rng() < rules.footballer.chance;
    let order;
    if (vip) {
      order = this.addOrder({
        kind: OrderKind.VIP,
        pizzeria: job.pizzeria,
        counts: [rules.vip.pizzas],
        time: rules.orderTime, // per ritirarle; dal ritiro ci sono solo `vip.time` secondi
        families: [vip.name],
        addresses: [vip.address],
      });
      order.vip = vip.name;
      this.vipDay = this.day;
    } else if (footballer) {
      order = this.addOrder({
        kind: OrderKind.FOOTBALLER,
        pizzeria: job.pizzeria,
        counts: [1],
        time: rules.footballer.time,
        families: [rules.footballer.name],
        addressOptions: { maxDist: rules.footballer.maxDistance },
      });
    } else {
      const total = randInt(...rules.pizzasPerOrder, rng);
      order = this.addOrder({
        kind: OrderKind.REGULAR,
        pizzeria: job.pizzeria,
        counts: splitPizzas(total, rules.familiesPerOrder, rules.maxPizzasPerFamily, rng),
        time: rules.orderTime,
      });
    }
    job.nextOrderAt = this.time + rules.orderInterval;
    job.earlyOrder = false;
    this.dayOrders++;
    this.emit('orderCreated', { order });
    return order;
  }

  // ---------------------------------------------------------------- special customers
  /** Chance that the next order is a special customer: 0 on day 1, once one has called today, or before the 4th order. */
  get vipChance() {
    const v = this.rules.vip;
    if (!v || !this.vips.length || this.day < v.fromDay || this.vipDay === this.day) return 0;
    if (this.dayTimeLeft <= v.lateWindow) return v.lateChance;
    return this.dayOrders >= v.afterOrders ? v.chance : 0;
  }

  /** Rolls for a special customer; returns who calls (or null). */
  rollVip() {
    const chance = this.vipChance;
    if (!chance || this.rng() >= chance) return null;
    return this.nextVip();
  }

  /** Lucia first; then someone Gennaro hasn't met yet; once he knows them all, anyone. */
  nextVip() {
    const { vips, rng } = this;
    const met = (v) => (this.vipVisits.get(v.name) ?? 0) > 0;
    const first = vips.find((v) => v.name === this.rules.vip.first);
    if (first && !met(first)) return first;
    const unmet = vips.filter((v) => !met(v));
    return pick(unmet.length ? unmet : vips, rng);
  }

  // ---------------------------------------------------------------- side jobs
  /** Can this pizzeria be asked for a one-off delivery right now? */
  canAskSideJob(id) {
    if (this.status === 'broke' || this.employer === id || this.isBanned(id)) return false;
    if (this.activeOrders.some((o) => o.kind === OrderKind.SIDE)) return false;
    const last = this.sideAsked.get(id);
    return last === undefined || this.time - last >= this.rules.sideJob.cooldown;
  }

  /** Gennaro asks another pizzeria for a delivery: 25% they have one. */
  askSideJob(id) {
    if (!this.canAskSideJob(id)) return false;
    this.sideAsked.set(id, this.time);
    return this.rng() < this.rules.sideJob.chance;
  }

  /** He takes the job: the pizzas are handed over at the counter, right now. */
  takeSideJob(id) {
    const { rules } = this;
    const order = this.addOrder({
      kind: OrderKind.SIDE,
      pizzeria: this.pizzeria(id),
      counts: [rules.sideJob.pizzas],
      time: rules.sideJob.time,
      addressOptions: { minDist: rules.sideJob.minDistance },
    });
    this.emit('orderCreated', { order });
    this.pickUp(order);
    return order;
  }

  pickUp(order) {
    order.pickedUp = true;
    order.legStart = this.time;
    if (order.kind === OrderKind.VIP) {
      // Il cliente speciale aspetta poco: 80 secondi dal ritiro. E 30 secondi dopo arriva già il prossimo ordine.
      const { vip } = this.rules;
      order.deadline = this.time + vip.time;
      const job = this.job;
      if (job && job.pizzeria === order.pizzeria)
        job.nextOrderAt = Math.min(job.nextOrderAt, this.time + vip.nextOrderAfterPickup);
    }
    this.emit('pickedUp', { order });
  }

  // ---------------------------------------------------------------- secret mission
  /**
   * Day 10, after 10 minutes: someone wants a pizza inside the stadium. From the employer if Gennaro has a
   * job, otherwise from the pizzeria next to the stadium. Once per game.
   */
  maybeStartLegend() {
    const { legend } = this.rules;
    if (this.legendFired || !legend || !this.stadium) return null;
    if (this.day !== legend.day || this.rules.dayLength - this.dayTimeLeft < legend.after) return null;
    this.legendFired = true;
    const pizzeria = this.job?.pizzeria ?? this.pizzeria(legend.pizzeria);
    const order = this.addOrder({
      kind: OrderKind.LEGEND,
      pizzeria,
      counts: [1],
      time: legend.time,
      families: [legend.name],
      addresses: [this.stadium],
    });
    this.emit('orderCreated', { order });
    return order;
  }

  // ---------------------------------------------------------------- footballer bonus
  /** Pay multiplier from the footballer's gratitude: +20% for each active bonus. */
  get payMultiplier() {
    return 1 + this.rules.footballer.bonus * this.boosts.filter((b) => b.until > this.time).length;
  }

  get boostUntil() {
    const live = this.boosts.filter((b) => b.until > this.time);
    return live.length ? Math.max(...live.map((b) => b.until)) : null;
  }

  // ---------------------------------------------------------------- officina
  isTuned(vespa) {
    return this.tunedVespas.has(vespa);
  }

  /** Fuorigrotta: the mechanic souped up this Vespa (×1.2) for 1000 €. */
  tune(vespa) {
    const { cost } = this.rules.tuning;
    if (!vespa || this.isTuned(vespa) || this.wallet < cost || this.status === 'broke') return false;
    this.wallet = round2(this.wallet - cost);
    this.tunedVespas.add(vespa);
    this.emit('tuned', { vespa, cost });
    return true;
  }

  // ---------------------------------------------------------------- officina di Via Gianturco
  /** € to bring a dented Vespa back to full speed. */
  repairCost(vespa) {
    const lost = 1 - (vespa?.condition ?? 1);
    return Math.ceil(Math.round(lost * 1000) / 10) * this.rules.repair.costPerPoint;
  }

  repair(vespa) {
    const cost = this.repairCost(vespa);
    if (!vespa || cost <= 0 || this.wallet < cost || this.status === 'broke') return false;
    this.wallet = round2(this.wallet - cost);
    vespa.condition = 1;
    this.emit('repaired', { vespa, cost });
    return true;
  }

  timeLeft(order) {
    return Math.max(0, order.deadline - this.time);
  }

  /** Seconds left to earn a tip on the next family (the minute restarts at every delivery). */
  tipTimeLeft(order) {
    if (order.legStart === null || order.kind === OrderKind.FOOTBALLER) return 0;
    return Math.max(0, order.legStart + this.rules.tipWindow - this.time);
  }

  deliver(order, stop) {
    stop.delivered = true;
    stop.deliveredAt = this.time;
    if (order.kind === OrderKind.LEGEND) {
      stop.tip = this.rules.legend.tip; // il Dio del Calcio lascia sempre la sua mancia
    } else if (order.kind === OrderKind.FOOTBALLER) {
      stop.tip = this.blessed ? this.rules.footballer.blessedTip : 0;
    } else if (this.tipTimeLeft(order) > 0) {
      stop.tip = round2(orderValue(stop) * randRange(...this.rules.tipRange, this.rng));
    }
    order.legStart = this.time; // la mancia si calcola su ogni singola consegna
    if (order.kind === OrderKind.VIP) {
      const visit = (this.vipVisits.get(order.vip) ?? 0) + 1;
      this.vipVisits.set(order.vip, visit);
      stop.visit = visit;
    }
    this.emit('delivered', { order, stop });
    if (order.kind === OrderKind.LEGEND && !this.blessed) {
      this.blessed = true;
      this.emit('blessed', {});
    }
    if (order.stops.every((x) => x.delivered)) this.closeOrder(order);
  }

  /** Pays the order and, if pizzas were left undelivered, rolls for the sack. */
  closeOrder(order, { judged = true } = {}) {
    const { rules, ledger } = this;
    const delivered = order.stops.filter((x) => x.delivered);
    const missed = sum(order.stops, (x) => (x.delivered ? 0 : x.pizzas.length));
    const free = order.kind === OrderKind.FOOTBALLER; // al calciatore la pizza la offre la casa
    const pay = {
      base: delivered.length && !free ? rules.basePay : 0, // il fisso solo se hai consegnato qualcosa
      commission: free ? 0 : round2(rules.commission * sum(delivered, orderValue)),
      tips: round2(sum(delivered, (x) => x.tip)),
    };
    // La consegna extra vale il doppio; il bonus del calciatore si aggiunge a tutto.
    const extra = order.kind === OrderKind.SIDE ? (rules.sideJob.payMultiplier ?? 1) : 1;
    pay.bonus = round2((pay.base + pay.commission + pay.tips) * (extra * this.payMultiplier - 1));
    pay.total = round2(pay.base + pay.commission + pay.tips + pay.bonus);

    Object.assign(order, { state: missed ? 'failed' : 'done', pay, missed });
    ledger.orders.push(order);
    ledger.pay.base += pay.base;
    ledger.pay.commission = round2(ledger.pay.commission + pay.commission);
    ledger.pay.tips = round2(ledger.pay.tips + pay.tips);
    ledger.pay.bonus = round2(ledger.pay.bonus + pay.bonus);
    ledger.delivered += order.pizzaCount - missed;
    ledger.missed += missed;
    this.wallet = round2(this.wallet + pay.total);
    this.emit('orderClosed', { order, pay, missed });

    if (free && !missed) {
      // Il calciatore ringrazia: per i prossimi 2 giorni si guadagna il 20% in più (si accumula).
      const until = (this.day + rules.footballer.bonusDays) * rules.dayLength;
      this.boosts.push({ until });
      this.emit('boost', { until, multiplier: this.payMultiplier });
    }

    // Un lavoretto per un'altra pizzeria: chi ti ha assunto non ti licenzia per quello.
    if (judged && missed && isJobOrder(order) && order.pizzeria.id === this.employer) {
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
    if (this.status === 'broke') return;

    const job = this.job;
    if (job && this.time >= job.nextOrderAt) this.createOrder();
    this.maybeStartLegend();

    const near = ([x, y], range) => Math.hypot(courier.x - x, courier.y - y) < range;
    for (const order of this.activeOrders) {
      if (order.state !== 'open') continue; // chiuso un attimo fa (licenziato)
      if (!order.pickedUp) {
        if (near(order.pizzeria.pos, PICKUP_RANGE)) this.pickUp(order);
      } else if (courier.speed < MAX_HANDOFF_SPEED) {
        for (const stop of order.stops) {
          if (stop.delivered || order.state !== 'open') continue;
          if (near([stop.address.x, stop.address.y], DELIVERY_RANGE)) this.deliver(order, stop);
        }
      }
      if (order.state === 'open' && this.time >= order.deadline) this.closeOrder(order);
    }

    // Tornato in pizzeria a mani vuote prima del prossimo ordine? Ne arriva uno a breve.
    if (!job || this.job !== job) return;
    const [, maxDelay] = this.rules.earlyOrderDelay;
    const ownOrders = this.activeOrders.filter(isJobOrder);
    if (near(job.pizzeria.pos, PICKUP_RANGE) && !ownOrders.length && job.nextOrderAt > this.time + maxDelay) {
      job.nextOrderAt = this.time + randRange(...this.rules.earlyOrderDelay, this.rng);
      job.earlyOrder = true;
      this.emit('earlyOrder', { in: job.nextOrderAt - this.time });
    }
  }

  // ---------------------------------------------------------------- save / load
  /** Plain JSON snapshot. `vespas` is the list the tuned Vespas are looked up in. */
  serialize(vespas = []) {
    const orderJson = (o) => ({ ...o, pizzeria: o.pizzeria.id });
    const byNumber = new Map([...this.ledger.orders, ...this.orders].map((o) => [o.number, o]));
    return {
      time: this.time,
      status: this.status,
      employer: this.employer,
      job: this.job && { nextOrderAt: this.job.nextOrderAt, earlyOrder: this.job.earlyOrder },
      orders: [...byNumber.values()].map(orderJson),
      today: this.orders.map((o) => o.number),
      ledger: { ...this.ledger, orders: this.ledger.orders.map((o) => o.number) },
      bannedUntil: [...this.bannedUntil],
      openings: this.openings,
      asked: [...this.asked],
      wallet: this.wallet,
      daysInRed: this.daysInRed,
      ordersCreated: this.ordersCreated,
      boosts: this.boosts,
      sideAsked: [...this.sideAsked],
      tuned: [...this.tunedVespas].map((v) => vespas.indexOf(v)).filter((i) => i >= 0),
      legendFired: this.legendFired,
      dayOrders: this.dayOrders,
      vipDay: this.vipDay,
      vipVisits: [...this.vipVisits],
    };
  }

  /** Restores a snapshot made by `serialize` (same `vespas` list). */
  restore(data, vespas = []) {
    const orders = new Map(
      data.orders.map((o) => [o.number, { ...o, pizzeria: this.pizzeria(o.pizzeria) ?? this.pizzerias[0] }]),
    );
    const known = (numbers) => numbers.map((n) => orders.get(n)).filter(Boolean);
    Object.assign(this, {
      time: data.time,
      status: data.status,
      employer: data.employer,
      job: data.job && data.employer ? { ...data.job, pizzeria: this.pizzeria(data.employer) } : null,
      orders: known(data.today),
      ledger: { ...data.ledger, orders: known(data.ledger.orders) },
      bannedUntil: new Map(data.bannedUntil),
      openings: data.openings,
      asked: new Set(data.asked),
      wallet: data.wallet,
      daysInRed: data.daysInRed,
      ordersCreated: data.ordersCreated,
      boosts: data.boosts,
      sideAsked: new Map(data.sideAsked),
      tunedVespas: new Set(data.tuned.map((i) => vespas[i]).filter(Boolean)),
      legendFired: !!data.legendFired,
      dayOrders: data.dayOrders ?? 0,
      vipDay: data.vipDay ?? 0,
      vipVisits: new Map(data.vipVisits ?? []),
    });
    if (this.status === 'employed' && !this.job) this.status = 'unemployed';
  }

  emit(type, data) {
    this.onEvent({ type, ...data });
  }
}
