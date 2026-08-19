import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { boardRadiusWorld } from '../engine/board';
import { TweenPlayer, ease } from '../core/tween';
import type { StyleConfig } from '../style/styleConfig';

/** Orbit camera, board framing, and robber look-at nudge. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly boardCenter = new THREE.Vector3(0, 0.12, 0);
  private readonly tweens: TweenPlayer;
  private readonly look = new THREE.Vector3();
  private readonly lookFrom = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, tweens: TweenPlayer) {
    this.tweens = tweens;
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 400);
    this.camera.position.set(0, 14, 14);

    const controls = new OrbitControls(this.camera, canvas);
    controls.target.copy(this.boardCenter);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    // Keep a tabletop angle — nearly horizontal views expose tile undersides / water gaps.
    controls.minPolarAngle = 0.28;
    controls.maxPolarAngle = Math.PI * 0.42;
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
    const dist = Math.max(12, r * 2.35);
    const height = Math.max(10, r * 1.85);
    this.camera.position.set(0, height, dist);
    this.camera.far = Math.max(200, dist * 12);
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = Math.max(6, r * 0.9);
    this.controls.maxDistance = Math.max(24, r * 4.2);
    this.controls.minPolarAngle = 0.28;
    this.controls.maxPolarAngle = Math.PI * 0.42;
    this.controls.target.copy(this.boardCenter);
    this.controls.update();
    return {
      fogNear: dist * 1.8,
      fogFar: dist * 5.8,
      sunAnchor: Math.max(8, r * 1.1),
      radius: r,
    };
  }

  nudgeToward(world: THREE.Vector3, config: StyleConfig): void {
    this.lookFrom.copy(this.controls.target);
    this.look.copy(world);
    this.look.y = 0.12;
    this.look.lerp(this.boardCenter, config.motionCameraNudgeBlend);
    this.tweens.play(
      config.motionCameraNudgeSec,
      (u) => {
        this.controls.target.lerpVectors(this.lookFrom, this.look, ease.easeOutCubic(u));
      },
      { ease: ease.linear },
    );
  }

  update(): void {
    this.controls.update();
  }
}
