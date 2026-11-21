// Glue between the Career logic and the game: places the pizzerias on the
// map, turns career events into sounds/toasts/dialogs, and tells the HUD
// where Gennaro should go next.

import { clock, euro, plural } from '../core/format.js';
import { pick } from '../core/math.js';
import { districtAt, STADIUM_GATE, TILE } from '../data/city.js';
import { GARAGE, MECHANIC_LINES, MENU, PIZZERIAS, REPAIR_SHOP, RULES, SURNAMES } from '../data/pizza.js';
import { VIP_COLOR, VIP_CUSTOMERS } from '../data/vip.js';
import { snapToWalkable } from '../world/map.js';
import { sfx } from '../audio.js';
import { html, queueDialog, raw, showDialog } from '../ui/dialog.js';
import { showBanner, toast } from '../render/hud.js';
import { STOP_COLOR } from '../render/delivery.js';
import { Career, OrderKind, orderValue } from './career.js';
import { findAddress } from './addresses.js';
import { clearSave, readBlessing, saveBlessing } from './save.js';

export const PIZZERIA_RANGE = 44;

for (const p of PIZZERIAS) p.pos = snapToWalkable(...p.at);
GARAGE.pos = snapToWalkable(...GARAGE.at);
REPAIR_SHOP.pos = snapToWalkable(...REPAIR_SHOP.at);
export { GARAGE, REPAIR_SHOP };

export const FOOTBALLER_COLOR = '#5ec8ff';
export const SIDE_COLOR = '#ff9f40';
export const LEGEND_COLOR = '#ffe14d';
export { VIP_COLOR };
const KIND_COLOR = {
  [OrderKind.VIP]: VIP_COLOR,
  [OrderKind.FOOTBALLER]: FOOTBALLER_COLOR,
  [OrderKind.SIDE]: SIDE_COLOR,
  [OrderKind.LEGEND]: LEGEND_COLOR,
};
/** Colour of a customer's beacon, by kind of order. */
export const stopColor = (order) => KIND_COLOR[order.kind] ?? STOP_COLOR;

/** Il centro del campo dello Stadio Maradona: dove aspetta il Dio del Calcio. */
const [pitchX, pitchY] = STADIUM_GATE.pitch;
const STADIUM_PITCH = {
  x: pitchX * TILE,
  y: pitchY * TILE,
  street: 'Stadio Diego Armando Maradona',
  label: 'Stadio Diego Armando Maradona, centrocampo',
  district: 'Fuorigrotta',
};

/** I clienti speciali, ognuno al suo monumento. */
const VIPS = VIP_CUSTOMERS.map((c) => {
  const [x, y] = snapToWalkable(...c.at);
  return {
    name: c.name,
    address: {
      x,
      y,
      street: c.place,
      label: c.place,
      district: districtAt(Math.floor(x / TILE), Math.floor(y / TILE)),
    },
  };
});
const vipData = (name) => VIP_CUSTOMERS.find((c) => c.name === name);

export const career = new Career({
  pizzerias: PIZZERIAS,
  menu: MENU,
  surnames: SURNAMES,
  rules: RULES,
  findAddress,
  stadium: STADIUM_PITCH,
  vips: VIPS,
  blessed: readBlessing(),
  onEvent: handleEvent,
});

// ---------------------------------------------------------------------------
// Conversations in speech bubbles (played by main.js, which owns the people)
// ---------------------------------------------------------------------------
let talkHandler = () => {};
/** main.js tells us how to start a conversation: `fn({ kind, lines, ... })`. */
export const onTalk = (fn) => (talkHandler = fn);

/** What the pizzaiolo says during the trial deliveries: the rules, a bit at a time. */
function stageLines(n) {
  const pct = (v) => `${Math.round(v * 100)}%`;
  const [minP, maxP] = RULES.pizzasPerOrder;
  const [minT, maxT] = RULES.tipRange;
  const lines = {
    1: [
      `Benvenuto, Gennà! 'E primme ${RULES.stage.orders} consegne so' 'e prova: nun te pago, ma t'imparo 'o mestiere.`,
      "'E pizze se caricano sole sole quanno passe annanz' 'a porta.",
      `Tiene ${clock(RULES.orderTime)} pe' purtà tutto. 'A freccia te mostra addò ià ì.`,
      "Pe' consegnà, passa chiano chiano annanz' 'o portone d''o cliente.",
    ],
    2: [
      `Ogni ordine so' ${minP}-${maxP} pizze pe' ${RULES.familiesPerOrder} famiglie, sparse pe' tutta Napule.`,
      `Si sierve na famiglia dint' ${RULES.tipWindow} secondi, te lassa 'a mancia: ${pct(minT)}-${pct(maxT)}.`,
      `E 'e ${RULES.tipWindow} secondi ripartono dopo ogni famiglia: nun perdere tiempo!`,
      `Nu nuovo ordine ogni ${clock(RULES.orderInterval)}. Si turne primma a mani vacante, arriva subito.`,
    ],
    3: [
      `Quanno faje overo: ${euro(RULES.basePay)} a ordine, cchiù 'o ${pct(RULES.commission)} d''e pizze, cchiù 'e mance.`,
      `Ma ogni pizza ca perde, ${pct(RULES.firingChancePerPizza)} ca te caccio!`,
      `Dopo ${RULES.schedule.maxOrders} ordine 'e clienti se so' magnate tutto: pe' chillo juorno è fernuto.`,
      "Bravo, Gennà: 'a prova è fernuta. Dal prossimo ordine se pava!",
    ],
  };
  return lines[n] ?? [];
}

// ---------------------------------------------------------------------------
// Queries for the renderer
// ---------------------------------------------------------------------------
const STANDING_LOOK = {
  employer: { color: '#ffd23f', tag: 'IL TUO LAVORO' },
  unknown: { color: '#d9c9a8', tag: '' }, // chissà: bisogna entrare e chiedere
  hiring: { color: '#39d46a', tag: 'CERCANO UN FATTORINO' },
  notHiring: { color: '#9a8f7a', tag: 'OGGI NON ASSUMONO' },
  busy: { color: '#9a8f7a', tag: '' },
  banned: { color: '#e0412f', tag: 'NON TI VOGLIONO' },
};
export const pizzeriaLook = (p) => STANDING_LOOK[career.standingWith(p.id)];

export function nearestPizzeria(x, y, range = PIZZERIA_RANGE) {
  return PIZZERIAS.find((p) => Math.hypot(p.pos[0] - x, p.pos[1] - y) < range) ?? null;
}

export const nearGarage = (x, y, range = PIZZERIA_RANGE + 16) =>
  Math.hypot(GARAGE.pos[0] - x, GARAGE.pos[1] - y) < range;

export const nearRepairShop = (x, y, range = PIZZERIA_RANGE + 16) =>
  Math.hypot(REPAIR_SHOP.pos[0] - x, REPAIR_SHOP.pos[1] - y) < range;

/** The secret mission, while it is on (null otherwise). */
export const legendOrder = () => career.activeOrders.find((o) => o.kind === OrderKind.LEGEND) ?? null;

/** A line the mechanic says when Gennaro turns up: `repair` (Gianturco) or `tuning` (Fuorigrotta). */
export const mechanicLine = (shop) => pick(MECHANIC_LINES[shop]);

/** The special customer waiting by a monument (null if none), with their look and catchphrase. */
export function vipOrder() {
  const order = career.activeOrders.find((o) => o.kind === OrderKind.VIP);
  return order ? { order, customer: vipData(order.vip) } : null;
}

/** The footballer waiting in the street for his pizza (null if none). */
export const footballerOrder = () => career.activeOrders.find((o) => o.kind === OrderKind.FOOTBALLER) ?? null;

/** Undelivered stops whose pizzas Gennaro is carrying. */
export const pendingStops = () =>
  career.activeOrders
    .filter((o) => o.pickedUp)
    .flatMap((order) => order.stops.filter((s) => !s.delivered).map((stop) => ({ order, stop })));

export const pizzasOnBoard = () => pendingStops().reduce((n, { stop }) => n + stop.pizzas.length, 0);

/** Pizzerias worth visiting while job hunting: not yet asked, or known to be hiring. */
const worthAsking = (p) => ['unknown', 'hiring'].includes(career.standingWith(p.id));

/** Employed and with pizzas waiting at the counter (or nothing to do: go back for the next order). */
function needsShop() {
  if (career.status !== 'employed') return false;
  if (career.activeOrders.some((o) => !o.pickedUp)) return true;
  return !career.soldOut && !pendingStops().length; // a pizzeria chiusa non c'è niente da ritirare
}

/** Sold out for today: the other pizzerias always have an extra delivery (one at a time). */
const extraWanted = (p) => career.closedToday && career.canAskSideJob(p.id);

/** Where to go now: the nearest customer door, the pizzeria, or the next pizzeria to ask for a job. */
export function currentObjective(player) {
  const targets = pendingStops().map(({ order, stop }) => ({
    x: stop.address.x,
    y: stop.address.y,
    color: stopColor(order),
  }));
  const shop = career.job?.pizzeria;
  if (shop && needsShop()) targets.push({ x: shop.pos[0], y: shop.pos[1], color: '#ffffff' });
  // Pizze da ritirare in un'altra pizzeria (la missione segreta, da disoccupato).
  for (const o of career.activeOrders)
    if (!o.pickedUp && o.pizzeria !== shop)
      targets.push({ x: o.pizzeria.pos[0], y: o.pizzeria.pos[1], color: stopColor(o) });
  if (!pendingStops().length)
    for (const p of PIZZERIAS.filter(extraWanted)) targets.push({ x: p.pos[0], y: p.pos[1], color: SIDE_COLOR });
  if (career.status === 'unemployed')
    for (const p of PIZZERIAS.filter(worthAsking)) targets.push({ x: p.pos[0], y: p.pos[1], color: '#ffd23f' });
  let best = null;
  let bestD = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.x - player.x, t.y - player.y);
    if (d < bestD) [best, bestD] = [t, d];
  }
  return best;
}

/** Markers for the radar and the street map. */
export function jobMarkers(t) {
  const markers = PIZZERIAS.map((p) => {
    const standing = career.standingWith(p.id);
    const pickup = career.activeOrders.some((o) => !o.pickedUp && o.pizzeria === p);
    const wanted =
      (career.status === 'unemployed' && worthAsking(p)) ||
      (standing === 'employer' && needsShop()) ||
      pickup ||
      extraWanted(p);
    return {
      kind: 'pizzeria',
      x: p.pos[0],
      y: p.pos[1],
      color: STANDING_LOOK[standing].color,
      crossed: standing === 'banned',
      label: p.name,
      pulse: wanted ? t : 0,
    };
  });
  for (const g of [GARAGE, REPAIR_SHOP])
    markers.push({ kind: 'garage', x: g.pos[0], y: g.pos[1], color: g.color, label: g.name });
  for (const { order, stop } of pendingStops())
    markers.push({
      kind: 'stop',
      x: stop.address.x,
      y: stop.address.y,
      color: stopColor(order),
      text: String(stop.pizzas.length),
      label: `${stop.family} · #${order.number}`,
      pulse: t,
    });
  return markers;
}

// ---------------------------------------------------------------------------
// Pizzeria counter (press E at the door)
// ---------------------------------------------------------------------------
const menuTable = () =>
  `<table class="menu">${MENU.map(
    (p) =>
      html`<tr>
        <td>${p.nome}</td>
        <td>${euro(p.prezzo)}</td>
      </tr>`,
  ).join('')}</table>`;

const rulesText = () =>
  html`<p class="small">
    Ogni ${clock(RULES.orderInterval)} parte un ordine da 3 a 7 pizze per tre famiglie (se torni qui a mani vuote prima,
    ne arriva uno in pochi secondi): hai ${clock(RULES.orderTime)} per ritirarle e consegnarle. Paga:
    ${euro(RULES.basePay)} a consegna se servi almeno una famiglia + ${RULES.commission * 100}% del valore consegnato +
    mance (5-20%) per ogni famiglia servita entro ${RULES.tipWindow} secondi dal ritiro o dalla consegna precedente.
    Dopo ${RULES.schedule.maxOrders} ordini per oggi si chiude. Ogni pizza persa:
    ${Math.round(RULES.firingChancePerPizza * 100)}% di rischio licenziamento.
  </p>`;

const sideJobText = () =>
  html`<p>«Guagliò, tengo ${RULES.sideJob.pizzas} pizze pe' na famiglia luntana assaje. Te le puorte tu?»</p>
    <p class="small">
      Consegna extra: ${clock(RULES.sideJob.time)} di tempo, paga il doppio di una consegna normale. Il tuo datore di
      lavoro non ne saprà niente.
    </p>`;

export function openPizzeria(p) {
  const close = { label: 'Arrivederci', cancel: true };
  const show = (body, buttons) =>
    showDialog({ title: p.name.toUpperCase(), color: p.color, body, buttons: [...buttons, close] });

  const standing = career.ask(p.id);
  // Le altre pizzerie, una volta su quattro, hanno una consegna extra da affidarti.
  const asked = ['hiring', 'notHiring', 'busy'].includes(standing) && career.canAskSideJob(p.id);
  const side = asked && career.askSideJob(p.id);
  const sideBody = side
    ? sideJobText()
    : asked
      ? html`<p class="small">Consegne extra da fare? Pe' mo' no. Ripassa più tardi.</p>`
      : '';
  const sideButtons = side ? [{ label: 'Porta le pizze', run: () => career.takeSideJob(p.id) }] : [];

  switch (standing) {
    case 'hiring':
      return show(
        html`<p>«Guagliò, ci serve proprio un fattorino!»</p>
          ${raw(
            career.stageLeft > 0
              ? html`<p class="small">
                  Le prime ${RULES.stage.orders} consegne sono di prova e non si pagano: il pizzaiolo ti spiega come
                  funziona.
                </p>`
              : rulesText(),
          )}${raw(menuTable())}${raw(sideBody)}`,
        [{ label: 'Fatti assumere', run: () => career.hire(p.id) }, ...sideButtons],
      );
    case 'notHiring':
      return show(
        html`<p>«Mi dispiace, pe' mo' nun cercammo a nisciuno.»</p>
          <p class="small">Prova nelle altre pizzerie, o ripassa domani.</p>
          ${raw(sideBody)}`,
        sideButtons,
      );
    case 'busy':
      return show(
        html`<p>«Ma tu nun faje già 'e cunsegne p' ${career.pizzeria(career.employer).name}?»</p>
          ${raw(sideBody)}`,
        sideButtons,
      );
    case 'banned':
      return show(
        html`<p>«Tu? Ccà nun ce mettere pede, almeno pe' nu poco!»</p>
          <p class="small">
            Chi lascia (o perde) il lavoro qui deve aspettare ${RULES.rehireAfterDays} giorni prima di poter essere
            forse riassunto.
          </p>`,
        [],
      );
    case 'employer': {
      const quit = {
        label: 'Licenziati',
        run: () =>
          showDialog({
            title: 'SEI SICURO?',
            color: '#e0412f',
            body: html`<p>
              Se te ne vai, ${p.name} non ti riprenderà per almeno ${RULES.rehireAfterDays} giorni. Le pizze che stai
              portando andranno perse.
            </p>`,
            buttons: [
              { label: 'Sì, me ne vado', run: () => career.quit() },
              { label: 'No, resto', cancel: true },
            ],
          }),
      };
      const waiting = career.activeOrders.filter((o) => !o.pickedUp).length;
      const next = career.nextOrderIn;
      const status = career.closedToday
        ? "«'E clienti se so' magnate tutto! Pe' oggi è fernuto.» Le altre pizzerie hanno consegne extra per te."
        : waiting
          ? `Hai ${plural(waiting, 'ordine', 'ordini')} da ritirare: le pizze si caricano da sole quando passi davanti alla porta.`
          : career.activeOrders.length || career.soldOut
            ? 'Tutti gli ordini sono in consegna.'
            : `Il prossimo ordine arriva tra ${clock(next)}.`;
      return show(
        html`<p>«Jamme, Gennà, 'e pizze se fanno fredde!»</p>
          <p class="small">${status}</p>`,
        [quit],
      );
    }
  }
}

// ---------------------------------------------------------------------------
// The mechanic in Fuorigrotta (press E at the door, with the Vespa)
// ---------------------------------------------------------------------------
export function openGarage(vespa) {
  const { cost, speed } = RULES.tuning;
  const faster = `${Math.round((speed - 1) * 100)}%`;
  const close = { label: 'Arrivederci', cancel: true };
  const line = html`<p class="small">«${mechanicLine('tuning')}»</p>`;
  const show = (body, buttons = []) =>
    showDialog({
      title: GARAGE.name.toUpperCase(),
      color: GARAGE.color,
      body: body + line,
      buttons: [...buttons, close],
    });

  if (!vespa)
    return show(
      html`<p>«E 'o motorino addò sta? Purtammillo ccà e t'o faccio vulà!»</p>
        <p class="small">Torna in Vespa: per ${euro(cost)} la modifico e va il ${faster} più veloce.</p>`,
    );
  if (career.isTuned(vespa))
    return show(html`<p>«Chesta Vespa già l'aggio fatta io. Cchiù veloce 'e accussì nun se po'!»</p>`);
  if (career.wallet < cost)
    return show(
      html`<p>«Pe' te fa' 'a Vespa ce vonno ${euro(cost)}, e tu ne tieni ${euro(career.wallet)}.»</p>
        <p class="small">Torna quando hai messo da parte i soldi.</p>`,
    );
  return show(
    html`<p>«Marmitta nova, carburatore alleggerito... e chesta Vespa vola!»</p>
      <p class="small">Costa ${euro(cost)}: la Vespa con cui sei arrivato andrà il ${faster} più veloce.</p>`,
    [{ label: `Modifica (${euro(cost)})`, run: () => career.tune(vespa) }],
  );
}

// ---------------------------------------------------------------------------
// The mechanic in Via Gianturco: the only one who repairs a dented Vespa
// ---------------------------------------------------------------------------
export const conditionPct = (vespa) => Math.round((vespa?.condition ?? 1) * 100);

export function openRepairShop(vespa) {
  const close = { label: 'Arrivederci', cancel: true };
  const line = html`<p>«${mechanicLine('repair')}»</p>`;
  const show = (body, buttons = []) =>
    showDialog({
      title: REPAIR_SHOP.name.toUpperCase(),
      color: REPAIR_SHOP.color,
      body: line + body,
      buttons: [...buttons, close],
    });

  if (!vespa)
    return show(
      html`<p class="small">
        Porta qui la Vespa: ogni urto la rallenta un po', e solo qui in Via Gianturco si ripara.
      </p>`,
    );
  const cost = career.repairCost(vespa);
  if (cost <= 0) return show(html`<p class="small">«Chesta Vespa sta bona accussì. Nun tocco niente.»</p>`);
  const state = html`<p class="small">
    La Vespa va al ${conditionPct(vespa)}% della sua velocità. Ripararla costa ${euro(cost)}
    (${euro(RULES.repair.costPerPoint)} per ogni punto).
  </p>`;
  if (career.wallet < cost)
    return show(
      html`${raw(state)}
        <p class="small">Hai ${euro(career.wallet)}: torna quando hai i soldi.</p>`,
    );
  return show(state, [{ label: `Ripara (${euro(cost)})`, run: () => career.repair(vespa) }]);
}

// ---------------------------------------------------------------------------
// Career events → feedback
// ---------------------------------------------------------------------------
const orderRows = (orders) =>
  orders
    .map(
      (o) =>
        html`<tr>
          <td>#${o.number}</td>
          <td>${o.pizzaCount} pizze</td>
          <td>${o.state === 'done' ? 'OK' : `-${o.missed}`}</td>
          <td>${o.stage ? 'prova' : euro(o.pay.total)}</td>
        </tr>`,
    )
    .join('');

const row = (label, value, cls = '') =>
  html`<tr class="${cls}">
    <td>${label}</td>
    <td>${value}</td>
  </tr>`;

function dayReport({ ledger, earned, living, wallet, daysInRed }) {
  const { pay } = ledger;
  const paid = ledger.orders.filter((o) => o.pay.base).length;
  const warning =
    daysInRed === 0
      ? ''
      : daysInRed >= RULES.maxDaysInRed
        ? 'Sei rimasto senza soldi per troppo tempo.'
        : `Sei in rosso da ${plural(daysInRed, 'giorno', 'giorni')}: al ${RULES.maxDaysInRed}° è game over!`;
  const job =
    career.status === 'employed'
      ? `Domani si lavora ancora da ${career.job.pizzeria.name}.`
      : 'Domani alcune pizzerie potrebbero cercare un fattorino: fai il giro!';
  queueDialog({
    title: `FINE GIORNO ${ledger.day}`,
    color: daysInRed ? '#e0412f' : '#ffd23f',
    body: html`${raw(ledger.orders.length ? `<table class="report">${orderRows(ledger.orders)}</table>` : '')}
      <table class="menu">
        ${raw(row(`Fisso (${paid} × ${euro(RULES.basePay)})`, euro(pay.base)))}
        ${raw(row(`Percentuale ${RULES.commission * 100}%`, euro(pay.commission)))} ${raw(row('Mance', euro(pay.tips)))}
        ${raw(pay.bonus ? row('Bonus (extra e calciatore)', euro(pay.bonus)) : '')}
        ${raw(row('Guadagno della giornata', euro(earned), 'total'))} ${raw(row('Spese per vivere', euro(-living)))}
        ${raw(row('Nel portafoglio', euro(wallet), 'total'))}
      </table>
      ${raw(warning ? html`<p class="warn">${warning}</p>` : '')}
      ${raw(career.status === 'broke' ? '' : html`<p class="small">${job}</p>`)}`,
    buttons: [{ label: 'Continua', cancel: true, badge: '↵' }],
  });
}

function leftJobDialog({ type, pizzeria, rehireDay }) {
  queueDialog({
    title: type === 'fired' ? 'SEI LICENZIATO!' : 'TI SEI LICENZIATO',
    color: '#e0412f',
    body: html`<p>
        ${type === 'fired' ? `«Troppe pizze perse! Vattenne.» — ${pizzeria.name}` : `Hai lasciato ${pizzeria.name}.`}
      </p>
      <p class="small">
        Non ti riprenderanno prima del giorno ${rehireDay}. Ora sei disoccupato: fai il giro delle pizzerie per sapere
        chi cerca un fattorino.
      </p>`,
    buttons: [{ label: 'Continua', cancel: true, badge: '↵' }],
  });
}

/** Gennaro and the special customer have a chat in speech bubbles: the first time is different from the next ones. */
function vipChat(name, stop) {
  const c = vipData(name);
  if (!c) return;
  talkHandler({ kind: 'vip', name, customer: c, address: stop.address, lines: stop.visit > 1 ? c.again : c.first });
  if (stop.tip) toast(`${name} ti lascia una mancia di ${euro(stop.tip)}`, VIP_COLOR, 4);
}

function handleEvent(e) {
  switch (e.type) {
    case 'hired':
      sfx.coins();
      showBanner('Assunto!');
      toast(
        career.stageLeft > 0
          ? `Assunto da ${e.pizzeria.name}! Prima ${RULES.stage.orders} consegne di prova: ascolta il pizzaiolo`
          : `Assunto da ${e.pizzeria.name}! Arriva il primo ordine`,
        '#39d46a',
        5,
      );
      break;
    case 'orderCreated': {
      const o = e.order;
      sfx.newOrder();
      if (o.kind === OrderKind.FOOTBALLER) {
        showBanner('Un calciatore del Napoli!', 4);
        toast(
          `Un calciatore del Napoli ti ha chiesto una pizza: ${clock(RULES.footballer.time)} per portargliela!`,
          FOOTBALLER_COLOR,
          6,
        );
      } else if (o.kind === OrderKind.LEGEND) {
        showBanner('Richiesta speciale', 4);
        const where = o.pizzeria.id === career.employer ? 'in pizzeria' : `da ${o.pizzeria.name}`;
        queueDialog({
          title: 'UNA RICHIESTA MISTERIOSA',
          color: LEGEND_COLOR,
          body: html`<p>«Guagliò, nu calciatore vò na pizza... e t'aspetta <b>dint' 'o Stadio</b>!»</p>
            <p class="small">
              Ritira la pizza ${where} e portala al centrocampo dello Stadio Maradona: i cancelli dal lato di Piazzale
              Tecchio sono aperti. Hai ${clock(RULES.legend.time)}.
            </p>`,
          buttons: [{ label: 'Jamme!', cancel: true, badge: '↵' }],
        });
      } else if (o.kind === OrderKind.VIP) {
        const c = vipData(o.vip);
        showBanner('Cliente speciale!', 4);
        toast(
          `${o.vip} vuole le pizze solo da Gennaro: ${o.pizzaCount} pizze a ${c.place}. Dal ritiro hai ${clock(RULES.vip.time)}!`,
          VIP_COLOR,
          7,
        );
      } else if (o.kind === OrderKind.SIDE) {
        toast(`Consegna extra per ${o.pizzeria.name}: ${o.pizzaCount} pizze, lontano!`, SIDE_COLOR, 4.5);
      } else if (o.stage) {
        toast(`Consegna di prova ${o.stage}/${RULES.stage.orders}: ${o.pizzaCount} pizze, non pagata`, STOP_COLOR, 4.5);
        talkHandler({ kind: 'stage', pizzeria: o.pizzeria, lines: stageLines(o.stage) });
      } else {
        toast(
          `Nuovo ordine #${o.number}: ${o.pizzaCount} pizze, ${clock(RULES.orderTime)} per consegnarle!`,
          STOP_COLOR,
          4.5,
        );
      }
      break;
    }
    case 'boost': {
      const pct = Math.round((e.multiplier - 1) * 100);
      sfx.coins();
      showBanner(`Bonus +${pct}%`, 3.5);
      toast(
        `Il calciatore ringrazia: guadagni +${pct}% fino alla fine del giorno ${Math.round(e.until / RULES.dayLength)}!`,
        FOOTBALLER_COLOR,
        6,
      );
      break;
    }
    case 'tuned':
      sfx.coins();
      showBanner('Vespa modificata!', 3.5);
      toast(
        `Spesi ${euro(e.cost)}: ora la Vespa va il ${Math.round((RULES.tuning.speed - 1) * 100)}% più veloce`,
        '#5ec8ff',
        5,
      );
      break;
    case 'blessed':
      saveBlessing();
      queueDialog({
        title: 'MAGLIA AZZURRA',
        color: LEGEND_COLOR,
        body: html`<p>La maglia rossa di Gennaro è diventata <b>azzurra</b>.</p>
          <p class="small">
            Da oggi ogni calciatore che servi ti dà ${euro(RULES.footballer.blessedTip)} in più. Per sempre, anche nelle
            partite nuove.
          </p>`,
        buttons: [{ label: 'Forza Napoli!', cancel: true, badge: '↵' }],
      });
      break;
    case 'repaired':
      sfx.coins();
      showBanner('Vespa riparata!', 3);
      toast(`Spesi ${euro(e.cost)}: la Vespa è tornata come nuova`, REPAIR_SHOP.color, 4.5);
      break;
    case 'soldOut':
      sfx.coins();
      showBanner('Finito tutto!', 4);
      queueDialog({
        title: e.pizzeria.name.toUpperCase(),
        color: e.pizzeria.color,
        body: html`<p>
            «Gennà, 'e clienti se so' magnate tutto! Nun è rimasto manco nu poco 'e pasta: pe' oggi avimmo fernuto.»
          </p>
          <p class="small">
            Domani si ricomincia. Fino a fine giornata le altre pizzerie hanno sempre una consegna extra da affidarti:
            passa da loro e chiedi (E).
          </p>`,
        buttons: [{ label: 'Jamme!', cancel: true, badge: '↵' }],
      });
      break;
    case 'earlyOrder':
      toast(`Sei tornato presto: nuovo ordine tra ${Math.ceil(e.in)} secondi`, '#fff', 4);
      break;
    case 'pickedUp':
      sfx.pickup();
      if (e.order.kind === OrderKind.VIP) {
        toast(`Le ${e.order.pizzaCount} pizze di ${e.order.vip}: corri, hai ${clock(RULES.vip.time)}!`, VIP_COLOR, 4);
        break;
      }
      toast(`Ordine #${e.order.number} caricato: ${e.order.stops.map((s) => s.family).join(', ')}`, '#fff', 4);
      break;
    case 'delivered': {
      const { stop } = e;
      sfx.delivered();
      if (e.order.kind === OrderKind.FOOTBALLER) {
        toast(
          stop.tip
            ? `«Tu si' chillo d' 'o Dio d' 'o Calcio!» Il calciatore ti dà ${euro(stop.tip)}`
            : 'Pizza consegnata al calciatore: offre la casa! «Grazie, guagliò!»',
          FOOTBALLER_COLOR,
          4,
        );
        break;
      }
      if (e.order.kind === OrderKind.VIP) {
        vipChat(e.order.vip, stop);
        break;
      }
      if (e.order.kind === OrderKind.LEGEND) {
        sfx.coins();
        showBanner('Il Dio del Calcio', 4);
        toast(`Mancia extra di ${euro(stop.tip)}!`, LEGEND_COLOR, 6);
        break;
      }
      const tip = stop.tip ? ` · mancia ${euro(stop.tip)}!` : '';
      toast(`Consegnato a fam. ${stop.family} (${euro(orderValue(stop))})${tip}`, stop.tip ? '#39ff88' : '#fff', 4);
      break;
    }
    case 'orderClosed':
      if (e.order.kind === OrderKind.LEGEND) {
        if (e.missed) {
          sfx.failed();
          toast("Al centrocampo non c'è più nessuno. Chissà chi era...", '#ff5b4b', 5);
        } else toast(`Richiesta speciale completata: +${euro(e.pay.total)}`, LEGEND_COLOR, 4);
      } else if (e.order.kind === OrderKind.VIP) {
        if (e.missed) {
          sfx.failed();
          toast(`${e.order.vip} ha aspettato troppo: ${e.missed} pizze perse`, '#ff5b4b', 5);
        } else {
          sfx.coins();
          toast(`Cliente speciale servito: +${euro(e.pay.total)}`, VIP_COLOR, 4);
        }
      } else if (e.order.kind === OrderKind.FOOTBALLER) {
        if (e.missed) {
          sfx.failed();
          toast('Il calciatore è andato via senza pizza: niente bonus', '#ff5b4b', 4.5);
        }
      } else if (e.order.stage) {
        if (e.missed) sfx.failed();
        else sfx.coins();
        toast(
          e.missed
            ? `Prova ${e.order.stage}: ${plural(e.missed, 'pizza persa', 'pizze perse')}. Per stavolta niente guai`
            : `Consegna di prova ${e.order.stage}/${RULES.stage.orders} completata!`,
          e.missed ? '#ff5b4b' : '#ffd23f',
          4,
        );
      } else if (e.missed) {
        sfx.failed();
        toast(`Ordine #${e.order.number} scaduto: ${plural(e.missed, 'pizza persa', 'pizze perse')}`, '#ff5b4b', 4.5);
      } else {
        sfx.coins();
        toast(`Ordine #${e.order.number} completato: +${euro(e.pay.total)}`, '#ffd23f', 4);
      }
      break;
    case 'fired':
      sfx.fired();
      leftJobDialog(e);
      break;
    case 'quit':
      leftJobDialog(e);
      break;
    case 'dayEnded':
      showBanner(`Giorno ${e.ledger.day + 1}`);
      dayReport(e);
      break;
    case 'gameOver':
      sfx.fired();
      clearSave();
      queueDialog({
        title: "NAPULE NUN TE VO' CCHIÙ",
        color: '#e0412f',
        body: html`<p>
            Gennaro è rimasto in rosso per ${RULES.maxDaysInRed} giorni di fila e non ce la fa più a vivere.
          </p>
          <p>Hai resistito ${plural(career.day - 1, 'giorno', 'giorni')}.</p>`,
        buttons: [{ label: 'Ricomincia', run: () => location.reload() }],
        dismissable: false,
      });
      break;
  }
}
