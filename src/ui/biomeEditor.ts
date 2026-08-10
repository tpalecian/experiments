/**
 * Biome Layout Editor — Unity-style authoring for hex decoration layouts.
 * Open via ?view=biome-editor (also linked from the lobby).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { Terrain } from '../game/types';
import { getAssetById, makeHexTile, TILE_HEIGHT } from '../render/assets';
import { STYLE } from '../render/style';
import {
  BIOME_PROP_KINDS,
  TERRAIN_LABELS,
  TERRAIN_ORDER,
  createEmptyLayout,
  createPropInstance,
  createPropObject,
  exportBiomeLayoutsJson,
  importBiomeLayoutsJson,
  layoutsForTerrain,
  loadBiomeLayouts,
  resetBiomeLayouts,
  saveBiomeLayouts,
  type BiomeLayout,
  type BiomeLayoutLibrary,
  type BiomePropInstance,
  type BiomePropKind,
} from '../render/biomeLayouts';
import { warmBiomeThumbnails, warmPropThumbnails } from './propThumbnails';

export function isBiomeEditorRoute(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'biome-editor') return true;
  const hash = window.location.hash.replace(/^#/, '');
  return hash === 'biome-editor' || hash === '/biome-editor';
}

export function biomeEditorHref(): string {
  return `${window.location.pathname}?view=biome-editor`;
}

export function gameHref(): string {
  return window.location.pathname || '/';
}

type ToolMode = 'select' | 'move' | 'rotate' | 'scale';
type InspectorTab = 'transform' | 'details';
type CameraPreset = 'isometric' | 'orbit';

function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.Sprite)) return;
    obj.geometry?.dispose?.();
    const mat = obj.material;
    const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const m of mats) {
      if (!m) continue;
      const map = (m as THREE.MeshBasicMaterial).map;
      map?.dispose?.();
      m.dispose();
    }
  });
}

function clampHex(x: number, z: number, radius = 0.82): { x: number; z: number } {
  const d = Math.hypot(x, z);
  if (d <= radius || d < 1e-6) return { x, z };
  const s = radius / d;
  return { x: x * s, z: z * s };
}

function snapValue(v: number, step: number): number {
  if (step <= 0) return v;
  return Math.round(v / step) * step;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cloneLibrary(lib: BiomeLayoutLibrary): BiomeLayoutLibrary {
  return JSON.parse(JSON.stringify(lib)) as BiomeLayoutLibrary;
}

export function startBiomeEditor(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
  const root = document.querySelector<HTMLElement>('#biome-editor')!;
  const lobby = document.querySelector<HTMLElement>('#lobby');
  const hud = document.querySelector<HTMLElement>('#hud');
  const styleRoot = document.querySelector<HTMLElement>('#style-config-root');
  lobby?.classList.add('hidden');
  if (hud) hud.innerHTML = '';
  if (styleRoot) styleRoot.innerHTML = '';
  document.body.classList.add('biome-editor-mode');
  root.classList.remove('hidden');

  let library: BiomeLayoutLibrary = loadBiomeLayouts();
  let terrain: Terrain = 'wheat';
  let layoutId = layoutsForTerrain(library, terrain)[0]?.id ?? '';
  let selectedPropId: string | null = null;
  let tool: ToolMode = 'move';
  let inspectorTab: InspectorTab = 'transform';
  let propQuery = '';
  let snapStep = 0.1;
  let snapEnabled = true;
  let showGrid = true;
  let showWater = true;
  let dayMode = true;
  let cameraPreset: CameraPreset = 'isometric';
  let layoutMenuOpen = false;
  let menuOpen = false;
  let statusMsg = '';

  const undoStack: BiomeLayoutLibrary[] = [];
  const redoStack: BiomeLayoutLibrary[] = [];
  const MAX_HISTORY = 40;

  const propThumbs = warmPropThumbnails();
  const biomeThumbs = warmBiomeThumbnails();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const dayBg = 0xb8d8e8;
  const nightBg = 0x1a2433;
  scene.background = new THREE.Color(dayBg);
  scene.fog = new THREE.Fog(dayBg, 22, 48);

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 200);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, TILE_HEIGHT * 0.5, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.2;
  controls.maxDistance = 12;
  controls.maxPolarAngle = Math.PI * 0.48;

  const hemi = new THREE.HemisphereLight(STYLE.ambientSky, STYLE.ambientGround, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(STYLE.sun, 1.35);
  sun.position.set(4, 8, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 24;
  sun.shadow.camera.left = -4;
  sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 4;
  sun.shadow.camera.bottom = -4;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(STYLE.fill, 0.35);
  fill.position.set(-3, 2, -4);
  scene.add(fill);

  const stage = new THREE.Group();
  scene.add(stage);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(5, 48),
    new THREE.MeshToonMaterial({ color: 0xd8c4a0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  stage.add(ground);

  const waterRing = new THREE.Mesh(
    new THREE.RingGeometry(1.35, 4.2, 48),
    new THREE.MeshToonMaterial({ color: 0x4aa8c8, transparent: true, opacity: 0.72 }),
  );
  waterRing.rotation.x = -Math.PI / 2;
  waterRing.position.y = -0.04;
  stage.add(waterRing);

  const grid = new THREE.GridHelper(4, 16, 0x8b6a42, 0xc9b090);
  grid.position.y = TILE_HEIGHT + 0.005;
  const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
  for (const m of gridMats) {
    m.transparent = true;
    m.opacity = 0.35;
  }
  stage.add(grid);

  const hexRoot = new THREE.Group();
  stage.add(hexRoot);
  const propsRoot = new THREE.Group();
  propsRoot.position.y = TILE_HEIGHT;
  stage.add(propsRoot);

  const placementGhost = new THREE.Mesh(
    new THREE.RingGeometry(0.1, 0.14, 28),
    new THREE.MeshBasicMaterial({ color: 0x5bc4e8, side: THREE.DoubleSide, depthTest: false }),
  );
  placementGhost.rotation.x = -Math.PI / 2;
  placementGhost.position.y = TILE_HEIGHT + 0.02;
  placementGhost.visible = false;
  stage.add(placementGhost);

  const transform = new TransformControls(camera, canvas);
  transform.setSize(0.85);
  transform.setTranslationSnap(snapStep);
  transform.setRotationSnap(THREE.MathUtils.degToRad(15));
  transform.setScaleSnap(0.05);
  scene.add(transform.getHelper());

  transform.addEventListener('dragging-changed', (ev) => {
    const dragging = Boolean((ev as { value?: boolean }).value);
    controls.enabled = !dragging;
    if (dragging) pushHistory();
    else {
      syncSelectedFromMesh();
      persist();
      renderUi();
    }
  });

  transform.addEventListener('objectChange', () => {
    syncSelectedFromMesh(false);
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TILE_HEIGHT);
  const hitPoint = new THREE.Vector3();

  let hexTile: THREE.Object3D | null = null;
  const propMeshes = new Map<string, THREE.Object3D>();

  function applyCameraPreset(preset: CameraPreset): void {
    cameraPreset = preset;
    if (preset === 'isometric') {
      camera.position.set(3.2, 3.6, 3.2);
      controls.target.set(0, TILE_HEIGHT * 0.4, 0);
      controls.enableRotate = true;
    } else {
      camera.position.set(2.4, 2.2, 3.6);
      controls.target.set(0, TILE_HEIGHT * 0.5, 0);
    }
    controls.update();
  }
  applyCameraPreset('isometric');

  function applyDayNight(day: boolean): void {
    dayMode = day;
    const bg = day ? dayBg : nightBg;
    scene.background = new THREE.Color(bg);
    scene.fog = new THREE.Fog(bg, day ? 22 : 14, day ? 48 : 36);
    hemi.intensity = day ? 0.95 : 0.35;
    sun.intensity = day ? 1.35 : 0.35;
    fill.intensity = day ? 0.35 : 0.15;
    renderer.toneMappingExposure = day ? 1.15 : 0.85;
  }

  function applyGridWater(): void {
    grid.visible = showGrid;
    waterRing.visible = showWater;
  }

  function applySnap(): void {
    if (snapEnabled) {
      transform.setTranslationSnap(snapStep);
      transform.setRotationSnap(THREE.MathUtils.degToRad(15));
      transform.setScaleSnap(0.05);
    } else {
      transform.setTranslationSnap(null);
      transform.setRotationSnap(null);
      transform.setScaleSnap(null);
    }
  }

  function currentLayout(): BiomeLayout | undefined {
    return library.layouts.find((l) => l.id === layoutId);
  }

  function persist(): void {
    saveBiomeLayouts(library);
  }

  function pushHistory(): void {
    undoStack.push(cloneLibrary(library));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
  }

  function undo(): void {
    if (undoStack.length === 0) return;
    redoStack.push(cloneLibrary(library));
    library = undoStack.pop()!;
    ensureLayoutSelection();
    selectedPropId = null;
    persist();
    rebuildProps();
    renderUi();
  }

  function redo(): void {
    if (redoStack.length === 0) return;
    undoStack.push(cloneLibrary(library));
    library = redoStack.pop()!;
    ensureLayoutSelection();
    selectedPropId = null;
    persist();
    rebuildProps();
    renderUi();
  }

  function ensureLayoutSelection(): void {
    const list = layoutsForTerrain(library, terrain);
    if (list.length === 0) {
      const created = createEmptyLayout(terrain, `${TERRAIN_LABELS[terrain]} layout`);
      library.layouts.push(created);
      layoutId = created.id;
      persist();
      return;
    }
    if (!list.some((l) => l.id === layoutId)) {
      layoutId = list[0]!.id;
    }
  }

  function rebuildHex(): void {
    if (hexTile) {
      hexRoot.remove(hexTile);
      disposeObject(hexTile);
      hexTile = null;
    }
    hexTile = makeHexTile({ terrain });
    hexRoot.add(hexTile);
  }

  function remountProp(inst: BiomePropInstance): void {
    const prev = propMeshes.get(inst.id);
    if (prev) {
      if (transform.object === prev) transform.detach();
      propsRoot.remove(prev);
      disposeObject(prev);
      propMeshes.delete(inst.id);
    }
    const obj = createPropObject(inst);
    if (!obj) return;
    propsRoot.add(obj);
    propMeshes.set(inst.id, obj);
  }

  function rebuildProps(): void {
    if (transform.object) transform.detach();
    for (const obj of propMeshes.values()) {
      propsRoot.remove(obj);
      disposeObject(obj);
    }
    propMeshes.clear();
    const layout = currentLayout();
    if (!layout) return;
    for (const instance of layout.props) {
      const obj = createPropObject(instance);
      if (!obj) continue;
      propsRoot.add(obj);
      propMeshes.set(instance.id, obj);
    }
    attachTransform();
  }

  function applyToolToTransform(): void {
    switch (tool) {
      case 'select':
      case 'move':
        transform.setMode('translate');
        transform.showX = true;
        transform.showY = false;
        transform.showZ = true;
        break;
      case 'rotate':
        transform.setMode('rotate');
        transform.showX = false;
        transform.showY = true;
        transform.showZ = false;
        break;
      case 'scale':
        transform.setMode('scale');
        transform.showX = true;
        transform.showY = true;
        transform.showZ = true;
        break;
      default: {
        const _exhaustive: never = tool;
        void _exhaustive;
      }
    }
    transform.enabled = tool !== 'select' && selectedPropId !== null;
    transform.getHelper().visible = tool !== 'select' && selectedPropId !== null;
  }

  function attachTransform(): void {
    if (!selectedPropId) {
      transform.detach();
      transform.getHelper().visible = false;
      return;
    }
    const mesh = propMeshes.get(selectedPropId);
    if (!mesh) {
      transform.detach();
      return;
    }
    transform.attach(mesh);
    applyToolToTransform();
  }

  function syncSelectedFromMesh(clamp = true): void {
    if (!selectedPropId || !transform.object) return;
    const layout = currentLayout();
    const inst = layout?.props.find((p) => p.id === selectedPropId);
    const mesh = transform.object;
    if (!inst || !mesh) return;

    let x = mesh.position.x;
    let z = mesh.position.z;
    if (clamp) {
      const c = clampHex(x, z);
      x = c.x;
      z = c.z;
    }
    if (snapEnabled && tool === 'move') {
      x = snapValue(x, snapStep);
      z = snapValue(z, snapStep);
    }
    inst.x = x;
    inst.z = z;
    inst.yaw = mesh.rotation.y;
    const s = (mesh.scale.x + mesh.scale.y + mesh.scale.z) / 3;
    inst.scale = Math.max(0.15, Math.min(3, s));
    mesh.position.x = inst.x;
    mesh.position.z = inst.z;
  }

  function selectProp(id: string | null): void {
    selectedPropId = id;
    attachTransform();
    renderUi();
  }

  function findPropId(obj: THREE.Object3D | null): string | null {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      const id = cur.userData?.biomePropId;
      if (typeof id === 'string') return id;
      cur = cur.parent;
    }
    return null;
  }

  function setPointerFromEvent(ev: PointerEvent | DragEvent): void {
    pointer.x = (ev.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(ev.clientY / window.innerHeight) * 2 + 1;
  }

  function planeHit(ev: PointerEvent | DragEvent): THREE.Vector3 | null {
    setPointerFromEvent(ev);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(dragPlane, hitPoint)) return null;
    return hitPoint.clone();
  }

  function addPropAt(kind: BiomePropKind, x: number, z: number): void {
    pushHistory();
    const layout = currentLayout();
    if (!layout) return;
    const c = clampHex(x, z);
    let px = c.x;
    let pz = c.z;
    if (snapEnabled) {
      px = snapValue(px, snapStep);
      pz = snapValue(pz, snapStep);
    }
    const inst = createPropInstance(kind, px, pz);
    layout.props.push(inst);
    selectedPropId = inst.id;
    persist();
    remountProp(inst);
    attachTransform();
    statusMsg = `Added ${getAssetById(kind)?.name ?? kind}`;
    renderUi();
  }

  function onPointerDown(ev: PointerEvent): void {
    if (ev.button !== 0) return;
    if (transform.dragging) return;
    setPointerFromEvent(ev);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...propMeshes.values()], true);
    const id = findPropId(hits[0]?.object ?? null);
    if (id) {
      selectProp(id);
      return;
    }
    // Click empty — deselect (unless over UI)
    selectProp(null);
  }

  canvas.addEventListener('pointerdown', onPointerDown);

  canvas.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    const hit = planeHit(ev);
    if (!hit) {
      placementGhost.visible = false;
      return;
    }
    const c = clampHex(hit.x, hit.z);
    placementGhost.position.set(c.x, TILE_HEIGHT + 0.02, c.z);
    placementGhost.visible = true;
  });

  canvas.addEventListener('dragleave', () => {
    placementGhost.visible = false;
  });

  canvas.addEventListener('drop', (ev) => {
    ev.preventDefault();
    placementGhost.visible = false;
    const kind = ev.dataTransfer?.getData('text/biome-prop') as BiomePropKind;
    if (!kind || !(BIOME_PROP_KINDS as readonly string[]).includes(kind)) return;
    const hit = planeHit(ev);
    if (!hit) return;
    addPropAt(kind, hit.x, hit.z);
  });

  window.addEventListener('keydown', (ev) => {
    const tag = (ev.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      if (ev.shiftKey) redo();
      else undo();
      return;
    }
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'y') {
      ev.preventDefault();
      redo();
      return;
    }
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      persist();
      statusMsg = 'Saved';
      renderUi();
      return;
    }

    switch (ev.key.toLowerCase()) {
      case 'q':
        tool = 'select';
        applyToolToTransform();
        renderUi();
        break;
      case 'g':
        tool = 'move';
        applyToolToTransform();
        renderUi();
        break;
      case 'r':
        tool = 'rotate';
        applyToolToTransform();
        renderUi();
        break;
      case 's':
        if (!ev.metaKey && !ev.ctrlKey) {
          tool = 'scale';
          applyToolToTransform();
          renderUi();
        }
        break;
      case 'delete':
      case 'backspace':
        if (selectedPropId) {
          deleteSelectedProp();
        }
        break;
      default:
        break;
    }
  });

  function deleteSelectedProp(): void {
    if (!selectedPropId) return;
    pushHistory();
    const id = selectedPropId;
    const layout = currentLayout();
    if (!layout) return;
    layout.props = layout.props.filter((p) => p.id !== id);
    selectedPropId = null;
    persist();
    rebuildProps();
    renderUi();
  }

  function duplicateSelectedProp(): void {
    if (!selectedPropId) return;
    const layout = currentLayout();
    const src = layout?.props.find((p) => p.id === selectedPropId);
    if (!layout || !src) return;
    pushHistory();
    const copy: BiomePropInstance = {
      ...src,
      id: `prop-${src.kind}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
      x: src.x + 0.12,
      z: src.z + 0.08,
    };
    const c = clampHex(copy.x, copy.z);
    copy.x = c.x;
    copy.z = c.z;
    layout.props.push(copy);
    selectedPropId = copy.id;
    persist();
    remountProp(copy);
    attachTransform();
    renderUi();
  }

  function filteredProps(): BiomePropKind[] {
    const q = propQuery.trim().toLowerCase();
    if (!q) return [...BIOME_PROP_KINDS];
    return BIOME_PROP_KINDS.filter((k) => {
      const def = getAssetById(k);
      return k.includes(q) || (def?.name.toLowerCase().includes(q) ?? false);
    });
  }

  function renderUi(): void {
    ensureLayoutSelection();
    const layout = currentLayout()!;
    const terrainLayouts = layoutsForTerrain(library, terrain);
    const selected = layout.props.find((p) => p.id === selectedPropId) ?? null;
    const props = filteredProps();

    root.innerHTML = `
      <header class="be-topbar" aria-label="Editor toolbar">
        <div class="be-topbar-left">
          <a class="be-icon-btn" href="${gameHref()}" title="Back to game">←</a>
          <button type="button" class="be-icon-btn" data-act="undo" title="Undo" ${undoStack.length ? '' : 'disabled'}>↺</button>
          <button type="button" class="be-icon-btn" data-act="redo" title="Redo" ${redoStack.length ? '' : 'disabled'}>↻</button>
        </div>
        <div class="be-topbar-center">
          <button type="button" class="be-chip${dayMode ? ' active' : ''}" data-act="toggle-day">${dayMode ? '☀ Day' : '☾ Night'}</button>
          <button type="button" class="be-chip${showGrid ? ' active' : ''}" data-act="toggle-grid">Grid</button>
          <button type="button" class="be-chip${showWater ? ' active' : ''}" data-act="toggle-water">Water</button>
          <label class="be-chip be-select-chip">
            Camera
            <select data-field="camera">
              <option value="isometric"${cameraPreset === 'isometric' ? ' selected' : ''}>Isometric</option>
              <option value="orbit"${cameraPreset === 'orbit' ? ' selected' : ''}>Orbit</option>
            </select>
          </label>
        </div>
        <div class="be-topbar-right">
          ${statusMsg ? `<span class="be-status">${escapeHtml(statusMsg)}</span>` : ''}
          <button type="button" class="be-btn" data-act="save">Save</button>
          <button type="button" class="be-btn primary" data-act="preview">▶ Preview</button>
          <div class="be-menu-wrap">
            <button type="button" class="be-icon-btn" data-act="toggle-menu" title="Menu">☰</button>
            ${
              menuOpen
                ? `<div class="be-menu">
                    <button type="button" data-act="export">Export JSON</button>
                    <button type="button" data-act="import">Import JSON</button>
                    <button type="button" data-act="reset">Reset defaults</button>
                  </div>`
                : ''
            }
          </div>
        </div>
      </header>

      <aside class="be-left" aria-label="Biomes and props">
        <div class="be-section">
          <h2>Biomes</h2>
          <div class="be-biome-list">
            ${TERRAIN_ORDER.map((t) => {
              const thumb = biomeThumbs.get(t) ?? '';
              return `<button type="button" class="be-biome-item${t === terrain ? ' active' : ''}" data-terrain="${t}">
                <span class="be-biome-thumb"${thumb ? ` style="background-image:url('${thumb}')"` : ''}></span>
                <span class="be-biome-label">${escapeHtml(TERRAIN_LABELS[t])}</span>
              </button>`;
            }).join('')}
          </div>
        </div>

        <div class="be-section be-section-grow">
          <h2>Props</h2>
          <input class="be-search" data-field="prop-search" placeholder="Search props…" value="${escapeHtml(propQuery)}" />
          <div class="be-prop-grid">
            ${props
              .map((k) => {
                const def = getAssetById(k);
                const thumb = propThumbs.get(k) ?? '';
                const label = def?.name ?? k;
                return `<button type="button" class="be-prop-card" data-add="${k}" draggable="true" title="Drag onto hex or click to place">
                  <span class="be-prop-thumb"${thumb ? ` style="background-image:url('${thumb}')"` : ''}></span>
                  <span class="be-prop-tag">${escapeHtml(label)}</span>
                </button>`;
              })
              .join('')}
          </div>
        </div>

        <div class="be-section">
          <div class="be-section-head">
            <h2>${escapeHtml(TERRAIN_LABELS[terrain])} layouts</h2>
          </div>
          <div class="be-layout-list">
            ${terrainLayouts
              .map((l) => {
                const active = l.id === layoutId;
                return `<div class="be-layout-row${active ? ' active' : ''}">
                  <button type="button" class="be-layout-main" data-layout="${escapeHtml(l.id)}">
                    <span class="be-layout-name">${escapeHtml(l.name)}</span>
                    <span class="be-layout-meta">${l.props.length} props</span>
                  </button>
                  ${
                    active
                      ? `<button type="button" class="be-icon-btn be-layout-more" data-act="toggle-layout-menu" title="Layout options">⋮</button>`
                      : ''
                  }
                </div>`;
              })
              .join('')}
          </div>
          ${
            layoutMenuOpen
              ? `<div class="be-layout-menu">
                  <button type="button" data-act="rename-layout">Rename</button>
                  <button type="button" data-act="dup-layout">Duplicate</button>
                  <button type="button" data-act="del-layout">Delete</button>
                </div>`
              : ''
          }
          <button type="button" class="be-btn block" data-act="new-layout">+ New ${escapeHtml(TERRAIN_LABELS[terrain])} layout</button>
        </div>
      </aside>

      <aside class="be-right" aria-label="Inspector">
        ${
          selected
            ? `
          <div class="be-insp-head">
            <span class="be-insp-thumb"${propThumbs.get(selected.kind) ? ` style="background-image:url('${propThumbs.get(selected.kind)}')"` : ''}></span>
            <div>
              <strong>${escapeHtml(getAssetById(selected.kind)?.name ?? selected.kind)}</strong>
              <span class="be-insp-kind">Prop</span>
            </div>
          </div>
          <div class="be-insp-tabs">
            <button type="button" class="be-insp-tab${inspectorTab === 'transform' ? ' active' : ''}" data-tab="transform">Transform</button>
            <button type="button" class="be-insp-tab${inspectorTab === 'details' ? ' active' : ''}" data-tab="details">Details</button>
          </div>
          ${
            inspectorTab === 'transform'
              ? `<div class="be-insp-body">
                  <label class="be-field"><span>Position X</span><input type="number" step="${snapStep}" data-insp="x" value="${selected.x.toFixed(3)}" /></label>
                  <label class="be-field"><span>Position Y</span><input type="number" step="0.01" value="0" disabled title="Props stay on hex surface" /></label>
                  <label class="be-field"><span>Position Z</span><input type="number" step="${snapStep}" data-insp="z" value="${selected.z.toFixed(3)}" /></label>
                  <label class="be-field"><span>Rotation Y°</span><input type="number" step="1" data-insp="yaw" value="${((selected.yaw * 180) / Math.PI).toFixed(1)}" /></label>
                  <label class="be-field"><span>Scale</span><input type="number" step="0.05" min="0.15" max="3" data-insp="scale" value="${selected.scale.toFixed(2)}" /></label>
                </div>`
              : `<div class="be-insp-body">
                  <label class="be-field"><span>Asset</span><input type="text" value="${escapeHtml(selected.kind)}" disabled /></label>
                  <label class="be-field"><span>Variant</span><input type="number" step="1" min="0" max="8" data-insp="variant" value="${selected.variant ?? 0}" /></label>
                  <p class="be-insp-note">${escapeHtml(getAssetById(selected.kind)?.description ?? '')}</p>
                </div>`
          }
          <div class="be-insp-actions">
            <button type="button" class="be-btn" data-act="dup-prop">Duplicate</button>
            <button type="button" class="be-btn danger" data-act="del-prop">Delete</button>
          </div>`
            : `<div class="be-insp-empty">
              <strong>Inspector</strong>
              <p>Select a prop on the hex to edit transform and details.</p>
              <p class="be-insp-hint">Drag props from the library, or click a prop card to drop it at center.</p>
            </div>`
        }
      </aside>

      <div class="be-stage-chrome" aria-hidden="false">
        <div class="be-layout-chip">
          <button type="button" class="be-layout-chip-btn" data-act="rename-layout" title="Rename layout">
            <strong>${escapeHtml(layout.name)}</strong>
            <span>${layout.props.length} props</span>
            <span class="be-layout-chip-edit">✎</span>
          </button>
        </div>
        <div class="be-tool-dock" aria-label="Transform tools">
          <button type="button" class="be-tool${tool === 'select' ? ' active' : ''}" data-tool="select" title="Select (Q)">Select</button>
          <button type="button" class="be-tool${tool === 'move' ? ' active' : ''}" data-tool="move" title="Move (G)">Move</button>
          <button type="button" class="be-tool${tool === 'rotate' ? ' active' : ''}" data-tool="rotate" title="Rotate (R)">Rotate</button>
          <button type="button" class="be-tool${tool === 'scale' ? ' active' : ''}" data-tool="scale" title="Scale (S)">Scale</button>
          <button type="button" class="be-tool be-snap${snapEnabled ? ' active' : ''}" data-act="toggle-snap" title="Snap">🧲 ${snapStep.toFixed(1)}</button>
          <select class="be-snap-select" data-field="snap-step" title="Snap step">
            <option value="0.05"${snapStep === 0.05 ? ' selected' : ''}>0.05</option>
            <option value="0.1"${snapStep === 0.1 ? ' selected' : ''}>0.1</option>
            <option value="0.25"${snapStep === 0.25 ? ' selected' : ''}>0.25</option>
            <option value="0.5"${snapStep === 0.5 ? ' selected' : ''}>0.5</option>
          </select>
        </div>
      </div>

      <input type="file" accept="application/json,.json" data-import-file style="display:none" />
    `;

    wireUi();
  }

  function wireUi(): void {
    root.querySelectorAll<HTMLButtonElement>('[data-terrain]').forEach((btn) => {
      btn.addEventListener('click', () => {
        terrain = btn.dataset.terrain as Terrain;
        selectedPropId = null;
        layoutMenuOpen = false;
        ensureLayoutSelection();
        rebuildHex();
        rebuildProps();
        renderUi();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-layout]').forEach((btn) => {
      btn.addEventListener('click', () => {
        layoutId = btn.dataset.layout!;
        selectedPropId = null;
        layoutMenuOpen = false;
        rebuildProps();
        renderUi();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        tool = btn.dataset.tool as ToolMode;
        applyToolToTransform();
        renderUi();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        inspectorTab = btn.dataset.tab as InspectorTab;
        renderUi();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((btn) => {
      const kind = btn.dataset.add as BiomePropKind;
      btn.addEventListener('dragstart', (ev) => {
        ev.dataTransfer?.setData('text/biome-prop', kind);
        ev.dataTransfer!.effectAllowed = 'copy';
      });
      btn.addEventListener('click', () => {
        addPropAt(kind, 0, 0);
      });
    });

    root.querySelector<HTMLInputElement>('[data-field="prop-search"]')?.addEventListener('input', (ev) => {
      propQuery = (ev.target as HTMLInputElement).value;
      renderUi();
      const input = root.querySelector<HTMLInputElement>('[data-field="prop-search"]');
      input?.focus();
      input?.setSelectionRange(propQuery.length, propQuery.length);
    });

    root.querySelector<HTMLSelectElement>('[data-field="camera"]')?.addEventListener('change', (ev) => {
      applyCameraPreset((ev.target as HTMLSelectElement).value as CameraPreset);
      renderUi();
    });

    root.querySelector<HTMLSelectElement>('[data-field="snap-step"]')?.addEventListener('change', (ev) => {
      snapStep = Number((ev.target as HTMLSelectElement).value);
      applySnap();
      renderUi();
    });

    const act = (name: string, fn: () => void) => {
      root.querySelectorAll(`[data-act="${name}"]`).forEach((el) => {
        el.addEventListener('click', fn);
      });
    };

    act('undo', undo);
    act('redo', redo);
    act('toggle-day', () => {
      applyDayNight(!dayMode);
      renderUi();
    });
    act('toggle-grid', () => {
      showGrid = !showGrid;
      applyGridWater();
      renderUi();
    });
    act('toggle-water', () => {
      showWater = !showWater;
      applyGridWater();
      renderUi();
    });
    act('toggle-snap', () => {
      snapEnabled = !snapEnabled;
      applySnap();
      renderUi();
    });
    act('toggle-menu', () => {
      menuOpen = !menuOpen;
      layoutMenuOpen = false;
      renderUi();
    });
    act('toggle-layout-menu', () => {
      layoutMenuOpen = !layoutMenuOpen;
      menuOpen = false;
      renderUi();
    });
    act('save', () => {
      persist();
      statusMsg = 'Saved layouts';
      renderUi();
    });
    act('preview', () => {
      // Cycle layouts for this terrain to preview variety
      const list = layoutsForTerrain(library, terrain);
      if (list.length === 0) return;
      const idx = list.findIndex((l) => l.id === layoutId);
      layoutId = list[(idx + 1) % list.length]!.id;
      selectedPropId = null;
      rebuildProps();
      statusMsg = `Preview: ${currentLayout()?.name ?? ''}`;
      renderUi();
    });
    act('export', () => {
      const blob = new Blob([exportBiomeLayoutsJson(library)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'biome-layouts.json';
      a.click();
      URL.revokeObjectURL(url);
      menuOpen = false;
      statusMsg = 'Exported JSON';
      renderUi();
    });
    act('import', () => {
      root.querySelector<HTMLInputElement>('[data-import-file]')?.click();
    });
    act('reset', () => {
      pushHistory();
      library = resetBiomeLayouts();
      ensureLayoutSelection();
      selectedPropId = null;
      menuOpen = false;
      rebuildHex();
      rebuildProps();
      statusMsg = 'Reset to defaults';
      renderUi();
    });
    act('new-layout', () => {
      pushHistory();
      const created = createEmptyLayout(
        terrain,
        `${TERRAIN_LABELS[terrain]} ${layoutsForTerrain(library, terrain).length + 1}`,
      );
      library.layouts.push(created);
      layoutId = created.id;
      selectedPropId = null;
      persist();
      rebuildProps();
      renderUi();
    });
    act('dup-layout', () => {
      const src = currentLayout();
      if (!src) return;
      pushHistory();
      const copy: BiomeLayout = {
        id: `layout-${terrain}-${Date.now().toString(36)}`,
        name: `${src.name} copy`,
        terrain: src.terrain,
        props: src.props.map((p) => ({
          ...p,
          id: `prop-${p.kind}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
        })),
      };
      library.layouts.push(copy);
      layoutId = copy.id;
      selectedPropId = null;
      layoutMenuOpen = false;
      persist();
      rebuildProps();
      renderUi();
    });
    act('del-layout', () => {
      const list = layoutsForTerrain(library, terrain);
      if (list.length <= 1) {
        statusMsg = 'Keep at least one layout per biome';
        layoutMenuOpen = false;
        renderUi();
        return;
      }
      pushHistory();
      library.layouts = library.layouts.filter((l) => l.id !== layoutId);
      selectedPropId = null;
      layoutMenuOpen = false;
      ensureLayoutSelection();
      persist();
      rebuildProps();
      renderUi();
    });
    act('rename-layout', () => {
      const layout = currentLayout();
      if (!layout) return;
      const next = window.prompt('Layout name', layout.name);
      if (!next || !next.trim()) return;
      pushHistory();
      layout.name = next.trim();
      layoutMenuOpen = false;
      persist();
      renderUi();
    });
    act('dup-prop', duplicateSelectedProp);
    act('del-prop', deleteSelectedProp);

    const fileInput = root.querySelector<HTMLInputElement>('[data-import-file]');
    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        pushHistory();
        library = importBiomeLayoutsJson(await file.text());
        persist();
        ensureLayoutSelection();
        selectedPropId = null;
        menuOpen = false;
        rebuildHex();
        rebuildProps();
        statusMsg = 'Imported layouts';
        renderUi();
      } catch {
        statusMsg = 'Import failed';
        renderUi();
      }
      fileInput.value = '';
    });

    root.querySelectorAll<HTMLInputElement>('[data-insp]').forEach((input) => {
      input.addEventListener('change', () => {
        const field = input.dataset.insp!;
        const layout = currentLayout();
        const inst = layout?.props.find((p) => p.id === selectedPropId);
        if (!inst || !layout) return;
        const n = Number(input.value);
        if (!Number.isFinite(n)) return;
        pushHistory();
        switch (field) {
          case 'x': {
            const c = clampHex(n, inst.z);
            inst.x = snapEnabled ? snapValue(c.x, snapStep) : c.x;
            inst.z = c.z;
            break;
          }
          case 'z': {
            const c = clampHex(inst.x, n);
            inst.x = c.x;
            inst.z = snapEnabled ? snapValue(c.z, snapStep) : c.z;
            break;
          }
          case 'yaw':
            inst.yaw = (n * Math.PI) / 180;
            break;
          case 'scale':
            inst.scale = Math.max(0.15, Math.min(3, n));
            break;
          case 'variant':
            inst.variant = Math.max(0, Math.floor(n));
            break;
          default:
            break;
        }
        persist();
        remountProp(inst);
        attachTransform();
        renderUi();
      });
    });
  }

  applyGridWater();
  applySnap();
  ensureLayoutSelection();
  rebuildHex();
  rebuildProps();
  renderUi();

  function onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  function animate(): void {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}
