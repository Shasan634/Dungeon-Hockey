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
  speed: 5.5,              // ← CONFLICT: HEAD had 5.2, incoming had 5.5 — using 5.5 for now
  fx: 1,                   // facing direction x
  fz: 0,                   // facing direction z
  angle: 0,                // facing angle in radians
  inv: 0,                  // invincibility timer
  mesh: null,
  highlightRing: null,     // yellow ring shown when this player holds the puck (HEAD)
  skateTrails: []          // skate trail effect meshes (incoming)
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

  // Yellow highlight ring — shown when this player holds the puck (HEAD)
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

  // Helmet (incoming)
  const helmetGeometry = new THREE.SphereGeometry(0.25, 12, 12);
  const helmetMaterial = new THREE.MeshStandardMaterial({
    color: 0x00aadd,
    roughness: 0.4,
    metalness: 0.6
  });
  const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
  helmet.position.set(0, 0.5, 0);
  player.mesh.add(helmet);

  // Visor (incoming)
  const visorGeometry = new THREE.PlaneGeometry(0.3, 0.15);
  const visorMaterial = new THREE.MeshStandardMaterial({
    color: 0x0088ff,
    emissive: 0x0044ff,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.6
  });
  const visor = new THREE.Mesh(visorGeometry, visorMaterial);
  visor.position.set(0.15, 0.5, 0);
  visor.rotation.y = Math.PI / 2;
  player.mesh.add(visor);

  // Clear skate trails (incoming)
  player.skateTrails = [];

  levelGroup.add(player.mesh);
}

// Skate trail cooldown timer and shared geometry/material (incoming)
let trailCooldown = 0;
const sharedTrailGeometry = new THREE.PlaneGeometry(0.4, 0.2);
const sharedTrailMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ddff,
  transparent: true,
  opacity: 0.6,
  side: THREE.DoubleSide
});

/**
 * Updates player position, handles input or autonomous seeking, collision, and damage.
 * @param {number} dt - delta time in seconds
 * @param {Object} keys - object tracking pressed keys {w, a, s, d}
 * @param {Array} defenders - array of defender entities
 * @param {Function} onDamage - callback when player takes damage
 * @param {{x: number, z: number}|null} seekTarget - when non-null, player auto-moves
 *   toward this position instead of reading keys (same behaviour as linemate seeking)
 * @param {THREE.Group|null} levelGroup - group to add skate trails to (incoming)
 * Mutates: player object
 */
export function updatePlayer(dt, keys, seekTarget = null, levelGroup = null) {
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

  // ── Mesh ─────────────────────────────────────────────────────────────────
  if (player.mesh) {
    player.mesh.position.set(player.x, 0.26, player.z);
    player.mesh.rotation.y = player.angle;
  }

  // ── Skate trails (incoming) ───────────────────────────────────────────────
  const speed = Math.sqrt(player.vx * player.vx + player.vz * player.vz);
  trailCooldown -= dt;

  if (speed > 2.0 && trailCooldown <= 0 && levelGroup && player.skateTrails.length < 10) {
    trailCooldown = 0.2;
    const trailMaterial = sharedTrailMaterial.clone();
    const trail = new THREE.Mesh(sharedTrailGeometry, trailMaterial);
    trail.rotation.x = -Math.PI / 2;
    trail.position.set(player.x, 0.01, player.z);
    levelGroup.add(trail);
    player.skateTrails.push({ mesh: trail, life: 0.25 });
  }

  for (let i = player.skateTrails.length - 1; i >= 0; i--) {
    const trail = player.skateTrails[i];
    trail.life -= dt;
    if (trail.life <= 0) {
      if (levelGroup && trail.mesh.parent) levelGroup.remove(trail.mesh);
      player.skateTrails.splice(i, 1);
    } else {
      trail.mesh.material.opacity = (trail.life / 0.25) * 0.6;
    }
  }
}
