import React, { useState, useMemo } from 'react';
import { Transaction, UserSettings } from '@/types';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  subMonths, 
  startOfYear, 
  endOfYear, 
  isSameDay,
  isAfter,
  startOfWeek
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { 
  Flame, 
  TrendingUp, 
  Bike, 
  Sparkles,
  Zap,
  X,
  Calendar,
  Fuel,
  Heart,
  PiggyBank,
  TrendingDown
} from 'lucide-react';
import { parseLocalDate, isOperationalCategory } from '@/components/reserves/reserveUtils';

interface RobustMetricStats {
  scaleCap: number;            // Teto de referência para os 4 níveis de cor (1 a 4)
  outlierCutoff: number;       // Ponto de corte acima do qual o valor é estatisticamente atípico
  outlierDates: Set<string>;   // Datas classificadas como anomalias/extraordinárias
  typicalValues: number[];     // Valores da rotina habitual (excluindo os extraordinários)
  rawMax: number;              // Valor máximo absoluto bruto
}

/**
 * Algoritmo de Estatística Robusta (Tukey's Fences + Percentil P90/P95)
 * Protege a escala do heatmap e médias contra gastos gigantescos (ex: entrada de veículos)
 * ou ganhos atípicos (ex: prêmios, heranças, vendas patrimoniais), garantindo que os dias normais
 * mantenham contraste vívido de intensidade e distribuição visual correta.
 */
function computeRobustMetricBounds(
  dateValuePairs: Array<{ date: string; value: number }>
): RobustMetricStats {
  const nonZero = dateValuePairs.filter(p => p.value > 0);
  if (nonZero.length === 0) {
    return {
      scaleCap: 1,
      outlierCutoff: 1,
      outlierDates: new Set<string>(),
      typicalValues: [],
      rawMax: 1
    };
  }

  // Ordenar em ordem crescente
  const sorted = [...nonZero].sort((a, b) => a.value - b.value);
  const n = sorted.length;
  const rawMax = sorted[n - 1].value;

  const getPercentile = (p: number): number => {
    if (n === 1) return sorted[0].value;
    const index = p * (n - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sorted[lower].value * (1 - weight) + sorted[upper].value * weight;
  };

  const p25 = getPercentile(0.25); // Q1
  const p50 = getPercentile(0.50); // Mediana
  const p75 = getPercentile(0.75); // Q3
  const p90 = getPercentile(0.90);
  const p95 = getPercentile(0.95);
  const iqr = Math.max(p75 - p25, p50 * 0.25);

  let outlierCutoff = rawMax + 1;
  let scaleCap = rawMax;

  if (n >= 4) {
    // Critério de Tukey: Q3 + 1.5 * IQR, reforçado para finanças diárias
    const statisticalFence = Math.max(p75 + 1.5 * iqr, p90);
    const minDivergenceFloor = Math.max(p50 * 2.2, p75 * 1.35);
    outlierCutoff = Math.max(statisticalFence, minDivergenceFloor);

    // Se o valor máximo ultrapassa significativamente o corte, ativa teto robusto automático
    if (rawMax >= outlierCutoff) {
      scaleCap = Math.max(p90, p75 + 0.8 * iqr);
      // Garantir que a escala fique calibrada com a rotina diária
      if (scaleCap >= rawMax * 0.9) {
        scaleCap = Math.max(p75, p50 * 1.5);
      }
    } else {
      scaleCap = rawMax;
    }
  } else if (n >= 2) {
    // Amostra pequena (2 ou 3 dias com valores):
    // Se o maior valor for mais de 2.5x o segundo maior e superior a R$ 400
    const secondLargest = sorted[n - 2].value;
    if (rawMax >= secondLargest * 2.5 && rawMax > 400) {
      outlierCutoff = secondLargest * 1.8;
      scaleCap = secondLargest * 1.25;
    } else {
      scaleCap = rawMax;
    }
  }

  const outlierDates = new Set<string>();
  const typicalValues: number[] = [];

  // Classificação estatística automática
  dateValuePairs.forEach(p => {
    const isOutlier = p.value >= outlierCutoff;
    if (isOutlier) {
      outlierDates.add(p.date);
    } else {
      typicalValues.push(p.value);
    }
  });

  return {
    scaleCap: Math.max(scaleCap, 1),
    outlierCutoff,
    outlierDates,
    typicalValues,
    rawMax
  };
}

interface DailyProductivityHeatmapProps {
  transactions: Transaction[];
  settings?: UserSettings | null;
  hideValues: boolean;
  formatCurrency: (val: any) => string;
}

type MetricType = 'profit' | 'income' | 'deliveries' | 'km';

export const DailyProductivityHeatmap: React.FC<DailyProductivityHeatmapProps> = ({
  transactions,
  settings,
  hideValues,
  formatCurrency
}) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('profit');
  const [selectedRange, setSelectedRange] = useState<'auto' | '3months' | '6months' | 'year'>('auto');
  const [selectedDayDetails, setSelectedDayDetails] = useState<{
    dateStr: string;
    formattedDate: string;
    income: number;
    opExpensePuro: number;
    reserveAporte: number;
    perExpense: number;
    reserveExpense: number;
    profit: number;       // Líq. Real (Faturamento padrão - Despesas Operacionais Puras - Despesas Pessoais)
    cashBalance: number;  // Caixa Liq (Caixa Líquido do dia)
    km: number;
    deliveries: number;
    txCount: number;
    txs: Transaction[];
  } | null>(null);

  const [hoveredDay, setHoveredDay] = useState<{
    dateStr: string;
    formattedDate: string;
    data: any;
  } | null>(null);

  // Proteção 100% automática contra gastos e ganhos extraordinários (Anti-outlier para preservar a escala de cores e médias)
  const protectOutliers = true;

  const now = useMemo(() => new Date(), []);

  // 1. Agrupamento diário de transações idêntico ao groupedTransactions do Extrato (History.tsx)
  const dailyStatsMap = useMemo(() => {
    const map: Record<string, {
      income: number;
      opExpense: number;
      opExpensePuro: number;
      reserveAporte: number;
      perExpense: number;
      reserveExpense: number;
      profit: number;       // Líq. Real
      cashBalance: number;  // Caixa Liq.
      km: number;
      deliveries: number;
      txCount: number;
      txs: Transaction[];
    }> = Object.create(null);

    const opCats = settings?.operational_expense_categories || ['Combustível', 'Pedágio', 'Manutenção'];

    (transactions || []).forEach(t => {
      if (!t) return;
      const dateObj = parseLocalDate(t.date);
      const dateKey = format(dateObj, 'yyyy-MM-dd');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;

      if (!map[dateKey]) {
        map[dateKey] = {
          income: 0,
          opExpense: 0,
          opExpensePuro: 0,
          reserveAporte: 0,
          perExpense: 0,
          reserveExpense: 0,
          profit: 0,
          cashBalance: 0,
          km: 0,
          deliveries: 0,
          txCount: 0,
          txs: []
        };
      }

      map[dateKey].txs.push(t);
      map[dateKey].txCount += 1;
    });

    // 2. Calcular os valores diários aplicando exatamente as mesmas regras de fechamento do Extrato
    const computedMap: Record<string, {
      income: number;
      opExpense: number;
      opExpensePuro: number;
      reserveAporte: number;
      perExpense: number;
      reserveExpense: number;
      profit: number;
      cashBalance: number;
      km: number;
      deliveries: number;
      txCount: number;
      txs: Transaction[];
    }> = {};

    Object.keys(map).forEach(dateStr => {
      const entry = map[dateStr];
      const dayTxs = entry.txs;

      // Métricas de Investimentos & Proventos (mesma regra do Extrato)
      const totalCompraInvestimento = dayTxs
        .filter(t => (t as any).isInvestmentTx && t.type === 'expense' && (t as any).payment_status !== 'pending')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);

      const totalVendaInvestimento = dayTxs
        .filter(t => (t as any).isInvestmentTx && t.type === 'income' && (t as any).payment_status !== 'pending')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);

      const incStandard = dayTxs
        .filter(t => 
          t.type === 'income' && 
          (t as any).payment_status !== 'pending' &&
          t.category !== 'Resgate Reserva' && 
          (!(t as any).isReserveTx || (t as any).reserveTxType === 'rendimento') && 
          !(t as any).isInvestmentTx
        )
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);

      const dailyReserveRendimento = dayTxs
        .filter(t => 
          (t as any).payment_status !== 'pending' &&
          (((t as any).isReserveTx && (t as any).reserveTxType === 'rendimento') || (t as any).isDividendTx)
        )
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);

      let opExpPuro = 0;
      let perExpPuro = 0;
      let reserveSpending = 0;
      let rawReserveAporte = 0;
      let km = 0;
      let deliveries = 0;

      // Processamento de Despesas (exatamente como em History.tsx)
      dayTxs.forEach(t => {
        const isPending = (t as any).payment_status === 'pending';

        // Km e Entregas (apenas transações realizadas)
        if (!isPending) {
          const startKm = t.start_km !== undefined && t.start_km !== null ? Number(t.start_km) : NaN;
          const endKm = t.end_km !== undefined && t.end_km !== null ? Number(t.end_km) : NaN;
          if (!isNaN(startKm) && !isNaN(endKm) && endKm >= startKm) {
            km += (endKm - startKm);
          } else if ((t as any).km) {
            km += Number((t as any).km) || 0;
          }

          const isPizzariaCategory = t.category?.trim().toLowerCase() === 'pizzaria';
          if (isPizzariaCategory) {
            if (t.deliveries !== undefined && t.deliveries !== null && Number(t.deliveries) > 0) {
              deliveries += Number(t.deliveries);
            } else {
              const desc = t.description || '';
              const match = desc.match(/(\d+)\s*(entregas?|corridas?|pedidos?)/i);
              if (match && match[1]) {
                deliveries += parseInt(match[1], 10);
              } else {
                deliveries += 1;
              }
            }
          }
        }

        if (!isPending) {
          const isReserveAporteCheck = Boolean(
            (t as any).isReserveAporte === true || 
            (t as any).reserveTxType === 'aporte' || 
            t.category === 'Aporte Reserva' || 
            t.category === 'Aporte Extra' || 
            t.category === 'Aporte' || 
            (t.category && t.category.toLowerCase().includes('aporte')) ||
            t.description?.toLowerCase().includes('aporte')
          );
          if (isReserveAporteCheck) {
            const rawAmt = (t as any).rawAmount !== undefined ? Number((t as any).rawAmount) : Number(t.amount || 0);
            rawReserveAporte += rawAmt;
          }
        }

        if (t.type === 'expense' && !isPending) {
          if ((t as any).isInvestmentTx) {
            // Asset purchases convert cash into investment assets, so they do not reduce net worth or net profit
            return;
          }

          const isInvestmentReserveUse = (t as any).isReserveTx === true && (t as any).reserveTxType === 'utilizacao' && (
            (t as any).originalCategory === 'Investimentos' || 
            (t as any).linkedInvestmentId || 
            t.description?.includes('Investimento:')
          );
          if (isInvestmentReserveUse) {
            return;
          }

          const isReserveAporteVal = Boolean(
            (t as any).isReserveAporte === true || 
            (t as any).reserveTxType === 'aporte' || 
            t.category === 'Aporte Reserva' || 
            t.category === 'Aporte Extra' || 
            t.category === 'Aporte' || 
            (t.category && t.category.toLowerCase().includes('aporte')) ||
            t.description?.toLowerCase().includes('aporte')
          );
          const isReserveUse = t.is_reserve_use === true || (t as any).isReserveUseOriginal === true || t.description?.includes('[Reserva]') || ((t as any).isReserveTx === true && (t as any).reserveTxType === 'utilizacao');
          const amt = Number(t.amount || 0);

          if (isReserveAporteVal) {
            // Already counted in rawReserveAporte
          } else if (isReserveUse) {
            const rawAmt = (t as any).rawAmount !== undefined ? Number((t as any).rawAmount) : amt;
            reserveSpending += rawAmt;

            const effectiveCat = (t as any).originalCategory || t.category;
            if (isOperationalCategory(effectiveCat, opCats)) {
              opExpPuro += amt;
            } else {
              perExpPuro += amt;
            }
          } else {
            if (isOperationalCategory(t.category, opCats)) {
              opExpPuro += amt;
            } else {
              perExpPuro += amt;
            }
          }
        }
      });

      const netReserveAporte = rawReserveAporte - reserveSpending;
      const standardExpense = opExpPuro + perExpPuro + netReserveAporte;

      // Caixa Liq (Caixa Líquido do dia): cash in - standard cash out (plus investment sales). Asset purchases are excluded.
      const dailyNet = (incStandard - dailyReserveRendimento) + totalVendaInvestimento - standardExpense;
      
      // Líquido Real (Lucro Líquido Real do dia): Standard operating profit
      const dailyNetReal = incStandard - opExpPuro - perExpPuro;

      computedMap[dateStr] = {
        income: incStandard,
        opExpense: opExpPuro + rawReserveAporte,
        opExpensePuro: opExpPuro,
        reserveAporte: rawReserveAporte,
        perExpense: perExpPuro,
        reserveExpense: reserveSpending,
        profit: dailyNetReal,
        cashBalance: dailyNet,
        km,
        deliveries,
        txCount: entry.txCount,
        txs: dayTxs
      };
    });

    return computedMap;
  }, [transactions, settings]);

  // Todas as datas com atividade real
  const activeDateStrings = useMemo(() => {
    return Object.keys(dailyStatsMap)
      .filter(d => dailyStatsMap[d].txCount > 0 && (
        dailyStatsMap[d].income > 0 || 
        dailyStatsMap[d].profit !== 0 || 
        dailyStatsMap[d].cashBalance !== 0 || 
        dailyStatsMap[d].km > 0 ||
        dailyStatsMap[d].deliveries > 0
      ))
      .sort();
  }, [dailyStatsMap]);

  const hasAnyData = activeDateStrings.length > 0;

  // 2. Intervalo de datas calculado de forma inteligente com base no histórico
  const dateInterval = useMemo(() => {
    const end = endOfMonth(now);

    if (selectedRange === '3months') {
      return { start: startOfMonth(subMonths(now, 2)), end };
    }
    if (selectedRange === '6months') {
      return { start: startOfMonth(subMonths(now, 5)), end };
    }
    if (selectedRange === 'year') {
      return { start: startOfYear(now), end: endOfYear(now) };
    }

    // Modo 'auto': encontra a primeira transação com dados
    if (hasAnyData) {
      const firstActiveDateStr = activeDateStrings[0];
      const [y, m] = firstActiveDateStr.split('-').map(Number);
      const firstDate = new Date(y, m - 1, 1);

      // Limitar a no máximo 6 meses se a data for muito antiga para manter o grid legível e compacto
      const maxBack = startOfMonth(subMonths(now, 5));
      const start = isAfter(firstDate, maxBack) ? startOfMonth(firstDate) : maxBack;
      return { start, end };
    }

    return { start: startOfMonth(subMonths(now, 2)), end };
  }, [selectedRange, now, hasAnyData, activeDateStrings]);

  // Lista de dias no intervalo visível
  const allDays = useMemo(() => {
    try {
      return eachDayOfInterval(dateInterval);
    } catch {
      return [];
    }
  }, [dateInterval]);

  // 3. Limiares Estatísticos Robustos (Anti-Outlier) e Máximos Tradicionais
  const robustThresholds = useMemo(() => {
    const positiveProfits: Array<{ date: string; value: number }> = [];
    const negativeProfits: Array<{ date: string; value: number }> = [];
    const incomes: Array<{ date: string; value: number }> = [];
    const deliveriesList: Array<{ date: string; value: number }> = [];
    const kmList: Array<{ date: string; value: number }> = [];

    let rawMaxProfit = 1;
    let rawAbsMinProfit = 1;
    let rawMaxIncome = 1;
    let rawMaxDeliveries = 1;
    let rawMaxKm = 1;

    Object.entries(dailyStatsMap).forEach(([dateStr, st]) => {
      if (st.txCount === 0 && st.income === 0) return;

      if (st.profit > 0) {
        positiveProfits.push({ date: dateStr, value: st.profit });
        if (st.profit > rawMaxProfit) rawMaxProfit = st.profit;
      } else if (st.profit < 0) {
        const absVal = Math.abs(st.profit);
        negativeProfits.push({ date: dateStr, value: absVal });
        if (absVal > rawAbsMinProfit) rawAbsMinProfit = absVal;
      }

      if (st.income > 0) {
        incomes.push({ date: dateStr, value: st.income });
        if (st.income > rawMaxIncome) rawMaxIncome = st.income;
      }

      if (st.deliveries > 0) {
        deliveriesList.push({ date: dateStr, value: st.deliveries });
        if (st.deliveries > rawMaxDeliveries) rawMaxDeliveries = st.deliveries;
      }

      if (st.km > 0) {
        kmList.push({ date: dateStr, value: st.km });
        if (st.km > rawMaxKm) rawMaxKm = st.km;
      }
    });

    const robustPosProfit = computeRobustMetricBounds(positiveProfits);
    const robustNegProfit = computeRobustMetricBounds(negativeProfits);
    const robustIncome = computeRobustMetricBounds(incomes);
    const robustDeliveries = computeRobustMetricBounds(deliveriesList);
    const robustKm = computeRobustMetricBounds(kmList);

    return {
      rawMaxProfit,
      rawAbsMinProfit,
      rawMaxIncome,
      rawMaxDeliveries,
      rawMaxKm,
      robustPosProfit,
      robustNegProfit,
      robustIncome,
      robustDeliveries,
      robustKm,
      allOutlierExpenseDates: robustNegProfit.outlierDates,
      allOutlierGainDates: new Set([...robustPosProfit.outlierDates, ...robustIncome.outlierDates])
    };
  }, [dailyStatsMap]);

  const isDayOutlier = (dateStr: string): {
    isOutlier: boolean;
    type: 'expense' | 'gain' | null;
  } => {
    const isExpenseOutlier = robustThresholds.allOutlierExpenseDates.has(dateStr);
    const isGainOutlier = robustThresholds.allOutlierGainDates.has(dateStr);

    if (isExpenseOutlier) {
      return { isOutlier: true, type: 'expense' };
    }
    if (isGainOutlier) {
      return { isOutlier: true, type: 'gain' };
    }
    return { isOutlier: false, type: null };
  };

  const getDayIntensity = (day: Date): number => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const data = dailyStatsMap[dateStr];
    if (!data || data.txCount === 0) return 0;

    let val = 0;
    let effectiveMax = 1;
    let effectiveAbsMin = 1;

    switch (selectedMetric) {
      case 'profit':
        val = data.profit;
        effectiveMax = protectOutliers 
          ? robustThresholds.robustPosProfit.scaleCap 
          : robustThresholds.rawMaxProfit;
        effectiveAbsMin = protectOutliers 
          ? robustThresholds.robustNegProfit.scaleCap 
          : robustThresholds.rawAbsMinProfit;
        break;
      case 'income':
        val = data.income;
        effectiveMax = protectOutliers 
          ? robustThresholds.robustIncome.scaleCap 
          : robustThresholds.rawMaxIncome;
        break;
      case 'deliveries':
        val = data.deliveries;
        effectiveMax = protectOutliers 
          ? robustThresholds.robustDeliveries.scaleCap 
          : robustThresholds.rawMaxDeliveries;
        break;
      case 'km':
        val = data.km;
        effectiveMax = protectOutliers 
          ? robustThresholds.robustKm.scaleCap 
          : robustThresholds.rawMaxKm;
        break;
    }

    if (val === 0) return 0;

    if (val < 0) {
      // Prejuízo -> gera escala de -1 a -4 baseada na intensidade da perda calibrada
      const ratio = Math.abs(val) / (effectiveAbsMin || 1);
      if (ratio <= 0.25) return -1;
      if (ratio <= 0.50) return -2;
      if (ratio <= 0.75) return -3;
      return -4;
    } else {
      // Rendimento positivo -> escala tradicional de 1 a 4 calibrada
      const ratio = val / (effectiveMax || 1);
      if (ratio <= 0.25) return 1;
      if (ratio <= 0.50) return 2;
      if (ratio <= 0.75) return 3;
      return 4;
    }
  };

  const getCellColor = (intensity: number) => {
    if (intensity === 0) {
      return 'bg-muted/30 dark:bg-muted/20 border-border/60 text-muted-foreground/40 hover:border-border';
    }

    // Casos de Prejuízo (Vermelho/Rose de Alto Contraste para saldo/lucro negativo)
    if (intensity < 0) {
      switch (intensity) {
        case -1:
          return 'bg-rose-100 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]';
        case -2:
          return 'bg-rose-300/90 dark:bg-rose-800/60 border-rose-450 dark:border-rose-650 text-rose-950 dark:text-rose-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]';
        case -3:
          return 'bg-rose-500 border-rose-600/95 dark:bg-rose-600 dark:border-rose-500 text-white shadow-[0_1px_2px_rgba(239,68,68,0.15)]';
        case -4:
        default:
          return 'bg-rose-700 border-rose-800 dark:bg-rose-400 dark:border-rose-300 text-white dark:text-slate-950 shadow-[0_2px_4px_rgba(239,68,68,0.3)] font-black ring-1 ring-rose-500/20';
      }
    }

    // Tons de Amarelo para Entregas
    if (selectedMetric === 'deliveries') {
      switch (intensity) {
        case 1:
          return 'bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]';
        case 2:
          return 'bg-amber-300/90 dark:bg-amber-800/60 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]';
        case 3:
          return 'bg-amber-500 border-amber-600/95 dark:bg-amber-500 dark:border-amber-400 text-white shadow-[0_1px_2px_rgba(245,158,11,0.15)]';
        case 4:
        default:
          return 'bg-amber-600 border-amber-700 dark:bg-amber-400 dark:border-amber-300 text-white dark:text-slate-950 shadow-[0_2px_4px_rgba(245,158,11,0.3)] font-black ring-1 ring-amber-500/20';
      }
    }

    // Tons de Azul para KM
    if (selectedMetric === 'km') {
      switch (intensity) {
        case 1:
          return 'bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]';
        case 2:
          return 'bg-blue-300/90 dark:bg-blue-800/60 border-blue-400 dark:border-blue-600 text-blue-950 dark:text-blue-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]';
        case 3:
          return 'bg-blue-500 border-blue-600/95 dark:bg-blue-600 dark:border-blue-500 text-white shadow-[0_1px_2px_rgba(59,130,246,0.15)]';
        case 4:
        default:
          return 'bg-blue-700 border-blue-800 dark:bg-blue-400 dark:border-blue-300 text-white dark:text-slate-950 shadow-[0_2px_4px_rgba(59,130,246,0.3)] font-black ring-1 ring-blue-500/20';
      }
    }

    // Tons de Verde/Emerald para Lucro Líquido, Balanço de Caixa e Faturamento
    switch (intensity) {
      case 1:
        return 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]';
      case 2:
        return 'bg-emerald-300/90 dark:bg-emerald-800/60 border-emerald-450 dark:border-emerald-650 text-emerald-950 dark:text-emerald-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]';
      case 3:
        return 'bg-emerald-500 border-emerald-600/95 dark:bg-emerald-600 dark:border-emerald-500 text-white shadow-[0_1px_2px_rgba(16,185,129,0.15)]';
      case 4:
      default:
        return 'bg-emerald-700 border-emerald-800 dark:bg-emerald-400 dark:border-emerald-300 text-white dark:text-slate-950 shadow-[0_2px_4px_rgba(16,185,129,0.3)] font-black ring-1 ring-emerald-500/20';
    }
  };

  // Organizar dias em colunas de semanas (GitHub Style)
  const weeks = useMemo(() => {
    if (allDays.length === 0) return [];
    
    const firstDay = allDays[0];
    const firstWeekStart = startOfWeek(firstDay, { weekStartsOn: 0 });
    const lastDay = allDays[allDays.length - 1];
    
    const paddedDays = eachDayOfInterval({ start: firstWeekStart, end: lastDay });
    
    const weeksList: Date[][] = [];
    let currentWeek: Date[] = [];

    paddedDays.forEach(day => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeksList.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      weeksList.push(currentWeek);
    }

    return weeksList;
  }, [allDays]);

  // Estatísticas calculadas estritamente com base nos dias válidos / trabalhados
  const summaryStats = useMemo(() => {
    let activeDays = 0;
    let totalIncome = 0;
    let totalProfit = 0;
    let totalCashBalance = 0;
    let totalKm = 0;
    let totalDeliveries = 0;
    let profitDays = 0;
    let lossDays = 0;
    let neutralDays = 0;
    let totalProfitFromPositiveDays = 0;
    let totalLossFromNegativeDays = 0;
    let bestDay = { date: '', profit: 0, cashBalance: 0 };
    let worstDay = { date: '', profit: 0, cashBalance: 0 };

    // Estatísticas Típicas (sem anomalias/outliers)
    let typicalActiveDays = 0;
    let typicalTotalIncome = 0;
    let typicalTotalProfit = 0;
    let outlierDaysCount = 0;
    let outlierExpenseCount = 0;
    let outlierGainCount = 0;
    let outlierExpenseTotal = 0;
    let outlierGainTotal = 0;

    allDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const data = dailyStatsMap[dateStr];
      if (data && (data.income > 0 || data.txCount > 0)) {
        activeDays += 1;
        totalIncome += data.income;
        totalProfit += data.profit;
        totalCashBalance += data.cashBalance;
        totalKm += data.km;
        totalDeliveries += data.deliveries;

        const isExpOutlier = robustThresholds.allOutlierExpenseDates.has(dateStr);
        const isGainOutlier = robustThresholds.allOutlierGainDates.has(dateStr);
        const isAnyOutlier = isExpOutlier || isGainOutlier;

        if (isAnyOutlier) {
          outlierDaysCount += 1;
          if (isExpOutlier) {
            outlierExpenseCount += 1;
            outlierExpenseTotal += Math.abs(data.profit);
          }
          if (isGainOutlier) {
            outlierGainCount += 1;
            outlierGainTotal += (data.profit > 0 ? data.profit : data.income);
          }
        } else {
          typicalActiveDays += 1;
          typicalTotalIncome += data.income;
          typicalTotalProfit += data.profit;
        }

        // Classificação do dia por resultado líquido
        if (data.profit > 0) {
          profitDays += 1;
          totalProfitFromPositiveDays += data.profit;
        } else if (data.profit < 0) {
          lossDays += 1;
          totalLossFromNegativeDays += Math.abs(data.profit);
        } else {
          neutralDays += 1;
        }

        if (data.profit > bestDay.profit) {
          bestDay = { date: dateStr, profit: data.profit, cashBalance: data.cashBalance };
        }
        if (data.profit < worstDay.profit) {
          worstDay = { date: dateStr, profit: data.profit, cashBalance: data.cashBalance };
        }
      }
    });

    // Média real bruta por dia trabalhado
    const rawAvgDailyIncome = activeDays > 0 ? totalIncome / activeDays : 0;
    const rawAvgDailyProfit = activeDays > 0 ? totalProfit / activeDays : 0;

    // Média típica (excluindo os dias de compras/ganhos extraordinários)
    const typicalAvgDailyIncome = typicalActiveDays > 0 ? typicalTotalIncome / typicalActiveDays : rawAvgDailyIncome;
    const typicalAvgDailyProfit = typicalActiveDays > 0 ? typicalTotalProfit / typicalActiveDays : rawAvgDailyProfit;

    const consistencyRate = allDays.length > 0 ? (activeDays / allDays.length) * 100 : 0;
    const profitRate = activeDays > 0 ? (profitDays / activeDays) * 100 : 0;
    const lossRate = activeDays > 0 ? (lossDays / activeDays) * 100 : 0;

    return {
      activeDays,
      totalDays: allDays.length,
      consistencyRate,
      totalIncome,
      totalProfit,
      totalCashBalance,
      totalKm,
      totalDeliveries,
      profitDays,
      lossDays,
      neutralDays,
      totalProfitFromPositiveDays,
      totalLossFromNegativeDays,
      profitRate,
      lossRate,
      rawAvgDailyIncome,
      rawAvgDailyProfit,
      typicalAvgDailyIncome,
      typicalAvgDailyProfit,
      typicalActiveDays,
      outlierDaysCount,
      outlierExpenseCount,
      outlierGainCount,
      outlierExpenseTotal,
      outlierGainTotal,
      // Se a proteção estiver ativa, a média principal mostrada é a média típica sem distorção
      avgDailyIncome: protectOutliers ? typicalAvgDailyIncome : rawAvgDailyIncome,
      avgDailyProfit: protectOutliers ? typicalAvgDailyProfit : rawAvgDailyProfit,
      bestDay,
      worstDay
    };
  }, [allDays, dailyStatsMap, robustThresholds, protectOutliers]);

  // Se não houver nenhuma transação em nenhum dia, oculta o componente para não poluir
  if (!hasAnyData && summaryStats.totalIncome === 0 && summaryStats.totalProfit === 0) {
    return null;
  }

  const weekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <Card className="border border-border/70 shadow-2xs hover:shadow-xs transition-all duration-200 overflow-hidden relative group bg-card/95 rounded-2xl">
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
      
      <CardHeader className="p-3.5 sm:p-4 pb-3 border-b border-border/40 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Título e Subtítulo */}
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border shrink-0 transition-colors ${
              selectedMetric === 'deliveries'
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                : selectedMetric === 'km'
                ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            }`}>
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider">
                  Calendário & Heatmap de Produtividade Diária
                </CardTitle>
                <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full border uppercase tracking-widest ${
                  selectedMetric === 'deliveries'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : selectedMetric === 'km'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                }`}>
                  {selectedMetric === 'deliveries' 
                    ? 'Entregas' 
                    : selectedMetric === 'km' 
                    ? 'Quilometragem' 
                    : selectedMetric === 'income' 
                    ? 'Faturamento' 
                    : `Lucro Líquido (${summaryStats.profitDays}L / ${summaryStats.lossDays}P)`}
                </span>
              </div>
              <CardDescription className="text-xs">
                Ritmo de trabalho e resultados diários do período selecionado.
              </CardDescription>
            </div>
          </div>

          {/* Seletor de Intervalo de Período */}
          <div className="flex items-center justify-between sm:justify-end gap-2 self-stretch md:self-auto w-full md:w-auto">
            <div className="inline-flex items-center p-1 bg-muted/60 dark:bg-muted/40 rounded-xl border border-border/60 gap-1 flex-1 sm:flex-initial justify-between sm:justify-start">
              {(['auto', '3months', '6months', 'year'] as const).map((rng) => {
                const labels = {
                  'auto': 'Auto',
                  '3months': '3 Meses',
                  '6months': '6 Meses',
                  'year': '1 Ano'
                };
                const isSel = selectedRange === rng;
                return (
                  <button
                    key={rng}
                    type="button"
                    onClick={() => setSelectedRange(rng)}
                    className={`flex-1 sm:flex-initial px-2.5 py-1.5 text-[11px] font-extrabold rounded-lg transition-all text-center cursor-pointer ${
                      isSel 
                        ? 'bg-card text-foreground shadow-xs font-black border border-border/80' 
                        : 'text-muted-foreground hover:text-foreground active:bg-muted/80'
                    }`}
                  >
                    {labels[rng]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Barra de Abas de Métricas - 100% Mobile First e com alta ergonomia de toque */}
        <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto scrollbar-none pb-0.5 touch-pan-x -mx-1 px-1">
          {(['profit', 'income', 'deliveries', 'km'] as MetricType[]).map((metric) => {
            const labels: Record<MetricType, string> = {
              profit: 'Lucro Líquido',
              income: 'Faturamento',
              deliveries: 'Entregas',
              km: 'Km'
            };
            const isSel = selectedMetric === metric;

            let activeClass = 'bg-emerald-500 text-white shadow-sm font-black';
            if (metric === 'deliveries') {
              activeClass = 'bg-amber-500 text-white shadow-sm font-black';
            } else if (metric === 'km') {
              activeClass = 'bg-blue-600 text-white shadow-sm font-black';
            }

            return (
              <button
                key={metric}
                type="button"
                onClick={() => setSelectedMetric(metric)}
                className={`px-3.5 py-2 text-[11.5px] font-bold rounded-xl transition-all capitalize shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  isSel 
                    ? activeClass 
                    : 'bg-muted/50 hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/40'
                }`}
              >
                <span>{labels[metric]}</span>
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="p-3.5 sm:p-4 pt-3 space-y-4">
        {/* KPI Strip Rápido */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Dias Trabalhados</span>
              <span className="font-mono font-black text-foreground text-sm">
                {summaryStats.activeDays} <span className="text-[10px] text-muted-foreground font-normal">/ {summaryStats.totalDays}d</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-extrabold text-emerald-500">
                {summaryStats.consistencyRate.toFixed(0)}%
              </span>
              <span className="text-[9px] text-muted-foreground block">consistência</span>
            </div>
          </div>

          <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                {selectedMetric === 'income'
                  ? 'Faturamento Total'
                  : selectedMetric === 'deliveries'
                  ? 'Total Entregas Pizzaria'
                  : selectedMetric === 'km'
                  ? 'Total Rodado'
                  : 'Lucro Líquido Total'}
              </span>
              <span className={`font-mono font-black text-sm ${
                selectedMetric === 'deliveries'
                  ? 'text-amber-500'
                  : selectedMetric === 'km'
                  ? 'text-blue-500'
                  : selectedMetric === 'profit' && summaryStats.totalProfit < 0
                  ? 'text-rose-500'
                  : 'text-emerald-500'
              }`}>
                {hideValues && selectedMetric !== 'deliveries' && selectedMetric !== 'km'
                  ? 'R$ •••••' 
                  : selectedMetric === 'income'
                  ? formatCurrency(summaryStats.totalIncome)
                  : selectedMetric === 'deliveries'
                  ? `${summaryStats.totalDeliveries} entregas`
                  : selectedMetric === 'km'
                  ? `${summaryStats.totalKm.toLocaleString('pt-BR')} km`
                  : formatCurrency(summaryStats.totalProfit)}
              </span>
            </div>
            {selectedMetric === 'profit' && summaryStats.totalProfit < 0 ? (
              <TrendingDown className="w-4 h-4 text-rose-500/80" />
            ) : (
              <TrendingUp className={`w-4 h-4 ${
                selectedMetric === 'deliveries' ? 'text-amber-500/80' : selectedMetric === 'km' ? 'text-blue-500/80' : 'text-emerald-500/80'
              }`} />
            )}
          </div>

          <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                  {protectOutliers && summaryStats.outlierDaysCount > 0 ? 'Média Típica / Dia' : 'Média p/ Dia Ativo'}
                </span>
                {protectOutliers && summaryStats.outlierDaysCount > 0 && (
                  <span className="text-[8px] font-black px-1 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 uppercase tracking-wider" title="Média calculada isolando compras e ganhos extraordinários para refletir sua rotina real">
                    Típica
                  </span>
                )}
              </div>
              <span className={`font-mono font-black text-sm ${
                selectedMetric === 'deliveries'
                  ? 'text-amber-500'
                  : selectedMetric === 'km'
                  ? 'text-blue-500'
                  : selectedMetric === 'profit' && summaryStats.avgDailyProfit < 0
                  ? 'text-rose-500'
                  : 'text-foreground'
              }`}>
                {hideValues && selectedMetric !== 'deliveries' && selectedMetric !== 'km'
                  ? 'R$ •••••' 
                  : selectedMetric === 'deliveries'
                  ? `${(summaryStats.totalDeliveries / (summaryStats.activeDays || 1)).toFixed(1)} entregas`
                  : selectedMetric === 'km'
                  ? `${(summaryStats.totalKm / (summaryStats.activeDays || 1)).toFixed(1)} km`
                  : selectedMetric === 'income' 
                  ? formatCurrency(summaryStats.avgDailyIncome) 
                  : formatCurrency(summaryStats.avgDailyProfit)}
              </span>
              {protectOutliers && summaryStats.outlierDaysCount > 0 && (selectedMetric === 'profit' || selectedMetric === 'income') && !hideValues && (
                <span 
                  className="text-[9px] text-muted-foreground block truncate" 
                  title={`Média bruta sem proteção: ${formatCurrency(selectedMetric === 'profit' ? summaryStats.rawAvgDailyProfit : summaryStats.rawAvgDailyIncome)}`}
                >
                  Bruta: {formatCurrency(selectedMetric === 'profit' ? summaryStats.rawAvgDailyProfit : summaryStats.rawAvgDailyIncome)}
                </span>
              )}
            </div>
            <Zap className="w-4 h-4 text-amber-500/70" />
          </div>

          {selectedMetric === 'profit' ? (
            <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Dias Lucro x Prejuízo</span>
                <div className="flex items-center gap-1.5 font-mono font-black text-sm mt-0.5">
                  <span className="text-emerald-500 flex items-center gap-0.5" title={`${summaryStats.profitDays} dias no lucro`}>
                    <TrendingUp className="w-3.5 h-3.5" />
                    {summaryStats.profitDays}d
                  </span>
                  <span className="text-muted-foreground font-normal text-xs">/</span>
                  <span className="text-rose-500 flex items-center gap-0.5" title={`${summaryStats.lossDays} dias no prejuízo`}>
                    <TrendingDown className="w-3.5 h-3.5" />
                    {summaryStats.lossDays}d
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-extrabold ${summaryStats.profitDays >= summaryStats.lossDays ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {summaryStats.activeDays > 0 ? `${summaryStats.profitRate.toFixed(0)}%` : '0%'}
                </span>
                <span className="text-[9px] text-muted-foreground block">no lucro</span>
              </div>
            </div>
          ) : (
            <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                  {selectedMetric === 'deliveries' ? 'Total Rodado' : 'Total Entregas'}
                </span>
                <span className="font-mono font-black text-foreground text-sm">
                  {selectedMetric === 'deliveries'
                    ? `${summaryStats.totalKm.toLocaleString('pt-BR')} km`
                    : `${summaryStats.totalDeliveries} entregas`}
                </span>
              </div>
              <Bike className="w-4 h-4 text-indigo-500/70" />
            </div>
          )}
        </div>

        {/* Banner de Lucro x Prejuízo Diário (Aparece na opção Lucro Líquido) */}
        {selectedMetric === 'profit' && (
          <div className="p-2.5 sm:p-3 rounded-xl bg-muted/20 dark:bg-muted/15 border border-border/70 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground shrink-0">
                Balanço dos Dias:
              </span>

              {/* Tag Dias de Lucro */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-black text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  {summaryStats.profitDays} {summaryStats.profitDays === 1 ? 'dia de Lucro' : 'dias de Lucro'}
                </span>
                {!hideValues && summaryStats.totalProfitFromPositiveDays > 0 && (
                  <span className="text-emerald-600/90 dark:text-emerald-400/90 font-mono font-bold text-[11px] ml-0.5">
                    (+{formatCurrency(summaryStats.totalProfitFromPositiveDays)})
                  </span>
                )}
              </div>

              {/* Tag Dias de Prejuízo */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 font-black text-xs">
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                <span>
                  {summaryStats.lossDays} {summaryStats.lossDays === 1 ? 'dia de Prejuízo' : 'dias de Prejuízo'}
                </span>
                {!hideValues && summaryStats.totalLossFromNegativeDays > 0 && (
                  <span className="text-rose-600/90 dark:text-rose-400/90 font-mono font-bold text-[11px] ml-0.5">
                    (-{formatCurrency(summaryStats.totalLossFromNegativeDays)})
                  </span>
                )}
              </div>

              {/* Tag Dias Neutros se houver */}
              {summaryStats.neutralDays > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/60 border border-border/50 text-muted-foreground font-bold text-[11px]">
                  <span>{summaryStats.neutralDays} {summaryStats.neutralDays === 1 ? 'dia neutro (R$ 0)' : 'dias neutros (R$ 0)'}</span>
                </div>
              )}
            </div>

            {/* Barra visual de proporção (Verde vs Vermelho) */}
            {summaryStats.activeDays > 0 && (
              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-border/30">
                <div className="w-28 sm:w-36 h-2.5 rounded-full bg-muted overflow-hidden flex shadow-inner">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${(summaryStats.profitDays / summaryStats.activeDays) * 100}%` }}
                    title={`${summaryStats.profitDays} dias de lucro (${summaryStats.profitRate.toFixed(0)}%)`}
                  />
                  {summaryStats.neutralDays > 0 && (
                    <div 
                      className="bg-muted-foreground/30 h-full transition-all duration-500" 
                      style={{ width: `${(summaryStats.neutralDays / summaryStats.activeDays) * 100}%` }}
                      title={`${summaryStats.neutralDays} dias neutros`}
                    />
                  )}
                  <div 
                    className="bg-rose-500 h-full transition-all duration-500" 
                    style={{ width: `${(summaryStats.lossDays / summaryStats.activeDays) * 100}%` }}
                    title={`${summaryStats.lossDays} dias de prejuízo (${summaryStats.lossRate.toFixed(0)}%)`}
                  />
                </div>
                <span className="text-[10.5px] font-mono font-black text-foreground shrink-0">
                  {summaryStats.profitRate.toFixed(0)}% verde
                </span>
              </div>
            )}
          </div>
        )}

        {/* Heatmap Grid Principal */}
        <div className="overflow-x-auto pb-2 scrollbar-thin relative">
          <div className="min-w-[580px] inline-flex flex-col gap-1.5">
            {/* Header com os Meses */}
            <div className="flex gap-1 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider items-center">
              {/* Espaçador sticky no canto superior esquerdo para manter o alinhamento com a coluna dos dias */}
              <div className="sticky left-0 z-20 bg-card dark:bg-card shrink-0 w-4.5 h-4" />

              {weeks.map((week, wIdx) => {
                const firstDayOfWeek = week[0];
                const isFirstWeekOfMonth = firstDayOfWeek.getDate() <= 7;
                if (isFirstWeekOfMonth || wIdx === 0) {
                  return (
                    <div 
                      key={wIdx} 
                      className="text-left font-black text-foreground/80 capitalize shrink-0"
                      style={{ width: '14px' }}
                    >
                      {format(firstDayOfWeek, 'MMM', { locale: ptBR })}
                    </div>
                  );
                }
                return <div key={wIdx} className="shrink-0" style={{ width: '14px' }} />;
              })}
            </div>

            {/* Grid com dias da semana nas linhas e semanas nas colunas */}
            <div className="flex gap-1 items-start">
              {/* Rótulos dos dias da semana à esquerda (D, S, T, Q, Q, S, S) fixos diretamente na borda */}
              <div className="sticky left-0 z-20 bg-card dark:bg-card flex flex-col gap-1 text-[9px] font-extrabold text-muted-foreground select-none w-4.5 shrink-0 text-center">
                {weekdays.map((dayName, idx) => (
                  <span 
                    key={idx} 
                    className="w-3.5 h-3.5 flex items-center justify-center text-[9px] leading-none"
                    title={['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][idx]}
                  >
                    {dayName}
                  </span>
                ))}
              </div>

              {/* Colunas de Semanas */}
              <div className="flex gap-1">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1">
                    {week.map((day, dIdx) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const isCurrentMonth = isAfter(day, dateInterval.start) || isSameDay(day, dateInterval.start);
                      const isFuture = isAfter(day, now);
                      const intensity = isFuture || !isCurrentMonth ? 0 : getDayIntensity(day);
                      const data = dailyStatsMap[dateStr];
                      const isSelected = selectedDayDetails?.dateStr === dateStr;
                      const isTodayDay = isSameDay(day, now);
                      const outlierInfo = isDayOutlier(dateStr);
                      const hasOutlier = protectOutliers && outlierInfo.isOutlier;

                      return (
                        <button
                          key={dIdx}
                          type="button"
                          onClick={() => {
                            if (data && data.txCount > 0) {
                              setSelectedDayDetails({
                                dateStr,
                                formattedDate: format(day, "dd 'de' MMMM, yyyy", { locale: ptBR }),
                                ...data
                              });
                            }
                          }}
                          onMouseEnter={() => {
                            if (data && data.txCount > 0) {
                              setHoveredDay({
                                dateStr,
                                formattedDate: format(day, "EEEE, dd/MM", { locale: ptBR }),
                                data
                              });
                            }
                          }}
                          onMouseLeave={() => setHoveredDay(null)}
                          disabled={isFuture || !isCurrentMonth}
                          title={`${format(day, 'dd/MM/yyyy')}${isTodayDay ? ' (Hoje)' : ''}${hasOutlier ? ` - ⚡ ${outlierInfo.type === 'expense' ? 'Gasto' : 'Ganho'} Extraordinário Protegido` : ''}${data ? ` - ${
                            selectedMetric === 'deliveries' 
                              ? `${data.deliveries} entregas` 
                              : selectedMetric === 'km' 
                              ? `${data.km} km` 
                              : selectedMetric === 'income' 
                              ? `Fat: R$ ${data.income.toFixed(2)}` 
                              : `Lucro Líquido: R$ ${data.profit.toFixed(2)} (${data.profit > 0 ? 'Lucro' : data.profit < 0 ? 'Prejuízo' : 'Neutro'})`
                          }` : ''}`}
                          className={`w-3.5 h-3.5 rounded-[3px] border transition-all duration-150 relative cursor-pointer ${
                            getCellColor(intensity)
                          } ${
                            isTodayDay 
                              ? 'ring-2 ring-primary ring-offset-1 ring-offset-background shadow-[0_0_8px_rgba(59,130,246,0.5)] dark:shadow-[0_0_8px_rgba(96,165,250,0.6)] font-bold z-10' 
                              : ''
                          } ${
                            hasOutlier && !isSelected
                              ? 'ring-1.5 ring-amber-400 dark:ring-amber-300 shadow-[0_0_6px_rgba(245,158,11,0.45)]'
                              : ''
                          } ${isSelected ? (
                            selectedMetric === 'deliveries' 
                              ? 'ring-2 ring-amber-500 ring-offset-1 scale-115 z-20' 
                              : selectedMetric === 'km' 
                              ? 'ring-2 ring-blue-500 ring-offset-1 scale-115 z-20' 
                              : 'ring-2 ring-emerald-500 ring-offset-1 scale-115 z-20'
                          ) : 'hover:scale-115'}`}
                          aria-label={`Dia ${dateStr}${isTodayDay ? ' (Hoje)' : ''}${hasOutlier ? ' (Extraordinário)' : ''}`}
                        >
                          {/* Marcador pontual sutil no canto para reforçar visualmente o dia de hoje sem esconder a cor de fundo */}
                          {isTodayDay && (
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          )}
                          {/* Marcador de gasto ou ganho extraordinário protegido contra distorção da escala */}
                          {hasOutlier && (
                            <span 
                              className="absolute -top-1 -left-1 text-[7px] leading-none z-10 select-none pointer-events-none drop-shadow-xs" 
                              title={outlierInfo.type === 'expense' ? 'Gasto extraordinário protegido da escala' : 'Ganho extraordinário protegido da escala'}
                            >
                              ⚡
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Hover Tooltip Flutuante */}
        {hoveredDay && !selectedDayDetails && (
          <div className="p-2.5 bg-popover border border-border/80 shadow-lg rounded-xl text-xs space-y-1.5 max-w-xs animate-in fade-in duration-150">
            <div className="font-extrabold text-foreground border-b border-border/40 pb-1 flex justify-between items-center capitalize">
              <div className="flex items-center gap-1.5">
                <span>{hoveredDay.formattedDate}</span>
                {selectedMetric === 'profit' && (
                  <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-black uppercase ${
                    hoveredDay.data.profit > 0 
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                      : hoveredDay.data.profit < 0 
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30' 
                      : 'bg-muted text-muted-foreground border border-border/40'
                  }`}>
                    {hoveredDay.data.profit > 0 ? 'Lucro' : hoveredDay.data.profit < 0 ? 'Prejuízo' : 'Neutro'}
                  </span>
                )}
              </div>
              <span className={`font-mono font-bold ${
                selectedMetric === 'deliveries' 
                  ? 'text-amber-500' 
                  : selectedMetric === 'km' 
                  ? 'text-blue-500' 
                  : selectedMetric === 'income'
                  ? 'text-foreground'
                  : hoveredDay.data.profit >= 0 
                  ? 'text-emerald-500' 
                  : 'text-rose-500'
              }`}>
                {hideValues 
                  ? (selectedMetric === 'deliveries' || selectedMetric === 'km' ? '••••' : 'R$ •••••')
                  : selectedMetric === 'income' 
                  ? formatCurrency(hoveredDay.data.income)
                  : selectedMetric === 'deliveries'
                  ? `${hoveredDay.data.deliveries} entregas`
                  : selectedMetric === 'km'
                  ? `${hoveredDay.data.km} km`
                  : formatCurrency(hoveredDay.data.profit)}
              </span>
            </div>

            {/* Aviso se o dia for um outlier protegido */}
            {protectOutliers && isDayOutlier(hoveredDay.dateStr).isOutlier && (
              <div className="flex items-center gap-1 text-[9.5px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                <span>
                  {isDayOutlier(hoveredDay.dateStr).type === 'expense' 
                    ? '⚡ Gasto Extraordinário Protegido' 
                    : '⚡ Ganho Extraordinário Protegido'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono">
              <div>Fat: <strong className="text-foreground">{hideValues ? '••••' : formatCurrency(hoveredDay.data.income)}</strong></div>
              <div>Balanço: <strong className={hoveredDay.data.cashBalance >= 0 ? "text-emerald-500" : "text-rose-500"}>{hideValues ? '••••' : formatCurrency(hoveredDay.data.cashBalance)}</strong></div>
              <div>Lucro Lq: <strong className={hoveredDay.data.profit >= 0 ? "text-emerald-500" : "text-rose-500"}>{hideValues ? '••••' : formatCurrency(hoveredDay.data.profit)}</strong></div>
              {hoveredDay.data.km > 0 && <div>Km: <strong className="text-blue-500">{hoveredDay.data.km} km</strong></div>}
              {hoveredDay.data.deliveries > 0 && <div>Entregas: <strong className="text-amber-500">{hoveredDay.data.deliveries}</strong></div>}
            </div>
          </div>
        )}

        {/* Legenda de Intensidade Dinâmica */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2.5 border-t border-border/40 text-[11px] text-muted-foreground w-full">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Legenda Positiva Dinâmica de Acordo com a Métrica Selecionada */}
            <div className="flex items-center gap-1.5">
              <span>
                {selectedMetric === 'profit' 
                  ? `Dias de Lucro (${summaryStats.profitDays}d):` 
                  : selectedMetric === 'deliveries' 
                  ? 'Entregas:' 
                  : selectedMetric === 'km' 
                  ? 'Quilometragem:' 
                  : 'Rendimento:'}
              </span>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-[3px] bg-muted/30 dark:bg-muted/20 border border-border/60" title="Sem atividade" />
                {selectedMetric === 'deliveries' ? (
                  <>
                    <span className="w-3 h-3 rounded-[3px] bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800" title="Nível 1" />
                    <span className="w-3 h-3 rounded-[3px] bg-amber-300/90 dark:bg-amber-800/60 border border-amber-400 dark:border-amber-600" title="Nível 2" />
                    <span className="w-3 h-3 rounded-[3px] bg-amber-500 border border-amber-600/95 dark:bg-amber-500 dark:border-amber-400" title="Nível 3" />
                    <span className="w-3 h-3 rounded-[3px] bg-amber-600 border border-amber-700 dark:bg-amber-400 dark:border-amber-300" title="Nível 4" />
                  </>
                ) : selectedMetric === 'km' ? (
                  <>
                    <span className="w-3 h-3 rounded-[3px] bg-blue-100 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800" title="Nível 1" />
                    <span className="w-3 h-3 rounded-[3px] bg-blue-300/90 dark:bg-blue-800/60 border border-blue-400 dark:border-blue-600" title="Nível 2" />
                    <span className="w-3 h-3 rounded-[3px] bg-blue-500 border border-blue-600/95 dark:bg-blue-600 dark:border-blue-500" title="Nível 3" />
                    <span className="w-3 h-3 rounded-[3px] bg-blue-700 border border-blue-800 dark:bg-blue-400 dark:border-blue-300" title="Nível 4" />
                  </>
                ) : (
                  <>
                    <span className="w-3 h-3 rounded-[3px] bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800" title="Nível 1" />
                    <span className="w-3 h-3 rounded-[3px] bg-emerald-300/90 dark:bg-emerald-800/60 border border-emerald-450 dark:border-emerald-650" title="Nível 2" />
                    <span className="w-3 h-3 rounded-[3px] bg-emerald-500 border border-emerald-600/95 dark:bg-emerald-600 dark:border-emerald-500" title="Nível 3" />
                    <span className="w-3 h-3 rounded-[3px] bg-emerald-700 border border-emerald-800 dark:bg-emerald-400 dark:border-emerald-300" title="Nível 4" />
                  </>
                )}
              </div>
            </div>

            {/* Legenda Vermelha/Negativos (Apenas para métrica de lucro líquido que pode ser negativa) */}
            {selectedMetric === 'profit' && (
              <div className="flex items-center gap-1.5 border-l border-border/40 pl-3">
                <span className="text-rose-500 font-bold">Dias de Prejuízo ({summaryStats.lossDays}d):</span>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-[3px] bg-rose-100 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800" title="Leve" />
                  <span className="w-3 h-3 rounded-[3px] bg-rose-300/90 dark:bg-rose-800/60 border border-rose-450 dark:border-rose-650" title="Médio" />
                  <span className="w-3 h-3 rounded-[3px] bg-rose-500 border border-rose-600/95 dark:bg-rose-600 dark:border-rose-500" title="Alto" />
                  <span className="w-3 h-3 rounded-[3px] bg-rose-700 border border-rose-800 dark:bg-rose-400 dark:border-rose-300" title="Crítico" />
                </div>
              </div>
            )}

            {/* Marcador Extraordinário na Legenda */}
            <div className="flex items-center gap-1.5 border-l border-border/40 pl-3">
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-black border border-amber-500/30">
                ⚡
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold">
                Extraordinário (Protegido)
              </span>
            </div>
          </div>

          <div className="text-[10.5px] flex items-center gap-1 shrink-0">
            <Sparkles className={`w-3 h-3 ${
              selectedMetric === 'deliveries' ? 'text-amber-500' : selectedMetric === 'km' ? 'text-blue-500' : 'text-emerald-500'
            }`} />
            <span>Toque ou passe o mouse para detalhar o dia.</span>
          </div>
        </div>

        {/* Detalhe do Dia Selecionado (se houver clique) */}
        {selectedDayDetails && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-black uppercase text-foreground">
                  Detalhamento de {selectedDayDetails.formattedDate}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  selectedDayDetails.profit > 0 
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                    : selectedDayDetails.profit < 0 
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' 
                    : 'bg-muted text-muted-foreground border-border/50'
                }`}>
                  {selectedDayDetails.profit > 0 ? 'Dia de Lucro' : selectedDayDetails.profit < 0 ? 'Dia de Prejuízo' : 'Dia Neutro'}
                </span>
                {isDayOutlier(selectedDayDetails.dateStr).isOutlier && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" />
                    <span>{isDayOutlier(selectedDayDetails.dateStr).type === 'expense' ? 'Gasto Extraordinário' : 'Ganho Extraordinário'}</span>
                  </span>
                )}
                <span className="text-[10px] font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border/50">
                  {selectedDayDetails.txs.length} lançamento{selectedDayDetails.txs.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayDetails(null)}
                className="text-[10px] font-bold text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/50 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Faturamento</span>
                <span className="font-mono font-black text-foreground text-sm">
                  {hideValues ? 'R$ •••••' : formatCurrency(selectedDayDetails.income)}
                </span>
              </div>
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Gasto Op. Puro</span>
                <span className="font-mono font-black text-amber-500 text-sm">
                  {hideValues ? 'R$ •••••' : formatCurrency(selectedDayDetails.opExpensePuro)}
                </span>
              </div>
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Gasto Pessoal</span>
                <span className="font-mono font-black text-rose-500 text-sm">
                  {hideValues ? 'R$ •••••' : formatCurrency(selectedDayDetails.perExpense)}
                </span>
              </div>
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Total Gasto</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                  {hideValues ? 'R$ •••••' : formatCurrency(selectedDayDetails.opExpensePuro + selectedDayDetails.perExpense)}
                </span>
              </div>
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Líq. Real (Dia)</span>
                <span className={`font-mono font-black text-sm ${selectedDayDetails.profit >= 0 ? "text-indigo-500 dark:text-indigo-400" : "text-rose-500"}`}>
                  {hideValues ? 'R$ •••••' : `${selectedDayDetails.profit >= 0 ? '+' : ''}${formatCurrency(selectedDayDetails.profit)}`}
                </span>
              </div>
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Caixa Liq. (Dia)</span>
                <span className={`font-mono font-black text-sm ${selectedDayDetails.cashBalance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {hideValues ? 'R$ •••••' : `${selectedDayDetails.cashBalance >= 0 ? '+' : ''}${formatCurrency(selectedDayDetails.cashBalance)}`}
                </span>
              </div>
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Total Aportes</span>
                <span className="font-mono font-black text-pink-500 text-sm">
                  {hideValues ? 'R$ •••••' : formatCurrency(selectedDayDetails.reserveAporte)}
                </span>
              </div>
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Km & Entregas</span>
                <span className="font-mono font-black text-foreground text-sm truncate block" title={`${selectedDayDetails.km} km, ${selectedDayDetails.deliveries} entregas`}>
                  {selectedDayDetails.km > 0 || selectedDayDetails.deliveries > 0 ? (
                    `${selectedDayDetails.km > 0 ? `${selectedDayDetails.km} km` : ''}${selectedDayDetails.km > 0 && selectedDayDetails.deliveries > 0 ? ' ' : ''}${selectedDayDetails.deliveries > 0 ? `(${selectedDayDetails.deliveries} entr.)` : ''}`
                  ) : (
                    '0'
                  )}
                </span>
              </div>
            </div>

            {/* Listagem transparente de todas as transações que compõem o dia */}
            {selectedDayDetails.txs.length > 0 && (
              <div className="bg-card/90 rounded-lg border border-border/60 p-2.5 space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex justify-between px-1">
                  <span>Lançamentos Registrados no Dia</span>
                  <span>Valor & Classificação</span>
                </div>
                <div className="space-y-1">
                  {selectedDayDetails.txs.map((t, idx) => {
                    const isPending = (t as any).payment_status === 'pending';
                    const isInv = (t as any).isInvestmentTx === true || t.category === 'Investimentos';
                    const isDiv = (t as any).isDividendTx === true || (t as any).reserveTxType === 'rendimento' || t.category === 'Dividendos' || t.category === 'Rendimentos';
                    const isAporte = Boolean(
                      (t as any).isReserveAporte === true || 
                      (t as any).reserveTxType === 'aporte' || 
                      t.category === 'Aporte Reserva' || 
                      t.category === 'Aporte Extra' || 
                      t.category === 'Aporte' || 
                      (t.category && t.category.toLowerCase().includes('aporte'))
                    );
                    const isUse = t.is_reserve_use === true || (t as any).isReserveUseOriginal === true || t.description?.includes('[Reserva]') || ((t as any).isReserveTx === true && (t as any).reserveTxType === 'utilizacao');
                    const rawAmt = (t as any).rawAmount !== undefined ? Number((t as any).rawAmount) : Number(t.amount || 0);

                    const opCats = settings?.operational_expense_categories || ['Combustível', 'Pedágio', 'Manutenção'];
                    const effectiveCat = (t as any).originalCategory || t.category;
                    const isOp = isOperationalCategory(effectiveCat, opCats);

                    return (
                      <div 
                        key={t.id || idx} 
                        className="flex items-center justify-between p-1.5 rounded-md bg-muted/40 hover:bg-muted/70 text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            t.type === 'income' ? 'bg-emerald-500' : isAporte ? 'bg-pink-500' : isInv ? 'bg-blue-500' : isOp ? 'bg-rose-500' : 'bg-amber-500'
                          }`} />
                          <div className="truncate">
                            <span className="font-semibold text-foreground block truncate">
                              {t.description || t.category || 'Sem descrição'}
                            </span>
                            <div className="flex items-center gap-1 text-[9.5px] text-muted-foreground flex-wrap">
                              <span className="font-medium">{t.category}</span>
                              {isPending && <span className="text-amber-500 font-bold px-1 bg-amber-500/10 rounded">Pendente</span>}
                              {isAporte && <span className="text-pink-500 font-bold px-1 bg-pink-500/10 rounded">Aporte Reserva (Patrimonial)</span>}
                              {isUse && <span className="text-indigo-500 font-bold px-1 bg-indigo-500/10 rounded">Uso de Reserva</span>}
                              {isInv && <span className="text-blue-500 font-bold px-1 bg-blue-500/10 rounded">Investimento</span>}
                              {isDiv && <span className="text-purple-500 font-bold px-1 bg-purple-500/10 rounded">Provento/Rendimento</span>}
                              {!isPending && !isAporte && !isInv && !isDiv && (
                                <span className={isOp ? "text-amber-500 font-medium" : "text-rose-500 font-medium"}>
                                  {isOp ? 'Gasto Op. Puro' : 'Gasto Pessoal'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`font-mono font-bold text-xs ${
                            t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'
                          }`}>
                            {t.type === 'income' ? '+' : '-'}{hideValues ? 'R$ •••••' : formatCurrency(rawAmt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
