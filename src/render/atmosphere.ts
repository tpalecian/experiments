import * as THREE from 'three';

/** Fixed day schemes the game can hold or cycle through. */
export type DayScheme = 'morning' | 'afternoon' | 'evening' | 'night';

export const DAY_SCHEMES: DayScheme[] = ['morning', 'afternoon', 'evening', 'night'];

/**
 * Full environment snapshot for one moment in the day.
 * Applied every frame so sky, lights, fog, water, and clouds stay coherent.
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
  exposure: number;
  fogColor: THREE.Color;

  // Clouds
  cloudLit: THREE.Color;
  cloudShade: THREE.Color;

  // Water atmosphere (tints style-crafted base colors)
  waterBrightness: number;
  waterTint: THREE.Color;
  waterTintMix: number;
  waterSunColor: THREE.Color;
  waterSpecularIntensity: number;
  waterFresnelStrength: number;
  waterCausticIntensity: number;
  skyFresnelColor: THREE.Color;
}

function c(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

function snap(partial: {
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
  exposure: number;
  fogColor: string;
  cloudLit: string;
  cloudShade: string;
  waterBrightness: number;
  waterTint: string;
  waterTintMix: number;
  waterSunColor: string;
  waterSpecularIntensity: number;
  waterFresnelStrength: number;
  waterCausticIntensity: number;
  skyFresnelColor: string;
}): AtmosphereSnapshot {
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
    exposure: partial.exposure,
    fogColor: c(partial.fogColor),
    cloudLit: c(partial.cloudLit),
    cloudShade: c(partial.cloudShade),
    waterBrightness: partial.waterBrightness,
    waterTint: c(partial.waterTint),
    waterTintMix: partial.waterTintMix,
    waterSunColor: c(partial.waterSunColor),
    waterSpecularIntensity: partial.waterSpecularIntensity,
    waterFresnelStrength: partial.waterFresnelStrength,
    waterCausticIntensity: partial.waterCausticIntensity,
    skyFresnelColor: c(partial.skyFresnelColor),
  };
}

/** Authoritative look targets — tropical island day cycle. */
export const ATMOSPHERE_PRESETS: Record<DayScheme, AtmosphereSnapshot> = {
  morning: snap({
    skyZenith: '#6eb8e8',
    skyMid: '#a8d4f0',
    skyHorizon: '#ffd2a8',
    sunDiscColor: '#ffe8b8',
    sunDiscIntensity: 0.7,
    sunGlowIntensity: 0.55,
    sunDiscPower: 28,
    horizonHaze: 0.45,
    horizonHazeWidth: 0.22,
    starsIntensity: 0,
    sunAltitude: 0.22,
    sunAzimuth: -0.85,
    sunColor: '#ffe0b8',
    sunIntensity: 1.15,
    hemiSky: '#ffdcc0',
    hemiGround: '#8a9a5a',
    hemiIntensity: 0.85,
    fillColor: '#a8c8e0',
    fillIntensity: 0.28,
    exposure: 1.05,
    fogColor: '#e8d8c0',
    cloudLit: '#fff8f0',
    cloudShade: '#e0c8b0',
    waterBrightness: 0.95,
    waterTint: '#ffe8d0',
    waterTintMix: 0.12,
    waterSunColor: '#fff0d8',
    waterSpecularIntensity: 0.22,
    waterFresnelStrength: 0.14,
    waterCausticIntensity: 0.06,
    skyFresnelColor: '#c8e0f0',
  }),

  afternoon: snap({
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
    exposure: 1.15,
    fogColor: '#d6e8f2',
    cloudLit: '#fff5ff',
    cloudShade: '#d4c2ec',
    waterBrightness: 1,
    waterTint: '#ffffff',
    waterTintMix: 0,
    waterSunColor: '#fff6e8',
    waterSpecularIntensity: 0.28,
    waterFresnelStrength: 0.12,
    waterCausticIntensity: 0.08,
    skyFresnelColor: '#62e7e0',
  }),

  evening: snap({
    skyZenith: '#3a4a8a',
    skyMid: '#8a6aaa',
    skyHorizon: '#ff9a5a',
    sunDiscColor: '#ffd090',
    sunDiscIntensity: 0.85,
    sunGlowIntensity: 0.75,
    sunDiscPower: 22,
    horizonHaze: 0.65,
    horizonHazeWidth: 0.28,
    starsIntensity: 0.15,
    sunAltitude: 0.12,
    sunAzimuth: 2.4,
    sunColor: '#ffb070',
    sunIntensity: 0.95,
    hemiSky: '#e8a888',
    hemiGround: '#5a6a4a',
    hemiIntensity: 0.7,
    fillColor: '#6a80b8',
    fillIntensity: 0.4,
    exposure: 0.95,
    fogColor: '#c8a890',
    cloudLit: '#ffe0d0',
    cloudShade: '#b090b8',
    waterBrightness: 0.72,
    waterTint: '#ffb888',
    waterTintMix: 0.22,
    waterSunColor: '#ffd0a0',
    waterSpecularIntensity: 0.35,
    waterFresnelStrength: 0.18,
    waterCausticIntensity: 0.03,
    skyFresnelColor: '#c08090',
  }),

  night: snap({
    skyZenith: '#0c1230',
    skyMid: '#1a2458',
    skyHorizon: '#2a3068',
    sunDiscColor: '#e8f0ff',
    sunDiscIntensity: 0.9,
    sunGlowIntensity: 0.25,
    sunDiscPower: 48,
    horizonHaze: 0.12,
    horizonHazeWidth: 0.15,
    starsIntensity: 1,
    sunAltitude: 0.55,
    sunAzimuth: -2.2,
    sunColor: '#c8d8f8',
    sunIntensity: 0.35,
    hemiSky: '#304070',
    hemiGround: '#1a2830',
    hemiIntensity: 0.45,
    fillColor: '#405090',
    fillIntensity: 0.22,
    exposure: 0.72,
    fogColor: '#1a2448',
    cloudLit: '#d0d8f0',
    cloudShade: '#6870a0',
    waterBrightness: 0.38,
    waterTint: '#203060',
    waterTintMix: 0.45,
    waterSunColor: '#d0e0ff',
    waterSpecularIntensity: 0.4,
    waterFresnelStrength: 0.2,
    waterCausticIntensity: 0,
    skyFresnelColor: '#4050a0',
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
  'fogColor',
  'cloudLit',
  'cloudShade',
  'waterTint',
  'waterSunColor',
  'skyFresnelColor',
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
  'exposure',
  'waterBrightness',
  'waterTintMix',
  'waterSpecularIntensity',
  'waterFresnelStrength',
  'waterCausticIntensity',
] as const;

function cloneSnapshot(src: AtmosphereSnapshot): AtmosphereSnapshot {
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
  transitionSec = 8;

  private blendFrom = cloneSnapshot(ATMOSPHERE_PRESETS.afternoon);
  private blendTo = cloneSnapshot(ATMOSPHERE_PRESETS.afternoon);
  private current = cloneSnapshot(ATMOSPHERE_PRESETS.afternoon);
  private transitionT = 1;
  private transitioning = false;
  private activeTransitionSec = 8;
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
