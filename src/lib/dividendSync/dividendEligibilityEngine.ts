import { InvestmentTransaction } from '../../types';

export interface EligibilityResult {
  ticker: string;
  dateCom: string;
  eligibleQuantity: number;
  hasPosition: boolean;
  isEstimate: boolean;
  notes?: string;
}

/**
 * Calculates user's eligible share/quota position at market close on 'data_com' (base date).
 * In B3 regulations, anyone holding the asset at the end of the trading day on data_com
 * is entitled to receive the announced earnings, even if sold on data_ex or later.
 * 
 * Rules:
 * 1. Accumulate all buy (+) and sell (-) operations executed on or before data_com.
 * 2. If no operations exist on or before data_com, eligible position is 0.
 * 3. Does not invent quantities if history is empty.
 */
export function calculateEligiblePosition(
  transactions: InvestmentTransaction[],
  ticker: string,
  dateCom: string
): EligibilityResult {
  const cleanTicker = ticker.trim().toUpperCase();
  if (!cleanTicker || !dateCom) {
    return {
      ticker: cleanTicker,
      dateCom,
      eligibleQuantity: 0,
      hasPosition: false,
      isEstimate: false,
      notes: 'Ticker ou Data-Com não informados'
    };
  }

  // Filter transactions for this asset
  const assetTxs = (transactions || []).filter(tx => {
    const txTicker = (tx.ticker || '').trim().toUpperCase();
    // Match exact ticker or fractional (e.g. PETR4 and PETR4F)
    const baseTx = txTicker.replace(/F$/, '');
    const baseTarget = cleanTicker.replace(/F$/, '');
    return txTicker === cleanTicker || baseTx === baseTarget;
  });

  if (assetTxs.length === 0) {
    return {
      ticker: cleanTicker,
      dateCom,
      eligibleQuantity: 0,
      hasPosition: false,
      isEstimate: false,
      notes: `Nenhuma transação registrada para ${cleanTicker}`
    };
  }

  // Transactions on or before data_com
  const eligibleTxs = assetTxs.filter(tx => {
    if (!tx.date) return false;
    // Compare YYYY-MM-DD
    const txDateStr = tx.date.slice(0, 10);
    return txDateStr <= dateCom;
  });

  if (eligibleTxs.length === 0) {
    // User only bought AFTER data_com
    return {
      ticker: cleanTicker,
      dateCom,
      eligibleQuantity: 0,
      hasPosition: false,
      isEstimate: false,
      notes: `Posição adquirida após a data-com (${dateCom})`
    };
  }

  // Calculate net balance up to data_com
  let netQuantity = 0;
  for (const tx of eligibleTxs) {
    const qty = Number(tx.quantity) || 0;
    if (tx.operation === 'buy') {
      netQuantity += qty;
    } else if (tx.operation === 'sell') {
      netQuantity -= qty;
    }
  }

  // Round to prevent JS float inaccuracies
  netQuantity = Math.max(0, Math.round(netQuantity * 10000) / 10000);

  return {
    ticker: cleanTicker,
    dateCom,
    eligibleQuantity: netQuantity,
    hasPosition: netQuantity > 0,
    isEstimate: false,
    notes: netQuantity > 0 
      ? `Posição elegível na data-com (${dateCom}): ${netQuantity} un.` 
      : `Posição zerada na data-com (${dateCom})`
  };
}
