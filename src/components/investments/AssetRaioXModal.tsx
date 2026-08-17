import React, { useState, useMemo } from 'react';
import { InvestmentTransaction, Dividend } from '../../types';
import { CvmDocumentButton } from '../CvmDocumentButton';
import { calculateAssetDividendProjection } from '../../lib/investmentCalculations';
import { getAssetCnpj, formatCnpj } from '../../lib/cnpjUtils';
import { useData } from '../../contexts/DataContext';
import { toast } from 'sonner';
import { 
  Info, 
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
  Calendar, 
  Briefcase,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Percent,
  Layers,
  Sparkles,
  PieChart as PieIcon,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Building2,
  History,
  Scale
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
  analysisMode = 'received_only'
}: AssetRaioXModalProps) {
  const { settings, valuationTargets } = useData();
  const [activeTab, setActiveTab] = useState<'geral' | 'proventos' | 'valuation' | 'historico'>('geral');
  const [copiedCnpj, setCopiedCnpj] = useState(false);

  const cleanTicker = position.ticker.toUpperCase().trim();
  const cnpj = getAssetCnpj(cleanTicker, settings);
  const savedValuation = valuationTargets[cleanTicker];

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

  // Comprehensive calculations from dedicated investment calculation engine
  const projection = useMemo(() => {
    return calculateAssetDividendProjection(
      position.ticker,
      position.type,
      position.totalQuantity,
      position.totalInvested,
      position.averagePrice,
      position.currentPrice,
      dividends,
      analysisMode,
      savedValuation
    );
  }, [position, dividends, analysisMode, savedValuation]);

  const curVal = position.currentValue || (position.currentPrice ? position.currentPrice * position.totalQuantity : position.totalInvested);
  const capitalGainR$ = position.currentPrice ? (curVal - position.totalInvested) : 0;
  const capitalGainPct = position.totalInvested > 0 && position.currentPrice 
    ? ((curVal - position.totalInvested) / position.totalInvested) * 100 
    : 0;
  const realizedGainR$ = position.realizedGain || 0;
  const totalReturnR$ = capitalGainR$ + realizedGainR$ + projection.totalDividendsConsidered;
  const totalReturnPct = position.totalInvested > 0 ? (totalReturnR$ / position.totalInvested) * 100 : 0;

  // Comparison between current market price and average purchase price
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-border/70 bg-card shadow-2xl overflow-hidden">
        
        {/* HEADER SECTION */}
        <div className="p-5 sm:p-6 border-b border-border/50 bg-gradient-to-r from-card via-card to-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Asset Identity */}
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-indigo-500/10 text-primary flex items-center justify-center font-black text-base tracking-wider border border-primary/20 shadow-xs shrink-0">
                {position.ticker.slice(0, 4)}
              </div>
              
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{position.ticker}</h2>
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-secondary text-secondary-foreground uppercase tracking-wide border border-border/40">
                    {position.type}
                  </span>
                  
                  {projection.projectedDividendYield > 0 && (
                    <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      DY Proj. {projection.projectedDividendYield.toFixed(2)}% a.a.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium mt-1 flex-wrap">
                  <span>{position.totalQuantity} cotas em custódia</span>
                  {cnpj && (
                    <button
                      onClick={handleCopyCnpj}
                      className="flex items-center gap-1 hover:text-foreground transition-colors font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted/40"
                      title="Copiar CNPJ"
                    >
                      <span>CNPJ: {formatCnpj(cnpj)}</span>
                      {copiedCnpj ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Price & Close Button */}
            <div className="flex items-center gap-3 self-end sm:self-center">
              <div className="text-right">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cotação Atual</p>
                <p className="text-xl font-black text-primary tracking-tight">
                  {position.currentPrice ? formatCurrency(position.currentPrice) : formatCurrency(position.averagePrice)}
                </p>
                <div className={`text-[11px] font-bold flex items-center justify-end gap-0.5 ${priceVsAverageDiff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {priceVsAverageDiff >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {priceVsAverageDiff >= 0 ? '+' : ''}{priceVsAverageDiff.toFixed(2)}% vs PM
                </div>
              </div>

              <button 
                onClick={onClose}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-xl transition-all ml-1 cursor-pointer"
                title="Fechar Raio-X"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* QUICK ACTION BUTTONS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 mt-4 border-t border-border/40">
            <button
              onClick={() => {
                onClose();
                onOpenAddModal(position.ticker, 'buy', position.type);
              }}
              className="py-2 px-3 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Novo Aporte
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenAddModal(position.ticker, 'sell', position.type);
              }}
              className="py-2 px-3 text-xs font-bold rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <MinusCircle className="w-3.5 h-3.5" />
              Lançar Venda
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenAddDivModal(position.ticker);
              }}
              className="py-2 px-3 text-xs font-bold rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Lançar Provento
            </button>

            <button
              onClick={() => {
                onClose();
                onSelectAnalytics(position.ticker);
              }}
              className="py-2 px-3 text-xs font-bold rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all flex items-center justify-center gap-1.5 border border-border/40 cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5 text-indigo-500" />
              Preço Teto
            </button>
          </div>
        </div>

        {/* TAB NAVIGATION BAR */}
        <div className="flex items-center gap-1 px-5 sm:px-6 pt-3 border-b border-border/50 bg-muted/20 overflow-x-auto">
          <button
            onClick={() => setActiveTab('geral')}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'geral'
                ? 'border-primary text-primary bg-card shadow-xs'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Visão Geral & Posição
          </button>

          <button
            onClick={() => setActiveTab('proventos')}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'proventos'
                ? 'border-primary text-primary bg-card shadow-xs'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-amber-500" />
            Proventos & Renda ({assetDivs.length})
          </button>

          <button
            onClick={() => setActiveTab('valuation')}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'valuation'
                ? 'border-primary text-primary bg-card shadow-xs'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-indigo-500" />
            Valuation & Preço Teto
          </button>

          <button
            onClick={() => setActiveTab('historico')}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'historico'
                ? 'border-primary text-primary bg-card shadow-xs'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="w-3.5 h-3.5 text-sky-500" />
            Lançamentos ({assetTxs.length})
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">

          {/* TAB 1: VISÃO GERAL */}
          {activeTab === 'geral' && (
            <div className="space-y-6">
              
              {/* PRIMARY STATS 4-COLUMN CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cotas Custodiadas</p>
                  <p className="text-xl font-black text-foreground">{position.totalQuantity}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Unidades em carteira</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Preço Médio (PM)</p>
                  <p className="text-xl font-black text-foreground">{formatCurrency(position.averagePrice)}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Custo unitário ponderado</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Investido</p>
                  <p className="text-xl font-black text-foreground">{formatCurrency(position.totalInvested)}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Capital alocado</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Patrimônio Atual</p>
                  <p className="text-xl font-black text-primary">{formatCurrency(curVal)}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Valor a mercado</p>
                </div>
              </div>

              {/* RENTABILIDADE & RETORNO TOTAL COMBINADO */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                
                {/* 1. Ganho Não Realizado */}
                <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ganho Não Realizado</span>
                    {capitalGainR$ >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-rose-500" />}
                  </div>
                  <p className={`text-2xl font-black ${capitalGainR$ >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatCurrency(capitalGainR$)}
                  </p>
                  <div className="text-xs font-bold text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
                    <span>Variação da Cota:</span>
                    <span className={capitalGainPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                      {formatPercent(capitalGainPct)}
                    </span>
                  </div>
                </div>

                {/* 2. Proventos & Renda */}
                <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Proventos Considerados</span>
                    <DollarSign className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-2xl font-black text-amber-500">
                    {formatCurrency(projection.totalDividendsConsidered)}
                  </p>
                  <div className="text-xs font-bold text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
                    <span>Yield on Cost (YoC):</span>
                    <span className="text-amber-500">{formatPercent(projection.historicalYieldOnCost)}</span>
                  </div>
                </div>

                {/* 3. Retorno Total Combinado */}
                <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lucro / Retorno Total</span>
                    <Award className="w-4 h-4 text-primary" />
                  </div>
                  <p className={`text-2xl font-black ${totalReturnR$ >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatCurrency(totalReturnR$)}
                  </p>
                  <div className="text-xs font-bold text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
                    <span>Rentabilidade Total:</span>
                    <span className={totalReturnPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                      {formatPercent(totalReturnPct)}
                    </span>
                  </div>
                </div>
              </div>

              {/* BARRA COMPARATIVA: PREÇO MÉDIO vs COTAÇÃO ATUAL */}
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-primary" />
                    Custo Médio vs. Valor de Mercado
                  </span>
                  <span className={priceVsAverageDiff >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                    {priceVsAverageDiff >= 0 ? 'Valorizado (Ágio)' : 'Desvalorizado (Deságio)'}: {formatPercent(priceVsAverageDiff)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 rounded-xl bg-card border border-border/40">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Preço Médio de Compra</p>
                    <p className="text-base font-black text-foreground">{formatCurrency(position.averagePrice)}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-card border border-border/40">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Cotação Atual de Mercado</p>
                    <p className="text-base font-black text-primary">
                      {position.currentPrice ? formatCurrency(position.currentPrice) : formatCurrency(position.averagePrice)}
                    </p>
                  </div>
                </div>
              </div>

              {/* HIGHLIGHT DA RENDA PROJETADA */}
              {projection.projectedAnnualIncome > 0 && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-foreground flex items-center gap-1.5">
                        Renda Anual Projetada deste Ativo
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                          {projection.projectedDividendYield.toFixed(2)}% a.a.
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Estimativa de <strong className="text-foreground">{formatCurrency(projection.projectedAnnualIncome)}/ano</strong> (~{formatCurrency(projection.projectedMonthlyIncome)}/mês) para {position.totalQuantity} cotas.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('proventos')}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    Ver Detalhes dos Proventos
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* DOCUMENTOS CVM */}
              <CvmDocumentButton ticker={position.ticker} variant="full" />
            </div>
          )}

          {/* TAB 2: PROVENTOS & RENDA PROJETADA */}
          {activeTab === 'proventos' && (
            <div className="space-y-6">
              
              {/* SUMMARY METRICS OF PROJECTED YIELD & RUN-RATE */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">DY Projetado (12M)</p>
                  <p className="text-xl font-black text-amber-600 dark:text-amber-400">
                    {projection.projectedDividendYield > 0 ? `${projection.projectedDividendYield.toFixed(2)}% a.a.` : '0,00%'}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium">Sobre cotação atual</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Renda Anual Estimada</p>
                  <p className="text-xl font-black text-foreground">{formatCurrency(projection.projectedAnnualIncome)}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">~{formatCurrency(projection.projectedMonthlyIncome)}/mês</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Yield on Cost (YoC)</p>
                  <p className="text-xl font-black text-foreground">{formatPercent(projection.historicalYieldOnCost)}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Sobre seu custo médio</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">DPA Projetado (12M)</p>
                  <p className="text-xl font-black text-foreground">{formatCurrency(projection.projectedAnnualDividendPerShare)}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Por cota / ano</p>
                </div>
              </div>

              {/* PAYBACK ESTIMATE & FREQUENCY */}
              <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Tempo de Retorno (Payback por Proventos) & Regularidade
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-muted/20 border border-border/40">
                    <p className="text-[10px] text-muted-foreground font-bold">Frequência de Pagamento Estimada</p>
                    <p className="text-base font-black text-foreground">{projection.paymentFrequency}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{projection.dividendCount} proventos registrados</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/20 border border-border/40">
                    <p className="text-[10px] text-muted-foreground font-bold">Payback do Investimento (Renda Passiva)</p>
                    <p className="text-base font-black text-foreground">
                      {projection.paybackYears ? `~${projection.paybackYears.toFixed(1)} anos` : 'Indisponível'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Tempo para recuperar o custo inicial</p>
                  </div>
                </div>
              </div>

              {/* LIST OF RECORDED DIVIDENDS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    Histórico de Proventos de {position.ticker} ({assetDivs.length})
                  </h3>
                  
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAddDivModal(position.ticker);
                    }}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    + Adicionar Provento
                  </button>
                </div>

                {assetDivs.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-border/60 bg-muted/10 space-y-2">
                    <DollarSign className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs font-bold text-muted-foreground">Nenhum provento cadastrado para {position.ticker}.</p>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenAddDivModal(position.ticker);
                      }}
                      className="mt-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all inline-flex items-center gap-1 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Lançar Primeiro Provento
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-muted/40 text-[10px] font-bold text-muted-foreground uppercase border-b border-border/40">
                        <tr>
                          <th className="px-3.5 py-2.5">Data Pagamento</th>
                          <th className="px-3.5 py-2.5">Data COM</th>
                          <th className="px-3.5 py-2.5">Tipo</th>
                          <th className="px-3.5 py-2.5">Status</th>
                          <th className="px-3.5 py-2.5 text-right">Por Cota</th>
                          <th className="px-3.5 py-2.5 text-right">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30 font-medium">
                        {assetDivs.map(div => {
                          const unitVal = div.unit_amount || (position.totalQuantity > 0 ? (div.amount / position.totalQuantity) : 0);
                          return (
                            <tr key={div.id} className="hover:bg-muted/20 transition-colors">
                              <td className="px-3.5 py-2.5 text-foreground font-semibold">
                                {new Date(div.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                              </td>
                              <td className="px-3.5 py-2.5 text-muted-foreground">
                                {div.data_com ? new Date(div.data_com + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                              </td>
                              <td className="px-3.5 py-2.5">
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground uppercase">
                                  {div.type}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 w-fit ${
                                  div.status === 'received' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                }`}>
                                  {div.status === 'received' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                  {div.status === 'received' ? 'Recebido' : 'Provisionado'}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-right text-muted-foreground font-mono">
                                {formatCurrency(unitVal)}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(div.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: VALUATION & PREÇO TETO */}
          {activeTab === 'valuation' && (
            <div className="space-y-6">
              
              {/* TOP HEADER / STATUS OF VALUATION */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted/20 border border-border/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-foreground">Modelos de Valuation & Preço Teto</h4>
                      {projection.isCustomValuation ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Salvo na Calculadora
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                          Padrão Automático
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {projection.isCustomValuation 
                        ? 'Utilizando os parâmetros e projeções customizados salvos na Calculadora de Preço Teto.'
                        : 'Utilizando dados automáticos de proventos. Salve parâmetros na Calculadora para análises avançadas (Graham, Gordon, P/VP).'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    onSelectAnalytics(position.ticker);
                  }}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <Calculator className="w-4 h-4" />
                  {projection.isCustomValuation ? 'Editar no Preço Teto' : 'Configurar Calculadora'}
                </button>
              </div>

              {/* DÉCIO BAZIN CEILING PRICE CARD */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-card via-card to-indigo-500/5 border border-border/70 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-foreground">
                        Método Décio Bazin (DY Alvo: {projection.bazinTargetYield.toFixed(1)}%)
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Fórmula: Preço Teto = DPA / ({projection.bazinTargetYield / 100})
                      </p>
                    </div>
                  </div>

                  {projection.bazinCeilingPrice > 0 && (
                    <span className={`text-xs font-black px-2.5 py-1 rounded-xl flex items-center gap-1 ${
                      projection.bazinMarginOfSafety >= 0 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}>
                      {projection.bazinMarginOfSafety >= 0 ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                      Margem: {formatPercent(projection.bazinMarginOfSafety)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">DPA Base / 12M</p>
                    <p className="text-lg font-black text-foreground">
                      {formatCurrency(projection.bazinDPA > 0 ? projection.bazinDPA : projection.projectedAnnualDividendPerShare)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {projection.bazinDPA > 0 ? 'DPA salvo na calculadora' : 'Proventos / cota em 12M'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold uppercase">Preço Teto Bazin</p>
                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                      {projection.bazinCeilingPrice > 0 ? formatCurrency(projection.bazinCeilingPrice) : 'Indisponível'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Preço máx. para {projection.bazinTargetYield.toFixed(1)}% DY</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Cotação Atual de Mercado</p>
                    <p className="text-lg font-black text-primary">
                      {position.currentPrice ? formatCurrency(position.currentPrice) : formatCurrency(position.averagePrice)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {projection.bazinDiscount >= 0 
                        ? `Desconto de ${formatCurrency(projection.bazinDiscount)}/cota`
                        : `Acima do teto em ${formatCurrency(Math.abs(projection.bazinDiscount))}/cota`}
                    </p>
                  </div>
                </div>
              </div>

              {/* ADDITIONAL SAVED MODELS (GRAHAM, P/VP, GORDON, P/L) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* GRAHAM MODEL CARD */}
                <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                        <Award className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-foreground">Fórmula de Benjamin Graham</h5>
                        <p className="text-[10px] text-muted-foreground">√(22,5 × LPA × VPA)</p>
                      </div>
                    </div>
                    {projection.grahamCeilingPrice > 0 && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-0.5 ${
                        projection.grahamMarginOfSafety >= 0 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}>
                        {formatPercent(projection.grahamMarginOfSafety)}
                      </span>
                    )}
                  </div>

                  {projection.grahamCeilingPrice > 0 ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Preço Justo Graham</p>
                        <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(projection.grahamCeilingPrice)}
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          LPA: {formatCurrency(projection.grahamLPA)} • VPA: {formatCurrency(projection.grahamVPA)}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Margem vs Cotação</p>
                        <p className={`text-base font-black ${projection.grahamDiscount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {projection.grahamDiscount >= 0 ? '+' : ''}{formatCurrency(projection.grahamDiscount)}
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          {projection.grahamDiscount >= 0 ? 'Desconto por cota' : 'Ágio sobre o justo'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-muted/10 border border-dashed border-border/50 text-center">
                      <p className="text-xs text-muted-foreground font-medium">Parâmetros LPA / VPA não salvos.</p>
                      <button
                        onClick={() => {
                          onClose();
                          onSelectAnalytics(position.ticker);
                        }}
                        className="text-[11px] font-bold text-primary hover:underline mt-1 cursor-pointer"
                      >
                        Informar LPA e VPA na Calculadora →
                      </button>
                    </div>
                  )}
                </div>

                {/* P/VP TARGET MODEL CARD */}
                <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-500">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-foreground">Preço Teto por P/VP Alvo</h5>
                        <p className="text-[10px] text-muted-foreground">VPA × P/VP Alvo</p>
                      </div>
                    </div>
                    {projection.pvpCeilingPrice > 0 && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-0.5 ${
                        projection.pvpMarginOfSafety >= 0 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}>
                        {formatPercent(projection.pvpMarginOfSafety)}
                      </span>
                    )}
                  </div>

                  {projection.pvpCeilingPrice > 0 ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Preço Teto (P/VP {projection.pvpTarget}x)</p>
                        <p className="text-base font-black text-teal-600 dark:text-teal-400">
                          {formatCurrency(projection.pvpCeilingPrice)}
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          VPA base: {formatCurrency(projection.grahamVPA)}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Diferença vs VP</p>
                        <p className="text-base font-black text-foreground">
                          {formatCurrency(projection.pvpDiff)}
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          Cotação vs Patrimônio Líquido
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-muted/10 border border-dashed border-border/50 text-center">
                      <p className="text-xs text-muted-foreground font-medium">VPA ou P/VP Alvo não configurados.</p>
                      <button
                        onClick={() => {
                          onClose();
                          onSelectAnalytics(position.ticker);
                        }}
                        className="text-[11px] font-bold text-primary hover:underline mt-1 cursor-pointer"
                      >
                        Configurar P/VP Alvo →
                      </button>
                    </div>
                  )}
                </div>

                {/* GORDON GROWTH MODEL CARD */}
                <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-foreground">Modelo de Gordon (Crescimento)</h5>
                        <p className="text-[10px] text-muted-foreground">D1 / (k - g)</p>
                      </div>
                    </div>
                    {projection.gordonCeilingPrice > 0 && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-0.5 ${
                        projection.gordonMarginOfSafety >= 0 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}>
                        {formatPercent(projection.gordonMarginOfSafety)}
                      </span>
                    )}
                  </div>

                  {projection.gordonCeilingPrice > 0 ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Preço Teto Gordon</p>
                        <p className="text-base font-black text-purple-600 dark:text-purple-400">
                          {formatCurrency(projection.gordonCeilingPrice)}
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          D1: {formatCurrency(projection.gordonD1)}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Taxas (k / g)</p>
                        <p className="text-base font-black text-foreground">
                          {projection.gordonK}% / {projection.gordonG}%
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          Retorno / Crescimento
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-muted/10 border border-dashed border-border/50 text-center">
                      <p className="text-xs text-muted-foreground font-medium">Parâmetros D1, k ou g não definidos.</p>
                      <button
                        onClick={() => {
                          onClose();
                          onSelectAnalytics(position.ticker);
                        }}
                        className="text-[11px] font-bold text-primary hover:underline mt-1 cursor-pointer"
                      >
                        Simular Gordon na Calculadora →
                      </button>
                    </div>
                  )}
                </div>

                {/* P/L TARGET MODEL CARD */}
                <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-foreground">Preço Teto por P/L Alvo</h5>
                        <p className="text-[10px] text-muted-foreground">LPA × P/L Alvo</p>
                      </div>
                    </div>
                    {projection.plCeilingPrice > 0 && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-0.5 ${
                        projection.plMarginOfSafety >= 0 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}>
                        {formatPercent(projection.plMarginOfSafety)}
                      </span>
                    )}
                  </div>

                  {projection.plCeilingPrice > 0 ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Preço Teto (P/L {projection.plTarget}x)</p>
                        <p className="text-base font-black text-amber-600 dark:text-amber-400">
                          {formatCurrency(projection.plCeilingPrice)}
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          LPA base: {formatCurrency(projection.grahamLPA)}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase">Margem de Segurança</p>
                        <p className={`text-base font-black ${projection.plMarginOfSafety >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {formatPercent(projection.plMarginOfSafety)}
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          vs Cotação Atual
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-muted/10 border border-dashed border-border/50 text-center">
                      <p className="text-xs text-muted-foreground font-medium">LPA ou P/L Alvo não configurados.</p>
                      <button
                        onClick={() => {
                          onClose();
                          onSelectAnalytics(position.ticker);
                        }}
                        className="text-[11px] font-bold text-primary hover:underline mt-1 cursor-pointer"
                      >
                        Configurar P/L Alvo →
                      </button>
                    </div>
                  )}
                </div>

              </div>

              {/* OFFICIAL CVM / FNET REPORT HUB */}
              <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-primary" />
                  Documentos Oficiais CVM & FNET
                </h4>
                <p className="text-xs text-muted-foreground">
                  Acesse relatórios gerenciais, fatos relevantes, comunicados ao mercado e demonstrações financeiras publicadas pela administradora/empresa na CVM.
                </p>
                <CvmDocumentButton ticker={position.ticker} variant="full" />
              </div>
            </div>
          )}

          {/* TAB 4: HISTÓRICO DE LANÇAMENTOS */}
          {activeTab === 'historico' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Histórico de Compras e Vendas ({assetTxs.length})
                </h3>

                <button
                  onClick={() => {
                    onClose();
                    onOpenAddModal(position.ticker, 'buy');
                  }}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  + Novo Lançamento
                </button>
              </div>

              {assetTxs.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-border/60 bg-muted/10 space-y-2">
                  <Briefcase className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-bold text-muted-foreground">Nenhuma transação individual encontrada.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-muted/40 text-[10px] font-bold text-muted-foreground uppercase border-b border-border/40">
                      <tr>
                        <th className="px-3.5 py-2.5">Data</th>
                        <th className="px-3.5 py-2.5">Operação</th>
                        <th className="px-3.5 py-2.5 text-right">Qtd</th>
                        <th className="px-3.5 py-2.5 text-right">Preço Unit.</th>
                        <th className="px-3.5 py-2.5 text-right">Taxas/Custos</th>
                        <th className="px-3.5 py-2.5 text-right">Total</th>
                        <th className="px-3.5 py-2.5 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 font-medium">
                      {assetTxs.map(tx => (
                        <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-3.5 py-2.5 text-foreground font-semibold">
                            {new Date(tx.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              tx.operation === 'buy' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}>
                              {tx.operation === 'buy' ? 'Compra' : 'Venda'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-bold">{tx.quantity}</td>
                          <td className="px-3.5 py-2.5 text-right text-muted-foreground">{formatCurrency(tx.price)}</td>
                          <td className="px-3.5 py-2.5 text-right text-muted-foreground">
                            {tx.costs ? formatCurrency(tx.costs) : '-'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-black text-foreground">{formatCurrency(tx.amount)}</td>
                          <td className="px-3.5 py-2.5 text-center space-x-1">
                            <button
                              onClick={() => {
                                onClose();
                                onEditTx(tx);
                              }}
                              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors cursor-pointer"
                              title="Editar Lançamento"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                onClose();
                                onDeleteTx(tx);
                              }}
                              className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Excluir Lançamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
