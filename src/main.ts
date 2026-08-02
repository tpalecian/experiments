import './ui/styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { boardRadiusWorld } from './game/board';
import { GameEngine } from './game/engine';
import { Picker } from './input/picker';
import { BoardView } from './render/BoardView';
import { SkyDome } from './render/sky';
import { STYLE } from './render/style';
import type { StyleConfig } from './render/styleConfig';
import { StyleConfigurator } from './ui/configurator';
import { Hud } from './ui/hud';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const hudEl = document.querySelector<HTMLElement>('#hud')!;
const lobbyEl = document.querySelector<HTMLElement>('#lobby')!;
const configRoot = document.querySelector<HTMLElement>('#style-config-root')!;

const engine = new GameEngine();
const configurator = new StyleConfigurator(configRoot);
const initialConfig = configurator.getConfig();

const boardView = new BoardView();
boardView.applyStyleConfig(initialConfig);
const sky = new SkyDome(initialConfig);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = initialConfig.exposure;

const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.Fog(STYLE.fog, 28, 70);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 14, 14);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 8;
controls.maxDistance = 24;
controls.update();

const hemi = new THREE.HemisphereLight(STYLE.ambientSky, STYLE.ambientGround, initialConfig.hemiIntensity);
scene.add(hemi);

const sun = new THREE.DirectionalLight(STYLE.sun, initialConfig.sunIntensity);
sun.position.set(8, 16, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 40;
sun.shadow.camera.left = -12;
sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -12;
sun.shadow.bias = -0.0008;
scene.add(sun);

const fill = new THREE.DirectionalLight(STYLE.fill, 0.35);
fill.position.set(-6, 4, -8);
scene.add(fill);

scene.add(sky.group);
scene.add(boardView.root);

const picker = new Picker(camera, canvas);
new Hud(hudEl, lobbyEl, engine);

let boardBuilt = false;

function applyStyle(config: StyleConfig): void {
  sky.applyConfig(config);
  boardView.applyStyleConfig(config);
  renderer.toneMappingExposure = config.exposure;
  sun.intensity = config.sunIntensity;
  hemi.intensity = config.hemiIntensity;
}

let styleApplyTimer = 0;
function queueStyleApply(config: StyleConfig): void {
  window.clearTimeout(styleApplyTimer);
  styleApplyTimer = window.setTimeout(() => applyStyle(config), 40);
}
configurator.subscribe(queueStyleApply);

function frameCamera(rings: number): void {
  const r = boardRadiusWorld(rings);
  const dist = Math.max(12, r * 2.35);
  const height = Math.max(10, r * 1.85);
  camera.position.set(0, height, dist);
  camera.far = Math.max(200, dist * 12);
  camera.updateProjectionMatrix();
  controls.minDistance = Math.max(6, r * 0.9);
  controls.maxDistance = Math.max(24, r * 4.2);
  controls.target.set(0, 0, 0);
  controls.update();

  scene.fog = new THREE.Fog(STYLE.fog, dist * 1.8, dist * 5.8);
  sky.resize(r);

  const shadowSpan = r + 4;
  sun.position.set(r * 1.2, r * 2.2, r * 0.9);
  sun.shadow.camera.far = shadowSpan * 4;
  sun.shadow.camera.left = -shadowSpan;
  sun.shadow.camera.right = shadowSpan;
  sun.shadow.camera.top = shadowSpan;
  sun.shadow.camera.bottom = -shadowSpan;
  sun.shadow.camera.updateProjectionMatrix();
  sky.setSunDirection(sun.position.clone().normalize());
}

function syncView(): void {
  const snap = engine.snapshot();
  if (snap.phase === 'lobby') {
    boardBuilt = false;
    return;
  }
  if (!boardBuilt) {
    boardView.build(snap.board);
    boardView.applyStyleConfig(configurator.getConfig());
    frameCamera(snap.board.rings);
    boardBuilt = true;
  } else {
    boardView.syncPieces(snap.board);
  }
  boardView.syncHighlights(snap.legalVertices, snap.legalEdges, snap.legalHexes);
}

engine.subscribe(syncView);

canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  // Don't place pieces while dragging style panel controls
  if ((ev.target as HTMLElement).closest?.('#style-config-root')) return;
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
  boardView.update(t);
  sky.update(t);
  const base = Math.max(8, boardRadiusWorld(engine.board.rings) * 1.1);
  sun.position.x = Math.cos(t * 0.04) * base;
  sun.position.z = Math.sin(t * 0.04) * base * 0.75 + 2;
  sky.setSunDirection(sun.position.clone().normalize());
  renderer.render(scene, camera);
}
animate();
