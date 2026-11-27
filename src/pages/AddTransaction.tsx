import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '../components/CurrencyInput';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/lib/toast';
import { useVehicles } from '../contexts/VehiclesContext';
import { VehicleSelect } from '../components/VehicleSelect';
import { 
  Bike, 
  Package, 
  DollarSign, 
  Loader2, 
  TrendingDown, 
  TrendingUp, 
  Fuel, 
  PiggyBank,
  Car,
  Utensils,
  Wrench,
  Wifi,
  ShoppingBag,
  Landmark,
  Briefcase,
  Zap,
  Heart,
  Camera,
  Gift,
  Coffee,
  Pizza,
  Beer,
  Shield,
  MapPin,
  Phone,
  MessageSquare,
  Hammer,
  Wallet,
  CreditCard,
  ShoppingCart,
  Home,
  Settings,
  User,
  Scissors,
  Music,
  Video,
  Gamepad,
  Globe,
  Plane,
  Train,
  Bus,
  Truck,
  Hospital,
  School,
  GraduationCap,
  Users,
  Smile,
  Frown,
  Star,
  Bell,
  Clock,
  Calendar,
  Filter,
  Calculator
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { TransactionType, PaymentStatus, RecurrenceFrequency } from '../types';
import { FreightCalculatorModal } from '../components/FreightCalculatorModal';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, format } from 'date-fns';
import { syncQueueManager } from '../lib/syncQueue';
import { cacheManager } from '../lib/cacheManager';
import { freightStorage } from '../lib/freightStorage';
import { calculateNextOccurrence, getFrequencyLabel, generateUUID, parseLocalDate, buildNextRecurringTransaction, buildNextRecurringReserveTransaction } from '../lib/recurrenceUtils';
import { getTodayLocalDateStr } from '../lib/utils';
import { getEffectiveUserId } from '../lib/authUtils';
import { RefreshCw, CalendarClock, CalendarRange, CheckCircle2, AlertCircle, EyeOff, Bookmark, X, ChevronDown, Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import { isVehicleRelatedCategory, shouldDefaultToNoVehicle } from '../lib/vehicleUtils';
import { findMatchingReserveForExpense } from '../components/reserves/reserveUtils';
import {
  planningStorage,
  TxQuickTemplate,
  CreditCardConfig,
  ExpenseBudgetsMap,
  computeCardStatementDueDate,
  isCreditCardCategoryName,
} from '../lib/planningStorage';
import {
  computeExpenseWindowTotals,
  getCategoryBudgetStatuses,
  getMostCriticalBudgetStatus,
  getBudgetSeverityStyles,
} from '../lib/budgetUtils';
import { BudgetLimitsModal } from '../components/BudgetLimitsModal';
import {
  TransactionBudgetFeedback,
  FreightExpensesBudgetSummary,
} from '../components/TransactionBudgetFeedback';

export function AddTransaction() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const paramType = searchParams.get('type') as 'aporte' | 'utilizacao' | null;
  const paramReserveId = searchParams.get('reserve_id') || '';
  const paramTab = searchParams.get('tab');
  const paramAmountRaw = searchParams.get('amount') || '';
  const parsedAmount = Number(paramAmountRaw);
  const paramAmount = (!isNaN(parsedAmount) && paramAmountRaw !== '') ? String(Number(parsedAmount.toFixed(2))) : '';

  const paramOpExpensesRaw = searchParams.get('operational_expenses') || searchParams.get('toll') || searchParams.get('expenses') || '';
  const parsedOpExpenses = Number(paramOpExpensesRaw);
  const paramOpExpenses = (!isNaN(parsedOpExpenses) && paramOpExpensesRaw !== '') ? String(Number(parsedOpExpenses.toFixed(2))) : '';
  const paramOpCategory = searchParams.get('operational_category') || searchParams.get('op_category') || '';
  const paramDesc = searchParams.get('description') || '';
  const paramDate = searchParams.get('date') || '';
  const paramQuoteId = searchParams.get('quote_id') || '';
  const paramDistanceKm = searchParams.get('distance_km') || '';

  const { transactions, setTransactions, settings, refreshData, globalPeriod, reserves, reserveTransactions, addReserveTransaction, hideValues } = useData();
  const { activeVehicle, vehicles } = useVehicles();

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    searchParams.get('vehicle_id') || ''
  );
  const [showManualVehicleSelect, setShowManualVehicleSelect] = useState(false);

  // Find active maintenance reserve rule rate
  const maintenanceReserve = reserves?.find(r => 
    r.status !== 'inactive' && 
    (r.name.toLowerCase().includes('manuten') || r.icon === 'Wrench')
  );
  let maintenanceRatePerKm = 0.30;
  if (maintenanceReserve?.regra_ativa && maintenanceReserve?.regra_tipo === 'km' && maintenanceReserve?.regra_valor != null) {
    maintenanceRatePerKm = Number(maintenanceReserve.regra_valor);
  }
  const [activeTab, setActiveTab] = useState<'pizzaria' | 'frete' | 'despesa' | 'avulso' | 'reserva'>(
    paramType ? 'reserva' : (paramTab === 'frete' ? 'frete' : 'pizzaria')
  );
  
  const expenseCategories = settings?.expense_categories || ['Combustível', 'Manutenção', 'Alimentação', 'Plano de Internet', 'Equipamento', 'Trabalho', 'Gastos Operacionais', 'Outras Despesas', 'Outros'];
  const incomeCategoriesRaw = settings?.income_categories || ['iFood', 'Uber', '99Moto', 'Particular', 'Gorjeta', 'Frete do Dia', 'Pizzaria', 'Outros'];
  const incomeCategories = incomeCategoriesRaw.filter(c => c !== 'Pizzaria' && c !== 'Frete do Dia');

  // Common Fields
  const [date, setDate] = useState(paramDate || getTodayLocalDateStr());
  const [startKm, setStartKm] = useState('');
  const [endKm, setEndKm] = useState('');
  const [description, setDescription] = useState(
    paramType === 'aporte' && paramReserveId ? 'Aporte sugerido por lançamentos' : (paramDesc || '')
  );
  
  // Pizzaria Fields starting with 0 deliveries initialized (as requested)
  const [deliveries, setDeliveries] = useState('0');
  const [outOfNeighborhood, setOutOfNeighborhood] = useState('0');

  // Frete/Despesa/Avulso Fields
  const [amount, setAmount] = useState(paramAmount || '');
  const [category, setCategory] = useState('');
  const [freightExpenseItems, setFreightExpenseItems] = useState<Array<{ id: string; category: string; amount: string }>>([
    { id: 'op-1', category: paramOpCategory || 'Pedágio', amount: paramOpExpenses || '' }
  ]);
  const [showFreightExpenses, setShowFreightExpenses] = useState<boolean>(Boolean(paramOpExpenses));
  const [showFreightCalc, setShowFreightCalc] = useState(false);

  // Reserves Tab specific state
  const [rtType, setRtType] = useState<'aporte' | 'utilizacao'>(
    paramType === 'utilizacao' ? 'utilizacao' : 'aporte'
  );
  const [reserveId, setReserveId] = useState(paramReserveId);
  const [rtCategory, setRtCategory] = useState('Combustível');

  // Payment Status & Recurrence state
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [useCustomSecondaryDate, setUseCustomSecondaryDate] = useState<boolean>(false);
  const [ignoreInCharts, setIgnoreInCharts] = useState<boolean>(false);
  const [deductFromReserve, setDeductFromReserve] = useState<boolean>(false);
  const [deductReserveId, setDeductReserveId] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurrenceMode, setRecurrenceMode] = useState<'auto' | 'fixed'>('auto');
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('monthly');
  const [recurrenceInstallments, setRecurrenceInstallments] = useState<string>('12');

  // Quick Templates (1-click favorites) & Registered Credit Cards
  const [templateUserId, setTemplateUserId] = useState<string>('');
  const [quickTemplates, setQuickTemplates] = useState<TxQuickTemplate[]>([]);
  const [showSaveTemplateInput, setShowSaveTemplateInput] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [registeredCards, setRegisteredCards] = useState<CreditCardConfig[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [cardIsRecurring, setCardIsRecurring] = useState<boolean>(false);
  const [cardRecurrenceFrequency, setCardRecurrenceFrequency] = useState<RecurrenceFrequency>('monthly');
  const [cardInstallments, setCardInstallments] = useState<string>('1');
  const [cardAmountMode, setCardAmountMode] = useState<'total' | 'installment'>('total');
  const [expenseBudgets, setExpenseBudgets] = useState<ExpenseBudgetsMap>({});
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetFocusCategory, setBudgetFocusCategory] = useState<string | null>(null);

  useEffect(() => {
    let activeUid = '';
    const hydrate = (uid: string) => {
      setQuickTemplates(planningStorage.getTemplates(uid));
      setExpenseBudgets(planningStorage.getExpenseBudgets(uid));
      const cards = planningStorage.getCards(uid);
      setRegisteredCards(cards);
      if (cards.length > 0) {
        setSelectedCardId(prev => prev || cards[0].id);
      }
    };

    getEffectiveUserId().then(uid => {
      if (uid) {
        activeUid = uid;
        setTemplateUserId(uid);
        hydrate(uid);
      }
    });

    const handleSync = (e: Event) => {
      const detailUid = (e as CustomEvent)?.detail?.userId;
      const targetUid = detailUid || activeUid;
      if (targetUid) hydrate(targetUid);
    };

    window.addEventListener('planning_data_synced', handleSync);
    return () => window.removeEventListener('planning_data_synced', handleSync);
  }, []);

  const displayedExpenseCategories = useMemo(() => {
    const hasCardCat = expenseCategories.some(c => isCreditCardCategoryName(c));
    if (registeredCards.length > 0 && !hasCardCat) {
      return [...expenseCategories, 'Cartão de Crédito'];
    }
    return expenseCategories;
  }, [expenseCategories, registeredCards.length]);

  const expenseWindowTotals = useMemo(
    () => computeExpenseWindowTotals(transactions, reserveTransactions, date),
    [transactions, reserveTransactions, date]
  );

  const allBudgetCategories = useMemo(() => {
    const set = new Set<string>([
      ...displayedExpenseCategories,
      ...(settings?.operational_expense_categories || []),
      ...Object.keys(expenseBudgets).filter(k => k !== '__ALL__'),
    ]);
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [displayedExpenseCategories, settings?.operational_expense_categories, expenseBudgets]);

  const handleOpenBudgetModal = (focusCat: string | null = null) => {
    setBudgetFocusCategory(focusCat);
    setShowBudgetModal(true);
  };

  const freightOperationalCategories = useMemo(() => {
    const base = [
      'Pedágio',
      'Combustível',
      'Manutenção',
      ...(settings?.operational_expense_categories || []),
    ];
    const seen = new Set<string>();
    const result: string[] = [];
    base.forEach(cat => {
      const trimmed = String(cat || '').trim();
      const norm = trimmed.toLowerCase();
      if (trimmed && !seen.has(norm)) {
        seen.add(norm);
        result.push(trimmed);
      }
    });
    return result;
  }, [settings?.operational_expense_categories]);

  const freightOtherExpenseCategories = useMemo(() => {
    const quickNorms = new Set(freightOperationalCategories.map(c => c.toLowerCase()));
    const candidates = [...expenseCategories, 'Gastos Operacionais', 'Trabalho', 'Alimentação', 'Outros'];
    const seen = new Set<string>();
    const result: string[] = [];
    candidates.forEach(cat => {
      const trimmed = String(cat || '').trim();
      const norm = trimmed.toLowerCase();
      if (trimmed && !isCreditCardCategoryName(trimmed) && !quickNorms.has(norm) && !seen.has(norm)) {
        seen.add(norm);
        result.push(trimmed);
      }
    });
    return result;
  }, [freightOperationalCategories, expenseCategories]);

  const freightExpenseCategoryOptions = useMemo(() => {
    return [...freightOperationalCategories, ...freightOtherExpenseCategories];
  }, [freightOperationalCategories, freightOtherExpenseCategories]);

  const filledFreightExpenses = useMemo(() => {
    return freightExpenseItems.filter(item => {
      const val = Number(item.amount);
      return !isNaN(val) && val > 0;
    });
  }, [freightExpenseItems]);

  const freightExpensesTotal = useMemo(() => {
    return Math.round(
      filledFreightExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0) * 100
    ) / 100;
  }, [filledFreightExpenses]);

  const isCardCategorySelected = activeTab === 'despesa' && isCreditCardCategoryName(category);
  const selectedCardObj = useMemo(() => {
    if (!isCardCategorySelected || !selectedCardId || selectedCardId === '__none__') return null;
    return registeredCards.find(c => c.id === selectedCardId) || null;
  }, [isCardCategorySelected, selectedCardId, registeredCards]);

  const cardPurchasePreview = useMemo(() => {
    if (!selectedCardObj) return null;
    const nInst = cardIsRecurring ? 1 : Math.max(1, Math.min(24, Number(cardInstallments) || 1));
    const rawVal = Number(amount) || 0;
    const totalPurchase =
      cardIsRecurring || cardAmountMode === 'total' ? rawVal : Math.round(rawVal * nInst * 100) / 100;
    const perInstallment =
      cardIsRecurring || cardAmountMode === 'installment' ? rawVal : Math.round((rawVal / nInst) * 100) / 100;
    const purchaseDate = date || getTodayLocalDateStr();
    const first = computeCardStatementDueDate(purchaseDate, selectedCardObj.closingDay, selectedCardObj.dueDay, 1);
    const last = computeCardStatementDueDate(purchaseDate, selectedCardObj.closingDay, selectedCardObj.dueDay, nInst);
    const nextRecurringDate = cardIsRecurring
      ? calculateNextOccurrence(first.statementDueDate, cardRecurrenceFrequency, 1)
      : null;
    return { nInst, totalPurchase, perInstallment, first, last, nextRecurringDate };
  }, [selectedCardObj, cardIsRecurring, cardRecurrenceFrequency, cardInstallments, amount, cardAmountMode, date]);

  const activeReservesList = useMemo(() => {
    return (reserves || []).filter(r => r.status !== 'inactive');
  }, [reserves]);

  const suggestedExpenseReserve = useMemo(() => {
    if (activeTab !== 'despesa' || !category) return null;
    return findMatchingReserveForExpense(category, activeReservesList);
  }, [activeTab, category, activeReservesList]);

  useEffect(() => {
    if (activeTab !== 'despesa') {
      setDeductFromReserve(false);
      setDeductReserveId('');
      return;
    }
    if (suggestedExpenseReserve) {
      setDeductReserveId(suggestedExpenseReserve.id);
    } else if (!deductReserveId || !activeReservesList.some(r => r.id === deductReserveId)) {
      setDeductReserveId(activeReservesList[0]?.id || '');
    }
  }, [activeTab, suggestedExpenseReserve?.id, activeReservesList]);

  const selectedDeductReserve = useMemo(() => {
    if (!activeReservesList.length) return null;
    if (deductReserveId) {
      const found = activeReservesList.find(r => r.id === deductReserveId);
      if (found) return found;
    }
    return suggestedExpenseReserve || activeReservesList[0] || null;
  }, [deductReserveId, activeReservesList, suggestedExpenseReserve]);

  const selectedReserveObj = useMemo(() => {
    return reserves.find(r => r.id === reserveId);
  }, [reserves, reserveId]);

  const currentCategoryName = useMemo(() => {
    if (activeTab === 'pizzaria') return 'Pizzaria';
    if (activeTab === 'frete') return 'Frete do Dia';
    if (activeTab === 'reserva') {
      if (selectedReserveObj) {
        if (selectedReserveObj.require_category_on_use === false) {
          return selectedReserveObj.default_use_category || selectedReserveObj.name || 'Manutenção';
        }
      }
      return rtCategory || 'Manutenção';
    }
    return category;
  }, [activeTab, category, rtCategory, selectedReserveObj]);

  const isCurrentCategoryVehicleRelated = useMemo(() => {
    if (activeTab === 'reserva') {
      if (rtType !== 'utilizacao') return false;
      if (searchParams.get('vehicle_id')) return true;
      if (selectedReserveObj) {
        const resCat = selectedReserveObj.require_category_on_use === false
          ? (selectedReserveObj.default_use_category || selectedReserveObj.name || 'Manutenção')
          : (rtCategory || selectedReserveObj.name || 'Manutenção');
        if (
          isVehicleRelatedCategory(resCat, 'reserva', 'expense', settings) ||
          isVehicleRelatedCategory(selectedReserveObj.name, 'reserva', 'expense', settings) ||
          isVehicleRelatedCategory(selectedReserveObj.default_use_category, 'reserva', 'expense', settings)
        ) {
          return true;
        }
      }
      return isVehicleRelatedCategory(currentCategoryName, 'reserva', 'expense', settings);
    }
    if (searchParams.get('vehicle_id')) return true;
    return isVehicleRelatedCategory(
      currentCategoryName,
      activeTab,
      activeTab === 'despesa' ? 'expense' : 'income',
      settings
    );
  }, [currentCategoryName, activeTab, rtType, selectedReserveObj, rtCategory, settings, searchParams]);

  const effectiveSelectedVehicleValue = useMemo(() => {
    if (selectedVehicleId === '__none__') return '';
    if (selectedVehicleId) return selectedVehicleId;
    if (shouldDefaultToNoVehicle(currentCategoryName)) return '';
    if (isCurrentCategoryVehicleRelated) return activeVehicle?.id || '';
    return '';
  }, [selectedVehicleId, currentCategoryName, isCurrentCategoryVehicleRelated, activeVehicle]);

  const getEffectiveVehicleId = (): string | undefined => {
    if (activeTab === 'reserva' && rtType !== 'utilizacao') return undefined;
    if (selectedVehicleId === '__none__') return undefined;
    if (selectedVehicleId && selectedVehicleId.trim() !== '') return selectedVehicleId;
    if (isCurrentCategoryVehicleRelated) {
      if (shouldDefaultToNoVehicle(currentCategoryName)) {
        return undefined;
      }
      return activeVehicle?.id || undefined;
    }
    return undefined;
  };

  const handleApplyFreight = ({
    freightPrice,
    tollExpense: calcToll,
    totalKm,
    descriptionSummary
  }: {
    freightPrice: number;
    tollExpense: number;
    totalKm: number;
    descriptionSummary: string;
  }) => {
    setAmount(String(freightPrice));
    if (calcToll > 0) {
      setFreightExpenseItems(prev => {
        const next = [...prev];
        if (next.length > 0) {
          next[0] = { ...next[0], category: 'Pedágio', amount: String(calcToll) };
        } else {
          next.push({ id: generateUUID(), category: 'Pedágio', amount: String(calcToll) });
        }
        return next;
      });
      setShowFreightExpenses(true);
    }
    if (totalKm > 0 && startKm && !isNaN(Number(startKm))) {
      setEndKm(String(Number(startKm) + totalKm));
    }
    if (descriptionSummary) {
      setDescription(prev => prev ? `${prev} | ${descriptionSummary}` : descriptionSummary);
    }
    toast.success(`Preço do frete (R$ ${freightPrice.toFixed(2)}) aplicado com sucesso!`);
  };

  const handleAddFreightExpenseRow = () => {
    setFreightExpenseItems(prev => {
      const used = new Set(prev.map(i => i.category.toLowerCase()));
      const nextCat =
        freightExpenseCategoryOptions.find(c => !used.has(c.toLowerCase())) ||
        freightExpenseCategoryOptions[0] ||
        'Pedágio';
      return [...prev, { id: generateUUID(), category: nextCat, amount: '' }];
    });
    setShowFreightExpenses(true);
  };

  const handleUpdateFreightExpenseRow = (id: string, patch: Partial<{ category: string; amount: string }>) => {
    setFreightExpenseItems(prev =>
      prev.map(item => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const handleRemoveFreightExpenseRow = (id: string) => {
    setFreightExpenseItems(prev => {
      if (prev.length <= 1) {
        return [{ ...prev[0], amount: '' }];
      }
      return prev.filter(item => item.id !== id);
    });
  };

  // Robust effect to pre-fill the initial kilometer from the last registered final kilometer
  useEffect(() => {
    if (!paramType && transactions && transactions.length > 0 && !startKm) {
      const txsWithKm = transactions.filter(t => t.end_km !== null && t.end_km !== undefined);
      if (txsWithKm.length > 0) {
        const sorted = [...txsWithKm].sort((a, b) => {
          // Robust sorting: prioritize actual transaction date, then fallback to creation time
          if (a.date !== b.date) {
            return b.date.localeCompare(a.date);
          }
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          if (timeA !== timeB) {
            return timeB - timeA;
          }
          // Secondary fallback to highest odometer to stay robust
          return (b.end_km || 0) - (a.end_km || 0);
        });
        if (sorted.length > 0 && sorted[0].end_km !== null && sorted[0].end_km !== undefined) {
          setStartKm(String(sorted[0].end_km));
        }
      }
    }
  }, [transactions, paramType, startKm]);

  useEffect(() => {
    if (paramType) {
      setActiveTab('reserva');
      setRtType(paramType);
      if (paramReserveId) setReserveId(paramReserveId);
      if (paramAmount) setAmount(paramAmount);
      if (paramType === 'aporte' && paramReserveId) {
        setDescription('Aporte sugerido por lançamentos');
      }
    } else if (paramTab === 'frete') {
      setActiveTab('frete');
      if (paramAmount) setAmount(paramAmount);
      if (paramOpExpenses || paramOpCategory) {
        setFreightExpenseItems([
          {
            id: 'op-1',
            category: paramOpCategory || 'Pedágio',
            amount: paramOpExpenses || '',
          }
        ]);
        if (paramOpExpenses) setShowFreightExpenses(true);
      }
      if (paramDesc) setDescription(paramDesc);
      if (paramDate) setDate(paramDate);
      if (paramDistanceKm && !isNaN(Number(paramDistanceKm)) && startKm && !isNaN(Number(startKm))) {
        setEndKm(String(Number(startKm) + Number(paramDistanceKm)));
      }
    }
  }, [paramType, paramReserveId, paramAmount, paramTab, paramOpExpenses, paramOpCategory, paramDesc, paramDate, paramDistanceKm, startKm]);

  const resetForm = () => {
    setDeliveries('0');
    setOutOfNeighborhood('0');
    setAmount('');
    setDescription('');
    setStartKm('');
    setEndKm('');
    setFreightExpenseItems([{ id: 'op-1', category: 'Pedágio', amount: '' }]);
    setShowFreightExpenses(false);
    setPaymentStatus('paid');
    setPaymentDate('');
    setDueDate('');
    setUseCustomSecondaryDate(false);
    setDate(getTodayLocalDateStr());
    setIsRecurring(false);
    setRecurrenceMode('auto');
    setRecurrenceFrequency('monthly');
    setRecurrenceInstallments('12');
    setIgnoreInCharts(false);
    setDeductFromReserve(false);
    setDeductReserveId('');
    setCardIsRecurring(false);
    setCardRecurrenceFrequency('monthly');
    setCardInstallments('1');
    setCardAmountMode('total');
  };

  const handleApplyTemplate = (tpl: TxQuickTemplate) => {
    setActiveTab(tpl.tab);
    setCategory(tpl.category || '');
    setAmount(tpl.amount || '');
    setDescription(tpl.description || '');
    if (tpl.deliveries !== undefined) setDeliveries(tpl.deliveries);
    if (tpl.outOfNeighborhood !== undefined) setOutOfNeighborhood(tpl.outOfNeighborhood);
    if (tpl.operationalExpenses !== undefined) {
      setFreightExpenseItems([
        { id: 'op-1', category: 'Pedágio', amount: tpl.operationalExpenses || '' }
      ]);
      if (Number(tpl.operationalExpenses) > 0) setShowFreightExpenses(true);
    }
    if (tpl.paymentStatus) setPaymentStatus(tpl.paymentStatus);
    setUseCustomSecondaryDate(false);
    setPaymentDate('');
    setDueDate('');
    setIgnoreInCharts(Boolean(tpl.ignoreInCharts));
    toast.success(`Modelo "${tpl.name}" preenchido!`);
  };

  const handleQuickLogTemplate = async (tpl: TxQuickTemplate) => {
    const uid = templateUserId || (await getEffectiveUserId());
    if (!uid) return;
    let finalAmt = Number(tpl.amount) || 0;
    if (tpl.tab === 'pizzaria' && finalAmt <= 0 && settings) {
      const d = Number(tpl.deliveries) || 0;
      const o = Number(tpl.outOfNeighborhood) || 0;
      finalAmt =
        o * settings.pizzaria_out_of_neighborhood_rate +
        (d <= settings.pizzaria_base_deliveries
          ? settings.pizzaria_base_rate
          : settings.pizzaria_daily_rate_above_base + d * settings.pizzaria_delivery_rate);
    }
    if (finalAmt <= 0) {
      handleApplyTemplate(tpl);
      return;
    }
    const todayStr = getTodayLocalDateStr();
    const newId = generateUUID();
    const payload = {
      id: newId,
      user_id: uid,
      type: (tpl.tab === 'despesa' ? 'expense' : 'income') as TransactionType,
      amount: finalAmt,
      date: todayStr,
      category: tpl.tab === 'pizzaria' ? 'Pizzaria' : tpl.tab === 'frete' ? 'Frete do Dia' : tpl.category || 'Outros',
      description: tpl.description || tpl.name,
      deliveries: tpl.tab === 'pizzaria' && tpl.deliveries ? Number(tpl.deliveries) : null,
      out_of_neighborhood: tpl.tab === 'pizzaria' && tpl.outOfNeighborhood ? Number(tpl.outOfNeighborhood) : null,
      payment_status: (tpl.tab === 'despesa' ? tpl.paymentStatus || 'paid' : 'paid') as PaymentStatus,
      payment_date: (tpl.tab === 'despesa' && tpl.paymentStatus === 'pending') ? null : todayStr,
      due_date: todayStr,
      is_recurring: false,
      ignore_in_charts: Boolean(tpl.ignoreInCharts),
      created_at: new Date().toISOString(),
    };
    setTransactions(prev => {
      const next = [payload, ...prev];
      cacheManager.set(`transactions_${uid}`, next, undefined, 'transactions');
      cacheManager.set('last_known_transactions', next, undefined, 'transactions');
      return next;
    });
    syncQueueManager.enqueue('transactions', 'insert', newId, payload);
    toast.success(`"${tpl.name}" (${formatCurrency(finalAmt)}) lançado com 1 clique!`);
  };

  const handleSaveCurrentAsTemplate = async () => {
    if (activeTab === 'reserva') {
      toast.error('Modelos rápidos estão disponíveis para ganhos, pizzaria, fretes e despesas.');
      return;
    }
    const uid = templateUserId || (await getEffectiveUserId());
    if (!uid) return;
    const catName =
      activeTab === 'pizzaria'
        ? 'Pizzaria'
        : activeTab === 'frete'
          ? 'Frete do Dia'
          : category || 'Outros';
    const computedAmt =
      activeTab === 'pizzaria' ? String(calcPizzariaEarnings()) : amount;
    const tplName = (newTemplateName.trim() || description.trim() || catName).slice(0, 32);

    const newTpl: TxQuickTemplate = {
      id: generateUUID(),
      name: tplName,
      tab: activeTab,
      category: catName,
      amount: computedAmt,
      description: description.trim() || tplName,
      deliveries: activeTab === 'pizzaria' ? deliveries : undefined,
      outOfNeighborhood: activeTab === 'pizzaria' ? outOfNeighborhood : undefined,
      operationalExpenses: activeTab === 'frete' && freightExpensesTotal > 0 ? String(freightExpensesTotal) : undefined,
      paymentStatus: activeTab === 'despesa' ? paymentStatus : 'paid',
      ignoreInCharts,
      createdAt: new Date().toISOString(),
    };

    const next = [newTpl, ...quickTemplates].slice(0, 12);
    setQuickTemplates(next);
    planningStorage.saveTemplates(uid, next);
    setShowSaveTemplateInput(false);
    setNewTemplateName('');
    toast.success(`Favorito "${tplName}" salvo para lançamentos em 1 clique!`);
  };

  const handleDeleteTemplate = (id: string) => {
    const next = quickTemplates.filter(t => t.id !== id);
    setQuickTemplates(next);
    if (templateUserId) planningStorage.saveTemplates(templateUserId, next);
    toast.success('Modelo rápido removido.');
  };


  const calcPizzariaEarnings = () => {
    if (!settings) return 0;
    
    const d = Number(deliveries) || 0;
    const o = Number(outOfNeighborhood) || 0;
    
    let total = 0;
    
    // Out of neighborhood goes on top anyway
    total += o * settings.pizzaria_out_of_neighborhood_rate;
    
    // Base rule
    if (d <= settings.pizzaria_base_deliveries) {
      total += settings.pizzaria_base_rate;
    } else {
      total += settings.pizzaria_daily_rate_above_base + (d * settings.pizzaria_delivery_rate);
    }
    
    return total; // Return numeric
  };

  const getCategoryPeriodTotal = (catName: string) => {
    if (!catName || globalPeriod === 'all') return null;
    
    const now = new Date();
    let currentStart = new Date();
    let currentEnd = new Date();
    
    if (globalPeriod === 'today') {
      currentStart = startOfDay(now);
      currentEnd = endOfDay(now);
    } else if (globalPeriod === 'week') {
      currentStart = startOfWeek(now, { weekStartsOn: 0 });
      currentEnd = endOfWeek(now, { weekStartsOn: 0 });
    } else if (globalPeriod === 'lastMonth') {
      const lastM = subMonths(now, 1);
      currentStart = startOfMonth(lastM);
      currentEnd = endOfMonth(lastM);
    } else if (globalPeriod === 'month') {
      currentStart = startOfMonth(now);
      currentEnd = endOfMonth(now);
    }

    const type = activeTab === 'despesa' ? 'expense' : 'income';

    const periodTotal = transactions
      .filter(t => t.type === type && t.category === catName)
      .filter(t => isWithinInterval(parseISO(t.date), { start: currentStart, end: currentEnd }))
      .reduce((acc, t) => acc + Number(t.amount), 0);

    return periodTotal;
  };

  const formatCurrency = (val: number) => {
    if (hideValues) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const globalIconMap: Record<string, any> = {
    Bike, Car, Package, Utensils, Fuel, Wrench, Wifi, ShoppingBag, Landmark, 
    Briefcase, Zap, Heart, Camera, Gift, Coffee, Pizza, Beer, DollarSign, 
    PiggyBank, Hammer, Shield, MapPin, Phone, MessageSquare, TrendingUp, TrendingDown,
    Wallet, CreditCard, ShoppingCart, Home, Settings, User, Scissors, Music, Video, 
    Gamepad, Globe, Plane, Train, Bus, Truck, Hospital, School, GraduationCap, 
    Users, Smile, Frown, Star, Bell, Clock, Calendar, Filter
  };

  const getCategoryIcon = (catName: string) => {
    // Check settings first
    if (settings?.category_icons && settings.category_icons[catName]) {
      const iconName = settings.category_icons[catName];
      return globalIconMap[iconName] || TrendingUp;
    }

    // Default fallbacks based on name
    const normalized = catName.toLowerCase();
    if (isCreditCardCategoryName(catName)) return CreditCard;
    if (normalized.includes('pedágio') || normalized.includes('pedagio')) return MapPin;
    if (normalized.includes('combustível') || normalized.includes('gasolina')) return Fuel;
    if (normalized.includes('manutenção') || normalized.includes('oficina') || normalized.includes('peça')) return Wrench;
    if (normalized.includes('aliment') || normalized.includes('almoço')) return Utensils;
    if (normalized.includes('internet') || normalized.includes('celular')) return Wifi;
    if (normalized.includes('ifood') || normalized.includes('shopee')) return ShoppingBag;
    if (normalized.includes('uber') || normalized.includes('99')) return Car;
    if (normalized.includes('transporte') || normalized.includes('viagem')) return MapPin;
    if (normalized.includes('moto')) return Bike;
    if (normalized.includes('particular')) return Landmark;
    
    return activeTab === 'despesa' ? TrendingDown : TrendingUp;
  };

  const calculateFuel = () => {
    if (!settings || !settings.vehicle_km_per_liter || !settings.fuel_price) return 0;
    const sKm = Number(startKm) || 0;
    const eKm = Number(endKm) || 0;
    if (eKm <= sKm) return 0;
    const distance = eKm - sKm;
    return (distance / settings.vehicle_km_per_liter) * settings.fuel_price;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const userId = (await getEffectiveUserId()) || 'default';

      let finalType = 'income';
      let finalAmount = 0;
      let finalCategory = '';

      if (activeTab === 'reserva') {
        if (!reserveId) {
          toast.error('Selecione uma reserva.');
          setLoading(false);
          return;
        }
        const finalAmt = Number(amount);
        if (isNaN(finalAmt) || finalAmt <= 0) {
          toast.error('Informe um valor válido maior que zero.');
          setLoading(false);
          return;
        }

        const selectedRes = reserves.find(r => r.id === reserveId);

        // Determine correct category for 'utilizacao'
        let finalRtCategory = rtCategory;
        if (selectedRes && selectedRes.require_category_on_use === false) {
          finalRtCategory = selectedRes.default_use_category || selectedRes.name;
        }

        const effectivePaymentStatus = paymentStatus;
        const effectivePaymentDate = effectivePaymentStatus === 'paid'
          ? ((useCustomSecondaryDate ? paymentDate.trim() : '') || date || getTodayLocalDateStr())
          : null;
        const effectiveDueDate = (useCustomSecondaryDate ? dueDate.trim() : '') || date;

        let targetHighlightId = '';

        if (isRecurring && recurrenceMode === 'auto') {
          const recurrenceGroupId = generateUUID();
          const reserveVehicleId = getEffectiveVehicleId();
          const baseDesc = description || (rtType === 'aporte' ? `Aporte para ${selectedRes?.name}` : `Uso da reserva ${selectedRes?.name}`);

          const rtId = await addReserveTransaction({
            reserve_id: reserveId,
            type: rtType,
            amount: finalAmt,
            date: date,
            category: rtType === 'utilizacao' ? finalRtCategory : 'Aporte Extra',
            description: baseDesc,
            payment_status: effectivePaymentStatus,
            payment_date: effectivePaymentDate,
            due_date: effectiveDueDate,
            is_recurring: true,
            recurrence_frequency: recurrenceFrequency,
            recurrence_installments: null,
            recurrence_group_id: recurrenceGroupId,
            installment_number: 1,
            installment_total: null,
            installment_index: 1,
            total_installments: null,
            vehicle_id: reserveVehicleId,
            ignore_in_charts: ignoreInCharts,
          }, { silent: true });

          targetHighlightId = rtId || '';

          if (effectivePaymentStatus === 'paid') {
            const nextDate = calculateNextOccurrence(effectiveDueDate || date, recurrenceFrequency, 1);
            await addReserveTransaction({
              reserve_id: reserveId,
              type: rtType,
              amount: finalAmt,
              date: nextDate,
              category: rtType === 'utilizacao' ? finalRtCategory : 'Aporte Extra',
              description: baseDesc,
              payment_status: 'pending',
              payment_date: null,
              due_date: nextDate,
              is_recurring: true,
              recurrence_frequency: recurrenceFrequency,
              recurrence_installments: null,
              recurrence_group_id: recurrenceGroupId,
              installment_number: 2,
              installment_total: null,
              installment_index: 2,
              total_installments: null,
              vehicle_id: reserveVehicleId,
              ignore_in_charts: ignoreInCharts,
            }, { silent: true });
            toast.success(`Lançado! Próxima conta recorrente agendada para ${format(parseLocalDate(nextDate), 'dd/MM/yyyy')}.`, { id: 'add-tx' });
          } else {
            toast.success(
              `Conta recorrente (${getFrequencyLabel(recurrenceFrequency)}) agendada na reserva! A próxima será gerada ao quitar.`,
              { id: 'add-tx' }
            );
          }
        } else if (isRecurring) {
          const numInstallments = Math.max(2, Math.min(60, Number(recurrenceInstallments) || 12));
          const recurrenceGroupId = generateUUID();
          const reserveVehicleId = getEffectiveVehicleId();

          for (let i = 1; i <= numInstallments; i++) {
            const isFirst = i === 1;
            const installmentDate = isFirst ? date : calculateNextOccurrence(date, recurrenceFrequency, i - 1);
            const installmentDueDate = isFirst ? effectiveDueDate : installmentDate;
            const installmentPaymentStatus: PaymentStatus = isFirst ? effectivePaymentStatus : 'pending';
            const installmentPaymentDate = isFirst && effectivePaymentStatus === 'paid' ? effectivePaymentDate : null;

            const baseDesc = description || (rtType === 'aporte' ? `Aporte para ${selectedRes?.name}` : `Uso da reserva ${selectedRes?.name}`);
            const installmentDesc = `${baseDesc} (${i}/${numInstallments})`;

            const rtId = await addReserveTransaction({
              reserve_id: reserveId,
              type: rtType,
              amount: finalAmt,
              date: installmentDate,
              category: rtType === 'utilizacao' ? finalRtCategory : 'Aporte Extra',
              description: installmentDesc,
              payment_status: installmentPaymentStatus,
              payment_date: installmentPaymentDate,
              due_date: installmentDueDate,
              is_recurring: true,
              recurrence_frequency: recurrenceFrequency,
              recurrence_installments: numInstallments,
              recurrence_group_id: recurrenceGroupId,
              installment_number: i,
              installment_total: numInstallments,
              vehicle_id: reserveVehicleId,
              ignore_in_charts: ignoreInCharts,
            }, { silent: true });

            if (isFirst) {
              targetHighlightId = rtId;
            }
          }

          toast.success(
            rtType === 'aporte'
              ? `Aporte recorrente programado (${numInstallments} parcelas)!`
              : `Resgate recorrente programado (${numInstallments} parcelas)!`,
            { id: 'add-tx' }
          );
        } else {
          // Single reserve transaction
          const reserveVehicleId = getEffectiveVehicleId();

          const rtId = await addReserveTransaction({
            reserve_id: reserveId,
            type: rtType,
            amount: finalAmt,
            date: date,
            category: rtType === 'utilizacao' ? finalRtCategory : 'Aporte Extra',
            description: description || (rtType === 'aporte' ? `Aporte para ${selectedRes?.name}` : `Uso da reserva ${selectedRes?.name}`),
            payment_status: effectivePaymentStatus,
              payment_date: effectivePaymentDate,
              due_date: effectiveDueDate,
              is_recurring: false,
              vehicle_id: reserveVehicleId,
              ignore_in_charts: ignoreInCharts,
            }, { silent: true });

          targetHighlightId = rtId;
          toast.success(
            rtType === 'aporte'
              ? (effectivePaymentStatus === 'paid' ? 'Aporte efetuado com sucesso!' : 'Aporte agendado como pendente!')
              : (effectivePaymentStatus === 'paid' ? 'Resgate efetuado com sucesso!' : 'Resgate agendado como pendente!'),
            { id: 'add-tx' }
          );
        }

        resetForm();
        await refreshData(true);
        navigate(`/history?highlight=${targetHighlightId}`);
        return;
      }

      if (activeTab === 'pizzaria') {
        finalAmount = calcPizzariaEarnings();
        finalCategory = 'Pizzaria';
        if (finalAmount <= 0) {
          toast.error('Ganhos não calculados corretamente.', { id: 'add-tx' });
          setLoading(false);
          return;
        }
      } else if (activeTab === 'frete') {
        finalAmount = Number(amount);
        finalCategory = 'Frete do Dia';
      } else if (activeTab === 'avulso') {
        finalAmount = Number(amount);
        finalCategory = category || 'Ganho Diversos';
      } else if (activeTab === 'despesa') {
        finalAmount = Number(amount);
        finalType = 'expense';
        finalCategory = category || 'Outras Despesas';
      }

      if (activeTab !== 'pizzaria' && finalAmount <= 0) {
        toast.error('Informe um valor válido.', { id: 'add-tx' });
        setLoading(false);
        return;
      }

      // Smart Expense-to-Reserve Deduction: route non-card expense as a reserve utilization when opted-in
      if (activeTab === 'despesa' && deductFromReserve && selectedDeductReserve && !selectedCardObj) {
        const effectivePaymentStatus = paymentStatus;
        const effectivePaymentDate = effectivePaymentStatus === 'paid'
          ? ((useCustomSecondaryDate ? paymentDate.trim() : '') || date || getTodayLocalDateStr())
          : null;
        const effectiveDueDate = (useCustomSecondaryDate ? dueDate.trim() : '') || date;
        const reserveVehicleId = getEffectiveVehicleId();
        let targetHighlightId = '';

        if (isRecurring && recurrenceMode === 'auto') {
          const recurrenceGroupId = generateUUID();
          const baseDesc = description || finalCategory || `Uso da reserva ${selectedDeductReserve.name}`;
          const rtId = await addReserveTransaction({
            reserve_id: selectedDeductReserve.id,
            type: 'utilizacao',
            amount: finalAmount,
            date: date,
            category: finalCategory,
            description: baseDesc,
            payment_status: effectivePaymentStatus,
            payment_date: effectivePaymentDate,
            due_date: effectiveDueDate,
            is_recurring: true,
            recurrence_frequency: recurrenceFrequency,
            recurrence_installments: null,
            recurrence_group_id: recurrenceGroupId,
            installment_number: 1,
            installment_total: null,
            installment_index: 1,
            total_installments: null,
            vehicle_id: reserveVehicleId,
            ignore_in_charts: ignoreInCharts,
          }, { silent: true });

          if (rtId) targetHighlightId = rtId;

          if (effectivePaymentStatus === 'paid') {
            const nextDate = calculateNextOccurrence(effectiveDueDate || date, recurrenceFrequency, 1);
            await addReserveTransaction({
              reserve_id: selectedDeductReserve.id,
              type: 'utilizacao',
              amount: finalAmount,
              date: nextDate,
              category: finalCategory,
              description: baseDesc,
              payment_status: 'pending',
              payment_date: null,
              due_date: nextDate,
              is_recurring: true,
              recurrence_frequency: recurrenceFrequency,
              recurrence_installments: null,
              recurrence_group_id: recurrenceGroupId,
              installment_number: 2,
              installment_total: null,
              installment_index: 2,
              total_installments: null,
              vehicle_id: reserveVehicleId,
              ignore_in_charts: ignoreInCharts,
            }, { silent: true });
            toast.success(`Abatido da reserva "${selectedDeductReserve.name}"! Próxima agendada para ${format(parseLocalDate(nextDate), 'dd/MM/yyyy')}.`, { id: 'add-tx' });
          } else {
            toast.success(`Conta recorrente agendada na reserva "${selectedDeductReserve.name}"!`, { id: 'add-tx' });
          }
        } else if (isRecurring) {
          const numInstallments = Math.max(2, Math.min(60, Number(recurrenceInstallments) || 12));
          const recurrenceGroupId = generateUUID();

          for (let i = 1; i <= numInstallments; i++) {
            const isFirst = i === 1;
            const instDate = isFirst ? date : calculateNextOccurrence(date, recurrenceFrequency, i - 1);
            const instDueDate = isFirst ? effectiveDueDate : instDate;
            const instPaymentStatus: PaymentStatus = isFirst ? effectivePaymentStatus : 'pending';
            const instPaymentDate = isFirst && effectivePaymentStatus === 'paid' ? effectivePaymentDate : null;
            const baseDesc = description || finalCategory || `Uso da reserva ${selectedDeductReserve.name}`;
            const instDesc = `${baseDesc} (${i}/${numInstallments})`;

            const rtId = await addReserveTransaction({
              reserve_id: selectedDeductReserve.id,
              type: 'utilizacao',
              amount: finalAmount,
              date: instDate,
              category: finalCategory,
              description: instDesc,
              payment_status: instPaymentStatus,
              payment_date: instPaymentDate,
              due_date: instDueDate,
              is_recurring: true,
              recurrence_frequency: recurrenceFrequency,
              recurrence_installments: numInstallments,
              recurrence_group_id: recurrenceGroupId,
              installment_number: i,
              installment_total: numInstallments,
              vehicle_id: reserveVehicleId,
              ignore_in_charts: ignoreInCharts,
            }, { silent: true });

            if (isFirst && rtId) targetHighlightId = rtId;
          }

          toast.success(`Despesa recorrente (${numInstallments}x) abatida da reserva "${selectedDeductReserve.name}"!`, { id: 'add-tx' });
        } else {
          const rtId = await addReserveTransaction({
            reserve_id: selectedDeductReserve.id,
            type: 'utilizacao',
            amount: finalAmount,
            date: date,
            category: finalCategory,
            description: description || `${finalCategory} (Reserva ${selectedDeductReserve.name})`,
            payment_status: effectivePaymentStatus,
            payment_date: effectivePaymentDate,
            due_date: effectiveDueDate,
            is_recurring: false,
            vehicle_id: reserveVehicleId,
            ignore_in_charts: ignoreInCharts,
          }, { silent: true });

          if (rtId) targetHighlightId = rtId;

          toast.success(`Despesa de ${formatCurrency(finalAmount)} ${effectivePaymentStatus === 'paid' ? 'abatida da' : 'agendada na'} reserva "${selectedDeductReserve.name}"!`, { id: 'add-tx' });
        }

        resetForm();
        await refreshData(true);
        navigate(targetHighlightId ? `/history?highlight=${targetHighlightId}` : '/history');
        return;
      }

      // Handle Credit Card Purchases linked to a registered card
      if (activeTab === 'despesa' && isCardCategorySelected && selectedCardObj) {
        const rawLabel = (description || '').trim();
        const cardPrefix = `[Cartão ${selectedCardObj.name}]`;
        const cleanLabel = rawLabel || finalCategory || 'Compra no cartão';
        const baseDesc = cleanLabel.toLowerCase().includes('[cartão') || cleanLabel.toLowerCase().includes('[cartao')
          ? cleanLabel
          : `${cardPrefix} ${cleanLabel}`;

        const purchaseDate = date || getTodayLocalDateStr();
        const cardBatchIds: string[] = [];

        if (cardIsRecurring) {
          const groupId = generateUUID();
          const { statementDueDate } = computeCardStatementDueDate(
            purchaseDate,
            selectedCardObj.closingDay,
            selectedCardObj.dueDay,
            1
          );
          const instStatus: PaymentStatus = paymentStatus;
          const instPayDate =
            instStatus === 'paid'
              ? ((useCustomSecondaryDate ? paymentDate.trim() : '') || statementDueDate)
              : null;

          if (deductFromReserve && selectedDeductReserve) {
            const firstRtId = await addReserveTransaction({
              reserve_id: selectedDeductReserve.id,
              type: 'utilizacao',
              amount: finalAmount,
              date: statementDueDate,
              due_date: statementDueDate,
              category: finalCategory,
              description: baseDesc,
              payment_status: instStatus,
              payment_date: instPayDate,
              is_recurring: true,
              recurrence_frequency: cardRecurrenceFrequency,
              recurrence_installments: null,
              recurrence_group_id: groupId,
              installment_number: 1,
              installment_total: null,
              installment_index: 1,
              total_installments: null,
              vehicle_id: getEffectiveVehicleId(),
              ignore_in_charts: ignoreInCharts,
            }, { silent: true });
            if (firstRtId) cardBatchIds.push(firstRtId);

            if (instStatus === 'paid') {
              const nextDate = calculateNextOccurrence(statementDueDate, cardRecurrenceFrequency, 1);
              const nextRt = buildNextRecurringReserveTransaction(
                {
                  id: firstRtId || generateUUID(),
                  user_id: userId,
                  reserve_id: selectedDeductReserve.id,
                  type: 'utilizacao',
                  amount: finalAmount,
                  date: statementDueDate,
                  due_date: statementDueDate,
                  category: finalCategory,
                  description: baseDesc,
                  is_recurring: true,
                  recurrence_frequency: cardRecurrenceFrequency,
                  recurrence_group_id: groupId,
                  installment_number: 1,
                  vehicle_id: getEffectiveVehicleId(),
                  ignore_in_charts: ignoreInCharts,
                },
                nextDate,
                groupId,
                userId
              );
              const nextRtId = await addReserveTransaction({
                reserve_id: nextRt.reserve_id,
                type: nextRt.type,
                amount: nextRt.amount,
                date: nextRt.date,
                due_date: nextRt.due_date,
                category: nextRt.category,
                description: nextRt.description,
                payment_status: 'pending',
                payment_date: null,
                is_recurring: true,
                recurrence_frequency: cardRecurrenceFrequency,
                recurrence_installments: null,
                recurrence_group_id: groupId,
                installment_number: 2,
                installment_total: null,
                installment_index: 2,
                total_installments: null,
                vehicle_id: nextRt.vehicle_id,
                ignore_in_charts: nextRt.ignore_in_charts,
              }, { silent: true });
              if (nextRtId) cardBatchIds.push(nextRtId);
            }

            if (cardBatchIds.length > 0) {
              planningStorage.linkTxsToCard(userId, cardBatchIds, selectedCardObj.id);
            }
            await refreshData(true);
            toast.success(
              `Compra recorrente (${getFrequencyLabel(cardRecurrenceFrequency)}) lançada no ${selectedCardObj.name} (Reserva "${selectedDeductReserve.name}")!`,
              { id: 'add-tx' }
            );
            resetForm();
            navigate('/planning');
            return;
          }

          const firstId = generateUUID();
          cardBatchIds.push(firstId);
          const firstPayload: any = {
            id: firstId,
            user_id: userId,
            type: 'expense' as TransactionType,
            amount: finalAmount,
            date: statementDueDate,
            due_date: statementDueDate,
            category: finalCategory,
            description: baseDesc,
            payment_status: instStatus,
            payment_date: instPayDate,
            is_recurring: true,
            recurrence_frequency: cardRecurrenceFrequency,
            recurrence_installments: null,
            recurrence_group_id: groupId,
            installment_number: 1,
            installment_total: null,
            installment_index: 1,
            total_installments: null,
            start_km: null,
            end_km: null,
            deliveries: null,
            out_of_neighborhood: null,
            vehicle_id: getEffectiveVehicleId(),
            card_id: selectedCardObj.id,
            card_name: selectedCardObj.name,
            card_installments: 1,
            card_installment_index: 1,
            ignore_in_charts: ignoreInCharts,
            created_at: new Date().toISOString(),
          };
          const cardBatch: any[] = [firstPayload];
          syncQueueManager.enqueue('transactions', 'insert', firstId, firstPayload);

          if (instStatus === 'paid') {
            const nextDate = calculateNextOccurrence(statementDueDate, cardRecurrenceFrequency, 1);
            const nextTx = buildNextRecurringTransaction(firstPayload, nextDate, groupId, userId);
            cardBatch.unshift(nextTx);
            cardBatchIds.push(nextTx.id);
            syncQueueManager.enqueue('transactions', 'insert', nextTx.id, nextTx);
          }

          planningStorage.linkTxsToCard(userId, cardBatchIds, selectedCardObj.id);
          setTransactions(prev => {
            const newState = [...cardBatch, ...prev];
            cacheManager.set(`transactions_${userId}`, newState, undefined, 'transactions');
            cacheManager.set('last_known_transactions', newState, undefined, 'transactions');
            return newState;
          });

          toast.success(
            `Compra recorrente (${getFrequencyLabel(cardRecurrenceFrequency)}) lançada na fatura do ${selectedCardObj.name}!`,
            { id: 'add-tx' }
          );
          resetForm();
          navigate('/planning');
          return;
        }

        const nInst = Math.max(1, Math.min(24, Number(cardInstallments) || 1));
        const totalPurchase =
          cardAmountMode === 'total' ? finalAmount : Math.round(finalAmount * nInst * 100) / 100;
        const baseInstAmt = Math.floor((totalPurchase / nInst) * 100) / 100;
        const remainderCents = Math.round((totalPurchase - baseInstAmt * nInst) * 100) / 100;
        const groupId = nInst > 1 ? generateUUID() : null;

        if (deductFromReserve && selectedDeductReserve) {
          for (let i = 1; i <= nInst; i++) {
            const { statementDueDate } = computeCardStatementDueDate(
              purchaseDate,
              selectedCardObj.closingDay,
              selectedCardObj.dueDay,
              i
            );
            const instAmt = i === 1 ? Math.round((baseInstAmt + remainderCents) * 100) / 100 : baseInstAmt;
            const parcelSuffix = nInst > 1 ? ` (${i}/${nInst})` : '';
            const instStatus: PaymentStatus = i === 1 ? paymentStatus : 'pending';
            const instPayDate =
              instStatus === 'paid'
                ? ((useCustomSecondaryDate ? paymentDate.trim() : '') || statementDueDate)
                : null;

            const rtId = await addReserveTransaction({
              reserve_id: selectedDeductReserve.id,
              type: 'utilizacao',
              amount: instAmt,
              date: statementDueDate,
              due_date: statementDueDate,
              category: finalCategory,
              description: `${baseDesc}${parcelSuffix}`,
              payment_status: instStatus,
              payment_date: instPayDate,
              is_recurring: nInst > 1,
              recurrence_frequency: nInst > 1 ? ('monthly' as RecurrenceFrequency) : undefined,
              recurrence_installments: nInst > 1 ? nInst : null,
              recurrence_group_id: groupId,
              installment_number: nInst > 1 ? i : null,
              installment_total: nInst > 1 ? nInst : null,
              installment_index: nInst > 1 ? i : null,
              total_installments: nInst > 1 ? nInst : null,
              vehicle_id: getEffectiveVehicleId(),
              ignore_in_charts: ignoreInCharts,
            }, { silent: true });

            if (rtId) cardBatchIds.push(rtId);
          }

          if (cardBatchIds.length > 0) {
            planningStorage.linkTxsToCard(userId, cardBatchIds, selectedCardObj.id);
          }

          await refreshData(true);
          toast.success(
            nInst > 1
              ? `Compra parcelada em ${nInst}x lançada na fatura do ${selectedCardObj.name} (Reserva "${selectedDeductReserve.name}")!`
              : `Compra lançada na fatura do ${selectedCardObj.name} (Reserva "${selectedDeductReserve.name}")!`,
            { id: 'add-tx' }
          );
          resetForm();
          navigate('/planning');
          return;
        }

        const cardBatch: any[] = [];

        for (let i = 1; i <= nInst; i++) {
          const { statementDueDate } = computeCardStatementDueDate(
            purchaseDate,
            selectedCardObj.closingDay,
            selectedCardObj.dueDay,
            i
          );
          const instId = generateUUID();
          cardBatchIds.push(instId);
          const instAmt = i === 1 ? Math.round((baseInstAmt + remainderCents) * 100) / 100 : baseInstAmt;
          const parcelSuffix = nInst > 1 ? ` (${i}/${nInst})` : '';
          const instStatus: PaymentStatus = i === 1 ? paymentStatus : 'pending';
          const instPayDate =
            instStatus === 'paid'
              ? ((useCustomSecondaryDate ? paymentDate.trim() : '') || statementDueDate)
              : null;

          const payload = {
            id: instId,
            user_id: userId,
            type: 'expense' as TransactionType,
            amount: instAmt,
            date: statementDueDate,
            due_date: statementDueDate,
            category: finalCategory,
            description: `${baseDesc}${parcelSuffix}`,
            payment_status: instStatus,
            payment_date: instPayDate,
            is_recurring: nInst > 1,
            recurrence_frequency: nInst > 1 ? ('monthly' as RecurrenceFrequency) : undefined,
            recurrence_installments: nInst > 1 ? nInst : null,
            recurrence_group_id: groupId,
            installment_number: nInst > 1 ? i : null,
            installment_total: nInst > 1 ? nInst : null,
            start_km: null,
            end_km: null,
            deliveries: null,
            out_of_neighborhood: null,
            vehicle_id: getEffectiveVehicleId(),
            card_id: selectedCardObj.id,
            card_name: selectedCardObj.name,
            card_installments: nInst,
            card_installment_index: i,
            ignore_in_charts: ignoreInCharts,
            created_at: new Date().toISOString(),
          };
          cardBatch.push(payload);
          syncQueueManager.enqueue('transactions', 'insert', instId, payload);
        }

        planningStorage.linkTxsToCard(userId, cardBatchIds, selectedCardObj.id);

        setTransactions(prev => {
          const newState = [...cardBatch, ...prev];
          cacheManager.set(`transactions_${userId}`, newState, undefined, 'transactions');
          cacheManager.set('last_known_transactions', newState, undefined, 'transactions');
          return newState;
        });

        toast.success(
          nInst > 1
            ? `Compra parcelada em ${nInst}x lançada na fatura do ${selectedCardObj.name}!`
            : `Compra lançada na fatura do ${selectedCardObj.name}!`,
          { id: 'add-tx' }
        );
        resetForm();
        navigate('/planning');
        return;
      }

      // Handle Recurring Expenses
      if (activeTab === 'despesa' && isRecurring && recurrenceMode === 'auto') {
        const recurrenceGroupId = generateUUID();
        const effectiveDueDate = (useCustomSecondaryDate ? dueDate.trim() : '') || date;
        const effectivePaymentDate = paymentStatus === 'paid'
          ? ((useCustomSecondaryDate ? paymentDate.trim() : '') || date || getTodayLocalDateStr())
          : null;
        const firstTxId = generateUUID();
        const baseDesc = description || finalCategory || 'Despesa';

        const firstPayload: any = {
          id: firstTxId,
          user_id: userId,
          type: 'expense' as TransactionType,
          amount: finalAmount,
          date: date,
          category: finalCategory,
          description: baseDesc,
          payment_status: paymentStatus,
          payment_date: effectivePaymentDate,
          due_date: effectiveDueDate,
          is_recurring: true,
          recurrence_frequency: recurrenceFrequency,
          recurrence_installments: null,
          recurrence_group_id: recurrenceGroupId,
          installment_number: 1,
          installment_total: null,
          installment_index: 1,
          total_installments: null,
          start_km: null,
          end_km: null,
          deliveries: null,
          out_of_neighborhood: null,
          vehicle_id: getEffectiveVehicleId(),
          ignore_in_charts: ignoreInCharts,
          created_at: new Date().toISOString()
        };

        const batchToInsert = [firstPayload];
        syncQueueManager.enqueue('transactions', 'insert', firstTxId, firstPayload);

        let nextDateLabel = '';
        if (paymentStatus === 'paid') {
          const nextDate = calculateNextOccurrence(effectiveDueDate, recurrenceFrequency, 1);
          const nextTx = buildNextRecurringTransaction(firstPayload, nextDate, recurrenceGroupId, userId);
          batchToInsert.unshift(nextTx);
          syncQueueManager.enqueue('transactions', 'insert', nextTx.id, nextTx);
          nextDateLabel = format(parseLocalDate(nextDate), 'dd/MM/yyyy');
        }

        setTransactions(prev => {
          const newState = [...batchToInsert, ...prev];
          cacheManager.set(`transactions_${userId}`, newState, undefined, 'transactions');
          cacheManager.set('last_known_transactions', newState, undefined, 'transactions');
          return newState;
        });

        toast.success(
          nextDateLabel
            ? `Despesa paga! Próxima conta recorrente agendada para ${nextDateLabel}.`
            : `Conta recorrente (${getFrequencyLabel(recurrenceFrequency)}) agendada! Próxima será gerada ao quitar.`,
          { id: 'add-tx' }
        );
        resetForm();
        navigate(`/history?highlight=${firstTxId}`);
        return;
      }

      if (activeTab === 'despesa' && isRecurring) {
        const numInstallments = Math.max(2, Math.min(60, Number(recurrenceInstallments) || 12));
        const recurrenceGroupId = generateUUID();
        const effectiveDueDate = (useCustomSecondaryDate ? dueDate.trim() : '') || date;
        const effectivePaymentDate = paymentStatus === 'paid'
          ? ((useCustomSecondaryDate ? paymentDate.trim() : '') || date || getTodayLocalDateStr())
          : null;

        const newTxBatch: any[] = [];
        let firstTxId = '';

        for (let i = 1; i <= numInstallments; i++) {
          const isFirst = i === 1;
          const instId = isFirst ? generateUUID() : generateUUID();
          if (isFirst) firstTxId = instId;

          const instDate = isFirst ? date : calculateNextOccurrence(date, recurrenceFrequency, i - 1);
          const instDueDate = isFirst ? effectiveDueDate : instDate;
          const instPaymentStatus: PaymentStatus = isFirst ? paymentStatus : 'pending';
          const instPaymentDate = isFirst && paymentStatus === 'paid' ? effectivePaymentDate : null;

          const baseDesc = description || finalCategory || 'Despesa';
          const instDesc = `${baseDesc} (${i}/${numInstallments})`;

          const payload = {
            id: instId,
            user_id: userId,
            type: 'expense' as TransactionType,
            amount: finalAmount,
            date: instDate,
            category: finalCategory,
            description: instDesc,
            payment_status: instPaymentStatus,
            payment_date: instPaymentDate,
            due_date: instDueDate,
            is_recurring: true,
            recurrence_frequency: recurrenceFrequency,
            recurrence_installments: numInstallments,
            recurrence_group_id: recurrenceGroupId,
            installment_number: i,
            installment_total: numInstallments,
            start_km: null,
            end_km: null,
            deliveries: null,
            out_of_neighborhood: null,
            vehicle_id: getEffectiveVehicleId(),
            ignore_in_charts: ignoreInCharts,
            created_at: new Date().toISOString()
          };

          newTxBatch.push(payload);
          syncQueueManager.enqueue('transactions', 'insert', instId, payload);
        }

        // Optimistic update for full batch
        setTransactions(prev => {
          const newState = [...newTxBatch, ...prev];
          cacheManager.set(`transactions_${userId}`, newState, undefined, 'transactions');
          cacheManager.set('last_known_transactions', newState, undefined, 'transactions');
          return newState;
        });

        toast.success(`Despesa recorrente criada com sucesso (${numInstallments} parcelas)!`, { id: 'add-tx' });
        resetForm();
        navigate(`/history?highlight=${firstTxId}`);
        return;
      }

      // Single Transaction (Normal Flow)
      const newTxId = generateUUID();
      const effectivePaymentStatus: PaymentStatus = activeTab === 'despesa' ? paymentStatus : 'paid';
      const effectivePaymentDate = effectivePaymentStatus === 'paid'
        ? ((useCustomSecondaryDate ? paymentDate.trim() : '') || date || getTodayLocalDateStr())
        : null;
      const effectiveDueDate = (activeTab === 'despesa' && useCustomSecondaryDate && dueDate.trim()) ? dueDate.trim() : date;

      const newTxPayload = {
        id: newTxId,
        user_id: userId,
        type: finalType as TransactionType,
        amount: finalAmount,
        date: date,
        category: finalCategory,
        description: description,
        start_km: startKm ? Number(startKm) : null,
        end_km: endKm ? Number(endKm) : null,
        deliveries: finalCategory === 'Pizzaria' && deliveries ? Number(deliveries) : null,
        out_of_neighborhood: finalCategory === 'Pizzaria' && outOfNeighborhood ? Number(outOfNeighborhood) : null,
        payment_status: effectivePaymentStatus,
        payment_date: effectivePaymentDate,
        due_date: effectiveDueDate,
        vehicle_id: getEffectiveVehicleId(),
        is_recurring: false,
        ignore_in_charts: ignoreInCharts,
        created_at: new Date().toISOString()
      };

      // Optimistic state and cache update
      setTransactions(prev => {
        const newState = [newTxPayload, ...prev];
        cacheManager.set(`transactions_${userId}`, newState, undefined, 'transactions');
        cacheManager.set('last_known_transactions', newState, undefined, 'transactions');
        return newState;
      });

      // Enqueue the primary transaction insertion
      syncQueueManager.enqueue('transactions', 'insert', newTxId, newTxPayload);

      // Handle optional operational expenses for freight (supports multiple categorized items)
      if (activeTab === 'frete' && filledFreightExpenses.length > 0) {
        const opPayloads = filledFreightExpenses.map(item => {
          const opVal = Math.round(Number(item.amount) * 100) / 100;
          const chosenOpCategory = (item.category || 'Pedágio').trim() || 'Pedágio';
          const opVehicleId =
            isVehicleRelatedCategory(chosenOpCategory, 'despesa', 'expense', settings) &&
            !shouldDefaultToNoVehicle(chosenOpCategory)
              ? getEffectiveVehicleId()
              : undefined;

          return {
            id: generateUUID(),
            user_id: userId,
            type: 'expense' as TransactionType,
            amount: opVal,
            date: date,
            category: chosenOpCategory,
            description: description
              ? `[${chosenOpCategory}] ${description}`
              : `${chosenOpCategory} (Frete)`,
            payment_status: 'paid' as PaymentStatus,
            payment_date: date,
            due_date: date,
            vehicle_id: opVehicleId,
            ignore_in_charts: ignoreInCharts,
            created_at: new Date().toISOString()
          };
        });

        setTransactions(prev => {
          const newState = [...opPayloads, ...prev];
          cacheManager.set(`transactions_${userId}`, newState, undefined, 'transactions');
          cacheManager.set('last_known_transactions', newState, undefined, 'transactions');
          return newState;
        });

        opPayloads.forEach(opPayload => {
          syncQueueManager.enqueue('transactions', 'insert', opPayload.id, opPayload);
        });
      }

      // If this transaction was generated from a freight quote, mark quote as completed
      if (paramQuoteId) {
        try {
          const quotes = freightStorage.getQuotes(userId);
          const found = quotes.find(q => q.id === paramQuoteId);
          if (found) {
            freightStorage.saveQuote({
              ...found,
              status: 'completed',
              converted_to_transaction_id: newTxId,
              converted_at: new Date().toISOString(),
            }, userId);
          }
        } catch (e) {
          console.warn('Erro ao atualizar status do orçamento após lançamento:', e);
        }
      }

      toast.success('Lançamento salvo com sucesso!', { id: 'add-tx' });
      resetForm();
      if (newTxId) {
        navigate(`/history?highlight=${newTxId}`);
      } else {
        navigate('/history');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar o lançamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-2xl mx-auto p-3 sm:p-4 md:p-8 space-y-5 sm:space-y-6 animate-fade-in">
      <header className="border-b border-border/55 pb-4 sm:pb-5">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
          Registrar Atividade
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm font-medium mt-0.5">
          Escolha a modalidade e preencha os dados abaixo de forma rápida e segura.
        </p>
      </header>

      {/* Tabs list with premium and custom-themed hover and active styles */}
      <div className="grid grid-cols-5 gap-1 md:gap-2">
        <button
          type="button"
          onClick={() => { setActiveTab('pizzaria'); resetForm(); }}
          className={`py-2.5 sm:py-3 px-1 flex flex-col items-center justify-center rounded-xl text-[9.5px] sm:text-xs font-bold transition-all duration-200 cursor-pointer truncate ${activeTab === 'pizzaria' ? 'bg-indigo-500/10 text-indigo-500 ring-1 ring-indigo-500/35 border border-indigo-500/15 shadow-xs' : 'bg-muted/30 text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground border border-transparent'}`}
        >
          <Bike className="w-4 h-4 sm:w-5 sm:h-5 mb-1 sm:mb-1.5 transition-transform duration-200 hover:scale-105 shrink-0" /> Pizzaria
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('frete'); resetForm(); }}
          className={`py-2.5 sm:py-3 px-1 flex flex-col items-center justify-center rounded-xl text-[9.5px] sm:text-xs font-bold transition-all duration-200 cursor-pointer truncate ${activeTab === 'frete' ? 'bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/35 border border-blue-500/15 shadow-xs' : 'bg-muted/30 text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground border border-transparent'}`}
        >
          <Package className="w-4 h-4 sm:w-5 sm:h-5 mb-1 sm:mb-1.5 transition-transform duration-200 hover:scale-105 shrink-0" /> Frete
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('avulso'); resetForm(); }}
          className={`py-2.5 sm:py-3 px-1 flex flex-col items-center justify-center rounded-xl text-[9.5px] sm:text-xs font-bold transition-all duration-200 cursor-pointer truncate ${activeTab === 'avulso' ? 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/35 border border-emerald-500/15 shadow-xs' : 'bg-muted/30 text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground border border-transparent'}`}
        >
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mb-1 sm:mb-1.5 transition-transform duration-200 hover:scale-105 shrink-0" /> Ganho
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('despesa'); resetForm(); }}
          className={`py-2.5 sm:py-3 px-1 flex flex-col items-center justify-center rounded-xl text-[9.5px] sm:text-xs font-bold transition-all duration-200 cursor-pointer truncate ${activeTab === 'despesa' ? 'bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/35 border border-rose-500/15 shadow-xs' : 'bg-muted/30 text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground border border-transparent'}`}
        >
          <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 mb-1 sm:mb-1.5 transition-transform duration-200 hover:scale-105 shrink-0" /> Despesa
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('reserva'); resetForm(); }}
          className={`py-2.5 sm:py-3 px-1 flex flex-col items-center justify-center rounded-xl text-[9.5px] sm:text-xs font-bold transition-all duration-200 cursor-pointer truncate ${activeTab === 'reserva' ? 'bg-pink-500/10 text-pink-500 ring-1 ring-pink-500/35 border border-pink-500/15 shadow-xs' : 'bg-muted/30 text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground border border-transparent'}`}
        >
          <PiggyBank className="w-4 h-4 sm:w-5 sm:h-5 mb-1 sm:mb-1.5 transition-transform duration-200 hover:scale-105 shrink-0" /> Reserva
        </button>
      </div>

      {/* Quick Templates / 1-click Favorites */}
      {quickTemplates.length > 0 && (
        <div className="rounded-2xl border border-border/70 bg-card/80 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Modelos Rápidos (Clique p/ preencher ou ⚡ p/ lançar hoje)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickTemplates.map(tpl => (
              <div
                key={tpl.id}
                className="inline-flex items-center rounded-xl border border-border/70 bg-muted/25 hover:bg-muted/50 transition-all overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleApplyTemplate(tpl)}
                  className="px-2.5 py-1.5 text-xs font-bold text-foreground flex items-center gap-1.5 cursor-pointer"
                  title="Preencher formulário com este modelo"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      tpl.tab === 'despesa' ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                  />
                  <span>{tpl.name}</span>
                  {Number(tpl.amount) > 0 && (
                    <span className="text-[10.5px] font-mono font-extrabold text-muted-foreground">
                      {formatCurrency(Number(tpl.amount))}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogTemplate(tpl)}
                  className="px-2 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-l border-border/50 cursor-pointer"
                  title="Lançar imediatamente na data de hoje (1 clique)"
                >
                  <Zap className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTemplate(tpl.id)}
                  className="px-1.5 py-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 border-l border-border/50 cursor-pointer"
                  title="Remover favorito"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Card className="w-full border border-border/80 shadow-md rounded-2xl">
        <CardContent className="w-full p-5 sm:p-6 md:p-8">
          <form onSubmit={handleSave} className="w-full space-y-5">
            
            {/* Common Top */}
            <div className="space-y-2 max-w-[240px]">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">
                {selectedCardObj
                  ? 'Data da Compra'
                  : (activeTab === 'despesa' || (activeTab === 'reserva' && rtType === 'utilizacao')) && !useCustomSecondaryDate
                    ? (paymentStatus === 'pending' ? 'Data / Vencimento' : 'Data / Pagamento')
                    : 'Data da Transação'}
              </label>
              <Input
                type="date"
                value={date}
                className="h-11 rounded-xl border-border font-semibold focus:ring-1 focus:ring-primary focus-visible:ring-primary"
                onChange={(e) => {
                  const newDate = e.target.value;
                  setDate(newDate);
                  if (!useCustomSecondaryDate) {
                    setPaymentDate(newDate);
                    setDueDate(newDate);
                  }
                }}
                required
              />
            </div>

            {/* ==== RESERVA TAB ==== */}
            {activeTab === 'reserva' && (
              <>
                <div className="space-y-3 p-4 bg-pink-500/[0.02] border border-pink-500/10 rounded-xl">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Tipo de Movimentação</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRtType('aporte')}
                      className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${rtType === 'aporte' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-xs' : 'bg-card border-border text-muted-foreground hover:bg-muted/20'}`}
                    >
                      Aporte (Adicionar)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRtType('utilizacao')}
                      className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${rtType === 'utilizacao' ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-xs' : 'bg-card border-border text-muted-foreground hover:bg-muted/20'}`}
                    >
                      Utilização (Resgatar)
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Reserva Alvo</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {reserves.map(r => {
                      const isSelected = reserveId === r.id;
                      const Icon = globalIconMap[r.icon] || PiggyBank;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setReserveId(r.id)}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 cursor-pointer gap-2 ${
                            isSelected 
                              ? 'bg-primary/10 border-primary text-primary shadow-sm scale-[1.02]' 
                              : 'bg-card border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                          }`}
                        >
                          <div 
                            className="p-2 rounded-lg flex items-center justify-center text-white"
                            style={{ backgroundColor: isSelected ? r.color : `${r.color}99` }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="text-center">
                            <span className="block text-[10px] font-bold line-clamp-1">{r.name}</span>
                            <span className="block text-[9px] font-semibold opacity-75 mt-0.5">{formatCurrency(r.saldo_atual || 0)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {!reserveId && <p className="text-[10px] text-rose-500 font-semibold px-1">Por favor, selecione uma reserva para continuar.</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Valor do Lançamento</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground/75 font-bold text-sm">
                      R$
                    </div>
                    <CurrencyInput
                      placeholder="0,00"
                      className="pl-9 h-11 rounded-xl font-bold border-border"
                      value={amount}
                      onChange={setAmount}
                      required
                    />
                  </div>
                </div>

                {vehicles && vehicles.length > 0 && rtType === 'utilizacao' && isCurrentCategoryVehicleRelated && (
                  <div className="space-y-1.5 pt-1 animate-fade-in">
                    <VehicleSelect
                      value={effectiveSelectedVehicleValue}
                      onChange={(val) => {
                        setSelectedVehicleId(val === '' ? '__none__' : val);
                      }}
                      label="Veículo / Moto Vinculada"
                      showAddOption={true}
                    />
                  </div>
                )}

                {rtType === 'utilizacao' && (!reserveId || reserves.find(r => r.id === reserveId)?.require_category_on_use !== false) && (
                  <div className="space-y-3 animate-fade-in">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Categoria de Saída Secundária</label>
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2">
                      {expenseCategories.map(cat => {
                        const Icon = getCategoryIcon(cat);
                        const isSelected = rtCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setRtCategory(cat)}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 cursor-pointer gap-2 ${
                              isSelected 
                                ? 'bg-primary/10 border-primary text-primary shadow-sm scale-[1.02]' 
                                : 'bg-card border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                            }`}
                          >
                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/20' : 'bg-muted/50'}`}>
                              <Icon className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <span className="text-[10px] font-bold text-center line-clamp-1">{cat}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ==== PIZZARIA TAB ==== */}
            {activeTab === 'pizzaria' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-5 bg-indigo-500/[0.02] border border-indigo-500/15 rounded-xl">
                  <div className="space-y-3">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90 flex items-end">Qtd. Entregas (Bairro)</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setDeliveries(String(Math.max(0, (Number(deliveries) || 0) - 1)))} className="h-12 w-12 shrink-0 rounded-xl bg-background text-foreground flex items-center justify-center border border-border shadow-sm hover:bg-muted transition-colors font-black text-xl cursor-pointer">
                        -
                      </button>
                      <Input
                        type="number"
                        placeholder="0"
                        className="h-12 rounded-xl font-black text-lg text-center border-border shadow-sm min-w-0 w-full"
                        value={deliveries}
                        onChange={(e) => setDeliveries(e.target.value)}
                        required
                      />
                      <button type="button" onClick={() => setDeliveries(String((Number(deliveries) || 0) + 1))} className="h-12 w-12 shrink-0 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-md hover:bg-indigo-600 transition-colors font-black text-xl cursor-pointer">
                        +
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90 flex items-end">Qtd. Fora de Área</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setOutOfNeighborhood(String(Math.max(0, (Number(outOfNeighborhood) || 0) - 1)))} className="h-12 w-12 shrink-0 rounded-xl bg-background text-foreground flex items-center justify-center border border-border shadow-sm hover:bg-muted transition-colors font-black text-xl cursor-pointer">
                        -
                      </button>
                      <Input
                        type="number"
                        placeholder="0"
                        className="h-12 rounded-xl font-black text-lg text-center border-border shadow-sm min-w-0 w-full"
                        value={outOfNeighborhood}
                        onChange={(e) => setOutOfNeighborhood(e.target.value)}
                      />
                      <button type="button" onClick={() => setOutOfNeighborhood(String((Number(outOfNeighborhood) || 0) + 1))} className="h-12 w-12 shrink-0 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-md hover:bg-indigo-600 transition-colors font-black text-xl cursor-pointer">
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-indigo-500/10 border border-indigo-500/15 rounded-xl flex justify-between items-center mt-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="p-1 px-2 bg-indigo-500/20 rounded text-[9px] uppercase font-black text-indigo-500 tracking-wider">Acordo</div>
                    <span className="text-xs sm:text-sm font-bold text-foreground leading-tight">Total Estimado de Ganho:</span>
                  </div>
                  <span className="text-xl sm:text-2xl font-black text-indigo-500 font-mono shrink-0">
                    R$ {calcPizzariaEarnings().toFixed(2)}
                  </span>
                </div>

                {vehicles && vehicles.length > 0 && (
                  <div className="space-y-1.5 mt-2 animate-fade-in">
                    <VehicleSelect
                      value={effectiveSelectedVehicleValue}
                      onChange={(val) => {
                        setSelectedVehicleId(val === '' ? '__none__' : val);
                      }}
                      label="Veículo / Moto Utilizada"
                      showAddOption={true}
                    />
                  </div>
                )}
              </>
            )}

            {/* ==== FRETE TAB ==== */}
            {activeTab === 'frete' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">
                    Valor Total do Frete (Receita)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground/75 font-bold text-sm">
                      R$
                    </div>
                    <CurrencyInput
                      placeholder="0,00"
                      className="pl-9 h-11 rounded-xl font-bold border-border"
                      value={amount}
                      onChange={setAmount}
                      required
                    />
                  </div>
                </div>

                {vehicles && vehicles.length > 0 && (
                  <div className="space-y-1.5 animate-fade-in">
                    <VehicleSelect
                      value={effectiveSelectedVehicleValue}
                      onChange={(val) => {
                        setSelectedVehicleId(val === '' ? '__none__' : val);
                      }}
                      label="Veículo / Moto Utilizada"
                      showAddOption={true}
                    />
                  </div>
                )}

                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.03] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowFreightExpenses(prev => !prev)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-amber-500/[0.05] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CreditCard className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 truncate">
                        Gastos Operacionais
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {freightExpensesTotal > 0 ? (
                        <span className="text-[10.5px] font-extrabold font-mono text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md">
                          {filledFreightExpenses.length}{' '}
                          {filledFreightExpenses.length === 1 ? 'despesa' : 'despesas'} •{' '}
                          {formatCurrency(freightExpensesTotal)}
                        </span>
                      ) : (
                        <span className="text-[9.5px] text-muted-foreground bg-muted/65 px-2 py-0.5 rounded-md font-semibold">
                          Opcional
                        </span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 text-amber-600 dark:text-amber-400 transition-transform duration-200 ${
                          showFreightExpenses ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {showFreightExpenses && (
                    <div className="px-3.5 pb-3 pt-2 border-t border-amber-500/15 space-y-2 animate-fade-in">
                      <div className="space-y-1.5">
                        {freightExpenseItems.map((item) => (
                          <div key={item.id} className="flex items-center gap-1.5">
                            <Select
                              value={item.category}
                              onValueChange={(val) => {
                                if (val) handleUpdateFreightExpenseRow(item.id, { category: String(val) });
                              }}
                            >
                              <SelectTrigger className="h-9 flex-1 min-w-0 rounded-lg px-2.5 text-xs font-bold bg-card border-border/80">
                                <SelectValue>
                                  {(val) => String(val || item.category || 'Pedágio')}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {freightExpenseCategoryOptions.map(cat => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <div className="relative w-[118px] sm:w-[136px] shrink-0">
                              <span className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-muted-foreground/75 font-bold text-xs">
                                R$
                              </span>
                              <CurrencyInput
                                placeholder="0,00"
                                className="pl-8 h-9 rounded-lg font-bold text-xs border-border bg-card"
                                value={item.amount}
                                onChange={(val) => handleUpdateFreightExpenseRow(item.id, { amount: val })}
                              />
                            </div>

                            {(freightExpenseItems.length > 1 || Boolean(item.amount)) && (
                              <button
                                type="button"
                                onClick={() => handleRemoveFreightExpenseRow(item.id)}
                                title={freightExpenseItems.length > 1 ? 'Remover despesa' : 'Limpar valor'}
                                className="h-9 w-8 shrink-0 rounded-lg border border-border/70 bg-card text-muted-foreground hover:text-rose-500 hover:border-rose-500/40 flex items-center justify-center transition-colors cursor-pointer"
                              >
                                {freightExpenseItems.length > 1 ? (
                                  <Trash2 className="w-3.5 h-3.5" />
                                ) : (
                                  <X className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={handleAddFreightExpenseRow}
                          className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Adicionar outra despesa</span>
                        </button>

                        {freightExpensesTotal > 0 && (
                          <span className="text-[10.5px] font-bold font-mono text-amber-700 dark:text-amber-300">
                            Total: {formatCurrency(freightExpensesTotal)}
                          </span>
                        )}
                      </div>

                      <FreightExpensesBudgetSummary
                        items={freightExpenseItems}
                        dateStr={date}
                        budgets={expenseBudgets}
                        transactions={transactions}
                        reserveTransactions={reserveTransactions}
                        formatCurrency={formatCurrency}
                        hideValues={hideValues}
                        onOpenConfig={(focusCat) => handleOpenBudgetModal(focusCat ?? null)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==== DESPESA / AVULSO TABS ==== */}
            {(activeTab === 'despesa' || activeTab === 'avulso') && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Valor (R$)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground/75 font-bold text-sm">
                      R$
                    </div>
                    <CurrencyInput
                      placeholder="0,00"
                      className="pl-9 h-11 rounded-xl font-bold border-border"
                      value={amount}
                      onChange={setAmount}
                      required
                    />
                  </div>
                </div>

                {/* Vehicle Selection - Positioned directly below the Valor input */}
                {vehicles && vehicles.length > 0 && isCurrentCategoryVehicleRelated && (
                  <div className="space-y-1.5 pt-1 animate-fade-in">
                    <VehicleSelect
                      value={effectiveSelectedVehicleValue}
                      onChange={(val) => {
                        setSelectedVehicleId(val === '' ? '__none__' : val);
                      }}
                      label="Veículo / Moto Vinculada"
                      showAddOption={true}
                    />
                  </div>
                )}
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-1.5 mb-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Escolha a Categoria</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {category && globalPeriod !== 'all' && (
                        <span className="text-[10px] text-muted-foreground bg-muted p-1 px-2 rounded-md font-semibold">
                          Gasto {globalPeriod === 'today' ? 'hoje' : globalPeriod === 'week' ? 'na semana' : 'no mês'}: <span className="font-extrabold text-foreground">{formatCurrency(getCategoryPeriodTotal(category) || 0)}</span>
                        </span>
                      )}
                      {activeTab === 'despesa' && (
                        <button
                          type="button"
                          onClick={() => handleOpenBudgetModal(category || null)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border/70 bg-muted/40 hover:bg-muted text-[10px] font-extrabold text-foreground transition-colors cursor-pointer"
                          title="Configurar tetos diário, semanal e mensal"
                        >
                          <SlidersHorizontal className="w-3 h-3 text-primary" />
                          <span>Tetos</span>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 gap-2">
                    {(activeTab === 'despesa' ? displayedExpenseCategories : incomeCategories).map(cat => {
                      const Icon = getCategoryIcon(cat);
                      const isSelected = category === cat;
                      const catCapCritical =
                        activeTab === 'despesa'
                          ? getMostCriticalBudgetStatus(
                              getCategoryBudgetStatuses(cat, expenseBudgets, expenseWindowTotals)
                            )
                          : null;
                      const capStyles = catCapCritical
                        ? getBudgetSeverityStyles(catCapCritical.severity)
                        : null;

                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setCategory(cat);
                            if (activeTab === 'despesa') {
                              if (isCreditCardCategoryName(cat)) {
                                setPaymentStatus('pending');
                                if ((!selectedCardId || selectedCardId === '__none__') && registeredCards.length > 0) {
                                  setSelectedCardId(registeredCards[0].id);
                                }
                              } else if (isCreditCardCategoryName(category)) {
                                setPaymentStatus('paid');
                              }
                            }
                          }}
                          className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 cursor-pointer gap-2 ${
                            isSelected 
                              ? 'bg-primary/10 border-primary text-primary shadow-sm scale-[1.02]' 
                              : 'bg-card border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                          }`}
                        >
                          {catCapCritical && capStyles && (
                            <span
                              className={`absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded-md border text-[8.5px] font-black leading-tight ${capStyles.badge}`}
                              title={`Teto ${catCapCritical.label}: ${Math.round(catCapCritical.pct)}%`}
                            >
                              {catCapCritical.shortLabel} {Math.round(catCapCritical.pct)}%
                            </span>
                          )}
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/20' : 'bg-muted/50'}`}>
                            <Icon className="w-5 h-5 md:w-6 md:h-6" />
                          </div>
                          <span className="text-[10px] font-bold text-center line-clamp-1">{cat}</span>
                        </button>
                      );
                    })}
                  </div>

                  {activeTab === 'despesa' && category && (
                    <TransactionBudgetFeedback
                      category={category}
                      amount={Number(amount) || 0}
                      dateStr={date}
                      isPending={paymentStatus === 'pending'}
                      budgets={expenseBudgets}
                      transactions={transactions}
                      reserveTransactions={reserveTransactions}
                      formatCurrency={formatCurrency}
                      hideValues={hideValues}
                      onOpenConfig={(focusCat) => handleOpenBudgetModal(focusCat ?? null)}
                    />
                  )}
                </div>

                {/* Seleção de Cartão de Crédito Cadastrado (aparece ao selecionar categoria Cartão) */}
                {isCardCategorySelected && (
                  <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/[0.06] space-y-3.5 animate-fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-500">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-foreground">
                            Selecionar Cartão Cadastrado
                          </h4>
                          <p className="text-[10px] text-muted-foreground">
                            O vencimento da fatura e as parcelas caem automaticamente no Calendário.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/planning')}
                        className="text-[11px] font-extrabold text-purple-500 hover:underline cursor-pointer"
                      >
                        Gerenciar Cartões →
                      </button>
                    </div>

                    {registeredCards.length === 0 ? (
                      <div className="p-3 rounded-xl border border-dashed border-purple-500/40 bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Nenhum cartão cadastrado ainda. Cadastre em Calendário &amp; Cartões para vincular automaticamente.
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('/planning')}
                          className="h-8 rounded-lg text-xs font-extrabold border-purple-500/30 text-purple-600 dark:text-purple-400 shrink-0 cursor-pointer"
                        >
                          Cadastrar Cartão
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2">
                          {registeredCards.map(card => {
                            const active = selectedCardId === card.id;
                            return (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => setSelectedCardId(card.id)}
                                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                  active
                                    ? 'border-purple-500 bg-purple-500/15 ring-1 ring-purple-500/30 shadow-xs'
                                    : 'border-border/70 bg-card hover:bg-muted/40'
                                }`}
                              >
                                <span
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                                  style={{ backgroundColor: card.color }}
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-foreground truncate">{card.name}</p>
                                  <p className="text-[9.5px] font-semibold text-muted-foreground">
                                    Fecha {card.closingDay} • Vence {card.dueDay}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setSelectedCardId('__none__')}
                            className={`flex items-center justify-center p-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                              selectedCardId === '__none__'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border/60 bg-card/50 text-muted-foreground hover:bg-muted/40'
                            }`}
                          >
                            Sem vínculo de cartão
                          </button>
                        </div>

                        {selectedCardObj && (
                          <div className="space-y-3 pt-2 border-t border-purple-500/20">
                            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted/50 border border-border/50">
                              <button
                                type="button"
                                onClick={() => setCardIsRecurring(false)}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                                  !cardIsRecurring
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                💳 À vista / Parcelado
                              </button>
                              <button
                                type="button"
                                onClick={() => setCardIsRecurring(true)}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                                  cardIsRecurring
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                🔄 Recorrente (Auto)
                              </button>
                            </div>

                            {cardIsRecurring ? (
                              <div className="space-y-2">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                    Frequência da Assinatura / Recorrência
                                  </label>
                                  <Select
                                    value={cardRecurrenceFrequency}
                                    onValueChange={(val: RecurrenceFrequency) => setCardRecurrenceFrequency(val)}
                                  >
                                    <SelectTrigger className="h-9 rounded-xl bg-card text-xs font-bold">
                                      <SelectValue>
                                        {val => getFrequencyLabel(val as RecurrenceFrequency)}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="weekly">Semanal</SelectItem>
                                      <SelectItem value="biweekly">Quinzenal (14 dias)</SelectItem>
                                      <SelectItem value="monthly">Mensal</SelectItem>
                                      <SelectItem value="bimonthly">Bimestral (2 meses)</SelectItem>
                                      <SelectItem value="quarterly">Trimestral (3 meses)</SelectItem>
                                      <SelectItem value="semiannual">Semestral (6 meses)</SelectItem>
                                      <SelectItem value="yearly">Anual</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                    Parcelas no Cartão
                                  </label>
                                  <Select value={cardInstallments} onValueChange={setCardInstallments}>
                                    <SelectTrigger className="h-9 rounded-xl bg-card text-xs font-bold">
                                      <SelectValue>
                                        {(val) => (val === '1' ? '1x (À vista na fatura)' : `${val || 1}x mensais`)}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Array.from({ length: 24 }, (_, idx) => String(idx + 1)).map(n => (
                                        <SelectItem key={n} value={n}>
                                          {n === '1' ? '1x (À vista na fatura)' : `${n}x mensais`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {Number(cardInstallments) > 1 && (
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                      Valor Informado Acima é:
                                    </label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setCardAmountMode('total')}
                                        className={`h-9 rounded-xl border text-[11px] font-bold cursor-pointer transition-all ${
                                          cardAmountMode === 'total'
                                            ? 'bg-purple-600 text-white border-purple-600'
                                            : 'bg-card border-border text-muted-foreground'
                                        }`}
                                      >
                                        Total ({cardInstallments}x)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setCardAmountMode('installment')}
                                        className={`h-9 rounded-xl border text-[11px] font-bold cursor-pointer transition-all ${
                                          cardAmountMode === 'installment'
                                            ? 'bg-purple-600 text-white border-purple-600'
                                            : 'bg-card border-border text-muted-foreground'
                                        }`}
                                      >
                                        Por Parcela
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {cardPurchasePreview && (
                              <div className="p-2.5 rounded-xl bg-card/80 border border-purple-500/20 text-[11px] space-y-0.5">
                                <div className="flex flex-wrap items-center justify-between gap-1 font-bold text-foreground">
                                  <span className="text-purple-500 font-black">
                                    Fatura {selectedCardObj.name} {cardIsRecurring ? `• Recorrente (${getFrequencyLabel(cardRecurrenceFrequency)})` : ''}
                                  </span>
                                  {Number(amount) > 0 && (
                                    <span className="font-mono">
                                      {cardIsRecurring
                                        ? `${formatCurrency(cardPurchasePreview.perInstallment)} / ciclo`
                                        : (
                                          <>
                                            {cardPurchasePreview.nInst}x de{' '}
                                            {formatCurrency(cardPurchasePreview.perInstallment)}
                                            {cardPurchasePreview.nInst > 1
                                              ? ` (Total ${formatCurrency(cardPurchasePreview.totalPurchase)})`
                                              : ''}
                                          </>
                                        )}
                                    </span>
                                  )}
                                </div>
                                {cardIsRecurring ? (
                                  <p className="text-muted-foreground text-[10.5px]">
                                    1ª cobrança cai em{' '}
                                    <strong className="text-foreground">
                                      {format(parseLocalDate(cardPurchasePreview.first.statementDueDate), 'dd/MM/yyyy')}
                                    </strong>
                                    {cardPurchasePreview.nextRecurringDate && (
                                      <>
                                        {' '}
                                        • Ao quitar, renova automaticamente para{' '}
                                        <strong className="text-foreground">
                                          {format(parseLocalDate(cardPurchasePreview.nextRecurringDate), 'dd/MM/yyyy')}
                                        </strong>
                                      </>
                                    )}
                                  </p>
                                ) : (
                                  <p className="text-muted-foreground text-[10.5px]">
                                    {cardPurchasePreview.nInst > 1 ? '1ª parcela' : 'Vencimento'} cai em{' '}
                                    <strong className="text-foreground">
                                      {format(parseLocalDate(cardPurchasePreview.first.statementDueDate), 'dd/MM/yyyy')}
                                    </strong>
                                    {cardPurchasePreview.nInst > 1 && (
                                      <>
                                        {' '}
                                        • Última em{' '}
                                        <strong className="text-foreground">
                                          {format(parseLocalDate(cardPurchasePreview.last.statementDueDate), 'dd/MM/yyyy')}
                                        </strong>
                                      </>
                                    )}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Alocação por Reserva (Sugestão automática ou escolha manual, inclusive para cartão) */}
                {activeTab === 'despesa' && activeReservesList.length > 0 && selectedDeductReserve && (
                  <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/[0.06] space-y-2.5 animate-fade-in">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={deductFromReserve}
                        onChange={(e) => setDeductFromReserve(e.target.checked)}
                        className="h-4 w-4 mt-0.5 rounded border-border text-indigo-600 accent-indigo-600 cursor-pointer"
                      />
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                            <PiggyBank className="w-3.5 h-3.5 text-indigo-500" />
                            Pagar usando a reserva <strong className="text-indigo-600 dark:text-indigo-400">{selectedDeductReserve.name}</strong>?
                          </span>
                          <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-card border border-border/70 text-foreground">
                            Saldo: {formatCurrency(selectedDeductReserve.saldo_atual || 0)}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-muted-foreground leading-snug">
                          {selectedCardObj
                            ? <>Ao marcar, as parcelas entram na fatura do <strong>{selectedCardObj.name}</strong> sendo pagas com o saldo da reserva (sem descontar do caixa livre).</>
                            : suggestedExpenseReserve
                              ? <>Detectamos uma reserva compatível com <strong>{category}</strong>. Ao marcar, o gasto usa o saldo da reserva sem descontar do caixa livre.</>
                              : <>Ao marcar, esta conta será abatida da reserva selecionada (sem descontar do seu caixa livre).</>}
                        </p>
                      </div>
                    </label>

                    {deductFromReserve && activeReservesList.length >= 1 && (
                      <div className="pt-2 border-t border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Reserva selecionada:
                        </span>
                        <Select value={selectedDeductReserve.id} onValueChange={setDeductReserveId}>
                          <SelectTrigger className="h-8 text-xs font-bold rounded-lg bg-card sm:w-[240px]">
                            <SelectValue>
                              {(val) => {
                                const found = activeReservesList.find(r => r.id === val);
                                return found ? `${found.name} (${formatCurrency(found.saldo_atual || 0)})` : 'Selecione a reserva...';
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="text-xs">
                            {activeReservesList.map(r => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name} ({formatCurrency(r.saldo_atual || 0)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {deductFromReserve && Number(amount) > Number(selectedDeductReserve.saldo_atual || 0) && (
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>Atenção: o valor informado excede o saldo disponível da reserva (o saldo ficará zerado).</span>
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ==== PAYMENT STATUS & DUE DATE SECTION (FOR EXPENSES & RESERVES UTILIZACAO) ==== */}
            {(activeTab === 'despesa' || (activeTab === 'reserva' && rtType === 'utilizacao')) && (
              <div className="space-y-3 pt-2">
                <hr className="border-border/60" />
                <div className="p-4 bg-muted/20 border border-border/80 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90 flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5 text-primary" /> Status do Pagamento
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      {activeTab === 'reserva' || (activeTab === 'despesa' && deductFromReserve && selectedDeductReserve)
                        ? (paymentStatus === 'paid' ? 'Abatido da reserva' : 'Pendente na reserva')
                        : (paymentStatus === 'paid' ? 'Liquidado no caixa' : 'Pendente de quitação')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentStatus('paid')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        paymentStatus === 'paid'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-xs'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {activeTab === 'reserva' ? 'Já Efetuado' : 'Já Pago'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentStatus('pending')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        paymentStatus === 'pending'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-xs'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      {activeTab === 'reserva' ? 'Agendado (Pendente)' : 'Pendente (A Pagar)'}
                    </button>
                  </div>

                  {selectedCardObj && paymentStatus === 'pending' ? (
                    <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-[10.5px] text-purple-600 dark:text-purple-300 font-semibold leading-relaxed">
                      Vencimento calculado automaticamente pela fatura do cartão <strong>{selectedCardObj.name}</strong> (fecha dia {selectedCardObj.closingDay}, vence dia {selectedCardObj.dueDay}).
                    </div>
                  ) : !useCustomSecondaryDate ? (
                    <div className="space-y-1.5 animate-fade-in">
                      <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs ${
                        paymentStatus === 'pending'
                          ? 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-semibold">
                            {paymentStatus === 'paid' ? 'Pago na data:' : 'Vencimento em:'}{' '}
                            <strong className="font-black">
                              {date ? format(parseLocalDate(date), 'dd/MM/yyyy') : 'Hoje'}
                            </strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const fallback = date || getTodayLocalDateStr();
                            if (paymentStatus === 'paid') setPaymentDate(fallback);
                            else setDueDate(fallback);
                            setUseCustomSecondaryDate(true);
                          }}
                          className="text-[11px] font-extrabold underline underline-offset-2 hover:opacity-80 cursor-pointer shrink-0"
                        >
                          {paymentStatus === 'paid' ? 'Outra data?' : 'Vencimento diferente?'}
                        </button>
                      </div>
                      {paymentStatus === 'pending' && (
                        <p className="text-[10px] text-amber-600/90 dark:text-amber-400/90 leading-relaxed px-0.5">
                          Esta despesa ficará visível na seção <strong>"A Pagar / Pendentes"</strong> do Extrato até você liquidá-la.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5 animate-fade-in">
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <label className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                          paymentStatus === 'pending' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/90'
                        }`}>
                          {paymentStatus === 'pending' ? (
                            <><AlertCircle className="w-3 h-3" /> Data de Vencimento</>
                          ) : (
                            'Data do Pagamento'
                          )}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setUseCustomSecondaryDate(false);
                            setPaymentDate(date);
                            setDueDate(date);
                          }}
                          className="text-[10.5px] font-extrabold text-primary hover:underline cursor-pointer"
                        >
                          Unificar com data principal ({date ? format(parseLocalDate(date), 'dd/MM/yyyy') : 'hoje'})
                        </button>
                      </div>
                      <Input
                        type="date"
                        value={paymentStatus === 'paid' ? (paymentDate || date) : (dueDate || date)}
                        onChange={(e) => {
                          if (paymentStatus === 'paid') setPaymentDate(e.target.value);
                          else setDueDate(e.target.value);
                        }}
                        className={`h-10 rounded-xl bg-card text-xs font-semibold ${
                          paymentStatus === 'pending' ? 'border-amber-500/30 focus:ring-amber-500' : 'border-border'
                        }`}
                        required={paymentStatus === 'pending'}
                      />
                      {paymentStatus === 'pending' && (
                        <p className="text-[10px] text-amber-600/90 dark:text-amber-400/90 leading-relaxed">
                          Esta despesa ficará visível na seção <strong>"A Pagar / Pendentes"</strong> do Extrato até você liquidá-la.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==== RECURRENCE & INSTALLMENTS SECTION ==== */}
            {((activeTab === 'despesa' && !selectedCardObj) || (activeTab === 'reserva' && rtType === 'utilizacao')) && (
              <div className="space-y-3 pt-1">
                <div className="p-4 bg-primary/[0.03] border border-primary/20 rounded-xl space-y-4">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsRecurring(!isRecurring)}>
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${isRecurring ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        <RefreshCw className={`w-4 h-4 ${isRecurring ? 'animate-spin-slow' : ''}`} />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-foreground">
                          {activeTab === 'reserva' ? 'Agendar Recorrência de Reserva' : 'Repetir Lançamento / Recorrência'}
                        </h4>
                        <p className="text-[10px] text-muted-foreground">
                          {activeTab === 'reserva'
                            ? 'Programe aportes ou utilizações periódicas automáticas'
                            : 'Gera parcelas mensais, semanais ou anuais com vencimentos automáticos'}
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>

                  {isRecurring && (
                    <div className="space-y-4 pt-2 border-t border-primary/10 animate-fade-in">
                      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted/50 border border-border/50">
                        <button
                          type="button"
                          onClick={() => setRecurrenceMode('auto')}
                          className={`py-2 px-2 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                            recurrenceMode === 'auto'
                              ? 'bg-primary text-primary-foreground shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          🔄 Conta Recorrente (Auto)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecurrenceMode('fixed')}
                          className={`py-2 px-2 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                            recurrenceMode === 'fixed'
                              ? 'bg-primary text-primary-foreground shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          📑 Parcelado Fixo (Nx)
                        </button>
                      </div>

                      <div className={`grid grid-cols-1 ${recurrenceMode === 'fixed' ? 'sm:grid-cols-2' : ''} gap-3`}>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">
                            Frequência
                          </label>
                          <Select
                            value={recurrenceFrequency}
                            onValueChange={(val: RecurrenceFrequency) => setRecurrenceFrequency(val)}
                          >
                            <SelectTrigger className="h-10 rounded-xl border-border bg-card text-xs font-semibold">
                              <SelectValue placeholder="Selecione a frequência">
                                {(val) => {
                                  switch (val) {
                                    case 'daily': return 'Diário';
                                    case 'weekly': return 'Semanal';
                                    case 'biweekly': return 'Quinzenal (14 dias)';
                                    case 'monthly': return 'Mensal';
                                    case 'bimonthly': return 'Bimestral (2 meses)';
                                    case 'quarterly': return 'Trimestral (3 meses)';
                                    case 'semiannual': return 'Semestral (6 meses)';
                                    case 'yearly': return 'Anual';
                                    default: return val || 'Selecione a frequência';
                                  }
                                }}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Diário</SelectItem>
                              <SelectItem value="weekly">Semanal</SelectItem>
                              <SelectItem value="biweekly">Quinzenal (14 dias)</SelectItem>
                              <SelectItem value="monthly">Mensal</SelectItem>
                              <SelectItem value="bimonthly">Bimestral (2 meses)</SelectItem>
                              <SelectItem value="quarterly">Trimestral (3 meses)</SelectItem>
                              <SelectItem value="semiannual">Semestral (6 meses)</SelectItem>
                              <SelectItem value="yearly">Anual</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {recurrenceMode === 'fixed' && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">
                              Qtd. Parcelas / Repetições
                            </label>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setRecurrenceInstallments(String(Math.max(2, (Number(recurrenceInstallments) || 12) - 1)))}
                                className="h-10 w-10 shrink-0 rounded-xl bg-card border border-border flex items-center justify-center font-black text-sm hover:bg-muted cursor-pointer"
                              >
                                -
                              </button>
                              <Input
                                type="number"
                                min="2"
                                max="60"
                                value={recurrenceInstallments}
                                onChange={(e) => setRecurrenceInstallments(e.target.value)}
                                className="h-10 rounded-xl font-black text-center border-border bg-card text-xs"
                                placeholder="12"
                              />
                              <button
                                type="button"
                                onClick={() => setRecurrenceInstallments(String(Math.min(60, (Number(recurrenceInstallments) || 12) + 1)))}
                                className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-sm hover:bg-primary/90 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {recurrenceMode === 'auto' ? (
                        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-1 text-xs">
                          <p className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 text-[11px]">
                            <CalendarRange className="w-3.5 h-3.5" />
                            Renovação automática sob pagamento
                          </p>
                          <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                            Gera a conta para{' '}
                            <strong className="text-foreground">
                              {date ? format(parseLocalDate((useCustomSecondaryDate && dueDate ? dueDate : date)), 'dd/MM/yyyy') : 'hoje'}
                            </strong>{' '}
                            ({paymentStatus === 'paid' ? 'já quitada' : 'pendente'}).{' '}
                            {paymentStatus === 'paid'
                              ? 'Como já está paga, o sistema já deixará a próxima pendente agendada para '
                              : 'Assim que ela for paga, o sistema gerará automaticamente a próxima para '}
                            <strong className="text-foreground">
                              {format(
                                parseLocalDate(
                                  calculateNextOccurrence(((useCustomSecondaryDate && dueDate ? dueDate : date) || getTodayLocalDateStr()), recurrenceFrequency, 1)
                                ),
                                'dd/MM/yyyy'
                              )}
                            </strong>
                            .
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Quick Presets for Installments */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-bold text-muted-foreground mr-1">Atalhos:</span>
                            {['2', '3', '6', '12', '24', '36'].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setRecurrenceInstallments(preset)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer border ${
                                  recurrenceInstallments === preset
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-card border-border text-muted-foreground hover:bg-muted'
                                }`}
                              >
                                {preset}x
                              </button>
                            ))}
                          </div>

                          {/* Recurrence Summary & Preview */}
                          {Number(recurrenceInstallments) >= 2 && (
                            <div className="p-3 bg-card border border-border/80 rounded-xl space-y-2 text-xs">
                              <div className="flex justify-between items-center font-bold text-foreground">
                                <span className="flex items-center gap-1 text-[11px]">
                                  <CalendarRange className="w-3.5 h-3.5 text-primary" />
                                  Plano Gerado: {recurrenceInstallments}x de R$ {Number(amount) ? Number(amount).toFixed(2) : '0,00'}
                                </span>
                                <span className="text-primary font-mono text-[11px]">
                                  Total: R$ {((Number(amount) || 0) * (Number(recurrenceInstallments) || 0)).toFixed(2)}
                                </span>
                              </div>

                              <div className="text-[10px] text-muted-foreground space-y-1 pt-1 border-t border-border/60">
                                <p className="font-semibold text-foreground/80">Primeiras datas geradas:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                                  <span className="bg-muted/40 p-1.5 rounded text-[10px]">
                                    1ª: <strong>{date ? format(parseLocalDate(date), 'dd/MM/yyyy') : 'Hoje'}</strong> ({paymentStatus === 'paid' ? 'Pago' : 'Pendente'})
                                  </span>
                                  <span className="bg-muted/40 p-1.5 rounded text-[10px]">
                                    2ª: <strong>{format(parseLocalDate(calculateNextOccurrence(date || getTodayLocalDateStr(), recurrenceFrequency, 1)), 'dd/MM/yyyy')}</strong> (Pendente)
                                  </span>
                                  <span className="bg-muted/40 p-1.5 rounded text-[10px]">
                                    3ª: <strong>{format(parseLocalDate(calculateNextOccurrence(date || getTodayLocalDateStr(), recurrenceFrequency, 2)), 'dd/MM/yyyy')}</strong> (Pendente)
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Odometer & Desc (Common Bottom) */}
            {(() => {
              const currentCategoryName =
                activeTab === 'pizzaria' ? 'Pizzaria' :
                activeTab === 'frete' ? 'Frete do Dia' :
                category;
              
              const requiresKm = settings?.categories_with_km?.includes(currentCategoryName);

              if (!requiresKm) return null;

              return (
                <div className="space-y-4 pt-2">
                  <hr className="border-border/60" />
                  <div className="grid grid-cols-2 gap-4 bg-muted/10 p-4 border border-border/80 rounded-xl relative overflow-hidden">
                    <div className="space-y-2">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90 h-8 flex items-end">KM Registrado Inicial</label>
                      <Input
                        type="number"
                        placeholder="Ex: 15300"
                        className="h-11 rounded-xl font-semibold border-border bg-card"
                        value={startKm}
                        onChange={(e) => setStartKm(e.target.value)}
                        required={requiresKm}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90 h-8 flex items-end">KM Registrado Final</label>
                      <Input
                        type="number"
                        placeholder="Ex: 15450"
                        className="h-11 rounded-xl font-semibold border-border bg-card"
                        value={endKm}
                        onChange={(e) => setEndKm(e.target.value)}
                        required={requiresKm}
                      />
                    </div>

                    {Number(startKm) >= 0 && Number(endKm) > Number(startKm) && (
                      <div className="col-span-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/15 p-3 rounded-lg font-semibold mt-2 shadow-xs">
                        <Fuel className="w-4 h-4 shrink-0 text-amber-500 animate-pulse" />
                        <span className="leading-tight">
                          Gasto Estimado: <strong className="font-extrabold text-amber-700">R$ {calculateFuel().toFixed(2)}</strong> ({Number(endKm) - Number(startKm)} km percorridos)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Descrição / Observações</label>
              <Input
                type="text"
                placeholder="Ex: Frete pra região X, pneu furou..."
                className="h-11 rounded-xl border-border"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {(activeTab !== 'reserva' || rtType === 'utilizacao') && (
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/35 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={ignoreInCharts}
                  onChange={(e) => setIgnoreInCharts(e.target.checked)}
                  className="h-4 w-4 mt-0.5 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-extrabold text-foreground">
                      Ignorar nos gráficos e médias
                    </span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground leading-snug">
                    Útil para venda/compra de veículo ou ganhos e despesas atípicas: o valor entra normalmente no seu balanço e caixa, mas é desconsiderado dos gráficos e indicadores.
                  </p>
                </div>
              </label>
            )}

            <div className="space-y-3 pt-2">
              {activeTab !== 'reserva' && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {!showSaveTemplateInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNewTemplateName(description.trim() || (activeTab === 'pizzaria' ? 'Diária Pizzaria' : category) || '');
                        setShowSaveTemplateInput(true);
                      }}
                      className="text-xs font-extrabold text-amber-500 hover:text-amber-400 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Salvar como Modelo Rápido (Favorito)</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        type="text"
                        placeholder="Nome do atalho (ex: Gasolina Cheia, Almoço...)"
                        value={newTemplateName}
                        onChange={e => setNewTemplateName(e.target.value)}
                        className="h-9 rounded-xl text-xs flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveCurrentAsTemplate}
                        className="h-9 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-zinc-950 cursor-pointer"
                      >
                        Salvar Favorito
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowSaveTemplateInput(false)}
                        className="h-9 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full h-12 text-sm sm:text-base font-black uppercase tracking-wider bg-primary hover:bg-primary/95 text-primary-foreground focus:ring-1 focus:ring-offset-1 focus:ring-primary shadow-xs hover:shadow-md transition-all duration-200 rounded-xl cursor-pointer" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {loading ? 'Sincronizando...' : 'Salvar no Faturamento'}
              </Button>
            </div>
            
          </form>
        </CardContent>
      </Card>

      <FreightCalculatorModal
        isOpen={showFreightCalc}
        onClose={() => setShowFreightCalc(false)}
        onApplyFreight={handleApplyFreight}
        defaultKm={startKm && endKm ? Math.max(0, Number(endKm) - Number(startKm)) : 0}
        vehicleKmPerLiter={settings?.vehicle_km_per_liter ?? 10}
        fuelPrice={settings?.fuel_price ?? 6.00}
        maintenanceRatePerKm={maintenanceRatePerKm}
        defaultDriverLabor={settings?.default_driver_labor ?? 100}
      />

      <BudgetLimitsModal
        open={showBudgetModal}
        onOpenChange={setShowBudgetModal}
        userId={templateUserId || 'default'}
        categories={allBudgetCategories}
        operationalCategories={settings?.operational_expense_categories || []}
        budgets={expenseBudgets}
        totals={expenseWindowTotals}
        formatCurrency={formatCurrency}
        hideValues={hideValues}
        focusCategory={budgetFocusCategory}
        onSaved={(next) => setExpenseBudgets(next)}
      />
    </div>
  );
}
