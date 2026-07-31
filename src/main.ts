import './ui/styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GameEngine } from './game/engine';
import { Picker } from './input/picker';
import { BoardView } from './render/BoardView';
import { Hud } from './ui/hud';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const hudEl = document.querySelector<HTMLElement>('#hud')!;
const lobbyEl = document.querySelector<HTMLElement>('#lobby')!;

const engine = new GameEngine();
const boardView = new BoardView();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1f2e);
scene.fog = new THREE.Fog(0x0c1f2e, 18, 36);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 14, 14);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.46;
controls.minDistance = 8;
controls.maxDistance = 24;
controls.update();

const hemi = new THREE.HemisphereLight(0xb8d4e8, 0x3d4a32, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff0d6, 1.35);
sun.position.set(8, 16, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 40;
sun.shadow.camera.left = -12;
sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -12;
scene.add(sun);

const fill = new THREE.DirectionalLight(0x7eb6d9, 0.25);
fill.position.set(-6, 4, -8);
scene.add(fill);

scene.add(boardView.root);

const picker = new Picker(camera, canvas);
new Hud(hudEl, lobbyEl, engine);

let boardBuilt = false;

function syncView(): void {
  const snap = engine.snapshot();
  if (snap.phase === 'lobby') {
    boardBuilt = false;
    return;
  }
  if (!boardBuilt) {
    boardView.build(snap.board);
    boardBuilt = true;
  } else {
    boardView.syncPieces(snap.board);
  }
  boardView.syncHighlights(snap.legalVertices, snap.legalEdges, snap.legalHexes);
}

engine.subscribe(syncView);

canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  const snap = engine.snapshot();
  if (snap.phase === 'lobby' || snap.phase === 'gameOver') return;

  const hit = picker.pick(ev.clientX, ev.clientY, boardView.getPickables());
  if (!hit) return;

  if (hit.kind === 'vertex') engine.clickVertex(hit.id);
  else if (hit.kind === 'edge') engine.clickEdge(hit.id);
  else if (hit.kind === 'hex') engine.clickHex(hit.id);
});

function onResize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

const clock = new THREE.Clock();
function animate(): void {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  controls.update();
  sun.position.x = Math.cos(t * 0.05) * 8;
  sun.position.z = Math.sin(t * 0.05) * 6 + 2;
  renderer.render(scene, camera);
}
animate();
