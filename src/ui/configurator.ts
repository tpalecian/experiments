/**
 * Deep craft configurator — categorised, searchable, Generate vs Look.
 * See docs/CONFIGURATOR.md and craftSchema.ts.
 */

import type { StyleConfig } from '../render/styleConfig';
import {
  DEFAULT_STYLE_CONFIG,
  loadStyleConfig,
  resetStyleConfig,
  saveStyleConfig,
  WORLD_REBUILD_KEYS,
} from '../render/styleConfig';
import { CRAFT_CATEGORIES, type CraftCategoryId } from './craftSchema';

type Listener = (config: StyleConfig, meta?: { rebuildWorld?: boolean }) => void;

type FieldKind = 'range' | 'color' | 'select' | 'toggle';

interface FieldDef {
  key: keyof StyleConfig;
  label: string;
  kind: FieldKind;
  category: CraftCategoryId;
  subsection: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  tooltip?: string;
  rebuildsWorld?: boolean;
}

const FIELDS: FieldDef[] = [
  // Atmosphere
  {
    key: 'timeOfDay',
    label: 'Scheme',
    kind: 'select',
    category: 'atmosphere',
    subsection: 'clock',
    options: [
      { value: 'morning', label: 'Morning' },
      { value: 'afternoon', label: 'Afternoon' },
      { value: 'evening', label: 'Evening' },
      { value: 'night', label: 'Night' },
      { value: 'cycle', label: 'Slow day cycle' },
    ],
  },
  {
    key: 'dayLengthSec',
    label: 'Full day (sec)',
    kind: 'range',
    category: 'atmosphere',
    subsection: 'clock',
    min: 45,
    max: 600,
    step: 15,
  },
  {
    key: 'dayTransitionSec',
    label: 'Scheme blend (sec)',
    kind: 'range',
    category: 'atmosphere',
    subsection: 'clock',
    min: 1,
    max: 30,
    step: 1,
  },
  // Sky & clouds
  {
    key: 'cloudCount',
    label: 'Count',
    kind: 'range',
    category: 'skyClouds',
    subsection: 'clouds',
    min: 2,
    max: 20,
    step: 1,
  },
  {
    key: 'cloudScale',
    label: 'Scale',
    kind: 'range',
    category: 'skyClouds',
    subsection: 'clouds',
    min: 0.4,
    max: 6,
    step: 0.1,
  },
  {
    key: 'cloudOrbitMin',
    label: 'Orbit min',
    kind: 'range',
    category: 'skyClouds',
    subsection: 'clouds',
    min: 8,
    max: 30,
    step: 1,
  },
  {
    key: 'cloudOrbitMax',
    label: 'Orbit max',
    kind: 'range',
    category: 'skyClouds',
    subsection: 'clouds',
    min: 12,
    max: 40,
    step: 1,
  },
  {
    key: 'cloudHeightMin',
    label: 'Height min',
    kind: 'range',
    category: 'skyClouds',
    subsection: 'clouds',
    min: 2,
    max: 20,
    step: 0.5,
  },
  {
    key: 'cloudHeightMax',
    label: 'Height max',
    kind: 'range',
    category: 'skyClouds',
    subsection: 'clouds',
    min: 4,
    max: 28,
    step: 0.5,
  },
  {
    key: 'cloudDriftSpeed',
    label: 'Drift',
    kind: 'range',
    category: 'skyClouds',
    subsection: 'clouds',
    min: 0,
    max: 0.02,
    step: 0.001,
  },
  {
    key: 'cloudPuffSegments',
    label: 'Puff detail',
    kind: 'range',
    category: 'skyClouds',
    subsection: 'clouds',
    min: 4,
    max: 12,
    step: 1,
  },
  {
    key: 'cloudPuffShape',
    label: 'Puff shape',
    kind: 'select',
    category: 'skyClouds',
    subsection: 'clouds',
    options: [
      { value: 'icosahedron', label: 'Low-poly facet' },
      { value: 'sphere', label: 'Soft sphere' },
    ],
  },
  { key: 'cloudLit', label: 'Lit color', kind: 'color', category: 'skyClouds', subsection: 'clouds' },
  { key: 'cloudShade', label: 'Shade color', kind: 'color', category: 'skyClouds', subsection: 'clouds' },
  { key: 'skyZenith', label: 'Zenith (ref)', kind: 'color', category: 'skyClouds', subsection: 'sky' },
  { key: 'skyHorizon', label: 'Horizon (ref)', kind: 'color', category: 'skyClouds', subsection: 'sky' },
  // Lighting
  {
    key: 'exposure',
    label: 'Exposure (ref)',
    kind: 'range',
    category: 'lighting',
    subsection: 'lights',
    min: 0.7,
    max: 1.8,
    step: 0.05,
  },
  {
    key: 'sunIntensity',
    label: 'Sun (ref)',
    kind: 'range',
    category: 'lighting',
    subsection: 'lights',
    min: 0.4,
    max: 2.5,
    step: 0.05,
  },
  {
    key: 'hemiIntensity',
    label: 'Sky light (ref)',
    kind: 'range',
    category: 'lighting',
    subsection: 'lights',
    min: 0.2,
    max: 1.6,
    step: 0.05,
  },
  // Water
  { key: 'waterDeepOcean', label: 'Deep ocean', kind: 'color', category: 'water', subsection: 'colors' },
  { key: 'waterOcean', label: 'Ocean', kind: 'color', category: 'water', subsection: 'colors' },
  { key: 'waterLagoon', label: 'Lagoon', kind: 'color', category: 'water', subsection: 'colors' },
  { key: 'waterShallow', label: 'Shallow', kind: 'color', category: 'water', subsection: 'colors' },
  { key: 'waterBeachEdge', label: 'Beach edge', kind: 'color', category: 'water', subsection: 'colors' },
  { key: 'waterFoam', label: 'Foam', kind: 'color', category: 'water', subsection: 'colors' },
  {
    key: 'waterShoreWidth',
    label: 'Shore width',
    kind: 'range',
    category: 'water',
    subsection: 'depth',
    min: 2,
    max: 22,
    step: 0.5,
  },
  {
    key: 'waterDeepFade',
    label: 'Deep fade',
    kind: 'range',
    category: 'water',
    subsection: 'depth',
    min: 4,
    max: 30,
    step: 0.5,
  },
  {
    key: 'waterEdgeSoft',
    label: 'Horizon fade',
    kind: 'range',
    category: 'water',
    subsection: 'depth',
    min: 20,
    max: 160,
    step: 2,
  },
  {
    key: 'waterWaveHeight',
    label: 'Swell height',
    kind: 'range',
    category: 'water',
    subsection: 'motion',
    min: 0,
    max: 0.4,
    step: 0.01,
  },
  {
    key: 'waterWaveSpeed',
    label: 'Swell speed',
    kind: 'range',
    category: 'water',
    subsection: 'motion',
    min: 0,
    max: 2.5,
    step: 0.05,
  },
  {
    key: 'waterSegments',
    label: 'Mesh detail',
    kind: 'range',
    category: 'water',
    subsection: 'motion',
    min: 16,
    max: 128,
    step: 8,
  },
  {
    key: 'waterBandIntensity',
    label: 'Band brightness',
    kind: 'range',
    category: 'water',
    subsection: 'bands',
    min: 0,
    max: 0.25,
    step: 0.005,
  },
  {
    key: 'waterBandScale',
    label: 'Band spacing',
    kind: 'range',
    category: 'water',
    subsection: 'bands',
    min: 0.1,
    max: 1.5,
    step: 0.05,
  },
  {
    key: 'waterBandSpeed',
    label: 'Band speed',
    kind: 'range',
    category: 'water',
    subsection: 'bands',
    min: 0,
    max: 1.2,
    step: 0.02,
  },
  {
    key: 'waterFresnelStrength',
    label: 'Fresnel',
    kind: 'range',
    category: 'water',
    subsection: 'light',
    min: 0,
    max: 0.45,
    step: 0.01,
  },
  {
    key: 'waterFresnelPower',
    label: 'Fresnel power',
    kind: 'range',
    category: 'water',
    subsection: 'light',
    min: 1,
    max: 8,
    step: 0.25,
  },
  {
    key: 'waterSpecularIntensity',
    label: 'Specular',
    kind: 'range',
    category: 'water',
    subsection: 'light',
    min: 0,
    max: 0.7,
    step: 0.02,
  },
  {
    key: 'waterSpecularPower',
    label: 'Specular softness',
    kind: 'range',
    category: 'water',
    subsection: 'light',
    min: 4,
    max: 64,
    step: 1,
  },
  {
    key: 'waterShoreFoam',
    label: 'Foam amount',
    kind: 'range',
    category: 'water',
    subsection: 'foamCaustics',
    min: 0,
    max: 1.5,
    step: 0.05,
  },
  {
    key: 'waterFoamWidth',
    label: 'Foam width',
    kind: 'range',
    category: 'water',
    subsection: 'foamCaustics',
    min: 0.2,
    max: 2.5,
    step: 0.05,
  },
  {
    key: 'waterCausticIntensity',
    label: 'Caustics',
    kind: 'range',
    category: 'water',
    subsection: 'foamCaustics',
    min: 0,
    max: 0.25,
    step: 0.01,
  },
  {
    key: 'waterCausticScale',
    label: 'Caustic scale',
    kind: 'range',
    category: 'water',
    subsection: 'foamCaustics',
    min: 0.15,
    max: 1.5,
    step: 0.05,
  },
  {
    key: 'waterCausticSpeed',
    label: 'Caustic speed',
    kind: 'range',
    category: 'water',
    subsection: 'foamCaustics',
    min: 0,
    max: 1.2,
    step: 0.05,
  },
  // Coast & beach — look only (recolors live from static SDF)
  {
    key: 'beachWetEnd',
    label: 'Wet sand end',
    kind: 'range',
    category: 'coastBeach',
    subsection: 'bands',
    min: 0.1,
    max: 2,
    step: 0.05,
  },
  {
    key: 'beachDryEnd',
    label: 'Dry sand end',
    kind: 'range',
    category: 'coastBeach',
    subsection: 'bands',
    min: 0.4,
    max: 4,
    step: 0.05,
  },
  // World generation (all rebuild knobs live here — Generate tag)
  {
    key: 'islandSeed',
    label: 'Seed',
    kind: 'range',
    category: 'world',
    subsection: 'seed',
    min: 1,
    max: 9999,
    step: 1,
    rebuildsWorld: true,
  },
  {
    key: 'islandRadiusScale',
    label: 'Radius scale',
    kind: 'range',
    category: 'world',
    subsection: 'mask',
    min: 0.85,
    max: 1.6,
    step: 0.01,
    rebuildsWorld: true,
  },
  {
    key: 'islandFalloff',
    label: 'Falloff',
    kind: 'range',
    category: 'world',
    subsection: 'mask',
    min: 0.8,
    max: 1.6,
    step: 0.02,
    rebuildsWorld: true,
  },
  {
    key: 'islandWarp',
    label: 'Domain warp',
    kind: 'range',
    category: 'world',
    subsection: 'mask',
    min: 0,
    max: 0.9,
    step: 0.02,
    rebuildsWorld: true,
  },
  {
    key: 'islandCount',
    label: 'Islands (0=per hex)',
    kind: 'range',
    category: 'world',
    subsection: 'mask',
    min: 0,
    max: 1,
    step: 1,
    rebuildsWorld: true,
    tooltip: '0 = one large island per numbered hex. 1 = single landmass.',
  },
  {
    key: 'layoutScale',
    label: 'Island size',
    kind: 'range',
    category: 'world',
    subsection: 'mask',
    min: 2.5,
    max: 7,
    step: 0.1,
    rebuildsWorld: true,
    tooltip: 'Spreads hexes apart so each island is bigger with sea between.',
  },
  {
    key: 'archipelagoSpread',
    label: 'Channel strength',
    kind: 'range',
    category: 'world',
    subsection: 'mask',
    min: 0,
    max: 1,
    step: 0.05,
    rebuildsWorld: true,
    tooltip: 'How strongly sea channels open between islands.',
  },
  {
    key: 'islandSmoothPasses',
    label: 'Smooth passes',
    kind: 'range',
    category: 'world',
    subsection: 'smooth',
    min: 0,
    max: 5,
    step: 1,
    rebuildsWorld: true,
  },
  {
    key: 'islandResolution',
    label: 'SDF resolution',
    kind: 'range',
    category: 'world',
    subsection: 'sdfMesh',
    min: 64,
    max: 192,
    step: 16,
    rebuildsWorld: true,
  },
  {
    key: 'islandVerticalScale',
    label: 'Vertical scale',
    kind: 'range',
    category: 'world',
    subsection: 'height',
    min: 0.02,
    max: 0.15,
    step: 0.005,
    rebuildsWorld: true,
  },
  {
    key: 'islandLargeNoise',
    label: 'Large noise',
    kind: 'range',
    category: 'world',
    subsection: 'height',
    min: 0,
    max: 0.6,
    step: 0.02,
    rebuildsWorld: true,
  },
  {
    key: 'islandSmallNoise',
    label: 'Small noise',
    kind: 'range',
    category: 'world',
    subsection: 'height',
    min: 0,
    max: 0.25,
    step: 0.01,
    rebuildsWorld: true,
  },
  {
    key: 'biomeBlur',
    label: 'Biome blur',
    kind: 'range',
    category: 'world',
    subsection: 'biomes',
    min: 0.4,
    max: 3,
    step: 0.1,
    rebuildsWorld: true,
  },
  {
    key: 'treeDensity',
    label: 'Tree density',
    kind: 'range',
    category: 'world',
    subsection: 'scatter',
    min: 0,
    max: 1,
    step: 0.05,
    rebuildsWorld: true,
  },
  {
    key: 'rockDensity',
    label: 'Rock density',
    kind: 'range',
    category: 'world',
    subsection: 'scatter',
    min: 0,
    max: 1,
    step: 0.05,
    rebuildsWorld: true,
  },
  // Debug
  {
    key: 'showHexOverlay',
    label: 'Show hex overlay',
    kind: 'toggle',
    category: 'debug',
    subsection: 'overlays',
  },
  {
    key: 'showSdfOverlay',
    label: 'Show SDF overlay',
    kind: 'toggle',
    category: 'debug',
    subsection: 'overlays',
  },
];

export class StyleConfigurator {
  private root: HTMLElement;
  private panel: HTMLElement;
  private config: StyleConfig;
  private draft: StyleConfig;
  private listeners = new Set<Listener>();
  private open = false;
  private search = '';
  private collapsed = new Set<CraftCategoryId>();
  private pendingRebuild = false;

  constructor(parent: HTMLElement) {
    this.config = loadStyleConfig();
    this.draft = { ...this.config };
    this.root = document.createElement('div');
    this.root.id = 'style-config';
    parent.appendChild(this.root);

    this.panel = document.createElement('div');
    this.root.appendChild(this.panel);

    // Collapse all but atmosphere by default
    for (const c of CRAFT_CATEGORIES) {
      if (c.id !== 'atmosphere' && c.id !== 'world') this.collapsed.add(c.id);
    }
    this.render();
  }

  getConfig(): StyleConfig {
    return this.config;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.config);
    return () => this.listeners.delete(fn);
  }

  private emit(rebuildWorld = false): void {
    saveStyleConfig(this.config);
    for (const fn of this.listeners) fn(this.config, { rebuildWorld });
  }

  private setLive(key: keyof StyleConfig, value: string | number | boolean): void {
    const next = { ...this.config, [key]: value } as StyleConfig;
    if (next.cloudOrbitMax < next.cloudOrbitMin) next.cloudOrbitMax = next.cloudOrbitMin;
    if (next.cloudHeightMax < next.cloudHeightMin) next.cloudHeightMax = next.cloudHeightMin;
    const preserved = this.pendingRebuild
      ? Object.fromEntries(WORLD_REBUILD_KEYS.map((k) => [k, this.draft[k]]))
      : {};
    this.config = next;
    this.draft = { ...next, ...preserved } as StyleConfig;
    const rebuild = WORLD_REBUILD_KEYS.includes(key);
    if (rebuild) {
      this.pendingRebuild = true;
      this.emit(false);
      this.syncPendingBadge();
    } else {
      this.emit(false);
    }
    this.syncFieldLabels();
  }

  private applyGenerate(): void {
    this.config = { ...this.draft };
    this.pendingRebuild = false;
    this.emit(true);
    this.render();
  }

  private syncPendingBadge(): void {
    const bar = this.panel.querySelector('[data-pending-bar]');
    if (bar) bar.classList.toggle('hidden', !this.pendingRebuild);
  }

  private syncFieldLabels(): void {
    this.panel.querySelectorAll<HTMLLabelElement>('.style-field').forEach((label) => {
      const input = label.querySelector<HTMLInputElement>('input[type="range"][data-key]');
      if (!input) return;
      const key = input.dataset.key as keyof StyleConfig;
      const em = label.querySelector('em');
      if (em) em.textContent = formatNum(this.draft[key] as number);
    });
  }

  private filteredFields(): FieldDef[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return FIELDS;
    return FIELDS.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.subsection.toLowerCase().includes(q),
    );
  }

  private render(): void {
    this.root.className = this.open ? 'style-config open' : 'style-config';
    const fields = this.filteredFields();
    const byCat = new Map<CraftCategoryId, FieldDef[]>();
    for (const f of fields) {
      const list = byCat.get(f.category) ?? [];
      list.push(f);
      byCat.set(f.category, list);
    }

    const catsHtml = CRAFT_CATEGORIES.map((cat) => {
      const catFields = byCat.get(cat.id);
      if (!catFields || catFields.length === 0) return '';
      const open = !this.collapsed.has(cat.id);
      const generate =
        cat.rebuildsWorld ||
        catFields.some((f) => f.rebuildsWorld || WORLD_REBUILD_KEYS.includes(f.key));
      const subsections = new Map<string, FieldDef[]>();
      for (const f of catFields) {
        const list = subsections.get(f.subsection) ?? [];
        list.push(f);
        subsections.set(f.subsection, list);
      }
      return `
        <div class="style-section ${generate ? 'generate-section' : 'look-section'}" data-cat="${cat.id}">
          <button type="button" class="style-section-title" data-action="toggle-cat" data-cat="${cat.id}">
            ${open ? '▾' : '▸'} ${cat.title}
            <span class="style-section-tag">${generate ? 'Generate' : 'Look'}</span>
          </button>
          <p class="style-section-blurb ${open ? '' : 'hidden'}">${cat.blurb}</p>
          <div class="${open ? '' : 'hidden'}">
            ${[...subsections.entries()]
              .map(
                ([sub, fs]) => `
              <div class="style-subsection-title">${sub}</div>
              ${fs.map((f) => this.fieldHtml(f)).join('')}
            `,
              )
              .join('')}
          </div>
        </div>`;
    }).join('');

    this.panel.innerHTML = `
      <button type="button" class="style-config-toggle" data-action="toggle">
        ${this.open ? 'Close craft' : 'Craft'}
      </button>
      <div class="style-config-panel ${this.open ? '' : 'hidden'}">
        <div class="style-config-header">
          <h3>Craft configurator</h3>
          <p>Look tweaks apply live. Generation knobs rebuild the island on Apply.</p>
          <input type="search" class="style-search" placeholder="Search fields…" value="${escapeAttr(this.search)}" data-action="search" />
          <div class="generate-apply-bar ${this.pendingRebuild ? '' : 'hidden'}" data-pending-bar>
            <span data-pending class="pending-badge">World changes pending</span>
            <button type="button" class="btn" data-action="apply-generate">Apply regenerate</button>
          </div>
        </div>
        ${catsHtml}
        <div class="style-config-actions">
          <button type="button" class="btn secondary" data-action="reset">Reset defaults</button>
          <button type="button" class="btn secondary" data-action="export">Export JSON</button>
          <button type="button" class="btn secondary" data-action="import">Import JSON</button>
        </div>
      </div>
    `;

    this.panel.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action;
      if (action === 'toggle') {
        el.addEventListener('click', () => {
          this.open = !this.open;
          this.render();
        });
      } else if (action === 'toggle-cat') {
        el.addEventListener('click', () => {
          const id = el.dataset.cat as CraftCategoryId;
          if (this.collapsed.has(id)) this.collapsed.delete(id);
          else this.collapsed.add(id);
          this.render();
        });
      } else if (action === 'reset') {
        el.addEventListener('click', () => {
          this.config = resetStyleConfig();
          this.draft = { ...this.config };
          this.pendingRebuild = false;
          this.emit(true);
          this.render();
        });
      } else if (action === 'apply-generate') {
        el.addEventListener('click', () => this.applyGenerate());
      } else if (action === 'export') {
        el.addEventListener('click', () => {
          const blob = new Blob([JSON.stringify(this.config, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'craft-config.json';
          a.click();
          URL.revokeObjectURL(url);
        });
      } else if (action === 'import') {
        el.addEventListener('click', () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'application/json';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              const parsed = JSON.parse(text) as Partial<StyleConfig>;
              this.config = { ...DEFAULT_STYLE_CONFIG, ...parsed };
              this.draft = { ...this.config };
              this.emit(true);
              this.render();
            } catch {
              /* ignore bad json */
            }
          };
          input.click();
        });
      } else if (action === 'search' && el instanceof HTMLInputElement) {
        el.addEventListener('input', () => {
          this.search = el.value;
          this.render();
          const searchEl = this.panel.querySelector<HTMLInputElement>('.style-search');
          searchEl?.focus();
          if (searchEl) searchEl.selectionStart = searchEl.selectionEnd = searchEl.value.length;
        });
      }
    });

    this.panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-key]').forEach((el) => {
      const key = el.dataset.key as keyof StyleConfig;
      const field = FIELDS.find((f) => f.key === key);
      const apply = () => {
        if (el instanceof HTMLInputElement && el.type === 'range') {
          const v = Number(el.value);
          this.draft = { ...this.draft, [key]: v };
          if (field?.rebuildsWorld || WORLD_REBUILD_KEYS.includes(key)) {
            this.pendingRebuild = true;
            this.syncFieldLabels();
            this.syncPendingBadge();
          } else {
            this.setLive(key, v);
          }
        } else if (el instanceof HTMLInputElement && el.type === 'color') {
          this.setLive(key, el.value);
        } else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
          const v = el.checked;
          this.setLive(key, v);
          if (key === 'showSdfOverlay' || key === 'showHexOverlay') {
            // live look / debug — no rebuild
          }
        } else if (el instanceof HTMLSelectElement) {
          this.setLive(key, el.value);
          this.render();
        }
      };
      el.addEventListener('input', apply);
      el.addEventListener('change', apply);
    });
  }

  private fieldHtml(f: FieldDef): string {
    const val = f.rebuildsWorld ? this.draft[f.key] : this.config[f.key];
    if (f.kind === 'color') {
      return `
        <label class="style-field">
          <span>${f.label}</span>
          <input type="color" data-key="${f.key}" value="${normalizeHex(String(val))}" />
        </label>`;
    }
    if (f.kind === 'select') {
      return `
        <label class="style-field">
          <span>${f.label}</span>
          <select data-key="${f.key}">
            ${(f.options ?? [])
              .map(
                (o) =>
                  `<option value="${o.value}" ${String(val) === o.value ? 'selected' : ''}>${o.label}</option>`,
              )
              .join('')}
          </select>
        </label>`;
    }
    if (f.kind === 'toggle') {
      return `
        <label class="style-field style-toggle">
          <span>${f.label}</span>
          <input type="checkbox" data-key="${f.key}" ${val ? 'checked' : ''} />
        </label>`;
    }
    return `
      <label class="style-field">
        <span>${f.label} <em>${formatNum(val as number)}</em></span>
        <input type="range" data-key="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${val}" />
      </label>`;
  }
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 10 || Number.isInteger(n)) return String(Math.round(n * 100) / 100);
  return n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function normalizeHex(hex: string): string {
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex.toLowerCase();
  return hex;
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}

export { DEFAULT_STYLE_CONFIG } from '../render/styleConfig';
