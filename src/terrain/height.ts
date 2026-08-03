/**
 * Heightmap from island SDF + layered elevation bands.
 */

import type { IslandSdf } from './sdf';

export type HeightLayer =
  | 'deepOcean'
  | 'lagoon'
  | 'sandShelf'
  | 'beach'
  | 'grass'
  | 'hills'
  | 'cliffs'
  | 'mountains';

/** Ordered low → high for thresholding. */
export const HEIGHT_LAYER_ORDER: HeightLayer[] = [
  'deepOcean',
  'lagoon',
  'sandShelf',
  'beach',
  'grass',
  'hills',
  'cliffs',
  'mountains',
];

export interface HeightParams {
  beachWidth: number;
  hillScale: number;
  mountainScale: number;
}

export const DEFAULT_HEIGHT: HeightParams = {
  beachWidth: 0.8,
  hillScale: 1.2,
  mountainScale: 2.4,
};

export interface Heightmap {
  width: number;
  depth: number;
  /** Row-major heights; world XZ mapped by caller. */
  data: Float32Array;
  params: HeightParams;
}

/**
 * Sample continuous height from SDF.
 * Stub: maps land distance to a gentle dome.
 */
export function sampleHeight(
  sdf: IslandSdf,
  x: number,
  z: number,
  params: HeightParams = DEFAULT_HEIGHT,
): number {
  const d = sdf.sample(x, z);
  if (d >= 0) {
    // Water side: slight underwater shelf.
    return -Math.min(d, 2) * 0.15;
  }
  const inland = -d;
  return Math.min(
    inland * params.hillScale,
    params.mountainScale,
  );
}

export function classifyLayer(height: number, sdfValue: number): HeightLayer {
  if (sdfValue > 1.5) return 'deepOcean';
  if (sdfValue > 0.6) return 'lagoon';
  if (sdfValue > 0.15) return 'sandShelf';
  if (sdfValue > -0.05 || height < 0.08) return 'beach';
  if (height < 0.6) return 'grass';
  if (height < 1.2) return 'hills';
  if (height < 1.8) return 'cliffs';
  return 'mountains';
}
