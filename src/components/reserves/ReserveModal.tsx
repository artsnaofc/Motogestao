import { useState, useEffect } from 'react';
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
  Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Reserve, Transaction } from '../../types';
import { iconOptions, COLOR_PALETTE, formatCurrency } from './reserveUtils';
import { toast } from 'sonner';

interface ReserveModalProps {
  isOpen: boolean;
  onClose: () => void;
  reserveToEdit: Reserve | null;
  transactions: Transaction[];
  onSave: (reserveData: Partial<Reserve>, initialBalance?: number) => Promise<void>;
}

export function ReserveModal({
  isOpen,
  onClose,
  reserveToEdit,
  transactions,
  onSave
}: ReserveModalProps) {
  const isEditing = !!reserveToEdit;

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [metaObjetivo, setMetaObjetivo] = useState('');
  const [icon, setIcon] = useState('PiggyBank');
  const [color, setColor] = useState('#6366f1');

  // Automation states
  const [regraAtiva, setRegraAtiva] = useState(false);
  const [regraTipo, setRegraTipo] = useState<Reserve['regra_tipo'] | ''>('');
  const [regraValor, setRegraValor] = useState('');
  const [regraCategorias, setRegraCategorias] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tab
  const [activeTab, setActiveTab] = useState<'general' | 'automation'>('general');

  // Extract unique income categories from transactions
  const availableIncomeCategories = Array.from(
    new Set(
      transactions
        .filter(t => t.type === 'income' && t.category)
        .map(t => t.category as string)
    )
  );

  const defaultCategories = ['Uber', '99', 'Indrive', 'Particular', 'Ifood', 'Entregas', 'Passageiro'];
  const allCategories = Array.from(new Set([...defaultCategories, ...availableIncomeCategories]));

  useEffect(() => {
    if (reserveToEdit) {
      setName(reserveToEdit.name || '');
      setDescription(reserveToEdit.description || '');
      setMetaObjetivo(reserveToEdit.meta_objetivo ? String(reserveToEdit.meta_objetivo) : '');
      setIcon(reserveToEdit.icon || 'PiggyBank');
      setColor(reserveToEdit.color || '#6366f1');
      setRegraAtiva(!!reserveToEdit.regra_ativa);
      setRegraTipo(reserveToEdit.regra_tipo || '');
      setRegraValor(reserveToEdit.regra_valor ? String(reserveToEdit.regra_valor) : '');
      setRegraCategorias(reserveToEdit.regra_categorias || allCategories);
      setInitialBalance('');
    } else {
      setName('');
      setDescription('');
      setInitialBalance('');
      setMetaObjetivo('');
      setIcon('PiggyBank');
      setColor('#6366f1');
      setRegraAtiva(false);
      setRegraTipo('');
      setRegraValor('');
      setRegraCategorias(allCategories);
    }
    setActiveTab('general');
  }, [reserveToEdit, isOpen]);

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

    if (regraAtiva && (!regraTipo || !regraValor || parseFloat(regraValor) <= 0)) {
      toast.error('Ao ativar a regra de aporte, defina o tipo e um valor válido.');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload: Partial<Reserve> = {
        name: name.trim(),
        description: description.trim(),
        meta_objetivo: metaObjetivo ? parseFloat(metaObjetivo) : 0,
        icon,
        color,
        regra_ativa: regraAtiva,
        regra_tipo: regraAtiva ? (regraTipo as any) : undefined,
        regra_valor: regraAtiva && regraValor ? parseFloat(regraValor) : undefined,
        regra_categorias: regraAtiva ? regraCategorias : []
      };

      const initBalNum = initialBalance ? parseFloat(initialBalance) : 0;
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
                {isEditing ? 'Editar Reserva & Regras' : 'Nova Reserva Financeira'}
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Configure metas, visualização e automação de aportes
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="w-8 h-8 p-0 rounded-full">
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
            <span>Regra de Aporte Automático</span>
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

              <div className="grid grid-cols-2 gap-3">
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

                {!isEditing && (
                  <div className="space-y-1.5">
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

              {/* Color Palette */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-muted-foreground">Cor do Tema</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {COLOR_PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-xl transition-all ${
                        color === c ? 'ring-2 ring-foreground scale-110 shadow-sm' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Icon Selector */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-muted-foreground">Ícone Representativo</label>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 pt-1 max-h-[140px] overflow-y-auto p-1 border border-border/60 rounded-2xl bg-muted/20">
                  {Object.keys(iconOptions).map(iconKey => {
                    const IconComponent = iconOptions[iconKey];
                    const isSelected = icon === iconKey;
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setIcon(iconKey)}
                        className={`p-2 rounded-xl flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs scale-105'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
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
                  onChange={e => setRegraAtiva(e.target.checked)}
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
                      {regraTipo === 'km' && 'Valor em R$ por cada KM rodado (Ex: 0.10)'}
                      {regraTipo === 'bruto' && 'Percentual % sobre o Faturamento Bruto (Ex: 5)'}
                      {regraTipo === 'liquido' && 'Percentual % sobre o Lucro Líquido (Ex: 10)'}
                      {regraTipo === 'fixo' && 'Valor em R$ fixo por dia trabalhado (Ex: 20)'}
                      {!regraTipo && 'Valor da Regra'}
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      required={regraAtiva}
                      value={regraValor}
                      onChange={e => setRegraValor(e.target.value)}
                      className="h-10 text-xs rounded-xl font-mono"
                    />
                  </div>

                  {/* Category Selection */}
                  {(regraTipo === 'km' || regraTipo === 'bruto' || regraTipo === 'fixo') && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-muted-foreground">
                          Categorias Elegíveis
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAllCategories}
                            className="text-[10px] font-bold text-indigo-600 hover:underline"
                          >
                            Todas
                          </button>
                          <button
                            type="button"
                            onClick={handleClearCategories}
                            className="text-[10px] font-bold text-muted-foreground hover:underline"
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
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
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
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/80">
            <Button type="button" variant="ghost" onClick={onClose} className="h-10 text-xs font-bold">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-6 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-500/20"
            >
              {isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar Reserva' : 'Criar Reserva'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
