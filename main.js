// main.js - Game initialization and main loop
// COMP 4300 - Dungeon Hockey

import * as THREE from 'three';
import { initScene, render, levelGroup } from './src/scene.js';
import { buildLevel } from './src/level.js';
import { player, initPlayer, updatePlayer } from './src/player.js';
import { puck, initPuck, updatePuck } from './src/puck.js';
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

// Input state
const keys = {
  w: false,
  a: false,
  s: false,
  d: false
};

// Initialize scene
const { scene, camera, renderer } = initScene();

// Input handling
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key in keys) keys[key] = true;

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
    // Update player
    updatePlayer(dt, keys, puck, defenders, onDamage);

    // Update puck
    updatePuck(dt, player, linemates, onGoal, goalPos);

    // Update entities
    for (const defender of defenders) {
      defender.update(dt, defenders);
    }

    for (const linemate of linemates) {
      linemate.update(dt, { player, puck, linemates });
    }
  }

  render();
}

// Start game
buildNewLevel();
animate();
