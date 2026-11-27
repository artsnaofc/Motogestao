import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  SlidersHorizontal,
  Search,
  Sparkles,
  X,
  ShieldAlert,
  CalendarDays,
  CalendarRange,
  Calendar,
} from 'lucide-react';
import {
  CategoryBudgetRule,
  ExpenseBudgetsMap,
  GLOBAL_EXPENSE_BUDGET_KEY,
  planningStorage,
} from '../lib/planningStorage';
import { ExpenseWindowTotals, getBudgetSeverity, getBudgetSeverityStyles } from '../lib/budgetUtils';
import { toast } from '@/lib/toast';

interface DraftRule {
  daily: string;
  weekly: string;
  monthly: string;
}

interface BudgetLimitsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  categories: string[];
  operationalCategories?: string[];
  budgets: ExpenseBudgetsMap;
  totals: ExpenseWindowTotals;
  formatCurrency: (val: number) => string;
  hideValues?: boolean;
  focusCategory?: string | null;
  onSaved?: (next: ExpenseBudgetsMap) => void;
}

function formatNumToInput(val?: number): string {
  if (!val || val <= 0) return '';
  return Number(val.toFixed(2)).toString().replace('.', ',');
}

function parseInputToNum(raw: string): number | undefined {
  const cleaned = String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/R\$/gi, '');
  if (!cleaned) return undefined;
  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }
  const num = parseFloat(normalized);
  if (!isFinite(num) || num <= 0) return undefined;
  return Math.round(num * 100) / 100;
}

export function BudgetLimitsModal({
  open,
  onOpenChange,
  userId,
  categories,
  operationalCategories = [],
  budgets,
  totals,
  formatCurrency,
  hideValues = false,
  focusCategory = null,
  onSaved,
}: BudgetLimitsModalProps) {
  const [drafts, setDrafts] = useState<Record<string, DraftRule>>({});
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'op' | 'personal'>('all');

  const opSet = useMemo(
    () => new Set(operationalCategories.map(c => c.toLowerCase().trim())),
    [operationalCategories]
  );

  const mergedCategories = useMemo(() => {
    const set = new Set<string>([
      ...categories,
      ...Object.keys(budgets || {}).filter(k => k !== GLOBAL_EXPENSE_BUDGET_KEY),
    ]);
    if (focusCategory && focusCategory !== GLOBAL_EXPENSE_BUDGET_KEY) {
      set.add(focusCategory);
    }
    return Array.from(set)
      .filter(Boolean)
      .sort((a, b) => {
        if (focusCategory && a === focusCategory) return -1;
        if (focusCategory && b === focusCategory) return 1;
        return a.localeCompare(b, 'pt-BR');
      });
  }, [categories, budgets, focusCategory]);

  useEffect(() => {
    if (!open) return;
    const nextDrafts: Record<string, DraftRule> = {};
    const globalRule = budgets[GLOBAL_EXPENSE_BUDGET_KEY] || {};
    nextDrafts[GLOBAL_EXPENSE_BUDGET_KEY] = {
      daily: formatNumToInput(globalRule.daily),
      weekly: formatNumToInput(globalRule.weekly),
      monthly: formatNumToInput(globalRule.monthly),
    };
    mergedCategories.forEach(cat => {
      const rule = budgets[cat] || {};
      nextDrafts[cat] = {
        daily: formatNumToInput(rule.daily),
        weekly: formatNumToInput(rule.weekly),
        monthly: formatNumToInput(rule.monthly),
      };
    });
    setDrafts(nextDrafts);
    setSearch('');
    setFilterMode('all');
  }, [open, budgets, mergedCategories]);

  const updateDraftField = (key: string, field: keyof DraftRule, value: string) => {
    setDrafts(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { daily: '', weekly: '', monthly: '' }),
        [field]: value,
      },
    }));
  };

  const clearCategoryDraft = (key: string) => {
    setDrafts(prev => ({
      ...prev,
      [key]: { daily: '', weekly: '', monthly: '' },
    }));
  };

  const distributeMonthlyToPeriods = (key: string) => {
    const current = drafts[key] || { daily: '', weekly: '', monthly: '' };
    const monthly = parseInputToNum(current.monthly);
    if (!monthly || monthly <= 0) {
      toast.info('Informe primeiro um teto mensal para calcular os limites diário e semanal.');
      return;
    }
    const weekly = Math.round((monthly / 4.33) * 100) / 100;
    const daily = Math.round((monthly / 30) * 100) / 100;
    setDrafts(prev => ({
      ...prev,
      [key]: {
        daily: formatNumToInput(daily),
        weekly: formatNumToInput(weekly),
        monthly: current.monthly,
      },
    }));
  };

  const isOpCat = (cat: string) => {
    const norm = cat.toLowerCase().trim();
    return (
      opSet.has(norm) ||
      norm === 'combustível' ||
      norm === 'pedágio' ||
      norm === 'manutenção' ||
      norm === 'gastos operacionais'
    );
  };

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mergedCategories.filter(cat => {
      if (q && !cat.toLowerCase().includes(q)) return false;
      if (filterMode === 'op' && !isOpCat(cat)) return false;
      if (filterMode === 'personal' && isOpCat(cat)) return false;
      if (filterMode === 'active') {
        const d = drafts[cat];
        if (!d) return false;
        const hasAny = Boolean(parseInputToNum(d.daily) || parseInputToNum(d.weekly) || parseInputToNum(d.monthly));
        if (!hasAny) return false;
      }
      return true;
    });
  }, [mergedCategories, search, filterMode, drafts]);

  const activeLimitsCount = useMemo(() => {
    let count = 0;
    Object.values(drafts).forEach(d => {
      if (parseInputToNum(d.daily)) count++;
      if (parseInputToNum(d.weekly)) count++;
      if (parseInputToNum(d.monthly)) count++;
    });
    return count;
  }, [drafts]);

  const handleSave = () => {
    const next: ExpenseBudgetsMap = {};
    Object.entries(drafts).forEach(([cat, d]) => {
      const rule: CategoryBudgetRule = {};
      const daily = parseInputToNum(d.daily);
      const weekly = parseInputToNum(d.weekly);
      const monthly = parseInputToNum(d.monthly);
      if (daily) rule.daily = daily;
      if (weekly) rule.weekly = weekly;
      if (monthly) rule.monthly = monthly;
      if (rule.daily || rule.weekly || rule.monthly) {
        next[cat] = rule;
      }
    });

    planningStorage.saveExpenseBudgets(userId || 'default', next);
    onSaved?.(next);
    onOpenChange(false);
    toast.success('Tetos de despesas (diário, semanal e mensal) salvos!');
  };

  const renderGlobalRow = () => {
    const d = drafts[GLOBAL_EXPENSE_BUDGET_KEY] || { daily: '', weekly: '', monthly: '' };
    const dailyLim = parseInputToNum(d.daily);
    const weeklyLim = parseInputToNum(d.weekly);
    const monthlyLim = parseInputToNum(d.monthly);
    const hasAny = Boolean(dailyLim || weeklyLim || monthlyLim);

    const worstPct = Math.max(
      dailyLim ? (totals.totalDaily / dailyLim) * 100 : 0,
      weeklyLim ? (totals.totalWeekly / weeklyLim) * 100 : 0,
      monthlyLim ? (totals.totalMonthly / monthlyLim) * 100 : 0
    );
    const styles = getBudgetSeverityStyles(getBudgetSeverity(worstPct));

    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-black text-foreground">
                Teto Geral de Despesas (Todas as Categorias)
              </span>
              {hasAny && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${styles.badge}`}>
                  Ativo
                </span>
              )}
            </div>
            <p className="text-[10.5px] text-muted-foreground font-mono">
              Total gasto: Hoje {hideValues ? '•••' : formatCurrency(totals.totalDaily)} • Sem{' '}
              {hideValues ? '•••' : formatCurrency(totals.totalWeekly)} • Mês{' '}
              {hideValues ? '•••' : formatCurrency(totals.totalMonthly)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {parseInputToNum(d.monthly) && (
              <button
                type="button"
                onClick={() => distributeMonthlyToPeriods(GLOBAL_EXPENSE_BUDGET_KEY)}
                className="text-[10px] font-bold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                title="Calcular diário e semanal a partir do mensal"
              >
                <Sparkles className="w-3 h-3" />
                <span>Sugerir Dia/Sem</span>
              </button>
            )}
            {hasAny && (
              <button
                type="button"
                onClick={() => clearCategoryDraft(GLOBAL_EXPENSE_BUDGET_KEY)}
                className="text-[10px] font-bold text-muted-foreground hover:text-rose-500 inline-flex items-center gap-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {([
            { key: 'daily', label: 'Diário', icon: CalendarDays },
            { key: 'weekly', label: 'Semanal', icon: CalendarRange },
            { key: 'monthly', label: 'Mensal', icon: Calendar },
          ] as const).map(({ key, label, icon: PeriodIcon }) => (
            <div key={key} className="space-y-1">
              <label className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <PeriodIcon className="w-3 h-3 text-primary/80" />
                <span>{label}</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-bold text-muted-foreground pointer-events-none">
                  R$
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Sem teto"
                  value={d[key]}
                  onChange={(e) => updateDraftField(GLOBAL_EXPENSE_BUDGET_KEY, key, e.target.value)}
                  className="h-8 pl-7 pr-2 text-xs font-mono text-right bg-card border-border/80 rounded-lg"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] p-0 bg-card border-border/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <DialogHeader className="p-5 pb-3 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-primary shrink-0" />
              <span>Tetos de Despesas (Diário, Semanal e Mensal)</span>
            </DialogTitle>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0">
              {activeLimitsCount} {activeLimitsCount === 1 ? 'limite' : 'limites'}
            </span>
          </div>
          <DialogDescription className="text-xs font-medium text-muted-foreground">
            Defina tetos opcionais por dia, semana (seg–dom) ou mês para cada categoria e para o total geral. Deixe em branco para não limitar.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pt-3 pb-2 border-b border-border/40 space-y-2.5 shrink-0 bg-muted/10">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                placeholder="Filtrar categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 pr-8 text-xs rounded-xl bg-card"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'active', label: 'Com Teto' },
                { id: 'op', label: 'Operacionais' },
                { id: 'personal', label: 'Pessoais' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id as typeof filterMode)}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition-all shrink-0 cursor-pointer ${
                    filterMode === tab.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border/60 hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
          {!search.trim() && filterMode !== 'op' && filterMode !== 'personal' && renderGlobalRow()}

          {filteredCategories.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground italic">
              Nenhuma categoria encontrada para o filtro selecionado.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredCategories.map(cat => {
                const d = drafts[cat] || { daily: '', weekly: '', monthly: '' };
                const spentDay = totals.daily[cat] || 0;
                const spentWeek = totals.weekly[cat] || 0;
                const spentMonth = totals.monthly[cat] || 0;
                const dailyLim = parseInputToNum(d.daily);
                const weeklyLim = parseInputToNum(d.weekly);
                const monthlyLim = parseInputToNum(d.monthly);
                const hasAny = Boolean(dailyLim || weeklyLim || monthlyLim);
                const isOp = isOpCat(cat);
                const isFocused = Boolean(focusCategory && cat === focusCategory);

                return (
                  <div
                    key={cat}
                    className={`rounded-xl border p-3 space-y-2 transition-colors ${
                      isFocused
                        ? 'border-primary bg-primary/[0.05] ring-1 ring-primary/30'
                        : hasAny
                          ? 'border-border/80 bg-muted/25'
                          : 'border-border/50 bg-muted/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-extrabold text-foreground truncate">{cat}</span>
                          <span
                            className={`text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded-sm border ${
                              isOp
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {isOp ? 'Op' : 'Pessoal'}
                          </span>
                          {isFocused && (
                            <span className="text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded-sm bg-primary text-primary-foreground">
                              Selecionada
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Hoje: {hideValues ? '•••' : formatCurrency(spentDay)} • Sem:{' '}
                          {hideValues ? '•••' : formatCurrency(spentWeek)} • Mês:{' '}
                          {hideValues ? '•••' : formatCurrency(spentMonth)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {monthlyLim && (
                          <button
                            type="button"
                            onClick={() => distributeMonthlyToPeriods(cat)}
                            className="text-[10px] font-bold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                            title="Sugerir teto diário e semanal proporcional ao teto mensal"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Sugerir Dia/Sem</span>
                          </button>
                        )}
                        {hasAny && (
                          <button
                            type="button"
                            onClick={() => clearCategoryDraft(cat)}
                            className="text-[10px] font-bold text-muted-foreground hover:text-rose-500 inline-flex items-center gap-0.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                            <span>Limpar</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { key: 'daily', label: 'Diário' },
                        { key: 'weekly', label: 'Semanal' },
                        { key: 'monthly', label: 'Mensal' },
                      ] as const).map(({ key, label }) => (
                        <div key={key} className="space-y-1">
                          <label className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground block">
                            {label}
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-bold text-muted-foreground pointer-events-none">
                              R$
                            </span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="Sem teto"
                              value={d[key]}
                              onChange={(e) => updateDraftField(cat, key, e.target.value)}
                              className="h-8 pl-7 pr-2 text-xs font-mono text-right bg-card border-border/70 rounded-lg"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border/40 flex items-center justify-between gap-2 shrink-0 bg-muted/10">
          <span className="text-[10.5px] text-muted-foreground font-medium hidden sm:inline">
            Alertas automáticos ativam em 80% e 100% do limite.
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSave} className="font-bold">
              Salvar Tetos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
