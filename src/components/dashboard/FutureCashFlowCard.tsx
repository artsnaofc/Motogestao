import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Transaction, ReserveTransaction } from '../../types';
import { addDays, format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarClock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Wallet,
  Sparkles,
  CalendarRange,
  ArrowRight,
  Layers,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts';

interface PastMonthsStats {
  hasPastData: boolean;
  avgMonthlyPersonal: number;
  avgMonthlyOpExp: number;
  avgMonthlyTotal: number;
  avgMonthlyIncome: number;
  monthsCount: number;
}

interface FutureCashFlowCardProps {
  bancaLivre: number;
  totalInReserves: number;
  transactions: Transaction[];
  reserveTransactions: ReserveTransaction[];
  pastMonthsStats: PastMonthsStats;
  fallbackMonthlyIncome: number;
  fallbackMonthlyExpense: number;
  hideValues: boolean;
  formatCurrency: (val: number) => string;
  onOpenPlanning?: () => void;
}

type HorizonDays = 30 | 60 | 90;
type ProjectionMode = 'hybrid' | 'historical' | 'commitments_only';
type IncomeScenario = 'conservative' | 'base' | 'optimistic';

export const FutureCashFlowCard: React.FC<FutureCashFlowCardProps> = ({
  bancaLivre,
  totalInReserves,
  transactions,
  reserveTransactions,
  pastMonthsStats,
  fallbackMonthlyIncome,
  fallbackMonthlyExpense,
  hideValues,
  formatCurrency,
  onOpenPlanning,
}) => {
  const [horizonDays, setHorizonDays] = useState<HorizonDays>(30);
  const [mode, setMode] = useState<ProjectionMode>('hybrid');
  const [scenario, setScenario] = useState<IncomeScenario>('base');
  const [includeReserves, setIncludeReserves] = useState<boolean>(false);

  const scenarioMultiplier =
    scenario === 'conservative' ? 0.8 : scenario === 'optimistic' ? 1.15 : 1.0;

  const projection = useMemo(() => {
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    const currentMonthStr = todayStr.slice(0, 7);
    const horizonEnd = addDays(today, horizonDays);
    const horizonEndStr = format(horizonEnd, 'yyyy-MM-dd');

    // 1. Historical monthly averages (without double counting recurring/card items in hybrid mode)
    const baseMonthlyIncome =
      pastMonthsStats.hasPastData && pastMonthsStats.avgMonthlyIncome > 0
        ? pastMonthsStats.avgMonthlyIncome
        : fallbackMonthlyIncome;

    const baseMonthlyExpense =
      pastMonthsStats.hasPastData && pastMonthsStats.avgMonthlyTotal > 0
        ? pastMonthsStats.avgMonthlyTotal
        : fallbackMonthlyExpense;

    // Measure recurring vs variable expenses across past months
    const pastMonthBuckets: Record<string, { recurring: number; variable: number }> = {};
    (transactions || []).forEach(t => {
      if (t.type !== 'expense' || t.payment_status === 'pending' || t.ignore_in_charts) return;
      if (
        t.category === 'Aporte Reserva' ||
        t.category === 'Resgate Reserva' ||
        t.category === 'Resgate de Reserva'
      ) {
        return;
      }
      const dStr = (t.date || '').split('T')[0];
      const mStr = dStr.slice(0, 7);
      if (!mStr || mStr >= currentMonthStr) return;

      if (!pastMonthBuckets[mStr]) pastMonthBuckets[mStr] = { recurring: 0, variable: 0 };
      const isFixedOrCard =
        Boolean(t.is_recurring) ||
        Boolean((t.notes || '').includes('[card:')) ||
        Boolean((t.description || '').includes('[Cartão'));

      if (isFixedOrCard) {
        pastMonthBuckets[mStr].recurring += Number(t.amount) || 0;
      } else {
        pastMonthBuckets[mStr].variable += Number(t.amount) || 0;
      }
    });

    const bucketKeys = Object.keys(pastMonthBuckets);
    const avgMonthlyVariableHistorical =
      bucketKeys.length > 0
        ? bucketKeys.reduce((acc, k) => acc + pastMonthBuckets[k].variable, 0) / bucketKeys.length
        : baseMonthlyExpense;

    // 2. Collect all pending scheduled outflows (transactions + reserve utilizations)
    interface ScheduledItem {
      id: string;
      dateStr: string;
      amount: number;
      title: string;
      category: string;
      isCard: boolean;
      isOverdue: boolean;
    }

    const scheduledItems: ScheduledItem[] = [];
    const scheduledByDate: Record<string, number> = {};
    let overduePendingTotal = 0;
    let overduePendingCount = 0;
    let horizonPendingTotal = 0;
    let horizonCardTotal = 0;

    const registerPending = (
      id: string,
      dueDateStr: string,
      amount: number,
      title: string,
      category: string,
      isCard: boolean
    ) => {
      if (!dueDateStr || amount <= 0) return;
      if (dueDateStr < todayStr) {
        overduePendingTotal += amount;
        overduePendingCount += 1;
        scheduledItems.push({
          id,
          dateStr: dueDateStr,
          amount,
          title,
          category,
          isCard,
          isOverdue: true,
        });
      } else if (dueDateStr <= horizonEndStr) {
        horizonPendingTotal += amount;
        if (isCard) horizonCardTotal += amount;
        scheduledByDate[dueDateStr] = (scheduledByDate[dueDateStr] || 0) + amount;
        scheduledItems.push({
          id,
          dateStr: dueDateStr,
          amount,
          title,
          category,
          isCard,
          isOverdue: false,
        });
      }
    };

    (transactions || []).forEach(t => {
      if (t.payment_status !== 'pending' || t.type !== 'expense') return;
      const dueStr = (t.due_date || t.date || '').split('T')[0];
      const isCard =
        Boolean((t.notes || '').includes('[card:')) ||
        Boolean((t.description || '').includes('[Cartão'));
      registerPending(
        t.id,
        dueStr,
        Number(t.amount) || 0,
        t.description || t.category || 'Conta agendada',
        t.category || 'Outros',
        isCard
      );
    });

    (reserveTransactions || []).forEach(rt => {
      if (rt.payment_status !== 'pending' || rt.type !== 'utilizacao') return;
      const dueStr = (rt.due_date || rt.date || '').split('T')[0];
      registerPending(
        rt.id,
        dueStr,
        Number(rt.amount) || 0,
        rt.description || rt.category || 'Despesa de Reserva',
        rt.category || 'Reserva',
        false
      );
    });

    scheduledItems.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    // If user has no pending bills registered yet and hybrid variable == baseMonthlyExpense,
    // use avgMonthlyVariableHistorical cleanly; if pending bills exist in horizon, hybrid combines
    // exact scheduled commitments + historical variable/day-to-day average (avoiding double counting).
    const variableMonthlyEstimate =
      horizonPendingTotal > 0 ? avgMonthlyVariableHistorical : baseMonthlyExpense;

    const dailyProjectedIncome =
      mode === 'commitments_only' ? 0 : (baseMonthlyIncome * scenarioMultiplier) / 30;
    const dailyEstimatedVariableExpense =
      mode === 'commitments_only'
        ? 0
        : mode === 'historical'
          ? baseMonthlyExpense / 30
          : variableMonthlyEstimate / 30;

    // Build daily trajectory
    const startCash = bancaLivre + (includeReserves ? totalInReserves : 0);
    let runningBalance = startCash - (mode !== 'historical' ? overduePendingTotal : 0);
    let lowestBalance = runningBalance;
    let lowestDateStr = todayStr;
    let totalProjectedInflows = 0;
    let totalEstimatedVariableOutflows = 0;

    const chartPoints: {
      dateStr: string;
      label: string;
      saldo: number;
      compromissos: number;
    }[] = [
      {
        dateStr: todayStr,
        label: 'Hoje',
        saldo: Number(runningBalance.toFixed(2)),
        compromissos: overduePendingTotal,
      },
    ];

    for (let i = 1; i <= horizonDays; i++) {
      const d = addDays(today, i);
      const dStr = format(d, 'yyyy-MM-dd');
      const dayScheduled = mode === 'historical' ? 0 : (scheduledByDate[dStr] || 0);

      runningBalance += dailyProjectedIncome;
      runningBalance -= dailyEstimatedVariableExpense;
      runningBalance -= dayScheduled;

      totalProjectedInflows += dailyProjectedIncome;
      totalEstimatedVariableOutflows += dailyEstimatedVariableExpense;

      if (runningBalance < lowestBalance) {
        lowestBalance = runningBalance;
        lowestDateStr = dStr;
      }

      const stepInterval = horizonDays === 30 ? 2 : horizonDays === 60 ? 4 : 6;
      if (i % stepInterval === 0 || i === horizonDays || dayScheduled > 0) {
        chartPoints.push({
          dateStr: dStr,
          label: format(d, 'dd/MM'),
          saldo: Number(runningBalance.toFixed(2)),
          compromissos: dayScheduled,
        });
      }
    }

    const totalOutflowsInProjection =
      totalEstimatedVariableOutflows +
      (mode === 'historical' ? 0 : horizonPendingTotal + overduePendingTotal);

    return {
      startCash,
      endBalance: runningBalance,
      lowestBalance,
      lowestDateStr,
      totalProjectedInflows,
      totalEstimatedVariableOutflows,
      totalOutflowsInProjection,
      horizonPendingTotal,
      horizonCardTotal,
      overduePendingTotal,
      overduePendingCount,
      baseMonthlyIncome,
      baseMonthlyExpense,
      variableMonthlyEstimate,
      chartPoints,
      upcomingItems: scheduledItems.slice(0, 6),
      totalScheduledCount: scheduledItems.length,
    };
  }, [
    bancaLivre,
    totalInReserves,
    includeReserves,
    transactions,
    reserveTransactions,
    pastMonthsStats,
    fallbackMonthlyIncome,
    fallbackMonthlyExpense,
    horizonDays,
    mode,
    scenarioMultiplier,
  ]);

  const isHealthyEnd = projection.endBalance >= 0;
  const hasLowCashRisk = projection.lowestBalance < 0;

  return (
    <Card className="border border-border/80 shadow-xs rounded-2xl bg-card/95 overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-gradient-to-r from-indigo-500/[0.04] via-transparent to-cyan-500/[0.04]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <CalendarClock className="w-4.5 h-4.5 text-indigo-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-sm sm:text-base font-black text-foreground tracking-tight">
                  Projeção Inteligente de Fluxo de Caixa
                </CardTitle>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                    hasLowCashRisk
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/25'
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25'
                  }`}
                >
                  {hasLowCashRisk ? 'Risco de Saldo Negativo' : 'Fluxo Sustentável'}
                </span>
              </div>
              <CardDescription className="text-xs mt-0.5">
                {pastMonthsStats.hasPastData
                  ? `Baseado na média dos últimos ${pastMonthsStats.monthsCount} meses + contas e cartões agendados para os próximos ${horizonDays} dias.`
                  : `Baseado no ritmo do período atual + contas e faturas agendadas nos próximos ${horizonDays} dias.`}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Horizon Toggle */}
            <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border border-border/60">
              {([30, 60, 90] as HorizonDays[]).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setHorizonDays(d)}
                  className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                    horizonDays === d
                      ? 'bg-background text-foreground shadow-2xs border border-border/50'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>

            {onOpenPlanning && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenPlanning}
                className="h-8 px-3 rounded-xl text-[11px] font-extrabold border-indigo-500/30 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 gap-1.5 cursor-pointer"
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Calendário & Cartões</span>
              </Button>
            )}
          </div>
        </div>

        {/* Model & Scenario Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mr-1">
              Modelo:
            </span>
            {(
              [
                { id: 'hybrid', label: 'Híbrido (Média Var. + Agendados)' },
                { id: 'historical', label: 'Só Média Histórica' },
                { id: 'commitments_only', label: 'Só Compromissos (Sem Ganhos)' },
              ] as { id: ProjectionMode; label: string }[]
            ).map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition-all cursor-pointer ${
                  mode === m.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-muted/30 text-muted-foreground border-border/60 hover:text-foreground'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {mode !== 'commitments_only' && (
              <div className="flex items-center p-0.5 bg-muted/50 rounded-lg border border-border/50">
                {(
                  [
                    { id: 'conservative', label: '80%' },
                    { id: 'base', label: '100%' },
                    { id: 'optimistic', label: '115%' },
                  ] as { id: IncomeScenario; label: string }[]
                ).map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScenario(s.id)}
                    title="Cenário de faturamento em relação à média mensal"
                    className={`px-2 py-0.5 text-[10px] font-black rounded-md transition-all cursor-pointer ${
                      scenario === s.id
                        ? 'bg-emerald-500 text-white shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Ganhos {s.label}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIncludeReserves(prev => !prev)}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                includeReserves
                  ? 'bg-pink-500/15 border-pink-500/40 text-pink-500'
                  : 'bg-muted/30 border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wallet className="w-3 h-3" />
              <span>{includeReserves ? 'Caixa + Reservas' : 'Só Caixa Livre'}</span>
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" /> Saldo em {horizonDays} Dias
            </span>
            <p
              className={`text-base sm:text-lg font-black font-mono tracking-tight ${
                isHealthyEnd ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {hideValues ? 'R$ •••••' : formatCurrency(projection.endBalance)}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium">
              Partindo de {hideValues ? '•••' : formatCurrency(projection.startCash)}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-emerald-500/[0.03] p-3 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Ganhos Estimados
            </span>
            <p className="text-base sm:text-lg font-black font-mono tracking-tight text-emerald-500">
              {hideValues ? 'R$ •••••' : `+${formatCurrency(projection.totalProjectedInflows)}`}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium">
              Média base: {hideValues ? '•••' : formatCurrency(projection.baseMonthlyIncome)}/mês
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-rose-500/[0.03] p-3 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Saídas Projetadas
            </span>
            <p className="text-base sm:text-lg font-black font-mono tracking-tight text-rose-500">
              {hideValues ? 'R$ •••••' : `-${formatCurrency(projection.totalOutflowsInProjection)}`}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium truncate">
              {mode === 'hybrid'
                ? `Var: ${hideValues ? '•••' : formatCurrency(projection.totalEstimatedVariableOutflows)} + Agend: ${hideValues ? '•••' : formatCurrency(projection.horizonPendingTotal + projection.overduePendingTotal)}`
                : mode === 'historical'
                  ? `Média: ${hideValues ? '•••' : formatCurrency(projection.baseMonthlyExpense)}/mês`
                  : `${projection.totalScheduledCount} conta(s) pendente(s)`}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-amber-500/[0.03] p-3 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <CreditCard className="w-3 h-3" /> Faturas & Contas
            </span>
            <p className="text-base sm:text-lg font-black font-mono tracking-tight text-amber-500">
              {hideValues
                ? 'R$ •••••'
                : formatCurrency(projection.horizonPendingTotal + projection.overduePendingTotal)}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium truncate">
              {projection.horizonCardTotal > 0
                ? `Inclui ${hideValues ? '•••' : formatCurrency(projection.horizonCardTotal)} em cartões`
                : `${projection.totalScheduledCount} compromisso(s) no radar`}
            </p>
          </div>
        </div>

        {/* Low balance / overdue warning */}
        {(hasLowCashRisk || projection.overduePendingCount > 0) && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-start sm:items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                {hasLowCashRisk &&
                  `Vale mínimo projetado de ${hideValues ? 'R$ •••' : formatCurrency(projection.lowestBalance)} em ${format(new Date(projection.lowestDateStr + 'T12:00:00'), 'dd/MM')}. `}
                {projection.overduePendingCount > 0 &&
                  `Há ${projection.overduePendingCount} conta(s) vencida(s) totalizando ${hideValues ? 'R$ •••' : formatCurrency(projection.overduePendingTotal)}.`}
              </span>
            </div>
            {onOpenPlanning && (
              <button
                type="button"
                onClick={onOpenPlanning}
                className="text-[11px] font-black underline shrink-0 text-rose-600 dark:text-rose-300 cursor-pointer"
              >
                Ajustar no Calendário →
              </button>
            )}
          </div>
        )}

        {/* Chart + Upcoming Bills Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          <div className="lg:col-span-2 h-[220px] sm:h-[240px] rounded-xl border border-border/50 bg-muted/10 p-2.5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projection.chartPoints} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="futureSaldoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isHealthyEnd ? '#6366f1' : '#f43f5e'} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={isHealthyEnd ? '#6366f1' : '#f43f5e'} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#71717a', fontWeight: 700 }}
                  minTickGap={22}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#71717a', fontWeight: 700 }}
                  tickFormatter={v => (hideValues ? '•••' : `R$${Math.round(v)}`)}
                />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#27272a',
                    borderRadius: '12px',
                  }}
                  labelStyle={{ fontWeight: 'bold', fontSize: 12, color: '#f4f4f5' }}
                  formatter={(value: any, name: any) => [
                    hideValues ? 'R$ •••••' : formatCurrency(Number(value)),
                    name === 'saldo' ? 'Saldo Projetado' : 'Contas no Dia',
                  ]}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload;
                    if (!p?.dateStr) return '';
                    return format(new Date(p.dateStr + 'T12:00:00'), "EEEE, dd 'de' MMM", { locale: ptBR });
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  stroke={isHealthyEnd ? '#6366f1' : '#f43f5e'}
                  strokeWidth={2.5}
                  fill="url(#futureSaldoGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/15 p-3 flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-[11px] font-black uppercase tracking-wider text-foreground">
                  Próximos Vencimentos
                </span>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground">
                {projection.totalScheduledCount} total
              </span>
            </div>

            {projection.upcomingItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-4 space-y-2">
                <ShieldCheck className="w-7 h-7 text-emerald-500/60" />
                <p className="text-[11px] font-semibold text-muted-foreground leading-snug">
                  Nenhuma fatura ou conta agendada para os próximos {horizonDays} dias.
                </p>
                {onOpenPlanning && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenPlanning}
                    className="h-7 text-[10.5px] font-bold rounded-lg cursor-pointer"
                  >
                    + Agendar conta ou cartão
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[165px] pr-0.5 custom-scrollbar">
                {projection.upcomingItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] ${
                      item.isOverdue
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : 'bg-card/80 border-border/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate flex items-center gap-1">
                        {item.isCard && <CreditCard className="w-3 h-3 text-purple-500 shrink-0" />}
                        <span className="truncate">{item.title}</span>
                      </p>
                      <p className="text-[9.5px] font-semibold text-muted-foreground">
                        {item.isOverdue ? '⚠️ Vencida em ' : 'Vence '}
                        {format(new Date(item.dateStr + 'T12:00:00'), 'dd/MM')} • {item.category}
                      </p>
                    </div>
                    <span className="font-mono font-black text-rose-500 shrink-0">
                      {hideValues ? '•••' : formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {onOpenPlanning && (
              <button
                type="button"
                onClick={onOpenPlanning}
                className="w-full pt-1.5 border-t border-border/40 text-[11px] font-extrabold text-indigo-500 hover:text-indigo-400 flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Gerenciar Faturas & Contas</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
