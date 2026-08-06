import type { Terrain } from '../game/types';

export interface TerrainAmbienceProfile {
  /** Base loop volume after crossfade. */
  volume: number;
  /** Band-pass center frequency for rustle / wind bed. */
  centerHz: number;
  /** Band-pass Q. */
  q: number;
  /** Optional low-frequency rumble mix (0–1). */
  rumbleMix: number;
  /** Playback rate jitter for the noise bed. */
  playbackRate: number;
}

export const TERRAIN_AMBIENCE: Record<Terrain, TerrainAmbienceProfile> = {
  wood: { volume: 0.22, centerHz: 420, q: 0.65, rumbleMix: 0.08, playbackRate: 1 },
  sheep: { volume: 0.2, centerHz: 680, q: 0.55, rumbleMix: 0.04, playbackRate: 1.05 },
  wheat: { volume: 0.18, centerHz: 560, q: 0.5, rumbleMix: 0.05, playbackRate: 0.98 },
  ore: { volume: 0.16, centerHz: 280, q: 0.75, rumbleMix: 0.35, playbackRate: 0.92 },
  brick: { volume: 0.17, centerHz: 340, q: 0.7, rumbleMix: 0.12, playbackRate: 0.95 },
  desert: { volume: 0.14, centerHz: 300, q: 0.85, rumbleMix: 0.06, playbackRate: 0.9 },
};
