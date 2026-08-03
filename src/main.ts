import './ui/styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { boardRadiusWorld } from './game/board';
import { GameEngine } from './game/engine';
import { Picker } from './input/picker';
import { TimeOfDayController, type TimeOfDayMode } from './render/atmosphere';
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
const dayCycle = new TimeOfDayController(initialConfig.timeOfDay as TimeOfDayMode);
dayCycle.setDayLength(initialConfig.dayLengthSec);
dayCycle.setTransitionSec(initialConfig.dayTransitionSec);

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
let sunAnchor = 10;
let fogNear = 28;
let fogFar = 70;
let lastTimeOfDay = initialConfig.timeOfDay;
let styleLive = initialConfig;

function applyStyle(config: StyleConfig): void {
  styleLive = config;
  sky.applyConfig(config);
  boardView.applyStyleConfig(config);

  dayCycle.setDayLength(config.dayLengthSec);
  dayCycle.setTransitionSec(config.dayTransitionSec);
  if (config.timeOfDay !== lastTimeOfDay) {
    lastTimeOfDay = config.timeOfDay;
    dayCycle.setMode(config.timeOfDay as TimeOfDayMode);
  }
}

function applyAtmosphereFrame(): void {
  const atm = dayCycle.getSnapshot();
  const dir = dayCycle.getCelestialDirection();

  sky.applyAtmosphere(atm);
  sky.setSunDirection(dir);
  boardView.applyAtmosphere(atm);
  boardView.setSunDirection(dir);

  // Craft sliders act as multipliers relative to afternoon defaults.
  const sunMul = styleLive.sunIntensity / 1.45;
  const hemiMul = styleLive.hemiIntensity / 0.95;
  const expMul = styleLive.exposure / 1.15;

  sun.color.copy(atm.sunColor);
  sun.intensity = atm.sunIntensity * sunMul;
  sun.position.copy(dir).multiplyScalar(sunAnchor);

  hemi.color.copy(atm.hemiSky);
  hemi.groundColor.copy(atm.hemiGround);
  hemi.intensity = atm.hemiIntensity * hemiMul;

  fill.color.copy(atm.fillColor);
  fill.intensity = atm.fillIntensity;
  fill.position.copy(dir).multiplyScalar(-sunAnchor * 0.55);
  fill.position.y = Math.abs(fill.position.y) * 0.4 + 2;

  renderer.toneMappingExposure = atm.exposure * expMul;

  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.copy(atm.fogColor);
    scene.fog.near = fogNear;
    scene.fog.far = fogFar;
  }
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

  fogNear = dist * 1.8;
  fogFar = dist * 5.8;
  scene.fog = new THREE.Fog(dayCycle.getSnapshot().fogColor, fogNear, fogFar);
  sky.resize(r);

  sunAnchor = Math.max(8, r * 1.1);
  const shadowSpan = r + 4;
  sun.shadow.camera.far = shadowSpan * 4;
  sun.shadow.camera.left = -shadowSpan;
  sun.shadow.camera.right = shadowSpan;
  sun.shadow.camera.top = shadowSpan;
  sun.shadow.camera.bottom = -shadowSpan;
  sun.shadow.camera.updateProjectionMatrix();
  applyAtmosphereFrame();
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
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  controls.update();
  dayCycle.update(dt);
  applyAtmosphereFrame();
  boardView.update(t);
  sky.update(t);
  renderer.render(scene, camera);
}
animate();
