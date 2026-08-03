import type { StyleConfig, StylePresetId } from '../render/styleConfig';
import {
  STYLE_PRESETS,
  applyStylePreset,
  loadStyleConfig,
  resetStyleConfig,
  saveStyleConfig,
} from '../render/styleConfig';

type Listener = (config: StyleConfig) => void;

interface FieldDef {
  key: keyof StyleConfig;
  label: string;
  kind: 'range' | 'color' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  /** Optional search aliases. */
  tags?: string[];
}

interface CategoryDef {
  id: string;
  title: string;
  blurb: string;
  fields: FieldDef[];
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'atmosphere',
    title: 'Atmosphere',
    blurb: 'Time of day — Environment State only.',
    fields: [
      {
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
        key: 'dayLengthSec',
        label: 'Full day (sec)',
        kind: 'range',
        min: 45,
        max: 600,
        step: 15,
      },
      {
        key: 'dayTransitionSec',
        label: 'Scheme blend (sec)',
        kind: 'range',
        min: 1,
        max: 30,
        step: 1,
      },
    ],
  },
  {
    id: 'skyClouds',
    title: 'Sky & Clouds',
    blurb: 'Dome refs and low-poly cloud flocks.',
    fields: [
      { key: 'skyZenith', label: 'Zenith (ref)', kind: 'color', tags: ['sky'] },
      { key: 'skyHorizon', label: 'Horizon (ref)', kind: 'color', tags: ['sky'] },
      { key: 'cloudCount', label: 'Count', kind: 'range', min: 2, max: 20, step: 1 },
      { key: 'cloudScale', label: 'Scale', kind: 'range', min: 0.4, max: 6, step: 0.1 },
      { key: 'cloudOrbitMin', label: 'Orbit min', kind: 'range', min: 8, max: 30, step: 1 },
      { key: 'cloudOrbitMax', label: 'Orbit max', kind: 'range', min: 12, max: 40, step: 1 },
      { key: 'cloudHeightMin', label: 'Height min', kind: 'range', min: 2, max: 20, step: 0.5 },
      { key: 'cloudHeightMax', label: 'Height max', kind: 'range', min: 4, max: 28, step: 0.5 },
      { key: 'cloudDriftSpeed', label: 'Drift', kind: 'range', min: 0, max: 0.02, step: 0.001 },
      { key: 'cloudPuffSegments', label: 'Puff detail', kind: 'range', min: 4, max: 12, step: 1 },
      {
        key: 'cloudPuffShape',
        label: 'Puff shape',
        kind: 'select',
        options: [
          { value: 'icosahedron', label: 'Low-poly facet' },
          { value: 'sphere', label: 'Soft sphere' },
        ],
      },
      { key: 'cloudLit', label: 'Lit color', kind: 'color' },
      { key: 'cloudShade', label: 'Shade color', kind: 'color' },
    ],
  },
  {
    id: 'lighting',
    title: 'Lighting & Shadows',
    blurb: 'Craft multipliers — atmosphere owns live values.',
    fields: [
      { key: 'exposure', label: 'Exposure (ref)', kind: 'range', min: 0.7, max: 1.8, step: 0.05 },
      { key: 'sunIntensity', label: 'Sun (ref)', kind: 'range', min: 0.4, max: 2.5, step: 0.05 },
      { key: 'hemiIntensity', label: 'Sky light (ref)', kind: 'range', min: 0.2, max: 1.6, step: 0.05 },
    ],
  },
  {
    id: 'fogPost',
    title: 'Fog & Post',
    blurb: 'Fog follows the sky; exposure craft sits with lighting.',
    fields: [
      {
        key: 'exposure',
        label: 'Exposure (ref)',
        kind: 'range',
        min: 0.7,
        max: 1.8,
        step: 0.05,
        tags: ['post', 'fog'],
      },
    ],
  },
  {
    id: 'water',
    title: 'Water',
    blurb: 'Craft bases × day-night Environment State (palette, bands, foam).',
    fields: [
      { key: 'waterDeepOcean', label: 'Deep ocean', kind: 'color', tags: ['palette'] },
      { key: 'waterOcean', label: 'Ocean', kind: 'color', tags: ['palette'] },
      { key: 'waterLagoon', label: 'Lagoon', kind: 'color', tags: ['palette'] },
      { key: 'waterShallow', label: 'Shallow', kind: 'color', tags: ['palette'] },
      { key: 'waterBeachEdge', label: 'Beach edge', kind: 'color', tags: ['palette'] },
      { key: 'waterFoam', label: 'Foam colour', kind: 'color' },
      { key: 'waterShoreWidth', label: 'Shore width', kind: 'range', min: 2, max: 22, step: 0.5 },
      { key: 'waterDeepFade', label: 'Deep fade', kind: 'range', min: 4, max: 30, step: 0.5 },
      { key: 'waterEdgeSoft', label: 'Horizon fade', kind: 'range', min: 20, max: 160, step: 2 },
      { key: 'waterShoreGlow', label: 'Shore glow', kind: 'range', min: 0, max: 0.4, step: 0.01 },
      { key: 'waterColorWave', label: 'Colour wave', kind: 'range', min: 0, max: 0.15, step: 0.005 },
      { key: 'waterWaveHeight', label: 'Swell height', kind: 'range', min: 0, max: 0.4, step: 0.01 },
      { key: 'waterWaveSpeed', label: 'Swell speed', kind: 'range', min: 0, max: 2.5, step: 0.05 },
      { key: 'waterSegments', label: 'Mesh detail', kind: 'range', min: 16, max: 128, step: 8 },
      { key: 'waterBandIntensity', label: 'Band brightness', kind: 'range', min: 0, max: 0.25, step: 0.005 },
      { key: 'waterBandScale', label: 'Band spacing', kind: 'range', min: 0.1, max: 1.5, step: 0.05 },
      { key: 'waterBandSpeed', label: 'Band speed', kind: 'range', min: 0, max: 1.2, step: 0.02 },
      { key: 'waterBandSoftness', label: 'Band softness', kind: 'range', min: 0.15, max: 0.95, step: 0.05 },
      { key: 'waterFresnelStrength', label: 'Fresnel', kind: 'range', min: 0, max: 0.45, step: 0.01 },
      { key: 'waterFresnelPower', label: 'Fresnel power', kind: 'range', min: 1, max: 8, step: 0.25 },
      { key: 'waterSpecularIntensity', label: 'Specular', kind: 'range', min: 0, max: 0.7, step: 0.02 },
      { key: 'waterSpecularPower', label: 'Specular softness', kind: 'range', min: 4, max: 64, step: 1 },
      { key: 'waterShoreFoam', label: 'Foam amount', kind: 'range', min: 0, max: 1.5, step: 0.05 },
      { key: 'waterFoamWidth', label: 'Foam width', kind: 'range', min: 0.2, max: 2.5, step: 0.05 },
      { key: 'waterFoamPulse', label: 'Foam pulse', kind: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'waterFoamPulseSpeed', label: 'Foam pulse speed', kind: 'range', min: 0, max: 2, step: 0.05 },
      { key: 'waterCausticIntensity', label: 'Caustics', kind: 'range', min: 0, max: 0.25, step: 0.01 },
      { key: 'waterCausticScale', label: 'Caustic scale', kind: 'range', min: 0.15, max: 1.5, step: 0.05 },
      { key: 'waterCausticSpeed', label: 'Caustic speed', kind: 'range', min: 0, max: 1.2, step: 0.05 },
    ],
  },
  {
    id: 'hexBoard',
    title: 'Hex Board & Props',
    blurb: 'Hover lift, production pulse, harbor bob.',
    fields: [
      { key: 'hexHoverLift', label: 'Hover lift', kind: 'range', min: 0, max: 0.12, step: 0.005, tags: ['hex', 'hover'] },
      {
        key: 'productionPulseSec',
        label: 'Production pulse (sec)',
        kind: 'range',
        min: 0.4,
        max: 2.5,
        step: 0.05,
        tags: ['dice', 'token'],
      },
      {
        key: 'productionPulseStrength',
        label: 'Pulse strength',
        kind: 'range',
        min: 0,
        max: 1,
        step: 0.05,
        tags: ['dice', 'token'],
      },
      { key: 'harborBobAmp', label: 'Harbor bob', kind: 'range', min: 0, max: 0.1, step: 0.005 },
    ],
  },
  {
    id: 'motion',
    title: 'Motion & Feedback',
    blurb: 'Piece tweens, robber hop, highlights, camera nudge.',
    fields: [
      { key: 'motionPieceSpawnSec', label: 'Piece spawn (sec)', kind: 'range', min: 0.1, max: 1, step: 0.02 },
      { key: 'motionRoadSpawnSec', label: 'Road spawn (sec)', kind: 'range', min: 0.08, max: 0.8, step: 0.02 },
      { key: 'motionUpgradeSec', label: 'City upgrade (sec)', kind: 'range', min: 0.15, max: 1, step: 0.02 },
      { key: 'motionRobberHopSec', label: 'Robber hop (sec)', kind: 'range', min: 0.2, max: 1.2, step: 0.02 },
      { key: 'motionHighlightFade', label: 'Highlight fade speed', kind: 'range', min: 2, max: 20, step: 0.5 },
      { key: 'motionCameraNudgeSec', label: 'Camera nudge (sec)', kind: 'range', min: 0.15, max: 1.5, step: 0.05 },
      {
        key: 'motionCameraNudgeBlend',
        label: 'Camera center blend',
        kind: 'range',
        min: 0.2,
        max: 0.9,
        step: 0.05,
      },
    ],
  },
];

export class StyleConfigurator {
  private root: HTMLElement;
  private panel: HTMLElement;
  private config: StyleConfig;
  private listeners = new Set<Listener>();
  private open = false;
  private search = '';
  private collapsed = new Set<string>();
  private lastOpenCategory = 'atmosphere';

  constructor(parent: HTMLElement) {
    this.config = loadStyleConfig();
    this.root = document.createElement('div');
    this.root.id = 'style-config';
    parent.appendChild(this.root);

    this.panel = document.createElement('div');
    this.root.appendChild(this.panel);
    // Collapse all but atmosphere by default (progressive disclosure).
    for (const cat of CATEGORIES) {
      if (cat.id !== this.lastOpenCategory) this.collapsed.add(cat.id);
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

  private emit(): void {
    saveStyleConfig(this.config);
    for (const fn of this.listeners) fn(this.config);
  }

  private setValue(key: keyof StyleConfig, value: string | number, rerender = false): void {
    const next = { ...this.config, [key]: value } as StyleConfig;
    if (next.cloudOrbitMax < next.cloudOrbitMin) next.cloudOrbitMax = next.cloudOrbitMin;
    if (next.cloudHeightMax < next.cloudHeightMin) next.cloudHeightMax = next.cloudHeightMin;
    this.config = next;
    this.emit();
    if (rerender) this.render();
    else this.syncFieldLabels();
  }

  private syncFieldLabels(): void {
    this.panel.querySelectorAll<HTMLLabelElement>('.style-field').forEach((label) => {
      const input = label.querySelector<HTMLInputElement>('input[type="range"][data-key]');
      if (!input) return;
      const key = input.dataset.key as keyof StyleConfig;
      const em = label.querySelector('em');
      if (em) em.textContent = formatNum(this.config[key] as number);
    });
  }

  private fieldMatches(f: FieldDef, q: string): boolean {
    if (!q) return true;
    const hay = `${f.label} ${f.key} ${(f.tags ?? []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  }

  private categoryMatches(cat: CategoryDef, q: string): boolean {
    if (!q) return true;
    if (`${cat.title} ${cat.blurb} ${cat.id}`.toLowerCase().includes(q)) return true;
    return cat.fields.some((f) => this.fieldMatches(f, q));
  }

  private render(): void {
    const q = this.search.trim().toLowerCase();
    const visibleCats = CATEGORIES.filter((c) => this.categoryMatches(c, q));

    this.root.className = this.open ? 'style-config open' : 'style-config';
    this.panel.innerHTML = `
      <button type="button" class="style-config-toggle" data-action="toggle">
        ${this.open ? 'Close craft' : 'Style'}
      </button>
      <div class="style-config-panel ${this.open ? '' : 'hidden'}">
        <div class="style-config-header">
          <h3>Craft configurator</h3>
          <p>Hex board look & motion. Search, collapse, and presets — day-night never rebuilds tiles.</p>
          <label class="style-search">
            <span class="sr-only">Search</span>
            <input type="search" data-action="search" placeholder="Search knobs…" value="${escapeAttr(this.search)}" />
          </label>
          <div class="style-presets" role="group" aria-label="Presets">
            ${STYLE_PRESETS.map(
              (p) =>
                `<button type="button" class="btn secondary style-preset" data-preset="${p.id}">${p.label}</button>`,
            ).join('')}
          </div>
        </div>
        ${
          visibleCats.length === 0
            ? `<p class="style-empty">No fields match “${escapeHtml(this.search)}”.</p>`
            : visibleCats
                .map((cat) => {
                  const fields = q
                    ? cat.fields.filter((f) => this.fieldMatches(f, q))
                    : cat.fields;
                  if (fields.length === 0) return '';
                  const isOpen = q ? true : !this.collapsed.has(cat.id);
                  return `
          <div class="style-section ${isOpen ? 'open' : 'collapsed'}" data-category="${cat.id}">
            <button type="button" class="style-section-title" data-action="toggle-cat" data-category="${cat.id}" aria-expanded="${isOpen}">
              <span>${cat.title}</span>
              <span class="style-section-chevron" aria-hidden="true">${isOpen ? '▾' : '▸'}</span>
            </button>
            <p class="style-section-blurb">${cat.blurb}</p>
            <div class="style-section-body ${isOpen ? '' : 'hidden'}">
              ${fields.map((f) => this.fieldHtml(f)).join('')}
            </div>
          </div>`;
                })
                .join('')
        }
        <div class="style-config-actions">
          <button type="button" class="btn secondary" data-action="reset">Reset defaults</button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.panel.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action;
      if (action === 'toggle') {
        el.addEventListener('click', () => {
          this.open = !this.open;
          this.render();
        });
      } else if (action === 'reset') {
        el.addEventListener('click', () => {
          this.config = resetStyleConfig();
          this.emit();
          this.render();
        });
      } else if (action === 'toggle-cat') {
        el.addEventListener('click', () => {
          const id = el.dataset.category!;
          if (this.collapsed.has(id)) {
            this.collapsed.delete(id);
            this.lastOpenCategory = id;
          } else {
            this.collapsed.add(id);
          }
          this.render();
        });
      } else if (action === 'search' && el instanceof HTMLInputElement) {
        el.addEventListener('input', () => {
          this.search = el.value;
          // Keep focus: re-render then restore caret.
          const pos = el.selectionStart ?? el.value.length;
          this.render();
          const next = this.panel.querySelector<HTMLInputElement>('input[data-action="search"]');
          if (next) {
            next.focus();
            next.setSelectionRange(pos, pos);
          }
        });
      }
    });

    this.panel.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.preset as StylePresetId;
        this.config = applyStylePreset(this.config, id);
        this.emit();
        this.render();
      });
    });

    this.panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-key]').forEach((el) => {
      const key = el.dataset.key as keyof StyleConfig;
      const apply = () => {
        if (el instanceof HTMLInputElement && el.type === 'range') {
          this.setValue(key, Number(el.value), false);
        } else if (el instanceof HTMLInputElement && el.type === 'color') {
          this.setValue(key, el.value, false);
        } else if (el instanceof HTMLSelectElement) {
          this.setValue(key, el.value, true);
        }
      };
      el.addEventListener('input', apply);
      el.addEventListener('change', apply);
    });
  }

  private fieldHtml(f: FieldDef): string {
    const val = this.config[f.key];
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
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export { DEFAULT_STYLE_CONFIG } from '../render/styleConfig';
