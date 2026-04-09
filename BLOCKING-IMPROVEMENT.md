# Improved BLOCK Behavior - Active Interception

## Problem

**Before:** Defenders in BLOCK state would path directly to the goal tile and wait there.

**Issue:** This doesn't actually block the puck! Defenders just stood in the goal zone while the puck sailed past them into the net.

---

## Solution

**After:** Defenders now calculate an **intercept position** between the puck and goal, positioning themselves 2 units in front of the goal on the puck-to-goal line.

### Implementation

**New Method:** `_calculateIntercept(puckX, puckZ, goalX, goalZ)` ([src/entities.js:321](src/entities.js:321))

**How it works:**

```javascript
// Calculate direction from goal to puck
const dx = puckX - goalX;
const dz = puckZ - goalZ;
const dist = Math.sqrt(dx * dx + dz * dz);

// Position defender 2 units from goal toward the puck
const interceptDist = 2.0;
const nx = dx / dist;
const nz = dz / dist;

return {
  x: goalX + nx * interceptDist,
  z: goalZ + nz * interceptDist
};
```

**Special case:** If puck is very close to goal (< 2 units), defender just guards the goal position directly.

---

## Visual Comparison

### Before (Standing in Goal)

```
        Puck →
            ↓
            ↓
    ┌───────────┐
    │           │
    │     G     │  ← Goal
    │     D     │  ← Defender standing in goal
    └───────────┘
```

**Problem:** Puck goes straight past defender into goal!

### After (Active Interception)

```
        Puck →
            ↓
            D     ← Defender intercepts 2 units in front
            ↓
    ┌───────────┐
    │           │
    │     G     │  ← Goal
    │           │
    └───────────┘
```

**Solution:** Defender actively blocks the puck's path to the goal!

---

## Behavior Details

### Intercept Distance: 2 Units

**Why 2 units?**
- Far enough from goal to actually intercept the puck
- Close enough to still protect the goal zone
- Allows defender to react if puck changes direction

**Tuning:** Adjust in `_calculateIntercept()` line 333:
```javascript
const interceptDist = 2.0;  // Increase = defend farther out
                             // Decrease = defend closer to goal
```

### Dynamic Repositioning

Defenders **recompute** intercept position every 0.4 seconds (BLOCK cooldown).

**What this means:**
- As puck moves, defender adjusts position
- Defender always stays between puck and goal
- Creates "tracking" behavior where defender mirrors puck movement

**Example:**
```
Puck left of goal → Defender moves left
Puck moves right  → Defender shifts right
Puck approaches   → Defender holds intercept line
```

---

## Testing the Improvement

### Test 1: Shoot from Distance

**Setup:**
1. Get near goal to trigger BLOCK (defenders turn magenta)
2. Shoot puck toward goal from far away
3. Watch defenders react

**Expected Before:**
- Defenders rush to goal tile
- Puck goes past them
- Goal scored easily

**Expected After:**
- Defenders position themselves in puck's path
- Defender intercepts puck 2 units before goal
- Much harder to score!

### Test 2: Move Puck Laterally

**Setup:**
1. Trigger BLOCK state (near goal)
2. Move puck left and right in front of goal
3. Watch defenders track

**Expected Behavior:**
- Defenders shift position to stay between puck and goal
- Creates "wall" that moves with the puck
- Defenders don't just camp in one spot

### Test 3: Multiple Defenders

**Setup:**
1. Reach Room 5+ (3-4 defenders)
2. Trigger BLOCK state
3. Watch formation

**Expected Behavior:**
- All defenders calculate intercept positions
- Collision avoidance keeps them separated
- Forms a "defensive line" 2 units from goal
- Covers multiple angles simultaneously

---

## Tuning Parameters

### Intercept Distance

**Current:** 2.0 units from goal

**Adjust:** [src/entities.js:333](src/entities.js:333)

```javascript
// More aggressive (defend farther out)
const interceptDist = 3.0;  // Intercept 3 units from goal

// More conservative (defend closer to goal)
const interceptDist = 1.5;  // Intercept 1.5 units from goal
```

**Effect:**
- **Larger:** Defenders block earlier, but might leave goal exposed if puck redirects
- **Smaller:** Defenders stay near goal, but might not intercept fast shots

### Close-Range Threshold

**Current:** Switch to goal defense when puck < 2.0 units from goal

**Adjust:** [src/entities.js:328](src/entities.js:328)

```javascript
// Earlier switch to goal defense
if (dist < 3.0) {
  return { x: goalX, z: goalZ };
}

// Later switch (more aggressive interception)
if (dist < 1.0) {
  return { x: goalX, z: goalZ };
}
```

### Repath Cooldown

**Current:** 0.4 seconds (BLOCK state)

**Adjust:** [src/entities.js:175](src/entities.js:175)

```javascript
// More reactive (faster repositioning)
this.pathCooldown = 0.2;  // Recalculate every 0.2s

// Less reactive (slower repositioning, more stable)
this.pathCooldown = 0.6;  // Recalculate every 0.6s
```

**Effect:**
- **Faster:** Defenders track puck more precisely, but might jitter
- **Slower:** Smoother movement, but slower reaction to puck changes

---

## Advanced: Multi-Defender Spread

**Future Enhancement (Not Implemented):**

For even better blocking, spread multiple defenders:

```javascript
_calculateIntercept(puckX, puckZ, goalX, goalZ, defenderIndex, totalDefenders) {
  const dx = puckX - goalX;
  const dz = puckZ - goalZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 2.0) {
    return { x: goalX, z: goalZ };
  }

  const interceptDist = 2.0;
  const nx = dx / dist;
  const nz = dz / dist;

  // Spread defenders in an arc
  const spreadAngle = (defenderIndex - totalDefenders / 2) * 0.3;
  const rotX = nx * Math.cos(spreadAngle) - nz * Math.sin(spreadAngle);
  const rotZ = nx * Math.sin(spreadAngle) + nz * Math.cos(spreadAngle);

  return {
    x: goalX + rotX * interceptDist,
    z: goalZ + rotZ * interceptDist
  };
}
```

This would create a **fan formation** in front of the goal instead of all defenders converging on the same intercept point.

---

## Summary

**File Changed:** [src/entities.js](src/entities.js:1)
- Line 170-176: BLOCK state now uses intercept calculation
- Line 310-341: New `_calculateIntercept()` method

**Behavior Change:**
- ❌ **Before:** Defenders stood in goal (ineffective)
- ✅ **After:** Defenders actively intercept puck path (effective blocking!)

**Visual Result:**
- Defenders form a defensive line 2 units from goal
- Line shifts with puck movement
- Much harder to score when defenders are in BLOCK state

**Difficulty Impact:**
- Game is now harder (defenders actually defend!)
- Scoring requires better positioning and timing
- Can't just shoot from anywhere when near goal

Test it out and see the difference! 🏒
