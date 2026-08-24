import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Minus, 
  TrendingUp, 
  X, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  Check, 
  Sparkles, 
  History as HistIcon,
  Tag,
  ShieldCheck,
  Zap,
  RefreshCw,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Reserve, ReserveTransaction, Transaction, UserSettings } from '../../types';
import { 
  formatCurrency, 
  formatDateDisplay, 
  iconOptions, 
  getSuggestionAudit,
  parseLocalDate 
} from './reserveUtils';
import { toast } from 'sonner';

// ==========================================
// 1. MODAL APORTE MANUAL INDIVIDUAL
// ==========================================
interface AporteManualModalProps {
  reserve: Reserve | null;
  isOpen: boolean;
  onClose: () => void;
  initialAmount?: number;
  initialDescription?: string;
  isSuggestion?: boolean;
  onSubmit: (data: {
    amount: number;
    date: string;
    description: string;
  }) => Promise<void>;
}

export function AporteManualModal({
  reserve,
  isOpen,
  onClose,
  initialAmount,
  initialDescription,
  isSuggestion,
  onSubmit
}: AporteManualModalProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (reserve) {
      setDescription(initialDescription || (isSuggestion ? `Aporte sugerido - ${reserve.name}` : `Aporte manual - ${reserve.name}`));
      setAmount(initialAmount && initialAmount > 0 ? String(Math.round(initialAmount * 100) / 100) : '');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [reserve, isOpen, initialAmount, initialDescription, isSuggestion]);

  if (!isOpen || !reserve) return null;

  const IconComp = iconOptions[reserve.icon] || PiggyBank;
  const numAmount = Math.round((parseFloat(amount) || 0) * 100) / 100;
  const currentBalance = Math.round((reserve.saldo_atual || 0) * 100) / 100;
  const newBalance = Math.round((currentBalance + (numAmount > 0 ? numAmount : 0)) * 100) / 100;
  const hasGoal = Boolean(reserve.meta_objetivo && reserve.meta_objetivo > 0);
  const currentGoalPct = hasGoal ? Math.min(100, Math.round((currentBalance / reserve.meta_objetivo!) * 100)) : 0;
  const newGoalPct = hasGoal ? Math.min(100, Math.round((newBalance / reserve.meta_objetivo!) * 100)) : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.round((parseFloat(amount) || 0) * 100) / 100;
    if (isNaN(val) || val <= 0) {
      toast.error('Informe um valor de aporte válido maior que zero.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        amount: val,
        date,
        description: description || `Aporte manual - ${reserve.name}`
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-card w-full max-w-md my-auto rounded-3xl border border-border/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-b border-border/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
              style={{ backgroundColor: reserve.color || '#10b981' }}
            >
              <IconComp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-foreground">
                  {isSuggestion ? 'Confirmar Aporte Sugerido' : 'Confirmar Aporte Unitário'}
                </h3>
                {isSuggestion && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Sugerido
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium truncate max-w-[240px]">
                {reserve.name} • Saldo atual: {formatCurrency(currentBalance)}
              </p>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} className="w-8 h-8 p-0 rounded-full cursor-pointer">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 text-left">
          {/* Valor Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Valor do Aporte
              </label>
              {isSuggestion && initialAmount && initialAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.round(initialAmount * 100) / 100))}
                  className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  Usar Sugerido ({formatCurrency(initialAmount)})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                autoFocus
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="pl-10 h-11 text-base font-mono font-bold rounded-2xl"
              />
            </div>
          </div>

          {/* Atalhos de valor rápido */}
          <div className="flex items-center gap-1.5">
            {[20, 50, 100, 200].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(prev => {
                  const cur = parseFloat(prev) || 0;
                  return String(Math.round((cur + val) * 100) / 100);
                })}
                className="flex-1 h-8 rounded-xl border border-border/80 text-xs font-bold hover:bg-muted text-foreground transition-all cursor-pointer"
              >
                +{val}
              </button>
            ))}
          </div>

          {/* Live Balance Impact Preview Box */}
          <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Saldo Atual:</span>
              <span className="font-mono font-bold text-foreground">{formatCurrency(currentBalance)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Plus className="w-3 h-3" /> Aporte:
              </span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(numAmount)}
              </span>
            </div>
            <div className="pt-1.5 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="font-bold text-foreground">Novo Saldo Estimado:</span>
              <span className="font-mono font-black text-base text-foreground">
                {formatCurrency(newBalance)}
              </span>
            </div>

            {hasGoal && (
              <div className="pt-1 text-[11px] space-y-1">
                <div className="flex items-center justify-between font-medium text-muted-foreground">
                  <span>Meta: {formatCurrency(reserve.meta_objetivo!)}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {currentGoalPct}% → {newGoalPct}%
                  </span>
                </div>
                <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                    style={{ width: `${newGoalPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Data</label>
              <Input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Descrição</label>
              <Input
                placeholder="Ex: Aporte extra"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="h-10 text-xs font-bold cursor-pointer">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || numAmount <= 0}
              className="h-10 px-5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              {isSubmitting ? 'Confirmando...' : `Confirmar Aporte de ${numAmount > 0 ? formatCurrency(numAmount) : 'R$ 0,00'}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PiggyBank(props: any) {
  return <DollarSign {...props} />;
}

// ==========================================
// 2. MODAL RESGATE / UTILIZAÇÃO
// ==========================================
interface WithdrawModalProps {
  reserve: Reserve | null;
  isOpen: boolean;
  onClose: () => void;
  settings?: UserSettings | null;
  onSubmit: (data: {
    amount: number;
    date: string;
    category: string;
    description: string;
  }) => Promise<void>;
}

export function WithdrawModal({
  reserve,
  isOpen,
  onClose,
  settings,
  onSubmit
}: WithdrawModalProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const hasFixedCategory = Boolean(reserve?.require_category_on_use === false && reserve?.default_use_category);

  useEffect(() => {
    if (reserve) {
      setDescription(`Resgate / Uso - ${reserve.name}`);
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);

      if (hasFixedCategory && reserve.default_use_category) {
        setCategory(reserve.default_use_category);
      } else {
        // Find best default or first available
        const defaultCat = profileExpenseCategories.find(c => 
          reserve.name.toLowerCase().includes(c.toLowerCase()) || 
          c.toLowerCase().includes('manutenção') || 
          c.toLowerCase().includes('outros')
        ) || profileExpenseCategories[0] || 'Outros';
        setCategory(defaultCat);
      }
    }
  }, [reserve, isOpen, hasFixedCategory, profileExpenseCategories]);

  if (!isOpen || !reserve) return null;

  const currentBalance = Math.round((reserve.saldo_atual || 0) * 100) / 100;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.round((parseFloat(amount) || 0) * 100) / 100;
    if (isNaN(val) || val <= 0) {
      toast.error('Informe um valor de resgate válido.');
      return;
    }
    if (val > currentBalance) {
      toast.error(`Valor superior ao saldo disponível de ${formatCurrency(currentBalance)}.`);
      return;
    }

    const finalCategory = hasFixedCategory ? (reserve.default_use_category || 'Outros') : (category || 'Outros');
    if (!finalCategory) {
      toast.error('Selecione a categoria de despesa correspondente do seu perfil.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        amount: val,
        date,
        category: finalCategory,
        description: description || `Utilização de reserva: ${reserve.name}`
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-3xl border border-border/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left">
        <div className="p-5 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-b border-border/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Minus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Resgatar / Utilizar Reserva</h3>
              <p className="text-xs text-muted-foreground font-medium">
                {reserve.name} • Disponível: <strong className="text-foreground">{formatCurrency(currentBalance)}</strong>
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="w-8 h-8 p-0 rounded-full cursor-pointer">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Valor do Resgate
              </label>
              <button
                type="button"
                onClick={() => setAmount(String(currentBalance))}
                className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
              >
                Usar Total ({formatCurrency(currentBalance)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                autoFocus
                max={currentBalance}
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="pl-10 h-11 text-base font-mono font-bold rounded-2xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Data</label>
              <Input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                <span>Categoria de Despesa</span>
                {hasFixedCategory && (
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Fixa na Reserva</span>
                )}
              </label>

              {hasFixedCategory ? (
                <div className="h-10 px-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{reserve.default_use_category}</span>
                </div>
              ) : (
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-10 text-xs font-bold rounded-xl bg-card">
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
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Motivo / Descrição</label>
            <Input
              placeholder="Ex: Conserto mecânico urgente"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="h-10 text-xs rounded-xl"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="h-10 text-xs font-bold cursor-pointer">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-500/20 cursor-pointer"
            >
              {isSubmitting ? 'Resgatando...' : 'Confirmar Resgate'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 3. MODAL ATUALIZAÇÃO DE SALDO & RENDIMENTO
// ==========================================
interface UpdateBalanceModalProps {
  reserve: Reserve | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    newBalance: number;
    date: string;
    type: 'rendimento' | 'aporte' | 'ajuste';
    description: string;
  }) => Promise<void>;
}

export function UpdateBalanceModal({
  reserve,
  isOpen,
  onClose,
  onSubmit
}: UpdateBalanceModalProps) {
  const [newBalanceInput, setNewBalanceInput] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (reserve) {
      setNewBalanceInput(String(Math.round((reserve.saldo_atual || 0) * 100) / 100));
      setDescription(`Atualização de saldo / rendimento - ${reserve.name}`);
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [reserve, isOpen]);

  if (!isOpen || !reserve) return null;

  const currentBalance = Math.round((reserve.saldo_atual || 0) * 100) / 100;
  const newBalanceNum = Math.round((parseFloat(newBalanceInput) || 0) * 100) / 100;
  const diff = Math.round((newBalanceNum - currentBalance) * 100) / 100;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(newBalanceNum) || newBalanceNum < 0) {
      toast.error('Informe um novo saldo válido.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        newBalance: newBalanceNum,
        date,
        type: diff >= 0 ? 'rendimento' : 'ajuste',
        description: description || `Ajuste de saldo: ${formatCurrency(currentBalance)} -> ${formatCurrency(newBalanceNum)}`
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-3xl border border-border/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border-b border-border/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Atualizar Saldo / Rendimento</h3>
              <p className="text-xs text-muted-foreground font-medium">
                {reserve.name} • Saldo Atual: {formatCurrency(currentBalance)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="w-8 h-8 p-0 rounded-full">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Novo Saldo Total da Reserva
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                autoFocus
                required
                value={newBalanceInput}
                onChange={e => setNewBalanceInput(e.target.value)}
                className="pl-10 h-11 text-base font-mono font-bold rounded-2xl"
              />
            </div>
          </div>

          {/* Differential preview banner */}
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
            diff > 0
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : diff < 0
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
              : 'bg-muted/40 border-border text-muted-foreground'
          }`}>
            <span className="font-bold">
              {diff > 0 ? '📈 Rendimento Gerado:' : diff < 0 ? '📉 Ajuste / Desvalorização:' : 'Sem alteração no saldo'}
            </span>
            <strong className="font-mono text-sm">
              {diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
            </strong>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Data do Ajuste / Fechamento</label>
            <Input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="h-10 text-xs rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Descrição</label>
            <Input
              placeholder="Ex: Proventos de CDB / Rendimento mensal"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="h-10 text-xs rounded-xl"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="h-10 text-xs font-bold">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20"
            >
              {isSubmitting ? 'Atualizando...' : 'Salvar Novo Saldo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 4. MODAL HISTÓRICO DE REGRAS & AUDITORIA
// ==========================================
interface RuleHistoryModalProps {
  reserve: Reserve | null;
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  reserveTransactions: ReserveTransaction[];
  globalPeriod: string;
  customDateRange: { start: string; end: string };
}

export function RuleHistoryModal({
  reserve,
  isOpen,
  onClose,
  transactions,
  reserveTransactions,
  globalPeriod,
  customDateRange
}: RuleHistoryModalProps) {
  if (!isOpen || !reserve) return null;

  const audit = getSuggestionAudit(reserve, transactions, reserveTransactions, globalPeriod, customDateRange);
  const historyRules = reserve.rule_history || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-lg rounded-3xl border border-border/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent border-b border-border/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <HistIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Auditoria & Histórico de Regras</h3>
              <p className="text-xs text-muted-foreground font-medium">{reserve.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="w-8 h-8 p-0 rounded-full">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-left">
          {/* Active Rule Audit */}
          <div className="p-4 bg-muted/40 rounded-2xl border border-border/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">
                Regra Atual em Vigor
              </span>
              <span className="text-xs font-bold text-foreground font-mono">
                Sugerido: {formatCurrency(audit.totalSuggested)}
              </span>
            </div>

            <ul className="text-xs text-muted-foreground space-y-1">
              {audit.details.map((d, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  {d}
                </li>
              ))}
              <li className="text-[11px] text-muted-foreground pt-1">
                Lançamentos no período considerados: <strong>{audit.txCount} transações</strong>
              </li>
            </ul>
          </div>

          {/* Rule Timeline / History */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Histórico de Alterações de Regra
            </h4>

            {historyRules.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 bg-muted/20 rounded-xl border border-dashed border-border">
                Nenhuma alteração de regra registrada anteriormente.
              </p>
            ) : (
              <div className="space-y-2">
                {historyRules.map((rule, idx) => (
                  <div key={idx} className="p-3 bg-card border border-border/80 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-foreground">
                        Regra: {rule.regra_tipo?.toUpperCase()} ({rule.regra_valor})
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        Até {formatDateDisplay(rule.end_date)}
                      </span>
                    </div>
                    {rule.regra_categorias && rule.regra_categorias.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Categorias: {rule.regra_categorias.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-muted/30 border-t border-border/80 flex justify-end">
          <Button onClick={onClose} className="h-9 px-5 text-xs font-bold rounded-xl">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
