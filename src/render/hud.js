import { clamp } from '../core/math.js';
import { clock, euro } from '../core/format.js';
import { time } from '../core/time.js';
import { ctx, fitText, outlinedText, pixelFont, screen, withAlpha, wrapText } from './canvas.js';
import { camera } from './camera.js';
import { STOP_COLOR } from './delivery.js';

// ---------------------------------------------------------------------------
// Big district banner + stacked toasts
// ---------------------------------------------------------------------------
const banner = { text: '', t: 0, duration: 3.2 };
export function showBanner(text, seconds = 3.2) {
  Object.assign(banner, { text, t: seconds, duration: seconds });
}

const toasts = [];
export function toast(text, color = '#fff', seconds = 3.5) {
  toasts.push({ text, color, t: seconds });
  if (toasts.length > 4) toasts.shift();
}

export function tickHud(dt) {
  if (banner.t > 0) banner.t -= dt;
  for (const t of toasts) t.t -= dt;
  while (toasts.length && toasts[0].t <= 0) toasts.shift();
}

function drawBanner(y) {
  if (banner.t <= 0) return;
  const a = clamp(Math.min(1, banner.t * 1.5, (banner.duration - banner.t) * 4), 0, 1);
  withAlpha(a, () =>
    outlinedText(banner.text.toUpperCase(), screen.w / 2, y, screen.small ? 15 : 26, '#ffd23f', 'center'),
  );
}

function drawToasts(y) {
  const size = screen.small ? 8 : 11;
  const lh = size + (screen.small ? 8 : 12);
  for (const t of toasts.slice(screen.small ? -2 : 0)) {
    const lines = wrapText(t.text, screen.w - 40, size);
    withAlpha(clamp(t.t * 2, 0, 1), () => {
      for (const line of lines) {
        outlinedText(line, screen.w / 2, y, size, t.color, 'center');
        y += lh;
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Bottom-left: where am I, how am I moving. Centre: what E does here.
// ---------------------------------------------------------------------------
function drawStatus({ street, landmark, mode, touch }) {
  const fs = screen.small ? 8 : 11;
  const lines = [];
  if (street) lines.push([street, '#ffffff']);
  if (landmark && landmark !== street) lines.push([`★ ${landmark}`, '#7fc8f8']);
  lines.push(mode);
  const by = screen.h - (touch ? 190 : 18);
  lines.reverse().forEach(([s, c], k) => outlinedText(s, 16, by - k * (fs + 10), fs, c));
}

function drawPrompt(text) {
  if (!text) return;
  withAlpha(0.6 + 0.4 * Math.sin(time.t * 6), () =>
    outlinedText(text, screen.w / 2, screen.h / 2 + 70 * camera.zoom, screen.small ? 9 : 12, '#39ff88', 'center'),
  );
}

function drawHint(text, touch) {
  if (!text) return;
  outlinedText(text, screen.w / 2, screen.h - (touch ? 200 : 40), screen.small ? 7 : 10, '#ffffff', 'center');
}

// ---------------------------------------------------------------------------
// Top-left: the job panel.
// ---------------------------------------------------------------------------
function panelLines(career, player) {
  const out = [];
  const add = (text, color = '#f3ead2', size = 0) => out.push({ text, color, size });
  const broke = career.wallet < 0;
  add(`${player.name.toUpperCase()} · ${euro(career.wallet)}`, broke ? '#ff7b6b' : '#ffd23f', 1);
  add(`GIORNO ${career.day} · finisce tra ${clock(career.dayTimeLeft)}`, '#cfc6b0');
  if (career.daysInRed) add(`IN ROSSO: GIORNO ${career.daysInRed} DI ${career.rules.maxDaysInRed}`, '#ff5b4b');

  if (career.status === 'broke') return out;
  if (career.status === 'unemployed') {
    add('DISOCCUPATO', '#ff9f6b');
    add('Fai il giro delle pizzerie e chiedi (E)', '#cfc6b0');
    return out;
  }
  add(career.job.pizzeria.name.toUpperCase(), '#6fdc8c');
  const next = career.nextOrderIn;
  if (!career.activeOrders.length) add(`Prossimo ordine tra ${clock(next)}: torna in pizzeria!`, '#cfc6b0');
  else if (next > 0) add(`Prossimo ordine tra ${clock(next)}`, '#cfc6b0');

  for (const order of career.activeOrders) {
    const t = career.timeLeft(order);
    const urgent = t < 30;
    const tip = career.tipTimeLeft(order);
    add(
      `#${order.number}  ${clock(t)}${tip > 0 && order.pickedUp ? `  MANCIA ${clock(tip)}` : ''}`,
      urgent && Math.sin(time.t * 10) > 0 ? '#ff5b4b' : STOP_COLOR,
      1,
    );
    if (!order.pickedUp) {
      add(`  ritira ${order.pizzaCount} pizze in pizzeria`, '#ffffff');
      continue;
    }
    for (const s of order.stops) {
      const n = s.pizzas.length;
      add(
        s.delivered ? `  OK ${s.family} (${n})` : `  • ${s.family} (${n}) ${s.address.label}`,
        s.delivered ? '#7d9b7d' : '#ffffff',
      );
    }
  }
  return out;
}

/**
 * Draws the job panel at (x, y) and returns its bottom edge. On phones it sits
 * under the radar at full width; on desktop it hugs the top-left corner.
 */
function drawJobPanel(career, player, x, y, maxWidth) {
  const fs = screen.small ? 7 : 9;
  const lh = fs + (screen.small ? 7 : 9);
  const lines = panelLines(career, player).map((l) => ({ ...l, text: fitText(l.text, maxWidth - 20, fs + l.size) }));
  const width = Math.min(
    maxWidth,
    Math.max(...lines.map((l) => (ctx.font = pixelFont(fs + l.size)) && ctx.measureText(l.text).width)) + 24,
  );
  const height = lines.length * lh + 10;
  ctx.fillStyle = 'rgba(20,16,12,.72)';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x, y, 3, height);
  lines.forEach((l, k) => outlinedText(l.text, x + 10, y + 2 + (k + 1) * lh, fs + l.size, l.color));
  return y + height;
}

export function drawHud({ career, player, status, prompt, hint, radarBottom }) {
  if (screen.small) {
    const bottom = drawJobPanel(career, player, 12, radarBottom + 10, screen.w - 24);
    drawBanner(bottom + 34);
    drawToasts(bottom + 60);
  } else {
    drawJobPanel(career, player, 12, 52, Math.min(560, screen.w - 260));
    drawBanner(84);
    drawToasts(124);
  }
  drawStatus(status);
  if (prompt) drawPrompt(prompt);
  else drawHint(hint, status.touch);
}
