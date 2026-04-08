// entities.js - Placeholder classes for Defender and Linemate
// COMP 4300 - Dungeon Hockey
// To be filled in during Phases 3-6

/**
 * Defender entity - will implement pathfinding and behavior tree in Phase 3-4
 */
export class Defender {
  constructor(x, z, levelGroup) {
    this.x = x;
    this.z = z;
    this.radius = 0.4;
  }

  update(dt, all) {
    // Phase 3: Jump Point Search pathfinding
    // Phase 4: Behaviour tree
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
