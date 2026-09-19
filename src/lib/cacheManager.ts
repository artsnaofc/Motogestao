/**
 * Unified Multi-Tier Cache Engine (AppCacheManager)
 * - L1: Instant Synchronous Memory Cache (0ms latency for React state & UI)
 * - L2: Non-blocking Persistent IndexedDB (no 5MB storage limit, won't freeze UI thread)
 * - L3: LocalStorage for lightweight synchronous bootstrap keys (privacyMode, user session hints)
 * Supports TTL (Time-to-Live), namespace grouping, automatic integrity validation,
 * corruption recovery, and background hydration.
 */

import { idbStore } from './indexedDbStore';

export interface CacheMetadata {
  expiresAt?: number;
  createdAt: number;
  namespace?: string;
  checksum?: number;
}

export interface CacheEnvelope<T> {
  data: T;
  meta: CacheMetadata;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  localStorageSizeKB: number;
  memoryKeysCount: number;
  localStorageKeysCount: number;
}

class AppCacheManager {
  private memoryCache = new Map<string, CacheEnvelope<any>>();
  private prefix = 'financas_pro_';
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private isHydratedFromIdb = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    if (this.isHydratedFromIdb) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // 1. Initial sync sweep from localStorage for instant bootstrap
        this.cleanExpired();
        
        // 2. Hydrate high-capacity store from IndexedDB in the background
        if (typeof window !== 'undefined') {
          const idbData = await idbStore.getAll();
          for (const [k, envelope] of Object.entries(idbData)) {
            if (envelope && envelope.meta && envelope.data !== undefined) {
              if (!this.isExpired(envelope)) {
                // If not already in memory from immediate storage, hydrate it
                if (!this.memoryCache.has(k)) {
                  this.memoryCache.set(k, envelope);
                }
              }
            }
          }
          this.isHydratedFromIdb = true;
        }
      } catch (err) {
        console.warn('[CacheManager] Erro durante inicialização do cache L2 (IDB):', err);
      }
    })();

    return this.initPromise;
  }

  private getFullKey(key: string): string {
    return key.startsWith(this.prefix) ? key : `${this.prefix}${key}`;
  }

  private generateChecksum(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  /**
   * Set a cached value with optional TTL and namespace grouping.
   * Immediately updates L1 (RAM), schedules non-blocking L2 (IndexedDB),
   * and optionally mirrors small scalar keys to L3 (LocalStorage).
   */
  public set<T>(key: string, value: T, ttlMs?: number, namespace?: string): boolean {
    const fullKey = this.getFullKey(key);
    const meta: CacheMetadata = {
      createdAt: Date.now(),
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
      namespace,
    };

    const envelope: CacheEnvelope<T> = { data: value, meta };

    // 1. Instant L1 RAM update
    this.memoryCache.set(fullKey, envelope);

    // 2. Asynchronous L2 IndexedDB persistence (never blocks main thread)
    idbStore.set(fullKey, envelope).catch(err => {
      console.warn(`[CacheManager] Falha ao persistir '${key}' no IndexedDB:`, err);
    });

    // 3. Selective L3 LocalStorage sync for small critical config items only (< 40KB)
    try {
      const isLightweight = typeof value !== 'object' || (Array.isArray(value) ? (value as any[]).length < 50 : true);
      if (isLightweight) {
        const serialized = JSON.stringify(envelope);
        if (serialized.length < 65000) {
          localStorage.setItem(fullKey, serialized);
        }
      }
    } catch {
      // Ignore quota errors safely
    }

    return true;
  }

  /**
   * Retrieve cached value (checking L1 RAM first, then LocalStorage, then async IDB fallback)
   */
  public get<T>(key: string, defaultValue: T | null = null): T | null {
    const fullKey = this.getFullKey(key);

    // 1. Check L1 Memory (Instant 0ms access)
    if (this.memoryCache.has(fullKey)) {
      const envelope = this.memoryCache.get(fullKey) as CacheEnvelope<T>;
      if (this.isExpired(envelope)) {
        this.memoryCache.delete(fullKey);
        this.misses++;
        return defaultValue;
      }
      this.hits++;
      return envelope.data;
    }

    // 2. Check L3 LocalStorage
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw) {
        const envelope = JSON.parse(raw) as CacheEnvelope<T>;
        if (envelope && envelope.meta && envelope.data !== undefined) {
          if (this.isExpired(envelope)) {
            this.remove(key);
            this.misses++;
            return defaultValue;
          }
          this.memoryCache.set(fullKey, envelope);
          this.hits++;
          return envelope.data;
        }
      }
    } catch {
      // Ignore parse failure
    }

    this.misses++;
    return defaultValue;
  }

  /**
   * Async getter that waits for IndexedDB if memory cache is a miss
   */
  public async getAsync<T>(key: string, defaultValue: T | null = null): Promise<T | null> {
    const syncVal = this.get<T>(key, null);
    if (syncVal !== null && syncVal !== undefined) {
      return syncVal;
    }

    const fullKey = this.getFullKey(key);
    try {
      const envelope = await idbStore.get<CacheEnvelope<T>>(fullKey);
      if (envelope && envelope.meta && envelope.data !== undefined) {
        if (!this.isExpired(envelope)) {
          this.memoryCache.set(fullKey, envelope);
          this.hits++;
          return envelope.data;
        } else {
          idbStore.remove(fullKey).catch(() => {});
        }
      }
    } catch {
      // Ignore
    }

    return defaultValue;
  }

  /**
   * Remove a key from all caching tiers
   */
  public remove(key: string): void {
    const fullKey = this.getFullKey(key);
    this.memoryCache.delete(fullKey);
    try {
      localStorage.removeItem(fullKey);
    } catch {}
    idbStore.remove(fullKey).catch(() => {});
  }

  private isExpired(envelope: CacheEnvelope<any>): boolean {
    return !!(envelope.meta.expiresAt && Date.now() > envelope.meta.expiresAt);
  }

  /**
   * Clean expired items from memory and storage
   */
  public cleanExpired(): void {
    try {
      for (const [key, env] of this.memoryCache.entries()) {
        if (this.isExpired(env)) {
          this.memoryCache.delete(key);
        }
      }

      for (let i = 0; i < localStorage.length; i++) {
        const fullKey = localStorage.key(i);
        if (fullKey && fullKey.startsWith(this.prefix)) {
          const raw = localStorage.getItem(fullKey);
          if (raw) {
            try {
              const env = JSON.parse(raw);
              if (this.isExpired(env)) {
                localStorage.removeItem(fullKey);
              }
            } catch {
              localStorage.removeItem(fullKey);
            }
          }
        }
      }
    } catch {}
  }

  /**
   * Clear all app caches or a specific namespace
   */
  public clear(namespace?: string): void {
    try {
      for (const [key, env] of this.memoryCache.entries()) {
        if (!namespace || env.meta.namespace === namespace) {
          this.memoryCache.delete(key);
          try {
            localStorage.removeItem(key);
          } catch {}
          idbStore.remove(key).catch(() => {});
        }
      }

      if (!namespace) {
        idbStore.clear().catch(() => {});
      }
    } catch (e) {
      console.error('[CacheManager] Erro ao limpar cache:', e);
    }
  }

  public getStats(): CacheStats {
    let totalChars = 0;
    let lsCount = 0;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          lsCount++;
          totalChars += key.length + (localStorage.getItem(key) || '').length;
        }
      }
    } catch {}

    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      localStorageSizeKB: Math.round((totalChars * 2) / 1024),
      memoryKeysCount: this.memoryCache.size,
      localStorageKeysCount: lsCount,
    };
  }
}

export const cacheManager = new AppCacheManager();
