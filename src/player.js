// player.js - Player movement, input handling, and collision
// COMP 4300 - Dungeon Hockey

import * as THREE from 'three';
import { resolveWalls } from './tilemap.js';

export const player = {
  x: 0,
  z: 0,
  vx: 0,
  vz: 0,
  radius: 0.4,
  speed: 5.2,
  fx: 1,         // facing direction x
  fz: 0,         // facing direction z
  angle: 0,      // facing angle in radians
  inv: 0,        // invincibility timer
  mesh: null,
  highlightRing: null  // yellow ring shown when this player holds the puck
};

/**
 * Initializes the player mesh and adds it to the scene
 * @param {{x: number, z: number}} spawnWorld - spawn position in world coordinates
 * @param {THREE.Group} levelGroup - Three.js group to add player mesh to
 * Mutates: player object
 */
export function initPlayer(spawnWorld, levelGroup) {
  player.x = spawnWorld.x;
  player.z = spawnWorld.z;
  player.vx = 0;
  player.vz = 0;
  player.fx = 1;
  player.fz = 0;
  player.angle = 0;
  player.inv = 0;

  // Teal cylinder — identical design to linemates
  const geometry = new THREE.CylinderGeometry(0.35, 0.35, 0.52, 10);
  const material = new THREE.MeshStandardMaterial({
    color: 0x22dd88,
    emissive: 0x116644,
    emissiveIntensity: 0.5
  });
  player.mesh = new THREE.Mesh(geometry, material);
  player.mesh.position.set(player.x, 0.26, player.z);

  // Atmospheric glow — same as linemates
  const light = new THREE.PointLight(0x22dd88, 0.6, 2.5);
  light.position.set(0, 0.4, 0);
  player.mesh.add(light);

  // Yellow highlight ring — shown when this player holds the puck
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffee00,
    emissive: 0xffee00,
    emissiveIntensity: 2.5
  });
  player.highlightRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.07, 8, 28),
    ringMat
  );
  player.highlightRing.rotation.x = Math.PI / 2;
  player.highlightRing.position.y = -0.22;
  player.highlightRing.visible = false;
  player.mesh.add(player.highlightRing);

  levelGroup.add(player.mesh);
}

/**
 * Updates player position, handles input or autonomous seeking, collision, and damage.
 * @param {number} dt - delta time in seconds
 * @param {Object} keys - object tracking pressed keys {w, a, s, d}
 * @param {Array} defenders - array of defender entities
 * @param {Function} onDamage - callback when player takes damage
 * @param {{x: number, z: number}|null} seekTarget - when non-null, player auto-moves
 *   toward this position instead of reading keys (same behaviour as linemate seeking)
 * Mutates: player object
 */
export function updatePlayer(dt, keys, defenders, onDamage, seekTarget = null) {
  // Invincibility timer + flash
  if (player.inv > 0) {
    player.inv -= dt;
    if (player.mesh) player.mesh.visible = Math.floor(player.inv * 10) % 2 === 0;
  } else {
    if (player.mesh) player.mesh.visible = true;
  }

  // ── Direction ────────────────────────────────────────────────────────────
  let inputX = 0, inputZ = 0;

  if (seekTarget) {
    // Autonomous seek — same sprint behaviour as linemates
    const dx = seekTarget.x - player.x;
    const dz = seekTarget.z - player.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.1) { inputX = dx / dist; inputZ = dz / dist; }
  } else {
    // WASD manual control
    if (keys.w) inputZ -= 1;
    if (keys.s) inputZ += 1;
    if (keys.a) inputX -= 1;
    if (keys.d) inputX += 1;
    const mag = Math.hypot(inputX, inputZ);
    if (mag > 0) { inputX /= mag; inputZ /= mag; }
  }

  player.vx = inputX * player.speed;
  player.vz = inputZ * player.speed;

  // Keep facing in sync (used by shoot())
  if (Math.hypot(inputX, inputZ) > 0) {
    player.fx = inputX;
    player.fz = inputZ;
    player.angle = Math.atan2(inputZ, inputX);
  }

  // ── Physics ──────────────────────────────────────────────────────────────
  player.x += player.vx * dt;
  player.z += player.vz * dt;
  resolveWalls(player, false);

  // Defender collision → damage
  for (const defender of defenders) {
    const dx = player.x - defender.x;
    const dz = player.z - defender.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < player.radius + (defender.radius || 0.4)) {
      if (player.inv <= 0) {
        onDamage();
        player.inv = 2.0;
      }
    }
  }

  // ── Mesh ─────────────────────────────────────────────────────────────────
  if (player.mesh) {
    player.mesh.position.set(player.x, 0.26, player.z);
    player.mesh.rotation.y = player.angle;
  }
}
