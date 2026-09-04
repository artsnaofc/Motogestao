export type QuoteProvider = 'auto' | 'yahoo' | 'brapi' | 'mfinance' | 'hgbrasil';

export interface QuoteDetail {
  ticker: string;
  price: number;
  provider: string;
  updatedAt: string;
  change?: number;
  previousClose?: number;
  error?: string;
  isStale?: boolean;
}

export interface QuoteFetchResult {
  quotes: Record<string, number>;
  variations?: Record<string, number>;
  timestamps?: Record<string, string>;
  providerUsed: string;
  durationMs: number;
  successCount: number;
  failedCount: number;
  details: QuoteDetail[];
}

export interface FetchQuotesOptions {
  provider?: QuoteProvider;
  brapiToken?: string;
  hgKey?: string;
  existingQuotes?: Record<string, number>;
  timeoutMs?: number;
  forceRefresh?: boolean;
}

// Normalize ticker and base ticker for fractional B3 shares (e.g. PETR4F -> PETR4)
export function getBaseTicker(raw: string): string {
  const clean = raw.trim().toUpperCase();
  if (clean.length === 6 && clean.endsWith('F') && /\dF$/.test(clean)) {
    return clean.slice(0, 5);
  }
  return clean;
}

// Helper to fetch with timeout
async function fetchWithTimeout(url: string, timeoutMs: number = 6000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// 0. Primary Full-Stack API (/api/quotes - Server Proxy with Yahoo Spark, mFinance, Brapi)
async function fetchServerQuotes(
  tickers: string[],
  options: FetchQuotesOptions = {}
): Promise<QuoteFetchResult | null> {
  try {
    const cleanTickers = Array.from(new Set(tickers.map(t => t.trim().toUpperCase()))).filter(Boolean);
    if (cleanTickers.length === 0) return null;

    const queryParams = new URLSearchParams({
      tickers: cleanTickers.join(','),
      provider: options.provider || 'auto',
    });

    if (options.brapiToken) {
      queryParams.append('token', options.brapiToken);
    }
    if (options.forceRefresh) {
      queryParams.append('force', 'true');
    }

    const res = await fetchWithTimeout(`/api/quotes?${queryParams.toString()}`, options.timeoutMs || 8000);
    if (!res.ok) {
      console.warn(`[QuoteService] Servidor /api/quotes retornou HTTP ${res.status}`);
      return null;
    }

    const data: QuoteFetchResult = await res.json();
    return data;
  } catch (err: any) {
    console.warn('[QuoteService] Falha ao conectar na API local /api/quotes, acionando fallback cliente:', err?.message || err);
    return null;
  }
}

// 1. BRAPI Provider (Client Fallback)
async function fetchBrapiQuotes(
  tickers: string[],
  token?: string,
  timeoutMs: number = 6000
): Promise<{ quotes: Record<string, number>; variations: Record<string, number>; timestamps: Record<string, string>; details: QuoteDetail[] }> {
  const quotes: Record<string, number> = {};
  const variations: Record<string, number> = {};
  const timestamps: Record<string, string> = {};
  const details: QuoteDetail[] = [];
  const cleanTickers = Array.from(new Set(tickers.map(t => t.trim().toUpperCase()))).filter(Boolean);

  if (cleanTickers.length === 0) return { quotes, variations, timestamps, details };

  const BATCH_SIZE = 10;
  const batches: string[][] = [];
  for (let i = 0; i < cleanTickers.length; i += BATCH_SIZE) {
    batches.push(cleanTickers.slice(i, i + BATCH_SIZE));
  }

  await Promise.all(
    batches.map(async (batch) => {
      // Query base tickers for fractional shares
      const queryList = batch.map(getBaseTicker);
      const tickerQuery = Array.from(new Set(queryList)).join(',');
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
      const url = `https://brapi.dev/api/quote/${tickerQuery}${tokenParam}`;

      try {
        const res = await fetchWithTimeout(url, timeoutMs);
        if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
        const data = await res.json();

        const results: any[] = data.results || [];
        results.forEach((item: any) => {
          const symbol = (item.symbol || '').toUpperCase();
          const price = item.regularMarketPrice || item.price;
          if (symbol && typeof price === 'number' && price > 0) {
            const now = item.regularMarketTime ? new Date(item.regularMarketTime).toISOString() : new Date().toISOString();
            const change = item.regularMarketChangePercent !== undefined ? Number(item.regularMarketChangePercent.toFixed(2)) : 0;
            
            // Map to original requested tickers that match this base
            batch.forEach(reqTicker => {
              if (getBaseTicker(reqTicker) === symbol || reqTicker === symbol) {
                quotes[reqTicker] = Number(price.toFixed(4));
                variations[reqTicker] = change;
                timestamps[reqTicker] = now;
                details.push({
                  ticker: reqTicker,
                  price: quotes[reqTicker],
                  change,
                  provider: 'Brapi (Direto)',
                  updatedAt: now,
                });
              }
            });
          }
        });
      } catch (err: any) {
        // Try individual tickers as fallback
        for (const singleTicker of batch) {
          try {
            const base = getBaseTicker(singleTicker);
            const singleUrl = `https://brapi.dev/api/quote/${base}${tokenParam}`;
            const res = await fetchWithTimeout(singleUrl, Math.floor(timeoutMs / 2));
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const item = data.results?.[0];
            const price = item?.regularMarketPrice || item?.price;
            if (typeof price === 'number' && price > 0) {
              const now = new Date().toISOString();
              const change = item?.regularMarketChangePercent !== undefined ? Number(item.regularMarketChangePercent.toFixed(2)) : 0;
              quotes[singleTicker] = Number(price.toFixed(4));
              variations[singleTicker] = change;
              timestamps[singleTicker] = now;
              details.push({
                ticker: singleTicker,
                price: quotes[singleTicker],
                change,
                provider: 'Brapi (Single)',
                updatedAt: now,
              });
            }
          } catch (e: any) {
            details.push({
              ticker: singleTicker,
              price: 0,
              provider: 'Brapi',
              updatedAt: new Date().toISOString(),
              error: e?.message || 'Requer Token Brapi para este ticker',
            });
          }
        }
      }
    })
  );

  return { quotes, variations, timestamps, details };
}

// 2. MFINANCE Provider (Client Fallback - Specialized for FIIs & B3 Stocks)
async function fetchMFinanceQuotes(
  tickers: string[],
  timeoutMs: number = 6000
): Promise<{ quotes: Record<string, number>; variations: Record<string, number>; timestamps: Record<string, string>; details: QuoteDetail[] }> {
  const quotes: Record<string, number> = {};
  const variations: Record<string, number> = {};
  const timestamps: Record<string, string> = {};
  const details: QuoteDetail[] = [];

  await Promise.all(
    tickers.map(async (t) => {
      const cleanTicker = t.trim().toUpperCase();
      const baseTicker = getBaseTicker(cleanTicker);
      const isFii = baseTicker.endsWith('11');

      // Fixed: Active mFinance URLs are /api/v1/fiis/TICKER and /api/v1/stocks/TICKER (NOT /quote/)
      const primaryUrl = isFii
        ? `https://mfinance.com.br/api/v1/fiis/${baseTicker}`
        : `https://mfinance.com.br/api/v1/stocks/${baseTicker}`;
      const fallbackUrl = isFii
        ? `https://mfinance.com.br/api/v1/stocks/${baseTicker}`
        : `https://mfinance.com.br/api/v1/fiis/${baseTicker}`;

      try {
        let res = await fetchWithTimeout(primaryUrl, Math.floor(timeoutMs / 2)).catch(() => null);
        if (!res || !res.ok) {
          res = await fetchWithTimeout(fallbackUrl, Math.floor(timeoutMs / 2)).catch(() => null);
        }

        if (res && res.ok) {
          const data = await res.json();
          const price = data?.lastPrice || data?.closingPrice || data?.price;
          if (typeof price === 'number' && price > 0) {
            const now = new Date().toISOString();
            const change = typeof data?.change === 'number' ? Number(data.change.toFixed(2)) : 0;

            quotes[cleanTicker] = Number(price.toFixed(4));
            variations[cleanTicker] = change;
            timestamps[cleanTicker] = now;

            if (cleanTicker !== baseTicker) {
              quotes[baseTicker] = quotes[cleanTicker];
              variations[baseTicker] = change;
              timestamps[baseTicker] = now;
            }

            details.push({
              ticker: cleanTicker,
              price: quotes[cleanTicker],
              change,
              provider: isFii ? 'mFinance (FII)' : 'mFinance (Ações)',
              updatedAt: now,
            });
            return;
          }
        }
        throw new Error('Preço indisponível no mFinance');
      } catch (e: any) {
        details.push({
          ticker: cleanTicker,
          price: 0,
          provider: 'mFinance',
          updatedAt: new Date().toISOString(),
          error: e?.message || 'Erro mFinance',
        });
      }
    })
  );

  return { quotes, variations, timestamps, details };
}

// 3. YAHOO FINANCE Provider (Client Proxy Fallback)
async function fetchYahooQuotes(
  tickers: string[],
  timeoutMs: number = 7000
): Promise<{ quotes: Record<string, number>; variations: Record<string, number>; timestamps: Record<string, string>; details: QuoteDetail[] }> {
  const quotes: Record<string, number> = {};
  const variations: Record<string, number> = {};
  const timestamps: Record<string, string> = {};
  const details: QuoteDetail[] = [];

  await Promise.all(
    tickers.map(async (t) => {
      const cleanTicker = t.trim().toUpperCase();
      const baseTicker = getBaseTicker(cleanTicker);
      const yahooSymbol = baseTicker.includes('.') || baseTicker.includes('-') ? baseTicker : `${baseTicker}.SA`;
      const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;
      
      const proxies = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
      ];

      let priceFound = false;

      for (const proxyUrl of proxies) {
        try {
          const res = await fetchWithTimeout(proxyUrl, Math.floor(timeoutMs / 2));
          if (!res.ok) continue;
          
          let parsedData: any = null;
          if (proxyUrl.includes('allorigins')) {
            const data = await res.json();
            parsedData = JSON.parse(data.contents);
          } else {
            parsedData = await res.json();
          }

          const meta = parsedData?.chart?.result?.[0]?.meta;
          const price = meta?.regularMarketPrice || meta?.chartPreviousClose;
          const prevClose = meta?.chartPreviousClose;
          let change = 0;
          if (typeof price === 'number' && typeof prevClose === 'number' && prevClose > 0) {
            change = Number((((price - prevClose) / prevClose) * 100).toFixed(2));
          }

          if (typeof price === 'number' && price > 0) {
            const now = meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString();
            quotes[cleanTicker] = Number(price.toFixed(4));
            variations[cleanTicker] = change;
            timestamps[cleanTicker] = now;

            if (cleanTicker !== baseTicker) {
              quotes[baseTicker] = quotes[cleanTicker];
              variations[baseTicker] = change;
              timestamps[baseTicker] = now;
            }

            details.push({
              ticker: cleanTicker,
              price: quotes[cleanTicker],
              change,
              provider: 'Yahoo Finance (Proxy)',
              updatedAt: now,
            });
            priceFound = true;
            break;
          }
        } catch {
          // try next proxy
        }
      }

      if (!priceFound) {
        details.push({
          ticker: cleanTicker,
          price: 0,
          provider: 'Yahoo Finance',
          updatedAt: new Date().toISOString(),
          error: 'Falha no proxy Yahoo',
        });
      }
    })
  );

  return { quotes, variations, timestamps, details };
}

// 4. HG BRASIL FINANCE Provider
async function fetchHGBrasilQuotes(
  tickers: string[],
  key?: string,
  timeoutMs: number = 6000
): Promise<{ quotes: Record<string, number>; details: QuoteDetail[] }> {
  const quotes: Record<string, number> = {};
  const details: QuoteDetail[] = [];

  await Promise.all(
    tickers.map(async (t) => {
      const cleanTicker = t.trim().toUpperCase();
      const baseTicker = getBaseTicker(cleanTicker);
      const apiKey = key || '5d0c2e91';
      const url = `https://api.hgbrasil.com/finance/stock_price?key=${apiKey}&symbol=${baseTicker}&format=json-cors`;

      try {
        const res = await fetchWithTimeout(url, timeoutMs);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const stockData = data?.results?.[baseTicker];
        const price = stockData?.price;

        if (typeof price === 'number' && price > 0) {
          const now = new Date().toISOString();
          quotes[cleanTicker] = Number(price.toFixed(4));
          quotes[baseTicker] = quotes[cleanTicker];
          details.push({
            ticker: cleanTicker,
            price: quotes[cleanTicker],
            change: stockData?.change_percent,
            provider: 'HG Brasil',
            updatedAt: now,
          });
        } else {
          throw new Error('Símbolo não retornado na HG Brasil');
        }
      } catch (e: any) {
        details.push({
          ticker: cleanTicker,
          price: 0,
          provider: 'HG Brasil',
          updatedAt: new Date().toISOString(),
          error: e?.message || 'Erro HG Brasil',
        });
      }
    })
  );

  return { quotes, details };
}

// MAIN ENTRY POINT FOR QUOTE FETCHING
export async function executeQuoteFetch(
  tickers: string[],
  options: FetchQuotesOptions = {}
): Promise<QuoteFetchResult> {
  const startTime = performance.now();
  const cleanTickers = Array.from(new Set(tickers.map(t => t.trim().toUpperCase()))).filter(Boolean);

  // CRITICAL FIX: Do NOT initialize finalQuotes with existingQuotes!
  // Doing so creates a poisoned cache bug where stale quotes trick the engine
  // into believing all tickers are fresh, bypassing all live fetches and fallbacks.
  const freshQuotes: Record<string, number> = {};
  const freshVariations: Record<string, number> = {};
  const freshTimestamps: Record<string, string> = {};
  let allDetails: QuoteDetail[] = [];

  if (cleanTickers.length === 0) {
    return {
      quotes: options.existingQuotes || {},
      variations: {},
      timestamps: {},
      providerUsed: 'Nenhum Ativo',
      durationMs: 0,
      successCount: 0,
      failedCount: 0,
      details: [],
    };
  }

  console.log(`[QuoteService] Buscando cotações atualizadas para ${cleanTickers.length} ativos (Ações/FIIs/BDRs/Crypto)...`);

  // STEP 1: Attempt Server-Side Full-Stack API (Fastest, zero CORS, covers Yahoo Spark, mFinance, Brapi)
  const serverResult = await fetchServerQuotes(cleanTickers, options);
  if (serverResult && serverResult.successCount > 0) {
    Object.assign(freshQuotes, serverResult.quotes);
    if (serverResult.variations) Object.assign(freshVariations, serverResult.variations);
    if (serverResult.timestamps) Object.assign(freshTimestamps, serverResult.timestamps);
    allDetails = serverResult.details || [];

    // Check if any fractional tickers can be satisfied from base ticker
    cleanTickers.forEach(t => {
      const base = getBaseTicker(t);
      if (!freshQuotes[t] && freshQuotes[base]) {
        freshQuotes[t] = freshQuotes[base];
        if (freshVariations[base] !== undefined) freshVariations[t] = freshVariations[base];
        if (freshTimestamps[base]) freshTimestamps[t] = freshTimestamps[base];
      }
    });

    // If all tickers are freshly resolved, return immediately with fresh data
    const missing = cleanTickers.filter(t => !freshQuotes[t] || freshQuotes[t] <= 0);
    if (missing.length === 0) {
      return {
        ...serverResult,
        quotes: freshQuotes,
        variations: freshVariations,
        timestamps: freshTimestamps,
      };
    }
  }

  // STEP 2: Client Fallbacks for any remaining missing tickers
  const pendingTickers = cleanTickers.filter(t => !freshQuotes[t] || freshQuotes[t] <= 0);
  
  if (pendingTickers.length > 0) {
    console.log(`[QuoteService] Executando fallback cliente para ${pendingTickers.length} ativos pendentes...`);

    // 2.1 Try mFinance for FIIs & stocks (fixed active routes)
    const mfinanceRes = await fetchMFinanceQuotes(pendingTickers, 4000);
    Object.assign(freshQuotes, mfinanceRes.quotes);
    Object.assign(freshVariations, mfinanceRes.variations);
    Object.assign(freshTimestamps, mfinanceRes.timestamps);
    allDetails = [...allDetails.filter(d => !mfinanceRes.quotes[d.ticker]), ...mfinanceRes.details];

    // 2.2 Try Brapi (with user token if available)
    const stillPending = cleanTickers.filter(t => !freshQuotes[t] || freshQuotes[t] <= 0);
    if (stillPending.length > 0) {
      const brapiRes = await fetchBrapiQuotes(stillPending, options.brapiToken, 4000);
      Object.assign(freshQuotes, brapiRes.quotes);
      Object.assign(freshVariations, brapiRes.variations);
      Object.assign(freshTimestamps, brapiRes.timestamps);
      allDetails = [...allDetails.filter(d => !brapiRes.quotes[d.ticker]), ...brapiRes.details];
    }

    // 2.3 Try Yahoo Finance via Proxy
    const lastPending = cleanTickers.filter(t => !freshQuotes[t] || freshQuotes[t] <= 0);
    if (lastPending.length > 0) {
      const yahooRes = await fetchYahooQuotes(lastPending, 5000);
      Object.assign(freshQuotes, yahooRes.quotes);
      Object.assign(freshVariations, yahooRes.variations);
      Object.assign(freshTimestamps, yahooRes.timestamps);
      allDetails = [...allDetails.filter(d => !yahooRes.quotes[d.ticker]), ...yahooRes.details];
    }
  }

  // STEP 3: Handle any tickers that truly could not be found anywhere
  // Only now do we apply existingQuotes as a graceful fallback (marked as isStale: true)
  const finalQuotes: Record<string, number> = { ...freshQuotes };
  cleanTickers.forEach(t => {
    if (!finalQuotes[t] || finalQuotes[t] <= 0) {
      const cached = options.existingQuotes?.[t];
      if (cached && cached > 0) {
        finalQuotes[t] = cached;
        allDetails.push({
          ticker: t,
          price: cached,
          provider: 'Cache Local (Último Conhecido)',
          updatedAt: new Date().toISOString(),
          isStale: true,
        });
      }
    }
  });

  const durationMs = Math.round(performance.now() - startTime);
  const successCount = cleanTickers.filter(t => typeof freshQuotes[t] === 'number' && freshQuotes[t] > 0).length;
  const failedCount = cleanTickers.length - successCount;
  const providerUsedName = serverResult?.providerUsed || 'Multi-Fonte B3 Automático';

  console.log(`[QuoteService Concluído] ${successCount}/${cleanTickers.length} cotações atualizadas em tempo real (${durationMs}ms).`);

  return {
    quotes: finalQuotes,
    variations: freshVariations,
    timestamps: freshTimestamps,
    providerUsed: providerUsedName,
    durationMs,
    successCount,
    failedCount,
    details: allDetails,
  };
}

export async function fetchSingleQuote(ticker: string, token?: string): Promise<{ price: number; provider: string } | null> {
  const result = await executeQuoteFetch([ticker], { brapiToken: token });
  const price = result.quotes[ticker.toUpperCase()];
  if (price && price > 0) {
    const detail = result.details.find(d => d.ticker === ticker.toUpperCase());
    return { price, provider: detail?.provider || result.providerUsed };
  }
  return null;
}
