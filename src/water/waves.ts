/**
 * Wave band helpers — contour rings from coastline distance.
 */

export interface WaveBandParams {
  spacing: number;
  width: number;
  speed: number;
}

export const DEFAULT_WAVE_BANDS: WaveBandParams = {
  spacing: 1.4,
  width: 0.18,
  speed: 0.12,
};

/**
 * Contour band intensity from SDF / coast distance.
 *
 *   distance = sdf(worldPos)
 *   band = smoothstep(...)
 *   animate by offsetting distance with time
 */
export function waveBand(
  distance: number,
  time: number,
  params: WaveBandParams = DEFAULT_WAVE_BANDS,
): number {
  const d = distance + time * params.speed;
  const phase = ((d % params.spacing) + params.spacing) % params.spacing;
  const half = params.width * 0.5;
  const mid = params.spacing * 0.5;
  const delta = Math.abs(phase - mid);
  if (delta >= half) return 0;
  // Smoothstep-ish falloff inside the band.
  const t = 1 - delta / half;
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
