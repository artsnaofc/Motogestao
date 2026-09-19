/**
 * High-performance, zero-dependency IndexedDB storage engine.
 * Provides non-blocking asynchronous persistence for large structured datasets
 * (transactions, reserves, investments, cache, sync queues) without the 5MB quota
 * limits or main-thread UI blocking of localStorage.
 */

const DB_NAME = 'financas_pro_idb';
const DB_VERSION = 1;
const STORE_NAME = 'app_cache_store';

class IndexedDbStore {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private isAvailable: boolean = true;

  constructor() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      this.isAvailable = false;
    }
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (!this.isAvailable) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = (err) => {
          console.warn('[IDBStore] Não foi possível abrir o IndexedDB, usando fallback:', err);
          this.isAvailable = false;
          resolve(null);
        };

        request.onblocked = () => {
          console.warn('[IDBStore] Abertura do IndexedDB bloqueada por outra aba.');
        };
      } catch (e) {
        console.warn('[IDBStore] Exceção ao abrir IndexedDB:', e);
        this.isAvailable = false;
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  public async set<T>(key: string, value: T): Promise<boolean> {
    const db = await this.getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const record = { key, value, updatedAt: Date.now() };
        const req = store.put(record);

        req.onsuccess = () => resolve(true);
        req.onerror = () => {
          console.warn(`[IDBStore] Erro ao gravar chave '${key}'`);
          resolve(false);
        };
      } catch (e) {
        console.warn(`[IDBStore] Exceção ao gravar chave '${key}':`, e);
        resolve(false);
      }
    });
  }

  public async get<T>(key: string): Promise<T | null> {
    const db = await this.getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          if (req.result && req.result.value !== undefined) {
            resolve(req.result.value as T);
          } else {
            resolve(null);
          }
        };

        req.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }

  public async remove(key: string): Promise<boolean> {
    const db = await this.getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.delete(key);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  public async getAll(): Promise<Record<string, any>> {
    const db = await this.getDB();
    if (!db) return {};

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const results: Record<string, any> = {};
          if (Array.isArray(req.result)) {
            for (const item of req.result) {
              if (item && item.key) {
                results[item.key] = item.value;
              }
            }
          }
          resolve(results);
        };

        req.onerror = () => resolve({});
      } catch {
        resolve({});
      }
    });
  }

  public async clear(): Promise<boolean> {
    const db = await this.getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.clear();

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }
}

export const idbStore = new IndexedDbStore();
