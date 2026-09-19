import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Crown, 
  Wallet, 
  PiggyBank, 
  TrendingUp, 
  Bike,
  ChevronRight 
} from 'lucide-react';
import { Vehicle } from '@/types';

interface PatrimonyBreakdownCardProps {
  bancaLivre: number;
  totalInReserves: number;
  totalInvestmentEquity: number;
  totalVehiclesFipe?: number;
  vehicles?: Vehicle[];
  hideValues?: boolean;
  formatCurrency: (val: number) => string;
}

export const PatrimonyBreakdownCard: React.FC<PatrimonyBreakdownCardProps> = ({
  bancaLivre,
  totalInReserves,
  totalInvestmentEquity,
  totalVehiclesFipe = 0,
  vehicles = [],
  formatCurrency,
}) => {
  const safeCash = Math.max(0, bancaLivre);
  const safeReserves = Math.max(0, totalInReserves);
  const safeInvestments = Math.max(0, totalInvestmentEquity);
  const safeVehicles = Math.max(0, totalVehiclesFipe);

  // Total patrimony calculated inside this card includes FIPE value of vehicles
  const totalPatrimony = bancaLivre + totalInReserves + totalInvestmentEquity + totalVehiclesFipe;
  const safeTotal = safeCash + safeReserves + safeInvestments + safeVehicles;

  const pctCash = safeTotal > 0 ? (safeCash / safeTotal) * 100 : 0;
  const pctReserves = safeTotal > 0 ? (safeReserves / safeTotal) * 100 : 0;
  const pctInvestments = safeTotal > 0 ? (safeInvestments / safeTotal) * 100 : 0;
  const pctVehicles = safeTotal > 0 ? (safeVehicles / safeTotal) * 100 : 0;

  return (
    <Card className="border border-border/70 hover:border-amber-500/30 shadow-2xs hover:shadow-xs transition-all duration-200 overflow-hidden relative group bg-card/95 rounded-2xl">
      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
      
      <CardContent className="p-3 sm:p-3.5 space-y-2.5">
        {/* Ultra-compact Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border/30 pb-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center shrink-0">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-xs font-black text-foreground uppercase tracking-wider leading-none">
                Composição do Patrimônio
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                Caixa, reservas, investimentos e valor FIPE das motos
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block leading-none">
              Total Consolidado
            </span>
            <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-500 font-mono tracking-tight leading-tight">
              {formatCurrency(totalPatrimony)}
            </span>
          </div>
        </div>

        {/* Minimal Linear Distribution Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
            <span className="hidden sm:inline text-[9.5px]">Alocação</span>
            <div className="flex items-center gap-2 font-mono text-[9.5px] w-full sm:w-auto justify-between sm:justify-end">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Cx {pctCash.toFixed(0)}%
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />
                Res {pctReserves.toFixed(0)}%
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Inv {pctInvestments.toFixed(0)}%
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Motos {pctVehicles.toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden flex gap-0.5 border border-border/40 p-0.5">
            {pctCash > 0 && (
              <div 
                style={{ width: `${pctCash}%` }}
                className="h-full bg-emerald-500 rounded-l-full transition-all duration-300"
                title={`Caixa: ${pctCash.toFixed(1)}%`}
              />
            )}
            {pctReserves > 0 && (
              <div 
                style={{ width: `${pctReserves}%` }}
                className="h-full bg-pink-500 transition-all duration-300"
                title={`Reservas: ${pctReserves.toFixed(1)}%`}
              />
            )}
            {pctInvestments > 0 && (
              <div 
                style={{ width: `${pctInvestments}%` }}
                className="h-full bg-blue-500 transition-all duration-300"
                title={`Investimentos: ${pctInvestments.toFixed(1)}%`}
              />
            )}
            {pctVehicles > 0 && (
              <div 
                style={{ width: `${pctVehicles}%` }}
                className="h-full bg-indigo-500 rounded-r-full transition-all duration-300"
                title={`Motos (FIPE): ${pctVehicles.toFixed(1)}%`}
              />
            )}
          </div>
        </div>

        {/* 4 Pillars Grid (2x2 on Mobile, 4x1 on Desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {/* 1. Caixa Livre */}
          <Link
            to="/history"
            className="p-2 sm:p-2.5 bg-muted/20 hover:bg-muted/40 border border-border/50 hover:border-emerald-500/30 rounded-xl transition-all duration-150 group/item flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Wallet className="w-3 h-3" />
                </div>
                <span className="text-[11px] font-bold text-foreground truncate">Caixa Livre</span>
              </div>
              <span className="text-[9.5px] font-bold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded leading-none">
                {pctCash.toFixed(0)}%
              </span>
            </div>
            <div className="mt-1.5">
              <div className="text-sm sm:text-base font-black font-mono text-foreground tracking-tight">
                {formatCurrency(bancaLivre)}
              </div>
              <div className="text-[9.5px] text-muted-foreground mt-0.5 flex items-center justify-between">
                <span className="truncate">Disponível</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover/item:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </div>
          </Link>

          {/* 2. Reservas */}
          <Link
            to="/reserves"
            className="p-2 sm:p-2.5 bg-muted/20 hover:bg-muted/40 border border-border/50 hover:border-pink-500/30 rounded-xl transition-all duration-150 group/item flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded-md bg-pink-500/10 text-pink-500 flex items-center justify-center">
                  <PiggyBank className="w-3 h-3" />
                </div>
                <span className="text-[11px] font-bold text-foreground truncate">Reservas</span>
              </div>
              <span className="text-[9.5px] font-bold font-mono text-pink-600 dark:text-pink-400 bg-pink-500/10 px-1 py-0.5 rounded leading-none">
                {pctReserves.toFixed(0)}%
              </span>
            </div>
            <div className="mt-1.5">
              <div className="text-sm sm:text-base font-black font-mono text-pink-500 tracking-tight">
                {formatCurrency(totalInReserves)}
              </div>
              <div className="text-[9.5px] text-muted-foreground mt-0.5 flex items-center justify-between">
                <span className="truncate">Guardado</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover/item:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </div>
          </Link>

          {/* 3. Investimentos */}
          <Link
            to="/investments"
            className="p-2 sm:p-2.5 bg-muted/20 hover:bg-muted/40 border border-border/50 hover:border-blue-500/30 rounded-xl transition-all duration-150 group/item flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <TrendingUp className="w-3 h-3" />
                </div>
                <span className="text-[11px] font-bold text-foreground truncate">Investimentos</span>
              </div>
              <span className="text-[9.5px] font-bold font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded leading-none">
                {pctInvestments.toFixed(0)}%
              </span>
            </div>
            <div className="mt-1.5">
              <div className="text-sm sm:text-base font-black font-mono text-blue-500 tracking-tight">
                {formatCurrency(totalInvestmentEquity)}
              </div>
              <div className="text-[9.5px] text-muted-foreground mt-0.5 flex items-center justify-between">
                <span className="truncate">Mercado</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover/item:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </div>
          </Link>

          {/* 4. Motos (FIPE) */}
          <Link
            to="/vehicles"
            className="p-2 sm:p-2.5 bg-muted/20 hover:bg-muted/40 border border-border/50 hover:border-indigo-500/30 rounded-xl transition-all duration-150 group/item flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded-md bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <Bike className="w-3 h-3" />
                </div>
                <span className="text-[11px] font-bold text-foreground truncate">Motos (FIPE)</span>
              </div>
              <span className="text-[9.5px] font-bold font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded leading-none">
                {pctVehicles.toFixed(0)}%
              </span>
            </div>
            <div className="mt-1.5">
              <div className="text-sm sm:text-base font-black font-mono text-indigo-500 tracking-tight">
                {formatCurrency(totalVehiclesFipe)}
              </div>
              <div className="text-[9.5px] text-muted-foreground mt-0.5 flex items-center justify-between">
                <span className="truncate">{vehicles?.length || 0} moto(s)</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover/item:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </div>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
