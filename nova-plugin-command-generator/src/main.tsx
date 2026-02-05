import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { attachGlobalErrorListeners, logError } from './utils/telemetry';

attachGlobalErrorListeners();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Service Worker 注册：仅在生产环境启用
// 开发环境禁用 SW 以避免 HMR 资源缓存问题（普通刷新无法获取最新资源）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      logError(error, { source: 'serviceWorker.register' });
    });
  });
} else if ('serviceWorker' in navigator && import.meta.env.DEV) {
  // 开发环境：清理已注册的 Service Worker，确保 HMR 正常工作
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });
}
