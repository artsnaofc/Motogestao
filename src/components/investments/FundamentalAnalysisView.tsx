import React, { useState, useMemo, useDeferredValue } from 'react';
import { 
  Search, 
  Filter, 
  Sparkles, 
  SlidersHorizontal, 
  ArrowUpDown, 
  ShieldCheck, 
  TrendingUp, 
  Building2, 
  Coins, 
  Info,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  UploadCloud,
  PlusCircle,
  Edit3,
  Trash2,
  Database,
  Crown,
  Trophy,
  Award,
  Target,
  Zap,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Layers,
  Clock,
  RefreshCw
} from 'lucide-react';
import { getB3AssetFundamental, B3AssetFundamental, B3StockFundamental, B3FiiFundamental } from '../../lib/b3Fundamentals';
import { 
  calculateUniversalAssetScore, 
  AssetScoreResult, 
  DEFAULT_STOCK_WEIGHTS, 
  DEFAULT_FII_WEIGHTS,
  StockScoreWeights,
  FiiScoreWeights,
  getScoreColor,
  getGradeColor
} from '../../lib/scoringEngine';
import { useInvestments } from '../../contexts/InvestmentsContext';
import { FundamentusImportModal } from './FundamentusImportModal';
import { ManualAssetModal } from './ManualAssetModal';
import { toast } from 'sonner';

export type RankingMethod = 
  | 'score_b3'      // Score B3 Universal (Multicritério)
  | 'barsi_bazin'   // Método Décio Bazin & Luiz Barsi (Preço Teto 6%)
  | 'graham'        // Valor Intrínseco de Benjamin Graham
  | 'greenblatt'    // Magic Formula (Joel Greenblatt)
  | 'fii_quality'   // FIIs High Quality & Renda
  | 'custom';       // Personalizado / Todos os Filtros

interface FundamentalAnalysisViewProps {
  portfolioTickers?: string[];
  positions?: any[];
  quotes: Record<string, number>;
  valuationTargets?: Record<string, any>;
  hideValues?: boolean;
  onSelectAsset?: (asset: any) => void;
  onOpenRaioX?: (ticker: string) => void;
}

export const FundamentalAnalysisView: React.FC<FundamentalAnalysisViewProps> = ({
  portfolioTickers: explicitTickers,
  positions = [],
  quotes,
  valuationTargets,
  hideValues = false,
  onSelectAsset,
  onOpenRaioX
}) => {
  const { 
    b3AssetsMetadata, 
    saveAssetMetadata, 
    bulkUpsertAssetsMetadata, 
    deleteAssetMetadata 
  } = useInvestments();

  const portfolioTickers = useMemo(() => {
    if (explicitTickers && explicitTickers.length > 0) return explicitTickers;
    return positions.map(p => p.ticker);
  }, [explicitTickers, positions]);

  // Saved Filters from LocalStorage
  const savedFilters = useMemo(() => {
    try {
      const saved = localStorage.getItem('b3_fundamental_filters_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load saved fundamental filters:', e);
    }
    return null;
  }, []);

  // Strategy & View State
  const [rankingMethod, setRankingMethod] = useState<RankingMethod>(savedFilters?.rankingMethod || 'score_b3');
  const [activeTypeTab, setActiveTypeTab] = useState<'all' | 'Ação' | 'FII'>(savedFilters?.activeTypeTab || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>(savedFilters?.selectedSector || 'all');
  const [onlyPortfolio, setOnlyPortfolio] = useState<boolean>(savedFilters?.onlyPortfolio || false);
  const [selectedAssetForScore, setSelectedAssetForScore] = useState<AssetScoreResult | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Deferred search query to avoid lag on fast typing
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Pagination State (Solves DOM Lag Completely)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Custom Sorting State
  const [sortField, setSortField] = useState<string>(savedFilters?.sortField || 'default');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(savedFilters?.sortOrder || 'desc');

  // Modals for Import & Manual Create/Edit
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingAssetData, setEditingAssetData] = useState<any | null>(null);

  // Custom Score Weights state
  const [stockWeights, setStockWeights] = useState<StockScoreWeights>(savedFilters?.stockWeights || DEFAULT_STOCK_WEIGHTS);
  const [fiiWeights, setFiiWeights] = useState<FiiScoreWeights>(savedFilters?.fiiWeights || DEFAULT_FII_WEIGHTS);

  // Expanded Filters State
  const [minRoe, setMinRoe] = useState<number>(savedFilters?.minRoe ?? 0);
  const [minRoic, setMinRoic] = useState<number>(savedFilters?.minRoic ?? 0);
  const [maxPl, setMaxPl] = useState<number>(savedFilters?.maxPl ?? 100);
  const [maxDebtEbitda, setMaxDebtEbitda] = useState<number>(savedFilters?.maxDebtEbitda ?? 5.0);
  const [minDy, setMinDy] = useState<number>(savedFilters?.minDy ?? 0);
  const [maxDy, setMaxDy] = useState<number>(savedFilters?.maxDy ?? 100);
  const [maxVacancy, setMaxVacancy] = useState<number>(savedFilters?.maxVacancy ?? 50);
  const [maxPvpFii, setMaxPvpFii] = useState<number>(savedFilters?.maxPvpFii ?? 1.5);
  const [minNetMargin, setMinNetMargin] = useState<number>(savedFilters?.minNetMargin ?? -100);
  const [minLiquidity, setMinLiquidity] = useState<number>(savedFilters?.minLiquidity ?? 0); // in Millions
  const [minFfoYield, setMinFfoYield] = useState<number>(savedFilters?.minFfoYield ?? 0);

  // Persist filter states to LocalStorage on changes
  React.useEffect(() => {
    try {
      const stateToSave = {
        rankingMethod,
        activeTypeTab,
        selectedSector,
        onlyPortfolio,
        minRoe,
        minRoic,
        maxPl,
        maxDebtEbitda,
        minDy,
        maxDy,
        maxVacancy,
        maxPvpFii,
        minNetMargin,
        minLiquidity,
        minFfoYield,
        sortField,
        sortOrder,
        stockWeights,
        fiiWeights
      };
      localStorage.setItem('b3_fundamental_filters_v2', JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to save fundamental filters:', e);
    }
  }, [
    rankingMethod, activeTypeTab, selectedSector, onlyPortfolio,
    minRoe, minRoic, maxPl, maxDebtEbitda, minDy, maxDy,
    maxVacancy, maxPvpFii, minNetMargin, minLiquidity, minFfoYield,
    sortField, sortOrder
  ]);

  // Reset all filters & sorting
  const handleResetFilters = () => {
    try {
      localStorage.removeItem('b3_fundamental_filters_v2');
    } catch (e) {
      console.error(e);
    }
    setMinRoe(0);
    setMinRoic(0);
    setMaxPl(100);
    setMaxDebtEbitda(5.0);
    setMinDy(0);
    setMaxDy(100);
    setMaxVacancy(50);
    setMaxPvpFii(1.5);
    setMinNetMargin(-100);
    setMinLiquidity(0);
    setMinFfoYield(0);
    setSearchQuery('');
    setSelectedSector('all');
    setOnlyPortfolio(false);
    setSortField('default');
    setSortOrder('desc');
    setCurrentPage(1);
    toast.info('Filtros e ordenação restaurados para o padrão.');
  };

  // Trigger Raio-X Modal
  const handleTriggerRaioX = (item: any) => {
    const tk = typeof item === 'string' ? item : item.ticker;
    if (onOpenRaioX) {
      onOpenRaioX(tk);
    } else if (onSelectAsset) {
      const existing = positions.find((p: any) => p.ticker === tk);
      if (existing) {
        onSelectAsset(existing);
      } else {
        const itemObj = typeof item === 'object' ? item : null;
        onSelectAsset({
          ticker: tk,
          name: itemObj?.fund?.name || tk,
          type: itemObj?.fund?.type || (tk.endsWith('11') ? 'FII' : 'Ação'),
          assetType: itemObj?.fund?.type || (tk.endsWith('11') ? 'FII' : 'Ação'),
          quantity: 0,
          averagePrice: 0,
          totalInvested: 0,
          currentPrice: itemObj?.quote || itemObj?.fund?.lastPrice || 0,
          currentTotal: 0,
          profitability: 0,
          profitabilityAmount: 0,
          allocationPct: 0,
        });
      }
    }
  };

  // Toggle Column Sort
  const handleSortColumn = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'ticker' || field === 'magic_score' ? 'asc' : 'desc');
    }
  };

  // Apply method preset
  const handleApplyMethodPreset = (method: RankingMethod) => {
    setRankingMethod(method);
    setSortField('default');
    setSortOrder('desc');
    setCurrentPage(1);

    if (method === 'score_b3' || method === 'custom') {
      setActiveTypeTab('all');
      if (method === 'score_b3') {
        toast.success('Score B3 Universal ativado (Aba: Todos os Ativos).');
      }
    } else if (method === 'barsi_bazin') {
      setActiveTypeTab('Ação');
      setMinDy(6);
      setMaxDy(100);
      setMinRoe(8);
      setMaxDebtEbitda(3.5);
      toast.success('Método Barsi/Bazin ativado: DY >= 6%, ROE >= 8% (Aba: Ações).');
    } else if (method === 'graham') {
      setActiveTypeTab('Ação');
      setMaxPl(15);
      setMinRoe(10);
      toast.success('Fórmula de Graham ativada: P/L <= 15, ROE >= 10% (Aba: Ações).');
    } else if (method === 'greenblatt') {
      setActiveTypeTab('Ação');
      setMinRoe(12);
      setMinRoic(12);
      toast.success('Magic Formula de Greenblatt ativada: ROIC Mín 12% (Aba: Ações).');
    } else if (method === 'fii_quality') {
      setActiveTypeTab('FII');
      setMaxVacancy(10);
      setMaxPvpFii(1.10);
      setMinDy(6.5);
      setMaxDy(16.0);
      toast.success('FIIs High Quality ativado: Vacância < 10%, DY 6,5%-16%, P/VP <= 1.10 (Aba: FIIs).');
    }
  };

  // 1. Build Base Assets List & Precompute Valuation Metrics
  const baseComputedAssets = useMemo(() => {
    const allSet = new Set<string>();

    Object.keys(b3AssetsMetadata || {}).forEach(t => allSet.add(t.toUpperCase().trim()));
    portfolioTickers.forEach(t => allSet.add(t.toUpperCase().trim()));

    const list = Array.from(allSet).map(ticker => {
      const quote = quotes[ticker];
      const fund = getB3AssetFundamental(ticker, undefined, quote, b3AssetsMetadata);
      const score = calculateUniversalAssetScore(fund, stockWeights, fiiWeights);
      const isInPortfolio = portfolioTickers.includes(ticker);
      const rawMeta = b3AssetsMetadata[ticker];
      const price = quote || fund.lastPrice || 0;

      // Valuation Metric 1: Barsi / Bazin
      const annualDividend = price > 0 ? (price * ((fund.dividendYield || 0) / 100)) : 0;
      const barsiTargetPrice = annualDividend > 0 ? (annualDividend / 0.06) : 0;
      const barsiMarginPct = price > 0 && barsiTargetPrice > 0 
        ? ((barsiTargetPrice - price) / price) * 100 
        : -999;

      // Valuation Metric 2: Benjamin Graham Intrinsic Value
      let lpa = 0;
      let vpa = 0;
      let grahamIntrinsicValue = 0;
      let grahamDiscountPct = -999;

      if (fund.type === 'Ação') {
        const sf = fund as B3StockFundamental;
        lpa = sf.lpa || (sf.pl > 0 && price > 0 ? price / sf.pl : 0);
        vpa = sf.vpa || (sf.pvp > 0 && price > 0 ? price / sf.pvp : 0);

        if (lpa > 0 && vpa > 0) {
          grahamIntrinsicValue = Math.sqrt(22.5 * lpa * vpa);
          if (price > 0 && grahamIntrinsicValue > 0) {
            grahamDiscountPct = ((grahamIntrinsicValue - price) / price) * 100;
          }
        }
      }

      // Valuation Metric 3: FII Quality Score
      let fiiQualityScore = 0;
      if (fund.type === 'FII') {
        const ff = fund as B3FiiFundamental;
        const dyBonus = (ff.dividendYield || 0) * 3.5;
        const ffoBonus = (ff.ffoYield || 0) * 2.5;
        const vacancyPenalty = (ff.physicalVacancy || 0) * 2.0;
        const pvpBonus = ff.pvp > 0 && ff.pvp <= 1.05 ? (1.05 - ff.pvp) * 40 : 0;
        fiiQualityScore = dyBonus + ffoBonus + pvpBonus - vacancyPenalty;
      }

      return {
        ticker,
        fund,
        score,
        isInPortfolio,
        quote: price,
        rawMeta,
        source: rawMeta?.source || (isInPortfolio ? 'Carteira' : 'Manual'),
        updatedAt: rawMeta?.updated_at || rawMeta?.updatedAt,

        // Valuation metrics
        annualDividend,
        barsiTargetPrice,
        barsiMarginPct,
        lpa,
        vpa,
        grahamIntrinsicValue,
        grahamDiscountPct,
        fiiQualityScore,

        // Magic rank placeholders (calculated in step 2)
        roicRank: 999,
        valuationRank: 999,
        magicRankScore: 999
      };
    });

    // Step 2: Compute Greenblatt Magic Ranks across stocks
    const stocksOnly = list.filter(a => a.fund.type === 'Ação' && (a.fund as B3StockFundamental).roe > 0);

    // Rank by ROIC / ROE descending
    const roicSorted = [...stocksOnly].sort((a, b) => {
      const sfA = a.fund as B3StockFundamental;
      const sfB = b.fund as B3StockFundamental;
      return (sfB.roic || sfB.roe || 0) - (sfA.roic || sfA.roe || 0);
    });
    const roicRankMap = new Map<string, number>();
    roicSorted.forEach((item, idx) => roicRankMap.set(item.ticker, idx + 1));

    // Rank by Valuation (P/L ascending for P/L > 0)
    const valuationSorted = [...stocksOnly].sort((a, b) => {
      const sfA = a.fund as B3StockFundamental;
      const sfB = b.fund as B3StockFundamental;
      const plA = sfA.pl > 0 ? sfA.pl : 999;
      const plB = sfB.pl > 0 ? sfB.pl : 999;
      return plA - plB;
    });
    const valuationRankMap = new Map<string, number>();
    valuationSorted.forEach((item, idx) => valuationRankMap.set(item.ticker, idx + 1));

    // Assign final magic scores
    return list.map(item => {
      if (item.fund.type === 'Ação') {
        const rRank = roicRankMap.get(item.ticker) || 999;
        const vRank = valuationRankMap.get(item.ticker) || 999;
        return {
          ...item,
          roicRank: rRank,
          valuationRank: vRank,
          magicRankScore: rRank + vRank
        };
      }
      return item;
    });
  }, [b3AssetsMetadata, portfolioTickers, quotes, stockWeights, fiiWeights]);

  // Calculate Fundamentus Import Freshness
  const importFreshness = useMemo(() => {
    const keys = Object.keys(b3AssetsMetadata || {});
    const count = keys.length;
    if (count === 0) {
      return {
        status: 'empty' as const,
        label: 'Nenhum dado importado',
        formattedDate: 'Sem registros de importação',
        daysAgo: null,
        isStale: true
      };
    }

    let latestMs = 0;
    keys.forEach(k => {
      const item = b3AssetsMetadata[k];
      if (item?.updated_at) {
        const ms = new Date(item.updated_at).getTime();
        if (!isNaN(ms) && ms > latestMs) {
          latestMs = ms;
        }
      }
    });

    if (latestMs === 0) {
      return {
        status: 'unknown' as const,
        label: 'Sem data registrada',
        formattedDate: 'Data de importação desconhecida',
        daysAgo: 999,
        isStale: true
      };
    }

    const latestDate = new Date(latestMs);
    const nowMs = Date.now();
    const daysAgo = Math.floor((nowMs - latestMs) / (1000 * 60 * 60 * 24));
    const isStale = daysAgo > 14;

    return {
      status: isStale ? ('stale' as const) : ('fresh' as const),
      label: isStale ? `Há ${daysAgo} dias` : daysAgo === 0 ? 'Hoje' : `Há ${daysAgo} dia${daysAgo > 1 ? 's' : ''}`,
      formattedDate: `${latestDate.toLocaleDateString('pt-BR')} ${latestDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      daysAgo,
      isStale
    };
  }, [b3AssetsMetadata]);

  // Extract unique Sectors / Segments for Filter Dropdown (filtering only those with data available for active type)
  const availableSectors = useMemo(() => {
    const sectors = new Set<string>();
    baseComputedAssets.forEach(item => {
      if (activeTypeTab !== 'all' && item.fund.type !== activeTypeTab) return;
      const sec = item.fund.type === 'Ação' 
        ? item.fund.sector 
        : item.fund.fiiSegment;
      if (sec && sec.trim() && sec !== 'Outros' && sec !== 'Geral' && sec !== 'N/A') {
        sectors.add(sec.trim());
      }
    });
    return Array.from(sectors).sort();
  }, [baseComputedAssets, activeTypeTab]);

  // Reset selectedSector if no longer in availableSectors
  React.useEffect(() => {
    if (selectedSector !== 'all' && !availableSectors.includes(selectedSector)) {
      setSelectedSector('all');
    }
  }, [availableSectors, selectedSector]);

  // 2. Filter & Rank Assets
  const filteredAssets = useMemo(() => {
    let result = baseComputedAssets.filter(item => {
      // Type Tab filter
      if (activeTypeTab !== 'all' && item.fund.type !== activeTypeTab) return false;

      // Only Portfolio toggle
      if (onlyPortfolio && !item.isInPortfolio) return false;

      // Sector filter
      if (selectedSector !== 'all') {
        const sec = item.fund.type === 'Ação' ? item.fund.sector : item.fund.fiiSegment;
        if (sec !== selectedSector) return false;
      }

      // Search Query filter
      if (deferredSearchQuery.trim()) {
        const q = deferredSearchQuery.toUpperCase().trim();
        const matchTicker = item.ticker.includes(q);
        const matchName = (item.fund.name || '').toUpperCase().includes(q);
        const matchSector = item.fund.type === 'Ação' 
          ? (item.fund.sector || '').toUpperCase().includes(q) 
          : (item.fund.fiiSegment || '').toUpperCase().includes(q);
        if (!matchTicker && !matchName && !matchSector) return false;
      }

      // Liquidity Filter (All)
      if (minLiquidity > 0) {
        const rawLiq = item.fund.dailyLiquidity || 0;
        if (rawLiq < minLiquidity * 1_000_000) return false;
      }

      // Stock Filters
      if (item.fund.type === 'Ação') {
        const sf = item.fund as B3StockFundamental;
        if (minRoe > 0 && sf.roe < minRoe) return false;
        if (minRoic > 0 && (sf.roic || 0) < minRoic) return false;
        if (maxPl < 100 && sf.pl > maxPl) return false;
        if (maxDebtEbitda < 5.0 && sf.sector !== 'Financeiro' && sf.netDebtOverEbitda > maxDebtEbitda) return false;
        if (minDy > 0 && sf.dividendYield < minDy) return false;
        if (maxDy < 100 && sf.dividendYield > maxDy) return false;
        if (minNetMargin > -100 && (sf.netMargin || 0) < minNetMargin) return false;
      }

      // FII Filters
      if (item.fund.type === 'FII') {
        const ff = item.fund as B3FiiFundamental;
        if (minDy > 0 && ff.dividendYield < minDy) return false;
        if (maxDy < 100 && ff.dividendYield > maxDy) return false;
        if (maxVacancy < 50 && ff.fiiType === 'Tijolo' && ff.physicalVacancy > maxVacancy) return false;
        if (maxPvpFii < 1.5 && ff.pvp > maxPvpFii) return false;
        if (minFfoYield > 0 && (ff.ffoYield || 0) < minFfoYield) return false;
      }

      return true;
    });

    // Ranking Logic according to selected methodology or custom column click
    result.sort((a, b) => {
      // If user clicked a specific column to sort by, prioritize custom column sort
      if (sortField !== 'default') {
        let valA: any = 0;
        let valB: any = 0;

        if (sortField === 'ticker') { valA = a.ticker; valB = b.ticker; }
        else if (sortField === 'score') { valA = a.score.totalScore; valB = b.score.totalScore; }
        else if (sortField === 'price') { valA = a.quote || 0; valB = b.quote || 0; }
        else if (sortField === 'pvp') { valA = a.fund.pvp || 0; valB = b.fund.pvp || 0; }
        else if (sortField === 'dy') { valA = a.fund.dividendYield || 0; valB = b.fund.dividendYield || 0; }
        else if (sortField === 'barsi_margin') { valA = a.barsiMarginPct; valB = b.barsiMarginPct; }
        else if (sortField === 'graham_discount') { valA = a.grahamDiscountPct; valB = b.grahamDiscountPct; }
        else if (sortField === 'magic_score') { valA = a.magicRankScore; valB = b.magicRankScore; }
        else if (sortField === 'pl_ffo') {
          valA = a.fund.type === 'Ação' ? (a.fund as B3StockFundamental).pl || 0 : (a.fund as B3FiiFundamental).ffoYield || 0;
          valB = b.fund.type === 'Ação' ? (b.fund as B3StockFundamental).pl || 0 : (b.fund as B3FiiFundamental).ffoYield || 0;
        }
        else if (sortField === 'roe_vacancy') {
          valA = a.fund.type === 'Ação' ? (a.fund as B3StockFundamental).roe || 0 : -(a.fund as B3FiiFundamental).physicalVacancy || 0;
          valB = b.fund.type === 'Ação' ? (b.fund as B3StockFundamental).roe || 0 : -(b.fund as B3FiiFundamental).physicalVacancy || 0;
        }
        else if (sortField === 'margin_cap') {
          valA = a.fund.type === 'Ação' ? (a.fund as B3StockFundamental).netMargin || 0 : (a.fund as B3FiiFundamental).capRate || 0;
          valB = b.fund.type === 'Ação' ? (b.fund as B3StockFundamental).netMargin || 0 : (b.fund as B3FiiFundamental).capRate || 0;
        }
        else if (sortField === 'liquidity') {
          const rawA = a.fund.dailyLiquidity || 0;
          const rawB = b.fund.dailyLiquidity || 0;
          valA = (rawA > 0 && rawA < 50000) ? rawA * 1000 : rawA;
          valB = (rawB > 0 && rawB < 50000) ? rawB * 1000 : rawB;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }

      // Default methodology sorting
      if (rankingMethod === 'score_b3') {
        return b.score.totalScore - a.score.totalScore;
      }
      if (rankingMethod === 'barsi_bazin') {
        return b.barsiMarginPct - a.barsiMarginPct;
      }
      if (rankingMethod === 'graham') {
        return b.grahamDiscountPct - a.grahamDiscountPct;
      }
      if (rankingMethod === 'greenblatt') {
        return a.magicRankScore - b.magicRankScore; // Lower magic score is better
      }
      if (rankingMethod === 'fii_quality') {
        return b.fiiQualityScore - a.fiiQualityScore;
      }

      return b.score.totalScore - a.score.totalScore;
    });

    return result;
  }, [
    baseComputedAssets, 
    activeTypeTab, 
    onlyPortfolio, 
    selectedSector, 
    deferredSearchQuery, 
    minRoe,
    minRoic,
    maxPl, 
    maxDebtEbitda, 
    minDy,
    maxDy,
    maxVacancy, 
    maxPvpFii, 
    minNetMargin,
    minLiquidity,
    minFfoYield,
    rankingMethod,
    sortField,
    sortOrder
  ]);

  // Top 3 Podium for Active Methodology
  const topPodiumAssets = useMemo(() => {
    return filteredAssets.slice(0, 3);
  }, [filteredAssets]);

  // Pagination Slicing
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const currentPageClamped = Math.min(currentPage, totalPages);
  
  const paginatedAssets = useMemo(() => {
    const start = (currentPageClamped - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [filteredAssets, currentPageClamped, pageSize]);

  const handleOpenEdit = (item: any) => {
    const raw = item.rawMeta || {
      ticker: item.ticker,
      asset_type: item.fund.type,
      name: item.fund.name,
      last_price: item.fund.lastPrice,
      sector: item.fund.sector || item.fund.fiiSegment,
      pvp: item.fund.pvp,
      dividend_yield: item.fund.dividendYield,
      ...(item.fund.type === 'Ação' ? {
        pl: item.fund.pl,
        roe: item.fund.roe,
        roic: item.fund.roic,
        net_margin: item.fund.netMargin,
        net_debt_over_ebitda: item.fund.netDebtOverEbitda,
        revenue_cagr_5y: item.fund.revenueCagr5y
      } : {
        fii_type: item.fund.fiiType,
        fii_segment: item.fund.fiiSegment,
        ffo_yield: item.fund.ffoYield,
        physical_vacancy: item.fund.physicalVacancy,
        properties_count: item.fund.propertiesCount,
        cap_rate: item.fund.capRate
      })
    };
    setEditingAssetData(raw);
    setIsManualModalOpen(true);
  };

  const handleDelete = async (ticker: string) => {
    if (window.confirm(`Tem certeza que deseja remover os indicadores do ativo ${ticker}?`)) {
      try {
        await deleteAssetMetadata(ticker);
        toast.success(`Ativo ${ticker} removido com sucesso.`);
      } catch (err) {
        toast.error('Erro ao excluir ativo.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Controls - Redesigned Desktop/Mobile Hierarchy */}
      <div className="bg-card border border-border/80 p-5 rounded-3xl shadow-sm space-y-4">
        {/* Top Row: Title, Subtitle, Info Badges */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 text-primary border border-primary/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black text-foreground tracking-tight">
                  Análise Fundamentalista B3 & Valuation Engine
                </h3>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {baseComputedAssets.length} Ativos Base
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Painel analítico para seleção de ações e fundos imobiliários por Valuation, Saúde Financeira e Score Multicritério.
              </p>
            </div>
          </div>

          {/* Freshness Status Badge */}
          {importFreshness.status !== 'empty' && (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-bold border transition-all shrink-0 ${
              importFreshness.isStale 
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' 
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            }`}>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <div className="text-left leading-tight">
                <span className="block text-[10px] text-muted-foreground font-semibold">Base de Dados Fundamentus</span>
                <span className="font-extrabold">{importFreshness.label}</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Row: Control Groups */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Control Group 1: Asset Type Segment Switcher */}
          <div className="flex items-center bg-muted/40 p-1 rounded-2xl border border-border/60 text-xs font-bold shadow-xs">
            <button
              onClick={() => { setActiveTypeTab('all'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTypeTab === 'all' 
                  ? 'bg-card text-foreground shadow-xs ring-1 ring-border/80 font-black' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>Todos</span>
              <span className={`px-2 py-0.2 text-[10px] rounded-full font-extrabold ${
                activeTypeTab === 'all' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {baseComputedAssets.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTypeTab('Ação'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTypeTab === 'Ação' 
                  ? 'bg-card text-foreground shadow-xs ring-1 ring-border/80 font-black' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>Ações</span>
              <span className={`px-2 py-0.2 text-[10px] rounded-full font-extrabold ${
                activeTypeTab === 'Ação' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
              }`}>
                {baseComputedAssets.filter(a => a.fund.type === 'Ação').length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTypeTab('FII'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTypeTab === 'FII' 
                  ? 'bg-card text-foreground shadow-xs ring-1 ring-border/80 font-black' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-sky-500" />
              <span>FIIs</span>
              <span className={`px-2 py-0.2 text-[10px] rounded-full font-extrabold ${
                activeTypeTab === 'FII' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400' : 'bg-muted text-muted-foreground'
              }`}>
                {baseComputedAssets.filter(a => a.fund.type === 'FII').length}
              </span>
            </button>
          </div>

          {/* Control Group 2: Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-black border border-emerald-500/20 transition-all shadow-xs cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-emerald-500" />
              Importar Fundamentus
            </button>

            <button
              onClick={() => {
                setEditingAssetData(null);
                setIsManualModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Novo Ativo
            </button>

            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground rounded-xl text-xs font-bold border border-border/60 transition-all cursor-pointer"
              title="Ajustar pesos dos pilares do Score B3"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Pesos
            </button>
          </div>
        </div>
      </div>

      {/* Alert Banner 1: Empty Database */}
      {importFreshness.status === 'empty' && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-4.5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-sm text-foreground">Aviso: Nenhuma tabela de ativos B3 foi importada ainda</h4>
              <p className="text-muted-foreground mt-0.5 max-w-2xl">
                O Score B3 e os rankings precisam de dados reais do mercado. Cole a tabela de Ações e FIIs do site Fundamentus para salvar todos os indicadores diretamente no seu banco de dados.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl shrink-0 transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            <UploadCloud className="w-4 h-4" />
            Importar Dados B3 Agora
          </button>
        </div>
      )}

      {/* Alert Banner 2: Stale / Outdated Database */}
      {importFreshness.status !== 'empty' && importFreshness.isStale && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-4.5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-sm text-foreground flex items-center gap-2">
                Atenção: Seus dados do Fundamentus estão antigos
                <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  {importFreshness.label} ({importFreshness.formattedDate})
                </span>
              </h4>
              <p className="text-muted-foreground mt-0.5 max-w-2xl">
                Os dados de P/L, ROE, Vacância e Dividend Yield mudam constantemente na bolsa. Recomendamos colar uma tabela atualizada do Fundamentus para manter suas análises precisas.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl shrink-0 transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar Tabela Agora
          </button>
        </div>
      )}

      {/* 2. Valuation Ranking Strategy Method Selector */}
      <div className="bg-card border border-border/80 p-5 rounded-3xl space-y-4 shadow-sm relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
        
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-primary/20 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20 shadow-xs">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground tracking-tight flex items-center gap-2">
                Análise Fundamentalista B3 & Ranking de Valuation
                <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Valuation Engine
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Escolha a estratégia de seleção ou fórmula intrínseca para ordenar e ranquear sua base de ativos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="px-3 py-1.5 bg-muted/50 border border-border/60 rounded-xl text-xs font-bold text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>
                Ativos qualificados: <strong className="text-foreground font-black">{filteredAssets.length}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Strategy Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Method 1: Score B3 */}
          <button
            onClick={() => handleApplyMethodPreset('score_b3')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
              rankingMethod === 'score_b3'
                ? 'bg-primary/10 border-primary text-foreground shadow-md ring-2 ring-primary/40'
                : 'bg-muted/20 border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-1.5 rounded-xl ${rankingMethod === 'score_b3' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                <Crown className="w-4 h-4" />
              </div>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                rankingMethod === 'score_b3' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                0 - 100
              </span>
            </div>
            <div>
              <p className="text-xs font-black text-foreground group-hover:text-primary transition-colors">Score B3</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 font-medium">Multicritério Ponderado</p>
            </div>
          </button>

          {/* Method 2: Barsi / Bazin */}
          <button
            onClick={() => handleApplyMethodPreset('barsi_bazin')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
              rankingMethod === 'barsi_bazin'
                ? 'bg-emerald-500/10 border-emerald-500 text-foreground shadow-md ring-2 ring-emerald-500/40'
                : 'bg-muted/20 border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-1.5 rounded-xl ${rankingMethod === 'barsi_bazin' ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                <Coins className="w-4 h-4" />
              </div>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                rankingMethod === 'barsi_bazin' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
              }`}>
                Teto 6%
              </span>
            </div>
            <div>
              <p className="text-xs font-black text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Barsi & Bazin</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 font-medium">Preço Teto Dividendos</p>
            </div>
          </button>

          {/* Method 3: Graham */}
          <button
            onClick={() => handleApplyMethodPreset('graham')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
              rankingMethod === 'graham'
                ? 'bg-blue-500/10 border-blue-500 text-foreground shadow-md ring-2 ring-blue-500/40'
                : 'bg-muted/20 border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-1.5 rounded-xl ${rankingMethod === 'graham' ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                rankingMethod === 'graham' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-muted text-muted-foreground'
              }`}>
                Intrínseco
              </span>
            </div>
            <div>
              <p className="text-xs font-black text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Benjamin Graham</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 font-medium">Valor Intrínseco VI</p>
            </div>
          </button>

          {/* Method 4: Greenblatt Magic Formula */}
          <button
            onClick={() => handleApplyMethodPreset('greenblatt')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
              rankingMethod === 'greenblatt'
                ? 'bg-purple-500/10 border-purple-500 text-foreground shadow-md ring-2 ring-purple-500/40'
                : 'bg-muted/20 border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-1.5 rounded-xl ${rankingMethod === 'greenblatt' ? 'bg-purple-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                <Zap className="w-4 h-4" />
              </div>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                rankingMethod === 'greenblatt' ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400' : 'bg-muted text-muted-foreground'
              }`}>
                Magic
              </span>
            </div>
            <div>
              <p className="text-xs font-black text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Magic Formula</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 font-medium">ROIC + P/L (Greenblatt)</p>
            </div>
          </button>

          {/* Method 5: FII High Quality */}
          <button
            onClick={() => handleApplyMethodPreset('fii_quality')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
              rankingMethod === 'fii_quality'
                ? 'bg-sky-500/10 border-sky-500 text-foreground shadow-md ring-2 ring-sky-500/40'
                : 'bg-muted/20 border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-1.5 rounded-xl ${rankingMethod === 'fii_quality' ? 'bg-sky-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                <Building2 className="w-4 h-4" />
              </div>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                rankingMethod === 'fii_quality' ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400' : 'bg-muted text-muted-foreground'
              }`}>
                FIIs
              </span>
            </div>
            <div>
              <p className="text-xs font-black text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">FII High Quality</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 font-medium">Vacância & Yield Ponderado</p>
            </div>
          </button>

          {/* Method 6: Custom / All */}
          <button
            onClick={() => { setRankingMethod('custom'); setCurrentPage(1); }}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
              rankingMethod === 'custom'
                ? 'bg-amber-500/10 border-amber-500 text-foreground shadow-md ring-2 ring-amber-500/40'
                : 'bg-muted/20 border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-1.5 rounded-xl ${rankingMethod === 'custom' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                rankingMethod === 'custom' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'
              }`}>
                Filtros Sliders
              </span>
            </div>
            <div>
              <p className="text-xs font-black text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Personalizado</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 font-medium">Filtros Livres em Sliders</p>
            </div>
          </button>
        </div>

        {/* Dynamic Explanation & Active Filter Values Strip for Selected Methodology */}
        <div className="p-4 bg-muted/30 border border-border/60 rounded-2xl space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <p className="text-foreground font-black text-xs uppercase tracking-wider">
                {rankingMethod === 'score_b3' && 'Score B3 Universal (Multicritério 0-100)'}
                {rankingMethod === 'barsi_bazin' && 'Método Décio Bazin & Luiz Barsi (Preço Teto 6%)'}
                {rankingMethod === 'graham' && 'Fórmula de Benjamin Graham (Valor Intrínseco VI)'}
                {rankingMethod === 'greenblatt' && 'Magic Formula de Joel Greenblatt (ROIC + P/L)'}
                {rankingMethod === 'fii_quality' && 'FIIs High Quality & Renda Imobiliária'}
                {rankingMethod === 'custom' && 'Filtro & Ordenação Personalizada'}
              </p>
            </div>
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-rose-500 transition-colors shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Resetar Filtros
            </button>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            {rankingMethod === 'score_b3' && (
              <>Calcula pontuação de 0 a 100 ponderando Dividendos, Saúde Financeira, Valuation, Rentabilidade e Liquidez.</>
            )}
            {rankingMethod === 'barsi_bazin' && (
              <>Calcula o Preço Teto Bazin <span className="font-mono bg-muted/60 px-1 py-0.5 rounded text-[11px] text-foreground font-bold">(DPA ÷ 0,06)</span> e ranqueia ações com maior Margem de Segurança (%).</>
            )}
            {rankingMethod === 'graham' && (
              <>Calcula o Valor Intrínseco VI = <span className="font-mono bg-muted/60 px-1 py-0.5 rounded text-[11px] text-foreground font-bold">√(22,5 × LPA × VPA)</span> e ranqueia as ações com maior Desconto.</>
            )}
            {rankingMethod === 'greenblatt' && (
              <>Atribui Ranks para o Maior ROIC/ROE (Qualidade) e Menor P/L (Preço Barato) e soma as duas posições.</>
            )}
            {rankingMethod === 'fii_quality' && (
              <>Pontua fundos imobiliários combinando FFO Yield, Dividend Yield, P/VP justo e baixa Vacância Física Média.</>
            )}
            {rankingMethod === 'custom' && (
              <>Ajuste os sliders deslizantes para definir seus próprios critérios de busca.</>
            )}
          </p>

          {/* Active Filter Threshold Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-[11px]">
            <span className="font-black text-muted-foreground uppercase text-[10px] tracking-wider">Filtros Aplicados pelo Método:</span>
            {rankingMethod === 'score_b3' && (
              <>
                <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 font-bold">Alvo: Todos (Ações & FIIs)</span>
                <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">Pesos: Qualidade 25% | Valuation 20% | Solvência 20% | DY 15%</span>
              </>
            )}
            {rankingMethod === 'barsi_bazin' && (
              <>
                <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold">Alvo: Ações</span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">DY 12M Mínimo: 6,0%</span>
                <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">ROE Mínimo: 8,0%</span>
                <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">Dívida Líq./EBITDA Máx: 3,5x</span>
              </>
            )}
            {rankingMethod === 'graham' && (
              <>
                <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold">Alvo: Ações</span>
                <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold">P/L Máximo: 15,0x</span>
                <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">ROE Mínimo: 10,0%</span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">Fórmula VI = √(22,5 × LPA × VPA)</span>
              </>
            )}
            {rankingMethod === 'greenblatt' && (
              <>
                <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold">Alvo: Ações</span>
                <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-bold">ROE/ROIC Mínimo: 12,0%</span>
                <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">Combinação de Ranks ROIC + P/L</span>
              </>
            )}
            {rankingMethod === 'fii_quality' && (
              <>
                <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-bold">Alvo: FIIs</span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">DY 12M: 6,5% a 16,0%</span>
                <span className="px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-bold">P/VP Máximo: 1,10x</span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">Vacância Física Máx: 10,0%</span>
              </>
            )}
            {rankingMethod === 'custom' && (
              <>
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">Alvo: {activeTypeTab === 'all' ? 'Todos os Ativos' : activeTypeTab === 'Ação' ? 'Somente Ações' : 'Somente FIIs'}</span>
                {minRoe > 0 && <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">ROE Mín: {minRoe}%</span>}
                {minRoic > 0 && <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">ROIC Mín: {minRoic}%</span>}
                {maxPl < 100 && <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">P/L Máx: {maxPl}x</span>}
                {maxDebtEbitda < 5 && <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">Dívida Máx: {maxDebtEbitda}x</span>}
                {minDy > 0 && <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">DY Mín: {minDy}%</span>}
                {maxDy < 100 && <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">DY Máx: {maxDy}%</span>}
                {maxVacancy < 50 && <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">Vacância Máx: {maxVacancy}%</span>}
                {maxPvpFii < 1.5 && <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">P/VP Máx: {maxPvpFii}x</span>}
                {minNetMargin > -100 && <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">Margem Líq. Mín: {minNetMargin}%</span>}
                {minFfoYield > 0 && <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">FFO Yield Mín: {minFfoYield}%</span>}
                {minLiquidity > 0 && <span className="px-2 py-0.5 rounded-lg bg-muted border border-border/60 text-foreground font-bold">Liquidez Mín: R$ {minLiquidity}M/dia</span>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. Top 3 Podium Highlights for Active Method */}
      {topPodiumAssets.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-black text-foreground uppercase tracking-wider px-1">
            <Award className="w-4 h-4 text-amber-500" />
            <span>Pódio Top 3 - Método {rankingMethod.replace('_', ' ').toUpperCase()}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topPodiumAssets.map((item, idx) => {
              const badgeColors = [
                'from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/40 text-amber-600 dark:text-amber-400', // Gold
                'from-slate-400/20 via-slate-400/10 to-transparent border-slate-400/40 text-slate-600 dark:text-slate-300', // Silver
                'from-orange-600/20 via-orange-600/10 to-transparent border-orange-600/40 text-orange-600 dark:text-orange-400'  // Bronze
              ];
              const medalIcons = ['🥇 #1 Ouro', '🥈 #2 Prata', '🥉 #3 Bronze'];

              return (
                <div 
                  key={item.ticker}
                  className={`p-4 rounded-3xl bg-gradient-to-br ${badgeColors[idx]} border shadow-xs space-y-3 relative overflow-hidden`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-card border border-border/60 text-foreground">
                        {medalIcons[idx]}
                      </span>
                      <h4 className="text-lg font-black text-foreground mt-1.5 flex items-center gap-2">
                        {item.ticker}
                        <span className="text-xs font-normal text-muted-foreground truncate max-w-[120px]">
                          {item.fund.name}
                        </span>
                      </h4>
                    </div>

                    <button
                      onClick={() => setSelectedAssetForScore(item.score)}
                      className="px-2.5 py-1 rounded-xl font-black text-xs shadow-xs"
                      style={{
                        backgroundColor: `${getScoreColor(item.score.totalScore)}20`,
                        color: getScoreColor(item.score.totalScore),
                        border: `1px solid ${getScoreColor(item.score.totalScore)}40`
                      }}
                    >
                      {item.score.totalScore} pts ({item.score.grade})
                    </button>
                  </div>

                  {/* Highlight Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40">
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-bold">Cotação Atual</span>
                      <p className="font-black text-foreground">{item.quote > 0 ? `R$ ${item.quote.toFixed(2)}` : '-'}</p>
                    </div>

                    <div>
                      {rankingMethod === 'barsi_bazin' && (
                        <>
                          <span className="text-[10px] text-muted-foreground block font-bold">Preço Teto Barsi</span>
                          <p className="font-black text-emerald-600">
                            {item.barsiTargetPrice > 0 ? `R$ ${item.barsiTargetPrice.toFixed(2)}` : '-'}
                            <span className="text-[10px] ml-1">({item.barsiMarginPct.toFixed(0)}%)</span>
                          </p>
                        </>
                      )}

                      {rankingMethod === 'graham' && (
                        <>
                          <span className="text-[10px] text-muted-foreground block font-bold">Valor Intrínseco VI</span>
                          <p className="font-black text-blue-600">
                            {item.grahamIntrinsicValue > 0 ? `R$ ${item.grahamIntrinsicValue.toFixed(2)}` : '-'}
                            <span className="text-[10px] ml-1">({item.grahamDiscountPct.toFixed(0)}%)</span>
                          </p>
                        </>
                      )}

                      {rankingMethod === 'greenblatt' && (
                        <>
                          <span className="text-[10px] text-muted-foreground block font-bold">Score Magic</span>
                          <p className="font-black text-purple-600">
                            #{item.magicRankScore} (ROIC #{item.roicRank} + P/L #{item.valuationRank})
                          </p>
                        </>
                      )}

                      {(rankingMethod === 'score_b3' || rankingMethod === 'fii_quality' || rankingMethod === 'custom') && (
                        <>
                          <span className="text-[10px] text-muted-foreground block font-bold">DY 12M / P/VP</span>
                          <p className="font-black text-emerald-600">
                            {item.fund.dividendYield ? `${item.fund.dividendYield.toFixed(1)}%` : '-'} 
                            <span className="text-muted-foreground text-[10px] ml-1">({item.fund.pvp ? `${item.fund.pvp.toFixed(2)}x` : '-'})</span>
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {item.fund.type === 'Ação' ? item.fund.sector : item.fund.fiiSegment}
                    </span>
                    <button
                      onClick={() => onOpenRaioX && onOpenRaioX(item.ticker)}
                      className="text-[11px] font-black text-primary hover:underline flex items-center gap-1"
                    >
                      Raio-X Completo <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Filter & Search Bar */}
      <div className="bg-card border border-border/80 p-4 rounded-3xl space-y-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="relative md:col-span-6 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por Ticker, Empresa, Fundo ou Setor..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full bg-muted/20 border border-border/60 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Sector Filter Dropdown */}
          <div className="md:col-span-3 w-full">
            <select
              value={selectedSector}
              onChange={(e) => { setSelectedSector(e.target.value); setCurrentPage(1); }}
              className="w-full bg-muted/20 border border-border/60 rounded-2xl px-3 py-2.5 text-xs text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="all">Todos os Setores / Segmentos ({availableSectors.length})</option>
              {availableSectors.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>

          {/* Only Portfolio Switch & Reset Sort */}
          <div className="md:col-span-3 flex items-center justify-end gap-2">
            {sortField !== 'default' && (
              <button
                onClick={() => { setSortField('default'); setSortOrder('desc'); }}
                className="px-2.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-2xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                title="Voltar a ordenar pelo Rank padrão do método"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Rank Padrão</span>
              </button>
            )}

            <label className="flex items-center gap-2 text-xs text-foreground font-bold cursor-pointer select-none bg-muted/20 px-3.5 py-2.5 rounded-2xl border border-border/60 w-full md:w-auto justify-center">
              <input
                type="checkbox"
                checked={onlyPortfolio}
                onChange={(e) => { setOnlyPortfolio(e.target.checked); setCurrentPage(1); }}
                className="w-4 h-4 rounded text-primary focus:ring-0"
              />
              Minha Carteira
            </label>
          </div>
        </div>

        {/* Fundamental Filter Sliders - ONLY rendered when Ranking Method is 'custom' */}
        {rankingMethod === 'custom' && (
          <div className="space-y-3 pt-3 border-t border-border/40 text-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="font-black text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                Filtros Avançados Personalizados
              </span>
              <button
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Resetar Filtros
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Min ROE */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">ROE Mín (Ações): {minRoe}%</label>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={2}
                  value={minRoe}
                  onChange={(e) => { setMinRoe(Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              {/* Min ROIC */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">ROIC Mín (Ações): {minRoic}%</label>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={2}
                  value={minRoic}
                  onChange={(e) => { setMinRoic(Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              {/* Max P/L */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">P/L Máx (Ações): {maxPl === 100 ? 'Livre' : `${maxPl}x`}</label>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={maxPl}
                  onChange={(e) => { setMaxPl(Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              {/* Max Debt/EBITDA */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Dív./EBITDA Máx: {maxDebtEbitda === 5.0 ? 'Livre' : `${maxDebtEbitda}x`}</label>
                <input
                  type="range"
                  min={1.0}
                  max={5.0}
                  step={0.5}
                  value={maxDebtEbitda}
                  onChange={(e) => { setMaxDebtEbitda(Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              {/* Min Net Margin */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Margem Líq. Mín: {minNetMargin === -100 ? 'Livre' : `${minNetMargin}%`}</label>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={2}
                  value={minNetMargin === -100 ? 0 : minNetMargin}
                  onChange={(e) => { setMinNetMargin(Number(e.target.value) === 0 ? -100 : Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              {/* Min DY */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">DY Mínimo: {minDy}%</label>
                <input
                  type="range"
                  min={0}
                  max={15}
                  step={1}
                  value={minDy}
                  onChange={(e) => { setMinDy(Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Max DY */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">DY Máximo: {maxDy === 100 ? 'Sem limite' : `${maxDy}%`}</label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={maxDy}
                  onChange={(e) => { setMaxDy(Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Max Vacancy (FIIs) */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Vacância Máx FII: {maxVacancy === 50 ? 'Livre' : `${maxVacancy}%`}</label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={maxVacancy}
                  onChange={(e) => { setMaxVacancy(Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              {/* Max P/VP (FIIs) */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">P/VP Máx FII: {maxPvpFii === 1.5 ? 'Livre' : `${maxPvpFii}x`}</label>
                <input
                  type="range"
                  min={0.7}
                  max={1.5}
                  step={0.05}
                  value={maxPvpFii}
                  onChange={(e) => { setMaxPvpFii(Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              {/* Min FFO Yield (FIIs) */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">FFO Yield Mín FII: {minFfoYield}%</label>
                <input
                  type="range"
                  min={0}
                  max={15}
                  step={1}
                  value={minFfoYield}
                  onChange={(e) => { setMinFfoYield(Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              {/* Min Daily Liquidity */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Liq. Diária Mín: {minLiquidity === 0 ? 'Livre' : minLiquidity < 1 ? `R$ ${(minLiquidity * 1000).toFixed(0)} mil/dia` : `R$ ${minLiquidity.toFixed(1)}M/dia`}
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.05}
                  value={minLiquidity}
                  onChange={(e) => { setMinLiquidity(Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Paginated Assets Table */}
      {filteredAssets.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-border/80 bg-card space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Database className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-black text-foreground">Nenhum ativo atende aos critérios selecionados</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Tente redefinir ou suavizar os filtros de P/L, ROE ou Vacância, ou importe dados atualizados do Fundamentus.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-black hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Resetar Filtros
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black hover:bg-emerald-600 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <UploadCloud className="w-4 h-4" />
              Importar Tabela Fundamentus
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs space-y-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/30 text-muted-foreground font-bold border-b border-border/60 text-[10px] uppercase tracking-wider">
                <tr>
                  <th 
                    onClick={() => handleSortColumn('default')}
                    className="px-4 py-3.5 text-center w-12 cursor-pointer hover:bg-muted/50 select-none transition-colors"
                    title="Voltar ao Rank Padrão do Método"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span># Rank</span>
                      {sortField === 'default' && <span className="text-primary text-[9px]">●</span>}
                    </div>
                  </th>

                  <th 
                    onClick={() => handleSortColumn('ticker')}
                    className="px-4 py-3.5 cursor-pointer hover:bg-muted/50 select-none transition-colors"
                    title="Ordenar por Nome / Ticker"
                  >
                    <div className="flex items-center gap-1">
                      <span>Ativo / Ticker</span>
                      {sortField === 'ticker' ? (
                        <span className="text-primary font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />
                      )}
                    </div>
                  </th>

                  <th 
                    onClick={() => handleSortColumn('score')}
                    className="px-4 py-3.5 text-center cursor-pointer hover:bg-muted/50 select-none transition-colors"
                    title="Ordenar por Score B3 (0-100)"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Score B3</span>
                      {sortField === 'score' ? (
                        <span className="text-primary font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />
                      )}
                    </div>
                  </th>

                  <th 
                    onClick={() => handleSortColumn('price')}
                    className="px-4 py-3.5 text-right cursor-pointer hover:bg-muted/50 select-none transition-colors"
                    title="Ordenar por Cotação"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Cotação</span>
                      {sortField === 'price' ? (
                        <span className="text-primary font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />
                      )}
                    </div>
                  </th>

                  <th 
                    onClick={() => handleSortColumn('pvp')}
                    className="px-4 py-3.5 text-right cursor-pointer hover:bg-muted/50 select-none transition-colors"
                    title="Ordenar por P/VP"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>P/VP</span>
                      {sortField === 'pvp' ? (
                        <span className="text-primary font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />
                      )}
                    </div>
                  </th>

                  <th 
                    onClick={() => handleSortColumn('dy')}
                    className="px-4 py-3.5 text-right cursor-pointer hover:bg-muted/50 select-none transition-colors"
                    title="Ordenar por Dividend Yield 12M"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>DY 12M</span>
                      {sortField === 'dy' ? (
                        <span className="text-primary font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />
                      )}
                    </div>
                  </th>

                  {/* Dynamic Method Metric Column */}
                  {rankingMethod === 'barsi_bazin' && (
                    <th 
                      onClick={() => handleSortColumn('barsi_margin')}
                      className="px-4 py-3.5 text-right text-emerald-600 font-black cursor-pointer hover:bg-muted/50 select-none transition-colors"
                      title="Ordenar por Margem do Preço Teto Barsi"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Preço Teto Barsi (Margem)</span>
                        {sortField === 'barsi_margin' ? (
                          <span className="text-emerald-600 font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-emerald-600/40" />
                        )}
                      </div>
                    </th>
                  )}

                  {rankingMethod === 'graham' && (
                    <th 
                      onClick={() => handleSortColumn('graham_discount')}
                      className="px-4 py-3.5 text-right text-blue-600 font-black cursor-pointer hover:bg-muted/50 select-none transition-colors"
                      title="Ordenar por Desconto do Valor Intrínseco VI"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Valor Intrínseco VI (Desconto)</span>
                        {sortField === 'graham_discount' ? (
                          <span className="text-blue-600 font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-blue-600/40" />
                        )}
                      </div>
                    </th>
                  )}

                  {rankingMethod === 'greenblatt' && (
                    <th 
                      onClick={() => handleSortColumn('magic_score')}
                      className="px-4 py-3.5 text-center text-purple-600 font-black cursor-pointer hover:bg-muted/50 select-none transition-colors"
                      title="Ordenar por Score Magic Formula (Menor é melhor)"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Magic Rank (ROIC + P/L)</span>
                        {sortField === 'magic_score' ? (
                          <span className="text-purple-600 font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-purple-600/40" />
                        )}
                      </div>
                    </th>
                  )}

                  {(rankingMethod === 'score_b3' || rankingMethod === 'fii_quality' || rankingMethod === 'custom') && (
                    <>
                      <th 
                        onClick={() => handleSortColumn('pl_ffo')}
                        className="px-4 py-3.5 text-right cursor-pointer hover:bg-muted/50 select-none transition-colors"
                        title="Ordenar por P/L ou FFO"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>P/L ou FFO</span>
                          {sortField === 'pl_ffo' ? (
                            <span className="text-primary font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />
                          )}
                        </div>
                      </th>

                      <th 
                        onClick={() => handleSortColumn('roe_vacancy')}
                        className="px-4 py-3.5 text-right cursor-pointer hover:bg-muted/50 select-none transition-colors"
                        title="Ordenar por ROE ou Vacância"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>ROE / Vacância</span>
                          {sortField === 'roe_vacancy' ? (
                            <span className="text-primary font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />
                          )}
                        </div>
                      </th>

                      <th 
                        onClick={() => handleSortColumn('margin_cap')}
                        className="px-4 py-3.5 text-right cursor-pointer hover:bg-muted/50 select-none transition-colors"
                        title="Ordenar por Margem Líquida ou Cap Rate"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Margem Líq. / Cap Rate</span>
                          {sortField === 'margin_cap' ? (
                            <span className="text-primary font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />
                          )}
                        </div>
                      </th>

                      <th className="px-4 py-3.5 text-right cursor-default select-none text-muted-foreground/70">
                        <span>Dívida / Cresc.</span>
                      </th>

                      <th 
                        onClick={() => handleSortColumn('liquidity')}
                        className="px-4 py-3.5 text-right cursor-pointer hover:bg-muted/50 select-none transition-colors"
                        title="Ordenar por Liquidez Diária Média"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Liq. Diária</span>
                          {sortField === 'liquidity' ? (
                            <span className="text-primary font-black">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />
                          )}
                        </div>
                      </th>
                    </>
                  )}

                  <th className="px-4 py-3.5 text-center">Origem</th>
                  <th className="px-4 py-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {paginatedAssets.map((item, indexOnPage) => {
                  const globalRank = (currentPageClamped - 1) * pageSize + indexOnPage + 1;
                  const isStock = item.fund.type === 'Ação';
                  const sf = item.fund as B3StockFundamental;
                  const ff = item.fund as B3FiiFundamental;

                  return (
                    <tr key={item.ticker} className="hover:bg-muted/20 transition-colors">
                      {/* Rank Position Badge */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg font-black text-xs ${
                          globalRank === 1 ? 'bg-amber-500/20 text-amber-600 border border-amber-500/40' :
                          globalRank === 2 ? 'bg-slate-400/20 text-slate-600 border border-slate-400/40' :
                          globalRank === 3 ? 'bg-orange-600/20 text-orange-600 border border-orange-600/40' :
                          'text-muted-foreground bg-muted/40'
                        }`}>
                          {globalRank}
                        </span>
                      </td>

                      {/* Ticker & Name */}
                      <td className="px-4 py-3">
                        <div 
                          onClick={() => handleTriggerRaioX(item)}
                          className="flex items-center gap-2.5 cursor-pointer group"
                          title="Clique para abrir o Raio-X Completo deste ativo"
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 group-hover:scale-105 transition-transform ${
                            isStock 
                              ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' 
                              : 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                          }`}>
                            {item.ticker.slice(0, 4)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-foreground group-hover:text-primary transition-colors">{item.ticker}</span>
                              {item.isInPortfolio && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                                  Carteira
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                              {item.fund.name} {isStock ? (sf.sector ? `• ${sf.sector}` : '') : (ff.fiiSegment ? `• ${ff.fiiSegment}` : '')}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Score Badge */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedAssetForScore(item.score)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-black text-xs cursor-pointer transition-all hover:scale-105"
                          style={{
                            backgroundColor: `${getScoreColor(item.score.totalScore)}15`,
                            color: getScoreColor(item.score.totalScore),
                            border: `1px solid ${getScoreColor(item.score.totalScore)}30`
                          }}
                        >
                          <span>{item.score.totalScore}</span>
                          <span className="text-[10px] opacity-80">({item.score.grade})</span>
                        </button>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 text-right font-black text-foreground">
                        {item.quote > 0 ? `R$ ${item.quote.toFixed(2)}` : '-'}
                      </td>

                      {/* P/VP */}
                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        {item.fund.pvp ? item.fund.pvp.toFixed(2) : '-'}
                      </td>

                      {/* DY 12M */}
                      <td className="px-4 py-3 text-right font-black text-emerald-600">
                        {item.fund.dividendYield ? `${item.fund.dividendYield.toFixed(1)}%` : '-'}
                      </td>

                      {/* Method Specific Dynamic Columns */}
                      {rankingMethod === 'barsi_bazin' && (
                        <td className="px-4 py-3 text-right font-black text-emerald-600">
                          {item.barsiTargetPrice > 0 ? (
                            <span>
                              R$ {item.barsiTargetPrice.toFixed(2)}{' '}
                              <span className={`text-[10px] ${item.barsiMarginPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                ({item.barsiMarginPct > 0 ? '+' : ''}{item.barsiMarginPct.toFixed(0)}%)
                              </span>
                            </span>
                          ) : '-'}
                        </td>
                      )}

                      {rankingMethod === 'graham' && (
                        <td className="px-4 py-3 text-right font-black text-blue-600">
                          {item.grahamIntrinsicValue > 0 ? (
                            <span>
                              R$ {item.grahamIntrinsicValue.toFixed(2)}{' '}
                              <span className={`text-[10px] ${item.grahamDiscountPct >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                                ({item.grahamDiscountPct > 0 ? '+' : ''}{item.grahamDiscountPct.toFixed(0)}%)
                              </span>
                            </span>
                          ) : '-'}
                        </td>
                      )}

                      {rankingMethod === 'greenblatt' && (
                        <td className="px-4 py-3 text-center font-black text-purple-600">
                          {isStock ? (
                            <span className="text-xs">
                              Score #{item.magicRankScore} <span className="text-[10px] text-muted-foreground font-normal">(ROIC #{item.roicRank} + P/L #{item.valuationRank})</span>
                            </span>
                          ) : '-'}
                        </td>
                      )}

                      {(rankingMethod === 'score_b3' || rankingMethod === 'fii_quality' || rankingMethod === 'custom') && (
                        <>
                          <td className="px-4 py-3 text-right font-medium">
                            {isStock ? (
                              <span className="text-foreground">{sf.pl ? `${sf.pl.toFixed(1)}x` : '-'}</span>
                            ) : (
                              <span className="text-foreground font-semibold">{ff.ffoYield ? `${ff.ffoYield.toFixed(1)}%` : '-'}</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-medium">
                            {isStock ? (
                              <span className="text-emerald-600 font-bold">{sf.roe ? `${sf.roe.toFixed(1)}%` : '-'}</span>
                            ) : (
                              <div>
                                <span className="text-sky-600 font-bold block">
                                  {ff.physicalVacancy !== undefined && ff.physicalVacancy !== null ? `${ff.physicalVacancy.toFixed(1)}%` : '-'}
                                </span>
                                {(ff.propertiesCount > 0 || ff.capRate) && (
                                  <span className="text-[9px] text-muted-foreground block font-normal">
                                    {ff.propertiesCount > 0 ? `${ff.propertiesCount} imóv.` : ''} {ff.capRate ? `• Cap ${ff.capRate.toFixed(1)}%` : ''}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-medium">
                            {isStock ? (
                              <span className="text-foreground">{sf.netMargin !== undefined && sf.netMargin !== null ? `${sf.netMargin.toFixed(1)}%` : '-'}</span>
                            ) : (
                              <span className="text-foreground font-semibold">{ff.capRate !== undefined && ff.capRate !== null ? `${ff.capRate.toFixed(1)}%` : '-'}</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-medium">
                            {isStock ? (
                              <div className="flex flex-col items-end">
                                <span className="text-[11px] text-rose-500 font-bold" title="Dívida Líquida / EBITDA">
                                  {sf.netDebtOverEbitda !== undefined ? `${sf.netDebtOverEbitda.toFixed(2)}x` : '-'}
                                </span>
                                <span className="text-[9px] text-emerald-500 font-bold" title="CAGR Receita (5a)">
                                  {sf.revenueCagr5y !== undefined ? `${sf.revenueCagr5y.toFixed(1)}%` : '-'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-end">
                                <span className="text-[11px] text-indigo-500 font-bold" title="Valor Patrimonial (VPA)">
                                  {ff.netWorth ? `R$ ${(ff.netWorth / 1000).toFixed(1)}B` : '-'}
                                </span>
                                <span className="text-[9px] text-muted-foreground font-bold" title="Tipo">
                                  {ff.fiiType}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-medium">
                            <span className="text-xs font-bold text-foreground">
                              {(() => {
                                const raw = item.fund.dailyLiquidity || 0;
                                const realVal = (raw > 0 && raw < 50000) ? raw * 1000 : raw;
                                if (!realVal) return '-';
                                return realVal >= 1_000_000 
                                  ? `R$ ${(realVal / 1_000_000).toFixed(1)}M` 
                                  : `R$ ${(realVal / 1_000).toFixed(0)}k`;
                              })()}
                            </span>
                          </td>
                        </>
                      )}

                      {/* Source & Updated Date */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
                            {item.source}
                          </span>
                          {item.updatedAt ? (
                            <span className="text-[9px] text-muted-foreground/80 font-medium">
                              {new Date(item.updatedAt).toLocaleDateString('pt-BR')}
                            </span>
                          ) : (
                            <span className="text-[9px] text-muted-foreground/50">Base Local</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleTriggerRaioX(item)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                            title="Abrir Raio-X Completo"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                            title="Editar Indicadores"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {item.rawMeta && (
                            <button
                              onClick={() => handleDelete(item.ticker)}
                              className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Remover Ativo"
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

          {/* Table Footer with Page Selection Tabs */}
          <div className="p-4 bg-muted/20 border-t border-border/60 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
            <div className="text-muted-foreground font-bold flex items-center gap-2">
              <span>Mostrando <strong className="text-foreground font-black">{(currentPageClamped - 1) * pageSize + 1}</strong> a <strong className="text-foreground font-black">{Math.min(currentPageClamped * pageSize, filteredAssets.length)}</strong> de <strong className="text-foreground font-black">{filteredAssets.length}</strong> ativos ({baseComputedAssets.length} total)</span>
            </div>

            {/* Page Selection Number Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 bg-card/80 p-1.5 rounded-2xl border border-border/60 shadow-xs">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPageClamped === 1}
                className="px-2.5 py-1.5 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-foreground transition-all flex items-center gap-1 font-bold text-[11px] cursor-pointer"
                title="Página Anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              {/* Page Number Pills */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || (p >= currentPageClamped - 2 && p <= currentPageClamped + 2))
                .reduce<(number | string)[]>((acc, p, idx, arr) => {
                  if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                    acc.push('...');
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) => {
                  if (item === '...') {
                    return <span key={`ellipsis-${idx}`} className="px-2 py-1 text-muted-foreground font-bold">...</span>;
                  }
                  const pageNum = item as number;
                  const isActive = pageNum === currentPageClamped;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[32px] h-8 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPageClamped >= totalPages}
                className="px-2.5 py-1.5 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-foreground transition-all flex items-center gap-1 font-bold text-[11px] cursor-pointer"
                title="Próxima Página"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-2 text-muted-foreground font-bold">
              <span>Por página:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-card border border-border/80 rounded-xl px-2.5 py-1.5 text-xs text-foreground font-black focus:outline-none shadow-xs cursor-pointer"
              >
                <option value={15}>15 itens</option>
                <option value={20}>20 itens</option>
                <option value={50}>50 itens</option>
                <option value={100}>100 itens</option>
                <option value={500}>500 itens</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Score Details Breakdown */}
      {selectedAssetForScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg"
                  style={{
                    backgroundColor: `${getScoreColor(selectedAssetForScore.totalScore)}20`,
                    color: getScoreColor(selectedAssetForScore.totalScore)
                  }}
                >
                  {selectedAssetForScore.totalScore}
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    Score B3: {selectedAssetForScore.ticker}
                    <span 
                      className="text-xs px-2 py-0.5 rounded-md font-bold uppercase"
                      style={{
                        backgroundColor: `${getScoreColor(selectedAssetForScore.totalScore)}15`,
                        color: getScoreColor(selectedAssetForScore.totalScore)
                      }}
                    >
                      {selectedAssetForScore.grade}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedAssetForScore.type} • Nota calculada pelo algoritmo multicritério
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAssetForScore(null)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pillars Progress Bars */}
            <div className="space-y-3 p-4 rounded-2xl bg-muted/20 border border-border/60">
              <h4 className="text-xs font-black text-foreground uppercase tracking-wider">Detalhamento dos Pilares</h4>
              <div className="space-y-3">
                {selectedAssetForScore.pillars.map((pillar, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-foreground">{pillar.name} (Peso {pillar.weightPct}%)</span>
                      <span className="text-foreground">{pillar.score.toFixed(0)} / 100</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pillar.score}%`,
                          backgroundColor: getScoreColor(selectedAssetForScore.totalScore)
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{pillar.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Strengths & Alerts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <h5 className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Pontos Fortes ({selectedAssetForScore.strengths.length})
                </h5>
                <ul className="space-y-1 text-xs text-foreground">
                  {selectedAssetForScore.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                  {selectedAssetForScore.strengths.length === 0 && (
                    <li className="text-xs text-muted-foreground">Nenhum ponto de destaque registrado.</li>
                  )}
                </ul>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                <h5 className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Pontos de Atenção ({selectedAssetForScore.warnings.length})
                </h5>
                <ul className="space-y-1 text-xs text-foreground">
                  {selectedAssetForScore.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                  {selectedAssetForScore.warnings.length === 0 && (
                    <li className="text-xs text-muted-foreground">Nenhum alerta crítico nos fundamentos.</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedAssetForScore(null)}
                className="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-xl text-xs font-bold hover:bg-secondary/80 transition-all"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Configure Weights of Score Pillars */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-foreground flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-primary" />
                  Ajustar Pesos do Motor de Score
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Personalize a importância de cada critério na nota de 0 a 100
                </p>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stocks Weights */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Pesos para Ações</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-muted-foreground font-bold block mb-1">Qualidade (ROE/Margem): {stockWeights.quality}%</label>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={stockWeights.quality}
                    onChange={(e) => setStockWeights(prev => ({ ...prev, quality: Number(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground font-bold block mb-1">Valuation (P/L, P/VP): {stockWeights.valuation}%</label>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={stockWeights.valuation}
                    onChange={(e) => setStockWeights(prev => ({ ...prev, valuation: Number(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground font-bold block mb-1">Dívida / Solvência: {stockWeights.debt}%</label>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={stockWeights.debt}
                    onChange={(e) => setStockWeights(prev => ({ ...prev, debt: Number(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground font-bold block mb-1">Dividendos (DY): {stockWeights.dividends}%</label>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={stockWeights.dividends}
                    onChange={(e) => setStockWeights(prev => ({ ...prev, dividends: Number(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>

            {/* FIIs Weights */}
            <div className="space-y-3 pt-4 border-t border-border/50">
              <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Pesos para FIIs</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-muted-foreground font-bold block mb-1">Rendimentos / DY: {fiiWeights.yields}%</label>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={fiiWeights.yields}
                    onChange={(e) => setFiiWeights(prev => ({ ...prev, yields: Number(e.target.value) }))}
                    className="w-full accent-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground font-bold block mb-1">Valuation P/VP: {fiiWeights.valuation}%</label>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={fiiWeights.valuation}
                    onChange={(e) => setFiiWeights(prev => ({ ...prev, valuation: Number(e.target.value) }))}
                    className="w-full accent-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground font-bold block mb-1">Ocupação / Vacância: {fiiWeights.vacancy}%</label>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={fiiWeights.vacancy}
                    onChange={(e) => setFiiWeights(prev => ({ ...prev, vacancy: Number(e.target.value) }))}
                    className="w-full accent-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground font-bold block mb-1">Diversificação: {fiiWeights.diversification}%</label>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={fiiWeights.diversification}
                    onChange={(e) => setFiiWeights(prev => ({ ...prev, diversification: Number(e.target.value) }))}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStockWeights(DEFAULT_STOCK_WEIGHTS);
                  setFiiWeights(DEFAULT_FII_WEIGHTS);
                }}
                className="flex-1 py-2.5 bg-muted/40 hover:bg-muted text-foreground rounded-xl text-xs font-bold transition-all border border-border/60"
              >
                Restaurar Padrão
              </button>
              <button
                onClick={() => setShowConfigModal(false)}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-black transition-all shadow-md hover:bg-primary/90"
              >
                Salvar Pesos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Import Fundamentus Modal */}
      <FundamentusImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={async (items, source) => {
          return await bulkUpsertAssetsMetadata(items, source);
        }}
      />

      {/* 9. Manual Asset Create/Edit Modal */}
      <ManualAssetModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        initialData={editingAssetData}
        onSave={async (data, source) => {
          await saveAssetMetadata(data, source);
        }}
      />
    </div>
  );
};
