import * as THREE from 'three';
import { HEX_SIZE } from '../game/board';
import { STYLIZED_TERRAIN } from './style';

/**
 * Folio-inspired pasture grass (bruno simon folio-2025 Grass.js).
 *
 * Keeps Folio’s soft light meadow recipe — triangular blades, tip-brighter
 * terrain color, tip-only wind, height randomness — on sheep hexes.
 *
 * Pure camera-billboards collapse to dark edges under our tabletop camera,
 * so blades use random yaw + a crossed Folio triangle pair instead.
 */

const BLADE_WIDTH = 0.055;
const BLADE_HEIGHT = 0.2;
const HEIGHT_RANDOMNESS = 0.6;
const SQRT3 = Math.sqrt(3);

const sheepGreen = new THREE.Color(STYLIZED_TERRAIN.sheep);

const grassVertexShader = /* glsl */ `
attribute float aPhase;
attribute float aTint;
attribute vec3 aOffset;
attribute float aYaw;
attribute float aHeightRand;

uniform float uTime;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uBladeWidth;
uniform float uBladeHeight;
uniform float uHeightRandomness;

varying float vTipness;
varying float vTint;

void main() {
  float tipness = step(0.5, position.y);
  vTipness = tipness;
  vTint = aTint;

  float height = uBladeHeight
    * (uHeightRandomness * aHeightRand + (1.0 - uHeightRandomness));
  height *= 0.78 + 0.32 * sin(aOffset.x * 3.05 + aOffset.z * 2.55);

  vec3 shape = vec3(
    position.x * uBladeWidth,
    position.y * height,
    position.z * uBladeWidth
  );

  float s = sin(aYaw);
  float c = cos(aYaw);
  vec3 local = vec3(
    shape.x * c - shape.z * s,
    shape.y,
    shape.x * s + shape.z * c
  );

  float windWave = sin(uTime * uWindSpeed + aPhase + aOffset.x * 1.7 + aOffset.z * 1.3)
                 + 0.45 * sin(uTime * uWindSpeed * 1.6 + aPhase * 1.25 + aOffset.z * 2.1);
  float sway = windWave * uWindStrength * tipness * height * 2.0;
  local.x += sway;
  local.z += sway * 0.55;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(local + aOffset, 1.0);
}
`;

const grassFragmentShader = /* glsl */ `
uniform vec3 uGrassColor;
uniform vec3 uTipColor;

varying float vTipness;
varying float vTint;

void main() {
  vec3 col = mix(uGrassColor, uTipColor, vTipness * 0.75 + vTint * 0.1);
  gl_FragColor = vec4(col, 1.0);
}
`;

function createBladeGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array([
    0, 1, 0, -1, 0, 0, 1, 0, 0,
    0, 1, 0, 0, 0, -1, 0, 0, 1,
  ]);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geom;
}

function pointInHex(x: number, z: number, radius: number): boolean {
  const q = ((SQRT3 / 3) * x - (1 / 3) * z) / radius;
  const r = ((2 / 3) * z) / radius;
  const s = -q - r;
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= 0.84;
}

export interface GrassPatch {
  x: number;
  z: number;
  y: number;
}

export class GrassField {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private geometry: THREE.InstancedBufferGeometry | null = null;
  private blade: THREE.BufferGeometry | null = null;

  build(patches: GrassPatch[], bladesPerHex = 200): void {
    this.dispose();
    if (patches.length === 0) return;

    const maxBlades = patches.length * bladesPerHex;
    const phases = new Float32Array(maxBlades);
    const tints = new Float32Array(maxBlades);
    const offsets = new Float32Array(maxBlades * 3);
    const yaws = new Float32Array(maxBlades);
    const heightRands = new Float32Array(maxBlades);

    let count = 0;
    const radius = HEX_SIZE * 0.8;
    for (const patch of patches) {
      let placed = 0;
      let attempts = 0;
      while (placed < bladesPerHex && attempts < bladesPerHex * 14) {
        attempts++;
        const lx = (Math.random() * 2 - 1) * radius;
        const lz = (Math.random() * 2 - 1) * radius;
        if (!pointInHex(lx, lz, HEX_SIZE)) continue;
        if (lx * lx + lz * lz < 0.15 * 0.15) continue;

        phases[count] = Math.random() * Math.PI * 2;
        tints[count] = Math.random();
        offsets[count * 3] = patch.x + lx;
        offsets[count * 3 + 1] = patch.y;
        offsets[count * 3 + 2] = patch.z + lz;
        yaws[count] = Math.random() * Math.PI * 2;
        heightRands[count] = Math.random();
        count++;
        placed++;
      }
    }

    if (count === 0) return;

    this.blade = createBladeGeometry();
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = this.blade.index;
    this.geometry.setAttribute('position', this.blade.getAttribute('position')!);
    this.geometry.instanceCount = count;
    this.geometry.setAttribute(
      'aPhase',
      new THREE.InstancedBufferAttribute(phases.subarray(0, count), 1),
    );
    this.geometry.setAttribute(
      'aTint',
      new THREE.InstancedBufferAttribute(tints.subarray(0, count), 1),
    );
    this.geometry.setAttribute(
      'aOffset',
      new THREE.InstancedBufferAttribute(offsets.subarray(0, count * 3), 3),
    );
    this.geometry.setAttribute(
      'aYaw',
      new THREE.InstancedBufferAttribute(yaws.subarray(0, count), 1),
    );
    this.geometry.setAttribute(
      'aHeightRand',
      new THREE.InstancedBufferAttribute(heightRands.subarray(0, count), 1),
    );

    // Soft light meadow — match lit pasture, pale tips (Folio tip catch)
    const grass = sheepGreen.clone().multiplyScalar(1.25);
    const tip = grass.clone().lerp(new THREE.Color(0xf2fad0), 0.55);

    this.material = new THREE.ShaderMaterial({
      vertexShader: grassVertexShader,
      fragmentShader: grassFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWindStrength: { value: 0.07 },
        uWindSpeed: { value: 1.55 },
        uBladeWidth: { value: BLADE_WIDTH },
        uBladeHeight: { value: BLADE_HEIGHT },
        uHeightRandomness: { value: HEIGHT_RANDOMNESS },
        uGrassColor: { value: grass },
        uTipColor: { value: tip },
      },
      side: THREE.DoubleSide,
      depthWrite: true,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  update(time: number): void {
    if (this.material) this.material.uniforms.uTime.value = time;
  }

  dispose(): void {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh = null;
    }
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    if (this.blade) {
      this.blade.dispose();
      this.blade = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
  }
}
