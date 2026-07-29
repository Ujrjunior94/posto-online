import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Progressive Web App (PWA) Service Worker with robust offline form sync
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker de alta disponibilidade registrado:', reg.scope);

        // Register Background Sync if supported by browser
        window.addEventListener('online', () => {
          if ('sync' in reg) {
            (reg as any).sync.register('sync-offline-forms')
              .catch((err: any) => console.log('[PWA] Fallback de sync via mensagem:', err));
          }
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ action: 'SYNC_OFFLINE_FORMS' });
          }
        });
      })
      .catch((err) => {
        console.error('[PWA] Erro ao registrar o Service Worker:', err);
      });
  });
}

