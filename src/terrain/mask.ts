/**
 * Coastline smoothing — raw procedural masks look artificial.
 * Prefer large sweeping beaches over noisy shores.
 *
 * Techniques (to implement): Gaussian blur, distance transform,
 * Marching Squares smoothing.
 */

/** Soften a row-major mask in place / copy. Stub: identity. */
export function smoothIslandMask(
  mask: Float32Array,
  _width: number,
  _height: number,
  _passes = 2,
): Float32Array {
  return mask.slice();
}

/**
 * Optional distance-transform style soften toward the shore.
 * Stub returns the input unchanged.
 */
export function distanceTransformSoften(
  mask: Float32Array,
  _width: number,
  _height: number,
): Float32Array {
  return mask.slice();
}
