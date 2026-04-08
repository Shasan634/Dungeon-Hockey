// tilemap.js - Tilemap data structure and collision detection
// COMP 4300 - Dungeon Hockey

export const COLS = 23;
export const ROWS = 17;
export const TILE = 2.0; // world units per tile

// 2D array: 0 = floor, 1 = wall
export const tilemap = Array(ROWS).fill(null).map(() => Array(COLS).fill(1));

/**
 * Converts tile coordinates to world position
 * @param {number} r - row index
 * @param {number} c - column index
 * @returns {{x: number, z: number}} world position at tile center
 */
export function tileToWorld(r, c) {
  return {
    x: (c - COLS / 2) * TILE + TILE / 2,
    z: (r - ROWS / 2) * TILE + TILE / 2
  };
}

/**
 * Converts world position to nearest tile coordinates
 * @param {number} x - world x position
 * @param {number} z - world z position
 * @returns {{r: number, c: number}} tile coordinates
 */
export function worldToTile(x, z) {
  const c = Math.floor((x + COLS * TILE / 2) / TILE);
  const r = Math.floor((z + ROWS * TILE / 2) / TILE);
  return { r, c };
}

/**
 * Checks if a tile is a wall or out of bounds
 * @param {number} r - row index
 * @param {number} c - column index
 * @returns {boolean} true if wall or out of bounds
 */
export function isWall(r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
  return tilemap[r][c] === 1;
}

/**
 * Finds the nearest non-wall tile to a world position
 * @param {number} x - world x position
 * @param {number} z - world z position
 * @returns {{r: number, c: number}} nearest floor tile coordinates
 */
export function nearestFloor(x, z) {
  const { r, c } = worldToTile(x, z);

  // If current tile is floor, return it
  if (!isWall(r, c)) return { r, c };

  // Spiral search outward for nearest floor tile
  for (let radius = 1; radius < Math.max(ROWS, COLS); radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dr) === radius || Math.abs(dc) === radius) {
          const nr = r + dr;
          const nc = c + dc;
          if (!isWall(nr, nc)) return { r: nr, c: nc };
        }
      }
    }
  }

  // Fallback to center
  return { r: Math.floor(ROWS / 2), c: Math.floor(COLS / 2) };
}

/**
 * Resolves circle vs AABB collision for all nearby wall tiles
 * Mutates entity position and velocity to resolve collisions
 * @param {Object} entity - entity with {x, z, vx, vz, radius}
 * @param {boolean} isPuck - if true, dampens velocity on bounce
 * Mutates: entity.x, entity.z, entity.vx, entity.vz
 */
export function resolveWalls(entity, isPuck = false) {
  const { r, c } = worldToTile(entity.x, entity.z);
  const checkRadius = 3; // Increased from 2 to catch more walls

  // Check all walls within radius
  for (let dr = -checkRadius; dr <= checkRadius; dr++) {
    for (let dc = -checkRadius; dc <= checkRadius; dc++) {
      const tr = r + dr;
      const tc = c + dc;

      if (!isWall(tr, tc)) continue;

      // AABB for this wall tile
      const wallWorld = tileToWorld(tr, tc);
      const halfTile = TILE / 2;

      // Circle vs AABB collision
      const closestX = Math.max(wallWorld.x - halfTile, Math.min(entity.x, wallWorld.x + halfTile));
      const closestZ = Math.max(wallWorld.z - halfTile, Math.min(entity.z, wallWorld.z + halfTile));

      const dx = entity.x - closestX;
      const dz = entity.z - closestZ;
      const distSq = dx * dx + dz * dz;
      const radiusSq = entity.radius * entity.radius;

      if (distSq < radiusSq && distSq > 0) {
        // Collision detected - push entity out
        const dist = Math.sqrt(distSq);
        const overlap = entity.radius - dist;
        const nx = dx / dist;
        const nz = dz / dist;

        entity.x += nx * overlap;
        entity.z += nz * overlap;

        // Reflect velocity along collision normal
        const dot = entity.vx * nx + entity.vz * nz;
        entity.vx -= 2 * dot * nx;
        entity.vz -= 2 * dot * nz;

        // Dampen puck velocity on wall bounce
        if (isPuck) {
          entity.vx *= 0.5;
          entity.vz *= 0.5;
        }
      }
    }
  }

  // Hard boundary clamp to prevent entities from escaping the map
  const worldBounds = {
    minX: -COLS * TILE / 2 + entity.radius,
    maxX: COLS * TILE / 2 - entity.radius,
    minZ: -ROWS * TILE / 2 + entity.radius,
    maxZ: ROWS * TILE / 2 - entity.radius
  };

  if (entity.x < worldBounds.minX) {
    entity.x = worldBounds.minX;
    entity.vx = Math.abs(entity.vx) * (isPuck ? 0.5 : 1);
  }
  if (entity.x > worldBounds.maxX) {
    entity.x = worldBounds.maxX;
    entity.vx = -Math.abs(entity.vx) * (isPuck ? 0.5 : 1);
  }
  if (entity.z < worldBounds.minZ) {
    entity.z = worldBounds.minZ;
    entity.vz = Math.abs(entity.vz) * (isPuck ? 0.5 : 1);
  }
  if (entity.z > worldBounds.maxZ) {
    entity.z = worldBounds.maxZ;
    entity.vz = -Math.abs(entity.vz) * (isPuck ? 0.5 : 1);
  }
}
