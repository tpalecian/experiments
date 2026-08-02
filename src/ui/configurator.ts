import type { StyleConfig } from '../render/styleConfig';
import {
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
}

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Clouds',
    fields: [
      { key: 'cloudCount', label: 'Count', kind: 'range', min: 2, max: 16, step: 1 },
      { key: 'cloudScale', label: 'Scale', kind: 'range', min: 2, max: 14, step: 0.5 },
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
          { value: 'sphere', label: 'Foam sphere' },
          { value: 'icosahedron', label: 'Facet icosa' },
        ],
      },
      { key: 'cloudLit', label: 'Lit color', kind: 'color' },
      { key: 'cloudShade', label: 'Shade color', kind: 'color' },
    ],
  },
  {
    title: 'Sky',
    fields: [
      { key: 'skyZenith', label: 'Zenith', kind: 'color' },
      { key: 'skyHorizon', label: 'Horizon', kind: 'color' },
    ],
  },
  {
    title: 'Water colors',
    fields: [
      { key: 'waterDeepOcean', label: 'Deep ocean', kind: 'color' },
      { key: 'waterOcean', label: 'Ocean', kind: 'color' },
      { key: 'waterLagoon', label: 'Lagoon', kind: 'color' },
      { key: 'waterShallow', label: 'Shallow', kind: 'color' },
      { key: 'waterBeachEdge', label: 'Beach edge', kind: 'color' },
      { key: 'waterFoam', label: 'Foam', kind: 'color' },
    ],
  },
  {
    title: 'Water depth',
    fields: [
      { key: 'waterShoreWidth', label: 'Shore width', kind: 'range', min: 2, max: 22, step: 0.5 },
      { key: 'waterDeepFade', label: 'Deep fade', kind: 'range', min: 4, max: 30, step: 0.5 },
    ],
  },
  {
    title: 'Water motion',
    fields: [
      { key: 'waterWaveHeight', label: 'Swell height', kind: 'range', min: 0, max: 0.25, step: 0.005 },
      { key: 'waterWaveSpeed', label: 'Swell speed', kind: 'range', min: 0, max: 2.5, step: 0.05 },
      { key: 'waterSegments', label: 'Mesh detail', kind: 'range', min: 16, max: 128, step: 8 },
      { key: 'waterBandIntensity', label: 'Band brightness', kind: 'range', min: 0, max: 0.15, step: 0.005 },
      { key: 'waterBandScale', label: 'Band spacing', kind: 'range', min: 0.15, max: 1.5, step: 0.05 },
      { key: 'waterBandSpeed', label: 'Band speed', kind: 'range', min: 0, max: 0.8, step: 0.02 },
    ],
  },
  {
    title: 'Water light',
    fields: [
      { key: 'waterFresnelStrength', label: 'Fresnel', kind: 'range', min: 0, max: 0.45, step: 0.01 },
      { key: 'waterFresnelPower', label: 'Fresnel power', kind: 'range', min: 1, max: 8, step: 0.25 },
      { key: 'waterSpecularIntensity', label: 'Specular', kind: 'range', min: 0, max: 0.7, step: 0.02 },
      { key: 'waterSpecularPower', label: 'Specular softness', kind: 'range', min: 4, max: 64, step: 1 },
    ],
  },
  {
    title: 'Water foam & caustics',
    fields: [
      { key: 'waterShoreFoam', label: 'Foam amount', kind: 'range', min: 0, max: 1.5, step: 0.05 },
      { key: 'waterFoamWidth', label: 'Foam width', kind: 'range', min: 0.2, max: 2.5, step: 0.05 },
      { key: 'waterCausticIntensity', label: 'Caustics', kind: 'range', min: 0, max: 0.25, step: 0.01 },
      { key: 'waterCausticScale', label: 'Caustic scale', kind: 'range', min: 0.15, max: 1.5, step: 0.05 },
      { key: 'waterCausticSpeed', label: 'Caustic speed', kind: 'range', min: 0, max: 1.2, step: 0.05 },
    ],
  },
  {
    title: 'Lighting',
    fields: [
      { key: 'exposure', label: 'Exposure', kind: 'range', min: 0.7, max: 1.8, step: 0.05 },
      { key: 'sunIntensity', label: 'Sun', kind: 'range', min: 0.4, max: 2.5, step: 0.05 },
      { key: 'hemiIntensity', label: 'Sky light', kind: 'range', min: 0.2, max: 1.6, step: 0.05 },
    ],
  },
];

export class StyleConfigurator {
  private root: HTMLElement;
  private panel: HTMLElement;
  private config: StyleConfig;
  private listeners = new Set<Listener>();
  private open = false;

  constructor(parent: HTMLElement) {
    this.config = loadStyleConfig();
    this.root = document.createElement('div');
    this.root.id = 'style-config';
    parent.appendChild(this.root);

    this.panel = document.createElement('div');
    this.root.appendChild(this.panel);
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

  private render(): void {
    this.root.className = this.open ? 'style-config open' : 'style-config';
    this.panel.innerHTML = `
      <button type="button" class="style-config-toggle" data-action="toggle">
        ${this.open ? 'Close style' : 'Style'}
      </button>
      <div class="style-config-panel ${this.open ? '' : 'hidden'}">
        <div class="style-config-header">
          <h3>Style configurator</h3>
          <p>Tweak tropical water, clouds, sky & light live.</p>
        </div>
        ${SECTIONS.map(
          (section) => `
          <div class="style-section">
            <div class="style-section-title">${section.title}</div>
            ${section.fields.map((f) => this.fieldHtml(f)).join('')}
          </div>`,
        ).join('')}
        <div class="style-config-actions">
          <button type="button" class="btn secondary" data-action="reset">Reset defaults</button>
        </div>
      </div>
    `;

    this.panel.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        const action = el.dataset.action;
        if (action === 'toggle') {
          this.open = !this.open;
          this.render();
        } else if (action === 'reset') {
          this.config = resetStyleConfig();
          this.emit();
          this.render();
        }
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

/** HTML color inputs require #rrggbb lowercase. */
function normalizeHex(hex: string): string {
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex.toLowerCase();
  return hex;
}

export { DEFAULT_STYLE_CONFIG } from '../render/styleConfig';
