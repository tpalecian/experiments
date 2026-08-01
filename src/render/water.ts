import * as THREE from 'three';
import { STYLE } from './style';

const waterVertexShader = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveFreq;

varying vec3 vWorldPos;
varying float vWave;

float wave(vec2 p, float t) {
  float w = sin(p.x * uWaveFreq + t * 1.1) * cos(p.y * uWaveFreq * 0.8 - t * 0.9);
  w += 0.5 * sin((p.x * 0.7 + p.y) * uWaveFreq * 1.4 - t * 1.4);
  return w;
}

void main() {
  vec3 pos = position;
  float w = wave(pos.xz, uTime);
  pos.y += w * uWaveHeight;
  vWave = w;
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const waterFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uDeepColor;
uniform vec3 uMidColor;
uniform vec3 uShallowColor;
uniform vec3 uFoamColor;
uniform float uLandRadius;

varying vec3 vWorldPos;
varying float vWave;

void main() {
  float dist = length(vWorldPos.xz);
  float shore = smoothstep(uLandRadius - 0.2, uLandRadius + 3.5, dist);

  // Stylized banded water (Nintendo / toon fantasy)
  vec3 col = mix(uShallowColor, uMidColor, smoothstep(0.15, 0.55, shore));
  col = mix(col, uDeepColor, smoothstep(0.55, 1.0, shore));

  // Posterize into soft bands
  col = floor(col * 5.0 + 0.5) / 5.0;

  // Chunky foam crests
  float crest = step(0.55, vWave);
  col = mix(col, uFoamColor, crest * 0.55);

  // Shore foam ring
  float foamRing = 1.0 - smoothstep(uLandRadius + 0.1, uLandRadius + 1.1, dist);
  foamRing *= smoothstep(uLandRadius - 0.5, uLandRadius + 0.2, dist);
  float foamPulse = 0.65 + 0.35 * sin(uTime * 2.0 + dist * 3.0);
  col = mix(col, uFoamColor, foamRing * foamPulse * 0.7);

  // Slow stylized sparkle tiles
  float sparkle = step(0.92, fract(sin(dot(floor(vWorldPos.xz * 2.5), vec2(12.9898, 78.233)) + uTime) * 43758.5453));
  col = mix(col, uFoamColor, sparkle * 0.35);

  gl_FragColor = vec4(col, 1.0);
}
`;

export class WaterSurface {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWaveHeight: { value: 0.07 },
        uWaveFreq: { value: 0.45 },
        uDeepColor: { value: new THREE.Color(STYLE.waterDeep) },
        uMidColor: { value: new THREE.Color(STYLE.waterMid) },
        uShallowColor: { value: new THREE.Color(STYLE.waterShallow) },
        uFoamColor: { value: new THREE.Color(STYLE.waterFoam) },
        uLandRadius: { value: 5 },
      },
      side: THREE.DoubleSide,
    });

    const geom = new THREE.PlaneGeometry(80, 80, 96, 96);
    geom.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.position.y = -0.1;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  resize(landRadius: number): void {
    const size = Math.max(40, landRadius * 8);
    const segs = size > 60 ? 128 : 96;
    const old = this.mesh.geometry;
    const geom = new THREE.PlaneGeometry(size, size, segs, segs);
    geom.rotateX(-Math.PI / 2);
    this.mesh.geometry = geom;
    old.dispose();
    this.material.uniforms.uLandRadius.value = landRadius;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
