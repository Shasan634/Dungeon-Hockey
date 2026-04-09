// level.js - 3D level building from tilemap
// COMP 4300 - Dungeon Hockey

import * as THREE from 'three';
import { generateDungeon, getSpawnRoom, getGoalRoom } from './dungeon.js';
import { tilemap, COLS, ROWS, TILE, tileToWorld } from './tilemap.js';

/**
 * Helper: Build goal with posts, crossbar, net, and animated glow
 * @param {THREE.Group} levelGroup - group to add goal to
 * @param {{x: number, z: number}} goalPos - goal position in world coordinates
 * @returns {THREE.PointLight} goal glow light for animation
 */
function _buildGoal(levelGroup, goalPos) {
  // Goal floor marker
  const goalFloorGeometry = new THREE.PlaneGeometry(TILE * 1.5, TILE * 1.5);
  const goalFloorMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff88,
    emissiveIntensity: 2.0
  });
  const goalFloor = new THREE.Mesh(goalFloorGeometry, goalFloorMaterial);
  goalFloor.rotation.x = -Math.PI / 2;
  goalFloor.position.set(goalPos.x, 0.02, goalPos.z);
  levelGroup.add(goalFloor);

  // Simplified goal - just wireframe box (removed posts/crossbar for performance)
  const netGeometry = new THREE.BoxGeometry(2.5, 1.2, 1.0);
  const netMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    wireframe: true,
    opacity: 0.6,
    transparent: true
  });
  const net = new THREE.Mesh(netGeometry, netMaterial);
  net.position.set(goalPos.x, 0.6, goalPos.z);
  levelGroup.add(net);

  // Goal glow light (will be animated)
  const goalGlow = new THREE.PointLight(0x00ff88, 3, 12);
  goalGlow.position.set(goalPos.x, 2, goalPos.z);
  levelGroup.add(goalGlow);

  return goalGlow;
}

/**
 * Helper: Build torches with mesh and animated flames
 * @param {THREE.Group} levelGroup - group to add torches to
 * @param {Array} rooms - array of room objects from dungeon generation
 * @returns {Array} array of flame objects with {mesh, light, baseY, offset} for animation
 */
function _buildTorches(levelGroup, rooms) {
  const torchFlames = [];

  // Build torches in intermediate rooms (skip first and last)
  for (let i = 1; i < rooms.length - 1; i++) {
    const room = rooms[i];
    const roomCenter = tileToWorld(room.cy, room.cx);

    const torchColors = [0xff8833, 0xff6622, 0xff7722];
    const torchColor = torchColors[i % torchColors.length];

    // Simplified torch - just flame sphere (no base/bracket for performance)
    const flameGeometry = new THREE.SphereGeometry(0.3, 6, 6); // Reduced segments
    const flameMaterial = new THREE.MeshStandardMaterial({
      color: torchColor,
      emissive: torchColor,
      emissiveIntensity: 2.0
    });
    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.position.set(roomCenter.x, 1.5, roomCenter.z);
    levelGroup.add(flame);

    // Point light for illumination
    const light = new THREE.PointLight(torchColor, 2, 10);
    light.position.set(roomCenter.x, 1.5, roomCenter.z);
    levelGroup.add(light);

    // Store for animation
    torchFlames.push({
      mesh: flame,
      light: light,
      baseY: 1.5,
      offset: i * 1.7  // Phase offset for variety
    });
  }

  return torchFlames;
}

/**
 * Helper: Build walls with alternating materials, caps, and rim lights
 * @param {THREE.Group} levelGroup - group to add walls to
 */
function _buildWalls(levelGroup) {
  const wallGeometry = new THREE.BoxGeometry(TILE, 1.2, TILE);

  // Two alternating wall materials
  const wallMat1 = new THREE.MeshStandardMaterial({
    color: 0x2d4a5e,
    emissive: 0x1a3344,
    emissiveIntensity: 0.4,
    roughness: 0.8,
    metalness: 0.2
  });

  const wallMat2 = new THREE.MeshStandardMaterial({
    color: 0x334d62,
    emissive: 0x1e3a4a,
    emissiveIntensity: 0.35,
    roughness: 0.75,
    metalness: 0.25
  });

  let rimLightCount = 0;
  const maxRimLights = 10; // Reduced from 20

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tilemap[r][c] === 1) {
        const pos = tileToWorld(r, c);

        // Alternating wall material based on checkerboard pattern
        const wallMat = ((r + c) % 2 === 0) ? wallMat1 : wallMat2;
        const wall = new THREE.Mesh(wallGeometry, wallMat);
        wall.position.set(pos.x, 0.6, pos.z);
        levelGroup.add(wall);

        // Rim light on some walls (cap at 10 for performance, no caps to reduce geometry)
        if (rimLightCount < maxRimLights && (r + c) % 7 === 0) {
          const rimLight = new THREE.PointLight(0x4a7a9f, 0.4, 3.5);
          rimLight.position.set(pos.x, 1.4, pos.z);
          levelGroup.add(rimLight);
          rimLightCount++;
        }
      }
    }
  }
}

/**
 * Helper: Build ice floor with segmented geometry and faceoff circles
 * @param {THREE.Group} levelGroup - group to add floor to
 * @param {Array} rooms - array of room objects from dungeon generation
 */
function _buildFloor(levelGroup, rooms) {
  const floorWidth = COLS * TILE + 1;
  const floorHeight = ROWS * TILE + 1;

  // Segmented ice floor for visual detail (reduced segments for performance)
  const floorGeometry = new THREE.PlaneGeometry(
    floorWidth,
    floorHeight,
    Math.min(COLS, 30),
    Math.min(ROWS, 30)
  );
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x0d1e30,
    roughness: 0.85,
    metalness: 0.1
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  levelGroup.add(floor);

  // Single grid helper (removed dual grids for performance)
  const gridHelper1 = new THREE.GridHelper(
    Math.max(floorWidth, floorHeight),
    Math.min(Math.max(COLS, ROWS), 25), // Cap grid divisions
    0x0a2535,
    0x061825
  );
  gridHelper1.position.y = 0.01;
  levelGroup.add(gridHelper1);

  // Faceoff circles at room centers (skip first and last room)
  for (let i = 1; i < rooms.length - 1; i++) {
    const room = rooms[i];
    const roomCenter = tileToWorld(room.cy, room.cx);

    const circleGeometry = new THREE.RingGeometry(1.2, 1.4, 16); // Reduced segments
    const circleMaterial = new THREE.MeshBasicMaterial({
      color: 0x224466,
      side: THREE.DoubleSide
    });
    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(roomCenter.x, 0.03, roomCenter.z);
    levelGroup.add(circle);
  }
}

/**
 * Builds the 3D level from generated dungeon data
 * @param {THREE.Scene} scene - Three.js scene
 * @param {THREE.Group} levelGroup - group to add level geometry to
 * @returns {{spawnWorld: {x, z}, goalPos: {x, z}}} spawn and goal positions
 * Mutates: levelGroup (clears and rebuilds)
 */
export function buildLevel(scene, levelGroup) {
  // Clear previous level
  levelGroup.clear();

  // Generate dungeon
  const rooms = generateDungeon();

  // 1. Build ice floor
  _buildFloor(levelGroup, rooms);

  // 2. Build walls with alternating materials, caps, and rim lights
  _buildWalls(levelGroup);

  // 3. Build goal at center of last room
  const goalRoom = getGoalRoom();
  const goalPos = tileToWorld(goalRoom.cy, goalRoom.cx);
  const goalGlow = _buildGoal(levelGroup, goalPos);

  // 4. Build torches in intermediate rooms with animated flames
  const torchFlames = _buildTorches(levelGroup, rooms);

  // 5. Calculate spawn position (center of first room)
  const spawnRoom = getSpawnRoom();
  const spawnWorld = tileToWorld(spawnRoom.cy, spawnRoom.cx);

  return { spawnWorld, goalPos, torchFlames, goalGlow };
}
