import React, { useState, useMemo } from 'react';
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
  Check, 
  Zap,
  Info,
  DollarSign,
  HelpCircle,
  Target,
  AlertCircle,
  PlusCircle
} from 'lucide-react';
import { 
  simulatePortfolioContribution, 
  RebalanceStrategyType, 
  RebalanceRulesConfig, 
  AssetAllocationTarget, 
  DEFAULT_REBALANCE_RULES,
  PositionForRebalance,
  ContributionItemSuggestion,
  StrategyWeights
} from '../../lib/rebalanceEngine';
import { useInvestments } from '../../contexts/InvestmentsContext';
import { useData } from '../../contexts/DataContext';
import { toast } from 'sonner';
import { AddRebalanceAssetModal, CustomRebalanceAsset } from './AddRebalanceAssetModal';

interface ProfessionalRebalanceEngineViewProps {
  positions: any[];
  targets?: Record<string, AssetAllocationTarget>;
  targetAllocations?: Record<string, AssetAllocationTarget>;
  quotes?: Record<string, number>;
  valuationTargets?: Record<string, any>;
  rulesConfig?: RebalanceRulesConfig;
  onSaveTargets?: (newTargets: Record<string, AssetAllocationTarget>) => Promise<void>;
  onSaveRulesConfig?: (newConfig: RebalanceRulesConfig) => Promise<void>;
  onExecuteOrders?: (orders: Array<{ ticker: string; type: string; price: number; quantity: number; amount: number }>) => Promise<void>;
  onBatchBuy?: (orders: Array<{ ticker: string; type: string; price: number; quantity: number; amount: number }>) => Promise<void>;
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
  const { reserves, settings } = useData();
  const [contributionAmount, setContributionAmount] = useState<number>(0);
  const [hasSetInitialContribution, setHasSetInitialContribution] = useState(false);

  const invReserve = useMemo(() => {
    if (settings?.default_investment_reserve_id) {
      const found = reserves.find(r => r.id === settings.default_investment_reserve_id);
      if (found) return found;
    }
    // Fallback search by name (priority order)
    const keywords = ['reserva de investimento', 'investimento', 'apport', 'corretora', 'bolsa'];
    for (const kw of keywords) {
      const found = reserves.find(r => r.name.toLowerCase().includes(kw));
      if (found) return found;
    }
    return reserves.find(r => (r.saldo_atual || 0) > 0);
  }, [reserves, settings?.default_investment_reserve_id]);

  // Sync initial contribution with Investment Reserve
  React.useEffect(() => {
    if (reserves.length > 0 && !hasSetInitialContribution) {
      if (invReserve && (invReserve.saldo_atual || 0) > 0) {
        setContributionAmount(invReserve.saldo_atual || 0);
        setHasSetInitialContribution(true);
      } else if (invReserve && invReserve.id) {
        // If we found a reserve but it has 0, still consider it "set"
        setHasSetInitialContribution(true);
      }
    }
  }, [reserves, hasSetInitialContribution, invReserve]);

  const invReserveBalance = useMemo(() => {
    return invReserve ? (invReserve.saldo_atual || 0) : 0;
  }, [invReserve]);

  const [activeStrategy, setActiveStrategy] = useState<RebalanceStrategyType>(initialRulesConfig?.activeStrategy || 'rebalance');
  const [rulesConfig, setRulesConfig] = useState<RebalanceRulesConfig>(initialRulesConfig || DEFAULT_REBALANCE_RULES);
  const [stockWeights, setStockWeights] = useState<any>(undefined);
  const [fiiWeights, setFiiWeights] = useState<any>(undefined);
  const [editableTargets, setEditableTargets] = useState<Record<string, AssetAllocationTarget>>(effectiveTargets);
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  
  // Load initial rules from ranking cache if available
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('b3_fundamental_filters_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        setRulesConfig(prev => ({
          ...prev,
          minDailyLiquidity: parsed.minLiquidity ? parsed.minLiquidity * 1000000 : prev.minDailyLiquidity,
          maxDebtEbitdaAllowed: parsed.maxDebtEbitda ?? prev.maxDebtEbitdaAllowed,
          maxFiiPvpAllowed: parsed.maxPvpFii ?? prev.maxFiiPvpAllowed,
          maxFiiPhysicalVacancyAllowed: parsed.maxVacancy ?? prev.maxFiiPhysicalVacancyAllowed,
        }));
        if (parsed.stockWeights) setStockWeights(parsed.stockWeights);
        if (parsed.fiiWeights) setFiiWeights(parsed.fiiWeights);
      }
    } catch (e) {
      console.warn('Failed to load ranking filters for rebalance engine:', e);
    }
  }, []);

  // Sync targets when incoming targets change
  React.useEffect(() => {
    setEditableTargets(effectiveTargets);
  }, [effectiveTargets]);

  // Normalize positions for rebalance engine
  const normalizedPositions: PositionForRebalance[] = useMemo(() => {
    const totalVal = positions.reduce((acc, p) => {
      const quote = quotes[p.ticker] || p.currentPrice || p.averagePrice || 0;
      const qty = p.totalQuantity ?? p.quantity ?? 0;
      return acc + (quote * qty);
    }, 0);

    return positions
      .filter(p => (p.totalQuantity ?? p.quantity ?? 0) > 0)
      .map(p => {
        const qty = p.totalQuantity ?? p.quantity ?? 0;
        const quote = quotes[p.ticker] || p.currentPrice || p.averagePrice || 0;
        const curVal = quote * qty;
        const curPct = totalVal > 0 ? (curVal / totalVal) * 100 : 0;
        return {
          ticker: p.ticker,
          type: p.type,
          quantity: qty,
          averagePrice: p.averagePrice ?? (p.totalInvested && qty > 0 ? p.totalInvested / qty : 0),
          currentPrice: quote,
          currentValue: curVal,
          currentPct: curPct
        };
      });
  }, [positions, quotes]);

  // Run Real-Time Rebalance Simulation
  const simulation = useMemo(() => {
    const activeRules: RebalanceRulesConfig = {
      ...rulesConfig,
      activeStrategy
    };
    return simulatePortfolioContribution(
      normalizedPositions,
      editableTargets,
      contributionAmount,
      activeRules,
      quotes,
      { ...b3AssetsMetadata, ...customMetadata },
      stockWeights,
      fiiWeights
    );
  }, [normalizedPositions, editableTargets, contributionAmount, activeStrategy, rulesConfig, quotes, b3AssetsMetadata, stockWeights, fiiWeights, customMetadata]);

  // Handle Save Targets
  const handleSaveTargetAllocations = async () => {
    try {
      if (onSaveTargets) {
        await onSaveTargets(editableTargets);
      }
      setIsEditingTargets(false);
      toast.success('Metas de alocação salvas com sucesso!');
    } catch (e) {
      toast.error('Erro ao salvar metas de alocação');
    }
  };

  // Handle Quick Execute Orders
  const handleExecuteContributionOrders = async () => {
    const ordersToExecute = simulation.suggestions
      .filter(s => s.suggestedQuantity > 0)
      .map(s => ({
        ticker: s.ticker,
        type: s.type,
        price: s.currentPrice,
        quantity: s.suggestedQuantity,
        amount: s.suggestedAmount
      }));

    if (ordersToExecute.length === 0) {
      toast.info('Nenhuma ordem de compra sugerida para o valor atual.');
      return;
    }

    setIsExecuting(true);
    try {
      if (onBatchBuy) {
        await onBatchBuy(ordersToExecute);
      } else if (onExecuteOrders) {
        await onExecuteOrders(ordersToExecute);
      }
      toast.success(`${ordersToExecute.length} ordens de aporte executadas com sucesso na carteira!`);
    } catch (err) {
      toast.error('Erro ao registrar ordens de aporte.');
    } finally {
      setIsExecuting(false);
    }
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
      } catch (err) {
        console.error('Failed to save lock status:', err);
      }
    }
  };

  const activeOrders = simulation.suggestions.filter(s => s.suggestedQuantity > 0);

  return (
    <div className="space-y-6">
      {/* 1. Header & Strategy Switcher */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400 shrink-0">
              <Scale className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Motor Inteligente de Aportes
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                  Smart Engine v2
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Algoritmo de otimização matemática focado em redução de desvio, qualidade fundamentalista e margem de segurança.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={() => setIsEditingTargets(true)}
              className="px-4 py-2.5 sm:py-2 rounded-xl text-xs font-black bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Target className="w-3.5 h-3.5" />
              Ajustar Metas
            </button>
            <button
              onClick={() => setIsEditingRules(true)}
              className="px-4 py-2.5 sm:py-2 rounded-xl text-xs font-black bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Configurar Filtros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-800/80">
          {[
            { id: 'rebalance', label: 'Rebalanceamento', icon: Scale, desc: 'Foco em equilibrar pesos', color: 'text-indigo-400' },
            { id: 'quality', label: 'Qualidade Máxima', icon: ShieldCheck, desc: 'Foco no Ranking de Ativos', color: 'text-emerald-400' },
            { id: 'valuation', label: 'Valuation & Desconto', icon: Sparkles, desc: 'P/VP e Preço Teto', color: 'text-amber-400' },
            { id: 'dividends', label: 'Renda Passiva', icon: Coins, desc: 'Foco em Dividend Yield', color: 'text-sky-400' },
            { id: 'diversification', label: 'Diversificação', icon: TrendingUp, desc: 'Diluição de riscos', color: 'text-pink-400' },
            { id: 'custom', label: 'Personalizado', icon: SlidersHorizontal, desc: 'Pesos customizados', color: 'text-purple-400' }
          ].map((strat) => (
            <button
              key={strat.id}
              onClick={() => setActiveStrategy(strat.id as RebalanceStrategyType)}
              className={`p-3 rounded-xl text-left border transition-all ${
                activeStrategy === strat.id 
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/50' 
                  : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <strat.icon className={`w-3.5 h-3.5 ${strat.color}`} />
                {strat.label}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{strat.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Custom Weights Editor */}
      {activeStrategy === 'custom' && (
        <div className="bg-slate-900 border border-purple-500/30 p-5 rounded-2xl shadow-xl space-y-4 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-purple-400" />
              <h4 className="text-sm font-black text-white uppercase tracking-tight">Pesos da Estratégia Personalizada</h4>
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
              Total: {Object.values(rulesConfig.customWeights).reduce((a, b) => a + b, 0)}%
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { label: 'Gap de Alocação', key: 'gapWeight', color: 'bg-indigo-500' },
              { label: 'Qualidade (Score)', key: 'qualityWeight', color: 'bg-emerald-500' },
              { label: 'Valuation', key: 'valuationWeight', color: 'bg-amber-500' },
              { label: 'Dividendos', key: 'dividendWeight', color: 'bg-sky-500' },
              { label: 'Liquidez', key: 'liquidityWeight', color: 'bg-slate-500' },
            ].map((weight) => (
              <div key={weight.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{weight.label}</label>
                  <span className="text-xs font-black text-white">{rulesConfig.customWeights[weight.key as keyof StrategyWeights]}%</span>
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
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Contribution Budget Selector */}
      <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
              Valor do Aporte Planejado
            </label>
            <div className="relative max-w-xs">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
              <input
                type="number"
                min={0}
                step={100}
                value={contributionAmount}
                onChange={(e) => setContributionAmount(Math.max(0, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-base font-black text-white focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {invReserveBalance > 0 && (
              <button
                onClick={() => setContributionAmount(invReserveBalance)}
                className={`px-3 py-2 rounded-xl text-[10px] font-black border transition-all flex items-center gap-1.5 uppercase tracking-tighter ${
                  contributionAmount === invReserveBalance 
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/20' 
                    : 'bg-emerald-950/20 border-emerald-800/50 text-emerald-400 hover:bg-emerald-950/40'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                Usar Reserva (R$ {invReserveBalance.toLocaleString('pt-BR')})
              </button>
            )}
            {[500, 1000, 2500, 5000].map(val => (
              <button
                key={val}
                onClick={() => setContributionAmount(val)}
                className={`px-3 py-2 rounded-xl text-[10px] font-black border transition-all uppercase tracking-tighter ${
                  contributionAmount === val 
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20' 
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                + R$ {val >= 1000 ? `${val/1000}k` : val}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Strategic Dashboard & Execution Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950/20 border border-indigo-500/20 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Aporte Sugerido</span>
            <div className="text-2xl font-black text-white">
              R$ {simulation.totalAllocated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            {simulation.unallocatedRemainder > 0 && (
              <div className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                <Info className="w-3 h-3" /> Sobra: R$ {simulation.unallocatedRemainder.toFixed(2)}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Eficácia do Rebalanceio</span>
            <div className="text-2xl font-black text-emerald-400 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {simulation.overallDeviationReductionPct}%
            </div>
            <div className="text-[10px] font-bold text-slate-500">REDUÇÃO DO DESVIO GERAL</div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Ativos Selecionados</span>
            <div className="text-2xl font-black text-white">
              {activeOrders.length} <span className="text-xs font-medium text-slate-500">de {positions.length}</span>
            </div>
            <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {simulation.restrictedAssetsCount} restrições de risco
            </div>
          </div>

          <div className="flex items-center">
            <button
              disabled={activeOrders.length === 0 || isExecuting}
              onClick={handleExecuteContributionOrders}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-2xl text-xs font-black transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isExecuting ? 'PROCESSANDO...' : 'EXECUTAR APORTES'}
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/60 text-xs text-slate-300 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed italic font-medium">{simulation.executiveSummary}</p>
        </div>
      </div>

      {/* 5. Priority Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Sugestões do Motor Inteligente
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {simulation.suggestions.map((item) => (
            <div 
              key={item.ticker}
              className={`p-5 rounded-3xl border transition-all duration-300 relative group ${
                item.suggestedQuantity > 0 
                  ? 'bg-slate-900 border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-2xl shadow-indigo-500/5' 
                  : item.status === 'restricted' || item.status === 'locked'
                  ? 'bg-slate-950/40 border-slate-800/50 grayscale-[0.3]'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black ${
                    item.rank === 1 ? 'bg-amber-500 text-black' :
                    item.rank === 2 ? 'bg-slate-400 text-black' :
                    item.rank === 3 ? 'bg-amber-700 text-white' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {item.rank}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-base">{item.ticker}</span>
                      {item.status === 'locked' && <Lock className="w-3 h-3 text-rose-500" />}
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{item.type}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-white leading-none">{item.priorityScore}</div>
                  <div className="text-[9px] font-black text-slate-600 uppercase">Score Motor</div>
                </div>
              </div>

              {item.suggestedQuantity > 0 ? (
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 mb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Sugerido</span>
                    <span className="text-lg font-black text-white">R$ {item.suggestedAmount.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-400">Comprar {item.suggestedQuantity} un</span>
                    <span className="text-slate-500 text-[10px]">@ R$ {item.currentPrice.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/60 border border-slate-800/60 rounded-2xl p-4 mb-4 flex items-center justify-center min-h-[80px] text-center">
                   <p className="text-[10px] text-slate-500 font-bold uppercase leading-relaxed">
                     {item.status === 'restricted' ? item.restrictionReason : 'Aguardando momento ideal para aporte'}
                   </p>
                </div>
              )}

              <div className="space-y-1.5">
                {item.reasons.slice(0, 2).map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-slate-400 font-medium">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODALS */}
      <AddRebalanceAssetModal
        isOpen={isAddAssetModalOpen}
        onClose={() => setIsAddAssetModalOpen(false)}
        onAddAsset={(newAsset) => {
          setEditableTargets(prev => ({
            ...prev,
            [newAsset.ticker]: {
              ticker: newAsset.ticker,
              type: newAsset.type as any,
              targetPct: newAsset.targetPct,
              minPct: Math.max(0, newAsset.targetPct - 2),
              maxPct: newAsset.targetPct + 5,
              locked: false
            }
          }));
          if (!quotes[newAsset.ticker] && onFetchQuote) onFetchQuote(newAsset.ticker);
        }}
        existingTickers={Object.keys(editableTargets)}
        leftoverTargetPct={Math.max(0, 100 - Object.values(editableTargets).reduce((acc, t) => acc + (t.targetPct || 0), 0))}
        formatCurrency={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      />

      {/* METAS MODAL */}
      {isEditingTargets && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Metas Estratégicas de Alocação</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Defina o peso ideal de cada ativo para o rebalanceamento</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className={`px-5 py-2 rounded-2xl border flex items-center gap-3 transition-all ${
                  Math.abs(Object.values(editableTargets).reduce((acc, t) => acc + (t.targetPct || 0), 0) - 100) < 0.1
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}>
                  <span className="text-[10px] font-black uppercase tracking-widest">Total Alocado:</span>
                  <span className="text-xl font-black tracking-tighter">{Object.values(editableTargets).reduce((acc, t) => acc + (t.targetPct || 0), 0).toFixed(1)}%</span>
                </div>
                <button onClick={() => setIsEditingTargets(false)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-colors">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => setIsAddAssetModalOpen(true)}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-600/20 transition-all flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" /> Adicionar Novo Ativo
                </button>
                <button
                  onClick={() => {
                    const count = Object.keys(editableTargets).length;
                    if (count > 0) {
                      const equal = Number((100 / count).toFixed(1));
                      const next = { ...editableTargets };
                      Object.keys(next).forEach(k => {
                        next[k] = { ...next[k], targetPct: equal, minPct: Math.max(0, equal - 2), maxPct: equal + 5 };
                      });
                      setEditableTargets(next);
                      toast.info('Pesos distribuídos igualmente.');
                    }
                  }}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
                >
                  Equidistribuir Pesos
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.keys(editableTargets).map(ticker => {
                  const t = editableTargets[ticker];
                  const isZero = t.targetPct === 0;
                  return (
                    <div key={ticker} className={`p-6 rounded-[2rem] border transition-all ${isZero ? 'bg-slate-950/40 border-rose-500/20 opacity-80' : 'bg-slate-800/40 border-slate-700/50 hover:border-indigo-500/30 hover:bg-slate-800/60'}`}>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm ${isZero ? 'bg-rose-500/10 text-rose-500' : 'bg-indigo-500/10 text-indigo-400'}`}>
                            {ticker.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-black text-white text-base block leading-none">{ticker}</span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t.type}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-2xl font-black block leading-none ${isZero ? 'text-rose-500' : 'text-white'}`}>{t.targetPct}%</span>
                          <span className="text-[10px] font-black text-slate-600 uppercase">Meta Alvo</span>
                        </div>
                      </div>

                      <div className="space-y-6">
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
                                locked: val === 0 ? true : prev[ticker].locked,
                                minPct: Math.max(0, val - 2),
                                maxPct: val + 5
                              }
                            }));
                          }}
                          className={`w-full h-2 rounded-full appearance-none cursor-pointer transition-all ${isZero ? 'accent-rose-500 bg-rose-500/10' : 'accent-indigo-500 bg-slate-700'}`}
                        />
                        
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                             <div className="space-y-1">
                               <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block px-1">Mínimo</label>
                               <input type="number" value={t.minPct} onChange={e => setEditableTargets(prev => ({ ...prev, [ticker]: { ...t, minPct: Number(e.target.value) } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-400 text-center" />
                             </div>
                             <div className="space-y-1">
                               <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block px-1">Máximo</label>
                               <input type="number" value={t.maxPct} onChange={e => setEditableTargets(prev => ({ ...prev, [ticker]: { ...t, maxPct: Number(e.target.value) } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-400 text-center" />
                             </div>
                          </div>
                          <button
                            onClick={() => setEditableTargets(prev => ({ ...prev, [ticker]: { ...t, locked: !t.locked } }))}
                            className={`p-3 rounded-2xl border transition-all ${t.locked ? 'bg-rose-500/20 border-rose-500/30 text-rose-500' : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'}`}
                          >
                            {t.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-8 border-t border-slate-800 bg-slate-900/50 flex items-center justify-end gap-4">
              <button onClick={() => setIsEditingTargets(false)} className="px-8 py-3 text-xs font-black text-slate-500 hover:text-white uppercase tracking-widest transition-all">Cancelar</button>
              <button onClick={handleSaveTargetAllocations} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-600/20 transition-all">Salvar Estratégia</button>
            </div>
          </div>
        </div>
      )}

      {/* REGRAS MODAL */}
      {isEditingRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
               <div className="flex items-center gap-4">
                 <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                   <ShieldCheck className="w-6 h-6" />
                 </div>
                 <div>
                   <h3 className="text-xl font-black text-white tracking-tight">Filtros & Critérios de Risco</h3>
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">O motor ignorará ativos que não passarem nestas travas</p>
                 </div>
               </div>
               <button onClick={() => setIsEditingRules(false)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-colors">
                  <Plus className="w-6 h-6 rotate-45" />
               </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Filtros de Ações</h5>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Liquidez Diária Mínima</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">R$</span>
                        <input type="number" step={100000} value={rulesConfig.minDailyLiquidity} onChange={e => setRulesConfig(prev => ({ ...prev, minDailyLiquidity: Number(e.target.value) }))} className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-bold text-white focus:border-emerald-500" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Dívida / EBITDA Máximo</label>
                      <input type="number" step={0.5} value={rulesConfig.maxDebtEbitdaAllowed} onChange={e => setRulesConfig(prev => ({ ...prev, maxDebtEbitdaAllowed: Number(e.target.value) }))} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm font-bold text-white focus:border-emerald-500" />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Filtros de FIIs</h5>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">P/VP Máximo Sugerido</label>
                      <input type="number" step={0.05} value={rulesConfig.maxFiiPvpAllowed} onChange={e => setRulesConfig(prev => ({ ...prev, maxFiiPvpAllowed: Number(e.target.value) }))} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm font-bold text-white focus:border-emerald-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Score Mínimo (Qualidade)</label>
                      <input type="number" step={5} value={rulesConfig.minScoreAllowed} onChange={e => setRulesConfig(prev => ({ ...prev, minScoreAllowed: Number(e.target.value) }))} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm font-bold text-white focus:border-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-800 bg-slate-900/50 flex items-center justify-end gap-4">
              <button onClick={() => setIsEditingRules(false)} className="px-8 py-3 text-xs font-black text-slate-500 hover:text-white uppercase tracking-widest transition-all">Cancelar</button>
              <button onClick={() => { if(onSaveRulesConfig) onSaveRulesConfig(rulesConfig); setIsEditingRules(false); toast.success('Regras aplicadas!'); }} className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-600/20 transition-all">Aplicar Travas</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
