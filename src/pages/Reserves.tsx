import { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { supabase } from '../lib/supabase';
import { 
  PiggyBank, 
  Plus, 
  Search, 
  RefreshCw,
  Zap,
  Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Reserve, ReserveTransaction, Transaction } from '../types';
import { 
  formatCurrency, 
  calculateSuggestion, 
  getEffectiveAportesInPeriod,
  parseLocalDate,
  generateUUID,
  calculateNextOccurrence,
  RecurrenceFrequency
} from '../components/reserves/reserveUtils';
import { cacheManager } from '../lib/cacheManager';
import { syncQueueManager } from '../lib/syncQueue';
import { ReservesHeader } from '../components/reserves/ReservesHeader';
import { ReserveCard } from '../components/reserves/ReserveCard';
import { MassAporteConsolidator } from '../components/reserves/MassAporteConsolidator';
import { ReserveHistoryTab } from '../components/reserves/ReserveHistoryTab';
import { ReserveModal } from '../components/reserves/ReserveModal';
import { UpdateRuleModal } from '../components/reserves/UpdateRuleModal';
import { 
  AporteManualModal, 
  WithdrawModal, 
  UpdateBalanceModal, 
  RuleHistoryModal 
} from '../components/reserves/QuickActionModals';
import { toast } from 'sonner';

export function Reserves() {
  const {
    reserves = [],
    reserveTransactions = [],
    transactions = [],
    settings,
    addReserve,
    updateReserve,
    deleteReserve,
    addReserveTransaction,
    deleteReserveTransaction,
    updateReserveTransaction,
    setReserveTransactions,
    refreshData,
    globalPeriod = 'month',
    setGlobalPeriod,
    customDateRange = { start: '', end: '' },
    setCustomDateRange,
    hideValues,
    setHideValues
  } = useData();

  // Active view tab: 'cards' or 'history'
  const [activeTab, setActiveTab] = useState<'cards' | 'history'>('cards');

  // Search & Filter in Cards
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'with_pending' | 'reached'>('all');

  // Modals state
  const [showMassAporteModal, setShowMassAporteModal] = useState(false);
  const [showCreateEditModal, setShowCreateEditModal] = useState(false);
  const [reserveToEdit, setReserveToEdit] = useState<Reserve | null>(null);

  const [showUpdateRuleModal, setShowUpdateRuleModal] = useState(false);
  const [reserveToUpdateRule, setReserveToUpdateRule] = useState<Reserve | null>(null);

  const [selectedReserveForAction, setSelectedReserveForAction] = useState<Reserve | null>(null);
  const [actionModalType, setActionModalType] = useState<'aporte_manual' | 'withdraw' | 'update_balance' | 'rule_history' | null>(null);
  const [aporteInitialAmount, setAporteInitialAmount] = useState<number | undefined>(undefined);
  const [aporteInitialDesc, setAporteInitialDesc] = useState<string | undefined>(undefined);
  const [isSuggestionAporte, setIsSuggestionAporte] = useState<boolean>(false);

  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  // Active non-archived reserves
  const activeReserves = useMemo(() => {
    return (reserves || []).filter(r => r.status !== 'inactive');
  }, [reserves]);

  // Suggestion calculation uses a fixed standard period ('month') to prevent value divergence
  const FIXED_SUGGESTION_PERIOD = 'month';
  const FIXED_CUSTOM_RANGE = { start: '', end: '' };

  // Overall consolidated metrics
  const totals = useMemo(() => {
    let totalBalance = 0;
    let totalGoal = 0;
    let totalPendingSuggestion = 0;

    activeReserves.forEach(r => {
      const bal = Number(r.saldo_atual || 0);
      const goal = Number(r.meta_objetivo || 0);
      totalBalance += bal;
      totalGoal += goal;

      const suggested = calculateSuggestion(
        r, 
        transactions, 
        reserveTransactions, 
        FIXED_SUGGESTION_PERIOD, 
        FIXED_CUSTOM_RANGE
      );
      const effectiveAportes = getEffectiveAportesInPeriod(
        r, 
        reserveTransactions, 
        FIXED_SUGGESTION_PERIOD, 
        FIXED_CUSTOM_RANGE
      );
      const pending = Math.max(0, suggested - effectiveAportes);
      totalPendingSuggestion += pending;
    });

    const totalYield = (reserveTransactions || [])
      .filter(rt => rt.type === 'rendimento')
      .reduce((sum, rt) => sum + Number(rt.amount || 0), 0);

    return {
      totalBalance,
      totalGoal,
      totalPendingSuggestion,
      totalYield,
      activeCount: activeReserves.filter(r => !r.is_paused).length
    };
  }, [activeReserves, transactions, reserveTransactions]);

  // Filtered reserves list for cards with suggested amounts first
  const filteredCards = useMemo(() => {
    const list = activeReserves.filter(r => {
      // Search
      const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (r.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // Status
      if (statusFilter === 'active') {
        return !r.is_paused;
      }
      if (statusFilter === 'with_pending') {
        const sugg = calculateSuggestion(
          r, 
          transactions, 
          reserveTransactions, 
          FIXED_SUGGESTION_PERIOD, 
          FIXED_CUSTOM_RANGE
        );
        const eff = getEffectiveAportesInPeriod(
          r, 
          reserveTransactions, 
          FIXED_SUGGESTION_PERIOD, 
          FIXED_CUSTOM_RANGE
        );
        return (sugg - eff) > 0;
      }
      if (statusFilter === 'reached') {
        const goal = r.meta_objetivo || 0;
        const bal = r.saldo_atual || 0;
        return goal > 0 && bal >= goal;
      }

      return true;
    });

    // Helper to get pending suggestion for sorting
    const getPendingAmount = (r: Reserve) => {
      const sugg = calculateSuggestion(
        r,
        transactions,
        reserveTransactions,
        FIXED_SUGGESTION_PERIOD,
        FIXED_CUSTOM_RANGE
      );
      const eff = getEffectiveAportesInPeriod(
        r,
        reserveTransactions,
        FIXED_SUGGESTION_PERIOD,
        FIXED_CUSTOM_RANGE
      );
      return Math.max(0, Math.round((sugg - eff) * 100) / 100);
    };

    // Sort: reserves with suggestions first (descending by suggestion amount), then alphabetical
    return list.sort((a, b) => {
      const pendA = getPendingAmount(a);
      const pendB = getPendingAmount(b);

      if (pendA > 0 && pendB <= 0) return -1;
      if (pendB > 0 && pendA <= 0) return 1;
      if (pendA > 0 && pendB > 0) {
        if (pendB !== pendA) return pendB - pendA;
      }

      return a.name.localeCompare(b.name);
    });
  }, [activeReserves, searchTerm, statusFilter, transactions, reserveTransactions]);

  // ----------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------

  // 1. Execute Batch Mass Aporte
  const handleExecuteBatch = async (batchData: {
    items: { reserve_id: string; amount: number; name: string }[];
    date: string;
    description: string;
  }) => {
    try {
      setIsSubmittingBatch(true);
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let totalSum = 0;

      for (const item of batchData.items) {
        const cleanAmount = Math.round(item.amount * 100) / 100;
        if (cleanAmount <= 0) continue;
        totalSum += cleanAmount;

        await addReserveTransaction({
          reserve_id: item.reserve_id,
          type: 'aporte',
          amount: cleanAmount,
          date: batchData.date,
          description: `[Consolidador em Massa] ${batchData.description}`,
          source: 'mass_contribution',
          batch_id: batchId
        }, { silent: true });

        // Update reserve balance
        const res = reserves.find(r => r.id === item.reserve_id);
        if (res) {
          const newBal = Math.round(((res.saldo_atual || 0) + cleanAmount) * 100) / 100;
          await updateReserve(item.reserve_id, { saldo_atual: newBal });
        }
      }

      totalSum = Math.round(totalSum * 100) / 100;
      toast.success(`Aporte em lote de ${formatCurrency(totalSum)} efetivado em ${batchData.items.length} reservas!`);
      setShowMassAporteModal(false);
      if (refreshData) await refreshData(true);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao efetivar lote: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // 2. Direct single suggestion aporte (opens confirmation modal with prefilled data)
  const handleApplyDirectSuggestion = (reserve: Reserve, amount: number) => {
    setSelectedReserveForAction(reserve);
    setAporteInitialAmount(Math.round(amount * 100) / 100);
    setAporteInitialDesc(`[Aporte Sugerido] Regra calculada: ${reserve.name}`);
    setIsSuggestionAporte(true);
    setActionModalType('aporte_manual');
  };

  // 3. Manual Individual Aporte
  const handleAporteManualSubmit = async (data: {
    amount: number;
    date: string;
    description: string;
  }) => {
    if (!selectedReserveForAction) return;
    const res = selectedReserveForAction;
    const cleanAmount = Math.round(data.amount * 100) / 100;

    await addReserveTransaction({
      reserve_id: res.id,
      type: 'aporte',
      amount: cleanAmount,
      date: data.date,
      description: data.description || `[Aporte Manual] ${res.name}`,
      source: 'manual'
    });

    const newBal = Math.round(((res.saldo_atual || 0) + cleanAmount) * 100) / 100;
    await updateReserve(res.id, { saldo_atual: newBal });

    toast.success(`Aporte de ${formatCurrency(cleanAmount)} confirmado em ${res.name}!`);
    if (refreshData) await refreshData(true);
  };

  // 4. Withdraw / Utilizacao Submit
  const handleWithdrawSubmit = async (data: {
    amount: number;
    date: string;
    category: string;
    description: string;
    payment_status?: 'paid' | 'pending';
    payment_date?: string | null;
    due_date?: string | null;
    is_recurring?: boolean;
    recurrence_frequency?: RecurrenceFrequency;
    recurrence_installments?: number;
    generate_future?: boolean;
  }) => {
    if (!selectedReserveForAction) return;
    const res = selectedReserveForAction;
    const cleanAmount = Math.round(data.amount * 100) / 100;
    const isPaid = (data.payment_status || 'paid') === 'paid';
    const isRecurring = Boolean(data.is_recurring);
    const frequency = data.recurrence_frequency || 'monthly';
    const totalInstallments = Math.max(2, Math.min(60, Number(data.recurrence_installments) || 12));
    const shouldGenerateFuture = isRecurring && Boolean(data.generate_future);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (isRecurring && shouldGenerateFuture && userId) {
      const recurrenceGroupId = generateUUID();
      const firstTxId = generateUUID();
      const firstDesc = `${data.description} (1/${totalInstallments})`;

      const firstRt: ReserveTransaction = {
        id: firstTxId,
        user_id: userId,
        reserve_id: res.id,
        type: 'utilizacao',
        amount: cleanAmount,
        date: data.date,
        category: data.category,
        description: firstDesc,
        payment_status: data.payment_status || 'paid',
        payment_date: isPaid ? (data.payment_date || data.date) : null,
        due_date: !isPaid ? (data.due_date || data.date) : null,
        is_recurring: true,
        recurrence_frequency: frequency,
        recurrence_installments: totalInstallments,
        recurrence_group_id: recurrenceGroupId,
        installment_number: 1,
        installment_total: totalInstallments,
        installment_index: 1,
        total_installments: totalInstallments,
        created_at: new Date().toISOString(),
      };

      const futureTxs: ReserveTransaction[] = [];
      for (let i = 2; i <= totalInstallments; i++) {
        const futureDate = calculateNextOccurrence(data.date, frequency, i - 1);
        const futureRt: ReserveTransaction = {
          id: generateUUID(),
          user_id: userId,
          reserve_id: res.id,
          type: 'utilizacao',
          amount: cleanAmount,
          date: futureDate,
          category: data.category,
          description: `${data.description} (${i}/${totalInstallments})`,
          payment_status: 'pending',
          payment_date: null,
          due_date: futureDate,
          is_recurring: true,
          recurrence_frequency: frequency,
          recurrence_installments: totalInstallments,
          recurrence_group_id: recurrenceGroupId,
          installment_number: i,
          installment_total: totalInstallments,
          installment_index: i,
          total_installments: totalInstallments,
          created_at: new Date().toISOString(),
        };
        futureTxs.push(futureRt);
      }

      const allNewRts = [firstRt, ...futureTxs];

      // Optimistic update
      setReserveTransactions(prev => {
        const nextState = [...allNewRts, ...prev];
        cacheManager.set(`reserve_transactions_${userId}`, nextState, undefined, 'reserves');
        return nextState;
      });

      // Enqueue syncs
      allNewRts.forEach(rt => {
        syncQueueManager.enqueue('reserve_transactions', 'insert', rt.id, {
          reserve_id: rt.reserve_id,
          type: rt.type,
          amount: rt.amount,
          date: rt.date,
          category: rt.category,
          description: rt.description,
          payment_status: rt.payment_status,
          payment_date: rt.payment_date,
          due_date: rt.due_date,
          is_recurring: rt.is_recurring,
          recurrence_frequency: rt.recurrence_frequency,
          recurrence_installments: rt.recurrence_installments,
          recurrence_group_id: rt.recurrence_group_id,
          installment_number: rt.installment_number,
          installment_total: rt.installment_total,
          created_at: rt.created_at,
        });
      });

      if (isPaid) {
        const newBal = Math.max(0, Math.round(((res.saldo_atual || 0) - cleanAmount) * 100) / 100);
        await updateReserve(res.id, { saldo_atual: newBal });
      }

      toast.success(`Resgate recorrente criado (${totalInstallments} parcelas programadas)!`);
    } else {
      await addReserveTransaction({
        reserve_id: res.id,
        type: 'utilizacao',
        amount: cleanAmount,
        date: data.date,
        category: data.category,
        description: data.description,
        source: 'manual',
        payment_status: data.payment_status || 'paid',
        payment_date: isPaid ? (data.payment_date || data.date) : null,
        due_date: !isPaid ? (data.due_date || data.date) : null,
        is_recurring: isRecurring,
        recurrence_frequency: isRecurring ? frequency : undefined,
        recurrence_installments: isRecurring ? totalInstallments : undefined,
      });

      if (isPaid) {
        const newBal = Math.max(0, Math.round(((res.saldo_atual || 0) - cleanAmount) * 100) / 100);
        await updateReserve(res.id, { saldo_atual: newBal });
      }

      toast.success(`Resgate de ${formatCurrency(cleanAmount)} registrado com sucesso!`);
    }

    if (refreshData) await refreshData(true);
  };

  // 5. Update Balance / Rendimento Submit
  const handleUpdateBalanceSubmit = async (data: {
    newBalance: number;
    date: string;
    type: 'rendimento' | 'aporte' | 'ajuste';
    description: string;
  }) => {
    if (!selectedReserveForAction) return;
    const res = selectedReserveForAction;
    const currentBal = Math.round((res.saldo_atual || 0) * 100) / 100;
    const cleanNewBal = Math.round(data.newBalance * 100) / 100;
    const diff = Math.round((cleanNewBal - currentBal) * 100) / 100;

    if (diff !== 0) {
      await addReserveTransaction({
        reserve_id: res.id,
        type: diff > 0 ? 'rendimento' : 'utilizacao',
        amount: Math.abs(diff),
        date: data.date,
        description: `[Rendimento/Ajuste] ${data.description}`,
        source: 'manual'
      });
    }

    await updateReserve(res.id, { saldo_atual: cleanNewBal });
    toast.success(`Saldo atualizado para ${formatCurrency(cleanNewBal)}!`);
    if (refreshData) await refreshData(true);
  };

  // 6. Create or Edit Reserve
  const handleSaveReserve = async (reserveData: Partial<Reserve>, initialBalance?: number) => {
    if (reserveToEdit) {
      await updateReserve(reserveToEdit.id, reserveData);
      toast.success('Reserva atualizada com sucesso!');
    } else {
      const payload: Omit<Reserve, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
        name: reserveData.name || 'Nova Reserva',
        description: reserveData.description || '',
        saldo_inicial: initialBalance || 0,
        saldo_atual: initialBalance || 0,
        meta_objetivo: reserveData.meta_objetivo || 0,
        icon: reserveData.icon || 'PiggyBank',
        color: reserveData.color || '#6366f1',
        regra_ativa: !!reserveData.regra_ativa,
        regra_tipo: reserveData.regra_tipo,
        regra_valor: reserveData.regra_valor,
        regra_categorias: reserveData.regra_categorias || [],
        require_category_on_use: reserveData.require_category_on_use,
        default_use_category: reserveData.default_use_category,
        status: 'active',
        is_paused: false
      };

      await addReserve(payload);
      toast.success('Nova reserva criada com sucesso!');
    }
  };

  // 6b. Update Rule directly with temporal rule archiving
  const handleSaveRule = async (reserveId: string, ruleData: Partial<Reserve>) => {
    const currentRes = reserves.find(r => r.id === reserveId);
    if (!currentRes) {
      await updateReserve(reserveId, ruleData);
      return;
    }

    const effectiveDate = ruleData.regra_inicio_validade || new Date().toISOString().split('T')[0];
    const hadPrevRule = Boolean(currentRes.regra_tipo && currentRes.regra_valor);
    let updatedHistory = [...(currentRes.rule_history || [])];

    if (hadPrevRule && (currentRes.regra_tipo !== ruleData.regra_tipo || currentRes.regra_valor !== ruleData.regra_valor || currentRes.regra_ativa !== ruleData.regra_ativa)) {
      const prevStartDate = currentRes.regra_inicio_validade || currentRes.created_at?.split('T')[0] || effectiveDate;
      const typeLabel = currentRes.regra_tipo === 'km' 
        ? `R$ ${currentRes.regra_valor}/km` 
        : currentRes.regra_tipo === 'bruto' 
        ? `${currentRes.regra_valor}% Faturamento Bruto` 
        : currentRes.regra_tipo === 'liquido' 
        ? `${currentRes.regra_valor}% Lucro Líquido` 
        : `R$ ${currentRes.regra_valor}/dia`;

      updatedHistory.push({
        start_date: prevStartDate,
        end_date: effectiveDate,
        regra_tipo: currentRes.regra_tipo,
        regra_valor: currentRes.regra_valor,
        regra_categorias: currentRes.regra_categorias || [],
        regra_ativa: currentRes.regra_ativa,
        updated_at: new Date().toISOString(),
        description: `Regra anterior: ${typeLabel}`
      });
    }

    const payload: Partial<Reserve> = {
      ...ruleData,
      regra_inicio_validade: effectiveDate,
      rule_history: updatedHistory
    };

    await updateReserve(reserveId, payload);
    toast.success('Regra da reserva atualizada com sucesso!');
    if (refreshData) await refreshData(true);
  };

  // 7. Toggle Pause/Play automation
  const handleTogglePause = async (res: Reserve) => {
    const isNowPaused = !res.is_paused;
    await updateReserve(res.id, { is_paused: isNowPaused });
    toast.success(isNowPaused ? `Automação de "${res.name}" pausada.` : `Automação de "${res.name}" reativada!`);
  };

  // 8. Finalize / Deactivate Reserve
  const handleFinalize = async (res: Reserve) => {
    if (confirm(`Deseja pausar/inativar a reserva "${res.name}"?`)) {
      await updateReserve(res.id, { status: 'inactive', is_paused: true });
      toast.success(`Reserva "${res.name}" inativada.`);
    }
  };

  // 9. Delete Reserve
  const handleDeleteReserve = async (res: Reserve) => {
    if (confirm(`ATENÇÃO: Deseja realmente excluir a reserva "${res.name}" e todo o histórico vinculado?`)) {
      await deleteReserve(res.id);
      toast.success(`Reserva "${res.name}" excluída.`);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Top Header with Global KPIs and Main Controls */}
      <ReservesHeader
        totalBalance={totals.totalBalance}
        totalGoal={totals.totalGoal}
        totalPendingSuggestion={totals.totalPendingSuggestion}
        totalYield={totals.totalYield}
        activeCount={totals.activeCount}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCreate={() => {
          setReserveToEdit(null);
          setShowCreateEditModal(true);
        }}
        onOpenMassAporte={() => setShowMassAporteModal(true)}
        hideValues={hideValues}
        setHideValues={setHideValues}
      />

      {/* Main Tab Content */}
      {activeTab === 'cards' ? (
        <div className="space-y-4 text-left">
          {/* Sub-header Filter & Search bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/80 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar reserva..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs rounded-xl"
              />
            </div>

            <div className="flex items-center gap-1 shrink-0 bg-muted/40 p-1 rounded-xl border border-border/80 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                }`}
              >
                Todas ({activeReserves.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('with_pending')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'with_pending' ? 'bg-card text-amber-600 dark:text-amber-400 shadow-xs' : 'text-muted-foreground'
                }`}
              >
                C/ Pendência
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('reached')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'reached' ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-muted-foreground'
                }`}
              >
                Meta Batida
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          {filteredCards.length === 0 ? (
            <div className="p-12 text-center bg-card border border-dashed border-border rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <PiggyBank className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">Nenhuma reserva encontrada</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Crie reservas financeiras para blindar suas metas, manutenção veicular, impostos e emergências.
              </p>
              <Button
                onClick={() => {
                  setReserveToEdit(null);
                  setShowCreateEditModal(true);
                }}
                className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5"
              >
                <Plus className="w-4 h-4" /> Criar Primeira Reserva
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCards.map(res => (
                <ReserveCard
                  key={res.id}
                  reserve={res}
                  reserveTransactions={reserveTransactions}
                  transactions={transactions}
                  globalPeriod={FIXED_SUGGESTION_PERIOD}
                  customDateRange={FIXED_CUSTOM_RANGE}
                  onAporteManual={r => {
                    setSelectedReserveForAction(r);
                    setActionModalType('aporte_manual');
                  }}
                  onWithdraw={r => {
                    setSelectedReserveForAction(r);
                    setActionModalType('withdraw');
                  }}
                  onUpdateBalance={r => {
                    setSelectedReserveForAction(r);
                    setActionModalType('update_balance');
                  }}
                  onEdit={r => {
                    setReserveToEdit(r);
                    setShowCreateEditModal(true);
                  }}
                  onUpdateRule={r => {
                    setReserveToUpdateRule(r);
                    setShowUpdateRuleModal(true);
                  }}
                  onTogglePause={handleTogglePause}
                  onFinalize={handleFinalize}
                  onDelete={handleDeleteReserve}
                  onApplyDirectSuggestion={handleApplyDirectSuggestion}
                  hideValues={hideValues}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* History & Extrato Tab */
        <ReserveHistoryTab
          reserves={reserves}
          transactions={transactions}
          reserveTransactions={reserveTransactions}
          settings={settings}
          onDeleteTransaction={deleteReserveTransaction}
          onEditTransaction={updateReserveTransaction}
          onUpdateReserve={updateReserve}
          hideValues={hideValues}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* MODALS */}
      {/* ---------------------------------------------------- */}

      {/* 1. Modal Consolidador de Aporte em Massa */}
      {showMassAporteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-5xl my-auto animate-in fade-in zoom-in-95 duration-200">
            <MassAporteConsolidator
              reserves={reserves}
              reserveTransactions={reserveTransactions}
              transactions={transactions}
              globalPeriod={FIXED_SUGGESTION_PERIOD}
              customDateRange={FIXED_CUSTOM_RANGE}
              isSubmitting={isSubmittingBatch}
              onExecuteBatch={handleExecuteBatch}
              onClose={() => setShowMassAporteModal(false)}
              isModal={true}
            />
          </div>
        </div>
      )}

      {/* 2. Modal Criar / Editar Reserva */}
      <ReserveModal
        isOpen={showCreateEditModal}
        onClose={() => {
          setShowCreateEditModal(false);
          setReserveToEdit(null);
        }}
        reserveToEdit={reserveToEdit}
        transactions={transactions}
        settings={settings}
        onSave={handleSaveReserve}
      />

      {/* 2b. Modal Dedicado de Atualização de Regra */}
      <UpdateRuleModal
        isOpen={showUpdateRuleModal}
        onClose={() => {
          setShowUpdateRuleModal(false);
          setReserveToUpdateRule(null);
        }}
        reserve={reserveToUpdateRule}
        transactions={transactions}
        reserveTransactions={reserveTransactions}
        settings={settings}
        globalPeriod={FIXED_SUGGESTION_PERIOD}
        customDateRange={FIXED_CUSTOM_RANGE}
        onSaveRule={handleSaveRule}
      />

      {/* 3. Modal Aporte Manual Individual com Confirmação */}
      <AporteManualModal
        isOpen={actionModalType === 'aporte_manual'}
        reserve={selectedReserveForAction}
        initialAmount={aporteInitialAmount}
        initialDescription={aporteInitialDesc}
        isSuggestion={isSuggestionAporte}
        onClose={() => {
          setActionModalType(null);
          setSelectedReserveForAction(null);
          setAporteInitialAmount(undefined);
          setAporteInitialDesc(undefined);
          setIsSuggestionAporte(false);
        }}
        onSubmit={handleAporteManualSubmit}
      />

      {/* 4. Modal Resgate / Utilização */}
      <WithdrawModal
        isOpen={actionModalType === 'withdraw'}
        reserve={selectedReserveForAction}
        settings={settings}
        onClose={() => {
          setActionModalType(null);
          setSelectedReserveForAction(null);
        }}
        onSubmit={handleWithdrawSubmit}
      />

      {/* 5. Modal Atualização de Saldo & Rendimento */}
      <UpdateBalanceModal
        isOpen={actionModalType === 'update_balance'}
        reserve={selectedReserveForAction}
        onClose={() => {
          setActionModalType(null);
          setSelectedReserveForAction(null);
        }}
        onSubmit={handleUpdateBalanceSubmit}
      />

      {/* 6. Modal Histórico de Regras & Auditoria */}
      <RuleHistoryModal
        isOpen={actionModalType === 'rule_history'}
        reserve={selectedReserveForAction}
        onClose={() => {
          setActionModalType(null);
          setSelectedReserveForAction(null);
        }}
        transactions={transactions}
        reserveTransactions={reserveTransactions}
        globalPeriod={FIXED_SUGGESTION_PERIOD}
        customDateRange={FIXED_CUSTOM_RANGE}
      />
    </div>
  );
}

export default Reserves;
