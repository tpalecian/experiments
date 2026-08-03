/**
 * Organic island terrain mesh from coastline SDF height field.
 * Beach / biome albedo can recolor live from Environment State — no SDF regen.
 */

import * as THREE from 'three';
import type { EnvironmentState } from '../atmosphere/environment';
import type { BeachParams } from '../terrain/beach';
import { beachWeights } from '../terrain/beach';
import { biomeIndexToKind } from '../terrain/biome';
import type { WorldData } from '../world/types';
import { worldXZ } from '../world/types';
import type { StyleConfig } from '../render/styleConfig';

const BIOME_COLORS: Record<string, THREE.Color> = {
  forest: new THREE.Color(0x3a9a45),
  wheat: new THREE.Color(0xd4c04a),
  ore: new THREE.Color(0x6a7180),
  brick: new THREE.Color(0xb86a48),
  pasture: new THREE.Color(0x5cb84a),
  desert: new THREE.Color(0xe8d9a0),
};

const WET_SAND = new THREE.Color(0xe8d9b8);
const DRY_SAND = new THREE.Color(0xf7f2e4);

export class IslandTerrainView {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh | null = null;
  private sdfOverlay: THREE.Mesh | null = null;
  private scatterGroup = new THREE.Group();
  private beachTint = new THREE.Color(0xf5e6c8);
  private configBeach: BeachParams = { wetEnd: 0.55, dryEnd: 1.35 };
  private world: WorldData | null = null;
  private showSdfOverlay = false;

  constructor() {
    this.group.add(this.scatterGroup);
  }

  build(world: WorldData, showSdfOverlay = false): void {
    this.disposeMesh();
    this.scatterGroup.clear();
    this.world = world;
    this.configBeach = { ...world.params.beach };
    this.showSdfOverlay = showSdfOverlay;

    const { grid, heightField, sdfField } = world;
    const { width, depth } = grid;
    const positions = new Float32Array(width * depth * 3);
    const colors = new Float32Array(width * depth * 3);
    const uvs = new Float32Array(width * depth * 2);

    for (let iz = 0; iz < depth; iz++) {
      for (let ix = 0; ix < width; ix++) {
        const i = iz * width + ix;
        const { x, z } = worldXZ(grid, ix, iz);
        const y = heightField[i]!;
        const pi = i * 3;
        positions[pi] = x;
        positions[pi + 1] = Math.max(y, -0.02);
        positions[pi + 2] = z;
        uvs[i * 2] = ix / Math.max(width - 1, 1);
        uvs[i * 2 + 1] = iz / Math.max(depth - 1, 1);
        colors[pi] = 0.5;
        colors[pi + 1] = 0.6;
        colors[pi + 2] = 0.4;
      }
    }

    const indices: number[] = [];
    for (let iz = 0; iz < depth - 1; iz++) {
      for (let ix = 0; ix < width - 1; ix++) {
        const a = iz * width + ix;
        const b = a + 1;
        const c = a + width;
        const d = c + 1;
        const d00 = sdfField[a]!;
        const d10 = sdfField[b]!;
        const d01 = sdfField[c]!;
        const d11 = sdfField[d]!;
        if (d00 < -0.15 && d10 < -0.15 && d01 < -0.15 && d11 < -0.15) continue;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const mat = new THREE.MeshToonMaterial({
      vertexColors: true,
    });
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.mesh.userData = { kind: 'islandTerrain' };
    this.group.add(this.mesh);

    this.recolorTerrain();
    this.syncSdfOverlay();
  }

  /** Toggle SDF debug plane without regenerating world data. */
  setSdfOverlayVisible(visible: boolean): void {
    this.showSdfOverlay = visible;
    this.syncSdfOverlay();
  }

  private syncSdfOverlay(): void {
    if (!this.showSdfOverlay || !this.world) {
      if (this.sdfOverlay) {
        this.group.remove(this.sdfOverlay);
        this.sdfOverlay.geometry.dispose();
        const mat = this.sdfOverlay.material as THREE.MeshBasicMaterial;
        mat.map?.dispose();
        mat.dispose();
        this.sdfOverlay = null;
      }
      return;
    }
    if (this.sdfOverlay) return;
    this.buildSdfOverlay(this.world);
  }

  private buildSdfOverlay(world: WorldData): void {
    const tex = createSdfDebugTexture(world);
    const { bounds } = world.grid;
    const w = bounds.maxX - bounds.minX;
    const d = bounds.maxZ - bounds.minZ;
    const geom = new THREE.PlaneGeometry(w, d, 1, 1);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.sdfOverlay = new THREE.Mesh(geom, mat);
    this.sdfOverlay.position.y = 2.2;
    this.group.add(this.sdfOverlay);
  }

  setScatter(trees: THREE.Object3D, rocks: THREE.Object3D): void {
    this.scatterGroup.clear();
    this.scatterGroup.add(trees);
    this.scatterGroup.add(rocks);
  }

  /** Live Environment State — beach tint / emissive only; never rebuilds meshes. */
  applyEnvironment(env: EnvironmentState): void {
    const tintChanged = !this.beachTint.equals(env.beachTint);
    this.beachTint.copy(env.beachTint);
    if (tintChanged) this.recolorTerrain();
    if (this.mesh) {
      const mat = this.mesh.material as THREE.MeshToonMaterial;
      mat.emissive.copy(env.fogColor).multiplyScalar(0.02 * env.shadowStrength);
    }
  }

  applyStyleConfig(config: StyleConfig): void {
    const next: BeachParams = {
      wetEnd: config.beachWetEnd,
      dryEnd: config.beachDryEnd,
    };
    const changed =
      next.wetEnd !== this.configBeach.wetEnd || next.dryEnd !== this.configBeach.dryEnd;
    this.configBeach = next;
    if (changed) this.recolorTerrain();
    this.setSdfOverlayVisible(config.showSdfOverlay);
  }

  /**
   * Recompute vertex colours from static SDF + biome fields and live beach look.
   * Does not touch height / topology.
   */
  recolorTerrain(): void {
    if (!this.mesh || !this.world) return;
    const { grid, sdfField, biomeField } = this.world;
    const { width, depth } = grid;
    const attr = this.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    const colors = attr.array as Float32Array;
    const tmp = new THREE.Color();

    for (let iz = 0; iz < depth; iz++) {
      for (let ix = 0; ix < width; ix++) {
        const i = iz * width + ix;
        const pi = i * 3;
        const d = sdfField[i]!;
        const bw = beachWeights(d, this.configBeach);
        const biome = biomeIndexToKind(biomeField[i]!);
        const land = BIOME_COLORS[biome] ?? BIOME_COLORS.desert!;
        tmp.copy(land);
        if (d < 0) {
          // Shallow sandbar shelf reads lighter than deep ocean under-mesh
          if (d > -0.55) tmp.set(0x7ec8b8);
          else tmp.set(0x1a6a7a);
        } else {
          tmp.lerp(WET_SAND, bw.wet);
          tmp.lerp(DRY_SAND, bw.dry);
          if (bw.grass > 0.5) tmp.copy(land);
          else if (bw.grass > 0) tmp.lerp(land, bw.grass);
        }
        tmp.multiply(this.beachTint);
        colors[pi] = tmp.r;
        colors[pi + 1] = tmp.g;
        colors[pi + 2] = tmp.b;
      }
    }
    attr.needsUpdate = true;
  }

  private disposeMesh(): void {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
    if (this.sdfOverlay) {
      this.group.remove(this.sdfOverlay);
      this.sdfOverlay.geometry.dispose();
      const mat = this.sdfOverlay.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
      this.sdfOverlay = null;
    }
  }

  dispose(): void {
    this.disposeMesh();
    this.scatterGroup.clear();
    this.world = null;
  }
}

/** Upload signed SDF as a Red float texture. */
export function createSdfDataTexture(world: WorldData): THREE.DataTexture {
  const { width, depth } = world.grid;
  const data = new Float32Array(width * depth);
  for (let i = 0; i < data.length; i++) {
    data[i] = world.sdfField[i]!;
  }
  const tex = new THREE.DataTexture(data, width, depth, THREE.RedFormat, THREE.FloatType);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Debug false-color SDF texture (land green, ocean blue). */
export function createSdfDebugTexture(world: WorldData): THREE.DataTexture {
  const { width, depth } = world.grid;
  const data = new Uint8Array(width * depth * 4);
  for (let i = 0; i < width * depth; i++) {
    const d = world.sdfField[i]!;
    const o = i * 4;
    if (d >= 0) {
      const t = Math.min(1, d / 6);
      data[o] = Math.floor(40 + 80 * (1 - t));
      data[o + 1] = Math.floor(140 + 100 * t);
      data[o + 2] = Math.floor(60);
    } else {
      const t = Math.min(1, -d / 12);
      data[o] = Math.floor(20 + 30 * (1 - t));
      data[o + 1] = Math.floor(90 + 80 * (1 - t));
      data[o + 2] = Math.floor(160 + 60 * t);
    }
    data[o + 3] = 200;
  }
  const tex = new THREE.DataTexture(data, width, depth, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}
