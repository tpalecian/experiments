import * as THREE from 'three';
import { GameEngine } from './engine/engine';
import { Picker, type PickResult } from './input/picker';
import { isTap } from './input/tap';
import { Time } from './core/Time';
import { Viewport } from './core/Viewport';
import { Rendering } from './core/Rendering';
import { Monitoring } from './core/Monitoring';
import { TweenPlayer } from './core/tween';
import { getQualityLevel } from './core/Quality';
import { CameraRig } from './view/CameraRig';
import { Lighting } from './view/Lighting';
import { Fog } from './view/Fog';
import { TimeOfDayController } from './world/Atmosphere';
import { World } from './world/World';
import { SkyDome } from './world/Sky';
import { applyWeather } from './world/Weather';
import type { StyleConfig } from './style/styleConfig';
import { StyleConfigurator } from './ui/style/configurator';
import { Hud } from './ui/hud';
import { assetLabHref } from './ui/assetLab';
import { biomeEditorHref } from './ui/biomeEditor';

/**
 * Composition root — owns systems and ticks them in a fixed order.
 * Not a singleton; Asset Lab / Biome Editor boot separately.
 */
export class Game {
  private readonly engine: GameEngine;
  private readonly configurator: StyleConfigurator;
  private readonly world: World;
  private readonly sky: SkyDome;
  private readonly dayCycle: TimeOfDayController;
  private readonly cameraTweens: TweenPlayer;
  private readonly time: Time;
  private readonly rendering: Rendering;
  private readonly cameraRig: CameraRig;
  private readonly lighting: Lighting;
  private readonly fog: Fog;
  private readonly picker: Picker;
  private readonly monitor: Monitoring | null;
  private readonly robberLook = new THREE.Vector3();

  private boardBuilt = false;
  private lastTimeOfDay: StyleConfig['timeOfDay'];
  private styleLive: StyleConfig;
  private lastProductionLog = '';
  private lastRobberHex = '';
  private styleApplyTimer = 0;
  private pointerTap: { id: number; x: number; y: number } | null = null;
  private activePointers = new Set<number>();
  private multiTouch = false;

  constructor() {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    const hudEl = document.querySelector<HTMLElement>('#hud')!;
    const lobbyEl = document.querySelector<HTMLElement>('#lobby')!;
    const configRoot = document.querySelector<HTMLElement>('#style-config-root')!;

    this.engine = new GameEngine();
    this.configurator = new StyleConfigurator(configRoot);
    const initialConfig = this.configurator.getConfig();
    this.styleLive = initialConfig;
    this.lastTimeOfDay = initialConfig.timeOfDay;

    this.world = new World();
    this.world.applyStyleConfig(initialConfig);
    this.sky = new SkyDome(initialConfig);
    this.dayCycle = new TimeOfDayController(initialConfig.timeOfDay);
    this.dayCycle.setDayLength(initialConfig.dayLengthSec);
    this.dayCycle.setTransitionSec(initialConfig.dayTransitionSec);

    this.cameraTweens = new TweenPlayer();
    this.time = new Time();
    this.rendering = new Rendering(canvas);
    this.cameraRig = new CameraRig(canvas, this.cameraTweens);
    this.lighting = new Lighting(initialConfig);
    this.fog = new Fog();
    this.rendering.scene.fog = this.fog.create();
    this.lighting.addTo(this.rendering.scene);
    this.rendering.scene.add(this.sky.group);
    this.rendering.scene.add(this.world.root);

    this.picker = new Picker(this.cameraRig.camera, canvas);
    const hud = new Hud(hudEl, lobbyEl, this.engine);
    hud.setAssetLabHref(assetLabHref());
    hud.setBiomeEditorHref(biomeEditorHref());
    hud.setResetView(() => this.cameraRig.resetView(true));
    this.world.setCoarsePointer(window.matchMedia('(pointer: coarse)').matches);

    this.monitor = Monitoring.enabled() ? new Monitoring() : null;

    this.configurator.subscribe((config) => this.queueStyleApply(config));
    this.engine.subscribe(() => this.syncView());

    canvas.addEventListener('pointerdown', (ev) => this.onPointerDown(ev));
    canvas.addEventListener('pointerup', (ev) => this.onPointerUp(ev));
    canvas.addEventListener('pointercancel', (ev) => this.onPointerCancel(ev));
    canvas.addEventListener('pointermove', (ev) => this.onPointerMove(ev));
    canvas.addEventListener('pointerleave', () => this.world.setHoverHex(null));

    new Viewport(document.getElementById('app') ?? document.body, (size) => {
      this.cameraRig.setAspect(size.aspect);
      this.rendering.setSize(size.width, size.height);
    });

    this.loop();
  }

  private applyStyle(config: StyleConfig): void {
    this.styleLive = config;
    this.sky.applyConfig(config);
    this.world.applyStyleConfig(config);
    this.dayCycle.setDayLength(config.dayLengthSec);
    this.dayCycle.setTransitionSec(config.dayTransitionSec);
    if (config.timeOfDay !== this.lastTimeOfDay) {
      this.lastTimeOfDay = config.timeOfDay;
      this.dayCycle.setMode(config.timeOfDay);
    }
  }

  private applyAtmosphereFrame(): void {
    const raw = this.dayCycle.getSnapshot();
    const atm = applyWeather(raw, this.styleLive.weather);
    const dir = this.dayCycle.getCelestialDirection();
    const expMul = this.styleLive.exposure / 1.15;

    this.sky.applyAtmosphere(atm);
    this.sky.setSunDirection(dir);
    this.world.applyAtmosphere(atm);
    this.world.setSunDirection(dir);
    this.lighting.applyAtmosphere(atm, this.styleLive);
    this.lighting.setCelestialDirection(dir);
    this.rendering.setExposure(atm.exposure * expMul);
    this.fog.apply(this.rendering.scene, atm);
  }

  private queueStyleApply(config: StyleConfig): void {
    window.clearTimeout(this.styleApplyTimer);
    this.styleApplyTimer = window.setTimeout(() => this.applyStyle(config), 40);
  }

  private frameCamera(rings: number): void {
    const framed = this.cameraRig.frameBoard(rings);
    this.fog.setRange(framed.fogNear, framed.fogFar);
    this.sky.resize(framed.radius);
    this.lighting.frameShadows(framed.radius);
    this.applyAtmosphereFrame();
  }

  private syncView(): void {
    const snap = this.engine.snapshot();
    if (snap.phase === 'lobby') {
      this.boardBuilt = false;
      this.lastProductionLog = '';
      this.lastRobberHex = '';
      this.world.setHoverHex(null);
      return;
    }
    if (!this.boardBuilt) {
      this.world.build(snap.board);
      this.world.applyStyleConfig(this.configurator.getConfig());
      this.frameCamera(snap.board.rings);
      this.boardBuilt = true;
      this.lastRobberHex = snap.board.robberHexId;
    } else {
      this.world.syncPieces(snap.board, true);
    }
    this.world.syncHighlights(snap.legalVertices, snap.legalEdges, snap.legalHexes);
    this.pulseIfProduced(snap.productionLog, snap.lastRoll);
    this.followRobber(snap.board.robberHexId);
  }

  private pulseIfProduced(productionLog: string, lastRoll: [number, number] | null): void {
    if (!productionLog) {
      this.lastProductionLog = '';
      return;
    }
    if (productionLog === this.lastProductionLog || !lastRoll) return;
    this.lastProductionLog = productionLog;
    this.world.pulseProduction(lastRoll[0] + lastRoll[1]);
  }

  private followRobber(robberHexId: string): void {
    if (robberHexId === this.lastRobberHex) return;
    this.lastRobberHex = robberHexId;
    this.cameraRig.nudgeToward(this.world.getRobberPosition(this.robberLook), this.world.getMotion());
  }

  private overStylePanel(ev: PointerEvent): boolean {
    return ev.target instanceof Element && Boolean(ev.target.closest('#style-config-root'));
  }

  private playable(): boolean {
    if (!this.boardBuilt) return false;
    const phase = this.engine.snapshot().phase;
    return phase !== 'lobby' && phase !== 'gameOver';
  }

  private pickFromPointer(ev: PointerEvent): PickResult | null {
    if (!this.playable() || this.overStylePanel(ev)) return null;
    return this.picker.pick(ev.clientX, ev.clientY, this.world.getPickables());
  }

  private applyPick(hit: PickResult): void {
    switch (hit.kind) {
      case 'vertex':
        this.engine.clickVertex(hit.id);
        break;
      case 'edge':
        this.engine.clickEdge(hit.id);
        break;
      case 'hex':
        this.engine.clickHex(hit.id);
        break;
      default: {
        const _exhaustive: never = hit.kind;
        return _exhaustive;
      }
    }
  }

  private onPointerDown(ev: PointerEvent): void {
    this.world.setHoverHex(null);
    this.world.setCoarsePointer(ev.pointerType !== 'mouse');
    this.activePointers.add(ev.pointerId);
    if (this.activePointers.size > 1) {
      this.multiTouch = true;
      this.pointerTap = null;
      return;
    }
    if (ev.button !== 0) {
      this.pointerTap = null;
      return;
    }
    this.multiTouch = false;
    this.pointerTap = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
  }

  private onPointerUp(ev: PointerEvent): void {
    const wasMulti = this.multiTouch;
    this.activePointers.delete(ev.pointerId);
    const tap = this.pointerTap;
    this.pointerTap = null;
    if (this.activePointers.size === 0) this.multiTouch = false;
    if (!tap || tap.id !== ev.pointerId || wasMulti) return;
    if (!isTap(ev.clientX - tap.x, ev.clientY - tap.y)) return;
    const hit = this.pickFromPointer(ev);
    if (hit) this.applyPick(hit);
  }

  private onPointerCancel(ev: PointerEvent): void {
    this.activePointers.delete(ev.pointerId);
    if (this.pointerTap?.id === ev.pointerId) this.pointerTap = null;
    if (this.activePointers.size === 0) this.multiTouch = false;
  }

  private onPointerMove(ev: PointerEvent): void {
    if (ev.pointerType !== 'mouse' || ev.buttons !== 0) {
      this.world.setHoverHex(null);
      return;
    }
    const hit = this.pickFromPointer(ev);
    this.world.setHoverHex(hit?.kind === 'hex' ? hit.id : null);
  }

  /** motion → atmosphere → world → water reflection → main render */
  private tick(): void {
    this.cameraTweens.update(this.time.delta);
    this.cameraRig.update();
    this.dayCycle.update(this.time.delta);
    this.applyAtmosphereFrame();
    this.world.update(this.time.elapsed, this.time.delta);
    this.sky.update(this.time.elapsed);
    this.world.renderWaterReflection(this.rendering.renderer, this.rendering.scene, this.cameraRig.camera);
    this.rendering.render(this.cameraRig.camera);
    this.monitor?.update(`quality ${getQualityLevel()} · weather ${this.styleLive.weather}`);
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);
    this.time.update();
    this.tick();
  };
}
