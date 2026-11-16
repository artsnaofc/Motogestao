import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transaction } from '../../types';
import { isOperationalCategory } from '../reserves/reserveUtils';
import { format, parseISO, subDays, startOfDay } from 'date-fns';
import { Calendar, Trophy, Coffee, TrendingUp } from 'lucide-react';

interface WeekdayPerformanceCardProps {
  transactions: Transaction[];
  operationalCategories?: string[];
  hideValues: boolean;
  formatCurrency: (val: number) => string;
}

const WEEKDAYS_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Seg -> Dom
const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};

function parseLocalDateSafe(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const p = parseISO(dateStr);
  return isNaN(p.getTime()) ? new Date() : p;
}

export const WeekdayPerformanceCard: React.FC<WeekdayPerformanceCardProps> = ({
  transactions,
  operationalCategories,
  hideValues,
  formatCurrency,
}) => {
  const [rangeMode, setRangeMode] = useState<'90d' | '180d' | 'all'>('90d');

  const analysis = useMemo(() => {
    const opCats = operationalCategories || ['Combustível', 'Pedágio', 'Manutenção'];
    const now = new Date();
    const minDate =
      rangeMode === '90d'
        ? startOfDay(subDays(now, 90))
        : rangeMode === '180d'
          ? startOfDay(subDays(now, 180))
          : null;

    // Group active days by dateStr first so each worked calendar date counts as 1 day
    const dayMap: Record<
      string,
      { weekday: number; income: number; opExp: number; perExp: number; hasWork: boolean }
    > = {};

    (transactions || []).forEach(t => {
      if (t.payment_status === 'pending' || t.ignore_in_charts) return;
      if ((t as any).isInvestmentTx || (t as any).isDividendTx) return;
      if (
        t.category === 'Aporte Reserva' ||
        t.category === 'Resgate Reserva' ||
        t.category === 'Resgate de Reserva'
      ) {
        return;
      }

      const dStr = (t.date || '').split('T')[0];
      if (!dStr) return;
      const dObj = parseLocalDateSafe(dStr);
      if (dObj > now) return;
      if (minDate && dObj < minDate) return;

      if (!dayMap[dStr]) {
        dayMap[dStr] = {
          weekday: dObj.getDay(),
          income: 0,
          opExp: 0,
          perExp: 0,
          hasWork: false,
        };
      }

      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        const isReserveInternal =
          (t as any).isReserveTx &&
          ((t as any).reserveTxType === 'utilizacao' || (t as any).reserveTxType === 'aporte');
        if (!isReserveInternal) {
          dayMap[dStr].income += amt;
          if (amt > 0) dayMap[dStr].hasWork = true;
        }
      } else {
        const effectiveCat = (t as any).originalCategory || t.category;
        if (isOperationalCategory(effectiveCat, opCats)) {
          dayMap[dStr].opExp += amt;
        } else {
          dayMap[dStr].perExp += amt;
        }
      }
    });

    const buckets = WEEKDAYS_ORDER.map(wd => ({
      wd,
      label: WEEKDAY_LABELS[wd],
      daysWorked: 0,
      totalIncome: 0,
      totalOpExp: 0,
      avgIncome: 0,
      avgOpExp: 0,
      avgNetOp: 0,
    }));

    const bucketByWd: Record<number, (typeof buckets)[number]> = {};
    buckets.forEach(b => {
      bucketByWd[b.wd] = b;
    });

    Object.values(dayMap).forEach(day => {
      if (!day.hasWork && day.opExp <= 0) return;
      const b = bucketByWd[day.weekday];
      if (!b) return;
      b.daysWorked += 1;
      b.totalIncome += day.income;
      b.totalOpExp += day.opExp;
    });

    buckets.forEach(b => {
      if (b.daysWorked > 0) {
        b.avgIncome = b.totalIncome / b.daysWorked;
        b.avgOpExp = b.totalOpExp / b.daysWorked;
        b.avgNetOp = b.avgIncome - b.avgOpExp;
      }
    });

    const workedDays = buckets.filter(b => b.daysWorked > 0);
    const bestDay =
      workedDays.length > 0
        ? workedDays.reduce((best, cur) => (cur.avgNetOp > best.avgNetOp ? cur : best), workedDays[0])
        : null;
    const weakestWorkedDay =
      workedDays.length > 1
        ? workedDays.reduce((worst, cur) => (cur.avgNetOp < worst.avgNetOp ? cur : worst), workedDays[0])
        : null;

    const maxIncome = Math.max(1, ...buckets.map(b => b.avgIncome));

    return {
      buckets,
      bestDay,
      weakestWorkedDay,
      maxIncome,
      hasData: workedDays.length > 0,
    };
  }, [transactions, operationalCategories, rangeMode]);

  return (
    <Card className="border border-border/80 shadow-xs rounded-2xl bg-card/95">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                Lucro por Dia da Semana &amp; Melhor Dia para Folgar
              </CardTitle>
              <CardDescription className="text-[11px]">
                Média líquida operacional (faturamento − custos de pista) nos dias efetivamente trabalhados.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border border-border/60 self-start sm:self-auto">
            {(
              [
                { id: '90d', label: '90 dias' },
                { id: '180d', label: '6 meses' },
                { id: 'all', label: 'Tudo' },
              ] as { id: '90d' | '180d' | 'all'; label: string }[]
            ).map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRangeMode(r.id)}
                className={`px-2.5 py-1 text-[10.5px] font-black rounded-lg transition-all cursor-pointer ${
                  rangeMode === r.id
                    ? 'bg-background text-foreground shadow-2xs border border-border/50'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {!analysis.hasData ? (
          <div className="py-6 text-center text-xs text-muted-foreground font-semibold italic">
            Sem dias trabalhados registrados no período selecionado.
          </div>
        ) : (
          <>
            {(analysis.bestDay || analysis.weakestWorkedDay) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {analysis.bestDay && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Trophy className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                          Dia Mais Lucrativo
                        </span>
                        <span className="text-xs font-black text-foreground">
                          {analysis.bestDay.label} ({analysis.bestDay.daysWorked} dias medidos)
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-black font-mono text-emerald-500 shrink-0">
                      {hideValues ? 'R$ •••' : `${formatCurrency(analysis.bestDay.avgNetOp)}/dia`}
                    </span>
                  </div>
                )}

                {analysis.weakestWorkedDay && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Coffee className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                          Menor Impacto p/ Folga
                        </span>
                        <span className="text-xs font-black text-foreground">
                          {analysis.weakestWorkedDay.label} ({analysis.weakestWorkedDay.daysWorked} dias medidos)
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-black font-mono text-amber-500 shrink-0">
                      {hideValues ? 'R$ •••' : `${formatCurrency(analysis.weakestWorkedDay.avgNetOp)}/dia`}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {analysis.buckets.map(b => {
                const isBest = analysis.bestDay?.wd === b.wd;
                const isWeakest = analysis.weakestWorkedDay?.wd === b.wd;
                const fillPct = b.daysWorked > 0 ? Math.max(8, (b.avgIncome / analysis.maxIncome) * 100) : 0;

                return (
                  <div
                    key={b.wd}
                    className={`rounded-xl border p-2.5 flex flex-col justify-between space-y-2 transition-all ${
                      isBest
                        ? 'border-emerald-500/40 bg-emerald-500/[0.06]'
                        : isWeakest
                          ? 'border-amber-500/40 bg-amber-500/[0.05]'
                          : 'border-border/50 bg-muted/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-foreground">{b.label}</span>
                      <span className="text-[9.5px] font-bold text-muted-foreground">
                        {b.daysWorked}d
                      </span>
                    </div>

                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isBest ? 'bg-emerald-500' : isWeakest ? 'bg-amber-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-[9.5px]">
                        <span className="text-muted-foreground">Bruto:</span>
                        <span className="font-mono font-bold text-foreground">
                          {hideValues ? '•••' : formatCurrency(b.avgIncome)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[9.5px]">
                        <span className="text-muted-foreground">Custo Op:</span>
                        <span className="font-mono font-bold text-rose-500">
                          {hideValues ? '•••' : `-${formatCurrency(b.avgOpExp)}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/40">
                        <span className="font-extrabold text-muted-foreground flex items-center gap-0.5">
                          <TrendingUp className="w-2.5 h-2.5 text-emerald-500" /> Líq:
                        </span>
                        <span
                          className={`font-mono font-black ${
                            b.avgNetOp >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {hideValues ? '•••' : formatCurrency(b.avgNetOp)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
