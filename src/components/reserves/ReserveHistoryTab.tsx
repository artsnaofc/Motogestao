import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  TrendingUp, 
  Search, 
  Filter, 
  Calendar, 
  Trash2, 
  Edit3, 
  Zap, 
  Layers, 
  PiggyBank, 
  AlertCircle,
  Tag, 
  DollarSign, 
  ChevronDown, 
  X, 
  Download, 
  SlidersHorizontal, 
  Info, 
  Clock, 
  ArrowUpDown, 
  RotateCcw, 
  Sparkles, 
  ShieldCheck, 
  Calculator, 
  CheckCircle2, 
  HelpCircle,
  History,
  Check,
  Sliders,
  RefreshCw,
  Landmark,
  BarChart3,
  ChevronUp,
  EyeOff,
  Rocket,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  subDays,
  addDays,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  startOfYear,
  endOfYear,
  subYears,
  addYears,
  startOfWeek,
  endOfWeek,
  differenceInCalendarDays,
  format
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Reserve, ReserveTransaction, Transaction, UserSettings } from '../../types';
import { 
  formatCurrency, 
  formatDateDisplay, 
  iconOptions, 
  isTxInPeriod,
  getPeriodDisplayLabel,
  getBoostExtraFromRt,
  parseLocalDate,
  getTodayLocalDateStr,
  toDateInputString,
  getEffectiveTxDateStr,
  buildLinkedReserveTxIdSet,
  isReserveOrNonOperatingTx,
  doesExpenseCountForLiquido,
  getLiquidoProfitMode
} from './reserveUtils';
import {
  getEffectiveItemTime,
  getCurrentLocalTimeStr,
  normalizeTimeStr,
  compareByDateTimeAsc,
  compareByDateTimeDesc,
  DateTimeSortableItem
} from '../../lib/timeUtils';
import { toast } from '@/lib/toast';

export interface RuleHistoryItem {
  id: string;
  reserve_id: string;
  historyIndex?: number;
  date: string; // YYYY-MM-DD
  time?: string | null; // HH:mm
  updated_at?: string;
  regra_tipo?: string;
  regra_base?: 'bruto' | 'liquido' | 'lucro';
  regra_valor: number;
  regra_categorias?: string[];
  regra_ativa?: boolean;
  start_date?: string;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  description?: string;
  isCurrentActive: boolean;
}

export type UnifiedHistoryItem = 
  | {
      kind: 'transaction';
      id: string;
      date: string;
      time?: string | null;
      reserve_id: string;
      amount: number;
      tx: ReserveTransaction;
    }
  | {
      kind: 'rule_update';
      id: string;
      date: string;
      time?: string | null;
      reserve_id: string;
      amount: number;
      rule: RuleHistoryItem;
    };

interface ReserveHistoryTabProps {
  reserves: Reserve[];
  transactions?: Transaction[];
  reserveTransactions: ReserveTransaction[];
  settings?: UserSettings | null;
  onDeleteTransaction: (id: string) => Promise<void>;
  onEditTransaction?: (id: string, updatedFields: Partial<ReserveTransaction>) => Promise<void>;
  onUpdateReserve?: (id: string, updatedFields: Partial<Reserve>) => Promise<void>;
  hideValues?: boolean;
}

export function ReserveHistoryTab({
  reserves,
  transactions = [],
  reserveTransactions,
  settings,
  onDeleteTransaction,
  onEditTransaction,
  onUpdateReserve,
  hideValues
}: ReserveHistoryTabProps) {
  // Primary Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReserveId, setSelectedReserveId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('aporte'); // Padrão: Aportes
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all'); // all, manual, mass, rendimento, rule
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<'all' | 'paid' | 'pending'>('all');
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'reserve_asc'>('date_desc');
  const [groupByDate, setGroupByDate] = useState<boolean>(true);
  
  // Advanced Filter Drawer & Visual Analytics Toggle
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showMonthlyYieldChart, setShowMonthlyYieldChart] = useState(true);
  const [chartTab, setChartTab] = useState<'flow' | 'yield' | 'reserves'>('flow');

  // Modal States
  const [txToDelete, setTxToDelete] = useState<ReserveTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [txToViewDetails, setTxToViewDetails] = useState<ReserveTransaction | null>(null);
  const [txToEdit, setTxToEdit] = useState<ReserveTransaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [ruleToViewDetails, setRuleToViewDetails] = useState<RuleHistoryItem | null>(null);

  // Rule Edit & Delete Modal States
  const [ruleToEdit, setRuleToEdit] = useState<RuleHistoryItem | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<RuleHistoryItem | null>(null);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [isDeletingRule, setIsDeletingRule] = useState(false);

  // Edit Rule Form Fields
  const [editRuleType, setEditRuleType] = useState<string>('km');
  const [editRuleBase, setEditRuleBase] = useState<'lucro' | 'liquido'>('lucro');
  const [editRuleValue, setEditRuleValue] = useState<string>('');
  const [editRuleStartDate, setEditRuleStartDate] = useState<string>('');
  const [editRuleStartTime, setEditRuleStartTime] = useState<string>('');
  const [editRuleEndDate, setEditRuleEndDate] = useState<string>('');
  const [editRuleEndTime, setEditRuleEndTime] = useState<string>('');
  const [editRuleCategories, setEditRuleCategories] = useState<string>('');
  const [editRuleCategoryList, setEditRuleCategoryList] = useState<string[]>([]);
  const [editRuleActive, setEditRuleActive] = useState<boolean>(true);
  const [editRuleAutoArchive, setEditRuleAutoArchive] = useState<boolean>(true);
  const [editRuleChangeReason, setEditRuleChangeReason] = useState<string>('');
  const [editRuleDescription, setEditRuleDescription] = useState<string>('');

  // Edit Transaction Form Fields
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editReserveId, setEditReserveId] = useState<string>('');
  const [editIgnoreInCharts, setEditIgnoreInCharts] = useState<boolean>(false);
  const [editPaymentStatus, setEditPaymentStatus] = useState<'paid' | 'pending'>('paid');

  // Period filter states - Defaults to 'month' (igual ao Dashboard)
  const [historyPeriod, setHistoryPeriod] = useState<string>('month');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(null);

  // Pagination / Chunked loading state (15 items per page/chunk)
  const [visibleCount, setVisibleCount] = useState<number>(15);

  const now = useMemo(() => new Date(), []);

  // Dashboard-aligned period bounds and step controls
  const { periodStart, periodEnd } = useMemo(() => {
    const nowDate = new Date();
    if (historyPeriod === 'all') {
      return { periodStart: null as Date | null, periodEnd: null as Date | null };
    }
    if (historyPeriod === 'today') {
      return { periodStart: startOfDay(nowDate), periodEnd: endOfDay(nowDate) };
    }
    if (historyPeriod === 'last7Days') {
      return { periodStart: startOfDay(subDays(nowDate, 6)), periodEnd: endOfDay(nowDate) };
    }
    if (historyPeriod === 'last30Days') {
      return { periodStart: startOfDay(subDays(nowDate, 29)), periodEnd: endOfDay(nowDate) };
    }
    if (historyPeriod === 'last90Days') {
      return { periodStart: startOfDay(subDays(nowDate, 89)), periodEnd: endOfDay(nowDate) };
    }
    if (historyPeriod === 'week') {
      return { periodStart: startOfWeek(nowDate, { weekStartsOn: 1 }), periodEnd: endOfWeek(nowDate, { weekStartsOn: 1 }) };
    }
    if (historyPeriod === 'lastMonth') {
      const lastM = subMonths(nowDate, 1);
      return { periodStart: startOfMonth(lastM), periodEnd: endOfMonth(lastM) };
    }
    if (historyPeriod === 'nextMonth') {
      const nextM = addMonths(nowDate, 1);
      return { periodStart: startOfMonth(nextM), periodEnd: endOfMonth(nextM) };
    }
    if (historyPeriod === 'thisYear') {
      return { periodStart: startOfYear(nowDate), periodEnd: endOfDay(nowDate) };
    }
    if (historyPeriod === 'lastYear') {
      const lastY = subYears(nowDate, 1);
      return { periodStart: startOfYear(lastY), periodEnd: endOfYear(lastY) };
    }
    if (historyPeriod === 'custom' && customDateRange?.start && customDateRange?.end) {
      try {
        const s = parseLocalDate(customDateRange.start);
        const e = parseLocalDate(customDateRange.end);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
          return { periodStart: startOfDay(s), periodEnd: endOfDay(e) };
        }
      } catch {
        // fallback below
      }
    }
    return { periodStart: startOfMonth(nowDate), periodEnd: endOfMonth(nowDate) };
  }, [historyPeriod, customDateRange]);

  const getHistoryPeriodLabel = () => {
    switch (historyPeriod) {
      case 'all': return 'Todo o Histórico';
      case 'today': return 'Hoje';
      case 'last7Days': return 'Últimos 7 dias';
      case 'last30Days': return '30 dias';
      case 'last90Days': return '90 dias';
      case 'week': return 'Esta Semana';
      case 'month': return 'Mês Atual';
      case 'lastMonth': return 'Mês Passado';
      case 'nextMonth': return 'Próximo Mês';
      case 'thisYear': return 'Este Ano';
      case 'lastYear': return 'Ano Passado';
      case 'custom':
        if (customDateRange?.start && customDateRange?.end) {
          try {
            const sDate = parseLocalDate(customDateRange.start);
            const eDate = parseLocalDate(customDateRange.end);
            const isFullMonth =
              sDate.getDate() === 1 &&
              sDate.getMonth() === eDate.getMonth() &&
              sDate.getFullYear() === eDate.getFullYear() &&
              eDate.getDate() === endOfMonth(sDate).getDate();
            if (isFullMonth) {
              const mName = format(sDate, "MMMM 'de' yyyy", { locale: ptBR });
              return mName.charAt(0).toUpperCase() + mName.slice(1);
            }
            return `${format(sDate, 'dd/MM/yyyy')} até ${format(eDate, 'dd/MM/yyyy')}`;
          } catch {
            return 'Personalizado';
          }
        }
        return 'Personalizado';
      default: return 'Mês Atual';
    }
  };

  const handleStepHistoryPeriod = (direction: -1 | 1) => {
    const nowDate = new Date();
    if (historyPeriod === 'all') {
      setHistoryPeriod(direction === -1 ? 'lastMonth' : 'nextMonth');
      setVisibleCount(15);
      return;
    }

    const isSingleMonthCustom =
      historyPeriod === 'custom' &&
      customDateRange?.start &&
      customDateRange?.end &&
      (() => {
        const s = parseLocalDate(customDateRange.start);
        const e = parseLocalDate(customDateRange.end);
        return (
          s.getDate() === 1 &&
          s.getMonth() === e.getMonth() &&
          s.getFullYear() === e.getFullYear() &&
          e.getDate() === endOfMonth(s).getDate()
        );
      })();

    if (historyPeriod === 'month' || historyPeriod === 'lastMonth' || historyPeriod === 'nextMonth' || isSingleMonthCustom) {
      const baseStart = periodStart || startOfMonth(nowDate);
      const targetMonth = addMonths(baseStart, direction);
      const isCurrM = targetMonth.getMonth() === nowDate.getMonth() && targetMonth.getFullYear() === nowDate.getFullYear();
      const prevM = subMonths(nowDate, 1);
      const isLastM = targetMonth.getMonth() === prevM.getMonth() && targetMonth.getFullYear() === prevM.getFullYear();
      const nextM = addMonths(nowDate, 1);
      const isNextM = targetMonth.getMonth() === nextM.getMonth() && targetMonth.getFullYear() === nextM.getFullYear();

      if (isCurrM) setHistoryPeriod('month');
      else if (isLastM) setHistoryPeriod('lastMonth');
      else if (isNextM) setHistoryPeriod('nextMonth');
      else {
        setCustomDateRange({
          start: format(startOfMonth(targetMonth), 'yyyy-MM-dd'),
          end: format(endOfMonth(targetMonth), 'yyyy-MM-dd'),
        });
        setHistoryPeriod('custom');
      }
      setVisibleCount(15);
      return;
    }

    if (historyPeriod === 'thisYear' || historyPeriod === 'lastYear') {
      const baseStart = periodStart || startOfYear(nowDate);
      const targetYear = addYears(baseStart, direction);
      if (targetYear.getFullYear() === nowDate.getFullYear()) setHistoryPeriod('thisYear');
      else if (targetYear.getFullYear() === nowDate.getFullYear() - 1) setHistoryPeriod('lastYear');
      else {
        setCustomDateRange({
          start: format(startOfYear(targetYear), 'yyyy-MM-dd'),
          end: format(endOfYear(targetYear), 'yyyy-MM-dd'),
        });
        setHistoryPeriod('custom');
      }
      setVisibleCount(15);
      return;
    }

    const baseS = periodStart || startOfMonth(nowDate);
    const baseE = periodEnd || endOfMonth(nowDate);
    const daysSpan = Math.max(1, differenceInCalendarDays(baseE, baseS) + 1);
    setCustomDateRange({
      start: format(addDays(baseS, direction * daysSpan), 'yyyy-MM-dd'),
      end: format(addDays(baseE, direction * daysSpan), 'yyyy-MM-dd'),
    });
    setHistoryPeriod('custom');
    setVisibleCount(15);
  };

  // Map reserves by id for fast O(1) lookup
  const reserveMap = useMemo(() => {
    const map: Record<string, Reserve> = {};
    reserves.forEach(r => { map[r.id] = r; });
    return map;
  }, [reserves]);

  // Chronological Running Balance per Reserve (for true bank-statement clarity)
  const runningBalanceMap = useMemo(() => {
    const map: Record<string, { balanceBefore: number; balanceAfter: number; isPending: boolean }> = {};
    const byReserve: Record<string, ReserveTransaction[]> = {};

    (reserveTransactions || []).forEach(rt => {
      if (!byReserve[rt.reserve_id]) byReserve[rt.reserve_id] = [];
      byReserve[rt.reserve_id].push(rt);
    });

    Object.entries(byReserve).forEach(([reserveId, rts]) => {
      const res = reserveMap[reserveId];
      let running = Math.round(Number(res?.saldo_inicial || 0) * 100) / 100;

      const sortedAsc = [...rts].sort(compareByDateTimeAsc);

      sortedAsc.forEach(rt => {
        const isPending = rt.payment_status === 'pending' || (rt as any).status === 'pending';
        const amt = Number(rt.amount || 0);
        const delta = rt.type === 'utilizacao' ? -amt : amt;

        if (isPending) {
          map[rt.id] = {
            balanceBefore: running,
            balanceAfter: running,
            isPending: true,
          };
        } else {
          const before = running;
          running = Math.round((running + delta) * 100) / 100;
          map[rt.id] = {
            balanceBefore: before,
            balanceAfter: running,
            isPending: false,
          };
        }
      });
    });

    return map;
  }, [reserveTransactions, reserveMap]);

  // Profile Income Categories for quick-chip selector
  const profileIncomeCategories = useMemo(() => {
    const fromSettings = settings?.income_categories || [];
    if (fromSettings.length > 0) return fromSettings;

    const fromTx = Array.from(
      new Set(
        (transactions || [])
          .filter(t => t.type === 'income' && t.category)
          .map(t => t.category as string)
      )
    );
    const defaults = ['iFood', 'Uber', '99Moto', 'Particular', 'Gorjeta', 'Frete do Dia', 'Pizzaria', 'Outros'];
    return Array.from(new Set([...defaults, ...fromTx]));
  }, [settings, transactions]);

  // Extract all unique categories present in transactions & rules
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    (reserveTransactions || []).forEach(tx => {
      if (tx.category && tx.category.trim()) {
        cats.add(tx.category.trim());
      }
    });
    reserves.forEach(r => {
      (r.regra_categorias || []).forEach(c => {
        if (c && c.trim()) cats.add(c.trim());
      });
      (r.rule_history || []).forEach((rh: any) => {
        (rh.regra_categorias || []).forEach((c: string) => {
          if (c && c.trim()) cats.add(c.trim());
        });
      });
    });
    return Array.from(cats).sort();
  }, [reserveTransactions, reserves]);

  // Real-time calculation simulator for any given rule against recent transactions
  const calculateRuleSimulation = useMemo(() => {
    const linkedReserveTxIds = buildLinkedReserveTxIdSet(reserveTransactions);
    return (
      ruleType: string,
      ruleValStr: string,
      cats: string[],
      ruleBase?: 'bruto' | 'liquido' | 'lucro'
    ) => {
      const val = parseFloat(String(ruleValStr).replace(',', '.'));
      if (isNaN(val) || val <= 0 || !ruleType) return { estimate: 0, metricLabel: 'Aguardando valor' };

      const thirtyDaysAgo = subDays(new Date(), 30);
      const recentTxs = (transactions || []).filter(t => {
        if (t.payment_status === 'pending' || (t as any).status === 'pending') return false;
        if (t.ignore_in_charts) return false;
        if (isReserveOrNonOperatingTx(t, linkedReserveTxIds)) return false;
        const effectiveDate = getEffectiveTxDateStr(t);
        if (!effectiveDate) return false;
        const d = parseLocalDate(effectiveDate);
        return d >= thirtyDaysAgo;
      });

      let total = 0;
      let metricLabel = '';

      if (ruleType === 'km') {
        const eligible = recentTxs.filter(
          t => t.type === 'income' && (cats.length === 0 || cats.includes(t.category)) && t.start_km !== null && t.end_km !== null
        );
        let totalKm = 0;
        eligible.forEach(t => {
          const km = (Number(t.end_km) || 0) - (Number(t.start_km) || 0);
          if (km > 0) totalKm += km;
        });
        total = totalKm * val;
        metricLabel = `${totalKm.toLocaleString('pt-BR')} km rodados (últimos 30d)`;
      } else if (ruleType === 'bruto') {
        const eligible = recentTxs.filter(
          t => t.type === 'income' && (cats.length === 0 || cats.includes(t.category))
        );
        const gross = eligible.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        total = gross * (val / 100);
        metricLabel = `${formatCurrency(gross)} faturamento elegível (últimos 30d)`;
      } else if (ruleType === 'liquido') {
        const effectiveBase = ruleBase || editRuleBase;
        const tempReserve = {
          regra_tipo: 'liquido',
          regra_base: effectiveBase,
        } as Reserve;
        const modeLabel =
          getLiquidoProfitMode(tempReserve) === 'operacional'
            ? 'lucro operacional'
            : 'lucro líquido geral';

        const totalIncome = recentTxs
          .filter(t => t.type === 'income' && (cats.length === 0 || cats.includes(t.category)))
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const totalExpense = recentTxs
          .filter(t =>
            doesExpenseCountForLiquido(tempReserve, t, {
              operationalCategories: settings?.operational_expense_categories,
              linkedReserveTxIds,
            })
          )
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const netProfit = Math.max(0, totalIncome - totalExpense);
        total = netProfit * (val / 100);
        metricLabel = `${formatCurrency(netProfit)} ${modeLabel} (últimos 30d)`;
      } else if (ruleType === 'fixo' || ruleType === 'fixo_diario') {
        const eligible = recentTxs.filter(
          t => t.type === 'income' && (cats.length === 0 || cats.includes(t.category))
        );
        const uniqueDays = new Set(eligible.map(t => getEffectiveTxDateStr(t)));
        total = uniqueDays.size * val;
        metricLabel = `${uniqueDays.size} dias com receita (últimos 30d)`;
      }

      return { estimate: Math.round(total * 100) / 100, metricLabel };
    };
  }, [transactions, reserveTransactions, settings?.operational_expense_categories, editRuleBase]);

  // Intelligent Fallback candidate calculation for active rule deletion
  const fallbackRuleCandidate = useMemo(() => {
    if (!ruleToDelete || !ruleToDelete.isCurrentActive) return null;
    const res = reserveMap[ruleToDelete.reserve_id];
    if (!res || !Array.isArray(res.rule_history) || res.rule_history.length === 0) return null;

    const validHistory = res.rule_history
      .map((h: any, idx: number) => ({ ...h, historyIndex: idx }))
      .filter((h: any) => h && h.regra_tipo && h.regra_valor !== undefined && h.regra_valor !== null);

    if (validHistory.length === 0) return null;
    // Return the latest historical rule
    return validHistory[validHistory.length - 1];
  }, [ruleToDelete, reserveMap]);

  // Compile all rule history events across all reserves
  // CRITICAL REORGANIZATION: Rules in effect (isCurrentActive: true) ALWAYS come before historical rules
  const allRuleEvents = useMemo<RuleHistoryItem[]>(() => {
    const activeEvents: RuleHistoryItem[] = [];
    const historyEvents: RuleHistoryItem[] = [];

    reserves.forEach(res => {
      // 1. Current active rule configuration in vigor (if reserve has rule parameters configured)
      if (res.regra_tipo && res.regra_valor !== undefined && res.regra_valor !== null) {
        const rawStart = res.regra_inicio_validade || res.created_at || getTodayLocalDateStr();
        const activeStartDate = toDateInputString(rawStart) || getTodayLocalDateStr();
        const activeStartTime =
          normalizeTimeStr(res.regra_inicio_hora) ||
          normalizeTimeStr(res.updated_at) ||
          normalizeTimeStr(res.created_at) ||
          null;
        activeEvents.push({
          id: `rule_current_${res.id}`,
          reserve_id: res.id,
          date: activeStartDate,
          time: activeStartTime,
          updated_at: res.updated_at || res.created_at || activeStartDate,
          regra_tipo: res.regra_tipo,
          regra_base: res.regra_base,
          regra_valor: Number(res.regra_valor || 0),
          regra_categorias: res.regra_categorias || [],
          regra_ativa: res.regra_ativa !== false,
          start_date: activeStartDate,
          start_time: activeStartTime,
          end_date: null,
          end_time: null,
          description: 'Regra ativa em vigor',
          isCurrentActive: true
        });
      }

      // 2. Historical past rules from res.rule_history
      const historyList = res.rule_history || [];
      historyList.forEach((h: any, idx: number) => {
        const rawStart = h.start_date || h.date || h.updated_at || res.created_at || '2026-01-01';
        const startDate = toDateInputString(rawStart) || '2026-01-01';
        const endDate = toDateInputString(h.end_date) || null;
        const histStartTime =
          normalizeTimeStr(h.start_time) ||
          normalizeTimeStr(h.updated_at) ||
          null;
        const histEndTime =
          normalizeTimeStr(h.end_time) ||
          (h.cutoff_at ? getCurrentLocalTimeStr(new Date(h.cutoff_at)) : null);
        const histTime = histEndTime || histStartTime || normalizeTimeStr(h.updated_at) || null;
        historyEvents.push({
          id: `rule_hist_${res.id}_${idx}_${h.updated_at || startDate || idx}`,
          reserve_id: res.id,
          historyIndex: idx,
          date: startDate,
          time: histTime,
          updated_at: h.updated_at || startDate,
          regra_tipo: h.regra_tipo,
          regra_base: h.regra_base || res.regra_base,
          regra_valor: Number(h.regra_valor || 0),
          regra_categorias: h.regra_categorias || [],
          regra_ativa: h.regra_ativa !== undefined ? Boolean(h.regra_ativa) : true,
          start_date: startDate,
          start_time: histStartTime,
          end_date: endDate,
          end_time: histEndTime,
          description: h.description || `Regra anterior arquivada`,
          isCurrentActive: false
        });
      });
    });

    // Active in-force rules are organized at the front
    return [...activeEvents, ...historyEvents];
  }, [reserves]);

  // Helper to categorize transaction source & UI presentation
  const getTxCategoryInfo = (tx: ReserveTransaction) => {
    const isSuggestion = tx.category === 'Aporte Sugerido' || 
                         tx.source === 'automation' || 
                         Boolean(tx.description && (
                           tx.description.includes('[Aporte Sugerido]') || 
                           tx.description.toLowerCase().includes('aporte sugerido')
                         ));

    const isMass = tx.source === 'mass_contribution' || 
                   Boolean(tx.batch_id) ||
                   Boolean(tx.description && (
                     tx.description.includes('[Consolidador em Massa]') ||
                     tx.description.includes('[Aporte em Massa]') || 
                     tx.description.includes('[Consolidador]')
                   ));
    
    if (tx.type === 'aporte') {
      if (isSuggestion) {
        return {
          label: 'Aporte Sugerido',
          shortLabel: 'Sugerido',
          categoryKey: 'suggestion_aporte',
          badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          icon: Sparkles,
          color: 'text-amber-600 dark:text-amber-400',
          isMass: false,
          isSuggestion: true
        };
      }
      if (isMass) {
        return {
          label: 'Aporte em Lote',
          shortLabel: 'Lote',
          categoryKey: 'mass_aporte',
          badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          icon: Zap,
          color: 'text-indigo-600 dark:text-indigo-400',
          isMass: true,
          isSuggestion: false
        };
      }
      const isProvento = tx.category === 'Proventos' || 
                         tx.source === 'dividends' || 
                         Boolean(tx.description && (tx.description.includes('Provento:') || tx.description.toLowerCase().includes('provento')));
      if (isProvento) {
        return {
          label: 'Aporte de Provento',
          shortLabel: 'Provento',
          categoryKey: 'provento_aporte',
          badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
          icon: ArrowDownLeft,
          color: 'text-purple-600 dark:text-purple-400',
          isMass: false,
          isSuggestion: false
        };
      }
      const isInvestmentSale = tx.source === 'investment' ||
                               Boolean(tx.linked_investment_id) ||
                               Boolean(tx.description && tx.description.toLowerCase().includes('investimento: venda'));
      if (isInvestmentSale) {
        return {
          label: 'Venda de Ativo (D+2)',
          shortLabel: 'Venda',
          categoryKey: 'manual_aporte',
          badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
          icon: ArrowDownLeft,
          color: 'text-sky-600 dark:text-sky-400',
          isMass: false,
          isSuggestion: false
        };
      }
      return {
        label: 'Aporte Manual',
        shortLabel: 'Manual',
        categoryKey: 'manual_aporte',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        icon: ArrowDownLeft,
        color: 'text-emerald-600 dark:text-emerald-400',
        isMass: false,
        isSuggestion: false
      };
    }

    if (tx.type === 'utilizacao') {
      const isTransferToCash = Boolean((tx as any).isTransferToCash) || 
        tx.category === 'Resgate de Reserva' || 
        tx.category === 'Resgate Reserva' || 
        tx.category === 'Resgate' ||
        tx.category === 'Transferência p/ Caixa' ||
        tx.category === 'Transferencia p/ Caixa' ||
        (tx.description || '').toLowerCase().includes('transferência para o caixa') || 
        (tx.description || '').toLowerCase().includes('transferencia para o caixa') || 
        (tx.description || '').toLowerCase().includes('p/ o caixa') ||
        (tx.description || '').toLowerCase().includes('para o caixa');
      return {
        label: isTransferToCash ? 'Transferência para o Caixa' : 'Resgate / Utilização',
        shortLabel: isTransferToCash ? 'P/ Caixa' : 'Resgate',
        categoryKey: 'utilizacao',
        badgeClass: isTransferToCash 
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        icon: isTransferToCash ? Landmark : ArrowUpRight,
        color: isTransferToCash ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
        isMass: false,
        isTransferToCash
      };
    }

    if (tx.type === 'rendimento') {
      return {
        label: 'Rendimento',
        shortLabel: 'Rendimento',
        categoryKey: 'rendimento',
        badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        icon: TrendingUp,
        color: 'text-blue-600 dark:text-blue-400',
        isMass: false
      };
    }

    return {
      label: 'Movimentação',
      shortLabel: 'Geral',
      categoryKey: 'other',
      badgeClass: 'bg-muted text-muted-foreground border-border',
      icon: DollarSign,
      color: 'text-foreground',
      isMass: false
    };
  };

  // Helper to format rule descriptions
  const getRuleFormulaLabel = (tipo?: string, valor?: number) => {
    const val = Number(valor || 0);
    switch (tipo) {
      case 'km':
        return `R$ ${val.toFixed(2).replace('.', ',')} / km rodado`;
      case 'bruto':
        return `${val}% do Faturamento Bruto`;
      case 'liquido':
        return `${val}% do Lucro Líquido`;
      case 'fixo':
      case 'fixo_diario':
        return `R$ ${val.toFixed(2).replace('.', ',')} por dia fixo`;
      default:
        return `${val} (${tipo || 'regra'})`;
    }
  };

  const getRuleTypeName = (tipo?: string) => {
    switch (tipo) {
      case 'km':
        return 'Por KM Rodado';
      case 'bruto':
        return '% Faturamento Bruto';
      case 'liquido':
        return '% Lucro Líquido';
      case 'fixo':
      case 'fixo_diario':
        return 'Fixo Diário';
      default:
        return 'Regra de Aporte';
    }
  };

  // Check if any non-default filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      historyPeriod !== 'month' ||
      searchTerm.trim() !== '' ||
      selectedReserveId !== 'all' ||
      selectedType !== 'aporte' ||
      selectedCategory !== 'all' ||
      selectedSource !== 'all' ||
      selectedPaymentStatus !== 'all' ||
      minValue !== '' ||
      maxValue !== '' ||
      sortBy !== 'date_desc'
    );
  }, [historyPeriod, searchTerm, selectedReserveId, selectedType, selectedCategory, selectedSource, selectedPaymentStatus, minValue, maxValue, sortBy]);

  const activeAdvancedFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedType !== 'aporte') count++;
    if (selectedReserveId !== 'all') count++;
    if (selectedCategory !== 'all') count++;
    if (selectedPaymentStatus !== 'all') count++;
    if (minValue !== '' || maxValue !== '') count++;
    if (sortBy !== 'date_desc') count++;
    return count;
  }, [selectedType, selectedReserveId, selectedCategory, selectedPaymentStatus, minValue, maxValue, sortBy]);

  // Reset all filters to default (Mês Atual + Aportes)
  const handleResetFilters = () => {
    setHistoryPeriod('month');
    setCustomDateRange(null);
    setSearchTerm('');
    setSelectedReserveId('all');
    setSelectedType('aporte');
    setSelectedCategory('all');
    setSelectedSource('all');
    setSelectedPaymentStatus('all');
    setMinValue('');
    setMaxValue('');
    setSortBy('date_desc');
    setVisibleCount(15);
  };

  // Unified items list: Combines Transactions + Rule Updates
  const unifiedItems = useMemo<UnifiedHistoryItem[]>(() => {
    const list: UnifiedHistoryItem[] = [];

    // 1. Add transactions
    (reserveTransactions || []).forEach(tx => {
      list.push({
        kind: 'transaction',
        id: `tx_${tx.id}`,
        date: tx.date || '',
        time: getEffectiveItemTime(tx),
        reserve_id: tx.reserve_id,
        amount: Number(tx.amount || 0),
        tx
      });
    });

    // 2. Add rule events
    allRuleEvents.forEach(rule => {
      list.push({
        kind: 'rule_update',
        id: rule.id,
        date: rule.date || '',
        time: rule.time || normalizeTimeStr(rule.start_time) || normalizeTimeStr(rule.updated_at) || null,
        reserve_id: rule.reserve_id,
        amount: rule.regra_valor,
        rule
      });
    });

    return list;
  }, [reserveTransactions, allRuleEvents]);

  // Base filtered items WITHOUT selectedType filter so Bento summary cards always show real totals for Aportes, Resgates and Rendimentos
  const summaryBaseItems = useMemo<UnifiedHistoryItem[]>(() => {
    return unifiedItems.filter(item => {
      // 1. Period filter
      if (historyPeriod !== 'all') {
        if (!isTxInPeriod(item.date, historyPeriod, customDateRange)) {
          return false;
        }
      }

      // 2. Reserve filter
      if (selectedReserveId !== 'all' && item.reserve_id !== selectedReserveId) {
        return false;
      }

      // 3. Payment status filter
      if (selectedPaymentStatus !== 'all') {
        if (item.kind !== 'transaction') return false;
        const isPending = item.tx.payment_status === 'pending' || (item.tx as any).status === 'pending';
        if (selectedPaymentStatus === 'pending' && !isPending) return false;
        if (selectedPaymentStatus === 'paid' && isPending) return false;
      }

      // 4. Category filter
      if (selectedCategory !== 'all') {
        if (item.kind === 'transaction') {
          const cat = item.tx.category || '';
          if (cat.trim().toLowerCase() !== selectedCategory.trim().toLowerCase()) {
            return false;
          }
        } else {
          const ruleCats = item.rule.regra_categorias || [];
          const hasCat = ruleCats.some(c => c.trim().toLowerCase() === selectedCategory.trim().toLowerCase());
          if (!hasCat) return false;
        }
      }

      // 5. Source filter
      if (selectedSource !== 'all') {
        if (selectedSource === 'rule') {
          if (item.kind !== 'rule_update') return false;
        } else if (item.kind === 'transaction') {
          const info = getTxCategoryInfo(item.tx);
          if (selectedSource === 'mass' && !info.isMass) return false;
          if (selectedSource === 'manual' && (info.isMass || item.tx.type === 'rendimento')) return false;
          if (selectedSource === 'rendimento' && item.tx.type !== 'rendimento') return false;
        } else {
          return false;
        }
      }

      // 6. Min and Max Value filter (financial value for tx, rule value for rules)
      if (minValue !== '') {
        const min = parseFloat(minValue.replace(',', '.'));
        if (!isNaN(min) && item.amount < min) return false;
      }
      if (maxValue !== '') {
        const max = parseFloat(maxValue.replace(',', '.'));
        if (!isNaN(max) && item.amount > max) return false;
      }

      // 7. Search text filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const res = reserveMap[item.reserve_id];
        const resName = res?.name?.toLowerCase() || '';
        const dateDisplay = formatDateDisplay(item.date).toLowerCase();

        if (item.kind === 'transaction') {
          const info = getTxCategoryInfo(item.tx);
          const desc = (item.tx.description || '').toLowerCase();
          const cat = (item.tx.category || '').toLowerCase();
          const amountStr = String(item.tx.amount || '');
          const txTypeStr = info.label.toLowerCase();

          if (
            !resName.includes(term) &&
            !desc.includes(term) &&
            !cat.includes(term) &&
            !amountStr.includes(term) &&
            !dateDisplay.includes(term) &&
            !txTypeStr.includes(term)
          ) {
            return false;
          }
        } else {
          const ruleFormula = getRuleFormulaLabel(item.rule.regra_tipo, item.rule.regra_valor).toLowerCase();
          const ruleTypeName = getRuleTypeName(item.rule.regra_tipo).toLowerCase();
          const desc = (item.rule.description || '').toLowerCase();
          const catsStr = (item.rule.regra_categorias || []).join(' ').toLowerCase();
          const statusStr = item.rule.isCurrentActive ? 'ativa em vigor vigente' : 'histórico arquivada inativa';

          if (
            !resName.includes(term) &&
            !ruleFormula.includes(term) &&
            !ruleTypeName.includes(term) &&
            !desc.includes(term) &&
            !catsStr.includes(term) &&
            !statusStr.includes(term) &&
            !dateDisplay.includes(term) &&
            !term.includes('regra') &&
            !term.includes('atualiza')
          ) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    unifiedItems,
    historyPeriod,
    customDateRange,
    selectedReserveId,
    selectedCategory,
    selectedSource,
    selectedPaymentStatus,
    minValue,
    maxValue,
    searchTerm,
    reserveMap
  ]);

  // Filter by selectedType and sort unified items for timeline display
  const filteredItems = useMemo<UnifiedHistoryItem[]>(() => {
    return summaryBaseItems
      .filter(item => {
        if (selectedType !== 'all') {
          if (selectedType === 'rule_change') {
            if (item.kind !== 'rule_update') return false;
          } else if (selectedType === 'transactions_only') {
            if (item.kind !== 'transaction') return false;
          } else if (selectedType === 'pending_only') {
            if (item.kind !== 'transaction') return false;
            const isPending = item.tx.payment_status === 'pending' || (item.tx as any).status === 'pending';
            if (!isPending) return false;
          } else if (selectedType === 'boost_aporte') {
            if (item.kind !== 'transaction') return false;
            if (getBoostExtraFromRt(item.tx) <= 0) return false;
          } else {
            if (item.kind !== 'transaction') return false;
            const info = getTxCategoryInfo(item.tx);
            if (selectedType === 'aporte' && item.tx.type !== 'aporte') return false;
            if (selectedType === 'manual_aporte' && info.categoryKey !== 'manual_aporte') return false;
            if (selectedType === 'suggestion_aporte' && info.categoryKey !== 'suggestion_aporte') return false;
            if (selectedType === 'mass_aporte' && info.categoryKey !== 'mass_aporte') return false;
            if (selectedType === 'utilizacao' && info.categoryKey !== 'utilizacao') return false;
            if (selectedType === 'rendimento' && info.categoryKey !== 'rendimento') return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') {
          if (a.kind === 'rule_update' && b.kind === 'rule_update') {
            if (a.rule.isCurrentActive && !b.rule.isCurrentActive) return -1;
            if (!a.rule.isCurrentActive && b.rule.isCurrentActive) return 1;
          }
        }

        const toSortable = (item: UnifiedHistoryItem): DateTimeSortableItem =>
          item.kind === 'transaction'
            ? {
                id: item.id,
                date: item.date,
                time: item.time ?? getEffectiveItemTime(item.tx),
                created_at: item.tx.created_at,
              }
            : {
                id: item.id,
                date: item.date,
                time: item.time ?? item.rule.time ?? normalizeTimeStr(item.rule.start_time),
                created_at: item.rule.updated_at,
              };

        const amtA = Number(a.amount || 0);
        const amtB = Number(b.amount || 0);
        const resA = reserveMap[a.reserve_id]?.name || '';
        const resB = reserveMap[b.reserve_id]?.name || '';

        switch (sortBy) {
          case 'date_asc':
            return compareByDateTimeAsc(toSortable(a), toSortable(b));
          case 'amount_desc':
            return amtB - amtA;
          case 'amount_asc':
            return amtA - amtB;
          case 'reserve_asc':
            return resA.localeCompare(resB);
          case 'date_desc':
          default: {
            const cmp = compareByDateTimeDesc(toSortable(a), toSortable(b));
            if (cmp !== 0) return cmp;
            if (a.kind === 'rule_update' && b.kind === 'rule_update') {
              if (a.rule.isCurrentActive && !b.rule.isCurrentActive) return -1;
              if (!a.rule.isCurrentActive && b.rule.isCurrentActive) return 1;
            }
            return 0;
          }
        }
      });
  }, [summaryBaseItems, selectedType, sortBy, reserveMap]);

  // Financial & Rule Summary Metrics for active period/reserve (independent of selectedType filter)
  const summary = useMemo(() => {
    let totalAportesManuais = 0;
    let totalAportesSugeridos = 0;
    let totalAportesMassa = 0;
    let totalBoostExtra = 0;
    let countAportes = 0;
    let totalUtilizacoes = 0;
    let totalTransferToCash = 0;
    let countUtilizacoes = 0;
    let totalRendimentos = 0;
    let countRendimentos = 0;
    let totalPendingAmount = 0;
    let countPending = 0;
    let countRuleUpdates = 0;
    let countActiveRules = 0;

    summaryBaseItems.forEach(item => {
      if (item.kind === 'transaction') {
        const amount = Number(item.tx.amount || 0);
        if (item.tx.payment_status === 'pending' || (item.tx as any).status === 'pending') {
          totalPendingAmount += amount;
          countPending++;
          return;
        }
        const info = getTxCategoryInfo(item.tx);
        const boostExtra = getBoostExtraFromRt(item.tx);
        if (boostExtra > 0) totalBoostExtra += boostExtra;

        if (info.categoryKey === 'manual_aporte' || info.categoryKey === 'provento_aporte') {
          totalAportesManuais += amount;
          countAportes++;
        } else if (info.categoryKey === 'suggestion_aporte') {
          totalAportesSugeridos += amount;
          countAportes++;
        } else if (info.categoryKey === 'mass_aporte') {
          totalAportesMassa += amount;
          countAportes++;
        } else if (info.categoryKey === 'utilizacao') {
          totalUtilizacoes += amount;
          if ((info as any).isTransferToCash) totalTransferToCash += amount;
          countUtilizacoes++;
        } else if (info.categoryKey === 'rendimento') {
          totalRendimentos += amount;
          countRendimentos++;
        }
      } else if (item.kind === 'rule_update') {
        countRuleUpdates++;
        if (item.rule.isCurrentActive) {
          countActiveRules++;
        }
      }
    });

    const totalAportes = totalAportesManuais + totalAportesSugeridos + totalAportesMassa;
    const netFlow = (totalAportes + totalRendimentos) - totalUtilizacoes;
    const totalInflows = totalAportes + totalRendimentos;
    const yieldSharePct = totalInflows > 0 ? Math.round((totalRendimentos / totalInflows) * 1000) / 10 : 0;

    return {
      totalAportesManuais: Math.round(totalAportesManuais * 100) / 100,
      totalAportesSugeridos: Math.round(totalAportesSugeridos * 100) / 100,
      totalAportesMassa: Math.round(totalAportesMassa * 100) / 100,
      totalAportesTotal: Math.round(totalAportes * 100) / 100,
      totalBoostExtra: Math.round(totalBoostExtra * 100) / 100,
      countAportes,
      totalUtilizacoes: Math.round(totalUtilizacoes * 100) / 100,
      totalTransferToCash: Math.round(totalTransferToCash * 100) / 100,
      countUtilizacoes,
      totalRendimentos: Math.round(totalRendimentos * 100) / 100,
      countRendimentos,
      yieldSharePct,
      totalPendingAmount: Math.round(totalPendingAmount * 100) / 100,
      countPending,
      netFlow: Math.round(netFlow * 100) / 100,
      countRuleUpdates,
      countActiveRules,
      totalCount: filteredItems.length
    };
  }, [summaryBaseItems, filteredItems.length]);

  // Consolidated Monthly Flow & Yield Evolution — ALWAYS uses rolling last 12 months (independent of period filter)
  const monthlyAnalytics = useMemo(() => {
    const flowMap: Record<string, {
      monthKey: string;
      label: string;
      fullLabel: string;
      aportes: number;
      rendimentos: number;
      resgates: number;
      net: number;
    }> = {};
    const yieldMap: Record<string, { monthKey: string; label: string; fullLabel: string; total: number; count: number }> = {};

    const nowRef = new Date();
    const minMonthStartStr = format(startOfMonth(subMonths(nowRef, 11)), 'yyyy-MM-dd');
    const maxMonthEndStr = format(endOfMonth(nowRef), 'yyyy-MM-dd');

    (reserveTransactions || []).forEach(rt => {
      if (rt.payment_status === 'pending' || (rt as any).status === 'pending') return;
      if (selectedReserveId !== 'all' && rt.reserve_id !== selectedReserveId) return;

      const cleanDate = toDateInputString(rt.date) || (rt.date || '').split('T')[0];
      if (!cleanDate || cleanDate.length < 7) return;
      if (cleanDate < minMonthStartStr || cleanDate > maxMonthEndStr) return;

      const monthKey = cleanDate.slice(0, 7);
      const parsed = parseLocalDate(`${monthKey}-01`);

      if (!flowMap[monthKey]) {
        flowMap[monthKey] = {
          monthKey,
          label: format(parsed, 'MMM/yy', { locale: ptBR }),
          fullLabel: format(parsed, "MMMM 'de' yyyy", { locale: ptBR }),
          aportes: 0,
          rendimentos: 0,
          resgates: 0,
          net: 0,
        };
      }

      const amt = Number(rt.amount || 0);
      if (rt.type === 'aporte') {
        flowMap[monthKey].aportes += amt;
        flowMap[monthKey].net += amt;
      } else if (rt.type === 'rendimento') {
        flowMap[monthKey].rendimentos += amt;
        flowMap[monthKey].net += amt;

        if (!yieldMap[monthKey]) {
          yieldMap[monthKey] = {
            monthKey,
            label: format(parsed, 'MMM/yy', { locale: ptBR }),
            fullLabel: format(parsed, "MMMM 'de' yyyy", { locale: ptBR }),
            total: 0,
            count: 0,
          };
        }
        yieldMap[monthKey].total += amt;
        yieldMap[monthKey].count += 1;
      } else if (rt.type === 'utilizacao') {
        flowMap[monthKey].resgates += amt;
        flowMap[monthKey].net -= amt;
      }
    });

    const flowSeries = Object.values(flowMap)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .slice(-12)
      .map(m => ({
        ...m,
        aportes: Math.round(m.aportes * 100) / 100,
        rendimentos: Math.round(m.rendimentos * 100) / 100,
        resgates: Math.round(m.resgates * 100) / 100,
        net: Math.round(m.net * 100) / 100,
      }));

    const yieldSeries = Object.values(yieldMap)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .slice(-12)
      .map(item => ({
        ...item,
        total: Math.round(item.total * 100) / 100
      }));

    const totalPeriodYield = yieldSeries.reduce((s, m) => s + m.total, 0);
    const avgMonthlyYield = yieldSeries.length > 0 ? totalPeriodYield / yieldSeries.length : 0;
    const bestMonthYield = yieldSeries.reduce<typeof yieldSeries[number] | null>(
      (best, cur) => (!best || cur.total > best.total ? cur : best),
      null
    );

    return {
      flowSeries,
      yieldSeries,
      totalPeriodYield: Math.round(totalPeriodYield * 100) / 100,
      avgMonthlyYield: Math.round(avgMonthlyYield * 100) / 100,
      bestMonthYield,
    };
  }, [reserveTransactions, selectedReserveId]);

  // Per-reserve breakdown in rolling last 12 months (settled transactions, independent of period filter)
  const reserveBreakdown = useMemo(() => {
    const byRes: Record<string, {
      reserve: Reserve;
      aportes: number;
      boostExtras: number;
      rendimentos: number;
      resgates: number;
      netFlow: number;
      txCount: number;
    }> = {};

    const nowRef = new Date();
    const minMonthStartStr = format(startOfMonth(subMonths(nowRef, 11)), 'yyyy-MM-dd');
    const maxMonthEndStr = format(endOfMonth(nowRef), 'yyyy-MM-dd');

    reserves.forEach(r => {
      byRes[r.id] = {
        reserve: r,
        aportes: 0,
        boostExtras: 0,
        rendimentos: 0,
        resgates: 0,
        netFlow: 0,
        txCount: 0,
      };
    });

    (reserveTransactions || []).forEach(rt => {
      if (rt.payment_status === 'pending' || (rt as any).status === 'pending') return;
      const cleanDate = toDateInputString(rt.date) || (rt.date || '').split('T')[0];
      if (!cleanDate || cleanDate < minMonthStartStr || cleanDate > maxMonthEndStr) return;

      const entry = byRes[rt.reserve_id];
      if (!entry) return;
      const amt = Number(rt.amount || 0);
      entry.txCount += 1;
      if (rt.type === 'aporte') {
        entry.aportes += amt;
        entry.netFlow += amt;
        entry.boostExtras += getBoostExtraFromRt(rt);
      } else if (rt.type === 'rendimento') {
        entry.rendimentos += amt;
        entry.netFlow += amt;
      } else if (rt.type === 'utilizacao') {
        entry.resgates += amt;
        entry.netFlow -= amt;
      }
    });

    return Object.values(byRes)
      .filter(x => x.txCount > 0 || Number(x.reserve.saldo_atual || 0) > 0)
      .map(x => ({
        ...x,
        aportes: Math.round(x.aportes * 100) / 100,
        boostExtras: Math.round(x.boostExtras * 100) / 100,
        rendimentos: Math.round(x.rendimentos * 100) / 100,
        resgates: Math.round(x.resgates * 100) / 100,
        netFlow: Math.round(x.netFlow * 100) / 100,
      }))
      .sort((a, b) => (b.aportes + b.rendimentos + b.resgates) - (a.aportes + a.rendimentos + a.resgates));
  }, [reserves, reserveTransactions]);

  // Quick reserve transaction counts for quick-pill selector
  const reserveTxCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (reserveTransactions || []).forEach(rt => {
      if (historyPeriod !== 'all' && !isTxInPeriod(rt.date, historyPeriod, customDateRange)) return;
      counts[rt.reserve_id] = (counts[rt.reserve_id] || 0) + 1;
    });
    return counts;
  }, [reserveTransactions, historyPeriod, customDateRange]);

  const totalBoostAportesCount = useMemo(() => {
    return (reserveTransactions || []).filter(rt => getBoostExtraFromRt(rt) > 0).length;
  }, [reserveTransactions]);

  const totalPendingCount = useMemo(() => {
    return (reserveTransactions || []).filter(
      rt => rt.payment_status === 'pending' || (rt as any).status === 'pending'
    ).length;
  }, [reserveTransactions]);

  // Total Rule count in system for badges
  const totalSystemRuleUpdates = allRuleEvents.length;

  // Slice displayed items based on visibleCount chunk
  const visibleItems = useMemo(() => {
    return filteredItems.slice(0, visibleCount);
  }, [filteredItems, visibleCount]);

  // Grouped items by month/date for clean feed rendering
  const groupedItems = useMemo(() => {
    if (!groupByDate) return null;

    const groups: { [key: string]: { label: string; items: UnifiedHistoryItem[]; subtotalIn: number; subtotalOut: number; ruleCount: number } } = {};

    visibleItems.forEach(item => {
      const dateKey = item.date ? item.date.substring(0, 7) : 'sem_data'; // YYYY-MM
      let groupLabel = 'Sem Data';
      
      if (item.date) {
        try {
          const d = parseLocalDate(item.date);
          const monthName = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
          groupLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        } catch {
          groupLabel = dateKey;
        }
      }

      if (!groups[dateKey]) {
        groups[dateKey] = {
          label: groupLabel,
          items: [],
          subtotalIn: 0,
          subtotalOut: 0,
          ruleCount: 0
        };
      }

      groups[dateKey].items.push(item);

      if (item.kind === 'transaction') {
        const amt = Number(item.tx.amount || 0);
        const isPending = item.tx.payment_status === 'pending' || (item.tx as any).status === 'pending';
        if (!isPending) {
          if (item.tx.type === 'aporte' || item.tx.type === 'rendimento') {
            groups[dateKey].subtotalIn += amt;
          } else {
            groups[dateKey].subtotalOut += amt;
          }
        }
      } else {
        groups[dateKey].ruleCount++;
      }
    });

    return Object.entries(groups).map(([key, value]) => {
      // Reorganize inside each group: Rules in effect (active) ALWAYS appear ahead of historical rules
      const sortedItems = [...value.items].sort((a, b) => {
        const aActive = a.kind === 'rule_update' && a.rule.isCurrentActive ? 1 : 0;
        const bActive = b.kind === 'rule_update' && b.rule.isCurrentActive ? 1 : 0;
        return bActive - aActive;
      });

      return {
        key,
        ...value,
        subtotalIn: Math.round(value.subtotalIn * 100) / 100,
        subtotalOut: Math.round(value.subtotalOut * 100) / 100,
        netMonth: Math.round((value.subtotalIn - value.subtotalOut) * 100) / 100,
        items: sortedItems
      };
    });
  }, [visibleItems, groupByDate]);

  // Handle Export to CSV
  const handleExportCSV = () => {
    if (filteredItems.length === 0) {
      toast.error('Nenhum registro para exportar.');
      return;
    }

    const headers = ['Data', 'Hora', 'Reserva', 'Tipo de Registro', 'Status', 'Categoria / Tags', 'Detalhes / Descrição', 'Valor / Fórmula', 'Bônus Boost', 'Saldo Após'];
    const rows = filteredItems.map(item => {
      const res = reserveMap[item.reserve_id];
      const resName = res?.name || 'Reserva';

      if (item.kind === 'transaction') {
        const info = getTxCategoryInfo(item.tx);
        const sign = item.tx.type === 'utilizacao' ? '-' : '+';
        const isPending = item.tx.payment_status === 'pending' || (item.tx as any).status === 'pending';
        const boostExtra = getBoostExtraFromRt(item.tx);
        const balInfo = runningBalanceMap[item.tx.id];
        const txTime = getEffectiveItemTime(item.tx) || '';
        return [
          formatDateDisplay(item.tx.date),
          `"${txTime}"`,
          `"${resName.replace(/"/g, '""')}"`,
          `"${info.label}"`,
          `"${isPending ? 'Pendente' : 'Liquidado'}"`,
          `"${(item.tx.category || '').replace(/"/g, '""')}"`,
          `"${(item.tx.description || '').replace(/"/g, '""')}"`,
          `"${sign}${Number(item.tx.amount || 0).toFixed(2).replace('.', ',')}"`,
          `"${boostExtra > 0 ? boostExtra.toFixed(2).replace('.', ',') : ''}"`,
          `"${balInfo && !isPending ? balInfo.balanceAfter.toFixed(2).replace('.', ',') : ''}"`
        ];
      } else {
        const formula = getRuleFormulaLabel(item.rule.regra_tipo, item.rule.regra_valor);
        const status = item.rule.isCurrentActive ? 'Em Vigor' : 'Histórico';
        const cats = (item.rule.regra_categorias || []).join(', ');
        const ruleTime = item.rule.start_time || item.rule.time || '';
        return [
          formatDateDisplay(item.rule.date),
          `"${ruleTime}"`,
          `"${resName.replace(/"/g, '""')}"`,
          `"Atualização de Regra (${status})"`,
          `"${item.rule.regra_ativa !== false ? 'Ativa' : 'Pausada'}"`,
          `"${cats.replace(/"/g, '""')}"`,
          `"${(item.rule.description || 'Configuração de aporte automático').replace(/"/g, '""')}"`,
          `"${formula.replace(/"/g, '""')}"`,
          '""',
          '""'
        ];
      }
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `extrato_reservas_e_regras_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Extrato exportado com sucesso!');
  };

  // Open Edit Modal with transaction data
  const handleOpenEdit = (tx: ReserveTransaction) => {
    setTxToEdit(tx);
    setEditAmount(String(tx.amount || ''));
    setEditDate(tx.date || getTodayLocalDateStr());
    setEditTime(getEffectiveItemTime(tx) || getCurrentLocalTimeStr());
    setEditDescription(tx.description || '');
    setEditCategory(tx.category || '');
    setEditReserveId(tx.reserve_id || '');
    setEditIgnoreInCharts(Boolean(tx.ignore_in_charts));
    setEditPaymentStatus((tx.payment_status === 'pending' || (tx as any).status === 'pending') ? 'pending' : 'paid');
  };

  // Save edited transaction
  const handleSaveEdit = async () => {
    if (!txToEdit || !onEditTransaction) return;
    const parsedAmount = parseFloat(editAmount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Informe um valor válido maior que zero.');
      return;
    }

    try {
      setIsEditing(true);
      await onEditTransaction(txToEdit.id, {
        amount: parsedAmount,
        date: editDate,
        time: normalizeTimeStr(editTime) || null,
        description: editDescription.trim(),
        category: editCategory.trim() || undefined,
        reserve_id: editReserveId || txToEdit.reserve_id,
        payment_status: editPaymentStatus,
        payment_date: editPaymentStatus === 'paid' ? (txToEdit.payment_date || editDate) : null,
        ignore_in_charts: txToEdit.type === 'utilizacao' ? editIgnoreInCharts : txToEdit.ignore_in_charts
      });
      toast.success('Movimentação atualizada com sucesso!');
      setTxToEdit(null);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao atualizar: ' + (e.message || 'Tente novamente.'));
    } finally {
      setIsEditing(false);
    }
  };

  // Open Edit Modal for Rule (Active in-force or Historical)
  const handleOpenEditRule = (rule: RuleHistoryItem) => {
    setRuleToEdit(rule);
    const normalizedType = rule.regra_tipo === 'fixo_diario' ? 'fixo' : (rule.regra_tipo || 'km');
    setEditRuleType(normalizedType);
    const reserveForRule = reserveMap[rule.reserve_id];
    const resolvedBase = (rule.regra_base || reserveForRule?.regra_base) === 'liquido' ? 'liquido' : 'lucro';
    setEditRuleBase(resolvedBase);
    setEditRuleValue(rule.regra_valor !== undefined && rule.regra_valor !== null ? String(rule.regra_valor) : '');
    const cleanStart = toDateInputString(rule.start_date || rule.date) || getTodayLocalDateStr();
    const cleanEnd = toDateInputString(rule.end_date);
    setEditRuleStartDate(cleanStart);
    setEditRuleStartTime(
      normalizeTimeStr(rule.start_time) ||
      normalizeTimeStr(rule.time) ||
      getCurrentLocalTimeStr()
    );
    setEditRuleEndDate(cleanEnd);
    setEditRuleEndTime(normalizeTimeStr(rule.end_time) || '');
    const initialCats = Array.isArray(rule.regra_categorias) ? rule.regra_categorias : [];
    setEditRuleCategories(initialCats.join(', '));
    setEditRuleCategoryList(initialCats);
    setEditRuleActive(rule.regra_ativa !== false);
    setEditRuleAutoArchive(true);
    setEditRuleChangeReason('');
    setEditRuleDescription(rule.description || '');
  };

  // Toggle Category selection in Chip selector
  const handleToggleEditCategory = (catName: string) => {
    setEditRuleCategoryList(prev => {
      const exists = prev.includes(catName);
      const updated = exists ? prev.filter(c => c !== catName) : [...prev, catName];
      setEditRuleCategories(updated.join(', '));
      return updated;
    });
  };

  // Select all categories
  const handleSelectAllCategories = () => {
    setEditRuleCategoryList([...profileIncomeCategories]);
    setEditRuleCategories(profileIncomeCategories.join(', '));
  };

  // Clear all categories
  const handleClearCategories = () => {
    setEditRuleCategoryList([]);
    setEditRuleCategories('');
  };

  // Save edited rule (Active or Historical)
  const handleSaveRuleEdit = async () => {
    if (!ruleToEdit || !onUpdateReserve) {
      if (!onUpdateReserve) toast.error('Ação de atualização de reserva indisponível.');
      return;
    }
    const reserve = reserveMap[ruleToEdit.reserve_id];
    if (!reserve) {
      toast.error('Reserva não encontrada.');
      return;
    }

    const numVal = parseFloat(editRuleValue.replace(',', '.'));
    if (isNaN(numVal) || numVal < 0) {
      toast.error('Informe um valor numérico válido para a regra (zero ou positivo).');
      return;
    }

    if ((editRuleType === 'bruto' || editRuleType === 'liquido') && numVal > 100) {
      toast.error('O percentual da regra não pode exceder 100%.');
      return;
    }

    if (editRuleStartDate && editRuleEndDate && editRuleEndDate < editRuleStartDate) {
      toast.error('A data de término não pode ser anterior à data de início de vigência.');
      return;
    }

    const normStartTime = normalizeTimeStr(editRuleStartTime);
    const normEndTime = normalizeTimeStr(editRuleEndTime);
    if (
      editRuleStartDate &&
      editRuleEndDate &&
      editRuleEndDate === editRuleStartDate &&
      normStartTime &&
      normEndTime &&
      normEndTime < normStartTime
    ) {
      toast.error('A hora de término não pode ser anterior à hora de início no mesmo dia.');
      return;
    }

    const parsedCats = editRuleCategoryList.length > 0 
      ? editRuleCategoryList 
      : editRuleCategories.split(',').map(c => c.trim()).filter(Boolean);

    try {
      setIsSavingRule(true);

      if (ruleToEdit.isCurrentActive) {
        // Updating Current Active In-Force Rule of the reserve
        const currentHist = Array.isArray(reserve.rule_history) ? [...reserve.rule_history] : [];
        const cleanStart = toDateInputString(editRuleStartDate) || getTodayLocalDateStr();
        const cleanStartTime = normStartTime || getCurrentLocalTimeStr();

        // Auto-archive previous active configuration to history if requested & there was an active rule
        if (editRuleAutoArchive && reserve.regra_tipo && reserve.regra_valor) {
          const rawPrevStart = reserve.regra_inicio_validade || reserve.created_at || editRuleStartDate;
          const prevStart = toDateInputString(rawPrevStart) || getTodayLocalDateStr();
          const prevStartTime = normalizeTimeStr(reserve.regra_inicio_hora) || null;
          const formulaLabel = getRuleFormulaLabel(reserve.regra_tipo, reserve.regra_valor);
          
          currentHist.push({
            start_date: prevStart,
            start_time: prevStartTime,
            end_date: cleanStart,
            end_time: cleanStartTime,
            regra_tipo: reserve.regra_tipo,
            regra_base: reserve.regra_base,
            regra_valor: reserve.regra_valor,
            regra_categorias: reserve.regra_categorias || [],
            regra_ativa: reserve.regra_ativa !== false,
            updated_at: new Date().toISOString(),
            description: editRuleChangeReason.trim() 
              ? `Reajuste: ${editRuleChangeReason.trim()}` 
              : `Versão anterior arquivada: ${formulaLabel}`
          });
        }

        await onUpdateReserve(ruleToEdit.reserve_id, {
          regra_tipo: editRuleType as any,
          regra_base: editRuleType === 'liquido' ? editRuleBase : 'lucro',
          regra_valor: numVal,
          regra_categorias: parsedCats,
          regra_inicio_validade: cleanStart,
          regra_inicio_hora: cleanStartTime,
          regra_ativa: editRuleActive,
          ...(editRuleType === 'liquido' ? { reset_suggestion_on_withdraw: false } : {}),
          rule_history: currentHist,
          updated_at: new Date().toISOString()
        });
        toast.success('Regra em vigor atualizada com sucesso!');
      } else {
        // Updating Historical Rule in reserve.rule_history array
        const currentHistory = Array.isArray(reserve.rule_history) ? [...reserve.rule_history] : [];
        const targetIdx = ruleToEdit.historyIndex !== undefined ? ruleToEdit.historyIndex : -1;
        const cleanHistStart = toDateInputString(editRuleStartDate) || getTodayLocalDateStr();
        const cleanHistStartTime = normStartTime || null;
        const cleanHistEnd = toDateInputString(editRuleEndDate) || null;
        const cleanHistEndTime = cleanHistEnd ? (normEndTime || null) : null;

        if (targetIdx >= 0 && targetIdx < currentHistory.length) {
          currentHistory[targetIdx] = {
            ...currentHistory[targetIdx],
            regra_tipo: editRuleType,
            regra_base: editRuleType === 'liquido' ? editRuleBase : 'lucro',
            regra_valor: numVal,
            regra_categorias: parsedCats,
            start_date: cleanHistStart,
            start_time: cleanHistStartTime,
            end_date: cleanHistEnd,
            end_time: cleanHistEndTime,
            regra_ativa: editRuleActive,
            description: editRuleDescription,
            updated_at: new Date().toISOString()
          };
        } else {
          const matchIdx = currentHistory.findIndex(h => h.updated_at === ruleToEdit.updated_at || h.start_date === ruleToEdit.start_date);
          if (matchIdx >= 0) {
            currentHistory[matchIdx] = {
              ...currentHistory[matchIdx],
              regra_tipo: editRuleType,
              regra_base: editRuleType === 'liquido' ? editRuleBase : 'lucro',
              regra_valor: numVal,
              regra_categorias: parsedCats,
              start_date: cleanHistStart,
              start_time: cleanHistStartTime,
              end_date: cleanHistEnd,
              end_time: cleanHistEndTime,
              regra_ativa: editRuleActive,
              description: editRuleDescription,
              updated_at: new Date().toISOString()
            };
          }
        }

        await onUpdateReserve(ruleToEdit.reserve_id, {
          rule_history: currentHistory,
          updated_at: new Date().toISOString()
        });
        toast.success('Registro histórico de regra atualizado com sucesso!');
      }

      setRuleToEdit(null);
      if (ruleToViewDetails) setRuleToViewDetails(null);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar alteração da regra: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSavingRule(false);
    }
  };

  // Open Delete Confirmation Modal for Rule
  const handleOpenDeleteRule = (rule: RuleHistoryItem) => {
    setRuleToDelete(rule);
  };

  // Confirm delete / remove rule with intelligent automatic fallback
  const handleDeleteRule = async (mode: 'restore_fallback' | 'disable_only' | 'delete_history_item' = 'restore_fallback') => {
    if (!ruleToDelete || !onUpdateReserve) {
      if (!onUpdateReserve) toast.error('Ação de atualização de reserva indisponível.');
      return;
    }
    const reserve = reserveMap[ruleToDelete.reserve_id];
    if (!reserve) {
      toast.error('Reserva não encontrada.');
      return;
    }

    try {
      setIsDeletingRule(true);

      if (ruleToDelete.isCurrentActive) {
        if (mode === 'restore_fallback' && fallbackRuleCandidate) {
          // INTELLIGENT FALLBACK: Restore the previous historical rule automatically as active
          const currentHist = Array.isArray(reserve.rule_history) ? [...reserve.rule_history] : [];
          const candidateIdx = fallbackRuleCandidate.historyIndex !== undefined 
            ? fallbackRuleCandidate.historyIndex 
            : (currentHist.length - 1);
          
          // Remove the restored rule snapshot from historical array to prevent duplication
          const remainingHistory = currentHist.filter((_, idx) => idx !== candidateIdx);

          const payload: Partial<Reserve> = {
            regra_tipo: fallbackRuleCandidate.regra_tipo as any,
            regra_base: fallbackRuleCandidate.regra_base || 'lucro',
            regra_valor: Number(fallbackRuleCandidate.regra_valor),
            regra_categorias: fallbackRuleCandidate.regra_categorias || [],
            regra_ativa: fallbackRuleCandidate.regra_ativa !== false,
            regra_inicio_validade: getTodayLocalDateStr(),
            regra_inicio_hora: getCurrentLocalTimeStr(),
            rule_history: remainingHistory,
            updated_at: new Date().toISOString()
          };

          await onUpdateReserve(ruleToDelete.reserve_id, payload);
          toast.success(`Regra anterior ("${getRuleFormulaLabel(fallbackRuleCandidate.regra_tipo, fallbackRuleCandidate.regra_valor)}") reativada automaticamente em vigor!`);
        } else {
          // User chose to disable automation completely without restoring
          await onUpdateReserve(ruleToDelete.reserve_id, {
            regra_tipo: null,
            regra_valor: 0,
            regra_ativa: false,
            regra_categorias: [],
            updated_at: new Date().toISOString()
          });
          toast.info('Regra em vigor desativada da reserva.');
        }
      } else {
        // Removing historical record from reserve.rule_history array
        const currentHistory = Array.isArray(reserve.rule_history) ? [...reserve.rule_history] : [];
        let newHistory: any[] = [];

        if (ruleToDelete.historyIndex !== undefined && ruleToDelete.historyIndex >= 0) {
          newHistory = currentHistory.filter((_, idx) => idx !== ruleToDelete.historyIndex);
        } else {
          newHistory = currentHistory.filter(h => h.updated_at !== ruleToDelete.updated_at && h.start_date !== ruleToDelete.start_date);
        }

        await onUpdateReserve(ruleToDelete.reserve_id, {
          rule_history: newHistory,
          updated_at: new Date().toISOString()
        });
        toast.success('Registro histórico de regra excluído com sucesso!');
      }

      setRuleToDelete(null);
      if (ruleToViewDetails) setRuleToViewDetails(null);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao excluir regra: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsDeletingRule(false);
    }
  };

  return (
    <div className="space-y-4 text-left">
      {/* 1. Barra de Períodos & Navegação (Idêntica ao Dashboard) */}
      <div className="bg-card border border-border/70 p-3.5 sm:p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-foreground tracking-tight">
                  {getHistoryPeriodLabel()}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {periodStart && periodEnd
                    ? `${format(periodStart, 'dd/MM/yyyy')} — ${format(periodEnd, 'dd/MM/yyyy')}`
                    : 'Todo o período registrado'}
                </span>
              </div>
              <p className="text-[10.5px] text-muted-foreground font-medium capitalize mt-0.5">
                Hoje: {format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Controles de Avanço / Retrocesso de Período */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleStepHistoryPeriod(-1)}
              className="h-8 px-2.5 rounded-xl border border-border/70 bg-muted/20 hover:bg-muted text-xs font-bold text-foreground flex items-center gap-1 transition-all cursor-pointer"
              title="Período / Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Anterior</span>
            </button>

            {historyPeriod !== 'month' && (
              <button
                type="button"
                onClick={() => {
                  setHistoryPeriod('month');
                  setVisibleCount(15);
                }}
                className="h-8 px-2.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-[11px] font-extrabold text-primary flex items-center gap-1 transition-all cursor-pointer"
                title="Voltar para o Mês Atual"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Mês Atual</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleStepHistoryPeriod(1)}
              className="h-8 px-2.5 rounded-xl border border-border/70 bg-muted/20 hover:bg-muted text-xs font-bold text-foreground flex items-center gap-1 transition-all cursor-pointer"
              title="Próximo Período / Mês"
            >
              <span className="hidden xs:inline">Próximo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Botões Rápidos de Período (Mesmos botões e ordem do Dashboard + Todo Histórico) */}
        <div className="flex overflow-x-auto scrollbar-none gap-1.5 p-1 bg-muted/25 border border-border/40 rounded-xl w-full max-w-full">
          {[
            { id: 'today', label: 'Hoje' },
            { id: 'last7Days', label: '7 dias' },
            { id: 'last30Days', label: '30 dias' },
            { id: 'last90Days', label: '90 dias' },
            { id: 'lastMonth', label: 'Mês Passado' },
            { id: 'month', label: 'Mês Atual' },
            { id: 'nextMonth', label: 'Próx. Mês' },
            { id: 'thisYear', label: 'Este Ano' },
            { id: 'lastYear', label: 'Ano Passado' },
            { id: 'all', label: 'Todo Histórico' },
            { id: 'custom', label: 'Personalizado' }
          ].map((period) => {
            const isSelected = historyPeriod === period.id;
            return (
              <button
                key={period.id}
                type="button"
                onClick={() => {
                  setHistoryPeriod(period.id);
                  setVisibleCount(15);
                }}
                className="relative px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap focus:outline-none shrink-0 text-center active:scale-95 cursor-pointer"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {isSelected && (
                  <motion.span
                    layoutId="reserve-history-active-period"
                    className="absolute inset-0 bg-background border border-border/60 shadow-xs rounded-lg"
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  />
                )}
                <span className={`relative z-10 transition-colors duration-200 ${
                  isSelected ? 'text-foreground font-black' : 'text-muted-foreground hover:text-foreground'
                }`}>
                  {period.label}
                </span>
              </button>
            );
          })}
        </div>

        {historyPeriod === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 animate-in fade-in slide-in-from-top-2">
            <span className="text-muted-foreground text-xs font-bold">Intervalo de Datas:</span>
            <input
              type="date"
              className="bg-background border border-border/60 rounded-xl px-2.5 py-1.5 text-base sm:text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer"
              value={customDateRange?.start || ''}
              onChange={(e) => {
                setCustomDateRange({
                  start: e.target.value,
                  end: customDateRange?.end || getTodayLocalDateStr()
                });
                setVisibleCount(15);
              }}
            />
            <span className="text-muted-foreground text-xs font-bold">até</span>
            <input
              type="date"
              className="bg-background border border-border/60 rounded-xl px-2.5 py-1.5 text-base sm:text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer"
              value={customDateRange?.end || ''}
              onChange={(e) => {
                setCustomDateRange({
                  start: customDateRange?.start || getTodayLocalDateStr(),
                  end: e.target.value
                });
                setVisibleCount(15);
              }}
            />
          </div>
        )}
      </div>

      {/* 1B. Quick 1-Tap Reserve Selector Pills */}
      {reserves.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          <button
            type="button"
            onClick={() => {
              setSelectedReserveId('all');
              setVisibleCount(15);
            }}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 ${
              selectedReserveId === 'all'
                ? 'bg-foreground text-background border-foreground shadow-2xs'
                : 'bg-card/80 text-muted-foreground border-border/70 hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <PiggyBank className="w-3.5 h-3.5" />
            <span>Todas as Reservas</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              selectedReserveId === 'all' ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground'
            }`}>
              {Object.values(reserveTxCounts).reduce((a, b) => a + b, 0)}
            </span>
          </button>

          {reserves.map(r => {
            const isSelected = selectedReserveId === r.id;
            const txCount = reserveTxCounts[r.id] || 0;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedReserveId(isSelected ? 'all' : r.id);
                  setVisibleCount(15);
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-card/80 text-foreground border-border/70 hover:border-border hover:bg-muted/50'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/40"
                  style={{ backgroundColor: r.color || '#6366f1' }}
                />
                <span className="truncate max-w-[120px]">{r.name}</span>
                <span className={`text-[10px] font-mono font-semibold ${
                  isSelected ? 'text-white/85' : 'text-muted-foreground'
                }`}>
                  {hideValues ? '••••' : formatCurrency(Number(r.saldo_atual || 0))}
                </span>
                {txCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {txCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 2. Extrato Bento Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total Aportes Card */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Total Aportes
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {summary.countAportes}x
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
            {hideValues ? 'R$ •••••' : formatCurrency(summary.totalAportesTotal)}
          </p>
          <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 pt-1 border-t border-emerald-500/10 font-medium">
            <span>Manuais: <strong>{hideValues ? '••••' : formatCurrency(summary.totalAportesManuais)}</strong></span>
            {summary.totalAportesSugeridos > 0 && (
              <span>• Sugeridos: <strong>{hideValues ? '••••' : formatCurrency(summary.totalAportesSugeridos)}</strong></span>
            )}
            {summary.totalAportesMassa > 0 && (
              <span>• Lote: <strong>{hideValues ? '••••' : formatCurrency(summary.totalAportesMassa)}</strong></span>
            )}
            {summary.totalBoostExtra > 0 && (
              <span className="text-orange-600 dark:text-orange-400 font-bold inline-flex items-center gap-0.5">
                • 🚀 Boost: +{hideValues ? '••••' : formatCurrency(summary.totalBoostExtra)}
              </span>
            )}
          </div>
        </div>

        {/* Total Resgates/Utilizações Card */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Resgates / Uso
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
              {summary.countUtilizacoes}x
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">
            {hideValues ? 'R$ •••••' : formatCurrency(summary.totalUtilizacoes)}
          </p>
          <div className="text-[10px] text-muted-foreground pt-1 border-t border-rose-500/10 font-medium flex flex-wrap gap-x-2 gap-y-0.5">
            {summary.totalTransferToCash > 0 ? (
              <span>P/ Caixa: <strong className="text-emerald-600 dark:text-emerald-400">{hideValues ? '••••' : formatCurrency(summary.totalTransferToCash)}</strong></span>
            ) : (
              <span>Gastos cobertos pelas reservas</span>
            )}
          </div>
        </div>

        {/* Total Rendimentos Card */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Rendimentos
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
              {summary.countRendimentos}x
            </span>
          </div>
          <p className="text-base sm:text-xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">
            {hideValues ? 'R$ •••••' : `+${formatCurrency(summary.totalRendimentos)}`}
          </p>
          <div className="text-[10px] text-muted-foreground pt-1 border-t border-blue-500/10 font-medium flex items-center justify-between">
            <span>
              {summary.yieldSharePct > 0
                ? `${summary.yieldSharePct}% das entradas`
                : 'Lucros & CDI acumulados'}
            </span>
          </div>
        </div>

        {/* Saldo Líquido & Pendências / Regras Card */}
        <div className={`p-3.5 sm:p-4 rounded-2xl border space-y-1.5 shadow-2xs ${
          summary.netFlow >= 0 
            ? 'bg-indigo-500/5 border-indigo-500/20' 
            : 'bg-amber-500/5 border-amber-500/20'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
              summary.netFlow >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'
            }`}>
              <DollarSign className="w-3.5 h-3.5" />
              Fluxo Líquido
            </span>
            <span className="text-[10px] font-bold text-muted-foreground">
              {summary.totalCount} reg.
            </span>
          </div>
          <p className={`text-base sm:text-xl font-black font-mono tracking-tight ${
            summary.netFlow >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'
          }`}>
            {hideValues ? 'R$ •••••' : `${summary.netFlow >= 0 ? '+' : ''}${formatCurrency(summary.netFlow)}`}
          </p>
          <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/40 font-medium flex items-center justify-between gap-1 flex-wrap">
            {summary.countPending > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                ⏳ {summary.countPending} pend. ({hideValues ? '••••' : formatCurrency(summary.totalPendingAmount)})
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <strong>{summary.countRuleUpdates}</strong> regras
              </span>
            )}
            <span className={`font-bold ${summary.netFlow >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
              {summary.netFlow >= 0 ? 'Saldo +' : 'Saldo -'}
            </span>
          </div>
        </div>
      </div>

      {/* 2B. Raio-X Visual do Extrato (Fluxo Mensal / Rendimentos / Por Reserva) */}
      {(monthlyAnalytics.flowSeries.length > 0 || reserveBreakdown.length > 0) && (
        <div className="bg-card border border-border/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-black text-foreground tracking-tight">
                    Raio-X Visual do Extrato
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    Últimos 12 meses
                  </span>
                </div>
                <p className="text-[10.5px] text-muted-foreground font-medium">
                  {selectedReserveId !== 'all'
                    ? `Histórico consolidado de ${reserveMap[selectedReserveId]?.name || 'Reserva selecionada'}`
                    : 'Evolução de entradas, saídas, rendimentos e divisão por reserva'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2">
              {showMonthlyYieldChart && (
                <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border/60">
                  {[
                    { id: 'flow' as const, label: 'Fluxo Mensal' },
                    { id: 'yield' as const, label: 'Rendimentos' },
                    { id: 'reserves' as const, label: 'Por Reserva' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setChartTab(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                        chartTab === tab.id
                          ? 'bg-background text-foreground shadow-2xs border border-border/70'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowMonthlyYieldChart(prev => !prev)}
                className="px-2.5 py-1.5 rounded-xl border border-border/70 bg-muted/30 hover:bg-muted text-[11px] font-bold text-foreground flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <span>{showMonthlyYieldChart ? 'Ocultar' : 'Exibir'}</span>
                {showMonthlyYieldChart ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {showMonthlyYieldChart && (
            <>
              {chartTab === 'flow' && (
                monthlyAnalytics.flowSeries.length === 0 ? (
                  <div className="p-4 rounded-xl bg-muted/20 border border-dashed border-border text-center text-xs text-muted-foreground">
                    Nenhuma movimentação liquidada registrada para o período selecionado.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-bold text-muted-foreground px-1">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                          Aportes
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 inline-block" />
                          Rendimentos
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                          Resgates
                        </span>
                      </div>
                      <span className="text-[10px] font-medium">Últimos {monthlyAnalytics.flowSeries.length} meses com movimento</span>
                    </div>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyAnalytics.flowSeries} margin={{ top: 8, right: 8, left: -12, bottom: 2 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                          <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10.5, fill: '#71717a', fontWeight: 700 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }}
                            tickFormatter={(val) => (hideValues ? '•••' : `R$ ${Math.round(val)}`)}
                          />
                          <RechartsTooltip
                            cursor={{ fill: 'rgba(99, 102, 241, 0.07)' }}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              borderColor: 'hsl(var(--border))',
                              borderRadius: '12px',
                              fontSize: '12px'
                            }}
                            labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullLabel || _label}
                            formatter={(val: any, name: any) => [
                              hideValues ? 'R$ •••••' : formatCurrency(Number(val)),
                              name
                            ]}
                          />
                          <Bar dataKey="aportes" name="Aportes" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                          <Bar dataKey="rendimentos" name="Rendimentos" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={24} />
                          <Bar dataKey="resgates" name="Resgates" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )
              )}

              {chartTab === 'yield' && (
                monthlyAnalytics.yieldSeries.length === 0 ? (
                  <div className="p-4 rounded-xl bg-muted/20 border border-dashed border-border text-center text-xs text-muted-foreground">
                    Nenhum rendimento liquidado registrado para os filtros atuais.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground px-1">
                      <span>
                        Média/mês:{' '}
                        <strong className="font-mono font-black text-blue-600 dark:text-blue-400 tabular-nums">
                          {hideValues ? 'R$ •••' : formatCurrency(monthlyAnalytics.avgMonthlyYield)}
                        </strong>
                      </span>
                      {monthlyAnalytics.bestMonthYield && (
                        <span>
                          Melhor ({monthlyAnalytics.bestMonthYield.label}):{' '}
                          <strong className="font-mono font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {hideValues ? 'R$ •••' : formatCurrency(monthlyAnalytics.bestMonthYield.total)}
                          </strong>
                        </span>
                      )}
                    </div>
                    <div className="h-[190px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyAnalytics.yieldSeries} margin={{ top: 8, right: 10, left: -12, bottom: 2 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                          <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10.5, fill: '#71717a', fontWeight: 700 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#71717a', fontWeight: 600 }}
                            tickFormatter={(val) => (hideValues ? '•••' : `R$ ${Math.round(val)}`)}
                          />
                          <RechartsTooltip
                            cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              borderColor: 'hsl(var(--border))',
                              borderRadius: '12px',
                              fontSize: '12px'
                            }}
                            labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullLabel || _label}
                            formatter={(val: any) => [
                              hideValues ? 'R$ •••••' : formatCurrency(Number(val)),
                              'Rendimento no mês'
                            ]}
                          />
                          <Bar
                            dataKey="total"
                            name="Rendimento"
                            fill="#3b82f6"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={44}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )
              )}

              {chartTab === 'reserves' && (
                reserveBreakdown.length === 0 ? (
                  <div className="p-4 rounded-xl bg-muted/20 border border-dashed border-border text-center text-xs text-muted-foreground">
                    Nenhuma reserva com saldo ou movimentação no período.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {reserveBreakdown.map(row => {
                      const isRowSelected = selectedReserveId === row.reserve.id;
                      return (
                        <button
                          key={row.reserve.id}
                          type="button"
                          onClick={() => {
                            setSelectedReserveId(isRowSelected ? 'all' : row.reserve.id);
                            setVisibleCount(15);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                            isRowSelected
                              ? 'bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/30'
                              : 'bg-muted/25 border-border/70 hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: row.reserve.color || '#6366f1' }}
                              />
                              <span className="text-xs font-black text-foreground truncate">{row.reserve.name}</span>
                              <span className="text-[10px] font-bold text-muted-foreground">({row.txCount})</span>
                            </div>
                            <span className="text-xs font-mono font-black text-foreground shrink-0">
                              {hideValues ? 'R$ •••' : formatCurrency(Number(row.reserve.saldo_atual || 0))}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] font-mono">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              +{hideValues ? '•••' : formatCurrency(row.aportes)} ap.
                            </span>
                            {row.boostExtras > 0 && (
                              <span className="text-orange-600 dark:text-orange-400 font-bold">
                                🚀+{hideValues ? '•••' : formatCurrency(row.boostExtras)}
                              </span>
                            )}
                            {row.rendimentos > 0 && (
                              <span className="text-blue-600 dark:text-blue-400 font-bold">
                                +{hideValues ? '•••' : formatCurrency(row.rendimentos)} rend.
                              </span>
                            )}
                            {row.resgates > 0 && (
                              <span className="text-rose-600 dark:text-rose-400 font-bold">
                                -{hideValues ? '•••' : formatCurrency(row.resgates)} resg.
                              </span>
                            )}
                            <span className={`ml-auto font-black ${
                              row.netFlow >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'
                            }`}>
                              Líq: {row.netFlow >= 0 ? '+' : ''}{hideValues ? '•••' : formatCurrency(row.netFlow)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}

      {/* 3. Search & Main Filter Controls */}
      <div className="bg-card p-3 sm:p-4 rounded-2xl border border-border/80 shadow-xs space-y-3">
        {/* Search Bar + Quick Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por reserva, categoria, descrição ou valor..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setVisibleCount(15);
              }}
              className="pl-9 pr-8 h-9 text-base sm:text-xs rounded-xl bg-background border-border/80"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Advanced Filters Button */}
            <Button
              variant={showAdvancedFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowAdvancedFilters(prev => !prev)}
              className={`h-9 px-3 text-xs font-bold rounded-xl gap-1.5 cursor-pointer ${
                showAdvancedFilters ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'border-border/80'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros Avançados</span>
              {activeAdvancedFiltersCount > 0 && (
                <span className={`px-1.5 py-0.2 text-[10px] font-black rounded-full ${
                  showAdvancedFilters
                    ? 'bg-white/20 text-white'
                    : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                }`}>
                  {activeAdvancedFiltersCount}
                </span>
              )}
            </Button>

            {/* Export CSV Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 border-border/80 hover:bg-muted cursor-pointer"
              title="Exportar registros filtrados para planilha CSV"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
          </div>
        </div>

        {/* Quick Type Selection Chips (Default: Aportes) */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 pt-0.5">
          {[
            { id: 'aporte', label: 'Aportes', icon: ArrowDownLeft },
            { id: 'all', label: 'Todos', icon: Layers },
            { id: 'manual_aporte', label: 'Manuais', icon: PiggyBank },
            { id: 'suggestion_aporte', label: 'Sugeridos', icon: Sparkles },
            { id: 'mass_aporte', label: 'Em Lote', icon: Zap },
            ...(totalBoostAportesCount > 0 ? [{ id: 'boost_aporte', label: `Com Boost (${totalBoostAportesCount})`, icon: Rocket, isBoost: true }] : []),
            { id: 'utilizacao', label: 'Resgates', icon: ArrowUpRight },
            { id: 'rendimento', label: 'Rendimentos', icon: TrendingUp },
            ...(totalPendingCount > 0 ? [{ id: 'pending_only', label: `Pendentes (${totalPendingCount})`, icon: Clock, isPending: true }] : []),
            { id: 'rule_change', label: `Histórico de Regras (${totalSystemRuleUpdates})`, icon: Sliders, isSpecial: true },
          ].map((chip: any) => {
            const isSelected = selectedType === chip.id;
            const ChipIcon = chip.icon;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  setSelectedType(chip.id);
                  setVisibleCount(15);
                }}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer border active:scale-95 flex items-center gap-1.5 shrink-0 ${
                  isSelected 
                    ? chip.isBoost
                      ? 'bg-orange-500 text-white border-orange-500 shadow-2xs font-black'
                      : chip.isPending
                      ? 'bg-amber-500 text-white border-amber-500 shadow-2xs font-black'
                      : 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-black'
                    : chip.isBoost
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 hover:bg-orange-500/20'
                    : chip.isPending
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                    : chip.isSpecial
                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20'
                      : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/80'
                }`}
              >
                <ChipIcon className="w-3 h-3" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* Advanced Filters Expandable Drawer */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden pt-2.5 border-t border-border/60 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-left">
                {/* 1. Tipo de Lançamento */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-500" />
                    Tipo de Lançamento
                  </label>
                  <Select
                    value={selectedType}
                    onValueChange={v => {
                      setSelectedType(v);
                      setVisibleCount(15);
                    }}
                  >
                    <SelectTrigger className="h-9 text-base sm:text-xs font-semibold rounded-xl bg-background border-border/80">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent align="start" className="text-xs">
                      <SelectItem value="aporte">Aportes (Padrão)</SelectItem>
                      <SelectItem value="all">Todos os registros e regras</SelectItem>
                      <SelectItem value="transactions_only">Todas as movimentações</SelectItem>
                      <SelectItem value="manual_aporte">Aportes manuais</SelectItem>
                      <SelectItem value="suggestion_aporte">Aportes sugeridos</SelectItem>
                      <SelectItem value="mass_aporte">Aportes em lote</SelectItem>
                      <SelectItem value="boost_aporte">Aportes com Modo Boost</SelectItem>
                      <SelectItem value="utilizacao">Resgates e transferências</SelectItem>
                      <SelectItem value="rendimento">Rendimentos e lucros</SelectItem>
                      <SelectItem value="pending_only">Somente pendentes</SelectItem>
                      <SelectItem value="rule_change">Histórico de regras</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Reserva */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                    <PiggyBank className="w-3.5 h-3.5 text-indigo-500" />
                    Reserva
                  </label>
                  <Select 
                    value={selectedReserveId} 
                    onValueChange={v => {
                      setSelectedReserveId(v);
                      setVisibleCount(15);
                    }}
                  >
                    <SelectTrigger className="h-9 text-base sm:text-xs font-semibold rounded-xl bg-background border-border/80">
                      <SelectValue placeholder="Todas as reservas" />
                    </SelectTrigger>
                    <SelectContent align="start" className="text-xs">
                      <SelectItem value="all">Todas as reservas</SelectItem>
                      {reserves.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-2.5 h-2.5 rounded-full shrink-0" 
                              style={{ backgroundColor: r.color || '#6366f1' }}
                            />
                            <span className="truncate">{r.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Categoria */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-500" />
                    Categoria
                  </label>
                  <Select 
                    value={selectedCategory} 
                    onValueChange={v => {
                      setSelectedCategory(v);
                      setVisibleCount(15);
                    }}
                  >
                    <SelectTrigger className="h-9 text-base sm:text-xs font-semibold rounded-xl bg-background border-border/80">
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                    <SelectContent align="start" className="text-xs max-h-56">
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {uniqueCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 4. Situação */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Situação do Lançamento
                  </label>
                  <Select 
                    value={selectedPaymentStatus} 
                    onValueChange={(v: 'all' | 'paid' | 'pending') => {
                      setSelectedPaymentStatus(v);
                      setVisibleCount(15);
                    }}
                  >
                    <SelectTrigger className="h-9 text-base sm:text-xs font-semibold rounded-xl bg-background border-border/80">
                      <SelectValue placeholder="Todas as situações" />
                    </SelectTrigger>
                    <SelectContent align="start" className="text-xs">
                      <SelectItem value="all">Liquidados e pendentes</SelectItem>
                      <SelectItem value="paid">Somente liquidados</SelectItem>
                      <SelectItem value="pending">Somente pendentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 5. Ordenar por */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-amber-500" />
                    Ordenar por
                  </label>
                  <Select 
                    value={sortBy} 
                    onValueChange={(v: any) => {
                      setSortBy(v);
                      setVisibleCount(15);
                    }}
                  >
                    <SelectTrigger className="h-9 text-base sm:text-xs font-semibold rounded-xl bg-background border-border/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start" className="text-xs">
                      <SelectItem value="date_desc">Mais recentes primeiro</SelectItem>
                      <SelectItem value="date_asc">Mais antigos primeiro</SelectItem>
                      <SelectItem value="amount_desc">Maior valor primeiro</SelectItem>
                      <SelectItem value="amount_asc">Menor valor primeiro</SelectItem>
                      <SelectItem value="reserve_asc">Nome da reserva (A–Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 6. Faixa de Valor */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-blue-500" />
                    Faixa de Valor
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground pointer-events-none">
                        R$
                      </span>
                      <Input
                        placeholder="Mínimo"
                        type="number"
                        inputMode="decimal"
                        value={minValue}
                        onChange={e => {
                          setMinValue(e.target.value);
                          setVisibleCount(15);
                        }}
                        className="h-9 pl-7 pr-2 text-base sm:text-xs rounded-xl bg-background border-border/80 font-mono"
                      />
                    </div>
                    <span className="text-muted-foreground text-xs font-bold">–</span>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground pointer-events-none">
                        R$
                      </span>
                      <Input
                        placeholder="Máximo"
                        type="number"
                        inputMode="decimal"
                        value={maxValue}
                        onChange={e => {
                          setMaxValue(e.target.value);
                          setVisibleCount(15);
                        }}
                        className="h-9 pl-7 pr-2 text-base sm:text-xs rounded-xl bg-background border-border/80 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* View options and Reset */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupByDate(prev => !prev)}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-xl border transition-all cursor-pointer ${
                      groupByDate 
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' 
                        : 'bg-muted text-muted-foreground border-border/60'
                    }`}
                  >
                    {groupByDate ? '✓ Agrupado por mês' : 'Lista contínua'}
                  </button>
                </div>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-8 px-2.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 font-bold gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar padrão (Mês Atual · Aportes)
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Filter Tags */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
            <span className="text-muted-foreground font-medium">Filtros ativos:</span>
            {historyPeriod !== 'month' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold">
                Período: {getPeriodDisplayLabel(historyPeriod, customDateRange)}
                <button type="button" onClick={() => setHistoryPeriod('month')} className="hover:text-indigo-800 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedReserveId !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold">
                Reserva: {reserveMap[selectedReserveId]?.name || selectedReserveId}
                <button type="button" onClick={() => setSelectedReserveId('all')} className="hover:text-indigo-800 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedType !== 'aporte' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                Tipo: {(
                  {
                    all: 'Todos os registros',
                    rule_change: 'Histórico de regras',
                    transactions_only: 'Movimentações',
                    aporte: 'Aportes',
                    manual_aporte: 'Manuais',
                    suggestion_aporte: 'Sugeridos',
                    mass_aporte: 'Em lote',
                    boost_aporte: 'Com Boost',
                    utilizacao: 'Resgates',
                    rendimento: 'Rendimentos',
                    pending_only: 'Pendentes',
                  } as Record<string, string>
                )[selectedType] || selectedType}
                <button type="button" onClick={() => setSelectedType('aporte')} className="hover:text-emerald-800 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedPaymentStatus !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">
                Situação: {selectedPaymentStatus === 'pending' ? 'Pendentes' : 'Liquidados'}
                <button type="button" onClick={() => setSelectedPaymentStatus('all')} className="hover:text-amber-800 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">
                Categoria: {selectedCategory}
                <button type="button" onClick={() => setSelectedCategory('all')} className="hover:text-amber-800 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {(minValue !== '' || maxValue !== '') && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold">
                Valor: R$ {minValue || '0'} até {maxValue ? `R$ ${maxValue}` : '∞'}
                <button type="button" onClick={() => { setMinValue(''); setMaxValue(''); }} className="hover:text-blue-800 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-foreground border border-border font-bold">
                Busca: &quot;{searchTerm}&quot;
                <button type="button" onClick={() => setSearchTerm('')} className="hover:text-foreground cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline font-bold ml-1 cursor-pointer"
            >
              Restaurar padrão
            </button>
          </div>
        )}
      </div>

      {/* 4. Unified List & Grouped Feed */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-10 sm:p-14 text-center bg-card border border-dashed border-border/80 rounded-3xl space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto shadow-2xs">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-foreground">Nenhum registro encontrado</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Não há lançamentos para o filtro atual ({getHistoryPeriodLabel()} · {selectedType === 'aporte' ? 'Aportes' : 'Filtro personalizado'}). Tente ver todos os tipos ou expandir para todo o histórico.
              </p>
            </div>

            {/* Quick resolution CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {selectedType !== 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedType('all');
                    setVisibleCount(15);
                  }}
                  className="h-8 px-4 text-xs font-bold rounded-xl gap-1.5 cursor-pointer"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Ver Todos os Tipos
                </Button>
              )}
              {historyPeriod !== 'all' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setHistoryPeriod('all');
                    setVisibleCount(15);
                  }}
                  className="h-8 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Mostrar Todo o Histórico ({unifiedItems.length})
                </Button>
              )}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-8 px-4 text-xs font-bold rounded-xl gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar Padrão
                </Button>
              )}
            </div>
          </div>
        ) : groupByDate && groupedItems ? (
          /* Grouped View */
          groupedItems.map(group => (
            <div key={group.key} className="space-y-2">
              {/* Group Month Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-2 text-xs font-black text-foreground">
                <div className="flex items-center gap-2 flex-wrap">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{group.label}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground">
                    {group.items.length} {group.items.length === 1 ? 'registro' : 'registros'}
                  </span>
                  {group.ruleCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      ⚙️ {group.ruleCount} {group.ruleCount === 1 ? 'regra' : 'regras'}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono font-bold text-muted-foreground flex items-center gap-2 flex-wrap">
                  {group.subtotalIn > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400">+{hideValues ? '••••' : formatCurrency(group.subtotalIn)}</span>
                  )}
                  {group.subtotalOut > 0 && (
                    <span className="text-rose-600 dark:text-rose-400">-{hideValues ? '••••' : formatCurrency(group.subtotalOut)}</span>
                  )}
                  {(group.subtotalIn > 0 || group.subtotalOut > 0) && (
                    <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-black ${
                      group.netMonth >= 0
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    }`}>
                      = {group.netMonth >= 0 ? '+' : ''}{hideValues ? '••••' : formatCurrency(group.netMonth)}
                    </span>
                  )}
                </div>
              </div>

              {/* Items in Group */}
              <div className="space-y-2">
                {group.items.map(item => (
                  item.kind === 'transaction' 
                    ? renderTransactionCard(item.tx)
                    : renderRuleUpdateCard(item.rule)
                ))}
              </div>
            </div>
          ))
        ) : (
          /* Continuous Flat List */
          <div className="space-y-2">
            {visibleItems.map(item => (
              item.kind === 'transaction' 
                ? renderTransactionCard(item.tx)
                : renderRuleUpdateCard(item.rule)
            ))}
          </div>
        )}

        {/* Chunked Loading / Carregar Mais Button */}
        {filteredItems.length > visibleCount && (
          <div className="flex flex-col items-center justify-center pt-3 pb-6 space-y-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider gap-2 hover:bg-indigo-500/5 hover:text-indigo-600 border border-border/80 shadow-xs transition-all duration-200 cursor-pointer"
              onClick={() => setVisibleCount(prev => prev + 15)}
            >
              <ChevronDown className="w-4 h-4 text-indigo-500 animate-bounce" />
              Carregar Mais Registros ({filteredItems.length - visibleCount} restantes)
            </Button>
            <p className="text-[10px] text-muted-foreground font-semibold">
              Exibindo {visibleItems.length} de {filteredItems.length} registros filtrados
            </p>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODALS */}
      {/* ---------------------------------------------------- */}

      {/* 1. Rule Detail & Inspection Modal */}
      {ruleToViewDetails && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-md my-auto rounded-3xl border border-border/80 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-left">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: reserveMap[ruleToViewDetails.reserve_id]?.color || '#6366f1' }}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Atualização de Regra</h3>
                  <p className="text-xs text-muted-foreground">{reserveMap[ruleToViewDetails.reserve_id]?.name || 'Reserva'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRuleToViewDetails(null)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formula Banner */}
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1">
                <Calculator className="w-3 h-3" />
                {getRuleTypeName(ruleToViewDetails.regra_tipo)}
              </span>
              <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                {getRuleFormulaLabel(ruleToViewDetails.regra_tipo, ruleToViewDetails.regra_valor)}
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                  ruleToViewDetails.isCurrentActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-muted text-muted-foreground border-border'
                }`}>
                  {ruleToViewDetails.isCurrentActive ? '● Em Vigor Atualmente' : '● Histórico de Vigência'}
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                  ruleToViewDetails.regra_ativa !== false
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                }`}>
                  {ruleToViewDetails.regra_ativa !== false ? 'Automação Ativa' : 'Automação Pausada'}
                </span>
              </div>
            </div>

            {/* Detailed Key-Value Specs */}
            <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/80 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Reserva:</span>
                <span className="font-bold text-foreground">{reserveMap[ruleToViewDetails.reserve_id]?.name || 'N/D'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Início da Vigência:</span>
                <span className="font-bold text-foreground font-mono">
                  {formatDateDisplay(ruleToViewDetails.start_date || ruleToViewDetails.date)}
                  {ruleToViewDetails.start_time ? ` às ${ruleToViewDetails.start_time}` : ''}
                </span>
              </div>
              {ruleToViewDetails.end_date ? (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Término da Vigência:</span>
                  <span className="font-bold text-foreground font-mono">
                    {formatDateDisplay(ruleToViewDetails.end_date)}
                    {ruleToViewDetails.end_time ? ` às ${ruleToViewDetails.end_time}` : ''}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Validade:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Ativa a partir desta data/hora</span>
                </div>
              )}
              {ruleToViewDetails.regra_categorias && ruleToViewDetails.regra_categorias.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-border/60">
                  <span className="text-muted-foreground">Categorias Monitoradas:</span>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {ruleToViewDetails.regra_categorias.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-background border border-border/60 font-semibold text-[11px]">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {ruleToViewDetails.description && (
                <div className="pt-2 border-t border-border/60 space-y-1">
                  <span className="text-muted-foreground text-[11px]">Observações:</span>
                  <p className="text-foreground font-medium bg-background p-2.5 rounded-xl border border-border/60 text-[11px]">
                    {ruleToViewDetails.description}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleOpenDeleteRule(ruleToViewDetails);
                  }}
                  className="h-8 px-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-rose-500/30 gap-1 cursor-pointer"
                  title={ruleToViewDetails.isCurrentActive ? 'Desativar / Excluir regra em vigor' : 'Excluir registro histórico'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{ruleToViewDetails.isCurrentActive ? 'Desativar' : 'Excluir'}</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleOpenEditRule(ruleToViewDetails);
                  }}
                  className="h-8 px-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 border-indigo-500/30 gap-1 cursor-pointer"
                  title={ruleToViewDetails.isCurrentActive ? 'Editar regra em vigor' : 'Editar registro histórico'}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </Button>
              </div>

              <Button
                variant="ghost"
                onClick={() => setRuleToViewDetails(null)}
                className="h-8 px-4 text-xs font-bold cursor-pointer"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Edit Rule Modal (Active Rule or Historical Record) */}
      {ruleToEdit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-lg my-auto rounded-3xl border border-border/80 shadow-2xl p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-left">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs shrink-0"
                  style={{ backgroundColor: reserveMap[ruleToEdit.reserve_id]?.color || '#6366f1' }}
                >
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">
                    {ruleToEdit.isCurrentActive ? 'Editar Regra em Vigor' : 'Editar Regra Histórica'}
                  </h3>
                  <p className="text-xs text-muted-foreground">{reserveMap[ruleToEdit.reserve_id]?.name || 'Reserva'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRuleToEdit(null)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 text-xs font-bold rounded-xl border flex items-center gap-1.5 ${
                ruleToEdit.isCurrentActive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-muted text-muted-foreground border-border'
              }`}>
                {ruleToEdit.isCurrentActive ? '✨ Regra Atual em Vigor' : '🕒 Registro de Vigência Histórica'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {ruleToEdit.isCurrentActive ? 'Configura o cálculo ativo de novos aportes' : 'Registro de auditoria temporal'}
              </span>
            </div>

            {/* Live Calculation Simulation Card */}
            {(() => {
              const sim = calculateRuleSimulation(editRuleType, editRuleValue, editRuleCategoryList, editRuleBase);
              return (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Simulação em Tempo Real (Últimos 30 dias)
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {sim.metricLabel}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-0.5">
                    <span className="text-xs text-muted-foreground font-medium">Aporte estimado gerado:</span>
                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
                      {formatCurrency(sim.estimate)}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Form */}
            <div className="space-y-3.5 text-xs max-h-[60vh] overflow-y-auto pr-1">
              {/* Rule Type / Calculation Base */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-bold flex items-center gap-1">
                  <Calculator className="w-3.5 h-3.5 text-indigo-500" />
                  Base de Cálculo da Regra:
                </label>
                <select
                  value={editRuleType}
                  onChange={e => setEditRuleType(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-background border border-border/80 font-medium text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="km">Por Km Rodado (R$/km)</option>
                  <option value="bruto">% do Faturamento Bruto</option>
                  <option value="liquido">% do Lucro Líquido</option>
                  <option value="fixo">Valor Fixo Diário (R$/dia)</option>
                  <option value="personalizado">Personalizado</option>
                </select>
              </div>

              {editRuleType === 'liquido' && (
                <div className="space-y-2 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <div className="text-[11px] font-bold text-foreground">
                    Despesas deduzidas da base:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditRuleBase('lucro')}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        editRuleBase === 'lucro'
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                          : 'bg-background border-border/80 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="font-bold text-[11px]">Lucro Operacional</div>
                      <div className="text-[10px] opacity-80 leading-tight">Só custos do trabalho</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditRuleBase('liquido')}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        editRuleBase === 'liquido'
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                          : 'bg-background border-border/80 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="font-bold text-[11px]">Lucro Líquido Geral</div>
                      <div className="text-[10px] opacity-80 leading-tight">Todas despesas reais</div>
                    </button>
                  </div>
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 leading-snug">
                    Resgates da reserva, gastos marcados com a reserva, investimentos e itens ignorados nos gráficos nunca reduzem a sugestão.
                  </p>
                </div>
              )}

              {/* Rule Value */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-bold flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                  Valor da Regra ({editRuleType === 'bruto' || editRuleType === 'liquido' ? '%' : 'R$'}):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editRuleValue}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9.,]/g, '');
                      setEditRuleValue(val);
                    }}
                    placeholder="Ex: 0.15 ou 10"
                    className="w-full h-10 pl-3 pr-10 rounded-xl bg-background border border-border/80 font-bold text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">
                    {editRuleType === 'bruto' || editRuleType === 'liquido' ? '%' : 'R$'}
                  </span>
                </div>
                {(editRuleType === 'bruto' || editRuleType === 'liquido') && parseFloat(String(editRuleValue || '').replace(',', '.')) > 100 && (
                  <p className="text-[10px] text-rose-500 font-bold">Atenção: Percentual não pode ser maior que 100%.</p>
                )}
              </div>

              {/* Start and End Date + Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-muted-foreground font-bold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      Início da Vigência:
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditRuleStartTime(getCurrentLocalTimeStr())}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Agora
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    <input
                      type="date"
                      value={editRuleStartDate}
                      onChange={e => setEditRuleStartDate(e.target.value)}
                      className="col-span-3 h-10 px-2.5 rounded-xl bg-background border border-border/80 font-medium text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                    <input
                      type="time"
                      value={editRuleStartTime}
                      onChange={e => setEditRuleStartTime(e.target.value)}
                      className="col-span-2 h-10 px-2 rounded-xl bg-background border border-border/80 font-medium text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground font-bold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    Término ({ruleToEdit.isCurrentActive ? 'Opcional / Futuro' : 'Vigência'}):
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    <input
                      type="date"
                      value={editRuleEndDate}
                      onChange={e => setEditRuleEndDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="col-span-3 h-10 px-2.5 rounded-xl bg-background border border-border/80 font-medium text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                    <input
                      type="time"
                      value={editRuleEndTime}
                      onChange={e => setEditRuleEndTime(e.target.value)}
                      disabled={!editRuleEndDate}
                      className="col-span-2 h-10 px-2 rounded-xl bg-background border border-border/80 font-medium text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* Monitored Categories with Interactive Quick-Chips */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground font-bold flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-indigo-500" />
                    Categorias Elegíveis para Aporte:
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllCategories}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                    >
                      Todas
                    </button>
                    <span className="text-muted-foreground/40">•</span>
                    <button
                      type="button"
                      onClick={handleClearCategories}
                      className="text-muted-foreground hover:text-foreground font-medium cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-xl border border-border/60 min-h-[44px]">
                  {profileIncomeCategories.map(cat => {
                    const isSelected = editRuleCategoryList.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleToggleEditCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-background hover:bg-muted text-muted-foreground border border-border/80'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto-archive previous active rule checkbox (only when editing active rule) */}
              {ruleToEdit.isCurrentActive && (
                <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/20 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editRuleAutoArchive}
                      onChange={e => setEditRuleAutoArchive(e.target.checked)}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-foreground block">
                        Arquivar versão anterior no Histórico
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        Preserva a regra antiga no extrato com data de encerramento, garantindo rastreabilidade contínua.
                      </span>
                    </div>
                  </label>

                  {editRuleAutoArchive && (
                    <div className="space-y-1 pt-1">
                      <label className="text-muted-foreground font-bold text-[11px]">Motivo do Reajuste (Opcional):</label>
                      <input
                        type="text"
                        value={editRuleChangeReason}
                        onChange={e => setEditRuleChangeReason(e.target.value)}
                        placeholder="Ex: Aumento no combustível / Reajuste de meta"
                        className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/80 font-medium text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Automation Active / Paused Toggle */}
              <div className="p-3 bg-muted/40 rounded-xl border border-border/60 flex items-center justify-between">
                <div>
                  <span className="font-bold text-foreground block">Status da Automação</span>
                  <span className="text-[10px] text-muted-foreground">Calcular sugestões automáticas com base nesta regra</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditRuleActive(!editRuleActive)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    editRuleActive
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {editRuleActive ? 'Ativa' : 'Pausada'}
                </button>
              </div>

              {/* Description / Notes (for historical record) */}
              {!ruleToEdit.isCurrentActive && (
                <div className="space-y-1">
                  <label className="text-muted-foreground font-bold">Observação Histórica:</label>
                  <input
                    type="text"
                    value={editRuleDescription}
                    onChange={e => setEditRuleDescription(e.target.value)}
                    placeholder="Ex: Regra reajustada devido ao aumento de combustível"
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border/80 font-medium text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                variant="ghost"
                onClick={() => setRuleToEdit(null)}
                disabled={isSavingRule}
                className="h-9 px-4 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveRuleEdit}
                disabled={isSavingRule}
                className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer gap-1.5"
              >
                {isSavingRule ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Delete Rule Confirmation Modal with INTELLIGENT FALLBACK */}
      {ruleToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-lg my-auto rounded-3xl border border-border/80 shadow-2xl p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-left">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border/60 pb-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                ruleToDelete.isCurrentActive && fallbackRuleCandidate
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
              }`}>
                {ruleToDelete.isCurrentActive && fallbackRuleCandidate ? (
                  <RotateCcw className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">
                  {ruleToDelete.isCurrentActive
                    ? (fallbackRuleCandidate ? 'Excluir Regra e Restaurar Anterior?' : 'Remover Regra em Vigor?')
                    : 'Excluir Registro Histórico?'}
                </h3>
                <p className="text-xs text-muted-foreground">{reserveMap[ruleToDelete.reserve_id]?.name || 'Reserva'}</p>
              </div>
            </div>

            {/* Context & Intelligent Fallback Card */}
            {ruleToDelete.isCurrentActive ? (
              fallbackRuleCandidate ? (
                <div className="space-y-3">
                  {/* Intelligent Fallback Badge & explanation */}
                  <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-black text-emerald-600 dark:text-emerald-400">
                      <Sparkles className="w-4 h-4" />
                      Fallback Automático Inteligente Disponível
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      Ao excluir a regra atual, o sistema pode promover automaticamente a <strong>regra anterior</strong> para o status de regra em vigor, mantendo suas sugestões ativas e sem perda de histórico.
                    </p>
                  </div>

                  {/* Side-by-side comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {/* Regra Atual */}
                    <div className="p-3 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <Trash2 className="w-3 h-3" />
                        Regra Atual (Excluir)
                      </span>
                      <div className="font-black text-foreground font-mono text-sm">
                        {getRuleFormulaLabel(ruleToDelete.regra_tipo, ruleToDelete.regra_valor)}
                      </div>
                      <span className="text-[10px] text-muted-foreground block">
                        Vigente desde {formatDateDisplay(ruleToDelete.start_date || ruleToDelete.date)}
                      </span>
                    </div>

                    {/* Regra Anterior */}
                    <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" />
                        Regra Anterior (Reativar)
                      </span>
                      <div className="font-black text-indigo-600 dark:text-indigo-400 font-mono text-sm">
                        {getRuleFormulaLabel(fallbackRuleCandidate.regra_tipo, fallbackRuleCandidate.regra_valor)}
                      </div>
                      <span className="text-[10px] text-muted-foreground block">
                        {fallbackRuleCandidate.description || 'Versão histórica arquivada'}
                      </span>
                    </div>
                  </div>

                  {/* Simulation of the restored rule */}
                  {(() => {
                    const sim = calculateRuleSimulation(
                      fallbackRuleCandidate.regra_tipo,
                      String(fallbackRuleCandidate.regra_valor),
                      fallbackRuleCandidate.regra_categorias || [],
                      fallbackRuleCandidate.regra_base
                    );
                    return (
                      <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-[11px] flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">Estimativa com a regra anterior (últimos 30d):</span>
                        <span className="font-bold text-foreground font-mono">{formatCurrency(sim.estimate)}</span>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-xs space-y-1.5">
                  <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    Única Regra Cadastrada
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Esta é a única regra configurada para a reserva <strong>{reserveMap[ruleToDelete.reserve_id]?.name}</strong>. Ao remover, a automação de sugestões será desativada até nova configuração.
                  </p>
                </div>
              )
            ) : (
              <div className="p-3.5 bg-rose-500/5 rounded-2xl border border-rose-500/20 text-xs space-y-1.5">
                <div className="font-bold text-foreground font-mono">
                  Registro: {getRuleFormulaLabel(ruleToDelete.regra_tipo, ruleToDelete.regra_valor)}
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Ao excluir este registro do histórico, ele será removido da auditoria de vigência. A regra atualmente em vigor NÃO será alterada.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                variant="ghost"
                onClick={() => setRuleToDelete(null)}
                disabled={isDeletingRule}
                className="h-9 px-4 text-xs font-bold cursor-pointer order-last sm:order-first"
              >
                Cancelar
              </Button>

              {ruleToDelete.isCurrentActive && fallbackRuleCandidate ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleDeleteRule('disable_only')}
                    disabled={isDeletingRule}
                    className="h-9 px-3 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-rose-500/30 cursor-pointer"
                  >
                    Desativar Sem Restaurar
                  </Button>
                  <Button
                    onClick={() => handleDeleteRule('restore_fallback')}
                    disabled={isDeletingRule}
                    className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {isDeletingRule ? 'Reativando...' : 'Reativar Regra Anterior (Recomendado)'}
                  </Button>
                </>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteRule(ruleToDelete.isCurrentActive ? 'disable_only' : 'delete_history_item')}
                  disabled={isDeletingRule}
                  className="h-9 px-4 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isDeletingRule ? 'Processando...' : ruleToDelete.isCurrentActive ? 'Desativar e Remover' : 'Confirmar Exclusão'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Transaction Detail Modal (Comprovante / Raio-X) */}
      {txToViewDetails && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-md my-auto rounded-3xl border border-border/80 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-left">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: reserveMap[txToViewDetails.reserve_id]?.color || '#6366f1' }}
                >
                  <PiggyBank className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Comprovante de Movimentação</h3>
                  <p className="text-xs text-muted-foreground">{reserveMap[txToViewDetails.reserve_id]?.name || 'Reserva'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTxToViewDetails(null)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Value Banner */}
            {(() => {
              const info = getTxCategoryInfo(txToViewDetails);
              const isTransfer = Boolean((info as any).isTransferToCash);
              const boostExtra = getBoostExtraFromRt(txToViewDetails);
              const isPending = txToViewDetails.payment_status === 'pending' || (txToViewDetails as any).status === 'pending';
              const balInfo = runningBalanceMap[txToViewDetails.id];
              return (
                <>
                  <div className={`p-4 rounded-2xl border text-center space-y-1 ${
                    isTransfer
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : txToViewDetails.type === 'utilizacao'
                      ? 'bg-rose-500/10 border-rose-500/20'
                      : txToViewDetails.type === 'rendimento'
                      ? 'bg-blue-500/10 border-blue-500/20'
                      : 'bg-emerald-500/10 border-emerald-500/20'
                  }`}>
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        {info.label}
                      </span>
                      <span className={`px-1.5 py-0.2 text-[9px] font-black rounded-full border ${
                        isPending
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      }`}>
                        {isPending ? '⏳ Pendente' : '✓ Liquidado'}
                      </span>
                      {boostExtra > 0 && (
                        <span className="px-1.5 py-0.2 text-[9px] font-black rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 inline-flex items-center gap-0.5">
                          <Rocket className="w-2.5 h-2.5" />
                          Boost +{hideValues ? '•••' : formatCurrency(boostExtra)}
                        </span>
                      )}
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black font-mono ${
                      isTransfer
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : txToViewDetails.type === 'utilizacao'
                        ? 'text-rose-600 dark:text-rose-400'
                        : txToViewDetails.type === 'rendimento'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {isTransfer ? '⇄ ' : (txToViewDetails.type === 'utilizacao' ? '-' : '+')}
                      {hideValues ? 'R$ •••••' : formatCurrency(txToViewDetails.amount)}
                    </div>
                    {isTransfer && (
                      <span className="text-[10px] font-mono text-emerald-600/80 dark:text-emerald-400/80 block">
                        Transferência de saldo para o Caixa Geral
                      </span>
                    )}
                  </div>

                  {/* Impacto no Saldo da Reserva */}
                  {balInfo && (
                    <div className="p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-between gap-2 text-xs">
                      <div className="text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Saldo Anterior</span>
                        <span className="font-mono font-bold text-foreground">
                          {hideValues ? 'R$ •••' : formatCurrency(balInfo.balanceBefore)}
                        </span>
                      </div>
                      <span className="text-indigo-500 font-black">➔</span>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          {isPending ? 'Saldo Previsto (Pendente)' : 'Saldo Após Lançamento'}
                        </span>
                        <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                          {isPending
                            ? (hideValues ? 'R$ •••' : formatCurrency(balInfo.balanceAfter))
                            : (hideValues ? 'R$ •••' : formatCurrency(balInfo.balanceAfter))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Detailed Key-Value Specs */}
                  <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/80 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Data e Hora:</span>
                      <span className="font-bold text-foreground font-mono">
                        {formatDateDisplay(txToViewDetails.date)}
                        {getEffectiveItemTime(txToViewDetails) ? ` às ${getEffectiveItemTime(txToViewDetails)}` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Reserva de Destino:</span>
                      <span className="font-bold text-foreground">{reserveMap[txToViewDetails.reserve_id]?.name || 'N/D'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Tipo de Operação:</span>
                      <span className="font-bold capitalize">{info.label}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status de Liquidação:</span>
                      <span className={`font-bold ${isPending ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {isPending
                          ? (txToViewDetails.due_date ? `Pendente (prev. ${formatDateDisplay(txToViewDetails.due_date)})` : 'Pendente')
                          : `Liquidado${txToViewDetails.payment_date ? ` em ${formatDateDisplay(txToViewDetails.payment_date)}` : ''}`}
                      </span>
                    </div>
                    {boostExtra > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Bônus Modo Boost:</span>
                        <span className="font-mono font-black text-orange-600 dark:text-orange-400">
                          +{hideValues ? 'R$ •••' : formatCurrency(boostExtra)}
                        </span>
                      </div>
                    )}
                    {txToViewDetails.category && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Categoria Associada:</span>
                        <span className="font-bold px-2 py-0.5 rounded-md bg-background border border-border/60">
                          {txToViewDetails.category}
                        </span>
                      </div>
                    )}
                    {txToViewDetails.source && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Canal de Origem:</span>
                        <span className="font-medium text-foreground">
                          {txToViewDetails.source === 'mass_contribution'
                            ? '⚡ Consolidador em Lote'
                            : txToViewDetails.source === 'automation'
                            ? '✨ Aporte Sugerido'
                            : '👤 Lançamento Direto'}
                        </span>
                      </div>
                    )}
                    {txToViewDetails.description && (
                      <div className="pt-2 border-t border-border/60 space-y-1">
                        <span className="text-muted-foreground text-[11px]">Descrição / Observações:</span>
                        <p className="text-foreground font-medium bg-background p-2.5 rounded-xl border border-border/60 text-[11px] break-words">
                          {txToViewDetails.description}
                        </p>
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-border/60 flex justify-between text-[10px] text-muted-foreground font-mono">
                      <span>ID: {txToViewDetails.id.substring(0, 16)}...</span>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              {onEditTransaction && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const tx = txToViewDetails;
                    setTxToViewDetails(null);
                    handleOpenEdit(tx);
                  }}
                  className="h-9 px-4 text-xs font-bold rounded-xl gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Editar
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => setTxToViewDetails(null)}
                className="h-9 px-4 text-xs font-bold cursor-pointer"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Edit Transaction Modal */}
      {txToEdit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-md my-auto rounded-3xl border border-border/80 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Editar Movimentação</h3>
                  <p className="text-xs text-muted-foreground">Atualize os valores ou observações do registro</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTxToEdit(null)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Valor */}
              <div className="space-y-1">
                <label className="font-bold text-foreground flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                  Valor (R$)
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  required
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  placeholder="Ex: 50.00"
                  className="h-10 text-base sm:text-sm font-mono font-bold rounded-xl"
                />
              </div>

              {/* Data, Hora + Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="font-bold text-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    Data da Movimentação
                  </label>
                  <Input
                    type="date"
                    required
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="h-10 text-base sm:text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="font-bold text-foreground flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Hora
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditTime(getCurrentLocalTimeStr())}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Agora
                    </button>
                  </div>
                  <Input
                    type="time"
                    value={editTime}
                    onChange={e => setEditTime(e.target.value)}
                    className="h-10 text-base sm:text-xs font-mono rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Liquidação
                </label>
                <div className="grid grid-cols-2 gap-1.5 h-10 p-1 rounded-xl bg-muted/40 border border-border/80">
                  <button
                    type="button"
                    onClick={() => setEditPaymentStatus('paid')}
                    className={`rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      editPaymentStatus === 'paid'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    ✓ Liquidado
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPaymentStatus('pending')}
                    className={`rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      editPaymentStatus === 'pending'
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    ⏳ Pendente
                  </button>
                </div>
              </div>

              {/* Reserva */}
              <div className="space-y-1">
                <label className="font-bold text-foreground flex items-center gap-1">
                  <PiggyBank className="w-3.5 h-3.5 text-indigo-500" />
                  Reserva
                </label>
                <Select value={editReserveId} onValueChange={setEditReserveId}>
                  <SelectTrigger className="h-10 text-xs font-semibold rounded-xl">
                    <SelectValue placeholder="Selecione a reserva" />
                  </SelectTrigger>
                  <SelectContent align="start" className="text-xs">
                    {reserves.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Categoria */}
              <div className="space-y-1">
                <label className="font-bold text-foreground flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  Categoria (Opcional)
                </label>
                <Input
                  type="text"
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  placeholder="Ex: Manutenção, Seguro, IPVA"
                  className="h-10 text-base sm:text-xs rounded-xl"
                />
              </div>

              {/* Descrição */}
              <div className="space-y-1">
                <label className="font-bold text-foreground">Descrição / Notas</label>
                <Input
                  type="text"
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="Ex: Aporte semanal para revisão"
                  className="h-10 text-base sm:text-xs rounded-xl"
                />
              </div>

              {txToEdit.type === 'utilizacao' && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-border/70 bg-muted/20 hover:bg-muted/35 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editIgnoreInCharts}
                    onChange={e => setEditIgnoreInCharts(e.target.checked)}
                    className="h-4 w-4 mt-0.5 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                      Ignorar nos gráficos e médias
                    </span>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      Mantém o abatimento na reserva e extrato, mas desconsidera dos gráficos e indicadores do painel.
                    </p>
                  </div>
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                variant="ghost"
                onClick={() => setTxToEdit(null)}
                disabled={isEditing}
                className="h-10 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={isEditing}
                className="h-10 px-5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                {isEditing ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Delete Confirmation Modal */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-md my-auto rounded-3xl border border-border/80 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Excluir Movimentação?</h3>
                <p className="text-xs text-muted-foreground">Esta ação removerá o registro e recalculará o saldo.</p>
              </div>
            </div>

            <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reserva:</span>
                <span className="font-bold text-foreground">{reserveMap[txToDelete.reserve_id]?.name || 'Reserva'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="font-bold capitalize">{getTxCategoryInfo(txToDelete).label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data e Hora:</span>
                <span className="font-medium font-mono">
                  {formatDateDisplay(txToDelete.date)}
                  {getEffectiveItemTime(txToDelete) ? ` às ${getEffectiveItemTime(txToDelete)}` : ''}
                </span>
              </div>
              <div className="flex justify-between border-t border-border/60 pt-1.5">
                <span className="font-bold text-foreground">Valor:</span>
                <span className="font-mono font-black text-sm text-foreground">
                  {hideValues ? 'R$ •••••' : formatCurrency(txToDelete.amount)}
                </span>
              </div>
              {txToDelete.description && (
                <div className="text-[11px] text-muted-foreground pt-1 italic">
                  &quot;{txToDelete.description}&quot;
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setTxToDelete(null)}
                disabled={isDeleting}
                className="h-10 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={async () => {
                  if (!txToDelete) return;
                  try {
                    setIsDeleting(true);
                    await onDeleteTransaction(txToDelete.id);
                    toast.success('Movimentação excluída com sucesso!');
                    setTxToDelete(null);
                  } catch (e: any) {
                    console.error(e);
                    toast.error('Erro ao excluir: ' + (e.message || 'Tente novamente.'));
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="h-10 px-5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-500/20 cursor-pointer"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Reusable sub-renderer for Transaction Card
  function renderTransactionCard(tx: ReserveTransaction) {
    const res = reserveMap[tx.reserve_id];
    const info = getTxCategoryInfo(tx);
    const ResIcon = res ? (iconOptions[res.icon] || PiggyBank) : PiggyBank;
    const resColor = res?.color || '#6366f1';
    const IconComp = info.icon;
    const boostExtra = getBoostExtraFromRt(tx);
    const isPending = tx.payment_status === 'pending' || (tx as any).status === 'pending';
    const balInfo = runningBalanceMap[tx.id];
    const isTransfer = Boolean((info as any).isTransferToCash);

    return (
      <div
        key={`tx_${tx.id}`}
        className={`p-3.5 sm:p-4 rounded-2xl bg-card border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:shadow-xs group text-left ${
          isPending
            ? 'border-amber-500/35 bg-amber-500/[0.02] hover:border-amber-500/60'
            : 'border-border/80 hover:border-border'
        }`}
      >
        {/* Left: Icon, Reserve Name, Type Badge, Category, Date & Description */}
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          {/* Reserve Avatar Icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs group-hover:scale-105 transition-transform"
            style={{ backgroundColor: resColor }}
          >
            <ResIcon className="w-4 h-4" />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black text-foreground truncate">
                {res?.name || 'Reserva Desconhecida'}
              </span>

              {/* Type Badge */}
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border flex items-center gap-1 ${info.badgeClass}`}>
                <IconComp className="w-3 h-3" />
                {info.label}
              </span>

              {/* Boost Badge */}
              {boostExtra > 0 && (
                <span className="px-1.5 py-0.2 text-[9px] font-black rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 inline-flex items-center gap-0.5">
                  <Rocket className="w-2.5 h-2.5" />
                  Boost +{hideValues ? '•••' : formatCurrency(boostExtra)}
                </span>
              )}

              {/* Payment Status Tag */}
              {isPending ? (
                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {tx.due_date ? `⏳ Liquida em ${formatDateDisplay(tx.due_date)}` : '⏳ Pendente'}
                </span>
              ) : tx.payment_status === 'paid' && (
                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  ✓ Liquidado
                </span>
              )}

              {/* Recurring Tag */}
              {tx.is_recurring && (
                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  🔄 {tx.installment_number || 1}/{tx.recurrence_installments || tx.installment_total || 1}
                </span>
              )}

              {/* Mass Contribution Tag */}
              {info.isMass && (
                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  ⚡ Lote
                </span>
              )}

              {/* Ignored in Charts Tag */}
              {tx.ignore_in_charts && (
                <span
                  className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-muted text-muted-foreground border border-border inline-flex items-center gap-0.5"
                  title="Desconsiderado dos gráficos e médias"
                >
                  <EyeOff className="w-2.5 h-2.5" />
                  Oculto
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1 font-medium font-mono">
                <Calendar className="w-3 h-3 text-muted-foreground/80" />
                {formatDateDisplay(tx.date)}
                {getEffectiveItemTime(tx) ? ` • ${getEffectiveItemTime(tx)}` : ''}
              </span>
              {tx.category && (
                <span className="font-medium inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-muted/60 text-foreground">
                  <Tag className="w-2.5 h-2.5 text-muted-foreground" />
                  {tx.category}
                </span>
              )}
              {tx.description && (
                <span className="text-foreground/80 font-medium line-clamp-2 sm:line-clamp-1 max-w-full sm:max-w-sm">
                  • {tx.description}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Amount, Running Balance & Quick Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
          <div className="text-left sm:text-right">
            <div className={`text-sm sm:text-base font-black font-mono tracking-tight ${
              isTransfer
                ? 'text-emerald-600 dark:text-emerald-400'
                : tx.type === 'utilizacao' 
                ? 'text-rose-600 dark:text-rose-400' 
                : tx.type === 'rendimento'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {isTransfer ? '⇄ ' : (tx.type === 'utilizacao' ? '-' : '+')}
              {hideValues ? 'R$ •••••' : formatCurrency(tx.amount)}
            </div>
            {isPending ? (
              <span className="text-[9.5px] font-mono text-amber-600 dark:text-amber-400 block">
                Aguardando liquidação
              </span>
            ) : balInfo ? (
              <span className="text-[9.5px] font-mono text-muted-foreground block tabular-nums">
                Saldo: <strong className="text-foreground/80">{hideValues ? '••••' : formatCurrency(balInfo.balanceAfter)}</strong>
              </span>
            ) : isTransfer ? (
              <span className="text-[9px] font-mono text-emerald-600/80 dark:text-emerald-400/80 block">
                Crédito em Caixa
              </span>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {onEditTransaction && tx.payment_status === 'pending' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onEditTransaction(tx.id, {
                    payment_status: 'paid',
                    payment_date: getTodayLocalDateStr(),
                    time: tx.time || getCurrentLocalTimeStr(),
                    due_date: null as any,
                  })
                }
                className="w-8 h-8 p-0 rounded-xl text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 cursor-pointer"
                title="Confirmar liquidação agora"
              >
                <CheckCircle2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTxToViewDetails(tx)}
              className="w-8 h-8 p-0 rounded-xl text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/10 cursor-pointer"
              title="Ver detalhes da movimentação"
            >
              <Info className="w-4 h-4" />
            </Button>

            {onEditTransaction && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenEdit(tx)}
                className="w-8 h-8 p-0 rounded-xl text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/10 cursor-pointer"
                title="Editar movimentação"
              >
                <Edit3 className="w-4 h-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTxToDelete(tx)}
              className="w-8 h-8 p-0 rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
              title="Excluir movimentação"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Sub-renderer for Rule Update Card
  function renderRuleUpdateCard(rule: RuleHistoryItem) {
    const res = reserveMap[rule.reserve_id];
    const ResIcon = res ? (iconOptions[res.icon] || PiggyBank) : PiggyBank;
    const resColor = res?.color || '#6366f1';
    const formulaLabel = getRuleFormulaLabel(rule.regra_tipo, rule.regra_valor);
    const typeName = getRuleTypeName(rule.regra_tipo);

    return (
      <div
        key={`rule_${rule.id}`}
        className={`p-3.5 sm:p-4 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:shadow-xs group text-left relative overflow-hidden ${
          rule.isCurrentActive
            ? 'bg-card border-2 border-emerald-500/40 hover:border-emerald-500/70 dark:bg-emerald-500/[0.04]'
            : 'bg-card border border-border/80 hover:border-indigo-500/40'
        }`}
      >
        {/* Visual Accent stripe on left */}
        <div 
          className={`absolute left-0 top-0 bottom-0 w-1.5 ${
            rule.isCurrentActive ? 'bg-emerald-500' : 'bg-muted-foreground/30'
          }`} 
        />

        {/* Left: Icon, Reserve Name, Badges & Formula */}
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 pl-1">
          {/* Avatar Icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs group-hover:scale-105 transition-transform"
            style={{ backgroundColor: resColor }}
          >
            {rule.isCurrentActive ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <Clock className="w-4 h-4 opacity-90" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-foreground truncate">
                {res?.name || 'Reserva'}
              </span>

              {/* Status Badge: Active In-Force vs Historical Record */}
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border flex items-center gap-1 ${
                rule.isCurrentActive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-muted text-muted-foreground border-border'
              }`}>
                {rule.isCurrentActive ? (
                  <>
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    Regra em Vigor
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    Regra Histórica
                  </>
                )}
              </span>

              {/* Automation Status */}
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                rule.regra_ativa !== false
                  ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}>
                {rule.regra_ativa !== false ? 'Automação Ativa' : 'Pausada'}
              </span>
            </div>

            {/* Formula & Validity details */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="font-bold text-foreground inline-flex items-center gap-1 font-mono">
                <Calculator className="w-3 h-3 text-indigo-500" />
                {formulaLabel}
              </span>
              <span className="flex items-center gap-1 font-medium font-mono">
                <Calendar className="w-3 h-3 text-muted-foreground/80" />
                Vigência: {formatDateDisplay(rule.start_date || rule.date)}
                {rule.start_time ? ` ${rule.start_time}` : ''}
                {rule.end_date
                  ? ` até ${formatDateDisplay(rule.end_date)}${rule.end_time ? ` ${rule.end_time}` : ''}`
                  : (rule.isCurrentActive ? ' (em vigor)' : '')}
              </span>
              {rule.regra_categorias && rule.regra_categorias.length > 0 && (
                <span className="font-medium inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-indigo-500/5 text-indigo-700 dark:text-indigo-300 border border-indigo-500/10 text-[10px]">
                  <Tag className="w-2.5 h-2.5" />
                  {rule.regra_categorias.join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Type Tag & Action Buttons */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
          <div className="text-left sm:text-right hidden xs:block">
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 block">
              {typeName}
            </span>
          </div>

          {/* Action Buttons: Details, Edit, Delete */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRuleToViewDetails(rule)}
              className="h-8 px-2.5 text-xs font-bold rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border-border/80 gap-1 cursor-pointer"
              title="Ver detalhes da regra"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Detalhes</span>
            </Button>

            {onUpdateReserve && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEditRule(rule)}
                  className="w-8 h-8 p-0 rounded-xl text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/10 cursor-pointer"
                  title={rule.isCurrentActive ? 'Editar regra em vigor' : 'Editar histórico da regra'}
                >
                  <Edit3 className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenDeleteRule(rule)}
                  className="w-8 h-8 p-0 rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                  title={rule.isCurrentActive ? 'Desativar / Remover regra em vigor' : 'Excluir registro histórico'}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
}
