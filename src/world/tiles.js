export const Tile = Object.freeze({
  BUILDING: 0,
  ROAD: 1,
  SIDEWALK: 2,
  SEA: 3,
  PARK: 4,
  PLAZA: 5,
  LANDMARK: 6,
  ROCK: 7,
  QUAY: 8,
  MOUNTAIN: 9,
  PITCH: 10,
  SAND: 11,
  BROWNFIELD: 12,
  RAIL: 13,
  TRACK: 14,
});

/** How the roof/walls of a raised tile are decorated. */
export const Style = Object.freeze({
  HOUSE: 0,
  MONUMENT: 1,
  VOLCANO: 2,
  TOWER: 3,
  GREEN: 4,
  PLAIN: 5,
  SHED: 6,
});

/** Group ids for natural masses (positive ids are building blocks, -1-i are landmarks). */
export const Group = Object.freeze({ VOLCANO: -999, HILL: -998, ISLAND: -997 });
