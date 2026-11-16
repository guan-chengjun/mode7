/**
 * 生成教学用测试 GLB 模型（仅开发/测试用途）
 * 输出到 public/sample-stove.glb，供"加载 GLB"功能联调。
 * 用法：node scripts/make-sample-glb.mjs
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Node 环境下 GLTFExporter 二进制导出所需的最小 FileReader polyfill
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend?.({ target: this });
      });
    }
  };
}

const stove = new THREE.Group();
stove.name = 'GasStoveGLB';

const steel = new THREE.MeshStandardMaterial({ color: 0xb9c0ca, metalness: 0.9, roughness: 0.35 });
const iron = new THREE.MeshStandardMaterial({ color: 0x22262c, metalness: 0.7, roughness: 0.7 });
const brass = new THREE.MeshStandardMaterial({ color: 0xd8a84b, metalness: 0.95, roughness: 0.25 });

// 外壳面板 outerCase
const panel = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.1, 3.0), steel);
panel.name = 'outerCase_panel';
panel.position.y = 0.9;
stove.add(panel);

// 两个炉头 burner + 火盖 burnerCap + 管路 gasPipe
[-1.6, 1.6].forEach((x, i) => {
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.24, 32), iron);
  burner.name = `burnerBase_${i}`;
  burner.position.set(x, 1.05, -0.4);
  stove.add(burner);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.08, 32), brass);
  cap.name = `burnerCap_${i}`;
  cap.position.set(x, 1.22, -0.4);
  stove.add(cap);

  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 12), steel);
  pipe.name = `gasPipe_${i}`;
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(x, 0.4, 0.6);
  stove.add(pipe);
});

// 旋钮 knob
[-0.9, 0.9].forEach((x, i) => {
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.2, 24), iron);
  knob.name = `knob_${i}`;
  knob.rotation.x = Math.PI / 2;
  knob.position.set(x, 0.55, 1.35);
  stove.add(knob);
});

const exporter = new GLTFExporter();
const glb = await new Promise((resolve, reject) => {
  exporter.parse(stove, resolve, reject, { binary: true });
});
const buffer = Buffer.from(glb);
const out = 'public/sample-stove.glb';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buffer);
console.log(`✅ 测试 GLB 已生成：${out}（${(buffer.length / 1024).toFixed(1)} KB）`);
