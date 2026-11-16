/**
 * 无头浏览器运行时验证脚本（CDP，无第三方依赖）
 * 用法：node scripts/runtime-check.mjs
 */
const BASE = 'http://localhost:5173/';

async function getWsUrl() {
  // 新建标签页
  const resp = await fetch(
    `http://localhost:9333/json/new?${encodeURIComponent(BASE)}`,
    { method: 'PUT' }
  ).catch(() => null);
  if (resp) {
    const j = await resp.json();
    return j.webSocketDebuggerUrl;
  }
  // 兼容不支持 PUT /new 的版本
  const list = await (await fetch('http://localhost:9333/json')).json();
  const page = list.find((t) => t.type === 'page');
  return page.webSocketDebuggerUrl;
}

const wsUrl = await getWsUrl();
const ws = new WebSocket(wsUrl);
let msgId = 0;
const pending = new Map();
const errors = [];
const logs = [];

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    const text = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
    logs.push(`[console.${m.params.type}] ${text}`);
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errors.push(d.exception?.description || d.text);
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    errors.push(`${m.params.entry.url || ''} -> ${m.params.entry.text}`);
  }
};

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Page.navigate', { url: BASE });

await new Promise((r) => setTimeout(r, 6000));

const evalExpr = async (expr) => {
  const r = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true
  });
  return r.result?.value;
};

const state = await evalExpr(`(() => {
  const app = window.__gasStoveApp;
  if (!app) return { ok: false, reason: 'App 未创建' };
  const canvas = document.querySelector('#app canvas');
  const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
  return {
    ok: true,
    overlayHidden: document.getElementById('loading-overlay').classList.contains('hidden'),
    canvasSize: canvas ? [canvas.width, canvas.height] : null,
    webgl: !!gl,
    isProcedural: app.isProcedural,
    pickableCount: app._collectPickables().length,
    burnerStates: ['left','right'].map(s => ({
      side: s,
      on: app.controller.state[s].on,
      flameOn: app.controller.state[s].flameOn
    })),
    clippingPlanes: app.sceneMgr.renderer.clippingPlanes.length
  };
})()`);

// 交互冒烟：点火左灶
await evalExpr(`window.__gasStoveApp.controller.ignite('left')`);
await new Promise((r) => setTimeout(r, 1500));
const afterIgnite = await evalExpr(`(() => {
  const s = window.__gasStoveApp.controller.state.left;
  return {
    flameVisible: s.flame.group.visible,
    smokeVisible: s.smoke.points.visible,
    flameStrength: s.flame.strength
  };
})()`);

// 剖切冒烟（75% 深度；模型 X 对称，50% 处 constant 恰为 0）
await evalExpr(`window.__gasStoveApp.clipping.setProgress(0.75)`);
const clipState = await evalExpr(
  `window.__gasStoveApp.clipping.plane.constant.toFixed(3)`
);

// 意外熄火保护冒烟（指数衰减到阈值约需 7 秒，等待 8 秒确保关阀）
await evalExpr(`window.__gasStoveApp.controller.simulateFlameout('left')`);
await new Promise((r) => setTimeout(r, 8000));
const afterProtect = await evalExpr(`(() => {
  const s = window.__gasStoveApp.controller.state.left;
  return { on: s.on, flameOn: s.flameOn, thermoHeat: s.thermoHeat, protection: s.protection };
})()`);

console.log('=== 初始化状态 ===');
console.log(JSON.stringify(state, null, 2));
console.log('=== 点火后 ===');
console.log(JSON.stringify(afterIgnite, null, 2));
console.log('=== 剖切平面 constant（应有限数值）===');
console.log(clipState);
console.log('=== 熄火保护后（on/flameOn 应为 false）===');
console.log(JSON.stringify(afterProtect, null, 2));
console.log('=== 控制台日志 ===');
console.log(logs.join('\n') || '(无)');
console.log('=== 运行时错误 ===');
console.log(errors.length ? errors.join('\n') : '(无错误)');

const pass =
  state?.ok &&
  state.overlayHidden &&
  state.webgl &&
  state.pickableCount > 20 &&
  afterIgnite.flameVisible &&
  afterIgnite.smokeVisible &&
  clipState !== undefined && Number(clipState) !== 0 &&
  afterProtect.on === false &&
  afterProtect.flameOn === false &&
  errors.length === 0;

console.log(pass ? '\n✅ 运行时验证全部通过' : '\n❌ 存在失败项');
process.exit(pass ? 0 : 1);
