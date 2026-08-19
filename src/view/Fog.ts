import * as THREE from 'three';
import { STYLE } from '../style/style';
import type { AtmosphereSnapshot } from '../world/Atmosphere';

export class Fog {
  near = 28;
  far = 70;

  create(): THREE.Fog {
    return new THREE.Fog(STYLE.fog, this.near, this.far);
  }

  setRange(near: number, far: number): void {
    this.near = near;
    this.far = far;
  }

  apply(scene: THREE.Scene, atm: AtmosphereSnapshot): void {
    if (!(scene.fog instanceof THREE.Fog)) {
      scene.fog = new THREE.Fog(atm.fogColor, this.near * atm.fogNearMul, this.far * atm.fogFarMul);
      return;
    }
    scene.fog.color.copy(atm.fogColor);
    scene.fog.near = this.near * atm.fogNearMul;
    scene.fog.far = this.far * atm.fogFarMul;
  }
}
