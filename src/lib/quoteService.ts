export type QuoteProvider = 'auto' | 'yahoo' | 'brapi' | 'mfinance' | 'hgbrasil';

export interface QuoteDetail {
  ticker: string;
  price: number;
  provider: string;
  updatedAt: string;
  change?: number;
  error?: string;
}

export interface QuoteFetchResult {
  quotes: Record<string, number>;
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

// 0. Primary Full-Stack API (/api/quotes - Server Proxy with Yahoo, mFinance, Brapi)
async function fetchServerQuotes(
  tickers: string[],
  options: FetchQuotesOptions = {}
): Promise<QuoteFetchResult | null> {
  try {
    const cleanTickers = tickers.map(t => t.trim().toUpperCase()).filter(Boolean);
    if (cleanTickers.length === 0) return null;

    const queryParams = new URLSearchParams({
      tickers: cleanTickers.join(','),
      provider: options.provider || 'auto',
    });

    if (options.brapiToken) {
      queryParams.append('token', options.brapiToken);
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
): Promise<{ quotes: Record<string, number>; details: QuoteDetail[] }> {
  const quotes: Record<string, number> = {};
  const details: QuoteDetail[] = [];
  const cleanTickers = tickers.map(t => t.trim().toUpperCase()).filter(Boolean);

  if (cleanTickers.length === 0) return { quotes, details };

  const BATCH_SIZE = 10;
  const batches: string[][] = [];
  for (let i = 0; i < cleanTickers.length; i += BATCH_SIZE) {
    batches.push(cleanTickers.slice(i, i + BATCH_SIZE));
  }

  await Promise.all(
    batches.map(async (batch) => {
      const tickerQuery = batch.join(',');
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
            quotes[symbol] = price;
            details.push({
              ticker: symbol,
              price,
              change: item.regularMarketChangePercent,
              provider: 'Brapi (Direto)',
              updatedAt: new Date().toISOString(),
            });
          }
        });
      } catch (err: any) {
        // Try individual tickers as fallback
        for (const singleTicker of batch) {
          try {
            const singleUrl = `https://brapi.dev/api/quote/${singleTicker}${tokenParam}`;
            const res = await fetchWithTimeout(singleUrl, Math.floor(timeoutMs / 2));
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const item = data.results?.[0];
            const price = item?.regularMarketPrice || item?.price;
            if (typeof price === 'number' && price > 0) {
              quotes[singleTicker] = price;
              details.push({
                ticker: singleTicker,
                price,
                change: item?.regularMarketChangePercent,
                provider: 'Brapi (Single)',
                updatedAt: new Date().toISOString(),
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

  return { quotes, details };
}

// 2. MFINANCE Provider (Client Fallback - Specialized for FIIs & B3 Stocks)
async function fetchMFinanceQuotes(
  tickers: string[],
  timeoutMs: number = 6000
): Promise<{ quotes: Record<string, number>; details: QuoteDetail[] }> {
  const quotes: Record<string, number> = {};
  const details: QuoteDetail[] = [];

  await Promise.all(
    tickers.map(async (t) => {
      const cleanTicker = t.trim().toUpperCase();
      const isFii = cleanTicker.endsWith('11');
      const primaryUrl = isFii
        ? `https://mfinance.com.br/api/v1/fiis/quote/${cleanTicker}`
        : `https://mfinance.com.br/api/v1/stocks/quote/${cleanTicker}`;
      const fallbackUrl = isFii
        ? `https://mfinance.com.br/api/v1/stocks/quote/${cleanTicker}`
        : `https://mfinance.com.br/api/v1/fiis/quote/${cleanTicker}`;

      try {
        let res = await fetchWithTimeout(primaryUrl, Math.floor(timeoutMs / 2)).catch(() => null);
        if (!res || !res.ok) {
          res = await fetchWithTimeout(fallbackUrl, Math.floor(timeoutMs / 2)).catch(() => null);
        }

        if (res && res.ok) {
          const data = await res.json();
          const price = data?.lastPrice || data?.closingPrice || data?.price;
          if (typeof price === 'number' && price > 0) {
            quotes[cleanTicker] = price;
            details.push({
              ticker: cleanTicker,
              price,
              change: data?.change,
              provider: isFii ? 'mFinance (FII)' : 'mFinance (Ações)',
              updatedAt: new Date().toISOString(),
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

  return { quotes, details };
}

// 3. YAHOO FINANCE Provider (Client Proxy Fallback)
async function fetchYahooQuotes(
  tickers: string[],
  timeoutMs: number = 7000
): Promise<{ quotes: Record<string, number>; details: QuoteDetail[] }> {
  const quotes: Record<string, number> = {};
  const details: QuoteDetail[] = [];

  await Promise.all(
    tickers.map(async (t) => {
      const cleanTicker = t.trim().toUpperCase();
      const yahooSymbol = cleanTicker.includes('.') ? cleanTicker : `${cleanTicker}.SA`;
      const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`;
      
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

          const price = parsedData?.chart?.result?.[0]?.meta?.regularMarketPrice || parsedData?.chart?.result?.[0]?.meta?.chartPreviousClose;

          if (typeof price === 'number' && price > 0) {
            quotes[cleanTicker] = price;
            details.push({
              ticker: cleanTicker,
              price,
              provider: 'Yahoo Finance (Proxy)',
              updatedAt: new Date().toISOString(),
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

  return { quotes, details };
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
      const apiKey = key || '5d0c2e91';
      const url = `https://api.hgbrasil.com/finance/stock_price?key=${apiKey}&symbol=${cleanTicker}&format=json-cors`;

      try {
        const res = await fetchWithTimeout(url, timeoutMs);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const stockData = data?.results?.[cleanTicker];
        const price = stockData?.price;

        if (typeof price === 'number' && price > 0) {
          quotes[cleanTicker] = price;
          details.push({
            ticker: cleanTicker,
            price,
            provider: 'HG Brasil',
            updatedAt: new Date().toISOString(),
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

  let finalQuotes: Record<string, number> = { ...(options.existingQuotes || {}) };
  let allDetails: QuoteDetail[] = [];

  if (cleanTickers.length === 0) {
    return {
      quotes: finalQuotes,
      providerUsed: 'Nenhum Ativo',
      durationMs: 0,
      successCount: 0,
      failedCount: 0,
      details: [],
    };
  }

  console.log(`[QuoteService] Buscando cotações para ${cleanTickers.length} ativos (Ações/FIIs/BDRs)...`);

  // STEP 1: Attempt Server-Side Full-Stack API (Fastest, zero CORS, covers Yahoo, mFinance, Brapi)
  const serverResult = await fetchServerQuotes(cleanTickers, options);
  if (serverResult && serverResult.successCount > 0) {
    Object.assign(finalQuotes, serverResult.quotes);
    allDetails = serverResult.details;

    // If all or most tickers are resolved, return immediately
    const missing = cleanTickers.filter(t => !finalQuotes[t] || finalQuotes[t] <= 0);
    if (missing.length === 0) {
      return {
        ...serverResult,
        quotes: finalQuotes,
      };
    }
  }

  // STEP 2: Client Fallbacks for any remaining missing tickers
  const pendingTickers = cleanTickers.filter(t => !finalQuotes[t] || finalQuotes[t] <= 0);
  
  if (pendingTickers.length > 0) {
    console.log(`[QuoteService] Executando fallback cliente para ${pendingTickers.length} ativos pendentes...`);

    // 2.1 Try mFinance for FIIs & stocks
    const mfinanceRes = await fetchMFinanceQuotes(pendingTickers, 4000);
    Object.assign(finalQuotes, mfinanceRes.quotes);
    allDetails = [...allDetails.filter(d => !mfinanceRes.quotes[d.ticker]), ...mfinanceRes.details];

    // 2.2 Try Brapi (with user token if available)
    const stillPending = cleanTickers.filter(t => !finalQuotes[t] || finalQuotes[t] <= 0);
    if (stillPending.length > 0) {
      const brapiRes = await fetchBrapiQuotes(stillPending, options.brapiToken, 4000);
      Object.assign(finalQuotes, brapiRes.quotes);
      allDetails = [...allDetails.filter(d => !brapiRes.quotes[d.ticker]), ...brapiRes.details];
    }

    // 2.3 Try Yahoo Finance via Proxy
    const lastPending = cleanTickers.filter(t => !finalQuotes[t] || finalQuotes[t] <= 0);
    if (lastPending.length > 0) {
      const yahooRes = await fetchYahooQuotes(lastPending, 5000);
      Object.assign(finalQuotes, yahooRes.quotes);
      allDetails = [...allDetails.filter(d => !yahooRes.quotes[d.ticker]), ...yahooRes.details];
    }
  }

  const durationMs = Math.round(performance.now() - startTime);
  const successCount = cleanTickers.filter(t => typeof finalQuotes[t] === 'number' && finalQuotes[t] > 0).length;
  const failedCount = cleanTickers.length - successCount;
  const providerUsedName = serverResult?.providerUsed || 'Multi-Fonte Automático';

  console.log(`[QuoteService Concluído] ${successCount}/${cleanTickers.length} cotações atualizadas em ${durationMs}ms.`);

  return {
    quotes: finalQuotes,
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
