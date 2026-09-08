/**
 * Debug-only visual/rules fixture. Open via ?view=review&seed=11&map=standard&look=day.
 * Uses real World/presentation objects with explicit style and biome defaults.
 * Does not read or write style/layout localStorage. Not a lobby replacement.
 */
import * as THREE from 'three';
import { GameEngine, type EngineSnapshot } from '../engine/engine';
import {
  completeLegalSetup,
  runDeterministicActionSequence,
} from '../engine/fixtures';
import { diceSequence } from '../engine/rng';
import { Picker, type PickResult } from '../input/picker';
import { isTap } from '../input/tap';
import { Time } from '../core/Time';
import { Viewport } from '../core/Viewport';
import { Rendering } from '../core/Rendering';
import { TweenPlayer } from '../core/tween';
import { CameraRig } from '../view/CameraRig';
import { Lighting } from '../view/Lighting';
import { Fog } from '../view/Fog';
import { TimeOfDayController } from '../world/Atmosphere';
import { World } from '../world/World';
import { SkyDome } from '../world/Sky';
import { applyWeather } from '../world/Weather';
import { defaultBiomeLibrary } from '../world/biomeLayouts';
import type { StyleConfig } from '../style/styleConfig';
import { DEFAULT_STYLE_CONFIG, applyStylePreset } from '../style/styleConfig';
import { Hud } from './hud';
import { parseReviewQuery, REVIEW_PLAYER_COUNT, type ReviewParams } from './reviewRoute';

const REVIEW_DICE_FACES = [4, 4, 3, 3, 5, 2, 6, 1] as const;

export { isReviewRoute, parseReviewQuery, reviewHref } from './reviewRoute';

export function startReviewScene(): void {
  new ReviewScene(parseReviewQuery(window.location.search));
}

class ReviewScene {
  private readonly params: ReviewParams;
  private readonly engine: GameEngine;
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
  private readonly robberLook = new THREE.Vector3();
  private readonly styleLive: StyleConfig;
  private readonly statusEl: HTMLElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly pauseBtn: HTMLButtonElement;
  private readonly sequenceBtn: HTMLButtonElement;

  private boardBuilt = false;
  private lastRollIdentity = '';
  private lastRobberHex = '';
  private pointerTap: { id: number; x: number; y: number } | null = null;
  private activePointers = new Set<number>();
  private multiTouch = false;
  private sequenceRan = false;

  constructor(params: ReviewParams) {
    this.params = params;
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    const hudEl = document.querySelector<HTMLElement>('#hud')!;
    const lobbyEl = document.querySelector<HTMLElement>('#lobby')!;
    const reviewRoot = document.querySelector<HTMLElement>('#review-ui')!;

    document.body.classList.add('review-mode');
    lobbyEl.classList.add('hidden');
    reviewRoot.classList.remove('hidden');

    this.styleLive = applyStylePreset({ ...DEFAULT_STYLE_CONFIG }, params.look);
    this.engine = new GameEngine(params.seed, diceSequence(REVIEW_DICE_FACES));
    this.world = new World({ biomeLibrary: defaultBiomeLibrary() });
    this.world.applyStyleConfig(this.styleLive);
    this.sky = new SkyDome(this.styleLive);
    this.dayCycle = new TimeOfDayController(this.styleLive.timeOfDay);
    this.dayCycle.setDayLength(this.styleLive.dayLengthSec);
    this.dayCycle.setTransitionSec(this.styleLive.dayTransitionSec);

    this.cameraTweens = new TweenPlayer();
    this.time = new Time();
    this.time.freeze(0);
    this.rendering = new Rendering(canvas);
    this.cameraRig = new CameraRig(canvas, this.cameraTweens);
    this.cameraRig.controls.enableDamping = false;
    this.lighting = new Lighting(this.styleLive);
    this.fog = new Fog();
    this.rendering.scene.fog = this.fog.create();
    this.lighting.addTo(this.rendering.scene);
    this.rendering.scene.add(this.sky.group);
    this.rendering.scene.add(this.world.root);

    this.picker = new Picker(this.cameraRig.camera, canvas);
    const hud = new Hud(hudEl, lobbyEl, this.engine);
    hud.setResetView(() => this.cameraRig.resetView(false));
    this.world.setCoarsePointer(window.matchMedia('(pointer: coarse)').matches);

    const controls = this.mountControls(reviewRoot);
    this.statusEl = controls.statusEl;
    this.playBtn = controls.playBtn;
    this.pauseBtn = controls.pauseBtn;
    this.sequenceBtn = controls.sequenceBtn;

    this.engine.subscribe(() => this.syncView());
    this.engine.startGame(REVIEW_PLAYER_COUNT, params.map, params.seed);
    completeLegalSetup(this.engine);
    hud.render();
    lobbyEl.classList.add('hidden');
    this.refreshControls();

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

  private mountControls(root: HTMLElement): {
    statusEl: HTMLElement;
    playBtn: HTMLButtonElement;
    pauseBtn: HTMLButtonElement;
    sequenceBtn: HTMLButtonElement;
  } {
    root.innerHTML = `
      <div class="review-panel">
        <h2>Review fixture</h2>
        <p class="review-meta">${escapeHtml(`seed ${this.params.seed} · ${this.params.map} · ${this.params.look}`)}</p>
        <p class="review-status" data-review-status></p>
        <div class="review-actions">
          <button type="button" class="btn secondary" data-review="play">Play</button>
          <button type="button" class="btn secondary" data-review="pause">Pause</button>
          <button type="button" class="btn" data-review="sequence">Run sequence</button>
        </div>
      </div>
    `;
    const statusEl = root.querySelector<HTMLElement>('[data-review-status]')!;
    const playBtn = root.querySelector<HTMLButtonElement>('[data-review="play"]')!;
    const pauseBtn = root.querySelector<HTMLButtonElement>('[data-review="pause"]')!;
    const sequenceBtn = root.querySelector<HTMLButtonElement>('[data-review="sequence"]')!;
    playBtn.addEventListener('click', () => {
      this.time.play();
      this.refreshControls();
    });
    pauseBtn.addEventListener('click', () => {
      this.time.freeze(this.time.elapsed);
      this.refreshControls();
    });
    sequenceBtn.addEventListener('click', () => {
      runDeterministicActionSequence(this.engine);
      this.sequenceRan = true;
      this.refreshControls();
    });
    return { statusEl, playBtn, pauseBtn, sequenceBtn };
  }

  private refreshControls(): void {
    const snap = this.engine.snapshot();
    const clock = this.time.isFrozen ? 'frozen' : 'playing';
    const seq = this.sequenceRan ? 'sequence done' : 'setup complete';
    this.statusEl.textContent = `${clock} · ${seq} · ${snap.phase}`;
    this.playBtn.disabled = !this.time.isFrozen;
    this.pauseBtn.disabled = this.time.isFrozen;
    this.sequenceBtn.disabled = this.sequenceRan;
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
      this.lastRollIdentity = '';
      this.lastRobberHex = '';
      this.world.setHoverHex(null);
      return;
    }
    if (!this.boardBuilt) {
      this.world.build(snap.board);
      this.world.applyStyleConfig(this.styleLive);
      this.frameCamera(snap.board.rings);
      this.boardBuilt = true;
      this.lastRobberHex = snap.board.robberHexId;
    } else {
      this.world.syncPieces(snap.board, true);
    }
    this.world.syncHighlights(snap.legalVertices, snap.legalEdges, snap.legalHexes);
    this.pulseIfProduced(snap);
    this.followRobber(snap.board.robberHexId);
    this.refreshControls();
  }

  private pulseIfProduced(snap: EngineSnapshot): void {
    const identity = `${snap.gameId}:${snap.rollId}`;
    if (snap.rollId === 0) {
      this.lastRollIdentity = identity;
      return;
    }
    if (identity === this.lastRollIdentity) return;
    this.lastRollIdentity = identity;
    this.world.pulseProduction(snap.productionHexIds);
  }

  private followRobber(robberHexId: string): void {
    if (robberHexId === this.lastRobberHex) return;
    this.lastRobberHex = robberHexId;
    this.cameraRig.nudgeToward(this.world.getRobberPosition(this.robberLook), this.world.getMotion());
  }

  private playable(): boolean {
    if (!this.boardBuilt) return false;
    const phase = this.engine.snapshot().phase;
    return phase !== 'lobby' && phase !== 'gameOver';
  }

  private pickFromPointer(ev: PointerEvent): PickResult | null {
    if (!this.playable()) return null;
    if (ev.target instanceof Element && ev.target.closest('#review-ui')) return null;
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

  private tick(): void {
    this.cameraTweens.update(this.time.delta);
    this.cameraRig.update();
    this.dayCycle.update(this.time.delta);
    this.applyAtmosphereFrame();
    this.world.update(this.time.elapsed, this.time.delta);
    this.sky.update(this.time.elapsed);
    this.world.renderWaterReflection(this.rendering.renderer, this.rendering.scene, this.cameraRig.camera);
    this.rendering.render(this.cameraRig.camera);
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);
    this.time.update();
    this.tick();
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
