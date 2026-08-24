import { motion } from 'motion/react';
import { 
  PiggyBank, 
  Target, 
  TrendingUp, 
  Sparkles, 
  Plus, 
  Layers, 
  History as HistIcon,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from './reserveUtils';

interface ReservesHeaderProps {
  totalBalance: number;
  totalGoal: number;
  totalPendingSuggestion: number;
  totalYield: number;
  activeCount: number;
  activeTab: 'cards' | 'history';
  setActiveTab: (tab: 'cards' | 'history') => void;
  onOpenCreate: () => void;
  onOpenMassAporte: () => void;
}

export function ReservesHeader({
  totalBalance,
  totalGoal,
  totalPendingSuggestion,
  totalYield,
  activeCount,
  activeTab,
  setActiveTab,
  onOpenCreate,
  onOpenMassAporte
}: ReservesHeaderProps) {
  const goalProgress = totalGoal > 0 ? Math.min(100, Math.round((totalBalance / totalGoal) * 100)) : 0;

  return (
    <div className="space-y-3">
      {/* Top Bar: Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-xs shrink-0">
            <PiggyBank className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                Gestão de Reservas
              </h1>
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                {activeCount} {activeCount === 1 ? 'ativa' : 'ativas'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium truncate max-w-[280px] sm:max-w-none">
              Planejamento de metas, blindagem e aportes automáticos
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Mass Aporte Trigger Button */}
          <Button
            onClick={onOpenMassAporte}
            size="sm"
            className="h-8 px-2.5 sm:px-3 text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-xs gap-1 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-white/20 text-amber-300" />
            <span>Aporte em Massa</span>
            {totalPendingSuggestion > 0 && (
              <span className="hidden xs:inline-block ml-0.5 px-1.5 py-0.2 text-[9px] font-black rounded-full bg-white/20 text-white font-mono">
                {formatCurrency(totalPendingSuggestion)}
              </span>
            )}
          </Button>

          {/* Create Reserve */}
          <Button
            onClick={onOpenCreate}
            size="sm"
            variant="outline"
            className="h-8 px-2.5 text-xs font-bold border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10 hover:text-indigo-700 dark:text-indigo-400 gap-1 rounded-xl cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Nova</span> Reserva
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid - 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Total Reservado */}
        <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card to-muted/20 shadow-2xs p-2.5 sm:p-3.5 text-left flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              Patrimônio Total
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <PiggyBank className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <h3 className="text-base sm:text-xl font-black text-foreground tracking-tight font-mono">
              {formatCurrency(totalBalance)}
            </h3>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5 truncate">
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{activeCount} reservas</span>
            </p>
          </div>
        </Card>

        {/* Meta Global Consolidada */}
        <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card to-muted/20 shadow-2xs p-2.5 sm:p-3.5 text-left flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              Meta Almejada
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Target className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <div className="flex items-baseline justify-between">
              <h3 className="text-base sm:text-xl font-black text-foreground tracking-tight font-mono truncate">
                {formatCurrency(totalGoal)}
              </h3>
              <span className="text-[10px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono ml-1">
                {goalProgress}%
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-muted/60 h-1 sm:h-1.5 rounded-full mt-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${goalProgress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
              />
            </div>
          </div>
        </Card>

        {/* Sugestão Pendente do Período */}
        <Card 
          onClick={totalPendingSuggestion > 0 ? onOpenMassAporte : undefined}
          className={`relative overflow-hidden border shadow-2xs p-2.5 sm:p-3.5 text-left flex flex-col justify-between transition-all ${
            totalPendingSuggestion > 0 
              ? 'border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 hover:border-indigo-500/50 cursor-pointer' 
              : 'border-border/80 bg-gradient-to-br from-card to-muted/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              Sugerido Pendente
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <h3 className="text-base sm:text-xl font-black text-foreground tracking-tight font-mono">
              {formatCurrency(totalPendingSuggestion)}
            </h3>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5 truncate">
              {totalPendingSuggestion > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  Aporte sugerido pendente
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Regras em dia
                </span>
              )}
            </p>
          </div>
        </Card>

        {/* Rendimentos Totais */}
        <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card to-muted/20 shadow-2xs p-2.5 sm:p-3.5 text-left flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              Rendimentos
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <h3 className="text-base sm:text-xl font-black text-blue-600 dark:text-blue-400 tracking-tight font-mono">
              +{formatCurrency(totalYield)}
            </h3>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5 truncate flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3 text-blue-600 shrink-0" />
              Proventos & Lucros
            </p>
          </div>
        </Card>
      </div>

      {/* Main Tabs Navigation: Cards vs Histórico */}
      <div className="flex items-center justify-between border-b border-border/70 pt-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('cards')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'cards'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Minhas Reservas ({activeCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <HistIcon className="w-3.5 h-3.5" />
            <span>Extrato & Movimentações</span>
          </button>
        </div>
      </div>
    </div>
  );
}

