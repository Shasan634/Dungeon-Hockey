// dungeon.js - Procedural dungeon generation using room placement and corridors

import { tilemap, COLS, ROWS } from './tilemap.js';

const MIN_W = 4;
const MAX_W = 7;
const MIN_H = 3;
const MAX_H = 5;
const NUM_ROOMS = 7;
const MAX_TRIES = 120;

let rooms = [];

/**
 * Generates a procedural dungeon by placing rooms and connecting them with corridors
 * Mutates the global tilemap array
 * @returns {Array<Object>} array of room objects {x, y, w, h, cx, cy}
 */
export function generateDungeon() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      tilemap[r][c] = 1;
    }
  }

  rooms = [];

  for (let roomIdx = 0; roomIdx < NUM_ROOMS; roomIdx++) {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < MAX_TRIES) {
      attempts++;

      const w = Math.floor(Math.random() * (MAX_W - MIN_W + 1)) + MIN_W;
      const h = Math.floor(Math.random() * (MAX_H - MIN_H + 1)) + MIN_H;

      const x = Math.floor(Math.random() * (COLS - w - 2)) + 1;
      const y = Math.floor(Math.random() * (ROWS - h - 2)) + 1;

      let overlaps = false;
      for (const room of rooms) {
        if (!(x + w + 2 < room.x || x - 2 > room.x + room.w ||
              y + h + 2 < room.y || y - 2 > room.y + room.h)) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        for (let r = y; r < y + h; r++) {
          for (let c = x; c < x + w; c++) {
            tilemap[r][c] = 0;
          }
        }

        const cx = Math.floor(x + w / 2);
        const cy = Math.floor(y + h / 2);
        rooms.push({ x, y, w, h, cx, cy });
        placed = true;
      }
    }
  }

  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1];
    const curr = rooms[i];

    if (Math.random() < 0.5) {
      carveHCorridor(prev.cx, curr.cx, prev.cy);
      carveVCorridor(prev.cy, curr.cy, curr.cx);
    } else {
      carveVCorridor(prev.cy, curr.cy, prev.cx);
      carveHCorridor(prev.cx, curr.cx, curr.cy);
    }
  }

  return rooms;
}

/**
 * Carves a horizontal corridor between two x positions at a given y
 * Mutates the global tilemap array
 * @param {number} x1 - start column
 * @param {number} x2 - end column
 * @param {number} y - row to carve
 */
function carveHCorridor(x1, x2, y) {
  const startX = Math.min(x1, x2);
  const endX = Math.max(x1, x2);

  for (let c = startX; c <= endX; c++) {
    if (y >= 0 && y < ROWS && c >= 0 && c < COLS) {
      tilemap[y][c] = 0;
    }
  }
}

/**
 * Carves a vertical corridor between two y positions at a given x
 * Mutates the global tilemap array
 * @param {number} y1 - start row
 * @param {number} y2 - end row
 * @param {number} x - column to carve
 */
function carveVCorridor(y1, y2, x) {
  const startY = Math.min(y1, y2);
  const endY = Math.max(y1, y2);

  for (let r = startY; r <= endY; r++) {
    if (r >= 0 && r < ROWS && x >= 0 && x < COLS) {
      tilemap[r][x] = 0;
    }
  }
}

/**
 * Returns the spawn room (first room generated)
 * @returns {Object} room object {x, y, w, h, cx, cy}
 */
export function getSpawnRoom() {
  return rooms[0];
}

/**
 * Returns the goal room (last room generated)
 * @returns {Object} room object {x, y, w, h, cx, cy}
 */
export function getGoalRoom() {
  return rooms[rooms.length - 1];
}
