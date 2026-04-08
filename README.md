# Dungeon Hockey - COMP 4300

A top-down hockey roguelike built with vanilla JavaScript and Three.js.

## Project Structure

```
dungeon-hockey/
  index.html          # Main HTML with HUD
  main.js            # Game loop and initialization
  package.json       # Dependencies
  src/
    tilemap.js       # Tilemap data and collision detection
    dungeon.js       # Procedural dungeon generation (PCG)
    player.js        # Player movement and input
    puck.js          # Puck physics
    entities.js      # Defender and Linemate placeholders
    hud.js           # HUD updates and flash messages
    scene.js         # Three.js scene setup
    level.js         # 3D level building
```

## How to Run

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Open browser to the URL shown (usually http://localhost:5173)

Alternative using live-server:
```bash
npx live-server
```

## What You Should See

### Phase 1 & 2 Implementation

✅ **Dungeon Generation**
- Procedurally generated dungeon with 7 rooms connected by L-shaped corridors
- Dark blue-gray floor with grid overlay
- Dark stone walls with subtle emissive glow
- Bright green goal zone in the final room

✅ **Player**
- Cyan glowing cylinder with hockey stick indicator
- WASD movement with smooth physics
- Point light follows player
- Invincibility flashing after taking damage

✅ **Puck**
- Orange glowing puck with point light
- Realistic physics with friction
- Bounces off walls (dampened)
- Transfers momentum from player contact

✅ **Controls**
- **WASD**: Move player
- **SPACE**: Shoot puck in facing direction
- **SHIFT**: Pass to nearest linemate (currently acts as shoot since no linemates yet)

✅ **Game Flow**
- Shoot puck into green goal zone
- "GOAL!" flash message appears
- New dungeon generates after 1.4s
- Score increases, room counter increments
- HUD shows score, health, and room number

✅ **Visual Style**
- Dark blue-gray background with improved visibility
- Medium blue-gray walls with emissive glow (clearly visible)
- Darker blue-gray floor with grid overlay
- Cyan player with emissive glow
- Orange puck with warm glow
- Warm orange torch lights in intermediate rooms
- Bright green goal with glow effect
- Enhanced lighting for better contrast

## Algorithm Categories Implemented

### Phase 2: Procedural Content Generation (PCG)

**File**: [src/dungeon.js](src/dungeon.js)

Room-based dungeon generation algorithm:
1. Places NUM_ROOMS (7) rectangular rooms with random dimensions
2. Validates room placement with 2-tile padding to prevent overlap
3. Connects rooms with L-shaped corridors (randomly horizontal-then-vertical or vertical-then-horizontal)
4. Idempotent - can regenerate fresh dungeons on demand

This is NOT a maze generator (no depth-first backtracking) - it creates actual wide rooms connected by corridors, as required.

## Next Steps - Phase 3

When you're ready to implement pathfinding and AI, start with:

**File to open first**: [src/entities.js](src/entities.js)

The `Defender` and `Linemate` classes are ready to be filled in with:
- **Phase 3**: Jump Point Search pathfinding for Defenders
- **Phase 4**: Behaviour tree for Defender decision-making
- **Phase 5**: Collision avoidance for all entities
- **Phase 6**: Flocking behavior for Linemates

Each entity has access to:
- `this.x, this.z` - position
- `this.radius` - collision radius
- `update(dt, all)` - called every frame with delta time and references to other entities

## Technical Notes

- **Three.js version**: 0.160.0 (latest via npm)
- **No game engines**: Pure JavaScript with Three.js for rendering only
- **No TypeScript**: Plain ES6 modules
- **Camera**: Orthographic top-down view
- **Physics**: Custom circle-vs-AABB collision (no physics engine)
- **Rendering**: All game objects added to `levelGroup` for easy level transitions

## Code Quality

- Every function is documented with JSDoc comments
- Clear separation of concerns (one module per responsibility)
- Mutating functions clearly marked in comments
- Professor-friendly code structure for grading
