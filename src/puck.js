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
  mesh: null
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

  // Player collision - transfer momentum
  const dx = puck.x - player.x;
  const dz = puck.z - player.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < puck.radius + player.radius && dist > 0) {
    // Push puck away from player
    const nx = dx / dist;
    const nz = dz / dist;

    // Separate puck from player
    const overlap = (puck.radius + player.radius) - dist;
    puck.x += nx * overlap;
    puck.z += nz * overlap;

    // Transfer player velocity to puck (amplified)
    puck.vx = player.vx * 1.5;
    puck.vz = player.vz * 1.5;
  }

  // Linemate collision - deflect puck
  for (const linemate of linemates) {
    const ldx = puck.x - linemate.x;
    const ldz = puck.z - linemate.z;
    const ldist = Math.sqrt(ldx * ldx + ldz * ldz);
    const lradius = linemate.radius || 0.4;

    if (ldist < puck.radius + lradius && ldist > 0) {
      // Deflect puck
      const lnx = ldx / ldist;
      const lnz = ldz / ldist;

      const overlap = (puck.radius + lradius) - ldist;
      puck.x += lnx * overlap;
      puck.z += lnz * overlap;

      // Bounce off linemate
      const dot = puck.vx * lnx + puck.vz * lnz;
      puck.vx -= 2 * dot * lnx;
      puck.vz -= 2 * dot * lnz;
      puck.vx *= 0.8;
      puck.vz *= 0.8;
    }
  }

  // Check goal - using TILE units (1.1 tiles = 2.2 world units)
  const goalDist = Math.sqrt(
    (puck.x - goalPos.x) ** 2 + (puck.z - goalPos.z) ** 2
  );

  if (goalDist < 2.2) {
    onGoal();
  }

  // Update mesh position
  if (puck.mesh) {
    puck.mesh.position.set(puck.x, 0.1, puck.z);
  }
}

/**
 * Shoots the puck in the direction the player is facing
 * @param {Object} player - player object with {fx, fz}
 * @param {Object} puck - puck object
 * Mutates: puck.vx, puck.vz
 */
export function shoot(player, puck) {
  const speed = 13;
  puck.vx = player.fx * speed;
  puck.vz = player.fz * speed;
}

/**
 * Passes the puck toward the nearest linemate
 * @param {Object} player - player object with {x, z}
 * @param {Object} puck - puck object
 * @param {Array} linemates - array of linemate entities with {x, z}
 * Mutates: puck.vx, puck.vz
 */
export function pass(player, puck, linemates) {
  if (linemates.length === 0) {
    // No linemates - shoot forward instead
    shoot(player, puck);
    return;
  }

  // Find nearest linemate
  let nearest = null;
  let minDist = Infinity;

  for (const linemate of linemates) {
    const dx = linemate.x - player.x;
    const dz = linemate.z - player.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < minDist) {
      minDist = dist;
      nearest = linemate;
    }
  }

  if (nearest) {
    // Pass toward nearest linemate
    const dx = nearest.x - puck.x;
    const dz = nearest.z - puck.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0) {
      const speed = 11;
      puck.vx = (dx / dist) * speed;
      puck.vz = (dz / dist) * speed;
    }
  }
}
