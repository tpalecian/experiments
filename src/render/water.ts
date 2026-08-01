import * as THREE from 'three';

const waterVertexShader = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveFreq;

varying vec2 vUv;
varying vec3 vWorldPos;
varying float vWave;

float wave(vec2 p, float t) {
  float w = sin(p.x * uWaveFreq + t * 1.4) * cos(p.y * uWaveFreq * 0.85 - t * 1.1);
  w += 0.55 * sin((p.x + p.y) * uWaveFreq * 1.6 - t * 1.8);
  w += 0.3 * sin(p.y * uWaveFreq * 2.3 + t * 2.2 + p.x * 0.7);
  return w;
}

void main() {
  vUv = uv;
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
uniform vec3 uShallowColor;
uniform vec3 uHighlight;
uniform float uLandRadius;

varying vec2 vUv;
varying vec3 vWorldPos;
varying float vWave;

void main() {
  float dist = length(vWorldPos.xz);
  // Soft ring near shore — slightly lighter water hugging the island
  float shore = smoothstep(uLandRadius - 0.4, uLandRadius + 2.8, dist);
  vec3 col = mix(uShallowColor, uDeepColor, shore);

  // Animated sparkle / foam crests
  float crest = smoothstep(0.35, 0.95, vWave);
  col = mix(col, uHighlight, crest * 0.35);

  // Slow caustic-like shimmer
  float shimmer = sin(vWorldPos.x * 3.2 + uTime * 2.0) * sin(vWorldPos.z * 2.7 - uTime * 1.6);
  col += uHighlight * shimmer * 0.04;

  // Fresnel-ish brightening toward horizon (viewed from above-ish)
  float edge = smoothstep(0.0, 1.0, dist / (uLandRadius + 18.0));
  col = mix(col, mix(uShallowColor, vec3(0.55, 0.75, 0.85), 0.4), edge * 0.25);

  gl_FragColor = vec4(col, 0.92);
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
        uWaveHeight: { value: 0.045 },
        uWaveFreq: { value: 0.55 },
        uDeepColor: { value: new THREE.Color(0x0a3a58) },
        uShallowColor: { value: new THREE.Color(0x1f6f8a) },
        uHighlight: { value: new THREE.Color(0xb8e4f0) },
        uLandRadius: { value: 5 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const geom = new THREE.PlaneGeometry(80, 80, 128, 128);
    geom.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.position.y = -0.08;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  resize(landRadius: number): void {
    const size = Math.max(40, landRadius * 8);
    const segs = size > 60 ? 160 : 128;
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
