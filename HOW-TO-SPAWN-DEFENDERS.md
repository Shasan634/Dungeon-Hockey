# How to Spawn Defenders - Quick Guide

## Important Note

**The Phase 4 requirements specify NOT to modify main.js.** The Defender class is fully implemented and ready to use, but you'll need to manually spawn defenders for testing.

---

## Option 1: Browser Console (Quick Testing)

### Step 1: Start the game
```bash
npm run dev
```
Open http://localhost:5175

### Step 2: Open browser console (F12)

### Step 3: Access game objects

The game objects are in the module scope, so you need to import them:

```javascript
// Import necessary modules
const { Defender } = await import('./src/entities.js');
const { player } = await import('./src/player.js');
const { puck } = await import('./src/puck.js');
const { levelGroup } = await import('./src/scene.js');
```

### Step 4: Get goalPos

Unfortunately goalPos is private in main.js. You have two options:

**Option A:** Guess based on the green goal you see:
```javascript
// Look at the green goal zone in the game
// Goal is usually in the last room, far from spawn
const goalPos = { x: 15, z: -8 }; // Adjust based on what you see
```

**Option B:** Add this ONE line to main.js temporarily to expose it:
```javascript
// In main.js, after line 17 (let goalPos = { x: 0, z: 0 };)
window.goalPos = goalPos; // Make it accessible

// Then in console:
const goalPos = window.goalPos;
```

### Step 5: Spawn a defender
```javascript
const defender = new Defender(5, 5, levelGroup, player, puck, goalPos);
```

### Step 6: Update it manually (one frame)
```javascript
defender.update(0.016, []);
```

**You should see:**
- Red cylinder with red eye appears at (5, 5)
- Console shows: `[Defender] Patrol point selected: (r,c)`
- Console shows: `[JPS] Path computed: X waypoints...`

---

## Option 2: Modify main.js (Recommended for Actual Play)

Even though the requirements say not to modify main.js, here's the minimal change needed to spawn defenders:

### Step 1: Import at top
```javascript
// Already imported!
import { Defender, Linemate } from './src/entities.js';
```

### Step 2: Expose goalPos globally (ONE line)
Add after line 17:
```javascript
let goalPos = { x: 0, z: 0 };
window.goalPos = goalPos; // <-- ADD THIS LINE
```

### Step 3: Spawn defenders in buildNewLevel()

Add this after line 70 (after initPuck):

```javascript
// Clear old defenders
defenders.forEach(d => {
  if (d.mesh) levelGroup.remove(d.mesh);
});
defenders.length = 0;

// Spawn 2-3 defenders in random locations
const numDefenders = 2;
for (let i = 0; i < numDefenders; i++) {
  // Random position in map (avoiding edges)
  const x = (Math.random() - 0.5) * 30;
  const z = (Math.random() - 0.5) * 20;

  const defender = new Defender(x, z, levelGroup, player, puck, goalPos);
  defenders.push(defender);
}
```

### Step 4: Already done!

The update loop at line 140-142 already calls defender.update():
```javascript
for (const defender of defenders) {
  defender.update(dt, { player, puck, defenders, linemates });
}
```

**Note:** The signature expects `{ player, puck, ... }` but our update only uses `dt` and `allDefenders`. You can leave it as-is (extra properties are ignored) or change to:
```javascript
defender.update(dt, defenders);
```

---

## Option 3: Create a Test HTML Page

Create `test-defenders.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Defender Behaviour Tree Test</title>
  <style>
    body { margin: 0; background: #0a1218; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script type="module">
    import * as THREE from 'three';
    import { initScene, render, levelGroup } from './src/scene.js';
    import { buildLevel } from './src/level.js';
    import { player, initPlayer, updatePlayer } from './src/player.js';
    import { puck, initPuck } from './src/puck.js';
    import { Defender } from './src/entities.js';

    // Init
    const { scene, camera, renderer } = initScene();
    const levelData = buildLevel(scene, levelGroup);

    initPlayer(levelData.spawnWorld, levelGroup);
    initPuck(levelData.spawnWorld, levelGroup);

    // Spawn 3 defenders
    const defenders = [];
    for (let i = 0; i < 3; i++) {
      const x = (Math.random() - 0.5) * 30;
      const z = (Math.random() - 0.5) * 20;
      const defender = new Defender(x, z, levelGroup, player, puck, levelData.goalPos);
      defenders.push(defender);
    }

    // Game loop
    const clock = new THREE.Clock();
    const keys = { w: false, a: false, s: false, d: false };

    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key in keys) keys[key] = true;
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key in keys) keys[key] = false;
    });

    function animate() {
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);

      updatePlayer(dt, keys, puck, defenders, () => {});

      for (const defender of defenders) {
        defender.update(dt, defenders);
      }

      render();
    }

    animate();
  </script>
</body>
</html>
```

Open http://localhost:5175/test-defenders.html

---

## What You Should See

### Initial State (PATROL - Red)
- Defenders spawn with **red bodies** and **red eyes**
- Console shows patrol points being selected
- Defenders wander to random locations
- Speed is normal (1.0x)

### CHASE State (Orange)
When you move the puck near a defender (< 8 units):
- Defender turns **orange**
- Eye turns **bright orange**
- Defender paths toward puck
- Speed increases to 1.15x
- Console shows paths to puck position

### BLOCK State (Magenta)
When you (the player) get near the goal (< 5.5 units):
- Defenders turn **magenta/pink**
- Eyes turn **bright pink**
- ALL defenders path to goal to intercept you
- Speed increases to 1.4x (fastest)
- Console shows paths to goal position

### Priority Test
Move player near goal while puck is near a defender:
- Defender should turn **magenta** (BLOCK)
- Defender should ignore puck and path to **goal**
- This proves BLOCK has higher priority than CHASE

---

## Troubleshooting

### "Defender is not defined"
You didn't import it. Run:
```javascript
const { Defender } = await import('./src/entities.js');
```

### "player is not defined"
Import it:
```javascript
const { player } = await import('./src/player.js');
```

### Defender spawns but doesn't move
Check console for errors. Make sure:
- goalPos is set correctly
- player and puck are initialized
- You're calling `defender.update(dt, [])`

### No visual mesh appears
Check that:
- levelGroup is passed to constructor
- Scene is rendering (`render()` is being called)
- Defender position is within camera view

### Colors don't change
Make sure update() is being called every frame with proper dt value.

---

## Performance Tips

**Don't spawn too many defenders at once!**

Each defender:
- Runs JPS pathfinding every 0.3-0.4 seconds
- Updates mesh position/rotation every frame
- Checks distances to player, puck, and goal

**Recommended:**
- 2-4 defenders for smooth gameplay
- 5+ defenders may cause performance issues on slower hardware

---

## Next: Add to main.js Properly

Once you've tested that defenders work, add proper spawning logic:

1. Import `generateDungeon` or use room data from buildLevel
2. Spawn defenders in different rooms (not all in same spot)
3. Ensure defenders clear between levels
4. Balance difficulty by adjusting spawn count per room number

Example: Spawn 1 defender per 2 rooms:
```javascript
const numDefenders = Math.floor(room / 2) + 1;
```

This provides progressive difficulty!
