import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PiggyBank, 
  X, 
  Check, 
  Sparkles, 
  Target, 
  Sliders, 
  Layers, 
  HelpCircle,
  Zap,
  Tag,
  ShieldCheck,
  Calculator,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Reserve, ReserveTransaction, Transaction, UserSettings } from '../../types';
import {
  iconOptions,
  COLOR_PALETTE,
  formatCurrency,
  toDateInputString,
  getTodayLocalDateStr,
  calculateReserveGoalProjection,
  formatEstimatedTimeline
} from './reserveUtils';
import { toast } from '@/lib/toast';

interface ReserveModalProps {
  isOpen: boolean;
  onClose: () => void;
  reserveToEdit: Reserve | null;
  transactions: Transaction[];
  reserveTransactions?: ReserveTransaction[];
  settings?: UserSettings | null;
  onSave: (reserveData: Partial<Reserve>, initialBalance?: number) => Promise<void>;
}

export function ReserveModal({
  isOpen,
  onClose,
  reserveToEdit,
  transactions,
  reserveTransactions = [],
  settings,
  onSave
}: ReserveModalProps) {
  const isEditing = !!reserveToEdit;

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [metaObjetivo, setMetaObjetivo] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [icon, setIcon] = useState('PiggyBank');
  const [color, setColor] = useState('#6366f1');

  // Automation states
  const [regraAtiva, setRegraAtiva] = useState(false);
  const [regraTipo, setRegraTipo] = useState<Reserve['regra_tipo'] | ''>('');
  const [regraValor, setRegraValor] = useState('');
  const [regraCategorias, setRegraCategorias] = useState<string[]>([]);
  const [regraInicioValidade, setRegraInicioValidade] = useState<string>(getTodayLocalDateStr());
  const [requireCategoryOnUse, setRequireCategoryOnUse] = useState<boolean>(true);
  const [defaultUseCategory, setDefaultUseCategory] = useState<string>('');
  const [simHorizonDays, setSimHorizonDays] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tab
  const [activeTab, setActiveTab] = useState<'general' | 'automation'>('general');

  // Income categories from profile settings
  const allCategories = useMemo(() => {
    const fromSettings = settings?.income_categories || [];
    if (fromSettings.length > 0) return fromSettings;

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
    return ['Combustível', 'Pedágio', 'Manutenção', 'Alimentação', 'Plano de Internet', 'Equipamento', 'Outras Despesas', 'Emergência', 'Outros'];
  }, [settings]);

  // Track modal open state & reserve id so we only initialize when modal opens or target changes
  const prevIsOpenRef = useRef(false);
  const prevReserveIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      return;
    }

    const isFirstOpen = !prevIsOpenRef.current;
    const isDifferent = (reserveToEdit?.id || null) !== prevReserveIdRef.current;

    if (isFirstOpen || isDifferent) {
      prevIsOpenRef.current = true;
      prevReserveIdRef.current = reserveToEdit?.id || null;

      if (reserveToEdit) {
        setName(reserveToEdit.name || '');
        setDescription(reserveToEdit.description || '');
        setMetaObjetivo(reserveToEdit.meta_objetivo ? String(reserveToEdit.meta_objetivo) : '');
        setTargetDate(toDateInputString(reserveToEdit.target_date) || '');
        setIcon(reserveToEdit.icon || 'PiggyBank');
        setColor(reserveToEdit.color || '#6366f1');
        setRegraAtiva(!!reserveToEdit.regra_ativa);
        setRegraTipo(reserveToEdit.regra_tipo || '');
        setRegraValor(reserveToEdit.regra_valor !== undefined && reserveToEdit.regra_valor !== null ? String(reserveToEdit.regra_valor) : '');
        setRegraCategorias(reserveToEdit.regra_categorias && reserveToEdit.regra_categorias.length > 0 ? reserveToEdit.regra_categorias : allCategories);
        const initValidade = toDateInputString(reserveToEdit.regra_inicio_validade) || getTodayLocalDateStr();
        setRegraInicioValidade(initValidade);
        
        const reqCat = reserveToEdit.require_category_on_use !== undefined
          ? Boolean(reserveToEdit.require_category_on_use)
          : !reserveToEdit.default_use_category;
        setRequireCategoryOnUse(reqCat);
        setDefaultUseCategory(reserveToEdit.default_use_category || profileExpenseCategories[0] || 'Manutenção');
        setInitialBalance('');
      } else {
        setName('');
        setDescription('');
        setInitialBalance('');
        setMetaObjetivo('');
        setTargetDate('');
        setIcon('PiggyBank');
        setColor('#6366f1');
        setRegraAtiva(false);
        setRegraTipo('');
        setRegraValor('');
        setRegraCategorias(allCategories);
        setRegraInicioValidade(getTodayLocalDateStr());
        setRequireCategoryOnUse(true);
        setDefaultUseCategory(profileExpenseCategories[0] || 'Manutenção');
      }
      setActiveTab('general');
    }
  }, [isOpen, reserveToEdit?.id]);

  if (!isOpen) return null;

  const handleToggleCategory = (cat: string) => {
    if (regraCategorias.includes(cat)) {
      setRegraCategorias(regraCategorias.filter(c => c !== cat));
    } else {
      setRegraCategorias([...regraCategorias, cat]);
    }
  };

  const handleSelectAllCategories = () => {
    setRegraCategorias(allCategories);
  };

  const handleClearCategories = () => {
    setRegraCategorias([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe o nome da reserva.');
      return;
    }

    const cleanRegraStr = String(regraValor || '').replace(',', '.').trim();
    const parsedRegraVal = cleanRegraStr ? Math.round(parseFloat(cleanRegraStr) * 100) / 100 : undefined;

    if (regraAtiva && (!regraTipo || parsedRegraVal === undefined || isNaN(parsedRegraVal) || parsedRegraVal <= 0)) {
      toast.error('Ao ativar a regra de aporte, defina o tipo e um valor válido.');
      return;
    }

    if (regraAtiva && (regraTipo === 'bruto' || regraTipo === 'liquido') && parsedRegraVal && parsedRegraVal > 100) {
      toast.error('O percentual da regra não pode ser maior que 100%.');
      return;
    }

    if (!requireCategoryOnUse && !defaultUseCategory) {
      toast.error('Informe a categoria de despesa fixa para o resgate.');
      return;
    }

    try {
      setIsSubmitting(true);

      const cleanMetaStr = String(metaObjetivo || '').replace(',', '.').trim();
      const parsedMeta = cleanMetaStr ? Math.round(parseFloat(cleanMetaStr) * 100) / 100 : 0;

      const payload: Partial<Reserve> = {
        name: name.trim(),
        description: description.trim(),
        meta_objetivo: isNaN(parsedMeta) ? 0 : parsedMeta,
        target_date: targetDate ? toDateInputString(targetDate) || null : null,
        icon,
        color,
        regra_ativa: regraAtiva,
        regra_tipo: regraAtiva ? (regraTipo as any) : null,
        regra_valor: regraAtiva && parsedRegraVal !== undefined && !isNaN(parsedRegraVal) ? parsedRegraVal : null,
        regra_categorias: regraAtiva ? regraCategorias : [],
        regra_inicio_validade: regraAtiva ? (toDateInputString(regraInicioValidade) || getTodayLocalDateStr()) : null,
        require_category_on_use: requireCategoryOnUse,
        default_use_category: !requireCategoryOnUse ? defaultUseCategory : null
      };

      const cleanInitStr = String(initialBalance || '').replace(',', '.').trim();
      const parsedInit = cleanInitStr ? Math.round(parseFloat(cleanInitStr) * 100) / 100 : 0;
      const initBalNum = isNaN(parsedInit) ? 0 : parsedInit;
      await onSave(payload, isEditing ? undefined : initBalNum);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const SelectedIconComp = iconOptions[icon] || PiggyBank;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-lg rounded-3xl border border-border/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-500/10 via-card to-purple-500/10 border-b border-border/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
              style={{ backgroundColor: color }}
            >
              <SelectedIconComp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">
                {isEditing ? 'Editar Reserva' : 'Nova Reserva Financeira'}
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Configure metas, visualização e automação de aportes
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="w-8 h-8 p-0 rounded-full cursor-pointer">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border/80 px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Dados Gerais & Visual
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('automation')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'automation'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Regras & Resgates</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-left">
          {activeTab === 'general' ? (
            <div className="space-y-4">
              {/* Name & Goal */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Nome da Reserva *
                </label>
                <Input
                  placeholder="Ex: IPVA & Seguro, Manutenção, Férias"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Descrição / Objetivo</label>
                <Input
                  placeholder="Ex: Cobrir revisões de 10.000km e pneus"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Meta de Saldo (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 2000.00"
                    value={metaObjetivo}
                    onChange={e => setMetaObjetivo(e.target.value)}
                    className="h-10 text-xs rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      Prazo Fixo (Opcional)
                    </span>
                    {targetDate && (
                      <button
                        type="button"
                        onClick={() => setTargetDate('')}
                        className="text-[10px] font-bold text-muted-foreground hover:text-rose-500 cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </label>
                  <Input
                    type="date"
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className="h-10 text-xs rounded-xl font-mono"
                    title="Data limite para atingir a meta (Ex: IPVA ou Férias)"
                  />
                </div>

                {!isEditing && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold text-muted-foreground">Saldo Inicial (R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={initialBalance}
                      onChange={e => setInitialBalance(e.target.value)}
                      className="h-10 text-xs rounded-xl font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Simulador de Impacto de Metas ("E se...?") */}
              {(() => {
                const parsedNewGoal = Math.round((parseFloat(String(metaObjetivo || '').replace(',', '.').trim()) || 0) * 100) / 100;
                const currentBal = isEditing
                  ? Math.round(Number(reserveToEdit?.saldo_atual || 0) * 100) / 100
                  : Math.round((parseFloat(String(initialBalance || '').replace(',', '.').trim()) || 0) * 100) / 100;
                const prevGoal = isEditing ? Math.round(Number(reserveToEdit?.meta_objetivo || 0) * 100) / 100 : 0;
                const goalChanged = isEditing && Math.abs(parsedNewGoal - prevGoal) > 0.009;
                const goalDelta = Math.round((parsedNewGoal - prevGoal) * 100) / 100;

                if (parsedNewGoal <= 0) return null;

                const remainingNeeded = Math.max(0, Math.round((parsedNewGoal - currentBal) * 100) / 100);
                const parsedRuleVal = parseFloat(String(regraValor || '').replace(',', '.').trim()) || 0;
                const simulatedReserve: Reserve = {
                  id: reserveToEdit?.id || 'sim',
                  user_id: reserveToEdit?.user_id || '',
                  name: name || 'Simulação',
                  saldo_inicial: currentBal,
                  saldo_atual: currentBal,
                  meta_objetivo: parsedNewGoal,
                  target_date: targetDate ? toDateInputString(targetDate) || null : null,
                  icon,
                  color,
                  regra_ativa: regraAtiva,
                  regra_tipo: regraAtiva && regraTipo ? (regraTipo as any) : null,
                  regra_valor: regraAtiva ? parsedRuleVal : null,
                  regra_categorias: regraAtiva ? regraCategorias : [],
                  status: reserveToEdit?.status || 'active',
                  is_paused: reserveToEdit?.is_paused || false,
                  created_at: reserveToEdit?.created_at || new Date().toISOString(),
                };
                const simProjection = calculateReserveGoalProjection(
                  simulatedReserve,
                  transactions,
                  reserveTransactions
                );

                const requiredDaily = remainingNeeded > 0 ? remainingNeeded / simHorizonDays : 0;
                const requiredWeekly = requiredDaily * 7;
                const extraDailyNeeded = simProjection.dailyPace > 0
                  ? Math.max(0, requiredDaily - simProjection.dailyPace)
                  : requiredDaily;

                return (
                  <div className="space-y-2.5">
                    {goalChanged && (regraAtiva || reserveToEdit?.regra_ativa) && (
                      <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium leading-snug">
                        Ao alterar a meta, a contagem da sugestão de aporte será reiniciada a partir de agora para evitar acúmulo de dias e lançamentos anteriores.
                      </div>
                    )}

                    <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-muted/30 border border-indigo-500/25 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span className="text-[11px] font-black text-foreground uppercase tracking-wider">
                            Simulador "E se...?"
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {[30, 60, 90, 180].map(d => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setSimHorizonDays(d)}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                simHorizonDays === d
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'bg-card/80 text-muted-foreground hover:text-foreground border border-border/60'
                              }`}
                            >
                              {d}d
                            </button>
                          ))}
                        </div>
                      </div>

                      {remainingNeeded <= 0 ? (
                        <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          Saldo atual ({formatCurrency(currentBal)}) já atinge a meta definida!
                        </p>
                      ) : (
                        <div className="space-y-2 text-[11px]">
                          {simProjection.targetDateDisplay && simProjection.requiredDailyForDeadline !== null && (
                            <div className={`p-2 rounded-xl border ${
                              simProjection.isDeadlineExpired
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                                : simProjection.isOnTrackForDeadline
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                            }`}>
                              <div className="flex items-center justify-between gap-2 font-bold">
                                <span>
                                  Prazo até {simProjection.targetDateDisplay}
                                  {simProjection.daysUntilTarget !== null && simProjection.daysUntilTarget > 0
                                    ? ` (${simProjection.daysUntilTarget}d)`
                                    : ' (vencido)'}
                                </span>
                                <span className="font-mono font-black">
                                  {formatCurrency(simProjection.requiredDailyForDeadline)}/dia
                                </span>
                              </div>
                              {!simProjection.isDeadlineExpired && simProjection.requiredWeeklyForDeadline !== null && (
                                <p className="text-[10px] opacity-90 mt-0.5">
                                  Equivale a <strong className="font-mono">{formatCurrency(simProjection.requiredWeeklyForDeadline)}/sem</strong>
                                  {simProjection.dailyPace > 0 && (
                                    simProjection.isOnTrackForDeadline
                                      ? ' · Ritmo atual dentro do prazo'
                                      : ` · Reforce +${formatCurrency(Math.max(0, simProjection.requiredDailyForDeadline - simProjection.dailyPace))}/dia`
                                  )}
                                </p>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 rounded-xl bg-card/80 border border-border/60">
                              <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">
                                Aporte p/ {simHorizonDays} dias
                              </span>
                              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                {formatCurrency(requiredDaily)}/dia
                              </span>
                              <span className="block text-[9.5px] text-muted-foreground font-mono">
                                ({formatCurrency(requiredWeekly)}/sem)
                              </span>
                            </div>

                            <div className="p-2 rounded-xl bg-card/80 border border-border/60">
                              <span className="text-[9.5px] font-bold text-muted-foreground uppercase block">
                                Faltam p/ Meta
                              </span>
                              <span className="text-xs font-black text-foreground font-mono">
                                {formatCurrency(remainingNeeded)}
                              </span>
                              {goalChanged && (
                                <span className={`block text-[9.5px] font-bold font-mono ${goalDelta >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  {goalDelta >= 0 ? '+' : ''}{formatCurrency(goalDelta)} na meta
                                </span>
                              )}
                            </div>
                          </div>

                          {simProjection.dailyPace > 0 ? (
                            <p className="text-[10.5px] text-muted-foreground leading-snug">
                              No ritmo atual (<strong className="text-foreground font-mono">{formatCurrency(simProjection.dailyPace)}/dia</strong>), esta meta será atingida em{' '}
                              <strong className="text-indigo-600 dark:text-indigo-400">
                                {simProjection.estimatedDays !== null ? formatEstimatedTimeline(simProjection.estimatedDays) : '--'}
                              </strong>
                              {extraDailyNeeded > 0.05 && (
                                <> — para fechar em {simHorizonDays}d, reforce <strong className="text-amber-600 dark:text-amber-400 font-mono">+{formatCurrency(extraDailyNeeded)}/dia</strong></>
                              )}.
                            </p>
                          ) : (
                            <p className="text-[10.5px] text-muted-foreground leading-snug">
                              Para atingir {formatCurrency(parsedNewGoal)} em {simHorizonDays} dias, reserve cerca de{' '}
                              <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{formatCurrency(requiredDaily)}/dia</strong>.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Color Palette */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground">Cor do Tema ({COLOR_PALETTE.length} opções)</label>
                  <span className="text-[10px] font-mono text-muted-foreground">{color}</span>
                </div>
                <div className="grid grid-cols-8 sm:grid-cols-11 gap-2 pt-1 p-2 rounded-2xl border border-border/60 bg-muted/20">
                  {COLOR_PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                        color === c ? 'ring-2 ring-foreground scale-110 shadow-sm' : 'opacity-85 hover:opacity-100 hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    >
                      {color === c && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Selector */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground">Ícone Representativo ({Object.keys(iconOptions).length} opções)</label>
                  <span className="text-[10px] font-semibold text-muted-foreground">{icon}</span>
                </div>
                <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 pt-1 max-h-[190px] overflow-y-auto p-2 border border-border/60 rounded-2xl bg-muted/20">
                  {Object.keys(iconOptions).map(iconKey => {
                    const IconComponent = iconOptions[iconKey];
                    const isSelected = icon === iconKey;
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setIcon(iconKey)}
                        title={iconKey}
                        className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'text-white shadow-xs scale-105'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                        style={isSelected ? { backgroundColor: color } : undefined}
                      >
                        <IconComponent className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Automation Switch */}
              <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/80 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Habilitar Sugestão Automática</h4>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Calcula a quantia ideal a aportar baseado nos seus ganhos e km rodado.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={regraAtiva}
                  onChange={e => {
                    const checked = e.target.checked;
                    setRegraAtiva(checked);
                    if (checked && reserveToEdit && !reserveToEdit.regra_ativa) {
                      setRegraInicioValidade(getTodayLocalDateStr());
                    }
                  }}
                  className="w-5 h-5 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                />
              </div>

              {regraAtiva && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Rule Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Tipo de Cálculo da Regra</label>
                    <Select value={regraTipo} onValueChange={(val: any) => setRegraTipo(val)}>
                      <SelectTrigger className="h-10 text-xs font-semibold rounded-xl">
                        <SelectValue placeholder="Selecione o tipo de regra..." />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="km">🚗 R$ por KM Rodado (ideal p/ manutenção/pneu)</SelectItem>
                        <SelectItem value="bruto">💰 % do Faturamento Bruto</SelectItem>
                        <SelectItem value="liquido">📈 % do Lucro Líquido</SelectItem>
                        <SelectItem value="fixo">📅 R$ Fixo por Dia Trabalhado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Rule Value */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">
                      {regraTipo === 'km' && 'Valor em R$ por cada KM rodado (Ex: 0.15)'}
                      {regraTipo === 'bruto' && 'Percentual % sobre o Faturamento Bruto (Ex: 5)'}
                      {regraTipo === 'liquido' && 'Percentual % sobre o Lucro Líquido (Ex: 10)'}
                      {regraTipo === 'fixo' && 'Valor em R$ fixo por dia trabalhado (Ex: 20)'}
                      {!regraTipo && 'Valor da Regra'}
                    </label>
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
                      className="h-10 text-xs rounded-xl font-mono"
                    />
                  </div>

                  {/* Data de Início da Vigência */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                      <span>Início da Vigência da Regra:</span>
                      <span className="text-[10px] text-indigo-500 font-medium">A partir desta data</span>
                    </label>
                    <Input
                      type="date"
                      value={regraInicioValidade}
                      onChange={e => setRegraInicioValidade(e.target.value)}
                      className="h-10 text-xs rounded-xl font-mono"
                    />
                  </div>

                  {/* Category Selection */}
                  {(regraTipo === 'km' || regraTipo === 'bruto' || regraTipo === 'fixo') && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-muted-foreground">
                          Categorias Elegíveis do Perfil
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAllCategories}
                            className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                          >
                            Todas
                          </button>
                          <button
                            type="button"
                            onClick={handleClearCategories}
                            className="text-[10px] font-bold text-muted-foreground hover:underline cursor-pointer"
                          >
                            Nenhuma
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {allCategories.map(cat => {
                          const isCatSelected = regraCategorias.includes(cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => handleToggleCategory(cat)}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isCatSelected
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Resgate: Controle de Categoria */}
              <div className="space-y-3 pt-3 border-t border-border/80">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-500" />
                  <h4 className="text-xs font-bold text-foreground">Regra de Categoria no Resgate</h4>
                </div>

                <div className="p-3 bg-muted/30 rounded-2xl border border-border/80 space-y-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="modal_require_category_mode"
                      checked={requireCategoryOnUse}
                      onChange={() => setRequireCategoryOnUse(true)}
                      className="mt-0.5 w-4 h-4 text-indigo-600 accent-indigo-600 cursor-pointer"
                    />
                    <div className="text-xs leading-tight">
                      <span className="font-bold text-foreground block">
                        Exigir categoria de despesa a cada resgate
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        Você escolherá a categoria do perfil toda vez que resgatar.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                    <input
                      type="radio"
                      name="modal_require_category_mode"
                      checked={!requireCategoryOnUse}
                      onChange={() => setRequireCategoryOnUse(false)}
                      className="mt-0.5 w-4 h-4 text-indigo-600 accent-indigo-600 cursor-pointer"
                    />
                    <div className="text-xs leading-tight">
                      <span className="font-bold text-foreground block">
                        Definir categoria de despesa fixa
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        Os resgates desta reserva serão lançados automaticamente com esta categoria.
                      </span>
                    </div>
                  </label>

                  {!requireCategoryOnUse && (
                    <div className="space-y-1 pt-1.5 border-t border-border/60">
                      <label className="text-[11px] font-bold text-muted-foreground">Categoria Fixa do Perfil:</label>
                      <Select value={defaultUseCategory} onValueChange={setDefaultUseCategory}>
                        <SelectTrigger className="h-9 text-xs font-bold rounded-xl bg-card">
                          <SelectValue placeholder="Selecione a categoria..." />
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
            </div>
          )}

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
              {isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar Reserva' : 'Criar Reserva'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
