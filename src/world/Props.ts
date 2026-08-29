import * as THREE from 'three';
import type { Terrain } from '../engine/types';
import { TILE_HEIGHT } from './assets';
import { loadBiomeLayouts, pickLayout, stampLayout, type BiomeLayoutLibrary } from './biomeLayouts';
import type { AtmosphereSnapshot } from './Atmosphere';

/** Authored biome decoration stamp per hex. */
export class Props {
  readonly group = new THREE.Group();
  private library: BiomeLayoutLibrary = loadBiomeLayouts();
  private heightHint: ((x: number, z: number) => number) | null = null;

  addTo(parent: THREE.Group): void {
    parent.add(this.group);
  }

  reload(): void {
    this.library = loadBiomeLayouts();
  }

  stamp(terrain: Terrain, x: number, z: number, id: string, groundY?: number): void {
    const layout = pickLayout(this.library, terrain, id);
    stampLayout(layout, this.group, x, groundY ?? TILE_HEIGHT, z, (wx, wz) =>
      this.heightHint ? this.heightHint(wx, wz) : groundY ?? TILE_HEIGHT,
    );
  }

  setHeightHint(fn: ((x: number, z: number) => number) | null): void {
    this.heightHint = fn;
  }

  applyTint(atm: AtmosphereSnapshot): void {
    const mix = atm.boardTintMix;
    const tint = atm.beachTint;
    for (const child of this.group.children) {
      child.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const mat = obj.material;
        if (!(mat instanceof THREE.MeshToonMaterial) && !(mat instanceof THREE.MeshBasicMaterial) && !(mat instanceof THREE.MeshLambertMaterial)) return;
        const stored = obj.userData.baseColor as THREE.Color | undefined;
        const base = stored ?? mat.color.clone();
        obj.userData.baseColor = base;
        mat.color.copy(base).lerp(tint, mix * 0.65);
      });
    }
  }

  reset(): void {
    this.group.clear();
    this.heightHint = null;
  }
}
