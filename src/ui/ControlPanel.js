/**
 * ControlPanel —— 侧边控制面板（DOM 事件绑定与状态回写）
 * ------------------------------------------------------------------
 * 只负责 UI 交互，所有 3D 逻辑通过构造时传入的回调委托给 App。
 */
const $ = (id) => document.getElementById(id);

export class ControlPanel {
  /**
   * @param {object} cb 回调集合
   */
  constructor(cb) {
    this.cb = cb;
    this.mode = 'manual';
    this.clipAxis = 'x';
    this._bind();
  }

  _bind() {
    // ---- 模式切换 ----
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setMode(btn.dataset.mode);
        this.cb.onModeChange?.(this.mode);
      });
    });

    // ---- 手动控制：左右灶 ----
    ['left', 'right'].forEach((side) => {
      $(`${side}-ignite`).addEventListener('click', () => cb_safe(this.cb, 'onIgnite', side));
      $(`${side}-power`).addEventListener('input', (e) => {
        const v = Number(e.target.value) / 100;
        $(`${side}-power-val`).textContent = `${e.target.value}%`;
        this.cb.onPowerChange?.(side, v);
      });
      $(`${side}-flameout`).addEventListener('click', () =>
        cb_safe(this.cb, 'onFlameout', side)
      );
    });

    $('main-valve').addEventListener('change', (e) => {
      this.cb.onMainValve?.(e.target.checked);
    });

    // ---- 自动演示 ----
    $('demo-play').addEventListener('click', () => this.cb.onDemoPlay?.());
    $('demo-stop').addEventListener('click', () => this.cb.onDemoStop?.());

    // ---- 剖切 ----
    $('clip-slider').addEventListener('input', (e) => {
      const p = Number(e.target.value) / 100;
      $('clip-val').textContent = `${e.target.value}%`;
      this.cb.onClipChange?.(p);
    });
    document.querySelectorAll('.axis-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.axis-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.clipAxis = btn.dataset.axis;
        this.cb.onClipAxis?.(this.clipAxis);
      });
    });

    // ---- 视图与模型 ----
    $('auto-rotate').addEventListener('change', (e) => {
      this.cb.onAutoRotate?.(e.target.checked);
    });
    $('reset-view').addEventListener('click', () => this.cb.onResetView?.());
    $('load-glb').addEventListener('click', () => {
      const url = $('glb-url').value.trim();
      if (url) this.cb.onLoadGLB?.(url);
      else this.cb.onStatus?.('请先输入 GLB 模型 URL');
    });
    $('restore-procedural').addEventListener('click', () =>
      this.cb.onRestoreProcedural?.()
    );
  }

  /** 切换手动/自动模式的 UI 可用性 */
  setMode(mode) {
    this.mode = mode;
    document.querySelectorAll('.mode-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    $('manual-section').classList.toggle('disabled-section', mode === 'auto');
    $('auto-section').classList.toggle('disabled-section', mode === 'auto');
  }

  setDemoPlaying(playing) {
    $('demo-play').textContent = playing ? '演示进行中…' : '▶ 播放演示';
    $('demo-play').disabled = playing;
  }

  setDemoProgress(p) {
    $('demo-progress-bar').style.width = `${Math.round(p * 100)}%`;
  }

  /** 回写灶头状态标签 */
  setBurnerState(side, label, kind = '') {
    const el = $(`${side}-state`);
    el.textContent = label;
    el.className = `burner-state ${kind}`;
  }

  setMainValveUI(open) {
    $('main-valve').checked = open;
  }

  setStatus(text) {
    $('status-text').textContent = text;
  }

  setStage(text) {
    const el = $('stage-banner');
    if (text) {
      el.textContent = text;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  setLoading(percent, text) {
    const overlay = $('loading-overlay');
    if (percent >= 100) {
      overlay.classList.add('hidden');
      return;
    }
    overlay.classList.remove('hidden');
    $('loading-bar').style.width = `${percent}%`;
    if (text) document.querySelector('.loading-text').textContent = text;
  }
}

function cb_safe(callbacks, name, ...args) {
  callbacks[name]?.(...args);
}
