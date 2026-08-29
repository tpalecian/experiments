/**
 * Seaweed tufts plus flat paint-stroke foam dabs along the organic coast.
 * Foam cards sit on the water plane so surf reads even when the shader lip
 * is hidden by the sand cut. They are unlit discs, not 3D rocks.
 */
import * as THREE from 'three';
import { HEX_SIZE } from '../engine/board';
import { toonMat } from '../style/style';
import { hash21, type IslandField } from './islandField';
import type { AtmosphereSnapshot } from './Atmosphere';

const FOAM_WHITE = 0xffffff;
const FOAM_MINT = 0xe8fff4;

export class ShoreDressing {
  readonly group = new THREE.Group();
  private weed: THREE.InstancedMesh | null = null;
  private foamWhite: THREE.InstancedMesh | null = null;
  private foamMint: THREE.InstancedMesh | null = null;
  private readonly weedColor = new THREE.Color(0x4fd64a);
  private readonly foamWhiteColor = new THREE.Color(FOAM_WHITE);
  private readonly foamMintColor = new THREE.Color(FOAM_MINT);

  addTo(parent: THREE.Group): void {
    parent.add(this.group);
  }

  build(field: IslandField): void {
    this.clear();
    this.foamWhite = this.buildFoamLayer(field, {
      minDist: 0.04 * HEX_SIZE,
      maxDist: 0.38 * HEX_SIZE,
      step: 0.18 * HEX_SIZE,
      keepAbove: 0.6,
      minScale: 0.08 * HEX_SIZE,
      maxScale: 0.17 * HEX_SIZE,
      color: FOAM_WHITE,
      y: 0.018,
      stretch: 1.45,
    });
    this.foamMint = this.buildFoamLayer(field, {
      minDist: 0.22 * HEX_SIZE,
      maxDist: 0.95 * HEX_SIZE,
      step: 0.24 * HEX_SIZE,
      keepAbove: 0.55,
      minScale: 0.09 * HEX_SIZE,
      maxScale: 0.2 * HEX_SIZE,
      color: FOAM_MINT,
      y: 0.014,
      stretch: 1.55,
    });
    this.weed = this.buildWeed(field);
    if (this.foamMint) this.group.add(this.foamMint);
    if (this.foamWhite) this.group.add(this.foamWhite);
    if (this.weed) this.group.add(this.weed);
  }

  applyTint(atm: AtmosphereSnapshot): void {
    if (this.weed) {
      const mat = this.weed.material;
      if (mat instanceof THREE.MeshToonMaterial) {
        mat.color.copy(this.weedColor).lerp(atm.beachTint, atm.boardTintMix * 0.35);
      }
    }
    if (this.foamWhite) {
      const mat = this.foamWhite.material;
      if (mat instanceof THREE.MeshBasicMaterial) {
        mat.color.copy(this.foamWhiteColor).lerp(atm.waterFoamColor, atm.waterPaletteMix * 0.15);
      }
    }
    if (this.foamMint) {
      const mat = this.foamMint.material;
      if (mat instanceof THREE.MeshBasicMaterial) {
        mat.color.copy(this.foamMintColor).lerp(atm.waterShallow, atm.waterPaletteMix * 0.2);
      }
    }
  }

  clear(): void {
    this.group.clear();
    this.disposeMesh(this.weed);
    this.disposeMesh(this.foamWhite);
    this.disposeMesh(this.foamMint);
    this.weed = null;
    this.foamWhite = null;
    this.foamMint = null;
  }

  private disposeMesh(mesh: THREE.InstancedMesh | null): void {
    if (!mesh) return;
    mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      for (const m of mat) m.dispose();
    } else {
      mat.dispose();
    }
  }

  private buildFoamLayer(
    field: IslandField,
    opts: {
      minDist: number;
      maxDist: number;
      step: number;
      keepAbove: number;
      minScale: number;
      maxScale: number;
      color: number;
      y: number;
      stretch: number;
    },
  ): THREE.InstancedMesh | null {
    const dummy = new THREE.Object3D();
    const matrices: THREE.Matrix4[] = [];
    const radius = field.radius;
    const jitter = opts.step * 0.55;

    for (let z = -radius; z <= radius; z += opts.step) {
      for (let x = -radius; x <= radius; x += opts.step) {
        const n = hash21(x * 2.1 + 1.3, z * 1.8 - 4.7);
        if (n < opts.keepAbove) continue;
        const n2 = hash21(x * 0.7 - 3.2, z * 1.1 + 8.4);
        const px = x + (n - 0.5) * jitter;
        const pz = z + (n2 - 0.5) * jitter;
        const d = field.shoreDistance(px, pz);
        if (d < opts.minDist || d > opts.maxDist) continue;
        dummy.position.set(px, opts.y, pz);
        const s = opts.minScale + (opts.maxScale - opts.minScale) * n;
        dummy.scale.set(s * opts.stretch, 0.01, s * (0.42 + n2 * 0.22));
        dummy.rotation.set(0, n * 6.2, 0);
        dummy.updateMatrix();
        matrices.push(dummy.matrix.clone());
      }
    }

    if (matrices.length === 0) return null;
    const geom = new THREE.CircleGeometry(1, 8);
    geom.rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(
      geom,
      new THREE.MeshBasicMaterial({
        color: opts.color,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
      matrices.length,
    );
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]!);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    return mesh;
  }

  private buildWeed(field: IslandField): THREE.InstancedMesh | null {
    const step = 0.55 * HEX_SIZE;
    const dummy = new THREE.Object3D();
    const matrices: THREE.Matrix4[] = [];
    const radius = field.radius;

    for (let z = -radius; z <= radius; z += step) {
      for (let x = -radius; x <= radius; x += step) {
        const d = field.shoreDistance(x, z);
        if (d < 0.08 * HEX_SIZE || d > 0.48 * HEX_SIZE) continue;
        const n = hash21(x * 1.7 + 4.2, z * 1.9 - 2.1);
        if (n < 0.9) continue;
        dummy.position.set(x, 0.02, z);
        const s = (0.08 + n * 0.06) * HEX_SIZE;
        dummy.scale.set(s * 0.35, s * 1.8, s * 0.35);
        dummy.rotation.set(0.15, n * 6.2, 0.1);
        dummy.updateMatrix();
        matrices.push(dummy.matrix.clone());
      }
    }

    if (matrices.length === 0) return null;
    const mesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 5),
      toonMat(0x4fd64a),
      matrices.length,
    );
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]!);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }
}
