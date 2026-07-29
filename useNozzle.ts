/**
 * Helper para Gerenciamento e Sincronização Offline de Formulários via Service Worker & IndexedDB
 */

const DB_NAME = 'meu-posto-offline-db';
const DB_VERSION = 1;
const STORE_FORM_DRAFTS = 'form_drafts';

// Abrir banco IndexedDB local
export function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('pending_forms')) {
        db.createObjectStore('pending_forms', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_FORM_DRAFTS)) {
        db.createObjectStore(STORE_FORM_DRAFTS, { keyPath: 'formId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Salva um rascunho de formulário no IndexedDB local para não perder o preenchimento se a página recarregar sem internet
 */
export async function saveFormDraft(formId: string, data: Record<string, any>): Promise<boolean> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_FORM_DRAFTS, 'readwrite');
    const store = tx.objectStore(STORE_FORM_DRAFTS);
    await new Promise((resolve, reject) => {
      const req = store.put({
        formId,
        data,
        updatedAt: Date.now()
      });
      req.onsuccess = resolve;
      req.onerror = reject;
    });
    return true;
  } catch (err) {
    console.error('Erro ao salvar rascunho de formulário offline:', err);
    return false;
  }
}

/**
 * Recupera um rascunho de formulário previamente salvo offline
 */
export async function getFormDraft<T = Record<string, any>>(formId: string): Promise<T | null> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_FORM_DRAFTS, 'readonly');
    const store = tx.objectStore(STORE_FORM_DRAFTS);
    const result = await new Promise<any>((resolve) => {
      const req = store.get(formId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return result ? (result.data as T) : null;
  } catch (err) {
    return null;
  }
}

/**
 * Remove o rascunho do formulário após envio com sucesso
 */
export async function clearFormDraft(formId: string): Promise<boolean> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_FORM_DRAFTS, 'readwrite');
    const store = tx.objectStore(STORE_FORM_DRAFTS);
    await new Promise((resolve) => {
      const req = store.delete(formId);
      req.onsuccess = resolve;
      req.onerror = resolve;
    });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Solicita a contagem de formulários pendentes enfileirados no Service Worker
 */
export function getPendingFormsCountSW(): Promise<number> {
  return new Promise((resolve) => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      resolve(0);
      return;
    }

    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      resolve(event.data?.count || 0);
    };

    navigator.serviceWorker.controller.postMessage(
      { action: 'GET_PENDING_COUNT' },
      [channel.port2]
    );
  });
}

/**
 * Envia comando ao Service Worker para ressincronizar formulários guardados offline
 */
export function triggerOfflineFormsSync(): Promise<{ success: boolean; syncedCount: number }> {
  return new Promise((resolve) => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      resolve({ success: false, syncedCount: 0 });
      return;
    }

    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      resolve(event.data || { success: true, syncedCount: 0 });
    };

    navigator.serviceWorker.controller.postMessage(
      { action: 'SYNC_OFFLINE_FORMS' },
      [channel.port2]
    );
  });
}
