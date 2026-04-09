// puck.js - Puck physics, shooting, and passing
// COMP 4300 - Dungeon Hockey

import * as THREE from 'three';
import { resolveWalls } from './tilemap.js';

export const puck = {
  x: 0,
  z: 0,
  vx: 0,
  vz: 0,
  radius: 0.22,
  friction: 0.97,
  mesh: null,
  // Possession state
  holder: null,          // entity currently carrying the puck (player or linemate)
  releaseCooldown: 0     // seconds after shoot/pass before shooter can re-grab
};

/**
 * Initializes the puck mesh and adds it to the scene
 * @param {{x: number, z: number}} spawnWorld - spawn position in world coordinates
 * @param {THREE.Group} levelGroup - Three.js group to add puck mesh to
 * Mutates: puck object
 */
export function initPuck(spawnWorld, levelGroup) {
  puck.x = spawnWorld.x;
  puck.z = spawnWorld.z;
  puck.vx = 0;
  puck.vz = 0;
  puck.holder = null;
  puck.releaseCooldown = 0;

  // Create puck mesh (flat cylinder)
  const geometry = new THREE.CylinderGeometry(puck.radius, puck.radius, 0.2, 16);
  const material = new THREE.MeshStandardMaterial({
    color: 0xff6600,
    emissive: 0xff3300,
    emissiveIntensity: 0.6
  });
  puck.mesh = new THREE.Mesh(geometry, material);
  puck.mesh.position.set(puck.x, 0.1, puck.z);

  // Add point light to puck
  const light = new THREE.PointLight(0xff6600, 1.2, 6);
  light.position.set(0, 0.3, 0);
  puck.mesh.add(light);

  levelGroup.add(puck.mesh);
}

/**
 * Updates puck physics, handles collisions with player, linemates, walls, and goal
 * @param {number} dt - delta time in seconds
 * @param {Object} player - player object with {x, z, vx, vz, radius}
 * @param {Array} linemates - array of linemate entities
 * @param {Function} onGoal - callback when puck reaches goal
 * @param {{x: number, z: number}} goalPos - goal position in world coordinates
 * Mutates: puck object
 */
export function updatePuck(dt, player, linemates, onGoal, goalPos) {
  // Tick release cooldown so the shooter can eventually re-grab
  if (puck.releaseCooldown > 0) puck.releaseCooldown -= dt;

  // ── Possession mode ──────────────────────────────────────────────────────
  // When a holder carries the puck, lock it just in front of them and skip
  // all free-puck physics. Goal detection still runs so you can carry it in.
  if (puck.holder) {
    const h = puck.holder;
    const carryDist = h.radius + puck.radius + 0.05;
    puck.x = h.x + h.fx * carryDist;
    puck.z = h.z + h.fz * carryDist;
    puck.vx = 0;
    puck.vz = 0;

    if (puck.mesh) puck.mesh.position.set(puck.x, 0.1, puck.z);

    const goalDist = Math.hypot(puck.x - goalPos.x, puck.z - goalPos.z);
    if (goalDist < 2.2) onGoal();
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Update position
  puck.x += puck.vx * dt;
  puck.z += puck.vz * dt;

  // Apply friction
  puck.vx *= puck.friction;
  puck.vz *= puck.friction;

  // Stop if moving very slowly
  if (Math.abs(puck.vx) < 0.01) puck.vx = 0;
  if (Math.abs(puck.vz) < 0.01) puck.vz = 0;

  // Wall collision (with velocity dampening)
  resolveWalls(puck, true);

  // Player collision - deflect free puck
  {
    const dx = puck.x - player.x;
    const dz = puck.z - player.z;
    const dist = Math.hypot(dx, dz);
    if (dist < puck.radius + player.radius && dist > 0) {
      const nx = dx / dist;
      const nz = dz / dist;
      const overlap = (puck.radius + player.radius) - dist;
      puck.x += nx * overlap;
      puck.z += nz * overlap;
      puck.vx = player.vx * 1.5;
      puck.vz = player.vz * 1.5;
    }
  }

  // Linemate collision - deflect free puck
  for (const linemate of linemates) {
    const ldx = puck.x - linemate.x;
    const ldz = puck.z - linemate.z;
    const ldist = Math.hypot(ldx, ldz);
    const lradius = linemate.radius || 0.4;

    if (ldist < puck.radius + lradius && ldist > 0) {
      const lnx = ldx / ldist;
      const lnz = ldz / ldist;
      const overlap = (puck.radius + lradius) - ldist;
      puck.x += lnx * overlap;
      puck.z += lnz * overlap;
      const dot = puck.vx * lnx + puck.vz * lnz;
      puck.vx -= 2 * dot * lnx;
      puck.vz -= 2 * dot * lnz;
      puck.vx *= 0.8;
      puck.vz *= 0.8;
    }
  }

  // Check goal
  const goalDist = Math.hypot(puck.x - goalPos.x, puck.z - goalPos.z);
  if (goalDist < 2.2) onGoal();

  if (puck.mesh) puck.mesh.position.set(puck.x, 0.1, puck.z);
}

/**
 * Shoots the puck in the direction the shooter is facing.
 * No-ops if the shooter does not currently possess the puck.
 * @param {Object} shooter - any entity with {fx, fz} (player or linemate)
 * @param {Object} puck - puck object
 * Mutates: puck.holder, puck.releaseCooldown, puck.vx, puck.vz
 */
export function shoot(shooter, puck) {
  if (puck.holder !== shooter) return; // must have possession
  puck.holder = null;
  puck.releaseCooldown = 0.35; // prevent immediate re-grab
  const speed = 13;
  puck.vx = shooter.fx * speed;
  puck.vz = shooter.fz * speed;
}

/**
 * Passes the puck toward the nearest entity in `others`.
 * No-ops if the shooter does not currently possess the puck.
 * Falls back to shooting if no targets exist.
 * @param {Object} shooter - entity initiating the pass with {x, z, fx, fz}
 * @param {Object} puck - puck object
 * @param {Array} others - pass targets (player + linemates, minus the shooter)
 * Mutates: puck.holder, puck.releaseCooldown, puck.vx, puck.vz
 */
export function pass(shooter, puck, others) {
  if (puck.holder !== shooter) return; // must have possession

  if (others.length === 0) {
    shoot(shooter, puck);
    return;
  }

  // Find nearest pass target to the shooter
  let nearest = null;
  let minDist = Infinity;

  for (const target of others) {
    const dx = target.x - shooter.x;
    const dz = target.z - shooter.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < minDist) {
      minDist = dist;
      nearest = target;
    }
  }

  if (nearest) {
    const dx = nearest.x - puck.x;
    const dz = nearest.z - puck.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0) {
      puck.holder = null;
      puck.releaseCooldown = 0.1; // short cooldown — receiver should pick up fast
      const speed = 11;
      puck.vx = (dx / dist) * speed;
      puck.vz = (dz / dist) * speed;
    }
  }
}
