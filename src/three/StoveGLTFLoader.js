import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { matchPartByName } from '../data/parts.js';

/**
 * StoveGLTFLoader —— 在线加载网络 GLB 燃气灶台模型
 * ------------------------------------------------------------------
 * - 支持 onProgress 进度回调，驱动加载遮罩进度条；
 * - 自动居中、缩放至与内置模型相近的教学观察尺寸；
 * - 按网格名称关键字匹配零件知识库，写入 userData.partKey；
 * - 统一开启阴影与 PBR 环境反射。
 *
 * 注：外部 GLB 不包含火焰/烟雾等程序化特效，特效仍由
 * StoveController 挂在模型包围盒估算的炉头位置上。
 */
export class StoveGLTFLoader {
  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * @param {string} url
   * @param {(percent:number)=>void} [onProgress]
   * @returns {Promise<{model:THREE.Group, burnerPoints:[THREE.Vector3,THREE.Vector3], box:THREE.Box3}>}
   */
  load(url, onProgress) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => resolve(this._process(gltf)),
        (evt) => {
          if (evt.total > 0 && onProgress) {
            onProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        },
        (err) => reject(err)
      );
    });
  }

  _process(gltf) {
    const model = gltf.scene;

    // 归一化：先计算原始包围盒
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 6.4 / (maxDim || 1); // 目标尺寸与内置灶台接近

    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

    const pickables = [];
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        // PBR 材质参数兜底，保证环境反射一致
        const m = o.material;
        if (m && m.isMeshStandardMaterial) {
          m.envMapIntensity = m.envMapIntensity || 1.0;
        }
        // 名称关键字匹配零件库
        const matched = matchPartByName(o.name) || matchPartByName(o.parent?.name);
        if (matched) o.userData.partKey = matched.key;
        pickables.push(o);
      }
    });

    model.userData.pickables = pickables;

    // 重新计算归一化后的包围盒，估算两个炉头位置（上表面 x 方向 1/4、3/4 处）
    const box2 = new THREE.Box3().setFromObject(model);
    const top = box2.max.y;
    const p1 = new THREE.Vector3(
      THREE.MathUtils.lerp(box2.min.x, box2.max.x, 0.25),
      top,
      (box2.min.z + box2.max.z) / 2
    );
    const p2 = new THREE.Vector3(
      THREE.MathUtils.lerp(box2.min.x, box2.max.x, 0.75),
      top,
      (box2.min.z + box2.max.z) / 2
    );

    return {
      model,
      burnerPoints: [p1, p2],
      box: box2
    };
  }
}
