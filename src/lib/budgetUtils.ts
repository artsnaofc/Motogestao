import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Transaction, ReserveTransaction } from '../types';
import {
  BudgetPeriod,
  CategoryBudgetRule,
  ExpenseBudgetsMap,
  GLOBAL_EXPENSE_BUDGET_KEY,
} from './planningStorage';
import { parseLocalDate } from './recurrenceUtils';
import { getTodayLocalDateStr } from './utils';

export type BudgetSeverity = 'ok' | 'warning' | 'exceeded';

export interface BudgetPeriodStatus {
  category: string;
  period: BudgetPeriod;
  label: string;
  shortLabel: string;
  limit: number;
  spent: number;
  pending: number;
  remaining: number;
  pct: number;
  severity: BudgetSeverity;
}

export interface ExpenseWindowTotals {
  daily: Record<string, number>;
  weekly: Record<string, number>;
  monthly: Record<string, number>;
  dailyPending: Record<string, number>;
  weeklyPending: Record<string, number>;
  monthlyPending: Record<string, number>;
  totalDaily: number;
  totalWeekly: number;
  totalMonthly: number;
  totalDailyPending: number;
  totalWeeklyPending: number;
  totalMonthlyPending: number;
}

export interface SimulatedBudgetPeriodImpact extends BudgetPeriodStatus {
  addedAmount: number;
  projectedSpent: number;
  projectedRemaining: number;
  projectedPct: number;
  projectedSeverity: BudgetSeverity;
  scope: 'category' | 'global';
}

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, { label: string; shortLabel: string; rangeText: string }> = {
  daily: { label: 'Diário', shortLabel: 'Dia', rangeText: 'Hoje' },
  weekly: { label: 'Semanal', shortLabel: 'Sem', rangeText: 'Semana' },
  monthly: { label: 'Mensal', shortLabel: 'Mês', rangeText: 'Mês' },
};

function isIgnoredNonExpenseCategory(cat?: string | null): boolean {
  const norm = (cat || '').toLowerCase().trim();
  return (
    norm === 'aporte reserva' ||
    norm === 'resgate reserva' ||
    norm === 'resgate de reserva' ||
    norm === 'compra de investimentos' ||
    norm === 'investimentos' ||
    norm === 'transferência p/ caixa'
  );
}

function isAssetPurchaseReserveTx(rt: any): boolean {
  return Boolean(
    rt?.linked_investment_id ||
      rt?.originalCategory === 'Investimentos' ||
      String(rt?.category || '').toLowerCase() === 'investimentos' ||
      String(rt?.description || '').includes('Investimento:')
  );
}

export function getPeriodWindowBounds(referenceDateStr?: string) {
  const dayStr = (referenceDateStr || getTodayLocalDateStr()).split('T')[0];
  const refDate = parseLocalDate(dayStr);
  const weekStartStr = format(startOfWeek(refDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEndStr = format(endOfWeek(refDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const monthKey = dayStr.slice(0, 7);
  return { dayStr, weekStartStr, weekEndStr, monthKey };
}

export function computeExpenseWindowTotals(
  transactions: Transaction[] = [],
  reserveTransactions: ReserveTransaction[] = [],
  referenceDateStr?: string
): ExpenseWindowTotals {
  const { dayStr, weekStartStr, weekEndStr, monthKey } = getPeriodWindowBounds(referenceDateStr);

  const daily: Record<string, number> = {};
  const weekly: Record<string, number> = {};
  const monthly: Record<string, number> = {};
  const dailyPending: Record<string, number> = {};
  const weeklyPending: Record<string, number> = {};
  const monthlyPending: Record<string, number> = {};

  let totalDaily = 0;
  let totalWeekly = 0;
  let totalMonthly = 0;
  let totalDailyPending = 0;
  let totalWeeklyPending = 0;
  let totalMonthlyPending = 0;

  const accumulate = (cat: string, dateVal: string, amount: number, isPending: boolean) => {
    if (!dateVal || !isFinite(amount) || amount <= 0) return;
    const isDay = dateVal === dayStr;
    const isWeek = dateVal >= weekStartStr && dateVal <= weekEndStr;
    const isMonth = dateVal.startsWith(monthKey);

    if (isPending) {
      if (isDay) {
        dailyPending[cat] = (dailyPending[cat] || 0) + amount;
        totalDailyPending += amount;
      }
      if (isWeek) {
        weeklyPending[cat] = (weeklyPending[cat] || 0) + amount;
        totalWeeklyPending += amount;
      }
      if (isMonth) {
        monthlyPending[cat] = (monthlyPending[cat] || 0) + amount;
        totalMonthlyPending += amount;
      }
    } else {
      if (isDay) {
        daily[cat] = (daily[cat] || 0) + amount;
        totalDaily += amount;
      }
      if (isWeek) {
        weekly[cat] = (weekly[cat] || 0) + amount;
        totalWeekly += amount;
      }
      if (isMonth) {
        monthly[cat] = (monthly[cat] || 0) + amount;
        totalMonthly += amount;
      }
    }
  };

  (transactions || []).forEach(t => {
    if (t.type !== 'expense') return;
    if ((t as any).is_investment_tx || (t as any).isInvestmentTx) return;
    if (isIgnoredNonExpenseCategory(t.category)) return;
    const isPending = t.payment_status === 'pending';
    const effectiveDate = isPending
      ? (t.due_date || t.date || '').split('T')[0]
      : (t.payment_date || t.date || '').split('T')[0];
    const cat = t.category || 'Outros';
    accumulate(cat, effectiveDate, Number(t.amount) || 0, isPending);
  });

  (reserveTransactions || []).forEach(rt => {
    if (rt.type !== 'utilizacao') return;
    if (isAssetPurchaseReserveTx(rt)) return;
    const catNorm = (rt.category || '').toLowerCase().trim();
    if (!catNorm || isIgnoredNonExpenseCategory(rt.category) || catNorm === 'outros') {
      return;
    }
    const isPending = rt.payment_status === 'pending';
    const effectiveDate = isPending
      ? (rt.due_date || rt.date || '').split('T')[0]
      : (rt.payment_date || rt.date || '').split('T')[0];
    accumulate(rt.category || 'Outros', effectiveDate, Number(rt.amount) || 0, isPending);
  });

  return {
    daily,
    weekly,
    monthly,
    dailyPending,
    weeklyPending,
    monthlyPending,
    totalDaily,
    totalWeekly,
    totalMonthly,
    totalDailyPending,
    totalWeeklyPending,
    totalMonthlyPending,
  };
}

export function getBudgetSeverity(pct: number): BudgetSeverity {
  if (pct >= 100) return 'exceeded';
  if (pct >= 80) return 'warning';
  return 'ok';
}

export function buildPeriodStatus(
  category: string,
  period: BudgetPeriod,
  limit: number,
  spent: number,
  pending = 0
): BudgetPeriodStatus {
  const safeLimit = Math.max(0, limit);
  const safeSpent = Math.max(0, spent);
  const pct = safeLimit > 0 ? (safeSpent / safeLimit) * 100 : 0;
  const remaining = safeLimit - safeSpent;
  return {
    category,
    period,
    label: BUDGET_PERIOD_LABELS[period].label,
    shortLabel: BUDGET_PERIOD_LABELS[period].shortLabel,
    limit: safeLimit,
    spent: safeSpent,
    pending: Math.max(0, pending),
    remaining,
    pct,
    severity: getBudgetSeverity(pct),
  };
}

export function getCategoryBudgetStatuses(
  category: string,
  budgets: ExpenseBudgetsMap,
  totals: ExpenseWindowTotals
): BudgetPeriodStatus[] {
  const rule: CategoryBudgetRule | undefined = budgets[category];
  if (!rule) return [];

  const isGlobal = category === GLOBAL_EXPENSE_BUDGET_KEY;
  const periods: BudgetPeriod[] = ['daily', 'weekly', 'monthly'];
  const list: BudgetPeriodStatus[] = [];

  periods.forEach(period => {
    const limit = rule[period];
    if (!limit || limit <= 0) return;

    const spent = isGlobal
      ? period === 'daily'
        ? totals.totalDaily
        : period === 'weekly'
          ? totals.totalWeekly
          : totals.totalMonthly
      : period === 'daily'
        ? totals.daily[category] || 0
        : period === 'weekly'
          ? totals.weekly[category] || 0
          : totals.monthly[category] || 0;

    const pending = isGlobal
      ? period === 'daily'
        ? totals.totalDailyPending
        : period === 'weekly'
          ? totals.totalWeeklyPending
          : totals.totalMonthlyPending
      : period === 'daily'
        ? totals.dailyPending[category] || 0
        : period === 'weekly'
          ? totals.weeklyPending[category] || 0
          : totals.monthlyPending[category] || 0;

    list.push(buildPeriodStatus(category, period, limit, spent, pending));
  });

  return list;
}

export function getMostCriticalBudgetStatus(statuses: BudgetPeriodStatus[]): BudgetPeriodStatus | null {
  if (!statuses || statuses.length === 0) return null;
  return [...statuses].sort((a, b) => b.pct - a.pct)[0];
}

export function getAllConfiguredBudgetStatuses(
  budgets: ExpenseBudgetsMap,
  totals: ExpenseWindowTotals
): {
  globalStatuses: BudgetPeriodStatus[];
  categoryEntries: Array<{
    category: string;
    statuses: BudgetPeriodStatus[];
    mostCritical: BudgetPeriodStatus;
  }>;
  alertCount: number;
  exceededCount: number;
} {
  const globalStatuses = getCategoryBudgetStatuses(GLOBAL_EXPENSE_BUDGET_KEY, budgets, totals);
  const categoryEntries: Array<{
    category: string;
    statuses: BudgetPeriodStatus[];
    mostCritical: BudgetPeriodStatus;
  }> = [];

  Object.keys(budgets || {}).forEach(cat => {
    if (cat === GLOBAL_EXPENSE_BUDGET_KEY) return;
    const statuses = getCategoryBudgetStatuses(cat, budgets, totals);
    const mostCritical = getMostCriticalBudgetStatus(statuses);
    if (statuses.length > 0 && mostCritical) {
      categoryEntries.push({ category: cat, statuses, mostCritical });
    }
  });

  categoryEntries.sort((a, b) => b.mostCritical.pct - a.mostCritical.pct);

  const allStatuses = [...globalStatuses, ...categoryEntries.flatMap(e => e.statuses)];
  const alertCount = allStatuses.filter(s => s.severity === 'warning').length;
  const exceededCount = allStatuses.filter(s => s.severity === 'exceeded').length;

  return { globalStatuses, categoryEntries, alertCount, exceededCount };
}

export function simulateExpenseBudgetImpact(params: {
  category: string;
  extraAmount: number;
  dateStr?: string;
  isPending?: boolean;
  budgets: ExpenseBudgetsMap;
  transactions: Transaction[];
  reserveTransactions?: ReserveTransaction[];
}): SimulatedBudgetPeriodImpact[] {
  const {
    category,
    extraAmount,
    dateStr,
    isPending = false,
    budgets,
    transactions,
    reserveTransactions = [],
  } = params;

  const refTotals = computeExpenseWindowTotals(transactions, reserveTransactions, dateStr);
  const results: SimulatedBudgetPeriodImpact[] = [];
  const safeExtra = isFinite(extraAmount) && extraAmount > 0 ? extraAmount : 0;

  const pushStatuses = (targetKey: string, scope: 'category' | 'global') => {
    const statuses = getCategoryBudgetStatuses(targetKey, budgets, refTotals);
    statuses.forEach(st => {
      const effectiveBefore = isPending ? st.spent + st.pending : st.spent;
      const projectedSpent = effectiveBefore + safeExtra;
      const projectedRemaining = st.limit - projectedSpent;
      const projectedPct = st.limit > 0 ? (projectedSpent / st.limit) * 100 : 0;
      results.push({
        ...st,
        addedAmount: safeExtra,
        projectedSpent,
        projectedRemaining,
        projectedPct,
        projectedSeverity: getBudgetSeverity(projectedPct),
        scope,
      });
    });
  };

  if (category) {
    pushStatuses(category, 'category');
  }
  pushStatuses(GLOBAL_EXPENSE_BUDGET_KEY, 'global');

  return results;
}

export function getBudgetSeverityStyles(severity: BudgetSeverity) {
  if (severity === 'exceeded') {
    return {
      bar: 'bg-rose-500',
      text: 'text-rose-600 dark:text-rose-400',
      badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
      surface: 'bg-rose-500/[0.06] border-rose-500/30',
      dot: 'bg-rose-500',
    };
  }
  if (severity === 'warning') {
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      surface: 'bg-amber-500/[0.06] border-amber-500/30',
      dot: 'bg-amber-500',
    };
  }
  return {
    bar: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    surface: 'bg-emerald-500/[0.05] border-emerald-500/25',
    dot: 'bg-emerald-500',
  };
}
