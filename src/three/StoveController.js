import * as THREE from 'three';
import { Flame } from './effects/Flame.js';
import { Smoke } from './effects/Smoke.js';
import { Spark } from './effects/Spark.js';
import { damp, clamp } from '../utils/mathUtils.js';

/**
 * StoveController —— 灶具仿真状态机
 * ------------------------------------------------------------------
 * 管理左右两个灶头的：点火电火花、动态火焰、烟雾、旋钮角度、
 * 燃气流动、热电偶受热与意外熄火后的电磁阀断气保护。
 *
 * 既能驱动内置 ProceduralStove，也能为外部 GLB 模型动态挂载特效。
 */
const IGNITION_SPARK_TIME = 0.8; // 点火电火花持续秒数
const THERMO_COOLDOWN = 3.0; // 熄火后热电偶冷却/关阀延时（教学演示值，真实约 10~60s）

export class StoveController {
  /**
   * @param {object} opts
   * @param {THREE.Group} opts.root 特效挂载节点
   * @param {THREE.Vector3[]} opts.burnerPoints 左右灶炉头世界坐标 [left,right]
   * @param {ProceduralStove|null} [opts.procedural] 内置模型引用（含旋钮/热电偶/电磁阀联动）
   * @param {GasFlow[]} [opts.gasFlows] 内置模型自带的燃气流动特效
   * @param {(status:string)=>void} [opts.onStatus] 状态文字回调
   */
  constructor({ root, burnerPoints, procedural = null, gasFlows = [], onStatus }) {
    this.root = root;
    this.procedural = procedural;
    this.gasFlows = gasFlows;
    this.onStatus = onStatus || (() => {});

    this.mainValveOpen = true;
    this.state = {
      left: this._createBurnerState('left', burnerPoints[0]),
      right: this._createBurnerState('right', burnerPoints[1])
    };
  }

  _createBurnerState(side, point) {
    const s = {
      side,
      point: point.clone(),
      on: false, // 是否处于"开启供气"状态
      flameOn: false, // 火焰是否真实存在
      power: 0.6, // 用户设定火力 0~1
      igniting: 0, // 剩余点火计时
      thermoHeat: 0, // 热电偶受热 0~1
      protection: false, // 是否已触发熄火保护
      flame: null,
      smoke: null,
      spark: null
    };

    // 外部 GLB 模式：动态创建特效；内置模式复用 ProceduralStove 的特效
    if (this.procedural) {
      const b = this.procedural.burners[side];
      s.flame = b.flame;
      s.smoke = b.smoke;
      s.spark = b.spark;
    } else {
      const flame = new Flame(point.clone());
      this.root.add(flame.group);
      const smoke = new Smoke(point.clone().add(new THREE.Vector3(0, 0.42, 0)));
      this.root.add(smoke.points);
      const spark = new Spark(point.clone().add(new THREE.Vector3(0.18, 0.13, 0.08)));
      this.root.add(spark.points);
      this.root.add(spark.light);
      s.flame = flame;
      s.smoke = smoke;
      s.spark = spark;
    }
    return s;
  }

  // ---------------- 总阀 ----------------
  setMainValve(open) {
    this.mainValveOpen = open;
    if (this.procedural) this.procedural.setMainValve(open);
    if (!open) {
      // 总阀关闭：全部熄火断气
      ['left', 'right'].forEach((side) => this._shutOff(side, '总阀已关闭，燃气切断'));
    }
    this._refreshGasFlow();
  }

  // ---------------- 点火 / 关火 ----------------
  toggleBurner(side) {
    const s = this.state[side];
    if (s.on) {
      this._shutOff(side, `${side === 'left' ? '左' : '右'}灶已手动关闭`);
    } else {
      this.ignite(side);
    }
  }

  /** 点火（自动演示与手动模式共用） */
  ignite(side) {
    const s = this.state[side];
    if (!this.mainValveOpen) {
      this.onStatus('⚠ 燃气总阀未打开，无法点火！');
      return false;
    }
    s.on = true;
    s.protection = false;
    s.igniting = IGNITION_SPARK_TIME;
    s.spark.trigger(IGNITION_SPARK_TIME);
    s.flame.setActive(true);
    s.flame.setStrength(s.power);
    s.smoke.setActive(true);
    s.smoke.setStrength(s.power);
    s.flameOn = true;
    if (this.procedural) this.procedural.setSolenoid(side, 1);
    this._applyKnob(side);
    this._refreshGasFlow();
    this.onStatus(`🔥 ${side === 'left' ? '左' : '右'}灶点火成功，正常燃烧中`);
    return true;
  }

  /** 内部：关火断气 */
  _shutOff(side, message) {
    const s = this.state[side];
    s.on = false;
    s.flameOn = false;
    s.igniting = 0;
    s.flame.setActive(false);
    s.smoke.setActive(false);
    if (this.procedural) this.procedural.setSolenoid(side, 0);
    this._applyKnob(side);
    this._refreshGasFlow();
    if (message) this.onStatus(message);
  }

  /** 手动关火按钮 */
  shutOff(side) {
    this._shutOff(side, `${side === 'left' ? '左' : '右'}灶已关闭`);
  }

  // ---------------- 火力 ----------------
  setPower(side, power01) {
    const s = this.state[side];
    s.power = clamp(power01, 0.15, 1);
    s.flame.setStrength(s.power);
    s.smoke.setStrength(s.power);
    this._applyKnob(side);
    this._refreshGasFlow();
  }

  // ---------------- 意外熄火 + 热电偶保护 ----------------
  /**
   * 模拟意外熄火（风吹/汤水浇灭）：火焰立即消失但仍在供气，
   * 热电偶冷却到阈值后电磁阀释放、自动断气。
   */
  simulateFlameout(side) {
    const s = this.state[side];
    if (!s.on || !s.flameOn) {
      this.onStatus('该灶头未在燃烧，无法模拟熄火');
      return;
    }
    s.flameOn = false;
    s.flame.setActive(false);
    s.smoke.setActive(false);
    s.igniting = 0;
    s.protection = true; // 进入保护倒计时
    this.onStatus(`⚠ ${side === 'left' ? '左' : '右'}灶意外熄火！热电偶冷却中，电磁阀即将关闭…`);
  }

  // ---------------- 旋钮角度联动 ----------------
  _applyKnob(side) {
    if (!this.procedural) return;
    const s = this.state[side];
    // 关闭=0；开启时按火力映射 -35° ~ -150°
    const angle = s.on ? THREE.MathUtils.degToRad(-35 - s.power * 115) : 0;
    this.procedural.setKnobAngle(side, angle);
  }

  // ---------------- 燃气流动 ----------------
  _refreshGasFlow() {
    if (this.gasFlows.length === 0) return;
    // 约定：最后一个为总管，其余按 left/right 顺序为支管
    const main = this.gasFlows[this.gasFlows.length - 1];
    const anyOn =
      this.mainValveOpen && (this.state.left.on || this.state.right.on);

    main.setActive(anyOn);
    main.setStrength(
      Math.max(this.state.left.power, this.state.right.power)
    );

    ['left', 'right'].forEach((side, i) => {
      const flow = this.gasFlows[i];
      if (!flow) return;
      const s = this.state[side];
      const active = this.mainValveOpen && s.on;
      flow.setActive(active);
      flow.setStrength(s.power);
    });
  }

  /** 热电偶当前是否已足够热（供自动演示判定） */
  isThermoReady(side) {
    return this.state[side].thermoHeat > 0.95;
  }

  isFlameOn(side) {
    return this.state[side].flameOn;
  }

  isProtected(side) {
    return this.state[side].protection && !this.state[side].on;
  }

  // ---------------- 帧更新 ----------------
  update(dt) {
    for (const side of ['left', 'right']) {
      const s = this.state[side];

      // 点火计时
      if (s.igniting > 0) s.igniting = Math.max(0, s.igniting - dt);

      // 热电偶受热/冷却
      const heatTarget = s.flameOn ? 1 : 0;
      const heatLambda = s.flameOn ? 1.4 : 1 / THERMO_COOLDOWN;
      s.thermoHeat = damp(s.thermoHeat, heatTarget, heatLambda, dt);
      if (this.procedural) {
        this.procedural.setThermocoupleGlow(side, s.thermoHeat);
      }

      // 意外熄火保护：冷却完成 -> 电磁阀断气
      if (s.protection && s.on && s.thermoHeat < 0.08) {
        s.protection = false;
        this._shutOff(side, `🛡 ${side === 'left' ? '左' : '右'}灶热电偶触发熄火保护，电磁阀已自动切断燃气！`);
      }

      // 特效刷新
      s.spark.update(dt);
      if (s.flameOn) {
        s.flame.update(dt, performance.now() / 1000);
        s.smoke.setStrength(s.power);
      }
      s.smoke.update(dt);
    }
  }

  /** 全部复位（停止演示 / 重置按钮） */
  resetAll() {
    ['left', 'right'].forEach((side) => {
      const s = this.state[side];
      s.on = false;
      s.flameOn = false;
      s.igniting = 0;
      s.thermoHeat = 0;
      s.protection = false;
      s.power = 0.6;
      s.flame.setActive(false);
      s.smoke.setActive(false);
      if (this.procedural) {
        this.procedural.setSolenoid(side, 0);
        this.procedural.setThermocoupleGlow(side, 0);
      }
      this._applyKnob(side);
    });
    this.setMainValve(true);
    this.onStatus('系统已复位');
  }

  dispose() {
    ['left', 'right'].forEach((side) => {
      const s = this.state[side];
      // 内置模型的特效由 ProceduralStove.dispose 统一释放
      if (!this.procedural) {
        s.flame.dispose();
        s.smoke.dispose();
        s.spark.dispose();
      }
    });
  }
}
