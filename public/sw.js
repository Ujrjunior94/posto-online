/* Service Worker para Meu Posto - PWA Offline Completo & Persistência de Formulários */

const STATIC_CACHE_NAME = 'meu-posto-static-v2';
const DYNAMIC_CACHE_NAME = 'meu-posto-dynamic-v2';
const DB_NAME = 'meu-posto-offline-db';
const DB_VERSION = 1;
const STORE_PENDING_FORMS = 'pending_forms';
const STORE_FORM_DRAFTS = 'form_drafts';

// Assets essenciais da aplicação (App Shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/favicon.ico'
];

// Open IndexedDB helper for Service Worker
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_PENDING_FORMS)) {
        db.createObjectStore(STORE_PENDING_FORMS, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_FORM_DRAFTS)) {
        db.createObjectStore(STORE_FORM_DRAFTS, { keyPath: 'formId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Queue form data in IndexedDB when offline
async function queueOfflineForm(data) {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_PENDING_FORMS, 'readwrite');
    const store = tx.objectStore(STORE_PENDING_FORMS);
    const item = {
      url: data.url,
      method: data.method || 'POST',
      headers: data.headers || {},
      body: data.body,
      timestamp: Date.now(),
      status: 'pending'
    };
    await new Promise((resolve, reject) => {
      const req = store.add(item);
      req.onsuccess = resolve;
      req.onerror = reject;
    });
    notifyClients({ type: 'OFFLINE_FORM_QUEUED', timestamp: Date.now() });
    return true;
  } catch (err) {
    console.error('[SW] Erro ao enfileirar formulário offline:', err);
    return false;
  }
}

// Get pending offline forms count
async function getPendingFormsCount() {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_PENDING_FORMS, 'readonly');
    const store = tx.objectStore(STORE_PENDING_FORMS);
    return new Promise((resolve) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch (e) {
    return 0;
  }
}

// Sync queued forms when connection is restored
async function syncOfflineForms() {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_PENDING_FORMS, 'readonly');
    const store = tx.objectStore(STORE_PENDING_FORMS);

    const items = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = reject;
    });

    if (items.length === 0) return 0;

    let syncedCount = 0;
    for (const item of items) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: typeof item.body === 'object' ? JSON.stringify(item.body) : item.body
        });

        if (response.ok || response.status < 500) {
          // Remove successfully synced item from DB
          const deleteTx = db.transaction(STORE_PENDING_FORMS, 'readwrite');
          const deleteStore = deleteTx.objectStore(STORE_PENDING_FORMS);
          await new Promise((res) => {
            const delReq = deleteStore.delete(item.id);
            delReq.onsuccess = res;
            delReq.onerror = res;
          });
          syncedCount++;
        }
      } catch (err) {
        console.warn('[SW] Falha ao reenviar requisição enfileirada:', err);
      }
    }

    notifyClients({ type: 'OFFLINE_SYNC_COMPLETE', syncedCount });
    return syncedCount;
  } catch (err) {
    console.error('[SW] Erro durante sincronização offline:', err);
    return 0;
  }
}

// Notify all connected application window clients
async function notifyClients(message) {
  const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of clientsList) {
    client.postMessage(message);
  }
}

// Install Event - Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Pré-cache de assets estáticos essenciais concluído');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event Handler with Advanced Offline Caching & Form Interception
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Intercept non-GET requests (Form Submissions / POST / PUT) when offline or network fails
  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        let bodyText = '';
        try {
          bodyText = await request.clone().text();
        } catch (e) {
          bodyText = '';
        }

        let parsedBody = bodyText;
        try {
          parsedBody = JSON.parse(bodyText);
        } catch (e) {
          // keep as text if not JSON
        }

        await queueOfflineForm({
          url: request.url,
          method: request.method,
          headers: Array.from(request.headers.entries()).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
          body: parsedBody
        });

        // Return synthetic response so client app handles offline submission gracefully
        return new Response(
          JSON.stringify({
            offline: true,
            success: true,
            queued: true,
            message: 'Sem conexão no momento. Os dados do formulário foram salvos localmente e serão sincronizados automaticamente ao reconectar.'
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // Skip browser extension requests or non-HTTP protocols
  if (!url.protocol.startsWith('http')) return;

  // 2. Navigation Requests (Page Loads / SPA routes) -> Network First with Fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const indexPage = await caches.match('/index.html');
          if (indexPage) return indexPage;
          return caches.match('/');
        })
    );
    return;
  }

  // 3. Static Assets (JS, CSS, SVGs, Fonts, Images, Icons, JSON) -> Cache First with Revalidation
  const isStaticAsset =
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.json');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 4. All other GET requests (API, external assets) -> Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Background Sync Event (Supported in modern browsers)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-forms') {
    event.waitUntil(syncOfflineForms());
  }
});

// Periodic Background Sync Event for silent background data refresh
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-posto-data') {
    console.log('[SW] Sincronização periódica em segundo plano iniciada.');
    event.waitUntil(
      Promise.all([
        // Sincronizar dados pendentes salvos localmente
        syncOfflineForms(),
        // Pré-carregar / atualizar silenciosamente o App Shell estático
        caches.open(STATIC_CACHE_NAME).then((cache) => {
          console.log('[SW] Revalidando silenciosamente os assets estáticos no background.');
          return cache.addAll(STATIC_ASSETS);
        }).catch((err) => {
          console.warn('[SW] Falha ao revalidar assets estáticos no background:', err);
        })
      ]).then(() => {
        console.log('[SW] Sincronização periódica em segundo plano concluída com sucesso!');
        notifyClients({ type: 'PERIODIC_SYNC_SUCCESS', timestamp: Date.now() });
      })
    );
  }
});

// Client Message Communication Handler
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.action === 'SYNC_OFFLINE_FORMS') {
    syncOfflineForms().then((count) => {
      event.ports?.[0]?.postMessage({ success: true, syncedCount: count });
    });
  } else if (data.action === 'GET_PENDING_COUNT') {
    getPendingFormsCount().then((count) => {
      event.ports?.[0]?.postMessage({ count });
    });
  } else if (data.action === 'QUEUE_FORM_DATA') {
    queueOfflineForm(data.payload).then((success) => {
      event.ports?.[0]?.postMessage({ success });
    });
  }
});
