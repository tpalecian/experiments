/**
 * Coastline smoothing — raw procedural masks look artificial.
 * Prefer large sweeping beaches over noisy shores.
 */

/** Separable box blur (approx Gaussian) for soft coasts. */
export function smoothIslandMask(
  mask: Float32Array,
  width: number,
  height: number,
  passes = 2,
): Float32Array {
  let src = mask.slice();
  let dst = new Float32Array(src.length);
  const radius = 1;
  for (let p = 0; p < passes; p++) {
    // Horizontal
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let w = 0;
        for (let k = -radius; k <= radius; k++) {
          const xx = Math.max(0, Math.min(width - 1, x + k));
          sum += src[y * width + xx]!;
          w += 1;
        }
        dst[y * width + x] = sum / w;
      }
    }
    // Vertical
    const tmp = src;
    src = dst;
    dst = tmp;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let ww = 0;
        for (let k = -radius; k <= radius; k++) {
          const yy = Math.max(0, Math.min(height - 1, y + k));
          sum += src[yy * width + x]!;
          ww += 1;
        }
        dst[y * width + x] = sum / ww;
      }
    }
    const swap = src;
    src = dst;
    dst = swap;
  }
  return src;
}

/**
 * Distance-transform style soften: dilate then erode soft membership.
 */
export function distanceTransformSoften(
  mask: Float32Array,
  width: number,
  height: number,
): Float32Array {
  // Light morphological open on soft values via min/max neighborhood
  const dilated = new Float32Array(mask.length);
  const eroded = new Float32Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let mx = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.max(0, Math.min(width - 1, x + dx));
          const yy = Math.max(0, Math.min(height - 1, y + dy));
          mx = Math.max(mx, mask[yy * width + xx]!);
        }
      }
      dilated[y * width + x] = mx;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let mn = 1;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.max(0, Math.min(width - 1, x + dx));
          const yy = Math.max(0, Math.min(height - 1, y + dy));
          mn = Math.min(mn, dilated[yy * width + xx]!);
        }
      }
      eroded[y * width + x] = mn * 0.65 + mask[y * width + x]! * 0.35;
    }
  }
  return eroded;
}
