/**
 * 自动演示全流程验证（CDP）
 * 用法：node scripts/demo-check.mjs
 */
const BASE = 'http://localhost:5173/';

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
  (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value;

// 播放演示
await evalExpr(`window.__gasStoveApp._playDemo()`);

// 在关键时间点采样（累计等待）
// 注：无头 SwiftShader 软件渲染帧率较低，演示时钟约为墙钟的 0.7 倍，
// 因此墙钟采样点按 1.45 系数放宽；真实浏览器中演示严格按时间轴执行。
const checkTimes = [2.2, 5.8, 13.7, 19, 30, 34];
const samples = [];
let prevT = 0;
for (const t of checkTimes) {
  await new Promise((r) => setTimeout(r, (t - prevT) * 1000));
  prevT = t;
  const snap = await evalExpr(`(() => {
    const a = window.__gasStoveApp;
    const s = a.controller.state.left;
    return {
      t: ${t},
      demoElapsed: Number(a.demo.elapsed.toFixed(1)),
      demoRunning: a.demo.running,
      mainValve: a.controller.mainValveOpen,
      burnerOn: s.on,
      flame: s.flameOn,
      heat: Number(s.thermoHeat.toFixed(2))
    };
  })()`);
  samples.push(snap);
}

console.log('=== 演示各阶段采样（含演示时钟 elapsed）===');
samples.forEach((s) => console.log(JSON.stringify(s)));

// 按演示内部时钟 elapsed 校验逻辑正确性
const byElapsed = (e) => samples.find((s) => s.demoElapsed >= e);
const checks = [
  ['通气后总阀开启', byElapsed(1)?.mainValve === true],
  ['点火后火焰燃烧', byElapsed(4)?.flame === true && byElapsed(4)?.burnerOn === true],
  ['燃烧中热电偶受热', (byElapsed(9)?.heat ?? 0) > 0.95],
  ['意外熄火后火焰消失、仍供气', byElapsed(13)?.flame === false && byElapsed(13)?.burnerOn === true],
  ['保护动作后自动断气', byElapsed(18)?.burnerOn === false],
  ['演示结束自动停止', samples[samples.length - 1].demoRunning === false]
];

let pass = errors.length === 0;
checks.forEach(([name, ok]) => {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (!ok) pass = false;
});

console.log(errors.length ? `错误：${errors.join('\n')}` : '运行时错误：(无)');
console.log(pass ? '\n✅ 自动演示全流程验证通过' : '\n❌ 演示流程存在失败项');
process.exit(pass ? 0 : 1);
