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
  AlertCircle
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
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
              <Scale className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditingTargets(!isEditingTargets)}
              className={`px-4 py-2 rounded-xl text-xs font-black border transition-all uppercase tracking-wider flex items-center gap-2 ${
                isEditingTargets 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              {isEditingTargets ? 'Concluir Metas' : 'Ajustar Metas'}
            </button>
            <button
              onClick={() => setIsEditingRules(!isEditingRules)}
              className={`px-4 py-2 rounded-xl text-xs font-black border transition-all uppercase tracking-wider flex items-center gap-2 ${
                isEditingRules 
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Critérios
            </button>
          </div>
        </div>

        {/* 6 Strategy Selector Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setActiveStrategy('rebalance')}
            className={`p-3 rounded-xl text-left border transition-all ${
              activeStrategy === 'rebalance' 
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/50' 
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-indigo-400" />
              Rebalanceamento
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Correção pura de gaps</div>
          </button>

          <button
            onClick={() => setActiveStrategy('quality')}
            className={`p-3 rounded-xl text-left border transition-all ${
              activeStrategy === 'quality' 
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/50' 
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Foco em Qualidade
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Prioriza maior Score</div>
          </button>

          <button
            onClick={() => setActiveStrategy('valuation')}
            className={`p-3 rounded-xl text-left border transition-all ${
              activeStrategy === 'valuation' 
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/50' 
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Valuation & Desconto
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Preço teto e P/VP</div>
          </button>

          <button
            onClick={() => setActiveStrategy('dividends')}
            className={`p-3 rounded-xl text-left border transition-all ${
              activeStrategy === 'dividends' 
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/50' 
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-sky-400" />
              Renda Passiva
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Maior Dividend Yield</div>
          </button>

          <button
            onClick={() => setActiveStrategy('diversification')}
            className={`p-3 rounded-xl text-left border transition-all ${
              activeStrategy === 'diversification' 
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/50' 
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-pink-400" />
              Anti-Concentração
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Diluição de risco</div>
          </button>

          <button
            onClick={() => setActiveStrategy('custom')}
            className={`p-3 rounded-xl text-left border transition-all ${
              activeStrategy === 'custom' 
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/50' 
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
              Personalizado
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Pesos customizáveis</div>
          </button>
        </div>
      </div>

      {/* 2. Strategy Detail / Custom Weights Editor */}
      {activeStrategy === 'custom' && (
        <div className="bg-slate-900 border border-purple-500/30 p-5 rounded-2xl shadow-xl space-y-4 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-purple-400" />
              <h4 className="text-sm font-black text-white uppercase tracking-tight">Pesos da Estratégia Personalizada</h4>
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
              Total: {rulesConfig.customWeights.gapWeight + rulesConfig.customWeights.qualityWeight + rulesConfig.customWeights.valuationWeight + rulesConfig.customWeights.dividendWeight + rulesConfig.customWeights.liquidityWeight}%
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { label: 'Gap de Alocação', key: 'gapWeight', color: 'bg-indigo-500', desc: 'Foco no equilíbrio' },
              { label: 'Qualidade (Score)', key: 'qualityWeight', color: 'bg-emerald-500', desc: 'Foco em fundamentos' },
              { label: 'Valuation', key: 'valuationWeight', color: 'bg-amber-500', desc: 'Foco em preço baixo' },
              { label: 'Dividendos', key: 'dividendWeight', color: 'bg-sky-500', desc: 'Foco em renda' },
              { label: 'Liquidez', key: 'liquidityWeight', color: 'bg-slate-500', desc: 'Foco em saída fácil' },
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
                      customWeights: {
                        ...prev.customWeights,
                        [weight.key]: newVal
                      }
                    }));
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <p className="text-[9px] text-slate-600 font-bold italic">{weight.desc}</p>
              </div>
            ))}
          </div>
          
          {(rulesConfig.customWeights.gapWeight + rulesConfig.customWeights.qualityWeight + rulesConfig.customWeights.valuationWeight + rulesConfig.customWeights.dividendWeight + rulesConfig.customWeights.liquidityWeight) !== 100 && (
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-tight">Nota: Recomenda-se que a soma dos pesos seja exatamente 100%.</p>
            </div>
          )}
        </div>
      )}

      {/* 2. Interactive Contribution Budget Selector */}
      <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">
              Quanto deseja aportar neste momento?
            </label>
            <div className="relative max-w-xs">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
              <input
                type="number"
                min={0}
                step={100}
                value={contributionAmount}
                onChange={(e) => setContributionAmount(Math.max(0, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-base font-bold text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Quick Amount Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {invReserveBalance > 0 && (
                <button
                  onClick={() => setContributionAmount(invReserveBalance)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    contributionAmount === invReserveBalance 
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md' 
                      : 'bg-emerald-950/20 border-emerald-800/50 text-emerald-400 hover:bg-emerald-950/40'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  Usar Reserva (R$ {invReserveBalance.toLocaleString('pt-BR')})
                </button>
              )}
              {[500, 1000, 2500, 5000, 10000, 25000].map(val => (
                <button
                  key={val}
                  onClick={() => setContributionAmount(val)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    contributionAmount === val 
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  + R$ {val >= 1000 ? `${val/1000}k` : val}
                </button>
              ))}
            </div>
        </div>
      </div>

      {/* 3. Executive KPI & Simulation Outcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Alocado</span>
            <span className="text-xl font-bold text-white">
              R$ {simulation.totalAllocated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            {simulation.unallocatedRemainder > 0 && (
              <span className="text-[10px] text-amber-400 block mt-0.5">
                Sobra de caixa: R$ {simulation.unallocatedRemainder.toFixed(2)}
              </span>
            )}
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Redução do Desvio</span>
            <span className="text-xl font-bold text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              {simulation.overallDeviationReductionPct}%
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Desvio: {simulation.totalDeviationBefore}% → {simulation.totalDeviationAfter}%
            </span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Ativos Contemplados</span>
            <span className="text-xl font-bold text-white">
              {activeOrders.length} <span className="text-xs font-normal text-slate-400">de {positions.length} posições</span>
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {simulation.restrictedAssetsCount} travados/bloqueados
            </span>
          </div>

          <div className="flex items-center">
            {onExecuteOrders && (
              <button
                disabled={activeOrders.length === 0 || isExecuting}
                onClick={handleExecuteContributionOrders}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {isExecuting ? 'Registrando Aportes...' : `Executar ${activeOrders.length} Ordem(ns)`}
              </button>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <span>{simulation.executiveSummary}</span>
        </div>
      </div>

      {/* 4. "Onde Aportar?" Ranking Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-black text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Ranking de Prioridade de Aporte ("Onde Aportar?")
          </h4>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-700/50">
            Baseado em Score {activeStrategy === 'rebalance' ? '+ Gaps' : `+ ${activeStrategy}`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {simulation.suggestions.map((item) => {
            const hasSafetyMargin = item.reasons.some(r => r.includes('margem de segurança'));
            const hasRisk = item.risks && item.risks.length > 0;
            
            return (
              <div 
                key={item.ticker}
                className={`p-5 rounded-2xl border transition-all relative overflow-hidden group ${
                  item.suggestedQuantity > 0 
                    ? 'bg-slate-900 border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-xl shadow-indigo-500/5' 
                    : item.status === 'restricted' || item.status === 'locked'
                    ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                {/* Visual Accent for top items */}
                {item.rank <= 3 && item.suggestedQuantity > 0 && (
                  <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-indigo-500/10 blur-2xl rounded-full" />
                )}

                {/* Header: Rank, Ticker, Lock Button */}
                <div className="flex items-start justify-between gap-2 mb-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shadow-lg ${
                      item.rank === 1 ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-black' :
                      item.rank === 2 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-black' :
                      item.rank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white' :
                      'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {item.rank}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white text-base tracking-tight">{item.ticker}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter ${
                          item.type === 'Ação' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {item.type}
                        </span>
                        {hasSafetyMargin && (
                          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium truncate block max-w-[140px]">{item.name}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleLock(item.ticker)}
                        title={item.status === 'locked' ? 'Ativo travado (clique para destravar)' : 'Travar ativo contra novos aportes'}
                        className={`p-2 rounded-xl border transition-all ${
                          item.status === 'locked' 
                            ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' 
                            : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white hover:border-slate-600'
                        }`}
                      >
                        {item.status === 'locked' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-black block ${item.priorityScore >= 80 ? 'text-indigo-400' : 'text-slate-400'}`}>
                        {item.priorityScore} <span className="text-[9px] font-bold text-slate-600">PTS</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Suggested Contribution Callout */}
                {item.suggestedQuantity > 0 ? (
                  <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl mb-4 relative z-10 group-hover:border-indigo-500/40 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-indigo-300">Aporte Sugerido</span>
                      <span className="text-lg font-black text-white">
                        R$ {item.suggestedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Comprar <span className="text-indigo-400 font-bold">{item.suggestedQuantity} {item.type === 'Ação' ? 'ações' : 'cotas'}</span>
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Cotação: R$ {(item.currentPrice ?? 0).toFixed(2)}
                      </span>
                    </div>
                    
                    {/* Progress Bar for Allocation */}
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider">
                        <span className="text-slate-500">Peso Atual: {(item.currentPct ?? 0).toFixed(1)}%</span>
                        <span className="text-indigo-400">Alvo: {(item.projectedPct ?? 0).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-800/50 rounded-full h-1.5 overflow-hidden border border-slate-700/30">
                        <div 
                          className="bg-indigo-500 h-full rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-700"
                          style={{ width: `${Math.min(100, ((item.projectedPct ?? 0) / (item.targetPct || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : item.status === 'restricted' ? (
                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl mb-4 text-[11px] text-amber-300/80 leading-relaxed">
                    <div className="flex items-center gap-1.5 font-black uppercase tracking-widest text-[9px] text-amber-500 mb-1.5">
                      <AlertTriangle className="w-3 h-3" />
                      Restrição de Risco
                    </div>
                    {item.restrictionReason}
                  </div>
                ) : item.status === 'locked' ? (
                  <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl mb-4 text-[11px] text-rose-400 font-bold flex items-center gap-2">
                    <Lock className="w-4 h-4 opacity-50" />
                    Ativo bloqueado pelo usuário.
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-2xl mb-4 text-[11px] text-slate-500 font-medium">
                    Posição alinhada à estratégia: {(item.currentPct ?? 0).toFixed(1)}% (Meta {(item.targetPct ?? 0).toFixed(1)}%)
                  </div>
                )}

                {/* Why this asset was chosen (Reasons) */}
                <div className="space-y-2 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="h-px bg-slate-800 flex-1" />
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Inteligência do Motor</span>
                    <div className="h-px bg-slate-800 flex-1" />
                  </div>
                  
                  <ul className="space-y-1.5">
                    {item.reasons.map((r, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[11px] text-slate-400">
                        <CheckCircle2 className="w-3 h-3 text-indigo-500/60 mt-0.5 shrink-0" />
                        <span className="leading-tight">{r}</span>
                      </li>
                    ))}
                    {item.risks?.map((risk, idx) => (
                      <li key={`risk-${idx}`} className="flex items-start gap-2 text-[11px] text-amber-500/70 italic">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="leading-tight">{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. "Antes x Depois" Detailed Matrix Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl space-y-0">
        <div className="p-6 border-b border-slate-800/80 bg-slate-900/50 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-400" />
              Matriz Analítica de Rebalanceamento
            </h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-1">Simulação de convergência de pesos e mitigação de desvios</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950/80 text-slate-500 uppercase tracking-widest text-[9px] font-black border-b border-slate-800">
              <tr>
                <th className="py-4 px-6">Ativo</th>
                <th className="py-4 px-3">Posição Atual</th>
                <th className="py-4 px-3">Meta Alvo</th>
                <th className="py-4 px-3">Sugestão</th>
                <th className="py-4 px-3">Projeção Final</th>
                <th className="py-4 px-3">Desvio Pós</th>
                <th className="py-4 px-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {simulation.suggestions.map((item) => (
                <tr key={item.ticker} className="hover:bg-indigo-500/[0.03] transition-colors group">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-[10px] font-bold text-slate-600 group-hover:text-indigo-400 transition-colors">#{item.rank}</span>
                      <div>
                        <span className="font-black text-white text-sm block leading-none">{item.ticker}</span>
                        <span className="text-[10px] text-slate-500 font-medium">{item.type}</span>
                      </div>
                      {item.status === 'locked' && <Lock className="w-3 h-3 text-rose-500/70" />}
                    </div>
                  </td>

                  <td className="py-4 px-3">
                    <span className="font-bold text-slate-300 block">
                      R$ {item.currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-600 font-bold">{(item.currentPct ?? 0).toFixed(1)}%</span>
                  </td>

                  <td className="py-4 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-indigo-400">{(item.targetPct ?? 0).toFixed(1)}%</span>
                      <span className="text-[9px] text-slate-600 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                        {item.minPct}%-{item.maxPct}%
                      </span>
                    </div>
                  </td>

                  <td className="py-4 px-3">
                    {item.suggestedQuantity > 0 ? (
                      <div className="flex flex-col">
                        <span className="font-black text-emerald-400 text-sm">
                          +{item.suggestedQuantity} un
                        </span>
                        <span className="text-[10px] text-emerald-500/80 font-bold">
                          R$ {item.suggestedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-700 font-bold">—</span>
                    )}
                  </td>

                  <td className="py-4 px-3">
                    <span className="font-black text-white block">
                      R$ {item.projectedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-indigo-400/70 font-bold">{(item.projectedPct ?? 0).toFixed(1)}%</span>
                  </td>

                  <td className="py-4 px-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-black ${(item.distanceAfter ?? 0) <= 0.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {(item.distanceAfter ?? 0).toFixed(1)}%
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-700" />
                        <span className="text-[10px] text-slate-600 font-bold">era {(item.distanceBefore ?? 0).toFixed(1)}%</span>
                      </div>
                      <div className="w-20 bg-slate-800 rounded-full h-1 overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-full rounded-full"
                          style={{ width: `${item.deviationCorrectedPct}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-6 text-right">
                    <span className={`text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider border ${
                      item.suggestedQuantity > 0 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' :
                      item.status === 'locked' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                      item.status === 'restricted' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-slate-800/50 text-slate-500 border-slate-800'
                    }`}>
                      {item.suggestedQuantity > 0 ? 'Aporte' : item.status === 'locked' ? 'Travado' : item.status === 'restricted' ? 'Restrito' : 'Em Meta'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals for Editing Targets and Rules */}
      {(isEditingTargets || isEditingRules) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl border ${isEditingTargets ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                  {isEditingTargets ? <Target className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">
                    {isEditingTargets ? 'Metas de Alocação' : 'Critérios de Segurança'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {isEditingTargets 
                      ? 'Defina os pesos ideais para cada ativo da sua carteira.' 
                      : 'Ajuste os filtros automáticos para evitar aportes em ativos problemáticos.'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setIsEditingTargets(false); setIsEditingRules(false); }}
                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {isEditingTargets && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/60">
                    <div className="text-[11px] text-slate-400 font-medium max-w-md">
                      O motor de rebalanceamento usará estas metas para calcular quanto comprar de cada ativo até atingir o equilíbrio desejado.
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const count = positions.length;
                          if (count > 0) {
                            const equalPct = Number((100 / count).toFixed(1));
                            const next: Record<string, AssetAllocationTarget> = {};
                            positions.forEach(p => {
                              next[p.ticker] = {
                                ticker: p.ticker,
                                type: p.type as any,
                                minPct: Math.max(1, Math.floor(equalPct * 0.5)),
                                targetPct: equalPct,
                                maxPct: Math.min(30, Math.ceil(equalPct * 2)),
                                locked: false
                              };
                            });
                            setEditableTargets(next);
                            toast.info(`Metas equidistribuídas em ${equalPct}% por ativo.`);
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-400 rounded-xl border border-slate-700"
                      >
                        Equidistribuir
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {positions.map((p) => {
                      const currentT = editableTargets[p.ticker] || {
                        ticker: p.ticker,
                        type: p.type as any,
                        minPct: 2,
                        targetPct: 5,
                        maxPct: 15,
                        locked: false
                      };
                      const posCurrent = normalizedPositions.find(np => np.ticker === p.ticker);
                      const displayCurrentPct = posCurrent ? posCurrent.currentPct : (p.currentPct ?? 0);

                      return (
                        <div key={p.ticker} className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/60 space-y-4 hover:border-indigo-500/30 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-white text-sm">{p.ticker}</span>
                              <span className="text-[9px] font-black text-slate-600 uppercase">{(p.type || 'Ação').substring(0, 3)}</span>
                            </div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Atual: {(displayCurrentPct ?? 0).toFixed(1)}%</span>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] text-slate-600 font-black uppercase tracking-widest block text-center">Mín</label>
                              <input
                                type="number"
                                min={0}
                                max={50}
                                step={0.5}
                                value={currentT.minPct}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setEditableTargets(prev => ({
                                    ...prev,
                                    [p.ticker]: { ...currentT, minPct: val }
                                  }));
                                }}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-400 text-center"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] text-indigo-500 font-black uppercase tracking-widest block text-center">Alvo</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={currentT.targetPct}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setEditableTargets(prev => ({
                                    ...prev,
                                    [p.ticker]: { ...currentT, targetPct: val }
                                  }));
                                }}
                                className="w-full bg-slate-900 border border-indigo-500/40 rounded-xl px-2 py-1.5 text-xs font-black text-indigo-400 text-center shadow-[0_0_10px_rgba(99,102,241,0.05)]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] text-slate-600 font-black uppercase tracking-widest block text-center">Máx</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={currentT.maxPct}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setEditableTargets(prev => ({
                                    ...prev,
                                    [p.ticker]: { ...currentT, maxPct: val }
                                  }));
                                }}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-400 text-center"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {isEditingRules && (
                <div className="space-y-6">
                  <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/60 text-[11px] text-slate-400 font-medium">
                    Estes critérios funcionam como "travas de segurança". Se um ativo não cumprir algum destes requisitos, o motor irá sugerir ignorar o aporte para este ativo.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Geral & Ações</h5>
                      <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Liquidez Diária (Mín)</label>
                          <HelpCircle className="w-3 h-3 text-slate-600" />
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600">R$</span>
                          <input
                            type="number"
                            value={rulesConfig.minDailyLiquidity}
                            onChange={(e) => setRulesConfig(prev => ({ ...prev, minDailyLiquidity: Number(e.target.value) }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-white focus:border-indigo-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Dívida / EBITDA (Máx)</label>
                          <HelpCircle className="w-3 h-3 text-slate-600" />
                        </div>
                        <input
                          type="number"
                          step={0.5}
                          value={rulesConfig.maxDebtEbitdaAllowed}
                          onChange={(e) => setRulesConfig(prev => ({ ...prev, maxDebtEbitdaAllowed: Number(e.target.value) }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">FIIs & Qualidade</h5>
                      <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">P/VP Máximo (FIIs)</label>
                          <HelpCircle className="w-3 h-3 text-slate-600" />
                        </div>
                        <input
                          type="number"
                          step={0.05}
                          value={rulesConfig.maxFiiPvpAllowed}
                          onChange={(e) => setRulesConfig(prev => ({ ...prev, maxFiiPvpAllowed: Number(e.target.value) }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-indigo-500 transition-colors"
                        />
                      </div>

                      <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Score Mínimo</label>
                          <HelpCircle className="w-3 h-3 text-slate-600" />
                        </div>
                        <input
                          type="number"
                          step={5}
                          value={rulesConfig.minScoreAllowed}
                          onChange={(e) => setRulesConfig(prev => ({ ...prev, minScoreAllowed: Number(e.target.value) }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900/50">
              <button
                onClick={() => { setIsEditingTargets(false); setIsEditingRules(false); }}
                className="px-6 py-2.5 rounded-xl text-xs font-black text-slate-400 hover:text-white hover:bg-slate-800 transition-all uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (isEditingTargets) handleSaveTargetAllocations();
                  if (isEditingRules) {
                    if (onSaveRulesConfig) onSaveRulesConfig(rulesConfig);
                    setIsEditingRules(false);
                    toast.success('Critérios salvos!');
                  }
                }}
                className={`px-8 py-2.5 rounded-xl text-xs font-black text-white shadow-lg transition-all uppercase tracking-widest ${
                  isEditingTargets ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                }`}
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
