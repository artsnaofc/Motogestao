/**
 * State-of-the-art Unified Cache Management Engine (AppCacheManager)
 * Supports TTL (Time-to-Live), namespace grouping, structural validation,
 * automatic fallback to in-memory store under localStorage quota exhaustion,
 * corruption recovery, and deep diagnostic telemetry.
 */

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

  constructor() {
    this.cleanExpired();
  }

  private getFullKey(key: string): string {
    return key.startsWith(this.prefix) ? key : `${this.prefix}${key}`;
  }

  private getCleanKey(key: string): string {
    return key.startsWith(this.prefix) ? key.substring(this.prefix.length) : key;
  }

  /**
   * Safe string checksum to detect corruption quickly
   */
  private generateChecksum(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  /**
   * Set a cached value with optional TTL (in milliseconds) and namespace grouping
   */
  public set<T>(key: string, value: T, ttlMs?: number, namespace?: string): boolean {
    const fullKey = this.getFullKey(key);
    const meta: CacheMetadata = {
      createdAt: Date.now(),
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
      namespace,
    };

    const envelope: CacheEnvelope<T> = { data: value, meta };

    // 1. Always keep in high-speed memory cache
    this.memoryCache.set(fullKey, envelope);

    // 2. Persist to localStorage with fallback safety
    try {
      const serialized = JSON.stringify(envelope);
      meta.checksum = this.generateChecksum(serialized);
      // Re-serialize with checksum
      localStorage.setItem(fullKey, JSON.stringify({ data: value, meta }));
      return true;
    } catch (error: any) {
      // QuotaExceededError or security restrictions
      console.warn(`[CacheManager] Falha ao gravar '${key}' no localStorage. Usando cache em memória.`, error);
      
      if (error.name === 'QuotaExceededError') {
        this.evictOldest();
        // Retry once after eviction
        try {
          localStorage.setItem(fullKey, JSON.stringify(envelope));
          return true;
        } catch {
          // If still fails, stay purely in-memory
        }
      }
      return false;
    }
  }

  /**
   * Retrieve a cached value, automatically checking for expiration and corruption
   */
  public get<T>(key: string, defaultValue: T | null = null): T | null {
    const fullKey = this.getFullKey(key);

    // 1. Check in-memory first for ultra-fast performance
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

    // 2. Load from localStorage
    try {
      const raw = localStorage.getItem(fullKey);
      if (!raw) {
        this.misses++;
        return defaultValue;
      }

      const envelope = JSON.parse(raw) as CacheEnvelope<T>;

      // Check format
      if (!envelope || !envelope.meta || envelope.data === undefined) {
        throw new Error('Formato do envelope de cache inválido');
      }

      // Check Expiration
      if (this.isExpired(envelope)) {
        this.remove(key);
        this.misses++;
        return defaultValue;
      }

      // Validate checksum if present
      if (envelope.meta.checksum !== undefined) {
        const checkEnv = { data: envelope.data, meta: { ...envelope.meta } };
        delete checkEnv.meta.checksum;
        const computed = this.generateChecksum(JSON.stringify(checkEnv));
        if (computed !== envelope.meta.checksum) {
          console.error(`[CacheManager] Integridade de dados falhou para '${key}'. Cache corrompido.`);
          this.remove(key);
          this.misses++;
          return defaultValue;
        }
      }

      // Sync back to memory cache
      this.memoryCache.set(fullKey, envelope);
      this.hits++;
      return envelope.data;
    } catch (err) {
      console.warn(`[CacheManager] Erro de integridade/parse em '${key}'. Limpando entrada corrompida.`, err);
      this.remove(key);
      this.misses++;
      return defaultValue;
    }
  }

  /**
   * Remove a key from all caching layers
   */
  public remove(key: string): void {
    const fullKey = this.getFullKey(key);
    this.memoryCache.delete(fullKey);
    try {
      localStorage.removeItem(fullKey);
    } catch {
      // ignore
    }
  }

  /**
   * Check if a cache envelope is expired
   */
  private isExpired(envelope: CacheEnvelope<any>): boolean {
    return !!(envelope.meta.expiresAt && Date.now() > envelope.meta.expiresAt);
  }

  /**
   * Evict the oldest item in case of quota exhaustion (LRU simple proxy)
   */
  private evictOldest(): void {
    try {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (let i = 0; i < localStorage.length; i++) {
        const fullKey = localStorage.key(i);
        if (fullKey && fullKey.startsWith(this.prefix)) {
          const raw = localStorage.getItem(fullKey);
          if (raw) {
            try {
              const env = JSON.parse(raw);
              if (env.meta && env.meta.createdAt < oldestTime) {
                oldestTime = env.meta.createdAt;
                oldestKey = fullKey;
              }
            } catch {
              // corrupt entry is a perfect candidate to evict
              oldestKey = fullKey;
              break;
            }
          }
        }
      }

      if (oldestKey) {
        localStorage.removeItem(oldestKey);
        this.memoryCache.delete(oldestKey);
        this.evictions++;
        console.warn(`[CacheManager] Evicção automática realizada para liberar cota: ${oldestKey}`);
      }
    } catch (e) {
      console.error('[CacheManager] Erro ao evictar dados antigos:', e);
    }
  }

  /**
   * Periodically remove expired items
   */
  public cleanExpired(): void {
    try {
      // Clean memory
      for (const [key, env] of this.memoryCache.entries()) {
        if (this.isExpired(env)) {
          this.memoryCache.delete(key);
        }
      }

      // Clean storage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const fullKey = localStorage.key(i);
        if (fullKey && fullKey.startsWith(this.prefix)) {
          const raw = localStorage.getItem(fullKey);
          if (raw) {
            try {
              const env = JSON.parse(raw);
              if (this.isExpired(env)) {
                keysToRemove.push(fullKey);
              }
            } catch {
              keysToRemove.push(fullKey);
            }
          }
        }
      }

      keysToRemove.forEach(k => {
        localStorage.removeItem(k);
        this.memoryCache.delete(k);
      });
    } catch {
      // ignore security restrictions or issues in specific envs
    }
  }

  /**
   * Wipe all keys matching the app prefix or within a specific namespace
   */
  public clear(namespace?: string): void {
    try {
      const keysToRemove: string[] = [];
      
      // Memory Purge
      for (const [key, env] of this.memoryCache.entries()) {
        if (!namespace || env.meta.namespace === namespace) {
          this.memoryCache.delete(key);
        }
      }

      // LocalStorage Purge
      for (let i = 0; i < localStorage.length; i++) {
        const fullKey = localStorage.key(i);
        if (fullKey && fullKey.startsWith(this.prefix)) {
          if (namespace) {
            const raw = localStorage.getItem(fullKey);
            if (raw) {
              try {
                const env = JSON.parse(raw);
                if (env.meta && env.meta.namespace === namespace) {
                  keysToRemove.push(fullKey);
                }
              } catch {
                keysToRemove.push(fullKey);
              }
            }
          } else {
            keysToRemove.push(fullKey);
          }
        }
      }

      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.error('[CacheManager] Erro ao limpar cache:', e);
    }
  }

  /**
   * Return real-time telemetry metrics of our cache performance
   */
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
    } catch {
      // fallback
    }

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
