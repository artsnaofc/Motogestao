import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || '';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || '';

if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn('Supabase URL is missing or using placeholder. Please check your environment variables.');
}

/**
 * Lightweight, privacy-safe Supabase request & egress monitor.
 * Tracks request counts, timestamps, and detects query bursts without storing sensitive data.
 */
interface RequestLogEntry {
  timestamp: number;
  url: string;
  method: string;
  status?: number;
  durationMs: number;
  estimatedBytes: number;
}

class SupabaseRequestMonitor {
  private logs: RequestLogEntry[] = [];
  private maxLogs = 100;
  private totalRequests = 0;
  private totalBytesEstimated = 0;
  private burstWindowMs = 5000;
  private burstThreshold = 15;
  private listeners: (() => void)[] = [];

  public recordRequest(entry: RequestLogEntry) {
    this.totalRequests++;
    this.totalBytesEstimated += entry.estimatedBytes;
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Check for rapid query bursts
    const now = Date.now();
    const recentCount = this.logs.filter(l => now - l.timestamp < this.burstWindowMs).length;
    if (recentCount >= this.burstThreshold && process.env.NODE_ENV !== 'production') {
      console.warn(`[Supabase Monitor] ATENÇÃO: Detectada rajada de consultas (${recentCount} requisições nos últimos ${this.burstWindowMs / 1000}s).`);
    }

    this.listeners.forEach(fn => {
      try { fn(); } catch {}
    });
  }

  public getStats() {
    const now = Date.now();
    const lastMinuteCount = this.logs.filter(l => now - l.timestamp < 60000).length;
    const last5sCount = this.logs.filter(l => now - l.timestamp < 5000).length;

    return {
      totalRequests: this.totalRequests,
      totalBytesEstimated: this.totalBytesEstimated,
      requestsLastMinute: lastMinuteCount,
      requestsLast5s: last5sCount,
      recentLogs: this.logs.slice(0, 20),
    };
  }

  public resetStats() {
    this.logs = [];
    this.totalRequests = 0;
    this.totalBytesEstimated = 0;
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const supabaseRequestMonitor = new SupabaseRequestMonitor();

// Wrap global fetch to observe Supabase traffic transparently
const monitoredFetch: typeof fetch = async (input, init) => {
  const urlStr = typeof input === 'string' ? input : (input as Request).url || '';
  const isSupabaseRequest = Boolean(
    supabaseUrl && urlStr.includes(supabaseUrl)
  );

  if (!isSupabaseRequest) {
    return fetch(input, init);
  }

  const startTime = performance.now();
  const method = init?.method || 'GET';

  try {
    const response = await fetch(input, init);
    const durationMs = Math.round(performance.now() - startTime);

    // Approximate response size for monitoring egress
    let sizeEstimate = 0;
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      sizeEstimate = parseInt(contentLength, 10) || 0;
    } else {
      // Conservative estimate based on typical REST row size
      sizeEstimate = 350;
    }

    // Sanitize URL to remove query parameters with potential user inputs
    let cleanUrl = urlStr;
    try {
      const u = new URL(urlStr);
      cleanUrl = `${u.pathname}${u.search ? '?' + u.search.split('&').map(p => p.split('=')[0]).join('&') : ''}`;
    } catch {}

    supabaseRequestMonitor.recordRequest({
      timestamp: Date.now(),
      url: cleanUrl,
      method,
      status: response.status,
      durationMs,
      estimatedBytes: sizeEstimate,
    });

    return response;
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime);
    supabaseRequestMonitor.recordRequest({
      timestamp: Date.now(),
      url: urlStr.split('?')[0],
      method,
      status: 0,
      durationMs,
      estimatedBytes: 0,
    });
    throw err;
  }
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: monitoredFetch,
      headers: {
        'x-client-info': 'motogestao-optimized/2.0',
      },
    },
  }
);
