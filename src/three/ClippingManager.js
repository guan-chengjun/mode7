import * as THREE from 'three';

/**
 * ClippingManager —— 剖切平面管理
 * ------------------------------------------------------------------
 * 使用 THREE.Planes（渲染器 global clipping planes）实现外壳剖切：
 *  - 内置材质（MeshStandardMaterial 等）自动支持；
 *  - 自定义着色器（火焰/烟雾）在 Shader 中手动引入 clipping 片段。
 * 同时维护一个半透明可视化平面，让用户看清剖切位置。
 * 支持 X / Y / Z 三个剖切方向，各自维护独立的包围范围。
 */
export class ClippingManager {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {{x:[number,number],y:[number,number],z:[number,number]}} bounds 各轴包围范围
   */
  constructor(renderer, scene, bounds) {
    this.renderer = renderer;
    this.scene = scene;
    this.bounds = bounds || {
      x: [-2.8, 2.8],
      y: [-0.5, 2],
      z: [-1.7, 1.7]
    };
    this.axis = 'x';
    this.progress = 0;

    // 常量平面：法线朝 +轴方向，constant 在 setProgress 中设置
    this.plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    renderer.clippingPlanes = [this.plane];

    // 可视化平面
    const helperGeo = new THREE.PlaneGeometry(9, 9);
    const helperMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.helper = new THREE.Mesh(helperGeo, helperMat);
    this.helper.visible = false;
    this.helper.renderOrder = 5;
    scene.add(this.helper);

    // 平面边框线
    const edges = new THREE.EdgesGeometry(helperGeo);
    this.helperLine = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.75
      })
    );
    this.helper.add(this.helperLine);
  }

  /** 切换剖切轴 X / Y / Z */
  setAxis(axis) {
    this.axis = axis;
    this.plane.normal.set(
      axis === 'x' ? 1 : 0,
      axis === 'y' ? 1 : 0,
      axis === 'z' ? 1 : 0
    );

    // 可视化平面与法线垂直
    this.helper.rotation.set(0, 0, 0);
    if (axis === 'x') this.helper.rotation.y = Math.PI / 2;
    if (axis === 'z') this.helper.rotation.x = Math.PI / 2;
    // axis === 'y' 时 PlaneGeometry 默认即垂直 Y，无需旋转

    this.setProgress(this.progress); // 按新轴重新计算平面位置
  }

  /**
   * 按滑块比例（0~1）更新剖切深度
   * 0 表示不剖切（平面移到包围盒外），越大切得越深
   */
  setProgress(p) {
    this.progress = p;
    const [min, max] = this.bounds[this.axis];

    if (p <= 0.001) {
      // 放到正方向极远处 => 没有任何点被裁掉
      this.plane.constant = -max - 100;
      this.helper.visible = false;
    } else {
      // 从 max 向 min 推进：Plane 保留法线负侧，切去 +法线侧
      this.plane.constant = -(max - (max - min) * p);
      this.helper.visible = true;
    }
    this._updateHelperPosition();
  }

  _updateHelperPosition() {
    // 平面方程 normal·p + constant = 0 => 沿法线位移 -constant
    const d = -this.plane.constant;
    this.helper.position.set(
      this.axis === 'x' ? d : 0,
      this.axis === 'y' ? d : 0.8,
      this.axis === 'z' ? d : 0
    );
  }

  /** 模型更换后更新包围范围（传入 Box3 或各轴 min/max） */
  setBounds(boxOrMin, maybeMax) {
    if (boxOrMin instanceof THREE.Box3) {
      const b = boxOrMin;
      this.bounds = {
        x: [b.min.x, b.max.x],
        y: [b.min.y, b.max.y],
        z: [b.min.z, b.max.z]
      };
    } else if (typeof maybeMax === 'number') {
      // 兼容旧签名 setBounds(minX, maxX)：仅更新当前轴
      this.bounds[this.axis] = [boxOrMin, maybeMax];
    }
  }

  dispose() {
    this.renderer.clippingPlanes = [];
    this.helper.geometry.dispose();
    this.helper.material.dispose();
    this.helperLine.geometry.dispose();
    this.helperLine.material.dispose();
  }
}
