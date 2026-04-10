# Dungeon Hockey

**Contributors**: 
- Rezwan Ahmed Sadman (202052452)
- Shakib Hasan (202053138)


A top-down hockey roguelike where you navigate procedurally generated dungeons, avoid AI-controlled defenders, and score goals to progress through rooms. Built with Three.js for 3D rendering and vanilla JavaScript for game logic.

The game combines classic hockey mechanics with dungeon exploration. You control a player who must shoot a puck into the goal while managing two AI linemates and avoiding enemy defenders. Each room you complete spawns a new dungeon with more defenders. Your health decreases when defenders catch you holding the puck, and the game ends when health reaches zero.

Defenders use pathfinding to chase the puck or block the goal, linemates flock together and help move the puck forward, and all entities avoid collisions using steering behaviors. The dungeons are generated using procedural content generation, creating unique layouts each time you score.

## How to Run

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

Open your browser to the URL shown in the terminal (usually http://localhost:5173).

Alternatively, if you have live-server installed:
```bash
npx live-server
```

## Controls

- **WASD**: Move player (or controlled linemate when not holding puck)
- **Space**: Shoot puck in facing direction, or pass to nearest teammate
- **E**: Pass puck to nearest teammate

The player automatically controls whichever entity (player or linemate) is closest to the puck. When you shoot or pass, control switches to the nearest linemate so you can reposition them.

## Algorithms Implemented

### Procedural Content Generation

The dungeon generator creates 7 rooms with random dimensions and connects them with L-shaped corridors. Each room is validated to prevent overlap using a 2-tile padding buffer. Corridors are randomly chosen to go horizontal-then-vertical or vertical-then-horizontal. The spawn room is always the first room generated, and the goal is placed in the last room. You can see this algorithm in action every time you score a goal, as a completely new dungeon layout is generated for the next room.

### Pathfinding (Jump Point Search)

Defenders use Jump Point Search, an optimization of A* pathfinding for uniform-cost grids. JPS identifies "jump points" where the search direction must change, skipping over tiles in open spaces. This is much faster than standard A* in our wide open rooms where many symmetric paths exist. Watch the defenders to see JPS in action - they path smoothly around walls and through corridors to chase the puck or block the goal.

### Decision Making (Behaviour Tree)

Each defender runs a priority selector behaviour tree with three states: BLOCK (guard goal when player is nearby), CHASE (pursue puck when in range), and PATROL (wander randomly). Higher priority states override lower ones, so blocking the goal always takes precedence over chasing. The defender's color changes based on its current state: magenta for blocking, orange for chasing, red for patrolling. You can trigger BLOCK mode by carrying the puck near the goal.

### Complex Movement (Collision Avoidance)

Defenders use Reynolds-style separation steering to avoid clustering. A repulsive force is applied when defenders get too close to each other, maintaining spacing even in tight corridors. This force is computed after pathfinding but before position updates, so defenders still follow their paths but smoothly slide around each other. You'll notice defenders form natural queues in corridors and spread out when blocking the goal instead of stacking on the same tile.

### Flocking

The two linemates move as a coordinated group using three flocking forces: separation (avoid crowding), alignment (match velocity with neighbors), and cohesion (move toward group center). When no one has the puck, linemates seek toward it while maintaining flock formation. When a linemate holds the puck, the others trail behind and spread out to receive passes. Watch the linemates form triangular formations as they move up the ice together.

## How to View Each Algorithm

Start the game and wait for defenders to spawn (they appear as glowing cylinders with eye markers). Stand still and watch the defenders patrol randomly (red color) to see the PATROL state. Drop the puck and watch defenders path toward it (orange color) to see JPS pathfinding and CHASE state working together. Pick up the puck and skate toward the goal - defenders will turn magenta and rush to block, demonstrating the BLOCK state and priority selector. Notice how they never stack on top of each other due to collision avoidance. Finally, press E to pass to a linemate and watch how all three teammates maintain spacing and formation using flocking behavior.

## Project Structure

```
Dungeon_Hockey/
  index.html           # Main HTML with HUD and game UI
  main.js              # Game loop, input handling, game state
  src/
    audio.js           # Web Audio API sound generation
    dungeon.js         # Procedural dungeon generation (PCG)
    entities.js        # Defender (behaviour tree + JPS) and Linemate (flocking)
    hud.js             # HUD updates and flash messages
    jps.js             # Jump Point Search pathfinding
    level.js           # 3D level building from tilemap
    player.js          # Player movement and skate trails
    puck.js            # Puck physics and possession system
    scene.js           # Three.js scene setup
    tilemap.js         # Tilemap collision detection and coordinate conversion
```

## Built With

- **Three.js r128** - 3D rendering library
- **Vite** - Development server and build tool
- **Web Audio API** - Procedural sound generation (no external audio files)
- **Vanilla JavaScript** - No game engines or frameworks
