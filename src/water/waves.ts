/**
 * Wave contour helpers — bands from distanceToCoast, not water normals.
 */

import type { DistanceToCoast } from '../terrain/sdf';

export function waveBand(d: DistanceToCoast, frequency: number, time: number, speed: number): number {
  const breathing = d + Math.sin(time * 0.2) * 0.5;
  const x = breathing * frequency - time * speed;
  const s = 0.5 + 0.5 * Math.sin(x);
  return Math.max(0, Math.min(1, (s - 0.25) / 0.55));
}

export function causticMask(d: DistanceToCoast): number {
  // Shallow only: d ∈ [-25, 0] in doc units; our SDF is world-scaled — use [-8, 0]
  if (d >= 0 || d < -8) return 0;
  return 1 - -d / 8;
}
