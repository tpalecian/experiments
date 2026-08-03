/**
 * Organic island terrain mesh from coastline SDF height field.
 */

import * as THREE from 'three';
import type { BeachParams } from '../terrain/beach';
import { beachWeights } from '../terrain/beach';
import { biomeIndexToKind } from '../terrain/biome';
import type { WorldData } from '../world/types';
import { worldXZ } from '../world/types';
import type { AtmosphereSnapshot } from '../render/atmosphere';
import type { StyleConfig } from '../render/styleConfig';

const BIOME_COLORS: Record<string, THREE.Color> = {
  forest: new THREE.Color(0x3f8f4a),
  wheat: new THREE.Color(0xe8c84a),
  ore: new THREE.Color(0x8a92a6),
  brick: new THREE.Color(0xd4784a),
  pasture: new THREE.Color(0x7bc95a),
  desert: new THREE.Color(0xe8c988),
};

const WET_SAND = new THREE.Color(0xc9a86c);
const DRY_SAND = new THREE.Color(0xe8d4a8);

export class IslandTerrainView {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh | null = null;
  private sdfOverlay: THREE.Mesh | null = null;
  private scatterGroup = new THREE.Group();
  private beachTint = new THREE.Color(0xf5e6c8);
  private configBeach: BeachParams = { wetEnd: 0.55, dryEnd: 1.35 };

  constructor() {
    this.group.add(this.scatterGroup);
  }

  build(world: WorldData, showSdfOverlay = false): void {
    this.disposeMesh();
    this.scatterGroup.clear();
    this.configBeach = world.params.beach;

    const { grid, heightField, sdfField, biomeField } = world;
    const { width, depth } = grid;
    const positions = new Float32Array(width * depth * 3);
    const colors = new Float32Array(width * depth * 3);
    const uvs = new Float32Array(width * depth * 2);
    const tmp = new THREE.Color();

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

        const d = sdfField[i]!;
        const bw = beachWeights(d, this.configBeach);
        const biome = biomeIndexToKind(biomeField[i]!);
        const land = BIOME_COLORS[biome] ?? BIOME_COLORS.desert!;
        tmp.copy(land);
        if (d < 0) {
          tmp.set(0x1a6a7a);
        } else {
          tmp.lerp(WET_SAND, bw.wet);
          tmp.lerp(DRY_SAND, bw.dry);
          // Keep grass/biome where beach weights say grass
          if (bw.grass > 0.5) tmp.copy(land);
          else if (bw.grass > 0) tmp.lerp(land, bw.grass);
        }
        tmp.multiply(this.beachTint);
        colors[pi] = tmp.r;
        colors[pi + 1] = tmp.g;
        colors[pi + 2] = tmp.b;
      }
    }

    const indices: number[] = [];
    for (let iz = 0; iz < depth - 1; iz++) {
      for (let ix = 0; ix < width - 1; ix++) {
        const a = iz * width + ix;
        const b = a + 1;
        const c = a + width;
        const d = c + 1;
        // Skip fully underwater quads (water shader covers sea)
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

    if (showSdfOverlay) {
      this.buildSdfOverlay(world);
    }
  }

  private buildSdfOverlay(world: WorldData): void {
    if (this.sdfOverlay) {
      this.group.remove(this.sdfOverlay);
      this.sdfOverlay.geometry.dispose();
      const oldMat = this.sdfOverlay.material as THREE.MeshBasicMaterial;
      oldMat.map?.dispose();
      oldMat.dispose();
      this.sdfOverlay = null;
    }
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

  applyAtmosphere(atm: AtmosphereSnapshot): void {
    // Soft beach tint from sky warmth
    this.beachTint.setRGB(
      0.85 + atm.exposure * 0.08,
      0.82 + atm.hemiIntensity * 0.05,
      0.75 + atm.starsIntensity * 0.05,
    );
    if (this.mesh) {
      const mat = this.mesh.material as THREE.MeshToonMaterial;
      mat.emissive.copy(atm.fogColor).multiplyScalar(0.02);
    }
  }

  applyStyleConfig(_config: StyleConfig): void {
    // Generation knobs rebuild via BoardView; look tints live above.
  }

  sampleHeight(world: WorldData, x: number, z: number): number {
    const { grid, heightField } = world;
    const u = (x - grid.bounds.minX) / Math.max(grid.bounds.maxX - grid.bounds.minX, 1e-6);
    const v = (z - grid.bounds.minZ) / Math.max(grid.bounds.maxZ - grid.bounds.minZ, 1e-6);
    const fx = Math.max(0, Math.min(grid.width - 1, u * (grid.width - 1)));
    const fz = Math.max(0, Math.min(grid.depth - 1, v * (grid.depth - 1)));
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const x1 = Math.min(grid.width - 1, x0 + 1);
    const z1 = Math.min(grid.depth - 1, z0 + 1);
    const tx = fx - x0;
    const tz = fz - z0;
    const a = heightField[z0 * grid.width + x0]!;
    const b = heightField[z0 * grid.width + x1]!;
    const c = heightField[z1 * grid.width + x0]!;
    const d = heightField[z1 * grid.width + x1]!;
    return a * (1 - tx) * (1 - tz) + b * tx * (1 - tz) + c * (1 - tx) * tz + d * tx * tz;
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
  }
}

/** Upload signed SDF as a Red float texture; values remapped for viz / shaders. */
export function createSdfDataTexture(world: WorldData): THREE.DataTexture {
  const { width, depth } = world.grid;
  const data = new Float32Array(width * depth);
  // Store raw signed distance (shaders interpret in world units)
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
