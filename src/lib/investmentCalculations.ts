import { Dividend, InvestmentTransaction, DividendAnalysisMode, ValuationTarget } from '../types';

export interface AssetProjectionResult {
  ticker: string;
  type: string;
  totalQuantity: number;
  totalInvested: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  
  // Historical Dividends
  totalDividendsReceived: number;
  totalDividendsProvisioned: number;
  totalDividendsConsidered: number;
  historicalYieldOnCost: number; // % based on total historical dividends / totalInvested
  
  // Projected Annual Dividends (LTM / Run-rate / Provisioned)
  projectedAnnualDividendPerShare: number; // DPA 12M em R$/cota
  projectedAnnualIncome: number; // R$ total anual para a quantidade atual de cotas
  projectedMonthlyIncome: number; // R$ médio mensal
  projectedDividendYield: number; // % DY Projetado sobre cotação atual (ou PM se cotação não disponível)
  projectedYieldOnCost: number; // % DY Projetado sobre preço médio de aquisição
  
  // Valuation / Bazin metrics
  isCustomValuation: boolean;
  savedValuationTarget: ValuationTarget | null;
  bazinDPA: number;
  bazinTargetYield: number; // % alvo (ex: 6%, 8%, etc.)
  bazinCeilingPrice: number; // Preço Teto Bazin
  bazinMarginOfSafety: number; // % Margem de Segurança ((Teto - Preço) / Preço) * 100
  bazinDiscount: number; // R$ (Teto - Preço)
  paybackYears: number | null; // Anos para recuperar investimento via proventos
  
  // Graham Valuation (Ações)
  grahamLPA: number;
  grahamVPA: number;
  grahamCeilingPrice: number;
  grahamMarginOfSafety: number;
  grahamDiscount: number;
  
  // P/VP Valuation (FIIs / Ações)
  pvpTarget: number;
  pvpCeilingPrice: number;
  pvpMarginOfSafety: number;
  pvpDiff: number;
  
  // Gordon Growth Valuation (Ações de Crescimento)
  gordonD1: number;
  gordonK: number;
  gordonG: number;
  gordonCeilingPrice: number;
  gordonMarginOfSafety: number;
  
  // P/L Valuation (Ações)
  plTarget: number;
  plCeilingPrice: number;
  plMarginOfSafety: number;
  
  // Frequency & stats
  paymentFrequency: 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual' | 'Eventual';
  dividendCount: number;
  lastPaymentDate: string | null;
  lastPaymentAmountPerShare: number;
}

export interface PortfolioProjectionSummary {
  totalInvested: number;
  totalCurrent: number;
  totalCapitalGain: number;
  capitalGainPercent: number;
  
  // Historical Dividends
  totalDividendsReceived: number;
  totalDividendsProvisioned: number;
  totalDividendsConsidered: number;
  overallHistoricalYieldOnCost: number;
  
  // Annual Projections
  totalProjectedAnnualIncome: number; // R$/ano
  totalProjectedMonthlyIncome: number; // R$/mês
  portfolioProjectedDividendYield: number; // % a.a. sobre patrimônio atual
  portfolioProjectedYieldOnCost: number; // % a.a. sobre valor investido
  
  // Total Return Combined
  totalReturnWithDividends: number;
  totalReturnPercent: number;
}

/**
 * Calculates projected dividends, annualized yields and valuation metrics for a specific asset
 */
export function calculateAssetDividendProjection(
  ticker: string,
  type: string,
  totalQuantity: number,
  totalInvested: number,
  averagePrice: number,
  currentPrice: number | null,
  dividends: Dividend[],
  analysisMode: DividendAnalysisMode = 'received_only',
  savedValuation?: ValuationTarget | null
): AssetProjectionResult {
  const cleanTicker = ticker.toUpperCase().trim();
  const effectivePrice = (currentPrice && currentPrice > 0) ? currentPrice : averagePrice;
  const curVal = totalQuantity > 0 ? (effectivePrice * totalQuantity) : totalInvested;

  // Filter dividends belonging to this ticker
  const assetDivs = dividends
    .filter(d => d.ticker.toUpperCase().trim() === cleanTicker)
    .sort((a, b) => {
      const dateA = a.data_ex || a.date;
      const dateB = b.data_ex || b.date;
      return dateB.localeCompare(dateA);
    });

  let totalDividendsReceived = 0;
  let totalDividendsProvisioned = 0;

  assetDivs.forEach(d => {
    if (d.status === 'received') {
      totalDividendsReceived += Number(d.amount || 0);
    } else if (d.status === 'provisioned') {
      totalDividendsProvisioned += Number(d.amount || 0);
    }
  });

  const totalDividendsConsidered = analysisMode === 'include_provisioned'
    ? (totalDividendsReceived + totalDividendsProvisioned)
    : totalDividendsReceived;

  const historicalYieldOnCost = totalInvested > 0 
    ? (totalDividendsConsidered / totalInvested) * 100 
    : 0;

  // Filter considered dividends for annual projection calculation
  const consideredDivs = assetDivs.filter(d => {
    if (analysisMode === 'include_provisioned') {
      return d.status === 'received' || d.status === 'provisioned';
    }
    return d.status === 'received';
  });

  const dividendCount = consideredDivs.length;
  const lastPaymentDate = consideredDivs.length > 0 ? (consideredDivs[0].data_ex || consideredDivs[0].date) : null;
  const lastPaymentAmountPerShare = consideredDivs.length > 0 
    ? (consideredDivs[0].unit_amount || (totalQuantity > 0 ? (consideredDivs[0].amount / totalQuantity) : 0))
    : 0;

  // Calculate Projected Annual Dividend Per Share (DPA 12M)
  let projectedAnnualDividendPerShare = 0;
  let paymentFrequency: 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual' | 'Eventual' = 'Eventual';

  if (consideredDivs.length > 0 && totalQuantity > 0) {
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

    // 1. Dividends within the last 12 months (or upcoming provisioned)
    const ltmDivs = consideredDivs.filter(d => {
      const dDate = (d.data_ex || d.date).split('T')[0];
      return dDate >= oneYearAgoStr;
    });

    // Check payment distribution to estimate frequency
    if (consideredDivs.length >= 6) {
      paymentFrequency = 'Mensal';
    } else if (consideredDivs.length >= 3) {
      paymentFrequency = 'Trimestral';
    } else if (consideredDivs.length >= 2) {
      paymentFrequency = 'Semestral';
    } else {
      paymentFrequency = type === 'FII' ? 'Mensal' : 'Eventual';
    }

    if (ltmDivs.length >= 4 || (ltmDivs.length > 0 && type !== 'FII')) {
      // Sum unit amounts in the last 12 months
      const sumUnitAmountLTM = ltmDivs.reduce((acc, d) => {
        const u = d.unit_amount !== undefined && d.unit_amount > 0 
          ? d.unit_amount 
          : (d.amount / totalQuantity);
        return acc + u;
      }, 0);

      // If user has less than 12 months of recorded history but regular monthly/quarterly payouts (especially FIIs):
      if (ltmDivs.length < 12 && type === 'FII' && ltmDivs.length >= 1) {
        // Annualize based on average monthly payout
        const avgMonthlyPayoutPerShare = sumUnitAmountLTM / ltmDivs.length;
        projectedAnnualDividendPerShare = avgMonthlyPayoutPerShare * 12;
      } else {
        projectedAnnualDividendPerShare = sumUnitAmountLTM;
      }
    } else if (ltmDivs.length > 0) {
      // Shorter history: annualize based on recorded items
      const sumUnitAmount = ltmDivs.reduce((acc, d) => {
        const u = d.unit_amount !== undefined && d.unit_amount > 0 
          ? d.unit_amount 
          : (d.amount / totalQuantity);
        return acc + u;
      }, 0);

      if (type === 'FII') {
        const avgPerMonth = sumUnitAmount / Math.max(1, ltmDivs.length);
        projectedAnnualDividendPerShare = avgPerMonth * 12;
      } else {
        projectedAnnualDividendPerShare = sumUnitAmount;
      }
    } else {
      // Fallback to all considered divs annualized
      const sumAllUnitAmount = consideredDivs.reduce((acc, d) => {
        const u = d.unit_amount !== undefined && d.unit_amount > 0 
          ? d.unit_amount 
          : (d.amount / totalQuantity);
        return acc + u;
      }, 0);
      projectedAnnualDividendPerShare = sumAllUnitAmount;
    }
  }

  // Calculate annual and monthly projected income
  const projectedAnnualIncome = projectedAnnualDividendPerShare * totalQuantity;
  const projectedMonthlyIncome = projectedAnnualIncome / 12;

  // Calculate Projected DY & Yield on Cost
  const projectedDividendYield = effectivePrice > 0 
    ? (projectedAnnualDividendPerShare / effectivePrice) * 100 
    : 0;

  const projectedYieldOnCost = averagePrice > 0 
    ? (projectedAnnualDividendPerShare / averagePrice) * 100 
    : 0;

  // VALUATION CALCULATIONS (incorporating saved calculator data)
  let isCustomValuation = false;
  let bazinDPA = projectedAnnualDividendPerShare;
  let bazinTargetYield = 6.0;
  let bazinCeilingPrice = 0;

  // Graham
  let grahamLPA = 0;
  let grahamVPA = 0;
  let grahamCeilingPrice = 0;
  let grahamMarginOfSafety = 0;
  let grahamDiscount = 0;

  // P/VP
  let pvpTarget = 0;
  let pvpCeilingPrice = 0;
  let pvpMarginOfSafety = 0;
  let pvpDiff = 0;

  // Gordon
  let gordonD1 = 0;
  let gordonK = 0;
  let gordonG = 0;
  let gordonCeilingPrice = 0;
  let gordonMarginOfSafety = 0;

  // P/L
  let plTarget = 0;
  let plCeilingPrice = 0;
  let plMarginOfSafety = 0;

  if (savedValuation) {
    isCustomValuation = true;

    // 1. Bazin from saved calculator data
    if (savedValuation.bazin_dpa !== undefined && savedValuation.bazin_dpa > 0) {
      bazinDPA = Number(savedValuation.bazin_dpa);
    }
    if (savedValuation.bazin_target_yield !== undefined && savedValuation.bazin_target_yield > 0) {
      bazinTargetYield = Number(savedValuation.bazin_target_yield);
    }

    if (bazinDPA > 0 && bazinTargetYield > 0) {
      bazinCeilingPrice = bazinDPA / (bazinTargetYield / 100);
    } else if (projectedAnnualDividendPerShare > 0 && bazinTargetYield > 0) {
      bazinCeilingPrice = projectedAnnualDividendPerShare / (bazinTargetYield / 100);
    }

    // 2. Graham Model
    grahamLPA = Number(savedValuation.graham_lpa || 0);
    grahamVPA = Number(savedValuation.graham_vpa || 0);
    if (grahamLPA > 0 && grahamVPA > 0) {
      grahamCeilingPrice = Math.sqrt(22.5 * grahamLPA * grahamVPA);
      if (effectivePrice > 0 && grahamCeilingPrice > 0) {
        grahamMarginOfSafety = ((grahamCeilingPrice - effectivePrice) / effectivePrice) * 100;
        grahamDiscount = grahamCeilingPrice - effectivePrice;
      }
    }

    // 3. P/VP Model
    pvpTarget = Number(savedValuation.pvp_target || 0);
    if (grahamVPA > 0 && pvpTarget > 0) {
      pvpCeilingPrice = grahamVPA * pvpTarget;
      if (effectivePrice > 0 && pvpCeilingPrice > 0) {
        pvpMarginOfSafety = ((pvpCeilingPrice - effectivePrice) / effectivePrice) * 100;
      }
      pvpDiff = effectivePrice - grahamVPA;
    }

    // 4. Gordon Model
    gordonD1 = Number(savedValuation.gordon_d1 || 0);
    gordonK = Number(savedValuation.gordon_k || 0);
    gordonG = Number(savedValuation.gordon_g || 0);
    if (gordonD1 > 0 && gordonK > gordonG) {
      const denom = (gordonK - gordonG) / 100;
      if (denom > 0) {
        gordonCeilingPrice = gordonD1 / denom;
        if (effectivePrice > 0 && gordonCeilingPrice > 0) {
          gordonMarginOfSafety = ((gordonCeilingPrice - effectivePrice) / effectivePrice) * 100;
        }
      }
    }

    // 5. P/L Model
    plTarget = Number(savedValuation.pl_target || 0);
    if (grahamLPA > 0 && plTarget > 0) {
      plCeilingPrice = grahamLPA * plTarget;
      if (effectivePrice > 0 && plCeilingPrice > 0) {
        plMarginOfSafety = ((plCeilingPrice - effectivePrice) / effectivePrice) * 100;
      }
    }
  }

  // Fallback to auto-calculated Bazin if no custom ceiling price was computed
  if (bazinCeilingPrice <= 0 && projectedAnnualDividendPerShare > 0) {
    bazinCeilingPrice = projectedAnnualDividendPerShare / 0.06;
    bazinTargetYield = 6.0;
    bazinDPA = projectedAnnualDividendPerShare;
  }

  const bazinMarginOfSafety = (effectivePrice > 0 && bazinCeilingPrice > 0)
    ? ((bazinCeilingPrice - effectivePrice) / effectivePrice) * 100
    : 0;

  const bazinDiscount = bazinCeilingPrice - effectivePrice;

  const paybackYears = projectedAnnualIncome > 0 && totalInvested > 0
    ? (totalInvested / projectedAnnualIncome)
    : null;

  return {
    ticker: cleanTicker,
    type,
    totalQuantity,
    totalInvested,
    averagePrice,
    currentPrice: effectivePrice,
    currentValue: curVal,
    totalDividendsReceived,
    totalDividendsProvisioned,
    totalDividendsConsidered,
    historicalYieldOnCost,
    projectedAnnualDividendPerShare,
    projectedAnnualIncome,
    projectedMonthlyIncome,
    projectedDividendYield,
    projectedYieldOnCost,
    isCustomValuation,
    savedValuationTarget: savedValuation || null,
    bazinDPA,
    bazinTargetYield,
    bazinCeilingPrice,
    bazinMarginOfSafety,
    bazinDiscount,
    grahamLPA,
    grahamVPA,
    grahamCeilingPrice,
    grahamMarginOfSafety,
    grahamDiscount,
    pvpTarget,
    pvpCeilingPrice,
    pvpMarginOfSafety,
    pvpDiff,
    gordonD1,
    gordonK,
    gordonG,
    gordonCeilingPrice,
    gordonMarginOfSafety,
    plTarget,
    plCeilingPrice,
    plMarginOfSafety,
    paybackYears,
    paymentFrequency,
    dividendCount,
    lastPaymentDate,
    lastPaymentAmountPerShare
  };
}

/**
 * Calculates portfolio-wide dividend projections and aggregated yields
 */
export function calculatePortfolioProjections(
  positions: Array<{
    ticker: string;
    type: string;
    totalQuantity: number;
    totalInvested: number;
    averagePrice: number;
    currentPrice: number | null;
    currentValue: number | null;
    dividendsReceived: number;
    yieldOnCost: number;
    realizedGain?: number;
  }>,
  dividends: Dividend[],
  analysisMode: DividendAnalysisMode = 'received_only',
  valuationTargets?: Record<string, ValuationTarget>
): PortfolioProjectionSummary {
  let totalInvested = 0;
  let totalCurrent = 0;
  let totalProjectedAnnualIncome = 0;
  let totalDividendsReceived = 0;
  let totalDividendsProvisioned = 0;
  let totalRealizedGain = 0;

  // Process all individual positions
  positions.forEach(p => {
    if (p.totalQuantity > 0) {
      totalInvested += p.totalInvested;
      totalCurrent += (p.currentValue || p.totalInvested);
      totalRealizedGain += (p.realizedGain || 0);

      const savedValuation = valuationTargets ? valuationTargets[p.ticker.toUpperCase()] : undefined;

      const proj = calculateAssetDividendProjection(
        p.ticker,
        p.type,
        p.totalQuantity,
        p.totalInvested,
        p.averagePrice,
        p.currentPrice,
        dividends,
        analysisMode,
        savedValuation
      );

      totalProjectedAnnualIncome += proj.projectedAnnualIncome;
    }
  });

  // Calculate totals from dividends list
  dividends.forEach(d => {
    if (d.status === 'received') {
      totalDividendsReceived += Number(d.amount || 0);
    } else if (d.status === 'provisioned') {
      totalDividendsProvisioned += Number(d.amount || 0);
    }
  });

  const totalDividendsConsidered = analysisMode === 'include_provisioned'
    ? (totalDividendsReceived + totalDividendsProvisioned)
    : totalDividendsReceived;

  const totalCapitalGain = totalCurrent - totalInvested;
  const capitalGainPercent = totalInvested > 0 ? (totalCapitalGain / totalInvested) * 100 : 0;

  const totalProjectedMonthlyIncome = totalProjectedAnnualIncome / 12;
  const portfolioProjectedDividendYield = totalCurrent > 0 
    ? (totalProjectedAnnualIncome / totalCurrent) * 100 
    : 0;

  const portfolioProjectedYieldOnCost = totalInvested > 0 
    ? (totalProjectedAnnualIncome / totalInvested) * 100 
    : 0;

  const overallHistoricalYieldOnCost = totalInvested > 0 
    ? (totalDividendsConsidered / totalInvested) * 100 
    : 0;

  const totalReturnWithDividends = totalCapitalGain + totalRealizedGain + totalDividendsConsidered;
  const totalReturnPercent = totalInvested > 0 
    ? (totalReturnWithDividends / totalInvested) * 100 
    : 0;

  return {
    totalInvested,
    totalCurrent,
    totalCapitalGain,
    capitalGainPercent,
    totalDividendsReceived,
    totalDividendsProvisioned,
    totalDividendsConsidered,
    overallHistoricalYieldOnCost,
    totalProjectedAnnualIncome,
    totalProjectedMonthlyIncome,
    portfolioProjectedDividendYield,
    portfolioProjectedYieldOnCost,
    totalReturnWithDividends,
    totalReturnPercent
  };
}

export interface CashFlowItem {
  date: Date;
  amount: number;
}

export interface PerformanceMetricsResult {
  twrPercent: number;
  tirAnnualPercent: number | null;
  tirPeriodPercent: number | null;
  daysElapsed: number;
  yearsElapsed: number;
}

// XIRR Calculation using Newton-Raphson with Bisection fallback and expanding upper bound
export function calculateXIRR(cashFlows: CashFlowItem[]): number | null {
  if (cashFlows.length < 2) return null;

  // Group cash flows by date string (YYYY-MM-DD) for numerical stability
  const mapByDate: Record<string, number> = {};
  cashFlows.forEach(cf => {
    const key = cf.date.toISOString().split('T')[0];
    mapByDate[key] = (mapByDate[key] || 0) + cf.amount;
  });

  const uniqueCF: CashFlowItem[] = Object.entries(mapByDate).map(([dateStr, amount]) => ({
    date: new Date(dateStr + 'T12:00:00Z'),
    amount
  })).sort((a, b) => a.date.getTime() - b.date.getTime());

  if (uniqueCF.length < 2) return null;

  const startDate = uniqueCF[0].date;
  const hasNegative = uniqueCF.some(cf => cf.amount < 0);
  const hasPositive = uniqueCF.some(cf => cf.amount > 0);
  if (!hasNegative || !hasPositive) return null;

  const getYears = (d: Date) => Math.max(0.0001, (d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

  const npv = (rate: number) => {
    return uniqueCF.reduce((sum, cf) => {
      const t = getYears(cf.date);
      if (rate <= -1) return sum;
      return sum + cf.amount / Math.pow(1 + rate, t);
    }, 0);
  };

  const derivativeNpv = (rate: number) => {
    return uniqueCF.reduce((sum, cf) => {
      const t = getYears(cf.date);
      if (t === 0 || rate <= -1) return sum;
      return sum - (t * cf.amount) / Math.pow(1 + rate, t + 1);
    }, 0);
  };

  // 1. Newton-Raphson
  let rate = 0.1;
  const maxIter = 100;
  const tol = 1e-6;

  for (let i = 0; i < maxIter; i++) {
    const fVal = npv(rate);
    const dfVal = derivativeNpv(rate);

    if (Math.abs(fVal) < tol) return rate;
    if (Math.abs(dfVal) < 1e-10) break;

    const nextRate = rate - fVal / dfVal;

    if (nextRate <= -0.99 || nextRate > 1000) break;
    if (Math.abs(nextRate - rate) < tol) return nextRate;

    rate = nextRate;
  }

  // 2. Bisection search with expanding upper bound
  let low = -0.99;
  let high = 5.0;
  let fLow = npv(low);
  let fHigh = npv(high);

  if (fLow * fHigh > 0) {
    for (let expand = 0; expand < 10; expand++) {
      high *= 4;
      fHigh = npv(high);
      if (fLow * fHigh <= 0) break;
    }
  }

  if (fLow * fHigh > 0) return null;

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const fMid = npv(mid);

    if (Math.abs(fMid) < tol || (high - low) / 2 < tol) {
      return mid;
    }

    if (fLow * fMid < 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }

  return (low + high) / 2;
}

// Calculate comprehensive TWR and TIR for portfolio
export function calculatePortfolioPerformanceMetrics(
  transactions: InvestmentTransaction[],
  dividends: Dividend[],
  quotes: Record<string, number>,
  totalCurrentPortfolio: number,
  analysisMode: DividendAnalysisMode = 'received_only'
): PerformanceMetricsResult {
  const sortedTx = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  // 1. Cash flows for TIR / IRR (XIRR)
  const cashFlows: CashFlowItem[] = [];

  sortedTx.forEach(tx => {
    const txDate = new Date(tx.date + 'T12:00:00Z');
    const costs = tx.costs || 0;
    if (tx.operation === 'buy') {
      cashFlows.push({ date: txDate, amount: -(tx.amount + costs) });
    } else {
      cashFlows.push({ date: txDate, amount: +(tx.amount - costs) });
    }
  });

  dividends.forEach(d => {
    const isIncluded = analysisMode === 'include_provisioned'
      ? (d.status === 'received' || d.status === 'provisioned')
      : (d.status === 'received');

    if (isIncluded) {
      const dDateStr = d.data_ex || d.date;
      if (dDateStr) {
        const divDate = new Date(dDateStr + 'T12:00:00Z');
        cashFlows.push({ date: divDate, amount: Number(d.amount || 0) });
      }
    }
  });

  if (totalCurrentPortfolio > 0) {
    cashFlows.push({ date: new Date(), amount: totalCurrentPortfolio });
  }

  const tirAnnual = calculateXIRR(cashFlows);
  const tirAnnualPercent = tirAnnual !== null ? tirAnnual * 100 : null;

  let daysElapsed = 0;
  if (cashFlows.length >= 2) {
    const sortedCF = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
    const startDate = sortedCF[0].date;
    const endDate = sortedCF[sortedCF.length - 1].date;
    daysElapsed = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  }
  const yearsElapsed = daysElapsed > 0 ? daysElapsed / 365.25 : 0;

  let tirPeriodPercent: number | null = null;
  if (tirAnnual !== null) {
    if (1 + tirAnnual > 0) {
      const tirPeriod = Math.pow(1 + tirAnnual, yearsElapsed) - 1;
      tirPeriodPercent = tirPeriod * 100;
    } else {
      tirPeriodPercent = tirAnnual * 100;
    }
  }

  // 2. TWR (Time-Weighted Rate of Return)
  const eventDatesSet = new Set<string>();
  sortedTx.forEach(tx => eventDatesSet.add(tx.date));
  dividends.forEach(d => {
    const isIncluded = analysisMode === 'include_provisioned'
      ? (d.status === 'received' || d.status === 'provisioned')
      : (d.status === 'received');

    if (isIncluded) {
      const dDateStr = d.data_ex || d.date;
      if (dDateStr) eventDatesSet.add(dDateStr);
    }
  });

  const eventDates = Array.from(eventDatesSet).sort();
  const todayStr = new Date().toISOString().split('T')[0];

  const txByDate: Record<string, InvestmentTransaction[]> = {};
  sortedTx.forEach(tx => {
    if (!txByDate[tx.date]) txByDate[tx.date] = [];
    txByDate[tx.date].push(tx);
  });

  const divByDate: Record<string, number> = {};
  dividends.forEach(d => {
    const isIncluded = analysisMode === 'include_provisioned'
      ? (d.status === 'received' || d.status === 'provisioned')
      : (d.status === 'received');

    if (isIncluded) {
      const dDateStr = d.data_ex || d.date;
      if (dDateStr) {
        divByDate[dDateStr] = (divByDate[dDateStr] || 0) + Number(d.amount || 0);
      }
    }
  });

  const getInterpolatedPrice = (ticker: string, targetDateStr: string, firstBuyDateStr: string, avgBuyPrice: number) => {
    const currentQ = quotes[ticker] || avgBuyPrice;
    if (targetDateStr >= todayStr || firstBuyDateStr >= todayStr) return currentQ;
    if (targetDateStr <= firstBuyDateStr) return avgBuyPrice;

    const tTarget = new Date(targetDateStr + 'T12:00:00Z').getTime();
    const tFirst = new Date(firstBuyDateStr + 'T12:00:00Z').getTime();
    const tToday = new Date(todayStr + 'T12:00:00Z').getTime();

    if (tToday <= tFirst) return currentQ;
    const progress = Math.min(1, Math.max(0, (tTarget - tFirst) / (tToday - tFirst)));
    return avgBuyPrice + (currentQ - avgBuyPrice) * progress;
  };

  let twrFactor = 1.0;
  const currentHoldings: Record<string, { qty: number; totalCost: number; firstBuyDate: string }> = {};
  let lastStartValue = 0;

  eventDates.forEach((dStr) => {
    let valBefore = 0;
    Object.entries(currentHoldings).forEach(([tk, h]) => {
      if (h.qty > 0) {
        const avgP = h.qty > 0 ? h.totalCost / h.qty : 0;
        const priceOnD = getInterpolatedPrice(tk, dStr, h.firstBuyDate, avgP);
        valBefore += h.qty * priceOnD;
      }
    });

    const divOnD = divByDate[dStr] || 0;

    if (lastStartValue > 0) {
      const subReturn = (valBefore + divOnD - lastStartValue) / lastStartValue;
      twrFactor *= (1 + subReturn);
    }

    const txs = txByDate[dStr] || [];
    txs.forEach(tx => {
      const tk = tx.ticker.toUpperCase();
      if (!currentHoldings[tk]) {
        currentHoldings[tk] = { qty: 0, totalCost: 0, firstBuyDate: tx.date };
      }
      const h = currentHoldings[tk];
      const costs = tx.costs || 0;
      if (tx.operation === 'buy') {
        h.qty += tx.quantity;
        h.totalCost += (tx.amount + costs);
      } else if (tx.operation === 'sell') {
        const avgP = h.qty > 0 ? h.totalCost / h.qty : 0;
        h.qty = Math.max(0, h.qty - tx.quantity);
        h.totalCost = h.qty * avgP;
      }
    });

    let valAfter = 0;
    Object.entries(currentHoldings).forEach(([tk, h]) => {
      if (h.qty > 0) {
        const avgP = h.qty > 0 ? h.totalCost / h.qty : 0;
        const priceOnD = getInterpolatedPrice(tk, dStr, h.firstBuyDate, avgP);
        valAfter += h.qty * priceOnD;
      }
    });
    lastStartValue = valAfter;
  });

  if (lastStartValue > 0 && totalCurrentPortfolio > 0) {
    const finalReturn = (totalCurrentPortfolio - lastStartValue) / lastStartValue;
    twrFactor *= (1 + finalReturn);
  }

  const twrPercent = (twrFactor - 1) * 100;

  return {
    twrPercent: isNaN(twrPercent) ? 0 : twrPercent,
    tirAnnualPercent,
    tirPeriodPercent,
    daysElapsed,
    yearsElapsed
  };
}
