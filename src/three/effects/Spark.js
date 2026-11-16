import * as THREE from 'three';

/**
 * Spark —— 点火电火花
 * ------------------------------------------------------------------
 * 点火针尖端随机闪烁的蓝白色点火花 + 点光源脉冲。
 * 由 Burner 在点火阶段调用 trigger()，持续约 0.7 秒。
 */
const SPARK_COUNT = 14;

export class Spark {
  /**
   * @param {THREE.Vector3} tipPosition 点火针尖端位置
   */
  constructor(tipPosition) {
    this.tip = tipPosition.clone();
    this.timer = 0;
    this.flicker = 0;

    const positions = new Float32Array(SPARK_COUNT * 3);
    for (let i = 0; i < SPARK_COUNT; i++) {
      // 尖端周围小球形随机分布
      const r = 0.03 + Math.random() * 0.09;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = this.tip.x + r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = this.tip.y + r * Math.cos(phi) * 0.7;
      positions[i * 3 + 2] = this.tip.z + r * Math.sin(phi) * Math.sin(theta);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.material = new THREE.PointsMaterial({
      color: 0xaee9ff,
      size: 0.07,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.visible = false;
    this.points.raycast = () => {};
    this.points.renderOrder = 13;
    this.geo = geo;

    this.light = new THREE.PointLight(0x9fdcff, 0, 2.2);
    this.light.position.copy(this.tip);
  }

  /** 触发电火花，duration 秒内持续闪烁 */
  trigger(duration = 0.7) {
    this.timer = duration;
    this.points.visible = true;
  }

  get active() {
    return this.timer > 0;
  }

  update(dt) {
    if (this.timer > 0) {
      this.timer -= dt;
      // 高频闪烁：随机透明度
      this.flicker -= dt;
      if (this.flicker <= 0) {
        this.flicker = 0.04 + Math.random() * 0.05;
        this.material.opacity = 0.35 + Math.random() * 0.65;
        this.light.intensity = 1.2 + Math.random() * 2.0;
      }
      if (this.timer <= 0) {
        this.points.visible = false;
        this.material.opacity = 0;
        this.light.intensity = 0;
      }
    }
  }

  dispose() {
    this.geo.dispose();
    this.material.dispose();
  }
}
