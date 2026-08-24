import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useInvestments } from '../contexts/InvestmentsContext';
import { CurrencyInput } from '../components/CurrencyInput';
import { InvestmentAnalytics } from '../components/InvestmentAnalytics';
import { CvmDocumentButton } from '../components/CvmDocumentButton';
import { RebalanceWizard } from '../components/investments/RebalanceWizard';
import { PortfolioDiagnosisDashboard } from '../components/investments/PortfolioDiagnosisDashboard';
import { FundamentalAnalysisView } from '../components/investments/FundamentalAnalysisView';
import { ProfessionalRebalanceEngineView } from '../components/investments/ProfessionalRebalanceEngineView';
import { runPortfolioDiagnosis } from '../lib/portfolioDiagnosis';
import { AssetRaioXModal } from '../components/investments/AssetRaioXModal';
import { DividendSummaryCards } from '../components/investments/DividendSummaryCards';
import { PortfolioReportModal } from '../components/investments/PortfolioReportModal';
import { QuoteProviderSelectorModal } from '../components/investments/QuoteProviderSelectorModal';
import { getAssetCnpj, formatCnpj, fetchCnpjOnline } from '../lib/cnpjUtils';
import { parseNumericValue } from '../lib/numberUtils';
import { fetchSingleQuote } from '../lib/quoteService';
import { calculateAssetDividendProjection, calculatePortfolioProjections, calculatePortfolioPerformanceMetrics } from '../lib/investmentCalculations';
import { InvestmentTransaction, Dividend, DividendType, DividendStatus } from '../types';
import { toast } from 'sonner';
import { 
  PlusCircle, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Trash2, 
  Wallet, 
  Briefcase, 
  Activity, 
  X, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Calculator, 
  ArrowRight,
  Search,
  Filter,
  Eye,
  EyeOff,
  Layers,
  LayoutGrid,
  List,
  ArrowUpDown,
  Share2,
  Info,
  Check,
  Edit3,
  PieChart as PieIcon,
  Award,
  Scale,
  History,
  Sliders,
  Zap,
  Percent,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  Target
} from 'lucide-react';

interface Position {
  ticker: string;
  type: string;
  totalQuantity: number;
  totalInvested: number;
  averagePrice: number;
  currentPrice: number | null;
  currentValue: number | null;
  currentPct?: number;
  dividendsReceived: number;
  yieldOnCost: number;
  realizedGain?: number;
}

export function Investments() {
  const { 
    investmentTransactions, 
    addInvestmentTransaction, 
    updateInvestmentTransaction, 
    deleteInvestmentTransaction, 
    deleteInvestmentTransactionsByTicker, 
    dividends,
    addDividend,
    updateDividend,
    deleteDividend,
    hideValues,
    setHideValues,
    quotes,
    isFetchingQuotes,
    lastQuoteFetchResult,
    fetchQuotes,
    reserves,
    settings,
    updateAssetCnpj,
    dividendAnalysisMode,
    setDividendAnalysisMode,
    valuationTargets
  } = useData();

  const {
    targetAllocations,
    saveTargetAllocations,
    rulesConfig,
    saveRulesConfig,
    b3AssetsMetadata,
  } = useInvestments();

  // Quote Provider Modal State
  const [isQuoteProviderModalOpen, setIsQuoteProviderModalOpen] = useState(false);

  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'carteira' | 'fundamentalista' | 'rebalanceamento' | 'proventos' | 'historico' | 'analise'>('carteira');
  const [carteiraSubTab, setCarteiraSubTab] = useState<'carteira' | 'geral' | 'alocacao'>('carteira');
  const [analyticsTicker, setAnalyticsTicker] = useState<string>('PETR4');
  const [tirMode, setTirMode] = useState<'dynamic' | 'period' | 'annual'>('dynamic');
  const [showTooltipInfo, setShowTooltipInfo] = useState<string | null>(null);

  // View & Filtering States for Carteira
  const [portfolioSearch, setPortfolioSearch] = useState('');
  const [portfolioTypeFilter, setPortfolioTypeFilter] = useState<string>('all');
  const [portfolioSort, setPortfolioSort] = useState<'value_desc' | 'value_asc' | 'gain_desc' | 'gain_asc' | 'ticker_asc' | 'div_desc'>('value_desc');
  const [portfolioViewMode, setPortfolioViewMode] = useState<'grid' | 'table'>('grid');

  // Transactions History Filter
  const [txSearch, setTxSearch] = useState('');
  const [txOpFilter, setTxOpFilter] = useState<'all' | 'buy' | 'sell'>('all');

  // Dividends Tab Filters
  const [divSearch, setDivSearch] = useState('');
  const [divTypeFilter, setDivTypeFilter] = useState<string>('all');
  const [divStatusFilter, setDivStatusFilter] = useState<string>('all');

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InvestmentTransaction | null>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<InvestmentTransaction | null>(null);
  const [deleteAllForTicker, setDeleteAllForTicker] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  // Transaction Form State
  const [operation, setOperation] = useState<'buy' | 'sell'>('buy');
  const [type, setType] = useState<string>('Ação');
  const [ticker, setTicker] = useState('');
  const [formCnpj, setFormCnpj] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [costs, setCosts] = useState('');
  const [reserveId, setReserveId] = useState(settings?.default_investment_reserve_id || '');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Dividend Form State
  const [isDivModalOpen, setIsDivModalOpen] = useState(false);
  const [editDiv, setEditDiv] = useState<Dividend | null>(null);
  const [divTicker, setDivTicker] = useState('');
  const [divAmount, setDivAmount] = useState('');
  const [divType, setDivType] = useState<DividendType>('Dividendo');
  const [divDataCom, setDivDataCom] = useState('');
  const [divDataEx, setDivDataEx] = useState('');

  // Dividend Delete Modal State
  const [isDivDeleteModalOpen, setIsDivDeleteModalOpen] = useState(false);
  const [divToDelete, setDivToDelete] = useState<Dividend | null>(null);
  const [isDeletingDiv, setIsDeletingDiv] = useState(false);

  // Asset Detail Raio-X Modal
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<Position | null>(null);

  // Export Portfolio Report Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  useEffect(() => {
    if (!editItem && settings?.default_investment_reserve_id && !reserveId) {
      setReserveId(settings.default_investment_reserve_id);
    }
  }, [settings?.default_investment_reserve_id]);

  // Fetch quotes only when entering the Investments page (on component mount)
  useEffect(() => {
    if (investmentTransactions.length > 0) {
      const tickers = Array.from(new Set(investmentTransactions.map(it => it.ticker.toUpperCase().trim()))).filter(Boolean);
      if (tickers.length > 0) {
        toast.promise(fetchQuotes(undefined, undefined, tickers), {
          loading: 'Atualizando cotações do portfólio de investimentos...',
          success: 'Cotações de investimento atualizadas!',
          error: 'Falha ao atualizar cotações de investimento.'
        });
      }
    }
  }, []);

  // Helper to fetch live quote for modal
  const handleFetchQuoteForTicker = async (targetTicker: string, force = false) => {
    const clean = targetTicker.toUpperCase().trim();
    if (!clean || clean.length < 3) return;

    if (!force && quotes[clean] && quotes[clean] > 0) {
      setPrice(quotes[clean].toString().replace('.', ','));
      return;
    }

    setIsLoadingQuote(true);
    try {
      const result = await fetchSingleQuote(clean, settings?.brapi_token);
      if (result && result.price > 0) {
        setPrice(result.price.toString().replace('.', ','));
        toast.info(`Preço de mercado de ${clean} atualizado: R$ ${result.price.toFixed(2).replace('.', ',')}`);
      } else if (force) {
        toast.error(`Cotação para ${clean} não encontrada online.`);
      }
    } catch (err) {
      console.warn('Erro ao buscar cotação de', clean, err);
      if (force) toast.error(`Erro ao buscar cotação de ${clean}.`);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const [raioXInitialTab, setRaioXInitialTab] = useState<'geral' | 'proventos' | 'valuation' | 'historico' | 'fundamentos'>('geral');

  const handleOpenRaioXModal = (ticker: string, initialTab: 'geral' | 'proventos' | 'valuation' | 'historico' | 'fundamentos' = 'geral') => {
    setRaioXInitialTab(initialTab);
    const clean = (ticker || '').toUpperCase().trim();
    if (!clean) return;
    const existing = positions.find(p => p.ticker.toUpperCase() === clean);
    if (existing) {
      setSelectedAssetDetail(existing);
    } else {
      const meta = b3AssetsMetadata[clean];
      const livePrice = quotes[clean] || meta?.last_price || meta?.lastPrice || 0;
      const isFii = meta?.asset_type === 'FII' || clean.endsWith('11');
      setSelectedAssetDetail({
        id: `synthetic-${clean}`,
        ticker: clean,
        name: meta?.name || `${clean} ${isFii ? 'FII' : 'S.A.'}`,
        type: isFii ? 'FII' : 'Ação',
        assetType: isFii ? 'FII' : 'Ação',
        quantity: 0,
        averagePrice: 0,
        totalInvested: 0,
        currentPrice: livePrice,
        currentTotal: 0,
        profitability: 0,
        profitabilityAmount: 0,
        allocationPct: 0,
        totalQuantity: 0,
      } as any);
    }
  };

  const handleSelectAssetForAnalytics = (assetTicker: string) => {
    handleOpenRaioXModal(assetTicker, 'valuation');
  };

  const getAssetTypeForTicker = (tk: string, explicitType?: string): 'Ação' | 'FII' => {
    if (explicitType === 'FII' || explicitType === 'Ação') {
      return explicitType;
    }
    const clean = (tk || '').toUpperCase().trim();
    if (!clean) return 'Ação';

    // Check positions
    const pos = positions.find(p => p.ticker.toUpperCase() === clean) || allPositions.find(p => p.ticker.toUpperCase() === clean);
    if (pos && (pos.type === 'FII' || pos.type === 'Ação')) {
      return pos.type as 'Ação' | 'FII';
    }

    // Check saved valuation targets
    const valTarget = valuationTargets[clean];
    if (valTarget?.asset_type === 'FII' || valTarget?.asset_type === 'Ação') {
      return valTarget.asset_type as 'Ação' | 'FII';
    }

    // Check transactions
    const lastTx = investmentTransactions.slice().reverse().find(t => t.ticker.toUpperCase() === clean);
    if (lastTx && (lastTx.type === 'FII' || lastTx.type === 'Ação')) {
      return lastTx.type as 'Ação' | 'FII';
    }

    // Check suffix standard for Brazilian market (FIIs end in 11)
    if (clean.endsWith('11')) return 'FII';

    return 'Ação';
  };

  const resetForm = (prefilledTicker?: string, initialOp: 'buy' | 'sell' = 'buy', prefilledType?: string) => {
    const tk = prefilledTicker || '';
    setOperation(initialOp);
    
    // Auto-detect asset type (Ação vs FII)
    const detectedType = getAssetTypeForTicker(tk, prefilledType);
    setType(detectedType);
    setTicker(tk);
    setFormCnpj(tk ? (getAssetCnpj(tk, settings) || '') : '');
    
    // Auto-fill price from cache if exists
    if (tk && quotes[tk.toUpperCase()] && quotes[tk.toUpperCase()] > 0) {
      setPrice(quotes[tk.toUpperCase()].toString().replace('.', ','));
    } else {
      setPrice('');
    }

    setQuantity('');
    setCosts('');
    setReserveId(settings?.default_investment_reserve_id || '');
    setDate(new Date().toISOString().split('T')[0]);
    setEditItem(null);
  };

  const openAddModal = (prefilledTicker?: string, initialOp: 'buy' | 'sell' = 'buy', prefilledType?: string) => {
    resetForm(prefilledTicker, initialOp, prefilledType);
    setIsModalOpen(true);

    if (prefilledTicker) {
      const clean = prefilledTicker.toUpperCase().trim();
      if (!quotes[clean] || quotes[clean] <= 0) {
        handleFetchQuoteForTicker(clean);
      }
    }
  };

  const openEditModal = (tx: InvestmentTransaction) => {
    setEditItem(tx);
    setOperation(tx.operation);
    setType(tx.type);
    setTicker(tx.ticker);
    setFormCnpj(tx.cnpj || getAssetCnpj(tx.ticker, settings) || '');
    setPrice(tx.price.toString().replace('.', ','));
    setQuantity(tx.quantity.toString().replace('.', ','));
    setCosts(tx.costs ? tx.costs.toString().replace('.', ',') : '');
    setReserveId(tx.reserve_id || '');
    setDate(tx.date);
    setIsModalOpen(true);
  };

  const openAddDivModal = (prefilledTicker?: string) => {
    setEditDiv(null);
    setDivTicker(prefilledTicker || '');
    setDivAmount('');
    setDivType('Dividendo');
    setDivDataCom('');
    const today = new Date().toISOString().split('T')[0];
    setDivDataEx(today);
    setIsDivModalOpen(true);
  };

  const openEditDivModal = (div: Dividend) => {
    setEditDiv(div);
    setDivTicker(div.ticker);
    
    let unitAmountVal = div.unit_amount;
    if (unitAmountVal === undefined || unitAmountVal === null) {
      const targetDate = (div.data_com || div.data_ex || '').split('T')[0];
      const tickerSearch = div.ticker.toUpperCase().trim();
      
      const quantityOnDate = investmentTransactions
        .filter(tx => {
          const txTicker = tx.ticker.toUpperCase().trim();
          const txDate = tx.date.split('T')[0];
          return txTicker === tickerSearch && txDate <= targetDate;
        })
        .reduce((acc, tx) => {
          return tx.operation === 'buy' ? acc + tx.quantity : acc - tx.quantity;
        }, 0);
        
      if (quantityOnDate > 0) {
        unitAmountVal = div.amount / quantityOnDate;
      } else {
        unitAmountVal = div.amount;
      }
    }

    setDivAmount(unitAmountVal.toString().replace('.', ','));
    setDivType(div.type);
    setDivDataCom(div.data_com || '');
    setDivDataEx(div.data_ex || '');
    setIsDivModalOpen(true);
  };

  const handleOpenDelete = (tx: InvestmentTransaction) => {
    setTxToDelete(tx);
    setDeleteAllForTicker(false);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!txToDelete) return;
    
    if (deleteAllForTicker) {
      await deleteInvestmentTransactionsByTicker(txToDelete.ticker);
      toast.success(`Todos os lançamentos de ${txToDelete.ticker} foram excluídos.`);
      if (selectedAssetDetail?.ticker === txToDelete.ticker) {
        setSelectedAssetDetail(null);
      }
    } else {
      await deleteInvestmentTransaction(txToDelete.id);
      toast.success('Lançamento excluído com sucesso.');
    }
    
    setIsDeleteModalOpen(false);
    setTxToDelete(null);
  };

  const handleOpenDeleteDiv = (div: Dividend) => {
    setDivToDelete(div);
    setIsDivDeleteModalOpen(true);
  };

  const handleConfirmDeleteDiv = async () => {
    if (!divToDelete || isDeletingDiv) return;
    setIsDeletingDiv(true);
    try {
      await deleteDividend(divToDelete.id);
      toast.success('Provento excluído com sucesso.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir provento.');
    } finally {
      setIsDeletingDiv(false);
      setIsDivDeleteModalOpen(false);
      setDivToDelete(null);
    }
  };

  // Batch Buy execution from RebalanceWizard
  const handleBatchBuy = async (items: Array<{ ticker: string; type: 'Ação' | 'FII' | string; quantity: number; price: number; costs?: number }>) => {
    const today = new Date().toISOString().split('T')[0];
    const defaultResId = settings?.default_investment_reserve_id || undefined;

    for (const item of items) {
      const itemCosts = item.costs || 0;
      const payload = {
        operation: 'buy' as const,
        type: item.type,
        ticker: item.ticker.toUpperCase().trim(),
        price: item.price,
        quantity: item.quantity,
        costs: itemCosts,
        amount: Math.round(((item.price * item.quantity) + itemCosts) * 100) / 100,
        reserve_id: defaultResId,
        date: today
      };
      await addInvestmentTransaction(payload);
    }
  };

  const handleSaveDiv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!divTicker || !divAmount || !divDataEx) {
      toast.error('Preencha os campos obrigatórios!');
      return;
    }

    setIsSaving(true);
    try {
      const numUnitAmount = parseNumericValue(divAmount);
      if (isNaN(numUnitAmount) || numUnitAmount <= 0) {
        toast.error('Valor inválido!');
        setIsSaving(false);
        return;
      }

      const targetDate = (divDataCom || divDataEx).split('T')[0];
      const tickerSearch = divTicker.toUpperCase().trim();
      
      const quantityOnDate = investmentTransactions
        .filter(tx => {
          const txTicker = tx.ticker.toUpperCase().trim();
          const txDate = tx.date.split('T')[0];
          return txTicker === tickerSearch && txDate <= targetDate;
        })
        .reduce((acc, tx) => {
          return tx.operation === 'buy' ? acc + tx.quantity : acc - tx.quantity;
        }, 0);

      const totalAmount = numUnitAmount * quantityOnDate;

      if (quantityOnDate <= 0) {
        toast.error(`Você não possuía posição em ${divTicker.toUpperCase()} na data informada (${targetDate}).`);
        setIsSaving(false);
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const autoStatus: DividendStatus = divDataEx <= todayStr ? 'received' : 'provisioned';

      const payload = {
        ticker: divTicker.toUpperCase().trim(),
        amount: totalAmount,
        unit_amount: numUnitAmount,
        type: divType,
        status: autoStatus,
        date: divDataEx,
        data_com: divDataCom || undefined,
        data_ex: divDataEx || undefined
      };

      if (editDiv) {
        await updateDividend(editDiv.id, payload);
      } else {
        await addDividend(payload);
      }
      setIsDivModalOpen(false);
    } catch (error) {
      console.error('Error saving dividend:', error);
      toast.error('Erro ao salvar provento.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!ticker || !price || !quantity || !date) {
      toast.error('Preencha os campos obrigatórios!');
      return;
    }
    
    setIsSaving(true);
    try {
      const numPrice = parseNumericValue(price);
      const numQtd = parseNumericValue(quantity);
      const numCosts = parseNumericValue(costs);
      
      if (isNaN(numPrice) || numPrice <= 0 || isNaN(numQtd) || numQtd <= 0 || isNaN(numCosts) || numCosts < 0) {
        toast.error('Valores inválidos. Verifique os campos preenchidos.');
        setIsSaving(false);
        return;
      }

      const cleanTicker = ticker.toUpperCase().trim();

      if (formCnpj) {
        const cleanCnpjDigits = formCnpj.replace(/\D/g, '');
        if (cleanCnpjDigits.length >= 8) {
          const formatted = formatCnpj(cleanCnpjDigits);
          await updateAssetCnpj(cleanTicker, formatted);
        }
      }

      const subtotal = numPrice * numQtd;
      const isBuy = operation === 'buy';
      const totalOpAmount = isBuy ? subtotal + numCosts : Math.max(0, subtotal - numCosts);

      const payload = {
        operation,
        type,
        ticker: cleanTicker,
        cnpj: formCnpj || undefined,
        price: numPrice,
        quantity: numQtd,
        costs: numCosts,
        amount: Math.round(totalOpAmount * 100) / 100,
        reserve_id: reserveId || undefined,
        date
      };

      if (editItem) {
        await updateInvestmentTransaction(editItem.id, payload);
        toast.success('Lançamento atualizado!');
      } else {
        await addInvestmentTransaction(payload);
        toast.success('Lançamento realizado!');
      }
      
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast.error('Erro ao salvar lançamento.');
    } finally {
      setIsSaving(false);
    }
  };

  // 1. Calculate Portfolio Positions (open and closed)
  const allPositions = useMemo(() => {
    const posMap: Record<string, Position> = {};
    
    const sortedTx = [...investmentTransactions].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.created_at || '').localeCompare(b.created_at || '');
    });

    sortedTx.forEach(it => {
      const tk = it.ticker.toUpperCase();
      if (!posMap[tk]) {
        posMap[tk] = {
          ticker: tk,
          type: it.type,
          totalQuantity: 0,
          totalInvested: 0,
          averagePrice: 0,
          currentPrice: null,
          currentValue: null,
          dividendsReceived: 0,
          yieldOnCost: 0,
          realizedGain: 0,
        };
      }
      
      const pos = posMap[tk];
      const txCosts = it.costs || 0;
      
      if (it.operation === 'buy') {
        const subtotal = it.price * it.quantity;
        const isAmountSubtotalOnly = Math.abs(it.amount - subtotal) < 0.01 && txCosts > 0;
        const costBasis = isAmountSubtotalOnly ? it.amount + txCosts : it.amount;

        pos.totalInvested += costBasis;
        pos.totalQuantity += it.quantity;
        pos.averagePrice = pos.totalQuantity > 0 ? pos.totalInvested / pos.totalQuantity : 0;
      } else if (it.operation === 'sell') {
        const subtotal = it.price * it.quantity;
        const isAmountSubtotalOnly = Math.abs(it.amount - subtotal) < 0.01 && txCosts > 0;
        const netProceeds = isAmountSubtotalOnly ? Math.max(0, it.amount - txCosts) : it.amount;

        const costBasisSold = it.quantity * pos.averagePrice;
        const gainOnSale = netProceeds - costBasisSold;

        pos.realizedGain = (pos.realizedGain || 0) + gainOnSale;
        pos.totalQuantity -= it.quantity;
        if (pos.totalQuantity <= 0) {
           pos.totalQuantity = 0;
           pos.totalInvested = 0;
           pos.averagePrice = 0;
        } else {
           pos.totalInvested = pos.totalQuantity * pos.averagePrice;
        }
      }
    });

    // Dividends received (or received + provisioned based on global analysis mode)
    dividends.forEach(d => {
      const isIncluded = dividendAnalysisMode === 'include_provisioned'
        ? (d.status === 'received' || d.status === 'provisioned')
        : (d.status === 'received');

      if (isIncluded) {
        const tk = d.ticker.toUpperCase();
        if (posMap[tk]) {
          posMap[tk].dividendsReceived += d.amount;
        }
      }
    });

    const posArray = Object.values(posMap);
    const totalPosValue = posArray.reduce((acc, p) => {
      const q = quotes[p.ticker] || p.averagePrice || 0;
      return acc + (q * p.totalQuantity);
    }, 0);

    posArray.forEach(p => {
      if (quotes[p.ticker]) {
        p.currentPrice = quotes[p.ticker];
      }
      p.currentValue = (p.currentPrice || p.averagePrice || 0) * p.totalQuantity;
      p.currentPct = totalPosValue > 0 ? (p.currentValue / totalPosValue) * 100 : 0;
      p.yieldOnCost = p.totalInvested > 0 ? (p.dividendsReceived / p.totalInvested) * 100 : 0;
    });

    return posArray;
  }, [investmentTransactions, dividends, quotes, dividendAnalysisMode]);

  const positions = useMemo(() => {
    return allPositions.filter(p => p.totalQuantity > 0);
  }, [allPositions]);

  // Tickers list
  const allPortfolioTickers = useMemo(() => {
    const set = new Set<string>();
    positions.forEach(p => set.add(p.ticker));
    investmentTransactions.forEach(tx => set.add(tx.ticker.toUpperCase()));
    return Array.from(set).sort();
  }, [positions, investmentTransactions]);

  // Totals
  const totalInvested = useMemo(() => positions.reduce((acc, p) => acc + p.totalInvested, 0), [positions]);
  const totalCurrent = useMemo(() => positions.reduce((acc, p) => acc + (p.currentValue || p.totalInvested), 0), [positions]);
  const totalCapitalGain = totalCurrent - totalInvested;
  const totalRealizedGain = useMemo(() => allPositions.reduce((acc, p) => acc + (p.realizedGain || 0), 0), [allPositions]);
  const capitalGainPercent = totalInvested > 0 ? (totalCapitalGain / totalInvested) * 100 : 0;

  const divTotals = useMemo(() => {
    const received = dividends.filter(d => d.status === 'received').reduce((acc, d) => acc + d.amount, 0);
    const provisioned = dividends.filter(d => d.status === 'provisioned').reduce((acc, d) => acc + d.amount, 0);
    const considered = dividendAnalysisMode === 'include_provisioned' ? (received + provisioned) : received;
    return { received, provisioned, considered };
  }, [dividends, dividendAnalysisMode]);

  // Comprehensive portfolio-wide projections (Annualized yield, estimated passive income)
  const portfolioProjections = useMemo(() => {
    return calculatePortfolioProjections(positions, dividends, dividendAnalysisMode);
  }, [positions, dividends, dividendAnalysisMode]);

  const totalReturnWithDividends = totalCapitalGain + totalRealizedGain + divTotals.considered;
  const totalReturnPercent = totalInvested > 0 ? (totalReturnWithDividends / totalInvested) * 100 : 0;
  const overallYieldOnCost = totalInvested > 0 ? (divTotals.considered / totalInvested) * 100 : 0;

  // Real performance metrics (TWR and dynamic XIRR)
  const performanceMetrics = useMemo(() => {
    return calculatePortfolioPerformanceMetrics(
      investmentTransactions,
      dividends,
      quotes,
      totalCurrent,
      dividendAnalysisMode
    );
  }, [investmentTransactions, dividends, quotes, totalCurrent, dividendAnalysisMode]);

  // Professional Portfolio Diagnosis & Risk Engine
  const portfolioDiagnosis = useMemo(() => {
    return runPortfolioDiagnosis(
      positions.map(p => ({
        ticker: p.ticker,
        type: p.type,
        totalQuantity: p.totalQuantity,
        averagePrice: p.averagePrice,
        currentPrice: p.currentPrice,
        totalInvested: p.totalInvested,
        currentValue: p.currentValue,
        dividendsReceived: p.dividendsReceived,
        yieldOnCost: p.yieldOnCost || 0
      })),
      quotes
    );
  }, [positions, quotes]);

  const configuredReserve = useMemo(() => {
    return reserves.find(r => r.id === settings?.default_investment_reserve_id);
  }, [reserves, settings]);

  // Allocation Classes Breakdown
  const allocationBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    positions.forEach(p => {
      const val = p.currentValue || p.totalInvested;
      map[p.type] = (map[p.type] || 0) + val;
    });

    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map).map(([type, val]) => ({
      type,
      val,
      pct: total > 0 ? (val / total) * 100 : 0
    })).sort((a, b) => b.val - a.val);
  }, [positions]);

  // Filtered & Sorted Positions
  const filteredPositions = useMemo(() => {
    return positions
      .filter(p => {
        const matchesSearch = p.ticker.toLowerCase().includes(portfolioSearch.toLowerCase());
        const matchesType = portfolioTypeFilter === 'all' || p.type.toLowerCase() === portfolioTypeFilter.toLowerCase();
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        const valA = a.currentValue || a.totalInvested;
        const valB = b.currentValue || b.totalInvested;
        const gainA = a.currentValue ? ((a.currentValue - a.totalInvested) / a.totalInvested) * 100 : 0;
        const gainB = b.currentValue ? ((b.currentValue - b.totalInvested) / b.totalInvested) * 100 : 0;

        if (portfolioSort === 'value_desc') return valB - valA;
        if (portfolioSort === 'value_asc') return valA - valB;
        if (portfolioSort === 'gain_desc') return gainB - gainA;
        if (portfolioSort === 'gain_asc') return gainA - gainB;
        if (portfolioSort === 'ticker_asc') return a.ticker.localeCompare(b.ticker);
        if (portfolioSort === 'div_desc') return b.dividendsReceived - a.dividendsReceived;
        return 0;
      });
  }, [positions, portfolioSearch, portfolioTypeFilter, portfolioSort]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return investmentTransactions
      .filter(tx => {
        const matchesSearch = tx.ticker.toLowerCase().includes(txSearch.toLowerCase());
        const matchesOp = txOpFilter === 'all' || tx.operation === txOpFilter;
        return matchesSearch && matchesOp;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
  }, [investmentTransactions, txSearch, txOpFilter]);

  // Filtered Dividends
  const filteredDividends = useMemo(() => {
    return dividends
      .filter(d => {
        const matchesSearch = d.ticker.toLowerCase().includes(divSearch.toLowerCase());
        const matchesType = divTypeFilter === 'all' || d.type === divTypeFilter;
        const matchesStatus = divStatusFilter === 'all' || d.status === divStatusFilter;
        return matchesSearch && matchesType && matchesStatus;
      })
      .sort((a, b) => {
        const dateA = a.data_ex || a.date;
        const dateB = b.data_ex || b.date;
        return dateB.localeCompare(dateA);
      });
  }, [dividends, divSearch, divTypeFilter, divStatusFilter]);

  const formatCurrency = (val: number) => {
    if (hideValues) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatPercent = (val: number) => {
    if (hideValues) return '•••%';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in pb-28">
      {/* PAGE HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent flex items-center gap-2">
                Investimentos & Carteira
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium mt-0.5">
                Gestão de ativos, rebalanceamento inteligente, proventos e valuation.
              </p>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Privacy Toggle */}
          <button
            onClick={() => setHideValues(!hideValues)}
            className="p-2 sm:px-3 sm:py-2 text-xs font-bold rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border transition-all flex items-center gap-1.5"
            title={hideValues ? "Mostrar Valores" : "Ocultar Valores"}
          >
            {hideValues ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4 text-primary" />}
            <span className="hidden sm:inline">{hideValues ? 'Oculto' : 'Visível'}</span>
          </button>

          {/* Refresh Quotes & Provider Selector */}
          <div className="flex items-center bg-card border border-border/60 rounded-xl p-0.5 shadow-sm">
            <button
              onClick={() => fetchQuotes()}
              disabled={isFetchingQuotes}
              className="p-2 sm:px-3 sm:py-1.5 text-xs font-bold rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title="Atualizar cotações do mercado"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isFetchingQuotes ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Cotações</span>
            </button>

            <button
              onClick={() => setIsQuoteProviderModalOpen(true)}
              className="p-2 sm:px-2.5 sm:py-1.5 text-xs font-bold rounded-lg hover:bg-muted/80 text-cyan-600 dark:text-cyan-400 transition-all flex items-center gap-1 border-l border-border/60 cursor-pointer"
              title="Configurar fonte de cotações (Brapi, Yahoo, HG Brasil...)"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-500 fill-cyan-500/20" />
              <span className="text-[10px] uppercase font-black tracking-wider hidden md:inline">
                {settings?.quote_provider === 'brapi'
                  ? 'Brapi'
                  : settings?.quote_provider === 'yahoo'
                  ? 'Yahoo'
                  : settings?.quote_provider === 'hgbrasil'
                  ? 'HG Brasil'
                  : settings?.quote_provider === 'mfinance'
                  ? 'mFinance'
                  : 'Multi-Fonte'}
              </span>
              <Sliders className="w-3 h-3 text-muted-foreground ml-0.5" />
            </button>
          </div>

          {/* Share/Export Report */}
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="p-2 sm:px-3 sm:py-2 text-xs font-bold rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border transition-all flex items-center gap-1.5"
            title="Gerar relatório da carteira"
          >
            <Share2 className="w-4 h-4 text-sky-500" />
            <span className="hidden sm:inline">Relatório</span>
          </button>

          {/* Primary Action Button */}
          <button
            onClick={() => openAddModal()}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm shadow-primary/20 shrink-0"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" /> 
            <span>Novo Aporte</span>
          </button>
        </div>
      </header>

      {/* NAVIGATION TABS */}
      <div className="flex p-1 bg-muted/40 rounded-2xl border border-border/40 w-full overflow-x-auto custom-scrollbar gap-1">
        <button
          onClick={() => setActiveTab('carteira')}
          className={`px-3 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap flex-1 min-w-[130px] ${
            activeTab === 'carteira' || activeTab === 'analise'
              ? 'bg-card text-foreground shadow-xs border border-border/50' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Briefcase className="w-4 h-4 text-primary" />
          <span>Carteira</span>
          {positions.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary font-extrabold">
              {positions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('fundamentalista')}
          className={`px-3 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap flex-1 min-w-[165px] ${
            activeTab === 'fundamentalista' 
              ? 'bg-card text-foreground shadow-xs border border-border/50' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Award className="w-4 h-4 text-amber-500" />
          <span>Ranking Ativos</span>
          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold">
            Score
          </span>
        </button>

        <button
          onClick={() => setActiveTab('rebalanceamento')}
          className={`px-3 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap flex-1 min-w-[155px] ${
            activeTab === 'rebalanceamento' 
              ? 'bg-card text-foreground shadow-xs border border-border/50' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Scale className="w-4 h-4 text-indigo-500" />
          <span>Rebalancear & Aportes</span>
        </button>

        <button
          onClick={() => setActiveTab('proventos')}
          className={`px-3 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap flex-1 min-w-[120px] ${
            activeTab === 'proventos' 
              ? 'bg-card text-foreground shadow-xs border border-border/50' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-500" />
          <span>Proventos</span>
          {divTotals.provisioned > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/10 text-amber-500 font-extrabold animate-pulse">
              !
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('historico')}
          className={`px-3 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap flex-1 min-w-[130px] ${
            activeTab === 'historico' 
              ? 'bg-card text-foreground shadow-xs border border-border/50' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4 text-sky-500" />
          <span>Lançamentos</span>
        </button>
      </div>

      {/* TAB 1: CARTEIRA & ANÁLISE INTEGRADA */}
      {(activeTab === 'carteira' || activeTab === 'analise') && (
        <div className="space-y-6">
          {/* RESERVE BANNER */}
          {configuredReserve && (
            <div className="p-4 rounded-2xl border border-border/50 bg-card shadow-xs flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Reserva Vinculada de Investimentos
                  </p>
                  <p className="text-base font-black text-foreground">{configuredReserve.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Saldo em Caixa</p>
                <p className="text-lg font-black text-amber-500">{formatCurrency(configuredReserve.saldo_atual || 0)}</p>
              </div>
            </div>
          )}

          {/* PROVISIONED DIVIDENDS INCLUSION TOGGLE BANNER */}
          {divTotals.provisioned > 0 && (
            <div className="p-3.5 rounded-2xl border border-border/50 bg-card shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    Proventos Provisionados Anunciados: <strong className="text-amber-500">{formatCurrency(divTotals.provisioned)}</strong>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {dividendAnalysisMode === 'include_provisioned' 
                      ? 'As métricas de retorno e Yield on Cost estão considerando os proventos futuros já anunciados.'
                      : 'As métricas estão considerando apenas proventos já efetivados e creditados em conta.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center p-1 bg-muted/50 rounded-xl border border-border/50 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setDividendAnalysisMode('received_only')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    dividendAnalysisMode !== 'include_provisioned'
                      ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-border/60 font-black'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Apenas Recebidos</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDividendAnalysisMode('include_provisioned')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    dividendAnalysisMode === 'include_provisioned'
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

          {/* ROW 1: PRIMARY PORTFOLIO METRICS (TOTAL INVESTIDO, PATRIMÔNIO ATUAL, YIELD PROJETADO, YIELD ON COST) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Total Investido */}
            <div className="p-4 rounded-2xl border border-border/50 bg-card shadow-xs flex flex-col justify-between relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Total Investido
                </span>
                <Briefcase className="w-4 h-4 text-primary" />
              </div>
              <div className="mt-2">
                <p className="text-xl font-black tracking-tight">{formatCurrency(totalInvested)}</p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  Custo total de aquisição
                </p>
              </div>
            </div>

            {/* Patrimônio Atual */}
            <div className="p-4 rounded-2xl border border-border/50 bg-card shadow-xs flex flex-col justify-between relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Patrimônio Atual
                </span>
                <Wallet className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="mt-2">
                <p className="text-xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(totalCurrent)}
                </p>
                <p className={`text-[10px] font-bold mt-0.5 ${totalCapitalGain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  Ganho: {formatCurrency(totalCapitalGain)} ({formatPercent(capitalGainPercent)})
                </p>
              </div>
            </div>

            {/* Yield Projetado 12M */}
            <div className="p-4 rounded-2xl border border-border/50 bg-card shadow-xs flex flex-col justify-between relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Yield Projetado (12M)
                </span>
                <button
                  onClick={() => setDividendAnalysisMode(dividendAnalysisMode === 'received_only' ? 'include_provisioned' : 'received_only')}
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all border border-amber-500/20 cursor-pointer"
                  title="Clique para alternar entre considerar apenas Recebidos ou Recebidos + Provisionados"
                >
                  {dividendAnalysisMode === 'include_provisioned' ? '+ Provisionados' : 'Recebidos'}
                </button>
              </div>
              <div className="mt-2">
                <p className="text-xl font-black tracking-tight text-amber-500">
                  {portfolioProjections.portfolioProjectedDividendYield.toFixed(2)}% <span className="text-xs font-semibold text-muted-foreground">a.a.</span>
                </p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  Est. {formatCurrency(portfolioProjections.totalProjectedAnnualIncome)}/ano • {formatCurrency(portfolioProjections.totalProjectedMonthlyIncome)}/mês
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
                  {formatPercent(overallYieldOnCost)}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  {formatCurrency(divTotals.considered)} em proventos {dividendAnalysisMode === 'include_provisioned' ? '(c/ provisionados)' : '(recebidos)'}.
                </p>
              </div>
            </div>
          </div>

          {/* ROW 2: TWR, TIR, GANHO DE CAPITAL, RETORNO TOTAL */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* TWR */}
            <div className="p-4 rounded-2xl bg-indigo-500/[0.04] border border-indigo-500/20 flex flex-col justify-between relative group shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  TWR (Retorno Temporal)
                  <button
                    type="button"
                    onClick={() => setShowTooltipInfo(showTooltipInfo === 'twr' ? null : 'twr')}
                    className="text-muted-foreground/70 hover:text-indigo-500 transition-colors cursor-pointer"
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
                        className="text-muted-foreground/70 hover:text-emerald-500 transition-colors cursor-pointer"
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
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
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
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
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
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
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

            {/* Ganho de Capital */}
            <div className="p-4 rounded-2xl bg-sky-500/[0.04] border border-sky-500/20 flex flex-col justify-between shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Ganho de Capital
                </span>
                <TrendingUp className="w-4 h-4 text-sky-500" />
              </div>
              <div className="mt-2">
                <p className={`text-xl font-black tracking-tight ${totalCapitalGain >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-500'}`}>
                  {formatCurrency(totalCapitalGain)}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  {formatPercent(capitalGainPercent)} sobre o valor investido.
                </p>
              </div>
            </div>

            {/* Retorno Total da Carteira */}
            <div className="p-4 rounded-2xl border border-border/50 bg-card shadow-xs flex flex-col justify-between relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Retorno Total da Carteira
                </span>
                <Award className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2">
                <p className={`text-xl font-black tracking-tight ${totalReturnWithDividends >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {formatCurrency(totalReturnWithDividends)}
                </p>
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Lucro: {formatPercent(totalReturnPercent)} • Total em proventos
                </p>
              </div>
            </div>
          </div>

          {/* SUB-MODULES NAVIGATION TABS */}
          <div className="flex p-1.5 bg-muted/40 rounded-2xl border border-border/40 w-full overflow-x-auto scrollbar-none gap-1">
            <button
              onClick={() => setCarteiraSubTab('carteira')}
              className={`flex-1 min-w-[130px] px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                carteiraSubTab === 'carteira' 
                  ? 'bg-card text-foreground shadow-xs border border-border/50' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-primary" />
              Minha Carteira
            </button>

            <button
              onClick={() => setCarteiraSubTab('geral')}
              className={`flex-1 min-w-[120px] px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                carteiraSubTab === 'geral' 
                  ? 'bg-card text-foreground shadow-xs border border-border/50' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Geral & Visão
            </button>

            <button
              onClick={() => setCarteiraSubTab('alocacao')}
              className={`flex-1 min-w-[120px] px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                carteiraSubTab === 'alocacao' 
                  ? 'bg-card text-foreground shadow-xs border border-border/50' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5 text-indigo-500" />
              Alocação
            </button>
          </div>

          {/* DYNAMIC MODULE CONTENTS */}
          {carteiraSubTab === 'carteira' ? (
            <div className="space-y-6">

          {/* ALLOCATION PROGRESS BAR */}
          {allocationBreakdown.length > 0 && (
            <div className="p-4 rounded-2xl border border-border/50 bg-card shadow-xs space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <PieIcon className="w-3.5 h-3.5 text-primary" />
                  Alocação por Classe de Ativo (Clique para filtrar)
                </span>
                <span className="text-foreground">{positions.length} posições ativas</span>
              </div>
              
              {/* Multi-segment bar */}
              <div className="w-full h-3 rounded-full bg-muted/50 overflow-hidden flex cursor-pointer">
                {allocationBreakdown.map((item, idx) => {
                  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500'];
                  const colorClass = colors[idx % colors.length];
                  const isSelected = portfolioTypeFilter.toLowerCase() === item.type.toLowerCase();
                  return (
                    <div
                      key={item.type}
                      onClick={() => setPortfolioTypeFilter(isSelected ? 'all' : item.type)}
                      className={`h-full transition-all duration-300 hover:opacity-80 ${colorClass} ${isSelected ? 'ring-2 ring-foreground z-10' : ''}`}
                      style={{ width: `${item.pct}%` }}
                      title={`${item.type}: ${formatCurrency(item.val)} (${item.pct.toFixed(1)}%) - Clique para filtrar`}
                    ></div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 text-xs flex-wrap pt-1">
                <button
                  type="button"
                  onClick={() => setPortfolioTypeFilter('all')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                    portfolioTypeFilter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Todas ({positions.length})
                </button>
                {allocationBreakdown.map((item, idx) => {
                  const bgColors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500'];
                  const isSelected = portfolioTypeFilter.toLowerCase() === item.type.toLowerCase();
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setPortfolioTypeFilter(isSelected ? 'all' : item.type)}
                      className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-lg transition-all border ${
                        isSelected 
                          ? 'bg-secondary border-primary/40 text-foreground font-black shadow-xs' 
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${bgColors[idx % bgColors.length]}`}></span>
                      <span>{item.type}:</span>
                      <span>{formatCurrency(item.val)} ({item.pct.toFixed(1)}%)</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* CONTROLS: SEARCH, FILTER, SORT, VIEW TOGGLE */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={portfolioSearch}
                  onChange={e => setPortfolioSearch(e.target.value)}
                  placeholder="Buscar por ticker (Ex: PETR4, MXRF11)..."
                  className="w-full bg-card border border-border/50 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[40px]"
                />
                {portfolioSearch && (
                  <button onClick={() => setPortfolioSearch('')} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={portfolioTypeFilter}
                onChange={e => setPortfolioTypeFilter(e.target.value)}
                className="bg-card border border-border/50 rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[40px]"
              >
                <option value="all">Todas as Classes</option>
                <option value="Ação">Ações</option>
                <option value="FII">Fundos Imobiliários</option>
                <option value="BDR">BDRs</option>
                <option value="ETF">ETFs</option>
                <option value="Renda Fixa">Renda Fixa</option>
                <option value="Cripto">Cripto</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                <select
                  value={portfolioSort}
                  onChange={e => setPortfolioSort(e.target.value as any)}
                  className="bg-card border border-border/50 rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="value_desc">Maior Valor</option>
                  <option value="value_asc">Menor Valor</option>
                  <option value="gain_desc">Maior Lucro %</option>
                  <option value="gain_asc">Menor Lucro %</option>
                  <option value="div_desc">Maior Provento</option>
                  <option value="ticker_asc">Nome (A-Z)</option>
                </select>
              </div>

              <div className="flex p-0.5 bg-muted/40 rounded-xl border border-border/40">
                <button
                  onClick={() => setPortfolioViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${portfolioViewMode === 'grid' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
                  title="Visualização em Grade"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPortfolioViewMode('table')}
                  className={`p-1.5 rounded-lg transition-all ${portfolioViewMode === 'table' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
                  title="Visualização em Tabela"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* POSITIONS LIST */}
          {filteredPositions.length === 0 ? (
            <div className="p-10 text-center rounded-3xl border border-dashed border-border/60 bg-muted/10 space-y-3">
              <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-bold text-muted-foreground">Nenhuma posição encontrada.</p>
              <p className="text-xs text-muted-foreground/70">
                {portfolioSearch ? 'Tente alterar os termos da busca.' : 'Clique em "Novo Aporte" para começar a montar sua carteira.'}
              </p>
              <button
                onClick={() => openAddModal()}
                className="mt-2 px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                Registrar Primeiro Aporte
              </button>
            </div>
          ) : portfolioViewMode === 'grid' ? (
            /* GRID VIEW CARDS */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPositions.map(p => {
                const curVal = p.currentValue || p.totalInvested;
                const profitR$ = p.currentValue ? p.currentValue - p.totalInvested : 0;
                const profitPerc = p.currentValue 
                  ? ((p.currentValue - p.totalInvested) / p.totalInvested) * 100 
                  : 0;
                const isPos = profitPerc >= 0;
                const portfolioWeight = totalCurrent > 0 ? (curVal / totalCurrent) * 100 : 0;

                // Dynamic financial projection for this asset
                const cleanTicker = p.ticker.toUpperCase().trim();
                const savedValuation = valuationTargets[cleanTicker];
                const proj = calculateAssetDividendProjection(
                  p.ticker,
                  p.type,
                  p.totalQuantity,
                  p.totalInvested,
                  p.averagePrice,
                  p.currentPrice,
                  dividends,
                  dividendAnalysisMode,
                  savedValuation
                );

                const currentAssetCnpj = getAssetCnpj(p.ticker, settings);

                // Category avatar colors
                const getTypeColor = (type: string) => {
                  switch (type.toLowerCase()) {
                    case 'ação': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
                    case 'fii': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                    case 'bdr': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                    case 'etf': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
                    case 'renda fixa': return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
                    default: return 'bg-secondary text-secondary-foreground border-border/40';
                  }
                };

                return (
                  <div 
                    key={p.ticker}
                    onClick={() => setSelectedAssetDetail(p)}
                    className="p-5 rounded-2xl border border-border/50 bg-card/65 backdrop-blur-xs hover:border-primary/50 hover:shadow-lg transition-all duration-300 flex flex-col justify-between gap-4 group relative cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAssetDetail(p); } }}
                  >
                    {/* Header: Ticker, Type, CNPJ, Price & Variation */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-xs tracking-wider border shadow-2xs shrink-0 ${getTypeColor(p.type)}`}>
                          <span className="text-[10px] opacity-75">{p.type.slice(0, 3).toUpperCase()}</span>
                          <span className="text-[11px] font-black">{p.ticker.slice(0, 4)}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-base sm:text-lg font-black tracking-tight group-hover:text-primary transition-colors">
                              {p.ticker}
                            </h4>
                            <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground uppercase tracking-wide">
                              {p.type}
                            </span>
                            {currentAssetCnpj && (
                              <span className="text-[8.5px] font-bold text-muted-foreground hidden sm:inline">
                                {formatCnpj(currentAssetCnpj)}
                              </span>
                            )}
                          </div>
                          {(() => {
                            const meta = b3AssetsMetadata[cleanTicker];
                            const subtitleText = meta
                              ? (p.type === 'Ação' || p.type === 'BDR' ? meta.sector : meta.fiiSegment)
                              : null;
                            return (
                              <p className="text-[11px] text-muted-foreground font-semibold mt-0.5 truncate max-w-[200px]">
                                {subtitleText || 'Ativo da B3'}
                              </p>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-base sm:text-lg font-black tracking-tight text-foreground">
                          {p.currentPrice ? formatCurrency(p.currentPrice) : formatCurrency(p.averagePrice)}
                        </p>
                        <div className={`text-[10.5px] font-extrabold flex items-center justify-end gap-0.5 ${isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span>{isPos ? '+' : ''}{profitPerc.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Metrics Box - Structured Row & Columns */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-muted/20 border border-border/30 text-xs">
                      {/* Custódia */}
                      <div className="space-y-0.5">
                        <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">Custódia</span>
                        <p className="font-extrabold text-foreground text-xs sm:text-sm">{p.totalQuantity} <span className="text-[10px] text-muted-foreground">un.</span></p>
                        <p className="text-[10px] text-muted-foreground font-medium truncate">PM: {formatCurrency(p.averagePrice)}</p>
                      </div>

                      {/* Patrimônio */}
                      <div className="space-y-0.5">
                        <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">Patrimônio</span>
                        <p className="font-extrabold text-foreground text-xs sm:text-sm">{formatCurrency(curVal)}</p>
                        <p className="text-[10px] text-muted-foreground font-medium truncate">Aplicado: {formatCurrency(p.totalInvested)}</p>
                      </div>

                      {/* Retorno */}
                      <div className="space-y-0.5">
                        <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">Retorno</span>
                        <p className={`font-extrabold text-xs sm:text-sm ${isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isPos ? '+' : ''}{formatCurrency(profitR$)}
                        </p>
                        <p className={`text-[10px] font-semibold ${isPos ? 'text-emerald-500/90' : 'text-rose-500/90'}`}>
                          {isPos ? '+' : ''}{profitPerc.toFixed(1)}%
                        </p>
                      </div>

                      {/* Proventos */}
                      <div className="space-y-0.5">
                        <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider block">Proventos</span>
                        <p className="font-extrabold text-amber-500 text-xs sm:text-sm">
                          {proj.projectedDividendYield.toFixed(2)}% <span className="text-[8.5px] font-bold text-muted-foreground">DY</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium truncate">Pago: {formatCurrency(p.dividendsReceived)}</p>
                      </div>
                    </div>

                    {/* Portfolio Weight Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground font-bold">
                        <span>Alocação na Carteira: {portfolioWeight.toFixed(1)}%</span>
                        <span className="text-primary font-bold group-hover:underline flex items-center gap-0.5">
                          Raio-X do Ativo <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-muted/60 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${Math.min(100, portfolioWeight)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="h-px w-full bg-border/40"></div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddModal(p.ticker, 'buy', p.type);
                          }}
                          className="px-2.5 py-1 text-[10.5px] font-bold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1 border border-emerald-500/20 min-h-[28px]"
                          title={`Adicionar novo aporte em ${p.ticker}`}
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          + Aporte
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddDivModal(p.ticker);
                          }}
                          className="px-2.5 py-1 text-[10.5px] font-bold rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-all flex items-center gap-1 border border-sky-500/20 min-h-[28px]"
                          title={`Lançar provento para ${p.ticker}`}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          + Provento
                        </button>

                        <div onClick={(e) => e.stopPropagation()}>
                          <CvmDocumentButton ticker={p.ticker} size="xs" />
                        </div>
                      </div>

                      <div className="text-[10.5px] font-extrabold text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-0.5">
                        Ver Detalhes ↗
                      </div>
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
                      <th className="px-4 py-3 text-right">Qtd</th>
                      <th className="px-4 py-3 text-right">Preço Médio</th>
                      <th className="px-4 py-3 text-right">Cotação Atual</th>
                      <th className="px-4 py-3 text-right">Investido</th>
                      <th className="px-4 py-3 text-right">Atual</th>
                      <th className="px-4 py-3 text-right">Lucro/Prejuízo</th>
                      <th className="px-4 py-3 text-right">DY Proj. (12M)</th>
                      <th className="px-4 py-3 text-right">YoC</th>
                      <th className="px-4 py-3 text-right">Proventos</th>
                      <th className="px-4 py-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {filteredPositions.map(p => {
                      const curVal = p.currentValue || p.totalInvested;
                      const profitR$ = p.currentValue ? p.currentValue - p.totalInvested : 0;
                      const profitPerc = p.currentValue 
                        ? ((p.currentValue - p.totalInvested) / p.totalInvested) * 100 
                        : 0;
                      const isPos = profitPerc >= 0;

                      const cleanTicker = p.ticker.toUpperCase().trim();
                      const savedValuation = valuationTargets[cleanTicker];
                      const proj = calculateAssetDividendProjection(
                        p.ticker,
                        p.type,
                        p.totalQuantity,
                        p.totalInvested,
                        p.averagePrice,
                        p.currentPrice,
                        dividends,
                        dividendAnalysisMode,
                        savedValuation
                      );

                      return (
                        <tr 
                          key={p.ticker} 
                          onClick={() => setSelectedAssetDetail(p)}
                          className="hover:bg-muted/30 transition-colors cursor-pointer group"
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-foreground group-hover:text-primary transition-colors">{p.ticker}</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground uppercase">
                                  {p.type}
                                </span>
                              </div>
                              {(() => {
                                const meta = b3AssetsMetadata[cleanTicker];
                                if (meta) {
                                  const sector = p.type === 'Ação' || p.type === 'BDR' 
                                    ? meta.sector || meta.subsector 
                                    : meta.fiiSegment;
                                  if (sector) {
                                    return <span className="text-[10px] text-muted-foreground font-semibold mt-0.5 truncate max-w-[150px]" title={sector}>{sector}</span>;
                                  }
                                }
                                return null;
                              })()}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-bold">{p.totalQuantity}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(p.averagePrice)}</td>
                          <td className="px-4 py-3 text-right font-bold">
                            {p.currentPrice ? formatCurrency(p.currentPrice) : formatCurrency(p.averagePrice)}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(p.totalInvested)}</td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(curVal)}</td>
                          <td className={`px-4 py-3 text-right font-bold ${isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {formatCurrency(profitR$)} ({isPos ? '+' : ''}{profitPerc.toFixed(2)}%)
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-amber-500" title={`Renda anual estimada: ${formatCurrency(proj.projectedAnnualIncome)}`}>
                            {proj.projectedDividendYield.toFixed(2)}% a.a.
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-indigo-500">
                            {p.yieldOnCost.toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">
                            {formatCurrency(p.dividendsReceived)}
                          </td>
                          <td className="px-4 py-3 text-center space-x-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => openAddModal(p.ticker, 'buy', p.type)}
                              className="p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors inline-flex"
                              title={`Novo aporte em ${p.ticker}`}
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openAddDivModal(p.ticker)}
                              className="p-1.5 text-muted-foreground hover:text-sky-500 hover:bg-sky-500/10 rounded-lg transition-colors inline-flex"
                              title={`Lançar provento para ${p.ticker}`}
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectAssetForAnalytics(p.ticker)}
                              className="p-1.5 text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-colors inline-flex"
                              title="Calculadora Preço Teto"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                            </button>
                            <CvmDocumentButton ticker={p.ticker} variant="icon" />
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
          ) : (
            <InvestmentAnalytics
              investmentTransactions={investmentTransactions}
              dividends={dividends}
              quotes={quotes}
              reserves={reserves}
              settings={settings}
              hideValues={hideValues}
              activeSubTab={carteiraSubTab}
              onSubTabChange={setCarteiraSubTab as any}
              initialTicker={analyticsTicker}
              hideTopCards={true}
              hideSubTabButtons={true}
              includeProvisioned={dividendAnalysisMode === 'include_provisioned'}
              onIncludeProvisionedChange={(incl) => setDividendAnalysisMode(incl ? 'include_provisioned' : 'received_only')}
            />
          )}
        </div>
      )}

      {/* TAB 3: ANÁLISE FUNDAMENTALISTA & SCORING B3 */}
      {activeTab === 'fundamentalista' && (
        <FundamentalAnalysisView
          positions={positions}
          quotes={quotes}
          valuationTargets={valuationTargets}
          hideValues={hideValues}
          onSelectAsset={(p) => setSelectedAssetDetail(p)}
          onOpenRaioX={(ticker) => handleOpenRaioXModal(ticker, 'fundamentos')}
        />
      )}

      {/* TAB 4: REBALANCEAMENTO PROFISSIONAL & MOTOR DE APORTES */}
      {activeTab === 'rebalanceamento' && (
        <ProfessionalRebalanceEngineView
          positions={positions}
          quotes={quotes}
          valuationTargets={valuationTargets}
          targetAllocations={targetAllocations}
          onSaveTargets={saveTargetAllocations}
          rulesConfig={rulesConfig}
          onSaveRulesConfig={saveRulesConfig}
          hideValues={hideValues}
          onBatchBuy={handleBatchBuy}
          onFetchQuote={handleFetchQuoteForTicker}
        />
      )}

      {/* TAB 5: PROVENTOS */}
      {activeTab === 'proventos' && (
        <div className="space-y-6">
          <DividendSummaryCards
            dividends={dividends}
            totalInvested={totalInvested}
            formatCurrency={formatCurrency}
            onOpenAddDivModal={openAddDivModal}
            analysisMode={dividendAnalysisMode}
            onAnalysisModeChange={setDividendAnalysisMode}
          />

          {/* CONTROLS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border/40">
            <h3 className="text-base font-black text-foreground">Extrato Completo de Proventos</h3>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 sm:flex-none">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={divSearch}
                  onChange={e => setDivSearch(e.target.value)}
                  placeholder="Buscar ticker..."
                  className="bg-card border border-border/50 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <select
                value={divTypeFilter}
                onChange={e => setDivTypeFilter(e.target.value)}
                className="bg-card border border-border/50 rounded-xl px-3 py-1.5 text-xs font-bold text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="all">Todos Tipos</option>
                <option value="Dividendo">Dividendo</option>
                <option value="JCP">JCP</option>
                <option value="Rendimento">Rendimento</option>
              </select>

              <select
                value={divStatusFilter}
                onChange={e => setDivStatusFilter(e.target.value)}
                className="bg-card border border-border/50 rounded-xl px-3 py-1.5 text-xs font-bold text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="all">Todos Status</option>
                <option value="received">Recebido</option>
                <option value="provisioned">Provisionado</option>
              </select>
            </div>
          </div>

          {/* DIVIDENDS TABLE */}
          {filteredDividends.length === 0 ? (
            <div className="p-10 text-center rounded-3xl border border-dashed border-border/60 bg-muted/10 space-y-3">
              <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-bold text-muted-foreground">Nenhum provento cadastrado.</p>
              <p className="text-xs text-muted-foreground/70">Registre seus dividendos e rendimentos recebidos ou futuros.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/50 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Ativo</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Data Com</th>
                      <th className="px-4 py-3">Data Ex / Pagamento</th>
                      <th className="px-4 py-3 text-right">Valor Total</th>
                      <th className="px-4 py-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {filteredDividends.map(div => (
                      <tr key={div.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-black text-foreground">{div.ticker}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-secondary text-secondary-foreground uppercase">
                            {div.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase flex items-center gap-1 w-fit ${
                            div.status === 'received' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                          }`}>
                            {div.status === 'received' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {div.status === 'received' ? 'Recebido' : 'Provisionado'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {div.data_com ? new Date(div.data_com + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {div.data_ex ? new Date(div.data_ex + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-foreground">{formatCurrency(div.amount)}</td>
                        <td className="px-4 py-3 text-center space-x-1">
                          <button 
                            onClick={() => openEditDivModal(div)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors inline-flex"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleOpenDeleteDiv(div)}
                            className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors inline-flex"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: HISTÓRICO DE LANÇAMENTOS */}
      {activeTab === 'historico' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Histórico Geral de Lançamentos
              </h3>
              <p className="text-xs text-muted-foreground">Extrato de compras e vendas de cotas com custos operacionais</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={e => setTxSearch(e.target.value)}
                  placeholder="Filtrar ticker..."
                  className="bg-card border border-border/50 rounded-xl pl-8 pr-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <select
                value={txOpFilter}
                onChange={e => setTxOpFilter(e.target.value as any)}
                className="bg-card border border-border/50 rounded-xl px-2.5 py-1.5 text-xs font-bold text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">Todas as Operações</option>
                <option value="buy">Compras</option>
                <option value="sell">Vendas</option>
              </select>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="p-10 text-center text-xs text-muted-foreground border border-dashed border-border/50 rounded-2xl">
              Nenhuma movimentação registrada.
            </div>
          ) : (
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/50 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Operação</th>
                      <th className="px-4 py-3">Ativo</th>
                      <th className="px-4 py-3 text-right">Qtd</th>
                      <th className="px-4 py-3 text-right">Preço Cota</th>
                      <th className="px-4 py-3 text-right">Custos</th>
                      <th className="px-4 py-3 text-right">Total Operação</th>
                      <th className="px-4 py-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {filteredTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(tx.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                            tx.operation === 'buy' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                          }`}>
                            {tx.operation === 'buy' ? 'Compra' : 'Venda'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-black text-foreground">{tx.ticker}</td>
                        <td className="px-4 py-3 text-right font-bold">{tx.quantity}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(tx.price)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{tx.costs ? formatCurrency(tx.costs) : '-'}</td>
                        <td className={`px-4 py-3 text-right font-bold ${tx.operation === 'buy' ? 'text-foreground' : 'text-rose-500'}`}>
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="px-4 py-3 text-center space-x-1">
                          <button 
                            onClick={() => openEditModal(tx)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors inline-flex"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleOpenDelete(tx)}
                            className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors inline-flex"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MOBILE FLOATING ACTION BAR */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 sm:hidden bg-card/90 backdrop-blur-lg border border-border/60 p-2 rounded-2xl shadow-xl flex items-center gap-2">
        <button
          onClick={() => openAddModal()}
          className="px-3.5 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground flex items-center gap-1.5 shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          Aporte
        </button>
        <button
          onClick={() => openAddDivModal()}
          className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm"
        >
          <DollarSign className="w-4 h-4" />
          Provento
        </button>
        <button
          onClick={() => setActiveTab('rebalanceamento')}
          className="px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center gap-1.5"
        >
          <Scale className="w-4 h-4" />
          Rebalancear
        </button>
      </div>

      {/* MODAL: NOVO / EDITAR LANÇAMENTO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-hidden">
          <form 
            onSubmit={handleSave} 
            className="w-full max-w-lg p-6 rounded-3xl border border-border/50 bg-card shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <header className="flex justify-between items-center pb-4 border-b border-border/50">
              <h2 className="text-lg font-black flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-primary" />
                {editItem ? 'Editar Lançamento' : 'Novo Lançamento de Ativo'}
              </h2>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                ✕
              </button>
            </header>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-muted-foreground">Operação</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOperation('buy')}
                    className={`py-2 rounded-xl text-xs font-black border transition-all ${
                      operation === 'buy' 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                        : 'bg-muted/30 text-muted-foreground hover:bg-muted/60 border-transparent'
                    }`}
                  >
                    Compra (Aporte)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperation('sell')}
                    className={`py-2 rounded-xl text-xs font-black border transition-all ${
                      operation === 'sell' 
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' 
                        : 'bg-muted/30 text-muted-foreground hover:bg-muted/60 border-transparent'
                    }`}
                  >
                    Venda (Resgate)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Tipo de Ativo</label>
                <select 
                  value={type} 
                  onChange={e => setType(e.target.value)}
                  className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                >
                  <option value="Ação">Ação</option>
                  <option value="FII">Fundo Imobiliário (FII)</option>
                </select>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Ticker do Ativo</label>
                <input 
                  type="text" 
                  value={ticker} 
                  onChange={e => {
                    const newTk = e.target.value.toUpperCase();
                    setTicker(newTk);
                    if (newTk.length >= 4) {
                      const detected = getAssetTypeForTicker(newTk);
                      setType(detected);
                    }
                    const known = getAssetCnpj(newTk, settings);
                    if (known) {
                      setFormCnpj(known);
                    }
                    if (quotes[newTk] && quotes[newTk] > 0) {
                      setPrice(quotes[newTk].toString().replace('.', ','));
                    } else if (newTk.length >= 4) {
                      handleFetchQuoteForTicker(newTk);
                    }
                  }}
                  onBlur={async () => {
                    const clean = ticker.toUpperCase().trim();
                    if (clean && !formCnpj) {
                      const auto = await fetchCnpjOnline(clean);
                      if (auto) setFormCnpj(auto);
                    }
                    if (clean && (!price || price === '0' || price === '0,00')) {
                      handleFetchQuoteForTicker(clean, true);
                    }
                  }}
                  placeholder="Ex: PETR4, MXRF11, IVVB11"
                  className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all uppercase"
                  list="ticker-suggestions"
                  required
                />
                <datalist id="ticker-suggestions">
                  <option value="PETR4" />
                  <option value="VALE3" />
                  <option value="ITUB4" />
                  <option value="BBDC4" />
                  <option value="ABEV3" />
                  <option value="BBAS3" />
                  <option value="ITSA4" />
                  <option value="WEGE3" />
                  <option value="MXRF11" />
                  <option value="HGLG11" />
                  <option value="KNRI11" />
                  <option value="XPLG11" />
                  <option value="IVVB11" />
                  <option value="BTC" />
                </datalist>
              </div>

              {/* LIVE OPERATION SUMMARY PREVIEW */}
              {(() => {
                const numP = parseNumericValue(price);
                const numQ = parseNumericValue(quantity);
                const numC = parseNumericValue(costs);
                const subtotal = numP * numQ;
                const isBuy = operation === 'buy';
                const totalOp = isBuy ? subtotal + numC : Math.max(0, subtotal - numC);

                if (subtotal <= 0) return null;

                return (
                  <div className="sm:col-span-2 p-3.5 rounded-2xl bg-muted/30 border border-border/50 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-bold">Resumo da Operação:</span>
                      <span className={`font-black text-sm ${isBuy ? 'text-emerald-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {isBuy ? 'Aporte Total (Retirado da Reserva): ' : 'Valor a Receber (Creditado na Reserva): '}
                        {formatCurrency(totalOp)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                      <span>Subtotal ({numQ} {numQ === 1 ? 'cota' : 'cotas'} x {formatCurrency(numP)}): {formatCurrency(subtotal)}</span>
                      {numC > 0 && <span>Taxas: {formatCurrency(numC)}</span>}
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground">CNPJ do Ativo (CVM)</label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!ticker) {
                        toast.error('Informe o ticker primeiro.');
                        return;
                      }
                      toast.info(`Buscando CNPJ de ${ticker}...`);
                      const auto = await fetchCnpjOnline(ticker);
                      if (auto) {
                        setFormCnpj(auto);
                        toast.success(`CNPJ localizado: ${auto}`);
                      } else {
                        toast.error('CNPJ não encontrado automaticamente. Digite manualmente.');
                      }
                    }}
                    className="text-[10px] text-sky-500 font-bold hover:underline cursor-pointer"
                  >
                    ⚡ Busca Automática
                  </button>
                </div>
                <input 
                  type="text" 
                  value={formCnpj} 
                  onChange={e => setFormCnpj(formatCnpj(e.target.value))}
                  placeholder="00.000.000/0001-00"
                  maxLength={18}
                  className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground">Preço por Cota (R$)</label>
                  <button
                    type="button"
                    disabled={isLoadingQuote || !ticker}
                    onClick={() => {
                      if (!ticker) {
                        toast.error('Informe o ticker primeiro.');
                        return;
                      }
                      handleFetchQuoteForTicker(ticker, true);
                    }}
                    className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isLoadingQuote ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3 text-amber-500" />
                    )}
                    <span>Puxar Preço Atual</span>
                  </button>
                </div>
                <CurrencyInput 
                  value={price} 
                  onChange={setPrice}
                  placeholder="0,00"
                  className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  required
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Quantidade de Cotas</label>
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={quantity} 
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9,]/g, '');
                    const parts = val.split(',');
                    if (parts.length > 2) return;
                    setQuantity(val);
                  }}
                  placeholder="100"
                  className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Taxas & Custos (R$)</label>
                <CurrencyInput 
                  value={costs} 
                  onChange={setCosts}
                  placeholder="0,00 (Opcional)"
                  className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Data da Operação</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 bg-muted text-muted-foreground text-xs font-bold rounded-xl hover:bg-muted/80 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={isSaving}
                className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                {editItem ? 'Salvar Alterações' : 'Salvar Lançamento'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: NOVO / EDITAR PROVENTO */}
      {isDivModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-hidden">
          <form 
            onSubmit={handleSaveDiv} 
            className="w-full max-w-lg p-6 rounded-3xl border border-border/50 bg-card shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <header className="flex justify-between items-center pb-4 border-b border-border/50">
              <h2 className="text-lg font-black flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                {editDiv ? 'Editar Provento' : 'Novo Provento Anunciado'}
              </h2>
              <button 
                type="button" 
                onClick={() => setIsDivModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                ✕
              </button>
            </header>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <span>Ticker do Ativo</span>
                    {divTicker && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black border border-emerald-500/20">
                        {divTicker}
                      </span>
                    )}
                  </label>
                  {positions.length > 0 && (
                    <span className="text-[10.5px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      {positions.length} ativos em carteira
                    </span>
                  )}
                </div>

                {positions.length > 0 && (
                  <div className="p-2.5 rounded-2xl bg-muted/30 border border-border/50 space-y-1.5">
                    <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                      Selecione da sua carteira para preencher rápido:
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar p-0.5">
                      {positions.map(p => {
                        const isSelected = divTicker.toUpperCase() === p.ticker.toUpperCase();
                        return (
                          <button
                            key={p.ticker}
                            type="button"
                            onClick={() => {
                              setDivTicker(p.ticker);
                              if (p.type === 'FII') {
                                setDivType('Rendimento');
                              } else if (p.type === 'Ação' && divType === 'Rendimento') {
                                setDivType('Dividendo');
                              }
                            }}
                            className={`px-2.5 py-1 text-xs font-mono font-black rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20 scale-[1.02]'
                                : 'bg-card text-foreground hover:bg-emerald-500/10 hover:border-emerald-500/40 border-border/60'
                            }`}
                          >
                            <span>{p.ticker}</span>
                            <span className={`text-[9.5px] font-sans font-extrabold px-1 py-0.2 rounded ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-muted/80 text-muted-foreground'
                            }`}>
                              {p.totalQuantity} {p.totalQuantity === 1 ? 'cota' : 'cotas'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <input 
                    type="text" 
                    value={divTicker} 
                    onChange={e => setDivTicker(e.target.value.toUpperCase())}
                    placeholder={positions.length > 0 ? "Ou digite o ticker manualmente (Ex: PETR4)" : "Digite o ticker do ativo (Ex: PETR4, MXRF11)"}
                    list="portfolio-div-ticker-list"
                    className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all uppercase"
                    required
                  />
                  <datalist id="portfolio-div-ticker-list">
                    {allPortfolioTickers.map(tk => (
                      <option key={tk} value={tk} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-muted-foreground">Tipo de Provento</label>
                <select 
                  value={divType} 
                  onChange={e => setDivType(e.target.value as DividendType)}
                  className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all"
                >
                  <option value="Dividendo">Dividendo</option>
                  <option value="JCP">JCP (Juros s/ Capital Próprio)</option>
                  <option value="Rendimento">Rendimento</option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-muted-foreground">Valor por Cota (R$/cota)</label>
                <CurrencyInput 
                  value={divAmount} 
                  onChange={setDivAmount}
                  placeholder="0,00000"
                  decimals={5}
                  className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  required
                />
                
                {/* LIVE ESTIMATED TOTAL PAYOUT PREVIEW */}
                {(() => {
                  const valUnit = parseNumericValue(divAmount);
                  const matchingPos = positions.find(p => p.ticker.toUpperCase() === divTicker.toUpperCase());
                  const q = matchingPos ? matchingPos.totalQuantity : 0;
                  const totalEst = valUnit * q;

                  if (valUnit <= 0) return null;

                  return (
                    <div className="mt-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold">Total a Receber Estimado:</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatCurrency(totalEst)}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-medium">
                        Cálculo: {formatCurrency(valUnit)} x {q} {q === 1 ? 'cota' : 'cotas'} na carteira atual.
                      </p>
                    </div>
                  );
                })()}
              </div>

              {divDataEx && (
                <div className="sm:col-span-2 text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-xl flex items-center justify-between border border-border/40">
                  <span className="font-medium">Status definido pela Data de Pagamento:</span>
                  <span className={`font-bold px-2 py-0.5 rounded-md ${
                    divDataEx <= new Date().toISOString().split('T')[0]
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {divDataEx <= new Date().toISOString().split('T')[0] ? 'Recebido (Creditado)' : 'Provisionado (A Receber)'}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Data Com</label>
                <input 
                  type="date" 
                  value={divDataCom} 
                  onChange={e => setDivDataCom(e.target.value)}
                  className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Data Ex / Pagamento</label>
                <input 
                  type="date" 
                  value={divDataEx} 
                  onChange={e => setDivDataEx(e.target.value)}
                  className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  required
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
              <button 
                type="button" 
                onClick={() => setIsDivModalOpen(false)}
                className="px-5 py-2 bg-muted text-muted-foreground text-xs font-bold rounded-xl hover:bg-muted/80 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={isSaving}
                className="px-5 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                {editDiv ? 'Salvar Alterações' : 'Salvar Provento'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: RAIO-X DO ATIVO */}
      {selectedAssetDetail && (
        <AssetRaioXModal
          position={selectedAssetDetail}
          transactions={investmentTransactions}
          dividends={dividends}
          onClose={() => setSelectedAssetDetail(null)}
          onOpenAddModal={openAddModal}
          onOpenAddDivModal={openAddDivModal}
          onSelectAnalytics={handleSelectAssetForAnalytics}
          onEditTx={openEditModal}
          onDeleteTx={handleOpenDelete}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
          analysisMode={dividendAnalysisMode}
          initialTab={raioXInitialTab as any}
        />
      )}

      {/* MODAL: RELATÓRIO DA CARTEIRA */}
      {isReportModalOpen && (
        <PortfolioReportModal
          positions={positions}
          totalInvested={totalInvested}
          totalCurrent={totalCurrent}
          totalCapitalGain={totalCapitalGain}
          capitalGainPercent={capitalGainPercent}
          dividendsReceived={divTotals.considered}
          totalReturnWithDividends={totalReturnWithDividends}
          totalReturnPercent={totalReturnPercent}
          onClose={() => setIsReportModalOpen(false)}
          formatCurrency={formatCurrency}
          analysisMode={dividendAnalysisMode}
        />
      )}

      {/* MODAL: EXCLUSÃO DE LANÇAMENTO */}
      {isDeleteModalOpen && txToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <div className="w-full max-w-sm p-6 rounded-3xl border border-border/50 bg-card shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <header className="space-y-2 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black">Confirmar Exclusão</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Deseja excluir o lançamento de <strong>{txToDelete.ticker}</strong> em <strong>{new Date(txToDelete.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong>?
              </p>
            </header>

            <div className="bg-muted/50 p-4 rounded-2xl space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  deleteAllForTicker ? 'bg-rose-500 border-rose-500' : 'border-border/50 bg-background'
                }`}>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={deleteAllForTicker}
                    onChange={e => setDeleteAllForTicker(e.target.checked)}
                  />
                  {deleteAllForTicker && <X className="w-3.5 h-3.5 text-white stroke-[4]" />}
                </div>
                <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                  Excluir TODOS os lançamentos de {txToDelete.ticker}
                </span>
              </label>
              {deleteAllForTicker && (
                <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Atenção: Esta ação é irreversível
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 px-5 py-2.5 bg-muted text-foreground text-xs font-bold rounded-xl hover:bg-muted/80 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 px-5 py-2.5 bg-rose-500 text-white text-xs font-bold rounded-xl hover:bg-rose-600 transition-colors shadow-sm shadow-rose-500/20"
              >
                {deleteAllForTicker ? 'Excluir Tudo' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUSÃO DE PROVENTO */}
      {isDivDeleteModalOpen && divToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <div className="w-full max-w-sm p-6 rounded-3xl border border-border/50 bg-card shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <header className="space-y-2 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black">Excluir Provento</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Deseja excluir o provento de <strong>{divToDelete.ticker}</strong> no valor de <strong>{formatCurrency(divToDelete.amount)}</strong>?
              </p>
            </header>

            {divToDelete.status === 'received' && (
              <div className="bg-rose-500/10 p-4 rounded-2xl">
                <p className="text-[11px] text-rose-500 font-bold leading-relaxed">
                  Aviso: Este provento já foi recebido e creditado. O lançamento correspondente na sua reserva de investimento também será removido.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button 
                type="button"
                disabled={isDeletingDiv}
                onClick={() => setIsDivDeleteModalOpen(false)}
                className="flex-1 px-5 py-2.5 bg-muted text-foreground text-xs font-bold rounded-xl hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                type="button"
                disabled={isDeletingDiv}
                onClick={handleConfirmDeleteDiv}
                className="flex-1 px-5 py-2.5 bg-rose-500 text-white text-xs font-bold rounded-xl hover:bg-rose-600 transition-colors shadow-sm shadow-rose-500/20 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isDeletingDiv ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SELETOR DE FONTE DE COTAÇÕES */}
      <QuoteProviderSelectorModal 
        open={isQuoteProviderModalOpen} 
        onOpenChange={setIsQuoteProviderModalOpen} 
      />
    </div>
  );
}
