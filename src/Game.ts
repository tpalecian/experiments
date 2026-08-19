import * as THREE from 'three';
import { axialToWorld } from './engine/board';
import { GameEngine } from './engine/engine';
import { Picker } from './input/picker';
import { Time } from './core/Time';
import { Ticker } from './core/Ticker';
import { Viewport } from './core/Viewport';
import { Rendering } from './core/Rendering';
import { Monitoring } from './core/Monitoring';
import { TweenPlayer } from './core/tween';
import { getQualityLevel } from './core/Quality';
import { CameraRig } from './view/CameraRig';
import { Lighting } from './view/Lighting';
import { Fog } from './view/Fog';
import { TimeOfDayController, type TimeOfDayMode } from './world/Atmosphere';
import { World } from './world/World';
import { SkyDome } from './world/Sky';
import { applyWeather } from './world/Weather';
import type { StyleConfig } from './style/styleConfig';
import { StyleConfigurator } from './ui/style/configurator';
import { Hud } from './ui/hud';
import { assetLabHref } from './ui/assetLab';
import { biomeEditorHref } from './ui/biomeEditor';

/**
 * Composition root (folio Game.js) — wires engine, view, world, and UI.
 * Not a singleton; Asset Lab / Biome Editor boot separately.
 */
export class Game {
  constructor() {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    const hudEl = document.querySelector<HTMLElement>('#hud')!;
    const lobbyEl = document.querySelector<HTMLElement>('#lobby')!;
    const configRoot = document.querySelector<HTMLElement>('#style-config-root')!;

    const engine = new GameEngine();
    const configurator = new StyleConfigurator(configRoot);
    const initialConfig = configurator.getConfig();

    const world = new World();
    world.applyStyleConfig(initialConfig);
    const sky = new SkyDome(initialConfig);
    const dayCycle = new TimeOfDayController(initialConfig.timeOfDay as TimeOfDayMode);
    dayCycle.setDayLength(initialConfig.dayLengthSec);
    dayCycle.setTransitionSec(initialConfig.dayTransitionSec);

    const cameraTweens = new TweenPlayer();
    const time = new Time();
    const ticker = new Ticker();
    const rendering = new Rendering(canvas);
    const cameraRig = new CameraRig(canvas, cameraTweens);
    const lighting = new Lighting(initialConfig);
    const fog = new Fog();
    rendering.scene.fog = fog.create();
    lighting.addTo(rendering.scene);
    rendering.scene.add(sky.group);
    rendering.scene.add(world.root);

    const picker = new Picker(cameraRig.camera, canvas);
    const hud = new Hud(hudEl, lobbyEl, engine);
    hud.setAssetLabHref(assetLabHref());
    hud.setBiomeEditorHref(biomeEditorHref());

    const monitor = Monitoring.enabled() ? new Monitoring() : null;

    let boardBuilt = false;
    let lastTimeOfDay = initialConfig.timeOfDay;
    let styleLive = initialConfig;
    let lastRollKey = '';
    let lastRobberHex = '';
    const robberWorld = new THREE.Vector3();

    function applyStyle(config: StyleConfig): void {
      styleLive = config;
      sky.applyConfig(config);
      world.applyStyleConfig(config);
      dayCycle.setDayLength(config.dayLengthSec);
      dayCycle.setTransitionSec(config.dayTransitionSec);
      if (config.timeOfDay !== lastTimeOfDay) {
        lastTimeOfDay = config.timeOfDay;
        dayCycle.setMode(config.timeOfDay as TimeOfDayMode);
      }
    }

    function applyAtmosphereFrame(): void {
      const raw = dayCycle.getSnapshot();
      const atm = applyWeather(raw, styleLive.weather);
      const dir = dayCycle.getCelestialDirection();
      const expMul = styleLive.exposure / 1.15;

      sky.applyAtmosphere(atm);
      sky.setSunDirection(dir);
      world.applyAtmosphere(atm);
      world.setSunDirection(dir);
      lighting.applyAtmosphere(atm, styleLive);
      lighting.setCelestialDirection(dir);
      rendering.setExposure(atm.exposure * expMul);
      fog.apply(rendering.scene, atm);
    }

    let styleApplyTimer = 0;
    function queueStyleApply(config: StyleConfig): void {
      window.clearTimeout(styleApplyTimer);
      styleApplyTimer = window.setTimeout(() => applyStyle(config), 40);
    }
    configurator.subscribe(queueStyleApply);

    function frameCamera(rings: number): void {
      const framed = cameraRig.frameBoard(rings);
      fog.setRange(framed.fogNear, framed.fogFar);
      rendering.scene.fog = new THREE.Fog(dayCycle.getSnapshot().fogColor, framed.fogNear, framed.fogFar);
      sky.resize(framed.radius);
      lighting.frameShadows(framed.radius);
      applyAtmosphereFrame();
    }

    function syncView(): void {
      const snap = engine.snapshot();
      if (snap.phase === 'lobby') {
        boardBuilt = false;
        lastRollKey = '';
        lastRobberHex = '';
        world.setHoverHex(null);
        return;
      }
      if (!boardBuilt) {
        world.build(snap.board);
        world.applyStyleConfig(configurator.getConfig());
        frameCamera(snap.board.rings);
        boardBuilt = true;
        lastRobberHex = snap.board.robberHexId;
      } else {
        world.syncPieces(snap.board, true);
      }
      world.syncHighlights(snap.legalVertices, snap.legalEdges, snap.legalHexes);

      const rollKey =
        snap.lastRoll !== null ? `${snap.lastRoll[0]}:${snap.lastRoll[1]}:${snap.productionLog}` : '';
      if (rollKey && rollKey !== lastRollKey && snap.lastRoll) {
        const total = snap.lastRoll[0] + snap.lastRoll[1];
        world.pulseProduction(total);
      }
      lastRollKey = rollKey;

      if (snap.board.robberHexId !== lastRobberHex) {
        const hex = snap.board.hexes.get(snap.board.robberHexId);
        if (hex) {
          const { x, z } = axialToWorld(hex.q, hex.r);
          robberWorld.set(x + 0.35, 0, z + 0.2);
          cameraRig.nudgeToward(robberWorld, styleLive);
        }
        lastRobberHex = snap.board.robberHexId;
      }
    }

    engine.subscribe(syncView);

    canvas.addEventListener('pointerdown', (ev) => {
      world.setHoverHex(null);
      if (ev.button !== 0) return;
      if ((ev.target as HTMLElement).closest?.('#style-config-root')) return;
      const snap = engine.snapshot();
      if (snap.phase === 'lobby' || snap.phase === 'gameOver') return;

      const hit = picker.pick(ev.clientX, ev.clientY, world.getPickables());
      if (!hit) return;

      if (hit.kind === 'vertex') engine.clickVertex(hit.id);
      else if (hit.kind === 'edge') engine.clickEdge(hit.id);
      else if (hit.kind === 'hex') engine.clickHex(hit.id);
    });

    canvas.addEventListener('pointermove', (ev) => {
      const snap = engine.snapshot();
      if (snap.phase === 'lobby' || snap.phase === 'gameOver' || !boardBuilt) {
        world.setHoverHex(null);
        return;
      }
      if ((ev.target as HTMLElement).closest?.('#style-config-root')) {
        world.setHoverHex(null);
        return;
      }
      if (ev.pointerType !== 'mouse' || ev.buttons !== 0) {
        world.setHoverHex(null);
        return;
      }
      const hit = picker.pick(ev.clientX, ev.clientY, world.getPickables());
      world.setHoverHex(hit?.kind === 'hex' ? hit.id : null);
    });

    canvas.addEventListener('pointerleave', () => world.setHoverHex(null));

    new Viewport(document.getElementById('app') ?? document.body, (size) => {
      cameraRig.setAspect(size.aspect);
      rendering.setSize(size.width, size.height);
    });

    ticker.on('motion', () => {
      cameraTweens.update(time.delta);
      cameraRig.update();
    });
    ticker.on('atmosphere', () => {
      dayCycle.update(time.delta);
      applyAtmosphereFrame();
    });
    ticker.on('world', () => {
      world.update(time.elapsed, time.delta);
      sky.update(time.elapsed);
    });
    ticker.on('render', () => {
      world.renderWaterReflection(rendering.renderer, rendering.scene, cameraRig.camera);
      rendering.render(cameraRig.camera);
      monitor?.update(`quality ${getQualityLevel()} · weather ${styleLive.weather}`);
    });

    const loop = (): void => {
      requestAnimationFrame(loop);
      time.update();
      ticker.tick();
    };
    loop();
  }
}
