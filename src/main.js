import './styles/main.css';
import { App } from './App.js';

/**
 * 应用入口
 * 燃气灶具 3D 仿真教学系统
 */
function bootstrap() {
  try {
    window.__gasStoveApp = new App();
  } catch (err) {
    console.error('系统初始化失败：', err);
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) {
      loadingText.textContent = `初始化失败：${err.message}`;
    }  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
