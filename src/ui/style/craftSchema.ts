/**
 * Live craft configurator schema.
 *
 * `StyleConfigurator` renders from `CRAFT_CATEGORIES` + `CRAFT_FIELDS` only.
 * This file is the panel schema (id, title, blurb, and live knobs) — not an
 * aspirational IA dump. The island stays a seamless diorama over a hidden hex
 * graph. See docs/CONFIGURATOR.md.
 */

import type { StyleConfig } from '../../style/styleConfig';

/** Top-level panel groups that currently have fields (order = display order). */
export type CraftCategoryId =
  | 'atmosphere'
  | 'skyClouds'
  | 'lighting'
  | 'fogPost'
  | 'water'
  | 'hexBoard'
  | 'motion';

export interface CraftCategory {
  id: CraftCategoryId;
  title: string;
  blurb: string;
}

export const CRAFT_CATEGORIES: CraftCategory[] = [
  {
    id: 'atmosphere',
    title: 'Atmosphere',
    blurb: 'Environment State only — never rebuilds the island.',
  },
  {
    id: 'skyClouds',
    title: 'Sky & Clouds',
    blurb: 'Dome gradient, haze, stars, low-poly cloud flocks.',
  },
  {
    id: 'lighting',
    title: 'Lighting & Shadows',
    blurb: 'Stylized readability — direction, softness, opacity.',
  },
  {
    id: 'fogPost',
    title: 'Fog & Post',
    blurb: 'Fog follows the sky; exposure and grade sit here.',
  },
  {
    id: 'water',
    title: 'Water',
    blurb: 'Depth palette, swell, bands, foam, caustics around the island coast.',
  },
  {
    id: 'hexBoard',
    title: 'Island & Props',
    blurb: 'Hover glow, tokens, scatter props, harbors.',
  },
  {
    id: 'motion',
    title: 'Motion & Feedback',
    blurb: 'Piece tweens, robber hop, highlights, camera nudge.',
  },
];

export type CraftFieldKind = 'range' | 'color' | 'select';

export interface CraftField {
  category: CraftCategoryId;
  key: keyof StyleConfig;
  label: string;
  kind: CraftFieldKind;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  tags?: string[];
}

/** Live craft knobs — grouped by CRAFT_CATEGORIES. */
export const CRAFT_FIELDS: CraftField[] = [
  {
    category: 'atmosphere',
    key: 'timeOfDay',
    label: 'Scheme',
    kind: 'select',
    options: [
      { value: 'morning', label: 'Morning' },
      { value: 'afternoon', label: 'Afternoon' },
      { value: 'evening', label: 'Evening' },
      { value: 'night', label: 'Night' },
      { value: 'cycle', label: 'Slow day cycle' },
    ],
    tags: ['clock', 'day', 'night'],
  },
  {
    category: 'atmosphere',
    key: 'dayLengthSec',
    label: 'Full day (sec)',
    kind: 'range',
    min: 45,
    max: 600,
    step: 15,
  },
  {
    category: 'atmosphere',
    key: 'dayTransitionSec',
    label: 'Scheme blend (sec)',
    kind: 'range',
    min: 1,
    max: 30,
    step: 1,
  },
  {
    category: 'atmosphere',
    key: 'weather',
    label: 'Weather',
    kind: 'select',
    options: [
      { value: 'clear', label: 'Clear' },
      { value: 'overcast', label: 'Overcast' },
      { value: 'rain', label: 'Rain' },
    ],
    tags: ['weather', 'fog', 'sky'],
  },
  { category: 'skyClouds', key: 'skyZenith', label: 'Zenith (ref)', kind: 'color', tags: ['sky'] },
  { category: 'skyClouds', key: 'skyHorizon', label: 'Horizon (ref)', kind: 'color', tags: ['sky'] },
  { category: 'skyClouds', key: 'cloudCount', label: 'Count', kind: 'range', min: 2, max: 20, step: 1 },
  { category: 'skyClouds', key: 'cloudScale', label: 'Scale', kind: 'range', min: 0.4, max: 6, step: 0.1 },
  { category: 'skyClouds', key: 'cloudOrbitMin', label: 'Orbit min', kind: 'range', min: 8, max: 30, step: 1 },
  { category: 'skyClouds', key: 'cloudOrbitMax', label: 'Orbit max', kind: 'range', min: 12, max: 40, step: 1 },
  { category: 'skyClouds', key: 'cloudHeightMin', label: 'Height min', kind: 'range', min: 2, max: 20, step: 0.5 },
  { category: 'skyClouds', key: 'cloudHeightMax', label: 'Height max', kind: 'range', min: 4, max: 28, step: 0.5 },
  { category: 'skyClouds', key: 'cloudDriftSpeed', label: 'Drift', kind: 'range', min: 0, max: 0.02, step: 0.001 },
  { category: 'skyClouds', key: 'cloudPuffSegments', label: 'Puff detail', kind: 'range', min: 4, max: 12, step: 1 },
  {
    category: 'skyClouds',
    key: 'cloudPuffShape',
    label: 'Puff shape',
    kind: 'select',
    options: [
      { value: 'icosahedron', label: 'Low-poly facet' },
      { value: 'sphere', label: 'Soft sphere' },
    ],
  },
  { category: 'skyClouds', key: 'cloudLit', label: 'Lit color', kind: 'color' },
  { category: 'skyClouds', key: 'cloudShade', label: 'Shade color', kind: 'color' },
  { category: 'lighting', key: 'sunIntensity', label: 'Sun (ref)', kind: 'range', min: 0.4, max: 2.5, step: 0.05 },
  { category: 'lighting', key: 'hemiIntensity', label: 'Sky light (ref)', kind: 'range', min: 0.2, max: 1.6, step: 0.05 },
  {
    category: 'fogPost',
    key: 'exposure',
    label: 'Exposure (ref)',
    kind: 'range',
    min: 0.7,
    max: 1.8,
    step: 0.05,
    tags: ['post', 'fog'],
  },
  { category: 'water', key: 'waterDeepOcean', label: 'Deep ocean', kind: 'color', tags: ['palette'] },
  { category: 'water', key: 'waterOcean', label: 'Ocean', kind: 'color', tags: ['palette'] },
  { category: 'water', key: 'waterLagoon', label: 'Lagoon', kind: 'color', tags: ['palette'] },
  { category: 'water', key: 'waterShallow', label: 'Shallow', kind: 'color', tags: ['palette'] },
  { category: 'water', key: 'waterBeachEdge', label: 'Beach edge', kind: 'color', tags: ['palette'] },
  { category: 'water', key: 'waterFoam', label: 'Foam colour', kind: 'color' },
  { category: 'water', key: 'waterShoreWidth', label: 'Shore width', kind: 'range', min: 2, max: 22, step: 0.5 },
  { category: 'water', key: 'waterDeepFade', label: 'Deep fade', kind: 'range', min: 4, max: 30, step: 0.5 },
  { category: 'water', key: 'waterEdgeSoft', label: 'Horizon fade', kind: 'range', min: 20, max: 160, step: 2 },
  { category: 'water', key: 'waterShoreGlow', label: 'Shore glow', kind: 'range', min: 0, max: 0.4, step: 0.01 },
  { category: 'water', key: 'waterColorWave', label: 'Colour wave', kind: 'range', min: 0, max: 0.15, step: 0.005 },
  { category: 'water', key: 'waterWaveHeight', label: 'Swell height', kind: 'range', min: 0, max: 0.4, step: 0.01 },
  { category: 'water', key: 'waterWaveSpeed', label: 'Swell speed', kind: 'range', min: 0, max: 2.5, step: 0.05 },
  { category: 'water', key: 'waterSegments', label: 'Mesh detail', kind: 'range', min: 16, max: 128, step: 8 },
  { category: 'water', key: 'waterBandIntensity', label: 'Band brightness', kind: 'range', min: 0, max: 0.25, step: 0.005 },
  { category: 'water', key: 'waterBandScale', label: 'Band spacing', kind: 'range', min: 0.1, max: 1.5, step: 0.05 },
  { category: 'water', key: 'waterBandSpeed', label: 'Band speed', kind: 'range', min: 0, max: 1.2, step: 0.02 },
  { category: 'water', key: 'waterBandSoftness', label: 'Band softness', kind: 'range', min: 0.15, max: 0.95, step: 0.05 },
  { category: 'water', key: 'waterFresnelStrength', label: 'Fresnel', kind: 'range', min: 0, max: 0.45, step: 0.01 },
  { category: 'water', key: 'waterFresnelPower', label: 'Fresnel power', kind: 'range', min: 1, max: 8, step: 0.25 },
  { category: 'water', key: 'waterSpecularIntensity', label: 'Specular', kind: 'range', min: 0, max: 0.7, step: 0.02 },
  { category: 'water', key: 'waterSpecularPower', label: 'Specular softness', kind: 'range', min: 4, max: 64, step: 1 },
  { category: 'water', key: 'waterShoreFoam', label: 'Foam amount', kind: 'range', min: 0, max: 1.5, step: 0.05 },
  { category: 'water', key: 'waterFoamWidth', label: 'Foam width', kind: 'range', min: 0.2, max: 2.5, step: 0.05 },
  { category: 'water', key: 'waterFoamPulse', label: 'Foam pulse', kind: 'range', min: 0, max: 1, step: 0.05 },
  { category: 'water', key: 'waterFoamPulseSpeed', label: 'Foam pulse speed', kind: 'range', min: 0, max: 2, step: 0.05 },
  { category: 'water', key: 'waterCausticIntensity', label: 'Caustics', kind: 'range', min: 0, max: 0.25, step: 0.01 },
  { category: 'water', key: 'waterCausticScale', label: 'Caustic scale', kind: 'range', min: 0.15, max: 1.5, step: 0.05 },
  { category: 'water', key: 'waterCausticSpeed', label: 'Caustic speed', kind: 'range', min: 0, max: 1.2, step: 0.05 },
  { category: 'water', key: 'waterReflectStrength', label: 'Reflection', kind: 'range', min: 0, max: 1, step: 0.02, tags: ['bruno', 'mirror'] },
  { category: 'water', key: 'waterReflectDistort', label: 'Reflect distort', kind: 'range', min: 0, max: 0.12, step: 0.005, tags: ['bruno'] },
  { category: 'water', key: 'waterReflectBlur', label: 'Reflect blur', kind: 'range', min: 0, max: 0.04, step: 0.001, tags: ['bruno'] },
  { category: 'water', key: 'waterRippleFreq', label: 'Shore ripple freq', kind: 'range', min: 0.3, max: 4, step: 0.05, tags: ['bruno', 'ripple'] },
  { category: 'water', key: 'waterRippleSpeed', label: 'Shore ripple speed', kind: 'range', min: 0, max: 1.2, step: 0.02, tags: ['bruno'] },
  { category: 'water', key: 'waterRippleIntensity', label: 'Shore ripples', kind: 'range', min: 0, max: 1.2, step: 0.05, tags: ['bruno'] },
  { category: 'water', key: 'waterDriftIntensity', label: 'Drift waves', kind: 'range', min: 0, max: 1.2, step: 0.05, tags: ['bruno', 'wave'] },
  { category: 'water', key: 'waterDriftScale', label: 'Drift scale', kind: 'range', min: 0.05, max: 0.8, step: 0.01, tags: ['bruno'] },
  { category: 'water', key: 'waterDriftSpeed', label: 'Drift speed', kind: 'range', min: 0, max: 1.2, step: 0.05, tags: ['bruno'] },
  { category: 'hexBoard', key: 'hexHoverLift', label: 'Hover glow', kind: 'range', min: 0, max: 0.12, step: 0.005, tags: ['hex', 'hover'] },
  { category: 'hexBoard', key: 'productionPulseSec', label: 'Production pulse (sec)', kind: 'range', min: 0.4, max: 2.5, step: 0.05, tags: ['dice', 'token'] },
  { category: 'hexBoard', key: 'productionPulseStrength', label: 'Pulse strength', kind: 'range', min: 0, max: 1, step: 0.05, tags: ['dice', 'token'] },
  { category: 'hexBoard', key: 'harborBobAmp', label: 'Harbor bob', kind: 'range', min: 0, max: 0.1, step: 0.005 },
  { category: 'motion', key: 'motionPieceSpawnSec', label: 'Piece spawn (sec)', kind: 'range', min: 0.1, max: 1, step: 0.02 },
  { category: 'motion', key: 'motionRoadSpawnSec', label: 'Road spawn (sec)', kind: 'range', min: 0.08, max: 0.8, step: 0.02 },
  { category: 'motion', key: 'motionUpgradeSec', label: 'City upgrade (sec)', kind: 'range', min: 0.15, max: 1, step: 0.02 },
  { category: 'motion', key: 'motionRobberHopSec', label: 'Robber hop (sec)', kind: 'range', min: 0.2, max: 1.2, step: 0.02 },
  { category: 'motion', key: 'motionHighlightFade', label: 'Highlight fade speed', kind: 'range', min: 2, max: 20, step: 0.5 },
  { category: 'motion', key: 'motionCameraNudgeSec', label: 'Camera nudge (sec)', kind: 'range', min: 0.15, max: 1.5, step: 0.05 },
  { category: 'motion', key: 'motionCameraNudgeBlend', label: 'Camera center blend', kind: 'range', min: 0.2, max: 0.9, step: 0.05 },
];
