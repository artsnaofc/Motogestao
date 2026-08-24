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
  parseLocalDate 
} from '../components/reserves/reserveUtils';
import { ReservesHeader } from '../components/reserves/ReservesHeader';
import { ReserveCard } from '../components/reserves/ReserveCard';
import { MassAporteConsolidator } from '../components/reserves/MassAporteConsolidator';
import { ReserveHistoryTab } from '../components/reserves/ReserveHistoryTab';
import { ReserveModal } from '../components/reserves/ReserveModal';
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
    addReserve,
    updateReserve,
    deleteReserve,
    addReserveTransaction,
    deleteReserveTransaction,
    refreshData,
    globalPeriod = 'month',
    setGlobalPeriod,
    customDateRange = { start: '', end: '' }
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

  const [selectedReserveForAction, setSelectedReserveForAction] = useState<Reserve | null>(null);
  const [actionModalType, setActionModalType] = useState<'aporte_manual' | 'withdraw' | 'update_balance' | 'rule_history' | null>(null);

  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  // Active non-archived reserves
  const activeReserves = useMemo(() => {
    return (reserves || []).filter(r => r.status !== 'inactive');
  }, [reserves]);

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
        globalPeriod, 
        customDateRange || { start: '', end: '' }
      );
      const effectiveAportes = getEffectiveAportesInPeriod(
        r, 
        reserveTransactions, 
        globalPeriod, 
        customDateRange || { start: '', end: '' }
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
  }, [activeReserves, transactions, reserveTransactions, globalPeriod, customDateRange]);

  // Filtered reserves list for cards
  const filteredCards = useMemo(() => {
    return activeReserves.filter(r => {
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
          globalPeriod, 
          customDateRange || { start: '', end: '' }
        );
        const eff = getEffectiveAportesInPeriod(
          r, 
          reserveTransactions, 
          globalPeriod, 
          customDateRange || { start: '', end: '' }
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
  }, [activeReserves, searchTerm, statusFilter, transactions, reserveTransactions, globalPeriod, customDateRange]);

  // Helper to record expense transaction in general cashflow
  const registerCashflowExpense = async (amount: number, date: string, category: string, description: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      await supabase.from('transactions').insert({
        user_id: userData.user.id,
        type: 'expense',
        amount,
        date,
        category: category || 'Aporte Reserva',
        description,
        is_reserve_use: true,
        created_at: new Date().toISOString()
      });
      if (refreshData) await refreshData(true);
    } catch (err) {
      console.warn('Could not insert cashflow transaction:', err);
    }
  };

  // ----------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------

  // 1. Execute Batch Mass Aporte
  const handleExecuteBatch = async (batchData: {
    items: { reserve_id: string; amount: number; name: string }[];
    date: string;
    description: string;
    createCashflowExpense?: boolean;
    cashflowCategory?: string;
  }) => {
    try {
      setIsSubmittingBatch(true);
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let totalSum = 0;

      for (const item of batchData.items) {
        if (item.amount <= 0) continue;
        totalSum += item.amount;

        await addReserveTransaction({
          reserve_id: item.reserve_id,
          type: 'aporte',
          amount: item.amount,
          date: batchData.date,
          description: `[Consolidador em Massa] ${batchData.description}`,
          source: 'mass_contribution',
          batch_id: batchId
        });

        // Update reserve balance
        const res = reserves.find(r => r.id === item.reserve_id);
        if (res) {
          const newBal = (res.saldo_atual || 0) + item.amount;
          await updateReserve(item.reserve_id, { saldo_atual: newBal });
        }
      }

      // If user selected to register a cashflow expense
      if (batchData.createCashflowExpense && totalSum > 0) {
        await registerCashflowExpense(
          totalSum, 
          batchData.date, 
          batchData.cashflowCategory || 'Aporte Reserva',
          `[Aporte Consolidado em Reservas] ${batchData.description}`
        );
      }

      toast.success(`Aporte em lote de ${formatCurrency(totalSum)} efetivado em ${batchData.items.length} reservas!`);
      setShowMassAporteModal(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao efetivar lote: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // 2. Direct single 1-click suggestion aporte
  const handleApplyDirectSuggestion = async (reserve: Reserve, amount: number) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await addReserveTransaction({
        reserve_id: reserve.id,
        type: 'aporte',
        amount: amount,
        date: today,
        description: `[Aporte Manual] Regra sugerida: ${reserve.name}`,
        source: 'manual'
      });

      const newBal = (reserve.saldo_atual || 0) + amount;
      await updateReserve(reserve.id, { saldo_atual: newBal });
      toast.success(`Aporte sugerido de ${formatCurrency(amount)} aplicado em ${reserve.name}!`);
    } catch (err: any) {
      toast.error('Erro ao aplicar aporte: ' + err.message);
    }
  };

  // 3. Manual Individual Aporte
  const handleAporteManualSubmit = async (data: {
    amount: number;
    date: string;
    description: string;
    createCashflowExpense: boolean;
  }) => {
    if (!selectedReserveForAction) return;
    const res = selectedReserveForAction;

    await addReserveTransaction({
      reserve_id: res.id,
      type: 'aporte',
      amount: data.amount,
      date: data.date,
      description: `[Aporte Manual] ${data.description}`,
      source: 'manual'
    });

    const newBal = (res.saldo_atual || 0) + data.amount;
    await updateReserve(res.id, { saldo_atual: newBal });

    if (data.createCashflowExpense) {
      await registerCashflowExpense(
        data.amount,
        data.date,
        'Aporte Reserva',
        `[Aporte Manual] ${res.name} - ${data.description}`
      );
    }

    toast.success(`Aporte manual de ${formatCurrency(data.amount)} registrado!`);
  };

  // 4. Withdraw / Utilizacao Submit
  const handleWithdrawSubmit = async (data: {
    amount: number;
    date: string;
    category: string;
    description: string;
  }) => {
    if (!selectedReserveForAction) return;
    const res = selectedReserveForAction;

    await addReserveTransaction({
      reserve_id: res.id,
      type: 'utilizacao',
      amount: data.amount,
      date: data.date,
      category: data.category,
      description: data.description,
      source: 'manual'
    });

    const newBal = Math.max(0, (res.saldo_atual || 0) - data.amount);
    await updateReserve(res.id, { saldo_atual: newBal });

    toast.success(`Resgate de ${formatCurrency(data.amount)} registrado com sucesso!`);
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
    const currentBal = res.saldo_atual || 0;
    const diff = Number((data.newBalance - currentBal).toFixed(2));

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

    await updateReserve(res.id, { saldo_atual: data.newBalance });
    toast.success(`Saldo atualizado para ${formatCurrency(data.newBalance)}!`);
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
        status: 'active',
        is_paused: false
      };

      await addReserve(payload);
      toast.success('Nova reserva criada com sucesso!');
    }
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
        globalPeriod={globalPeriod}
        setGlobalPeriod={setGlobalPeriod}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCreate={() => {
          setReserveToEdit(null);
          setShowCreateEditModal(true);
        }}
        onOpenMassAporte={() => setShowMassAporteModal(true)}
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
                  globalPeriod={globalPeriod}
                  customDateRange={customDateRange || { start: '', end: '' }}
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
                  onTogglePause={handleTogglePause}
                  onFinalize={handleFinalize}
                  onDelete={handleDeleteReserve}
                  onViewRuleHistory={r => {
                    setSelectedReserveForAction(r);
                    setActionModalType('rule_history');
                  }}
                  onApplyDirectSuggestion={handleApplyDirectSuggestion}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* History & Extrato Tab */
        <ReserveHistoryTab
          reserves={reserves}
          reserveTransactions={reserveTransactions}
          onDeleteTransaction={deleteReserveTransaction}
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
              globalPeriod={globalPeriod}
              customDateRange={customDateRange || { start: '', end: '' }}
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
        onSave={handleSaveReserve}
      />

      {/* 3. Modal Aporte Manual Individual */}
      <AporteManualModal
        isOpen={actionModalType === 'aporte_manual'}
        reserve={selectedReserveForAction}
        onClose={() => {
          setActionModalType(null);
          setSelectedReserveForAction(null);
        }}
        onSubmit={handleAporteManualSubmit}
      />

      {/* 4. Modal Resgate / Utilização */}
      <WithdrawModal
        isOpen={actionModalType === 'withdraw'}
        reserve={selectedReserveForAction}
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
        globalPeriod={globalPeriod}
        customDateRange={customDateRange || { start: '', end: '' }}
      />
    </div>
  );
}

export default Reserves;
