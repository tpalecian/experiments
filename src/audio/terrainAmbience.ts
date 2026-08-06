import type { Terrain } from '../game/types';

export interface TerrainAmbienceProfile {
  /** Loop asset under `/sounds/`. */
  path: string;
  /** Target volume after crossfade (0–1), scaled by master ambient slider. */
  volume: number;
  /** Playback rate for Howler. */
  rate: number;
}

export const TERRAIN_AMBIENCE: Record<Terrain, TerrainAmbienceProfile> = {
  wood: { path: '/sounds/wind/forest-loop.mp3', volume: 0.42, rate: 1 },
  sheep: { path: '/sounds/rain/leaves.mp3', volume: 0.34, rate: 1.02 },
  wheat: { path: '/sounds/rain/leaves.mp3', volume: 0.38, rate: 0.96 },
  ore: { path: '/sounds/wind/forest-loop.mp3', volume: 0.3, rate: 0.82 },
  brick: { path: '/sounds/wind/cloth-wind.mp3', volume: 0.36, rate: 0.95 },
  desert: { path: '/sounds/wind/cloth-wind.mp3', volume: 0.32, rate: 0.88 },
};

export const GUST_SOUNDS = {
  wind: { path: '/sounds/wind/forest-loop.mp3', volume: 0.28 },
  sea: { path: '/sounds/waves/lake-waves.mp3', volume: 0.34 },
} as const;
