import { getB3AssetFundamental, B3AssetFundamental } from './b3Fundamentals';
import { calculateUniversalAssetScore, AssetScoreResult } from './scoringEngine';

export type RebalanceStrategyType = 
  | 'rebalance'        // Rebalanceamento Puro (Gap Solver)
  | 'quality'          // Qualidade Máxima (Score Fundamentalista)
  | 'valuation'        // Oportunidade / Valuation & Preço Teto
  | 'dividends'        // Dividendos & Renda Passiva Sustentável
  | 'diversification'  // Diversificação & Diluição de Risco
  | 'custom';          // Estratégia Customizada

export interface StrategyWeights {
  gapWeight: number;        // Peso do gap de alocação (0 a 100)
  qualityWeight: number;    // Peso do score fundamentalista (0 a 100)
  valuationWeight: number;  // Peso do valuation/desconto (0 a 100)
  dividendWeight: number;   // Peso do dividend yield (0 a 100)
  liquidityWeight: number;  // Peso da liquidez (0 a 100)
}

export interface RebalanceRulesConfig {
  activeStrategy: RebalanceStrategyType;
  customWeights: StrategyWeights;
  
  // Risk & Concentration limits
  maxAssetAllocationPct: number;      // Teto máximo por ativo (ex: 15%)
  maxSectorAllocationPct: number;     // Teto máximo por setor (ex: 25%)
  minDailyLiquidity: number;          // Liquidez diária mínima em R$ (ex: 1000000)
  maxDebtEbitdaAllowed: number;       // Dívida Líquida/EBITDA máxima permitida para aportes (ex: 3.5x)
  maxFiiPhysicalVacancyAllowed: number; // Vacância física máxima para FII de tijolo (ex: 15%)
  maxFiiPvpAllowed: number;           // P/VP máximo para FII (ex: 1.08)
  minScoreAllowed: number;            // Score mínimo para receber aporte (ex: 50)
  allowNewPositions: boolean;         // Permitir sugerir ativos da watchlist não presentes em carteira
}

export interface AssetAllocationTarget {
  ticker: string;
  type: 'Ação' | 'FII';
  minPct: number;      // Faixa Mínima (ex: 3%)
  targetPct: number;   // Alvo Ideal (ex: 5%)
  maxPct: number;      // Faixa Máxima (ex: 8%)
  locked?: boolean;    // Bloquear novos aportes neste ativo
  notes?: string;
}

export interface PositionForRebalance {
  ticker: string;
  type: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  currentPct: number;
}

export interface ContributionItemSuggestion {
  ticker: string;
  name: string;
  type: 'Ação' | 'FII';
  currentPrice: number;
  
  // Prioritization score (0 to 100)
  priorityScore: number;
  rank: number;
  
  // Position numbers
  currentQuantity: number;
  currentValue: number;
  currentPct: number;
  
  // Target specs
  minPct: number;
  targetPct: number;
  maxPct: number;
  gapAmount: number; // R$ necessário para atingir a meta
  gapPct: number;    // % de distância da meta
  
  // Suggested Order
  suggestedQuantity: number;
  suggestedAmount: number;
  
  // Projected after contribution
  projectedValue: number;
  projectedPct: number;
  distanceBefore: number;
  distanceAfter: number;
  deviationCorrectedPct: number;
  
  // Fundamental Score & Analysis
  scoreResult: AssetScoreResult;
  
  // Pedagogical Explanation
  reasons: string[];
  risks: string[];
  status: 'recommended' | 'eligible' | 'neutral' | 'locked' | 'restricted';
  restrictionReason?: string;
}

export interface RebalanceSimulationResult {
  contributionAmount: number;
  strategyUsed: RebalanceStrategyType;
  totalAllocated: number;
  unallocatedRemainder: number;
  
  // Macro Before vs After
  totalBefore: number;
  totalAfter: number;
  stocksPctBefore: number;
  stocksPctAfter: number;
  fiisPctBefore: number;
  fiisPctAfter: number;
  
  // Items Breakdown
  suggestions: ContributionItemSuggestion[];
  
  // Metrics & Compliance
  totalDeviationBefore: number;
  totalDeviationAfter: number;
  overallDeviationReductionPct: number;
  rulesCompliedCount: number;
  restrictedAssetsCount: number;
  
  // Strategic Summary
  executiveSummary: string;
}

export const DEFAULT_REBALANCE_RULES: RebalanceRulesConfig = {
  activeStrategy: 'rebalance',
  customWeights: {
    gapWeight: 40,
    qualityWeight: 25,
    valuationWeight: 20,
    dividendWeight: 10,
    liquidityWeight: 5
  },
  maxAssetAllocationPct: 15.0,
  maxSectorAllocationPct: 25.0,
  minDailyLiquidity: 1000000,
  maxDebtEbitdaAllowed: 3.5,
  maxFiiPhysicalVacancyAllowed: 15.0,
  maxFiiPvpAllowed: 1.08,
  minScoreAllowed: 45,
  allowNewPositions: false
};

/**
 * Resolves the strategy weights based on user choice
 */
export function getStrategyWeights(strategy: RebalanceStrategyType, custom?: StrategyWeights): StrategyWeights {
  switch (strategy) {
    case 'rebalance':
      return { gapWeight: 70, qualityWeight: 10, valuationWeight: 10, dividendWeight: 5, liquidityWeight: 5 };
    case 'quality':
      return { gapWeight: 20, qualityWeight: 50, valuationWeight: 15, dividendWeight: 10, liquidityWeight: 5 };
    case 'valuation':
      return { gapWeight: 25, qualityWeight: 15, valuationWeight: 45, dividendWeight: 10, liquidityWeight: 5 };
    case 'dividends':
      return { gapWeight: 20, qualityWeight: 15, valuationWeight: 15, dividendWeight: 45, liquidityWeight: 5 };
    case 'diversification':
      return { gapWeight: 45, qualityWeight: 20, valuationWeight: 15, dividendWeight: 10, liquidityWeight: 10 };
    case 'custom':
      return custom || DEFAULT_REBALANCE_RULES.customWeights;
  }
}

/**
 * Master Rebalance & Contribution Engine
 */
export function simulatePortfolioContribution(
  positions: PositionForRebalance[],
  targets: Record<string, AssetAllocationTarget>,
  contributionAmount: number,
  rules: RebalanceRulesConfig = DEFAULT_REBALANCE_RULES,
  quotes: Record<string, number> = {},
  customMetadata?: Record<string, any>,
  customStockWeights?: any,
  customFiiWeights?: any
): RebalanceSimulationResult {
  const currentTotal = positions.reduce((acc, p) => acc + p.currentValue, 0);
  const newTotal = currentTotal + contributionAmount;
  const weights = getStrategyWeights(rules.activeStrategy, rules.customWeights);

  // 1. Enrich positions and check eligibility against rules
  const candidateItems: ContributionItemSuggestion[] = positions.map(pos => {
    const price = quotes[pos.ticker] || pos.currentPrice || pos.averagePrice || 10;
    const targetSpec = targets[pos.ticker] || {
      ticker: pos.ticker,
      type: pos.type as any,
      minPct: 2.0,
      targetPct: positions.length > 0 ? Number((100 / positions.length).toFixed(1)) : 10,
      maxPct: rules.maxAssetAllocationPct,
      locked: false
    };

    const targetPct = targetSpec.targetPct || 5.0;
    const minPct = targetSpec.minPct || 1.0;
    const maxPct = targetSpec.maxPct || rules.maxAssetAllocationPct;
    const isLocked = !!targetSpec.locked;

    const fundamental = getB3AssetFundamental(pos.ticker, pos.type, price, customMetadata);
    const scoreResult = calculateUniversalAssetScore(fundamental, customStockWeights, customFiiWeights);

    const targetValue = (newTotal * targetPct) / 100;
    const gapAmount = Math.max(0, targetValue - pos.currentValue);
    const gapPct = targetPct - pos.currentPct;

    const reasons: string[] = [];
    const risks: string[] = [];
    let isRestricted = false;
    let restrictionReason = '';

    // Check Rules & Filters
    if (isLocked) {
      isRestricted = true;
      restrictionReason = 'Ativo travado manualmente pelo investidor para não receber novos aportes.';
    } else if (pos.currentPct >= maxPct) {
      isRestricted = true;
      restrictionReason = `Posição atual (${pos.currentPct.toFixed(1)}%) já atingiu ou superou o teto máximo permitido de ${maxPct.toFixed(1)}%.`;
    } else if (scoreResult.totalScore < rules.minScoreAllowed) {
      isRestricted = true;
      restrictionReason = `Score fundamentalista (${scoreResult.totalScore}) abaixo da nota mínima exigida (${rules.minScoreAllowed}).`;
    } else if (fundamental.dailyLiquidity < rules.minDailyLiquidity) {
      isRestricted = true;
      restrictionReason = `Liquidez diária média (R$ ${(fundamental.dailyLiquidity / 1000).toFixed(0)}k) abaixo da regra mínima de R$ ${(rules.minDailyLiquidity / 1000000).toFixed(1)}M.`;
    } else if (fundamental.type === 'Ação' && fundamental.sector !== 'Financeiro' && fundamental.netDebtOverEbitda > rules.maxDebtEbitdaAllowed) {
      isRestricted = true;
      restrictionReason = `Endividamento elevado: Dívida/EBITDA de ${fundamental.netDebtOverEbitda.toFixed(2)}x excede o limite de ${rules.maxDebtEbitdaAllowed.toFixed(1)}x.`;
    } else if (fundamental.type === 'FII' && fundamental.fiiType === 'Tijolo' && fundamental.physicalVacancy > rules.maxFiiPhysicalVacancyAllowed) {
      isRestricted = true;
      restrictionReason = `Vacância física de ${fundamental.physicalVacancy.toFixed(1)}% ultrapassa a trava de risco de ${rules.maxFiiPhysicalVacancyAllowed.toFixed(1)}%.`;
    } else if (fundamental.type === 'FII' && fundamental.pvp > rules.maxFiiPvpAllowed) {
      isRestricted = true;
      restrictionReason = `P/VP de ${fundamental.pvp.toFixed(2)}x está acima do teto de preço estipulado (${rules.maxFiiPvpAllowed.toFixed(2)}x).`;
    }

    // Build explanatory reasons
    if (gapPct > 0) {
      reasons.push(`Abaixo da meta ideal em ${gapPct.toFixed(1)}% (necessita de R$ ${gapAmount.toFixed(0)} para equilibrar)`);
    } else {
      reasons.push(`Posição equilibrada ou acima da meta (${pos.currentPct.toFixed(1)}% vs meta ${targetPct.toFixed(1)}%)`);
    }

    if (scoreResult.totalScore >= 75) {
      reasons.push(`Alta qualidade fundamentalista (Score ${scoreResult.totalScore}/100 - Grau ${scoreResult.grade})`);
    }

    if (fundamental.type === 'FII') {
      if (fundamental.pvp < 1.0) {
        reasons.push(`Negociado com desconto patrimonial (P/VP ${fundamental.pvp.toFixed(2)}x)`);
      }
      if (fundamental.dividendYield >= 9.0) {
        reasons.push(`Proventos atrativos (DY 12M de ${fundamental.dividendYield.toFixed(1)}%)`);
      }
    } else {
      if (fundamental.pl > 0 && fundamental.pl < 10.0) {
        reasons.push(`Múltiplo Preço/Lucro favorável (P/L ${fundamental.pl.toFixed(1)}x)`);
      }
      if (fundamental.dividendYield >= 7.0) {
        reasons.push(`Forte fluxo de dividendos (DY ${fundamental.dividendYield.toFixed(1)}%)`);
      }
    }

    if (scoreResult.warnings.length > 0) {
      risks.push(...scoreResult.warnings.slice(0, 2));
    }

    // Calculate composite priority score (0 to 100)
    // 1. Gap factor: normalized 0-100 (gap > 5% gives 100)
    const gapScoreFactor = Math.max(0, Math.min(100, (Math.max(0, gapPct) / 5.0) * 100));
    
    // 2. Quality factor (0-100)
    const qualityScoreFactor = scoreResult.totalScore;
    
    // 3. Valuation factor
    let valScoreFactor = 50;
    if (fundamental.type === 'FII') {
      valScoreFactor = Math.max(0, Math.min(100, 100 - ((fundamental.pvp - 0.85) * 200)));
    } else {
      valScoreFactor = fundamental.pl > 0 ? Math.max(0, Math.min(100, 100 - (fundamental.pl * 3.5))) : 20;
    }

    // 4. Dividend factor
    const divScoreFactor = Math.max(0, Math.min(100, (fundamental.dividendYield / 12.0) * 100));

    // 5. Liquidity factor
    const liqScoreFactor = Math.max(0, Math.min(100, (fundamental.dailyLiquidity / 50000000) * 100));

    const totalStrategyWeight = weights.gapWeight + weights.qualityWeight + weights.valuationWeight + weights.dividendWeight + weights.liquidityWeight;
    let rawPriority = (
      (gapScoreFactor * weights.gapWeight) +
      (qualityScoreFactor * weights.qualityWeight) +
      (valScoreFactor * weights.valuationWeight) +
      (divScoreFactor * weights.dividendWeight) +
      (liqScoreFactor * weights.liquidityWeight)
    ) / (totalStrategyWeight || 100);

    // Dynamic Multipliers for "Smart Engine"
    // - Quality Multiplier: High quality assets (Score > 85) get a 10% boost
    if (qualityScoreFactor >= 85) rawPriority *= 1.1;

    // - Sector Concentration Defense: If this sector is already > rules.maxSectorAllocationPct, reduce priority significantly
    const sector = fundamental.type === 'Ação' ? fundamental.sector : fundamental.fiiSegment;
    if (sector && rules.maxSectorAllocationPct > 0) {
      const sectorValue = positions
        .filter(p => {
          const f = getB3AssetFundamental(p.ticker, p.type, quotes[p.ticker], customMetadata);
          const s = f.type === 'Ação' ? f.sector : f.fiiSegment;
          return s === sector;
        })
        .reduce((acc, p) => acc + p.currentValue, 0);
      
      const sectorPct = newTotal > 0 ? (sectorValue / newTotal) * 100 : 0;
      if (sectorPct >= rules.maxSectorAllocationPct) {
        rawPriority *= 0.5; // Heavy penalty if sector is full
        risks.push(`Setor ${sector} já atingiu o limite de ${rules.maxSectorAllocationPct}% da carteira.`);
      }
    }

    // - Valuation Safety Margin Multiplier (Integration with Raio-X / Valuation Targets)
    const tickerUpper = pos.ticker.toUpperCase();
    const valTarget = customMetadata?.[tickerUpper]?.valuation_target || customMetadata?.[tickerUpper]?.valuationTarget || customMetadata?.[tickerUpper]?.targetPrice;
    if (valTarget && valTarget > 0) {
      const margin = (valTarget - price) / price;
      if (margin > 0.25) {
        // Very high safety margin (>25%): 20% boost
        rawPriority *= 1.20;
        reasons.push(`Oportunidade Premium: ${(margin * 100).toFixed(0)}% de desconto sobre o Preço Teto.`);
      } else if (margin > 0.10) {
        // High safety margin (>10%): 10% boost
        rawPriority *= 1.10;
        reasons.push(`Margem de segurança de ${(margin * 100).toFixed(0)}% baseada no Valuation.`);
      } else if (margin < -0.05) {
        // Above fair price: 40% penalty
        rawPriority *= 0.6;
        risks.push(`Ativo acima do Preço Teto estipulado (${(Math.abs(margin) * 100).toFixed(0)}% de ágio).`);
      }
    }

    // - Valuation Safety: If asset has P/VP > 1.2 (FII) or P/L > 25 (Stock), penalize it 20%
    if ((fundamental.type === 'FII' && fundamental.pvp > 1.2) || (fundamental.type === 'Ação' && fundamental.pl > 25)) {
      rawPriority *= 0.8;
      risks.push(`Múltiplos de mercado elevados (P/VP ou P/L acima da média histórica)`);
    }
    
    // - Concentration Defense: If already > 10%, reduce priority by 15% to favor diversification
    if (pos.currentPct > 10.0) {
      rawPriority *= 0.85;
      risks.push(`Alta concentração na carteira (${pos.currentPct.toFixed(1)}%)`);
    }

    const priorityScore = isRestricted ? 0 : Math.round(Math.min(100, rawPriority));

    return {
      ticker: pos.ticker,
      name: fundamental.name,
      type: fundamental.type,
      currentPrice: price,
      priorityScore,
      rank: 0,
      currentQuantity: pos.quantity,
      currentValue: pos.currentValue,
      currentPct: pos.currentPct,
      minPct,
      targetPct,
      maxPct,
      gapAmount,
      gapPct,
      suggestedQuantity: 0,
      suggestedAmount: 0,
      projectedValue: pos.currentValue,
      projectedPct: pos.currentPct,
      distanceBefore: Math.abs(pos.currentPct - targetPct),
      distanceAfter: Math.abs(pos.currentPct - targetPct),
      deviationCorrectedPct: 0,
      scoreResult,
      reasons,
      risks,
      status: isLocked ? 'locked' : isRestricted ? 'restricted' : priorityScore >= 70 ? 'recommended' : 'eligible',
      restrictionReason
    };
  });

  // Sort candidate items by priority score (descending)
  candidateItems.sort((a, b) => b.priorityScore - a.priorityScore);
  candidateItems.forEach((item, index) => {
    item.rank = index + 1;
  });

  // 2. Intelligent Multi-Round Contribution Allocation
  let remainingBudget = contributionAmount;
  const eligibleItems = candidateItems.filter(i => i.priorityScore > 0 && !i.status.includes('restricted') && !i.status.includes('locked'));

  if (eligibleItems.length > 0 && remainingBudget > 0) {
    // Round 1: Allocate according to priority-weighted gap
    // Sum of weighted gaps
    const totalWeightedNeed = eligibleItems.reduce((acc, item) => {
      const need = Math.max(item.currentPrice, item.gapAmount);
      return acc + (need * (item.priorityScore / 100));
    }, 0);

    if (totalWeightedNeed > 0) {
      eligibleItems.forEach(item => {
        if (remainingBudget <= 0) return;
        const need = Math.max(item.currentPrice, item.gapAmount);
        const weightRatio = (need * (item.priorityScore / 100)) / totalWeightedNeed;
        const idealShare = contributionAmount * weightRatio;
        
        // Buy integer shares (or fractions for FIIs if standard integer shares)
        const possibleQty = Math.floor(idealShare / item.currentPrice);
        if (possibleQty > 0) {
          const cost = possibleQty * item.currentPrice;
          if (cost <= remainingBudget) {
            item.suggestedQuantity += possibleQty;
            item.suggestedAmount += cost;
            remainingBudget -= cost;
          }
        }
      });
    }

    // Round 2: Greedily allocate remaining budget to highest priority asset that fits
    let iterations = 0;
    while (remainingBudget > 0 && iterations < 50) {
      iterations++;
      let allocatedInPass = false;

      for (const item of eligibleItems) {
        if (remainingBudget >= item.currentPrice) {
          // Check if adding 1 unit doesn't breach maxPct
          const nextVal = item.currentValue + item.suggestedAmount + item.currentPrice;
          const nextPct = (nextVal / newTotal) * 100;

          if (nextPct <= item.maxPct) {
            item.suggestedQuantity += 1;
            item.suggestedAmount += item.currentPrice;
            remainingBudget -= item.currentPrice;
            allocatedInPass = true;
            break; // restart greedy pass from #1 ranked
          }
        }
      }

      if (!allocatedInPass) break;
    }
  }

  // 3. Post-calculation metrics for each item
  let totalDeviationBefore = 0;
  let totalDeviationAfter = 0;
  let stocksValBefore = 0;
  let stocksValAfter = 0;
  let fiisValBefore = 0;
  let fiisValAfter = 0;

  candidateItems.forEach(item => {
    item.projectedValue = item.currentValue + item.suggestedAmount;
    item.projectedPct = newTotal > 0 ? (item.projectedValue / newTotal) * 100 : 0;
    item.distanceBefore = Math.abs(item.currentPct - item.targetPct);
    item.distanceAfter = Math.abs(item.projectedPct - item.targetPct);

    totalDeviationBefore += item.distanceBefore;
    totalDeviationAfter += item.distanceAfter;

    if (item.type === 'FII') {
      fiisValBefore += item.currentValue;
      fiisValAfter += item.projectedValue;
    } else {
      stocksValBefore += item.currentValue;
      stocksValAfter += item.projectedValue;
    }

    if (item.distanceBefore > 0) {
      const reduced = item.distanceBefore - item.distanceAfter;
      item.deviationCorrectedPct = Math.max(0, Math.min(100, Math.round((reduced / item.distanceBefore) * 100)));
    } else {
      item.deviationCorrectedPct = 100;
    }
  });

  const totalAllocated = contributionAmount - remainingBudget;
  const overallDeviationReductionPct = totalDeviationBefore > 0
    ? Math.max(0, Math.round(((totalDeviationBefore - totalDeviationAfter) / totalDeviationBefore) * 100))
    : 0;

  const activeContributors = candidateItems.filter(i => i.suggestedQuantity > 0);
  const restrictedAssetsCount = candidateItems.filter(i => i.status === 'restricted' || i.status === 'locked').length;
  const rulesCompliedCount = candidateItems.length - restrictedAssetsCount;

  // Executive strategic summary in Portuguese
  let executiveSummary = '';
  if (contributionAmount <= 0) {
    executiveSummary = 'Informe um valor de aporte para visualizar a distribuição matemática ideal da carteira.';
  } else if (activeContributors.length === 0) {
    executiveSummary = `Nenhum ativo qualificado para receber aportes com as travas atuais de risco e limites de concentração.`;
  } else {
    const topPick = activeContributors[0];
    executiveSummary = `Aporte de R$ ${totalAllocated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} distribuído estrategicamente em ${activeContributors.length} ativo(s). O motor priorizou ${topPick.ticker} (${topPick.reasons[0] || 'maior gap de alocação'}), reduzindo o desvio geral da carteira em ${overallDeviationReductionPct}%.`;
  }

  return {
    contributionAmount,
    strategyUsed: rules.activeStrategy,
    totalAllocated,
    unallocatedRemainder: remainingBudget,
    totalBefore: currentTotal,
    totalAfter: newTotal,
    stocksPctBefore: currentTotal > 0 ? (stocksValBefore / currentTotal) * 100 : 0,
    stocksPctAfter: newTotal > 0 ? (stocksValAfter / newTotal) * 100 : 0,
    fiisPctBefore: currentTotal > 0 ? (fiisValBefore / currentTotal) * 100 : 0,
    fiisPctAfter: newTotal > 0 ? (fiisValAfter / newTotal) * 100 : 0,
    suggestions: candidateItems,
    totalDeviationBefore: Number(totalDeviationBefore.toFixed(2)),
    totalDeviationAfter: Number(totalDeviationAfter.toFixed(2)),
    overallDeviationReductionPct,
    rulesCompliedCount,
    restrictedAssetsCount,
    executiveSummary
  };
}
