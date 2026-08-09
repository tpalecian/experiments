/**
 * Deep craft configurator schema — category taxonomy for editing everything.
 *
 * Live UI still uses `StyleConfigurator` + `StyleConfig`. This module is the
 * target information architecture: well categorised, searchable, easy to use.
 * Hex tiles stay — craft look/motion on the board, not organic-island generation.
 * See docs/CONFIGURATOR.md.
 */

/** Top-level panel groups (order = display order). */
export type CraftCategoryId =
  | 'atmosphere'
  | 'skyClouds'
  | 'lighting'
  | 'fogPost'
  | 'water'
  | 'hexBoard'
  | 'motion'
  | 'audio'
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
    id: 'audio',
    title: 'Audio',
    blurb: 'Biome ambient beds, wind & sea gusts, hover previews.',
    rebuildsWorld: false,
    subsections: [
      { id: 'levels', title: 'Volume' },
      { id: 'hover', title: 'Hover preview' },
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
