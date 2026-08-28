import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { boardRadiusWorld } from '../engine/board';
import { TweenPlayer, ease } from '../core/tween';
import type { MotionFeel } from '../world/motion';

const TABLETOP_MIN_POLAR = 0.28;
const TABLETOP_MAX_POLAR = Math.PI * 0.42;

/** Orbit camera, board framing, and robber look-at nudge. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly boardCenter = new THREE.Vector3(0, 0.12, 0);
  private readonly tweens: TweenPlayer;
  private readonly look = new THREE.Vector3();
  private readonly lookFrom = new THREE.Vector3();
  private frameDist = 14;
  private frameHeight = 14;

  constructor(canvas: HTMLCanvasElement, tweens: TweenPlayer) {
    this.tweens = tweens;
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 400);
    this.camera.position.set(0, 14, 14);

    const controls = new OrbitControls(this.camera, canvas);
    controls.target.copy(this.boardCenter);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    // Desktop: LMB orbit. Touch: 1-finger pan, pinch zoom, 2-finger tilt (Catan Universe).
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.touches.ONE = THREE.TOUCH.PAN;
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    // Keep a tabletop angle — nearly horizontal views expose tile undersides / water gaps.
    controls.minPolarAngle = TABLETOP_MIN_POLAR;
    controls.maxPolarAngle = TABLETOP_MAX_POLAR;
    controls.minDistance = 8;
    controls.maxDistance = 24;
    controls.update();
    this.controls = controls;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Returns fog near/far and sun-anchor distance for the framed board. */
  frameBoard(rings: number): { fogNear: number; fogFar: number; sunAnchor: number; radius: number } {
    const r = boardRadiusWorld(rings);
    this.frameDist = Math.max(12, r * 2.35);
    this.frameHeight = Math.max(10, r * 1.85);
    this.camera.far = Math.max(200, this.frameDist * 12);
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = Math.max(6, r * 0.9);
    this.controls.maxDistance = Math.max(24, r * 4.2);
    this.controls.minPolarAngle = TABLETOP_MIN_POLAR;
    this.controls.maxPolarAngle = TABLETOP_MAX_POLAR;
    this.applyPose(false);
    return {
      fogNear: this.frameDist * 1.8,
      fogFar: this.frameDist * 5.8,
      sunAnchor: Math.max(8, r * 1.1),
      radius: r,
    };
  }

  /** Recenter on the island. `topDown` uses a higher, more overhead pose for placing pieces. */
  resetView(topDown = true): void {
    this.applyPose(topDown);
  }

  nudgeToward(world: THREE.Vector3, motion: MotionFeel): void {
    this.lookFrom.copy(this.controls.target);
    this.look.copy(world);
    this.look.y = 0.12;
    this.look.lerp(this.boardCenter, motion.cameraNudgeBlend);
    this.tweens.play(
      motion.cameraNudgeSec,
      (u) => {
        this.controls.target.lerpVectors(this.lookFrom, this.look, ease.easeOutCubic(u));
      },
      { ease: ease.linear },
    );
  }

  update(): void {
    this.controls.update();
  }

  private applyPose(topDown: boolean): void {
    if (topDown) {
      this.camera.position.set(0, this.frameHeight * 1.28, this.frameDist * 0.48);
    } else {
      this.camera.position.set(0, this.frameHeight, this.frameDist);
    }
    this.controls.target.copy(this.boardCenter);
    this.controls.update();
  }
}
