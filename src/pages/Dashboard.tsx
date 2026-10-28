import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { cacheManager } from '../lib/cacheManager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Eye,
  EyeOff,
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Loader2, 
  Trophy,
  Award,
  Crown, 
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
  Info,
  Layers,
  ArrowRight,
  Landmark,
  Zap,
  Camera,
  Gift,
  Pizza,
  Beer,
  Hammer,
  Shield,
  MapPin,
  Phone,
  MessageSquare,
  CreditCard,
  ShoppingCart,
  Home,
  Settings,
  User,
  Calculator,
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
  Filter,
  Gauge,
  Percent,
  Target,
  Check,
  X,
  SlidersHorizontal,
  Compass,
  BookOpen,
  CheckSquare,
  CalendarRange,
  Activity,
  LogOut,
  RotateCw,
  RotateCcw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getTodayLocalDateStr } from '../lib/utils';
import { getEffectiveUserId } from '../lib/authUtils';
import { syncQueueManager } from '../lib/syncQueue';
import { useData } from '../contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ExecutiveReportModal } from '../components/ExecutiveReportModal';
import { PatrimonyEvolution } from '../components/PatrimonyEvolution';
import { DailyProductivityHeatmap } from '../components/dashboard/DailyProductivityHeatmap';
import { PassiveIncomeEvolutionChart } from '../components/dashboard/PassiveIncomeEvolutionChart';
import { PersonalExpenseBarConfigDialog } from '../components/dashboard/PersonalExpenseBarConfigDialog';
import { IndicatorHistoryModal, IndicatorType, MonthHistoryItem, formatIndicatorValue } from '../components/IndicatorHistoryModal';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
  ReferenceLine
} from 'recharts';
import { Transaction } from '../types';
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  isWithinInterval,
  format,
  subDays,
  addDays,
  parseISO,
  eachDayOfInterval,
  isSameMonth,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfYear,
  endOfYear,
  subYears,
  addYears,
  differenceInCalendarDays
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const getCategoryMeta = (category: string, type: 'income' | 'expense', settings?: any) => {
  // Check settings first
  if (settings?.category_icons && settings.category_icons[category]) {
    const iconName = settings.category_icons[category];
    const iconMap: Record<string, any> = {
      Bike, Car, Package, Utensils, Fuel, Wrench, Wifi, ShoppingBag, Landmark, 
      Briefcase, Zap, Heart, Camera, Gift, Coffee, Pizza, Beer, DollarSign, 
      PiggyBank, Hammer, Shield, MapPin, Phone, MessageSquare, TrendingUp, TrendingDown,
      Wallet, CreditCard, ShoppingCart, Home, Settings, User, Scissors, Music, Video, 
      Gamepad, Globe, Plane, Train, Bus, Truck, Hospital, School, GraduationCap, 
      Users, Smile, Frown, Star, Bell, Clock, Calendar, Filter
    };
    const Icon = iconMap[iconName] || (type === 'income' ? TrendingUp : TrendingDown);
    const color = type === 'income' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    return { icon: Icon, color };
  }

  const normalized = category.toLowerCase();
  
  if (type === 'income') {
    if (normalized.includes('venda de investimentos') || normalized.includes('venda de investimento')) {
      return { icon: TrendingUp, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 shadow-sm' };
    }
    if (normalized.includes('proventos') || normalized.includes('rendimento de investimento')) {
      return { icon: Coins, color: 'text-violet-500 bg-violet-500/10 border-violet-500/20 shadow-sm' };
    }
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
    if (normalized.includes('compra de investimentos') || normalized.includes('compra de investimento')) {
      return { icon: TrendingDown, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20 shadow-sm' };
    }
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

export function Dashboard() {
  const navigate = useNavigate();
  const savedDashboardPrefs = useMemo(() => cacheManager.get<any>('dashboard_preferences_v1') || null, []);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [showEffOpCost, setShowEffOpCost] = useState<boolean>(savedDashboardPrefs?.showEffOpCost ?? true);
  const [showEffFat, setShowEffFat] = useState<boolean>(savedDashboardPrefs?.showEffFat ?? true);
  const [showEffLucro, setShowEffLucro] = useState<boolean>(savedDashboardPrefs?.showEffLucro ?? true);
  const [pizzariaOrFreteTab, setPizzariaOrFreteTab] = useState<'pizzaria' | 'frete'>(savedDashboardPrefs?.pizzariaOrFreteTab || 'pizzaria');

  // Customizable margin thresholds
  const [marginThresholds, setMarginThresholds] = useState<{ 
    outstanding: number; 
    excellent: number; 
    healthy: number; 
    moderate: number; 
    attention: number;
    idealOp: number;
    idealPer: number;
  }>(() => {
    const parsed = cacheManager.get<any>('margin_thresholds');
    if (parsed) {
      return {
        outstanding: parsed.outstanding ?? 70,
        excellent: parsed.excellent ?? 50,
        healthy: parsed.healthy ?? 25,
        moderate: parsed.moderate ?? 10,
        attention: parsed.attention ?? 0,
        idealOp: parsed.idealOp ?? 70,
        idealPer: parsed.idealPer ?? 40
      };
    }
    return { outstanding: 70, excellent: 50, healthy: 25, moderate: 10, attention: 0, idealOp: 70, idealPer: 40 };
  });

  const parseDecimal = (val: string | number): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const normalized = String(val || '').replace(',', '.').trim();
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  };

  const [showMarginConfig, setShowMarginConfig] = useState(false);
  const [showFundamentalHelpDialog, setShowFundamentalHelpDialog] = useState(false);
  const [selectedFundamentalIndices, setSelectedFundamentalIndices] = useState<string[]>([]);
  const selectedFundamentalIndex = selectedFundamentalIndices[0] || null;
  const setSelectedFundamentalIndex = (key: string | null) => {
    if (key) {
      setSelectedFundamentalIndices([key]);
    } else {
      setSelectedFundamentalIndices([]);
    }
  };
  const [tempOutstanding, setTempOutstanding] = useState<string>(String(marginThresholds.outstanding).replace('.', ','));
  const [tempExcellent, setTempExcellent] = useState<string>(String(marginThresholds.excellent).replace('.', ','));
  const [tempHealthy, setTempHealthy] = useState<string>(String(marginThresholds.healthy).replace('.', ','));
  const [tempModerate, setTempModerate] = useState<string>(String(marginThresholds.moderate).replace('.', ','));
  const [tempAttention, setTempAttention] = useState<string>(String(marginThresholds.attention).replace('.', ','));
  const [tempIdealOp, setTempIdealOp] = useState<string>(String(marginThresholds.idealOp).replace('.', ','));
  const [tempIdealPer, setTempIdealPer] = useState<string>(String(marginThresholds.idealPer).replace('.', ','));

  const handleSaveThresholds = () => {
    const newThresholds = {
      outstanding: parseDecimal(tempOutstanding),
      excellent: parseDecimal(tempExcellent),
      healthy: parseDecimal(tempHealthy),
      moderate: parseDecimal(tempModerate),
      attention: parseDecimal(tempAttention),
      idealOp: parseDecimal(tempIdealOp),
      idealPer: parseDecimal(tempIdealPer),
    };
    setMarginThresholds(newThresholds);
    cacheManager.set('margin_thresholds', newThresholds, undefined, 'settings');
    setShowMarginConfig(false);
  };

  // Customizable KM Efficiency Targets
  const [kmTargets, setKmTargets] = useState<{
    targetOpKm: number;
    targetFatKm: number;
    targetLucroKm: number;
  }>(() => {
    const parsed = cacheManager.get<any>('km_targets');
    if (parsed) {
      return {
        targetOpKm: parsed.targetOpKm ?? 0.65,
        targetFatKm: parsed.targetFatKm ?? 2.50,
        targetLucroKm: parsed.targetLucroKm ?? 1.85,
      };
    }
    return { targetOpKm: 0.65, targetFatKm: 2.50, targetLucroKm: 1.85 };
  });

  const [showKmConfig, setShowKmConfig] = useState(false);
  const [tempTargetOpKm, setTempTargetOpKm] = useState<string>(String(kmTargets.targetOpKm).replace('.', ','));
  const [tempTargetFatKm, setTempTargetFatKm] = useState<string>(String(kmTargets.targetFatKm).replace('.', ','));
  const [tempTargetLucroKm, setTempTargetLucroKm] = useState<string>(String(kmTargets.targetLucroKm).replace('.', ','));

  const handleSaveKmTargets = () => {
    const updated = {
      targetOpKm: parseDecimal(tempTargetOpKm),
      targetFatKm: parseDecimal(tempTargetFatKm),
      targetLucroKm: parseDecimal(tempTargetLucroKm),
    };
    setKmTargets(updated);
    cacheManager.set('km_targets', updated, undefined, 'settings');
    setShowKmConfig(false);
  };

  // State for Personal Expense Bar Configuration
  const [showPersonalBarConfig, setShowPersonalBarConfig] = useState(false);
  const [personalBarCategories, setPersonalBarCategories] = useState<string[]>(() => {
    const cached = cacheManager.get<string[]>('personal_expense_bar_categories');
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
    try {
      const raw = localStorage.getItem('financas_pro_personal_expense_bar_categories');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [groupUnselectedCategories, setGroupUnselectedCategories] = useState<boolean>(() => {
    const cached = cacheManager.get<boolean>('personal_expense_bar_group_others');
    if (cached !== undefined && cached !== null) return Boolean(cached);
    try {
      const raw = localStorage.getItem('financas_pro_personal_expense_bar_group_others');
      if (raw !== null) return raw === 'true';
    } catch (e) {}
    return true;
  });

  const handleSavePersonalBarConfig = (cats: string[], groupOthers: boolean) => {
    setPersonalBarCategories(cats);
    setGroupUnselectedCategories(groupOthers);
    cacheManager.set('personal_expense_bar_categories', cats, undefined, 'settings');
    cacheManager.set('personal_expense_bar_group_others', groupOthers, undefined, 'settings');
    try {
      localStorage.setItem('financas_pro_personal_expense_bar_categories', JSON.stringify(cats));
      localStorage.setItem('financas_pro_personal_expense_bar_group_others', String(groupOthers));
    } catch (e) {}
  };

  const getCategoryBarColor = (categoryName: string, index: number) => {
    const norm = categoryName.toLowerCase();
    if (norm.includes('aliment') || norm.includes('lanche') || norm.includes('refeição') || norm.includes('almoço') || norm.includes('jantar')) {
      return { color: 'bg-orange-500', textColor: 'text-orange-500', textBoldColor: 'text-orange-600 dark:text-orange-400', dotColor: 'bg-orange-500' };
    }
    if (norm.includes('internet') || norm.includes('celular') || norm.includes('plano') || norm.includes('telefone')) {
      return { color: 'bg-violet-500', textColor: 'text-violet-500', textBoldColor: 'text-violet-600 dark:text-violet-400', dotColor: 'bg-violet-500' };
    }
    if (norm.includes('equipamento') || norm.includes('bag') || norm.includes('ferramenta') || norm.includes('capacete')) {
      return { color: 'bg-slate-500', textColor: 'text-slate-500', textBoldColor: 'text-slate-600 dark:text-slate-400', dotColor: 'bg-slate-500' };
    }
    if (norm.includes('moradia') || norm.includes('casa') || norm.includes('aluguel') || norm.includes('condom')) {
      return { color: 'bg-sky-500', textColor: 'text-sky-500', textBoldColor: 'text-sky-600 dark:text-sky-400', dotColor: 'bg-sky-500' };
    }
    if (norm.includes('saúde') || norm.includes('saude') || norm.includes('farmácia') || norm.includes('farmacia') || norm.includes('médic') || norm.includes('medic')) {
      return { color: 'bg-emerald-500', textColor: 'text-emerald-500', textBoldColor: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500' };
    }
    if (norm.includes('lazer') || norm.includes('viagem') || norm.includes('cinema') || norm.includes('festa')) {
      return { color: 'bg-pink-500', textColor: 'text-pink-500', textBoldColor: 'text-pink-600 dark:text-pink-400', dotColor: 'bg-pink-500' };
    }
    if (norm.includes('educa') || norm.includes('curso') || norm.includes('livro') || norm.includes('escola')) {
      return { color: 'bg-blue-500', textColor: 'text-blue-500', textBoldColor: 'text-blue-600 dark:text-blue-400', dotColor: 'bg-blue-500' };
    }
    if (norm.includes('transporte') || norm.includes('uber') || norm.includes('ônibus') || norm.includes('onibus') || norm.includes('metrô') || norm.includes('metro')) {
      return { color: 'bg-amber-500', textColor: 'text-amber-500', textBoldColor: 'text-amber-600 dark:text-amber-400', dotColor: 'bg-amber-500' };
    }
    if (norm.includes('outr') || norm.includes('demais')) {
      return { color: 'bg-zinc-400 dark:bg-zinc-500', textColor: 'text-zinc-500', textBoldColor: 'text-zinc-600 dark:text-zinc-400', dotColor: 'bg-zinc-400 dark:bg-zinc-500' };
    }
    const fallbackPalette = [
      { color: 'bg-rose-500', textColor: 'text-rose-500', textBoldColor: 'text-rose-600 dark:text-rose-400', dotColor: 'bg-rose-500' },
      { color: 'bg-teal-500', textColor: 'text-teal-500', textBoldColor: 'text-teal-600 dark:text-teal-400', dotColor: 'bg-teal-500' },
      { color: 'bg-indigo-500', textColor: 'text-indigo-500', textBoldColor: 'text-indigo-600 dark:text-indigo-400', dotColor: 'bg-indigo-500' },
      { color: 'bg-purple-500', textColor: 'text-purple-500', textBoldColor: 'text-purple-600 dark:text-purple-400', dotColor: 'bg-purple-500' },
      { color: 'bg-cyan-500', textColor: 'text-cyan-500', textBoldColor: 'text-cyan-600 dark:text-cyan-400', dotColor: 'bg-cyan-500' },
      { color: 'bg-fuchsia-500', textColor: 'text-fuchsia-500', textBoldColor: 'text-fuchsia-600 dark:text-fuchsia-400', dotColor: 'bg-fuchsia-500' },
    ];
    return fallbackPalette[index % fallbackPalette.length];
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logout realizado com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao fazer logout');
    }
  };

  const [showWeeklyGoalConfig, setShowWeeklyGoalConfig] = useState(false);
  const [tempWeeklyGoal, setTempWeeklyGoal] = useState<string>('');
  const [tempWeeklyNetGoal, setTempWeeklyNetGoal] = useState<string>('');

  const { 
    transactions, 
    settings, 
    loading,
    refreshData,
    globalPeriod, 
    setGlobalPeriod, 
    customDateRange, 
    setCustomDateRange, 
    hideValues, 
    setHideValues, 
    reserves, 
    reserveTransactions,
    investmentTransactions,
    dividends,
    quotes
  } = useData();

  const handleSaveWeeklyGoal = async () => {
    try {
      const userId = await getEffectiveUserId();
      const parsedValue = Number(String(tempWeeklyGoal || '').replace(/\D/g, '')) / 100;
      const parsedNetValue = Number(String(tempWeeklyNetGoal || '').replace(/\D/g, '')) / 100;
      if (userId) {
        if (navigator.onLine) {
          try {
            await supabase.from('user_settings').upsert({
              user_id: userId,
              weekly_goal: parsedValue,
              weekly_net_goal: parsedNetValue
            });
          } catch (err) {
            syncQueueManager.enqueue('settings', 'update', userId, {
              weekly_goal: parsedValue,
              weekly_net_goal: parsedNetValue
            });
          }
        } else {
          syncQueueManager.enqueue('settings', 'update', userId, {
            weekly_goal: parsedValue,
            weekly_net_goal: parsedNetValue
          });
        }
      }
      setShowWeeklyGoalConfig(false);
      refreshData(true);
    } catch (e) {
      console.error(e);
    }
  };

  const formatCompactValue = (val: number) => {
    if (hideValues) return 'R$ •••';
    const num = Number(val);
    if (isNaN(num)) return 'R$ 0';
    const isNegative = num < 0;
    const absVal = Math.abs(num);
    let formattedVal = '';
    
    if (absVal >= 1000000) {
      const v = absVal / 1000000;
      const truncated = Math.floor(v * 100) / 100;
      formattedVal = truncated.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + 'M';
    } else if (absVal >= 1000) {
      const v = absVal / 1000;
      const truncated = Math.floor(v * 100) / 100;
      formattedVal = truncated.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + 'k';
    } else {
      const formatted = formatCurrency(absVal, true);
      formattedVal = formatted.endsWith(',00') ? formatted.slice(0, -3) : formatted;
      return isNegative ? `-${formattedVal}` : formattedVal;
    }
    
    return isNegative ? `-R$ ${formattedVal}` : `R$ ${formattedVal}`;
  };

  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>(() => {
    if (savedDashboardPrefs?.visibleLines && typeof savedDashboardPrefs.visibleLines === 'object') {
      return savedDashboardPrefs.visibleLines;
    }
    return {
      Faturamento: true,
      DespesasTotais: true,
      LucroLiquido: false,
      DespesasOperacionais: false,
      DespesasPessoais: false,
      LucroPatrimonio: true,
      FaturamentoAnt: true,
      DespesasTotaisAnt: true,
      LucroPatrimonioAnt: true,
      LucroLiquidoAnt: false,
      DespesasOperacionaisAnt: false,
      DespesasPessoaisAnt: false,
    };
  });

  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorType | null>(null);

  const handleIndicatorModalOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) setSelectedIndicator(null);
  }, []);

  const getPeriodLabel = () => {
    switch (globalPeriod) {
      case 'today': return 'Hoje';
      case 'yesterday': return 'Ontem';
      case 'week': return 'Esta Semana';
      case 'last7Days': return 'Últimos 7 dias';
      case 'last30Days': return '30 dias';
      case 'last90Days': return '90 dias';
      case 'month': return 'Mês Atual';
      case 'lastMonth': return 'Mês Passado';
      case 'nextMonth': return 'Próximo Mês';
      case 'next30Days': return 'Próximos 30 dias';
      case 'future': return 'Futuro Agendado';
      case 'last3Months': return 'Últimos 3 meses';
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
            const startF = format(sDate, 'dd/MM/yyyy');
            const endF = format(eDate, 'dd/MM/yyyy');
            return `${startF} até ${endF}`;
          } catch {
            return 'Personalizado';
          }
        }
        return 'Personalizado';
      default: return 'Todo o Período';
    }
  };

  const cyclePeriod = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (globalPeriod === 'last30Days') {
      setGlobalPeriod('last90Days');
      toast.info('Período alterado para: 90 dias', { duration: 1500 });
    } else if (globalPeriod === 'last90Days') {
      setGlobalPeriod('thisYear');
      toast.info('Período alterado para: Este Ano', { duration: 1500 });
    } else {
      setGlobalPeriod('last30Days');
      toast.info('Período alterado para: 30 dias', { duration: 1500 });
    }
  };

  // Escala para o gráfico Ganhos vs Despesas proporcional ao período
  const [gainsExpensesScale, setGainsExpensesScale] = useState<'daily' | 'weekly' | 'monthly'>(() => {
    if (savedDashboardPrefs?.gainsExpensesScale) {
      return savedDashboardPrefs.gainsExpensesScale;
    }
    return 'weekly';
  });

  const availableGainsExpensesScales = useMemo((): ('daily' | 'weekly' | 'monthly')[] => {
    if (globalPeriod === 'thisYear' || globalPeriod === 'lastYear' || globalPeriod === 'all') {
      return ['weekly', 'monthly'];
    }
    if (globalPeriod === 'last90Days' || globalPeriod === 'last3Months') {
      return ['daily', 'weekly', 'monthly'];
    }
    // 30 dias e períodos menores/iguais a 30 dias (permite diária e semanal)
    return ['daily', 'weekly'];
  }, [globalPeriod]);

  const prevGlobalPeriodRef = useRef(globalPeriod);

  // Sincroniza a escala padrão proporcionalmente apenas quando o usuário altera o período:
  useEffect(() => {
    if (prevGlobalPeriodRef.current === globalPeriod) return;
    prevGlobalPeriodRef.current = globalPeriod;
    if (globalPeriod === 'last30Days') {
      setGainsExpensesScale('weekly');
    } else if (globalPeriod === 'last90Days' || globalPeriod === 'last3Months') {
      setGainsExpensesScale('weekly');
    } else if (globalPeriod === 'thisYear' || globalPeriod === 'lastYear' || globalPeriod === 'all') {
      setGainsExpensesScale('monthly');
    } else {
      setGainsExpensesScale('weekly');
    }
  }, [globalPeriod]);

  // Persistência automática das preferências de visualização do Dashboard
  useEffect(() => {
    cacheManager.set(
      'dashboard_preferences_v1',
      {
        showEffOpCost,
        showEffFat,
        showEffLucro,
        pizzariaOrFreteTab,
        visibleLines,
        gainsExpensesScale,
      },
      undefined,
      'settings'
    );
  }, [showEffOpCost, showEffFat, showEffLucro, pizzariaOrFreteTab, visibleLines, gainsExpensesScale]);

  const activeGainsExpensesScale = useMemo(() => {
    return availableGainsExpensesScales.includes(gainsExpensesScale)
      ? gainsExpensesScale
      : availableGainsExpensesScales[0];
  }, [availableGainsExpensesScales, gainsExpensesScale]);

  const handleLegendClick = (o: any) => {
    const { dataKey } = o;
    if (dataKey) {
      setVisibleLines(prev => {
        const isCurrentlyActive = prev[dataKey] !== false;
        return {
          ...prev,
          [dataKey]: !isCurrentlyActive,
          [`${dataKey}Ant`]: !isCurrentlyActive
        };
      });
    }
  };

  const formatLegendText = (value: string, entry: any) => {
    const dataKey = entry.dataKey;
    const isActive = visibleLines[dataKey || ''] !== false;
    return (
      <span style={{ color: isActive ? '#f4f4f5' : '#71717a', opacity: isActive ? 1 : 0.4, paddingRight: 8 }} className="select-none inline-flex items-center">
        {value}
      </span>
    );
  };

  const renderTrend = (value: number | null, isExpense = false) => {
    if (value === null) return null;
    const isPositive = value >= 0;
    const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
    const isGood = isExpense ? !isPositive : isPositive;
    const color = isGood ? 'text-emerald-500' : 'text-red-500';
    return (
      <div className={`flex items-center text-xs mt-1 ${color}`}>
        <Icon className="w-3 h-3 mr-1" />
        <span>{isPositive ? '+' : ''}{value.toFixed(1)}% vs período anterior</span>
      </div>
    );
  };

  // --- CALCULATIONS ---
  const {
    currentStart,
    currentEnd,
    pastStart,
    pastEnd,
    currentStartTime,
    currentEndTime,
    pastStartTime,
    pastEndTime,
    chartStart,
    chartEnd
  } = useMemo(() => {
    const nowDate = new Date();
    let cStart = new Date();
    let cEnd = new Date();
    let pStart = new Date();
    let pEnd = new Date();

    if (globalPeriod === 'today') {
      cStart = startOfDay(nowDate);
      cEnd = endOfDay(nowDate);
      pStart = startOfDay(subDays(nowDate, 1));
      pEnd = endOfDay(subDays(nowDate, 1));
    } else if (globalPeriod === 'yesterday') {
      cStart = startOfDay(subDays(nowDate, 1));
      cEnd = endOfDay(subDays(nowDate, 1));
      pStart = startOfDay(subDays(nowDate, 2));
      pEnd = endOfDay(subDays(nowDate, 2));
    } else if (globalPeriod === 'last7Days') {
      cStart = startOfDay(subDays(nowDate, 6));
      cEnd = endOfDay(nowDate);
      pStart = startOfDay(subDays(nowDate, 13));
      pEnd = endOfDay(subDays(nowDate, 7));
    } else if (globalPeriod === 'last30Days') {
      cStart = startOfDay(subDays(nowDate, 29));
      cEnd = endOfDay(nowDate);
      pStart = startOfDay(subDays(nowDate, 59));
      pEnd = endOfDay(subDays(nowDate, 30));
    } else if (globalPeriod === 'last90Days') {
      cStart = startOfDay(subDays(nowDate, 89));
      cEnd = endOfDay(nowDate);
      pStart = startOfDay(subDays(nowDate, 179));
      pEnd = endOfDay(subDays(nowDate, 90));
    } else if (globalPeriod === 'week') {
      cStart = startOfWeek(nowDate, { weekStartsOn: 1 });
      cEnd = endOfWeek(nowDate, { weekStartsOn: 1 });
      pStart = startOfWeek(subWeeks(nowDate, 1), { weekStartsOn: 1 });
      pEnd = subWeeks(nowDate, 1); // Compare up to same point in previous week
    } else if (globalPeriod === 'lastMonth') {
      const lastM = subMonths(nowDate, 1);
      cStart = startOfMonth(lastM);
      cEnd = endOfMonth(lastM);
      const pastM = subMonths(nowDate, 2);
      pStart = startOfMonth(pastM);
      pEnd = endOfMonth(pastM);
    } else if (globalPeriod === 'month') {
      cStart = startOfMonth(nowDate);
      cEnd = endOfMonth(nowDate);
      const pastM = subMonths(nowDate, 1);
      pStart = startOfMonth(pastM);
      pEnd = pastM; // Compare up to same point in previous month
    } else if (globalPeriod === 'nextMonth') {
      const nextM = addMonths(nowDate, 1);
      cStart = startOfMonth(nextM);
      cEnd = endOfMonth(nextM);
      pStart = startOfMonth(nowDate);
      pEnd = endOfMonth(nowDate);
    } else if (globalPeriod === 'next30Days') {
      cStart = startOfDay(nowDate);
      cEnd = endOfDay(addDays(nowDate, 30));
      pStart = startOfDay(subDays(nowDate, 30));
      pEnd = endOfDay(nowDate);
    } else if (globalPeriod === 'future') {
      cStart = startOfDay(addDays(nowDate, 1));
      cEnd = endOfYear(addYears(nowDate, 5));
      pStart = startOfMonth(nowDate);
      pEnd = endOfMonth(nowDate);
    } else if (globalPeriod === 'last3Months') {
      cStart = startOfDay(subMonths(nowDate, 3));
      cEnd = endOfDay(nowDate);
      pStart = startOfDay(subMonths(nowDate, 6));
      pEnd = startOfDay(subMonths(nowDate, 3));
    } else if (globalPeriod === 'thisYear') {
      cStart = startOfYear(nowDate);
      cEnd = endOfDay(nowDate);
      pStart = startOfYear(subYears(nowDate, 1));
      pEnd = subYears(nowDate, 1); // Compare up to same point in previous year
    } else if (globalPeriod === 'lastYear') {
      const lastY = subYears(nowDate, 1);
      cStart = startOfYear(lastY);
      cEnd = endOfYear(lastY);
      const pastY = subYears(nowDate, 2);
      pStart = startOfYear(pastY);
      pEnd = endOfYear(pastY);
    } else if (globalPeriod === 'custom' && customDateRange && customDateRange.start && customDateRange.end) {
      try {
        const parsedStart = parseLocalDate(customDateRange.start);
        const parsedEnd = parseLocalDate(customDateRange.end);
        if (!isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime())) {
          cStart = startOfDay(parsedStart);
          cEnd = endOfDay(parsedEnd);
          const isFullSingleMonth =
            cStart.getDate() === 1 &&
            cStart.getMonth() === cEnd.getMonth() &&
            cStart.getFullYear() === cEnd.getFullYear() &&
            cEnd.getDate() === endOfMonth(cStart).getDate();
          if (isFullSingleMonth) {
            const prevM = subMonths(cStart, 1);
            pStart = startOfMonth(prevM);
            pEnd = endOfMonth(prevM);
          } else {
            const duration = cEnd.getTime() - cStart.getTime();
            pEnd = new Date(cStart.getTime() - 1);
            pStart = new Date(pEnd.getTime() - duration);
          }
        }
      } catch {
        // Fallback already prefilled
      }
    }

    let chStart = cStart;
    let chEnd = cEnd > nowDate ? endOfDay(nowDate) : cEnd;
    if (globalPeriod === 'all') {
      chStart = startOfDay(subDays(nowDate, 29));
      chEnd = endOfDay(nowDate);
    }

    return {
      currentStart: cStart,
      currentEnd: cEnd,
      pastStart: pStart,
      pastEnd: pEnd,
      currentStartTime: cStart.getTime(),
      currentEndTime: cEnd.getTime(),
      pastStartTime: pStart.getTime(),
      pastEndTime: pEnd.getTime(),
      chartStart: chStart,
      chartEnd: chEnd
    };
  }, [globalPeriod, customDateRange]);

  const now = useMemo(() => new Date(), []);

  const handleStepDashboardPeriod = useCallback((direction: -1 | 1) => {
    const nowDate = new Date();
    const isSingleMonthCustom =
      globalPeriod === 'custom' &&
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

    if (globalPeriod === 'month' || globalPeriod === 'lastMonth' || globalPeriod === 'nextMonth' || isSingleMonthCustom) {
      const targetMonth = addMonths(currentStart, direction);
      const isCurrM = targetMonth.getMonth() === nowDate.getMonth() && targetMonth.getFullYear() === nowDate.getFullYear();
      const prevM = subMonths(nowDate, 1);
      const isLastM = targetMonth.getMonth() === prevM.getMonth() && targetMonth.getFullYear() === prevM.getFullYear();
      const nextM = addMonths(nowDate, 1);
      const isNextM = targetMonth.getMonth() === nextM.getMonth() && targetMonth.getFullYear() === nextM.getFullYear();

      if (isCurrM) {
        setGlobalPeriod('month');
      } else if (isLastM) {
        setGlobalPeriod('lastMonth');
      } else if (isNextM) {
        setGlobalPeriod('nextMonth');
      } else {
        setCustomDateRange({
          start: format(startOfMonth(targetMonth), 'yyyy-MM-dd'),
          end: format(endOfMonth(targetMonth), 'yyyy-MM-dd'),
        });
        setGlobalPeriod('custom');
      }
      return;
    }

    if (globalPeriod === 'thisYear' || globalPeriod === 'lastYear') {
      const targetYear = addYears(currentStart, direction);
      const isCurrY = targetYear.getFullYear() === nowDate.getFullYear();
      const isLastY = targetYear.getFullYear() === nowDate.getFullYear() - 1;
      if (isCurrY) {
        setGlobalPeriod('thisYear');
      } else if (isLastY) {
        setGlobalPeriod('lastYear');
      } else {
        setCustomDateRange({
          start: format(startOfYear(targetYear), 'yyyy-MM-dd'),
          end: format(endOfYear(targetYear), 'yyyy-MM-dd'),
        });
        setGlobalPeriod('custom');
      }
      return;
    }

    const daysSpan = Math.max(1, differenceInCalendarDays(currentEnd, currentStart) + 1);
    const nextStart = addDays(currentStart, direction * daysSpan);
    const nextEnd = addDays(currentEnd, direction * daysSpan);
    setCustomDateRange({
      start: format(nextStart, 'yyyy-MM-dd'),
      end: format(nextEnd, 'yyyy-MM-dd'),
    });
    setGlobalPeriod('custom');
  }, [globalPeriod, customDateRange, currentStart, currentEnd, setGlobalPeriod, setCustomDateRange]);

  // Create virtual transaction objects for reserve transactions (aporte, rendimento, utilizacao)
  const reserveAportesAsTxs = useMemo(() => {
    return (reserveTransactions || [])
      .filter(rt => {
        if (rt.linked_investment_id) return false;
        // Evita duplicar provento/dividendo gerenciado pela página de investimentos com o lançamento das reservas
        const isLinkedToDividend = (dividends || []).some(d => 
          d.transaction_id === rt.id || 
          rt.transaction_id === d.id ||
          (
            (rt.type === 'aporte' || rt.type === 'rendimento') &&
            d.ticker && rt.description?.toUpperCase().includes(d.ticker.toUpperCase()) &&
            Math.abs(Number(d.amount) - Number(rt.amount)) < 0.001 &&
            (d.data_ex === rt.date || d.date === rt.date)
          )
        );
        if (isLinkedToDividend) return false;
        return true;
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
          isReserveAporte: rt.type === 'aporte',
          isReserveTx: true,
          reserveTxType: rt.type,
          reserveName: reserveName,
          reserveColor: matchedRes?.color || '#ec4899',
          reserveIcon: matchedRes?.icon || 'PiggyBank',
          created_at: rt.created_at,
          originalCategory: rt.category,
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
  }, [reserveTransactions, reserves, dividends]);

  const adjustTransactionsForReserves = (txs: Transaction[]) => {
    return txs;
  };

  // Create virtual transaction objects for dividend payments
  const dividendTxsAsVirtual = useMemo(() => {
    return (dividends || [])
      .map(d => {
        const displayType = d.type === 'JCP' || (d.type as string) === 'JSCP' ? 'JSCP' : d.type;
        return {
          id: d.id,
          user_id: d.user_id,
          type: 'income' as const,
          amount: Number(d.amount),
          date: d.date,
          category: 'Dividendos',
          description: d.description || `Recebimento de proventos (${displayType}) do ativo ${d.ticker.toUpperCase()}`,
          isDividendTx: true,
          dividendType: displayType,
          ticker: d.ticker.toUpperCase(),
          created_at: d.created_at,
        } as unknown as Transaction;
      });
  }, [dividends]);

  // Create virtual transaction objects for investment transactions
  const investmentTxsAsVirtual = useMemo(() => {
    return (investmentTransactions || [])
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
  }, [investmentTransactions]);

  const allTransactions = useMemo(() => {
    return [...transactions, ...reserveAportesAsTxs, ...investmentTxsAsVirtual, ...dividendTxsAsVirtual];
  }, [transactions, reserveAportesAsTxs, investmentTxsAsVirtual, dividendTxsAsVirtual]);

  const allTransactionsAdjusted = useMemo(() => {
    const base = adjustTransactionsForReserves(allTransactions);
    return base.map(t => {
      const effectiveDateStr = (t as any).payment_status === 'pending'
        ? ((t as any).due_date || t.date)
        : ((t as any).payment_date || t.date);
      const dateStr = effectiveDateStr.split('T')[0];
      const parsedDate = parseLocalDate(effectiveDateStr);
      return {
        ...t,
        _dateStr: dateStr,
        _monthStr: dateStr.substring(0, 7),
        _ts: parsedDate.getTime(),
      };
    });
  }, [allTransactions, settings]);

  const currentPeriodTx = useMemo(() => {
    if (globalPeriod === 'all') return allTransactionsAdjusted;
    return allTransactionsAdjusted.filter(t => (t as any)._ts >= currentStartTime && (t as any)._ts <= currentEndTime);
  }, [allTransactionsAdjusted, globalPeriod, currentStartTime, currentEndTime]);

  const pastPeriodTx = useMemo(() => {
    if (globalPeriod === 'all') return [];
    return allTransactionsAdjusted.filter(t => (t as any)._ts >= pastStartTime && (t as any)._ts <= pastEndTime);
  }, [allTransactionsAdjusted, globalPeriod, pastStartTime, pastEndTime]);

  const currentPeriodInvTx = useMemo(() => {
    if (!investmentTransactions || investmentTransactions.length === 0) return [];
    if (globalPeriod === 'all') return investmentTransactions;
    return investmentTransactions.filter(t => {
      const ts = parseLocalDate(t.date).getTime();
      return ts >= currentStartTime && ts <= currentEndTime;
    });
  }, [investmentTransactions, globalPeriod, currentStartTime, currentEndTime]);

  const pastPeriodInvTx = useMemo(() => {
    if (!investmentTransactions || investmentTransactions.length === 0 || globalPeriod === 'all') return [];
    return investmentTransactions.filter(t => {
      const ts = parseLocalDate(t.date).getTime();
      return ts >= pastStartTime && ts <= pastEndTime;
    });
  }, [investmentTransactions, globalPeriod, pastStartTime, pastEndTime]);

  const currentPeriodDividends = useMemo(() => {
    if (!dividends || dividends.length === 0) return [];
    if (globalPeriod === 'all') return dividends;
    return dividends.filter(t => {
      const ts = parseLocalDate(t.date).getTime();
      return ts >= currentStartTime && ts <= currentEndTime;
    });
  }, [dividends, globalPeriod, currentStartTime, currentEndTime]);

  const pastPeriodDividends = useMemo(() => {
    if (!dividends || dividends.length === 0 || globalPeriod === 'all') return [];
    return dividends.filter(t => {
      const ts = parseLocalDate(t.date).getTime();
      return ts >= pastStartTime && ts <= pastEndTime;
    });
  }, [dividends, globalPeriod, pastStartTime, pastEndTime]);

  const currentPeriodInvBuys = useMemo(() => {
    return currentPeriodInvTx.filter(t => t.operation === 'buy').reduce((acc, t) => acc + Number(t.amount), 0);
  }, [currentPeriodInvTx]);

  const currentPeriodInvSells = useMemo(() => {
    return currentPeriodInvTx.filter(t => t.operation === 'sell').reduce((acc, t) => acc + Number(t.amount), 0);
  }, [currentPeriodInvTx]);

  const currentPeriodDivSum = useMemo(() => {
    return currentPeriodDividends.reduce((acc, t) => acc + Number(t.amount), 0);
  }, [currentPeriodDividends]);

  const pastPeriodInvBuys = useMemo(() => {
    return pastPeriodInvTx.filter(t => t.operation === 'buy').reduce((acc, t) => acc + Number(t.amount), 0);
  }, [pastPeriodInvTx]);

  const pastPeriodInvSells = useMemo(() => {
    return pastPeriodInvTx.filter(t => t.operation === 'sell').reduce((acc, t) => acc + Number(t.amount), 0);
  }, [pastPeriodInvTx]);

  const pastPeriodDivSum = useMemo(() => {
    return pastPeriodDividends.reduce((acc, t) => acc + Number(t.amount), 0);
  }, [pastPeriodDividends]);

  const isPersonalOpCategory = useCallback((cat: string) => {
    if (!cat) return false;
    const opCats = settings?.operational_expense_categories || ['Combustível', 'Pedágio', 'Manutenção'];
    const norm = cat.toLowerCase().trim();
    return opCats.includes(cat) || 
      norm === 'combustível' || norm === 'combustivel' || 
      norm === 'manutenção' || norm === 'manutencao' || 
      norm === 'pedágio' || norm === 'pedagio';
  }, [settings?.operational_expense_categories]);

  const availablePersonalCategories = useMemo(() => {
    const defaultCats = settings?.personal_expense_categories || [
      'Alimentação',
      'Plano de Internet',
      'Equipamento',
      'Moradia',
      'Lazer',
      'Saúde',
      'Transporte Pessoal',
      'Outras Despesas',
      'Outros'
    ];

    const txCats = new Set<string>();
    (allTransactionsAdjusted || []).forEach(t => {
      if (t.type === 'expense' && !isPersonalOpCategory(t.category) && t.category !== 'Aporte Reserva' && !(t as any).isInvestmentTx) {
        if (t.category && t.category.trim()) {
          txCats.add(t.category.trim());
        }
      }
    });

    return Array.from(new Set([...defaultCats, ...Array.from(txCats)]));
  }, [settings?.personal_expense_categories, allTransactionsAdjusted, isPersonalOpCategory]);

  const currentPeriodPersonalCategoryAmounts = useMemo(() => {
    const amounts: Record<string, number> = {};
    (currentPeriodTx || []).forEach(t => {
      if (t.type !== 'expense') return;
      if ((t as any).payment_status === 'pending') return;
      if ((t as any).isInvestmentTx) return;
      if (t.category === 'Aporte Reserva' || (t as any).isReserveAporte) return;
      if (isPersonalOpCategory(t.category)) return;

      const cat = t.category || 'Outros';
      const rawAmt = (t as any).rawAmount !== undefined ? Number((t as any).rawAmount) : Number(t.amount);
      amounts[cat] = (amounts[cat] || 0) + rawAmt;
    });
    return amounts;
  }, [currentPeriodTx, isPersonalOpCategory]);

  const calcTotals = (txs: Transaction[]) => {
    const inc = txs.filter(t => t.type === 'income' && (t as any).payment_status !== 'pending').reduce((acc, t) => acc + Number(t.amount), 0);
    const rendimentosReserva = txs
      .filter(t => ((t as any).reserveTxType === 'rendimento' || (t as any).isDividendTx) && (t as any).payment_status !== 'pending')
      .reduce((acc, t) => acc + Number(t.amount), 0);
    
    let totalCompraInvestimento = 0;
    let totalVendaInvestimento = 0;
    let fuelExpense = 0;
    let fuelReserve = 0;
    let maintenanceExpense = 0;

    const opCats = settings?.operational_expense_categories || ['Combustível', 'Pedágio', 'Manutenção'];

    const isFuelCategory = (cat: string) => {
      if (!cat) return false;
      const normalized = cat.toLowerCase().trim();
      return normalized === 'combustível' || normalized === 'combustivel';
    };

    const isMaintCategory = (cat: string) => {
      if (!cat) return false;
      const normalized = cat.toLowerCase().trim();
      return normalized === 'manutenção' || normalized === 'manutencao';
    };

    const isTollCategory = (cat: string) => {
      if (!cat) return false;
      const normalized = cat.toLowerCase().trim();
      return normalized === 'pedágio' || normalized === 'pedagio';
    };

    const isOpCategory = (cat: string) => {
      if (!cat) return false;
      return opCats.includes(cat) || isFuelCategory(cat) || isMaintCategory(cat) || isTollCategory(cat);
    };

    txs.forEach(t => {
      if ((t as any).payment_status === 'pending') {
        return;
      }
      if ((t as any).isInvestmentTx) {
        if (t.type === 'income') {
          totalVendaInvestimento += Number(t.amount);
        } else {
          totalCompraInvestimento += Number(t.amount);
        }
        return;
      }
      if (t.category === 'Aporte Reserva' || (t as any).isReserveAporte) {
        return;
      }
      const rawAmt = (t as any).rawAmount !== undefined ? Number((t as any).rawAmount) : Number(t.amount);
      if (t.type === 'expense') {
        if (isFuelCategory(t.category)) {
          fuelExpense += rawAmt;
          const isReserveUse = t.is_reserve_use === true || (t as any).isReserveUseOriginal === true || (t as any).isReserveTx === true;
          if (isReserveUse) {
            fuelReserve += rawAmt;
          }
        } else if (isMaintCategory(t.category)) {
          maintenanceExpense += rawAmt;
        }
      }
    });

    let opExpPuro = 0;
    let perExpPuro = 0;
    let opExpReserve = 0;
    let perExpReserve = 0;
    let reserveSpending = 0;
    let rawReserveAporte = 0;
    let kmRodado = 0;
    const categoriesWithKm = settings?.categories_with_km || [];
    
    // First, just accumulate KM across all transactions that have valid KM in the correct categories
    txs.forEach(t => {
      if ((t as any).payment_status === 'pending') return;
      if (categoriesWithKm.includes(t.category) && t.end_km && t.start_km && t.end_km >= t.start_km) {
        kmRodado += (t.end_km - t.start_km);
      }
    });

    txs.filter(t => t.type === 'expense').forEach(t => {
      if ((t as any).isInvestmentTx || (t as any).payment_status === 'pending') {
        // Asset purchases or pending expenses do not count as realized expenses
        return;
      }
      const isReserveAporteVal = (t as any).isReserveAporte === true || t.category === 'Aporte Reserva';
      const isReserveUse = t.is_reserve_use === true || (t as any).isReserveUseOriginal === true || (t as any).isReserveTx === true;
      const rawAmt = (t as any).rawAmount !== undefined ? Number((t as any).rawAmount) : Number(t.amount);

      if (isReserveAporteVal) {
        rawReserveAporte += rawAmt;
      } else if (isReserveUse) {
        reserveSpending += rawAmt;
        
        // Also add to operational or personal pure expense based on category!
        if (isOpCategory(t.category)) {
          opExpPuro += rawAmt;
          opExpReserve += rawAmt;
        } else {
          perExpPuro += rawAmt;
          perExpReserve += rawAmt;
        }
      } else {
        // Regular expenses
        if (isOpCategory(t.category)) {
          opExpPuro += rawAmt;
        } else {
          perExpPuro += rawAmt;
        }
      }
    });

    const incomeNoRendimento = inc - rendimentosReserva - totalVendaInvestimento;
    const reserveAporte = rawReserveAporte - reserveSpending;
    const realExpense = opExpPuro + perExpPuro;
    const standardExpense = opExpPuro + perExpPuro + reserveAporte;

    return { 
      income: incomeNoRendimento, 
      expense: realExpense, 
      net: incomeNoRendimento - standardExpense, 
      opExp: opExpPuro + rawReserveAporte, 
      opExpPuro,
      opExpReserve,
      perExp: perExpPuro, 
      perExpReserve,
      reserveSpending,
      reserveAporte,
      rawReserveAporte,
      km: kmRodado,
      rendimentosReserva,
      totalCompraInvestimento,
      totalVendaInvestimento,
      fuelExpense,
      fuelReserve,
      maintenanceExpense,
    };
  };

  const current = useMemo(() => calcTotals(currentPeriodTx), [currentPeriodTx, settings]);
  const past = useMemo(() => calcTotals(pastPeriodTx), [pastPeriodTx, settings]);

  // Helper to compute indicator value for a specific list of transactions in a month
  const getIndicatorMonthValue = useCallback((
    ind: IndicatorType,
    monthStr: string,
    mTxs: Transaction[]
  ): number => {
    const totals = calcTotals(mTxs);

    switch (ind) {
      case 'faturamento_bruto': {
        return Number((totals.income + (totals.totalVendaInvestimento || 0) + (totals.rendimentosReserva || 0)).toFixed(2));
      }
      case 'fat_liquido_op': {
        return Number((totals.income - totals.opExpPuro).toFixed(2));
      }
      case 'gastos_totais': {
        const valOperacional = totals.opExpPuro || 0;
        const investmentReserve = (reserves || []).find(r => 
          (settings?.default_investment_reserve_id && r.id === settings.default_investment_reserve_id) || 
          r.name.toLowerCase().includes('invest') || 
          r.name.toLowerCase().includes('ativo') ||
          r.name.toLowerCase().includes('carteira')
        );
        const investmentReserveId = investmentReserve?.id;

        const valResgatesInv = (reserveTransactions || [])
          .filter(rt => {
            const isMatch = investmentReserveId 
              ? rt.reserve_id === investmentReserveId 
              : rt.description?.toLowerCase().includes('invest') || rt.description?.toLowerCase().includes('ativo');
            const isAssetPurchase = rt.linked_investment_id || rt.description?.toLowerCase().includes('compra');
            const rtDateStr = (rt.payment_date || rt.date || '').split('T')[0];
            return isMatch && rt.type === 'utilizacao' && !isAssetPurchase && rtDateStr.startsWith(monthStr);
          })
          .reduce((sum, rt) => sum + Number(rt.amount), 0);

        const valPessoal = Math.max(0, (totals.perExp || 0) - valResgatesInv);
        return Number((valOperacional + valPessoal).toFixed(2));
      }
      case 'operacional_puro': {
        return Number((totals.opExpPuro || 0).toFixed(2));
      }
      case 'lucro_liquido': {
        return Number((totals.net + totals.reserveAporte + (totals.rendimentosReserva || 0) - (totals.totalVendaInvestimento || 0)).toFixed(2));
      }
      case 'balanco_caixa': {
        return Number((totals.net || 0).toFixed(2));
      }
      case 'gasto_pessoal': {
        return Number((totals.perExp || 0).toFixed(2));
      }
      case 'km_rodado': {
        return Math.round(totals.km || 0);
      }
      case 'combustivel': {
        const actualFuel = mTxs
          .filter(t => t.type === 'expense' && ((t.category || '').toLowerCase().trim() === 'combustível' || (t.category || '').toLowerCase().trim() === 'combustivel'))
          .reduce((acc, t) => acc + Number(t.amount), 0);
        return Number(actualFuel.toFixed(2));
      }
      default:
        return 0;
    }
  }, [settings, reserves, reserveTransactions]);

  const allRecordedMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    (allTransactionsAdjusted || []).forEach(t => {
      const m = (t as any)._monthStr;
      if (m && m.length === 7) {
        monthsSet.add(m);
      }
    });
    (reserveTransactions || []).forEach(rt => {
      const d = (rt.payment_date || rt.date || '').split('T')[0];
      if (d && d.length >= 7) {
        monthsSet.add(d.substring(0, 7));
      }
    });
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [allTransactionsAdjusted, reserveTransactions]);

  const currentPeriodMonths = useMemo(() => {
    if (globalPeriod === 'all') return allRecordedMonths;
    const set = new Set<string>();
    (currentPeriodTx || []).forEach(t => {
      const m = (t as any)._monthStr;
      if (m && m.length === 7) {
        set.add(m);
      }
    });
    const sorted = Array.from(set).sort((a, b) => b.localeCompare(a));
    return sorted.length > 0 ? sorted : allRecordedMonths;
  }, [globalPeriod, currentPeriodTx, allRecordedMonths]);

  const formatMonthTitle = useCallback((monthStr: string) => {
    try {
      const [year, month] = monthStr.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      const name = format(date, 'MMMM', { locale: ptBR });
      return `${name.charAt(0).toUpperCase() + name.slice(1)}/${year}`;
    } catch {
      return monthStr;
    }
  }, []);

  const formatMonthShort = useCallback((monthStr: string) => {
    try {
      const [year, month] = monthStr.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      const name = format(date, 'MMM', { locale: ptBR });
      return `${name.charAt(0).toUpperCase() + name.slice(1)}/${year.slice(2)}`;
    } catch {
      return monthStr;
    }
  }, []);

  const allIndicatorHistoryData = useMemo((): MonthHistoryItem[] => {
    if (!selectedIndicator) return [];

    const currentMonthStr = format(new Date(), 'yyyy-MM');
    const chronologicalMonths = [...allRecordedMonths].reverse();
    const chronologicalResults: MonthHistoryItem[] = [];

    chronologicalMonths.forEach((mStr) => {
      const mTxs = (allTransactionsAdjusted || []).filter(t => (t as any)._monthStr === mStr);
      const val = getIndicatorMonthValue(selectedIndicator, mStr, mTxs);

      // "Nos gráficos e tabelas não mostre os valores zerados que ainda irão vir"
      if (mStr > currentMonthStr && val === 0) {
        return;
      }

      let changePct: number | null = null;
      if (chronologicalResults.length > 0) {
        const prevVal = chronologicalResults[chronologicalResults.length - 1].value;
        if (prevVal !== 0) {
          changePct = ((val - prevVal) / Math.abs(prevVal)) * 100;
        } else if (val > 0) {
          changePct = 100;
        }
      }

      const unit = selectedIndicator === 'km_rodado' ? 'km' : 'currency';
      chronologicalResults.push({
        monthStr: mStr,
        label: formatMonthTitle(mStr),
        shortLabel: formatMonthShort(mStr),
        value: val,
        formattedValue: formatIndicatorValue(val, unit, false),
        changePct,
        txCount: mTxs.length,
      });
    });

    return [...chronologicalResults].reverse();
  }, [selectedIndicator, allRecordedMonths, allTransactionsAdjusted, getIndicatorMonthValue, formatMonthTitle, formatMonthShort]);

  const filteredIndicatorHistoryData = useMemo((): MonthHistoryItem[] => {
    if (!selectedIndicator) return [];
    const set = new Set(currentPeriodMonths);
    const currentMonthStr = format(new Date(), 'yyyy-MM');
    return allIndicatorHistoryData.filter(item => {
      if (!set.has(item.monthStr)) return false;
      if (item.monthStr > currentMonthStr && item.value === 0) return false;
      return true;
    });
  }, [selectedIndicator, currentPeriodMonths, allIndicatorHistoryData]);

  const totalInReserves = useMemo(() => {
    return (reserves || []).reduce((sum, r) => sum + (r.saldo_atual || 0), 0);
  }, [reserves]);

  const totalDepositedInReservesPeriod = useMemo(() => {
    return (reserveTransactions || [])
      .filter(rt => {
        if (rt.type !== 'aporte') return false;
        if (rt.payment_status === 'pending') return false;
        if (globalPeriod === 'all') return true;
        const ts = parseLocalDate(rt.date).getTime();
        return ts >= currentStartTime && ts <= currentEndTime;
      })
      .reduce((sum, rt) => sum + Number(rt.amount), 0);
  }, [reserveTransactions, globalPeriod, currentStartTime, currentEndTime]);

  const totalRendimentosInReservesPeriod = useMemo(() => {
    return (reserveTransactions || [])
      .filter(rt => {
        if (rt.type !== 'rendimento') return false;
        if (rt.payment_status === 'pending') return false;
        if (globalPeriod === 'all') return true;
        const ts = parseLocalDate(rt.date).getTime();
        return ts >= currentStartTime && ts <= currentEndTime;
      })
      .reduce((sum, rt) => sum + Number(rt.amount), 0);
  }, [reserveTransactions, globalPeriod, currentStartTime, currentEndTime]);

  const isAssetPurchaseReserveTx = (rt: any) => {
    if (!rt) return false;
    const cat = (rt.category || '').toLowerCase().trim();
    const desc = (rt.description || '').toLowerCase().trim();
    return Boolean(
      rt.linked_investment_id ||
      (rt as any).linkedInvestmentId ||
      cat === 'investimentos' ||
      cat === 'investimento' ||
      cat === 'investimento na carteira' ||
      desc.includes('investiment') ||
      desc.includes('compra de ativo') ||
      desc.includes('compra ativo')
    );
  };

  const totalUtilizadosInReservesPeriod = useMemo(() => {
    return (reserveTransactions || [])
      .filter(rt => {
        if (rt.type !== 'utilizacao') return false;
        if (rt.payment_status === 'pending') return false;
        if (isAssetPurchaseReserveTx(rt)) return false;
        if (globalPeriod === 'all') return true;
        const effectiveDateStr = rt.payment_date || rt.date;
        const ts = parseLocalDate(effectiveDateStr).getTime();
        return ts >= currentStartTime && ts <= currentEndTime;
      })
      .reduce((sum, rt) => sum + Number(rt.amount), 0);
  }, [reserveTransactions, globalPeriod, currentStartTime, currentEndTime]);

  const pastTotalUtilizadosInReservesPeriod = useMemo(() => {
    if (globalPeriod === 'all') return 0;
    return (reserveTransactions || [])
      .filter(rt => {
        if (rt.type !== 'utilizacao') return false;
        if (rt.payment_status === 'pending') return false;
        if (isAssetPurchaseReserveTx(rt)) return false;
        const effectiveDateStr = rt.payment_date || rt.date;
        const ts = parseLocalDate(effectiveDateStr).getTime();
        return ts >= pastStartTime && ts <= pastEndTime;
      })
      .reduce((sum, rt) => sum + Number(rt.amount), 0);
  }, [reserveTransactions, globalPeriod, pastStartTime, pastEndTime]);

  const unlinkedReserveAssetPurchasesCurrent = useMemo(() => {
    return (reserveTransactions || [])
      .filter(rt => {
        if (rt.type !== 'utilizacao') return false;
        if (rt.payment_status === 'pending') return false;
        if (rt.linked_investment_id) return false;
        if (!isAssetPurchaseReserveTx(rt)) return false;
        if (globalPeriod === 'all') return true;
        const ts = parseLocalDate(rt.date).getTime();
        return ts >= currentStartTime && ts <= currentEndTime;
      })
      .reduce((sum, rt) => sum + Number(rt.amount), 0);
  }, [reserveTransactions, globalPeriod, currentStartTime, currentEndTime]);

  const totalInvestedInPeriodCurrent = useMemo(() => {
    return (currentPeriodInvBuys || 0) + unlinkedReserveAssetPurchasesCurrent;
  }, [currentPeriodInvBuys, unlinkedReserveAssetPurchasesCurrent]);

  const unlinkedReserveAssetPurchasesPast = useMemo(() => {
    if (globalPeriod === 'all') return 0;
    return (reserveTransactions || [])
      .filter(rt => {
        if (rt.type !== 'utilizacao') return false;
        if (rt.payment_status === 'pending') return false;
        if (rt.linked_investment_id) return false;
        if (!isAssetPurchaseReserveTx(rt)) return false;
        const ts = parseLocalDate(rt.date).getTime();
        return ts >= pastStartTime && ts <= pastEndTime;
      })
      .reduce((sum, rt) => sum + Number(rt.amount), 0);
  }, [reserveTransactions, globalPeriod, pastStartTime, pastEndTime]);

  const pastPeriodInvBuysTotal = useMemo(() => {
    const buys = pastPeriodInvTx.filter(t => t.operation === 'buy').reduce((acc, t) => acc + Number(t.amount), 0);
    return buys + unlinkedReserveAssetPurchasesPast;
  }, [pastPeriodInvTx, unlinkedReserveAssetPurchasesPast]);

  const reserveMovimentacaoPeriod = useMemo(() => {
    return totalDepositedInReservesPeriod + totalRendimentosInReservesPeriod - totalUtilizadosInReservesPeriod;
  }, [totalDepositedInReservesPeriod, totalRendimentosInReservesPeriod, totalUtilizadosInReservesPeriod]);

  const sortedReservesByLastTransaction = useMemo(() => {
    if (!reserves) return [];
    
    // Create a map of reserve_id to its latest transaction date
    const latestTxMap: Record<string, string> = {};
    (reserveTransactions || []).forEach(rt => {
      const currentLatest = latestTxMap[rt.reserve_id];
      if (!currentLatest || rt.date > currentLatest) {
        latestTxMap[rt.reserve_id] = rt.date;
      }
    });

    return [...reserves].sort((a, b) => {
      const dateA = latestTxMap[a.id] || '';
      const dateB = latestTxMap[b.id] || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA); // most recent first
      }
      return a.name.localeCompare(b.name);
    });
  }, [reserves, reserveTransactions]);

  const totalInvestmentEquity = useMemo(() => {
    const posMap: Record<string, number> = {};
    investmentTransactions.forEach(tx => {
      const q = Number(tx.quantity);
      if (tx.operation === 'buy') {
        posMap[tx.ticker] = (posMap[tx.ticker] || 0) + q;
      } else {
        posMap[tx.ticker] = (posMap[tx.ticker] || 0) - q;
      }
    });

    return Object.entries(posMap).reduce((acc, [ticker, quantity]) => {
      if (quantity <= 0) return acc;
      const price = quotes[ticker] || 0;
      if (price > 0) {
        return acc + (price * quantity);
      }
      const lastTx = investmentTransactions
        .filter(t => t.ticker === ticker)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
      const fallbackPrice = lastTx ? Number(lastTx.price) : 0;
      return acc + (fallbackPrice * quantity);
    }, 0);
  }, [investmentTransactions, quotes]);

  const allTimeTotalsRaw = useMemo(() => {
    let rawNet = 0;
    transactions.forEach(t => {
      if (t.payment_status === 'pending') return;
      const amount = Number(t.amount);
      // Skip internal transfers between Caixa and Reservas
      if (t.category === 'Aporte Reserva' || t.category === 'Resgate Reserva' || t.category === 'Resgate de Reserva' || (t as any).isReserveTx || (t as any).isReserveAporte) {
        return;
      }
      if (t.type === 'income') rawNet += amount;
      else rawNet -= amount;
    });

    // Subtract investment buys and add sells from cash balance (they are outflows/inflows of cash)
    investmentTransactions.forEach(tx => {
      if (tx.reserve_id) return; // Handled by reserve_transactions
      if ((tx as any).payment_status === 'pending') return;
      const amount = (Number(tx.price) * Number(tx.quantity)) + Number(tx.costs || 0);
      if (tx.operation === 'buy') {
        rawNet -= amount;
      } else {
        rawNet += amount;
      }
    });

    // Include 'rendimento' and spent 'utilizacao' from reserves into total liquid net
    (reserveTransactions || []).forEach(rt => {
      if (rt.payment_status === 'pending') return;
      if (rt.type === 'rendimento') {
        rawNet += Number(rt.amount);
      } else if (rt.type === 'utilizacao') {
        const cat = (rt.category || '').toLowerCase().trim();
        const isPureResgateToCash = !rt.linked_investment_id && (!cat || cat === 'resgate' || cat === 'resgate reserva' || cat === 'resgate de reserva' || cat === 'outros');
        if (!isPureResgateToCash) {
          rawNet -= Number(rt.amount);
        }
      }
    });
    return rawNet;
  }, [transactions, reserveTransactions, investmentTransactions]);

  const caixaMaisReservas = (settings?.initial_balance || 0) + allTimeTotalsRaw;
  const bancaLivre = caixaMaisReservas - totalInReserves;
  const totalPatrimony = bancaLivre + totalInReserves + totalInvestmentEquity;

  const weeklyGoalStats = useMemo(() => {
    const today = new Date();
    // Use weekStartsOn: 1 (Monday) as it's common in Brazil
    const startOfW = startOfWeek(today, { weekStartsOn: 1 });
    const endOfW = endOfWeek(today, { weekStartsOn: 1 });
    
    const startOfLastW = subWeeks(startOfW, 1);
    const endOfLastW = subWeeks(endOfW, 1);
    
    const weeklyTxs = (allTransactionsAdjusted || []).filter(t => isWithinInterval(parseLocalDate(t.date), { start: startOfW, end: endOfW }));
    const lastWeeklyTxs = (allTransactionsAdjusted || []).filter(t => isWithinInterval(parseLocalDate(t.date), { start: startOfLastW, end: endOfLastW }));

    const weeklyTotals = calcTotals(weeklyTxs);
    const lastWeeklyTotals = calcTotals(lastWeeklyTxs);

    const goal = settings?.weekly_goal || 0;
    const netGoal = settings?.weekly_net_goal || 0;
    
    // Net profit (Lucro Líquido) is calculated as standard net balance + reserve contributions (or simply income - expenses)
    const weeklyNet = weeklyTotals.net + weeklyTotals.reserveAporte + (weeklyTotals.rendimentosReserva || 0) - (weeklyTotals.totalVendaInvestimento || 0);
    const lastWeeklyNet = lastWeeklyTotals.net + lastWeeklyTotals.reserveAporte + (lastWeeklyTotals.rendimentosReserva || 0) - (lastWeeklyTotals.totalVendaInvestimento || 0);
    
    const weeklyIncomeTotal = weeklyTotals.income + (weeklyTotals.rendimentosReserva || 0) + (weeklyTotals.totalVendaInvestimento || 0);
    const lastWeeklyIncomeTotal = lastWeeklyTotals.income + (lastWeeklyTotals.rendimentosReserva || 0) + (lastWeeklyTotals.totalVendaInvestimento || 0);

    const progress = goal > 0 ? (weeklyIncomeTotal / goal) * 100 : 0;
    const lastProgress = goal > 0 ? (lastWeeklyIncomeTotal / goal) * 100 : 0;
    
    const netProgress = netGoal > 0 ? (weeklyNet / netGoal) * 100 : 0;
    const lastNetProgress = netGoal > 0 ? (lastWeeklyNet / netGoal) * 100 : 0;

    return {
      income: weeklyIncomeTotal,
      lastIncome: lastWeeklyIncomeTotal,
      net: weeklyNet,
      lastNet: lastWeeklyNet,
      goal,
      netGoal,
      progress: Math.min(progress, 100),
      lastProgress: Math.min(lastProgress, 100),
      netProgress: Math.min(netProgress, 100),
      lastNetProgress: Math.min(lastNetProgress, 100),
      isCompleted: progress >= 100,
      lastIsCompleted: lastProgress >= 100,
      isNetCompleted: netProgress >= 100,
      lastIsNetCompleted: lastNetProgress >= 100,
      evolution: lastWeeklyIncomeTotal > 0 ? ((weeklyIncomeTotal - lastWeeklyIncomeTotal) / lastWeeklyIncomeTotal) * 100 : (weeklyIncomeTotal > 0 ? 100 : 0),
      netEvolution: lastWeeklyNet !== 0 ? ((weeklyNet - lastWeeklyNet) / Math.abs(lastWeeklyNet)) * 100 : (weeklyNet > 0 ? 100 : 0)
    };
  }, [allTransactionsAdjusted, settings?.weekly_goal, settings?.weekly_net_goal]);

  const divTotals = useMemo(() => {
    const received = dividends
      .filter(d => d.status === 'received')
      .reduce((sum, d) => sum + Number(d.amount), 0);
    const provisioned = dividends
      .filter(d => d.status === 'provisioned')
      .reduce((sum, d) => sum + Number(d.amount), 0);
    return { received, provisioned };
  }, [dividends]);

  const getTrend = (curr: number, prev: number) => {
    if (globalPeriod === 'all') return null;
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };

  const summary = useMemo(() => {
    const currentOpPuro = current.opExpPuro;
    const pastOpPuro = past.opExpPuro;

    const currentNetPatrimony = current.net + current.reserveAporte + (current.rendimentosReserva || 0) - (current.totalVendaInvestimento || 0);
    const pastNetPatrimony = past.net + past.reserveAporte + (past.rendimentosReserva || 0) - (past.totalVendaInvestimento || 0);

    const currentNetOpProfit = current.income - currentOpPuro;
    const pastNetOpProfit = past.income - pastOpPuro;

    return {
      totalIncome: current.income,
      totalExpense: current.expense,
      netProfit: current.net,
      netProfitPatrimony: currentNetPatrimony,
      netOperatingProfit: currentNetOpProfit,
      opExpense: current.opExp,
      opExpensePuro: currentOpPuro,
      opExpReserve: current.opExpReserve,
      reserveAporte: current.reserveAporte,
      rawReserveAporte: current.rawReserveAporte,
      reserveSpending: current.reserveSpending,
      perExpense: current.perExp,
      perExpReserve: current.perExpReserve,
      totalCompraInvestimento: current.totalCompraInvestimento || 0,
      totalVendaInvestimento: current.totalVendaInvestimento || 0,
      rendimentosReserva: current.rendimentosReserva || 0,
      fuelExpense: current.fuelExpense || 0,
      fuelReserve: current.fuelReserve || 0,
      maintenanceExpense: current.maintenanceExpense || 0,
      km: current.km,
      incomeTrend: getTrend(current.income, past.income),
      expenseTrend: getTrend(current.expense, past.expense),
      profitTrend: getTrend(current.net, past.net),
      netPatrimonyTrend: getTrend(currentNetPatrimony, pastNetPatrimony),
      netOperatingProfitTrend: getTrend(currentNetOpProfit, pastNetOpProfit),
      opTrend: getTrend(current.opExp, past.opExp),
      opPuroTrend: getTrend(currentOpPuro, pastOpPuro),
      reserveAporteTrend: getTrend(current.reserveAporte, past.reserveAporte),
      rawReserveAporteTrend: getTrend(current.rawReserveAporte, past.rawReserveAporte),
      reserveSpendingTrend: getTrend(current.reserveSpending, past.reserveSpending),
      perTrend: getTrend(current.perExp, past.perExp),
      kmTrend: getTrend(current.km, past.km),
    };
  }, [current, past, globalPeriod]);

  const analyticsMargins = useMemo(() => {
    const income = (summary.totalIncome || 0) + (summary.rendimentosReserva || 0) + (summary.totalVendaInvestimento || 0);
    const opPuro = summary.opExpensePuro || 0;
    const per = Math.max(0, summary.perExpense || 0);
    const totalExp = opPuro + per;

    const opToPerRatio = per > 0 ? (opPuro / per) * 100 : 0;
    const opToTotalRatio = totalExp > 0 ? (opPuro / totalExp) * 100 : 0;

    const opMargin = income > 0 ? ((income - opPuro) / income) * 100 : (opPuro > 0 ? -100 : 100);
    const perMargin = income > 0 ? ((income - per) / income) * 100 : (per > 0 ? -100 : 100);
    const totalMargin = income > 0 ? ((income - totalExp) / income) * 100 : (totalExp > 0 ? -100 : 100);

    return {
      opToPerRatio,
      opToTotalRatio,
      opMargin,
      perMargin,
      totalMargin,
      income,
      opPuro,
      per,
      totalExp,
    };
  }, [summary]);

  const compositionBreakdown = useMemo(() => {
    const op = summary.opExpensePuro || 0;
    const per = Math.max(0, summary.perExpense || 0);
    const total = op + per;
    if (total === 0) {
      return { opPercent: 0, perPercent: 0 };
    }
    return {
      opPercent: (op / total) * 100,
      perPercent: (per / total) * 100
    };
  }, [summary]);

  // Índices Fundamentalistas e de Desempenho Operacional
  const fundamentalIndexes = useMemo(() => {
    const kmTotal = summary.km || 0;
    const fatTotal = (summary.totalIncome || 0) + (summary.rendimentosReserva || 0);
    const opPuro = summary.opExpensePuro || 0;
    const fuelExpense = summary.fuelExpense || 0;
    const despesaPessoal = Math.max(0, summary.perExpense || 0);
    const despesaTotal = opPuro + despesaPessoal;
    
    // Lucro Líquido Real Patrimonial (sem a distorção da variação de fluxo de caixa por aportes em reserva)
    const lucroLiquido = summary.netProfitPatrimony !== undefined ? summary.netProfitPatrimony : (summary.netProfit || 0);
    const lucroOperacional = fatTotal - opPuro; // EBITDA Operacional do Veículo
    const reservasGuarda = totalInReserves || 0;

    // 1. Margem Líquida Consolidada (%)
    const margemLiquida = fatTotal > 0 ? (lucroLiquido / fatTotal) * 100 : 0;

    // 2. Margem Operacional Veicular / EBITDA (%)
    const margemOperacional = fatTotal > 0 ? (lucroOperacional / fatTotal) * 100 : 0;

    const maintenanceExpense = summary.maintenanceExpense || 0;
    const otherOpExpense = Math.max(0, opPuro - fuelExpense - maintenanceExpense);

    // 3. CPK - Custo Operacional por Quilômetro (R$/km)
    const cpk = kmTotal > 0 ? opPuro / kmTotal : 0;
    const cpkCombustivel = kmTotal > 0 ? fuelExpense / kmTotal : 0;
    const cpkManutencao = kmTotal > 0 ? maintenanceExpense / kmTotal : 0;
    const cpkOutrosOp = kmTotal > 0 ? otherOpExpense / kmTotal : 0;

    // 4. RPK - Receita Bruta por Quilômetro (R$/km)
    const rpk = kmTotal > 0 ? fatTotal / kmTotal : 0;

    // 5. LPK - Lucro Líquido por Quilômetro (R$/km)
    const lpk = kmTotal > 0 ? lucroLiquido / kmTotal : 0;

    // 6. LOPK - Lucro Operacional por Quilômetro (R$/km)
    const lopk = kmTotal > 0 ? lucroOperacional / kmTotal : 0;

    // 7. Multiplicador de Eficiência Operacional (MOE / ROIC Veicular)
    const moe = opPuro > 0 ? fatTotal / opPuro : 0;

    // 8. Cobertura da Reserva Operacional (ICRO - Ciclos de Custo Veicular)
    const coberturaReservaOp = opPuro > 0 ? reservasGuarda / opPuro : (reservasGuarda > 0 ? 99 : 0);

    // 9. Taxa de Comprometimento com Combustível + Outros Op / Pedágio (Fuel Ratio %)
    const rawFuelRatio = fatTotal > 0 ? (fuelExpense / fatTotal) * 100 : 0;
    const fuelRatio = fatTotal > 0 ? ((fuelExpense + otherOpExpense) / fatTotal) * 100 : 0;
    const opRatio = fatTotal > 0 ? (opPuro / fatTotal) * 100 : 0;
    const personalRatio = fatTotal > 0 ? (despesaPessoal / fatTotal) * 100 : 0;
    const personalMargin = fatTotal > 0 ? ((fatTotal - despesaPessoal) / fatTotal) * 100 : 100;
    const maintenanceRatio = fatTotal > 0 ? (maintenanceExpense / fatTotal) * 100 : 0;
    const otherOpRatio = fatTotal > 0 ? (otherOpExpense / fatTotal) * 100 : 0;
    const personalPerKm = kmTotal > 0 ? despesaPessoal / kmTotal : 0;
    const maintenancePerKm = kmTotal > 0 ? maintenanceExpense / kmTotal : 0;

    // 10. Ponto de Equilíbrio Financeiro (Breakeven):
    // Margem de Contribuição Operacional % (MCO) = (fatTotal - opPuro) / fatTotal
    const margemContribucaoPct = fatTotal > 0 ? (fatTotal - opPuro) / fatTotal : 0;
    
    // Faturamento Mínimo para cobrir Despesas Totais (Operacionais + Pessoais)
    const fatBreakeven = margemContribucaoPct > 0 ? despesaTotal / margemContribucaoPct : despesaTotal;

    // Quilometragem de Equilíbrio
    const mcoKm = rpk - cpk;
    const kmBreakevenTotal = mcoKm > 0 ? despesaTotal / mcoKm : 0;

    const breakevenProgress = fatBreakeven > 0 ? Math.min(200, (fatTotal / fatBreakeven) * 100) : (fatTotal > 0 ? 200 : 0);

    return {
      kmTotal,
      fatTotal,
      opPuro,
      fuelExpense,
      maintenanceExpense,
      otherOpExpense,
      opRatio,
      otherOpRatio,
      rawFuelRatio,
      despesaPessoal,
      despesaTotal,
      lucroLiquido,
      lucroOperacional,
      reservasGuarda,
      margemLiquida,
      margemOperacional,
      cpk,
      cpkCombustivel,
      cpkManutencao,
      cpkOutrosOp,
      rpk,
      lpk,
      lopk,
      moe,
      coberturaReservaOp,
      fuelRatio,
      personalRatio,
      personalMargin,
      maintenanceRatio,
      personalPerKm,
      maintenancePerKm,
      kmBreakevenTotal,
      fatBreakeven,
      breakevenProgress,
    };
  }, [summary, totalInReserves]);

  const fundamentalHistory = useMemo(() => {
    const monthMap: Record<string, Transaction[]> = {};
    allTransactionsAdjusted.forEach(t => {
      const dateStr = t.date.split('T')[0];
      const monthStr = dateStr.substring(0, 7);
      if (monthStr < '2026-03') return; // Exibir apenas a partir de março de 2026
      if (!monthMap[monthStr]) monthMap[monthStr] = [];
      monthMap[monthStr].push(t);
    });

    const sortedMonths = Object.keys(monthMap).sort();

    const history = sortedMonths.map(monthStr => {
      const monthTxs = monthMap[monthStr];
      const totals = calcTotals(monthTxs);
      const kmTotal = totals.km || 0;
      const fatTotal = totals.income + (totals.rendimentosReserva || 0);
      const opPuro = totals.opExpPuro || 0;
      const fuelExpense = totals.fuelExpense || 0;
      const perExp = Math.max(0, totals.perExp || 0);
      const maintExp = totals.maintenanceExpense || 0;

      const lucroLiquido = totals.net + totals.reserveAporte + (totals.rendimentosReserva || 0) - (totals.totalVendaInvestimento || 0);
      const lucroOperacional = fatTotal - opPuro;

      const margemLiquida = fatTotal > 0 ? (lucroLiquido / fatTotal) * 100 : 0;
      const margemOperacional = fatTotal > 0 ? (lucroOperacional / fatTotal) * 100 : 0;
      const cpk = kmTotal > 0 ? opPuro / kmTotal : 0;
      const rpk = kmTotal > 0 ? fatTotal / kmTotal : 0;
      const lpk = kmTotal > 0 ? lucroLiquido / kmTotal : 0;
      const moe = opPuro > 0 ? fatTotal / opPuro : 0;
      const otherOpExp = Math.max(0, opPuro - fuelExpense - maintExp);
      const fuelRatio = fatTotal > 0 ? ((fuelExpense + otherOpExp) / fatTotal) * 100 : 0;
      const personalRatio = fatTotal > 0 ? (perExp / fatTotal) * 100 : 0;
      const personalMargin = fatTotal > 0 ? ((fatTotal - perExp) / fatTotal) * 100 : 100;
      const maintenanceRatio = fatTotal > 0 ? (maintExp / fatTotal) * 100 : 0;
      const personalPerKm = kmTotal > 0 ? perExp / kmTotal : 0;
      const maintenancePerKm = kmTotal > 0 ? maintExp / kmTotal : 0;
      const fuelAndOtherPerKm = kmTotal > 0 ? (fuelExpense + otherOpExp) / kmTotal : 0;

      const [year, month] = monthStr.split('-');
      const dateObj = new Date(Number(year), Number(month) - 1, 1);
      const label = format(dateObj, 'MMM/yyyy', { locale: ptBR });

      return {
        monthStr,
        label,
        margemLiquida: Number(margemLiquida.toFixed(2)),
        margemOperacional: Number(margemOperacional.toFixed(2)),
        cpk: Number(cpk.toFixed(2)),
        rpk: Number(rpk.toFixed(2)),
        lpk: Number(lpk.toFixed(2)),
        moe: Number(moe.toFixed(2)),
        fuelRatio: Number(fuelRatio.toFixed(2)),
        personalRatio: Number(personalRatio.toFixed(2)),
        personalMargin: Number(personalMargin.toFixed(2)),
        maintenanceRatio: Number(maintenanceRatio.toFixed(2)),
        personalPerKm: Number(personalPerKm.toFixed(2)),
        maintenancePerKm: Number(maintenancePerKm.toFixed(2)),
        fuelAndOtherPerKm: Number(fuelAndOtherPerKm.toFixed(2)),
      };
    });

    return history;
  }, [allTransactionsAdjusted]);

  const indexMetadata: Record<string, { title: string; unit: string; color: string; description: string; formatter: (val: number) => string }> = {
    margemLiquida: {
      title: 'Margem Líquida Consolidada',
      unit: '%',
      color: '#10b981',
      description: 'Evolução mensal da margem líquida (lucro retido por receita bruta).',
      formatter: (val) => `${val.toFixed(1)}%`
    },
    margemOperacional: {
      title: 'Margem Operacional / EBITDA',
      unit: '%',
      color: '#6366f1',
      description: 'Evolução mensal da margem operacional do veículo.',
      formatter: (val) => `${val.toFixed(1)}%`
    },
    personalMargin: {
      title: 'Margem Pessoal',
      unit: '%',
      color: '#0ea5e9',
      description: 'Evolução mensal da margem restante após retiradas e despesas pessoais.',
      formatter: (val) => `${val.toFixed(1)}%`
    },
    personalRatio: {
      title: 'Taxa de Custos Pessoais',
      unit: '%',
      color: '#3b82f6',
      description: 'Evolução mensal da proporção da receita destinada a despesas pessoais.',
      formatter: (val) => `${val.toFixed(1)}%`
    },
    fuelRatio: {
      title: 'Taxa Combustível + Outros Op.',
      unit: '%',
      color: '#f97316',
      description: 'Evolução mensal da proporção da receita destinada a combustível e outras despesas operacionais/pedágios.',
      formatter: (val) => `${val.toFixed(1)}%`
    },
    maintenanceRatio: {
      title: 'Taxa de Custos de Manutenção',
      unit: '%',
      color: '#eab308',
      description: 'Evolução mensal da proporção da receita destinada à manutenção do veículo.',
      formatter: (val) => `${val.toFixed(1)}%`
    },
    rpk: {
      title: 'RPK - Receita Bruta por KM',
      unit: 'R$/km',
      color: '#06b6d4',
      description: 'Evolução mensal da receita bruta gerada por quilômetro.',
      formatter: (val) => `R$ ${val.toFixed(2)}/km`
    },
    lpk: {
      title: 'LPK - Lucro Líquido por KM',
      unit: 'R$/km',
      color: '#10b981',
      description: 'Evolução mensal do resultado líquido final por quilômetro rodado.',
      formatter: (val) => `R$ ${val.toFixed(2)}/km`
    },
    personalPerKm: {
      title: 'PPK - Custo Pessoal por KM',
      unit: 'R$/km',
      color: '#60a5fa',
      description: 'Evolução mensal de despesas pessoais por quilômetro rodado.',
      formatter: (val) => `R$ ${val.toFixed(2)}/km`
    },
    cpk: {
      title: 'CPK - Custo Operacional por KM',
      unit: 'R$/km',
      color: '#f59e0b',
      description: 'Evolução mensal do custo operacional por quilômetro rodado.',
      formatter: (val) => `R$ ${val.toFixed(2)}/km`
    },
    fuelAndOtherPerKm: {
      title: 'Custo Combustível + Outros por KM',
      unit: 'R$/km',
      color: '#f97316',
      description: 'Evolução mensal dos custos de combustível e outros operacionais/pedágios por quilômetro.',
      formatter: (val) => `R$ ${val.toFixed(2)}/km`
    },
    maintenancePerKm: {
      title: 'MPK - Custo de Manutenção por KM',
      unit: 'R$/km',
      color: '#facc15',
      description: 'Evolução mensal de despesas de manutenção por quilômetro rodado.',
      formatter: (val) => `R$ ${val.toFixed(2)}/km`
    },
    moe: {
      title: 'Multiplicador de Eficiência Operacional (MOE)',
      unit: 'x',
      color: '#8b5cf6',
      description: 'Evolução mensal do multiplicador de receita por custo operacional.',
      formatter: (val) => `${val.toFixed(2)}x`
    }
  };

  const queryRecords = useMemo(() => {
    if (!allTransactionsAdjusted || allTransactionsAdjusted.length === 0) {
      return {
        maxDailyIncome: { amount: 0, date: null as string | null },
        maxDailyProfit: { amount: 0, date: null as string | null },
        maxDailyPatrimonyProfit: { amount: 0, date: null as string | null },
        maxMonthlyIncome: { amount: 0, date: null as string | null },
        maxMonthlyProfit: { amount: 0, date: null as string | null },
        maxMonthlyPatrimonyProfit: { amount: 0, date: null as string | null },
        maxSingleIncome: { amount: 0, category: '', date: null as string | null, description: '' },
        maxSingleExpense: { amount: 0, category: '', date: null as string | null, description: '' },
        maxDailyKm: { amount: 0, date: null as string | null },
      };
    }

    const dailyGroups: Record<string, Transaction[]> = {};
    const monthlyGroups: Record<string, Transaction[]> = {};
    let maxSingleIncome = { amount: 0, category: '', date: null as string | null, description: '' };
    let maxSingleExpense = { amount: 0, category: '', date: null as string | null, description: '' };

    allTransactionsAdjusted.forEach(t => {
      const dateStr = t.date.split('T')[0];
      const monthStr = dateStr.substring(0, 7);
      const amount = Number(t.amount) || 0;

      if (!dailyGroups[dateStr]) dailyGroups[dateStr] = [];
      dailyGroups[dateStr].push(t);

      if (!monthlyGroups[monthStr]) monthlyGroups[monthStr] = [];
      monthlyGroups[monthStr].push(t);

      const isReserveAporteVal = (t as any).isReserveAporte === true || t.category === 'Aporte Reserva';
      const isInvestmentAssetBuy = (t as any).isInvestmentTx === true;

      if (t.type === 'income') {
        if (amount > maxSingleIncome.amount) {
          maxSingleIncome = { amount, category: t.category, date: dateStr, description: t.description || '' };
        }
      } else if (t.type === 'expense' && !isReserveAporteVal && !isInvestmentAssetBuy) {
        if (amount > maxSingleExpense.amount) {
          maxSingleExpense = { amount, category: t.category, date: dateStr, description: t.description || '' };
        }
      }
    });

    // Run calcTotals for each day
    let maxDailyIncome = { amount: 0, date: null as string | null };
    let maxDailyProfit = { amount: -Infinity, date: null as string | null };
    let maxDailyPatrimonyProfit = { amount: -Infinity, date: null as string | null };
    let maxDailyKm = { amount: 0, date: null as string | null };

    Object.entries(dailyGroups).forEach(([date, txs]) => {
      const totals = calcTotals(txs);
      const fatTotal = totals.income + (totals.rendimentosReserva || 0) + (totals.totalVendaInvestimento || 0);
      const realExpense = totals.opExpPuro + totals.perExp;
      const patrimonyProfit = fatTotal - realExpense;

      if (fatTotal > maxDailyIncome.amount) {
        maxDailyIncome = { amount: fatTotal, date };
      }
      if (patrimonyProfit > maxDailyProfit.amount) {
        maxDailyProfit = { amount: patrimonyProfit, date };
      }
      if (patrimonyProfit > maxDailyPatrimonyProfit.amount) {
        maxDailyPatrimonyProfit = { amount: patrimonyProfit, date };
      }
      if (totals.km > maxDailyKm.amount) {
        maxDailyKm = { amount: totals.km, date };
      }
    });

    if (maxDailyProfit.amount === -Infinity) maxDailyProfit = { amount: 0, date: null };
    if (maxDailyPatrimonyProfit.amount === -Infinity) maxDailyPatrimonyProfit = { amount: 0, date: null };

    // Run calcTotals for each month
    let maxMonthlyIncome = { amount: 0, date: null as string | null };
    let maxMonthlyProfit = { amount: -Infinity, date: null as string | null };
    let maxMonthlyPatrimonyProfit = { amount: -Infinity, date: null as string | null };

    Object.entries(monthlyGroups).forEach(([month, txs]) => {
      const totals = calcTotals(txs);
      const fatTotal = totals.income + (totals.rendimentosReserva || 0) + (totals.totalVendaInvestimento || 0);
      const realExpense = totals.opExpPuro + totals.perExp;
      const patrimonyProfit = fatTotal - realExpense;

      if (fatTotal > maxMonthlyIncome.amount) {
        maxMonthlyIncome = { amount: fatTotal, date: month };
      }
      if (patrimonyProfit > maxMonthlyProfit.amount) {
        maxMonthlyProfit = { amount: patrimonyProfit, date: month };
      }
      if (patrimonyProfit > maxMonthlyPatrimonyProfit.amount) {
        maxMonthlyPatrimonyProfit = { amount: patrimonyProfit, date: month };
      }
    });

    if (maxMonthlyProfit.amount === -Infinity) maxMonthlyProfit = { amount: 0, date: null };
    if (maxMonthlyPatrimonyProfit.amount === -Infinity) maxMonthlyPatrimonyProfit = { amount: 0, date: null };

    return {
      maxDailyIncome,
      maxDailyProfit,
      maxDailyPatrimonyProfit,
      maxMonthlyIncome,
      maxMonthlyProfit,
      maxMonthlyPatrimonyProfit,
      maxSingleIncome,
      maxSingleExpense,
      maxDailyKm
    };
  }, [allTransactionsAdjusted, settings]);

  const formatRecordDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nenhum lançamento';
    try {
      const parsed = parseLocalDate(dateStr);
      return format(parsed, "dd/MM/yyyy", { locale: ptBR });
    } catch (e) {
      return dateStr;
    }
  };

  const formatRecordMonth = (monthStr: string | null) => {
    if (!monthStr) return 'Nenhum lançamento';
    try {
      const parsed = parseLocalDate(monthStr + "-01");
      return format(parsed, "MMMM 'de' yyyy", { locale: ptBR });
    } catch (e) {
      return monthStr;
    }
  };

  // Pre-group transactions by date (yyyy-MM-dd) to keep complexity O(N + D) instead of O(N * D)
  const txsByDate = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    currentPeriodTx.forEach(t => {
      const dateStr = (t as any)._dateStr || t.date.split('T')[0];
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(t);
    });
    return groups;
  }, [currentPeriodTx]);

  const pastTxsByDate = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    pastPeriodTx.forEach(t => {
      const dateStr = (t as any)._dateStr || t.date.split('T')[0];
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(t);
    });
    return groups;
  }, [pastPeriodTx]);

  const allTxsByDate = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    (allTransactionsAdjusted || []).forEach(t => {
      const dateStr = (t as any)._dateStr || t.date.split('T')[0];
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(t);
    });
    return groups;
  }, [allTransactionsAdjusted]);

  // Generate list of days in the interval
  const dayList = useMemo(() => {
    let list: Date[] = [];
    try {
      if (chartStart <= chartEnd) {
        list = eachDayOfInterval({ start: chartStart, end: chartEnd });
      }
    } catch (err) {
      console.error("Erro ao calcular os dias dos gráficos:", err);
    }
    if (list.length > 366) {
      list = list.slice(list.length - 366);
    }
    return list;
  }, [chartStart, chartEnd]);

  // Determine whether to use a weekly scale.
  // We use weekly scale if the period selected represents 90 days (approx 3 months) or more.
  const isWeeklyScale = useMemo(() => dayList.length >= 90, [dayList]);

  // Process the dailyData and dailyTrendData based on the scale
  const chartDataResult = useMemo(() => {
    const durationOffset = currentStart.getTime() - pastStart.getTime();

    if (!isWeeklyScale) {
      // Scale: DAILY (with standard day precision)
      // Only consider days inside the period that actually contain transaction records
      const filteredDays = dayList.filter(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        return (txsByDate[dayStr] || []).length > 0;
      });

      const dailyData = filteredDays.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayTxs = txsByDate[dayStr] || [];
        const { income, expense, rendimentosReserva, totalVendaInvestimento } = calcTotals(dayTxs);
        return { 
          date: format(day, 'dd/MM'), 
          income: Number((income + (rendimentosReserva || 0) + (totalVendaInvestimento || 0)).toFixed(2)), 
          expense: Number(expense.toFixed(2)) 
        };
      });

      let cumDespesasTotais = 0;
      let cumDespesasPessoais = 0;
      let cumDespesasOperacionais = 0;
      let cumFaturamento = 0;
      let cumLucroLiquido = 0;
      let cumLucroPatrimonio = 0;

      let cumFaturamentoAnt = 0;
      let cumLucroLiquidoAnt = 0;
      let cumLucroPatrimonioAnt = 0;
      let cumDespesasOperacionaisAnt = 0;
      let cumDespesasTotaisAnt = 0;
      let cumDespesasPessoaisAnt = 0;

      const dailyTrendData = filteredDays.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayTxs = txsByDate[dayStr] || [];
        
        const pastDay = new Date(day.getTime() - durationOffset);
        const pastDayStr = format(pastDay, 'yyyy-MM-dd');
        const pastTxs = pastTxsByDate[pastDayStr] || [];

        const { income, expense, net, opExpPuro, perExp, reserveAporte, rendimentosReserva, totalVendaInvestimento, totalCompraInvestimento } = calcTotals(dayTxs);
        const pastTotals = calcTotals(pastTxs);

        const fatTotal = income + (rendimentosReserva || 0) + (totalVendaInvestimento || 0);
        const pastFatTotal = pastTotals.income + (pastTotals.rendimentosReserva || 0) + (pastTotals.totalVendaInvestimento || 0);

        cumDespesasTotais += expense;
        cumDespesasPessoais += perExp;
        cumDespesasOperacionais += opExpPuro;
        cumFaturamento += fatTotal;
        cumLucroLiquido += net;
        cumLucroPatrimonio += (net + reserveAporte + (rendimentosReserva || 0) - (totalVendaInvestimento || 0));

        cumFaturamentoAnt += pastFatTotal;
        cumLucroLiquidoAnt += pastTotals.net;
        cumLucroPatrimonioAnt += (pastTotals.net + pastTotals.reserveAporte + (pastTotals.rendimentosReserva || 0) - (pastTotals.totalVendaInvestimento || 0));
        cumDespesasOperacionaisAnt += pastTotals.opExpPuro;
        cumDespesasTotaisAnt += pastTotals.expense;
        cumDespesasPessoaisAnt += pastTotals.perExp;

        return { 
          date: format(day, 'dd/MM'), 
          DespesasTotais: Number(cumDespesasTotais.toFixed(2)), 
          DespesasPessoais: Number(cumDespesasPessoais.toFixed(2)), 
          DespesasOperacionais: Number(cumDespesasOperacionais.toFixed(2)), 
          Faturamento: Number(cumFaturamento.toFixed(2)), 
          LucroLiquido: Number(cumLucroLiquido.toFixed(2)),
          LucroPatrimonio: Number(cumLucroPatrimonio.toFixed(2)),
          FaturamentoAnt: Number(cumFaturamentoAnt.toFixed(2)),
          LucroLiquidoAnt: Number(cumLucroLiquidoAnt.toFixed(2)),
          LucroPatrimonioAnt: Number(cumLucroPatrimonioAnt.toFixed(2)),
          DespesasOperacionaisAnt: Number(cumDespesasOperacionaisAnt.toFixed(2)),
          DespesasTotaisAnt: Number(cumDespesasTotaisAnt.toFixed(2)),
          DespesasPessoaisAnt: Number(cumDespesasPessoaisAnt.toFixed(2))
        };
      });

      return { dailyData, dailyTrendData, scaleLabel: 'Diária' };
    } else {
      // Scale: WEEKLY (aggregate by full complete weeks)
      const weeksMap: Record<string, { start: Date; end: Date; txs: Transaction[], pastTxs: Transaction[] }> = {};

      dayList.forEach(day => {
        const startOfW = startOfWeek(day, { weekStartsOn: 1 });
        const startStr = format(startOfW, 'yyyy-MM-dd');
        if (!weeksMap[startStr]) {
          const endOfW = endOfWeek(day, { weekStartsOn: 1 });
          const fullDays = eachDayOfInterval({ start: startOfW, end: endOfW });
          const weekTxs: Transaction[] = [];
          const pastWeekTxs: Transaction[] = [];

          fullDays.forEach(d => {
            const dStr = format(d, 'yyyy-MM-dd');
            if (allTxsByDate[dStr]) weekTxs.push(...allTxsByDate[dStr]);

            const pastD = new Date(d.getTime() - durationOffset);
            const pastDStr = format(pastD, 'yyyy-MM-dd');
            if (allTxsByDate[pastDStr]) pastWeekTxs.push(...allTxsByDate[pastDStr]);
          });

          weeksMap[startStr] = {
            start: startOfW,
            end: endOfW,
            txs: weekTxs,
            pastTxs: pastWeekTxs
          };
        }
      });

      // Filter to keep only weeks that contain transaction records
      const sortedWeeks = Object.keys(weeksMap)
        .sort()
        .map(key => weeksMap[key])
        .filter(w => w.txs.length > 0);

      const dailyData = sortedWeeks.map(w => {
        const label = `${format(w.start, 'dd/MM')} - ${format(w.end, 'dd/MM')}`;
        const { income, expense, rendimentosReserva, totalVendaInvestimento } = calcTotals(w.txs);
        return { 
          date: label, 
          income: Number((income + (rendimentosReserva || 0) + (totalVendaInvestimento || 0)).toFixed(2)), 
          expense: Number(expense.toFixed(2)) 
        };
      });

      let cumDespesasTotais = 0;
      let cumDespesasPessoais = 0;
      let cumDespesasOperacionais = 0;
      let cumFaturamento = 0;
      let cumLucroLiquido = 0;
      let cumLucroPatrimonio = 0;

      let cumFaturamentoAnt = 0;
      let cumLucroLiquidoAnt = 0;
      let cumLucroPatrimonioAnt = 0;
      let cumDespesasOperacionaisAnt = 0;
      let cumDespesasTotaisAnt = 0;
      let cumDespesasPessoaisAnt = 0;

      const dailyTrendData = sortedWeeks.map(w => {
        const label = `${format(w.start, 'dd/MM')} - ${format(w.end, 'dd/MM')}`;
        const { income, expense, net, opExpPuro, perExp, reserveAporte, rendimentosReserva, totalVendaInvestimento, totalCompraInvestimento } = calcTotals(w.txs);
        const pastTotals = calcTotals(w.pastTxs);

        const fatTotal = income + (rendimentosReserva || 0) + (totalVendaInvestimento || 0);
        const pastFatTotal = pastTotals.income + (pastTotals.rendimentosReserva || 0) + (pastTotals.totalVendaInvestimento || 0);

        cumDespesasTotais += expense;
        cumDespesasPessoais += perExp;
        cumDespesasOperacionais += opExpPuro;
        cumFaturamento += fatTotal;
        cumLucroLiquido += net;
        cumLucroPatrimonio += (net + reserveAporte + (rendimentosReserva || 0) - (totalVendaInvestimento || 0));

        cumFaturamentoAnt += pastFatTotal;
        cumLucroLiquidoAnt += pastTotals.net;
        cumLucroPatrimonioAnt += (pastTotals.net + pastTotals.reserveAporte + (pastTotals.rendimentosReserva || 0) - (pastTotals.totalVendaInvestimento || 0));
        cumDespesasOperacionaisAnt += pastTotals.opExpPuro;
        cumDespesasTotaisAnt += pastTotals.expense;
        cumDespesasPessoaisAnt += pastTotals.perExp;

        return {
          date: label,
          DespesasTotais: Number(cumDespesasTotais.toFixed(2)),
          DespesasPessoais: Number(cumDespesasPessoais.toFixed(2)),
          DespesasOperacionais: Number(cumDespesasOperacionais.toFixed(2)),
          Faturamento: Number(cumFaturamento.toFixed(2)),
          LucroLiquido: Number(cumLucroLiquido.toFixed(2)),
          LucroPatrimonio: Number(cumLucroPatrimonio.toFixed(2)),
          FaturamentoAnt: Number(cumFaturamentoAnt.toFixed(2)),
          LucroLiquidoAnt: Number(cumLucroLiquidoAnt.toFixed(2)),
          LucroPatrimonioAnt: Number(cumLucroPatrimonioAnt.toFixed(2)),
          DespesasOperacionaisAnt: Number(cumDespesasOperacionaisAnt.toFixed(2)),
          DespesasTotaisAnt: Number(cumDespesasTotaisAnt.toFixed(2)),
          DespesasPessoaisAnt: Number(cumDespesasPessoaisAnt.toFixed(2))
        };
      });

      return { dailyData, dailyTrendData, scaleLabel: 'Semanal' };
    }
  }, [dayList, txsByDate, isWeeklyScale, currentStart, pastStart, pastTxsByDate, allTxsByDate]);

  const dailyTrendData = chartDataResult.dailyTrendData;

  const weeklyGainsExpensesData = useMemo(() => {
    if (!dayList || dayList.length === 0) return [];

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const currentMonthStr = format(new Date(), 'yyyy-MM');

    if (activeGainsExpensesScale === 'daily') {
      const targetDays = dayList.length > 31
        ? dayList.filter(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            return (allTxsByDate[dayStr] || []).length > 0;
          })
        : dayList;

      return targetDays
        .filter(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayTxs = allTxsByDate[dayStr] || [];
          const { income, expense } = calcTotals(dayTxs);
          if (dayStr > todayStr && income === 0 && expense === 0) return false;
          return true;
        })
        .map(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayTxs = allTxsByDate[dayStr] || [];
          const { income, expense, rendimentosReserva, totalVendaInvestimento } = calcTotals(dayTxs);
          return {
            date: format(day, 'dd/MM'),
            income: Number((income + (rendimentosReserva || 0) + (totalVendaInvestimento || 0)).toFixed(2)),
            expense: Number(expense.toFixed(2))
          };
        });
    }

    if (activeGainsExpensesScale === 'monthly') {
      const monthsMap: Record<string, { start: Date; txs: Transaction[] }> = {};
      dayList.forEach(day => {
        const startM = startOfMonth(day);
        const mKey = format(startM, 'yyyy-MM');
        if (!monthsMap[mKey]) {
          monthsMap[mKey] = {
            start: startM,
            txs: []
          };
        }
        const dStr = format(day, 'yyyy-MM-dd');
        if (allTxsByDate[dStr]) {
          monthsMap[mKey].txs.push(...allTxsByDate[dStr]);
        }
      });

      return Object.keys(monthsMap)
        .sort()
        .filter(mKey => {
          const item = monthsMap[mKey];
          const { income, expense } = calcTotals(item.txs);
          if (mKey > currentMonthStr && income === 0 && expense === 0) return false;
          return true;
        })
        .map(mKey => {
          const item = monthsMap[mKey];
          const label = format(item.start, 'MMM/yy', { locale: ptBR });
          const { income, expense, rendimentosReserva, totalVendaInvestimento } = calcTotals(item.txs);
          return {
            date: label,
            income: Number((income + (rendimentosReserva || 0) + (totalVendaInvestimento || 0)).toFixed(2)),
            expense: Number(expense.toFixed(2))
          };
        });
    }

    // Default: 'weekly'
    const weeksMap: Record<string, { start: Date; end: Date; txs: Transaction[] }> = {};

    dayList.forEach(day => {
      const startOfW = startOfWeek(day, { weekStartsOn: 1 });
      const startStr = format(startOfW, 'yyyy-MM-dd');
      if (!weeksMap[startStr]) {
        const endOfW = endOfWeek(day, { weekStartsOn: 1 });
        const fullDays = eachDayOfInterval({ start: startOfW, end: endOfW });
        const weekTxs: Transaction[] = [];

        fullDays.forEach(d => {
          const dStr = format(d, 'yyyy-MM-dd');
          if (allTxsByDate[dStr]) weekTxs.push(...allTxsByDate[dStr]);
        });

        weeksMap[startStr] = {
          start: startOfW,
          end: endOfW,
          txs: weekTxs
        };
      }
    });

    const sortedWeeks = Object.keys(weeksMap)
      .sort()
      .map(key => weeksMap[key])
      .filter(w => {
        if (w.txs.length === 0) return false;
        const startStr = format(w.start, 'yyyy-MM-dd');
        const { income, expense } = calcTotals(w.txs);
        if (startStr > todayStr && income === 0 && expense === 0) return false;
        return true;
      });

    return sortedWeeks.map(w => {
      const label = `Sem. ${format(w.start, 'dd/MM')}-${format(w.end, 'dd/MM')}`;
      const { income, expense, rendimentosReserva, totalVendaInvestimento } = calcTotals(w.txs);
      return { 
        date: label, 
        income: Number((income + (rendimentosReserva || 0) + (totalVendaInvestimento || 0)).toFixed(2)), 
        expense: Number(expense.toFixed(2)) 
      };
    });
  }, [dayList, allTxsByDate, activeGainsExpensesScale]);

  const marginsTrendData = useMemo(() => {
    if (!dayList || dayList.length === 0) return [];

    let groupType: 'day' | 'week' | 'month' = 'week';
    if (dayList.length <= 14) {
      groupType = 'day';
    } else if (dayList.length >= 180) {
      groupType = 'month';
    } else {
      groupType = 'week';
    }

    const segmentsMap: Record<string, { label: string; start: Date; end: Date; txs: Transaction[] }> = {};

    dayList.forEach(day => {
      let key = '';
      let label = '';
      let segmentStart: Date;
      let segmentEnd: Date;

      if (groupType === 'month') {
        segmentStart = startOfMonth(day);
        segmentEnd = endOfMonth(day);
        key = format(segmentStart, 'yyyy-MM');
        label = format(segmentStart, 'MMM/yy', { locale: ptBR });
      } else if (groupType === 'week') {
        segmentStart = startOfWeek(day, { weekStartsOn: 1 });
        segmentEnd = endOfWeek(day, { weekStartsOn: 1 });
        key = format(segmentStart, 'yyyy-MM-dd');
        label = `Sem. ${format(segmentStart, 'dd/MM')}-${format(segmentEnd, 'dd/MM')}`;
      } else {
        segmentStart = startOfDay(day);
        segmentEnd = endOfDay(day);
        key = format(segmentStart, 'yyyy-MM-dd');
        label = format(segmentStart, 'dd/MM');
      }

      if (!segmentsMap[key]) {
        // Collect ALL transactions in the full segment interval [segmentStart, segmentEnd] from allTxsByDate
        const fullSegmentDays = eachDayOfInterval({ start: segmentStart, end: segmentEnd });
        const segTxs: Transaction[] = [];
        fullSegmentDays.forEach(d => {
          const dStr = format(d, 'yyyy-MM-dd');
          if (allTxsByDate[dStr]) {
            segTxs.push(...allTxsByDate[dStr]);
          }
        });

        segmentsMap[key] = {
          label,
          start: segmentStart,
          end: segmentEnd,
          txs: segTxs
        };
      }
    });

    const sortedSegments = Object.keys(segmentsMap)
      .sort()
      .map(key => segmentsMap[key])
      .filter(seg => seg.txs.length > 0);

    return sortedSegments.map(seg => {
      const { income, opExpPuro, perExp, rendimentosReserva, totalVendaInvestimento } = calcTotals(seg.txs);
      const fatTotal = income + (rendimentosReserva || 0) + (totalVendaInvestimento || 0);
      const totalExp = opExpPuro + perExp;

      const opMargin = fatTotal > 0 ? ((fatTotal - opExpPuro) / fatTotal) * 100 : (opExpPuro > 0 ? -100 : 0);
      const perMargin = fatTotal > 0 ? ((fatTotal - perExp) / fatTotal) * 100 : (perExp > 0 ? -100 : 0);
      const totalMargin = fatTotal > 0 ? ((fatTotal - totalExp) / fatTotal) * 100 : (totalExp > 0 ? -100 : 0);

      return {
        name: seg.label,
        income: Number(fatTotal.toFixed(2)),
        opMargin: Number(opMargin.toFixed(1)),
        perMargin: Number(perMargin.toFixed(1)),
        totalMargin: Number(totalMargin.toFixed(1)),
        personalExp: Number(perExp.toFixed(2)),
        opExpPuro: Number(opExpPuro.toFixed(2)),
      };
    });
  }, [dayList, allTxsByDate]);

  const kmComparisonData = useMemo(() => {
    const categoriesWithKm = settings?.categories_with_km || [];
    const durationOffset = currentStart.getTime() - pastStart.getTime();

    let cumCurrKm = 0;
    let cumPastKm = 0;

    return dayList.map(currDay => {
      const currDayStr = format(currDay, 'yyyy-MM-dd');
      const pastDay = new Date(currDay.getTime() - durationOffset);
      const pastDayStr = format(pastDay, 'yyyy-MM-dd');

      const currTxs = txsByDate[currDayStr] || [];
      const pastTxs = pastTxsByDate[pastDayStr] || [];

      let currKm = 0;
      currTxs.forEach(t => {
        if (categoriesWithKm.includes(t.category) && t.end_km && t.start_km && t.end_km >= t.start_km) {
          currKm += (t.end_km - t.start_km);
        }
      });

      let pastKm = 0;
      pastTxs.forEach(t => {
        if (categoriesWithKm.includes(t.category) && t.end_km && t.start_km && t.end_km >= t.start_km) {
          pastKm += (t.end_km - t.start_km);
        }
      });

      cumCurrKm += currKm;
      cumPastKm += pastKm;

      return {
        date: format(currDay, 'dd/MM'),
        Atual: Number(cumCurrKm.toFixed(1)),
        Anterior: Number(cumPastKm.toFixed(1)),
      };
    });
  }, [dayList, txsByDate, pastTxsByDate, settings, currentStart, pastStart]);

  const efficiencyIndexData = useMemo(() => {
    const categoriesWithKm = settings?.categories_with_km || [];
    const opCats = settings?.operational_expense_categories || ['Combustível', 'Pedágio', 'Manutenção'];
    
    const weeklyData: Record<string, { currKm: number, currOpExp: number, currIncome: number, pastKm: number, pastOpExp: number, pastIncome: number }> = {};
    const durationOffset = currentStart.getTime() - pastStart.getTime();

    dayList.forEach(currDay => {
      const weekStart = startOfWeek(currDay, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { currKm: 0, currOpExp: 0, currIncome: 0, pastKm: 0, pastOpExp: 0, pastIncome: 0 };
      }

      const currDayStr = format(currDay, 'yyyy-MM-dd');
      const pastDay = new Date(currDay.getTime() - durationOffset);
      const pastDayStr = format(pastDay, 'yyyy-MM-dd');

      const currTxs = txsByDate[currDayStr] || [];
      const pastTxs = pastTxsByDate[pastDayStr] || [];

      currTxs.forEach(t => {
        if (categoriesWithKm.includes(t.category) && t.end_km && t.start_km && t.end_km >= t.start_km) {
          weeklyData[weekKey].currKm += (t.end_km - t.start_km);
        }
        if (t.type === 'expense' && (opCats.includes(t.category) || t.category === 'Pedágio')) {
          weeklyData[weekKey].currOpExp += Number(t.amount);
        }
        if (t.type === 'income' && !(t as any).isDividendTx && !(t as any).isInvestmentTx) {
          weeklyData[weekKey].currIncome += Number(t.amount);
        }
      });

      pastTxs.forEach(t => {
        if (categoriesWithKm.includes(t.category) && t.end_km && t.start_km && t.end_km >= t.start_km) {
          weeklyData[weekKey].pastKm += (t.end_km - t.start_km);
        }
        if (t.type === 'expense' && (opCats.includes(t.category) || t.category === 'Pedágio')) {
          weeklyData[weekKey].pastOpExp += Number(t.amount);
        }
        if (t.type === 'income' && !(t as any).isDividendTx && !(t as any).isInvestmentTx) {
          weeklyData[weekKey].pastIncome += Number(t.amount);
        }
      });
    });

    return Object.entries(weeklyData).map(([weekKey, data]) => {
      const [year, month, day] = weekKey.split('-').map(Number);
      const weekStart = new Date(year, month - 1, day, 12, 0, 0, 0);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      
      return {
        date: `${format(weekStart, 'dd/MM')}-${format(weekEnd, 'dd/MM')}`,
        Atual: data.currKm > 0 ? Number((data.currOpExp / data.currKm).toFixed(2)) : 0,
        Anterior: data.pastKm > 0 ? Number((data.pastOpExp / data.pastKm).toFixed(2)) : 0,
        CurrFatPerKm: data.currKm > 0 ? Number((data.currIncome / data.currKm).toFixed(2)) : 0,
        PastFatPerKm: data.pastKm > 0 ? Number((data.pastIncome / data.pastKm).toFixed(2)) : 0,
        CurrLucroOpPerKm: data.currKm > 0 ? Number(((data.currIncome - data.currOpExp) / data.currKm).toFixed(2)) : 0,
        PastLucroOpPerKm: data.pastKm > 0 ? Number(((data.pastIncome - data.pastOpExp) / data.pastKm).toFixed(2)) : 0,
        currKm: data.currKm,
        currOpExp: data.currOpExp,
        currIncome: data.currIncome,
        pastKm: data.pastKm,
        pastOpExp: data.pastOpExp,
        pastIncome: data.pastIncome,
      };
    });
  }, [dayList, txsByDate, pastTxsByDate, settings, currentStart, pastStart]);

  const monthlyTrend = useMemo(() => {
    const nowDate = new Date();
    const last6Months = Array.from({ length: 6 }).map((_, i) => subMonths(nowDate, 5 - i)).filter(month => format(month, 'yyyy-MM') >= '2026-03');
    return last6Months.map(month => {
      const monthStr = format(month, 'yyyy-MM');
      const monthTxs = (allTransactionsAdjusted || []).filter(t => (t as any)._monthStr === monthStr);
      const { income, expense, net, reserveAporte, rendimentosReserva, totalVendaInvestimento } = calcTotals(monthTxs);
      return {
        month: format(month, 'MMM', { locale: ptBR }),
        faturamento: Number((income + (rendimentosReserva || 0) + (totalVendaInvestimento || 0)).toFixed(2)),
        despesas: Number(expense.toFixed(2)),
        lucro: Number(net.toFixed(2)),
        lucroPatrimonio: Number((net + reserveAporte + (rendimentosReserva || 0) - (totalVendaInvestimento || 0)).toFixed(2)),
        hasTxs: monthTxs.length > 0
      };
    }).filter(m => m.hasTxs);
  }, [allTransactionsAdjusted, settings]);

  const weekdayData = useMemo(() => {
    const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const stats = Array.from({ length: 7 }).map((_, i) => ({
      index: i,
      name: weekdayNames[i],
      incomeSum: 0,
      incomeCount: 0,
      expenseSum: 0,
      expenseCount: 0,
      pizzariaSum: 0,
      pizzariaCount: 0,
      freteSum: 0,
      freteCount: 0
    }));

    dayList.forEach(day => {
      const dayIdx = day.getDay();
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayTxs = txsByDate[dayStr] || [];
      const { income, expense } = calcTotals(dayTxs);
      
      const pizzariaTotal = dayTxs.filter(t => t.category === 'Pizzaria' && t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
      const freteTotal = dayTxs.filter(t => (t.category === 'Frete do Dia' || t.category?.toLowerCase().includes('frete')) && t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
      
      if (income > 0) {
        stats[dayIdx].incomeSum += income;
        stats[dayIdx].incomeCount += 1;
      }
      if (expense > 0) {
        stats[dayIdx].expenseSum += expense;
        stats[dayIdx].expenseCount += 1;
      }
      if (pizzariaTotal > 0) {
        stats[dayIdx].pizzariaSum += pizzariaTotal;
        stats[dayIdx].pizzariaCount += 1;
      }
      if (freteTotal > 0) {
        stats[dayIdx].freteSum += freteTotal;
        stats[dayIdx].freteCount += 1;
      }
    });

    const orderedIndices = [1, 2, 3, 4, 5, 6, 0]; // Monday to Sunday
    
    return orderedIndices.map(idx => {
      const s = stats[idx];
      return {
        name: s.name,
        Ganhos: s.incomeCount > 0 ? Number((s.incomeSum / s.incomeCount).toFixed(2)) : 0,
        Despesas: s.expenseCount > 0 ? Number((s.expenseSum / s.expenseCount).toFixed(2)) : 0,
        Pizzaria: s.pizzariaCount > 0 ? Number((s.pizzariaSum / s.pizzariaCount).toFixed(2)) : 0,
        Frete: s.freteCount > 0 ? Number((s.freteSum / s.freteCount).toFixed(2)) : 0
      };
    });
  }, [dayList, txsByDate]);

  const totalWeeklyPizzaria = useMemo(() => {
    return weekdayData.reduce((acc, d) => acc + (d.Pizzaria || 0), 0);
  }, [weekdayData]);

  const totalWeeklyFrete = useMemo(() => {
    return weekdayData.reduce((acc, d) => acc + (d.Frete || 0), 0);
  }, [weekdayData]);

  const totalWeeklyGanhos = useMemo(() => {
    return weekdayData.reduce((acc, d) => acc + (d.Ganhos || 0), 0);
  }, [weekdayData]);

  const totalWeeklyGastos = useMemo(() => {
    return weekdayData.reduce((acc, d) => acc + (d.Despesas || 0), 0);
  }, [weekdayData]);

  const patrimonyEvolutionData = useMemo(() => {
    const currentYear = now.getFullYear();
    return Array.from({ length: 12 }).map((_, i) => {
      const monthDate = new Date(currentYear, i, 1);
      const endOfMonthDate = endOfMonth(monthDate);
      
      // Calculate cumulative regular net up to end of this month
      let rawNet = 0;
      transactions.forEach(t => {
        if (t.payment_status === 'pending') return;
        const tDate = parseLocalDate(t.date);
        if (tDate > endOfMonthDate) return;
        
        const amount = Number(t.amount);
        if (t.category === 'Aporte Reserva' || t.category === 'Resgate Reserva' || t.category === 'Resgate de Reserva' || (t as any).isReserveTx || (t as any).isReserveAporte) {
          return;
        }
        if (t.type === 'income') rawNet += amount;
        else rawNet -= amount;
      });

      // Subtract/Add investments up to end of this month
      investmentTransactions.forEach(tx => {
        if (tx.reserve_id) return; // Handled by reserveTransactions
        if ((tx as any).payment_status === 'pending') return;
        const txDate = parseLocalDate(tx.date);
        if (txDate > endOfMonthDate) return;
        
        const amount = (Number(tx.price) * Number(tx.quantity)) + Number(tx.costs || 0);
        if (tx.operation === 'buy') {
          rawNet -= amount;
        } else {
          rawNet += amount;
        }
      });

      // Include 'rendimento' and spent 'utilizacao' from reserves up to end of this month
      (reserveTransactions || []).forEach(rt => {
        if (rt.payment_status === 'pending') return;
        const rtDate = parseLocalDate(rt.date);
        if (rtDate > endOfMonthDate) return;
        
        if (rt.type === 'rendimento') {
          rawNet += Number(rt.amount);
        } else if (rt.type === 'utilizacao') {
          const cat = (rt.category || '').toLowerCase().trim();
          const isPureResgateToCash = !rt.linked_investment_id && (!cat || cat === 'resgate' || cat === 'resgate reserva' || cat === 'resgate de reserva' || cat === 'outros');
          if (!isPureResgateToCash) {
            rawNet -= Number(rt.amount);
          }
        }
      });

      const caixaMaisReservasVal = (settings?.initial_balance || 0) + rawNet;

      // Calculate Reservas up to end of this month
      let totalInResv = 0;
      (reserves || []).forEach(r => {
        let rBalance = Number(r.saldo_inicial || 0);
        const rts = (reserveTransactions || []).filter(rt => rt.reserve_id === r.id);
        rts.forEach(rt => {
          if (rt.payment_status === 'pending') return;
          const rtDate = parseLocalDate(rt.date);
          if (rtDate > endOfMonthDate) return;
          
          if (rt.type === 'aporte') rBalance += Number(rt.amount);
          else if (rt.type === 'rendimento') rBalance += Number(rt.amount);
          else if (rt.type === 'utilizacao') rBalance -= Number(rt.amount);
        });
        totalInResv += rBalance;
      });

      // Calculate Caixa up to end of this month
      const caixaBalance = caixaMaisReservasVal - totalInResv;

      // Calculate Investimentos up to end of this month (equity)
      const posMap: Record<string, number> = {};
      investmentTransactions.forEach(tx => {
        if ((tx as any).payment_status === 'pending') return;
        const txDate = parseLocalDate(tx.date);
        if (txDate > endOfMonthDate) return;
        
        const q = Number(tx.quantity);
        if (tx.operation === 'buy') {
          posMap[tx.ticker] = (posMap[tx.ticker] || 0) + q;
        } else {
          posMap[tx.ticker] = (posMap[tx.ticker] || 0) - q;
        }
      });

      const totalInvestmentEquity = Object.entries(posMap).reduce((acc, [ticker, quantity]) => {
        if (quantity <= 0) return acc;
        // Find last transaction up to endOfMonthDate
        const lastTx = investmentTransactions
          .filter(t => t.ticker === ticker && parseLocalDate(t.date) <= endOfMonthDate)
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
        const fallbackPrice = lastTx ? Number(lastTx.price) : 0;
        const price = quotes[ticker] || fallbackPrice;
        return acc + (price * quantity);
      }, 0);

      const totalPatrimonyVal = caixaMaisReservasVal + totalInvestmentEquity;

      return {
        monthKey: format(monthDate, 'yyyy-MM'),
        month: format(monthDate, 'MMM', { locale: ptBR }),
        Investimentos: Number(totalInvestmentEquity.toFixed(2)),
        Reservas: Number(totalInResv.toFixed(2)),
        Caixa: Number(caixaBalance.toFixed(2)),
        PatrimonioTotal: Number(totalPatrimonyVal.toFixed(2)),
        isFuture: monthDate > now
      };
    }).filter(m => !m.isFuture || m.Investimentos !== 0 || m.Reservas !== 0 || m.Caixa !== 0);
  }, [transactions, reserveTransactions, investmentTransactions, reserves, settings, quotes]);

  const expensesDataRaw = useMemo(() => {
    const raw = currentPeriodTx
      .filter(t => t.type === 'expense' && (t as any).payment_status !== 'pending' && t.category !== 'Aporte Reserva' && !(t as any).isReserveAporte && !(t as any).isInvestmentTx)
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);
    if (currentPeriodInvBuys > 0) {
      raw['Compra de Investimentos'] = currentPeriodInvBuys;
    }
    return raw;
  }, [currentPeriodTx, currentPeriodInvBuys]);

  const expensesData = useMemo(() => {
    const colorsMap = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6', '#14b8a6', '#64748b'];
    return Object.entries(expensesDataRaw)
      .map(([name, value], idx) => ({
        name, 
        value: value as number, 
        color: name === 'Compra de Investimentos' ? '#3b82f6' : colorsMap[idx % colorsMap.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [expensesDataRaw]);

  const formatCurrency = (val: any, ignoreHide = false) => {
    if (hideValues && !ignoreHide) return 'R$ •••••';
    const num = Number(val);
    if (isNaN(num)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(num.toFixed(2)));
  };

  const getEfficiencyStatus = (val: number) => {
    if (val <= 0) return { label: 'Sem dados', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20 dark:bg-zinc-500/5 dark:text-zinc-400 dark:border-zinc-500/10' };
    if (val <= 0.50) return { label: 'Excelente', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-400 dark:border-emerald-500/10' };
    if (val <= 0.75) return { label: 'Bom', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20 dark:bg-blue-500/5 dark:text-blue-400 dark:border-blue-500/10' };
    if (val <= 1.00) return { label: 'Regular', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-400 dark:border-amber-500/10' };
    return { label: 'Alerta', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20 dark:bg-rose-500/5 dark:text-rose-400 dark:border-rose-500/10' };
  };

  const incomeByCategory = useMemo(() => {
    const raw = currentPeriodTx.filter(t => t.type === 'income' && (t as any).payment_status !== 'pending' && !(t as any).isDividendTx && !(t as any).isInvestmentTx).reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);
    if (currentPeriodInvSells > 0) {
      raw['Venda de Investimentos'] = currentPeriodInvSells;
    }
    if (currentPeriodDivSum > 0) {
      raw['Proventos (Investimentos)'] = currentPeriodDivSum;
    }
    return raw;
  }, [currentPeriodTx, currentPeriodInvSells, currentPeriodDivSum]);

  const pastIncomeByCategory = useMemo(() => {
    const raw = pastPeriodTx.filter(t => t.type === 'income' && (t as any).payment_status !== 'pending' && !(t as any).isDividendTx && !(t as any).isInvestmentTx).reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);
    if (pastPeriodInvSells > 0) {
      raw['Venda de Investimentos'] = pastPeriodInvSells;
    }
    if (pastPeriodDivSum > 0) {
      raw['Proventos (Investimentos)'] = pastPeriodDivSum;
    }
    return raw;
  }, [pastPeriodTx, pastPeriodInvSells, pastPeriodDivSum]);

  const incomeData = useMemo(() => {
    const incomeColorsMap = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#84cc16'];
    return Object.entries(incomeByCategory)
      .map(([name, value], idx) => {
        let color = incomeColorsMap[idx % incomeColorsMap.length];
        if (name === 'Venda de Investimentos') color = '#10b981';
        if (name === 'Proventos (Investimentos)') color = '#8b5cf6';
        return { name, value: value as number, color };
      })
      .sort((a, b) => b.value - a.value);
  }, [incomeByCategory]);

  const opCats = settings?.operational_expense_categories || ['Combustível', 'Pedágio', 'Manutenção'];
  const expensesByCategory = useMemo(() => {
    const raw = currentPeriodTx
      .filter(t => t.type === 'expense' && (t as any).payment_status !== 'pending' && t.category !== 'Aporte Reserva' && !(t as any).isReserveAporte && !(t as any).isInvestmentTx)
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);
    if (currentPeriodInvBuys > 0) {
      raw['Compra de Investimentos'] = currentPeriodInvBuys;
    }
    return raw;
  }, [currentPeriodTx, currentPeriodInvBuys]);

  const pastExpensesByCategory = useMemo(() => {
    const raw = pastPeriodTx
      .filter(t => t.type === 'expense' && (t as any).payment_status !== 'pending' && t.category !== 'Aporte Reserva' && !(t as any).isReserveAporte && !(t as any).isInvestmentTx)
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);
    if (pastPeriodInvBuys > 0) {
      raw['Compra de Investimentos'] = pastPeriodInvBuys;
    }
    return raw;
  }, [pastPeriodTx, pastPeriodInvBuys]);

  const renderCategoryTrend = (curr: number, prev: number, isExpense = false) => {
    if (globalPeriod === 'all') return null;
    
    let trend: number;
    let label = '';
    
    if (prev === 0) {
      if (curr === 0) {
        trend = 0;
      } else {
        trend = 100;
        label = 'Novidade';
      }
    } else {
      trend = ((curr - prev) / Math.abs(prev)) * 100;
    }

    const isPositive = trend >= 0;
    const isZero = trend === 0;

    if (isZero && prev === 0 && curr === 0) return null;

    const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
    const isGood = isExpense ? !isPositive : isPositive;
    
    let color = '';
    if (isGood) {
      color = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    } else {
      color = 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    }
    if (isZero) {
      color = 'text-muted-foreground bg-muted/20 border-border';
    }

    return (
      <div className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.25 rounded-md border ${color} select-none mt-0.5`}>
        {!isZero && <Icon className="w-2.5 h-2.5 shrink-0" />}
        <span>
          {label ? label : `${isPositive ? '+' : ''}${trend.toFixed(1)}%`}
        </span>
        <span className="opacity-70 font-semibold text-[8px]">
          ({formatCurrency(prev)})
        </span>
      </div>
    );
  };

  const estimatedFuelCost = currentPeriodTx.reduce((acc, t) => {
    if (t.start_km != null && t.end_km != null && settings?.vehicle_km_per_liter && settings?.fuel_price && (t.end_km - t.start_km) > 0) {
      return acc + ((t.end_km - t.start_km) / settings.vehicle_km_per_liter) * settings.fuel_price;
    }
    return acc;
  }, 0);

  const actualFuelCost = currentPeriodTx
    .filter(t => t.type === 'expense' && (t.category === 'Combustível' || t.category === 'Combustivel'))
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const getMarginStatus = (margin: number) => {
    if (margin >= marginThresholds.outstanding) {
      return {
        label: 'Alta Performance',
        bg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
        barColor: 'bg-violet-500'
      };
    } else if (margin >= marginThresholds.excellent) {
      return {
        label: 'Sólido',
        bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        barColor: 'bg-emerald-500'
      };
    } else if (margin >= marginThresholds.healthy) {
      return {
        label: 'Estável',
        bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        barColor: 'bg-blue-500'
      };
    } else if (margin >= marginThresholds.moderate) {
      return {
        label: 'Moderado',
        bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        barColor: 'bg-indigo-500'
      };
    } else if (margin >= marginThresholds.attention) {
      return {
        label: 'Sob Alerta',
        bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        barColor: 'bg-amber-500'
      };
    } else {
      return {
        label: 'Déficit',
        bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        barColor: 'bg-rose-500'
      };
    }
  };

  if (loading) {
    return (
      <div className="flex-1 w-full flex justify-center items-center h-full min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in">
      {/* Header Premium */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Painel Geral
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium mt-0.5">
            Analise seu faturamento, metas financeiras e rentabilidade por quilômetro.
          </p>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setHideValues(!hideValues)}
              className="rounded-full h-9 w-9 shrink-0 bg-muted/20 border-border/50 hover:bg-muted/40 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
              title={hideValues ? "Mostrar valores" : "Ocultar valores"}
            >
              {hideValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMonthlyReport(true)}
              className="rounded-full h-9 px-3.5 shrink-0 bg-muted/20 border-border/50 hover:bg-muted/40 font-bold text-xs active:scale-95 transition-all"
            >
              <BarChart className="w-3.5 h-3.5 mr-1.5 text-primary" />
              Relatório
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="rounded-full h-9 px-3 shrink-0 bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20 font-bold text-xs active:scale-95 transition-all"
            title="Sair da Conta (Logout Temporário)"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Sair
          </Button>
        </div>
      </header>

      {/* Patrimony / Financial Status Row */}
      {(() => {
        const totalInResv = (reserves || []).reduce((sum, r) => sum + (r.saldo_atual || 0), 0);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. Patrimônio Total */}
              <Card className="border border-border/70 hover:border-amber-500/30 shadow-2xs hover:shadow-sm transition-all duration-200 overflow-hidden relative group rounded-2xl bg-card/95">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
                <CardContent className="p-4 sm:p-4.5 flex flex-col justify-between h-full space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Patrimônio Total</p>
                    <div className="h-8.5 w-8.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Crown className="w-4 h-4 text-amber-500" />
                    </div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-500 font-mono tracking-tight truncate">
                      {formatCurrency(totalPatrimony)}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap text-[9.5px] text-muted-foreground font-semibold mt-1">
                      <span className="truncate">Cx: {formatCompactValue(bancaLivre)}</span>
                      <span>•</span>
                      <span className="truncate">Res: {formatCompactValue(totalInResv)}</span>
                      <span>•</span>
                      <span className="truncate">Inv: {formatCompactValue(totalInvestmentEquity)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2. Caixa */}
              <Card className="border border-border/70 hover:border-emerald-500/30 shadow-2xs hover:shadow-sm transition-all duration-200 overflow-hidden relative group rounded-2xl bg-card/95">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
                <CardContent className="p-4 sm:p-4.5 flex flex-col justify-between h-full space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Caixa</p>
                    <div className="h-8.5 w-8.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Wallet className="w-4 h-4 text-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-black text-foreground font-mono tracking-tight truncate">
                      {formatCurrency(bancaLivre)}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold mt-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate">Livre p/ uso</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 3. Total das Reservas */}
              <Card className="border border-border/70 hover:border-pink-500/30 shadow-2xs hover:shadow-sm transition-all duration-200 overflow-hidden relative group cursor-pointer rounded-2xl bg-card/95 active:scale-[0.98]" onClick={() => navigate('/reserves')}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl group-hover:bg-pink-500/10 transition-all pointer-events-none" />
                <CardContent className="p-4 sm:p-4.5 flex flex-col justify-between h-full space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Total Reservas</p>
                    <div className="h-8.5 w-8.5 bg-pink-500/10 border border-pink-500/20 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <PiggyBank className="w-4 h-4 text-pink-500" />
                    </div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-black text-pink-500 font-mono tracking-tight truncate">
                      {formatCurrency(totalInReserves)}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold mt-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-pink-500 shrink-0" />
                      <span className="truncate">Fundos reservados</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 4. Total dos Investimentos */}
              <Card 
                onClick={() => navigate('/investments?tab=carteira', { state: { tab: 'carteira' } })}
                className="border border-border/70 hover:border-blue-500/40 shadow-2xs hover:shadow-sm transition-all duration-200 overflow-hidden relative group cursor-pointer rounded-2xl bg-card/95 active:scale-[0.98]"
                title="Abrir Carteira de Investimentos"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all pointer-events-none" />
                <CardContent className="p-4 sm:p-4.5 flex flex-col justify-between h-full space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Investimentos</p>
                    <div className="h-8.5 w-8.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                    </div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-black text-blue-500 font-mono tracking-tight truncate">
                      {formatCurrency(totalInvestmentEquity)}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold mt-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                      <span className="truncate">Valor de mercado</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })()}

      {/* Weekly Goal Section */}
      {/* Metas Semanais */}
      <Card className="border border-border/70 shadow-2xs hover:shadow-xs transition-all duration-200 overflow-hidden relative group bg-card/95 rounded-2xl">
        <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-all pointer-events-none" />
        <CardContent className="p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Target className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider">Metas Semanais</h3>
                <p className="text-[9.5px] sm:text-[10px] text-muted-foreground font-medium">Acompanhe seu desempenho de segunda a domingo</p>
              </div>
            </div>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => {
                try {
                  const goalVal = settings?.weekly_goal;
                  const netGoalVal = settings?.weekly_net_goal;
                  const goalStr = goalVal !== undefined && goalVal !== null && !isNaN(Number(goalVal)) ? (Number(goalVal) * 100).toFixed(0) : '';
                  const netGoalStr = netGoalVal !== undefined && netGoalVal !== null && !isNaN(Number(netGoalVal)) ? (Number(netGoalVal) * 100).toFixed(0) : '';
                  setTempWeeklyGoal(goalStr);
                  setTempWeeklyNetGoal(netGoalStr);
                  setShowWeeklyGoalConfig(true);
                } catch (err) {
                  console.error("Erro ao abrir configuração de metas:", err);
                }
              }}
              className="h-7 px-2.5 text-xs font-extrabold text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20 rounded-lg transition-all active:scale-95 gap-1.5 shadow-2xs"
            >
              <Settings className="w-3 h-3" />
              <span className="hidden sm:inline">Configurar</span> Metas
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
            {/* Faturamento Goal Column */}
            <div className="bg-muted/20 border border-border/50 hover:border-indigo-500/30 rounded-xl p-2.5 sm:p-3 space-y-2 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Faturamento (Bruto)</span>
                </div>
                {weeklyGoalStats.goal > 0 && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.25 rounded-full border ${weeklyGoalStats.evolution >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'}`}>
                    {weeklyGoalStats.evolution > 0 ? '+' : ''}{weeklyGoalStats.evolution.toFixed(1)}% vs ant.
                  </span>
                )}
              </div>

              {weeklyGoalStats.goal > 0 ? (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg sm:text-xl font-black text-foreground tracking-tight font-mono">
                        {hideValues ? '•••••' : formatCurrency(weeklyGoalStats.income)}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-semibold">
                        / {hideValues ? '•••••' : formatCurrency(weeklyGoalStats.goal)}
                      </span>
                    </div>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${weeklyGoalStats.income >= weeklyGoalStats.goal ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'}`}>
                      {weeklyGoalStats.income >= weeklyGoalStats.goal ? 'Meta Batida 🎉' : `${weeklyGoalStats.progress.toFixed(0)}% Atingido`}
                    </span>
                  </div>

                  <div className="text-[9.5px] font-bold text-muted-foreground">
                    {weeklyGoalStats.income < weeklyGoalStats.goal ? (
                      <span>Falta <span className="text-rose-500 font-extrabold">{hideValues ? '•••••' : formatCurrency(weeklyGoalStats.goal - weeklyGoalStats.income)}</span> para a meta</span>
                    ) : (
                      <span className="text-emerald-500 font-extrabold">Excedente: +{hideValues ? '•••••' : formatCurrency(weeklyGoalStats.income - weeklyGoalStats.goal)}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs font-semibold text-muted-foreground py-1.5">Meta de faturamento não definida</div>
              )}

              {weeklyGoalStats.goal > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="h-1.5 w-full bg-muted/80 rounded-full overflow-hidden relative">
                    <div 
                      className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out opacity-25 ${weeklyGoalStats.lastIsCompleted ? 'bg-emerald-500' : 'bg-muted-foreground'}`}
                      style={{ width: `${Math.min(100, weeklyGoalStats.lastProgress)}%` }}
                      title={`Semana anterior: ${weeklyGoalStats.lastProgress.toFixed(1)}%`}
                    />
                    <div 
                      className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${weeklyGoalStats.isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${Math.min(100, weeklyGoalStats.progress)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-muted-foreground font-semibold">
                    <span>Progresso: <strong className="text-foreground">{weeklyGoalStats.progress.toFixed(1)}%</strong></span>
                    <span>Ant: <strong className="text-foreground">{hideValues ? '••••' : formatCurrency(weeklyGoalStats.lastIncome)}</strong></span>
                  </div>
                </div>
              )}
            </div>

            {/* Lucro Liquido Goal Column */}
            <div className="bg-muted/20 border border-border/50 hover:border-emerald-500/30 rounded-xl p-2.5 sm:p-3 space-y-2 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Lucro Líquido</span>
                </div>
                {weeklyGoalStats.netGoal > 0 && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.25 rounded-full border ${weeklyGoalStats.netEvolution >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'}`}>
                    {weeklyGoalStats.netEvolution > 0 ? '+' : ''}{weeklyGoalStats.netEvolution.toFixed(1)}% vs ant.
                  </span>
                )}
              </div>

              {weeklyGoalStats.netGoal > 0 ? (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg sm:text-xl font-black text-foreground tracking-tight font-mono">
                        {hideValues ? '•••••' : formatCurrency(weeklyGoalStats.net)}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-semibold">
                        / {hideValues ? '•••••' : formatCurrency(weeklyGoalStats.netGoal)}
                      </span>
                    </div>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${weeklyGoalStats.net >= weeklyGoalStats.netGoal ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'}`}>
                      {weeklyGoalStats.net >= weeklyGoalStats.netGoal ? 'Meta Batida 🎉' : `${weeklyGoalStats.netProgress.toFixed(0)}% Atingido`}
                    </span>
                  </div>

                  <div className="text-[9.5px] font-bold text-muted-foreground">
                    {weeklyGoalStats.net < weeklyGoalStats.netGoal ? (
                      <span>Falta <span className="text-rose-500 font-extrabold">{hideValues ? '•••••' : formatCurrency(weeklyGoalStats.netGoal - weeklyGoalStats.net)}</span> para a meta</span>
                    ) : (
                      <span className="text-emerald-500 font-extrabold">Excedente: +{hideValues ? '•••••' : formatCurrency(weeklyGoalStats.net - weeklyGoalStats.netGoal)}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs font-semibold text-muted-foreground py-1.5">Meta de lucro não definida</div>
              )}

              {weeklyGoalStats.netGoal > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="h-1.5 w-full bg-muted/80 rounded-full overflow-hidden relative">
                    <div 
                      className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out opacity-25 ${weeklyGoalStats.lastIsNetCompleted ? 'bg-emerald-500' : 'bg-muted-foreground'}`}
                      style={{ width: `${Math.min(100, weeklyGoalStats.lastNetProgress)}%` }}
                      title={`Semana anterior: ${weeklyGoalStats.lastNetProgress.toFixed(1)}%`}
                    />
                    <div 
                      className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${weeklyGoalStats.isNetCompleted ? 'bg-emerald-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, weeklyGoalStats.netProgress)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-muted-foreground font-semibold">
                    <span>Progresso: <strong className="text-foreground">{weeklyGoalStats.netProgress.toFixed(1)}%</strong></span>
                    <span>Ant: <strong className="text-foreground">{hideValues ? '••••' : formatCurrency(weeklyGoalStats.lastNet)}</strong></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendário & Heatmap de Produtividade Diária (GitHub Style) */}
      <DailyProductivityHeatmap
        transactions={allTransactionsAdjusted}
        settings={settings}
        hideValues={hideValues}
        formatCurrency={formatCurrency}
      />

      {/* Evolução Patrimonial: Investimentos, Reservas, Caixa e Patrimônio */}
      <PatrimonyEvolution
        transactions={transactions}
        reserveTransactions={reserveTransactions}
        investmentTransactions={investmentTransactions}
        reserves={reserves}
        settings={settings}
        quotes={quotes}
        dividends={dividends}
        hideValues={hideValues}
        formatCurrency={formatCurrency}
      />

      {/* Monthly Trend (Evolução Mensal) */}
      <Card className="border border-border/80 shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            <CardTitle className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
              Evolução Mensal
            </CardTitle>
          </div>
          <CardDescription className="text-xs">Faturamento bruto, gasto total e lucro líquido nos últimos 6 meses.</CardDescription>
        </CardHeader>
        <CardContent className="h-[360px] w-full pt-4">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={monthlyTrend} margin={{ top: 15, right: 15, left: -15, bottom: 15 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} tickFormatter={(val) => `R$ ${Math.round(val).toLocaleString('pt-BR')}`} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                labelStyle={{ fontWeight: 'bold', fontSize: 12, color: '#f4f4f5' }}
                itemStyle={{ fontSize: 12, fontWeight: 'medium' }}
                formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
              />
              <Legend iconSize={8} iconType="circle" verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11, paddingTop: 10, fontWeight: 'bold' }} />
              <Line type="monotone" dataKey="faturamento" name="Faturamento Bruto" stroke="#10b981" strokeWidth={3} dot={{ r: 4, stroke: '#10b981', strokeWidth: 2, fill: '#18181b' }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="despesas" name="Gasto Total" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, stroke: '#ef4444', strokeWidth: 2, fill: '#18181b' }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="lucroPatrimonio" name="Lucro Líquido" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4, stroke: '#06b6d4', strokeWidth: 2, fill: '#18181b' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Curva de Proventos & Renda Passiva */}
      <PassiveIncomeEvolutionChart
        dividends={dividends}
        reserveTransactions={reserveTransactions}
        investmentTransactions={investmentTransactions}
        reserves={reserves}
        hideValues={hideValues}
        formatCurrency={formatCurrency}
      />

      {/* Reserves Quick Slider Row */}
      {reserves && reserves.length > 0 && (
        <Card className="border border-border/70 shadow-2xs hover:shadow-xs transition-all duration-200 overflow-hidden relative group bg-card/95 rounded-xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="h-7.5 w-7.5 bg-pink-500/10 border border-pink-500/20 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <PiggyBank className="w-4 h-4 text-pink-500" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  Suas Reservas
                </h3>
                <p className="text-[9.5px] text-muted-foreground font-medium">Saldo consolidado e movimentação no período</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 px-2.5 text-[11px] font-bold gap-1 rounded-lg border-border/60 hover:bg-muted/50 active:scale-95 transition-all shadow-2xs" 
              onClick={() => navigate('/reserves')}
            >
              <span>Ver Detalhes</span>
              <ArrowRight className="w-3 h-3 text-pink-500" />
            </Button>
          </div>

          {/* Reserve Period Flow Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-pink-500/[0.03] border border-pink-500/15 rounded-lg p-2 sm:p-2.5 flex flex-col justify-between space-y-0.5">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Movimentação</p>
                <PiggyBank className="w-3 h-3 text-pink-500/70" />
              </div>
              <p className="text-xs sm:text-sm font-black text-pink-500 font-mono tracking-tight">{hideValues ? '•••••' : formatCurrency(reserveMovimentacaoPeriod)}</p>
            </div>
            
            <div className="bg-emerald-500/[0.03] border border-emerald-500/15 rounded-lg p-2 sm:p-2.5 flex flex-col justify-between space-y-0.5">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Aportes (Período)</p>
                <TrendingUp className="w-3 h-3 text-emerald-500/70" />
              </div>
              <p className="text-xs sm:text-sm font-black text-emerald-500 font-mono tracking-tight">{hideValues ? '•••••' : formatCurrency(totalDepositedInReservesPeriod)}</p>
            </div>

            <div className="bg-amber-500/[0.03] border border-amber-500/15 rounded-lg p-2 sm:p-2.5 flex flex-col justify-between space-y-0.5">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Uso c/ Despesas</p>
                <Wrench className="w-3 h-3 text-amber-500/70" />
              </div>
              <p className="text-xs sm:text-sm font-black text-amber-500 font-mono tracking-tight">{hideValues ? '•••••' : formatCurrency(totalUtilizadosInReservesPeriod)}</p>
            </div>

            <div className="bg-indigo-500/[0.03] border border-indigo-500/15 rounded-lg p-2 sm:p-2.5 flex flex-col justify-between space-y-0.5">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Saldo Total</p>
                <Wallet className="w-3 h-3 text-indigo-500/70" />
              </div>
              <p className="text-xs sm:text-sm font-black text-indigo-500 font-mono tracking-tight">{hideValues ? '•••••' : formatCurrency(totalInReserves)}</p>
            </div>
          </div>

          {/* Individual Reserves Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {sortedReservesByLastTransaction.slice(0, 4).map(r => {
              const iconMap = {
                PiggyBank,
                Wrench,
                ShieldAlert,
                Car,
                Coins,
                Sparkles,
                Heart,
                Briefcase
              };
              const TargetComponent = iconMap[r.icon as keyof typeof iconMap] || PiggyBank;

              // Calculate period aportes and utilizacaos for this specific reserve
              const periodAportes = (reserveTransactions || [])
                .filter(rt => rt.reserve_id === r.id && rt.type === 'aporte' && (globalPeriod === 'all' || isWithinInterval(parseLocalDate(rt.date), { start: currentStart, end: currentEnd })))
                .reduce((sum, rt) => sum + Number(rt.amount), 0);
                
              const periodUtilizacaos = (reserveTransactions || [])
                .filter(rt => rt.reserve_id === r.id && rt.type === 'utilizacao' && (globalPeriod === 'all' || isWithinInterval(parseLocalDate(rt.date), { start: currentStart, end: currentEnd })))
                .reduce((sum, rt) => sum + Number(rt.amount), 0);

              const hasTarget = Boolean(r.meta_objetivo && r.meta_objetivo > 0);
              const targetProgress = hasTarget ? Math.min(100, ((r.saldo_atual || 0) / (r.meta_objetivo || 1)) * 100) : 0;

              return (
                <div 
                  key={r.id} 
                  onClick={() => navigate('/reserves')}
                  className="bg-muted/20 hover:bg-muted/40 border border-border/50 hover:border-pink-500/30 rounded-lg p-2.5 transition-all cursor-pointer group flex flex-col justify-between space-y-1.5 active:scale-[0.99] relative overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div 
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-2xs"
                        style={{ 
                          backgroundColor: `${r.color}15`, 
                          border: `1px solid ${r.color}35`, 
                          color: r.color 
                        }}
                      >
                        <TargetComponent className="w-3.5 h-3.5" style={{ color: r.color }} />
                      </div>
                      <p className="font-extrabold text-foreground truncate tracking-tight text-xs group-hover:text-pink-500 transition-colors">{r.name}</p>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs sm:text-sm font-black text-foreground font-mono tracking-tight">
                      {hideValues ? '•••••' : formatCurrency(r.saldo_atual || 0)}
                    </div>

                    {hasTarget && (
                      <div className="space-y-0.5 mt-1">
                        <div className="h-1 w-full bg-muted/80 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500" 
                            style={{ width: `${targetProgress}%`, backgroundColor: r.color }} 
                          />
                        </div>
                        <div className="flex items-center justify-between text-[8px] font-bold text-muted-foreground">
                          <span>{targetProgress.toFixed(0)}% da meta</span>
                          <span>Meta: {hideValues ? '••••' : formatCompactValue(r.meta_objetivo || 0)}</span>
                        </div>
                      </div>
                    )}

                    {(periodAportes > 0 || periodUtilizacaos > 0) && (
                      <div className="flex items-center gap-1 mt-1.5 border-t border-border/40 pt-1 text-[8px] font-mono font-extrabold">
                        {periodAportes > 0 && (
                          <span className="px-1 py-0.25 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 flex items-center gap-0.5" title="Acumulado no período">
                            +{hideValues ? '•••' : formatCurrency(periodAportes)}
                          </span>
                        )}
                        {periodUtilizacaos > 0 && (
                          <span className="px-1 py-0.25 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 flex items-center gap-0.5" title="Usado no período">
                            -{hideValues ? '•••' : formatCurrency(periodUtilizacaos)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Barra de Períodos & Navegação (acima dos quadrados informativos de Faturamento, Lucro, Despesas, etc.) */}
      <div className="bg-card border border-border/70 p-3.5 sm:p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-foreground tracking-tight">
                  {getPeriodLabel()}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {format(currentStart, 'dd/MM/yyyy')} — {format(currentEnd, 'dd/MM/yyyy')}
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
              onClick={() => handleStepDashboardPeriod(-1)}
              className="h-8 px-2.5 rounded-xl border border-border/70 bg-muted/20 hover:bg-muted text-xs font-bold text-foreground flex items-center gap-1 transition-all cursor-pointer"
              title="Período / Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Anterior</span>
            </button>

            {globalPeriod !== 'month' && (
              <button
                type="button"
                onClick={() => setGlobalPeriod('month')}
                className="h-8 px-2.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-[11px] font-extrabold text-primary flex items-center gap-1 transition-all cursor-pointer"
                title="Voltar para o Mês Atual"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Mês Atual</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleStepDashboardPeriod(1)}
              className="h-8 px-2.5 rounded-xl border border-border/70 bg-muted/20 hover:bg-muted text-xs font-bold text-foreground flex items-center gap-1 transition-all cursor-pointer"
              title="Próximo Período / Mês"
            >
              <span className="hidden xs:inline">Próximo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Botões Rápidos de Período */}
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
            { id: 'custom', label: 'Personalizado' }
          ].map((period) => {
            const isSelected = globalPeriod === period.id;
            return (
              <button
                key={period.id}
                type="button"
                onClick={() => setGlobalPeriod(period.id)}
                className="relative px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap focus:outline-none shrink-0 text-center active:scale-95 cursor-pointer"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {isSelected && (
                  <motion.span
                    layoutId="dashboard-active-period"
                    className="absolute inset-0 bg-background border border-border/60 shadow-xs rounded-lg"
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  />
                )}
                <span className={`relative z-10 transition-colors duration-200 ${isSelected ? 'text-foreground font-black' : 'text-muted-foreground hover:text-foreground'}`}>
                  {period.label}
                </span>
              </button>
            );
          })}
        </div>

        {globalPeriod === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 animate-in fade-in slide-in-from-top-2">
            <span className="text-muted-foreground text-xs font-bold">Intervalo de Datas:</span>
            <input
              type="date"
              className="bg-background border border-border/60 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary outline-none"
              value={customDateRange?.start || ''}
              onChange={(e) => setCustomDateRange({ start: e.target.value, end: customDateRange?.end || getTodayLocalDateStr() })}
            />
            <span className="text-muted-foreground text-xs font-bold">até</span>
            <input
              type="date"
              className="bg-background border border-border/60 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary outline-none"
              value={customDateRange?.end || ''}
              onChange={(e) => setCustomDateRange({ start: customDateRange?.start || getTodayLocalDateStr(), end: e.target.value })}
            />
          </div>
        )}
      </div>



      {/* Analytics Main Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-2.5">
        {/* indicator 1: Faturamento Bruto */}
        {(() => {
          const totalInflow = summary.totalIncome + (summary.totalVendaInvestimento || 0) + (summary.rendimentosReserva || 0);
          const segments = [
            { label: 'Caixa', val: summary.totalIncome, pct: totalInflow > 0 ? (summary.totalIncome / totalInflow) * 100 : 0, color: 'bg-emerald-500', textColor: 'text-emerald-500', textBoldColor: 'text-emerald-600 dark:text-emerald-400', format: formatCompactValue(summary.totalIncome) },
            { label: 'Ativos', val: summary.totalVendaInvestimento || 0, pct: totalInflow > 0 ? ((summary.totalVendaInvestimento || 0) / totalInflow) * 100 : 0, color: 'bg-blue-500', textColor: 'text-blue-500', textBoldColor: 'text-blue-600 dark:text-blue-400', format: formatCompactValue(summary.totalVendaInvestimento || 0) },
            { label: 'Proventos', val: summary.rendimentosReserva || 0, pct: totalInflow > 0 ? ((summary.rendimentosReserva || 0) / totalInflow) * 100 : 0, color: 'bg-purple-500', textColor: 'text-purple-500', textBoldColor: 'text-purple-600 dark:text-purple-400', format: formatCompactValue(summary.rendimentosReserva || 0) }
          ].filter(s => s.val > 0).sort((a, b) => b.val - a.val);
          return (
            <Card
              onClick={() => setSelectedIndicator('faturamento_bruto')}
              className="border border-border/70 hover:border-emerald-500/50 shadow-2xs hover:shadow-md transition-all duration-200 bg-card/95 flex flex-col justify-between rounded-xl overflow-hidden group cursor-pointer active:scale-[0.99]"
              title="Clique para ver o histórico mensal de Faturamento (Bruto)"
            >
              <CardHeader className="p-2.5 pb-1 sm:p-3 sm:pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-500 w-[85%] truncate">
                  Faturamento (Bruto)
                </CardTitle>
                <div className="p-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                </div>
              </CardHeader>
              <CardContent className="p-2.5 pt-0 sm:p-3 sm:pt-0 flex-1 flex flex-col justify-between space-y-1.5">
                <div>
                  <div className="text-base sm:text-lg font-black text-emerald-500 tracking-tight font-mono leading-tight">
                    {formatCurrency(totalInflow)}
                  </div>
                  {renderTrend(summary.incomeTrend)}
                </div>

                <div className="pt-1.5 border-t border-border/40 space-y-1">
                  <div className="w-full h-1 bg-muted/80 rounded-full overflow-hidden flex">
                    {segments.map((s, i) => <div key={i} className={`${s.color} h-full transition-all duration-300`} style={{ width: `${s.pct}%` }} />)}
                  </div>

                  <div className="grid gap-0.5 text-center leading-tight" style={{ gridTemplateColumns: `repeat(${segments.length || 1}, minmax(0, 1fr))` }}>
                    {segments.map((s, i) => (
                      <div key={i} className={i > 0 ? "border-l border-border/40 pl-0.5" : ""}>
                        <span className={`text-[6.5px] sm:text-[7px] uppercase font-black ${s.textColor} block truncate`}>{s.label} ({Math.round(s.pct)}%)</span>
                        <span className={`text-[8px] sm:text-[8.5px] font-mono font-bold ${s.textBoldColor} block truncate`}>{s.format}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* indicator 2: Faturamento Líquido Operacional (NOVO & SOLICITADO) */}
        {(() => {
          const fatLiquidoOp = summary.netOperatingProfit;
          const margemOp = summary.totalIncome > 0 ? (fatLiquidoOp / summary.totalIncome) * 100 : 0;
          return (
            <Card
              onClick={() => setSelectedIndicator('fat_liquido_op')}
              className="border border-emerald-500/30 hover:border-emerald-500/60 shadow-2xs hover:shadow-md transition-all duration-200 bg-emerald-500/[0.02] flex flex-col justify-between rounded-xl overflow-hidden group cursor-pointer active:scale-[0.99]"
              title="Clique para ver o histórico mensal de Fat. Líquido (Pós-Op)"
            >
              <CardHeader className="p-2.5 pb-1 sm:p-3 sm:pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 w-[85%] truncate flex items-center gap-1">
                  Fat. Líquido (Pós-Op)
                </CardTitle>
                <div className="p-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                  <Calculator className="w-3 h-3 text-emerald-500" />
                </div>
              </CardHeader>
              <CardContent className="p-2.5 pt-0 sm:p-3 sm:pt-0 flex-1 flex flex-col justify-between space-y-1.5">
                <div>
                  <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-tight font-mono leading-tight">
                    {formatCurrency(fatLiquidoOp)}
                  </div>
                  {renderTrend(summary.netOperatingProfitTrend)}
                </div>

                <div className="pt-1.5 border-t border-border/40 grid grid-cols-2 gap-1 text-[8.5px] font-bold text-muted-foreground leading-none">
                  <div className="truncate">
                    <span className="text-[6.5px] sm:text-[7px] uppercase font-black text-amber-500 block">Custos Op</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 font-bold text-[8px] sm:text-[8.5px]">-{formatCompactValue(summary.opExpensePuro)}</span>
                  </div>
                  <div className="truncate text-right border-l border-border/40 pl-1">
                    <span className="text-[6.5px] sm:text-[7px] uppercase font-black text-emerald-500 block">Margem Op</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[8px] sm:text-[8.5px]">{margemOp.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* indicator 2: Gastos Totais */}
        {(() => {
          const valOperacional = summary.opExpensePuro || 0;
          
          // Encontrar a reserva de investimento por ID de configuração ou pelo nome
          const investmentReserve = (reserves || []).find(r => 
            (settings?.default_investment_reserve_id && r.id === settings.default_investment_reserve_id) || 
            r.name.toLowerCase().includes('invest') || 
            r.name.toLowerCase().includes('ativo') ||
            r.name.toLowerCase().includes('carteira')
          );
          const investmentReserveId = investmentReserve?.id;

          // Resgates da reserva de investimentos no período atual
          const valResgatesInv = (reserveTransactions || [])
            .filter(rt => {
              const isMatch = investmentReserveId 
                ? rt.reserve_id === investmentReserveId 
                : rt.description?.toLowerCase().includes('invest') || rt.description?.toLowerCase().includes('ativo');
              const isAssetPurchase = rt.linked_investment_id || rt.description?.toLowerCase().includes('compra');
              return isMatch && rt.type === 'utilizacao' && !isAssetPurchase && (globalPeriod === 'all' || isWithinInterval(parseLocalDate(rt.date), { start: currentStart, end: currentEnd }));
            })
            .reduce((sum, rt) => sum + Number(rt.amount), 0);

          const valPessoal = Math.max(0, (summary.perExpense || 0) - valResgatesInv);

          const totalSum = valOperacional + valPessoal;

          // Cálculo do período anterior para a tendência correspondente
          const pastOperacional = past.opExpPuro || 0;
          const pastResgatesInv = (reserveTransactions || [])
            .filter(rt => {
              const isMatch = investmentReserveId 
                ? rt.reserve_id === investmentReserveId 
                : rt.description?.toLowerCase().includes('invest') || rt.description?.toLowerCase().includes('ativo');
              const isAssetPurchase = rt.linked_investment_id || rt.description?.toLowerCase().includes('compra');
              return isMatch && rt.type === 'utilizacao' && !isAssetPurchase && (globalPeriod === 'all' || isWithinInterval(parseLocalDate(rt.date), { start: pastStart, end: pastEnd }));
            })
            .reduce((sum, rt) => sum + Number(rt.amount), 0);
          const pastPessoal = Math.max(0, (past.perExp || 0) - pastResgatesInv);
          const totalPastSum = pastOperacional + pastPessoal;
          
          const trendGastos = getTrend(totalSum, totalPastSum);

          const segments = [
            { label: 'Operacional', val: valOperacional, pct: totalSum > 0 ? (valOperacional / totalSum) * 100 : 0, color: 'bg-amber-500', textColor: 'text-amber-500', textBoldColor: 'text-amber-600 dark:text-amber-400', format: formatCompactValue(valOperacional) },
            { label: 'Pessoal', val: valPessoal, pct: totalSum > 0 ? (valPessoal / totalSum) * 100 : 0, color: 'bg-rose-500', textColor: 'text-rose-500', textBoldColor: 'text-rose-600 dark:text-rose-400', format: formatCompactValue(valPessoal) }
          ].filter(s => s.val > 0).sort((a, b) => b.val - a.val);

          return (
            <Card
              onClick={() => setSelectedIndicator('gastos_totais')}
              className="border border-border/70 hover:border-rose-500/50 shadow-2xs hover:shadow-md transition-all duration-200 bg-card/95 flex flex-col justify-between rounded-xl overflow-hidden group cursor-pointer active:scale-[0.99]"
              title="Clique para ver o histórico mensal de Gastos Totais"
            >
              <CardHeader className="p-2.5 pb-1 sm:p-3 sm:pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-rose-500 w-[85%] truncate">
                  Gastos Totais
                </CardTitle>
                <div className="p-1 bg-rose-500/10 border border-rose-500/20 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                  <TrendingDown className="w-3 h-3 text-rose-500" />
                </div>
              </CardHeader>
              <CardContent className="p-2.5 pt-0 sm:p-3 sm:pt-0 flex-1 flex flex-col justify-between space-y-1.5">
                <div>
                  <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-500 tracking-tight font-mono leading-tight">
                    {formatCurrency(totalSum)}
                  </div>
                  {renderTrend(trendGastos, true)}
                </div>

                <div className="pt-1.5 border-t border-border/40 space-y-1">
                  <div className="w-full h-1 bg-muted/80 rounded-full overflow-hidden flex">
                    {segments.map((s, i) => <div key={i} className={`${s.color} h-full transition-all duration-300`} style={{ width: `${s.pct}%` }} />)}
                  </div>

                  <div className="grid gap-0.5 text-center leading-tight" style={{ gridTemplateColumns: `repeat(${segments.length || 1}, minmax(0, 1fr))` }}>
                    {segments.map((s, i) => (
                      <div key={i} className={i > 0 ? "border-l border-border/40 pl-0.5" : ""}>
                        <span className={`text-[6.5px] sm:text-[7px] uppercase font-black ${s.textColor} block truncate`}>
                          {s.label === 'Operacional' ? 'Operac.' : s.label} ({Math.round(s.pct)}%)
                        </span>
                        <span className={`text-[8px] sm:text-[8.5px] font-mono font-bold ${s.textBoldColor} block truncate`}>{s.format}</span>
                      </div>
                    ))}
                    {segments.length === 0 && (
                      <div className="text-center py-0.5">
                        <span className="text-[7.5px] text-muted-foreground block">Sem gastos</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* indicator 5: Op Expense (Puro) */}
        {(() => {
          const valReserve = Math.max(0, summary.opExpReserve - summary.fuelReserve);
          const valCaixa = Math.max(0, summary.opExpensePuro - valReserve);

          const segments = [
            { label: 'Caixa', val: valCaixa, pct: summary.opExpensePuro > 0 ? (valCaixa / summary.opExpensePuro) * 100 : 0, color: 'bg-amber-500', textColor: 'text-amber-500', textBoldColor: 'text-amber-600 dark:text-amber-400', format: formatCurrency(valCaixa) },
            { label: 'Resgate', val: valReserve, pct: summary.opExpensePuro > 0 ? (valReserve / summary.opExpensePuro) * 100 : 0, color: 'bg-pink-500', textColor: 'text-pink-500', textBoldColor: 'text-pink-600 dark:text-pink-400', format: formatCurrency(valReserve) }
          ].filter(s => s.val > 0).sort((a, b) => b.val - a.val);

          return (
            <Card
              onClick={() => setSelectedIndicator('operacional_puro')}
              className="border border-border/70 hover:border-amber-500/50 shadow-2xs hover:shadow-md transition-all duration-200 bg-card/95 flex flex-col justify-between rounded-xl overflow-hidden group cursor-pointer active:scale-[0.99]"
              title="Clique para ver o histórico mensal de Operacional (Puro)"
            >
              <CardHeader className="p-2.5 pb-1 sm:p-3 sm:pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-amber-500 w-[85%] truncate">
                  Operacional (Puro)
                </CardTitle>
                <div className="p-1 bg-amber-500/10 border border-amber-500/20 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                  <Fuel className="w-3 h-3 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent className="p-2.5 pt-0 sm:p-3 sm:pt-0 flex-1 flex flex-col justify-between space-y-1.5">
                <div>
                  <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-500 tracking-tight font-mono leading-tight">
                    {formatCurrency(summary.opExpensePuro || 0)}
                  </div>
                  {renderTrend(summary.opPuroTrend, true)}
                </div>
                
                <div className="pt-1.5 border-t border-border/40 space-y-1">
                  <div className="w-full h-1 bg-muted/80 rounded-full overflow-hidden flex">
                    {segments.map((s, i) => <div key={i} className={`${s.color} h-full transition-all duration-300`} style={{ width: `${s.pct}%` }} />)}
                  </div>

                  <div className="grid gap-0.5 text-center leading-tight" style={{ gridTemplateColumns: `repeat(${segments.length || 1}, minmax(0, 1fr))` }}>
                    {segments.map((s, i) => (
                      <div key={i} className={i > 0 ? "border-l border-border/40 pl-0.5" : ""}>
                        <span className={`text-[6.5px] sm:text-[7px] uppercase font-black ${s.textColor} block truncate`}>{s.label} ({Math.round(s.pct)}%)</span>
                        <span className={`text-[8px] sm:text-[8.5px] font-mono font-bold ${s.textBoldColor} block truncate`}>{s.format}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* indicator 3: Lucro Líquido */}
        {(() => {
          const valEntradas = summary.totalIncome;
          const valSaidas = summary.totalExpense;

          const segments = [
            { label: 'Entradas', val: valEntradas, color: 'bg-emerald-500', textColor: 'text-emerald-500', textBoldColor: 'text-emerald-600 dark:text-emerald-400', format: formatCurrency(valEntradas) },
            { label: 'Saídas', val: valSaidas, color: 'bg-rose-500', textColor: 'text-rose-500', textBoldColor: 'text-rose-600 dark:text-rose-400', format: formatCurrency(valSaidas) }
          ].filter(s => s.val > 0);

          const totalSum = valEntradas + valSaidas;
          const segmentsWithPct = segments.map(s => ({
            ...s,
            pct: totalSum > 0 ? (s.val / totalSum) * 100 : 0
          }));

          return (
            <Card
              onClick={() => setSelectedIndicator('lucro_liquido')}
              className={`border shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between rounded-xl overflow-hidden group cursor-pointer active:scale-[0.99] ${summary.netProfitPatrimony >= 0 ? 'border-indigo-500/25 bg-indigo-500/[0.02] hover:border-indigo-500/50' : 'border-rose-500/25 bg-rose-500/[0.02] hover:border-rose-500/50'}`}
              title="Clique para ver o histórico mensal de Lucro Líquido"
            >
              <CardHeader className="p-2.5 pb-1 sm:p-3 sm:pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground w-[85%] truncate">
                  Lucro Líquido
                </CardTitle>
                <div className={`p-1 border rounded-lg shrink-0 group-hover:scale-105 transition-transform ${summary.netProfitPatrimony >= 0 ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                  <Landmark className={`w-3 h-3 ${summary.netProfitPatrimony >= 0 ? 'text-indigo-500' : 'text-rose-500'}`} />
                </div>
              </CardHeader>
              <CardContent className="p-2.5 pt-0 sm:p-3 sm:pt-0 flex-1 flex flex-col justify-between space-y-1.5">
                <div>
                  <div className={`text-base sm:text-lg font-black tracking-tight font-mono leading-tight ${summary.netProfitPatrimony >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`}>
                    {formatCurrency(summary.netProfitPatrimony)}
                  </div>
                  {renderTrend(summary.netPatrimonyTrend)}
                </div>

                <div className="pt-1.5 border-t border-border/40 space-y-1">
                  <div className="w-full h-1 bg-muted/80 rounded-full overflow-hidden flex">
                    {segmentsWithPct.map((s, i) => (
                      <div key={i} className={`${s.color} h-full transition-all duration-300`} style={{ width: `${s.pct}%` }} />
                    ))}
                  </div>

                  <div className="grid gap-0.5 text-center leading-tight" style={{ gridTemplateColumns: `repeat(${segmentsWithPct.length || 1}, minmax(0, 1fr))` }}>
                    {segmentsWithPct.map((s, i) => (
                      <div key={i} className={i > 0 ? "border-l border-border/40 pl-0.5" : ""}>
                        <span className={`text-[6.5px] sm:text-[7px] uppercase font-black ${s.textColor} block truncate`}>{s.label}</span>
                        <span className={`text-[8px] sm:text-[8.5px] font-mono font-bold ${s.textBoldColor} block truncate`}>{s.format}</span>
                      </div>
                    ))}
                    {segmentsWithPct.length === 0 && (
                      <div className="text-center py-0.5">
                        <span className="text-[7.5px] text-muted-foreground block">Sem movimentações</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* indicator 4: Balanço do Caixa */}
        {(() => {
          const valEntradas = summary.totalIncome;
          const valGastos = summary.opExpensePuro + summary.perExpense;
          const valReserva = summary.reserveAporte;

          const segments = [
            { label: 'Entradas', val: valEntradas, color: 'bg-emerald-500', textColor: 'text-emerald-500', textBoldColor: 'text-emerald-600 dark:text-emerald-400', format: formatCompactValue(valEntradas) },
            { label: 'Gastos', val: valGastos, color: 'bg-rose-500', textColor: 'text-rose-500', textBoldColor: 'text-rose-600 dark:text-rose-400', format: formatCompactValue(valGastos) },
            { label: 'Aportes', val: valReserva, color: 'bg-amber-500', textColor: 'text-amber-500', textBoldColor: 'text-amber-600 dark:text-amber-400', format: formatCompactValue(valReserva) }
          ].filter(s => s.val !== 0);

          const totalAbs = segments.reduce((sum, s) => sum + Math.abs(s.val), 0);
          const segmentsWithPct = segments.map(s => ({
            ...s,
            pct: totalAbs > 0 ? (Math.abs(s.val) / totalAbs) * 100 : 0
          }));

          return (
            <Card
              onClick={() => setSelectedIndicator('balanco_caixa')}
              className={`border shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between rounded-xl overflow-hidden group cursor-pointer active:scale-[0.99] ${summary.netProfit >= 0 ? 'border-primary/25 bg-primary/[0.02] hover:border-primary/50' : 'border-rose-500/25 bg-rose-500/[0.02] hover:border-rose-500/50'}`}
              title="Clique para ver o histórico mensal de Balanço do Caixa"
            >
              <CardHeader className="p-2.5 pb-1 sm:p-3 sm:pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground w-[85%] truncate">
                  Balanço do Caixa
                </CardTitle>
                <div className={`p-1 border rounded-lg shrink-0 group-hover:scale-105 transition-transform ${summary.netProfit >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                  <Wallet className={`w-3 h-3 ${summary.netProfit >= 0 ? 'text-primary' : 'text-rose-500'}`} />
                </div>
              </CardHeader>
              <CardContent className="p-2.5 pt-0 sm:p-3 sm:pt-0 flex-1 flex flex-col justify-between space-y-1.5">
                <div>
                  <div className={`text-base sm:text-lg font-black tracking-tight font-mono leading-tight ${summary.netProfit >= 0 ? 'text-primary' : 'text-rose-500'}`}>
                    {formatCurrency(summary.netProfit)}
                  </div>
                  {renderTrend(summary.profitTrend)}
                </div>

                <div className="pt-1.5 border-t border-border/40 space-y-1">
                  <div className="w-full h-1 bg-muted/80 rounded-full overflow-hidden flex">
                    {segmentsWithPct.map((s, i) => (
                      <div key={i} className={`${s.color} h-full transition-all duration-300`} style={{ width: `${s.pct}%` }} />
                    ))}
                  </div>

                  <div className="grid gap-0.5 text-center leading-tight" style={{ gridTemplateColumns: `repeat(${segmentsWithPct.length || 1}, minmax(0, 1fr))` }}>
                    {segmentsWithPct.map((s, i) => (
                      <div key={i} className={i > 0 ? "border-l border-border/40 pl-0.5" : ""}>
                        <span className={`text-[6.5px] sm:text-[7px] uppercase font-black ${s.textColor} block truncate`}>{s.label}</span>
                        <span className={`text-[8px] sm:text-[8.5px] font-mono font-bold ${s.textBoldColor} block truncate`}>{s.format}</span>
                      </div>
                    ))}
                    {segmentsWithPct.length === 0 && (
                      <div className="text-center py-0.5">
                        <span className="text-[7.5px] text-muted-foreground block">Sem movimentações</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* indicator 7: Per Expense (Span 2 columns & Configurable Category Bar) */}
        {(() => {
          const valReserva = summary.perExpReserve || 0;
          const valCaixa = Math.max(0, summary.perExpense - valReserva);
          const totalExcludingAtivos = valCaixa + valReserva;

          const currentPerExcludingAtivos = summary.perExpense;
          const pastPerExcludingAtivos = past.perExp;
          const trendExcludingAtivos = getTrend(currentPerExcludingAtivos, pastPerExcludingAtivos);

          // Determine which categories to display
          const categoriesWithExpense = Object.keys(currentPeriodPersonalCategoryAmounts).filter(
            c => (currentPeriodPersonalCategoryAmounts[c] || 0) > 0
          );

          const categoriesToConsider = personalBarCategories.length > 0
            ? personalBarCategories
            : (categoriesWithExpense.length > 0
                ? categoriesWithExpense
                : availablePersonalCategories.slice(0, 5));

          let segments: Array<{
            label: string;
            val: number;
            pct: number;
            color: string;
            textColor: string;
            textBoldColor: string;
            dotColor: string;
            format: string;
          }> = [];

          let sumSelected = 0;
          categoriesToConsider.forEach((cat, idx) => {
            const amt = currentPeriodPersonalCategoryAmounts[cat] || 0;
            if (amt > 0 || (personalBarCategories.length > 0 && personalBarCategories.includes(cat))) {
              sumSelected += amt;
              const colorInfo = getCategoryBarColor(cat, idx);
              segments.push({
                label: cat,
                val: amt,
                pct: totalExcludingAtivos > 0 ? (amt / totalExcludingAtivos) * 100 : 0,
                color: colorInfo.color,
                textColor: colorInfo.textColor,
                textBoldColor: colorInfo.textBoldColor,
                dotColor: colorInfo.dotColor,
                format: formatCurrency(amt)
              });
            }
          });

          // Group unselected personal expenses in "Outros / Demais" if enabled and there are leftovers
          if (groupUnselectedCategories && totalExcludingAtivos > sumSelected) {
            const remainingAmt = Math.max(0, totalExcludingAtivos - sumSelected);
            if (remainingAmt > 0) {
              const otherColor = getCategoryBarColor('Outros', segments.length);
              segments.push({
                label: 'Outros',
                val: remainingAmt,
                pct: totalExcludingAtivos > 0 ? (remainingAmt / totalExcludingAtivos) * 100 : 0,
                color: otherColor.color,
                textColor: otherColor.textColor,
                textBoldColor: otherColor.textBoldColor,
                dotColor: otherColor.dotColor,
                format: formatCurrency(remainingAmt)
              });
            }
          }

          // Sort segments descending by value, keeping Outros at end
          segments.sort((a, b) => {
            const isAOther = a.label.includes('Outros') || a.label.includes('Demais');
            const isBOther = b.label.includes('Outros') || b.label.includes('Demais');
            if (isAOther && !isBOther) return 1;
            if (!isAOther && isBOther) return -1;
            return b.val - a.val;
          });

          return (
            <Card
              onClick={() => setSelectedIndicator('gasto_pessoal')}
              className="col-span-2 border border-border/70 hover:border-rose-500/50 shadow-2xs hover:shadow-md transition-all duration-200 bg-card/95 flex flex-col justify-between rounded-xl overflow-hidden group cursor-pointer active:scale-[0.99]"
              title="Clique para ver o histórico mensal de Gasto Pessoal"
            >
              <CardHeader className="p-2.5 pb-1 sm:p-3 sm:pb-1 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CardTitle className="text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-rose-500 truncate">
                    Gasto Pessoal
                  </CardTitle>
                  <span className="text-[7px] sm:text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                    {segments.length} {segments.length === 1 ? 'categoria' : 'categorias'}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPersonalBarConfig(true);
                    }}
                    className="p-1 rounded-md border border-border/60 hover:border-rose-500/40 bg-muted/40 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                    title="Configurar categorias da barra de gastos pessoais"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-muted-foreground hover:text-rose-500" />
                  </button>
                  <div className="p-1 bg-rose-500/10 border border-rose-500/20 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                    <Home className="w-3 h-3 text-rose-500" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-2.5 pt-0 sm:p-3 sm:pt-0 flex-1 flex flex-col justify-between space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div className="flex items-baseline gap-2">
                    <div className="text-base sm:text-lg font-black text-rose-500 tracking-tight font-mono leading-tight">
                      {hideValues ? '•••••' : formatCurrency(totalExcludingAtivos)}
                    </div>
                    {renderTrend(trendExcludingAtivos, true)}
                  </div>
                  <div className="text-[8px] sm:text-[8.5px] text-muted-foreground font-semibold flex items-center gap-1.5">
                    <span>Caixa: <strong className="text-foreground font-mono">{hideValues ? '•••' : formatCurrency(valCaixa)}</strong></span>
                    <span>•</span>
                    <span>Resgate: <strong className="text-foreground font-mono">{hideValues ? '•••' : formatCurrency(valReserva)}</strong></span>
                  </div>
                </div>
                
                <div className="pt-1.5 border-t border-border/40 space-y-1.5">
                  <div className="w-full h-1.5 bg-muted/80 rounded-full overflow-hidden flex shadow-inner">
                    {segments.length > 0 ? (
                      segments.map((s, i) => (
                        <div
                          key={i}
                          className={`${s.color} h-full transition-all duration-300 hover:brightness-110`}
                          style={{ width: `${s.pct}%` }}
                          title={`${s.label}: ${s.format} (${s.pct.toFixed(1)}%)`}
                        />
                      ))
                    ) : (
                      <div className="w-full h-full bg-muted/60" />
                    )}
                  </div>

                  {segments.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 pt-0.5">
                      {segments.map((s, i) => (
                        <div
                          key={i}
                          className="flex flex-col min-w-0 p-1 rounded-md bg-muted/20 hover:bg-muted/40 transition-colors"
                          title={`${s.label}: ${s.format} (${s.pct.toFixed(1)}%)`}
                        >
                          <div className="flex items-center justify-between gap-1 min-w-0">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full ${s.dotColor} shrink-0`} />
                              <span className={`text-[6.5px] sm:text-[7px] uppercase font-black ${s.textColor} truncate`}>
                                {s.label}
                              </span>
                            </div>
                            <span className="text-[6.5px] sm:text-[7px] font-mono text-muted-foreground font-bold shrink-0">
                              {Math.round(s.pct)}%
                            </span>
                          </div>
                          <span className={`text-[8px] sm:text-[8.5px] font-mono font-bold ${s.textBoldColor} truncate mt-0.5`}>
                            {hideValues ? '•••••' : s.format}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[7.5px] sm:text-[8px] text-muted-foreground italic text-center py-1">
                      Nenhum gasto pessoal registrado no período.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* indicator 6: Reservas (Usadas) */}
        <Card 
          onClick={() => navigate('/reserves?tab=history', { state: { tab: 'history' } })}
          className="border border-border/70 hover:border-pink-500/40 shadow-2xs hover:shadow-sm transition-all duration-200 bg-card/95 flex flex-col justify-between rounded-xl overflow-hidden group cursor-pointer active:scale-[0.99]"
          title="Ver Extrato e Movimentações das Reservas"
        >
          <CardHeader className="p-2.5 pb-1 sm:p-3 sm:pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-pink-500 w-[85%] truncate">
              Reservas (Despesas)
            </CardTitle>
            <div className="p-1 bg-pink-500/10 border border-pink-500/20 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
               <PiggyBank className="w-3 h-3 text-pink-500" />
            </div>
          </CardHeader>
          <CardContent className="p-2.5 pt-0 sm:p-3 sm:pt-0 space-y-1.5">
            <div>
              <div className="text-base sm:text-lg font-black text-pink-600 dark:text-pink-500 tracking-tight font-mono leading-tight">
                {formatCurrency(totalUtilizadosInReservesPeriod)}
              </div>
              {renderTrend(getTrend(totalUtilizadosInReservesPeriod, pastTotalUtilizadosInReservesPeriod), true)}
            </div>
            <div className="pt-1.5 border-t border-border/40 grid grid-cols-2 gap-1 text-[8.5px] font-bold text-muted-foreground leading-none">
              <div className="truncate">
                <span className="text-[6.5px] sm:text-[7px] uppercase font-black text-emerald-500 block">Saldo</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[8px] sm:text-[8.5px]">{formatCurrency(Math.abs(totalInReserves))}</span>
              </div>
              <div className="truncate text-right border-l border-border/40 pl-1">
                <span className="text-[6.5px] sm:text-[7px] uppercase font-black text-indigo-500 block">Movimentado</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold text-[8px] sm:text-[8.5px]">{formatCurrency(reserveMovimentacaoPeriod)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* indicator 6.5: Investimentos (Aportes & Ativos) */}
        <Card 
          onClick={() => navigate('/investments?tab=historico', { state: { tab: 'historico' } })}
          className="border border-border/70 hover:border-indigo-500/40 shadow-2xs hover:shadow-sm transition-all duration-200 bg-card/95 flex flex-col justify-between rounded-xl overflow-hidden group cursor-pointer active:scale-[0.99]"
          title="Ver Lançamentos de Investimentos"
        >
          <CardHeader className="p-2.5 pb-1 sm:p-3 sm:pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-indigo-500 w-[85%] truncate flex items-center gap-1">
              Investimentos
            </CardTitle>
            <div className="p-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-3 h-3 text-indigo-500" />
            </div>
          </CardHeader>
          <CardContent className="p-2.5 pt-0 sm:p-3 sm:pt-0 space-y-1.5">
            <div>
              <div className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 tracking-tight font-mono leading-tight">
                {formatCurrency(totalInvestedInPeriodCurrent)}
              </div>
              <div className="flex items-center justify-between gap-1">
                {renderTrend(getTrend(totalInvestedInPeriodCurrent, pastPeriodInvBuysTotal), true)}
                <span className="text-[7.5px] text-muted-foreground font-semibold truncate">Aportado no período</span>
              </div>
            </div>
            <div className="pt-1.5 border-t border-border/40 grid grid-cols-3 gap-1 text-[8.5px] font-bold text-muted-foreground leading-none">
              <div className="truncate">
                <span className="text-[6.5px] sm:text-[7px] uppercase font-black text-indigo-500 block">Total Carteira</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold text-[8px] sm:text-[8.5px]">{formatCurrency(totalInvestmentEquity)}</span>
              </div>
              <div className="truncate text-center border-l border-border/40 pl-0.5">
                <span className="text-[6.5px] sm:text-[7px] uppercase font-black text-emerald-500 block">Proventos</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[8px] sm:text-[8.5px]">{formatCurrency(currentPeriodDivSum)}</span>
              </div>
              <div className="truncate text-right border-l border-border/40 pl-0.5">
                <span className="text-[6.5px] sm:text-[7px] uppercase font-black text-rose-500 block">Vendas</span>
                <span className="font-mono text-rose-600 dark:text-rose-400 font-bold text-[8px] sm:text-[8.5px]">{formatCurrency(currentPeriodInvSells)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* indicator 8: KM */}
        <Card
          onClick={() => setSelectedIndicator('km_rodado')}
          className="border border-border/70 hover:border-cyan-500/50 shadow-2xs hover:shadow-md transition-all duration-200 bg-card/95 flex flex-col justify-between rounded-xl overflow-hidden group cursor-pointer active:scale-[0.99]"
          title="Clique para ver o histórico mensal de KM Rodado"
        >
          <CardHeader className="p-2.5 pb-1 sm:p-3 sm:pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-cyan-500 w-[85%] truncate">
              KM Rodado
            </CardTitle>
            <div className="p-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
              <MapPin className="w-3 h-3 text-cyan-500" />
            </div>
          </CardHeader>
          <CardContent className="p-2.5 pt-0 sm:p-3 sm:pt-0 space-y-1.5">
            <div>
              <div className="text-base sm:text-lg font-black text-cyan-600 dark:text-cyan-400 tracking-tight font-mono leading-tight">
                {hideValues ? '•••••' : `${summary.km} km`}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1">
                {renderTrend(summary.kmTrend)}
              </div>
            </div>
            <div className="pt-1.5 border-t border-border/40 flex items-center justify-between gap-1 text-[8.5px] font-bold text-muted-foreground leading-none">
              <div className="truncate">
                <span className="text-[6.5px] sm:text-[7px] uppercase font-black text-indigo-500 block">Op/km</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold text-[8px] sm:text-[8.5px]">
                  {hideValues ? 'R$ •••••' : formatCurrency(summary.km > 0 ? summary.opExpensePuro / summary.km : 0)}
                </span>
              </div>
              <div className="truncate border-l border-border/40 pl-1">
                <span className="text-[6.5px] sm:text-[7px] uppercase font-black text-emerald-500 block">Fat/km</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[8px] sm:text-[8.5px]">
                  {hideValues ? 'R$ •••••' : formatCurrency(summary.km > 0 ? summary.totalIncome / summary.km : 0)}
                </span>
              </div>
              <div className="truncate text-right border-l border-border/40 pl-1">
                <span className="text-[6.5px] sm:text-[7px] uppercase font-black text-cyan-500 block">Lucro/km</span>
                <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold text-[8px] sm:text-[8.5px]">
                  {hideValues ? 'R$ •••••' : formatCurrency(summary.km > 0 ? (summary.totalIncome - summary.opExpensePuro) / summary.km : 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* indicator 9: Combustível (Lançamentos Reais vs Estimado) */}
        {(() => {
          const diffFuel = actualFuelCost - estimatedFuelCost;
          const pastActualFuel = pastPeriodTx
            .filter(t => t.type === 'expense' && (t.category === 'Combustível' || t.category === 'Combustivel'))
            .reduce((acc, t) => acc + Number(t.amount), 0);
          const fuelTrend = getTrend(actualFuelCost, pastActualFuel);
          
          // Consumo real calculado em km/L: km rodado ÷ (gasto real ÷ preço/L da config)
          const fuelPrice = settings?.fuel_price && settings.fuel_price > 0 ? settings.fuel_price : 0;
          const calculatedKmL = (actualFuelCost > 0 && fuelPrice > 0 && summary.km > 0)
            ? (summary.km / (actualFuelCost / fuelPrice))
            : null;

          return (
            <Card
              onClick={() => setSelectedIndicator('combustivel')}
              className="border border-border/70 hover:border-amber-500/50 shadow-2xs hover:shadow-md transition-all duration-200 bg-card/95 flex flex-col justify-between rounded-xl overflow-hidden group cursor-pointer active:scale-[0.99]"
              title="Clique para ver o histórico mensal de Combustível"
            >
              <CardHeader className="p-2.5 pb-1 sm:p-3 sm:pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-amber-500 w-[85%] truncate">
                  Combustível
                </CardTitle>
                <div className="p-1 bg-amber-500/10 border border-amber-500/20 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                  <Fuel className="w-3 h-3 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent className="p-2.5 pt-0 sm:p-3 sm:pt-0 space-y-1.5">
                <div>
                  <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-500 tracking-tight font-mono leading-tight">
                    {hideValues ? '•••••' : formatCurrency(actualFuelCost)}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    {renderTrend(fuelTrend, true)}
                  </div>
                </div>
                <div className="pt-1.5 border-t border-border/40 flex items-center justify-between gap-1 text-[8.5px] font-bold text-muted-foreground leading-none">
                  <div className="truncate">
                    <span className="text-[6.5px] sm:text-[7px] uppercase font-black text-amber-500 block">Estimado</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 font-bold text-[8px] sm:text-[8.5px]">
                      {hideValues ? 'R$ •••••' : formatCurrency(estimatedFuelCost)}
                    </span>
                  </div>
                  <div className="truncate border-l border-border/40 pl-1">
                    <span className="text-[6.5px] sm:text-[7px] uppercase font-black text-muted-foreground block">Diferença</span>
                    <span className={`font-mono font-bold text-[8px] sm:text-[8.5px] ${diffFuel > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {hideValues ? 'R$ •••••' : `${diffFuel > 0 ? '+' : ''}${formatCurrency(diffFuel)}`}
                    </span>
                  </div>
                  <div className="truncate text-right border-l border-border/40 pl-1">
                    <span className="text-[6.5px] sm:text-[7px] uppercase font-black text-cyan-500 block">Consumo</span>
                    <span className="font-mono text-foreground font-bold text-[8px] sm:text-[8.5px]">
                      {hideValues ? '••••' : (calculatedKmL !== null ? `${calculatedKmL.toFixed(1)} km/L` : '-')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* Daily/Weekly Trend (Evolução Diária) */}
      <Card className="border border-border/80 shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500 shrink-0" />
              <CardTitle className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                Evolução {chartDataResult.scaleLabel === 'Semanal' ? 'Semanal' : 'Diária'}
              </CardTitle>
            </div>
            <button
              type="button"
              onClick={cyclePeriod}
              title="Clique para alternar período (30 dias ➔ 90 dias ➔ Este Ano)"
              className="group inline-flex items-center gap-1.5 px-3 py-1 bg-violet-400/10 hover:bg-violet-400/20 border border-violet-400/30 hover:border-violet-400/60 text-violet-400 text-[10px] sm:text-xs font-black rounded-full transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 select-none"
            >
              <span>{getPeriodLabel()} • {chartDataResult.scaleLabel}</span>
              <RotateCw className="w-2.5 h-2.5 opacity-70 group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>
          <CardDescription className="text-xs">Métricas de Faturamento, Despesas e Lucro Líquido. Clique no nome da linha na legenda para ativar ou desativar.</CardDescription>
        </CardHeader>
        <CardContent className="h-[360px] w-full pt-4">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={dailyTrendData} margin={{ top: 15, right: 15, left: -15, bottom: 15 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} tickFormatter={(val) => `R$ ${Math.round(val).toLocaleString('pt-BR')}`} />
              <RechartsTooltip
                cursor={{ stroke: '#27272a', strokeWidth: 1 }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const hasAtual = visibleLines.Faturamento || visibleLines.DespesasTotais || visibleLines.DespesasOperacionais || visibleLines.DespesasPessoais || visibleLines.LucroPatrimonio || visibleLines.LucroLiquido;
                    
                    const hasAnterior = (visibleLines.Faturamento && visibleLines.FaturamentoAnt) || 
                                        (visibleLines.DespesasTotais && visibleLines.DespesasTotaisAnt) || 
                                        (visibleLines.DespesasOperacionais && visibleLines.DespesasOperacionaisAnt) || 
                                        (visibleLines.DespesasPessoais && visibleLines.DespesasPessoaisAnt) || 
                                        (visibleLines.LucroPatrimonio && visibleLines.LucroPatrimonioAnt) || 
                                        (visibleLines.LucroLiquido && visibleLines.LucroLiquidoAnt);

                    return (
                      <div className="bg-zinc-950 border border-zinc-800/80 p-3.5 rounded-2xl shadow-xl space-y-2.5 min-w-[240px]">
                        <p className="text-[11px] font-black text-zinc-100 tracking-wide uppercase">
                          {chartDataResult.scaleLabel === 'Semanal' ? `Semana: ${label}` : `Dia: ${label}`}
                        </p>
                        
                        {hasAtual && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wide">Período Atual</p>
                            <div className="pl-2 border-l border-zinc-800 space-y-1">
                              {visibleLines.Faturamento && (
                                <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                  <span className="text-zinc-400">Faturamento:</span>
                                  <span className="font-mono text-emerald-400 font-bold">
                                    {hideValues ? 'R$ •••••' : formatCurrency(data.Faturamento)}
                                  </span>
                                </p>
                              )}
                              {visibleLines.DespesasTotais && (
                                <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                  <span className="text-zinc-400">Despesas Totais:</span>
                                  <span className="font-mono text-rose-400 font-bold">
                                    {hideValues ? 'R$ •••••' : formatCurrency(data.DespesasTotais)}
                                  </span>
                                </p>
                              )}
                              {visibleLines.DespesasOperacionais && (
                                <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                  <span className="text-zinc-400">Despesas Op.:</span>
                                  <span className="font-mono text-amber-400 font-bold">
                                    {hideValues ? 'R$ •••••' : formatCurrency(data.DespesasOperacionais)}
                                  </span>
                                </p>
                              )}
                              {visibleLines.DespesasPessoais && (
                                <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                  <span className="text-zinc-400">Despesas Pess.:</span>
                                  <span className="font-mono text-purple-400 font-bold">
                                    {hideValues ? 'R$ •••••' : formatCurrency(data.DespesasPessoais)}
                                  </span>
                                </p>
                              )}
                              {visibleLines.LucroPatrimonio && (
                                <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                  <span className="text-zinc-400">Lucro Líquido:</span>
                                  <span className="font-mono text-cyan-400 font-bold">
                                    {hideValues ? 'R$ •••••' : formatCurrency(data.LucroPatrimonio)}
                                  </span>
                                </p>
                              )}
                              {visibleLines.LucroLiquido && (
                                <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                  <span className="text-zinc-400">Lucro do Caixa:</span>
                                  <span className="font-mono text-blue-400 font-bold">
                                    {hideValues ? 'R$ •••••' : formatCurrency(data.LucroLiquido)}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {hasAnterior && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide">Período Anterior</p>
                            <div className="pl-2 border-l border-zinc-900 space-y-1">
                              {visibleLines.Faturamento && visibleLines.FaturamentoAnt && (
                                <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                  <span className="text-zinc-500">Faturamento:</span>
                                  <span className="font-mono text-emerald-500/60 font-bold">
                                    {hideValues ? 'R$ •••••' : formatCurrency(data.FaturamentoAnt)}
                                  </span>
                                </p>
                              )}
                              {visibleLines.DespesasTotais && visibleLines.DespesasTotaisAnt && (
                                <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                  <span className="text-zinc-500">Despesas Totais:</span>
                                  <span className="font-mono text-rose-500/60 font-bold">
                                    {hideValues ? 'R$ •••••' : formatCurrency(data.DespesasTotaisAnt)}
                                  </span>
                                </p>
                              )}
                              {visibleLines.DespesasOperacionais && visibleLines.DespesasOperacionaisAnt && (
                                <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                  <span className="text-zinc-500">Despesas Op.:</span>
                                  <span className="font-mono text-amber-500/60 font-bold">
                                    {hideValues ? 'R$ •••••' : formatCurrency(data.DespesasOperacionaisAnt)}
                                  </span>
                                </p>
                              )}
                              {visibleLines.DespesasPessoais && visibleLines.DespesasPessoaisAnt && (
                                <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                  <span className="text-zinc-500">Despesas Pess.:</span>
                                  <span className="font-mono text-purple-500/60 font-bold">
                                    {hideValues ? 'R$ •••••' : formatCurrency(data.DespesasPessoaisAnt)}
                                  </span>
                                </p>
                              )}
                              {visibleLines.LucroPatrimonio && visibleLines.LucroPatrimonioAnt && (
                                <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                  <span className="text-zinc-500">Lucro Líquido:</span>
                                  <span className="font-mono text-cyan-500/60 font-bold">
                                    {hideValues ? 'R$ •••••' : formatCurrency(data.LucroPatrimonioAnt)}
                                  </span>
                                </p>
                              )}
                              {visibleLines.LucroLiquido && visibleLines.LucroLiquidoAnt && (
                                <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                  <span className="text-zinc-500">Lucro do Caixa:</span>
                                  <span className="font-mono text-blue-500/60 font-bold">
                                    {hideValues ? 'R$ •••••' : formatCurrency(data.LucroLiquidoAnt)}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend 
                iconType="circle" 
                onClick={handleLegendClick}
                formatter={formatLegendText}
                align="center"
                verticalAlign="bottom"
                height={36}
                wrapperStyle={{ 
                  fontSize: 11, 
                  fontWeight: '600', 
                  paddingTop: 8, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }} 
              />
              <Line type="monotone" name="Faturamento" dataKey="Faturamento" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} hide={!visibleLines.Faturamento} />
              <Line type="monotone" name="Faturamento (Ant)" dataKey="FaturamentoAnt" legendType="none" stroke="#10b981" strokeWidth={2} opacity={0.3} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} hide={!visibleLines.Faturamento || !visibleLines.FaturamentoAnt} />
              <Line type="monotone" name="Despesas Totais" dataKey="DespesasTotais" stroke="#ef4444" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} hide={!visibleLines.DespesasTotais} />
              <Line type="monotone" name="Despesas Totais (Ant)" dataKey="DespesasTotaisAnt" legendType="none" stroke="#ef4444" strokeWidth={2} opacity={0.3} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} hide={!visibleLines.DespesasTotais || !visibleLines.DespesasTotaisAnt} />
              <Line type="monotone" name="Despesas Operacionais" dataKey="DespesasOperacionais" stroke="#f59e0b" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} hide={!visibleLines.DespesasOperacionais} />
              <Line type="monotone" name="Despesas Op. (Ant)" dataKey="DespesasOperacionaisAnt" legendType="none" stroke="#f59e0b" strokeWidth={2} opacity={0.3} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} hide={!visibleLines.DespesasOperacionais || !visibleLines.DespesasOperacionaisAnt} />
              <Line type="monotone" name="Despesas Pessoais" dataKey="DespesasPessoais" stroke="#a855f7" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} hide={!visibleLines.DespesasPessoais} />
              <Line type="monotone" name="Despesas Pess. (Ant)" dataKey="DespesasPessoaisAnt" legendType="none" stroke="#a855f7" strokeWidth={2} opacity={0.3} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} hide={!visibleLines.DespesasPessoais || !visibleLines.DespesasPessoaisAnt} />
              <Line type="monotone" name="Lucro Líquido" dataKey="LucroPatrimonio" stroke="#06b6d4" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} hide={!visibleLines.LucroPatrimonio} />
              <Line type="monotone" name="Lucro Líquido (Ant)" dataKey="LucroPatrimonioAnt" legendType="none" stroke="#06b6d4" strokeWidth={2} opacity={0.3} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} hide={!visibleLines.LucroPatrimonio || !visibleLines.LucroPatrimonioAnt} />
              <Line type="monotone" name="Lucro do Caixa" dataKey="LucroLiquido" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} hide={!visibleLines.LucroLiquido} />
              <Line type="monotone" name="Lucro do Caixa (Ant)" dataKey="LucroLiquidoAnt" legendType="none" stroke="#3b82f6" strokeWidth={2} opacity={0.3} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} hide={!visibleLines.LucroLiquido || !visibleLines.LucroLiquidoAnt} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Card de Análise de Margens e Eficiência */}
      <Card className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
        <CardHeader className="p-4 pb-2 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <Percent className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider">
                  Análise de Margens & Eficiência
                </CardTitle>
                <CardDescription className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 font-semibold">
                  Métricas de desempenho operacional, pessoal e lucratividade sobre o faturamento do período.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-xl shrink-0 border-border/40 hover:bg-muted"
              onClick={() => {
                setTempOutstanding(String(marginThresholds.outstanding).replace('.', ','));
                setTempExcellent(String(marginThresholds.excellent).replace('.', ','));
                setTempHealthy(String(marginThresholds.healthy).replace('.', ','));
                setTempModerate(String(marginThresholds.moderate).replace('.', ','));
                setTempAttention(String(marginThresholds.attention).replace('.', ','));
                setTempIdealOp(String(marginThresholds.idealOp).replace('.', ','));
                setTempIdealPer(String(marginThresholds.idealPer).replace('.', ','));
                setShowMarginConfig(true);
              }}
              title="Configurar Metas de Margem"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="space-y-4">
            {/* Histórico/Evolução das Margens (Lifestyle Creep Detector) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                    Histórico & Evolução das Margens
                  </h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Monitore o comportamento das suas margens ao longo do tempo. Quedas graduais ou persistentes na Margem Pessoal com faturamento estável ou crescente sinalizam <strong>Inflação do Estilo de Vida (Lifestyle Creep)</strong>.
                  </p>
                </div>
                
                {/* Legendas customizadas e compactas */}
                <div className="flex items-center gap-3.5 flex-wrap text-[10px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    <span className="text-muted-foreground">M. Operacional</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="text-muted-foreground">M. Pessoal</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    <span className="text-emerald-400 font-black">M. Líquida (Destaque)</span>
                  </div>
                </div>
              </div>

              {marginsTrendData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center border border-dashed border-border/40 rounded-2xl text-xs text-muted-foreground italic font-semibold bg-muted/5">
                  Dados insuficientes para renderizar o gráfico histórico neste período.
                </div>
              ) : (
                <div className="h-[220px] w-full pt-2">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={marginsTrendData} margin={{ top: 15, right: 15, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#71717a', fontWeight: 'bold' }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#71717a', fontWeight: 'bold' }} 
                        tickFormatter={(val) => `${val}%`} 
                        domain={['auto', 'auto']}
                      />
                      <RechartsTooltip
                        cursor={{ stroke: '#27272a', strokeWidth: 1 }}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-zinc-950 border border-zinc-800/80 p-3.5 rounded-2xl shadow-xl space-y-2 min-w-[210px]">
                                <p className="text-[11px] font-black text-zinc-100 tracking-wide uppercase">{label}</p>
                                <div className="space-y-1.5">
                                  <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                    <span className="text-zinc-400">Faturamento:</span>
                                    <span className="font-mono text-zinc-100">
                                      {hideValues ? 'R$ •••••' : formatCurrency(data.income)}
                                    </span>
                                  </p>
                                  <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                    <span className="text-zinc-400">Gasto Pessoal:</span>
                                    <span className="font-mono text-zinc-100">
                                      {hideValues ? 'R$ •••••' : formatCurrency(data.personalExp)}
                                    </span>
                                  </p>
                                  <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                    <span className="text-zinc-400">Gasto Operacional:</span>
                                    <span className="font-mono text-zinc-100">
                                      {hideValues ? 'R$ •••••' : formatCurrency(data.opExpPuro)}
                                    </span>
                                  </p>
                                  <div className="border-t border-zinc-800/80 my-2" />
                                  <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                    <span className="text-sky-400">M. Operacional:</span>
                                    <span className="font-mono text-sky-300 font-extrabold">{data.opMargin.toFixed(1)}%</span>
                                  </p>
                                  <p className="text-[10px] font-bold flex items-center justify-between gap-6">
                                    <span className="text-amber-400">M. Pessoal:</span>
                                    <span className="font-mono text-amber-300 font-extrabold">{data.perMargin.toFixed(1)}%</span>
                                  </p>
                                  <p className="text-[10px] font-black flex items-center justify-between gap-6 bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                                    <span className="text-emerald-400 font-extrabold">★ M. Líquida:</span>
                                    <span className="font-mono text-emerald-300 font-black text-xs">{data.totalMargin.toFixed(1)}%</span>
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="opMargin" 
                        name="opMargin"
                        stroke="#38bdf8" 
                        strokeWidth={2} 
                        dot={{ r: 3, strokeWidth: 1.5, stroke: '#38bdf8', fill: '#09090b' }}
                        activeDot={{ r: 5 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="perMargin" 
                        name="perMargin"
                        stroke="#f59e0b" 
                        strokeWidth={2} 
                        dot={{ r: 3, strokeWidth: 1.5, stroke: '#f59e0b', fill: '#09090b' }}
                        activeDot={{ r: 5 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="totalMargin" 
                        name="totalMargin"
                        stroke="#10b981" 
                        strokeWidth={3.5} 
                        dot={{ r: 4, strokeWidth: 2, stroke: '#10b981', fill: '#10b981' }}
                        activeDot={{ r: 7, stroke: '#ffffff', strokeWidth: 2, fill: '#10b981' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quilometragem Comparison (Evolução de Quilometragem) */}
      <Card className="border border-border/80 shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0" />
              <CardTitle className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                Evolução de Quilometragem
              </CardTitle>
            </div>
            <button
              type="button"
              onClick={cyclePeriod}
              title="Clique para alternar período (30 dias ➔ 90 dias ➔ Este Ano)"
              className="group inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-400/10 hover:bg-cyan-400/20 border border-cyan-400/30 hover:border-cyan-400/60 text-cyan-400 text-[10px] sm:text-xs font-black rounded-full transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 select-none"
            >
              <span>{getPeriodLabel()}</span>
              <RotateCw className="w-2.5 h-2.5 opacity-70 group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>
          <CardDescription className="text-xs">Quilometragem (km) rodada no período atual comparado ao período anterior.</CardDescription>
        </CardHeader>
        <CardContent className="h-[360px] w-full pt-4">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={kmComparisonData} margin={{ top: 15, right: 15, left: -20, bottom: 15 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} tickFormatter={(val) => `${val}km`} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                labelStyle={{ fontWeight: 'bold', fontSize: 12, color: '#f4f4f5' }}
                itemStyle={{ fontSize: 12, fontWeight: 'medium' }}
                formatter={(value: any, name: any) => [`${Number(value).toFixed(1)} km`, name === 'Período Atual' || name === 'Atual' ? 'Período Atual' : 'Período Anterior']}
              />
              <Legend iconSize={8} iconType="circle" verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11, paddingTop: 10, fontWeight: 'bold' }} />
              <Line type="monotone" dataKey="Anterior" name="Período Anterior" stroke="#06b6d4" strokeWidth={2} opacity={0.3} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="Atual" name="Período Atual" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4, stroke: '#06b6d4', strokeWidth: 2, fill: '#18181b' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Card: Índices Fundamentalistas e de Desempenho Operacional */}
      <Card className="border border-border/70 shadow-2xs hover:shadow-xs transition-all duration-200 overflow-hidden relative group bg-card/95 rounded-2xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-all pointer-events-none" />
        <CardHeader className="p-3.5 sm:p-4 pb-2.5 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Bike className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider">
                    Índices Fundamentalistas & Desempenho Operacional
                  </CardTitle>
                  <span className="hidden sm:inline-block px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 uppercase tracking-widest">
                    Métricas de Gestão
                  </span>
                </div>
                <CardDescription className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 font-medium">
                  Indicadores de lucratividade, custos unitários por quilômetro, retorno veicular e ponto de equilíbrio.
                </CardDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFundamentalHelpDialog(true)}
              className="h-7 px-2.5 text-[11px] font-bold gap-1 rounded-lg border-border/60 hover:bg-indigo-500/10 text-indigo-500 border-indigo-500/20 active:scale-95 transition-all shadow-2xs self-start sm:self-auto shrink-0"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Guia Metodológico</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-5 space-y-6">
          {/* Seção 1: Lucratividade e Eficiência Global */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold">
                <Percent className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                Lucratividade e Margens Operacionais
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
              {/* 1. Margem Líquida Consolidada */}
              {(() => {
                const ml = fundamentalIndexes.margemLiquida;
                const isExcellent = ml >= 40;
                const isHealthy = ml >= 25 && ml < 40;
                const isModerate = ml >= 10 && ml < 25;

                const badgeColor = isExcellent 
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                  : isHealthy 
                    ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                    : isModerate
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';

                const badgeLabel = isExcellent ? 'Elevada' : isHealthy ? 'Saudável' : isModerate ? 'Atenção' : 'Apertada';

                return (
                  <div 
                    onClick={() => setSelectedFundamentalIndex('margemLiquida')}
                    className="bg-muted/20 border border-border/50 hover:border-emerald-500/60 rounded-xl p-3 space-y-1.5 transition-all cursor-pointer group/card shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                    title="Clique para ver o gráfico histórico mensal"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Percent className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">Margem Líquida</span>
                      </div>
                      <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full border shrink-0 ${badgeColor}`}>
                        {badgeLabel}
                      </span>
                    </div>

                    <div>
                      <div className="text-lg sm:text-xl font-black text-foreground font-mono tracking-tight flex items-center justify-between">
                        {hideValues ? '•••%' : `${ml.toFixed(1)}%`}
                        <TrendingUp className="w-3 h-3 text-emerald-500 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[9.5px] text-muted-foreground font-medium leading-tight mt-0.5">
                        Lucro retido por receita bruta acumulada.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 2. Margem Operacional / EBITDA */}
              {(() => {
                const mo = fundamentalIndexes.margemOperacional;
                const isHigh = mo >= 60;
                const isOk = mo >= 40 && mo < 60;

                const badgeColor = isHigh 
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                  : isOk 
                    ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';

                return (
                  <div 
                    onClick={() => setSelectedFundamentalIndex('margemOperacional')}
                    className="bg-muted/20 border border-border/50 hover:border-indigo-500/60 rounded-xl p-3 space-y-1.5 transition-all cursor-pointer group/card shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                    title="Clique para ver o histórico mensal"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">Margem Operacional</span>
                      </div>
                      <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full border shrink-0 ${badgeColor}`}>
                        {isHigh ? 'Eficiente' : isOk ? 'Adequada' : 'Baixa'}
                      </span>
                    </div>

                    <div>
                      <div className="text-lg sm:text-xl font-black text-indigo-500 font-mono tracking-tight flex items-center justify-between">
                        {hideValues ? '•••%' : `${mo.toFixed(1)}%`}
                        <TrendingUp className="w-3 h-3 text-indigo-500 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[9.5px] text-muted-foreground font-medium leading-tight mt-0.5">
                        Resultado operacional pré-retiradas.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 3. Margem Pessoal */}
              {(() => {
                const mp = fundamentalIndexes.personalMargin;
                const isControlled = mp >= 70;
                const isModerate = mp >= 50 && mp < 70;

                return (
                  <div 
                    onClick={() => setSelectedFundamentalIndex('personalMargin')}
                    className="bg-muted/20 border border-border/50 hover:border-sky-500/60 rounded-xl p-3 space-y-1.5 transition-all cursor-pointer group/card shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                    title="Clique para ver o histórico mensal"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">Margem Pessoal</span>
                      </div>
                      <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full border shrink-0 ${isControlled ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : isModerate ? 'bg-sky-500/15 text-sky-400 border-sky-500/30' : 'bg-rose-500/15 text-rose-500 border-rose-500/30'}`}>
                        {isControlled ? 'Preservada' : isModerate ? 'Moderada' : 'Apertada'}
                      </span>
                    </div>

                    <div>
                      <div className="text-lg sm:text-xl font-black text-sky-400 font-mono tracking-tight flex items-center justify-between">
                        {hideValues ? '•••%' : `${mp.toFixed(1)}%`}
                        <TrendingUp className="w-3 h-3 text-sky-400 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[9.5px] text-muted-foreground font-medium leading-tight mt-0.5">
                        Proporção da receita bruta que resta após despesas pessoais.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 4. Eficiência Operacional (MOE / Multiplicador) */}
              {(() => {
                const moe = fundamentalIndexes.moe;
                const isStrong = moe >= 3.0;
                const isOk = moe >= 2.0 && moe < 3.0;

                return (
                  <div 
                    onClick={() => setSelectedFundamentalIndex('moe')}
                    className="bg-muted/20 border border-border/50 hover:border-indigo-500/60 rounded-xl p-3 space-y-1.5 transition-all cursor-pointer group/card shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                    title="Clique para ver o histórico mensal"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Zap className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">MOE (Multiplicador)</span>
                      </div>
                      <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full border shrink-0 ${isStrong ? 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30' : isOk ? 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30' : 'bg-amber-500/15 text-amber-500 border-amber-500/30'}`}>
                        {isStrong ? 'Alta Eficiência' : isOk ? 'Adequado' : 'Abaixo'}
                      </span>
                    </div>

                    <div>
                      <div className="text-lg sm:text-xl font-black text-indigo-500 font-mono tracking-tight flex items-center justify-between">
                        {hideValues ? '•••x' : `${moe.toFixed(2)}x`}
                        <TrendingUp className="w-3 h-3 text-indigo-500 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[9.5px] text-muted-foreground font-medium leading-tight mt-0.5">
                        Receita gerada por R$ 1,00 de custo operacional.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Seção 2: Desempenho e Custos por Quilômetro (por KM) */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
                <Fuel className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                Indicadores Unitários por Quilômetro (por KM)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-2.5">
              {/* 1. RPK - Receita por KM */}
              {(() => {
                const rpk = fundamentalIndexes.rpk;
                const isHigh = rpk >= 2.0;
                const isOk = rpk >= 1.2 && rpk < 2.0;

                return (
                  <div 
                    onClick={() => setSelectedFundamentalIndex('rpk')}
                    className="bg-muted/20 border border-border/50 hover:border-cyan-500/60 rounded-xl p-3 space-y-1.5 transition-all cursor-pointer group/card shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                    title="Clique para ver o histórico mensal"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Coins className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">RPK (Receita/KM)</span>
                      </div>
                      <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full border shrink-0 ${isHigh ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : isOk ? 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30' : 'bg-rose-500/15 text-rose-500 border-rose-500/30'}`}>
                        {isHigh ? 'Alto' : isOk ? 'Regular' : 'Baixo'}
                      </span>
                    </div>

                    <div>
                      <div className="text-lg sm:text-xl font-black text-cyan-500 font-mono tracking-tight flex items-center justify-between">
                        {hideValues ? 'R$ •••••' : `${formatCurrency(rpk)}/km`}
                        <TrendingUp className="w-3 h-3 text-cyan-500 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[9.5px] text-muted-foreground font-medium leading-tight mt-0.5">
                        Faturamento bruto por quilômetro rodado.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 2. LPK - Lucro Líquido por KM */}
              {(() => {
                const lpk = fundamentalIndexes.lpk;
                const isPositive = lpk > 0;

                return (
                  <div 
                    onClick={() => setSelectedFundamentalIndex('lpk')}
                    className="bg-muted/20 border border-border/50 hover:border-emerald-500/60 rounded-xl p-3 space-y-1.5 transition-all cursor-pointer group/card shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                    title="Clique para ver o histórico mensal"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Target className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">LPK (Lucro/KM)</span>
                      </div>
                      <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full border shrink-0 ${isPositive ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : 'bg-rose-500/15 text-rose-500 border-rose-500/30'}`}>
                        {isPositive ? 'Superávit' : 'Déficit'}
                      </span>
                    </div>

                    <div>
                      <div className={`text-lg sm:text-xl font-black font-mono tracking-tight flex items-center justify-between ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {hideValues ? 'R$ •••••' : `${formatCurrency(lpk)}/km`}
                        <TrendingUp className="w-3 h-3 text-emerald-500 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[9.5px] text-muted-foreground font-medium leading-tight mt-0.5">
                        Resultado líquido final por quilômetro rodado.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 3. PPK - Custo Pessoal por KM */}
              {(() => {
                const ppk = fundamentalIndexes.personalPerKm;

                return (
                  <div 
                    onClick={() => setSelectedFundamentalIndex('personalPerKm')}
                    className="bg-muted/20 border border-border/50 hover:border-sky-500/60 rounded-xl p-3 space-y-1.5 transition-all cursor-pointer group/card shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                    title="Clique para ver o histórico mensal"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">PPK (Pessoal/KM)</span>
                      </div>
                      <span className="text-[8.5px] font-black px-1.5 py-0.2 rounded-full border border-sky-500/30 bg-sky-500/15 text-sky-400 shrink-0">
                        Unitário
                      </span>
                    </div>

                    <div>
                      <div className="text-lg sm:text-xl font-black text-sky-400 font-mono tracking-tight flex items-center justify-between">
                        {hideValues ? 'R$ •••••' : `${formatCurrency(ppk)}/km`}
                        <TrendingUp className="w-3 h-3 text-sky-400 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[9.5px] text-muted-foreground font-medium leading-tight mt-0.5">
                        Despesa pessoal gerada por quilômetro.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 4. CPK - Custo Operacional por KM */}
              {(() => {
                const cpk = fundamentalIndexes.cpk;
                const isLow = cpk <= 0.30;
                const isMedium = cpk > 0.30 && cpk <= 0.50;

                const badgeColor = isLow 
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                  : isMedium 
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';

                const cpkCombAndOther = fundamentalIndexes.cpkCombustivel + fundamentalIndexes.cpkOutrosOp;

                return (
                  <div 
                    onClick={() => setSelectedFundamentalIndex('cpk')}
                    className="bg-muted/20 border border-border/50 hover:border-amber-500/60 rounded-xl p-3 space-y-1.5 transition-all cursor-pointer group/card shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                    title="Clique para ver o histórico mensal"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Fuel className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">CPK (Custo/KM)</span>
                      </div>
                      <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full border shrink-0 ${badgeColor}`}>
                        {isLow ? 'Otimizado' : isMedium ? 'Médio' : 'Elevado'}
                      </span>
                    </div>

                    <div>
                      <div className="text-lg sm:text-xl font-black text-amber-500 font-mono tracking-tight flex items-center justify-between">
                        {hideValues ? 'R$ •••••' : `${formatCurrency(cpk)}/km`}
                        <TrendingUp className="w-3 h-3 text-amber-500 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[9.5px] text-muted-foreground font-medium leading-tight mt-0.5">
                        {fundamentalIndexes.kmTotal > 0 ? (
                          <>c+o: <span className="font-mono text-foreground">{hideValues ? '••' : formatCurrency(cpkCombAndOther)}</span> | m: <span className="font-mono text-foreground">{hideValues ? '••' : formatCurrency(fundamentalIndexes.cpkManutencao)}</span></>
                        ) : 'Sem registro de KM'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 5. MPK - Custo de Manutenção por KM */}
              {(() => {
                const mpk = fundamentalIndexes.maintenancePerKm;

                return (
                  <div 
                    onClick={() => setSelectedFundamentalIndex('maintenancePerKm')}
                    className="bg-muted/20 border border-border/50 hover:border-amber-400/60 rounded-xl p-3 space-y-1.5 transition-all cursor-pointer group/card shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                    title="Clique para ver o histórico mensal"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">MPK (Manutenção/KM)</span>
                      </div>
                      <span className="text-[8.5px] font-black px-1.5 py-0.2 rounded-full border border-amber-400/30 bg-amber-400/15 text-amber-400 shrink-0">
                        Unitário
                      </span>
                    </div>

                    <div>
                      <div className="text-lg sm:text-xl font-black text-amber-400 font-mono tracking-tight flex items-center justify-between">
                        {hideValues ? 'R$ •••••' : `${formatCurrency(mpk)}/km`}
                        <TrendingUp className="w-3 h-3 text-amber-400 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[9.5px] text-muted-foreground font-medium leading-tight mt-0.5">
                        Custo de manutenção por quilômetro.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Seção 3: Proporções e Comprometimento da Receita (% Receita) */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold">
                <Coins className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                Comprometimento e Taxas (% da Receita Bruta)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
              {/* 1. Comprometimento de Combustível + Outros */}
              {(() => {
                const fr = fundamentalIndexes.fuelRatio;
                const isOptimal = fr <= 20;
                const isModerate = fr > 20 && fr <= 35;

                return (
                  <div 
                    onClick={() => setSelectedFundamentalIndex('fuelRatio')}
                    className="bg-muted/20 border border-border/50 hover:border-amber-500/60 rounded-xl p-3 space-y-1.5 transition-all cursor-pointer group/card shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                    title="Clique para ver o histórico mensal"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Fuel className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">Taxa Comb. + Outros/Pedágio</span>
                      </div>
                      <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full border shrink-0 ${isOptimal ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : isModerate ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' : 'bg-rose-500/15 text-rose-500 border-rose-500/30'}`}>
                        {isOptimal ? 'Sob Controle' : isModerate ? 'Moderado' : 'Aumento'}
                      </span>
                    </div>

                    <div>
                      <div className="text-lg sm:text-xl font-black text-amber-500 font-mono tracking-tight flex items-center justify-between">
                        {hideValues ? '•••%' : `${fr.toFixed(1)}%`}
                        <TrendingUp className="w-3 h-3 text-amber-500 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[9.5px] text-muted-foreground font-medium leading-tight mt-0.5">
                        Combustível + outras despesas operacionais/pedágio (% da receita).
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 2. Taxa de Custos Pessoais */}
              {(() => {
                const pr = fundamentalIndexes.personalRatio;
                const isGood = pr <= 30;
                const isMed = pr > 30 && pr <= 50;

                return (
                  <div 
                    onClick={() => setSelectedFundamentalIndex('personalRatio')}
                    className="bg-muted/20 border border-border/50 hover:border-blue-500/60 rounded-xl p-3 space-y-1.5 transition-all cursor-pointer group/card shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                    title="Clique para ver o histórico mensal"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">Taxa Custos Pessoais</span>
                      </div>
                      <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full border shrink-0 ${isGood ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : isMed ? 'bg-blue-500/15 text-blue-500 border-blue-500/30' : 'bg-rose-500/15 text-rose-500 border-rose-500/30'}`}>
                        {isGood ? 'Controlado' : isMed ? 'Moderado' : 'Elevado'}
                      </span>
                    </div>

                    <div>
                      <div className="text-lg sm:text-xl font-black text-blue-500 font-mono tracking-tight flex items-center justify-between">
                        {hideValues ? '•••%' : `${pr.toFixed(1)}%`}
                        <TrendingUp className="w-3 h-3 text-blue-500 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[9.5px] text-muted-foreground font-medium leading-tight mt-0.5">
                        Proporção da receita para despesas pessoais.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* 3. Taxa de Custos de Manutenção */}
              {(() => {
                const mr = fundamentalIndexes.maintenanceRatio;
                const isLow = mr <= 15;
                const isMid = mr > 15 && mr <= 25;

                return (
                  <div 
                    onClick={() => setSelectedFundamentalIndex('maintenanceRatio')}
                    className="bg-muted/20 border border-border/50 hover:border-yellow-500/60 rounded-xl p-3 space-y-1.5 transition-all cursor-pointer group/card shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                    title="Clique para ver o histórico mensal"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Wrench className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground truncate">Taxa Manutenção</span>
                      </div>
                      <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full border shrink-0 ${isLow ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : isMid ? 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30' : 'bg-rose-500/15 text-rose-500 border-rose-500/30'}`}>
                        {isLow ? 'Baixa' : isMid ? 'Normal' : 'Alta'}
                      </span>
                    </div>

                    <div>
                      <div className="text-lg sm:text-xl font-black text-yellow-500 font-mono tracking-tight flex items-center justify-between">
                        {hideValues ? '•••%' : `${mr.toFixed(1)}%`}
                        <TrendingUp className="w-3 h-3 text-yellow-500 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[9.5px] text-muted-foreground font-medium leading-tight mt-0.5">
                        Proporção da receita destinada à manutenção.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>


        </CardContent>
      </Card>

      {/* Charts Presentation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dynamic scale Bars: Ganhos vs Despesas */}
        <Card className="col-span-1 md:col-span-2 border border-border/80 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <CardTitle className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                  Ganhos vs Despesas
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Seletor de Escalas proporcional ao período (Diária, Semanal, Mensal) */}
                <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border border-border/60 shrink-0">
                  {availableGainsExpensesScales.map((scale) => {
                    const labels = { daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal' };
                    const isSel = activeGainsExpensesScale === scale;
                    return (
                      <button
                        key={scale}
                        type="button"
                        onClick={() => setGainsExpensesScale(scale)}
                        className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
                          isSel ? 'bg-emerald-500 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {labels[scale]}
                      </button>
                    );
                  })}
                </div>

                {/* Badge Período Clicável */}
                <button
                  type="button"
                  onClick={cyclePeriod}
                  title="Clique para alternar período (30 dias ➔ 90 dias ➔ Este Ano)"
                  className="group inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-400/30 hover:border-emerald-400/60 text-emerald-400 text-[10px] sm:text-xs font-black rounded-full transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 select-none"
                >
                  <span>{getPeriodLabel()}</span>
                  <RotateCw className="w-2.5 h-2.5 opacity-70 group-hover:rotate-180 transition-transform duration-500" />
                </button>
              </div>
            </div>
            <CardDescription className="text-xs">
              Visualização do faturamento bruto contra o total de despesas agrupado por {
                activeGainsExpensesScale === 'daily' ? 'dia' : activeGainsExpensesScale === 'weekly' ? 'semana' : 'mês'
              }.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[360px] w-full pt-4">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={weeklyGainsExpensesData} margin={{ top: 15, right: 15, left: -15, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} tickFormatter={(val) => `R$ ${Math.round(val).toLocaleString('pt-BR')}`} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)' }}
                  labelStyle={{ fontWeight: 'bold', fontSize: 12, color: '#f4f4f5' }}
                  itemStyle={{ fontSize: 12, fontWeight: 'medium' }}
                  formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                />
                <Legend iconSize={8} iconType="circle" verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11, paddingTop: 8, fontWeight: 'bold' }} />
                <Bar dataKey="income" name="Ganhos Brutos" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expense" name="Despesas Totais" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Média da Pizzaria / Frete do Dia por Dia da Semana */}
        <Card className="border border-border/80 shadow-xs col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                  pizzariaOrFreteTab === 'pizzaria' ? 'bg-orange-500' : 'bg-cyan-500'
                }`} />
                <CardTitle className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                  {pizzariaOrFreteTab === 'pizzaria' ? 'Lançamentos Pizzaria (Dia da Sem)' : 'Lançamentos Frete (Dia da Sem)'}
                </CardTitle>

                {/* Alternador Pizzaria / Frete */}
                <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border border-border/60 shrink-0 ml-1">
                  <button
                    type="button"
                    onClick={() => setPizzariaOrFreteTab('pizzaria')}
                    className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                      pizzariaOrFreteTab === 'pizzaria'
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Pizza className="w-3 h-3" />
                    Pizzaria
                  </button>
                  <button
                    type="button"
                    onClick={() => setPizzariaOrFreteTab('frete')}
                    className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                      pizzariaOrFreteTab === 'frete'
                        ? 'bg-cyan-500 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Package className="w-3 h-3" />
                    Frete
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className={`px-2.5 py-1 border text-xs font-black rounded-full select-none flex items-center gap-1.5 transition-colors ${
                  pizzariaOrFreteTab === 'pizzaria'
                    ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                    : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                }`}>
                  <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Média Total Semanal:</span>
                  <span>{formatCurrency(pizzariaOrFreteTab === 'pizzaria' ? totalWeeklyPizzaria : totalWeeklyFrete)}</span>
                </div>
                <button
                  type="button"
                  onClick={cyclePeriod}
                  title="Clique para alternar período (30 dias ➔ 90 dias ➔ Este Ano)"
                  className={`group inline-flex items-center gap-1.5 px-3 py-1 border text-[10px] sm:text-xs font-black rounded-full select-none transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 ${
                    pizzariaOrFreteTab === 'pizzaria'
                      ? 'bg-orange-400/10 hover:bg-orange-400/20 border-orange-400/30 hover:border-orange-400/60 text-orange-400'
                      : 'bg-cyan-400/10 hover:bg-cyan-400/20 border-cyan-400/30 hover:border-cyan-400/60 text-cyan-400'
                  }`}
                >
                  <span>{getPeriodLabel()}</span>
                  <RotateCw className="w-2.5 h-2.5 opacity-70 group-hover:rotate-180 transition-transform duration-500" />
                </button>
              </div>
            </div>
            <CardDescription className="text-xs">
              {pizzariaOrFreteTab === 'pizzaria' 
                ? 'Média de ganhos da Pizzaria para cada dia da semana.' 
                : 'Média de ganhos de Frete do Dia para cada dia da semana.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] w-full pt-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weekdayData} margin={{ top: 25, right: 15, left: -15, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="name" interval={0} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} tickFormatter={(val) => `R$ ${Math.round(val).toLocaleString('pt-BR')}`} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)' }}
                  labelStyle={{ fontWeight: 'bold', fontSize: 12, color: '#f4f4f5' }}
                  itemStyle={{ fontSize: 12, fontWeight: 'medium' }}
                  formatter={(value: any) => [
                    formatCurrency(Number(value)), 
                    pizzariaOrFreteTab === 'pizzaria' ? 'Média Pizzaria' : 'Média Frete'
                  ]}
                />
                <Bar 
                  dataKey={pizzariaOrFreteTab === 'pizzaria' ? 'Pizzaria' : 'Frete'} 
                  fill={pizzariaOrFreteTab === 'pizzaria' ? '#f97316' : '#06b6d4'} 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={36}
                >
                  <LabelList 
                    dataKey={pizzariaOrFreteTab === 'pizzaria' ? 'Pizzaria' : 'Frete'} 
                    position="top" 
                    formatter={(val: number) => val > 0 ? `R$ ${Math.round(val).toLocaleString('pt-BR')}` : ''} 
                    style={{ 
                      fill: pizzariaOrFreteTab === 'pizzaria' ? '#f97316' : '#06b6d4', 
                      fontSize: 9, 
                      fontWeight: 'bold' 
                    }} 
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Média de Ganhos por Dia da Semana */}
        <Card className="border border-border/80 shadow-xs col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                <CardTitle className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                  Média de Ganhos (Dia da Sem)
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black rounded-full select-none flex items-center gap-1.5">
                  <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Média Total Semanal:</span>
                  <span>{formatCurrency(totalWeeklyGanhos)}</span>
                </div>
                <button
                  type="button"
                  onClick={cyclePeriod}
                  title="Clique para alternar período (30 dias ➔ 90 dias ➔ Este Ano)"
                  className="group inline-flex items-center gap-1.5 px-3 py-1 bg-blue-400/10 hover:bg-blue-400/20 border border-blue-400/30 hover:border-blue-400/60 text-blue-400 text-[10px] sm:text-xs font-black rounded-full transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 select-none"
                >
                  <span>{getPeriodLabel()}</span>
                  <RotateCw className="w-2.5 h-2.5 opacity-70 group-hover:rotate-180 transition-transform duration-500" />
                </button>
              </div>
            </div>
            <CardDescription className="text-xs">Média de ganhos brutos para cada dia da semana.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] w-full pt-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weekdayData} margin={{ top: 25, right: 15, left: -15, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="name" interval={0} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} tickFormatter={(val) => `R$ ${Math.round(val).toLocaleString('pt-BR')}`} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)' }}
                  labelStyle={{ fontWeight: 'bold', fontSize: 12, color: '#f4f4f5' }}
                  itemStyle={{ fontSize: 12, fontWeight: 'medium' }}
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Média Ganhos']}
                />
                <Bar dataKey="Ganhos" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  <LabelList 
                    dataKey="Ganhos" 
                    position="top" 
                    formatter={(val: number) => val > 0 ? `R$ ${Math.round(val).toLocaleString('pt-BR')}` : ''} 
                    style={{ fill: '#3b82f6', fontSize: 9, fontWeight: 'bold' }} 
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Média de Gastos por Dia da Semana */}
        <Card className="border border-border/80 shadow-xs col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <CardTitle className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                  Média de Gastos (Dia da Sem)
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black rounded-full select-none flex items-center gap-1.5">
                  <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Média Total Semanal:</span>
                  <span>{formatCurrency(totalWeeklyGastos)}</span>
                </div>
                <button
                  type="button"
                  onClick={cyclePeriod}
                  title="Clique para alternar período (30 dias ➔ 90 dias ➔ Este Ano)"
                  className="group inline-flex items-center gap-1.5 px-3 py-1 bg-rose-400/10 hover:bg-rose-400/20 border border-rose-400/30 hover:border-rose-400/60 text-rose-400 text-[10px] sm:text-xs font-black rounded-full transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 select-none"
                >
                  <span>{getPeriodLabel()}</span>
                  <RotateCw className="w-2.5 h-2.5 opacity-70 group-hover:rotate-180 transition-transform duration-500" />
                </button>
              </div>
            </div>
            <CardDescription className="text-xs">Média de despesas totais para cada dia da semana.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] w-full pt-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weekdayData} margin={{ top: 25, right: 15, left: -15, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="name" interval={0} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} tickFormatter={(val) => `R$ ${Math.round(val).toLocaleString('pt-BR')}`} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)' }}
                  labelStyle={{ fontWeight: 'bold', fontSize: 12, color: '#f4f4f5' }}
                  itemStyle={{ fontSize: 12, fontWeight: 'medium' }}
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Média Gastos']}
                />
                <Bar dataKey="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  <LabelList 
                    dataKey="Despesas" 
                    position="top" 
                    formatter={(val: number) => val > 0 ? `R$ ${Math.round(val).toLocaleString('pt-BR')}` : ''} 
                    style={{ fill: '#f43f5e', fontSize: 9, fontWeight: 'bold' }} 
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Income Circle */}
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <CardTitle className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                Distribuição de Ganhos
              </CardTitle>
            </div>
            <CardDescription className="text-xs">Composição das receitas por categoria no período filtrado.</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px] flex flex-col pt-2 pb-4">
            {incomeData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground font-semibold italic text-center">Nenhum ganho registrado</div>
            ) : (
              <div className="flex flex-col h-full justify-between overflow-hidden">
                <div className="h-[200px] shrink-0 relative">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={incomeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {incomeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                        itemStyle={{ fontSize: 12, fontWeight: 'medium' }}
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Total</span>
                    <span className="text-sm font-black text-foreground">{formatCurrency(incomeData.reduce((acc, curr) => acc + curr.value, 0))}</span>
                  </div>
                </div>

                <div className="mt-4 flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                  {[...incomeData]
                    .map((entry, idx) => {
                      const totalInc = incomeData.reduce((acc, curr) => acc + curr.value, 0);
                      const percentage = ((entry.value / totalInc) * 100).toFixed(1);
                      return (
                        <div 
                          key={idx} 
                          onClick={() => {
                            if (entry.name.includes('Investimentos')) {
                              navigate('/investments');
                            } else {
                              navigate(`/history?category=${encodeURIComponent(entry.name)}`);
                            }
                          }}
                          className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/40 transition-all cursor-pointer active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                            <span className="text-xs font-bold text-foreground truncate">{entry.name}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] font-black text-foreground">{formatCurrency(entry.value)}</p>
                            <p className="text-[9px] font-bold text-muted-foreground">{percentage}%</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses Circle */}
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <CardTitle className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                Distribuição de Saídas
              </CardTitle>
            </div>
            <CardDescription className="text-xs">Concentração de despesas por categoria no período filtrado.</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px] flex flex-col pt-2 pb-4">
            {expensesData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground font-semibold italic text-center">Nenhuma despesa registrada</div>
            ) : (
              <div className="flex flex-col h-full justify-between overflow-hidden">
                <div className="h-[200px] shrink-0 relative">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={expensesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {expensesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                        itemStyle={{ fontSize: 12, fontWeight: 'medium' }}
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Total</span>
                    <span className="text-sm font-black text-foreground">{formatCurrency(expensesData.reduce((acc, curr) => acc + curr.value, 0))}</span>
                  </div>
                </div>

                <div className="mt-4 flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                  {[...expensesData]
                    .map((entry, idx) => {
                      const totalExp = expensesData.reduce((acc, curr) => acc + curr.value, 0);
                      const percentage = ((entry.value / totalExp) * 100).toFixed(1);
                      return (
                        <div 
                          key={idx} 
                          onClick={() => {
                            if (entry.name.includes('Investimentos')) {
                              navigate('/investments');
                            } else {
                              navigate(`/history?category=${encodeURIComponent(entry.name)}`);
                            }
                          }}
                          className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/40 transition-all cursor-pointer active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                            <span className="text-xs font-bold text-foreground truncate">{entry.name}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] font-black text-foreground">{formatCurrency(entry.value)}</p>
                            <p className="text-[9px] font-bold text-muted-foreground">{percentage}%</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalhamento de Lucro das Categorias */}
        <Card className="col-span-1 md:col-span-2 border border-border/80 shadow-xs">
          <CardHeader className="border-b border-border/55">
            <CardTitle className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" /> Detalhamento de Repasses por Categoria
            </CardTitle>
            <CardDescription className="text-xs">Veja os pormenores dos seus ganhos e suas despesas detalhadas.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Entradas */}
              <div className="space-y-4">
                <h3 className="font-bold text-xs uppercase text-emerald-500 flex items-center border-b border-emerald-500/10 pb-2">
                  <TrendingUp className="w-4 h-4 mr-1.5 shrink-0" /> Entradas / Faturamento ({formatCurrency((Object.values(incomeByCategory) as number[]).reduce((a, b) => a + b, 0))})
                </h3>
                <div className="space-y-3">
                  {(Object.entries(incomeByCategory) as [string, number][])
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, val]) => {
                      const meta = getCategoryMeta(cat, 'income', settings);
                      const IconComponent = meta.icon;
                      const totalIncomeSum = (Object.values(incomeByCategory) as number[]).reduce((a, b) => a + b, 0);
                      const percentage = totalIncomeSum > 0 ? (val / totalIncomeSum) * 100 : 0;
                      const pastVal = pastIncomeByCategory[cat] || 0;
                      
                      return (
                        <div 
                          key={cat} 
                          onClick={() => {
                            if (cat.includes('Investimentos')) {
                              navigate('/investments');
                            } else {
                              navigate(`/history?category=${encodeURIComponent(cat)}`);
                            }
                          }}
                          className="space-y-1.5 cursor-pointer group"
                        >
                          <div className="flex justify-between items-center bg-muted/10 p-2 border border-border/50 rounded-xl group-hover:border-emerald-500/30 group-hover:bg-muted/30 transition-all active:scale-[0.99]">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className={`p-1.5 rounded-lg border ${meta.color} shrink-0`}>
                                <IconComponent className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold text-foreground truncate group-hover:text-emerald-500 transition-all">{cat}</span>
                                {globalPeriod !== 'all' && renderCategoryTrend(val, pastVal, false)}
                              </div>
                            </div>
                            <div className="text-right shrink-0 flex flex-col items-end">
                              <span className="font-extrabold text-xs text-emerald-500 font-mono">{formatCurrency(val)}</span>
                              <span className="text-[10px] text-muted-foreground font-medium font-mono">
                                {percentage.toFixed(1)}% do fat.
                              </span>
                            </div>
                          </div>
                          {/* Rich horizontal subtle progress indicator */}
                          <div className="w-full bg-muted h-1 rounded-full overflow-hidden px-1">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  {Object.keys(incomeByCategory).length === 0 && (
                     <div className="text-xs text-muted-foreground italic py-6 text-center">Nenhum faturamento registrado no período</div>
                  )}
                </div>
              </div>
              
              {/* Saídas Separadas por Operacional e Pessoal */}
              <div className="space-y-5">
                <h3 className="font-bold text-xs uppercase text-rose-500 flex items-center justify-between border-b border-rose-500/10 pb-2">
                  <span className="flex items-center">
                    <TrendingDown className="w-4 h-4 mr-1.5 shrink-0" /> Saídas / Despesas ({formatCurrency((Object.values(expensesByCategory) as number[]).reduce((a, b) => a + b, 0))})
                  </span>
                </h3>

                {Object.keys(expensesByCategory).length === 0 ? (
                  <div className="text-xs text-muted-foreground italic py-6 text-center">Nenhuma despesa registrada no período</div>
                ) : (
                  (() => {
                    const allExpenseEntries = Object.entries(expensesByCategory) as [string, number][];
                    const opEntries = allExpenseEntries
                      .filter(([cat]) => isPersonalOpCategory(cat))
                      .sort(([, a], [, b]) => b - a);
                    const personalEntries = allExpenseEntries
                      .filter(([cat]) => !isPersonalOpCategory(cat))
                      .sort(([, a], [, b]) => b - a);

                    const totalExpenseSum = allExpenseEntries.reduce((acc, [, v]) => acc + v, 0);
                    const totalOpSum = opEntries.reduce((acc, [, v]) => acc + v, 0);
                    const totalPersonalSum = personalEntries.reduce((acc, [, v]) => acc + v, 0);
                    const totalIncomeSum = (Object.values(incomeByCategory) as number[]).reduce((a, b) => a + b, 0);

                    const opBillingPct = totalIncomeSum > 0 ? (totalOpSum / totalIncomeSum) * 100 : 0;
                    const personalBillingPct = totalIncomeSum > 0 ? (totalPersonalSum / totalIncomeSum) * 100 : 0;
                    const opSharePct = totalExpenseSum > 0 ? (totalOpSum / totalExpenseSum) * 100 : 0;
                    const personalSharePct = totalExpenseSum > 0 ? (totalPersonalSum / totalExpenseSum) * 100 : 0;

                    return (
                      <div className="space-y-6">
                        {/* Sub-bloco: Gastos Operacionais */}
                        <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-3.5">
                          <div className="flex items-center justify-between gap-2 border-b border-amber-500/15 pb-2">
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 rounded-md bg-amber-500/15 text-amber-500">
                                <Wrench className="w-3.5 h-3.5 shrink-0" />
                              </div>
                              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-500">
                                Gastos Operacionais
                              </span>
                              <span className="text-[10px] font-bold text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-md">
                                {opSharePct.toFixed(0)}% das saídas
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-amber-500 font-mono block">
                                {formatCurrency(totalOpSum)}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-mono">
                                {opBillingPct.toFixed(1)}% do fat.
                              </span>
                            </div>
                          </div>

                          {opEntries.length === 0 ? (
                            <div className="text-xs text-muted-foreground italic py-3 text-center">
                              Nenhum gasto operacional no período
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {opEntries.map(([cat, val]) => {
                                const meta = getCategoryMeta(cat, 'expense', settings);
                                const IconComponent = meta.icon;
                                const percentageOfGroup = totalOpSum > 0 ? (val / totalOpSum) * 100 : 0;
                                const pastVal = pastExpensesByCategory[cat] || 0;
                                const percentageOfBilling = totalIncomeSum > 0 ? (val / totalIncomeSum) * 100 : 0;

                                return (
                                  <div
                                    key={cat}
                                    onClick={() => {
                                      if (cat.includes('Investimentos')) {
                                        navigate('/investments');
                                      } else {
                                        navigate(`/history?category=${encodeURIComponent(cat)}`);
                                      }
                                    }}
                                    className="space-y-1.5 cursor-pointer group"
                                  >
                                    <div className="flex justify-between items-center bg-card/70 p-2 border border-border/50 rounded-xl group-hover:border-amber-500/40 group-hover:bg-muted/30 transition-all active:scale-[0.99]">
                                      <div className="flex items-center gap-2 overflow-hidden">
                                        <div className={`p-1.5 rounded-lg border ${meta.color} shrink-0`}>
                                          <IconComponent className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-xs font-bold text-foreground truncate flex items-center gap-1.5 group-hover:text-amber-500 transition-all">
                                            {cat}
                                            <span className="text-[9px] font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 py-0.2 rounded-sm uppercase tracking-wider shrink-0 scale-95">
                                              Op
                                            </span>
                                          </span>
                                          {globalPeriod !== 'all' && renderCategoryTrend(val, pastVal, true)}
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0 flex flex-col items-end">
                                        <span className="font-extrabold text-xs text-amber-500 font-mono">{formatCurrency(val)}</span>
                                        <span className="text-[10px] text-muted-foreground font-medium font-mono">
                                          {percentageOfBilling.toFixed(1)}% do fat.
                                        </span>
                                      </div>
                                    </div>
                                    <div className="w-full bg-muted h-1 rounded-full overflow-hidden px-1">
                                      <div
                                        className="h-full rounded-full transition-all bg-amber-500"
                                        style={{ width: `${percentageOfGroup}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Sub-bloco: Gastos Pessoais */}
                        <div className="space-y-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] p-3.5">
                          <div className="flex items-center justify-between gap-2 border-b border-rose-500/15 pb-2">
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 rounded-md bg-rose-500/15 text-rose-500">
                                <User className="w-3.5 h-3.5 shrink-0" />
                              </div>
                              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-500">
                                Gastos Pessoais
                              </span>
                              <span className="text-[10px] font-bold text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-md">
                                {personalSharePct.toFixed(0)}% das saídas
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-rose-500 font-mono block">
                                {formatCurrency(totalPersonalSum)}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-mono">
                                {personalBillingPct.toFixed(1)}% do fat.
                              </span>
                            </div>
                          </div>

                          {personalEntries.length === 0 ? (
                            <div className="text-xs text-muted-foreground italic py-3 text-center">
                              Nenhum gasto pessoal no período
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {personalEntries.map(([cat, val]) => {
                                const meta = getCategoryMeta(cat, 'expense', settings);
                                const IconComponent = meta.icon;
                                const percentageOfGroup = totalPersonalSum > 0 ? (val / totalPersonalSum) * 100 : 0;
                                const pastVal = pastExpensesByCategory[cat] || 0;
                                const percentageOfBilling = totalIncomeSum > 0 ? (val / totalIncomeSum) * 100 : 0;

                                return (
                                  <div
                                    key={cat}
                                    onClick={() => {
                                      if (cat.includes('Investimentos')) {
                                        navigate('/investments');
                                      } else {
                                        navigate(`/history?category=${encodeURIComponent(cat)}`);
                                      }
                                    }}
                                    className="space-y-1.5 cursor-pointer group"
                                  >
                                    <div className="flex justify-between items-center bg-card/70 p-2 border border-border/50 rounded-xl group-hover:border-rose-500/40 group-hover:bg-muted/30 transition-all active:scale-[0.99]">
                                      <div className="flex items-center gap-2 overflow-hidden">
                                        <div className={`p-1.5 rounded-lg border ${meta.color} shrink-0`}>
                                          <IconComponent className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-xs font-bold text-foreground truncate flex items-center gap-1.5 group-hover:text-rose-500 transition-all">
                                            {cat}
                                            {cat === 'Aporte Reserva' && (
                                              <span className="text-[9px] font-extrabold bg-pink-500/10 text-pink-500 border border-pink-500/20 px-1 py-0.2 rounded-sm uppercase tracking-wider shrink-0 scale-95">
                                                RES
                                              </span>
                                            )}
                                          </span>
                                          {globalPeriod !== 'all' && renderCategoryTrend(val, pastVal, true)}
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0 flex flex-col items-end">
                                        <span className="font-extrabold text-xs text-rose-500 font-mono">{formatCurrency(val)}</span>
                                        <span className="text-[10px] text-muted-foreground font-medium font-mono">
                                          {percentageOfBilling.toFixed(1)}% do fat.
                                        </span>
                                      </div>
                                    </div>
                                    <div className="w-full bg-muted h-1 rounded-full overflow-hidden px-1">
                                      <div
                                        className={`h-full rounded-full transition-all ${cat === 'Aporte Reserva' ? 'bg-pink-500' : 'bg-rose-500'}`}
                                        style={{ width: `${percentageOfGroup}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <ExecutiveReportModal
        open={showMonthlyReport}
        onOpenChange={setShowMonthlyReport}
        allTransactions={allTransactionsAdjusted}
        settings={settings}
        reserves={reserves}
      />

      <IndicatorHistoryModal
        open={selectedIndicator !== null}
        onOpenChange={handleIndicatorModalOpenChange}
        indicator={selectedIndicator}
        onSelectIndicator={setSelectedIndicator}
        historyData={filteredIndicatorHistoryData}
        allHistoryData={allIndicatorHistoryData}
        currentPeriodLabel={getPeriodLabel()}
        isPeriodFiltered={globalPeriod !== 'all'}
        hideValues={hideValues}
      />

      <Dialog open={showWeeklyGoalConfig} onOpenChange={setShowWeeklyGoalConfig}>
        <DialogContent className="max-w-md p-0 bg-card border-border/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 shrink-0">
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-500" />
              Configurar Metas Semanais
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm font-semibold text-muted-foreground mt-1">
              Defina os valores que você deseja alcançar como metas para faturamento e lucro líquido de segunda a domingo.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-5 bg-muted/5">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-foreground uppercase tracking-wider block">
                Meta de Faturamento Bruto (R$)
              </label>
              <input
                type="text"
                className="w-full bg-muted/30 border border-border/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={formatCurrency(Number(String(tempWeeklyGoal || '').replace(/\D/g, '')) / 100, true)}
                onChange={e => setTempWeeklyGoal(e.target.value)}
                placeholder="R$ 0,00"
              />
              <span className="text-[10px] text-muted-foreground block font-bold">
                Meta com base nas receitas brutas geradas na semana.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-foreground uppercase tracking-wider block">
                Meta de Lucro Líquido (R$)
              </label>
              <input
                type="text"
                className="w-full bg-muted/30 border border-border/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={formatCurrency(Number(String(tempWeeklyNetGoal || '').replace(/\D/g, '')) / 100, true)}
                onChange={e => setTempWeeklyNetGoal(e.target.value)}
                placeholder="R$ 0,00"
              />
              <span className="text-[10px] text-muted-foreground block font-bold">
                Meta com base nas receitas menos despesas (incluindo reservas).
              </span>
            </div>

            <div className="pt-4 border-t border-border/40 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                className="rounded-xl px-4 py-2 text-xs font-bold"
                onClick={() => setShowWeeklyGoalConfig(false)}
              >
                Cancelar
              </Button>
              <Button
                className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl px-4 py-2 text-xs font-bold"
                onClick={handleSaveWeeklyGoal}
              >
                Salvar Metas
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMarginConfig} onOpenChange={setShowMarginConfig}>
        <DialogContent className="max-w-md p-0 bg-card border-border/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 shrink-0">
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <Percent className="w-5 h-5 text-indigo-500" />
              Configurar Metas de Margem
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm font-semibold text-muted-foreground mt-1">
              Ajuste as faixas de porcentagem mínima para cada nível de status nas suas margens sobre o faturamento.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-5 bg-muted/5">
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-foreground uppercase tracking-wider block">
                  Mínimo para status "Alta Performance" (%)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full bg-muted/30 border border-border/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={tempOutstanding}
                  onChange={e => setTempOutstanding(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="Ex: 70"
                />
                <span className="text-[10px] text-muted-foreground block font-bold">
                  Margens maiores ou iguais a este valor serão classificadas como Alta Performance.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-foreground uppercase tracking-wider block">
                  Mínimo para status "Sólido" (%)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full bg-muted/30 border border-border/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={tempExcellent}
                  onChange={e => setTempExcellent(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="Ex: 50"
                />
                <span className="text-[10px] text-muted-foreground block font-bold">
                  Margens entre este valor e o limiar de "Alta Performance" serão classificadas como Sólido.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-foreground uppercase tracking-wider block">
                  Mínimo para status "Estável" (%)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full bg-muted/30 border border-border/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={tempHealthy}
                  onChange={e => setTempHealthy(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="Ex: 25"
                />
                <span className="text-[10px] text-muted-foreground block font-bold">
                  Margens entre este valor e o limiar de "Sólido" serão consideradas Estáveis.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-foreground uppercase tracking-wider block">
                  Mínimo para status "Moderado" (%)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full bg-muted/30 border border-border/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={tempModerate}
                  onChange={e => setTempModerate(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="Ex: 10"
                />
                <span className="text-[10px] text-muted-foreground block font-bold">
                  Margens entre este valor e o limiar de "Estável" serão marcadas como Moderado.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-foreground uppercase tracking-wider block">
                  Mínimo para status "Sob Alerta" (%)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full bg-muted/30 border border-border/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={tempAttention}
                  onChange={e => setTempAttention(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="Ex: 0"
                />
                <span className="text-[10px] text-muted-foreground block font-bold">
                  Margens entre este valor e o limiar de "Moderado" serão marcadas como Sob Alerta. Valores abaixo serão classificados como Déficit.
                </span>
              </div>

              {/* Seção de Margens Ideais */}
              <div className="border-t border-border/40 pt-4 mt-2">
                <h4 className="text-xs font-black uppercase tracking-widest text-indigo-500 mb-3">
                  Margens Ideais (Metas)
                </h4>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-foreground uppercase tracking-wider block">
                  Margem Operacional Ideal (%)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full bg-muted/30 border border-border/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={tempIdealOp}
                  onChange={e => setTempIdealOp(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="Ex: 70"
                />
                <span className="text-[10px] text-muted-foreground block font-bold">
                  Defina a meta de porcentagem de faturamento que deve sobrar após os custos operacionais.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-foreground uppercase tracking-wider block">
                  Margem Pessoal Ideal (%)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full bg-muted/30 border border-border/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={tempIdealPer}
                  onChange={e => setTempIdealPer(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="Ex: 40"
                />
                <span className="text-[10px] text-muted-foreground block font-bold">
                  Defina a meta de porcentagem de faturamento que deve sobrar após seus gastos pessoais.
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-border/40 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                className="rounded-xl px-4 py-2 text-xs font-bold"
                onClick={() => setShowMarginConfig(false)}
              >
                Cancelar
              </Button>
              <Button
                className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl px-4 py-2 text-xs font-bold"
                onClick={handleSaveThresholds}
              >
                Salvar Configurações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Configuração de Metas por KM */}
      <Dialog open={showKmConfig} onOpenChange={setShowKmConfig}>
        <DialogContent className="max-w-md p-0 bg-card border-border/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 shrink-0">
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <Gauge className="w-5 h-5 text-amber-500" />
              Configurar Metas por KM (R$/km)
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm font-semibold text-muted-foreground mt-1">
              Ajuste as metas de custo operacional, faturamento e lucro para avaliar sua eficiência por quilômetro rodado.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-5 bg-muted/5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-foreground uppercase tracking-wider block">
                  Meta Máxima de Custo Operacional (R$/km)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full bg-muted/30 border border-border/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={tempTargetOpKm}
                  onChange={e => setTempTargetOpKm(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="Ex: 0,65"
                />
                <span className="text-[10px] text-muted-foreground block font-bold">
                  Custo operacional médio máximo desejado por km (combustível, pedágios, manutenção).
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-foreground uppercase tracking-wider block">
                  Meta Mínima de Faturamento (R$/km)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full bg-muted/30 border border-border/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={tempTargetFatKm}
                  onChange={e => setTempTargetFatKm(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="Ex: 2,50"
                />
                <span className="text-[10px] text-muted-foreground block font-bold">
                  Receita média mínima esperada para cada km rodado.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-foreground uppercase tracking-wider block">
                  Meta Mínima de Lucro Operacional (R$/km)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full bg-muted/30 border border-border/80 rounded-xl px-3.5 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  value={tempTargetLucroKm}
                  onChange={e => setTempTargetLucroKm(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="Ex: 1,85"
                />
                <span className="text-[10px] text-muted-foreground block font-bold">
                  Lucro operacional líquido mínimo esperado por km (Faturamento - Custo Op).
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-border/40 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                className="rounded-xl px-4 py-2 text-xs font-bold"
                onClick={() => setShowKmConfig(false)}
              >
                Cancelar
              </Button>
              <Button
                className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black rounded-xl px-4 py-2 text-xs"
                onClick={handleSaveKmTargets}
              >
                Salvar Metas
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Dialog explicativo dos Índices Fundamentalistas de Operação */}
      <Dialog open={showFundamentalHelpDialog} onOpenChange={setShowFundamentalHelpDialog}>
        <DialogContent className="max-w-md sm:max-w-lg p-0 bg-card border-border/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          <DialogHeader className="p-5 border-b border-border/40 bg-indigo-500/5 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl border border-indigo-500/20">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-foreground uppercase tracking-wide">
                  Guia Metodológico dos Índices Fundamentalistas
                </DialogTitle>
                <DialogDescription className="text-xs font-semibold text-muted-foreground">
                  Análise técnica da viabilidade financeira e eficiência operacional do transporte e entregas.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-3.5 overflow-y-auto text-xs">
            <div className="space-y-2.5">
              <div className="bg-muted/20 border border-border/50 rounded-xl p-3 space-y-1">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-indigo-500">
                  <Percent className="w-3.5 h-3.5" /> 1. Margem Líquida Consolidada (%)
                </h4>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Proporção final da receita líquida retida em relação ao faturamento bruto, calculada após a dedução de todas as despesas operacionais veiculares (combustível e manutenção) e despesas pessoais/retiradas.
                </p>
              </div>

              <div className="bg-muted/20 border border-border/50 rounded-xl p-3 space-y-1">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-indigo-500">
                  <TrendingUp className="w-3.5 h-3.5" /> 2. Margem Operacional / EBITDA Veicular (%)
                </h4>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Mede a rentabilidade bruta da operação veicular pré-retiradas. Demonstra a capacidade do veículo em gerar caixa em relação às despesas diretas de rodagem.
                </p>
              </div>

              <div className="bg-muted/20 border border-border/50 rounded-xl p-3 space-y-1">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-amber-500">
                  <Fuel className="w-3.5 h-3.5" /> 3. Custo Operacional por KM (CPK)
                </h4>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Custo unitário direto por quilômetro rodado (<span className="font-mono">OpEx / KM</span>), subdividido entre parcela de combustível e parcela de manutenção/peças. Serve como piso tarifário para precificação.
                </p>
              </div>

              <div className="bg-muted/20 border border-border/50 rounded-xl p-3 space-y-1">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-cyan-500">
                  <Coins className="w-3.5 h-3.5" /> 4. Receita Bruta por KM (RPK) & Lucro por KM (LPK)
                </h4>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Demonstra o faturamento gerado por quilômetro (<span className="font-mono">Faturamento / KM</span>) e a margem líquida por quilômetro (<span className="font-mono">Lucro Líquido / KM</span>), medindo o rendimento real da frota.
                </p>
              </div>

              <div className="bg-muted/20 border border-border/50 rounded-xl p-3 space-y-1">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-indigo-500">
                  <Zap className="w-3.5 h-3.5" /> 5. Multiplicador de Eficiência Operacional (MOE / ROIC)
                </h4>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Razão entre o Faturamento Bruto e os Custos Operacionais Veiculares (<span className="font-mono">Faturamento / Custo Veículo</span>). Indica o volume de receita gerado para cada R$ 1,00 despendido no veículo.
                </p>
              </div>

              <div className="bg-muted/20 border border-border/50 rounded-xl p-3 space-y-1">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-violet-500">
                  <Target className="w-3.5 h-3.5" /> 6. Ponto de Equilíbrio Financeiro (Breakeven)
                </h4>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Volume mínimo de receita e quilometragem necessários para anular completamente os custos operacionais do veículo e as despesas fixas pessoais no período selecionado.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl py-2.5 text-xs"
                onClick={() => setShowFundamentalHelpDialog(false)}
              >
                Entendi, voltar ao Painel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog do Gráfico Histórico e Comparativo dos Índices Fundamentalistas */}
      <Dialog 
        open={selectedFundamentalIndices.length > 0} 
        onOpenChange={(open) => { 
          if (!open) setSelectedFundamentalIndices([]); 
        }}
      >
        <DialogContent className="max-w-[95vw] md:max-w-[90vw] lg:max-w-6xl xl:max-w-7xl h-[92vh] max-h-[850px] p-0 bg-card border border-border/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/40 shrink-0 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  Comparativo de Índices Fundamentalistas
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
                  Correlacione a performance de múltiplos indicadores operacionais e financeiros ao longo do tempo.
                </DialogDescription>
              </div>
              <div className="text-xs font-bold text-muted-foreground bg-muted border border-border/60 px-3 py-1.5 rounded-full shrink-0 flex items-center gap-1.5 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                {selectedFundamentalIndices.length} {selectedFundamentalIndices.length === 1 ? 'índice ativo' : 'índices ativos'}
              </div>
            </div>
          </DialogHeader>

          <div className="overflow-y-auto p-4 sm:p-6 bg-muted/5 flex-1 custom-scrollbar">
            {(() => {
              const MARGENS_KEYS = ['margemLiquida', 'margemOperacional', 'personalMargin', 'personalRatio', 'fuelRatio', 'maintenanceRatio'];
              const KM_KEYS = ['rpk', 'lpk', 'personalPerKm', 'cpk', 'fuelAndOtherPerKm', 'maintenancePerKm'];
              const MOE_KEYS = ['moe'];

              const handleToggleIndex = (key: string) => {
                if (MOE_KEYS.includes(key)) {
                  setSelectedFundamentalIndices(['moe']);
                  return;
                }

                const isTargetMargens = MARGENS_KEYS.includes(key);
                const isTargetKm = KM_KEYS.includes(key);

                const currentFirst = selectedFundamentalIndices[0];
                const isCurrentMargens = currentFirst && MARGENS_KEYS.includes(currentFirst);
                const isCurrentKm = currentFirst && KM_KEYS.includes(currentFirst);

                if ((isTargetMargens && isCurrentMargens) || (isTargetKm && isCurrentKm)) {
                  if (selectedFundamentalIndices.includes(key)) {
                    if (selectedFundamentalIndices.length > 1) {
                      setSelectedFundamentalIndices(selectedFundamentalIndices.filter(k => k !== key));
                    }
                  } else {
                    setSelectedFundamentalIndices([...selectedFundamentalIndices, key]);
                  }
                } else {
                  setSelectedFundamentalIndices([key]);
                }
              };

              const renderIndividualChip = (key: string) => {
                const meta = indexMetadata[key];
                if (!meta) return null;
                const isSelected = selectedFundamentalIndices.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleToggleIndex(key)}
                    className={`flex items-center justify-between w-full p-2.5 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-muted/40 border-2 shadow-xs text-foreground scale-[1.01]'
                        : 'bg-transparent border-border/40 text-muted-foreground hover:bg-muted/20 hover:text-foreground opacity-80'
                    }`}
                    style={{ borderColor: isSelected ? meta.color : undefined }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-white font-black" 
                        style={{ backgroundColor: meta.color }}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3.5]" />}
                      </div>
                      <span className="truncate text-[11px] font-bold leading-none">{meta.title}</span>
                    </div>
                    <span className="text-[9.5px] font-mono text-muted-foreground font-extrabold shrink-0 ml-2 px-1.5 py-0.5 rounded-md bg-muted/80">{meta.unit}</span>
                  </button>
                );
              };

              return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Metric Selection & Glossary */}
                  <div className="lg:col-span-4 space-y-5">
                    
                    {/* Predefinidos */}
                    <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-2xs space-y-3">
                      <div className="flex items-center gap-2 border-b border-border/40 pb-2.5">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                          Conjuntos Rápidos
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedFundamentalIndices(['margemLiquida', 'margemOperacional', 'personalMargin', 'personalRatio', 'fuelRatio', 'maintenanceRatio'])}
                          className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-left border text-xs font-bold transition-all hover:bg-muted/40 cursor-pointer bg-indigo-500/5 border-indigo-500/20 text-indigo-500 hover:border-indigo-500/40"
                        >
                          <div className="flex items-center gap-2">
                            <Percent className="w-3.5 h-3.5" />
                            <span>Todas as Margens e Taxas</span>
                          </div>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-indigo-500/15 font-mono">6 ind.</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setSelectedFundamentalIndices(['rpk', 'lpk', 'personalPerKm', 'cpk', 'fuelAndOtherPerKm', 'maintenancePerKm'])}
                          className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-left border text-xs font-bold transition-all hover:bg-muted/40 cursor-pointer bg-emerald-500/5 border-emerald-500/20 text-emerald-500 hover:border-emerald-500/40"
                        >
                          <div className="flex items-center gap-2">
                            <Compass className="w-3.5 h-3.5" />
                            <span>Todos os Custos por KM</span>
                          </div>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/15 font-mono">6 ind.</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedFundamentalIndices(['moe'])}
                          className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-left border text-xs font-bold transition-all hover:bg-muted/40 cursor-pointer bg-purple-500/5 border-purple-500/20 text-purple-400 hover:border-purple-500/40"
                        >
                          <div className="flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5" />
                            <span>Multiplicador de Eficiência (MOE)</span>
                          </div>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-purple-500/15 font-mono">1 ind.</span>
                        </button>
                      </div>
                    </div>

                    {/* Seleção Individual */}
                    <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-2xs space-y-4">
                      <div className="flex items-center gap-2 border-b border-border/40 pb-2.5">
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                          Seleção Individual de Índices
                        </h4>
                      </div>

                      <div className="space-y-4">
                        {/* Grupo 1: Margens e Taxas */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block">
                            Margens & Taxas (% da Receita)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                            {MARGENS_KEYS.map(key => renderIndividualChip(key))}
                          </div>
                        </div>

                        {/* Grupo 2: Indicadores por KM */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block">
                            Custos e Receitas por KM (R$/km)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                            {KM_KEYS.map(key => renderIndividualChip(key))}
                          </div>
                        </div>

                        {/* Grupo 3: MOE */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block">
                            Eficiência e Alavancagem (x)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                            {MOE_KEYS.map(key => renderIndividualChip(key))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Glossário Dinâmico */}
                    <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-2xs space-y-3">
                      <div className="flex items-center gap-2 border-b border-border/40 pb-2.5 text-foreground">
                        <BookOpen className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-xs font-black uppercase tracking-wider">Glossário Ativo</h4>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                        Para melhor interpretação, você só pode comparar múltiplos índices se eles compartilharem a mesma escala/unidade (% ou R$/km).
                      </p>
                      <div className="space-y-3 pt-1.5">
                        {selectedFundamentalIndices.map(key => {
                          const meta = indexMetadata[key];
                          if (!meta) return null;
                          return (
                            <div key={key} className="space-y-1 bg-muted/25 rounded-xl p-2.5 border border-border/30">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                                <span className="text-[11px] font-black text-foreground leading-none">{meta.title}</span>
                                <span className="text-[9px] font-black px-1 py-0.2 rounded bg-muted text-muted-foreground font-mono ml-auto">{meta.unit}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-normal pl-3.5">
                                {meta.description}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Chart & Table */}
                  <div className="lg:col-span-8 space-y-5">
                    
                    {fundamentalHistory.length === 0 ? (
                      <div className="bg-card border border-border/70 rounded-2xl py-20 text-center text-xs text-muted-foreground font-medium">
                        Nenhum dado histórico registrado para exibir o gráfico.
                      </div>
                    ) : (
                      <>
                        {/* Gráfico Principal com Múltiplas Linhas */}
                        <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-2xs space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
                            <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                              <Activity className="w-4 h-4 text-indigo-500" /> Curva Histórica Comparativa
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {selectedFundamentalIndices.map(key => {
                                const meta = indexMetadata[key];
                                if (!meta) return null;
                                const lastVal = fundamentalHistory.length > 0
                                  ? Number(fundamentalHistory[fundamentalHistory.length - 1][key as keyof typeof fundamentalHistory[0]] || 0)
                                  : 0;
                                return (
                                  <div 
                                    key={key}
                                    className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-muted/40 border text-[10.5px] font-bold transition-all"
                                    style={{ borderColor: `${meta.color}60` }}
                                  >
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                                    <span className="text-foreground truncate max-w-[110px] sm:max-w-none">{meta.title}:</span>
                                    <span className="font-mono font-black" style={{ color: meta.color }}>{meta.formatter(lastVal)}</span>
                                    {selectedFundamentalIndices.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedFundamentalIndices(selectedFundamentalIndices.filter(k => k !== key))}
                                        className="ml-1 text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="h-[340px] sm:h-[380px] md:h-[400px] w-full pt-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={fundamentalHistory} margin={{ top: 15, right: 20, left: -10, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" opacity={0.4} />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a', fontWeight: 'bold' }} />
                                <RechartsTooltip
                                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                                  labelStyle={{ fontWeight: 'black', fontSize: 13, color: '#f4f4f5', marginBottom: '6px' }}
                                  itemStyle={{ fontSize: 11, fontWeight: 'semibold', padding: '2px 0' }}
                                  formatter={(val: any, name: any, item: any) => {
                                    const meta = indexMetadata[item.dataKey];
                                    return [meta ? meta.formatter(Number(val)) : val, meta ? meta.title : name];
                                  }}
                                />
                                {selectedFundamentalIndices.map(key => {
                                  const meta = indexMetadata[key];
                                  if (!meta) return null;
                                  return (
                                    <Line
                                      key={key}
                                      type="monotone"
                                      dataKey={key}
                                      name={meta.title}
                                      stroke={meta.color}
                                      strokeWidth={3}
                                      dot={{ r: 4, stroke: meta.color, strokeWidth: 2, fill: '#18181b' }}
                                      activeDot={{ r: 7, stroke: '#ffffff', strokeWidth: 2 }}
                                    />
                                  );
                                })}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Tabela de Histórico Detalhado */}
                        <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-2xs space-y-4">
                          <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-3">
                            <div className="flex items-center gap-2">
                              <CalendarRange className="w-4 h-4 text-indigo-500" />
                              <h4 className="text-xs font-black uppercase text-foreground tracking-wider">
                                Demonstrativo de Histórico por Mês
                              </h4>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-extrabold bg-muted px-2.5 py-0.5 rounded-md">
                              Exibindo {selectedFundamentalIndices.length} {selectedFundamentalIndices.length === 1 ? 'métrica' : 'métricas'}
                            </span>
                          </div>
                          
                          <div className="overflow-x-auto max-h-[280px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-border/50 text-[10px] font-black uppercase text-muted-foreground">
                                  <th className="pb-3 font-black text-foreground">Mês</th>
                                  {selectedFundamentalIndices.map(key => (
                                    <th key={key} className="pb-3 font-black text-right px-3 whitespace-nowrap">
                                      <span style={{ color: indexMetadata[key]?.color }}>{indexMetadata[key]?.title}</span>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/30">
                                {fundamentalHistory.slice().reverse().map((item, idx) => (
                                  <tr key={idx} className="hover:bg-muted/30 transition-all group">
                                    <td className="py-3 font-black text-foreground whitespace-nowrap group-hover:text-indigo-500 transition-colors">{item.label}</td>
                                    {selectedFundamentalIndices.map(key => {
                                      const val = Number(item[key as keyof typeof item] || 0);
                                      const meta = indexMetadata[key];
                                      return (
                                        <td key={key} className="py-3 font-mono font-black text-right px-3 whitespace-nowrap" style={{ color: meta?.color }}>
                                          {meta ? meta.formatter(val) : val}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}

                  </div>

                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <PersonalExpenseBarConfigDialog
        open={showPersonalBarConfig}
        onOpenChange={setShowPersonalBarConfig}
        availableCategories={availablePersonalCategories}
        categoryAmounts={currentPeriodPersonalCategoryAmounts}
        selectedCategories={personalBarCategories}
        groupOthers={groupUnselectedCategories}
        onSave={handleSavePersonalBarConfig}
        formatCurrency={formatCurrency}
        totalPersonalExpense={summary.perExpense}
      />
    </div>
  );
}
