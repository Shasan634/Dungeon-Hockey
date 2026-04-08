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
  speed: 5.5,
  fx: 1,    // facing direction x
  fz: 0,    // facing direction z
  angle: 0, // facing angle in radians
  inv: 0,   // invincibility timer
  mesh: null
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

  // Create player body (cylinder)
  const geometry = new THREE.CylinderGeometry(player.radius, player.radius, 0.6, 16);
  const material = new THREE.MeshStandardMaterial({
    color: 0x00ddff,
    emissive: 0x0055bb,
    emissiveIntensity: 0.5
  });
  player.mesh = new THREE.Mesh(geometry, material);
  player.mesh.position.set(player.x, 0.3, player.z);

  // Add hockey stick indicator
  const stickGeometry = new THREE.BoxGeometry(0.15, 0.3, 0.6);
  const stickMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x0088ff,
    emissiveIntensity: 0.8
  });
  const stick = new THREE.Mesh(stickGeometry, stickMaterial);
  stick.position.set(0.5, 0, 0);
  player.mesh.add(stick);

  // Add point light to player
  const light = new THREE.PointLight(0x00ddff, 1.5, 8);
  light.position.set(0, 0.5, 0);
  player.mesh.add(light);

  levelGroup.add(player.mesh);
}

/**
 * Updates player position, handles input, collision, and damage
 * @param {number} dt - delta time in seconds
 * @param {Object} keys - object tracking pressed keys {w, a, s, d}
 * @param {Object} puck - puck object with {x, z, radius}
 * @param {Array} defenders - array of defender entities
 * @param {Function} onDamage - callback when player takes damage
 * Mutates: player object
 */
export function updatePlayer(dt, keys, puck, defenders, onDamage) {
  // Update invincibility timer
  if (player.inv > 0) {
    player.inv -= dt;
    // Flash effect when invincible
    if (player.mesh) {
      player.mesh.visible = Math.floor(player.inv * 10) % 2 === 0;
    }
  } else {
    if (player.mesh) player.mesh.visible = true;
  }

  // Read input and update velocity
  let inputX = 0;
  let inputZ = 0;

  if (keys.w) inputZ -= 1;
  if (keys.s) inputZ += 1;
  if (keys.a) inputX -= 1;
  if (keys.d) inputX += 1;

  // Normalize diagonal movement
  const inputMag = Math.sqrt(inputX * inputX + inputZ * inputZ);
  if (inputMag > 0) {
    inputX /= inputMag;
    inputZ /= inputMag;
  }

  player.vx = inputX * player.speed;
  player.vz = inputZ * player.speed;

  // Update facing direction (only when moving)
  if (inputMag > 0) {
    player.fx = inputX;
    player.fz = inputZ;
    player.angle = Math.atan2(inputZ, inputX);
  }

  // Update position
  player.x += player.vx * dt;
  player.z += player.vz * dt;

  // Wall collision
  resolveWalls(player, false);

  // Check collision with defenders
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

  // Update mesh position and rotation
  if (player.mesh) {
    player.mesh.position.set(player.x, 0.3, player.z);
    player.mesh.rotation.y = player.angle;
  }
}
