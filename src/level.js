// level.js - 3D level building from tilemap
// COMP 4300 - Dungeon Hockey

import * as THREE from 'three';
import { generateDungeon, getSpawnRoom, getGoalRoom } from './dungeon.js';
import { tilemap, COLS, ROWS, TILE, tileToWorld } from './tilemap.js';

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

  // 1. Place floor
  const floorWidth = COLS * TILE;
  const floorHeight = ROWS * TILE;
  const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorHeight);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x152535,      // Slightly brighter blue-gray for better visibility
    roughness: 0.8,
    metalness: 0.2
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  levelGroup.add(floor);

  // Add grid helper
  const gridHelper = new THREE.GridHelper(
    Math.max(floorWidth, floorHeight),
    Math.max(COLS, ROWS),
    0x112233,
    0x0a1825
  );
  gridHelper.position.y = 0.01;
  levelGroup.add(gridHelper);

  // 2. Place walls - use shared geometry and material for efficiency
  const wallGeometry = new THREE.BoxGeometry(TILE, 1.2, TILE);
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x2d4a5e,      // Medium blue-gray (much more visible)
    emissive: 0x1a3344,   // Darker blue emissive glow
    emissiveIntensity: 0.4,
    roughness: 0.8,
    metalness: 0.2
  });

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tilemap[r][c] === 1) {
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        const pos = tileToWorld(r, c);
        wall.position.set(pos.x, 0.6, pos.z);
        levelGroup.add(wall);
      }
    }
  }

  // 3. Place goal at center of last room
  const goalRoom = getGoalRoom();
  const goalPos = tileToWorld(goalRoom.cy, goalRoom.cx);

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

  // Goal net (wireframe box)
  const goalNetGeometry = new THREE.BoxGeometry(TILE * 1.2, 1.5, TILE * 1.2);
  const goalNetMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    wireframe: true
  });
  const goalNet = new THREE.Mesh(goalNetGeometry, goalNetMaterial);
  goalNet.position.set(goalPos.x, 0.75, goalPos.z);
  levelGroup.add(goalNet);

  // Goal glow light
  const goalGlow = new THREE.PointLight(0x00ff88, 3, 12);
  goalGlow.position.set(goalPos.x, 2, goalPos.z);
  levelGroup.add(goalGlow);

  // 4. Add torch lights in intermediate rooms
  for (let i = 1; i < rooms.length - 1; i++) {
    const room = rooms[i];
    const roomCenter = tileToWorld(room.cy, room.cx);

    const torchColors = [0xff8833, 0xff6622, 0xff7722];
    const torchColor = torchColors[i % torchColors.length];

    const torch = new THREE.PointLight(torchColor, 2, 10);
    torch.position.set(roomCenter.x, 2, roomCenter.z);
    levelGroup.add(torch);
  }

  // 5. Calculate spawn position (center of first room)
  const spawnRoom = getSpawnRoom();
  const spawnWorld = tileToWorld(spawnRoom.cy, spawnRoom.cx);

  return { spawnWorld, goalPos };
}
