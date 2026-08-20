import * as THREE from 'three';
import {
  BEACH_TINTS,
  CAUSTIC_INTENSITY,
  FRESNEL_STRENGTH,
  WATER_DEPTH_PALETTES,
  WAVE_BAND_INTENSITY,
  type EnvironmentScheme,
} from '../atmosphere/environment';

/** Fixed day schemes the game can hold or cycle through. */
export type DayScheme = 'morning' | 'afternoon' | 'evening' | 'night';

export const DAY_SCHEMES: DayScheme[] = ['morning', 'afternoon', 'evening', 'night'];

/** Map game schemes onto Environment State palette tables. */
export function environmentSchemeFor(day: DayScheme): EnvironmentScheme {
  switch (day) {
    case 'morning':
    case 'afternoon':
      return 'day';
    case 'evening':
      return 'sunset';
    case 'night':
      return 'night';
    default: {
      const _exhaustive: never = day;
      return _exhaustive;
    }
  }
}

/**
 * Full environment snapshot for one moment in the day.
 * Applied every frame so sky, lights, fog, water, and clouds stay coherent.
 * This is the live Environment State — board meshes never regenerate.
 */
export interface AtmosphereSnapshot {
  // Sky dome
  skyZenith: THREE.Color;
  skyMid: THREE.Color;
  skyHorizon: THREE.Color;
  sunDiscColor: THREE.Color;
  sunDiscIntensity: number;
  sunGlowIntensity: number;
  /** Higher = tighter disc (pow exponent). */
  sunDiscPower: number;
  horizonHaze: number;
  horizonHazeWidth: number;
  starsIntensity: number;

  /** Celestial altitude in [-0.25, 1]. Negative = below horizon (moon night). */
  sunAltitude: number;
  /** Azimuth radians around Y. */
  sunAzimuth: number;

  // Scene lights
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  fillColor: THREE.Color;
  fillIntensity: number;
  rimColor: THREE.Color;
  rimIntensity: number;
  exposure: number;
  fogColor: THREE.Color;
  /** Multipliers on board-derived fog near/far. */
  fogNearMul: number;
  fogFarMul: number;
  /** 0..1 shadow opacity / darkness. */
  shadowStrength: number;

  // Clouds
  cloudLit: THREE.Color;
  cloudShade: THREE.Color;

  // Water — scheme depth palette (docs/DAY_NIGHT.md)
  waterDeep: THREE.Color;
  waterOcean: THREE.Color;
  waterLagoon: THREE.Color;
  waterShallow: THREE.Color;
  waterShelf: THREE.Color;
  waterFoamColor: THREE.Color;

  // Water scalars (compose with Style craft bases)
  waterBrightness: number;
  waterTint: THREE.Color;
  waterTintMix: number;
  waterSunColor: THREE.Color;
  waterSpecularIntensity: number;
  waterFresnelStrength: number;
  waterCausticIntensity: number;
  /** Multiplier on craft band intensity. */
  waveBandIntensity: number;
  foamBrightness: number;
  /** How strongly scheme palette overrides craft water colours (0 = craft only). */
  waterPaletteMix: number;
  skyFresnelColor: THREE.Color;

  /** Soft multiply/tint for hex skirts / props (geometry static). */
  beachTint: THREE.Color;
  /** 0 = no tile response, 1 = full beachTint pull. */
  boardTintMix: number;
}

function c(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

function envExtras(scheme: EnvironmentScheme): {
  waterDeep: string;
  waterOcean: string;
  waterLagoon: string;
  waterShallow: string;
  waterShelf: string;
  waterFoamColor: string;
  waveBandIntensity: number;
  foamBrightness: number;
  waterFresnelStrength: number;
  waterCausticIntensity: number;
  beachTint: string;
  waterPaletteMix: number;
  boardTintMix: number;
  shadowStrength: number;
  fogNearMul: number;
  fogFarMul: number;
} {
  const p = WATER_DEPTH_PALETTES[scheme];
  return {
    waterDeep: p.deep,
    waterOcean: p.ocean,
    waterLagoon: p.lagoon,
    // Shallow sits between lagoon and shelf — cyan near coast, navy farther out.
    waterShallow: scheme === 'day' ? '#3ED8E0' : scheme === 'sunset' ? '#5EC8D0' : '#2A6A9A',
    waterShelf: p.shelf,
    waterFoamColor: scheme === 'night' ? '#C8F4FF' : scheme === 'sunset' ? '#FFF0E0' : '#FFFFFF',
    waveBandIntensity: WAVE_BAND_INTENSITY[scheme],
    // Keep night foam bright so the cyan rim still reads like Bruno's folio
    foamBrightness: scheme === 'night' ? 0.85 : scheme === 'sunset' ? 0.8 : 1,
    waterFresnelStrength: FRESNEL_STRENGTH[scheme],
    waterCausticIntensity: CAUSTIC_INTENSITY[scheme] * 0.08,
    beachTint: BEACH_TINTS[scheme],
    waterPaletteMix: scheme === 'day' ? 0.35 : scheme === 'sunset' ? 0.75 : 0.9,
    boardTintMix: scheme === 'day' ? 0.08 : scheme === 'sunset' ? 0.22 : 0.32,
    shadowStrength: scheme === 'night' ? 0.42 : scheme === 'sunset' ? 0.88 : 1,
    fogNearMul: scheme === 'night' ? 0.85 : scheme === 'sunset' ? 0.95 : 1,
    fogFarMul: scheme === 'night' ? 0.75 : scheme === 'sunset' ? 0.9 : 1,
  };
}

function snap(
  day: DayScheme,
  partial: {
    skyZenith: string;
    skyMid: string;
    skyHorizon: string;
    sunDiscColor: string;
    sunDiscIntensity: number;
    sunGlowIntensity: number;
    sunDiscPower: number;
    horizonHaze: number;
    horizonHazeWidth: number;
    starsIntensity: number;
    sunAltitude: number;
    sunAzimuth: number;
    sunColor: string;
    sunIntensity: number;
    hemiSky: string;
    hemiGround: string;
    hemiIntensity: number;
    fillColor: string;
    fillIntensity: number;
    rimColor: string;
    rimIntensity: number;
    exposure: number;
    fogColor: string;
    cloudLit: string;
    cloudShade: string;
    waterBrightness: number;
    waterTint: string;
    waterTintMix: number;
    waterSunColor: string;
    waterSpecularIntensity: number;
    skyFresnelColor: string;
  },
): AtmosphereSnapshot {
  const env = envExtras(environmentSchemeFor(day));
  return {
    skyZenith: c(partial.skyZenith),
    skyMid: c(partial.skyMid),
    skyHorizon: c(partial.skyHorizon),
    sunDiscColor: c(partial.sunDiscColor),
    sunDiscIntensity: partial.sunDiscIntensity,
    sunGlowIntensity: partial.sunGlowIntensity,
    sunDiscPower: partial.sunDiscPower,
    horizonHaze: partial.horizonHaze,
    horizonHazeWidth: partial.horizonHazeWidth,
    starsIntensity: partial.starsIntensity,
    sunAltitude: partial.sunAltitude,
    sunAzimuth: partial.sunAzimuth,
    sunColor: c(partial.sunColor),
    sunIntensity: partial.sunIntensity,
    hemiSky: c(partial.hemiSky),
    hemiGround: c(partial.hemiGround),
    hemiIntensity: partial.hemiIntensity,
    fillColor: c(partial.fillColor),
    fillIntensity: partial.fillIntensity,
    rimColor: c(partial.rimColor),
    rimIntensity: partial.rimIntensity,
    exposure: partial.exposure,
    fogColor: c(partial.fogColor),
    fogNearMul: env.fogNearMul,
    fogFarMul: env.fogFarMul,
    shadowStrength: env.shadowStrength,
    cloudLit: c(partial.cloudLit),
    cloudShade: c(partial.cloudShade),
    waterDeep: c(env.waterDeep),
    waterOcean: c(env.waterOcean),
    waterLagoon: c(env.waterLagoon),
    waterShallow: c(env.waterShallow),
    waterShelf: c(env.waterShelf),
    waterFoamColor: c(env.waterFoamColor),
    waterBrightness: partial.waterBrightness,
    waterTint: c(partial.waterTint),
    waterTintMix: partial.waterTintMix,
    waterSunColor: c(partial.waterSunColor),
    waterSpecularIntensity: partial.waterSpecularIntensity,
    waterFresnelStrength: env.waterFresnelStrength,
    waterCausticIntensity: env.waterCausticIntensity,
    waveBandIntensity: env.waveBandIntensity,
    foamBrightness: env.foamBrightness,
    waterPaletteMix: env.waterPaletteMix,
    skyFresnelColor: c(partial.skyFresnelColor),
    beachTint: c(env.beachTint),
    boardTintMix: env.boardTintMix,
  };
}

/** Authoritative look targets — tropical hex-board day cycle. */
export const ATMOSPHERE_PRESETS: Record<DayScheme, AtmosphereSnapshot> = {
  morning: snap('morning', {
    skyZenith: '#5aa8e0',
    skyMid: '#b0d8f5',
    skyHorizon: '#ffc090',
    sunDiscColor: '#ffe8b0',
    sunDiscIntensity: 0.85,
    sunGlowIntensity: 0.7,
    sunDiscPower: 24,
    horizonHaze: 0.42,
    horizonHazeWidth: 0.32,
    starsIntensity: 0,
    sunAltitude: 0.2,
    sunAzimuth: -0.85,
    sunColor: '#ffd4a0',
    sunIntensity: 1.05,
    hemiSky: '#ffd4b0',
    hemiGround: '#8a9a5a',
    hemiIntensity: 0.8,
    fillColor: '#a0c0e0',
    fillIntensity: 0.3,
    rimColor: '#ffc090',
    rimIntensity: 0.18,
    exposure: 1.0,
    fogColor: '#f0d8c0',
    cloudLit: '#fff6ec',
    cloudShade: '#e0c4a8',
    waterBrightness: 0.92,
    waterTint: '#ffe4c8',
    waterTintMix: 0.18,
    waterSunColor: '#fff0d0',
    waterSpecularIntensity: 0.2,
    skyFresnelColor: '#d0c0a8',
  }),

  afternoon: snap('afternoon', {
    skyZenith: '#4aa8e0',
    skyMid: '#7ec8ea',
    skyHorizon: '#d8eef8',
    sunDiscColor: '#fff3c0',
    sunDiscIntensity: 0.55,
    sunGlowIntensity: 0.35,
    sunDiscPower: 40,
    horizonHaze: 0.22,
    horizonHazeWidth: 0.18,
    starsIntensity: 0,
    sunAltitude: 0.82,
    sunAzimuth: 0.55,
    sunColor: '#fff2d6',
    sunIntensity: 1.45,
    hemiSky: '#ffe6c8',
    hemiGround: '#7a9a5a',
    hemiIntensity: 0.95,
    fillColor: '#a8d4e8',
    fillIntensity: 0.35,
    rimColor: '#c8e8f8',
    rimIntensity: 0.12,
    exposure: 1.15,
    fogColor: '#d6e8f2',
    cloudLit: '#d4dde8',
    cloudShade: '#8496ab',
    waterBrightness: 1,
    waterTint: '#ffffff',
    waterTintMix: 0,
    waterSunColor: '#fff6e8',
    waterSpecularIntensity: 0.28,
    skyFresnelColor: '#62e7e0',
  }),

  evening: snap('evening', {
    skyZenith: '#1e2a6e',
    skyMid: '#7a4a9a',
    skyHorizon: '#ff7a3a',
    sunDiscColor: '#ffc878',
    sunDiscIntensity: 1.1,
    sunGlowIntensity: 1.0,
    sunDiscPower: 18,
    horizonHaze: 0.55,
    horizonHazeWidth: 0.42,
    starsIntensity: 0.35,
    sunAltitude: 0.08,
    sunAzimuth: 2.4,
    sunColor: '#ff9848',
    sunIntensity: 0.75,
    hemiSky: '#d88868',
    hemiGround: '#3a4038',
    hemiIntensity: 0.55,
    fillColor: '#5060a8',
    fillIntensity: 0.48,
    rimColor: '#ff7a3a',
    rimIntensity: 0.28,
    exposure: 0.88,
    fogColor: '#b88870',
    cloudLit: '#ffd0b8',
    cloudShade: '#8060a0',
    waterBrightness: 0.55,
    waterTint: '#ff9050',
    waterTintMix: 0.35,
    waterSunColor: '#ffc080',
    waterSpecularIntensity: 0.42,
    skyFresnelColor: '#d07080',
  }),

  night: snap('night', {
    skyZenith: '#050814',
    skyMid: '#121a42',
    skyHorizon: '#1a2048',
    sunDiscColor: '#eef4ff',
    sunDiscIntensity: 1.15,
    sunGlowIntensity: 0.35,
    sunDiscPower: 56,
    horizonHaze: 0.14,
    horizonHazeWidth: 0.22,
    starsIntensity: 1,
    sunAltitude: 0.58,
    sunAzimuth: -2.2,
    sunColor: '#b0c4f0',
    sunIntensity: 0.22,
    hemiSky: '#1c2848',
    hemiGround: '#0c1418',
    hemiIntensity: 0.32,
    fillColor: '#304078',
    fillIntensity: 0.18,
    rimColor: '#6a7ab8',
    rimIntensity: 0.22,
    exposure: 0.58,
    fogColor: '#0c1430',
    cloudLit: '#c0c8e8',
    cloudShade: '#404868',
    waterBrightness: 0.22,
    waterTint: '#101830',
    waterTintMix: 0.62,
    waterSunColor: '#c8d8ff',
    waterSpecularIntensity: 0.48,
    skyFresnelColor: '#283878',
  }),
};

/** Phase 0..1 keyframes around the day: morning → afternoon → evening → night → morning. */
const SCHEME_PHASE: Record<DayScheme, number> = {
  morning: 0,
  afternoon: 0.25,
  evening: 0.5,
  night: 0.75,
};

const COLOR_KEYS = [
  'skyZenith',
  'skyMid',
  'skyHorizon',
  'sunDiscColor',
  'sunColor',
  'hemiSky',
  'hemiGround',
  'fillColor',
  'rimColor',
  'fogColor',
  'cloudLit',
  'cloudShade',
  'waterDeep',
  'waterOcean',
  'waterLagoon',
  'waterShallow',
  'waterShelf',
  'waterFoamColor',
  'waterTint',
  'waterSunColor',
  'skyFresnelColor',
  'beachTint',
] as const;

const NUMBER_KEYS = [
  'sunDiscIntensity',
  'sunGlowIntensity',
  'sunDiscPower',
  'horizonHaze',
  'horizonHazeWidth',
  'starsIntensity',
  'sunAltitude',
  'sunAzimuth',
  'sunIntensity',
  'hemiIntensity',
  'fillIntensity',
  'rimIntensity',
  'exposure',
  'fogNearMul',
  'fogFarMul',
  'shadowStrength',
  'waterBrightness',
  'waterTintMix',
  'waterSpecularIntensity',
  'waterFresnelStrength',
  'waterCausticIntensity',
  'waveBandIntensity',
  'foamBrightness',
  'waterPaletteMix',
  'boardTintMix',
] as const;

export function cloneSnapshot(src: AtmosphereSnapshot): AtmosphereSnapshot {
  const out = { ...src } as AtmosphereSnapshot;
  for (const key of COLOR_KEYS) {
    out[key] = src[key].clone();
  }
  return out;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Blend A→B into `out` (mutates out). */
export function lerpAtmosphere(
  a: AtmosphereSnapshot,
  b: AtmosphereSnapshot,
  t: number,
  out: AtmosphereSnapshot,
): AtmosphereSnapshot {
  const k = THREE.MathUtils.clamp(t, 0, 1);
  for (const key of COLOR_KEYS) {
    out[key].copy(a[key]).lerp(b[key], k);
  }
  for (const key of NUMBER_KEYS) {
    if (key === 'sunAzimuth') {
      out.sunAzimuth = lerpAngle(a.sunAzimuth, b.sunAzimuth, k);
    } else {
      out[key] = a[key] + (b[key] - a[key]) * k;
    }
  }
  return out;
}

function schemeAtPhase(phase: number): { a: DayScheme; b: DayScheme; t: number } {
  const p = ((phase % 1) + 1) % 1;
  const order = DAY_SCHEMES;
  for (let i = 0; i < order.length; i++) {
    const cur = order[i];
    const next = order[(i + 1) % order.length];
    const start = SCHEME_PHASE[cur];
    let end = SCHEME_PHASE[next];
    if (end <= start) end += 1;
    const local = p < start ? p + 1 : p;
    if (local >= start && local <= end) {
      const span = end - start || 1;
      return { a: cur, b: next, t: (local - start) / span };
    }
  }
  return { a: 'morning', b: 'afternoon', t: 0 };
}

export function sampleAtmosphereAtPhase(phase: number, out?: AtmosphereSnapshot): AtmosphereSnapshot {
  const { a, b, t } = schemeAtPhase(phase);
  const target = out ?? cloneSnapshot(ATMOSPHERE_PRESETS.afternoon);
  return lerpAtmosphere(ATMOSPHERE_PRESETS[a], ATMOSPHERE_PRESETS[b], t, target);
}

export function celestialDirection(alt: number, azimuth: number, out = new THREE.Vector3()): THREE.Vector3 {
  const y = THREE.MathUtils.clamp(alt, -0.35, 1);
  const xz = Math.sqrt(Math.max(0, 1 - y * y));
  return out.set(Math.cos(azimuth) * xz, y, Math.sin(azimuth) * xz).normalize();
}

export type TimeOfDayMode = DayScheme | 'cycle';

/**
 * Game-level day controller. Either holds a scheme (with smooth crossfade)
 * or slowly advances through a full day cycle.
 */
export class TimeOfDayController {
  /** 0..1 position in the day when mode === 'cycle'. */
  phase = SCHEME_PHASE.afternoon;
  mode: TimeOfDayMode = 'afternoon';
  /** Seconds for one full day when cycling. */
  dayLengthSec = 180;
  /** Seconds to ease into a picked scheme. */
  transitionSec = 4;

  private blendFrom = cloneSnapshot(ATMOSPHERE_PRESETS.afternoon);
  private blendTo = cloneSnapshot(ATMOSPHERE_PRESETS.afternoon);
  private current = cloneSnapshot(ATMOSPHERE_PRESETS.afternoon);
  private transitionT = 1;
  private transitioning = false;
  private activeTransitionSec = 4;
  private readonly celestial = new THREE.Vector3();

  constructor(mode: TimeOfDayMode = 'afternoon') {
    this.setMode(mode, 0);
  }

  getSnapshot(): AtmosphereSnapshot {
    return this.current;
  }

  getCelestialDirection(): THREE.Vector3 {
    return celestialDirection(this.current.sunAltitude, this.current.sunAzimuth, this.celestial);
  }

  setDayLength(seconds: number): void {
    this.dayLengthSec = Math.max(20, seconds);
  }

  setTransitionSec(seconds: number): void {
    this.transitionSec = Math.max(0.5, seconds);
  }

  /** Switch scheme or start cycling. durationSec=0 snaps. */
  setMode(mode: TimeOfDayMode, durationSec?: number): void {
    const dur = durationSec ?? this.transitionSec;
    this.mode = mode;

    if (mode === 'cycle') {
      // Keep current look; resume advancing from nearest phase.
      this.transitioning = false;
      this.transitionT = 1;
      sampleAtmosphereAtPhase(this.phase, this.current);
      return;
    }

    this.phase = SCHEME_PHASE[mode];
    if (dur <= 0) {
      this.transitioning = false;
      this.transitionT = 1;
      this.current = cloneSnapshot(ATMOSPHERE_PRESETS[mode]);
      this.blendFrom = cloneSnapshot(this.current);
      this.blendTo = cloneSnapshot(this.current);
      return;
    }

    this.blendFrom = cloneSnapshot(this.current);
    this.blendTo = cloneSnapshot(ATMOSPHERE_PRESETS[mode]);
    this.activeTransitionSec = dur;
    this.transitionT = 0;
    this.transitioning = true;
  }

  update(dt: number): AtmosphereSnapshot {
    if (this.mode === 'cycle') {
      const len = Math.max(20, this.dayLengthSec);
      this.phase = (this.phase + dt / len) % 1;
      sampleAtmosphereAtPhase(this.phase, this.current);
      return this.current;
    }

    if (this.transitioning) {
      const dur = Math.max(0.5, this.activeTransitionSec);
      this.transitionT = Math.min(1, this.transitionT + dt / dur);
      // Smoothstep ease
      const t = this.transitionT * this.transitionT * (3 - 2 * this.transitionT);
      lerpAtmosphere(this.blendFrom, this.blendTo, t, this.current);
      if (this.transitionT >= 1) this.transitioning = false;
    }

    return this.current;
  }
}
