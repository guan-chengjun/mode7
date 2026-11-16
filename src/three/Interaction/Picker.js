import * as THREE from 'three';
import { PART_INFO } from '../../data/parts.js';

/**
 * Picker —— 零件点击拾取与标注
 * ------------------------------------------------------------------
 * - Raycaster 拾取可交互网格（内置模型 / GLB 均通过 userData.partKey 标注）；
 * - 区分拖拽与点击（OrbitControls 旋转时不弹标注）；
 * - 悬停高亮（emissive 增强）+ 鼠标手型；
 * - 标注卡片定位到零件投影点，由 App 负责 DOM 渲染。
 */
const DRAG_THRESHOLD_PX = 6;

export class Picker {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Camera} camera
   * @param {THREE.Object3D[]} pickables
   * @param {(info:{title:string,desc:string,x:number,y:number,anchor:THREE.Vector3}|null)=>void} onPick
   */
  constructor(renderer, camera, pickables, onPick) {
    this.renderer = renderer;
    this.camera = camera;
    this.pickables = pickables;
    this.onPick = onPick;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.hovered = null;
    this._downPos = null;

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', this._onDown.bind(this));
    dom.addEventListener('pointerup', this._onUp.bind(this));
    dom.addEventListener('pointermove', this._onMove.bind(this));
    dom.addEventListener('pointerleave', () => {
      this._clearHover();
      dom.style.cursor = 'default';
    });
  }

  setPickables(list) {
    this.pickables = list;
    this._clearHover();
  }

  _updatePointer(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    return { x: event.clientX, y: event.clientY };
  }

  _intersect() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    return hits.length ? hits[0] : null;
  }

  _onDown(e) {
    this._downPos = { x: e.clientX, y: e.clientY };
  }

  _onUp(e) {
    if (!this._downPos) return;
    const dx = e.clientX - this._downPos.x;
    const dy = e.clientY - this._downPos.y;
    this._downPos = null;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) return; // 拖拽旋转，不拾取

    this._updatePointer(e);
    const hit = this._intersect();
    if (!hit) {
      this.onPick(null);
      return;
    }
    this._showAnnotation(hit, e.clientX, e.clientY);
  }

  _onMove(e) {
    this._updatePointer(e);
    const hit = this._intersect();
    const obj = hit?.object || null;

    if (obj !== this.hovered) {
      this._clearHover();
      this.hovered = obj;
      if (obj && obj.material?.emissive) {
        obj.userData._origEmissive = obj.material.emissive.getHex();
        obj.userData._origEmissiveIntensity = obj.material.emissiveIntensity;
        obj.material.emissive.setHex(0x1f6feb);
        obj.material.emissiveIntensity = 0.55;
      }
      this.renderer.domElement.style.cursor = obj ? 'pointer' : 'default';
    }
  }

  _clearHover() {
    if (this.hovered && this.hovered.material?.emissive) {
      const m = this.hovered.material;
      m.emissive.setHex(this.hovered.userData._origEmissive ?? 0x000000);
      m.emissiveIntensity = this.hovered.userData._origEmissiveIntensity ?? 1;
    }
    this.hovered = null;
  }

  _showAnnotation(hit, clientX, clientY) {
    const obj = hit.object;
    const key = obj.userData.partKey;
    const info = PART_INFO[key];

    const title = info ? info.name : obj.name || '未命名零件';
    const desc = info
      ? info.desc
      : '该零件来自外部 GLB 模型，未配置中文原理说明。可在 src/data/parts.js 的 keywords 中补充网格名称关键字以启用标注。';

    // 特殊交互：点击旋钮直接点火/关火（由 App 决定如何处理）
    if (key === 'knob' && this.onPartClick) {
      this.onPartClick(key, obj);
    }

    // 标注锚点：命中点的世界坐标，App 每帧可据此重新投影
    this.onPick({
      title,
      desc,
      x: clientX,
      y: clientY,
      anchor: hit.point.clone()
    });
  }
}
