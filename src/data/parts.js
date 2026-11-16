/**
 * 零件标注知识库
 * ------------------------------------------------------------------
 * key 与 three/ProceduralStove.js 中网格的 userData.partKey 对应。
 * 外部 GLB 模型按网格名称关键字（keywords）模糊匹配，匹配不到时
 * 由交互层回退为显示网格自身名称。
 */
export const PART_INFO = {
  outerCase: {
    name: '灶台外壳（面板）',
    keywords: ['case', 'shell', 'panel', 'body', '外壳', '面板', '壳体'],
    desc: '不锈钢/钢化玻璃面板与承液盘，是灶具的承载结构。通过剖切平面可以切开外壳，观察内部的燃气管路与安全装置布局。'
  },
  grate: {
    name: '锅支架（炉架）',
    keywords: ['grate', 'stand', 'support', '支架', '炉架', '锅架'],
    desc: '铸铁锅支架用于承托炊具，并使锅底与火盖保持最佳燃烧距离，保证二次空气补给，提高燃烧效率。'
  },
  burnerCap: {
    name: '火盖（分火器）',
    keywords: ['cap', 'burner', '火盖', '分火器', '炉头'],
    desc: '火盖上均匀分布火孔，将燃气与一次空气的混合气均匀分配到各火孔燃烧，形成环形稳定火焰。'
  },
  burnerBase: {
    name: '炉头（燃烧器底座）',
    keywords: ['base', '炉头', '底座', '燃烧器'],
    desc: '炉头是燃烧器主体，内部设有引射器（文丘里管）：燃气高速喷出时在喷嘴周围形成负压，自动吸入一次空气并预混。'
  },
  nozzle: {
    name: '喷嘴',
    keywords: ['nozzle', 'injector', 'jet', '喷嘴', '喷咀'],
    desc: '喷嘴将燃气以高速射流喷入引射器，孔径大小决定燃气流量，是决定热负荷（火力大小）的关键零件。'
  },
  gasPipe: {
    name: '燃气通路（进气管）',
    keywords: ['pipe', 'tube', 'gas', '管路', '气管', '进气'],
    desc: '燃气经总阀、阀体分配后由进气管送往左右两个喷嘴。蓝色流动小球演示燃气在管路中的输送方向。'
  },
  mainValve: {
    name: '燃气总阀（球阀）',
    keywords: ['main', 'ball', '总阀', '球阀', '阀门'],
    desc: '燃气入户后的第一道手动切断阀，手柄与管路平行时开启、垂直时关闭。演示第一步"通气"即打开此阀，检修或长期离家时应手动关闭。'
  },
  valveBody: {
    name: '旋塞阀（阀体）',
    keywords: ['valve', 'cock', '阀体', '旋塞'],
    desc: '旋钮带动旋塞阀芯转动，改变燃气通道开度，从而控制开、关与火力大小。阀体上还集成了熄火保护用的电磁阀。'
  },
  knob: {
    name: '控制旋钮',
    keywords: ['knob', 'dial', '旋钮', '开关'],
    desc: '按压并逆时针旋转旋钮即可打开旋塞阀并触发压电点火；继续旋转改变阀芯开度调节火力。仿真中点击旋钮可直接点火/关火。'
  },
  igniter: {
    name: '点火针（压电点火器）',
    keywords: ['ignit', 'spark', 'piezo', '点火', '火花塞'],
    desc: '点火针在旋钮按压时产生高压电火花（仿真中的蓝色闪光），点燃火孔处喷出的燃气-空气混合气。'
  },
  thermocouple: {
    name: '热电偶（熄火保护探头）',
    keywords: ['thermo', 'couple', 'probe', '热电', '探头', '感应针'],
    desc: '热电偶受热产生热电势，维持电磁阀吸合通气。意外熄火后探头冷却（约数秒），热电势消失，弹簧顶开电磁阀自动切断燃气，防止泄漏——即熄火保护装置。'
  },
  solenoid: {
    name: '电磁阀（安全切断阀）',
    keywords: ['solenoid', 'magnet', '电磁', '安全阀'],
    desc: '点火时需手动按压数秒，待热电偶受热产生足够电势后才能吸合保持；熄火后失电释放，机械弹簧关闭气路，实现断气保护。'
  },
  flame: {
    name: '动态火焰（着色器仿真）',
    keywords: ['flame', 'fire', '火焰'],
    desc: '火焰由自定义 GLSL 着色器驱动：Simplex 噪声产生湍流抖动，沿高度由蓝→橙→红渐变并逐渐透明，火力大小实时改变火焰高度与亮度。'
  },
  smoke: {
    name: '烟雾（粒子系统）',
    keywords: ['smoke', '雾', '烟'],
    desc: 'GPU/CPU 混合粒子系统：粒子从火焰上方持续生成、上升、扩散并淡出，模拟不完全燃烧产生的烟雾，火力越大烟雾越明显。'
  }
};

/**
 * 根据网格名称匹配零件知识库（外部 GLB 使用）
 * @param {string} meshName
 * @returns {{key:string, info:object}|null}
 */
export function matchPartByName(meshName) {
  if (!meshName) return null;
  const lower = meshName.toLowerCase();
  for (const [key, info] of Object.entries(PART_INFO)) {
    if (info.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return { key, info };
    }
  }
  return null;
}
