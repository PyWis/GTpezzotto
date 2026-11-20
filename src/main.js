// NAPULE — Grand Theft Vespa. Entry point: wires input, simulation and rendering.

import { time } from './core/time.js';
import { LANDMARKS, TILE, VESUVIUS, districtAt } from './data/city.js';
import { HORN_REPLIES } from './data/people.js';
import { audio, initAudio, setEngine, sfx, toggleMute } from './audio.js';
import { bindInput, keys, onCommand } from './input.js';
import { isInTunnel, placeNameAt } from './world/map.js';
import { trees } from './world/trees.js';
import {
  dismount,
  isOnStreet,
  kmh,
  mount,
  MOUNT_RANGE,
  player,
  speed,
  updateOnFoot,
  updateRiding,
} from './entities/player.js';
import { nearestFreeVespa, vespas } from './entities/vespas.js';
import * as people from './entities/pedestrians.js';
import * as traffic from './entities/traffic.js';
import {
  boardFunicular,
  boardMetro,
  destinationName,
  funicularRide,
  metroRide,
  nearestFunicularStation,
  nearestMetroStation,
  updateFreightTrain,
  updateFunicular,
  updateMetro,
} from './entities/transit.js';
import { isTalking, say } from './entities/speech.js';
import {
  career,
  currentObjective,
  jobMarkers,
  nearestPizzeria,
  openPizzeria,
  pendingStops,
  pizzasOnBoard,
  pizzeriaLook,
} from './game/job.js';
import { MAX_HANDOFF_SPEED } from './game/career.js';
import { PIZZERIAS } from './data/pizza.js';
import { canvas, ctx, resize, screen } from './render/canvas.js';
import { addShake, baseZoom, beginFrame, camera, follow, isVisible, toScreen, visibleTiles } from './render/camera.js';
import { drawGround } from './render/ground.js';
import { drawBubble, drawCar, drawFallenPerson, drawPerson, drawTree, drawVespa } from './render/sprites.js';
import { drawEffects } from './render/effects.js';
import { drawBuildings } from './render/buildings.js';
import { drawFunicolari, drawMetroOverlay } from './render/transit.js';
import { drawGuide, drawPizzeria, drawStop } from './render/delivery.js';
import { drawHud, showBanner, tickHud } from './render/hud.js';
import {
  closeStreetMap,
  drawRadar,
  drawStreetMap,
  openStreetMap,
  panStreetMap,
  radarRect,
  streetMap,
  streetMapButtons,
  zoomStreetMap,
} from './render/citymap.js';
import { html, isDialogOpen, showDialog } from './ui/dialog.js';

const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
const game = { started: false, hintTime: 7, district: '' };

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function openMetroMenu({ line, index }) {
  showDialog({
    title: `M · ${line.name.toUpperCase()}`,
    color: line.color,
    body: html`<p>Sei a <b>${line.stations[index].name}</b>. Dove vuoi andare?</p>`,
    buttons: [
      ...line.stations.map((st, k) => ({
        label: st.name,
        badge: String(k + 1),
        disabled: k === index,
        run: () => {
          boardMetro(line, index, k);
          game.hintTime = 0;
          sfx.metroDepart();
        },
      })),
      { label: 'Esci', cancel: true },
    ],
  });
}

/** What pressing E would do right now (null = nothing). */
function availableAction() {
  if (player.mode === 'vespa') {
    const shop = speed() < 40 && nearestPizzeria(player.x, player.y);
    if (shop) return { label: `E · ${shop.name.toUpperCase()}`, run: () => openPizzeria(shop) };
    if (speed() < 5 && game.hintTime <= 0) return { label: 'E · SCENDI', run: getOff };
    return { label: null, run: getOff };
  }
  if (player.mode !== 'foot') return null;

  const shop = nearestPizzeria(player.x, player.y);
  if (shop) return { label: `E · ${shop.name.toUpperCase()}`, run: () => openPizzeria(shop) };
  const vespa = nearestFreeVespa(player.x, player.y, MOUNT_RANGE);
  if (vespa)
    return {
      label: 'E · SALI SULLA VESPA',
      run: () => {
        mount(vespa);
        game.hintTime = 0;
        sfx.mount();
      },
    };
  const funi = nearestFunicularStation(player.x, player.y);
  if (funi)
    return {
      label: `E · ${funi.line.name.toUpperCase()} → ${destinationName(funi).toUpperCase()}`,
      run: () => {
        boardFunicular(funi);
        game.hintTime = 0;
        sfx.funicular();
      },
    };
  const metro = nearestMetroStation(player.x, player.y);
  if (metro)
    return {
      label: `E · METRO ${metro.line.name.toUpperCase()} · ${metro.line.stations[metro.index].name.toUpperCase()}`,
      run: () => openMetroMenu(metro),
    };
  return null;
}

function getOff() {
  dismount();
}

function honk() {
  if (player.mode === 'vespa') sfx.horn();
  else say(player, 'Uè!', 1.4);
  people.honkAtPedestrians(HORN_REPLIES);
}

const playing = () => game.started && !isDialogOpen();

onCommand('action', () => playing() && !streetMap.open && availableAction()?.run());
onCommand('horn', () => playing() && honk());
onCommand('map', () => playing() && (streetMap.open ? closeStreetMap() : openStreetMap(player)));
onCommand('back', () => streetMap.open && closeStreetMap());
onCommand('zoomIn', () => streetMap.open && zoomStreetMap(screen.w / 2, screen.h / 2, 1.4));
onCommand('zoomOut', () => streetMap.open && zoomStreetMap(screen.w / 2, screen.h / 2, 1 / 1.4));
onCommand('mute', () => setMuted(toggleMute()));

function setMuted(muted) {
  document.getElementById('mute').textContent = muted ? '🔇' : '🔊';
}

// ---------------------------------------------------------------------------
// Pointer: tap the radar to open the map; drag/pinch/wheel inside the map.
// ---------------------------------------------------------------------------
function bindPointer() {
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  canvas.addEventListener('pointerdown', (e) => {
    if (!playing()) return;
    if (!streetMap.open) {
      if (inside(radarRect(), e.clientX, e.clientY)) openStreetMap(player);
      return;
    }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    drag = { x: e.clientX, y: e.clientY, moved: pointers.size > 1 };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, zoom: streetMap.zoom };
    }
    canvas.setPointerCapture?.(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!streetMap.open || !pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomStreetMap((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (pinch.zoom * d) / pinch.d / streetMap.zoom);
      return;
    }
    if (drag && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 5) drag.moved = true;
    if (drag?.moved) panStreetMap(e.clientX - prev[0], e.clientY - prev[1]);
  });

  const release = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (streetMap.open && drag && !drag.moved)
      streetMapButtons()
        .find((b) => inside(b, e.clientX, e.clientY))
        ?.run();
    if (!pointers.size) drag = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!streetMap.open) return;
      e.preventDefault();
      zoomStreetMap(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2);
    },
    { passive: false },
  );
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
const ZOOM = { metro: 0.75, funicular: 1.0, foot: 1.6 };

function update(dt) {
  updateFreightTrain(dt);
  let shake = 0;

  switch (player.mode) {
    case 'metro':
      if (updateMetro(dt)) {
        const { line, to } = metroRide;
        showBanner(`${line.name} · ${line.stations[to].name}`, 3);
        sfx.metroArrive();
      }
      break;
    case 'funicular':
      updateFunicular(dt);
      break;
    case 'foot':
      updateOnFoot(dt);
      break;
    case 'vespa':
      shake = updateRiding(dt);
      break;
  }
  if (player.sayT > 0) player.sayT -= dt;
  shake = Math.max(shake, people.updatePedestrians(dt), traffic.updateTraffic(dt));
  if (shake) addShake(shake);

  const district = districtAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
  if (district !== game.district) {
    game.district = district;
    showBanner(district);
  }
  if (game.hintTime > 0 && player.mode === 'foot') game.hintTime -= dt * 0.2;

  const v = player.vespa?.v ?? 0;
  follow(dt, {
    x: player.x,
    y: player.y,
    heading: player.a,
    speed: v,
    zoom: player.vespa ? 1.32 - 0.5 * Math.min(1, Math.abs(v) / 330) : ZOOM[player.mode],
  });
  setEngine(player.vespa ? v : null, keys.up);
}

function tick(dt) {
  time.t += dt;
  tickHud(dt);
  if (!game.started) {
    // Attract mode: drift around Piazza del Plebiscito.
    camera.x = player.x + Math.sin(time.t * 0.15) * 300;
    camera.y = player.y + Math.cos(time.t * 0.12) * 200;
    camera.zoom = baseZoom() * 1.1;
    return;
  }
  if (isDialogOpen()) return setEngine(null);
  // The delivery clock runs in real time, even while looking at the map.
  const courier = isOnStreet() ? { x: player.x, y: player.y, speed: speed() } : { x: NaN, y: NaN, speed: Infinity };
  career.update(dt, courier);
  if (streetMap.open) {
    const pan = 500 * dt;
    panStreetMap(((keys.left ? 1 : 0) - (keys.right ? 1 : 0)) * pan, ((keys.up ? 1 : 0) - (keys.down ? 1 : 0)) * pan);
    return setEngine(null);
  }
  update(dt);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function nearestLandmark() {
  const x = player.x / TILE;
  const y = player.y / TILE;
  let best = null;
  let bestD = 5;
  for (const lm of LANDMARKS) {
    const d = Math.hypot(lm.cx - x, lm.cy - y) - lm.size;
    if (d < bestD) [best, bestD] = [lm.name, d];
  }
  if (Math.hypot(VESUVIUS.center[0] - x, VESUVIUS.center[1] - y) < VESUVIUS.radius + 4) best = 'Vesuvio';
  return best;
}

function modeLabel() {
  if (player.mode === 'metro') return ['IN METRO', '#cfc6b0'];
  if (player.mode === 'funicular') return [funicularRide.line.name.toUpperCase(), '#cfc6b0'];
  if (player.mode === 'vespa') {
    const cargo = pizzasOnBoard();
    return [`VESPA  ${kmh(player.vespa.v)} KM/H${cargo ? `  · 🍕 ${cargo}` : ''}`, '#ffd23f'];
  }
  const cargo = pizzasOnBoard();
  return [`A PIEDI${cargo ? `  · 🍕 ${cargo}` : ''}`, '#cfc6b0'];
}

function promptText() {
  if (!game.started) return null;
  if (player.mode === 'funicular') return funicularRide.line.name.toUpperCase();
  const action = availableAction();
  if (action?.label) return action.label;
  const nearDoor = pendingStops().some(
    ({ stop }) => Math.hypot(stop.address.x - player.x, stop.address.y - player.y) < 70,
  );
  if (nearDoor && speed() >= MAX_HANDOFF_SPEED) return 'RALLENTA PER CONSEGNARE';
  return null;
}

function hintText() {
  if (!game.started) return null;
  if (career.status === 'unemployed' && game.hintTime <= 0)
    return 'Segui la freccia verde: una pizzeria cerca un fattorino';
  if (career.status === 'unemployed' && game.hintTime > 0 && player.mode === 'foot')
    return 'Sali sulla Vespa qui accanto (E) e cerca lavoro in pizzeria';
  return null;
}

function drawWorld() {
  const view = visibleTiles();
  drawGround(view);

  for (const v of vespas) if (!v.ridden && isVisible(v.x, v.y)) drawVespa(v);
  for (const p of people.pedestrians)
    if (p.down > 0 && isVisible(p.x, p.y)) drawFallenPerson(...toScreen(p.x, p.y), p.a, p);
  for (const p of people.pedestrians)
    if (p.down <= 0 && isVisible(p.x, p.y)) drawPerson(...toScreen(p.x, p.y), p.a, p, p.walk, true);
  for (const c of traffic.cars) if (isVisible(c.x, c.y)) drawCar(c);
  if (player.mode === 'foot') drawPerson(...toScreen(player.x, player.y), player.a, player, player.walk, player.moving);
  else if (player.mode === 'vespa') drawVespa(player.vespa, player, pizzasOnBoard());

  for (const t of trees) drawTree(t);
  drawEffects();
  drawBuildings(view, { playerInTunnel: isInTunnel(player.x, player.y) });
  drawFunicolari(player);
  if (player.mode === 'metro') drawMetroOverlay();

  // Shop signs stay readable above the roofs of the vicoli.
  for (const p of PIZZERIAS)
    drawPizzeria(p, pizzeriaLook(p), Math.hypot(p.pos[0] - player.x, p.pos[1] - player.y) < 200);
  const next = currentObjective(player);
  for (const { order, stop } of pendingStops())
    drawStop(stop, order, next && next.x === stop.address.x && next.y === stop.address.y);
  for (const p of people.pedestrians) if (isTalking(p) && isVisible(p.x, p.y)) drawBubble(p.x, p.y, p.say);
  for (const c of traffic.cars) if (isTalking(c) && isVisible(c.x, c.y)) drawBubble(c.x, c.y, c.say);
  if (isTalking(player)) drawBubble(player.x, player.y, player.say);
  if (game.started && isOnStreet()) drawGuide(player, next);
}

function render() {
  ctx.setTransform(screen.dpr, 0, 0, screen.dpr, 0, 0);
  beginFrame();
  ctx.fillStyle = '#2d2925';
  ctx.fillRect(0, 0, screen.w, screen.h);
  drawWorld();

  const markers = [
    ...vespas.filter((v) => !v.ridden).map((v) => ({ kind: 'vespa', x: v.x, y: v.y })),
    ...jobMarkers(time.t),
  ];
  if (game.started) {
    drawRadar(player, markers);
    drawHud({
      career,
      player,
      status: {
        street: placeNameAt(player.x, player.y),
        landmark: nearestLandmark(),
        mode: modeLabel(),
        touch: isTouch,
      },
      prompt: promptText(),
      hint: hintText(),
      radarBottom: radarRect().y + radarRect().h,
    });
  }
  if (streetMap.open) drawStreetMap(player, markers);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function start() {
  initAudio();
  game.started = true;
  document.getElementById('start').style.display = 'none';
  showBanner('Piazza del Plebiscito');
  game.district = districtAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
}

addEventListener('resize', resize);
resize();
bindInput({ isTouch });
bindPointer();
people.populate();
traffic.populate();
setMuted(audio.muted);
document.getElementById('mute').onclick = () => {
  initAudio();
  setMuted(toggleMute());
};
document.getElementById('go').onclick = start;
camera.x = player.x;
camera.y = player.y;

let last = performance.now();
requestAnimationFrame(function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tick(dt);
  render();
  requestAnimationFrame(loop);
});

// Handy for debugging from the console.
window.napule = { player, career, keys };
