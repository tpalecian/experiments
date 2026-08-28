/**
 * Seaweed tufts in the shallows along the organic coast.
 * Foam lives on the water shader (blob lip), not as extra meshes.
 */
import * as THREE from 'three';
import { HEX_SIZE } from '../engine/board';
import { toonMat } from '../style/style';
import { hash21, type IslandField } from './islandField';
import type { AtmosphereSnapshot } from './Atmosphere';

export class ShoreDressing {
  readonly group = new THREE.Group();
  private weed: THREE.InstancedMesh | null = null;
  private readonly weedColor = new THREE.Color(0x4fd64a);

  addTo(parent: THREE.Group): void {
    parent.add(this.group);
  }

  build(field: IslandField): void {
    this.clear();
    this.weed = this.buildWeed(field);
    if (this.weed) this.group.add(this.weed);
  }

  applyTint(atm: AtmosphereSnapshot): void {
    if (this.weed) {
      const mat = this.weed.material;
      if (mat instanceof THREE.MeshToonMaterial) {
        mat.color.copy(this.weedColor).lerp(atm.beachTint, atm.boardTintMix * 0.35);
      }
    }
  }

  clear(): void {
    this.group.clear();
    this.disposeMesh(this.weed);
    this.weed = null;
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
        if (n < 0.78) continue;
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
