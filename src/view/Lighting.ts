import * as THREE from 'three';
import { STYLE } from '../style/style';
import type { StyleConfig } from '../style/styleConfig';
import type { AtmosphereSnapshot } from '../world/Atmosphere';
import { getQualityCaps } from '../core/Quality';

/** Hemisphere + key/fill/rim lights driven by Environment State. */
export class Lighting {
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  readonly fill: THREE.DirectionalLight;
  readonly rim: THREE.DirectionalLight;
  sunAnchor = 10;

  constructor(config: StyleConfig) {
    this.hemi = new THREE.HemisphereLight(STYLE.ambientSky, STYLE.ambientGround, config.hemiIntensity);

    const caps = getQualityCaps();
    this.sun = new THREE.DirectionalLight(STYLE.sun, config.sunIntensity);
    this.sun.position.set(8, 16, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(caps.shadowMap, caps.shadowMap);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 40;
    this.sun.shadow.camera.left = -12;
    this.sun.shadow.camera.right = 12;
    this.sun.shadow.camera.top = 12;
    this.sun.shadow.camera.bottom = -12;
    this.sun.shadow.bias = -0.0008;

    this.fill = new THREE.DirectionalLight(STYLE.fill, 0.35);
    this.fill.position.set(-6, 4, -8);

    this.rim = new THREE.DirectionalLight(0xc8e8f8, 0.12);
    this.rim.position.set(-4, 6, 10);
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.hemi, this.sun, this.fill, this.rim);
  }

  frameShadows(radius: number): void {
    this.sunAnchor = Math.max(8, radius * 1.1);
    const shadowSpan = radius + 4;
    this.sun.shadow.camera.far = shadowSpan * 4;
    this.sun.shadow.camera.left = -shadowSpan;
    this.sun.shadow.camera.right = shadowSpan;
    this.sun.shadow.camera.top = shadowSpan;
    this.sun.shadow.camera.bottom = -shadowSpan;
    this.sun.shadow.camera.updateProjectionMatrix();
  }

  applyAtmosphere(atm: AtmosphereSnapshot, style: StyleConfig): void {
    const sunMul = style.sunIntensity / 1.45;
    const hemiMul = style.hemiIntensity / 0.95;

    this.sun.color.copy(atm.sunColor);
    this.sun.intensity = atm.sunIntensity * sunMul;
    this.hemi.color.copy(atm.hemiSky);
    this.hemi.groundColor.copy(atm.hemiGround);
    this.hemi.intensity = atm.hemiIntensity * hemiMul;

    this.fill.color.copy(atm.fillColor);
    this.fill.intensity = atm.fillIntensity;
    this.rim.color.copy(atm.rimColor);
    this.rim.intensity = atm.rimIntensity;

    this.sun.castShadow = atm.shadowStrength > 0.05;
    this.sun.shadow.radius = atm.shadowStrength < 0.55 ? 3.5 : 1.25;
    this.sun.shadow.bias = -0.0008;
    if (atm.shadowStrength < 1) {
      this.sun.intensity *= 0.65 + 0.35 * atm.shadowStrength;
    }
  }

  setCelestialDirection(dir: THREE.Vector3): void {
    const a = this.sunAnchor;
    this.sun.position.copy(dir).multiplyScalar(a);

    this.fill.position.copy(dir).multiplyScalar(-a * 0.55);
    this.fill.position.y = Math.abs(this.fill.position.y) * 0.4 + 2;

    this.rim.position.copy(dir).multiplyScalar(-a * 0.35);
    this.rim.position.y = Math.abs(this.rim.position.y) * 0.55 + 3;
    this.rim.position.x += a * 0.25;
  }
}
