import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  TrendingUp,
  TrendingDown,
  Calculator,
  Fuel,
  Landmark,
  Wallet,
  Home,
  MapPin,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Eye,
  EyeOff,
  BarChart3,
  CalendarRange,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export type IndicatorType =
  | 'faturamento_bruto'
  | 'fat_liquido_op'
  | 'gastos_totais'
  | 'operacional_puro'
  | 'lucro_liquido'
  | 'balanco_caixa'
  | 'gasto_pessoal'
  | 'km_rodado'
  | 'combustivel';

export const ALL_INDICATORS: IndicatorType[] = [
  'faturamento_bruto',
  'fat_liquido_op',
  'gastos_totais',
  'operacional_puro',
  'lucro_liquido',
  'balanco_caixa',
  'gasto_pessoal',
  'km_rodado',
  'combustivel',
];

export interface MonthHistoryItem {
  monthStr: string; // 'yyyy-MM'
  label: string; // 'Setembro/2026'
  shortLabel: string; // 'Set/26'
  value: number;
  formattedValue: string;
  changePct: number | null; // % vs previous chronologically
  txCount: number;
}

export const INDICATOR_CONFIG: Record<
  IndicatorType,
  {
    title: string;
    subtitle: string;
    unit: 'currency' | 'km';
    color: string;
    strokeColor: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
    icon: React.ComponentType<{ className?: string }>;
    isExpense?: boolean;
  }
> = {
  faturamento_bruto: {
    title: 'Faturamento (Bruto)',
    subtitle: 'Entradas de caixa, vendas de ativos e proventos',
    unit: 'currency',
    color: '#10b981',
    strokeColor: '#10b981',
    textColor: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    icon: TrendingUp,
    isExpense: false,
  },
  fat_liquido_op: {
    title: 'Fat. Líquido (Pós-Op.)',
    subtitle: 'Faturamento bruto menos despesas operacionais puras',
    unit: 'currency',
    color: '#059669',
    strokeColor: '#059669',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    icon: Calculator,
    isExpense: false,
  },
  gastos_totais: {
    title: 'Gastos Totais',
    subtitle: 'Despesas operacionais e despesas pessoais consolidadas',
    unit: 'currency',
    color: '#f43f5e',
    strokeColor: '#f43f5e',
    textColor: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    icon: TrendingDown,
    isExpense: true,
  },
  operacional_puro: {
    title: 'Operacional (Puro)',
    subtitle: 'Custos diretos da atividade (combustível, manutenção, pedágio)',
    unit: 'currency',
    color: '#f59e0b',
    strokeColor: '#f59e0b',
    textColor: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    icon: Fuel,
    isExpense: true,
  },
  lucro_liquido: {
    title: 'Lucro Líquido',
    subtitle: 'Resultado financeiro patrimonial real do mês',
    unit: 'currency',
    color: '#6366f1',
    strokeColor: '#6366f1',
    textColor: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    icon: Landmark,
    isExpense: false,
  },
  balanco_caixa: {
    title: 'Balanço do Caixa',
    subtitle: 'Saldo líquido mensal do fluxo de caixa e aportes',
    unit: 'currency',
    color: '#3b82f6',
    strokeColor: '#3b82f6',
    textColor: 'text-blue-500 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    icon: Wallet,
    isExpense: false,
  },
  gasto_pessoal: {
    title: 'Gasto Pessoal',
    subtitle: 'Despesas pessoais do mês (excluindo aportes e ativos)',
    unit: 'currency',
    color: '#e11d48',
    strokeColor: '#e11d48',
    textColor: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    icon: Home,
    isExpense: true,
  },
  km_rodado: {
    title: 'KM Rodado',
    subtitle: 'Distância percorrida nas categorias com odômetro',
    unit: 'km',
    color: '#06b6d4',
    strokeColor: '#06b6d4',
    textColor: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    icon: MapPin,
    isExpense: false,
  },
  combustivel: {
    title: 'Combustível',
    subtitle: 'Valor financeiro real registrado em combustível',
    unit: 'currency',
    color: '#d97706',
    strokeColor: '#d97706',
    textColor: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    icon: Fuel,
    isExpense: true,
  },
};

export const formatIndicatorValue = (val: number, unit: 'currency' | 'km', hide = false) => {
  if (hide) return '•••••';
  if (unit === 'km') {
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(val))} km`;
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

interface IndicatorHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indicator: IndicatorType | null;
  onSelectIndicator?: (indicator: IndicatorType) => void;
  historyData: MonthHistoryItem[]; // Filtered by current active period if applicable
  allHistoryData: MonthHistoryItem[]; // Full history
  currentPeriodLabel: string;
  isPeriodFiltered: boolean;
  hideValues?: boolean;
}

export const IndicatorHistoryModal: React.FC<IndicatorHistoryModalProps> = ({
  open,
  onOpenChange,
  indicator,
  onSelectIndicator,
  historyData,
  allHistoryData,
  currentPeriodLabel,
  isPeriodFiltered,
  hideValues = false,
}) => {
  // If the active dashboard filter is restricted to a period (e.g. this year, last 90 days),
  // allow user to toggle between "Período do Dashboard" and "Todo o Histórico"
  const [viewScope, setViewScope] = useState<'filtered' | 'all'>('all');
  const [chartType, setChartType] = useState<'area' | 'bar' | 'line'>('area');

  const currentMonthStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const config = indicator ? INDICATOR_CONFIG[indicator] : null;

  const displayData = useMemo(() => {
    const raw = (!isPeriodFiltered || viewScope === 'all')
      ? allHistoryData
      : (historyData.length > 0 ? historyData : allHistoryData);

    // "Nos gráficos e tabelas não mostre os valores zerados que ainda irão vir"
    // Exclude future months (> currentMonthStr) where value is zero
    return raw.filter(item => !(item.monthStr > currentMonthStr && item.value === 0));
  }, [isPeriodFiltered, viewScope, allHistoryData, historyData, currentMonthStr]);

  // Statistics
  const stats = useMemo(() => {
    if (!displayData || displayData.length === 0) {
      return { total: 0, avg: 0, maxItem: null, minItem: null };
    }
    const total = displayData.reduce((sum, item) => sum + item.value, 0);
    const avg = total / displayData.length;
    let maxItem = displayData[0];
    let minItem = displayData[0];
    displayData.forEach(item => {
      if (item.value > maxItem.value) maxItem = item;
      if (item.value < minItem.value) minItem = item;
    });
    return { total, avg, maxItem, minItem };
  }, [displayData]);

  // Chronological data for Recharts (left to right = oldest to newest)
  const chartData = useMemo(() => {
    return [...displayData].reverse();
  }, [displayData]);

  if (!indicator || !config) return null;

  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={false}
        className="max-w-2xl sm:max-w-2xl max-h-[90vh] p-0 bg-card border border-border/70 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col outline-none focus:outline-none focus-visible:outline-none"
      >
        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/40 shrink-0 bg-muted/20">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-xl border shrink-0 ${config.bgColor} ${config.borderColor}`}
              >
                <Icon className={`w-5 h-5 ${config.textColor}`} />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                  Histórico — {config.title}
                </DialogTitle>
                <DialogDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                  {config.subtitle}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Alternar entre outros gráficos disponíveis */}
          {onSelectIndicator && (
            <div className="mt-3 pt-3 border-t border-border/30">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Alternar Indicador:
                </span>
                <span className="text-[10px] text-muted-foreground/70 font-semibold">
                  {ALL_INDICATORS.length} disponíveis
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                {ALL_INDICATORS.map((indKey) => {
                  const itemCfg = INDICATOR_CONFIG[indKey];
                  const isCurrent = indicator === indKey;
                  const ItemIcon = itemCfg.icon;
                  return (
                    <button
                      key={indKey}
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectIndicator(indKey);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all duration-150 cursor-pointer select-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 active:outline-none ${
                        isCurrent
                          ? `${itemCfg.bgColor} ${itemCfg.textColor} border ${itemCfg.borderColor} shadow-2xs font-extrabold scale-[1.02]`
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/40'
                      }`}
                    >
                      <ItemIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>{itemCfg.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filter Scope Selector (when Dashboard has an active period filter) */}
          {isPeriodFiltered && (
            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/30">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                <CalendarRange className="w-3.5 h-3.5 text-muted-foreground" />
                Filtragem:
              </span>
              <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5 text-xs font-bold">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewScope('all');
                  }}
                  className={`px-2.5 py-1 rounded-md transition-all text-[11px] font-bold cursor-pointer select-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 active:outline-none ${
                    viewScope === 'all'
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Todo o Histórico ({allHistoryData.length} {allHistoryData.length === 1 ? 'mês' : 'meses'})
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewScope('filtered');
                  }}
                  className={`px-2.5 py-1 rounded-md transition-all text-[11px] font-bold cursor-pointer select-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 active:outline-none ${
                    viewScope === 'filtered'
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Período: {currentPeriodLabel}
                </button>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Média Mensal
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-foreground mt-0.5 block truncate">
                {formatIndicatorValue(stats.avg, config.unit, hideValues)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Pico Máximo
              </span>
              <div className="mt-0.5 truncate">
                <span className="text-sm sm:text-base font-black font-mono text-foreground block truncate">
                  {stats.maxItem
                    ? formatIndicatorValue(stats.maxItem.value, config.unit, hideValues)
                    : '-'}
                </span>
                {stats.maxItem && (
                  <span className="text-[10px] font-semibold text-muted-foreground truncate block">
                    {stats.maxItem.label}
                  </span>
                )}
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-muted/30 border border-border/50">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Total Acumulado
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-foreground mt-0.5 block truncate">
                {formatIndicatorValue(stats.total, config.unit, hideValues)}
              </span>
            </div>
          </div>

          {/* Visual Chart (Monthly Evolution) */}
          {chartData.length > 1 && (
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-muted/20 border border-border/50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  Evolução Mensal
                </span>
                <div className="flex items-center gap-2">
                  {/* Seletor do estilo de gráfico */}
                  <div className="inline-flex rounded-lg border border-border/50 bg-muted/40 p-0.5 text-[10px] font-bold">
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        setChartType('area');
                      }}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer select-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 active:outline-none ${
                        chartType === 'area'
                          ? 'bg-card text-foreground shadow-2xs font-extrabold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Área
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        setChartType('bar');
                      }}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer select-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 active:outline-none ${
                        chartType === 'bar'
                          ? 'bg-card text-foreground shadow-2xs font-extrabold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Barras
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        setChartType('line');
                      }}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer select-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 active:outline-none ${
                        chartType === 'line'
                          ? 'bg-card text-foreground shadow-2xs font-extrabold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Linha
                    </button>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground hidden sm:inline">
                    {chartData.length} meses
                  </span>
                </div>
              </div>

              <div className="h-40 sm:h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'area' ? (
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`gradient-${indicator}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={config.color} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={config.color} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
                      <XAxis
                        dataKey="shortLabel"
                        stroke="#71717a"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#71717a"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={val => {
                          if (hideValues) return '•••';
                          if (config.unit === 'km') return `${val}k`;
                          if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                          return `${val}`;
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const item = payload[0].payload as MonthHistoryItem;
                            return (
                              <div className="rounded-xl border border-border bg-popover p-2.5 shadow-lg text-xs font-semibold space-y-1">
                                <p className="font-extrabold text-foreground">{item.label}</p>
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-muted-foreground">{config.title}:</span>
                                  <span className="font-black font-mono text-foreground">
                                    {formatIndicatorValue(item.value, config.unit, hideValues)}
                                  </span>
                                </div>
                                {item.changePct !== null && (
                                  <p
                                    className={`text-[10px] font-bold ${
                                      item.changePct >= 0
                                        ? config.isExpense
                                          ? 'text-rose-500'
                                          : 'text-emerald-500'
                                        : config.isExpense
                                        ? 'text-emerald-500'
                                        : 'text-rose-500'
                                    }`}
                                  >
                                    {item.changePct >= 0 ? '+' : ''}
                                    {item.changePct.toFixed(1)}% vs mês anterior
                                  </p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={config.strokeColor}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill={`url(#gradient-${indicator})`}
                      />
                    </AreaChart>
                  ) : chartType === 'bar' ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
                      <XAxis
                        dataKey="shortLabel"
                        stroke="#71717a"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#71717a"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={val => {
                          if (hideValues) return '•••';
                          if (config.unit === 'km') return `${val}k`;
                          if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                          return `${val}`;
                        }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const item = payload[0].payload as MonthHistoryItem;
                            return (
                              <div className="rounded-xl border border-border bg-popover p-2.5 shadow-lg text-xs font-semibold space-y-1">
                                <p className="font-extrabold text-foreground">{item.label}</p>
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-muted-foreground">{config.title}:</span>
                                  <span className="font-black font-mono text-foreground">
                                    {formatIndicatorValue(item.value, config.unit, hideValues)}
                                  </span>
                                </div>
                                {item.changePct !== null && (
                                  <p
                                    className={`text-[10px] font-bold ${
                                      item.changePct >= 0
                                        ? config.isExpense
                                          ? 'text-rose-500'
                                          : 'text-emerald-500'
                                        : config.isExpense
                                        ? 'text-emerald-500'
                                        : 'text-rose-500'
                                    }`}
                                  >
                                    {item.changePct >= 0 ? '+' : ''}
                                    {item.changePct.toFixed(1)}% vs mês anterior
                                  </p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="value"
                        fill={config.color}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
                      <XAxis
                        dataKey="shortLabel"
                        stroke="#71717a"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#71717a"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={val => {
                          if (hideValues) return '•••';
                          if (config.unit === 'km') return `${val}k`;
                          if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                          return `${val}`;
                        }}
                      />
                      <Tooltip
                        cursor={{ stroke: '#27272a', strokeWidth: 1 }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const item = payload[0].payload as MonthHistoryItem;
                            return (
                              <div className="rounded-xl border border-border bg-popover p-2.5 shadow-lg text-xs font-semibold space-y-1">
                                <p className="font-extrabold text-foreground">{item.label}</p>
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-muted-foreground">{config.title}:</span>
                                  <span className="font-black font-mono text-foreground">
                                    {formatIndicatorValue(item.value, config.unit, hideValues)}
                                  </span>
                                </div>
                                {item.changePct !== null && (
                                  <p
                                    className={`text-[10px] font-bold ${
                                      item.changePct >= 0
                                        ? config.isExpense
                                          ? 'text-rose-500'
                                          : 'text-emerald-500'
                                        : config.isExpense
                                        ? 'text-emerald-500'
                                        : 'text-rose-500'
                                    }`}
                                  >
                                    {item.changePct >= 0 ? '+' : ''}
                                    {item.changePct.toFixed(1)}% vs mês anterior
                                  </p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={config.strokeColor}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: config.strokeColor }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Primary Table: Mês a Mês (Sorted Most Recent to Oldest) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Histórico Mês a Mês
              </h4>
              <span className="text-[11px] font-semibold text-muted-foreground">
                Do mais recente ao mais antigo
              </span>
            </div>

            {displayData.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border/60 bg-muted/10">
                <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-bold text-foreground">Nenhum dado registrado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Não foram encontradas movimentações para este indicador no histórico.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border/50 text-[10px] uppercase font-black tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3 sm:px-4">Mês</th>
                        <th className="py-2.5 px-3 sm:px-4 text-right">Valor</th>
                        <th className="py-2.5 px-3 sm:px-4 text-right">Variação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-medium">
                      {displayData.map((item, idx) => {
                        const isPositiveChange = item.changePct !== null && item.changePct >= 0;
                        const isZeroChange = item.changePct !== null && item.changePct === 0;
                        
                        // For expenses, an increase (+%) is negative (red), decrease (-%) is positive (green)
                        let changeColor = 'text-muted-foreground';
                        if (item.changePct !== null && !isZeroChange) {
                          if (config.isExpense) {
                            changeColor = isPositiveChange
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400';
                          } else {
                            changeColor = isPositiveChange
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400';
                          }
                        }

                        return (
                          <tr
                            key={item.monthStr}
                            className={`hover:bg-muted/30 transition-colors ${
                              idx === 0 ? 'bg-muted/15' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 sm:px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-foreground text-xs sm:text-sm">
                                  {item.label}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 sm:px-4 text-right">
                              <span className="font-mono font-black text-xs sm:text-sm text-foreground">
                                {formatIndicatorValue(item.value, config.unit, hideValues)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 sm:px-4 text-right">
                              {item.changePct !== null ? (
                                <span
                                  className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${changeColor}`}
                                >
                                  {item.changePct > 0 ? (
                                    <ArrowUpRight className="w-3 h-3" />
                                  ) : item.changePct < 0 ? (
                                    <ArrowDownRight className="w-3 h-3" />
                                  ) : (
                                    <Minus className="w-3 h-3" />
                                  )}
                                  {item.changePct > 0 ? '+' : ''}
                                  {item.changePct.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60 text-[10px]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-muted/20 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <span className="text-[11px]">
            Total de <strong>{displayData.length}</strong> {displayData.length === 1 ? 'mês com movimentação' : 'meses com movimentação'}
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3.5 py-1.5 rounded-lg border border-border/60 hover:bg-muted/40 font-bold text-foreground text-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
