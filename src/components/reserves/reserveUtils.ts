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
  BookOpen,
  Bike,
  Truck,
  Bus,
  Navigation,
  Compass,
  MapPin,
  Banknote,
  CreditCard,
  Landmark,
  Gem,
  Crown,
  Trophy,
  Target,
  Rocket,
  Flame,
  Sun,
  Moon,
  Star,
  Music,
  Camera,
  Headphones,
  Gamepad2,
  Dumbbell,
  Utensils,
  ShoppingCart,
  Watch,
  Glasses,
  Pill,
  Baby,
  Dog,
  Globe,
  Anchor,
  Clock,
  Calendar
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
  addDays,
  addMonths,
  differenceInCalendarDays,
  format
} from 'date-fns';

export const iconOptions: Record<string, any> = {
  PiggyBank,
  Wallet,
  Banknote,
  Coins,
  Landmark,
  CreditCard,
  TrendingUp,
  Target,
  Gem,
  Crown,
  Trophy,
  Award,
  Sparkles,
  Rocket,
  Zap,
  Flame,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Umbrella,
  Wrench,
  Hammer,
  Fuel,
  Bike,
  Car,
  Truck,
  Bus,
  Plane,
  Navigation,
  Compass,
  MapPin,
  Globe,
  Anchor,
  Home,
  Building,
  Key,
  Briefcase,
  Laptop,
  Smartphone,
  Watch,
  Camera,
  Headphones,
  Music,
  Gamepad2,
  GraduationCap,
  BookOpen,
  Heart,
  Stethoscope,
  Pill,
  Dumbbell,
  ShoppingBag,
  ShoppingCart,
  Gift,
  Coffee,
  Utensils,
  Tag,
  Glasses,
  Baby,
  Dog,
  Sun,
  Moon,
  Star,
  Clock,
  Calendar
};

export const COLOR_PALETTE = [
  // Azuis & Índigos
  '#6366f1', // Indigo
  '#4f46e5', // Indigo Profundo
  '#3b82f6', // Azul Royal
  '#2563eb', // Azul Cobalto
  '#0ea5e9', // Azul Céu
  '#06b6d4', // Ciano
  '#0891b2', // Ciano Escuro
  // Verdes & Turquesas
  '#14b8a6', // Turquesa (Teal)
  '#0d9488', // Verde Petróleo
  '#10b981', // Esmeralda
  '#059669', // Esmeralda Profundo
  '#22c55e', // Verde Vibrante
  '#84cc16', // Verde Lima
  '#65a30d', // Oliva Vivo
  // Amarelos, Laranjas & Dourados
  '#eab308', // Amarelo Ouro
  '#ca8a04', // Mostarda
  '#f59e0b', // Âmbar
  '#f97316', // Laranja
  '#ea580c', // Laranja Queimado
  '#b45309', // Cobre / Bronze
  // Vermelhos & Rosas
  '#ef4444', // Vermelho
  '#dc2626', // Carmesim
  '#f43f5e', // Coral / Rose
  '#e11d48', // Rubi
  '#ec4899', // Pink
  '#db2777', // Magenta
  // Roxos & Neutros Elegantes
  '#d946ef', // Fúcsia
  '#a855f7', // Roxo
  '#8b5cf6', // Violeta
  '#7c3aed', // Violeta Intenso
  '#64748b', // Ardósia (Slate)
  '#334155', // Grafite
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

export const toDateInputString = (dateVal?: string | null): string => {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (str.includes('T')) {
    return str.split('T')[0];
  }
  if (str.includes(' ')) {
    return str.split(' ')[0];
  }
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 2 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  return str.slice(0, 10);
};

export interface PeriodOption {
  id: string;
  label: string;
  shortLabel?: string;
  description?: string;
}

export const PERIOD_OPTIONS: PeriodOption[] = [
  { id: 'today', label: 'Hoje', shortLabel: 'Hoje', description: 'Somente hoje' },
  { id: 'last7Days', label: '7 dias', shortLabel: '7d', description: 'Últimos 7 dias' },
  { id: 'last30Days', label: '30 dias', shortLabel: '30d', description: 'Últimos 30 dias' },
  { id: 'last90Days', label: '90 dias', shortLabel: '90d', description: 'Últimos 90 dias' },
  { id: 'lastMonth', label: 'Mês Passado', shortLabel: 'Mês Ant.', description: 'Mês civil anterior completo' },
  { id: 'month', label: 'Mês Atual', shortLabel: 'Mês', description: 'Do dia 1º até o fim do mês' },
  { id: 'nextMonth', label: 'Próx. Mês', shortLabel: 'Próx.', description: 'Próximo mês civil completo' },
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
  if (globalPeriod === 'next_month') return 'Próximo Mês';
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
          regra_base: hist.regra_base || res.regra_base,
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
    regra_base: res.regra_base,
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

    if (globalPeriod === 'nextMonth' || globalPeriod === 'next_month') {
      const nextMonth = addMonths(now, 1);
      return d.getFullYear() === nextMonth.getFullYear() && d.getMonth() === nextMonth.getMonth();
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

export const getEffectiveTxDateStr = (t: Pick<Transaction, 'date' | 'payment_status' | 'payment_date'>): string => {
  const raw = t.payment_status === 'paid' && t.payment_date ? t.payment_date : t.date;
  return toDateInputString(raw) || (raw ? String(raw).split('T')[0] : '');
};

export const getLiquidoProfitMode = (res: Pick<Reserve, 'regra_base'>): 'operacional' | 'geral' => {
  return res.regra_base === 'liquido' ? 'geral' : 'operacional';
};

export const buildLinkedReserveTxIdSet = (reserveTransactions?: ReserveTransaction[]): Set<string> => {
  const set = new Set<string>();
  (reserveTransactions || []).forEach(rt => {
    if (rt && rt.transaction_id) {
      set.add(rt.transaction_id);
    }
  });
  return set;
};

export const isReserveOrNonOperatingTx = (
  t: Transaction,
  linkedReserveTxIds?: Set<string>
): boolean => {
  if (!t) return true;
  if (
    t.is_reserve_use === true ||
    (t as any).isReserveUseOriginal === true ||
    (t as any).isReserveTx === true ||
    (t as any).isReserveAporte === true ||
    (t as any).isInvestmentTx === true ||
    (t as any).isDividendTx === true ||
    (t as any).isSaleSettlement === true ||
    (t as any).isTransferToCash === true
  ) {
    return true;
  }

  if (linkedReserveTxIds && t.id && linkedReserveTxIds.has(t.id)) {
    return true;
  }

  const desc = String(t.description || '').trim();
  const rawDesc = String((t as any).rawDescription || '').trim();
  if (desc.startsWith('[Reserva]') || rawDesc.startsWith('[Reserva]')) {
    return true;
  }

  const cat = String(t.category || '').toLowerCase().trim();
  if (
    cat === 'aporte reserva' ||
    cat === 'resgate reserva' ||
    cat === 'resgate de reserva' ||
    cat === 'resgate' ||
    cat === 'transferência p/ caixa' ||
    cat === 'transferencia p/ caixa'
  ) {
    return true;
  }

  return false;
};

export const doesExpenseCountForLiquido = (
  res: Reserve,
  t: Transaction,
  options?: { operationalCategories?: string[]; linkedReserveTxIds?: Set<string> }
): boolean => {
  if (!t || t.type !== 'expense') return false;
  if (t.ignore_in_charts) return false;
  if (isReserveOrNonOperatingTx(t, options?.linkedReserveTxIds)) return false;
  const mode = getLiquidoProfitMode(res);
  if (mode === 'operacional') {
    return isOperationalCategory(t.category, options?.operationalCategories);
  }
  return true;
};

export const getLatestWithdrawalDate = (
  res: Reserve,
  reserveTransactions: ReserveTransaction[]
): string | null => {
  // Na regra de Lucro Líquido, resgates da própria reserva nunca zeram nem reduzem a base de lucro do período
  if (res.regra_tipo === 'liquido') return null;
  // Respeita a configuração da regra que define se resgates devem zerar/reiniciar a sugestão
  if (res.reset_suggestion_on_withdraw === false) return null;
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

/**
 * Returns an ISO cutoff timestamp (ms) when a reserve rule was unpaused, reactivated,
 * or had its goal updated on `ruleStartDate`. Any transaction/aporte on `ruleStartDate`
 * created strictly before this timestamp is excluded so same-day actions don't pull
 * earlier entries back into the suggestion pool.
 */
export const getRuleCutoffTimestamp = (res: Reserve, ruleStartDate: string | null | undefined): number | null => {
  if (!ruleStartDate || !Array.isArray(res.rule_history) || res.rule_history.length === 0) {
    return null;
  }
  let latestMs: number | null = null;
  for (const h of res.rule_history) {
    if (!h || !h.cutoff_at) continue;
    const targetStart = toDateInputString(h.cutoff_rule_start || h.end_date || '');
    if (targetStart && targetStart === ruleStartDate) {
      const parsed = new Date(h.cutoff_at).getTime();
      if (!isNaN(parsed) && (latestMs === null || parsed > latestMs)) {
        latestMs = parsed;
      }
    }
  }
  return latestMs;
};

export const getDefaultBoostValue = (
  regraTipo?: Reserve['regra_tipo'] | string | null,
  boostTipo: 'increment' | 'multiplier' = 'increment'
): number => {
  if (boostTipo === 'multiplier') return 1.5;
  if (regraTipo === 'km') return 0.1;
  if (regraTipo === 'bruto' || regraTipo === 'liquido') return 5;
  if (regraTipo === 'fixo' || regraTipo === 'fixo_diario') return 10;
  return 5;
};

export const isReserveBoostActive = (res: Reserve): boolean => {
  if (!res || res.status === 'inactive' || res.is_paused) return false;
  if (!res.regra_ativa || !res.regra_tipo) return false;
  if (!res.boost_ativo) return false;
  const boostVal = Number(res.boost_valor || 0);
  if ((res.boost_tipo || 'increment') === 'multiplier') {
    return boostVal > 1;
  }
  return boostVal > 0;
};

export const getEffectiveRuleValue = (res: Reserve, ignoreBoost = false): number => {
  const baseVal = Number(res.regra_valor) || 0;
  if (!res.regra_ativa || !res.regra_tipo || baseVal <= 0) return 0;
  if (ignoreBoost || !isReserveBoostActive(res)) {
    return Math.round(baseVal * 10000) / 10000;
  }
  const boostVal = Number(res.boost_valor || 0);
  const boostType = res.boost_tipo || 'increment';
  let effective = boostType === 'multiplier' ? baseVal * boostVal : baseVal + boostVal;
  if (res.regra_tipo === 'bruto' || res.regra_tipo === 'liquido') {
    effective = Math.min(100, effective);
  }
  return Math.max(0, Math.round(effective * 10000) / 10000);
};

export const getRuleBoostDeltaLabel = (res: Reserve): string => {
  const boostVal = Number(res.boost_valor || 0);
  if (boostVal <= 0) return '';
  if ((res.boost_tipo || 'increment') === 'multiplier') {
    return `${Number(boostVal.toFixed(2))}x`;
  }
  if (res.regra_tipo === 'km') {
    return `+R$ ${boostVal.toFixed(2).replace('.', ',')}/km`;
  }
  if (res.regra_tipo === 'bruto' || res.regra_tipo === 'liquido') {
    return `+${Number(boostVal.toFixed(2))}%`;
  }
  if (res.regra_tipo === 'fixo' || (res.regra_tipo as string) === 'fixo_diario') {
    return `+R$ ${boostVal.toFixed(2).replace('.', ',')}/dia`;
  }
  return `+${boostVal}`;
};

export const getBoostExtraFromRt = (rt: ReserveTransaction): number => {
  if (!rt || rt.type !== 'aporte') return 0;
  if (typeof rt.boost_extra === 'number' && !isNaN(rt.boost_extra) && rt.boost_extra > 0) {
    return Math.round(rt.boost_extra * 100) / 100;
  }
  if (rt.description) {
    const brlMatch = rt.description.match(/Boost\s*\+R\$\s*([\d.]+,\d{2})/i);
    if (brlMatch && brlMatch[1]) {
      const parsed = parseFloat(brlMatch[1].replace(/\./g, '').replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) return Math.round(parsed * 100) / 100;
    }
    const rawMatch = rt.description.match(/\[Boost\s*\+([\d.]+)\]/i);
    if (rawMatch && rawMatch[1]) {
      const parsed = parseFloat(rawMatch[1]);
      if (!isNaN(parsed) && parsed > 0) return Math.round(parsed * 100) / 100;
    }
  }
  return 0;
};

export const calculateSuggestion = (
  res: Reserve,
  transactions: Transaction[],
  reserveTransactions: ReserveTransaction[],
  globalPeriod: string,
  customDateRange: { start: string; end: string },
  options?: { ignoreBoost?: boolean; operationalCategories?: string[] }
): number => {
  const roundedBalance = Math.round((res.saldo_atual || 0) * 100) / 100;
  const roundedGoal = Math.round((res.meta_objetivo || 0) * 100) / 100;
  const isGoalReached = Boolean(roundedGoal > 0 && roundedBalance >= roundedGoal);
  const isPaused = res.status === 'inactive' || res.is_paused;

  if (isPaused || isGoalReached || !res.regra_ativa || !res.regra_tipo) {
    return 0;
  }

  const lastWDate = getLatestWithdrawalDate(res, reserveTransactions);
  const cleanLastWDate = lastWDate ? toDateInputString(lastWDate) : null;
  const ruleStartDate = toDateInputString(res.regra_inicio_validade);
  const cutoffMs = getRuleCutoffTimestamp(res, ruleStartDate);
  const linkedRtIds = buildLinkedReserveTxIdSet(reserveTransactions);

  const periodTxs = (transactions || []).filter(t => {
    if (!t || t.ignore_in_charts) return false;
    // Ignore pending revenue or expense transactions for contribution suggestions
    if (t.payment_status === 'pending' || (t as any).status === 'pending') return false;
    const txDay = getEffectiveTxDateStr(t);
    const inPeriod = isTxInPeriod(txDay, globalPeriod, customDateRange);
    if (!inPeriod) return false;
    const isDefaultRes = res.name === 'Reserva de Manutenção' || res.name === 'Reserva de Emergência';
    if (res.created_at && !isDefaultRes) {
      const creationDay = toDateInputString(res.created_at) || res.created_at.split('T')[0];
      if (txDay < creationDay) return false;
    }
    if (cleanLastWDate && txDay <= cleanLastWDate) return false;
    // Rule counts strictly starting from its effective validity date (zerando sugestões anteriores à vigência)
    if (ruleStartDate && txDay < ruleStartDate) return false;
    // Same-day cutoff: if rule was unpaused or goal changed today, exclude entries created earlier today
    if (cutoffMs !== null && ruleStartDate && txDay === ruleStartDate && t.created_at) {
      const txCreatedMs = new Date(t.created_at).getTime();
      if (!isNaN(txCreatedMs) && txCreatedMs < cutoffMs) return false;
    }
    return true;
  });
  
  const ruleCats = res.regra_categorias || [];
  const ruleValue = getEffectiveRuleValue(res, options?.ignoreBoost);
  const ruleType = res.regra_tipo as string;

  let totalSuggestion = 0;

  if (ruleType === 'km') {
    let totalKm = 0;
    periodTxs.forEach(t => {
      if (isReserveOrNonOperatingTx(t, linkedRtIds)) return;
      const matchesCategory = ruleCats.length === 0 || ruleCats.includes(t.category);
      if (t.type === 'income' && matchesCategory) {
        const distance = (Number(t.end_km) || 0) - (Number(t.start_km) || 0);
        if (distance > 0) totalKm += distance;
      }
    });
    totalSuggestion = Math.round(totalKm * ruleValue * 100) / 100;
  } else if (ruleType === 'bruto') {
    let grossSum = 0;
    periodTxs.forEach(t => {
      if (isReserveOrNonOperatingTx(t, linkedRtIds)) return;
      const matchesCategory = ruleCats.length === 0 || ruleCats.includes(t.category);
      if (t.type === 'income' && matchesCategory) {
        grossSum += Number(t.amount || 0);
      }
    });
    totalSuggestion = Math.round(grossSum * (ruleValue / 100) * 100) / 100;
  } else if (ruleType === 'liquido') {
    let totalIncome = 0;
    let totalExpense = 0;
    periodTxs.forEach(t => {
      if (isReserveOrNonOperatingTx(t, linkedRtIds)) return;
      const matchesCategory = ruleCats.length === 0 || ruleCats.includes(t.category);
      if (t.type === 'income' && matchesCategory) {
        totalIncome += Number(t.amount || 0);
      } else if (
        t.type === 'expense' &&
        doesExpenseCountForLiquido(res, t, {
          operationalCategories: options?.operationalCategories,
          linkedReserveTxIds: linkedRtIds,
        })
      ) {
        totalExpense += Number(t.amount || 0);
      }
    });
    const netProfit = Math.max(0, totalIncome - totalExpense);
    totalSuggestion = Math.round(netProfit * (ruleValue / 100) * 100) / 100;
  } else if (ruleType === 'fixo' || ruleType === 'fixo_diario') {
    const eligibleDates = new Set<string>();
    periodTxs.forEach(t => {
      if (isReserveOrNonOperatingTx(t, linkedRtIds)) return;
      const matchesCategory = ruleCats.length === 0 || ruleCats.includes(t.category);
      if (t.type === 'income' && matchesCategory) {
        eligibleDates.add(getEffectiveTxDateStr(t));
      }
    });
    totalSuggestion = Math.round(eligibleDates.size * ruleValue * 100) / 100;
  }

  // Never suggest more than what remains to achieve meta_objetivo
  if (roundedGoal > 0) {
    const remainingToGoal = Math.max(0, roundedGoal - roundedBalance);
    const effectiveAportesInWindow = getEffectiveAportesInPeriod(
      res,
      reserveTransactions,
      globalPeriod,
      customDateRange,
      { ignoreBoost: options?.ignoreBoost }
    );
    const effectiveCap = Math.min(roundedGoal, Math.round((remainingToGoal + effectiveAportesInWindow) * 100) / 100);
    if (totalSuggestion > effectiveCap) {
      totalSuggestion = effectiveCap;
    }
  }

  return Math.max(0, Math.round(totalSuggestion * 100) / 100);
};

export interface SuggestionAuditResult {
  ruleType: string;
  ruleValue: number;
  baseRuleValue: number;
  boostActive: boolean;
  boostType: 'increment' | 'multiplier';
  boostValue: number;
  effectiveRuleValue: number;
  baseSuggested: number;
  boostSuggestedExtra: number;
  boostExtraAportes: number;
  categories: string[];
  ruleStartDate: string | null;
  cutoffAt: string | null;
  details: string[];
  totalSuggested: number;
  effectiveAportes: number;
  manualAportes?: number;
  pendingSuggestion: number;
  txCount: number;
  eligibleTxs: Array<{ id: string; date: string; description: string; category: string; amount: number; km?: number }>;
  deductedExpenses: Array<{ id: string; date: string; description: string; category: string; amount: number }>;
  liquidoMode: 'operacional' | 'geral';
  ignoredReserveExpensesTotal: number;
  ignoredReserveExpensesCount: number;
  ignoredPersonalExpensesTotal: number;
  ignoredPersonalExpensesCount: number;
  lastWithdrawalDate: string | null;
  resetOnWithdraw: boolean;
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
  customDateRange: { start: string; end: string },
  options?: { operationalCategories?: string[] }
): SuggestionAuditResult => {
  const lastWDate = getLatestWithdrawalDate(res, reserveTransactions);
  const cleanLastWDate = lastWDate ? toDateInputString(lastWDate) : null;
  const ruleStartDate = toDateInputString(res.regra_inicio_validade);
  const cutoffMs = getRuleCutoffTimestamp(res, ruleStartDate);
  const cutoffAtIso = cutoffMs !== null ? new Date(cutoffMs).toISOString() : null;
  const linkedRtIds = buildLinkedReserveTxIdSet(reserveTransactions);
  const liquidoMode = getLiquidoProfitMode(res);
  
  // Count pending withdrawals that were correctly ignored
  const pendingWithdrawalsIgnored = (reserveTransactions || []).filter(
    rt => rt.reserve_id === res.id && 
          rt.type === 'utilizacao' && 
          (rt.payment_status === 'pending' || (rt as any).status === 'pending')
  ).length;

  const isInWindowPreIgnore = (t: Transaction) => {
    if (!t) return false;
    if (t.payment_status === 'pending' || (t as any).status === 'pending') return false;
    const txDay = getEffectiveTxDateStr(t);
    const inPeriod = isTxInPeriod(txDay, globalPeriod, customDateRange);
    if (!inPeriod) return false;
    const isDefaultRes = res.name === 'Reserva de Manutenção' || res.name === 'Reserva de Emergência';
    if (res.created_at && !isDefaultRes) {
      const creationDay = toDateInputString(res.created_at) || res.created_at.split('T')[0];
      if (txDay < creationDay) return false;
    }
    if (cleanLastWDate && txDay <= cleanLastWDate) return false;
    if (ruleStartDate && txDay < ruleStartDate) return false;
    if (cutoffMs !== null && ruleStartDate && txDay === ruleStartDate && t.created_at) {
      const txCreatedMs = new Date(t.created_at).getTime();
      if (!isNaN(txCreatedMs) && txCreatedMs < cutoffMs) return false;
    }
    return true;
  };

  const windowTxsAll = (transactions || []).filter(isInWindowPreIgnore);
  const periodTxs = windowTxsAll.filter(t => !t.ignore_in_charts);

  const roundedBalance = Math.round((res.saldo_atual || 0) * 100) / 100;
  const roundedGoal = Math.round((res.meta_objetivo || 0) * 100) / 100;
  const isGoalReached = Boolean(roundedGoal > 0 && roundedBalance >= roundedGoal);
  const isPaused = res.status === 'inactive' || Boolean(res.is_paused);

  const boostActive = isReserveBoostActive(res);
  const baseRuleValue = Number(res.regra_valor) || 0;
  const effectiveRuleValue = getEffectiveRuleValue(res);
  const boostType = (res.boost_tipo || 'increment') as 'increment' | 'multiplier';
  const boostValue = Number(res.boost_valor || 0);

  const baseCalculated = calculateSuggestion(res, transactions, reserveTransactions, globalPeriod, customDateRange, {
    ignoreBoost: true,
    operationalCategories: options?.operationalCategories,
  });
  const calculated = calculateSuggestion(res, transactions, reserveTransactions, globalPeriod, customDateRange, {
    operationalCategories: options?.operationalCategories,
  });
  const effectiveAportesAll = getEffectiveAportesInPeriod(res, reserveTransactions, globalPeriod, customDateRange, { includeBoostExtras: true });
  const effectiveAportesBaseOnly = getEffectiveAportesInPeriod(res, reserveTransactions, globalPeriod, customDateRange, { ignoreBoost: true });
  const boostExtraAportes = Math.max(0, Math.round((effectiveAportesAll - effectiveAportesBaseOnly) * 100) / 100);
  const effectiveAportes = boostActive ? effectiveAportesAll : effectiveAportesBaseOnly;
  const rawPending = Math.round(Math.max(0, calculated - effectiveAportes) * 100) / 100;
  const pendingSuggestion = roundedGoal > 0
    ? Math.min(rawPending, Math.max(0, Math.round((roundedGoal - roundedBalance) * 100) / 100))
    : rawPending;
  const boostSuggestedExtra = boostActive ? Math.max(0, Math.round((calculated - baseCalculated) * 100) / 100) : 0;

  // Total de aportes manuais no período (não abatem o motor de sugestão)
  const manualAportes = (reserveTransactions || [])
    .filter(rt => {
      if (rt.reserve_id !== res.id || rt.type !== 'aporte') return false;
      if (rt.payment_status === 'pending' || (rt as any).status === 'pending') return false;
      if (!isTxInPeriod(rt.date, globalPeriod, customDateRange)) return false;
      const rtDay = toDateInputString(rt.date) || rt.date;
      if (cleanLastWDate && rtDay <= cleanLastWDate) return false;
      if (ruleStartDate && rtDay < ruleStartDate) return false;
      if (cutoffMs !== null && ruleStartDate && rtDay === ruleStartDate && rt.created_at) {
        const rtCreatedMs = new Date(rt.created_at).getTime();
        if (!isNaN(rtCreatedMs) && rtCreatedMs < cutoffMs) return false;
      }
      return isManualAporte(rt);
    })
    .reduce((sum, rt) => sum + Number(rt.amount || 0), 0);
  const roundedManualAportes = Math.round(manualAportes * 100) / 100;

  // Calculate breakdown stats for eligible transactions based on current active rule
  const ruleCats = res.regra_categorias || [];
  let grossRevenue = 0;
  let totalExpense = 0;
  let totalKm = 0;
  let ignoredReserveExpensesTotal = 0;
  let ignoredReserveExpensesCount = 0;
  let ignoredPersonalExpensesTotal = 0;
  let ignoredPersonalExpensesCount = 0;
  const eligibleTxs: Array<{ id: string; date: string; description: string; category: string; amount: number; km?: number }> = [];
  const deductedExpenses: Array<{ id: string; date: string; description: string; category: string; amount: number }> = [];

  windowTxsAll.forEach(t => {
    if (t.type !== 'expense') return;
    if (t.ignore_in_charts || isReserveOrNonOperatingTx(t, linkedRtIds)) {
      ignoredReserveExpensesTotal += Number(t.amount || 0);
      ignoredReserveExpensesCount += 1;
    } else if (res.regra_tipo === 'liquido' && liquidoMode === 'operacional' && !isOperationalCategory(t.category, options?.operationalCategories)) {
      ignoredPersonalExpensesTotal += Number(t.amount || 0);
      ignoredPersonalExpensesCount += 1;
    }
  });

  periodTxs.forEach(t => {
    if (isReserveOrNonOperatingTx(t, linkedRtIds)) return;
    const matchesCategory = ruleCats.length === 0 || ruleCats.includes(t.category);
    const distance = (Number(t.end_km) || 0) - (Number(t.start_km) || 0);
    const validDistance = distance > 0 ? distance : 0;
    const effectiveDate = getEffectiveTxDateStr(t);
    
    if (t.type === 'income' && matchesCategory) {
      grossRevenue += Number(t.amount || 0);
      totalKm += validDistance;
      eligibleTxs.push({
        id: t.id,
        date: effectiveDate,
        description: t.description || 'Receita',
        category: t.category,
        amount: Number(t.amount || 0),
        km: validDistance > 0 ? validDistance : undefined,
      });
    } else if (
      t.type === 'expense' &&
      doesExpenseCountForLiquido(res, t, {
        operationalCategories: options?.operationalCategories,
        linkedReserveTxIds: linkedRtIds,
      })
    ) {
      const amt = Number(t.amount || 0);
      totalExpense += amt;
      deductedExpenses.push({
        id: t.id,
        date: effectiveDate,
        description: t.description || t.category || 'Despesa',
        category: t.category,
        amount: amt,
      });
    }
  });

  const netProfit = Math.max(0, grossRevenue - totalExpense);
  const uniqueDays = new Set(eligibleTxs.map(t => toDateInputString(t.date) || t.date));
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
    const boostSuffix = boostActive ? ` (Base R$ ${baseRuleValue.toFixed(2)} + Boost ${getRuleBoostDeltaLabel(res)})` : '';
    details.push(`Regra: R$ ${effectiveRuleValue.toFixed(2)} por KM rodado${boostSuffix} (${totalKm.toLocaleString('pt-BR')} km apurados).`);
    formulaExplanation = `${totalKm.toLocaleString('pt-BR')} km × R$ ${effectiveRuleValue.toFixed(2)} = ${formatCurrency(calculated)}`;
  } else if (res.regra_tipo === 'bruto') {
    const boostSuffix = boostActive ? ` (Base ${baseRuleValue}% + Boost ${getRuleBoostDeltaLabel(res)})` : '';
    details.push(`Regra: ${effectiveRuleValue}% sobre o faturamento bruto elegível${boostSuffix} (${formatCurrency(grossRevenue)}).`);
    formulaExplanation = `${formatCurrency(grossRevenue)} (Bruto) × ${effectiveRuleValue}% = ${formatCurrency(calculated)}`;
  } else if (res.regra_tipo === 'liquido') {
    const boostSuffix = boostActive ? ` (Base ${baseRuleValue}% + Boost ${getRuleBoostDeltaLabel(res)})` : '';
    const modeLabel = liquidoMode === 'operacional' ? 'Lucro Operacional' : 'Lucro Líquido Geral';
    details.push(`Regra: ${effectiveRuleValue}% sobre o ${modeLabel} do período${boostSuffix} (${formatCurrency(netProfit)}).`);
    formulaExplanation = `${modeLabel} (${formatCurrency(grossRevenue)} - ${formatCurrency(totalExpense)} = ${formatCurrency(netProfit)}) × ${effectiveRuleValue}% = ${formatCurrency(calculated)}`;
    if (ignoredReserveExpensesCount > 0) {
      details.push(`${ignoredReserveExpensesCount} resgate(s)/uso(s) de reserva ou item(ns) ignorado(s) (${formatCurrency(ignoredReserveExpensesTotal)}) não reduziram seu lucro.`);
    }
    if (liquidoMode === 'operacional' && ignoredPersonalExpensesCount > 0) {
      details.push(`${ignoredPersonalExpensesCount} despesa(s) pessoal(is) (${formatCurrency(ignoredPersonalExpensesTotal)}) foram protegidas no modo Operacional.`);
    }
  } else if (res.regra_tipo === 'fixo' || (res.regra_tipo as string) === 'fixo_diario') {
    const boostSuffix = boostActive ? ` (Base R$ ${baseRuleValue.toFixed(2)} + Boost ${getRuleBoostDeltaLabel(res)})` : '';
    details.push(`Regra: R$ ${effectiveRuleValue.toFixed(2)} fixos por dia trabalhado${boostSuffix} (${workedDays} dias com receitas).`);
    formulaExplanation = `${workedDays} dia(s) com receita × R$ ${effectiveRuleValue.toFixed(2)} = ${formatCurrency(calculated)}`;
  } else {
    details.push('Nenhuma regra configurada ou ativa.');
    formulaExplanation = 'Sem regra de cálculo ativa.';
  }

  if (boostActive && !isPaused && !isGoalReached) {
    details.push(`Modo Boost ATIVO (${getRuleBoostDeltaLabel(res)}): elevou a sugestão em +${formatCurrency(boostSuggestedExtra)} no período.`);
  } else if (!boostActive && boostExtraAportes > 0) {
    details.push(`Bônus de Boost já aportado (${formatCurrency(boostExtraAportes)}) fica isolado e não zera nem reduz suas sugestões futuras na regra normal.`);
  }

  if (ruleStartDate) {
    const formattedRuleDate = new Date(ruleStartDate + 'T00:00:00').toLocaleDateString('pt-BR');
    const timeSuffix = cutoffMs !== null
      ? ` às ${new Date(cutoffMs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : '';
    details.push(`Vigência da regra ativa: A partir de ${formattedRuleDate}${timeSuffix} (lançamentos anteriores desconsiderados).`);
  }

  const resetOnWithdraw = res.regra_tipo === 'liquido' ? false : res.reset_suggestion_on_withdraw !== false;
  if (res.regra_tipo === 'liquido') {
    details.push('Proteção Lucro Líquido: resgates desta ou de outras reservas nunca zeram nem reduzem a sugestão.');
  } else if (!resetOnWithdraw) {
    details.push('Reinício de sugestão ao resgatar DESATIVADO: resgates não zeram a sugestão atual.');
  } else if (cleanLastWDate) {
    details.push(`Contagem reiniciada após o último resgate pago em ${new Date(cleanLastWDate + 'T00:00:00').toLocaleDateString('pt-BR')}.`);
  }
  if (pendingWithdrawalsIgnored > 0) {
    details.push(`${pendingWithdrawalsIgnored} resgate(s) recorrente(s) pendente(s) foram desconsiderados até a sua quitação.`);
  }

  if (roundedManualAportes > 0) {
    details.push(`Aportes manuais no período: ${formatCurrency(roundedManualAportes)} (não abatem a sugestão de regras).`);
  }

  return {
    ruleType: res.regra_tipo || '',
    ruleValue: effectiveRuleValue,
    baseRuleValue,
    boostActive,
    boostType,
    boostValue,
    effectiveRuleValue,
    baseSuggested: baseCalculated,
    boostSuggestedExtra,
    boostExtraAportes,
    categories: res.regra_categorias || [],
    ruleStartDate,
    cutoffAt: cutoffAtIso,
    details,
    totalSuggested: calculated,
    effectiveAportes,
    manualAportes: roundedManualAportes,
    pendingSuggestion,
    txCount: eligibleTxs.length,
    eligibleTxs,
    deductedExpenses,
    liquidoMode,
    ignoredReserveExpensesTotal: Math.round(ignoredReserveExpensesTotal * 100) / 100,
    ignoredReserveExpensesCount,
    ignoredPersonalExpensesTotal: Math.round(ignoredPersonalExpensesTotal * 100) / 100,
    ignoredPersonalExpensesCount,
    lastWithdrawalDate: cleanLastWDate,
    resetOnWithdraw,
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

/**
 * Helper to identify whether an aporte transaction is manual (avulso)
 * or generated by the suggestion engine / mass consolidation.
 * Manual contributions do NOT offset or deduct from automated rule suggestions.
 */
export const isManualAporte = (rt: ReserveTransaction): boolean => {
  if (rt.type !== 'aporte') return false;

  // 1. Explicit suggestion markers: generated by applying a rule suggestion
  if (
    rt.category === 'Aporte Sugerido' ||
    rt.source === 'automation' ||
    Boolean(
      rt.description && (
        rt.description.includes('[Aporte Sugerido]') ||
        rt.description.toLowerCase().includes('aporte sugerido')
      )
    )
  ) {
    return false;
  }

  // 2. Explicit mass contribution markers from consolidator
  if (
    rt.source === 'mass_contribution' ||
    Boolean(rt.batch_id) ||
    Boolean(
      rt.description && (
        rt.description.includes('[Consolidador em Massa]') ||
        rt.description.includes('[Aporte em Massa]') ||
        rt.description.includes('[Consolidador]')
      )
    )
  ) {
    return false;
  }

  // 3. Any other aporte (source === 'manual', category === 'Aporte Manual' / 'Aporte Extra', etc.) is manual
  return true;
};

export const getEffectiveAportesInPeriod = (
  res: Reserve,
  reserveTransactions: ReserveTransaction[],
  globalPeriod: string,
  customDateRange: { start: string; end: string },
  options?: { includeBoostExtras?: boolean; ignoreBoost?: boolean }
): number => {
  const lastWDate = getLatestWithdrawalDate(res, reserveTransactions);
  const cleanLastWDate = lastWDate ? toDateInputString(lastWDate) : null;
  const ruleStartDate = toDateInputString(res.regra_inicio_validade);
  const cutoffMs = getRuleCutoffTimestamp(res, ruleStartDate);
  const treatAsBoostActive = options?.ignoreBoost ? false : isReserveBoostActive(res);
  const total = (reserveTransactions || [])
    .filter(rt => {
      const matches = rt.reserve_id === res.id && 
                      rt.type === 'aporte' && 
                      rt.payment_status !== 'pending' &&
                      (rt as any).status !== 'pending' &&
                      isTxInPeriod(rt.date, globalPeriod, customDateRange) && 
                      rt.category !== 'Rendimento';
      if (!matches) return false;
      const rtDay = toDateInputString(rt.date) || rt.date;
      if (cleanLastWDate && rtDay <= cleanLastWDate) return false;
      if (ruleStartDate && rtDay < ruleStartDate) return false;
      if (cutoffMs !== null && ruleStartDate && rtDay === ruleStartDate && rt.created_at) {
        const rtCreatedMs = new Date(rt.created_at).getTime();
        if (!isNaN(rtCreatedMs) && rtCreatedMs < cutoffMs) return false;
      }
      // Regra de negócio: Aportes manuais NÃO abatem o cálculo da sugestão das regras
      if (isManualAporte(rt)) return false;
      return true;
    })
    .reduce((sum, rt) => {
      const amt = Number(rt.amount || 0);
      if (options?.includeBoostExtras || treatAsBoostActive) {
        return sum + amt;
      }
      // Quando o Boost está desativado, o bônus extra de aportes feitos no modo Boost
      // não cria crédito negativo nem zera as sugestões normais futuras
      const boostExtra = getBoostExtraFromRt(rt);
      return sum + Math.max(0, amt - boostExtra);
    }, 0);
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

export { getTodayLocalDateStr } from '../../lib/utils';

export interface ReserveGoalProjection {
  hasGoal: boolean;
  isReached: boolean;
  remaining: number;
  dailyPace: number;
  monthlyPace: number;
  estimatedDays: number | null;
  estimatedDateStr: string | null;
  timelineLabel: string;
  paceSource: 'rule' | 'history' | 'none';
  targetDateStr: string | null;
  targetDateDisplay: string | null;
  daysUntilTarget: number | null;
  requiredDailyForDeadline: number | null;
  requiredWeeklyForDeadline: number | null;
  isDeadlineExpired: boolean;
  isOnTrackForDeadline: boolean | null;
}

export const formatEstimatedTimeline = (days: number): string => {
  if (days <= 0) return 'Meta atingida';
  if (days === 1) return '~1 dia';
  if (days < 7) return `~${days} dias`;
  if (days <= 45) {
    const weeks = Math.max(1, Math.round(days / 7));
    return `~${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  }
  if (days < 365) {
    const months = Number((days / 30).toFixed(1));
    const formatted = String(months).replace('.0', '').replace('.', ',');
    return `~${formatted} ${months === 1 ? 'mês' : 'meses'}`;
  }
  const years = Number((days / 365).toFixed(1));
  const formatted = String(years).replace('.0', '').replace('.', ',');
  return `~${formatted} ${years === 1 ? 'ano' : 'anos'}`;
};

/**
 * Calcula projeção preditiva de conclusão da meta baseada no ritmo dos últimos 30 dias
 * da regra ativa ou no histórico recente de aportes da reserva, além de cruzar com
 * o prazo limite opcional (`target_date`).
 */
export const calculateReserveGoalProjection = (
  res: Reserve,
  transactions: Transaction[],
  reserveTransactions: ReserveTransaction[],
  options?: { ignoreBoost?: boolean; operationalCategories?: string[] }
): ReserveGoalProjection => {
  const balance = Math.round((res.saldo_atual || 0) * 100) / 100;
  const goal = Math.round((res.meta_objetivo || 0) * 100) / 100;
  const hasGoal = goal > 0;
  const remaining = hasGoal ? Math.max(0, Math.round((goal - balance) * 100) / 100) : 0;
  const isReached = hasGoal && remaining <= 0;

  const cleanTargetDate = toDateInputString(res.target_date);
  const hasValidTargetDate = Boolean(cleanTargetDate && /^\d{4}-\d{2}-\d{2}$/.test(cleanTargetDate));
  const now = new Date();
  const daysUntilTarget = hasValidTargetDate
    ? differenceInCalendarDays(startOfDay(parseLocalDate(cleanTargetDate)), startOfDay(now))
    : null;
  const targetDateDisplay = hasValidTargetDate ? formatDateDisplay(cleanTargetDate) : null;
  const isDeadlineExpired = Boolean(daysUntilTarget !== null && daysUntilTarget <= 0 && !isReached);

  if (!hasGoal) {
    return {
      hasGoal: false,
      isReached: false,
      remaining: 0,
      dailyPace: 0,
      monthlyPace: 0,
      estimatedDays: null,
      estimatedDateStr: null,
      timelineLabel: '',
      paceSource: 'none',
      targetDateStr: hasValidTargetDate ? cleanTargetDate : null,
      targetDateDisplay,
      daysUntilTarget,
      requiredDailyForDeadline: null,
      requiredWeeklyForDeadline: null,
      isDeadlineExpired: false,
      isOnTrackForDeadline: null,
    };
  }

  if (isReached) {
    return {
      hasGoal: true,
      isReached: true,
      remaining: 0,
      dailyPace: 0,
      monthlyPace: 0,
      estimatedDays: 0,
      estimatedDateStr: null,
      timelineLabel: 'Meta atingida',
      paceSource: 'none',
      targetDateStr: hasValidTargetDate ? cleanTargetDate : null,
      targetDateDisplay,
      daysUntilTarget,
      requiredDailyForDeadline: 0,
      requiredWeeklyForDeadline: 0,
      isDeadlineExpired: false,
      isOnTrackForDeadline: true,
    };
  }

  const requiredDailyForDeadline =
    daysUntilTarget !== null
      ? daysUntilTarget > 0
        ? Math.round((remaining / daysUntilTarget) * 100) / 100
        : remaining
      : null;
  const requiredWeeklyForDeadline =
    daysUntilTarget !== null
      ? daysUntilTarget > 0
        ? Math.round(((remaining / daysUntilTarget) * Math.min(7, daysUntilTarget)) * 100) / 100
        : remaining
      : null;

  const windowStart = startOfDay(subDays(now, 29));
  const windowEnd = endOfDay(now);

  let ruleDailyPace = 0;
  const effectiveRuleVal = getEffectiveRuleValue(res, options?.ignoreBoost);
  if (res.regra_ativa && res.regra_tipo && effectiveRuleVal > 0) {
    const linkedRtIds = buildLinkedReserveTxIdSet(reserveTransactions);
    const recentTxs = (transactions || []).filter(t => {
      if (!t || t.ignore_in_charts) return false;
      if (t.payment_status === 'pending' || (t as any).status === 'pending') return false;
      const d = parseLocalDate(getEffectiveTxDateStr(t));
      return isWithinInterval(d, { start: windowStart, end: windowEnd });
    });

    const ruleCats = res.regra_categorias || [];
    const ruleVal = effectiveRuleVal;
    const ruleType = res.regra_tipo as string;
    let total30d = 0;

    if (ruleType === 'km') {
      let km30 = 0;
      recentTxs.forEach(t => {
        if (isReserveOrNonOperatingTx(t, linkedRtIds)) return;
        const matchesCat = ruleCats.length === 0 || ruleCats.includes(t.category);
        if (t.type === 'income' && matchesCat) {
          const dist = (Number(t.end_km) || 0) - (Number(t.start_km) || 0);
          if (dist > 0) km30 += dist;
        }
      });
      total30d = km30 * ruleVal;
    } else if (ruleType === 'bruto') {
      let gross30 = 0;
      recentTxs.forEach(t => {
        if (isReserveOrNonOperatingTx(t, linkedRtIds)) return;
        const matchesCat = ruleCats.length === 0 || ruleCats.includes(t.category);
        if (t.type === 'income' && matchesCat) {
          gross30 += Number(t.amount || 0);
        }
      });
      total30d = gross30 * (ruleVal / 100);
    } else if (ruleType === 'liquido') {
      let inc30 = 0;
      let exp30 = 0;
      recentTxs.forEach(t => {
        if (isReserveOrNonOperatingTx(t, linkedRtIds)) return;
        const matchesCat = ruleCats.length === 0 || ruleCats.includes(t.category);
        if (t.type === 'income' && matchesCat) {
          inc30 += Number(t.amount || 0);
        } else if (
          t.type === 'expense' &&
          doesExpenseCountForLiquido(res, t, {
            operationalCategories: options?.operationalCategories,
            linkedReserveTxIds: linkedRtIds,
          })
        ) {
          exp30 += Number(t.amount || 0);
        }
      });
      total30d = Math.max(0, inc30 - exp30) * (ruleVal / 100);
    } else if (ruleType === 'fixo' || ruleType === 'fixo_diario') {
      const workedDays = new Set<string>();
      recentTxs.forEach(t => {
        if (isReserveOrNonOperatingTx(t, linkedRtIds)) return;
        const matchesCat = ruleCats.length === 0 || ruleCats.includes(t.category);
        if (t.type === 'income' && matchesCat) {
          workedDays.add(getEffectiveTxDateStr(t));
        }
      });
      total30d = workedDays.size * ruleVal;
    }

    if (total30d > 0) {
      ruleDailyPace = total30d / 30;
    }
  }

  let historyDailyPace = 0;
  const recentAportes = (reserveTransactions || []).filter(rt => {
    if (rt.reserve_id !== res.id) return false;
    if (rt.type !== 'aporte' && rt.type !== 'rendimento') return false;
    if (rt.payment_status === 'pending' || (rt as any).status === 'pending') return false;
    const d = parseLocalDate(rt.date);
    return isWithinInterval(d, { start: startOfDay(subDays(now, 59)), end: windowEnd });
  });

  if (recentAportes.length > 0) {
    const sumAportes = recentAportes.reduce((s, rt) => s + Number(rt.amount || 0), 0);
    // Calculate span from earliest recent aporte (min 7 days, max 60 days)
    const dates = recentAportes.map(rt => parseLocalDate(rt.date).getTime());
    const minTs = Math.min(...dates);
    const spanDays = Math.max(7, Math.min(60, Math.ceil((now.getTime() - minTs) / (1000 * 60 * 60 * 24)) + 1));
    historyDailyPace = sumAportes / spanDays;
  }

  const dailyPace = ruleDailyPace > 0 ? ruleDailyPace : historyDailyPace;
  const paceSource: 'rule' | 'history' | 'none' =
    ruleDailyPace > 0 ? 'rule' : historyDailyPace > 0 ? 'history' : 'none';

  if (dailyPace <= 0.01) {
    return {
      hasGoal: true,
      isReached: false,
      remaining,
      dailyPace: 0,
      monthlyPace: 0,
      estimatedDays: null,
      estimatedDateStr: null,
      timelineLabel: '',
      paceSource: 'none',
      targetDateStr: hasValidTargetDate ? cleanTargetDate : null,
      targetDateDisplay,
      daysUntilTarget,
      requiredDailyForDeadline,
      requiredWeeklyForDeadline,
      isDeadlineExpired,
      isOnTrackForDeadline: hasValidTargetDate ? false : null,
    };
  }

  const estimatedDays = Math.ceil(remaining / dailyPace);
  const projectedDate = addDays(now, estimatedDays);
  const isOnTrackForDeadline =
    daysUntilTarget !== null
      ? !isDeadlineExpired && estimatedDays <= daysUntilTarget
      : null;

  return {
    hasGoal: true,
    isReached: false,
    remaining,
    dailyPace: Math.round(dailyPace * 100) / 100,
    monthlyPace: Math.round(dailyPace * 30 * 100) / 100,
    estimatedDays,
    estimatedDateStr: format(projectedDate, 'dd/MM/yyyy'),
    timelineLabel: formatEstimatedTimeline(estimatedDays),
    paceSource,
    targetDateStr: hasValidTargetDate ? cleanTargetDate : null,
    targetDateDisplay,
    daysUntilTarget,
    requiredDailyForDeadline,
    requiredWeeklyForDeadline,
    isDeadlineExpired,
    isOnTrackForDeadline,
  };
};

export interface BoostSpeedupComparison {
  normalProjection: ReserveGoalProjection;
  boostedProjection: ReserveGoalProjection;
  daysSaved: number | null;
  speedupPct: number | null;
}

export const getBoostSpeedupComparison = (
  res: Reserve,
  transactions: Transaction[],
  reserveTransactions: ReserveTransaction[],
  overrideBoost?: { boost_ativo?: boolean; boost_tipo?: 'increment' | 'multiplier' | null; boost_valor?: number | null },
  options?: { operationalCategories?: string[] }
): BoostSpeedupComparison => {
  const normalProjection = calculateReserveGoalProjection(res, transactions, reserveTransactions, {
    ignoreBoost: true,
    operationalCategories: options?.operationalCategories,
  });
  const boostedReserve: Reserve = overrideBoost
    ? {
        ...res,
        boost_ativo: overrideBoost.boost_ativo ?? res.boost_ativo,
        boost_tipo: overrideBoost.boost_tipo ?? res.boost_tipo,
        boost_valor: overrideBoost.boost_valor ?? res.boost_valor,
      }
    : res;
  const boostedProjection = calculateReserveGoalProjection(boostedReserve, transactions, reserveTransactions, {
    ignoreBoost: false,
    operationalCategories: options?.operationalCategories,
  });

  const daysSaved =
    normalProjection.estimatedDays !== null &&
    boostedProjection.estimatedDays !== null &&
    normalProjection.estimatedDays > boostedProjection.estimatedDays
      ? normalProjection.estimatedDays - boostedProjection.estimatedDays
      : null;

  const speedupPct =
    daysSaved !== null && normalProjection.estimatedDays && normalProjection.estimatedDays > 0
      ? Math.round((daysSaved / normalProjection.estimatedDays) * 100)
      : null;

  return {
    normalProjection,
    boostedProjection,
    daysSaved,
    speedupPct,
  };
};

export interface ReserveYieldStats {
  yieldAmount: number;
  depositedBase: number;
  yieldPct: number;
}

export const calculateReserveYieldStats = (
  res: Reserve,
  reserveTransactions: ReserveTransaction[]
): ReserveYieldStats => {
  const rts = (reserveTransactions || []).filter(rt => rt.reserve_id === res.id);
  const yieldAmount = Math.round(
    rts
      .filter(rt => rt.type === 'rendimento' && rt.payment_status !== 'pending' && (rt as any).status !== 'pending')
      .reduce((sum, rt) => sum + Number(rt.amount || 0), 0) * 100
  ) / 100;

  const totalAportes = rts
    .filter(rt => rt.type === 'aporte' && rt.payment_status !== 'pending' && (rt as any).status !== 'pending')
    .reduce((sum, rt) => sum + Number(rt.amount || 0), 0);

  const initialBal = Number(res.saldo_inicial || 0);
  const netCapital = Math.max(0, Number(res.saldo_atual || 0) - yieldAmount);
  const depositedBase = Math.max(initialBal + totalAportes, netCapital);
  const yieldPct = depositedBase > 0 && yieldAmount > 0
    ? Math.round((yieldAmount / depositedBase) * 1000) / 10
    : 0;

  return {
    yieldAmount,
    depositedBase: Math.round(depositedBase * 100) / 100,
    yieldPct,
  };
};

/**
 * Sugere automaticamente uma reserva compatível quando o usuário cadastra uma despesa
 * por categoria (ex: Manutenção -> Reserva de Manutenção, Emergência -> Reserva de Emergência).
 */
export const findMatchingReserveForExpense = (
  category: string,
  reserves: Reserve[]
): Reserve | null => {
  if (!category || !reserves || reserves.length === 0) return null;

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const normCat = normalize(category);
  const activeReserves = reserves.filter(r => r.status !== 'inactive');
  if (activeReserves.length === 0) return null;

  // 1. Exact default_use_category match
  const byDefaultCat = activeReserves.find(
    r => r.default_use_category && normalize(r.default_use_category) === normCat
  );
  if (byDefaultCat) return byDefaultCat;

  // 2. Semantic / keyword mapping to reserve name
  const maintenanceKeywords = ['manutencao', 'troca de oleo', 'pneu', 'pneus', 'mecanico', 'mecanica', 'oficina', 'peca', 'pecas', 'revisao', 'equipamento'];
  const emergencyKeywords = ['emergencia', 'saude', 'medico', 'remedio', 'hospital', 'imprevisto'];
  const taxInsuranceKeywords = ['ipva', 'seguro', 'licenciamento', 'imposto', 'documentacao', 'multa'];
  const fuelKeywords = ['combustivel', 'gasolina', 'etanol', 'abastecimento', 'pedagio'];

  const scoreReserve = (r: Reserve): number => {
    const rName = normalize(r.name || '');
    const rDesc = normalize(r.description || '');
    let score = 0;

    if (rName.includes(normCat) || normCat.includes(rName)) score += 10;
    if (rDesc.includes(normCat)) score += 4;

    if (maintenanceKeywords.some(k => normCat.includes(k))) {
      if (rName.includes('manutencao') || rName.includes('veiculo') || rName.includes('moto') || r.icon === 'Wrench') {
        score += 8;
      }
    }
    if (emergencyKeywords.some(k => normCat.includes(k))) {
      if (rName.includes('emergencia') || r.icon === 'ShieldAlert' || r.icon === 'ShieldCheck') {
        score += 8;
      }
    }
    if (taxInsuranceKeywords.some(k => normCat.includes(k))) {
      if (rName.includes('ipva') || rName.includes('seguro') || rName.includes('imposto') || rName.includes('documento')) {
        score += 8;
      }
    }
    if (fuelKeywords.some(k => normCat.includes(k))) {
      if (rName.includes('combustivel') || rName.includes('gasolina') || r.icon === 'Fuel') {
        score += 8;
      }
    }

    if (score > 0 && (r.saldo_atual || 0) > 0) score += 1;
    return score;
  };

  let best: Reserve | null = null;
  let bestScore = 0;
  for (const r of activeReserves) {
    const s = scoreReserve(r);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }

  return bestScore > 0 ? best : null;
};

export interface ReserveWeeklyProgress {
  mode: 'dynamic' | 'rule_week' | 'fixed' | 'off';
  includeManual: boolean;
  weekStartStr: string;
  weekEndStr: string;
  weekRangeLabel: string;
  weeklyTarget: number;
  rawWeeklyTarget: number;
  weeklyRuleSuggested: number;
  weeklyRulePace: number;
  weeklyDeadlineRequired: number | null;
  weeklyRuleAportes: number;
  weeklyManualAportes: number;
  weeklyTotalAportes: number;
  weeklyCountedAportes: number;
  weeklyRemaining: number;
  weeklyProgressPct: number;
  isWeeklyGoalReached: boolean;
  isEnabled: boolean;
  hasTarget: boolean;
  sourceLabel: string;
  isCappedByTotalGoal: boolean;
}

/**
 * Calcula o progresso semanal (Segunda a Domingo) de aportes da reserva,
 * suportando metas configuráveis (valor fixo semanal) e dinâmicas
 * (regra da semana atual, ritmo de 30 dias da regra ou prazo fixo da meta total).
 */
export const calculateReserveWeeklyProgress = (
  res: Reserve,
  transactions: Transaction[],
  reserveTransactions: ReserveTransaction[],
  options?: { ignoreBoost?: boolean; operationalCategories?: string[] }
): ReserveWeeklyProgress => {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
  const weekRangeLabel = `${format(weekStart, 'dd/MM')} – ${format(weekEnd, 'dd/MM')}`;

  const mode = (res.weekly_goal_mode || 'dynamic') as 'dynamic' | 'rule_week' | 'fixed' | 'off';
  const includeManual = res.weekly_goal_include_manual !== false;
  const isInactive = res.status === 'inactive';
  const isPaused = isInactive || Boolean(res.is_paused);

  const roundedBalance = Math.round((res.saldo_atual || 0) * 100) / 100;
  const roundedGoal = Math.round((res.meta_objetivo || 0) * 100) / 100;
  const hasTotalGoal = roundedGoal > 0;
  const remainingTotalGoal = hasTotalGoal ? Math.max(0, Math.round((roundedGoal - roundedBalance) * 100) / 100) : 0;
  const isTotalGoalReached = hasTotalGoal && remainingTotalGoal <= 0;

  // 1. Aportes realizados dentro da semana atual (Segunda a Domingo)
  // Nota: aportes desta semana contam integralmente no placar semanal do usuário,
  // mesmo que tenha havido um resgate ou alteração de meta na semana.
  let weeklyRuleAportes = 0;
  let weeklyManualAportes = 0;

  (reserveTransactions || []).forEach(rt => {
    if (rt.reserve_id !== res.id || rt.type !== 'aporte') return;
    if (rt.payment_status === 'pending' || (rt as any).status === 'pending') return;
    if (rt.category === 'Rendimento') return;
    const d = parseLocalDate(rt.date);
    if (!isWithinInterval(d, { start: weekStart, end: weekEnd })) return;
    const amt = Number(rt.amount || 0);
    if (amt <= 0) return;
    if (isManualAporte(rt)) {
      weeklyManualAportes += amt;
    } else {
      weeklyRuleAportes += amt;
    }
  });

  weeklyRuleAportes = Math.round(weeklyRuleAportes * 100) / 100;
  weeklyManualAportes = Math.round(weeklyManualAportes * 100) / 100;
  const weeklyTotalAportes = Math.round((weeklyRuleAportes + weeklyManualAportes) * 100) / 100;
  const weeklyCountedAportes = includeManual ? weeklyTotalAportes : weeklyRuleAportes;

  // 2. Sugestão calculada pela regra na semana atual (Seg-Dom)
  const weeklyRuleSuggested = !isPaused && !isTotalGoalReached && res.regra_ativa && res.regra_tipo
    ? calculateSuggestion(res, transactions, reserveTransactions, 'week', { start: '', end: '' }, options)
    : 0;

  // 3. Ritmo semanal da regra nos últimos 30 dias (funciona mesmo sem meta total)
  let weeklyRulePace = 0;
  const effectiveRuleVal = getEffectiveRuleValue(res, options?.ignoreBoost);
  if (!isPaused && !isTotalGoalReached && res.regra_ativa && res.regra_tipo && effectiveRuleVal > 0) {
    const windowStart = startOfDay(subDays(now, 29));
    const windowEnd = endOfDay(now);
    const linkedRtIds = buildLinkedReserveTxIdSet(reserveTransactions);
    const recentTxs = (transactions || []).filter(t => {
      if (!t || t.ignore_in_charts) return false;
      if (t.payment_status === 'pending' || (t as any).status === 'pending') return false;
      const d = parseLocalDate(getEffectiveTxDateStr(t));
      return isWithinInterval(d, { start: windowStart, end: windowEnd });
    });

    const ruleCats = res.regra_categorias || [];
    const ruleType = res.regra_tipo as string;
    let total30d = 0;

    if (ruleType === 'km') {
      let km30 = 0;
      recentTxs.forEach(t => {
        if (isReserveOrNonOperatingTx(t, linkedRtIds)) return;
        const matchesCat = ruleCats.length === 0 || ruleCats.includes(t.category);
        if (t.type === 'income' && matchesCat) {
          const dist = (Number(t.end_km) || 0) - (Number(t.start_km) || 0);
          if (dist > 0) km30 += dist;
        }
      });
      total30d = km30 * effectiveRuleVal;
    } else if (ruleType === 'bruto') {
      let gross30 = 0;
      recentTxs.forEach(t => {
        if (isReserveOrNonOperatingTx(t, linkedRtIds)) return;
        const matchesCat = ruleCats.length === 0 || ruleCats.includes(t.category);
        if (t.type === 'income' && matchesCat) {
          gross30 += Number(t.amount || 0);
        }
      });
      total30d = gross30 * (effectiveRuleVal / 100);
    } else if (ruleType === 'liquido') {
      let inc30 = 0;
      let exp30 = 0;
      recentTxs.forEach(t => {
        if (isReserveOrNonOperatingTx(t, linkedRtIds)) return;
        const matchesCat = ruleCats.length === 0 || ruleCats.includes(t.category);
        if (t.type === 'income' && matchesCat) {
          inc30 += Number(t.amount || 0);
        } else if (
          t.type === 'expense' &&
          doesExpenseCountForLiquido(res, t, {
            operationalCategories: options?.operationalCategories,
            linkedReserveTxIds: linkedRtIds,
          })
        ) {
          exp30 += Number(t.amount || 0);
        }
      });
      total30d = Math.max(0, inc30 - exp30) * (effectiveRuleVal / 100);
    } else if (ruleType === 'fixo' || ruleType === 'fixo_diario') {
      const workedDays = new Set<string>();
      recentTxs.forEach(t => {
        if (isReserveOrNonOperatingTx(t, linkedRtIds)) return;
        const matchesCat = ruleCats.length === 0 || ruleCats.includes(t.category);
        if (t.type === 'income' && matchesCat) {
          workedDays.add(getEffectiveTxDateStr(t));
        }
      });
      total30d = workedDays.size * effectiveRuleVal;
    }

    if (total30d > 0) {
      weeklyRulePace = Math.round(((total30d / 30) * 7) * 100) / 100;
    }
  }

  // 4. Requerido por semana caso tenha Prazo Fixo (target_date)
  const cleanTargetDate = toDateInputString(res.target_date);
  let weeklyDeadlineRequired: number | null = null;
  if (hasTotalGoal && !isTotalGoalReached && cleanTargetDate && /^\d{4}-\d{2}-\d{2}$/.test(cleanTargetDate)) {
    const daysUntil = differenceInCalendarDays(startOfDay(parseLocalDate(cleanTargetDate)), startOfDay(now));
    if (daysUntil > 0) {
      weeklyDeadlineRequired = Math.round(((remainingTotalGoal / daysUntil) * Math.min(7, daysUntil)) * 100) / 100;
    } else {
      weeklyDeadlineRequired = remainingTotalGoal;
    }
  }

  // 5. Determinar meta semanal bruta conforme o modo
  let rawWeeklyTarget = 0;
  let sourceLabel = 'Dinâmica';

  if (isInactive || mode === 'off') {
    rawWeeklyTarget = 0;
    sourceLabel = 'Desativada';
  } else if (mode === 'fixed') {
    rawWeeklyTarget = Math.max(0, Math.round(Number(res.weekly_goal_amount || 0) * 100) / 100);
    sourceLabel = 'Configurada';
  } else if (mode === 'rule_week') {
    rawWeeklyTarget = weeklyRuleSuggested;
    sourceLabel = 'Sugestão da Semana';
  } else {
    // Modo Dinâmico Automático
    if (weeklyDeadlineRequired !== null && weeklyDeadlineRequired > 0) {
      rawWeeklyTarget = weeklyDeadlineRequired;
      sourceLabel = 'Dinâmica · Prazo';
    } else if (!isPaused && !isTotalGoalReached && res.regra_ativa && res.regra_tipo) {
      if (weeklyRulePace > 0 || weeklyRuleSuggested > 0) {
        rawWeeklyTarget = Math.max(weeklyRuleSuggested, weeklyRulePace);
        sourceLabel =
          weeklyRuleSuggested >= weeklyRulePace && weeklyRuleSuggested > 0
            ? 'Dinâmica · Regra'
            : 'Dinâmica · Ritmo';
      }
    }
  }

  // 6. Respeitar o teto da meta total (se configurada)
  let weeklyTarget = rawWeeklyTarget;
  let isCappedByTotalGoal = false;
  if (hasTotalGoal && rawWeeklyTarget > 0) {
    const cap = Math.round((remainingTotalGoal + weeklyCountedAportes) * 100) / 100;
    if (weeklyTarget > cap) {
      weeklyTarget = Math.max(0, cap);
      isCappedByTotalGoal = true;
    }
  }

  if (isPaused && mode !== 'fixed') {
    weeklyTarget = 0;
  }

  const weeklyRemaining = Math.max(0, Math.round((weeklyTarget - weeklyCountedAportes) * 100) / 100);
  const weeklyProgressPct =
    weeklyTarget > 0
      ? Math.min(100, Math.round((weeklyCountedAportes / weeklyTarget) * 100))
      : weeklyTotalAportes > 0
        ? 100
        : 0;
  const isWeeklyGoalReached = weeklyTarget > 0 && weeklyCountedAportes >= weeklyTarget;
  const hasTarget = weeklyTarget > 0;
  const isEnabled = !isInactive && mode !== 'off' && (hasTarget || weeklyTotalAportes > 0);

  return {
    mode,
    includeManual,
    weekStartStr,
    weekEndStr,
    weekRangeLabel,
    weeklyTarget,
    rawWeeklyTarget,
    weeklyRuleSuggested,
    weeklyRulePace,
    weeklyDeadlineRequired,
    weeklyRuleAportes,
    weeklyManualAportes,
    weeklyTotalAportes,
    weeklyCountedAportes,
    weeklyRemaining,
    weeklyProgressPct,
    isWeeklyGoalReached,
    isEnabled,
    hasTarget,
    sourceLabel,
    isCappedByTotalGoal,
  };
};


