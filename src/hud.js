// hud.js - HUD updates and flash messages
// COMP 4300 - Dungeon Hockey

/**
 * Updates the HUD display with current game state
 * @param {number} score - current score
 * @param {number} health - current health (0-100)
 * @param {number} room - current room number
 * Mutates: DOM elements #score, #health-icons, #room
 */
export function updateHUD(score, health, room) {
  const scoreEl = document.getElementById('score');
  const healthIconsEl = document.getElementById('health-icons');
  const roomEl = document.getElementById('room');

  if (scoreEl) scoreEl.textContent = score;
  if (roomEl) roomEl.textContent = room;

  // Render health as puck icons (each puck = 10 health)
  if (healthIconsEl) {
    const numPucks = Math.ceil(health / 10);
    healthIconsEl.innerHTML = '';

    for (let i = 0; i < numPucks; i++) {
      const puck = document.createElement('div');
      puck.className = 'health-puck';
      healthIconsEl.appendChild(puck);
    }
  }
}

/**
 * Displays a flash message on screen with fade-out animation
 * @param {string} message - message to display
 * @param {boolean} good - true for green (success), false for red (failure)
 * Mutates: DOM element #flash
 */
export function flash(message, good = true) {
  const flashEl = document.getElementById('flash');
  if (!flashEl) return;

  flashEl.textContent = message;
  flashEl.className = good ? 'good' : 'bad';
  flashEl.style.opacity = '1';

  // Fade out after 1.2 seconds
  setTimeout(() => {
    flashEl.style.opacity = '0';
  }, 1200);
}

/**
 * Displays full-screen red overlay flash when player takes damage
 * Mutates: DOM element #overlay
 */
export function hitFlash() {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  overlay.style.background = 'rgba(255, 0, 0, 0.4)';
  setTimeout(() => {
    overlay.style.background = 'rgba(255, 0, 0, 0)';
  }, 150);
}
