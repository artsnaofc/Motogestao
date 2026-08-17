import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  X, 
  CheckCircle2, 
  Percent, 
  Sliders, 
  RotateCcw,
  Sparkles,
  PieChart
} from 'lucide-react';
import { toast } from 'sonner';

interface RebalanceMacroClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyClassTargets: (classTargets: Record<string, number>) => void;
  availableClasses: string[];
  currentClassWeights: Record<string, number>;
}

const PRESET_STRATEGIES: Array<{ name: string; desc: string; targets: Record<string, number> }> = [
  {
    name: 'Equilibrada (50/50 ou 1/N)',
    desc: 'Distribuição igualitária entre as classes existentes.',
    targets: {}
  },
  {
    name: 'Foco em Proventos & Renda',
    desc: '60% FIIs + Renda Fixa, 40% Ações & Dividendos.',
    targets: { 'FII': 60, 'Ação': 30, 'Renda Fixa': 10, 'ETF': 0, 'BDR': 0 }
  },
  {
    name: 'Crescimento & Global',
    desc: '50% Ações Brasil, 30% ETFs/BDRs Internacionais, 20% FIIs.',
    targets: { 'Ação': 50, 'ETF': 20, 'BDR': 10, 'FII': 20 }
  },
  {
    name: 'Conservadora / Defensiva',
    desc: '40% Renda Fixa, 40% FIIs Tijolo, 20% Ações Blue Chips.',
    targets: { 'Renda Fixa': 40, 'FII': 40, 'Ação': 20 }
  }
];

export function RebalanceMacroClassModal({
  isOpen,
  onClose,
  onApplyClassTargets,
  availableClasses,
  currentClassWeights
}: RebalanceMacroClassModalProps) {
  const [classTargets, setClassTargets] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, number> = {};
      if (availableClasses.length > 0) {
        const equal = Number((100 / availableClasses.length).toFixed(1));
        availableClasses.forEach((cls, idx) => {
          if (currentClassWeights[cls] !== undefined) {
            initial[cls] = Number(currentClassWeights[cls].toFixed(1));
          } else {
            initial[cls] = equal;
          }
        });
      }
      setClassTargets(initial);
    }
  }, [isOpen, availableClasses, currentClassWeights]);

  if (!isOpen) return null;

  const totalClassPct = Object.values(classTargets).reduce((acc, curr) => acc + (curr || 0), 0);

  const handleNormalize = () => {
    if (totalClassPct <= 0) return;
    const next: Record<string, number> = {};
    availableClasses.forEach(cls => {
      const cur = classTargets[cls] || 0;
      next[cls] = Number(((cur / totalClassPct) * 100).toFixed(1));
    });
    setClassTargets(next);
    toast.success('Classes ajustadas para somar 100%!');
  };

  const handleApplyPreset = (preset: typeof PRESET_STRATEGIES[0]) => {
    if (preset.name.includes('1/N')) {
      const equal = Number((100 / availableClasses.length).toFixed(1));
      const next: Record<string, number> = {};
      availableClasses.forEach(cls => {
        next[cls] = equal;
      });
      setClassTargets(next);
      return;
    }

    const next: Record<string, number> = {};
    let sum = 0;
    availableClasses.forEach(cls => {
      const val = preset.targets[cls] || 0;
      next[cls] = val;
      sum += val;
    });

    if (sum > 0) {
      // normalize if some classes are missing
      availableClasses.forEach(cls => {
        next[cls] = Number(((next[cls] / sum) * 100).toFixed(1));
      });
    }
    setClassTargets(next);
    toast.info(`Estratégia "${preset.name}" carregada!`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Math.abs(totalClassPct - 100) > 1.0) {
      toast.warning(`A soma das classes é ${totalClassPct.toFixed(1)}%. Ajuste para 100% para melhor precisão.`);
    }
    onApplyClassTargets(classTargets);
    toast.success('Metas macro por classe distribuídas entre os ativos com sucesso!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div 
        className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden my-8 animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-5 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500">
              <Layers className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">
                Alocação Macro por Classe
              </h3>
              <p className="text-xs text-muted-foreground">
                Defina o percentual desejado por categoria (Ações, FIIs, etc.).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Preset Strategies */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Modelos de Alocação Macro:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_STRATEGIES.map(preset => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="p-2.5 rounded-2xl border border-border/60 bg-muted/30 hover:bg-indigo-500/10 hover:border-indigo-500/30 text-left transition-all space-y-0.5 group"
                >
                  <p className="text-xs font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    {preset.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {preset.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Sliders per Class */}
          <div className="space-y-3 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Classes da Carteira</label>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black ${Math.abs(totalClassPct - 100) < 0.5 ? 'text-emerald-500' : 'text-amber-500'}`}>
                  Soma: {totalClassPct.toFixed(1)}%
                </span>
                {Math.abs(totalClassPct - 100) >= 0.5 && (
                  <button
                    type="button"
                    onClick={handleNormalize}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                  >
                    Ajustar 100%
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              {availableClasses.map(cls => {
                const val = classTargets[cls] || 0;
                const currentWeight = currentClassWeights[cls] || 0;

                return (
                  <div key={cls} className="p-3 rounded-2xl border border-border/50 bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-foreground uppercase">{cls}</span>
                        <span className="text-[10px] text-muted-foreground">
                          (Atual: {currentWeight.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={val}
                          onChange={e => {
                            const num = Math.max(0, Math.min(100, Number(e.target.value)));
                            setClassTargets(prev => ({ ...prev, [cls]: Number(num.toFixed(1)) }));
                          }}
                          className="w-16 bg-muted/40 border border-border/60 rounded-xl px-2 py-1 text-xs font-black text-center outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <span className="text-xs font-bold text-muted-foreground">%</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={val}
                      onChange={e => setClassTargets(prev => ({ ...prev, [cls]: Number(e.target.value) }))}
                      className="w-full accent-indigo-500 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 text-[11px] text-muted-foreground">
            💡 <strong>Como a divisão funciona:</strong> Ao confirmar, a meta percentual de cada classe será distribuída proporcional ou igualmente entre os ativos pertencentes àquela classe.
          </div>

          {/* ACTIONS */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold rounded-2xl border border-border/60 bg-card text-muted-foreground hover:text-foreground transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Aplicar aos Ativos
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
