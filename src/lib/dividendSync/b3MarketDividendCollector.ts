import { CorporateEvent, DividendType } from '../../types';
import { generateDeterministicEventId } from './dividendDeduplicator';

export interface B3MarketDividendRaw {
  ticker: string;
  type: string;
  unitAmount: number;
  dateCom: string;
  paymentDate: string;
  dateEx?: string;
  source: 'mfinance' | 'yahoo';
}

/**
 * Normalizes date to YYYY-MM-DD string.
 */
function normalizeDate(d: any): string {
  if (!d) return '';
  if (typeof d === 'string') {
    // If ISO date like "2026-08-14T00:00:00Z"
    if (d.includes('T')) return d.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    // If pt-BR DD/MM/YYYY
    const ptMatch = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ptMatch) return `${ptMatch[3]}-${ptMatch[2]}-${ptMatch[1]}`;
    return d.slice(0, 10);
  }
  if (typeof d === 'number') {
    // unix timestamp in seconds
    const ms = d > 10000000000 ? d : d * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  return '';
}

/**
 * Normalizes dividend type into canonical Brazilian market types.
 */
function normalizeDividendType(rawType: string, ticker: string): DividendType {
  const t = (rawType || '').toUpperCase();
  if (t.includes('JCP') || t.includes('JUROS') || t.includes('JSCP')) {
    return 'JCP';
  }
  if (t.includes('AMORTIZ') || t.includes('AMORT')) {
    return 'Amortizacao';
  }
  if (t.includes('RENDIMENTO') || t.includes('REND')) {
    return 'Rendimento';
  }
  if (ticker.endsWith('11')) {
    return 'Rendimento';
  }
  return 'Dividendo';
}

/**
 * Fetches recent announced and paid dividends for B3 assets using mFinance and Yahoo Finance public APIs.
 * Covers all Ações and FIIs in the user portfolio.
 */
export async function fetchB3MarketDividends(
  tickers: string[]
): Promise<{ events: CorporateEvent[]; errors: string[] }> {
  const events: CorporateEvent[] = [];
  const errors: string[] = [];
  const cleanTickers = Array.from(new Set(tickers.map(t => t.trim().toUpperCase()))).filter(Boolean);

  if (cleanTickers.length === 0) {
    return { events, errors };
  }

  await Promise.all(
    cleanTickers.map(async (ticker) => {
      try {
        let tickerEventsFound: B3MarketDividendRaw[] = [];
        const isFii = ticker.endsWith('11');

        // Priority 1: mFinance Public REST API
        const endpoints = isFii
          ? [
              `https://mfinance.com.br/api/v1/fiis/dividends/${ticker}`,
              `https://mfinance.com.br/api/v1/stocks/dividends/${ticker}`,
            ]
          : [
              `https://mfinance.com.br/api/v1/stocks/dividends/${ticker}`,
              `https://mfinance.com.br/api/v1/fiis/dividends/${ticker}`,
            ];

        for (const url of endpoints) {
          try {
            const res = await fetch(url, {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              signal: AbortSignal.timeout(4500)
            });

            if (res.ok) {
              const data = await res.json();
              const list = Array.isArray(data?.dividends) ? data.dividends : [];
              if (list.length > 0) {
                // Take the most recent 12 dividends (covers full year of monthly/quarterly payouts)
                const recentDividends = list.slice(-12);
                recentDividends.forEach((d: any) => {
                  const rawVal = Number(d.value || d.amount || 0);
                  const dateCom = normalizeDate(d.declaredDate || d.date || d.cutDate || d.lastDatePrior);
                  const payDate = normalizeDate(d.payDate || d.paymentDate || d.date);

                  if (rawVal > 0 && (payDate || dateCom)) {
                    const effectivePayDate = payDate || dateCom;
                    const effectiveDateCom = dateCom || payDate;
                    tickerEventsFound.push({
                      ticker,
                      type: d.type || (isFii ? 'Rendimento' : 'Dividendo'),
                      unitAmount: rawVal,
                      dateCom: effectiveDateCom,
                      paymentDate: effectivePayDate,
                      source: 'mfinance',
                    });
                  }
                });
                break; // successfully populated from mFinance
              }
            }
          } catch {
            // try next endpoint
          }
        }

        // Priority 2: Yahoo Finance Chart API (if mFinance had no events)
        if (tickerEventsFound.length === 0) {
          try {
            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.SA?events=div&interval=1d&range=1y`;
            const yRes = await fetch(yahooUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              signal: AbortSignal.timeout(4500)
            });

            if (yRes.ok) {
              const yJson = await yRes.json();
              const yDivs = yJson?.chart?.result?.[0]?.events?.dividends || {};
              const sorted = Object.values(yDivs)
                .map((d: any) => ({
                  amount: Number(d.amount || 0),
                  date: Number(d.date || 0)
                }))
                .filter(d => d.amount > 0 && d.date > 0)
                .sort((a, b) => b.date - a.date)
                .slice(0, 12);

              sorted.forEach(d => {
                const dateStr = normalizeDate(d.date);
                tickerEventsFound.push({
                  ticker,
                  type: isFii ? 'Rendimento' : 'Dividendo',
                  unitAmount: d.amount,
                  dateCom: dateStr,
                  paymentDate: dateStr,
                  source: 'yahoo',
                });
              });
            }
          } catch {
            // Yahoo fallback failed
          }
        }

        // Transform into canonical CorporateEvents
        tickerEventsFound.forEach((raw, idx) => {
          const divType = normalizeDividendType(raw.type, ticker);
          const eventId = generateDeterministicEventId(
            'b3_market',
            ticker,
            raw.dateCom,
            raw.paymentDate,
            divType,
            `b3_${idx}_${raw.unitAmount}`
          );

          events.push({
            eventId,
            provider: 'b3_market',
            ticker,
            type: divType,
            unitAmount: Number(raw.unitAmount.toFixed(8)),
            dateCom: raw.dateCom,
            dateEx: raw.dateEx,
            paymentDate: raw.paymentDate,
            announcementDate: raw.dateCom,
            documentId: `b3_doc_${ticker}_${raw.dateCom}`,
            documentVersion: 1,
            documentUrl: `https://mfinance.com.br/api/v1/${isFii ? 'fiis' : 'stocks'}/dividends/${ticker}`,
            status: 'active',
            validationStatus: 'valid',
            notes: `Mercado B3 (${raw.source.toUpperCase()}): ${divType} R$ ${raw.unitAmount}`,
            rawPayload: raw,
          });
        });
      } catch (tickerErr: any) {
        errors.push(`Erro buscando ${ticker}: ${tickerErr?.message || tickerErr}`);
      }
    })
  );

  return { events, errors };
}
