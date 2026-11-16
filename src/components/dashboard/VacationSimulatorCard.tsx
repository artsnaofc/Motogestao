import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plane, ShieldCheck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface VacationSimulatorCardProps {
  pastMonthsStats: {
    hasPastData: boolean;
    avgMonthlyPersonal: number;
    avgMonthlyOpExp: number;
    avgMonthlyTotal: number;
    monthsCount: number;
  };
  fallbackMonthlyPersonal: number;
  fallbackMonthlyOpExp: number;
  bancaLivre: number;
  totalInReserves: number;
  hideValues: boolean;
  formatCurrency: (val: any) => string;
}

export function VacationSimulatorCard({
  pastMonthsStats,
  fallbackMonthlyPersonal,
  fallbackMonthlyOpExp,
  bancaLivre,
  totalInReserves,
  hideValues,
  formatCurrency
}: VacationSimulatorCardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [daysOff, setDaysOff] = useState<number>(15);
  const [weeksUntilBreak, setWeeksUntilBreak] = useState<number>(8);
  const [includeFixedOp, setIncludeFixedOp] = useState<boolean>(false);
  const [extraLeisure, setExtraLeisure] = useState<string>('0');

  const sim = useMemo(() => {
    const monthlyPersonal = pastMonthsStats.hasPastData && pastMonthsStats.avgMonthlyPersonal > 0
      ? pastMonthsStats.avgMonthlyPersonal
      : fallbackMonthlyPersonal;

    const monthlyOp = pastMonthsStats.hasPastData && pastMonthsStats.avgMonthlyOpExp > 0
      ? pastMonthsStats.avgMonthlyOpExp
      : fallbackMonthlyOpExp;

    const dailyPersonalBurn = monthlyPersonal / 30;
    // Consider ~35% of operational expenses as recurring fixed costs (insurance, plan, installments) when enabled
    const dailyOpFixedBurn = includeFixedOp ? (monthlyOp * 0.35) / 30 : 0;
    const dailyStopCost = dailyPersonalBurn + dailyOpFixedBurn;

    const extraVal = Math.max(0, parseFloat(String(extraLeisure || '0').replace(',', '.')) || 0);
    const totalStopNeed = dailyStopCost * daysOff + extraVal;

    const liquidPool = Math.max(0, bancaLivre) + Math.max(0, totalInReserves);
    const gap = Math.max(0, totalStopNeed - liquidPool);
    const leadDays = Math.max(1, weeksUntilBreak * 7);
    const dailySaveTarget = gap > 0 ? gap / leadDays : totalStopNeed / leadDays;
    const weeklySaveTarget = dailySaveTarget * 7;
    const isCovered = liquidPool >= totalStopNeed && totalStopNeed > 0;

    return {
      monthlyPersonal: Math.round(monthlyPersonal * 100) / 100,
      dailyStopCost: Math.round(dailyStopCost * 100) / 100,
      totalStopNeed: Math.round(totalStopNeed * 100) / 100,
      liquidPool: Math.round(liquidPool * 100) / 100,
      gap: Math.round(gap * 100) / 100,
      dailySaveTarget: Math.round(dailySaveTarget * 100) / 100,
      weeklySaveTarget: Math.round(weeklySaveTarget * 100) / 100,
      isCovered,
      usingPastHistory: pastMonthsStats.hasPastData && pastMonthsStats.avgMonthlyPersonal > 0
    };
  }, [pastMonthsStats, fallbackMonthlyPersonal, fallbackMonthlyOpExp, includeFixedOp, extraLeisure, daysOff, bancaLivre, totalInReserves, weeksUntilBreak]);

  return (
    <Card className="border border-border/70 shadow-2xs rounded-2xl bg-card/95 overflow-hidden">
      <CardHeader
        onClick={() => setIsExpanded(prev => !prev)}
        className={`p-4 sm:p-5 cursor-pointer select-none transition-colors hover:bg-muted/25 ${
          isExpanded ? 'pb-3 border-b border-border/40' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 shrink-0">
              <Plane className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm sm:text-base font-black text-foreground tracking-tight">
                Simulador de Férias e Ausências (Planejamento de Parada)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {isExpanded
                  ? 'Calcule quanto precisa guardar antes de parar para cobrir suas despesas sem aperto.'
                  : 'Clique para expandir e simular quantos dias pode parar sem apertar o orçamento.'}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isExpanded && (
              <span className="hidden md:inline text-[11px] font-semibold text-muted-foreground">
                {sim.usingPastHistory
                  ? `Base: média de ${pastMonthsStats.monthsCount} ${pastMonthsStats.monthsCount === 1 ? 'mês anterior' : 'meses anteriores'}`
                  : 'Base: gastos do período atual'}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(prev => !prev);
              }}
              aria-expanded={isExpanded}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border/70 bg-muted/30 hover:bg-muted/60 text-xs font-bold text-foreground transition-colors cursor-pointer"
            >
              <span>{isExpanded ? 'Ocultar' : 'Simular'}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Days Off Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground block">
              Dias parado (férias / folga)
            </label>
            <div className="flex items-center gap-1.5">
              {[7, 15, 21, 30].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDaysOff(d)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    daysOff === d
                      ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                      : 'bg-muted/30 text-muted-foreground border-border/60 hover:text-foreground'
                  }`}
                >
                  {d}d
                </button>
              ))}
              <Input
                type="number"
                min={1}
                max={365}
                value={daysOff}
                onChange={e => setDaysOff(Math.max(1, Math.min(365, parseInt(e.target.value || '1', 10) || 1)))}
                className="h-8 w-16 text-xs font-mono rounded-xl text-center"
              />
            </div>
          </div>

          {/* Lead Time Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground block">
              Antecedência até a parada
            </label>
            <div className="flex items-center gap-1.5">
              {[4, 8, 12, 24].map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeeksUntilBreak(w)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    weeksUntilBreak === w
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-muted/30 text-muted-foreground border-border/60 hover:text-foreground'
                  }`}
                >
                  {w} sem
                </button>
              ))}
            </div>
          </div>

          {/* Extra Budget + Op Toggle */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground flex items-center justify-between">
              <span>Orçamento extra viagem/lazer (R$)</span>
              <button
                type="button"
                onClick={() => setIncludeFixedOp(prev => !prev)}
                className={`text-[10px] font-bold cursor-pointer ${
                  includeFixedOp ? 'text-sky-600 dark:text-sky-400 underline' : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Incluir 35% das despesas operacionais como custos fixos durante a pausa"
              >
                {includeFixedOp ? '✓ C/ op. fixos' : '+ C/ op. fixos'}
              </button>
            </label>
            <Input
              type="number"
              min={0}
              step="50"
              value={extraLeisure}
              onChange={e => setExtraLeisure(e.target.value)}
              placeholder="0"
              className="h-8 text-xs font-mono rounded-xl"
            />
          </div>
        </div>

        {/* Results Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20">
            <span className="text-[11px] font-bold text-sky-700 dark:text-sky-300 block">
              Reserva Total Necessária
            </span>
            <p className="text-base sm:text-lg font-black font-mono tabular-nums text-foreground mt-1">
              {hideValues ? 'R$ •••••' : formatCurrency(sim.totalStopNeed)}
            </p>
            <p className="text-[10.5px] text-muted-foreground mt-0.5">
              Custo diário parado: <strong className="font-mono">{hideValues ? '•••' : formatCurrency(sim.dailyStopCost)}</strong>/dia
            </p>
          </div>

          <div className={`p-3 rounded-xl border ${
            sim.isCovered
              ? 'bg-emerald-500/5 border-emerald-500/25'
              : 'bg-amber-500/5 border-amber-500/25'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold ${sim.isCovered ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
                {sim.isCovered ? 'Cobertura Atual' : 'Falta Acumular'}
              </span>
              {sim.isCovered ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              )}
            </div>
            <p className={`text-base sm:text-lg font-black font-mono tabular-nums mt-1 ${
              sim.isCovered ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
            }`}>
              {hideValues ? 'R$ •••••' : sim.isCovered ? '100% Coberto' : formatCurrency(sim.gap)}
            </p>
            <p className="text-[10.5px] text-muted-foreground mt-0.5">
              Caixa + Reservas atuais: <strong className="font-mono">{hideValues ? '••••' : formatCurrency(sim.liquidPool)}</strong>
            </p>
          </div>

          <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 block">
              {sim.gap > 0 ? `Ritmo p/ ${weeksUntilBreak} semanas` : 'Meta p/ poupar do zero'}
            </span>
            <p className="text-base sm:text-lg font-black font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
              {hideValues ? 'R$ •••••' : `${formatCurrency(sim.dailySaveTarget)}/dia`}
            </p>
            <p className="text-[10.5px] text-muted-foreground mt-0.5">
              Equivale a <strong className="font-mono text-foreground">{hideValues ? '••••' : formatCurrency(sim.weeklySaveTarget)}/sem</strong> antes da pausa
            </p>
          </div>
        </div>
      </CardContent>
      )}
    </Card>
  );
}
