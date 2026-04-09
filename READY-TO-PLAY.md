# 🏒 Dungeon Hockey - Ready to Play!

## Quick Start

```bash
npm run dev
```

Open **http://localhost:5175** in your browser.

---

## What You'll Experience

### Starting a Game

**Phase 1-2: Procedural Dungeon**
- Random dungeon with 7 rooms connected by corridors
- Dark blue floor with visible walls
- Green glowing goal zone in final room
- Cyan glowing player with hockey stick
- Orange glowing puck

**Phase 3-4: AI Defenders Added!**
- **1 red defender** spawns in Room 1 (progressive difficulty)
- Defender wanders randomly (PATROL state)
- Smart pathfinding using Jump Point Search

---

## Controls

- **WASD** - Move player
- **SPACE** - Shoot puck
- **SHIFT** - Pass (to linemates when implemented)

---

## Gameplay

### Objective
Shoot the puck into the **green goal zone** to advance to the next room.

### Defender AI (3 States)

#### 🔴 PATROL (Red)
- **Default wandering behavior**
- Defender is far from both player and puck
- Normal speed (1.0x)

#### 🟠 CHASE (Orange)
- **Pursues the puck**
- Activates when puck is within 8 units
- Faster speed (1.15x)
- Try to keep the puck away from defenders!

#### 💜 BLOCK (Magenta/Pink)
- **Guards the goal**
- Activates when YOU get within 5.5 units of goal
- **Highest priority** - overrides CHASE
- Fastest speed (1.4x)
- Defenders rush to intercept you!

---

## Strategy Tips

1. **Move the puck carefully** - Getting too close to defenders triggers CHASE (orange)

2. **Approach the goal cautiously** - Getting within 5.5 units triggers BLOCK (magenta) - all defenders rush to stop you!

3. **Watch defender colors** - They telegraph their behavior:
   - Red = safe, wandering
   - Orange = chasing puck
   - Magenta = blocking your goal attempt

4. **Use walls** - Defenders pathfind around walls, you can use corners to your advantage

5. **Progressive difficulty** - More defenders spawn as you advance:
   - Room 1: 1 defender
   - Room 3: 2 defenders
   - Room 5: 3 defenders
   - Room 7+: 4 defenders (max)

---

## Console Output

Open browser console (F12) to see AI in action:

```
[Defender] Patrol point selected: (9,12)
[JPS] Path computed: 8 waypoints from (5,7) to (9,12)
[JPS] Path computed: 12 waypoints from (9,12) to (14,8)  // Chasing puck
[JPS] Path computed: 15 waypoints from (10,11) to (15,3) // Blocking goal
```

---

## What's Implemented

✅ **Phase 1**: Core game scaffold (player, puck, controls, HUD)
✅ **Phase 2**: Procedural dungeon generation (PCG)
✅ **Phase 3**: Jump Point Search pathfinding (JPS)
✅ **Phase 4**: Behaviour tree AI (priority selector)

---

## What's Next (Not Yet Implemented)

🔜 **Phase 5**: Collision avoidance (defenders avoid each other)
🔜 **Phase 6**: Flocking behavior (linemates move together)

---

## Known Behaviors

- **Defenders spawn in random positions** each level
- **Defenders navigate around walls** using JPS pathfinding
- **Multiple defenders can converge on goal** when BLOCK is triggered
- **Defenders update paths** every 0.3-0.4 seconds based on state
- **Health decreases** when defenders touch you (invincibility cooldown)

---

## Troubleshooting

### Defenders not appearing?
Check browser console for errors. Defenders should log:
```
[Defender] Patrol point selected: (r,c)
```

### Defenders not moving?
Open console - you should see JPS path computation logs. If not, check that gameActive is true.

### Too hard / too easy?
See [PHASE4-BEHAVIOUR-TREE.md](PHASE4-BEHAVIOUR-TREE.md#tuning-defender-aggressiveness) for tuning parameters.

---

## Have Fun! 🏒

Try to reach higher rooms and see how many defenders you can handle!
