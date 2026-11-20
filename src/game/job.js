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
  hiring: { color: '#39d46a', tag: 'CERCASI FATTORINO' },
  notHiring: { color: '#9a8f7a', tag: '' },
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

/** Where to go now: the pizzeria (to pick up or start the shift) or the nearest door. */
export function currentObjective(player) {
  const shop = career.employer && career.pizzeria(career.employer);
  const needsShop =
    shop && (!career.onShift ? career.status === 'employed' : career.activeOrders.some((o) => !o.pickedUp));
  const targets = pendingStops().map(({ stop }) => ({ x: stop.address.x, y: stop.address.y, color: STOP_COLOR }));
  if (needsShop) targets.push({ x: shop.pos[0], y: shop.pos[1], color: '#ffffff' });
  if (career.status === 'unemployed')
    for (const id of career.openings) {
      const p = career.pizzeria(id);
      targets.push({ x: p.pos[0], y: p.pos[1], color: '#39d46a' });
    }
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
    const wanted =
      standing === 'hiring' ||
      (standing === 'employer' && (!career.onShift || career.activeOrders.some((o) => !o.pickedUp)));
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
    Ogni ${clock(RULES.orderInterval)} parte un ordine da 3 a 7 pizze per tre famiglie: hai ${clock(RULES.orderTime)}
    per ritirarle qui e consegnarle. Paga: ${euro(RULES.basePay)} a consegna + ${RULES.commission * 100}% del valore
    consegnato + mance (5-20%) se consegni entro il primo minuto. Ogni pizza persa: 1% di rischio licenziamento.
  </p>`;

export function openPizzeria(p) {
  const standing = career.standingWith(p.id);
  const close = { label: 'Arrivederci', cancel: true };
  const show = (body, buttons) =>
    showDialog({ title: p.name.toUpperCase(), color: p.color, body, buttons: [...buttons, close] });

  switch (standing) {
    case 'hiring':
      return show(
        html`<p>«Guagliò, ci serve proprio un fattorino!»</p>
          ${raw(rulesText())}${raw(menuTable())}`,
        [{ label: 'Fatti assumere', run: () => career.hire(p.id) }],
      );
    case 'notHiring':
      return show(
        html`<p>«Mi dispiace, pe' mo' nun cercammo a nisciuno.»</p>
          <p class="small">Oggi assumono: ${career.openings.map((id) => career.pizzeria(id).name).join(' e ')}.</p>`,
        [],
      );
    case 'busy':
      return show(html`<p>«Ma tu nun faje già 'e cunsegne p' ${career.pizzeria(career.employer).name}?»</p>`, []);
    case 'banned':
      return show(
        html`<p>«Tu? Ccà nun ce mettere cchiù pede!»</p>
          <p class="small">Chi lascia (o perde) il lavoro qui non viene più riassunto.</p>`,
        [],
      );
    case 'employer': {
      const quit = {
        label: 'Licenziati',
        run: () =>
          showDialog({
            title: 'SEI SICURO?',
            color: '#e0412f',
            body: html`<p>Se te ne vai, ${p.name} non ti riprenderà mai più.</p>`,
            buttons: [
              { label: 'Sì, me ne vado', run: () => career.quit() },
              { label: 'No, resto', cancel: true },
            ],
          }),
      };
      if (career.onShift) {
        const waiting = career.activeOrders.filter((o) => !o.pickedUp).length;
        return show(
          html`<p>«Jamme, Gennà, 'e pizze se fanno fredde!»</p>
            <p class="small">
              ${waiting
                ? `Hai ${plural(waiting, 'ordine', 'ordini')} da ritirare: le pizze si caricano da sole quando passi davanti alla porta.`
                : 'Tutti gli ordini sono in consegna.'}
            </p>`,
          [quit],
        );
      }
      return show(
        html`<p>«Buongiorno Gennà! Sei pronto?»</p>
          ${raw(rulesText())}`,
        [{ label: `Inizia il turno (giorno ${career.day + 1})`, run: () => career.startShift() }, quit],
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Career events → feedback
// ---------------------------------------------------------------------------
function shiftReport({ shift, reason, total }) {
  const rows = shift.orders
    .map((o) => {
      const state = o.state === 'done' ? 'OK' : `-${o.missed}`;
      return html`<tr>
        <td>#${o.number}</td>
        <td>${o.pizzaCount} pizze</td>
        <td>${state}</td>
        <td>${euro(o.pay?.total ?? 0)}</td>
      </tr>`;
    })
    .join('');
  const title = { end: `FINE GIORNO ${shift.day}`, fired: 'SEI LICENZIATO!', quit: 'TI SEI LICENZIATO' }[reason];
  const intro = {
    end: '«Bravo Gennà, per oggi abbiamo finito.»',
    fired: `«Troppe pizze perse! Vattenne e nun turnà cchiù.» — ${shift.pizzeria.name}`,
    quit: `Hai lasciato ${shift.pizzeria.name}.`,
  }[reason];
  const after =
    reason === 'end'
      ? 'Torna in pizzeria quando vuoi iniziare il prossimo giorno.'
      : career.status === 'unemployable'
        ? ''
        : `Ora sei disoccupato. Assumono: ${career.openings.map((id) => career.pizzeria(id).name).join(' e ')}.`;
  queueDialog({
    title,
    color: reason === 'end' ? '#ffd23f' : '#e0412f',
    body: html`<p>${intro}</p>
      <table class="report">
        ${raw(rows)}
      </table>
      <table class="menu">
        <tr>
          <td>Fisso (${shift.orders.length} × ${euro(RULES.basePay)})</td>
          <td>${euro(shift.pay.base)}</td>
        </tr>
        <tr>
          <td>Percentuale ${RULES.commission * 100}%</td>
          <td>${euro(shift.pay.commission)}</td>
        </tr>
        <tr>
          <td>Mance</td>
          <td>${euro(shift.pay.tips)}</td>
        </tr>
        <tr class="total">
          <td>Totale giornata</td>
          <td>${euro(total)}</td>
        </tr>
        <tr>
          <td>Nel portafoglio</td>
          <td>${euro(career.wallet)}</td>
        </tr>
      </table>
      <p class="small">${after}</p>`,
    buttons: [{ label: 'Continua', cancel: true, badge: '↵' }],
  });
}

function handleEvent(e) {
  switch (e.type) {
    case 'hired':
      sfx.coins();
      showBanner('Assunto!');
      toast(`Assunto da ${e.pizzeria.name}! Premi E per iniziare`, '#39d46a', 5);
      break;
    case 'shiftStarted':
      showBanner(`Giorno ${e.shift.day}`);
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
      break;
    case 'shiftEnded':
      shiftReport(e);
      break;
    case 'gameOver':
      queueDialog({
        title: "NAPULE NUN TE VO' CCHIÙ",
        color: '#e0412f',
        body: html`<p>Nessuna delle cinque pizzerie ti assume più.</p>
          <p>Hai guadagnato in tutto ${euro(career.wallet)}.</p>`,
        buttons: [{ label: 'Ricomincia', run: () => location.reload() }],
        dismissable: false,
      });
      break;
  }
}
