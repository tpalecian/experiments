/**
 * Shore foam masks derived from coastline / SDF distance.
 */

export interface FoamParams {
  width: number;
  soft: number;
  intensity: number;
}

export const DEFAULT_FOAM: FoamParams = {
  width: 0.5,
  soft: 0.25,
  intensity: 0.8,
};

/**
 * Foam factor in [0, 1] from signed distance to shore (0 ≈ coastline).
 * Animate in the shader by offsetting `distance` with time.
 */
export function foamFactor(
  distance: number,
  params: FoamParams = DEFAULT_FOAM,
): number {
  const inner = params.width;
  const outer = params.width + params.soft;
  if (distance <= 0) return 0;
  if (distance >= outer) return 0;
  if (distance <= inner) return params.intensity;
  const t = 1 - (distance - inner) / Math.max(params.soft, 1e-6);
  return t * params.intensity;
}
