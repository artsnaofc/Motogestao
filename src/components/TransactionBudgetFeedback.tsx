import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import {
  computeExpenseWindowTotals,
  getBudgetSeverityStyles,
  simulateExpenseBudgetImpact,
} from '../lib/budgetUtils';
import { ExpenseBudgetsMap, GLOBAL_EXPENSE_BUDGET_KEY } from '../lib/planningStorage';
import { ReserveTransaction, Transaction } from '../types';

interface TransactionBudgetFeedbackProps {
  category: string;
  amount: number;
  dateStr?: string;
  isPending?: boolean;
  budgets: ExpenseBudgetsMap;
  transactions: Transaction[];
  reserveTransactions?: ReserveTransaction[];
  formatCurrency: (val: number) => string;
  hideValues?: boolean;
  onOpenConfig: (focusCategory?: string | null) => void;
}

export function TransactionBudgetFeedback({
  category,
  amount,
  dateStr,
  isPending = false,
  budgets,
  transactions,
  reserveTransactions = [],
  formatCurrency,
  hideValues = false,
  onOpenConfig,
}: TransactionBudgetFeedbackProps) {
  const windowTotals = useMemo(
    () => computeExpenseWindowTotals(transactions, reserveTransactions, dateStr),
    [transactions, reserveTransactions, dateStr]
  );

  const impacts = useMemo(
    () =>
      simulateExpenseBudgetImpact({
        category,
        extraAmount: amount,
        dateStr,
        isPending,
        budgets,
        transactions,
        reserveTransactions,
      }),
    [category, amount, dateStr, isPending, budgets, transactions, reserveTransactions]
  );

  if (!category) return null;

  const catImpacts = impacts.filter(i => i.scope === 'category');
  const globalImpacts = impacts.filter(i => i.scope === 'global');

  const worstSeverity = impacts.some(i => i.projectedSeverity === 'exceeded')
    ? 'exceeded'
    : impacts.some(i => i.projectedSeverity === 'warning')
      ? 'warning'
      : 'ok';

  const containerStyles =
    impacts.length > 0
      ? getBudgetSeverityStyles(worstSeverity).surface
      : 'bg-muted/25 border-border/70';

  const mask = (v: number) => (hideValues ? 'R$ •••' : formatCurrency(v));
  const spentDay = windowTotals.daily[category] || 0;
  const spentWeek = windowTotals.weekly[category] || 0;
  const spentMonth = windowTotals.monthly[category] || 0;

  return (
    <div className={`rounded-xl border p-3 space-y-2.5 animate-fade-in ${containerStyles}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          {impacts.length > 0 ? (
            worstSeverity === 'exceeded' ? (
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
            ) : worstSeverity === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )
          ) : (
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="text-xs font-black text-foreground truncate">
            {catImpacts.length > 0
              ? `Tetos de ${category}`
              : `Resumo de gastos: ${category}`}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onOpenConfig(category)}
          className="inline-flex items-center gap-1 text-[10.5px] font-extrabold text-primary hover:underline cursor-pointer shrink-0"
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>{catImpacts.length > 0 ? 'Ajustar Tetos' : 'Definir Teto'}</span>
        </button>
      </div>

      {catImpacts.length === 0 && (
        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
          <div className="rounded-lg bg-card/80 border border-border/50 px-2 py-1.5">
            <span className="text-muted-foreground font-bold block">No dia</span>
            <span className="font-mono font-extrabold text-foreground">{mask(spentDay)}</span>
          </div>
          <div className="rounded-lg bg-card/80 border border-border/50 px-2 py-1.5">
            <span className="text-muted-foreground font-bold block">Na semana</span>
            <span className="font-mono font-extrabold text-foreground">{mask(spentWeek)}</span>
          </div>
          <div className="rounded-lg bg-card/80 border border-border/50 px-2 py-1.5">
            <span className="text-muted-foreground font-bold block">No mês</span>
            <span className="font-mono font-extrabold text-foreground">{mask(spentMonth)}</span>
          </div>
        </div>
      )}

      {(catImpacts.length > 0 || globalImpacts.length > 0) && (
        <div className="space-y-2">
          {[...catImpacts, ...globalImpacts].map(imp => {
            const styles = getBudgetSeverityStyles(imp.projectedSeverity);
            const currentPct = imp.limit > 0 ? Math.min(100, (imp.spent / imp.limit) * 100) : 0;
            const addedPct =
              imp.limit > 0 ? Math.max(0, Math.min(100 - currentPct, (imp.addedAmount / imp.limit) * 100)) : 0;
            const labelPrefix = imp.scope === 'global' ? `Geral (${imp.label})` : imp.label;

            return (
              <div key={`${imp.scope}_${imp.period}`} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[10.5px]">
                  <span className="font-bold text-foreground/90">
                    {labelPrefix}:{' '}
                    <span className="font-mono">
                      {mask(imp.addedAmount > 0 ? imp.projectedSpent : imp.spent)}
                    </span>{' '}
                    <span className="text-muted-foreground font-mono">/ {mask(imp.limit)}</span>
                  </span>
                  <span className={`font-extrabold font-mono ${styles.text}`}>
                    {imp.projectedPct.toFixed(0)}%{' '}
                    <span className="font-sans font-bold">
                      {imp.projectedRemaining < 0
                        ? `(Excede ${mask(Math.abs(imp.projectedRemaining))})`
                        : `(Resta ${mask(imp.projectedRemaining)})`}
                    </span>
                  </span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-muted/80 overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-300 ${
                      imp.severity === 'exceeded'
                        ? 'bg-rose-500'
                        : imp.severity === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${currentPct}%` }}
                  />
                  {imp.addedAmount > 0 && addedPct > 0 && (
                    <div
                      className={`h-full transition-all duration-300 opacity-75 ${styles.bar}`}
                      style={{ width: `${addedPct}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FreightExpensesBudgetSummaryProps {
  items: Array<{ id: string; category: string; amount: string }>;
  dateStr?: string;
  budgets: ExpenseBudgetsMap;
  transactions: Transaction[];
  reserveTransactions?: ReserveTransaction[];
  formatCurrency: (val: number) => string;
  hideValues?: boolean;
  onOpenConfig: (focusCategory?: string | null) => void;
}

export function FreightExpensesBudgetSummary({
  items,
  dateStr,
  budgets,
  transactions,
  reserveTransactions = [],
  formatCurrency,
  hideValues = false,
  onOpenConfig,
}: FreightExpensesBudgetSummaryProps) {
  const totals = useMemo(
    () => computeExpenseWindowTotals(transactions, reserveTransactions, dateStr),
    [transactions, reserveTransactions, dateStr]
  );

  const groupedAdded = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(item => {
      const amt = Number(item.amount) || 0;
      const cat = (item.category || 'Pedágio').trim();
      if (cat && amt > 0) {
        map[cat] = (map[cat] || 0) + amt;
      }
    });
    return map;
  }, [items]);

  const activeRows = useMemo(() => {
    const cats = Array.from(
      new Set(items.map(i => (i.category || 'Pedágio').trim()).filter(Boolean))
    );
    const list: Array<{
      category: string;
      mostCritical: ReturnType<typeof simulateExpenseBudgetImpact>[number];
    }> = [];

    cats.forEach(cat => {
      const extra = groupedAdded[cat] || 0;
      const impacts = simulateExpenseBudgetImpact({
        category: cat,
        extraAmount: extra,
        dateStr,
        budgets,
        transactions,
        reserveTransactions,
      }).filter(i => i.scope === 'category');
      if (impacts.length > 0) {
        const sorted = [...impacts].sort((a, b) => b.projectedPct - a.projectedPct);
        list.push({ category: cat, mostCritical: sorted[0] });
      }
    });

    const totalExtra = Object.values(groupedAdded).reduce((a, b) => a + b, 0);
    if (budgets[GLOBAL_EXPENSE_BUDGET_KEY]) {
      const globalImpacts = simulateExpenseBudgetImpact({
        category: '',
        extraAmount: totalExtra,
        dateStr,
        budgets,
        transactions,
        reserveTransactions,
      }).filter(i => i.scope === 'global');
      if (globalImpacts.length > 0) {
        const sorted = [...globalImpacts].sort((a, b) => b.projectedPct - a.projectedPct);
        list.push({ category: 'Teto Geral', mostCritical: sorted[0] });
      }
    }

    return list;
  }, [items, groupedAdded, dateStr, budgets, transactions, reserveTransactions, totals]);

  if (activeRows.length === 0) return null;

  const mask = (v: number) => (hideValues ? 'R$ •••' : formatCurrency(v));

  return (
    <div className="pt-1.5 border-t border-amber-500/15 space-y-1">
      {activeRows.map(({ category, mostCritical }) => {
        const styles = getBudgetSeverityStyles(mostCritical.projectedSeverity);
        return (
          <div
            key={`${category}_${mostCritical.period}`}
            className="flex items-center justify-between gap-2 text-[10px] font-bold"
          >
            <button
              type="button"
              onClick={() => onOpenConfig(category === 'Teto Geral' ? null : category)}
              className="text-muted-foreground hover:text-foreground truncate cursor-pointer text-left"
            >
              Teto {category} ({mostCritical.label}):{' '}
              <span className="font-mono text-foreground">
                {mask(mostCritical.addedAmount > 0 ? mostCritical.projectedSpent : mostCritical.spent)}
              </span>{' '}
              / <span className="font-mono">{mask(mostCritical.limit)}</span>
            </button>
            <span className={`font-mono font-extrabold shrink-0 ${styles.text}`}>
              {mostCritical.projectedPct.toFixed(0)}%{' '}
              {mostCritical.projectedRemaining < 0
                ? `(Excede ${mask(Math.abs(mostCritical.projectedRemaining))})`
                : `(Resta ${mask(mostCritical.projectedRemaining)})`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
