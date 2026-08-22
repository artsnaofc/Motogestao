import React, { useState, useMemo } from 'react';
import { 
  Transaction, 
  ReserveTransaction, 
  InvestmentTransaction, 
  Reserve, 
  UserSettings,
  Dividend 
} from '../types';
import { format, endOfMonth, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PiggyBank, 
  BarChart2, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Layers, 
  Table as TableIcon, 
  ChevronDown, 
  ChevronUp, 
  Info,
  Award,
  DollarSign,
  PieChart as PieIcon,
  Activity,
  Maximize2
} from 'lucide-react';

interface PatrimonyEvolutionProps {
  transactions: Transaction[];
  reserveTransactions: ReserveTransaction[];
  investmentTransactions: InvestmentTransaction[];
  reserves: Reserve[];
  settings: UserSettings | null;
  quotes: Record<string, number>;
  dividends?: Dividend[];
  hideValues: boolean;
  formatCurrency: (val: any) => string;
}

type ChartType = 'area' | 'line' | 'bar';

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  if (year && month && day) {
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  return new Date(dateStr);
}

export const PatrimonyEvolution: React.FC<PatrimonyEvolutionProps> = ({
  transactions,
  reserveTransactions,
  investmentTransactions,
  reserves,
  settings,
  quotes,
  dividends = [],
  hideValues,
  formatCurrency
}) => {
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();

  // Selected Year
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  // Chart Visual Mode (default: 'bar')
  const [chartType, setChartType] = useState<ChartType>('bar');
  // Show Table Detail
  const [showTable, setShowTable] = useState<boolean>(false);

  // Active Series Visibility
  const [visibleSeries, setVisibleSeries] = useState<{
    Caixa: boolean;
    Reservas: boolean;
    Investimentos: boolean;
    PatrimonioTotal: boolean;
  }>({
    Caixa: true,
    Reservas: true,
    Investimentos: true,
    PatrimonioTotal: true
  });

  // Filter out any virtual transactions to ensure clean cash calculation
  const realTransactions = useMemo(() => {
    return (transactions || []).filter(t => !t.isInvestmentTx && !t.isReserveAporte && !t.isDividendTx);
  }, [transactions]);

  // Calculate available years dynamically from data
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    yearSet.add(currentYear);

    realTransactions.forEach(t => {
      if (t.date) {
        const y = parseInt(t.date.split('-')[0], 10);
        if (y && !isNaN(y)) yearSet.add(y);
      }
    });

    investmentTransactions.forEach(tx => {
      if (tx.date) {
        const y = parseInt(tx.date.split('-')[0], 10);
        if (y && !isNaN(y)) yearSet.add(y);
      }
    });

    reserveTransactions.forEach(rt => {
      if (rt.date) {
        const y = parseInt(rt.date.split('-')[0], 10);
        if (y && !isNaN(y)) yearSet.add(y);
      }
    });

    return Array.from(yearSet).filter(y => y >= 2026).sort((a, b) => b - a);
  }, [realTransactions, investmentTransactions, reserveTransactions, currentYear]);

  // Compute 12 months data for selected year
  const monthlyEvolution = useMemo(() => {
    const isCurrentYearSelected = selectedYear === currentYear;

    return Array.from({ length: 12 }).map((_, i) => {
      const monthDate = new Date(selectedYear, i, 1);
      const endOfMonthDate = endOfMonth(monthDate);
      const monthKey = format(monthDate, 'yyyy-MM');

      // Check if there are direct transactions/lançamentos in this specific month
      const hasTx = realTransactions.some(t => t.date && t.date.startsWith(monthKey));
      const hasInvTx = investmentTransactions.some(tx => tx.date && tx.date.startsWith(monthKey));
      const hasResTx = (reserveTransactions || []).some(rt => rt.date && rt.date.startsWith(monthKey));
      const hasTransactionsInMonth = hasTx || hasInvTx || hasResTx;

      // Cumulative Net Cash Flow up to end of this month
      let rawNet = 0;

      // 1. General Income & Expenses from realTransactions
      realTransactions.forEach(t => {
        if (!t.date) return;
        const tDate = parseLocalDate(t.date);
        if (tDate > endOfMonthDate) return;

        const amount = Number(t.amount);
        if (
          t.category === 'Aporte Reserva' ||
          t.category === 'Resgate Reserva' ||
          t.category === 'Resgate de Reserva'
        ) {
          return;
        }
        if (t.type === 'income') rawNet += amount;
        else if (t.type === 'expense') rawNet -= amount;
      });

      // 2. Dividends received up to end of this month
      (dividends || []).forEach(d => {
        if (d.status !== 'received' && !d.transaction_id) return;
        const dDate = parseLocalDate(d.date || d.data_ex);
        if (dDate > endOfMonthDate) return;
        rawNet += Number(d.amount);
      });

      // 3. Investments buy/sell up to end of this month
      investmentTransactions.forEach(tx => {
        if (!tx.date) return;
        const txDate = parseLocalDate(tx.date);
        if (txDate > endOfMonthDate) return;

        const amount = Number(tx.price) * Number(tx.quantity) + Number(tx.costs || 0);
        if (tx.operation === 'buy') {
          rawNet -= amount;
        } else {
          rawNet += amount;
        }
      });

      // 4. Reserve Rendimentos up to end of this month
      (reserveTransactions || []).forEach(rt => {
        if (!rt.date) return;
        const rtDate = parseLocalDate(rt.date);
        if (rtDate > endOfMonthDate) return;

        if (rt.type === 'rendimento') {
          rawNet += Number(rt.amount);
        }
      });

      const caixaMaisReservasVal = (settings?.initial_balance || 0) + rawNet;

      // Reserve balances up to end of this month
      let totalInResv = 0;
      (reserves || []).forEach(r => {
        let rBalance = Number(r.saldo_inicial || 0);
        const rts = (reserveTransactions || []).filter(rt => rt.reserve_id === r.id);
        rts.forEach(rt => {
          if (!rt.date) return;
          const rtDate = parseLocalDate(rt.date);
          if (rtDate > endOfMonthDate) return;

          if (rt.type === 'aporte') rBalance += Number(rt.amount);
          else if (rt.type === 'rendimento') rBalance += Number(rt.amount);
          else if (rt.type === 'utilizacao') rBalance -= Number(rt.amount);
        });
        totalInResv += Math.max(0, rBalance);
      });

      // Caixa balance
      const caixaBalance = caixaMaisReservasVal - totalInResv;

      // Investment Equity
      const posMap: Record<string, number> = {};
      investmentTransactions.forEach(tx => {
        if (!tx.date) return;
        const txDate = parseLocalDate(tx.date);
        if (txDate > endOfMonthDate) return;

        const q = Number(tx.quantity);
        if (tx.operation === 'buy') {
          posMap[tx.ticker] = (posMap[tx.ticker] || 0) + q;
        } else {
          posMap[tx.ticker] = (posMap[tx.ticker] || 0) - q;
        }
      });

      const totalInvestmentEquity = Object.entries(posMap).reduce((acc, [ticker, quantity]) => {
        if (quantity <= 0) return acc;
        const lastTx = investmentTransactions
          .filter(t => t.ticker === ticker && parseLocalDate(t.date) <= endOfMonthDate)
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
        const fallbackPrice = lastTx ? Number(lastTx.price) : 0;

        // Use live quote ONLY if this month is current or future month; for past months, use last tx price
        const isCurrentOrFutureMonth = isCurrentYearSelected ? monthDate >= startOfMonth(now) : false;
        const price = isCurrentOrFutureMonth ? (quotes[ticker] || fallbackPrice) : (fallbackPrice || quotes[ticker] || 0);

        return acc + price * quantity;
      }, 0);

      const totalPatrimonyVal = caixaMaisReservasVal + totalInvestmentEquity;
      const isFuture = isCurrentYearSelected ? monthDate > now : false;

      const rawMonthName = format(monthDate, 'MMM', { locale: ptBR });
      const monthNameCapitalized = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);

      return {
        monthIndex: i,
        monthKey,
        month: monthNameCapitalized,
        fullMonthName: format(monthDate, 'MMMM yyyy', { locale: ptBR }),
        Caixa: Number(caixaBalance.toFixed(2)),
        Reservas: Number(totalInResv.toFixed(2)),
        Investimentos: Number(totalInvestmentEquity.toFixed(2)),
        PatrimonioTotal: Number(totalPatrimonyVal.toFixed(2)),
        isFuture,
        hasTransactionsInMonth
      };
    }).filter(m => {
      if (m.monthKey < '2026-03') return false;
      if (isCurrentYearSelected) {
        return !m.isFuture || m.hasTransactionsInMonth;
      }
      return true;
    });
  }, [
    selectedYear,
    currentYear,
    now,
    realTransactions,
    reserveTransactions,
    investmentTransactions,
    reserves,
    settings,
    quotes,
    dividends
  ]);

  // Compute Month-over-Month variation
  const processedData = useMemo(() => {
    return monthlyEvolution.map((item, index) => {
      const prevItem = index > 0 ? monthlyEvolution[index - 1] : null;
      const diffR$ = prevItem ? item.PatrimonioTotal - prevItem.PatrimonioTotal : 0;
      const diffPct = prevItem && prevItem.PatrimonioTotal > 0
        ? (diffR$ / prevItem.PatrimonioTotal) * 100
        : 0;

      const total = item.PatrimonioTotal > 0 ? item.PatrimonioTotal : 1;
      const pctCaixa = (Math.max(0, item.Caixa) / total) * 100;
      const pctReservas = (Math.max(0, item.Reservas) / total) * 100;
      const pctInvestimentos = (Math.max(0, item.Investimentos) / total) * 100;

      return {
        ...item,
        diffR$,
        diffPct,
        pctCaixa,
        pctReservas,
        pctInvestimentos
      };
    });
  }, [monthlyEvolution]);

  // Key KPI Metrics for Selected Year
  const yearMetrics = useMemo(() => {
    if (processedData.length === 0) {
      return {
        latest: { PatrimonioTotal: 0, Caixa: 0, Reservas: 0, Investimentos: 0, diffR$: 0, diffPct: 0, month: '' },
        startVal: 0,
        ytdDiffR$: 0,
        ytdDiffPct: 0,
        peakVal: 0,
        avgMonthlyNet: 0,
        pctCaixa: 0,
        pctReservas: 0,
        pctInvestimentos: 0
      };
    }

    const latest = processedData[processedData.length - 1];
    const first = processedData[0];
    const startVal = first.PatrimonioTotal;
    const endVal = latest.PatrimonioTotal;
    const ytdDiffR$ = endVal - startVal;
    const ytdDiffPct = startVal > 0 ? (ytdDiffR$ / startVal) * 100 : 0;

    const peakVal = Math.max(...processedData.map(d => d.PatrimonioTotal));

    const totalDiffs = processedData.slice(1).reduce((sum, d) => sum + d.diffR$, 0);
    const avgMonthlyNet = processedData.length > 1 ? totalDiffs / (processedData.length - 1) : 0;

    const tot = latest.PatrimonioTotal > 0 ? latest.PatrimonioTotal : 1;
    const pctCaixa = (Math.max(0, latest.Caixa) / tot) * 100;
    const pctReservas = (Math.max(0, latest.Reservas) / tot) * 100;
    const pctInvestimentos = (Math.max(0, latest.Investimentos) / tot) * 100;

    return {
      latest,
      startVal,
      ytdDiffR$,
      ytdDiffPct,
      peakVal,
      avgMonthlyNet,
      pctCaixa,
      pctReservas,
      pctInvestimentos
    };
  }, [processedData]);

  const toggleSeries = (key: keyof typeof visibleSeries) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataItem = processedData.find(d => d.month === label);
    if (!dataItem) return null;

    return (
      <div className="p-3.5 bg-card border border-border/80 shadow-2xl rounded-2xl text-xs space-y-2.5 min-w-[220px]">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <span className="font-extrabold text-foreground text-sm flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            {dataItem.fullMonthName}
          </span>
          {dataItem.diffR$ !== 0 && (
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                dataItem.diffR$ > 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}
            >
              {dataItem.diffR$ > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {dataItem.diffR$ > 0 ? '+' : ''}{dataItem.diffPct.toFixed(1)}%
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          {visibleSeries.Caixa && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Caixa:
              </span>
              <div className="text-right">
                <span className="font-mono font-bold text-foreground">{formatCurrency(dataItem.Caixa)}</span>
                <span className="text-[10px] text-muted-foreground block font-medium">({dataItem.pctCaixa.toFixed(1)}%)</span>
              </div>
            </div>
          )}

          {visibleSeries.Reservas && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span>
                Reservas:
              </span>
              <div className="text-right">
                <span className="font-mono font-bold text-foreground">{formatCurrency(dataItem.Reservas)}</span>
                <span className="text-[10px] text-muted-foreground block font-medium">({dataItem.pctReservas.toFixed(1)}%)</span>
              </div>
            </div>
          )}

          {visibleSeries.Investimentos && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                Investimentos:
              </span>
              <div className="text-right">
                <span className="font-mono font-bold text-foreground">{formatCurrency(dataItem.Investimentos)}</span>
                <span className="text-[10px] text-muted-foreground block font-medium">({dataItem.pctInvestimentos.toFixed(1)}%)</span>
              </div>
            </div>
          )}

          {visibleSeries.PatrimonioTotal && (
            <div className="pt-2 border-t border-border/50 flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                Patrimônio Total:
              </span>
              <span className="font-mono font-black text-indigo-500 text-sm">
                {formatCurrency(dataItem.PatrimonioTotal)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-5 rounded-3xl border border-border/80 bg-card shadow-xs space-y-5">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
            <h3 className="text-sm sm:text-base font-black tracking-tight text-foreground uppercase">
              Evolução Patrimonial ({selectedYear})
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-[10px] font-extrabold">
              Consolidado
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Evolução mensal e composição integrada dos saldos de Caixa, Reservas e Investimentos.
          </p>
        </div>

        {/* CONTROLS: Year Selector & Chart Mode Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Year Selector */}
          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-2xl border border-border/50">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground ml-2" />
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-foreground px-2 py-1 focus:outline-none cursor-pointer"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr} className="bg-card text-foreground">
                  {yr} {yr === currentYear ? '(Atual)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Chart Type Toggle */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-2xl border border-border/50">
            <button
              onClick={() => setChartType('area')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                chartType === 'area'
                  ? 'bg-card text-foreground shadow-xs border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Área Empilhada"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Empilhado</span>
            </button>

            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                chartType === 'line'
                  ? 'bg-card text-foreground shadow-xs border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Linhas Comparativas"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Linhas</span>
            </button>

            <button
              onClick={() => setChartType('bar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                chartType === 'bar'
                  ? 'bg-card text-foreground shadow-xs border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Barras Empilhadas"
            >
              <BarChart2 className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Barras</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Patrimônio Atual */}
        <div className="p-3.5 rounded-2xl bg-indigo-500/[0.04] border border-indigo-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-indigo-500" />
              Patrimônio Atual
            </span>
            {yearMetrics.latest.diffR$ !== 0 && (
              <span
                className={`text-[9.5px] font-black px-1.5 py-0.2 rounded ${
                  yearMetrics.latest.diffR$ > 0
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 text-rose-500'
                }`}
              >
                {yearMetrics.latest.diffR$ > 0 ? '+' : ''}{yearMetrics.latest.diffPct.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-lg sm:text-xl font-black text-foreground tracking-tight">
            {formatCurrency(yearMetrics.latest.PatrimonioTotal)}
          </p>
          <p className="text-[10.5px] text-muted-foreground font-medium">
            Mês: <strong className="text-foreground">{yearMetrics.latest.month || '-'}</strong>
          </p>
        </div>

        {/* Crescimento no Ano (YTD) */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              Evolução no Ano
            </span>
            <span
              className={`text-[9.5px] font-black px-1.5 py-0.2 rounded ${
                yearMetrics.ytdDiffR$ >= 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-500'
              }`}
            >
              {yearMetrics.ytdDiffR$ >= 0 ? '+' : ''}{yearMetrics.ytdDiffPct.toFixed(1)}%
            </span>
          </div>
          <p className={`text-lg sm:text-xl font-black tracking-tight ${yearMetrics.ytdDiffR$ >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
            {formatCurrency(yearMetrics.ytdDiffR$)}
          </p>
          <p className="text-[10.5px] text-muted-foreground font-medium">
            De Jan a {yearMetrics.latest.month || 'Dez'}
          </p>
        </div>

        {/* Maior Saldo do Ano */}
        <div className="p-3.5 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              Pico no Ano
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
            {formatCurrency(yearMetrics.peakVal)}
          </p>
          <p className="text-[10.5px] text-muted-foreground font-medium">
            Maior patrimônio registrado
          </p>
        </div>

        {/* Média Mensal */}
        <div className="p-3.5 rounded-2xl bg-sky-500/[0.04] border border-sky-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
              Evolução Média / Mês
            </span>
          </div>
          <p className={`text-lg sm:text-xl font-black tracking-tight ${yearMetrics.avgMonthlyNet >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-500'}`}>
            {formatCurrency(yearMetrics.avgMonthlyNet)}
          </p>
          <p className="text-[10.5px] text-muted-foreground font-medium">
            Aporte + valorização média
          </p>
        </div>
      </div>

      {/* COMPOSITION PROGRESS BAR */}
      <div className="p-3 bg-muted/20 rounded-2xl border border-border/40 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
          <span className="font-extrabold text-foreground flex items-center gap-1.5">
            <PieIcon className="w-3.5 h-3.5 text-primary" />
            Composição Atual do Patrimônio:
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono font-bold flex-wrap">
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Caixa: {yearMetrics.pctCaixa.toFixed(1)}% ({formatCurrency(yearMetrics.latest.Caixa)})
            </span>
            <span className="text-pink-600 dark:text-pink-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-pink-500"></span>
              Reservas: {yearMetrics.pctReservas.toFixed(1)}% ({formatCurrency(yearMetrics.latest.Reservas)})
            </span>
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Investimentos: {yearMetrics.pctInvestimentos.toFixed(1)}% ({formatCurrency(yearMetrics.latest.Investimentos)})
            </span>
          </div>
        </div>

        {/* Stacked Bar */}
        <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden flex shadow-inner">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${Math.max(0, yearMetrics.pctCaixa)}%` }}
            title={`Caixa: ${yearMetrics.pctCaixa.toFixed(1)}%`}
          ></div>
          <div
            className="h-full bg-pink-500 transition-all duration-500"
            style={{ width: `${Math.max(0, yearMetrics.pctReservas)}%` }}
            title={`Reservas: ${yearMetrics.pctReservas.toFixed(1)}%`}
          ></div>
          <div
            className="h-full bg-amber-500 transition-all duration-500"
            style={{ width: `${Math.max(0, yearMetrics.pctInvestimentos)}%` }}
            title={`Investimentos: ${yearMetrics.pctInvestimentos.toFixed(1)}%`}
          ></div>
        </div>
      </div>

      {/* SERIES TOGGLES & LEGEND */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-1">
        <span className="font-extrabold text-muted-foreground uppercase text-[10px] tracking-wider">
          Séries no Gráfico:
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => toggleSeries('Caixa')}
            className={`px-2.5 py-1 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              visibleSeries.Caixa
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-muted/40 text-muted-foreground/50 border-transparent line-through'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Caixa
          </button>

          <button
            type="button"
            onClick={() => toggleSeries('Reservas')}
            className={`px-2.5 py-1 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              visibleSeries.Reservas
                ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30'
                : 'bg-muted/40 text-muted-foreground/50 border-transparent line-through'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-pink-500"></span>
            Reservas
          </button>

          <button
            type="button"
            onClick={() => toggleSeries('Investimentos')}
            className={`px-2.5 py-1 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              visibleSeries.Investimentos
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-muted/40 text-muted-foreground/50 border-transparent line-through'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Investimentos
          </button>

          <button
            type="button"
            onClick={() => toggleSeries('PatrimonioTotal')}
            className={`px-2.5 py-1 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              visibleSeries.PatrimonioTotal
                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
                : 'bg-muted/40 text-muted-foreground/50 border-transparent line-through'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            Patrimônio Total
          </button>
        </div>
      </div>

      {/* CHART CONTAINER */}
      <div className="h-[340px] w-full pt-2">
        {processedData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2.5 text-xs text-muted-foreground font-semibold italic border border-dashed border-border/60 rounded-2xl p-6 text-center">
            <p>Nenhum mês com lançamento registrado no ano de {selectedYear}.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={processedData} margin={{ top: 15, right: 15, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCaixa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorReservas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorInvestimentos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorPatrimonio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 'bold' }}
                  tickFormatter={val => (hideValues ? '••••' : `R$ ${Math.round(val).toLocaleString('pt-BR')}`)}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                
                <Area
                  key="area-caixa"
                  type="monotone"
                  dataKey="Caixa"
                  name="Caixa"
                  stackId="1"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCaixa)"
                  hide={!visibleSeries.Caixa}
                />
                <Area
                  key="area-reservas"
                  type="monotone"
                  dataKey="Reservas"
                  name="Reservas"
                  stackId="1"
                  stroke="#ec4899"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorReservas)"
                  hide={!visibleSeries.Reservas}
                />
                <Area
                  key="area-investimentos"
                  type="monotone"
                  dataKey="Investimentos"
                  name="Investimentos"
                  stackId="1"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorInvestimentos)"
                  hide={!visibleSeries.Investimentos}
                />
                <Line
                  key="line-patrimonio-area"
                  type="monotone"
                  dataKey="PatrimonioTotal"
                  name="Patrimônio Total"
                  stroke="#6366f1"
                  strokeWidth={3.5}
                  dot={{ r: 4, stroke: '#6366f1', strokeWidth: 2, fill: '#18181b' }}
                  activeDot={{ r: 7 }}
                  hide={!visibleSeries.PatrimonioTotal}
                />
              </AreaChart>
            ) : chartType === 'line' ? (
              <LineChart data={processedData} margin={{ top: 15, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 'bold' }}
                  tickFormatter={val => (hideValues ? '••••' : `R$ ${Math.round(val).toLocaleString('pt-BR')}`)}
                />
                <RechartsTooltip content={<CustomTooltip />} />

                <Line
                  key="line-caixa"
                  type="monotone"
                  dataKey="Caixa"
                  name="Caixa"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, stroke: '#10b981', strokeWidth: 2, fill: '#18181b' }}
                  activeDot={{ r: 6 }}
                  hide={!visibleSeries.Caixa}
                />
                <Line
                  key="line-reservas"
                  type="monotone"
                  dataKey="Reservas"
                  name="Reservas"
                  stroke="#ec4899"
                  strokeWidth={2.5}
                  dot={{ r: 4, stroke: '#ec4899', strokeWidth: 2, fill: '#18181b' }}
                  activeDot={{ r: 6 }}
                  hide={!visibleSeries.Reservas}
                />
                <Line
                  key="line-investimentos"
                  type="monotone"
                  dataKey="Investimentos"
                  name="Investimentos"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 4, stroke: '#f59e0b', strokeWidth: 2, fill: '#18181b' }}
                  activeDot={{ r: 6 }}
                  hide={!visibleSeries.Investimentos}
                />
                <Line
                  key="line-patrimonio"
                  type="monotone"
                  dataKey="PatrimonioTotal"
                  name="Patrimônio Total"
                  stroke="#6366f1"
                  strokeWidth={3.5}
                  strokeDasharray="4 4"
                  dot={{ r: 5, stroke: '#6366f1', strokeWidth: 2, fill: '#18181b' }}
                  activeDot={{ r: 7 }}
                  hide={!visibleSeries.PatrimonioTotal}
                />
              </LineChart>
            ) : (
              <BarChart data={processedData} margin={{ top: 15, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 'bold' }}
                  tickFormatter={val => (hideValues ? '••••' : `R$ ${Math.round(val).toLocaleString('pt-BR')}`)}
                />
                <RechartsTooltip content={<CustomTooltip />} />

                <Bar
                  key="bar-caixa"
                  dataKey="Caixa"
                  name="Caixa"
                  stackId="a"
                  fill="#10b981"
                  radius={!visibleSeries.Reservas && !visibleSeries.Investimentos ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  hide={!visibleSeries.Caixa}
                />
                <Bar
                  key="bar-reservas"
                  dataKey="Reservas"
                  name="Reservas"
                  stackId="a"
                  fill="#ec4899"
                  radius={!visibleSeries.Investimentos ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  hide={!visibleSeries.Reservas}
                />
                <Bar
                  key="bar-investimentos"
                  dataKey="Investimentos"
                  name="Investimentos"
                  stackId="a"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  hide={!visibleSeries.Investimentos}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* TABLE TOGGLE BUTTON */}
      <div className="pt-2 border-t border-border/40 flex items-center justify-between">
        <button
          onClick={() => setShowTable(!showTable)}
          className="text-xs font-bold text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 cursor-pointer py-1"
        >
          <TableIcon className="w-4 h-4 text-indigo-500" />
          <span>{showTable ? 'Ocultar Tabela Detalhada' : 'Ver Detalhamento Mensal em Tabela'}</span>
          {showTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <span className="text-[11px] font-semibold text-muted-foreground hidden sm:inline">
          {processedData.length} meses apurados em {selectedYear}
        </span>
      </div>

      {/* EXPANDABLE TABLE DETAIL */}
      {showTable && (
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-muted/10 animate-in fade-in duration-200">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 font-extrabold text-muted-foreground uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Mês</th>
                <th className="py-3 px-4 text-emerald-600 dark:text-emerald-400">Caixa</th>
                <th className="py-3 px-4 text-pink-600 dark:text-pink-400">Reservas</th>
                <th className="py-3 px-4 text-amber-600 dark:text-amber-400">Investimentos</th>
                <th className="py-3 px-4 text-indigo-500">Patrimônio Total</th>
                <th className="py-3 px-4 text-right">Variação Mensal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-sans">
              {processedData.map((row, idx) => (
                <tr key={row.monthKey} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    {row.fullMonthName}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span className="text-foreground font-semibold">{formatCurrency(row.Caixa)}</span>
                    <span className="text-[10px] text-muted-foreground block">({row.pctCaixa.toFixed(1)}%)</span>
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span className="text-foreground font-semibold">{formatCurrency(row.Reservas)}</span>
                    <span className="text-[10px] text-muted-foreground block">({row.pctReservas.toFixed(1)}%)</span>
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span className="text-foreground font-semibold">{formatCurrency(row.Investimentos)}</span>
                    <span className="text-[10px] text-muted-foreground block">({row.pctInvestimentos.toFixed(1)}%)</span>
                  </td>
                  <td className="py-3 px-4 font-mono font-black text-indigo-500 text-sm">
                    {formatCurrency(row.PatrimonioTotal)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold">
                    {idx === 0 ? (
                      <span className="text-muted-foreground font-normal text-[11px]">-</span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] ${
                          row.diffR$ >= 0
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                        }`}
                      >
                        {row.diffR$ >= 0 ? '+' : ''}{formatCurrency(row.diffR$)} ({row.diffR$ >= 0 ? '+' : ''}{row.diffPct.toFixed(1)}%)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
