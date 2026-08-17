import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { useData } from '../contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '../components/CurrencyInput';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  PiggyBank, 
  Wrench, 
  ShieldAlert, 
  Car, 
  Coins, 
  Sparkles, 
  Heart, 
  TrendingUp, 
  Trash2, 
  Edit3, 
  HelpCircle, 
  Plus, 
  X, 
  Check, 
  Settings2, 
  Briefcase,
  History as HistIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  AlertCircle,
  Shield,
  ShieldCheck,
  Gauge,
  Fuel,
  ShoppingBag,
  Gift,
  Plane,
  Coffee,
  GraduationCap,
  Laptop,
  Stethoscope,
  Hammer,
  Home,
  Award,
  ChevronDown,
  ChevronUp,
  Archive,
  CheckCircle2,
  RefreshCw,
  Search,
  Sliders,
  Filter,
  Clock,
  ArrowUpDown,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  isWithinInterval, 
  parseISO,
  startOfYear,
  endOfYear,
  subYears,
  format,
  subDays
} from 'date-fns';
import { Reserve, ReserveTransaction } from '../types';

// Dynamic icon directory
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
  ShoppingBag,
  Gift,
  Plane,
  Coffee,
  GraduationCap,
  Laptop,
  Stethoscope,
  Hammer,
  Home,
  Award,
};

// Colors map
const colorPresets = [
  { name: 'Vermelho', hex: '#ef4444' },
  { name: 'Laranja', hex: '#f97316' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Amarelo', hex: '#eab308' },
  { name: 'Lima', hex: '#84cc16' },
  { name: 'Verde', hex: '#22c55e' },
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Ciano', hex: '#0891b2' },
  { name: 'Céu', hex: '#0284c7' },
  { name: 'Azul', hex: '#3b82f6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Violeta', hex: '#7c3aed' },
  { name: 'Roxo', hex: '#a855f7' },
  { name: 'Fúcsia', hex: '#d946ef' },
  { name: 'Rosa', hex: '#ec4899' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Grafite', hex: '#475569' },
  { name: 'Cinza', hex: '#6b7280' },
];

const ruleOptions = [
  {
    id: null,
    title: 'Aporte Manual',
    description: 'Sem aplicação automática de regras. Você define quando e quanto colocar na reserva.',
    icon: Coins,
  },
  {
    id: 'km',
    title: 'Por Km Rodado',
    description: 'Sugere depósito com base em quanto rodou (ideal para Manutenção, Combustível, Pneus).',
    icon: Car,
  },
  {
    id: 'bruto',
    title: 'Percentual do Bruto',
    description: 'Calcula um percentual sobre todos os ganhos das categorias selecionadas.',
    icon: TrendingUp,
  },
  {
    id: 'liquido',
    title: 'Percentual do Líquido',
    description: 'Calcula um percentual sobre o seu lucro líquido do período (excluindo resgates/gastos de reserva).',
    icon: Briefcase,
  },
  {
    id: 'fixo',
    title: 'Fixo por Dia Ativo',
    description: 'Adiciona um valor fixo por dia em que houver corrida/ganho registrado.',
    icon: Calendar,
  },
];

function ReserveIcon({ name, className }: { name: string; className?: string }) {
  const Icon = iconOptions[name as keyof typeof iconOptions] || PiggyBank;
  return <Icon className={className} />;
}

export function Reserves() {
  const navigate = useNavigate();
  const { 
    reserves, 
    reserveTransactions, 
    transactions, 
    settings, 
    addReserve, 
    updateReserve, 
    deleteReserve,
    deleteReserveTransaction,
    updateReserveTransaction,
    addReserveTransaction,
    globalPeriod,
    setGlobalPeriod,
    customDateRange,
    setCustomDateRange,
    hideValues
  } = useData();

  // Period management
  const period = globalPeriod as any;
  const setPeriod = setGlobalPeriod as any;
  
  // UI Panels state
  const [activeTab, setActiveTab] = useState<'cards' | 'history'>('cards');
  const [showConfigModal, setShowConfigModal] = useState<Reserve | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalTab, setModalTab] = useState<'general' | 'automation'>('general');
  const [showUpdateBalanceModal, setShowUpdateBalanceModal] = useState<Reserve | null>(null);
  const [updateBalanceAmount, setUpdateBalanceAmount] = useState('');
  const [updateBalanceDesc, setUpdateBalanceDesc] = useState('Rendimento');

  // Suggestion Batch Aporte State
  const [selectedReservesForBatch, setSelectedReservesForBatch] = useState<Record<string, boolean>>({});
  const [batchAmounts, setBatchAmounts] = useState<Record<string, string>>({});
  const [batchDate, setBatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [batchDesc, setBatchDesc] = useState<string>('Aporte Consolidado de Reservas');
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [isAssistantExpanded, setIsAssistantExpanded] = useState(true);

  // Auditing details state
  const [auditedReserveId, setAuditedReserveId] = useState<string | null>(null);

  // Expanded cards state
  const [expandedReserves, setExpandedReserves] = useState<Record<string, boolean>>({});

  const toggleReserveExpanded = (id: string) => {
    setExpandedReserves(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Update batch default amounts when reserves or suggestion changes
  useEffect(() => {
    const defaultSecs: Record<string, boolean> = {};
    const defaultAmts: Record<string, string> = {};
    
    reserves.forEach(r => {
      if (r.regra_ativa && r.regra_tipo) {
        const suggested = Number(calculateSuggestion(r).toFixed(2));
        const lastWDate = getLatestWithdrawalDate(r);
        const activePeriodAportes = Number(
          reserveTransactions
            .filter(rt => {
              const basicMatches = rt.reserve_id === r.id && 
                                   rt.type === 'aporte' && 
                                   isTxInLast30Days(rt.date) && 
                                   rt.category !== 'Aporte Extra' && 
                                   rt.category !== 'Rendimento';
              if (!basicMatches) return false;
              if (lastWDate && rt.date <= lastWDate) return false;
              return true;
            })
            .reduce((sum, rt) => sum + Number(rt.amount), 0)
            .toFixed(2)
        );
        const pending = Math.max(0, suggested - activePeriodAportes);
        
        if (pending > 0) {
          defaultSecs[r.id] = true; // Auto select if there is pending value
          defaultAmts[r.id] = pending.toFixed(2);
        } else {
          defaultAmts[r.id] = '0.00';
        }
      } else {
        defaultAmts[r.id] = '';
      }
    });

    setSelectedReservesForBatch(defaultSecs);
    setBatchAmounts(defaultAmts);
  }, [reserves, reserveTransactions, globalPeriod, customDateRange]);



  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);

  const handleUpdateBalance = async () => {
    if (!showUpdateBalanceModal || isUpdatingBalance) return;
    
    let type: 'rendimento' | 'utilizacao';
    let amount: number;
    let category: string;
    let description: string;
    let isYield = true;

    if (updateBalanceDesc === 'Rendimento') {
      const newBalance = Number(updateBalanceAmount);
      if (isNaN(newBalance) || newBalance < 0) {
        toast.error('Informe um valor de saldo válido e positivo.');
        return;
      }

      const currentBalance = showUpdateBalanceModal.saldo_atual || 0;
      const diff = newBalance - currentBalance;

      if (diff === 0) {
         toast.error('O saldo informado é igual ao saldo atual da reserva.');
         return;
      }

      isYield = diff > 0;
      type = isYield ? 'rendimento' : 'utilizacao';
      amount = Math.abs(diff);
      category = 'Rendimento';
      description = isYield ? 'Rendimento de Aplicação' : 'Ajuste Manual (Negativo)';
    } else {
      // VendaAtivo
      const sellAmount = Number(updateBalanceAmount);
      if (isNaN(sellAmount) || sellAmount <= 0) {
        toast.error('Informe um valor de venda de ativos válido e positivo.');
        return;
      }
      isYield = true;
      type = 'rendimento';
      amount = sellAmount;
      category = 'Venda de Ativos';
      description = 'Venda de Ativo';
    }

    setIsUpdatingBalance(true);
    try {
      await addReserveTransaction({
        reserve_id: showUpdateBalanceModal.id,
        type,
        amount,
        date: new Date().toISOString().split('T')[0],
        category,
        description
      });
      
      const successMsg = updateBalanceDesc === 'Rendimento'
        ? `Saldo atualizado com sucesso! (Diferença: ${isYield ? '+' : '-'}${formatCurrency(amount)})`
        : `Saldo da reserva atualizado! (+${formatCurrency(amount)} adicionado referente à Venda de Ativo)`;
      
      toast.success(successMsg);
      setShowUpdateBalanceModal(null);
      setUpdateBalanceAmount('');
    } catch (error) {
      toast.error('Erro ao atualizar saldo da reserva.');
    } finally {
      setIsUpdatingBalance(false);
    }
  };

  const handleBatchAporte = async () => {
    if (isBatchSubmitting) return;
    const selectedIds = Object.keys(selectedReservesForBatch).filter(id => selectedReservesForBatch[id]);
    
    if (selectedIds.length === 0) {
      toast.error('Selecione ao menos um aporte na lista para processar.');
      return;
    }

    const validAportes: { reserve_id: string; amount: number; name: string }[] = [];
    for (const rid of selectedIds) {
      const resObj = reserves.find(r => r.id === rid);
      const amtStr = batchAmounts[rid];
      const amtNum = Number(amtStr) || 0;
      if (amtNum <= 0) {
        toast.error(`O valor digitado para "${resObj?.name || 'excluída'}" de R$ ${amtStr} é inválido.`);
        return;
      }
      validAportes.push({
        reserve_id: rid,
        amount: amtNum,
        name: resObj?.name || 'Reserva'
      });
    }

    setIsBatchSubmitting(true);
    let successCount = 0;

    try {
      for (const aporte of validAportes) {
        await addReserveTransaction({
          reserve_id: aporte.reserve_id,
          type: 'aporte',
          amount: aporte.amount,
          date: batchDate,
          description: `${batchDesc} (${aporte.name})`,
        });
        successCount++;
      }

      toast.success(`${successCount} aportes efetuados e salvos com êxito!`);
      
      setSelectedReservesForBatch({});
      const clearedAmounts: Record<string, string> = {};
      reserves.forEach(r => clearedAmounts[r.id] = '0.00');
      setBatchAmounts(clearedAmounts);
      setBatchDesc('Aporte Consolidado de Reservas');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro de envio ao tentar salvar aportes em lote.');
    } finally {
      setIsBatchSubmitting(false);
    }
  };

  const toggleRuleActive = async (res: Reserve) => {
    const isNowPaused = !res.is_paused;
    const nowISO = new Date().toISOString();
    let newRuleHistory = [...(res.rule_history || [])];
    
    newRuleHistory.push({
      start_date: res.regra_inicio_validade || res.created_at || nowISO,
      end_date: nowISO,
      regra_tipo: res.regra_tipo,
      regra_valor: res.regra_valor,
      regra_categorias: res.regra_categorias || [],
      regra_ativa: res.regra_ativa && res.status !== 'inactive' && !res.is_paused,
    });

    try {
      await updateReserve(res.id, {
        is_paused: isNowPaused,
        regra_ativa: !isNowPaused,
        rule_history: newRuleHistory,
        regra_inicio_validade: nowISO,
      });
      toast.success(isNowPaused ? `Aporte automático de "${res.name}" foi pausado.` : `Cálculo automático de "${res.name}" foi retomado!`);
    } catch (err) {
      console.error(err);
      toast.error('Falha ao tentar alternar estado do cálculo da regra.');
    }
  };

  // Creation and Editing Forms states
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState('#f59e0b');
  const [formIcon, setFormIcon] = useState('PiggyBank');
  const [formSaldoInicial, setFormSaldoInicial] = useState('0');
  const [formMetaObjetivo, setFormMetaObjetivo] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  
  // Rules fields
  const [formRegraAtiva, setFormRegraAtiva] = useState(true);
  const [formRegraTipo, setFormRegraTipo] = useState<'km' | 'bruto' | 'liquido' | 'fixo' | 'personalizado' | null>(null);
  const [formRegraValor, setFormRegraValor] = useState('0');
  const [formRegraCats, setFormRegraCats] = useState<string[]>([]);
  const [formRequireCategoryOnUse, setFormRequireCategoryOnUse] = useState<boolean>(true);
  const [formDefaultUseCategory, setFormDefaultUseCategory] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Editing state for reserve transaction
  const [editingRt, setEditingRt] = useState<ReserveTransaction | null>(null);
  const [editRtAmount, setEditRtAmount] = useState('');
  const [editRtDate, setEditRtDate] = useState('');
  const [editRtDescription, setEditRtDescription] = useState('');
  const [editRtCategory, setEditRtCategory] = useState('');
  const [editRtReserveId, setEditRtReserveId] = useState('');
  const [editRtType, setEditRtType] = useState<'aporte' | 'utilizacao' | 'rendimento'>('aporte');

  // Reserve Cards Status Sub-filter & Rule Modal States
  const [reserveCardFilter, setReserveCardFilter] = useState<'active' | 'finalized' | 'all'>('active');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyReserveFilter, setHistoryReserveFilter] = useState('all');
  const [showFinalizeConfirmModal, setShowFinalizeConfirmModal] = useState<Reserve | null>(null);
  const [showRuleHistoryModal, setShowRuleHistoryModal] = useState<Reserve | null>(null);

  // Rule history extrato states
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'transactions' | 'aporte' | 'utilizacao' | 'rendimento' | 'rules'>('all');

  // Finalize and Reactivate reserve handlers
  const handleFinalizeReserve = async (res: Reserve) => {
    try {
      await updateReserve(res.id, {
        status: 'inactive',
        is_paused: true,
        regra_ativa: false,
      });
      toast.success(`Reserva "${res.name}" finalizada com sucesso! Saldo e histórico foram preservados.`);
    } catch (err) {
      toast.error('Erro ao finalizar reserva.');
    }
  };

  const handleReactivateReserve = async (res: Reserve) => {
    try {
      await updateReserve(res.id, {
        status: 'active',
        is_paused: false,
        regra_ativa: true,
      });
      toast.success(`Reserva "${res.name}" reativada com sucesso!`);
    } catch (err) {
      toast.error('Erro ao reativar reserva.');
    }
  };
  const [editingRuleHist, setEditingRuleHist] = useState<{
    reserveId: string;
    historyIndex: number; // -1 for current rule, >=0 for rule_history indices
    regra_tipo: 'km' | 'bruto' | 'liquido' | 'fixo' | null;
    regra_valor: string;
    regra_categorias: string[];
    regra_ativa: boolean;
    start_date: string;
    end_date?: string;
  } | null>(null);

  const [rtToDeleteConfirm, setRtToDeleteConfirm] = useState<any | null>(null);
  const [ruleHistToDeleteConfirm, setRuleHistToDeleteConfirm] = useState<{
    reserveId: string;
    historyIndex: number;
    reserveName: string;
    ruleType: string;
    amount: number;
  } | null>(null);

  const expenseCategories = settings?.expense_categories || ['Combustível', 'Manutenção', 'Alimentação', 'Plano de Internet', 'Equipamento', 'Outras Despesas', 'Outros'];
  const incomeCategories = settings?.income_categories || ['iFood', 'Uber', '99Moto', 'Particular', 'Gorjeta', 'Frete do Dia', 'Pizzaria', 'Outros'];

  // Currency utility helper
  const formatCurrency = (val: number) => {
    if (hideValues) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Utility to format rule value without aggressive rounding (e.g. 0.085 as 0,085)
  const formatRuleValue = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '0,00';
    return val.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  };

  // Compute stats helper
  const getPeriodInterval = () => {
    const now = new Date();
    let start = new Date(0);
    let end = new Date();
    
    if (period === 'today') {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (period === 'yesterday') {
      start = startOfDay(subDays(now, 1));
      end = endOfDay(subDays(now, 1));
    } else if (period === 'last7Days') {
      start = startOfDay(subDays(now, 6));
      end = endOfDay(now);
    } else if (period === 'last30Days') {
      start = startOfDay(subDays(now, 29));
      end = endOfDay(now);
    } else if (period === 'last90Days') {
      start = startOfDay(subDays(now, 89));
      end = endOfDay(now);
    } else if (period === 'week') {
      start = startOfWeek(now, { weekStartsOn: 0 });
      end = endOfWeek(now, { weekStartsOn: 0 });
    } else if (period === 'month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (period === 'lastMonth') {
      const lastM = subMonths(now, 1);
      start = startOfMonth(lastM);
      end = endOfMonth(lastM);
    } else if (period === 'last3Months') {
      start = startOfDay(subMonths(now, 3));
      end = endOfDay(now);
    } else if (period === 'thisYear') {
      start = startOfYear(now);
      end = endOfDay(now);
    } else if (period === 'lastYear') {
      const lastY = subYears(now, 1);
      start = startOfYear(lastY);
      end = endOfYear(lastY);
    } else if (period === 'custom' && customDateRange && customDateRange.start && customDateRange.end) {
      try {
        const parsedStart = parseISO(customDateRange.start);
        const parsedEnd = parseISO(customDateRange.end);
        if (!isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime())) {
          start = startOfDay(parsedStart);
          end = endOfDay(parsedEnd);
        }
      } catch {
        // Fallback already prefilled
      }
    }
    return { start, end };
  };

  const periodInterval = getPeriodInterval();

  const isTxInPeriod = (dateStr: string) => {
    if (period === 'all') return true;
    try {
      const d = parseISO(dateStr);
      return isWithinInterval(d, periodInterval);
    } catch {
      return false;
    }
  };

  const isTxInLast30Days = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      const now = new Date();
      const start = startOfDay(subDays(now, 29));
      const end = endOfDay(now);
      return isWithinInterval(d, { start, end });
    } catch {
      return false;
    }
  };

  // Helper to get the latest withdrawal date for a reserve
  const getLatestWithdrawalDate = (res: Reserve): string | null => {
    const utilizacoes = (reserveTransactions || []).filter(
      rt => rt.reserve_id === res.id && rt.type === 'utilizacao'
    );
    if (utilizacoes.length === 0) return null;
    const sorted = [...utilizacoes].sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0].date;
  };

  // ----------------------------------------------------
  // CALCULATE AUTOMATIC SUGGESTION ENGINE
  // ----------------------------------------------------
  const calculateSuggestion = (res: Reserve): number => {
    const isGoalReached = Boolean(res.meta_objetivo && res.meta_objetivo > 0 && res.saldo_atual !== undefined && res.saldo_atual >= res.meta_objetivo);
    const isPaused = res.status === 'inactive' || res.is_paused;

    if (isPaused || isGoalReached) {
      return 0;
    }

    const lastWDate = getLatestWithdrawalDate(res);
    // Filter standard general transactions inside this period and after reserve creation day (ignoring for default reserves)
    const periodTxs = transactions.filter(t => {
      const inPeriod = isTxInLast30Days(t.date);
      if (!inPeriod) return false;
      const isDefaultRes = res.name === 'Reserva de Manutenção' || res.name === 'Reserva de Emergência';
      if (res.created_at && !isDefaultRes) {
        const creationDay = res.created_at.split('T')[0];
        if (t.date < creationDay) return false;
      }
      if (lastWDate && t.date <= lastWDate) return false;
      return true;
    });
    
    let totalSuggestion = 0;

    const historyRules = res.rule_history || [];
    
    // Bucket transactions into the matching rule
    const buckets = periodTxs.reduce((acc, t) => {
      const tTime = new Date(`${t.date}T12:00:00.000Z`).getTime();
      let matchedRuleObj: any = null;
      let matchedIdx = -1;

      // Find the first rule in history where transaction time is BEFORE the rule end_date
      for (let i = 0; i < historyRules.length; i++) {
        const histEndDate = new Date(historyRules[i].end_date);
        if (tTime < histEndDate.getTime()) {
          matchedRuleObj = historyRules[i];
          matchedIdx = i;
          break;
        }
      }

      const ruleKey = matchedIdx !== -1 ? `hist_${matchedIdx}` : 'current';
      const activeRule = matchedRuleObj || {
        regra_ativa: res.regra_ativa && !isPaused && !isGoalReached,
        regra_tipo: res.regra_tipo,
        regra_valor: res.regra_valor,
        regra_categorias: res.regra_categorias,
      };

      if (!acc[ruleKey]) {
        acc[ruleKey] = { rule: activeRule, txs: [] };
      }
      acc[ruleKey].txs.push(t);
      return acc;
    }, {} as Record<string, { rule: any, txs: typeof periodTxs }>);

    // Calculate suggestion grouped by rule bucket
    Object.values(buckets).forEach((bucket: any) => {
      const { rule, txs } = bucket;
      if (!rule.regra_ativa || !rule.regra_tipo) return;

      const ruleValue = Number(rule.regra_valor) || 0;
      const ruleCats = rule.regra_categorias || [];
      
      if (rule.regra_tipo === 'km') {
        const eligible = txs.filter(t => t.type === 'income' && ruleCats.includes(t.category) && t.start_km !== null && t.end_km !== null);
        eligible.forEach(t => {
          const distance = (Number(t.end_km) || 0) - (Number(t.start_km) || 0);
          if (distance > 0) {
            totalSuggestion += distance * ruleValue;
          }
        });
      } else if (rule.regra_tipo === 'bruto') {
        const eligible = txs.filter(t => t.type === 'income' && ruleCats.includes(t.category));
        const grossSum = eligible.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        totalSuggestion += grossSum * (ruleValue / 100);
      } else if (rule.regra_tipo === 'liquido') {
        const totalIncome = txs
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const totalExpense = txs
          .filter(t => t.type === 'expense')
          .filter(t => {
            const isReserveUse = t.is_reserve_use || 
                                 t.description?.includes('[Reserva]') || 
                                 (t as any).isReserveTx === true ||
                                 t.category === 'Aporte Reserva';
            return !isReserveUse;
          })
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const netProfit = totalIncome - totalExpense;
        totalSuggestion += Math.max(0, netProfit) * (ruleValue / 100);
      } else if (rule.regra_tipo === 'fixo') {
        const eligible = txs.filter(t => t.type === 'income' && ruleCats.includes(t.category));
        const uniqueDays = new Set(eligible.map(t => t.date));
        totalSuggestion += uniqueDays.size * ruleValue;
      }
    });

    // Cap suggestion to goal itself if suggestion exceeds goal
    if (res.meta_objetivo && res.meta_objetivo > 0) {
      if (totalSuggestion > res.meta_objetivo) {
        totalSuggestion = res.meta_objetivo;
      }
    }

    return Number(totalSuggestion.toFixed(2));
  };

  // Robust detailed step-by-step breakdown helper for driver auditing
  const getSuggestionAudit = (res: Reserve) => {
    const lastWDate = getLatestWithdrawalDate(res);
    const periodTxs = transactions.filter(t => {
      const inPeriod = isTxInLast30Days(t.date);
      if (!inPeriod) return false;
      const isDefaultRes = res.name === 'Reserva de Manutenção' || res.name === 'Reserva de Emergência';
      if (res.created_at && !isDefaultRes) {
        const creationDay = res.created_at.split('T')[0];
        if (t.date < creationDay) return false;
      }
      if (lastWDate && t.date <= lastWDate) return false;
      return true;
    });
    const historyRules = res.rule_history || [];
    const isGoalReached = res.meta_objetivo && res.saldo_atual !== undefined && res.saldo_atual >= res.meta_objetivo;
    const isPaused = res.status === 'inactive' || res.is_paused;

    let auditDetails: {
      ruleType: string;
      ruleValue: number;
      categories: string[];
      details: string[];
      totalSuggested: number;
      txCount: number;
    } = {
      ruleType: res.regra_tipo || '',
      ruleValue: Number(res.regra_valor) || 0,
      categories: res.regra_categorias || [],
      details: [],
      totalSuggested: 0,
      txCount: 0,
    };

    if (lastWDate) {
      auditDetails.details.push(`Nota: Lançamentos até ${lastWDate.split('-').reverse().join('/')} desconsiderados devido ao resgate mais recente desta reserva.`);
    }

    if (isPaused) {
      auditDetails.details.push('Cálculo desativado (Reserva ou regra está pausada pelo painel).');
      return auditDetails;
    }
    if (isGoalReached) {
      auditDetails.details.push('Meta global desta reserva alcançada! O cálculo foi suspenso automaticamente.');
      return auditDetails;
    }
    if (!res.regra_ativa || !res.regra_tipo) {
      auditDetails.details.push('Esta reserva requer aportes exclusivamente manuais (Sem regra automática ativa).');
      return auditDetails;
    }

    const buckets = periodTxs.reduce((acc, t) => {
      const tTime = new Date(`${t.date}T12:00:00.000Z`).getTime();
      let matchedRuleObj: any = null;
      let matchedIdx = -1;

      for (let i = 0; i < historyRules.length; i++) {
        const histEndDate = new Date(historyRules[i].end_date);
        if (tTime < histEndDate.getTime()) {
          matchedRuleObj = historyRules[i];
          matchedIdx = i;
          break;
        }
      }

      const ruleKey = matchedIdx !== -1 ? `hist_${matchedIdx}` : 'current';
      const activeRule = matchedRuleObj || {
        regra_ativa: res.regra_ativa && !isPaused && !isGoalReached,
        regra_tipo: res.regra_tipo,
        regra_valor: res.regra_valor,
        regra_categorias: res.regra_categorias,
      };

      if (!acc[ruleKey]) {
        acc[ruleKey] = { rule: activeRule, txs: [] };
      }
      acc[ruleKey].txs.push(t);
      return acc;
    }, {} as Record<string, { rule: any, txs: typeof periodTxs }>);

    let totalSuggestion = 0;

    Object.entries(buckets).forEach(([key, bucket]: any) => {
      const { rule, txs } = bucket;
      if (!rule.regra_ativa || !rule.regra_tipo) return;

      const ruleValue = Number(rule.regra_valor) || 0;
      const ruleCats = rule.regra_categorias || [];

      if (rule.regra_tipo === 'km') {
        const eligible = txs.filter((t: any) => t.type === 'income' && ruleCats.includes(t.category) && t.start_km !== null && t.end_km !== null);
        let totalKm = 0;
        eligible.forEach((t: any) => {
          const distance = (Number(t.end_km) || 0) - (Number(t.start_km) || 0);
          if (distance > 0) {
            totalKm += distance;
          }
        });
        const sugg = totalKm * ruleValue;
        totalSuggestion += sugg;
        auditDetails.txCount += eligible.length;
        if (eligible.length > 0) {
          auditDetails.details.push(
            `Fórmula KM (${key === 'current' ? 'Atual' : 'Histórica'}): ${totalKm} km rodados em ${eligible.length} corridas elegíveis nas categorias [${ruleCats.join(', ')}] × valor de R$ ${formatRuleValue(ruleValue)}/km = ${formatCurrency(sugg)}`
          );
        }
      } else if (rule.regra_tipo === 'bruto') {
        const eligible = txs.filter((t: any) => t.type === 'income' && ruleCats.includes(t.category));
        const grossSum = eligible.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
        const sugg = grossSum * (ruleValue / 100);
        totalSuggestion += sugg;
        auditDetails.txCount += eligible.length;
        if (eligible.length > 0) {
          auditDetails.details.push(
            `Fórmula Bruto (${key === 'current' ? 'Atual' : 'Histórica'}): Faturamento total de ${formatCurrency(grossSum)} em ${eligible.length} lançamentos nas categorias [${ruleCats.join(', ')}] × taxa de ${formatRuleValue(ruleValue)}% = ${formatCurrency(sugg)}`
          );
        }
      } else if (rule.regra_tipo === 'liquido') {
        const totalIncome = txs
          .filter((t: any) => t.type === 'income')
          .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
        const totalExpense = txs
          .filter((t: any) => t.type === 'expense')
          .filter((t: any) => {
            const isReserveUse = t.is_reserve_use || 
                                 t.description?.includes('[Reserva]') || 
                                 (t as any).isReserveTx === true ||
                                 t.category === 'Aporte Reserva';
            return !isReserveUse;
          })
          .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
        const netProfit = totalIncome - totalExpense;
        const sugg = Math.max(0, netProfit) * (ruleValue / 100);
        totalSuggestion += sugg;
        
        auditDetails.details.push(
          `Fórmula Líquido (${key === 'current' ? 'Atual' : 'Histórica'}): Receita Bruta (${formatCurrency(totalIncome)}) - Despesas Gerais (${formatCurrency(totalExpense)}) = Saldo Líquido de ${formatCurrency(netProfit)} × alíquota de ${formatRuleValue(ruleValue)}% = ${formatCurrency(sugg)}`
        );
      } else if (rule.regra_tipo === 'fixo') {
        const eligible = txs.filter((t: any) => t.type === 'income' && ruleCats.includes(t.category));
        const uniqueDays = new Set(eligible.map((t: any) => t.date));
        const sugg = uniqueDays.size * ruleValue;
        totalSuggestion += sugg;
        
        if (uniqueDays.size > 0) {
          auditDetails.details.push(
            `Fórmula Fixa diária (${key === 'current' ? 'Atual' : 'Histórica'}): ${uniqueDays.size} dias únicos com lançamento ativo [${ruleCats.join(', ')}] × valor fixo de R$ ${formatRuleValue(ruleValue)} por dia = ${formatCurrency(sugg)}`
          );
        }
      }
    });

    auditDetails.totalSuggested = Number(totalSuggestion.toFixed(2));

    if (res.meta_objetivo && res.meta_objetivo > 0 && auditDetails.totalSuggested > res.meta_objetivo) {
      const formulaVal = auditDetails.totalSuggested;
      auditDetails.totalSuggested = res.meta_objetivo;
      auditDetails.details.push(
        `Nota: O aporte sugerido pela fórmula (${formatCurrency(formulaVal)}) superou a meta global definida para a reserva (${formatCurrency(res.meta_objetivo)}). Por regra de negócio, o valor sugerido foi limitado ao valor da meta.`
      );
    }
    
    if (auditDetails.details.length === 0) {
      auditDetails.details.push('Nenhum evento financeiro ativo elegível para faturamento ou regras neste período.');
    }
    
    return auditDetails;
  };

  // Compute overall reserve stats
  const totalInReserves = Number(reserves.reduce((sum, r) => sum + (r.saldo_atual || 0), 0).toFixed(2));

  const totalAportesPeriodo = Number(
    reserveTransactions
      .filter(rt => rt.type === 'aporte' && isTxInPeriod(rt.date))
      .reduce((sum, rt) => sum + Number(rt.amount), 0)
      .toFixed(2)
  );

  const totalUtilizadoPeriodo = Number(
    reserveTransactions
      .filter(rt => rt.type === 'utilizacao' && isTxInPeriod(rt.date))
      .reduce((sum, rt) => sum + Number(rt.amount), 0)
      .toFixed(2)
  );

  const filteredReserveTransactions = reserveTransactions.filter(rt => isTxInPeriod(rt.date));

  const combinedHistoryItems = useMemo(() => {
    const list: any[] = [];

    // 1. Add reserve transactions
    reserveTransactions.forEach(rt => {
      if (isTxInPeriod(rt.date)) {
        list.push({
          id: rt.id,
          reserve_id: rt.reserve_id,
          type: 'transaction',
          actionType: rt.type, // 'aporte' | 'utilizacao'
          amount: Number(rt.amount),
          description: rt.description,
          category: rt.category,
          date: rt.date,
          timestamp: new Date(rt.date + 'T12:00:00').getTime(),
          raw: rt,
        });
      }
    });

    // 2. Add rule history changes and active rules
    reserves.forEach(r => {
      // Past rule versions
      if (r.rule_history && Array.isArray(r.rule_history)) {
        r.rule_history.forEach((hist, idx) => {
          const changeDate = hist.end_date ? hist.end_date.split('T')[0] : (r.created_at || '').split('T')[0];
          if (changeDate && isTxInPeriod(changeDate)) {
            list.push({
              id: `${r.id}_rule_${idx}`,
              reserve_id: r.id,
              type: 'rule_change',
              actionType: 'rule_history_change',
              amount: hist.regra_valor || 0,
              description: hist.regra_tipo,
              category: hist.regra_categorias ? (Array.isArray(hist.regra_categorias) ? hist.regra_categorias.join(', ') : String(hist.regra_categorias)) : '',
              date: changeDate,
              timestamp: hist.end_date ? new Date(hist.end_date).getTime() : new Date(r.created_at || '').getTime(),
              raw: hist,
              reserve_name: r.name,
              reserve_color: r.color,
              reserve_icon: r.icon,
              historyIndex: idx,
              start_date: hist.start_date,
              end_date: hist.end_date,
              regra_tipo: hist.regra_tipo,
              regra_valor: hist.regra_valor,
              regra_categorias: hist.regra_categorias || [],
              regra_ativa: hist.regra_ativa !== false,
            });
          }
        });
      }

      // Current rule's initiation
      const activeDate = r.regra_inicio_validade ? r.regra_inicio_validade.split('T')[0] : (r.created_at || '').split('T')[0];
      if (activeDate && isTxInPeriod(activeDate)) {
        list.push({
          id: `${r.id}_rule_current`,
          reserve_id: r.id,
          type: 'rule_change',
          actionType: 'rule_current_activation',
          amount: r.regra_valor || 0,
          description: r.regra_tipo,
          category: r.regra_categorias ? (Array.isArray(r.regra_categorias) ? r.regra_categorias.join(', ') : String(r.regra_categorias)) : '',
          date: activeDate,
          timestamp: r.regra_inicio_validade ? new Date(r.regra_inicio_validade).getTime() : new Date(r.created_at || '').getTime(),
          raw: r,
          reserve_name: r.name,
          reserve_color: r.color,
          reserve_icon: r.icon,
          historyIndex: -1, // current rule
          start_date: r.regra_inicio_validade || r.created_at,
          end_date: undefined,
          regra_tipo: r.regra_tipo,
          regra_valor: r.regra_valor,
          regra_categorias: r.regra_categorias || [],
          regra_ativa: r.regra_ativa !== false,
        });
      }
    });

    // Sort by timestamp descending
    return list.sort((a, b) => {
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp;
      }
      
      // Se tiverem o mesmo timestamp exato de alteração de regra,
      // desempatamos colocando a regra vigente (historyIndex === -1) acima da histórica (historyIndex >= 0)
      const bIsCurrent = b.type === 'rule_change' && b.historyIndex === -1;
      const aIsCurrent = a.type === 'rule_change' && a.historyIndex === -1;

      if (bIsCurrent && !aIsCurrent) return 1;
      if (!bIsCurrent && aIsCurrent) return -1;

      // Se ambos são históricos, o de maior índice (histórica mais recente) vem primeiro
      if (b.type === 'rule_change' && a.type === 'rule_change') {
        return b.historyIndex - a.historyIndex;
      }

      return 0;
    });
  }, [reserveTransactions, reserves, period, customDateRange]);

  // Active vs Finalized reserves filtering
  const activeReserves = useMemo(() => reserves.filter(r => r.status !== 'inactive'), [reserves]);
  const finalizedReserves = useMemo(() => reserves.filter(r => r.status === 'inactive'), [reserves]);

  const displayedReserves = useMemo(() => {
    if (reserveCardFilter === 'active') return activeReserves;
    if (reserveCardFilter === 'finalized') return finalizedReserves;
    return reserves;
  }, [reserveCardFilter, activeReserves, finalizedReserves, reserves]);

  const sortedReservesByBalance = useMemo(() => {
    return [...displayedReserves].sort((a, b) => {
      const balA = a.saldo_atual || 0;
      const balB = b.saldo_atual || 0;
      return balB - balA;
    });
  }, [displayedReserves]);

  const filteredCombinedItems = useMemo(() => {
    let list = combinedHistoryItems;

    // Search term filter
    if (historySearchTerm.trim()) {
      const term = historySearchTerm.toLowerCase();
      list = list.filter(item => {
        const resName = (item.reserve_name || reserves.find(r => r.id === item.reserve_id)?.name || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        return resName.includes(term) || desc.includes(term) || cat.includes(term);
      });
    }

    // Reserve filter
    if (historyReserveFilter !== 'all') {
      list = list.filter(item => item.reserve_id === historyReserveFilter);
    }

    // Type filter
    if (historyTypeFilter === 'transactions') {
      list = list.filter(item => item.type === 'transaction');
    } else if (historyTypeFilter === 'rules') {
      list = list.filter(item => item.type === 'rule_change');
    } else if (historyTypeFilter === 'aporte') {
      list = list.filter(item => item.type === 'transaction' && item.actionType === 'aporte');
    } else if (historyTypeFilter === 'utilizacao') {
      list = list.filter(item => item.type === 'transaction' && item.actionType === 'utilizacao');
    } else if (historyTypeFilter === 'rendimento') {
      list = list.filter(item => item.type === 'transaction' && item.actionType === 'rendimento');
    }

    return list;
  }, [combinedHistoryItems, historySearchTerm, historyReserveFilter, historyTypeFilter, reserves]);

  // History stats computation for summary cards
  const historyStats = useMemo(() => {
    let totalAportes = 0;
    let totalResgates = 0;
    let totalRendimentos = 0;
    let ruleChangesCount = 0;

    combinedHistoryItems.forEach(item => {
      if (historyReserveFilter !== 'all' && item.reserve_id !== historyReserveFilter) return;
      
      if (item.type === 'transaction') {
        if (item.actionType === 'aporte') totalAportes += item.amount;
        else if (item.actionType === 'utilizacao') totalResgates += item.amount;
        else if (item.actionType === 'rendimento') totalRendimentos += item.amount;
      } else if (item.type === 'rule_change') {
        ruleChangesCount++;
      }
    });

    return { totalAportes, totalResgates, totalRendimentos, ruleChangesCount };
  }, [combinedHistoryItems, historyReserveFilter]);

  // Sum up all pendings
  const totalPendente = Number(reserves.reduce((sum, r) => {
    const sugg = calculateSuggestion(r);
    const lastWDate = getLatestWithdrawalDate(r);
    const made = reserveTransactions
      .filter(rt => {
        const basicMatches = rt.reserve_id === r.id && 
                             rt.type === 'aporte' && 
                             isTxInLast30Days(rt.date) && 
                             rt.category !== 'Aporte Extra' && 
                             rt.category !== 'Rendimento';
        if (!basicMatches) return false;
        if (lastWDate && rt.date <= lastWDate) return false;
        return true;
      })
      .reduce((s, rt) => s + Number(rt.amount), 0);
    return sum + Math.max(0, sugg - made);
  }, 0).toFixed(2));

  const [isCreating, setIsCreating] = useState(false);

  // Handler for creating a new reserve
  const handleCreate = async () => {
    if (isCreating) return;
    if (!formName.trim()) {
      toast.error('Informe o nome da reserva.');
      return;
    }

    setIsCreating(true);
    try {
      await addReserve({
        name: formName,
        description: formDesc || undefined,
        color: formColor,
        icon: formIcon,
        saldo_inicial: Number(formSaldoInicial) || 0,
        meta_objetivo: formMetaObjetivo ? Number(formMetaObjetivo) : null,
        status: formStatus,
        regra_tipo: formRegraTipo,
        regra_valor: formRegraTipo ? Number(formRegraValor) : undefined,
        regra_categorias: formRegraTipo && formRegraTipo !== 'liquido' ? formRegraCats : undefined,
        regra_ativa: formRegraAtiva,
        require_category_on_use: formRequireCategoryOnUse,
        default_use_category: formRequireCategoryOnUse ? undefined : formDefaultUseCategory,
        regra_inicio_validade: new Date().toISOString(),
      });

      setShowCreateModal(false);
      clearForm();
    } finally {
      setIsCreating(false);
    }
  };

  const [isEditing, setIsEditing] = useState(false);

  // Handler for editing an existing reserve
  const handleEdit = async () => {
    if (!showConfigModal || isEditing) return;
    if (!formName.trim()) {
      toast.error('Informe o nome da reserva.');
      return;
    }

    setIsEditing(true);
    try {
      const oldCats = [...(showConfigModal.regra_categorias || [])].sort();
      const newCats = [...(formRegraTipo && formRegraTipo !== 'liquido' ? formRegraCats : [])].sort();
      const isCatsChanged = JSON.stringify(oldCats) !== JSON.stringify(newCats);

      const isRuleChanged = 
        showConfigModal.regra_tipo !== formRegraTipo ||
        showConfigModal.regra_valor !== (formRegraTipo ? Number(formRegraValor) : undefined) ||
        isCatsChanged ||
        showConfigModal.regra_ativa !== formRegraAtiva ||
        showConfigModal.status !== formStatus;

      const nowISO = new Date().toISOString();
      let newRuleHistory = [...(showConfigModal.rule_history || [])];

      if (isRuleChanged) {
        newRuleHistory.push({
          start_date: showConfigModal.regra_inicio_validade || showConfigModal.created_at || nowISO,
          end_date: nowISO,
          regra_tipo: showConfigModal.regra_tipo,
          regra_valor: showConfigModal.regra_valor,
          regra_categorias: showConfigModal.regra_categorias || [],
          regra_ativa: showConfigModal.regra_ativa && showConfigModal.status !== 'inactive' && !showConfigModal.is_paused,
        });
      }

      await updateReserve(showConfigModal.id, {
        name: formName,
        description: formDesc || undefined,
        color: formColor,
        icon: formIcon,
        saldo_inicial: Number(formSaldoInicial) || 0,
        meta_objetivo: formMetaObjetivo ? Number(formMetaObjetivo) : null,
        status: formStatus,
        is_paused: formStatus === 'inactive', // Keep sync if needed
        regra_tipo: formRegraTipo,
        regra_valor: formRegraTipo ? Number(formRegraValor) : undefined,
        regra_categorias: formRegraTipo && formRegraTipo !== 'liquido' ? formRegraCats : undefined,
        regra_ativa: formRegraAtiva,
        require_category_on_use: formRequireCategoryOnUse,
        default_use_category: formRequireCategoryOnUse ? undefined : formDefaultUseCategory,
        rule_history: newRuleHistory,
        regra_inicio_validade: isRuleChanged ? nowISO : showConfigModal.regra_inicio_validade || showConfigModal.created_at || nowISO,
      });

      setShowConfigModal(null);
      clearForm();
    } finally {
      setIsEditing(false);
    }
  };

  const handleOpenEdit = (res: Reserve) => {
    setModalTab('general');
    setFormName(res.name);
    setFormDesc(res.description || '');
    setFormColor(res.color);
    setFormIcon(res.icon);
    setFormSaldoInicial(String(res.saldo_inicial || 0));
    setFormMetaObjetivo(res.meta_objetivo ? String(res.meta_objetivo) : '');
    setFormStatus(res.status);
    setFormRegraAtiva(res.regra_ativa ?? true);
    setFormRegraTipo(res.regra_tipo || null);
    setFormRegraValor(String(res.regra_valor || 0));
    setFormRegraCats(res.regra_categorias || []);
    setFormRequireCategoryOnUse(res.require_category_on_use ?? true);
    setFormDefaultUseCategory(res.default_use_category || '');
    
    setShowConfigModal(res);
  };

  const clearForm = () => {
    setFormName('');
    setFormDesc('');
    setFormColor('#f59e0b');
    setFormIcon('PiggyBank');
    setFormSaldoInicial('0');
    setFormMetaObjetivo('');
    setFormStatus('active');
    setFormRegraAtiva(true);
    setFormRegraTipo(null);
    setFormRegraValor('0');
    setFormRegraCats([]);
    setFormRequireCategoryOnUse(true);
    setFormDefaultUseCategory('Manutenção');
  };

  const toggleCategory = (cat: string) => {
    setFormRegraCats(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (deleteConfirmId && !isDeleting) {
      setIsDeleting(true);
      try {
        await deleteReserve(deleteConfirmId);
        setShowConfigModal(null);
        setDeleteConfirmId(null);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleOpenEditRt = (rt: ReserveTransaction) => {
    setEditingRt(rt);
    setEditRtAmount(String(rt.amount));
    setEditRtDate(rt.date);
    setEditRtDescription(rt.description || '');
    setEditRtCategory(rt.category || '');
    setEditRtReserveId(rt.reserve_id);
    setEditRtType(rt.type);
  };

  const [isDeletingRt, setIsDeletingRt] = useState(false);
  const [isDeletingRuleHist, setIsDeletingRuleHist] = useState(false);
  const [isSavingEditRt, setIsSavingEditRt] = useState(false);
  const [isSavingEditRuleHist, setIsSavingEditRuleHist] = useState(false);

  const handleSaveEditRt = async () => {
    if (!editingRt || isSavingEditRt) return;
    const amountNum = Number(editRtAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Informe um valor válido maior que zero.');
      return;
    }
    if (!editRtDate) {
      toast.error('Informe uma data válida.');
      return;
    }
    if (!editRtReserveId) {
      toast.error('Selecione uma reserva.');
      return;
    }

    const matchedRes = reserves.find(r => r.id === editRtReserveId);
    let finalCat = editRtCategory;
    if (matchedRes && matchedRes.require_category_on_use === false) {
      finalCat = matchedRes.default_use_category || matchedRes.name;
    }

    setIsSavingEditRt(true);
    try {
      await updateReserveTransaction(editingRt.id, {
        amount: amountNum,
        date: editRtDate,
        description: editRtDescription || undefined,
        category: editRtType === 'utilizacao' ? finalCat || undefined : undefined,
        reserve_id: editRtReserveId,
        type: editRtType,
      });
      setEditingRt(null);
    } catch (err) {
      toast.error('Erro ao salvar as edições da movimentação.');
    } finally {
      setIsSavingEditRt(false);
    }
  };

  const handleOpenEditRuleHist = (item: any) => {
    const r = reserves.find(res => res.id === item.reserve_id);
    setEditingRuleHist({
      reserveId: item.reserve_id,
      historyIndex: item.historyIndex,
      regra_tipo: item.regra_tipo,
      regra_valor: String(item.regra_valor || 0),
      regra_categorias: Array.isArray(item.regra_categorias) ? item.regra_categorias : [],
      regra_ativa: item.regra_ativa !== false,
      start_date: item.start_date ? item.start_date.split('T')[0] : (r?.created_at ? r.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
      end_date: item.end_date ? item.end_date.split('T')[0] : undefined,
    });
  };

  const handleDeleteRuleHist = async (reserveId: string, historyIndex: number) => {
    const res = reserves.find(r => r.id === reserveId);
    if (!res) return;
    setIsDeletingRuleHist(true);
    try {
      if (historyIndex === -1) {
        // Deleting the current rule to revert to the previous one
        if (!res.rule_history || res.rule_history.length === 0) {
          toast.error('Não é possível excluir a regra vigente pois não há uma regra anterior. Desative a regra pelas configurações da reserva.');
          return;
        }

        const updatedRuleHistory = [...res.rule_history];
        const lastRule = updatedRuleHistory.pop(); // Remove the most recent historical rule to make it current again

        if (lastRule) {
          await updateReserve(reserveId, {
            regra_tipo: lastRule.regra_tipo,
            regra_valor: lastRule.regra_valor,
            regra_categorias: lastRule.regra_categorias,
            regra_ativa: lastRule.regra_ativa,
            regra_inicio_validade: lastRule.start_date, // Revert start date to when this rule originally started
            rule_history: updatedRuleHistory,
          });
          toast.success('Regra vigente excluída e revertida para a anterior com sucesso!');
        }
      } else {
        // Deleting a historical rule
        if (!res.rule_history) return;
        const updatedRuleHistory = [...res.rule_history];
        updatedRuleHistory.splice(historyIndex, 1);
        await updateReserve(reserveId, { rule_history: updatedRuleHistory });
        toast.success('Histórico de regra excluído com sucesso!');
      }
    } catch (err) {
      toast.error('Erro ao processar a exclusão da regra.');
    } finally {
      setIsDeletingRuleHist(false);
    }
  };

  const confirmDeleteRuleHist = async () => {
    if (!ruleHistToDeleteConfirm || isDeletingRuleHist) return;
    await handleDeleteRuleHist(ruleHistToDeleteConfirm.reserveId, ruleHistToDeleteConfirm.historyIndex);
    setRuleHistToDeleteConfirm(null);
  };

  const confirmDeleteRt = async () => {
    if (!rtToDeleteConfirm || isDeletingRt) return;
    setIsDeletingRt(true);
    try {
      await deleteReserveTransaction(rtToDeleteConfirm.id);
    } catch (err) {
      toast.error('Erro ao excluir movimentação.');
    } finally {
      setRtToDeleteConfirm(null);
      setIsDeletingRt(false);
    }
  };

  const handleSaveEditRuleHist = async () => {
    if (!editingRuleHist || isSavingEditRuleHist) return;
    const valueNum = Number(editingRuleHist.regra_valor);
    if (editingRuleHist.regra_tipo && (isNaN(valueNum) || valueNum < 0)) {
      toast.error('Informe um valor de regra válido.');
      return;
    }

    const res = reserves.find(r => r.id === editingRuleHist.reserveId);
    if (!res) return;

    setIsSavingEditRuleHist(true);
    try {
      if (editingRuleHist.historyIndex === -1) {
        // Edit current rule
        await updateReserve(editingRuleHist.reserveId, {
          regra_tipo: editingRuleHist.regra_tipo,
          regra_valor: editingRuleHist.regra_tipo ? valueNum : undefined,
          regra_categorias: editingRuleHist.regra_tipo && editingRuleHist.regra_tipo !== 'liquido' ? editingRuleHist.regra_categorias : undefined,
          regra_ativa: editingRuleHist.regra_ativa,
          regra_inicio_validade: new Date(editingRuleHist.start_date + 'T12:00:00').toISOString(),
        });
        toast.success('Regra vigente atualizada com sucesso!');
        setEditingRuleHist(null);
      } else {
        // Edit historical rule
        if (!res.rule_history) {
          setIsSavingEditRuleHist(false);
          return;
        }
        const updatedRuleHistory = [...res.rule_history];
        updatedRuleHistory[editingRuleHist.historyIndex] = {
          ...updatedRuleHistory[editingRuleHist.historyIndex],
          regra_tipo: editingRuleHist.regra_tipo,
          regra_valor: editingRuleHist.regra_tipo ? valueNum : undefined,
          regra_categorias: editingRuleHist.regra_tipo && editingRuleHist.regra_tipo !== 'liquido' ? editingRuleHist.regra_categorias : undefined,
          regra_ativa: editingRuleHist.regra_ativa,
          start_date: new Date(editingRuleHist.start_date + 'T12:00:00').toISOString(),
          end_date: editingRuleHist.end_date ? new Date(editingRuleHist.end_date + 'T12:00:00').toISOString() : undefined,
        };
        await updateReserve(editingRuleHist.reserveId, {
          rule_history: updatedRuleHistory,
        });
        toast.success('Histórico de regra atualizado com sucesso!');
        setEditingRuleHist(null);
      }
    } catch (err) {
      toast.error('Erro ao atualizar a regra de cálculo.');
    } finally {
      setIsSavingEditRuleHist(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      
      {/* HEADER SECTION */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reservas Financeiras</h1>
          <p className="text-muted-foreground text-sm">Organize suas economias para manutenções, impostos e emergências.</p>
        </div>

        {/* ACTIONS SECTION */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto justify-end">
          {/* PERIOD SELECTOR */}
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <div className="flex overflow-x-auto scrollbar-none gap-1 p-1 bg-muted/20 border border-border/30 rounded-full w-full sm:w-auto max-w-full">
              {[
                { id: 'last30Days', label: '30 dias' },
                { id: 'last90Days', label: '90 dias' },
                { id: 'month', label: 'Mês Atual' },
                { id: 'lastMonth', label: 'Mês Passado' },
                { id: 'thisYear', label: 'Este Ano' },
                { id: 'lastYear', label: 'Ano Passado' },
                { id: 'custom', label: 'Personalizado' },
              ].map((p) => {
                const isSelected = period === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriod(p.id as any)}
                    className="relative px-3 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-bold rounded-full transition-all whitespace-nowrap focus:outline-none text-center flex-1 sm:flex-initial"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="reserves-active-period"
                        className="absolute inset-0 bg-background border border-border/45 shadow-xs rounded-full"
                        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                      />
                    )}
                    <span className={`relative z-10 transition-colors duration-200 ${isSelected ? 'text-foreground font-extrabold' : 'text-muted-foreground hover:text-foreground'}`}>
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {period === 'custom' && (
              <div className="flex items-center gap-2 justify-end animate-in fade-in slide-in-from-top-2">
                <input
                  type="date"
                  className="bg-background border border-border/60 rounded-md px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
                  value={customDateRange?.start || ''}
                  onChange={(e) => setCustomDateRange({ start: e.target.value, end: customDateRange?.end || format(new Date(), 'yyyy-MM-dd') })}
                />
                <span className="text-muted-foreground text-xs">até</span>
                <input
                  type="date"
                  className="bg-background border border-border/60 rounded-md px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
                  value={customDateRange?.end || ''}
                  onChange={(e) => setCustomDateRange({ start: customDateRange?.start || format(new Date(), 'yyyy-MM-dd'), end: e.target.value })}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SUMMARY STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <div className="flex justify-between items-center text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
              <span>Total Acumulado</span>
              <PiggyBank className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-primary mt-1">{formatCurrency(totalInReserves)}</p>
              <p className="text-[10px] text-muted-foreground">Saldo em todas reservas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/10 bg-emerald-500/[0.02]">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <div className="flex justify-between items-center text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
              <span>Total Depositado</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-emerald-600 mt-1">{formatCurrency(totalAportesPeriodo)}</p>
              <p className="text-[10px] text-muted-foreground">Aportes realizados no período</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-500/10 bg-rose-500/[0.02]">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <div className="flex justify-between items-center text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
              <span>Total Utilizado</span>
              <ArrowDownLeft className="w-4 h-4 text-rose-500" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-rose-600 mt-1">{formatCurrency(totalUtilizadoPeriodo)}</p>
              <p className="text-[10px] text-muted-foreground">Fundo resgatado no período</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/15 bg-amber-500/[0.02]">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <div className="flex justify-between items-center text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
              <span>Aportes Pendentes</span>
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-amber-600 mt-1">{formatCurrency(totalPendente)}</p>
              <p className="text-[10px] text-muted-foreground">Incompleto p/ {period === 'month' ? 'o mês' : period === 'week' ? 'a semana' : 'o período'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* VIEW TABS SELECTOR */}
      <div className="border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 sm:pb-0">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('cards')}
            className={`pb-2 text-sm font-semibold transition-colors border-b-2 px-1 -mb-[1px] md:-mb-[2px] ${activeTab === 'cards' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Minhas Reservas ({reserves.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 text-sm font-semibold transition-colors border-b-2 px-1 -mb-[1px] md:-mb-[2px] ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Histórico de Movimentações ({filteredReserveTransactions.length})
          </button>
        </div>

        <div className="pb-2 sm:pb-2">
          {activeTab === 'cards' ? (
            <Button 
              className="h-9 text-xs gap-1.5 rounded-full px-4 font-bold shrink-0 w-full sm:w-auto shadow-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
              onClick={() => { clearForm(); setShowCreateModal(true); }}
            >
              <Plus className="w-3.5 h-3.5" /> Nova Reserva
            </Button>
          ) : (
            <Button 
              className="h-9 text-xs gap-1.5 rounded-full px-4 font-bold shrink-0 w-full sm:w-auto shadow-xs hover:scale-[1.02] active:scale-[0.98] transition-all bg-emerald-600 hover:bg-emerald-700 text-white border-none"
              onClick={() => navigate('/add?type=aporte')}
            >
              <Plus className="w-3.5 h-3.5" /> Nova Movimentação
            </Button>
          )}
        </div>
      </div>

      {/* ==================================================== */}
      {/* MINHAS RESERVAS RENDERING TAB */}
      {/* ==================================================== */}
      {activeTab === 'cards' && (
        <div className="space-y-6">
          {/* ASSISTENTE DE APORTES EM MASSA (CONSOLIDADOS) */}
          {totalPendente > 0 && (
            <Card className="border-indigo-500/20 bg-indigo-500/[0.01] shadow-md overflow-hidden text-left">
              <div className="p-4 bg-indigo-500/[0.03] border-b border-indigo-500/10 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-600/15 text-indigo-600 rounded-lg">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Assistente de Aporte em Massa</h3>
                    <p className="text-[10px] text-muted-foreground font-medium">Efetive e registre todos os aportes sugeridos do período simultaneamente.</p>
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-7 text-indigo-600 hover:bg-indigo-500/10 font-bold"
                  onClick={() => setIsAssistantExpanded(!isAssistantExpanded)}
                >
                  {isAssistantExpanded ? 'Recolher Painel' : 'Visualizar Aportes'}
                </Button>
              </div>

              {isAssistantExpanded && (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Left Checklist */}
                    <div className="lg:col-span-2 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 text-left">Suas Metas Pendentes</p>
                      
                      {sortedReservesByBalance
                        .filter(r => r.regra_tipo && !r.is_paused && r.status !== 'inactive')
                        .map(r => {
                          const suggested = Number(calculateSuggestion(r).toFixed(2));
                          const lastWDate = getLatestWithdrawalDate(r);
                          const activePeriodAportes = Number(
                            reserveTransactions
                              .filter(rt => {
                                const basicMatches = rt.reserve_id === r.id && 
                                                     rt.type === 'aporte' && 
                                                     isTxInLast30Days(rt.date) && 
                                                     rt.category !== 'Aporte Extra' && 
                                                     rt.category !== 'Rendimento';
                                if (!basicMatches) return false;
                                if (lastWDate && rt.date <= lastWDate) return false;
                                return true;
                              })
                              .reduce((sum, rt) => sum + Number(rt.amount), 0)
                              .toFixed(2)
                          );
                          const pending = Number(Math.max(0, suggested - activePeriodAportes).toFixed(2));
                          
                          if (pending <= 0) return null;

                          const isChecked = !!selectedReservesForBatch[r.id];

                          return (
                            <div 
                              key={r.id}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition-all duration-200 gap-3 ${
                                isChecked 
                                  ? 'bg-card border-indigo-500/30 ring-1 ring-indigo-500/15' 
                                  : 'bg-muted/30 border-border/60 hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedReservesForBatch(prev => ({
                                      ...prev,
                                      [r.id]: !prev[r.id]
                                    }));
                                  }}
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 focus:ring-2 accent-indigo-600 cursor-pointer"
                                />

                                <div 
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 font-bold"
                                  style={{ backgroundColor: r.color }}
                                >
                                  <ReserveIcon name={r.icon} className="w-4 h-4" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-foreground truncate leading-tight">{r.name}</p>
                                  <span className="text-[10px] text-muted-foreground font-medium block truncate mt-0.5">
                                    Sugerido: <strong className="text-foreground">{formatCurrency(suggested)}</strong> • Efetuado: <strong className="text-emerald-600">{formatCurrency(activePeriodAportes)}</strong>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 justify-end">
                                <span className="text-[10px] text-amber-600 font-bold">Aportar:</span>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground">R$</span>
                                  <Input 
                                    type="number"
                                    step="0.01"
                                    disabled={!isChecked}
                                    value={batchAmounts[r.id] ?? '0.00'}
                                    onChange={e => {
                                      setBatchAmounts(prev => ({
                                        ...prev,
                                        [r.id]: e.target.value
                                      }));
                                    }}
                                    className="w-28 pl-8 text-right h-8 font-mono font-bold text-xs rounded-lg active:ring-indigo-500 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                      {/* Right side config panel */}
                      <div className="p-4 bg-muted/40 rounded-xl border border-border/80 flex flex-col justify-between space-y-4 min-w-0">
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-left">Identificação do Lote</p>
                        
                        <div className="space-y-1.5 text-left">
                          <label className="text-[10px] font-bold text-muted-foreground">Competência/Data</label>
                          <Input 
                            type="date"
                            value={batchDate}
                            onChange={e => setBatchDate(e.target.value)}
                            className="h-8 text-xs font-medium w-full max-w-full block box-border"
                          />
                        </div>

                        <div className="space-y-1.5 text-left">
                          <label className="text-[10px] font-bold text-muted-foreground">Observações</label>
                          <Input 
                            placeholder="Ex: Aporte Mensal das Reservas"
                            value={batchDesc}
                            onChange={e => setBatchDesc(e.target.value)}
                            className="h-8 text-xs font-medium w-full"
                          />
                        </div>
                      </div>

                      <div className="border-t border-border pt-3 text-left">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Depósito Consolidado</p>
                        <p className="text-2xl font-black tracking-tight text-indigo-600 mt-1 font-mono">
                          {formatCurrency(
                            Object.keys(selectedReservesForBatch)
                              .filter(id => selectedReservesForBatch[id])
                              .reduce((sum, id) => sum + (Number(batchAmounts[id]) || 0), 0)
                          )}
                        </p>
                        <p className="text-[9.5px] text-muted-foreground mt-1 leading-relaxed leading-normal italic">
                          💡 Os valores acima serão integralmente creditados no saldo real de suas reservas selecionadas de forma sequencial.
                        </p>
                      </div>

                      <Button 
                        onClick={handleBatchAporte}
                        disabled={isBatchSubmitting || Object.keys(selectedReservesForBatch).filter(id => selectedReservesForBatch[id]).length === 0}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 shadow-sm"
                      >
                        {isBatchSubmitting ? 'Salvando aportes...' : `Efetivar Aportes (${Object.keys(selectedReservesForBatch).filter(id => selectedReservesForBatch[id]).length})`}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Status Sub-filter pills for cards */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 border border-border/40 p-2.5 rounded-2xl">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <p className="text-xs font-bold text-foreground">Visualizar Reservas:</p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setReserveCardFilter('active')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  reserveCardFilter === 'active'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                Ativas ({activeReserves.length})
              </button>
              <button
                type="button"
                onClick={() => setReserveCardFilter('finalized')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  reserveCardFilter === 'finalized'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                Finalizadas ({finalizedReserves.length})
              </button>
              <button
                type="button"
                onClick={() => setReserveCardFilter('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  reserveCardFilter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                Todas ({reserves.length})
              </button>
            </div>
          </div>

          {sortedReservesByBalance.length === 0 ? (
            <Card className="border border-dashed border-border/70 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Archive className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-bold text-foreground">Nenhuma reserva nesta visualização</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {reserveCardFilter === 'finalized' 
                  ? 'Você não possui reservas finalizadas. Ao finalizar uma reserva, ela ficará listada aqui mantendo seus dados intactos.'
                  : 'Nenhuma reserva encontrada para o filtro selecionado.'
                }
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedReservesByBalance.map(r => {
                const suggested = Number(calculateSuggestion(r).toFixed(2));
                const lastWDate = getLatestWithdrawalDate(r);
                const activePeriodAportes = Number(
                  reserveTransactions
                    .filter(rt => {
                      const basicMatches = rt.reserve_id === r.id && 
                                           rt.type === 'aporte' && 
                                           isTxInLast30Days(rt.date) && 
                                           rt.category !== 'Aporte Extra' && 
                                           rt.category !== 'Rendimento';
                      if (!basicMatches) return false;
                      if (lastWDate && rt.date <= lastWDate) return false;
                      return true;
                    })
                    .reduce((sum, rt) => sum + Number(rt.amount), 0)
                    .toFixed(2)
                );
                
                const rPending = Number(Math.max(0, suggested - activePeriodAportes).toFixed(2));

                const lastMv = reserveTransactions
                  .filter(rt => rt.reserve_id === r.id)
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

                const lastMvIsRendimento = lastMv && lastMv.type === 'rendimento';

                const isExpanded = !!expandedReserves[r.id];

                return (
                  <Card 
                    key={r.id} 
                    className={`overflow-hidden transition-all duration-300 border border-border/70 hover:border-border/100 rounded-2xl bg-card shadow-2xs hover:shadow-sm ${
                      r.status === 'inactive' ? 'opacity-80 bg-muted/25' : ''
                    }`}
                    style={{ borderLeft: `5px solid ${r.color}` }}
                  >
                    <CardContent className="p-0 flex flex-col justify-between h-full">
                      {/* Compact Header Trigger */}
                      <div 
                        className="flex justify-between items-center cursor-pointer select-none p-4"
                        onClick={() => toggleReserveExpanded(r.id)}
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 font-bold shadow-xs transition-transform duration-200 active:scale-95"
                            style={{ backgroundColor: r.color }}
                          >
                            <ReserveIcon name={r.icon} className="w-5 h-5 text-white" />
                          </div>
                          <div className="text-left min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-sm text-foreground tracking-tight truncate max-w-[140px] sm:max-w-[200px]">
                                {r.name}
                              </h4>
                              {r.status === 'inactive' && (
                                <span className="text-[9px] bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 font-extrabold py-0.5 px-1.5 rounded uppercase tracking-wider">
                                  Arquivada
                                </span>
                              )}
                              {r.regra_tipo && r.is_paused && r.status !== 'inactive' && (
                                <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 font-extrabold py-0.5 px-1.5 rounded uppercase tracking-wider">
                                  Pausada
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground truncate block font-semibold mt-0.5">
                              {r.regra_tipo ? (
                                r.is_paused ? 'Regra suspensa' : `Automática: ${r.regra_tipo === 'km' ? 'por Km' : r.regra_tipo === 'bruto' ? 's/ Bruto' : r.regra_tipo === 'liquido' ? 's/ Líquido' : 'Fixo por Dia'}`
                              ) : (
                                'Aportes Manuais'
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Right: Balance & Chevron */}
                        <div className="flex items-center gap-3 shrink-0 pl-2">
                          <div className="text-right">
                            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider block leading-none mb-1">Saldo</span>
                            <span className="text-xs sm:text-sm font-black font-mono text-foreground bg-muted/70 px-2.5 py-1 rounded-lg border border-border/50">
                              {formatCurrency(r.saldo_atual || 0)}
                            </span>
                          </div>
                          <div className="text-muted-foreground/70">
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="w-4 h-4 shrink-0" />
                            </motion.div>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Panel */}
                      {isExpanded && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="border-t border-dashed border-border/70 px-4 pb-4 pt-3 space-y-4"
                        >
                          {/* Meta Objetivo Progress */}
                          {r.meta_objetivo && r.meta_objetivo > 0 && (
                            <div className="bg-muted/15 p-3 rounded-xl border border-border/40 space-y-2">
                              <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-muted-foreground uppercase tracking-wider">Progresso da Meta Global</span>
                                <span className="text-foreground bg-card border border-border/40 px-2 py-0.5 rounded-md font-mono">
                                  {formatCurrency(r.saldo_atual || 0)} / {formatCurrency(r.meta_objetivo)}
                                </span>
                              </div>
                              <div className="h-2 w-full bg-muted rounded-full overflow-hidden relative shadow-inner">
                                <div 
                                  className="h-full rounded-full transition-all duration-500 ease-out shadow-xs" 
                                  style={{ 
                                    width: `${Math.min(100, Math.max(0, ((r.saldo_atual || 0) / r.meta_objetivo) * 100))}%`,
                                    backgroundColor: r.color 
                                  }} 
                                />
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-muted-foreground font-semibold">
                                  {((r.saldo_atual || 0) / r.meta_objetivo * 100).toFixed(1)}% atingido
                                </span>
                                {r.meta_objetivo - (r.saldo_atual || 0) > 0 ? (
                                  <span className="text-rose-500 font-extrabold flex items-center gap-0.5">
                                    Falta {formatCurrency(r.meta_objetivo - (r.saldo_atual || 0))}
                                  </span>
                                ) : (
                                  <span className="text-emerald-500 font-extrabold flex items-center gap-1 animate-pulse">
                                    <Sparkles className="w-3.5 h-3.5" /> Meta Atingida! 🎉
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Rule applied detail & suggestions */}
                          {r.regra_tipo && (
                            <div className="bg-muted/25 p-3.5 rounded-xl border border-border/40 space-y-3">
                              <div className="flex justify-between items-center border-b border-border/30 pb-2">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                  <Sliders className="w-3.5 h-3.5 text-primary" />
                                  <span>Fórmula Poupança</span>
                                </div>
                                <span className="text-xs font-black text-foreground font-mono" style={{ color: r.color }}>
                                  {r.regra_tipo === 'km' && `R$ ${formatRuleValue(r.regra_valor)} / km`}
                                  {r.regra_tipo === 'bruto' && `${formatRuleValue(r.regra_valor)}% do Bruto`}
                                  {r.regra_tipo === 'liquido' && `${formatRuleValue(r.regra_valor)}% do Líquido`}
                                  {r.regra_tipo === 'fixo' && `R$ ${formatRuleValue(r.regra_valor)} / Dia`}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2.5">
                                <div className="bg-card border border-border/50 p-2.5 rounded-lg text-left">
                                  <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block">Sugerido ({period === 'month' ? 'mês' : period === 'week' ? 'semana' : 'período'})</span>
                                  <span className="text-xs font-bold text-foreground font-mono mt-0.5 block">{r.is_paused ? 'R$ 0,00' : formatCurrency(suggested)}</span>
                                </div>
                                <div className="bg-card border border-border/50 p-2.5 rounded-lg text-left">
                                  <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block">Realizado</span>
                                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">{formatCurrency(activePeriodAportes)}</span>
                                </div>
                              </div>

                              {!r.is_paused && rPending > 0 ? (
                                <div className="flex items-center justify-between bg-amber-500/[0.04] border border-amber-500/15 p-2.5 rounded-lg text-xs font-semibold text-amber-600 dark:text-amber-400">
                                  <span className="flex items-center gap-1.5 font-bold"><AlertCircle className="w-3.5 h-3.5" /> Saldo Ideal Pendente</span>
                                  <span className="font-extrabold font-mono text-sm">{formatCurrency(rPending)}</span>
                                </div>
                              ) : !r.is_paused ? (
                                <div className="flex items-center justify-between bg-emerald-500/[0.04] border border-emerald-500/15 p-2.5 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                  <span className="flex items-center gap-1.5 font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> Objetivo do Período</span>
                                  <span className="font-extrabold text-sm flex items-center gap-0.5">Atingido! 🎉</span>
                                </div>
                              ) : (
                                <div className="text-center py-1 text-[10px] text-muted-foreground italic bg-muted/10 rounded">
                                  Cálculos suspensos temporariamente
                                </div>
                              )}

                              {/* Auditing formula */}
                              <div className="flex justify-end pt-0.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAuditedReserveId(auditedReserveId === r.id ? null : r.id);
                                  }}
                                  className="text-[10px] text-indigo-500 hover:text-indigo-600 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                                >
                                  <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                                  {auditedReserveId === r.id ? 'Ocultar Memória de Cálculo' : 'Auditar Memória de Cálculo'}
                                </button>
                              </div>

                              {auditedReserveId === r.id && (
                                <div className="mt-2 text-[10px] bg-indigo-500/[0.03] p-3 rounded-lg border border-indigo-500/10 text-muted-foreground space-y-1.5 leading-relaxed text-left animate-in fade-in duration-150">
                                  <p className="font-bold text-indigo-600 flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Detalhes da Auditoria:
                                  </p>
                                  {getSuggestionAudit(r).details.map((detail, idx) => (
                                    <p key={idx} className="flex gap-1 items-start">
                                      <span className="text-indigo-500 font-extrabold">•</span>
                                      <span>{detail}</span>
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Description if present */}
                          {r.description && (
                            <div className="text-left text-xs text-muted-foreground bg-muted/10 p-2.5 rounded-lg border border-border/30">
                              <span className="font-bold text-foreground block mb-0.5">Finalidade</span>
                              {r.description}
                            </div>
                          )}

                          {/* Tactile Mobile Actions */}
                          <div className="space-y-2 border-t border-border/40 pt-3">
                            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider block text-left mb-1">Ações Disponíveis</span>

                            {/* 1. Primary Highlight Action: Aporte Sugerido */}
                            {r.status !== 'inactive' && !r.is_paused && r.regra_tipo && rPending > 0 && (
                              <Button
                                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold gap-2 rounded-xl shadow-xs text-xs transition-transform active:scale-98 cursor-pointer"
                                onClick={() => navigate(`/add?type=aporte&reserve_id=${r.id}&amount=${rPending}`)}
                              >
                                <Plus className="w-4 h-4 stroke-[3px]" />
                                Aportar Sugerido ({formatCurrency(rPending)})
                              </Button>
                            )}

                            {/* 2. Secondary & Utility Actions Grid */}
                            <div className="grid grid-cols-2 gap-2">
                              {r.status !== 'inactive' ? (
                                <>
                                  <Button
                                    variant="outline"
                                    className="h-10 border-emerald-500/20 bg-emerald-500/[0.02] hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold gap-1.5 rounded-xl text-xs cursor-pointer"
                                    onClick={() => navigate(`/add?type=aporte&reserve_id=${r.id}`)}
                                  >
                                    <Plus className="w-4 h-4 stroke-[3px]" />
                                    Aporte Manual
                                  </Button>
                                  
                                  <Button
                                    variant="outline"
                                    className="h-10 border-rose-500/20 bg-rose-500/[0.02] hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold gap-1.5 rounded-xl text-xs cursor-pointer"
                                    onClick={() => navigate(`/add?type=utilizacao&reserve_id=${r.id}`)}
                                  >
                                    <ArrowDownLeft className="w-4 h-4 stroke-[3px]" />
                                    Resgatar
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  className="col-span-2 h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold gap-1.5 rounded-xl text-xs cursor-pointer"
                                  onClick={() => handleReactivateReserve(r)}
                                >
                                  <RefreshCw className="w-4 h-4 animate-spin-slow" /> Reativar Reserva
                                </Button>
                              )}
                            </div>

                            {/* 3. Utility Button Row (Config, Pause/Resume, Yield, History, Archive) */}
                            <div className="flex flex-wrap gap-1.5 pt-1.5 justify-between items-center text-xs text-muted-foreground border-t border-border/30 mt-2 bg-muted/10 p-2 rounded-xl">
                              <span className="text-[10px] italic truncate max-w-[140px] text-left">
                                {lastMv ? (
                                  `Alt: ${lastMv.type === 'aporte' ? '+' : lastMvIsRendimento ? '📈' : '-'}${formatCurrency(Number(lastMv.amount))} (${new Date(lastMv.date).toLocaleDateString('pt-BR')})`
                                ) : (
                                  'Sem movimentações'
                                )}
                              </span>

                              <div className="flex items-center gap-1 flex-wrap">
                                {/* Rule Play/Pause */}
                                {r.regra_tipo && r.status !== 'inactive' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 px-2.5 rounded-lg text-[11px] font-extrabold gap-1 cursor-pointer ${
                                      r.is_paused 
                                        ? 'text-amber-500 hover:bg-amber-500/10 hover:text-amber-600 bg-amber-500/5' 
                                        : 'text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600'
                                    }`}
                                    onClick={() => toggleRuleActive(r)}
                                    title={r.is_paused ? 'Ativar regra automática' : 'Pausar regra de cálculo'}
                                  >
                                    {r.is_paused ? (
                                      <>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-0.5"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                                        Ativar Regra
                                      </>
                                    ) : (
                                      <>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-0.5"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>
                                        Pausar Regra
                                      </>
                                    )}
                                  </Button>
                                )}

                                {/* Yield / Rendimento */}
                                {r.status !== 'inactive' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 rounded-lg text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/10 text-[11px] font-extrabold gap-1 cursor-pointer"
                                    onClick={() => {
                                      setUpdateBalanceAmount('');
                                      setUpdateBalanceDesc('Rendimento');
                                      setShowUpdateBalanceModal(r);
                                    }}
                                  >
                                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                                    Rendimento
                                  </Button>
                                )}

                                {/* Rule History */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 text-[11px] font-extrabold gap-1 cursor-pointer"
                                  onClick={() => setShowRuleHistoryModal(r)}
                                  title="Ver histórico de regras aplicadas"
                                >
                                  Histórico
                                </Button>

                                {/* Configure / Gear */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 text-[11px] font-extrabold gap-1 cursor-pointer"
                                  onClick={() => handleOpenEdit(r)}
                                  title="Configurar reserva"
                                >
                                  <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                                  Ajustes
                                </Button>

                                {/* Archive/Finalize */}
                                {r.status !== 'inactive' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 text-[11px] font-extrabold gap-1 cursor-pointer"
                                    onClick={() => setShowFinalizeConfirmModal(r)}
                                    title="Finalizar reserva e manter histórico"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                    Finalizar
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* HISTORICO DE MOVIMENTACOES RENDERING TAB */}
      {/* ==================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          
          {/* KPI Summary Cards for History */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl text-left">
              <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Total Aportado</span>
              <p className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(historyStats.totalAportes)}</p>
            </div>
            <div className="bg-rose-500/5 border border-rose-500/20 p-3 rounded-xl text-left">
              <span className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Total Resgatado</span>
              <p className="text-base sm:text-lg font-black font-mono text-rose-600 dark:text-rose-400 mt-0.5">{formatCurrency(historyStats.totalResgates)}</p>
            </div>
            <div className="bg-indigo-500/5 border border-indigo-500/20 p-3 rounded-xl text-left">
              <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">Rendimentos</span>
              <p className="text-base sm:text-lg font-black font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">{formatCurrency(historyStats.totalRendimentos)}</p>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl text-left">
              <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Mudanças de Regra</span>
              <p className="text-base sm:text-lg font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5">{historyStats.ruleChangesCount} evento(s)</p>
            </div>
          </div>

          {/* Search bar and Reserve filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 border border-border/40 p-3 rounded-2xl">
            {/* Search input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nome, descrição ou categoria..."
                value={historySearchTerm}
                onChange={e => setHistorySearchTerm(e.target.value)}
                className="pl-9 text-xs h-9 bg-card"
              />
            </div>

            {/* Reserve selector */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-muted-foreground shrink-0 hidden sm:inline">Reserva:</span>
              <Select value={historyReserveFilter} onValueChange={setHistoryReserveFilter}>
                <SelectTrigger className="h-9 text-xs w-full sm:w-56 bg-card">
                  <SelectValue placeholder="Todas as Reservas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Reservas</SelectItem>
                  {reserves.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} {r.status === 'inactive' ? '(Finalizada)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sub-navigation type filter pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/20 border border-border/40 p-2 rounded-xl">
            <p className="text-[11px] font-bold text-muted-foreground uppercase px-2">Tipo de Lançamento:</p>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setHistoryTypeFilter('all')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  historyTypeFilter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                Todos ({combinedHistoryItems.length})
              </button>
              <button
                onClick={() => setHistoryTypeFilter('aporte')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  historyTypeFilter === 'aporte'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                Aportes
              </button>
              <button
                onClick={() => setHistoryTypeFilter('utilizacao')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  historyTypeFilter === 'utilizacao'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                Resgates
              </button>
              <button
                onClick={() => setHistoryTypeFilter('rendimento')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  historyTypeFilter === 'rendimento'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                Rendimentos
              </button>
              <button
                onClick={() => setHistoryTypeFilter('rules')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  historyTypeFilter === 'rules'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                Mudanças de Regra ({combinedHistoryItems.filter(i => i.type === 'rule_change').length})
              </button>
            </div>
          </div>

          <Card className="border border-border/60 shadow-xs overflow-hidden">
            <CardContent className="p-0">
              {filteredCombinedItems.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3.5">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border border-dashed border-border">
                    <HistIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-sm text-foreground">Nenhum registro encontrado</p>
                  <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                    Não encontramos lançamentos para os filtros e período selecionados.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {filteredCombinedItems.map(item => {
                    if (item.type === 'rule_change') {
                      const isHistoryChange = item.actionType === 'rule_history_change';
                      
                      // Text for rule type
                      let typeText = 'Aporte Manual';
                      if (item.regra_tipo === 'km') typeText = `Por Km Rodado (R$ ${formatRuleValue(Number(item.regra_valor))}/km)`;
                      else if (item.regra_tipo === 'bruto') typeText = `Percentual do Bruto (${formatRuleValue(Number(item.regra_valor))}%)`;
                      else if (item.regra_tipo === 'liquido') typeText = `Percentual do Líquido (${formatRuleValue(Number(item.regra_valor))}%)`;
                      else if (item.regra_tipo === 'fixo') typeText = `Fixo por Dia Ativo (R$ ${formatRuleValue(Number(item.regra_valor))}/dia)`;

                      const formattedCats = Array.isArray(item.regra_categorias) && item.regra_categorias.length > 0
                        ? item.regra_categorias.join(', ')
                        : null;

                      return (
                        <div 
                          key={item.id} 
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors border-l-4 border-dashed"
                          style={{ borderLeftColor: item.reserve_color || '#cbd5e1' }}
                        >
                          <div className="flex items-center gap-3.5 flex-1 min-w-0">
                            {/* Circle Icon Badge */}
                            <div 
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs relative"
                              style={{ backgroundColor: `${item.reserve_color}d0` || '#cbd5e1' }}
                            >
                              <Settings2 className="w-5 h-5 text-white" />
                              <div className="absolute -bottom-1 -right-1 bg-zinc-900 text-white rounded-full p-0.5 border border-white text-[8px] flex items-center justify-center w-4 h-4 font-bold">
                                R
                              </div>
                            </div>

                            {/* Title and details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-sm text-foreground truncate max-w-[200px] sm:max-w-[300px]">
                                  {item.reserve_name}
                                </h4>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  isHistoryChange 
                                    ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' 
                                    : 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400'
                                }`}>
                                  {isHistoryChange ? 'Regra Histórica' : 'Regra Vigente'}
                                </span>
                                {!item.regra_ativa && (
                                  <span className="bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold">
                                    Pausada
                                  </span>
                                )}
                              </div>

                              <div className="mt-1 text-xs space-y-0.5 text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-foreground/95">{typeText}</span>
                                </div>
                                {formattedCats && (
                                  <p className="text-[10px] leading-tight truncate max-w-lg">
                                    Categorias: <span className="font-semibold text-foreground/80">{formattedCats}</span>
                                  </p>
                                )}
                                
                                {/* Validity dates */}
                                <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                                  <Calendar className="w-3 h-3 shrink-0" />
                                  <span>
                                    {isHistoryChange 
                                      ? `Vigência: de ${new Date(item.start_date).toLocaleDateString('pt-BR')} até ${new Date(item.end_date).toLocaleDateString('pt-BR')}`
                                      : `Vigência: desde ${new Date(item.start_date).toLocaleDateString('pt-BR')}`
                                    }
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right side: value & buttons */}
                          <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-border/40 pt-3 sm:pt-0 shrink-0">
                            <span className="font-extrabold text-xs tracking-tight font-mono text-muted-foreground">
                              {item.regra_tipo ? (item.regra_tipo === 'km' || item.regra_tipo === 'fixo' ? `R$ ${formatRuleValue(item.amount)}` : `${formatRuleValue(item.amount)}%`) : 'Manual'}
                            </span>

                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
                                onClick={() => handleOpenEditRuleHist(item)}
                                title="Editar regra de cálculo"
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>

                              {(isHistoryChange || item.historyIndex === -1) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-8 h-8 hover:bg-rose-500/15 hover:text-rose-600 text-muted-foreground rounded-full transition-colors"
                                  onClick={() => {
                                    if (item.historyIndex === -1) {
                                      const res = reserves.find(r => r.id === item.reserve_id);
                                      if (!res || !res.rule_history || res.rule_history.length === 0) {
                                        toast.error('Não é possível excluir a regra vigente pois não há uma regra anterior. Desative a regra pelas configurações da reserva.');
                                        return;
                                      }
                                    }
                                    setRuleHistToDeleteConfirm({
                                      reserveId: item.reserve_id,
                                      historyIndex: item.historyIndex,
                                      reserveName: item.reserve_name,
                                      ruleType: typeText,
                                      amount: item.amount,
                                    });
                                  }}
                                  title={item.historyIndex === -1 ? "Excluir regra vigente e reverter para a anterior" : "Excluir do histórico"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      // Transaction (Aporte/Resgate/Rendimento)
                      const rt = item.raw;
                      const correlatedRes = reserves.find(r => r.id === rt.reserve_id);
                      const isAporte = rt.type === 'aporte';
                      const isRendimento = rt.type === 'rendimento';

                      return (
                        <div 
                          key={rt.id} 
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors border-l-4"
                          style={{ borderLeftColor: correlatedRes?.color || '#cbd5e1' }}
                        >
                          <div className="flex items-center gap-3.5 flex-1 min-w-0">
                            {/* Circle Icon Badge */}
                            <div 
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                              style={{ backgroundColor: correlatedRes?.color || '#cbd5e1' }}
                            >
                              {isRendimento ? (
                                <TrendingUp className="w-5 h-5 text-white" />
                              ) : isAporte ? (
                                <ArrowUpRight className="w-5 h-5 text-white" />
                              ) : (
                                <ArrowDownLeft className="w-5 h-5 text-white" />
                              )}
                            </div>

                            {/* Title and details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-sm text-foreground truncate max-w-[200px] sm:max-w-[300px]">
                                  {correlatedRes?.name || 'Reserva excluída'}
                                </h4>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isRendimento 
                                    ? 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400'
                                    : isAporte 
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                      : 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                                }`}>
                                  {isRendimento ? 'Rendimento' : isAporte ? 'Aporte' : 'Resgate'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                                {rt.description && <span className="truncate max-w-[250px] font-medium text-foreground/80">{rt.description}</span>}
                                {rt.description && rt.category && <span>•</span>}
                                {rt.category && <span className="bg-muted px-1.5 py-0.5 rounded-md text-[10px] font-semibold">{rt.category}</span>}
                              </div>

                              {/* Date and details */}
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                                <Calendar className="w-3 h-3 shrink-0" />
                                <span>{new Date(rt.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right side: value & buttons */}
                          <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-border/40 pt-3 sm:pt-0 shrink-0">
                            <span className={`font-extrabold text-base tracking-tight font-mono ${
                              isRendimento ? 'text-indigo-500' : isAporte ? 'text-emerald-500' : 'text-rose-500'
                            }`}>
                              {isRendimento || isAporte ? '+' : '-'} {formatCurrency(Number(rt.amount))}
                            </span>

                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
                                onClick={() => handleOpenEditRt(rt)}
                                title="Editar movimentação"
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 hover:bg-rose-500/15 hover:text-rose-600 text-muted-foreground rounded-full transition-colors"
                                onClick={() => setRtToDeleteConfirm({
                                  id: rt.id,
                                  reserveName: correlatedRes?.name || 'Reserva excluída',
                                  amount: Number(rt.amount),
                                  type: rt.type,
                                  date: rt.date,
                                  description: rt.description,
                                })}
                                title="Excluir movimentação"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================== */}
      {/* DIALOG: CREATE RESERVE MODAL */}
      {/* ==================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all">
          <div className="bg-card border-t sm:border border-border rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200">
            <header className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <PiggyBank className="w-5 h-5 stroke-[2.5px]" />
                </div>
                <h2 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">Nova Reserva</h2>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground cursor-pointer shrink-0" 
                onClick={() => { setShowCreateModal(false); clearForm(); }}
              >
                <X className="w-4.5 h-4.5" />
              </Button>
            </header>

            {/* Elegant Tab Switchers */}
            <div className="flex border-b border-border bg-muted/10 p-1.5 gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setModalTab('general')}
                className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  modalTab === 'general'
                    ? 'bg-card text-primary shadow-xs border border-border/40 font-black'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-extrabold'
                }`}
              >
                <Sliders className="w-4 h-4" />
                Cadastro Geral
              </button>
              <button
                type="button"
                onClick={() => setModalTab('automation')}
                className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  modalTab === 'automation'
                    ? 'bg-card text-primary shadow-xs border border-border/40 font-black'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-extrabold'
                }`}
              >
                <Settings2 className="w-4 h-4" />
                Regras de Cálculo {formRegraAtiva && formRegraTipo && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />}
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 pb-8 sm:pb-5">
              
              {/* Real-time Card Live Preview */}
              <div className="bg-muted/15 p-3.5 rounded-2xl border border-border/70 space-y-2">
                <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider block text-left">Visualização em Tempo Real</span>
                <div 
                  className="overflow-hidden transition-all duration-300 border border-border/70 rounded-2xl bg-card shadow-2xs"
                  style={{ borderLeft: `5px solid ${formColor || '#f59e0b'}` }}
                >
                  <div className="p-4 flex justify-between items-center select-none">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 font-bold shadow-xs"
                        style={{ backgroundColor: formColor || '#f59e0b' }}
                      >
                        <ReserveIcon name={formIcon || 'PiggyBank'} className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <h4 className="font-extrabold text-sm text-foreground tracking-tight truncate max-w-[140px] sm:max-w-[200px]">
                          {formName.trim() || 'Nova Reserva de Exemplo'}
                        </h4>
                        <span className="text-[11px] text-muted-foreground truncate block font-semibold mt-0.5">
                          {formRegraAtiva && formRegraTipo ? `Automática: ${formRegraTipo === 'km' ? 'por Km' : formRegraTipo === 'bruto' ? 's/ Bruto' : formRegraTipo === 'liquido' ? 's/ Líquido' : 'Fixo por Dia'}` : 'Aportes Manuais'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider block leading-none mb-1">Saldo</span>
                      <span className="text-xs sm:text-sm font-black font-mono text-foreground bg-muted/70 px-2.5 py-1 rounded-lg border border-border/50">
                        {formatCurrency(Number(formSaldoInicial) || 0)}
                      </span>
                    </div>
                  </div>

                  {formMetaObjetivo && Number(formMetaObjetivo) > 0 && (
                    <div className="border-t border-dashed border-border/70 px-4 pb-4 pt-3 space-y-2">
                      <div className="bg-muted/15 p-3 rounded-xl border border-border/40 space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-muted-foreground uppercase tracking-wider">Progresso da Meta Global</span>
                          <span className="text-foreground bg-card border border-border/40 px-2 py-0.5 rounded-md font-mono">
                            {formatCurrency(Number(formSaldoInicial) || 0)} / {formatCurrency(Number(formMetaObjetivo))}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden relative shadow-inner">
                          <div 
                            className="h-full rounded-full transition-all duration-500 ease-out shadow-xs" 
                            style={{ 
                              width: `${Math.min(100, Math.max(0, ((Number(formSaldoInicial) || 0) / Number(formMetaObjetivo)) * 100))}%`,
                              backgroundColor: formColor || '#f59e0b' 
                            }} 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {modalTab === 'general' ? (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Name field */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Nome da Reserva</label>
                    <Input 
                      placeholder="Ex: IPVA do Veículo, Troca de pneus..."
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="rounded-xl h-11 border-border focus:ring-2 focus:ring-primary/20 font-medium text-sm"
                    />
                  </div>

                  {/* Desc field */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Descrição (Opcional)</label>
                    <Input 
                      placeholder="Finalidade ou detalhes desta reserva"
                      value={formDesc}
                      onChange={e => setFormDesc(e.target.value)}
                      className="rounded-xl h-11 border-border font-medium text-sm"
                    />
                  </div>

                  {/* Meta & Balance fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Meta Total (R$)</label>
                      <CurrencyInput 
                        placeholder="Sem meta limite"
                        value={formMetaObjetivo}
                        onChange={setFormMetaObjetivo}
                      />
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Saldo Inicial (R$)</label>
                      <CurrencyInput 
                        placeholder="0,00"
                        value={formSaldoInicial}
                        onChange={setFormSaldoInicial}
                      />
                    </div>
                  </div>

                  {/* Status Selection */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Status da Reserva</label>
                    <Select value={formStatus} onValueChange={(val: any) => setFormStatus(val)}>
                      <SelectTrigger className="h-11 rounded-xl font-medium text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">🟢 Ativa (Exibe nos cálculos e painel)</SelectItem>
                        <SelectItem value="inactive">🔴 Inativa/Finalizada (Congela e arquiva histórico)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Presets icons */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Ícone de Destaque</label>
                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 bg-muted/10 p-2.5 rounded-2xl border border-border/50">
                      {Object.keys(iconOptions).map(icoKey => {
                        const TargetIcon = iconOptions[icoKey as keyof typeof iconOptions];
                        const isSelected = formIcon === icoKey;
                        return (
                          <button
                            key={icoKey}
                            type="button"
                            onClick={() => setFormIcon(icoKey)}
                            className={`p-3 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-primary text-primary-foreground border-primary scale-105 shadow-md shadow-primary/10' 
                                : 'bg-card hover:bg-muted border-border hover:scale-105'
                            }`}
                            title={icoKey}
                          >
                            <TargetIcon className="w-5 h-5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Presets colors */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Cor Temática</label>
                    <div className="flex flex-wrap gap-2.5 bg-muted/10 p-2.5 rounded-2xl border border-border/50">
                      {colorPresets.map(col => {
                        const isSelected = formColor === col.hex;
                        return (
                          <button
                            key={col.hex}
                            type="button"
                            onClick={() => setFormColor(col.hex)}
                            className="w-8.5 h-8.5 rounded-full border-2 transition-all flex items-center justify-center relative hover:scale-110 cursor-pointer"
                            style={{ 
                              backgroundColor: col.hex,
                              borderColor: isSelected ? '#fff' : 'transparent',
                              boxShadow: isSelected ? '0 0 0 2.5px ' + col.hex : 'none'
                            }}
                            title={col.name}
                          >
                            {isSelected && <Check className="w-4 h-4 text-white stroke-[3.5px]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Uso Configuration */}
                  <div className="border border-border/60 rounded-2xl bg-muted/15 p-4 space-y-3.5 text-left">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <label className="text-xs font-extrabold text-foreground">Exigir Categoria no Resgate?</label>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground">Se ativo, cada retirada exige classificação manual. Se inativo, assume a categoria padrão.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormRequireCategoryOnUse(!formRequireCategoryOnUse)}
                        className={`text-xs px-3.5 py-2 rounded-xl font-bold border transition-all cursor-pointer shrink-0 ${
                          formRequireCategoryOnUse 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' 
                            : 'bg-card hover:bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {formRequireCategoryOnUse ? 'Sim, Exigir' : 'Fixar Categoria'}
                      </button>
                    </div>
                    {!formRequireCategoryOnUse && (
                      <div className="space-y-1.5 pt-3 border-t border-dashed border-border/50">
                        <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase">Categoria Padrão do Gasto</label>
                        <Select value={formDefaultUseCategory} onValueChange={setFormDefaultUseCategory}>
                          <SelectTrigger className="h-11 rounded-xl text-sm font-medium">
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-150 text-left">
                  {/* Rule Active Switch */}
                  <div className="flex items-center justify-between bg-emerald-500/[0.04] p-4 rounded-2xl border border-emerald-500/15">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs sm:text-sm font-black text-foreground">Ativar Regra de Cálculo Automático</p>
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground">Calcula depósitos recomendados automaticamente a cada corrida/receita cadastrada.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormRegraAtiva(!formRegraAtiva)}
                      className={`text-xs px-4 py-2.5 rounded-xl font-black border transition-all cursor-pointer shrink-0 ${
                        formRegraAtiva 
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/10' 
                          : 'bg-card hover:bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      {formRegraAtiva ? 'Regra Ativa' : 'Ignorar Regra'}
                    </button>
                  </div>

                  {formRegraAtiva && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                      <div className="space-y-2">
                        <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Método de Cálculo</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {ruleOptions.map((opt) => {
                            const isSelected = formRegraTipo === opt.id;
                            const OptIcon = opt.icon;
                            return (
                              <button
                                key={opt.id === null ? 'null' : opt.id}
                                type="button"
                                onClick={() => {
                                  setFormRegraTipo(opt.id as any);
                                  if (opt.id === null) {
                                    setFormRegraValor('0');
                                  }
                                }}
                                className={`flex items-start text-left p-3.5 rounded-2xl border transition-all duration-200 relative group overflow-hidden cursor-pointer ${
                                  isSelected 
                                    ? 'bg-indigo-600/[0.04] border-indigo-500 text-foreground ring-1 ring-indigo-500/40' 
                                    : 'bg-card border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                                }`}
                              >
                                <div className={`p-2 rounded-lg mr-2.5 shrink-0 transition-colors ${isSelected ? 'bg-indigo-600/10 text-indigo-600' : 'bg-muted text-muted-foreground'}`}>
                                  <OptIcon className="w-4 h-4" />
                                </div>
                                <div className="space-y-1 min-w-0 pr-4">
                                  <p className="text-xs font-extrabold text-foreground leading-tight">{opt.title}</p>
                                  <p className="text-[10px] leading-relaxed text-muted-foreground whitespace-normal">{opt.description}</p>
                                </div>
                                {isSelected && (
                                  <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm">
                                    <Check className="w-2.5 h-2.5 stroke-[3px]" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {formRegraTipo && (
                        <div className="bg-muted/20 p-4 rounded-2xl border border-border space-y-4">
                          {/* Dynamic value input based on chosen method */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              {formRegraTipo === 'km' && 'Valor por Km Rodado (R$)'}
                              {formRegraTipo === 'bruto' && 'Percentual sobre Ganhos (%)'}
                              {formRegraTipo === 'liquido' && 'Percentual sobre o Lucro Líquido (%)'}
                              {formRegraTipo === 'fixo' && 'Valor Fixo por Dia Ativo (R$)'}
                            </label>
                            <Input 
                              type="number"
                              step="0.01"
                              value={formRegraValor}
                              onChange={e => setFormRegraValor(e.target.value)}
                              className="rounded-xl h-11 border-border font-extrabold text-sm font-mono"
                              placeholder="0,00"
                            />
                          </div>

                          {/* Eligible categories checkbox grid */}
                          {formRegraTipo !== 'liquido' && (
                            <div className="space-y-2.5 text-left">
                              <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                Categorias Elegíveis para a Regra
                              </label>
                              <p className="text-[10px] sm:text-[11px] text-muted-foreground">Selecione as categorias de receitas que disparam esse cálculo:</p>
                              <div className="grid grid-cols-2 gap-2">
                                {incomeCategories.map(cat => {
                                  const isChecked = formRegraCats.includes(cat);
                                  return (
                                    <button
                                      key={cat}
                                      type="button"
                                      onClick={() => toggleCategory(cat)}
                                      className={`py-2.5 px-3 rounded-xl border text-left text-xs truncate flex items-center justify-between transition-colors cursor-pointer ${
                                        isChecked 
                                          ? 'bg-indigo-600/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-extrabold' 
                                          : 'bg-card border-border hover:bg-muted text-muted-foreground'
                                      }`}
                                    >
                                      <span>{cat}</span>
                                      {isChecked && <Check className="w-3.5 h-3.5 min-w-[14px] text-indigo-600 dark:text-indigo-400 stroke-[3.5px]" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="p-4 border-t border-border bg-muted/20 flex gap-3 pb-8 sm:pb-4 shrink-0">
              <Button 
                variant="ghost" 
                className="flex-1 text-xs h-11 rounded-xl font-bold cursor-pointer" 
                onClick={() => { setShowCreateModal(false); clearForm(); }}
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1 text-xs h-11 font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/10 cursor-pointer" 
                onClick={handleCreate} 
                disabled={isCreating}
              >
                {isCreating ? 'Criando...' : 'Criar Reserva'}
              </Button>
            </footer>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* DIALOG: EDIT RESERVE / CONFIG MODAL */}
      {/* ==================================================== */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all">
          <div className="bg-card border-t sm:border border-border rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200">
            <header className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Settings2 className="w-5 h-5 stroke-[2.5px]" />
                </div>
                <h2 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">Configurar Reserva</h2>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground cursor-pointer shrink-0" 
                onClick={() => setShowConfigModal(null)}
              >
                <X className="w-4.5 h-4.5" />
              </Button>
            </header>

            {/* Elegant Tab Switchers */}
            <div className="flex border-b border-border bg-muted/10 p-1.5 gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setModalTab('general')}
                className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  modalTab === 'general'
                    ? 'bg-card text-primary shadow-xs border border-border/40 font-black'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-extrabold'
                }`}
              >
                <Sliders className="w-4 h-4" />
                Cadastro Geral
              </button>
              <button
                type="button"
                onClick={() => setModalTab('automation')}
                className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  modalTab === 'automation'
                    ? 'bg-card text-primary shadow-xs border border-border/40 font-black'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-extrabold'
                }`}
              >
                <Settings2 className="w-4 h-4" />
                Regras de Cálculo {formRegraAtiva && formRegraTipo && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />}
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 pb-8 sm:pb-5">
              
              {/* Real-time Card Live Preview */}
              <div className="bg-muted/15 p-3.5 rounded-2xl border border-border/70 space-y-2">
                <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider block text-left">Visualização em Tempo Real</span>
                <div 
                  className="overflow-hidden transition-all duration-300 border border-border/70 rounded-2xl bg-card shadow-2xs"
                  style={{ borderLeft: `5px solid ${formColor || '#f59e0b'}` }}
                >
                  <div className="p-4 flex justify-between items-center select-none">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 font-bold shadow-xs"
                        style={{ backgroundColor: formColor || '#f59e0b' }}
                      >
                        <ReserveIcon name={formIcon || 'PiggyBank'} className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <h4 className="font-extrabold text-sm text-foreground tracking-tight truncate max-w-[140px] sm:max-w-[200px]">
                          {formName.trim() || 'Reserva de Exemplo'}
                        </h4>
                        <span className="text-[11px] text-muted-foreground truncate block font-semibold mt-0.5">
                          {formStatus === 'inactive' ? '🔴 Finalizada/Arquivada' : formRegraAtiva && formRegraTipo ? `Automática: ${formRegraTipo === 'km' ? 'por Km' : formRegraTipo === 'bruto' ? 's/ Bruto' : formRegraTipo === 'liquido' ? 's/ Líquido' : 'Fixo por Dia'}` : 'Aportes Manuais'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider block leading-none mb-1">Saldo</span>
                      <span className="text-xs sm:text-sm font-black font-mono text-foreground bg-muted/70 px-2.5 py-1 rounded-lg border border-border/50">
                        {formatCurrency(Number(formSaldoInicial) || 0)}
                      </span>
                    </div>
                  </div>

                  {formMetaObjetivo && Number(formMetaObjetivo) > 0 && (
                    <div className="border-t border-dashed border-border/70 px-4 pb-4 pt-3 space-y-2">
                      <div className="bg-muted/15 p-3 rounded-xl border border-border/40 space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-muted-foreground uppercase tracking-wider">Progresso da Meta Global</span>
                          <span className="text-foreground bg-card border border-border/40 px-2 py-0.5 rounded-md font-mono">
                            {formatCurrency(Number(formSaldoInicial) || 0)} / {formatCurrency(Number(formMetaObjetivo))}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden relative shadow-inner">
                          <div 
                            className="h-full rounded-full transition-all duration-500 ease-out shadow-xs" 
                            style={{ 
                              width: `${Math.min(100, Math.max(0, ((Number(formSaldoInicial) || 0) / Number(formMetaObjetivo)) * 100))}%`,
                              backgroundColor: formColor || '#f59e0b' 
                            }} 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {modalTab === 'general' ? (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Name field */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Nome da Reserva</label>
                    <Input 
                      placeholder="Ex: IPVA do Veículo, Troca de pneus..."
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="rounded-xl h-11 border-border focus:ring-2 focus:ring-primary/20 font-medium text-sm"
                    />
                  </div>

                  {/* Desc field */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Descrição (Opcional)</label>
                    <Input 
                      placeholder="Finalidade ou detalhes desta reserva"
                      value={formDesc}
                      onChange={e => setFormDesc(e.target.value)}
                      className="rounded-xl h-11 border-border font-medium text-sm"
                    />
                  </div>

                  {/* Meta & Balance fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Meta Total (R$)</label>
                      <CurrencyInput 
                        placeholder="Sem meta limite"
                        value={formMetaObjetivo}
                        onChange={setFormMetaObjetivo}
                      />
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Saldo Atual Base (R$)</label>
                      <CurrencyInput 
                        placeholder="0,00"
                        value={formSaldoInicial}
                        onChange={setFormSaldoInicial}
                      />
                    </div>
                  </div>

                  {/* Status Selection */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Status da Reserva</label>
                    <Select value={formStatus} onValueChange={(val: any) => setFormStatus(val)}>
                      <SelectTrigger className="h-11 rounded-xl font-medium text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">🟢 Ativa (Exibe nos cálculos e painel)</SelectItem>
                        <SelectItem value="inactive">🔴 Finalizada/Arquivada (Garante integridade histórica)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-relaxed mt-1 text-left bg-muted/20 p-2.5 rounded-lg border border-border/40">
                      💡 <strong>Dica:</strong> Em vez de excluir, mude o status para "Finalizada/Arquivada". Isso mantém suas movimentações financeiras salvas no histórico do caixa, ocultando a reserva do painel ativo.
                    </p>
                  </div>

                  {/* Presets icons */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Ícone de Destaque</label>
                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 bg-muted/10 p-2.5 rounded-2xl border border-border/50">
                      {Object.keys(iconOptions).map(icoKey => {
                        const TargetIcon = iconOptions[icoKey as keyof typeof iconOptions];
                        const isSelected = formIcon === icoKey;
                        return (
                          <button
                            key={icoKey}
                            type="button"
                            onClick={() => setFormIcon(icoKey)}
                            className={`p-3 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-primary text-primary-foreground border-primary scale-105 shadow-md shadow-primary/10' 
                                : 'bg-card hover:bg-muted border-border hover:scale-105'
                            }`}
                            title={icoKey}
                          >
                            <TargetIcon className="w-5 h-5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Presets colors */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Cor Temática</label>
                    <div className="flex flex-wrap gap-2.5 bg-muted/10 p-2.5 rounded-2xl border border-border/50">
                      {colorPresets.map(col => {
                        const isSelected = formColor === col.hex;
                        return (
                          <button
                            key={col.hex}
                            type="button"
                            onClick={() => setFormColor(col.hex)}
                            className="w-8.5 h-8.5 rounded-full border-2 transition-all flex items-center justify-center relative hover:scale-110 cursor-pointer"
                            style={{ 
                              backgroundColor: col.hex,
                              borderColor: isSelected ? '#fff' : 'transparent',
                              boxShadow: isSelected ? '0 0 0 2.5px ' + col.hex : 'none'
                            }}
                            title={col.name}
                          >
                            {isSelected && <Check className="w-4 h-4 text-white stroke-[3.5px]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Uso Configuration */}
                  <div className="border border-border/60 rounded-2xl bg-muted/15 p-4 space-y-3.5 text-left">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <label className="text-xs font-extrabold text-foreground">Exigir Categoria no Resgate?</label>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground">Se ativo, cada retirada exige classificação manual. Se inativo, assume a categoria padrão.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormRequireCategoryOnUse(!formRequireCategoryOnUse)}
                        className={`text-xs px-3.5 py-2 rounded-xl font-bold border transition-all cursor-pointer shrink-0 ${
                          formRequireCategoryOnUse 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' 
                            : 'bg-card hover:bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {formRequireCategoryOnUse ? 'Sim, Exigir' : 'Fixar Categoria'}
                      </button>
                    </div>
                    {!formRequireCategoryOnUse && (
                      <div className="space-y-1.5 pt-3 border-t border-dashed border-border/50">
                        <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase">Categoria Padrão do Gasto</label>
                        <Select value={formDefaultUseCategory} onValueChange={setFormDefaultUseCategory}>
                          <SelectTrigger className="h-11 rounded-xl text-sm font-medium">
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-150 text-left">
                  {/* Rule Active Switch */}
                  <div className="flex items-center justify-between bg-emerald-500/[0.04] p-4 rounded-2xl border border-emerald-500/15">
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs sm:text-sm font-black text-foreground">Ativar Regra de Cálculo Automático</p>
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground">Calcula depósitos recomendados automaticamente a cada corrida/receita cadastrada.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormRegraAtiva(!formRegraAtiva)}
                      className={`text-xs px-4 py-2.5 rounded-xl font-black border transition-all cursor-pointer shrink-0 ${
                        formRegraAtiva 
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/10' 
                          : 'bg-card hover:bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      {formRegraAtiva ? 'Regra Ativa' : 'Ignorar Regra'}
                    </button>
                  </div>

                  {formRegraAtiva && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                      <div className="space-y-2">
                        <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Método de Cálculo</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {ruleOptions.map((opt) => {
                            const isSelected = formRegraTipo === opt.id;
                            const OptIcon = opt.icon;
                            return (
                              <button
                                key={opt.id === null ? 'null' : opt.id}
                                type="button"
                                onClick={() => {
                                  setFormRegraTipo(opt.id as any);
                                  if (opt.id === null) {
                                    setFormRegraValor('0');
                                  }
                                }}
                                className={`flex items-start text-left p-3.5 rounded-2xl border transition-all duration-200 relative group overflow-hidden cursor-pointer ${
                                  isSelected 
                                    ? 'bg-indigo-600/[0.04] border-indigo-500 text-foreground ring-1 ring-indigo-500/40' 
                                    : 'bg-card border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                                }`}
                              >
                                <div className={`p-2 rounded-lg mr-2.5 shrink-0 transition-colors ${isSelected ? 'bg-indigo-600/10 text-indigo-600' : 'bg-muted text-muted-foreground'}`}>
                                  <OptIcon className="w-4 h-4" />
                                </div>
                                <div className="space-y-1 min-w-0 pr-4">
                                  <p className="text-xs font-extrabold text-foreground leading-tight">{opt.title}</p>
                                  <p className="text-[10px] leading-relaxed text-muted-foreground whitespace-normal">{opt.description}</p>
                                </div>
                                {isSelected && (
                                  <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm">
                                    <Check className="w-2.5 h-2.5 stroke-[3px]" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {formRegraTipo && (
                        <div className="bg-muted/20 p-4 rounded-2xl border border-border space-y-4">
                          {/* Dynamic value input based on chosen method */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              {formRegraTipo === 'km' && 'Valor por Km Rodado (R$)'}
                              {formRegraTipo === 'bruto' && 'Percentual sobre Ganhos (%)'}
                              {formRegraTipo === 'liquido' && 'Percentual sobre o Lucro Líquido (%)'}
                              {formRegraTipo === 'fixo' && 'Valor Fixo por Dia Ativo (R$)'}
                            </label>
                            <Input 
                              type="number"
                              step="0.01"
                              value={formRegraValor}
                              onChange={e => setFormRegraValor(e.target.value)}
                              className="rounded-xl h-11 border-border font-extrabold text-sm font-mono"
                              placeholder="0,00"
                            />
                          </div>

                          {/* Eligible categories checkbox grid */}
                          {formRegraTipo !== 'liquido' && (
                            <div className="space-y-2.5 text-left">
                              <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                Categorias Elegíveis para a Regra
                              </label>
                              <p className="text-[10px] sm:text-[11px] text-muted-foreground">Selecione as categorias de receitas que disparam esse cálculo:</p>
                              <div className="grid grid-cols-2 gap-2">
                                {incomeCategories.map(cat => {
                                  const isChecked = formRegraCats.includes(cat);
                                  return (
                                    <button
                                      key={cat}
                                      type="button"
                                      onClick={() => toggleCategory(cat)}
                                      className={`py-2.5 px-3 rounded-xl border text-left text-xs truncate flex items-center justify-between transition-colors cursor-pointer ${
                                        isChecked 
                                          ? 'bg-indigo-600/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-extrabold' 
                                          : 'bg-card border-border hover:bg-muted text-muted-foreground'
                                      }`}
                                    >
                                      <span>{cat}</span>
                                      {isChecked && <Check className="w-3.5 h-3.5 min-w-[14px] text-indigo-600 dark:text-indigo-400 stroke-[3.5px]" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="p-4 border-t border-border bg-muted/20 flex gap-2.5 pb-8 sm:pb-4 shrink-0">
              <Button 
                variant="ghost" 
                className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 h-11 px-3.5 rounded-xl font-bold cursor-pointer transition-colors"
                onClick={() => handleDelete(showConfigModal.id)}
              >
                <Trash2 className="w-4 h-4" /> Excluir
              </Button>
              <Button 
                variant="ghost" 
                className="text-xs h-11 px-4 rounded-xl font-bold cursor-pointer" 
                onClick={() => setShowConfigModal(null)}
              >
                Voltar
              </Button>
              <Button 
                className="flex-1 text-xs h-11 font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/10 cursor-pointer" 
                onClick={handleEdit} 
                disabled={isEditing}
              >
                {isEditing ? 'Gravando...' : 'Gravar Configuração'}
              </Button>
            </footer>
          </div>
        </div>
      )}
      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative bg-card border border-rose-500/30 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-3.5">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">Excluir Reserva Permanentemente?</h3>
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-left space-y-2 text-xs text-rose-700 dark:text-rose-300">
                <p className="font-bold flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  ⚠️ Ação destrutiva e irreversível:
                </p>
                <p>• Esta reserva e <strong>todas as suas movimentações históricas</strong> serão removidas definitivamente do banco de dados.</p>
                <p className="pt-1 text-[11px] text-muted-foreground border-t border-rose-500/20">
                  💡 <strong>Recomendação:</strong> Se deseja apenas parar de usar a reserva e manter o histórico financeiro intacto, cancele e use a opção <strong>"Finalizar Reserva"</strong> no card.
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-border bg-muted/20 flex gap-2">
              <Button variant="ghost" className="flex-1 text-xs h-10" onClick={() => setDeleteConfirmId(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-10" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir Definitivamente'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TRANSACTION MODAL */}
      {editingRt && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            <header className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-md">Editar Movimentação</h2>
              </div>
              <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full" onClick={() => setEditingRt(null)}>
                <X className="w-4 h-4" />
              </Button>
            </header>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {(() => {
                const selectedReserve = reserves.find(r => r.id === editRtReserveId);
                return (
                  <>
                    {/* Type toggle */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Tipo de Registro</label>
                      <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setEditRtType('aporte')}
                          className={`py-2 text-xs font-semibold rounded-md transition-all ${
                            editRtType === 'aporte' 
                              ? 'bg-white dark:bg-zinc-950 shadow text-emerald-600 font-extrabold' 
                              : 'text-muted-foreground'
                          }`}
                        >
                          Aporte (Entrada)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditRtType('utilizacao')}
                          className={`py-2 text-xs font-semibold rounded-md transition-all ${
                            editRtType === 'utilizacao' 
                              ? 'bg-white dark:bg-zinc-950 shadow text-rose-500 font-extrabold' 
                              : 'text-muted-foreground'
                          }`}
                        >
                          Resgate (Saída)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditRtType('rendimento')}
                          className={`py-2 text-xs font-semibold rounded-md transition-all ${
                            editRtType === 'rendimento' 
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
                        {reserves.map(r => {
                          const isSelected = editRtReserveId === r.id;
                          const Icon = iconOptions[r.icon as keyof typeof iconOptions] || PiggyBank;
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                setEditRtReserveId(r.id);
                                if (r.require_category_on_use === false) {
                                  setEditRtCategory(r.default_use_category || r.name);
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
                      {!editRtReserveId && <p className="text-[10px] text-rose-500 font-semibold px-1">Por favor, selecione uma reserva para continuar.</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Amount */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Valor (R$)</label>
                        <Input 
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={editRtAmount}
                          onChange={e => setEditRtAmount(e.target.value)}
                          className="rounded-lg"
                        />
                      </div>

                      {/* Date */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Data</label>
                        <Input 
                          type="date"
                          value={editRtDate}
                          onChange={e => setEditRtDate(e.target.value)}
                          className="rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Category (only for utilization) */}
                    {editRtType === 'utilizacao' && (!selectedReserve || selectedReserve.require_category_on_use !== false) && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Categoria do Gasto</label>
                        <Select value={editRtCategory || 'null'} onValueChange={val => setEditRtCategory(val === 'null' ? '' : val)}>
                          <SelectTrigger className="border-border rounded-lg">
                            <SelectValue placeholder="Sem categoria específica" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="null">Nenhuma</SelectItem>
                            {expenseCategories.map(cat => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {editRtType === 'utilizacao' && selectedReserve && selectedReserve.require_category_on_use === false && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Categoria (Padrão Obrigatória)</label>
                        <Input value={selectedReserve.default_use_category || selectedReserve.name} disabled className="rounded-lg bg-muted text-muted-foreground font-semibold" />
                      </div>
                    )}

                    {/* Description */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Descrição (Opcional)</label>
                      <Input 
                        placeholder="Ex: Compra de pneu traseiro, Combustível..."
                        value={editRtDescription}
                        onChange={e => setEditRtDescription(e.target.value)}
                        className="rounded-lg"
                      />
                    </div>
                  </>
                );
              })()}
            </div>

            <footer className="p-4 border-t border-border bg-muted/20 flex gap-3">
              <Button variant="ghost" className="flex-1 text-xs rounded-lg" onClick={() => setEditingRt(null)}>
                Cancelar
              </Button>
              <Button className="flex-1 text-xs rounded-lg" onClick={handleSaveEditRt} disabled={isSavingEditRt}>
                {isSavingEditRt ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </footer>
          </div>
        </div>
      )}

      {/* EDIT RULE HISTORY MODAL */}
      {editingRuleHist && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            <header className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-md">
                  Editar {editingRuleHist.historyIndex === -1 ? 'Regra de Cálculo Vigente' : 'Histórico de Regra de Cálculo'}
                </h2>
              </div>
              <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full" onClick={() => setEditingRuleHist(null)}>
                <X className="w-4 h-4" />
              </Button>
            </header>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              
              {/* Active Toggle */}
              <div className="flex items-center justify-between bg-muted/35 p-3 rounded-xl border border-border">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">Status da Regra neste Período</p>
                  <p className="text-[10px] text-muted-foreground">Define se o cálculo de aportes deve rodar para esta regra</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRuleHist(prev => prev ? { ...prev, regra_ativa: !prev.regra_ativa } : null)}
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${editingRuleHist.regra_ativa ? 'bg-primary/10 border-primary text-primary' : 'bg-muted text-muted-foreground border-border'}`}
                >
                  {editingRuleHist.regra_ativa ? 'Regra Ativa' : 'Ignorar Regra'}
                </button>
              </div>

              {editingRuleHist.regra_ativa && (
                <>
                  {/* Calculation Method */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Método de Cálculo</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {ruleOptions.map((opt) => {
                        const isSelected = editingRuleHist.regra_tipo === opt.id;
                        const OptIcon = opt.icon;
                        return (
                          <button
                            key={opt.id === null ? 'null' : opt.id}
                            type="button"
                            onClick={() => {
                              setEditingRuleHist(prev => {
                                if (!prev) return null;
                                return {
                                  ...prev,
                                  regra_tipo: opt.id as any,
                                  regra_valor: opt.id === null ? '0' : prev.regra_valor,
                                };
                              });
                            }}
                            className={`flex items-start text-left p-3 rounded-xl border transition-all duration-200 relative group overflow-hidden ${
                              isSelected 
                                ? 'bg-primary/5 border-primary text-foreground ring-1 ring-primary/50' 
                                : 'bg-card border-border/85 text-muted-foreground hover:bg-muted/40 hover:border-border hover:text-foreground'
                            }`}
                          >
                            <div className={`p-2 rounded-lg mr-2.5 shrink-0 transition-colors ${isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground group-hover:text-foreground'}`}>
                              <OptIcon className="w-4 h-4" />
                            </div>
                            <div className="space-y-1 min-w-0 pr-4">
                              <p className="text-xs font-bold text-foreground leading-tight">{opt.title}</p>
                              <p className="text-[10px] leading-relaxed text-muted-foreground whitespace-normal">{opt.description}</p>
                            </div>
                            {isSelected && (
                              <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm">
                                <Check className="w-2.5 h-2.5 stroke-[3px]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {editingRuleHist.regra_tipo && (
                    <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-3.5">
                      
                      {/* Dynamic Rule Value */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">
                          {editingRuleHist.regra_tipo === 'km' && 'Valor por Km Rodado (R$)'}
                          {editingRuleHist.regra_tipo === 'bruto' && 'Percentual sobre Ganhos (%)'}
                          {editingRuleHist.regra_tipo === 'liquido' && 'Percentual sobre o Líquido (%)'}
                          {editingRuleHist.regra_tipo === 'fixo' && 'Valor Fixo por Dia Ativo (R$)'}
                        </label>
                        <Input 
                          type="number"
                          step="0.01"
                          value={editingRuleHist.regra_valor}
                          onChange={e => setEditingRuleHist(prev => prev ? { ...prev, regra_valor: e.target.value } : null)}
                        />
                      </div>

                      {/* Categories list */}
                      {editingRuleHist.regra_tipo !== 'liquido' && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                            Categorias Elegíveis
                          </label>
                          <p className="text-[10px] text-muted-foreground mb-1">Selecione quais categorias acionam esta sugestão:</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {incomeCategories.map(cat => {
                              const isChecked = editingRuleHist.regra_categorias.includes(cat);
                              return (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => {
                                    setEditingRuleHist(prev => {
                                      if (!prev) return null;
                                      const isChecked = prev.regra_categorias.includes(cat);
                                      const newCats = isChecked
                                        ? prev.regra_categorias.filter(c => c !== cat)
                                        : [...prev.regra_categorias, cat];
                                      return { ...prev, regra_categorias: newCats };
                                    });
                                  }}
                                  className={`py-1.5 px-2 rounded-md border text-left text-[11px] truncate flex items-center justify-between transition-colors ${isChecked ? 'bg-primary/10 border-primary text-primary font-medium' : 'bg-card border-border hover:bg-muted text-muted-foreground'}`}
                                >
                                  <span>{cat}</span>
                                  {isChecked && <Check className="w-3.5 h-3.5 min-w-[14px]" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Start & End Dates editing */}
              <div className="bg-muted/20 p-4 rounded-lg border border-border/80 space-y-3">
                <p className="text-xs font-bold text-foreground uppercase tracking-wider">Período de Validade (Ajuste Temporal)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Início da Validade</label>
                    <Input 
                      type="date"
                      value={editingRuleHist.start_date}
                      onChange={e => setEditingRuleHist(prev => prev ? { ...prev, start_date: e.target.value } : null)}
                    />
                  </div>

                  {editingRuleHist.historyIndex !== -1 && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">Fim da Validade</label>
                      <Input 
                        type="date"
                        value={editingRuleHist.end_date || ''}
                        onChange={e => setEditingRuleHist(prev => prev ? { ...prev, end_date: e.target.value || undefined } : null)}
                      />
                    </div>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground leading-relaxed">
                  O início e o fim da validade determinam qual regra de cálculo automático era ou é considerada válida ao calcular novos aportes com base em lançamentos de datas passadas.
                </p>
              </div>

            </div>

            <footer className="p-4 border-t border-border bg-muted/20 flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 text-xs rounded-lg" 
                onClick={() => setEditingRuleHist(null)}
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1 text-xs rounded-lg" 
                onClick={handleSaveEditRuleHist}
                disabled={isSavingEditRuleHist}
              >
                {isSavingEditRuleHist ? 'Salvando...' : 'Salvar Regra'}
              </Button>
            </footer>
          </div>
        </div>
      )}

      {/* TRANSACTION DELETE CONFIRMATION MODAL */}
      {rtToDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative bg-card border border-border shadow-lg rounded-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold tracking-tight">Excluir Movimentação?</h3>
              <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
                <p>
                  Tem certeza de que deseja apagar o {rtToDeleteConfirm.type === 'aporte' ? 'aporte' : 'resgate'} de{' '}
                  <span className="font-bold text-foreground font-mono">{formatCurrency(rtToDeleteConfirm.amount)}</span> na reserva{' '}
                  <span className="font-bold text-foreground">{rtToDeleteConfirm.reserveName}</span>?
                </p>
                {rtToDeleteConfirm.description && (
                  <p className="text-xs bg-muted p-2 rounded-lg italic">
                    "{rtToDeleteConfirm.description}"
                  </p>
                )}
                {rtToDeleteConfirm.linked_investment_id && (
                  <p className="text-xs text-rose-500 font-bold bg-rose-500/10 p-2 rounded-lg">
                    Aviso: Esta movimentação está vinculada a um lançamento de investimento. Excluir esta movimentação também excluirá o investimento relacionado!
                  </p>
                )}
                <p className="text-xs text-rose-500/90 font-medium">
                  Isso recalculará o saldo atual da reserva automaticamente.
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-border bg-muted/20 flex gap-2">
              <Button variant="ghost" className="flex-1 text-xs h-10" onClick={() => setRtToDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-xs h-10" onClick={confirmDeleteRt}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RULE HISTORY DELETE CONFIRMATION MODAL */}
      {ruleHistToDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative bg-card border border-border shadow-lg rounded-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold tracking-tight">
                {ruleHistToDeleteConfirm.historyIndex === -1 ? 'Excluir Regra Vigente?' : 'Excluir Histórico de Regra?'}
              </h3>
              <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
                <p>
                  {ruleHistToDeleteConfirm.historyIndex === -1 ? (
                    <>
                      Tem certeza de que deseja excluir a regra de cálculo vigente da reserva{' '}
                      <span className="font-bold text-foreground">{ruleHistToDeleteConfirm.reserveName}</span>? A regra imediatamente anterior registrada no histórico voltará a ser a regra ativa.
                    </>
                  ) : (
                    <>
                      Tem certeza de que deseja excluir permanentemente esta regra de cálculo anterior da reserva{' '}
                      <span className="font-bold text-foreground">{ruleHistToDeleteConfirm.reserveName}</span>?
                    </>
                  )}
                </p>
                <div className="text-xs bg-muted p-3 rounded-lg text-left space-y-1">
                  <p>• <strong>Regra:</strong> {ruleHistToDeleteConfirm.ruleType}</p>
                  <p>• <strong>Valor:</strong> {ruleHistToDeleteConfirm.amount ? (ruleHistToDeleteConfirm.ruleType.includes('Percentual') ? `${ruleHistToDeleteConfirm.amount}%` : formatCurrency(ruleHistToDeleteConfirm.amount)) : 'Manual'}</p>
                </div>
                <p className="text-xs text-rose-500/90 font-medium">
                  {ruleHistToDeleteConfirm.historyIndex === -1
                    ? 'Esta ação reverterá a regra vigente para a regra imediatamente anterior cadastrada no histórico.'
                    : 'Isso estenderá a validade do período anterior ou removerá este registro de alteração de forma definitiva.'
                  }
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-border bg-muted/20 flex gap-2">
              <Button variant="ghost" className="flex-1 text-xs h-10" onClick={() => setRuleHistToDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-xs h-10" onClick={confirmDeleteRuleHist}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE BALANCE MODAL */}
      {showUpdateBalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative bg-card border border-border shadow-lg rounded-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold tracking-tight">Atualizar Saldo</h3>
                <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full" onClick={() => setShowUpdateBalanceModal(null)}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">Saldo Atual na Plataforma:</p>
                  <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(showUpdateBalanceModal.saldo_atual || 0)}</p>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {updateBalanceDesc === 'Rendimento' ? 'Saldo na Conta / Caixinha' : 'Valor da Venda (Soma ao Saldo)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="pl-9 h-11 text-lg font-bold rounded-lg border-border focus-visible:ring-indigo-500 font-mono"
                      placeholder="0.00"
                      value={updateBalanceAmount}
                      onChange={(e) => setUpdateBalanceAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Motivo</label>
                  <select
                    className="w-full bg-background border border-input rounded-md h-11 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={updateBalanceDesc}
                    onChange={(e) => setUpdateBalanceDesc(e.target.value)}
                  >
                    <option value="Rendimento">Rendimentos</option>
                    <option value="VendaAtivo">Venda de Ativos</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-border bg-muted/20 flex gap-2">
              <Button variant="ghost" className="flex-1 text-xs h-10" onClick={() => setShowUpdateBalanceModal(null)}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-10 font-bold" onClick={handleUpdateBalance} disabled={isUpdatingBalance}>
                {isUpdatingBalance ? 'Atualizando...' : 'Atualizar Saldo'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* FINALIZE CONFIRMATION MODAL */}
      {showFinalizeConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowFinalizeConfirmModal(null)} />
          <div className="relative bg-card border border-border shadow-xl rounded-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto">
                <Archive className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">Finalizar Reserva "{showFinalizeConfirmModal.name}"?</h3>
              <div className="text-xs text-muted-foreground leading-relaxed text-left bg-muted/40 p-3.5 rounded-xl border border-border/60 space-y-2">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> O que acontece ao finalizar:
                </p>
                <p>• A reserva será marcada como inativa e pausará cálculos automáticos.</p>
                <p>• O saldo atual de <strong className="text-foreground">{formatCurrency(showFinalizeConfirmModal.saldo_atual || 0)}</strong> e todo o histórico de lançamentos serão <strong className="text-emerald-600 font-semibold">integralmente preservados</strong>.</p>
                <p>• Você poderá visualizar e reativar esta reserva a qualquer momento na aba <strong>"Finalizadas"</strong>.</p>
              </div>
            </div>
            <div className="p-4 border-t border-border bg-muted/20 flex gap-2">
              <Button variant="ghost" className="flex-1 text-xs h-10" onClick={() => setShowFinalizeConfirmModal(null)}>
                Cancelar
              </Button>
              <Button 
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 shadow-sm" 
                onClick={async () => {
                  const target = showFinalizeConfirmModal;
                  setShowFinalizeConfirmModal(null);
                  await handleFinalizeReserve(target);
                }}
              >
                Sim, Finalizar Reserva
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RULE HISTORY TIMELINE AUDIT MODAL */}
      {showRuleHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowRuleHistoryModal(null)} />
          <div className="relative bg-card border border-border shadow-xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <header className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-md text-foreground">Histórico de Regras: {showRuleHistoryModal.name}</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <Button 
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-8 gap-1 shadow-xs"
                  onClick={() => {
                    const target = showRuleHistoryModal;
                    setShowRuleHistoryModal(null);
                    handleOpenEdit(target);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Nova Regra
                </Button>
                <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full" onClick={() => setShowRuleHistoryModal(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </header>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Active Rule Card */}
              <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-2 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                    Regra Vigente (Atual)
                  </span>
                  <span className="text-xs font-mono font-bold text-muted-foreground">
                    {showRuleHistoryModal.regra_inicio_validade 
                      ? `Início: ${new Date(showRuleHistoryModal.regra_inicio_validade).toLocaleDateString('pt-BR')}`
                      : 'Desde a criação'}
                  </span>
                </div>
                <p className="text-xs font-bold text-foreground">
                  {showRuleHistoryModal.regra_tipo === 'km' && `Por Km Rodado: R$ ${formatRuleValue(showRuleHistoryModal.regra_valor)}/km`}
                  {showRuleHistoryModal.regra_tipo === 'bruto' && `Percentual sobre Bruto: ${formatRuleValue(showRuleHistoryModal.regra_valor)}%`}
                  {showRuleHistoryModal.regra_tipo === 'liquido' && `Percentual sobre Líquido: ${formatRuleValue(showRuleHistoryModal.regra_valor)}%`}
                  {showRuleHistoryModal.regra_tipo === 'fixo' && `Fixo por Dia Ativo: R$ ${formatRuleValue(showRuleHistoryModal.regra_valor)}/dia`}
                  {!showRuleHistoryModal.regra_tipo && 'Aporte Manual'}
                </p>
                {showRuleHistoryModal.regra_categorias && showRuleHistoryModal.regra_categorias.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Categorias acionadoras: <span className="font-semibold text-foreground">{showRuleHistoryModal.regra_categorias.join(', ')}</span>
                  </p>
                )}
              </div>

              {/* Historical Rules Timeline */}
              <div className="space-y-2.5 text-left">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Evolução do Histórico de Regras</h4>
                {(!showRuleHistoryModal.rule_history || showRuleHistoryModal.rule_history.length === 0) ? (
                  <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/80">
                    Nenhuma alteração de regra anterior registrada para esta reserva.
                  </div>
                ) : (
                  showRuleHistoryModal.rule_history.map((hist, idx) => (
                    <div key={idx} className="p-3 bg-muted/30 border border-border/60 rounded-xl space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          Versão Anterior #{idx + 1}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {hist.start_date ? new Date(hist.start_date).toLocaleDateString('pt-BR') : '?'} até {hist.end_date ? new Date(hist.end_date).toLocaleDateString('pt-BR') : '?'}
                        </span>
                      </div>
                      <p className="font-bold text-foreground">
                        {hist.regra_tipo === 'km' && `Por Km Rodado: R$ ${formatRuleValue(hist.regra_valor)}/km`}
                        {hist.regra_tipo === 'bruto' && `Percentual sobre Bruto: ${formatRuleValue(hist.regra_valor)}%`}
                        {hist.regra_tipo === 'liquido' && `Percentual sobre Líquido: ${formatRuleValue(hist.regra_valor)}%`}
                        {hist.regra_tipo === 'fixo' && `Fixo por Dia Ativo: R$ ${formatRuleValue(hist.regra_valor)}/dia`}
                        {!hist.regra_tipo && 'Manual'}
                      </p>
                      {hist.regra_categorias && hist.regra_categorias.length > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          Categorias: {Array.isArray(hist.regra_categorias) ? hist.regra_categorias.join(', ') : String(hist.regra_categorias)}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <footer className="p-4 border-t border-border bg-muted/20 flex justify-between items-center gap-2">
              <Button 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 gap-1.5 shadow-xs"
                onClick={() => {
                  const target = showRuleHistoryModal;
                  setShowRuleHistoryModal(null);
                  handleOpenEdit(target);
                }}
              >
                <Plus className="w-4 h-4" /> Configurar Nova Regra
              </Button>
              <Button variant="ghost" className="text-xs h-9" onClick={() => setShowRuleHistoryModal(null)}>
                Fechar
              </Button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
