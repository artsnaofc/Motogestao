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
  Calendar
} from 'lucide-react';

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
    expense: number;
    opExpense: number;
    profit: number;
    cashBalance: number;
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

  const now = useMemo(() => new Date(), []);

  // 1. Agrupamento diário de transações com métricas consolidadas
  const dailyStatsMap = useMemo(() => {
    const map: Record<string, {
      income: number;
      expense: number;
      opExpense: number;
      perExpense: number;
      profit: number;       // Lucro Líquido
      cashBalance: number;  // Balanço do Caixa
      km: number;
      deliveries: number;
      txCount: number;
      txs: Transaction[];
    }> = Object.create(null);

    const personalCats = settings?.personal_expense_categories || ['Alimentação', 'Mercado', 'Lazer', 'Saúde', 'Pessoal'];
    const opCats = settings?.operational_expense_categories || ['Combustível', 'Pedágio', 'Manutenção'];

    const isFuelCategory = (cat: string) => {
      if (!cat) return false;
      const normalized = cat.toLowerCase().trim();
      return normalized === 'combustível' || normalized === 'combustivel';
    };

    const isMaintCategory = (cat: string) => {
      if (!cat) return false;
      const normalized = cat.toLowerCase().trim();
      return normalized === 'manutenção' || normalized === 'manutencao';
    };

    const isTollCategory = (cat: string) => {
      if (!cat) return false;
      const normalized = cat.toLowerCase().trim();
      return normalized === 'pedágio' || normalized === 'pedagio';
    };

    const isOpCategory = (cat: string) => {
      if (!cat) return false;
      return opCats.includes(cat) || isFuelCategory(cat) || isMaintCategory(cat) || isTollCategory(cat);
    };

    (transactions || []).forEach(t => {
      if (!t || !t.date) return;
      const dateStr = String(t.date).split('T')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;

      if (!map[dateStr]) {
        map[dateStr] = {
          income: 0,
          expense: 0,
          opExpense: 0,
          perExpense: 0,
          profit: 0,
          cashBalance: 0,
          km: 0,
          deliveries: 0,
          txCount: 0,
          txs: []
        };
      }

      const entry = map[dateStr];
      entry.txCount += 1;
      entry.txs = [...entry.txs, t];
    });

    // 2. Calcular os valores diários de cada dia de forma imutável
    const computedMap: Record<string, {
      income: number;
      expense: number;
      opExpense: number;
      perExpense: number;
      profit: number;       // Lucro Líquido
      cashBalance: number;  // Balanço do Caixa
      km: number;
      deliveries: number;
      txCount: number;
      txs: Transaction[];
    }> = {};

    Object.keys(map).forEach(dateStr => {
      const entry = map[dateStr];
      const dayTxs = entry.txs;

      const inc = dayTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount || 0), 0);
      const rendimentosReserva = dayTxs
        .filter(t => (t as any).reserveTxType === 'rendimento' || (t as any).isDividendTx)
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);
      
      let totalVendaInvestimento = 0;
      let totalCompraInvestimento = 0;
      let fuelExpense = 0;
      let maintenanceExpense = 0;
      let km = 0;
      let deliveries = 0;

      dayTxs.forEach(t => {
        if ((t as any).isInvestmentTx) {
          if (t.type === 'income') {
            totalVendaInvestimento += Number(t.amount || 0);
          } else {
            totalCompraInvestimento += Number(t.amount || 0);
          }
          return;
        }

        // Quilometragem robusta
        const startKm = t.start_km !== undefined && t.start_km !== null ? Number(t.start_km) : NaN;
        const endKm = t.end_km !== undefined && t.end_km !== null ? Number(t.end_km) : NaN;
        
        if (!isNaN(startKm) && !isNaN(endKm) && endKm >= startKm) {
          km += (endKm - startKm);
        } else if ((t as any).km) {
          km += Number((t as any).km) || 0;
        }

        // Entregas realizadas: Apenas aquelas que vêm do lançamento da pizzaria
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

        if (t.category === 'Aporte Reserva' || (t as any).isReserveAporte) {
          return;
        }

        const rawAmt = (t as any).rawAmount !== undefined ? Number((t as any).rawAmount) : Number(t.amount || 0);
        if (t.type === 'expense') {
          if (isFuelCategory(t.category)) {
            fuelExpense += rawAmt;
          } else if (isMaintCategory(t.category)) {
            maintenanceExpense += rawAmt;
          }
        }
      });

      let opExpPuro = 0;
      let perExpPuro = 0;
      let reserveSpending = 0;
      let rawReserveAporte = 0;

      dayTxs.filter(t => t.type === 'expense').forEach(t => {
        if ((t as any).isInvestmentTx) return;

        const isReserveAporteVal = (t as any).isReserveAporte === true || t.category === 'Aporte Reserva';
        const isReserveUse = (t as any).isReserveTx === true && (t as any).reserveTxType === 'utilizacao';
        const rawAmt = (t as any).rawAmount !== undefined ? Number((t as any).rawAmount) : Number(t.amount || 0);

        if (isReserveAporteVal) {
          rawReserveAporte += rawAmt;
        } else if (isReserveUse) {
          reserveSpending += rawAmt;
          if (isOpCategory(t.category)) {
            opExpPuro += rawAmt;
          } else {
            perExpPuro += rawAmt;
          }
        } else {
          if (isOpCategory(t.category)) {
            opExpPuro += rawAmt;
          } else {
            perExpPuro += rawAmt;
          }
        }
      });

      const incomeNoRendimento = inc - rendimentosReserva - totalVendaInvestimento;
      const reserveAporte = rawReserveAporte - reserveSpending;
      const realExpense = opExpPuro + perExpPuro;
      const standardExpense = opExpPuro + perExpPuro + reserveAporte;

      // Balanço de Caixa
      const cashBalance = incomeNoRendimento + totalVendaInvestimento - standardExpense;
      // Lucro Líquido
      const profit = incomeNoRendimento - opExpPuro - perExpPuro;

      computedMap[dateStr] = {
        income: inc,
        expense: realExpense,
        opExpense: opExpPuro,
        perExpense: perExpPuro,
        profit,
        cashBalance,
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

  // Encontrar valores máximos e perdas máximas para a escala de cores (0 a 4 e -1 a -4)
  const maxValues = useMemo(() => {
    let maxProfit = 1;
    let minProfit = 0; // Guardará o pior prejuízo (número negativo)
    let maxIncome = 1;
    let maxDeliveries = 1;
    let maxKm = 1;

    Object.values(dailyStatsMap).forEach(st => {
      if (st.profit > maxProfit) maxProfit = st.profit;
      if (st.profit < minProfit) minProfit = st.profit;
      if (st.income > maxIncome) maxIncome = st.income;
      if (st.deliveries > maxDeliveries) maxDeliveries = st.deliveries;
      if (st.km > maxKm) maxKm = st.km;
    });

    return {
      maxProfit,
      absMinProfit: Math.abs(minProfit),
      maxIncome,
      maxDeliveries,
      maxKm
    };
  }, [dailyStatsMap]);

  const getDayIntensity = (day: Date): number => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const data = dailyStatsMap[dateStr];
    if (!data || data.txCount === 0) return 0;

    let val = 0;
    let max = 1;
    let absMin = 0;

    switch (selectedMetric) {
      case 'profit':
        val = data.profit;
        max = maxValues.maxProfit;
        absMin = maxValues.absMinProfit;
        break;
      case 'income':
        val = data.income;
        max = maxValues.maxIncome;
        break;
      case 'deliveries':
        val = data.deliveries;
        max = maxValues.maxDeliveries;
        break;
      case 'km':
        val = data.km;
        max = maxValues.maxKm;
        break;
    }

    if (val === 0) return 0;

    if (val < 0) {
      // Prejuízo -> gera escala de -1 a -4 baseada na intensidade da perda
      const ratio = Math.abs(val) / (absMin || 1);
      if (ratio <= 0.25) return -1;
      if (ratio <= 0.50) return -2;
      if (ratio <= 0.75) return -3;
      return -4;
    } else {
      // Rendimento positivo -> escala tradicional de 1 a 4
      const ratio = val / (max || 1);
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
    let bestDay = { date: '', profit: 0, cashBalance: 0 };

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
        if (data.profit > bestDay.profit) {
          bestDay = { date: dateStr, profit: data.profit, cashBalance: data.cashBalance };
        }
      }
    });

    // Média real por dia trabalhado (evita distorção com dias off)
    const avgDailyIncome = activeDays > 0 ? totalIncome / activeDays : 0;
    const avgDailyProfit = activeDays > 0 ? totalProfit / activeDays : 0;
    const consistencyRate = allDays.length > 0 ? (activeDays / allDays.length) * 100 : 0;

    return {
      activeDays,
      totalDays: allDays.length,
      consistencyRate,
      totalIncome,
      totalProfit,
      totalCashBalance,
      totalKm,
      totalDeliveries,
      avgDailyIncome,
      avgDailyProfit,
      bestDay
    };
  }, [allDays, dailyStatsMap]);

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
                  {selectedMetric === 'deliveries' ? 'Entregas' : selectedMetric === 'km' ? 'Quilometragem' : selectedMetric === 'income' ? 'Faturamento' : 'Lucro Líquido'}
                </span>
              </div>
              <CardDescription className="text-xs">
                Ritmo de trabalho e resultados diários do período selecionado.
              </CardDescription>
            </div>
          </div>

          {/* Seletor de Intervalo de Período */}
          <div className="flex items-center justify-end gap-1.5 self-start md:self-auto w-full md:w-auto">
            <div className="inline-flex items-center p-1 bg-muted/60 dark:bg-muted/40 rounded-xl border border-border/60 gap-1 w-full sm:w-auto justify-between sm:justify-start">
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
            <TrendingUp className={`w-4 h-4 ${
              selectedMetric === 'deliveries' ? 'text-amber-500/80' : selectedMetric === 'km' ? 'text-blue-500/80' : 'text-emerald-500/80'
            }`} />
          </div>

          <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Média p/ Dia Ativo</span>
              <span className={`font-mono font-black text-sm ${
                selectedMetric === 'deliveries'
                  ? 'text-amber-500'
                  : selectedMetric === 'km'
                  ? 'text-blue-500'
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
            </div>
            <Zap className="w-4 h-4 text-amber-500/70" />
          </div>

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
        </div>

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
                          title={`${format(day, 'dd/MM/yyyy')}${isTodayDay ? ' (Hoje)' : ''}${data ? ` - ${
                            selectedMetric === 'deliveries' 
                              ? `${data.deliveries} entregas` 
                              : selectedMetric === 'km' 
                              ? `${data.km} km` 
                              : selectedMetric === 'income' 
                              ? `Fat: R$ ${data.income.toFixed(2)}` 
                              : `Lucro: R$ ${data.profit.toFixed(2)}`
                          }` : ''}`}
                          className={`w-3.5 h-3.5 rounded-[3px] border transition-all duration-150 relative cursor-pointer ${
                            getCellColor(intensity)
                          } ${
                            isTodayDay 
                              ? 'ring-2 ring-primary ring-offset-1 ring-offset-background shadow-[0_0_8px_rgba(59,130,246,0.5)] dark:shadow-[0_0_8px_rgba(96,165,250,0.6)] font-bold z-10' 
                              : ''
                          } ${isSelected ? (
                            selectedMetric === 'deliveries' 
                              ? 'ring-2 ring-amber-500 ring-offset-1 scale-115 z-20' 
                              : selectedMetric === 'km' 
                              ? 'ring-2 ring-blue-500 ring-offset-1 scale-115 z-20' 
                              : 'ring-2 ring-emerald-500 ring-offset-1 scale-115 z-20'
                          ) : 'hover:scale-115'}`}
                          aria-label={`Dia ${dateStr}${isTodayDay ? ' (Hoje)' : ''}`}
                        >
                          {/* Marcador pontual sutil no canto para reforçar visualmente o dia de hoje sem esconder a cor de fundo */}
                          {isTodayDay && (
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
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
          <div className="p-2.5 bg-popover border border-border/80 shadow-lg rounded-xl text-xs space-y-1 max-w-xs animate-in fade-in duration-150">
            <div className="font-extrabold text-foreground border-b border-border/40 pb-1 flex justify-between capitalize">
              <span>{hoveredDay.formattedDate}</span>
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
              <span>{selectedMetric === 'deliveries' ? 'Entregas:' : selectedMetric === 'km' ? 'Quilometragem:' : 'Rendimento:'}</span>
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
                <span className="text-rose-500 font-bold">Prejuízo:</span>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-[3px] bg-rose-100 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800" title="Leve" />
                  <span className="w-3 h-3 rounded-[3px] bg-rose-300/90 dark:bg-rose-800/60 border border-rose-450 dark:border-rose-650" title="Médio" />
                  <span className="w-3 h-3 rounded-[3px] bg-rose-500 border border-rose-600/95 dark:bg-rose-600 dark:border-rose-500" title="Alto" />
                  <span className="w-3 h-3 rounded-[3px] bg-rose-700 border border-rose-800 dark:bg-rose-400 dark:border-rose-300" title="Crítico" />
                </div>
              </div>
            )}
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
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-black uppercase text-foreground">
                  Detalhamento de {selectedDayDetails.formattedDate}
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

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Faturamento</span>
                <span className="font-mono font-black text-foreground text-sm">
                  {hideValues ? 'R$ •••••' : formatCurrency(selectedDayDetails.income)}
                </span>
              </div>
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Desp. Operacional</span>
                <span className="font-mono font-black text-rose-500 text-sm">
                  {hideValues ? 'R$ •••••' : formatCurrency(selectedDayDetails.opExpense)}
                </span>
              </div>
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Lucro Líquido</span>
                <span className={`font-mono font-black text-sm ${selectedDayDetails.profit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {hideValues ? 'R$ •••••' : formatCurrency(selectedDayDetails.profit)}
                </span>
              </div>
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Balanço do Caixa</span>
                <span className={`font-mono font-black text-sm ${selectedDayDetails.cashBalance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {hideValues ? 'R$ •••••' : formatCurrency(selectedDayDetails.cashBalance)}
                </span>
              </div>
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Km & Eficiência</span>
                <span className="font-mono font-black text-foreground text-sm">
                  {selectedDayDetails.km > 0 ? `${selectedDayDetails.km} km (${formatCurrency(selectedDayDetails.income / selectedDayDetails.km)}/km)` : 'N/A'}
                </span>
              </div>
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Entregas</span>
                <span className="font-mono font-black text-foreground text-sm">
                  {selectedDayDetails.deliveries > 0 ? `${selectedDayDetails.deliveries} entregas` : '0'}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
