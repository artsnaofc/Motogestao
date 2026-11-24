import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { supabase } from '../lib/supabase';
import { getEffectiveUserId } from '../lib/authUtils';
import { 
  PiggyBank, 
  Plus, 
  Search, 
  RefreshCw,
  Zap,
  Tag,
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  PauseCircle,
  PlayCircle,
  Rocket,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Reserve, ReserveTransaction, Transaction } from '../types';
import { 
  formatCurrency, 
  calculateSuggestion, 
  getEffectiveAportesInPeriod,
  calculateReserveGoalProjection,
  calculateReserveYieldStats,
  isReserveBoostActive,
  getRuleBoostDeltaLabel,
  getBoostSpeedupComparison,
  parseLocalDate,
  generateUUID,
  calculateNextOccurrence,
  RecurrenceFrequency,
  getTodayLocalDateStr,
  toDateInputString,
  calculateReserveWeeklyProgress
} from '../components/reserves/reserveUtils';
import { cacheManager } from '../lib/cacheManager';
import { syncQueueManager } from '../lib/syncQueue';
import { ReservesHeader } from '../components/reserves/ReservesHeader';
import { ReserveCard } from '../components/reserves/ReserveCard';
import { MassAporteConsolidator } from '../components/reserves/MassAporteConsolidator';
import { ReserveHistoryTab } from '../components/reserves/ReserveHistoryTab';
import { ReserveModal } from '../components/reserves/ReserveModal';
import { UpdateRuleModal } from '../components/reserves/UpdateRuleModal';
import { SuggestionAuditModal } from '../components/reserves/SuggestionAuditModal';
import { ModoBoostModal } from '../components/reserves/ModoBoostModal';
import { WeeklyGoalsModal } from '../components/reserves/WeeklyGoalsModal';
import { 
  AporteManualModal, 
  WithdrawModal, 
  UpdateBalanceModal, 
  RuleHistoryModal 
} from '../components/reserves/QuickActionModals';
import { toast } from '@/lib/toast';

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

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const getInitialTab = (): 'cards' | 'history' => {
    const tabParam = searchParams.get('tab') || (location.state as any)?.tab;
    if (tabParam) {
      const norm = String(tabParam).toLowerCase().trim();
      if (norm === 'history' || norm === 'movimentacoes' || norm === 'movimentações' || norm === 'extrato') {
        return 'history';
      }
    }
    return 'cards';
  };

  // Active view tab: 'cards' or 'history'
  const [activeTab, setActiveTab] = useState<'cards' | 'history'>(getInitialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab') || (location.state as any)?.tab;
    if (tabParam) {
      const norm = String(tabParam).toLowerCase().trim();
      if (norm === 'history' || norm === 'movimentacoes' || norm === 'movimentações' || norm === 'extrato') {
        setActiveTab('history');
      } else if (norm === 'cards' || norm === 'reservas') {
        setActiveTab('cards');
      }
    }
  }, [searchParams, location.state]);

  const handleTabChange = (tab: 'cards' | 'history') => {
    setActiveTab(tab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab === 'cards') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    }, { replace: true });
  };

  // Search, Filter & Sort in Cards
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'with_pending' | 'reached' | 'paused' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'pending' | 'urgency' | 'proximity' | 'balance' | 'alpha'>('pending');

  // Modals state
  const [showMassAporteModal, setShowMassAporteModal] = useState(false);
  const [showCreateEditModal, setShowCreateEditModal] = useState(false);
  const [reserveToEdit, setReserveToEdit] = useState<Reserve | null>(null);

  const [showUpdateRuleModal, setShowUpdateRuleModal] = useState(false);
  const [reserveToUpdateRule, setReserveToUpdateRule] = useState<Reserve | null>(null);

  const [showModoBoostModal, setShowModoBoostModal] = useState(false);
  const [boostFocusReserveId, setBoostFocusReserveId] = useState<string | null>(null);
  const [showWeeklyGoalsModal, setShowWeeklyGoalsModal] = useState(false);

  const [auditReserve, setAuditReserve] = useState<Reserve | null>(null);

  const [selectedReserveForAction, setSelectedReserveForAction] = useState<Reserve | null>(null);
  const [actionModalType, setActionModalType] = useState<'aporte_manual' | 'withdraw' | 'update_balance' | 'rule_history' | null>(null);
  const [withdrawInitialMode, setWithdrawInitialMode] = useState<'expense' | 'transfer_to_cash'>('expense');
  const [aporteInitialAmount, setAporteInitialAmount] = useState<number | undefined>(undefined);
  const [aporteInitialDesc, setAporteInitialDesc] = useState<string | undefined>(undefined);
  const [isSuggestionAporte, setIsSuggestionAporte] = useState<boolean>(false);

  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  const [confirmReserveAction, setConfirmReserveAction] = useState<{
    type: 'deactivate' | 'reactivate' | 'pause' | 'unpause' | 'boost_on' | 'boost_off' | 'delete';
    reserve: Reserve;
  } | null>(null);
  const [confirmingReserveAction, setConfirmingReserveAction] = useState(false);

  // Active non-archived reserves
  const activeReserves = useMemo(() => {
    return (reserves || []).filter(r => r.status !== 'inactive');
  }, [reserves]);

  // Inactive reserves
  const inactiveReserves = useMemo(() => {
    return (reserves || []).filter(r => r.status === 'inactive');
  }, [reserves]);

  // Suggestion calculation uses a fixed standard period ('month') to prevent value divergence
  const FIXED_SUGGESTION_PERIOD = 'month';
  const FIXED_CUSTOM_RANGE = { start: '', end: '' };

  // Paused reserves count (active status, paused automation)
  const pausedReservesCount = useMemo(() => {
    return activeReserves.filter(r => r.is_paused).length;
  }, [activeReserves]);

  // Boost active count
  const boostActiveCount = useMemo(() => {
    return activeReserves.filter(r => isReserveBoostActive(r)).length;
  }, [activeReserves]);

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

    const totalYield = Math.round(
      (reserveTransactions || [])
        .filter(rt => rt.type === 'rendimento' && rt.payment_status !== 'pending' && (rt as any).status !== 'pending')
        .reduce((sum, rt) => sum + Number(rt.amount || 0), 0) * 100
    ) / 100;

    let totalDepositedBase = 0;
    let topYieldReserve: { name: string; yieldAmount: number; yieldPct: number } | null = null;
    (reserves || []).forEach(r => {
      const stats = calculateReserveYieldStats(r, reserveTransactions);
      totalDepositedBase += stats.depositedBase;
      if (stats.yieldAmount > 0 && (!topYieldReserve || stats.yieldAmount > topYieldReserve.yieldAmount)) {
        topYieldReserve = {
          name: r.name,
          yieldAmount: stats.yieldAmount,
          yieldPct: stats.yieldPct,
        };
      }
    });

    const yieldPct = totalDepositedBase > 0 && totalYield > 0
      ? Math.round((totalYield / totalDepositedBase) * 1000) / 10
      : 0;

    return {
      totalBalance,
      totalGoal,
      totalPendingSuggestion,
      totalYield,
      yieldPct,
      topYieldReserve,
      activeCount: activeReserves.filter(r => !r.is_paused).length
    };
  }, [activeReserves, reserves, transactions, reserveTransactions]);

  // Consolidated weekly contribution progress across active non-paused reserves
  const weeklySummary = useMemo(() => {
    let weeklyTotalTarget = 0;
    let weeklyTotalAported = 0;
    let weeklyGoalCount = 0;
    let weeklyRangeLabel = '';

    activeReserves.forEach(r => {
      const wp = calculateReserveWeeklyProgress(r, transactions, reserveTransactions);
      if (!weeklyRangeLabel) weeklyRangeLabel = wp.weekRangeLabel;
      if (r.is_paused) return;

      if (wp.hasTarget) {
        weeklyTotalTarget += wp.weeklyTarget;
        weeklyTotalAported += wp.weeklyCountedAportes;
        weeklyGoalCount += 1;
      } else if (wp.mode !== 'off' && wp.weeklyTotalAportes > 0) {
        weeklyTotalAported += wp.weeklyCountedAportes;
      }
    });

    return {
      weeklyTotalTarget: Math.round(weeklyTotalTarget * 100) / 100,
      weeklyTotalAported: Math.round(weeklyTotalAported * 100) / 100,
      weeklyGoalCount,
      weeklyRangeLabel,
    };
  }, [activeReserves, transactions, reserveTransactions]);

  // Filtered reserves list for cards with configurable sorting
  const filteredCards = useMemo(() => {
    const baseList = statusFilter === 'inactive' ? inactiveReserves : activeReserves;
    const list = baseList.filter(r => {
      // Search
      const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (r.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // Status
      if (statusFilter === 'active') {
        return !r.is_paused && r.status !== 'inactive';
      }
      if (statusFilter === 'paused') {
        return Boolean(r.is_paused) && r.status !== 'inactive';
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
      if (statusFilter === 'inactive') {
        return true;
      }

      return true;
    });

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

    const getGoalProgress = (r: Reserve) => {
      const goal = Number(r.meta_objetivo || 0);
      const bal = Number(r.saldo_atual || 0);
      if (goal <= 0) return -1;
      return bal / goal;
    };

    return [...list].sort((a, b) => {
      if (sortBy === 'urgency') {
        const projA = calculateReserveGoalProjection(a, transactions, reserveTransactions);
        const projB = calculateReserveGoalProjection(b, transactions, reserveTransactions);
        const daysA = projA.hasGoal && !projA.isReached && projA.estimatedDays !== null ? projA.estimatedDays : Number.MAX_SAFE_INTEGER;
        const daysB = projB.hasGoal && !projB.isReached && projB.estimatedDays !== null ? projB.estimatedDays : Number.MAX_SAFE_INTEGER;
        if (daysA !== daysB) return daysA - daysB;
        const progA = getGoalProgress(a);
        const progB = getGoalProgress(b);
        if (progA !== progB) return progB - progA;
        return a.name.localeCompare(b.name);
      }

      if (sortBy === 'proximity') {
        const progA = getGoalProgress(a);
        const progB = getGoalProgress(b);
        const aUnreached = progA >= 0 && progA < 1;
        const bUnreached = progB >= 0 && progB < 1;
        if (aUnreached && !bUnreached) return -1;
        if (bUnreached && !aUnreached) return 1;
        if (aUnreached && bUnreached && progB !== progA) return progB - progA;
        if (progB !== progA) return progB - progA;
        return a.name.localeCompare(b.name);
      }

      if (sortBy === 'balance') {
        const balDiff = Number(b.saldo_atual || 0) - Number(a.saldo_atual || 0);
        if (Math.abs(balDiff) > 0.009) return balDiff;
        return a.name.localeCompare(b.name);
      }

      if (sortBy === 'alpha') {
        return a.name.localeCompare(b.name);
      }

      // Default 'pending': reserves with suggestions first (descending), then alphabetical
      const pendA = getPendingAmount(a);
      const pendB = getPendingAmount(b);

      if (pendA > 0 && pendB <= 0) return -1;
      if (pendB > 0 && pendA <= 0) return 1;
      if (pendA > 0 && pendB > 0) {
        if (pendB !== pendA) return pendB - pendA;
      }

      return a.name.localeCompare(b.name);
    });
  }, [activeReserves, inactiveReserves, searchTerm, statusFilter, sortBy, transactions, reserveTransactions]);

  // ----------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------

  // 1. Execute Batch Mass Aporte
  const handleExecuteBatch = async (batchData: {
    items: { reserve_id: string; amount: number; name: string; boostExtra?: number }[];
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

        const cleanBoostExtra =
          item.boostExtra && item.boostExtra > 0
            ? Math.round(item.boostExtra * 100) / 100
            : 0;
        const boostSuffix =
          cleanBoostExtra > 0
            ? ` • Boost +R$ ${cleanBoostExtra.toFixed(2).replace('.', ',')}`
            : '';

        await addReserveTransaction({
          reserve_id: item.reserve_id,
          type: 'aporte',
          amount: cleanAmount,
          date: batchData.date,
          description: `[Consolidador em Massa] ${batchData.description}${boostSuffix}`,
          source: 'mass_contribution',
          batch_id: batchId,
          ...(cleanBoostExtra > 0 ? { boost_extra: cleanBoostExtra } : {})
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
    const boostNote = isReserveBoostActive(reserve)
      ? ` • Modo Boost (${getRuleBoostDeltaLabel(reserve)})`
      : '';
    setAporteInitialDesc(`[Aporte Sugerido] Regra calculada: ${reserve.name}${boostNote}`);
    setIsSuggestionAporte(true);
    setActionModalType('aporte_manual');
  };

  // 3. Manual Individual Aporte
  const handleAporteManualSubmit = async (data: {
    amount: number;
    date: string;
    description: string;
    isSuggestion?: boolean;
  }) => {
    if (!selectedReserveForAction) return;
    const res = selectedReserveForAction;
    const cleanAmount = Math.round(data.amount * 100) / 100;
    const isSugg = Boolean(data.isSuggestion ?? isSuggestionAporte);

    let boostExtra = 0;
    if (isSugg && isReserveBoostActive(res)) {
      const baseSug = calculateSuggestion(
        res,
        transactions,
        reserveTransactions,
        FIXED_SUGGESTION_PERIOD,
        FIXED_CUSTOM_RANGE,
        { ignoreBoost: true }
      );
      const baseEff = getEffectiveAportesInPeriod(
        res,
        reserveTransactions,
        FIXED_SUGGESTION_PERIOD,
        FIXED_CUSTOM_RANGE,
        { ignoreBoost: true }
      );
      const basePending = Math.max(0, Math.round((baseSug - baseEff) * 100) / 100);
      boostExtra = Math.max(0, Math.round((cleanAmount - basePending) * 100) / 100);
    }

    const baseDesc =
      data.description ||
      (isSugg ? `[Aporte Sugerido] ${res.name}` : `[Aporte Manual] ${res.name}`);
    const hasBoostTag = /Boost\s*\+R\$/i.test(baseDesc);
    const finalDesc =
      boostExtra > 0 && !hasBoostTag
        ? `${baseDesc} • Boost +R$ ${boostExtra.toFixed(2).replace('.', ',')}`
        : baseDesc;

    await addReserveTransaction({
      reserve_id: res.id,
      type: 'aporte',
      amount: cleanAmount,
      date: data.date,
      category: isSugg ? 'Aporte Sugerido' : 'Aporte Manual',
      description: finalDesc,
      source: isSugg ? 'automation' : 'manual',
      ...(boostExtra > 0 ? { boost_extra: boostExtra } : {})
    });

    const newBal = Math.round(((res.saldo_atual || 0) + cleanAmount) * 100) / 100;
    await updateReserve(res.id, { saldo_atual: newBal });

    toast.success(
      isSugg 
        ? `Aporte sugerido de ${formatCurrency(cleanAmount)} confirmado em ${res.name}!` 
        : `Aporte manual de ${formatCurrency(cleanAmount)} confirmado em ${res.name}!`
    );
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
    ignore_in_charts?: boolean;
  }) => {
    if (!selectedReserveForAction) return;
    const res = selectedReserveForAction;
    const cleanAmount = Math.round(data.amount * 100) / 100;
    const isPaid = (data.payment_status || 'paid') === 'paid';
    const isRecurring = Boolean(data.is_recurring);
    const frequency = data.recurrence_frequency || 'monthly';
    const totalInstallments = Math.max(2, Math.min(60, Number(data.recurrence_installments) || 12));
    const shouldGenerateFuture = isRecurring && Boolean(data.generate_future);
    const ignoreInCharts = Boolean(data.ignore_in_charts);

    const userId = await getEffectiveUserId();

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
        ignore_in_charts: ignoreInCharts,
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
          ignore_in_charts: ignoreInCharts,
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
          id: rt.id,
          user_id: userId,
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
          ignore_in_charts: rt.ignore_in_charts,
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
        ignore_in_charts: ignoreInCharts,
      });

      if (isPaid) {
        const newBal = Math.max(0, Math.round(((res.saldo_atual || 0) - cleanAmount) * 100) / 100);
        await updateReserve(res.id, { saldo_atual: newBal });
      }

      if (data.category === 'Resgate de Reserva' || data.category === 'Resgate Reserva') {
        toast.success(`Transferência de ${formatCurrency(cleanAmount)} para o Caixa realizada com sucesso!`);
      } else {
        toast.success(`Resgate de ${formatCurrency(cleanAmount)} registrado com sucesso!`);
      }
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
      const todayStr = getTodayLocalDateStr();
      const nowIso = new Date().toISOString();
      const prevGoal = Math.round(Number(reserveToEdit.meta_objetivo || 0) * 100) / 100;
      const newGoal = Math.round(Number(reserveData.meta_objetivo || 0) * 100) / 100;
      const goalChanged = Math.abs(newGoal - prevGoal) > 0.009;
      const ruleReenabled = !reserveToEdit.regra_ativa && Boolean(reserveData.regra_ativa);
      const hasActiveRuleAfterSave = Boolean(reserveData.regra_ativa && reserveData.regra_tipo);

      const finalPayload: Partial<Reserve> = { ...reserveData };

      if ((goalChanged || ruleReenabled) && hasActiveRuleAfterSave) {
        const updatedHistory = Array.isArray(reserveToEdit.rule_history) ? [...reserveToEdit.rule_history] : [];
        const rawPrevStart = reserveToEdit.regra_inicio_validade || reserveToEdit.created_at || todayStr;
        const prevStartDate = toDateInputString(rawPrevStart) || todayStr;

        const reasonDesc = goalChanged && ruleReenabled
          ? `Meta alterada (${formatCurrency(prevGoal)} ➔ ${formatCurrency(newGoal)}) e regra ativada (sugestão recalculada a partir de agora)`
          : goalChanged
            ? `Meta alterada (${formatCurrency(prevGoal)} ➔ ${formatCurrency(newGoal)}) — base de sugestão reiniciada`
            : `Regra reativada (sugestão recalculada a partir de agora)`;

        updatedHistory.push({
          start_date: prevStartDate,
          end_date: todayStr,
          cutoff_rule_start: todayStr,
          cutoff_at: nowIso,
          action_type: goalChanged ? 'goal_change' : 'unpause',
          regra_tipo: reserveToEdit.regra_tipo || reserveData.regra_tipo,
          regra_valor: reserveToEdit.regra_valor ?? reserveData.regra_valor ?? 0,
          regra_categorias: reserveToEdit.regra_categorias || reserveData.regra_categorias || [],
          regra_ativa: Boolean(reserveToEdit.regra_ativa),
          updated_at: nowIso,
          description: reasonDesc,
        });

        finalPayload.regra_inicio_validade = todayStr;
        finalPayload.rule_history = updatedHistory;
      }

      await updateReserve(reserveToEdit.id, finalPayload);
      if ((goalChanged || ruleReenabled) && hasActiveRuleAfterSave) {
        toast.success('Reserva atualizada e sugestão de aporte recalculada a partir de agora!');
      } else {
        toast.success('Reserva atualizada com sucesso!');
      }
    } else {
      const payload: Omit<Reserve, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
        name: reserveData.name || 'Nova Reserva',
        description: reserveData.description || '',
        saldo_inicial: initialBalance || 0,
        saldo_atual: initialBalance || 0,
        meta_objetivo: reserveData.meta_objetivo || 0,
        target_date: reserveData.target_date ?? null,
        icon: reserveData.icon || 'PiggyBank',
        color: reserveData.color || '#6366f1',
        regra_ativa: !!reserveData.regra_ativa,
        regra_tipo: reserveData.regra_tipo,
        regra_valor: reserveData.regra_valor,
        regra_categorias: reserveData.regra_categorias || [],
        regra_inicio_validade: reserveData.regra_inicio_validade || getTodayLocalDateStr(),
        boost_ativo: Boolean(reserveData.boost_ativo),
        boost_tipo: reserveData.boost_tipo || 'increment',
        boost_valor: reserveData.boost_valor ?? 0,
        reset_suggestion_on_withdraw: reserveData.reset_suggestion_on_withdraw ?? true,
        weekly_goal_mode: reserveData.weekly_goal_mode || 'dynamic',
        weekly_goal_amount: reserveData.weekly_goal_amount ?? null,
        weekly_goal_include_manual: reserveData.weekly_goal_include_manual ?? true,
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

    const todayStr = getTodayLocalDateStr();
    const nowIso = new Date().toISOString();
    const effectiveDate = toDateInputString(ruleData.regra_inicio_validade) || todayStr;
    const hadPrevRule = Boolean(currentRes.regra_tipo && currentRes.regra_valor);
    const wasReenabled = !currentRes.regra_ativa && Boolean(ruleData.regra_ativa);
    let updatedHistory = Array.isArray(currentRes.rule_history) ? [...currentRes.rule_history] : [];

    if (hadPrevRule && (currentRes.regra_tipo !== ruleData.regra_tipo || currentRes.regra_valor !== ruleData.regra_valor || currentRes.regra_ativa !== ruleData.regra_ativa)) {
      const rawPrev = currentRes.regra_inicio_validade || currentRes.created_at || effectiveDate;
      const prevStartDate = toDateInputString(rawPrev) || effectiveDate;
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
        ...(effectiveDate === todayStr ? { cutoff_rule_start: effectiveDate, cutoff_at: nowIso, action_type: wasReenabled ? 'unpause' : 'rule_update' } : {}),
        regra_tipo: currentRes.regra_tipo,
        regra_valor: currentRes.regra_valor,
        regra_categorias: currentRes.regra_categorias || [],
        regra_ativa: currentRes.regra_ativa,
        updated_at: nowIso,
        description: wasReenabled ? `Regra reativada (anterior: ${typeLabel})` : `Regra anterior: ${typeLabel}`
      });
    } else if (wasReenabled && effectiveDate === todayStr && ruleData.regra_tipo) {
      updatedHistory.push({
        start_date: effectiveDate,
        end_date: effectiveDate,
        cutoff_rule_start: effectiveDate,
        cutoff_at: nowIso,
        action_type: 'unpause',
        regra_tipo: ruleData.regra_tipo,
        regra_valor: ruleData.regra_valor ?? 0,
        regra_categorias: ruleData.regra_categorias || [],
        regra_ativa: false,
        updated_at: nowIso,
        description: 'Regra ativada a partir de agora'
      });
    }

    const payload: Partial<Reserve> = {
      ...ruleData,
      regra_inicio_validade: effectiveDate,
      rule_history: updatedHistory
    };

    await updateReserve(reserveId, payload);
    if (auditReserve?.id === reserveId) {
      setAuditReserve(prev => prev ? { ...prev, ...payload } : null);
    }
    toast.success('Regra da reserva atualizada com sucesso!');
    if (refreshData) await refreshData(true);
  };

  // 7. Toggle Pause/Play automation (with confirmation modal)
  const handleTogglePause = (res: Reserve) => {
    setConfirmReserveAction({
      type: res.is_paused ? 'unpause' : 'pause',
      reserve: res,
    });
  };

  // 7b. Toggle / Configure Modo Boost (never modifies regra_inicio_validade or rule_history)
  const handleToggleBoost = (res: Reserve) => {
    if (isReserveBoostActive(res)) {
      setConfirmReserveAction({ type: 'boost_off', reserve: res });
      return;
    }

    const boostType = (res.boost_tipo || 'increment') as 'increment' | 'multiplier';
    const boostVal = Number(res.boost_valor || 0);
    const hasConfiguredValue =
      boostType === 'multiplier' ? boostVal > 1 : boostVal > 0;

    if (hasConfiguredValue) {
      setConfirmReserveAction({ type: 'boost_on', reserve: res });
      return;
    }

    setBoostFocusReserveId(res.id);
    setShowModoBoostModal(true);
  };

  const handleUpdateReserveBoost = async (
    reserveId: string,
    payload: {
      boost_ativo: boolean;
      boost_tipo: 'increment' | 'multiplier';
      boost_valor: number;
    }
  ) => {
    await updateReserve(reserveId, payload);
    if (auditReserve?.id === reserveId) {
      setAuditReserve(prev => (prev ? { ...prev, ...payload } : null));
    }
  };

  const handleBatchUpdateBoost = async (
    updates: Array<{
      reserveId: string;
      boost_ativo: boolean;
      boost_tipo: 'increment' | 'multiplier';
      boost_valor: number;
    }>
  ) => {
    for (const u of updates) {
      const payload = {
        boost_ativo: u.boost_ativo,
        boost_tipo: u.boost_tipo,
        boost_valor: u.boost_valor,
      };
      await updateReserve(u.reserveId, payload);
      if (auditReserve?.id === u.reserveId) {
        setAuditReserve(prev => (prev ? { ...prev, ...payload } : null));
      }
    }
  };

  const handleBatchUpdateWeeklyGoals = async (
    updates: Array<{
      reserveId: string;
      weekly_goal_mode: 'dynamic' | 'rule_week' | 'fixed' | 'off';
      weekly_goal_amount: number | null;
      weekly_goal_include_manual: boolean;
    }>
  ) => {
    for (const u of updates) {
      const payload: Partial<Reserve> = {
        weekly_goal_mode: u.weekly_goal_mode,
        weekly_goal_amount: u.weekly_goal_amount,
        weekly_goal_include_manual: u.weekly_goal_include_manual,
      };
      await updateReserve(u.reserveId, payload);
      if (auditReserve?.id === u.reserveId) {
        setAuditReserve(prev => (prev ? { ...prev, ...payload } : null));
      }
    }
  };

  // 8. Finalize / Deactivate / Reactivate Reserve (with confirmation modal, no window.confirm)
  const handleFinalize = (res: Reserve) => {
    setConfirmReserveAction({
      type: res.status === 'inactive' ? 'reactivate' : 'deactivate',
      reserve: res,
    });
  };

  // 9. Delete Reserve (with confirmation modal, no window.confirm)
  const handleDeleteReserve = (res: Reserve) => {
    setConfirmReserveAction({ type: 'delete', reserve: res });
  };

  const handleExecuteConfirmedReserveAction = async () => {
    if (!confirmReserveAction || confirmingReserveAction) return;
    const { type, reserve: res } = confirmReserveAction;
    setConfirmingReserveAction(true);

    try {
      if (type === 'pause') {
        await updateReserve(res.id, { is_paused: true });
        toast.success(`Automação de "${res.name}" pausada.`);
      } else if (type === 'unpause') {
        const todayStr = getTodayLocalDateStr();
        const nowIso = new Date().toISOString();
        const updatedHistory = Array.isArray(res.rule_history) ? [...res.rule_history] : [];
        const rawPrev = res.regra_inicio_validade || res.created_at || todayStr;
        const prevStartDate = toDateInputString(rawPrev) || todayStr;

        if (res.regra_tipo) {
          updatedHistory.push({
            start_date: prevStartDate,
            end_date: todayStr,
            cutoff_rule_start: todayStr,
            cutoff_at: nowIso,
            action_type: 'unpause',
            regra_tipo: res.regra_tipo,
            regra_valor: res.regra_valor ?? 0,
            regra_categorias: res.regra_categorias || [],
            regra_ativa: Boolean(res.regra_ativa),
            updated_at: nowIso,
            description: 'Automação retomada após pausa (base de sugestão reiniciada)'
          });
        }

        const payload: Partial<Reserve> = {
          is_paused: false,
          ...(res.regra_tipo ? { regra_inicio_validade: todayStr, rule_history: updatedHistory } : {})
        };
        await updateReserve(res.id, payload);
        if (auditReserve?.id === res.id) {
          setAuditReserve(prev => prev ? { ...prev, ...payload } : null);
        }
        toast.success(`Automação de "${res.name}" reativada! Sugestões recalculadas a partir de agora.`);
      } else if (type === 'boost_off') {
        await updateReserve(res.id, { boost_ativo: false });
        if (auditReserve?.id === res.id) {
          setAuditReserve(prev => (prev ? { ...prev, boost_ativo: false } : null));
        }
        toast.success(`Modo Boost desativado em "${res.name}". Regras e sugestões normais mantidas.`, {
          id: 'boost-toggle-toast'
        });
      } else if (type === 'boost_on') {
        const boostType = (res.boost_tipo || 'increment') as 'increment' | 'multiplier';
        const boostVal = Number(res.boost_valor || 0);
        const payload: Partial<Reserve> = {
          boost_ativo: true,
          boost_tipo: boostType,
          boost_valor: boostVal,
        };
        await updateReserve(res.id, payload);
        if (auditReserve?.id === res.id) {
          setAuditReserve(prev => (prev ? { ...prev, ...payload } : null));
        }
        const simulated = { ...res, ...payload };
        const speedup = getBoostSpeedupComparison(simulated, transactions, reserveTransactions);
        const speedNote =
          speedup.daysSaved && speedup.daysSaved > 0
            ? ` Meta ${speedup.daysSaved} ${speedup.daysSaved === 1 ? 'dia' : 'dias'} mais rápida!`
            : '';
        toast.success(
          `Modo Boost ativado em "${res.name}" (${getRuleBoostDeltaLabel(simulated)})!${speedNote}`,
          { id: 'boost-toggle-toast' }
        );
      } else if (type === 'deactivate') {
        await updateReserve(res.id, { status: 'inactive', is_paused: true });
        toast.success(`Reserva "${res.name}" inativada! Você pode acessá-la na aba "Inativas".`);
      } else if (type === 'reactivate') {
        const todayStr = getTodayLocalDateStr();
        const nowIso = new Date().toISOString();
        const updatedHistory = Array.isArray(res.rule_history) ? [...res.rule_history] : [];
        const rawPrev = res.regra_inicio_validade || res.created_at || todayStr;
        const prevStartDate = toDateInputString(rawPrev) || todayStr;

        if (res.regra_ativa && res.regra_tipo) {
          updatedHistory.push({
            start_date: prevStartDate,
            end_date: todayStr,
            cutoff_rule_start: todayStr,
            cutoff_at: nowIso,
            action_type: 'unpause',
            regra_tipo: res.regra_tipo,
            regra_valor: res.regra_valor ?? 0,
            regra_categorias: res.regra_categorias || [],
            regra_ativa: true,
            updated_at: nowIso,
            description: 'Reserva reativada (sugestão recalculada a partir de agora)'
          });
        }

        await updateReserve(res.id, {
          status: 'active',
          is_paused: false,
          ...(res.regra_ativa && res.regra_tipo ? { regra_inicio_validade: todayStr, rule_history: updatedHistory } : {})
        });
        toast.success(`Reserva "${res.name}" reativada com sucesso!`);
      } else if (type === 'delete') {
        await deleteReserve(res.id);
        toast.success(`Reserva "${res.name}" excluída.`);
      }

      setConfirmReserveAction(null);
    } catch {
      toast.error('Erro ao executar ação na reserva. Tente novamente.');
    } finally {
      setConfirmingReserveAction(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-12 max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
      {/* Top Header with Global KPIs and Main Controls */}
      <ReservesHeader
        totalBalance={totals.totalBalance}
        totalGoal={totals.totalGoal}
        totalPendingSuggestion={totals.totalPendingSuggestion}
        totalYield={totals.totalYield}
        yieldPct={totals.yieldPct}
        topYieldReserve={totals.topYieldReserve}
        activeCount={totals.activeCount}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenCreate={() => {
          setReserveToEdit(null);
          setShowCreateEditModal(true);
        }}
        onOpenMassAporte={() => setShowMassAporteModal(true)}
        onOpenBoost={() => {
          setBoostFocusReserveId(null);
          setShowModoBoostModal(true);
        }}
        boostActiveCount={boostActiveCount}
        weeklyTotalAported={weeklySummary.weeklyTotalAported}
        weeklyTotalTarget={weeklySummary.weeklyTotalTarget}
        weeklyRangeLabel={weeklySummary.weeklyRangeLabel}
        weeklyGoalCount={weeklySummary.weeklyGoalCount}
        onOpenWeeklyGoals={() => setShowWeeklyGoalsModal(true)}
        hideValues={hideValues}
        setHideValues={setHideValues}
      />

      {/* Main Tab Content */}
      {activeTab === 'cards' ? (
        <div className="space-y-4 text-left">
          {/* Sub-header Filter, Sort & Search bar */}
          <div className="flex flex-col gap-2.5 bg-card p-3 rounded-2xl border border-border/80 shadow-xs">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar reserva..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs rounded-xl"
                />
              </div>

              <div className="flex items-center gap-1 shrink-0 bg-muted/40 p-1 rounded-xl border border-border/80 text-[11px] font-bold overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${
                    statusFilter === 'all' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                  }`}
                >
                  Todas ({activeReserves.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('with_pending')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${
                    statusFilter === 'with_pending' ? 'bg-card text-amber-600 dark:text-amber-400 shadow-xs' : 'text-muted-foreground'
                  }`}
                >
                  C/ Pendência
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('reached')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer shrink-0 ${
                    statusFilter === 'reached' ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-muted-foreground'
                  }`}
                >
                  Meta Batida
                </button>
                {pausedReservesCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('paused')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                      statusFilter === 'paused' ? 'bg-card text-amber-600 dark:text-amber-400 shadow-xs' : 'text-muted-foreground'
                    }`}
                  >
                    <PauseCircle className="w-3 h-3" />
                    <span>Pausadas ({pausedReservesCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                    statusFilter === 'inactive' ? 'bg-card text-foreground shadow-xs font-black' : 'text-muted-foreground'
                  }`}
                >
                  <Archive className="w-3 h-3" />
                  <span>Inativas ({inactiveReserves.length})</span>
                </button>
              </div>
            </div>

            {/* Priority Sort Controls */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50 flex-wrap">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                <ArrowUpDown className="w-3 h-3 text-indigo-500" />
                <span>Ordenar por:</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap text-[10.5px] font-bold">
                {[
                  { id: 'pending' as const, label: 'Sugestões Primeiro' },
                  { id: 'urgency' as const, label: 'Urgência de Meta' },
                  { id: 'proximity' as const, label: 'Mais Próximas (100%)' },
                  { id: 'balance' as const, label: 'Maior Saldo' },
                  { id: 'alpha' as const, label: 'A-Z' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortBy(opt.id)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer border ${
                      sortBy === opt.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-muted/30 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          {filteredCards.length === 0 ? (
            <div className="p-12 text-center bg-card border border-dashed border-border rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                {statusFilter === 'inactive' ? <Archive className="w-6 h-6 text-muted-foreground" /> : <PiggyBank className="w-6 h-6" />}
              </div>
              <h3 className="text-base font-bold text-foreground">
                {statusFilter === 'inactive' ? 'Nenhuma reserva inativa' : 'Nenhuma reserva encontrada'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {statusFilter === 'inactive'
                  ? 'Todas as suas reservas financeiras estão ativas no momento.'
                  : 'Crie reservas financeiras para blindar suas metas, manutenção veicular, impostos e emergências.'}
              </p>
              {statusFilter === 'inactive' ? (
                <Button
                  variant="outline"
                  onClick={() => setStatusFilter('all')}
                  className="h-9 px-4 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Ver Reservas Ativas
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setReserveToEdit(null);
                    setShowCreateEditModal(true);
                  }}
                  className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Criar Primeira Reserva
                </Button>
              )}
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
                    setIsSuggestionAporte(false);
                    setAporteInitialAmount(undefined);
                    setAporteInitialDesc(undefined);
                    setActionModalType('aporte_manual');
                  }}
                  onWithdraw={r => {
                    setSelectedReserveForAction(r);
                    setWithdrawInitialMode('expense');
                    setActionModalType('withdraw');
                  }}
                  onTransferToCash={r => {
                    setSelectedReserveForAction(r);
                    setWithdrawInitialMode('transfer_to_cash');
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
                  onAuditSuggestion={r => setAuditReserve(r)}
                  onToggleBoost={handleToggleBoost}
                  onConfigureBoost={r => {
                    setBoostFocusReserveId(r.id);
                    setShowModoBoostModal(true);
                  }}
                  onConfigureWeeklyGoal={() => setShowWeeklyGoalsModal(true)}
                  onApplyWeeklyRemaining={(r, amt) => {
                    setSelectedReserveForAction(r);
                    setIsSuggestionAporte(false);
                    setAporteInitialAmount(amt);
                    setAporteInitialDesc(`[Meta Semanal] ${r.name}`);
                    setActionModalType('aporte_manual');
                  }}
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
              onAuditSuggestion={r => setAuditReserve(r)}
              isModal={true}
            />
          </div>
        </div>
      )}

      {/* 1b. Modal Auditoria da Sugestão de Aportes */}
      <SuggestionAuditModal
        key={auditReserve ? `${auditReserve.id}-${auditReserve.regra_inicio_validade}-${auditReserve.regra_valor}-${auditReserve.regra_tipo}-${auditReserve.boost_ativo}-${auditReserve.boost_tipo}-${auditReserve.boost_valor}-${auditReserve.reset_suggestion_on_withdraw}` : 'audit-closed'}
        isOpen={Boolean(auditReserve)}
        onClose={() => setAuditReserve(null)}
        reserve={auditReserve ? (reserves.find(r => r.id === auditReserve.id) || auditReserve) : null}
        transactions={transactions}
        reserveTransactions={reserveTransactions}
        globalPeriod={FIXED_SUGGESTION_PERIOD}
        customDateRange={FIXED_CUSTOM_RANGE}
        onApplyAporte={(res, amt) => handleApplyDirectSuggestion(res, amt)}
      />

      {/* 1c. Modal Centro de Controle Modo Boost */}
      <ModoBoostModal
        isOpen={showModoBoostModal}
        onClose={() => {
          setShowModoBoostModal(false);
          setBoostFocusReserveId(null);
        }}
        reserves={reserves}
        transactions={transactions}
        reserveTransactions={reserveTransactions}
        globalPeriod={FIXED_SUGGESTION_PERIOD}
        customDateRange={FIXED_CUSTOM_RANGE}
        focusReserveId={boostFocusReserveId}
        onUpdateReserveBoost={handleUpdateReserveBoost}
        onBatchUpdateBoost={handleBatchUpdateBoost}
        onOpenRuleModal={r => {
          setShowModoBoostModal(false);
          setReserveToUpdateRule(r);
          setShowUpdateRuleModal(true);
        }}
      />

      {/* 1d. Modal de Metas Semanais de Aportes */}
      <WeeklyGoalsModal
        isOpen={showWeeklyGoalsModal}
        onClose={() => setShowWeeklyGoalsModal(false)}
        reserves={reserves}
        transactions={transactions}
        reserveTransactions={reserveTransactions}
        onSaveBatch={handleBatchUpdateWeeklyGoals}
        hideValues={hideValues}
      />

      {/* 2. Modal Criar / Editar Reserva */}
      <ReserveModal
        isOpen={showCreateEditModal}
        onClose={() => {
          setShowCreateEditModal(false);
          setReserveToEdit(null);
        }}
        reserveToEdit={reserveToEdit}
        transactions={transactions}
        reserveTransactions={reserveTransactions}
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

      {/* 4. Modal Resgate / Utilização / Transferência para Caixa */}
      <WithdrawModal
        isOpen={actionModalType === 'withdraw'}
        reserve={selectedReserveForAction}
        settings={settings}
        initialMode={withdrawInitialMode}
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
        key={selectedReserveForAction ? `${selectedReserveForAction.id}-${selectedReserveForAction.regra_inicio_validade}-${selectedReserveForAction.regra_valor}` : 'history-closed'}
        isOpen={actionModalType === 'rule_history'}
        reserve={selectedReserveForAction ? (reserves.find(r => r.id === selectedReserveForAction.id) || selectedReserveForAction) : null}
        onClose={() => {
          setActionModalType(null);
          setSelectedReserveForAction(null);
        }}
        transactions={transactions}
        reserveTransactions={reserveTransactions}
        globalPeriod={FIXED_SUGGESTION_PERIOD}
        customDateRange={FIXED_CUSTOM_RANGE}
      />

      {/* 7. Modal de Confirmação: Inativar/Reativar, Pausar/Retomar, Boost ON/OFF, Excluir */}
      <Dialog
        open={confirmReserveAction !== null}
        onOpenChange={open => !open && !confirmingReserveAction && setConfirmReserveAction(null)}
      >
        <DialogContent className="max-w-md rounded-3xl">
          {confirmReserveAction && (() => {
            const { type, reserve: targetRes } = confirmReserveAction;
            const simulatedBoostRes: Reserve = {
              ...targetRes,
              boost_ativo: true,
              boost_tipo: (targetRes.boost_tipo || 'increment') as 'increment' | 'multiplier',
              boost_valor: Number(targetRes.boost_valor || 0),
            };
            const deltaLabel = getRuleBoostDeltaLabel(
              type === 'boost_off' ? targetRes : simulatedBoostRes
            );
            const speedup =
              type === 'boost_on'
                ? getBoostSpeedupComparison(simulatedBoostRes, transactions, reserveTransactions)
                : null;

            const config = (() => {
              switch (type) {
                case 'deactivate':
                  return {
                    title: `Inativar "${targetRes.name}"?`,
                    desc: 'A reserva ficará oculta da lista principal (acessível na aba "Inativas") e suas automações serão suspensas. Todo o saldo e histórico continuam salvos.',
                    btnLabel: 'Confirmar Inativação',
                    btnClass: 'bg-amber-600 hover:bg-amber-700 text-white',
                    titleClass: 'text-amber-600 dark:text-amber-400',
                    Icon: Archive,
                  };
                case 'reactivate':
                  return {
                    title: `Reativar "${targetRes.name}"?`,
                    desc: 'A reserva voltará para a lista ativa e, se possuir regra configurada, a base de sugestão será reiniciada a partir de hoje para não acumular o período inativo.',
                    btnLabel: 'Confirmar Reativação',
                    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
                    titleClass: 'text-emerald-600 dark:text-emerald-400',
                    Icon: ArchiveRestore,
                  };
                case 'pause':
                  return {
                    title: `Pausar Automação de "${targetRes.name}"?`,
                    desc: 'Enquanto pausada, esta reserva não irá gerar novas sugestões automáticas de aporte.',
                    btnLabel: 'Confirmar Pausa',
                    btnClass: 'bg-amber-600 hover:bg-amber-700 text-white',
                    titleClass: 'text-amber-600 dark:text-amber-400',
                    Icon: PauseCircle,
                  };
                case 'unpause':
                  return {
                    title: `Retomar Automação de "${targetRes.name}"?`,
                    desc: 'As sugestões voltarão a ser geradas com a base reiniciada a partir de hoje (sem acumular os dias em pausa).',
                    btnLabel: 'Retomar Automação',
                    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
                    titleClass: 'text-emerald-600 dark:text-emerald-400',
                    Icon: PlayCircle,
                  };
                case 'boost_on':
                  return {
                    title: `Ativar Modo Boost em "${targetRes.name}"?`,
                    desc: `A regra e as próximas sugestões serão elevadas imediatamente (${deltaLabel}) para acelerar a sua meta. Você pode desativar quando quiser.`,
                    btnLabel: 'Ativar Modo Boost',
                    btnClass: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white',
                    titleClass: 'text-amber-600 dark:text-amber-400',
                    Icon: Rocket,
                  };
                case 'boost_off':
                  return {
                    title: `Desativar Modo Boost em "${targetRes.name}"?`,
                    desc: `A regra e as sugestões voltarão imediatamente ao valor normal configurado, mantendo seu ajuste de Boost (${deltaLabel}) salvo para quando quiser reativar.`,
                    btnLabel: 'Desativar Boost',
                    btnClass: 'bg-zinc-700 hover:bg-zinc-800 text-white',
                    titleClass: 'text-foreground',
                    Icon: Rocket,
                  };
                case 'delete':
                  return {
                    title: `Excluir "${targetRes.name}"?`,
                    desc: 'ATENÇÃO: Essa ação remove a reserva e todo o histórico de movimentações vinculado permanentemente.',
                    btnLabel: 'Confirmar Exclusão',
                    btnClass: 'bg-rose-600 hover:bg-rose-700 text-white',
                    titleClass: 'text-rose-600 dark:text-rose-400',
                    Icon: Trash2,
                  };
              }
            })();

            const IconComp = config.Icon;

            return (
              <>
                <DialogHeader>
                  <DialogTitle className={`text-base font-black flex items-center gap-2 ${config.titleClass}`}>
                    <IconComp className="w-5 h-5 shrink-0" />
                    {config.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs leading-relaxed">
                    {config.desc}
                  </DialogDescription>
                </DialogHeader>

                <div className="p-3 rounded-2xl border border-border/70 bg-muted/20 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-muted-foreground">Reserva:</span>
                    <span className="font-black text-foreground">{targetRes.name}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-muted-foreground">Saldo atual:</span>
                    <span className="font-mono font-black text-foreground">
                      {hideValues ? 'R$ •••••' : formatCurrency(targetRes.saldo_atual || 0)}
                    </span>
                  </div>
                  {type === 'boost_on' && speedup?.daysSaved && speedup.daysSaved > 0 && (
                    <div className="flex items-center justify-between gap-2 text-emerald-600 dark:text-emerald-400 pt-1 border-t border-border/50">
                      <span className="font-bold">Impacto estimado:</span>
                      <span className="font-black">
                        Meta {speedup.daysSaved} {speedup.daysSaved === 1 ? 'dia' : 'dias'} mais rápida!
                      </span>
                    </div>
                  )}
                  {type === 'delete' && (
                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 pt-1 border-t border-border/50">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Esta ação não pode ser desfeita.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={confirmingReserveAction}
                    onClick={() => setConfirmReserveAction(null)}
                    className="rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    disabled={confirmingReserveAction}
                    onClick={handleExecuteConfirmedReserveAction}
                    className={`rounded-xl text-xs font-black cursor-pointer ${config.btnClass}`}
                  >
                    {confirmingReserveAction ? 'Processando...' : config.btnLabel}
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Reserves;
