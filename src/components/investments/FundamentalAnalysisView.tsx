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

  // Strategy & View State
  const [rankingMethod, setRankingMethod] = useState<RankingMethod>('score_b3');
  const [activeTypeTab, setActiveTypeTab] = useState<'all' | 'Ação' | 'FII'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [onlyPortfolio, setOnlyPortfolio] = useState<boolean>(false);
  const [selectedAssetForScore, setSelectedAssetForScore] = useState<AssetScoreResult | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Deferred search query to avoid lag on fast typing
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Pagination State (Solves DOM Lag Completely)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Custom Sorting State
  const [sortField, setSortField] = useState<string>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals for Import & Manual Create/Edit
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingAssetData, setEditingAssetData] = useState<any | null>(null);

  // Custom Score Weights state
  const [stockWeights, setStockWeights] = useState<StockScoreWeights>(DEFAULT_STOCK_WEIGHTS);
  const [fiiWeights, setFiiWeights] = useState<FiiScoreWeights>(DEFAULT_FII_WEIGHTS);

  // Filters State
  const [minRoe, setMinRoe] = useState<number>(0);
  const [maxPl, setMaxPl] = useState<number>(100);
  const [maxDebtEbitda, setMaxDebtEbitda] = useState<number>(5.0);
  const [minDy, setMinDy] = useState<number>(0);
  const [maxVacancy, setMaxVacancy] = useState<number>(50);
  const [maxPvpFii, setMaxPvpFii] = useState<number>(1.5);

  // Reset all filters
  const handleResetFilters = () => {
    setMinRoe(0);
    setMaxPl(100);
    setMaxDebtEbitda(5.0);
    setMinDy(0);
    setMaxVacancy(50);
    setMaxPvpFii(1.5);
    setSearchQuery('');
    setSelectedSector('all');
    setOnlyPortfolio(false);
    setCurrentPage(1);
    toast.info('Filtros restaurados para o padrão.');
  };

  // Apply method preset
  const handleApplyMethodPreset = (method: RankingMethod) => {
    setRankingMethod(method);
    setCurrentPage(1);

    if (method === 'barsi_bazin') {
      setMinDy(6);
      setMinRoe(8);
      setMaxDebtEbitda(3.5);
      toast.success('Método Barsi/Bazin ativado: Filtro DY >= 6% e dívida equilibrada.');
    } else if (method === 'graham') {
      setMaxPl(15);
      setMinRoe(10);
      toast.success('Fórmula de Graham ativada: Filtro P/L <= 15 e ROE >= 10%.');
    } else if (method === 'greenblatt') {
      setActiveTypeTab('Ação');
      setMinRoe(12);
      toast.success('Magic Formula de Greenblatt ativada: Ranks de ROIC e P/L.');
    } else if (method === 'fii_quality') {
      setActiveTypeTab('FII');
      setMaxVacancy(15);
      setMaxPvpFii(1.15);
      setMinDy(7);
      toast.success('FIIs High Quality ativado: Vacância < 15% e P/VP justo.');
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

  // Extract unique Sectors / Segments for Filter Dropdown
  const availableSectors = useMemo(() => {
    const sectors = new Set<string>();
    baseComputedAssets.forEach(item => {
      const sec = item.fund.type === 'Ação' 
        ? item.fund.sector 
        : item.fund.fiiSegment;
      if (sec && sec !== 'Outros' && sec !== 'Geral') {
        sectors.add(sec);
      }
    });
    return Array.from(sectors).sort();
  }, [baseComputedAssets]);

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

      // Stock Filters
      if (item.fund.type === 'Ação') {
        const sf = item.fund as B3StockFundamental;
        if (minRoe > 0 && sf.roe < minRoe) return false;
        if (maxPl < 100 && sf.pl > maxPl) return false;
        if (maxDebtEbitda < 5.0 && sf.sector !== 'Financeiro' && sf.netDebtOverEbitda > maxDebtEbitda) return false;
        if (minDy > 0 && sf.dividendYield < minDy) return false;
      }

      // FII Filters
      if (item.fund.type === 'FII') {
        const ff = item.fund as B3FiiFundamental;
        if (minDy > 0 && ff.dividendYield < minDy) return false;
        if (maxVacancy < 50 && ff.fiiType === 'Tijolo' && ff.physicalVacancy > maxVacancy) return false;
        if (maxPvpFii < 1.5 && ff.pvp > maxPvpFii) return false;
      }

      return true;
    });

    // Ranking Logic according to selected methodology
    result.sort((a, b) => {
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

      // Custom Sorting
      let valA: any = a.score.totalScore;
      let valB: any = b.score.totalScore;

      if (sortField === 'ticker') { valA = a.ticker; valB = b.ticker; }
      else if (sortField === 'price') { valA = a.quote; valB = b.quote; }
      else if (sortField === 'pvp') { valA = a.fund.pvp; valB = b.fund.pvp; }
      else if (sortField === 'dy') { valA = a.fund.dividendYield; valB = b.fund.dividendYield; }
      else if (sortField === 'pl') { valA = (a.fund as B3StockFundamental).pl || 0; valB = (b.fund as B3StockFundamental).pl || 0; }
      else if (sortField === 'roe') { valA = (a.fund as B3StockFundamental).roe || 0; valB = (b.fund as B3StockFundamental).roe || 0; }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [
    baseComputedAssets, 
    activeTypeTab, 
    onlyPortfolio, 
    selectedSector, 
    deferredSearchQuery, 
    minRoe, 
    maxPl, 
    maxDebtEbitda, 
    minDy, 
    maxVacancy, 
    maxPvpFii, 
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
      {/* 1. Header & Quick Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border/80 p-5 rounded-3xl shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground flex items-center gap-2">
                Análise Fundamentalista B3 & Raking de Valuation
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {baseComputedAssets.length} Ativos Base
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Otimizado para alta performance. Filtre e ranqueie por Barsi, Graham, Greenblatt ou Score B3.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Class Switcher Tabs */}
          <div className="flex items-center bg-muted/40 p-1 rounded-2xl border border-border/60 text-xs font-bold">
            <button
              onClick={() => { setActiveTypeTab('all'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTypeTab === 'all' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Todos ({baseComputedAssets.length})
            </button>
            <button
              onClick={() => { setActiveTypeTab('Ação'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTypeTab === 'Ação' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Ações ({baseComputedAssets.filter(a => a.fund.type === 'Ação').length})
            </button>
            <button
              onClick={() => { setActiveTypeTab('FII'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTypeTab === 'FII' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              FIIs ({baseComputedAssets.filter(a => a.fund.type === 'FII').length})
            </button>
          </div>

          {/* Freshness Status Indicator */}
          {importFreshness.status !== 'empty' && (
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              importFreshness.isStale 
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' 
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>Base B3: {importFreshness.label}</span>
            </div>
          )}

          {/* Action: Import Fundamentus */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-black border border-emerald-500/20 transition-all shadow-xs cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            Importar Fundamentus
          </button>

          {/* Action: Manual Asset */}
          <button
            onClick={() => {
              setEditingAssetData(null);
              setIsManualModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-black transition-all shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            Novo Ativo
          </button>

          {/* Config Score Weights Button */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground rounded-xl text-xs font-bold border border-border/60 transition-all"
            title="Ajustar pesos dos pilares do Score B3"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Pesos
          </button>
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
      <div className="bg-card border border-border/80 p-5 rounded-3xl space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
              Metodologia de Seleção & Ranking
            </h4>
          </div>
          <span className="text-[11px] font-bold text-muted-foreground">
            Ordenando por: <strong className="text-primary font-black uppercase">{rankingMethod.replace('_', ' ')}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Method 1: Score B3 */}
          <button
            onClick={() => handleApplyMethodPreset('score_b3')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              rankingMethod === 'score_b3'
                ? 'bg-primary/10 border-primary text-foreground shadow-xs ring-1 ring-primary/30'
                : 'bg-muted/20 border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Crown className={`w-4 h-4 ${rankingMethod === 'score_b3' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Score</span>
            </div>
            <div>
              <p className="text-xs font-black">Score B3</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Multicritério Ponderado</p>
            </div>
          </button>

          {/* Method 2: Barsi / Bazin */}
          <button
            onClick={() => handleApplyMethodPreset('barsi_bazin')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              rankingMethod === 'barsi_bazin'
                ? 'bg-emerald-500/10 border-emerald-500 text-foreground shadow-xs ring-1 ring-emerald-500/30'
                : 'bg-muted/20 border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Coins className={`w-4 h-4 ${rankingMethod === 'barsi_bazin' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Teto 6%</span>
            </div>
            <div>
              <p className="text-xs font-black">Barsi & Bazin</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Margem Teto Dividendos</p>
            </div>
          </button>

          {/* Method 3: Graham */}
          <button
            onClick={() => handleApplyMethodPreset('graham')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              rankingMethod === 'graham'
                ? 'bg-blue-500/10 border-blue-500 text-foreground shadow-xs ring-1 ring-blue-500/30'
                : 'bg-muted/20 border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <ShieldCheck className={`w-4 h-4 ${rankingMethod === 'graham' ? 'text-blue-500' : 'text-muted-foreground'}`} />
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">Intrínseco</span>
            </div>
            <div>
              <p className="text-xs font-black">Benjamin Graham</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Valor Intrínseco VI</p>
            </div>
          </button>

          {/* Method 4: Greenblatt Magic Formula */}
          <button
            onClick={() => handleApplyMethodPreset('greenblatt')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              rankingMethod === 'greenblatt'
                ? 'bg-purple-500/10 border-purple-500 text-foreground shadow-xs ring-1 ring-purple-500/30'
                : 'bg-muted/20 border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Zap className={`w-4 h-4 ${rankingMethod === 'greenblatt' ? 'text-purple-500' : 'text-muted-foreground'}`} />
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">Magic</span>
            </div>
            <div>
              <p className="text-xs font-black">Magic Formula</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">ROIC + P/L (Greenblatt)</p>
            </div>
          </button>

          {/* Method 5: FII High Quality */}
          <button
            onClick={() => handleApplyMethodPreset('fii_quality')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              rankingMethod === 'fii_quality'
                ? 'bg-sky-500/10 border-sky-500 text-foreground shadow-xs ring-1 ring-sky-500/30'
                : 'bg-muted/20 border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Building2 className={`w-4 h-4 ${rankingMethod === 'fii_quality' ? 'text-sky-500' : 'text-muted-foreground'}`} />
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400">FIIs</span>
            </div>
            <div>
              <p className="text-xs font-black">FII High Quality</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Vacância & Yield Ponderado</p>
            </div>
          </button>

          {/* Method 6: Custom / All */}
          <button
            onClick={() => { setRankingMethod('custom'); setCurrentPage(1); }}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              rankingMethod === 'custom'
                ? 'bg-amber-500/10 border-amber-500 text-foreground shadow-xs ring-1 ring-amber-500/30'
                : 'bg-muted/20 border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <SlidersHorizontal className={`w-4 h-4 ${rankingMethod === 'custom' ? 'text-amber-500' : 'text-muted-foreground'}`} />
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Custom</span>
            </div>
            <div>
              <p className="text-xs font-black">Personalizado</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Filtro e Ordenação Livre</p>
            </div>
          </button>
        </div>

        {/* Method Description Banner */}
        <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/50 text-xs text-muted-foreground flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-primary shrink-0" />
            <span>
              {rankingMethod === 'score_b3' && 'Classifica os ativos calculando a nota de 0 a 100 com base na combinação de Qualidade, Valuation, Solvência e Dividendos.'}
              {rankingMethod === 'barsi_bazin' && 'Calcula o Preço Teto Barsi (Provento 12M / 6%). O ranking coloca no topo os ativos com maior Margem de Segurança contra o Preço Teto.'}
              {rankingMethod === 'graham' && 'Aplica a Fórmula de Benjamin Graham (VI = √(22.5 × LPA × VPA)). Destaca os ativos com maior desconto percentual em relação ao Valor Intrínseco.'}
              {rankingMethod === 'greenblatt' && 'Combina o Ranking de Qualidade (ROIC) e o Ranking de Valuation (P/L). Menor pontuação somada = Empresa de excelente qualidade por preço de pechincha.'}
              {rankingMethod === 'fii_quality' && 'Avalia Fundos Imobiliários cruzando Vacância Baixa, P/VP justo e DY/FFO Yield elevado.'}
              {rankingMethod === 'custom' && 'Utilize os sliders e filtros abaixo para buscar ativos com especificações exatas de ROE, P/L, Dívida, Vacância e DY.'}
            </span>
          </div>

          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-rose-500 transition-colors shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar Filtros
          </button>
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

      {/* 4. Filter Bar */}
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

          {/* Only Portfolio Switch */}
          <div className="md:col-span-3 flex items-center justify-end">
            <label className="flex items-center gap-2 text-xs text-foreground font-bold cursor-pointer select-none bg-muted/20 px-3.5 py-2.5 rounded-2xl border border-border/60 w-full md:w-auto justify-center">
              <input
                type="checkbox"
                checked={onlyPortfolio}
                onChange={(e) => { setOnlyPortfolio(e.target.checked); setCurrentPage(1); }}
                className="w-4 h-4 rounded text-primary focus:ring-0"
              />
              Apenas Minha Carteira
            </label>
          </div>
        </div>

        {/* Fundamental Filter Sliders - ONLY rendered when Ranking Method is 'custom' */}
        {rankingMethod === 'custom' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-border/40 text-xs animate-in fade-in duration-150">
            {/* Min ROE */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">ROE Mín: {minRoe}%</label>
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

            {/* Max P/L */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">P/L Máx: {maxPl === 100 ? 'Livre' : `${maxPl}x`}</label>
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
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Dív./EBITDA: {maxDebtEbitda === 5.0 ? 'Livre' : `${maxDebtEbitda}x`}</label>
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

            {/* Min DY */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">DY Mín: {minDy}%</label>
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

            {/* Max Vacancy (FIIs) */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Vacância Máx: {maxVacancy === 50 ? 'Livre' : `${maxVacancy}%`}</label>
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
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">P/VP FII Máx: {maxPvpFii === 1.5 ? 'Livre' : `${maxPvpFii}x`}</label>
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
                  <th className="px-4 py-3.5 text-center w-12"># Rank</th>
                  <th className="px-4 py-3.5">Ativo / Ticker</th>
                  <th className="px-4 py-3.5 text-center">Score B3</th>
                  <th className="px-4 py-3.5 text-right">Cotação</th>
                  <th className="px-4 py-3.5 text-right">P/VP</th>
                  <th className="px-4 py-3.5 text-right">DY 12M</th>

                  {/* Dynamic Method Metric Column */}
                  {rankingMethod === 'barsi_bazin' && (
                    <th className="px-4 py-3.5 text-right text-emerald-600 font-black">Preço Teto Barsi (Margem)</th>
                  )}
                  {rankingMethod === 'graham' && (
                    <th className="px-4 py-3.5 text-right text-blue-600 font-black">Valor Intrínseco VI (Desconto)</th>
                  )}
                  {rankingMethod === 'greenblatt' && (
                    <th className="px-4 py-3.5 text-center text-purple-600 font-black">Magic Rank (ROIC + P/L)</th>
                  )}
                  {(rankingMethod === 'score_b3' || rankingMethod === 'fii_quality' || rankingMethod === 'custom') && (
                    <>
                      <th className="px-4 py-3.5 text-right">P/L ou FFO</th>
                      <th className="px-4 py-3.5 text-right">ROE / Vacância</th>
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
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            isStock 
                              ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' 
                              : 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                          }`}>
                            {item.ticker.slice(0, 4)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-foreground">{item.ticker}</span>
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
                            onClick={() => onOpenRaioX && onOpenRaioX(item.ticker)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
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

          {/* Table Footer with Pagination Controls */}
          <div className="p-4 bg-muted/20 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-muted-foreground font-bold">
              Mostrando <strong className="text-foreground">{(currentPageClamped - 1) * pageSize + 1}</strong> a <strong className="text-foreground">{Math.min(currentPageClamped * pageSize, filteredAssets.length)}</strong> de <strong className="text-foreground">{filteredAssets.length}</strong> ativos filtrados ({baseComputedAssets.length} total)
            </div>

            <div className="flex items-center gap-3">
              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5 text-muted-foreground font-bold">
                <span>Itens por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-card border border-border/60 rounded-xl px-2 py-1 text-xs text-foreground focus:outline-none"
                >
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                </select>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPageClamped === 1}
                  className="p-1.5 rounded-xl border border-border/60 bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-foreground transition-all"
                  title="Página Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-3 py-1 font-black text-foreground">
                  {currentPageClamped} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPageClamped >= totalPages}
                  className="p-1.5 rounded-xl border border-border/60 bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-foreground transition-all"
                  title="Próxima Página"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
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
