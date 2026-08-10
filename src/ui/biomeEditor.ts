/**
 * Biome Layout Editor — author prop placements per hex terrain.
 * Open via ?view=biome-editor (also linked from the lobby).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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

type ToolMode = 'move' | 'rotate' | 'scale';

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  let terrain: Terrain = 'wood';
  let layoutId = layoutsForTerrain(library, terrain)[0]?.id ?? '';
  let selectedPropId: string | null = null;
  let tool: ToolMode = 'move';
  let statusMsg = 'Drag props on the hex · tools: Move / Rotate / Scale';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8d8e8);
  scene.fog = new THREE.Fog(0xb8d8e8, 22, 48);

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 200);
  camera.position.set(2.8, 3.2, 3.4);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, TILE_HEIGHT * 0.5, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.2;
  controls.maxDistance = 12;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.update();

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

  const hexRoot = new THREE.Group();
  stage.add(hexRoot);
  const propsRoot = new THREE.Group();
  propsRoot.position.y = TILE_HEIGHT;
  stage.add(propsRoot);

  const selectionRing = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.11, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8a838, side: THREE.DoubleSide, depthTest: false }),
  );
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = TILE_HEIGHT + 0.01;
  selectionRing.visible = false;
  stage.add(selectionRing);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TILE_HEIGHT);
  const hitPoint = new THREE.Vector3();

  let hexTile: THREE.Object3D | null = null;
  const propMeshes = new Map<string, THREE.Object3D>();

  let dragging = false;
  let dragPropId: string | null = null;
  let dragStartXZ = { x: 0, z: 0 };
  let dragStartYaw = 0;
  let dragStartScale = 1;
  let dragStartPointerAngle = 0;
  let dragStartPointerDist = 0;

  function currentLayout(): BiomeLayout | undefined {
    return library.layouts.find((l) => l.id === layoutId);
  }

  function persist(): void {
    saveBiomeLayouts(library);
  }

  function ensureLayoutSelection(): void {
    const list = layoutsForTerrain(library, terrain);
    if (list.length === 0) {
      const created = createEmptyLayout(terrain);
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

  function rebuildProps(): void {
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
      // createPropObject places at local xz with factory y; propsRoot already at TILE_HEIGHT
      propsRoot.add(obj);
      propMeshes.set(instance.id, obj);
    }
    updateSelectionVisual();
  }

  function updateSelectionVisual(): void {
    const layout = currentLayout();
    const inst = layout?.props.find((p) => p.id === selectedPropId);
    if (!inst) {
      selectionRing.visible = false;
      return;
    }
    selectionRing.visible = true;
    selectionRing.position.set(inst.x, TILE_HEIGHT + 0.01, inst.z);
    const r = 0.06 + Math.max(0.04, 0.05 * inst.scale);
    selectionRing.geometry.dispose();
    selectionRing.geometry = new THREE.RingGeometry(r, r + 0.03, 24);
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

  function setPointerFromEvent(ev: PointerEvent): void {
    pointer.x = (ev.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(ev.clientY / window.innerHeight) * 2 + 1;
  }

  function planeHit(ev: PointerEvent): THREE.Vector3 | null {
    setPointerFromEvent(ev);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(dragPlane, hitPoint)) return null;
    return hitPoint.clone();
  }

  function onPointerDown(ev: PointerEvent): void {
    if (ev.button !== 0) return;
    setPointerFromEvent(ev);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...propMeshes.values()], true);
    const id = findPropId(hits[0]?.object ?? null);
    if (!id) {
      selectedPropId = null;
      updateSelectionVisual();
      renderUi();
      return;
    }
    selectedPropId = id;
    const layout = currentLayout();
    const inst = layout?.props.find((p) => p.id === id);
    if (!inst) return;

    dragging = true;
    dragPropId = id;
    dragStartXZ = { x: inst.x, z: inst.z };
    dragStartYaw = inst.yaw;
    dragStartScale = inst.scale;
    const hit = planeHit(ev);
    if (hit) {
      dragStartPointerAngle = Math.atan2(hit.z - inst.z, hit.x - inst.x);
      dragStartPointerDist = Math.hypot(hit.x - inst.x, hit.z - inst.z) || 0.01;
    }
    controls.enabled = false;
    updateSelectionVisual();
    renderUi();
  }

  function onPointerMove(ev: PointerEvent): void {
    if (!dragging || !dragPropId) return;
    const layout = currentLayout();
    const inst = layout?.props.find((p) => p.id === dragPropId);
    if (!inst || !layout) return;
    const hit = planeHit(ev);
    if (!hit) return;

    if (tool === 'move') {
      const clamped = clampHex(hit.x, hit.z);
      inst.x = clamped.x;
      inst.z = clamped.z;
    } else if (tool === 'rotate') {
      const angle = Math.atan2(hit.z - inst.z, hit.x - inst.x);
      inst.yaw = dragStartYaw + (angle - dragStartPointerAngle);
    } else if (tool === 'scale') {
      const dist = Math.hypot(hit.x - dragStartXZ.x, hit.z - dragStartXZ.z) || 0.01;
      const ratio = dist / dragStartPointerDist;
      inst.scale = Math.max(0.15, Math.min(3, dragStartScale * ratio));
    } else {
      const _exhaustive: never = tool;
      void _exhaustive;
    }

    const mesh = propMeshes.get(inst.id);
    if (mesh) {
      const localY = mesh.position.y;
      mesh.position.set(inst.x, localY, inst.z);
      mesh.rotation.y = inst.yaw;
      // Re-create is safer for scale-via-opts kinds, but live scale works for preview:
      mesh.scale.setScalar(1);
      // Remount for accurate scale from factory
    }
    // Live remount selected prop for correct scale baking
    remountProp(inst);
    updateSelectionVisual();
  }

  function remountProp(inst: BiomePropInstance): void {
    const prev = propMeshes.get(inst.id);
    if (prev) {
      propsRoot.remove(prev);
      disposeObject(prev);
      propMeshes.delete(inst.id);
    }
    const obj = createPropObject(inst);
    if (!obj) return;
    propsRoot.add(obj);
    propMeshes.set(inst.id, obj);
  }

  function onPointerUp(): void {
    if (!dragging) return;
    dragging = false;
    dragPropId = null;
    controls.enabled = true;
    persist();
    renderUi();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  function mutateLayout(fn: (layout: BiomeLayout) => void): void {
    const layout = currentLayout();
    if (!layout) return;
    fn(layout);
    persist();
    rebuildProps();
    renderUi();
  }

  function renderUi(): void {
    ensureLayoutSelection();
    const layout = currentLayout()!;
    const terrainLayouts = layoutsForTerrain(library, terrain);
    const selected = layout.props.find((p) => p.id === selectedPropId) ?? null;

    root.innerHTML = `
      <aside class="biome-editor-panel" aria-label="Biome layouts">
        <header class="biome-editor-header">
          <div>
            <p class="biome-editor-eyebrow">Dev tools</p>
            <h1>Biome Editor</h1>
          </div>
          <a class="btn secondary biome-editor-back" href="${gameHref()}">← Game</a>
        </header>
        <p class="biome-editor-lede">Author hex decoration layouts. Each hex of a type randomly picks one layout when the board builds.</p>

        <div class="biome-terrain-tabs" role="tablist">
          ${TERRAIN_ORDER.map(
            (t) => `
            <button type="button" class="biome-terrain-tab${t === terrain ? ' active' : ''}" data-terrain="${t}" title="${escapeHtml(TERRAIN_LABELS[t])}">
              ${escapeHtml(TERRAIN_LABELS[t])}
            </button>`,
          ).join('')}
        </div>

        <div class="biome-layout-toolbar">
          <strong>${escapeHtml(TERRAIN_LABELS[terrain])} layouts</strong>
          <button type="button" class="btn secondary" data-act="new-layout">+ New</button>
        </div>
        <div class="biome-layout-list">
          ${terrainLayouts
            .map(
              (l) => `
            <button type="button" class="biome-layout-item${l.id === layoutId ? ' active' : ''}" data-layout="${escapeHtml(l.id)}">
              <span class="biome-layout-name">${escapeHtml(l.name)}</span>
              <span class="biome-layout-count">${l.props.length} props</span>
            </button>`,
            )
            .join('')}
        </div>

        <div class="biome-layout-actions">
          <input class="biome-name-input" data-field="layout-name" value="${escapeHtml(layout.name)}" />
          <button type="button" class="btn secondary" data-act="dup-layout">Duplicate</button>
          <button type="button" class="btn secondary" data-act="del-layout">Delete</button>
        </div>

        <div class="biome-palette">
          <strong>Add prop</strong>
          <div class="biome-palette-items">
            ${BIOME_PROP_KINDS.map((k) => {
              const def = getAssetById(k);
              return `<button type="button" class="biome-palette-item" data-add="${k}">${escapeHtml(def?.name ?? k)}</button>`;
            }).join('')}
          </div>
        </div>

        <div class="biome-io">
          <button type="button" class="btn secondary" data-act="export">Export JSON</button>
          <button type="button" class="btn secondary" data-act="import">Import JSON</button>
          <button type="button" class="btn secondary" data-act="reset">Reset defaults</button>
        </div>
        <input type="file" accept="application/json,.json" data-import-file style="display:none" />
      </aside>

      <div class="biome-editor-toolbar" aria-label="Transform tools">
        <div class="biome-tool-group">
          ${(['move', 'rotate', 'scale'] as ToolMode[])
            .map(
              (m) => `
            <button type="button" class="btn secondary biome-tool${tool === m ? ' active' : ''}" data-tool="${m}">
              ${m[0]!.toUpperCase()}${m.slice(1)}
            </button>`,
            )
            .join('')}
        </div>
        <div class="biome-editor-status">${escapeHtml(statusMsg)}</div>
        ${
          selected
            ? `<div class="biome-inspector">
                <strong>${escapeHtml(getAssetById(selected.kind)?.name ?? selected.kind)}</strong>
                <label>X <input type="number" step="0.01" data-insp="x" value="${selected.x.toFixed(3)}" /></label>
                <label>Z <input type="number" step="0.01" data-insp="z" value="${selected.z.toFixed(3)}" /></label>
                <label>Yaw° <input type="number" step="1" data-insp="yaw" value="${((selected.yaw * 180) / Math.PI).toFixed(1)}" /></label>
                <label>Scale <input type="number" step="0.05" min="0.15" max="3" data-insp="scale" value="${selected.scale.toFixed(2)}" /></label>
                <label>Variant <input type="number" step="1" min="0" max="8" data-insp="variant" value="${selected.variant ?? 0}" /></label>
                <button type="button" class="btn secondary" data-act="del-prop">Delete prop</button>
              </div>`
            : `<div class="biome-inspector muted">Select a prop on the hex to edit.</div>`
        }
      </div>
    `;

    root.querySelectorAll<HTMLButtonElement>('[data-terrain]').forEach((btn) => {
      btn.addEventListener('click', () => {
        terrain = btn.dataset.terrain as Terrain;
        selectedPropId = null;
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
        rebuildProps();
        renderUi();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        tool = btn.dataset.tool as ToolMode;
        statusMsg =
          tool === 'move'
            ? 'Drag to move on the hex plane'
            : tool === 'rotate'
              ? 'Drag around the prop to rotate yaw'
              : 'Drag away/toward the prop to scale';
        renderUi();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.add as BiomePropKind;
        mutateLayout((l) => {
          const inst = createPropInstance(kind, 0, 0);
          l.props.push(inst);
          selectedPropId = inst.id;
        });
        statusMsg = `Added ${getAssetById(kind)?.name ?? kind}`;
      });
    });

    root.querySelector<HTMLInputElement>('[data-field="layout-name"]')?.addEventListener('change', (ev) => {
      const v = (ev.target as HTMLInputElement).value.trim() || 'Untitled';
      mutateLayout((l) => {
        l.name = v;
      });
    });

    root.querySelector<HTMLButtonElement>('[data-act="new-layout"]')?.addEventListener('click', () => {
      const created = createEmptyLayout(terrain, `Layout ${layoutsForTerrain(library, terrain).length + 1}`);
      library.layouts.push(created);
      layoutId = created.id;
      selectedPropId = null;
      persist();
      rebuildProps();
      renderUi();
    });

    root.querySelector<HTMLButtonElement>('[data-act="dup-layout"]')?.addEventListener('click', () => {
      const src = currentLayout();
      if (!src) return;
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
      persist();
      rebuildProps();
      renderUi();
    });

    root.querySelector<HTMLButtonElement>('[data-act="del-layout"]')?.addEventListener('click', () => {
      const list = layoutsForTerrain(library, terrain);
      if (list.length <= 1) {
        statusMsg = 'Keep at least one layout per hex type';
        renderUi();
        return;
      }
      library.layouts = library.layouts.filter((l) => l.id !== layoutId);
      selectedPropId = null;
      ensureLayoutSelection();
      persist();
      rebuildProps();
      renderUi();
    });

    root.querySelector<HTMLButtonElement>('[data-act="del-prop"]')?.addEventListener('click', () => {
      if (!selectedPropId) return;
      const id = selectedPropId;
      selectedPropId = null;
      mutateLayout((l) => {
        l.props = l.props.filter((p) => p.id !== id);
      });
    });

    root.querySelectorAll<HTMLInputElement>('[data-insp]').forEach((input) => {
      input.addEventListener('change', () => {
        const field = input.dataset.insp!;
        const layout = currentLayout();
        const inst = layout?.props.find((p) => p.id === selectedPropId);
        if (!inst || !layout) return;
        const n = Number(input.value);
        if (!Number.isFinite(n)) return;
        switch (field) {
          case 'x': {
            const c = clampHex(n, inst.z);
            inst.x = c.x;
            inst.z = c.z;
            break;
          }
          case 'z': {
            const c = clampHex(inst.x, n);
            inst.x = c.x;
            inst.z = c.z;
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
        updateSelectionVisual();
        renderUi();
      });
    });

    root.querySelector<HTMLButtonElement>('[data-act="export"]')?.addEventListener('click', () => {
      const blob = new Blob([exportBiomeLayoutsJson(library)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'biome-layouts.json';
      a.click();
      URL.revokeObjectURL(url);
      statusMsg = 'Exported biome-layouts.json';
      renderUi();
    });

    const fileInput = root.querySelector<HTMLInputElement>('[data-import-file]')!;
    root.querySelector<HTMLButtonElement>('[data-act="import"]')?.addEventListener('click', () => {
      fileInput.click();
    });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        library = importBiomeLayoutsJson(text);
        persist();
        ensureLayoutSelection();
        selectedPropId = null;
        rebuildHex();
        rebuildProps();
        statusMsg = 'Imported layouts';
        renderUi();
      } catch {
        statusMsg = 'Import failed — invalid JSON';
        renderUi();
      }
      fileInput.value = '';
    });

    root.querySelector<HTMLButtonElement>('[data-act="reset"]')?.addEventListener('click', () => {
      library = resetBiomeLayouts();
      ensureLayoutSelection();
      selectedPropId = null;
      rebuildHex();
      rebuildProps();
      statusMsg = 'Reset to defaults';
      renderUi();
    });
  }

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
