import { CorporateEvent, DividendType } from '../../types';
import { generateDeterministicEventId } from './dividendDeduplicator';

/**
 * Complementary Provider: Brapi API Dividends Collector
 * Acts as optional validation and fallback when configured or available.
 */
export async function fetchBrapiDividends(
  tickers: string[],
  token?: string
): Promise<{ events: CorporateEvent[]; errors: string[] }> {
  const events: CorporateEvent[] = [];
  const errors: string[] = [];
  const cleanTickers = Array.from(new Set(tickers.map(t => t.trim().toUpperCase()))).filter(Boolean);

  if (cleanTickers.length === 0) {
    return { events, errors };
  }

  // Token is required for Brapi dividends endpoint
  const activeToken = token || process.env.BRAPI_TOKEN;
  if (!activeToken) {
    // Graceful skip - no fake data, as mandated by the instructions
    return { events, errors };
  }

  const tokenParam = `token=${encodeURIComponent(activeToken)}`;

  await Promise.all(
    cleanTickers.slice(0, 10).map(async (ticker) => {
      try {
        const url = `https://brapi.dev/api/quote/${ticker}?dividends=true&${tokenParam}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4500) });

        if (res.ok) {
          const data = await res.json();
          const results = data?.results || [];
          for (const item of results) {
            const dividendsData = item?.dividendsData?.cashDividends || [];
            dividendsData.forEach((cd: any, idx: number) => {
              const rawType = (cd.type || '').toUpperCase();
              let divType: DividendType = 'Dividendo';
              if (rawType.includes('JCP') || rawType.includes('JUROS')) {
                divType = 'JCP';
              } else if (rawType.includes('RENDIMENTO')) {
                divType = 'Rendimento';
              } else if (rawType.includes('AMORTIZ')) {
                divType = 'Amortizacao';
              }

              const unitAmount = Number(cd.rate || cd.amount || 0);
              const dateCom = cd.lastDatePrior ? cd.lastDatePrior.slice(0, 10) : '';
              const paymentDate = cd.paymentDate ? cd.paymentDate.slice(0, 10) : '';

              if (unitAmount > 0 && paymentDate) {
                const effectiveDateCom = dateCom || paymentDate;
                const eventId = generateDeterministicEventId(
                  'brapi',
                  ticker,
                  effectiveDateCom,
                  paymentDate,
                  divType,
                  `b_${idx}`
                );

                events.push({
                  eventId,
                  provider: 'brapi',
                  ticker,
                  type: divType,
                  unitAmount: Number(unitAmount.toFixed(8)),
                  dateCom: effectiveDateCom,
                  paymentDate,
                  status: 'active',
                  validationStatus: 'valid',
                  notes: `Brapi API: ${cd.label || divType}`,
                });
              }
            });
          }
        }
      } catch (err: any) {
        errors.push(`Brapi ${ticker}: ${err?.message || err}`);
      }
    })
  );

  return { events, errors };
}
