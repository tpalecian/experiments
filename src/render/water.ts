import * as THREE from 'three';

/**
 * Wind Waker–inspired flat water:
 * solid toon blue + scrolling white cell/foam edges (no vertex waves).
 */
const waterVertexShader = /* glsl */ `
varying vec3 vWorldPos;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const waterFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uWaterColor;
uniform vec3 uDeepColor;
uniform vec3 uFoamColor;
uniform float uLandRadius;
uniform float uPatternScale;
uniform float uScrollSpeed;

varying vec3 vWorldPos;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

/** F2 - F1 Voronoi edges → crisp cell foam lines. */
float voronoiEdge(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float md = 8.0;
  float md2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) {
        md2 = md;
        md = d;
      } else if (d < md2) {
        md2 = d;
      }
    }
  }
  return md2 - md;
}

void main() {
  float dist = length(vWorldPos.xz);

  // Mostly flat mid blue; slightly deeper far from island
  float deep = smoothstep(uLandRadius + 1.0, uLandRadius + 10.0, dist);
  vec3 col = mix(uWaterColor, uDeepColor, deep * 0.55);

  // Two scrolling foam layers (classic WW look)
  vec2 uv = vWorldPos.xz * uPatternScale;
  uv += vec2(uTime * uScrollSpeed * 0.12, -uTime * uScrollSpeed * 0.08);

  float edge = voronoiEdge(uv);
  float foam = 1.0 - smoothstep(0.0, 0.045, edge);
  foam = pow(foam, 1.6);

  vec2 uv2 = vWorldPos.xz * (uPatternScale * 0.55) + 12.0;
  uv2 += vec2(-uTime * uScrollSpeed * 0.07, uTime * uScrollSpeed * 0.05);
  float edge2 = voronoiEdge(uv2);
  float foam2 = 1.0 - smoothstep(0.0, 0.055, edge2);
  foam2 = pow(foam2, 1.8) * 0.55;

  float foamAmt = clamp(foam + foam2, 0.0, 1.0);
  col = mix(col, uFoamColor, foamAmt);

  // Bright shore foam ring
  float ring = 1.0 - smoothstep(uLandRadius + 0.0, uLandRadius + 1.15, dist);
  ring *= smoothstep(uLandRadius - 0.4, uLandRadius + 0.1, dist);
  float pulse = 0.8 + 0.2 * sin(uTime * 1.8 + dist * 2.2);
  col = mix(col, uFoamColor, ring * pulse);

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
        uWaterColor: { value: new THREE.Color(0x3a9fd4) },
        uDeepColor: { value: new THREE.Color(0x2a7eb8) },
        uFoamColor: { value: new THREE.Color(0xffffff) },
        uLandRadius: { value: 5 },
        uPatternScale: { value: 0.7 },
        uScrollSpeed: { value: 1.15 },
      },
      side: THREE.DoubleSide,
    });

    const geom = new THREE.PlaneGeometry(80, 80, 1, 1);
    geom.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.position.y = -0.08;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    this.mesh.receiveShadow = true;
  }

  resize(landRadius: number): void {
    const size = Math.max(48, landRadius * 9);
    const old = this.mesh.geometry;
    const geom = new THREE.PlaneGeometry(size, size, 1, 1);
    geom.rotateX(-Math.PI / 2);
    this.mesh.geometry = geom;
    old.dispose();
    this.material.uniforms.uLandRadius.value = landRadius;
    this.material.uniforms.uPatternScale.value = Math.max(0.45, 0.85 - landRadius * 0.035);
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
