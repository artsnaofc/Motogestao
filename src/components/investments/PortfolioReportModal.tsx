import React, { useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import {
  Share2,
  Copy,
  FileSpreadsheet,
  X,
  Check,
  Sparkles,
  Download,
  ShieldAlert,
  TrendingUp,
  Coins,
  Layers,
} from 'lucide-react';
import {
  Dividend,
  InvestmentTransaction,
  ValuationTarget,
} from '../../types';
import {
  PerformanceMetricsResult,
  PortfolioProjectionSummary,
  getInvestmentTransactionNetAmount,
} from '../../lib/investmentCalculations';
import { PortfolioDiagnosisResult } from '../../lib/portfolioDiagnosis';
import {
  AssetAllocationTarget,
  RebalanceRulesConfig,
} from '../../lib/rebalanceEngine';
import { getB3AssetFundamental } from '../../lib/b3Fundamentals';

export interface ReportPosition {
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
  currentPct?: number;
}

interface PortfolioReportModalProps {
  positions: ReportPosition[];
  allPositions?: ReportPosition[];
  totalInvested: number;
  totalCurrent: number;
  totalCapitalGain: number;
  totalRealizedGain?: number;
  capitalGainPercent: number;
  dividendsReceived: number;
  divTotals?: {
    received: number;
    provisioned: number;
    considered: number;
  };
  totalReturnWithDividends: number;
  totalReturnPercent: number;
  overallYieldOnCost?: number;
  portfolioProjections?: PortfolioProjectionSummary;
  performanceMetrics?: PerformanceMetricsResult;
  portfolioDiagnosis?: PortfolioDiagnosisResult;
  allocationBreakdown?: Array<{ type: string; val: number; pct: number }>;
  dividends?: Dividend[];
  investmentTransactions?: InvestmentTransaction[];
  targetAllocations?: Record<string, AssetAllocationTarget>;
  rulesConfig?: RebalanceRulesConfig;
  valuationTargets?: Record<string, ValuationTarget>;
  b3AssetsMetadata?: Record<string, any>;
  configuredReserve?: { name: string; saldo_atual?: number } | null;
  quoteVariations?: Record<string, number>;
  lastQuoteUpdatedAt?: number | string | null;
  onClose: () => void;
  formatCurrency: (val: number) => string;
  analysisMode?: 'received_only' | 'include_provisioned';
}

type ReportMode = 'chatgpt_prompt' | 'markdown_data' | 'compact';

export function PortfolioReportModal({
  positions,
  allPositions = [],
  totalInvested,
  totalCurrent,
  totalCapitalGain,
  totalRealizedGain = 0,
  capitalGainPercent,
  dividendsReceived,
  divTotals,
  totalReturnWithDividends,
  totalReturnPercent,
  overallYieldOnCost = 0,
  portfolioProjections,
  performanceMetrics,
  portfolioDiagnosis,
  allocationBreakdown = [],
  dividends = [],
  investmentTransactions = [],
  targetAllocations = {},
  rulesConfig,
  valuationTargets = {},
  b3AssetsMetadata = {},
  configuredReserve = null,
  quoteVariations = {},
  lastQuoteUpdatedAt = null,
  onClose,
  formatCurrency,
  analysisMode = 'received_only',
}: PortfolioReportModalProps) {
  const [copied, setCopied] = useState(false);
  const [reportMode, setReportMode] = useState<ReportMode>('chatgpt_prompt');
  const [customAiQuestion, setCustomAiQuestion] = useState('');
  const [includeFundamentals, setIncludeFundamentals] = useState(true);
  const [includeTargets, setIncludeTargets] = useState(true);
  const [includeDividendsFlow, setIncludeDividendsFlow] = useState(true);
  const [includeTransactions, setIncludeTransactions] = useState(true);

  const isIncProv = analysisMode === 'include_provisioned';

  const formatSignedPct = (val: number | null | undefined, digits = 2) => {
    if (val === null || val === undefined || isNaN(val)) return 'N/D';
    return `${val >= 0 ? '+' : ''}${val.toFixed(digits)}%`;
  };

  const formatNum = (val: number | null | undefined, digits = 2) => {
    if (val === null || val === undefined || isNaN(val) || val === 0) return '-';
    return val.toFixed(digits);
  };

  const getMergedMeta = (ticker: string) => {
    const clean = ticker.toUpperCase().replace(/\.SA$/i, '');
    const base = getB3AssetFundamental(clean) as any;
    const saved = b3AssetsMetadata[clean] || b3AssetsMetadata[ticker] || {};
    return {
      ...(base || {}),
      ...saved,
      sector: saved.sector || base?.sector || '-',
      segment: saved.segment || saved.fiiSegment || base?.segment || base?.fiiSegment || '-',
      fiiType: saved.fiiType || base?.fiiType || '-',
    };
  };

  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      const valA = a.currentValue || a.totalInvested;
      const valB = b.currentValue || b.totalInvested;
      return valB - valA;
    });
  }, [positions]);

  const monthlyDividendsSummary = useMemo(() => {
    const map: Record<string, { received: number; provisioned: number }> = {};
    dividends.forEach(d => {
      if (!d.date) return;
      const monthKey = d.date.slice(0, 7);
      if (!map[monthKey]) map[monthKey] = { received: 0, provisioned: 0 };
      if (d.status === 'received') map[monthKey].received += d.amount;
      else if (d.status === 'provisioned') map[monthKey].provisioned += d.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12);
  }, [dividends]);

  const upcomingProvisioned = useMemo(() => {
    return dividends
      .filter(d => d.status === 'provisioned')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 20);
  }, [dividends]);

  const closedPositions = useMemo(() => {
    return allPositions
      .filter(p => p.totalQuantity <= 0 && Math.abs(p.realizedGain || 0) > 0.01)
      .sort((a, b) => (b.realizedGain || 0) - (a.realizedGain || 0));
  }, [allPositions]);

  const recentTransactions = useMemo(() => {
    return [...investmentTransactions]
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.created_at || '').localeCompare(a.created_at || '');
      })
      .slice(0, 15);
  }, [investmentTransactions]);

  const reportText = useMemo(() => {
    const nowDateStr = new Date().toLocaleDateString('pt-BR');
    const nowTimeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const parsedQuoteDate = lastQuoteUpdatedAt ? new Date(lastQuoteUpdatedAt) : null;
    const quoteSyncStr =
      parsedQuoteDate && !isNaN(parsedQuoteDate.getTime())
        ? parsedQuoteDate.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'N/D';

    if (reportMode === 'compact') {
      let text = `📊 RESUMO EXECUTIVO DA CARTEIRA (${nowDateStr})\n`;
      text += `Modo: ${isIncProv ? 'Proventos Recebidos + Provisionados' : 'Apenas Proventos Recebidos'}\n\n`;
      text += `• Total Investido: ${formatCurrency(totalInvested)}\n`;
      text += `• Patrimônio Atual: ${formatCurrency(totalCurrent)}\n`;
      text += `• Ganho de Capital: ${formatCurrency(totalCapitalGain)} (${formatSignedPct(capitalGainPercent)})\n`;
      if (Math.abs(totalRealizedGain) > 0.01) {
        text += `• Lucro Realizado (Vendas): ${formatCurrency(totalRealizedGain)}\n`;
      }
      text += `• Proventos Considerados: ${formatCurrency(dividendsReceived)}\n`;
      text += `• Lucro Total Combinado: ${formatCurrency(totalReturnWithDividends)} (${formatSignedPct(totalReturnPercent)})\n`;
      if (performanceMetrics) {
        text += `• TWR: ${formatSignedPct(performanceMetrics.twrPercent)} | TIR Anual: ${
          performanceMetrics.tirAnnualPercent !== null ? formatSignedPct(performanceMetrics.tirAnnualPercent) : 'N/D'
        }\n`;
      }
      if (portfolioDiagnosis) {
        text += `• Diversificação: ${portfolioDiagnosis.diversificationScore}/100 (${portfolioDiagnosis.diversificationLevel})\n`;
      }
      if (portfolioProjections) {
        text += `• Renda Passiva Projetada: ${formatCurrency(portfolioProjections.totalProjectedMonthlyIncome)}/mês (${formatCurrency(portfolioProjections.totalProjectedAnnualIncome)}/ano | DY ${portfolioProjections.portfolioProjectedDividendYield.toFixed(2)}%)\n`;
      }
      text += `\n📌 POSIÇÕES ATIVAS (${sortedPositions.length}):\n`;
      sortedPositions.forEach(p => {
        const curVal = p.currentValue || p.totalInvested;
        const weight = totalCurrent > 0 ? (curVal / totalCurrent) * 100 : 0;
        const gainPct = p.totalInvested > 0 ? ((curVal - p.totalInvested) / p.totalInvested) * 100 : 0;
        text += `• ${p.ticker} (${p.type}) [${weight.toFixed(1)}%]: ${p.totalQuantity} cotas | PM ${formatCurrency(p.averagePrice)} | Atual ${formatCurrency(curVal)} (${formatSignedPct(gainPct)}) | YoC ${p.yieldOnCost.toFixed(2)}%\n`;
      });
      return text;
    }

    const lines: string[] = [];

    if (reportMode === 'chatgpt_prompt') {
      lines.push('🤖 PROMPT DE ANÁLISE PARA IA (CONSULTOR / ANALISTA CNPI)');
      lines.push('---');
      lines.push(
        'Atue como um analista de investimentos sênior (CNPI) e gestor de patrimônio especialista no mercado brasileiro (B3, FIIs e Renda Fixa). Com base no dossiê completo da minha carteira real abaixo, faça uma análise técnica, objetiva e acionável cobrindo:'
      );
      lines.push(
        '1. **Diagnóstico de Risco & Concentração**: Avalie minha exposição por ativo, classe, setor/segmento e os alertas detectados. Aponte riscos ocultos ou correlações excessivas.'
      );
      lines.push(
        '2. **Qualidade Fundamentalista & Valuation**: Analise os múltiplos (P/L, P/VP, ROE, ROIC, Dívida/EBITDA, Vacância, Cap Rate) e compare os preços atuais com meus Preços-Teto cadastrados. Indique o que está barato, justo ou caro.'
      );
      lines.push(
        '3. **Sustentabilidade da Renda Passiva**: Avalie meu Yield on Cost, DY projetado, fluxo mensal de proventos e dependência de poucos pagadores.'
      );
      lines.push(
        '4. **Plano Prático de Rebalanceamento & Próximos Aportes**: Considerando minhas metas (%) e o caixa disponível na Reserva de Investimentos, sugira exatamente quais ativos priorizar, quais segurar/pausar e eventuais pontos de atenção ou realização.'
      );
      if (customAiQuestion.trim()) {
        lines.push(`5. **Foco / Pergunta Específica do Investidor**: ${customAiQuestion.trim()}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    lines.push('# 📊 RELATÓRIO EXECUTIVO DA CARTEIRA DE INVESTIMENTOS');
    lines.push(`- **Data/Hora de Geração:** ${nowDateStr} às ${nowTimeStr}`);
    lines.push(`- **Última Sincronização de Cotações:** ${quoteSyncStr}`);
    lines.push(
      `- **Critério de Proventos:** ${
        isIncProv ? 'Recebidos + Provisionados (A Receber)' : 'Apenas Efetivados/Recebidos'
      }`
    );
    if (configuredReserve) {
      lines.push(
        `- **Caixa / Reserva Vinculada (${configuredReserve.name}):** ${formatCurrency(
          configuredReserve.saldo_atual || 0
        )}`
      );
    }
    lines.push('');

    // 1. Resumo Patrimonial & Performance
    lines.push('## 1. Resumo Patrimonial & Retorno Real');
    lines.push(`- **Total Investido (Custo das Posições Ativas):** ${formatCurrency(totalInvested)}`);
    lines.push(`- **Patrimônio Atual (Valor de Mercado):** ${formatCurrency(totalCurrent)}`);
    lines.push(
      `- **Ganho de Capital (Não Realizado):** ${formatCurrency(totalCapitalGain)} (${formatSignedPct(
        capitalGainPercent
      )})`
    );
    lines.push(`- **Lucro/Prejuízo Realizado em Vendas:** ${formatCurrency(totalRealizedGain)}`);
    lines.push(
      `- **Proventos Recebidos:** ${formatCurrency(divTotals?.received ?? dividendsReceived)}`
    );
    if ((divTotals?.provisioned || 0) > 0) {
      lines.push(`- **Proventos Provisionados (A Receber):** ${formatCurrency(divTotals!.provisioned)}`);
    }
    lines.push(
      `- **Lucro Total Combinado (Capital + Realizado + Proventos):** ${formatCurrency(
        totalReturnWithDividends
      )} (${formatSignedPct(totalReturnPercent)})`
    );
    if (performanceMetrics) {
      lines.push(
        `- **TWR (Rentabilidade Ponderada pelo Tempo):** ${formatSignedPct(
          performanceMetrics.twrPercent
        )}`
      );
      lines.push(
        `- **TIR / XIRR (Taxa Interna de Retorno Anualizada):** ${
          performanceMetrics.tirAnnualPercent !== null
            ? formatSignedPct(performanceMetrics.tirAnnualPercent)
            : 'N/D'
        }`
      );
      if (performanceMetrics.tirPeriodPercent !== null) {
        lines.push(
          `- **TIR Acumulada no Período:** ${formatSignedPct(performanceMetrics.tirPeriodPercent)}`
        );
      }
      lines.push(
        `- **Tempo de Histórico:** ${performanceMetrics.daysElapsed} dias (${performanceMetrics.yearsElapsed.toFixed(
          2
        )} anos)`
      );
    }
    lines.push('');

    // 2. Renda Passiva & Projeções
    lines.push('## 2. Renda Passiva & Projeções');
    lines.push(`- **Yield on Cost Histórico Consolidado:** ${overallYieldOnCost.toFixed(2)}%`);
    if (portfolioProjections) {
      lines.push(
        `- **Renda Passiva Projetada (Anual):** ${formatCurrency(
          portfolioProjections.totalProjectedAnnualIncome
        )}`
      );
      lines.push(
        `- **Renda Passiva Projetada (Média Mensal):** ${formatCurrency(
          portfolioProjections.totalProjectedMonthlyIncome
        )}`
      );
      lines.push(
        `- **Dividend Yield Projetado (sobre Patrimônio Atual):** ${portfolioProjections.portfolioProjectedDividendYield.toFixed(
          2
        )}% a.a.`
      );
      lines.push(
        `- **Yield on Cost Projetado (sobre Custo):** ${portfolioProjections.portfolioProjectedYieldOnCost.toFixed(
          2
        )}% a.a.`
      );
    }
    lines.push('');

    // 3. Alocação por Classe & Diagnóstico de Risco
    lines.push('## 3. Alocação por Classe & Diagnóstico de Risco');
    if (portfolioDiagnosis) {
      lines.push(
        `- **Score de Diversificação:** ${portfolioDiagnosis.diversificationScore}/100 (${portfolioDiagnosis.diversificationLevel}) | **Índice HHI:** ${portfolioDiagnosis.herfindahlIndex.toFixed(
          0
        )}`
      );
    }
    if (allocationBreakdown.length > 0) {
      lines.push('');
      lines.push('| Classe | Patrimônio Atual | Peso (%) |');
      lines.push('| :--- | ---: | ---: |');
      allocationBreakdown.forEach(c => {
        lines.push(`| ${c.type} | ${formatCurrency(c.val)} | ${c.pct.toFixed(2)}% |`);
      });
    }
    if (portfolioDiagnosis && portfolioDiagnosis.sectorConcentrations.length > 0) {
      lines.push('');
      lines.push('### Concentração por Setor (Top 10)');
      lines.push('| Setor | Patrimônio | Peso (%) | Status | Ativos |');
      lines.push('| :--- | ---: | ---: | :--- | :--- |');
      portfolioDiagnosis.sectorConcentrations.slice(0, 10).forEach(s => {
        lines.push(
          `| ${s.name} | ${formatCurrency(s.value)} | ${s.percentage.toFixed(1)}% | ${s.status.toUpperCase()} | ${s.tickers.join(
            ', '
          )} |`
        );
      });
    }
    if (portfolioDiagnosis && portfolioDiagnosis.alerts.length > 0) {
      lines.push('');
      lines.push('### Alertas Automáticos de Diagnóstico');
      portfolioDiagnosis.alerts.forEach(a => {
        lines.push(
          `- **[${a.severity.toUpperCase()}] ${a.title}:** ${a.message} _Recomendação: ${a.actionRecommendation}_`
        );
      });
    }
    lines.push('');

    // 4. Posições Ativas Detalhadas
    lines.push(`## 4. Posições Ativas em Carteira (${sortedPositions.length} ativos)`);
    lines.push(
      '| Ticker | Classe | Setor/Segmento | Qtd | PM | Cotação | Var.Dia | Investido | Atual | Peso % | Ganho R$ | Ganho % | Proventos | YoC % |'
    );
    lines.push(
      '| :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
    );
    sortedPositions.forEach(p => {
      const clean = p.ticker.toUpperCase().replace(/\.SA$/i, '');
      const meta = getMergedMeta(p.ticker);
      const curPrice = p.currentPrice || p.averagePrice;
      const curVal = p.currentValue || p.totalInvested;
      const gainVal = curVal - p.totalInvested;
      const gainPct = p.totalInvested > 0 ? (gainVal / p.totalInvested) * 100 : 0;
      const weight = totalCurrent > 0 ? (curVal / totalCurrent) * 100 : 0;
      const dayVar = quoteVariations[p.ticker] ?? quoteVariations[clean];
      const sectorSeg =
        meta.segment && meta.segment !== '-' && meta.segment !== meta.sector
          ? `${meta.sector !== '-' ? meta.sector + ' / ' : ''}${meta.segment}`
          : meta.sector || '-';
      lines.push(
        `| ${p.ticker} | ${p.type} | ${sectorSeg} | ${p.totalQuantity} | ${formatCurrency(
          p.averagePrice
        )} | ${formatCurrency(curPrice)} | ${
          dayVar !== undefined ? formatSignedPct(dayVar) : '-'
        } | ${formatCurrency(p.totalInvested)} | ${formatCurrency(curVal)} | ${weight.toFixed(
          2
        )}% | ${formatCurrency(gainVal)} | ${formatSignedPct(gainPct)} | ${formatCurrency(
          p.dividendsReceived
        )} | ${p.yieldOnCost.toFixed(2)}% |`
      );
    });
    lines.push('');

    // 5. Destaques da Carteira
    if (portfolioDiagnosis) {
      lines.push('## 5. Destaques de Performance & Pagadores');
      if (portfolioDiagnosis.topGainers.length > 0) {
        lines.push(
          `- **Maiores Altas:** ${portfolioDiagnosis.topGainers
            .slice(0, 3)
            .map(g => `${g.ticker} (${formatSignedPct(g.gainPct)} / ${formatCurrency(g.gainAmount)})`)
            .join(' | ')}`
        );
      }
      if (portfolioDiagnosis.topLosers.length > 0) {
        lines.push(
          `- **Maiores Quedas:** ${portfolioDiagnosis.topLosers
            .slice(0, 3)
            .map(l => `${l.ticker} (${formatSignedPct(l.gainPct)} / ${formatCurrency(l.gainAmount)})`)
            .join(' | ')}`
        );
      }
      if (portfolioDiagnosis.topDividendYielders.length > 0) {
        lines.push(
          `- **Maiores Yield on Cost:** ${portfolioDiagnosis.topDividendYielders
            .slice(0, 5)
            .map(d => `${d.ticker} (${d.yieldOnCost.toFixed(2)}% YoC / ${formatCurrency(d.dividendsReceived)})`)
            .join(' | ')}`
        );
      }
      lines.push('');
    }

    // 6. Metas de Rebalanceamento & Preço-Teto
    if (includeTargets) {
      const targetEntries = sortedPositions.filter(p => {
        const clean = p.ticker.toUpperCase().replace(/\.SA$/i, '');
        return targetAllocations[p.ticker] || targetAllocations[clean] || valuationTargets[p.ticker] || valuationTargets[clean];
      });

      if (rulesConfig || targetEntries.length > 0) {
        lines.push('## 6. Metas de Rebalanceamento, Limites & Preço-Teto');
        if (rulesConfig) {
          lines.push(
            `- **Estratégia Ativa:** ${rulesConfig.activeStrategy} | **Teto p/ Ativo:** ${rulesConfig.maxAssetAllocationPct}% | **Teto p/ Setor:** ${rulesConfig.maxSectorAllocationPct}% | **Max Dív.Líq/EBITDA:** ${rulesConfig.maxDebtEbitdaAllowed}x | **Max P/VP FII:** ${rulesConfig.maxFiiPvpAllowed} | **Max Vacância FII:** ${rulesConfig.maxFiiPhysicalVacancyAllowed}%`
          );
        }
        if (targetEntries.length > 0) {
          lines.push('');
          lines.push('| Ticker | Atual % | Meta % (Faixa) | Desvio (p.p.) | Desvio (R$) | Preço Atual | Preço-Teto | Margem Seg. % | Trava |');
          lines.push('| :--- | ---: | :--- | ---: | ---: | ---: | ---: | ---: | :--- |');
          targetEntries.forEach(p => {
            const clean = p.ticker.toUpperCase().replace(/\.SA$/i, '');
            const t = targetAllocations[p.ticker] || targetAllocations[clean];
            const v = valuationTargets[p.ticker] || valuationTargets[clean];
            const curVal = p.currentValue || p.totalInvested;
            const curPct = totalCurrent > 0 ? (curVal / totalCurrent) * 100 : 0;
            const curPrice = p.currentPrice || p.averagePrice;
            const targetPct = t?.targetPct;
            const diffPct = targetPct !== undefined ? curPct - targetPct : null;
            const idealVal = targetPct !== undefined ? (targetPct / 100) * totalCurrent : null;
            const diffVal = idealVal !== null ? idealVal - curVal : null;
            const ceiling = v?.targetPrice;
            const safetyMargin =
              ceiling && ceiling > 0 && curPrice > 0 ? ((ceiling - curPrice) / curPrice) * 100 : null;
            lines.push(
              `| ${p.ticker} | ${curPct.toFixed(2)}% | ${
                t ? `${t.targetPct.toFixed(1)}% (${t.minPct}-${t.maxPct}%)` : '-'
              } | ${diffPct !== null ? formatSignedPct(diffPct) : '-'} | ${
                diffVal !== null ? formatCurrency(diffVal) : '-'
              } | ${formatCurrency(curPrice)} | ${
                ceiling ? formatCurrency(ceiling) : '-'
              } | ${safetyMargin !== null ? formatSignedPct(safetyMargin) : '-'} | ${
                t?.locked ? 'Bloqueado' : 'Aberto'
              } |`
            );
          });
        }
        lines.push('');
      }
    }

    // 7. Fundamentos & Valuation
    if (includeFundamentals) {
      const stocks = sortedPositions.filter(p => {
        const t = p.type.toLowerCase();
        return t === 'ação' || t === 'acao' || t === 'bdr';
      });
      const fiis = sortedPositions.filter(p => p.type.toLowerCase() === 'fii');

      if (stocks.length > 0 || fiis.length > 0) {
        lines.push('## 7. Indicadores Fundamentalistas');
      }

      if (stocks.length > 0) {
        lines.push('### Ações & BDRs');
        lines.push('| Ticker | Setor | P/L | P/VP | DY 12M | ROE | ROIC | Marg. Líq | Dív.Líq/EBITDA | CNPJ |');
        lines.push('| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |');
        stocks.forEach(p => {
          const m = getMergedMeta(p.ticker);
          lines.push(
            `| ${p.ticker} | ${m.sector || '-'} | ${formatNum(m.pl)} | ${formatNum(m.pvp)} | ${
              m.dividendYield ? `${Number(m.dividendYield).toFixed(2)}%` : '-'
            } | ${m.roe ? `${Number(m.roe).toFixed(1)}%` : '-'} | ${
              m.roic ? `${Number(m.roic).toFixed(1)}%` : '-'
            } | ${m.netMargin ? `${Number(m.netMargin).toFixed(1)}%` : '-'} | ${formatNum(
              m.netDebtOverEbitda
            )} | ${m.cnpj || '-'} |`
          );
        });
        lines.push('');
      }

      if (fiis.length > 0) {
        lines.push('### Fundos Imobiliários (FIIs)');
        lines.push('| Ticker | Tipo | Segmento | P/VP | DY 12M | FFO Yield | Cap Rate | Vacância Fís. | Imóveis | CNPJ |');
        lines.push('| :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | :--- |');
        fiis.forEach(p => {
          const m = getMergedMeta(p.ticker);
          lines.push(
            `| ${p.ticker} | ${m.fiiType || '-'} | ${m.fiiSegment || m.segment || '-'} | ${formatNum(
              m.pvp
            )} | ${m.dividendYield ? `${Number(m.dividendYield).toFixed(2)}%` : '-'} | ${
              m.ffoYield ? `${Number(m.ffoYield).toFixed(2)}%` : '-'
            } | ${m.capRate ? `${Number(m.capRate).toFixed(2)}%` : '-'} | ${
              m.physicalVacancy !== undefined && m.physicalVacancy !== null
                ? `${Number(m.physicalVacancy).toFixed(1)}%`
                : '-'
            } | ${m.propertiesCount || '-'} | ${m.cnpj || '-'} |`
          );
        });
        lines.push('');
      }
    }

    // 8. Fluxo de Proventos
    if (includeDividendsFlow && (monthlyDividendsSummary.length > 0 || upcomingProvisioned.length > 0)) {
      lines.push('## 8. Fluxo Mensal de Proventos & Provisionados');
      if (monthlyDividendsSummary.length > 0) {
        lines.push('### Histórico Mensal (Últimos 12 Meses com Registro)');
        lines.push('| Mês | Recebidos | Provisionados | Total |');
        lines.push('| :--- | ---: | ---: | ---: |');
        monthlyDividendsSummary.forEach(([monthKey, vals]) => {
          lines.push(
            `| ${monthKey} | ${formatCurrency(vals.received)} | ${formatCurrency(
              vals.provisioned
            )} | ${formatCurrency(vals.received + vals.provisioned)} |`
          );
        });
        lines.push('');
      }
      if (upcomingProvisioned.length > 0) {
        lines.push('### Próximos Proventos Provisionados (A Receber)');
        upcomingProvisioned.forEach(d => {
          lines.push(`- ${d.date} | **${d.ticker}** (${d.type}): ${formatCurrency(d.amount)}`);
        });
        lines.push('');
      }
    }

    // 9. Posições Encerradas & Últimas Movimentações
    if (includeTransactions && (closedPositions.length > 0 || recentTransactions.length > 0)) {
      lines.push('## 9. Posições Encerradas & Histórico Recente');
      if (closedPositions.length > 0) {
        lines.push('### Posições Encerradas (Resultado Realizado)');
        closedPositions.forEach(p => {
          lines.push(
            `- **${p.ticker}** (${p.type}): Resultado Realizado ${formatCurrency(
              p.realizedGain || 0
            )} | Proventos Históricos ${formatCurrency(p.dividendsReceived)}`
          );
        });
        lines.push('');
      }
      if (recentTransactions.length > 0) {
        lines.push('### Últimas 15 Movimentações');
        lines.push('| Data | Operação | Ticker | Qtd | Preço Unit. | Valor Líquido |');
        lines.push('| :--- | :--- | :--- | ---: | ---: | ---: |');
        recentTransactions.forEach(tx => {
          const netAmt = getInvestmentTransactionNetAmount(tx);
          const opLabel = tx.operation === 'buy' ? 'Compra' : 'Venda';
          lines.push(
            `| ${tx.date} | ${opLabel} | ${tx.ticker} | ${tx.quantity} | ${formatCurrency(
              tx.price
            )} | ${formatCurrency(netAmt)} |`
          );
        });
        lines.push('');
      }
    }

    return lines.join('\n');
  }, [
    reportMode,
    customAiQuestion,
    includeFundamentals,
    includeTargets,
    includeDividendsFlow,
    includeTransactions,
    sortedPositions,
    totalInvested,
    totalCurrent,
    totalCapitalGain,
    totalRealizedGain,
    capitalGainPercent,
    dividendsReceived,
    divTotals,
    totalReturnWithDividends,
    totalReturnPercent,
    overallYieldOnCost,
    portfolioProjections,
    performanceMetrics,
    portfolioDiagnosis,
    allocationBreakdown,
    monthlyDividendsSummary,
    upcomingProvisioned,
    closedPositions,
    recentTransactions,
    targetAllocations,
    rulesConfig,
    valuationTargets,
    b3AssetsMetadata,
    configuredReserve,
    quoteVariations,
    lastQuoteUpdatedAt,
    isIncProv,
    formatCurrency,
  ]);

  const estimatedTokens = Math.max(1, Math.round(reportText.length / 3.8));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      toast.success(
        reportMode === 'chatgpt_prompt'
          ? 'Dossiê + Prompt copiados! Cole direto no ChatGPT.'
          : 'Relatório copiado com sucesso!'
      );
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('Não foi possível copiar automaticamente. Selecione o texto abaixo.');
    }
  };

  const handleDownloadMarkdown = () => {
    try {
      const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `dossie_carteira_${new Date().toISOString().split('T')[0]}.md`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Arquivo .MD exportado! Você também pode anexá-lo direto no ChatGPT.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao baixar arquivo Markdown.');
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = [
        'Ticker',
        'Tipo',
        'Setor',
        'Segmento',
        'Quantidade',
        'Preco Medio (R$)',
        'Cotacao Atual (R$)',
        'Total Investido (R$)',
        'Patrimonio Atual (R$)',
        'Peso Atual (%)',
        'Ganho Capital (R$)',
        'Ganho Capital (%)',
        'Proventos (R$)',
        'Yield on Cost (%)',
        'Meta Alvo (%)',
        'Preco Teto (R$)',
        'P/VP',
        'P/L',
        'DY 12M (%)',
      ];
      const rows = sortedPositions.map(p => {
        const clean = p.ticker.toUpperCase().replace(/\.SA$/i, '');
        const meta = getMergedMeta(p.ticker);
        const curVal = p.currentValue || p.totalInvested;
        const capitalGain = curVal - p.totalInvested;
        const capitalGainPct = p.totalInvested > 0 ? (capitalGain / p.totalInvested) * 100 : 0;
        const weightPct = totalCurrent > 0 ? (curVal / totalCurrent) * 100 : 0;
        const target = targetAllocations[p.ticker] || targetAllocations[clean];
        const valuation = valuationTargets[p.ticker] || valuationTargets[clean];
        return [
          p.ticker,
          p.type,
          meta.sector || '',
          meta.fiiSegment || meta.segment || '',
          p.totalQuantity,
          p.averagePrice.toFixed(2),
          (p.currentPrice || p.averagePrice).toFixed(2),
          p.totalInvested.toFixed(2),
          curVal.toFixed(2),
          weightPct.toFixed(2),
          capitalGain.toFixed(2),
          capitalGainPct.toFixed(2),
          p.dividendsReceived.toFixed(2),
          p.yieldOnCost.toFixed(2),
          target ? target.targetPct.toFixed(2) : '',
          valuation?.targetPrice ? valuation.targetPrice.toFixed(2) : '',
          meta.pvp ? Number(meta.pvp).toFixed(2) : '',
          meta.pl ? Number(meta.pl).toFixed(2) : '',
          meta.dividendYield ? Number(meta.dividendYield).toFixed(2) : '',
        ];
      });

      const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `carteira_investimentos_${new Date().toISOString().split('T')[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Arquivo CSV completo exportado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar relatório CSV.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl p-4 sm:p-6 rounded-3xl border border-border/70 bg-card shadow-2xl space-y-4 max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex justify-between items-start gap-3 pb-3 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-500 shrink-0">
              <Share2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
                Relatório Executivo da Carteira
              </h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">
                Dossiê completo pronto para copiar ou anexar no ChatGPT, Claude ou planilhas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all shrink-0 cursor-pointer"
            aria-label="Fechar relatório"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-0.5 custom-scrollbar">
          {/* Snapshot KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Layers className="w-3 h-3 text-sky-500" /> Posições
              </span>
              <p className="text-xs sm:text-sm font-black font-mono tabular-nums mt-0.5">
                {sortedPositions.length} ativos
              </p>
              <p className="text-[10px] text-muted-foreground font-mono truncate">
                {formatCurrency(totalCurrent)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-500" /> TIR / TWR
              </span>
              <p className="text-xs sm:text-sm font-black font-mono tabular-nums mt-0.5 text-emerald-600 dark:text-emerald-400">
                {performanceMetrics?.tirAnnualPercent !== null &&
                performanceMetrics?.tirAnnualPercent !== undefined
                  ? formatSignedPct(performanceMetrics.tirAnnualPercent, 1)
                  : formatSignedPct(totalReturnPercent, 1)}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono truncate">
                TWR: {performanceMetrics ? formatSignedPct(performanceMetrics.twrPercent, 1) : 'N/D'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-indigo-500" /> Diversificação
              </span>
              <p className="text-xs sm:text-sm font-black font-mono tabular-nums mt-0.5">
                {portfolioDiagnosis ? `${portfolioDiagnosis.diversificationScore}/100` : 'N/D'}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {portfolioDiagnosis ? `${portfolioDiagnosis.diversificationLevel} (${portfolioDiagnosis.alerts.length} alertas)` : '-'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Coins className="w-3 h-3 text-amber-500" /> Renda Est./Mês
              </span>
              <p className="text-xs sm:text-sm font-black font-mono tabular-nums mt-0.5 text-amber-600 dark:text-amber-400">
                {portfolioProjections
                  ? formatCurrency(portfolioProjections.totalProjectedMonthlyIncome)
                  : formatCurrency(dividendsReceived / 12)}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono truncate">
                YoC: {overallYieldOnCost.toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Export Mode Switcher */}
          <div className="space-y-2.5 p-3 rounded-2xl border border-border/60 bg-muted/15">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Formato do Relatório
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                ~{estimatedTokens.toLocaleString('pt-BR')} tokens • {reportText.split('\n').length} linhas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setReportMode('chatgpt_prompt')}
                className={`px-3 py-2 rounded-xl text-[11px] font-extrabold border text-left transition-all cursor-pointer ${
                  reportMode === 'chatgpt_prompt'
                    ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                    : 'border-border/60 bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="block">Prompt + Dossiê (ChatGPT)</span>
                <span className="text-[9.5px] font-medium opacity-80">Com instruções de analista CNPI</span>
              </button>
              <button
                type="button"
                onClick={() => setReportMode('markdown_data')}
                className={`px-3 py-2 rounded-xl text-[11px] font-extrabold border text-left transition-all cursor-pointer ${
                  reportMode === 'markdown_data'
                    ? 'border-sky-500/60 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                    : 'border-border/60 bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="block">Apenas Dossiê (Markdown)</span>
                <span className="text-[9.5px] font-medium opacity-80">Tabelas e dados estruturados</span>
              </button>
              <button
                type="button"
                onClick={() => setReportMode('compact')}
                className={`px-3 py-2 rounded-xl text-[11px] font-extrabold border text-left transition-all cursor-pointer ${
                  reportMode === 'compact'
                    ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'border-border/60 bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="block">Resumo Compacto</span>
                <span className="text-[9.5px] font-medium opacity-80">Visão rápida em lista curta</span>
              </button>
            </div>

            {reportMode !== 'compact' && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { label: 'Fundamentos & Valuation', active: includeFundamentals, toggle: () => setIncludeFundamentals(v => !v) },
                  { label: 'Metas & Preço-Teto', active: includeTargets, toggle: () => setIncludeTargets(v => !v) },
                  { label: 'Fluxo de Proventos', active: includeDividendsFlow, toggle: () => setIncludeDividendsFlow(v => !v) },
                  { label: 'Operações & Encerradas', active: includeTransactions, toggle: () => setIncludeTransactions(v => !v) },
                ].map(opt => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={opt.toggle}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition-colors cursor-pointer ${
                      opt.active
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border/60 bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.active ? '✓ ' : '+ '}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {reportMode === 'chatgpt_prompt' && (
              <div className="pt-1">
                <input
                  type="text"
                  value={customAiQuestion}
                  onChange={e => setCustomAiQuestion(e.target.value)}
                  placeholder="Opcional: pergunta extra p/ ChatGPT (ex: Vou aportar R$ 1.500 este mês, o que comprar?)"
                  className="w-full h-9 px-3 rounded-xl border border-border/70 bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-muted/30 border border-border/50 text-[11px] sm:text-xs font-mono whitespace-pre-wrap leading-relaxed select-all text-foreground/85 max-h-72 overflow-y-auto custom-scrollbar">
            {reportText}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3 border-t border-border/40 shrink-0">
          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-[42px] cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Exportar CSV</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="px-3.5 py-2 text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 border border-sky-500/30 rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-[42px] cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Baixar .MD</span>
            </button>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 transition-colors min-h-[42px] cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm min-h-[42px] cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>
                {copied
                  ? 'Copiado!'
                  : reportMode === 'chatgpt_prompt'
                    ? 'Copiar p/ ChatGPT'
                    : 'Copiar Relatório'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
