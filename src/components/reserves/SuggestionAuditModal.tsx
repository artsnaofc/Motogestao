import React, { useState } from 'react';
import { 
  X, 
  Calculator, 
  Sparkles, 
  Info, 
  Calendar, 
  CheckCircle2, 
  TrendingUp, 
  AlertCircle, 
  ArrowRight, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Layers,
  Receipt
} from 'lucide-react';
import { Reserve, Transaction, ReserveTransaction } from '../../types';
import { getSuggestionAudit, SuggestionAuditResult, formatCurrency } from './reserveUtils';
import { Button } from '@/components/ui/button';

interface SuggestionAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  reserve: Reserve | null;
  transactions: Transaction[];
  reserveTransactions: ReserveTransaction[];
  globalPeriod: string;
  customDateRange: { start: string; end: string };
  onApplyAporte?: (reserve: Reserve, amount: number) => void;
}

export function SuggestionAuditModal({
  isOpen,
  onClose,
  reserve,
  transactions,
  reserveTransactions,
  globalPeriod,
  customDateRange,
  onApplyAporte
}: SuggestionAuditModalProps) {
  const [showAllTxs, setShowAllTxs] = useState(false);

  if (!isOpen || !reserve) return null;

  const audit: SuggestionAuditResult = getSuggestionAudit(
    reserve,
    transactions,
    reserveTransactions,
    globalPeriod,
    customDateRange
  );

  const getRuleLabel = () => {
    if (!reserve.regra_ativa || !reserve.regra_tipo) return 'Sem Regra Ativa';
    switch (reserve.regra_tipo as string) {
      case 'km':
        return `R$ ${(reserve.regra_valor || 0).toFixed(2)} por KM`;
      case 'bruto':
        return `${reserve.regra_valor}% do Faturamento Bruto`;
      case 'liquido':
        return `${reserve.regra_valor}% do Lucro Líquido`;
      case 'fixo':
      case 'fixo_diario':
        return `R$ ${(reserve.regra_valor || 0).toFixed(2)} fixos por dia`;
      default:
        return reserve.regra_tipo;
    }
  };

  const visibleTxs = showAllTxs ? audit.eligibleTxs : audit.eligibleTxs.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs overflow-y-auto">
      <div 
        className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl p-5 sm:p-6 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Line */}
        <div 
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ backgroundColor: reserve.color || '#6366f1' }}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
              style={{ backgroundColor: reserve.color || '#6366f1' }}
            >
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                  Auditoria de Sugestão de Aporte
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {reserve.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Detalhamento da memória de cálculo e regras aplicadas
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          
          {/* Status Alert if Paused or Goal Reached */}
          {audit.isPaused && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-amber-700 dark:text-amber-300">Automação em Pausa: </span>
                <span className="text-muted-foreground">Esta reserva está pausada ou inativa, por isso a sugestão é R$ 0,00.</span>
              </div>
            </div>
          )}

          {audit.isGoalReached && !audit.isPaused && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-emerald-700 dark:text-emerald-300">Meta Concluída: </span>
                <span className="text-muted-foreground">O saldo atual atingiu a meta estipulada ({formatCurrency(reserve.meta_objetivo || 0)}).</span>
              </div>
            </div>
          )}

          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Total Sugerido (Bruto)
              </span>
              <span className="text-lg font-black text-foreground font-mono mt-0.5 block">
                {formatCurrency(audit.totalSuggested)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Base calculada pelas regras
              </span>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Aportes Já Realizados
              </span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                {formatCurrency(audit.effectiveAportes)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Aportes quitados no ciclo
              </span>
            </div>

            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                Pendente Sugerido
              </span>
              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 block">
                {formatCurrency(audit.pendingSuggestion)}
              </span>
              <span className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80">
                Saldo restante para aportar
              </span>
            </div>
          </div>

          {/* Formula & Rule Memory Box */}
          <div className="p-3.5 rounded-xl bg-card border border-border shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-xs font-bold text-foreground">Fórmula e Regra Ativa</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                {getRuleLabel()}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-muted/60 border border-border/80 font-mono text-xs font-semibold text-foreground break-words">
              {audit.formulaExplanation}
            </div>

            {/* Categorias e Regras */}
            {audit.categories.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                <span className="text-muted-foreground font-medium">Categorias elegíveis:</span>
                {audit.categories.map((cat, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 rounded bg-muted text-foreground text-[10px] font-semibold">
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Marco Temporal & Resgates */}
          <div className="p-3.5 rounded-xl bg-muted/20 border border-border space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Controle de Marco Temporal e Resgates</span>
            </div>

            <ul className="space-y-1.5 text-muted-foreground text-[11px]">
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 font-bold">•</span>
                <span>
                  <strong>Período avaliado:</strong> {globalPeriod === 'custom' ? `${customDateRange.start} até ${customDateRange.end}` : globalPeriod}.
                </span>
              </li>
              {audit.lastWithdrawalDate ? (
                <li className="flex items-start gap-2 text-foreground">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>
                    <strong>Último resgate pago (quitado):</strong> {new Date(audit.lastWithdrawalDate + 'T00:00:00').toLocaleDateString('pt-BR')}. Apenas transações posteriores a esta data são somadas para sugestão.
                  </span>
                </li>
              ) : (
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>Nenhum resgate pago registrado no período. Todas as transações do ciclo estão elegíveis.</span>
                </li>
              )}
              {audit.pendingWithdrawalsIgnored > 0 && (
                <li className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                  <span className="font-bold">•</span>
                  <span>
                    <strong>{audit.pendingWithdrawalsIgnored} resgate(s) recorrente(s) pendente(s)</strong> foram desconsiderados e não reiniciam a contagem até que sejam efetivamente marcados como pagos.
                  </span>
                </li>
              )}
            </ul>
          </div>

          {/* Transações Elegíveis na Base de Cálculo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Transações que Compõem a Base ({audit.txCount})</span>
              </div>
              {audit.txCount > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllTxs(!showAllTxs)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 cursor-pointer"
                >
                  {showAllTxs ? (
                    <>Ver menos <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>Ver todas ({audit.txCount}) <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              )}
            </div>

            {audit.eligibleTxs.length === 0 ? (
              <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border text-center text-xs text-muted-foreground">
                Nenhuma transação de receita elegível encontrada no período para os critérios da regra.
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/60">
                {visibleTxs.map((tx) => (
                  <div key={tx.id} className="p-2.5 flex items-center justify-between gap-2 text-xs hover:bg-muted/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground truncate">
                          {tx.description}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-muted text-muted-foreground">
                          {tx.category}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        {tx.km ? ` • ${tx.km} km` : ''}
                      </span>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono shrink-0">
                      +{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 pt-4 border-t border-border mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Fechar
          </Button>

          {onApplyAporte && audit.pendingSuggestion > 0 && !audit.isPaused && (
            <Button
              size="sm"
              onClick={() => {
                onApplyAporte(reserve, audit.pendingSuggestion);
                onClose();
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Aportar Sugestão ({formatCurrency(audit.pendingSuggestion)})</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
