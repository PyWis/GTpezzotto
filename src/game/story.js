// La storia di Gennaro e Filomena. Logica pura, come la carriera: riceve la posizione del fattorino,
// ferma o fa ripartire il tempo della carriera e notifica le scene tramite `onEvent`. Le scene vere
// (fumetti, baci, la ragazza in Vespa) le recita main.js e poi chiama `finishPier` / `finishCastle`.
//
//   giorni 3-4  Filomena passa in Vespa e saluta Gennaro (2 volte il 3°, 3 volte il 4°): «Ma chesta chi è?»
//   giorno 5    dopo 15 minuti una telefonata: 2 Margherite al Pontile Nord. Al ritiro il pizzaiolo lo
//               licenzia («te si' miso in proprio!»), il giorno si ferma; al pontile c'è Filomena e il bacio.
//   giorni 6-7  Filomena passa una volta; se la Vespa non è truccata gli dice di truccarla.
//   giorno 8    solo con la Vespa truccata: a fine giornata il tempo si ferma finché Gennaro non va a
//               Castel dell'Ovo, sale a piedi con lei e si fidanzano. Altrimenti la storia finisce qui.
//   giorno 12+  Gennaro vuole mettersi in proprio: comprata la pizzeria, il giorno si ferma finché non
//               sceglie dove aprirla; Filomena sta fuori dal locale.

import { OrderKind } from './career.js';

export const Phase = Object.freeze({
  START: 'start', // prima della telefonata
  CALL: 'call', // telefonata ricevuta: le Margherite sono da ritirare
  PIER: 'pier', // licenziato, tempo fermo: le Margherite vanno al Pontile Nord
  PIER_SCENE: 'pierScene', // al pontile con Filomena
  MET: 'met', // conosce Filomena
  CASTLE: 'castle', // fine del giorno 8: lei aspetta sotto Castel dell'Ovo
  CLIMB: 'castleClimb', // si sale a piedi
  TOP: 'castleTop', // in cima: il bacio
  ENGAGED: 'engaged', // fidanzati
  PLACING: 'placing', // pizzeria comprata, Gennaro sceglie dove aprirla
  OWNER: 'owner', // la pizzeria è aperta
  OVER: 'over', // la storia è finita (al giorno 8 la Vespa non era truccata)
});

export const MEET_RANGE = 70; // px: sotto il castello, vicino a Filomena
export const DOOR_RANGE = 44; // px: la porta del castello

export class Story {
  /**
   * `pier`: l'indirizzo del Pontile Nord ({ x, y, label… }).
   * `castle`: { meet: [x, y], door: [x, y] } sotto Castel dell'Ovo e alla sua porta.
   */
  constructor({ career, pier, castle, onEvent = () => {} }) {
    Object.assign(this, { career, pier, castle, onEvent });
    this.rules = career.rules.story;
    this.phase = Phase.START;
    this.visits = {}; // giorno → quante volte Filomena è già passata
    this.orderNumber = null; // l'ordine delle 2 Margherite
  }

  get order() {
    return this.career.orders.find((o) => o.number === this.orderNumber) ?? null;
  }

  /** Engaged, from day 12: Gennaro can ask the pizzaioli about opening his own pizzeria. */
  get canBuyShop() {
    const { career } = this;
    return this.phase === Phase.ENGAGED && career.day >= career.rules.ownShop.fromDay && career.status !== 'broke';
  }

  /** While a scene holds the day still. */
  get frozen() {
    return [Phase.PIER, Phase.PIER_SCENE, Phase.CASTLE, Phase.CLIMB, Phase.TOP, Phase.PLACING].includes(this.phase);
  }

  /** Call after `career.update`. `courier` = { x, y, onFoot } (x is NaN in the metro or on a funicular). */
  update(courier) {
    const { career, rules } = this;
    if (!rules || career.status === 'broke') return;
    const day = career.day;
    const elapsed = career.rules.dayLength - career.dayTimeLeft;
    const near = ([x, y], range) => Math.hypot(courier.x - x, courier.y - y) < range;
    const onStreet = Number.isFinite(courier.x);

    // Filomena passa a salutare, a intervalli regolari durante la giornata.
    const plan = rules.visits[day];
    const done = this.visits[day] ?? 0;
    if (
      plan &&
      done < plan &&
      onStreet &&
      !this.frozen &&
      elapsed >= (career.rules.dayLength * (done + 1)) / (plan + 1)
    ) {
      this.visits[day] = done + 1;
      this.emit('filomenaVisit', { day, visit: done + 1, tuneHint: day >= 6 && !career.hasTunedVespa });
    }

    switch (this.phase) {
      case Phase.START:
        if (day > rules.callDay) this.phase = Phase.OVER;
        else if (day === rules.callDay && elapsed >= rules.callAfter) this.call(courier);
        break;
      case Phase.CALL: {
        const order = this.order;
        if (!order) {
          this.phase = Phase.MET; // non dovrebbe succedere: la storia va avanti lo stesso
          break;
        }
        if (!order.pickedUp) break;
        // Il pizzaiolo lo vede uscire con le pizze di un cliente suo: licenziato.
        if (career.status === 'employed' && career.employer === order.pizzeria.id) career.leaveJob('storyFired');
        career.timeLimit = career.time; // il giorno si ferma
        this.phase = Phase.PIER;
        this.emit('pierWaiting', { order });
        break;
      }
      case Phase.PIER:
        if (this.order?.state === 'done') {
          this.phase = Phase.PIER_SCENE;
          this.emit('pierScene', {});
        }
        break;
      case Phase.MET:
        if (day > rules.castleDay) this.phase = Phase.OVER;
        else if (day === rules.castleDay && career.dayTimeLeft <= 1) {
          if (career.hasTunedVespa) {
            career.timeLimit = day * career.rules.dayLength - 0.5; // la giornata non finisce…
            this.phase = Phase.CASTLE;
            this.emit('castleCall', {});
          } else {
            this.phase = Phase.OVER; // …se la Vespa non è truccata, la storia finisce qui
            this.emit('storyOver', {});
          }
        }
        break;
      case Phase.CASTLE:
        if (near(this.castle.meet, MEET_RANGE)) {
          this.phase = Phase.CLIMB;
          this.emit('castleMeet', {});
        }
        break;
      case Phase.CLIMB:
        if (courier.onFoot && near(this.castle.door, DOOR_RANGE)) {
          this.phase = Phase.TOP;
          this.emit('castleTop', {});
        }
        break;
    }
  }

  /** Day 5: the phone rings. Two Margherite for the Pontile Nord, from his pizzeria (or the nearest one). */
  call(courier) {
    const { career } = this;
    const shops = career.pizzerias.filter((p) => !career.isBanned(p.id));
    const nearest = [...shops].sort(
      (a, b) =>
        Math.hypot(a.pos[0] - courier.x, a.pos[1] - courier.y) - Math.hypot(b.pos[0] - courier.x, b.pos[1] - courier.y),
    )[0];
    const pizzeria = career.job?.pizzeria ?? nearest ?? career.pizzerias[0];
    const order = career.addOrder({
      kind: OrderKind.STORY,
      pizzeria,
      counts: [2],
      time: 1e9, // nessuna fretta: il giorno si ferma
      families: ['Pontile Nord'],
      addresses: [this.pier],
    });
    const margherita = career.menu.find((p) => p.nome === 'Margherita') ?? career.menu[0];
    order.stops[0].pizzas = [margherita, margherita];
    this.orderNumber = order.number;
    this.phase = Phase.CALL;
    this.emit('phoneCall', { order });
    career.emit('orderCreated', { order });
  }

  /** The kiss at the pier is over: the day ends there. */
  finishPier() {
    if (this.phase !== Phase.PIER_SCENE) return;
    const { career } = this;
    career.timeLimit = null;
    career.time = Math.max(career.time, career.day * career.rules.dayLength); // si va a domani
    this.phase = Phase.MET;
  }

  /** Engaged on top of Castel dell'Ovo: the day can end. */
  finishCastle() {
    if (this.phase !== Phase.TOP) return;
    this.career.timeLimit = null;
    this.phase = Phase.ENGAGED;
    this.emit('engaged', {});
  }

  /** He pays for his own pizzeria; the day stops until he chooses where to open it. */
  buyShop(plan) {
    if (!this.canBuyShop || !this.career.buyShop(plan)) return false;
    this.career.timeLimit = this.career.time;
    this.phase = Phase.PLACING;
    return true;
  }

  /** Opens it here (if the spot is good): time runs again, and Filomena waits outside. */
  openShopAt(pos, look) {
    if (this.phase !== Phase.PLACING || !this.career.openOwnShop(pos, look)) return false;
    this.career.timeLimit = null;
    this.phase = Phase.OWNER;
    return true;
  }

  serialize() {
    return { phase: this.phase, visits: this.visits, orderNumber: this.orderNumber };
  }

  /** `data` null: a game saved before the story existed (from day 6 on, it is skipped). */
  restore(data) {
    if (!data) {
      this.phase = this.career.day > this.rules.callDay ? Phase.OVER : Phase.START;
      return;
    }
    Object.assign(this, { phase: data.phase, visits: data.visits ?? {}, orderNumber: data.orderNumber ?? null });
    // A scena interrotta, si riparte da dopo la scena.
    if (this.phase === Phase.PIER_SCENE) this.finishPier();
    if (this.phase === Phase.TOP) this.finishCastle();
  }

  emit(type, data) {
    this.onEvent({ type, ...data });
  }
}
