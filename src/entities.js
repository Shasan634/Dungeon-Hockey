// entities.js - Defender and Linemate AI entities
// COMP 4300 - Dungeon Hockey
// Phase 3: JPS pathfinding | Phase 4: Behaviour tree

import * as THREE from 'three';
import { jps } from './jps.js';
import { nearestFloor, worldToTile, ROWS, COLS, resolveWalls } from './tilemap.js';

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

    // 4. Collision avoidance - TODO: Phase 5 implementation

    // 5. Update position
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // 6. Wall collision
    resolveWalls(this);

    // 7. Update mesh
    this.mesh.position.set(this.x, 0.26, this.z);
    this.mesh.rotation.y = this.angle;

    // 8. Update material colors based on state
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
      }

      // Repath to goal position when cooldown expires
      if (this.pathCooldown <= 0) {
        this._repath(this.goalPos.x, this.goalPos.z);
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
