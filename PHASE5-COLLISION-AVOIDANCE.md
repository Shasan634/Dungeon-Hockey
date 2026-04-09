# Phase 5: Collision Avoidance (Complex Movement)

## Implementation Complete ✅

Reynolds-style separation steering has been implemented for Defender entities to prevent clustering and stacking.

---

## What Was Implemented

### 1. Defender-to-Defender Separation ([src/entities.js](src/entities.js:273))

**Method:** `_avoidOthers(allDefenders)`

**Algorithm:**
- Reynolds-style separation force
- For each nearby defender, calculate repulsive force
- Force is proportional to penetration depth: `force = (minDist - d) * 2.0`
- Minimum distance includes **0.5 padding** beyond physical radii

**Why the 0.5 padding?**
Prevents the "clumping" effect where defenders visually stack on the same tile. They maintain personal space even before physically overlapping.

**Division by zero protection:**
The `d > 1e-4` guard prevents crashes when two defenders spawn at exactly the same position.

### 2. Defender-Player Physical Push ([src/entities.js](src/entities.js:112-123))

**Behavior:**
- When defender touches player, both are pushed apart
- Defender gives way **0.3 factor** (30% of overlap)
- Player receives remaining 70% of push (handled by resolveWalls in player.js)

**Why 0.3?**
Makes defenders feel physical but not immovable. They yield slightly to player contact, creating more natural interactions.

**Note:** Damage is still handled in `updatePlayer()` - this is purely the physics interaction.

### 3. Update Order (Critical!)

```
1. Update path cooldown
2. Behaviour tree tick (sets state, computes path)
3. Path following (sets desired velocity vx, vz)
4. Collision avoidance (modifies velocity)  ← Phase 5
5. Update position (apply velocity)
6. Wall collision (resolve boundaries)
7. Physical player push (prevent overlap)  ← Phase 5
8. Update mesh (visual sync)
9. Update colors (state feedback)
```

**Why avoidance runs after path following but before position update:**
- Path following sets the **goal velocity** (where defender wants to go)
- Avoidance **modifies** that velocity (while maintaining general direction)
- Position update applies the **final velocity** (goal + avoidance)

This preserves pathfinding intent while adding smooth obstacle avoidance.

---

## How to Verify Avoidance is Working

### Test 1: Corridor Squeeze

**Setup:**
1. Start game (defenders spawn in Room 1)
2. Advance to Room 3 (2 defenders spawn)
3. Move toward goal to trigger BLOCK state (all defenders turn magenta)

**Expected Behavior:**
- Both defenders path to goal through corridors
- **Before Phase 5:** Defenders would stack on top of each other in narrow corridors
- **After Phase 5:** Defenders maintain spacing, one behind the other or side-by-side

**How to observe:**
- Watch defenders navigate through 1-tile wide corridors
- They should "queue up" rather than overlap
- Spacing of ~1.3 units between centers (0.8 combined radii + 0.5 padding)

### Test 2: Goal Convergence

**Setup:**
1. Reach Room 5+ (3-4 defenders active)
2. Approach goal zone (< 5.5 units)
3. All defenders enter BLOCK state and converge on goal

**Expected Behavior:**
- **Before Phase 5:** Defenders would form a tight cluster, overlapping visually
- **After Phase 5:** Defenders form a defensive "wall" with visible gaps between them

**How to observe:**
- Defenders spread around goal position in a loose formation
- No two defenders occupy the same visual space
- You can see individual red eyes on each defender

### Test 3: Chase Swarm

**Setup:**
1. Room 5+ (3-4 defenders)
2. Shoot puck into open area
3. Move puck slowly to trigger CHASE state on multiple defenders

**Expected Behavior:**
- Multiple defenders turn orange and chase puck
- **Before Phase 5:** Defenders would stack on puck position
- **After Phase 5:** Defenders surround puck in a loose circle, maintaining spacing

**How to observe:**
- Defenders approach from different angles
- They form a perimeter around the puck rather than all occupying the same spot

### Test 4: Player Contact

**Setup:**
1. Stand still and let a defender walk into you

**Expected Behavior:**
- **Before Phase 5:** Defender would clip through player or stop abruptly
- **After Phase 5:** Defender pushes player slightly and gives way 30%

**How to observe:**
- Player is nudged back when defender contacts
- Defender doesn't stop completely, slides around player
- Contact feels physical but not like hitting a wall

---

## Before vs After Visual Comparison

### Before Phase 5 (Stacking)

```
Corridor scenario:
┌─────┬─────┬─────┐
│     │     │     │
│     │ DD  │     │  ← Both defenders stacked on same tile
│     │     │     │     Visually looks like 1 defender
└─────┴─────┴─────┘
```

**Problems:**
- Defenders overlap completely
- Can't tell how many defenders are present
- Looks unnatural and unprofessional
- Defenders fight for the same position

### After Phase 5 (Separation)

```
Corridor scenario:
┌─────┬─────┬─────┐
│     │     │     │
│     │  D  │     │  ← Defender 1
│     │     │     │
├─────┼─────┼─────┤
│     │     │     │
│     │  D  │     │  ← Defender 2 (queued behind)
│     │     │     │
└─────┴─────┴─────┘
```

**Improvements:**
- Each defender clearly visible
- Natural queuing behavior in tight spaces
- Professional appearance
- Defenders flow smoothly without fighting

---

## Tuning Parameters

### If Defenders Bounce Too Aggressively

**Problem:** Defenders jitter or oscillate when near each other

**Solution 1: Reduce Separation Force**
```javascript
// In _avoidOthers() method (line 286)
const force = (minDist - d) * 1.5;  // Was 2.0 - gentler push
```

**Solution 2: Reduce Padding**
```javascript
// In _avoidOthers() method (line 282)
const minDist = this.radius + other.radius + 0.3;  // Was 0.5 - less spacing
```

**Solution 3: Add Damping**
```javascript
// After _avoidOthers() call in update() (after line 103)
this._avoidOthers(allDefenders);
// Dampen excessive avoidance velocity
const maxAvoidSpeed = 5.0;
const avoidSpeed = Math.hypot(this.vx, this.vz);
if (avoidSpeed > maxAvoidSpeed) {
  this.vx = (this.vx / avoidSpeed) * maxAvoidSpeed;
  this.vz = (this.vz / avoidSpeed) * maxAvoidSpeed;
}
```

### If Defenders Don't Separate Enough

**Problem:** Defenders still overlap visually

**Solution 1: Increase Separation Force**
```javascript
// In _avoidOthers() method (line 286)
const force = (minDist - d) * 3.0;  // Was 2.0 - stronger push
```

**Solution 2: Increase Padding**
```javascript
// In _avoidOthers() method (line 282)
const minDist = this.radius + other.radius + 0.7;  // Was 0.5 - more spacing
```

**Solution 3: Increase Detection Range**
```javascript
// In _avoidOthers() method (line 282)
const minDist = this.radius + other.radius + 1.0;  // Was 0.5 - detect earlier
```

### If Player Push Feels Too Weak/Strong

**Too Weak (defender bulldozes player):**
```javascript
// In update() method (line 121)
this.x += (dx / d) * overlap * 0.5;  // Was 0.3 - defender gives way more
this.z += (dz / d) * overlap * 0.5;
```

**Too Strong (defender bounces off player):**
```javascript
// In update() method (line 121)
this.x += (dx / d) * overlap * 0.1;  // Was 0.3 - defender more solid
this.z += (dz / d) * overlap * 0.1;
```

**Remove entirely (immovable defenders):**
```javascript
// Comment out lines 112-123 in update() method
```

---

## Technical Details

### Reynolds Steering Behaviors

Phase 5 implements **Separation** from Craig Reynolds' steering behaviors (1999).

**Key concepts:**
- **Separation:** Avoid crowding neighbors
- **Force-based:** Adds to velocity rather than replacing it
- **Local sensing:** Only checks nearby entities (all defenders in our case)
- **Emergent behavior:** Complex group dynamics from simple rules

**Not implemented (for Phase 6 - Linemates):**
- Alignment: Match velocity of neighbors
- Cohesion: Move toward average position of neighbors

### Why This Order Matters

```javascript
// Path following sets DESIRED velocity
this.vx = (dx / dist) * speed;  // "I want to go here"

// Avoidance MODIFIES velocity
this._avoidOthers(allDefenders);  // "But I need to avoid others"

// Position update APPLIES final velocity
this.x += this.vx * dt;  // "This is where I actually move"
```

If avoidance ran **before** path following:
- Path following would overwrite avoidance forces
- Defenders would ignore each other and stack

If avoidance ran **after** position update:
- Avoidance forces wouldn't affect this frame's movement
- One-frame delay in collision response (jittery)

---

## Performance Notes

**Complexity:** O(n²) where n = number of defenders

Each defender checks against all other defenders:
- 2 defenders: 2 comparisons per frame
- 4 defenders: 12 comparisons per frame
- 10 defenders: 90 comparisons per frame

**Current implementation (4 max defenders):**
- 12 distance calculations per frame
- Negligible performance impact on modern hardware

**If scaling to many defenders (10+):**
Consider spatial partitioning (grid-based neighbor search) to reduce to O(n).

---

## Code Quality Checklist ✅

- [x] JSDoc comment on `_avoidOthers()` with parameter and mutation docs
- [x] Comment explaining why 0.5 padding prevents clumping
- [x] Comment explaining 1e-4 guard prevents division by zero
- [x] Comment explaining why avoidance runs after path following
- [x] Comment explaining 0.3 factor for player push
- [x] Update loop order documented in JSDoc
- [x] No magic numbers without explanation

---

## Next Steps - Phase 6

Phase 5 provides defender separation. Phase 6 will add **flocking for Linemates**:

**Flocking = Separation + Alignment + Cohesion**

Linemates will:
- Separate from each other (like defenders)
- Align velocity with nearby teammates
- Cohere to group center of mass

**File to modify:** [src/entities.js](src/entities.js:298) (Linemate class)

The Linemate class is currently empty and ready for Phase 6 implementation.

---

## Testing Checklist

Before considering Phase 5 complete, verify:

- [ ] Start game, 1 defender visible (Room 1)
- [ ] Advance to Room 3, 2 defenders maintain spacing
- [ ] Defenders navigate corridors without stacking
- [ ] Multiple defenders converge on goal with visible separation
- [ ] Defenders surround puck in loose formation (not stacked)
- [ ] Player feels physical contact when defender touches
- [ ] No jittering or oscillation when defenders are near each other
- [ ] Console shows no errors or warnings

**All checks passed?** → Phase 5 complete! Ready for Phase 6! 🏒
