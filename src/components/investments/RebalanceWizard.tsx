import React, { useState, useMemo, useEffect } from 'react';
import { InvestmentTransaction, UserSettings } from '../../types';
import { CurrencyInput } from '../CurrencyInput';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { 
  Scale, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  RefreshCw, 
  ArrowRight,
  Calculator,
  PieChart,
  Percent,
  Sliders,
  DollarSign,
  Save,
  RotateCcw,
  Search,
  Filter,
  Layers,
  TrendingUp,
  TrendingDown,
  Trash2,
  Copy,
  Check,
  Info,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  Target
} from 'lucide-react';
import { AddRebalanceAssetModal, CustomRebalanceAsset } from './AddRebalanceAssetModal';
import { RebalanceMacroClassModal } from './RebalanceMacroClassModal';

interface Position {
  ticker: string;
  type: string;
  totalQuantity: number;
  totalInvested: number;
  averagePrice: number;
  currentPrice: number | null;
  currentValue: number | null;
  dividendsReceived: number;
  yieldOnCost: number;
}

interface RebalanceWizardProps {
  positions: Position[];
  totalCurrentValue: number;
  hideValues: boolean;
  onBatchBuy: (items: Array<{ ticker: string; type: string; quantity: number; price: number; costs?: number }>) => Promise<void>;
  formatCurrency: (val: number) => string;
  quotes?: Record<string, number>;
  onFetchQuote?: (ticker: string) => Promise<void>;
}

export function RebalanceWizard({
  positions,
  totalCurrentValue,
  hideValues,
  onBatchBuy,
  formatCurrency,
  quotes = {},
  onFetchQuote
}: RebalanceWizardProps) {
  const dataContext = useData();
  const reserves = dataContext?.reserves || [];
  const settings = dataContext?.settings;

  // Custom / Planned assets state (not yet in real portfolio positions)
  const [customAssets, setCustomAssets] = useState<CustomRebalanceAsset[]>(() => {
    try {
      const raw = localStorage.getItem('rebalance_custom_assets');
      if (raw) return JSON.parse(raw);
    } catch (err) {
      console.warn('Error reading rebalance_custom_assets from localStorage:', err);
    }
    return [];
  });

  // Modals state
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [isMacroClassModalOpen, setIsMacroClassModalOpen] = useState(false);
  const [isConfirmBatchModalOpen, setIsConfirmBatchModalOpen] = useState(false);
  const [copiedOrders, setCopiedOrders] = useState(false);

  // View & Filter states
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'suballocated' | 'target' | 'current' | 'ticker'>('suballocated');
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(true);
  const [showVisualComparison, setShowVisualComparison] = useState<boolean>(true);
  const [visualTab, setVisualTab] = useState<'assets' | 'classes'>('assets');
  const [visualFilterOnlyBuying, setVisualFilterOnlyBuying] = useState<boolean>(false);

  // Find linked investment reserve
  const investmentReserve = useMemo(() => {
    if (settings?.default_investment_reserve_id) {
      const found = reserves.find(r => r.id === settings.default_investment_reserve_id);
      if (found) return found;
    }
    return reserves.find(r => 
      r.name.toLowerCase().includes('investim') || 
      r.name.toLowerCase().includes('oportunid') ||
      r.name.toLowerCase().includes('reserva')
    ) || reserves[0] || null;
  }, [reserves, settings]);

  const reserveBalance = investmentReserve?.saldo_atual ?? 0;

  const [contribution, setContribution] = useState<string>(() => {
    if (reserveBalance > 0) {
      return reserveBalance.toFixed(2);
    }
    return '1000';
  });

  // Overrides for price, quantity, and costs in the proposal
  const [overridePrices, setOverridePrices] = useState<Record<string, string>>({});
  const [overrideQuantities, setOverrideQuantities] = useState<Record<string, number>>({});
  const [overrideCosts, setOverrideCosts] = useState<Record<string, string>>({});
  const [defaultGlobalFee, setDefaultGlobalFee] = useState<string>('0,00');

  // Locked targets (won't be changed by auto-equalize)
  const [lockedTargets, setLockedTargets] = useState<Record<string, boolean>>({});

  // Auto-sync contribution when reserve balance changes or loads
  useEffect(() => {
    if (reserveBalance > 0 && (contribution === '1000' || contribution === '0' || !contribution)) {
      setContribution(reserveBalance.toFixed(2));
    }
  }, [reserveBalance]);

  // Persist custom assets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('rebalance_custom_assets', JSON.stringify(customAssets));
    } catch (err) {
      console.warn('Error saving rebalance_custom_assets to localStorage:', err);
    }
  }, [customAssets]);

  // Combined asset universe: Existing portfolio positions + Custom planned assets
  const combinedAssets = useMemo(() => {
    const map = new Map<string, Position & { isCustom?: boolean }>();

    // 1. Add real positions
    positions.forEach(p => {
      map.set(p.ticker.toUpperCase(), { ...p, isCustom: false });
    });

    // 2. Add custom assets (if not already existing in portfolio)
    customAssets.forEach(ca => {
      const tk = ca.ticker.toUpperCase();
      if (!map.has(tk)) {
        const livePrice = quotes[tk] || ca.price;
        map.set(tk, {
          ticker: tk,
          type: ca.type,
          totalQuantity: 0,
          totalInvested: 0,
          averagePrice: ca.price,
          currentPrice: livePrice,
          currentValue: 0,
          dividendsReceived: 0,
          yieldOnCost: 0,
          isCustom: true
        });
      }
    });

    return Array.from(map.values());
  }, [positions, customAssets, quotes]);

  // Targets state
  const [targets, setTargets] = useState<Record<string, number>>(() => {
    let saved: Record<string, number> | null = null;
    try {
      const raw = localStorage.getItem('rebalance_asset_targets');
      if (raw) saved = JSON.parse(raw);
    } catch (err) {
      console.warn('Error reading rebalance_asset_targets from localStorage:', err);
    }
    if (!saved && settings?.rebalance_targets) {
      saved = settings.rebalance_targets;
    }

    if (combinedAssets.length === 0) return saved || {};
    const equalShare = Number((100 / combinedAssets.length).toFixed(1));
    const initial: Record<string, number> = {};
    combinedAssets.forEach(p => {
      if (saved && typeof saved[p.ticker] === 'number') {
        initial[p.ticker] = saved[p.ticker];
      } else {
        // Check if it's a custom asset with a predefined target
        const matchCustom = customAssets.find(c => c.ticker.toUpperCase() === p.ticker.toUpperCase());
        initial[p.ticker] = matchCustom ? matchCustom.targetPct : equalShare;
      }
    });
    return initial;
  });

  // Make sure new assets added to combinedAssets get an initial target if missing
  useEffect(() => {
    setTargets(prev => {
      let changed = false;
      const updated = { ...prev };
      combinedAssets.forEach(p => {
        if (updated[p.ticker] === undefined) {
          const matchCustom = customAssets.find(c => c.ticker.toUpperCase() === p.ticker.toUpperCase());
          updated[p.ticker] = matchCustom ? matchCustom.targetPct : 0;
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [combinedAssets, customAssets]);

  // Save targets to localStorage and Supabase user_settings
  const persistTargets = async (newTargets: Record<string, number>, showToast = false) => {
    try {
      localStorage.setItem('rebalance_asset_targets', JSON.stringify(newTargets));
      if (settings?.user_id && settings.user_id !== 'local') {
        const { error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: settings.user_id,
            rebalance_targets: newTargets
          });
        if (error) {
          console.warn('Supabase rebalance_targets error:', error.message);
        }
      }
      if (showToast) {
        toast.success('Metas de alocação salvas com sucesso!');
      }
    } catch (err) {
      console.warn('Error persisting targets:', err);
    }
  };

  // Auto-save to localStorage whenever targets state changes
  useEffect(() => {
    if (Object.keys(targets).length > 0) {
      localStorage.setItem('rebalance_asset_targets', JSON.stringify(targets));
    }
  }, [targets]);

  const [isExecuting, setIsExecuting] = useState(false);

  // Helper parser for decimal input strings
  const parseDecimalInput = (val: string | number): number => {
    if (typeof val === 'number') return isNaN(val) || !isFinite(val) ? 0 : Math.max(0, val);
    if (!val) return 0;
    const str = val.toString().trim();
    if (!str) return 0;
    let num: number;
    if (str.includes(',')) {
      num = Number(str.replace(/\./g, '').replace(',', '.'));
    } else {
      num = Number(str);
    }
    return isNaN(num) || !isFinite(num) ? 0 : Math.max(0, num);
  };

  // Normalize contribution amount with safe string detection
  const numContribution = useMemo(() => {
    return parseDecimalInput(contribution);
  }, [contribution]);

  // Total Target Percentage
  const totalTargetPct = useMemo(() => {
    return Object.values(targets).reduce((acc, curr) => acc + (curr || 0), 0);
  }, [targets]);

  const leftoverTargetPct = useMemo(() => {
    return Math.max(0, 100 - totalTargetPct);
  }, [totalTargetPct]);

  // Distinct Asset Classes
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    combinedAssets.forEach(a => set.add(a.type));
    return Array.from(set).sort();
  }, [combinedAssets]);

  // Current weight per class
  const currentClassWeights = useMemo(() => {
    const map: Record<string, number> = {};
    availableClasses.forEach(cls => { map[cls] = 0; });
    combinedAssets.forEach(p => {
      const curVal = p.currentValue || p.totalInvested;
      if (totalCurrentValue > 0) {
        map[p.type] = (map[p.type] || 0) + (curVal / totalCurrentValue) * 100;
      }
    });
    return map;
  }, [combinedAssets, availableClasses, totalCurrentValue]);

  // Add custom asset handler
  const handleAddCustomAsset = (newAsset: CustomRebalanceAsset) => {
    setCustomAssets(prev => {
      const filtered = prev.filter(a => a.ticker.toUpperCase() !== newAsset.ticker.toUpperCase());
      return [...filtered, newAsset];
    });

    setTargets(prev => ({
      ...prev,
      [newAsset.ticker]: newAsset.targetPct
    }));

    if (newAsset.price > 0) {
      setOverridePrices(prev => ({
        ...prev,
        [newAsset.ticker]: newAsset.price.toFixed(2).replace('.', ',')
      }));
    }
  };

  // Remove custom asset handler
  const handleRemoveCustomAsset = (ticker: string) => {
    setCustomAssets(prev => prev.filter(a => a.ticker.toUpperCase() !== ticker.toUpperCase()));
    setTargets(prev => {
      const updated = { ...prev };
      delete updated[ticker];
      return updated;
    });
    setOverridePrices(prev => {
      const updated = { ...prev };
      delete updated[ticker];
      return updated;
    });
    setOverrideQuantities(prev => {
      const updated = { ...prev };
      delete updated[ticker];
      return updated;
    });
    setOverrideCosts(prev => {
      const updated = { ...prev };
      delete updated[ticker];
      return updated;
    });
    toast.info(`Ativo ${ticker} removido do rebalanceamento.`);
  };

  // Set equal targets for non-locked assets
  const handleEqualize = () => {
    if (combinedAssets.length === 0) return;
    const unlocked = combinedAssets.filter(p => !lockedTargets[p.ticker]);
    const lockedSum = combinedAssets
      .filter(p => lockedTargets[p.ticker])
      .reduce((sum, p) => sum + (targets[p.ticker] || 0), 0);

    const availableBudget = Math.max(0, 100 - lockedSum);
    if (unlocked.length === 0) {
      toast.warning('Todos os ativos estão travados.');
      return;
    }

    const equalShare = Number((availableBudget / unlocked.length).toFixed(1));
    const nextTargets: Record<string, number> = { ...targets };

    unlocked.forEach((p, idx) => {
      if (idx === unlocked.length - 1) {
        const sumOthers = equalShare * (unlocked.length - 1);
        nextTargets[p.ticker] = Number((availableBudget - sumOthers).toFixed(1));
      } else {
        nextTargets[p.ticker] = equalShare;
      }
    });

    setTargets(nextTargets);
    toast.success('Metas de alocação distribuídas igualmente!');
  };

  // Set targets based on current allocation weights
  const handleUseCurrentAllocation = () => {
    if (totalCurrentValue <= 0) {
      handleEqualize();
      return;
    }
    const nextTargets: Record<string, number> = {};
    combinedAssets.forEach(p => {
      const val = p.currentValue || p.totalInvested;
      const pct = Number(((val / totalCurrentValue) * 100).toFixed(1));
      nextTargets[p.ticker] = pct;
    });
    setTargets(nextTargets);
    toast.info('Metas ajustadas para a alocação atual da carteira.');
  };

  // Normalize targets to 100%
  const handleNormalize = () => {
    if (totalTargetPct <= 0) return;
    const nextTargets: Record<string, number> = {};
    combinedAssets.forEach(p => {
      const current = targets[p.ticker] || 0;
      nextTargets[p.ticker] = Number(((current / totalTargetPct) * 100).toFixed(1));
    });
    setTargets(nextTargets);
    toast.success('Percentuais normalizados para somar 100%!');
  };

  // Apply Macro Class Targets
  const handleApplyMacroClassTargets = (classTargets: Record<string, number>) => {
    const nextTargets: Record<string, number> = {};
    availableClasses.forEach(cls => {
      const targetForClass = classTargets[cls] || 0;
      const assetsInClass = combinedAssets.filter(a => a.type === cls);
      if (assetsInClass.length > 0) {
        const sharePerAsset = Number((targetForClass / assetsInClass.length).toFixed(1));
        assetsInClass.forEach((a, idx) => {
          if (idx === assetsInClass.length - 1) {
            const sumOthers = sharePerAsset * (assetsInClass.length - 1);
            nextTargets[a.ticker] = Number((targetForClass - sumOthers).toFixed(1));
          } else {
            nextTargets[a.ticker] = sharePerAsset;
          }
        });
      }
    });
    setTargets(nextTargets);
  };

  // Reset all manual price/quantity/cost adjustments
  const handleResetPlanOverrides = () => {
    setOverridePrices({});
    setOverrideQuantities({});
    setOverrideCosts({});
    toast.info('Valores e cotas calculados automaticamente restaurados.');
  };

  // Apply global fee to active items
  const handleApplyGlobalFeeToAll = () => {
    const feeVal = parseDecimalInput(defaultGlobalFee);
    const newCosts: Record<string, string> = {};
    combinedAssets.forEach(p => {
      newCosts[p.ticker] = defaultGlobalFee;
    });
    setOverrideCosts(newCosts);
    toast.success(`Taxa de ${formatCurrency(feeVal)} aplicada a todos os ativos!`);
  };

  // Toggle lock on asset target
  const toggleLockTarget = (ticker: string) => {
    setLockedTargets(prev => ({
      ...prev,
      [ticker]: !prev[ticker]
    }));
  };

  // Rebalancing calculation algorithm (Zero-Sell Smart Allocation)
  const rebalancePlan = useMemo(() => {
    if (combinedAssets.length === 0 || numContribution <= 0) return [];

    const newTotalPortfolio = totalCurrentValue + numContribution;

    // Calculate ideal values & gaps using effective prices
    const rawPlan = combinedAssets.map(p => {
      const basePrice = quotes[p.ticker] || p.currentPrice || p.averagePrice || 10;
      const customPriceStr = overridePrices[p.ticker];
      let price = basePrice;
      if (customPriceStr !== undefined && customPriceStr !== '') {
        const parsedP = parseDecimalInput(customPriceStr);
        if (parsedP > 0) price = parsedP;
      }

      const curVal = p.currentValue || p.totalInvested;
      const targetPct = targets[p.ticker] || 0;
      const idealValue = newTotalPortfolio * (targetPct / 100);
      const gapValue = Math.max(0, idealValue - curVal);

      return {
        ticker: p.ticker,
        type: p.type,
        currentQuantity: p.totalQuantity,
        price,
        basePrice,
        currentValue: curVal,
        currentPct: totalCurrentValue > 0 ? (curVal / totalCurrentValue) * 100 : 0,
        targetPct,
        idealValue,
        gapValue,
        isCustom: p.isCustom
      };
    });

    const totalGap = rawPlan.reduce((acc, item) => acc + item.gapValue, 0);

    // 1. Initial base distribution of contribution budget proportional to the gaps
    const qtyMap: Record<string, number> = {};

    rawPlan.forEach(item => {
      let recQty = 0;
      if (item.gapValue > 0 && totalGap > 0) {
        const budgetForAsset = Math.min(numContribution, (item.gapValue / totalGap) * numContribution);
        recQty = Math.floor(budgetForAsset / item.price);
      }

      // If user overrode, lock to that override value
      if (overrideQuantities[item.ticker] !== undefined) {
        qtyMap[item.ticker] = overrideQuantities[item.ticker];
      } else {
        qtyMap[item.ticker] = recQty;
      }
    });

    // Helper to calculate fees for a ticker
    const getFeeForTicker = (ticker: string) => {
      return overrideCosts[ticker] !== undefined 
        ? parseDecimalInput(overrideCosts[ticker]) 
        : 0;
    };

    const getPortfolioTotalAndLeftover = () => {
      let totalSpentOnAssets = 0;
      let totalSpentWithFees = 0;
      rawPlan.forEach(p => {
        const qty = qtyMap[p.ticker] || 0;
        if (qty > 0) {
          const fee = getFeeForTicker(p.ticker);
          totalSpentOnAssets += qty * p.price;
          totalSpentWithFees += (qty * p.price + fee);
        }
      });
      return {
        totalSpentOnAssets,
        totalSpentWithFees,
        leftover: numContribution - totalSpentWithFees
      };
    };

    // 2. Greedy optimization loop: use leftover cash to buy more shares for most sub-allocated assets
    while (true) {
      const { totalSpentOnAssets, leftover } = getPortfolioTotalAndLeftover();
      if (leftover <= 0.01) break;

      let bestTicker: string | null = null;
      let maxPriority = -999999;
      let bestAdditionalCost = 0;

      const currentTotalPortfolio = totalCurrentValue + totalSpentOnAssets;

      for (const p of rawPlan) {
        if (overrideQuantities[p.ticker] !== undefined) continue;
        if (p.targetPct <= 0) continue;

        const currentQty = qtyMap[p.ticker] || 0;
        const fee = getFeeForTicker(p.ticker);

        const additionalCost = (currentQty === 0) 
          ? (p.price + fee) 
          : p.price;

        if (additionalCost <= leftover + 0.01) {
          const currentAssetValue = p.currentValue + currentQty * p.price;
          const currentProjectedPct = currentTotalPortfolio > 0 
            ? (currentAssetValue / currentTotalPortfolio) * 100 
            : 0;
          const priority = p.targetPct - currentProjectedPct;

          if (priority > maxPriority) {
            maxPriority = priority;
            bestTicker = p.ticker;
            bestAdditionalCost = additionalCost;
          }
        }
      }

      if (bestTicker && bestAdditionalCost > 0) {
        qtyMap[bestTicker] = (qtyMap[bestTicker] || 0) + 1;
      } else {
        break;
      }
    }

    // 3. Map final outputs
    const plannedPurchases = rawPlan.map(item => {
      const finalQty = qtyMap[item.ticker] || 0;
      const itemFee = getFeeForTicker(item.ticker);
      const purchaseSubtotal = finalQty * item.price;
      const totalCostWithFee = finalQty > 0 ? (purchaseSubtotal + itemFee) : 0;

      return {
        ...item,
        recommendedQty: finalQty,
        costs: finalQty > 0 ? itemFee : 0,
        recommendedCost: totalCostWithFee,
        purchaseSubtotal,
        newTotalQty: item.currentQuantity + finalQty
      };
    });

    const finalTotal = totalCurrentValue + plannedPurchases.reduce((acc, i) => acc + i.purchaseSubtotal, 0);

    return plannedPurchases.map(item => {
      const newAssetValue = item.currentValue + item.purchaseSubtotal;
      const projectedPct = finalTotal > 0 ? (newAssetValue / finalTotal) * 100 : 0;
      const gapBefore = item.currentPct - item.targetPct;
      const gapAfter = projectedPct - item.targetPct;

      return {
        ...item,
        projectedPct,
        gapBefore,
        gapAfter,
        status: (item.isCustom || item.currentQuantity === 0)
          ? 'new'
          : (gapBefore < -0.5 ? 'suballocated' : (gapBefore > 0.5 ? 'overallocated' : 'aligned'))
      };
    }).sort((a, b) => b.recommendedCost - a.recommendedCost);

  }, [combinedAssets, totalCurrentValue, numContribution, targets, overridePrices, overrideQuantities, overrideCosts, quotes]);

  const totalPlannedCost = useMemo(() => {
    return rebalancePlan.reduce((acc, item) => acc + item.recommendedCost, 0);
  }, [rebalancePlan]);

  const leftoverCash = numContribution - totalPlannedCost;
  const itemsToBuy = useMemo(() => rebalancePlan.filter(item => item.recommendedQty > 0), [rebalancePlan]);

  // Aggregated rebalance plan by macro asset class
  const classPlan = useMemo(() => {
    if (rebalancePlan.length === 0) return [];
    
    const map = new Map<string, {
      type: string;
      currentValue: number;
      currentPct: number;
      targetPct: number;
      projectedPct: number;
      subtotalAporte: number;
      assetCount: number;
      buyingAssetCount: number;
    }>();

    rebalancePlan.forEach(item => {
      const type = item.type || 'Outros';
      const existing = map.get(type) || {
        type,
        currentValue: 0,
        currentPct: 0,
        targetPct: 0,
        projectedPct: 0,
        subtotalAporte: 0,
        assetCount: 0,
        buyingAssetCount: 0
      };

      existing.currentValue += item.currentValue;
      existing.currentPct += item.currentPct;
      existing.targetPct += item.targetPct;
      existing.projectedPct += item.projectedPct;
      existing.subtotalAporte += item.purchaseSubtotal;
      existing.assetCount += 1;
      if (item.recommendedQty > 0) {
        existing.buyingAssetCount += 1;
      }

      map.set(type, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.subtotalAporte - a.subtotalAporte || b.currentValue - a.currentValue);
  }, [rebalancePlan]);

  // Diagnostics: Portfolio deviation before and after rebalance
  const portfolioDeviation = useMemo(() => {
    if (rebalancePlan.length === 0) return { before: 0, after: 0, improvement: 0 };
    const sumDevBefore = rebalancePlan.reduce((acc, i) => acc + Math.abs(i.gapBefore), 0);
    const sumDevAfter = rebalancePlan.reduce((acc, i) => acc + Math.abs(i.gapAfter), 0);
    const avgBefore = sumDevBefore / rebalancePlan.length;
    const avgAfter = sumDevAfter / rebalancePlan.length;
    const improvement = avgBefore > 0 ? Math.max(0, ((avgBefore - avgAfter) / avgBefore) * 100) : 0;
    return {
      before: avgBefore,
      after: avgAfter,
      improvement
    };
  }, [rebalancePlan]);

  // Filtered & Sorted items for view
  const displayItems = useMemo(() => {
    return combinedAssets
      .filter(item => {
        const matchesClass = selectedClassFilter === 'all' || 
          (selectedClassFilter === 'custom' ? item.isCustom : item.type === selectedClassFilter);
        const matchesSearch = item.ticker.toLowerCase().includes(searchQuery.toLowerCase()) || 
          item.type.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesClass && matchesSearch;
      })
      .sort((a, b) => {
        const planA = rebalancePlan.find(p => p.ticker === a.ticker);
        const planB = rebalancePlan.find(p => p.ticker === b.ticker);

        if (sortBy === 'suballocated') {
          const gapA = planA ? planA.gapBefore : 0;
          const gapB = planB ? planB.gapBefore : 0;
          return gapA - gapB; // most negative (furthest below target) first
        }
        if (sortBy === 'target') {
          return (targets[b.ticker] || 0) - (targets[a.ticker] || 0);
        }
        if (sortBy === 'current') {
          const valA = a.currentValue || a.totalInvested;
          const valB = b.currentValue || b.totalInvested;
          return valB - valA;
        }
        return a.ticker.localeCompare(b.ticker);
      });
  }, [combinedAssets, selectedClassFilter, searchQuery, sortBy, rebalancePlan, targets]);

  // Execute rebalancing batch buy
  const handleExecuteRebalance = async () => {
    if (itemsToBuy.length === 0) {
      toast.error('Nenhuma compra recomendada para o valor informado.');
      return;
    }

    setIsExecuting(true);
    try {
      await onBatchBuy(itemsToBuy.map(i => ({
        ticker: i.ticker,
        type: i.type,
        quantity: i.recommendedQty,
        price: i.price,
        costs: i.costs
      })));
      
      // Clean up custom assets that have now been bought and will appear in real positions
      const boughtTickers = new Set(itemsToBuy.map(i => i.ticker.toUpperCase()));
      setCustomAssets(prev => prev.filter(ca => !boughtTickers.has(ca.ticker.toUpperCase())));

      setIsConfirmBatchModalOpen(false);
      toast.success(`${itemsToBuy.length} lançamentos de compras registrados com sucesso na sua carteira!`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao registrar lançamentos de rebalanceamento.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Copy orders to clipboard
  const handleCopyOrdersToClipboard = () => {
    if (itemsToBuy.length === 0) return;
    const textLines = [
      `🎯 PLANO DE REBALANCEAMENTO DE ATIVOS (${new Date().toLocaleDateString('pt-BR')}):`,
      `Aporte Total: ${formatCurrency(totalPlannedCost)} | Sobra: ${formatCurrency(leftoverCash)}`,
      `----------------------------------------`,
      ...itemsToBuy.map(i => 
        `• ${i.ticker} (${i.type}): Comprar ${i.recommendedQty} cotas @ ${formatCurrency(i.price)} = ${formatCurrency(i.purchaseSubtotal)}${i.costs > 0 ? ` (+ taxa ${formatCurrency(i.costs)})` : ''}`
      ),
      `----------------------------------------`,
      `Total de Ordens: ${itemsToBuy.length}`
    ];
    navigator.clipboard.writeText(textLines.join('\n'));
    setCopiedOrders(true);
    toast.success('Ordens de compra copiadas para a área de transferência!');
    setTimeout(() => setCopiedOrders(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER BANNER & ACTION BAR */}
      <div className="p-5 md:p-6 rounded-3xl border border-border/50 bg-gradient-to-br from-card via-card to-indigo-500/[0.04] shadow-sm space-y-5 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 shrink-0">
              <Scale className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-black tracking-tight text-foreground">
                  Rebalanceamento Inteligente de Ativos
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                  Zero Vendas • Foco em Aportes
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Calcule matematicamente onde aplicar seu dinheiro para equilibrar a carteira sem pagar impostos desnecessários.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => setIsAddAssetModalOpen(true)}
              className="px-3.5 py-2 text-xs font-black rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Adicionar novo ativo ou planejado ao rebalanceamento"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>Adicionar Ativo</span>
            </button>

            <button
              onClick={() => setIsMacroClassModalOpen(true)}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-border/60 bg-card hover:bg-muted text-foreground transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Configurar metas macro por classe de ativo (Ações, FIIs, etc.)"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>Por Classes</span>
            </button>

            <button
              onClick={() => persistTargets(targets, true)}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Salvar metas atuais para os próximos acessos"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Metas</span>
            </button>
          </div>
        </div>

        {/* CONTRIBUTION AMOUNT & QUICK PRESETS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-3 border-t border-border/40">
          {/* Contribution Input (7 cols on lg) */}
          <div className="lg:col-span-7 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 shrink-0">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Valor do Novo Aporte (R$)
              </label>

              {investmentReserve && (
                <button
                  type="button"
                  onClick={() => setContribution(reserveBalance.toFixed(2))}
                  className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 max-w-full truncate cursor-pointer"
                  title={`Reserva: ${investmentReserve.name}`}
                >
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span className="truncate">Puxar da Reserva ({formatCurrency(reserveBalance)})</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <CurrencyInput
                value={contribution}
                onChange={setContribution}
                placeholder="0,00"
                className="flex-1 bg-card border border-border/70 rounded-2xl px-4 py-2.5 text-base md:text-lg font-black text-foreground focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all min-w-[180px]"
              />
              
              {/* Quick Increment Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {[100, 500, 1000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      const current = parseDecimalInput(contribution);
                      setContribution((current + amt).toFixed(2));
                    }}
                    className="px-2.5 py-2 text-[11px] font-bold rounded-xl border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                  >
                    +{amt}
                  </button>
                ))}
              </div>
            </div>

            {investmentReserve && (
              <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 flex-wrap">
                <span>Vinculado à <strong>{investmentReserve.name}</strong></span>
                <span>• Saldo Disponível: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(reserveBalance)}</strong></span>
              </p>
            )}
          </div>

          {/* Allocation Target Status & Helper Presets (5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col justify-between p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Soma das Metas Definidas</p>
                <div className="flex items-center gap-2">
                  <p className={`text-base font-black ${Math.abs(totalTargetPct - 100) < 0.5 ? 'text-emerald-500' : (totalTargetPct > 100 ? 'text-rose-500' : 'text-amber-500')}`}>
                    {totalTargetPct.toFixed(1)}%
                  </p>
                  <span className="text-[11px] font-bold text-muted-foreground truncate">
                    {Math.abs(totalTargetPct - 100) < 0.5 
                      ? '✓ Perfeito (100%)' 
                      : (totalTargetPct > 100 ? `(+${(totalTargetPct - 100).toFixed(1)}% acima)` : `(Falta ${(100 - totalTargetPct).toFixed(1)}%)`)}
                  </span>
                </div>
              </div>

              {Math.abs(totalTargetPct - 100) >= 0.5 && (
                <button
                  onClick={handleNormalize}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Normalizar todas as metas proporcionalmente para somar 100%"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Ajustar 100%
                </button>
              )}
            </div>

            {/* Quick Strategy Presets */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/40">
              <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">Presets:</span>
              <button
                onClick={handleEqualize}
                className="px-2 py-1 text-[11px] font-bold rounded-lg border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                title="Dividir igualmente entre os ativos não travados"
              >
                1/N Igual
              </button>
              <button
                onClick={handleUseCurrentAllocation}
                className="px-2 py-1 text-[11px] font-bold rounded-lg border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                title="Manter percentuais atuais da carteira"
              >
                Manter Atual
              </button>
              <button
                onClick={() => {
                  const zeroed: Record<string, number> = {};
                  combinedAssets.forEach(a => { zeroed[a.ticker] = 0; });
                  setTargets(zeroed);
                  toast.info('Metas zeradas.');
                }}
                className="px-2 py-1 text-[11px] font-bold rounded-lg border border-border/60 bg-card hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground transition-all cursor-pointer"
              >
                Zerar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DIAGNOSTICS & VISUAL COMPARISON SUMMARY */}
      {rebalancePlan.length > 0 && showDiagnostics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1: Total Aporte Proposto */}
          <div className="p-4 rounded-3xl bg-card border border-border/50 shadow-xs space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Investimento Proposto</span>
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            </p>
            <p className="text-xl font-black text-emerald-500">
              {formatCurrency(totalPlannedCost)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {itemsToBuy.length} de {combinedAssets.length} ativos receberão compras.
            </p>
          </div>

          {/* Card 2: Troco / Sobra do Aporte */}
          <div className="p-4 rounded-3xl bg-card border border-border/50 shadow-xs space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Sobra / Saldo Não Utilizado</span>
              <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
            </p>
            <p className={`text-xl font-black ${leftoverCash < 0 ? 'text-rose-500' : 'text-foreground'}`}>
              {formatCurrency(leftoverCash)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {leftoverCash > 0 ? 'Permanece na sua reserva de oportunidade.' : 'Aporte totalmente aproveitado.'}
            </p>
          </div>

          {/* Card 3: Eficiência do Alinhamento */}
          <div className="p-4 rounded-3xl bg-card border border-border/50 shadow-xs space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Melhoria de Equilíbrio</span>
              <Target className="w-3.5 h-3.5 text-indigo-500" />
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                +{portfolioDeviation.improvement.toFixed(0)}%
              </p>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                Mais Equilibrada
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Desvio médio reduz de {portfolioDeviation.before.toFixed(1)}% para {portfolioDeviation.after.toFixed(1)}%.
            </p>
          </div>
        </div>
      )}

      {/* 3. VISUAL ALLOCATION COMPARISON BARS */}
      {showVisualComparison && rebalancePlan.length > 0 && (
        <div className="p-5 md:p-6 rounded-3xl border border-border/50 bg-card shadow-xs space-y-5">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500 shrink-0">
                <PieChart className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground tracking-tight flex items-center gap-2">
                  <span>Comparativo Visual de Alocação</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Projeção Pós-Aporte
                  </span>
                </h3>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  Veja graficamente como cada real investido aproxima sua carteira das metas ideais
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* View mode toggle (Por Ativo vs Por Classe) */}
              <div className="flex items-center bg-muted/40 p-1 rounded-xl border border-border/50">
                <button
                  type="button"
                  onClick={() => setVisualTab('assets')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    visualTab === 'assets'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Por Ativo ({rebalancePlan.length})
                </button>
                <button
                  type="button"
                  onClick={() => setVisualTab('classes')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    visualTab === 'classes'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Por Classe ({classPlan.length})
                </button>
              </div>

              {visualTab === 'assets' && (
                <button
                  type="button"
                  onClick={() => setVisualFilterOnlyBuying(prev => !prev)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                    visualFilterOnlyBuying
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-border/60 bg-card text-muted-foreground hover:text-foreground'
                  }`}
                  title="Filtrar apenas ativos que receberão compras com o aporte"
                >
                  <Filter className="w-3 h-3" />
                  <span>Apenas Compras ({itemsToBuy.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowVisualComparison(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                title="Ocultar comparativo visual"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Legend Banner */}
          <div className="flex items-center justify-between text-[11px] font-bold p-3 rounded-2xl bg-muted/30 border border-border/40 flex-wrap gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-slate-400/50 dark:bg-slate-600/60 inline-block" />
                <span className="text-muted-foreground">Alocação Atual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-gradient-to-r from-emerald-500 to-teal-400 inline-block shadow-xs" />
                <span className="text-emerald-600 dark:text-emerald-400 font-black">+ Impacto do Aporte</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-indigo-500/30 border border-indigo-500 inline-block" />
                <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">Meta Ideal</span>
              </div>
            </div>

            <div className="text-muted-foreground text-[10px]">
              {visualTab === 'assets' 
                ? `Exibindo ${visualFilterOnlyBuying ? itemsToBuy.length : rebalancePlan.length} de ${combinedAssets.length} ativos`
                : `${classPlan.length} classes de ativos`
              }
            </div>
          </div>

          {/* ITEM ROWS */}
          <div className="space-y-3.5">
            {visualTab === 'assets' ? (
              // ASSETS LIST
              (visualFilterOnlyBuying ? rebalancePlan.filter(i => i.recommendedQty > 0) : rebalancePlan).map(item => {
                const isBuying = item.recommendedQty > 0;
                const pctGained = item.projectedPct - item.currentPct;
                const distanceToTarget = item.targetPct - item.projectedPct;

                return (
                  <div key={item.ticker} className="p-3.5 rounded-2xl border border-border/40 bg-muted/10 hover:bg-muted/20 transition-all space-y-2.5">
                    {/* Row Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-foreground tracking-tight">{item.ticker}</span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground uppercase">
                          {item.type}
                        </span>
                        {item.isCustom && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            Novo
                          </span>
                        )}
                        {isBuying && (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Comprar {item.recommendedQty} cota{item.recommendedQty > 1 ? 's' : ''} ({formatCurrency(item.purchaseSubtotal)})
                          </span>
                        )}
                      </div>

                      {/* Percentage badges */}
                      <div className="flex items-center gap-3 text-xs font-bold self-end sm:self-auto flex-wrap">
                        <span className="text-muted-foreground">
                          Atual: <strong className="text-foreground">{item.currentPct.toFixed(1)}%</strong>
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-0.5">
                          Pós: <strong className="text-base">{item.projectedPct.toFixed(1)}%</strong>
                          {pctGained > 0.05 && (
                            <span className="text-[10px] bg-emerald-500/10 px-1 rounded">
                              (+{pctGained.toFixed(1)}%)
                            </span>
                          )}
                        </span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-black">
                          Meta: {item.targetPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* DUAL COMPARISON PROGRESS BARS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[10px]">
                      {/* Bar A: Alocação Atual vs Pós-Aporte */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-bold text-muted-foreground">
                          <span>Evolução da Alocação</span>
                          <span className={pctGained > 0 ? 'text-emerald-500 font-black' : ''}>
                            {item.currentPct.toFixed(1)}% ➔ {item.projectedPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-3 w-full bg-muted/60 rounded-xl relative overflow-hidden flex p-0.5 border border-border/30">
                          {/* Current Allocation segment */}
                          <div 
                            style={{ width: `${Math.min(100, item.currentPct)}%` }} 
                            className="h-full bg-slate-400/70 dark:bg-slate-500/70 rounded-l-lg transition-all"
                            title={`Atual: ${item.currentPct.toFixed(1)}%`}
                          />
                          {/* Added Aporte segment */}
                          {pctGained > 0.05 && (
                            <div 
                              style={{ width: `${Math.min(100 - item.currentPct, pctGained)}%` }} 
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-r-lg transition-all shadow-xs"
                              title={`Novo Aporte: +${pctGained.toFixed(1)}%`}
                            />
                          )}
                        </div>
                      </div>

                      {/* Bar B: Meta Ideal vs Distância */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-bold text-muted-foreground">
                          <span>Meta Desejada ({item.targetPct.toFixed(1)}%)</span>
                          <span>
                            {Math.abs(distanceToTarget) < 0.3 ? (
                              <span className="text-emerald-500 font-extrabold">🎯 Meta Atingida</span>
                            ) : distanceToTarget > 0 ? (
                              <span className="text-amber-500 font-bold">Falta {distanceToTarget.toFixed(1)}%</span>
                            ) : (
                              <span className="text-indigo-400 font-bold">+{Math.abs(distanceToTarget).toFixed(1)}% acima</span>
                            )}
                          </span>
                        </div>
                        <div className="h-3 w-full bg-muted/60 rounded-xl relative overflow-hidden p-0.5 border border-border/30">
                          <div 
                            style={{ width: `${Math.min(100, item.targetPct)}%` }} 
                            className="h-full bg-indigo-500/40 dark:bg-indigo-500/50 border border-indigo-500/60 rounded-lg transition-all"
                            title={`Meta: ${item.targetPct.toFixed(1)}%`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              // MACRO CLASSES LIST
              classPlan.map(cls => {
                const pctGained = cls.projectedPct - cls.currentPct;
                const distanceToTarget = cls.targetPct - cls.projectedPct;

                return (
                  <div key={cls.type} className="p-4 rounded-2xl border border-border/50 bg-card hover:bg-muted/10 transition-all space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-foreground">{cls.type}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-muted text-muted-foreground">
                          {cls.assetCount} ativo{cls.assetCount > 1 ? 's' : ''}
                        </span>
                        {cls.subtotalAporte > 0 && (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Aporte de {formatCurrency(cls.subtotalAporte)} ({cls.buyingAssetCount} ativo{cls.buyingAssetCount > 1 ? 's' : ''})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs font-bold flex-wrap">
                        <span className="text-muted-foreground">Atual: {cls.currentPct.toFixed(1)}%</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                          Pós: {cls.projectedPct.toFixed(1)}% {pctGained > 0.05 && `(+${pctGained.toFixed(1)}%)`}
                        </span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-black">
                          Meta: {cls.targetPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Class progress track */}
                    <div className="space-y-1">
                      <div className="h-3.5 w-full bg-muted/60 rounded-xl relative overflow-hidden flex p-0.5 border border-border/30">
                        {/* Current weight */}
                        <div 
                          style={{ width: `${Math.min(100, cls.currentPct)}%` }} 
                          className="h-full bg-slate-400/70 dark:bg-slate-500/70 rounded-l-lg transition-all"
                          title={`Atual: ${cls.currentPct.toFixed(1)}%`}
                        />
                        {/* Added Aporte segment */}
                        {pctGained > 0.05 && (
                          <div 
                            style={{ width: `${Math.min(100 - cls.currentPct, pctGained)}%` }} 
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-r-lg transition-all shadow-xs"
                            title={`Novo Aporte: +${pctGained.toFixed(1)}%`}
                          />
                        )}
                        {/* Target Marker */}
                        <div 
                          style={{ left: `${Math.min(99, cls.targetPct)}%` }} 
                          className="w-1.5 h-full bg-indigo-500 absolute top-0 z-30 rounded-xs shadow-xs"
                          title={`Meta: ${cls.targetPct.toFixed(1)}%`}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground font-bold pt-0.5 flex-wrap gap-1">
                        <span>Atual: {formatCurrency(cls.currentValue)}</span>
                        <span>
                          {Math.abs(distanceToTarget) < 0.5 ? (
                            <span className="text-emerald-500 font-bold">✓ Classe Alinhada com a Meta</span>
                          ) : distanceToTarget > 0 ? (
                            <span className="text-amber-500">Falta {distanceToTarget.toFixed(1)}% para a meta macro</span>
                          ) : (
                            <span className="text-indigo-400">Sobre-alocada ({cls.projectedPct.toFixed(1)}%)</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. ASSET TARGET ADJUSTMENT CARDS / TABLE */}
      <div className="space-y-4">
        {/* Controls Bar: Search, Category Filters, View Switcher & Sort */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border border-border/50">
          {/* Class Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedClassFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                selectedClassFilter === 'all'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Todos ({combinedAssets.length})
            </button>

            {availableClasses.map(cls => {
              const count = combinedAssets.filter(a => a.type === cls).length;
              return (
                <button
                  key={cls}
                  onClick={() => setSelectedClassFilter(cls)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                    selectedClassFilter === cls
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cls} ({count})
                </button>
              );
            })}

            {customAssets.length > 0 && (
              <button
                onClick={() => setSelectedClassFilter('custom')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                  selectedClassFilter === 'custom'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                }`}
              >
                Planejados ({customAssets.length})
              </button>
            )}
          </div>

          {/* Right Tools: Search, Sort & View Mode */}
          <div className="flex items-center gap-2 justify-between sm:justify-end flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-40">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar ticker..."
                className="w-full bg-background border border-border/60 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-background border border-border/60 rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground outline-none cursor-pointer"
            >
              <option value="suballocated">Mais Sub-alocados</option>
              <option value="target">Maior Meta (%)</option>
              <option value="current">Maior Valor Atual</option>
              <option value="ticker">Ordem A-Z</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-muted/40 p-0.5 rounded-xl border border-border/50">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'cards' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Visualização em Cards com Sliders"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'table' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Visualização em Tabela / Lista"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ASSET CARDS VIEW */}
        {viewMode === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {displayItems.map(p => {
              const curVal = p.currentValue || p.totalInvested;
              const currentPct = totalCurrentValue > 0 ? (curVal / totalCurrentValue) * 100 : 0;
              const targetVal = targets[p.ticker] || 0;
              const isLocked = lockedTargets[p.ticker] || false;
              const sumOfOthers = totalTargetPct - targetVal;
              const maxAllowed = Math.max(0, 100 - sumOfOthers);
              const planItem = rebalancePlan.find(item => item.ticker === p.ticker);

              return (
                <div 
                  key={p.ticker}
                  className={`p-4 rounded-3xl border transition-all space-y-3 bg-card ${
                    targetVal > 0 
                      ? 'border-indigo-500/30 shadow-xs shadow-indigo-500/5' 
                      : 'border-border/50 opacity-80'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-foreground">{p.ticker}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-lg bg-secondary text-secondary-foreground uppercase">
                        {p.type}
                      </span>
                      {p.isCustom && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          Planejado
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleLockTarget(p.ticker)}
                        className={`p-1 rounded-lg transition-colors ${
                          isLocked ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground/50 hover:text-foreground'
                        }`}
                        title={isLocked ? "Meta travada para equalização automática" : "Travar meta"}
                      >
                        {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>

                      {p.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomAsset(p.ticker)}
                          className="p-1 rounded-lg text-muted-foreground/60 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Remover ativo planejado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Allocation Status Indicator */}
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <div>
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block">Atual</span>
                      <span className="font-black text-foreground">{currentPct.toFixed(1)}%</span>
                    </div>

                    <div className="text-center">
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block">Status</span>
                      {p.isCustom || p.totalQuantity === 0 ? (
                        <span className="text-[10px] font-extrabold text-amber-500">Novo Ativo</span>
                      ) : currentPct < targetVal - 0.5 ? (
                        <span className="text-[10px] font-extrabold text-emerald-500 flex items-center gap-0.5">
                          <TrendingDown className="w-3 h-3" /> Sub-alocado
                        </span>
                      ) : currentPct > targetVal + 0.5 ? (
                        <span className="text-[10px] font-extrabold text-rose-400 flex items-center gap-0.5">
                          <TrendingUp className="w-3 h-3" /> Sobre-alocado
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold text-indigo-400">Alinhado</span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block">Meta Ideal</span>
                      <span className="font-black text-indigo-600 dark:text-indigo-400">{targetVal.toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Progress Gauge */}
                  <div className="h-2 w-full bg-muted/70 rounded-full relative overflow-hidden">
                    <div 
                      style={{ width: `${Math.min(100, currentPct)}%` }} 
                      className="h-full bg-muted-foreground/30 absolute left-0 top-0 rounded-l-full transition-all"
                    />
                    <div 
                      style={{ width: `${Math.min(100, targetVal)}%` }} 
                      className="h-full bg-indigo-500 opacity-80 rounded-l-full transition-all"
                    />
                  </div>

                  {/* Interactive Slider & Manual Input */}
                  <div className="flex items-center gap-2.5">
                    <input
                      type="range"
                      min="0"
                      max={Math.max(targetVal, maxAllowed).toFixed(1)}
                      step="0.5"
                      value={targetVal}
                      onChange={e => {
                        const val = Math.min(Math.max(targetVal, maxAllowed), Number(e.target.value));
                        setTargets(prev => ({ ...prev, [p.ticker]: Number(val.toFixed(1)) }));
                      }}
                      className="flex-1 accent-indigo-500 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={targetVal === 0 ? '' : targetVal}
                        placeholder="0"
                        onChange={e => {
                          const inputVal = Number(e.target.value);
                          const val = Math.max(0, Math.min(100, inputVal));
                          setTargets(prev => ({ ...prev, [p.ticker]: Number(val.toFixed(1)) }));
                        }}
                        className="w-14 bg-muted/40 border border-border/50 rounded-xl px-1.5 py-1 text-xs font-black text-center focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      />
                      <span className="text-xs font-bold text-muted-foreground">%</span>
                    </div>
                  </div>

                  {/* Quick Action Presets */}
                  <div className="flex items-center gap-1 pt-2 border-t border-border/30 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setTargets(prev => ({ ...prev, [p.ticker]: 0 }))}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-lg border border-border/60 bg-card hover:bg-muted text-muted-foreground transition-all"
                    >
                      Zerar
                    </button>

                    {leftoverTargetPct > 0.05 && maxAllowed > targetVal && (
                      <button
                        type="button"
                        onClick={() => {
                          const addedVal = Math.min(maxAllowed, targetVal + leftoverTargetPct);
                          setTargets(prev => ({ ...prev, [p.ticker]: Number(addedVal.toFixed(1)) }));
                        }}
                        className="px-2 py-0.5 text-[10px] font-extrabold rounded-lg border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all"
                      >
                        + Sobra ({leftoverTargetPct.toFixed(1)}%)
                      </button>
                    )}

                    {[5, 10, 20].map(pct => {
                      if (pct <= Math.max(targetVal, maxAllowed) && Math.abs(targetVal - pct) > 0.1) {
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setTargets(prev => ({ ...prev, [p.ticker]: pct }))}
                            className="px-1.5 py-0.5 text-[10px] font-bold rounded-lg border border-border/40 bg-card hover:bg-muted text-muted-foreground transition-all"
                          >
                            {pct}%
                          </button>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/50 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Ativo</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-right">Patrimônio Atual</th>
                    <th className="px-4 py-3 text-right">Alocação Atual</th>
                    <th className="px-4 py-3 text-center min-w-[140px]">Meta Ideal (%)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {displayItems.map(p => {
                    const curVal = p.currentValue || p.totalInvested;
                    const currentPct = totalCurrentValue > 0 ? (curVal / totalCurrentValue) * 100 : 0;
                    const targetVal = targets[p.ticker] || 0;
                    const isLocked = lockedTargets[p.ticker] || false;

                    return (
                      <tr key={p.ticker} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-black text-foreground flex items-center gap-2">
                          <span>{p.ticker}</span>
                          {p.isCustom && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600">
                              Planejado
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground uppercase">
                            {p.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {formatCurrency(curVal)}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-foreground">
                          {currentPct.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={targetVal === 0 ? '' : targetVal}
                              placeholder="0"
                              onChange={e => {
                                const inputVal = Number(e.target.value);
                                const val = Math.max(0, Math.min(100, inputVal));
                                setTargets(prev => ({ ...prev, [p.ticker]: Number(val.toFixed(1)) }));
                              }}
                              className="w-16 bg-muted/40 border border-border/50 rounded-xl px-2 py-1 text-xs font-black text-center outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <span className="text-xs font-bold text-muted-foreground">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.isCustom || p.totalQuantity === 0 ? (
                            <span className="text-[10px] font-extrabold text-amber-500">Novo Ativo</span>
                          ) : currentPct < targetVal - 0.5 ? (
                            <span className="text-[10px] font-extrabold text-emerald-500">Sub-alocado</span>
                          ) : currentPct > targetVal + 0.5 ? (
                            <span className="text-[10px] font-extrabold text-rose-400">Sobre-alocado</span>
                          ) : (
                            <span className="text-[10px] font-extrabold text-indigo-400">Alinhado</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleLockTarget(p.ticker)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isLocked ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground/60 hover:text-foreground'
                              }`}
                              title={isLocked ? "Destravar" : "Travar meta"}
                            >
                              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </button>
                            {p.isCustom && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomAsset(p.ticker)}
                                className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                title="Remover"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 5. RECOMMENDED PURCHASES PROPOSAL TABLE */}
      <div className="space-y-4 pt-6 border-t border-border/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base font-black text-foreground">
                Plano de Aportes Recomendados
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Revise o preço da cota, ajuste quantidades e inclua taxas antes de gerar as compras.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {(Object.keys(overridePrices).length > 0 || Object.keys(overrideQuantities).length > 0 || Object.keys(overrideCosts).length > 0) && (
              <button
                type="button"
                onClick={handleResetPlanOverrides}
                className="px-3 py-2 text-xs font-bold rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all flex items-center gap-1.5"
                title="Restaurar cotações e quantidades calculadas automaticamente"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Restaurar</span>
              </button>
            )}

            {itemsToBuy.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleCopyOrdersToClipboard}
                  className="px-3 py-2 text-xs font-bold rounded-xl border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
                  title="Copiar lista de ordens para o clipboard"
                >
                  {copiedOrders ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedOrders ? 'Copiado!' : 'Copiar Ordens'}</span>
                </button>

                <button
                  onClick={() => setIsConfirmBatchModalOpen(true)}
                  disabled={isExecuting || numContribution <= 0}
                  className="px-4 py-2 text-xs font-black rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Lançar {itemsToBuy.length} Compras Automáticas</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Global Brokerage Fee Bar */}
        <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-bold text-foreground">Taxa Padrão por Ativo (R$):</span>
            <input
              type="text"
              inputMode="decimal"
              value={defaultGlobalFee}
              onChange={e => setDefaultGlobalFee(e.target.value)}
              placeholder="0,00"
              className="w-20 bg-card border border-border/60 rounded-xl px-2.5 py-1 text-xs font-black text-right outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={handleApplyGlobalFeeToAll}
              className="px-2.5 py-1 text-[11px] font-bold rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-all shrink-0"
            >
              Aplicar a Todos
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            *Você pode alterar o preço da cota, quantidades e taxa individualmente na tabela abaixo.
          </p>
        </div>

        {/* Breakdown Proposals Table */}
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/50 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="sticky left-0 z-20 bg-card border-r border-border/40 px-4 py-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Ativo</th>
                  <th className="px-4 py-3 text-right min-w-[120px]">Preço Cota (R$)</th>
                  <th className="px-4 py-3 text-right min-w-[130px]">Cotas a Comprar</th>
                  <th className="px-4 py-3 text-right min-w-[100px]">Taxa / Custos (R$)</th>
                  <th className="px-4 py-3 text-right">Total Aporte</th>
                  <th className="px-4 py-3 text-right">Atual / Meta</th>
                  <th className="px-4 py-3 text-right">Projeção %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {rebalancePlan.map(item => {
                  const hasPurchase = item.recommendedQty > 0;
                  const isPriceEdited = overridePrices[item.ticker] !== undefined && overridePrices[item.ticker] !== '';
                  const isQtyEdited = overrideQuantities[item.ticker] !== undefined;
                  const isFeeEdited = overrideCosts[item.ticker] !== undefined;

                  return (
                    <tr 
                      key={item.ticker} 
                      className={`group transition-colors ${hasPurchase ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 'hover:bg-muted/20 opacity-75'}`}
                    >
                      {/* Sticky Ticker Column */}
                      <td className={`sticky left-0 z-10 border-r border-border/40 px-4 py-3 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${
                        hasPurchase 
                          ? 'bg-emerald-500/[0.03] group-hover:bg-[#ebf8f0] dark:group-hover:bg-[#12271b]' 
                          : 'bg-card group-hover:bg-muted'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-foreground">{item.ticker}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground uppercase">
                            {item.type}
                          </span>
                          {item.isCustom && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
                              Novo
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Editable Price per Unit */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={overridePrices[item.ticker] !== undefined ? overridePrices[item.ticker] : item.price.toFixed(2).replace('.', ',')}
                            onChange={e => setOverridePrices(prev => ({ ...prev, [item.ticker]: e.target.value }))}
                            placeholder="0,00"
                            className={`w-24 text-right bg-background border rounded-xl px-2.5 py-1 text-xs font-bold text-foreground focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all ${
                              isPriceEdited ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-border/60'
                            }`}
                            title="Preço da cota utilizado no lançamento"
                          />
                        </div>
                      </td>

                      {/* Editable Quantity */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const current = item.recommendedQty;
                              setOverrideQuantities(prev => ({ ...prev, [item.ticker]: Math.max(0, current - 1) }));
                            }}
                            className="w-6 h-6 rounded-lg bg-muted/80 hover:bg-muted text-foreground flex items-center justify-center font-bold text-xs"
                            title="Diminuir cotas"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.recommendedQty}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              setOverrideQuantities(prev => ({ ...prev, [item.ticker]: Math.max(0, val) }));
                            }}
                            className={`w-14 text-center bg-background border rounded-xl py-1 text-xs font-black text-foreground focus:ring-2 focus:ring-indigo-500/30 outline-none ${
                              isQtyEdited ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-border/60'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const current = item.recommendedQty;
                              setOverrideQuantities(prev => ({ ...prev, [item.ticker]: current + 1 }));
                            }}
                            className="w-6 h-6 rounded-lg bg-muted/80 hover:bg-muted text-foreground flex items-center justify-center font-bold text-xs"
                            title="Aumentar cotas"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Editable Brokerage Costs */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={overrideCosts[item.ticker] !== undefined ? overrideCosts[item.ticker] : '0,00'}
                            onChange={e => setOverrideCosts(prev => ({ ...prev, [item.ticker]: e.target.value }))}
                            placeholder="0,00"
                            className={`w-20 text-right bg-background border rounded-xl px-2 py-1 text-xs font-bold text-foreground focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all ${
                              isFeeEdited ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-border/60'
                            }`}
                            title="Taxa da corretora para este ativo"
                          />
                        </div>
                      </td>

                      {/* Total Aporte */}
                      <td className="px-4 py-3 text-right font-black text-foreground">
                        {hasPurchase ? formatCurrency(item.recommendedCost) : '-'}
                      </td>

                      {/* Atual / Meta */}
                      <td className="px-4 py-3 text-right text-xs">
                        <span className="font-bold text-muted-foreground">{item.currentPct.toFixed(1)}%</span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="font-bold text-indigo-500">{item.targetPct.toFixed(1)}%</span>
                      </td>

                      {/* Projeção % */}
                      <td className="px-4 py-3 text-right font-extrabold text-foreground">
                        {item.projectedPct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. MODAL: ADICIONAR NOVO ATIVO AO REBALANCEAMENTO */}
      <AddRebalanceAssetModal
        isOpen={isAddAssetModalOpen}
        onClose={() => setIsAddAssetModalOpen(false)}
        onAddAsset={handleAddCustomAsset}
        existingTickers={combinedAssets.map(a => a.ticker)}
        leftoverTargetPct={leftoverTargetPct}
        brapiToken={settings?.brapi_token}
        formatCurrency={formatCurrency}
      />

      {/* 7. MODAL: ALOCAÇÃO MACRO POR CLASSE */}
      <RebalanceMacroClassModal
        isOpen={isMacroClassModalOpen}
        onClose={() => setIsMacroClassModalOpen(false)}
        onApplyClassTargets={handleApplyMacroClassTargets}
        availableClasses={availableClasses}
        currentClassWeights={currentClassWeights}
      />

      {/* 8. MODAL: CONFIRMAR LANÇAMENTO EM LOTE */}
      {isConfirmBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div 
            className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden my-8 animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border/60 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">
                    Confirmar Lançamento de Rebalanceamento
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {itemsToBuy.length} ordens de compra serão geradas na sua carteira.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Valor Total a Investir</p>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPlannedCost)}</p>
                </div>
                {investmentReserve && (
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Débito na Reserva</p>
                    <p className="text-xs font-bold text-foreground">{investmentReserve.name}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                <p className="text-xs font-bold text-muted-foreground uppercase">Resumo das Ordens:</p>
                <div className="divide-y divide-border/40 border border-border/50 rounded-2xl bg-card overflow-hidden text-xs">
                  {itemsToBuy.map(item => (
                    <div key={item.ticker} className="p-3 flex items-center justify-between">
                      <div>
                        <span className="font-black text-foreground">{item.ticker}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          {item.recommendedQty} cotas @ {formatCurrency(item.price)}
                        </span>
                      </div>
                      <span className="font-extrabold text-foreground">
                        {formatCurrency(item.recommendedCost)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setIsConfirmBatchModalOpen(false)}
                  disabled={isExecuting}
                  className="px-4 py-2.5 text-xs font-bold rounded-2xl border border-border/60 bg-card text-muted-foreground hover:text-foreground transition-all"
                >
                  Voltar e Revisar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRebalance}
                  disabled={isExecuting}
                  className="px-5 py-2.5 text-xs font-bold rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                >
                  {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirmar e Registrar Compras
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
