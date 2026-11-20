import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  Sliders, 
  Car, 
  Coins, 
  TrendingUp, 
  Calendar, 
  Check, 
  Tag, 
  ShieldCheck, 
  Layers, 
  AlertCircle,
  HelpCircle,
  Zap,
  Rocket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Reserve, Transaction, UserSettings, ReserveTransaction } from '../../types';
import { 
  iconOptions, 
  formatCurrency, 
  isTxInPeriod, 
  getPeriodDisplayLabel, 
  getTodayLocalDateStr,
  toDateInputString,
  getDefaultBoostValue
} from './reserveUtils';
import { toast } from '@/lib/toast';

interface UpdateRuleModalProps {
  reserve: Reserve | null;
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  reserveTransactions: ReserveTransaction[];
  settings: UserSettings | null;
  globalPeriod: string;
  customDateRange: { start: string; end: string };
  onSaveRule: (reserveId: string, ruleData: {
    regra_ativa: boolean;
    regra_tipo?: Reserve['regra_tipo'];
    regra_valor?: number | null;
    regra_categorias?: string[];
    regra_inicio_validade?: string;
    require_category_on_use?: boolean;
    default_use_category?: string | null;
    boost_ativo?: boolean;
    boost_tipo?: 'increment' | 'multiplier' | null;
    boost_valor?: number | null;
    reset_suggestion_on_withdraw?: boolean;
  }) => Promise<void>;
}

export function UpdateRuleModal({
  reserve,
  isOpen,
  onClose,
  transactions = [],
  reserveTransactions = [],
  settings,
  globalPeriod,
  customDateRange,
  onSaveRule
}: UpdateRuleModalProps) {
  // Income categories from profile settings
  const profileIncomeCategories = useMemo(() => {
    const fromSettings = settings?.income_categories || [];
    if (fromSettings.length > 0) return fromSettings;

    // Fallback if settings are empty
    const fromTx = Array.from(
      new Set(
        transactions
          .filter(t => t.type === 'income' && t.category)
          .map(t => t.category as string)
      )
    );
    const defaults = ['iFood', 'Uber', '99Moto', 'Particular', 'Gorjeta', 'Frete do Dia', 'Pizzaria', 'Outros'];
    return Array.from(new Set([...defaults, ...fromTx]));
  }, [settings, transactions]);

  // Expense categories from profile settings
  const profileExpenseCategories = useMemo(() => {
    const fromSettings = settings?.expense_categories && settings.expense_categories.length > 0
      ? settings.expense_categories
      : [
          ...(settings?.operational_expense_categories || []),
          ...(settings?.personal_expense_categories || [])
        ];
    
    if (fromSettings.length > 0) return Array.from(new Set(fromSettings));

    const fromTx = Array.from(
      new Set(
        transactions
          .filter(t => t.type === 'expense' && t.category)
          .map(t => t.category as string)
      )
    );
    const defaults = ['Combustível', 'Pedágio', 'Manutenção', 'Alimentação', 'Plano de Internet', 'Equipamento', 'Outras Despesas', 'Outros'];
    return Array.from(new Set([...defaults, ...fromTx]));
  }, [settings, transactions]);

  // Form State
  const [regraAtiva, setRegraAtiva] = useState(false);
  const [regraTipo, setRegraTipo] = useState<Reserve['regra_tipo'] | ''>('km');
  const [regraValor, setRegraValor] = useState('');
  const [regraCategorias, setRegraCategorias] = useState<string[]>([]);
  const [effectiveDate, setEffectiveDate] = useState<string>(getTodayLocalDateStr());
  const [requireCategoryOnUse, setRequireCategoryOnUse] = useState<boolean>(true);
  const [defaultUseCategory, setDefaultUseCategory] = useState<string>('');
  const [boostAtivo, setBoostAtivo] = useState<boolean>(false);
  const [boostTipo, setBoostTipo] = useState<'increment' | 'multiplier'>('increment');
  const [boostValor, setBoostValor] = useState<string>('');
  const [resetSuggestionOnWithdraw, setResetSuggestionOnWithdraw] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track open state & reserve id so we only initialize when modal opens or target reserve changes!
  // This prevents user input from reverting while typing when background sync or parent re-renders happen.
  const prevIsOpenRef = useRef(false);
  const prevReserveIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      return;
    }

    const isFirstOpen = !prevIsOpenRef.current;
    const isDifferentReserve = (reserve?.id || null) !== prevReserveIdRef.current;

    if (isFirstOpen || isDifferentReserve) {
      prevIsOpenRef.current = true;
      prevReserveIdRef.current = reserve?.id || null;

      if (reserve) {
        setRegraAtiva(Boolean(reserve.regra_ativa));
        setRegraTipo(reserve.regra_tipo || 'km');
        const initialDate = toDateInputString(reserve.regra_inicio_validade) || getTodayLocalDateStr();
        setEffectiveDate(initialDate);
        setRegraValor(
          reserve.regra_valor !== undefined && reserve.regra_valor !== null
            ? String(Math.round(Number(reserve.regra_valor) * 100) / 100)
            : ''
        );

        const bType = (reserve.boost_tipo || 'increment') as 'increment' | 'multiplier';
        setBoostAtivo(Boolean(reserve.boost_ativo));
        setBoostTipo(bType);
        setBoostValor(
          reserve.boost_valor !== undefined && reserve.boost_valor !== null && Number(reserve.boost_valor) > 0
            ? String(Number(reserve.boost_valor))
            : String(getDefaultBoostValue(reserve.regra_tipo || 'km', bType))
        );
        setResetSuggestionOnWithdraw(reserve.reset_suggestion_on_withdraw !== false);
        
        const savedCats = reserve.regra_categorias && reserve.regra_categorias.length > 0
          ? reserve.regra_categorias
          : profileIncomeCategories;
        setRegraCategorias(savedCats);

        // Require category on use or fixed default category
        const requireOnUse = reserve.require_category_on_use !== undefined
          ? Boolean(reserve.require_category_on_use)
          : !reserve.default_use_category;
        
        setRequireCategoryOnUse(requireOnUse);
        setDefaultUseCategory(
          reserve.default_use_category || 
          (profileExpenseCategories.includes('Manutenção') ? 'Manutenção' : profileExpenseCategories[0] || 'Outros')
        );
      }
    }
  }, [isOpen, reserve?.id]);

  if (!isOpen || !reserve) return null;

  const IconComp = iconOptions[reserve.icon] || Sliders;

  // Toggle category helper
  const handleToggleCategory = (cat: string) => {
    if (regraCategorias.includes(cat)) {
      setRegraCategorias(regraCategorias.filter(c => c !== cat));
    } else {
      setRegraCategorias([...regraCategorias, cat]);
    }
  };

  const handleSelectAllCategories = () => {
    setRegraCategorias(profileIncomeCategories);
  };

  const handleClearCategories = () => {
    setRegraCategorias([]);
  };

  // Real-time Simulation calculation based on currently typed parameters
  const simulatedSuggestion = () => {
    if (!regraAtiva || !regraTipo) return 0;
    const cleanStr = String(regraValor || '').replace(',', '.').trim();
    const baseVal = parseFloat(cleanStr);
    if (isNaN(baseVal) || baseVal <= 0) return 0;

    const cleanBoostStr = String(boostValor || '').replace(',', '.').trim();
    const parsedBoost = parseFloat(cleanBoostStr);
    let val = baseVal;
    if (boostAtivo && !isNaN(parsedBoost)) {
      if (boostTipo === 'multiplier' && parsedBoost > 1) {
        val = baseVal * parsedBoost;
      } else if (boostTipo === 'increment' && parsedBoost > 0) {
        val = baseVal + parsedBoost;
      }
      if (regraTipo === 'bruto' || regraTipo === 'liquido') {
        val = Math.min(100, val);
      }
    }

    const effDate = toDateInputString(effectiveDate);
    const periodTxs = (transactions || []).filter(t => {
      if (effDate && t.date < effDate) return false;
      return isTxInPeriod(t.date, globalPeriod, customDateRange);
    });

    let total = 0;
    if (regraTipo === 'km') {
      const eligible = periodTxs.filter(
        t => t.type === 'income' && regraCategorias.includes(t.category) && t.start_km !== null && t.end_km !== null
      );
      eligible.forEach(t => {
        const distance = (Number(t.end_km) || 0) - (Number(t.start_km) || 0);
        if (distance > 0) {
          total += distance * val;
        }
      });
    } else if (regraTipo === 'bruto') {
      const eligible = periodTxs.filter(
        t => t.type === 'income' && regraCategorias.includes(t.category)
      );
      const gross = eligible.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      total = gross * (val / 100);
    } else if (regraTipo === 'liquido') {
      const totalIncome = periodTxs
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const totalExpense = periodTxs
        .filter(t => t.type === 'expense' && !(t as any).isReserveTx && t.category !== 'Aporte Reserva')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const netProfit = Math.max(0, totalIncome - totalExpense);
      total = netProfit * (val / 100);
    } else if (regraTipo === 'fixo' || (regraTipo as string) === 'fixo_diario') {
      const eligible = periodTxs.filter(
        t => t.type === 'income' && regraCategorias.includes(t.category)
      );
      const uniqueDays = new Set(eligible.map(t => t.date));
      total = uniqueDays.size * val;
    }

    if (reserve.meta_objetivo && reserve.meta_objetivo > 0 && total > reserve.meta_objetivo) {
      total = reserve.meta_objetivo;
    }

    return Math.round(total * 100) / 100;
  };

  const currentSimulatedVal = simulatedSuggestion();

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanStr = String(regraValor || '').replace(',', '.').trim();
    const parsedVal = cleanStr ? Math.round((parseFloat(cleanStr) || 0) * 100) / 100 : undefined;

    const cleanBoostStr = String(boostValor || '').replace(',', '.').trim();
    const parsedBoostVal = cleanBoostStr ? Math.round((parseFloat(cleanBoostStr) || 0) * 10000) / 10000 : 0;

    if (regraAtiva) {
      if (!regraTipo) {
        toast.error('Selecione o tipo de cálculo para a regra.');
        return;
      }
      if (parsedVal === undefined || isNaN(parsedVal) || parsedVal <= 0) {
        toast.error('Informe um valor válido maior que zero para a regra.');
        return;
      }
      if ((regraTipo === 'bruto' || regraTipo === 'liquido') && parsedVal > 100) {
        toast.error('O percentual não pode ser maior que 100%.');
        return;
      }
      if ((regraTipo === 'km' || regraTipo === 'bruto' || regraTipo === 'fixo') && regraCategorias.length === 0) {
        toast.error('Selecione ao menos uma categoria de receita elegível no seu perfil.');
        return;
      }
      if (boostAtivo) {
        if (boostTipo === 'multiplier' && parsedBoostVal <= 1) {
          toast.error('No Modo Boost por multiplicador, informe um fator maior que 1x.');
          return;
        }
        if (boostTipo === 'increment' && parsedBoostVal <= 0) {
          toast.error('Informe um valor de acréscimo válido para o Modo Boost.');
          return;
        }
      }
    }

    // Validate default category if not requiring on use
    if (!requireCategoryOnUse && !defaultUseCategory) {
      toast.error('Como você optou por não exigir categoria no resgate, defina a Categoria Fixa.');
      return;
    }

    try {
      setIsSubmitting(true);

      await onSaveRule(reserve.id, {
        regra_ativa: regraAtiva,
        regra_tipo: regraAtiva ? (regraTipo as any) : null,
        regra_valor: regraAtiva ? parsedVal : null,
        regra_categorias: regraAtiva ? regraCategorias : [],
        regra_inicio_validade: toDateInputString(effectiveDate) || getTodayLocalDateStr(),
        require_category_on_use: requireCategoryOnUse,
        default_use_category: !requireCategoryOnUse ? defaultUseCategory : null,
        boost_ativo: regraAtiva ? boostAtivo : false,
        boost_tipo: boostTipo,
        boost_valor: parsedBoostVal > 0 ? parsedBoostVal : getDefaultBoostValue(regraTipo || 'km', boostTipo),
        reset_suggestion_on_withdraw: resetSuggestionOnWithdraw,
      } as any);

      toast.success(`Regra de aporte de ${reserve.name} atualizada com sucesso!`);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao atualizar regra: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-card w-full max-w-lg rounded-3xl border border-border/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto text-left">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border-b border-border/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
              style={{ backgroundColor: reserve.color || '#6366f1' }}
            >
              <IconComp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-black text-foreground">
                  Atualizar Regra de Aporte
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {reserve.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                Defina automação de sugestões e regras de resgate no perfil
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="w-8 h-8 p-0 rounded-full cursor-pointer">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Status da Regra Toggle */}
          <div className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
            regraAtiva 
              ? 'bg-indigo-500/10 border-indigo-500/30' 
              : 'bg-muted/40 border-border/80'
          }`}>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className={`w-4 h-4 ${regraAtiva ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}`} />
                <h4 className="text-xs font-black text-foreground">
                  Sugestão Automática de Aportes
                </h4>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">
                {regraAtiva 
                  ? 'A regra calculará automaticamente o valor sugerido nos períodos de trabalho.' 
                  : 'Desativada: nenhum cálculo de sugestão será emitido para esta reserva.'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={regraAtiva}
                onChange={e => {
                  const checked = e.target.checked;
                  setRegraAtiva(checked);
                  if (checked && reserve && !reserve.regra_ativa) {
                    setEffectiveDate(getTodayLocalDateStr());
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {regraAtiva && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Tipo de Regra */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                  Tipo de Cálculo
                </label>
                <Select value={regraTipo || 'km'} onValueChange={(val: any) => setRegraTipo(val)}>
                  <SelectTrigger className="h-10 text-xs font-bold rounded-xl bg-card">
                    <SelectValue placeholder="Selecione o tipo de cálculo..." />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="km" className="cursor-pointer">
                      🚗 R$ por KM Rodado (ideal p/ manutenção, desgastes e pneus)
                    </SelectItem>
                    <SelectItem value="bruto" className="cursor-pointer">
                      💰 % do Faturamento Bruto (ex: 5% ou 10% da receita total)
                    </SelectItem>
                    <SelectItem value="liquido" className="cursor-pointer">
                      📈 % do Lucro Líquido (ex: 15% do que sobra após despesas)
                    </SelectItem>
                    <SelectItem value="fixo" className="cursor-pointer">
                      📅 R$ Fixo por Dia Trabalhado (ex: R$ 10,00 ou R$ 20,00 por dia)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Valor da Regra */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground">
                    {regraTipo === 'km' && 'Valor em R$ por cada KM rodado:'}
                    {regraTipo === 'bruto' && 'Percentual (%) sobre a Receita Bruta:'}
                    {regraTipo === 'liquido' && 'Percentual (%) sobre o Lucro Líquido:'}
                    {regraTipo === 'fixo' && 'Valor em R$ fixo por dia trabalhado:'}
                  </label>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    {regraTipo === 'km' && 'Ex: 0.15 (R$ 0,15/km)'}
                    {regraTipo === 'bruto' && 'Ex: 5 (5% do bruto)'}
                    {regraTipo === 'liquido' && 'Ex: 10 (10% do lucro)'}
                    {regraTipo === 'fixo' && 'Ex: 15 (R$ 15,00/dia)'}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    {regraTipo === 'bruto' || regraTipo === 'liquido' ? '%' : 'R$'}
                  </span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    required={regraAtiva}
                    value={regraValor}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9.,]/g, '');
                      setRegraValor(val);
                    }}
                    className="pl-9 h-10 text-xs font-mono font-bold rounded-xl"
                  />
                </div>

                {/* Quick value presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Atalhos:</span>
                  {regraTipo === 'km' && [0.10, 0.15, 0.20, 0.25].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRegraValor(String(val))}
                      className="px-2 py-0.5 rounded-lg border border-border/80 text-[10px] font-bold hover:bg-muted text-foreground transition-all cursor-pointer"
                    >
                      R$ {val.toFixed(2)}
                    </button>
                  ))}
                  {(regraTipo === 'bruto' || regraTipo === 'liquido') && [5, 10, 15, 20].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRegraValor(String(val))}
                      className="px-2 py-0.5 rounded-lg border border-border/80 text-[10px] font-bold hover:bg-muted text-foreground transition-all cursor-pointer"
                    >
                      {val}%
                    </button>
                  ))}
                  {regraTipo === 'fixo' && [10, 15, 20, 30].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRegraValor(String(val))}
                      className="px-2 py-0.5 rounded-lg border border-border/80 text-[10px] font-bold hover:bg-muted text-foreground transition-all cursor-pointer"
                    >
                      R$ {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Categorias Elegíveis do Perfil */}
              {(regraTipo === 'km' || regraTipo === 'bruto' || regraTipo === 'fixo') && (
                <div className="space-y-2 p-3 bg-muted/25 rounded-2xl border border-border/70">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-foreground flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 text-indigo-500" />
                        Categorias de Receita do Perfil
                      </label>
                      <p className="text-[10px] text-muted-foreground">
                        Selecione quais receitas configuradas no seu perfil serão contabilizadas
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleSelectAllCategories}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Todas
                      </button>
                      <span className="text-muted-foreground text-xs">•</span>
                      <button
                        type="button"
                        onClick={handleClearCategories}
                        className="text-[11px] font-bold text-muted-foreground hover:underline cursor-pointer"
                      >
                        Nenhuma
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {profileIncomeCategories.map(cat => {
                      const isCatSelected = regraCategorias.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => handleToggleCategory(cat)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            isCatSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                        >
                          {isCatSelected && <Check className="w-3 h-3" />}
                          <span>{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Data de Início da Validade da Nova Regra */}
              <div className="p-3 bg-muted/40 rounded-2xl border border-border/80 space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    Início da Validade Temporal da Nova Regra
                  </label>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    A partir desta data
                  </span>
                </div>
                <Input
                  type="date"
                  required
                  value={effectiveDate}
                  onChange={e => setEffectiveDate(e.target.value)}
                  className="h-10 text-xs rounded-xl bg-card"
                />
                <p className="text-[10px] text-muted-foreground">
                  Transações e aportes anteriores a esta data serão calculados com base na regra que estava ativa na época.
                </p>
              </div>

              {/* Modo Boost da Regra */}
              <div className={`p-3 rounded-2xl border transition-all space-y-2.5 ${
                boostAtivo
                  ? 'bg-gradient-to-br from-amber-500/15 via-orange-500/5 to-transparent border-amber-500/40'
                  : 'bg-muted/25 border-border/80'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Rocket className={`w-3.5 h-3.5 ${boostAtivo ? 'text-amber-500' : 'text-muted-foreground'}`} />
                      <span className="text-xs font-black text-foreground">Modo Boost (Acelerador)</span>
                    </div>
                    <p className="text-[10.5px] text-muted-foreground">
                      Eleva temporariamente a regra sem alterar seu valor base.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={boostAtivo}
                      onChange={e => setBoostAtivo(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {boostAtivo && (
                  <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-amber-500/20">
                    <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/70 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setBoostTipo('increment');
                          setBoostValor(String(getDefaultBoostValue(regraTipo || 'km', 'increment')));
                        }}
                        className={`px-2 py-0.5 rounded-md cursor-pointer ${
                          boostTipo === 'increment' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'
                        }`}
                      >
                        + Valor
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBoostTipo('multiplier');
                          setBoostValor('1.5');
                        }}
                        className={`px-2 py-0.5 rounded-md cursor-pointer ${
                          boostTipo === 'multiplier' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'
                        }`}
                      >
                        Multi (x)
                      </button>
                    </div>

                    <Input
                      type="text"
                      inputMode="decimal"
                      value={boostValor}
                      onChange={e => setBoostValor(e.target.value.replace(/[^0-9.,]/g, ''))}
                      className="w-24 h-8 text-xs font-mono font-bold rounded-lg bg-card text-right"
                    />
                    <span className="text-[10.5px] font-bold text-amber-700 dark:text-amber-300">
                      {boostTipo === 'multiplier'
                        ? 'x sobre a regra'
                        : regraTipo === 'km'
                          ? '+ R$/km'
                          : regraTipo === 'bruto' || regraTipo === 'liquido'
                            ? '+ % na regra'
                            : '+ R$/dia'}
                    </span>
                  </div>
                )}
              </div>

              {/* Opção: Zerar sugestão ao realizar resgate */}
              <div className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                resetSuggestionOnWithdraw
                  ? 'bg-muted/35 border-border/80'
                  : 'bg-indigo-500/10 border-indigo-500/30'
              }`}>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className={`w-3.5 h-3.5 ${resetSuggestionOnWithdraw ? 'text-amber-500' : 'text-indigo-500'}`} />
                    <span className="text-xs font-black text-foreground">
                      Zerar sugestão ao fazer resgate
                    </span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground leading-snug">
                    {resetSuggestionOnWithdraw
                      ? 'Ativado: ao realizar um resgate pago, o acumulado da sugestão reinicia a partir da data do resgate.'
                      : 'Desativado: seus resgates não zeram nem reiniciam a sugestão calculada pela regra.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={resetSuggestionOnWithdraw}
                    onChange={e => setResetSuggestionOnWithdraw(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5.5 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Simulação em Tempo Real */}
              <div className="p-3 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent rounded-2xl border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Prévia Calculada ({getPeriodDisplayLabel(globalPeriod, customDateRange)})
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {boostAtivo ? 'Sugestão resultante (c/ Boost):' : 'Sugestão resultante no período:'}
                  </span>
                </div>
                <strong className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatCurrency(currentSimulatedVal)}
                </strong>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* Seção: Regras de Resgate / Exigência de Categoria */}
          {/* ======================================================= */}
          <div className="space-y-3 pt-3 border-t border-border/80">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-500" />
              <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                Controle de Categoria no Resgate
              </h4>
            </div>

            <div className="p-3.5 bg-muted/30 rounded-2xl border border-border/80 space-y-3">
              {/* Opção de Exigência */}
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="require_category_mode"
                    checked={requireCategoryOnUse}
                    onChange={() => setRequireCategoryOnUse(true)}
                    className="mt-0.5 w-4 h-4 text-indigo-600 accent-indigo-600 cursor-pointer"
                  />
                  <div className="text-xs leading-tight">
                    <span className="font-bold text-foreground block">
                      Exigir escolha de categoria de despesa a cada resgate
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      Ao resgatar, você escolherá manualmente entre as categorias de despesas cadastradas no seu perfil.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="radio"
                    name="require_category_mode"
                    checked={!requireCategoryOnUse}
                    onChange={() => setRequireCategoryOnUse(false)}
                    className="mt-0.5 w-4 h-4 text-indigo-600 accent-indigo-600 cursor-pointer"
                  />
                  <div className="text-xs leading-tight">
                    <span className="font-bold text-foreground block">
                      Definir uma Categoria de Despesa Fixa para esta reserva
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      Os resgates desta reserva serão lançados automaticamente sob uma categoria pré-determinada.
                    </span>
                  </div>
                </label>
              </div>

              {/* Se Categoria Fixa Selecionada: Escolher qual Categoria de Despesa do Perfil */}
              {!requireCategoryOnUse && (
                <div className="space-y-1.5 pt-2 border-t border-border/60 animate-in fade-in duration-150">
                  <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                    <span>Categoria Fixa no seu Perfil:</span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Obrigatório</span>
                  </label>
                  <Select value={defaultUseCategory} onValueChange={setDefaultUseCategory}>
                    <SelectTrigger className="h-10 text-xs font-bold rounded-xl bg-card">
                      <SelectValue placeholder="Selecione a categoria de despesa fixa..." />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      {profileExpenseCategories.map(cat => (
                        <SelectItem key={cat} value={cat} className="cursor-pointer">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/80">
            <Button type="button" variant="ghost" onClick={onClose} className="h-10 text-xs font-bold cursor-pointer">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-6 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-500/20 cursor-pointer"
            >
              {isSubmitting ? 'Atualizando...' : 'Salvar Atualização da Regra'}
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
}
