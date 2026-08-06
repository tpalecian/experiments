import * as THREE from 'three';
import { HEX_SIZE } from '../game/board';
import { STYLIZED_TERRAIN } from './style';

/**
 * Folio grass (bruno simon folio-2025 Grass.js) — WebGL port for pasture hexes.
 *
 * Same Folio blade recipe (single billboarded triangle, tipness wind, Y-up light)
 * scaled down for hex size, with random tuft / patch patterns instead of a
 * uniform carpet.
 */

// Diorama scale on hex size 1 — fine short grass, not waist-high tufts
const BLADE_WIDTH = 0.012;
const BLADE_HEIGHT = 0.045;
const BLADE_HEIGHT_RANDOMNESS = 0.55;
const SQRT3 = Math.sqrt(3);

const terrainColor = new THREE.Color(STYLIZED_TERRAIN.sheep);

const grassVertexShader = /* glsl */ `
attribute float aHeightRandomness;
attribute float aCover;
attribute vec2 aBladeXZ;

uniform float uTime;
uniform float uBladeWidth;
uniform float uBladeHeight;
uniform float uBladeHeightRandomness;
uniform float uWindStrength;
uniform vec2 uWindDirection;
uniform float uGroundY;

varying float vTipness;
varying float vCover;

vec2 rotateUV(vec2 uv, float rotation, vec2 center) {
  uv -= center;
  float s = sin(rotation);
  float c = cos(rotation);
  return center + vec2(c * uv.x + s * uv.y, c * uv.y - s * uv.x);
}

void main() {
  float tipness = step(0.5, position.y);
  vTipness = tipness;
  // Folio terrainDataGrass stand-in — patch cover fades blade size
  float terrainDataGrass = aCover;
  vCover = terrainDataGrass;

  vec3 position3 = vec3(aBladeXZ.x, uGroundY, aBladeXZ.y);
  vec2 bladePosition = position3.xz;

  float n = sin(bladePosition.x * 1.284 + bladePosition.y * 1.187) * 0.5 + 0.5;
  float heightVariation = n + 0.5;

  float height = uBladeHeight
    * (uBladeHeightRandomness * aHeightRandomness + (1.0 - uBladeHeightRandomness))
    * heightVariation
    * terrainDataGrass;

  vec3 shape = vec3(
    position.x * uBladeWidth * terrainDataGrass,
    position.y * height,
    0.0
  );

  vec3 vertexPosition = position3 + shape;

  float angleToCamera = atan(position3.z - cameraPosition.z, position3.x - cameraPosition.x) - 1.5707963267948966;
  vec2 rotated = rotateUV(vertexPosition.xz, angleToCamera, position3.xz);
  vertexPosition.x = rotated.x;
  vertexPosition.z = rotated.y;

  float t = uTime * 0.1;
  vec2 remapped = bladePosition * 0.5;
  float noise1 = sin(dot(remapped, vec2(1.7, 2.1)) + dot(uWindDirection, vec2(t * 8.0))) * 0.5;
  float noise2 = sin(dot(remapped, vec2(0.9, 1.3)) + dot(uWindDirection, vec2(t * 1.6))) * 0.5;
  vec2 wind = uWindDirection * (noise1 + noise2) * uWindStrength * tipness * height * 2.0;
  vertexPosition.x += wind.x;
  vertexPosition.z += wind.y;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(vertexPosition, 1.0);
}
`;

const grassFragmentShader = /* glsl */ `
uniform vec3 uGrassColor;
uniform vec3 uAmbient;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform vec3 uShadowTint;

varying float vTipness;
varying float vCover;

void main() {
  vec3 baseColor = uGrassColor;
  float ndl = max(dot(vec3(0.0, 1.0, 0.0), normalize(uSunDir)), 0.0);
  vec3 lit = baseColor * (uAmbient + uSunColor * ndl);

  float tipnessShadowMix = (1.0 - vTipness) * vCover;
  vec3 shadowColor = baseColor * uShadowTint;
  vec3 col = mix(lit, shadowColor, clamp(tipnessShadowMix, 0.0, 1.0) * 0.55);

  gl_FragColor = vec4(col, 1.0);
}
`;

function createFolioBladeGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array([
    0, 1, 0,
    1, 0, 0,
    -1, 0, 0,
  ]);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geom;
}

function pointInHex(x: number, z: number, radius: number): boolean {
  const q = ((SQRT3 / 3) * x - (1 / 3) * z) / radius;
  const r = ((2 / 3) * z) / radius;
  const s = -q - r;
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= 0.8;
}

/** Soft value noise in [0,1] for irregular meadow patches. */
function patchNoise(x: number, z: number): number {
  const n1 = Math.sin(x * 4.1 + z * 3.7) * Math.cos(x * 2.3 - z * 5.1);
  const n2 = Math.sin(x * 7.9 - z * 6.2) * 0.5;
  return Math.max(0, Math.min(1, n1 * 0.5 + n2 * 0.35 + 0.45));
}

export interface GrassPatch {
  x: number;
  z: number;
  y: number;
}

interface Tuft {
  lx: number;
  lz: number;
  radius: number;
  strength: number;
}

function makeTufts(count: number, radius: number): Tuft[] {
  const tufts: Tuft[] = [];
  let attempts = 0;
  while (tufts.length < count && attempts < count * 20) {
    attempts++;
    const lx = (Math.random() * 2 - 1) * radius;
    const lz = (Math.random() * 2 - 1) * radius;
    if (!pointInHex(lx, lz, HEX_SIZE)) continue;
    if (lx * lx + lz * lz < 0.2 * 0.2) continue;
    tufts.push({
      lx,
      lz,
      radius: 0.18 + Math.random() * 0.35,
      strength: 0.45 + Math.random() * 0.55,
    });
  }
  return tufts;
}

function tuftCover(lx: number, lz: number, tufts: Tuft[]): number {
  let cover = 0;
  for (const t of tufts) {
    const dx = lx - t.lx;
    const dz = lz - t.lz;
    const d = Math.sqrt(dx * dx + dz * dz);
    const falloff = 1 - d / t.radius;
    if (falloff > 0) cover = Math.max(cover, falloff * t.strength);
  }
  return cover;
}

export class GrassField {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private geometry: THREE.InstancedBufferGeometry | null = null;
  private blade: THREE.BufferGeometry | null = null;

  build(patches: GrassPatch[], bladesPerHex = 180): void {
    this.dispose();
    if (patches.length === 0) return;

    const maxBlades = patches.length * bladesPerHex;
    const heightRandomness = new Float32Array(maxBlades);
    const covers = new Float32Array(maxBlades);
    const bladeXZ = new Float32Array(maxBlades * 2);

    let count = 0;
    const scatterRadius = HEX_SIZE * 0.82;
    let groundY = patches[0].y;

    for (const patch of patches) {
      groundY = patch.y;
      // Broader soft patches — many tiny blades reading as meadow texture
      const tuftCount = 6 + Math.floor(Math.random() * 5);
      const tufts = makeTufts(tuftCount, scatterRadius);

      let placed = 0;
      let attempts = 0;
      while (placed < bladesPerHex && attempts < bladesPerHex * 24) {
        attempts++;
        const lx = (Math.random() * 2 - 1) * scatterRadius;
        const lz = (Math.random() * 2 - 1) * scatterRadius;
        if (!pointInHex(lx, lz, HEX_SIZE)) continue;
        if (lx * lx + lz * lz < 0.16 * 0.16) continue;

        const noise = patchNoise(patch.x + lx, patch.z + lz);
        const tuft = tuftCover(lx, lz, tufts);
        // Soft meadow: tufts + noisy fill so tiny blades form irregular grassy areas
        const cover = Math.max(tuft * 0.9, noise * 0.75);
        if (cover < 0.28) continue;
        if (Math.random() > cover * 0.9) continue;

        bladeXZ[count * 2] = patch.x + lx;
        bladeXZ[count * 2 + 1] = patch.z + lz;
        heightRandomness[count] = Math.random();
        covers[count] = Math.min(1, 0.55 + cover * 0.5);
        count++;
        placed++;
      }
    }

    if (count === 0) return;

    this.blade = createFolioBladeGeometry();
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = this.blade.index;
    this.geometry.setAttribute('position', this.blade.getAttribute('position')!);
    this.geometry.instanceCount = count;
    this.geometry.setAttribute(
      'aBladeXZ',
      new THREE.InstancedBufferAttribute(bladeXZ.subarray(0, count * 2), 2),
    );
    this.geometry.setAttribute(
      'aHeightRandomness',
      new THREE.InstancedBufferAttribute(heightRandomness.subarray(0, count), 1),
    );
    this.geometry.setAttribute(
      'aCover',
      new THREE.InstancedBufferAttribute(covers.subarray(0, count), 1),
    );

    const windAngle = Math.PI * 0.6;

    this.material = new THREE.ShaderMaterial({
      vertexShader: grassVertexShader,
      fragmentShader: grassFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBladeWidth: { value: BLADE_WIDTH },
        uBladeHeight: { value: BLADE_HEIGHT },
        uBladeHeightRandomness: { value: BLADE_HEIGHT_RANDOMNESS },
        uWindStrength: { value: 0.2 },
        uWindDirection: {
          value: new THREE.Vector2(Math.sin(windAngle), Math.cos(windAngle)),
        },
        uGroundY: { value: groundY },
        uGrassColor: { value: terrainColor.clone() },
        uAmbient: { value: new THREE.Color(0xffe6c8).multiplyScalar(0.8) },
        uSunColor: { value: new THREE.Color(0xfff2d6).multiplyScalar(0.95) },
        uSunDir: { value: new THREE.Vector3(0.35, 0.9, 0.25).normalize() },
        uShadowTint: { value: new THREE.Color(0x5c7348) },
      },
      side: THREE.DoubleSide,
      depthWrite: true,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
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
