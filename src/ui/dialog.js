// A small modal dialog in the game's pixel style. Keyboard: ↑/↓ to move,
// Enter/E to choose, digits as shortcuts, Esc to close.

import { captureKeys } from '../input.js';

const root = document.getElementById('dialog');
let current = null;
const queue = [];

export const isDialogOpen = () => !!current;

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const html = (strings, ...values) =>
  strings.reduce((out, s, i) => out + s + (i < values.length ? (values[i]?.raw ?? escapeHtml(values[i])) : ''), '');
export const raw = (s) => ({ raw: s });

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.color]   header colour
 * @param {string} [opts.body]    trusted HTML (build it with the `html` tag)
 * @param {Array<{label: string, run?: Function, badge?: string, disabled?: boolean, cancel?: boolean}>} opts.buttons
 * @param {Function} [opts.onClose]
 * @param {boolean} [opts.dismissable] whether Esc can close it without choosing
 */
export function showDialog({ title, color = '#ffd23f', body = '', buttons = [], onClose, dismissable = true }) {
  if (current) hide();
  const list = buttons.length ? buttons : [{ label: 'OK', cancel: true }];
  root.innerHTML = html`<div class="dlg" style="border-color:${color}">
    <div class="dlg-head" style="background:${color}">${title}</div>
    <div class="dlg-body">${raw(body)}</div>
    <div class="dlg-buttons"></div>
  </div>`;
  const holder = root.querySelector('.dlg-buttons');
  const elements = list.map((b, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.disabled = !!b.disabled;
    if (b.cancel) el.classList.add('cancel');
    el.innerHTML = html`<span class="badge" style="background:${color}">${b.badge ?? (b.cancel ? 'ESC' : i + 1)}</span
      >${b.label}`;
    el.onclick = () => choose(i);
    holder.append(el);
    return el;
  });
  root.style.display = 'flex';

  const enabled = () => list.map((b, i) => (b.disabled ? -1 : i)).filter((i) => i >= 0);
  let focus = enabled()[0] ?? -1;
  const setFocus = (i) => {
    focus = i;
    elements.forEach((el, k) => el.classList.toggle('focus', k === i));
    elements[i]?.scrollIntoView({ block: 'nearest' });
  };
  setFocus(focus);

  function choose(i) {
    const b = list[i];
    if (!b || b.disabled) return;
    hide();
    b.run?.(); // may open a follow-up dialog…
    if (!current) showNext(); // …otherwise show whatever was waiting
  }

  current = { onClose };
  captureKeys((k) => {
    const order = enabled();
    if (k === 'escape') {
      const cancel = list.findIndex((b) => b.cancel);
      if (cancel >= 0) return choose(cancel);
      return dismissable ? closeDialog() : undefined;
    }
    if (k === 'arrowdown' || k === 's') return setFocus(order[(order.indexOf(focus) + 1) % order.length]);
    if (k === 'arrowup' || k === 'w') return setFocus(order[(order.indexOf(focus) - 1 + order.length) % order.length]);
    if (k === 'enter' || k === 'e' || k === ' ') return choose(focus);
    if (/^[0-9]$/.test(k)) {
      const i = list.findIndex((b, idx) => String(b.badge ?? idx + 1) === k || (k === '0' && b.badge === '10'));
      if (i >= 0) choose(i);
    }
  });
}

function hide() {
  const onClose = current?.onClose;
  current = null;
  captureKeys(null);
  root.style.display = 'none';
  root.innerHTML = '';
  onClose?.();
}

function showNext() {
  if (queue.length) showDialog(queue.shift());
}

export function closeDialog() {
  if (!current) return;
  hide();
  showNext();
}

/** Shows the dialog now, or after the one currently open is dismissed. */
export function queueDialog(opts) {
  if (current) queue.push(opts);
  else showDialog(opts);
}
