/**
 * 网络 GLB 加载链路验证（CDP）
 * 用法：node scripts/glb-check.mjs
 */
const BASE = 'http://localhost:5173/';
const GLB_URL = 'sample-stove.glb'; // Vite 会从 public 目录提供

const list = await (await fetch('http://localhost:9333/json')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
const errors = [];

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
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  }
};

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: BASE });
await new Promise((r) => setTimeout(r, 5000));

const evalExpr = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

// 触发 GLB 加载（内部为 async，等待完成）
const loaded = await evalExpr(
  `window.__gasStoveApp._loadGLB('${GLB_URL}').then(() => true).catch(e => 'ERR:' + e.message)`
);
await new Promise((r) => setTimeout(r, 2500));

const state = await evalExpr(`(() => {
  const a = window.__gasStoveApp;
  return {
    isProcedural: a.isProcedural,
    modelName: a.currentModel?.name,
    pickables: a._collectPickables().length,
    hasController: !!a.controller,
    burnerPoints: Object.values(a.controller.state).map(s => [
      Number(s.point.x.toFixed(2)), Number(s.point.y.toFixed(2))
    ]),
    overlayHidden: document.getElementById('loading-overlay').classList.contains('hidden'),
    // 加载后点火，验证外部模型特效挂载可用
    status: document.getElementById('status-text').textContent
  };
})()`);

// 外部 GLB 模式下点火
await evalExpr(`window.__gasStoveApp.controller.ignite('left')`);
await new Promise((r) => setTimeout(r, 1200));
const fx = await evalExpr(`(() => {
  const s = window.__gasStoveApp.controller.state.left;
  return { flame: s.flame.group.visible, smoke: s.smoke.points.visible, spark: !!s.spark };
})()`);

// 剖切在 GLB 模型上仍生效
await evalExpr(`window.__gasStoveApp.clipping.setProgress(0.6)`);
const clip = await evalExpr(`window.__gasStoveApp.clipping.helper.visible`);

// 恢复内置模型
await evalExpr(`window.__gasStoveApp._restoreProcedural()`);
const restored = await evalExpr(`window.__gasStoveApp.isProcedural`);

console.log('=== GLB 加载结果 ===');
console.log(JSON.stringify({ loaded, ...state }, null, 2));
console.log('=== GLB 模式特效 ===', JSON.stringify(fx));
console.log('=== GLB 剖切可视化 ===', clip);
console.log('=== 恢复内置模型 ===', restored);
console.log('=== 运行时错误 ===', errors.length ? errors.join('\n') : '(无)');

const pass =
  loaded === true &&
  state.isProcedural === false &&
  state.pickables >= 6 &&
  state.overlayHidden &&
  fx.flame &&
  fx.smoke &&
  clip === true &&
  restored === true &&
  errors.length === 0;

console.log(pass ? '\n✅ GLB 加载链路验证通过' : '\n❌ GLB 链路存在失败项');
process.exit(pass ? 0 : 1);
