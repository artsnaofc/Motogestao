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
      profit: number;
      km: number;
      deliveries: number;
      txCount: number;
      txs: Transaction[];
    }> = {};

    const personalCats = settings?.personal_expense_categories || ['Alimentação', 'Mercado', 'Lazer', 'Saúde', 'Pessoal'];

    transactions.forEach(t => {
      if (!t.date) return;
      const dateStr = t.date.split('T')[0];
      if (!map[dateStr]) {
        map[dateStr] = {
          income: 0,
          expense: 0,
          opExpense: 0,
          perExpense: 0,
          profit: 0,
          km: 0,
          deliveries: 0,
          txCount: 0,
          txs: []
        };
      }

      const entry = map[dateStr];
      const amount = Number(t.amount) || 0;
      entry.txCount += 1;
      entry.txs.push(t);

      if (t.type === 'income') {
        entry.income += amount;
      } else if (t.type === 'expense') {
        entry.expense += amount;
        const isPersonal = personalCats.includes(t.category) || (t as any).category_type === 'pessoal';
        if (isPersonal) {
          entry.perExpense += amount;
        } else {
          entry.opExpense += amount;
        }
      }

      // Quilometragem
      if (t.end_km && t.start_km && t.end_km > t.start_km) {
        entry.km += (t.end_km - t.start_km);
      } else if ((t as any).km) {
        entry.km += Number((t as any).km) || 0;
      }

      // Entregas realizadas
      if (t.deliveries && Number(t.deliveries) > 0) {
        entry.deliveries += Number(t.deliveries);
      } else if (t.category === 'Pizzaria' || t.category === 'Frete do Dia' || t.category?.toLowerCase().includes('frete')) {
        const desc = t.description || '';
        const match = desc.match(/(\d+)\s*(entregas?|corridas?|pedidos?)/i);
        if (match && match[1]) {
          entry.deliveries += parseInt(match[1], 10);
        } else {
          entry.deliveries += 1;
        }
      }
    });

    // Lucro operacional do dia
    Object.keys(map).forEach(dateStr => {
      const e = map[dateStr];
      e.profit = e.income - e.opExpense;
    });

    return map;
  }, [transactions, settings]);

  // Todas as datas com atividade real
  const activeDateStrings = useMemo(() => {
    return Object.keys(dailyStatsMap)
      .filter(d => dailyStatsMap[d].txCount > 0 && (dailyStatsMap[d].income > 0 || dailyStatsMap[d].profit > 0 || dailyStatsMap[d].km > 0))
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

  // Encontrar valores máximos para a escala de cores (0 a 4)
  const maxValues = useMemo(() => {
    let maxProfit = 1;
    let maxIncome = 1;
    let maxDeliveries = 1;
    let maxKm = 1;

    Object.values(dailyStatsMap).forEach(st => {
      if (st.profit > maxProfit) maxProfit = st.profit;
      if (st.income > maxIncome) maxIncome = st.income;
      if (st.deliveries > maxDeliveries) maxDeliveries = st.deliveries;
      if (st.km > maxKm) maxKm = st.km;
    });

    return { maxProfit, maxIncome, maxDeliveries, maxKm };
  }, [dailyStatsMap]);

  const getDayIntensity = (day: Date): number => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const data = dailyStatsMap[dateStr];
    if (!data || data.txCount === 0) return 0;

    let val = 0;
    let max = 1;

    switch (selectedMetric) {
      case 'profit':
        val = data.profit;
        max = maxValues.maxProfit;
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

    if (val <= 0) return 0;
    const ratio = val / (max || 1);
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.50) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  const getCellColor = (intensity: number) => {
    switch (intensity) {
      case 1:
        return 'bg-emerald-500/25 dark:bg-emerald-500/30 border-emerald-500/40 text-emerald-950 dark:text-emerald-200';
      case 2:
        return 'bg-emerald-500/50 dark:bg-emerald-500/55 border-emerald-500/60 text-white';
      case 3:
        return 'bg-emerald-600/80 dark:bg-emerald-500/80 border-emerald-600 text-white';
      case 4:
        return 'bg-emerald-600 dark:bg-emerald-400 border-emerald-700 text-white dark:text-emerald-950 shadow-xs shadow-emerald-500/30 font-bold';
      default:
        return 'bg-muted/40 dark:bg-muted/30 border-border/40 text-muted-foreground/50 hover:border-border';
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
    let totalKm = 0;
    let totalDeliveries = 0;
    let bestDay = { date: '', profit: 0 };

    allDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const data = dailyStatsMap[dateStr];
      if (data && (data.income > 0 || data.txCount > 0)) {
        activeDays += 1;
        totalIncome += data.income;
        totalProfit += data.profit;
        totalKm += data.km;
        totalDeliveries += data.deliveries;
        if (data.profit > bestDay.profit) {
          bestDay = { date: dateStr, profit: data.profit };
        }
      }
    });

    // Média real por dia trabalhado (evita distorção com dias off)
    const avgDailyProfit = activeDays > 0 ? totalProfit / activeDays : 0;
    const consistencyRate = allDays.length > 0 ? (activeDays / allDays.length) * 100 : 0;

    return {
      activeDays,
      totalDays: allDays.length,
      consistencyRate,
      totalIncome,
      totalProfit,
      totalKm,
      totalDeliveries,
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
      
      <CardHeader className="p-3.5 sm:p-4 pb-2.5 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider">
                  Calendário & Heatmap de Produtividade Diária
                </CardTitle>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                  Consistência
                </span>
              </div>
              <CardDescription className="text-xs">
                Ritmo de trabalho e lucros diários ({summaryStats.activeDays} dias trabalhados no período).
              </CardDescription>
            </div>
          </div>

          {/* Controles de Métrica e Período */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Seletor de Métrica */}
            <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border border-border/60 shrink-0">
              {(['profit', 'income', 'deliveries', 'km'] as MetricType[]).map((metric) => {
                const labels: Record<MetricType, string> = {
                  profit: 'Lucro',
                  income: 'Faturamento',
                  deliveries: 'Entregas',
                  km: 'Km'
                };
                const isSel = selectedMetric === metric;
                return (
                  <button
                    key={metric}
                    type="button"
                    onClick={() => setSelectedMetric(metric)}
                    className={`px-2 py-1 text-[10.5px] font-bold rounded-lg transition-all capitalize cursor-pointer ${
                      isSel 
                        ? 'bg-emerald-500 text-white shadow-2xs font-extrabold' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {labels[metric]}
                  </button>
                );
              })}
            </div>

            {/* Seletor de Intervalo Inteligente */}
            <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border border-border/60 shrink-0">
              {(['auto', '3months', '6months', 'year'] as const).map((rng) => {
                const labels = {
                  'auto': 'Auto',
                  '3months': '3M',
                  '6months': '6M',
                  'year': 'Ano'
                };
                const isSel = selectedRange === rng;
                return (
                  <button
                    key={rng}
                    type="button"
                    onClick={() => setSelectedRange(rng)}
                    className={`px-2 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                      isSel 
                        ? 'bg-card text-foreground shadow-2xs font-extrabold border border-border/80' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {labels[rng]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 sm:p-4 pt-3 space-y-4">
        {/* KPI Strip Rápido */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Dias Ativos</span>
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
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Lucro no Período</span>
              <span className="font-mono font-black text-emerald-500 text-sm">
                {hideValues ? 'R$ •••••' : formatCurrency(summaryStats.totalProfit)}
              </span>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-500/70" />
          </div>

          <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Média p/ Dia Ativo</span>
              <span className="font-mono font-black text-foreground text-sm">
                {hideValues ? 'R$ •••••' : formatCurrency(summaryStats.avgDailyProfit)}
              </span>
            </div>
            <Zap className="w-4 h-4 text-amber-500/70" />
          </div>

          <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Total Rodado</span>
              <span className="font-mono font-black text-foreground text-sm">
                {summaryStats.totalKm.toLocaleString('pt-BR')} km
              </span>
            </div>
            <Bike className="w-4 h-4 text-indigo-500/70" />
          </div>
        </div>

        {/* Heatmap Grid Principal */}
        <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin relative">
          <div className="min-w-[600px] inline-flex flex-col gap-1.5">
            {/* Header com os Meses */}
            <div className="flex gap-1 pl-6 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
              {weeks.map((week, wIdx) => {
                const firstDayOfWeek = week[0];
                const isFirstWeekOfMonth = firstDayOfWeek.getDate() <= 7;
                if (isFirstWeekOfMonth || wIdx === 0) {
                  return (
                    <div 
                      key={wIdx} 
                      className="text-left font-black text-foreground/80 capitalize"
                      style={{ width: '15px' }}
                    >
                      {format(firstDayOfWeek, 'MMM', { locale: ptBR })}
                    </div>
                  );
                }
                return <div key={wIdx} style={{ width: '15px' }} />;
              })}
            </div>

            {/* Grid com dias da semana nas linhas e semanas nas colunas */}
            <div className="flex gap-1">
              {/* Rótulos dos dias (D, S, T, Q, Q, S, S) */}
              <div className="flex flex-col justify-between text-[9px] font-bold text-muted-foreground/70 pr-1 select-none">
                {weekdays.map((dayName, idx) => (
                  <span key={idx} className="h-3.5 leading-3.5">{idx % 2 === 1 ? dayName : ''}</span>
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
                          title={`${format(day, 'dd/MM/yyyy')}${data ? ` - Lucro: R$ ${data.profit.toFixed(2)}` : ''}`}
                          className={`w-3.5 h-3.5 rounded-[3px] border transition-all duration-150 relative cursor-pointer ${
                            getCellColor(intensity)
                          } ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-1 scale-115 z-10' : 'hover:scale-115'}`}
                          aria-label={`Dia ${dateStr}`}
                        />
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
              <span className="text-emerald-500 font-mono font-bold">
                {hideValues ? 'R$ •••••' : formatCurrency(hoveredDay.data.profit)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono">
              <div>Fat: <strong className="text-foreground">{hideValues ? '••••' : formatCurrency(hoveredDay.data.income)}</strong></div>
              <div>Desp: <strong className="text-rose-500">{hideValues ? '••••' : formatCurrency(hoveredDay.data.opExpense)}</strong></div>
              {hoveredDay.data.km > 0 && <div>Km: <strong className="text-foreground">{hoveredDay.data.km} km</strong></div>}
              {hoveredDay.data.deliveries > 0 && <div>Entregas: <strong className="text-foreground">{hoveredDay.data.deliveries}</strong></div>}
            </div>
          </div>
        )}

        {/* Legenda de Intensidade */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span>Menor ritmo</span>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-[3px] bg-muted/40 border border-border/40" />
              <span className="w-3 h-3 rounded-[3px] bg-emerald-500/25 border border-emerald-500/40" />
              <span className="w-3 h-3 rounded-[3px] bg-emerald-500/50 border border-emerald-500/60" />
              <span className="w-3 h-3 rounded-[3px] bg-emerald-600/80 border border-emerald-600" />
              <span className="w-3 h-3 rounded-[3px] bg-emerald-500 border border-emerald-600" />
            </div>
            <span>Maior ritmo</span>
          </div>

          <div className="text-[10.5px] flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-500" />
            <span>Passe o mouse ou toque no quadradinho para ver o detalhamento do dia.</span>
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
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
                <span className="font-mono font-black text-emerald-500 text-sm">
                  {hideValues ? 'R$ •••••' : formatCurrency(selectedDayDetails.profit)}
                </span>
              </div>
              <div className="bg-card/70 p-2 rounded-lg border border-border/40">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">Km & Eficiência</span>
                <span className="font-mono font-black text-foreground text-sm">
                  {selectedDayDetails.km > 0 ? `${selectedDayDetails.km} km (${formatCurrency(selectedDayDetails.income / selectedDayDetails.km)}/km)` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
