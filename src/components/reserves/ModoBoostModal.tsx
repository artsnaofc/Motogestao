import { useEffect, useMemo, useState } from 'react';
import {
  Rocket,
  Zap,
  X,
  TrendingUp,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Power,
  Sliders,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Reserve, ReserveTransaction, Transaction } from '../../types';
import {
  iconOptions,
  formatCurrency,
  calculateSuggestion,
  getEffectiveAportesInPeriod,
  getDefaultBoostValue,
  isReserveBoostActive,
  getEffectiveRuleValue,
  getRuleBoostDeltaLabel,
  getBoostSpeedupComparison,
  formatEstimatedTimeline,
} from './reserveUtils';
import { toast } from '@/lib/toast';

interface ModoBoostModalProps {
  isOpen: boolean;
  onClose: () => void;
  reserves: Reserve[];
  transactions: Transaction[];
  reserveTransactions: ReserveTransaction[];
  globalPeriod: string;
  customDateRange: { start: string; end: string };
  focusReserveId?: string | null;
  onUpdateReserveBoost: (
    reserveId: string,
    payload: {
      boost_ativo: boolean;
      boost_tipo: 'increment' | 'multiplier';
      boost_valor: number;
    }
  ) => Promise<void>;
  onBatchUpdateBoost: (
    updates: Array<{
      reserveId: string;
      boost_ativo: boolean;
      boost_tipo: 'increment' | 'multiplier';
      boost_valor: number;
    }>
  ) => Promise<void>;
  onOpenRuleModal?: (reserve: Reserve) => void;
  operationalCategories?: string[];
}

interface DraftBoostRow {
  boost_ativo: boolean;
  boost_tipo: 'increment' | 'multiplier';
  boost_valor: string;
}

export function ModoBoostModal({
  isOpen,
  onClose,
  reserves,
  transactions,
  reserveTransactions,
  globalPeriod,
  customDateRange,
  focusReserveId = null,
  onUpdateReserveBoost,
  onBatchUpdateBoost,
  onOpenRuleModal,
  operationalCategories,
}: ModoBoostModalProps) {
  const [drafts, setDrafts] = useState<Record<string, DraftBoostRow>>({});
  const [globalPresetMode, setGlobalPresetMode] = useState<'increment' | 'multiplier'>('increment');
  const [globalMultiplier, setGlobalMultiplier] = useState<string>('1.5');
  const [globalKmInc, setGlobalKmInc] = useState<string>('0.10');
  const [globalPctInc, setGlobalPctInc] = useState<string>('5');
  const [globalFixedInc, setGlobalFixedInc] = useState<string>('10');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingBoostConfirm, setPendingBoostConfirm] = useState<
    | {
        kind: 'single';
        reserve: Reserve;
        nextActive: boolean;
        tipo: 'increment' | 'multiplier';
        safeVal: number;
      }
    | {
        kind: 'batch';
        activateAll: boolean;
        updates: Array<{
          reserveId: string;
          boost_ativo: boolean;
          boost_tipo: 'increment' | 'multiplier';
          boost_valor: number;
        }>;
      }
    | null
  >(null);

  const eligibleReserves = useMemo(() => {
    return (reserves || []).filter(
      r => r.status !== 'inactive' && !r.is_paused && r.regra_ativa && r.regra_tipo
    );
  }, [reserves]);

  const ineligibleReserves = useMemo(() => {
    return (reserves || []).filter(
      r => r.status !== 'inactive' && (!r.regra_ativa || !r.regra_tipo || r.is_paused)
    );
  }, [reserves]);

  useEffect(() => {
    if (!isOpen) {
      setPendingBoostConfirm(null);
      return;
    }
    const nextDrafts: Record<string, DraftBoostRow> = {};
    eligibleReserves.forEach(r => {
      const tipo = (r.boost_tipo || 'increment') as 'increment' | 'multiplier';
      const valNum =
        r.boost_valor !== undefined && r.boost_valor !== null && Number(r.boost_valor) > 0
          ? Number(r.boost_valor)
          : getDefaultBoostValue(r.regra_tipo, tipo);
      nextDrafts[r.id] = {
        boost_ativo: Boolean(r.boost_ativo),
        boost_tipo: tipo,
        boost_valor: String(valNum),
      };
    });
    setDrafts(nextDrafts);
  }, [isOpen, eligibleReserves]);

  const orderedReserves = useMemo(() => {
    if (!focusReserveId) return eligibleReserves;
    return [...eligibleReserves].sort((a, b) => {
      if (a.id === focusReserveId) return -1;
      if (b.id === focusReserveId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [eligibleReserves, focusReserveId]);

  const parseNum = (raw: string, fallback = 0): number => {
    const cleaned = String(raw || '').replace(',', '.').trim();
    const num = parseFloat(cleaned);
    if (isNaN(num) || num < 0) return fallback;
    return Math.round(num * 10000) / 10000;
  };

  // Compute live preview stats comparing base vs current draft boost across eligible reserves
  const summaryStats = useMemo(() => {
    let totalNormalPending = 0;
    let totalBoostedPending = 0;
    let activeBoostCount = 0;

    eligibleReserves.forEach(r => {
      const draft = drafts[r.id];
      const basePending = (() => {
        const s = calculateSuggestion(r, transactions, reserveTransactions, globalPeriod, customDateRange, {
          ignoreBoost: true,
          operationalCategories,
        });
        const e = getEffectiveAportesInPeriod(r, reserveTransactions, globalPeriod, customDateRange, { ignoreBoost: true });
        return Math.max(0, Math.round((s - e) * 100) / 100);
      })();

      const simulatedRes: Reserve = draft
        ? {
            ...r,
            boost_ativo: draft.boost_ativo,
            boost_tipo: draft.boost_tipo,
            boost_valor: parseNum(draft.boost_valor, 0),
          }
        : r;

      const simActive = isReserveBoostActive(simulatedRes);
      if (simActive) activeBoostCount += 1;

      const simPending = (() => {
        const s = calculateSuggestion(simulatedRes, transactions, reserveTransactions, globalPeriod, customDateRange, {
          operationalCategories,
        });
        const e = getEffectiveAportesInPeriod(simulatedRes, reserveTransactions, globalPeriod, customDateRange);
        return Math.max(0, Math.round((s - e) * 100) / 100);
      })();

      totalNormalPending += basePending;
      totalBoostedPending += simPending;
    });

    return {
      totalNormalPending: Math.round(totalNormalPending * 100) / 100,
      totalBoostedPending: Math.round(totalBoostedPending * 100) / 100,
      extraDelta: Math.round((totalBoostedPending - totalNormalPending) * 100) / 100,
      activeBoostCount,
    };
  }, [eligibleReserves, drafts, transactions, reserveTransactions, globalPeriod, customDateRange, operationalCategories]);

  if (!isOpen) return null;

  const formatRuleVal = (regraTipo: Reserve['regra_tipo'], val: number) => {
    if (regraTipo === 'km') return `R$ ${val.toFixed(2).replace('.', ',')}/km`;
    if (regraTipo === 'bruto' || regraTipo === 'liquido') return `${Number(val.toFixed(2))}%`;
    if (regraTipo === 'fixo' || (regraTipo as string) === 'fixo_diario') {
      return `R$ ${val.toFixed(2).replace('.', ',')}/dia`;
    }
    return String(val);
  };

  const handleToggleSingleBoost = (r: Reserve) => {
    const draft = drafts[r.id];
    const tipo = draft?.boost_tipo || (r.boost_tipo as 'increment' | 'multiplier') || 'increment';
    const rawVal = parseNum(
      draft?.boost_valor || '',
      getDefaultBoostValue(r.regra_tipo, tipo)
    );
    const nextActive = !(draft?.boost_ativo ?? Boolean(r.boost_ativo));
    const safeVal =
      tipo === 'multiplier'
        ? rawVal > 1
          ? rawVal
          : 1.5
        : rawVal > 0
          ? rawVal
          : getDefaultBoostValue(r.regra_tipo, 'increment');

    setPendingBoostConfirm({
      kind: 'single',
      reserve: r,
      nextActive,
      tipo,
      safeVal,
    });
  };

  const handleApplyGlobalPreset = (activateAll: boolean) => {
    if (eligibleReserves.length === 0) return;

    const updates = eligibleReserves.map(r => {
      if (!activateAll) {
        const curDraft = drafts[r.id];
        const tipo = curDraft?.boost_tipo || (r.boost_tipo as 'increment' | 'multiplier') || 'increment';
        const val = parseNum(
          curDraft?.boost_valor || '',
          Number(r.boost_valor || 0) > 0 ? Number(r.boost_valor) : getDefaultBoostValue(r.regra_tipo, tipo)
        );
        return {
          reserveId: r.id,
          boost_ativo: false,
          boost_tipo: tipo,
          boost_valor: val,
        };
      }

      if (globalPresetMode === 'multiplier') {
        const mult = Math.max(1.05, parseNum(globalMultiplier, 1.5));
        return {
          reserveId: r.id,
          boost_ativo: true,
          boost_tipo: 'multiplier' as const,
          boost_valor: mult,
        };
      }

      let inc = 5;
      if (r.regra_tipo === 'km') inc = Math.max(0.01, parseNum(globalKmInc, 0.1));
      else if (r.regra_tipo === 'bruto' || r.regra_tipo === 'liquido') inc = Math.max(0.5, parseNum(globalPctInc, 5));
      else inc = Math.max(1, parseNum(globalFixedInc, 10));

      return {
        reserveId: r.id,
        boost_ativo: true,
        boost_tipo: 'increment' as const,
        boost_valor: inc,
      };
    });

    setPendingBoostConfirm({
      kind: 'batch',
      activateAll,
      updates,
    });
  };

  const handleExecutePendingBoostConfirm = async () => {
    if (!pendingBoostConfirm || isSaving) return;
    setIsSaving(true);
    try {
      if (pendingBoostConfirm.kind === 'single') {
        const { reserve: r, nextActive, tipo, safeVal } = pendingBoostConfirm;
        setDrafts(prev => ({
          ...prev,
          [r.id]: {
            boost_ativo: nextActive,
            boost_tipo: tipo,
            boost_valor: String(safeVal),
          },
        }));
        await onUpdateReserveBoost(r.id, {
          boost_ativo: nextActive,
          boost_tipo: tipo,
          boost_valor: safeVal,
        });
        toast.success(
          nextActive
            ? `Modo Boost ativado em "${r.name}"!`
            : `Modo Boost desativado em "${r.name}". Sugestões normais preservadas.`
        );
      } else {
        const { activateAll, updates } = pendingBoostConfirm;
        const nextDrafts = { ...drafts };
        updates.forEach(u => {
          nextDrafts[u.reserveId] = {
            boost_ativo: u.boost_ativo,
            boost_tipo: u.boost_tipo,
            boost_valor: String(u.boost_valor),
          };
        });
        setDrafts(nextDrafts);
        await onBatchUpdateBoost(updates);
        toast.success(
          activateAll
            ? `🚀 Modo Boost ativado em ${updates.length} reservas!`
            : 'Modo Boost desativado em todas as reservas.'
        );
      }
      setPendingBoostConfirm(null);
    } catch (err: any) {
      toast.error('Erro ao atualizar Modo Boost: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAllDrafts = async () => {
    if (eligibleReserves.length === 0) {
      onClose();
      return;
    }

    const updates: Array<{
      reserveId: string;
      boost_ativo: boolean;
      boost_tipo: 'increment' | 'multiplier';
      boost_valor: number;
    }> = [];

    for (const r of eligibleReserves) {
      const d = drafts[r.id];
      if (!d) continue;
      const val = parseNum(d.boost_valor, 0);
      if (d.boost_ativo) {
        if (d.boost_tipo === 'multiplier' && val <= 1) {
          toast.error(`Em "${r.name}", o multiplicador do Boost deve ser maior que 1x.`);
          return;
        }
        if (d.boost_tipo === 'increment' && val <= 0) {
          toast.error(`Em "${r.name}", informe um acréscimo maior que zero para o Boost.`);
          return;
        }
      }
      updates.push({
        reserveId: r.id,
        boost_ativo: d.boost_ativo,
        boost_tipo: d.boost_tipo,
        boost_valor: val > 0 ? val : getDefaultBoostValue(r.regra_tipo, d.boost_tipo),
      });
    }

    try {
      setIsSaving(true);
      await onBatchUpdateBoost(updates);
      toast.success('Configurações do Modo Boost salvas!');
      onClose();
    } catch (err: any) {
      toast.error('Erro ao salvar Modo Boost: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-card w-full max-w-3xl rounded-2xl sm:rounded-3xl border border-amber-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in fade-in zoom-in-95 duration-200 text-left">
        {/* Header */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-indigo-500/10 border-b border-border/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Rocket className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                  Modo Boost de Reservas
                </h2>
                <span
                  className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${
                    summaryStats.activeBoostCount > 0
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {summaryStats.activeBoostCount > 0
                    ? `${summaryStats.activeBoostCount} ${summaryStats.activeBoostCount === 1 ? 'ativa' : 'ativas'}`
                    : 'Desativado'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate">
                Eleve temporariamente suas regras para acelerar aportes e concluir metas mais rápido
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-8 h-8 p-0 rounded-full text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="p-3.5 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* Safety Info Banner */}
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-[11px] leading-snug">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-emerald-900 dark:text-emerald-200">
              <strong>Ligue e desligue na hora que quiser:</strong> desativar o Boost restaura imediatamente sua regra original sem zerar nem negativar as sugestões futuras — o extra aportado durante o Boost fica isolado para acelerar sua meta.
            </div>
          </div>

          {/* Global Master Controls */}
          {eligibleReserves.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-card to-orange-500/5 border border-amber-500/25 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-black text-foreground uppercase tracking-wider">
                    Controle Global em Lote
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-xl border border-border/70 text-[11px] font-bold self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setGlobalPresetMode('increment')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      globalPresetMode === 'increment'
                        ? 'bg-card text-amber-600 dark:text-amber-400 shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    + Elevar em Valor
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlobalPresetMode('multiplier')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      globalPresetMode === 'multiplier'
                        ? 'bg-card text-amber-600 dark:text-amber-400 shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Multiplicador (x)
                  </button>
                </div>
              </div>

              {globalPresetMode === 'increment' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Regras por KM (+R$/km)
                    </label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={globalKmInc}
                      onChange={e => setGlobalKmInc(e.target.value.replace(/[^0-9.,]/g, ''))}
                      className="h-9 text-base sm:text-xs font-mono font-bold rounded-xl bg-card"
                      placeholder="0.10"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Bruto / Líquido (+%)
                    </label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={globalPctInc}
                      onChange={e => setGlobalPctInc(e.target.value.replace(/[^0-9.,]/g, ''))}
                      className="h-9 text-base sm:text-xs font-mono font-bold rounded-xl bg-card"
                      placeholder="5"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Valor Fixo (+R$/dia)
                    </label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={globalFixedInc}
                      onChange={e => setGlobalFixedInc(e.target.value.replace(/[^0-9.,]/g, ''))}
                      className="h-9 text-base sm:text-xs font-mono font-bold rounded-xl bg-card"
                      placeholder="10"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">Multiplicar todas as regras por:</span>
                  {['1.25', '1.5', '2'].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setGlobalMultiplier(preset)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        globalMultiplier === preset
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-card text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {preset.replace('.', ',')}x
                    </button>
                  ))}
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={globalMultiplier}
                    onChange={e => setGlobalMultiplier(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className="w-20 h-8 text-base sm:text-xs font-mono font-bold rounded-xl bg-card text-center"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => handleApplyGlobalPreset(true)}
                  className="h-8.5 px-3.5 text-xs font-black bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl shadow-xs gap-1.5 cursor-pointer"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span>Ativar Boost em Todas ({eligibleReserves.length})</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSaving || summaryStats.activeBoostCount === 0}
                  onClick={() => handleApplyGlobalPreset(false)}
                  className="h-8.5 px-3 text-xs font-bold border-border hover:bg-muted rounded-xl gap-1.5 cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Desativar Todos</span>
                </Button>
              </div>
            </div>
          )}

          {/* Individual Reserves List */}
          {orderedReserves.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-muted/20 space-y-2">
              <Sliders className="w-7 h-7 text-muted-foreground mx-auto opacity-60" />
              <p className="text-sm font-bold text-foreground">
                Nenhuma reserva com regra automática ativa
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                O Modo Boost eleva as regras automáticas (R$/km, % Bruto, % Lucro ou R$/dia). Defina uma regra em uma reserva para ativar o Boost.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Ajuste Individual por Reserva ({orderedReserves.length})</span>
              </h3>

              {orderedReserves.map(r => {
                const IconComp = iconOptions[r.icon] || Rocket;
                const draft = drafts[r.id] || {
                  boost_ativo: Boolean(r.boost_ativo),
                  boost_tipo: (r.boost_tipo || 'increment') as 'increment' | 'multiplier',
                  boost_valor: String(r.boost_valor || getDefaultBoostValue(r.regra_tipo, 'increment')),
                };
                const baseVal = Number(r.regra_valor || 0);
                const parsedBoostVal = parseNum(draft.boost_valor, 0);

                const simulatedRes: Reserve = {
                  ...r,
                  boost_ativo: draft.boost_ativo,
                  boost_tipo: draft.boost_tipo,
                  boost_valor: parsedBoostVal,
                };
                const effectiveActive = isReserveBoostActive(simulatedRes);
                const effectiveVal = getEffectiveRuleValue(simulatedRes);

                const basePending = Math.max(
                  0,
                  Math.round(
                    (calculateSuggestion(r, transactions, reserveTransactions, globalPeriod, customDateRange, {
                      ignoreBoost: true,
                      operationalCategories,
                    }) -
                      getEffectiveAportesInPeriod(r, reserveTransactions, globalPeriod, customDateRange, { ignoreBoost: true })) *
                      100
                  ) / 100
                );
                const boostedPending = Math.max(
                  0,
                  Math.round(
                    (calculateSuggestion(simulatedRes, transactions, reserveTransactions, globalPeriod, customDateRange, {
                      operationalCategories,
                    }) -
                      getEffectiveAportesInPeriod(simulatedRes, reserveTransactions, globalPeriod, customDateRange)) *
                      100
                  ) / 100
                );

                // Goal speedup preview (comparing normal vs boosted even when previewing)
                const comparison = getBoostSpeedupComparison(
                  r,
                  transactions,
                  reserveTransactions,
                  {
                    boost_ativo: true,
                    boost_tipo: draft.boost_tipo,
                    boost_valor: parsedBoostVal > 0 ? parsedBoostVal : getDefaultBoostValue(r.regra_tipo, draft.boost_tipo),
                  },
                  { operationalCategories }
                );

                const unitLabel =
                  draft.boost_tipo === 'multiplier'
                    ? 'x'
                    : r.regra_tipo === 'bruto' || r.regra_tipo === 'liquido'
                      ? '%'
                      : 'R$';

                const presets =
                  draft.boost_tipo === 'multiplier'
                    ? [1.25, 1.5, 2]
                    : r.regra_tipo === 'km'
                      ? [0.05, 0.1, 0.2]
                      : r.regra_tipo === 'bruto' || r.regra_tipo === 'liquido'
                        ? [2, 5, 10]
                        : [5, 10, 20];

                const isFocused = focusReserveId === r.id;

                return (
                  <div
                    key={r.id}
                    className={`p-3 sm:p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                      effectiveActive
                        ? 'bg-gradient-to-br from-amber-500/10 via-card to-orange-500/5 border-amber-500/40 shadow-xs'
                        : 'bg-muted/20 border-border/80'
                    } ${isFocused ? 'ring-2 ring-amber-500/50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                          style={{ backgroundColor: r.color || '#6366f1' }}
                        >
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-black text-foreground truncate">
                              {r.name}
                            </h4>
                            {effectiveActive && (
                              <span className="px-1.5 py-0.2 rounded-md text-[9.5px] font-black bg-amber-500 text-white flex items-center gap-0.5">
                                <Rocket className="w-2.5 h-2.5" />
                                {getRuleBoostDeltaLabel(simulatedRes)}
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-muted-foreground font-medium flex flex-wrap items-center gap-x-2">
                            <span>
                              Regra base: <strong className="text-foreground">{formatRuleVal(r.regra_tipo, baseVal)}</strong>
                            </span>
                            {effectiveActive && (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">
                                ➔ Com Boost: {formatRuleVal(r.regra_tipo, effectiveVal)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Instant Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleSingleBoost(r)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                          draft.boost_ativo
                            ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-2xs'
                            : 'bg-card hover:bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{draft.boost_ativo ? 'Boost ON' : 'Ativar'}</span>
                      </button>
                    </div>

                    {/* Config row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/60">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/70 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              const def = getDefaultBoostValue(r.regra_tipo, 'increment');
                              setDrafts(prev => ({
                                ...prev,
                                [r.id]: { ...draft, boost_tipo: 'increment', boost_valor: String(def) },
                              }));
                            }}
                            className={`px-2 py-0.5 rounded-md cursor-pointer ${
                              draft.boost_tipo === 'increment'
                                ? 'bg-card text-foreground shadow-2xs'
                                : 'text-muted-foreground'
                            }`}
                          >
                            + Valor
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDrafts(prev => ({
                                ...prev,
                                [r.id]: { ...draft, boost_tipo: 'multiplier', boost_valor: '1.5' },
                              }));
                            }}
                            className={`px-2 py-0.5 rounded-md cursor-pointer ${
                              draft.boost_tipo === 'multiplier'
                                ? 'bg-card text-foreground shadow-2xs'
                                : 'text-muted-foreground'
                            }`}
                          >
                            Multi (x)
                          </button>
                        </div>

                        <div className="relative w-24">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                            {unitLabel === 'x' ? '×' : unitLabel}
                          </span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={draft.boost_valor}
                            onChange={e => {
                              const cleaned = e.target.value.replace(/[^0-9.,]/g, '');
                              setDrafts(prev => ({
                                ...prev,
                                [r.id]: { ...draft, boost_valor: cleaned },
                              }));
                            }}
                            className="h-8 pl-6 pr-2 text-base sm:text-xs font-mono font-bold rounded-lg bg-card text-right"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          {presets.map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() =>
                                setDrafts(prev => ({
                                  ...prev,
                                  [r.id]: { ...draft, boost_valor: String(p) },
                                }))
                              }
                              className="px-1.5 py-0.5 rounded-md border border-border/80 bg-card hover:bg-muted text-[10px] font-bold text-foreground cursor-pointer"
                            >
                              {draft.boost_tipo === 'multiplier'
                                ? `${p}x`
                                : r.regra_tipo === 'km'
                                  ? `+${p.toFixed(2)}`
                                  : r.regra_tipo === 'bruto' || r.regra_tipo === 'liquido'
                                    ? `+${p}%`
                                    : `+R$${p}`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Impact badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                        <span className="px-2 py-0.5 rounded-lg bg-card border border-border/80 font-mono">
                          Sugestão:{' '}
                          <strong className={effectiveActive ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}>
                            {formatCurrency(basePending)}
                            {effectiveActive && boostedPending !== basePending && ` ➔ ${formatCurrency(boostedPending)}`}
                          </strong>
                        </span>

                        {comparison.daysSaved !== null && comparison.daysSaved > 0 && comparison.boostedProjection.estimatedDays !== null && (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>
                              {formatEstimatedTimeline(comparison.boostedProjection.estimatedDays)} ({comparison.daysSaved}d mais rápido)
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Ineligible reserves hint */}
          {ineligibleReserves.length > 0 && (
            <div className="pt-2 border-t border-border/60 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Reservas sem regra automática ativa ({ineligibleReserves.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ineligibleReserves.map(res => (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => {
                      if (onOpenRuleModal) {
                        onClose();
                        onOpenRuleModal(res);
                      }
                    }}
                    className="px-2.5 py-1 rounded-xl bg-muted/40 hover:bg-muted border border-border/70 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {res.name} {res.is_paused ? '(Pausada)' : '• + Definir regra'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-muted/40 border-t border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                Sugestão Pendente (Normal ➔ Boost)
              </span>
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-xs font-bold text-muted-foreground">
                  {formatCurrency(summaryStats.totalNormalPending)}
                </span>
                <span className="text-muted-foreground">➔</span>
                <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400">
                  {formatCurrency(summaryStats.totalBoostedPending)}
                </span>
                {summaryStats.extraDelta > 0 && (
                  <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-black flex items-center gap-0.5">
                    <TrendingUp className="w-2.5 h-2.5" />+{formatCurrency(summaryStats.extraDelta)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-9 px-3 text-xs font-bold cursor-pointer"
            >
              Fechar
            </Button>
            {eligibleReserves.length > 0 && (
              <Button
                type="button"
                size="sm"
                disabled={isSaving}
                onClick={handleSaveAllDrafts}
                className="h-9 px-4 text-xs font-black bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl shadow-xs gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Salvando...' : 'Aplicar Ajustes'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation overlay for single/batch Boost activation/deactivation */}
      {pendingBoostConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-3xl border border-border p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Rocket className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-foreground">
                  {pendingBoostConfirm.kind === 'single'
                    ? pendingBoostConfirm.nextActive
                      ? `Ativar Boost em "${pendingBoostConfirm.reserve.name}"?`
                      : `Desativar Boost em "${pendingBoostConfirm.reserve.name}"?`
                    : pendingBoostConfirm.activateAll
                      ? `Ativar Boost em ${pendingBoostConfirm.updates.length} Reservas?`
                      : `Desativar Boost em Todas as Reservas?`}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {pendingBoostConfirm.kind === 'single'
                    ? pendingBoostConfirm.nextActive
                      ? 'As regras e próximas sugestões desta reserva serão elevadas imediatamente pelo valor configurado.'
                      : 'As sugestões desta reserva voltarão imediatamente para a regra normal configurada.'
                    : pendingBoostConfirm.activateAll
                      ? `Todas as ${pendingBoostConfirm.updates.length} reservas elegíveis terão o Modo Boost ativado com o ajuste selecionado.`
                      : 'Todas as reservas voltarão imediatamente para as sugestões normais sem perder os valores salvos.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSaving}
                onClick={() => setPendingBoostConfirm(null)}
                className="rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSaving}
                onClick={handleExecutePendingBoostConfirm}
                className={`rounded-xl text-xs font-black cursor-pointer text-white ${
                  (pendingBoostConfirm.kind === 'single' ? pendingBoostConfirm.nextActive : pendingBoostConfirm.activateAll)
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                    : 'bg-zinc-700 hover:bg-zinc-800'
                }`}
              >
                {isSaving
                  ? 'Aplicando...'
                  : (pendingBoostConfirm.kind === 'single' ? pendingBoostConfirm.nextActive : pendingBoostConfirm.activateAll)
                    ? 'Confirmar Ativação'
                    : 'Confirmar Desativação'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
