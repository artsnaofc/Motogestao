import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { InvestmentTransaction, Dividend } from '../../types';
import { CvmDocumentButton } from '../CvmDocumentButton';
import { calculateAssetDividendProjection } from '../../lib/investmentCalculations';
import { getAssetCnpj, formatCnpj } from '../../lib/cnpjUtils';
import { useData } from '../../contexts/DataContext';
import { useInvestments } from '../../contexts/InvestmentsContext';
import { getB3AssetFundamental, B3StockFundamental, B3FiiFundamental } from '../../lib/b3Fundamentals';
import { calculateUniversalAssetScore, getScoreColor } from '../../lib/scoringEngine';
import { toast } from 'sonner';
import { 
  X, 
  PlusCircle, 
  MinusCircle,
  DollarSign, 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Award, 
  Edit3, 
  Trash2, 
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Percent,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  History,
  Scale,
  Wallet,
  Building2
} from 'lucide-react';

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
  realizedGain?: number;
}

interface AssetRaioXModalProps {
  position: Position;
  transactions: InvestmentTransaction[];
  dividends: Dividend[];
  onClose: () => void;
  onOpenAddModal: (ticker: string, initialOp?: 'buy' | 'sell', assetType?: string) => void;
  onOpenAddDivModal: (ticker: string) => void;
  onSelectAnalytics: (ticker: string) => void;
  onEditTx: (tx: InvestmentTransaction) => void;
  onDeleteTx: (tx: InvestmentTransaction) => void;
  formatCurrency: (val: number) => string;
  formatPercent: (val: number) => string;
  analysisMode?: 'received_only' | 'include_provisioned';
  initialTab?: 'geral' | 'proventos' | 'historico' | 'fundamentos';
}

export function AssetRaioXModal({
  position,
  transactions,
  dividends,
  onClose,
  onOpenAddModal,
  onOpenAddDivModal,
  onSelectAnalytics,
  onEditTx,
  onDeleteTx,
  formatCurrency,
  formatPercent,
  analysisMode = 'received_only',
  initialTab = 'geral'
}: AssetRaioXModalProps) {
  const { settings } = useData();
  const { b3AssetsMetadata, loadAssetHistory } = useInvestments();
  const [activeTab, setActiveTab] = useState<'geral' | 'proventos' | 'historico' | 'fundamentos'>(initialTab);
  const [copiedCnpj, setCopiedCnpj] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const cleanTicker = position.ticker.toUpperCase().trim();
  const cnpj = getAssetCnpj(cleanTicker, settings);

  const fundamental = useMemo(() => {
    return getB3AssetFundamental(
      cleanTicker,
      position.type,
      position.currentPrice || position.averagePrice || 10,
      b3AssetsMetadata
    );
  }, [cleanTicker, position.type, position.currentPrice, position.averagePrice, b3AssetsMetadata]);

  const scoreResult = useMemo(() => {
    return calculateUniversalAssetScore(fundamental);
  }, [fundamental]);

  React.useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const data = await loadAssetHistory(cleanTicker);
        if (isMounted) {
          setHistoryRecords(data || []);
        }
      } catch (err) {
        console.error('Error fetching asset history:', err);
      } finally {
        if (isMounted) setIsLoadingHistory(false);
      }
    };
    fetchHistory();
    return () => { isMounted = false; };
  }, [cleanTicker, loadAssetHistory]);

  const assetTxs = useMemo(() => {
    return transactions
      .filter(t => t.ticker.toUpperCase() === cleanTicker)
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
  }, [transactions, cleanTicker]);

  const assetDivs = useMemo(() => {
    return dividends
      .filter(d => d.ticker.toUpperCase() === cleanTicker)
      .sort((a, b) => {
        const dateA = a.data_ex || a.date;
        const dateB = b.data_ex || b.date;
        return dateB.localeCompare(dateA);
      });
  }, [dividends, cleanTicker]);

  const projection = useMemo(() => {
    return calculateAssetDividendProjection(
      position.ticker,
      position.type,
      position.totalQuantity,
      position.totalInvested,
      position.averagePrice,
      position.currentPrice,
      dividends,
      analysisMode
    );
  }, [position, dividends, analysisMode]);

  const curVal = position.currentValue || (position.currentPrice ? position.currentPrice * position.totalQuantity : position.totalInvested);
  const capitalGainR$ = position.currentPrice ? (curVal - position.totalInvested) : 0;
  const capitalGainPct = position.totalInvested > 0 && position.currentPrice 
    ? ((curVal - position.totalInvested) / position.totalInvested) * 100 
    : 0;
  const realizedGainR$ = position.realizedGain || 0;
  const totalReturnR$ = capitalGainR$ + realizedGainR$ + projection.totalDividendsConsidered;
  const totalReturnPct = position.totalInvested > 0 ? (totalReturnR$ / position.totalInvested) * 100 : 0;

  const priceVsAverageDiff = position.currentPrice && position.averagePrice > 0 
    ? ((position.currentPrice - position.averagePrice) / position.averagePrice) * 100 
    : 0;

  const handleCopyCnpj = () => {
    if (!cnpj) return;
    navigator.clipboard.writeText(cnpj);
    setCopiedCnpj(true);
    toast.success('CNPJ copiado para a área de transferência!');
    setTimeout(() => setCopiedCnpj(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl sm:rounded-[2.5rem] border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden relative"
        >
          {/* HEADER SECTION */}
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-[1.2rem] bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-black text-lg sm:text-xl tracking-wider border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.1)] shrink-0">
                  {position.ticker.slice(0, 4)}
                </div>
                
                <div className="min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tighter text-white truncate">{position.ticker}</h2>
                    <span className="text-[8px] sm:text-[9px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg bg-slate-800 text-slate-400 uppercase tracking-widest border border-slate-700">
                      {position.type}
                    </span>
                    
                    {projection.projectedDividendYield > 0 && (
                      <div className="text-[8px] sm:text-[9px] font-black px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-md sm:rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 sm:gap-1.5 uppercase tracking-widest animate-pulse">
                        <Sparkles className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                        DY Proj. {projection.projectedDividendYield.toFixed(2)}%
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4 text-[8px] sm:text-[10px] text-slate-500 font-black mt-1 sm:mt-1.5 flex-wrap uppercase tracking-widest">
                    <span className="flex items-center gap-1 sm:gap-1.5 bg-slate-800/50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg">
                      <Briefcase className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-indigo-400" />
                      {position.totalQuantity} <span className="hidden sm:inline">cotas</span><span className="sm:hidden">un.</span>
                    </span>
                    {cnpj && (
                      <button
                        onClick={handleCopyCnpj}
                        className="flex items-center gap-1 sm:gap-1.5 hover:text-white transition-all font-mono px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg bg-slate-800/50 group border border-transparent hover:border-slate-700"
                      >
                        <span className="text-slate-500 group-hover:text-slate-300">CNPJ: {formatCnpj(cnpj)}</span>
                        {copiedCnpj ? <Check className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-emerald-500" /> : <Copy className="w-3 sm:w-3.5 h-3 sm:h-3.5 opacity-50 group-hover:opacity-100" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-4 sm:gap-6">
                <div className="text-left md:text-right">
                  <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5 sm:mb-1">Cotação Atual</p>
                  <p className="text-xl sm:text-2xl font-black text-white tracking-tighter leading-none">
                    {position.currentPrice ? formatCurrency(position.currentPrice) : formatCurrency(position.averagePrice)}
                  </p>
                  <div className={`text-[9px] sm:text-[10px] font-black flex items-center md:justify-end gap-1 mt-1 ${priceVsAverageDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {priceVsAverageDiff >= 0 ? <ArrowUpRight className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> : <ArrowDownRight className="w-3 sm:w-3.5 h-3 sm:h-3.5" />}
                    {priceVsAverageDiff >= 0 ? '+' : ''}{priceVsAverageDiff.toFixed(2)}% <span className="hidden sm:inline">vs PM</span>
                  </div>
                </div>

                <button 
                  onClick={onClose}
                  className="p-2 sm:p-3 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg sm:rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-700 active:scale-95"
                >
                  <X className="w-5 sm:w-6 h-5 sm:h-6" />
                </button>
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
              {[
                { label: 'Novo Aporte', icon: PlusCircle, color: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20', action: () => { onClose(); onOpenAddModal(position.ticker, 'buy', position.type); } },
                { label: 'Lançar Venda', icon: MinusCircle, color: 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700', action: () => { onClose(); onOpenAddModal(position.ticker, 'sell', position.type); } },
                { label: 'Lançar Provento', icon: DollarSign, color: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20', action: () => { onClose(); onOpenAddDivModal(position.ticker); } },
              ].map((btn, i) => (
                <button
                  key={i}
                  onClick={btn.action}
                  className={`py-2 px-3 text-[9px] font-black rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer uppercase tracking-[0.1em] ${btn.color}`}
                >
                  <btn.icon className="w-3.5 h-3.5" />
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* NAVIGATION */}
          <div className="sticky top-0 z-30 flex items-center gap-2 px-4 sm:px-6 bg-slate-900 border-b border-slate-800 overflow-x-auto no-scrollbar scroll-smooth shadow-lg">
            {[
              { id: 'geral', label: 'Dashboard', icon: Briefcase, color: 'text-indigo-400' },
              { id: 'proventos', label: 'Dividendos', icon: DollarSign, color: 'text-emerald-400', count: assetDivs.length },
              { id: 'historico', label: 'Transações', icon: History, color: 'text-sky-400', count: assetTxs.length },
              { id: 'fundamentos', label: 'Fundamentos', icon: Award, color: 'text-amber-400' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 sm:px-5 py-3 text-[10px] sm:text-xs font-black transition-all border-b-2 flex items-center gap-2.5 whitespace-nowrap uppercase tracking-[0.12em] cursor-pointer group relative ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : 'text-slate-600 group-hover:text-slate-500'}`} />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                    activeTab === tab.id ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 bg-indigo-500/[0.03] -z-10"
                  />
                )}
              </button>
            ))}
          </div>

          {/* CONTENT */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-900 custom-scrollbar relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: 'circOut' }}
              >
                {activeTab === 'geral' && (
                  <div className="space-y-6">
                    {/* STATS CARDS */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                      {[
                        { label: 'Investimento', val: formatCurrency(position.totalInvested), sub: `${position.totalQuantity} cotas`, icon: Wallet },
                        { label: 'Patrimônio', val: formatCurrency(curVal), sub: `Valor a mercado`, icon: Building2, highlight: true },
                        { label: 'Preço Médio', val: formatCurrency(position.averagePrice), sub: 'Custo ponderado', icon: Scale },
                        { label: 'Cotação', val: position.currentPrice ? formatCurrency(position.currentPrice) : '-', sub: 'Último registro', icon: TrendingUp },
                      ].map((stat, i) => (
                        <div key={i} className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-800/30 border border-slate-800/50 space-y-1 sm:space-y-1.5 hover:border-slate-700 transition-colors">
                          <div className="flex items-center justify-between">
                            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</p>
                            <stat.icon className={`w-3 sm:w-3.5 h-3 sm:h-3.5 ${stat.highlight ? 'text-indigo-400' : 'text-slate-600'}`} />
                          </div>
                          <p className={`text-base sm:text-lg font-black ${stat.highlight ? 'text-white' : 'text-slate-200'}`}>{stat.val}</p>
                          <p className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-tighter">{stat.sub}</p>
                        </div>
                      ))}
                    </div>

                    {/* RETURN CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                      <div className="p-4 sm:p-6 rounded-2xl bg-slate-800/20 border border-slate-800 space-y-2 sm:space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Ganho de Capital</span>
                          <TrendingUp className={`w-3.5 sm:w-4 h-3.5 sm:h-4 ${capitalGainR$ >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
                        </div>
                        <p className={`text-xl sm:text-2xl font-black tracking-tighter ${capitalGainR$ >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatCurrency(capitalGainR$)}
                        </p>
                        <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-slate-800">
                          <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase">Rentabilidade</span>
                          <span className={`text-[10px] sm:text-xs font-black ${capitalGainPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatPercent(capitalGainPct)}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 sm:p-6 rounded-2xl bg-slate-800/20 border border-slate-800 space-y-2 sm:space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Dividendos</span>
                          <DollarSign className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-amber-400" />
                        </div>
                        <p className="text-xl sm:text-2xl font-black text-amber-400 tracking-tighter">
                          {formatCurrency(projection.totalDividendsConsidered)}
                        </p>
                        <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-slate-800">
                          <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase">Yield on Cost</span>
                          <span className="text-[10px] sm:text-xs font-black text-amber-400">{formatPercent(projection.historicalYieldOnCost)}</span>
                        </div>
                      </div>

                      <div className="p-4 sm:p-6 rounded-2xl bg-indigo-500/[0.03] border border-indigo-500/20 space-y-2 sm:space-y-3 shadow-[inset_0_0_40px_rgba(99,102,241,0.05)]">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] sm:text-[10px] font-black text-indigo-400 uppercase tracking-widest">Retorno Total</span>
                          <Award className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-indigo-400" />
                        </div>
                        <p className={`text-xl sm:text-2xl font-black tracking-tighter ${totalReturnR$ >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatCurrency(totalReturnR$)}
                        </p>
                        <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-slate-800">
                          <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase">Total Acumulado</span>
                          <span className={`text-[10px] sm:text-xs font-black ${totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatPercent(totalReturnPct)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* PROJECTION BANNER */}
                    {projection.projectedAnnualIncome > 0 && (
                      <div className="p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-900 shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 sm:p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                          <Sparkles className="w-24 sm:w-32 h-24 sm:h-32 text-white" />
                        </div>
                        
                        <div className="relative z-10 space-y-4 sm:space-y-6">
                          <div className="space-y-1">
                            <h4 className="text-lg sm:text-xl font-black text-white tracking-tight">Renda Passiva Projetada</h4>
                            <p className="text-indigo-100/70 text-[10px] sm:text-xs font-medium max-w-lg">
                              Estimativa baseada no histórico de 12 meses e sua custódia atual.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                            <div className="space-y-0.5">
                              <p className="text-[8px] sm:text-[9px] font-black text-indigo-200 uppercase tracking-[0.2em]">Anual</p>
                              <p className="text-lg sm:text-xl font-black text-white">{formatCurrency(projection.projectedAnnualIncome)}</p>
                            </div>
                            <div className="space-y-0.5 border-l border-white/10 pl-4 sm:pl-6">
                              <p className="text-[8px] sm:text-[9px] font-black text-indigo-200 uppercase tracking-[0.2em]">Mensal</p>
                              <p className="text-lg sm:text-xl font-black text-white">{formatCurrency(projection.projectedMonthlyIncome)}</p>
                            </div>
                            <div className="hidden sm:block space-y-0.5 border-l border-white/10 pl-6">
                              <p className="text-[8px] sm:text-[9px] font-black text-indigo-200 uppercase tracking-[0.2em]">Yield</p>
                              <p className="text-lg sm:text-xl font-black text-emerald-400">{projection.projectedDividendYield.toFixed(2)}%</p>
                            </div>
                          </div>

                          <button 
                            onClick={() => setActiveTab('proventos')}
                            className="px-5 sm:px-6 py-2 sm:py-2.5 bg-white text-indigo-600 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg sm:rounded-xl hover:bg-indigo-50 transition-all flex items-center gap-2"
                          >
                            Análise
                            <ArrowUpRight className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    <CvmDocumentButton ticker={position.ticker} variant="full" />
                  </div>
                )}

                {activeTab === 'proventos' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                      <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-1 sm:space-y-1.5">
                        <p className="text-[8px] sm:text-[9px] font-black text-emerald-400 uppercase tracking-widest">Yield Projetado</p>
                        <p className="text-lg sm:text-xl font-black text-emerald-400 tracking-tighter">
                          {projection.projectedDividendYield.toFixed(2)}%
                        </p>
                        <p className="text-[8px] sm:text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Nos últimos 12M</p>
                      </div>

                      <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-800/30 border border-slate-800/50 space-y-1 sm:space-y-1.5">
                        <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">Renda Estimada</p>
                        <p className="text-lg sm:text-xl font-black text-white tracking-tighter">{formatCurrency(projection.projectedAnnualIncome)}</p>
                        <p className="text-[8px] sm:text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Próximos 12 meses</p>
                      </div>

                      <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-800/30 border border-slate-800/50 space-y-1 sm:space-y-1.5">
                        <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">Frequência</p>
                        <p className="text-lg sm:text-xl font-black text-white tracking-tighter">{projection.paymentFrequency}</p>
                        <p className="text-[8px] sm:text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Histórico regular</p>
                      </div>

                      <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-800/30 border border-slate-800/50 space-y-1 sm:space-y-1.5">
                        <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">Recebidos</p>
                        <p className="text-lg sm:text-xl font-black text-white tracking-tighter">{projection.dividendCount}</p>
                        <p className="text-[8px] sm:text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Total de pagamentos</p>
                      </div>
                    </div>

                    <div className="space-y-4 sm:space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h3 className="text-[10px] sm:text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 sm:gap-3">
                          <DollarSign className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400" />
                          Histórico de Proventos
                        </h3>
                        
                        <button
                          onClick={() => { onClose(); onOpenAddDivModal(position.ticker); }}
                          className="px-4 sm:px-5 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg sm:rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2"
                        >
                          <PlusCircle className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                          Adicionar Provento
                        </button>
                      </div>

                      {assetDivs.length === 0 ? (
                        <div className="p-10 sm:p-16 text-center rounded-3xl sm:rounded-[3rem] border-2 border-dashed border-slate-800 bg-slate-800/10 space-y-4">
                          <DollarSign className="w-12 sm:w-16 h-12 sm:h-16 text-slate-700 mx-auto" />
                          <p className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-widest">Nenhum provento cadastrado.</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl sm:rounded-[2.5rem] border border-slate-800 bg-slate-900/50 overflow-hidden">
                          <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left text-[10px] sm:text-xs whitespace-nowrap">
                              <thead className="bg-slate-800/50 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase border-b border-slate-800">
                                <tr>
                                  <th className="px-4 sm:px-8 py-3 sm:py-5">Data Pagamento</th>
                                  <th className="px-4 sm:px-8 py-3 sm:py-5 text-center">Tipo</th>
                                  <th className="px-4 sm:px-8 py-3 sm:py-5">Status</th>
                                  <th className="px-4 sm:px-8 py-3 sm:py-5 text-right">Por Cota</th>
                                  <th className="px-4 sm:px-8 py-3 sm:py-5 text-right">Total Bruto</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800 font-bold">
                                {assetDivs.map(div => {
                                  const unitVal = div.unit_amount || (position.totalQuantity > 0 ? (div.amount / position.totalQuantity) : 0);
                                  return (
                                    <tr key={div.id} className="hover:bg-slate-800/30 transition-colors group">
                                      <td className="px-4 sm:px-8 py-3 sm:py-5 text-white font-black">
                                        {new Date(div.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                      </td>
                                      <td className="px-4 sm:px-8 py-3 sm:py-5 text-center">
                                        <span className="text-[8px] sm:text-[9px] font-black px-2 sm:px-3 py-1 rounded-md sm:rounded-lg bg-slate-800 text-slate-400 uppercase border border-slate-700">
                                          {div.type}
                                        </span>
                                      </td>
                                      <td className="px-4 sm:px-8 py-3 sm:py-5">
                                        <span className={`text-[8px] sm:text-[9px] font-black px-2 sm:px-3 py-1 rounded-md sm:rounded-lg uppercase flex items-center gap-1.5 sm:gap-2 w-fit ${
                                          div.status === 'received' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        }`}>
                                          {div.status === 'received' ? <CheckCircle2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> : <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4" />}
                                          {div.status === 'received' ? 'Recebido' : 'Provisionado'}
                                        </span>
                                      </td>
                                      <td className="px-4 sm:px-8 py-3 sm:py-5 text-right text-slate-500 font-mono">
                                        {formatCurrency(unitVal)}
                                      </td>
                                      <td className="px-4 sm:px-8 py-3 sm:py-5 text-right font-black text-emerald-400">
                                        {formatCurrency(div.amount)}
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
                  </div>
                )}

                {activeTab === 'historico' && (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h3 className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <History className="w-4 sm:w-5 h-4 sm:h-5 text-sky-400" />
                        Histórico de Lançamentos
                      </h3>

                      <button
                        onClick={() => { onClose(); onOpenAddModal(position.ticker, 'buy'); }}
                        className="px-4 sm:px-5 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg sm:rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <PlusCircle className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                        Novo Lançamento
                      </button>
                    </div>

                    <div className="rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                      <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left text-[9px] sm:text-[11px] whitespace-nowrap">
                          <thead className="bg-slate-800/50 text-[8px] sm:text-[9px] font-black text-slate-500 uppercase border-b border-slate-800">
                            <tr>
                              <th className="px-4 sm:px-6 py-2 sm:py-3">Data</th>
                              <th className="px-4 sm:px-6 py-2 sm:py-3 text-center">Operação</th>
                              <th className="px-4 sm:px-6 py-2 sm:py-3 text-right">Qtd</th>
                              <th className="px-4 sm:px-6 py-2 sm:py-3 text-right">Preço Unit.</th>
                              <th className="px-4 sm:px-6 py-2 sm:py-3 text-right">Total</th>
                              <th className="px-4 sm:px-6 py-2 sm:py-3 text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 font-bold">
                            {assetTxs.map(tx => (
                              <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors group">
                                <td className="px-4 sm:px-6 py-2 sm:py-3 text-white font-black">
                                  {new Date(tx.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                </td>
                                <td className="px-4 sm:px-6 py-2 sm:py-3 text-center">
                                  <span className={`text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded-md uppercase border ${
                                    tx.operation === 'buy' 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  }`}>
                                    {tx.operation === 'buy' ? 'Compra' : 'Venda'}
                                  </span>
                                </td>
                                <td className="px-4 sm:px-6 py-2 sm:py-3 text-right text-white font-black">{tx.quantity}</td>
                                <td className="px-4 sm:px-6 py-2 sm:py-3 text-right text-slate-500">{formatCurrency(tx.price)}</td>
                                <td className="px-4 sm:px-6 py-2 sm:py-3 text-right font-black text-white">{formatCurrency(tx.amount)}</td>
                                <td className="px-4 sm:px-6 py-2 sm:py-3 text-center">
                                  <div className="flex items-center justify-center gap-1 sm:gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => { onClose(); onEditTx(tx); }}
                                      className="p-1.5 sm:p-2 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded-md sm:rounded-lg transition-all"
                                    >
                                      <Edit3 className="w-3.5 sm:w-4 h-3.5 sm:w-4" />
                                    </button>
                                    <button
                                      onClick={() => { onClose(); onDeleteTx(tx); }}
                                      className="p-1.5 sm:p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-md sm:rounded-lg transition-all"
                                    >
                                      <Trash2 className="w-3.5 sm:w-4 h-3.5 sm:w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'fundamentos' && (
                  <div className="space-y-5 sm:space-y-8">
                    {/* SCORE CARD */}
                    <div className="p-5 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700/50 shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                        <Award className="w-32 sm:w-48 h-32 sm:h-48 text-white" />
                      </div>

                      <div className="relative z-10 flex flex-col lg:flex-row items-center gap-6 sm:gap-10">
                        <div className="relative">
                          <div 
                            className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center shadow-xl border-2 sm:border-3"
                            style={{
                              backgroundColor: `${getScoreColor(scoreResult.totalScore)}15`,
                              borderColor: `${getScoreColor(scoreResult.totalScore)}40`,
                              color: getScoreColor(scoreResult.totalScore)
                            }}
                          >
                            <span className="text-3xl sm:text-5xl font-black tracking-tighter">{scoreResult.totalScore}</span>
                            <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] opacity-70">PONTOS</span>
                          </div>
                          <div 
                            className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-1 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] shadow-xl border border-white/10 whitespace-nowrap"
                            style={{
                              backgroundColor: getScoreColor(scoreResult.totalScore),
                              color: '#fff'
                            }}
                          >
                            {scoreResult.grade}
                          </div>
                        </div>

                        <div className="flex-1 space-y-4 sm:space-y-6 w-full text-center lg:text-left">
                          <div>
                            <h4 className="text-xl sm:text-2xl font-black text-white tracking-tighter">Score B3 & Qualidade</h4>
                            <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-1 max-w-xl mx-auto lg:mx-0">
                              Algoritmo de avaliação de rentabilidade e saúde financeira.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                            {scoreResult.pillars.map((pillar, i) => (
                              <div key={i} className="space-y-1.5 sm:space-y-2">
                                <div className="flex justify-between text-[7px] sm:text-[9px] font-black uppercase tracking-widest text-slate-500">
                                  <span>{pillar.name}</span>
                                  <span className="text-white">{pillar.score.toFixed(0)}</span>
                                </div>
                                <div className="h-1 sm:h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pillar.score}%` }}
                                    transition={{ duration: 1, delay: i * 0.1 }}
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: getScoreColor(scoreResult.totalScore) }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* INDICATORS GRID */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                      {fundamental.type === 'Ação' ? (
                        <>
                          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-800/30 border border-slate-800 space-y-0.5 sm:space-y-1">
                            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">P/L</p>
                            <p className="text-lg sm:text-xl font-black text-white tracking-tighter">
                              {(fundamental as B3StockFundamental).pl ? `${(fundamental as B3StockFundamental).pl.toFixed(1)}x` : '-'}
                            </p>
                          </div>
                          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-800/30 border border-slate-800 space-y-0.5 sm:space-y-1">
                            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">P/VP</p>
                            <p className="text-lg sm:text-xl font-black text-white tracking-tighter">{fundamental.pvp ? fundamental.pvp.toFixed(2) : '-'}</p>
                          </div>
                          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-800/30 border border-slate-800 space-y-0.5 sm:space-y-1">
                            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">Margem Líq.</p>
                            <p className="text-lg sm:text-xl font-black text-white">{(fundamental as B3StockFundamental).netMargin?.toFixed(1)}%</p>
                          </div>
                          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-800/30 border border-slate-800 space-y-0.5 sm:space-y-1">
                            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">ROE</p>
                            <p className="text-lg sm:text-xl font-black text-emerald-400">{(fundamental as B3StockFundamental).roe?.toFixed(1)}%</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-800/30 border border-slate-800 space-y-0.5 sm:space-y-1">
                            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">P/VP</p>
                            <p className="text-lg sm:text-xl font-black text-white tracking-tighter">{fundamental.pvp ? fundamental.pvp.toFixed(2) : '-'}</p>
                          </div>
                          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-800/30 border border-slate-800 space-y-0.5 sm:space-y-1">
                            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">DY 12M</p>
                            <p className="text-lg sm:text-xl font-black text-emerald-400">{fundamental.dividendYield ? `${fundamental.dividendYield.toFixed(1)}%` : '-'}</p>
                          </div>
                          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-800/30 border border-slate-800 space-y-0.5 sm:space-y-1">
                            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">Vacância</p>
                            <p className="text-lg sm:text-xl font-black text-rose-400">{(fundamental as B3FiiFundamental).physicalVacancy?.toFixed(1)}%</p>
                          </div>
                          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-800/30 border border-slate-800 space-y-0.5 sm:space-y-1">
                            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest">Ativos</p>
                            <p className="text-lg sm:text-xl font-black text-white">{(fundamental as B3FiiFundamental).propertiesCount || '-'}</p>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-emerald-500/5 border border-emerald-500/10 space-y-3 sm:space-y-4">
                        <h5 className="text-[9px] sm:text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                          <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5" />
                          Fortalezas
                        </h5>
                        <div className="space-y-2 sm:space-y-3">
                          {scoreResult.strengths.map((s, i) => (
                            <div key={i} className="flex items-start gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-bold text-slate-300">
                              <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-emerald-500 mt-1 sm:mt-1.5 shrink-0" />
                              <p className="leading-relaxed">{s}</p>
                            </div>
                          ))}
                          {scoreResult.strengths.length === 0 && <p className="text-[10px] text-slate-600 italic">Nenhum ponto forte identificado.</p>}
                        </div>
                      </div>

                      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-amber-500/5 border border-amber-500/10 space-y-3 sm:space-y-4">
                        <h5 className="text-[9px] sm:text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                          <AlertTriangle className="w-4 sm:w-5 h-4 sm:h-5" />
                          Pontos de Atenção
                        </h5>
                        <div className="space-y-2 sm:space-y-3">
                          {scoreResult.warnings.map((w, i) => (
                            <div key={i} className="flex items-start gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-bold text-slate-300">
                              <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-amber-500 mt-1 sm:mt-1.5 shrink-0" />
                              <p className="leading-relaxed">{w}</p>
                            </div>
                          ))}
                          {scoreResult.warnings.length === 0 && <p className="text-[10px] text-slate-600 italic">Nenhum risco relevante identificado.</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
