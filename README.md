# 燃气灶具 3D 仿真教学系统

基于 **Vite + Three.js** 开发的交互式 3D 燃气灶具仿真教学系统。无需任何后端，纯静态资源即可部署，支持在线加载网络 GLB 灶台模型，完整演示燃气灶具的结构原理、点火燃烧与热电偶熄火保护机制。

---

## 一、功能特性

| 模块 | 说明 |
| --- | --- |
| **轨道相机** | OrbitControls 支持 360° 旋转、滚轮缩放、阻尼平移，可转到台面下方观察内部 |
| **剖切透视** | 基于 `THREE.Plane` 全局 ClipPlanes，滑块实时剖切外壳；支持 X / Y / Z 三个方向，带半透明剖切平面指示 |
| **手动仿真** | 左右灶独立控制：旋钮开关、火力调节、点火电火花、GLSL 着色器动态火焰、粒子烟雾 |
| **自动演示** | 一键播放完整工作流：通气 → 旋钮打开 → 点火 → 正常燃烧 → 意外熄火 → 热电偶冷却 → 电磁阀断气保护 |
| **零件标注** | Raycaster 点击任意零件，弹出名称 + 原理介绍卡片，卡片跟随 3D 锚点移动 |
| **侧边控制面板** | 模式切换、剖切滑块/方向、自动旋转、视角重置、GLB 加载、演示播放，全中文 UI |
| **PBR 渲染** | MeshStandardMaterial + RoomEnvironment 环境贴图 + ACES 色调映射 + 软阴影 |

### 特效实现要点

- **动态火焰**：自定义 GLSL ShaderMaterial，Simplex 噪声驱动火焰摇摆与撕裂，沿高度蓝→橙→红渐变，火力实时改变火焰高度/亮度，手动接入 `clipping_planes` 着色器片段支持剖切。
- **粒子烟雾**：Points 粒子系统，CPU 驱动生命周期（生成→上升扩散→淡出），片元着色器绘制柔和圆形。
- **点火电火花**：点火针尖端随机闪烁的蓝白火花 + 点光源脉冲。
- **燃气流动**：沿 CatmullRom 管路曲线运动的发光小球，速度随火力变化。
- **热电偶**：受热时 emissive 发光；熄火后指数冷却，冷却至阈值触发电磁阀机械位移断气。

---

## 二、技术栈与目录结构

```
mode7/
├── index.html                  # 页面骨架（控制面板/标注卡/状态栏的静态结构）
├── package.json
├── vite.config.js              # Vite 配置（base:'./' 相对路径，便于任意子目录部署）
├── public/
│   └── sample-stove.glb        # 测试用 GLB 模型（可删除）
├── scripts/                    # 辅助脚本（非运行必需）
│   ├── make-sample-glb.mjs     # 生成测试 GLB
│   ├── runtime-check.mjs       # 无头浏览器运行时验证
│   ├── demo-check.mjs          # 自动演示流程验证
│   └── glb-check.mjs           # GLB 加载链路验证
└── src/
    ├── main.js                 # 应用入口
    ├── App.js                  # 总装：子系统创建、回调绑定、渲染循环
    ├── styles/main.css         # 全部样式（深色科技风、响应式）
    ├── data/
    │   └── parts.js            # 零件标注知识库 + GLB 网格名称关键字匹配
    ├── utils/
    │   └── mathUtils.js        # lerp / clamp / 阻尼 / 缓动
    ├── ui/
    │   ├── ControlPanel.js     # 侧边面板 DOM 事件与状态回写
    │   └── AnnotationCard.js   # 零件标注卡片（3D 锚点投影跟随）
    └── three/
        ├── SceneManager.js     # 渲染器/场景/相机/轨道控制/灯光/地面
        ├── ClippingManager.js  # 剖切平面与可视化指示面
        ├── ProceduralStove.js  # 内置程序化灶台（13 类标注零件）
        ├── StoveGLTFLoader.js  # 网络 GLB 加载/归一化/零件匹配
        ├── StoveController.js  # 灶具状态机（点火/火力/熄火保护）
        ├── DemoController.js   # 自动演示时间轴
        ├── shaders/
        │   └── noise.glsl.js   # Ashima Simplex 噪声 GLSL
        ├── effects/
        │   ├── Flame.js        # 着色器动态火焰
        │   ├── Smoke.js        # 粒子烟雾
        │   ├── Spark.js        # 电火花
        │   └── GasFlow.js      # 燃气流动小球
        └── Interaction/
            └── Picker.js       # 射线拾取/悬停高亮/拖拽区分
```

---

## 三、环境要求

- **Node.js ≥ 18**（推荐 20 / 22 LTS）
- npm ≥ 9（随 Node 附带）
- 现代浏览器（Chrome / Edge / Firefox 最新版，需支持 WebGL2）

---

## 四、安装与启动

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（默认 http://localhost:5173，自动打开浏览器）
npm run dev

# 3. 生产环境打包（产物输出到 dist/）
npm run build

# 4. 本地预览生产产物（默认 http://localhost:4173）
npm run preview
```

> Windows 下如遇 PowerShell 执行策略限制，可改用 CMD 或在 PowerShell 中执行
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`。

---

## 五、部署指南

### 5.1 纯静态托管（推荐）

项目为纯前端静态应用，`npm run build` 后将整个 **`dist/` 目录**上传到任意静态托管即可：

- Nginx / Apache 静态站点
- 对象存储 + CDN（阿里云 OSS、腾讯云 COS、AWS S3 等）
- Vercel、Netlify、GitHub Pages、Cloudflare Pages

`vite.config.js` 已设置 `base: './'`，产物使用相对路径，**部署在域名子目录下也无需修改配置**。

### 5.2 Nginx 配置示例

```nginx
server {
    listen       80;
    server_name  stove.example.com;
    root         /var/www/gas-stove/dist;   # 指向 dist 目录
    index        index.html;

    # 单页应用静态资源回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 带哈希的静态资源可放心长缓存
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

更新部署后执行 `nginx -s reload`。

### 5.3 GitHub Pages 等子路径部署

由于使用相对路径，直接把 `dist/` 内容推送到 `gh-pages` 分支即可；也可使用：

```bash
npm run build
npx gh-pages -d dist
```

### 5.4 Docker 部署（可选）

```dockerfile
# Dockerfile（放在项目根目录）
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
docker build -t gas-stove-sim .
docker run -d -p 8080:80 gas-stove-sim
# 访问 http://localhost:8080
```

---

## 六、在线加载网络 GLB 模型

### 6.1 使用方法

1. 在右侧面板 **"网络 GLB 模型地址"** 输入完整 URL，例如
   `https://your-cdn.com/models/stove.glb`
2. 点击 **"加载 GLB 模型"**，进度条显示下载进度
3. 加载器会自动将模型居中、归一化到统一观察尺寸，并按网格名称匹配中文零件标注
4. 点击 **"恢复内置教学模型"** 可随时切回内置程序化灶台（含完整特效联动）

### 6.2 模型要求与零件命名

- 格式：**`.glb`**（推荐，单文件自带材质贴图）；glTF 2.0 标准
- 文件建议小于 30 MB，面数控制在 20 万面以内以保证流畅
- 若希望点击零件弹出中文原理，网格命名需包含 `src/data/parts.js` 中 `keywords` 列出的关键字（不区分大小写），例如：
  - 外壳：`case` / `panel` / `外壳`
  - 火盖：`cap` / `burner` / `火盖`
  - 旋钮：`knob` / `dial` / `旋钮`
  - 热电偶：`thermo` / `probe` / `热电`
  - 完整关键字清单见 `src/data/parts.js`，可自行扩充
- 未匹配到关键字的网格仍可点击，会显示网格自身名称并提示去 `parts.js` 补充映射
- 外部 GLB 不携带程序化特效，系统会按模型包围盒自动估算双灶炉头位置并挂载火焰/烟雾/电火花

### 6.3 跨域（CORS）说明

GLB 通过 `fetch` 加载，模型所在服务器必须返回 CORS 头：

```
Access-Control-Allow-Origin: *
# 或指定具体来源：
Access-Control-Allow-Origin: https://stove.example.com
```

- 同站部署（模型放在 `public/models/` 下）不存在跨域问题
- 对象存储需在 Bucket 跨域规则中允许 GET；CDN 需透传 CORS 头
- 本地 `npm run dev` 开发时，如需跨域远程模型，可在 `vite.config.js` 中加 `server.proxy` 代理

### 6.4 自带测试模型

仓库内置 `public/sample-stove.glb`（由 `scripts/make-sample-glb.mjs` 生成）。
部署后在输入框填入 `sample-stove.glb`（相对路径）即可验证 GLB 加载全流程。

---

## 七、操作说明

### 手动模式

1. 确认 **燃气总阀** 处于开启状态
2. 点击左灶/右灶的 **"点火 / 关火"** 按钮（也可直接点击 3D 场景中的旋钮）
3. 拖动 **火力滑块** 调节火焰大小，观察旋钮角度、火焰高度、烟雾浓度与燃气流速联动
4. 点击 **"模拟意外熄火"**：火焰立即消失，热电偶开始冷却，约 3 秒后电磁阀自动断气（教学加速值，真实装置约 10~60 秒）

### 自动演示模式

1. 点击顶部模式切换到 **"自动演示"**
2. 点击 **"▶ 播放演示"**，顶部横幅实时显示当前阶段，进度条同步推进
3. 随时可点击 **"■ 停止复位"** 中断并恢复安全状态

### 剖切与视角

- 拖动 **剖切深度** 滑块切开外壳，观察内部燃气管路、阀体与安全装置
- 切换 **X / Y / Z** 剖切方向；青色半透明面指示当前剖切位置
- 勾选 **自动旋转** 环绕展示；**重置视角** 恢复初始机位与全部状态
- 鼠标左键拖拽旋转、滚轮缩放、右键平移；点击零件查看原理标注

---

## 八、常见问题（FAQ）

**Q：页面黑屏 / 提示 WebGL 初始化失败？**
A：确认浏览器开启硬件加速；虚拟机或远程桌面中 SwiftShader 软渲染也可运行，但性能较低。

**Q：GLB 加载失败？**
A：打开浏览器控制台查看原因，常见为 URL 拼写错误、模型服务器未开启 CORS、或非 glTF 2.0 格式（`.fbx` / `.obj` 需先用 Blender 等工具转换为 GLB）。

**Q：剖切后火焰/烟雾没有被切开？**
A：自定义 ShaderMaterial 默认不响应全局裁剪平面，本项目已在火焰与烟雾着色器中手动引入 `clipping_planes` 片段并开启 `clipping: true`，二者均可正常剖切。

**Q：如何修改自动演示的节奏？**
A：编辑 `src/three/DemoController.js` 顶部的 `TIMELINE` 时间轴节点即可，每个节点包含触发时间 `t`、阶段文案 `stage` 与执行动作 `run`。

**Q：如何更换零件标注内容？**
A：所有中文标注集中在 `src/data/parts.js`，修改 `name` / `desc` 字段；为外部模型补充 `keywords` 即可启用新零件的标注。

---

## 九、开发验证（可选）

仓库附带基于 Chrome DevTools Protocol 的无头浏览器验证脚本（无需安装 Playwright）：

```bash
# 1. 先启动 dev 或 preview 服务
npm run dev

# 2. 另开终端，以远程调试模式启动 Chrome（端口 9333）
#    Windows 示例：
"C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader \
  --no-sandbox --remote-debugging-port=9333 \
  --user-data-dir=/tmp/chrome-test about:blank

# 3. 运行验证
node scripts/runtime-check.mjs   # 初始化/点火/剖切/熄火保护
node scripts/demo-check.mjs      # 自动演示全流程
node scripts/glb-check.mjs       # 网络 GLB 加载链路
```

---

## 十、许可证

教学演示项目，可自由用于课堂教学与二次开发。Simplex 噪声 GLSL 来自 Ashima webgl-noise（MIT）。
