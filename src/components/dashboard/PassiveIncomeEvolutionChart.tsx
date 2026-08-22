import React, { useState, useMemo } from 'react';
import { Dividend, ReserveTransaction, InvestmentTransaction, Reserve } from '@/types';
import { format, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { 
  TrendingUp, 
  Coins, 
  PiggyBank, 
  Building2,
  Calendar
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Bar, 
  Line, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend 
} from 'recharts';

interface PassiveIncomeEvolutionChartProps {
  dividends?: Dividend[];
  reserveTransactions?: ReserveTransaction[];
  investmentTransactions?: InvestmentTransaction[];
  reserves?: Reserve[];
  hideValues: boolean;
  formatCurrency: (val: any) => string;
}

export const PassiveIncomeEvolutionChart: React.FC<PassiveIncomeEvolutionChartProps> = ({
  dividends = [],
  reserveTransactions = [],
  investmentTransactions = [],
  reserves = [],
  hideValues,
  formatCurrency
}) => {
  const [viewMode, setViewMode] = useState<'monthly' | 'accumulated'>('monthly');
  const [selectedRangeOption, setSelectedRangeOption] = useState<'auto' | '6' | '12' | '24'>('auto');
  const [passiveIncomeGoal, setPassiveIncomeGoal] = useState<number>(100);

  const now = useMemo(() => new Date(), []);

  // 1. Identificar todas as datas com renda passiva válida
  const allEvents = useMemo(() => {
    const events: { monthStr: string; type: 'dividend' | 'reserve'; amount: number }[] = [];

    dividends.forEach(d => {
      const payDate = d.date || (d as any).payment_date;
      const amt = Number(d.amount) || Number((d as any).total_amount) || 0;
      if (payDate && amt > 0) {
        events.push({
          monthStr: payDate.split('T')[0].substring(0, 7),
          type: 'dividend',
          amount: amt
        });
      }
    });

    investmentTransactions.forEach(it => {
      const amt = Number(it.amount) || 0;
      if ((it as any).operation === 'dividend' && it.date && amt > 0) {
        events.push({
          monthStr: it.date.split('T')[0].substring(0, 7),
          type: 'dividend',
          amount: amt
        });
      }
    });

    reserveTransactions.forEach(rt => {
      const amt = Number(rt.amount) || 0;
      if (rt.type === 'rendimento' && rt.date && amt > 0) {
        events.push({
          monthStr: rt.date.split('T')[0].substring(0, 7),
          type: 'reserve',
          amount: amt
        });
      }
    });

    return events;
  }, [dividends, investmentTransactions, reserveTransactions]);

  // Se não houver nenhum dado registrado de proventos/rendimentos em nenhum momento
  const hasAnyData = allEvents.length > 0;

  // 2. Determinar o primeiro mês com dados e o range inteligente de meses
  const monthsList = useMemo(() => {
    if (!hasAnyData) return [];

    const sortedMonthStrings = [...new Set(allEvents.map(e => e.monthStr))].sort();
    const earliestMonthStr = sortedMonthStrings[0]; // e.g. "2024-03"
    const currentMonthStr = format(now, 'yyyy-MM');

    // Calcular quantos meses existem do primeiro registro até o mês atual
    const [firstYear, firstMonth] = earliestMonthStr.split('-').map(Number);
    const [currYear, currMonth] = currentMonthStr.split('-').map(Number);
    const monthsFromStart = (currYear - firstYear) * 12 + (currMonth - firstMonth) + 1;

    let count = Math.max(1, monthsFromStart);

    if (selectedRangeOption === '6') {
      count = Math.min(count, 6);
    } else if (selectedRangeOption === '12') {
      count = Math.min(count, 12);
    } else if (selectedRangeOption === '24') {
      count = Math.min(count, 24);
    } else {
      // 'auto': mostra a partir do primeiro mês com dados (limitado a no máximo 24m)
      count = Math.min(count, 24);
    }

    return Array.from({ length: count })
      .map((_, i) => subMonths(now, count - 1 - i));
  }, [hasAnyData, allEvents, now, selectedRangeOption]);

  // 3. Agrupamento mensal dos proventos + rendimentos
  const monthlyData = useMemo(() => {
    if (!hasAnyData || monthsList.length === 0) return [];

    let accumulatedTotal = 0;

    const data = monthsList.map(month => {
      const monthStr = format(month, 'yyyy-MM');
      const monthLabel = format(month, 'MMM/yy', { locale: ptBR });

      // Proventos de Investimentos (Dividendos, JCP, FIIs)
      const b3Dividends = dividends.filter(d => {
        const payDate = d.date || (d as any).payment_date;
        if (!payDate) return false;
        return payDate.startsWith(monthStr);
      }).reduce((sum, d) => sum + (Number(d.amount) || Number((d as any).total_amount) || 0), 0);

      const invDividends = investmentTransactions.filter(it => {
        if ((it as any).operation !== 'dividend' || !it.date) return false;
        return it.date.startsWith(monthStr);
      }).reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

      const totalB3Dividends = Math.max(b3Dividends, invDividends);

      // Rendimentos de Reservas (CDI, Selic)
      const reserveRendimentos = reserveTransactions.filter(rt => {
        if (rt.type !== 'rendimento' || !rt.date) return false;
        return rt.date.startsWith(monthStr);
      }).reduce((sum, rt) => sum + (Number(rt.amount) || 0), 0);

      const totalMonth = totalB3Dividends + reserveRendimentos;
      accumulatedTotal += totalMonth;

      return {
        month: monthLabel,
        monthRaw: monthStr,
        b3Dividends: Number(totalB3Dividends.toFixed(2)),
        reserveRendimentos: Number(reserveRendimentos.toFixed(2)),
        totalMonth: Number(totalMonth.toFixed(2)),
        accumulatedTotal: Number(accumulatedTotal.toFixed(2)),
        goal: passiveIncomeGoal
      };
    });

    // Se 'auto', podemos podar meses iniciais vazios caso existam
    if (selectedRangeOption === 'auto') {
      const firstActiveIdx = data.findIndex(d => d.totalMonth > 0);
      if (firstActiveIdx > 0) {
        return data.slice(firstActiveIdx);
      }
    }

    return data;
  }, [hasAnyData, monthsList, dividends, investmentTransactions, reserveTransactions, passiveIncomeGoal, selectedRangeOption]);

  // Estatísticas e Métricas Gerais
  const stats = useMemo(() => {
    const totalAllTime = monthlyData.reduce((sum, m) => sum + m.totalMonth, 0);
    const monthsWithIncome = monthlyData.filter(m => m.totalMonth > 0);
    const avgMonthly = monthlyData.length > 0 ? totalAllTime / monthlyData.length : 0;
    const avgActiveMonthly = monthsWithIncome.length > 0 ? totalAllTime / monthsWithIncome.length : 0;

    let bestMonth = { month: '-', total: 0 };
    monthlyData.forEach(m => {
      if (m.totalMonth > bestMonth.total) {
        bestMonth = { month: m.month, total: m.totalMonth };
      }
    });

    const currentMonthData = monthlyData[monthlyData.length - 1] || { totalMonth: 0, b3Dividends: 0, reserveRendimentos: 0 };
    const goalProgress = passiveIncomeGoal > 0 ? (currentMonthData.totalMonth / passiveIncomeGoal) * 100 : 0;

    return {
      totalAllTime,
      avgMonthly,
      avgActiveMonthly,
      bestMonth,
      currentMonthData,
      goalProgress
    };
  }, [monthlyData, passiveIncomeGoal]);

  // Se não houver nenhum dado, não renderiza nada para não poluir o Dashboard com cards zerados
  if (!hasAnyData || stats.totalAllTime <= 0) {
    return null;
  }

  return (
    <Card className="border border-border/70 shadow-2xs hover:shadow-xs transition-all duration-200 overflow-hidden relative group bg-card/95 rounded-2xl">
      <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl group-hover:bg-violet-500/10 transition-all pointer-events-none" />
      
      <CardHeader className="p-3.5 sm:p-4 pb-2.5 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500 border border-violet-500/20 shrink-0">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider">
                  Curva de Proventos & Renda Passiva
                </CardTitle>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 uppercase tracking-widest">
                  Bola de Neve
                </span>
              </div>
              <CardDescription className="text-xs">
                Evolução mensal dos proventos recebidos ({monthlyData.length} {monthlyData.length === 1 ? 'mês' : 'meses'} com histórico).
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Seletor de Modo de Visualização */}
            <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border border-border/60 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('monthly')}
                className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'monthly' 
                    ? 'bg-violet-500 text-white shadow-2xs font-extrabold' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setViewMode('accumulated')}
                className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'accumulated' 
                    ? 'bg-violet-500 text-white shadow-2xs font-extrabold' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Acumulado
              </button>
            </div>

            {/* Seletor de Intervalo Inteligente */}
            <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border border-border/60 shrink-0">
              {(['auto', '6', '12', '24'] as const).map((opt) => {
                const label = opt === 'auto' ? 'Auto' : `${opt}M`;
                const isSel = selectedRangeOption === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSelectedRangeOption(opt)}
                    className={`px-2 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                      isSel 
                        ? 'bg-card text-foreground shadow-2xs font-extrabold border border-border/80' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 sm:p-4 pt-3 space-y-4">
        {/* KPI Cards de Proventos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Total no Período</span>
              <span className="font-mono font-black text-violet-500 text-sm">
                {hideValues ? 'R$ •••••' : formatCurrency(stats.totalAllTime)}
              </span>
            </div>
            <Coins className="w-4 h-4 text-violet-500/70" />
          </div>

          <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Média Mensal</span>
              <span className="font-mono font-black text-foreground text-sm">
                {hideValues ? 'R$ •••••' : formatCurrency(stats.avgMonthly)}
              </span>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-500/70" />
          </div>

          <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Maior Mês</span>
              <span className="font-mono font-black text-emerald-500 text-sm">
                {hideValues ? 'R$ •••••' : formatCurrency(stats.bestMonth.total)}
              </span>
            </div>
            <span className="text-[9.5px] font-bold text-muted-foreground uppercase">
              {stats.bestMonth.month}
            </span>
          </div>

          <div className="bg-muted/30 border border-border/50 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Mês Atual</span>
              <span className="font-mono font-black text-foreground text-sm">
                {hideValues ? 'R$ •••••' : formatCurrency(stats.currentMonthData.totalMonth)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-extrabold text-violet-500">
                {stats.goalProgress.toFixed(0)}%
              </span>
              <span className="text-[8.5px] text-muted-foreground block">da meta</span>
            </div>
          </div>
        </div>

        {/* Gráfico Recharts de Proventos e Rendimentos */}
        <div className="h-64 sm:h-76 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
              <defs>
                <linearGradient id="accumulatedPassiveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/40" />
              <XAxis 
                dataKey="month" 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 10, fill: 'currentColor' }} 
                className="text-muted-foreground capitalize"
              />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val) => hideValues ? '•••' : `R$ ${val}`} 
                tick={{ fontSize: 10, fill: 'currentColor' }} 
                className="text-muted-foreground"
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-popover/95 backdrop-blur-md p-3 rounded-xl border border-border/80 shadow-xl text-xs space-y-1.5 min-w-[190px]">
                        <div className="font-extrabold text-foreground border-b border-border/40 pb-1 flex items-center justify-between">
                          <span className="capitalize">{d.month}</span>
                          <span className="text-[10px] font-bold text-violet-500 font-mono">
                            Total: {hideValues ? 'R$ •••••' : formatCurrency(d.totalMonth)}
                          </span>
                        </div>
                        <div className="space-y-1 font-mono text-[11px]">
                          <div className="flex justify-between gap-4">
                            <span className="text-indigo-500 font-semibold flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> Ações & FIIs:
                            </span>
                            <span className="font-bold text-foreground">
                              {hideValues ? 'R$ •••••' : formatCurrency(d.b3Dividends)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-emerald-500 font-semibold flex items-center gap-1">
                              <PiggyBank className="w-3 h-3" /> Rendimentos Reservas:
                            </span>
                            <span className="font-bold text-foreground">
                              {hideValues ? 'R$ •••••' : formatCurrency(d.reserveRendimentos)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4 border-t border-border/40 pt-1 text-muted-foreground">
                            <span>Acumulado Histórico:</span>
                            <span className="font-bold text-foreground">
                              {hideValues ? 'R$ •••••' : formatCurrency(d.accumulatedTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend 
                verticalAlign="top" 
                height={32} 
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', fontWeight: 600 }}
              />
              
              {viewMode === 'monthly' ? (
                <>
                  <Bar 
                    dataKey="b3Dividends" 
                    name="Ações & FIIs (B3)" 
                    stackId="a" 
                    fill="#6366f1" 
                    radius={[0, 0, 0, 0]} 
                  />
                  <Bar 
                    dataKey="reserveRendimentos" 
                    name="Rendimentos Reservas (CDI)" 
                    stackId="a" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="totalMonth" 
                    name="Total Renda Passiva" 
                    stroke="#8b5cf6" 
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#8b5cf6' }} 
                  />
                </>
              ) : (
                <Area 
                  type="monotone" 
                  dataKey="accumulatedTotal" 
                  name="Proventos Acumulados (R$)" 
                  stroke="#8b5cf6" 
                  strokeWidth={2.5}
                  fill="url(#accumulatedPassiveGrad)" 
                  dot={{ r: 3, fill: '#8b5cf6' }} 
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
