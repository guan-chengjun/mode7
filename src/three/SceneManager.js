import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * SceneManager —— 渲染器 / 场景 / 相机 / 轨道控制 / 灯光 / 地面
 * 全局裁剪平面也在渲染器上统一启用。
 */
export class SceneManager {
  constructor(container) {
    this.container = container;

    // ---- 渲染器（PBR + 全局裁剪） ----
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // 最多支持 2 个全局裁剪平面（本项目仅使用 1 个，预留扩展）
    this.renderer.localClippingEnabled = true;
    container.appendChild(this.renderer.domElement);

    // ---- 场景与环境贴图（PBR 反射来源） ----
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1420);
    this.scene.fog = new THREE.Fog(0x0e1420, 14, 30);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // ---- 相机 ----
    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(5.2, 3.6, 6.4);
    this.defaultCameraPos = this.camera.position.clone();
    this.defaultTarget = new THREE.Vector3(0, 0.7, 0);

    // ---- 轨道相机：360° 旋转、缩放 ----
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.defaultTarget);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 16;
    this.controls.maxPolarAngle = Math.PI * 0.92; // 允许转到台面下方观察内部
    this.controls.autoRotateSpeed = 1.4;
    this.controls.update();

    this._setupLights();
    this._setupGround();

    window.addEventListener('resize', this._onResize.bind(this));
  }

  _setupLights() {
    const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x2a2118, 0.55);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(5, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 25;
    key.shadow.camera.left = -7;
    key.shadow.camera.right = 7;
    key.shadow.camera.top = 7;
    key.shadow.camera.bottom = -7;
    key.shadow.bias = -0.0004;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x88aaff, 0.6);
    fill.position.set(-6, 3, -4);
    this.scene.add(fill);

    const rim = new THREE.PointLight(0x36d1ff, 0.8, 18);
    rim.position.set(0, 2.5, -5);
    this.scene.add(rim);
  }

  _setupGround() {
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x141c2c,
      roughness: 0.92,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 64), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(16, 32, 0x2b4a75, 0x1d2c44);
    grid.position.y = 0;
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    this.scene.add(grid);
  }

  /** 重置相机与轨道控制 */
  resetView() {
    this.camera.position.copy(this.defaultCameraPos);
    this.controls.target.copy(this.defaultTarget);
    this.controls.autoRotate = false;
    this.controls.update();
  }

  setAutoRotate(on) {
    this.controls.autoRotate = on;
  }

  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
