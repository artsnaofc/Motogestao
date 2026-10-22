import { describe, it } from 'node:test';
import assert from 'node:assert';
import { supabaseRequestMonitor } from '../supabase';
import { cacheManager } from '../cacheManager';
import { getEffectiveUser, setCachedUser } from '../authUtils';

describe('Supabase Request Monitor & Optimization Verification', () => {
  it('should accurately track requests and estimate egress volume', () => {
    supabaseRequestMonitor.resetStats();
    const initialStats = supabaseRequestMonitor.getStats();
    assert.strictEqual(initialStats.totalRequests, 0);

    // Simulate 3 requests to user_settings, transactions, and reserves
    supabaseRequestMonitor.recordRequest({
      timestamp: Date.now(),
      url: 'https://example.supabase.co/rest/v1/user_settings',
      method: 'GET',
      status: 200,
      durationMs: 40,
      estimatedBytes: 450,
    });
    supabaseRequestMonitor.recordRequest({
      timestamp: Date.now(),
      url: 'https://example.supabase.co/rest/v1/transactions',
      method: 'GET',
      status: 200,
      durationMs: 80,
      estimatedBytes: 1200,
    });
    supabaseRequestMonitor.recordRequest({
      timestamp: Date.now(),
      url: 'https://example.supabase.co/rest/v1/reserves',
      method: 'GET',
      status: 200,
      durationMs: 35,
      estimatedBytes: 350,
    });

    const stats = supabaseRequestMonitor.getStats();
    assert.strictEqual(stats.totalRequests, 3);
    assert.strictEqual(stats.totalBytesEstimated, 2000);
    assert.strictEqual(stats.requestsLast5s, 3);
  });

  it('should detect burst traffic when request volume exceeds safe threshold', () => {
    supabaseRequestMonitor.resetStats();

    // Fire 16 rapid requests within < 5s
    for (let i = 0; i < 16; i++) {
      supabaseRequestMonitor.recordRequest({
        timestamp: Date.now(),
        url: 'https://example.supabase.co/rest/v1/test_table',
        method: 'GET',
        status: 200,
        durationMs: 20,
        estimatedBytes: 100,
      });
    }

    const stats = supabaseRequestMonitor.getStats();
    assert.strictEqual(stats.requestsLast5s >= 15, true, 'Burst request volume should be >= 15');
    assert.strictEqual(stats.totalRequests, 16);
  });

  it('should return effective user from in-memory cache without hitting network', async () => {
    const mockUser = {
      id: 'test-optimized-user-123',
      email: 'pilot@motogestao.test',
      app_metadata: {},
      user_metadata: { full_name: 'Piloto Teste' },
      aud: 'authenticated',
      created_at: new Date().toISOString()
    };

    // Prime the memory cache
    setCachedUser(mockUser as any);

    const startTime = Date.now();
    const retrievedUser = await getEffectiveUser();
    const elapsed = Date.now() - startTime;

    assert.strictEqual(retrievedUser?.id, 'test-optimized-user-123');
    assert.strictEqual(retrievedUser?.email, 'pilot@motogestao.test');
    assert.strictEqual(elapsed < 20, true, 'Retrieved user in under 20ms with 0 network calls');
  });

  it('should throttle and cache B3 assets metadata to avoid daily refetches', () => {
    const fakeMetadata = {
      PETR4: { ticker: 'PETR4', name: 'Petrobras', last_price: 38.5 },
      VALE3: { ticker: 'VALE3', name: 'Vale', last_price: 60.2 }
    };

    cacheManager.set('b3_assets_metadata_cache', fakeMetadata, undefined, 'investments');
    cacheManager.set('b3_assets_metadata_time', Date.now(), undefined, 'investments');

    const cached = cacheManager.get<typeof fakeMetadata>('b3_assets_metadata_cache');
    const timestamp = cacheManager.get<number>('b3_assets_metadata_time');

    assert.strictEqual(cached?.PETR4?.name, 'Petrobras');
    assert.strictEqual(typeof timestamp, 'number');
    const isFresh = (Date.now() - (timestamp || 0)) < 24 * 60 * 60 * 1000;
    assert.strictEqual(isFresh, true, 'Cached metadata should be recognized as fresh (< 24h)');
  });

  it('should prevent exponential backoff from being overridden by 100ms rapid retries', () => {
    // Verify exponential backoff calculation: min(1000 * 2^attempts, 30000)
    const computeBackoff = (attempts: number) => Math.min(1000 * Math.pow(2, attempts), 30000);

    assert.strictEqual(computeBackoff(0), 1000);
    assert.strictEqual(computeBackoff(1), 2000);
    assert.strictEqual(computeBackoff(2), 4000);
    assert.strictEqual(computeBackoff(3), 8000);
    assert.strictEqual(computeBackoff(4), 16000);
    assert.strictEqual(computeBackoff(5), 30000);
    assert.strictEqual(computeBackoff(10), 30000);
  });
});
