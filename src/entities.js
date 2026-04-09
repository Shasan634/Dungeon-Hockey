// entities.js - Defender and Linemate AI entities
// COMP 4300 - Dungeon Hockey
// Phase 3: JPS pathfinding | Phase 4: Behaviour tree

import * as THREE from 'three';
import { jps } from './jps.js';
import { nearestFloor, worldToTile, ROWS, COLS, resolveWalls } from './tilemap.js';
import { playBlock } from './audio.js';

/**
 * Defender entity with behaviour tree AI
 * Uses JPS pathfinding and priority-based decision making
 */
export class Defender {
  constructor(x, z, levelGroup, player, puck, goalPos) {
    // Position and physics
    this.x = x;
    this.z = z;
    this.vx = 0;
    this.vz = 0;
    this.radius = 0.4;
    this.angle = 0;
    this.speed = 3.0;

    // AI state
    this.state = 'PATROL';
    this.path = [];
    this.pathCooldown = 0;

    // References for behaviour tree
    this.player = player;
    this.puck = puck;
    this.goalPos = goalPos;

    // Create mesh
    const geometry = new THREE.CylinderGeometry(0.35, 0.35, 0.52, 10);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xdd2222,
      emissive: 0x661111,
      emissiveIntensity: 0.5
    });
    this.mesh = new THREE.Mesh(geometry, this.mat);
    this.mesh.position.set(this.x, 0.26, this.z);

    // State indicator eye
    const eyeGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    this.eyeMat = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      emissive: 0xff4444,
      emissiveIntensity: 1.0
    });
    const eye = new THREE.Mesh(eyeGeometry, this.eyeMat);
    eye.position.set(0, 0.35, 0);
    this.mesh.add(eye);

    // Atmospheric point light
    const light = new THREE.PointLight(0xdd2222, 0.6, 2.5);
    light.position.set(0, 0.4, 0);
    this.mesh.add(light);

    levelGroup.add(this.mesh);
  }

  /**
   * Main update loop
   * Order: cooldown → tick → path follow → avoidance → physics → render
   * @param {number} dt - delta time in seconds
   * @param {Array} allDefenders - array of all defender entities
   * Mutates: this.x, this.z, this.vx, this.vz, this.angle, this.path, this.state
   */
  update(dt, allDefenders) {
    // 1. Update path cooldown
    this.pathCooldown -= dt;

    // 2. Behaviour tree tick - determines state and manages path
    this.tick();

    // 3. Path following - compute velocity towards next waypoint
    if (this.path.length > 0) {
      const target = this.path[0];
      const dx = target.x - this.x;
      const dz = target.z - this.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.5) {
        // Arrived at waypoint, move to next
        this.path.shift();
      } else {
        // Move towards waypoint
        const speedMultiplier = this._getSpeedMultiplier();
        const speed = this.speed * speedMultiplier;
        this.vx = (dx / dist) * speed;
        this.vz = (dz / dist) * speed;
        this.angle = Math.atan2(this.vx, this.vz);
      }
    } else {
      // No path - decelerate
      this.vx *= 0.75;
      this.vz *= 0.75;
    }

    // 4. Collision avoidance - Reynolds-style separation
    // Runs after path following sets the desired velocity, but before position update.
    // This allows avoidance forces to modify velocity while maintaining pathfinding intent.
    this._avoidOthers(allDefenders);

    // 5. Update position
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // 6. Wall collision
    resolveWalls(this);

    // 7. Physical push against player
    // Defender gives way slightly (0.3 factor) to avoid being totally immovable.
    // Damage is still handled in updatePlayer - this is just the physical interaction.
    const dx = this.x - this.player.x;
    const dz = this.z - this.player.z;
    const d = Math.hypot(dx, dz);
    const minD = this.radius + this.player.radius;
    if (d < minD && d > 1e-4) {
      const overlap = minD - d;
      this.x += (dx / d) * overlap * 0.3;
      this.z += (dz / d) * overlap * 0.3;
    }

    // 8. Update mesh
    this.mesh.position.set(this.x, 0.26, this.z);
    this.mesh.rotation.y = this.angle;

    // 9. Update material colors based on state
    this._updateColors();
  }

  /**
   * Behaviour Tree - Priority Selector Pattern
   *
   * The tree evaluates conditions from highest to lowest priority.
   * The first condition that returns true determines the active behavior.
   *
   * Priority 1: BLOCK - Guard the goal when player is nearby
   *   - Highest priority because preventing goals is critical
   *   - Defenders abandon all other tasks to block scoring attempts
   *
   * Priority 2: CHASE - Pursue the puck when in range
   *   - Second priority: stop the puck from advancing
   *   - Only activates if BLOCK condition is false
   *
   * Priority 3: PATROL - Default wandering behavior
   *   - Lowest priority: always active as fallback
   *   - Keeps defenders moving when no threats detected
   *
   * State transitions clear the path and force immediate replanning.
   */
  tick() {
    const distToGoal = this._distance(this.player.x, this.player.z, this.goalPos.x, this.goalPos.z);
    const distToPuck = this._distance(this.puck.x, this.puck.z, this.x, this.z);

    let newState = this.state;

    // Priority 1: BLOCK - Player approaching goal
    if (distToGoal < 5.5) {
      newState = 'BLOCK';

      // On state enter: clear path and force immediate repath
      if (this.state !== 'BLOCK') {
        this.path = [];
        this.pathCooldown = 0;
        playBlock(); // Audio feedback on state transition
      }

      // Repath to intercept position between puck and goal
      // This makes defenders actively block the puck rather than just standing in goal
      if (this.pathCooldown <= 0) {
        const interceptPos = this._calculateIntercept(this.puck.x, this.puck.z, this.goalPos.x, this.goalPos.z);
        this._repath(interceptPos.x, interceptPos.z);
        this.pathCooldown = 0.4;
      }
    }
    // Priority 2: CHASE - Puck is nearby
    else if (distToPuck < 8.0) {
      newState = 'CHASE';

      // On state enter: clear path and force immediate repath
      if (this.state !== 'CHASE') {
        this.path = [];
        this.pathCooldown = 0;
      }

      // Repath to puck position when cooldown expires
      if (this.pathCooldown <= 0) {
        this._repath(this.puck.x, this.puck.z);
        this.pathCooldown = 0.3;
      }
    }
    // Priority 3: PATROL - Default behavior
    else {
      newState = 'PATROL';

      // On state enter: find initial patrol point
      if (this.state !== 'PATROL') {
        this._findPatrol();
      }

      // When path is empty, find new patrol point
      if (this.path.length === 0) {
        this._findPatrol();
      }
    }

    // Update state
    this.state = newState;
  }

  /**
   * Recomputes path from current position to target world position
   * Uses Jump Point Search for efficient pathfinding
   * @param {number} tx - target world x position
   * @param {number} tz - target world z position
   * Mutates: this.path
   */
  _repath(tx, tz) {
    const { r: sr, c: sc } = nearestFloor(this.x, this.z);
    const { r: gr, c: gc } = nearestFloor(tx, tz);
    this.path = jps(sr, sc, gr, gc);

    // Debug logging to verify JPS is running
    console.log(`[JPS] Path computed: ${this.path.length} waypoints from (${sr},${sc}) to (${gr},${gc})`);
  }

  /**
   * Picks a random floor tile and paths to it (patrol behavior)
   * Mutates: this.path
   */
  _findPatrol() {
    // Pick a random tile in the map
    const maxAttempts = 50;
    for (let i = 0; i < maxAttempts; i++) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);

      // Find nearest floor tile to this random position
      const { r: fr, c: fc } = nearestFloor(
        (c - COLS / 2) * 2.0 + 1.0,
        (r - ROWS / 2) * 2.0 + 1.0
      );

      // Convert to world coordinates
      const tx = (fc - COLS / 2) * 2.0 + 1.0;
      const tz = (fr - ROWS / 2) * 2.0 + 1.0;

      // Path to this location
      this._repath(tx, tz);

      if (this.path.length > 0) {
        console.log(`[Defender] Patrol point selected: (${fr},${fc})`);
        return;
      }
    }

    console.log('[Defender] Failed to find patrol point');
  }

  /**
   * Reynolds-style separation force to avoid clustering with other defenders
   * Applies repulsive force when defenders get too close to each other.
   *
   * The 0.5 padding on top of combined radii keeps defenders visually separated
   * even before they are physically overlapping. This prevents the "clumping"
   * effect where multiple defenders stack on the same tile.
   *
   * The 1e-4 guard prevents division by zero when two defenders are at exactly
   * the same position (edge case during spawning or physics glitches).
   *
   * @param {Array} allDefenders - array of all defender entities
   * Mutates: this.vx, this.vz
   */
  _avoidOthers(allDefenders) {
    for (const other of allDefenders) {
      if (other === this) continue;

      const dx = this.x - other.x;
      const dz = this.z - other.z;
      const d = Math.hypot(dx, dz);

      // minDist includes 0.5 padding for visual separation
      const minDist = this.radius + other.radius + 0.5;

      if (d < minDist && d > 1e-4) {
        // Apply separation force proportional to penetration depth
        const force = (minDist - d) * 2.0;
        this.vx += (dx / d) * force;
        this.vz += (dz / d) * force;
      }
    }
  }

  /**
   * Calculates Euclidean distance between two points
   * @param {number} x1 - first point x
   * @param {number} z1 - first point z
   * @param {number} x2 - second point x
   * @param {number} z2 - second point z
   * @returns {number} distance
   */
  _distance(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Calculates intercept position between puck and goal for blocking
   * Positions defender on the line between puck and goal, 2 units in front of goal.
   * This creates active blocking behavior rather than just standing in the goal.
   *
   * @param {number} puckX - puck world x position
   * @param {number} puckZ - puck world z position
   * @param {number} goalX - goal world x position
   * @param {number} goalZ - goal world z position
   * @returns {{x: number, z: number}} intercept position in world coordinates
   */
  _calculateIntercept(puckX, puckZ, goalX, goalZ) {
    // Calculate direction from goal to puck
    const dx = puckX - goalX;
    const dz = puckZ - goalZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // If puck is very close to goal or at goal, just defend goal position
    if (dist < 2.0) {
      return { x: goalX, z: goalZ };
    }

    // Position defender 2 units from goal toward the puck
    const interceptDist = 2.0;
    const nx = dx / dist;
    const nz = dz / dist;

    return {
      x: goalX + nx * interceptDist,
      z: goalZ + nz * interceptDist
    };
  }

  /**
   * Returns speed multiplier based on current state
   * @returns {number} speed multiplier
   */
  _getSpeedMultiplier() {
    switch (this.state) {
      case 'BLOCK': return 1.4;  // Fast - goal defense is urgent
      case 'CHASE': return 1.15; // Medium - pursue puck
      case 'PATROL': return 1.0; // Normal - relaxed wandering
      default: return 1.0;
    }
  }

  /**
   * Updates mesh material colors based on current state
   * Mutates: this.mat.color, this.mat.emissive, this.eyeMat.color, this.eyeMat.emissive
   */
  _updateColors() {
    switch (this.state) {
      case 'PATROL':
        this.mat.color.setHex(0xdd2222);
        this.mat.emissive.setHex(0x661111);
        this.eyeMat.color.setHex(0xff4444);
        this.eyeMat.emissive.setHex(0xff4444);
        break;
      case 'CHASE':
        this.mat.color.setHex(0xff4400);
        this.mat.emissive.setHex(0x882200);
        this.eyeMat.color.setHex(0xff6600);
        this.eyeMat.emissive.setHex(0xff6600);
        break;
      case 'BLOCK':
        this.mat.color.setHex(0xdd00aa);
        this.mat.emissive.setHex(0x660055);
        this.eyeMat.color.setHex(0xff00cc);
        this.eyeMat.emissive.setHex(0xff00cc);
        break;
    }
  }
}

/**
 * Linemate entity - will implement flocking behavior in Phase 6
 */
export class Linemate {
  constructor(x, z, levelGroup) {
    this.x = x;
    this.z = z;
    this.radius = 0.4;
  }

  update(dt, others) {
    // Phase 5: Collision avoidance
    // Phase 6: Flocking
  }
}
