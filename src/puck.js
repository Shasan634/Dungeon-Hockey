// puck.js - Puck physics, shooting, and passing

import * as THREE from 'three';
import { resolveWalls } from './tilemap.js';
import { playWallHit, playShoot, playPass } from './audio.js';

// Shared geometry and material for puck trails (performance optimization)
const sharedPuckTrailGeometry = new THREE.SphereGeometry(0.15, 6, 6);
const sharedPuckTrailMaterial = new THREE.MeshBasicMaterial({
  color: 0xff6600,
  transparent: true,
  opacity: 0.7
});

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
  releaseCooldown: 0,    // seconds after shoot/pass before shooter can re-grab
  trails: []             // Array of {mesh, life} for trail effect
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

  // Clear old trails
  puck.trails = [];

  levelGroup.add(puck.mesh);
}

/**
 * Updates puck physics, handles collisions with player, linemates, walls, and goal
 * @param {number} dt - delta time in seconds
 * @param {Object} player - player object with {x, z, vx, vz, radius}
 * @param {Array} linemates - array of linemate entities
 * @param {Function} onGoal - callback when puck reaches goal
 * @param {{x: number, z: number}} goalPos - goal position in world coordinates
 * @param {THREE.Group} levelGroup - group to add trail meshes to
 * Mutates: puck object
 */
export function updatePuck(dt, player, linemates, onGoal, goalPos, levelGroup) {
  if (puck.releaseCooldown > 0) puck.releaseCooldown -= dt;

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

  puck.x += puck.vx * dt;
  puck.z += puck.vz * dt;

  puck.vx *= puck.friction;
  puck.vz *= puck.friction;

  if (Math.abs(puck.vx) < 0.01) puck.vx = 0;
  if (Math.abs(puck.vz) < 0.01) puck.vz = 0;

  const speedBefore = Math.sqrt(puck.vx * puck.vx + puck.vz * puck.vz);
  resolveWalls(puck, true);
  const speedAfter = Math.sqrt(puck.vx * puck.vx + puck.vz * puck.vz);

  if (speedBefore > 2.0 && speedAfter < speedBefore * 0.8) {
    playWallHit(speedBefore);
  }

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

  const goalDist = Math.hypot(puck.x - goalPos.x, puck.z - goalPos.z);
  if (goalDist < 2.2) onGoal();

  if (puck.mesh) {
    puck.mesh.position.set(puck.x, 0.1, puck.z);
  }

  const speed = Math.sqrt(puck.vx * puck.vx + puck.vz * puck.vz);

  if (speed > 4.0 && levelGroup && puck.trails.length < 3) {
    const trailMaterial = sharedPuckTrailMaterial.clone();
    const trail = new THREE.Mesh(sharedPuckTrailGeometry, trailMaterial);
    trail.position.set(puck.x, 0.1, puck.z);
    levelGroup.add(trail);
    puck.trails.push({ mesh: trail, life: 0.15 });
  }

  for (let i = puck.trails.length - 1; i >= 0; i--) {
    const trail = puck.trails[i];
    trail.life -= dt;

    if (trail.life <= 0) {
      if (levelGroup && trail.mesh.parent) {
        levelGroup.remove(trail.mesh);
      }
      puck.trails.splice(i, 1);
    } else {
      const fadeAmount = trail.life / 0.15;
      trail.mesh.material.opacity = fadeAmount * 0.7;
      const scale = 0.5 + fadeAmount * 0.5;
      trail.mesh.scale.set(scale, scale, scale);
    }
  }
}

/**
 * Shoots the puck in the direction the shooter is facing
 * @param {Object} shooter - any entity with {fx, fz}
 * @param {Object} puck - puck object
 * Mutates: puck.holder, puck.releaseCooldown, puck.vx, puck.vz
 */
export function shoot(shooter, puck) {
  if (puck.holder !== shooter) return;
  puck.holder = null;
  puck.releaseCooldown = 0.35;
  const speed = 13;
  puck.vx = shooter.fx * speed;
  puck.vz = shooter.fz * speed;
  playShoot();
}

/**
 * Passes the puck toward the nearest entity
 * @param {Object} shooter - entity initiating the pass with {x, z, fx, fz}
 * @param {Object} puck - puck object
 * @param {Array} others - pass targets
 * Mutates: puck.holder, puck.releaseCooldown, puck.vx, puck.vz
 */
export function pass(shooter, puck, others) {
  if (puck.holder !== shooter) return;

  if (others.length === 0) {
    shoot(shooter, puck);
    return;
  }

  playPass();

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
      puck.releaseCooldown = 0.1;
      const speed = 11;
      puck.vx = (dx / dist) * speed;
      puck.vz = (dz / dist) * speed;
    }
  }
}
