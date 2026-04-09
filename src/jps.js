// jps.js - Jump Point Search pathfinding algorithm
// COMP 4300 - Dungeon Hockey
// Algorithm Category: Pathfinding (JPS is an optimization of A*)

import { isWall, tileToWorld, ROWS, COLS } from './tilemap.js';

/**
 * Jump Point Search pathfinding algorithm
 * JPS is superior to A* on uniform-cost grids because it prunes symmetric paths.
 * In open rooms (common in this dungeon generator), there are many equivalent paths
 * between two points. JPS identifies "jump points" where the search direction must
 * change, skipping all intermediate symmetric nodes. This dramatically reduces
 * the number of nodes expanded compared to A*.
 *
 * @param {number} sr - start tile row
 * @param {number} sc - start tile column
 * @param {number} gr - goal tile row
 * @param {number} gc - goal tile column
 * @returns {Array<{x: number, z: number}>} array of world positions forming the path, or [] if no path exists
 */
export function jps(sr, sc, gr, gc) {
  // Validate inputs
  if (isWall(sr, sc) || isWall(gr, gc)) {
    return [];
  }

  // A* with JPS optimization
  const openList = new MinHeap();
  const closedSet = new Set();

  const startNode = {
    r: sr,
    c: sc,
    g: 0,
    h: heuristic(sr, sc, gr, gc),
    f: heuristic(sr, sc, gr, gc),
    parent: null
  };

  openList.push(startNode, startNode.f);

  let iterations = 0;
  const MAX_ITERATIONS = 800;

  while (!openList.isEmpty() && iterations < MAX_ITERATIONS) {
    iterations++;

    const current = openList.pop();
    const key = `${current.r},${current.c}`;

    // Goal reached
    if (current.r === gr && current.c === gc) {
      return reconstructPath(current, sr, sc);
    }

    closedSet.add(key);

    // Get jump point successors
    const jumps = successors(current, gr, gc);

    for (const jump of jumps) {
      const jumpKey = `${jump.r},${jump.c}`;
      if (closedSet.has(jumpKey)) continue;

      // Calculate cost
      const dr = Math.abs(jump.r - current.r);
      const dc = Math.abs(jump.c - current.c);
      const cost = Math.sqrt(dr * dr + dc * dc); // Euclidean distance
      const g = current.g + cost;
      const h = heuristic(jump.r, jump.c, gr, gc);
      const f = g + h;

      const jumpNode = {
        r: jump.r,
        c: jump.c,
        g: g,
        h: h,
        f: f,
        parent: current
      };

      openList.push(jumpNode, f);
    }
  }

  // No path found
  return [];
}

/**
 * Manhattan distance heuristic
 * @param {number} r - current row
 * @param {number} c - current column
 * @param {number} gr - goal row
 * @param {number} gc - goal column
 * @returns {number} heuristic cost
 */
function heuristic(r, c, gr, gc) {
  return Math.abs(r - gr) + Math.abs(c - gc);
}

/**
 * Finds all jump point successors from a given node
 * @param {Object} node - current node with {r, c, parent}
 * @param {number} gr - goal row
 * @param {number} gc - goal column
 * @returns {Array<{r: number, c: number}>} array of jump points
 */
function successors(node, gr, gc) {
  const directions = getDirections(node);
  const jumps = [];

  for (const [dr, dc] of directions) {
    const jumpPoint = jump(node.r, node.c, dr, dc, gr, gc);
    if (jumpPoint) {
      jumps.push({ r: jumpPoint[0], c: jumpPoint[1] });
    }
  }

  return jumps;
}

/**
 * Jump recursively in a given direction until a jump point is found
 * A jump point is a tile where:
 * - The goal is reached
 * - A forced neighbour exists (wall blocks natural path, creating asymmetry)
 * - A diagonal move finds a jump point in its cardinal components
 *
 * @param {number} r - current row
 * @param {number} c - current column
 * @param {number} dr - row direction (-1, 0, or 1)
 * @param {number} dc - column direction (-1, 0, or 1)
 * @param {number} gr - goal row
 * @param {number} gc - goal column
 * @returns {[number, number] | null} [row, col] of jump point, or null if none found
 */
function jump(r, c, dr, dc, gr, gc) {
  const nr = r + dr;
  const nc = c + dc;

  // Hit a wall or boundary
  if (isWall(nr, nc)) return null;

  // Reached the goal
  if (nr === gr && nc === gc) return [nr, nc];

  // Diagonal move
  if (dr !== 0 && dc !== 0) {
    // Check for forced neighbours
    // Forced neighbour above-left: wall blocks diagonal, so vertical then horizontal is forced
    if (!isWall(nr - dr, nc) && isWall(nr - dr, nc - dc)) {
      // Wall at (nr-dr, nc-dc) blocks natural diagonal path from parent
      // Neighbour at (nr-dr, nc) can only be reached optimally via this node
      return [nr, nc];
    }

    // Forced neighbour above-right: wall blocks diagonal, so horizontal then vertical is forced
    if (!isWall(nr, nc - dc) && isWall(nr - dr, nc - dc)) {
      // Wall at (nr-dr, nc-dc) blocks natural diagonal path from parent
      // Neighbour at (nr, nc-dc) can only be reached optimally via this node
      return [nr, nc];
    }

    // Recurse into cardinal components
    // If either horizontal or vertical direction has a jump point, this diagonal tile is a jump point
    if (jump(nr, nc, dr, 0, gr, gc) !== null) return [nr, nc];
    if (jump(nr, nc, 0, dc, gr, gc) !== null) return [nr, nc];
  }

  // Horizontal move (moving left or right)
  else if (dr === 0) {
    // Forced neighbour above: wall blocks direct path, must go through this node
    if (!isWall(nr - 1, nc) && isWall(nr - 1, nc - dc)) {
      // Wall at (nr-1, nc-dc) blocks diagonal approach from parent
      // Neighbour at (nr-1, nc) can only be reached optimally by going horizontal first
      return [nr, nc];
    }

    // Forced neighbour below: wall blocks direct path, must go through this node
    if (!isWall(nr + 1, nc) && isWall(nr + 1, nc - dc)) {
      // Wall at (nr+1, nc-dc) blocks diagonal approach from parent
      // Neighbour at (nr+1, nc) can only be reached optimally by going horizontal first
      return [nr, nc];
    }
  }

  // Vertical move (moving up or down)
  else if (dc === 0) {
    // Forced neighbour left: wall blocks direct path, must go through this node
    if (!isWall(nr, nc - 1) && isWall(nr - dr, nc - 1)) {
      // Wall at (nr-dr, nc-1) blocks diagonal approach from parent
      // Neighbour at (nr, nc-1) can only be reached optimally by going vertical first
      return [nr, nc];
    }

    // Forced neighbour right: wall blocks direct path, must go through this node
    if (!isWall(nr, nc + 1) && isWall(nr - dr, nc + 1)) {
      // Wall at (nr-dr, nc+1) blocks diagonal approach from parent
      // Neighbour at (nr, nc+1) can only be reached optimally by going vertical first
      return [nr, nc];
    }
  }

  // No jump point found yet, continue jumping in the same direction
  return jump(nr, nc, dr, dc, gr, gc);
}

/**
 * Determines which directions to search from a node based on JPS pruning rules
 * @param {Object} node - current node with {r, c, parent}
 * @returns {Array<[number, number]>} array of [dr, dc] direction pairs
 */
function getDirections(node) {
  // No parent: initial node, search all 8 directions
  if (!node.parent) {
    return [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
  }

  // Compute direction from parent
  const dr = sign(node.r - node.parent.r);
  const dc = sign(node.c - node.parent.c);

  const directions = [];
  const nr = node.r;
  const nc = node.c;

  // Diagonal movement
  if (dr !== 0 && dc !== 0) {
    // Natural neighbours: continue in same direction and cardinal components
    directions.push([dr, dc]); // Continue diagonal
    directions.push([dr, 0]);  // Vertical component
    directions.push([0, dc]);  // Horizontal component

    // Forced neighbours from diagonal movement
    // If wall blocks one diagonal direction, we must search the perpendicular
    if (isWall(nr - dr, nc) && !isWall(nr, nc)) {
      directions.push([-dr, dc]); // Forced horizontal turn
    }
    if (isWall(nr, nc - dc) && !isWall(nr, nc)) {
      directions.push([dr, -dc]); // Forced vertical turn
    }
  }

  // Horizontal movement
  else if (dr === 0) {
    // Natural neighbour: continue in same direction
    directions.push([0, dc]);

    // Forced neighbours from horizontal movement
    // Wall above-behind forces diagonal search above-forward
    if (isWall(nr - 1, nc - dc) && !isWall(nr - 1, nc)) {
      directions.push([-1, dc]);
    }
    // Wall below-behind forces diagonal search below-forward
    if (isWall(nr + 1, nc - dc) && !isWall(nr + 1, nc)) {
      directions.push([1, dc]);
    }
  }

  // Vertical movement
  else if (dc === 0) {
    // Natural neighbour: continue in same direction
    directions.push([dr, 0]);

    // Forced neighbours from vertical movement
    // Wall left-behind forces diagonal search left-forward
    if (isWall(nr - dr, nc - 1) && !isWall(nr, nc - 1)) {
      directions.push([dr, -1]);
    }
    // Wall right-behind forces diagonal search right-forward
    if (isWall(nr - dr, nc + 1) && !isWall(nr, nc + 1)) {
      directions.push([dr, 1]);
    }
  }

  return directions;
}

/**
 * Returns -1, 0, or 1 based on sign of number
 * @param {number} n - number
 * @returns {number} -1, 0, or 1
 */
function sign(n) {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

/**
 * Reconstructs the path from goal back to start, then fills gaps between jump points
 * @param {Object} goalNode - the goal node with parent pointers
 * @param {number} sr - start row
 * @param {number} sc - start column
 * @returns {Array<{x: number, z: number}>} array of world positions forming complete path
 */
function reconstructPath(goalNode, sr, sc) {
  // Walk back through parent pointers to get jump points
  const jumpPoints = [];
  let current = goalNode;

  while (current) {
    jumpPoints.unshift({ r: current.r, c: current.c });
    current = current.parent;
  }

  // Fill gaps between consecutive jump points
  const completePath = [];

  for (let i = 0; i < jumpPoints.length - 1; i++) {
    const start = jumpPoints[i];
    const end = jumpPoints[i + 1];

    // Walk from start to end tile by tile
    let r = start.r;
    let c = start.c;

    const dr = sign(end.r - start.r);
    const dc = sign(end.c - start.c);

    // Add intermediate tiles
    while (r !== end.r || c !== end.c) {
      completePath.push({ r, c });
      r += dr;
      c += dc;
    }
  }

  // Add final jump point
  if (jumpPoints.length > 0) {
    const last = jumpPoints[jumpPoints.length - 1];
    completePath.push({ r: last.r, c: last.c });
  }

  // Remove start tile (entity is already there)
  if (completePath.length > 0 && completePath[0].r === sr && completePath[0].c === sc) {
    completePath.shift();
  }

  // Convert to world positions
  return completePath.map(tile => tileToWorld(tile.r, tile.c));
}

/**
 * Min-heap priority queue for A* open list
 */
class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(node, priority) {
    this.heap.push({ node, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop().node;

    const min = this.heap[0].node;
    this.heap[0] = this.heap.pop();
    this.bubbleDown(0);
    return min;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  bubbleUp(idx) {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.heap[idx].priority >= this.heap[parentIdx].priority) break;

      [this.heap[idx], this.heap[parentIdx]] = [this.heap[parentIdx], this.heap[idx]];
      idx = parentIdx;
    }
  }

  bubbleDown(idx) {
    while (true) {
      const leftIdx = 2 * idx + 1;
      const rightIdx = 2 * idx + 2;
      let smallest = idx;

      if (leftIdx < this.heap.length && this.heap[leftIdx].priority < this.heap[smallest].priority) {
        smallest = leftIdx;
      }
      if (rightIdx < this.heap.length && this.heap[rightIdx].priority < this.heap[smallest].priority) {
        smallest = rightIdx;
      }

      if (smallest === idx) break;

      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
}
