// main.js - Game initialization and main loop
// COMP 4300 - Dungeon Hockey

import * as THREE from 'three';
import { initScene, render, levelGroup } from './src/scene.js';
import { buildLevel } from './src/level.js';
import { player, initPlayer, updatePlayer } from './src/player.js';
import { puck, initPuck, updatePuck, shoot, pass } from './src/puck.js';
import { Defender, Linemate } from './src/entities.js';
import { updateHUD, flash } from './src/hud.js';

// Game state
let gameActive = false;
let score = 0;
let health = 100;
let room = 1;
let goalPos = { x: 0, z: 0 };

// Entities (empty for now - will be filled in Phase 3-6)
const defenders = [];
const linemates = [];

// The entity (player or linemate) currently driven by WASD.
// Updated every frame to whichever is closest to the puck.
let controlled = player;


// Input state
const keys = {
  w: false,
  a: false,
  s: false,
  d: false
};

// Initialize scene
const { scene, camera, renderer } = initScene();

/**
 * Returns whichever entity (player or linemate) is closest to the puck.
 * That entity gets WASD control and is highlighted.
 */
function findControlled() {
  let best = player;
  let minD = Math.hypot(player.x - puck.x, player.z - puck.z);
  for (const lm of linemates) {
    const d = Math.hypot(lm.x - puck.x, lm.z - puck.z);
    if (d < minD) { minD = d; best = lm; }
  }
  return best;
}

// Input handling
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key in keys) keys[key] = true;

  if (!gameActive) return;

  // Shoot — Space. Uses puck.holder directly so it always targets the carrier.
  if (e.code === 'Space') {
    e.preventDefault();
    if (puck.holder) shoot(puck.holder, puck);
  }

  // Pass — E. Sends puck from the current holder to the nearest other entity.
  if (key === 'e') {
    if (puck.holder) {
      const others = [player, ...linemates].filter(t => t !== puck.holder);
      pass(puck.holder, puck, others);
    }
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (key in keys) keys[key] = false;
});

/**
 * Builds a new level, spawns player and puck, resets game state
 * Mutates: gameActive, goalPos, player, puck, defenders, levelGroup
 */
function buildNewLevel() {
  gameActive = false;

  // Build level geometry and get spawn/goal positions
  const levelData = buildLevel(scene, levelGroup);
  goalPos = levelData.goalPos;

  // Spawn player and puck
  initPlayer(levelData.spawnWorld, levelGroup);
  initPuck(levelData.spawnWorld, levelGroup);

  // Clear old linemates
  linemates.forEach(l => {
    if (l.mesh) levelGroup.remove(l.mesh);
  });
  linemates.length = 0;

  // Spawn 2 linemates flanking the player spawn
  linemates.push(new Linemate(levelData.spawnWorld.x + 1.5, levelData.spawnWorld.z, levelGroup));
  linemates.push(new Linemate(levelData.spawnWorld.x - 1.5, levelData.spawnWorld.z, levelGroup));

  // Clear old defenders
  defenders.forEach(d => {
    if (d.mesh) levelGroup.remove(d.mesh);
  });
  defenders.length = 0;

  // Spawn defenders with progressive difficulty
  // Start with 1 defender, add 1 more every 2 rooms
  const numDefenders = Math.floor(room / 2) + 1;
  const maxDefenders = 4; // Cap at 4 to avoid overwhelming difficulty

  for (let i = 0; i < Math.min(numDefenders, maxDefenders); i++) {
    // Random position avoiding edges
    const x = (Math.random() - 0.5) * 35;
    const z = (Math.random() - 0.5) * 25;

    const defender = new Defender(x, z, levelGroup, player, puck, goalPos);
    defenders.push(defender);
  }

  // Update HUD
  updateHUD(score, health, room);

  // Activate game
  gameActive = true;
}

/**
 * Called when player takes damage
 * Mutates: health
 */
function onDamage() {
  health -= 10;
  if (health < 0) health = 0;
  updateHUD(score, health, room);
  flash('HIT!', false);

  if (health <= 0) {
    gameActive = false;
    flash('GAME OVER', false);
    setTimeout(() => {
      // Reset game
      score = 0;
      health = 100;
      room = 1;
      buildNewLevel();
    }, 2000);
  }
}

/**
 * Called when puck reaches goal
 * Mutates: score, room, gameActive
 */
function onGoal() {
  if (!gameActive) return;

  gameActive = false;
  score += 100;
  room += 1;

  flash('GOAL!', true);
  updateHUD(score, health, room);

  // Build next level after delay
  setTimeout(() => {
    buildNewLevel();
  }, 1400);
}

// Game loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  // Cap delta time to prevent physics explosions
  let dt = clock.getDelta();
  if (dt > 0.05) dt = 0.05;

  if (gameActive) {
    // ── Pickup ───────────────────────────────────────────────────────────
    // The entity closest to the puck is the only one that can pick it up.
    // This keeps `controlled` purely for pickup arbitration — it is NOT used
    // to route WASD (that is done by puck.holder below).
    if (puck.holder === null && puck.releaseCooldown <= 0) {
      controlled = findControlled();
      const pickupR = controlled.radius + puck.radius + 0.5;
      if (Math.hypot(controlled.x - puck.x, controlled.z - puck.z) < pickupR) {
        puck.holder = controlled;
      }
    }

    // ── Highlights ───────────────────────────────────────────────────────
    // Yellow ring on whoever holds the puck (player or linemate).
    if (player.highlightRing) player.highlightRing.visible = (puck.holder === player);
    for (const lm of linemates) {
      lm.setHighlight(lm === puck.holder);
    }

    // ── WASD / seek routing for player ───────────────────────────────────
    // • Player holds puck  → WASD
    // • No one holds puck  → player sprints to puck (same as linemates)
    // • Linemate holds puck→ player trails behind the carrier (pass lane)
    let playerSeekTarget = null;
    if (puck.holder !== player) {
      if (!puck.holder) {
        playerSeekTarget = { x: puck.x, z: puck.z };
      } else {
        // Carrier is a linemate; the other linemate takes lead automatically.
        // Player always trails so there is a backward pass lane.
        const carrier = puck.holder;
        playerSeekTarget = {
          x: carrier.x - carrier.fx * 3.0,
          z: carrier.z - carrier.fz * 3.0
        };
      }
    }
    updatePlayer(dt, keys, defenders, onDamage, playerSeekTarget);

    // Update puck
    updatePuck(dt, player, linemates, onGoal, goalPos);

    // Update defenders
    for (const defender of defenders) {
      defender.update(dt, defenders);
    }

    // A linemate only gets WASD when it is the puck holder.
    // All others receive null → _updateAutonomous runs:
    //   • No carrier in linemates → seek the puck
    //   • Another linemate is carrier → take lead or trail position
    for (const lm of linemates) {
      lm.update(dt, { player, linemates, keys: lm === puck.holder ? keys : null, puck });
    }
  }

  render();
}

// Start game
buildNewLevel();
animate();
