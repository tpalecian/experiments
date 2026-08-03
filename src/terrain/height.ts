/**
 * Terrain height from coastline distance — never raw Perlin mountains.
 *
 *   height = terrainCurve(distanceToCoast) + largeScaleNoise + smallVariation
 */

import type { DistanceToCoast, IslandSdf } from './sdf';

export type HeightLayer =
  | 'deepOcean'
  | 'lagoon'
  | 'beach'
  | 'grass'
  | 'hills'
  | 'mountains';

/** Ordered reference bands on distanceToCoast (ocean → peak). */
export const DISTANCE_BANDS: { layer: HeightLayer; distance: number }[] = [
  { layer: 'deepOcean', distance: -100 },
  { layer: 'lagoon', distance: -20 },
  { layer: 'beach', distance: 0 },
  { layer: 'grass', distance: 15 },
  { layer: 'hills', distance: 40 },
  { layer: 'mountains', distance: 70 },
];

export interface HeightParams {
  /** World-unit scale applied after the distance curve. */
  verticalScale: number;
  largeNoise: number;
  smallNoise: number;
}

export const DEFAULT_HEIGHT: HeightParams = {
  verticalScale: 0.04,
  largeNoise: 0.15,
  smallNoise: 0.04,
};

export interface Heightmap {
  width: number;
  depth: number;
  /** Row-major heights; world XZ mapped by caller. */
  data: Float32Array;
  params: HeightParams;
}

/**
 * Piecewise terrain curve from signed coastline distance.
 * Stub: smoothstep-ish ramp inland; shallow shelf offshore.
 */
export function terrainCurve(d: DistanceToCoast): number {
  if (d < 0) {
    // Underwater shelf: deeper as d → −∞
    return Math.max(d, -80) * 0.02;
  }
  // Land: gentle rise toward mountains
  if (d < 15) return d * 0.02; // beach → grass approach
  if (d < 40) return 0.3 + (d - 15) * 0.035;
  if (d < 70) return 1.175 + (d - 40) * 0.04;
  return 2.375 + (d - 70) * 0.03;
}

/**
 * Sample height. Noise terms are stubs (0) until FBM lands —
 * keep amplitude low so the coast still reads as sculpted.
 */
export function sampleHeight(
  sdf: IslandSdf,
  x: number,
  z: number,
  params: HeightParams = DEFAULT_HEIGHT,
): number {
  const d = sdf.sample(x, z);
  const base = terrainCurve(d);
  // Placeholder noise slots — wired later via seed + FBM.
  const largeScaleNoise = 0;
  const smallVariation = 0;
  const scale = params.verticalScale / DEFAULT_HEIGHT.verticalScale;
  return (
    (base + largeScaleNoise * params.largeNoise + smallVariation * params.smallNoise) * scale
  );
}

export function classifyLayer(d: DistanceToCoast): HeightLayer {
  if (d < -50) return 'deepOcean';
  if (d < -5) return 'lagoon';
  if (d < 8) return 'beach';
  if (d < 30) return 'grass';
  if (d < 55) return 'hills';
  return 'mountains';
}
