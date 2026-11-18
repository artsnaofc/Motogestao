import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '../components/CurrencyInput';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useData } from '../contexts/DataContext';
import { Transaction, RecurrenceFrequency } from '../types';
import {
  planningStorage,
  CreditCardConfig,
  CreditCardBrand,
  CARD_BRAND_PRESETS,
  computeCardStatementDueDate,
  extractCardTagFromTransaction,
  getCardCycleStatus,
} from '../lib/planningStorage';
import {
  getInvestmentTransactionNetAmount,
  isInvestmentSaleReserveAporte,
} from '../lib/investmentCalculations';
import { calculateNextOccurrence, generateUUID } from '../lib/recurrenceUtils';
import { getTodayLocalDateStr } from '../lib/utils';
import { getEffectiveUserId } from '../lib/authUtils';
import { syncQueueManager } from '../lib/syncQueue';
import { cacheManager } from '../lib/cacheManager';
import { toast } from '@/lib/toast';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarRange,
  CreditCard,
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  Edit2,
  Wallet,
  RotateCcw,
  ReceiptText,
  Sparkles,
  CalendarClock,
  Layers,
  Eye,
  EyeOff,
  Search,
  ListChecks,
  LayoutGrid,
  Repeat,
  ArrowUpRight,
  ArrowDownRight,
  CalendarPlus,
  Copy,
  TrendingUp,
  PieChart,
  CheckSquare,
  Square,
  SlidersHorizontal,
  ArrowRight,
  X,
} from 'lucide-react';

interface NormalizedPlannedItem {
  id: string;
  kind: 'expense' | 'income';
  dateStr: string;
  monthKey: string;
  amount: number;
  category: string;
  description: string;
  paymentStatus: 'paid' | 'pending';
  isCard: boolean;
  cardId: string | null;
  isReserveTx: boolean;
  recurrenceGroupId?: string | null;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  rawTx: any;
}

type MainViewMode = 'calendar' | 'list' | 'installments';
type RightPanelTab = 'day' | 'pending' | 'categories';
type KindFilter = 'all' | 'cards' | 'bills' | 'incomes';
type StatusFilter = 'all' | 'pending' | 'overdue' | 'paid';
type PendingScopeFilter = 'all' | 'overdue' | 'current_month' | 'future';
type CardInvoiceTarget = 'auto' | 'viewed_month' | 'next_month';

export function PlanningCalendar() {
  const {
    transactions,
    setTransactions,
    updateTransaction,
    deleteTransaction,
    reserveTransactions,
    updateReserveTransaction,
    investmentTransactions,
    reserves,
    settings,
    hideValues,
  } = useData();

  const [userId, setUserId] = useState<string>('');
  const [cards, setCards] = useState<CreditCardConfig[]>([]);
  const [txCardMap, setTxCardMap] = useState<Record<string, string>>({});
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});

  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDayStr, setSelectedDayStr] = useState<string>(() => getTodayLocalDateStr());
  const [mainView, setMainView] = useState<MainViewMode>('calendar');
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('day');
  const [showSpotPaidExpenses, setShowSpotPaidExpenses] = useState<boolean>(false);

  // Filters & Search
  const [filterCardId, setFilterCardId] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pendingScopeFilter, setPendingScopeFilter] = useState<PendingScopeFilter>('all');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);

  // Card Manager Dialog
  const [showCardModal, setShowCardModal] = useState(false);
  const [reopenEntryAfterCard, setReopenEntryAfterCard] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardConfig | null>(null);
  const [cardName, setCardName] = useState('');
  const [cardBrand, setCardBrand] = useState<CreditCardBrand>('nubank');
  const [cardColor, setCardColor] = useState('#820ad1');
  const [cardClosingDay, setCardClosingDay] = useState('5');
  const [cardDueDay, setCardDueDay] = useState('12');
  const [cardLimit, setCardLimit] = useState('');

  // Purchase / Planned Bill / Planned Income Dialog
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryMode, setEntryMode] = useState<'card' | 'bill' | 'income'>('card');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [cardInvoiceTarget, setCardInvoiceTarget] = useState<CardInvoiceTarget>('auto');
  const [entryDate, setEntryDate] = useState<string>(getTodayLocalDateStr());
  const [entryAmount, setEntryAmount] = useState<string>('');
  const [amountInputType, setAmountInputType] = useState<'total' | 'installment'>('total');
  const [installments, setInstallments] = useState<string>('1');
  const [entryCategory, setEntryCategory] = useState<string>('Outras Despesas');
  const [entryDescription, setEntryDescription] = useState<string>('');
  const [billRepeat, setBillRepeat] = useState<boolean>(false);
  const [billFrequency, setBillFrequency] = useState<RecurrenceFrequency>('monthly');
  const [billRepeatCount, setBillRepeatCount] = useState<string>('6');
  const [savingEntry, setSavingEntry] = useState(false);

  // Edit Existing Planned Item Dialog
  const [editingItem, setEditingItem] = useState<NormalizedPlannedItem | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'paid' | 'pending'>('pending');
  const [editCardId, setEditCardId] = useState<string>('__none__');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Parcel Group Confirmation Dialog
  const [deleteTargetItem, setDeleteTargetItem] = useState<NormalizedPlannedItem | null>(null);

  // Confirm Shift to Next Invoice / Next Month Dialog
  const [shiftConfirmTarget, setShiftConfirmTarget] = useState<
    | { mode: 'single'; item: NormalizedPlannedItem; deltaMonths: number }
    | { mode: 'batch'; items: NormalizedPlannedItem[]; deltaMonths: number }
    | null
  >(null);
  const [confirmingShift, setConfirmingShift] = useState(false);

  // Confirm Duplicate to Next Month Dialog
  const [duplicateConfirmItem, setDuplicateConfirmItem] = useState<NormalizedPlannedItem | null>(null);
  const [confirmingDuplicate, setConfirmingDuplicate] = useState(false);

  // Category Budget Quick Modal
  const [budgetModalCategory, setBudgetModalCategory] = useState<string | null>(null);
  const [budgetModalLimit, setBudgetModalLimit] = useState<string>('');

  useEffect(() => {
    let activeUid = '';
    const hydrateFromStorage = (uid: string) => {
      const loadedCards = planningStorage.getCards(uid);
      setCards(loadedCards);
      setTxCardMap(planningStorage.getTxCardMap(uid));
      setCategoryBudgets(planningStorage.getCategoryBudgets(uid));
      if (loadedCards.length > 0) {
        setSelectedCardId(prev => prev || loadedCards[0].id);
      }
    };

    getEffectiveUserId().then(uid => {
      const effectiveUid = uid || 'default';
      activeUid = effectiveUid;
      setUserId(effectiveUid);
      hydrateFromStorage(effectiveUid);
    });

    const handleSync = (e: Event) => {
      const detailUid = (e as CustomEvent)?.detail?.userId;
      const targetUid = detailUid || activeUid;
      if (targetUid) {
        hydrateFromStorage(targetUid);
      }
    };

    window.addEventListener('planning_data_synced', handleSync);
    return () => window.removeEventListener('planning_data_synced', handleSync);
  }, []);

  const expenseCategories = useMemo(() => {
    return (
      settings?.expense_categories || [
        'Combustível',
        'Manutenção',
        'Alimentação',
        'Plano de Internet',
        'Equipamento',
        'Trabalho',
        'Cartão de Crédito',
        'Outras Despesas',
        'Outros',
      ]
    );
  }, [settings]);

  const incomeCategories = useMemo(() => {
    return (
      settings?.income_categories || [
        'iFood',
        'Uber',
        '99Moto',
        'Pizzaria',
        'Frete do Dia',
        'Particular',
        'Gorjeta',
        'Outras Receitas',
        'Outros',
      ]
    );
  }, [settings]);

  const formatCurrency = (val: number) => {
    if (hideValues) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const todayStr = getTodayLocalDateStr();
  const todayMonthKey = todayStr.slice(0, 7);
  const currentMonthKey = format(currentMonth, 'yyyy-MM');
  const nextMonthKey = format(addMonths(currentMonth, 1), 'yyyy-MM');

  // Helper to navigate month while ALWAYS keeping selectedDayStr inside the newly viewed month
  const navigateToMonth = (targetMonth: Date, preferredDayStr?: string) => {
    const mStart = startOfMonth(targetMonth);
    const mKey = format(mStart, 'yyyy-MM');
    setCurrentMonth(mStart);
    setSelectedBatchIds([]);
    if (preferredDayStr && preferredDayStr.slice(0, 7) === mKey) {
      setSelectedDayStr(preferredDayStr);
    } else if (mKey === todayMonthKey) {
      setSelectedDayStr(todayStr);
    } else {
      setSelectedDayStr(`${mKey}-01`);
    }
  };

  // Real current Caixa Livre (bancaLivre), aligned 100% with Dashboard & History
  const bancaLivre = useMemo(() => {
    let rawNet = 0;
    (transactions || []).forEach(t => {
      if (t.payment_status === 'pending') return;
      const amount = Number(t.amount) || 0;
      if (
        t.category === 'Aporte Reserva' ||
        t.category === 'Resgate Reserva' ||
        t.category === 'Resgate de Reserva' ||
        (t as any).isReserveTx ||
        (t as any).isReserveAporte
      ) {
        return;
      }
      if (t.type === 'income') rawNet += amount;
      else rawNet -= amount;
    });

    (investmentTransactions || []).forEach(tx => {
      if (tx.reserve_id) return;
      if ((tx as any).payment_status === 'pending') return;
      const amount = getInvestmentTransactionNetAmount(tx);
      if (tx.operation === 'buy') rawNet -= amount;
      else rawNet += amount;
    });

    (reserveTransactions || []).forEach(rt => {
      if (rt.payment_status === 'pending') return;
      if (rt.type === 'rendimento') {
        rawNet += Number(rt.amount) || 0;
      } else if (rt.type === 'utilizacao') {
        const cat = (rt.category || '').toLowerCase().trim();
        const isPureResgateToCash =
          !rt.linked_investment_id &&
          (!cat || cat === 'resgate' || cat === 'resgate reserva' || cat === 'resgate de reserva' || cat === 'outros');
        if (!isPureResgateToCash) {
          rawNet -= Number(rt.amount) || 0;
        }
      } else if (rt.type === 'aporte') {
        if (isInvestmentSaleReserveAporte(rt)) {
          rawNet += Number(rt.amount) || 0;
        }
      }
    });

    const totalInReserves = (reserves || []).reduce((sum, r) => sum + (r.saldo_atual || 0), 0);
    return (settings?.initial_balance || 0) + rawNet - totalInReserves;
  }, [transactions, investmentTransactions, reserveTransactions, reserves, settings?.initial_balance]);

  // Normalize ALL planned expenses, credit card items, reserve utilizations, AND planned incomes
  const plannedItems = useMemo(() => {
    const items: NormalizedPlannedItem[] = [];

    (transactions || []).forEach(t => {
      if (
        t.category === 'Aporte Reserva' ||
        t.category === 'Resgate Reserva' ||
        t.category === 'Resgate de Reserva'
      ) {
        return;
      }
      const dueStr = (t.due_date || t.date || '').split('T')[0];
      if (!dueStr) return;

      const status: 'paid' | 'pending' = t.payment_status === 'pending' ? 'pending' : 'paid';

      if (t.type === 'income') {
        const isPlannedIncome =
          status === 'pending' ||
          Boolean(t.is_recurring) ||
          Boolean(t.recurrence_group_id) ||
          Boolean(t.due_date && t.date && t.due_date !== t.date);

        if (!isPlannedIncome) {
          if (!showSpotPaidExpenses || dueStr.slice(0, 7) !== currentMonthKey) {
            return;
          }
        }

        items.push({
          id: t.id,
          kind: 'income',
          dateStr: dueStr,
          monthKey: dueStr.slice(0, 7),
          amount: Number(t.amount) || 0,
          category: t.category || 'Receita',
          description: t.description || t.category || 'Receita Prevista',
          paymentStatus: status,
          isCard: false,
          cardId: null,
          isReserveTx: false,
          recurrenceGroupId: t.recurrence_group_id,
          installmentNumber: t.installment_number,
          installmentTotal: t.installment_total,
          rawTx: t,
        });
        return;
      }

      if (t.type !== 'expense') return;

      const cardId = extractCardTagFromTransaction(t, txCardMap, cards);
      const isCard = Boolean(
        cardId ||
          t.description?.toLowerCase().includes('[cartão') ||
          t.description?.toLowerCase().includes('[cartao')
      );

      const isPlannedOrCard =
        status === 'pending' ||
        isCard ||
        Boolean(t.is_recurring) ||
        Boolean(t.recurrence_group_id) ||
        Boolean(t.installment_number) ||
        Boolean(t.due_date && t.date && t.due_date !== t.date);

      if (!isPlannedOrCard) {
        if (!showSpotPaidExpenses || dueStr.slice(0, 7) !== currentMonthKey) {
          return;
        }
      }

      items.push({
        id: t.id,
        kind: 'expense',
        dateStr: dueStr,
        monthKey: dueStr.slice(0, 7),
        amount: Number(t.amount) || 0,
        category: t.category || 'Outros',
        description: t.description || t.category || 'Despesa',
        paymentStatus: status,
        isCard,
        cardId,
        isReserveTx: false,
        recurrenceGroupId: t.recurrence_group_id,
        installmentNumber: t.installment_number,
        installmentTotal: t.installment_total,
        rawTx: t,
      });
    });

    (reserveTransactions || []).forEach(rt => {
      if (rt.type !== 'utilizacao') return;
      const dueStr = (rt.due_date || rt.date || '').split('T')[0];
      if (!dueStr) return;
      const status: 'paid' | 'pending' = rt.payment_status === 'pending' ? 'pending' : 'paid';
      const isPlanned =
        status === 'pending' ||
        Boolean(rt.is_recurring) ||
        Boolean(rt.recurrence_group_id) ||
        Boolean(rt.due_date && rt.date && rt.due_date !== rt.date);

      if (!isPlanned) {
        if (!showSpotPaidExpenses || dueStr.slice(0, 7) !== currentMonthKey) {
          return;
        }
      }

      items.push({
        id: rt.id,
        kind: 'expense',
        dateStr: dueStr,
        monthKey: dueStr.slice(0, 7),
        amount: Number(rt.amount) || 0,
        category: rt.category || 'Reserva',
        description: rt.description || rt.category || 'Uso de Reserva',
        paymentStatus: status,
        isCard: false,
        cardId: null,
        isReserveTx: true,
        recurrenceGroupId: rt.recurrence_group_id,
        installmentNumber: rt.installment_number,
        installmentTotal: rt.installment_total,
        rawTx: rt,
      });
    });

    return items.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [transactions, reserveTransactions, cards, txCardMap, currentMonthKey, showSpotPaidExpenses]);

  const cardLookup = useMemo(() => {
    const map: Record<string, CreditCardConfig> = {};
    cards.forEach(c => {
      map[c.id] = c;
    });
    return map;
  }, [cards]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return plannedItems.filter(item => {
      if (filterCardId === 'no_card' && item.isCard) return false;
      if (filterCardId !== 'all' && filterCardId !== 'no_card' && item.cardId !== filterCardId) {
        return false;
      }

      if (kindFilter === 'cards' && !item.isCard) return false;
      if (kindFilter === 'bills' && (item.isCard || item.kind !== 'expense')) return false;
      if (kindFilter === 'incomes' && item.kind !== 'income') return false;

      if (statusFilter === 'pending' && item.paymentStatus !== 'pending') return false;
      if (statusFilter === 'paid' && item.paymentStatus !== 'paid') return false;
      if (statusFilter === 'overdue' && !(item.paymentStatus === 'pending' && item.dateStr < todayStr)) {
        return false;
      }

      if (q) {
        const cName = item.cardId ? (cardLookup[item.cardId]?.name || '') : '';
        const haystack = `${item.description} ${item.category} ${cName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [plannedItems, filterCardId, kindFilter, statusFilter, searchQuery, todayStr, cardLookup]);

  const monthItems = useMemo(() => {
    return filteredItems.filter(item => item.monthKey === currentMonthKey);
  }, [filteredItems, currentMonthKey]);

  const monthSummary = useMemo(() => {
    let cardsPending = 0;
    let cardsPaid = 0;
    let billsPending = 0;
    let billsPaid = 0;
    let incomesPending = 0;
    let incomesPaid = 0;

    // Use items filtered by card/search but keep month totals accurate even if statusFilter is used
    plannedItems
      .filter(item => {
        if (item.monthKey !== currentMonthKey) return false;
        if (filterCardId === 'no_card') return !item.isCard;
        if (filterCardId !== 'all') return item.cardId === filterCardId;
        return true;
      })
      .forEach(item => {
        if (item.kind === 'income') {
          if (item.paymentStatus === 'pending') incomesPending += item.amount;
          else incomesPaid += item.amount;
        } else if (item.isCard) {
          if (item.paymentStatus === 'pending') cardsPending += item.amount;
          else cardsPaid += item.amount;
        } else {
          if (item.paymentStatus === 'pending') billsPending += item.amount;
          else billsPaid += item.amount;
        }
      });

    const totalPending = cardsPending + billsPending;
    const totalPaid = cardsPaid + billsPaid;
    const projectedBalanceAfterMonth = bancaLivre + incomesPending - totalPending;

    return {
      cardsTotal: cardsPending + cardsPaid,
      cardsPending,
      billsPending,
      totalPending,
      totalPaid,
      incomesPending,
      incomesPaid,
      projectedBalanceAfterMonth,
    };
  }, [plannedItems, currentMonthKey, filterCardId, bancaLivre]);

  // Global Pending Summary (Expenses & Overdue across all months)
  const globalPendingExpenseItems = useMemo(() => {
    return filteredItems.filter(item => item.kind === 'expense' && item.paymentStatus === 'pending');
  }, [filteredItems]);

  const globalPendingItemsAllKinds = useMemo(() => {
    return filteredItems.filter(item => item.paymentStatus === 'pending');
  }, [filteredItems]);

  const scopedPendingList = useMemo(() => {
    return globalPendingItemsAllKinds.filter(item => {
      if (pendingScopeFilter === 'overdue') return item.dateStr < todayStr;
      if (pendingScopeFilter === 'current_month') return item.monthKey === currentMonthKey;
      if (pendingScopeFilter === 'future') return item.monthKey > currentMonthKey;
      return true;
    });
  }, [globalPendingItemsAllKinds, pendingScopeFilter, todayStr, currentMonthKey]);

  const globalPendingSummary = useMemo(() => {
    let totalPendingAll = 0;
    let totalPendingCardsAll = 0;
    let totalPendingBillsAll = 0;
    let totalPendingIncomesAll = 0;
    let overdueAllAmount = 0;
    let overdueAllCount = 0;

    plannedItems.forEach(item => {
      if (item.paymentStatus !== 'pending') return;
      if (filterCardId === 'no_card' && item.isCard) return;
      if (filterCardId !== 'all' && filterCardId !== 'no_card' && item.cardId !== filterCardId) return;

      if (item.kind === 'income') {
        totalPendingIncomesAll += item.amount;
        return;
      }

      totalPendingAll += item.amount;
      if (item.isCard) totalPendingCardsAll += item.amount;
      else totalPendingBillsAll += item.amount;

      if (item.dateStr < todayStr) {
        overdueAllAmount += item.amount;
        overdueAllCount += 1;
      }
    });

    return {
      totalPendingAll,
      totalPendingCardsAll,
      totalPendingBillsAll,
      totalPendingIncomesAll,
      overdueAllAmount,
      overdueAllCount,
      pendingCount: globalPendingExpenseItems.length,
    };
  }, [plannedItems, filterCardId, todayStr, globalPendingExpenseItems.length]);

  // Per-card invoice summaries
  const cardInvoices = useMemo(() => {
    const map: Record<
      string,
      {
        currentMonthTotal: number;
        currentMonthPending: number;
        currentMonthPaid: number;
        currentMonthPendingIds: string[];
        nextMonthTotal: number;
        nextMonthPending: number;
        totalCommittedAllFuture: number;
      }
    > = {};

    cards.forEach(c => {
      map[c.id] = {
        currentMonthTotal: 0,
        currentMonthPending: 0,
        currentMonthPaid: 0,
        currentMonthPendingIds: [],
        nextMonthTotal: 0,
        nextMonthPending: 0,
        totalCommittedAllFuture: 0,
      };
    });

    plannedItems.forEach(item => {
      if (item.kind !== 'expense' || !item.cardId || !map[item.cardId]) return;
      const bucket = map[item.cardId];
      if (item.monthKey === currentMonthKey) {
        bucket.currentMonthTotal += item.amount;
        if (item.paymentStatus === 'pending') {
          bucket.currentMonthPending += item.amount;
          bucket.currentMonthPendingIds.push(item.id);
        } else {
          bucket.currentMonthPaid += item.amount;
        }
      }
      if (item.monthKey === nextMonthKey) {
        bucket.nextMonthTotal += item.amount;
        if (item.paymentStatus === 'pending') {
          bucket.nextMonthPending += item.amount;
        }
      }
      if (item.paymentStatus === 'pending') {
        bucket.totalCommittedAllFuture += item.amount;
      }
    });

    return map;
  }, [cards, plannedItems, currentMonthKey, nextMonthKey]);

  // Installment & Recurrence Groups Summary
  const installmentGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        groupId: string;
        title: string;
        category: string;
        kind: 'expense' | 'income';
        cardId: string | null;
        items: NormalizedPlannedItem[];
        totalAmount: number;
        paidCount: number;
        pendingCount: number;
        remainingAmount: number;
        nextPendingItem: NormalizedPlannedItem | null;
      }
    > = {};

    plannedItems.forEach(item => {
      if (!item.recurrenceGroupId) return;
      if (filterCardId === 'no_card' && item.isCard) return;
      if (filterCardId !== 'all' && filterCardId !== 'no_card' && item.cardId !== filterCardId) return;

      const gid = item.recurrenceGroupId;
      if (!groups[gid]) {
        const cleanTitle = item.description
          .replace(/^\[Cart[ãa]o [^\]]+\]\s*/i, '')
          .replace(/\s*\(\d+\/\d+\)\s*$/, '')
          .trim();
        groups[gid] = {
          groupId: gid,
          title: cleanTitle || item.category,
          category: item.category,
          kind: item.kind,
          cardId: item.cardId,
          items: [],
          totalAmount: 0,
          paidCount: 0,
          pendingCount: 0,
          remainingAmount: 0,
          nextPendingItem: null,
        };
      }
      const g = groups[gid];
      g.items.push(item);
      g.totalAmount += item.amount;
      if (item.paymentStatus === 'paid') {
        g.paidCount += 1;
      } else {
        g.pendingCount += 1;
        g.remainingAmount += item.amount;
        if (!g.nextPendingItem || item.dateStr < g.nextPendingItem.dateStr) {
          g.nextPendingItem = item;
        }
      }
    });

    return Object.values(groups)
      .filter(g => g.items.length > 1)
      .sort((a, b) => {
        if (a.pendingCount > 0 && b.pendingCount === 0) return -1;
        if (a.pendingCount === 0 && b.pendingCount > 0) return 1;
        const da = a.nextPendingItem?.dateStr || a.items[0]?.dateStr || '';
        const db = b.nextPendingItem?.dateStr || b.items[0]?.dateStr || '';
        return da.localeCompare(db);
      });
  }, [plannedItems, filterCardId]);

  // Month Expense Breakdown by Category (vs Budgets)
  const monthCategoryBreakdown = useMemo(() => {
    const map: Record<string, { category: string; total: number; pending: number; paid: number; count: number }> = {};
    let grandTotal = 0;

    monthItems
      .filter(i => i.kind === 'expense')
      .forEach(item => {
        const cat = item.category || 'Outros';
        if (!map[cat]) map[cat] = { category: cat, total: 0, pending: 0, paid: 0, count: 0 };
        map[cat].total += item.amount;
        map[cat].count += 1;
        if (item.paymentStatus === 'pending') map[cat].pending += item.amount;
        else map[cat].paid += item.amount;
        grandTotal += item.amount;
      });

    return {
      grandTotal,
      rows: Object.values(map).sort((a, b) => b.total - a.total),
    };
  }, [monthItems]);

  // Calendar grid days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const itemsByDay = useMemo(() => {
    const map: Record<string, NormalizedPlannedItem[]> = {};
    filteredItems.forEach(item => {
      if (!map[item.dateStr]) map[item.dateStr] = [];
      map[item.dateStr].push(item);
    });
    return map;
  }, [filteredItems]);

  const selectedDayItems = itemsByDay[selectedDayStr] || [];
  const selectedDayPendingExpenses = useMemo(
    () => selectedDayItems.filter(i => i.kind === 'expense' && i.paymentStatus === 'pending'),
    [selectedDayItems]
  );

  const selectedDaySummary = useMemo(() => {
    let totalExpenses = 0;
    let paidExpenses = 0;
    let pendingExpenses = 0;
    let totalIncomes = 0;
    let paidIncomes = 0;
    let pendingIncomes = 0;
    let overdueCount = 0;

    selectedDayItems.forEach(item => {
      if (item.kind === 'income') {
        totalIncomes += item.amount;
        if (item.paymentStatus === 'paid') paidIncomes += item.amount;
        else pendingIncomes += item.amount;
      } else {
        totalExpenses += item.amount;
        if (item.paymentStatus === 'paid') paidExpenses += item.amount;
        else {
          pendingExpenses += item.amount;
          if (item.dateStr < todayStr) overdueCount += 1;
        }
      }
    });

    const pendingCount = selectedDayItems.filter(i => i.paymentStatus === 'pending').length;
    const allSettled = selectedDayItems.length > 0 && pendingCount === 0;
    const netDay = totalIncomes - totalExpenses;

    return {
      totalExpenses,
      paidExpenses,
      pendingExpenses,
      totalIncomes,
      paidIncomes,
      pendingIncomes,
      overdueCount,
      pendingCount,
      allSettled,
      netDay,
    };
  }, [selectedDayItems, todayStr]);

  // Card Manager handlers
  const handleOpenNewCard = (fromEntryModal = false) => {
    setReopenEntryAfterCard(fromEntryModal);
    setEditingCard(null);
    setCardName('');
    setCardBrand('nubank');
    setCardColor('#820ad1');
    setCardClosingDay('5');
    setCardDueDay('12');
    setCardLimit('');
    setShowCardModal(true);
  };

  const handleOpenEditCard = (card: CreditCardConfig) => {
    setReopenEntryAfterCard(false);
    setEditingCard(card);
    setCardName(card.name);
    setCardBrand(card.brand);
    setCardColor(card.color);
    setCardClosingDay(String(card.closingDay));
    setCardDueDay(String(card.dueDay));
    setCardLimit(card.limit ? String(card.limit) : '');
    setShowCardModal(true);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveUid = userId || (await getEffectiveUserId()) || 'default';
    if (!cardName.trim()) {
      toast.error('Informe o nome do cartão.');
      return;
    }

    const closing = Math.max(1, Math.min(31, Number(cardClosingDay) || 5));
    const due = Math.max(1, Math.min(31, Number(cardDueDay) || 12));
    const parsedLimit = Number(cardLimit);
    const limitVal = !isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;

    let nextCards: CreditCardConfig[];
    if (editingCard) {
      nextCards = cards.map(c =>
        c.id === editingCard.id
          ? {
              ...c,
              name: cardName.trim(),
              brand: cardBrand,
              color: cardColor,
              closingDay: closing,
              dueDay: due,
              limit: limitVal,
            }
          : c
      );
      toast.success('Cartão atualizado!');
    } else {
      const newCard: CreditCardConfig = {
        id: generateUUID(),
        name: cardName.trim(),
        brand: cardBrand,
        color: cardColor,
        closingDay: closing,
        dueDay: due,
        limit: limitVal,
        createdAt: new Date().toISOString(),
      };
      nextCards = [...cards, newCard];
      setSelectedCardId(newCard.id);
      toast.success(`Cartão "${newCard.name}" adicionado!`);
    }

    setUserId(effectiveUid);
    setCards(nextCards);
    planningStorage.saveCards(effectiveUid, nextCards);
    setShowCardModal(false);
    if (reopenEntryAfterCard) {
      setReopenEntryAfterCard(false);
      setEntryMode('card');
      setShowEntryModal(true);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    const effectiveUid = userId || (await getEffectiveUserId()) || 'default';
    const nextCards = cards.filter(c => c.id !== cardId);
    setCards(nextCards);
    planningStorage.saveCards(effectiveUid, nextCards);
    if (selectedCardId === cardId) setSelectedCardId(nextCards[0]?.id || '');
    if (filterCardId === cardId) setFilterCardId('all');
    toast.success('Cartão removido das configurações.');
  };

  // Preview card installment dates live
  const selectedCardObj = useMemo(
    () => cards.find(c => c.id === selectedCardId) || null,
    [cards, selectedCardId]
  );

  const forcedMonthKeyForCard = useMemo(() => {
    if (cardInvoiceTarget === 'viewed_month') return currentMonthKey;
    if (cardInvoiceTarget === 'next_month') return nextMonthKey;
    return null;
  }, [cardInvoiceTarget, currentMonthKey, nextMonthKey]);

  const cardPreview = useMemo(() => {
    if (entryMode !== 'card' || !selectedCardObj) return null;
    const nInst = Math.max(1, Math.min(24, Number(installments) || 1));
    const rawVal = Number(entryAmount) || 0;
    const perInstallment =
      amountInputType === 'total' ? Math.round((rawVal / nInst) * 100) / 100 : rawVal;
    const totalPurchase =
      amountInputType === 'total' ? rawVal : Math.round(rawVal * nInst * 100) / 100;

    const autoFirst = computeCardStatementDueDate(
      entryDate,
      selectedCardObj.closingDay,
      selectedCardObj.dueDay,
      1
    );

    const opts = forcedMonthKeyForCard
      ? { forceFirstStatementMonthKey: forcedMonthKeyForCard }
      : undefined;

    const first = computeCardStatementDueDate(
      entryDate,
      selectedCardObj.closingDay,
      selectedCardObj.dueDay,
      1,
      opts
    );
    const last = computeCardStatementDueDate(
      entryDate,
      selectedCardObj.closingDay,
      selectedCardObj.dueDay,
      nInst,
      opts
    );

    return {
      nInst,
      perInstallment,
      totalPurchase,
      first,
      last,
      autoFirst,
      isAutoInDifferentMonthThanViewed: autoFirst.statementMonthKey !== currentMonthKey,
    };
  }, [
    entryMode,
    selectedCardObj,
    installments,
    entryAmount,
    amountInputType,
    entryDate,
    forcedMonthKeyForCard,
    currentMonthKey,
  ]);

  // Smart default date when opening entry modal (never inherits stale selectedDayStr from another month)
  const handleOpenNewEntry = (
    mode: 'card' | 'bill' | 'income',
    presetDateStr?: string,
    presetCardId?: string
  ) => {
    setEntryMode(mode);

    let resolvedDate = presetDateStr;
    if (!resolvedDate) {
      if (selectedDayStr && selectedDayStr.slice(0, 7) === currentMonthKey) {
        resolvedDate = selectedDayStr;
      } else if (currentMonthKey === todayMonthKey) {
        resolvedDate = todayStr;
      } else {
        resolvedDate = `${currentMonthKey}-01`;
      }
    }
    setEntryDate(resolvedDate);

    // If user clicked directly on a day inside the viewed month for a card purchase,
    // keep invoice target 'auto' by default so card rules apply, OR if they're launching for a past/closed month let them switch with 1 click
    setCardInvoiceTarget('auto');
    setEntryAmount('');
    setAmountInputType('total');
    setInstallments('1');

    if (mode === 'income') {
      setEntryCategory(incomeCategories[0] || 'Outras Receitas');
    } else if (mode === 'card') {
      setEntryCategory(
        (expenseCategories.find(c => c.toLowerCase().includes('cart')) as string) ||
          expenseCategories[0] ||
          'Outras Despesas'
      );
    } else {
      setEntryCategory(expenseCategories[0] || 'Outras Despesas');
    }

    setEntryDescription('');
    setBillRepeat(false);
    setBillRepeatCount('6');

    if (mode === 'card') {
      if (presetCardId && cards.some(c => c.id === presetCardId)) {
        setSelectedCardId(presetCardId);
      } else if (cards.length > 0 && (!selectedCardId || !cards.some(c => c.id === selectedCardId))) {
        setSelectedCardId(cards[0].id);
      }
    }

    setShowEntryModal(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingEntry) return;
    const effectiveUid = userId || (await getEffectiveUserId()) || 'default';

    const rawVal = Number(entryAmount);
    if (isNaN(rawVal) || rawVal <= 0) {
      toast.error('Informe um valor maior que zero.');
      return;
    }

    setSavingEntry(true);
    try {
      const batch: Transaction[] = [];

      if (entryMode === 'card') {
        if (!selectedCardObj) {
          toast.error('Cadastre ou selecione um cartão de crédito.');
          setSavingEntry(false);
          return;
        }
        const nInst = Math.max(1, Math.min(24, Number(installments) || 1));
        const totalAmt =
          amountInputType === 'total' ? rawVal : Math.round(rawVal * nInst * 100) / 100;
        const baseInstAmt = Math.floor((totalAmt / nInst) * 100) / 100;
        const remainderCents = Math.round((totalAmt - baseInstAmt * nInst) * 100) / 100;

        const groupId = nInst > 1 ? generateUUID() : null;
        const labelDesc = entryDescription.trim() || entryCategory || 'Compra no cartão';
        const batchIds: string[] = [];
        const opts = forcedMonthKeyForCard
          ? { forceFirstStatementMonthKey: forcedMonthKeyForCard }
          : undefined;

        for (let i = 1; i <= nInst; i++) {
          const { statementDueDate } = computeCardStatementDueDate(
            entryDate,
            selectedCardObj.closingDay,
            selectedCardObj.dueDay,
            i,
            opts
          );
          const instId = generateUUID();
          batchIds.push(instId);
          const instAmt =
            i === 1 ? Math.round((baseInstAmt + remainderCents) * 100) / 100 : baseInstAmt;
          const parcelSuffix = nInst > 1 ? ` (${i}/${nInst})` : '';
          const payload: Transaction = {
            id: instId,
            user_id: effectiveUid,
            type: 'expense',
            amount: instAmt,
            date: statementDueDate,
            due_date: statementDueDate,
            category: entryCategory,
            description: `[Cartão ${selectedCardObj.name}] ${labelDesc}${parcelSuffix}`,
            payment_status: 'pending',
            payment_date: null,
            is_recurring: nInst > 1,
            recurrence_frequency: nInst > 1 ? 'monthly' : undefined,
            recurrence_installments: nInst > 1 ? nInst : null,
            recurrence_group_id: groupId,
            installment_number: nInst > 1 ? i : null,
            installment_total: nInst > 1 ? nInst : null,
            card_id: selectedCardObj.id,
            card_name: selectedCardObj.name,
            card_installments: nInst,
            card_installment_index: i,
            created_at: new Date().toISOString(),
          };
          batch.push(payload);
          syncQueueManager.enqueue('transactions', 'insert', instId, payload);
        }

        planningStorage.linkTxsToCard(effectiveUid, batchIds, selectedCardObj.id);
        setTxCardMap(planningStorage.getTxCardMap(effectiveUid));

        const firstDue = batch[0]?.date;
        if (firstDue) {
          const [y, m] = firstDue.split('-').map(Number);
          navigateToMonth(new Date(y, m - 1, 1, 12, 0, 0), firstDue);
          setRightPanelTab('day');
        }

        const firstMonthLabel = firstDue
          ? format(new Date(firstDue + 'T12:00:00'), "MMM/yyyy", { locale: ptBR })
          : '';
        toast.success(
          nInst > 1
            ? `Compra ${nInst}x lançada na fatura de ${firstMonthLabel} (${selectedCardObj.name})!`
            : `Compra lançada na fatura de ${firstMonthLabel} (${selectedCardObj.name})!`
        );
      } else {
        // Planned Standalone/Recurring Bill OR Planned Income
        const isIncomeMode = entryMode === 'income';
        const nInst = billRepeat ? Math.max(2, Math.min(36, Number(billRepeatCount) || 6)) : 1;
        const groupId = nInst > 1 ? generateUUID() : null;
        const labelDesc =
          entryDescription.trim() ||
          entryCategory ||
          (isIncomeMode ? 'Receita prevista' : 'Conta agendada');

        for (let i = 1; i <= nInst; i++) {
          const instDate =
            i === 1 ? entryDate : calculateNextOccurrence(entryDate, billFrequency, i - 1);
          const instId = generateUUID();
          const parcelSuffix = nInst > 1 ? ` (${i}/${nInst})` : '';
          const payload: Transaction = {
            id: instId,
            user_id: effectiveUid,
            type: isIncomeMode ? 'income' : 'expense',
            amount: rawVal,
            date: instDate,
            due_date: instDate,
            category: entryCategory,
            description: `${labelDesc}${parcelSuffix}`,
            payment_status: 'pending',
            payment_date: null,
            is_recurring: nInst > 1,
            recurrence_frequency: nInst > 1 ? billFrequency : undefined,
            recurrence_installments: nInst > 1 ? nInst : null,
            recurrence_group_id: groupId,
            installment_number: nInst > 1 ? i : null,
            installment_total: nInst > 1 ? nInst : null,
            created_at: new Date().toISOString(),
          };
          batch.push(payload);
          syncQueueManager.enqueue('transactions', 'insert', instId, payload);
        }

        const [y, m] = entryDate.split('-').map(Number);
        navigateToMonth(new Date(y, m - 1, 1, 12, 0, 0), entryDate);
        setRightPanelTab('day');
        toast.success(
          isIncomeMode
            ? nInst > 1
              ? `${nInst} receitas recorrentes agendadas!`
              : 'Receita prevista agendada no calendário!'
            : nInst > 1
              ? `${nInst} contas recorrentes agendadas!`
              : 'Conta agendada no calendário!'
        );
      }

      setTransactions(prev => {
        const next = [...batch, ...prev];
        cacheManager.set(`transactions_${effectiveUid}`, next, undefined, 'transactions');
        cacheManager.set('last_known_transactions', next, undefined, 'transactions');
        return next;
      });
      setShowEntryModal(false);
    } catch {
      toast.error('Erro ao salvar lançamento.');
    } finally {
      setSavingEntry(false);
    }
  };

  const handleTogglePayItem = async (item: NormalizedPlannedItem) => {
    const newStatus = item.paymentStatus === 'pending' ? 'paid' : 'pending';
    const newPayDate = newStatus === 'paid' ? getTodayLocalDateStr() : null;
    try {
      if (item.isReserveTx) {
        await updateReserveTransaction(item.id, {
          payment_status: newStatus,
          payment_date: newPayDate,
        });
      } else {
        await updateTransaction(
          item.id,
          { payment_status: newStatus, payment_date: newPayDate },
          { silent: true }
        );
        if (item.kind === 'income') {
          toast.success(newStatus === 'paid' ? 'Receita confirmada no caixa!' : 'Receita marcada como prevista.');
        } else {
          toast.success(newStatus === 'paid' ? 'Conta quitada!' : 'Conta marcada como pendente.');
        }
      }
    } catch {
      toast.error('Erro ao atualizar status.');
    }
  };

  const handleShiftItemMonth = async (item: NormalizedPlannedItem, deltaMonths: number) => {
    const nextDate = calculateNextOccurrence(item.dateStr, 'monthly', deltaMonths);
    try {
      if (item.isReserveTx) {
        await updateReserveTransaction(item.id, {
          date: nextDate,
          due_date: nextDate,
        });
      } else {
        await updateTransaction(
          item.id,
          { date: nextDate, due_date: nextDate },
          { silent: true }
        );
      }
      const label = format(new Date(nextDate + 'T12:00:00'), 'dd/MM/yyyy');
      toast.success(
        item.isCard
          ? `Enviado para a fatura de ${format(new Date(nextDate + 'T12:00:00'), 'MMM/yyyy', { locale: ptBR })} (${label})!`
          : `Vencimento alterado para ${label}!`
      );
    } catch {
      toast.error('Erro ao reagendar lançamento.');
    }
  };

  const handleConfirmShiftTarget = async () => {
    if (!shiftConfirmTarget || confirmingShift) return;
    setConfirmingShift(true);
    try {
      if (shiftConfirmTarget.mode === 'single') {
        await handleShiftItemMonth(shiftConfirmTarget.item, shiftConfirmTarget.deltaMonths);
      } else {
        for (const item of shiftConfirmTarget.items) {
          const nextDate = calculateNextOccurrence(item.dateStr, 'monthly', shiftConfirmTarget.deltaMonths);
          if (item.isReserveTx) {
            await updateReserveTransaction(item.id, { date: nextDate, due_date: nextDate });
          } else {
            await updateTransaction(item.id, { date: nextDate, due_date: nextDate }, { silent: true });
          }
        }
        setSelectedBatchIds([]);
        toast.success(`${shiftConfirmTarget.items.length} lançamento(s) enviado(s) para o próximo mês!`);
      }
      setShiftConfirmTarget(null);
    } catch {
      toast.error('Erro ao transferir lançamento(s).');
    } finally {
      setConfirmingShift(false);
    }
  };

  const handleMoveItemToCurrentMonth = async (item: NormalizedPlannedItem) => {
    const targetYear = currentMonth.getFullYear();
    const targetMonthIdx = currentMonth.getMonth();
    const maxDay = endOfMonth(currentMonth).getDate();
    const origDay = Number(item.dateStr.split('-')[2]) || 1;
    const clampedDay = Math.max(1, Math.min(origDay, maxDay));
    const targetDate = `${targetYear}-${String(targetMonthIdx + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;

    try {
      if (item.isReserveTx) {
        await updateReserveTransaction(item.id, {
          date: targetDate,
          due_date: targetDate,
        });
      } else {
        await updateTransaction(
          item.id,
          { date: targetDate, due_date: targetDate },
          { silent: true }
        );
      }
      toast.success(`Movido para ${format(new Date(targetDate + 'T12:00:00'), 'dd/MM/yyyy')}!`);
    } catch {
      toast.error('Erro ao mover para este mês.');
    }
  };

  const handleDuplicateItemNextMonth = async (item: NormalizedPlannedItem) => {
    if (item.isReserveTx) {
      toast.info('Despesas de reserva devem ser duplicadas na aba Reservas.');
      return;
    }
    const effectiveUid = userId || (await getEffectiveUserId()) || 'default';
    const nextDate = calculateNextOccurrence(item.dateStr, 'monthly', 1);
    const newId = generateUUID();
    const payload: Transaction = {
      id: newId,
      user_id: effectiveUid,
      type: item.kind,
      amount: item.amount,
      date: nextDate,
      due_date: nextDate,
      category: item.category,
      description: item.description.replace(/\s*\(\d+\/\d+\)\s*$/, ''),
      payment_status: 'pending',
      payment_date: null,
      card_id: item.cardId,
      card_name: item.cardId ? cardLookup[item.cardId]?.name || null : null,
      created_at: new Date().toISOString(),
    };
    syncQueueManager.enqueue('transactions', 'insert', newId, payload);
    if (item.cardId) {
      planningStorage.linkTxsToCard(effectiveUid, [newId], item.cardId);
      setTxCardMap(planningStorage.getTxCardMap(effectiveUid));
    }
    setTransactions(prev => {
      const next = [payload, ...prev];
      cacheManager.set(`transactions_${effectiveUid}`, next, undefined, 'transactions');
      cacheManager.set('last_known_transactions', next, undefined, 'transactions');
      return next;
    });
    toast.success(`Duplicado para ${format(new Date(nextDate + 'T12:00:00'), 'dd/MM/yyyy')}!`);
  };

  const handleConfirmDuplicateNextMonth = async () => {
    if (!duplicateConfirmItem || confirmingDuplicate) return;
    setConfirmingDuplicate(true);
    try {
      await handleDuplicateItemNextMonth(duplicateConfirmItem);
      setDuplicateConfirmItem(null);
    } catch {
      toast.error('Erro ao copiar lançamento para o próximo mês.');
    } finally {
      setConfirmingDuplicate(false);
    }
  };

  const handleSettleDayPending = async () => {
    if (selectedDayPendingExpenses.length === 0) return;
    const payDate = getTodayLocalDateStr();
    try {
      for (const item of selectedDayPendingExpenses) {
        if (item.isReserveTx) {
          await updateReserveTransaction(item.id, {
            payment_status: 'paid',
            payment_date: payDate,
          });
        } else {
          await updateTransaction(
            item.id,
            { payment_status: 'paid', payment_date: payDate },
            { silent: true }
          );
        }
      }
      toast.success(`${selectedDayPendingExpenses.length} contas do dia quitadas!`);
    } catch {
      toast.error('Erro ao quitar contas do dia.');
    }
  };

  const handleSettleAllOverdue = async () => {
    const overdueItems = globalPendingExpenseItems.filter(i => i.dateStr < todayStr);
    if (overdueItems.length === 0) return;
    const payDate = getTodayLocalDateStr();
    try {
      for (const item of overdueItems) {
        if (item.isReserveTx) {
          await updateReserveTransaction(item.id, {
            payment_status: 'paid',
            payment_date: payDate,
          });
        } else {
          await updateTransaction(
            item.id,
            { payment_status: 'paid', payment_date: payDate },
            { silent: true }
          );
        }
      }
      toast.success(`${overdueItems.length} contas vencidas quitadas!`);
    } catch {
      toast.error('Erro ao quitar contas vencidas.');
    }
  };

  const handleBatchSettleSelected = async () => {
    const targets = monthItems.filter(i => selectedBatchIds.includes(i.id) && i.paymentStatus === 'pending');
    if (targets.length === 0) return;
    const payDate = getTodayLocalDateStr();
    try {
      for (const item of targets) {
        if (item.isReserveTx) {
          await updateReserveTransaction(item.id, { payment_status: 'paid', payment_date: payDate });
        } else {
          await updateTransaction(item.id, { payment_status: 'paid', payment_date: payDate }, { silent: true });
        }
      }
      setSelectedBatchIds([]);
      toast.success(`${targets.length} lançamento(s) quitado(s)!`);
    } catch {
      toast.error('Erro ao quitar itens selecionados.');
    }
  };

  const handleRequestBatchShiftNextMonth = () => {
    const targets = monthItems.filter(i => selectedBatchIds.includes(i.id));
    if (targets.length === 0) return;
    setShiftConfirmTarget({ mode: 'batch', items: targets, deltaMonths: 1 });
  };

  const handleSettleCardInvoice = async (card: CreditCardConfig) => {
    const inv = cardInvoices[card.id];
    if (!inv || inv.currentMonthPendingIds.length === 0) return;
    const payDate = getTodayLocalDateStr();
    try {
      for (const txId of inv.currentMonthPendingIds) {
        await updateTransaction(
          txId,
          { payment_status: 'paid', payment_date: payDate },
          { silent: true }
        );
      }
      toast.success(`Fatura do ${card.name} quitada (${inv.currentMonthPendingIds.length} itens)!`);
    } catch {
      toast.error('Erro ao quitar fatura do cartão.');
    }
  };

  const handleSettleInstallmentGroup = async (groupId: string) => {
    const targets = plannedItems.filter(
      p => p.recurrenceGroupId === groupId && p.paymentStatus === 'pending'
    );
    if (targets.length === 0) return;
    const payDate = getTodayLocalDateStr();
    try {
      for (const item of targets) {
        if (item.isReserveTx) {
          await updateReserveTransaction(item.id, { payment_status: 'paid', payment_date: payDate });
        } else {
          await updateTransaction(item.id, { payment_status: 'paid', payment_date: payDate }, { silent: true });
        }
      }
      toast.success(`${targets.length} parcela(s) quitada(s) com sucesso!`);
    } catch {
      toast.error('Erro ao antecipar/quitar parcelas.');
    }
  };

  const handleOpenEditItem = (item: NormalizedPlannedItem) => {
    setEditingItem(item);
    setEditAmount(String(item.amount));
    setEditDate(item.dateStr);
    setEditCategory(item.category);
    setEditDescription(item.description);
    setEditStatus(item.paymentStatus);
    setEditCardId(item.cardId || '__none__');
  };

  const handleSaveEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || savingEdit) return;
    const parsedAmt = Number(editAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      toast.error('Informe um valor maior que zero.');
      return;
    }
    const effectiveUid = userId || (await getEffectiveUserId()) || 'default';
    setSavingEdit(true);
    try {
      if (editingItem.isReserveTx) {
        await updateReserveTransaction(editingItem.id, {
          amount: parsedAmt,
          date: editDate,
          due_date: editDate,
          category: editCategory,
          description: editDescription.trim() || editCategory,
          payment_status: editStatus,
          payment_date: editStatus === 'paid' ? (editingItem.rawTx?.payment_date || getTodayLocalDateStr()) : null,
        });
      } else {
        let cleanedDesc = editDescription.trim() || editCategory;
        const chosenCard =
          editingItem.kind === 'expense' && editCardId !== '__none__'
            ? cards.find(c => c.id === editCardId) || null
            : null;

        cleanedDesc = cleanedDesc.replace(/^\[Cart[ãa]o [^\]]+\]\s*/i, '').trim();
        if (chosenCard) {
          cleanedDesc = `[Cartão ${chosenCard.name}] ${cleanedDesc}`;
          planningStorage.linkTxsToCard(effectiveUid, [editingItem.id], chosenCard.id);
        } else {
          planningStorage.unlinkTxFromCard(effectiveUid, editingItem.id);
        }
        setTxCardMap(planningStorage.getTxCardMap(effectiveUid));

        await updateTransaction(
          editingItem.id,
          {
            amount: parsedAmt,
            date: editDate,
            due_date: editDate,
            category: editCategory,
            description: cleanedDesc,
            payment_status: editStatus,
            payment_date: editStatus === 'paid' ? (editingItem.rawTx?.payment_date || getTodayLocalDateStr()) : null,
            card_id: chosenCard ? chosenCard.id : null,
            card_name: chosenCard ? chosenCard.name : null,
          },
          { silent: true }
        );
      }

      toast.success('Lançamento atualizado!');
      setEditingItem(null);
    } catch {
      toast.error('Erro ao atualizar lançamento.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRequestDeleteItem = (item: NormalizedPlannedItem) => {
    if (item.isReserveTx) {
      toast.info('Despesas de reserva podem ser removidas no Extrato ou em Reservas.');
      return;
    }
    if (item.recurrenceGroupId) {
      setDeleteTargetItem(item);
      return;
    }
    executeDeleteSingleItem(item);
  };

  const executeDeleteSingleItem = async (item: NormalizedPlannedItem) => {
    const effectiveUid = userId || (await getEffectiveUserId()) || 'default';
    try {
      await deleteTransaction(item.id);
      planningStorage.unlinkTxFromCard(effectiveUid, item.id);
      setTxCardMap(planningStorage.getTxCardMap(effectiveUid));
      setDeleteTargetItem(null);
    } catch {
      toast.error('Erro ao remover lançamento.');
    }
  };

  const executeDeleteGroupPending = async (item: NormalizedPlannedItem) => {
    if (!item.recurrenceGroupId) return;
    const effectiveUid = userId || (await getEffectiveUserId()) || 'default';
    const targets = plannedItems.filter(
      p =>
        !p.isReserveTx &&
        p.recurrenceGroupId === item.recurrenceGroupId &&
        (p.paymentStatus === 'pending' || p.id === item.id)
    );
    try {
      for (const t of targets) {
        await deleteTransaction(t.id, { silent: true });
        planningStorage.unlinkTxFromCard(effectiveUid, t.id);
      }
      setTxCardMap(planningStorage.getTxCardMap(effectiveUid));
      setDeleteTargetItem(null);
      toast.success(`${targets.length} parcela(s) removida(s)!`);
    } catch {
      toast.error('Erro ao remover parcelas do grupo.');
    }
  };

  const handleSaveCategoryBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetModalCategory) return;
    const effectiveUid = userId || (await getEffectiveUserId()) || 'default';
    const parsed = Number(budgetModalLimit);
    const nextBudgets = { ...categoryBudgets };
    if (!parsed || parsed <= 0) {
      delete nextBudgets[budgetModalCategory];
      toast.success(`Limite removido para ${budgetModalCategory}.`);
    } else {
      nextBudgets[budgetModalCategory] = parsed;
      toast.success(`Teto mensal de ${formatCurrency(parsed)} salvo para ${budgetModalCategory}!`);
    }
    setCategoryBudgets(nextBudgets);
    planningStorage.saveCategoryBudgets(effectiveUid, nextBudgets);
    setBudgetModalCategory(null);
  };

  const jumpToDate = (dateStr: string) => {
    const [y, m] = dateStr.split('-').map(Number);
    if (y && m) {
      navigateToMonth(new Date(y, m - 1, 1, 12, 0, 0), dateStr);
    } else {
      setSelectedDayStr(dateStr);
    }
    setRightPanelTab('day');
  };

  const getCardById = (cardId: string | null) => (cardId ? cardLookup[cardId] || null : null);

  const toggleBatchItem = (id: string) => {
    setSelectedBatchIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const toggleAllMonthBatch = () => {
    if (selectedBatchIds.length === monthItems.length && monthItems.length > 0) {
      setSelectedBatchIds([]);
    } else {
      setSelectedBatchIds(monthItems.map(i => i.id));
    }
  };

  const viewedMonthLabel = format(currentMonth, 'MMM/yy', { locale: ptBR });
  const nextMonthLabel = format(addMonths(currentMonth, 1), 'MMM/yy', { locale: ptBR });

  const monthCoveragePct = useMemo(() => {
    if (monthSummary.totalPending <= 0) return 100;
    const available = Math.max(0, bancaLivre + monthSummary.incomesPending);
    return Math.min(100, Math.round((available / monthSummary.totalPending) * 100));
  }, [bancaLivre, monthSummary.incomesPending, monthSummary.totalPending]);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-5 animate-fade-in">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4 border-b border-border/60 pb-4 sm:pb-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <CalendarRange className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-foreground leading-tight">
              Calendário de Contas &amp; Cartões
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
              Controle faturas, compras parceladas, contas agendadas e receitas previstas com previsão real de caixa.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenNewCard(false)}
            className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-extrabold gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500 shrink-0" />
            <span className="truncate">Novo Cartão</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenNewEntry('income')}
            className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-extrabold gap-1.5 border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer whitespace-nowrap"
          >
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">+ Receita Prevista</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenNewEntry('bill')}
            className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-extrabold gap-1.5 border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 cursor-pointer whitespace-nowrap"
          >
            <ReceiptText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">+ Conta Planejada</span>
          </Button>
          <Button
            type="button"
            onClick={() => handleOpenNewEntry('card')}
            className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">+ Compra Cartão</span>
          </Button>
        </div>
      </header>

      {/* Top KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card
          onClick={() => setRightPanelTab('pending')}
          className="col-span-2 md:col-span-1 border border-indigo-500/40 bg-indigo-500/[0.06] rounded-2xl cursor-pointer hover:border-indigo-500/70 transition-colors"
          title="Clique para listar todas as pendências em aberto"
        >
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center justify-between gap-1">
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Total Pendente Geral
              </span>
              <span className="font-mono tabular-nums text-[10px] font-black">
                {globalPendingSummary.pendingCount}
              </span>
            </span>
            <p className="text-lg sm:text-xl font-black font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
              {formatCurrency(globalPendingSummary.totalPendingAll)}
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold truncate tabular-nums">
              Cartões: {formatCurrency(globalPendingSummary.totalPendingCardsAll)} • Avulsas:{' '}
              {formatCurrency(globalPendingSummary.totalPendingBillsAll)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 rounded-2xl bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5" /> Faturas ({viewedMonthLabel})
            </span>
            <p className="text-lg sm:text-xl font-black font-mono tabular-nums text-foreground">
              {formatCurrency(monthSummary.cardsTotal)}
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold tabular-nums">
              Em aberto no mês: {formatCurrency(monthSummary.cardsPending)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 rounded-2xl bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> A Pagar ({viewedMonthLabel})
            </span>
            <p className="text-lg sm:text-xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
              {formatCurrency(monthSummary.totalPending)}
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold tabular-nums">
              Avulsas: {formatCurrency(monthSummary.billsPending)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 rounded-2xl bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Quitado ({viewedMonthLabel})
            </span>
            <p className="text-lg sm:text-xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(monthSummary.totalPaid)}
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold tabular-nums">
              A receber no mês: {formatCurrency(monthSummary.incomesPending)}
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setPendingScopeFilter('overdue');
            setRightPanelTab('pending');
          }}
          className={`border rounded-2xl cursor-pointer transition-colors ${
            globalPendingSummary.overdueAllCount > 0
              ? 'border-rose-500/45 bg-rose-500/[0.06] hover:border-rose-500/75'
              : 'border-border/80 bg-card'
          }`}
          title="Clique para inspecionar contas em atraso"
        >
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Em Atraso (Total)
            </span>
            <p className="text-lg sm:text-xl font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
              {formatCurrency(globalPendingSummary.overdueAllAmount)}
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold tabular-nums">
              {globalPendingSummary.overdueAllCount}{' '}
              {globalPendingSummary.overdueAllCount === 1 ? 'conta vencida' : 'contas vencidas'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Coverage Strip */}
      <Card className="border border-border/80 rounded-2xl bg-card">
        <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Wallet className="w-3 h-3 text-primary" /> Caixa Livre Atual
              </span>
              <p className={`text-sm sm:text-base font-black font-mono tabular-nums mt-0.5 ${bancaLivre >= 0 ? 'text-foreground' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatCurrency(bancaLivre)}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-emerald-500" /> + A Receber ({viewedMonthLabel})
              </span>
              <p className="text-sm sm:text-base font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatCurrency(monthSummary.incomesPending)}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3 text-amber-500" /> - Pendente ({viewedMonthLabel})
              </span>
              <p className="text-sm sm:text-base font-black font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                {formatCurrency(monthSummary.totalPending)}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-indigo-500" /> Saldo Projetado
              </span>
              <p
                className={`text-sm sm:text-base font-black font-mono tabular-nums mt-0.5 ${
                  monthSummary.projectedBalanceAfterMonth >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatCurrency(monthSummary.projectedBalanceAfterMonth)}
              </p>
            </div>
          </div>

          <div className="lg:w-64 space-y-1.5 shrink-0 border-t lg:border-t-0 lg:border-l border-border/50 pt-3 lg:pt-0 lg:pl-4">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-muted-foreground">Cobertura do Mês</span>
              <span
                className={`font-mono tabular-nums font-black ${
                  monthSummary.projectedBalanceAfterMonth >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {monthCoveragePct}%
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  monthSummary.projectedBalanceAfterMonth >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
                style={{ width: `${monthCoveragePct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">
              {monthSummary.totalPending === 0
                ? 'Sem pendências restantes neste mês.'
                : monthSummary.projectedBalanceAfterMonth >= 0
                  ? 'Caixa atual + receitas previstas cobrem todas as contas.'
                  : 'Saldo previsto negativo — considere antecipar receitas ou ajustar contas.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Credit Cards Strip */}
      <Card className="border border-border/80 rounded-2xl bg-card">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-500" /> Meus Cartões de Crédito
              </CardTitle>
              <CardDescription className="text-[11px]">
                Clique em um cartão para filtrar o calendário, confira o melhor dia de compra ou quite a fatura com 1 clique.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setFilterCardId(filterCardId === 'no_card' ? 'all' : 'no_card')}
                className={`h-7 px-2.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                  filterCardId === 'no_card'
                    ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    : 'border-border/70 bg-muted/20 text-muted-foreground hover:text-foreground'
                }`}
              >
                Só Contas Avulsas
              </button>
              {filterCardId !== 'all' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterCardId('all')}
                  className="h-7 text-[11px] font-bold rounded-lg cursor-pointer"
                >
                  Mostrar Todos
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {cards.length === 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-dashed border-border bg-muted/20">
              <div className="space-y-0.5">
                <p className="text-xs font-black text-foreground">
                  Nenhum cartão de crédito cadastrado ainda
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Adicione seu Nubank, Inter, Itaú ou outro cartão para calcular vencimentos e parcelas automaticamente.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => handleOpenNewCard(false)}
                className="rounded-xl text-xs font-black shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Cadastrar Primeiro Cartão
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cards.map(card => {
                const inv = cardInvoices[card.id] || {
                  currentMonthTotal: 0,
                  currentMonthPending: 0,
                  currentMonthPaid: 0,
                  currentMonthPendingIds: [],
                  nextMonthTotal: 0,
                  nextMonthPending: 0,
                  totalCommittedAllFuture: 0,
                };
                const cycle = getCardCycleStatus(card, todayStr);
                const isFiltered = filterCardId === card.id;
                const limitUsagePct =
                  card.limit && card.limit > 0
                    ? Math.min(100, (inv.totalCommittedAllFuture / card.limit) * 100)
                    : 0;

                return (
                  <div
                    key={card.id}
                    onClick={() => setFilterCardId(isFiltered ? 'all' : card.id)}
                    className={`rounded-xl border p-3.5 space-y-2.5 transition-colors cursor-pointer ${
                      isFiltered
                        ? 'border-purple-500 bg-purple-500/[0.06] ring-1 ring-purple-500/30'
                        : 'border-border/70 bg-muted/15 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: card.color }}
                        >
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-black text-foreground truncate">{card.name}</p>
                          </div>
                          <p className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                            Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                          </p>
                        </div>
                      </div>
                      <div
                        className="flex items-center gap-0.5 shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenNewEntry('card', undefined, card.id)}
                          className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                          title={`Nova compra no ${card.name}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditCard(card)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title="Editar cartão"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCard(card.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Excluir cartão"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Best purchase day / cycle status */}
                    <div className="flex items-center justify-between text-[10px] font-bold px-2 py-1 rounded-lg bg-muted/40 border border-border/40">
                      <span className="text-muted-foreground">
                        Melhor dia: <strong className="text-foreground tabular-nums">dia {card.closingDay}</strong>
                      </span>
                      <span className={cycle.isBestPurchaseWindow ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                        {cycle.isBestPurchaseWindow
                          ? `Fatura fechada • vence ${format(new Date(cycle.nextPurchaseDueInfo.statementDueDate + 'T12:00:00'), 'dd/MM')}`
                          : `Fecha em ${cycle.daysUntilClosing}d`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40 text-[11px]">
                      <div>
                        <span className="text-[9px] font-bold uppercase text-muted-foreground block">
                          Fatura ({viewedMonthLabel})
                        </span>
                        <span className="font-mono tabular-nums font-black text-foreground">
                          {formatCurrency(inv.currentMonthTotal)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase text-muted-foreground block">
                          Próx. ({nextMonthLabel})
                        </span>
                        <span className="font-mono tabular-nums font-bold text-muted-foreground">
                          {formatCurrency(inv.nextMonthTotal)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400 block">
                          Total Aberto
                        </span>
                        <span className="font-mono tabular-nums font-black text-amber-600 dark:text-amber-400">
                          {formatCurrency(inv.totalCommittedAllFuture)}
                        </span>
                      </div>
                    </div>

                    {card.limit && card.limit > 0 && (
                      <div className="space-y-1">
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${limitUsagePct}%`,
                              backgroundColor: limitUsagePct > 85 ? '#dc2626' : card.color,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[9.5px] font-semibold text-muted-foreground tabular-nums">
                          <span>Disp.: {formatCurrency(Math.max(0, card.limit - inv.totalCommittedAllFuture))}</span>
                          <span>Lim.: {formatCurrency(card.limit)} ({Math.round(limitUsagePct)}%)</span>
                        </div>
                      </div>
                    )}

                    {inv.currentMonthPending > 0 && (
                      <div onClick={e => e.stopPropagation()} className="pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleSettleCardInvoice(card)}
                          className="w-full h-8 rounded-xl text-[11px] font-extrabold border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          Quitar Fatura ({formatCurrency(inv.currentMonthPending)})
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter & View Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-2xl border border-border/80 bg-card">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar conta, cartão ou categoria..."
              className="h-9 pl-8 pr-7 rounded-xl text-xs font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Select value={kindFilter} onValueChange={(v: KindFilter) => setKindFilter(v)}>
            <SelectTrigger className="h-9 flex-1 sm:flex-none sm:w-[145px] rounded-xl text-xs font-bold">
              <SelectValue>
                {v => {
                  switch (v) {
                    case 'cards': return 'Só Cartões';
                    case 'bills': return 'Só Contas';
                    case 'incomes': return 'Só Receitas';
                    default: return 'Todos os Tipos';
                  }
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              <SelectItem value="cards">Só Cartões</SelectItem>
              <SelectItem value="bills">Só Contas Avulsas</SelectItem>
              <SelectItem value="incomes">Só Receitas Previstas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
            <SelectTrigger className="h-9 flex-1 sm:flex-none sm:w-[140px] rounded-xl text-xs font-bold">
              <SelectValue>
                {v => {
                  switch (v) {
                    case 'pending': return 'Pendentes';
                    case 'overdue': return 'Em Atraso';
                    case 'paid': return 'Quitados';
                    default: return 'Todos Status';
                  }
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="overdue">Em Atraso</SelectItem>
              <SelectItem value="paid">Quitados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Main View Mode Switcher */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-muted/50 rounded-xl border border-border/50 w-full md:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setMainView('calendar')}
            className={`h-7 px-1.5 sm:px-3 rounded-lg text-[10.5px] sm:text-[11px] font-black inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              mainView === 'calendar'
                ? 'bg-card text-foreground border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>Calendário</span>
          </button>
          <button
            type="button"
            onClick={() => setMainView('list')}
            className={`h-7 px-1.5 sm:px-3 rounded-lg text-[10.5px] sm:text-[11px] font-black inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              mainView === 'list'
                ? 'bg-card text-foreground border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListChecks className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>Lista ({monthItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMainView('installments')}
            className={`h-7 px-1.5 sm:px-3 rounded-lg text-[10.5px] sm:text-[11px] font-black inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              mainView === 'installments'
                ? 'bg-card text-foreground border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Repeat className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>Parcelas ({installmentGroups.length})</span>
          </button>
        </div>
      </div>

      {/* Main Split: Calendar/List/Installments + Day/Pending/Categories Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-border/80 rounded-2xl bg-card">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => navigateToMonth(subMonths(currentMonth, 1))}
                  className="h-8 w-8 rounded-xl cursor-pointer"
                  title="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-sm sm:text-base font-black capitalize text-foreground min-w-[155px] text-center">
                  {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => navigateToMonth(addMonths(currentMonth, 1))}
                  className="h-8 w-8 rounded-xl cursor-pointer"
                  title="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowSpotPaidExpenses(prev => !prev)}
                  className={`h-8 px-2.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    showSpotPaidExpenses
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border/70 bg-muted/20 text-muted-foreground hover:text-foreground'
                  }`}
                  title="Exibir ou ocultar lançamentos avulsos já pagos no dia a dia"
                >
                  {showSpotPaidExpenses ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Avulsos pagos</span>
                </button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigateToMonth(startOfMonth(new Date()), getTodayLocalDateStr());
                    setRightPanelTab('day');
                  }}
                  className="h-8 px-3 rounded-xl text-xs font-bold gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Hoje
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-3 sm:p-4">
            {mainView === 'calendar' && (
              <>
                <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                    <div
                      key={d}
                      className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground py-1"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {calendarDays.map(day => {
                    const dStr = format(day, 'yyyy-MM-dd');
                    const inMonth = isSameMonth(day, currentMonth);
                    const isToday = dStr === todayStr;
                    const isSelected = dStr === selectedDayStr && rightPanelTab === 'day';
                    const dayItems = itemsByDay[dStr] || [];

                    const pendingExpenseTotal = dayItems
                      .filter(i => i.kind === 'expense' && i.paymentStatus === 'pending')
                      .reduce((s, i) => s + i.amount, 0);
                    const paidExpenseTotal = dayItems
                      .filter(i => i.kind === 'expense' && i.paymentStatus === 'paid')
                      .reduce((s, i) => s + i.amount, 0);
                    const incomeTotal = dayItems
                      .filter(i => i.kind === 'income')
                      .reduce((s, i) => s + i.amount, 0);
                    const hasOverdue = dayItems.some(
                      i => i.kind === 'expense' && i.paymentStatus === 'pending' && dStr < todayStr
                    );

                    const daysInThisMonth = endOfMonth(day).getDate();
                    const cardsClosingThisDay = inMonth
                      ? cards.filter(c => Math.min(c.closingDay, daysInThisMonth) === day.getDate())
                      : [];
                    const cardsDueThisDay = inMonth
                      ? cards.filter(c => Math.min(c.dueDay, daysInThisMonth) === day.getDate())
                      : [];

                    return (
                      <div
                        key={dStr}
                        onClick={() => {
                          setSelectedDayStr(dStr);
                          if (!inMonth) {
                            navigateToMonth(startOfMonth(day), dStr);
                          }
                          setRightPanelTab('day');
                        }}
                        className={`group relative min-h-[64px] sm:min-h-[90px] rounded-lg sm:rounded-xl border p-1 sm:p-1.5 flex flex-col justify-between text-left transition-colors cursor-pointer overflow-hidden ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/40'
                            : isToday
                              ? 'border-primary/60 bg-primary/[0.04]'
                              : inMonth
                                ? 'border-border/60 bg-muted/10 hover:bg-muted/30'
                                : 'border-border/20 bg-muted/[0.03] opacity-40'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full gap-1">
                          <span
                            className={`text-[11px] font-black leading-none tabular-nums ${
                              isToday
                                ? 'bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md'
                                : 'text-foreground'
                            }`}
                          >
                            {day.getDate()}
                          </span>

                          <div className="flex items-center gap-0.5">
                            {cardsClosingThisDay.slice(0, 2).map(c => (
                              <span
                                key={`close-${c.id}`}
                                className="w-2 h-2 rounded-full ring-1 ring-background"
                                style={{ backgroundColor: c.color }}
                                title={`Fechamento ${c.name} (dia ${c.closingDay})`}
                              />
                            ))}
                            {cardsDueThisDay.slice(0, 2).map(c => (
                              <span
                                key={`due-${c.id}`}
                                className="w-2 h-2 rounded-xs border border-foreground/40"
                                style={{ backgroundColor: c.color }}
                                title={`Vencimento ${c.name} (dia ${c.dueDay})`}
                              />
                            ))}
                            {inMonth && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedDayStr(dStr);
                                  handleOpenNewEntry('bill', dStr);
                                }}
                                className="opacity-0 group-hover:opacity-100 hidden sm:inline-flex items-center justify-center w-4 h-4 rounded bg-muted hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-opacity cursor-pointer"
                                title={`Agendar em ${format(day, 'dd/MM')}`}
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-0.5 w-full">
                          {incomeTotal > 0 && (
                            <div
                              className="text-[9px] sm:text-[10px] font-mono tabular-nums font-black px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35 truncate"
                              title={`Receitas: +${formatCurrency(incomeTotal)}`}
                            >
                              {hideValues ? '•••' : `↑ +${Math.round(incomeTotal)}`}
                            </div>
                          )}
                          {pendingExpenseTotal > 0 && (
                            <div
                              className={`text-[9px] sm:text-[10px] font-mono tabular-nums font-black px-1 py-0.5 rounded border truncate ${
                                hasOverdue
                                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/35'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              }`}
                              title={`Despesas pendentes: -${formatCurrency(pendingExpenseTotal)}`}
                            >
                              {hideValues ? '•••' : `${hasOverdue ? '! ' : ''}-${Math.round(pendingExpenseTotal)}`}
                            </div>
                          )}
                          {paidExpenseTotal > 0 && (
                            <div
                              className="text-[9px] font-mono tabular-nums font-bold px-1 py-0.5 rounded bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/25 truncate"
                              title={`Despesas quitadas: -${formatCurrency(paidExpenseTotal)}`}
                            >
                              {hideValues ? '•••' : `✓ -${Math.round(paidExpenseTotal)}`}
                            </div>
                          )}
                          {dayItems.length > 0 && (
                            <p className="text-[8.5px] font-bold text-muted-foreground truncate px-0.5 tabular-nums">
                              {dayItems.length} {dayItems.length === 1 ? 'item' : 'itens'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-border/40 text-[10px] text-muted-foreground font-semibold">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500" /> Fechamento Cartão
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-xs bg-purple-500 border border-foreground/40" /> Vencimento Cartão
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35 font-extrabold">
                      ↑ + Receita
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-extrabold">
                      - A Pagar
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/35 font-extrabold">
                      ! - Vencida
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/25 font-extrabold">
                      ✓ - Paga
                    </span>
                  </div>
                </div>
              </>
            )}

            {mainView === 'list' && (
              <div className="space-y-3">
                {/* Batch Actions Bar */}
                {selectedBatchIds.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10">
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                      {selectedBatchIds.length} selecionado(s)
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleBatchSettleSelected}
                        className="h-7 rounded-lg text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Quitar Selecionadas
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleRequestBatchShiftNextMonth}
                        className="h-7 rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        <CalendarPlus className="w-3.5 h-3.5 mr-1" /> Mandar p/ Próx. Mês
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedBatchIds([])}
                        className="h-7 rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        Limpar
                      </Button>
                    </div>
                  </div>
                )}

                {monthItems.length === 0 ? (
                  <div className="py-12 text-center space-y-2.5">
                    <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs font-bold text-muted-foreground">
                      Nenhum lançamento encontrado para {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })} com os filtros atuais.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenNewEntry('bill')}
                      className="h-8 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Agendar Conta neste Mês
                    </Button>
                  </div>
                ) : (
                  <div className="border border-border/60 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/50 text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      <button
                        type="button"
                        onClick={toggleAllMonthBatch}
                        className="inline-flex items-center gap-2 hover:text-foreground cursor-pointer"
                      >
                        {selectedBatchIds.length === monthItems.length && monthItems.length > 0 ? (
                          <CheckSquare className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                        <span>Selecionar Todos</span>
                      </button>
                      <span className="tabular-nums">{monthItems.length} lançamento(s)</span>
                    </div>

                    <div className="divide-y divide-border/40 max-h-[520px] overflow-y-auto custom-scrollbar">
                      {monthItems.map(item => {
                        const cardObj = getCardById(item.cardId);
                        const isOverdue =
                          item.kind === 'expense' &&
                          item.paymentStatus === 'pending' &&
                          item.dateStr < todayStr;
                        const isChecked = selectedBatchIds.includes(item.id);

                        return (
                          <div
                            key={item.id}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 text-xs transition-colors ${
                              isChecked ? 'bg-indigo-500/[0.06]' : 'hover:bg-muted/25'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleBatchItem(item.id)}
                                className="text-muted-foreground hover:text-primary shrink-0 cursor-pointer"
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-primary" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => jumpToDate(item.dateStr)}
                                className={`font-mono tabular-nums text-[11px] font-black px-1.5 py-0.5 rounded shrink-0 cursor-pointer ${
                                  isOverdue
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                    : 'bg-muted text-foreground'
                                }`}
                                title="Selecionar dia"
                              >
                                {format(new Date(item.dateStr + 'T12:00:00'), 'dd/MM')}
                              </button>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {cardObj && (
                                    <span
                                      className="text-[9px] font-black text-white px-1.5 py-0.2 rounded"
                                      style={{ backgroundColor: cardObj.color }}
                                    >
                                      {cardObj.name}
                                    </span>
                                  )}
                                  {item.kind === 'income' && (
                                    <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded">
                                      Receita
                                    </span>
                                  )}
                                  <span className="font-black text-foreground truncate">
                                    {item.description}
                                  </span>
                                </div>
                                <p className="text-[10.5px] text-muted-foreground font-semibold">
                                  {item.category} •{' '}
                                  <span
                                    className={
                                      item.paymentStatus === 'paid'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : isOverdue
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : 'text-amber-600 dark:text-amber-400'
                                    }
                                  >
                                    {item.paymentStatus === 'paid'
                                      ? item.kind === 'income'
                                        ? 'Recebida'
                                        : 'Quitada'
                                      : isOverdue
                                        ? 'Vencida'
                                        : 'Pendente'}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pl-6 sm:pl-0">
                              <span
                                className={`font-mono tabular-nums font-black text-xs sm:text-sm ${
                                  item.kind === 'income'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : item.paymentStatus === 'paid'
                                      ? 'text-muted-foreground line-through'
                                      : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {item.kind === 'income' ? '+' : '-'}
                                {formatCurrency(item.amount)}
                              </span>

                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleTogglePayItem(item)}
                                  className={`h-7 px-2 rounded-lg text-[10px] font-extrabold cursor-pointer ${
                                    item.paymentStatus === 'pending'
                                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  {item.paymentStatus === 'pending'
                                    ? item.kind === 'income'
                                      ? 'Receber'
                                      : 'Quitar'
                                    : 'Reabrir'}
                                </Button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditItem(item)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {!item.isReserveTx && (
                                  <button
                                    type="button"
                                    onClick={() => handleRequestDeleteItem(item)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {mainView === 'installments' && (
              <div className="space-y-3">
                {installmentGroups.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <Repeat className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs font-bold text-muted-foreground">
                      Nenhuma compra parcelada ou conta recorrente encontrada.
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Ao lançar compras em 2x+ no cartão ou contas mensais recorrentes, você acompanha o progresso completo aqui.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1 custom-scrollbar">
                    {installmentGroups.map(group => {
                      const cardObj = getCardById(group.cardId);
                      const totalCount = group.items.length;
                      const pct = Math.round((group.paidCount / totalCount) * 100);
                      return (
                        <div
                          key={group.groupId}
                          className="rounded-xl border border-border/70 bg-muted/15 p-3.5 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {cardObj && (
                                  <span
                                    className="text-[9px] font-black text-white px-1.5 py-0.5 rounded"
                                    style={{ backgroundColor: cardObj.color }}
                                  >
                                    {cardObj.name}
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-muted-foreground">
                                  {group.category}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm font-black text-foreground truncate">
                                {group.title}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-xs font-black font-mono tabular-nums text-foreground">
                                Total: {formatCurrency(group.totalAmount)}
                              </p>
                              <p className="text-[10.5px] font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                                Falta: {formatCurrency(group.remainingAmount)}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground tabular-nums">
                              <span>
                                Progresso: <strong className="text-foreground">{group.paidCount}/{totalCount}</strong> pagas ({pct}%)
                              </span>
                              {group.nextPendingItem ? (
                                <span>
                                  Próx.:{' '}
                                  <button
                                    type="button"
                                    onClick={() => jumpToDate(group.nextPendingItem!.dateStr)}
                                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-mono cursor-pointer"
                                  >
                                    {format(new Date(group.nextPendingItem.dateStr + 'T12:00:00'), 'dd/MM/yy')}
                                  </button>
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-black">Concluído</span>
                              )}
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          {group.pendingCount > 0 && (
                            <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-border/40">
                              {group.nextPendingItem && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleTogglePayItem(group.nextPendingItem!)}
                                  className="h-7 rounded-lg text-[10.5px] font-bold cursor-pointer"
                                >
                                  Quitar Próxima ({formatCurrency(group.nextPendingItem.amount)})
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleSettleInstallmentGroup(group.groupId)}
                                className="h-7 rounded-lg text-[10.5px] font-extrabold border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Antecipar / Quitar {group.pendingCount} Restantes
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Panel: Selected Day / Pending / Categories */}
        <Card className="border border-border/80 rounded-2xl bg-card flex flex-col">
          <CardHeader className="pb-3 border-b border-border/40 space-y-3">
            <div className="grid grid-cols-3 gap-1 p-1 bg-muted/50 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => setRightPanelTab('day')}
                className={`py-1.5 px-1.5 rounded-lg text-[10.5px] font-black transition-colors cursor-pointer ${
                  rightPanelTab === 'day'
                    ? 'bg-card text-foreground border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Dia {format(new Date(selectedDayStr + 'T12:00:00'), 'dd/MM')}
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('pending')}
                className={`py-1.5 px-1.5 rounded-lg text-[10.5px] font-black transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                  rightPanelTab === 'pending'
                    ? 'bg-card text-foreground border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Pendentes</span>
                <span
                  className={`px-1 rounded text-[9.5px] font-mono tabular-nums font-black ${
                    globalPendingSummary.overdueAllCount > 0
                      ? 'bg-rose-500 text-white'
                      : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {globalPendingSummary.pendingCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('categories')}
                className={`py-1.5 px-1.5 rounded-lg text-[10.5px] font-black transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                  rightPanelTab === 'categories'
                    ? 'bg-card text-foreground border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <PieChart className="w-3 h-3" />
                <span>Categ.</span>
              </button>
            </div>

            {rightPanelTab === 'day' && (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                    Dia {format(new Date(selectedDayStr + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                  </CardTitle>
                  <CardDescription className="text-[11px] capitalize">
                    {format(new Date(selectedDayStr + 'T12:00:00'), 'EEEE', { locale: ptBR })}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleOpenNewEntry('bill', selectedDayStr)}
                  className="h-8 rounded-xl text-[11px] font-black cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Agendar Dia
                </Button>
              </div>
            )}

            {rightPanelTab === 'pending' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <CalendarClock className="w-4 h-4 text-amber-500" />
                      Todas as Pendências
                    </CardTitle>
                    <CardDescription className="text-[11px] tabular-nums">
                      A pagar: <strong className="text-foreground font-mono">{formatCurrency(globalPendingSummary.totalPendingAll)}</strong>
                    </CardDescription>
                  </div>
                  {globalPendingSummary.overdueAllCount > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleSettleAllOverdue}
                      className="h-7 px-2 rounded-lg text-[10px] font-extrabold border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 cursor-pointer shrink-0"
                    >
                      Quitar Vencidas
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      { key: 'all', label: 'Todas' },
                      { key: 'overdue', label: 'Vencidas' },
                      { key: 'current_month', label: 'Este Mês' },
                      { key: 'future', label: 'Futuras' },
                    ] as { key: PendingScopeFilter; label: string }[]
                  ).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPendingScopeFilter(opt.key)}
                      className={`py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition-colors ${
                        pendingScopeFilter === opt.key
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {rightPanelTab === 'categories' && (
              <div>
                <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
                  Gastos por Categoria ({viewedMonthLabel})
                </CardTitle>
                <CardDescription className="text-[11px] tabular-nums">
                  Total previsto no mês: <strong className="font-mono text-foreground">{formatCurrency(monthCategoryBreakdown.grandTotal)}</strong>
                </CardDescription>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4">
            {rightPanelTab === 'day' && (
              <>
                {selectedDayItems.length === 0 ? (
                  <div className="py-10 text-center space-y-2.5">
                    <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs font-bold text-muted-foreground">
                      Nenhuma conta, receita ou fatura nesta data.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenNewEntry('card', selectedDayStr)}
                        className="h-8 rounded-xl text-[11px] font-bold cursor-pointer"
                      >
                        + Cartão
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenNewEntry('bill', selectedDayStr)}
                        className="h-8 rounded-xl text-[11px] font-bold cursor-pointer"
                      >
                        + Conta
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenNewEntry('income', selectedDayStr)}
                        className="h-8 rounded-xl text-[11px] font-bold cursor-pointer"
                      >
                        + Receita
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Resumo Financeiro do Dia Selecionado */}
                    <div
                      className={`rounded-xl border p-3 space-y-2 ${
                        selectedDaySummary.allSettled
                          ? 'border-sky-500/35 bg-sky-500/[0.05]'
                          : selectedDaySummary.overdueCount > 0
                            ? 'border-rose-500/35 bg-rose-500/[0.05]'
                            : 'border-border/70 bg-muted/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wider ${
                            selectedDaySummary.allSettled
                              ? 'text-sky-600 dark:text-sky-400'
                              : selectedDaySummary.overdueCount > 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {selectedDaySummary.allSettled ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Tudo quitado no dia
                            </>
                          ) : selectedDaySummary.overdueCount > 0 ? (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5" /> {selectedDaySummary.pendingCount} pendência(s) em atraso
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5" /> {selectedDaySummary.pendingCount} de {selectedDayItems.length} pendente(s)
                            </>
                          )}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
                          {selectedDayItems.length} {selectedDayItems.length === 1 ? 'lançamento' : 'lançamentos'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-end justify-between gap-3 pt-1 border-t border-border/40">
                        {selectedDaySummary.totalExpenses > 0 && (
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                              Total Saídas do Dia
                            </span>
                            <span className="text-base font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
                              -{formatCurrency(selectedDaySummary.totalExpenses)}
                            </span>
                          </div>
                        )}

                        {selectedDaySummary.totalIncomes > 0 && (
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                              Total Entradas
                            </span>
                            <span className="text-base font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                              +{formatCurrency(selectedDaySummary.totalIncomes)}
                            </span>
                          </div>
                        )}

                        <div className="text-right ml-auto space-y-0.5 text-[10.5px] font-bold tabular-nums">
                          {selectedDaySummary.paidExpenses > 0 && (
                            <p className="text-slate-600 dark:text-slate-300 font-mono">
                              Quitado: -{formatCurrency(selectedDaySummary.paidExpenses)}
                            </p>
                          )}
                          {selectedDaySummary.pendingExpenses > 0 && (
                            <p className="text-amber-600 dark:text-amber-400 font-mono">
                              A pagar: -{formatCurrency(selectedDaySummary.pendingExpenses)}
                            </p>
                          )}
                          {selectedDaySummary.totalIncomes > 0 && selectedDaySummary.totalExpenses > 0 && (
                            <p
                              className={`font-mono font-black ${
                                selectedDaySummary.netDay >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              Saldo: {selectedDaySummary.netDay >= 0 ? '+' : ''}
                              {formatCurrency(selectedDaySummary.netDay)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {selectedDayPendingExpenses.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleSettleDayPending}
                        className="w-full h-8 rounded-xl text-[11px] font-extrabold border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Quitar Todas do Dia ({formatCurrency(selectedDayPendingExpenses.reduce((s, i) => s + i.amount, 0))})
                      </Button>
                    )}

                    {/* Lista Refinada dos Lançamentos do Dia */}
                    <div className="rounded-xl border border-border/70 bg-card divide-y divide-border/50 max-h-[390px] overflow-y-auto custom-scrollbar">
                      {selectedDayItems.map(item => {
                        const cardObj = getCardById(item.cardId);
                        const isOverdue =
                          item.kind === 'expense' &&
                          item.paymentStatus === 'pending' &&
                          item.dateStr < todayStr;
                        const isPaid = item.paymentStatus === 'paid';
                        const stripeClass =
                          item.kind === 'income'
                            ? 'border-l-emerald-500 bg-emerald-500/[0.04]'
                            : isPaid
                              ? 'border-l-slate-400 dark:border-l-slate-500'
                              : isOverdue
                                ? 'border-l-rose-500 bg-rose-500/[0.04]'
                                : 'border-l-amber-500';

                        return (
                          <div
                            key={item.id}
                            className={`p-3 border-l-[3px] transition-colors hover:bg-muted/20 ${stripeClass}`}
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                  {item.kind === 'income' ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold text-[9.5px]">
                                      ↑ Receita
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-500/12 text-rose-700 dark:text-rose-300 font-extrabold text-[9.5px]">
                                      ↓ Despesa
                                    </span>
                                  )}
                                  {cardObj && (
                                    <span className="inline-flex items-center gap-1 font-extrabold text-foreground">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: cardObj.color }}
                                      />
                                      <span>{cardObj.name}</span>
                                      <span className="text-muted-foreground/50">•</span>
                                    </span>
                                  )}
                                  <span className="font-semibold text-muted-foreground truncate">
                                    {item.category}
                                  </span>
                                  {item.installmentNumber && item.installmentTotal && (
                                    <span className="font-mono tabular-nums text-[9.5px] font-bold text-muted-foreground bg-muted/60 px-1 rounded">
                                      {item.installmentNumber}/{item.installmentTotal}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs font-black text-foreground leading-snug break-words">
                                  {item.description}
                                </p>
                              </div>

                              <div className="text-right shrink-0 space-y-0.5">
                                <span
                                  className={`block text-sm font-black font-mono tabular-nums ${
                                    item.kind === 'income'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : isPaid
                                        ? 'text-slate-600 dark:text-slate-300'
                                        : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {item.kind === 'income' ? '+' : '-'}
                                  {formatCurrency(item.amount)}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 text-[9.5px] font-extrabold ${
                                    item.kind === 'income'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : isPaid
                                        ? 'text-slate-600 dark:text-slate-300'
                                        : isOverdue
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : 'text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {isPaid ? (
                                    <>
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      {item.kind === 'income' ? 'Recebida' : 'Quitado'}
                                    </>
                                  ) : isOverdue ? (
                                    <>
                                      <AlertTriangle className="w-2.5 h-2.5" /> Vencida
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-2.5 h-2.5" />
                                      {item.kind === 'income' ? 'A receber' : 'A pagar'}
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-border/35">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleTogglePayItem(item)}
                                className={`h-7 px-2.5 rounded-lg text-[10.5px] font-extrabold cursor-pointer ${
                                  item.paymentStatus === 'pending'
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {item.paymentStatus === 'pending'
                                  ? item.kind === 'income'
                                    ? 'Confirmar Entrada'
                                    : 'Quitar'
                                  : 'Reabrir'}
                              </Button>

                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShiftConfirmTarget({ mode: 'single', item, deltaMonths: 1 })
                                  }
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                                  title={
                                    item.isCard
                                      ? 'Mandar para próxima fatura (+1 mês)'
                                      : 'Adiar para próximo mês (+1 mês)'
                                  }
                                >
                                  <CalendarPlus className="w-3.5 h-3.5" />
                                </button>
                                {!item.isReserveTx && (
                                  <button
                                    type="button"
                                    onClick={() => setDuplicateConfirmItem(item)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                    title="Duplicar para o próximo mês"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditItem(item)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {!item.isReserveTx && (
                                  <button
                                    type="button"
                                    onClick={() => handleRequestDeleteItem(item)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-border/40 space-y-1 text-[11px] text-muted-foreground font-semibold tabular-nums">
                  {selectedDaySummary.totalIncomes > 0 && (
                    <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Receitas do dia:</span>
                      <span className="font-mono font-black">
                        +{formatCurrency(selectedDaySummary.totalIncomes)}
                      </span>
                    </div>
                  )}
                  {selectedDaySummary.totalExpenses > 0 && (
                    <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                      <span>Despesas do dia:</span>
                      <span className="font-mono font-black">
                        -{formatCurrency(selectedDaySummary.totalExpenses)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span>Despesas no mês ({viewedMonthLabel}):</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatCurrency(monthItems.filter(i => i.kind === 'expense').reduce((s, i) => s + i.amount, 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span>Total Pendente (Geral):</span>
                    <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(globalPendingSummary.totalPendingAll)}
                    </span>
                  </div>
                </div>
              </>
            )}

            {rightPanelTab === 'pending' && (
              <>
                {scopedPendingList.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto" />
                    <p className="text-xs font-bold text-muted-foreground">
                      Nenhuma pendência neste filtro! Tudo em dia.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[430px] overflow-y-auto pr-1 custom-scrollbar">
                    {scopedPendingList.map(item => {
                      const cardObj = getCardById(item.cardId);
                      const isOverdue = item.kind === 'expense' && item.dateStr < todayStr;
                      const isInOtherMonth = item.monthKey !== currentMonthKey;

                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-2.5 space-y-1.5 ${
                            isOverdue
                              ? 'border-rose-500/40 bg-rose-500/10'
                              : item.kind === 'income'
                                ? 'border-emerald-500/35 bg-emerald-500/[0.05]'
                                : 'border-border/60 bg-muted/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => jumpToDate(item.dateStr)}
                                  className={`text-[10px] font-mono tabular-nums font-black px-1.5 py-0.5 rounded hover:underline cursor-pointer ${
                                    isOverdue
                                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                                      : 'bg-muted text-foreground'
                                  }`}
                                  title="Ir para esta data no calendário"
                                >
                                  {format(new Date(item.dateStr + 'T12:00:00'), 'dd/MM/yy')}
                                </button>
                                {cardObj && (
                                  <span
                                    className="text-[9px] font-black text-white px-1.5 py-0.5 rounded"
                                    style={{ backgroundColor: cardObj.color }}
                                  >
                                    {cardObj.name}
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-muted-foreground truncate">
                                  {item.category}
                                </span>
                              </div>
                              <p className="text-xs font-black text-foreground mt-0.5 break-words">
                                {item.description}
                              </p>
                            </div>
                            <span
                              className={`text-xs font-black font-mono tabular-nums shrink-0 ${
                                item.kind === 'income'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {item.kind === 'income' ? '+' : ''}
                              {formatCurrency(item.amount)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-border/30">
                            <span
                              className={`text-[9.5px] font-bold ${
                                isOverdue
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : item.kind === 'income'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {isOverdue
                                ? '⚠️ Vencida'
                                : item.kind === 'income'
                                  ? '⏳ A receber'
                                  : '⏳ A vencer'}
                            </span>
                            <div className="flex items-center gap-1">
                              {isInOtherMonth && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveItemToCurrentMonth(item)}
                                  className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 text-[9.5px] font-extrabold cursor-pointer"
                                  title={`Trazer para ${viewedMonthLabel}`}
                                >
                                  Trazer p/ {viewedMonthLabel}
                                </button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleTogglePayItem(item)}
                                className="h-6 px-2 rounded-lg text-[10px] font-extrabold border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                              >
                                {item.kind === 'income' ? 'Receber' : 'Quitar'}
                              </Button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditItem(item)}
                                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                                title="Editar"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              {!item.isReserveTx && (
                                <button
                                  type="button"
                                  onClick={() => handleRequestDeleteItem(item)}
                                  className="p-1 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-3 border-t border-border/40 flex items-center justify-between text-[11px] font-semibold text-muted-foreground tabular-nums">
                  <span>{scopedPendingList.length} exibida(s)</span>
                  <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                    Total Despesas: {formatCurrency(globalPendingSummary.totalPendingAll)}
                  </span>
                </div>
              </>
            )}

            {rightPanelTab === 'categories' && (
              <div className="space-y-3">
                {monthCategoryBreakdown.rows.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <PieChart className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs font-bold text-muted-foreground">
                      Sem despesas registradas em {viewedMonthLabel}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1 custom-scrollbar">
                    {monthCategoryBreakdown.rows.map(row => {
                      const sharePct =
                        monthCategoryBreakdown.grandTotal > 0
                          ? Math.round((row.total / monthCategoryBreakdown.grandTotal) * 100)
                          : 0;
                      const budgetLimit = categoryBudgets[row.category] || 0;
                      const budgetPct =
                        budgetLimit > 0 ? Math.min(100, Math.round((row.total / budgetLimit) * 100)) : 0;
                      const overBudget = budgetLimit > 0 && row.total > budgetLimit;

                      return (
                        <div
                          key={row.category}
                          className="rounded-xl border border-border/60 bg-muted/15 p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-foreground truncate">
                              {row.category}{' '}
                              <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                                ({sharePct}%)
                              </span>
                            </span>
                            <span className="text-xs font-black font-mono tabular-nums text-foreground">
                              {formatCurrency(row.total)}
                            </span>
                          </div>

                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                overBudget ? 'bg-rose-500' : 'bg-indigo-500'
                              }`}
                              style={{ width: `${budgetLimit > 0 ? budgetPct : sharePct}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground tabular-nums">
                            <span>
                              {budgetLimit > 0 ? (
                                <span className={overBudget ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}>
                                  Teto: {formatCurrency(budgetLimit)} ({budgetPct}%)
                                </span>
                              ) : (
                                `${row.count} ${row.count === 1 ? 'conta' : 'contas'}`
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setBudgetModalCategory(row.category);
                                setBudgetModalLimit(budgetLimit > 0 ? String(budgetLimit) : '');
                              }}
                              className="text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline cursor-pointer"
                            >
                              {budgetLimit > 0 ? 'Alterar Teto' : '+ Definir Teto'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal: Cadastrar / Editar Cartão */}
      <Dialog open={showCardModal} onOpenChange={setShowCardModal}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-500" />
              {editingCard ? 'Editar Cartão de Crédito' : 'Novo Cartão de Crédito'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe o dia de fechamento e o dia de vencimento da fatura.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCard} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Instituição / Bandeira
              </label>
              <Select
                value={cardBrand}
                onValueChange={(v: CreditCardBrand) => {
                  setCardBrand(v);
                  const preset = CARD_BRAND_PRESETS.find(p => p.value === v);
                  if (preset) {
                    setCardColor(preset.color);
                    if (!cardName.trim()) setCardName(preset.label);
                  }
                }}
              >
                <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                  <SelectValue placeholder="Selecione a instituição...">
                    {val => {
                      const preset = CARD_BRAND_PRESETS.find(p => p.value === val);
                      if (!preset) return 'Selecione a instituição / bandeira...';
                      return (
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: preset.color }}
                          />
                          <span>{preset.label}</span>
                        </div>
                      );
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CARD_BRAND_PRESETS.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        <span>{p.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Nome do Cartão
                </label>
                <Input
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                  placeholder="Ex: Nubank Roxinho"
                  className="h-10 rounded-xl text-xs font-bold"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Cor
                </label>
                <Input
                  type="color"
                  value={cardColor}
                  onChange={e => setCardColor(e.target.value)}
                  className="h-10 rounded-xl p-1 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Dia Fechamento
                </label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={cardClosingDay}
                  onChange={e => setCardClosingDay(e.target.value)}
                  className="h-10 rounded-xl text-xs font-bold tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Dia Vencimento
                </label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={cardDueDay}
                  onChange={e => setCardDueDay(e.target.value)}
                  className="h-10 rounded-xl text-xs font-bold tabular-nums"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Limite (Opc.)
                </label>
                <CurrencyInput
                  value={cardLimit}
                  onChange={setCardLimit}
                  placeholder="0,00"
                  className="h-10 rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCardModal(false);
                  if (reopenEntryAfterCard) {
                    setReopenEntryAfterCard(false);
                    setShowEntryModal(true);
                  }
                }}
                className="rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </Button>
              <Button type="submit" className="rounded-xl text-xs font-black cursor-pointer">
                Salvar Cartão
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Compra no Cartão, Conta Planejada ou Receita Prevista */}
      <Dialog open={showEntryModal} onOpenChange={setShowEntryModal}>
        <DialogContent className="max-w-lg rounded-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              {entryMode === 'card' ? (
                <CreditCard className="w-5 h-5 text-indigo-500" />
              ) : entryMode === 'income' ? (
                <ArrowUpRight className="w-5 h-5 text-emerald-500" />
              ) : (
                <Wallet className="w-5 h-5 text-amber-500" />
              )}
              {entryMode === 'card'
                ? 'Registrar Compra no Cartão'
                : entryMode === 'income'
                  ? 'Agendar Receita Prevista'
                  : 'Agendar Conta / Despesa Futura'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ficam organizadas no calendário e alimentam a projeção do seu caixa.
            </DialogDescription>
          </DialogHeader>

          {/* 3-Way Mode Toggle */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/50">
            <button
              type="button"
              onClick={() => {
                setEntryMode('card');
                setEntryCategory(
                  (expenseCategories.find(c => c.toLowerCase().includes('cart')) as string) ||
                    expenseCategories[0] ||
                    'Outras Despesas'
                );
              }}
              className={`py-2 px-1 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                entryMode === 'card'
                  ? 'bg-indigo-600 text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              💳 Cartão
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryMode('bill');
                setEntryCategory(expenseCategories[0] || 'Outras Despesas');
              }}
              className={`py-2 px-1 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                entryMode === 'bill'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              📅 Conta a Pagar
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryMode('income');
                setEntryCategory(incomeCategories[0] || 'Outras Receitas');
              }}
              className={`py-2 px-1 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                entryMode === 'income'
                  ? 'bg-emerald-600 text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              💵 Receita Prevista
            </button>
          </div>

          <form onSubmit={handleSaveEntry} className="space-y-4">
            {entryMode === 'card' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      Cartão Utilizado
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEntryModal(false);
                        handleOpenNewCard(true);
                      }}
                      className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      + Cadastrar Cartão
                    </button>
                  </div>
                  {cards.length === 0 ? (
                    <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400 font-bold">
                      Cadastre um cartão acima para calcular o vencimento automático da fatura.
                    </div>
                  ) : (
                    <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                      <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                        <SelectValue placeholder="Selecione o cartão...">
                          {val => {
                            const c = cards.find(item => item.id === val);
                            if (!c) return 'Selecione o cartão...';
                            return (
                              <div className="flex items-center gap-2 truncate">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: c.color }}
                                />
                                <span className="font-bold">{c.name}</span>
                                <span className="text-muted-foreground text-[10px]">
                                  (Fecha {c.closingDay} • Vence {c.dueDay})
                                </span>
                              </div>
                            );
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {cards.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: c.color }}
                              />
                              <span className="font-bold">{c.name}</span>
                              <span className="text-muted-foreground text-[10px]">
                                (Fecha {c.closingDay} • Vence {c.dueDay})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Explicit Target Invoice Month Control (fixes forced next-month surprises) */}
                {selectedCardObj && (
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      Fatura de Destino (1ª Parcela)
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCardInvoiceTarget('auto')}
                        className={`py-1.5 px-2 rounded-xl border text-[10.5px] font-extrabold transition-colors cursor-pointer ${
                          cardInvoiceTarget === 'auto'
                            ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                            : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Automático
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardInvoiceTarget('viewed_month')}
                        className={`py-1.5 px-2 rounded-xl border text-[10.5px] font-extrabold transition-colors cursor-pointer capitalize ${
                          cardInvoiceTarget === 'viewed_month'
                            ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                            : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Fatura {viewedMonthLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardInvoiceTarget('next_month')}
                        className={`py-1.5 px-2 rounded-xl border text-[10.5px] font-extrabold transition-colors cursor-pointer capitalize ${
                          cardInvoiceTarget === 'next_month'
                            ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                            : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Próx. ({nextMonthLabel})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  {entryMode === 'card'
                    ? 'Data da Compra'
                    : entryMode === 'income'
                      ? 'Data Prevista'
                      : 'Data de Vencimento'}
                </label>
                <Input
                  type="date"
                  value={entryDate}
                  onChange={e => setEntryDate(e.target.value)}
                  className="h-10 rounded-xl text-xs font-bold tabular-nums"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Categoria
                </label>
                <Select value={entryCategory} onValueChange={setEntryCategory}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                    <SelectValue>{val => val || 'Selecione a categoria'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(entryMode === 'income' ? incomeCategories : expenseCategories).map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {entryMode === 'card' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      {amountInputType === 'total' ? 'Valor Total da Compra (R$)' : 'Valor de Cada Parcela (R$)'}
                    </label>
                    <CurrencyInput
                      value={entryAmount}
                      onChange={setEntryAmount}
                      placeholder="0,00"
                      className="h-10 rounded-xl font-bold"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      Parcelas
                    </label>
                    <Select value={installments} onValueChange={setInstallments}>
                      <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                        <SelectValue>{val => (val ? `${val}x` : '1x')}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, idx) => String(idx + 1)).map(n => (
                          <SelectItem key={n} value={n}>
                            {n}x
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {Number(installments) > 1 && (
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setAmountInputType('total')}
                      className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                        amountInputType === 'total'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/30 border-border/60 text-muted-foreground'
                      }`}
                    >
                      Valor é o Total
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmountInputType('installment')}
                      className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                        amountInputType === 'installment'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/30 border-border/60 text-muted-foreground'
                      }`}
                    >
                      Valor é da Parcela
                    </button>
                  </div>
                )}

                {cardPreview && (
                  <div className="p-3 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.06] text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black text-indigo-600 dark:text-indigo-400">
                        Vencimento ({selectedCardObj?.name}):{' '}
                        <span className="font-mono tabular-nums">
                          {format(new Date(cardPreview.first.statementDueDate + 'T12:00:00'), 'dd/MM/yyyy')}
                        </span>
                      </p>
                      <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 capitalize">
                        {format(new Date(cardPreview.first.statementDueDate + 'T12:00:00'), 'MMM/yy', { locale: ptBR })}
                      </span>
                    </div>

                    {Number(entryAmount) > 0 && (
                      <p className="text-foreground font-semibold tabular-nums">
                        {cardPreview.nInst}x de{' '}
                        <strong className="font-mono">{formatCurrency(cardPreview.perInstallment)}</strong>{' '}
                        (Total: {formatCurrency(cardPreview.totalPurchase)})
                      </p>
                    )}

                    {cardPreview.nInst > 1 && (
                      <p className="text-muted-foreground tabular-nums">
                        Última parcela em{' '}
                        <strong>
                          {format(new Date(cardPreview.last.statementDueDate + 'T12:00:00'), 'dd/MM/yyyy')}
                        </strong>
                      </p>
                    )}

                    {cardInvoiceTarget === 'auto' && cardPreview.isAutoInDifferentMonthThanViewed && (
                      <div className="pt-1.5 border-t border-indigo-500/20 flex items-center justify-between gap-2 text-[10.5px] text-amber-700 dark:text-amber-400 font-bold">
                        <span>
                          Após fechamento (dia {selectedCardObj?.closingDay}) → vai para o mês seguinte.
                        </span>
                        <button
                          type="button"
                          onClick={() => setCardInvoiceTarget('viewed_month')}
                          className="underline font-black whitespace-nowrap cursor-pointer inline-flex items-center gap-0.5"
                        >
                          Usar {viewedMonthLabel} <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    {entryMode === 'income' ? 'Valor Previsto (R$)' : 'Valor da Conta (R$)'}
                  </label>
                  <CurrencyInput
                    value={entryAmount}
                    onChange={setEntryAmount}
                    placeholder="0,00"
                    className="h-10 rounded-xl font-bold"
                    required
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={billRepeat}
                    onChange={e => setBillRepeat(e.target.checked)}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span>
                    {entryMode === 'income'
                      ? 'Repetir receita periodicamente (recorrência)'
                      : 'Repetir conta em meses/semanas futuras (recorrência)'}
                  </span>
                </label>

                {billRepeat && (
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={billFrequency} onValueChange={(v: RecurrenceFrequency) => setBillFrequency(v)}>
                      <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                        <SelectValue>
                          {val => {
                            switch (val) {
                              case 'weekly': return 'Semanal';
                              case 'biweekly': return 'Quinzenal';
                              case 'monthly': return 'Mensal';
                              default: return val || 'Mensal';
                            }
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="biweekly">Quinzenal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={2}
                      max={36}
                      value={billRepeatCount}
                      onChange={e => setBillRepeatCount(e.target.value)}
                      placeholder="Qtd. repetições"
                      className="h-10 rounded-xl text-xs font-bold tabular-nums"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Descrição
              </label>
              <Input
                value={entryDescription}
                onChange={e => setEntryDescription(e.target.value)}
                placeholder={
                  entryMode === 'card'
                    ? 'Ex: Capacete novo, Pneu traseiro, Mercado...'
                    : entryMode === 'income'
                      ? 'Ex: Repasse quinzenal, Frete fechado...'
                      : 'Ex: Aluguel, Internet, IPVA...'
                }
                className="h-10 rounded-xl text-xs font-semibold"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEntryModal(false)}
                className="rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingEntry}
                className={`rounded-xl text-xs font-black text-white cursor-pointer ${
                  entryMode === 'income'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {savingEntry
                  ? 'Salvando...'
                  : entryMode === 'card'
                    ? 'Lançar na Fatura'
                    : entryMode === 'income'
                      ? 'Agendar Receita'
                      : 'Agendar Conta'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Lançamento / Fatura */}
      <Dialog open={editingItem !== null} onOpenChange={open => !open && setEditingItem(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" />
              {editingItem?.kind === 'income' ? 'Editar Receita Prevista' : 'Editar Conta / Fatura'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Altere valor, data de vencimento, descrição, cartão ou status.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEditItem} className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Valor (R$)
                </label>
                <CurrencyInput
                  value={editAmount}
                  onChange={setEditAmount}
                  className="h-10 rounded-xl font-bold"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  {editingItem?.kind === 'income' ? 'Data Prevista' : 'Vencimento'}
                </label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="h-10 rounded-xl text-xs font-bold tabular-nums"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Categoria
                </label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                    <SelectValue>{val => val || 'Selecione a categoria'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      new Set([
                        ...(editingItem?.kind === 'income' ? incomeCategories : expenseCategories),
                        ...(editCategory ? [editCategory] : []),
                      ])
                    ).map(c => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Status
                </label>
                <Select value={editStatus} onValueChange={(v: 'paid' | 'pending') => setEditStatus(v)}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                    <SelectValue>
                      {v =>
                        editingItem?.kind === 'income'
                          ? v === 'paid'
                            ? 'Recebida (No Caixa)'
                            : 'Prevista (A Receber)'
                          : v === 'paid'
                            ? 'Quitado (Pago)'
                            : 'Pendente (A pagar)'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">
                      {editingItem?.kind === 'income' ? 'Prevista (A Receber)' : 'Pendente (A pagar)'}
                    </SelectItem>
                    <SelectItem value="paid">
                      {editingItem?.kind === 'income' ? 'Recebida (No Caixa)' : 'Quitado (Pago)'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editingItem?.kind !== 'income' && !editingItem?.isReserveTx && cards.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Cartão Vinculado
                </label>
                <Select value={editCardId} onValueChange={setEditCardId}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                    <SelectValue placeholder="Nenhum (Conta avulsa)">
                      {val => {
                        if (val === '__none__' || !val) return 'Nenhum (Conta avulsa)';
                        const c = cards.find(card => card.id === val);
                        if (!c) return 'Nenhum (Conta avulsa)';
                        return (
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: c.color }}
                            />
                            <span>{c.name}</span>
                          </div>
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum (Conta avulsa)</SelectItem>
                    {cards.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: c.color }}
                          />
                          <span>{c.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Descrição
              </label>
              <Input
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                className="h-10 rounded-xl text-xs font-semibold"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingItem(null)}
                className="rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingEdit} className="rounded-xl text-xs font-black cursor-pointer">
                {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Excluir Parcela Individual vs Grupo Recorrente */}
      <Dialog open={deleteTargetItem !== null} onOpenChange={open => !open && setDeleteTargetItem(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-rose-500">
              <Trash2 className="w-4 h-4" /> Excluir Lançamento Parcelado
            </DialogTitle>
            <DialogDescription className="text-xs">
              Este item faz parte de um parcelamento ou recorrência ({deleteTargetItem?.description}). Deseja excluir somente esta parcela ou todas as pendentes do grupo?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => deleteTargetItem && executeDeleteSingleItem(deleteTargetItem)}
              className="rounded-xl text-xs font-extrabold cursor-pointer justify-start"
            >
              Excluir apenas esta parcela ({formatCurrency(deleteTargetItem?.amount || 0)})
            </Button>
            <Button
              type="button"
              onClick={() => deleteTargetItem && executeDeleteGroupPending(deleteTargetItem)}
              className="rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white cursor-pointer justify-start"
            >
              Excluir todas as parcelas pendentes deste grupo
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTargetItem(null)}
              className="rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmação de Envio para Próxima Fatura / Próximo Mês */}
      <Dialog open={shiftConfirmTarget !== null} onOpenChange={open => !open && !confirmingShift && setShiftConfirmTarget(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <CalendarPlus className="w-5 h-5" />
              {shiftConfirmTarget?.mode === 'batch'
                ? `Enviar ${shiftConfirmTarget.items.length} Lançamento(s) para o Próximo Mês?`
                : shiftConfirmTarget?.item.isCard
                  ? 'Mandar para Próxima Fatura?'
                  : 'Adiar para o Próximo Mês?'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {shiftConfirmTarget?.mode === 'single'
                ? shiftConfirmTarget.item.isCard
                  ? 'Este lançamento será removido da fatura atual e transferido para a fatura do próximo mês.'
                  : 'O vencimento deste lançamento será alterado em +1 mês.'
                : 'Todos os lançamentos selecionados terão seu vencimento transferido em +1 mês.'}
            </DialogDescription>
          </DialogHeader>

          {shiftConfirmTarget?.mode === 'single' && (() => {
            const target = shiftConfirmTarget.item;
            const nextDateStr = calculateNextOccurrence(target.dateStr, 'monthly', shiftConfirmTarget.deltaMonths);
            const cardObj = getCardById(target.cardId);
            return (
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {cardObj && (
                      <span
                        className="inline-block text-[9px] font-black text-white px-1.5 py-0.5 rounded mb-1"
                        style={{ backgroundColor: cardObj.color }}
                      >
                        {cardObj.name}
                      </span>
                    )}
                    <p className="font-black text-foreground break-words">{target.description}</p>
                    <p className="text-[11px] text-muted-foreground font-semibold">{target.category}</p>
                  </div>
                  <span className="font-mono tabular-nums font-black text-sm text-foreground shrink-0">
                    {formatCurrency(target.amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50 text-[11px] font-bold">
                  <div>
                    <span className="text-[9.5px] uppercase text-muted-foreground block">Atual</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {format(new Date(target.dateStr + 'T12:00:00'), "dd/MM/yyyy (MMM)", { locale: ptBR })}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="text-right">
                    <span className="text-[9.5px] uppercase text-indigo-600 dark:text-indigo-400 block">
                      {target.isCard ? 'Próxima Fatura' : 'Novo Vencimento'}
                    </span>
                    <span className="font-mono tabular-nums text-indigo-600 dark:text-indigo-400 font-black">
                      {format(new Date(nextDateStr + 'T12:00:00'), "dd/MM/yyyy (MMM)", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {shiftConfirmTarget?.mode === 'batch' && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-muted-foreground">Itens selecionados:</span>
                <span className="font-mono tabular-nums font-black text-foreground">
                  {shiftConfirmTarget.items.length} ({formatCurrency(shiftConfirmTarget.items.reduce((s, i) => s + i.amount, 0))})
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-border/40 border-t border-border/40 pt-1">
                {shiftConfirmTarget.items.slice(0, 6).map(item => (
                  <div key={item.id} className="py-1.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate font-semibold text-foreground">{item.description}</span>
                    <span className="font-mono tabular-nums font-bold text-muted-foreground shrink-0">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
                {shiftConfirmTarget.items.length > 6 && (
                  <p className="pt-1.5 text-[10.5px] font-bold text-muted-foreground">
                    + {shiftConfirmTarget.items.length - 6} outro(s) item(ns)
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={confirmingShift}
              onClick={() => setShiftConfirmTarget(null)}
              className="rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={confirmingShift}
              onClick={handleConfirmShiftTarget}
              className="rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
            >
              {confirmingShift
                ? 'Transferindo...'
                : shiftConfirmTarget?.mode === 'single' && shiftConfirmTarget.item.isCard
                  ? 'Confirmar Envio p/ Próxima Fatura'
                  : 'Confirmar Transferência'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmação de Cópia para o Próximo Mês */}
      <Dialog
        open={duplicateConfirmItem !== null}
        onOpenChange={open => !open && !confirmingDuplicate && setDuplicateConfirmItem(null)}
      >
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-primary">
              <Copy className="w-5 h-5" />
              Copiar Lançamento para o Próximo Mês?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Será criada uma nova cópia pendente no próximo mês, mantendo este lançamento original intacto.
            </DialogDescription>
          </DialogHeader>

          {duplicateConfirmItem && (() => {
            const target = duplicateConfirmItem;
            const nextDateStr = calculateNextOccurrence(target.dateStr, 'monthly', 1);
            const cardObj = getCardById(target.cardId);
            return (
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded font-extrabold text-[9.5px] ${
                          target.kind === 'income'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-500/12 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {target.kind === 'income' ? '↑ Receita' : '↓ Despesa'}
                      </span>
                      {cardObj && (
                        <span
                          className="inline-block text-[9px] font-black text-white px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: cardObj.color }}
                        >
                          {cardObj.name}
                        </span>
                      )}
                    </div>
                    <p className="font-black text-foreground break-words">
                      {target.description.replace(/\s*\(\d+\/\d+\)\s*$/, '')}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-semibold">{target.category}</p>
                  </div>
                  <span
                    className={`font-mono tabular-nums font-black text-sm shrink-0 ${
                      target.kind === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {target.kind === 'income' ? '+' : '-'}
                    {formatCurrency(target.amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50 text-[11px] font-bold">
                  <div>
                    <span className="text-[9.5px] uppercase text-muted-foreground block">Original</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {format(new Date(target.dateStr + 'T12:00:00'), "dd/MM/yyyy (MMM)", { locale: ptBR })}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                  <div className="text-right">
                    <span className="text-[9.5px] uppercase text-primary block">Nova Cópia (Pendente)</span>
                    <span className="font-mono tabular-nums text-primary font-black">
                      {format(new Date(nextDateStr + 'T12:00:00'), "dd/MM/yyyy (MMM)", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={confirmingDuplicate}
              onClick={() => setDuplicateConfirmItem(null)}
              className="rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={confirmingDuplicate}
              onClick={handleConfirmDuplicateNextMonth}
              className="rounded-xl text-xs font-black bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            >
              {confirmingDuplicate ? 'Copiando...' : 'Confirmar Cópia'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Teto Mensal por Categoria */}
      <Dialog open={budgetModalCategory !== null} onOpenChange={open => !open && setBudgetModalCategory(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
              Teto Mensal: {budgetModalCategory}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Defina um limite mensal para acompanhar o quanto já comprometeu nesta categoria. Deixe 0 para remover.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCategoryBudget} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Limite Mensal (R$)
              </label>
              <CurrencyInput
                value={budgetModalLimit}
                onChange={setBudgetModalLimit}
                placeholder="0,00"
                className="h-10 rounded-xl font-bold"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBudgetModalCategory(null)}
                className="rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </Button>
              <Button type="submit" className="rounded-xl text-xs font-black cursor-pointer">
                Salvar Teto
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
