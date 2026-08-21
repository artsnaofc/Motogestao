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
  HelpCircle
} from 'lucide-react';
import { 
  simulatePortfolioContribution, 
  RebalanceStrategyType, 
  RebalanceRulesConfig, 
  AssetAllocationTarget, 
  DEFAULT_REBALANCE_RULES,
  PositionForRebalance,
  ContributionItemSuggestion
} from '../../lib/rebalanceEngine';
import { useInvestments } from '../../contexts/InvestmentsContext';
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
  hideValues?: boolean;
  onFetchQuote?: (ticker: string) => Promise<void>;
  onOpenRaioX?: (ticker: string) => void;
}

export const ProfessionalRebalanceEngineView: React.FC<ProfessionalRebalanceEngineViewProps> = ({
  positions = [],
  targets,
  targetAllocations,
  quotes = {},
  valuationTargets,
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
  const [contributionAmount, setContributionAmount] = useState<number>(2500);
  const [activeStrategy, setActiveStrategy] = useState<RebalanceStrategyType>(initialRulesConfig?.activeStrategy || 'rebalance');
  const [rulesConfig, setRulesConfig] = useState<RebalanceRulesConfig>(initialRulesConfig || DEFAULT_REBALANCE_RULES);
  const [editableTargets, setEditableTargets] = useState<Record<string, AssetAllocationTarget>>(effectiveTargets);
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

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
      b3AssetsMetadata
    );
  }, [normalizedPositions, editableTargets, contributionAmount, activeStrategy, rulesConfig, quotes, b3AssetsMetadata]);

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
      <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-400" />
              Motor Inteligente de Rebalanceamento & Sugestão de Aportes
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Distribuição matemática sem vendas forçadas, focada em correção de gaps, qualidade e valuation
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditingTargets(!isEditingTargets)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                isEditingTargets 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {isEditingTargets ? 'Concluir Ajuste de Metas' : 'Configurar Metas & Faixas'}
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
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Ranking de Prioridade de Aporte ("Onde Aportar?")
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {simulation.suggestions.map((item) => (
            <div 
              key={item.ticker}
              className={`p-4 rounded-2xl border transition-all ${
                item.suggestedQuantity > 0 
                  ? 'bg-slate-900 border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-md' 
                  : item.status === 'restricted' || item.status === 'locked'
                  ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              {/* Header: Rank, Ticker, Lock Button */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                    item.rank === 1 ? 'bg-amber-500 text-black' :
                    item.rank === 2 ? 'bg-slate-300 text-black' :
                    item.rank === 3 ? 'bg-amber-700 text-white' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    #{item.rank}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-sm">{item.ticker}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        item.type === 'Ação' ? 'bg-sky-500/20 text-sky-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {item.type}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 truncate block max-w-[140px]">{item.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleLock(item.ticker)}
                    title={item.status === 'locked' ? 'Ativo travado (clique para destravar)' : 'Travar ativo contra novos aportes'}
                    className={`p-1.5 rounded-lg border transition-all ${
                      item.status === 'locked' 
                        ? 'bg-rose-500/20 border-rose-500/30 text-rose-300' 
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.status === 'locked' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>

                  <div className="text-right">
                    <span className="text-xs font-bold text-indigo-400 block">{item.priorityScore} pts</span>
                    <span className="text-[9px] text-slate-500 uppercase">Prioridade</span>
                  </div>
                </div>
              </div>

              {/* Suggested Contribution Callout */}
              {item.suggestedQuantity > 0 ? (
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-300 font-bold">Comprar {item.suggestedQuantity} {item.type === 'Ação' ? 'ações' : 'cotas'}</span>
                    <span className="text-white font-extrabold">
                      R$ {item.suggestedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Cotação: R$ {(item.currentPrice ?? 0).toFixed(2)} | Novo Peso: {(item.projectedPct ?? 0).toFixed(1)}% (Meta {(item.targetPct ?? 0).toFixed(1)}%)
                  </div>
                </div>
              ) : item.status === 'restricted' ? (
                <div className="p-2.5 bg-amber-950/20 border border-amber-500/20 rounded-xl mb-3 text-[11px] text-amber-300">
                  <span className="font-semibold block mb-0.5">Restrição de Risco:</span>
                  {item.restrictionReason}
                </div>
              ) : item.status === 'locked' ? (
                <div className="p-2.5 bg-rose-950/20 border border-rose-500/20 rounded-xl mb-3 text-[11px] text-rose-300">
                  Ativo bloqueado para novos aportes.
                </div>
              ) : (
                <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl mb-3 text-[11px] text-slate-400">
                  Posição alinhada à meta ({(item.currentPct ?? 0).toFixed(1)}% vs meta {(item.targetPct ?? 0).toFixed(1)}%).
                </div>
              )}

              {/* Why this asset was chosen (Reasons) */}
              <div className="space-y-1 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Por que este ativo?</span>
                <ul className="space-y-1">
                  {item.reasons.map((r, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. "Antes x Depois" Detailed Matrix Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-3">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-400" />
              Comparativo Analítico "Antes x Depois" do Aporte
            </h4>
            <p className="text-xs text-slate-400">Evolução do peso percentual e mitigação de desvio por ativo</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Ativo</th>
                <th className="py-3 px-3">Posição Atual</th>
                <th className="py-3 px-3">Meta Ideal</th>
                <th className="py-3 px-3">Aporte Sugerido</th>
                <th className="py-3 px-3">Nova Posição</th>
                <th className="py-3 px-3">Novo Desvio</th>
                <th className="py-3 px-3">Correção Desvio</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {simulation.suggestions.map((item) => (
                <tr key={item.ticker} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                    {item.ticker}
                    {item.status === 'locked' && <Lock className="w-3 h-3 text-rose-400" />}
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-200">
                      R$ {item.currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{(item.currentPct ?? 0).toFixed(1)}% da carteira</span>
                  </td>

                  <td className="py-3 px-3 font-semibold text-indigo-400">
                    {(item.targetPct ?? 0).toFixed(1)}%
                    <span className="text-[10px] text-slate-500 block">Faixa: {item.minPct ?? 0}% - {item.maxPct ?? 0}%</span>
                  </td>

                  <td className="py-3 px-3">
                    {item.suggestedQuantity > 0 ? (
                      <div>
                        <span className="font-bold text-emerald-400">
                          +{item.suggestedQuantity} un (R$ {item.suggestedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-bold text-white">
                      R$ {item.projectedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{(item.projectedPct ?? 0).toFixed(1)}%</span>
                  </td>

                  <td className="py-3 px-3">
                    <span className={`font-semibold ${(item.distanceAfter ?? 0) <= 1.0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {(item.distanceAfter ?? 0).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-slate-500 block">era {(item.distanceBefore ?? 0).toFixed(1)}%</span>
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${item.deviationCorrectedPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-emerald-400">{item.deviationCorrectedPct}%</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      item.suggestedQuantity > 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      item.status === 'locked' ? 'bg-rose-500/20 text-rose-300' :
                      item.status === 'restricted' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {item.suggestedQuantity > 0 ? 'Aporte Sugerido' : item.status === 'locked' ? 'Travado' : item.status === 'restricted' ? 'Restrito' : 'Equilibrado'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Target Allocation Manager Drawer / Inline Editor */}
      {isEditingTargets && (
        <div className="bg-slate-900 border border-indigo-500/30 p-5 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                Edição Rápida de Metas e Faixas Percentuais (Mín / Alvo / Máx)
              </h4>
              <p className="text-xs text-slate-400">
                Ajuste os alvos de cada ativo para direcionar a estratégia do motor de rebalanceamento
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Equalize all targets equally
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
                  }
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg"
              >
                Equidistribuir ({positions.length > 0 ? (100 / positions.length).toFixed(1) : 0}%)
              </button>

              <button
                onClick={handleSaveTargetAllocations}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow"
              >
                Salvar Alterações
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
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
                <div key={p.ticker} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{p.ticker}</span>
                    <span className="text-slate-400">Atual: {(displayCurrentPct ?? 0).toFixed(1)}%</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Mín %</label>
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
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-indigo-400 font-bold block mb-0.5">Alvo %</label>
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
                        className="w-full bg-slate-900 border border-indigo-500 rounded-lg px-2 py-1 text-xs font-bold text-indigo-300"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Máx %</label>
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
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
