import { getB3AssetFundamental, B3AssetFundamental } from './b3Fundamentals';

export interface PositionInput {
  ticker: string;
  type: string;
  totalQuantity: number;
  totalInvested: number;
  averagePrice: number;
  currentPrice: number | null;
  currentValue: number | null;
  dividendsReceived: number;
  yieldOnCost: number;
}

export interface ConcentrationItem {
  name: string;
  value: number;
  percentage: number;
  count: number;
  tickers: string[];
  status: 'safe' | 'warning' | 'danger';
}

export interface SmartAlert {
  id: string;
  type: 'concentration_asset' | 'concentration_sector' | 'concentration_issuer' | 'macro_imbalance' | 'debt_risk' | 'vacancy_risk' | 'liquidity_warning' | 'valuation_opportunity';
  severity: 'high' | 'medium' | 'low' | 'opportunity';
  title: string;
  message: string;
  actionRecommendation: string;
  ticker?: string;
}

export interface PortfolioDiagnosisResult {
  totalValue: number;
  totalInvested: number;
  totalGain: number;
  totalGainPct: number;
  
  // Macro breakdown
  stocksValue: number;
  stocksPct: number;
  stocksCount: number;
  fiisValue: number;
  fiisPct: number;
  fiisCount: number;
  
  // Diversification Index (0-100, where 100 is optimal multi-sector balanced distribution)
  diversificationScore: number;
  diversificationLevel: 'Excelente' | 'Boa' | 'Moderada' | 'Concentrada' | 'Crítica';
  herfindahlIndex: number; // HHI raw
  
  // Concentrations
  topAssetConcentrations: ConcentrationItem[];
  sectorConcentrations: ConcentrationItem[];
  segmentConcentrations: ConcentrationItem[];
  issuerConcentrations: ConcentrationItem[];
  
  // Best & Worst Performers
  topGainers: Array<{ ticker: string; gainPct: number; gainAmount: number; currentValue: number }>;
  topLosers: Array<{ ticker: string; gainPct: number; gainAmount: number; currentValue: number }>;
  
  // High Yielders
  topDividendYielders: Array<{ ticker: string; yieldOnCost: number; dividendsReceived: number }>;

  // Automated Alerts
  alerts: SmartAlert[];
  
  // Actionable Summary
  summaryText: string;
}

export function runPortfolioDiagnosis(
  positions: PositionInput[],
  quotes: Record<string, number> = {},
  maxAssetLimitPct: number = 15.0,
  maxSectorLimitPct: number = 25.0
): PortfolioDiagnosisResult {
  const validPositions = positions.filter(p => p.totalQuantity > 0);
  
  let totalValue = 0;
  let totalInvested = 0;
  let stocksValue = 0;
  let fiisValue = 0;
  let stocksCount = 0;
  let fiisCount = 0;

  // Enriched positions with fundamentals
  const enriched = validPositions.map(pos => {
    const quote = quotes[pos.ticker] || pos.currentPrice || pos.averagePrice;
    const curVal = quote * pos.totalQuantity;
    const invVal = pos.totalInvested;
    const gain = curVal - invVal;
    const gainPct = invVal > 0 ? (gain / invVal) * 100 : 0;
    const fund = getB3AssetFundamental(pos.ticker, pos.type, quote);
    
    totalValue += curVal;
    totalInvested += invVal;

    if (fund.type === 'FII' || pos.type === 'FII') {
      fiisValue += curVal;
      fiisCount += 1;
    } else {
      stocksValue += curVal;
      stocksCount += 1;
    }

    return {
      pos,
      quote,
      curVal,
      invVal,
      gain,
      gainPct,
      fund
    };
  });

  const totalGain = totalValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const stocksPct = totalValue > 0 ? (stocksValue / totalValue) * 100 : 0;
  const fiisPct = totalValue > 0 ? (fiisValue / totalValue) * 100 : 0;

  // 1. Asset Concentrations
  const assetConcentrations: ConcentrationItem[] = enriched
    .map(item => {
      const pct = totalValue > 0 ? (item.curVal / totalValue) * 100 : 0;
      const status: 'safe' | 'warning' | 'danger' = pct > maxAssetLimitPct ? 'danger' : pct > (maxAssetLimitPct * 0.75) ? 'warning' : 'safe';
      return {
        name: item.pos.ticker,
        value: item.curVal,
        percentage: pct,
        count: 1,
        tickers: [item.pos.ticker],
        status
      };
    })
    .sort((a, b) => b.value - a.value);

  // 2. Sector Concentrations (Ações e FIIs macro)
  const sectorMap: Record<string, { value: number; tickers: string[] }> = {};
  enriched.forEach(item => {
    let sectorName = 'Outros';
    if (item.fund.type === 'Ação') {
      sectorName = item.fund.sector || 'Ações - Outros';
    } else {
      sectorName = `FIIs - ${item.fund.fiiSegment || item.fund.fiiType || 'Geral'}`;
    }
    if (!sectorMap[sectorName]) {
      sectorMap[sectorName] = { value: 0, tickers: [] };
    }
    sectorMap[sectorName].value += item.curVal;
    sectorMap[sectorName].tickers.push(item.pos.ticker);
  });

  const sectorConcentrations: ConcentrationItem[] = Object.entries(sectorMap)
    .map(([name, data]) => {
      const pct = totalValue > 0 ? (data.value / totalValue) * 100 : 0;
      const status: 'safe' | 'warning' | 'danger' = pct > maxSectorLimitPct ? 'danger' : pct > (maxSectorLimitPct * 0.8) ? 'warning' : 'safe';
      return {
        name,
        value: data.value,
        percentage: pct,
        count: data.tickers.length,
        tickers: data.tickers,
        status
      };
    })
    .sort((a, b) => b.value - a.value);

  // 3. Segment Concentrations
  const segmentMap: Record<string, { value: number; tickers: string[] }> = {};
  enriched.forEach(item => {
    const segName = item.fund.type === 'FII' ? item.fund.fiiSegment : item.fund.segment;
    const finalSeg = segName || 'Geral';
    if (!segmentMap[finalSeg]) {
      segmentMap[finalSeg] = { value: 0, tickers: [] };
    }
    segmentMap[finalSeg].value += item.curVal;
    segmentMap[finalSeg].tickers.push(item.pos.ticker);
  });

  const segmentConcentrations: ConcentrationItem[] = Object.entries(segmentMap)
    .map(([name, data]) => {
      const pct = totalValue > 0 ? (data.value / totalValue) * 100 : 0;
      const status: 'safe' | 'warning' | 'danger' = pct > 30 ? 'danger' : pct > 20 ? 'warning' : 'safe';
      return {
        name,
        value: data.value,
        percentage: pct,
        count: data.tickers.length,
        tickers: data.tickers,
        status
      };
    })
    .sort((a, b) => b.value - a.value);

  // 4. Issuer / Administrator Concentrations
  const issuerMap: Record<string, { value: number; tickers: string[] }> = {};
  enriched.forEach(item => {
    let issuer = 'Diversos';
    if (item.fund.type === 'Ação') {
      // Group ITSA4 + ITUB4 under Itaú Unibanco Group
      if (item.pos.ticker.startsWith('ITSA') || item.pos.ticker.startsWith('ITUB')) {
        issuer = 'Grupo Itaú Unibanco / Itaúsa';
      } else if (item.pos.ticker.startsWith('PETR')) {
        issuer = 'Grupo Petrobras';
      } else if (item.pos.ticker.startsWith('BBAS') || item.pos.ticker.startsWith('BBSE')) {
        issuer = 'Grupo Banco do Brasil';
      } else {
        issuer = item.fund.issuer || item.fund.name || item.pos.ticker;
      }
    } else {
      issuer = item.fund.administrator || 'Gestão FII';
    }

    if (!issuerMap[issuer]) {
      issuerMap[issuer] = { value: 0, tickers: [] };
    }
    issuerMap[issuer].value += item.curVal;
    issuerMap[issuer].tickers.push(item.pos.ticker);
  });

  const issuerConcentrations: ConcentrationItem[] = Object.entries(issuerMap)
    .map(([name, data]) => {
      const pct = totalValue > 0 ? (data.value / totalValue) * 100 : 0;
      const status: 'safe' | 'warning' | 'danger' = pct > 25 ? 'danger' : pct > 18 ? 'warning' : 'safe';
      return {
        name,
        value: data.value,
        percentage: pct,
        count: data.tickers.length,
        tickers: data.tickers,
        status
      };
    })
    .sort((a, b) => b.value - a.value);

  // 5. Herfindahl-Hirschman Index (HHI) calculation for true Diversification Score
  // HHI = Sum of squares of percentage shares (0 to 10,000)
  // Low HHI (< 1,500) = Unconcentrated/Diversified
  // Moderate HHI (1,500 - 2,500) = Moderate
  // High HHI (> 2,500) = Highly concentrated
  let hhi = 0;
  assetConcentrations.forEach(a => {
    hhi += Math.pow(a.percentage, 2);
  });

  // Convert HHI to 0-100 Score where 100 is perfectly diversified
  let diversificationScore = 50;
  if (validPositions.length === 0) {
    diversificationScore = 0;
  } else if (validPositions.length === 1) {
    diversificationScore = 15;
  } else {
    // Normalization curve: HHI of 800 or less = 100 pts; HHI of 3500+ = 25 pts
    const normalized = Math.max(0, Math.min(100, Math.round(100 - (hhi / 35))));
    diversificationScore = Math.max(20, normalized);
  }

  const diversificationLevel: 'Excelente' | 'Boa' | 'Moderada' | 'Concentrada' | 'Crítica' = 
    diversificationScore >= 85 ? 'Excelente' :
    diversificationScore >= 70 ? 'Boa' :
    diversificationScore >= 55 ? 'Moderada' :
    diversificationScore >= 40 ? 'Concentrada' : 'Crítica';

  // 6. Top Gainers & Losers
  const topGainers = enriched
    .filter(i => i.gainPct > 0)
    .sort((a, b) => b.gainPct - a.gainPct)
    .slice(0, 5)
    .map(i => ({
      ticker: i.pos.ticker,
      gainPct: i.gainPct,
      gainAmount: i.gain,
      currentValue: i.curVal
    }));

  const topLosers = enriched
    .filter(i => i.gainPct < 0)
    .sort((a, b) => a.gainPct - b.gainPct)
    .slice(0, 5)
    .map(i => ({
      ticker: i.pos.ticker,
      gainPct: i.gainPct,
      gainAmount: i.gain,
      currentValue: i.curVal
    }));

  // Top Yielders (YoC)
  const topDividendYielders = enriched
    .map(i => ({
      ticker: i.pos.ticker,
      yieldOnCost: i.pos.yieldOnCost || 0,
      dividendsReceived: i.pos.dividendsReceived || 0
    }))
    .sort((a, b) => b.yieldOnCost - a.yieldOnCost)
    .slice(0, 5);

  // 7. Generate Smart Alerts
  const alerts: SmartAlert[] = [];

  // Asset Concentration Alert
  const highestAsset = assetConcentrations[0];
  if (highestAsset && highestAsset.percentage > maxAssetLimitPct) {
    alerts.push({
      id: 'alert_asset_conc',
      type: 'concentration_asset',
      severity: highestAsset.percentage > (maxAssetLimitPct * 1.5) ? 'high' : 'medium',
      title: `Concentração Elevada no Ativo ${highestAsset.name}`,
      message: `Seu maior ativo (${highestAsset.name}) representa ${highestAsset.percentage.toFixed(1)}% de toda a sua carteira, acima do teto prudencial configurado de ${maxAssetLimitPct.toFixed(0)}%.`,
      actionRecommendation: `Direcione os próximos aportes para outras posições sub-alocadas da carteira para diluir essa concentração sem necessidade de venda.`,
      ticker: highestAsset.name
    });
  }

  // Sector Concentration Alert
  const highestSector = sectorConcentrations[0];
  if (highestSector && highestSector.percentage > maxSectorLimitPct) {
    alerts.push({
      id: 'alert_sector_conc',
      type: 'concentration_sector',
      severity: highestSector.percentage > (maxSectorLimitPct * 1.4) ? 'high' : 'medium',
      title: `Concentração Setorial em ${highestSector.name}`,
      message: `O setor ${highestSector.name} concentra ${highestSector.percentage.toFixed(1)}% do seu patrimônio (composto por: ${highestSector.tickers.join(', ')}).`,
      actionRecommendation: `Considere explorar setores complementares (ex: Utilidade Pública, Saúde ou FIIs de Tijolo) para aumentar a resiliência a ciclos econômicos.`
    });
  }

  // Issuer Concentration Alert
  const highestIssuer = issuerConcentrations[0];
  if (highestIssuer && highestIssuer.percentage > 25.0 && highestIssuer.count > 1) {
    alerts.push({
      id: 'alert_issuer_conc',
      type: 'concentration_issuer',
      severity: 'medium',
      title: `Exposição Combinada ao ${highestIssuer.name}`,
      message: `Os ativos (${highestIssuer.tickers.join(', ')}) pertencem ao mesmo grupo controlador ou gestora e somam ${highestIssuer.percentage.toFixed(1)}% da carteira.`,
      actionRecommendation: `Acompanhe os resultados corporativos consolidados do grupo para mitigar riscos de governança compartilhada.`
    });
  }

  // Fundamental Risk Alerts
  enriched.forEach(item => {
    if (item.fund.type === 'Ação') {
      if (item.fund.sector !== 'Financeiro' && item.fund.netDebtOverEbitda > 3.5) {
        alerts.push({
          id: `debt_${item.pos.ticker}`,
          type: 'debt_risk',
          severity: 'medium',
          title: `Alavancagem Elevada em ${item.pos.ticker}`,
          message: `${item.pos.ticker} possui Dívida Líquida/EBITDA de ${item.fund.netDebtOverEbitda.toFixed(2)}x, nível que exige acompanhamento em cenários de juros altos.`,
          actionRecommendation: `Verifique o cronograma de amortização da dívida nos relatórios trimestrais da empresa antes de novos aportes.`,
          ticker: item.pos.ticker
        });
      }
    } else if (item.fund.type === 'FII') {
      if (item.fund.physicalVacancy > 15.0) {
        alerts.push({
          id: `vac_${item.pos.ticker}`,
          type: 'vacancy_risk',
          severity: 'medium',
          title: `Vacância Física Elevada em ${item.pos.ticker}`,
          message: `O FII ${item.pos.ticker} está com vacância física de ${item.fund.physicalVacancy.toFixed(1)}%, impactando a geração de renda por cota.`,
          actionRecommendation: `Monitore os relatórios gerenciais para acompanhar novas locações e renovações contratuais.`,
          ticker: item.pos.ticker
        });
      }
    }
  });

  // Valuation Opportunity Alert
  enriched.forEach(item => {
    if (item.fund.type === 'FII' && item.fund.pvp < 0.92 && item.fund.pvp > 0.75 && item.fund.dividendYield >= 9.0) {
      alerts.push({
        id: `opp_${item.pos.ticker}`,
        type: 'valuation_opportunity',
        severity: 'opportunity',
        title: `Oportunidade Patrimonial em ${item.pos.ticker}`,
        message: `${item.pos.ticker} negocia com desconto de ${((1 - item.fund.pvp) * 100).toFixed(0)}% sobre o VP (P/VP ${item.fund.pvp.toFixed(2)}) e DY de ${item.fund.dividendYield.toFixed(1)}%.`,
        actionRecommendation: `Ativo elegível para rebalanceamento com margem de segurança patrimonial favorável.`,
        ticker: item.pos.ticker
      });
    }
  });

  // Summary message in clear Portuguese
  let summaryText = '';
  if (validPositions.length === 0) {
    summaryText = 'Nenhum ativo em custódia no momento. Adicione suas compras de Ações e FIIs para iniciar o diagnóstico.';
  } else {
    summaryText = `Sua carteira possui ${validPositions.length} ativos (${stocksCount} Ações e ${fiisCount} FIIs), totalizando ${stocksPct.toFixed(0)}% em Ações e ${fiisPct.toFixed(0)}% em FIIs. A diversificação geral está em nível ${diversificationLevel} (Score ${diversificationScore}/100), com maior ativo representando ${highestAsset?.percentage.toFixed(1)}% do patrimônio.`;
  }

  return {
    totalValue,
    totalInvested,
    totalGain,
    totalGainPct,
    stocksValue,
    stocksPct,
    stocksCount,
    fiisValue,
    fiisPct,
    fiisCount,
    diversificationScore,
    diversificationLevel,
    herfindahlIndex: Math.round(hhi),
    topAssetConcentrations: assetConcentrations.slice(0, 10),
    sectorConcentrations,
    segmentConcentrations,
    issuerConcentrations,
    topGainers,
    topLosers,
    topDividendYielders,
    alerts,
    summaryText
  };
}

export const diagnosePortfolio = runPortfolioDiagnosis;

