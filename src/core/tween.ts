/** Lightweight tween queue for board / piece motion (no external deps). */

export type EaseFn = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  smoothstep: (t: number) => t * t * (3 - 2 * t),
  easeOutCubic: (t: number) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  easeOutQuad: (t: number) => 1 - (1 - t) * (1 - t),
} as const;

export interface TweenHandle {
  cancel(): void;
}

interface Tween {
  duration: number;
  elapsed: number;
  ease: EaseFn;
  onUpdate: (u: number) => void;
  onComplete?: () => void;
  cancelled: boolean;
}

export class TweenPlayer {
  private tweens: Tween[] = [];

  /**
   * Animate `onUpdate` from 0→1 over `duration` seconds.
   * Returns a handle that can cancel the tween (skips onComplete).
   */
  play(
    duration: number,
    onUpdate: (u: number) => void,
    opts?: { ease?: EaseFn; onComplete?: () => void },
  ): TweenHandle {
    const tween: Tween = {
      duration: Math.max(0.001, duration),
      elapsed: 0,
      ease: opts?.ease ?? ease.easeOutCubic,
      onUpdate,
      onComplete: opts?.onComplete,
      cancelled: false,
    };
    this.tweens.push(tween);
    onUpdate(0);
    return {
      cancel: () => {
        tween.cancelled = true;
      },
    };
  }

  /** Convenience: lerp a numeric property via getter/setter pair. */
  to(
    from: number,
    to: number,
    duration: number,
    apply: (v: number) => void,
    opts?: { ease?: EaseFn; onComplete?: () => void },
  ): TweenHandle {
    return this.play(
      duration,
      (u) => apply(from + (to - from) * u),
      opts,
    );
  }

  update(dt: number): void {
    if (this.tweens.length === 0) return;
    const next: Tween[] = [];
    for (const tw of this.tweens) {
      if (tw.cancelled) continue;
      tw.elapsed += dt;
      const raw = Math.min(1, tw.elapsed / tw.duration);
      const u = tw.ease(raw);
      tw.onUpdate(u);
      if (raw >= 1) {
        tw.onComplete?.();
      } else {
        next.push(tw);
      }
    }
    this.tweens = next;
  }

  clear(): void {
    this.tweens = [];
  }

  get active(): boolean {
    return this.tweens.length > 0;
  }
}
