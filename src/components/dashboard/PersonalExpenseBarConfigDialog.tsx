import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  SlidersHorizontal,
  Check,
  X,
  Search,
  Plus,
  RotateCcw,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface PersonalExpenseBarConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableCategories: string[];
  categoryAmounts: Record<string, number>;
  selectedCategories: string[];
  groupOthers: boolean;
  onSave: (categories: string[], groupOthers: boolean) => void;
  formatCurrency: (val: number) => string;
  totalPersonalExpense: number;
}

export function PersonalExpenseBarConfigDialog({
  open,
  onOpenChange,
  availableCategories,
  categoryAmounts,
  selectedCategories,
  groupOthers,
  onSave,
  formatCurrency,
  totalPersonalExpense,
}: PersonalExpenseBarConfigDialogProps) {
  const [tempSelected, setTempSelected] = useState<string[]>([]);
  const [tempGroupOthers, setTempGroupOthers] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCatInput, setNewCatInput] = useState('');
  const [customAddedCats, setCustomAddedCats] = useState<string[]>([]);

  // Synchronize initial state when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setNewCatInput('');
      setTempGroupOthers(groupOthers);

      if (selectedCategories && selectedCategories.length > 0) {
        setTempSelected([...selectedCategories]);
      } else {
        // If none selected yet, default to all categories with expenses or all available
        const withExpenses = availableCategories.filter(
          (c) => (categoryAmounts[c] || 0) > 0
        );
        if (withExpenses.length > 0) {
          setTempSelected(withExpenses);
        } else {
          setTempSelected([...availableCategories]);
        }
      }
    }
  }, [open, selectedCategories, groupOthers, availableCategories, categoryAmounts]);

  // Merge available + any newly added categories in this session
  const allCategories = useMemo(() => {
    const set = new Set([...availableCategories, ...customAddedCats]);
    return Array.from(set).sort((a, b) => {
      // Sort by amount descending, then alphabetically
      const amtA = categoryAmounts[a] || 0;
      const amtB = categoryAmounts[b] || 0;
      if (amtA !== amtB) return amtB - amtA;
      return a.localeCompare(b, 'pt-BR');
    });
  }, [availableCategories, customAddedCats, categoryAmounts]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return allCategories;
    const q = searchQuery.toLowerCase().trim();
    return allCategories.filter((c) => c.toLowerCase().includes(q));
  }, [allCategories, searchQuery]);

  const handleToggleCategory = (category: string) => {
    setTempSelected((prev) => {
      if (prev.includes(category)) {
        return prev.filter((c) => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const handleSelectAll = () => {
    setTempSelected([...allCategories]);
  };

  const handleSelectWithExpensesOnly = () => {
    const withExp = allCategories.filter((c) => (categoryAmounts[c] || 0) > 0);
    if (withExp.length === 0) {
      toast.info('Nenhuma categoria possui despesas no período selecionado.');
      return;
    }
    setTempSelected(withExp);
  };

  const handleDeselectAll = () => {
    setTempSelected([]);
  };

  const handleAddNewCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newCatInput.trim();
    if (!clean) return;

    if (allCategories.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      toast.info('Essa categoria já existe na lista.');
      return;
    }

    setCustomAddedCats((prev) => [...prev, clean]);
    setTempSelected((prev) => [...prev, clean]);
    setNewCatInput('');
    toast.success(`Categoria "${clean}" adicionada e selecionada!`);
  };

  const handleSave = () => {
    onSave(tempSelected, tempGroupOthers);
    onOpenChange(false);
    toast.success('Categorias da barra de gastos pessoais atualizadas!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg p-0 bg-card border-border/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/40 shrink-0 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 shrink-0">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                Configurar Barra do Gasto Pessoal
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Escolha quais categorias serão exibidas e destacadas na barra de valores do cartão.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 bg-background/50">
          {/* Quick Info & Stats */}
          <div className="p-3 bg-muted/30 border border-border/60 rounded-2xl flex items-center justify-between text-xs gap-3">
            <div>
              <span className="text-muted-foreground font-semibold block text-[11px]">
                Total Pessoal no Período:
              </span>
              <span className="font-mono font-black text-rose-500 text-sm">
                {formatCurrency(totalPersonalExpense)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground font-semibold block text-[11px]">
                Categorias Selecionadas:
              </span>
              <span className="font-mono font-bold text-foreground text-sm">
                {tempSelected.length} de {allCategories.length}
              </span>
            </div>
          </div>

          {/* Search bar & Quick Actions */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar categoria..."
                className="w-full bg-muted/30 border border-border/70 rounded-xl pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-muted/40 hover:bg-muted border border-border/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Todas ({allCategories.length})
              </button>
              <button
                type="button"
                onClick={handleSelectWithExpensesOnly}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Apenas com Gastos</span>
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-muted/40 hover:bg-muted border border-border/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Desmarcar Todas
              </button>
            </div>
          </div>

          {/* Group Others Toggle */}
          <div
            onClick={() => setTempGroupOthers((v) => !v)}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
              tempGroupOthers
                ? 'bg-rose-500/[0.04] border-rose-500/30'
                : 'bg-muted/20 border-border/60 opacity-80'
            }`}
          >
            <div
              className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-colors ${
                tempGroupOthers
                  ? 'bg-rose-500 border-rose-600 text-white'
                  : 'border-border/80 bg-background'
              }`}
            >
              {tempGroupOthers && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-black text-foreground block leading-tight">
                Agrupar categorias não marcadas em "Outros / Demais"
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Garante que a barra sempre represente 100% dos seus gastos pessoais, somando as categorias restantes em um segmento unificado.
              </p>
            </div>
          </div>

          {/* Category List */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
              Selecione as Categorias
            </label>
            <div className="border border-border/70 rounded-2xl divide-y divide-border/40 max-h-[260px] overflow-y-auto bg-card">
              {filteredCategories.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Nenhuma categoria encontrada com o filtro "{searchQuery}".
                </div>
              ) : (
                filteredCategories.map((cat) => {
                  const isSelected = tempSelected.includes(cat);
                  const amt = categoryAmounts[cat] || 0;
                  const pct =
                    totalPersonalExpense > 0
                      ? (amt / totalPersonalExpense) * 100
                      : 0;

                  return (
                    <div
                      key={cat}
                      onClick={() => handleToggleCategory(cat)}
                      className={`p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer select-none ${
                        isSelected
                          ? 'bg-rose-500/[0.03] hover:bg-rose-500/[0.06]'
                          : 'hover:bg-muted/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-rose-500 border-rose-600 text-white'
                              : 'border-border/80 bg-background'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span
                          className={`text-xs truncate ${
                            isSelected
                              ? 'font-black text-foreground'
                              : 'font-medium text-muted-foreground'
                          }`}
                        >
                          {cat}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        {amt > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-black text-foreground">
                              {formatCurrency(amt)}
                            </span>
                            <span className="text-[10px] font-bold text-rose-500 font-mono">
                              ({pct.toFixed(0)}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            R$ 0,00
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Add custom category inline */}
          <div className="pt-2">
            <form onSubmit={handleAddNewCategory} className="flex items-center gap-2">
              <input
                type="text"
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder="Adicionar nova categoria..."
                className="flex-1 bg-muted/30 border border-border/70 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="rounded-xl border-border/70 text-xs font-bold shrink-0 cursor-pointer"
                disabled={!newCatInput.trim()}
              >
                <Plus className="w-3.5 h-3.5 mr-1 text-rose-500" />
                Adicionar
              </Button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-border/40 bg-muted/20 shrink-0 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs font-bold cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md shadow-rose-600/20 px-5 cursor-pointer"
          >
            Salvar Configurações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
