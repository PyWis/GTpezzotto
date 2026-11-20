import { time } from '../core/time.js';
import { FUNICULARS } from '../data/city.js';
import { funicularRide, metroPosition, metroRide } from '../entities/transit.js';
import { camera, project, toScreen } from './camera.js';
import {
  centeredLabel,
  ctx,
  disc,
  ellipse,
  inFrame,
  line,
  outlinedText,
  polyline,
  roundRect,
  screen,
} from './canvas.js';

const CABLE_HEIGHT = 6.2; // funicular track drawn on a viaduct above the roofs

export function drawFunicolari(player) {
  const z = camera.zoom;
  for (const f of FUNICULARS) {
    const A = project(...f.A, CABLE_HEIGHT);
    const B = project(...f.B, CABLE_HEIGHT);
    if (Math.max(A[0], B[0]) < -50 || Math.min(A[0], B[0]) > screen.w + 50) continue;
    if (Math.max(A[1], B[1]) < -50 || Math.min(A[1], B[1]) > screen.h + 50) continue;

    for (const end of [f.A, f.B]) {
      const g = toScreen(...end);
      const t = project(...end, CABLE_HEIGHT);
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 3 * z;
      line(g[0], g[1], t[0], t[1]);
      ctx.fillStyle = f.color;
      ctx.fillRect(g[0] - 9 * z, g[1] - 9 * z, 18 * z, 18 * z);
      centeredLabel('F', g[0], g[1] + 1, 10 * z, '#fff');
    }

    // Rails and sleepers.
    const nx = -Math.sin(f.angle);
    const ny = Math.cos(f.angle);
    const along = (t, off) =>
      project(f.A[0] + (f.B[0] - f.A[0]) * t + nx * off, f.A[1] + (f.B[1] - f.A[1]) * t + ny * off, CABLE_HEIGHT);
    ctx.strokeStyle = 'rgba(40,40,40,.85)';
    ctx.lineWidth = 1.6 * z;
    ctx.beginPath();
    for (const side of [-5, 5]) {
      const a = along(0, side);
      const b = along(1, side);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,50,40,.6)';
    ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    const n = Math.floor(f.length / 14);
    for (let j = 0; j <= n; j++) {
      const a = along(j / n, 8);
      const b = along(j / n, -8);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();

    // Cabin: shuttles on its own unless Gennaro is riding it.
    const riding = funicularRide.line === f;
    const t = riding ? funicularRide.t : (Math.sin(time.t * 0.22 + f.length) + 1) / 2;
    const c = project(f.A[0] + (f.B[0] - f.A[0]) * t, f.A[1] + (f.B[1] - f.A[1]) * t, CABLE_HEIGHT + 0.4);
    inFrame(c[0], c[1], f.angle, z * c[2], () => {
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      roundRect(-17, -7, 38, 18, 3);
      ctx.fillStyle = f.color;
      roundRect(-19, -9, 38, 18, 3);
      ctx.fillStyle = '#f4efe2';
      ctx.fillRect(-17, -6, 34, 12);
      ctx.fillStyle = '#9fc9e0';
      for (let j = -15; j < 15; j += 7) ctx.fillRect(j, -5, 5, 10);
      if (riding) {
        ctx.fillStyle = player.shirt;
        ellipse(0, 0, 4, 6);
        ctx.fillStyle = player.hair;
        disc(0.5, 0, 3.6);
      }
    });
  }
}

/** Underground view: dims the city and shows the line, its stations and the train. */
export function drawMetroOverlay() {
  const z = camera.zoom;
  const { line: L } = metroRide;
  ctx.fillStyle = 'rgba(6,6,14,.66)';
  ctx.fillRect(0, 0, screen.w, screen.h);
  polyline(L.stations.map((s) => toScreen(...s.pos)));
  ctx.strokeStyle = L.color;
  ctx.lineWidth = 6 * z;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineCap = 'butt';
  for (const st of L.stations) {
    const [a, b] = toScreen(...st.pos);
    ctx.fillStyle = '#fff';
    disc(a, b, 7 * z);
    ctx.fillStyle = L.color;
    disc(a, b, 4 * z);
    outlinedText(st.name, a + 10 * z, b - 8 * z, screen.small ? 7 : 9, '#ffffff');
  }

  const [x, y, an] = metroPosition();
  const [a, b] = toScreen(x, y);
  inFrame(a, b, an, z, () => {
    ctx.fillStyle = '#000';
    ctx.fillRect(-58, -10, 116, 20);
    for (let j = 0; j < 3; j++) {
      ctx.fillStyle = '#e8e4da';
      ctx.fillRect(-56 + j * 38, -8, 36, 16);
      ctx.fillStyle = L.color;
      ctx.fillRect(-56 + j * 38, -2, 36, 4);
      ctx.fillStyle = '#2b3a48';
      for (let w = 0; w < 4; w++) ctx.fillRect(-53 + j * 38 + w * 8, -6, 5, 3);
    }
    ctx.fillStyle = '#fff6c0';
    ctx.fillRect(56, -6, 2, 4);
    ctx.fillRect(56, 2, 2, 4);
  });
  const dest = L.stations[metroRide.to].name;
  outlinedText(
    `METRO ${L.name.toUpperCase()}  →  ${dest.toUpperCase()}`,
    screen.w / 2,
    screen.h - 60,
    screen.small ? 9 : 13,
    L.color,
    'center',
  );
}
