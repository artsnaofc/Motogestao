import { useState, useEffect, useMemo } from 'react';
import {
  X,
  CalendarDays,
  Sparkles,
  Target,
  CheckCircle2,
  Zap,
  Sliders,
  Ban,
  PiggyBank,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Reserve, ReserveTransaction, Transaction } from '../../types';
import {
  iconOptions,
  formatCurrency,
  calculateReserveWeeklyProgress,
} from './reserveUtils';
import { toast } from '@/lib/toast';

interface WeeklyGoalDraft {
  mode: 'dynamic' | 'rule_week' | 'fixed' | 'off';
  amountStr: string;
  includeManual: boolean;
}

interface WeeklyGoalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reserves: Reserve[];
  transactions: Transaction[];
  reserveTransactions: ReserveTransaction[];
  onSaveBatch: (
    updates: Array<{
      reserveId: string;
      weekly_goal_mode: 'dynamic' | 'rule_week' | 'fixed' | 'off';
      weekly_goal_amount: number | null;
      weekly_goal_include_manual: boolean;
    }>
  ) => Promise<void>;
  hideValues?: boolean;
}

export function WeeklyGoalsModal({
  isOpen,
  onClose,
  reserves,
  transactions,
  reserveTransactions,
  onSaveBatch,
  hideValues,
}: WeeklyGoalsModalProps) {
  const activeReserves = useMemo(
    () => (reserves || []).filter(r => r.status !== 'inactive'),
    [reserves]
  );

  const [drafts, setDrafts] = useState<Record<string, WeeklyGoalDraft>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const init: Record<string, WeeklyGoalDraft> = {};
    activeReserves.forEach(r => {
      init[r.id] = {
        mode: (r.weekly_goal_mode || 'dynamic') as WeeklyGoalDraft['mode'],
        amountStr:
          r.weekly_goal_amount !== undefined && r.weekly_goal_amount !== null && Number(r.weekly_goal_amount) > 0
            ? String(Number(r.weekly_goal_amount))
            : '',
        includeManual: r.weekly_goal_include_manual !== false,
      };
    });
    setDrafts(init);
  }, [isOpen, activeReserves]);

  const previewSummary = useMemo(() => {
    let totalTarget = 0;
    let totalCounted = 0;
    let weekRange = '';

    activeReserves.forEach(r => {
      const d = drafts[r.id];
      const parsedAmount = d?.amountStr
        ? Math.max(0, parseFloat(d.amountStr.replace(',', '.')) || 0)
        : 0;
      const simulated: Reserve = d
        ? {
            ...r,
            weekly_goal_mode: d.mode,
            weekly_goal_amount: d.mode === 'fixed' ? parsedAmount : r.weekly_goal_amount,
            weekly_goal_include_manual: d.includeManual,
          }
        : r;

      const prog = calculateReserveWeeklyProgress(simulated, transactions, reserveTransactions);
      if (!weekRange) weekRange = prog.weekRangeLabel;
      if (!r.is_paused && prog.weeklyTarget > 0) {
        totalTarget += prog.weeklyTarget;
        totalCounted += prog.weeklyCountedAportes;
      } else if (!r.is_paused && prog.weeklyTotalAportes > 0 && (d?.mode || 'dynamic') !== 'off') {
        totalCounted += d?.includeManual !== false ? prog.weeklyTotalAportes : prog.weeklyRuleAportes;
      }
    });

    totalTarget = Math.round(totalTarget * 100) / 100;
    totalCounted = Math.round(totalCounted * 100) / 100;
    const pct = totalTarget > 0 ? Math.min(100, Math.round((totalCounted / totalTarget) * 100)) : 0;

    return { totalTarget, totalCounted, pct, weekRange };
  }, [activeReserves, drafts, transactions, reserveTransactions]);

  if (!isOpen) return null;

  const updateDraft = (reserveId: string, patch: Partial<WeeklyGoalDraft>) => {
    setDrafts(prev => ({
      ...prev,
      [reserveId]: {
        ...(prev[reserveId] || { mode: 'dynamic', amountStr: '', includeManual: true }),
        ...patch,
      },
    }));
  };

  const handleSave = async () => {
    for (const r of activeReserves) {
      const d = drafts[r.id];
      if (!d) continue;
      if (d.mode === 'fixed') {
        const val = parseFloat((d.amountStr || '').replace(',', '.'));
        if (isNaN(val) || val <= 0) {
          toast.error(`Informe um valor semanal maior que zero para "${r.name}".`);
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);
      const updates = activeReserves.map(r => {
        const d = drafts[r.id] || { mode: 'dynamic', amountStr: '', includeManual: true };
        const parsedVal = d.amountStr ? Math.round((parseFloat(d.amountStr.replace(',', '.')) || 0) * 100) / 100 : 0;
        return {
          reserveId: r.id,
          weekly_goal_mode: d.mode,
          weekly_goal_amount: d.mode === 'fixed' ? parsedVal : parsedVal > 0 ? parsedVal : null,
          weekly_goal_include_manual: d.includeManual,
        };
      });
      await onSaveBatch(updates);
      toast.success('Metas semanais das reservas atualizadas!');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar metas semanais.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-2xl rounded-3xl border border-border/80 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] animate-in fade-in zoom-in-95 duration-200 text-left"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-500/15 via-violet-500/10 to-transparent border-b border-border/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-foreground truncate">
                Metas Semanais de Aporte
              </h3>
              <p className="text-[11px] text-muted-foreground font-medium truncate">
                Semana atual ({previewSummary.weekRange || 'Seg – Dom'}) · Configure ou deixe dinâmico
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-8 h-8 p-0 rounded-full cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Live Consolidated Weekly Summary */}
        <div className="px-4 sm:px-5 py-3 bg-muted/30 border-b border-border/60 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs font-bold text-muted-foreground">
              Progresso Consolidado da Semana
            </div>
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                {hideValues ? 'R$ •••' : formatCurrency(previewSummary.totalCounted)}
              </span>
              {previewSummary.totalTarget > 0 && (
                <>
                  <span className="text-xs text-muted-foreground">
                    / {hideValues ? 'R$ •••' : formatCurrency(previewSummary.totalTarget)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-[10px] font-black">
                    {previewSummary.pct}%
                  </span>
                </>
              )}
            </div>
          </div>
          {previewSummary.totalTarget > 0 && (
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  previewSummary.pct >= 100
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                }`}
                style={{ width: `${previewSummary.pct}%` }}
              />
            </div>
          )}
        </div>

        {/* Reserves List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3">
          {activeReserves.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhuma reserva ativa encontrada.
            </p>
          ) : (
            activeReserves.map(res => {
              const IconComp = iconOptions[res.icon] || PiggyBank;
              const d = drafts[res.id] || { mode: 'dynamic', amountStr: '', includeManual: true };
              const parsedAmount = d.amountStr
                ? Math.max(0, parseFloat(d.amountStr.replace(',', '.')) || 0)
                : 0;
              const simulated: Reserve = {
                ...res,
                weekly_goal_mode: d.mode,
                weekly_goal_amount: d.mode === 'fixed' ? parsedAmount : res.weekly_goal_amount,
                weekly_goal_include_manual: d.includeManual,
              };
              const prog = calculateReserveWeeklyProgress(simulated, transactions, reserveTransactions);

              return (
                <div
                  key={res.id}
                  className="p-3.5 rounded-2xl border border-border/80 bg-card/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: res.color || '#6366f1' }}
                      >
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-foreground truncate">
                            {res.name}
                          </span>
                          {res.is_paused && (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              Pausada
                            </span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-muted-foreground font-mono">
                          Aportado na semana:{' '}
                          <strong className="text-foreground">
                            {hideValues ? 'R$ •••' : formatCurrency(prog.weeklyTotalAportes)}
                          </strong>
                          {prog.weeklyManualAportes > 0 && prog.weeklyRuleAportes > 0 && !hideValues && (
                            <span>
                              {' '}
                              (Regra: {formatCurrency(prog.weeklyRuleAportes)} · Manual:{' '}
                              {formatCurrency(prog.weeklyManualAportes)})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {prog.hasTarget && (
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold text-muted-foreground block">
                          {prog.sourceLabel}
                        </span>
                        <span
                          className={`text-xs font-black font-mono ${
                            prog.isWeeklyGoalReached
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          {hideValues ? 'R$ •••' : formatCurrency(prog.weeklyTarget)}/sem
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Mode Selector Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      {
                        id: 'dynamic' as const,
                        label: 'Dinâmica',
                        icon: Zap,
                        desc: 'Prazo / Ritmo / Regra',
                      },
                      {
                        id: 'rule_week' as const,
                        label: 'Sugestão Sem.',
                        icon: Sparkles,
                        desc: '100% do sugerido na semana',
                      },
                      {
                        id: 'fixed' as const,
                        label: 'Valor Fixo',
                        icon: Target,
                        desc: 'Valor R$ configurável',
                      },
                      {
                        id: 'off' as const,
                        label: 'Desativada',
                        icon: Ban,
                        desc: 'Sem meta semanal',
                      },
                    ].map(opt => {
                      const OptIcon = opt.icon;
                      const active = d.mode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            const fallbackVal =
                              opt.id === 'fixed' && !d.amountStr
                                ? String(
                                    Math.round(
                                      (prog.weeklyRulePace || prog.weeklyRuleSuggested || prog.weeklyDeadlineRequired || 100) *
                                        100
                                    ) / 100
                                  )
                                : d.amountStr;
                            updateDraft(res.id, { mode: opt.id, amountStr: fallbackVal });
                          }}
                          title={opt.desc}
                          className={`px-2 py-1.5 rounded-xl border text-[10.5px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            active
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-muted/30 text-muted-foreground border-border/70 hover:text-foreground hover:bg-muted/60'
                          }`}
                        >
                          <OptIcon className="w-3 h-3 shrink-0" />
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Fixed Amount & Include Manual */}
                  {d.mode !== 'off' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                      {d.mode === 'fixed' ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-muted-foreground">
                            Meta R$/semana:
                          </span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="150.00"
                            value={d.amountStr}
                            onChange={e =>
                              updateDraft(res.id, {
                                amountStr: e.target.value.replace(/[^0-9.,]/g, ''),
                              })
                            }
                            className="w-28 h-8 text-xs font-mono font-bold rounded-xl"
                          />
                        </div>
                      ) : (
                        <span className="text-[10.5px] text-muted-foreground">
                          {d.mode === 'rule_week'
                            ? `Usa o valor sugerido pela regra na semana (${hideValues ? '••' : formatCurrency(prog.weeklyRuleSuggested)})`
                            : prog.weeklyDeadlineRequired
                              ? `Calculado pelo prazo fixo (${hideValues ? '••' : formatCurrency(prog.weeklyDeadlineRequired)}/sem)`
                              : res.regra_ativa
                                ? `Calculado pelo ritmo/regra semanal (${hideValues ? '••' : formatCurrency(prog.weeklyTarget)}/sem)`
                                : 'Ative uma regra ou defina um valor fixo'}
                        </span>
                      )}

                      <label className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-muted-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={d.includeManual}
                          onChange={e =>
                            updateDraft(res.id, { includeManual: e.target.checked })
                          }
                          className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer"
                        />
                        <span>Contar aportes manuais</span>
                      </label>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/80 bg-muted/20 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-9 rounded-xl text-xs font-bold cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={handleSave}
            className="h-9 px-4 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Salvando...' : 'Salvar Metas Semanais'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
