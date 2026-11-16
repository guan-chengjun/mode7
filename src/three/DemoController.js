/**
 * DemoController —— 自动演示时序
 * ------------------------------------------------------------------
 * 一键播放完整工作流程：
 *   通气 → 旋钮打开 → 点火 → 正常燃烧
 *   → 意外熄火 → 热电偶触发断气保护
 * 采用时间轴驱动，可随时停止；阶段变化通过回调通知 UI。
 */

// 时间轴节点（秒）：到点执行一次的动作
const TIMELINE = [
  {
    t: 0.5,
    stage: '通气：打开燃气总阀',
    run(deps) {
      deps.controller.setMainValve(true);
    }
  },
  {
    t: 3.0,
    stage: '旋钮打开：旋塞阀开启，燃气经喷嘴喷入引射器',
    run(deps) {
      deps.controller.ignite('left');
    }
  },
  {
    t: 6.5,
    stage: '点火：点火针产生电火花，点燃燃气-空气混合气',
    run() {
      // 点火动作已在上一步触发电火花，此处仅作阶段提示
    }
  },
  {
    t: 8.5,
    stage: '正常燃烧：热电偶受热产生热电势，维持电磁阀吸合',
    run(deps) {
      deps.controller.setPower('left', 0.85);
    }
  },
  {
    t: 12.5,
    stage: '意外熄火：火焰熄灭，但管路仍在供气（危险状态）',
    run(deps) {
      deps.controller.simulateFlameout('left');
    }
  },
  {
    t: 16.2,
    stage: '热电偶冷却：热电势逐渐消失',
    run() {}
  },
  {
    t: 17.0,
    stage: '断气保护：电磁阀释放，自动切断燃气，防止泄漏',
    run() {}
  },
  {
    t: 20.5,
    stage: '演示结束：系统恢复安全状态',
    run(deps) {
      deps.controller.setMainValve(false);
    }
  }
];

const TOTAL_DURATION = 22.5;

export class DemoController {
  /**
   * @param {object} deps
   * @param {import('./StoveController.js').StoveController} deps.controller
   * @param {(stage:string)=>void} deps.onStage
   * @param {(progress:number)=>void} deps.onProgress
   * @param {()=>void} deps.onEnd
   */
  constructor({ controller, onStage, onProgress, onEnd }) {
    this.controller = controller;
    this.onStage = onStage;
    this.onProgress = onProgress;
    this.onEnd = onEnd;
    this.running = false;
    this.elapsed = 0;
    this.cursor = 0;
  }

  start() {
    this.controller.resetAll();
    this.elapsed = 0;
    this.cursor = 0;
    this.running = true;
    this.onStage('演示开始：系统复位，准备通气');
    this.onProgress(0);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.controller.resetAll();
    this.onStage('演示已停止并复位');
    this.onProgress(0);
  }

  update(dt) {
    if (!this.running) return;
    this.elapsed += dt;

    while (this.cursor < TIMELINE.length && this.elapsed >= TIMELINE[this.cursor].t) {
      const node = TIMELINE[this.cursor];
      this.onStage(node.stage);
      node.run({ controller: this.controller });
      this.cursor++;
    }

    this.onProgress(Math.min(1, this.elapsed / TOTAL_DURATION));

    if (this.elapsed >= TOTAL_DURATION) {
      this.running = false;
      this.onProgress(1);
      this.onEnd();
    }
  }
}
