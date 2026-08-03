/**
 * Shore foam — only near coast: d ∈ [-2, 2] (world-scaled ≈ [-0.8, 0.8]).
 */

import type { DistanceToCoast } from '../terrain/sdf';

export function foamAmount(d: DistanceToCoast, width = 0.8): number {
  const half = width;
  if (d < -half || d > half) return 0;
  const t = 1 - Math.abs(d) / half;
  return t * t;
}
