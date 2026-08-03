/**
 * Shore foam — only near the coast. Never in deep water.
 *
 * Active roughly where distanceToCoast ∈ [-2, 2].
 */

export interface FoamParams {
  /** Half-width of foam band around the zero contour. */
  halfWidth: number;
  intensity: number;
}

export const DEFAULT_FOAM: FoamParams = {
  halfWidth: 2,
  intensity: 0.85,
};

/**
 * Foam factor in [0, 1] from signed distanceToCoast.
 * Peaks at the shoreline (d ≈ 0), fades by ±halfWidth.
 */
export function foamFactor(
  distanceToCoast: number,
  params: FoamParams = DEFAULT_FOAM,
): number {
  const a = Math.abs(distanceToCoast);
  if (a >= params.halfWidth) return 0;
  const t = 1 - a / params.halfWidth;
  // Smoothstep falloff
  const s = t * t * (3 - 2 * t);
  return s * params.intensity;
}
