import * as THREE from 'three';
import { getQualityCaps } from './Quality';

/** WebGLRenderer setup (folio Rendering). */
export class Rendering {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;

  constructor(canvas: HTMLCanvasElement) {
    const caps = getQualityCaps();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, caps.pixelRatioMax));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = null;
    this.scene = scene;
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height);
  }

  setExposure(value: number): void {
    this.renderer.toneMappingExposure = value;
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }
}
