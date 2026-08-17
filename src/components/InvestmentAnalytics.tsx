import React, { useMemo, useState, useEffect } from 'react';
import { InvestmentTransaction, Dividend, Reserve, UserSettings, ValuationTarget } from '../types';
import { useData } from '../contexts/DataContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { CvmDocumentButton } from './CvmDocumentButton';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area, 
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieIcon, 
  BarChart3, 
  Percent, 
  Info, 
  Wallet, 
  Award, 
  DollarSign, 
  Layers,
  Scale,
  Sparkles,
  Calculator,
  Target,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Save,
  Code,
  Copy,
  Building2,
  Coins,
  ShieldCheck,
  ShieldAlert,
  Check,
  X,
  ExternalLink,
  BookOpen,
  Trash2,
  Clock,
  AlertCircle,
  Edit3,
  RefreshCw
} from 'lucide-react';

interface InvestmentAnalyticsProps {
  investmentTransactions: InvestmentTransaction[];
  dividends: Dividend[];
  quotes: Record<string, number>;
  reserves: Reserve[];
  settings: UserSettings | null;
  hideValues: boolean;
  initialSubTab?: 'geral' | 'alocacao' | 'preco_teto';
  activeSubTab?: 'geral' | 'alocacao' | 'preco_teto';
  initialTicker?: string;
  onSubTabChange?: (subTab: 'geral' | 'alocacao' | 'preco_teto') => void;
  includeProvisioned?: boolean;
  onIncludeProvisionedChange?: (include: boolean) => void;
  hideTopCards?: boolean;
  hideSubTabButtons?: boolean;
}

interface CashFlowItem {
  date: Date;
  amount: number;
}

// XIRR Calculation using Newton-Raphson with Bisection fallback and expanding upper bound
function calculateXIRR(cashFlows: CashFlowItem[]): number | null {
  if (cashFlows.length < 2) return null;

  // Group cash flows by date string (YYYY-MM-DD) for numerical stability
  const mapByDate: Record<string, number> = {};
  cashFlows.forEach(cf => {
    const key = cf.date.toISOString().split('T')[0];
    mapByDate[key] = (mapByDate[key] || 0) + cf.amount;
  });

  const uniqueCF: CashFlowItem[] = Object.entries(mapByDate).map(([dateStr, amount]) => ({
    date: new Date(dateStr + 'T12:00:00Z'),
    amount
  })).sort((a, b) => a.date.getTime() - b.date.getTime());

  if (uniqueCF.length < 2) return null;

  const startDate = uniqueCF[0].date;
  const hasNegative = uniqueCF.some(cf => cf.amount < 0);
  const hasPositive = uniqueCF.some(cf => cf.amount > 0);
  if (!hasNegative || !hasPositive) return null;

  const getYears = (d: Date) => Math.max(0.0001, (d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

  const npv = (rate: number) => {
    return uniqueCF.reduce((sum, cf) => {
      const t = getYears(cf.date);
      if (rate <= -1) return sum;
      return sum + cf.amount / Math.pow(1 + rate, t);
    }, 0);
  };

  const derivativeNpv = (rate: number) => {
    return uniqueCF.reduce((sum, cf) => {
      const t = getYears(cf.date);
      if (t === 0 || rate <= -1) return sum;
      return sum - (t * cf.amount) / Math.pow(1 + rate, t + 1);
    }, 0);
  };

  // 1. Newton-Raphson
  let rate = 0.1;
  const maxIter = 100;
  const tol = 1e-6;

  for (let i = 0; i < maxIter; i++) {
    const fVal = npv(rate);
    const dfVal = derivativeNpv(rate);

    if (Math.abs(fVal) < tol) return rate;
    if (Math.abs(dfVal) < 1e-10) break;

    const nextRate = rate - fVal / dfVal;

    if (nextRate <= -0.99 || nextRate > 1000) break;
    if (Math.abs(nextRate - rate) < tol) return nextRate;

    rate = nextRate;
  }

  // 2. Bisection search with expanding upper bound
  let low = -0.99;
  let high = 5.0;
  let fLow = npv(low);
  let fHigh = npv(high);

  if (fLow * fHigh > 0) {
    for (let expand = 0; expand < 10; expand++) {
      high *= 4;
      fHigh = npv(high);
      if (fLow * fHigh <= 0) break;
    }
  }

  if (fLow * fHigh > 0) return null;

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const fMid = npv(mid);

    if (Math.abs(fMid) < tol || (high - low) / 2 < tol) {
      return mid;
    }

    if (fLow * fMid < 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }

  return (low + high) / 2;
}

interface NumericInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
  decimals?: number;
}

const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = '0,00',
  prefix,
  suffix,
  disabled = false,
  decimals = 2
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [stringValue, setStringValue] = useState<string>(() => {
    if (value === undefined || value === null || isNaN(value)) return '0,00';
    return value.toFixed(decimals).replace('.', ',');
  });

  useEffect(() => {
    if (!isFocused) {
      if (value === undefined || value === null || isNaN(value)) {
        setStringValue('0,00');
      } else {
        setStringValue(value.toFixed(decimals).replace('.', ','));
      }
    }
  }, [value, isFocused, decimals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    raw = raw.replace(/\./g, ',');
    raw = raw.replace(/[^0-9,-]/g, '');

    const parts = raw.split(',');
    if (parts.length > 2) {
      raw = parts[0] + ',' + parts.slice(1).join('');
    }

    if (parts.length === 2 && parts[1].length > decimals) {
      raw = parts[0] + ',' + parts[1].slice(0, decimals);
    }

    setStringValue(raw);

    const normalized = raw.replace(',', '.');
    const parsed = parseFloat(normalized);

    if (!isNaN(parsed)) {
      onChange(parsed);
    } else if (raw.trim() === '' || raw === '-') {
      onChange(0);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (value !== undefined && value !== null && !isNaN(value)) {
      setStringValue(value.toFixed(decimals).replace('.', ','));
    } else {
      setStringValue((0).toFixed(decimals).replace('.', ','));
    }
  };

  return (
    <div className="relative flex items-center w-full">
      {prefix && (
        <span className="absolute left-2.5 text-muted-foreground font-bold text-[10px] pointer-events-none select-none z-10">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={stringValue}
        onChange={handleChange}
        onFocus={(e) => {
          setIsFocused(true);
          e.target.select();
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`${className} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-7' : ''}`}
      />
      {suffix && (
        <span className="absolute right-2.5 text-muted-foreground font-bold text-[10px] pointer-events-none select-none z-10">
          {suffix}
        </span>
      )}
    </div>
  );
};

export function InvestmentAnalytics({
  investmentTransactions,
  dividends,
  quotes,
  reserves,
  settings,
  hideValues,
  initialSubTab = 'geral',
  activeSubTab: controlledActiveSubTab,
  initialTicker,
  onSubTabChange,
  includeProvisioned: externalIncludeProvisioned,
  onIncludeProvisionedChange,
  hideTopCards = false,
  hideSubTabButtons = false
}: InvestmentAnalyticsProps) {
  const [internalActiveSubTab, setInternalActiveSubTab] = useState<'geral' | 'alocacao' | 'preco_teto'>(initialSubTab);
  const activeSubTab = controlledActiveSubTab || internalActiveSubTab;
  const [showTooltipInfo, setShowTooltipInfo] = useState<string | null>(null);
  const [isSavingValuation, setIsSavingValuation] = useState<boolean>(false);
  const [tirMode, setTirMode] = useState<'dynamic' | 'period' | 'annual'>('dynamic');
  
  // State for considering provisioned (pending) dividends in analytics
  const [internalIncludeProvisioned, setInternalIncludeProvisioned] = useState<boolean>(false);
  const isProvisionedIncluded = externalIncludeProvisioned !== undefined ? externalIncludeProvisioned : internalIncludeProvisioned;

  const handleToggleProvisioned = (val: boolean) => {
    setInternalIncludeProvisioned(val);
    if (onIncludeProvisionedChange) {
      onIncludeProvisionedChange(val);
    }
  };

  // Valuation Calculator Inputs
  const [selectedTicker, setSelectedTicker] = useState<string>(initialTicker || 'PETR4');

  useEffect(() => {
    if (initialSubTab) {
      setInternalActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    if (initialTicker) {
      setSelectedTicker(initialTicker.toUpperCase());
    }
  }, [initialTicker]);

  const handleSubTabChange = (tab: 'geral' | 'alocacao' | 'preco_teto') => {
    setInternalActiveSubTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };
  const [assetType, setAssetType] = useState<'Ação' | 'FII'>('Ação');
  const [calcCurrentPrice, setCalcCurrentPrice] = useState<number>(30.0);
  
  // Bazin
  const [bazinDPA, setBazinDPA] = useState<number>(0);
  const [bazinTargetYield, setBazinTargetYield] = useState<number>(0);
  
  // Graham
  const [grahamLPA, setGrahamLPA] = useState<number>(0);
  const [grahamVPA, setGrahamVPA] = useState<number>(0);

  // Gordon
  const [gordonD1, setGordonD1] = useState<number>(0);
  const [gordonRequiredReturn, setGordonRequiredReturn] = useState<number>(0); // k (%)
  const [gordonGrowthRate, setGordonGrowthRate] = useState<number>(0); // g (%)

  // PL Alvo
  const [plTarget, setPlTarget] = useState<number>(0);

  // PVP Alvo (FII)
  const [pvpTarget, setPvpTarget] = useState<number>(0);

  // Toggle for additional methods when viewing FII
  const [showEquityMethodsForFii, setShowEquityMethodsForFii] = useState<boolean>(false);

  // Passive Income Goal State & Compound Interest Simulation
  const [monthlyDividendGoal, setMonthlyDividendGoal] = useState<number>(1000);
  const [simMonthlyContrib, setSimMonthlyContrib] = useState<number>(1000);
  const [simAnnualYield, setSimAnnualYield] = useState<number>(8);
  const [simAnnualGrowth, setSimAnnualGrowth] = useState<number>(6);
  const [simYears, setSimYears] = useState<number>(10);

  // Price comparison chart view mode & type filter
  const [priceChartMode, setPriceChartMode] = useState<'percent' | 'totalReturn' | 'base100' | 'absolute'>('percent');
  const [perfTypeFilter, setPerfTypeFilter] = useState<string>('all');

  const { valuationTargets, saveValuationTarget, deleteValuationTarget } = useData();
  const savedValuations = valuationTargets;

  const formatCurrency = (val: number) => {
    if (hideValues) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatPercent = (val: number) => {
    if (hideValues) return '•••%';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  // 1. POSITION & PORTFOLIO CALCULATIONS
  const analyticsData = useMemo(() => {
    const posMap: Record<string, {
      ticker: string;
      type: string;
      quantity: number;
      totalInvested: number;
      avgPrice: number;
      currentPrice: number | null;
      currentValue: number;
      dividendsReceived: number;
      realizedGain: number;
    }> = {};

    const sortedTx = [...investmentTransactions].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.created_at || '').localeCompare(b.created_at || '');
    });

    sortedTx.forEach(tx => {
      const t = tx.ticker.toUpperCase();
      if (!posMap[t]) {
        posMap[t] = {
          ticker: t,
          type: tx.type,
          quantity: 0,
          totalInvested: 0,
          avgPrice: 0,
          currentPrice: quotes[t] || null,
          currentValue: 0,
          dividendsReceived: 0,
          realizedGain: 0,
        };
      }

      const p = posMap[t];
      const txCosts = tx.costs || 0;

      if (tx.operation === 'buy') {
        const costBasis = tx.amount + txCosts;
        p.totalInvested += costBasis;
        p.quantity += tx.quantity;
        p.avgPrice = p.quantity > 0 ? p.totalInvested / p.quantity : 0;
      } else if (tx.operation === 'sell') {
        const netProceeds = Math.max(0, tx.amount - txCosts);
        const costBasisSold = tx.quantity * p.avgPrice;
        const gainOnSale = netProceeds - costBasisSold;

        p.realizedGain += gainOnSale;
        p.quantity -= tx.quantity;
        if (p.quantity <= 0) {
          p.quantity = 0;
          p.totalInvested = 0;
          p.avgPrice = 0;
        } else {
          p.totalInvested = p.quantity * p.avgPrice;
        }
      }
    });

    dividends.forEach(d => {
      const isIncluded = isProvisionedIncluded
        ? (d.status === 'received' || d.status === 'provisioned')
        : (d.status === 'received');

      if (isIncluded) {
        const t = d.ticker.toUpperCase();
        if (posMap[t]) {
          posMap[t].dividendsReceived += d.amount;
        }
      }
    });

    let totalInvestedPortfolio = 0;
    let totalCurrentPortfolio = 0;

    const activePositions = Object.values(posMap).filter(p => p.quantity > 0);
    activePositions.forEach(p => {
      p.currentPrice = quotes[p.ticker] || null;
      p.currentValue = p.currentPrice ? p.currentPrice * p.quantity : p.totalInvested;
      totalInvestedPortfolio += p.totalInvested;
      totalCurrentPortfolio += p.currentValue;
    });

    const capitalGain = totalCurrentPortfolio - totalInvestedPortfolio;
    const capitalGainPercent = totalInvestedPortfolio > 0 ? (capitalGain / totalInvestedPortfolio) * 100 : 0;

    const totalRealizedGain = Object.values(posMap).reduce((sum, p) => sum + p.realizedGain, 0);

    const totalDividendsReceived = dividends
      .filter(d => d.status === 'received')
      .reduce((sum, d) => sum + d.amount, 0);

    const totalDividendsProvisioned = dividends
      .filter(d => d.status === 'provisioned')
      .reduce((sum, d) => sum + d.amount, 0);

    const totalDividendsConsidered = isProvisionedIncluded 
      ? (totalDividendsReceived + totalDividendsProvisioned) 
      : totalDividendsReceived;

    const yieldOnCost = totalInvestedPortfolio > 0 ? (totalDividendsConsidered / totalInvestedPortfolio) * 100 : 0;
    const totalReturnR$ = capitalGain + totalRealizedGain + totalDividendsConsidered;
    const totalReturnPercent = totalInvestedPortfolio > 0 ? (totalReturnR$ / totalInvestedPortfolio) * 100 : 0;

    const configuredReserve = reserves.find(r => r.id === settings?.default_investment_reserve_id);
    const reserveSaldo = configuredReserve?.saldo_atual || 0;
    const totalPatrimonyWithCash = totalCurrentPortfolio + reserveSaldo;

    return {
      sortedTx,
      activePositions,
      totalInvestedPortfolio,
      totalCurrentPortfolio,
      capitalGain,
      capitalGainPercent,
      totalDividendsReceived,
      totalDividendsProvisioned,
      totalDividendsConsidered,
      yieldOnCost,
      totalReturnR$,
      totalReturnPercent,
      reserveSaldo,
      totalPatrimonyWithCash,
      configuredReserve
    };
  }, [investmentTransactions, dividends, quotes, reserves, settings, isProvisionedIncluded]);

  // List of all unique tickers
  const portfolioTickers = useMemo(() => {
    const tickers = Array.from(new Set(analyticsData.activePositions.map(p => p.ticker)));
    if (tickers.length === 0) return ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'MXRF11', 'HGLG11'];
    return tickers;
  }, [analyticsData.activePositions]);

  // Update inputs whenever selectedTicker, savedValuations, or live quotes change
  useEffect(() => {
    const tk = selectedTicker.toUpperCase().trim();
    if (!tk) return;
    const pos = analyticsData.activePositions.find(p => p.ticker === tk);
    const saved = savedValuations[tk];
    
    // Default asset type detection
    const isFii = saved?.asset_type ? saved.asset_type === 'FII' : (pos?.type === 'FII' || tk.endsWith('11'));
    setAssetType(isFii ? 'FII' : 'Ação');

    // Live market quote price
    const liveQ = quotes[tk] || pos?.currentPrice;
    const currentQ = (liveQ && liveQ > 0)
      ? liveQ
      : (saved?.calc_current_price && saved.calc_current_price > 0)
        ? saved.calc_current_price
        : pos?.avgPrice || 30.0;
    setCalcCurrentPrice(currentQ);

    // If we have saved data for this ticker, populate it!
    if (saved) {
      if (saved.asset_type) setAssetType(saved.asset_type);
      setBazinDPA(saved.bazin_dpa ?? 0);
      setBazinTargetYield(saved.bazin_target_yield ?? (isFii ? 8.5 : 6.0));
      setGrahamLPA(saved.graham_lpa ?? 0);
      setGrahamVPA(saved.graham_vpa ?? 0);
      setGordonD1(saved.gordon_d1 ?? 0);
      setGordonRequiredReturn(saved.gordon_k ?? 0);
      setGordonGrowthRate(saved.gordon_g ?? 0);
      setPlTarget(saved.pl_target ?? 1);
      setPvpTarget(saved.pvp_target ?? (isFii ? 1.0 : 0));
    } else {
      // Default to 0 for unsaved assets
      setBazinDPA(0);
      setBazinTargetYield(isFii ? 8.5 : 6.0);
      setGrahamLPA(0);
      setGrahamVPA(0);
      setGordonD1(0);
      setGordonRequiredReturn(0);
      setGordonGrowthRate(0);
      setPlTarget(1);
      setPvpTarget(isFii ? 1.0 : 0);
    }
  }, [selectedTicker, savedValuations, quotes, analyticsData.activePositions]);

  // Handle ticker selection
  const handleSelectCalculatorTicker = (tk: string) => {
    setSelectedTicker(tk.toUpperCase());
  };

  // Save Valuation to Supabase & LocalStorage via Context
  const handleSaveValuation = async () => {
    setIsSavingValuation(true);
    const tk = selectedTicker.toUpperCase().trim();
    if (!tk) {
      toast.error('Informe um ticker válido.');
      setIsSavingValuation(false);
      return;
    }

    const payload: ValuationTarget = {
      ticker: tk,
      asset_type: assetType,
      calc_current_price: calcCurrentPrice,
      bazin_dpa: bazinDPA,
      bazin_target_yield: bazinTargetYield,
      graham_lpa: grahamLPA,
      graham_vpa: grahamVPA,
      gordon_d1: gordonD1,
      gordon_k: gordonRequiredReturn,
      gordon_g: gordonGrowthRate,
      pl_target: plTarget,
      pvp_target: pvpTarget,
      updated_at: new Date().toISOString()
    };

    try {
      await saveValuationTarget(payload);
    } finally {
      setIsSavingValuation(false);
    }
  };

  // Delete Valuation from Supabase & LocalStorage via Context
  const handleDeleteValuation = async (tkToDelete: string) => {
    const tk = tkToDelete.toUpperCase().trim();
    await deleteValuationTarget(tk);
  };

  // Saved Valuation State Detection for Active Ticker
  const activeTickerUpper = selectedTicker.toUpperCase();
  const currentSavedTarget = savedValuations[activeTickerUpper];
  const isTargetSaved = !!currentSavedTarget;

  const hasUnsavedChanges = useMemo(() => {
    if (!currentSavedTarget) return false;
    const eps = 0.001;
    if (currentSavedTarget.asset_type && currentSavedTarget.asset_type !== assetType) return true;
    if (currentSavedTarget.calc_current_price !== undefined && Math.abs(currentSavedTarget.calc_current_price - calcCurrentPrice) > eps) return true;
    if (currentSavedTarget.bazin_dpa !== undefined && Math.abs(currentSavedTarget.bazin_dpa - bazinDPA) > eps) return true;
    if (currentSavedTarget.bazin_target_yield !== undefined && Math.abs(currentSavedTarget.bazin_target_yield - bazinTargetYield) > eps) return true;
    if (currentSavedTarget.graham_lpa !== undefined && Math.abs(currentSavedTarget.graham_lpa - grahamLPA) > eps) return true;
    if (currentSavedTarget.graham_vpa !== undefined && Math.abs(currentSavedTarget.graham_vpa - grahamVPA) > eps) return true;
    if (currentSavedTarget.gordon_d1 !== undefined && Math.abs(currentSavedTarget.gordon_d1 - gordonD1) > eps) return true;
    if (currentSavedTarget.gordon_k !== undefined && Math.abs(currentSavedTarget.gordon_k - gordonRequiredReturn) > eps) return true;
    if (currentSavedTarget.gordon_g !== undefined && Math.abs(currentSavedTarget.gordon_g - gordonGrowthRate) > eps) return true;
    if (currentSavedTarget.pl_target !== undefined && Math.abs(currentSavedTarget.pl_target - plTarget) > eps) return true;
    if (currentSavedTarget.pvp_target !== undefined && Math.abs(currentSavedTarget.pvp_target - pvpTarget) > eps) return true;
    return false;
  }, [currentSavedTarget, assetType, calcCurrentPrice, bazinDPA, bazinTargetYield, grahamLPA, grahamVPA, gordonD1, gordonRequiredReturn, gordonGrowthRate, plTarget, pvpTarget]);

  // Saved Valuations List with live calculations exactly synchronized with calculator
  const savedValuationsList = useMemo(() => {
    return (Object.values(savedValuations) as ValuationTarget[]).map(v => {
      const tk = v.ticker.toUpperCase();
      const isFii = v.asset_type === 'FII' || (!v.asset_type && tk.endsWith('11'));
      const pos = analyticsData.activePositions.find(p => p.ticker === tk);
      const liveQ = quotes[tk] || pos?.currentPrice;
      const curPrice = (liveQ && liveQ > 0)
        ? liveQ
        : (v.calc_current_price && v.calc_current_price > 0)
          ? v.calc_current_price
          : pos?.avgPrice || 0;

      const targetYield = (v.bazin_target_yield !== undefined && v.bazin_target_yield > 0)
        ? v.bazin_target_yield
        : (isFii ? 8.5 : 6.0);
      const bazinDpa = v.bazin_dpa || 0;
      const bazinCeiling = (targetYield > 0 && bazinDpa > 0) ? (bazinDpa / (targetYield / 100)) : 0;
      const bazinMargin = (curPrice > 0 && bazinCeiling > 0) ? ((bazinCeiling - curPrice) / curPrice) * 100 : 0;

      // Graham
      const lpa = v.graham_lpa || 0;
      const vpa = v.graham_vpa || 0;
      const grahamVal = 22.5 * lpa * vpa;
      const grahamCeiling = grahamVal > 0 ? Math.sqrt(grahamVal) : 0;
      const grahamMargin = (curPrice > 0 && grahamCeiling > 0) ? ((grahamCeiling - curPrice) / curPrice) * 100 : 0;

      // P/VP (for FIIs)
      const pvpTarget = v.pvp_target || 0;
      const pvpCeiling = (vpa > 0 && pvpTarget > 0) ? vpa * pvpTarget : 0;
      const pvpMargin = (curPrice > 0 && pvpCeiling > 0) ? ((pvpCeiling - curPrice) / curPrice) * 100 : 0;

      // P/L (for Ações)
      const plTarget = v.pl_target || 0;
      const plCeiling = (lpa > 0 && plTarget > 0) ? lpa * plTarget : 0;
      const plMargin = (curPrice > 0 && plCeiling > 0) ? ((plCeiling - curPrice) / curPrice) * 100 : 0;

      // Gordon
      const gordonD1 = v.gordon_d1 || 0;
      const gordonK = v.gordon_k || 0;
      const gordonG = v.gordon_g || 0;
      const gordonDiff = (gordonK - gordonG) / 100;
      const gordonCeiling = (gordonD1 > 0 && gordonDiff > 0) ? gordonD1 / gordonDiff : 0;
      const gordonMargin = (curPrice > 0 && gordonCeiling > 0) ? ((gordonCeiling - curPrice) / curPrice) * 100 : 0;

      return {
        ...v,
        curPrice,
        bazinDpa,
        targetYield,
        bazinCeiling,
        bazinMargin,
        grahamCeiling,
        grahamMargin,
        pvpCeiling,
        pvpMargin,
        plCeiling,
        plMargin,
        gordonCeiling,
        gordonMargin,
        isFii
      };
    }).sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [savedValuations, quotes]);

  // 2. TWR & TIR
  const performanceMetrics = useMemo(() => {
    const { sortedTx, totalCurrentPortfolio } = analyticsData;

    // 2.1 Cash flows for TIR / IRR (XIRR)
    const cashFlows: CashFlowItem[] = [];

    sortedTx.forEach(tx => {
      const txDate = new Date(tx.date + 'T12:00:00Z');
      const costs = tx.costs || 0;
      if (tx.operation === 'buy') {
        cashFlows.push({ date: txDate, amount: -(tx.amount + costs) });
      } else {
        cashFlows.push({ date: txDate, amount: +(tx.amount - costs) });
      }
    });

    dividends.forEach(d => {
      const isIncluded = isProvisionedIncluded
        ? (d.status === 'received' || d.status === 'provisioned')
        : (d.status === 'received');

      if (isIncluded) {
        const dDateStr = d.data_ex || d.date;
        if (dDateStr) {
          const divDate = new Date(dDateStr + 'T12:00:00Z');
          cashFlows.push({ date: divDate, amount: d.amount });
        }
      }
    });

    if (totalCurrentPortfolio > 0) {
      cashFlows.push({ date: new Date(), amount: totalCurrentPortfolio });
    }

    const tirAnnual = calculateXIRR(cashFlows);
    const tirAnnualPercent = tirAnnual !== null ? tirAnnual * 100 : null;

    let daysElapsed = 0;
    if (cashFlows.length >= 2) {
      const sortedCF = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
      const startDate = sortedCF[0].date;
      const endDate = sortedCF[sortedCF.length - 1].date;
      daysElapsed = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    }
    const yearsElapsed = daysElapsed > 0 ? daysElapsed / 365.25 : 0;

    let tirPeriodPercent: number | null = null;
    if (tirAnnual !== null) {
      if (1 + tirAnnual > 0) {
        const tirPeriod = Math.pow(1 + tirAnnual, yearsElapsed) - 1;
        tirPeriodPercent = tirPeriod * 100;
      } else {
        tirPeriodPercent = tirAnnual * 100;
      }
    }

    // 2.2 TWR (Time-Weighted Rate of Return)
    // Gather all distinct event dates (transactions & received dividends)
    const eventDatesSet = new Set<string>();
    sortedTx.forEach(tx => eventDatesSet.add(tx.date));
    dividends.forEach(d => {
      const isIncluded = isProvisionedIncluded
        ? (d.status === 'received' || d.status === 'provisioned')
        : (d.status === 'received');

      if (isIncluded) {
        const dDateStr = d.data_ex || d.date;
        if (dDateStr) eventDatesSet.add(dDateStr);
      }
    });

    const eventDates = Array.from(eventDatesSet).sort();
    const todayStr = new Date().toISOString().split('T')[0];

    // Map txs and dividends by date string
    const txByDate: Record<string, InvestmentTransaction[]> = {};
    sortedTx.forEach(tx => {
      if (!txByDate[tx.date]) txByDate[tx.date] = [];
      txByDate[tx.date].push(tx);
    });

    const divByDate: Record<string, number> = {};
    dividends.forEach(d => {
      const isIncluded = isProvisionedIncluded
        ? (d.status === 'received' || d.status === 'provisioned')
        : (d.status === 'received');

      if (isIncluded) {
        const dDateStr = d.data_ex || d.date;
        if (dDateStr) {
          divByDate[dDateStr] = (divByDate[dDateStr] || 0) + d.amount;
        }
      }
    });

    // Price interpolation helper for historical intermediate dates
    const getInterpolatedPrice = (ticker: string, targetDateStr: string, firstBuyDateStr: string, avgBuyPrice: number) => {
      const currentQ = quotes[ticker] || avgBuyPrice;
      if (targetDateStr >= todayStr || firstBuyDateStr >= todayStr) return currentQ;
      if (targetDateStr <= firstBuyDateStr) return avgBuyPrice;

      const tTarget = new Date(targetDateStr + 'T12:00:00Z').getTime();
      const tFirst = new Date(firstBuyDateStr + 'T12:00:00Z').getTime();
      const tToday = new Date(todayStr + 'T12:00:00Z').getTime();

      if (tToday <= tFirst) return currentQ;
      const progress = Math.min(1, Math.max(0, (tTarget - tFirst) / (tToday - tFirst)));
      return avgBuyPrice + (currentQ - avgBuyPrice) * progress;
    };

    let twrFactor = 1.0;
    const currentHoldings: Record<string, { qty: number; totalCost: number; firstBuyDate: string }> = {};

    let lastStartValue = 0;

    eventDates.forEach((dStr) => {
      // a. Evaluate portfolio value BEFORE cashflows at event date dStr
      let valBefore = 0;
      Object.entries(currentHoldings).forEach(([tk, h]) => {
        if (h.qty > 0) {
          const avgP = h.qty > 0 ? h.totalCost / h.qty : 0;
          const priceOnD = getInterpolatedPrice(tk, dStr, h.firstBuyDate, avgP);
          valBefore += h.qty * priceOnD;
        }
      });

      const divOnD = divByDate[dStr] || 0;

      if (lastStartValue > 0) {
        // Sub-period return: (Valuation before new cash + Dividends received) / Valuation after previous cash
        const subReturn = (valBefore + divOnD - lastStartValue) / lastStartValue;
        twrFactor *= (1 + subReturn);
      }

      // b. Process transactions on date dStr
      const txs = txByDate[dStr] || [];
      txs.forEach(tx => {
        const tk = tx.ticker.toUpperCase();
        if (!currentHoldings[tk]) {
          currentHoldings[tk] = { qty: 0, totalCost: 0, firstBuyDate: tx.date };
        }
        const h = currentHoldings[tk];
        const costs = tx.costs || 0;
        if (tx.operation === 'buy') {
          h.qty += tx.quantity;
          h.totalCost += (tx.amount + costs);
        } else if (tx.operation === 'sell') {
          const avgP = h.qty > 0 ? h.totalCost / h.qty : 0;
          h.qty = Math.max(0, h.qty - tx.quantity);
          h.totalCost = h.qty * avgP;
        }
      });

      // c. Evaluate portfolio value AFTER cashflows at date dStr
      let valAfter = 0;
      Object.entries(currentHoldings).forEach(([tk, h]) => {
        if (h.qty > 0) {
          const avgP = h.qty > 0 ? h.totalCost / h.qty : 0;
          const priceOnD = getInterpolatedPrice(tk, dStr, h.firstBuyDate, avgP);
          valAfter += h.qty * priceOnD;
        }
      });
      lastStartValue = valAfter;
    });

    // Final sub-period from last event to today
    if (lastStartValue > 0 && totalCurrentPortfolio > 0) {
      const finalReturn = (totalCurrentPortfolio - lastStartValue) / lastStartValue;
      twrFactor *= (1 + finalReturn);
    }

    const twrPercent = (twrFactor - 1) * 100;

    return {
      twrPercent: isNaN(twrPercent) ? 0 : twrPercent,
      tirAnnualPercent,
      tirPeriodPercent,
      daysElapsed,
      yearsElapsed
    };
  }, [analyticsData, dividends, quotes]);

  // 3. ASSET ALLOCATION DATA
  const allocationData = useMemo(() => {
    const { activePositions, totalCurrentPortfolio } = analyticsData;

    const typeMap: Record<string, number> = {};
    activePositions.forEach(p => {
      const type = p.type || 'Ação';
      typeMap[type] = (typeMap[type] || 0) + p.currentValue;
    });

    const categoryColors: Record<string, string> = {
      'Ação': '#3b82f6',
      'FII': '#10b981',
      'Fundo Imobiliário': '#10b981',
      'Cripto': '#f59e0b',
      'Renda Fixa': '#8b5cf6',
      'ETF': '#ec4899',
      'Outro': '#64748b'
    };

    const byCategory = Object.entries(typeMap).map(([name, value]) => ({
      name,
      value,
      percent: totalCurrentPortfolio > 0 ? (value / totalCurrentPortfolio) * 100 : 0,
      color: categoryColors[name] || '#6366f1'
    })).sort((a, b) => b.value - a.value);

    const tickerColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];
    const sortedPositions = [...activePositions].sort((a, b) => b.currentValue - a.currentValue);

    const topTickers = sortedPositions.slice(0, 7).map((p, idx) => ({
      name: p.ticker,
      value: p.currentValue,
      percent: totalCurrentPortfolio > 0 ? (p.currentValue / totalCurrentPortfolio) * 100 : 0,
      color: tickerColors[idx % tickerColors.length]
    }));

    if (sortedPositions.length > 7) {
      const othersVal = sortedPositions.slice(7).reduce((sum, p) => sum + p.currentValue, 0);
      topTickers.push({
        name: 'Outros',
        value: othersVal,
        percent: totalCurrentPortfolio > 0 ? (othersVal / totalCurrentPortfolio) * 100 : 0,
        color: '#64748b'
      });
    }

    return { byCategory, topTickers };
  }, [analyticsData]);

  // 4. MONTHLY DIVIDENDS EVOLUTION
  const monthlyDividendsData = useMemo(() => {
    const monthMap: Record<string, { month: string; dividendo: number; jcp: number; rendimento: number; total: number }> = {};

    dividends
      .filter(d => isProvisionedIncluded ? true : d.status === 'received')
      .forEach(d => {
        const dateStr = d.data_ex || d.date;
        if (!dateStr) return;
        const [year, month] = dateStr.split('-');
        if (!year || !month) return;
        const key = `${year}-${month}`;
        const label = `${month}/${year.slice(2)}`;

        if (!monthMap[key]) {
          monthMap[key] = { month: label, dividendo: 0, jcp: 0, rendimento: 0, total: 0 };
        }

        const amt = d.amount;
        monthMap[key].total += amt;
        if (d.type === 'Dividendo') {
          monthMap[key].dividendo += amt;
        } else if (d.type === 'JCP') {
          monthMap[key].jcp += amt;
        } else {
          monthMap[key].rendimento += amt;
        }
      });

    const monthList = Object.keys(monthMap)
      .sort()
      .map(k => monthMap[k]);

    const recentMonths = monthList.slice(-6);
    const avgRecentMonthlyDividends = recentMonths.length > 0
      ? recentMonths.reduce((sum, m) => sum + m.total, 0) / recentMonths.length
      : 0;

    return {
      monthList,
      avgRecentMonthlyDividends
    };
  }, [dividends, isProvisionedIncluded]);

  // 5. TIMELINE DATA
  const timelineData = useMemo(() => {
    const { sortedTx } = analyticsData;
    if (sortedTx.length === 0) return [];

    let cumInvested = 0;
    const mapByDate: Record<string, number> = {};

    sortedTx.forEach(tx => {
      const d = tx.date;
      const costs = tx.costs || 0;
      if (tx.operation === 'buy') {
        cumInvested += tx.amount + costs;
      } else {
        cumInvested -= (tx.amount - costs);
      }
      mapByDate[d] = Math.max(0, cumInvested);
    });

    const dates = Object.keys(mapByDate).sort();
    let currentVal = 0;

    return dates.map(d => {
      const dateParts = d.split('-');
      const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0].slice(2)}`;
      currentVal = mapByDate[d];
      
      return {
        date: formattedDate,
        investido: Number(currentVal.toFixed(2)),
      };
    });
  }, [analyticsData]);

  // 6. GAIN/LOSS BREAKDOWN CHART DATA
  const gainLossData = useMemo(() => {
    return analyticsData.activePositions
      .map(p => {
        const gain = p.currentValue - p.totalInvested;
        return {
          ticker: p.ticker,
          gain: Number(gain.toFixed(2)),
          gainPercent: p.totalInvested > 0 ? (gain / p.totalInvested) * 100 : 0
        };
      })
      .sort((a, b) => b.gain - a.gain);
  }, [analyticsData]);

  // 7. PRICE VS AVG PRICE DATA
  const priceComparisonData = useMemo(() => {
    return analyticsData.activePositions
      .map(p => {
        const curPrice = p.currentPrice || p.avgPrice;
        const diffR = curPrice - p.avgPrice;
        const variacaoPct = p.avgPrice > 0 ? (diffR / p.avgPrice) * 100 : 0;
        const cotacaoBase100 = p.avgPrice > 0 ? (curPrice / p.avgPrice) * 100 : 100;
        const curValue = curPrice * p.quantity;
        const capGainR$ = curValue - p.totalInvested;
        const proventosR$ = p.dividendsReceived || 0;
        const retornoTotalR$ = capGainR$ + proventosR$;
        const retornoTotalPct = p.totalInvested > 0 ? (retornoTotalR$ / p.totalInvested) * 100 : 0;

        return {
          ticker: p.ticker,
          type: p.type || 'Outros',
          precoMedio: Number(p.avgPrice.toFixed(2)),
          cotacao: Number(curPrice.toFixed(2)),
          diffR: Number(diffR.toFixed(2)),
          variacaoPct: Number(variacaoPct.toFixed(2)),
          pmBase100: 100,
          cotacaoBase100: Number(cotacaoBase100.toFixed(2)),
          capGainR$: Number(capGainR$.toFixed(2)),
          proventosR$: Number(proventosR$.toFixed(2)),
          retornoTotalR$: Number(retornoTotalR$.toFixed(2)),
          retornoTotalPct: Number(retornoTotalPct.toFixed(2)),
          totalInvested: Number(p.totalInvested.toFixed(2))
        };
      })
      .sort((a, b) => b.variacaoPct - a.variacaoPct);
  }, [analyticsData]);

  // Aggregated summary per asset class/type to compare proportions and performance
  const typeComparisonSummary = useMemo(() => {
    const map: Record<string, {
      type: string;
      count: number;
      totalInvested: number;
      totalCurrentValue: number;
      totalCapGain: number;
      totalProventos: number;
      totalReturnR$: number;
      sumPrecoMedio: number;
      sumCotacao: number;
    }> = {};

    analyticsData.activePositions.forEach(p => {
      const typeKey = p.type || 'Outros';
      const curPrice = p.currentPrice || p.avgPrice;
      const curVal = curPrice * p.quantity;
      const capGain = curVal - p.totalInvested;
      const prov = p.dividendsReceived || 0;

      if (!map[typeKey]) {
        map[typeKey] = {
          type: typeKey,
          count: 0,
          totalInvested: 0,
          totalCurrentValue: 0,
          totalCapGain: 0,
          totalProventos: 0,
          totalReturnR$: 0,
          sumPrecoMedio: 0,
          sumCotacao: 0,
        };
      }

      map[typeKey].count += 1;
      map[typeKey].totalInvested += p.totalInvested;
      map[typeKey].totalCurrentValue += curVal;
      map[typeKey].totalCapGain += capGain;
      map[typeKey].totalProventos += prov;
      map[typeKey].totalReturnR$ += (capGain + prov);
      map[typeKey].sumPrecoMedio += p.avgPrice;
      map[typeKey].sumCotacao += curPrice;
    });

    const grandTotalCurrent = Object.values(map).reduce((acc, curr) => acc + curr.totalCurrentValue, 0);

    return Object.values(map).map(item => {
      const capGainPct = item.totalInvested > 0 ? (item.totalCapGain / item.totalInvested) * 100 : 0;
      const totalReturnPct = item.totalInvested > 0 ? (item.totalReturnR$ / item.totalInvested) * 100 : 0;
      const weightPct = grandTotalCurrent > 0 ? (item.totalCurrentValue / grandTotalCurrent) * 100 : 0;
      const avgPrecoMedio = item.count > 0 ? item.sumPrecoMedio / item.count : 0;
      const avgCotacao = item.count > 0 ? item.sumCotacao / item.count : 0;
      const avgVariacaoPct = avgPrecoMedio > 0 ? ((avgCotacao - avgPrecoMedio) / avgPrecoMedio) * 100 : 0;

      return {
        ...item,
        capGainPct,
        totalReturnPct,
        weightPct,
        avgPrecoMedio,
        avgCotacao,
        avgVariacaoPct,
      };
    }).sort((a, b) => b.totalCurrentValue - a.totalCurrentValue);
  }, [analyticsData]);

  const availableAssetTypes = useMemo(() => {
    const types = new Set(priceComparisonData.map(p => p.type).filter(Boolean));
    return ['all', ...Array.from(types)];
  }, [priceComparisonData]);

  const filteredPriceComparisonData = useMemo(() => {
    if (perfTypeFilter === 'all') return priceComparisonData;
    return priceComparisonData.filter(p => p.type === perfTypeFilter);
  }, [priceComparisonData, perfTypeFilter]);

  // 8. VALUATION / PREÇO TETO CALCULATOR RESULTS
  const valuationResults = useMemo(() => {
    // 1. Bazin / Dividend Yield Desejado
    const bazinCeiling = bazinTargetYield > 0 ? (bazinDPA / (bazinTargetYield / 100)) : 0;
    const bazinMargin = calcCurrentPrice > 0 ? ((bazinCeiling - calcCurrentPrice) / calcCurrentPrice) * 100 : 0;

    // 2. Graham (Fórmula de Benjamin Graham)
    const grahamVal = 22.5 * grahamLPA * grahamVPA;
    const grahamCeiling = grahamVal > 0 ? Math.sqrt(grahamVal) : 0;
    const grahamMargin = calcCurrentPrice > 0 ? ((grahamCeiling - calcCurrentPrice) / calcCurrentPrice) * 100 : 0;

    // 3. Gordon (Modelo de Crescimento de Dividendos)
    const rateDiff = (gordonRequiredReturn - gordonGrowthRate) / 100;
    const gordonCeiling = rateDiff > 0 ? gordonD1 / rateDiff : 0;
    const gordonMargin = calcCurrentPrice > 0 ? ((gordonCeiling - calcCurrentPrice) / calcCurrentPrice) * 100 : 0;

    // 4. P/L Alvo (Ações)
    const plCeiling = grahamLPA * plTarget;
    const plMargin = calcCurrentPrice > 0 ? ((plCeiling - calcCurrentPrice) / calcCurrentPrice) * 100 : 0;

    // 5. P/VP Alvo (FIIs)
    const pvpCeiling = grahamVPA * pvpTarget;
    const pvpMargin = calcCurrentPrice > 0 ? ((pvpCeiling - calcCurrentPrice) / calcCurrentPrice) * 100 : 0;
    const pvpDiff = calcCurrentPrice > 0 && grahamVPA > 0 ? (calcCurrentPrice - grahamVPA) : 0;

    return {
      bazinCeiling,
      bazinMargin,
      grahamCeiling,
      grahamMargin,
      gordonCeiling,
      gordonMargin,
      plCeiling,
      plMargin,
      pvpCeiling,
      pvpMargin,
      pvpDiff
    };
  }, [calcCurrentPrice, bazinDPA, bazinTargetYield, grahamLPA, grahamVPA, gordonD1, gordonRequiredReturn, gordonGrowthRate, plTarget, pvpTarget]);

  // 9. COMPOUND INTEREST & SNOWBALL PROJECTION DATA
  const snowballSimulationData = useMemo(() => {
    const results = [];
    let currentPortfolio = analyticsData.totalCurrentPortfolio || 0;
    let totalInvested = analyticsData.totalInvestedPortfolio || 0;
    let cumulativeDividends = 0;

    const monthlyYieldRate = Math.pow(1 + (simAnnualYield / 100), 1 / 12) - 1;
    const monthlyGrowthRate = Math.pow(1 + (simAnnualGrowth / 100), 1 / 12) - 1;

    for (let year = 1; year <= simYears; year++) {
      let yearlyDividends = 0;
      for (let month = 1; month <= 12; month++) {
        totalInvested += simMonthlyContrib;
        currentPortfolio += simMonthlyContrib;

        const monthDiv = currentPortfolio * monthlyYieldRate;
        yearlyDividends += monthDiv;
        cumulativeDividends += monthDiv;

        // Reinvest dividends
        currentPortfolio += monthDiv;

        // Capital appreciation
        currentPortfolio *= (1 + monthlyGrowthRate);
      }

      const projectedMonthlyPassiveIncome = (currentPortfolio * (simAnnualYield / 100)) / 12;

      results.push({
        year: `Ano ${year}`,
        ano: year,
        totalInvested: Math.round(totalInvested),
        currentPortfolio: Math.round(currentPortfolio),
        cumulativeDividends: Math.round(cumulativeDividends),
        yearlyDividends: Math.round(yearlyDividends),
        monthlyPassiveIncome: Math.round(projectedMonthlyPassiveIncome)
      });
    }

    return results;
  }, [analyticsData.totalCurrentPortfolio, analyticsData.totalInvestedPortfolio, simMonthlyContrib, simAnnualYield, simAnnualGrowth, simYears]);

  // 10. CONCENTRATION RISK (HHI INDEX)
  const concentrationMetrics = useMemo(() => {
    const activePos = analyticsData.activePositions;
    const totalVal = analyticsData.totalCurrentPortfolio;

    if (totalVal <= 0 || activePos.length === 0) {
      return { hhi: 0, status: 'Sem Dados', color: 'text-muted-foreground', maxPos: null, maxSharePct: '0' };
    }

    let hhi = 0;
    let maxPos = activePos[0];

    activePos.forEach(p => {
      const sharePct = (p.currentValue / totalVal) * 100;
      hhi += Math.pow(sharePct, 2);
      if (p.currentValue > maxPos.currentValue) {
        maxPos = p;
      }
    });

    let status = 'Excelente Diversificação';
    let color = 'text-emerald-500';

    if (hhi >= 2500) {
      status = 'Alta Concentração';
      color = 'text-rose-500';
    } else if (hhi >= 1500) {
      status = 'Concentração Moderada';
      color = 'text-amber-500';
    }

    return {
      hhi: Math.round(hhi),
      status,
      color,
      maxPos,
      maxSharePct: ((maxPos.currentValue / totalVal) * 100).toFixed(1)
    };
  }, [analyticsData.activePositions, analyticsData.totalCurrentPortfolio]);

  // Helper function to render Status Badge for Valuation
  const renderValuationBadge = (ceilingPrice: number) => {
    if (ceilingPrice <= 0 || calcCurrentPrice <= 0) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
          Indefinido
        </span>
      );
    }

    const marginPct = ((ceilingPrice - calcCurrentPrice) / calcCurrentPrice) * 100;

    if (marginPct > 5) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Abaixo do Teto (Barato)
        </span>
      );
    } else if (marginPct >= -5) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> No Preço Justo
        </span>
      );
    } else {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> Acima do Teto (Caro)
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP METRICS CARDS (SUMMARY DASHBOARD AT THE VERY TOP) */}
      {!hideTopCards && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* TWR */}
          <div className="p-4 rounded-2xl bg-indigo-500/[0.04] border border-indigo-500/20 flex flex-col justify-between relative group shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                TWR (Retorno Temporal)
                <button
                  type="button"
                  onClick={() => setShowTooltipInfo(showTooltipInfo === 'twr' ? null : 'twr')}
                  className="text-muted-foreground/70 hover:text-indigo-500 transition-colors"
                >
                  <Info className="w-3 h-3" />
                </button>
              </span>
              <Percent className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-2">
              <p className={`text-xl font-black tracking-tight ${performanceMetrics.twrPercent >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`}>
                {formatPercent(performanceMetrics.twrPercent)}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                Crescimento real sem ruído de aportes.
              </p>
            </div>
            {showTooltipInfo === 'twr' && (
              <div className="absolute top-12 left-2 right-2 p-3 bg-card border border-border shadow-xl rounded-xl z-30 text-[11px] text-foreground leading-relaxed animate-in fade-in zoom-in-95">
                <strong>TWR (Time-Weighted Rate of Return):</strong> Desconsidera os valores e datas de aportes e resgates, medindo puramente a qualidade da alocação de ativos.
              </div>
            )}
          </div>

          {/* TIR / IRR (DINÂMICA) */}
          {(() => {
            const isLessThanYear = performanceMetrics.daysElapsed < 365;
            const effectiveMode = tirMode === 'dynamic' ? (isLessThanYear ? 'period' : 'annual') : tirMode;
            const activeTirVal = effectiveMode === 'period' ? performanceMetrics.tirPeriodPercent : performanceMetrics.tirAnnualPercent;

            return (
              <div className="p-4 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20 flex flex-col justify-between relative group shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    TIR / IRR {effectiveMode === 'period' ? '(Período)' : '(Anualizada)'}
                    <button
                      type="button"
                      onClick={() => setShowTooltipInfo(showTooltipInfo === 'tir' ? null : 'tir')}
                      className="text-muted-foreground/70 hover:text-emerald-500 transition-colors"
                    >
                      <Info className="w-3 h-3" />
                    </button>
                  </span>
                  <Award className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-2">
                  <p className={`text-xl font-black tracking-tight ${
                    (activeTirVal ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                  }`}>
                    {activeTirVal !== null 
                      ? `${formatPercent(activeTirVal)}${effectiveMode === 'period' ? '' : ' a.a.'}` 
                      : 'N/A'}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                    {effectiveMode === 'period' 
                      ? `Taxa no período (${performanceMetrics.daysElapsed}d)`
                      : `Anualizada (${performanceMetrics.yearsElapsed.toFixed(1)} anos)`}
                  </p>

                  {/* Quick Mode Toggle */}
                  <div className="flex items-center gap-1 mt-2 pt-1 border-t border-border/30">
                    <button
                      type="button"
                      onClick={() => setTirMode('dynamic')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                        tirMode === 'dynamic'
                          ? 'bg-emerald-500 text-white shadow-2xs'
                          : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                      }`}
                      title="Ajuste automático: Período se < 1 ano, Anualizado se ≥ 1 ano"
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      onClick={() => setTirMode('period')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                        tirMode === 'period'
                          ? 'bg-emerald-500 text-white shadow-2xs'
                          : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Período
                    </button>
                    <button
                      type="button"
                      onClick={() => setTirMode('annual')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                        tirMode === 'annual'
                          ? 'bg-emerald-500 text-white shadow-2xs'
                          : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Anual
                    </button>
                  </div>
                </div>
                {showTooltipInfo === 'tir' && (
                  <div className="absolute top-12 left-2 right-2 p-3 bg-card border border-border shadow-xl rounded-xl z-30 text-[11px] text-foreground leading-relaxed animate-in fade-in zoom-in-95">
                    <strong>TIR Dinâmica (XIRR):</strong>
                    <p className="mt-1 text-[10.5px]">
                      Calcula a Taxa Interna de Retorno considerando o tempo exato dos aportes. Para carteiras recentes (&lt; 1 ano), exibe o retorno real acumulado no período de {performanceMetrics.daysElapsed} dias para evitar distorções de anualização.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Capital Gain */}
          <div className="p-4 rounded-2xl bg-sky-500/[0.04] border border-sky-500/20 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Ganho de Capital
              </span>
              <TrendingUp className="w-4 h-4 text-sky-500" />
            </div>
            <div className="mt-2">
              <p className={`text-xl font-black tracking-tight ${analyticsData.capitalGain >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-500'}`}>
                {formatCurrency(analyticsData.capitalGain)}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                {formatPercent(analyticsData.capitalGainPercent)} sobre o valor investido.
              </p>
            </div>
          </div>

          {/* Yield on Cost */}
          <div className="p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Yield on Cost (YoC)
              </span>
              <DollarSign className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2">
              <p className="text-xl font-black tracking-tight text-amber-600 dark:text-amber-400">
                {formatPercent(analyticsData.yieldOnCost)}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                {formatCurrency(analyticsData.totalDividendsConsidered)} em proventos {isProvisionedIncluded ? '(c/ provisionados)' : '(recebidos)'}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PROVISIONED DIVIDENDS INCLUSION TOGGLE BANNER */}
      {!hideTopCards && analyticsData.totalDividendsProvisioned > 0 && (
        <div className="p-3.5 rounded-2xl border border-border/50 bg-card shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                Proventos Provisionados Anunciados: <strong className="text-amber-500">{formatCurrency(analyticsData.totalDividendsProvisioned)}</strong>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isProvisionedIncluded 
                  ? 'As métricas de retorno e Yield on Cost estão considerando os proventos futuros já anunciados.'
                  : 'As métricas estão considerando apenas proventos já efetivados e creditados em conta.'}
              </p>
            </div>
          </div>

          <div className="flex items-center p-1 bg-muted/50 rounded-xl border border-border/50 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleToggleProvisioned(false)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                !isProvisionedIncluded
                  ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-border/60 font-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Apenas Recebidos</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleProvisioned(true)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                isProvisionedIncluded
                  ? 'bg-card text-amber-500 shadow-xs border border-border/60 font-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Incluir Provisionados</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. SUB-TAB BUTTONS LIST PLACED DIRECTLY ABOVE DYNAMIC CONTENT */}
      {!hideSubTabButtons && (
        <div className="flex p-1.5 bg-muted/40 rounded-2xl border border-border/40 w-full overflow-x-auto scrollbar-none gap-1">
          <button
            onClick={() => handleSubTabChange('geral')}
            className={`flex-1 min-w-[120px] px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeSubTab === 'geral' 
                ? 'bg-card text-foreground shadow-xs border border-border/50' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Geral & Visão
          </button>

          <button
            onClick={() => handleSubTabChange('alocacao')}
            className={`flex-1 min-w-[120px] px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeSubTab === 'alocacao' 
                ? 'bg-card text-foreground shadow-xs border border-border/50' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5 text-indigo-500" />
            Alocação
          </button>

          <button
            onClick={() => handleSubTabChange('preco_teto')}
            className={`flex-1 min-w-[140px] px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeSubTab === 'preco_teto' 
                ? 'bg-primary text-primary-foreground shadow-xs' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            Preço Teto & Valuation
          </button>
        </div>
      )}

      {/* 3. DYNAMIC SUB-TAB CONTENTS */}

      {/* SUB TAB 1: GERAL & VISÃO */}
      {activeSubTab === 'geral' && (
        <div className="space-y-6">
          {/* Timeline Chart */}
          <div className="p-5 rounded-3xl border border-border/50 bg-card shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Evolução do Capital Investido</h3>
                <p className="text-xs text-muted-foreground">Histórico de aportes acumulados na carteira</p>
              </div>
            </div>

            {timelineData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorInvestido" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => hideValues ? '••••' : `R$ ${val}`} />
                    <Tooltip 
                      formatter={(val: any) => [formatCurrency(Number(val)), 'Investido']}
                      labelStyle={{ fontWeight: 'bold' }}
                      contentStyle={{ borderRadius: '12px', borderColor: 'rgba(255,255,255,0.1)' }}
                    />
                    <Area type="monotone" dataKey="investido" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorInvestido)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border/50 rounded-2xl">
                Nenhuma movimentação registrada para gerar gráfico histórico.
              </div>
            )}
          </div>

          {/* COMPARATIVO DE PROPORÇÕES E DESEMPENHO POR CLASSE DE ATIVO */}
          {typeComparisonSummary.length > 0 && (
            <div className="p-5 rounded-3xl border border-border/50 bg-card shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                <div>
                  <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
                    <span>Comparativo de Proporções por Classe de Ativo</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      Normalizado por Categoria
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Desempenho agregado, peso na carteira e médias unitárias entre os tipos de ativos
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {typeComparisonSummary.map((item) => (
                  <div
                    key={item.type}
                    onClick={() => setPerfTypeFilter(perfTypeFilter === item.type ? 'all' : item.type)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      perfTypeFilter === item.type
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/40 bg-muted/20 hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary"></span>
                        {item.type}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                        {item.count} {item.count === 1 ? 'ativo' : 'ativos'}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs font-sans">
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Peso na Carteira:</span>
                        <strong className="text-foreground font-mono">{formatPercent(item.weightPct)}</strong>
                      </div>

                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Valor Investido:</span>
                        <strong className="text-foreground font-mono">{formatCurrency(item.totalInvested)}</strong>
                      </div>

                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Média Preço Médio:</span>
                        <span className="font-mono text-foreground">{formatCurrency(item.avgPrecoMedio)}</span>
                      </div>

                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Média Cotação:</span>
                        <span className="font-mono text-foreground">{formatCurrency(item.avgCotacao)}</span>
                      </div>

                      <div className="pt-2 border-t border-border/30 flex justify-between items-center">
                        <span className="text-muted-foreground">Retorno Total:</span>
                        <span
                          className={`font-mono font-bold ${
                            item.totalReturnPct >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {formatPercent(item.totalReturnPct)} ({formatCurrency(item.totalReturnR$)})
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GRÁFICO PRINCIPAL DE COMPARATIVO COM FILTROS E MODO DE ESCALA */}
          <div className="p-5 rounded-3xl border border-border/50 bg-card shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Comparativo: Preço Médio vs Cotação Atual</h3>
                <p className="text-xs text-muted-foreground">
                  {priceChartMode === 'percent' && 'Variação percentual do Preço Atual em relação ao seu Preço Médio'}
                  {priceChartMode === 'totalReturn' && 'Retorno Total combinado (Ganho de Capital + Proventos Recebidos) por ativo'}
                  {priceChartMode === 'base100' && 'Reescalado com Preço Médio = 100 para comparar ativos de qualquer magnitude de valor'}
                  {priceChartMode === 'absolute' && 'Valores nominais em reais (R$) por cota'}
                </p>
              </div>

              {/* CONTROLES DE MODO DE GRÁFICO */}
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40 text-xs shrink-0 self-start lg:self-auto flex-wrap">
                <button
                  onClick={() => setPriceChartMode('percent')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    priceChartMode === 'percent'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Variação %
                </button>
                <button
                  onClick={() => setPriceChartMode('totalReturn')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    priceChartMode === 'totalReturn'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Retorno Total
                </button>
                <button
                  onClick={() => setPriceChartMode('base100')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    priceChartMode === 'base100'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Base 100
                </button>
                <button
                  onClick={() => setPriceChartMode('absolute')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    priceChartMode === 'absolute'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Valores (R$)
                </button>
              </div>
            </div>

            {/* SELETOR DE FILTRO POR TIPO DE ATIVO */}
            {availableAssetTypes.length > 2 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/30">
                <span className="text-[11px] font-semibold text-muted-foreground mr-1">Filtrar Categoria:</span>
                {availableAssetTypes.map((typeKey) => (
                  <button
                    key={typeKey}
                    onClick={() => setPerfTypeFilter(typeKey)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
                      perfTypeFilter === typeKey
                        ? 'bg-primary text-primary-foreground shadow-2xs font-bold'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {typeKey === 'all' ? 'Todos os Tipos' : typeKey}
                  </button>
                ))}
              </div>
            )}

            {/* NOTA EXPLICATIVA SOBRE PROPORÇÃO */}
            {priceChartMode === 'absolute' && availableAssetTypes.length > 2 && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <span>💡</span>
                <span>
                  <strong>Dica de Proporção:</strong> Ativos com cotações nominais distantes (ex: Ações a R$ 10 e FIIs a R$ 100) podem parecer desproporcionais em valores brutos. Experimente alternar para <strong>Base 100</strong> ou <strong>Variação %</strong> para comparar no mesmo patamar.
                </span>
              </div>
            )}

            {filteredPriceComparisonData.length > 0 ? (
              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  {priceChartMode === 'percent' ? (
                    <BarChart
                      data={filteredPriceComparisonData}
                      margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
                      barCategoryGap="18%"
                      barGap={4}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="ticker" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(val) => (hideValues ? '•••%' : `${val > 0 ? '+' : ''}${val}%`)}
                      />
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-3 rounded-2xl shadow-xl text-xs space-y-1.5 font-sans z-50">
                              <div className="font-black text-foreground text-sm border-b border-border/40 pb-1 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-1.5">
                                  <span>{data.ticker}</span>
                                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    {data.type}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    data.variacaoPct >= 0
                                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                  }`}
                                >
                                  {formatPercent(data.variacaoPct)}
                                </span>
                              </div>
                              <div className="space-y-1 font-mono pt-0.5">
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Cotação Atual:</span>
                                  <strong className="text-foreground">{formatCurrency(data.cotacao)}</strong>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Preço Médio:</span>
                                  <strong className="text-foreground">{formatCurrency(data.precoMedio)}</strong>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Diferença / Cota:</span>
                                  <strong className={data.diffR >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                    {data.diffR >= 0 ? '+' : ''}
                                    {formatCurrency(data.diffR)}
                                  </strong>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                      <Bar dataKey="variacaoPct" name="Variação (%)" maxBarSize={44} radius={[6, 6, 0, 0]}>
                        {filteredPriceComparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.variacaoPct >= 0 ? '#10b981' : '#f43f5e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : priceChartMode === 'totalReturn' ? (
                    <BarChart
                      data={filteredPriceComparisonData}
                      margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
                      barCategoryGap="18%"
                      barGap={4}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="ticker" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(val) => (hideValues ? '•••%' : `${val > 0 ? '+' : ''}${val}%`)}
                      />
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-3 rounded-2xl shadow-xl text-xs space-y-1.5 font-sans z-50">
                              <div className="font-black text-foreground text-sm border-b border-border/40 pb-1 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-1.5">
                                  <span>{data.ticker}</span>
                                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    {data.type}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    data.retornoTotalPct >= 0
                                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                  }`}
                                >
                                  {formatPercent(data.retornoTotalPct)}
                                </span>
                              </div>
                              <div className="space-y-1 font-mono pt-0.5">
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Retorno Total:</span>
                                  <strong className={data.retornoTotalR$ >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                    {data.retornoTotalR$ >= 0 ? '+' : ''}
                                    {formatCurrency(data.retornoTotalR$)}
                                  </strong>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Ganho de Capital:</span>
                                  <strong className={data.capGainR$ >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                    {data.capGainR$ >= 0 ? '+' : ''}
                                    {formatCurrency(data.capGainR$)} ({formatPercent(data.variacaoPct)})
                                  </strong>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Proventos Recebidos:</span>
                                  <strong className="text-amber-500">{formatCurrency(data.proventosR$)}</strong>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground border-t border-border/30 pt-1 mt-1 text-[10px]">
                                  <span>Total Investido:</span>
                                  <span className="text-foreground">{formatCurrency(data.totalInvested)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                      <Bar dataKey="retornoTotalPct" name="Retorno Total (%)" maxBarSize={44} radius={[6, 6, 0, 0]}>
                        {filteredPriceComparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.retornoTotalPct >= 0 ? '#10b981' : '#f43f5e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : priceChartMode === 'base100' ? (
                    <BarChart
                      data={filteredPriceComparisonData}
                      margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
                      barCategoryGap="18%"
                      barGap={4}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="ticker" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => (hideValues ? '••••' : `${val}`)} />
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-3 rounded-2xl shadow-xl text-xs space-y-1.5 font-sans z-50">
                              <div className="font-black text-foreground text-sm border-b border-border/40 pb-1 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-1.5">
                                  <span>{data.ticker}</span>
                                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    {data.type}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    data.variacaoPct >= 0
                                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                  }`}
                                >
                                  {formatPercent(data.variacaoPct)}
                                </span>
                              </div>
                              <div className="space-y-1 font-mono pt-0.5">
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Cotação Base 100:</span>
                                  <strong className="text-foreground">
                                    {data.cotacaoBase100} ({formatCurrency(data.cotacao)})
                                  </strong>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Preço Médio (100):</span>
                                  <strong className="text-foreground">
                                    100.0 ({formatCurrency(data.precoMedio)})
                                  </strong>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <ReferenceLine y={100} stroke="#8b5cf6" strokeDasharray="3 3" />
                      <Bar
                        dataKey="pmBase100"
                        name="Preço Médio (Base 100)"
                        fill="#8b5cf6"
                        maxBarSize={32}
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="cotacaoBase100"
                        name="Cotação (Base 100)"
                        fill="#06b6d4"
                        maxBarSize={32}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  ) : (
                    <BarChart
                      data={filteredPriceComparisonData}
                      margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
                      barCategoryGap="18%"
                      barGap={4}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="ticker" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(val) => (hideValues ? '••••' : `R$ ${val}`)}
                      />
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-3 rounded-2xl shadow-xl text-xs space-y-1.5 font-sans z-50">
                              <div className="font-black text-foreground text-sm border-b border-border/40 pb-1 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-1.5">
                                  <span>{data.ticker}</span>
                                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    {data.type}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    data.variacaoPct >= 0
                                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                  }`}
                                >
                                  {formatPercent(data.variacaoPct)}
                                </span>
                              </div>
                              <div className="space-y-1 font-mono pt-0.5">
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Cotação Atual:</span>
                                  <strong className="text-foreground">{formatCurrency(data.cotacao)}</strong>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Preço Médio:</span>
                                  <strong className="text-foreground">{formatCurrency(data.precoMedio)}</strong>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar
                        dataKey="precoMedio"
                        name="Preço Médio (R$)"
                        fill="#8b5cf6"
                        maxBarSize={32}
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="cotacao"
                        name="Cotação Atual (R$)"
                        fill="#06b6d4"
                        maxBarSize={32}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/50 rounded-2xl">
                Nenhum ativo encontrado para o tipo selecionado.
              </div>
            )}
          </div>

          {/* MATRIZ COMPLETA DE PERFORMANCE POR ATIVO */}
          <div className="p-5 rounded-3xl border border-border/50 bg-card shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold tracking-tight">Matriz Completa de Performance por Ativo</h3>
              <p className="text-xs text-muted-foreground">Acompanhamento detalhado de ganho de capital, proventos e retorno total</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border/50">
                  <tr>
                    <th className="sticky left-0 z-20 bg-card border-r border-border/40 px-3 py-2.5 font-semibold shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Ativo</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Qtd</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Preço Médio</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Cotação</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Valor Atual</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Ganho Capital</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Proventos</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Retorno Total</th>
                    <th className="px-3 py-2.5 font-semibold text-right">% Carteira</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {analyticsData.activePositions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        Nenhum ativo na carteira.
                      </td>
                    </tr>
                  ) : (
                    analyticsData.activePositions.map(p => {
                      const capGain = (p.currentValue || p.totalInvested) - p.totalInvested;
                      const capGainPercent = p.totalInvested > 0 ? (capGain / p.totalInvested) * 100 : 0;
                      const totalRet = capGain + p.dividendsReceived;
                      const totalReturnPercent = p.totalInvested > 0 ? (totalRet / p.totalInvested) * 100 : 0;
                      const sharePct = analyticsData.totalCurrentPortfolio > 0 
                        ? (p.currentValue / analyticsData.totalCurrentPortfolio) * 100 
                        : 0;

                      return (
                        <tr 
                          key={p.ticker} 
                          onClick={() => {
                            setSelectedTicker(p.ticker);
                            handleSubTabChange('preco_teto');
                          }}
                          className="hover:bg-muted/40 transition-colors cursor-pointer group"
                          title={`Clique para ver Preço Teto & Valuation de ${p.ticker}`}
                        >
                          <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/80 border-r border-border/40 px-3 py-3 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">{p.ticker}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground uppercase font-bold">
                                {p.type}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-mono">{p.quantity}</td>
                          <td className="px-3 py-3 text-right font-mono">{formatCurrency(p.avgPrice)}</td>
                          <td className="px-3 py-3 text-right font-mono font-semibold">
                            {p.currentPrice ? formatCurrency(p.currentPrice) : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold">{formatCurrency(p.currentValue)}</td>
                          <td className={`px-3 py-3 text-right font-mono font-bold ${capGain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            <div>{formatCurrency(capGain)}</div>
                            <div className="text-[10px] font-semibold opacity-85">{formatPercent(capGainPercent)}</div>
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-semibold text-amber-500">
                            {formatCurrency(p.dividendsReceived)}
                          </td>
                          <td className={`px-3 py-3 text-right font-mono font-bold ${totalRet >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            <div>{formatCurrency(totalRet)}</div>
                            <div className="text-[10px] font-semibold opacity-85">{formatPercent(totalReturnPercent)}</div>
                          </td>
                          <td className="px-3 py-3 text-right font-mono">{sharePct.toFixed(1)}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: ALOCAÇÃO */}
      {activeSubTab === 'alocacao' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-3xl border border-border/50 bg-card shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-primary" />
                Alocação por Classe de Ativo
              </h3>
              <p className="text-xs text-muted-foreground">Distribuição percentual da carteira por categoria</p>
            </div>

            {allocationData.byCategory.length > 0 ? (
              <div className="space-y-4">
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData.byCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {allocationData.byCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Valor']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                  {allocationData.byCategory.map(c => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }}></span>
                        <span className="font-semibold text-foreground">{c.name}</span>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <span className="text-muted-foreground font-medium">{formatCurrency(c.value)}</span>
                        <span className="font-bold text-foreground w-12 text-right">{c.percent.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border/50 rounded-2xl">
                Sem posições ativas para exibir alocação.
              </div>
            )}
          </div>

          <div className="p-5 rounded-3xl border border-border/50 bg-card shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                Concentração por Ativo (Top 7)
              </h3>
              <p className="text-xs text-muted-foreground">Maiores posições na carteira</p>
            </div>

            {allocationData.topTickers.length > 0 ? (
              <div className="space-y-3">
                {allocationData.topTickers.map(t => (
                  <div key={t.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: t.color }}></span>
                        {t.name}
                      </span>
                      <span className="text-muted-foreground">
                        {formatCurrency(t.value)} ({t.percent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, t.percent)}%`, backgroundColor: t.color }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border/50 rounded-2xl">
                Sem posições ativas para exibir concentração.
              </div>
            )}
          </div>
        </div>
      )}

      {/* DELETED PERFORMANCE SUB TAB */}
      {false && (
        <div className="space-y-6">
          {/* COMPARATIVO DE PROPORÇÕES E DESEMPENHO POR CLASSE DE ATIVO */}
          {typeComparisonSummary.length > 0 && (
            <div className="p-5 rounded-3xl border border-border/50 bg-card shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                <div>
                  <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
                    <span>Comparativo de Proporções por Classe de Ativo</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      Normalizado por Categoria
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Desempenho agregado, peso na carteira e médias unitárias entre os tipos de ativos
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {typeComparisonSummary.map((item) => (
                  <div
                    key={item.type}
                    onClick={() => setPerfTypeFilter(perfTypeFilter === item.type ? 'all' : item.type)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      perfTypeFilter === item.type
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/40 bg-muted/20 hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary"></span>
                        {item.type}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                        {item.count} {item.count === 1 ? 'ativo' : 'ativos'}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs font-sans">
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Peso na Carteira:</span>
                        <strong className="text-foreground font-mono">{formatPercent(item.weightPct)}</strong>
                      </div>

                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Valor Investido:</span>
                        <strong className="text-foreground font-mono">{formatCurrency(item.totalInvested)}</strong>
                      </div>

                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Média Preço Médio:</span>
                        <span className="font-mono text-foreground">{formatCurrency(item.avgPrecoMedio)}</span>
                      </div>

                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Média Cotação:</span>
                        <span className="font-mono text-foreground">{formatCurrency(item.avgCotacao)}</span>
                      </div>

                      <div className="pt-2 border-t border-border/30 flex justify-between items-center">
                        <span className="text-muted-foreground">Retorno Total:</span>
                        <span
                          className={`font-mono font-bold ${
                            item.totalReturnPct >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {formatPercent(item.totalReturnPct)} ({formatCurrency(item.totalReturnR$)})
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GRÁFICO PRINCIPAL DE COMPARATIVO COM FILTROS E MODO DE ESCALA */}
          <div className="p-5 rounded-3xl border border-border/50 bg-card shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Comparativo: Preço Médio vs Cotação Atual</h3>
                <p className="text-xs text-muted-foreground">
                  {priceChartMode === 'percent' && 'Variação percentual do Preço Atual em relação ao seu Preço Médio'}
                  {priceChartMode === 'totalReturn' && 'Retorno Total combinado (Ganho de Capital + Proventos Recebidos) por ativo'}
                  {priceChartMode === 'base100' && 'Reescalado com Preço Médio = 100 para comparar ativos de qualquer magnitude de valor'}
                  {priceChartMode === 'absolute' && 'Valores nominais em reais (R$) por cota'}
                </p>
              </div>

              {/* CONTROLES DE MODO DE GRÁFICO */}
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40 text-xs shrink-0 self-start lg:self-auto flex-wrap">
                <button
                  onClick={() => setPriceChartMode('percent')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    priceChartMode === 'percent'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Variação %
                </button>
                <button
                  onClick={() => setPriceChartMode('totalReturn')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    priceChartMode === 'totalReturn'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Retorno Total
                </button>
                <button
                  onClick={() => setPriceChartMode('base100')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    priceChartMode === 'base100'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Base 100
                </button>
                <button
                  onClick={() => setPriceChartMode('absolute')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    priceChartMode === 'absolute'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Valores (R$)
                </button>
              </div>
            </div>

            {/* SELETOR DE FILTRO POR TIPO DE ATIVO */}
            {availableAssetTypes.length > 2 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/30">
                <span className="text-[11px] font-semibold text-muted-foreground mr-1">Filtrar Categoria:</span>
                {availableAssetTypes.map((typeKey) => (
                  <button
                    key={typeKey}
                    onClick={() => setPerfTypeFilter(typeKey)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
                      perfTypeFilter === typeKey
                        ? 'bg-primary text-primary-foreground shadow-2xs font-bold'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {typeKey === 'all' ? 'Todos os Tipos' : typeKey}
                  </button>
                ))}
              </div>
            )}

            {/* NOTA EXPLICATIVA SOBRE PROPORÇÃO */}
            {priceChartMode === 'absolute' && availableAssetTypes.length > 2 && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <span>💡</span>
                <span>
                  <strong>Dica de Proporção:</strong> Ativos com cotações nominais distantes (ex: Ações a R$ 10 e FIIs a R$ 100) podem parecer desproporcionais em valores brutos. Experimente alternar para <strong>Base 100</strong> ou <strong>Variação %</strong> para comparar no mesmo patamar.
                </span>
              </div>
            )}

            {filteredPriceComparisonData.length > 0 ? (
              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  {priceChartMode === 'percent' ? (
                    <BarChart
                      data={filteredPriceComparisonData}
                      margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
                      barCategoryGap="18%"
                      barGap={4}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="ticker" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(val) => (hideValues ? '•••%' : `${val > 0 ? '+' : ''}${val}%`)}
                      />
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-3 rounded-2xl shadow-xl text-xs space-y-1.5 font-sans z-50">
                              <div className="font-black text-foreground text-sm border-b border-border/40 pb-1 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-1.5">
                                  <span>{data.ticker}</span>
                                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    {data.type}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    data.variacaoPct >= 0
                                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                  }`}
                                >
                                  {formatPercent(data.variacaoPct)}
                                </span>
                              </div>
                              <div className="space-y-1 font-mono pt-0.5">
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Cotação Atual:</span>
                                  <strong className="text-foreground">{formatCurrency(data.cotacao)}</strong>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Preço Médio:</span>
                                  <strong className="text-foreground">{formatCurrency(data.precoMedio)}</strong>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Diferença / Cota:</span>
                                  <strong className={data.diffR >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                    {data.diffR >= 0 ? '+' : ''}
                                    {formatCurrency(data.diffR)}
                                  </strong>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                      <Bar dataKey="variacaoPct" name="Variação (%)" maxBarSize={44} radius={[6, 6, 0, 0]}>
                        {filteredPriceComparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.variacaoPct >= 0 ? '#10b981' : '#f43f5e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : priceChartMode === 'totalReturn' ? (
                    <BarChart
                      data={filteredPriceComparisonData}
                      margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
                      barCategoryGap="18%"
                      barGap={4}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="ticker" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(val) => (hideValues ? '•••%' : `${val > 0 ? '+' : ''}${val}%`)}
                      />
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-3 rounded-2xl shadow-xl text-xs space-y-1.5 font-sans z-50">
                              <div className="font-black text-foreground text-sm border-b border-border/40 pb-1 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-1.5">
                                  <span>{data.ticker}</span>
                                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    {data.type}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    data.retornoTotalPct >= 0
                                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                  }`}
                                >
                                  {formatPercent(data.retornoTotalPct)}
                                </span>
                              </div>
                              <div className="space-y-1 font-mono pt-0.5">
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Retorno Total:</span>
                                  <strong className={data.retornoTotalR$ >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                    {data.retornoTotalR$ >= 0 ? '+' : ''}
                                    {formatCurrency(data.retornoTotalR$)}
                                  </strong>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Ganho de Capital:</span>
                                  <strong className={data.capGainR$ >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                    {data.capGainR$ >= 0 ? '+' : ''}
                                    {formatCurrency(data.capGainR$)} ({formatPercent(data.variacaoPct)})
                                  </strong>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Proventos Recebidos:</span>
                                  <strong className="text-amber-500">{formatCurrency(data.proventosR$)}</strong>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground border-t border-border/30 pt-1 mt-1 text-[10px]">
                                  <span>Total Investido:</span>
                                  <span className="text-foreground">{formatCurrency(data.totalInvested)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                      <Bar dataKey="retornoTotalPct" name="Retorno Total (%)" maxBarSize={44} radius={[6, 6, 0, 0]}>
                        {filteredPriceComparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.retornoTotalPct >= 0 ? '#10b981' : '#f43f5e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : priceChartMode === 'base100' ? (
                    <BarChart
                      data={filteredPriceComparisonData}
                      margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
                      barCategoryGap="18%"
                      barGap={4}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="ticker" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => (hideValues ? '••••' : `${val}`)} />
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-3 rounded-2xl shadow-xl text-xs space-y-1.5 font-sans z-50">
                              <div className="font-black text-foreground text-sm border-b border-border/40 pb-1 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-1.5">
                                  <span>{data.ticker}</span>
                                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    {data.type}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    data.variacaoPct >= 0
                                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                  }`}
                                >
                                  {formatPercent(data.variacaoPct)}
                                </span>
                              </div>
                              <div className="space-y-1 font-mono pt-0.5">
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Cotação Base 100:</span>
                                  <strong className="text-foreground">
                                    {data.cotacaoBase100} ({formatCurrency(data.cotacao)})
                                  </strong>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Preço Médio (100):</span>
                                  <strong className="text-foreground">
                                    100.0 ({formatCurrency(data.precoMedio)})
                                  </strong>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <ReferenceLine y={100} stroke="#8b5cf6" strokeDasharray="3 3" />
                      <Bar
                        dataKey="pmBase100"
                        name="Preço Médio (Base 100)"
                        fill="#8b5cf6"
                        maxBarSize={32}
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="cotacaoBase100"
                        name="Cotação (Base 100)"
                        fill="#06b6d4"
                        maxBarSize={32}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  ) : (
                    <BarChart
                      data={filteredPriceComparisonData}
                      margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
                      barCategoryGap="18%"
                      barGap={4}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="ticker" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(val) => (hideValues ? '••••' : `R$ ${val}`)}
                      />
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-3 rounded-2xl shadow-xl text-xs space-y-1.5 font-sans z-50">
                              <div className="font-black text-foreground text-sm border-b border-border/40 pb-1 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-1.5">
                                  <span>{data.ticker}</span>
                                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    {data.type}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    data.variacaoPct >= 0
                                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                  }`}
                                >
                                  {formatPercent(data.variacaoPct)}
                                </span>
                              </div>
                              <div className="space-y-1 font-mono pt-0.5">
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Cotação Atual:</span>
                                  <strong className="text-foreground">{formatCurrency(data.cotacao)}</strong>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>Preço Médio:</span>
                                  <strong className="text-foreground">{formatCurrency(data.precoMedio)}</strong>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar
                        dataKey="precoMedio"
                        name="Preço Médio (R$)"
                        fill="#8b5cf6"
                        maxBarSize={32}
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="cotacao"
                        name="Cotação Atual (R$)"
                        fill="#06b6d4"
                        maxBarSize={32}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/50 rounded-2xl">
                Nenhum ativo encontrado para o tipo selecionado.
              </div>
            )}
          </div>

          <div className="p-5 rounded-3xl border border-border/50 bg-card shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold tracking-tight">Matriz Completa de Performance por Ativo</h3>
              <p className="text-xs text-muted-foreground">Acompanhamento detalhado de ganho de capital, proventos e retorno total</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border/50">
                  <tr>
                    <th className="sticky left-0 z-20 bg-card border-r border-border/40 px-3 py-2.5 font-semibold shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Ativo</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Qtd</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Preço Médio</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Cotação</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Valor Atual</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Ganho Capital</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Proventos</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Retorno Total</th>
                    <th className="px-3 py-2.5 font-semibold text-right">% Carteira</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {analyticsData.activePositions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        Nenhum ativo na carteira.
                      </td>
                    </tr>
                  ) : (
                    analyticsData.activePositions.map(p => {
                      const capGain = (p.currentValue || p.totalInvested) - p.totalInvested;
                      const capGainPercent = p.totalInvested > 0 ? (capGain / p.totalInvested) * 100 : 0;
                      const totalRet = capGain + p.dividendsReceived;
                      const totalReturnPercent = p.totalInvested > 0 ? (totalRet / p.totalInvested) * 100 : 0;
                      const sharePct = analyticsData.totalCurrentPortfolio > 0 
                        ? (p.currentValue / analyticsData.totalCurrentPortfolio) * 100 
                        : 0;

                      return (
                        <tr 
                          key={p.ticker} 
                          onClick={() => {
                            setSelectedTicker(p.ticker);
                            handleSubTabChange('preco_teto');
                          }}
                          className="hover:bg-muted/40 transition-colors cursor-pointer group"
                          title={`Clique para ver Preço Teto & Valuation de ${p.ticker}`}
                        >
                          <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/80 border-r border-border/40 px-3 py-3 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">{p.ticker}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground uppercase font-bold">
                                {p.type}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-mono">{p.quantity}</td>
                          <td className="px-3 py-3 text-right font-mono">{formatCurrency(p.avgPrice)}</td>
                          <td className="px-3 py-3 text-right font-mono font-semibold">
                            {p.currentPrice ? formatCurrency(p.currentPrice) : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold">{formatCurrency(p.currentValue)}</td>
                          <td className={`px-3 py-3 text-right font-mono font-bold ${capGain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            <div>{formatCurrency(capGain)}</div>
                            <div className="text-[10px] font-semibold opacity-85">{formatPercent(capGainPercent)}</div>
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-semibold text-amber-500">
                            {formatCurrency(p.dividendsReceived)}
                          </td>
                          <td className={`px-3 py-3 text-right font-mono font-bold ${totalRet >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            <div>{formatCurrency(totalRet)}</div>
                            <div className="text-[10px] font-semibold opacity-85">{formatPercent(totalReturnPercent)}</div>
                          </td>
                          <td className="px-3 py-3 text-right font-mono">{sharePct.toFixed(1)}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 5: PREÇO TETO & VALUATION (COMPACT & VISUAL PERSISTENCE STATUS) */}
      {activeSubTab === 'preco_teto' && (
        <div className="space-y-4">
          {/* TOP COMPACT CONTROL TOOLBAR */}
          <div className="p-4 rounded-2xl border border-primary/20 bg-card shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black tracking-tight text-foreground">
                      Calculadora de Preço Teto & Valuation
                    </h3>

                    {/* VISUAL STATUS BADGE FOR ACTIVE TICKER PERSISTENCE */}
                    {isTargetSaved ? (
                      hasUnsavedChanges ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1 animate-pulse" title="Existe valuation salvo para este ativo, mas você fez alterações não salvas">
                          <Clock className="w-3 h-3 text-amber-500" />
                          Alterações Pendentes
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1" title="Os dados exibidos correspondem exatamente ao valuation salvo no banco/cache">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Valuation Salvo
                        </span>
                      )
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border/60 flex items-center gap-1" title="Nenhum valuation salvo ainda para este ticker">
                        <AlertCircle className="w-3 h-3 text-muted-foreground" />
                        Não Salvo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Calcule o preço justo de entrada. Salve parâmetros personalizados para cada ativo.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <CvmDocumentButton ticker={selectedTicker} variant="badge" />
                <button
                  onClick={handleSaveValuation}
                  disabled={isSavingValuation}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50 ${
                    hasUnsavedChanges
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingValuation ? 'Salvando...' : (hasUnsavedChanges ? 'Salvar Alterações' : 'Salvar Valuation')}
                </button>
              </div>
            </div>

            {/* COMPACT INPUTS ROW */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Ticker Input */}
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase px-1">Ticker:</span>
                  <input
                    type="text"
                    value={selectedTicker}
                    onChange={(e) => setSelectedTicker(e.target.value.toUpperCase())}
                    placeholder="PETR4"
                    className="w-20 font-black text-xs px-2 py-0.5 rounded-lg border border-border bg-card text-foreground text-center uppercase focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Asset Type Selector */}
                <div className="flex p-0.5 bg-muted/40 rounded-xl border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setAssetType('Ação')}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-all flex items-center gap-1 text-[11px] ${
                      assetType === 'Ação' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'
                    }`}
                  >
                    <Coins className="w-3 h-3 text-blue-500" /> Ação
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetType('FII')}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-all flex items-center gap-1 text-[11px] ${
                      assetType === 'FII' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'
                    }`}
                  >
                    <Building2 className="w-3 h-3 text-emerald-500" /> FII
                  </button>
                </div>

                {/* Cotação Atual */}
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase px-1">Cotação:</span>
                  <div className="w-24">
                    <NumericInput
                      value={calcCurrentPrice}
                      onChange={setCalcCurrentPrice}
                      prefix="R$"
                      className="w-full pr-1.5 py-0.5 text-xs font-black rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-right"
                    />
                  </div>
                  {(() => {
                    const tk = selectedTicker.toUpperCase().trim();
                    const liveQ = quotes[tk] || analyticsData.activePositions.find(p => p.ticker === tk)?.currentPrice;
                    if (liveQ && liveQ > 0) {
                      return (
                        <button
                          type="button"
                          onClick={() => setCalcCurrentPrice(liveQ)}
                          className="p-1 text-muted-foreground hover:text-primary hover:bg-muted rounded transition-colors"
                          title={`Atualizar para Cotação de Mercado (R$ ${liveQ.toFixed(2)})`}
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Quick Portfolio Chips with Saved Status */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 max-w-full">
                <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">Carteira:</span>
                {portfolioTickers.map(tk => {
                  const isTkSaved = !!savedValuations[tk];
                  const isSelected = selectedTicker === tk;
                  return (
                    <button
                      key={tk}
                      onClick={() => handleSelectCalculatorTicker(tk)}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1 whitespace-nowrap ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                          : 'bg-card text-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {tk}
                      {isTkSaved && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} title="Valuation Salvo"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* VALUATION METHODS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">

            {/* METHOD 1: DÉCIO BAZIN */}
            <div className="p-3.5 rounded-2xl border border-border bg-card shadow-xs space-y-2.5 relative">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-foreground">1. Décio Bazin (Yield Desejado)</h4>
                  <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Ações / FIIs
                  </span>
                </div>
                {renderValuationBadge(valuationResults.bazinCeiling)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                    {assetType === 'FII' ? 'Rendimento Anual (R$):' : 'DPA Estimado (R$):'}
                  </label>
                  <NumericInput
                    value={bazinDPA}
                    onChange={setBazinDPA}
                    className="w-full px-2.5 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Yield Alvo (%):</label>
                  <NumericInput
                    value={bazinTargetYield}
                    onChange={setBazinTargetYield}
                    className="w-full px-2.5 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="p-2 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Preço Teto Bazin:</span>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(valuationResults.bazinCeiling)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Margem:</span>
                  <p className={`text-sm font-black ${valuationResults.bazinMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatPercent(valuationResults.bazinMargin)}
                  </p>
                </div>
              </div>
            </div>

            {/* FOR FII: METHOD 2 IS P/VP ALVO */}
            {assetType === 'FII' && (
              <div className="p-3.5 rounded-2xl border border-border bg-card shadow-xs space-y-2.5 relative">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-foreground">2. Múltiplo P/VP Alvo (FIIs)</h4>
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      FII
                    </span>
                  </div>
                  {renderValuationBadge(valuationResults.pvpCeiling)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">VP/Cota (VPA R$):</label>
                    <NumericInput
                      value={grahamVPA}
                      onChange={setGrahamVPA}
                      className="w-full px-2.5 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">P/VP Alvo (Ex: 1,00):</label>
                    <NumericInput
                      value={pvpTarget}
                      onChange={setPvpTarget}
                      className="w-full px-2.5 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Diferença (Preço - VPA):</span>
                    <p className={`text-base font-black ${valuationResults.pvpDiff <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {valuationResults.pvpDiff > 0 ? `+${formatCurrency(valuationResults.pvpDiff)}` : formatCurrency(valuationResults.pvpDiff)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Margem:</span>
                    <p className={`text-sm font-black ${valuationResults.pvpMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {formatPercent(valuationResults.pvpMargin)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* FOR AÇÃO: METHOD 2 IS BENJAMIN GRAHAM */}
            {assetType === 'Ação' && (
              <div className="p-3.5 rounded-2xl border border-border bg-card shadow-xs space-y-2.5 relative">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-foreground">2. Fórmula de Graham</h4>
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Ações
                    </span>
                  </div>
                  {renderValuationBadge(valuationResults.grahamCeiling)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">LPA (Lucro/Ação R$):</label>
                    <NumericInput
                      value={grahamLPA}
                      onChange={setGrahamLPA}
                      className="w-full px-2.5 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">VPA (Patrimônio/Ação):</label>
                    <NumericInput
                      value={grahamVPA}
                      onChange={setGrahamVPA}
                      className="w-full px-2.5 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Preço Justo Graham:</span>
                    <p className="text-base font-black text-sky-600 dark:text-sky-400">
                      {formatCurrency(valuationResults.grahamCeiling)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Margem:</span>
                    <p className={`text-sm font-black ${valuationResults.grahamMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {formatPercent(valuationResults.grahamMargin)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* FOR AÇÃO: METHOD 3 IS MODELO DE GORDON */}
            {assetType === 'Ação' && (
              <div className="p-3.5 rounded-2xl border border-border bg-card shadow-xs space-y-2.5 relative">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-foreground">3. Crescimento de Gordon</h4>
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      Crescimento
                    </span>
                  </div>
                  {renderValuationBadge(valuationResults.gordonCeiling)}
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <div>
                    <label className="text-[9px] font-semibold text-muted-foreground block mb-0.5">D1 (Div. R$):</label>
                    <NumericInput
                      value={gordonD1}
                      onChange={setGordonD1}
                      className="w-full px-2 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold text-muted-foreground block mb-0.5">k (Retorno %):</label>
                    <NumericInput
                      value={gordonRequiredReturn}
                      onChange={setGordonRequiredReturn}
                      className="w-full px-2 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold text-muted-foreground block mb-0.5">g (Cresc. %):</label>
                    <NumericInput
                      value={gordonGrowthRate}
                      onChange={setGordonGrowthRate}
                      className="w-full px-2 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Preço Teto Gordon:</span>
                    <p className="text-base font-black text-purple-600 dark:text-purple-400">
                      {formatCurrency(valuationResults.gordonCeiling)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Margem:</span>
                    <p className={`text-sm font-black ${valuationResults.gordonMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {formatPercent(valuationResults.gordonMargin)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* FOR AÇÃO: METHOD 4 IS MÚLTIPLO P/L ALVO */}
            {assetType === 'Ação' && (
              <div className="p-3.5 rounded-2xl border border-border bg-card shadow-xs space-y-2.5 relative">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-foreground">4. P/L Alvo (Ações)</h4>
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Múltiplos
                    </span>
                  </div>
                  {renderValuationBadge(valuationResults.plCeiling)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">LPA (R$):</label>
                    <NumericInput
                      value={grahamLPA}
                      onChange={setGrahamLPA}
                      className="w-full px-2.5 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">P/L Alvo Desejado:</label>
                    <NumericInput
                      value={plTarget}
                      onChange={setPlTarget}
                      className="w-full px-2.5 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Preço Teto P/L:</span>
                    <p className="text-base font-black text-amber-600 dark:text-amber-400">
                      {formatCurrency(valuationResults.plCeiling)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Margem:</span>
                    <p className={`text-sm font-black ${valuationResults.plMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {formatPercent(valuationResults.plMargin)}
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* FOR FII: OPTIONAL COLLAPSIBLE SECTION FOR GRAHAM & GORDON */}
          {assetType === 'FII' && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowEquityMethodsForFii(!showEquityMethodsForFii)}
                className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors px-1 py-1"
              >
                <span>{showEquityMethodsForFii ? '▲ Ocultar métodos secundários (Graham e Gordon)' : '▼ Exibir métodos de Ações (Graham e Gordon)'}</span>
              </button>

              {showEquityMethodsForFii && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mt-2.5">
                  {/* GRAHAM */}
                  <div className="p-3.5 rounded-2xl border border-border bg-card/60 shadow-xs space-y-2.5 relative opacity-85">
                    <div className="flex items-center justify-between pb-2 border-b border-border/40">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-foreground">Fórmula de Graham</h4>
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          Ações
                        </span>
                      </div>
                      {renderValuationBadge(valuationResults.grahamCeiling)}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">LPA (Lucro/Ação R$):</label>
                        <NumericInput
                          value={grahamLPA}
                          onChange={setGrahamLPA}
                          className="w-full px-2.5 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">VPA (Patrimônio/Ação):</label>
                        <NumericInput
                          value={grahamVPA}
                          onChange={setGrahamVPA}
                          className="w-full px-2.5 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Preço Justo Graham:</span>
                        <p className="text-base font-black text-sky-600 dark:text-sky-400">
                          {formatCurrency(valuationResults.grahamCeiling)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Margem:</span>
                        <p className={`text-sm font-black ${valuationResults.grahamMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {formatPercent(valuationResults.grahamMargin)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* GORDON */}
                  <div className="p-3.5 rounded-2xl border border-border bg-card/60 shadow-xs space-y-2.5 relative opacity-85">
                    <div className="flex items-center justify-between pb-2 border-b border-border/40">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-foreground">Crescimento de Gordon</h4>
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          Crescimento
                        </span>
                      </div>
                      {renderValuationBadge(valuationResults.gordonCeiling)}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      <div>
                        <label className="text-[9px] font-semibold text-muted-foreground block mb-0.5">D1 (Div. R$):</label>
                        <NumericInput
                          value={gordonD1}
                          onChange={setGordonD1}
                          className="w-full px-2 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-semibold text-muted-foreground block mb-0.5">k (Retorno %):</label>
                        <NumericInput
                          value={gordonRequiredReturn}
                          onChange={setGordonRequiredReturn}
                          className="w-full px-2 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-semibold text-muted-foreground block mb-0.5">g (Cresc. %):</label>
                        <NumericInput
                          value={gordonGrowthRate}
                          onChange={setGordonGrowthRate}
                          className="w-full px-2 py-1 rounded-lg border border-border bg-muted/30 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Preço Teto Gordon:</span>
                        <p className="text-base font-black text-purple-600 dark:text-purple-400">
                          {formatCurrency(valuationResults.gordonCeiling)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Margem:</span>
                        <p className={`text-sm font-black ${valuationResults.gordonMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {formatPercent(valuationResults.gordonMargin)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SAVED VALUATIONS OVERVIEW TABLE */}
          <div className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-black tracking-tight text-foreground uppercase">
                  Valuations & Preços Teto Salvos ({savedValuationsList.length})
                </h3>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Clique em &quot;Carregar&quot; para carregar os valores na calculadora
              </span>
            </div>

            {savedValuationsList.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Nenhum valuation salvo ainda. Preencha a calculadora e clique em <strong>Salvar Valuation</strong>.
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-none">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border/50 text-[10px] uppercase text-muted-foreground font-bold">
                      <th className="py-2 px-3">Ativo</th>
                      <th className="py-2 px-3 text-right">Cotação Salva</th>
                      <th className="py-2 px-3 text-right">DPA Salvo</th>
                      <th className="py-2 px-3 text-right">Yield Alvo</th>
                      <th className="py-2 px-3 text-right">Preço Teto Bazin</th>
                      <th className="py-2 px-3 text-right">Margem Bazin</th>
                      <th className="py-2 px-3 text-right">Método Complementar</th>
                      <th className="py-2 px-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 font-medium">
                    {savedValuationsList.map(item => {
                      const isCurrentlyEditing = selectedTicker === item.ticker;

                      return (
                        <tr 
                          key={item.ticker}
                          className={`hover:bg-muted/30 transition-colors ${isCurrentlyEditing ? 'bg-primary/5' : ''}`}
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-foreground text-xs">{item.ticker}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-secondary text-secondary-foreground font-bold uppercase">
                                {item.asset_type || (item.isFii ? 'FII' : 'Ação')}
                              </span>
                              {isCurrentlyEditing && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary/20 text-primary font-bold">
                                  {hasUnsavedChanges ? 'Editando *' : 'Editando'}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2 px-3 text-right font-mono">
                            {formatCurrency(item.curPrice)}
                          </td>

                          <td className="py-2 px-3 text-right font-mono font-semibold">
                            {formatCurrency(item.bazinDpa || 0)}
                          </td>

                          <td className="py-2 px-3 text-right font-mono">
                            {item.targetYield.toFixed(1)}%
                          </td>

                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.bazinCeiling)}
                          </td>

                          <td className={`py-2 px-3 text-right font-mono font-bold ${item.bazinMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {item.bazinCeiling > 0 ? formatPercent(item.bazinMargin) : '-'}
                          </td>

                          <td className="py-2 px-3 text-right font-mono text-[11px]">
                            {item.isFii ? (
                              item.pvpCeiling > 0 ? (
                                <span className={item.pvpMargin >= 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                                  P/VP {item.pvp_target?.toFixed(2)}x: {formatCurrency(item.pvpCeiling)} ({item.pvpMargin >= 0 ? '+' : ''}{item.pvpMargin.toFixed(1)}%)
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )
                            ) : (
                              item.grahamCeiling > 0 ? (
                                <span className={item.grahamMargin >= 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                                  Graham: {formatCurrency(item.grahamCeiling)} ({item.grahamMargin >= 0 ? '+' : ''}{item.grahamMargin.toFixed(1)}%)
                                </span>
                              ) : item.plCeiling > 0 ? (
                                <span className={item.plMargin >= 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                                  P/L {item.pl_target}x: {formatCurrency(item.plCeiling)} ({item.plMargin >= 0 ? '+' : ''}{item.plMargin.toFixed(1)}%)
                                </span>
                              ) : item.gordonCeiling > 0 ? (
                                <span className={item.gordonMargin >= 0 ? 'text-purple-500 font-semibold' : 'text-rose-500 font-semibold'}>
                                  Gordon: {formatCurrency(item.gordonCeiling)} ({item.gordonMargin >= 0 ? '+' : ''}{item.gordonMargin.toFixed(1)}%)
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )
                            )}
                          </td>

                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleSelectCalculatorTicker(item.ticker)}
                                className="p-1 px-2 text-[10px] font-bold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center gap-1"
                                title="Carregar ativo na calculadora"
                              >
                                <Edit3 className="w-3 h-3" />
                                Carregar
                              </button>
                              <button
                                onClick={() => handleDeleteValuation(item.ticker)}
                                className="p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                title="Excluir valuation salvo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* CONCENTRATION RISK MATRIX (HHI INDEX) */}
          <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/40">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-sm font-black tracking-tight text-foreground uppercase">
                    Análise de Risco & Concentração de Carteira (Índice HHI)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Mede o nível de pulverização e risco de dependência em poucos ativos.
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black border bg-muted/30 ${concentrationMetrics.color}`}>
                HHI: {concentrationMetrics.hhi} • {concentrationMetrics.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
              <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Índice HHI Acumulado</span>
                <p className={`text-xl font-black ${concentrationMetrics.color}`}>{concentrationMetrics.hhi} pts</p>
                <p className="text-[10px] text-muted-foreground">
                  {concentrationMetrics.hhi < 1500 ? '< 1500: Excelente diversificação' : concentrationMetrics.hhi < 2500 ? '1500-2500: Concentração Moderada' : '> 2500: Alta Concentração'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Maior Exposição na Carteira</span>
                <p className="text-xl font-black text-foreground">{concentrationMetrics.maxPos?.ticker || 'N/A'}</p>
                <p className="text-[10px] text-muted-foreground">
                  Representa <strong>{concentrationMetrics.maxSharePct}%</strong> do valor total investido.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Total de Posições Ativas</span>
                <p className="text-xl font-black text-primary">{analyticsData.activePositions.length} Ativos</p>
                <p className="text-[10px] text-muted-foreground">
                  {analyticsData.activePositions.length >= 8 ? 'Quantidade ideal para gestão passiva.' : 'Considere diversificar em mais ativos.'}
                </p>
              </div>
            </div>
          </div>

          {/* SIMULADOR DE JUROS COMPOSTOS & BOLA DE NEVE */}
          <div className="p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-card via-card to-emerald-500/5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight text-foreground flex items-center gap-2">
                    Simulador Bola de Neve (Renda Passiva Futura)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Projete o crescimento do patrimônio e dos proventos com aportes recorrentes e reinvestimento.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-muted-foreground">Anos de Projeção:</span>
                {[5, 10, 15, 20].map(y => (
                  <button
                    key={y}
                    onClick={() => setSimYears(y)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                      simYears === y 
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-2xs' 
                        : 'bg-card text-muted-foreground border-border hover:text-foreground'
                    }`}
                  >
                    {y} anos
                  </button>
                ))}
              </div>
            </div>

            {/* SIMULATION CONTROLS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Aporte Mensal (R$):</label>
                <NumericInput
                  value={simMonthlyContrib}
                  onChange={setSimMonthlyContrib}
                  prefix="R$"
                  className="w-full px-2.5 py-1.5 rounded-xl border border-border bg-card font-black text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Yield Anual em Divs (%):</label>
                <NumericInput
                  value={simAnnualYield}
                  onChange={setSimAnnualYield}
                  suffix="%"
                  className="w-full px-2.5 py-1.5 rounded-xl border border-border bg-card font-black text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Valorização Anual (%):</label>
                <NumericInput
                  value={simAnnualGrowth}
                  onChange={setSimAnnualGrowth}
                  suffix="%"
                  className="w-full px-2.5 py-1.5 rounded-xl border border-border bg-card font-black text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Anos:</label>
                <NumericInput
                  value={simYears}
                  onChange={setSimYears}
                  decimals={0}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-border bg-card font-black text-xs"
                />
              </div>
            </div>

            {/* SIMULATION SUMMARY KPI CARDS */}
            {snowballSimulationData.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Patrimônio em {simYears} Anos</span>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                    {formatCurrency(snowballSimulationData[snowballSimulationData.length - 1].currentPortfolio)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Total Aportado: {formatCurrency(snowballSimulationData[snowballSimulationData.length - 1].totalInvested)}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase">Renda Passiva Mensal Estimada</span>
                  <p className="text-xl font-black text-indigo-500 tracking-tight">
                    {formatCurrency(snowballSimulationData[snowballSimulationData.length - 1].monthlyPassiveIncome)}/mês
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    No Ano {simYears} com yield de {simAnnualYield}% a.a.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] font-bold text-amber-500 uppercase">Proventos Acumulados</span>
                  <p className="text-xl font-black text-amber-500 tracking-tight">
                    {formatCurrency(snowballSimulationData[snowballSimulationData.length - 1].cumulativeDividends)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Renda total gerada e reinvestida
                  </p>
                </div>
              </div>
            )}

            {/* PROJECTION AREA CHART */}
            {snowballSimulationData.length > 0 && (
              <div className="h-60 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={snowballSimulationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPort" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => hideValues ? '••••' : `R$ ${(val / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(val: any, name: any) => [
                        formatCurrency(Number(val)), 
                        name === 'currentPortfolio' ? 'Patrimônio Total' : name === 'totalInvested' ? 'Total Aportado' : 'Proventos Acumulados'
                      ]}
                      contentStyle={{ borderRadius: '16px', borderColor: 'rgba(255,255,255,0.1)' }}
                    />
                    <Area type="monotone" dataKey="currentPortfolio" name="currentPortfolio" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPort)" />
                    <Area type="monotone" dataKey="totalInvested" name="totalInvested" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorInv)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
