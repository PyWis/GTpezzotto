// Tiny procedural sound: a filtered sawtooth for the Vespa engine plus beeps.
let ac = null;
let engine = null;
let engineGain = null;
export const audio = { muted: false };

export function initAudio() {
  if (ac) return;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    engine = ac.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 50;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    engineGain = ac.createGain();
    engineGain.gain.value = 0;
    engine.connect(filter).connect(engineGain).connect(ac.destination);
    engine.start();
  } catch {
    ac = null;
  }
}

/** Plays a sequence of [startTime, frequency, duration] notes. */
export function beep(notes, type = 'sine', volume = 0.05) {
  if (!ac || audio.muted) return;
  const t0 = ac.currentTime;
  for (const [t, freq, dur] of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, t0 + t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0 + t);
    osc.stop(t0 + t + dur + 0.02);
  }
}

/** Engine drone: pass the Vespa speed (px/s), or null when on foot. */
export function setEngine(speed, throttle) {
  if (!ac) return;
  const on = speed !== null && !audio.muted;
  engineGain.gain.setTargetAtTime(on ? 0.028 : 0, ac.currentTime, 0.08);
  if (on) engine.frequency.setTargetAtTime(42 + Math.abs(speed) * 0.42 + (throttle ? 10 : 0), ac.currentTime, 0.06);
}

export function toggleMute() {
  audio.muted = !audio.muted;
  return audio.muted;
}

export const sfx = {
  mount: () => beep([[0, 180, 0.25]], 'sawtooth', 0.04),
  horn: () =>
    beep(
      [
        [0, 560, 0.12],
        [0.17, 560, 0.14],
      ],
      'square',
      0.05,
    ),
  carHorn: () => beep([[0, 330, 0.18]], 'square', 0.025),
  funicular: () =>
    beep([
      [0, 660, 0.12],
      [0.15, 880, 0.18],
    ]),
  metroDepart: () =>
    beep([
      [0, 520, 0.15],
      [0.18, 660, 0.15],
      [0.36, 780, 0.25],
    ]),
  metroArrive: () =>
    beep([
      [0, 780, 0.12],
      [0.15, 620, 0.2],
    ]),
  newOrder: () =>
    beep(
      [
        [0, 880, 0.1],
        [0.12, 1175, 0.1],
        [0.24, 1568, 0.18],
      ],
      'triangle',
      0.06,
    ),
  pickup: () =>
    beep(
      [
        [0, 523, 0.1],
        [0.1, 784, 0.16],
      ],
      'triangle',
      0.06,
    ),
  delivered: () =>
    beep(
      [
        [0, 659, 0.1],
        [0.1, 880, 0.1],
        [0.2, 1319, 0.22],
      ],
      'triangle',
      0.06,
    ),
  coins: () =>
    beep(
      [
        [0, 1319, 0.08],
        [0.08, 1760, 0.16],
      ],
      'square',
      0.03,
    ),
  failed: () =>
    beep(
      [
        [0, 330, 0.2],
        [0.22, 247, 0.35],
      ],
      'sawtooth',
      0.04,
    ),
  fired: () =>
    beep(
      [
        [0, 392, 0.2],
        [0.22, 311, 0.2],
        [0.44, 196, 0.5],
      ],
      'sawtooth',
      0.05,
    ),
};
