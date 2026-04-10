// main.js - Game initialization and main loop
// COMP 4300 - Dungeon Hockey

import * as THREE from 'three';
import { initScene, render, levelGroup } from './src/scene.js';
import { buildLevel } from './src/level.js';
import { player, initPlayer, updatePlayer } from './src/player.js';
import { puck, initPuck, updatePuck, shoot, pass } from './src/puck.js';
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

// Invincibility timer for whoever holds the puck — prevents multi-hits per second
let holderInvTimer = 0;

// Which linemate the user is currently driving with WASD.
// Set when a linemate picks up the puck; persists after shooting so the
// user stays in control of the same linemate until another entity picks up.
let controlledLinemate = null;


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

  // Start game on first keypress
  if (!gameStarted) {
    gameStarted = true;
    initAudio();
    startAmbient();
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.classList.add('hidden');
  }

  // Restart after game over — any key
  if (isGameOver) {
    isGameOver = false;
    health = 100;
    score = 0;
    room = 1;
    const gameOverScreen = document.getElementById('game-over-screen');
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    buildNewLevel();
    return;
  }

  if (!gameActive) return;

  // Shoot — Space
  if (e.code === 'Space') {
    e.preventDefault();
    const holder = puck.holder;
    if (holder) {
      shoot(holder, puck);
      // If the player shot, assign control to the linemate nearest the puck so
      // the user always has a linemate to drive after releasing possession.
      if (holder === player && linemates.length > 0) {
        controlledLinemate = linemates.reduce((best, lm) => {
          const dBest = Math.hypot(best.x - puck.x, best.z - puck.z);
          const dLm   = Math.hypot(lm.x  - puck.x, lm.z  - puck.z);
          return dLm < dBest ? lm : best;
        });
      }
    }
  }

  // Pass — E
  if (key === 'e') {
    const holder = puck.holder;
    if (holder) {
      const others = [player, ...linemates].filter(e => e !== holder);
      // If the player is passing, pre-assign control to the intended receiver
      // (nearest entity in others) so WASD follows the pass immediately.
      if (holder === player && linemates.length > 0) {
        const linematePeers = others.filter(e => linemates.includes(e));
        if (linematePeers.length > 0) {
          controlledLinemate = linematePeers.reduce((best, lm) => {
            const dBest = Math.hypot(best.x - puck.x, best.z - puck.z);
            const dLm   = Math.hypot(lm.x  - puck.x, lm.z  - puck.z);
            return dLm < dBest ? lm : best;
          });
        }
      }
      pass(holder, puck, others);
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
  controlledLinemate = null;

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
    // ── Pickup arbitration ─────────────────────────────────────────────────
    // The entity closest to the free puck auto-picks it up.
    // Whoever picks up updates controlledLinemate so WASD follows possession.
    if (puck.holder === null && puck.releaseCooldown <= 0) {
      const candidate = findControlled();
      const dist = Math.hypot(candidate.x - puck.x, candidate.z - puck.z);
      if (dist < candidate.radius + puck.radius + 0.15) {
        puck.holder = candidate;
        if (linemates.includes(candidate)) {
          // A linemate picked up — switch control to them
          controlledLinemate = candidate;
        }
        // Player picking up does NOT clear controlledLinemate:
        // the user stays assigned to the same linemate until another linemate grabs it
      }
    }

    // ── Highlight rings ────────────────────────────────────────────────────
    // Player ring: lit when player holds puck.
    // Linemate ring: lit on the linemate the user is currently controlling
    // (persists after shooting so the user always sees "their" linemate).
    if (player.highlightRing) {
      player.highlightRing.visible = (puck.holder === player);
    }
    for (const lm of linemates) {
      lm.setHighlight(lm === controlledLinemate && puck.holder !== player);
    }

    // ── Player seek routing ────────────────────────────────────────────────
    // Player is WASD-driven only when it holds the puck.
    // Otherwise it autonomously seeks the puck (or trails behind a carrying linemate).
    let playerSeekTarget = null;
    if (puck.holder !== player) {
      if (puck.holder && linemates.includes(puck.holder)) {
        // A linemate has the puck — player trails behind the carrier
        const carrier = puck.holder;
        const TRAIL_DIST = 2.5;
        playerSeekTarget = {
          x: carrier.x - carrier.fx * TRAIL_DIST,
          z: carrier.z - carrier.fz * TRAIL_DIST
        };
      } else {
        // Puck is free — seek the puck
        playerSeekTarget = { x: puck.x, z: puck.z };
      }
    }

    // Update player
    updatePlayer(dt, keys, playerSeekTarget, levelGroup);

    // Update puck
    updatePuck(dt, player, linemates, onGoal, goalPos, levelGroup);

    // Update defenders
    for (const defender of defenders) {
      defender.update(dt, defenders);
    }

    // ── Defender contact: puck holder takes damage ────────────────────────
    if (holderInvTimer > 0) holderInvTimer -= dt;

    const holder = puck.holder;
    if (holder && holderInvTimer <= 0) {
      for (const defender of defenders) {
        const dx = holder.x - defender.x;
        const dz = holder.z - defender.z;
        if (Math.hypot(dx, dz) < holder.radius + defender.radius) {
          onDamage();
          holderInvTimer = 2.0;
          if (holder === player) {
            player.inv = 2.0; // drives the player flash effect
          } else {
            // Linemate also loses the puck
            puck.holder = null;
            puck.releaseCooldown = 0.4;
          }
          break; // one hit per frame is enough
        }
      }
    }

    // controlledLinemate gets WASD except when the player holds the puck
    // (player holding puck → player is WASD-driven, linemates go autonomous).
    // After shooting, controlledLinemate keeps WASD so the user can reposition.
    for (const lm of linemates) {
      const getsWASD = lm === controlledLinemate && puck.holder !== player;
      lm.update(dt, { player, linemates, keys: getsWASD ? keys : null, puck });
    }
  }

  render();
}

// Start game
buildNewLevel();
animate();
