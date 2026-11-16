import * as THREE from 'three';

/**
 * Smoke —— 粒子烟雾系统
 * ------------------------------------------------------------------
 * Points 粒子，CPU 端驱动生命周期（生成 → 上升扩散 → 淡出），
 * 片元着色器用 gl_PointCoord 绘制柔和圆形并按生命周期透明。
 * 粒子数量随火力强度变化，支持全局 ClipPlanes。
 */
const SMOKE_VERTEX = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
#include <clipping_planes_pars_vertex>
void main() {
  vAlpha = aAlpha;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (320.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}
`;

const SMOKE_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
#include <clipping_planes_pars_fragment>
void main() {
  #include <clipping_planes_fragment>
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(uColor, vAlpha * soft);
}
`;

const PARTICLE_COUNT = 160;

export class Smoke {
  /**
   * @param {THREE.Vector3} origin 烟雾生成点（火焰上方）
   */
  constructor(origin) {
    this.origin = origin.clone();
    this.active = false;
    this.strength = 0;

    this.positions = new Float32Array(PARTICLE_COUNT * 3);
    this.sizes = new Float32Array(PARTICLE_COUNT);
    this.alphas = new Float32Array(PARTICLE_COUNT);

    // CPU 粒子状态
    this.particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particles.push({
        life: 0,
        maxLife: 1.6 + Math.random() * 1.4,
        speed: 0.55 + Math.random() * 0.5,
        angle: Math.random() * Math.PI * 2,
        drift: 0.12 + Math.random() * 0.22,
        size: 26 + Math.random() * 34
      });
      this.positions[i * 3 + 1] = -999; // 初始藏起来
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));

    this.material = new THREE.ShaderMaterial({
      clipping: true,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(0x8a8f98) }
      },
      vertexShader: SMOKE_VERTEX,
      fragmentShader: SMOKE_FRAGMENT
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.renderOrder = 12;
    this.points.frustumCulled = false;
    this.points.visible = false;
    // 烟雾不参与点击拾取
    this.points.raycast = () => {};

    this.geo = geo;
    this._emitAcc = 0;
  }

  setActive(on) {
    this.active = on;
    this.points.visible = on;
    if (!on) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        this.particles[i].life = 0;
        this.alphas[i] = 0;
        this.positions[i * 3 + 1] = -999;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aAlpha.needsUpdate = true;
    }
  }

  /** 火力 0~1 */
  setStrength(v) {
    this.strength = v;
  }

  _respawn(i) {
    const p = this.particles[i];
    p.life = 0;
    p.maxLife = 1.6 + Math.random() * 1.4;
    const r = Math.random() * 0.12;
    const a = Math.random() * Math.PI * 2;
    this.positions[i * 3] = this.origin.x + Math.cos(a) * r;
    this.positions[i * 3 + 1] = this.origin.y;
    this.positions[i * 3 + 2] = this.origin.z + Math.sin(a) * r;
    this.sizes[i] = p.size;
  }

  update(dt) {
    if (!this.active) return;

    // 发射速率随火力：0.3~1.0 时每帧激活若干颗粒子
    this._emitAcc += dt * (6 + this.strength * 26);
    let toEmit = Math.floor(this._emitAcc);
    this._emitAcc -= toEmit;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = this.particles[i];

      if (p.life <= 0) {
        if (toEmit > 0 && Math.random() < 0.6 + this.strength * 0.4) {
          this._respawn(i);
          toEmit--;
        } else {
          this.alphas[i] = 0;
          continue;
        }
      }

      p.life += dt;
      const t = p.life / p.maxLife;
      if (t >= 1) {
        p.life = 0;
        this.alphas[i] = 0;
        this.positions[i * 3 + 1] = -999;
        continue;
      }

      // 上升 + 径向扩散
      p.angle += dt * p.drift;
      const spread = t * (0.22 + this.strength * 0.18);
      this.positions[i * 3] += Math.cos(p.angle) * dt * p.drift * 0.4;
      this.positions[i * 3 + 2] += Math.sin(p.angle) * dt * p.drift * 0.4;
      this.positions[i * 3 + 1] += p.speed * dt;
      // 轻微外扩
      const idx = i * 3;
      const dx = this.positions[idx] - this.origin.x;
      const dz = this.positions[idx + 2] - this.origin.z;
      const dist = Math.hypot(dx, dz) || 1;
      this.positions[idx] += (dx / dist) * spread * dt;
      this.positions[idx + 2] += (dz / dist) * spread * dt;

      // 淡入淡出
      const fadeIn = Math.min(1, t * 4);
      const fadeOut = 1 - t;
      this.alphas[i] = fadeIn * fadeOut * (0.12 + this.strength * 0.22);
      this.sizes[i] = p.size * (0.6 + t * 0.9);
    }

    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.material.dispose();
  }
}
