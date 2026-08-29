import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { boardRadiusWorld } from '../engine/board';
import { TweenPlayer, ease } from '../core/tween';
import type { MotionFeel } from '../world/motion';

/** 35–50° downward from the horizon → polar from +Y. */
const DIORAMA_MIN_POLAR = 0.62;
const DIORAMA_MAX_POLAR = 0.98;
const DEFAULT_POLAR = 0.84;
const DEFAULT_AZIMUTH = 0.48;

/** Orthographic miniature-diorama camera with orbit and select-focus. */
export class CameraRig {
  readonly camera: THREE.OrthographicCamera;
  readonly controls: OrbitControls;
  readonly boardCenter = new THREE.Vector3(0, 0.12, 0);
  private readonly tweens: TweenPlayer;
  private readonly look = new THREE.Vector3();
  private readonly lookFrom = new THREE.Vector3();
  private aspect = 1;
  private viewSize = 10;
  private frameRadius = 6;
  private readonly posFrom = new THREE.Vector3();
  private readonly posTo = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, tweens: TweenPlayer) {
    this.tweens = tweens;
    this.aspect =
      typeof window !== 'undefined' ? window.innerWidth / Math.max(1, window.innerHeight) : 16 / 9;
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    this.applyFrustum();
    this.placeOnOrbit(DEFAULT_AZIMUTH, DEFAULT_POLAR, 22);

    const controls = new OrbitControls(this.camera, canvas);
    controls.target.copy(this.boardCenter);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.touches.ONE = THREE.TOUCH.PAN;
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    controls.minPolarAngle = DIORAMA_MIN_POLAR;
    controls.maxPolarAngle = DIORAMA_MAX_POLAR;
    controls.minZoom = 0.55;
    controls.maxZoom = 2.6;
    controls.update();
    this.controls = controls;
  }

  setAspect(aspect: number): void {
    this.aspect = Math.max(0.2, aspect);
    this.applyFrustum();
  }

  /** Returns fog near/far and sun-anchor distance for the framed board. */
  frameBoard(rings: number): { fogNear: number; fogFar: number; sunAnchor: number; radius: number } {
    const r = boardRadiusWorld(rings);
    this.frameRadius = r;
    // Tighter than the old 1.55× frame so the larger hexes also read bigger on screen.
    this.viewSize = Math.max(8, r * 1.18);
    this.camera.far = Math.max(200, r * 28);
    this.camera.near = 0.1;
    this.camera.zoom = 1;
    this.applyFrustum();
    this.controls.minPolarAngle = DIORAMA_MIN_POLAR;
    this.controls.maxPolarAngle = DIORAMA_MAX_POLAR;
    this.applyPose(false);
    const dist = Math.max(16, r * 3.2);
    return {
      fogNear: dist * 1.15,
      fogFar: dist * 4.4,
      sunAnchor: Math.max(8, r * 1.1),
      radius: r,
    };
  }

  /** Recenter on the island. `topDown` uses a higher, more overhead pose for placing pieces. */
  resetView(topDown = true): void {
    this.camera.zoom = 1;
    this.applyFrustum();
    this.applyPose(topDown);
  }

  nudgeToward(world: THREE.Vector3, motion: MotionFeel): void {
    this.lookFrom.copy(this.controls.target);
    this.look.copy(world);
    this.look.y = 0.12;
    this.look.lerp(this.boardCenter, motion.cameraNudgeBlend);

    this.posFrom.copy(this.camera.position);
    const toward = new THREE.Vector3().subVectors(world, this.boardCenter);
    toward.y = 0;
    if (toward.lengthSq() > 1e-6) toward.normalize();
    this.posTo.copy(this.posFrom).add(toward.multiplyScalar(this.frameRadius * 0.12));
    this.posTo.y = this.posFrom.y * 0.92;

    const fromZoom = this.camera.zoom;
    const toZoom = Math.min(this.controls.maxZoom, fromZoom * 1.08);

    this.tweens.play(
      motion.cameraNudgeSec,
      (u) => {
        const t = ease.easeOutCubic(u);
        this.controls.target.lerpVectors(this.lookFrom, this.look, t);
        this.camera.position.lerpVectors(this.posFrom, this.posTo, t);
        this.camera.zoom = fromZoom + (toZoom - fromZoom) * t;
        this.camera.updateProjectionMatrix();
      },
      { ease: ease.linear },
    );
  }

  update(): void {
    this.controls.update();
  }

  private applyFrustum(): void {
    const h = this.viewSize;
    const w = h * this.aspect;
    this.camera.left = -w;
    this.camera.right = w;
    this.camera.top = h;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }

  private applyPose(topDown: boolean): void {
    const polar = topDown ? 0.68 : DEFAULT_POLAR;
    const dist = Math.max(18, this.frameRadius * 3.4);
    this.placeOnOrbit(DEFAULT_AZIMUTH, polar, dist);
    this.controls.target.copy(this.boardCenter);
    this.controls.update();
  }

  private placeOnOrbit(azimuth: number, polar: number, dist: number): void {
    const sp = Math.sin(polar);
    this.camera.position.set(
      Math.sin(azimuth) * sp * dist,
      Math.cos(polar) * dist,
      Math.cos(azimuth) * sp * dist,
    );
  }
}
