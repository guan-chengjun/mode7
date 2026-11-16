import * as THREE from 'three';
import { SIMPLEX_NOISE_GLSL } from '../shaders/noise.glsl.js';
import { damp } from '../../utils/mathUtils.js';

/**
 * Flame —— 着色器动态火焰
 * ------------------------------------------------------------------
 * 双层圆锥（外层橙红火舌 + 根部蓝色焰心）：
 *  - 顶点着色器：Simplex 噪声驱动火焰摇摆、收窄与湍流；
 *  - 片元着色器：沿高度 蓝→橙→红 渐变，顶部渐隐；
 *  - 支持全局 ClipPlanes（ShaderMaterial 需手动引入 clipping 片段）；
 *  - 火力 uStrength 实时改变亮度，Group 缩放改变火焰尺寸。
 */
const FLAME_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uStrength;
varying vec2 vUv;
varying vec3 vLocalPos;
#include <clipping_planes_pars_vertex>
${SIMPLEX_NOISE_GLSL}
void main() {
  vUv = uv;
  vec3 p = position;
  float h = uv.y;

  // 湍流噪声 + 低频摇摆，越靠近顶部摆动越大
  float n = snoise(vec3(p.x * 4.0 + uTime * 1.6, p.y * 3.0 - uTime * 2.4, uTime * 0.7));
  float sway = snoise(vec3(uTime * 0.9, h * 2.2, p.z * 3.0));
  p.x += (n * 0.11 + sway * 0.09) * h;
  p.z += n * 0.10 * h;

  // 火舌顶部被噪声"撕裂"收窄
  p.xz *= 1.0 - 0.28 * h * h * abs(n);

  vLocalPos = p;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}
`;

const FLAME_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uStrength;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vLocalPos;
#include <clipping_planes_pars_fragment>
void main() {
  #include <clipping_planes_fragment>
  float h = vUv.y;

  // 高度方向颜色渐变：根部蓝 → 中部橙 → 顶部暗红
  vec3 color = mix(uColorA, uColorB, smoothstep(0.02, 0.38, h));
  color = mix(color, uColorC, smoothstep(0.62, 1.0, h));

  // 火焰闪烁
  float flicker = 0.88 + 0.12 * sin(uTime * 11.0 + vLocalPos.x * 18.0);

  // 径向软化：圆锥边缘透明
  float radius = length(vLocalPos.xz);
  float soft = 1.0 - smoothstep(0.16, 0.30, radius * (1.2 - h * 0.5));

  float alpha = (1.0 - h) * uOpacity * soft * flicker;
  alpha *= 0.55 + 0.45 * uStrength;

  gl_FragColor = vec4(color * (0.75 + uStrength * 0.85), alpha);
}
`;

function createFlameMaterial(isCore) {
  return new THREE.ShaderMaterial({
    clipping: true, // 关键：启用全局裁剪平面
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0.6 },
      uOpacity: { value: isCore ? 0.9 : 0.75 },
      uColorA: {
        value: new THREE.Color(isCore ? 0x2b7fff : 0x3b82ff)
      },
      uColorB: {
        value: new THREE.Color(isCore ? 0xffd27a : 0xff8a1e)
      },
      uColorC: {
        value: new THREE.Color(isCore ? 0xff9a3d : 0xd83a12)
      }
    },
    vertexShader: FLAME_VERTEX,
    fragmentShader: FLAME_FRAGMENT
  });
}

export class Flame {
  /**
   * @param {THREE.Vector3} position 火盖中心位置
   */
  constructor(position) {
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.visible = false;

    // 外焰
    const outerGeo = new THREE.ConeGeometry(0.27, 1.0, 28, 14, true);
    outerGeo.translate(0, 0.5, 0); // 锥底对齐 y=0
    this.outerMat = createFlameMaterial(false);
    const outer = new THREE.Mesh(outerGeo, this.outerMat);
    outer.renderOrder = 10;
    outer.userData.partKey = 'flame';
    this.group.add(outer);

    // 内焰（蓝色焰心，更小更矮）
    const coreGeo = new THREE.ConeGeometry(0.15, 0.55, 22, 10, true);
    coreGeo.translate(0, 0.275, 0);
    this.coreMat = createFlameMaterial(true);
    const core = new THREE.Mesh(coreGeo, this.coreMat);
    core.renderOrder = 11;
    core.userData.partKey = 'flame';
    this.group.add(core);

    this.group.traverse((o) => {
      o.userData.partKey = 'flame';
    });

    this.active = false;
    this.strength = 0; // 实际显示值（带阻尼）
    this.targetStrength = 0.6;
  }

  setActive(on) {
    this.active = on;
    this.group.visible = on;
    if (!on) this.strength = 0;
  }

  /** 火力 0~1 */
  setStrength(v) {
    this.targetStrength = v;
  }

  update(dt, elapsed) {
    if (!this.active) return;
    this.strength = damp(this.strength, this.targetStrength, 6, dt);

    const s = this.strength;
    // 火焰尺寸随火力变化
    this.group.scale.set(0.72 + s * 0.5, 0.5 + s * 0.85, 0.72 + s * 0.5);

    this.outerMat.uniforms.uTime.value = elapsed;
    this.outerMat.uniforms.uStrength.value = s;
    this.coreMat.uniforms.uTime.value = elapsed;
    this.coreMat.uniforms.uStrength.value = s;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.outerMat.dispose();
    this.coreMat.dispose();
  }
}
