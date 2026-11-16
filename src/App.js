import * as THREE from 'three';
import { SceneManager } from './three/SceneManager.js';
import { ClippingManager } from './three/ClippingManager.js';
import { ProceduralStove } from './three/ProceduralStove.js';
import { StoveGLTFLoader } from './three/StoveGLTFLoader.js';
import { StoveController } from './three/StoveController.js';
import { DemoController } from './three/DemoController.js';
import { Picker } from './three/Interaction/Picker.js';
import { ControlPanel } from './ui/ControlPanel.js';
import { AnnotationCard } from './ui/AnnotationCard.js';

/**
 * App —— 系统总装
 * 负责创建各子系统、绑定 UI 回调、驱动渲染循环与状态同步。
 */
export class App {
  constructor() {
    const container = document.getElementById('app');
    this.sceneMgr = new SceneManager(container);
    this.card = new AnnotationCard();

    // 剖切管理（初始包围范围按内置灶台估计）
    this.clipping = new ClippingManager(this.sceneMgr.renderer, this.sceneMgr.scene, {
      min: -2.8,
      max: 2.8
    });

    // UI 面板
    this.panel = new ControlPanel({
      onModeChange: (mode) => this._switchMode(mode),
      onIgnite: (side) => this.controller?.toggleBurner(side),
      onPowerChange: (side, v) => this.controller?.setPower(side, v),
      onFlameout: (side) => this.controller?.simulateFlameout(side),
      onMainValve: (open) => this.controller?.setMainValve(open),
      onDemoPlay: () => this._playDemo(),
      onDemoStop: () => this.demo?.stop(),
      onClipChange: (p) => this.clipping.setProgress(p),
      onClipAxis: (axis) => this.clipping.setAxis(axis),
      onAutoRotate: (on) => this.sceneMgr.setAutoRotate(on),
      onResetView: () => this.resetAll(),
      onLoadGLB: (url) => this._loadGLB(url),
      onRestoreProcedural: () => this._restoreProcedural(),
      onStatus: (text) => this.panel.setStatus(text)
    });

    this.gltfLoader = new StoveGLTFLoader();
    this.currentModel = null;
    this.clock = new THREE.Clock();
    this._buildProcedural();

    // 拾取器（先占位，模型替换时更新 pickables）
    this.picker = new Picker(
      this.sceneMgr.renderer,
      this.sceneMgr.camera,
      this._collectPickables(),
      (data) => (data ? this.card.show(data) : this.card.hide())
    );
    // 点击 3D 旋钮直接点火/关火（仅手动模式生效）
    this.picker.onPartClick = (key, obj) => {
      if (key !== 'knob' || this.panel.mode !== 'manual') return;
      const side = obj.getWorldPosition(new THREE.Vector3()).x < 0 ? 'left' : 'right';
      this.controller?.toggleBurner(side);
    };

    this._animate = this._animate.bind(this);
    this.sceneMgr.renderer.setAnimationLoop(this._animate);
    this.panel.setLoading(100);
  }

  // ---------------- 模型装配 ----------------
  _buildProcedural() {
    const stove = new ProceduralStove();
    this.sceneMgr.scene.add(stove.group);
    this.currentModel = stove;
    this.isProcedural = true;

    this._applyModelBounds(stove.group);
    this.clipping.setAxis('x');

    const burnerPoints = ['left', 'right'].map((side) =>
      stove.burners[side].flame.group.position.clone()
    );

    this.controller = new StoveController({
      root: stove.group,
      burnerPoints,
      procedural: stove,
      gasFlows: stove.gasFlows,
      onStatus: (t) => this.panel.setStatus(t)
    });
    stove.setMainValve(true);

    this.demo = new DemoController({
      controller: this.controller,
      onStage: (stage) => {
        this.panel.setStage(stage);
        this.panel.setStatus(stage);
      },
      onProgress: (p) => this.panel.setDemoProgress(p),
      onEnd: () => {
        this.panel.setDemoPlaying(false);
        this.panel.setStage('');
        this.panel.setStatus('自动演示完成，可重新播放或切回手动模式');
      }
    });
  }

  async _loadGLB(url) {
    this.panel.setLoading(5, '正在下载网络 GLB 模型…');
    this.panel.setStatus(`正在加载模型：${url}`);
    try {
      const { model, burnerPoints, box } = await this.gltfLoader.load(url, (p) => {
        this.panel.setLoading(5 + p * 0.9, `模型下载中 ${p}%`);
      });

      this._disposeCurrentModel();
      this.sceneMgr.scene.add(model);
      this.currentModel = model;
      this.isProcedural = false;
      this.clipping.setBounds(box);
      this.clipping.setAxis(this.panel.clipAxis);
      const clipP = Number(document.getElementById('clip-slider').value) / 100;
      this.clipping.setProgress(clipP);

      this.controller = new StoveController({
        root: this.sceneMgr.scene,
        burnerPoints,
        procedural: null,
        gasFlows: [],
        onStatus: (t) => this.panel.setStatus(t)
      });

      this.demo = new DemoController({
        controller: this.controller,
        onStage: (stage) => {
          this.panel.setStage(stage);
          this.panel.setStatus(stage);
        },
        onProgress: (p) => this.panel.setDemoProgress(p),
        onEnd: () => {
          this.panel.setDemoPlaying(false);
          this.panel.setStage('');
        }
      });

      this.picker.setPickables(this._collectPickables());
      this.card.hide();
      this.panel.setLoading(100);
      this.panel.setStatus('GLB 模型加载完成，特效已自动挂载到估算炉头位置');
    } catch (err) {
      console.error(err);
      this.panel.setLoading(100);
      this.panel.setStatus(`❌ 模型加载失败：${err.message || '网络或格式错误'}`);
    }
  }

  _restoreProcedural() {
    this._disposeCurrentModel();
    this._buildProcedural();
    this.picker.setPickables(this._collectPickables());
    this.card.hide();
    this.panel.setStatus('已恢复内置程序化教学模型');
  }

  _disposeCurrentModel() {
    if (!this.currentModel) return;
    if (this.isProcedural) {
      this.currentModel.dispose();
    } else {
      this.currentModel.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose && m.dispose());
        }
      });
    }
    this.sceneMgr.scene.remove(this.currentModel.group ?? this.currentModel);
    this.controller?.dispose();
    this.currentModel = null;
  }

  _applyModelBounds(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    this.clipping.setBounds(box);
  }

  _collectPickables() {
    if (this.isProcedural && this.currentModel) {
      return this.currentModel.pickables;
    }
    if (this.currentModel?.userData?.pickables) {
      return this.currentModel.userData.pickables;
    }
    return [];
  }

  // ---------------- 模式与演示 ----------------
  _switchMode(mode) {
    if (mode === 'manual') {
      this.demo.stop();
      this.panel.setDemoPlaying(false);
      this.panel.setStage('');
      this.panel.setStatus('已切换手动模式：左右灶可独立点火、调火力、模拟熄火');
    } else {
      this.panel.setStatus('已切换自动演示模式，点击"播放演示"查看完整工作流程');
    }
  }

  _playDemo() {
    if (!this.demo) return;
    this.demo.start();
    this.panel.setDemoPlaying(true);
  }

  // ---------------- 重置 ----------------
  resetAll() {
    this.demo?.stop();
    this.panel.setDemoPlaying(false);
    this.panel.setStage('');
    this.controller?.resetAll();
    this.sceneMgr.resetView();
    document.getElementById('auto-rotate').checked = false;
    document.getElementById('clip-slider').value = 0;
    document.getElementById('clip-val').textContent = '0%';
    this.clipping.setProgress(0);
    ['left', 'right'].forEach((s) => {
      document.getElementById(`${s}-power`).value = 60;
      document.getElementById(`${s}-power-val`).textContent = '60%';
      this.panel.setBurnerState(s, '关闭');
    });
    this.panel.setMainValveUI(true);
    this.card.hide();
    this.panel.setStatus('视角与系统状态已重置');
  }

  // ---------------- 状态同步 ----------------
  _syncBurnerUI() {
    if (!this.controller) return;
    for (const side of ['left', 'right']) {
      const s = this.controller.state[side];
      if (this.controller.isProtected(side) || (s.protection && s.on)) {
        this.panel.setBurnerState(side, '熄火保护', 'protect');
      } else if (s.flameOn) {
        this.panel.setBurnerState(side, `燃烧 ${Math.round(s.power * 100)}%`, 'on');
      } else if (s.on) {
        this.panel.setBurnerState(side, '供气中', 'on');
      } else {
        this.panel.setBurnerState(side, '关闭');
      }
    }
    this.panel.setMainValveUI(this.controller.mainValveOpen);
  }

  // ---------------- 渲染循环 ----------------
  _animate() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    this.controller?.update(dt);
    this.demo?.update(dt);

    if (this.isProcedural && this.currentModel) {
      this.currentModel.update(dt, elapsed);
    }

    this._syncBurnerUI();
    this.card.update(this.sceneMgr.camera, this.sceneMgr.renderer);
    this.sceneMgr.render();
  }
}
