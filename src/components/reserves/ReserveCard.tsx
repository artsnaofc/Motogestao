import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  PiggyBank, 
  TrendingUp, 
  Target, 
  Plus, 
  Minus, 
  Edit3, 
  MoreVertical, 
  Sparkles, 
  CheckCircle2, 
  PauseCircle, 
  PlayCircle, 
  Trash2, 
  Archive, 
  History as HistIcon,
  Shield,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Reserve, ReserveTransaction, Transaction } from '../../types';
import { 
  iconOptions, 
  formatCurrency, 
  calculateSuggestion, 
  getEffectiveAportesInPeriod,
  parseLocalDate 
} from './reserveUtils';

interface ReserveCardProps {
  reserve: Reserve;
  reserveTransactions: ReserveTransaction[];
  transactions: Transaction[];
  globalPeriod: string;
  customDateRange: { start: string; end: string };
  onAporteManual: (reserve: Reserve) => void;
  onWithdraw: (reserve: Reserve) => void;
  onUpdateBalance: (reserve: Reserve) => void;
  onEdit: (reserve: Reserve) => void;
  onUpdateRule?: (reserve: Reserve) => void;
  onTogglePause: (reserve: Reserve) => void;
  onFinalize: (reserve: Reserve) => void;
  onDelete: (reserve: Reserve) => void;
  onViewRuleHistory?: (reserve: Reserve) => void;
  onApplyDirectSuggestion: (reserve: Reserve, amount: number) => void;
  hideValues?: boolean;
}

export function ReserveCard({
  reserve,
  reserveTransactions,
  transactions,
  globalPeriod,
  customDateRange,
  onAporteManual,
  onWithdraw,
  onUpdateBalance,
  onEdit,
  onUpdateRule,
  onTogglePause,
  onFinalize,
  onDelete,
  onViewRuleHistory,
  onApplyDirectSuggestion,
  hideValues
}: ReserveCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const IconComp = iconOptions[reserve.icon] || PiggyBank;
  const currentBalance = Math.round((reserve.saldo_atual || 0) * 100) / 100;
  const goal = Math.round((reserve.meta_objetivo || 0) * 100) / 100;
  const hasGoal = goal > 0;
  const goalProgress = hasGoal ? Math.min(100, Math.round((currentBalance / goal) * 100)) : 0;
  const isGoalReached = hasGoal && currentBalance >= goal;
  const isPaused = reserve.status === 'inactive' || reserve.is_paused;

  // Calculate suggestions
  const suggested = calculateSuggestion(reserve, transactions, reserveTransactions, globalPeriod, customDateRange);
  const effectiveAportes = getEffectiveAportesInPeriod(reserve, reserveTransactions, globalPeriod, customDateRange);
  const pendingSuggestion = Math.round(Math.max(0, suggested - effectiveAportes) * 100) / 100;

  // Recent transactions count
  const recentTxs = (reserveTransactions || []).filter(rt => rt.reserve_id === reserve.id);
  const totalYield = Math.round(
    recentTxs
      .filter(rt => rt.type === 'rendimento')
      .reduce((sum, rt) => sum + Number(rt.amount || 0), 0) * 100
  ) / 100;

  // Rule label format
  const getRuleBadge = () => {
    if (!reserve.regra_ativa || !reserve.regra_tipo) return null;
    if (reserve.regra_tipo === 'km') {
      return `🚗 R$ ${(reserve.regra_valor || 0).toFixed(2)}/km`;
    }
    if (reserve.regra_tipo === 'bruto') {
      return `💰 ${reserve.regra_valor}% do Bruto`;
    }
    if (reserve.regra_tipo === 'liquido') {
      return `📈 ${reserve.regra_valor}% do Lucro`;
    }
    if (reserve.regra_tipo === 'fixo') {
      return `📅 R$ ${(reserve.regra_valor || 0).toFixed(2)}/dia`;
    }
    return null;
  };

  const ruleBadgeText = getRuleBadge();

  return (
    <Card 
      className={`relative overflow-visible border transition-all duration-300 hover:shadow-lg text-left ${
        isPaused
          ? 'bg-muted/30 border-border/60 opacity-85'
          : 'bg-gradient-to-br from-card via-card to-muted/20 border-border/80 hover:border-indigo-500/40'
      }`}
    >
      {/* Top Color Accent Line */}
      <div 
        className="h-1.5 w-full rounded-t-xl transition-all"
        style={{ backgroundColor: reserve.color || '#6366f1' }}
      />

      <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
        {/* Header: Icon, Name, Status & Dropdown */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div 
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white shadow-2xs shrink-0 transition-transform active:scale-95"
              style={{ backgroundColor: reserve.color || '#6366f1' }}
            >
              <IconComp className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black text-foreground tracking-tight truncate">
                  {reserve.name}
                </h3>
                {isPaused ? (
                  <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Pausada
                  </span>
                ) : isGoalReached ? (
                  <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Meta
                  </span>
                ) : null}
              </div>

              {reserve.description && (
                <p className="text-[10px] text-muted-foreground truncate font-medium mt-0.2">
                  {reserve.description}
                </p>
              )}
            </div>
          </div>

          {/* Options Dropdown Menu */}
          <div className="relative shrink-0" ref={menuRef}>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowMenu(!showMenu)}
              className="w-7 h-7 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>

            {showMenu && (
              <div className="absolute right-0 top-8 z-30 w-48 bg-card border border-border/80 rounded-xl shadow-xl p-1 text-xs font-semibold animate-in fade-in zoom-in-95 duration-150">
                {onUpdateRule && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onUpdateRule(reserve);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-500/10 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Atualizar Regra
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(reserve);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-muted-foreground" /> Editar Reserva
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onTogglePause(reserve);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  {reserve.is_paused ? (
                    <>
                      <PlayCircle className="w-3.5 h-3.5 text-emerald-600" /> Reativar Automação
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-3.5 h-3.5 text-amber-600" /> Pausar Automação
                    </>
                  )}
                </button>

                <div className="h-px bg-border/60 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onFinalize(reserve);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-amber-600 hover:bg-amber-500/10 transition-colors cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" /> Inativar Reserva
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(reserve);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir Reserva
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Balance & Goal Block */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Saldo Disponível
            </span>
            {hasGoal && (
              <span className="text-[10px] font-bold text-muted-foreground font-mono">
                Meta: {hideValues ? 'R$ •••••' : formatCurrency(goal)}
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight font-mono">
              {hideValues ? 'R$ •••••' : formatCurrency(currentBalance)}
            </h2>
            {hasGoal && (
              <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {goalProgress}%
              </span>
            )}
          </div>

          {/* Goal Progress Bar */}
          {hasGoal && (
            <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${goalProgress}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-full transition-all"
                style={{ 
                  background: isGoalReached 
                    ? '#10b981' 
                    : `linear-gradient(to right, ${reserve.color || '#6366f1'}, #a855f7)` 
                }}
              />
            </div>
          )}
        </div>

        {/* Automation Rule & Pending Suggestion Pill */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-border/60 text-xs">
          {ruleBadgeText ? (
            <button
              type="button"
              onClick={() => onUpdateRule && onUpdateRule(reserve)}
              title="Clique para atualizar a regra de aporte"
              className="px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] border border-indigo-500/20 truncate max-w-[190px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Sparkles className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{ruleBadgeText}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onUpdateRule && onUpdateRule(reserve)}
              className="text-[10px] text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>+ Definir regra</span>
            </button>
          )}

          {totalYield > 0 && (
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-mono">
              <TrendingUp className="w-2.5 h-2.5" /> {hideValues ? '+R$ •••••' : `+${formatCurrency(totalYield)}`}
            </span>
          )}
        </div>

        {/* Suggestion Callout (if pending) */}
        {!isPaused && pendingSuggestion > 0 && (
          <div className="p-2 sm:p-2.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-xl border border-amber-500/20 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                <span className="text-[10px] font-bold text-foreground truncate">
                  Sugerido no período:
                </span>
              </div>
              <p className="text-xs font-black text-amber-600 dark:text-amber-400 font-mono">
                {hideValues ? 'R$ •••••' : formatCurrency(pendingSuggestion)}
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => onApplyDirectSuggestion(reserve, pendingSuggestion)}
              className="h-6 px-2 text-[9px] font-black uppercase tracking-wider bg-amber-600 hover:bg-amber-700 text-white rounded-md shadow-2xs shrink-0 cursor-pointer"
            >
              Aportar
            </Button>
          </div>
        )}

        {/* Action Buttons Grid: + Aportar, - Resgatar, Rendimento */}
        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          <Button
            size="sm"
            onClick={() => onAporteManual(reserve)}
            className="h-7.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-2xs gap-1 cursor-pointer px-1.5"
          >
            <Plus className="w-3 h-3" />
            <span>Aportar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onWithdraw(reserve)}
            disabled={currentBalance <= 0}
            className="h-7.5 text-xs font-bold border-rose-500/30 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400 rounded-xl gap-1 disabled:opacity-40 cursor-pointer px-1.5"
          >
            <Minus className="w-3 h-3" />
            <span>Resgatar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateBalance(reserve)}
            className="h-7.5 text-xs font-bold border-border/80 hover:bg-muted text-foreground rounded-xl gap-1 cursor-pointer px-1.5"
          >
            <TrendingUp className="w-3 h-3 text-blue-600" />
            <span>Rend.</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
