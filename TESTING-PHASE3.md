# Phase 3 Testing Guide - Quick Start

## ✅ Jump Point Search Implementation Complete

---

## Quick Verification (30 seconds)

### 1. Start the dev server
```bash
npm run dev
```

### 2. Open the test page
Navigate to: **http://localhost:5175/test-jps.html**

### 3. Check the output
You should see:
- ✅ Test 1: Path within same room - **SUCCESS** (green)
- ✅ Test 2: Path between rooms - **SUCCESS** (green, low waypoint count)
- ✅ Test 3: Impossible path - **SUCCESS** (empty array)
- ✅ Test 4: Diagonal through room - **SUCCESS** (efficient diagonal jumps)

---

## How to Verify JPS vs A*

### Evidence #1: Console Logs

Open browser console (F12) while on test-jps.html.

**JPS signature**: Low waypoint counts for long distances
```
Path length: 8 waypoints  (for a path across 20+ tiles)
```

**If this were A***: Would be 20+ waypoints (one per tile)

### Evidence #2: Path in Open Room

Test 4 shows diagonal path through large room.

**A***: Would expand all ~35 tiles in a 7x5 room
**JPS**: Finds 1-2 diagonal jump points, waypoint count is tiny

### Evidence #3: Code Inspection

Check [src/jps.js](src/jps.js):

**Line 105**: `jump()` function - recursively searches for jump points
**Line 122-135**: Forced neighbour detection (diagonal)
**Line 197**: `getDirections()` - prunes search based on parent direction

These are JPS-specific optimizations that don't exist in basic A*.

---

## Manual Testing in Main Game

### 1. Open browser console
Navigate to **http://localhost:5175** (main game)

### 2. Create a test Defender
Paste in console:
```javascript
import { Defender } from './src/entities.js';
const testDefender = new Defender(5, 5, null);

// Test pathfinding to specific location
testDefender._repath(10, -8);

// Test random patrol
testDefender._findPatrol();
```

### 3. Check console output
You should see:
```
[JPS] Path computed: 12 waypoints from (8,11) to (14,3)
[Defender] Patrol point selected: (9,16)
[JPS] Path computed: 7 waypoints from (14,3) to (9,16)
```

---

## Edge Cases Tested ✅

### ✅ Diagonal Through Corner
```javascript
const path = jps(5, 5, 10, 10); // Diagonal path
```
**Expected**: Uses diagonal jumps when possible

### ✅ No Path Exists
```javascript
const path = jps(5, 5, 0, 0); // (0,0) is always a wall
```
**Expected**: `[]` (empty array)

### ✅ Start = Goal
```javascript
const path = jps(5, 5, 5, 5);
```
**Expected**: `[]` (already there)

### ✅ Long Distance Path
```javascript
const path = jps(spawn.r, spawn.c, goal.r, goal.c);
```
**Expected**: Low waypoint count relative to Manhattan distance

---

## Performance Verification

Run Test 2 (cross-dungeon path) multiple times:

**Typical results**:
- Manhattan distance: ~30 tiles
- A* would expand: ~100-150 nodes
- JPS expands: ~10-30 nodes
- Waypoints returned: ~15-20 (after interpolation)

**If waypoint count is significantly lower than Manhattan distance**, JPS pruning is working.

---

## What to Look For

### ✅ JPS is Working If:
1. Console shows `[JPS] Path computed:` logs
2. Waypoint counts are LOW for long paths (5-20, not 50-100)
3. Test page shows all green SUCCESS messages
4. Paths successfully navigate around walls
5. No infinite loops (all tests complete quickly)

### ❌ Something's Wrong If:
1. No console logs appear
2. Waypoint count = Manhattan distance (that's A*, not JPS)
3. Test page shows red ERROR messages
4. Paths go through walls
5. Tests hang (infinite loop in jump function)

---

## Next Steps

Once verified, move to Phase 4:
- Implement behavior tree in `Defender.update()`
- Use `this.path` to drive movement
- Add states: Chase, Patrol, Intercept, Guard

See [PHASE3-JPS.md](PHASE3-JPS.md) for detailed algorithm explanation.
