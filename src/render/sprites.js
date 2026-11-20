import { TAU } from '../core/math.js';
import { shade } from '../core/color.js';
import { camera, project, toScreen } from './camera.js';
import { ctx, disc, ellipse, inFrame, roundRect, screen } from './canvas.js';

const TROUSERS = '#2b3550';

/** A person seen from above. `phase` animates the stride. */
export function drawPerson(sx, sy, angle, { shirt, hair, skin, trousers = TROUSERS }, phase = 0, moving = false) {
  inFrame(sx, sy, angle, camera.zoom, () => {
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ellipse(1.5, 1.5, 6, 7.5);
    const stride = moving ? Math.sin(phase) * 4 : 0;
    ctx.fillStyle = trousers;
    ctx.fillRect(-2 + stride, -4.6, 5, 3.2);
    ctx.fillRect(-2 - stride, 1.4, 5, 3.2);
    ctx.fillStyle = skin;
    disc(-stride * 0.6, -6.6, 1.9);
    disc(stride * 0.6, 6.6, 1.9);
    ctx.fillStyle = shirt;
    ellipse(0, 0, 4.2, 6.6);
    ctx.fillStyle = hair;
    disc(0.6, 0, 3.7);
  });
}

/** Someone knocked flat by a Vespa. */
export function drawFallenPerson(sx, sy, angle, { shirt, hair, skin }) {
  inFrame(sx, sy, angle, camera.zoom, () => {
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ellipse(0, 1, 11, 5);
    ctx.fillStyle = TROUSERS;
    ctx.fillRect(-12, -3.5, 8, 3);
    ctx.fillRect(-12, 0.5, 8, 3);
    ctx.fillStyle = shirt;
    ellipse(-1, 0, 6, 4.8);
    ctx.fillStyle = skin;
    disc(-1, -6, 1.8);
    disc(-1, 6, 1.8);
    ctx.fillStyle = hair;
    disc(7, 0, 3.6);
  });
}

/** The Vespa; with `rider` it also draws Gennaro (and his pizza box when `cargo`). */
export function drawVespa(v, rider = null, cargo = 0) {
  const [sx, sy] = toScreen(v.x, v.y);
  inFrame(sx, sy, v.a, camera.zoom, () => {
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ellipse(2, 2.5, 16, 7);
    ctx.fillStyle = '#1c1c1c'; // tyres
    ctx.fillRect(-15, -1.6, 5, 3.2);
    ctx.fillRect(12, -1.6, 5, 3.2);
    ctx.fillStyle = v.color;
    roundRect(-15, -6.5, 17, 13, 5.5);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(1, -3.6, 8, 7.2);
    ctx.fillStyle = v.color;
    roundRect(8, -5, 6, 10, 3);
    ctx.fillStyle = shade(v.color, -0.25);
    roundRect(13, -2.6, 4.5, 5.2, 2);
    ctx.fillStyle = '#262626'; // seat
    roundRect(-12.5, -3.6, 11.5, 7.2, 3);
    ctx.fillStyle = '#c8c8c8'; // handlebar
    ctx.fillRect(9, -8.5, 2.4, 17);
    ctx.fillStyle = '#222';
    ctx.fillRect(9, -9.5, 2.4, 3);
    ctx.fillRect(9, 6.5, 2.4, 3);
    ctx.fillStyle = '#fff6c0';
    disc(12.2, 0, 1.9);
    ctx.fillStyle = '#e33';
    ctx.fillRect(-16, -1.5, 1.6, 3);
    if (cargo) drawPizzaBox(-21, 0, cargo);
    if (rider) {
      ctx.fillStyle = rider.shirt; // arms
      ctx.fillRect(-4, -7.2, 12.5, 2.8);
      ctx.fillRect(-4, 4.4, 12.5, 2.8);
      ctx.fillStyle = '#e8b994';
      disc(9.6, -5.8, 1.9);
      disc(9.6, 5.8, 1.9);
      ctx.fillStyle = rider.shirt;
      ellipse(-5, 0, 4.6, 6.9);
      ctx.fillStyle = rider.hair;
      disc(-4.3, 0, 3.9);
    }
  });
}

/** The red thermal delivery box strapped behind the seat. */
function drawPizzaBox(x, y, stack) {
  const h = 12 + Math.min(stack, 3) * 1.2;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(x - 4, y - h / 2 + 2, 12, h);
  ctx.fillStyle = '#c8262b';
  ctx.fillRect(x - 6, y - h / 2, 12, h);
  ctx.fillStyle = '#f4efe2';
  ctx.fillRect(x - 4, y - 3, 8, 6);
  ctx.fillStyle = '#c8262b';
  disc(x, y, 2);
}

export function drawCar(c) {
  const [sx, sy] = toScreen(c.x, c.y);
  inFrame(sx, sy, c.a, camera.zoom, () => {
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    roundRect(-17, -7, 38, 18, 5);
    ctx.fillStyle = c.color;
    roundRect(-19, -9, 38, 18, 5);
    ctx.fillStyle = shade(c.color, -0.18);
    ctx.fillRect(-19, -9.5, 6, 1.5);
    ctx.fillStyle = '#22303c'; // windscreens
    roundRect(5.5, -7.5, 5, 15, 2);
    roundRect(-13, -7, 3.5, 14, 1.5);
    ctx.fillStyle = shade(c.color, 0.16);
    roundRect(-9.5, -7, 15, 14, 2.5);
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(17.5, -7.5, 1.8, 3.5);
    ctx.fillRect(17.5, 4, 1.8, 3.5);
    ctx.fillStyle = c.v < 15 && c.blocked > 0 ? '#ff3b30' : '#9b1d1d'; // brake lights
    ctx.fillRect(-19.5, -7.5, 1.6, 3.5);
    ctx.fillRect(-19.5, 4, 1.6, 3.5);
    if (c.taxi) {
      ctx.fillStyle = '#f2d33a';
      roundRect(-4, -3.5, 6, 7, 1);
    }
  });
}

export function drawTree(t) {
  const [bx, by] = toScreen(t.x, t.y);
  if (bx < -60 || by < -60 || bx > screen.w + 60 || by > screen.h + 60) return;
  const [sx, sy, s] = project(t.x, t.y, t.palm ? 2.2 : 1.5);
  ctx.strokeStyle = t.palm ? '#7a5a38' : '#5a4028';
  ctx.lineWidth = (t.palm ? 3 : 4) * camera.zoom;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(sx, sy);
  ctx.stroke();
  inFrame(sx, sy, 0, camera.zoom * s * t.scale, () => {
    if (t.palm) {
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      disc(3, 3, 11);
      for (let j = 0; j < 8; j++) {
        ctx.save();
        ctx.rotate((j * TAU) / 8 + t.x * 0.01);
        ctx.fillStyle = j % 2 ? '#2f7a34' : '#3c8f3e';
        ellipse(7, 0, 8, 2.6);
        ctx.restore();
      }
      ctx.fillStyle = '#6b4a2b';
      disc(0, 0, 2.4);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      disc(3, 3, 11);
      ctx.fillStyle = '#356d2e';
      disc(0, 0, 11);
      ctx.fillStyle = '#478a3a';
      disc(-2.5, -2.5, 7.5);
      ctx.fillStyle = '#5aa048';
      disc(-4, -4, 3.5);
    }
  });
}

/** Comic speech bubble above a world point. */
export function drawBubble(wx, wy, text, h = 0.5) {
  const [sx, sy] = project(wx, wy, h);
  ctx.font = '9px "Press Start 2P",monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Le frasi lunghe vanno a capo.
  const maxW = Math.min(240, screen.w * 0.6);
  const lines = [];
  for (const word of text.split(' ')) {
    const last = lines.at(-1);
    if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= maxW)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  const lineH = 13;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 12;
  const hgt = 7 + lines.length * lineH;
  const bx = sx - w / 2;
  const by = sy - 16 - hgt;
  ctx.fillStyle = '#000';
  ctx.fillRect(bx + 2, by + 2, w, hgt);
  ctx.fillStyle = '#fff';
  ctx.fillRect(bx, by, w, hgt);
  ctx.beginPath();
  ctx.moveTo(sx - 4, by + hgt);
  ctx.lineTo(sx + 3, by + hgt);
  ctx.lineTo(sx - 2, by + hgt + 7);
  ctx.fill();
  ctx.fillStyle = '#111';
  lines.forEach((l, k) => ctx.fillText(l, sx, by + 4 + lineH / 2 + k * lineH));
}
