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
} from '../lib/planningStorage';
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
} from 'lucide-react';

interface NormalizedPlannedItem {
  id: string;
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

export function PlanningCalendar() {
  const {
    transactions,
    setTransactions,
    updateTransaction,
    deleteTransaction,
    reserveTransactions,
    updateReserveTransaction,
    settings,
    hideValues,
  } = useData();

  const [userId, setUserId] = useState<string>('');
  const [cards, setCards] = useState<CreditCardConfig[]>([]);
  const [txCardMap, setTxCardMap] = useState<Record<string, string>>({});
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDayStr, setSelectedDayStr] = useState<string>(() => getTodayLocalDateStr());
  const [rightPanelTab, setRightPanelTab] = useState<'day' | 'pending'>('day');
  const [showSpotPaidExpenses, setShowSpotPaidExpenses] = useState<boolean>(false);

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

  // Purchase / Planned Bill Dialog
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryMode, setEntryMode] = useState<'card' | 'bill'>('card');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
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

  // Filter / Card Detail Inspector
  const [filterCardId, setFilterCardId] = useState<string>('all');

  useEffect(() => {
    getEffectiveUserId().then(uid => {
      const effectiveUid = uid || 'default';
      setUserId(effectiveUid);
      const loadedCards = planningStorage.getCards(effectiveUid);
      setCards(loadedCards);
      setTxCardMap(planningStorage.getTxCardMap(effectiveUid));
      if (loadedCards.length > 0 && !selectedCardId) {
        setSelectedCardId(loadedCards[0].id);
      }
    });
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

  const formatCurrency = (val: number) => {
    if (hideValues) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const todayStr = getTodayLocalDateStr();
  const todayMonthKey = todayStr.slice(0, 7);
  const currentMonthKey = format(currentMonth, 'yyyy-MM');
  const nextMonthKey = format(addMonths(currentMonth, 1), 'yyyy-MM');

  // Normalize planned/expense bills (transactions + reserve utilizations) with due dates
  const plannedExpenseItems = useMemo(() => {
    const items: NormalizedPlannedItem[] = [];

    (transactions || []).forEach(t => {
      if (t.type !== 'expense') return;
      if (
        t.category === 'Aporte Reserva' ||
        t.category === 'Resgate Reserva' ||
        t.category === 'Resgate de Reserva'
      ) {
        return;
      }
      const dueStr = (t.due_date || t.date || '').split('T')[0];
      if (!dueStr) return;

      const cardId = extractCardTagFromTransaction(t, txCardMap, cards);
      const isCard = Boolean(
        cardId ||
          t.description?.toLowerCase().includes('[cartão') ||
          t.description?.toLowerCase().includes('[cartao')
      );
      const status: 'paid' | 'pending' = t.payment_status === 'pending' ? 'pending' : 'paid';

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

  const filteredItems = useMemo(() => {
    return plannedExpenseItems.filter(item => {
      if (filterCardId === 'all') return true;
      if (filterCardId === 'no_card') return !item.isCard;
      return item.cardId === filterCardId;
    });
  }, [plannedExpenseItems, filterCardId]);

  const monthItems = useMemo(() => {
    return filteredItems.filter(item => item.monthKey === currentMonthKey);
  }, [filteredItems, currentMonthKey]);

  const monthSummary = useMemo(() => {
    let cardsPending = 0;
    let cardsPaid = 0;
    let billsPending = 0;
    let billsPaid = 0;

    monthItems.forEach(item => {
      if (item.isCard) {
        if (item.paymentStatus === 'pending') cardsPending += item.amount;
        else cardsPaid += item.amount;
      } else {
        if (item.paymentStatus === 'pending') billsPending += item.amount;
        else billsPaid += item.amount;
      }
    });

    return {
      cardsTotal: cardsPending + cardsPaid,
      cardsPending,
      billsPending,
      totalPending: cardsPending + billsPending,
      totalPaid: cardsPaid + billsPaid,
    };
  }, [monthItems]);

  // Global Pending Summary (ALL overdue + current + future months)
  const globalPendingItems = useMemo(() => {
    return filteredItems.filter(item => item.paymentStatus === 'pending');
  }, [filteredItems]);

  const globalPendingSummary = useMemo(() => {
    let totalPendingAll = 0;
    let totalPendingCardsAll = 0;
    let totalPendingBillsAll = 0;
    let overdueAllAmount = 0;
    let overdueAllCount = 0;
    let futureMonthsPendingAmount = 0;

    globalPendingItems.forEach(item => {
      totalPendingAll += item.amount;
      if (item.isCard) totalPendingCardsAll += item.amount;
      else totalPendingBillsAll += item.amount;

      if (item.dateStr < todayStr) {
        overdueAllAmount += item.amount;
        overdueAllCount += 1;
      } else if (item.monthKey > todayMonthKey) {
        futureMonthsPendingAmount += item.amount;
      }
    });

    return {
      totalPendingAll,
      totalPendingCardsAll,
      totalPendingBillsAll,
      overdueAllAmount,
      overdueAllCount,
      futureMonthsPendingAmount,
      pendingCount: globalPendingItems.length,
    };
  }, [globalPendingItems, todayStr, todayMonthKey]);

  // Per-card invoice summaries for current, next month & all open commitments
  const cardInvoices = useMemo(() => {
    const map: Record<
      string,
      {
        currentMonthTotal: number;
        currentMonthPending: number;
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
        currentMonthPendingIds: [],
        nextMonthTotal: 0,
        nextMonthPending: 0,
        totalCommittedAllFuture: 0,
      };
    });

    plannedExpenseItems.forEach(item => {
      if (!item.cardId || !map[item.cardId]) return;
      const bucket = map[item.cardId];
      if (item.monthKey === currentMonthKey) {
        bucket.currentMonthTotal += item.amount;
        if (item.paymentStatus === 'pending') {
          bucket.currentMonthPending += item.amount;
          bucket.currentMonthPendingIds.push(item.id);
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
  }, [cards, plannedExpenseItems, currentMonthKey, nextMonthKey]);

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
  const selectedDayPendingItems = useMemo(
    () => selectedDayItems.filter(i => i.paymentStatus === 'pending'),
    [selectedDayItems]
  );

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

  const cardPreview = useMemo(() => {
    if (entryMode !== 'card' || !selectedCardObj) return null;
    const nInst = Math.max(1, Math.min(24, Number(installments) || 1));
    const rawVal = Number(entryAmount) || 0;
    const perInstallment =
      amountInputType === 'total' ? Math.round((rawVal / nInst) * 100) / 100 : rawVal;
    const totalPurchase =
      amountInputType === 'total' ? rawVal : Math.round(rawVal * nInst * 100) / 100;

    const first = computeCardStatementDueDate(
      entryDate,
      selectedCardObj.closingDay,
      selectedCardObj.dueDay,
      1
    );
    const last = computeCardStatementDueDate(
      entryDate,
      selectedCardObj.closingDay,
      selectedCardObj.dueDay,
      nInst
    );

    return { nInst, perInstallment, totalPurchase, first, last };
  }, [entryMode, selectedCardObj, installments, entryAmount, amountInputType, entryDate]);

  const handleOpenNewEntry = (mode: 'card' | 'bill', presetDateStr?: string) => {
    setEntryMode(mode);
    setEntryDate(presetDateStr || selectedDayStr || getTodayLocalDateStr());
    setEntryAmount('');
    setAmountInputType('total');
    setInstallments('1');
    setEntryCategory(
      mode === 'card' && expenseCategories.find(c => c.toLowerCase().includes('cart'))
        ? (expenseCategories.find(c => c.toLowerCase().includes('cart')) as string)
        : (expenseCategories[0] || 'Outras Despesas')
    );
    setEntryDescription('');
    setBillRepeat(false);
    setBillRepeatCount('6');
    if (mode === 'card' && cards.length > 0) {
      if (!selectedCardId || !cards.some(c => c.id === selectedCardId)) {
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

        for (let i = 1; i <= nInst; i++) {
          const { statementDueDate } = computeCardStatementDueDate(
            entryDate,
            selectedCardObj.closingDay,
            selectedCardObj.dueDay,
            i
          );
          const instId = generateUUID();
          batchIds.push(instId);
          const instAmt = i === 1 ? Math.round((baseInstAmt + remainderCents) * 100) / 100 : baseInstAmt;
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
          setCurrentMonth(new Date(y, m - 1, 1, 12, 0, 0));
          setSelectedDayStr(firstDue);
          setRightPanelTab('day');
        }
        toast.success(
          nInst > 1
            ? `Compra parcelada em ${nInst}x lançada na fatura do ${selectedCardObj.name}!`
            : `Compra lançada na fatura do ${selectedCardObj.name}!`
        );
      } else {
        // Planned Standalone / Recurring Bill
        const nInst = billRepeat ? Math.max(2, Math.min(36, Number(billRepeatCount) || 6)) : 1;
        const groupId = nInst > 1 ? generateUUID() : null;
        const labelDesc = entryDescription.trim() || entryCategory || 'Conta agendada';

        for (let i = 1; i <= nInst; i++) {
          const instDate =
            i === 1 ? entryDate : calculateNextOccurrence(entryDate, billFrequency, i - 1);
          const instId = generateUUID();
          const parcelSuffix = nInst > 1 ? ` (${i}/${nInst})` : '';
          const payload: Transaction = {
            id: instId,
            user_id: effectiveUid,
            type: 'expense',
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
        setCurrentMonth(new Date(y, m - 1, 1, 12, 0, 0));
        setSelectedDayStr(entryDate);
        setRightPanelTab('day');
        toast.success(
          nInst > 1
            ? `${nInst} contas recorrentes agendadas no calendário!`
            : 'Conta futura agendada no calendário!'
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
      toast.error('Erro ao salvar planejamento.');
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
        toast.success(newStatus === 'paid' ? 'Conta quitada!' : 'Conta marcada como pendente.');
      }
    } catch {
      toast.error('Erro ao atualizar status da conta.');
    }
  };

  const handleSettleDayPending = async () => {
    if (selectedDayPendingItems.length === 0) return;
    const payDate = getTodayLocalDateStr();
    try {
      for (const item of selectedDayPendingItems) {
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
      toast.success(`${selectedDayPendingItems.length} contas do dia quitadas!`);
    } catch {
      toast.error('Erro ao quitar contas do dia.');
    }
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
          due_date: editDate,
          category: editCategory,
          description: editDescription.trim() || editCategory,
          payment_status: editStatus,
          payment_date: editStatus === 'paid' ? (editingItem.rawTx?.payment_date || getTodayLocalDateStr()) : null,
        });
      } else {
        let cleanedDesc = editDescription.trim() || editCategory;
        const chosenCard = editCardId !== '__none__' ? cards.find(c => c.id === editCardId) || null : null;

        // Remove any old [Cartão ...] prefix before applying updated card prefix
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
    const targets = plannedExpenseItems.filter(
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

  const jumpToDate = (dateStr: string) => {
    const [y, m] = dateStr.split('-').map(Number);
    if (y && m) {
      setCurrentMonth(new Date(y, m - 1, 1, 12, 0, 0));
    }
    setSelectedDayStr(dateStr);
    setRightPanelTab('day');
  };

  const getCardById = (cardId: string | null) => cards.find(c => c.id === cardId) || null;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shrink-0">
            <CalendarRange className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Calendário de Contas &amp; Cartões
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
              Gerencie faturas de cartão, compras parceladas e contas futuras com visão clara do total pendente.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenNewCard(false)}
            className="h-10 rounded-xl text-xs font-extrabold gap-1.5 cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-purple-500" />
            <span>Novo Cartão</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenNewEntry('bill')}
            className="h-10 rounded-xl text-xs font-extrabold gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 cursor-pointer"
          >
            <ReceiptText className="w-4 h-4" />
            <span>+ Conta Planejada</span>
          </Button>
          <Button
            type="button"
            onClick={() => handleOpenNewEntry('card')}
            className="h-10 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ Compra no Cartão</span>
          </Button>
        </div>
      </header>

      {/* Top KPI Summary: Includes Global Total Pending + Current Month Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* KPI 1: Valor Total Pendente (Geral de todos os meses/cartões) */}
        <Card
          onClick={() => setRightPanelTab('pending')}
          className="col-span-2 md:col-span-1 border-2 border-indigo-500/35 bg-indigo-500/[0.06] rounded-2xl cursor-pointer hover:border-indigo-500/60 transition-all"
          title="Clique para listar todas as pendências em aberto"
        >
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 flex items-center justify-between gap-1">
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Total Pendente Geral
              </span>
              <span className="px-1.5 py-0.2 rounded bg-indigo-500/15 text-[9px] font-black">
                {globalPendingSummary.pendingCount} itens
              </span>
            </span>
            <p className="text-lg sm:text-xl font-black font-mono text-indigo-600 dark:text-indigo-400">
              {formatCurrency(globalPendingSummary.totalPendingAll)}
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold truncate">
              Cartões: {formatCurrency(globalPendingSummary.totalPendingCardsAll)} • Avulsas:{' '}
              {formatCurrency(globalPendingSummary.totalPendingBillsAll)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/70 rounded-2xl bg-card/95">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-500 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5" /> Faturas ({format(currentMonth, 'MMM/yy', { locale: ptBR })})
            </span>
            <p className="text-lg sm:text-xl font-black font-mono text-foreground">
              {formatCurrency(monthSummary.cardsTotal)}
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold">
              Pendente no mês: {formatCurrency(monthSummary.cardsPending)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/70 rounded-2xl bg-card/95">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> A Pagar no Mês
            </span>
            <p className="text-lg sm:text-xl font-black font-mono text-amber-500">
              {formatCurrency(monthSummary.totalPending)}
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold">
              Avulsas: {formatCurrency(monthSummary.billsPending)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/70 rounded-2xl bg-card/95">
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Quitado no Mês
            </span>
            <p className="text-lg sm:text-xl font-black font-mono text-emerald-500">
              {formatCurrency(monthSummary.totalPaid)}
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold">
              Liquidado em {format(currentMonth, 'MMMM', { locale: ptBR })}
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setRightPanelTab('pending')}
          className={`border rounded-2xl cursor-pointer transition-all ${
            globalPendingSummary.overdueAllCount > 0
              ? 'border-rose-500/40 bg-rose-500/[0.06] hover:border-rose-500/70'
              : 'border-border/70 bg-card/95'
          }`}
          title="Clique para inspecionar contas em atraso"
        >
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-500 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Em Atraso (Total)
            </span>
            <p className="text-lg sm:text-xl font-black font-mono text-rose-500">
              {formatCurrency(globalPendingSummary.overdueAllAmount)}
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold">
              {globalPendingSummary.overdueAllCount}{' '}
              {globalPendingSummary.overdueAllCount === 1 ? 'conta vencida' : 'contas vencidas'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Credit Cards Strip */}
      <Card className="border border-border/80 rounded-2xl bg-card/95">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-500" /> Meus Cartões de Crédito
              </CardTitle>
              <CardDescription className="text-[11px]">
                Clique em um cartão para filtrar o calendário por ele, ou quite a fatura do mês com 1 clique.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setFilterCardId(filterCardId === 'no_card' ? 'all' : 'no_card')}
                className={`h-7 px-2.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                  filterCardId === 'no_card'
                    ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400'
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
                  Adicione seu Nubank, Inter, Itaú ou outro cartão para parcelar compras automaticamente nas faturas futuras.
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
                  currentMonthPendingIds: [],
                  nextMonthTotal: 0,
                  nextMonthPending: 0,
                  totalCommittedAllFuture: 0,
                };
                const isFiltered = filterCardId === card.id;
                const limitUsagePct =
                  card.limit && card.limit > 0
                    ? Math.min(100, (inv.totalCommittedAllFuture / card.limit) * 100)
                    : 0;

                return (
                  <div
                    key={card.id}
                    onClick={() => setFilterCardId(isFiltered ? 'all' : card.id)}
                    className={`rounded-2xl border p-3.5 space-y-2.5 transition-all cursor-pointer ${
                      isFiltered
                        ? 'border-purple-500 bg-purple-500/[0.06] shadow-xs ring-1 ring-purple-500/30'
                        : 'border-border/60 bg-muted/15 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                          style={{ backgroundColor: card.color }}
                        >
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-foreground truncate">{card.name}</p>
                          <p className="text-[10px] font-semibold text-muted-foreground">
                            Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                          </p>
                        </div>
                      </div>
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
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

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40 text-[11px]">
                      <div>
                        <span className="text-[9px] font-bold uppercase text-muted-foreground block">
                          Fatura ({format(currentMonth, 'MMM/yy', { locale: ptBR })})
                        </span>
                        <span className="font-mono font-black text-foreground">
                          {formatCurrency(inv.currentMonthTotal)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase text-muted-foreground block">
                          Próx. Fatura
                        </span>
                        <span className="font-mono font-bold text-muted-foreground">
                          {formatCurrency(inv.nextMonthTotal)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold uppercase text-amber-500 block">
                          Total Aberto
                        </span>
                        <span className="font-mono font-black text-amber-500">
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
                              backgroundColor: limitUsagePct > 85 ? '#ef4444' : card.color,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[9.5px] font-semibold text-muted-foreground">
                          <span>Disponível: {formatCurrency(Math.max(0, card.limit - inv.totalCommittedAllFuture))}</span>
                          <span>Limite: {formatCurrency(card.limit)}</span>
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

      {/* Main Split: Calendar Grid + Day/Pending Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Calendar Grid */}
        <Card className="lg:col-span-2 border border-border/80 rounded-2xl bg-card/95">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                  className="h-8 w-8 rounded-xl cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-sm sm:text-base font-black capitalize text-foreground min-w-[140px] text-center">
                  {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                  className="h-8 w-8 rounded-xl cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowSpotPaidExpenses(prev => !prev)}
                  className={`h-8 px-2.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                    showSpotPaidExpenses
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border/70 bg-muted/20 text-muted-foreground hover:text-foreground'
                  }`}
                  title="Ocultar/exibir despesas avulsas já pagas no dia a dia"
                >
                  {showSpotPaidExpenses ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Pagas avulsas</span>
                </button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nowM = startOfMonth(new Date());
                    setCurrentMonth(nowM);
                    setSelectedDayStr(getTodayLocalDateStr());
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
                const pendingDayTotal = dayItems
                  .filter(i => i.paymentStatus === 'pending')
                  .reduce((s, i) => s + i.amount, 0);
                const paidDayTotal = dayItems
                  .filter(i => i.paymentStatus === 'paid')
                  .reduce((s, i) => s + i.amount, 0);
                const hasOverdue = dayItems.some(
                  i => i.paymentStatus === 'pending' && dStr < todayStr
                );

                // Clamp card closingDay to actual days in this month
                const daysInThisMonth = endOfMonth(day).getDate();
                const cardsClosingThisDay = inMonth
                  ? cards.filter(c => Math.min(c.closingDay, daysInThisMonth) === day.getDate())
                  : [];

                return (
                  <button
                    key={dStr}
                    type="button"
                    onClick={() => {
                      setSelectedDayStr(dStr);
                      if (!inMonth) {
                        setCurrentMonth(startOfMonth(day));
                      }
                      setRightPanelTab('day');
                    }}
                    className={`min-h-[68px] sm:min-h-[82px] rounded-xl border p-1.5 flex flex-col justify-between text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/40'
                        : isToday
                          ? 'border-primary/50 bg-primary/[0.04]'
                          : inMonth
                            ? 'border-border/50 bg-muted/10 hover:bg-muted/30'
                            : 'border-border/20 bg-muted/[0.03] opacity-40'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-[11px] font-black leading-none ${
                          isToday
                            ? 'bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md'
                            : 'text-foreground'
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      {cardsClosingThisDay.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          {cardsClosingThisDay.slice(0, 2).map(c => (
                            <span
                              key={c.id}
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: c.color }}
                              title={`Fechamento ${c.name}`}
                            />
                          ))}
                        </span>
                      )}
                    </div>

                    <div className="space-y-0.5 w-full">
                      {pendingDayTotal > 0 && (
                        <div
                          className={`text-[9px] sm:text-[10px] font-mono font-black px-1 py-0.5 rounded truncate ${
                            hasOverdue
                              ? 'bg-rose-500/15 text-rose-500'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {hideValues ? '•••' : `-${Math.round(pendingDayTotal)}`}
                        </div>
                      )}
                      {paidDayTotal > 0 && (
                        <div className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-500 truncate">
                          {hideValues ? '•••' : `✓${Math.round(paidDayTotal)}`}
                        </div>
                      )}
                      {dayItems.length > 0 && (
                        <p className="text-[8.5px] font-bold text-muted-foreground truncate px-0.5">
                          {dayItems.length} {dayItems.length === 1 ? 'conta' : 'contas'}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right Panel: Selected Day OR All Pending Items */}
        <Card className="border border-border/80 rounded-2xl bg-card/95 flex flex-col">
          <CardHeader className="pb-3 border-b border-border/40 space-y-3">
            {/* Tab Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-muted/50 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => setRightPanelTab('day')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                  rightPanelTab === 'day'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Dia {format(new Date(selectedDayStr + 'T12:00:00'), 'dd/MM')}
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('pending')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightPanelTab === 'pending'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Pendentes</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-black ${
                    globalPendingSummary.overdueAllCount > 0
                      ? 'bg-rose-500 text-white'
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {globalPendingSummary.pendingCount}
                </span>
              </button>
            </div>

            {rightPanelTab === 'day' ? (
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
                  className="h-8 rounded-xl text-[11px] font-black cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Agendar Dia
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <CalendarClock className="w-4 h-4 text-amber-500" />
                    Todas as Pendências
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Total pendente: <strong className="text-foreground font-mono">{formatCurrency(globalPendingSummary.totalPendingAll)}</strong>
                  </CardDescription>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4">
            {rightPanelTab === 'day' ? (
              <>
                {selectedDayItems.length === 0 ? (
                  <div className="py-10 text-center space-y-2.5">
                    <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs font-bold text-muted-foreground">
                      Nenhuma conta ou fatura vencendo nesta data.
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenNewEntry('card', selectedDayStr)}
                        className="h-8 rounded-xl text-[11px] font-bold cursor-pointer"
                      >
                        + Compra Cartão
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenNewEntry('bill', selectedDayStr)}
                        className="h-8 rounded-xl text-[11px] font-bold cursor-pointer"
                      >
                        + Conta Avulsa
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                    {selectedDayPendingItems.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleSettleDayPending}
                        className="w-full h-8 rounded-xl text-[11px] font-extrabold border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Quitar Todas do Dia ({formatCurrency(selectedDayPendingItems.reduce((s, i) => s + i.amount, 0))})
                      </Button>
                    )}

                    {selectedDayItems.map(item => {
                      const cardObj = getCardById(item.cardId);
                      const isOverdue = item.paymentStatus === 'pending' && item.dateStr < todayStr;
                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-3 space-y-2 ${
                            item.paymentStatus === 'paid'
                              ? 'border-emerald-500/25 bg-emerald-500/[0.04]'
                              : isOverdue
                                ? 'border-rose-500/40 bg-rose-500/10'
                                : 'border-border/60 bg-muted/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
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
                                  {item.category}
                                </span>
                              </div>
                              <p className="text-xs font-black text-foreground mt-0.5 break-words">
                                {item.description}
                              </p>
                            </div>

                            <span
                              className={`text-sm font-black font-mono shrink-0 ${
                                item.paymentStatus === 'paid' ? 'text-emerald-500' : 'text-rose-500'
                              }`}
                            >
                              {formatCurrency(item.amount)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/40">
                            <span
                              className={`text-[10px] font-extrabold ${
                                item.paymentStatus === 'paid'
                                  ? 'text-emerald-500'
                                  : isOverdue
                                    ? 'text-rose-500'
                                    : 'text-amber-500'
                              }`}
                            >
                              {item.paymentStatus === 'paid'
                                ? '✓ Quitado'
                                : isOverdue
                                  ? '⚠️ Vencida'
                                  : '⏳ A pagar'}
                            </span>

                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleTogglePayItem(item)}
                                className={`h-7 px-2.5 rounded-lg text-[10.5px] font-extrabold cursor-pointer ${
                                  item.paymentStatus === 'pending'
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {item.paymentStatus === 'pending' ? 'Quitar' : 'Reabrir'}
                              </Button>
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
                )}

                {/* Quick All-Month Bills Counter */}
                <div className="pt-3 border-t border-border/40 space-y-1 text-[11px] text-muted-foreground font-semibold">
                  <div className="flex items-center justify-between">
                    <span>Compromissos no mês: {monthItems.length}</span>
                    <span className="font-mono font-black text-foreground">
                      Mês: {formatCurrency(monthItems.reduce((s, i) => s + i.amount, 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span>Total Pendente (Geral):</span>
                    <span className="font-mono font-black text-indigo-500">
                      {formatCurrency(globalPendingSummary.totalPendingAll)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {globalPendingItems.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto" />
                    <p className="text-xs font-bold text-muted-foreground">
                      Nenhuma conta ou fatura pendente! Tudo em dia.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1 custom-scrollbar">
                    {globalPendingItems.map(item => {
                      const cardObj = getCardById(item.cardId);
                      const isOverdue = item.dateStr < todayStr;
                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-2.5 space-y-1.5 ${
                            isOverdue
                              ? 'border-rose-500/40 bg-rose-500/10'
                              : 'border-border/60 bg-muted/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => jumpToDate(item.dateStr)}
                                  className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded hover:underline cursor-pointer ${
                                    isOverdue
                                      ? 'bg-rose-500/20 text-rose-500'
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
                            <span className="text-xs font-black font-mono text-rose-500 shrink-0">
                              {formatCurrency(item.amount)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/30">
                            <span className={`text-[9.5px] font-bold ${isOverdue ? 'text-rose-500' : 'text-amber-500'}`}>
                              {isOverdue ? '⚠️ Vencida' : '⏳ A vencer'}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleTogglePayItem(item)}
                                className="h-6 px-2 rounded-lg text-[10px] font-extrabold border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                              >
                                Quitar
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

                <div className="pt-3 border-t border-border/40 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>{globalPendingSummary.pendingCount} pendentes</span>
                  <span className="font-mono font-black text-indigo-500">
                    Total: {formatCurrency(globalPendingSummary.totalPendingAll)}
                  </span>
                </div>
              </>
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
                    {(val) => {
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
                  className="h-10 rounded-xl text-xs font-bold"
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
                  className="h-10 rounded-xl text-xs font-bold"
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

      {/* Modal: Compra no Cartão ou Conta Planejada */}
      <Dialog open={showEntryModal} onOpenChange={setShowEntryModal}>
        <DialogContent className="max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              {entryMode === 'card' ? (
                <CreditCard className="w-5 h-5 text-indigo-500" />
              ) : (
                <Wallet className="w-5 h-5 text-amber-500" />
              )}
              {entryMode === 'card' ? 'Registrar Compra no Cartão' : 'Agendar Conta / Despesa Futura'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ficam ocultas no extrato padrão até você ativar &ldquo;Exibir futuras&rdquo;, e alimentam a Projeção de Caixa.
            </DialogDescription>
          </DialogHeader>

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-xl border border-border/50">
            <button
              type="button"
              onClick={() => setEntryMode('card')}
              className={`py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                entryMode === 'card'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              💳 Compra no Cartão
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('bill')}
              className={`py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                entryMode === 'bill'
                  ? 'bg-amber-500 text-zinc-950 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              📅 Conta / Boleto Futuro
            </button>
          </div>

          <form onSubmit={handleSaveEntry} className="space-y-4">
            {entryMode === 'card' && (
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
                    className="text-[11px] font-extrabold text-indigo-500 hover:underline cursor-pointer"
                  >
                    + Cadastrar Cartão
                  </button>
                </div>
                {cards.length === 0 ? (
                  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400 font-bold">
                    Cadastre um cartão acima para calcular o vencimento automático da fatura.
                  </div>
                ) : (
                  <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                    <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                      <SelectValue placeholder="Selecione o cartão...">
                        {(val) => {
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
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  {entryMode === 'card' ? 'Data da Compra' : 'Data de Vencimento'}
                </label>
                <Input
                  type="date"
                  value={entryDate}
                  onChange={e => setEntryDate(e.target.value)}
                  className="h-10 rounded-xl text-xs font-bold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Categoria
                </label>
                <Select value={entryCategory} onValueChange={setEntryCategory}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                    <SelectValue>{(val) => val || 'Selecione a categoria'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(cat => (
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
                        <SelectValue>{(val) => (val ? `${val}x` : '1x')}</SelectValue>
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

                {cardPreview && Number(entryAmount) > 0 && (
                  <div className="p-3 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.06] text-[11px] space-y-1">
                    <p className="font-black text-indigo-500">
                      Resumo das Faturas ({selectedCardObj?.name}):
                    </p>
                    <p className="text-foreground font-semibold">
                      {cardPreview.nInst}x de{' '}
                      <strong className="font-mono">{formatCurrency(cardPreview.perInstallment)}</strong>{' '}
                      (Total: {formatCurrency(cardPreview.totalPurchase)})
                    </p>
                    <p className="text-muted-foreground">
                      1ª parcela vence em{' '}
                      <strong>
                        {format(new Date(cardPreview.first.statementDueDate + 'T12:00:00'), 'dd/MM/yyyy')}
                      </strong>
                      {cardPreview.nInst > 1 && (
                        <>
                          {' '}
                          • Última em{' '}
                          <strong>
                            {format(new Date(cardPreview.last.statementDueDate + 'T12:00:00'), 'dd/MM/yyyy')}
                          </strong>
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Valor da Conta (R$)
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
                  <span>Repetir conta em meses/semanas futuras (recorrência)</span>
                </label>

                {billRepeat && (
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={billFrequency} onValueChange={(v: RecurrenceFrequency) => setBillFrequency(v)}>
                      <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                        <SelectValue>
                          {(val) => {
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
                      placeholder="Qtd. meses"
                      className="h-10 rounded-xl text-xs font-bold"
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
                  entryMode === 'card' ? 'Ex: Capacete novo, Pneu traseiro, Mercado...' : 'Ex: Aluguel, Internet, IPVA...'
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
                className="rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
              >
                {savingEntry ? 'Salvando...' : entryMode === 'card' ? 'Lançar na Fatura' : 'Agendar Conta'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Lançamento / Fatura */}
      <Dialog open={editingItem !== null} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" />
              Editar Conta / Fatura
            </DialogTitle>
            <DialogDescription className="text-xs">
              Altere valor, vencimento, descrição, cartão ou status de pagamento.
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
                  Vencimento
                </label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="h-10 rounded-xl text-xs font-bold"
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
                    <SelectValue>{(val) => val || 'Selecione a categoria'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set([...expenseCategories, ...(editCategory ? [editCategory] : [])])).map(c => (
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
                      {(v) => (v === 'paid' ? 'Quitado (Pago)' : 'Pendente (A pagar)')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente (A pagar)</SelectItem>
                    <SelectItem value="paid">Quitado (Pago)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!editingItem?.isReserveTx && cards.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Cartão Vinculado
                </label>
                <Select value={editCardId} onValueChange={setEditCardId}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                    <SelectValue placeholder="Nenhum (Conta avulsa)">
                      {(val) => {
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
      <Dialog open={deleteTargetItem !== null} onOpenChange={(open) => !open && setDeleteTargetItem(null)}>
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
    </div>
  );
}
