/**
 * Asset Lab — isolated Three.js stage for previewing / testing procedural meshes.
 * Open via ?view=assets or #assets (also linked from the lobby).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ASSET_CATALOG,
  ASSET_CATEGORIES,
  getAssetById,
  type AssetDefinition,
} from '../world/assets';
import { STYLE, STYLIZED_PLAYER } from '../style/style';

export function isAssetLabRoute(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'assets') return true;
  const hash = window.location.hash.replace(/^#/, '');
  return hash === 'assets' || hash === '/assets';
}

export function assetLabHref(): string {
  return `${window.location.pathname}?view=assets`;
}

export function gameHref(): string {
  return window.location.pathname || '/';
}

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

export function startAssetLab(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
  const root = document.querySelector<HTMLElement>('#asset-lab')!;
  const lobby = document.querySelector<HTMLElement>('#lobby');
  const hud = document.querySelector<HTMLElement>('#hud');
  const styleRoot = document.querySelector<HTMLElement>('#style-config-root');
  lobby?.classList.add('hidden');
  if (hud) hud.innerHTML = '';
  if (styleRoot) styleRoot.innerHTML = '';
  document.body.classList.add('asset-lab-mode');
  root.classList.remove('hidden');

  let selectedId = ASSET_CATALOG[0]?.id ?? 'settlement';
  let playerIndex = 0;
  let autoRotate = true;
  let wireframe = false;
  let showBounds = false;
  let scaleMul = 1;
  let currentAsset: THREE.Object3D | null = null;
  let boundsHelper: THREE.BoxHelper | null = null;

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
  scene.fog = new THREE.Fog(0xb8d8e8, 18, 42);

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 200);
  camera.position.set(2.4, 1.8, 3.2);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.35, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.6;
  controls.maxDistance = 14;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = 1.1;
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
    new THREE.CircleGeometry(4.5, 48),
    new THREE.MeshToonMaterial({ color: 0xd8c4a0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.001;
  ground.receiveShadow = true;
  stage.add(ground);

  const grid = new THREE.GridHelper(6, 12, 0x8b6a42, 0xc9b090);
  grid.position.y = 0.002;
  const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
  for (const m of gridMats) {
    m.transparent = true;
    m.opacity = 0.45;
  }
  stage.add(grid);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.62, 0.08, 24),
    new THREE.MeshToonMaterial({ color: 0xe8dcc4 }),
  );
  pedestal.position.y = 0.04;
  pedestal.receiveShadow = true;
  stage.add(pedestal);

  const previewRoot = new THREE.Group();
  previewRoot.position.y = 0.08;
  stage.add(previewRoot);

  function applyWireframe(rootObj: THREE.Object3D, enabled: boolean): void {
    rootObj.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m && 'wireframe' in m) (m as THREE.MeshBasicMaterial).wireframe = enabled;
      }
    });
  }

  function frameAsset(obj: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 0.2) * 0.5;
    const dist = Math.max(1.6, radius * 4.2);
    controls.target.set(center.x, Math.max(0.15, center.y), center.z);
    camera.position.set(center.x + dist * 0.7, center.y + dist * 0.55, center.z + dist * 0.85);
    camera.near = Math.max(0.02, radius * 0.01);
    camera.far = Math.max(80, dist * 20);
    camera.updateProjectionMatrix();
    controls.update();
  }

  function mountAsset(def: AssetDefinition): void {
    if (currentAsset) {
      previewRoot.remove(currentAsset);
      disposeObject(currentAsset);
      currentAsset = null;
    }
    if (boundsHelper) {
      stage.remove(boundsHelper);
      boundsHelper.dispose();
      boundsHelper = null;
    }

    const obj = def.create({
      playerIndex,
      scale: def.id === 'tree' ? 1 : undefined,
      number: 8,
    });
    obj.scale.multiplyScalar(scaleMul);
    previewRoot.add(obj);
    currentAsset = obj;
    applyWireframe(obj, wireframe);

    if (showBounds) {
      boundsHelper = new THREE.BoxHelper(obj, 0xe8a838);
      stage.add(boundsHelper);
    }
    frameAsset(obj);
    renderUi();
  }

  function renderUi(): void {
    const def = getAssetById(selectedId);
    root.innerHTML = `
      <aside class="asset-lab-panel" aria-label="Asset catalog">
        <header class="asset-lab-header">
          <div>
            <p class="asset-lab-eyebrow">Dev tools</p>
            <h1>Asset Lab</h1>
          </div>
          <a class="btn secondary asset-lab-back" href="${gameHref()}">← Game</a>
        </header>
        <p class="asset-lab-lede">Preview and orbit procedural pieces, props, and board meshes used by World.</p>
        <div class="asset-lab-list">
          ${ASSET_CATEGORIES.map((cat) => {
            const items = ASSET_CATALOG.filter((a) => a.category === cat.id);
            return `
              <section class="asset-lab-section">
                <h2>${cat.label}</h2>
                <div class="asset-lab-items">
                  ${items
                    .map(
                      (a) => `
                    <button type="button" class="asset-lab-item${a.id === selectedId ? ' active' : ''}" data-asset="${a.id}">
                      <span class="asset-lab-item-name">${a.name}</span>
                      <span class="asset-lab-item-id">${a.id}</span>
                    </button>`,
                    )
                    .join('')}
                </div>
              </section>`;
          }).join('')}
        </div>
      </aside>
      <div class="asset-lab-toolbar" aria-label="Preview controls">
        <div class="asset-lab-meta">
          <strong>${def?.name ?? '—'}</strong>
          <span>${def?.description ?? ''}</span>
        </div>
        <div class="asset-lab-controls">
          ${
            def?.playerTint
              ? `<label class="asset-lab-field">Player
                  <select data-ctrl="player">
                    ${STYLIZED_PLAYER.map(
                      (c, i) =>
                        `<option value="${i}"${i === playerIndex ? ' selected' : ''}>P${i + 1} (#${c.toString(16).padStart(6, '0')})</option>`,
                    ).join('')}
                  </select>
                </label>`
              : ''
          }
          <label class="asset-lab-field">Scale
            <input data-ctrl="scale" type="range" min="0.4" max="2.5" step="0.05" value="${scaleMul}" />
            <span class="asset-lab-val">${scaleMul.toFixed(2)}×</span>
          </label>
          <label class="asset-lab-check"><input data-ctrl="rotate" type="checkbox"${autoRotate ? ' checked' : ''}/> Auto-rotate</label>
          <label class="asset-lab-check"><input data-ctrl="wire" type="checkbox"${wireframe ? ' checked' : ''}/> Wireframe</label>
          <label class="asset-lab-check"><input data-ctrl="bounds" type="checkbox"${showBounds ? ' checked' : ''}/> Bounds</label>
          <button type="button" class="btn secondary" data-ctrl="reset">Reset camera</button>
        </div>
      </div>
    `;

    root.querySelectorAll<HTMLButtonElement>('[data-asset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedId = btn.dataset.asset!;
        const next = getAssetById(selectedId);
        if (next) mountAsset(next);
      });
    });

    const playerSel = root.querySelector<HTMLSelectElement>('[data-ctrl="player"]');
    playerSel?.addEventListener('change', () => {
      playerIndex = Number(playerSel.value);
      const next = getAssetById(selectedId);
      if (next) mountAsset(next);
    });

    const scaleInput = root.querySelector<HTMLInputElement>('[data-ctrl="scale"]');
    scaleInput?.addEventListener('input', () => {
      scaleMul = Number(scaleInput.value);
      const next = getAssetById(selectedId);
      if (next) mountAsset(next);
    });

    root.querySelector<HTMLInputElement>('[data-ctrl="rotate"]')?.addEventListener('change', (ev) => {
      autoRotate = (ev.target as HTMLInputElement).checked;
      controls.autoRotate = autoRotate;
    });

    root.querySelector<HTMLInputElement>('[data-ctrl="wire"]')?.addEventListener('change', (ev) => {
      wireframe = (ev.target as HTMLInputElement).checked;
      if (currentAsset) applyWireframe(currentAsset, wireframe);
    });

    root.querySelector<HTMLInputElement>('[data-ctrl="bounds"]')?.addEventListener('change', (ev) => {
      showBounds = (ev.target as HTMLInputElement).checked;
      const next = getAssetById(selectedId);
      if (next) mountAsset(next);
    });

    root.querySelector<HTMLButtonElement>('[data-ctrl="reset"]')?.addEventListener('click', () => {
      if (currentAsset) frameAsset(currentAsset);
    });
  }

  const first = getAssetById(selectedId);
  if (first) mountAsset(first);
  else renderUi();

  function onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  const clock = new THREE.Clock();
  function animate(): void {
    requestAnimationFrame(animate);
    clock.getDelta();
    controls.update();
    if (boundsHelper && currentAsset) boundsHelper.update();
    renderer.render(scene, camera);
  }
  animate();
}
