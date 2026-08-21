import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  X, 
  Search, 
  RefreshCw, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { CurrencyInput } from '../CurrencyInput';
import { fetchSingleQuote } from '../../lib/quoteService';
import { toast } from 'sonner';

export interface CustomRebalanceAsset {
  ticker: string;
  type: string;
  price: number;
  targetPct: number;
  isCustom?: boolean;
}

interface AddRebalanceAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAsset: (asset: CustomRebalanceAsset) => void;
  existingTickers: string[];
  leftoverTargetPct: number;
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

const SUGGESTED_ASSETS = [
  { ticker: 'WEGE3', type: 'Ação', name: 'WEG S.A.' },
  { ticker: 'ITUB4', type: 'Ação', name: 'Itaú Unibanco' },
  { ticker: 'VALE3', type: 'Ação', name: 'Vale S.A.' },
  { ticker: 'PETR4', type: 'Ação', name: 'Petrobras' },
  { ticker: 'BBAS3', type: 'Ação', name: 'Banco do Brasil' },
  { ticker: 'MXRF11', type: 'FII', name: 'Maxi Renda FII' },
  { ticker: 'HGLG11', type: 'FII', name: 'CSHG Logística FII' },
  { ticker: 'KNCR11', type: 'FII', name: 'Kinea Rendimentos FII' },
  { ticker: 'XPML11', type: 'FII', name: 'XP Malls FII' },
  { ticker: 'IVVB11', type: 'ETF', name: 'iShares S&P 500' },
  { ticker: 'BOVA11', type: 'ETF', name: 'iShares Ibovespa' },
  { ticker: 'AAPL34', type: 'BDR', name: 'Apple Inc.' },
];

export function AddRebalanceAssetModal({
  isOpen,
  onClose,
  onAddAsset,
  existingTickers,
  leftoverTargetPct,
  brapiToken,
  formatCurrency
}: AddRebalanceAssetModalProps) {
  const [ticker, setTicker] = useState('');
  const [type, setType] = useState('Ação');
  const [priceStr, setPriceStr] = useState('');
  const [targetPct, setTargetPct] = useState(() => {
    if (leftoverTargetPct > 0) {
      return Math.min(25, Number(leftoverTargetPct.toFixed(1)));
    }
    return 10;
  });
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [quoteProviderUsed, setQuoteProviderUsed] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTicker('');
      setType('Ação');
      setPriceStr('');
      setTargetPct(leftoverTargetPct > 0 ? Math.min(25, Number(leftoverTargetPct.toFixed(1))) : 10);
      setQuoteProviderUsed(null);
    }
  }, [isOpen, leftoverTargetPct]);

  if (!isOpen) return null;

  const handleTickerChange = (raw: string) => {
    const clean = raw.toUpperCase().replace(/\s+/g, '');
    setTicker(clean);

    // Auto-detect type if ticker ends with 11
    if (clean.length >= 5 && clean.endsWith('11') && type === 'Ação') {
      setType('FII');
    } else if (clean.length >= 5 && clean.endsWith('34') && type === 'Ação') {
      setType('BDR');
    }
  };

  const handleFetchQuote = async (targetTicker?: string) => {
    const tk = (targetTicker || ticker).trim().toUpperCase();
    if (!tk) {
      toast.error('Digite o ticker do ativo primeiro.');
      return;
    }

    setIsFetchingQuote(true);
    setQuoteProviderUsed(null);
    try {
      const res = await fetchSingleQuote(tk, brapiToken);
      if (res && res.price > 0) {
        setPriceStr(res.price.toFixed(2).replace('.', ','));
        setQuoteProviderUsed(res.provider);
        toast.success(`Cotação de ${tk} obtida: ${formatCurrency(res.price)}`);
      } else {
        toast.warning(`Não foi possível obter cotação automática para ${tk}. Insira o valor manualmente.`);
      }
    } catch (err) {
      console.warn('Erro ao buscar cotação:', err);
      toast.error('Falha ao conectar com o serviço de cotações.');
    } finally {
      setIsFetchingQuote(false);
    }
  };

  const handleSelectSuggested = (s: { ticker: string; type: string }) => {
    setTicker(s.ticker);
    setType(s.type);
    handleFetchQuote(s.ticker);
  };

  const parseNumber = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/\./g, '').replace(',', '.');
    const num = Number(clean);
    return isNaN(num) ? 0 : num;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTicker = ticker.trim().toUpperCase();

    if (!cleanTicker) {
      toast.error('Informe o código / ticker do ativo.');
      return;
    }

    if (existingTickers.includes(cleanTicker)) {
      toast.error(`O ativo ${cleanTicker} já faz parte do plano de rebalanceamento.`);
      return;
    }

    const price = parseNumber(priceStr);
    if (price <= 0) {
      toast.error('Informe um preço estimado válido para a cota.');
      return;
    }

    if (targetPct < 0 || targetPct > 100) {
      toast.error('A meta percentual deve estar entre 0% e 100%.');
      return;
    }

    onAddAsset({
      ticker: cleanTicker,
      type,
      price,
      targetPct: Number(targetPct.toFixed(1)),
      isCustom: true
    });

    toast.success(`Ativo ${cleanTicker} adicionado ao plano de rebalanceamento com meta de ${targetPct}%!`);
    onClose();
  };

  // Filter suggestions to exclude already configured tickers
  const availableSuggestions = SUGGESTED_ASSETS.filter(
    s => !existingTickers.includes(s.ticker)
  ).slice(0, 6);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="w-full max-w-lg bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
              <PlusCircle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-foreground">
                Adicionar Ativo ao Rebalanceamento
              </h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Inclua um novo ativo em estudo para receber aportes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/85 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MODAL FORM */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 no-scrollbar">
          {/* Quick Suggestions Chips */}
          {availableSuggestions.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Sugestões Rápidas:
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto p-0.5 no-scrollbar">
                {availableSuggestions.map(s => (
                  <button
                    key={s.ticker}
                    type="button"
                    onClick={() => handleSelectSuggested(s)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-border/60 bg-muted/40 hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <span>{s.ticker}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-secondary text-secondary-foreground">
                      {s.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ticker & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">
                Código / Ticker <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={ticker}
                  onChange={e => handleTickerChange(e.target.value)}
                  placeholder="Ex: WEGE3, MXRF11"
                  className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-sm font-black text-foreground uppercase tracking-wider outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => handleFetchQuote()}
                  disabled={!ticker || isFetchingQuote}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-xl text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10 transition-all disabled:opacity-30"
                  title="Buscar cotação do mercado"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetchingQuote ? 'animate-spin text-indigo-500' : ''}`} />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">
                Tipo de Ativo
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full bg-background border border-border/70 rounded-xl px-3 py-2.5 text-xs font-black text-foreground outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
              >
                {COMMON_ASSET_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Price & Target % */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                  Preço Estimado (R$) <span className="text-rose-500">*</span>
                </label>
                {quoteProviderUsed && (
                  <span className="text-[8.5px] font-extrabold text-indigo-500 uppercase bg-indigo-500/10 px-1.5 py-0.5 rounded">
                    {quoteProviderUsed}
                  </span>
                )}
              </div>
              <CurrencyInput
                value={priceStr}
                onChange={setPriceStr}
                placeholder="0,00"
                className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-sm font-black text-foreground outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-indigo-500" />
                  Meta Ideal (%) <span className="text-rose-500">*</span>
                </label>
                {leftoverTargetPct > 0 && (
                  <button
                    type="button"
                    onClick={() => setTargetPct(Number(leftoverTargetPct.toFixed(1)))}
                    className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Usar folga ({leftoverTargetPct.toFixed(1)}%)
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={targetPct}
                  onChange={e => setTargetPct(Number(e.target.value))}
                  className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-sm font-black text-foreground outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                  required
                />
                <span className="text-sm font-black text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          {/* Quick preset buttons for target pct */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[9px] font-bold text-muted-foreground uppercase mr-1">Metas Rápidas:</span>
            {[5, 10, 15, 20, 25].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setTargetPct(p)}
                className={`px-2 py-0.5 text-xs font-bold rounded-lg border transition-all ${
                  targetPct === p 
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                    : 'border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                {p}%
              </button>
            ))}
          </div>

          {/* Info Banner */}
          <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Como funciona no Rebalanceamento?
            </div>
            <p className="text-[10px] leading-relaxed">
              Como você ainda não possui cotas desse ativo, a carteira o considerará com <strong>0 cotas atuais</strong>. O assistente calculará a quantidade ideal de cotas para comprar com o seu novo aporte até atingir a meta estipulada.
            </p>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-500/10 transition-all flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              Adicionar ao Plano
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
