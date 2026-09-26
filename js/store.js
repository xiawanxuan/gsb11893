// IndexedDB 持久化：保存生命周期事件，刷新后可恢复时间线
const DB_NAME = 'lc-lifecycle-demo';
const DB_VERSION = 1;
const STORE = 'events';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return resolve(null);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;
function db() {
  if (!dbPromise) dbPromise = openDB().catch(() => null);
  return dbPromise;
}

export const Store = {
  async add(entry) {
    const d = await db();
    if (!d) return;
    return new Promise((resolve) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add(entry);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  },
  async all() {
    const d = await db();
    if (!d) return [];
    return new Promise((resolve) => {
      const tx = d.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  },
  async clear() {
    const d = await db();
    if (!d) return;
    return new Promise((resolve) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  },
};
