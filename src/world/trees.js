import { hash } from '../core/math.js';
import { MAP_H, MAP_W, OY, PLAZAS, TILE } from '../data/city.js';
import { grid, index } from './map.js';
import { Tile } from './tiles.js';

/** Trees and palms, placed once from the tile noise. */
export const trees = [];

const palmsInPark = (x, y) => (((y -= OY) >= 68 && x < 104) || (x >= 116 && x < 164 && y >= 80)) && hash(x, y, 9) < 0.6;
const tree = (x, y, palm, scale) => trees.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, palm, scale });

for (let y = 0; y < MAP_H; y++)
  for (let x = 0; x < MAP_W; x++) {
    const i = index(x, y);
    const n = grid.noise[i];
    switch (grid.tile[i]) {
      case Tile.PARK:
        if (n < 0.42)
          trees.push({
            x: (x + 0.2 + hash(x, y, 4) * 0.6) * TILE,
            y: (y + 0.2 + hash(x, y, 5) * 0.6) * TILE,
            palm: palmsInPark(x, y),
            scale: 0.8 + hash(x, y, 6) * 0.5,
          });
        break;
      case Tile.SAND:
        if (n < 0.05) tree(x, y, true, 1);
        break;
      case Tile.BROWNFIELD:
        if (n < 0.04) tree(x, y, false, 0.7);
        break;
      case Tile.SIDEWALK: // the palms of Via Caracciolo
        if (y - OY === 91 && x >= 104 && x < 158 && x % 3 === 0) tree(x, y, true, 1);
        break;
      case Tile.PLAZA:
        if (PLAZAS[grid.plaza[i]].palms && n < 0.06) tree(x, y, true, 0.9);
        break;
    }
  }
