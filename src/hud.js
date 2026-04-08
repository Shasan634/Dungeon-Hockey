// hud.js - HUD updates and flash messages
// COMP 4300 - Dungeon Hockey

/**
 * Updates the HUD display with current game state
 * @param {number} score - current score
 * @param {number} health - current health (0-100)
 * @param {number} room - current room number
 * Mutates: DOM elements #score, #health, #room
 */
export function updateHUD(score, health, room) {
  const scoreEl = document.getElementById('score');
  const healthEl = document.getElementById('health');
  const roomEl = document.getElementById('room');

  if (scoreEl) scoreEl.textContent = score;
  if (healthEl) healthEl.textContent = health;
  if (roomEl) roomEl.textContent = room;
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
