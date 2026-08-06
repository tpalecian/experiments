import * as THREE from 'three';
import { HEX_SIZE } from '../game/board';
import { STYLIZED_TERRAIN, STYLIZED_TERRAIN_SIDE } from './style';

/**
 * Folio-inspired pasture grass (bruno simon folio-2025 Grass.js), adapted to WebGL.
 *
 * Folio uses WebGPU + TSL with camera-facing wraparound blades and terrain masks.
 * Here we keep hex-bounded sheep patches (docs/TERRAIN.md) and port the visual core:
 * triangular blade shape, tipness-scaled wind, height randomness, terrain greens.
 *
 * Blades use a fixed random yaw (not full camera billboards) so the tabletop /
 * near-top-down board camera still reads a grassy carpet.
 */

const BLADE_HEIGHT = 0.16;
const BLADE_WIDTH = 0.018;
const HEIGHT_RANDOMNESS = 0.55;
const SQRT3 = Math.sqrt(3);

const sheepTop = new THREE.Color(STYLIZED_TERRAIN.sheep);
const sheepSide = new THREE.Color(STYLIZED_TERRAIN_SIDE.sheep);

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

varying float vTint;
varying float vTipness;
varying float vHeightNorm;

void main() {
  // Unit triangle coords: tip has y=1, base has y=0 — Folio tipness
  float tipness = step(0.5, position.y);
  vTipness = tipness;
  vTint = aTint;

  float height = uBladeHeight
    * (uHeightRandomness * aHeightRand + (1.0 - uHeightRandomness));

  vec3 shape = vec3(
    position.x * uBladeWidth,
    position.y * height,
    position.z * uBladeWidth
  );

  float s = sin(aYaw);
  float c = cos(aYaw);
  vec3 rotated = vec3(
    shape.x * c - shape.z * s,
    shape.y,
    shape.x * s + shape.z * c
  );

  // Wind only on the tip, scaled by blade height (Folio tipness * height)
  float windWave = sin(uTime * uWindSpeed + aPhase + aOffset.x * 1.7 + aOffset.z * 1.3)
                 + 0.45 * sin(uTime * uWindSpeed * 1.65 + aPhase * 1.3 + aOffset.z * 2.1);
  float sway = windWave * uWindStrength * tipness * height * 2.0;
  rotated.x += sway;
  rotated.z += sway * 0.55;

  vHeightNorm = clamp(rotated.y / max(uBladeHeight, 0.001), 0.0, 1.0);

  vec3 worldPos = rotated + aOffset;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
}
`;

const grassFragmentShader = /* glsl */ `
uniform vec3 uRootColor;
uniform vec3 uTipColor;

varying float vTint;
varying float vTipness;
varying float vHeightNorm;

void main() {
  vec3 base = mix(uRootColor, uTipColor, smoothstep(0.0, 1.0, vHeightNorm));
  // Slight tip darkening (Folio tipness shadow mix feel)
  base *= mix(1.0, 0.88, 1.0 - vTipness);
  base *= mix(0.88, 1.12, vTint);
  // Soft posterize keeps the toon board language
  base = floor(base * 5.0 + 0.5) / 5.0;
  gl_FragColor = vec4(base, 1.0);
}
`;

/** Two Folio-style triangles crossed for readable fill from tabletop angles. */
function createBladeGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array([
    // plane A
    0, 1, 0, 1, 0, 0, -1, 0, 0,
    // plane B
    0, 1, 0, 0, 0, 1, 0, 0, -1,
  ]);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geom;
}

function pointInHex(x: number, z: number, radius: number): boolean {
  const q = ((SQRT3 / 3) * x - (1 / 3) * z) / radius;
  const r = ((2 / 3) * z) / radius;
  const s = -q - r;
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= 0.82;
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

  build(patches: GrassPatch[], bladesPerHex = 480): void {
    this.dispose();
    if (patches.length === 0) return;

    const maxBlades = patches.length * bladesPerHex;
    const phases = new Float32Array(maxBlades);
    const tints = new Float32Array(maxBlades);
    const offsets = new Float32Array(maxBlades * 3);
    const yaws = new Float32Array(maxBlades);
    const heightRands = new Float32Array(maxBlades);

    let count = 0;
    const radius = HEX_SIZE * 0.78;
    for (const patch of patches) {
      let placed = 0;
      let attempts = 0;
      while (placed < bladesPerHex && attempts < bladesPerHex * 10) {
        attempts++;
        const lx = (Math.random() * 2 - 1) * radius;
        const lz = (Math.random() * 2 - 1) * radius;
        if (!pointInHex(lx, lz, HEX_SIZE)) continue;
        // Keep number token / center clear
        if (lx * lx + lz * lz < 0.13 * 0.13) continue;

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

    this.material = new THREE.ShaderMaterial({
      vertexShader: grassVertexShader,
      fragmentShader: grassFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWindStrength: { value: 0.085 },
        uWindSpeed: { value: 1.85 },
        uBladeWidth: { value: BLADE_WIDTH },
        uBladeHeight: { value: BLADE_HEIGHT },
        uHeightRandomness: { value: HEIGHT_RANDOMNESS },
        uRootColor: { value: sheepSide.clone() },
        uTipColor: { value: sheepTop.clone().lerp(new THREE.Color(0xb8e878), 0.35) },
      },
      side: THREE.DoubleSide,
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
