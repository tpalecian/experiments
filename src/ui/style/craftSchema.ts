/**
 * Deep craft configurator schema — category taxonomy for editing everything.
 *
 * Live UI (`StyleConfigurator`) renders from `CRAFT_CATEGORIES` + `CRAFT_FIELDS`.
 * Hex tiles stay — craft look/motion on the board, not organic-island generation.
 * See docs/CONFIGURATOR.md.
 */

import type { StyleConfig } from '../../style/styleConfig';

/** Top-level panel groups (order = display order). */
export type CraftCategoryId =
  | 'atmosphere'
  | 'skyClouds'
  | 'lighting'
  | 'fogPost'
  | 'water'
  | 'hexBoard'
  | 'motion'
  | 'camera'
  | 'debug';

export interface CraftCategory {
  id: CraftCategoryId;
  title: string;
  /** Short blurb under the category header. */
  blurb: string;
  /** When true, edits may regenerate world data — gate behind Apply. */
  rebuildsWorld: boolean;
  subsections: { id: string; title: string }[];
}

/**
 * Authoritative category map for the deep configurator.
 * Add fields under these subsections as systems land — never a flat dump.
 */
export const CRAFT_CATEGORIES: CraftCategory[] = [
  {
    id: 'atmosphere',
    title: 'Atmosphere',
    blurb: 'Environment State only — never rebuilds the hex board.',
    rebuildsWorld: false,
    subsections: [
      { id: 'clock', title: 'Time of day' },
      { id: 'weather', title: 'Weather' },
      { id: 'sunMoon', title: 'Sun & moon' },
      { id: 'ambient', title: 'Ambient & fill' },
      { id: 'waterResponse', title: 'Water response' },
      { id: 'bandFoamResponse', title: 'Bands & foam response' },
    ],
  },
  {
    id: 'skyClouds',
    title: 'Sky & Clouds',
    blurb: 'Dome gradient, haze, stars, low-poly cloud flocks.',
    rebuildsWorld: false,
    subsections: [
      { id: 'sky', title: 'Sky' },
      { id: 'clouds', title: 'Clouds' },
    ],
  },
  {
    id: 'lighting',
    title: 'Lighting & Shadows',
    blurb: 'Stylized readability — direction, softness, opacity.',
    rebuildsWorld: false,
    subsections: [
      { id: 'lights', title: 'Lights' },
      { id: 'shadows', title: 'Shadows' },
    ],
  },
  {
    id: 'fogPost',
    title: 'Fog & Post',
    blurb: 'Fog follows the sky; exposure and grade sit here.',
    rebuildsWorld: false,
    subsections: [
      { id: 'fog', title: 'Fog' },
      { id: 'post', title: 'Post' },
    ],
  },
  {
    id: 'water',
    title: 'Water',
    blurb: 'Depth palette, swell, bands, foam, caustics around hex land.',
    rebuildsWorld: false,
    subsections: [
      { id: 'colors', title: 'Depth colours' },
      { id: 'depth', title: 'Depth & shore' },
      { id: 'motion', title: 'Motion' },
      { id: 'bands', title: 'Wave bands' },
      { id: 'light', title: 'Fresnel & specular' },
      { id: 'foamCaustics', title: 'Foam & caustics' },
    ],
  },
  {
    id: 'hexBoard',
    title: 'Hex Board & Props',
    blurb: 'Tile colours, skirts, tokens, scatter props, harbors.',
    rebuildsWorld: false,
    subsections: [
      { id: 'tiles', title: 'Tiles' },
      { id: 'tokens', title: 'Number tokens' },
      { id: 'props', title: 'Props' },
      { id: 'harbors', title: 'Harbors' },
    ],
  },
  {
    id: 'motion',
    title: 'Motion & Feedback',
    blurb: 'Piece tweens, robber hop, highlights, camera nudge.',
    rebuildsWorld: false,
    subsections: [
      { id: 'pieces', title: 'Pieces' },
      { id: 'robber', title: 'Robber' },
      { id: 'highlights', title: 'Highlights' },
      { id: 'cameraNudge', title: 'Camera nudge' },
    ],
  },
  {
    id: 'camera',
    title: 'Camera',
    blurb: 'Framing and orbit limits.',
    rebuildsWorld: false,
    subsections: [{ id: 'orbit', title: 'Orbit' }],
  },
  {
    id: 'debug',
    title: 'Debug',
    blurb: 'Pickables, markers, wireframe, timing overlays.',
    rebuildsWorld: false,
    subsections: [{ id: 'overlays', title: 'Overlays' }],
  },
];

export type CraftFieldKind = 'range' | 'color' | 'select' | 'toggle' | 'vector' | 'button';

export interface CraftField {
  category: CraftCategoryId;
  subsection: string;
  key: keyof StyleConfig;
  label: string;
  kind: 'range' | 'color' | 'select';
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
    subsection: 'clock',
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
    subsection: 'clock',
    key: 'dayLengthSec',
    label: 'Full day (sec)',
    kind: 'range',
    min: 45,
    max: 600,
    step: 15,
  },
  {
    category: 'atmosphere',
    subsection: 'clock',
    key: 'dayTransitionSec',
    label: 'Scheme blend (sec)',
    kind: 'range',
    min: 1,
    max: 30,
    step: 1,
  },
  {
    category: 'atmosphere',
    subsection: 'weather',
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
  { category: 'skyClouds', subsection: 'sky', key: 'skyZenith', label: 'Zenith (ref)', kind: 'color', tags: ['sky'] },
  { category: 'skyClouds', subsection: 'sky', key: 'skyHorizon', label: 'Horizon (ref)', kind: 'color', tags: ['sky'] },
  { category: 'skyClouds', subsection: 'clouds', key: 'cloudCount', label: 'Count', kind: 'range', min: 2, max: 20, step: 1 },
  { category: 'skyClouds', subsection: 'clouds', key: 'cloudScale', label: 'Scale', kind: 'range', min: 0.4, max: 6, step: 0.1 },
  { category: 'skyClouds', subsection: 'clouds', key: 'cloudOrbitMin', label: 'Orbit min', kind: 'range', min: 8, max: 30, step: 1 },
  { category: 'skyClouds', subsection: 'clouds', key: 'cloudOrbitMax', label: 'Orbit max', kind: 'range', min: 12, max: 40, step: 1 },
  { category: 'skyClouds', subsection: 'clouds', key: 'cloudHeightMin', label: 'Height min', kind: 'range', min: 2, max: 20, step: 0.5 },
  { category: 'skyClouds', subsection: 'clouds', key: 'cloudHeightMax', label: 'Height max', kind: 'range', min: 4, max: 28, step: 0.5 },
  { category: 'skyClouds', subsection: 'clouds', key: 'cloudDriftSpeed', label: 'Drift', kind: 'range', min: 0, max: 0.02, step: 0.001 },
  { category: 'skyClouds', subsection: 'clouds', key: 'cloudPuffSegments', label: 'Puff detail', kind: 'range', min: 4, max: 12, step: 1 },
  {
    category: 'skyClouds',
    subsection: 'clouds',
    key: 'cloudPuffShape',
    label: 'Puff shape',
    kind: 'select',
    options: [
      { value: 'icosahedron', label: 'Low-poly facet' },
      { value: 'sphere', label: 'Soft sphere' },
    ],
  },
  { category: 'skyClouds', subsection: 'clouds', key: 'cloudLit', label: 'Lit color', kind: 'color' },
  { category: 'skyClouds', subsection: 'clouds', key: 'cloudShade', label: 'Shade color', kind: 'color' },
  { category: 'lighting', subsection: 'lights', key: 'exposure', label: 'Exposure (ref)', kind: 'range', min: 0.7, max: 1.8, step: 0.05 },
  { category: 'lighting', subsection: 'lights', key: 'sunIntensity', label: 'Sun (ref)', kind: 'range', min: 0.4, max: 2.5, step: 0.05 },
  { category: 'lighting', subsection: 'lights', key: 'hemiIntensity', label: 'Sky light (ref)', kind: 'range', min: 0.2, max: 1.6, step: 0.05 },
  {
    category: 'fogPost',
    subsection: 'post',
    key: 'exposure',
    label: 'Exposure (ref)',
    kind: 'range',
    min: 0.7,
    max: 1.8,
    step: 0.05,
    tags: ['post', 'fog'],
  },
  { category: 'water', subsection: 'colors', key: 'waterDeepOcean', label: 'Deep ocean', kind: 'color', tags: ['palette'] },
  { category: 'water', subsection: 'colors', key: 'waterOcean', label: 'Ocean', kind: 'color', tags: ['palette'] },
  { category: 'water', subsection: 'colors', key: 'waterLagoon', label: 'Lagoon', kind: 'color', tags: ['palette'] },
  { category: 'water', subsection: 'colors', key: 'waterShallow', label: 'Shallow', kind: 'color', tags: ['palette'] },
  { category: 'water', subsection: 'colors', key: 'waterBeachEdge', label: 'Beach edge', kind: 'color', tags: ['palette'] },
  { category: 'water', subsection: 'colors', key: 'waterFoam', label: 'Foam colour', kind: 'color' },
  { category: 'water', subsection: 'depth', key: 'waterShoreWidth', label: 'Shore width', kind: 'range', min: 2, max: 22, step: 0.5 },
  { category: 'water', subsection: 'depth', key: 'waterDeepFade', label: 'Deep fade', kind: 'range', min: 4, max: 30, step: 0.5 },
  { category: 'water', subsection: 'depth', key: 'waterEdgeSoft', label: 'Horizon fade', kind: 'range', min: 20, max: 160, step: 2 },
  { category: 'water', subsection: 'depth', key: 'waterShoreGlow', label: 'Shore glow', kind: 'range', min: 0, max: 0.4, step: 0.01 },
  { category: 'water', subsection: 'motion', key: 'waterColorWave', label: 'Colour wave', kind: 'range', min: 0, max: 0.15, step: 0.005 },
  { category: 'water', subsection: 'motion', key: 'waterWaveHeight', label: 'Swell height', kind: 'range', min: 0, max: 0.4, step: 0.01 },
  { category: 'water', subsection: 'motion', key: 'waterWaveSpeed', label: 'Swell speed', kind: 'range', min: 0, max: 2.5, step: 0.05 },
  { category: 'water', subsection: 'motion', key: 'waterSegments', label: 'Mesh detail', kind: 'range', min: 16, max: 128, step: 8 },
  { category: 'water', subsection: 'bands', key: 'waterBandIntensity', label: 'Band brightness', kind: 'range', min: 0, max: 0.25, step: 0.005 },
  { category: 'water', subsection: 'bands', key: 'waterBandScale', label: 'Band spacing', kind: 'range', min: 0.1, max: 1.5, step: 0.05 },
  { category: 'water', subsection: 'bands', key: 'waterBandSpeed', label: 'Band speed', kind: 'range', min: 0, max: 1.2, step: 0.02 },
  { category: 'water', subsection: 'bands', key: 'waterBandSoftness', label: 'Band softness', kind: 'range', min: 0.15, max: 0.95, step: 0.05 },
  { category: 'water', subsection: 'light', key: 'waterFresnelStrength', label: 'Fresnel', kind: 'range', min: 0, max: 0.45, step: 0.01 },
  { category: 'water', subsection: 'light', key: 'waterFresnelPower', label: 'Fresnel power', kind: 'range', min: 1, max: 8, step: 0.25 },
  { category: 'water', subsection: 'light', key: 'waterSpecularIntensity', label: 'Specular', kind: 'range', min: 0, max: 0.7, step: 0.02 },
  { category: 'water', subsection: 'light', key: 'waterSpecularPower', label: 'Specular softness', kind: 'range', min: 4, max: 64, step: 1 },
  { category: 'water', subsection: 'foamCaustics', key: 'waterShoreFoam', label: 'Foam amount', kind: 'range', min: 0, max: 1.5, step: 0.05 },
  { category: 'water', subsection: 'foamCaustics', key: 'waterFoamWidth', label: 'Foam width', kind: 'range', min: 0.2, max: 2.5, step: 0.05 },
  { category: 'water', subsection: 'foamCaustics', key: 'waterFoamPulse', label: 'Foam pulse', kind: 'range', min: 0, max: 1, step: 0.05 },
  { category: 'water', subsection: 'foamCaustics', key: 'waterFoamPulseSpeed', label: 'Foam pulse speed', kind: 'range', min: 0, max: 2, step: 0.05 },
  { category: 'water', subsection: 'foamCaustics', key: 'waterCausticIntensity', label: 'Caustics', kind: 'range', min: 0, max: 0.25, step: 0.01 },
  { category: 'water', subsection: 'foamCaustics', key: 'waterCausticScale', label: 'Caustic scale', kind: 'range', min: 0.15, max: 1.5, step: 0.05 },
  { category: 'water', subsection: 'foamCaustics', key: 'waterCausticSpeed', label: 'Caustic speed', kind: 'range', min: 0, max: 1.2, step: 0.05 },
  { category: 'water', subsection: 'light', key: 'waterReflectStrength', label: 'Reflection', kind: 'range', min: 0, max: 1, step: 0.02, tags: ['bruno', 'mirror'] },
  { category: 'water', subsection: 'light', key: 'waterReflectDistort', label: 'Reflect distort', kind: 'range', min: 0, max: 0.12, step: 0.005, tags: ['bruno'] },
  { category: 'water', subsection: 'light', key: 'waterReflectBlur', label: 'Reflect blur', kind: 'range', min: 0, max: 0.04, step: 0.001, tags: ['bruno'] },
  { category: 'water', subsection: 'motion', key: 'waterRippleFreq', label: 'Shore ripple freq', kind: 'range', min: 0.3, max: 4, step: 0.05, tags: ['bruno', 'ripple'] },
  { category: 'water', subsection: 'motion', key: 'waterRippleSpeed', label: 'Shore ripple speed', kind: 'range', min: 0, max: 1.2, step: 0.02, tags: ['bruno'] },
  { category: 'water', subsection: 'motion', key: 'waterRippleIntensity', label: 'Shore ripples', kind: 'range', min: 0, max: 1.2, step: 0.05, tags: ['bruno'] },
  { category: 'water', subsection: 'motion', key: 'waterDriftIntensity', label: 'Drift waves', kind: 'range', min: 0, max: 1.2, step: 0.05, tags: ['bruno', 'wave'] },
  { category: 'water', subsection: 'motion', key: 'waterDriftScale', label: 'Drift scale', kind: 'range', min: 0.05, max: 0.8, step: 0.01, tags: ['bruno'] },
  { category: 'water', subsection: 'motion', key: 'waterDriftSpeed', label: 'Drift speed', kind: 'range', min: 0, max: 1.2, step: 0.05, tags: ['bruno'] },
  { category: 'hexBoard', subsection: 'tiles', key: 'hexHoverLift', label: 'Hover glow', kind: 'range', min: 0, max: 0.12, step: 0.005, tags: ['hex', 'hover'] },
  { category: 'hexBoard', subsection: 'tokens', key: 'productionPulseSec', label: 'Production pulse (sec)', kind: 'range', min: 0.4, max: 2.5, step: 0.05, tags: ['dice', 'token'] },
  { category: 'hexBoard', subsection: 'tokens', key: 'productionPulseStrength', label: 'Pulse strength', kind: 'range', min: 0, max: 1, step: 0.05, tags: ['dice', 'token'] },
  { category: 'hexBoard', subsection: 'harbors', key: 'harborBobAmp', label: 'Harbor bob', kind: 'range', min: 0, max: 0.1, step: 0.005 },
  { category: 'motion', subsection: 'pieces', key: 'motionPieceSpawnSec', label: 'Piece spawn (sec)', kind: 'range', min: 0.1, max: 1, step: 0.02 },
  { category: 'motion', subsection: 'pieces', key: 'motionRoadSpawnSec', label: 'Road spawn (sec)', kind: 'range', min: 0.08, max: 0.8, step: 0.02 },
  { category: 'motion', subsection: 'pieces', key: 'motionUpgradeSec', label: 'City upgrade (sec)', kind: 'range', min: 0.15, max: 1, step: 0.02 },
  { category: 'motion', subsection: 'robber', key: 'motionRobberHopSec', label: 'Robber hop (sec)', kind: 'range', min: 0.2, max: 1.2, step: 0.02 },
  { category: 'motion', subsection: 'highlights', key: 'motionHighlightFade', label: 'Highlight fade speed', kind: 'range', min: 2, max: 20, step: 0.5 },
  { category: 'motion', subsection: 'cameraNudge', key: 'motionCameraNudgeSec', label: 'Camera nudge (sec)', kind: 'range', min: 0.15, max: 1.5, step: 0.05 },
  { category: 'motion', subsection: 'cameraNudge', key: 'motionCameraNudgeBlend', label: 'Camera center blend', kind: 'range', min: 0.2, max: 0.9, step: 0.05 },
];

/** UX features the deep panel must support. */
export const CRAFT_UX_FEATURES = [
  'collapsibleCategories',
  'searchFilter',
  'resetSection',
  'resetAll',
  'importExportJson',
  'presets',
  'modifiedBadges',
  'tooltips',
  'advancedToggle',
  'lookVsMotionSplit',
  'debounceLiveApply',
] as const;

export type CraftUxFeature = (typeof CRAFT_UX_FEATURES)[number];

export function getCraftCategory(id: CraftCategoryId): CraftCategory | undefined {
  return CRAFT_CATEGORIES.find((c) => c.id === id);
}
