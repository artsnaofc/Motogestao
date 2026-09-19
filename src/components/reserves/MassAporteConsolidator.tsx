import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Zap, 
  Check, 
  Calendar, 
  AlertCircle, 
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  X,
  SlidersHorizontal,
  Calculator,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Reserve, ReserveTransaction, Transaction } from '../../types';
import { 
  iconOptions, 
  formatCurrency, 
  calculateSuggestion, 
  getEffectiveAportesInPeriod,
  parseLocalDate,
  getTodayLocalDateStr
} from './reserveUtils';
import { toast } from 'sonner';

interface MassAporteConsolidatorProps {
  reserves: Reserve[];
  reserveTransactions: ReserveTransaction[];
  transactions: Transaction[];
  globalPeriod: string;
  customDateRange: { start: string; end: string };
  isSubmitting: boolean;
  onExecuteBatch: (batchData: {
    items: { reserve_id: string; amount: number; name: string }[];
    date: string;
    description: string;
  }) => Promise<void>;
  onClose?: () => void;
  onAuditSuggestion?: (reserve: Reserve) => void;
  isModal?: boolean;
}

export function MassAporteConsolidator({
  reserves,
  reserveTransactions,
  transactions,
  globalPeriod,
  customDateRange,
  isSubmitting,
  onExecuteBatch,
  onClose,
  onAuditSuggestion,
  isModal = false
}: MassAporteConsolidatorProps) {
  // Selection state
  const [selectedReserves, setSelectedReserves] = useState<Record<string, boolean>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [batchDate, setBatchDate] = useState<string>(getTodayLocalDateStr());
  const [batchDesc, setBatchDesc] = useState<string>('Aporte Consolidado');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'selected'>('all');
  
  // Quick distribution tool state
  const [showDistributeTool, setShowDistributeTool] = useState(false);
  const [globalDistributeTotal, setGlobalDistributeTotal] = useState('');
  const [distributeStrategy, setDistributeStrategy] = useState<'equal' | 'goal_proportional' | 'fixed_each'>('equal');

  // Active reserves only
  const activeReserves = useMemo(() => {
    return reserves.filter(r => r.status !== 'inactive');
  }, [reserves]);

  // Compute suggestions & effective aportes for each reserve
  const reserveMetrics = useMemo(() => {
    const map: Record<string, {
      suggested: number;
      effectiveAportes: number;
      pending: number;
      currentBalance: number;
      goal: number;
      goalProgress: number;
    }> = {};

    activeReserves.forEach(r => {
      const suggested = calculateSuggestion(r, transactions, reserveTransactions, globalPeriod, customDateRange);
      const effectiveAportes = getEffectiveAportesInPeriod(r, reserveTransactions, globalPeriod, customDateRange);
      const pending = Math.max(0, suggested - effectiveAportes);
      const currentBalance = r.saldo_atual || 0;
      const goal = r.meta_objetivo || 0;
      const goalProgress = goal > 0 ? Math.min(100, Math.round((currentBalance / goal) * 100)) : 0;

      map[r.id] = {
        suggested,
        effectiveAportes,
        pending,
        currentBalance,
        goal,
        goalProgress
      };
    });

    return map;
  }, [activeReserves, transactions, reserveTransactions, globalPeriod, customDateRange]);

  // Initial populate with smart suggestions
  useEffect(() => {
    const initialSelected: Record<string, boolean> = {};
    const initialAmounts: Record<string, string> = {};

    activeReserves.forEach(r => {
      const metric = reserveMetrics[r.id];
      if (metric && metric.pending > 0) {
        initialSelected[r.id] = true;
        initialAmounts[r.id] = metric.pending.toFixed(2);
      } else {
        initialAmounts[r.id] = '';
      }
    });

    setSelectedReserves(initialSelected);
    setCustomAmounts(initialAmounts);
  }, [activeReserves, reserveMetrics]);

  // Filtered reserves list sorted by suggestion amount (descending) then alphabetical
  const displayedReserves = useMemo(() => {
    const list = activeReserves.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (r.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      const metric = reserveMetrics[r.id];
      if (filterMode === 'pending') {
        return metric && metric.pending > 0;
      }
      if (filterMode === 'selected') {
        return !!selectedReserves[r.id];
      }
      return true;
    });

    return list.sort((a, b) => {
      const pendA = reserveMetrics[a.id]?.pending || 0;
      const pendB = reserveMetrics[b.id]?.pending || 0;

      if (pendA > 0 && pendB <= 0) return -1;
      if (pendB > 0 && pendA <= 0) return 1;
      if (pendA > 0 && pendB > 0) {
        if (pendB !== pendA) return pendB - pendA;
      }

      return a.name.localeCompare(b.name);
    });
  }, [activeReserves, searchTerm, filterMode, reserveMetrics, selectedReserves]);

  // Total selected items and calculated batch total
  const selectedItems = useMemo(() => {
    return Object.keys(selectedReserves)
      .filter(id => selectedReserves[id])
      .map(id => {
        const res = activeReserves.find(r => r.id === id);
        const amountNum = parseFloat(customAmounts[id] || '0') || 0;
        return {
          reserve_id: id,
          amount: amountNum,
          name: res?.name || 'Reserva',
          color: res?.color || '#6366f1',
          icon: res?.icon || 'PiggyBank',
          currentBalance: res?.saldo_atual || 0,
          newBalance: (res?.saldo_atual || 0) + amountNum,
          goal: res?.meta_objetivo || 0
        };
      });
  }, [selectedReserves, customAmounts, activeReserves]);

  const totalBatchAmount = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.amount, 0);
  }, [selectedItems]);

  // Bulk Selection Helpers
  const handleSelectAll = () => {
    const next: Record<string, boolean> = {};
    activeReserves.forEach(r => { next[r.id] = true; });
    setSelectedReserves(next);
  };

  const handleSelectOnlyPending = () => {
    const next: Record<string, boolean> = {};
    activeReserves.forEach(r => {
      if ((reserveMetrics[r.id]?.pending || 0) > 0) {
        next[r.id] = true;
      }
    });
    setSelectedReserves(next);
  };

  const handleDeselectAll = () => {
    setSelectedReserves({});
  };

  const handleApplyAllSuggestions = () => {
    const nextAmounts: Record<string, string> = { ...customAmounts };
    const nextSelected: Record<string, boolean> = { ...selectedReserves };
    activeReserves.forEach(r => {
      const pending = reserveMetrics[r.id]?.pending || 0;
      if (pending > 0) {
        nextAmounts[r.id] = pending.toFixed(2);
        nextSelected[r.id] = true;
      }
    });
    setCustomAmounts(nextAmounts);
    setSelectedReserves(nextSelected);
    toast.success('Valores sugeridos aplicados com sucesso!');
  };

  // Quick Distribution Tool Handler
  const handleExecuteDistribution = () => {
    const targetVal = parseFloat(globalDistributeTotal) || 0;
    if (targetVal <= 0) {
      toast.error('Informe um valor total válido para distribuir.');
      return;
    }

    const selectedIds = Object.keys(selectedReserves).filter(id => selectedReserves[id]);
    if (selectedIds.length === 0) {
      toast.error('Selecione ao menos uma reserva para distribuir o valor.');
      return;
    }

    const nextAmounts = { ...customAmounts };

    if (distributeStrategy === 'equal') {
      const splitVal = Math.round((targetVal / selectedIds.length) * 100) / 100;
      selectedIds.forEach(id => {
        nextAmounts[id] = splitVal.toFixed(2);
      });
    } else if (distributeStrategy === 'fixed_each') {
      const fixedVal = Math.round(targetVal * 100) / 100;
      selectedIds.forEach(id => {
        nextAmounts[id] = fixedVal.toFixed(2);
      });
    } else if (distributeStrategy === 'goal_proportional') {
      const totalGoals = selectedIds.reduce((sum, id) => {
        const r = activeReserves.find(item => item.id === id);
        return sum + (r?.meta_objetivo || 100);
      }, 0);

      selectedIds.forEach(id => {
        const r = activeReserves.find(item => item.id === id);
        const goal = r?.meta_objetivo || 100;
        const prop = Math.round(((goal / totalGoals) * targetVal) * 100) / 100;
        nextAmounts[id] = prop.toFixed(2);
      });
    }

    setCustomAmounts(nextAmounts);
    setShowDistributeTool(false);
    toast.success(`Distribuição realizada entre ${selectedIds.length} reservas!`);
  };

  // Submission
  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (selectedItems.length === 0) {
      toast.error('Nenhuma reserva selecionada para o aporte em lote.');
      return;
    }

    const invalidItems = selectedItems.filter(item => item.amount <= 0);
    if (invalidItems.length > 0) {
      toast.error(`A reserva "${invalidItems[0].name}" está selecionada com valor zerado.`);
      return;
    }

    try {
      await onExecuteBatch({
        items: selectedItems.map(i => ({
          reserve_id: i.reserve_id,
          amount: Math.round(i.amount * 100) / 100,
          name: i.name
        })),
        date: batchDate,
        description: batchDesc || 'Aporte Consolidado de Reservas'
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-card rounded-2xl sm:rounded-3xl border border-border/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] text-left">
      {/* Header Bar */}
      <div className="px-3.5 py-3 sm:px-5 sm:py-3.5 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border-b border-border/80 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Zap className="w-4 h-4 text-amber-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm sm:text-base font-black text-foreground tracking-tight truncate">
                Aporte em Massa
              </h2>
              <span className="px-1.5 py-0.2 text-[9px] font-black rounded-full bg-indigo-600 text-white uppercase tracking-wider shrink-0">
                Lote
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate font-medium">
              Aporte individualizado ou automático em lote
            </p>
          </div>
        </div>

        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-7 h-7 p-0 rounded-full text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Main Scrollable Content */}
      <div className="p-3 sm:p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
        {/* Compact Quick Actions & Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 bg-muted/40 rounded-xl border border-border/70">
          {/* Quick Selection Buttons */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={handleSelectAll}
              className="h-6.5 px-2 text-[10px] font-bold rounded-lg bg-card hover:bg-muted border border-border/70 text-foreground transition-all cursor-pointer"
            >
              Todas ({activeReserves.length})
            </button>
            <button
              type="button"
              onClick={handleSelectOnlyPending}
              className="h-6.5 px-2 text-[10px] font-bold rounded-lg bg-card hover:bg-muted border border-border/70 text-amber-600 dark:text-amber-400 transition-all cursor-pointer"
            >
              Pendentes
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="h-6.5 px-2 text-[10px] font-bold rounded-lg bg-card hover:bg-muted border border-border/70 text-muted-foreground transition-all cursor-pointer"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleApplyAllSuggestions}
              className="h-6.5 px-2 text-[10px] font-bold rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>Usar Sugestões</span>
            </button>
          </div>

          {/* Rateio Toggle Button */}
          <button
            type="button"
            onClick={() => setShowDistributeTool(!showDistributeTool)}
            className="h-6.5 px-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-lg flex items-center gap-1 cursor-pointer ml-auto"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Rateio Rápido</span>
            {showDistributeTool ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Expandable Rateio Panel */}
        <AnimatePresence>
          {showDistributeTool && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-3 bg-gradient-to-br from-indigo-500/5 via-card to-purple-500/5 rounded-xl border border-indigo-500/20 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Distribuir entre {selectedItems.length} reservas selecionadas</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Montante Total (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={globalDistributeTotal}
                        onChange={e => setGlobalDistributeTotal(e.target.value)}
                        className="pl-8 h-8 text-xs font-mono font-bold rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-8 space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">
                      Critério de Divisão
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => setDistributeStrategy('equal')}
                        className={`h-8 px-1 text-[10px] font-bold rounded-lg border transition-all truncate cursor-pointer ${
                          distributeStrategy === 'equal'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-card border-border hover:bg-muted text-foreground'
                        }`}
                      >
                        Igual
                      </button>
                      <button
                        type="button"
                        onClick={() => setDistributeStrategy('goal_proportional')}
                        className={`h-8 px-1 text-[10px] font-bold rounded-lg border transition-all truncate cursor-pointer ${
                          distributeStrategy === 'goal_proportional'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-card border-border hover:bg-muted text-foreground'
                        }`}
                      >
                        Por Meta %
                      </button>
                      <button
                        type="button"
                        onClick={() => setDistributeStrategy('fixed_each')}
                        className={`h-8 px-1 text-[10px] font-bold rounded-lg border transition-all truncate cursor-pointer ${
                          distributeStrategy === 'fixed_each'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-card border-border hover:bg-muted text-foreground'
                        }`}
                      >
                        Fixo p/ Cada
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-1.5 pt-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDistributeTool(false)}
                    className="h-7 text-[11px] text-muted-foreground"
                  >
                    Fechar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleExecuteDistribution}
                    className="h-7 px-3 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                  >
                    Aplicar Rateio
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter / Search Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar reserva..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-7.5 text-xs rounded-xl"
            />
          </div>

          <div className="flex items-center gap-0.5 shrink-0 bg-muted/40 p-0.5 rounded-lg border border-border/70 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                filterMode === 'all' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('pending')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                filterMode === 'pending' ? 'bg-card text-amber-600 dark:text-amber-400 shadow-2xs' : 'text-muted-foreground'
              }`}
            >
              Pendentes
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('selected')}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                filterMode === 'selected' ? 'bg-card text-indigo-600 dark:text-indigo-400 shadow-2xs' : 'text-muted-foreground'
              }`}
            >
              Marcadas ({selectedItems.length})
            </button>
          </div>
        </div>

        {/* Compact List of Reserves */}
        <div className="space-y-1.5 max-h-[340px] sm:max-h-[380px] overflow-y-auto pr-0.5 custom-scrollbar">
          {displayedReserves.length === 0 ? (
            <div className="p-6 text-center bg-muted/20 border border-dashed border-border rounded-xl">
              <AlertCircle className="w-6 h-6 text-muted-foreground mx-auto mb-1 opacity-50" />
              <p className="text-xs font-bold text-foreground">Nenhuma reserva encontrada</p>
            </div>
          ) : (
            displayedReserves.map(r => {
              const metric = reserveMetrics[r.id];
              const isChecked = !!selectedReserves[r.id];
              const IconComp = iconOptions[r.icon] || iconOptions.PiggyBank;
              const currentAmountStr = customAmounts[r.id] ?? '';

              return (
                <div
                  key={r.id}
                  className={`p-2.5 sm:p-3 rounded-xl border transition-all duration-150 ${
                    isChecked
                      ? 'bg-card border-indigo-500/40 shadow-2xs ring-1 ring-indigo-500/20'
                      : 'bg-muted/20 border-border/70 hover:bg-muted/40 opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    {/* Top / Left: Checkbox, Identity & Current Balance */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReserves(prev => ({
                            ...prev,
                            [r.id]: !prev[r.id]
                          }));
                        }}
                        className="text-indigo-600 dark:text-indigo-400 cursor-pointer shrink-0 p-0.5"
                      >
                        {isChecked ? (
                          <div className="w-4.5 h-4.5 rounded-md bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-4.5 h-4.5 rounded-md border-2 border-muted-foreground/40 hover:border-indigo-500" />
                        )}
                      </button>

                      {/* Icon */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: r.color || '#6366f1' }}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                      </div>

                      {/* Name & Balance info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-foreground truncate">{r.name}</h4>
                          {r.meta_objetivo && r.meta_objetivo > 0 && (
                            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                              {metric.goalProgress}%
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                          <span>Saldo: <strong className="text-foreground font-mono">{formatCurrency(metric.currentBalance)}</strong></span>
                          {metric.pending > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold truncate">
                              • Sugerido: <strong className="font-mono">{formatCurrency(metric.pending)}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom / Right: Actions & Custom Amount Input */}
                    <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-border/50">
                      {/* Shortcut buttons */}
                      <div className="flex items-center gap-1">
                        {onAuditSuggestion && (
                          <button
                            type="button"
                            onClick={() => onAuditSuggestion(r)}
                            title="Auditar cálculo da sugestão"
                            className="p-1 rounded text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-muted transition-colors cursor-pointer"
                          >
                            <Calculator className="w-3 h-3" />
                          </button>
                        )}
                        {metric.pending > 0 && (
                          <button
                            type="button"
                            disabled={!isChecked}
                            onClick={() => {
                              setCustomAmounts(prev => ({
                                ...prev,
                                [r.id]: metric.pending.toFixed(2)
                              }));
                            }}
                            className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 cursor-pointer"
                            title="Usar valor sugerido da regra"
                          >
                            Sugerido
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={!isChecked}
                          onClick={() => {
                            const cur = parseFloat(customAmounts[r.id] || '0') || 0;
                            setCustomAmounts(prev => ({
                              ...prev,
                              [r.id]: (cur + 50).toFixed(2)
                            }));
                          }}
                          className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-muted hover:bg-muted-foreground/10 text-muted-foreground disabled:opacity-40 cursor-pointer"
                        >
                          +50
                        </button>
                        <button
                          type="button"
                          disabled={!isChecked}
                          onClick={() => {
                            const cur = parseFloat(customAmounts[r.id] || '0') || 0;
                            setCustomAmounts(prev => ({
                              ...prev,
                              [r.id]: (cur + 100).toFixed(2)
                            }));
                          }}
                          className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-muted hover:bg-muted-foreground/10 text-muted-foreground disabled:opacity-40 cursor-pointer"
                        >
                          +100
                        </button>
                      </div>

                      {/* Currency Input */}
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          disabled={!isChecked}
                          value={currentAmountStr}
                          onChange={e => {
                            setCustomAmounts(prev => ({
                              ...prev,
                              [r.id]: e.target.value
                            }));
                          }}
                          className="w-22 sm:w-26 pl-6 text-right h-7 text-xs font-mono font-bold rounded-lg disabled:opacity-40"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Batch Metadata (Date) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-border/70">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">Data do Aporte:</label>
            <Input
              type="date"
              value={batchDate}
              onChange={e => setBatchDate(e.target.value)}
              className="h-8 text-xs rounded-xl w-auto"
            />
          </div>
          <div className="text-[11px] text-muted-foreground font-medium">
            Todos os valores serão creditados diretamente nos saldos das reservas.
          </div>
        </div>
      </div>

      {/* Sticky Bottom Summary & CTA Bar */}
      <div className="px-3.5 py-3 sm:px-5 sm:py-3 bg-muted/40 border-t border-border/80 flex items-center justify-between gap-3 shrink-0">
        <div>
          <span className="text-[10px] font-bold uppercase text-muted-foreground block">
            {selectedItems.length} {selectedItems.length === 1 ? 'reserva selecionada' : 'reservas selecionadas'}
          </span>
          <p className="text-base sm:text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight leading-none">
            {formatCurrency(totalBatchAmount)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8.5 px-3 text-xs font-bold"
            >
              Cancelar
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedItems.length === 0 || totalBatchAmount <= 0}
            size="sm"
            className="h-8.5 px-4 text-xs font-black bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Confirmar Aporte</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
