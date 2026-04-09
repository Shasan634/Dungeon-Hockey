// main.js - Game initialization and main loop
// COMP 4300 - Dungeon Hockey

import * as THREE from 'three';
import { initScene, render, levelGroup } from './src/scene.js';
import { buildLevel } from './src/level.js';
import { player, initPlayer, updatePlayer } from './src/player.js';
import { puck, initPuck, updatePuck } from './src/puck.js';
import { Defender, Linemate } from './src/entities.js';
import { updateHUD, flash, hitFlash } from './src/hud.js';
import { initAudio, resumeAudio, playGoal, playHit, startAmbient } from './src/audio.js';

// Game state
let gameActive = false;
let gameStarted = false;
let isGameOver = false;
let score = 0;
let health = 100;
let room = 1;
let goalPos = { x: 0, z: 0 };
let torchFlames = [];
let goalGlow = null;

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

  // Handle game over screen restart
  if (isGameOver) {
    isGameOver = false;
    gameStarted = true;
    document.getElementById('game-over-screen').classList.add('hidden');

    // Reset game
    score = 0;
    health = 100;
    room = 1;
    buildNewLevel();
    return;
  }

  // Handle start screen
  if (!gameStarted) {
    gameStarted = true;
    document.getElementById('start-screen').classList.add('hidden');

    // Initialize audio context after user gesture (browser autoplay policy)
    initAudio();
    startAmbient();

    buildNewLevel();
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

  // Clean up old skate trails
  if (player.skateTrails) {
    for (const trail of player.skateTrails) {
      if (trail.mesh && trail.mesh.parent) {
        levelGroup.remove(trail.mesh);
      }
    }
    player.skateTrails = [];
  }

  // Clean up old puck trails
  if (puck.trails) {
    for (const trail of puck.trails) {
      if (trail.mesh && trail.mesh.parent) {
        levelGroup.remove(trail.mesh);
      }
    }
    puck.trails = [];
  }

  // Build level geometry and get spawn/goal positions
  const levelData = buildLevel(scene, levelGroup);
  goalPos = levelData.goalPos;
  torchFlames = levelData.torchFlames;
  goalGlow = levelData.goalGlow;

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
  hitFlash(); // Red screen flash
  playHit(); // Audio feedback

  if (health <= 0) {
    gameActive = false;
    isGameOver = true;
    flash('GAME OVER', false);

    // Show game over screen
    const gameOverScreen = document.getElementById('game-over-screen');
    const finalScoreEl = document.getElementById('final-score');
    const finalRoomEl = document.getElementById('final-room');

    if (finalScoreEl) finalScoreEl.textContent = score;
    if (finalRoomEl) finalRoomEl.textContent = room - 1;
    if (gameOverScreen) gameOverScreen.classList.remove('hidden');
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
  playGoal(); // Audio feedback
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

  const t = clock.getElapsedTime();

  // Resume audio if suspended (tab backgrounded)
  resumeAudio();

  // Animate torch flames (always, even when game inactive)
  for (let i = 0; i < torchFlames.length; i++) {
    const torch = torchFlames[i];
    const flicker = 2.0 + Math.sin(t * 7.3 + torch.offset) * 0.6;
    torch.light.intensity = flicker;

    const yOffset = Math.sin(t * 5.0 + torch.offset) * 0.08;
    torch.mesh.position.y = torch.baseY + yOffset;

    const scaleFlicker = 1.0 + Math.sin(t * 6.5 + torch.offset) * 0.12;
    torch.mesh.scale.set(scaleFlicker, scaleFlicker, scaleFlicker);
  }

  // Animate goal glow (always, even when game inactive)
  if (goalGlow) {
    const pulse = 3.0 + Math.sin(t * 2.5) * 0.8;
    goalGlow.intensity = pulse;
  }

  if (gameActive) {
    // Update player
    updatePlayer(dt, keys, puck, defenders, onDamage, levelGroup);

    // Update puck
    updatePuck(dt, player, linemates, onGoal, goalPos, levelGroup);

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
