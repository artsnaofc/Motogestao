import { B3AssetFundamental } from './b3Fundamentals';

export interface StockScoreWeights {
  quality: number;      // ROE, ROIC, Margem (padrão: 25%)
  valuation: number;    // P/L, P/VP (padrão: 20%)
  debt: number;         // Dívida Líquida/EBITDA (padrão: 20%)
  dividends: number;    // DY e Payout (padrão: 15%)
  growth: number;       // CAGR Lucros e Receitas (padrão: 10%)
  liquidity: number;    // Volume diário (padrão: 10%)
}

export interface FiiScoreWeights {
  yields: number;       // Dividend Yield (padrão: 25%)
  valuation: number;    // P/VP (padrão: 20%)
  vacancy: number;      // Vacância Física e Financeira (padrão: 20%)
  diversification: number; // Qtd imóveis e inquilinos (padrão: 15%)
  liquidity: number;    // Liquidez de negociação (padrão: 10%)
  scale: number;        // Patrimônio Líquido do fundo (padrão: 10%)
}

export interface ScorePillarBreakdown {
  name: string;
  weightPct: number;
  score: number; // 0 to 100
  weightedScore: number;
  description: string;
  status: 'excellent' | 'good' | 'neutral' | 'warning' | 'critical';
}

export interface AssetScoreResult {
  ticker: string;
  type: 'Ação' | 'FII';
  totalScore: number; // 0 to 100
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';
  summary: string;
  strengths: string[];
  warnings: string[];
  pillars: ScorePillarBreakdown[];
}

export const DEFAULT_STOCK_WEIGHTS: StockScoreWeights = {
  quality: 25,
  valuation: 20,
  debt: 20,
  dividends: 15,
  growth: 10,
  liquidity: 10
};

export const DEFAULT_FII_WEIGHTS: FiiScoreWeights = {
  yields: 25,
  valuation: 20,
  vacancy: 20,
  diversification: 15,
  liquidity: 10,
  scale: 10
};

/**
 * Calculates a fully transparent, multi-factor fundamental score for B3 Stocks
 */
export function calculateStockScore(
  asset: Extract<B3AssetFundamental, { type: 'Ação' }>,
  weights: StockScoreWeights = DEFAULT_STOCK_WEIGHTS
): AssetScoreResult {
  const strengths: string[] = [];
  const warnings: string[] = [];
  const pillars: ScorePillarBreakdown[] = [];

  // 1. Qualidade & Rentabilidade (ROE, ROIC, Margem Líquida)
  let qualityScore = 50;
  if (asset.roe >= 20) {
    qualityScore = 95;
    strengths.push(`Excelente rentabilidade sobre o patrimônio (ROE de ${asset.roe.toFixed(1)}%)`);
  } else if (asset.roe >= 15) {
    qualityScore = 80;
    strengths.push(`Bom retorno sobre o patrimônio (ROE de ${asset.roe.toFixed(1)}%)`);
  } else if (asset.roe >= 10) {
    qualityScore = 60;
  } else if (asset.roe > 0) {
    qualityScore = 40;
    warnings.push(`Rentabilidade modesta (ROE de ${asset.roe.toFixed(1)}%)`);
  } else {
    qualityScore = 15;
    warnings.push(`ROE negativo ou prejuízo reportado recente`);
  }

  // ROIC boost
  if (asset.roic >= 18) qualityScore = Math.min(100, qualityScore + 5);
  if (asset.netMargin >= 20) {
    strengths.push(`Elevada margem líquida (${asset.netMargin.toFixed(1)}%)`);
  }

  pillars.push({
    name: 'Qualidade & Rentabilidade',
    weightPct: weights.quality,
    score: qualityScore,
    weightedScore: (qualityScore * weights.quality) / 100,
    description: `ROE ${asset.roe.toFixed(1)}% | ROIC ${asset.roic.toFixed(1)}% | Margem Líq. ${asset.netMargin.toFixed(1)}%`,
    status: qualityScore >= 80 ? 'excellent' : qualityScore >= 65 ? 'good' : qualityScore >= 50 ? 'neutral' : 'warning'
  });

  // 2. Valuation (P/L e P/VP)
  let valuationScore = 50;
  if (asset.pl > 0 && asset.pl <= 8) {
    valuationScore = 90;
    strengths.push(`Múltiplo Preço/Lucro muito atrativo (P/L de ${asset.pl.toFixed(1)}x)`);
  } else if (asset.pl > 8 && asset.pl <= 14) {
    valuationScore = 75;
    strengths.push(`Preço/Lucro equilibrado (P/L de ${asset.pl.toFixed(1)}x)`);
  } else if (asset.pl > 14 && asset.pl <= 22) {
    valuationScore = 55;
  } else if (asset.pl > 22) {
    valuationScore = 35;
    warnings.push(`Múltiplo P/L esticado (${asset.pl.toFixed(1)}x), exigindo alto crescimento futuro`);
  } else {
    valuationScore = 20;
    warnings.push(`P/L negativo devido a prejuízo`);
  }

  if (asset.pvp > 0 && asset.pvp <= 1.5) {
    strengths.push(`Preço próximo ou abaixo do valor patrimonial (P/VP de ${asset.pvp.toFixed(2)}x)`);
  } else if (asset.pvp > 5.0 && asset.sector !== 'Financeiro') {
    valuationScore = Math.max(10, valuationScore - 10);
  }

  pillars.push({
    name: 'Valuation & Preço',
    weightPct: weights.valuation,
    score: valuationScore,
    weightedScore: (valuationScore * weights.valuation) / 100,
    description: `P/L ${asset.pl.toFixed(1)}x | P/VP ${asset.pvp.toFixed(2)}x`,
    status: valuationScore >= 80 ? 'excellent' : valuationScore >= 65 ? 'good' : valuationScore >= 50 ? 'neutral' : 'warning'
  });

  // 3. Endividamento & Solvência (Dívida Líquida / EBITDA)
  let debtScore = 70;
  if (asset.sector === 'Financeiro') {
    // Bancos e seguradoras não utilizam dívida líquida/ebitda
    debtScore = 85;
    strengths.push('Estrutura financeira regulada pelo Banco Central / SUSEP com índice de Basileia sólido');
  } else {
    if (asset.netDebtOverEbitda <= 0) {
      debtScore = 98;
      strengths.push('Caixa líquido positivo (sem endividamento financeiro líquido)');
    } else if (asset.netDebtOverEbitda <= 1.5) {
      debtScore = 90;
      strengths.push(`Endividamento muito conservador (Dív. Líq./EBITDA de ${asset.netDebtOverEbitda.toFixed(2)}x)`);
    } else if (asset.netDebtOverEbitda <= 2.5) {
      debtScore = 75;
      strengths.push(`Endividamento dentro de níveis saudáveis (${asset.netDebtOverEbitda.toFixed(2)}x EBITDA)`);
    } else if (asset.netDebtOverEbitda <= 3.5) {
      debtScore = 45;
      warnings.push(`Alavancagem requer atenção (Dív. Líq./EBITDA de ${asset.netDebtOverEbitda.toFixed(2)}x)`);
    } else {
      debtScore = 20;
      warnings.push(`Elevada alavancagem financeira (${asset.netDebtOverEbitda.toFixed(2)}x EBITDA)`);
    }
  }

  pillars.push({
    name: 'Saúde Financeira & Dívida',
    weightPct: weights.debt,
    score: debtScore,
    weightedScore: (debtScore * weights.debt) / 100,
    description: asset.sector === 'Financeiro' ? 'Setor Financeiro (Índices Prudenciais)' : `Dív. Líquida / EBITDA ${asset.netDebtOverEbitda.toFixed(2)}x`,
    status: debtScore >= 80 ? 'excellent' : debtScore >= 65 ? 'good' : debtScore >= 50 ? 'neutral' : 'warning'
  });

  // 4. Dividendos & Renda Passiva
  let divScore = 50;
  if (asset.dividendYield >= 8.0) {
    divScore = 95;
    strengths.push(`Forte Dividend Yield de ${asset.dividendYield.toFixed(1)}% nos últimos 12 meses`);
  } else if (asset.dividendYield >= 6.0) {
    divScore = 80;
    strengths.push(`Bom Dividend Yield de ${asset.dividendYield.toFixed(1)}% a.a.`);
  } else if (asset.dividendYield >= 3.0) {
    divScore = 60;
  } else if (asset.dividendYield > 0) {
    divScore = 40;
  } else {
    divScore = 25;
    warnings.push('Sem histórico recente relevante de distribuição de dividendos');
  }

  pillars.push({
    name: 'Proventos & Dividend Yield',
    weightPct: weights.dividends,
    score: divScore,
    weightedScore: (divScore * weights.dividends) / 100,
    description: `DY 12M ${asset.dividendYield.toFixed(1)}% | Payout ${asset.payout.toFixed(0)}%`,
    status: divScore >= 80 ? 'excellent' : divScore >= 65 ? 'good' : divScore >= 50 ? 'neutral' : 'warning'
  });

  // 5. Crescimento (CAGR Receita e Lucro 5 anos)
  let growthScore = 50;
  if (asset.profitCagr5y >= 15 && asset.revenueCagr5y >= 10) {
    growthScore = 92;
    strengths.push(`Forte crescimento histórico composto nos últimos 5 anos (Lucros +${asset.profitCagr5y.toFixed(1)}% a.a.)`);
  } else if (asset.profitCagr5y >= 8) {
    growthScore = 75;
    strengths.push(`Crescimento consistente de lucros (+${asset.profitCagr5y.toFixed(1)}% a.a.)`);
  } else if (asset.profitCagr5y >= 0) {
    growthScore = 55;
  } else {
    growthScore = 30;
    warnings.push('Lucros com contração ou volatilidade nos últimos 5 anos');
  }

  pillars.push({
    name: 'Crescimento Histórico (5a)',
    weightPct: weights.growth,
    score: growthScore,
    weightedScore: (growthScore * weights.growth) / 100,
    description: `CAGR Lucro +${asset.profitCagr5y.toFixed(1)}% | CAGR Receita +${asset.revenueCagr5y.toFixed(1)}%`,
    status: growthScore >= 80 ? 'excellent' : growthScore >= 65 ? 'good' : growthScore >= 50 ? 'neutral' : 'warning'
  });

  // 6. Liquidez de Mercado
  let liqScore = 50;
  if (asset.dailyLiquidity >= 50000000) {
    liqScore = 98;
    strengths.push(`Excelente liquidez de mercado (R$ ${(asset.dailyLiquidity / 1000000).toFixed(0)}M diários)`);
  } else if (asset.dailyLiquidity >= 10000000) {
    liqScore = 85;
    strengths.push(`Boa liquidez diária (R$ ${(asset.dailyLiquidity / 1000000).toFixed(1)}M)`);
  } else if (asset.dailyLiquidity >= 2000000) {
    liqScore = 65;
  } else {
    liqScore = 40;
    warnings.push(`Liquidez restrita (abaixo de R$ 2M/dia), exigindo atenção ao tamanho das ordens`);
  }

  pillars.push({
    name: 'Liquidez & Negociação',
    weightPct: weights.liquidity,
    score: liqScore,
    weightedScore: (liqScore * weights.liquidity) / 100,
    description: `Volume médio diário: R$ ${(asset.dailyLiquidity / 1000000).toFixed(1)}M`,
    status: liqScore >= 80 ? 'excellent' : liqScore >= 65 ? 'good' : liqScore >= 50 ? 'neutral' : 'warning'
  });

  // Calculate weighted total score
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const rawTotalScore = pillars.reduce((acc, p) => acc + p.weightedScore, 0);
  const totalScore = Math.round((rawTotalScore / (totalWeight || 100)) * 100) / 100;

  const grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' = 
    totalScore >= 88 ? 'A+' :
    totalScore >= 78 ? 'A' :
    totalScore >= 68 ? 'B+' :
    totalScore >= 55 ? 'B' :
    totalScore >= 40 ? 'C' : 'D';

  const summary = totalScore >= 80 
    ? 'Ativo com fundamentos excepcionais, alta rentabilidade e gestão financeira equilibrada.'
    : totalScore >= 65 
    ? 'Ativo sólido com bons indicadores operacionais e valuation compatível com o setor.'
    : totalScore >= 50
    ? 'Ativo intermediário com oportunidades, mas com pontos de atenção a monitorar.'
    : 'Ativo com múltiplos pontos de risco ou desequilíbrio fundamentalista.';

  return {
    ticker: asset.ticker,
    type: 'Ação',
    totalScore: Math.round(totalScore),
    grade,
    summary,
    strengths,
    warnings,
    pillars
  };
}

/**
 * Calculates a fully transparent, dedicated multi-factor score for B3 Real Estate Funds (FIIs)
 */
export function calculateFiiScore(
  asset: Extract<B3AssetFundamental, { type: 'FII' }>,
  weights: FiiScoreWeights = DEFAULT_FII_WEIGHTS
): AssetScoreResult {
  const strengths: string[] = [];
  const warnings: string[] = [];
  const pillars: ScorePillarBreakdown[] = [];

  // 1. Dividend Yield & Rendimentos (25%)
  let yieldScore = 50;
  if (asset.dividendYield >= 11.5) {
    yieldScore = 95;
    strengths.push(`Elevado Dividend Yield de ${asset.dividendYield.toFixed(1)}% nos últimos 12 meses`);
  } else if (asset.dividendYield >= 9.0) {
    yieldScore = 85;
    strengths.push(`Bom Dividend Yield anualizado de ${asset.dividendYield.toFixed(1)}%`);
  } else if (asset.dividendYield >= 7.5) {
    yieldScore = 70;
  } else if (asset.dividendYield >= 6.0) {
    yieldScore = 50;
  } else {
    yieldScore = 30;
    warnings.push(`Dividend Yield abaixo da média dos pares (${asset.dividendYield.toFixed(1)}%)`);
  }

  pillars.push({
    name: 'Rendimentos & Dividend Yield',
    weightPct: weights.yields,
    score: yieldScore,
    weightedScore: (yieldScore * weights.yields) / 100,
    description: `DY 12M ${asset.dividendYield.toFixed(1)}% | Último R$ ${asset.lastDividend.toFixed(2)}/cota`,
    status: yieldScore >= 80 ? 'excellent' : yieldScore >= 65 ? 'good' : yieldScore >= 50 ? 'neutral' : 'warning'
  });

  // 2. Valuation (P/VP) (20%)
  let valScore = 50;
  if (asset.pvp >= 0.90 && asset.pvp <= 1.02) {
    valScore = 95;
    strengths.push(`Preço de mercado alinhado ou com leve desconto sobre o laudo patrimonial (P/VP de ${asset.pvp.toFixed(2)}x)`);
  } else if (asset.pvp < 0.90 && asset.pvp >= 0.80) {
    valScore = 85;
    strengths.push(`Forte desconto patrimonial (P/VP de ${asset.pvp.toFixed(2)}x)`);
  } else if (asset.pvp < 0.80) {
    valScore = 65;
    warnings.push(`Desconto patrimonial excessivo (${asset.pvp.toFixed(2)}x), podendo indicar risco de crédito ou vacância estrutural`);
  } else if (asset.pvp > 1.02 && asset.pvp <= 1.08) {
    valScore = 70;
    warnings.push(`Negociado com leve ágio sobre o valor patrimonial (P/VP de ${asset.pvp.toFixed(2)}x)`);
  } else {
    valScore = 40;
    warnings.push(`Ágio significativo sobre o patrimônio líquido (P/VP de ${asset.pvp.toFixed(2)}x)`);
  }

  pillars.push({
    name: 'Valuation Patrimonial (P/VP)',
    weightPct: weights.valuation,
    score: valScore,
    weightedScore: (valScore * weights.valuation) / 100,
    description: `P/VP ${asset.pvp.toFixed(2)}x (${asset.pvp < 1 ? 'Com Desconto' : 'Com Ágio'})`,
    status: valScore >= 80 ? 'excellent' : valScore >= 65 ? 'good' : valScore >= 50 ? 'neutral' : 'warning'
  });

  // 3. Qualidade dos Ativos & Vacância (20%)
  const isPaperOrCredit = 
    asset.fiiType === 'Papel' || 
    asset.fiiType === 'FOF' || 
    asset.fiiType === 'Fiagro' ||
    Boolean(
      asset.fiiSegment && (
        asset.fiiSegment.toLowerCase().includes('título') ||
        asset.fiiSegment.toLowerCase().includes('titulo') ||
        asset.fiiSegment.toLowerCase().includes('papel') ||
        asset.fiiSegment.toLowerCase().includes('papeis') ||
        asset.fiiSegment.toLowerCase().includes('papéis') ||
        asset.fiiSegment.toLowerCase().includes('receb') ||
        asset.fiiSegment.toLowerCase().includes('cri') ||
        asset.fiiSegment.toLowerCase().includes('fof') ||
        asset.fiiSegment.toLowerCase().includes('fundo de fundo') ||
        asset.fiiSegment.toLowerCase().includes('agro') ||
        asset.fiiSegment.toLowerCase().includes('fiagro') ||
        asset.fiiSegment.toLowerCase().includes('infra') ||
        asset.fiiSegment.toLowerCase().includes('valores mob')
      )
    ) ||
    (asset.propertiesCount === 0 && asset.physicalVacancy === 0) ||
    ['KNCR11', 'MXRF11', 'CPTS11', 'RECR11', 'RBRR11', 'VRTA11', 'VGIR11', 'HABT11', 'TGAR11', 'CVBI11', 'BCFF11', 'BCFH11', 'HFOF11', 'KFOF11', 'XPSF11', 'MCCI11', 'VGIA11', 'KNSC11'].includes(asset.ticker.toUpperCase());

  let vacScore = 75;
  if (isPaperOrCredit) {
    vacScore = 90;
    strengths.push('Fundo de papel/crédito/FOF sem risco de vacância física de imóveis');
  } else {
    if (asset.physicalVacancy === 0) {
      vacScore = 98;
      strengths.push('100% dos imóveis ocupados (zero vacância física)');
    } else if (asset.physicalVacancy <= 4.0) {
      vacScore = 90;
      strengths.push(`Baixa vacância física (${asset.physicalVacancy.toFixed(1)}%)`);
    } else if (asset.physicalVacancy <= 8.0) {
      vacScore = 75;
      strengths.push(`Vacância física controlada (${asset.physicalVacancy.toFixed(1)}%)`);
    } else if (asset.physicalVacancy <= 15.0) {
      vacScore = 50;
      warnings.push(`Vacância física moderada (${asset.physicalVacancy.toFixed(1)}%)`);
    } else {
      vacScore = 25;
      warnings.push(`Elevada vacância física (${asset.physicalVacancy.toFixed(1)}%), pressionando receitas de locação`);
    }
  }

  pillars.push({
    name: 'Ocupação & Qualidade dos Ativos',
    weightPct: weights.vacancy,
    score: vacScore,
    weightedScore: (vacScore * weights.vacancy) / 100,
    description: isPaperOrCredit ? 'Fundo de CRIs / Recebíveis / Títulos' : `Vacância Física: ${asset.physicalVacancy.toFixed(1)}% | Fin.: ${asset.financialVacancy.toFixed(1)}%`,
    status: vacScore >= 80 ? 'excellent' : vacScore >= 65 ? 'good' : vacScore >= 50 ? 'neutral' : 'warning'
  });

  // 4. Diversificação de Imóveis e Inquilinos (15%)
  let divScore = 50;
  if (isPaperOrCredit) {
    divScore = 88;
    strengths.push('Diversificação pulverizada em múltiplos títulos de crédito e devedores');
  } else {
    if (asset.propertiesCount >= 15 && (asset.topTenantsShare === 0 || asset.topTenantsShare <= 30)) {
      divScore = 95;
      strengths.push(`Portfólio altamente multi-imóvel e multi-inquilino (${asset.propertiesCount} imóveis)`);
    } else if (asset.propertiesCount >= 8) {
      divScore = 80;
      strengths.push(`Boa diversificação geográfica com ${asset.propertiesCount} propriedades`);
    } else if (asset.propertiesCount >= 3) {
      divScore = 65;
    } else if (asset.propertiesCount >= 1) {
      divScore = 45;
      warnings.push(`Fundo mono-imóvel ou com poucas propriedades (${asset.propertiesCount}), concentrando risco`);
    } else {
      divScore = 50;
    }
  }

  pillars.push({
    name: 'Diversificação do Portfólio',
    weightPct: weights.diversification,
    score: divScore,
    weightedScore: (divScore * weights.diversification) / 100,
    description: isPaperOrCredit ? 'Carteira de Crédito Imobiliário / Títulos' : `${asset.propertiesCount} imóveis ${asset.topTenantsShare > 0 ? `| Top Inquilinos ${asset.topTenantsShare.toFixed(0)}%` : ''}`,
    status: divScore >= 80 ? 'excellent' : divScore >= 65 ? 'good' : divScore >= 50 ? 'neutral' : 'warning'
  });

  // 5. Liquidez no Mercado Secundário (10%)
  let liqScore = 50;
  if (asset.dailyLiquidity >= 8000000) {
    liqScore = 98;
    strengths.push(`Alta liquidez diária na B3 (R$ ${(asset.dailyLiquidity / 1000000).toFixed(1)}M diários)`);
  } else if (asset.dailyLiquidity >= 2500000) {
    liqScore = 85;
    strengths.push(`Liquidez diária confortável (R$ ${(asset.dailyLiquidity / 1000000).toFixed(1)}M)`);
  } else if (asset.dailyLiquidity >= 800000) {
    liqScore = 65;
  } else {
    liqScore = 35;
    warnings.push(`Liquidez diária reduzida (abaixo de R$ 800 mil/dia)`);
  }

  pillars.push({
    name: 'Liquidez Diária',
    weightPct: weights.liquidity,
    score: liqScore,
    weightedScore: (liqScore * weights.liquidity) / 100,
    description: `Volume médio: R$ ${(asset.dailyLiquidity / 1000000).toFixed(1)}M / dia`,
    status: liqScore >= 80 ? 'excellent' : liqScore >= 65 ? 'good' : liqScore >= 50 ? 'neutral' : 'warning'
  });

  // 6. Porte & Robustez Patrimonial (10%)
  let scaleScore = 50;
  if (asset.netWorth >= 3000) {
    scaleScore = 95;
    strengths.push(`Fundo de grande porte (PL de R$ ${(asset.netWorth / 1000).toFixed(1)} bilhões) com poder de barganha`);
  } else if (asset.netWorth >= 1000) {
    scaleScore = 82;
    strengths.push(`Patrimônio consolidado acima de R$ 1 bilhão`);
  } else if (asset.netWorth >= 400) {
    scaleScore = 65;
  } else {
    scaleScore = 40;
    warnings.push(`Fundo de menor porte (PL abaixo de R$ 400 milhões)`);
  }

  pillars.push({
    name: 'Porte Patrimonial (PL)',
    weightPct: weights.scale,
    score: scaleScore,
    weightedScore: (scaleScore * weights.scale) / 100,
    description: `Patrimônio Líquido: R$ ${(asset.netWorth >= 1000 ? (asset.netWorth/1000).toFixed(1) + ' bilhões' : asset.netWorth + ' milhões')}`,
    status: scaleScore >= 80 ? 'excellent' : scaleScore >= 65 ? 'good' : scaleScore >= 50 ? 'neutral' : 'warning'
  });

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const rawTotalScore = pillars.reduce((acc, p) => acc + p.weightedScore, 0);
  const totalScore = Math.round((rawTotalScore / (totalWeight || 100)) * 100) / 100;

  const grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' = 
    totalScore >= 88 ? 'A+' :
    totalScore >= 78 ? 'A' :
    totalScore >= 68 ? 'B+' :
    totalScore >= 55 ? 'B' :
    totalScore >= 40 ? 'C' : 'D';

  const summary = totalScore >= 80 
    ? 'FII de primeira linha (Tier 1), com gestão qualificada, portfólio defensivo e excelente fluxo de caixa.'
    : totalScore >= 65 
    ? 'FII consistente com boa relação risco-retorno e distribuição regular de rendimentos.'
    : totalScore >= 50
    ? 'FII intermediário com retorno aceitável, mas com pontos específicos de concentração ou vacância a acompanhar.'
    : 'FII com fatores elevados de risco (vacância estrutural, liquidez baixa ou desconto severo).';

  return {
    ticker: asset.ticker,
    type: 'FII',
    totalScore: Math.round(totalScore),
    grade,
    summary,
    strengths,
    warnings,
    pillars
  };
}

/**
 * Returns Hex/Tailwind color based on 0-100 score
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981'; // Emerald
  if (score >= 65) return '#3b82f6'; // Blue
  if (score >= 50) return '#f59e0b'; // Amber
  return '#ef4444'; // Red
}

export function getGradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return '#10b981';
  if (grade === 'B+' || grade === 'B') return '#3b82f6';
  if (grade === 'C') return '#f59e0b';
  return '#ef4444';
}

/**
 * Universal scorer helper for any B3 Asset
 */
export function calculateUniversalAssetScore(
  fundamental: B3AssetFundamental,
  customStockWeights?: StockScoreWeights,
  customFiiWeights?: FiiScoreWeights
): AssetScoreResult {
  if (fundamental.type === 'FII') {
    return calculateFiiScore(fundamental, customFiiWeights || DEFAULT_FII_WEIGHTS);
  }
  return calculateStockScore(fundamental, customStockWeights || DEFAULT_STOCK_WEIGHTS);
}
