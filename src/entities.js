// entities.js - Defender and Linemate AI entities

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
   * @param {number} dt - delta time in seconds
   * @param {Array} allDefenders - array of all defender entities
   * Mutates: this.x, this.z, this.vx, this.vz, this.angle, this.path, this.state
   */
  update(dt, allDefenders) {
    this.pathCooldown -= dt;
    this.tick();

    // Path following
    if (this.path.length > 0) {
      const target = this.path[0];
      const dx = target.x - this.x;
      const dz = target.z - this.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.5) {
        this.path.shift();
      } else {
        const speedMultiplier = this._getSpeedMultiplier();
        const speed = this.speed * speedMultiplier;
        this.vx = (dx / dist) * speed;
        this.vz = (dz / dist) * speed;
        this.angle = Math.atan2(this.vx, this.vz);
      }
    } else {
      this.vx *= 0.75;
      this.vz *= 0.75;
    }

    // Collision avoidance applied after path following sets desired velocity
    this._avoidOthers(allDefenders);

    this.x += this.vx * dt;
    this.z += this.vz * dt;
    resolveWalls(this);

    // Physical push against player (defender gives way 30%)
    const dx = this.x - this.player.x;
    const dz = this.z - this.player.z;
    const d = Math.hypot(dx, dz);
    const minD = this.radius + this.player.radius;
    if (d < minD && d > 1e-4) {
      const overlap = minD - d;
      this.x += (dx / d) * overlap * 0.3;
      this.z += (dz / d) * overlap * 0.3;
    }

    this.mesh.position.set(this.x, 0.26, this.z);
    this.mesh.rotation.y = this.angle;
    this._updateColors();
  }

  /**
   * Behaviour Tree - Priority Selector Pattern
   *
   * BLOCK: Guard goal when player nearby (highest priority)
   * CHASE: Pursue puck when in range
   * PATROL: Wander randomly (fallback)
   *
   * State transitions clear the path and force immediate replanning.
   */
  tick() {
    const distToGoal = this._distance(this.player.x, this.player.z, this.goalPos.x, this.goalPos.z);
    const distToPuck = this._distance(this.puck.x, this.puck.z, this.x, this.z);

    let newState = this.state;

    if (distToGoal < 5.5) {
      newState = 'BLOCK';

      if (this.state !== 'BLOCK') {
        this.path = [];
        this.pathCooldown = 0;
        playBlock();
      }

      if (this.pathCooldown <= 0) {
        const interceptPos = this._calculateIntercept(this.puck.x, this.puck.z, this.goalPos.x, this.goalPos.z);
        this._repath(interceptPos.x, interceptPos.z);
        this.pathCooldown = 0.4;
      }
    }
    else if (distToPuck < 8.0) {
      newState = 'CHASE';

      if (this.state !== 'CHASE') {
        this.path = [];
        this.pathCooldown = 0;
      }

      if (this.pathCooldown <= 0) {
        this._repath(this.puck.x, this.puck.z);
        this.pathCooldown = 0.3;
      }
    }
    else {
      newState = 'PATROL';

      if (this.state !== 'PATROL') {
        this._findPatrol();
      }

      if (this.path.length === 0) {
        this._findPatrol();
      }
    }

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

  }

  /**
   * Picks a random floor tile and paths to it (patrol behavior)
   * Mutates: this.path
   */
  _findPatrol() {
    const maxAttempts = 50;
    for (let i = 0; i < maxAttempts; i++) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);

      const { r: fr, c: fc } = nearestFloor(
        (c - COLS / 2) * 2.0 + 1.0,
        (r - ROWS / 2) * 2.0 + 1.0
      );

      const tx = (fc - COLS / 2) * 2.0 + 1.0;
      const tz = (fr - ROWS / 2) * 2.0 + 1.0;

      this._repath(tx, tz);

      if (this.path.length > 0) {
        return;
      }
    }
  }

  /**
   * Reynolds-style separation force to avoid clustering
   * @param {Array} allDefenders - array of all defender entities
   * Mutates: this.vx, this.vz
   */
  _avoidOthers(allDefenders) {
    for (const other of allDefenders) {
      if (other === this) continue;

      const dx = this.x - other.x;
      const dz = this.z - other.z;
      const d = Math.hypot(dx, dz);

      const minDist = this.radius + other.radius + 0.5;

      if (d < minDist && d > 1e-4) {
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
   * @param {number} puckX - puck world x position
   * @param {number} puckZ - puck world z position
   * @param {number} goalX - goal world x position
   * @param {number} goalZ - goal world z position
   * @returns {{x: number, z: number}} intercept position in world coordinates
   */
  _calculateIntercept(puckX, puckZ, goalX, goalZ) {
    const dx = puckX - goalX;
    const dz = puckZ - goalZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 2.0) {
      return { x: goalX, z: goalZ };
    }

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
      case 'BLOCK': return 1.4;
      case 'CHASE': return 1.15;
      case 'PATROL': return 1.0;
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
 * Linemate entity with flocking behavior
 * Controlled by WASD when nearest to puck, otherwise moves autonomously
 */
export class Linemate {
  constructor(x, z, levelGroup) {
    this.x = x;
    this.z = z;
    this.vx = 0;
    this.vz = 0;
    this.radius = 0.4;
    this.fx = 1;    // facing direction x (used for shoot)
    this.fz = 0;    // facing direction z
    this.angle = 0;

    const geometry = new THREE.CylinderGeometry(0.35, 0.35, 0.52, 10);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x22dd88,
      emissive: 0x116644,
      emissiveIntensity: 0.5
    });
    this.mesh = new THREE.Mesh(geometry, this.mat);
    this.mesh.position.set(this.x, 0.26, this.z);

    const light = new THREE.PointLight(0x22dd88, 0.6, 2.5);
    light.position.set(0, 0.4, 0);
    this.mesh.add(light);

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffee00,
      emissive: 0xffee00,
      emissiveIntensity: 2.5
    });
    this.highlightRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.07, 8, 28),
      ringMat
    );
    this.highlightRing.rotation.x = Math.PI / 2;
    this.highlightRing.position.y = -0.22;
    this.highlightRing.visible = false;
    this.mesh.add(this.highlightRing);

    const helmetGeometry = new THREE.SphereGeometry(0.25, 12, 12);
    const helmetMaterial = new THREE.MeshStandardMaterial({
      color: 0x00aadd,
      roughness: 0.4,
      metalness: 0.6
    });
    const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
    helmet.position.set(0, 0.5, 0);
    this.mesh.add(helmet);

    const visorGeometry = new THREE.PlaneGeometry(0.3, 0.15);
    const visorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0088ff,
      emissive: 0x0044ff,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.6
    });
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.set(0.15, 0.5, 0);
    visor.rotation.y = Math.PI / 2;
    this.mesh.add(visor);

    levelGroup.add(this.mesh);
  }

  /**
   * Shows or hides the highlight ring
   * @param {boolean} active
   */
  setHighlight(active) {
    this.highlightRing.visible = active;
  }

  /**
   * Main update
   * @param {number} dt - delta time in seconds
   * @param {{player: Object, linemates: Array, keys: Object|null, puck: Object}} context
   */
  update(dt, { player, linemates, keys, puck }) {
    if (keys) {
      this._updateControlled(dt, keys);
    } else {
      this._updateAutonomous(dt, player, linemates, puck);
    }

    if (this.mesh) {
      this.mesh.position.set(this.x, 0.26, this.z);
      this.mesh.rotation.y = this.angle;
    }
  }

  /**
   * Player-driven movement with WASD
   */
  _updateControlled(dt, keys) {
    let ix = 0, iz = 0;
    if (keys.w) iz -= 1;
    if (keys.s) iz += 1;
    if (keys.a) ix -= 1;
    if (keys.d) ix += 1;

    const mag = Math.hypot(ix, iz);
    if (mag > 0) { ix /= mag; iz /= mag; }

    this.vx = ix * 5.2;
    this.vz = iz * 5.2;

    if (mag > 0) {
      this.fx = ix;
      this.fz = iz;
      this.angle = Math.atan2(ix, iz);
    }

    this.x += this.vx * dt;
    this.z += this.vz * dt;
    resolveWalls(this);
  }

  /**
   * Autonomous movement with flocking behavior
   * @param {number} dt
   * @param {Object} player
   * @param {Array}  linemates
   * @param {Object} puck
   */
  _updateAutonomous(dt, player, linemates, puck) {
    const SPRINT_STRENGTH = 30.0;
    const FORM_STRENGTH   = 20.0;
    const SEP_STRENGTH    = 12.0;
    const SEP_PLAYER_R    = 2.8;
    const SEP_MATE_R      = 2.2;
    const DRAG            = 4.0;
    const MAX_SPEED       = 5.2;
    const LEAD_DIST       = 3.5;
    const TRAIL_DIST      = 3.0;

    let targetX, targetZ;

    const carrier = linemates.find(lm => lm !== this && lm === puck.holder);

    if (carrier) {
      const others = linemates.filter(lm => lm !== carrier);

      const myDot   = (this.x - carrier.x) * carrier.fx + (this.z - carrier.z) * carrier.fz;
      const peer    = others.find(lm => lm !== this);
      const peerDot = peer
        ? (peer.x - carrier.x) * carrier.fx + (peer.z - carrier.z) * carrier.fz
        : -Infinity;

      const isLead = myDot >= peerDot;

      if (isLead) {
        targetX = carrier.x + carrier.fx * LEAD_DIST;
        targetZ = carrier.z + carrier.fz * LEAD_DIST;
      } else {
        targetX = carrier.x - carrier.fx * TRAIL_DIST;
        targetZ = carrier.z - carrier.fz * TRAIL_DIST;
      }
    } else if (puck.holder === player) {
      const peer    = linemates.find(lm => lm !== this);
      const myDot   = (this.x - player.x) * player.fx + (this.z - player.z) * player.fz;
      const peerDot = peer
        ? (peer.x - player.x) * player.fx + (peer.z - player.z) * player.fz
        : -Infinity;

      const isLead = myDot >= peerDot;

      if (isLead) {
        targetX = player.x + player.fx * LEAD_DIST;
        targetZ = player.z + player.fz * LEAD_DIST;
      } else {
        targetX = player.x - player.fx * TRAIL_DIST;
        targetZ = player.z - player.fz * TRAIL_DIST;
      }
    } else {
      targetX = puck.x;
      targetZ = puck.z;
    }

    let ax = 0, az = 0;
    {
      const dx = targetX - this.x;
      const dz = targetZ - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05) {
        if (carrier) {
          const weight = Math.min(dist / 2.0, 1.0);
          ax += (dx / dist) * FORM_STRENGTH * weight;
          az += (dz / dist) * FORM_STRENGTH * weight;
        } else {
          ax += (dx / dist) * SPRINT_STRENGTH;
          az += (dz / dist) * SPRINT_STRENGTH;
        }
      }
    }

    {
      const dx = this.x - player.x;
      const dz = this.z - player.z;
      const dist = Math.hypot(dx, dz);
      if (dist < SEP_PLAYER_R && dist > 1e-4) {
        const grade = 1.0 - dist / SEP_PLAYER_R;
        ax += (dx / dist) * SEP_STRENGTH * grade;
        az += (dz / dist) * SEP_STRENGTH * grade;
      }
    }

    for (const other of linemates) {
      if (other === this) continue;
      const dx = this.x - other.x;
      const dz = this.z - other.z;
      const dist = Math.hypot(dx, dz);
      if (dist < SEP_MATE_R && dist > 1e-4) {
        const grade = 1.0 - dist / SEP_MATE_R;
        ax += (dx / dist) * SEP_STRENGTH * grade;
        az += (dz / dist) * SEP_STRENGTH * grade;
      }
    }

    this.vx = this.vx * (1.0 - DRAG * dt) + ax * dt;
    this.vz = this.vz * (1.0 - DRAG * dt) + az * dt;

    const spd = Math.hypot(this.vx, this.vz);
    if (spd > MAX_SPEED) {
      this.vx = (this.vx / spd) * MAX_SPEED;
      this.vz = (this.vz / spd) * MAX_SPEED;
    }

    this.x += this.vx * dt;
    this.z += this.vz * dt;
    resolveWalls(this);

    if (spd > 0.1) {
      this.fx = this.vx / spd;
      this.fz = this.vz / spd;
      this.angle = Math.atan2(this.vx, this.vz);
    }
  }
}
