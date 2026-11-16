/**
 * AnnotationCard —— 零件标注卡片
 * 定位到 3D 锚点的屏幕投影位置，相机旋转时跟随移动。
 */
export class AnnotationCard {
  constructor() {
    this.el = document.getElementById('annotation-card');
    this.titleEl = document.getElementById('annotation-title');
    this.descEl = document.getElementById('annotation-desc');
    this.anchor = null; // THREE.Vector3 世界坐标锚点

    document.getElementById('annotation-close').addEventListener('click', () => this.hide());
  }

  /**
   * @param {{title:string,desc:string,anchor:THREE.Vector3}} data
   */
  show(data) {
    this.titleEl.textContent = data.title;
    this.descEl.textContent = data.desc;
    this.anchor = data.anchor.clone();
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
    this.anchor = null;
  }

  get visible() {
    return !this.el.classList.contains('hidden');
  }

  /** 每帧把锚点投影到屏幕坐标 */
  update(camera, renderer) {
    if (!this.anchor || !this.visible) return;
    const v = this.anchor.clone().project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    const x = (v.x * 0.5 + 0.5) * rect.width;
    const y = (-v.y * 0.5 + 0.5) * rect.height;

    // 锚点跑到相机背后时隐藏
    if (v.z > 1) {
      this.el.style.opacity = '0';
    } else {
      this.el.style.opacity = '1';
      // 边缘夹紧，避免卡片超出视口
      const halfW = 160;
      const cx = Math.max(halfW + 8, Math.min(rect.width - halfW - 8, x));
      this.el.style.left = `${cx}px`;
      this.el.style.top = `${Math.max(180, y - 10)}px`;
    }
  }
}
