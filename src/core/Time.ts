import * as THREE from 'three';

/** Frame clock — folio Time + clamped delta. */
export class Time {
  elapsed = 0;
  delta = 1 / 60;
  readonly maxDelta = 0.05;
  private readonly clock = new THREE.Clock();

  update(): void {
    this.delta = Math.min(this.clock.getDelta(), this.maxDelta);
    this.elapsed = this.clock.elapsedTime;
  }
}
