/**
 * Deep craft configurator schema — category taxonomy for editing everything.
 *
 * Live UI still uses `StyleConfigurator` + `StyleConfig`. This module is the
 * target information architecture: well categorised, searchable, easy to use.
 * See docs/CONFIGURATOR.md.
 */

/** Top-level panel groups (order = display order). */
export type CraftCategoryId =
  | 'world'
  | 'atmosphere'
  | 'skyClouds'
  | 'lighting'
  | 'fogPost'
  | 'water'
  | 'coastBeach'
  | 'terrainBiome'
  | 'vegetation'
  | 'rocks'
  | 'roadsSettlements'
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
    id: 'world',
    title: 'World / Generation',
    blurb: 'Seed, mask, SDF, mesh — regenerates terrain. Use Apply.',
    rebuildsWorld: true,
    subsections: [
      { id: 'seed', title: 'Seed' },
      { id: 'mask', title: 'Island mask' },
      { id: 'smooth', title: 'Coast smooth' },
      { id: 'sdfMesh', title: 'SDF & mesh' },
      { id: 'height', title: 'Height curve' },
      { id: 'biomes', title: 'Biome soft masks' },
      { id: 'scatter', title: 'Trees & rocks' },
      { id: 'chunks', title: 'Chunks' },
    ],
  },
  {
    id: 'atmosphere',
    title: 'Atmosphere',
    blurb: 'Environment State only — never rebuilds the island.',
    rebuildsWorld: false,
    subsections: [
      { id: 'clock', title: 'Time of day' },
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
    blurb: 'Depth palette, swell, contour bands, foam, caustics.',
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
    id: 'coastBeach',
    title: 'Coast & Beaches',
    blurb: 'SDF sand bands — geometry static; colours can shift with day.',
    rebuildsWorld: false,
    subsections: [
      { id: 'bands', title: 'Sand bands' },
      { id: 'colors', title: 'Sand colours' },
    ],
  },
  {
    id: 'terrainBiome',
    title: 'Terrain & Biomes',
    blurb: 'Height curve and soft resource masks on land.',
    rebuildsWorld: false,
    subsections: [
      { id: 'height', title: 'Height curve' },
      { id: 'biomes', title: 'Biome colours' },
    ],
  },
  {
    id: 'vegetation',
    title: 'Vegetation',
    blurb: 'Instanced trees gated by slope, height, biome.',
    rebuildsWorld: false,
    subsections: [
      { id: 'scatter', title: 'Scatter' },
      { id: 'look', title: 'Look' },
    ],
  },
  {
    id: 'rocks',
    title: 'Rocks & Cliffs',
    blurb: 'Slope-driven rock scatter.',
    rebuildsWorld: false,
    subsections: [
      { id: 'scatter', title: 'Scatter' },
      { id: 'look', title: 'Look' },
    ],
  },
  {
    id: 'roadsSettlements',
    title: 'Roads & Settlements',
    blurb: 'Graph paths and junction buildings as world props.',
    rebuildsWorld: false,
    subsections: [
      { id: 'roads', title: 'Roads' },
      { id: 'buildings', title: 'Buildings' },
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
    blurb: 'Overlays for SDF, coastline, chunks, graph.',
    rebuildsWorld: false,
    subsections: [{ id: 'overlays', title: 'Overlays' }],
  },
];

export type CraftFieldKind = 'range' | 'color' | 'select' | 'toggle' | 'vector' | 'button';

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
  'generateVsLookSplit',
  'debounceLiveApply',
] as const;

export type CraftUxFeature = (typeof CRAFT_UX_FEATURES)[number];

export function getCraftCategory(id: CraftCategoryId): CraftCategory | undefined {
  return CRAFT_CATEGORIES.find((c) => c.id === id);
}
