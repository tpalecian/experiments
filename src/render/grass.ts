import * as THREE from 'three';
import { HEX_SIZE } from '../game/board';
import { STYLIZED_TERRAIN } from './style';

/**
 * Exact Folio grass (bruno simon folio-2025 Grass.js) — WebGL port.
 *
 * Faithful to Folio:
 * - one triangle per blade (tip / left / right bladeShape)
 * - camera billboard: atan(dz, dx) − π/2 + rotate around blade xz
 * - tipness wind × height × 2
 * - bladeWidth 0.1, bladeHeight 0.6, heightRandomness 0.6
 * - color = terrain, normal = (0,1,0), shadow = tipness.oneMinus()
 *
 * WebGPU/TSL rewritten as GLSL. Hex-bounded on sheep (no camera-wrap grid /
 * terrain mask — those need Folio’s Terrain/View systems).
 */

const BLADE_WIDTH = 0.1;
const BLADE_HEIGHT = 0.6;
const BLADE_HEIGHT_RANDOMNESS = 0.6;
const SQRT3 = Math.sqrt(3);

const terrainColor = new THREE.Color(STYLIZED_TERRAIN.sheep);

const grassVertexShader = /* glsl */ `
// Unit Folio bladeShape as mesh position: tip (0,1,0), left (1,0,0), right (-1,0,0)
attribute float aHeightRandomness;
attribute vec2 aBladeXZ;

uniform float uTime;
uniform float uBladeWidth;
uniform float uBladeHeight;
uniform float uBladeHeightRandomness;
uniform float uWindStrength;
uniform vec2 uWindDirection;
uniform float uGroundY;

varying float vTipness;
varying float vTerrainGrass;

vec2 rotateUV(vec2 uv, float rotation, vec2 center) {
  // Exact three/tsl rotateUV used by Folio Grass.js
  uv -= center;
  float s = sin(rotation);
  float c = cos(rotation);
  return center + vec2(c * uv.x + s * uv.y, c * uv.y - s * uv.x);
}

void main() {
  // Folio tipness: tip vertex has y=1
  float tipness = step(0.5, position.y);
  vTipness = tipness;
  vTerrainGrass = 1.0;

  vec3 position3 = vec3(aBladeXZ.x, uGroundY, aBladeXZ.y);
  vec2 bladePosition = position3.xz;

  // Folio: heightVariation = perlin.r + 0.5  → ~0.5..1.5
  float n = sin(bladePosition.x * 1.284 + bladePosition.y * 1.187) * 0.5 + 0.5;
  float heightVariation = n + 0.5;

  float height = uBladeHeight
    * (uBladeHeightRandomness * aHeightRandomness + (1.0 - uBladeHeightRandomness))
    * heightVariation
    * vTerrainGrass;

  // Folio shape = bladeShape * (width, height)
  vec3 shape = vec3(
    position.x * uBladeWidth * vTerrainGrass,
    position.y * height,
    0.0
  );

  vec3 vertexPosition = position3 + shape;

  // Folio: atan(z - cam.z, x - cam.x) - PI/2, rotateUV around blade xz
  float angleToCamera = atan(position3.z - cameraPosition.z, position3.x - cameraPosition.x) - 1.5707963267948966;
  vec2 rotated = rotateUV(vertexPosition.xz, angleToCamera, position3.xz);
  vertexPosition.x = rotated.x;
  vertexPosition.z = rotated.y;

  // Folio wind.offset * tipness * height * 2
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
varying float vTerrainGrass;

void main() {
  vec3 baseColor = uGrassColor;
  float ndl = max(dot(vec3(0.0, 1.0, 0.0), normalize(uSunDir)), 0.0);
  vec3 lit = baseColor * (uAmbient + uSunColor * ndl);

  // Folio shadowNode: tipness.oneMinus() * terrainGrass
  float tipnessShadowMix = (1.0 - vTipness) * vTerrainGrass;
  vec3 shadowColor = baseColor * uShadowTint;
  vec3 col = mix(lit, shadowColor, clamp(tipnessShadowMix, 0.0, 1.0) * 0.65);

  gl_FragColor = vec4(col, 1.0);
}
`;

/** Folio single triangle: tip, left, right */
function createFolioBladeGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array([
    // tip
    0, 1, 0,
    // left
    1, 0, 0,
    // right
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
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= 0.78;
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

  build(patches: GrassPatch[], bladesPerHex = 120): void {
    this.dispose();
    if (patches.length === 0) return;

    // Folio setGeometry grid (local per hex)
    const subdiv = Math.max(8, Math.round(Math.sqrt(bladesPerHex)));
    const maxBlades = patches.length * subdiv * subdiv;
    const heightRandomness = new Float32Array(maxBlades);
    const bladeXZ = new Float32Array(maxBlades * 2);

    let count = 0;
    const extent = HEX_SIZE * 1.5;
    const fragmentSize = extent / subdiv;
    let groundY = patches[0].y;

    for (const patch of patches) {
      groundY = patch.y;
      for (let iX = 0; iX < subdiv; iX++) {
        const fragmentX = (iX / subdiv - 0.5) * extent + fragmentSize * 0.5;
        for (let iZ = 0; iZ < subdiv; iZ++) {
          const fragmentZ = (iZ / subdiv - 0.5) * extent + fragmentSize * 0.5;
          const lx = fragmentX + (Math.random() - 0.5) * fragmentSize;
          const lz = fragmentZ + (Math.random() - 0.5) * fragmentSize;
          if (!pointInHex(lx, lz, HEX_SIZE)) continue;
          if (lx * lx + lz * lz < 0.18 * 0.18) continue;

          bladeXZ[count * 2] = patch.x + lx;
          bladeXZ[count * 2 + 1] = patch.z + lz;
          heightRandomness[count] = Math.random();
          count++;
        }
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

    const windAngle = Math.PI * 0.6;

    this.material = new THREE.ShaderMaterial({
      vertexShader: grassVertexShader,
      fragmentShader: grassFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBladeWidth: { value: BLADE_WIDTH },
        uBladeHeight: { value: BLADE_HEIGHT },
        uBladeHeightRandomness: { value: BLADE_HEIGHT_RANDOMNESS },
        uWindStrength: { value: 0.5 },
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
      // Folio MeshDefaultMaterial defaults to FrontSide
      side: THREE.FrontSide,
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
