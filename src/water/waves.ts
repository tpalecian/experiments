/**
 * Wave bands are contour lines of distanceToCoast — not water normals.
 *
 *   band = fract(distance * frequency)
 *   then blur, fade, animate
 *
 * Animation is breathing, not waves:
 *   distance += sin(time * 0.2) * 0.5
 */

export interface WaveBandParams {
  frequency: number;
  width: number;
  /** Breathing amplitude added to distance. */
  breathAmp: number;
  /** Breathing angular speed. */
  breathSpeed: number;
}

export const DEFAULT_WAVE_BANDS: WaveBandParams = {
  frequency: 0.35,
  width: 0.12,
  breathAmp: 0.5,
  breathSpeed: 0.2,
};

function fract(x: number): number {
  return x - Math.floor(x);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Contour band intensity from signed distanceToCoast (ocean side preferred).
 */
export function waveBand(
  distanceToCoast: number,
  time: number,
  params: WaveBandParams = DEFAULT_WAVE_BANDS,
): number {
  // Breathing offset — almost imperceptible.
  const d = distanceToCoast + Math.sin(time * params.breathSpeed) * params.breathAmp;
  // Contours mainly read in water (d < 0); still defined everywhere.
  const f = fract(Math.abs(d) * params.frequency);
  const half = params.width * 0.5;
  const edge = smoothstep(0, half, f) * (1 - smoothstep(1 - half, 1, f));
  // Fade out inland and in deep water extremes.
  const shoreFade = smoothstep(-40, -2, d) * (1 - smoothstep(-1, 8, d));
  return edge * shoreFade;
}

/** Caustic visibility in shallow water: distance ∈ [-25, 0]. */
export function causticsMask(distanceToCoast: number): number {
  if (distanceToCoast >= 0 || distanceToCoast < -25) return 0;
  const t = (distanceToCoast + 25) / 25; // 0 at -25 → 1 at 0
  return t * t * (3 - 2 * t);
}

/** Slow swell displacement (CPU helper; GPU swell lives in the water shader). */
export function swellHeight(x: number, z: number, time: number, amp = 0.08): number {
  const w =
    Math.sin(x * 0.3 + time * 0.15) +
    Math.sin(z * 0.2 + time * 0.1) +
    Math.sin((x + z) * 0.15 + time * 0.08);
  return (w / 3) * amp;
}
