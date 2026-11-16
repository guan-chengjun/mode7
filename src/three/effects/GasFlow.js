import * as THREE from 'three';

/**
 * GasFlow —— 燃气通路流动演示
 * ------------------------------------------------------------------
 * 沿 CatmullRom 曲线运动的发光小球，可视化燃气在管路中的输送方向。
 * 火力越大，小球流速越快、激活数量越多。
 */
export class GasFlow {
  /**
   * @param {THREE.CatmullRomCurve3} curve 管路曲线
   * @param {number} count 小球数量
   */
  constructor(curve, count = 6) {
    this.curve = curve;
    this.count = count;
    this.active = false;
    this.speed = 0.5;

    this.geo = new THREE.SphereGeometry(0.055, 12, 12);
    this.mat = new THREE.MeshBasicMaterial({
      color: 0x35e0ff,
      transparent: true,
      opacity: 0.95
    });

    this.spheres = [];
    this.t = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, this.mat);
      m.visible = false;
      m.raycast = () => {};
      this.spheres.push(m);
      this.t.push(i / count);
    }
  }

  setActive(on) {
    this.active = on;
    this.spheres.forEach((s) => (s.visible = on));
  }

  /** 火力 0~1，映射为流动速度 */
  setStrength(v) {
    this.speed = 0.25 + v * 0.85;
    const visibleCount = Math.max(2, Math.round(this.count * (0.4 + v * 0.6)));
    this.spheres.forEach((s, i) => {
      s.visible = this.active && i < visibleCount;
    });
  }

  update(dt) {
    if (!this.active) return;
    for (let i = 0; i < this.spheres.length; i++) {
      if (!this.spheres[i].visible) continue;
      this.t[i] += dt * this.speed * 0.32;
      if (this.t[i] > 1) this.t[i] -= 1;
      const p = this.curve.getPointAt(this.t[i]);
      this.spheres[i].position.copy(p);
    }
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}
