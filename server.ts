import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Helper function to fetch Yahoo Finance quotes (Server-side: Ultra-fast Spark Batch + Chart v8)
  async function fetchYahooQuotesServer(tickers: string[]): Promise<{
    quotes: Record<string, number>;
    variations: Record<string, number>;
    timestamps: Record<string, string>;
    details: any[];
  }> {
    const quotes: Record<string, number> = {};
    const variations: Record<string, number> = {};
    const timestamps: Record<string, string> = {};
    const details: any[] = [];
    const cleanTickers = Array.from(new Set(tickers.map(t => t.trim().toUpperCase()))).filter(Boolean);

    if (cleanTickers.length === 0) return { quotes, variations, timestamps, details };

    // Build symbol mappings (handles fractional shares e.g. PETR4F -> PETR4.SA, Crypto, US stocks, B3)
    const symbolToTickers = new Map<string, string[]>();
    const querySymbols: string[] = [];

    cleanTickers.forEach(raw => {
      let querySym = raw;
      // Handle Brazilian fractional shares (e.g. PETR4F -> PETR4.SA)
      if (raw.length === 6 && raw.endsWith('F') && /\dF$/.test(raw)) {
        querySym = `${raw.slice(0, 5)}.SA`;
      } else if (raw === 'BTC' || raw === 'BITCOIN') {
        querySym = 'BTC-USD';
      } else if (raw === 'ETH' || raw === 'ETHEREUM') {
        querySym = 'ETH-USD';
      } else if (!raw.includes('.') && !raw.includes('-')) {
        // Standard B3 ticker (e.g. PETR4, MXRF11, AAPL34, IVVB11)
        querySym = `${raw}.SA`;
      }

      if (!symbolToTickers.has(querySym)) {
        symbolToTickers.set(querySym, []);
        querySymbols.push(querySym);
      }
      symbolToTickers.get(querySym)!.push(raw);
    });

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    };

    // Primary: Yahoo Spark Batch Endpoint (Ultra-fast, 100% reliable for B3 and global assets in a single HTTP call)
    const sparkHosts = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
    for (const host of sparkHosts) {
      if (querySymbols.length === 0) break;
      try {
        const url = `${host}/v7/finance/spark?symbols=${encodeURIComponent(querySymbols.join(','))}&range=1d&interval=1d`;
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(4000) });

        if (res.ok) {
          const data = await res.json();
          const results = data?.spark?.result || [];

          results.forEach((item: any) => {
            const sym = (item.symbol || '').toUpperCase();
            const meta = item.response?.[0]?.meta;
            const price = meta?.regularMarketPrice || meta?.fulldayPrice || meta?.chartPreviousClose;
            const change = meta?.regularMarketChangePercent !== undefined 
              ? Number(meta.regularMarketChangePercent) 
              : (meta?.fulldayChangePercent !== undefined ? Number(meta.fulldayChangePercent) : 0);
            const marketTime = meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString();

            if (typeof price === 'number' && price > 0) {
              const matchingTickers = symbolToTickers.get(sym) || [sym.replace('.SA', '')];
              matchingTickers.forEach(t => {
                quotes[t] = Number(price.toFixed(4));
                variations[t] = Number(change.toFixed(2));
                timestamps[t] = marketTime;
                details.push({
                  ticker: t,
                  price: quotes[t],
                  change: variations[t],
                  provider: 'Yahoo Finance (Spark Batch)',
                  updatedAt: marketTime,
                });
              });
            }
          });
          break; // Successfully fetched batch
        }
      } catch (err: any) {
        console.warn(`[Server Quotes] Falha no host ${host} spark:`, err?.message || err);
      }
    }

    // Secondary: Individual Yahoo v8 chart endpoint for any missing tickers
    const missing = cleanTickers.filter(t => !quotes[t] || quotes[t] <= 0);
    if (missing.length > 0) {
      await Promise.all(
        missing.map(async (ticker) => {
          let ySym = ticker;
          if (ticker.length === 6 && ticker.endsWith('F') && /\dF$/.test(ticker)) {
            ySym = `${ticker.slice(0, 5)}.SA`;
          } else if (!ticker.includes('.') && !ticker.includes('-')) {
            ySym = `${ticker}.SA`;
          }

          for (const host of sparkHosts) {
            try {
              const chartUrl = `${host}/v8/finance/chart/${ySym}?interval=1d&range=1d`;
              const res = await fetch(chartUrl, { headers, signal: AbortSignal.timeout(3000) });

              if (res.ok) {
                const data = await res.json();
                const meta = data?.chart?.result?.[0]?.meta;
                const price = meta?.regularMarketPrice || meta?.chartPreviousClose;
                const prevClose = meta?.chartPreviousClose || meta?.previousClose;
                let change = 0;
                if (typeof price === 'number' && typeof prevClose === 'number' && prevClose > 0) {
                  change = Number((((price - prevClose) / prevClose) * 100).toFixed(2));
                }
                const quoteTime = meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString();

                if (typeof price === 'number' && price > 0) {
                  quotes[ticker] = Number(price.toFixed(4));
                  variations[ticker] = change;
                  timestamps[ticker] = quoteTime;
                  details.push({
                    ticker,
                    price: quotes[ticker],
                    change,
                    provider: 'Yahoo Finance (Chart v8)',
                    updatedAt: quoteTime,
                  });
                  break;
                }
              }
            } catch {
              // try next host
            }
          }
        })
      );
    }

    return { quotes, variations, timestamps, details };
  }

  // Helper function to fetch mFinance quotes (Server-side: Specialized in FIIs and Ações B3)
  async function fetchMFinanceServer(tickers: string[]): Promise<{
    quotes: Record<string, number>;
    variations: Record<string, number>;
    timestamps: Record<string, string>;
    details: any[];
  }> {
    const quotes: Record<string, number> = {};
    const variations: Record<string, number> = {};
    const timestamps: Record<string, string> = {};
    const details: any[] = [];

    await Promise.all(
      tickers.map(async (ticker) => {
        let cleanTicker = ticker.trim().toUpperCase();
        if (cleanTicker.length === 6 && cleanTicker.endsWith('F') && /\dF$/.test(cleanTicker)) {
          cleanTicker = cleanTicker.slice(0, 5);
        }

        const isLikelyFii = cleanTicker.endsWith('11') || cleanTicker.includes('FII');
        const urls = isLikelyFii
          ? [
              `https://mfinance.com.br/api/v1/fiis/${cleanTicker}`,
              `https://mfinance.com.br/api/v1/stocks/${cleanTicker}`,
            ]
          : [
              `https://mfinance.com.br/api/v1/stocks/${cleanTicker}`,
              `https://mfinance.com.br/api/v1/fiis/${cleanTicker}`,
            ];

        for (const url of urls) {
          try {
            const res = await fetch(url, {
              headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
              signal: AbortSignal.timeout(3500),
            });
            if (res.ok) {
              const data = await res.json();
              const price = data?.lastPrice || data?.closingPrice || data?.price;
              if (typeof price === 'number' && price > 0) {
                const now = new Date().toISOString();
                const change = typeof data?.change === 'number' ? Number(data.change.toFixed(2)) : 0;
                
                quotes[ticker] = Number(price.toFixed(4));
                variations[ticker] = change;
                timestamps[ticker] = now;

                // Also map to cleanTicker if user searched fractional
                if (ticker !== cleanTicker) {
                  quotes[cleanTicker] = quotes[ticker];
                  variations[cleanTicker] = variations[ticker];
                  timestamps[cleanTicker] = now;
                }

                details.push({
                  ticker,
                  price: quotes[ticker],
                  change,
                  provider: isLikelyFii ? 'mFinance (FIIs B3)' : 'mFinance (Ações B3)',
                  updatedAt: now,
                });
                break;
              }
            }
          } catch {
            // continue to next URL
          }
        }
      })
    );

    return { quotes, variations, timestamps, details };
  }

  // Helper function to fetch Brapi quotes (Server-side)
  async function fetchBrapiServer(tickers: string[], token?: string): Promise<{
    quotes: Record<string, number>;
    variations: Record<string, number>;
    timestamps: Record<string, string>;
    details: any[];
  }> {
    const quotes: Record<string, number> = {};
    const variations: Record<string, number> = {};
    const timestamps: Record<string, string> = {};
    const details: any[] = [];
    const cleanTickers = tickers.map(t => t.trim().toUpperCase()).filter(Boolean);

    if (cleanTickers.length === 0) return { quotes, variations, timestamps, details };

    const BATCH_SIZE = 10;
    const batches: string[][] = [];
    for (let i = 0; i < cleanTickers.length; i += BATCH_SIZE) {
      batches.push(cleanTickers.slice(i, i + BATCH_SIZE));
    }

    await Promise.all(
      batches.map(async (batch) => {
        const query = batch.join(',');
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
        const url = `https://brapi.dev/api/quote/${query}${tokenParam}`;

        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            const data = await res.json();
            const results = data?.results || [];
            results.forEach((item: any) => {
              const sym = (item.symbol || '').toUpperCase();
              const price = item.regularMarketPrice || item.price;
              if (sym && typeof price === 'number' && price > 0) {
                const now = item.regularMarketTime ? new Date(item.regularMarketTime).toISOString() : new Date().toISOString();
                const change = item.regularMarketChangePercent !== undefined ? Number(item.regularMarketChangePercent.toFixed(2)) : 0;
                
                quotes[sym] = Number(price.toFixed(4));
                variations[sym] = change;
                timestamps[sym] = now;

                details.push({
                  ticker: sym,
                  price: quotes[sym],
                  change,
                  provider: 'Brapi (Server)',
                  updatedAt: now,
                });
              }
            });
          }
        } catch {
          // ignore batch failure
        }
      })
    );

    return { quotes, variations, timestamps, details };
  }

  // --- In-Memory High Performance Quote Cache ---
  interface ServerQuoteCacheEntry {
    ticker: string;
    price: number;
    change: number;
    updatedAt: string;
    provider: string;
    cachedAt: number;
  }

  const quoteMemoryCache = new Map<string, ServerQuoteCacheEntry>();
  const DEFAULT_QUOTE_CACHE_TTL_MS = 60 * 1000; // 60s cache TTL

  function getCachedQuote(ticker: string, forceRefresh = false, ttlMs = DEFAULT_QUOTE_CACHE_TTL_MS): ServerQuoteCacheEntry | null {
    if (forceRefresh) return null;
    const clean = ticker.trim().toUpperCase();
    const entry = quoteMemoryCache.get(clean);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > ttlMs) {
      quoteMemoryCache.delete(clean);
      return null;
    }
    return entry;
  }

  function setCachedQuote(ticker: string, price: number, change: number, provider: string, updatedAt: string) {
    if (typeof price === 'number' && price > 0) {
      const clean = ticker.trim().toUpperCase();
      quoteMemoryCache.set(clean, {
        ticker: clean,
        price,
        change,
        provider,
        updatedAt: updatedAt || new Date().toISOString(),
        cachedAt: Date.now(),
      });
    }
  }

  // Cache stats and management endpoints
  app.get('/api/quotes/cache', (req, res) => {
    const entries = Array.from(quoteMemoryCache.values()).map(e => ({
      ticker: e.ticker,
      price: e.price,
      change: e.change,
      provider: e.provider,
      updatedAt: e.updatedAt,
      ageSeconds: Math.round((Date.now() - e.cachedAt) / 1000),
      expiresInSeconds: Math.max(0, Math.round((DEFAULT_QUOTE_CACHE_TTL_MS - (Date.now() - e.cachedAt)) / 1000)),
    }));

    res.json({
      totalCached: entries.length,
      ttlSeconds: DEFAULT_QUOTE_CACHE_TTL_MS / 1000,
      entries,
    });
  });

  app.all('/api/quotes/clear-cache', (req, res) => {
    const count = quoteMemoryCache.size;
    quoteMemoryCache.clear();
    res.json({ success: true, clearedEntries: count, message: 'Cache de cotações esvaziado com sucesso.' });
  });

  // Quotes API endpoint
  app.get('/api/quotes', async (req, res) => {
    const startTime = performance.now();
    const tickersParam = (req.query.tickers as string) || '';
    const providerParam = ((req.query.provider as string) || 'auto').toLowerCase();
    const tokenParam = (req.query.token as string) || process.env.BRAPI_TOKEN || '';
    const forceRefresh = req.query.refresh === 'true' || req.query.forceRefresh === 'true';

    const tickers = Array.from(new Set(
      tickersParam
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean)
    ));

    if (tickers.length === 0) {
      return res.json({
        quotes: {},
        variations: {},
        timestamps: {},
        providerUsed: 'Nenhum ticker fornecido',
        durationMs: 0,
        successCount: 0,
        failedCount: 0,
        cacheStats: { hits: 0, misses: 0, totalCached: quoteMemoryCache.size },
        details: [],
      });
    }

    let finalQuotes: Record<string, number> = {};
    let finalVariations: Record<string, number> = {};
    let finalTimestamps: Record<string, string> = {};
    let allDetails: any[] = [];
    let providerUsed = 'Multi-Fonte B3 (Alta Confiabilidade)';

    // Step 1: Check memory cache first (sub-millisecond resolution)
    const missingTickers: string[] = [];
    let cacheHits = 0;

    for (const ticker of tickers) {
      const cached = getCachedQuote(ticker, forceRefresh);
      if (cached) {
        finalQuotes[ticker] = cached.price;
        finalVariations[ticker] = cached.change;
        finalTimestamps[ticker] = cached.updatedAt;
        allDetails.push({
          ticker,
          price: cached.price,
          change: cached.change,
          provider: `${cached.provider} (Cache Servidor)`,
          updatedAt: cached.updatedAt,
          cached: true,
        });
        cacheHits++;
      } else {
        missingTickers.push(ticker);
      }
    }

    // Step 2: Fetch only uncached/missing tickers from external network providers
    if (missingTickers.length > 0) {
      if (providerParam === 'brapi') {
        providerUsed = 'Brapi API (Servidor)';
        const brapiResult = await fetchBrapiServer(missingTickers, tokenParam);
        Object.assign(finalQuotes, brapiResult.quotes);
        Object.assign(finalVariations, brapiResult.variations);
        Object.assign(finalTimestamps, brapiResult.timestamps);
        allDetails.push(...brapiResult.details);

        for (const [sym, price] of Object.entries(brapiResult.quotes)) {
          setCachedQuote(sym, price, brapiResult.variations[sym] || 0, 'Brapi API', brapiResult.timestamps[sym] || new Date().toISOString());
        }
      } else if (providerParam === 'mfinance') {
        providerUsed = 'mFinance B3 (Servidor)';
        const mfinanceResult = await fetchMFinanceServer(missingTickers);
        Object.assign(finalQuotes, mfinanceResult.quotes);
        Object.assign(finalVariations, mfinanceResult.variations);
        Object.assign(finalTimestamps, mfinanceResult.timestamps);
        allDetails.push(...mfinanceResult.details);

        for (const [sym, price] of Object.entries(mfinanceResult.quotes)) {
          setCachedQuote(sym, price, mfinanceResult.variations[sym] || 0, 'mFinance B3', mfinanceResult.timestamps[sym] || new Date().toISOString());
        }
      } else if (providerParam === 'yahoo') {
        providerUsed = 'Yahoo Finance B3 (Servidor)';
        const yahooResult = await fetchYahooQuotesServer(missingTickers);
        Object.assign(finalQuotes, yahooResult.quotes);
        Object.assign(finalVariations, yahooResult.variations);
        Object.assign(finalTimestamps, yahooResult.timestamps);
        allDetails.push(...yahooResult.details);

        for (const [sym, price] of Object.entries(yahooResult.quotes)) {
          setCachedQuote(sym, price, yahooResult.variations[sym] || 0, 'Yahoo Finance', yahooResult.timestamps[sym] || new Date().toISOString());
        }
      } else {
        // AUTO CASCADE MODE:
        // Stage 1. Yahoo Finance Spark Batch (~150ms)
        const yahooResult = await fetchYahooQuotesServer(missingTickers);
        Object.assign(finalQuotes, yahooResult.quotes);
        Object.assign(finalVariations, yahooResult.variations);
        Object.assign(finalTimestamps, yahooResult.timestamps);
        allDetails.push(...yahooResult.details);

        for (const [sym, price] of Object.entries(yahooResult.quotes)) {
          setCachedQuote(sym, price, yahooResult.variations[sym] || 0, 'Yahoo Finance', yahooResult.timestamps[sym] || new Date().toISOString());
        }

        // Stage 2. If any tickers missing, try mFinance
        const missing1 = missingTickers.filter(t => !finalQuotes[t] || finalQuotes[t] <= 0);
        if (missing1.length > 0) {
          const mfinanceResult = await fetchMFinanceServer(missing1);
          Object.assign(finalQuotes, mfinanceResult.quotes);
          Object.assign(finalVariations, mfinanceResult.variations);
          Object.assign(finalTimestamps, mfinanceResult.timestamps);
          allDetails.push(...mfinanceResult.details);

          for (const [sym, price] of Object.entries(mfinanceResult.quotes)) {
            setCachedQuote(sym, price, mfinanceResult.variations[sym] || 0, 'mFinance B3', mfinanceResult.timestamps[sym] || new Date().toISOString());
          }
        }

        // Stage 3. If still missing, try Brapi
        const missing2 = missingTickers.filter(t => !finalQuotes[t] || finalQuotes[t] <= 0);
        if (missing2.length > 0) {
          const brapiResult = await fetchBrapiServer(missing2, tokenParam);
          Object.assign(finalQuotes, brapiResult.quotes);
          Object.assign(finalVariations, brapiResult.variations);
          Object.assign(finalTimestamps, brapiResult.timestamps);
          allDetails.push(...brapiResult.details);

          for (const [sym, price] of Object.entries(brapiResult.quotes)) {
            setCachedQuote(sym, price, brapiResult.variations[sym] || 0, 'Brapi API', brapiResult.timestamps[sym] || new Date().toISOString());
          }
        }
      }
    }

    const durationMs = Math.round(performance.now() - startTime);
    const successCount = tickers.filter(t => typeof finalQuotes[t] === 'number' && finalQuotes[t] > 0).length;
    const failedCount = tickers.length - successCount;

    // Fill details for failed ones
    tickers.forEach(t => {
      if (!finalQuotes[t] || finalQuotes[t] <= 0) {
        allDetails.push({
          ticker: t,
          price: 0,
          provider: providerUsed,
          updatedAt: new Date().toISOString(),
          error: 'Cotação não encontrada nas fontes de mercado',
        });
      }
    });

    res.json({
      quotes: finalQuotes,
      variations: finalVariations,
      timestamps: finalTimestamps,
      providerUsed: cacheHits === tickers.length ? 'Cache em Memória (Ultra Rápido)' : providerUsed,
      durationMs,
      successCount,
      failedCount,
      cacheStats: {
        hits: cacheHits,
        misses: missingTickers.length,
        totalCached: quoteMemoryCache.size,
        hitRatio: tickers.length > 0 ? `${Math.round((cacheHits / tickers.length) * 100)}%` : '0%',
      },
      details: allDetails,
    });
  });

  // Single Quote endpoint with Cache-First
  app.get('/api/quote/:ticker', async (req, res) => {
    const rawTicker = (req.params.ticker || '').trim().toUpperCase();
    const forceRefresh = req.query.refresh === 'true' || req.query.forceRefresh === 'true';

    if (!rawTicker) {
      return res.status(400).json({ error: 'Ticker obrigatório' });
    }

    // Check memory cache first
    const cached = getCachedQuote(rawTicker, forceRefresh);
    if (cached) {
      return res.json({
        ticker: rawTicker,
        price: cached.price,
        change: cached.change,
        updatedAt: cached.updatedAt,
        provider: `${cached.provider} (Cache Servidor)`,
        cached: true,
      });
    }

    // Try Yahoo Spark/Chart first
    const yahoo = await fetchYahooQuotesServer([rawTicker]);
    if (yahoo.quotes[rawTicker]) {
      setCachedQuote(rawTicker, yahoo.quotes[rawTicker], yahoo.variations[rawTicker] || 0, 'Yahoo Finance', yahoo.timestamps[rawTicker]);
      return res.json({
        ticker: rawTicker,
        price: yahoo.quotes[rawTicker],
        change: yahoo.variations[rawTicker],
        updatedAt: yahoo.timestamps[rawTicker],
        provider: 'Yahoo Finance',
        cached: false,
      });
    }

    // Try mFinance
    const mfinance = await fetchMFinanceServer([rawTicker]);
    if (mfinance.quotes[rawTicker]) {
      setCachedQuote(rawTicker, mfinance.quotes[rawTicker], mfinance.variations[rawTicker] || 0, 'mFinance', mfinance.timestamps[rawTicker]);
      return res.json({
        ticker: rawTicker,
        price: mfinance.quotes[rawTicker],
        change: mfinance.variations[rawTicker],
        updatedAt: mfinance.timestamps[rawTicker],
        provider: 'mFinance',
        cached: false,
      });
    }

    // Try Brapi
    const brapi = await fetchBrapiServer([rawTicker], req.query.token as string);
    if (brapi.quotes[rawTicker]) {
      setCachedQuote(rawTicker, brapi.quotes[rawTicker], brapi.variations[rawTicker] || 0, 'Brapi', brapi.timestamps[rawTicker]);
      return res.json({
        ticker: rawTicker,
        price: brapi.quotes[rawTicker],
        change: brapi.variations[rawTicker],
        updatedAt: brapi.timestamps[rawTicker],
        provider: 'Brapi',
        cached: false,
      });
    }

    res.status(404).json({ error: `Cotação não encontrada para o ticker ${rawTicker}` });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MotoGestão Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
