const DATABASE_NAME = 'smart-reader-offline';
const DATABASE_VERSION = 2;
const DOCUMENT_STORE = 'documents';
const APP_STATE_STORE = 'app-state';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DOCUMENT_STORE)) {
        database.createObjectStore(DOCUMENT_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(APP_STATE_STORE)) {
        database.createObjectStore(APP_STATE_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open offline storage.'));
    request.onblocked = () => reject(new Error('Offline storage is blocked by another tab.'));
  });
}

async function withStore(mode, operation, storeName = DOCUMENT_STORE) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);
    let result;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error || new Error('Offline storage request failed.'));
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Offline storage transaction failed.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Offline storage transaction was interrupted.'));
    };
  });
}

export function getStoredDocuments() {
  return withStore('readonly', (store) => store.getAll());
}

export function getStoredDocument(id) {
  return withStore('readonly', (store) => store.get(id));
}

export function saveStoredDocument(book, file = book.file) {
  if (!file) return Promise.reject(new Error('The PDF file is missing.'));
  const record = { ...book, file };
  delete record.url;
  return withStore('readwrite', (store) => store.put(record));
}

export function deleteStoredDocument(id) {
  return withStore('readwrite', (store) => store.delete(id));
}

export async function getAppState(key) {
  const record = await withStore('readonly', (store) => store.get(key), APP_STATE_STORE);
  return record?.value;
}

export function saveAppState(key, value) {
  return withStore('readwrite', (store) => store.put({ key, value, updatedAt: Date.now() }), APP_STATE_STORE);
}

export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    // Browsers may decline persistence; IndexedDB still remains available.
  }
  return false;
}

export async function getStorageEstimate() {
  try {
    if (navigator.storage?.estimate) return await navigator.storage.estimate();
  } catch {
    // Storage estimates are informational only.
  }
  return { usage: 0, quota: 0 };
}
