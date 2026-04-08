// scene.js - Three.js scene, camera, renderer, and lighting setup
// COMP 4300 - Dungeon Hockey

import * as THREE from 'three';

const VIEW = 14;

export let scene, camera, renderer, levelGroup;

/**
 * Initializes the Three.js scene, camera, renderer, and lighting
 * @returns {Object} {scene, camera, renderer, levelGroup}
 */
export function initScene() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1218);  // Slightly lighter background for better visibility

  // Create orthographic camera for top-down view
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera(
    -VIEW * aspect,
    VIEW * aspect,
    VIEW,
    -VIEW,
    0.1,
    1000
  );
  camera.position.set(0, 40, 0);
  camera.rotation.x = -Math.PI / 2;

  // Create levelGroup - all game objects go here for easy clearing
  levelGroup = new THREE.Group();
  scene.add(levelGroup);

  // Ambient light for overall illumination (brighter for better visibility)
  const ambientLight = new THREE.AmbientLight(0x556677, 0.6);
  scene.add(ambientLight);

  // Directional light from above
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(0, 50, 0);
  scene.add(directionalLight);

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  return { scene, camera, renderer, levelGroup };
}

/**
 * Handles window resize events
 * Updates camera frustum and renderer size
 */
function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;

  camera.left = -VIEW * aspect;
  camera.right = VIEW * aspect;
  camera.top = VIEW;
  camera.bottom = -VIEW;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Renders the scene
 */
export function render() {
  renderer.render(scene, camera);
}
