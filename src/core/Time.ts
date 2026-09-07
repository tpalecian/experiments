import * as THREE from 'three';

/** Frame clock — folio Time + clamped delta. */
export class Time {
  elapsed = 0;
  delta = 1 / 60;
  readonly maxDelta = 0.05;
  private frozen = false;
  private readonly clock = new THREE.Clock();

  get isFrozen(): boolean {
    return this.frozen;
  }

  /** Hold elapsed at `at` seconds and emit zero delta until `play()`. */
  freeze(at = 0): void {
    this.frozen = true;
    this.elapsed = at;
    this.delta = 0;
  }

  /** Resume from the frozen timestamp without applying the paused gap. */
  play(): void {
    if (!this.frozen) return;
    this.frozen = false;
    this.clock.start();
    this.clock.elapsedTime = this.elapsed;
  }

  update(): void {
    if (this.frozen) {
      this.delta = 0;
      return;
    }
    this.delta = Math.min(this.clock.getDelta(), this.maxDelta);
    this.elapsed = this.clock.elapsedTime;
  }
}
