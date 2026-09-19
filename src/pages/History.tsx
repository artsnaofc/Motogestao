import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cacheManager } from '../lib/cacheManager';
import { getEffectiveUserId } from '../lib/authUtils';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { Transaction, ReserveTransaction } from '../types';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isWithinInterval, startOfYear, endOfYear, subYears, subDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, 
  Trash, 
  Edit2, 
  Search, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Calendar, 
  PiggyBank, 
  Wrench, 
  ShieldAlert, 
  Car, 
  Coins, 
  Sparkles, 
  Heart, 
  Briefcase,
  Bike,
  Package,
  ShoppingBag,
  Fuel,
  Coffee,
  Wifi,
  Utensils,
  ChevronDown,
  ChevronUp,
  FileText,
  Percent,
  CheckCircle2,
  Clock,
  Navigation,
  Shield,
  ShieldCheck,
  Gauge,
  Gift,
  Plane,
  GraduationCap,
  Laptop,
  Stethoscope,
  Hammer,
  Home,
  Award,
  Download,
  BarChart2,
  CheckSquare,
  Square,
  X,
  Layers,
  Zap,
  SlidersHorizontal,
  CalendarClock,
  AlertCircle,
  Check,
  RefreshCw
} from 'lucide-react';
import { ExecutiveReportModal } from '../components/ExecutiveReportModal';
import { TransactionDetailView } from '../components/history/TransactionDetailView';
import { isOperationalCategory, getActiveRuleForDate } from '../components/reserves/reserveUtils';
import { 
  getPaymentStatusMeta, 
  formatRecurrenceFrequency, 
  calculateNextOccurrence, 
  generateUUID, 
  getFrequencyLabel, 
  RecurrenceFrequency 
} from '../lib/recurrenceUtils';
import { syncQueueManager } from '../lib/syncQueue';
import { getTodayLocalDateStr } from '../lib/utils';
import { VehicleSelect } from '../components/VehicleSelect';
import { useVehicles } from '../contexts/VehiclesContext';
import { isVehicleRelatedCategory } from '../lib/vehicleUtils';

const HISTORY_FILTERS_KEY = 'motogestao_history_filters_v2';

const loadSavedFilters = () => {
  return cacheManager.get<any>(HISTORY_FILTERS_KEY) || null;
};

const iconOptions = {
  PiggyBank,
  Wrench,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Car,
  Coins,
  Fuel,
  Gauge,
  Sparkles,
  Heart,
  TrendingUp,
  Briefcase,
  Bike,
  Package,
  ShoppingBag,
  Coffee,
  Wifi,
  Utensils,
  Gift,
  Plane,
  GraduationCap,
  Laptop,
  Stethoscope,
  Hammer,
  Home,
  Award,
};

const getCategoryMeta = (category: string, type: 'income' | 'expense') => {
  const normalized = category.toLowerCase();
  
  if (type === 'income') {
    if (normalized.includes('ifood')) {
      return { icon: ShoppingBag, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
    }
    if (normalized.includes('uber')) {
      return { icon: Car, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20 shadow-sm' };
    }
    if (normalized.includes('99moto') || normalized.includes('99 moto') || normalized.includes('moto')) {
      return { icon: Bike, color: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/10 shadow-sm' };
    }
    if (normalized.includes('particular')) {
      return { icon: Coins, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
    }
    if (normalized.includes('gorjeta')) {
      return { icon: Sparkles, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
    }
    if (normalized.includes('pizzaria')) {
      return { icon: ShoppingBag, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' };
    }
    if (normalized.includes('frete')) {
      return { icon: Package, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' };
    }
    return { icon: TrendingUp, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
  } else {
    if (normalized.includes('combustível') || normalized.includes('gasolina') || normalized.includes('álcool') || normalized.includes('combustivel')) {
      return { icon: Fuel, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
    }
    if (normalized.includes('manutenção') || normalized.includes('manutencao') || normalized.includes('oficina') || normalized.includes('peça') || normalized.includes('pneu')) {
      return { icon: Wrench, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' };
    }
    if (normalized.includes('aliment') || normalized.includes('almoço') || normalized.includes('almoco') || normalized.includes('jantar') || normalized.includes('lanche')) {
      return { icon: Utensils, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' };
    }
    if (normalized.includes('internet') || normalized.includes('plano') || normalized.includes('celular') || normalized.includes('telefone')) {
      return { icon: Wifi, color: 'text-violet-500 bg-violet-500/10 border-violet-500/20' };
    }
    if (normalized.includes('equipamento') || normalized.includes('bag') || normalized.includes('capacete') || normalized.includes('suporte')) {
      return { icon: ShieldAlert, color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20' };
    }
    return { icon: TrendingDown, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
  }
};
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '../components/CurrencyInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/lib/toast';
import { useData } from '../contexts/DataContext';

const parseLocalDate = (dateStr: string | Date | undefined | null): Date => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  
  // Format: YYYY-MM-DD
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    // Use midday (12:00:00) to safely prevent timezone shift bugs
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  
  // Format: YYYY-MM
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}$/.test(dateStr)) {
    const [year, month] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, 1, 12, 0, 0, 0);
  }
  
  const parsed = parseISO(dateStr);
  if (isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
};

interface CollapsibleContributionsBlockProps {
  contributions: { reserve: any; amount: number }[];
  formatCurrency: (val: any) => string;
}

function CollapsibleContributionsBlock({ contributions, formatCurrency }: CollapsibleContributionsBlockProps) {
  const [isOpen, setIsOpen] = useState(false);
  const totalAmount = contributions.reduce((acc, c) => acc + Number(c.amount), 0);

  return (
    <div className="p-2 bg-indigo-500/[0.015] dark:bg-indigo-500/[0.005] rounded-xl border border-indigo-500/10 transition-all duration-200">
      {/* Header / Clickable Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 text-left focus:outline-none group/btn"
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          <PiggyBank className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider leading-none flex items-center gap-1">
              Aportes Sugeridos
              <span className="text-[9px] font-bold px-1 py-0.2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-full shrink-0 leading-none">
                {contributions.length}
              </span>
            </span>
            {!isOpen && (
              <span className="text-[9px] text-muted-foreground truncate leading-none mt-0.5">
                Simulação de regras ativas
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
            {formatCurrency(totalAmount)}
          </span>
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-indigo-500/80 group-hover/btn:text-indigo-600 transition-colors" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-indigo-500/80 group-hover/btn:text-indigo-600 transition-colors" />
          )}
        </div>
      </button>

      {/* Collapsible Details */}
      {isOpen && (
        <div className="mt-2 pt-2 border-t border-indigo-500/10 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="text-[8.5px] text-muted-foreground leading-relaxed">
            Valores simulados pelas regras — não retirados de seu saldo real.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {contributions.map(({ reserve, amount }) => {
              const IconComponent = iconOptions[reserve.icon as keyof typeof iconOptions] || PiggyBank;
              return (
                <div key={reserve.id} className="flex items-center justify-between p-1.5 bg-card/60 rounded-lg border border-border/40 hover:border-indigo-500/20 transition-all">
                  <div className="flex items-center gap-1.5 overflow-hidden mr-2">
                    <div 
                      className="w-4 h-4 rounded flex items-center justify-center text-white shrink-0 font-bold"
                      style={{ backgroundColor: reserve.color }}
                    >
                      <IconComponent className="w-2.5 h-2.5" />
                    </div>
                    <span className="font-bold text-foreground text-[9px] truncate leading-tight">{reserve.name}</span>
                  </div>
                  <span className="text-[9px] font-extrabold shrink-0 text-indigo-500 font-mono">
                    {formatCurrency(amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface CollapsibleCashFlowBlockProps {
  displayAmount: number;
  fuelCost: number;
  transactionNet: number;
  pocketRest: number;
  sumContributions: number;
  pizzariaBreakdown: any;
  formatCurrency: (val: any) => string;
}

function CollapsibleCashFlowBlock({
  displayAmount,
  fuelCost,
  transactionNet,
  pocketRest,
  sumContributions,
  pizzariaBreakdown,
  formatCurrency
}: CollapsibleCashFlowBlockProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative overflow-hidden p-2 bg-muted/35 dark:bg-muted/10 border border-border/40 rounded-xl transition-all duration-200">
      {/* Clickable Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-1.5 text-left focus:outline-none group/cf"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Coins className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black text-foreground uppercase tracking-wider leading-none">
              Fluxo Real vs. Planejado
            </span>
            {!isOpen && (
              <span className="text-[9px] text-muted-foreground truncate leading-none mt-1 flex items-center gap-1">
                <span>Bruto: <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">+{formatCurrency(displayAmount)}</strong></span>
                <span className="opacity-40">•</span>
                <span>Líq: <strong className="text-blue-600 dark:text-blue-400 font-mono font-bold">{formatCurrency(transactionNet)}</strong></span>
                {sumContributions > 0 && (
                  <>
                    <span className="opacity-40">•</span>
                    <span>Livre: <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">{formatCurrency(pocketRest)}</strong></span>
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/80 group-hover/cf:text-foreground transition-colors" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/80 group-hover/cf:text-foreground transition-colors" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div className="mt-2 pt-2 border-t border-border/40 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="space-y-1.5 text-[10px]">
            {/* 1. Bruto */}
            <div className="flex justify-between items-center text-foreground font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-muted-foreground">1. Faturamento Bruto:</span>
              </div>
              <span className="font-extrabold text-emerald-500 font-mono">+{formatCurrency(displayAmount)}</span>
            </div>

            {pizzariaBreakdown && (
              <div className="ml-3 p-1.5 bg-card/60 dark:bg-card/30 rounded-lg border border-border/30 space-y-1 text-[9px] text-muted-foreground font-mono">
                <div className="flex justify-between">
                  <span>• Diária de Apoio:</span>
                  <span className="font-bold text-foreground">{formatCurrency(pizzariaBreakdown.diaria)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Bairro ({pizzariaBreakdown.dels}x):</span>
                  <span className="font-bold text-foreground">
                    {pizzariaBreakdown.dels <= pizzariaBreakdown.baseDels ? 'Incluso' : `+${formatCurrency(pizzariaBreakdown.valorEntregas)}`}
                  </span>
                </div>
                {pizzariaBreakdown.out > 0 && (
                  <div className="flex justify-between">
                    <span>• Fora Bairro ({pizzariaBreakdown.out}x):</span>
                    <span className="font-bold text-indigo-500">+{formatCurrency(pizzariaBreakdown.valorForaBairro)}</span>
                  </div>
                )}
              </div>
            )}

            {/* 2. Combustivel */}
            {fuelCost > 0 && (
              <div className="flex justify-between items-center font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-muted-foreground">2. Combustível Estimado:</span>
                </div>
                <span className="font-extrabold text-rose-500 font-mono">-{formatCurrency(fuelCost)}</span>
              </div>
            )}

            {/* 3. Liquido Real */}
            <div className="flex justify-between items-center p-1.5 rounded-lg bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/15 font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <span className="text-blue-600 dark:text-blue-400">3. Lucro Líquido Real:</span>
              </div>
              <span className="font-extrabold text-blue-600 dark:text-blue-400 font-mono">{formatCurrency(transactionNet)}</span>
            </div>

            {/* 4. Retencao */}
            {sumContributions > 0 && (
              <>
                <div className="flex justify-between items-center font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                    <span className="text-muted-foreground">4. Retenção de Reservas:</span>
                  </div>
                  <span className="font-extrabold text-indigo-500 font-mono">-{formatCurrency(sumContributions)}</span>
                </div>

                {/* 5. Sobra Livre */}
                <div className="flex justify-between items-center p-1.5 rounded-lg bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-amber-600 dark:text-amber-400">5. Sobra Livre Estimada:</span>
                  </div>
                  <span className="font-extrabold text-amber-600 dark:text-amber-400 font-mono">{formatCurrency(pocketRest)}</span>
                </div>
              </>
            )}
          </div>

          {sumContributions > 0 && (
            <p className="text-[8.5px] leading-relaxed text-muted-foreground bg-indigo-500/[0.015] p-1.5 rounded-lg border border-indigo-500/5">
              💡 As regras são para simulação. Efetive os depósitos manualmente na aba de <strong>Reservas</strong>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function History() {
  const { transactions, setTransactions, updateTransaction, deleteTransaction, settings, loading, refreshData, globalPeriod, setGlobalPeriod, customDateRange, setCustomDateRange, hideValues, reserves, reserveTransactions, setReserveTransactions, investmentTransactions, deleteReserveTransaction, updateReserveTransaction, quotes, dividends, deleteInvestmentTransaction, deleteDividend } = useData();

  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const hasHighlightedRef = React.useRef<string | null>(null);

  // Saved filters from localStorage
  const savedFilters = useMemo(() => loadSavedFilters(), []);

  // Filters
  const [searchTerm, setSearchTerm] = useState(savedFilters?.searchTerm || '');
  const [filterType, setFilterType] = useState(savedFilters?.filterType || 'all');
  const [filterCategory, setFilterCategory] = useState(searchParams.get('category') || savedFilters?.filterCategory || 'all');
  const [filterStatus, setFilterStatus] = useState(savedFilters?.filterStatus || 'all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState(savedFilters?.filterPaymentStatus || 'all');
  const [minAmount, setMinAmount] = useState(savedFilters?.minAmount || '');
  const [maxAmount, setMaxAmount] = useState(savedFilters?.maxAmount || '');
  const [sortBy, setSortBy] = useState(savedFilters?.sortBy || 'date-desc');
  const [showAdvanced, setShowAdvanced] = useState(savedFilters?.showAdvanced || false);

  // Source filters
  const [includeCash, setIncludeCash] = useState(savedFilters?.includeCash ?? true);
  const [includeReserves, setIncludeReserves] = useState(savedFilters?.includeReserves ?? true);
  const [includeInvestments, setIncludeInvestments] = useState(savedFilters?.includeInvestments ?? true);
  const [filterReserveId, setFilterReserveId] = useState(savedFilters?.filterReserveId || 'all');
  const [filterTicker, setFilterTicker] = useState(savedFilters?.filterTicker || 'all');

  // Executive Report & Batch Selection States
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeQuickChip, setActiveQuickChip] = useState(savedFilters?.activeQuickChip || 'all');

  // Quick Settle Modal State
  const [settleItem, setSettleItem] = useState<Transaction | null>(null);
  const [settlePaymentDate, setSettlePaymentDate] = useState<string>(getTodayLocalDateStr());
  const [isSettling, setIsSettling] = useState(false);

  const handleOpenSettle = (t: Transaction) => {
    setSettleItem(t);
    setSettlePaymentDate(getTodayLocalDateStr());
  };

  const handleConfirmSettle = async () => {
    if (!settleItem || isSettling) return;
    setIsSettling(true);
    try {
      const isReserveTx = (settleItem as any).isReserveTx;
      const finalPaymentDate = settlePaymentDate || getTodayLocalDateStr();
      
      if (isReserveTx) {
        await updateReserveTransaction(settleItem.id, {
          payment_status: 'paid',
          payment_date: finalPaymentDate,
        });
      } else {
        await updateTransaction(settleItem.id, {
          payment_status: 'paid',
          payment_date: finalPaymentDate,
        });
      }
      toast.success('Despesa quitada com sucesso!');
      setSettleItem(null);
      await refreshData(true);
    } catch (err) {
      toast.error('Erro ao registrar quitação.');
    } finally {
      setIsSettling(false);
    }
  };

  // Sync category parameter from URL search params
  React.useEffect(() => {
    const urlCategory = searchParams.get('category');
    if (urlCategory) {
      setFilterCategory(urlCategory);
      // Clean up the parameter to allow free state changes later in browser session
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('category');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Persistent filters: Auto-save state to cache
  React.useEffect(() => {
    const filterState = {
      searchTerm,
      filterType,
      filterCategory,
      filterStatus,
      filterPaymentStatus,
      minAmount,
      maxAmount,
      sortBy,
      showAdvanced,
      includeCash,
      includeReserves,
      includeInvestments,
      filterReserveId,
      filterTicker,
      activeQuickChip,
    };
    cacheManager.set(HISTORY_FILTERS_KEY, filterState, undefined, 'settings');
  }, [
    searchTerm, filterType, filterCategory, filterStatus, filterPaymentStatus, minAmount, maxAmount,
    sortBy, showAdvanced, includeCash, includeReserves, includeInvestments,
    filterReserveId, filterTicker, activeQuickChip
  ]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterType !== 'all') count++;
    if (filterCategory !== 'all') count++;
    if (filterStatus !== 'all') count++;
    if (filterPaymentStatus !== 'all') count++;
    if (minAmount !== '') count++;
    if (maxAmount !== '') count++;
    if (sortBy !== 'date-desc') count++;
    if (!includeCash) count++;
    if (!includeReserves) count++;
    if (!includeInvestments) count++;
    if (filterReserveId !== 'all') count++;
    if (filterTicker !== 'all') count++;
    return count;
  }, [filterType, filterCategory, filterStatus, filterPaymentStatus, minAmount, maxAmount, sortBy, includeCash, includeReserves, includeInvestments, filterReserveId, filterTicker]);

  // Edit Modal
  const [editItem, setEditItem] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState<'income' | 'expense'>('income');
  const [editDate, setEditDate] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  // Recurrence Edit States
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editRecurrenceFrequency, setEditRecurrenceFrequency] = useState<RecurrenceFrequency>('monthly');
  const [editRecurrenceInstallments, setEditRecurrenceInstallments] = useState('12');
  const [editGenerateFuture, setEditGenerateFuture] = useState(true);
  const [editApplyToFuture, setEditApplyToFuture] = useState(true);
  
  const [editStartKm, setEditStartKm] = useState('');
  const [editEndKm, setEditEndKm] = useState('');
  const [editDeliveries, setEditDeliveries] = useState('');
  const [editOutOfNeighborhood, setEditOutOfNeighborhood] = useState('');

  const { vehicles } = useVehicles();
  const [editVehicleId, setEditVehicleId] = useState<string>('');
  const [showEditVehicleSelect, setShowEditVehicleSelect] = useState(false);

  const isEditCategoryVehicleRelated = useMemo(() => {
    if (!editCategory) return false;
    return isVehicleRelatedCategory(
      editCategory,
      editCategory === 'Pizzaria' ? 'pizzaria' : (editCategory === 'Frete do Dia' ? 'frete' : null),
      editType,
      settings
    );
  }, [editCategory, editType, settings]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleGroupsCount, setVisibleGroupsCount] = useState(10);
  const [groupByType, setGroupByType] = useState<boolean>(true);

  // State for collapsible sub-groups
  const [collapsedSubGroups, setCollapsedSubGroups] = useState<Record<string, boolean>>({});

  const isSubGroupCollapsed = (dateKey: string, sgKey: string, stateMap = collapsedSubGroups) => {
    const fullKey = `${dateKey}-${sgKey}`;
    if (fullKey in stateMap) {
      return stateMap[fullKey];
    }
    // Default expansion rule:
    // Receitas, despesas operacionais e despesas pessoais -> expandidas por padrão (isCollapsed = false)
    // Reservas e investimentos -> recolhidos por padrão (isCollapsed = true)
    return sgKey === 'reserves' || sgKey === 'investments';
  };

  const toggleSubGroup = (dateKey: string, sgKey: string) => {
    const fullKey = `${dateKey}-${sgKey}`;
    setCollapsedSubGroups(prev => {
      const isCurrentlyCollapsed = isSubGroupCollapsed(dateKey, sgKey, prev);
      return { ...prev, [fullKey]: !isCurrentlyCollapsed };
    });
  };

  // Reset visible groups count when filter parameters change
  React.useEffect(() => {
    setVisibleGroupsCount(10);
  }, [searchTerm, filterType, filterCategory, filterStatus, minAmount, maxAmount, sortBy, includeCash, includeReserves, includeInvestments, filterReserveId, filterTicker, globalPeriod]);

  // States for Editing Reserve Transactions
  const [editIsReserve, setEditIsReserve] = useState(false);
  const [editReserveId, setEditReserveId] = useState('');
  const [editReserveTxType, setEditReserveTxType] = useState<'aporte' | 'utilizacao' | 'rendimento'>('aporte');
  const [editReserveCategory, setEditReserveCategory] = useState('');

  const selectedReserve = (reserves || []).find(r => r.id === editReserveId);

  // Custom Deletion Confirmation State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmType, setDeleteConfirmType] = useState<'transaction' | 'reserve_transaction' | 'investment_transaction' | 'dividend' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const expenseCategories = settings?.expense_categories || ['Combustível', 'Manutenção', 'Alimentação', 'Plano de Internet', 'Equipamento', 'Outras Despesas', 'Outros'];
  const incomeCategories = settings?.income_categories || ['iFood', 'Uber', '99Moto', 'Particular', 'Gorjeta', 'Frete do Dia', 'Pizzaria', 'Outros'];

  const openEdit = (t: Transaction) => {
    const isRt = (t as any).isReserveTx || (t as any).isReserveAporte;
    const isReserveUse = t.is_reserve_use || (t as any).isReserveUseOriginal || t.description?.startsWith('[Reserva]') || (t as any).rawDescription?.startsWith('[Reserva]');

    const tAmount = (t as any).rawAmount !== undefined ? (t as any).rawAmount : t.amount;
    const tDescription = (t as any).rawDescription !== undefined ? (t as any).rawDescription : t.description;

    setEditPaymentStatus(t.payment_status || 'paid');
    setEditPaymentDate(t.payment_date || t.date);
    setEditDueDate(t.due_date || t.date);

    const isRecurring = Boolean(t.is_recurring);
    setEditIsRecurring(isRecurring);
    setEditRecurrenceFrequency((t.recurrence_frequency as RecurrenceFrequency) || 'monthly');
    setEditRecurrenceInstallments(String(t.recurrence_installments || (t as any).total_installments || (t as any).installment_total || 12));
    setEditGenerateFuture(!isRecurring);
    setEditApplyToFuture(true);

    if (isRt) {
      setEditIsReserve(true);
      setEditItem(t);
      setEditReserveId((t as any).reserveId || '');
      setEditReserveTxType((t as any).reserveTxType || 'aporte');
      setEditAmount(tAmount.toString());
      setEditDate(t.date);
      setEditDesc(tDescription || '');
      setEditReserveCategory((t as any).reserveCategory || '');
      setEditVehicleId((t as any).vehicle_id || '');
      setShowEditVehicleSelect(false);

      const matchRt = (reserveTransactions || []).find(r => r.id === t.id);
      if (matchRt) {
        setEditPaymentStatus(matchRt.payment_status || t.payment_status || 'paid');
        setEditPaymentDate(matchRt.payment_date || t.payment_date || t.date);
        setEditDueDate(matchRt.due_date || t.due_date || t.date);
        if ((matchRt as any).vehicle_id) {
          setEditVehicleId((matchRt as any).vehicle_id);
        }
        const isRec = Boolean(matchRt.is_recurring ?? t.is_recurring);
        setEditIsRecurring(isRec);
        setEditRecurrenceFrequency((matchRt.recurrence_frequency || t.recurrence_frequency || 'monthly') as RecurrenceFrequency);
        setEditRecurrenceInstallments(String(matchRt.recurrence_installments || t.recurrence_installments || (t as any).total_installments || (t as any).installment_total || 12));
        setEditGenerateFuture(!isRec);
        setEditApplyToFuture(true);
      }
    } else if (isReserveUse) {
      const matchRt = (reserveTransactions || []).find(
        rt => rt.type === 'utilizacao' && 
              rt.date === t.date && 
              Math.abs(Number(rt.amount) - Number(tAmount)) < 0.01
      );
      if (matchRt) {
        setEditIsReserve(true);
        // Create virtual item with the correct matched ReserveTransaction ID so updateReserveTransaction works perfectly
        setEditItem({
          ...t,
          id: matchRt.id,
          is_recurring: matchRt.is_recurring,
          recurrence_frequency: matchRt.recurrence_frequency,
          recurrence_installments: matchRt.recurrence_installments,
          installment_number: matchRt.installment_number || (matchRt as any).installment_index,
          installment_total: matchRt.installment_total || (matchRt as any).total_installments,
          payment_status: matchRt.payment_status,
          payment_date: matchRt.payment_date,
          due_date: matchRt.due_date,
        });
        setEditReserveId(matchRt.reserve_id);
        setEditReserveTxType('utilizacao');
        setEditAmount(matchRt.amount.toString());
        setEditDate(matchRt.date);
        setEditDesc(matchRt.description ? matchRt.description.replace(/^\[Reserva\]\s*/, '') : '');
        setEditReserveCategory(matchRt.category || '');
        setEditVehicleId(t.vehicle_id || (matchRt as any).vehicle_id || '');
        setShowEditVehicleSelect(false);

        setEditPaymentStatus(matchRt.payment_status || t.payment_status || 'paid');
        setEditPaymentDate(matchRt.payment_date || t.payment_date || t.date);
        setEditDueDate(matchRt.due_date || t.due_date || t.date);
        const isRec = Boolean(matchRt.is_recurring ?? t.is_recurring);
        setEditIsRecurring(isRec);
        setEditRecurrenceFrequency((matchRt.recurrence_frequency || t.recurrence_frequency || 'monthly') as RecurrenceFrequency);
        setEditRecurrenceInstallments(String(matchRt.recurrence_installments || t.recurrence_installments || (t as any).total_installments || (t as any).installment_total || 12));
        setEditGenerateFuture(!isRec);
        setEditApplyToFuture(true);
      } else {
        // Fallback to normal transaction edit if no matching reserve transaction was found
        setEditIsReserve(false);
        setEditItem(t);
        setEditType(t.type);
        setEditAmount(tAmount.toString());
        setEditCategory(t.category);
        setEditDesc(tDescription || '');
        setEditDate(t.date);
        setEditStartKm(t.start_km?.toString() || '');
        setEditEndKm(t.end_km?.toString() || '');
        setEditDeliveries(t.deliveries?.toString() || '');
        setEditOutOfNeighborhood(t.out_of_neighborhood?.toString() || '');
        setEditVehicleId(t.vehicle_id || '');
        setShowEditVehicleSelect(false);
      }
    } else {
      setEditIsReserve(false);
      setEditItem(t);
      setEditType(t.type);
      setEditAmount(tAmount.toString());
      setEditCategory(t.category);
      setEditDesc(tDescription || '');
      setEditDate(t.date);
      setEditStartKm(t.start_km?.toString() || '');
      setEditEndKm(t.end_km?.toString() || '');
      setEditDeliveries(t.deliveries?.toString() || '');
      setEditOutOfNeighborhood(t.out_of_neighborhood?.toString() || '');
      setEditVehicleId(t.vehicle_id || '');
      setShowEditVehicleSelect(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || saving) return;
    setSaving(true);
    
    if (editIsReserve) {
      try {
        const finalAmt = Number(editAmount);
        if (isNaN(finalAmt) || finalAmt <= 0) {
          toast.error('Informe um valor válido maior que zero.');
          setSaving(false);
          return;
        }

        const matchedRes = reserves.find(r => r.id === editReserveId);
        const reserveName = matchedRes ? matchedRes.name : 'Reserva';
        const defaultDesc = editReserveTxType === 'aporte' 
          ? `Aporte para ${reserveName}` 
          : editReserveTxType === 'rendimento'
            ? ''
            : `Uso da reserva ${reserveName}`;

        let finalReserveCat = editReserveCategory;
        if (matchedRes && matchedRes.require_category_on_use === false) {
          finalReserveCat = matchedRes.default_use_category || matchedRes.name;
        } else {
          finalReserveCat = editReserveCategory !== 'none' && editReserveCategory ? editReserveCategory : '';
        }

        const oldRt = (reserveTransactions || []).find(r => r.id === editItem.id);
        const effectivePaymentStatus = editReserveTxType === 'utilizacao' ? editPaymentStatus : 'paid';
        const effectivePaymentDate = editReserveTxType === 'utilizacao' && editPaymentStatus === 'paid'
          ? (editPaymentDate || editDate)
          : (editReserveTxType !== 'utilizacao' ? editDate : null);
        const effectiveDueDate = editReserveTxType === 'utilizacao' && editPaymentStatus === 'pending'
          ? (editDueDate || editDate)
          : null;

        const finalVehicleId = editVehicleId === '__none__' || !editVehicleId.trim()
          ? undefined
          : editVehicleId.trim();

        if (editReserveTxType === 'utilizacao') {
          if (editIsRecurring) {
            const numInstallments = Math.max(2, Math.min(60, Number(editRecurrenceInstallments) || 12));

            if (!oldRt?.is_recurring) {
              // Convert single reserve use to recurring
              const recurrenceGroupId = generateUUID();
              const baseDesc = editDesc.trim() || defaultDesc;
              const inst1Desc = baseDesc.includes('(1/') ? baseDesc : `${baseDesc} (1/${numInstallments})`;

              await updateReserveTransaction(editItem.id, {
                reserve_id: editReserveId,
                type: 'utilizacao',
                amount: finalAmt,
                date: editDate,
                category: finalReserveCat || undefined,
                description: inst1Desc,
                payment_status: effectivePaymentStatus,
                payment_date: effectivePaymentDate,
                due_date: effectiveDueDate,
                vehicle_id: finalVehicleId,
                is_recurring: true,
                recurrence_frequency: editRecurrenceFrequency,
                recurrence_installments: numInstallments,
                recurrence_group_id: recurrenceGroupId,
                installment_number: 1,
                installment_total: numInstallments,
                installment_index: 1,
                total_installments: numInstallments,
              });

              if (editGenerateFuture && numInstallments > 1) {
                const futureBatch: ReserveTransaction[] = [];
                const userId = (await getEffectiveUserId()) || oldRt?.user_id || 'local';

                for (let i = 2; i <= numInstallments; i++) {
                  const instId = generateUUID();
                  const instDate = calculateNextOccurrence(editDate, editRecurrenceFrequency, i - 1);
                  const instDueDate = effectivePaymentStatus === 'pending' && editDueDate
                    ? calculateNextOccurrence(editDueDate, editRecurrenceFrequency, i - 1)
                    : instDate;
                  const instDesc = `${baseDesc} (${i}/${numInstallments})`;

                  const instPayload: ReserveTransaction = {
                    id: instId,
                    user_id: userId,
                    reserve_id: editReserveId,
                    type: 'utilizacao',
                    amount: finalAmt,
                    date: instDate,
                    category: finalReserveCat || undefined,
                    description: instDesc,
                    payment_status: 'pending',
                    payment_date: null,
                    due_date: instDueDate,
                    vehicle_id: finalVehicleId,
                    is_recurring: true,
                    recurrence_frequency: editRecurrenceFrequency,
                    recurrence_installments: numInstallments,
                    recurrence_group_id: recurrenceGroupId,
                    installment_number: i,
                    installment_total: numInstallments,
                    installment_index: i,
                    total_installments: numInstallments,
                    created_at: new Date().toISOString()
                  };

                  futureBatch.push(instPayload);
                  syncQueueManager.enqueue('reserve_transactions', 'insert', instId, instPayload);
                }

                if (futureBatch.length > 0) {
                  setReserveTransactions(prev => {
                    const newState = [...futureBatch, ...prev];
                    cacheManager.set(`reserve_transactions_${userId}`, newState, undefined, 'reserves');
                    return newState;
                  });
                }
                toast.success(`Resgate convertido em recorrente com ${numInstallments} parcelas geradas!`);
              } else {
                toast.success('Resgate configurado como recorrente.');
              }
            } else {
              // Existing recurring series
              const currentGroup = oldRt.recurrence_group_id;
              const currentInstNumber = oldRt.installment_number || (oldRt as any).installment_index || 1;

              await updateReserveTransaction(editItem.id, {
                reserve_id: editReserveId,
                type: 'utilizacao',
                amount: finalAmt,
                date: editDate,
                category: finalReserveCat || undefined,
                description: editDesc || defaultDesc,
                payment_status: effectivePaymentStatus,
                payment_date: effectivePaymentDate,
                due_date: effectiveDueDate,
                vehicle_id: finalVehicleId,
                is_recurring: true,
                recurrence_frequency: editRecurrenceFrequency,
                recurrence_installments: numInstallments,
                installment_number: currentInstNumber,
                installment_total: numInstallments,
                installment_index: currentInstNumber,
                total_installments: numInstallments,
              });

              if (editApplyToFuture && currentGroup) {
                const futureSeries = (reserveTransactions || []).filter(
                  rt => rt.recurrence_group_id === currentGroup && 
                        (rt.installment_number || (rt as any).installment_index || 0) > currentInstNumber
                );

                if (futureSeries.length > 0) {
                  const updatedIds = new Set(futureSeries.map(r => r.id));
                  setReserveTransactions(prev => {
                    const updated = prev.map(rt => {
                      if (!updatedIds.has(rt.id)) return rt;
                      const instNum = rt.installment_number || (rt as any).installment_index || 1;
                      const baseDesc = editDesc.replace(/\s*\(\d+\/\d+\)$/, '').trim() || defaultDesc;
                      const instDesc = `${baseDesc} (${instNum}/${numInstallments})`;
                      return {
                        ...rt,
                        amount: finalAmt,
                        category: finalReserveCat || undefined,
                        description: instDesc,
                        recurrence_frequency: editRecurrenceFrequency,
                        recurrence_installments: numInstallments,
                        installment_total: numInstallments,
                        total_installments: numInstallments,
                      };
                    });
                    const uid = oldRt?.user_id || 'local';
                    cacheManager.set(`reserve_transactions_${uid}`, updated, undefined, 'reserves');
                    return updated;
                  });

                  futureSeries.forEach(rt => {
                    const instNum = rt.installment_number || (rt as any).installment_index || 1;
                    const baseDesc = editDesc.replace(/\s*\(\d+\/\d+\)$/, '').trim() || defaultDesc;
                    const instDesc = `${baseDesc} (${instNum}/${numInstallments})`;
                    syncQueueManager.enqueue('reserve_transactions', 'update', rt.id, {
                      amount: finalAmt,
                      category: finalReserveCat || undefined,
                      description: instDesc,
                      recurrence_frequency: editRecurrenceFrequency,
                      recurrence_installments: numInstallments,
                      installment_total: numInstallments,
                    });
                  });
                  toast.success(`Alterações aplicadas a esta e a mais ${futureSeries.length} parcelas futuras!`);
                } else {
                  toast.success('Parcela atualizada com sucesso!');
                }
              } else {
                toast.success('Parcela atualizada com sucesso!');
              }
            }
          } else {
            // Turning off recurrence
            await updateReserveTransaction(editItem.id, {
              reserve_id: editReserveId,
              type: 'utilizacao',
              amount: finalAmt,
              date: editDate,
              category: finalReserveCat || undefined,
              description: editDesc || defaultDesc,
              payment_status: effectivePaymentStatus,
              payment_date: effectivePaymentDate,
              due_date: effectiveDueDate,
              vehicle_id: finalVehicleId,
              is_recurring: false,
              recurrence_frequency: undefined,
              recurrence_installments: undefined,
              recurrence_group_id: undefined,
              installment_number: undefined,
              installment_total: undefined,
              installment_index: undefined,
              total_installments: undefined,
            });
            toast.success('Resgate atualizado (recorrência desativada).');
          }
        } else {
          // Aporte or rendimento
          await updateReserveTransaction(editItem.id, {
            reserve_id: editReserveId,
            type: editReserveTxType,
            amount: finalAmt,
            date: editDate,
            category: undefined,
            description: editDesc || defaultDesc,
            payment_status: 'paid',
            payment_date: editDate,
            due_date: null,
          });
          toast.success('Movimentação da reserva atualizada com sucesso!');
        }

        setEditItem(null);
        await refreshData(true);
      } catch (err) {
        toast.error('Erro ao atualizar movimentação.');
      }
      setSaving(false);
      return;
    }

    // Auto-calculate for Pizzaria on save
    let finalAmount = Number(editAmount);
    if (editCategory === 'Pizzaria' && settings) {
      const dels = Number(editDeliveries) || 0;
      const out = Number(editOutOfNeighborhood) || 0;
      let total = 0;
      
      // Out of neighborhood goes on top anyway
      total += out * settings.pizzaria_out_of_neighborhood_rate;
      
      // Base rule
      if (dels <= settings.pizzaria_base_deliveries) {
        total += settings.pizzaria_base_rate;
      } else {
        total += settings.pizzaria_daily_rate_above_base + (dels * settings.pizzaria_delivery_rate);
      }
      finalAmount = total;
    }

    const oldTx = transactions.find(t => t.id === editItem.id);
    const finalVehicleId = editVehicleId === '__none__' || !editVehicleId.trim()
      ? null
      : editVehicleId.trim();

    const effectivePaymentStatus = editType === 'expense' ? editPaymentStatus : 'paid';
    const effectivePaymentDate = editType === 'expense' && editPaymentStatus === 'paid' 
      ? (editPaymentDate || editDate) 
      : (editType === 'income' ? editDate : null);
    const effectiveDueDate = editType === 'expense' && editPaymentStatus === 'pending' 
      ? (editDueDate || editDate) 
      : editDate;

    // Recurrence logic handling
    let recurrenceFields: Partial<Transaction> = {};

    if (editType === 'expense') {
      if (editIsRecurring) {
        const numInstallments = Math.max(2, Math.min(60, Number(editRecurrenceInstallments) || 12));
        
        // Scenario A: Converting from single non-recurring to recurring
        if (!oldTx?.is_recurring) {
          const recurrenceGroupId = generateUUID();
          const baseDesc = editDesc.trim() || editCategory || 'Despesa';
          const inst1Desc = baseDesc.includes('(1/') ? baseDesc : `${baseDesc} (1/${numInstallments})`;

          recurrenceFields = {
            is_recurring: true,
            recurrence_frequency: editRecurrenceFrequency,
            recurrence_installments: numInstallments,
            recurrence_group_id: recurrenceGroupId,
            installment_number: 1,
            installment_total: numInstallments,
            installment_index: 1,
            total_installments: numInstallments,
            description: inst1Desc,
          };

          // Generate remaining (N - 1) future installments if requested
          if (editGenerateFuture && numInstallments > 1) {
            const futureBatch: Transaction[] = [];
            for (let i = 2; i <= numInstallments; i++) {
              const instId = generateUUID();
              const instDate = calculateNextOccurrence(editDate, editRecurrenceFrequency, i - 1);
              const instDueDate = editPaymentStatus === 'pending' && editDueDate
                ? calculateNextOccurrence(editDueDate, editRecurrenceFrequency, i - 1)
                : instDate;
              const instDesc = `${baseDesc} (${i}/${numInstallments})`;

              const instPayload: Transaction = {
                id: instId,
                user_id: oldTx?.user_id || 'local',
                type: 'expense',
                amount: finalAmount,
                date: instDate,
                category: editCategory,
                description: instDesc,
                payment_status: 'pending',
                payment_date: null,
                due_date: instDueDate,
                is_recurring: true,
                recurrence_frequency: editRecurrenceFrequency,
                recurrence_installments: numInstallments,
                recurrence_group_id: recurrenceGroupId,
                installment_number: i,
                installment_total: numInstallments,
                installment_index: i,
                total_installments: numInstallments,
                start_km: null,
                end_km: null,
                deliveries: null,
                out_of_neighborhood: null,
                vehicle_id: finalVehicleId || undefined,
                created_at: new Date().toISOString()
              };

              futureBatch.push(instPayload);
              syncQueueManager.enqueue('transactions', 'insert', instId, instPayload);
            }

            if (futureBatch.length > 0) {
              setTransactions(prev => {
                const newState = [...futureBatch, ...prev];
                cacheManager.set(`transactions_${oldTx?.user_id || 'local'}`, newState, undefined, 'transactions');
                return newState;
              });
            }
            toast.success(`Despesa convertida em recorrente com ${numInstallments} parcelas geradas!`);
          } else {
            toast.success('Despesa configurada como recorrente.');
          }
        } else {
          // Scenario B: Updating an existing recurring series
          const currentGroup = oldTx.recurrence_group_id;
          const currentInstNumber = oldTx.installment_number || (oldTx as any).installment_index || 1;
          
          recurrenceFields = {
            is_recurring: true,
            recurrence_frequency: editRecurrenceFrequency,
            recurrence_installments: numInstallments,
            installment_number: currentInstNumber,
            installment_total: numInstallments,
            installment_index: currentInstNumber,
            total_installments: numInstallments,
          };

          // Apply changes to subsequent installments in group if requested
          if (editApplyToFuture && currentGroup) {
            const subsequentTxs = transactions.filter(
              t => t.recurrence_group_id === currentGroup && 
                   t.id !== oldTx.id && 
                   (t.installment_number || (t as any).installment_index || 0) > currentInstNumber
            );

            if (subsequentTxs.length > 0) {
              const updatedSubsequent = subsequentTxs.map(subTx => {
                const subInstNumber = subTx.installment_number || (subTx as any).installment_index || 2;
                const cleanBaseDesc = (editDesc.trim() || editCategory || 'Despesa').replace(/\s*\(\d+\/\d+\)$/, '');
                const subDesc = `${cleanBaseDesc} (${subInstNumber}/${numInstallments})`;

                const updatedSub: Transaction = {
                  ...subTx,
                  amount: finalAmount,
                  category: editCategory,
                  description: subDesc,
                  vehicle_id: finalVehicleId || undefined,
                  recurrence_frequency: editRecurrenceFrequency,
                  recurrence_installments: numInstallments,
                  installment_total: numInstallments,
                  total_installments: numInstallments,
                };

                syncQueueManager.enqueue('transactions', 'update', subTx.id, {
                  amount: finalAmount,
                  category: editCategory,
                  description: subDesc,
                  vehicle_id: finalVehicleId || undefined,
                  recurrence_frequency: editRecurrenceFrequency,
                  recurrence_installments: numInstallments,
                  installment_total: numInstallments,
                  total_installments: numInstallments,
                });

                return updatedSub;
              });

              setTransactions(prev => {
                const mapUpdated = new Map(updatedSubsequent.map(u => [u.id, u]));
                const newState = prev.map(item => mapUpdated.get(item.id) || item);
                cacheManager.set(`transactions_${oldTx?.user_id || 'local'}`, newState, undefined, 'transactions');
                return newState;
              });

              toast.success(`Atualizada esta e mais ${subsequentTxs.length} parcelas futuras do grupo!`);
            }
          }
        }
      } else if (oldTx?.is_recurring) {
        // Scenario C: Turning recurrence off
        recurrenceFields = {
          is_recurring: false,
          recurrence_frequency: null as any,
          recurrence_installments: null as any,
          recurrence_group_id: null as any,
          installment_number: null as any,
          installment_total: null as any,
          installment_index: null as any,
          total_installments: null as any,
        };
        toast.success('Recorrência desativada para este lançamento.');
      }
    }

    const txUpdatePayload = {
      amount: finalAmount,
      category: editCategory,
      description: recurrenceFields.description || editDesc,
      type: editType,
      date: editDate,
      start_km: editStartKm ? Number(editStartKm) : null,
      end_km: editEndKm ? Number(editEndKm) : null,
      deliveries: editCategory === 'Pizzaria' && editDeliveries !== '' ? Number(editDeliveries) : null,
      out_of_neighborhood: editCategory === 'Pizzaria' && editOutOfNeighborhood !== '' ? Number(editOutOfNeighborhood) : null,
      payment_status: effectivePaymentStatus,
      payment_date: effectivePaymentDate,
      due_date: effectiveDueDate,
      vehicle_id: finalVehicleId,
      ...recurrenceFields,
    };

    await updateTransaction(editItem.id, txUpdatePayload);

    // Keep matching reserve transaction in sync!
    if (oldTx && (oldTx.is_reserve_use || oldTx.description?.startsWith('[Reserva]'))) {
      const matchRt = (reserveTransactions || []).find(
        rt => rt.type === 'utilizacao' && 
              rt.date === oldTx.date && 
              Math.abs(Number(rt.amount) - Number(oldTx.amount)) < 0.01
      );
      if (matchRt) {
        await updateReserveTransaction(matchRt.id, {
          amount: finalAmount,
          date: editDate,
          category: editCategory,
          description: editDesc?.startsWith('[Reserva]') ? editDesc.replace(/^\[Reserva\]\s*/, '') : editDesc,
          payment_status: effectivePaymentStatus,
          payment_date: effectivePaymentDate,
          due_date: effectiveDueDate,
          vehicle_id: finalVehicleId || undefined,
        });
      }
    }

    if (!editIsRecurring || oldTx?.is_recurring) {
      toast.success('Lançamento atualizado com sucesso!');
    }
    setEditItem(null);
    setEditVehicleId('');
    setShowEditVehicleSelect(false);
    setSaving(false);
  };

  const askDelete = (id: string, type: 'transaction' | 'reserve_transaction' | 'investment_transaction' | 'dividend') => {
    setDeleteConfirmId(id);
    setDeleteConfirmType(type);
  };

  const handleExecuteDelete = async () => {
    if (!deleteConfirmId || !deleteConfirmType || isDeleting) return;
    setIsDeleting(true);
    try {
      if (deleteConfirmType === 'transaction') {
        await deleteTransaction(deleteConfirmId);
      } else if (deleteConfirmType === 'investment_transaction') {
        await deleteInvestmentTransaction(deleteConfirmId);
        toast.success('Movimentação de investimento excluída');
        await refreshData(true);
      } else if (deleteConfirmType === 'dividend') {
        await deleteDividend(deleteConfirmId);
        toast.success('Lançamento de dividendo excluído');
        await refreshData(true);
      } else {
        await deleteReserveTransaction(deleteConfirmId);
        toast.success('Movimentação de reserva excluída');
        await refreshData(true);
      }
    } catch (err) {
      toast.error('Erro ao excluir lançamento');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
      setDeleteConfirmType(null);
    }
  };

  const formatCurrency = (val: number) => {
    if (hideValues) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatCompactValue = (val: number) => {
    if (hideValues) return 'R$ •••';
    const formatted = formatCurrency(val);
    return formatted.endsWith(',00') ? formatted.slice(0, -3) : formatted;
  };

  const getTransactionReserveContributions = (t: Transaction) => {
    if (!reserves || reserves.length === 0) return [];

    return reserves
      .map(r => {
        const roundedBalance = Math.round((r.saldo_atual || 0) * 100) / 100;
        const roundedGoal = Math.round((r.meta_objetivo || 0) * 100) / 100;
        const isGoalReached = Boolean(roundedGoal > 0 && roundedBalance >= roundedGoal);
        const isPaused = r.status === 'inactive' || r.is_paused;

        if (isPaused || isGoalReached) {
          return { reserve: r, amount: 0 };
        }

        const isDefaultReserve = r.name === 'Reserva de Manutenção' || r.name === 'Reserva de Emergência';
        if (r.created_at && !isDefaultReserve) {
          const creationDay = r.created_at.split('T')[0];
          if (t.date < creationDay) {
            return { reserve: r, amount: 0 };
          }
        }

        // Temporal rule resolution
        const ruleInfo = getActiveRuleForDate(r, t.date);
        const activeRule = {
          regra_ativa: ruleInfo.regra_ativa,
          regra_tipo: ruleInfo.regra_tipo,
          regra_valor: ruleInfo.regra_valor,
          regra_categorias: ruleInfo.regra_categorias || [],
        };

        if (!activeRule.regra_ativa || !activeRule.regra_tipo) return { reserve: r, amount: 0 };

        const ruleValue = Number(activeRule.regra_valor) || 0;
        const ruleCats = activeRule.regra_categorias || [];
        let rAmount = 0;

        if (activeRule.regra_tipo === 'km') {
          const isEligible = ruleCats.includes(t.category);
          if (isEligible && t.start_km != null && t.end_km != null) {
            const dist = Number(t.end_km) - Number(t.start_km);
            if (dist > 0) {
              rAmount = dist * ruleValue;
            }
          }
        } else if (activeRule.regra_tipo === 'bruto') {
          const isEligible = ruleCats.includes(t.category);
          if (isEligible && t.type === 'income') {
            rAmount = Number(t.amount || 0) * (ruleValue / 100);
          }
        } else if (activeRule.regra_tipo === 'fixo') {
          const isEligible = ruleCats.includes(t.category);
          if (isEligible && t.type === 'income') {
            const parsedDate = t.date;
            const eligibleOnDay = transactions.filter(
              other => other.date === parsedDate && 
                       other.type === 'income' && 
                       ruleCats.includes(other.category)
            );
            const firstEligible = eligibleOnDay[eligibleOnDay.length - 1];
            if (firstEligible && firstEligible.id === t.id) {
              rAmount = ruleValue;
            }
          }
        } else if (activeRule.regra_tipo === 'liquido') {
          const factor = ruleValue / 100;
          if (t.type === 'income') {
            rAmount = Number(t.amount || 0) * factor;
          } else {
            rAmount = -Number(t.amount || 0) * factor;
          }
        }

        return { reserve: r, amount: rAmount };
      })
      .filter(item => item.amount !== 0);
  };

  const calculateFuel = (start: string | number | null, end: string | number | null) => {
    if (!settings || !settings.vehicle_km_per_liter || !settings.fuel_price || start === null || start === undefined || end === null || end === undefined) return 0;
    const sKm = Number(start);
    const eKm = Number(end);
    if (eKm <= sKm) return 0;
    const distance = eKm - sKm;
    return (distance / settings.vehicle_km_per_liter) * settings.fuel_price;
  };

  const adjustTransactionsForReserves = (txs: Transaction[]) => {
    return txs;
  };

  const allTransactions = useMemo(() => {
    // Create virtual transaction objects for reserve transactions
    const reserveTxsAsVirtual = (reserveTransactions || [])
      .filter(rt => {
        if (rt.linked_investment_id) {
          return false;
        }
        // Evita duplicar provento/dividendo gerenciado pela página de investimentos com o lançamento das reservas
        const isLinkedToDividend = (dividends || []).some(d => d.transaction_id === rt.id);
        if (isLinkedToDividend) {
          return false;
        }
        return rt.type === 'aporte' || rt.type === 'rendimento' || rt.type === 'utilizacao';
      })
      .map(rt => {
        const matchedRes = reserves.find(r => r.id === rt.reserve_id);
        const reserveName = matchedRes ? matchedRes.name : 'Reserva';
        const isRendimento = rt.type === 'rendimento';
        const isUtilizacao = rt.type === 'utilizacao';
        const effectiveCategory = isRendimento
          ? 'Rendimentos'
          : (isUtilizacao
              ? (rt.category || matchedRes?.default_use_category || 'Manutenção')
              : 'Aporte Reserva');
        return {
          id: rt.id,
          user_id: rt.user_id,
          type: isRendimento ? 'income' : 'expense' as const,
          amount: Number(rt.amount),
          date: rt.date,
          category: effectiveCategory,
          description: rt.description || (isRendimento ? `Rendimento da ${reserveName}` : (isUtilizacao ? `Utilização da ${reserveName}` : `Aporte para ${reserveName}`)),
          isReserveTx: true,
          reserveTxType: rt.type,
          reserveId: rt.reserve_id,
          reserveName: reserveName,
          reserveColor: matchedRes?.color || '#ec4899',
          reserveIcon: matchedRes?.icon || 'PiggyBank',
          created_at: rt.created_at,
          originalCategory: rt.category,
          linkedInvestmentId: rt.linked_investment_id,
          payment_status: rt.payment_status || 'paid',
          payment_date: rt.payment_date,
          due_date: rt.due_date,
          is_recurring: rt.is_recurring,
          recurrence_frequency: rt.recurrence_frequency,
          recurrence_installments: rt.recurrence_installments,
          recurrence_group_id: rt.recurrence_group_id,
          installment_number: rt.installment_number,
          installment_total: rt.installment_total,
          installment_index: rt.installment_index,
          total_installments: rt.total_installments,
        } as unknown as Transaction;
      });

    // Create virtual transaction objects for investment transactions
    const investmentTxsAsVirtual = (investmentTransactions || [])
      .map(it => {
        const isBuy = it.operation === 'buy';
        const totalAmount = (Number(it.price) * Number(it.quantity)) + Number(it.costs || 0);
        return {
          id: it.id,
          user_id: it.user_id,
          type: isBuy ? 'expense' : 'income' as const,
          amount: totalAmount,
          date: it.date,
          category: 'Investimentos',
          description: it.description || `${isBuy ? 'Compra' : 'Venda'} de ${it.quantity} un do ativo ${it.ticker.toUpperCase()}`,
          isInvestmentTx: true,
          investmentType: it.asset_type,
          investmentTxType: it.operation,
          ticker: it.ticker.toUpperCase(),
          quantity: it.quantity,
          price: it.price,
          costs: it.costs || 0,
          created_at: it.created_at,
        } as unknown as Transaction;
      });

    // Create virtual transaction objects for dividend payments
    const dividendTxsAsVirtual = (dividends || [])
      .map(d => {
        const isProvisioned = d.status === 'provisioned';
        return {
          id: d.id,
          user_id: d.user_id,
          type: 'income' as const,
          amount: Number(d.amount),
          date: d.date,
          category: 'Dividendos',
          description: isProvisioned
            ? `[A Receber] ${d.description || `Provento (${d.type}) do ativo ${d.ticker.toUpperCase()}`}`
            : `[Recebido] ${d.description || `Recebimento de proventos (${d.type}) do ativo ${d.ticker.toUpperCase()}`}`,
          isDividendTx: true,
          dividendType: d.type,
          dividendStatus: d.status,
          ticker: d.ticker.toUpperCase(),
          created_at: d.created_at,
        } as unknown as Transaction;
      });

    return [...transactions, ...reserveTxsAsVirtual, ...investmentTxsAsVirtual, ...dividendTxsAsVirtual];
  }, [transactions, reserveTransactions, reserves, investmentTransactions, dividends]);

  const allTransactionsAdjusted = useMemo(() => {
    const base = adjustTransactionsForReserves(allTransactions);
    return base.map(t => {
      // Data efetiva para o extrato, gráficos e agrupamentos diários:
      // Se pendente, vai para a data de vencimento (due_date) ou date
      // Se pago, vai para payment_date ou date
      const effectiveDate = t.payment_status === 'pending'
        ? (t.due_date || t.date)
        : (t.payment_date || t.date);

      return {
        ...t,
        date: effectiveDate,
        originalDate: t.date,
      };
    });
  }, [allTransactions, settings]);

  const periodFiltered = useMemo(() => {
    const now = new Date();
    return allTransactionsAdjusted.filter(t => {
      if (globalPeriod === 'all') return true;
      const d = parseLocalDate(t.date);
      // Ajuste para não precisar considerar fuso, mas simplificado para a data do lancamento vs período atual
      // O add/subMonths baseia-se na data/hora do sistema, é razoável para a comparação.
      if (globalPeriod === 'today') {
        return isWithinInterval(d, { start: startOfDay(now), end: endOfDay(now) });
      } else if (globalPeriod === 'yesterday') {
        return isWithinInterval(d, { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) });
      } else if (globalPeriod === 'last7Days') {
        return isWithinInterval(d, { start: startOfDay(subDays(now, 6)), end: endOfDay(now) });
      } else if (globalPeriod === 'last30Days') {
        return isWithinInterval(d, { start: startOfDay(subDays(now, 29)), end: endOfDay(now) });
      } else if (globalPeriod === 'last90Days') {
        return isWithinInterval(d, { start: startOfDay(subDays(now, 89)), end: endOfDay(now) });
      } else if (globalPeriod === 'week') {
        return isWithinInterval(d, { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) });
      } else if (globalPeriod === 'month') {
        return isWithinInterval(d, { start: startOfMonth(now), end: endOfMonth(now) });
      } else if (globalPeriod === 'lastMonth') {
        const lastM = subMonths(now, 1);
        return isWithinInterval(d, { start: startOfMonth(lastM), end: endOfMonth(lastM) });
      } else if (globalPeriod === 'last3Months') {
        return isWithinInterval(d, { start: startOfDay(subMonths(now, 3)), end: endOfDay(now) });
      } else if (globalPeriod === 'thisYear') {
        return isWithinInterval(d, { start: startOfYear(now), end: endOfDay(now) });
      } else if (globalPeriod === 'lastYear') {
        const lastY = subYears(now, 1);
        return isWithinInterval(d, { start: startOfYear(lastY), end: endOfYear(lastY) });
      } else if (globalPeriod === 'custom' && customDateRange && customDateRange.start && customDateRange.end) {
        try {
          const startD = parseLocalDate(customDateRange.start);
          const endD = parseLocalDate(customDateRange.end);
          if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
            return isWithinInterval(d, { start: startOfDay(startD), end: endOfDay(endD) });
          }
        } catch {
          return true;
        }
      }
      return true;
    });
  }, [allTransactionsAdjusted, globalPeriod, customDateRange]);

  const summaries = useMemo(() => {
    let patrimonio = settings?.initial_balance || 0;
    let ganhosBrutos = 0;
    let gastosPeriodo = 0;
    let reserveAporte = 0;
    let reserveExpense = 0;
    let opExpensePuro = 0;
    let perExpense = 0;
    let rendimentosReserva = 0;
    
    let rawReserveAporte = 0;

    let totalCompraInvestimento = 0;
    let totalVendaInvestimento = 0;
    let totalDividendosRecebidos = 0;
    
    transactions.forEach(t => {
      if (t.payment_status === 'pending') return;
      const amount = Number(t.amount);
      // Skip internal transfers for patrimonio (Caixa + Reservas)
      if (t.category === 'Aporte Reserva' || t.category === 'Resgate Reserva' || t.category === 'Resgate de Reserva' || (t as any).isReserveTx || (t as any).isReserveAporte) {
        return;
      }
      if (t.type === 'income') patrimonio += amount;
      else patrimonio -= amount;
    });

    // Subtract investment buys and add sells from cash balance (outflows/inflows)
    (investmentTransactions || []).forEach(tx => {
      if ((tx as any).payment_status === 'pending') return;
      if (tx.reserve_id) return; // Handled by reserveTransactions
      const amount = (Number(tx.price) * Number(tx.quantity)) + Number(tx.costs || 0);
      if (tx.operation === 'buy') {
        patrimonio -= amount;
      } else {
        patrimonio += amount;
      }
    });

    // Include 'rendimento' and spent 'utilizacao' from reserves into total liquid net
    (reserveTransactions || []).forEach(rt => {
      if (rt.payment_status === 'pending') return;
      if (rt.type === 'rendimento') {
        patrimonio += Number(rt.amount);
      } else if (rt.type === 'utilizacao') {
        const cat = (rt.category || '').toLowerCase().trim();
        const isPureResgateToCash = !rt.linked_investment_id && (!cat || cat === 'resgate' || cat === 'resgate reserva' || cat === 'resgate de reserva' || cat === 'outros');
        if (!isPureResgateToCash) {
          patrimonio -= Number(rt.amount);
        }
      } else if (rt.type === 'aporte') {
        const cat = (rt.category || '').toLowerCase().trim();
        const isFromInvestmentSell = rt.linked_investment_id || cat === 'investimentos' || (rt.description && rt.description.includes('Investimento:'));
        if (isFromInvestmentSell) {
          patrimonio += Number(rt.amount);
        }
      }
    });

    const totalInReserves = (reserves || []).reduce((sum, r) => sum + (r.saldo_atual || 0), 0);
    const bancaLivre = patrimonio - totalInReserves;

    const opCats = settings?.operational_expense_categories || ['Combustível', 'Pedágio', 'Manutenção'];

    periodFiltered.forEach(t => {
      if (t.payment_status === 'pending') {
        return;
      }
      const amount = Number(t.amount);
      const isInvestment = (t as any).isInvestmentTx;
      const isDividend = (t as any).isDividendTx;

      const isReserveRendimento = ((t as any).isReserveTx && (t as any).reserveTxType === 'rendimento') || (t as any).isDividendTx;
      if (isReserveRendimento) {
        rendimentosReserva += amount;
      }

      if (isInvestment) {
        if (t.type === 'income') {
          totalVendaInvestimento += amount;
          return;
        } else {
          totalCompraInvestimento += amount;
          return;
        }
      }

      if (isDividend) {
        totalDividendosRecebidos += amount;
        return;
      }

      const isReserveUse = t.is_reserve_use || t.description?.startsWith('[Reserva]') || ((t as any).isReserveTx === true && (t as any).reserveTxType === 'utilizacao');
      const isAporte = t.category === 'Aporte Reserva' || (t as any).reserveTxType === 'aporte';
      
      const isInvestmentReserveUse = (t as any).isReserveTx === true && (t as any).reserveTxType === 'utilizacao' && (
        (t as any).originalCategory === 'Investimentos' || 
        (t as any).linkedInvestmentId || 
        t.description?.includes('Investimento:')
      );

      if (t.type === 'income') {
        const isReserveTx = (t as any).isReserveTx === true;
        const isDividendTx = (t as any).isDividendTx === true;
        const isInvestmentTx = (t as any).isInvestmentTx === true;
        const isResgateReserva = t.category === 'Resgate Reserva';
        const isReserveInternalTransfer = isReserveTx && ((t as any).reserveTxType === 'utilizacao' || (t as any).reserveTxType === 'aporte');

        if (!isInvestmentTx && !isResgateReserva && !isReserveInternalTransfer) {
          ganhosBrutos += amount;
        }
      } else {
        if (isInvestmentReserveUse) {
          // Do not consider investment redemptions as expenses/costs that leave the patrimony
          return;
        }

        if (isAporte) {
          rawReserveAporte += amount;
        } else if (isReserveUse) {
          const rawAmt = (t as any).rawAmount !== undefined ? Number((t as any).rawAmount) : amount;
          reserveExpense += rawAmt;
          
          const effectiveCat = (t as any).originalCategory || t.category;
          if (isOperationalCategory(effectiveCat, opCats)) {
            opExpensePuro += amount;
          } else {
            perExpense += amount;
          }
        } else {
          // Regular expenses
          if (isOperationalCategory(t.category, opCats)) {
            opExpensePuro += amount;
          } else {
            perExpense += amount;
          }
        }
      }
    });

    reserveAporte = rawReserveAporte - reserveExpense;
    gastosPeriodo = opExpensePuro + perExpense;
    const standardExpense = opExpensePuro + perExpense + reserveAporte;

    // Caixa Líquido (Caixa Liq.): Faturamento - Gasto Pessoal - Operacional - Aportes
    const lucroLiquido = ganhosBrutos - standardExpense;
    
    // Líquido Real (Líq. Real): Consenso Patrimonial (lucro líquido + aportes em reserva)
    const lucroReal = lucroLiquido + reserveAporte;
    
    const transactionCount = periodFiltered.length;

    return { 
      patrimonio, 
      bancaLivre, 
      totalInReserves, 
      ganhosBrutos, 
      gastosPeriodo, 
      lucroLiquido, 
      lucroReal,
      opExpensePuro,
      perExpense,
      reserveAporte,
      reserveExpense,
      transactionCount,
      totalCompraInvestimento,
      totalVendaInvestimento,
      totalDividendosRecebidos
    };
  }, [transactions, periodFiltered, settings, reserves, investmentTransactions, dividends]);

  const totalInvestmentEquity = useMemo(() => {
    const posMap: Record<string, number> = {};
    (investmentTransactions || []).forEach(tx => {
      if ((tx as any).payment_status === 'pending') return;
      const q = Number(tx.quantity);
      if (tx.operation === 'buy') {
        posMap[tx.ticker] = (posMap[tx.ticker] || 0) + q;
      } else {
        posMap[tx.ticker] = (posMap[tx.ticker] || 0) - q;
      }
    });

    return Object.entries(posMap).reduce((acc, [ticker, quantity]) => {
      if (quantity <= 0) return acc;
      const price = quotes?.[ticker] || 0;
      if (price > 0) {
        return acc + (price * quantity);
      }
      const lastTx = (investmentTransactions || [])
        .filter(t => t.ticker === ticker && (t as any).payment_status !== 'pending')
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
      const fallbackPrice = lastTx ? Number(lastTx.price) : 0;
      return acc + (fallbackPrice * quantity);
    }, 0);
  }, [investmentTransactions, quotes]);

  const patrimonioPorDia = useMemo(() => {
    if (!transactions) return { dailyAccumulated: [], initialBalance: 0 };
    const events = [
      ...transactions.filter(t => t.payment_status !== 'pending').map(t => {
        const effectiveDate = (t.payment_date || t.date || '').split('T')[0];
        const isReserveInternal = Boolean(
          (t as any).isReserveTx || 
          (t as any).isReserveAporte || 
          t.category === 'Aporte Reserva' || 
          t.category === 'Aporte Extra' || 
          t.category === 'Resgate Reserva' || 
          t.category === 'Resgate de Reserva'
        );
        return {
          date: effectiveDate,
          amount: Number(t.amount),
          type: t.type,
          category: t.category,
          isReserveTx: isReserveInternal,
          reserveTxType: undefined,
          isInvestment: false as const,
          ticker: undefined,
          operation: undefined,
          quantity: undefined,
          price: undefined,
          costs: undefined,
          reserve_id: undefined,
          linked_investment_id: undefined,
          description: t.description,
          created_at: t.created_at
        };
      }),
      ...(reserveTransactions || [])
        .filter(rt => rt.payment_status !== 'pending')
        .map(rt => {
          const effectiveDate = (rt.payment_date || rt.date || '').split('T')[0];
          return {
            date: effectiveDate,
            amount: Number(rt.amount),
            type: rt.type === 'rendimento' ? ('income' as const) : (rt.type === 'aporte' ? ('income' as const) : ('expense' as const)),
            category: rt.category,
            isReserveTx: true as const,
            reserveTxType: rt.type,
            isInvestment: false as const,
            ticker: undefined,
            operation: undefined,
            quantity: undefined,
            price: undefined,
            costs: undefined,
            reserve_id: rt.reserve_id,
            linked_investment_id: rt.linked_investment_id,
            description: rt.description,
            created_at: rt.created_at
          };
        }),
      ...(investmentTransactions || []).filter(tx => (tx as any).payment_status !== 'pending').map(tx => {
        const amount = (Number(tx.price) * Number(tx.quantity)) + Number(tx.costs || 0);
        const effectiveDate = (tx.date || '').split('T')[0];
        return {
          date: effectiveDate,
          amount,
          type: tx.operation === 'buy' ? ('expense' as const) : ('income' as const),
          category: undefined,
          isReserveTx: false as const,
          reserveTxType: undefined,
          isInvestment: true as const,
          ticker: tx.ticker.toUpperCase(),
          operation: tx.operation,
          quantity: Number(tx.quantity),
          price: Number(tx.price),
          costs: Number(tx.costs || 0),
          reserve_id: tx.reserve_id,
          linked_investment_id: tx.id,
          description: undefined,
          created_at: tx.created_at
        };
      })
    ];

    const sorted = events.sort((a, b) => {
      const dComp = a.date.localeCompare(b.date);
      if (dComp !== 0) return dComp;
      return (a.created_at || '').localeCompare(b.created_at || '');
    });

    let currentCash = settings?.initial_balance || 0;
    const portfolio: Record<string, number> = {};
    const dailyAccumulated: { dateStr: string; cash: number; patrimonio: number }[] = [];

    sorted.forEach(evt => {
      const dateStr = evt.date;

      if (evt.isInvestment) {
        // Update the portfolio quantities
        const qtyChange = evt.operation === 'buy' ? evt.quantity! : -evt.quantity!;
        portfolio[evt.ticker!] = (portfolio[evt.ticker!] || 0) + qtyChange;

        // If this investment transaction has NO reserve_id, it directly affected liquid cash
        if (!evt.reserve_id) {
          const cashChange = evt.operation === 'buy' ? -evt.amount : evt.amount;
          currentCash += cashChange;
        }
      } else if (evt.isReserveTx) {
        if (evt.reserveTxType === 'rendimento') {
          currentCash += evt.amount;
        } else if (evt.reserveTxType === 'utilizacao') {
          const cat = (evt.category || '').toLowerCase().trim();
          const isPureResgateToCash = !evt.linked_investment_id && (!cat || cat === 'resgate' || cat === 'resgate reserva' || cat === 'resgate de reserva' || cat === 'outros');
          if (!isPureResgateToCash) {
            currentCash -= evt.amount;
          }
        } else if (evt.reserveTxType === 'aporte') {
          const cat = (evt.category || '').toLowerCase().trim();
          const isFromInvestmentSell = evt.linked_investment_id || cat === 'investimentos' || (evt.description && evt.description.includes('Investimento:'));
          if (isFromInvestmentSell) {
            currentCash += evt.amount;
          }
        }
      } else {
        const isInternalTransfer = Boolean(
          evt.category === 'Aporte Reserva' || 
          evt.category === 'Aporte Extra' || 
          evt.category === 'Resgate Reserva' || 
          evt.category === 'Resgate de Reserva' || 
          evt.isReserveTx
        );
        if (!isInternalTransfer) {
          if (evt.type === 'income') {
            currentCash += evt.amount;
          } else {
            currentCash -= evt.amount;
          }
        }
      }

      // Calculate portfolio value for the state at this point
      const portfolioValue = Object.entries(portfolio).reduce((acc, [ticker, qty]) => {
        if (qty <= 0) return acc;
        const currentQuote = quotes?.[ticker] || 0;
        if (currentQuote > 0) {
          return acc + (currentQuote * qty);
        }
        // Latest transaction price of that ticker up to this date
        const lastTx = (investmentTransactions || [])
          .filter(tx => tx.ticker.toUpperCase() === ticker.toUpperCase() && (tx.date || '').split('T')[0] <= evt.date)
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
        const fallbackPrice = lastTx ? Number(lastTx.price) : 0;
        return acc + (fallbackPrice * qty);
      }, 0);

      const currentPatrimonio = currentCash + portfolioValue;

      const lastIndex = dailyAccumulated.findIndex(item => item.dateStr === dateStr);
      if (lastIndex !== -1) {
        dailyAccumulated[lastIndex].cash = currentCash;
        dailyAccumulated[lastIndex].patrimonio = currentPatrimonio;
      } else {
        dailyAccumulated.push({
          dateStr,
          cash: currentCash,
          patrimonio: currentPatrimonio
        });
      }
    });

    // Ensure today's entry is represented in dailyAccumulated with current portfolio value
    const todayStr = getTodayLocalDateStr();
    const currentPortfolioVal = Object.entries(portfolio).reduce((acc, [ticker, qty]) => {
      if (qty <= 0) return acc;
      const currentQuote = quotes?.[ticker] || 0;
      if (currentQuote > 0) {
        return acc + (currentQuote * qty);
      }
      const lastTx = (investmentTransactions || [])
        .filter(tx => tx.ticker.toUpperCase() === ticker.toUpperCase() && (tx.date || '').split('T')[0] <= todayStr)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
      const fallbackPrice = lastTx ? Number(lastTx.price) : 0;
      return acc + (fallbackPrice * qty);
    }, 0);

    const todayIdx = dailyAccumulated.findIndex(item => item.dateStr === todayStr);
    if (todayIdx !== -1) {
      dailyAccumulated[todayIdx].patrimonio = dailyAccumulated[todayIdx].cash + currentPortfolioVal;
    } else {
      dailyAccumulated.push({
        dateStr: todayStr,
        cash: currentCash,
        patrimonio: currentCash + currentPortfolioVal
      });
      dailyAccumulated.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    }

    return {
      dailyAccumulated,
      initialBalance: settings?.initial_balance || 0
    };
  }, [transactions, reserveTransactions, investmentTransactions, settings, quotes]);

  const getPatrimonioAtDate = (date: Date) => {
    const targetStr = format(date, 'yyyy-MM-dd');
    const todayStr = getTodayLocalDateStr();
    const { dailyAccumulated, initialBalance } = patrimonioPorDia;

    const hasFutureTxs = transactions.some(t => {
      if (t.payment_status === 'pending') return false;
      const d = (t.payment_date || t.date || '').split('T')[0];
      return d > targetStr;
    });
    const hasFutureReserveTxs = (reserveTransactions || []).some(rt => {
      if (rt.payment_status === 'pending') return false;
      const d = (rt.payment_date || rt.date || '').split('T')[0];
      return d > targetStr;
    });
    const hasFutureInvTxs = (investmentTransactions || []).some(it => {
      if ((it as any).payment_status === 'pending') return false;
      const d = (it.date || '').split('T')[0];
      return d > targetStr;
    });

    if (targetStr >= todayStr && !hasFutureTxs && !hasFutureReserveTxs && !hasFutureInvTxs) {
      return summaries.patrimonio + totalInvestmentEquity;
    }
    
    let lastKnownValue = initialBalance;
    for (const item of dailyAccumulated) {
      if (item.dateStr <= targetStr) {
        lastKnownValue = item.patrimonio;
      }
    }
    return lastKnownValue;
  };

  const getCashAtDate = (date: Date) => {
    const targetStr = format(date, 'yyyy-MM-dd');
    const todayStr = getTodayLocalDateStr();
    const { dailyAccumulated, initialBalance } = patrimonioPorDia;

    const hasFutureTxs = transactions.some(t => {
      if (t.payment_status === 'pending') return false;
      const d = (t.payment_date || t.date || '').split('T')[0];
      return d > targetStr;
    });
    const hasFutureReserveTxs = (reserveTransactions || []).some(rt => {
      if (rt.payment_status === 'pending') return false;
      const d = (rt.payment_date || rt.date || '').split('T')[0];
      return d > targetStr;
    });

    if (targetStr >= todayStr && !hasFutureTxs && !hasFutureReserveTxs) {
      return summaries.patrimonio;
    }
    
    let lastKnownValue = initialBalance;
    for (const item of dailyAccumulated) {
      if (item.dateStr <= targetStr) {
        lastKnownValue = item.cash;
      }
    }
    return lastKnownValue;
  };

  const getReservesAtDate = (date: Date) => {
    const targetStr = format(date, 'yyyy-MM-dd');
    const todayStr = getTodayLocalDateStr();

    const hasFutureReserveTxs = (reserveTransactions || []).some(rt => {
      if (rt.payment_status === 'pending') return false;
      const d = (rt.payment_date || rt.date || '').split('T')[0];
      return d > targetStr;
    });

    if (targetStr >= todayStr && !hasFutureReserveTxs) {
      return summaries.totalInReserves;
    }
    
    let total = 0;
    
    (reserves || []).forEach(r => {
      const isDefaultReserve = r.name === 'Reserva de Manutenção' || r.name === 'Reserva de Emergência';
      let shouldIncludeInitial = true;
      if (r.created_at && !isDefaultReserve) {
        const creationDayStr = r.created_at.split('T')[0];
        if (creationDayStr > targetStr) {
          shouldIncludeInitial = false;
        }
      }
      if (shouldIncludeInitial) {
        total += Number(r.saldo_inicial || 0);
      }
    });

    (reserveTransactions || []).forEach(rt => {
      if (rt.payment_status === 'pending') return;
      const rtDateStr = (rt.payment_date || rt.date || '').split('T')[0];
      if (rtDateStr <= targetStr) {
        if (rt.type === 'aporte' || rt.type === 'rendimento') {
          total += Number(rt.amount);
        } else if (rt.type === 'utilizacao') {
          total -= Number(rt.amount);
        }
      }
    });
    return total;
  };

  const getBancaAtDate = (date: Date) => {
    const targetStr = format(date, 'yyyy-MM-dd');
    const todayStr = getTodayLocalDateStr();

    const hasFutureTxs = transactions.some(t => {
      if (t.payment_status === 'pending') return false;
      const d = (t.payment_date || t.date || '').split('T')[0];
      return d > targetStr;
    });
    const hasFutureReserveTxs = (reserveTransactions || []).some(rt => {
      if (rt.payment_status === 'pending') return false;
      const d = (rt.payment_date || rt.date || '').split('T')[0];
      return d > targetStr;
    });

    // Se hoje ou futuro sem movimentações além desta data:
    // o Caixa Acumulado é exatamente a Banca Livre do Dashboard!
    if (targetStr >= todayStr && !hasFutureTxs && !hasFutureReserveTxs) {
      return summaries.bancaLivre;
    }

    return getCashAtDate(date) - getReservesAtDate(date);
  };

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    periodFiltered.forEach(t => {
      if (t.category) {
        cats.add(t.category);
      }
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [periodFiltered]);

  const uniqueTickers = useMemo(() => {
    const tickers = new Set<string>();
    (investmentTransactions || []).forEach(tx => {
      if (tx.ticker) tickers.add(tx.ticker.toUpperCase());
    });
    (dividends || []).forEach(d => {
      if (d.ticker) tickers.add(d.ticker.toUpperCase());
    });
    return Array.from(tickers).sort();
  }, [investmentTransactions, dividends]);

  const filteredTransactions = useMemo(() => {
    const opCats = settings?.operational_expense_categories || ['Combustível', 'Pedágio', 'Manutenção'];
    
    const isPendingFilterActive = filterPaymentStatus === 'pending' || filterPaymentStatus === 'overdue';
    const baseList = isPendingFilterActive ? allTransactionsAdjusted : periodFiltered;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const in30DaysStr = format(addDays(new Date(), 30), 'yyyy-MM-dd');

    let result = baseList.filter(t => {
      // Data Source Filters
      const isInvestment = (t as any).isInvestmentTx || (t as any).isDividendTx;
      const isReserve = (t as any).isReserveTx;
      const isCash = !isInvestment && !isReserve;

      if (isCash && !includeCash) return false;
      if (isReserve && !includeReserves) return false;
      if (isInvestment && !includeInvestments) return false;

      // Specific Reserve filter
      if (filterReserveId !== 'all') {
        const rId = (t as any).reserveId || (t as any).reserve_id;
        if (rId !== filterReserveId) return false;
      }

      // Specific Ticker filter
      if (filterTicker !== 'all') {
        const tk = (t as any).ticker;
        if (!tk || tk.toUpperCase() !== filterTicker.toUpperCase()) return false;
      }

      // 1. Text Search Filter (Description or Category or ID)
      const matchesSearch = (t.description?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                            t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (t.id && t.id.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;

      // 2. Type/Subtype Filter
      const isReserveUse = t.is_reserve_use || t.description?.startsWith('[Reserva]') || ((t as any).isReserveTx === true && (t as any).reserveTxType === 'utilizacao');
      
      let matchesType = true;
      if (filterType === 'all') {
        matchesType = true;
      } else if (filterType === 'income') {
        matchesType = t.type === 'income';
      } else if (filterType === 'expense') {
        matchesType = t.type === 'expense';
      } else if (filterType === 'opExpense') {
        const effectiveCat = (t as any).originalCategory || t.category;
        matchesType = t.type === 'expense' && !isReserveUse && (isOperationalCategory(effectiveCat, opCats) || t.category === 'Aporte Reserva' || (t as any).reserveTxType === 'aporte');
      } else if (filterType === 'perExpense') {
        const effectiveCat = (t as any).originalCategory || t.category;
        matchesType = t.type === 'expense' && !isReserveUse && !(isOperationalCategory(effectiveCat, opCats) || t.category === 'Aporte Reserva' || (t as any).reserveTxType === 'aporte');
      } else if (filterType === 'reserveExpense') {
        matchesType = t.type === 'expense' && isReserveUse;
      }
      if (!matchesType) return false;

      // 3. Category Filter
      if (filterCategory !== 'all' && t.category !== filterCategory) {
        return false;
      }

      // 4. Value Range Filters
      const amt = Number(t.amount);
      if (minAmount !== '' && amt < Number(minAmount)) return false;
      if (maxAmount !== '' && amt > Number(maxAmount)) return false;

      // 5. Status Filter (Confirmed: today/past vs Scheduled: future)
      if (filterStatus !== 'all') {
        const d = parseLocalDate(t.date);
        const isFuture = d > endOfDay(new Date());
        if (filterStatus === 'confirmed' && isFuture) return false;
        if (filterStatus === 'scheduled' && !isFuture) return false;
      }

      // 6. Payment Status Filter (Pending / Overdue / Paid)
      if (filterPaymentStatus !== 'all') {
        const isPending = t.payment_status === 'pending';
        const isPaid = t.payment_status === 'paid' || !t.payment_status;
        const dueDateStr = (t.due_date || t.date || '').split('T')[0];
        const isOverdue = isPending && (dueDateStr < todayStr);

        if (filterPaymentStatus === 'pending') {
          if (!isPending) return false;
          if (dueDateStr > in30DaysStr) return false;
        }
        if (filterPaymentStatus === 'overdue' && !isOverdue) return false;
        if (filterPaymentStatus === 'paid' && !isPaid) return false;
      }

      return true;
    });

    // 7. Sorting
    if (sortBy === 'date-desc') {
      result.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } else if (sortBy === 'date-asc') {
      result.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    } else if (sortBy === 'amount-desc') {
      result.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
    } else if (sortBy === 'amount-asc') {
      result.sort((a, b) => Number(a.amount || 0) - Number(b.amount || 0));
    } else if (sortBy === 'category-asc') {
      result.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
    } else if (sortBy === 'category-desc') {
      result.sort((a, b) => (b.category || '').localeCompare(a.category || ''));
    }

    return result;
  }, [periodFiltered, allTransactionsAdjusted, searchTerm, filterType, filterCategory, filterStatus, filterPaymentStatus, minAmount, maxAmount, sortBy, settings, includeCash, includeReserves, includeInvestments, filterReserveId, filterTicker]);

  const pendingSummary = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const in30DaysStr = format(addDays(new Date(), 30), 'yyyy-MM-dd');
    let pendingCount = 0;
    let totalPendingAmount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    allTransactionsAdjusted.forEach(t => {
      if (t.payment_status === 'pending') {
        const dueDateStr = (t.due_date || t.date || '').split('T')[0];
        if (dueDateStr <= in30DaysStr) {
          const amt = Number((t as any).rawAmount !== undefined ? (t as any).rawAmount : t.amount) || 0;
          pendingCount++;
          totalPendingAmount += amt;
          if (dueDateStr < todayStr) {
            overdueCount++;
            overdueAmount += amt;
          }
        }
      }
    });

    return {
      pendingCount,
      totalPendingAmount,
      overdueCount,
      overdueAmount,
    };
  }, [allTransactionsAdjusted]);

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, { 
      date: Date; 
      income: number; 
      opExpense: number; 
      opExpensePuro: number;
      reserveAporte: number;
      perExpense: number; 
      reserveExpense: number; 
      transactions: Transaction[] 
    }> = {};

    const opCats = settings?.operational_expense_categories || ['Combustível', 'Pedágio', 'Manutenção'];

    filteredTransactions.forEach(t => {
      const dateObj = parseLocalDate(t.date);
      const dateKey = format(dateObj, 'yyyy-MM-dd');

      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateObj,
          income: 0,
          opExpense: 0,
          opExpensePuro: 0,
          reserveAporte: 0,
          perExpense: 0,
          reserveExpense: 0,
          transactions: []
        };
      }
      
      const isReserveUse = t.is_reserve_use || (t as any).isReserveUseOriginal === true || t.description?.startsWith('[Reserva]') || ((t as any).isReserveTx === true && (t as any).reserveTxType === 'utilizacao');
      
      const isInvestmentReserveUse = (t as any).isReserveTx === true && (t as any).reserveTxType === 'utilizacao' && (
        (t as any).originalCategory === 'Investimentos' || 
        (t as any).linkedInvestmentId || 
        t.description?.includes('Investimento:')
      );

      const isInvestmentTx = (t as any).isInvestmentTx;
      const isPending = t.payment_status === 'pending';

      if (!isPending) {
        if (t.type === 'income') {
          if (!isInvestmentTx && t.category !== 'Resgate Reserva' && (!(t as any).isReserveTx || (t as any).reserveTxType === 'rendimento')) {
            groups[dateKey].income += Number(t.amount);
          }
        } else {
          const isAporte = t.category === 'Aporte Reserva' || (t as any).reserveTxType === 'aporte';
          if (isInvestmentTx) {
            // Do not count asset purchases as personal expenses
          } else if (isInvestmentReserveUse) {
            // Do not count as expense in daily summary metrics since it doesn't leave the net worth
          } else if (isAporte) {
            groups[dateKey].opExpense += Number(t.amount);
            groups[dateKey].reserveAporte += Number(t.amount);
          } else if (isReserveUse) {
            const rawAmt = (t as any).rawAmount !== undefined ? Number((t as any).rawAmount) : Number(t.amount);
            groups[dateKey].reserveExpense += rawAmt;
            
            const effectiveCat = (t as any).originalCategory || t.category;
            if (isOperationalCategory(effectiveCat, opCats)) {
              groups[dateKey].opExpense += Number(t.amount);
              groups[dateKey].opExpensePuro += Number(t.amount);
            } else {
              groups[dateKey].perExpense += Number(t.amount);
            }
          } else {
            if (isOperationalCategory(t.category, opCats)) {
              groups[dateKey].opExpense += Number(t.amount);
              groups[dateKey].opExpensePuro += Number(t.amount);
            } else {
              groups[dateKey].perExpense += Number(t.amount);
            }
          }
        }
      }
      groups[dateKey].transactions.push(t);
    });

    const sortedGroups = Object.values(groups);

    // Sort transactions within each day according to sortBy
    sortedGroups.forEach(g => {
      g.transactions = [...g.transactions].sort((a, b) => {
        if (sortBy === 'amount-desc') return Number(b.amount || 0) - Number(a.amount || 0);
        if (sortBy === 'amount-asc') return Number(a.amount || 0) - Number(b.amount || 0);
        if (sortBy === 'date-desc') return (b.date || '').localeCompare(a.date || '');
        return (a.date || '').localeCompare(b.date || '');
      });
    });

    if (sortBy === 'date-asc') {
      return sortedGroups.sort((a, b) => a.date.getTime() - b.date.getTime());
    } else {
      return sortedGroups.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
  }, [filteredTransactions, settings, sortBy]);

  React.useEffect(() => {
    if (highlightId && !loading && transactions.length > 0 && hasHighlightedRef.current !== highlightId) {
      const existsInTxs = transactions.some(t => t.id === highlightId);
      const existsInVirtual = (reserveTransactions || []).some(rt => rt.id === highlightId);
      
      if (existsInTxs || existsInVirtual) {
        hasHighlightedRef.current = highlightId;
        setExpandedId(highlightId);
        
        const isCurrentlyVisible = filteredTransactions.some(t => t.id === highlightId);
        if (!isCurrentlyVisible) {
          setGlobalPeriod('all');
          setFilterType('all');
          setFilterCategory('all');
          setMinAmount('');
          setMaxAmount('');
          setSearchTerm('');
        }

        setTimeout(() => {
          const el = document.getElementById(`transaction-${highlightId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 400);
      }
    }
  }, [highlightId, loading, transactions, reserveTransactions, filteredTransactions, setGlobalPeriod]);

  // Redesigned Period summaries sub-selectors
  const { avgDailyEarnings, raceCount } = useMemo(() => {
    const incomeTxs = periodFiltered.filter(t => {
      if (t.type !== 'income') return false;
      if (t.payment_status === 'pending') return false;
      const isReserveTx = (t as any).isReserveTx === true;
      const isInvestmentTx = (t as any).isInvestmentTx === true;
      const isResgateReserva = t.category === 'Resgate Reserva';
      const isReserveInternalTransfer = isReserveTx && ((t as any).reserveTxType === 'utilizacao' || (t as any).reserveTxType === 'aporte');
      return !isInvestmentTx && !isResgateReserva && !isReserveInternalTransfer;
    });

    const activeDays = new Set(incomeTxs.map(t => t.date.slice(0, 10))).size;
    const count = incomeTxs.length;
    return {
      avgDailyEarnings: activeDays > 0 ? (summaries.ganhosBrutos || 0) / activeDays : 0,
      raceCount: count
    };
  }, [periodFiltered, summaries.ganhosBrutos]);

  const { pctBanca, pctReserva, pctInvestimento } = useMemo(() => {
    const bPrice = Math.max(0, summaries.bancaLivre);
    const rPrice = Math.max(0, summaries.totalInReserves);
    const iPrice = Math.max(0, totalInvestmentEquity);
    const divisor = bPrice + rPrice + iPrice || 1;
    return {
      pctBanca: (bPrice / divisor) * 100,
      pctReserva: (rPrice / divisor) * 100,
      pctInvestimento: (iPrice / divisor) * 100
    };
  }, [summaries.bancaLivre, summaries.totalInReserves, totalInvestmentEquity]);

  const { pctOp, pctPer } = useMemo(() => {
    const op = Math.max(0, summaries.opExpensePuro);
    const pe = Math.max(0, summaries.perExpense);
    const divisor = op + pe || 1;
    return {
      pctOp: (op / divisor) * 100,
      pctPer: (pe / divisor) * 100
    };
  }, [summaries.opExpensePuro, summaries.perExpense]);

  const filteredTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach(t => {
      if (t.payment_status === 'pending') return;
      const amt = Number((t as any).rawAmount !== undefined ? (t as any).rawAmount : t.amount);
      if (t.type === 'income') {
        income += amt;
      } else {
        expense += amt;
      }
    });
    const net = income - expense;
    return { income, expense, net, count: filteredTransactions.length };
  }, [filteredTransactions]);

  const selectedTotals = useMemo(() => {
    let total = 0;
    filteredTransactions.forEach(t => {
      if (selectedIds.has(t.id)) {
        if (t.payment_status === 'pending') return;
        const amt = Number((t as any).rawAmount !== undefined ? (t as any).rawAmount : t.amount);
        total += t.type === 'income' ? amt : -amt;
      }
    });
    return { total, count: selectedIds.size };
  }, [selectedIds, filteredTransactions]);

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const handleExportCSV = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      toast.error('Nenhum lançamento para exportar.');
      return;
    }

    const headers = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor (R$)', 'Origem', 'Detalhes (KM/Entregas)'];
    const rows = filteredTransactions.map(t => {
      const isIncome = t.type === 'income';
      const amountVal = (t as any).rawAmount !== undefined ? (t as any).rawAmount : t.amount;
      const isReserve = (t as any).isReserveTx;
      const isInv = (t as any).isInvestmentTx;
      const isDiv = (t as any).isDividendTx;

      let origin = 'Conta / Caixa';
      if (isReserve) origin = `Reserva (${(t as any).reserveName || ''})`;
      else if (isInv) origin = `Investimento (${(t as any).ticker || ''})`;
      else if (isDiv) origin = `Dividendo (${(t as any).ticker || ''})`;

      let details = '';
      if (t.start_km != null && t.end_km != null) {
        details = `KM: ${t.start_km} -> ${t.end_km} (${Number(t.end_km) - Number(t.start_km)} km)`;
      } else if (t.category === 'Pizzaria' && t.deliveries != null) {
        details = `Entregas: ${t.deliveries}${t.out_of_neighborhood ? ` (Fora: ${t.out_of_neighborhood})` : ''}`;
      }

      const cleanDesc = (t.description || '').replace(/"/g, '""').replace(/\n/g, ' ');

      return [
        t.date,
        isIncome ? 'Receita' : 'Despesa',
        `"${t.category}"`,
        `"${cleanDesc}"`,
        amountVal.toFixed(2).replace('.', ','),
        `"${origin}"`,
        `"${details}"`
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `extrato_financeiro_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Extrato CSV baixado com sucesso!');
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0 || isDeleting) return;
    setIsDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const stdIds = ids.filter(id => transactions.some(t => t.id === id));
      const rtIds = ids.filter(id => (reserveTransactions || []).some(rt => rt.id === id));

      // Optimistically delete standard transactions instantly and queue
      for (const id of stdIds) {
        await deleteTransaction(id);
      }

      // Optimistically delete reserve transactions instantly and queue
      for (const id of rtIds) {
        await deleteReserveTransaction(id);
      }

      toast.success(`${selectedIds.size} lançamento(s) excluído(s) com sucesso!`);
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (err) {
      toast.error('Erro ao excluir lançamentos selecionados.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleQuickChipClick = (chipId: string) => {
    setActiveQuickChip(chipId);
    if (chipId === 'all') {
      setFilterType('all');
      setFilterCategory('all');
      setFilterPaymentStatus('all');
      setIncludeCash(true);
      setIncludeReserves(true);
      setIncludeInvestments(true);
      setSearchTerm('');
    } else if (chipId === 'pending_expenses') {
      setFilterType('all');
      setFilterCategory('all');
      setFilterPaymentStatus('pending');
      setIncludeCash(true);
      setIncludeReserves(true);
      setIncludeInvestments(false);
      setSearchTerm('');
    } else if (chipId === 'income') {
      setFilterType('income');
      setFilterCategory('all');
      setFilterPaymentStatus('all');
      setIncludeCash(true);
      setIncludeReserves(true);
      setIncludeInvestments(true);
    } else if (chipId === 'expense') {
      setFilterType('expense');
      setFilterCategory('all');
      setFilterPaymentStatus('all');
      setIncludeCash(true);
      setIncludeReserves(true);
      setIncludeInvestments(true);
    } else if (chipId === 'combustivel') {
      setFilterCategory('Combustível');
      setFilterType('all');
      setFilterPaymentStatus('all');
      setIncludeCash(true);
      setIncludeReserves(true);
      setIncludeInvestments(true);
    } else if (chipId === 'uber_ifood') {
      setFilterType('all');
      setFilterCategory('all');
      setFilterPaymentStatus('all');
      setIncludeCash(true);
      setIncludeReserves(true);
      setIncludeInvestments(true);
      setSearchTerm('uber');
    } else if (chipId === 'pizzaria') {
      setFilterCategory('Pizzaria');
      setFilterType('all');
      setFilterPaymentStatus('all');
      setIncludeCash(true);
      setIncludeReserves(true);
      setIncludeInvestments(true);
    } else if (chipId === 'reservas') {
      setFilterType('all');
      setFilterCategory('all');
      setFilterPaymentStatus('all');
      setIncludeCash(false);
      setIncludeReserves(true);
      setIncludeInvestments(false);
    } else if (chipId === 'investimentos') {
      setFilterType('all');
      setFilterCategory('all');
      setFilterPaymentStatus('all');
      setIncludeCash(false);
      setIncludeReserves(false);
      setIncludeInvestments(true);
    }
  };

  const renderTransactionItem = (t: Transaction) => {
    const isReserveTx = (t as any).isReserveTx;
    const isAporte = isReserveTx ? ((t as any).reserveTxType === 'aporte') : false;
    const isRendimento = isReserveTx ? ((t as any).reserveTxType === 'rendimento') : false;
    const isUtilizacao = isReserveTx ? ((t as any).reserveTxType === 'utilizacao') : false;
    const isReserveUseEx = !isReserveTx && (t.is_reserve_use || (t as any).isReserveUseOriginal || t.description?.startsWith('[Reserva]') || (t as any).rawDescription?.startsWith('[Reserva]'));
    const isIncome = t.type === 'income';

    const isAporteTx = isAporte || t.category === 'Aporte Reserva' || ((t as any).isInvestmentTx && ((t as any).investmentTxType === 'buy' || t.type === 'expense'));
    const isProventoTx = (t as any).isDividendTx || t.category === 'Proventos' || t.category === 'Dividendos';
    const isRendimentoTx = isRendimento || (isReserveTx && (t as any).reserveTxType === 'rendimento');
    const isNoDescTx = isAporteTx || isRendimentoTx;
    
    const isInvestmentReserveUse = isReserveTx && isUtilizacao && (
      (t as any).originalCategory === 'Investimentos' || 
      (t as any).linkedInvestmentId || 
      t.description?.includes('Investimento:')
    );

    const isVendaAtivo = isReserveTx && isRendimento && (
      (t as any).originalCategory === 'Venda de Ativos' ||
      t.description?.includes('Venda de Ativo')
    );

    const matchedReserveInfo = isReserveUseEx ? (() => {
      const matchRt = (reserveTransactions || []).find(
        rt => rt.type === 'utilizacao' && 
              rt.date === t.date && 
              Math.abs(Number(rt.amount) - Number((t as any).rawAmount !== undefined ? (t as any).rawAmount : t.amount)) < 0.01
      );
      if (matchRt) {
        const res = reserves.find(r => r.id === matchRt.reserve_id);
        return { reserve: res, rt: matchRt };
      }
      return null;
    })() : null;

    let catMeta = isReserveTx
      ? { 
          icon: PiggyBank, 
          color: isAporte 
            ? 'text-pink-500 bg-pink-500/10 border-pink-500/20' 
            : 'text-blue-500 bg-blue-500/10 border-blue-500/20' 
        }
      : getCategoryMeta(t.category, t.type);

    if (isProventoTx) {
      const isProvisioned = (t as any).dividendStatus === 'provisioned';
      catMeta = {
        icon: isProvisioned ? Clock : Coins,
        color: isProvisioned
          ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
          : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
      };
    }

    const SelectedIcon = isReserveTx
      ? (iconOptions[(t as any).reserveIcon as keyof typeof iconOptions] || PiggyBank)
      : isReserveUseEx
        ? (iconOptions[matchedReserveInfo?.reserve?.icon as keyof typeof iconOptions] || PiggyBank)
        : catMeta.icon;

    const isExpanded = expandedId === t.id;
    const fuelCost = isReserveTx ? 0 : calculateFuel(t.start_km, t.end_km);
    const contributions = isReserveTx ? [] : getTransactionReserveContributions(t);
    const sumContributions = contributions.reduce((sum, item) => sum + item.amount, 0);
    
    const displayAmount = (t as any).rawAmount !== undefined ? (t as any).rawAmount : t.amount;
    
    const isPizzaria = !isReserveTx && t.category === 'Pizzaria';
    const pizzariaBreakdown = isPizzaria ? (() => {
      const dels = t.deliveries ?? 0;
      const out = t.out_of_neighborhood ?? 0;
      const baseDels = settings?.pizzaria_base_deliveries ?? 8;
      const baseRate = settings?.pizzaria_base_rate ?? 90;
      const aboveBaseRate = settings?.pizzaria_daily_rate_above_base ?? 50;
      const delRate = settings?.pizzaria_delivery_rate ?? 5;
      const outRate = settings?.pizzaria_out_of_neighborhood_rate ?? 4;

      let diaria = 0;
      let valorEntregas = 0;
      let valorForaBairro = out * outRate;

      if (dels <= baseDels) {
        diaria = baseRate;
        valorEntregas = 0;
      } else {
        diaria = aboveBaseRate;
        valorEntregas = dels * delRate;
      }

      return {
        dels,
        out,
        baseDels,
        baseRate,
        aboveBaseRate,
        delRate,
        outRate,
        diaria,
        valorEntregas,
        valorForaBairro,
        totalCalculado: diaria + valorEntregas + valorForaBairro
      };
    })() : null;
    
    // Lucro Líquido Real do lançamento
    const transactionNet = Number((isIncome ? (displayAmount - fuelCost) : -displayAmount).toFixed(2));
    const pocketRest = Number((isIncome ? (displayAmount - fuelCost - sumContributions) : -displayAmount).toFixed(2));

    const isHighlighted = highlightId === t.id;

    return (
      <div 
        key={t.id} 
        id={`transaction-${t.id}`}
        className={`transition-all duration-300 ${
          isHighlighted 
            ? 'ring-2 ring-amber-500/60 dark:ring-amber-500 bg-amber-500/[0.04] dark:bg-amber-500/[0.08] shadow-md rounded-xl my-2 border border-amber-500/20' 
            : 'border-b border-border/10 last:border-b-0'
        }`}
        style={
          isReserveTx 
            ? { borderLeft: `4px ${isRendimento || isUtilizacao ? 'dashed' : 'solid'} ${(t as any).reserveColor}` } 
            : isReserveUseEx 
              ? { borderLeft: `3px dashed ${matchedReserveInfo?.reserve?.color || '#ef4444'}` } 
              : isProventoTx
                ? { borderLeft: (t as any).dividendStatus === 'provisioned' ? '3px dashed #f59e0b' : '3px solid #10b981' }
                : isRendimentoTx
                  ? { borderLeft: '3px dashed #10b981' }
                  : {}
        }
      >
        {/* Transaction Bar Row */}
        <div 
          onClick={() => {
            if (selectMode) {
              toggleSelectId(t.id);
              return;
            }
            setExpandedId(isExpanded ? null : t.id);
            if (isHighlighted) {
              searchParams.delete('highlight');
              setSearchParams(searchParams, { replace: true });
            }
          }}
          className={`p-3 sm:px-4 flex items-center justify-between gap-3 bg-card hover:bg-muted/15 transition-colors cursor-pointer ${
            isExpanded ? 'bg-muted/10' : ''
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Checkbox for Select Mode */}
            {selectMode && (
              <div className="shrink-0 text-indigo-500">
                {selectedIds.has(t.id) ? (
                  <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400 fill-indigo-100 dark:fill-indigo-900/40" />
                ) : (
                  <Square className="w-5 h-5 text-muted-foreground/60" />
                )}
              </div>
            )}

            <div className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center ${catMeta.color} shadow-2xs`}>
              <SelectedIcon className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-xs sm:text-sm text-foreground truncate tracking-tight">
                  {isReserveTx 
                    ? (t as any).reserveName 
                    : isReserveUseEx 
                      ? (matchedReserveInfo?.reserve?.name || 'Reserva') 
                      : isProventoTx 
                        ? `${(t as any).ticker || ''} (${(t as any).dividendType || 'Provento'})`
                        : t.category}
                </span>

                {/* Badges / Pill Tags */}
                {isReserveTx && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                    isAporte 
                      ? 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border border-pink-500/20' 
                      : isRendimento 
                        ? (isVendaAtivo ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20' : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20')
                        : (isInvestmentReserveUse ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20')
                  }`}>
                    {isAporte 
                      ? 'Aporte Reserva' 
                      : isRendimento 
                        ? (isVendaAtivo ? 'Venda de Ativo' : 'Rendimento') 
                        : (isInvestmentReserveUse ? 'Compra de Ativo' : 'Gasto Reserva')}
                  </span>
                )}

                {isReserveUseEx && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    Uso Cofrinho
                  </span>
                )}

                {(t as any).isInvestmentTx && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                    t.type === 'income' 
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20' 
                      : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20'
                  }`}>
                    {t.type === 'income' ? 'Venda Ativo' : 'Compra Ativo'}
                  </span>
                )}

                {(t as any).isDividendTx && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider border ${
                    (t as any).dividendStatus === 'provisioned'
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                  }`}>
                    {(t as any).dividendStatus === 'provisioned' ? 'Provento a Receber' : 'Provento Recebido'}
                  </span>
                )}

                {/* Status de Pagamento / Pendente */}
                {t.payment_status === 'pending' && (() => {
                  const statusMeta = getPaymentStatusMeta(t.payment_status, t.due_date, t.date);
                  return (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider border flex items-center gap-1 ${statusMeta.bgColor} ${statusMeta.color} ${statusMeta.borderColor}`}>
                      <span>{statusMeta.icon}</span>
                      <span>{statusMeta.label}</span>
                      {t.due_date && (
                        <span className="font-mono text-[8.5px] opacity-90">
                          ({format(parseLocalDate(t.due_date), 'dd/MM')})
                        </span>
                      )}
                    </span>
                  );
                })()}

                {/* Recorrência Badge */}
                {t.is_recurring && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                    <span>🔄</span>
                    <span>{formatRecurrenceFrequency(t.recurrence_frequency)}</span>
                    {t.installment_index && t.total_installments && (
                      <span className="font-mono">
                        ({t.installment_index}/{t.total_installments})
                      </span>
                    )}
                  </span>
                )}

                {t.start_km != null && t.end_km != null && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/40">
                    {Number(t.end_km) - Number(t.start_km)} km
                  </span>
                )}

                {isPizzaria && pizzariaBreakdown && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {pizzariaBreakdown.dels} entregas {pizzariaBreakdown.out > 0 ? `(${pizzariaBreakdown.out} fora)` : ''}
                  </span>
                )}
              </div>

              {!isNoDescTx && t.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 font-medium">
                  {t.description}
                </p>
              )}
            </div>
          </div>

          {/* Right Amount & Quick Settle & Expand Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {t.payment_status === 'pending' && !selectMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenSettle(t);
                }}
                className="px-2 py-1 text-[10px] font-black rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                title="Quitar / Marcar como Pago"
              >
                <Check className="w-3 h-3 stroke-[3]" />
                <span className="hidden xs:inline">Quitar</span>
              </button>
            )}

            <div className="text-right">
              <span className={`text-xs sm:text-sm font-mono font-black block tracking-tight ${
                isReserveTx 
                  ? (isAporte ? 'text-pink-600 dark:text-pink-400' : isRendimento ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')
                  : (isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')
              }`}>
                {isReserveTx 
                  ? (isRendimento ? `+${formatCurrency(displayAmount)}` : `-${formatCurrency(displayAmount)}`)
                  : (isIncome ? `+${formatCurrency(displayAmount)}` : `-${formatCurrency(displayAmount)}`)}
              </span>

              {isIncome && fuelCost > 0 && (
                <span className="text-[9.5px] font-mono text-muted-foreground/80 block">
                  Livre: {formatCurrency(pocketRest)}
                </span>
              )}
            </div>

            <div className="text-muted-foreground/60 p-1 hover:text-foreground">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {/* Expanded Detail Panel */}
        {isExpanded && (
          <div className="p-3 sm:p-5 bg-muted/15 border-t border-border/40 animate-in fade-in slide-in-from-top-1 duration-200">
            <TransactionDetailView
              transaction={t}
              settings={settings}
              reserves={reserves}
              reserveTransactions={reserveTransactions || []}
              quotes={quotes}
              dividends={dividends}
              formatCurrency={formatCurrency}
              openEdit={openEdit}
              askDelete={askDelete}
              calculateFuel={calculateFuel}
              getTransactionReserveContributions={getTransactionReserveContributions}
              onSettlePending={handleOpenSettle}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Extrato Financeiro
            </h1>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
              {filteredTransactions.length} itens
            </span>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium mt-0.5">
            Gerencie, consulte, filtre e exporte seu histórico completo com precisão real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReportModal(true)}
            className="h-9 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 shadow-xs cursor-pointer"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Relatório Executivo</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-9 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Baixar CSV</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setGroupByType(!groupByType)}
            className={`h-9 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
              groupByType 
                ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-xs font-extrabold" 
                : "border-border bg-card text-muted-foreground"
            }`}
            title={groupByType ? "Modo Agrupado por Tipo de Lançamento" : "Modo Lista Simples"}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">{groupByType ? "Agrupado por Tipo" : "Lista Simples"}</span>
          </Button>



          <Button
            variant={selectMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSelectMode(!selectMode);
              if (selectMode) setSelectedIds(new Set());
            }}
            className={`h-9 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
              selectMode ? "bg-indigo-600 text-white shadow-xs" : "border-border bg-card"
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{selectMode ? "Sair da Seleção" : "Selecionar"}</span>
          </Button>
        </div>
      </header>

      {/* Premium Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Card 1: Caixa */}
        <Card className="border border-border/80 shadow-sm bg-card hover:shadow-md transition-all flex flex-col justify-between">
          <CardHeader className="p-3 sm:p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Caixa
            </CardTitle>
            <div className="p-1.5 bg-primary/10 rounded-lg shrink-0">
              <Wallet className="w-3.5 h-3.5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-1 flex-1 flex flex-col justify-between">
            <div>
              <div className="text-base sm:text-xl font-black text-foreground tracking-tight">
                {formatCompactValue(summaries.bancaLivre)}
              </div>
            </div>
            
            <div className="mt-2.5 pt-2 border-t border-border/30">
              {/* Progress bar split */}
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden flex mb-1">
                <div className="bg-primary h-full transition-all duration-300" style={{ width: `${pctBanca}%` }} />
                <div className="bg-pink-500 h-full transition-all duration-300" style={{ width: `${pctReserva}%` }} />
                <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${pctInvestimento}%` }} />
              </div>
              <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-muted-foreground leading-tight">
                <span className="font-bold text-primary">Caixa: {pctBanca.toFixed(0)}%</span>
                <span className="font-bold text-pink-500">Resv: {pctReserva.toFixed(0)}%</span>
                <span className="font-bold text-blue-500">Inv: {pctInvestimento.toFixed(0)}%</span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1 font-bold flex items-center justify-between">
                <span>Patrimônio Total:</span>
                <span className="font-mono text-foreground font-black">{formatCompactValue(summaries.patrimonio + totalInvestmentEquity)}</span>
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Card 2: faturamento bruto */}
        <Card className="border border-border/80 shadow-sm bg-card hover:shadow-md transition-all flex flex-col justify-between">
          <CardHeader className="p-3 sm:p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Ganhos Brutos
            </CardTitle>
            <div className="p-1.5 bg-emerald-500/10 rounded-lg shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-1 flex-1 flex flex-col justify-between">
            <div>
              <div className="text-base sm:text-xl font-black text-emerald-500 tracking-tight">
                {formatCompactValue(summaries.ganhosBrutos || 0)}
              </div>
            </div>
            
            <div className="mt-2.5 pt-2 border-t border-border/30">
              <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-muted-foreground leading-tight mb-1">
                <span className="font-medium">Média por dia:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCompactValue(avgDailyEarnings)}
                </span>
              </div>
              <p className="text-[9px] font-bold text-muted-foreground leading-none">
                {raceCount} lançamentos de ganho
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: gastos totais */}
        <Card className="border border-border/80 shadow-sm bg-card hover:shadow-md transition-all flex flex-col justify-between">
          <CardHeader className="p-3 sm:p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Gastos Totais
            </CardTitle>
            <div className="p-1.5 bg-rose-500/10 rounded-lg shrink-0">
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-1 flex-1 flex flex-col justify-between">
            <div>
              <div className="text-base sm:text-xl font-black text-rose-500 tracking-tight">
                {formatCompactValue(summaries.gastosPeriodo || 0)}
              </div>
            </div>
            
            <div className="mt-2.5 pt-2 border-t border-border/30">
              {/* Graphic Split bar */}
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden flex mb-1.5">
                <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${pctOp}%` }} />
                <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${pctPer}%` }} />
              </div>

              {/* Color indicators */}
              <div className="grid grid-cols-2 gap-0.5 text-center leading-tight">
                <div>
                  <span className="text-[7px] uppercase font-black text-amber-500 block">Op ({Math.round(pctOp)}%)</span>
                  <span className="text-[8.5px] font-mono font-bold text-amber-600 dark:text-amber-400 block truncate">
                    {formatCompactValue(summaries.opExpensePuro)}
                  </span>
                </div>
                <div className="border-l border-border/40">
                  <span className="text-[7px] uppercase font-black text-rose-500 block">Pes ({Math.round(pctPer)}%)</span>
                  <span className="text-[8.5px] font-mono font-bold text-rose-600 dark:text-rose-400 block truncate">
                    {formatCompactValue(summaries.perExpense)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Lucro líquido e real período */}
        <Card className={`border shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${summaries.lucroLiquido >= 0 ? 'border-emerald-500/20 bg-emerald-500/[0.01]' : 'border-rose-500/20 bg-rose-500/[0.01]'}`}>
          <CardHeader className="p-3 sm:p-4 pb-1.5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Resultados Período
            </CardTitle>
            <div className={`p-1.5 rounded-lg shrink-0 ${summaries.lucroLiquido >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
              <Percent className={`w-3.5 h-3.5 ${summaries.lucroLiquido >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-1 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              {/* Lucro Líquido (Caixa) */}
              <div className="flex items-center justify-between gap-1 leading-none">
                <div>
                  <span className="text-[8px] sm:text-[8.5px] font-extrabold text-muted-foreground/80 block uppercase">Caixa Liq.</span>
                  <div className={`text-sm sm:text-base font-black tracking-tight ${summaries.lucroLiquido >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-rose-500'}`}>
                    {formatCompactValue(summaries.lucroLiquido)}
                  </div>
                </div>
                {summaries.ganhosBrutos > 0 && (
                  <span className={`text-[8.5px] sm:text-[9.5px] font-black px-1 py-0.5 rounded ${summaries.lucroLiquido >= 0 ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400' : 'bg-rose-500/10 text-rose-500'}`}>
                    {((summaries.lucroLiquido / summaries.ganhosBrutos) * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {/* Lucro Real (Patrimônio) */}
              <div className="pt-1.5 border-t border-border/30 flex items-center justify-between gap-1 leading-none">
                <div>
                  <span className="text-[8px] sm:text-[8.5px] font-extrabold text-muted-foreground/80 block uppercase">Líq. Real</span>
                  <div className={`text-sm sm:text-base font-black tracking-tight ${summaries.lucroReal >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`}>
                    {formatCompactValue(summaries.lucroReal)}
                  </div>
                </div>
                {summaries.ganhosBrutos > 0 && (
                  <span className={`text-[8.5px] sm:text-[9.5px] font-black px-1 py-0.5 rounded ${summaries.lucroReal >= 0 ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-rose-500/10 text-rose-500'}`}>
                    {((summaries.lucroReal / summaries.ganhosBrutos) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>

            {summaries.ganhosBrutos <= 0 && (
              <p className="text-[8px] text-muted-foreground pt-1 text-center italic">
                Nenhum faturamento registrado
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Period Selection Segmented Pill */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <label className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 animate-pulse-subtle">
            <Calendar className="w-3.5 h-3.5 text-primary" /> Visualizar Período
          </label>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-full">
          <div className="flex overflow-x-auto scrollbar-none gap-1.5 p-1 bg-muted/20 border border-border/30 rounded-full w-full max-w-full">
            {[
              { id: 'last30Days', label: '30 dias' },
              { id: 'last90Days', label: '90 dias' },
              { id: 'month', label: 'Mês Atual' },
              { id: 'lastMonth', label: 'Mês Passado' },
              { id: 'thisYear', label: 'Este Ano' },
              { id: 'lastYear', label: 'Ano Passado' },
              { id: 'custom', label: 'Personalizado' },
            ].map((period) => {
              const isSelected = globalPeriod === period.id;
              return (
                <button
                  key={period.id}
                  type="button"
                  onClick={() => setGlobalPeriod(period.id)}
                  className="relative px-4 py-2 sm:py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap focus:outline-none flex-1 text-center"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="history-active-period"
                      className="absolute inset-0 bg-background border border-border/45 shadow-xs rounded-full"
                      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    />
                  )}
                  <span className={`relative z-10 transition-colors duration-200 ${isSelected ? 'text-foreground font-extrabold' : 'text-muted-foreground hover:text-foreground'}`}>
                    {period.label}
                  </span>
                </button>
              );
            })}
          </div>
          {globalPeriod === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 mx-1 mt-1">
              <span className="text-muted-foreground text-xs font-medium">Período:</span>
              <input
                type="date"
                className="bg-background border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none max-w-[130px]"
                value={customDateRange?.start || ''}
                onChange={(e) => setCustomDateRange({ start: e.target.value, end: customDateRange?.end || getTodayLocalDateStr() })}
              />
              <span className="text-muted-foreground text-xs">até</span>
              <input
                type="date"
                className="bg-background border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none max-w-[130px]"
                value={customDateRange?.end || ''}
                onChange={(e) => setCustomDateRange({ start: customDateRange?.start || getTodayLocalDateStr(), end: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Filters Card */}
      <Card className="border border-border/80 shadow-xs bg-card overflow-hidden rounded-2xl">
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/75" />
              <Input
                placeholder="Pesquisar categoria, descrição ou ID do lançamento..."
                className="pl-9.5 h-10 border-border bg-muted/10 font-semibold focus-visible:ring-primary text-xs sm:text-sm rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`h-10 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 px-4 select-none transition-colors border ${
                  showAdvanced || activeFiltersCount > 0
                    ? 'border-primary/30 bg-primary/5 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <Filter className="w-4 h-4 shrink-0" />
                <span>Filtros Avançados</span>
                {activeFiltersCount > 0 && (
                  <span className="bg-primary text-primary-foreground font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                    {activeFiltersCount}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-250 ${showAdvanced ? 'rotate-180' : ''}`} />
              </Button>

              {activeFiltersCount > 0 && (
                <Button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterType('all');
                    setFilterCategory('all');
                    setFilterStatus('all');
                    setMinAmount('');
                    setMaxAmount('');
                    setSortBy('date-desc');
                    setIncludeCash(true);
                    setIncludeReserves(true);
                    setIncludeInvestments(true);
                    setFilterReserveId('all');
                    setFilterTicker('all');
                    setActiveQuickChip('all');
                  }}
                  variant="outline"
                  className="h-10 text-xs font-bold border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 hover:text-rose-600 rounded-xl px-3 transition-colors flex items-center gap-1.5"
                  title="Limpar todos os filtros ativos"
                >
                  <Trash className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Limpar</span>
                </Button>
              )}
            </div>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 pt-1 border-t border-border/30">
            {[
              { id: 'all', label: 'Tudo' },
              { 
                id: 'pending_expenses', 
                label: `Pendentes ⏳${pendingSummary.pendingCount > 0 ? ` (${pendingSummary.pendingCount})` : ''}`,
                highlight: pendingSummary.pendingCount > 0
              },
              { id: 'income', label: 'Receitas 🟢' },
              { id: 'expense', label: 'Despesas 🔴' },
              { id: 'combustivel', label: 'Combustível ⛽' },
              { id: 'uber_ifood', label: 'Uber / iFood 🚗' },
              { id: 'pizzaria', label: 'Pizzaria 🍕' },
              { id: 'reservas', label: 'Reservas 🐷' },
              { id: 'investimentos', label: 'Investimentos 📈' },
            ].map((chip) => {
              const isActive = activeQuickChip === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleQuickChipClick(chip.id)}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-xl shrink-0 transition-all cursor-pointer border flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : (chip as any).highlight
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                        : 'bg-muted/30 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>

          {/* Advanced collapsible section */}
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="pt-4 border-t border-border/40 mt-1 space-y-4">
                {/* Source Selection Buttons */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block">
                    Origem dos Lançamentos (Fontes de Dados)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {/* Caixa / Conta Button */}
                    <button
                      type="button"
                      onClick={() => setIncludeCash(!includeCash)}
                      className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border select-none transition-all ${
                        includeCash
                          ? 'border-primary/40 bg-primary/10 text-primary shadow-xs font-extrabold'
                          : 'border-border/60 bg-muted/5 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Wallet className="w-3.5 h-3.5 shrink-0" />
                      <span>Conta / Caixa</span>
                    </button>

                    {/* Reservas Button */}
                    <button
                      type="button"
                      onClick={() => setIncludeReserves(!includeReserves)}
                      className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border select-none transition-all ${
                        includeReserves
                          ? 'border-pink-500/40 bg-pink-500/10 text-pink-500 shadow-xs font-extrabold'
                          : 'border-border/60 bg-muted/5 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <PiggyBank className="w-3.5 h-3.5 shrink-0" />
                      <span>Reservas / Cofrinhos</span>
                    </button>

                    {/* Investimentos Button */}
                    <button
                      type="button"
                      onClick={() => setIncludeInvestments(!includeInvestments)}
                      className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border select-none transition-all ${
                        includeInvestments
                          ? 'border-blue-500/40 bg-blue-500/10 text-blue-500 shadow-xs font-extrabold'
                          : 'border-border/60 bg-muted/5 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                      <span>Investimentos / Ativos</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* Tipo Geral */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                      Tipo Geral
                    </label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-full h-10 text-xs font-semibold border-border bg-card rounded-xl">
                        <div className="flex items-center gap-2 truncate text-foreground">
                          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span>
                            {filterType === 'all' && 'Todos os Lançamentos'}
                            {filterType === 'income' && 'Receitas (Ganhos)'}
                            {filterType === 'expense' && 'Todas as Despesas'}
                            {filterType === 'opExpense' && 'Despesas Operacionais'}
                            {filterType === 'perExpense' && 'Despesas Pessoais'}
                            {filterType === 'reserveExpense' && 'Despesas de Reserva'}
                          </span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Lançamentos</SelectItem>
                        <SelectItem value="income">Receitas (Ganhos)</SelectItem>
                        <SelectItem value="expense">Todas as Despesas</SelectItem>
                        <SelectItem value="opExpense">Despesas Operacionais</SelectItem>
                        <SelectItem value="perExpense">Despesas Pessoais</SelectItem>
                        <SelectItem value="reserveExpense">Despesas de Reserva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Categoria Específica */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                      Categoria Específica
                    </label>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="w-full h-10 text-xs font-semibold border-border bg-card rounded-xl">
                        <div className="flex items-center gap-2 truncate text-foreground">
                          <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span>{filterCategory === 'all' ? 'Todas as Categorias' : filterCategory}</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Categorias</SelectItem>
                        {uniqueCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat || 'Sem Categoria'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status de Pagamento / Quitação */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                      Pagamento / Quitação
                    </label>
                    <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
                      <SelectTrigger className="w-full h-10 text-xs font-semibold border-border bg-card rounded-xl">
                        <div className="flex items-center gap-2 truncate text-foreground">
                          <CalendarClock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span>
                            {filterPaymentStatus === 'all' && 'Todos (Pagos e Pendentes)'}
                            {filterPaymentStatus === 'pending' && '⏳ Somente Pendentes'}
                            {filterPaymentStatus === 'overdue' && '⚠️ Vencidos / Em Atraso'}
                            {filterPaymentStatus === 'paid' && '✅ Somente Pagos'}
                          </span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos (Pagos e Pendentes)</SelectItem>
                        <SelectItem value="pending">⏳ Somente Pendentes</SelectItem>
                        <SelectItem value="overdue">⚠️ Vencidos / Em Atraso</SelectItem>
                        <SelectItem value="paid">✅ Somente Pagos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status da Transação (Data Futura) */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                      Data (Ativo vs Futuro)
                    </label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-full h-10 text-xs font-semibold border-border bg-card rounded-xl">
                        <div className="flex items-center gap-2 truncate text-[#e0e0e0] dark:text-[#ffffff]">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span>
                            {filterStatus === 'all' && 'Todas as Datas'}
                            {filterStatus === 'confirmed' && 'Hoje e Passados'}
                            {filterStatus === 'scheduled' && 'Agendados (Futuros)'}
                          </span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Datas</SelectItem>
                        <SelectItem value="confirmed">Hoje e Passados</SelectItem>
                        <SelectItem value="scheduled">Agendados (Futuros)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Faixa de Valores */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                      Faixa de Valores (R$)
                    </label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        placeholder="Mínimo"
                        className="h-10 border-border bg-card text-xs font-semibold rounded-xl"
                        value={minAmount}
                        onChange={(e) => setMinAmount(e.target.value)}
                      />
                      <span className="text-muted-foreground text-xs font-extrabold">à</span>
                      <Input
                        type="number"
                        placeholder="Máximo"
                        className="h-10 border-border bg-card text-xs font-semibold rounded-xl"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Ordenação */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                      Ordenação do Histórico
                    </label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-full h-10 text-xs font-semibold border-border bg-card rounded-xl">
                        <div className="flex items-center gap-2 truncate text-foreground">
                          <Navigation className="w-3.5 h-3.5 text-muted-foreground shrink-0 rotate-90" />
                          <span>
                            {sortBy === 'date-desc' && 'Mais Recentes'}
                            {sortBy === 'date-asc' && 'Mais Antigos'}
                            {sortBy === 'amount-desc' && 'Maior Valor'}
                            {sortBy === 'amount-asc' && 'Menor Valor'}
                            {sortBy === 'category-asc' && 'Categoria A-Z'}
                            {sortBy === 'category-desc' && 'Categoria Z-A'}
                          </span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date-desc">Mais Recentes</SelectItem>
                        <SelectItem value="date-asc">Mais Antigos</SelectItem>
                        <SelectItem value="amount-desc">Maior Valor (R$)</SelectItem>
                        <SelectItem value="amount-asc">Menor Valor (R$)</SelectItem>
                        <SelectItem value="category-asc">Categoria A-Z</SelectItem>
                        <SelectItem value="category-desc">Categoria Z-A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </Card>

      {/* Filter KPI Summary Banner */}
      {activeFiltersCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 bg-card border border-primary/20 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-foreground">
                  Resumo Financeiro dos Filtros
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                  {activeFiltersCount} ativo(s)
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">
                {filteredTotals.count} lançamento(s) correspondem ao seu filtro atual
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-extrabold text-muted-foreground">Entradas</span>
                <span className="font-extrabold text-emerald-500">{formatCompactValue(filteredTotals.income)}</span>
              </div>
              <div className="h-6 w-px bg-border/60" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-extrabold text-muted-foreground">Saídas</span>
                <span className="font-extrabold text-rose-500">-{formatCompactValue(filteredTotals.expense)}</span>
              </div>
              <div className="h-6 w-px bg-border/60" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-extrabold text-muted-foreground">Líquido Filtro</span>
                <span className={`font-extrabold ${filteredTotals.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {filteredTotals.net >= 0 ? '+' : ''}{formatCompactValue(filteredTotals.net)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setFilterType('all');
                setFilterCategory('all');
                setFilterPaymentStatus('all');
                setFilterStatus('all');
                setMinAmount('');
                setMaxAmount('');
                setSortBy('date-desc');
                setIncludeCash(true);
                setIncludeReserves(true);
                setIncludeInvestments(true);
                setFilterReserveId('all');
                setFilterTicker('all');
                setActiveQuickChip('all');
              }}
              className="h-8 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-xl px-2.5 cursor-pointer"
            >
              Limpar Filtros
            </Button>
          </div>
        </motion.div>
      )}

      {/* Pending Expenses Summary Banner */}
      {pendingSummary.pendingCount > 0 && filterPaymentStatus !== 'pending' && filterPaymentStatus !== 'overdue' && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
            pendingSummary.overdueCount > 0
              ? 'bg-rose-500/10 border-rose-500/30 dark:bg-rose-950/20'
              : 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-950/20'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${
              pendingSummary.overdueCount > 0
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
            }`}>
              {pendingSummary.overdueCount > 0 ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <CalendarClock className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                  {pendingSummary.pendingCount} Despesa(s) Pendente(s) (Próximos 30 dias)
                </span>
                {pendingSummary.overdueCount > 0 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white">
                    {pendingSummary.overdueCount} vencida(s)!
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Total a pagar: <strong className="font-mono text-foreground">{formatCurrency(pendingSummary.totalPendingAmount)}</strong>
                {pendingSummary.overdueCount > 0 && (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold ml-1.5">
                    (sendo {formatCurrency(pendingSummary.overdueAmount)} em atraso)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={() => handleQuickChipClick('pending_expenses')}
              className={`h-8 px-3 text-xs font-extrabold rounded-xl shadow-xs cursor-pointer ${
                pendingSummary.overdueCount > 0
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              <Filter className="w-3.5 h-3.5 mr-1" />
              Ver Pendentes
            </Button>
          </div>
        </motion.div>
      )}

      {/* History Grid/List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-muted/10 border border-dashed border-border/80 rounded-xl">
          <Loader2 className="w-9 h-9 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-semibold">Carregando seus lançamentos...</p>
        </div>
      ) : groupedTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border/80 rounded-2xl bg-muted/10">
          <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center mb-3">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">Nenhum lançamento encontrado</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Tente atualizar os termos de busca ou mude os filtros de período e tipo de transação.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedTransactions.slice(0, visibleGroupsCount).map(group => {
            const totalCompraInvestimento = group.transactions
              .filter(t => (t as any).isInvestmentTx && t.type === 'expense')
              .reduce((acc, t) => acc + Number(t.amount), 0);

            const totalVendaInvestimento = group.transactions
              .filter(t => (t as any).isInvestmentTx && t.type === 'income')
              .reduce((acc, t) => acc + Number(t.amount), 0);

            const incStandard = group.transactions
              .filter(t => t.type === 'income' && t.category !== 'Resgate Reserva' && (!(t as any).isReserveTx || (t as any).reserveTxType === 'rendimento') && !(t as any).isInvestmentTx)
              .reduce((acc, t) => acc + Number(t.amount), 0);

            const dailyReserveRendimento = group.transactions
              .filter(t => ((t as any).isReserveTx && (t as any).reserveTxType === 'rendimento') || (t as any).isDividendTx)
              .reduce((acc, t) => acc + Number(t.amount), 0);

            const inc = incStandard; // For existing visual reference compatibility

            let opExpPuro = 0;
            let perExpPuro = 0;
            let reserveSpending = 0;
            let rawReserveAporte = 0;
            const opCats = settings?.operational_expense_categories || ['Combustível', 'Pedágio', 'Manutenção'];

            group.transactions.filter(t => t.type === 'expense').forEach(t => {
              if ((t as any).isInvestmentTx) {
                // Asset purchases convert cash into investment assets, so they do not reduce net worth or net profit
                return;
              }
              const isInvestmentReserveUse = (t as any).isReserveTx === true && (t as any).reserveTxType === 'utilizacao' && (
                (t as any).originalCategory === 'Investimentos' || 
                (t as any).linkedInvestmentId || 
                t.description?.includes('Investimento:')
              );
              if (isInvestmentReserveUse) {
                return;
              }

              const isReserveAporteVal = (t as any).isReserveAporte === true || t.category === 'Aporte Reserva' || (t as any).reserveTxType === 'aporte';
              const isReserveUse = t.is_reserve_use === true || (t as any).isReserveUseOriginal === true || t.description?.includes('[Reserva]') || (t as any).isReserveTx === true || (t as any).reserveTxType === 'utilizacao';
              const amt = Number(t.amount);

              if (isReserveAporteVal) {
                const rawAmt = (t as any).rawAmount !== undefined ? Number((t as any).rawAmount) : amt;
                rawReserveAporte += rawAmt;
              } else if (isReserveUse) {
                const rawAmt = (t as any).rawAmount !== undefined ? Number((t as any).rawAmount) : amt;
                reserveSpending += rawAmt;
                
                const effectiveCat = (t as any).originalCategory || t.category;
                if (isOperationalCategory(effectiveCat, opCats)) {
                  opExpPuro += amt;
                } else {
                  perExpPuro += amt;
                }
              } else {
                if (isOperationalCategory(t.category, opCats)) {
                  opExpPuro += amt;
                } else {
                  perExpPuro += amt;
                }
              }
            });

            const reserveAporte = rawReserveAporte - reserveSpending;
            const standardExpense = opExpPuro + perExpPuro + reserveAporte;

            // Caixa Liq (Caixa Líquido): cash in - standard cash out (plus investment sales). Asset purchases are excluded.
            const dailyNet = (incStandard - dailyReserveRendimento) + totalVendaInvestimento - standardExpense;
            
            // Líquido Real: Standard operating profit (does not count investment purchases as wealth loss)
            const dailyNetReal = incStandard - opExpPuro - perExpPuro;
            const isDailyNetPositive = dailyNet >= 0;
            const isDailyNetRealPositive = dailyNetReal >= 0;
            return (
              <Card key={group.date.toISOString()} className="overflow-hidden border border-border/70 shadow-sm bg-card hover:border-border/100 transition-all">
                {/* Daily Group Header */}
                <div className="bg-muted/30 px-3 py-2 md:px-4 md:py-3 border-b border-border/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2">
                  <div className="flex items-center gap-2 shrink-0">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <h3 className="font-extrabold text-xs sm:text-sm capitalize text-foreground tracking-tight">
                      {format(group.date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </h3>
                  </div>
                  
                  {/* Container de Badges Redesenhados - Ultra Otimizados */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full lg:w-auto">
                    
                    {/* Grid de 4 Principais Indicadores do Dia (Líquidos e Acumulados) */}
                    <div className="grid grid-cols-4 gap-1 w-full lg:w-auto max-w-full shrink-0">
                      {/* Líq. Real */}
                      <div className={`flex flex-col items-center justify-center py-1 px-1 sm:px-2 rounded-md border text-center ${
                        isDailyNetRealPositive 
                          ? 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500/25 text-indigo-600 dark:text-indigo-400' 
                          : 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
                      }`}>
                        <span className="text-[7.5px] sm:text-[8px] font-extrabold uppercase tracking-wider block opacity-75">Líq. Real</span>
                        <span className="text-[9.5px] sm:text-[11px] font-mono font-black truncate max-w-full">
                          {dailyNetReal >= 0 ? '+' : ''}{formatCompactValue(dailyNetReal)}
                        </span>
                      </div>

                      {/* Patr */}
                      <div className="flex flex-col items-center justify-center py-1 px-1 sm:px-2 rounded-md border border-violet-500/25 bg-violet-500/5 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-center">
                        <span className="text-[7.5px] sm:text-[8px] font-extrabold uppercase tracking-wider block opacity-75">Patr. Ac.</span>
                        <span className="text-[9.5px] sm:text-[11px] font-mono font-black truncate max-w-full">
                          {formatCompactValue(getPatrimonioAtDate(group.date))}
                        </span>
                      </div>

                      {/* Caixa Liq. */}
                      <div className={`flex flex-col items-center justify-center py-1 px-1 sm:px-2 rounded-md border text-center ${
                        isDailyNetPositive 
                          ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
                      }`}>
                        <span className="text-[7.5px] sm:text-[8px] font-extrabold uppercase tracking-wider block opacity-75">Caixa Liq.</span>
                        <span className="text-[9.5px] sm:text-[11px] font-mono font-black truncate max-w-full">
                          {dailyNet >= 0 ? '+' : ''}{formatCompactValue(dailyNet)}
                        </span>
                      </div>

                      {/* Caixa */}
                      <div className="flex flex-col items-center justify-center py-1 px-1 sm:px-2 rounded-md border border-sky-500/25 bg-sky-500/5 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 text-center">
                        <span className="text-[7.5px] sm:text-[8px] font-extrabold uppercase tracking-wider block opacity-75">Caixa Ac.</span>
                        <span className="text-[9.5px] sm:text-[11px] font-mono font-black truncate max-w-full">
                          {formatCompactValue(getBancaAtDate(group.date))}
                        </span>
                      </div>
                    </div>

                    {/* Detalhamento dos Componentes do Dia (Fluxo) */}
                    <div className="flex flex-wrap items-center gap-1 overflow-x-auto py-0.5 justify-start sm:justify-end">
                      {/* Faturamento */}
                      {group.income > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/10 shrink-0">
                          <TrendingUp className="w-2.5 h-2.5 shrink-0" />
                          <span className="opacity-85 font-normal">Fat:</span>
                          <span className="font-mono">{formatCompactValue(group.income)}</span>
                        </span>
                      )}

                      {/* Gasto Operacional Puro */}
                      {group.opExpensePuro > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/10 shrink-0">
                          <Fuel className="w-2.5 h-2.5 shrink-0" />
                          <span className="opacity-85 font-normal">Op:</span>
                          <span className="font-mono">-{formatCompactValue(group.opExpensePuro)}</span>
                        </span>
                      )}

                      {/* Aporte Reserva */}
                      {group.reserveAporte > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] bg-pink-500/10 text-pink-600 dark:text-pink-400 font-bold border border-pink-500/10 shrink-0">
                          <PiggyBank className="w-2.5 h-2.5 shrink-0" />
                          <span className="opacity-85 font-normal">Aporte:</span>
                          <span className="font-mono">-{formatCompactValue(group.reserveAporte)}</span>
                        </span>
                      )}

                      {/* Gasto Pessoal */}
                      {group.perExpense > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/10 shrink-0">
                          <Heart className="w-2.5 h-2.5 shrink-0" />
                          <span className="opacity-85 font-normal">Pes:</span>
                          <span className="font-mono">-{formatCompactValue(group.perExpense)}</span>
                        </span>
                      )}

                      {/* Despesa Reserva */}
                      {group.reserveExpense > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/10 shrink-0">
                          <Wrench className="w-2.5 h-2.5 shrink-0" />
                          <span className="opacity-85 font-normal">Total Resg:</span>
                          <span className="font-mono">-{formatCompactValue(group.reserveExpense)}</span>
                        </span>
                      )}

                      {/* Compra de Investimento */}
                      {totalCompraInvestimento > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/10 shrink-0">
                          <Briefcase className="w-2.5 h-2.5 shrink-0" />
                          <span className="opacity-85 font-normal">Compra Inv:</span>
                          <span className="font-mono">-{formatCompactValue(totalCompraInvestimento)}</span>
                        </span>
                      )}

                      {/* Venda de Investimento */}
                      {totalVendaInvestimento > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/10 shrink-0">
                          <Briefcase className="w-2.5 h-2.5 shrink-0" />
                          <span className="opacity-85 font-normal">Venda Inv:</span>
                          <span className="font-mono">+{formatCompactValue(totalVendaInvestimento)}</span>
                        </span>
                      )}

                      {/* Total Gasto */}
                      {(opExpPuro + perExpPuro) > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] bg-red-500/10 text-red-600 dark:text-red-400 font-bold border border-red-500/10 shrink-0">
                          <TrendingDown className="w-2.5 h-2.5 shrink-0" />
                          <span className="opacity-85 font-normal">Total Gasto:</span>
                          <span className="font-mono">-{formatCompactValue(opExpPuro + perExpPuro)}</span>
                        </span>
                      )}
                    </div>

                  </div>
                </div>

                {/* Daily Transaction List */}
                {groupByType ? (() => {
                  const SUB_GROUPS_CONFIG: Record<string, {
                    key: string;
                    title: string;
                    badgeBg: string;
                    badgeText: string;
                    borderColor: string;
                    iconBg: string;
                    subtotalColor: string;
                    Icon: React.ElementType;
                  }> = {
                    income: {
                      key: 'income',
                      title: 'Entradas',
                      badgeBg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
                      badgeText: 'text-emerald-600 dark:text-emerald-400',
                      borderColor: 'border-emerald-500/30',
                      iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                      subtotalColor: 'text-emerald-600 dark:text-emerald-400',
                      Icon: TrendingUp,
                    },
                    op_expense: {
                      key: 'op_expense',
                      title: 'Despesas Operacionais',
                      badgeBg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/20',
                      badgeText: 'text-amber-600 dark:text-amber-400',
                      borderColor: 'border-amber-500/30',
                      iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                      subtotalColor: 'text-amber-600 dark:text-amber-400',
                      Icon: Fuel,
                    },
                    personal_expense: {
                      key: 'personal_expense',
                      title: 'Despesas Pessoais',
                      badgeBg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/20',
                      badgeText: 'text-rose-600 dark:text-rose-400',
                      borderColor: 'border-rose-500/30',
                      iconBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
                      subtotalColor: 'text-rose-600 dark:text-rose-400',
                      Icon: Heart,
                    },
                    reserves: {
                      key: 'reserves',
                      title: 'Reservas',
                      badgeBg: 'bg-pink-500/10 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400 border-pink-500/20',
                      badgeText: 'text-pink-600 dark:text-pink-400',
                      borderColor: 'border-pink-500/30',
                      iconBg: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
                      subtotalColor: 'text-pink-600 dark:text-pink-400',
                      Icon: PiggyBank,
                    },
                    investments: {
                      key: 'investments',
                      title: 'Investimentos',
                      badgeBg: 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
                      badgeText: 'text-indigo-600 dark:text-indigo-400',
                      borderColor: 'border-indigo-500/30',
                      iconBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
                      subtotalColor: 'text-indigo-600 dark:text-indigo-400',
                      Icon: Briefcase,
                    },
                  };

                  const subGroupBuckets: Record<string, {
                    config: typeof SUB_GROUPS_CONFIG[string];
                    transactions: Transaction[];
                    sum: number;
                  }> = {
                    income: { config: SUB_GROUPS_CONFIG.income, transactions: [], sum: 0 },
                    op_expense: { config: SUB_GROUPS_CONFIG.op_expense, transactions: [], sum: 0 },
                    personal_expense: { config: SUB_GROUPS_CONFIG.personal_expense, transactions: [], sum: 0 },
                    reserves: { config: SUB_GROUPS_CONFIG.reserves, transactions: [], sum: 0 },
                    investments: { config: SUB_GROUPS_CONFIG.investments, transactions: [], sum: 0 },
                  };

                  group.transactions.forEach(t => {
                    const isReserveTx = (t as any).isReserveTx;
                    const isInvestmentTx = (t as any).isInvestmentTx;
                    const isDividendTx = (t as any).isDividendTx;
                    const isReserveRendimento = isReserveTx && (t as any).reserveTxType === 'rendimento';
                    const isReserveUseEx = !isReserveTx && (
                      t.is_reserve_use || 
                      (t as any).isReserveUseOriginal || 
                      t.description?.startsWith('[Reserva]') || 
                      (t as any).rawDescription?.startsWith('[Reserva]')
                    );
                    const isReserveUtilizacao = isReserveTx && (t as any).reserveTxType === 'utilizacao';

                    let groupKey = 'income';

                    if (isDividendTx || isReserveRendimento) {
                      groupKey = 'income';
                    } else if (isInvestmentTx) {
                      groupKey = 'investments';
                    } else if (isReserveUseEx || isReserveUtilizacao) {
                      // Uso de reserva agrupa conforme a categoria (despesa operacional ou pessoal)
                      const effectiveCat = (t as any).originalCategory || t.category;
                      if (isOperationalCategory(effectiveCat, opCats)) {
                        groupKey = 'op_expense';
                      } else {
                        groupKey = 'personal_expense';
                      }
                    } else if (isReserveTx || t.category === 'Aporte Reserva' || t.category === 'Resgate Reserva') {
                      groupKey = 'reserves';
                    } else if (t.type === 'income') {
                      groupKey = 'income';
                    } else if (isOperationalCategory(t.category, opCats)) {
                      groupKey = 'op_expense';
                    } else {
                      groupKey = 'personal_expense';
                    }

                    const amt = Number((t as any).rawAmount !== undefined ? (t as any).rawAmount : t.amount);
                    subGroupBuckets[groupKey].transactions.push(t);

                    if (groupKey === 'income') {
                      subGroupBuckets[groupKey].sum += amt;
                    } else if (groupKey === 'op_expense' || groupKey === 'personal_expense') {
                      subGroupBuckets[groupKey].sum += amt;
                    } else if (groupKey === 'reserves') {
                      if (t.type === 'income' || (t as any).reserveTxType === 'rendimento') {
                        subGroupBuckets[groupKey].sum += amt;
                      } else {
                        subGroupBuckets[groupKey].sum -= amt;
                      }
                    } else if (groupKey === 'investments') {
                      if ((t as any).investmentTxType === 'sell' || (t as any).isDividendTx) {
                        subGroupBuckets[groupKey].sum += amt;
                      } else {
                        subGroupBuckets[groupKey].sum -= amt;
                      }
                    }
                  });

                  const activeSubGroups = ['income', 'op_expense', 'personal_expense', 'reserves', 'investments']
                    .map(k => subGroupBuckets[k])
                    .filter(sg => sg.transactions.length > 0);

                  const dateKey = group.date.toISOString();

                  return (
                    <div className="space-y-0">
                      {activeSubGroups.map(sg => {
                        const IconComponent = sg.config.Icon;
                        const isCollapsed = isSubGroupCollapsed(dateKey, sg.config.key);

                        return (
                          <div key={sg.config.key} className="border-t first:border-t-0 border-border/40">
                            {/* Sub-Group Header - Collapsible */}
                            <button
                              type="button"
                              onClick={() => toggleSubGroup(dateKey, sg.config.key)}
                              className={`w-full px-3 py-2 sm:px-4 sm:py-2 flex items-center justify-between border-b border-border/30 bg-muted/10 transition-colors hover:bg-muted/20 cursor-pointer text-left ${sg.config.badgeBg}`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`p-1 rounded-lg ${sg.config.iconBg} shrink-0`}>
                                  <IconComponent className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-extrabold text-xs tracking-tight text-foreground">
                                  {sg.config.title}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-background/80 border border-border/50 text-muted-foreground">
                                  {sg.transactions.length} {sg.transactions.length === 1 ? 'item' : 'itens'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`font-mono font-extrabold text-xs ${sg.config.subtotalColor}`}>
                                  {sg.config.key === 'income' ? `+${formatCurrency(sg.sum)}` :
                                   sg.config.key === 'op_expense' || sg.config.key === 'personal_expense' ? `-${formatCurrency(sg.sum)}` :
                                   `${sg.sum >= 0 ? '+' : ''}${formatCurrency(sg.sum)}`}
                                </span>
                                <div className="p-0.5 rounded text-muted-foreground hover:text-foreground">
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                                </div>
                              </div>
                            </button>

                            {/* Sub-Group Transactions */}
                            {!isCollapsed && (
                              <div className="divide-y divide-border/40">
                                {sg.transactions.map(t => renderTransactionItem(t))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })() : (
                  <div className="divide-y divide-border/60">
                    {group.transactions.map(t => renderTransactionItem(t))}
                  </div>
                )}
                {false && <div className="hidden">
                  {group.transactions.map(t => {
                    const isReserveTx = (t as any).isReserveTx;
                    const isAporte = isReserveTx ? ((t as any).reserveTxType === 'aporte') : false;
                    const isRendimento = isReserveTx ? ((t as any).reserveTxType === 'rendimento') : false;
                    const isUtilizacao = isReserveTx ? ((t as any).reserveTxType === 'utilizacao') : false;
                    const isReserveUseEx = !isReserveTx && (t.is_reserve_use || (t as any).isReserveUseOriginal || t.description?.startsWith('[Reserva]') || (t as any).rawDescription?.startsWith('[Reserva]'));
                    const isIncome = t.type === 'income';
                    
                    const isInvestmentReserveUse = isReserveTx && isUtilizacao && (
                      (t as any).originalCategory === 'Investimentos' || 
                      (t as any).linkedInvestmentId || 
                      t.description?.includes('Investimento:')
                    );

                    const isVendaAtivo = isReserveTx && isRendimento && (
                      (t as any).originalCategory === 'Venda de Ativos' ||
                      t.description?.includes('Venda de Ativo')
                    );

                    const matchedReserveInfo = isReserveUseEx ? (() => {
                      const matchRt = (reserveTransactions || []).find(
                        rt => rt.type === 'utilizacao' && 
                              rt.date === t.date && 
                              Math.abs(Number(rt.amount) - Number((t as any).rawAmount !== undefined ? (t as any).rawAmount : t.amount)) < 0.01
                      );
                      if (matchRt) {
                        const res = reserves.find(r => r.id === matchRt.reserve_id);
                        return { reserve: res, rt: matchRt };
                      }
                      return null;
                    })() : null;

                    const catMeta = isReserveTx
                      ? { 
                          icon: PiggyBank, 
                          color: isAporte 
                            ? 'text-pink-500 bg-pink-500/10 border-pink-500/20' 
                            : 'text-blue-500 bg-blue-500/10 border-blue-500/20' 
                        }
                      : getCategoryMeta(t.category, t.type);

                    const SelectedIcon = isReserveTx
                      ? (iconOptions[(t as any).reserveIcon as keyof typeof iconOptions] || PiggyBank)
                      : isReserveUseEx
                        ? (iconOptions[matchedReserveInfo?.reserve?.icon as keyof typeof iconOptions] || PiggyBank)
                        : catMeta.icon;

                    const isExpanded = expandedId === t.id;
                    const fuelCost = isReserveTx ? 0 : calculateFuel(t.start_km, t.end_km);
                    const contributions = isReserveTx ? [] : getTransactionReserveContributions(t);
                    const sumContributions = contributions.reduce((sum, item) => sum + item.amount, 0);
                    
                    const displayAmount = (t as any).rawAmount !== undefined ? (t as any).rawAmount : t.amount;
                    
                    const isPizzaria = !isReserveTx && t.category === 'Pizzaria';
                    const pizzariaBreakdown = isPizzaria ? (() => {
                      const dels = t.deliveries ?? 0;
                      const out = t.out_of_neighborhood ?? 0;
                      const baseDels = settings?.pizzaria_base_deliveries ?? 8;
                      const baseRate = settings?.pizzaria_base_rate ?? 90;
                      const aboveBaseRate = settings?.pizzaria_daily_rate_above_base ?? 50;
                      const delRate = settings?.pizzaria_delivery_rate ?? 5;
                      const outRate = settings?.pizzaria_out_of_neighborhood_rate ?? 4;

                      let diaria = 0;
                      let valorEntregas = 0;
                      let valorForaBairro = out * outRate;

                      if (dels <= baseDels) {
                        diaria = baseRate;
                        valorEntregas = 0;
                      } else {
                        diaria = aboveBaseRate;
                        valorEntregas = dels * delRate;
                      }

                      return {
                        dels,
                        out,
                        baseDels,
                        baseRate,
                        aboveBaseRate,
                        delRate,
                        outRate,
                        diaria,
                        valorEntregas,
                        valorForaBairro,
                        totalCalculado: diaria + valorEntregas + valorForaBairro
                      };
                    })() : null;
                    
                    // Lucro Líquido Real do lançamento
                    const transactionNet = Number((isIncome ? (displayAmount - fuelCost) : -displayAmount).toFixed(2));
                    const pocketRest = Number((isIncome ? (displayAmount - fuelCost - sumContributions) : -displayAmount).toFixed(2));

                    const isHighlighted = highlightId === t.id;

                    return (
                      <div 
                        key={t.id} 
                        id={`transaction-${t.id}`}
                        className={`transition-all duration-300 ${
                          isHighlighted 
                            ? 'ring-2 ring-amber-500/60 dark:ring-amber-500 bg-amber-500/[0.04] dark:bg-amber-500/[0.08] shadow-md rounded-xl my-2 border border-amber-500/20' 
                            : 'border-b border-border/10'
                        }`}
                        style={
                          isReserveTx 
                            ? { borderLeft: `4px solid ${(t as any).reserveColor}` } 
                            : isReserveUseEx 
                              ? { borderLeft: `3px dashed ${matchedReserveInfo?.reserve?.color || '#ef4444'}` } 
                              : {}
                        }
                      >
                        {/* Transaction Bar Row */}
                        <div 
                          onClick={() => {
                            if (selectMode) {
                              toggleSelectId(t.id);
                              return;
                            }
                            setExpandedId(isExpanded ? null : t.id);
                            if (isHighlighted) {
                              searchParams.delete('highlight');
                              setSearchParams(searchParams, { replace: true });
                            }
                          }}
                          className={`p-3 sm:px-4 flex items-center justify-between gap-3 bg-card hover:bg-muted/15 transition-colors cursor-pointer ${
                            isExpanded ? 'bg-muted/10' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            {/* Checkbox for Select Mode */}
                            {selectMode && (
                              <div className="shrink-0 text-indigo-500">
                                {selectedIds.has(t.id) ? (
                                  <CheckSquare className="w-4.5 h-4.5 text-indigo-500" />
                                ) : (
                                  <Square className="w-4.5 h-4.5 text-muted-foreground/60" />
                                )}
                              </div>
                            )}
                            {/* Colorful responsive category circle */}
                            {isReserveTx ? (
                              <div 
                                className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white"
                                style={{ backgroundColor: (t as any).reserveColor || '#3b82f6' }}
                              >
                                <SelectedIcon className="w-4.5 h-4.5 shrink-0 text-white" />
                              </div>
                            ) : isReserveUseEx ? (
                              <div 
                                className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white"
                                style={{ backgroundColor: matchedReserveInfo?.reserve?.color || '#eab308' }}
                              >
                                <SelectedIcon className="w-4.5 h-4.5 shrink-0 text-white" />
                              </div>
                            ) : (t as any).isInvestmentTx ? (
                              <div className="p-2.5 rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500 shrink-0">
                                <TrendingUp className="w-4 h-4 shrink-0" />
                              </div>
                            ) : (t as any).isDividendTx ? (
                              <div className={`p-2.5 rounded-xl border shrink-0 ${
                                (t as any).dividendStatus === 'provisioned'
                                  ? 'border-amber-500/20 bg-amber-500/10 text-amber-500'
                                  : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                              }`}>
                                <Coins className="w-4 h-4 shrink-0" />
                              </div>
                            ) : (
                              <div className={`p-2.5 rounded-xl border ${catMeta.color} shrink-0`}>
                                <SelectedIcon className="w-4 h-4 shrink-0" />
                              </div>
                            )}
                            <div className="overflow-hidden">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                                  {isReserveTx 
                                    ? `${(t as any).reserveName}` 
                                    : isReserveUseEx
                                      ? `${matchedReserveInfo?.reserve?.name || 'Reserva Excluída'}`
                                      : (t as any).isInvestmentTx
                                        ? `Investimento: ${(t as any).ticker}`
                                        : (t as any).isDividendTx
                                          ? `${(t as any).dividendStatus === 'provisioned' ? 'A Receber: ' : 'Recebido: '}${(t as any).ticker}`
                                          : t.category
                                  }
                                </span>
                                {isReserveTx && (
                                  <span 
                                    className="text-[9px] font-extrabold border rounded px-1.5 py-0.5 tracking-wider uppercase scale-95 shrink-0"
                                    style={{
                                      borderColor: (t as any).reserveColor + '40',
                                      backgroundColor: (t as any).reserveColor + '15',
                                      color: (t as any).reserveColor,
                                    }}
                                  >
                                    {isAporte ? 'Aporte' : (isVendaAtivo ? 'Venda Ativo' : (isRendimento ? 'Rendimento' : (isInvestmentReserveUse ? 'Compra Ativo' : 'Resgate')))}
                                  </span>
                                )}
                                {(t as any).isInvestmentTx && (
                                  <span className="text-[9px] font-extrabold border border-blue-500/30 bg-blue-500/10 text-blue-500 rounded px-1.5 py-0.5 tracking-wider uppercase scale-95 shrink-0 animate-in fade-in">
                                    {(t as any).investmentTxType === 'buy' ? 'Compra' : 'Venda'}
                                  </span>
                                )}
                                {(t as any).isDividendTx && (
                                  <span className={`text-[9px] font-extrabold border rounded px-1.5 py-0.5 tracking-wider uppercase scale-95 shrink-0 animate-in fade-in ${
                                    (t as any).dividendStatus === 'provisioned'
                                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                                  }`}>
                                    {((t as any).dividendStatus === 'provisioned' ? 'A Receber • ' : 'Recebido • ') + ((t as any).dividendType || 'Provento')}
                                  </span>
                                )}
                                {isReserveUseEx && (
                                  <span 
                                    className="text-[9px] font-extrabold border rounded px-1.5 py-0.5 tracking-wider uppercase scale-95 shrink-0"
                                    style={{
                                      borderColor: (matchedReserveInfo?.reserve?.color || '#eab308') + '40',
                                      backgroundColor: (matchedReserveInfo?.reserve?.color || '#eab308') + '15',
                                      color: matchedReserveInfo?.reserve?.color || '#eab308',
                                    }}
                                  >
                                    Resgate / Uso
                                  </span>
                                )}
                                {t.start_km != null && t.end_km != null && (
                                  <span className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 rounded px-1 flex items-center gap-0.5">
                                    <Navigation className="w-2.5 h-2.5" /> {(Number(t.end_km) - Number(t.start_km))} km
                                  </span>
                                )}
                                {t.category === 'Pizzaria' && t.deliveries != null && (
                                  <span className="text-[9px] font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 rounded px-1">
                                    {t.deliveries} entregas
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] sm:text-xs text-muted-foreground truncate font-medium mt-0.5">
                                {t.description ? t.description.replace(/^\[Reserva\]\s*/, '') : 'Sem descrição cadastrada'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p 
                                className="font-extrabold text-xs sm:text-sm font-mono"
                                style={{
                                  color: isIncome 
                                    ? '#10b981' 
                                    : isReserveUseEx 
                                      ? '#ef4444' : isAporte ? '#f59e0b'
                                      : '#ef4444'
                                }}
                              >
                                {isIncome ? '+' : '-'}{formatCurrency(displayAmount)}
                              </p>
                              {!isReserveTx && isIncome && fuelCost > 0 && (
                                <p className="text-[9px] text-muted-foreground font-semibold">
                                  Livre: {formatCurrency(transactionNet)}
                                </p>
                              )}
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground/60" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
                            )}
                          </div>
                        </div>

                        {/* Collapsible Detail Sheet */}
                        {isExpanded && (
                          <div className="px-4 py-4 bg-muted/20 border-t border-border/40 space-y-4">
                            <div className={`grid grid-cols-1 ${isReserveTx || isIncome ? 'md:grid-cols-2' : ''} gap-4`}>
                              {/* Left Columns details */}
                              <div className="bg-card border border-border/60 rounded-xl p-3.5 space-y-3">
                                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5" /> Detalhes Gerais
                                  </span>
                                  {isReserveTx ? (
                                    <span 
                                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                      style={{
                                        backgroundColor: (t as any).reserveColor + '15',
                                        color: (t as any).reserveColor,
                                      }}
                                    >
                                      {isRendimento ? (isVendaAtivo ? 'Venda de Ativo' : 'Rendimento de Reserva') : (isAporte ? 'Aporte Reservado' : (isInvestmentReserveUse ? 'Compra de Ativo' : 'Uso de Reserva'))}
                                    </span>
                                  ) : (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                                      {isIncome ? 'Entrada / Ganho' : 'Saída / Gasto'}
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  <div>
                                    <p className="text-[10px] text-muted-foreground font-semibold lowercase tracking-wide">Categoria</p>
                                    <p className="font-bold text-foreground mt-0.5">
                                      {isReserveTx 
                                        ? (isRendimento ? (isVendaAtivo ? `Venda Ativo: ${(t as any).reserveName}` : `Rendimento: ${(t as any).reserveName}`) : isAporte ? `Aporte: ${(t as any).reserveName}` : (isInvestmentReserveUse ? `Compra Ativo: ${(t as any).reserveName}` : `Resgate: ${(t as any).reserveName}`)) 
                                        : t.category
                                      }
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-muted-foreground font-semibold lowercase tracking-wide">Data do lançamento</p>
                                    <p className="font-semibold text-foreground mt-0.5">
                                      {format(parseLocalDate(t.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                    </p>
                                  </div>
                                  {t.description && (
                                    <div className="col-span-2">
                                      <p className="text-[10px] text-muted-foreground font-semibold lowercase tracking-wide">Descrição / Notas</p>
                                      <p className="font-medium text-foreground mt-0.5 whitespace-pre-wrap leading-relaxed truncate-2-lines">
                                        {t.description || 'Nenhuma nota adicional adicionada.'}
                                      </p>
                                    </div>
                                  )}
                 

                                </div>

                                {/* Pizzaria specification with financial details */}
                                {pizzariaBreakdown && (
                                  <div className="mt-2.5 p-2 bg-indigo-500/[0.015] dark:bg-indigo-500/[0.005] border border-indigo-500/10 rounded-xl space-y-1.5">
                                    <div className="flex items-center justify-between border-b border-indigo-500/5 pb-1">
                                      <div className="flex items-center gap-1">
                                        <Bike className="w-3 h-3 text-indigo-500 shrink-0" />
                                        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Detalhamento Pizzaria</span>
                                      </div>
                                      <span className="text-[8.5px] px-1.5 py-0.2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black rounded-full leading-none">
                                        {pizzariaBreakdown.dels + pizzariaBreakdown.out} entregas
                                      </span>
                                    </div>

                                    <div className="space-y-1 text-[9.5px]">
                                      {/* Diária */}
                                      <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                          <span className="w-1 h-1 rounded-full bg-indigo-400/40 shrink-0" />
                                          Diária Apoio {pizzariaBreakdown.dels <= pizzariaBreakdown.baseDels ? '(Base)' : '(Mínima)'}:
                                        </span>
                                        <span className="font-bold text-foreground font-mono">{formatCurrency(pizzariaBreakdown.diaria)}</span>
                                      </div>

                                      {/* Entregas no Bairro */}
                                      <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                          <span className="w-1 h-1 rounded-full bg-indigo-400/40 shrink-0" />
                                          Entregas Bairro ({pizzariaBreakdown.dels}x):
                                        </span>
                                        <span className="font-bold text-foreground font-mono">
                                          {pizzariaBreakdown.dels <= pizzariaBreakdown.baseDels 
                                            ? 'Inclusas' 
                                            : `+${formatCurrency(pizzariaBreakdown.valorEntregas)}`
                                          }
                                        </span>
                                      </div>

                                      {/* Entregas Fora do Bairro */}
                                      {pizzariaBreakdown.out > 0 && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-muted-foreground flex items-center gap-1">
                                            <span className="w-1 h-1 rounded-full bg-indigo-500 shrink-0" />
                                            Fora Bairro ({pizzariaBreakdown.out}x):
                                          </span>
                                          <span className="font-bold text-indigo-500 font-mono">
                                            +{formatCurrency(pizzariaBreakdown.valorForaBairro)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Right column details / KM metrics or Reserve Origin info */}
                              {(isReserveTx || isIncome) && (
                                <div className="bg-card border border-border/60 rounded-xl p-3.5 space-y-3">
                                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                      {isReserveTx ? <PiggyBank className="w-3.5 h-3.5" /> : <Navigation className="w-3.5 h-3.5" />}
                                      {isReserveTx ? 'Informações da Reserva' : 'Métricas e Performance'}
                                    </h4>
                                    {isReserveTx ? (
                                      <span className="text-[10px] font-bold px-1.5 bg-indigo-500/10 text-indigo-500 rounded">
                                        Cofrinho Integrado
                                      </span>
                                    ) : (
                                      t.start_km != null && t.end_km != null && (
                                        <span className="text-[10px] font-bold px-1.5 bg-blue-500/10 text-blue-500 rounded">
                                          KM Rastreado
                                        </span>
                                      )
                                    )}
                                  </div>

                                  {isReserveTx ? (
                                    <div className="flex items-center gap-3 pt-1">
                                      <div 
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm font-bold"
                                        style={{ backgroundColor: (t as any).reserveColor }}
                                      >
                                        <SelectedIcon className="w-5 h-5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-bold text-foreground text-sm truncate">{(t as any).reserveName}</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                          {isAporte 
                                            ? 'Aporte / Adição de Saldo' 
                                            : isRendimento 
                                              ? (isVendaAtivo ? 'Venda de Ativo' : 'Rendimento / Juros')
                                              : (isInvestmentReserveUse ? 'Compra de Ativo' : `Gasto: ${(t as any).reserveCategory || 'Resgate'}`)}
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    t.start_km != null && t.end_km != null ? (
                                      (() => {
                                        const distance = Number(t.end_km) - Number(t.start_km);
                                        const fuelUsed = settings?.vehicle_km_per_liter ? (distance / settings.vehicle_km_per_liter) : 0;
                                        const earnPerKm = distance > 0 ? (t.amount / distance) : 0;

                                        return (
                                          <div className="space-y-2 text-xs">
                                            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                                              <span className="text-muted-foreground font-medium">Odômetro</span>
                                              <span className="font-bold">{t.start_km} → {t.end_km} <span className="text-muted-foreground text-[10px]">({distance} km)</span></span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              <div className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-card">
                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Fuel className="w-3.5 h-3.5 text-rose-500" /> Custo Combust.</span>
                                                <span className="font-bold text-rose-500">{formatCurrency(fuelCost)} <span className="text-muted-foreground text-[10px] font-medium">({fuelUsed.toFixed(1)}L)</span></span>
                                              </div>
                                              <div className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-card">
                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-emerald-500" /> Ganho por KM</span>
                                                <span className="font-bold text-emerald-500">{formatCurrency(earnPerKm)}</span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })()
                                    ) : (
                                      <div className="flex items-center justify-center py-6 text-center">
                                        <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px]">
                                          Não foram registrados KM inicial/final neste lançamento. Ative na edição para obter dados de métricas e gastos.
                                        </p>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Guarded values & Reserves Detailed Contribution Block */}
                            {!isReserveTx && contributions.length > 0 && (
                              <CollapsibleContributionsBlock 
                                contributions={contributions} 
                                formatCurrency={formatCurrency} 
                              />
                            )}

                            {/* Final launch balance pipeline breakdown */}
                            {!isReserveTx && isIncome && (
                              <CollapsibleCashFlowBlock
                                displayAmount={displayAmount}
                                fuelCost={fuelCost}
                                transactionNet={transactionNet}
                                pocketRest={pocketRest}
                                sumContributions={sumContributions}
                                pizzariaBreakdown={pizzariaBreakdown}
                                formatCurrency={formatCurrency}
                              />
                            )}

                            {/* Action Operations menu */}
                            <div className="flex items-center justify-between border-t border-border/40 pt-3">
                              <span className="text-[10px] text-muted-foreground font-medium">
                                ID do Lançamento: <span className="font-mono">{t.id.slice(0, 8)}...</span>
                              </span>
                              <div className="flex items-center gap-2">
                                {!((t as any).isInvestmentTx || (t as any).isDividendTx) ? (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => openEdit(t)} 
                                    className="h-8 border-border bg-card text-foreground font-semibold px-3 text-xs flex items-center gap-1.5 hover:bg-muted/10"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                                    Editar
                                  </Button>
                                ) : (
                                  <span className="text-[9.5px] text-muted-foreground/80 font-medium italic select-none">
                                    Gerenciável em Investimentos
                                  </span>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => {
                                    const deleteType = (t as any).isInvestmentTx 
                                      ? 'investment_transaction' 
                                      : (t as any).isDividendTx 
                                        ? 'dividend' 
                                        : isReserveTx 
                                          ? 'reserve_transaction' 
                                          : 'transaction';
                                    askDelete(t.id, deleteType);
                                  }} 
                                  className="h-8 text-rose-500 font-bold px-3 text-xs flex items-center gap-1.5 hover:bg-rose-500/10 hover:text-rose-600 border border-transparent hover:border-rose-200"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                  Excluir
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>}
              </Card>
            );
          })}

          {groupedTransactions.length > visibleGroupsCount && (
            <div className="flex flex-col items-center justify-center pt-2 pb-6 space-y-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider gap-2 hover:bg-indigo-500/5 hover:text-indigo-500 border border-border/80 shadow-xs transition-all duration-200"
                onClick={() => setVisibleGroupsCount(prev => prev + 10)}
              >
                <ChevronDown className="w-4 h-4 text-indigo-500 animate-bounce duration-1000" />
                Carregar Mais Dias ({groupedTransactions.length - visibleGroupsCount} restantes)
              </Button>
              <p className="text-[9.5px] text-muted-foreground font-semibold">
                Exibindo {visibleGroupsCount} de {groupedTransactions.length} dias ativos
              </p>
            </div>
          )}
        </div>
      )}

      {/* Edit Sheet */}
      <Sheet open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <SheetContent side="bottom" className="w-full max-w-full overflow-x-hidden max-h-[85dvh] rounded-t-3xl px-4 sm:max-w-md sm:mx-auto overflow-y-auto pb-8">
          <SheetHeader className="mb-4 mt-2">
            <SheetTitle>{editIsReserve ? 'Editar Movimentação de Reserva' : 'Editar Lançamento'}</SheetTitle>
            <SheetDescription className="text-xs">
              {editIsReserve ? 'Altere as informações desta movimentação específica.' : 'Altere os dados do seu lançamento abaixo.'}
            </SheetDescription>
          </SheetHeader>

          {editIsReserve ? (
            <form onSubmit={handleEditSubmit} className="space-y-3">
              {/* Type toggle */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Tipo de Registro</label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => { setEditReserveTxType('aporte'); setEditReserveCategory(''); }}
                    className={`py-2 text-xs font-semibold rounded-md transition-all ${
                      editReserveTxType === 'aporte' 
                        ? 'bg-white dark:bg-zinc-950 shadow text-emerald-600 font-extrabold' 
                        : 'text-muted-foreground'
                    }`}
                  >
                    Aporte (Entrada)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditReserveTxType('utilizacao')}
                    className={`py-2 text-xs font-semibold rounded-md transition-all ${
                      editReserveTxType === 'utilizacao' 
                        ? 'bg-white dark:bg-zinc-950 shadow text-rose-500 font-extrabold' 
                        : 'text-muted-foreground'
                    }`}
                  >
                    Resgate (Saída)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditReserveTxType('rendimento'); setEditReserveCategory(''); }}
                    className={`py-2 text-xs font-semibold rounded-md transition-all ${
                      editReserveTxType === 'rendimento' 
                        ? 'bg-white dark:bg-zinc-950 shadow text-indigo-500 font-extrabold' 
                        : 'text-muted-foreground'
                    }`}
                  >
                    Rendimento
                  </button>
                </div>
              </div>

              {/* Reserve Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Reserva Destino/Origem</label>
                <div className="grid grid-cols-2 gap-2">
                  {(reserves || []).map(r => {
                    const isSelected = editReserveId === r.id;
                    const Icon = iconOptions[r.icon as keyof typeof iconOptions] || PiggyBank;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setEditReserveId(r.id);
                          if (r.require_category_on_use === false) {
                            setEditReserveCategory(r.default_use_category || r.name);
                          }
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 cursor-pointer gap-2 ${
                          isSelected 
                            ? 'bg-primary/10 border-primary text-primary shadow-xs scale-[1.02]' 
                            : 'bg-card border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                        }`}
                      >
                        <div 
                          className="p-2 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: isSelected ? r.color : `${r.color}99` }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="text-center min-w-0 w-full">
                          <span className="block text-xs font-bold line-clamp-1">{r.name}</span>
                          <span className="block text-[10px] font-semibold opacity-75 mt-0.5">{formatCurrency(r.saldo_atual || 0)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!editReserveId && <p className="text-[10px] text-rose-500 font-semibold px-1">Por favor, selecione uma reserva para continuar.</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Valor (R$)</label>
                  <CurrencyInput
                    placeholder="0,00"
                    value={editAmount}
                    onChange={setEditAmount}
                    className="rounded-lg border-border"
                    required
                  />
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Data</label>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="rounded-lg border-border"
                    required
                  />
                </div>
              </div>

              {/* Vehicle Selection for Reserve Utilization - Right below Valor */}
              {editReserveTxType === 'utilizacao' && vehicles && vehicles.length > 0 && isVehicleRelatedCategory(editReserveCategory, null, 'expense', settings) && (
                <div className="space-y-1.5 pt-0.5 animate-fade-in">
                  <VehicleSelect
                    value={editVehicleId === '__none__' ? '' : editVehicleId}
                    onChange={(val) => {
                      setEditVehicleId(val === '' ? '__none__' : val);
                    }}
                    label="Veículo / Moto Vinculada"
                    showAddOption={true}
                  />
                </div>
              )}

              {/* Category (only for utilization) */}
              {editReserveTxType === 'utilizacao' && (!selectedReserve || selectedReserve.require_category_on_use !== false) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categoria do Gasto (Opcional)</label>
                  <Select value={editReserveCategory || 'none'} onValueChange={(val) => setEditReserveCategory(val === 'none' ? '' : val)}>
                    <SelectTrigger className="border-border rounded-lg">
                      <SelectValue placeholder="Sem categoria específica" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {expenseCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editReserveTxType === 'utilizacao' && selectedReserve && selectedReserve.require_category_on_use === false && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categoria (Padrão Obrigatória)</label>
                  <Input value={selectedReserve.default_use_category || selectedReserve.name} disabled className="rounded-lg bg-muted text-muted-foreground font-semibold" />
                </div>
              )}

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição (Opcional)</label>
                <Input
                  type="text"
                  placeholder="Ex: Reforma da caixa de marcha, Aporte extra..."
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="rounded-lg border-border"
                />
              </div>

              {/* Payment Status & Due Date Section for Reserve Utilização */}
              {editReserveTxType === 'utilizacao' && (
                <div className="space-y-3 pt-2 border-t border-border/60">
                  <div className="p-3 bg-muted/20 border border-border/80 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90 flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5 text-primary" /> Status do Pagamento
                      </label>
                      <span className="text-[10px] text-muted-foreground">
                        {editPaymentStatus === 'paid' ? 'Liquidado no caixa' : 'Pendente de quitação'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditPaymentStatus('paid')}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          editPaymentStatus === 'paid'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-xs'
                            : 'bg-card border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Efetivado / Pago
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditPaymentStatus('pending')}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          editPaymentStatus === 'pending'
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-xs'
                            : 'bg-card border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" /> Pendente ⏳
                      </button>
                    </div>

                    {editPaymentStatus === 'pending' ? (
                      <div className="space-y-1.5 animate-in fade-in duration-150">
                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Data de Vencimento
                        </label>
                        <Input
                          type="date"
                          value={editDueDate || editDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          className="h-9 rounded-lg border-amber-500/30 bg-card text-xs font-semibold focus:ring-amber-500"
                          required
                        />
                        <p className="text-[9.5px] text-amber-600/90 dark:text-amber-400/90 leading-tight">
                          Resgates pendentes aparecem na seção <strong>"A Pagar / Pendentes"</strong> até a quitação.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 animate-in fade-in duration-150">
                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Data Efetiva de Pagamento
                        </label>
                        <Input
                          type="date"
                          value={editPaymentDate || editDate}
                          onChange={(e) => setEditPaymentDate(e.target.value)}
                          className="h-9 rounded-lg border-emerald-500/30 bg-card text-xs font-semibold focus:ring-emerald-500"
                          required
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recurrence & Installments Section for Reserve Utilização */}
              {editReserveTxType === 'utilizacao' && (
                <div className="p-3.5 bg-primary/[0.03] border border-primary/20 rounded-xl space-y-3.5">
                  <div 
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setEditIsRecurring(!editIsRecurring)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${editIsRecurring ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        <RefreshCw className={`w-3.5 h-3.5 ${editIsRecurring ? 'animate-spin-slow' : ''}`} />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-foreground leading-tight">
                          {editItem?.is_recurring ? 'Configurações de Recorrência' : 'Tornar Resgate Recorrente / Parcelado'}
                        </h4>
                        <p className="text-[9.5px] text-muted-foreground leading-tight">
                          {editItem?.is_recurring 
                            ? `Parcela atual: ${editItem.installment_number || 1} de ${editItem.installment_total || editItem.recurrence_installments || '?'}`
                            : 'Gera parcelas periódicas de uso de reserva no extrato'}
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editIsRecurring}
                      onChange={(e) => setEditIsRecurring(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>

                  {editIsRecurring && (
                    <div className="space-y-3.5 pt-2 border-t border-primary/10 animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">
                            Frequência
                          </label>
                          <Select
                            value={editRecurrenceFrequency}
                            onValueChange={(val: RecurrenceFrequency) => setEditRecurrenceFrequency(val)}
                          >
                            <SelectTrigger className="h-9 rounded-xl border-border bg-card text-xs font-semibold">
                              <SelectValue placeholder="Selecione a frequência" />
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

                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">
                            Qtd. Parcelas / Repetições
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditRecurrenceInstallments(String(Math.max(2, (Number(editRecurrenceInstallments) || 12) - 1)))}
                              className="h-9 w-9 shrink-0 rounded-lg bg-card border border-border flex items-center justify-center font-black text-sm hover:bg-muted cursor-pointer"
                            >
                              -
                            </button>
                            <Input
                              type="number"
                              min="2"
                              max="60"
                              value={editRecurrenceInstallments}
                              onChange={(e) => setEditRecurrenceInstallments(e.target.value)}
                              className="h-9 rounded-lg font-black text-center border-border bg-card text-xs"
                              placeholder="12"
                            />
                            <button
                              type="button"
                              onClick={() => setEditRecurrenceInstallments(String(Math.min(60, (Number(editRecurrenceInstallments) || 12) + 1)))}
                              className="h-9 w-9 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-black text-sm hover:bg-primary/90 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-bold text-muted-foreground mr-1">Atalhos:</span>
                        {['2', '3', '6', '12', '24', '36'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setEditRecurrenceInstallments(preset)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer border ${
                              editRecurrenceInstallments === preset
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card text-muted-foreground border-border hover:bg-muted'
                            }`}
                          >
                            {preset}x
                          </button>
                        ))}
                      </div>

                      {!editItem?.is_recurring ? (
                        <label className="flex items-start gap-2 p-2.5 bg-primary/5 rounded-lg border border-primary/15 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editGenerateFuture}
                            onChange={(e) => setEditGenerateFuture(e.target.checked)}
                            className="h-4 w-4 mt-0.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                          />
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-foreground">
                              Gerar as próximas parcelas automaticamente no extrato
                            </span>
                            <p className="text-[9.5px] text-muted-foreground leading-snug">
                              Cria as {(Number(editRecurrenceInstallments) || 12) - 1} parcelas futuras com status "Pendente" e vencimentos programados por {getFrequencyLabel(editRecurrenceFrequency)}.
                            </p>
                          </div>
                        </label>
                      ) : (
                        <label className="flex items-start gap-2 p-2.5 bg-primary/5 rounded-lg border border-primary/15 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editApplyToFuture}
                            onChange={(e) => setEditApplyToFuture(e.target.checked)}
                            className="h-4 w-4 mt-0.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                          />
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-foreground">
                              Aplicar valor e categoria às próximas parcelas deste grupo
                            </span>
                            <p className="text-[9.5px] text-muted-foreground leading-snug">
                              Mantém todas as parcelas futuras sincronizadas com as novas configurações.
                            </p>
                          </div>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full h-12 mt-4 font-bold rounded-xl" disabled={saving}>
                {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {saving ? 'Guardando alterações...' : 'Salvar Alterações'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 border border-border/50 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setEditType('income'); setEditCategory(''); }}
                  className={`py-2 text-xs uppercase tracking-wider font-extrabold rounded-lg transition-all ${
                    editType === 'income' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shadow-sm' : 'text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Ganho
                </button>
                <button
                  type="button"
                  onClick={() => { setEditType('expense'); setEditCategory(''); }}
                  className={`py-2 text-xs uppercase tracking-wider font-extrabold rounded-lg transition-all ${
                    editType === 'expense' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-500 shadow-sm' : 'text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Despesa
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Valor (R$)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground/75 font-bold text-sm">
                      R$
                    </div>
                    <CurrencyInput
                      placeholder="0,00"
                      value={editAmount}
                      onChange={setEditAmount}
                      className="pl-9 h-10 rounded-xl font-bold border-border"
                      disabled={editCategory === 'Pizzaria'}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Data</label>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="h-10 rounded-xl border-border font-semibold focus:ring-1 focus:ring-primary focus-visible:ring-primary"
                    required
                  />
                </div>
              </div>

              {/* Vehicle Selection in Edit Form - Placed right below Valor */}
              {vehicles && vehicles.length > 0 && (isEditCategoryVehicleRelated || (editVehicleId && editVehicleId !== '__none__')) && (
                <div className="space-y-1 pt-1 animate-fade-in">
                  <VehicleSelect
                    value={editVehicleId === '__none__' ? '' : editVehicleId}
                    onChange={(val) => {
                      setEditVehicleId(val === '' ? '__none__' : val);
                    }}
                    label="Veículo / Moto Vinculada"
                    showAddOption={true}
                    className="mt-0"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Categoria</label>
                <Select value={editCategory} onValueChange={setEditCategory} required>
                  <SelectTrigger className="h-10 rounded-xl border-border font-semibold">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {(editType === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editCategory === 'Pizzaria' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Qtd. Entregas</label>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setEditDeliveries(String(Math.max(0, (Number(editDeliveries) || 0) - 1)))} className="h-10 w-10 shrink-0 rounded-lg bg-background text-foreground flex items-center justify-center border border-border shadow-sm hover:bg-muted transition-colors font-black text-xl cursor-pointer">
                        -
                      </button>
                      <Input
                        type="number"
                        placeholder="0"
                        className="h-10 rounded-lg font-black text-base text-center border-border shadow-sm px-1 min-w-0 w-full"
                        value={editDeliveries}
                        onChange={(e) => setEditDeliveries(e.target.value)}
                        required
                      />
                      <button type="button" onClick={() => setEditDeliveries(String((Number(editDeliveries) || 0) + 1))} className="h-10 w-10 shrink-0 rounded-lg bg-indigo-500 text-white flex items-center justify-center shadow-md hover:bg-indigo-600 transition-colors font-black text-xl cursor-pointer">
                        +
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Entregas (Fora)</label>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setEditOutOfNeighborhood(String(Math.max(0, (Number(editOutOfNeighborhood) || 0) - 1)))} className="h-10 w-10 shrink-0 rounded-lg bg-background text-foreground flex items-center justify-center border border-border shadow-sm hover:bg-muted transition-colors font-black text-xl cursor-pointer">
                        -
                      </button>
                      <Input
                        type="number"
                        placeholder="0"
                        className="h-10 rounded-lg font-black text-base text-center border-border shadow-sm px-1 min-w-0 w-full"
                        value={editOutOfNeighborhood}
                        onChange={(e) => setEditOutOfNeighborhood(e.target.value)}
                      />
                      <button type="button" onClick={() => setEditOutOfNeighborhood(String((Number(editOutOfNeighborhood) || 0) + 1))} className="h-10 w-10 shrink-0 rounded-lg bg-indigo-500 text-white flex items-center justify-center shadow-md hover:bg-indigo-600 transition-colors font-black text-xl cursor-pointer">
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {settings?.categories_with_km?.includes(editCategory) && (
                <div className="space-y-2 pt-1 border-t border-border/60">
                  <div className="grid grid-cols-2 gap-3 bg-muted/10 p-2.5 border border-border/80 rounded-xl relative overflow-hidden">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">KM Inicial</label>
                      <Input
                        type="number"
                        className="h-9 rounded-lg font-semibold border-border bg-card min-w-0 w-full"
                        value={editStartKm}
                        onChange={(e) => setEditStartKm(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">KM Final</label>
                      <Input
                        type="number"
                        className="h-9 rounded-lg font-semibold border-border bg-card min-w-0 w-full"
                        value={editEndKm}
                        onChange={(e) => setEditEndKm(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Status Fields for Expense */}
              {editType === 'expense' && (
                <div className="p-3.5 bg-muted/20 border border-border/70 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        Status de Pagamento
                      </label>
                    </div>
                    <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/60">
                      <button
                        type="button"
                        onClick={() => setEditPaymentStatus('paid')}
                        className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                          editPaymentStatus === 'paid'
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Pago ✅
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditPaymentStatus('pending')}
                        className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                          editPaymentStatus === 'pending'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Pendente ⏳
                      </button>
                    </div>
                  </div>

                  {editPaymentStatus === 'pending' ? (
                    <div className="space-y-1.5 animate-in fade-in duration-150">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Data de Vencimento
                      </label>
                      <Input
                        type="date"
                        value={editDueDate || editDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="h-9 rounded-lg border-amber-500/30 bg-card text-xs font-semibold focus:ring-amber-500"
                        required
                      />
                      <p className="text-[9.5px] text-amber-600/90 dark:text-amber-400/90 leading-tight">
                        Despesas pendentes aparecem na seção <strong>"A Pagar / Pendentes"</strong> até a quitação.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 animate-in fade-in duration-150">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Data Efetiva de Pagamento
                      </label>
                      <Input
                        type="date"
                        value={editPaymentDate || editDate}
                        onChange={(e) => setEditPaymentDate(e.target.value)}
                        className="h-9 rounded-lg border-emerald-500/30 bg-card text-xs font-semibold focus:ring-emerald-500"
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Recurrence & Installments Section for Expense */}
              {editType === 'expense' && (
                <div className="p-3.5 bg-primary/[0.03] border border-primary/20 rounded-xl space-y-3.5">
                  <div 
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setEditIsRecurring(!editIsRecurring)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${editIsRecurring ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        <RefreshCw className={`w-3.5 h-3.5 ${editIsRecurring ? 'animate-spin-slow' : ''}`} />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-foreground leading-tight">
                          {editItem?.is_recurring ? 'Configurações de Recorrência' : 'Tornar Despesa Recorrente'}
                        </h4>
                        <p className="text-[9.5px] text-muted-foreground leading-tight">
                          {editItem?.is_recurring 
                            ? `Parcela atual: ${editItem.installment_number || 1} de ${editItem.installment_total || editItem.recurrence_installments || '?'}`
                            : 'Gera parcelas periódicas (mensal, semanal, etc.) no extrato'}
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editIsRecurring}
                      onChange={(e) => setEditIsRecurring(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>

                  {editIsRecurring && (
                    <div className="space-y-3.5 pt-2 border-t border-primary/10 animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">
                            Frequência
                          </label>
                          <Select
                            value={editRecurrenceFrequency}
                            onValueChange={(val: RecurrenceFrequency) => setEditRecurrenceFrequency(val)}
                          >
                            <SelectTrigger className="h-9 rounded-xl border-border bg-card text-xs font-semibold">
                              <SelectValue placeholder="Selecione a frequência" />
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

                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">
                            Qtd. Parcelas / Repetições
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditRecurrenceInstallments(String(Math.max(2, (Number(editRecurrenceInstallments) || 12) - 1)))}
                              className="h-9 w-9 shrink-0 rounded-lg bg-card border border-border flex items-center justify-center font-black text-sm hover:bg-muted cursor-pointer"
                            >
                              -
                            </button>
                            <Input
                              type="number"
                              min="2"
                              max="60"
                              value={editRecurrenceInstallments}
                              onChange={(e) => setEditRecurrenceInstallments(e.target.value)}
                              className="h-9 rounded-lg font-black text-center border-border bg-card text-xs"
                              placeholder="12"
                            />
                            <button
                              type="button"
                              onClick={() => setEditRecurrenceInstallments(String(Math.min(60, (Number(editRecurrenceInstallments) || 12) + 1)))}
                              className="h-9 w-9 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-black text-sm hover:bg-primary/90 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Quick Presets for Installments */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-bold text-muted-foreground mr-1">Atalhos:</span>
                        {['2', '3', '6', '12', '24', '36'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setEditRecurrenceInstallments(preset)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer border ${
                              editRecurrenceInstallments === preset
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card text-muted-foreground border-border hover:bg-muted'
                            }`}
                          >
                            {preset}x
                          </button>
                        ))}
                      </div>

                      {/* Action Scope: New recurring vs Existing recurring */}
                      {!editItem?.is_recurring ? (
                        <label className="flex items-start gap-2 p-2.5 bg-primary/5 rounded-lg border border-primary/15 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editGenerateFuture}
                            onChange={(e) => setEditGenerateFuture(e.target.checked)}
                            className="h-4 w-4 mt-0.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                          />
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-foreground">
                              Gerar as próximas parcelas automaticamente no extrato
                            </span>
                            <p className="text-[9.5px] text-muted-foreground leading-snug">
                              Cria as {(Number(editRecurrenceInstallments) || 12) - 1} parcelas futuras com status "Pendente" e vencimentos programados por {getFrequencyLabel(editRecurrenceFrequency)}.
                            </p>
                          </div>
                        </label>
                      ) : (
                        <label className="flex items-start gap-2 p-2.5 bg-primary/5 rounded-lg border border-primary/15 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editApplyToFuture}
                            onChange={(e) => setEditApplyToFuture(e.target.checked)}
                            className="h-4 w-4 mt-0.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                          />
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-foreground">
                              Aplicar valor e categoria às próximas parcelas deste grupo
                            </span>
                            <p className="text-[9.5px] text-muted-foreground leading-snug">
                              Mantém todas as parcelas futuras sincronizadas com as novas configurações.
                            </p>
                          </div>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Descrição</label>
                <Input
                  type="text"
                  placeholder="Ex: Corrida extra, Mensalidade..."
                  className="h-10 rounded-xl border-border"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full h-11 mt-3 rounded-xl font-black uppercase tracking-wider text-sm shadow-xs" disabled={saving}>
                {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Quick Settle Confirmation Modal */}
      <Dialog open={!!settleItem} onOpenChange={(open) => !open && setSettleItem(null)}>
        <DialogContent className="max-w-md p-6 bg-card border border-border/80 rounded-2xl shadow-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg font-extrabold text-foreground tracking-tight flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              Quitar / Registrar Pagamento
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Confirme a quitação da despesa para debitá-la do saldo e atualizar seu extrato.
            </DialogDescription>
          </DialogHeader>

          {settleItem && (
            <div className="my-3 p-4 bg-muted/20 border border-border/70 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-foreground">{settleItem.category}</span>
                <span className="text-sm font-mono font-black text-rose-600 dark:text-rose-400">
                  {formatCurrency(settleItem.amount)}
                </span>
              </div>
              {settleItem.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {settleItem.description}
                </p>
              )}
              {settleItem.due_date && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>Vencimento original: <strong className="text-foreground">{format(parseLocalDate(settleItem.due_date), 'dd/MM/yyyy')}</strong></span>
                </div>
              )}

              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                  Data em que foi pago:
                </label>
                <Input
                  type="date"
                  value={settlePaymentDate}
                  onChange={(e) => setSettlePaymentDate(e.target.value)}
                  className="h-10 rounded-xl border-border bg-card font-semibold text-xs"
                  required
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettleItem(null)}
              className="h-10 rounded-xl text-xs font-bold border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSettle}
              disabled={isSettling}
              className="h-10 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5"
            >
              {isSettling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
              {isSettling ? 'Quitando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-md p-6 bg-card border border-border/70 rounded-2xl shadow-xl">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-lg font-extrabold text-foreground tracking-tight flex items-center gap-2">
              <Trash className="w-5 h-5 text-rose-500" /> Confirmar Exclusão
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Tem certeza que deseja excluir permanentemente este lançamento? 
              Essa ação não poderá ser desfeita e os valores associados serão recalculados instantaneamente nos seus lucros e reservas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => setDeleteConfirmId(null)}
              disabled={isDeleting}
              className="h-11 rounded-xl font-bold border-border/80 hover:bg-muted/10 text-foreground"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              type="button"
              onClick={handleExecuteDelete}
              disabled={isDeleting}
              className="h-11 bg-rose-500 hover:bg-rose-600 font-bold rounded-xl text-white flex items-center justify-center gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Excluindo...
                </>
              ) : (
                <>
                  <Trash className="w-4 h-4" /> Excluir Permanentemente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Batch Selection Bar */}
      {selectMode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-lg bg-foreground text-background dark:bg-card dark:text-foreground border border-border/80 shadow-2xl rounded-2xl p-3 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="p-1.5 rounded-lg bg-background/10 hover:bg-background/20 transition-colors cursor-pointer"
              title="Selecionar Todos"
            >
              {selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0 ? (
                <CheckSquare className="w-5 h-5 text-indigo-400" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>
            <div>
              <p className="text-xs font-black uppercase tracking-wider">
                {selectedIds.size} selecionado(s)
              </p>
              <p className="text-[10px] opacity-80 font-mono font-bold">
                Total: {selectedTotals.total >= 0 ? '+' : ''}{formatCurrency(selectedTotals.total)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                onClick={handleBatchDelete}
                className="h-9 text-xs font-extrabold rounded-xl px-3 bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash className="w-3.5 h-3.5" />}
                Excluir ({selectedIds.size})
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedIds(new Set());
                setSelectMode(false);
              }}
              className="h-9 text-xs font-bold rounded-xl px-3 border-border/60 bg-transparent cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* Executive Report Modal */}
      <ExecutiveReportModal
        open={showReportModal}
        onOpenChange={setShowReportModal}
        allTransactions={allTransactions}
        settings={settings}
        reserves={reserves}
      />
    </div>
  );
}
