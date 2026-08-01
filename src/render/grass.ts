import * as THREE from 'three';
import { HEX_SIZE } from '../game/board';

const BLADE_HEIGHT = 0.16;
const BLADE_WIDTH = 0.028;
const SQRT3 = Math.sqrt(3);

const grassVertexShader = /* glsl */ `
attribute float aPhase;
attribute float aTint;
attribute vec3 aOffset;
attribute float aYaw;
attribute float aScale;

uniform float uTime;
uniform float uWindStrength;
uniform float uWindSpeed;

varying float vTint;
varying float vHeight;

void main() {
  vTint = aTint;
  vHeight = clamp(position.y / ${BLADE_HEIGHT.toFixed(3)}, 0.0, 1.0);

  float s = sin(aYaw);
  float c = cos(aYaw);
  vec3 local = position * aScale;
  vec3 rotated = vec3(
    local.x * c - local.z * s,
    local.y,
    local.x * s + local.z * c
  );

  float tip = vHeight * vHeight;
  float wind = sin(uTime * uWindSpeed + aPhase + aOffset.x * 1.7 + aOffset.z * 1.3)
             + 0.45 * sin(uTime * uWindSpeed * 1.7 + aPhase * 1.3 + aOffset.z * 2.1);
  float sway = wind * uWindStrength * tip * aScale;

  rotated.x += sway;
  rotated.z += sway * 0.55;

  vec3 worldPos = rotated + aOffset;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
}
`;

const grassFragmentShader = /* glsl */ `
varying float vTint;
varying float vHeight;

void main() {
  vec3 root = vec3(0.22, 0.52, 0.18);
  vec3 mid = vec3(0.45, 0.78, 0.28);
  vec3 tip = vec3(0.7, 0.92, 0.4);
  vec3 base = mix(root, mid, smoothstep(0.0, 0.55, vHeight));
  base = mix(base, tip, smoothstep(0.45, 1.0, vHeight));
  base *= mix(0.85, 1.15, vTint);
  // Soft posterize for stylized look
  base = floor(base * 5.0 + 0.5) / 5.0;
  gl_FragColor = vec4(base, 1.0);
}
`;

function createBladeGeometry(): THREE.BufferGeometry {
  const hw = BLADE_WIDTH * 0.5;
  const h = BLADE_HEIGHT;
  const positions = new Float32Array([
    -hw, 0, 0, hw, 0, 0, 0, h, 0,
    -hw, 0, 0, 0, h, 0, hw, 0, 0,
    0, 0, -hw, 0, 0, hw, 0, h, 0,
    0, 0, -hw, 0, h, 0, 0, 0, hw,
  ]);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geom;
}

function pointInHex(x: number, z: number, radius: number): boolean {
  const q = ((SQRT3 / 3) * x - (1 / 3) * z) / radius;
  const r = ((2 / 3) * z) / radius;
  const s = -q - r;
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= 0.92;
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
    const scales = new Float32Array(maxBlades);

    let count = 0;
    const radius = HEX_SIZE * 0.88;
    for (const patch of patches) {
      let placed = 0;
      let attempts = 0;
      while (placed < bladesPerHex && attempts < bladesPerHex * 10) {
        attempts++;
        const lx = (Math.random() * 2 - 1) * radius;
        const lz = (Math.random() * 2 - 1) * radius;
        if (!pointInHex(lx, lz, HEX_SIZE)) continue;
        if (lx * lx + lz * lz < 0.13 * 0.13) continue;

        phases[count] = Math.random() * Math.PI * 2;
        tints[count] = Math.random();
        offsets[count * 3] = patch.x + lx;
        offsets[count * 3 + 1] = patch.y;
        offsets[count * 3 + 2] = patch.z + lz;
        yaws[count] = Math.random() * Math.PI * 2;
        scales[count] = 0.65 + Math.random() * 0.55;
        count++;
        placed++;
      }
    }

    if (count === 0) return;

    this.blade = createBladeGeometry();
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = this.blade.index;
    this.geometry.setAttribute('position', this.blade.getAttribute('position'));
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
      'aScale',
      new THREE.InstancedBufferAttribute(scales.subarray(0, count), 1),
    );

    this.material = new THREE.ShaderMaterial({
      vertexShader: grassVertexShader,
      fragmentShader: grassFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWindStrength: { value: 0.06 },
        uWindSpeed: { value: 1.9 },
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
