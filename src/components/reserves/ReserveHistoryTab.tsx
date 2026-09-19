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
  RefreshCw
} from 'lucide-react';
import { subDays } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Reserve, ReserveTransaction, Transaction, UserSettings } from '../../types';
import { 
  formatCurrency, 
  formatDateDisplay, 
  iconOptions, 
  isTxInPeriod,
  parseLocalDate,
  getTodayLocalDateStr
} from './reserveUtils';
import { toast } from 'sonner';

export interface RuleHistoryItem {
  id: string;
  reserve_id: string;
  historyIndex?: number;
  date: string; // YYYY-MM-DD
  updated_at?: string;
  regra_tipo?: string;
  regra_valor: number;
  regra_categorias?: string[];
  regra_ativa?: boolean;
  start_date?: string;
  end_date?: string | null;
  description?: string;
  isCurrentActive: boolean;
}

export type UnifiedHistoryItem = 
  | {
      kind: 'transaction';
      id: string;
      date: string;
      reserve_id: string;
      amount: number;
      tx: ReserveTransaction;
    }
  | {
      kind: 'rule_update';
      id: string;
      date: string;
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
  const [selectedType, setSelectedType] = useState<string>('all'); // all, transactions_only, aporte, manual_aporte, mass_aporte, utilizacao, rendimento, rule_change
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all'); // all, manual, mass, rendimento, rule
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'reserve_asc'>('date_desc');
  const [groupByDate, setGroupByDate] = useState<boolean>(true);
  
  // Advanced Filter Drawer Toggle
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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
  const [editRuleValue, setEditRuleValue] = useState<string>('');
  const [editRuleStartDate, setEditRuleStartDate] = useState<string>('');
  const [editRuleEndDate, setEditRuleEndDate] = useState<string>('');
  const [editRuleCategories, setEditRuleCategories] = useState<string>('');
  const [editRuleCategoryList, setEditRuleCategoryList] = useState<string[]>([]);
  const [editRuleActive, setEditRuleActive] = useState<boolean>(true);
  const [editRuleAutoArchive, setEditRuleAutoArchive] = useState<boolean>(true);
  const [editRuleChangeReason, setEditRuleChangeReason] = useState<string>('');
  const [editRuleDescription, setEditRuleDescription] = useState<string>('');

  // Edit Transaction Form Fields
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editReserveId, setEditReserveId] = useState<string>('');

  // Period filter states - Defaults to 'all' so users immediately see all history
  const [historyPeriod, setHistoryPeriod] = useState<string>('all');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(null);

  // Pagination / Chunked loading state (15 items per page/chunk)
  const [visibleCount, setVisibleCount] = useState<number>(15);

  // Map reserves by id for fast O(1) lookup
  const reserveMap = useMemo(() => {
    const map: Record<string, Reserve> = {};
    reserves.forEach(r => { map[r.id] = r; });
    return map;
  }, [reserves]);

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
    return (ruleType: string, ruleValStr: string, cats: string[]) => {
      const val = parseFloat(String(ruleValStr).replace(',', '.'));
      if (isNaN(val) || val <= 0 || !ruleType) return { estimate: 0, metricLabel: 'Aguardando valor' };

      const thirtyDaysAgo = subDays(new Date(), 30);
      const recentTxs = (transactions || []).filter(t => {
        if (t.payment_status === 'pending' || (t as any).status === 'pending') return false;
        const d = parseLocalDate(t.date);
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
        const totalIncome = recentTxs
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const totalExpense = recentTxs
          .filter(t => t.type === 'expense' && !(t as any).isReserveTx && t.category !== 'Aporte Reserva')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const netProfit = Math.max(0, totalIncome - totalExpense);
        total = netProfit * (val / 100);
        metricLabel = `${formatCurrency(netProfit)} lucro líquido (últimos 30d)`;
      } else if (ruleType === 'fixo' || ruleType === 'fixo_diario') {
        const eligible = recentTxs.filter(
          t => t.type === 'income' && (cats.length === 0 || cats.includes(t.category))
        );
        const uniqueDays = new Set(eligible.map(t => t.date));
        total = uniqueDays.size * val;
        metricLabel = `${uniqueDays.size} dias com receita (últimos 30d)`;
      }

      return { estimate: Math.round(total * 100) / 100, metricLabel };
    };
  }, [transactions]);

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
        const activeStartDate = res.regra_inicio_validade || (res.created_at ? res.created_at.split('T')[0] : '2026-01-01');
        activeEvents.push({
          id: `rule_current_${res.id}`,
          reserve_id: res.id,
          date: activeStartDate,
          updated_at: res.updated_at || res.created_at || activeStartDate,
          regra_tipo: res.regra_tipo,
          regra_valor: Number(res.regra_valor || 0),
          regra_categorias: res.regra_categorias || [],
          regra_ativa: res.regra_ativa !== false,
          start_date: activeStartDate,
          end_date: null,
          description: 'Regra ativa em vigor',
          isCurrentActive: true
        });
      }

      // 2. Historical past rules from res.rule_history
      const historyList = res.rule_history || [];
      historyList.forEach((h: any, idx: number) => {
        const startDate = h.start_date || (h.updated_at ? h.updated_at.split('T')[0] : (res.created_at ? res.created_at.split('T')[0] : '2026-01-01'));
        historyEvents.push({
          id: `rule_hist_${res.id}_${idx}_${h.updated_at || startDate || idx}`,
          reserve_id: res.id,
          historyIndex: idx,
          date: startDate,
          updated_at: h.updated_at || startDate,
          regra_tipo: h.regra_tipo,
          regra_valor: Number(h.regra_valor || 0),
          regra_categorias: h.regra_categorias || [],
          regra_ativa: h.regra_ativa !== undefined ? Boolean(h.regra_ativa) : true,
          start_date: h.start_date,
          end_date: h.end_date || null,
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
    const isMass = tx.source === 'mass_contribution' || 
                   (tx.description && (tx.description.includes('[Aporte em Massa]') || tx.description.includes('[Consolidador]')));
    
    if (tx.type === 'aporte') {
      if (isMass) {
        return {
          label: 'Aporte em Lote',
          shortLabel: 'Lote',
          categoryKey: 'mass_aporte',
          badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          icon: Zap,
          color: 'text-indigo-600 dark:text-indigo-400',
          isMass: true
        };
      }
      return {
        label: 'Aporte Manual',
        shortLabel: 'Manual',
        categoryKey: 'manual_aporte',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        icon: ArrowDownLeft,
        color: 'text-emerald-600 dark:text-emerald-400',
        isMass: false
      };
    }

    if (tx.type === 'utilizacao') {
      return {
        label: 'Resgate / Utilização',
        shortLabel: 'Resgate',
        categoryKey: 'utilizacao',
        badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        icon: ArrowUpRight,
        color: 'text-rose-600 dark:text-rose-400',
        isMass: false
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
      case 'fixo_diario':
        return 'Fixo Diário';
      default:
        return 'Regra de Aporte';
    }
  };

  // Check if any non-default filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      historyPeriod !== 'all' ||
      searchTerm.trim() !== '' ||
      selectedReserveId !== 'all' ||
      selectedType !== 'all' ||
      selectedCategory !== 'all' ||
      selectedSource !== 'all' ||
      minValue !== '' ||
      maxValue !== '' ||
      sortBy !== 'date_desc'
    );
  }, [historyPeriod, searchTerm, selectedReserveId, selectedType, selectedCategory, selectedSource, minValue, maxValue, sortBy]);

  // Reset all filters to default
  const handleResetFilters = () => {
    setHistoryPeriod('all');
    setCustomDateRange(null);
    setSearchTerm('');
    setSelectedReserveId('all');
    setSelectedType('all');
    setSelectedCategory('all');
    setSelectedSource('all');
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
        reserve_id: rule.reserve_id,
        amount: rule.regra_valor,
        rule
      });
    });

    return list;
  }, [reserveTransactions, allRuleEvents]);

  // Filter and sort unified items
  const filteredItems = useMemo<UnifiedHistoryItem[]>(() => {
    return unifiedItems
      .filter(item => {
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

        // 3. Type filter
        if (selectedType !== 'all') {
          if (selectedType === 'rule_change') {
            if (item.kind !== 'rule_update') return false;
          } else if (selectedType === 'transactions_only') {
            if (item.kind !== 'transaction') return false;
          } else {
            // Must be transaction for specific financial types
            if (item.kind !== 'transaction') return false;
            const info = getTxCategoryInfo(item.tx);
            if (selectedType === 'aporte' && item.tx.type !== 'aporte') return false;
            if (selectedType === 'manual_aporte' && info.categoryKey !== 'manual_aporte') return false;
            if (selectedType === 'mass_aporte' && info.categoryKey !== 'mass_aporte') return false;
            if (selectedType === 'utilizacao' && info.categoryKey !== 'utilizacao') return false;
            if (selectedType === 'rendimento' && info.categoryKey !== 'rendimento') return false;
          }
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
            // Rule search
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
      })
      .sort((a, b) => {
        // Critical Reorganization: Rules in effect (isCurrentActive) always stay ahead of historical rules
        if (sortBy === 'date_desc') {
          if (a.kind === 'rule_update' && b.kind === 'rule_update') {
            if (a.rule.isCurrentActive && !b.rule.isCurrentActive) return -1;
            if (!a.rule.isCurrentActive && b.rule.isCurrentActive) return 1;
          }
        }

        const dateA = a.date || '';
        const dateB = b.date || '';
        const amtA = Number(a.amount || 0);
        const amtB = Number(b.amount || 0);
        const resA = reserveMap[a.reserve_id]?.name || '';
        const resB = reserveMap[b.reserve_id]?.name || '';

        switch (sortBy) {
          case 'date_asc':
            return dateA.localeCompare(dateB);
          case 'amount_desc':
            return amtB - amtA;
          case 'amount_asc':
            return amtA - amtB;
          case 'reserve_asc':
            return resA.localeCompare(resB);
          case 'date_desc':
          default: {
            const cmp = dateB.localeCompare(dateA);
            if (cmp !== 0) return cmp;
            // If dates are identical, prioritize active rules before historical rules
            if (a.kind === 'rule_update' && b.kind === 'rule_update') {
              if (a.rule.isCurrentActive && !b.rule.isCurrentActive) return -1;
              if (!a.rule.isCurrentActive && b.rule.isCurrentActive) return 1;
            }
            return 0;
          }
        }
      });
  }, [
    unifiedItems,
    historyPeriod,
    customDateRange,
    selectedReserveId,
    selectedType,
    selectedCategory,
    selectedSource,
    minValue,
    maxValue,
    searchTerm,
    sortBy,
    reserveMap
  ]);

  // Financial & Rule Summary Metrics for filtered view
  const summary = useMemo(() => {
    let totalAportesManuais = 0;
    let totalAportesMassa = 0;
    let countAportes = 0;
    let totalUtilizacoes = 0;
    let countUtilizacoes = 0;
    let totalRendimentos = 0;
    let countRendimentos = 0;
    let countRuleUpdates = 0;
    let countActiveRules = 0;

    filteredItems.forEach(item => {
      if (item.kind === 'transaction') {
        const info = getTxCategoryInfo(item.tx);
        const amount = Number(item.tx.amount || 0);

        if (info.categoryKey === 'manual_aporte') {
          totalAportesManuais += amount;
          countAportes++;
        } else if (info.categoryKey === 'mass_aporte') {
          totalAportesMassa += amount;
          countAportes++;
        } else if (info.categoryKey === 'utilizacao') {
          totalUtilizacoes += amount;
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

    const totalAportes = totalAportesManuais + totalAportesMassa;
    const netFlow = (totalAportes + totalRendimentos) - totalUtilizacoes;

    return {
      totalAportesManuais: Math.round(totalAportesManuais * 100) / 100,
      totalAportesMassa: Math.round(totalAportesMassa * 100) / 100,
      totalAportesTotal: Math.round(totalAportes * 100) / 100,
      countAportes,
      totalUtilizacoes: Math.round(totalUtilizacoes * 100) / 100,
      countUtilizacoes,
      totalRendimentos: Math.round(totalRendimentos * 100) / 100,
      countRendimentos,
      netFlow: Math.round(netFlow * 100) / 100,
      countRuleUpdates,
      countActiveRules,
      totalCount: filteredItems.length
    };
  }, [filteredItems]);

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
        if (item.tx.type === 'aporte' || item.tx.type === 'rendimento') {
          groups[dateKey].subtotalIn += amt;
        } else {
          groups[dateKey].subtotalOut += amt;
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

    const headers = ['Data', 'Reserva', 'Tipo de Registro', 'Categoria / Tags', 'Detalhes / Descrição', 'Valor / Fórmula'];
    const rows = filteredItems.map(item => {
      const res = reserveMap[item.reserve_id];
      const resName = res?.name || 'Reserva';

      if (item.kind === 'transaction') {
        const info = getTxCategoryInfo(item.tx);
        const sign = item.tx.type === 'utilizacao' ? '-' : '+';
        return [
          formatDateDisplay(item.tx.date),
          `"${resName.replace(/"/g, '""')}"`,
          `"${info.label}"`,
          `"${(item.tx.category || '').replace(/"/g, '""')}"`,
          `"${(item.tx.description || '').replace(/"/g, '""')}"`,
          `"${sign}${Number(item.tx.amount || 0).toFixed(2).replace('.', ',')}"`
        ];
      } else {
        const formula = getRuleFormulaLabel(item.rule.regra_tipo, item.rule.regra_valor);
        const status = item.rule.isCurrentActive ? 'Em Vigor' : 'Histórico';
        const cats = (item.rule.regra_categorias || []).join(', ');
        return [
          formatDateDisplay(item.rule.date),
          `"${resName.replace(/"/g, '""')}"`,
          `"Atualização de Regra (${status})"`,
          `"${cats.replace(/"/g, '""')}"`,
          `"${(item.rule.description || 'Configuração de aporte automático').replace(/"/g, '""')}"`,
          `"${formula.replace(/"/g, '""')}"`
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
    setEditDescription(tx.description || '');
    setEditCategory(tx.category || '');
    setEditReserveId(tx.reserve_id || '');
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
        description: editDescription.trim(),
        category: editCategory.trim() || undefined,
        reserve_id: editReserveId || txToEdit.reserve_id
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
    setEditRuleType(rule.regra_tipo || 'km');
    setEditRuleValue(rule.regra_valor !== undefined ? String(rule.regra_valor) : '');
    setEditRuleStartDate(rule.start_date || rule.date || getTodayLocalDateStr());
    setEditRuleEndDate(rule.end_date || '');
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

    const parsedCats = editRuleCategoryList.length > 0 
      ? editRuleCategoryList 
      : editRuleCategories.split(',').map(c => c.trim()).filter(Boolean);

    try {
      setIsSavingRule(true);

      if (ruleToEdit.isCurrentActive) {
        // Updating Current Active In-Force Rule of the reserve
        const currentHist = Array.isArray(reserve.rule_history) ? [...reserve.rule_history] : [];
        
        // Auto-archive previous active configuration to history if requested & there was an active rule
        if (editRuleAutoArchive && reserve.regra_tipo && reserve.regra_valor) {
          const prevStart = reserve.regra_inicio_validade || (reserve.created_at ? reserve.created_at.split('T')[0] : editRuleStartDate);
          const formulaLabel = getRuleFormulaLabel(reserve.regra_tipo, reserve.regra_valor);
          
          currentHist.push({
            start_date: prevStart,
            end_date: editRuleStartDate || getTodayLocalDateStr(),
            regra_tipo: reserve.regra_tipo,
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
          regra_valor: numVal,
          regra_categorias: parsedCats,
          regra_inicio_validade: editRuleStartDate || getTodayLocalDateStr(),
          regra_ativa: editRuleActive,
          rule_history: currentHist,
          updated_at: new Date().toISOString()
        });
        toast.success('Regra em vigor atualizada com sucesso!');
      } else {
        // Updating Historical Rule in reserve.rule_history array
        const currentHistory = Array.isArray(reserve.rule_history) ? [...reserve.rule_history] : [];
        const targetIdx = ruleToEdit.historyIndex !== undefined ? ruleToEdit.historyIndex : -1;

        if (targetIdx >= 0 && targetIdx < currentHistory.length) {
          currentHistory[targetIdx] = {
            ...currentHistory[targetIdx],
            regra_tipo: editRuleType,
            regra_valor: numVal,
            regra_categorias: parsedCats,
            start_date: editRuleStartDate,
            end_date: editRuleEndDate || null,
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
              regra_valor: numVal,
              regra_categorias: parsedCats,
              start_date: editRuleStartDate,
              end_date: editRuleEndDate || null,
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
            regra_valor: Number(fallbackRuleCandidate.regra_valor),
            regra_categorias: fallbackRuleCandidate.regra_categorias || [],
            regra_ativa: fallbackRuleCandidate.regra_ativa !== false,
            regra_inicio_validade: getTodayLocalDateStr(),
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
      {/* 1. Top Period Navigation Bar (Mobile First Horizontal Scroll with Pills) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex overflow-x-auto scrollbar-none gap-1.5 p-1 bg-muted/40 border border-border/60 rounded-2xl w-full">
            {[
              { id: 'all', label: 'Todo o Histórico', icon: Layers },
              { id: 'month', label: 'Mês Atual', icon: Calendar },
              { id: 'lastMonth', label: 'Mês Passado', icon: Calendar },
              { id: 'last30Days', label: '30 Dias', icon: Clock },
              { id: 'last90Days', label: '90 Dias', icon: Clock },
              { id: 'thisYear', label: 'Este Ano', icon: Calendar },
              { id: 'week', label: 'Esta Semana', icon: Clock },
              { id: 'custom', label: 'Personalizado', icon: SlidersHorizontal }
            ].map((period) => {
              const isSelected = historyPeriod === period.id;
              const Icon = period.icon;
              return (
                <button
                  key={period.id}
                  type="button"
                  onClick={() => {
                    setHistoryPeriod(period.id);
                    setVisibleCount(15);
                  }}
                  className="relative px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap focus:outline-none text-center flex-1 sm:flex-initial cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="reserve-history-active-period"
                      className="absolute inset-0 bg-background border border-border/80 shadow-2xs rounded-xl"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 flex items-center gap-1.5 transition-colors duration-200 ${
                    isSelected ? 'text-foreground font-black' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-500' : 'text-muted-foreground/70'}`} />
                    {period.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Date Range Picker when 'custom' is active */}
        {historyPeriod === 'custom' && (
          <motion.div 
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 flex-wrap bg-card p-3 rounded-2xl border border-indigo-500/30 shadow-xs"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>Intervalo de Datas:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                className="bg-background border border-border/80 rounded-xl px-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-indigo-500 outline-none font-mono cursor-pointer"
                value={customDateRange?.start || ''}
                onChange={(e) => {
                  const todayStr = getTodayLocalDateStr();
                  setCustomDateRange({
                    start: e.target.value,
                    end: customDateRange?.end || todayStr
                  });
                  setVisibleCount(15);
                }}
              />
              <span className="text-muted-foreground text-xs font-medium">até</span>
              <input
                type="date"
                className="bg-background border border-border/80 rounded-xl px-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-indigo-500 outline-none font-mono cursor-pointer"
                value={customDateRange?.end || ''}
                onChange={(e) => {
                  const todayStr = getTodayLocalDateStr();
                  setCustomDateRange({
                    start: customDateRange?.start || todayStr,
                    end: e.target.value
                  });
                  setVisibleCount(15);
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const firstDay = getTodayLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
                  const lastDay = getTodayLocalDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                  setCustomDateRange({ start: firstDay, end: lastDay });
                }}
                className="h-7 text-[11px] font-bold text-indigo-600 dark:text-indigo-400"
              >
                Mês Corrente
              </Button>
            </div>
          </motion.div>
        )}
      </div>

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
          <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 pt-0.5 border-t border-emerald-500/10 font-medium">
            <span>Manuais: <strong>{hideValues ? '••••' : formatCurrency(summary.totalAportesManuais)}</strong></span>
            <span>• Lote: <strong>{hideValues ? '••••' : formatCurrency(summary.totalAportesMassa)}</strong></span>
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
          <div className="text-[10px] text-muted-foreground pt-0.5 border-t border-rose-500/10 font-medium">
            <span>Gastos cobertos pelas reservas</span>
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
          <div className="text-[10px] text-muted-foreground pt-0.5 border-t border-blue-500/10 font-medium">
            <span>Lucros & CDI acumulados</span>
          </div>
        </div>

        {/* Saldo Líquido & Atualizações de Regra Card */}
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
            {hideValues ? 'R$ •••••' : formatCurrency(summary.netFlow)}
          </p>
          <div className="text-[10px] text-muted-foreground pt-0.5 border-t border-border/40 font-medium flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <strong>{summary.countRuleUpdates}</strong> regras
            </span>
            <span className={`font-bold ${summary.netFlow >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
              {summary.netFlow >= 0 ? 'Saldo +' : 'Saldo -'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Search & Main Filter Controls */}
      <div className="bg-card p-3 sm:p-4 rounded-2xl border border-border/80 shadow-xs space-y-3">
        {/* Search Bar + Quick Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, regra, km, faturamento, reserva..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setVisibleCount(15);
              }}
              className="pl-9 pr-8 h-9 text-xs rounded-xl bg-background border-border/80"
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
              <Filter className="w-3.5 h-3.5" />
              <span>Filtros</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              )}
            </Button>

            {/* Export CSV Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 border-border/80 hover:bg-muted cursor-pointer"
              title="Exportar registros e regras filtrados para planilha CSV"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          </div>
        </div>

        {/* Quick Type Selection Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 pt-0.5">
          {[
            { id: 'all', label: 'Todos os Registros' },
            { id: 'rule_change', label: `⚙️ Atualizações de Regra (${totalSystemRuleUpdates})`, isSpecial: true },
            { id: 'transactions_only', label: '💸 Apenas Movimentações' },
            { id: 'aporte', label: '📥 Aportes (Geral)' },
            { id: 'manual_aporte', label: '👤 Manuais' },
            { id: 'mass_aporte', label: '⚡ Em Lote' },
            { id: 'utilizacao', label: '📤 Resgates' },
            { id: 'rendimento', label: '📈 Rendimentos' }
          ].map(chip => {
            const isSelected = selectedType === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  setSelectedType(chip.id);
                  setVisibleCount(15);
                }}
                className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all whitespace-nowrap cursor-pointer border active:scale-95 ${
                  isSelected 
                    ? chip.isSpecial
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-black'
                      : 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' 
                    : chip.isSpecial
                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20'
                      : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/80'
                }`}
              >
                {chip.label}
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
              className="overflow-hidden pt-2 border-t border-border/60 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-left">
                {/* 1. Select Reserve */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <PiggyBank className="w-3 h-3 text-indigo-500" />
                    Filtrar por Reserva
                  </label>
                  <Select 
                    value={selectedReserveId} 
                    onValueChange={v => {
                      setSelectedReserveId(v);
                      setVisibleCount(15);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs font-semibold rounded-xl bg-background border-border/80">
                      <SelectValue placeholder="Todas as Reservas" />
                    </SelectTrigger>
                    <SelectContent align="start" className="text-xs">
                      <SelectItem value="all">Todas as Reservas</SelectItem>
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

                {/* 2. Select Category */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Tag className="w-3 h-3 text-emerald-500" />
                    Filtrar por Categoria
                  </label>
                  <Select 
                    value={selectedCategory} 
                    onValueChange={v => {
                      setSelectedCategory(v);
                      setVisibleCount(15);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs font-semibold rounded-xl bg-background border-border/80">
                      <SelectValue placeholder="Todas as Categorias" />
                    </SelectTrigger>
                    <SelectContent align="start" className="text-xs max-h-56">
                      <SelectItem value="all">Todas as Categorias</SelectItem>
                      {uniqueCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Sort Order */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3 text-amber-500" />
                    Ordenação
                  </label>
                  <Select 
                    value={sortBy} 
                    onValueChange={(v: any) => {
                      setSortBy(v);
                      setVisibleCount(15);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs font-semibold rounded-xl bg-background border-border/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start" className="text-xs">
                      <SelectItem value="date_desc">Mais Recentes (Data ↓)</SelectItem>
                      <SelectItem value="date_asc">Mais Antigos (Data ↑)</SelectItem>
                      <SelectItem value="amount_desc">Maior Valor (R$ ↓)</SelectItem>
                      <SelectItem value="amount_asc">Menor Valor (R$ ↑)</SelectItem>
                      <SelectItem value="reserve_asc">Nome da Reserva (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 4. Value Range (Min / Max) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-blue-500" />
                    Faixa de Valor (R$)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      placeholder="Mín"
                      type="number"
                      value={minValue}
                      onChange={e => {
                        setMinValue(e.target.value);
                        setVisibleCount(15);
                      }}
                      className="h-8 text-xs rounded-xl bg-background border-border/80 px-2"
                    />
                    <span className="text-muted-foreground text-xs">-</span>
                    <Input
                      placeholder="Máx"
                      type="number"
                      value={maxValue}
                      onChange={e => {
                        setMaxValue(e.target.value);
                        setVisibleCount(15);
                      }}
                      className="h-8 text-xs rounded-xl bg-background border-border/80 px-2"
                    />
                  </div>
                </div>
              </div>

              {/* View options and Reset */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupByDate(prev => !prev)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                      groupByDate 
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' 
                        : 'bg-muted text-muted-foreground border-border/60'
                    }`}
                  >
                    {groupByDate ? '✓ Agrupado por Mês' : 'Lista Contínua'}
                  </button>
                </div>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-7 px-2.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 font-bold gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Limpar Todos os Filtros
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Filter Tags */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
            <span className="text-muted-foreground font-medium">Filtros Ativos:</span>
            {historyPeriod !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold">
                Período: {historyPeriod}
                <button type="button" onClick={() => setHistoryPeriod('all')} className="hover:text-indigo-800">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedReserveId !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold">
                Reserva: {reserveMap[selectedReserveId]?.name || selectedReserveId}
                <button type="button" onClick={() => setSelectedReserveId('all')} className="hover:text-indigo-800">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                Tipo: {selectedType === 'rule_change' ? 'Alterações de Regra' : selectedType}
                <button type="button" onClick={() => setSelectedType('all')} className="hover:text-emerald-800">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">
                Categoria: {selectedCategory}
                <button type="button" onClick={() => setSelectedCategory('all')} className="hover:text-amber-800">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {(minValue !== '' || maxValue !== '') && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold">
                Valor: {minValue || '0'} a {maxValue || '∞'}
                <button type="button" onClick={() => { setMinValue(''); setMaxValue(''); }} className="hover:text-blue-800">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-foreground border border-border font-bold">
                Busca: &quot;{searchTerm}&quot;
                <button type="button" onClick={() => setSearchTerm('')} className="hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline font-bold ml-1 cursor-pointer"
            >
              Limpar tudo
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
                {hasActiveFilters 
                  ? 'Não há movimentações ou alterações de regras com os filtros selecionados. Tente expandir o período ou remover filtros.'
                  : 'Nenhum lançamento ou atualização de regra foi registrado ainda.'}
              </p>
            </div>

            {/* Quick resolution CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
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
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-8 px-4 text-xs font-bold rounded-xl gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>
        ) : groupByDate && groupedItems ? (
          /* Grouped View */
          groupedItems.map(group => (
            <div key={group.key} className="space-y-2">
              {/* Group Month Header */}
              <div className="flex items-center justify-between px-2 pt-2 text-xs font-black text-foreground">
                <div className="flex items-center gap-2">
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
                <div className="text-[11px] font-mono font-bold text-muted-foreground flex items-center gap-2">
                  {group.subtotalIn > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400">+{hideValues ? '••••' : formatCurrency(group.subtotalIn)}</span>
                  )}
                  {group.subtotalOut > 0 && (
                    <span className="text-rose-600 dark:text-rose-400">-{hideValues ? '••••' : formatCurrency(group.subtotalOut)}</span>
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
                <span className="font-bold text-foreground font-mono">{formatDateDisplay(ruleToViewDetails.start_date || ruleToViewDetails.date)}</span>
              </div>
              {ruleToViewDetails.end_date ? (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Término da Vigência:</span>
                  <span className="font-bold text-foreground font-mono">{formatDateDisplay(ruleToViewDetails.end_date)}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Validade:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Ativa a partir desta data</span>
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
              const sim = calculateRuleSimulation(editRuleType, editRuleValue, editRuleCategoryList);
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
                  <option value="fixo_diario">Valor Fixo Diário (R$/dia)</option>
                  <option value="personalizado">Personalizado</option>
                </select>
              </div>

              {/* Rule Value */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-bold flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                  Valor da Regra ({editRuleType === 'bruto' || editRuleType === 'liquido' ? '%' : 'R$'}):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={editRuleType === 'bruto' || editRuleType === 'liquido' ? '100' : undefined}
                    value={editRuleValue}
                    onChange={e => setEditRuleValue(e.target.value)}
                    placeholder="Ex: 0.15 ou 10"
                    className="w-full h-10 pl-3 pr-10 rounded-xl bg-background border border-border/80 font-bold text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">
                    {editRuleType === 'bruto' || editRuleType === 'liquido' ? '%' : 'R$'}
                  </span>
                </div>
                {(editRuleType === 'bruto' || editRuleType === 'liquido') && parseFloat(editRuleValue) > 100 && (
                  <p className="text-[10px] text-rose-500 font-bold">Atenção: Percentual não pode ser maior que 100%.</p>
                )}
              </div>

              {/* Start and End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-muted-foreground font-bold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    Início da Vigência:
                  </label>
                  <input
                    type="date"
                    value={editRuleStartDate}
                    onChange={e => setEditRuleStartDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border/80 font-medium text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground font-bold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    Término ({ruleToEdit.isCurrentActive ? 'Opcional / Futuro' : 'Vigência'}):
                  </label>
                  <input
                    type="date"
                    value={editRuleEndDate}
                    onChange={e => setEditRuleEndDate(e.target.value)}
                    placeholder="YYYY-MM-DD"
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border/80 font-medium text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                  />
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
                      fallbackRuleCandidate.regra_categorias || []
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
              return (
                <div className={`p-4 rounded-2xl border text-center space-y-1 ${
                  txToViewDetails.type === 'utilizacao'
                    ? 'bg-rose-500/10 border-rose-500/20'
                    : txToViewDetails.type === 'rendimento'
                    ? 'bg-blue-500/10 border-blue-500/20'
                    : 'bg-emerald-500/10 border-emerald-500/20'
                }`}>
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    {info.label}
                  </span>
                  <div className={`text-2xl sm:text-3xl font-black font-mono ${
                    txToViewDetails.type === 'utilizacao'
                      ? 'text-rose-600 dark:text-rose-400'
                      : txToViewDetails.type === 'rendimento'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {txToViewDetails.type === 'utilizacao' ? '-' : '+'}
                    {hideValues ? 'R$ •••••' : formatCurrency(txToViewDetails.amount)}
                  </div>
                </div>
              );
            })()}

            {/* Detailed Key-Value Specs */}
            <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/80 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Data da Movimentação:</span>
                <span className="font-bold text-foreground">{formatDateDisplay(txToViewDetails.date)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Reserva de Destino:</span>
                <span className="font-bold text-foreground">{reserveMap[txToViewDetails.reserve_id]?.name || 'N/D'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tipo de Operação:</span>
                <span className="font-bold capitalize">{getTxCategoryInfo(txToViewDetails).label}</span>
              </div>
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
                    {txToViewDetails.source === 'mass_contribution' ? '⚡ Consolidador em Lote' : '👤 Lançamento Direto'}
                  </span>
                </div>
              )}
              {txToViewDetails.description && (
                <div className="pt-2 border-t border-border/60 space-y-1">
                  <span className="text-muted-foreground text-[11px]">Descrição / Observações:</span>
                  <p className="text-foreground font-medium bg-background p-2.5 rounded-xl border border-border/60 text-[11px]">
                    {txToViewDetails.description}
                  </p>
                </div>
              )}
              <div className="pt-1.5 border-t border-border/60 flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>ID: {txToViewDetails.id.substring(0, 16)}...</span>
              </div>
            </div>

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
                  required
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  placeholder="Ex: 50.00"
                  className="h-10 text-sm font-mono font-bold rounded-xl"
                />
              </div>

              {/* Data */}
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
                  className="h-10 text-xs rounded-xl"
                />
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
                  className="h-10 text-xs rounded-xl"
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
                  className="h-10 text-xs rounded-xl"
                />
              </div>
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
                <span className="text-muted-foreground">Data:</span>
                <span className="font-medium">{formatDateDisplay(txToDelete.date)}</span>
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

    return (
      <div
        key={`tx_${tx.id}`}
        className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border/80 hover:border-border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:shadow-xs group text-left"
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-foreground truncate">
                {res?.name || 'Reserva Desconhecida'}
              </span>

              {/* Type Badge */}
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border flex items-center gap-1 ${info.badgeClass}`}>
                <IconComp className="w-3 h-3" />
                {info.label}
              </span>

              {/* Payment Status Tag */}
              {tx.payment_status === 'pending' ? (
                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  ⏳ Pendente
                </span>
              ) : tx.payment_status === 'paid' && (
                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  ✓ Pago
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
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1 font-medium">
                <Calendar className="w-3 h-3 text-muted-foreground/80" />
                {formatDateDisplay(tx.date)}
              </span>
              {tx.category && (
                <span className="font-medium inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-muted/60 text-foreground">
                  <Tag className="w-2.5 h-2.5 text-muted-foreground" />
                  {tx.category}
                </span>
              )}
              {tx.description && (
                <span className="truncate text-foreground/80 font-medium max-w-xs">
                  • {tx.description}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Amount & Quick Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
          <div className="text-left sm:text-right">
            <div className={`text-sm sm:text-base font-black font-mono tracking-tight ${
              tx.type === 'utilizacao' 
                ? 'text-rose-600 dark:text-rose-400' 
                : tx.type === 'rendimento'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {tx.type === 'utilizacao' ? '-' : '+'}
              {hideValues ? 'R$ •••••' : formatCurrency(tx.amount)}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
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
              <span className="flex items-center gap-1 font-medium">
                <Calendar className="w-3 h-3 text-muted-foreground/80" />
                Vigência: {formatDateDisplay(rule.start_date || rule.date)}
                {rule.end_date ? ` até ${formatDateDisplay(rule.end_date)}` : (rule.isCurrentActive ? ' (em vigor)' : '')}
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
