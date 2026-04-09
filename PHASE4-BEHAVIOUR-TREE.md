# Phase 4: Behaviour Tree (Decision Making)

## Implementation Complete ✅

Behaviour tree AI with priority-based decision making has been implemented for Defender entities.

---

## What Was Implemented

### Defender Class Enhancements ([src/entities.js](src/entities.js:1))

**Constructor Changes:**
- Now accepts `(x, z, levelGroup, player, puck, goalPos)`
- Live references to player, puck, and goalPos for decision making
- Creates visual mesh with state-based color changes
- Initializes AI state variables

**Visual Components:**
- Red cylinder body (0.35 radius, 0.52 height)
- Sphere "eye" on top that changes color by state
- Dim red point light for atmosphere
- Material colors update in real-time based on behavior state

**Behaviour Tree (Priority Selector):**
1. **BLOCK** (Priority 1) - Guards goal when player is nearby
2. **CHASE** (Priority 2) - Pursues puck when in range
3. **PATROL** (Priority 3) - Wanders randomly (default)

**Movement System:**
- JPS pathfinding with cooldown-based replanning
- State-specific speed multipliers
- Smooth waypoint following with arrival detection
- Wall collision resolution

---

## Three Defender States

### 🔴 PATROL (Default State)
**Visual:**
- Body: Red (`0xdd2222`)
- Eye: Bright red (`0xff4444`)
- Emissive: Dark red glow

**When Active:**
- Player is far from goal (> 5.5 units)
- Puck is far from defender (> 8.0 units)
- Default behavior when no threats detected

**Behavior:**
- Wanders to random floor tiles
- Speed multiplier: **1.0x** (normal)
- Finds new patrol point when path is empty

---

### 🟠 CHASE (Medium Priority)
**Visual:**
- Body: Orange-red (`0xff4400`)
- Eye: Bright orange (`0xff6600`)
- Emissive: Dark orange glow

**When Active:**
- Puck is within **8.0 units** of defender
- Player is NOT near goal (BLOCK takes priority)

**Behavior:**
- Paths directly to puck position
- Repath cooldown: **0.3 seconds**
- Speed multiplier: **1.15x** (faster than patrol)

---

### 💜 BLOCK (Highest Priority)
**Visual:**
- Body: Magenta (`0xdd00aa`)
- Eye: Bright pink (`0xff00cc`)
- Emissive: Purple glow

**When Active:**
- Player is within **5.5 units** of goal
- Overrides all other states (even CHASE)

**Behavior:**
- Paths to goal position to intercept player
- Repath cooldown: **0.4 seconds**
- Speed multiplier: **1.4x** (fastest)
- **Why highest priority**: Preventing goals is more critical than chasing the puck

---

## How to Test

### ✅ Defenders Are Now Auto-Spawned!

Defenders are automatically spawned in [main.js](main.js:78-90) with **progressive difficulty**:

**Difficulty Scaling:**
- Room 1: 1 defender
- Room 3: 2 defenders
- Room 5: 3 defenders
- Room 7+: 4 defenders (capped)

**Formula:** `numDefenders = Math.floor(room / 2) + 1`

### Quick Test (Just Run the Game!)

**Step 1:** Start the dev server
```bash
npm run dev
```

**Step 2:** Open http://localhost:5175

**Step 3:** Play the game!

You should immediately see:
- **1 red defender** wandering the dungeon (PATROL state)
- Console showing `[Defender] Patrol point selected`
- Console showing `[JPS] Path computed: X waypoints`

### Implementation in main.js

Here's what was added to `buildNewLevel()` after spawning player and puck:
```javascript
// Clear old defenders
defenders.forEach(d => levelGroup.remove(d.mesh));
defenders.length = 0;

// Spawn 2 defenders in random rooms
const rooms = generateDungeon(); // Get room data
for (let i = 0; i < 2; i++) {
  const room = rooms[Math.floor(Math.random() * rooms.length)];
  const spawnPos = tileToWorld(room.cy, room.cx);
  const defender = new Defender(
    spawnPos.x,
    spawnPos.z,
    levelGroup,
    player,
    puck,
    goalPos
  );
  defenders.push(defender);
}
```

In `animate()`, the defender update loop already exists:
```javascript
for (const defender of defenders) {
  defender.update(dt, defenders);
}
```

---

## Testing BLOCK Priority

**Scenario:** Both BLOCK and CHASE conditions are true

**Setup:**
1. Spawn defender near puck (< 8.0 units) - triggers CHASE
2. Move player near goal (< 5.5 units from goal) - triggers BLOCK

**Expected Result:**
- Defender turns **magenta** (BLOCK state)
- Defender paths to **goal position**, NOT puck
- Console shows: `[JPS] Path computed: X waypoints to goal`

**How to verify:**
```javascript
// In browser console, check defender state
testDefender.state  // Should be "BLOCK"
testDefender.mat.color.getHex()  // Should be 0xdd00aa (magenta)
```

**Why BLOCK wins:** Priority 1 (BLOCK) is checked first in the behaviour tree. If its condition is true, CHASE is never evaluated.

---

## Tuning Defender Aggressiveness

### Too Aggressive? (Defenders are overwhelming)

**Reduce detection ranges:**
```javascript
// In tick() method
if (distToGoal < 4.0) { // Was 5.5 - shorter BLOCK range
if (distToPuck < 6.0) { // Was 8.0 - shorter CHASE range
```

**Reduce speed multipliers:**
```javascript
case 'BLOCK': return 1.2;  // Was 1.4
case 'CHASE': return 1.05; // Was 1.15
```

**Increase repath cooldowns:**
```javascript
this.pathCooldown = 0.6;  // Was 0.4 for BLOCK
this.pathCooldown = 0.5;  // Was 0.3 for CHASE
```

### Too Passive? (Defenders are too easy)

**Increase detection ranges:**
```javascript
if (distToGoal < 7.0) {  // Was 5.5 - longer BLOCK range
if (distToPuck < 10.0) { // Was 8.0 - longer CHASE range
```

**Increase speed multipliers:**
```javascript
case 'BLOCK': return 1.6;  // Was 1.4
case 'CHASE': return 1.3;  // Was 1.15
```

**Decrease repath cooldowns:**
```javascript
this.pathCooldown = 0.2;  // Was 0.4 for BLOCK - more reactive
this.pathCooldown = 0.15; // Was 0.3 for CHASE
```

**Increase base speed:**
```javascript
this.speed = 3.5;  // Was 3.0 in constructor
```

---

## Behaviour Tree Structure

```
tick() - Evaluated every frame
│
├─ Priority 1: BLOCK
│  ├─ Condition: player near goal (< 5.5 units)
│  ├─ On Enter: Clear path, reset cooldown
│  ├─ Action: Path to goalPos every 0.4s
│  └─ Speed: 1.4x
│
├─ Priority 2: CHASE
│  ├─ Condition: puck nearby (< 8.0 units) AND not BLOCK
│  ├─ On Enter: Clear path, reset cooldown
│  ├─ Action: Path to puck every 0.3s
│  └─ Speed: 1.15x
│
└─ Priority 3: PATROL
   ├─ Condition: Always (fallback)
   ├─ On Enter: Find patrol point
   ├─ Action: Find new point when path empty
   └─ Speed: 1.0x
```

**Why Priority Selector?**
- Simple to understand and debug
- Clear priority hierarchy
- Guarantees exactly one active behavior
- Easy to add new priorities (e.g., "Intercept" between CHASE and PATROL)

---

## Update Loop Order

The `update(dt, allDefenders)` method follows this strict order:

1. **Decrement path cooldown** - Allows time-based replanning
2. **tick()** - Behaviour tree determines state and manages path
3. **Path following** - Computes velocity from waypoints
4. **Collision avoidance** - TODO: Phase 5 implementation
5. **Update position** - Apply velocity
6. **Wall collision** - Resolve world boundaries
7. **Update mesh** - Sync visual position/rotation
8. **Update colors** - State-based material changes

This order ensures:
- State is determined before movement
- Movement is computed before physics
- Physics resolves before rendering

---

## Console Output to Expect

When defenders are active, you'll see:

**Initial spawn:**
```
[Defender] Patrol point selected: (9,12)
[JPS] Path computed: 8 waypoints from (5,7) to (9,12)
```

**State transitions:**
```
[JPS] Path computed: 12 waypoints from (9,12) to (14,8)  // Puck chase
[JPS] Path computed: 15 waypoints from (10,11) to (15,3) // Goal block
```

**Continuous replanning:**
```
[JPS] Path computed: 11 waypoints from (10,9) to (15,3)  // 0.4s later
[JPS] Path computed: 9 waypoints from (11,8) to (15,3)   // 0.4s later
```

---

## Code Quality Checklist ✅

- [x] JSDoc comments on all public methods
- [x] Behaviour tree structure documented above `tick()`
- [x] Priority rationale explained (why BLOCK > CHASE)
- [x] State-specific conditions commented
- [x] Helper methods for distance, speed, colors
- [x] Update loop order documented
- [x] Material color changes per state
- [x] Mesh creation with eye indicator

---

## Next Steps - Phase 5

Phase 4 provides intelligent decision-making. Phase 5 will add:

**Collision Avoidance Steering:**
- Defenders avoid bumping into each other
- Smooth flow around obstacles
- Separation force between defenders
- TODO placeholder is already in `update()` at line 100

**File to modify:** [src/entities.js](src/entities.js:100)

The behaviour tree will continue to set high-level goals (CHASE/BLOCK/PATROL), and collision avoidance will adjust the velocity to avoid collisions while pursuing those goals.

---

## Visual Testing Checklist

Before moving to Phase 5, verify:

- [ ] Defenders spawn with red body and red eye (PATROL)
- [ ] Moving puck near defender turns it orange (CHASE)
- [ ] Moving player near goal turns defenders magenta (BLOCK)
- [ ] Defenders navigate around walls (JPS paths work)
- [ ] Console shows state transitions and path lengths
- [ ] Defenders move faster in BLOCK than CHASE than PATROL
- [ ] BLOCK overrides CHASE when both conditions are true
- [ ] Eye color matches body color state

**All checks passed?** → Ready for Phase 5! 🏒
