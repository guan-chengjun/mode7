import * as THREE from 'three';
import { Flame } from './effects/Flame.js';
import { Smoke } from './effects/Smoke.js';
import { Spark } from './effects/Spark.js';
import { GasFlow } from './effects/GasFlow.js';

/**
 * ProceduralStove —— 内置程序化燃气灶具教学模型
 * ------------------------------------------------------------------
 * 所有网格通过 userData.partKey 关联 data/parts.js 知识库，
 * 点击即可显示名称与原理。模型同时包含：
 *  - 外壳 / 炉架 / 火盖 / 炉头（PBR 材质）
 *  - 内部燃气通路、旋塞阀、电磁阀、喷嘴、热电偶、点火针
 *  - 每侧炉头一套 火焰 / 烟雾 / 电火花 / 燃气流动特效
 */

const BURNER_X = 2.05; // 左右灶 x 坐标
const BURNER_Z = -0.55; // 炉头 z 坐标
const KNOB_Z = 1.42; // 旋钮 z 坐标（前面板）

export class ProceduralStove {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ProceduralGasStove';

    /** 左右灶运行时对象（由 StoveController 使用） */
    this.burners = {};
    /** 旋钮组（控制器旋转它） */
    this.knobs = {};
    /** 热电偶材质（受热发光） */
    this.thermocoupleMats = {};
    /** 电磁阀阀芯（演示时机械移动） */
    this.solenoidPlungers = {};
    /** 燃气流动特效（左右支管 + 总管） */
    this.gasFlows = [];
    /** 全部特效，统一 update/dispose */
    this.effects = [];
    /** 可拾取网格（火焰也在其中） */
    this.pickables = [];

    this._buildMaterials();
    this._buildCase();
    this._buildGasPath();
    this._buildBurner('left', -BURNER_X);
    this._buildBurner('right', BURNER_X);
    this._buildKnob('left', -1.05);
    this._buildKnob('right', 1.05);

    this.group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  // ---------------- 材质 ----------------
  _buildMaterials() {
    this.mats = {
      steel: new THREE.MeshStandardMaterial({
        color: 0xc7ccd4,
        metalness: 0.92,
        roughness: 0.28
      }),
      darkSteel: new THREE.MeshStandardMaterial({
        color: 0x4a525e,
        metalness: 0.85,
        roughness: 0.42
      }),
      glass: new THREE.MeshStandardMaterial({
        color: 0x10151d,
        metalness: 0.2,
        roughness: 0.12,
        envMapIntensity: 1.4
      }),
      castIron: new THREE.MeshStandardMaterial({
        color: 0x1c1f24,
        metalness: 0.7,
        roughness: 0.75
      }),
      brass: new THREE.MeshStandardMaterial({
        color: 0xd8a84b,
        metalness: 0.95,
        roughness: 0.25
      }),
      pipe: new THREE.MeshStandardMaterial({
        color: 0xb8c2cc,
        metalness: 0.9,
        roughness: 0.32
      }),
      rubber: new THREE.MeshStandardMaterial({
        color: 0x2c3038,
        metalness: 0.1,
        roughness: 0.9
      }),
      ceramic: new THREE.MeshStandardMaterial({
        color: 0xf2ede2,
        metalness: 0.05,
        roughness: 0.35
      }),
      red: new THREE.MeshStandardMaterial({
        color: 0xc0392b,
        metalness: 0.6,
        roughness: 0.4
      }),
      blueMark: new THREE.MeshStandardMaterial({
        color: 0x2b7fff,
        emissive: 0x2b7fff,
        emissiveIntensity: 0.9,
        roughness: 0.4
      })
    };
  }

  /** 给网格打上零件标注 key */
  _tag(mesh, partKey) {
    mesh.userData.partKey = partKey;
    this.pickables.push(mesh);
    return mesh;
  }

  // ---------------- 外壳 ----------------
  _buildCase() {
    const W = 5.6;
    const D = 3.4;

    // 底壳
    const base = this._tag(
      new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, D), this.mats.darkSteel),
      'outerCase'
    );
    base.position.y = 0.06;
    this.group.add(base);

    // 四面侧壁（薄板，剖切后可看到内部）
    const wallH = 0.95;
    const t = 0.08;
    const wallDefs = [
      { size: [W, wallH, t], pos: [0, wallH / 2, D / 2 - t / 2] },
      { size: [W, wallH, t], pos: [0, wallH / 2, -D / 2 + t / 2] },
      { size: [t, wallH, D], pos: [W / 2 - t / 2, wallH / 2, 0] },
      { size: [t, wallH, D], pos: [-W / 2 + t / 2, wallH / 2, 0] }
    ];
    wallDefs.forEach((w) => {
      const wall = this._tag(
        new THREE.Mesh(new THREE.BoxGeometry(...w.size), this.mats.steel),
        'outerCase'
      );
      wall.position.set(...w.pos);
      this.group.add(wall);
    });

    // 顶部玻璃面板
    const top = this._tag(
      new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, D), this.mats.glass),
      'outerCase'
    );
    top.position.y = wallH + 0.03;
    this.group.add(top);

    // 承液盘（左右各一）
    [-BURNER_X, BURNER_X].forEach((x) => {
      const tray = this._tag(
        new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.86, 0.04, 48), this.mats.steel),
        'outerCase'
      );
      tray.position.set(x, wallH + 0.08, BURNER_Z);
      this.group.add(tray);
    });
  }

  // ---------------- 内部燃气通路 + 总阀 + 电磁阀 ----------------
  _buildGasPath() {
    // 主进气管（从后壁进入，沿 x 方向铺设）
    const mainPoints = [
      new THREE.Vector3(0, 0.34, -1.55),
      new THREE.Vector3(0, 0.34, -1.0),
      new THREE.Vector3(0, 0.34, 0.55)
    ];
    const mainCurve = new THREE.CatmullRomCurve3(mainPoints);
    const mainTube = this._tag(
      new THREE.Mesh(new THREE.TubeGeometry(mainCurve, 40, 0.055, 14, false), this.mats.pipe),
      'gasPipe'
    );
    this.group.add(mainTube);

    // 燃气总阀（红色手柄球阀，位于进气管入口）
    const valveBody = this._tag(
      new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.24, 20), this.mats.brass),
      'mainValve'
    );
    valveBody.position.set(0, 0.34, -1.28);
    valveBody.rotation.x = Math.PI / 2;
    this.group.add(valveBody);

    const valveHandle = this._tag(
      new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.1), this.mats.red),
      'mainValve'
    );
    valveHandle.position.set(0, 0.52, -1.28);
    this.group.add(valveHandle);
    this.mainValveHandle = valveHandle;

    // 左右支管：总管 -> 旋塞阀 -> 喷嘴
    [-BURNER_X, BURNER_X].forEach((x, idx) => {
      const side = x < 0 ? 'left' : 'right';
      const pts = [
        new THREE.Vector3(0, 0.34, 0.55),
        new THREE.Vector3(x * 0.55, 0.34, 0.62),
        new THREE.Vector3(x, 0.4, 0.78),
        new THREE.Vector3(x, 0.5, BURNER_Z + 0.42),
        new THREE.Vector3(x, 0.62, BURNER_Z + 0.22)
      ];
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = this._tag(
        new THREE.Mesh(new THREE.TubeGeometry(curve, 46, 0.045, 12, false), this.mats.pipe),
        'gasPipe'
      );
      this.group.add(tube);

      // 旋塞阀体
      const body = this._tag(
        new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 20), this.mats.brass),
        'valveBody'
      );
      body.position.set(x, 0.42, 0.75);
      body.rotation.z = Math.PI / 2;
      this.group.add(body);

      // 电磁阀（阀体旁），阀芯 plunger 可机械移动
      const solGroup = new THREE.Group();
      solGroup.position.set(x + (x < 0 ? -0.22 : 0.22), 0.42, 0.75);
      const solShell = this._tag(
        new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 18), this.mats.darkSteel),
        'solenoid'
      );
      solShell.rotation.z = Math.PI / 2;
      solGroup.add(solShell);

      const plunger = this._tag(
        new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 12), this.mats.steel),
        'solenoid'
      );
      plunger.rotation.z = Math.PI / 2;
      solGroup.add(plunger);
      this.group.add(solGroup);
      this.solenoidPlungers[side] = plunger;

      // 喷嘴（伸向炉头引射口）
      const nozzle = this._tag(
        new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.16, 12), this.mats.brass),
        'nozzle'
      );
      nozzle.position.set(x, 0.66, BURNER_Z + 0.24);
      this.group.add(nozzle);

      // 燃气流动小球
      const flow = new GasFlow(curve, 7);
      flow.spheres.forEach((s) => this.group.add(s));
      this.gasFlows.push(flow);
    });

    // 总管流动
    const mainFlow = new GasFlow(mainCurve, 5);
    mainFlow.spheres.forEach((s) => this.group.add(s));
    this.gasFlows.push(mainFlow);
    this.mainGasFlow = mainFlow;
  }

  // ---------------- 炉头 / 火盖 / 炉架 / 点火针 / 热电偶 ----------------
  _buildBurner(side, x) {
    const burnerGroup = new THREE.Group();
    burnerGroup.position.set(x, 0, BURNER_Z);
    this.group.add(burnerGroup);

    // 炉头底座（引射器）
    const baseMesh = this._tag(
      new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.26, 36), this.mats.castIron),
      'burnerBase'
    );
    baseMesh.position.y = 1.08;
    burnerGroup.add(baseMesh);

    // 引射管（水平文丘里管，朝向喷嘴）
    const venturi = this._tag(
      new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.5, 20), this.mats.castIron),
      'burnerBase'
    );
    venturi.rotation.x = Math.PI / 2;
    venturi.position.set(0, 0.98, 0.32);
    burnerGroup.add(venturi);

    // 火盖（分火器，带火孔凸点）
    const cap = this._tag(
      new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.1, 40), this.mats.brass),
      'burnerCap'
    );
    cap.position.y = 1.28;
    burnerGroup.add(cap);

    const capRing = this._tag(
      new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 10, 40), this.mats.darkSteel),
      'burnerCap'
    );
    capRing.rotation.x = Math.PI / 2;
    capRing.position.y = 1.25;
    burnerGroup.add(capRing);

    // 火孔（一圈小圆柱）
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const hole = this._tag(
        new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 8), this.mats.darkSteel),
        'burnerCap'
      );
      hole.position.set(Math.cos(a) * 0.3, 1.3, Math.sin(a) * 0.3);
      burnerGroup.add(hole);
    }

    // 锅支架（十字 + 外圈）
    const grateRing = this._tag(
      new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.045, 10, 44), this.mats.castIron),
      'grate'
    );
    grateRing.rotation.x = Math.PI / 2;
    grateRing.position.y = 1.48;
    burnerGroup.add(grateRing);

    for (let i = 0; i < 4; i++) {
      const arm = this._tag(
        new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.07, 0.1), this.mats.castIron),
        'grate'
      );
      arm.position.y = 1.48;
      arm.rotation.y = (i * Math.PI) / 2;
      burnerGroup.add(arm);
    }

    // 点火针（陶瓷基座 + 金属针，斜向火盖）
    const igniterBase = this._tag(
      new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 12), this.mats.ceramic),
      'igniter'
    );
    igniterBase.position.set(0.42, 1.12, 0.18);
    burnerGroup.add(igniterBase);

    const igniterPin = this._tag(
      new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8), this.mats.steel),
      'igniter'
    );
    igniterPin.position.set(0.4, 1.32, 0.14);
    igniterPin.rotation.z = -0.25;
    burnerGroup.add(igniterPin);
    const sparkTip = new THREE.Vector3(x + 0.37, 1.46, BURNER_Z + 0.11);

    // 热电偶探头（另一侧，金属探针）
    const tcBase = this._tag(
      new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 12), this.mats.brass),
      'thermocouple'
    );
    tcBase.position.set(-0.42, 1.12, 0.18);
    burnerGroup.add(tcBase);

    const tcMat = new THREE.MeshStandardMaterial({
      color: 0xb8862f,
      metalness: 0.95,
      roughness: 0.3,
      emissive: 0xff5500,
      emissiveIntensity: 0
    });
    this.thermocoupleMats[side] = tcMat;
    const probe = this._tag(
      new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 10), tcMat),
      'thermocouple'
    );
    probe.position.set(-0.4, 1.3, 0.14);
    probe.rotation.z = 0.25;
    burnerGroup.add(probe);

    // ---------------- 特效 ----------------
    const flameOrigin = new THREE.Vector3(x, 1.33, BURNER_Z);
    const flame = new Flame(flameOrigin);
    this.group.add(flame.group);
    flame.group.traverse((o) => {
      if (o.isMesh) this.pickables.push(o);
    });

    const smoke = new Smoke(new THREE.Vector3(x, 1.75, BURNER_Z));
    this.group.add(smoke.points);

    const spark = new Spark(sparkTip);
    this.group.add(spark.points);
    this.group.add(spark.light);

    this.effects.push(flame, smoke, spark);
    this.burners[side] = {
      group: burnerGroup,
      flame,
      smoke,
      spark,
      // 热电偶受热值 0~1（控制发光与电磁阀逻辑）
      thermoHeat: 0
    };
  }

  // ---------------- 旋钮 ----------------
  _buildKnob(side, x) {
    const knobGroup = new THREE.Group();
    // 旋钮轴线沿 z（从前面板伸出），绕 z 旋转
    knobGroup.position.set(x, 0.55, KNOB_Z);
    this.group.add(knobGroup);

    const knobBody = this._tag(
      new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.22, 28), this.mats.rubber),
      'knob'
    );
    knobBody.rotation.x = Math.PI / 2;
    knobGroup.add(knobBody);

    // 指示刻线（蓝色，随旋钮转动）
    const mark = this._tag(
      new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.13, 0.03), this.mats.blueMark),
      'knob'
    );
    mark.position.set(0, 0.13, 0.12);
    knobGroup.add(mark);

    // 面板上的火力刻度
    for (let i = 0; i <= 4; i++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.02), this.mats.steel);
      const a = -Math.PI / 2 + (i / 4) * (Math.PI * 0.85);
      tick.position.set(
        x + Math.cos(a) * 0.3,
        0.55 + Math.sin(a) * 0.3,
        KNOB_Z + 0.02
      );
      tick.castShadow = true;
      this.group.add(tick);
    }

    this.knobs[side] = knobGroup;
  }

  // ---------------- 运行时接口（供 StoveController 调用） ----------------
  setKnobAngle(side, angle) {
    if (this.knobs[side]) this.knobs[side].rotation.z = angle;
  }

  setThermocoupleGlow(side, heat01) {
    const mat = this.thermocoupleMats[side];
    if (mat) mat.emissiveIntensity = heat01 * 2.2;
  }

  /** 电磁阀阀芯位置：1=吸合（通气），0=释放（断气） */
  setSolenoid(side, engaged01) {
    const p = this.solenoidPlungers[side];
    if (!p) return;
    const dir = side === 'left' ? -1 : 1;
    p.position.x = dir * (0.02 + engaged01 * 0.07);
  }

  setMainValve(open) {
    // 手柄与管路平行=开，垂直=关
    this.mainValveHandle.rotation.y = open ? 0 : Math.PI / 2;
  }

  /** 统一帧更新 */
  update(dt, elapsed) {
    this.effects.forEach((e) => {
      if (e instanceof Flame) e.update(dt, elapsed);
      else e.update(dt);
    });
    this.gasFlows.forEach((g) => g.update(dt));
  }

  dispose() {
    this.effects.forEach((e) => e.dispose());
    this.gasFlows.forEach((g) => g.dispose());
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.material.userData?.shared) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose && m.dispose());
      }
    });
  }
}
