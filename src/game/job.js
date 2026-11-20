// Glue between the Career logic and the game: places the pizzerias on the
// map, turns career events into sounds/toasts/dialogs, and tells the HUD
// where Gennaro should go next.

import { clock, euro, plural } from '../core/format.js';
import { MENU, PIZZERIAS, RULES, SURNAMES } from '../data/pizza.js';
import { snapToWalkable } from '../world/map.js';
import { sfx } from '../audio.js';
import { html, queueDialog, raw, showDialog } from '../ui/dialog.js';
import { showBanner, toast } from '../render/hud.js';
import { STOP_COLOR } from '../render/delivery.js';
import { Career, orderValue } from './career.js';
import { findAddress } from './addresses.js';

export const PIZZERIA_RANGE = 44;

for (const p of PIZZERIAS) p.pos = snapToWalkable(...p.at);

export const career = new Career({
  pizzerias: PIZZERIAS,
  menu: MENU,
  surnames: SURNAMES,
  rules: RULES,
  findAddress,
  onEvent: handleEvent,
});

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

/** Undelivered stops whose pizzas Gennaro is carrying. */
export const pendingStops = () =>
  career.activeOrders
    .filter((o) => o.pickedUp)
    .flatMap((order) => order.stops.filter((s) => !s.delivered).map((stop) => ({ order, stop })));

export const pizzasOnBoard = () => pendingStops().reduce((n, { stop }) => n + stop.pizzas.length, 0);

/** Pizzerias worth visiting while job hunting: not yet asked, or known to be hiring. */
const worthAsking = (p) => ['unknown', 'hiring'].includes(career.standingWith(p.id));

/** Employed and with pizzas waiting at the counter (or nothing to do: go back for the next order). */
const needsShop = () =>
  career.status === 'employed' && (!pendingStops().length || career.activeOrders.some((o) => !o.pickedUp));

/** Where to go now: the nearest customer door, the pizzeria, or the next pizzeria to ask for a job. */
export function currentObjective(player) {
  const targets = pendingStops().map(({ stop }) => ({ x: stop.address.x, y: stop.address.y, color: STOP_COLOR }));
  const shop = career.job?.pizzeria;
  if (shop && needsShop()) targets.push({ x: shop.pos[0], y: shop.pos[1], color: '#ffffff' });
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
    const wanted = (career.status === 'unemployed' && worthAsking(p)) || (standing === 'employer' && needsShop());
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
  for (const { order, stop } of pendingStops())
    markers.push({
      kind: 'stop',
      x: stop.address.x,
      y: stop.address.y,
      color: STOP_COLOR,
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
    mance (5-20%) entro il primo minuto. Ogni pizza persa: 1% di rischio licenziamento.
  </p>`;

export function openPizzeria(p) {
  const close = { label: 'Arrivederci', cancel: true };
  const show = (body, buttons) =>
    showDialog({ title: p.name.toUpperCase(), color: p.color, body, buttons: [...buttons, close] });

  switch (career.ask(p.id)) {
    case 'hiring':
      return show(
        html`<p>«Guagliò, ci serve proprio un fattorino!»</p>
          ${raw(rulesText())}${raw(menuTable())}`,
        [{ label: 'Fatti assumere', run: () => career.hire(p.id) }],
      );
    case 'notHiring':
      return show(
        html`<p>«Mi dispiace, pe' mo' nun cercammo a nisciuno.»</p>
          <p class="small">Prova nelle altre pizzerie, o ripassa domani.</p>`,
        [],
      );
    case 'busy':
      return show(html`<p>«Ma tu nun faje già 'e cunsegne p' ${career.pizzeria(career.employer).name}?»</p>`, []);
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
      const status = waiting
        ? `Hai ${plural(waiting, 'ordine', 'ordini')} da ritirare: le pizze si caricano da sole quando passi davanti alla porta.`
        : career.activeOrders.length
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
          <td>${euro(o.pay.total)}</td>
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

function handleEvent(e) {
  switch (e.type) {
    case 'hired':
      sfx.coins();
      showBanner('Assunto!');
      toast(`Assunto da ${e.pizzeria.name}! Arriva il primo ordine`, '#39d46a', 5);
      break;
    case 'orderCreated': {
      const o = e.order;
      sfx.newOrder();
      toast(
        `Nuovo ordine #${o.number}: ${o.pizzaCount} pizze, ${clock(RULES.orderTime)} per consegnarle!`,
        STOP_COLOR,
        4.5,
      );
      break;
    }
    case 'earlyOrder':
      toast(`Sei tornato presto: nuovo ordine tra ${Math.ceil(e.in)} secondi`, '#fff', 4);
      break;
    case 'pickedUp':
      sfx.pickup();
      toast(`Ordine #${e.order.number} caricato: ${e.order.stops.map((s) => s.family).join(', ')}`, '#fff', 4);
      break;
    case 'delivered': {
      const { stop } = e;
      sfx.delivered();
      const tip = stop.tip ? ` · mancia ${euro(stop.tip)}!` : '';
      toast(`Consegnato a fam. ${stop.family} (${euro(orderValue(stop))})${tip}`, stop.tip ? '#39ff88' : '#fff', 4);
      break;
    }
    case 'orderClosed':
      if (e.missed) {
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
