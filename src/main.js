// NAPULE — Grand Theft Vespa. Entry point: wires input, simulation and rendering.

import { time } from './core/time.js';
import { LANDMARKS, STADIUM_GATE, TILE, VESUVIUS, districtAt } from './data/city.js';
import { HORN_REPLIES, RUMORS } from './data/people.js';
import { audio, initAudio, setEngine, sfx, toggleMute } from './audio.js';
import { bindInput, keys, onCommand } from './input.js';
import { collides, inStadium, isInTunnel, placeNameAt, Solid, snapToWalkable, stadiumGate } from './world/map.js';
import { trees } from './world/trees.js';
import {
  dismount,
  isOnStreet,
  kmh,
  mount,
  MOUNT_RANGE,
  player,
  SHIRT_AZZURRA,
  SHIRT_RED,
  speed,
  updateOnFoot,
  updateRiding,
} from './entities/player.js';
import { nearestFreeVespa, onBump, vespas } from './entities/vespas.js';
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
  CASTLE,
  conditionPct,
  FILOMENA_COLOR,
  currentObjective,
  footballerOrder,
  GARAGE,
  jobMarkers,
  LEGEND_COLOR,
  legendOrder,
  mechanicLine,
  nearestPizzeria,
  nearGarage,
  nearRepairShop,
  onTalk,
  openGarage,
  openPizzeria,
  openRepairShop,
  pendingStops,
  pizzasOnBoard,
  Phase,
  pizzeriaLook,
  REPAIR_SHOP,
  story,
  stopColor,
  VIP_COLOR,
  vipOrder,
} from './game/job.js';
import { clearSave, loadGame, readSave, saveGame } from './game/save.js';
import { MAX_HANDOFF_SPEED, OWN_SHOP_ID } from './game/career.js';
import { PIZZERIAS, RULES } from './data/pizza.js';
import { canvas, ctx, resize, screen } from './render/canvas.js';
import {
  addShake,
  baseZoom,
  beginFrame,
  camera,
  follow,
  isVisible,
  project,
  toScreen,
  visibleTiles,
} from './render/camera.js';
import { drawGround } from './render/ground.js';
import { drawBubble, drawCar, drawFallenPerson, drawPerson, drawTree, drawVespa } from './render/sprites.js';
import { drawEffects } from './render/effects.js';
import { drawBuildings } from './render/buildings.js';
import { drawFunicolari, drawMetroOverlay } from './render/transit.js';
import { drawGarage, drawGuide, drawPizzeria, drawStadiumGate, drawStop } from './render/delivery.js';
import { drawHud, showBanner, tickHud, toast } from './render/hud.js';
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
import { euro } from './core/format.js';

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
  // La pizzeria comprata: Gennaro sceglie dove aprirla.
  if (story.phase === Phase.PLACING && isOnStreet()) {
    const pos = snapToWalkable(player.x / TILE, player.y / TILE);
    if (!career.canOpenShopAt(pos)) return { label: "TROPPO VICINO A UN'ALTRA PIZZERIA", run: () => {} };
    return { label: 'E · APRI QUI LA TUA PIZZERIA', run: () => story.openShopAt(pos) };
  }
  if (player.mode === 'vespa') {
    const shop = speed() < 40 && nearestPizzeria(player.x, player.y);
    if (shop) return { label: `E · ${shop.name.toUpperCase()}`, run: () => openPizzeria(shop) };
    if (speed() < 40 && nearGarage(player.x, player.y))
      return { label: `E · ${GARAGE.name.toUpperCase()}`, run: () => openGarage(player.vespa) };
    if (speed() < 40 && nearRepairShop(player.x, player.y))
      return { label: `E · ${REPAIR_SHOP.name.toUpperCase()}`, run: () => openRepairShop(player.vespa) };
    if (speed() < 5 && game.hintTime <= 0) return { label: 'E · SCENDI', run: getOff };
    return { label: null, run: getOff };
  }
  if (player.mode !== 'foot') return null;

  const shop = nearestPizzeria(player.x, player.y);
  if (shop) return { label: `E · ${shop.name.toUpperCase()}`, run: () => openPizzeria(shop) };
  if (nearGarage(player.x, player.y)) return { label: `E · ${GARAGE.name.toUpperCase()}`, run: () => openGarage(null) };
  if (nearRepairShop(player.x, player.y))
    return { label: `E · ${REPAIR_SHOP.name.toUpperCase()}`, run: () => openRepairShop(null) };
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
onCommand('back', () => (streetMap.open ? closeStreetMap() : playing() && pause()));
onCommand('pause', () => playing() && (streetMap.open ? closeStreetMap() : pause()));
onCommand('zoomIn', () => streetMap.open && zoomStreetMap(screen.w / 2, screen.h / 2, 1.4));
onCommand('zoomOut', () => streetMap.open && zoomStreetMap(screen.w / 2, screen.h / 2, 1 / 1.4));
onCommand('mute', () => setMuted(toggleMute()));

// ---------------------------------------------------------------------------
// Pause & save
// ---------------------------------------------------------------------------
/** The game stops while any dialog is open: the pause menu is just a dialog. */
function pause() {
  setEngine(null);
  const saved = save();
  showDialog({
    title: 'PAUSA',
    color: '#cfc6b0',
    body: html`<p>Giorno ${career.day} · ${euro(career.wallet)} nel portafoglio.</p>
      <p class="small">${saved ? 'Partita salvata.' : 'Salvataggio non disponibile in questo momento.'}</p>`,
    buttons: [
      { label: 'Riprendi', cancel: true },
      {
        label: 'Nuova partita',
        run: () =>
          showDialog({
            title: 'NUOVA PARTITA?',
            color: '#e0412f',
            body: html`<p>La partita salvata verrà cancellata.</p>`,
            buttons: [
              { label: 'Sì, ricomincia', run: newGame },
              { label: 'No', cancel: true, run: pause },
            ],
          }),
      },
    ],
  });
}

const save = () => game.started && saveGame(career, story);

function newGame() {
  game.resetting = true; // niente salvataggio mentre si ricarica
  clearSave();
  location.reload();
}

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
      shake = updateRiding(dt, (career.isTuned(player.vespa) ? RULES.tuning.speed : 1) * (player.vespa.condition ?? 1));
      break;
  }
  holdPlayer();
  if (player.sayT > 0) player.sayT -= dt;
  shake = Math.max(shake, people.updatePedestrians(dt), traffic.updateTraffic(dt));
  holdPlayer(); // anche dopo gli urti con le auto
  updateFootballer(dt);
  updateVip(dt);
  updateMechanics(dt);
  updatePizzaiolo(dt);
  updateFilomena(dt);
  updateTalks(dt);
  updateLegend(dt);
  updateRumors(dt);
  player.shirt = career.blessed ? SHIRT_AZZURRA : SHIRT_RED;
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
  const courier = isOnStreet()
    ? { x: player.x, y: player.y, speed: speed(), onFoot: player.mode === 'foot' }
    : { x: NaN, y: NaN, speed: Infinity, onFoot: false };
  career.update(dt, courier);
  story.update(courier);
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
    const turbo = career.isTuned(player.vespa) ? ' TURBO' : '';
    const pct = conditionPct(player.vespa);
    const dents = pct < 100 ? `  · 🔧 ${pct}%` : '';
    return [`VESPA${turbo}  ${kmh(player.vespa.v)} KM/H${cargo ? `  · 🍕 ${cargo}` : ''}${dents}`, '#ffd23f'];
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
  switch (story.phase) {
    case Phase.CALL:
      if (!story.order?.pickedUp)
        return `Ritira le 2 Margherite da ${story.order?.pizzeria.name} e portale al Pontile Nord`;
      break;
    case Phase.PIER:
      return 'Il tempo è fermo: porta le 2 Margherite al Pontile Nord';
    case Phase.PIER_SCENE:
    case Phase.TOP:
      return '';
    case Phase.CASTLE:
      return "Il giorno non finisce: Filomena t'aspetta sotto Castel dell'Ovo";
    case Phase.CLIMB:
      return player.mode === 'foot'
        ? 'Sali a piedi sul castello con Filomena: segui la freccia'
        : 'Scendi dalla Vespa (E): sul castello si sale a piedi';
    case Phase.PLACING:
      return 'Il tempo è fermo: scegli dove aprire la tua pizzeria e premi E';
  }
  if (legendOrder()?.pickedUp && !inStadium(player.x, player.y))
    return "Entra nello Stadio da Piazzale Tecchio: t'aspettano a centrocampo";
  if (career.status === 'unemployed' && game.hintTime <= 0)
    return 'Segui la freccia: chiedi lavoro alle pizzerie, chissà chi assume';
  if (career.status === 'unemployed' && game.hintTime > 0 && player.mode === 'foot')
    return 'Sali sulla Vespa qui accanto (E) e cerca lavoro in pizzeria';
  return null;
}

// The Napoli player waiting on the pavement for his pizza: azzurro shirt, white shorts, a ball at his feet.
const footballer = { shirt: '#1d9be0', trousers: '#ffffff', hair: '#2a1a10', skin: '#c99a70', say: '', sayT: 0 };
const FOOTBALLER_LINES = ["Uè, 'a pizza!", 'Forza Napoli!', "Jamme, ca m'aggia allenà!", 'Sto murenno ’e famme!'];

function updateFootballer(dt) {
  const order = footballerOrder();
  if (!order) return;
  const { address } = order.stops[0];
  Object.assign(footballer, { x: address.x + 10, y: address.y - 6, order });
  if (footballer.sayT > 0) footballer.sayT -= dt;
  else if (Math.hypot(player.x - footballer.x, player.y - footballer.y) < 260 && Math.random() < dt * 0.4)
    say(footballer, FOOTBALLER_LINES[Math.floor(Math.random() * FOOTBALLER_LINES.length)], 2.2);
}

function drawFootballer() {
  const order = footballerOrder();
  if (!order || footballer.order !== order || !isVisible(footballer.x, footballer.y)) return;
  const { x, y } = footballer;
  const a = Math.atan2(player.y - y, player.x - x);
  // Palleggi: the ball bounces in front of him.
  const bounce = Math.abs(Math.sin(time.t * 4));
  const [bx, by] = toScreen(x + Math.cos(a) * 11, y + Math.sin(a) * 11);
  const z = camera.zoom;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(bx + 1.5 * z, by + 1.5 * z, 3 * z, 2.4 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  drawPerson(...toScreen(x, y), a, footballer, time.t * 6, false);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(bx, by - bounce * 6 * z, 3 * z, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// The special customer, waiting next to their monument with a pink star overhead.
const vip = { say: '', sayT: 0, order: null };
const VIP_LINES = ['Uè, Gennà! Ccà!', "'E pizze toje so' 'e meglio!", 'Jamme, ca se fanno fredde!'];

function updateVip(dt) {
  const current = vipOrder();
  if (!current) {
    // Consegnate le pizze, il cliente resta a chiacchierare finché la conversazione non è finita.
    if (vip.chatting) {
      if (vip.sayT > 0) vip.sayT -= dt;
    } else vip.order = null;
    return;
  }
  const { order, customer } = current;
  const { address } = order.stops[0];
  if (vip.order !== order) Object.assign(vip, customer.look, { say: '', sayT: 0 });
  Object.assign(vip, { x: address.x + 12, y: address.y - 4, order, call: customer.call });
  if (vip.sayT > 0) vip.sayT -= dt;
  else if (Math.hypot(player.x - vip.x, player.y - vip.y) < 280 && Math.random() < dt * 0.4)
    say(vip, Math.random() < 0.5 ? vip.call : VIP_LINES[Math.floor(Math.random() * VIP_LINES.length)], 2.4);
}

function drawVip() {
  if (!vip.order || (!vip.chatting && vipOrder()?.order !== vip.order) || !isVisible(vip.x, vip.y)) return;
  const [sx, sy] = toScreen(vip.x, vip.y);
  const z = camera.zoom;
  ctx.globalAlpha = 0.3 + 0.12 * Math.sin(time.t * 3);
  ctx.fillStyle = VIP_COLOR;
  ctx.beginPath();
  ctx.arc(sx, sy, 13 * z, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  drawPerson(sx, sy, Math.atan2(player.y - vip.y, player.x - vip.x), vip, 0, false);
  // Una stellina rosa che saltella sopra la testa.
  const hop = Math.abs(Math.sin(time.t * 3)) * 4 * z;
  ctx.fillStyle = VIP_COLOR;
  ctx.font = `${Math.round(10 * z)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('★', sx, sy - 14 * z - hop);
}

// ---------------------------------------------------------------------------
// The story: Filomena, the pier, Castel dell'Ovo, the new pizzeria
// ---------------------------------------------------------------------------
const FILOMENA_LOOK = { shirt: FILOMENA_COLOR, trousers: '#2b2b3a', hair: '#4a2410', skin: '#e9bb98' };
const filomena = { ...FILOMENA_LOOK, x: 0, y: 0, a: 0, h: 0.5, say: '', sayT: 0, walk: 0, moving: false };
const filomenaVespa = { x: 0, y: 0, a: 0, v: 0, color: '#f2f2ea' };
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** A scene that holds Gennaro still (on top of the castle) or keeps him close (talking with a VIP). */
const scene = { top: false, hold: null };
const TOP_H = 2.6; // l'altezza di Castel dell'Ovo
const topGennaro = { say: '', sayT: 0 };
const VIP_LEASH = 20 * (TILE / 2.6); // 20 metri
const leash = { x: 0, y: 0 };

/** Keeps Gennaro where the story wants him: within 20 m of a chatting VIP, still on top of the castle. */
function holdPlayer() {
  if (scene.top && scene.hold) {
    Object.assign(player, scene.hold);
    return;
  }
  if (!vip.chatting) return;
  if (Math.hypot(player.x - vip.x, player.y - vip.y) <= VIP_LEASH) {
    Object.assign(leash, { x: player.x, y: player.y });
    return;
  }
  // Troppo lontano: Gennaro torna indietro e la Vespa si ferma.
  Object.assign(player, leash);
  if (player.vespa) Object.assign(player.vespa, { x: leash.x, y: leash.y, v: 0 });
  if (!isTalking(vip) && !isTalking(player)) say(vip, "Gennà, addò vaje? Nun aggio fernuto 'e parlà!", 2);
}

// Day 3-4 (and 6-7): Filomena rides up on her Vespa, says hi and rides off. «Ma chesta chi è?»
const ride = { active: false, state: '', t: 0, lines: [] };
const RIDE_SPEED = 430;
const GREETINGS = [
  'Ciao Gennà!',
  "Uè, Gennà! Comme va 'o lavoro?",
  "Ciao bello d''e pizze!",
  "Gennà, t'aggio superato n'ata vota!",
];
const WHO_IS_SHE = ['Ma chesta chi è?', "Ma chi è chesta? E comme sape 'o nomme mio?", "N'ata vota chesta? Ma chi è?"];
const TUNE_HINT = "Gennà, ma comme vaje chiano! Fatte truccà 'o motorino a Fuorigrotta!";

function startRide({ tuneHint }) {
  let spot = null;
  for (let k = 0; k < 24 && !spot; k++) {
    const a = Math.random() * Math.PI * 2;
    const x = player.x + Math.cos(a) * 380;
    const y = player.y + Math.sin(a) * 380;
    if (!collides(x, y, 9, Solid.VESPA)) spot = [x, y];
  }
  const [x, y] = spot ?? [player.x - 380, player.y];
  Object.assign(filomenaVespa, { x, y, a: Math.atan2(player.y - y, player.x - x), v: RIDE_SPEED });
  ride.lines = [[filomena, pick(GREETINGS)], [player, pick(WHO_IS_SHE)], ...(tuneHint ? [[filomena, TUNE_HINT]] : [])];
  Object.assign(ride, { active: true, state: 'approach', t: 0 });
  sfx.horn();
}

function updateRide(dt) {
  ride.t += dt;
  const v = filomenaVespa;
  const d = Math.hypot(player.x - v.x, player.y - v.y);
  const toward = Math.atan2(player.y - v.y, player.x - v.x);
  if (ride.state === 'approach' || ride.state === 'talk') {
    // Gli si mette accanto e lo segue mentre parlano.
    const gap = ride.state === 'talk' ? 60 : 44;
    v.v = d > gap ? Math.min(RIDE_SPEED, (d - gap) * 4 + 40) : 0;
    if (d > gap) v.a = toward;
    if (ride.state === 'approach' && (d <= gap || ride.t > 30)) {
      ride.state = 'talk';
      startTalk({
        lines: ride.lines,
        canHear: () => true,
        onEnd: () => Object.assign(ride, { state: 'leave', t: 0 }),
      });
    }
  } else {
    v.a = toward + Math.PI; // se ne va
    v.v = RIDE_SPEED;
    if (ride.t > 2 && !isVisible(v.x, v.y)) ride.active = false;
  }
  v.x += Math.cos(v.a) * v.v * dt;
  v.y += Math.sin(v.a) * v.v * dt;
  Object.assign(filomena, { x: v.x, y: v.y, h: 0.5 });
}

/** Where Filomena is right now, outside of her Vespa rides (null: not around). */
function filomenaSpot() {
  switch (story.phase) {
    case Phase.PIER:
    case Phase.PIER_SCENE:
      return [story.pier.x + 16, story.pier.y - 8];
    case Phase.CASTLE:
      return [CASTLE.meet[0] + 14, CASTLE.meet[1] - 6];
    case Phase.OWNER:
      return career.ownShop ? [career.ownShop.pos[0] + 24, career.ownShop.pos[1] + 6] : null;
  }
  return null;
}

const filomenaVisible = () => ride.active || scene.top || story.phase === Phase.CLIMB || !!filomenaSpot();
const OWNER_LINES = ["Jamme, Gennà, 'e pizze se fanno fredde!", 'Sto ccà, ammore!', 'Chi va cchiù veloce, io o tu?'];
const OWN_SHOP_WISH = [
  'Me voglio mettere in proprio...',
  'Na pizzeria tutta mia: chesto voglio!',
  "Quanto costerà aprire na pizzeria? Mo' 'o chiedo a nu pizzaiolo.",
];
const wish = { wait: 30 };

function updateFilomena(dt) {
  if (filomena.sayT > 0) filomena.sayT -= dt;
  if (topGennaro.sayT > 0) topGennaro.sayT -= dt;
  filomena.moving = false;
  if (ride.active) return updateRide(dt);
  if (scene.top) return;
  if (story.phase === Phase.CLIMB) {
    // Lascia la Vespa e cammina dietro a Gennaro.
    const d = Math.hypot(player.x - filomena.x, player.y - filomena.y);
    filomena.a = Math.atan2(player.y - filomena.y, player.x - filomena.x);
    if (d > 400) Object.assign(filomena, { x: player.x - 30, y: player.y });
    else if (d > 34) {
      const step = Math.min(d - 34, 210 * dt);
      filomena.x += Math.cos(filomena.a) * step;
      filomena.y += Math.sin(filomena.a) * step;
      filomena.moving = true;
      filomena.walk += dt * 10;
    }
    filomena.h = 0.5;
    return;
  }
  const spot = filomenaSpot();
  if (spot) {
    Object.assign(filomena, { x: spot[0], y: spot[1], h: 0.5, a: Math.atan2(player.y - spot[1], player.x - spot[0]) });
    Object.assign(filomenaVespa, { x: spot[0] + 4, y: spot[1] + 20, a: 0, v: 0 });
    if (
      story.phase === Phase.OWNER &&
      !isTalking(filomena) &&
      Math.hypot(player.x - filomena.x, player.y - filomena.y) < 200
    )
      if (Math.random() < dt * 0.08) say(filomena, pick(OWNER_LINES), 2.6);
  }
  // Dal giorno 12 Gennaro ci pensa: vuole mettersi in proprio.
  if (story.canBuyShop && isOnStreet()) {
    wish.wait -= dt;
    if (wish.wait <= 0 && !isTalking(player)) {
      wish.wait = 45 + Math.random() * 45;
      say(player, pick(OWN_SHOP_WISH), 3.2);
    }
  }
}

function drawFilomena() {
  if (scene.top || !filomenaVisible() || !isVisible(filomena.x, filomena.y)) return;
  if (ride.active) return drawVespa(filomenaVespa, filomena, 1);
  if (story.phase !== Phase.CLIMB) drawVespa(filomenaVespa); // parcheggiata accanto a lei
  drawPerson(...toScreen(filomena.x, filomena.y), filomena.a, filomena, filomena.walk, filomena.moving);
}

/** On top of Castel dell'Ovo, the two of them, drawn above the roof. */
function drawCastleTop() {
  if (!scene.top) return;
  const [gx, gy] = CASTLE.top;
  for (const [who, x] of [
    [player, gx - 9],
    [filomena, gx + 9],
  ]) {
    const [sx, sy] = project(x, gy, TOP_H);
    drawPerson(sx, sy, who === player ? 0 : Math.PI, who, 0, false);
  }
}

// Hearts for a kiss.
const KISS_TIME = 2.6;
const kiss = { t: 0, x: 0, y: 0, h: 0.5 };
function startKiss(where) {
  const [x, y, h] = where === 'top' ? [CASTLE.top[0], CASTLE.top[1], TOP_H] : [filomena.x, filomena.y, 0.5];
  Object.assign(kiss, { t: KISS_TIME, x, y, h });
  sfx.coins();
}

function drawKiss() {
  if (kiss.t <= 0) return;
  kiss.t -= 1 / 60;
  const [sx, sy] = project(kiss.x, kiss.y, kiss.h);
  const k = 1 - kiss.t / KISS_TIME;
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    const phase = (k + i * 0.2) % 1;
    ctx.globalAlpha = 1 - phase;
    ctx.fillStyle = '#ff3d6e';
    ctx.font = `${Math.round((10 + i * 2) * camera.zoom)}px sans-serif`;
    ctx.fillText(
      '❤',
      sx + Math.sin(i * 2.1 + k * 6) * 14 * camera.zoom,
      sy - 10 * camera.zoom - phase * 40 * camera.zoom,
    );
  }
  ctx.globalAlpha = 1;
}

const hearing =
  (who, range = HEAR_RANGE) =>
  () =>
    Math.hypot(player.x - who.x, player.y - who.y) < range;

const STORY_SCENES = {
  filomenaVisit: ({ tuneHint }) => !ride.active && startRide({ tuneHint }),
  storyFired: ({ pizzeria }) => {
    pizzaiolo.shop = pizzeria;
    updatePizzaiolo(0);
    startTalk({
      lines: [
        [pizzaiolo, "Gennà! Doje Margherite pe' nu cliente tuojo? Tu te si' miso in proprio!"],
        [player, "Ma qua' proprio! Nun è overo, ve giuro!"],
        [pizzaiolo, "Vattenne! Si' licenziato!"],
        [player, 'Ma io... vabbuò. Primma porto sti Margherite.'],
      ],
      canHear: hearing(pizzaiolo, 600),
      giveUp: () => !hearing(pizzaiolo, 600)(), // Gennaro se n'è già andato
    });
  },
  pier: ({ done }) =>
    startTalk({
      lines: [
        [filomena, 'Finalmente! Doje Margherite, belle calde.'],
        [player, "Ma tu si' chella d''a Vespa! Si' tu ca m'hê chiammato?"],
        [filomena, "Me chiammo Filomena. E 'e pizze 'e consegno meglio 'e te."],
        [player, 'Chesto è tutto da vedé!'],
        [filomena, "Però voglio nu bacio al sapore 'e Margherita... d''o secondo arrivato."],
        [player, "Io nun so' 'o secondo!"],
        [filomena, 'Sì, sì... vieni ccà.'],
        ['kiss', 'pier'],
      ],
      canHear: hearing(filomena),
      onEnd: () => {
        done();
        showBanner('Filomena', 4);
      },
    }),
  castleMeet: () =>
    startTalk({
      lines: [
        [filomena, "Gennà! Si' venuto."],
        [filomena, "Lassa 'a Vespa: saglimmo ncoppa 'o castello, a pere."],
        [player, 'Jamme!'],
      ],
      canHear: () => true,
    }),
  castleTop: ({ done }) => {
    scene.top = true;
    scene.hold = { x: player.x, y: player.y };
    const [gx, gy] = CASTLE.top;
    Object.assign(topGennaro, { x: gx - 9, y: gy, say: '', sayT: 0 });
    Object.assign(filomena, { x: gx + 9, y: gy, h: TOP_H + 0.5, say: '', sayT: 0 });
    talks.length = 0; // Filomena non deve finire altre frasi a terra
    startTalk({
      lines: [
        [topGennaro, "Che bella Napule 'a ccà ncoppa..."],
        [filomena, "E 'o Vesuvio, Gennà, 'o vide?"],
        ['kiss', 'top'],
        [topGennaro, "Dimme 'a verità: almeno so' 'o meglio vasatore 'e Napule?"],
        [filomena, "Sì, Gennà. 'O meglio."],
        [topGennaro, 'Allora... ce fidanzammo?'],
        [filomena, 'Ce simmo già fidanzati, scemo!'],
      ],
      canHear: () => true,
      onEnd: () => {
        scene.top = false;
        scene.hold = null;
        done();
      },
    });
  },
};

// Conversations in speech bubbles: one line at a time, paused while Gennaro is too far away to hear.
const talks = [];
const lineTime = (text) => Math.min(7, 2 + text.length * 0.06);

function startTalk({ lines, canHear, giveUp = () => false, onEnd }) {
  talks.push({ lines, i: 0, t: 0, canHear, giveUp, onEnd });
}

function updateTalks(dt) {
  for (const c of talks) if (c.t > 0) c.t -= dt;
  // Una battuta alla volta: le conversazioni non si accavallano.
  let busy = talks.some((c) => c.t > 0);
  for (const c of [...talks]) {
    if (c.t > 0) continue;
    if (c.i >= c.lines.length || c.giveUp()) {
      talks.splice(talks.indexOf(c), 1);
      c.onEnd?.();
      continue;
    }
    if (busy || !c.canHear()) continue;
    busy = true;
    const [who, text] = c.lines[c.i++];
    if (who === 'kiss') {
      startKiss(text);
      c.t = KISS_TIME;
      continue;
    }
    const seconds = lineTime(text);
    say(who, text, seconds);
    c.t = seconds + 0.3;
  }
}

// The pizzaiolo stands at the door of Gennaro's pizzeria; during the trial deliveries he explains the rules.
const pizzaiolo = { shirt: '#f4f1ea', trousers: '#f4f1ea', hair: '#1e1410', skin: '#d8a47c', say: '', sayT: 0 };
const HEAR_RANGE = 230;

function updatePizzaiolo(dt) {
  if (pizzaiolo.sayT > 0) pizzaiolo.sayT -= dt;
  const shop = career.job?.pizzeria ?? pizzaiolo.shop;
  if (shop) Object.assign(pizzaiolo, { shop, x: shop.pos[0] + 24, y: shop.pos[1] + 6 });
}

const pizzaioloVisible = () =>
  !!pizzaiolo.shop &&
  pizzaiolo.shop.id !== OWN_SHOP_ID && // nella pizzeria sua alla porta c'è Filomena
  (career.job?.pizzeria === pizzaiolo.shop || isTalking(pizzaiolo));

function drawPizzaiolo() {
  if (!pizzaioloVisible() || !isVisible(pizzaiolo.x, pizzaiolo.y)) return;
  const [sx, sy] = toScreen(pizzaiolo.x, pizzaiolo.y);
  drawPerson(sx, sy, Math.atan2(player.y - pizzaiolo.y, player.x - pizzaiolo.x), pizzaiolo, 0, false);
  // 'O cappiello bianco.
  const z = camera.zoom;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(sx, sy - 1 * z, 3.2 * z, 0, Math.PI * 2);
  ctx.fill();
}

onTalk((options) => {
  const { kind, lines, pizzeria, customer, address } = options;
  if (kind === 'stage') {
    pizzaiolo.shop = pizzeria;
    updatePizzaiolo(0);
    startTalk({
      lines: lines.map((text) => [pizzaiolo, text]),
      canHear: () => Math.hypot(player.x - pizzaiolo.x, player.y - pizzaiolo.y) < HEAR_RANGE,
      giveUp: () => career.job?.pizzeria !== pizzeria, // licenziato o andato via: niente più lezioni
    });
  } else if (kind in STORY_SCENES) {
    STORY_SCENES[kind](options);
  } else if (kind === 'vip') {
    Object.assign(leash, { x: player.x, y: player.y });
    // Il cliente resta accanto al suo monumento finché non hanno finito di parlare.
    Object.assign(vip, customer.look, { x: address.x + 12, y: address.y - 4, chatting: true, say: '', sayT: 0 });
    vip.order ??= { chat: true };
    const distance = () => Math.hypot(player.x - vip.x, player.y - vip.y);
    startTalk({
      lines: lines.map(([who, text]) => [who === 'g' ? player : vip, text]),
      canHear: () => distance() < HEAR_RANGE + 60,
      onEnd: () => {
        vip.chatting = false;
        vip.order = null;
      },
    });
  }
});

// The two mechanics, standing at their shop doors. Each has something to say about the other.
const mechanics = [
  { shop: GARAGE, kind: 'tuning', shirt: '#2b5f9e', trousers: '#2b5f9e', hair: '#3a2a1a', skin: '#d9a77f' },
  { shop: REPAIR_SHOP, kind: 'repair', shirt: '#3c7a3c', trousers: '#3c7a3c', hair: '#b9b4ab', skin: '#e0b48e' },
].map((m) => ({ ...m, x: m.shop.pos[0] - 26, y: m.shop.pos[1] + 4, say: '', sayT: 0, greeted: false }));

function updateMechanics(dt) {
  for (const m of mechanics) {
    if (m.sayT > 0) m.sayT -= dt;
    const d = Math.hypot(player.x - m.x, player.y - m.y);
    if (d < 160 && !m.greeted) {
      m.greeted = true;
      say(m, mechanicLine(m.kind), 5);
    } else if (d > 420) m.greeted = false;
  }
}

function drawMechanics() {
  for (const m of mechanics) {
    if (!isVisible(m.x, m.y)) continue;
    drawPerson(...toScreen(m.x, m.y), Math.atan2(player.y - m.y, player.x - m.x), m, 0, false);
  }
}

// The secret mission: the Dio del Calcio waits at the centre of the pitch, then vanishes.
const legend = { shirt: '#1d9be0', trousers: '#ffffff', hair: '#0d0806', skin: '#b98b62', say: '', sayT: 0, vanish: 0 };
const LEGEND_WAIT = ['Ccà, guagliò! A centrocampo!', "'O pallone nun se ferma maje.", "Tengo na famma 'e campione!"];
const VANISH_TIME = 3.5;

function updateLegend(dt) {
  const order = legendOrder();
  if (legend.sayT > 0) legend.sayT -= dt;
  if (order) {
    const { address } = order.stops[0];
    Object.assign(legend, { x: address.x + 14, y: address.y - 4, order });
    if (legend.sayT <= 0 && Math.hypot(player.x - legend.x, player.y - legend.y) < 320 && Math.random() < dt * 0.5)
      say(legend, LEGEND_WAIT[Math.floor(Math.random() * LEGEND_WAIT.length)], 2.4);
  } else if (legend.order) {
    if (legend.order.state === 'done') {
      say(legend, "Grazie, guagliò. Io so' 'o Dio d''o Calcio.", VANISH_TIME);
      legend.vanish = VANISH_TIME;
    }
    legend.order = null;
  }
  if (legend.vanish > 0) legend.vanish -= dt;
  // The gate stays open for the mission, and until nobody (and no Vespa) is left inside.
  stadiumGate.open =
    !!order ||
    legend.vanish > 0 ||
    inStadium(player.x, player.y) ||
    vespas.some((v) => !v.ridden && inStadium(v.x, v.y));
}

// From day 8 until the mission, people in the street talk about the Dio del Calcio coming back.
const rumor = { wait: 8 };
function updateRumors(dt) {
  const { rumorsFrom, day } = RULES.legend;
  if (career.legendFired || career.day < rumorsFrom || career.day > day || career.status === 'broke') return;
  rumor.wait -= dt;
  if (rumor.wait > 0) return;
  rumor.wait = 12 + Math.random() * 18; // una voce ogni 12-30 secondi
  const near = people.pedestrians.filter(
    (p) => p.down <= 0 && !isTalking(p) && Math.hypot(p.x - player.x, p.y - player.y) < 260 && isVisible(p.x, p.y),
  );
  if (near.length)
    say(near[Math.floor(Math.random() * near.length)], RUMORS[Math.floor(Math.random() * RUMORS.length)], 3.5);
  else rumor.wait = 2; // nessuno vicino: riprova fra poco
}

const legendVisible = () => !!legend.order || legend.vanish > 0;

function drawLegend() {
  if (!legendVisible() || !isVisible(legend.x, legend.y)) return;
  const [sx, sy] = toScreen(legend.x, legend.y);
  const z = camera.zoom;
  const fade = legend.order ? 1 : Math.min(1, legend.vanish / 1.5);
  // A golden halo, and sparkles while he disappears.
  ctx.globalAlpha = fade * (0.35 + 0.15 * Math.sin(time.t * 4));
  ctx.fillStyle = LEGEND_COLOR;
  ctx.beginPath();
  ctx.arc(sx, sy, 16 * z, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = fade;
  drawPerson(sx, sy, Math.atan2(player.y - legend.y, player.x - legend.x), legend, 0, false);
  ctx.globalAlpha = 1;
  if (!legend.order)
    for (let k = 0; k < 10; k++) {
      const an = k * 0.63 + time.t * 2;
      const r = (1 - fade) * 30 * z + 8 * z;
      ctx.fillStyle = k % 2 ? '#fff' : LEGEND_COLOR;
      ctx.fillRect(sx + Math.cos(an) * r - 1.5, sy + Math.sin(an) * r - 1.5, 3, 3);
    }
}

function drawWorld() {
  const view = visibleTiles();
  drawGround(view);

  for (const v of vespas) if (!v.ridden && isVisible(v.x, v.y)) drawVespa(v);
  for (const p of people.pedestrians)
    if (p.down > 0 && isVisible(p.x, p.y)) drawFallenPerson(...toScreen(p.x, p.y), p.a, p);
  for (const p of people.pedestrians)
    if (p.down <= 0 && isVisible(p.x, p.y)) drawPerson(...toScreen(p.x, p.y), p.a, p, p.walk, true);
  for (const c of traffic.parkedCars) if (isVisible(c.x, c.y)) drawCar(c);
  for (const c of traffic.cars) if (isVisible(c.x, c.y)) drawCar(c);
  drawFootballer();
  drawVip();
  drawMechanics();
  drawPizzaiolo();
  drawFilomena();
  drawLegend();
  if (scene.top) {
    // Gennaro è in cima al castello: lo disegniamo lassù, dopo i palazzi.
  } else if (player.mode === 'foot')
    drawPerson(...toScreen(player.x, player.y), player.a, player, player.walk, player.moving);
  else if (player.mode === 'vespa') drawVespa(player.vespa, player, pizzasOnBoard());

  for (const t of trees) drawTree(t);
  drawEffects();
  drawBuildings(view, { playerInTunnel: isInTunnel(player.x, player.y) });
  drawCastleTop();
  drawFunicolari(player);
  if (player.mode === 'metro') drawMetroOverlay();

  // Shop signs stay readable above the roofs of the vicoli.
  for (const p of PIZZERIAS)
    drawPizzeria(p, pizzeriaLook(p), Math.hypot(p.pos[0] - player.x, p.pos[1] - player.y) < 200);
  for (const g of [GARAGE, REPAIR_SHOP]) drawGarage(g, Math.hypot(g.pos[0] - player.x, g.pos[1] - player.y) < 200);
  drawStadiumGate(STADIUM_GATE.rect, stadiumGate.open);
  const next = currentObjective(player);
  for (const { order, stop } of pendingStops())
    drawStop(stop, order, next && next.x === stop.address.x && next.y === stop.address.y, stopColor(order));
  for (const p of people.pedestrians) if (isTalking(p) && isVisible(p.x, p.y)) drawBubble(p.x, p.y, p.say);
  for (const c of traffic.cars) if (isTalking(c) && isVisible(c.x, c.y)) drawBubble(c.x, c.y, c.say);
  if (footballerOrder() && isTalking(footballer)) drawBubble(footballer.x, footballer.y, footballer.say);
  if (vip.order && isTalking(vip)) drawBubble(vip.x, vip.y, vip.say);
  for (const m of mechanics) if (isTalking(m) && isVisible(m.x, m.y)) drawBubble(m.x, m.y, m.say);
  if (pizzaioloVisible() && isTalking(pizzaiolo)) drawBubble(pizzaiolo.x, pizzaiolo.y, pizzaiolo.say);
  if (legendVisible() && isTalking(legend)) drawBubble(legend.x, legend.y, legend.say);
  if (filomenaVisible() && isTalking(filomena)) drawBubble(filomena.x, filomena.y, filomena.say, filomena.h);
  if (isTalking(player)) drawBubble(player.x, player.y, player.say);
  if (scene.top && isTalking(topGennaro)) drawBubble(topGennaro.x, topGennaro.y, topGennaro.say, TOP_H + 0.5);
  drawKiss();
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
  game.district = districtAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
  if (game.loaded) {
    game.hintTime = 0;
    showBanner(`Giorno ${career.day} · ${game.district}`);
  } else showBanner('Piazza del Plebiscito');
}

// A saved game is put back before the city fills up, so traffic and people appear around Gennaro.
const saved = readSave();
if (saved) {
  game.loaded = loadGame(career, saved, story);
  if (!game.loaded) location.reload();
}

// Autosave: every 15 seconds, when the tab is hidden (and then pause) and when the page closes.
setInterval(() => !game.resetting && !isDialogOpen() && save(), 15_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden' || game.resetting) return;
  save();
  if (playing() && !streetMap.open) pause();
});
addEventListener('pagehide', () => !game.resetting && save());

// Dents: tell Gennaro every 5% of speed lost.
onBump((v, before) => {
  if (v !== player.vespa) return;
  const step = (c) => Math.floor(Math.round(c * 1000) / 50);
  if (step(v.condition) < step(before))
    toast(`Vespa ammaccata: va al ${conditionPct(v)}%. Si ripara solo a Via Gianturco`, '#ff9f40', 4);
});

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
document.getElementById('pause').onclick = () => playing() && pause();
if (game.loaded) {
  document.getElementById('go').textContent = `CONTINUA · GIORNO ${career.day}`;
  const fresh = document.getElementById('new');
  fresh.style.display = 'inline-block';
  fresh.onclick = newGame;
}
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
