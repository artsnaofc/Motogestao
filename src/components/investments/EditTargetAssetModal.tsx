import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  RefreshCw, 
  Target, 
  DollarSign, 
  Trash2, 
  Lock, 
  Unlock, 
  TrendingUp, 
  ShieldCheck, 
  HelpCircle,
  Sparkles,
  Sliders,
  Layers
} from 'lucide-react';
import { AssetAllocationTarget } from '../../lib/rebalanceEngine';
import { fetchSingleQuote } from '../../lib/quoteService';
import { toast } from 'sonner';

export interface EditTargetAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: AssetAllocationTarget | null;
  currentQuote?: number;
  valuationTarget?: number;
  isInPortfolio: boolean;
  onSave: (updated: {
    ticker: string;
    type: string;
    targetPct: number;
    minPct: number;
    maxPct: number;
    locked: boolean;
    quote?: number;
    valuationPrice?: number;
  }) => Promise<void>;
  onDelete?: (ticker: string) => Promise<void>;
  brapiToken?: string;
  formatCurrency: (val: number) => string;
}

const COMMON_ASSET_TYPES = [
  'Ação',
  'FII',
  'ETF',
  'BDR',
  'Renda Fixa',
  'Cripto',
  'Outro'
];

export const EditTargetAssetModal: React.FC<EditTargetAssetModalProps> = ({
  isOpen,
  onClose,
  target,
  currentQuote = 0,
  valuationTarget = 0,
  isInPortfolio,
  onSave,
  onDelete,
  brapiToken,
  formatCurrency
}) => {
  const [type, setType] = useState<string>('Ação');
  const [targetPct, setTargetPct] = useState<number>(5);
  const [minPct, setMinPct] = useState<number>(3);
  const [maxPct, setMaxPct] = useState<number>(10);
  const [locked, setLocked] = useState<boolean>(false);
  const [priceStr, setPriceStr] = useState<string>('');
  const [valuationStr, setValuationStr] = useState<string>('');
  const [isFetchingQuote, setIsFetchingQuote] = useState<boolean>(false);
  const [quoteProviderUsed, setQuoteProviderUsed] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  useEffect(() => {
    if (target) {
      setType(target.type || 'Ação');
      setTargetPct(target.targetPct ?? 5);
      setMinPct(target.minPct ?? Math.max(0, (target.targetPct ?? 5) - 2));
      setMaxPct(target.maxPct ?? ((target.targetPct ?? 5) + 5));
      setLocked(Boolean(target.locked));
      
      const p = (currentQuote && currentQuote > 0) ? currentQuote : (target.lastPrice || 0);
      setPriceStr(p > 0 ? p.toFixed(2).replace('.', ',') : '');
      
      setValuationStr(valuationTarget > 0 ? valuationTarget.toFixed(2).replace('.', ',') : '');
      setQuoteProviderUsed(null);
      setShowDeleteConfirm(false);
    }
  }, [target, currentQuote, valuationTarget]);

  if (!isOpen || !target) return null;

  const ticker = target.ticker.toUpperCase();

  const parseNumber = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/\./g, '').replace(',', '.');
    const num = Number(clean);
    return isNaN(num) ? 0 : num;
  };

  const handleFetchLiveQuote = async () => {
    setIsFetchingQuote(true);
    try {
      const res = await fetchSingleQuote(ticker, brapiToken);
      if (res && res.price > 0) {
        setPriceStr(res.price.toFixed(2).replace('.', ','));
        setQuoteProviderUsed(res.provider);
        toast.success(`Cotação de ${ticker} obtida: ${formatCurrency(res.price)}`);
      } else {
        toast.warning(`Não foi possível obter cotação automática para ${ticker}. Defina manualmente.`);
      }
    } catch (err) {
      console.warn('Erro ao buscar cotação de', ticker, err);
      toast.error('Erro ao conectar ao provedor de cotações.');
    } finally {
      setIsFetchingQuote(false);
    }
  };

  const currentEnteredPrice = parseNumber(priceStr);
  const currentEnteredValuation = parseNumber(valuationStr);

  // Safety margin calculation
  const marginPct = currentEnteredValuation > 0 && currentEnteredPrice > 0
    ? ((currentEnteredValuation - currentEnteredPrice) / currentEnteredValuation) * 100
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetPct < 0 || targetPct > 100) {
      toast.error('A meta percentual deve estar entre 0% e 100%.');
      return;
    }

    if (minPct > targetPct) {
      toast.error('A faixa mínima não pode ser maior que a meta alvo.');
      return;
    }

    if (maxPct < targetPct) {
      toast.error('A faixa máxima não pode ser menor que a meta alvo.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        ticker,
        type,
        targetPct: Number(targetPct.toFixed(1)),
        minPct: Number(minPct.toFixed(1)),
        maxPct: Number(maxPct.toFixed(1)),
        locked,
        quote: currentEnteredPrice > 0 ? currentEnteredPrice : undefined,
        valuationPrice: currentEnteredValuation > 0 ? currentEnteredValuation : undefined
      });
      toast.success(`Ativo ${ticker} atualizado com sucesso!`);
      onClose();
    } catch (err) {
      console.error('Erro ao salvar meta:', err);
      toast.error('Erro ao salvar as configurações da meta.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsSaving(true);
    try {
      await onDelete(ticker);
      toast.success(`Ativo ${ticker} removido das metas alvo.`);
      onClose();
    } catch (err) {
      console.error('Erro ao remover ativo:', err);
      toast.error('Erro ao remover ativo das metas.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="w-full max-w-lg bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-black border border-indigo-500/20 shrink-0">
              {ticker.slice(0, 4)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-foreground">
                  {ticker}
                </h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                  isInPortfolio 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                }`}>
                  {isInPortfolio ? 'Em Carteira' : 'Adicionado / Estudo'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Configuração de meta de alocação, tolerâncias e cotação de referência.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* TIPO / CLASSE DE ATIVO */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              Classe / Tipo do Ativo
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {COMMON_ASSET_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-1.5 px-1 text-center rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                    type === t
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* META ALVO (%) */}
          <div className="p-4 bg-muted/20 border border-border/70 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-foreground flex items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-500" />
                Meta Alvo Desejada
              </label>
              <div className="flex items-center gap-1 bg-background border border-border rounded-xl px-2.5 py-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={targetPct}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTargetPct(val);
                    setMinPct(Math.max(0, Number((val - 2).toFixed(1))));
                    setMaxPct(Number((val + 5).toFixed(1)));
                  }}
                  className="w-16 bg-transparent text-right font-black text-sm text-foreground outline-none"
                />
                <span className="text-xs font-black text-muted-foreground">%</span>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="40"
              step="0.5"
              value={targetPct}
              onChange={(e) => {
                const val = Number(e.target.value);
                setTargetPct(val);
                setMinPct(Math.max(0, Number((val - 2).toFixed(1))));
                setMaxPct(Number((val + 5).toFixed(1)));
              }}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />

            {/* BANDAS DE TOLERÂNCIA */}
            <div className="pt-2 border-t border-border/50 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground block mb-1">Mínimo Aceitável:</span>
                <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-1">
                  <input
                    type="number"
                    min="0"
                    max={targetPct}
                    step="0.1"
                    value={minPct}
                    onChange={(e) => setMinPct(Number(e.target.value))}
                    className="w-full bg-transparent text-right font-bold text-xs text-foreground outline-none"
                  />
                  <span className="text-[10px] font-bold text-muted-foreground">%</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground block mb-1">Máximo Aceitável:</span>
                <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-1">
                  <input
                    type="number"
                    min={targetPct}
                    max="100"
                    step="0.1"
                    value={maxPct}
                    onChange={(e) => setMaxPct(Number(e.target.value))}
                    className="w-full bg-transparent text-right font-bold text-xs text-foreground outline-none"
                  />
                  <span className="text-[10px] font-bold text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* COTAÇÃO DE MERCADO */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                Cotação de Mercado (R$)
              </label>
              <button
                type="button"
                onClick={handleFetchLiveQuote}
                disabled={isFetchingQuote}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isFetchingQuote ? 'animate-spin' : ''}`} />
                <span>{isFetchingQuote ? 'Buscando...' : 'Buscar cotação online'}</span>
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
              <input
                type="text"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="0,00"
                className="w-full pl-9 pr-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-bold text-foreground focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>
            {quoteProviderUsed && (
              <span className="text-[10px] text-muted-foreground block">
                Fonte: {quoteProviderUsed}
              </span>
            )}
          </div>

          {/* PREÇO TETO / VALUATION */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                Preço Teto / Valuation (R$)
              </label>
              {marginPct !== null && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                  marginPct >= 0 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}>
                  {marginPct >= 0 ? `+${marginPct.toFixed(1)}% Desconto` : `${marginPct.toFixed(1)}% Acima`}
                </span>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
              <input
                type="text"
                value={valuationStr}
                onChange={(e) => setValuationStr(e.target.value)}
                placeholder="Ex: 35,00 (Preço Teto de Graham / Bazin)"
                className="w-full pl-9 pr-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-bold text-foreground focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Opcional. Se o preço de mercado superar o teto, o motor sinaliza margem de segurança negativa.
            </p>
          </div>

          {/* TRAVA DE APORTE */}
          <div className="p-3 bg-muted/30 border border-border/60 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg border ${locked ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' : 'bg-muted text-muted-foreground border-border'}`}>
                {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-xs font-bold text-foreground block">Travar Ativo contra Aportes</span>
                <span className="text-[10px] text-muted-foreground">Não sugerir compras para este ativo na rodada</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLocked(!locked)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                locked
                  ? 'bg-rose-500 text-white border-rose-500'
                  : 'bg-background border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {locked ? 'Travado' : 'Destravado'}
            </button>
          </div>

          {/* ÁREA DE EXCLUSÃO */}
          {showDeleteConfirm ? (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block">
                Tem certeza que deseja remover {ticker} das Metas Alvo?
              </span>
              <p className="text-[10px] text-muted-foreground">
                {isInPortfolio 
                  ? 'O ativo continuará em sua carteira, mas sua meta será excluída do rebalanceamento.'
                  : 'O ativo deixará de fazer parte das metas e não receberá mais sugestões de aporte.'}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1 bg-background border border-border rounded-lg text-xs font-bold text-foreground cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Confirmar Exclusão</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir este ativo das Metas Alvo</span>
              </button>
            </div>
          )}

          {/* ACTIONS */}
          <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-muted/60 hover:bg-muted text-foreground text-xs font-bold rounded-xl border border-border transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
