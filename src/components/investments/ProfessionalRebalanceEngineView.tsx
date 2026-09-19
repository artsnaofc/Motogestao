import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { cacheManager } from '../../lib/cacheManager';
import { 
  Scale, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  Coins, 
  Lock, 
  Unlock, 
  SlidersHorizontal, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Plus, 
  Minus,
  Check, 
  Zap,
  Info,
  DollarSign,
  HelpCircle,
  Target,
  AlertCircle,
  PlusCircle,
  X,
  Wallet,
  Copy,
  RefreshCw,
  Layers,
  PieChart,
  BarChart3,
  ListFilter,
  Search,
  ExternalLink,
  Sliders,
  RotateCcw,
  Building2,
  ChevronRight,
  ArrowUpDown,
  FileText,
  Edit3,
  Trash2
} from 'lucide-react';
import { 
  simulatePortfolioContribution, 
  RebalanceStrategyType, 
  RebalanceRulesConfig, 
  AssetAllocationTarget, 
  DEFAULT_REBALANCE_RULES,
  PositionForRebalance,
  ContributionItemSuggestion,
  StrategyWeights,
  getStrategyWeights
} from '../../lib/rebalanceEngine';
import { useInvestments } from '../../contexts/InvestmentsContext';
import { useData } from '../../contexts/DataContext';
import { toast } from 'sonner';
import { AddRebalanceAssetModal, CustomRebalanceAsset } from './AddRebalanceAssetModal';
import { EditTargetAssetModal } from './EditTargetAssetModal';
import { RebalanceMacroClassModal } from './RebalanceMacroClassModal';
import { fetchSingleQuote } from '../../lib/quoteService';
import { getTodayLocalDateStr } from '../../lib/utils';

interface ProfessionalRebalanceEngineViewProps {
  positions: any[];
  targets?: Record<string, AssetAllocationTarget>;
  targetAllocations?: Record<string, AssetAllocationTarget>;
  quotes?: Record<string, number>;
  valuationTargets?: Record<string, any>;
  rulesConfig?: RebalanceRulesConfig;
  onSaveTargets?: (newTargets: Record<string, AssetAllocationTarget>) => Promise<void>;
  onSaveRulesConfig?: (newConfig: RebalanceRulesConfig) => Promise<void>;
  onExecuteOrders?: (orders: Array<{ ticker: string; type: string; price: number; quantity: number; amount: number; costs?: number; reserve_id?: string; date?: string }>) => Promise<void>;
  onBatchBuy?: (orders: Array<{ ticker: string; type: string; price: number; quantity: number; amount: number; costs?: number; reserve_id?: string; date?: string }>) => Promise<void>;
  onOpenRaioX?: (ticker: string) => void;
  hideValues?: boolean;
  onFetchQuote?: (ticker: string) => Promise<void>;
}

export const ProfessionalRebalanceEngineView: React.FC<ProfessionalRebalanceEngineViewProps> = ({
  positions = [],
  targets,
  targetAllocations,
  quotes = {},
  valuationTargets: customMetadata,
  rulesConfig: initialRulesConfig = DEFAULT_REBALANCE_RULES,
  onSaveTargets,
  onSaveRulesConfig,
  onExecuteOrders,
  onBatchBuy,
  hideValues = false,
  onFetchQuote,
  onOpenRaioX
}) => {
  const { b3AssetsMetadata } = useInvestments();
  const effectiveTargets = targets || targetAllocations || {};
  const { reserves, settings, fetchQuotes, isFetchingQuotes: isGlobalFetchingQuotes, saveValuationTarget } = useData();

  // Set of tickers currently held in user's portfolio
  const holdingTickers = useMemo(() => new Set(positions.map(p => p.ticker.toUpperCase().trim())), [positions]);

  // Target quote loading & modal state
  const [loadingQuoteTickers, setLoadingQuoteTickers] = useState<Record<string, boolean>>({});
  const [isFetchingAllTargets, setIsFetchingAllTargets] = useState<boolean>(false);
  const [editingTargetTicker, setEditingTargetTicker] = useState<string | null>(null);
  const [targetToDelete, setTargetToDelete] = useState<string | null>(null);
  const [targetSearchQuery, setTargetSearchQuery] = useState<string>('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('all');

  // State: Navigation & Modes
  const [activeViewMode, setActiveViewMode] = useState<'cards' | 'table' | 'visual' | 'targets'>('cards');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'suggested' | 'neutral' | 'restricted'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedOrders, setCopiedOrders] = useState<boolean>(false);

  // State: Contribution Budget & Reserve Sync
  const [contributionAmount, setContributionAmount] = useState<number>(0);
  const [hasSetInitialContribution, setHasSetInitialContribution] = useState(false);

  // State: Interactive manual adjustments (+1 / -1 cotas)
  const [manualQtyAdjustments, setManualQtyAdjustments] = useState<Record<string, number>>({});

  // Linked Investment Reserve
  const invReserve = useMemo(() => {
    if (settings?.default_investment_reserve_id) {
      const found = reserves.find(r => r.id === settings.default_investment_reserve_id);
      if (found) return found;
    }
    const keywords = ['reserva de investimento', 'investimento', 'apport', 'corretora', 'bolsa', 'oportunidade'];
    for (const kw of keywords) {
      const found = reserves.find(r => r.name.toLowerCase().includes(kw));
      if (found) return found;
    }
    return reserves.find(r => (r.saldo_atual || 0) > 0);
  }, [reserves, settings?.default_investment_reserve_id]);

  const invReserveBalance = useMemo(() => {
    return invReserve ? (invReserve.saldo_atual || 0) : 0;
  }, [invReserve]);

  // Sync initial contribution with Investment Reserve
  useEffect(() => {
    if (reserves.length > 0 && !hasSetInitialContribution) {
      if (invReserve && (invReserve.saldo_atual || 0) > 0) {
        setContributionAmount(invReserve.saldo_atual || 0);
        setHasSetInitialContribution(true);
      } else if (invReserve && invReserve.id) {
        setHasSetInitialContribution(true);
      }
    }
  }, [reserves, hasSetInitialContribution, invReserve]);

  // Quotes & Local Quotes
  const [localQuotes, setLocalQuotes] = useState<Record<string, number>>({});
  const effectiveQuotes = useMemo(() => {
    return { ...quotes, ...localQuotes };
  }, [quotes, localQuotes]);

  // Strategies & Configuration
  const [activeStrategy, setActiveStrategy] = useState<RebalanceStrategyType>(initialRulesConfig?.activeStrategy || 'rebalance');
  const [rulesConfig, setRulesConfig] = useState<RebalanceRulesConfig>(initialRulesConfig || DEFAULT_REBALANCE_RULES);
  const [stockWeights, setStockWeights] = useState<any>(undefined);
  const [fiiWeights, setFiiWeights] = useState<any>(undefined);
  
  // Targets state
  const [editableTargets, setEditableTargets] = useState<Record<string, AssetAllocationTarget>>(effectiveTargets);
  
  // Modals state
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [isMacroClassModalOpen, setIsMacroClassModalOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<any[] | null>(null);
  const [selectedReserveIdForExecution, setSelectedReserveIdForExecution] = useState<string>(invReserve?.id || '');
  const [executionDate, setExecutionDate] = useState<string>(() => getTodayLocalDateStr());
  const [isExecuting, setIsExecuting] = useState(false);

  // Sync targets when incoming targets change
  useEffect(() => {
    setEditableTargets(effectiveTargets);
  }, [effectiveTargets]);

  // Format Currency Helper
  const formatBRL = useCallback((val: number) => {
    if (hideValues) return 'R$ •••••';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }, [hideValues]);

  // Normalize positions for rebalance engine
  const normalizedPositions: PositionForRebalance[] = useMemo(() => {
    // 1. Map existing holding positions
    const holdings = positions
      .filter(p => (p.totalQuantity ?? p.quantity ?? 0) > 0)
      .map(p => {
        const qty = p.totalQuantity ?? p.quantity ?? 0;
        const quote = effectiveQuotes[p.ticker] || p.currentPrice || p.averagePrice || 10;
        const curVal = quote * qty;
        return {
          ticker: p.ticker.toUpperCase().trim(),
          type: p.type || 'Ação',
          quantity: qty,
          averagePrice: p.averagePrice ?? (p.totalInvested && qty > 0 ? p.totalInvested / qty : 0),
          currentPrice: quote,
          currentValue: curVal,
          currentPct: 0
        };
      });

    const holdingTickers = new Set(holdings.map(h => h.ticker));

    // 2. Map targets that are not in holding positions (custom assets / study watchlist)
    const watchlistAssets: PositionForRebalance[] = [];
    Object.keys(editableTargets).forEach(ticker => {
      const tickerUpper = ticker.toUpperCase().trim();
      if (!holdingTickers.has(tickerUpper)) {
        const targetSpec = editableTargets[ticker];
        const quote = effectiveQuotes[tickerUpper] || (targetSpec as any).lastPrice || 10;
        watchlistAssets.push({
          ticker: tickerUpper,
          type: targetSpec.type || 'Ação',
          quantity: 0,
          averagePrice: 0,
          currentPrice: quote,
          currentValue: 0,
          currentPct: 0
        });
      }
    });

    const combined = [...holdings, ...watchlistAssets];
    const totalVal = combined.reduce((acc, p) => acc + p.currentValue, 0);
    return combined.map(p => ({
      ...p,
      currentPct: totalVal > 0 ? (p.currentValue / totalVal) * 100 : 0
    }));
  }, [positions, effectiveQuotes, editableTargets]);

  // Run Real-Time Mathematical Rebalance Simulation
  const baseSimulation = useMemo(() => {
    const activeRules: RebalanceRulesConfig = {
      ...rulesConfig,
      activeStrategy
    };
    return simulatePortfolioContribution(
      normalizedPositions,
      editableTargets,
      contributionAmount,
      activeRules,
      effectiveQuotes,
      { ...b3AssetsMetadata, ...customMetadata },
      stockWeights,
      fiiWeights
    );
  }, [normalizedPositions, editableTargets, contributionAmount, activeStrategy, rulesConfig, effectiveQuotes, b3AssetsMetadata, stockWeights, fiiWeights, customMetadata]);

  // Simulation adjusted with interactive manual additions/subtractions
  const simulation = useMemo(() => {
    const hasManual = Object.keys(manualQtyAdjustments).length > 0;
    if (!hasManual) return baseSimulation;

    let adjustedTotalAllocated = 0;
    const adjustedSuggestions = baseSimulation.suggestions.map(item => {
      const adjustment = manualQtyAdjustments[item.ticker] || 0;
      const finalQuantity = Math.max(0, item.suggestedQuantity + adjustment);
      const finalAmount = finalQuantity * item.currentPrice;
      adjustedTotalAllocated += finalAmount;

      const newTotalPortfolio = baseSimulation.totalBefore + adjustedTotalAllocated;
      const projectedValue = item.currentValue + finalAmount;
      const projectedPct = newTotalPortfolio > 0 ? (projectedValue / newTotalPortfolio) * 100 : 0;
      const distanceAfter = Math.abs(projectedPct - item.targetPct);

      return {
        ...item,
        suggestedQuantity: finalQuantity,
        suggestedAmount: finalAmount,
        projectedValue,
        projectedPct,
        distanceAfter,
        deviationCorrectedPct: item.distanceBefore > 0 
          ? Math.max(0, Math.min(100, Math.round(((item.distanceBefore - distanceAfter) / item.distanceBefore) * 100))) 
          : 100
      };
    });

    const unallocated = Math.max(0, contributionAmount - adjustedTotalAllocated);
    
    // Recalculate deviation metrics
    const totalDevAfter = adjustedSuggestions.reduce((acc, s) => acc + s.distanceAfter, 0);
    const overallDevReduction = baseSimulation.totalDeviationBefore > 0
      ? Math.max(0, Math.round(((baseSimulation.totalDeviationBefore - totalDevAfter) / baseSimulation.totalDeviationBefore) * 100))
      : 0;

    return {
      ...baseSimulation,
      totalAllocated: adjustedTotalAllocated,
      unallocatedRemainder: unallocated,
      suggestions: adjustedSuggestions,
      totalDeviationAfter: Number(totalDevAfter.toFixed(2)),
      overallDeviationReductionPct: overallDevReduction
    };
  }, [baseSimulation, manualQtyAdjustments, contributionAmount]);

  // Active proposed orders (quantity > 0)
  const activeOrders = useMemo(() => {
    return simulation.suggestions.filter(s => s.suggestedQuantity > 0);
  }, [simulation.suggestions]);

  // Filtered suggestions for UI view
  const filteredSuggestions = useMemo(() => {
    return simulation.suggestions.filter(item => {
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchTicker = item.ticker.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        if (!matchTicker && !matchName) return false;
      }

      // Filter by Type
      if (filterType !== 'all' && item.type !== filterType) {
        return false;
      }

      // Filter by Status
      if (filterStatus === 'suggested' && item.suggestedQuantity === 0) return false;
      if (filterStatus === 'neutral' && (item.suggestedQuantity > 0 || item.status === 'restricted' || item.status === 'locked')) return false;
      if (filterStatus === 'restricted' && item.status !== 'restricted' && item.status !== 'locked') return false;

      return true;
    });
  }, [simulation.suggestions, searchQuery, filterType, filterStatus]);

  // Target Allocations Summary
  const totalTargetAllocation = useMemo(() => {
    return Object.values(editableTargets).reduce((acc, t) => acc + (t.targetPct || 0), 0);
  }, [editableTargets]);

  // Macro-Classes distribution (Current vs Projected vs Target)
  const macroClassesData = useMemo(() => {
    const classes = ['Ação', 'FII', 'ETF', 'BDR', 'Outro'];
    const result: Array<{
      type: string;
      currentValue: number;
      currentPct: number;
      suggestedAmount: number;
      projectedValue: number;
      projectedPct: number;
      targetPct: number;
    }> = [];

    const totalCur = simulation.totalBefore || 1;
    const totalProj = simulation.totalBefore + simulation.totalAllocated || 1;

    classes.forEach(type => {
      const items = simulation.suggestions.filter(s => s.type === type);
      if (items.length === 0) return;

      const curVal = items.reduce((acc, i) => acc + i.currentValue, 0);
      const sugAmt = items.reduce((acc, i) => acc + i.suggestedAmount, 0);
      const projVal = curVal + sugAmt;
      const targetPct = items.reduce((acc, i) => acc + i.targetPct, 0);

      result.push({
        type,
        currentValue: curVal,
        currentPct: (curVal / totalCur) * 100,
        suggestedAmount: sugAmt,
        projectedValue: projVal,
        projectedPct: (projVal / totalProj) * 100,
        targetPct
      });
    });

    return result;
  }, [simulation]);

  // Adjust suggested quantity manually (+1 / -1)
  const handleAdjustQuantity = (ticker: string, delta: number) => {
    const currentItem = simulation.suggestions.find(s => s.ticker === ticker);
    if (!currentItem) return;

    setManualQtyAdjustments(prev => {
      const currentAdj = prev[ticker] || 0;
      const baseQty = baseSimulation.suggestions.find(s => s.ticker === ticker)?.suggestedQuantity || 0;
      const newAdj = currentAdj + delta;
      
      if (baseQty + newAdj < 0) {
        return { ...prev, [ticker]: -baseQty };
      }

      if (newAdj === 0) {
        const next = { ...prev };
        delete next[ticker];
        return next;
      }

      return { ...prev, [ticker]: newAdj };
    });
  };

  // Reset manual adjustments
  const handleResetManualAdjustments = () => {
    setManualQtyAdjustments({});
    toast.info('Ajustes manuais redefinidos para a sugestão matemática original.');
  };

  // Toggle Asset Lock
  const handleToggleLock = async (ticker: string) => {
    const current = editableTargets[ticker] || {
      ticker,
      type: 'Ação',
      minPct: 1,
      targetPct: 5,
      maxPct: 15,
      locked: false
    };
    const next = {
      ...editableTargets,
      [ticker]: {
        ...current,
        locked: !current.locked
      }
    };
    setEditableTargets(next);
    if (onSaveTargets) {
      try {
        await onSaveTargets(next);
        toast.success(`Ativo ${ticker} ${!current.locked ? 'travado contra aportes' : 'destravado para aportes'}!`);
      } catch (err) {
        console.error('Failed to save lock status:', err);
      }
    }
  };

  // Handle Save Targets
  const handleSaveTargetAllocations = async () => {
    try {
      if (onSaveTargets) {
        await onSaveTargets(editableTargets);
      }
      toast.success('Metas de alocação salvas com sucesso!');
    } catch (e) {
      toast.error('Erro ao salvar metas de alocação.');
    }
  };

  // Helper to fetch live quote for a single target ticker
  const handleFetchQuoteForSingleTicker = useCallback(async (targetTicker: string, showToast = true) => {
    const clean = targetTicker.toUpperCase().trim();
    if (!clean || clean.length < 3) return;

    setLoadingQuoteTickers(prev => ({ ...prev, [clean]: true }));
    try {
      if (fetchQuotes) {
        const res = await fetchQuotes(undefined, undefined, [clean], true);
        if (res && res.quotes && res.quotes[clean] > 0) {
          const price = res.quotes[clean];
          setLocalQuotes(prev => ({ ...prev, [clean]: price }));
          if (showToast) toast.success(`Cotação de ${clean} atualizada: ${formatBRL(price)}`);
          return price;
        }
      }

      // Fallback
      const resFallback = await fetchSingleQuote(clean, settings?.brapi_token);
      if (resFallback && resFallback.price > 0) {
        setLocalQuotes(prev => ({ ...prev, [clean]: resFallback.price }));
        if (showToast) toast.success(`Cotação de ${clean} atualizada: ${formatBRL(resFallback.price)}`);
        return resFallback.price;
      } else {
        if (showToast) toast.warning(`Não foi possível obter cotação automática para ${clean}.`);
      }
    } catch (err) {
      console.warn('Erro ao buscar cotação de', clean, err);
      if (showToast) toast.error(`Erro ao buscar cotação de ${clean}.`);
    } finally {
      setLoadingQuoteTickers(prev => ({ ...prev, [clean]: false }));
    }
  }, [fetchQuotes, settings?.brapi_token, formatBRL]);

  // Helper to fetch quotes for all target tickers
  const handleFetchAllTargetQuotes = useCallback(async (onlyMissing = false) => {
    const allTickers = Object.keys(editableTargets).map(t => t.toUpperCase().trim()).filter(Boolean);
    if (allTickers.length === 0) return;

    const tickersToFetch = onlyMissing
      ? allTickers.filter(t => !effectiveQuotes[t] || effectiveQuotes[t] <= 0)
      : allTickers;

    if (tickersToFetch.length === 0) {
      if (!onlyMissing) toast.info('Todos os ativos já possuem cotações sincronizadas.');
      return;
    }

    setIsFetchingAllTargets(true);
    try {
      if (fetchQuotes) {
        const res = await fetchQuotes(undefined, undefined, tickersToFetch, true);
        if (res && res.quotes) {
          setLocalQuotes(prev => ({ ...prev, ...res.quotes }));
          const count = Object.keys(res.quotes).length;
          toast.success(`${count} cotação(ões) de metas alvo atualizada(s) com sucesso!`);
        }
      } else {
        for (const tk of tickersToFetch) {
          const fb = await fetchSingleQuote(tk, settings?.brapi_token);
          if (fb && fb.price > 0) {
            setLocalQuotes(prev => ({ ...prev, [tk]: fb.price }));
          }
        }
        toast.success(`Cotações atualizadas.`);
      }
    } catch (err) {
      console.warn('Erro ao atualizar cotações das metas:', err);
      toast.error('Erro ao atualizar cotações dos ativos das metas.');
    } finally {
      setIsFetchingAllTargets(false);
    }
  }, [editableTargets, effectiveQuotes, fetchQuotes, settings?.brapi_token]);

  // Auto-fetch quotes for target tickers that lack quotes when viewing targets
  useEffect(() => {
    if (activeViewMode === 'targets') {
      const missing = Object.keys(editableTargets).filter(
        tk => (!effectiveQuotes[tk] || effectiveQuotes[tk] <= 0) && !loadingQuoteTickers[tk]
      );
      if (missing.length > 0 && !isFetchingAllTargets) {
        handleFetchAllTargetQuotes(true);
      }
    }
  }, [activeViewMode, editableTargets, effectiveQuotes, isFetchingAllTargets, loadingQuoteTickers, handleFetchAllTargetQuotes]);

  // Handle Save Edited Target
  const handleSaveEditedTarget = async (updated: {
    ticker: string;
    type: string;
    targetPct: number;
    minPct: number;
    maxPct: number;
    locked: boolean;
    quote?: number;
    valuationPrice?: number;
  }) => {
    const nextTargets: Record<string, AssetAllocationTarget> = {
      ...editableTargets,
      [updated.ticker]: {
        ticker: updated.ticker,
        type: updated.type as any,
        targetPct: updated.targetPct,
        minPct: updated.minPct,
        maxPct: updated.maxPct,
        locked: updated.locked,
        lastPrice: updated.quote || editableTargets[updated.ticker]?.lastPrice
      }
    };
    setEditableTargets(nextTargets);

    if (updated.quote && updated.quote > 0) {
      setLocalQuotes(prev => ({ ...prev, [updated.ticker]: updated.quote! }));
    }

    if (updated.valuationPrice !== undefined && saveValuationTarget) {
      await saveValuationTarget({
        ticker: updated.ticker,
        targetPrice: updated.valuationPrice,
        notes: 'Definido no Gerenciador de Metas de Rebalanceamento'
      });
    }

    if (onSaveTargets) {
      await onSaveTargets(nextTargets);
    }
    setEditingTargetTicker(null);
  };

  // Handle Delete Target
  const handleDeleteTarget = async (tickerToDelete: string) => {
    const clean = tickerToDelete.toUpperCase().trim();
    const next = { ...editableTargets };
    delete next[clean];
    setEditableTargets(next);

    setManualQtyAdjustments(prev => {
      const copy = { ...prev };
      delete copy[clean];
      return copy;
    });

    if (onSaveTargets) {
      await onSaveTargets(next);
    }
    setTargetToDelete(null);
    if (editingTargetTicker === clean) {
      setEditingTargetTicker(null);
    }
    toast.success(`Ativo ${clean} excluído das metas alvo com sucesso!`);
  };

  // Copy Orders for Home Broker / Clipboard
  const handleCopyOrdersToClipboard = () => {
    if (activeOrders.length === 0) {
      toast.info('Nenhuma ordem de aporte sugerida para copiar.');
      return;
    }

    const dateStr = new Date().toLocaleDateString('pt-BR');
    const stratName = activeStrategy === 'rebalance' ? 'Rebalanceamento Puro (Gap Solver)' :
      activeStrategy === 'quality' ? 'Qualidade Máxima (Score B3)' :
      activeStrategy === 'valuation' ? 'Valuation & Margem de Segurança' :
      activeStrategy === 'dividends' ? 'Renda Passiva & Dividendos' :
      activeStrategy === 'diversification' ? 'Diversificação de Riscos' : 'Personalizada';

    let text = `📋 ORDENS DE APORTE & REBALANCEAMENTO - ${dateStr}\n`;
    text += `Estratégia: ${stratName}\n`;
    text += `Total Alocado: R$ ${simulation.totalAllocated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${activeOrders.length} ordens)\n`;
    if (simulation.unallocatedRemainder > 0) {
      text += `Sobra de Caixa: R$ ${simulation.unallocatedRemainder.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    }
    text += `--------------------------------------------------\n`;

    activeOrders.forEach((o, idx) => {
      text += `${idx + 1}. ${o.ticker} (${o.type}) | ${o.suggestedQuantity} cotas @ R$ ${o.currentPrice.toFixed(2)} = R$ ${o.suggestedAmount.toFixed(2)}\n`;
    });

    text += `--------------------------------------------------\n`;
    text += `Gerado pelo Motor Inteligente de Aportes`;

    navigator.clipboard.writeText(text);
    setCopiedOrders(true);
    setTimeout(() => setCopiedOrders(false), 3000);
    toast.success('Lista de ordens copiada para a área de transferência!');
  };

  // Prepare Execution Modal
  const handleOpenExecutionModal = () => {
    if (activeOrders.length === 0) {
      toast.info('Nenhuma ordem de compra para executar com o valor atual.');
      return;
    }

    const ordersToExecute = activeOrders.map(s => ({
      ticker: s.ticker,
      type: s.type,
      price: s.currentPrice,
      priceStr: s.currentPrice.toFixed(2),
      quantity: s.suggestedQuantity,
      quantityStr: s.suggestedQuantity.toString(),
      amount: s.suggestedAmount,
      costs: 0,
      costsStr: "0.00"
    }));

    setPendingOrders(ordersToExecute);
  };

  // Confirm and register batch buy orders
  const handleConfirmBatchBuy = async () => {
    if (!pendingOrders || isExecuting) return;
    setIsExecuting(true);
    try {
      const ordersWithMetadata = pendingOrders.map(o => ({
        ticker: o.ticker,
        type: o.type,
        price: o.price,
        quantity: o.quantity,
        amount: o.amount,
        costs: o.costs || 0,
        reserve_id: selectedReserveIdForExecution || undefined,
        date: executionDate
      }));

      if (onBatchBuy) {
        await onBatchBuy(ordersWithMetadata);
      } else if (onExecuteOrders) {
        await onExecuteOrders(ordersWithMetadata);
      }

      toast.success(`${pendingOrders.length} compras registradas com sucesso na sua carteira!`);
      setPendingOrders(null);
      setManualQtyAdjustments({});
    } catch (err) {
      console.error(err);
      toast.error('Erro ao registrar lançamentos de aporte.');
    } finally {
      setIsExecuting(false);
    }
  };

  const hasManualChanges = Object.keys(manualQtyAdjustments).length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. Header Estratégico & Ações Rápidas */}
      <div className="bg-card border border-border/70 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 shrink-0 shadow-inner">
              <Scale className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                  Motor Inteligente de Aportes & Rebalanceamento
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                  Gap Solver Pro
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-medium leading-relaxed max-w-2xl">
                Otimização matemática focada em equilíbrio de carteira, qualidade fundamentalista B3 e margem de segurança sem vender ativos.
              </p>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveViewMode('targets')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                activeViewMode === 'targets' 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20' 
                  : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-indigo-500" />
              <span>Metas ({totalTargetAllocation.toFixed(0)}%)</span>
            </button>

            <button
              onClick={() => setIsEditingRules(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Filtros de Risco</span>
            </button>

            <button
              onClick={() => setIsAddAssetModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>Adicionar Ativo</span>
            </button>

            <button
              onClick={handleCopyOrdersToClipboard}
              disabled={activeOrders.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Copiar lista de ordens para colar no Home Broker ou notas"
            >
              {copiedOrders ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-sky-500" />}
              <span>{copiedOrders ? 'Copiado!' : 'Copiar Home Broker'}</span>
            </button>
          </div>
        </div>

        {/* Strategies Cards */}
        <div className="pt-2 border-t border-border/60">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { id: 'rebalance', label: 'Rebalanceamento Puro', icon: Scale, desc: 'Gap Solver (recompõe atrasados)', color: 'text-indigo-500' },
              { id: 'quality', label: 'Qualidade Máxima', icon: ShieldCheck, desc: 'Score Fundamentalista B3', color: 'text-emerald-500' },
              { id: 'valuation', label: 'Valuation & Teto', icon: Sparkles, desc: 'Desconto e Preço Teto', color: 'text-amber-500' },
              { id: 'dividends', label: 'Renda Passiva', icon: Coins, desc: 'Foco em Dividend Yield', color: 'text-sky-500' },
              { id: 'diversification', label: 'Diversificação', icon: TrendingUp, desc: 'Diluição de concentração', color: 'text-pink-500' },
              { id: 'custom', label: 'Personalizado', icon: SlidersHorizontal, desc: 'Pesos manuais do investidor', color: 'text-purple-500' }
            ].map((strat) => {
              const isSelected = activeStrategy === strat.id;
              const Icon = strat.icon;
              return (
                <button
                  key={strat.id}
                  onClick={() => setActiveStrategy(strat.id as RebalanceStrategyType)}
                  className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-indigo-500/10 border-indigo-500 text-foreground ring-2 ring-indigo-500/20 shadow-sm' 
                      : 'bg-card border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40'
                  }`}
                >
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5 truncate">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${strat.color}`} />
                    <span className="truncate">{strat.label}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 leading-tight line-clamp-2">{strat.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Weights Drawer (if strategy is custom) */}
        {activeStrategy === 'custom' && (
          <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl space-y-3 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400">
                <SlidersHorizontal className="w-4 h-4" />
                <span>Pesos da Estratégia Customizada</span>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground bg-card px-2 py-0.5 rounded border border-border">
                Total: {Object.values(rulesConfig.customWeights).reduce((a, b) => a + b, 0)}%
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Gap de Alocação', key: 'gapWeight', color: 'accent-indigo-500' },
                { label: 'Qualidade (Score)', key: 'qualityWeight', color: 'accent-emerald-500' },
                { label: 'Valuation / Preço Teto', key: 'valuationWeight', color: 'accent-amber-500' },
                { label: 'Dividend Yield', key: 'dividendWeight', color: 'accent-sky-500' },
                { label: 'Liquidez Diária', key: 'liquidityWeight', color: 'accent-slate-500' },
              ].map((weight) => (
                <div key={weight.key} className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-muted-foreground uppercase">{weight.label}</span>
                    <span className="text-foreground">{rulesConfig.customWeights[weight.key as keyof StrategyWeights]}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={rulesConfig.customWeights[weight.key as keyof StrategyWeights]}
                    onChange={(e) => {
                      const newVal = Number(e.target.value);
                      setRulesConfig(prev => ({
                        ...prev,
                        customWeights: { ...prev.customWeights, [weight.key]: newVal }
                      }));
                    }}
                    className={`w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer ${weight.color}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Console de Aporte & Orçamento Inteligente */}
      <div className="bg-card border border-border/70 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Input do Aporte */}
          <div className="space-y-2 flex-1 max-w-md">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-indigo-500" />
                Valor do Aporte Planejado
              </label>
              {hasManualChanges && (
                <button
                  onClick={handleResetManualAdjustments}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurar Sugestão Matemática
                </button>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-base">R$</span>
              <input
                type="number"
                min={0}
                step={100}
                value={contributionAmount || ''}
                placeholder="0,00"
                onChange={(e) => setContributionAmount(Math.max(0, Number(e.target.value)))}
                className="w-full bg-background border border-border/80 focus:border-indigo-500 rounded-2xl pl-12 pr-4 py-3 text-lg font-black text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Atalhos Rápidos e Reserva */}
          <div className="flex flex-wrap items-center gap-2">
            {invReserve && invReserveBalance > 0 && (
              <button
                onClick={() => setContributionAmount(invReserveBalance)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                  contributionAmount === invReserveBalance 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20' 
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                }`}
                title={`Usar saldo da ${invReserve.name}`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Usar Reserva ({formatBRL(invReserveBalance)})</span>
              </button>
            )}

            {[500, 1000, 2500, 5000, 10000].map(val => (
              <button
                key={val}
                onClick={() => setContributionAmount(prev => (prev === val ? 0 : val))}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  contributionAmount === val 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20' 
                    : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                + R$ {val >= 1000 ? `${val / 1000}k` : val}
              </button>
            ))}

            {contributionAmount > 0 && (
              <button
                onClick={() => setContributionAmount(0)}
                className="p-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Zerar valor do aporte"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 4 Cards de Métricas e Execução */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border/60">
          
          {/* Card 1: Total Alocado */}
          <div className="p-4 bg-background border border-border/70 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
              Total em Compras
            </span>
            <div className="text-xl sm:text-2xl font-black text-foreground">
              {formatBRL(simulation.totalAllocated)}
            </div>
            <div className="text-[11px] font-bold text-muted-foreground flex items-center justify-between">
              <span>Sobra no Caixa:</span>
              <span className={simulation.unallocatedRemainder > 0 ? 'text-amber-500' : 'text-muted-foreground'}>
                {formatBRL(simulation.unallocatedRemainder)}
              </span>
            </div>
          </div>

          {/* Card 2: Eficácia do Rebalanceio */}
          <div className="p-4 bg-background border border-border/70 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
              Eficiência do Rebalanceio
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="w-5 h-5" />
              <span>{simulation.overallDeviationReductionPct}%</span>
            </div>
            <div className="text-[11px] font-medium text-muted-foreground">
              Redução do desvio geral da meta
            </div>
          </div>

          {/* Card 3: Ativos a Comprar */}
          <div className="p-4 bg-background border border-border/70 rounded-2xl space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
              Ativos Selecionados
            </span>
            <div className="text-xl sm:text-2xl font-black text-foreground">
              {activeOrders.length} <span className="text-xs font-bold text-muted-foreground">de {normalizedPositions.length} ativos</span>
            </div>
            <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-indigo-500" />
              <span>{simulation.restrictedAssetsCount} travados/fora de critérios</span>
            </div>
          </div>

          {/* Card 4: Botão Executar */}
          <div className="flex flex-col justify-center">
            <button
              disabled={activeOrders.length === 0 || isExecuting}
              onClick={handleOpenExecutionModal}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-muted disabled:text-muted-foreground text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isExecuting ? 'Processando...' : 'Executar Aportes'}</span>
            </button>
          </div>
        </div>

        {/* Resumo Executivo / Diagnóstico */}
        <div className="p-4 bg-indigo-500/5 border border-indigo-500/15 rounded-2xl text-xs text-foreground/90 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <div className="leading-relaxed font-medium">
            <strong className="text-indigo-600 dark:text-indigo-400 font-bold block sm:inline mr-1">Parecer do Motor:</strong>
            {simulation.executiveSummary}
          </div>
        </div>
      </div>

      {/* 3. Navegador de Modos de Exibição & Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Seletor de Modo */}
        <div className="flex items-center bg-card border border-border/70 rounded-2xl p-1 shadow-sm w-fit">
          <button
            onClick={() => setActiveViewMode('cards')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeViewMode === 'cards' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Cards Didáticos</span>
          </button>

          <button
            onClick={() => setActiveViewMode('table')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeViewMode === 'table' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Tabela Executiva</span>
          </button>

          <button
            onClick={() => setActiveViewMode('visual')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeViewMode === 'visual' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Antes vs Depois</span>
          </button>

          <button
            onClick={() => setActiveViewMode('targets')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeViewMode === 'targets' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Metas Alvo</span>
          </button>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Busca */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar ticker..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border/70 rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Filtro Tipo */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-card border border-border/70 rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">Todas Classes</option>
            <option value="Ação">Ações</option>
            <option value="FII">FIIs</option>
            <option value="ETF">ETFs</option>
            <option value="BDR">BDRs</option>
          </select>

          {/* Filtro Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-card border border-border/70 rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">Todos Ativos</option>
            <option value="suggested">Apenas Sugeridos ({activeOrders.length})</option>
            <option value="neutral">Sem Aporte</option>
            <option value="restricted">Travados/Restritos ({simulation.restrictedAssetsCount})</option>
          </select>
        </div>
      </div>

      {/* 4. VISUALIZAÇÃO: CARDS DIDÁTICOS */}
      {activeViewMode === 'cards' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuggestions.map((item) => {
              const isBuying = item.suggestedQuantity > 0;
              const isLocked = item.status === 'locked';
              const isRestricted = item.status === 'restricted';
              const tickerUpper = item.ticker.toUpperCase();
              const valTarget = customMetadata?.[tickerUpper]?.valuation_target || customMetadata?.[tickerUpper]?.valuationTarget || customMetadata?.[tickerUpper]?.targetPrice;
              const hasValuation = valTarget && valTarget > 0;
              const valMargin = hasValuation ? ((valTarget - item.currentPrice) / item.currentPrice) * 100 : 0;

              return (
                <div
                  key={item.ticker}
                  className={`p-5 rounded-3xl border transition-all duration-200 relative flex flex-col justify-between ${
                    isBuying
                      ? 'bg-card border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-lg shadow-indigo-500/5'
                      : isLocked || isRestricted
                      ? 'bg-muted/30 border-border/40 opacity-75'
                      : 'bg-card border-border/60 hover:border-border'
                  }`}
                >
                  {/* Card Header */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black shrink-0 ${
                          item.rank === 1 ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' :
                          item.rank === 2 ? 'bg-slate-300 text-slate-800' :
                          item.rank === 3 ? 'bg-amber-700 text-white' :
                          'bg-muted text-muted-foreground font-bold'
                        }`}>
                          #{item.rank}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-base text-foreground tracking-tight">{item.ticker}</span>
                            <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-muted text-muted-foreground uppercase">
                              {item.type}
                            </span>
                            {isLocked && (
                              <span className="text-rose-500" title="Ativo travado para aportes">
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground block truncate max-w-[170px]" title={item.name}>
                            {item.name || item.ticker}
                          </span>
                        </div>
                      </div>

                      {/* Score Motor */}
                      <div className="text-right">
                        <div className="text-lg font-black text-foreground leading-none">
                          {item.priorityScore}
                        </div>
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Score</span>
                      </div>
                    </div>

                    {/* Preço & Margem de Segurança */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-bold block">Cotação Atual</span>
                        <span className="font-black text-foreground">{formatBRL(item.currentPrice)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground font-bold block">Alocação vs Meta</span>
                        <span className="font-bold text-foreground">
                          {item.currentPct.toFixed(1)}% <span className="text-muted-foreground">/ {item.targetPct.toFixed(1)}%</span>
                        </span>
                      </div>
                    </div>

                    {/* Badge de Preço Teto / Valuation se existir */}
                    {hasValuation && (
                      <div className={`p-2 rounded-xl text-[11px] font-bold flex items-center justify-between ${
                        valMargin >= 0 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      }`}>
                        <span>Preço Teto: {formatBRL(valTarget)}</span>
                        <span>{valMargin >= 0 ? `+${valMargin.toFixed(0)}% margem` : `${valMargin.toFixed(0)}% ágio`}</span>
                      </div>
                    )}

                    {/* Bloco de Ordem Sugerida / Controles Interativos */}
                    {isBuying ? (
                      <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            Aporte Sugerido
                          </span>
                          <span className="text-base font-black text-foreground">
                            {formatBRL(item.suggestedAmount)}
                          </span>
                        </div>

                        {/* Controles de Cotas [+] e [-] */}
                        <div className="flex items-center justify-between pt-1 border-t border-indigo-500/15">
                          <span className="text-xs font-bold text-foreground">
                            Quantidade:
                          </span>
                          <div className="flex items-center gap-1.5 bg-background border border-border/80 rounded-xl p-0.5">
                            <button
                              onClick={() => handleAdjustQuantity(item.ticker, -1)}
                              disabled={item.suggestedQuantity <= 0}
                              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg disabled:opacity-30 transition-colors cursor-pointer"
                              title="Reduzir 1 cota"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-black text-foreground px-2 min-w-[28px] text-center">
                              {item.suggestedQuantity}
                            </span>
                            <button
                              onClick={() => handleAdjustQuantity(item.ticker, 1)}
                              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                              title="Adicionar 1 cota"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Projeção pós aporte */}
                        <div className="text-[10px] font-bold text-muted-foreground flex items-center justify-between">
                          <span>Projeção pós-aporte:</span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {item.currentPct.toFixed(1)}% ➔ {item.projectedPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-muted/40 border border-border/50 rounded-2xl text-center min-h-[70px] flex items-center justify-center">
                        <p className="text-[11px] text-muted-foreground font-medium">
                          {isLocked 
                            ? 'Ativo bloqueado para novos aportes pelo investidor.' 
                            : isRestricted 
                            ? (item.restrictionReason || 'Não atende aos critérios de risco atuais.') 
                            : 'Posição equilibrada na carteira no momento.'}
                        </p>
                      </div>
                    )}

                    {/* Motivos Pedagógicos */}
                    <div className="space-y-1 pt-1">
                      {item.reasons.slice(0, 2).map((r, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </div>
                      ))}
                      {item.risks.slice(0, 1).map((risk, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-500 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/50">
                    <button
                      onClick={() => handleToggleLock(item.ticker)}
                      className={`text-xs font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-colors cursor-pointer ${
                        isLocked 
                          ? 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400' 
                          : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground'
                      }`}
                      title={isLocked ? 'Destravar para receber aportes' : 'Travar ativo (não receber aportes)'}
                    >
                      {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      <span>{isLocked ? 'Travado' : 'Travar'}</span>
                    </button>

                    {onOpenRaioX && (
                      <button
                        onClick={() => onOpenRaioX(item.ticker)}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Raio-X</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. VISUALIZAÇÃO: TABELA EXECUTIVA DE ORDENS */}
      {activeViewMode === 'table' && (
        <div className="bg-card border border-border/70 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground font-black uppercase text-[10px] tracking-wider">
                  <th className="px-4 py-3">Rank / Ativo</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3 text-right">Cotação</th>
                  <th className="px-3 py-3 text-right">Posição Atual</th>
                  <th className="px-3 py-3 text-right">Meta %</th>
                  <th className="px-3 py-3 text-right">Gap (R$)</th>
                  <th className="px-4 py-3 text-center">Cotas a Comprar</th>
                  <th className="px-4 py-3 text-right">Aporte Sugerido</th>
                  <th className="px-3 py-3 text-right">Pós-Aporte %</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredSuggestions.map((item) => {
                  const isBuying = item.suggestedQuantity > 0;
                  const isLocked = item.status === 'locked';

                  return (
                    <tr
                      key={item.ticker}
                      className={`hover:bg-muted/30 transition-colors ${
                        isBuying ? 'bg-indigo-500/[0.02]' : isLocked ? 'opacity-60 bg-muted/10' : ''
                      }`}
                    >
                      {/* Ticker & Rank */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-muted-foreground w-5">#{item.rank}</span>
                          <div>
                            <span className="font-black text-foreground text-sm block leading-none">{item.ticker}</span>
                            <span className="text-[10px] text-muted-foreground truncate block max-w-[120px]">{item.name}</span>
                          </div>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="px-3 py-3.5">
                        <span className="px-2 py-0.5 rounded-lg bg-muted text-[10px] font-bold text-muted-foreground uppercase">
                          {item.type}
                        </span>
                      </td>

                      {/* Cotação */}
                      <td className="px-3 py-3.5 text-right font-bold text-foreground">
                        {formatBRL(item.currentPrice)}
                      </td>

                      {/* Posição Atual */}
                      <td className="px-3 py-3.5 text-right font-medium">
                        <div className="text-foreground font-bold">{formatBRL(item.currentValue)}</div>
                        <div className="text-[10px] text-muted-foreground">{item.currentQuantity} cotas ({item.currentPct.toFixed(1)}%)</div>
                      </td>

                      {/* Meta % */}
                      <td className="px-3 py-3.5 text-right font-black text-foreground">
                        {item.targetPct.toFixed(1)}%
                      </td>

                      {/* Gap Financeiro */}
                      <td className="px-3 py-3.5 text-right font-bold text-muted-foreground">
                        {item.gapAmount > 0 ? formatBRL(item.gapAmount) : 'R$ 0,00'}
                      </td>

                      {/* Cotas a Comprar com [+] e [-] */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-background border border-border/80 rounded-xl p-0.5">
                          <button
                            onClick={() => handleAdjustQuantity(item.ticker, -1)}
                            disabled={item.suggestedQuantity <= 0}
                            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg disabled:opacity-30 transition-colors cursor-pointer"
                            title="Diminuir 1 cota"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className={`text-xs font-black px-2 min-w-[24px] ${isBuying ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-muted-foreground'}`}>
                            {item.suggestedQuantity}
                          </span>
                          <button
                            onClick={() => handleAdjustQuantity(item.ticker, 1)}
                            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                            title="Aumentar 1 cota"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Aporte Sugerido (R$) */}
                      <td className="px-4 py-3.5 text-right font-black text-foreground">
                        {isBuying ? (
                          <span className="text-indigo-600 dark:text-indigo-400">{formatBRL(item.suggestedAmount)}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Pós-Aporte % */}
                      <td className="px-3 py-3.5 text-right font-bold">
                        <span className={item.projectedPct >= item.targetPct ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}>
                          {item.projectedPct.toFixed(1)}%
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleToggleLock(item.ticker)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isLocked ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' : 'text-muted-foreground hover:text-foreground border-border'
                            }`}
                            title={isLocked ? 'Destravar ativo' : 'Travar ativo'}
                          >
                            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>
                          {onOpenRaioX && (
                            <button
                              onClick={() => onOpenRaioX(item.ticker)}
                              className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                              title="Abrir Raio-X"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Rodapé Totalizador */}
              <tfoot className="bg-muted/40 border-t border-border font-black text-foreground">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">
                    Total em Compras Sugeridas:
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    {activeOrders.reduce((acc, o) => acc + o.suggestedQuantity, 0)} cotas
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-indigo-600 dark:text-indigo-400">
                    {formatBRL(simulation.totalAllocated)}
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-right text-xs text-muted-foreground">
                    Sobra: {formatBRL(simulation.unallocatedRemainder)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 6. VISUALIZAÇÃO: COMPARATIVO ANTES VS DEPOIS */}
      {activeViewMode === 'visual' && (
        <div className="space-y-6">
          
          {/* Macro-Classes (Ações vs FIIs vs BDRs) */}
          <div className="bg-card border border-border/70 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-foreground tracking-tight flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-indigo-500" />
                  Alocação por Macro-Classes (Antes vs Depois)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Veja como o aporte equilibra as grandes classes de ativos da sua carteira.
                </p>
              </div>
              <button
                onClick={() => setIsMacroClassModalOpen(true)}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Modelos por Classe
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {macroClassesData.map((cls) => (
                <div key={cls.type} className="p-4 bg-background border border-border/70 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-foreground text-sm">{cls.type}</span>
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                      Meta: {cls.targetPct.toFixed(1)}%
                    </span>
                  </div>

                  {/* Barras Comparativas */}
                  <div className="space-y-2 text-xs font-bold">
                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Atual</span>
                        <span>{cls.currentPct.toFixed(1)}% ({formatBRL(cls.currentValue)})</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-slate-400 rounded-full"
                          style={{ width: `${Math.min(100, cls.currentPct)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-emerald-600 dark:text-emerald-400 mb-1">
                        <span>Projetado pós-aporte</span>
                        <span>{cls.projectedPct.toFixed(1)}% ({formatBRL(cls.projectedValue)})</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, cls.projectedPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] font-bold text-muted-foreground flex justify-between pt-1 border-t border-border/50">
                    <span>Aporte na classe:</span>
                    <span className="text-foreground">{formatBRL(cls.suggestedAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comparativo Ativo a Ativo */}
          <div className="bg-card border border-border/70 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-black text-foreground tracking-tight flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                Alocação por Ativo Individual em Direção à Meta
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acompanhe o fechamento do gap de cada ativo individual.
              </p>
            </div>

            <div className="space-y-3">
              {simulation.suggestions.map((item) => {
                const isBuying = item.suggestedQuantity > 0;
                return (
                  <div key={item.ticker} className="p-3 bg-background border border-border/60 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-foreground text-sm">{item.ticker}</span>
                        <span className="text-[10px] text-muted-foreground px-1.5 py-0.2 rounded bg-muted uppercase">{item.type}</span>
                        {isBuying && (
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            + {item.suggestedQuantity} cotas ({formatBRL(item.suggestedAmount)})
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground text-[11px]">Atual {item.currentPct.toFixed(1)}% ➔ </span>
                        <span className={`font-black ${isBuying ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                          {item.projectedPct.toFixed(1)}%
                        </span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-black ml-1.5">(Meta {item.targetPct.toFixed(1)}%)</span>
                      </div>
                    </div>

                    {/* Barra de Progresso Comparativa */}
                    <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
                      {/* Barra Atual */}
                      <div 
                        className="absolute left-0 top-0 h-full bg-slate-400/80 rounded-full z-10"
                        style={{ width: `${Math.min(100, (item.currentPct / Math.max(item.targetPct, item.projectedPct, 1)) * 100)}%` }}
                      />
                      {/* Barra Projetada */}
                      <div 
                        className="absolute left-0 top-0 h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (item.projectedPct / Math.max(item.targetPct, item.projectedPct, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 7. VISUALIZAÇÃO: GERENCIADOR DE METAS ALVO */}
      {activeViewMode === 'targets' && (
        <div className="bg-card border border-border/70 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-500" />
                Definição de Metas de Alocação & Cotações
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Defina o peso ideal de cada ativo, acompanhe cotações em tempo real e edite ou exclua ativos configurados.
              </p>
            </div>

            {/* Ações em Massa */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleFetchAllTargetQuotes(false)}
                disabled={isFetchingAllTargets || isGlobalFetchingQuotes}
                className="px-3.5 py-2 bg-muted/60 hover:bg-muted text-foreground text-xs font-bold rounded-xl border border-border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Buscar e atualizar cotações de todos os ativos configurados"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isFetchingAllTargets || isGlobalFetchingQuotes ? 'animate-spin' : ''}`} />
                <span>{isFetchingAllTargets ? 'Buscando Cotações...' : 'Buscar Cotações'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddAssetModalOpen(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Adicionar Ativo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const count = Object.keys(editableTargets).length;
                  if (count > 0) {
                    const equal = Number((100 / count).toFixed(1));
                    const next = { ...editableTargets };
                    Object.keys(next).forEach(k => {
                      next[k] = { ...next[k], targetPct: equal, minPct: Math.max(0, equal - 2), maxPct: equal + 5 };
                    });
                    setEditableTargets(next);
                    toast.info(`Pesos distribuídos igualmente (${equal}% por ativo).`);
                  }
                }}
                className="px-3.5 py-2 bg-muted/60 hover:bg-muted text-foreground text-xs font-bold rounded-xl border border-border transition-all cursor-pointer"
              >
                Equidistribuir (1/N)
              </button>

              <button
                type="button"
                onClick={handleSaveTargetAllocations}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Salvar Metas</span>
              </button>
            </div>
          </div>

          {/* Barra de Progresso Total Alocado */}
          <div className="p-4 bg-background border border-border/70 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-muted-foreground uppercase tracking-wider">Total de Metas Distribuídas:</span>
              <span className={Math.abs(totalTargetAllocation - 100) < 0.1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}>
                {totalTargetAllocation.toFixed(1)}% / 100%
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  Math.abs(totalTargetAllocation - 100) < 0.1 ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, totalTargetAllocation)}%` }}
              />
            </div>
          </div>

          {/* Barra de Estatísticas & Filtros Rápidos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted/20 border border-border/50 rounded-2xl">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2.5 py-1 bg-background border border-border/70 rounded-lg font-bold text-foreground">
                {Object.keys(editableTargets).length} ativos
              </span>
              
              {(() => {
                const total = Object.keys(editableTargets).length;
                const withQuotes = Object.keys(editableTargets).filter(tk => (effectiveQuotes[tk] || 0) > 0).length;
                const missing = total - withQuotes;

                if (missing > 0) {
                  return (
                    <button
                      type="button"
                      onClick={() => handleFetchAllTargetQuotes(true)}
                      disabled={isFetchingAllTargets}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{missing} sem cotação (Clique para buscar)</span>
                    </button>
                  );
                }
                return (
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg font-bold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Todas as cotações sincronizadas</span>
                  </span>
                );
              })()}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filtrar ticker..."
                  value={targetSearchQuery}
                  onChange={(e) => setTargetSearchQuery(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={targetTypeFilter}
                onChange={(e) => setTargetTypeFilter(e.target.value)}
                className="bg-background border border-border/70 rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Todas as Classes</option>
                <option value="Ação">Ações</option>
                <option value="FII">FIIs</option>
                <option value="ETF">ETFs</option>
                <option value="BDR">BDRs</option>
                <option value="Renda Fixa">Renda Fixa</option>
              </select>
            </div>
          </div>

          {/* Grid de Edição de Metas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(editableTargets)
              .filter(ticker => {
                if (targetTypeFilter !== 'all' && editableTargets[ticker]?.type !== targetTypeFilter) {
                  return false;
                }
                if (targetSearchQuery) {
                  return ticker.toLowerCase().includes(targetSearchQuery.toLowerCase());
                }
                return true;
              })
              .map(ticker => {
                const t = editableTargets[ticker];
                const isZero = t.targetPct === 0;
                const isHeld = holdingTickers.has(ticker);
                const currentQuote = effectiveQuotes[ticker] || (t as any).lastPrice || 0;
                const isLoadingQuote = Boolean(loadingQuoteTickers[ticker]);
                const valTarget = customMetadata?.[ticker]?.targetPrice;

                return (
                  <div
                    key={ticker}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${
                      isZero ? 'bg-muted/20 border-border/40 opacity-70' : 'bg-background border-border/70 hover:border-border shadow-sm'
                    }`}
                  >
                    {/* Header do Card: Ticker, Badges & Input % */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black border border-indigo-500/20 shrink-0">
                          {ticker.slice(0, 4)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-foreground text-sm truncate leading-none">{ticker}</span>
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                              isHeld
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                            }`}>
                              {isHeld ? 'Carteira' : 'Estudo'}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-bold uppercase mt-0.5 block">{t.type}</span>
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={t.targetPct}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setEditableTargets(prev => ({
                              ...prev,
                              [ticker]: {
                                ...prev[ticker],
                                targetPct: val,
                                minPct: Math.max(0, val - 2),
                                maxPct: val + 5
                              }
                            }));
                          }}
                          className="w-14 bg-muted/60 border border-border/80 rounded-lg px-1.5 py-1 text-xs font-black text-right text-foreground focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-xs font-black text-muted-foreground">%</span>
                      </div>
                    </div>

                    {/* Faixa de Cotação & Valuation */}
                    <div className="p-2.5 bg-muted/30 border border-border/50 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground font-bold">Cotação:</span>
                        {currentQuote > 0 ? (
                          <span className="font-black text-foreground">{formatBRL(currentQuote)}</span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Sem cotação
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {valTarget > 0 && (
                          <span className="text-[10px] text-muted-foreground font-bold px-1.5 py-0.5 bg-muted rounded border border-border/50">
                            Teto: {formatBRL(valTarget)}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleFetchQuoteForSingleTicker(ticker)}
                          disabled={isLoadingQuote}
                          className="p-1 text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-muted rounded-md transition-colors cursor-pointer"
                          title="Buscar cotação online agora"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQuote ? 'animate-spin text-indigo-500' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Slider */}
                    <input
                      type="range"
                      min="0"
                      max="40"
                      step="0.5"
                      value={t.targetPct}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setEditableTargets(prev => ({
                          ...prev,
                          [ticker]: {
                            ...prev[ticker],
                            targetPct: val,
                            minPct: Math.max(0, val - 2),
                            maxPct: val + 5
                          }
                        }));
                      }}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />

                    {/* Rodapé do Card: Faixa de Tolerância e Botões Editar / Excluir */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[10px]">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span>Faixa:</span>
                        <span className="font-bold text-foreground">{t.minPct || 0}% - {t.maxPct || 15}%</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Lock Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleLock(ticker)}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            t.locked ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' : 'text-muted-foreground border-border/60 hover:text-foreground'
                          }`}
                          title={t.locked ? 'Destravar ativo para aportes' : 'Travar ativo (não receber aportes)'}
                        >
                          {t.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </button>

                        {/* Botão Editar Ativo */}
                        <button
                          type="button"
                          onClick={() => setEditingTargetTicker(ticker)}
                          className="px-2 py-1 rounded-lg border border-border/70 bg-muted/40 hover:bg-muted text-foreground font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Editar tipo, meta, limites e valuation deste ativo"
                        >
                          <Edit3 className="w-3 h-3 text-indigo-500" />
                          <span>Editar</span>
                        </button>

                        {/* Botão Excluir Ativo */}
                        <button
                          type="button"
                          onClick={() => setTargetToDelete(ticker)}
                          className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 transition-colors cursor-pointer"
                          title="Excluir este ativo das metas de alocação"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR NOVO ATIVO */}
      <AddRebalanceAssetModal
        isOpen={isAddAssetModalOpen}
        onClose={() => setIsAddAssetModalOpen(false)}
        onAddAsset={(newAsset) => {
          const tickerUpper = newAsset.ticker.toUpperCase().trim();
          const nextTargets: Record<string, AssetAllocationTarget> = {
            ...editableTargets,
            [tickerUpper]: {
              ticker: tickerUpper,
              type: newAsset.type as any,
              targetPct: newAsset.targetPct,
              minPct: Math.max(0, newAsset.targetPct - 2),
              maxPct: newAsset.targetPct + 5,
              locked: false,
              lastPrice: newAsset.price
            }
          };
          setEditableTargets(nextTargets);
          if (newAsset.price > 0) {
            setLocalQuotes(prev => ({ ...prev, [tickerUpper]: newAsset.price }));
          }
          if (onSaveTargets) {
            onSaveTargets(nextTargets);
          }
          // Fetch live quote for the new ticker
          handleFetchQuoteForSingleTicker(tickerUpper, false);
          toast.success(`Ativo ${tickerUpper} adicionado às metas com sucesso!`);
        }}
        existingTickers={Object.keys(editableTargets)}
        leftoverTargetPct={Math.max(0, 100 - totalTargetAllocation)}
        brapiToken={settings?.brapi_token}
        formatCurrency={formatBRL}
      />

      {/* MODAL: EDITAR ATIVO ALVO */}
      {editingTargetTicker && editableTargets[editingTargetTicker] && (
        <EditTargetAssetModal
          isOpen={Boolean(editingTargetTicker)}
          onClose={() => setEditingTargetTicker(null)}
          target={editableTargets[editingTargetTicker]}
          currentQuote={effectiveQuotes[editingTargetTicker]}
          valuationTarget={customMetadata?.[editingTargetTicker]?.targetPrice}
          isInPortfolio={holdingTickers.has(editingTargetTicker)}
          onSave={handleSaveEditedTarget}
          onDelete={handleDeleteTarget}
          brapiToken={settings?.brapi_token}
          formatCurrency={formatBRL}
        />
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {targetToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl sm:rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">
                  Excluir {targetToDelete} das Metas Alvo?
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {holdingTickers.has(targetToDelete)
                    ? 'As cotas existentes em sua carteira permanecerão salvas, mas o ativo não receberá mais sugestões de novos aportes pelo motor.'
                    : 'O ativo foi adicionado para estudo e não possui cotas em carteira. Ele deixará de ser monitorado pelo motor.'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-muted/30 border border-border/60 rounded-xl text-xs text-muted-foreground">
              A meta percentual de <span className="font-bold text-foreground">{targetToDelete}</span> será removida, liberando percentual para outros ativos.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTargetToDelete(null)}
                className="px-4 py-2 bg-muted/60 hover:bg-muted text-foreground text-xs font-bold rounded-xl border border-border transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => handleDeleteTarget(targetToDelete)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir Ativo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGRAS & FILTROS DE RISCO */}
      {isEditingRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Filtros & Travas de Risco</h3>
                  <p className="text-xs text-muted-foreground">Parâmetros de proteção do algoritmo de aporte</p>
                </div>
              </div>
              <button onClick={() => setIsEditingRules(false)} className="p-2 text-muted-foreground hover:text-foreground rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Ações */}
                <div className="p-4 rounded-2xl border border-border/70 bg-background space-y-3">
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                    Critérios para Ações
                  </span>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Liquidez Diária Mínima</label>
                    <input
                      type="number"
                      step={100000}
                      value={rulesConfig.minDailyLiquidity}
                      onChange={e => setRulesConfig(prev => ({ ...prev, minDailyLiquidity: Number(e.target.value) }))}
                      className="w-full bg-muted/40 border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Dívida / EBITDA Máximo</label>
                    <input
                      type="number"
                      step={0.5}
                      value={rulesConfig.maxDebtEbitdaAllowed}
                      onChange={e => setRulesConfig(prev => ({ ...prev, maxDebtEbitdaAllowed: Number(e.target.value) }))}
                      className="w-full bg-muted/40 border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground"
                    />
                  </div>
                </div>

                {/* FIIs */}
                <div className="p-4 rounded-2xl border border-border/70 bg-background space-y-3">
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    Critérios para FIIs
                  </span>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">P/VP Máximo</label>
                    <input
                      type="number"
                      step={0.05}
                      value={rulesConfig.maxFiiPvpAllowed}
                      onChange={e => setRulesConfig(prev => ({ ...prev, maxFiiPvpAllowed: Number(e.target.value) }))}
                      className="w-full bg-muted/40 border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Vacância Física Máx (%)</label>
                    <input
                      type="number"
                      step={1}
                      value={rulesConfig.maxFiiPhysicalVacancyAllowed}
                      onChange={e => setRulesConfig(prev => ({ ...prev, maxFiiPhysicalVacancyAllowed: Number(e.target.value) }))}
                      className="w-full bg-muted/40 border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Teto Geral por Ativo */}
              <div className="p-4 rounded-2xl border border-border/70 bg-background space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-muted-foreground uppercase text-[10px]">Teto Máximo por Ativo na Carteira</span>
                  <span className="text-foreground">{rulesConfig.maxAssetAllocationPct}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="35"
                  step="1"
                  value={rulesConfig.maxAssetAllocationPct}
                  onChange={e => setRulesConfig(prev => ({ ...prev, maxAssetAllocationPct: Number(e.target.value) }))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-border flex items-center justify-end gap-3">
              <button onClick={() => setIsEditingRules(false)} className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (onSaveRulesConfig) onSaveRulesConfig(rulesConfig);
                  setIsEditingRules(false);
                  toast.success('Filtros de risco atualizados com sucesso!');
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MACRO CLASSES PRESETS */}
      <RebalanceMacroClassModal
        isOpen={isMacroClassModalOpen}
        onClose={() => setIsMacroClassModalOpen(false)}
        onApplyClassTargets={(classTargets) => {
          const next = { ...editableTargets };
          const tickers = Object.keys(next);
          
          Object.entries(classTargets).forEach(([cls, totalClassPct]) => {
            const classTickers = tickers.filter(t => next[t].type === cls);
            if (classTickers.length > 0) {
              const perAsset = Number((totalClassPct / classTickers.length).toFixed(1));
              classTickers.forEach(t => {
                next[t] = {
                  ...next[t],
                  targetPct: perAsset,
                  minPct: Math.max(0, perAsset - 2),
                  maxPct: perAsset + 5
                };
              });
            }
          });

          setEditableTargets(next);
          toast.success('Metas de macro-classes aplicadas com sucesso!');
        }}
        availableClasses={['Ação', 'FII', 'ETF', 'BDR', 'Renda Fixa']}
        currentClassWeights={macroClassesData.reduce((acc, c) => ({ ...acc, [c.type]: c.targetPct }), {})}
      />

      {/* MODAL: CONFIRMAR LANÇAMENTO DE APORTES COM TAXAS E RESERVA */}
      {pendingOrders !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Confirmar Execução dos Aportes</h3>
                  <p className="text-xs text-muted-foreground">Defina a reserva pagadora, data e taxas personalizadas</p>
                </div>
              </div>
              <button onClick={() => setPendingOrders(null)} className="p-2 text-muted-foreground hover:text-foreground rounded-xl cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Configurações Globais: Reserva & Data */}
            <div className="p-4 bg-muted/30 border-b border-border grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Debitar da Reserva</label>
                <select
                  value={selectedReserveIdForExecution}
                  onChange={(e) => setSelectedReserveIdForExecution(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Sem vínculo com reserva</option>
                  {reserves.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({formatBRL(r.saldo_atual || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Data do Lançamento</label>
                <input
                  type="date"
                  value={executionDate}
                  onChange={(e) => setExecutionDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Lista das Ordens a Executar */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {pendingOrders.map((order, index) => {
                const subtotal = order.price * order.quantity;
                const totalWithCosts = subtotal + (order.costs || 0);

                return (
                  <div key={order.ticker} className="p-4 bg-background border border-border/70 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-foreground text-sm">{order.ticker}</span>
                        <span className="px-1.5 py-0.2 rounded bg-muted text-[10px] font-bold text-muted-foreground uppercase">{order.type}</span>
                      </div>
                      <span className="text-xs font-black text-foreground">{formatBRL(totalWithCosts)}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Qtd</label>
                        <input
                          type="number"
                          value={order.quantityStr}
                          onChange={(e) => {
                            const val = e.target.value;
                            const qty = Math.max(0, parseInt(val) || 0);
                            setPendingOrders(prev => prev ? prev.map((o, i) => i === index ? { ...o, quantityStr: val, quantity: qty, amount: (qty * o.price) + (o.costs || 0) } : o) : null);
                          }}
                          className="w-full bg-muted/40 border border-border rounded-lg px-2 py-1 text-center font-bold text-foreground"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Preço (R$)</label>
                        <input
                          type="number"
                          step={0.01}
                          value={order.priceStr}
                          onChange={(e) => {
                            const val = e.target.value;
                            const pr = Math.max(0, parseFloat(val) || 0);
                            setPendingOrders(prev => prev ? prev.map((o, i) => i === index ? { ...o, priceStr: val, price: pr, amount: (o.quantity * pr) + (o.costs || 0) } : o) : null);
                          }}
                          className="w-full bg-muted/40 border border-border rounded-lg px-2 py-1 text-center font-bold text-foreground"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Taxa (R$)</label>
                        <input
                          type="number"
                          step={0.01}
                          value={order.costsStr}
                          onChange={(e) => {
                            const val = e.target.value;
                            const cost = Math.max(0, parseFloat(val) || 0);
                            setPendingOrders(prev => prev ? prev.map((o, i) => i === index ? { ...o, costsStr: val, costs: cost, amount: (o.quantity * o.price) + cost } : o) : null);
                          }}
                          className="w-full bg-muted/40 border border-border rounded-lg px-2 py-1 text-center font-bold text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-muted-foreground">Total das Ordens com Taxas:</span>
                <span className="text-base font-black text-foreground">
                  {formatBRL(pendingOrders.reduce((acc, o) => acc + (o.price * o.quantity) + (o.costs || 0), 0))}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPendingOrders(null)}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold border border-border text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmBatchBuy}
                  disabled={isExecuting}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isExecuting ? 'Gravando...' : 'Confirmar Compras'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
