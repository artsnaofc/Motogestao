import { 
  PiggyBank, 
  Wrench, 
  ShieldAlert, 
  Car, 
  Coins, 
  Sparkles, 
  Heart, 
  TrendingUp, 
  Briefcase,
  Shield,
  ShieldCheck,
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
  Wallet,
  Zap,
  Tag,
  Building,
  Key,
  Umbrella,
  Smartphone,
  BookOpen
} from 'lucide-react';
import { Reserve, ReserveTransaction, Transaction } from '../../types';
import { 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  startOfYear, 
  endOfYear, 
  subYears, 
  startOfWeek, 
  endOfWeek,
  format
} from 'date-fns';

export const iconOptions: Record<string, any> = {
  PiggyBank,
  Wrench,
  ShieldAlert,
  Car,
  Coins,
  Sparkles,
  Heart,
  TrendingUp,
  Briefcase,
  Shield,
  ShieldCheck,
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
  Wallet,
  Zap,
  Tag,
  Building,
  Key,
  Umbrella,
  Smartphone,
  BookOpen
};

export const COLOR_PALETTE = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#84cc16', // Lime
  '#eab308', // Yellow
  '#f97316', // Orange
  '#ef4444', // Red
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#64748b', // Slate
  '#14b8a6', // Teal
  '#f43f5e', // Rose
];

export const parseLocalDate = (dateStr: string | Date | undefined | null): Date => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  const cleaned = String(dateStr).split('T')[0];
  const [year, month, day] = cleaned.split('-').map(Number);
  if (!year || !month || !day) return new Date(dateStr);
  return new Date(year, month - 1, day);
};

export const formatCurrency = (val: any, ignoreHide = false): string => {
  const num = Number(val);
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(num);
};

export const formatDateDisplay = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '--/--/----';
  try {
    const d = parseLocalDate(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

export interface PeriodOption {
  id: string;
  label: string;
  shortLabel?: string;
  description?: string;
}

export const PERIOD_OPTIONS: PeriodOption[] = [
  { id: 'last30Days', label: '30 dias', shortLabel: '30d', description: 'Últimos 30 dias' },
  { id: 'last90Days', label: '90 dias', shortLabel: '90d', description: 'Últimos 90 dias' },
  { id: 'month', label: 'Mês Atual', shortLabel: 'Mês', description: 'Do dia 1º até o fim do mês' },
  { id: 'lastMonth', label: 'Mês Passado', shortLabel: 'Mês Ant.', description: 'Mês civil anterior completo' },
  { id: 'thisYear', label: 'Este Ano', shortLabel: 'Ano', description: 'De 1º de janeiro até hoje' },
  { id: 'lastYear', label: 'Ano Passado', shortLabel: 'Ano Ant.', description: 'Ano civil anterior completo' },
  { id: 'week', label: 'Esta Semana', shortLabel: 'Semana', description: 'Segunda-feira até domingo' },
  { id: 'all', label: 'Todo o Histórico', shortLabel: 'Todos', description: 'Todos os lançamentos gravados' },
  { id: 'custom', label: 'Personalizado', shortLabel: 'Custom', description: 'Intervalo livre entre datas' }
];

export const getPeriodDisplayLabel = (
  globalPeriod: string,
  customDateRange?: { start: string; end: string } | null
): string => {
  if (globalPeriod === 'custom' && customDateRange?.start && customDateRange?.end) {
    try {
      const startF = formatDateDisplay(customDateRange.start);
      const endF = formatDateDisplay(customDateRange.end);
      return `${startF} - ${endF}`;
    } catch {
      return 'Personalizado';
    }
  }
  const match = PERIOD_OPTIONS.find(p => p.id === globalPeriod);
  if (match) return match.label;
  if (globalPeriod === 'last_month') return 'Mês Passado';
  if (globalPeriod === 'year') return 'Este Ano';
  if (globalPeriod === 'last7Days') return 'Últimos 7 dias';
  if (globalPeriod === 'today') return 'Hoje';
  return 'Período Selecionado';
};

export const isOperationalCategory = (category?: string | null, customOpList?: string[]): boolean => {
  if (!category) return false;
  const lower = category.trim().toLowerCase();
  
  if (customOpList && customOpList.length > 0) {
    if (customOpList.some(c => c.toLowerCase() === lower)) return true;
  }

  // Standard operational defaults and keywords
  const standardOperational = [
    'combustível',
    'combustivel',
    'gasolina',
    'etanol',
    'gnv',
    'abastecimento',
    'pedágio',
    'pedagio',
    'manutenção',
    'manutencao',
    'oficina',
    'mecânica',
    'mecanica',
    'troca de óleo',
    'troca de oleo',
    'pneu',
    'pneus',
    'lava jato',
    'lavagem',
    'ipva',
    'licenciamento',
    'seguro',
    'seguro auto',
    'revisão',
    'revisao',
    'peças',
    'pecas',
    'aluguel de moto',
    'aluguel de carro',
    'depreciação',
    'depreciacao'
  ];

  return standardOperational.includes(lower);
};

export const getActiveRuleForDate = (res: Reserve, dateStr: string) => {
  const historyRules = res.rule_history || [];
  const cleanDate = dateStr.split('T')[0];

  // Check if historical rule applies to this date
  for (let i = 0; i < historyRules.length; i++) {
    const hist = historyRules[i];
    const end = hist.end_date ? hist.end_date.split('T')[0] : null;
    const start = hist.start_date ? hist.start_date.split('T')[0] : null;

    if (end && cleanDate < end) {
      if (!start || cleanDate >= start) {
        return {
          source: 'history' as const,
          index: i,
          regra_ativa: Boolean(hist.regra_ativa),
          regra_tipo: hist.regra_tipo,
          regra_valor: hist.regra_valor,
          regra_categorias: hist.regra_categorias || [],
          start_date: hist.start_date,
          end_date: hist.end_date,
        };
      }
    }
  }

  // Default to current rule in effect
  return {
    source: 'current' as const,
    index: -1,
    regra_ativa: Boolean(res.regra_ativa),
    regra_tipo: res.regra_tipo,
    regra_valor: res.regra_valor,
    regra_categorias: res.regra_categorias || [],
    start_date: res.regra_inicio_validade || res.created_at?.split('T')[0] || cleanDate,
    end_date: null,
  };
};

export const isTxInPeriod = (
  dateStr: string | undefined | null,
  globalPeriod: string,
  customDateRange?: { start: string; end: string } | null
): boolean => {
  if (!dateStr) return false;
  try {
    const d = parseLocalDate(dateStr);
    const now = new Date();

    if (globalPeriod === 'all') return true;

    if (globalPeriod === 'custom') {
      if (!customDateRange || !customDateRange.start || !customDateRange.end) return true;
      const start = startOfDay(parseLocalDate(customDateRange.start));
      const end = endOfDay(parseLocalDate(customDateRange.end));
      return isWithinInterval(d, { start, end });
    }

    if (globalPeriod === 'today') {
      return isWithinInterval(d, { start: startOfDay(now), end: endOfDay(now) });
    }

    if (globalPeriod === 'yesterday') {
      const yest = subDays(now, 1);
      return isWithinInterval(d, { start: startOfDay(yest), end: endOfDay(yest) });
    }

    if (globalPeriod === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return isWithinInterval(d, { start, end });
    }

    if (globalPeriod === 'last7Days') {
      const start = startOfDay(subDays(now, 6));
      const end = endOfDay(now);
      return isWithinInterval(d, { start, end });
    }

    if (globalPeriod === 'last30Days' || globalPeriod === '30days') {
      const start = startOfDay(subDays(now, 29));
      const end = endOfDay(now);
      return isWithinInterval(d, { start, end });
    }

    if (globalPeriod === 'last90Days' || globalPeriod === '90days') {
      const start = startOfDay(subDays(now, 89));
      const end = endOfDay(now);
      return isWithinInterval(d, { start, end });
    }

    if (globalPeriod === 'month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }

    if (globalPeriod === 'lastMonth' || globalPeriod === 'last_month') {
      const lastMonth = subMonths(now, 1);
      return d.getFullYear() === lastMonth.getFullYear() && d.getMonth() === lastMonth.getMonth();
    }

    if (globalPeriod === 'last3Months') {
      const start = startOfDay(subMonths(now, 3));
      const end = endOfDay(now);
      return isWithinInterval(d, { start, end });
    }

    if (globalPeriod === 'thisYear' || globalPeriod === 'year') {
      return d.getFullYear() === now.getFullYear();
    }

    if (globalPeriod === 'lastYear') {
      const lastYear = subYears(now, 1);
      return d.getFullYear() === lastYear.getFullYear();
    }

    // Default fallback to 30 days
    const thirtyDaysAgo = startOfDay(subDays(now, 29));
    return d >= thirtyDaysAgo;
  } catch {
    return false;
  }
};

export const getLatestWithdrawalDate = (
  res: Reserve,
  reserveTransactions: ReserveTransaction[]
): string | null => {
  // Only consider withdrawals (utilizações) that have already been marked as paid/settled
  const utilizacoes = (reserveTransactions || []).filter(
    rt => rt.reserve_id === res.id && 
          rt.type === 'utilizacao' && 
          rt.payment_status !== 'pending' &&
          (rt as any).status !== 'pending'
  );
  if (utilizacoes.length === 0) return null;
  const sorted = [...utilizacoes].sort((a, b) => {
    const dateA = a.payment_date || a.date || '';
    const dateB = b.payment_date || b.date || '';
    return dateB.localeCompare(dateA);
  });
  return sorted[0].payment_date || sorted[0].date;
};

export const calculateSuggestion = (
  res: Reserve,
  transactions: Transaction[],
  reserveTransactions: ReserveTransaction[],
  globalPeriod: string,
  customDateRange: { start: string; end: string }
): number => {
  const roundedBalance = Math.round((res.saldo_atual || 0) * 100) / 100;
  const roundedGoal = Math.round((res.meta_objetivo || 0) * 100) / 100;
  const isGoalReached = Boolean(roundedGoal > 0 && roundedBalance >= roundedGoal);
  const isPaused = res.status === 'inactive' || res.is_paused;

  if (isPaused || isGoalReached) {
    return 0;
  }

  const lastWDate = getLatestWithdrawalDate(res, reserveTransactions);
  const periodTxs = (transactions || []).filter(t => {
    // Ignore pending revenue or expense transactions for contribution suggestions
    if (t.payment_status === 'pending' || (t as any).status === 'pending') return false;
    const inPeriod = isTxInPeriod(t.date, globalPeriod, customDateRange);
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
  
  const buckets = periodTxs.reduce((acc, t) => {
    const ruleInfo = getActiveRuleForDate(res, t.date);
    const ruleKey = ruleInfo.source === 'history' ? `hist_${ruleInfo.index}` : 'current';
    const activeRule = {
      regra_ativa: ruleInfo.regra_ativa && !isPaused && !isGoalReached,
      regra_tipo: ruleInfo.regra_tipo,
      regra_valor: ruleInfo.regra_valor,
      regra_categorias: ruleInfo.regra_categorias,
    };

    if (!acc[ruleKey]) {
      acc[ruleKey] = { rule: activeRule, txs: [] };
    }
    acc[ruleKey].txs.push(t);
    return acc;
  }, {} as Record<string, { rule: any, txs: typeof periodTxs }>);

  Object.values(buckets).forEach((bucket: any) => {
    const { rule, txs } = bucket;
    if (!rule.regra_ativa || !rule.regra_tipo) return;

    const ruleValue = Number(rule.regra_valor) || 0;
    const ruleCats = rule.regra_categorias || [];
    
    if (rule.regra_tipo === 'km') {
      const eligible = txs.filter((t: Transaction) => t.type === 'income' && ruleCats.includes(t.category) && t.start_km !== null && t.end_km !== null);
      eligible.forEach((t: Transaction) => {
        const distance = (Number(t.end_km) || 0) - (Number(t.start_km) || 0);
        if (distance > 0) {
          totalSuggestion += Math.round(distance * ruleValue * 100) / 100;
        }
      });
    } else if (rule.regra_tipo === 'bruto') {
      const eligible = txs.filter((t: Transaction) => t.type === 'income' && ruleCats.includes(t.category));
      const grossSum = eligible.reduce((sum: number, t: Transaction) => sum + Number(t.amount || 0), 0);
      totalSuggestion += Math.round(grossSum * (ruleValue / 100) * 100) / 100;
    } else if (rule.regra_tipo === 'liquido') {
      const totalIncome = txs
        .filter((t: Transaction) => t.type === 'income')
        .reduce((sum: number, t: Transaction) => sum + Number(t.amount || 0), 0);
      const totalExpense = txs
        .filter((t: Transaction) => t.type === 'expense')
        .filter((t: Transaction) => {
          const isReserveUse = (t as any).isReserveTx === true || 
                               t.category === 'Aporte Reserva';
          return !isReserveUse;
        })
        .reduce((sum: number, t: Transaction) => sum + Number(t.amount || 0), 0);
      const netProfit = totalIncome - totalExpense;
      totalSuggestion += Math.round(Math.max(0, netProfit) * (ruleValue / 100) * 100) / 100;
    } else if (rule.regra_tipo === 'fixo') {
      const eligible = txs.filter((t: Transaction) => t.type === 'income' && ruleCats.includes(t.category));
      const uniqueDays = new Set(eligible.map((t: Transaction) => t.date));
      totalSuggestion += Math.round(uniqueDays.size * ruleValue * 100) / 100;
    }
  });

  if (res.meta_objetivo && res.meta_objetivo > 0) {
    if (totalSuggestion > res.meta_objetivo) {
      totalSuggestion = res.meta_objetivo;
    }
  }

  return Math.round(totalSuggestion * 100) / 100;
};

export interface SuggestionAuditResult {
  ruleType: string;
  ruleValue: number;
  categories: string[];
  details: string[];
  totalSuggested: number;
  effectiveAportes: number;
  pendingSuggestion: number;
  txCount: number;
  eligibleTxs: Array<{ id: string; date: string; description: string; category: string; amount: number; km?: number }>;
  lastWithdrawalDate: string | null;
  pendingWithdrawalsIgnored: number;
  grossRevenue: number;
  totalExpense: number;
  netProfit: number;
  totalKm: number;
  workedDays: number;
  formulaExplanation: string;
  isGoalReached: boolean;
  isPaused: boolean;
}

export const getSuggestionAudit = (
  res: Reserve,
  transactions: Transaction[],
  reserveTransactions: ReserveTransaction[],
  globalPeriod: string,
  customDateRange: { start: string; end: string }
): SuggestionAuditResult => {
  const lastWDate = getLatestWithdrawalDate(res, reserveTransactions);
  
  // Count pending withdrawals that were correctly ignored
  const pendingWithdrawalsIgnored = (reserveTransactions || []).filter(
    rt => rt.reserve_id === res.id && 
          rt.type === 'utilizacao' && 
          (rt.payment_status === 'pending' || (rt as any).status === 'pending')
  ).length;

  const periodTxs = (transactions || []).filter(t => {
    if (t.payment_status === 'pending' || (t as any).status === 'pending') return false;
    const inPeriod = isTxInPeriod(t.date, globalPeriod, customDateRange);
    if (!inPeriod) return false;
    const isDefaultRes = res.name === 'Reserva de Manutenção' || res.name === 'Reserva de Emergência';
    if (res.created_at && !isDefaultRes) {
      const creationDay = res.created_at.split('T')[0];
      if (t.date < creationDay) return false;
    }
    if (lastWDate && t.date <= lastWDate) return false;
    return true;
  });

  const roundedBalance = Math.round((res.saldo_atual || 0) * 100) / 100;
  const roundedGoal = Math.round((res.meta_objetivo || 0) * 100) / 100;
  const isGoalReached = Boolean(roundedGoal > 0 && roundedBalance >= roundedGoal);
  const isPaused = res.status === 'inactive' || Boolean(res.is_paused);

  const calculated = calculateSuggestion(res, transactions, reserveTransactions, globalPeriod, customDateRange);
  const effectiveAportes = getEffectiveAportesInPeriod(res, reserveTransactions, globalPeriod, customDateRange);
  const pendingSuggestion = Math.round(Math.max(0, calculated - effectiveAportes) * 100) / 100;

  // Calculate breakdown stats for eligible transactions based on current active rule
  const ruleCats = res.regra_categorias || [];
  let grossRevenue = 0;
  let totalExpense = 0;
  let totalKm = 0;
  const eligibleTxs: Array<{ id: string; date: string; description: string; category: string; amount: number; km?: number }> = [];

  periodTxs.forEach(t => {
    const matchesCategory = ruleCats.length === 0 || ruleCats.includes(t.category);
    const distance = (Number(t.end_km) || 0) - (Number(t.start_km) || 0);
    const validDistance = distance > 0 ? distance : 0;
    
    if (t.type === 'income' && matchesCategory) {
      grossRevenue += Number(t.amount || 0);
      totalKm += validDistance;
      eligibleTxs.push({
        id: t.id,
        date: t.date,
        description: t.description || 'Receita',
        category: t.category,
        amount: Number(t.amount || 0),
        km: validDistance > 0 ? validDistance : undefined,
      });
    } else if (t.type === 'expense') {
      const isReserveUse = (t as any).isReserveTx === true || t.category === 'Aporte Reserva';
      if (!isReserveUse) {
        totalExpense += Number(t.amount || 0);
      }
    }
  });

  const netProfit = Math.max(0, grossRevenue - totalExpense);
  const uniqueDays = new Set(eligibleTxs.map(t => t.date));
  const workedDays = uniqueDays.size;

  let formulaExplanation = '';
  const details: string[] = [];

  if (isPaused) {
    details.push('Reserva está pausada ou inativa no momento.');
    formulaExplanation = 'Cálculo desativado (reserva em pausa).';
  } else if (isGoalReached) {
    details.push(`Meta de ${formatCurrency(res.meta_objetivo || 0)} atingida com sucesso.`);
    formulaExplanation = `Meta atingida: Saldo de ${formatCurrency(roundedBalance)} ≥ Meta de ${formatCurrency(roundedGoal)}.`;
  } else if (res.regra_tipo === 'km') {
    const val = Number(res.regra_valor || 0);
    details.push(`Regra: R$ ${val.toFixed(2)} por KM rodado (${totalKm.toLocaleString('pt-BR')} km apurados).`);
    formulaExplanation = `${totalKm.toLocaleString('pt-BR')} km × R$ ${val.toFixed(2)} = ${formatCurrency(calculated)}`;
  } else if (res.regra_tipo === 'bruto') {
    const val = Number(res.regra_valor || 0);
    details.push(`Regra: ${val}% sobre o faturamento bruto elegível (${formatCurrency(grossRevenue)}).`);
    formulaExplanation = `${formatCurrency(grossRevenue)} (Bruto) × ${val}% = ${formatCurrency(calculated)}`;
  } else if (res.regra_tipo === 'liquido') {
    const val = Number(res.regra_valor || 0);
    details.push(`Regra: ${val}% sobre o lucro líquido do período (${formatCurrency(netProfit)}).`);
    formulaExplanation = `Lucro Líquido (${formatCurrency(grossRevenue)} - ${formatCurrency(totalExpense)} = ${formatCurrency(netProfit)}) × ${val}% = ${formatCurrency(calculated)}`;
  } else if (res.regra_tipo === 'fixo') {
    const val = Number(res.regra_valor || 0);
    details.push(`Regra: R$ ${val.toFixed(2)} fixos por dia trabalhado (${workedDays} dias com receitas).`);
    formulaExplanation = `${workedDays} dia(s) com receita × R$ ${val.toFixed(2)} = ${formatCurrency(calculated)}`;
  } else {
    details.push('Nenhuma regra configurada ou ativa.');
    formulaExplanation = 'Sem regra de cálculo ativa.';
  }

  if (lastWDate) {
    details.push(`Contagem reiniciada após o último resgate pago em ${new Date(lastWDate + 'T00:00:00').toLocaleDateString('pt-BR')}.`);
  }
  if (pendingWithdrawalsIgnored > 0) {
    details.push(`${pendingWithdrawalsIgnored} resgate(s) recorrente(s) pendente(s) foram desconsiderados até a sua quitação.`);
  }

  return {
    ruleType: res.regra_tipo || '',
    ruleValue: Number(res.regra_valor) || 0,
    categories: res.regra_categorias || [],
    details,
    totalSuggested: calculated,
    effectiveAportes,
    pendingSuggestion,
    txCount: eligibleTxs.length,
    eligibleTxs,
    lastWithdrawalDate: lastWDate,
    pendingWithdrawalsIgnored,
    grossRevenue,
    totalExpense,
    netProfit,
    totalKm,
    workedDays,
    formulaExplanation,
    isGoalReached,
    isPaused
  };
};

export const getEffectiveAportesInPeriod = (
  res: Reserve,
  reserveTransactions: ReserveTransaction[],
  globalPeriod: string,
  customDateRange: { start: string; end: string }
): number => {
  const lastWDate = getLatestWithdrawalDate(res, reserveTransactions);
  const total = (reserveTransactions || [])
    .filter(rt => {
      const matches = rt.reserve_id === res.id && 
                      rt.type === 'aporte' && 
                      rt.payment_status !== 'pending' &&
                      (rt as any).status !== 'pending' &&
                      isTxInPeriod(rt.date, globalPeriod, customDateRange) && 
                      rt.category !== 'Aporte Extra' && 
                      rt.category !== 'Rendimento';
      if (!matches) return false;
      if (lastWDate && rt.date <= lastWDate) return false;
      return true;
    })
    .reduce((sum, rt) => sum + Number(rt.amount || 0), 0);
  return Math.round(total * 100) / 100;
};

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'yearly';

export const calculateNextOccurrence = (baseDateStr: string, frequency: RecurrenceFrequency, index: number): string => {
  const parts = baseDateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);

  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + index);
      break;
    case 'weekly':
      d.setDate(d.getDate() + index * 7);
      break;
    case 'biweekly':
      d.setDate(d.getDate() + index * 14);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + index);
      break;
    case 'bimonthly':
      d.setMonth(d.getMonth() + index * 2);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + index * 3);
      break;
    case 'semiannual':
      d.setMonth(d.getMonth() + index * 6);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + index);
      break;
    default:
      d.setMonth(d.getMonth() + index);
      break;
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
};
