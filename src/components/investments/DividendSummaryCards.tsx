import React, { useMemo, useState, useEffect } from 'react';
import { Dividend } from '../../types';
import { CurrencyInput } from '../CurrencyInput';
import { useData } from '../../contexts/DataContext';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Legend
} from 'recharts';
import { 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Target, 
  Calendar,
  Sparkles,
  Check,
  Award,
  Filter,
  Info,
  Layers,
  Zap
} from 'lucide-react';

interface DividendSummaryCardsProps {
  dividends: Dividend[];
  totalInvested: number;
  formatCurrency: (val: number) => string;
  onOpenAddDivModal: (ticker?: string) => void;
  analysisMode?: 'received_only' | 'include_provisioned';
  onAnalysisModeChange?: (mode: 'received_only' | 'include_provisioned') => void;
}

export function DividendSummaryCards({
  dividends,
  totalInvested,
  formatCurrency,
  onOpenAddDivModal,
  analysisMode: externalMode,
  onAnalysisModeChange
}: DividendSummaryCardsProps) {
  const dataContext = useData();
  const transactions = dataContext?.transactions || [];

  // Active mode from props, context, or fallback
  const activeMode = externalMode !== undefined 
    ? externalMode 
    : (dataContext?.dividendAnalysisMode || 'received_only');

  const handleModeChange = (newMode: 'received_only' | 'include_provisioned') => {
    if (dataContext?.setDividendAnalysisMode) {
      dataContext.setDividendAnalysisMode(newMode);
    }
    if (onAnalysisModeChange) {
      onAnalysisModeChange(newMode);
    }
  };

  // Calculate average personal monthly expense from transactions
  const avgPersonalExpense = useMemo(() => {
    const expenseTxs = transactions.filter(t => t.type === 'expense');
    if (expenseTxs.length === 0) return 0;

    const monthlyTotals: Record<string, number> = {};
    expenseTxs.forEach(t => {
      if (!t.date) return;
      const key = t.date.slice(0, 7); // YYYY-MM
      monthlyTotals[key] = (monthlyTotals[key] || 0) + Number(t.amount || 0);
    });

    const months = Object.keys(monthlyTotals);
    if (months.length === 0) return 0;

    const sum = Object.values(monthlyTotals).reduce((a, b) => a + b, 0);
    return Math.round((sum / months.length) * 100) / 100;
  }, [transactions]);

  const [monthlyExpenseGoal, setMonthlyExpenseGoal] = useState<string>(() => {
    return avgPersonalExpense > 0 ? avgPersonalExpense.toFixed(0) : '3000';
  });

  // Sync default goal when avgPersonalExpense is calculated
  useEffect(() => {
    if (avgPersonalExpense > 0 && (monthlyExpenseGoal === '3000' || !monthlyExpenseGoal || monthlyExpenseGoal === '0')) {
      setMonthlyExpenseGoal(avgPersonalExpense.toFixed(0));
    }
  }, [avgPersonalExpense]);

  // Totals
  const totals = useMemo(() => {
    const received = dividends.filter(d => d.status === 'received').reduce((acc, d) => acc + d.amount, 0);
    const provisioned = dividends.filter(d => d.status === 'provisioned').reduce((acc, d) => acc + d.amount, 0);
    const total = received + provisioned;
    
    const consideredAmount = activeMode === 'include_provisioned' ? total : received;
    const yieldOnCost = totalInvested > 0 ? (consideredAmount / totalInvested) * 100 : 0;
    
    return { received, provisioned, total, consideredAmount, yieldOnCost };
  }, [dividends, totalInvested, activeMode]);

  // Monthly Dividends Bar Chart Data (Last 12 Months + Upcoming months with provisioned)
  const monthlyData = useMemo(() => {
    const receivedMap: Record<string, number> = {};
    const provisionedMap: Record<string, number> = {};
    const now = new Date();
    
    // Last 12 months + next 2 forward-looking months for provisioned
    const allKeys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      receivedMap[key] = 0;
      provisionedMap[key] = 0;
      allKeys.push(key);
    }
    
    // Add next 2 upcoming months
    for (let i = 1; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!allKeys.includes(key)) {
        receivedMap[key] = 0;
        provisionedMap[key] = 0;
        allKeys.push(key);
      }
    }

    dividends.forEach(div => {
      const dateStr = div.data_ex || div.date;
      if (!dateStr) return;
      const key = dateStr.slice(0, 7); // YYYY-MM
      
      if (div.status === 'received') {
        if (receivedMap[key] === undefined) {
          receivedMap[key] = 0;
          provisionedMap[key] = 0;
          allKeys.push(key);
        }
        receivedMap[key] += div.amount;
      } else {
        if (provisionedMap[key] === undefined) {
          receivedMap[key] = 0;
          provisionedMap[key] = 0;
          allKeys.push(key);
        }
        provisionedMap[key] += div.amount;
      }
    });

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    return allKeys.sort().map(key => {
      const [year, month] = key.split('-');
      const monthIdx = parseInt(month, 10) - 1;
      const rec = Math.round((receivedMap[key] || 0) * 100) / 100;
      const prov = Math.round((provisionedMap[key] || 0) * 100) / 100;
      const total = activeMode === 'include_provisioned' ? rec + prov : rec;

      return {
        key,
        label: `${monthNames[monthIdx]}/${year.slice(2)}`,
        recebido: rec,
        provisionado: prov,
        total: total
      };
    });
  }, [dividends, activeMode]);

  // Average monthly income over months with income
  const avgMonthlyIncome = useMemo(() => {
    const activeMonths = monthlyData.filter(m => (activeMode === 'include_provisioned' ? m.total : m.recebido) > 0);
    const sum = monthlyData.reduce((acc, m) => acc + (activeMode === 'include_provisioned' ? m.total : m.recebido), 0);
    return sum / Math.max(1, activeMonths.length || 1);
  }, [monthlyData, activeMode]);

  // Freedom Goal coverage percentage
  const goalNum = useMemo(() => {
    const clean = monthlyExpenseGoal.replace(/\./g, '').replace(',', '.');
    const val = Number(clean);
    return isNaN(val) || val <= 0 ? 3000 : val;
  }, [monthlyExpenseGoal]);

  const freedomPct = Math.min(100, (avgMonthlyIncome / goalNum) * 100);

  // Provisioned Dividends
  const provisionedList = useMemo(() => {
    return dividends
      .filter(d => d.status === 'provisioned')
      .sort((a, b) => (a.data_ex || a.date || '').localeCompare(b.data_ex || b.date || ''));
  }, [dividends]);

  return (
    <div className="space-y-6">
      {/* ANALYSIS MODE SELECTOR BANNER */}
      <div className="p-3.5 rounded-2xl border border-border/50 bg-card shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-black text-foreground">Modo de Análise de Proventos</span>
            <p className="text-[11px] text-muted-foreground">
              {activeMode === 'received_only'
                ? 'Considerando apenas proventos já efetivados e creditados em caixa.'
                : 'Considerando proventos já recebidos + proventos anunciados a receber.'}
            </p>
          </div>
        </div>

        <div className="flex items-center p-1 bg-muted/50 rounded-xl border border-border/50 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleModeChange('received_only')}
            className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${
              activeMode === 'received_only'
                ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Apenas Recebidos</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('include_provisioned')}
            className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${
              activeMode === 'include_provisioned'
                ? 'bg-card text-amber-500 shadow-xs border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Recebidos + A Receber</span>
            {totals.provisioned > 0 && (
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                +{formatCurrency(totals.provisioned)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Proventos Considerados */}
        <div className="p-4 rounded-2xl border border-border/50 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {activeMode === 'include_provisioned' ? 'Proventos (Total Projetado)' : 'Total Recebido'}
            </span>
            {activeMode === 'include_provisioned' ? (
              <Sparkles className="w-4 h-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <div className="mt-2">
            <p className={`text-xl font-black tracking-tight ${activeMode === 'include_provisioned' ? 'text-amber-500' : 'text-emerald-500'}`}>
              {formatCurrency(totals.consideredAmount)}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              {activeMode === 'include_provisioned' 
                ? `Recebidos: ${formatCurrency(totals.received)} + A Receber: ${formatCurrency(totals.provisioned)}`
                : 'Creditado nas reservas/contas'}
            </p>
          </div>
        </div>

        {/* A Receber / Provisionado */}
        <div className="p-4 rounded-2xl border border-border/50 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">A Receber (Provisionado)</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <p className="text-xl font-black text-amber-500 tracking-tight">{formatCurrency(totals.provisioned)}</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Crédito automático no dia do pagamento</p>
          </div>
        </div>

        {/* Média Mensal */}
        <div className="p-4 rounded-2xl border border-border/50 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Média Mensal</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <p className="text-xl font-black text-indigo-500 tracking-tight">{formatCurrency(avgMonthlyIncome)}</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              {activeMode === 'include_provisioned' ? 'Média com proventos futuros' : 'Renda média já realizada'}
            </p>
          </div>
        </div>

        {/* Yield on Cost */}
        <div className="p-4 rounded-2xl border border-border/50 bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Yield on Cost</span>
            <Award className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2">
            <p className="text-xl font-black text-primary tracking-tight">{totals.yieldOnCost.toFixed(2)}%</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              {activeMode === 'include_provisioned' ? 'Retorno c/ provisionados s/ custo' : 'Retorno efetivado s/ custo'}
            </p>
          </div>
        </div>
      </div>

      {/* MONTHLY BAR CHART */}
      <div className="p-5 rounded-3xl border border-border/50 bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Evolução Mensal de Dividendos
            </h3>
            <p className="text-xs text-muted-foreground">
              {activeMode === 'include_provisioned'
                ? 'Histórico de proventos recebidos (verde) e provisionados a receber (amarelo)'
                : 'Histórico de rendimentos efetivamente recebidos mês a mês'}
            </p>
          </div>

          <button
            onClick={() => onOpenAddDivModal()}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all flex items-center gap-1.5 self-start sm:self-auto shadow-sm cursor-pointer"
          >
            + Novo Provento
          </button>
        </div>

        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(val: number, name: string) => {
                  const label = name === 'recebido' ? 'Recebido' : name === 'provisionado' ? 'A Receber (Provisionado)' : 'Total';
                  return [formatCurrency(val), label];
                }}
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  borderRadius: '16px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  fontWeight: 700,
                  fontSize: '12px'
                }}
              />
              <Legend 
                verticalAlign="top" 
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '10px', fontSize: '11px', fontWeight: 'bold' }}
              />
              <Bar dataKey="recebido" name="Recebido" fill="#10b981" stackId="divs" radius={activeMode === 'include_provisioned' ? [0, 0, 0, 0] : [8, 8, 0, 0]} />
              {activeMode === 'include_provisioned' && (
                <Bar dataKey="provisionado" name="A Receber" fill="#f59e0b" stackId="divs" radius={[8, 8, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PASSIVE INCOME FREEDOM METER */}
      <div className="p-5 rounded-3xl border border-border/50 bg-gradient-to-r from-emerald-500/10 via-card to-card shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-500" />
              <h3 className="text-base font-black text-foreground">Termômetro de Liberdade Financeira</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Sua renda passiva média considerada é de <strong>{formatCurrency(avgMonthlyIncome)}/mês</strong>. Defina sua meta de custo de vida:
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-muted-foreground">Meta Mensal:</span>
              <CurrencyInput
                value={monthlyExpenseGoal}
                onChange={setMonthlyExpenseGoal}
                className="w-32 bg-card border border-border/60 rounded-xl px-3 py-1.5 text-xs font-black text-foreground focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
            {avgPersonalExpense > 0 && (
              <button
                type="button"
                onClick={() => setMonthlyExpenseGoal(avgPersonalExpense.toFixed(0))}
                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                title="Puxar gasto médio mensal das despesas pessoais"
              >
                <Sparkles className="w-3 h-3" />
                Gasto Médio Pessoal ({formatCurrency(avgPersonalExpense)})
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-xs font-black">
            <span className="text-emerald-500">{freedomPct.toFixed(1)}% do Custo de Vida Coberto</span>
            <span className="text-muted-foreground">{formatCurrency(avgMonthlyIncome)} de {formatCurrency(goalNum)}</span>
          </div>
          <div className="w-full h-3 rounded-full bg-muted/60 overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${freedomPct}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* PROVISIONED DIVIDENDS EXPLANATION & QUICK APPROVAL SECTION */}
      {provisionedList.length > 0 && (
        <div className="p-5 rounded-3xl border border-amber-500/30 bg-amber-500/5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-black text-foreground">Proventos Anunciados (Crédito Automático no Pagamento)</h3>
            </div>
            <span className="px-2.5 py-0.5 text-xs font-extrabold rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 self-start sm:self-auto">
              {provisionedList.length} agendados
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <p className="leading-relaxed">
              <strong>Processamento Automático:</strong> Estes proventos foram registrados como anunciados e são <strong>creditados automaticamente</strong> no saldo da sua Reserva de Investimentos na data de pagamento informada.
            </p>
          </div>

          <div className="space-y-2">
            {provisionedList.map(div => (
              <div 
                key={div.id}
                className="p-3.5 rounded-2xl bg-card border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm">{div.ticker}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground uppercase">
                      {div.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    Data Pagamento: {div.data_ex ? new Date(div.data_ex + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : div.date}
                  </p>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <span className="text-base font-black text-amber-500">{formatCurrency(div.amount)}</span>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Aguardando Pagamento
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
