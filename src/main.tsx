import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Helper to register Periodic Background Sync for quiet background synchronization
async function registerPeriodicBackgroundSync(reg: ServiceWorkerRegistration) {
  if ('periodicSync' in reg) {
    try {
      // Query permission for periodic-background-sync (usually granted automatically when PWA is installed)
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync' as any,
      });

      if (status.state === 'granted') {
        await (reg as any).periodicSync.register('sync-posto-data', {
          // Solicitamos sincronização a cada 12 horas para otimizar bateria e dados
          minInterval: 12 * 60 * 60 * 1000,
        });
        console.log('[PWA] Periodic Background Sync ("sync-posto-data") registrado com sucesso!');
      } else {
        console.log('[PWA] Sincronização periódica suspensa. Requer instalação PWA ou permissão explícita: status =', status.state);
      }
    } catch (error) {
      console.warn('[PWA] Não foi possível registrar o Periodic Background Sync:', error);
    }
  } else {
    console.log('[PWA] O navegador atual não suporta a API de Periodic Background Sync.');
  }
}

// Register Progressive Web App (PWA) Service Worker with robust offline form sync
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker de alta disponibilidade registrado:', reg.scope);

        // Registrar o Periodic Background Sync de dados
        registerPeriodicBackgroundSync(reg);

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

