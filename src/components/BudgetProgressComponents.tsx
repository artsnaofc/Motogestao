import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import {
  BudgetPeriodStatus,
  ExpenseWindowTotals,
  getAllConfiguredBudgetStatuses,
  getBudgetSeverityStyles,
  getCategoryBudgetStatuses,
  getMostCriticalBudgetStatus,
} from '../lib/budgetUtils';
import { BudgetPeriod, ExpenseBudgetsMap } from '../lib/planningStorage';

interface CategoryBudgetBarsProps {
  statuses: BudgetPeriodStatus[];
  formatCurrency: (val: number) => string;
  hideValues?: boolean;
  compact?: boolean;
  showRemaining?: boolean;
}

export function CategoryBudgetBars({
  statuses,
  formatCurrency,
  hideValues = false,
  compact = false,
  showRemaining = true,
}: CategoryBudgetBarsProps) {
  if (!statuses || statuses.length === 0) return null;

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {statuses.map(st => {
        const styles = getBudgetSeverityStyles(st.severity);
        const mask = (v: number) => (hideValues ? 'R$ •••' : formatCurrency(v));
        const overAmt = Math.max(0, st.spent - st.limit);
        const remAmt = Math.max(0, st.remaining);

        return (
          <div key={`${st.category}_${st.period}`} className="space-y-0.5">
            <div className="flex items-center justify-between gap-2 text-[9.5px] font-bold">
              <span className="text-muted-foreground truncate">
                <strong className="text-foreground/85">{st.label}:</strong> {mask(st.spent)} / {mask(st.limit)}
                {st.pending > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {' '}
                    (+{mask(st.pending)} pend.)
                  </span>
                )}
              </span>
              <span className={`${styles.text} shrink-0 font-mono`}>
                {st.pct.toFixed(0)}%
                {showRemaining && (
                  <span className="font-sans font-semibold ml-1">
                    {st.severity === 'exceeded'
                      ? `(Excedido +${mask(overAmt)})`
                      : st.severity === 'warning'
                        ? `(Resta ${mask(remAmt)})`
                        : `(Resta ${mask(remAmt)})`}
                  </span>
                )}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted/80 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${styles.bar}`}
                style={{ width: `${Math.min(100, st.pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface CategoryBudgetBadgeProps {
  category: string;
  budgets: ExpenseBudgetsMap;
  totals: ExpenseWindowTotals;
  formatCurrency: (val: number) => string;
  hideValues?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function CategoryBudgetBadge({
  category,
  budgets,
  totals,
  formatCurrency,
  hideValues = false,
  onClick,
}: CategoryBudgetBadgeProps) {
  const statuses = getCategoryBudgetStatuses(category, budgets, totals);
  const critical = getMostCriticalBudgetStatus(statuses);
  if (!critical) return null;

  const styles = getBudgetSeverityStyles(critical.severity);
  const mask = (v: number) => (hideValues ? 'R$ •••' : formatCurrency(v));
  const titleText = statuses
    .map(
      s =>
        `${s.label}: ${mask(s.spent)} / ${mask(s.limit)} (${s.pct.toFixed(0)}%) — ${
          s.remaining >= 0 ? `Restam ${mask(s.remaining)}` : `Excedido em ${mask(Math.abs(s.remaining))}`
        }`
    )
    .join('\n');

  const label =
    critical.severity === 'exceeded'
      ? `Teto ${critical.shortLabel} Excedido`
      : `Teto ${critical.shortLabel} ${Math.round(critical.pct)}%`;

  return (
    <span
      title={titleText}
      onClick={onClick}
      className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border inline-flex items-center gap-1 ${styles.badge} ${
        onClick ? 'cursor-pointer hover:opacity-85' : ''
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />
      <span>{label}</span>
    </span>
  );
}

interface BudgetOverviewPanelProps {
  budgets: ExpenseBudgetsMap;
  totals: ExpenseWindowTotals;
  formatCurrency: (val: number) => string;
  hideValues?: boolean;
  onOpenConfig: (focusCategory?: string | null) => void;
  defaultExpanded?: boolean;
  title?: string;
}

export function BudgetOverviewPanel({
  budgets,
  totals,
  formatCurrency,
  hideValues = false,
  onOpenConfig,
  defaultExpanded = false,
  title = 'Monitor de Tetos de Despesas',
}: BudgetOverviewPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [periodFilter, setPeriodFilter] = useState<'all' | BudgetPeriod>('all');

  const summary = useMemo(
    () => getAllConfiguredBudgetStatuses(budgets, totals),
    [budgets, totals]
  );

  const hasAny =
    summary.globalStatuses.length > 0 || summary.categoryEntries.length > 0;

  const filteredGlobal = useMemo(
    () =>
      periodFilter === 'all'
        ? summary.globalStatuses
        : summary.globalStatuses.filter(s => s.period === periodFilter),
    [summary.globalStatuses, periodFilter]
  );

  const filteredCategories = useMemo(
    () =>
      summary.categoryEntries
        .map(entry => ({
          ...entry,
          statuses:
            periodFilter === 'all'
              ? entry.statuses
              : entry.statuses.filter(s => s.period === periodFilter),
        }))
        .filter(entry => entry.statuses.length > 0),
    [summary.categoryEntries, periodFilter]
  );

  if (!hasAny) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <SlidersHorizontal className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-bold text-muted-foreground">
            Configure tetos <strong className="text-foreground">diário, semanal ou mensal</strong> para acompanhar seus limites aqui e nos lançamentos.
          </span>
        </div>
        <button
          type="button"
          onClick={() => onOpenConfig(null)}
          className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-[11px] font-extrabold transition-colors shrink-0 cursor-pointer"
        >
          Configurar Tetos
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-colors ${
        summary.exceededCount > 0
          ? 'border-rose-500/35 bg-rose-500/[0.03]'
          : summary.alertCount > 0
            ? 'border-amber-500/35 bg-amber-500/[0.03]'
            : 'border-border/80 bg-card'
      }`}
    >
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
        >
          <div
            className={`p-1.5 rounded-lg shrink-0 ${
              summary.exceededCount > 0
                ? 'bg-rose-500/15 text-rose-500'
                : summary.alertCount > 0
                  ? 'bg-amber-500/15 text-amber-500'
                  : 'bg-emerald-500/15 text-emerald-500'
            }`}
          >
            {summary.exceededCount > 0 ? (
              <ShieldAlert className="w-4 h-4" />
            ) : summary.alertCount > 0 ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black text-foreground">{title}</span>
              {summary.exceededCount > 0 && (
                <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  {summary.exceededCount}{' '}
                  {summary.exceededCount === 1 ? 'excedido' : 'excedidos'}
                </span>
              )}
              {summary.alertCount > 0 && (
                <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  {summary.alertCount} em atenção
                </span>
              )}
              {summary.exceededCount === 0 && summary.alertCount === 0 && (
                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  Dentro do limite
                </span>
              )}
            </div>
            <p className="text-[10.5px] text-muted-foreground font-medium truncate">
              {summary.categoryEntries.length}{' '}
              {summary.categoryEntries.length === 1 ? 'categoria' : 'categorias'}
              {summary.globalStatuses.length > 0 ? ' + Teto Geral' : ''} monitoradas
            </p>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ml-auto ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => onOpenConfig(null)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted text-[10.5px] font-extrabold text-foreground transition-colors cursor-pointer shrink-0"
        >
          <SlidersHorizontal className="w-3 h-3 text-primary" />
          <span>Editar Tetos</span>
        </button>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 pt-2 border-t border-border/40 space-y-3 animate-fade-in">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {[
              { id: 'all', label: 'Todos Períodos' },
              { id: 'daily', label: 'Diário (Hoje)' },
              { id: 'weekly', label: 'Semanal' },
              { id: 'monthly', label: 'Mensal' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriodFilter(tab.id as typeof periodFilter)}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition-all shrink-0 cursor-pointer ${
                  periodFilter === tab.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/30 text-muted-foreground border-border/50 hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredGlobal.length > 0 && (
            <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-primary">
                  Teto Geral de Despesas
                </span>
                <button
                  type="button"
                  onClick={() => onOpenConfig(null)}
                  className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                >
                  Ajustar
                </button>
              </div>
              <CategoryBudgetBars
                statuses={filteredGlobal}
                formatCurrency={formatCurrency}
                hideValues={hideValues}
                compact
              />
            </div>
          )}

          {filteredCategories.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-2">
              Nenhum teto configurado para este período.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredCategories.map(entry => (
                <div
                  key={entry.category}
                  className="rounded-xl border border-border/60 bg-muted/15 p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-foreground truncate">
                      {entry.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenConfig(entry.category)}
                      className="text-[10px] font-bold text-primary hover:underline shrink-0 cursor-pointer"
                    >
                      Editar
                    </button>
                  </div>
                  <CategoryBudgetBars
                    statuses={entry.statuses}
                    formatCurrency={formatCurrency}
                    hideValues={hideValues}
                    compact
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
