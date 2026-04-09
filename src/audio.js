// audio.js - Web Audio API sound effects for Dungeon Hockey
// COMP 4300 - Phase 8: Audio

// AudioContext must be created after a user gesture due to browser autoplay policy.
// Do NOT create at module load time - initialize via initAudio() after user interaction.
let audioCtx = null;

/**
 * Initialize the AudioContext after user gesture
 * MUST be called after user clicks/presses key (browser autoplay policy)
 * @returns {AudioContext} the created audio context
 */
export function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Resume audio context if suspended (happens when tab is backgrounded)
 * Call this at the top of the game loop
 */
export function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * Play wall hit sound when puck bounces
 * @param {number} speed - puck speed at moment of bounce (Math.hypot(vx, vz))
 */
export function playWallHit(speed) {
  if (!audioCtx || speed <= 2.0) return;

  const now = audioCtx.currentTime;
  const duration = 0.05;

  // Create white noise buffer
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  // Create audio nodes
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800 + speed * 40;
  filter.Q.value = 1.5;

  const gain = audioCtx.createGain();
  gain.gain.value = 0.12 * Math.min(speed / 8, 1.0);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  // Connect and play
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  source.start(now);
  source.stop(now + 0.06);
}

/**
 * Play shoot sound when player shoots puck
 */
export function playShoot() {
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  // Layer 1 - Impact
  const osc1 = audioCtx.createOscillator();
  osc1.type = 'square';
  osc1.frequency.value = 180;

  const gain1 = audioCtx.createGain();
  gain1.gain.value = 0.18;
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc1.connect(gain1);
  gain1.connect(audioCtx.destination);

  osc1.start(now);
  osc1.stop(now + 0.09);

  // Layer 2 - Snap
  const bufferSize = audioCtx.sampleRate * 0.03;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2000;

  const gain2 = audioCtx.createGain();
  gain2.gain.value = 0.1;
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  source.connect(filter);
  filter.connect(gain2);
  gain2.connect(audioCtx.destination);

  source.start(now);
  source.stop(now + 0.05);
}

/**
 * Play pass sound when player passes puck
 */
export function playPass() {
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 220;

  const gain = audioCtx.createGain();
  gain.gain.value = 0.1;
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.07);
}

/**
 * Play goal scored sound - major chord arpeggio
 */
export function playGoal() {
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const notes = [523, 659, 784]; // C5, E5, G5

  notes.forEach((freq, i) => {
    const startTime = now + i * 0.12;

    // Fundamental note
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq;

    const gain1 = audioCtx.createGain();
    gain1.gain.setValueAtTime(0.0, startTime);
    gain1.gain.linearRampToValueAtTime(0.22, startTime + 0.02);
    gain1.gain.setValueAtTime(0.22, startTime + 0.18);
    gain1.gain.linearRampToValueAtTime(0.0, startTime + 0.28);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);

    osc1.start(startTime);
    osc1.stop(startTime + 0.28);

    // Octave above for brightness
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;

    const gain2 = audioCtx.createGain();
    gain2.gain.setValueAtTime(0.0, startTime);
    gain2.gain.linearRampToValueAtTime(0.06, startTime + 0.02);
    gain2.gain.setValueAtTime(0.06, startTime + 0.18);
    gain2.gain.linearRampToValueAtTime(0.0, startTime + 0.28);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);

    osc2.start(startTime);
    osc2.stop(startTime + 0.28);
  });
}

/**
 * Play hit sound when player takes damage
 */
export function playHit() {
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  // Layer 1 - Body
  const osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 80;

  const gain1 = audioCtx.createGain();
  gain1.gain.value = 0.25;
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain1);
  gain1.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.16);

  // Layer 2 - Distortion noise
  const bufferSize = audioCtx.sampleRate * 0.1;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;

  const gain2 = audioCtx.createGain();
  gain2.gain.value = 0.15;
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  source.connect(filter);
  filter.connect(gain2);
  gain2.connect(audioCtx.destination);

  source.start(now);
}

/**
 * Play block sound when defender switches to BLOCK state
 */
export function playBlock() {
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  // White noise whoosh
  const bufferSize = audioCtx.sampleRate * 0.12;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 600;
  filter.Q.value = 0.8;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0, now);
  gain.gain.linearRampToValueAtTime(0.07, now + 0.04);
  gain.gain.linearRampToValueAtTime(0.0, now + 0.12);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  source.start(now);
}

/**
 * Start ambient dungeon drone - continuous background sound
 * Runs indefinitely until stopped
 */
export function startAmbient() {
  if (!audioCtx) return;

  // Two detuned oscillators for beating effect
  const osc1 = audioCtx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = 55; // Low A

  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 55.4; // Slightly detuned

  // Third oscillator for movement
  const osc3 = audioCtx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.value = 110; // Octave above

  const gain3 = audioCtx.createGain();
  gain3.gain.value = 0.012;

  // Master gain for all three (very quiet background)
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.04;

  // LFO for subtle frequency modulation
  const lfo = audioCtx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.15;

  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 4; // +/- 4 Hz modulation

  // Connect LFO to osc1 frequency
  lfo.connect(lfoGain);
  lfoGain.connect(osc1.frequency);

  // Connect audio chain
  osc1.connect(masterGain);
  osc2.connect(masterGain);
  osc3.connect(gain3);
  gain3.connect(masterGain);
  masterGain.connect(audioCtx.destination);

  // Start all oscillators
  osc1.start();
  osc2.start();
  osc3.start();
  lfo.start();
}
