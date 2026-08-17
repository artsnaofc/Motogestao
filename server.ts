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

  // Helper function to fetch Yahoo Finance quotes (Server-side: No CORS issues)
  async function fetchYahooQuotesServer(tickers: string[]): Promise<{ quotes: Record<string, number>; details: any[] }> {
    const quotes: Record<string, number> = {};
    const details: any[] = [];
    const cleanTickers = tickers.map(t => t.trim().toUpperCase()).filter(Boolean);

    if (cleanTickers.length === 0) return { quotes, details };

    // Format tickers for Yahoo (e.g. PETR4 -> PETR4.SA, MXRF11 -> MXRF11.SA)
    const formattedSymbols = cleanTickers.map(t => t.includes('.') ? t : `${t}.SA`);
    const symbolsQuery = formattedSymbols.join(',');

    // Primary: Yahoo Finance v7 quote batch endpoint
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolsQuery)}&formatted=false`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const data = await response.json();
        const results = data?.quoteResponse?.result || [];

        results.forEach((item: any) => {
          const rawSymbol = (item.symbol || '').toUpperCase().replace('.SA', '');
          const price = item.regularMarketPrice || item.postMarketPrice || item.ask || item.bid;
          if (rawSymbol && typeof price === 'number' && price > 0) {
            quotes[rawSymbol] = price;
            details.push({
              ticker: rawSymbol,
              price,
              change: item.regularMarketChangePercent || 0,
              provider: 'Yahoo Finance (Server Batch)',
              updatedAt: new Date().toISOString(),
            });
          }
        });
      }
    } catch (err: any) {
      console.warn('[Server Quotes] Yahoo v7 batch error, tentando v8 chart individual:', err?.message || err);
    }

    // Secondary fallback for any missing tickers: Yahoo v8 chart endpoint
    const missing = cleanTickers.filter(t => !quotes[t] || quotes[t] <= 0);
    if (missing.length > 0) {
      await Promise.all(
        missing.map(async (ticker) => {
          try {
            const ySym = ticker.includes('.') ? ticker : `${ticker}.SA`;
            const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ySym}?interval=1d&range=1d`;
            const res = await fetch(chartUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
              signal: AbortSignal.timeout(4000),
            });

            if (res.ok) {
              const data = await res.json();
              const meta = data?.chart?.result?.[0]?.meta;
              const price = meta?.regularMarketPrice || meta?.chartPreviousClose;
              if (typeof price === 'number' && price > 0) {
                quotes[ticker] = price;
                details.push({
                  ticker,
                  price,
                  provider: 'Yahoo Finance (Server v8)',
                  updatedAt: new Date().toISOString(),
                });
              }
            }
          } catch (e: any) {
            // Fail silently, will try mFinance / Brapi next
          }
        })
      );
    }

    return { quotes, details };
  }

  // Helper function to fetch mFinance quotes (Server-side: Specialized in FIIs and Ações B3)
  async function fetchMFinanceServer(tickers: string[]): Promise<{ quotes: Record<string, number>; details: any[] }> {
    const quotes: Record<string, number> = {};
    const details: any[] = [];

    await Promise.all(
      tickers.map(async (ticker) => {
        const cleanTicker = ticker.trim().toUpperCase();
        // FIIs usually have 11 at the end (e.g. MXRF11, HGLG11)
        const isLikelyFii = cleanTicker.endsWith('11') || cleanTicker.includes('FII');
        const urls = isLikelyFii
          ? [
              `https://mfinance.com.br/api/v1/fiis/quote/${cleanTicker}`,
              `https://mfinance.com.br/api/v1/stocks/quote/${cleanTicker}`,
            ]
          : [
              `https://mfinance.com.br/api/v1/stocks/quote/${cleanTicker}`,
              `https://mfinance.com.br/api/v1/fiis/quote/${cleanTicker}`,
            ];

        for (const url of urls) {
          try {
            const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
            if (res.ok) {
              const data = await res.json();
              const price = data?.lastPrice || data?.closingPrice || data?.price;
              if (typeof price === 'number' && price > 0) {
                quotes[cleanTicker] = price;
                details.push({
                  ticker: cleanTicker,
                  price,
                  provider: 'mFinance (Server)',
                  updatedAt: new Date().toISOString(),
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

    return { quotes, details };
  }

  // Helper function to fetch Brapi quotes (Server-side)
  async function fetchBrapiServer(tickers: string[], token?: string): Promise<{ quotes: Record<string, number>; details: any[] }> {
    const quotes: Record<string, number> = {};
    const details: any[] = [];
    const cleanTickers = tickers.map(t => t.trim().toUpperCase()).filter(Boolean);

    if (cleanTickers.length === 0) return { quotes, details };

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
                quotes[sym] = price;
                details.push({
                  ticker: sym,
                  price,
                  provider: 'Brapi (Server)',
                  updatedAt: new Date().toISOString(),
                });
              }
            });
          }
        } catch {
          // ignore batch failure
        }
      })
    );

    return { quotes, details };
  }

  // Quotes API endpoint
  app.get('/api/quotes', async (req, res) => {
    const startTime = performance.now();
    const tickersParam = (req.query.tickers as string) || '';
    const providerParam = ((req.query.provider as string) || 'auto').toLowerCase();
    const tokenParam = (req.query.token as string) || process.env.BRAPI_TOKEN || '';

    const tickers = tickersParam
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    if (tickers.length === 0) {
      return res.json({
        quotes: {},
        providerUsed: 'Nenhum ticker fornecido',
        durationMs: 0,
        successCount: 0,
        failedCount: 0,
        details: [],
      });
    }

    let finalQuotes: Record<string, number> = {};
    let allDetails: any[] = [];
    let providerUsed = 'Automático Multi-Fonte (Servidor)';

    if (providerParam === 'brapi') {
      providerUsed = 'Brapi API (Servidor)';
      const brapiResult = await fetchBrapiServer(tickers, tokenParam);
      Object.assign(finalQuotes, brapiResult.quotes);
      allDetails = brapiResult.details;
    } else if (providerParam === 'mfinance') {
      providerUsed = 'mFinance (Servidor)';
      const mfinanceResult = await fetchMFinanceServer(tickers);
      Object.assign(finalQuotes, mfinanceResult.quotes);
      allDetails = mfinanceResult.details;
    } else if (providerParam === 'yahoo') {
      providerUsed = 'Yahoo Finance (Servidor)';
      const yahooResult = await fetchYahooQuotesServer(tickers);
      Object.assign(finalQuotes, yahooResult.quotes);
      allDetails = yahooResult.details;
    } else {
      // AUTO MODE (High Reliability Cascade):
      // 1. Yahoo Finance (covers 100% of Ações, FIIs, BDRs, ETFs with real-time B3 data)
      const yahooResult = await fetchYahooQuotesServer(tickers);
      Object.assign(finalQuotes, yahooResult.quotes);
      allDetails.push(...yahooResult.details);

      // 2. If any tickers missing, try Brapi (with token if provided)
      const missing1 = tickers.filter(t => !finalQuotes[t] || finalQuotes[t] <= 0);
      if (missing1.length > 0) {
        const brapiResult = await fetchBrapiServer(missing1, tokenParam);
        Object.assign(finalQuotes, brapiResult.quotes);
        allDetails.push(...brapiResult.details);
      }

      // 3. If still missing, try mFinance (specifically strong for FIIs)
      const missing2 = tickers.filter(t => !finalQuotes[t] || finalQuotes[t] <= 0);
      if (missing2.length > 0) {
        const mfinanceResult = await fetchMFinanceServer(missing2);
        Object.assign(finalQuotes, mfinanceResult.quotes);
        allDetails.push(...mfinanceResult.details);
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
      providerUsed,
      durationMs,
      successCount,
      failedCount,
      details: allDetails,
    });
  });

  // Single Quote endpoint
  app.get('/api/quote/:ticker', async (req, res) => {
    const ticker = (req.params.ticker || '').trim().toUpperCase();
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker obrigatório' });
    }

    // Try Yahoo first
    const yahoo = await fetchYahooQuotesServer([ticker]);
    if (yahoo.quotes[ticker]) {
      return res.json({ ticker, price: yahoo.quotes[ticker], provider: 'Yahoo Finance' });
    }

    // Try mFinance
    const mfinance = await fetchMFinanceServer([ticker]);
    if (mfinance.quotes[ticker]) {
      return res.json({ ticker, price: mfinance.quotes[ticker], provider: 'mFinance' });
    }

    // Try Brapi
    const brapi = await fetchBrapiServer([ticker], req.query.token as string);
    if (brapi.quotes[ticker]) {
      return res.json({ ticker, price: brapi.quotes[ticker], provider: 'Brapi' });
    }

    res.status(404).json({ error: `Cotação não encontrada para o ticker ${ticker}` });
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
