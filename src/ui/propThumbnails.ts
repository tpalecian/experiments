/**
 * Offscreen Three.js renders → data-URL thumbnails for the Biome Editor.
 */
import * as THREE from 'three';
import { getAssetById, makeHexTile } from '../render/assets';
import { STYLE } from '../render/style';
import type { Terrain } from '../game/types';
import type { BiomePropKind } from '../render/biomeLayouts';
import { BIOME_PROP_KINDS, TERRAIN_ORDER } from '../render/biomeLayouts';

const SIZE = 128;
const cache = new Map<string, string>();

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

function makeRenderer(size: number, alpha: boolean): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(size, size);
  renderer.setPixelRatio(1);
  renderer.setClearColor(alpha ? 0x000000 : 0xcfe4f0, alpha ? 0 : 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  return renderer;
}

function lightScene(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(STYLE.ambientSky, STYLE.ambientGround, 1.05));
  const sun = new THREE.DirectionalLight(STYLE.sun, 1.25);
  sun.position.set(2.2, 3.5, 1.8);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(STYLE.fill, 0.4);
  fill.position.set(-2, 1.5, -2);
  scene.add(fill);
}

/** Render one prop asset to a transparent PNG data URL. */
export function renderPropThumbnail(kind: BiomePropKind, size = SIZE): string {
  const key = `prop:${kind}:${size}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const def = getAssetById(kind);
  if (!def) return '';

  const renderer = makeRenderer(size, true);
  const scene = new THREE.Scene();
  lightScene(scene);

  const obj = def.create({ scale: 1, variant: 0 });
  scene.add(obj);

  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const extent = box.getSize(new THREE.Vector3());
  const radius = Math.max(extent.x, extent.y, extent.z, 0.08) * 0.5;
  obj.position.sub(center);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
  const dist = Math.max(0.55, radius * 3.4);
  camera.position.set(dist * 0.85, dist * 0.55, dist * 0.95);
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  disposeObject(obj);
  renderer.dispose();
  cache.set(key, url);
  return url;
}

/** Render a hex tile preview for a terrain type. */
export function renderBiomeThumbnail(terrain: Terrain, size = SIZE): string {
  const key = `biome:${terrain}:${size}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const renderer = makeRenderer(size, false);
  const scene = new THREE.Scene();
  lightScene(scene);

  const hex = makeHexTile({ terrain });
  scene.add(hex);

  const box = new THREE.Box3().setFromObject(hex);
  const center = box.getCenter(new THREE.Vector3());
  const extent = box.getSize(new THREE.Vector3());
  const radius = Math.max(extent.x, extent.y, extent.z, 0.2) * 0.5;
  hex.position.sub(center);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
  const dist = Math.max(1.4, radius * 2.8);
  camera.position.set(dist * 0.7, dist * 0.85, dist * 0.75);
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  disposeObject(hex);
  renderer.dispose();
  cache.set(key, url);
  return url;
}

export function warmPropThumbnails(): Map<BiomePropKind, string> {
  const map = new Map<BiomePropKind, string>();
  for (const kind of BIOME_PROP_KINDS) {
    map.set(kind, renderPropThumbnail(kind));
  }
  return map;
}

export function warmBiomeThumbnails(): Map<Terrain, string> {
  const map = new Map<Terrain, string>();
  /** Static art overrides (served from /public). */
  const overrides: Partial<Record<Terrain, string>> = {
    wood: '/biome-icons/forest.png',
    brick: '/biome-icons/hills.png',
  };
  for (const t of TERRAIN_ORDER) {
    map.set(t, overrides[t] ?? renderBiomeThumbnail(t));
  }
  return map;
}
