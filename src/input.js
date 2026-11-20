// Keyboard + touch input. Held directions live in `keys`; one-shot commands
// are dispatched to the handlers registered with `onCommand`.

export const keys = { up: false, down: false, left: false, right: false, run: false, brake: false };

const HELD = {
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
  shift: 'run',
  ' ': 'brake',
};

const COMMANDS = {
  e: 'action',
  f: 'action',
  enter: 'action',
  h: 'horn',
  m: 'map',
  n: 'mute',
  p: 'pause',
  '+': 'zoomIn',
  '=': 'zoomIn',
  '-': 'zoomOut',
  _: 'zoomOut',
  escape: 'back',
};

const handlers = new Map();
export const onCommand = (name, fn) => handlers.set(name, fn);
const dispatch = (name, payload) => handlers.get(name)?.(payload);

/** While a modal is open, every key press goes to it instead of the game. */
let modalKeyHandler = null;
export const captureKeys = (fn) => (modalKeyHandler = fn);

export function bindInput({ isTouch }) {
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (modalKeyHandler) {
      e.preventDefault();
      if (!e.repeat) modalKeyHandler(k);
      return;
    }
    if (HELD[k]) {
      keys[HELD[k]] = true;
      e.preventDefault();
    }
    if (!e.repeat && COMMANDS[k]) dispatch(COMMANDS[k]);
  });
  addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (HELD[k]) keys[HELD[k]] = false;
  });
  addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));

  const pad = document.getElementById('touch');
  if (isTouch) pad.style.display = 'block';
  for (const btn of pad.querySelectorAll('.tb')) {
    const k = btn.dataset.k;
    const press = (e) => {
      e.preventDefault();
      btn.classList.add('on');
      if (k in keys) keys[k] = true;
      else dispatch(k);
    };
    const release = () => {
      btn.classList.remove('on');
      if (k in keys) keys[k] = false;
    };
    btn.addEventListener('pointerdown', press);
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, release);
  }
}

export const steering = () => (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
