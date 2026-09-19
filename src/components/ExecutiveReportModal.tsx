import React, { useState, useMemo, useRef } from 'react';
import { 
  BarChart2, 
  Printer, 
  Download, 
  FileDown,
  Loader2,
  Eye, 
  EyeOff, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShieldCheck, 
  Fuel, 
  Wrench, 
  Building2, 
  FileText, 
  PieChart as PieIcon, 
  Award, 
  Calendar, 
  Target, 
  Gauge, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight,
  Sliders
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Transaction, UserSettings, Reserve } from '../types';
import { downloadExecutiveReportPDF } from '../lib/executiveReportPdfGenerator';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/lib/toast';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';

interface ExecutiveReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allTransactions: Transaction[];
  settings: UserSettings | null;
  reserves?: Reserve[];
}

export const ExecutiveReportModal: React.FC<ExecutiveReportModalProps> = ({
  open,
  onOpenChange,
  allTransactions,
  settings,
  reserves = []
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('month'); // 'month', 'lastMonth', 'last30Days', 'thisYear', 'yyyy-MM'
  const [hideValues, setHideValues] = useState<boolean>(false);
  const [customMonthKey, setCustomMonthKey] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Helper date parser
  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    if (dateStr.includes('T')) {
      const datePart = dateStr.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0);
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  };

  const formatCurrency = (val: number, forceShow = false) => {
    if (hideValues && !forceShow) return 'R$ ••••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Get available months in dataset
  const availableMonths = useMemo(() => {
    const monthMap: Record<string, Date> = {};
    allTransactions.forEach(t => {
      const d = parseLocalDate(t.date);
      const key = format(d, 'yyyy-MM');
      if (key >= '2026-03' && !monthMap[key]) {
        monthMap[key] = d;
      }
    });
    return Object.entries(monthMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, date]) => ({
        key,
        label: format(date, 'MMMM yyyy', { locale: ptBR })
      }));
  }, [allTransactions]);

  // Compute period start and end dates
  const { dateRange, periodLabel } = useMemo(() => {
    const now = new Date();
    let start = startOfMonth(now);
    let end = endOfMonth(now);
    let label = format(now, 'MMMM / yyyy', { locale: ptBR });

    if (selectedPeriod === 'lastMonth') {
      const lm = subMonths(now, 1);
      start = startOfMonth(lm);
      end = endOfMonth(lm);
      label = format(lm, 'MMMM / yyyy', { locale: ptBR });
    } else if (selectedPeriod === 'last30Days') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      end = now;
      label = 'Últimos 30 Dias';
    } else if (selectedPeriod === 'thisYear') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      label = `Ano de ${now.getFullYear()}`;
    } else if (selectedPeriod.startsWith('custom-')) {
      const key = selectedPeriod.replace('custom-', '');
      const [year, month] = key.split('-').map(Number);
      const d = new Date(year, month - 1, 1);
      start = startOfMonth(d);
      end = endOfMonth(d);
      label = format(d, 'MMMM / yyyy', { locale: ptBR });
    }

    return {
      dateRange: { start, end },
      periodLabel: label.charAt(0).toUpperCase() + label.slice(1)
    };
  }, [selectedPeriod]);

  // Filter transactions for period
  const periodTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      const d = parseLocalDate(t.date);
      return isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
    });
  }, [allTransactions, dateRange]);

  // Operational categories helper
  const isOpCategory = (cat: string) => {
    const opList = settings?.operational_expense_categories || [
      'Combustível', 'Manutenção', 'Troca de Óleo', 'Lava-Jato', 'Pedágio',
      'Seguro Veicular', 'IPVA / Licenciamento', 'Peças e Acessórios', 'Pneu',
      'Mecânico', 'Equipamentos', 'Outros Operacionais'
    ];
    return opList.includes(cat) || cat === 'Combustível' || cat === 'Manutenção';
  };

  // Detailed Financial Calculations for DRE & Report
  const dreData = useMemo(() => {
    let grossIncome = 0;
    const incomeByCategory: Record<string, number> = {};

    let opFuel = 0;
    let opMaint = 0;
    let opOther = 0;
    const opByCategory: Record<string, number> = {};

    let perExpense = 0;
    const perByCategory: Record<string, number> = {};

    let reserveAporte = 0;
    let reserveSpending = 0;
    let totalKm = 0;

    const categoriesWithKm = settings?.categories_with_km || [];

    periodTransactions.forEach(t => {
      const amt = Number(t.amount || 0);

      // Accumulate KM
      if (categoriesWithKm.includes(t.category) && t.end_km && t.start_km && t.end_km >= t.start_km) {
        totalKm += (t.end_km - t.start_km);
      }

      if (t.type === 'income') {
        // Exclude internal transfers/reserve resgates if marked
        if (t.category === 'Resgate Reserva' || t.category === 'Resgate de Reserva') return;
        grossIncome += amt;
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + amt;
      } else if (t.type === 'expense') {
        if ((t as any).isInvestmentTx) return;

        if (t.category === 'Aporte Reserva') {
          reserveAporte += amt;
          return;
        }

        if ((t as any).isReserveTx === true && (t as any).reserveTxType === 'utilizacao') {
          reserveSpending += amt;
        }

        if (isOpCategory(t.category)) {
          opByCategory[t.category] = (opByCategory[t.category] || 0) + amt;
          if (t.category === 'Combustível') {
            opFuel += amt;
          } else if (t.category === 'Manutenção' || t.category === 'Troca de Óleo' || t.category === 'Peças e Acessórios' || t.category === 'Pneu') {
            opMaint += amt;
          } else {
            opOther += amt;
          }
        } else {
          perExpense += amt;
          perByCategory[t.category] = (perByCategory[t.category] || 0) + amt;
        }
      }
    });

    const totalOpExpense = opFuel + opMaint + opOther;
    const opNetResult = grossIncome - totalOpExpense; // EBITDA Operacional do Veículo
    const opMargin = grossIncome > 0 ? (opNetResult / grossIncome) * 100 : 0;

    const netProfitReal = opNetResult - perExpense; // Lucro Líquido Real
    const netMargin = grossIncome > 0 ? (netProfitReal / grossIncome) * 100 : 0;

    const totalExpenseAll = totalOpExpense + perExpense;

    // Unitary metrics per KM
    const rpk = totalKm > 0 ? grossIncome / totalKm : 0;
    const cpk = totalKm > 0 ? totalOpExpense / totalKm : 0;
    const cpkFuel = totalKm > 0 ? opFuel / totalKm : 0;
    const cpkMaint = totalKm > 0 ? opMaint / totalKm : 0;
    const lpk = totalKm > 0 ? netProfitReal / totalKm : 0;
    const moe = totalOpExpense > 0 ? grossIncome / totalOpExpense : 0;

    // Breakeven Analysis
    const mcoPct = grossIncome > 0 ? (grossIncome - totalOpExpense) / grossIncome : 0;
    const fatBreakeven = mcoPct > 0 ? totalExpenseAll / mcoPct : totalExpenseAll;
    const mcoKm = rpk - cpk;
    const kmBreakeven = mcoKm > 0 ? totalExpenseAll / mcoKm : 0;
    const safetyMarginPct = fatBreakeven > 0 ? ((grossIncome - fatBreakeven) / fatBreakeven) * 100 : 0;

    return {
      grossIncome,
      incomeByCategory,
      opFuel,
      opMaint,
      opOther,
      totalOpExpense,
      opByCategory,
      opNetResult,
      opMargin,
      perExpense,
      perByCategory,
      netProfitReal,
      netMargin,
      totalExpenseAll,
      reserveAporte,
      reserveSpending,
      totalKm,
      rpk,
      cpk,
      cpkFuel,
      cpkMaint,
      lpk,
      moe,
      fatBreakeven,
      kmBreakeven,
      safetyMarginPct
    };
  }, [periodTransactions, settings]);

  // Chart data for DRE visual
  const dreChartData = useMemo(() => {
    return [
      { name: 'Fat. Bruto', valor: dreData.grossIncome, fill: '#10b981' },
      { name: 'Custo Op. (OpEx)', valor: dreData.totalOpExpense, fill: '#f59e0b' },
      { name: 'Desp. Pessoais', valor: dreData.perExpense, fill: '#3b82f6' },
      { name: 'Lucro Líquido', valor: Math.max(0, dreData.netProfitReal), fill: '#6366f1' }
    ];
  }, [dreData]);

  // Chart data for Operational Cost Composition
  const opCostPieData = useMemo(() => {
    return [
      { name: 'Combustível', valor: dreData.opFuel, color: '#f97316' },
      { name: 'Manutenção', valor: dreData.opMaint, color: '#eab308' },
      { name: 'Outros Operacionais', valor: dreData.opOther, color: '#06b6d4' }
    ].filter(d => d.valor > 0);
  }, [dreData]);

  // Export to CSV Function
  const handleExportCSV = () => {
    const formatCSVNum = (num: number) => {
      if (isNaN(num) || !isFinite(num)) return '0,00';
      return num.toFixed(2).replace('.', ',');
    };

    const rows = [
      ['SEP=;'], // Instancia o delimitador do Excel para evitar desconfigurações regionais
      ['RELATÓRIO GERENCIAL DE PERFORMANCE FINANCEIRA & OPERACIONAL'],
      ['Período de Referência', periodLabel],
      ['Data de Emissão', format(new Date(), 'dd/MM/yyyy HH:mm')],
      ['Operador / Responsável', settings?.full_name || 'Gestão de Frota'],
      [''],
      ['1. DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE GERENCIAL)'],
      ['Item / Estrutura de Contas', 'Tipo', 'Valor (R$)', '% da Receita'],
      ['1.0 RECEITA OPERACIONAL BRUTA', 'Receita', formatCSVNum(dreData.grossIncome), '100,0%'],
    ];

    // Subcategories of income
    Object.entries(dreData.incomeByCategory).forEach(([cat, val]) => {
      const numVal = Number(val);
      const pct = dreData.grossIncome > 0 ? (numVal / dreData.grossIncome) * 100 : 0;
      rows.push([`  (+) ${cat}`, 'Receita Detalhada', formatCSVNum(numVal), `${pct.toFixed(1).replace('.', ',')}%`]);
    });

    rows.push(['']);
    rows.push(['2.0 CUSTOS OPERACIONAIS VEICULARES (OpEx Direto)', 'Despesa Operacional', formatCSVNum(dreData.totalOpExpense), `${(dreData.grossIncome > 0 ? (dreData.totalOpExpense / dreData.grossIncome) * 100 : 0).toFixed(1).replace('.', ',')}%`]);
    rows.push(['  (-) Combustível & Abastecimentos', 'Combustível', formatCSVNum(dreData.opFuel), `${(dreData.grossIncome > 0 ? (dreData.opFuel / dreData.grossIncome) * 100 : 0).toFixed(1).replace('.', ',')}%`]);
    rows.push(['  (-) Manutenção, Peças & Trocas', 'Manutenção', formatCSVNum(dreData.opMaint), `${(dreData.grossIncome > 0 ? (dreData.opMaint / dreData.grossIncome) * 100 : 0).toFixed(1).replace('.', ',')}%`]);
    if (dreData.opOther > 0) {
      rows.push(['  (-) Outras Despesas Operacionais', 'Outras Op.', formatCSVNum(dreData.opOther), `${(dreData.grossIncome > 0 ? (dreData.opOther / dreData.grossIncome) * 100 : 0).toFixed(1).replace('.', ',')}%`]);
    }

    rows.push(['']);
    rows.push(['3.0 (=) RESULTADO OPERACIONAL (EBITDA VEICULAR)', 'Resultado Parcial', formatCSVNum(dreData.opNetResult), `${dreData.opMargin.toFixed(1).replace('.', ',')}%`]);
    
    rows.push(['']);
    rows.push(['4.0 (-) DESPESAS PESSOAIS & RETIRADAS (Pró-labore)', 'Despesa Pessoal', formatCSVNum(dreData.perExpense), `${(dreData.grossIncome > 0 ? (dreData.perExpense / dreData.grossIncome) * 100 : 0).toFixed(1).replace('.', ',')}%`]);
    Object.entries(dreData.perByCategory).forEach(([cat, val]) => {
      const numVal = Number(val);
      const pct = dreData.grossIncome > 0 ? (numVal / dreData.grossIncome) * 100 : 0;
      rows.push([`  (-) ${cat}`, 'Pessoal Detalhada', formatCSVNum(numVal), `${pct.toFixed(1).replace('.', ',')}%`]);
    });

    rows.push(['']);
    rows.push(['5.0 (=) LUCRO LÍQUIDO REAL CONSOLIDADO DO PERÍODO', 'Resultado Final', formatCSVNum(dreData.netProfitReal), `${dreData.netMargin.toFixed(1).replace('.', ',')}%`]);
    if (dreData.reserveAporte !== 0) {
      rows.push(['(±) Movimentação de Reserva / Aporte', 'Ajuste Reserva', formatCSVNum(dreData.reserveAporte), '-']);
    }

    rows.push(['']);
    rows.push(['2. INDICADORES DE PERFORMANCE E EFICIÊNCIA OPERACIONAL']);
    rows.push(['Indicador de Performance', 'Unidade', 'Valor Obtido', 'Status / Referência']);
    
    rows.push(['Quilometragem Total Rodada', 'KM', dreData.totalKm > 0 ? dreData.totalKm.toFixed(1).replace('.', ',') : '0,0', dreData.totalKm > 0 ? 'Registro de Tráfego' : 'Sem registros']);
    rows.push(['Receita Bruta por KM (RPK)', 'R$/KM', formatCSVNum(dreData.rpk), 'Rendimento Médio por KM']);
    rows.push(['Custo Operacional por KM (CPK)', 'R$/KM', formatCSVNum(dreData.cpk), 'Custo de Manutenção & Abastecimento por KM']);
    rows.push(['  CPK - Parcela Combustível', 'R$/KM', formatCSVNum(dreData.cpkFuel), 'Custo Específico de Combustível']);
    rows.push(['  CPK - Parcela Manutenção', 'R$/KM', formatCSVNum(dreData.cpkMaint), 'Custo Específico de Manutenção']);
    rows.push(['Lucro Líquido por KM (LPK)', 'R$/KM', formatCSVNum(dreData.lpk), 'Rentabilidade de Rota por KM']);
    rows.push(['Multiplicador de Eficiência (MOE)', 'x', dreData.moe.toFixed(2).replace('.', ','), dreData.moe >= 1.5 ? 'Alta Eficiência Operacional' : 'Abaixo da meta recomendada']);
    
    rows.push(['']);
    rows.push(['3. DIRETRIZES DE PONTO DE EQUILÍBRIO (BREAKEVEN)']);
    rows.push(['Indicador de Breakeven', 'Métrica', 'Valor de Referência', 'Avaliação de Saúde Financeira']);
    rows.push(['Faturamento Mínimo para Breakeven', 'R$', formatCSVNum(dreData.fatBreakeven), dreData.grossIncome >= dreData.fatBreakeven ? 'Faturamento Atual Acima do Breakeven (SEGURO)' : 'Faturamento Atual Abaixo do Breakeven (ALERTA)']);
    rows.push(['Quilometragem Mínima de Breakeven', 'KM', dreData.kmBreakeven > 0 ? dreData.kmBreakeven.toFixed(0) : '0', 'KM mínima para pagar todos os custos']);
    rows.push(['Margem de Segurança Financeira', '%', `${dreData.safetyMarginPct.toFixed(1).replace('.', ',')}%`, dreData.safetyMarginPct >= 20 ? 'Margem Segura (>20%)' : 'Margem de Segurança Estreita (<20%)']);

    // Constrói o conteúdo CSV utilizando quebras de linha padrão do Windows (\r\n) para Excel
    const csvContent = rows.map(e => e.join(';')).join('\r\n');
    
    // Cria o Blob especificando codificação UTF-8 e adiciona o BOM (\uFEFF) para Excel abrir acentos perfeitamente
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_Gerencial_Performance_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    try {
      setIsGeneratingPdf(true);
      await downloadExecutiveReportPDF(dreData, periodLabel, settings);
    } catch (error: any) {
      console.error('Erro ao gerar PDF do relatório:', error);
      toast.error('Erro ao gerar PDF do relatório: ' + (error?.message || 'Tente novamente.'));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl lg:max-w-7xl w-[96vw] xl:w-[92vw] p-0 bg-card border-border/80 rounded-3xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col print:max-w-none print:w-full print:h-auto print:max-h-none print:p-0 print:border-none print:shadow-none print:rounded-none">
        
        {/* Top Control Header (Hidden on Print) */}
        <DialogHeader className="p-4 sm:p-5 pb-4 border-b border-border/40 shrink-0 bg-muted/5 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-500 shrink-0" />
              <DialogTitle className="text-lg font-black text-foreground tracking-tight">
                Relatório Gerencial
              </DialogTitle>
            </div>

            {/* Action Bar - Compact & Complete Buttons */}
            <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHideValues(!hideValues)}
                className="rounded-xl h-9 px-3 text-xs font-bold bg-card hover:bg-muted cursor-pointer transition-all shadow-2xs gap-1"
              >
                {hideValues ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Eye className="w-3.5 h-3.5 text-emerald-500" />}
                <span>{hideValues ? 'Mostrar' : 'Ocultar'}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="rounded-xl h-9 px-3 text-xs font-bold bg-card hover:bg-muted cursor-pointer transition-all shadow-2xs gap-1"
              >
                <Download className="w-3.5 h-3.5 text-indigo-500" />
                <span>CSV</span>
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={handleExportPDF}
                disabled={isGeneratingPdf}
                className="rounded-xl h-9 px-3 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all shadow-2xs gap-1"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                <span>{isGeneratingPdf ? 'Gerando...' : 'Exportar PDF'}</span>
              </Button>
            </div>
          </div>

          {/* Period Selector Chips */}
          <div className="flex items-center gap-3 pt-4 border-t border-border/30 mt-4 overflow-x-auto scrollbar-none">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-muted-foreground shrink-0 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" /> Período de Análise:
            </span>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
              <button
                type="button"
                onClick={() => setSelectedPeriod('month')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                  selectedPeriod === 'month' 
                    ? 'bg-primary text-primary-foreground font-black shadow-md' 
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground'
                }`}
              >
                Mês Atual
              </button>
              <button
                type="button"
                onClick={() => setSelectedPeriod('lastMonth')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                  selectedPeriod === 'lastMonth' 
                    ? 'bg-primary text-primary-foreground font-black shadow-md' 
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground'
                }`}
              >
                Mês Passado
              </button>
              <button
                type="button"
                onClick={() => setSelectedPeriod('last30Days')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                  selectedPeriod === 'last30Days' 
                    ? 'bg-primary text-primary-foreground font-black shadow-md' 
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground'
                }`}
              >
                Últimos 30 Dias
              </button>
              <button
                type="button"
                onClick={() => setSelectedPeriod('thisYear')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                  selectedPeriod === 'thisYear' 
                    ? 'bg-primary text-primary-foreground font-black shadow-md' 
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground'
                }`}
              >
                Este Ano
              </button>

              {availableMonths.map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelectedPeriod(`custom-${m.key}`)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                    selectedPeriod === `custom-${m.key}` 
                      ? 'bg-indigo-600 text-white font-black shadow-md' 
                      : 'bg-muted/40 hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Printable Report Body */}
        <div id="printable-report-area" className="overflow-y-auto p-5 sm:p-8 lg:p-10 space-y-8 bg-card flex-1 print:overflow-visible print:p-0">
          
          {/* Executive Header Box */}
          <div className="bg-gradient-to-br from-card via-muted/30 to-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-emerald-500">
                    RELATÓRIO GERENCIAL CONSOLIDADO
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground mt-0.5">
                  {settings?.full_name || 'Gestão de Frota & Transporte'}
                </h2>
                <p className="text-xs text-muted-foreground font-semibold">
                  Demonstrativo de Desempenho Operacional e Viabilidade Financeira
                </p>
              </div>

              <div className="flex flex-col sm:items-end text-xs font-mono space-y-0.5 text-muted-foreground">
                <span className="font-extrabold text-foreground text-sm">
                  Período: <span className="text-primary">{periodLabel}</span>
                </span>
                <span>Emissão: {format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
                <span className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wider">
                  Código: #REP-{format(new Date(), 'yyyyMMdd')}-{Math.floor(Math.random() * 899 + 100)}
                </span>
              </div>
            </div>

            {/* KPI Cards Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-card border border-border/60 rounded-xl p-3 space-y-1 shadow-2xs">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                  Fat. Bruto Consolidado
                </span>
                <p className="text-lg sm:text-xl font-black text-emerald-500 font-mono tracking-tight">
                  {formatCurrency(dreData.grossIncome)}
                </p>
                <span className="text-[9.5px] font-bold text-muted-foreground block">
                  100% da Receita Operacional
                </span>
              </div>

              <div className="bg-card border border-border/60 rounded-xl p-3 space-y-1 shadow-2xs">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                  Custo Op. Veicular (OpEx)
                </span>
                <p className="text-lg sm:text-xl font-black text-amber-500 font-mono tracking-tight">
                  {formatCurrency(dreData.totalOpExpense)}
                </p>
                <span className="text-[9.5px] font-bold text-amber-500/90 block">
                  {dreData.grossIncome > 0 ? ((dreData.totalOpExpense / dreData.grossIncome) * 100).toFixed(1) : '0'}% do Faturamento
                </span>
              </div>

              <div className="bg-card border border-border/60 rounded-xl p-3 space-y-1 shadow-2xs">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                  EBITDA Veicular (Op. Bruto)
                </span>
                <p className="text-lg sm:text-xl font-black text-indigo-500 font-mono tracking-tight">
                  {formatCurrency(dreData.opNetResult)}
                </p>
                <span className="text-[9.5px] font-bold text-indigo-500/90 block">
                  Margem Op: {dreData.opMargin.toFixed(1)}%
                </span>
              </div>

              <div className="bg-card border border-border/60 rounded-xl p-3 space-y-1 shadow-2xs">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                  Lucro Líquido Real
                </span>
                <p className={`text-lg sm:text-xl font-black font-mono tracking-tight ${dreData.netProfitReal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {formatCurrency(dreData.netProfitReal)}
                </p>
                <span className="text-[9.5px] font-bold text-emerald-500 block">
                  Margem Líquida: {dreData.netMargin.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Demonstrativo do Resultado do Exercício (DRE) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2 print:border-black">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-black uppercase tracking-wider text-foreground print:text-black">
                1. Demonstrativo do Resultado do Exercício (DRE Gerencial)
              </h3>
            </div>

            <div className="border border-border/70 rounded-2xl overflow-hidden shadow-2xs print:border-black">
              <table className="w-full text-xs font-medium text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/60 font-black uppercase tracking-wider text-[10px] text-muted-foreground print:bg-gray-200 print:text-black">
                    <th className="py-2.5 px-3 sm:px-4">Item / Estrutura de Contas</th>
                    <th className="py-2.5 px-3 sm:px-4 text-right">Valor (R$)</th>
                    <th className="py-2.5 px-3 sm:px-4 text-right">% Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono print:divide-gray-300">
                  
                  {/* Receita Operacional Bruta */}
                  <tr className="bg-emerald-500/5 font-extrabold text-emerald-500 print:bg-gray-100 print:text-black">
                    <td className="py-2.5 px-3 sm:px-4 uppercase tracking-wide">
                      1.0 RECEITA OPERACIONAL BRUTA
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right">
                      {formatCurrency(dreData.grossIncome)}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right">100.0%</td>
                  </tr>

                  {/* Subcategorias de Receita */}
                  {Object.entries(dreData.incomeByCategory).map(([cat, val]) => {
                    const numVal = Number(val);
                    return (
                      <tr key={cat} className="text-muted-foreground hover:bg-muted/20 print:text-black">
                        <td className="py-2 px-3 sm:px-4 pl-6 sm:pl-8 text-[11px] font-sans">
                          (+) {cat}
                        </td>
                        <td className="py-2 px-3 sm:px-4 text-right">
                          {formatCurrency(numVal)}
                        </td>
                        <td className="py-2 px-3 sm:px-4 text-right text-[10.5px]">
                          {((numVal / (dreData.grossIncome || 1)) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}

                  {/* Custos Operacionais Directos (OpEx) */}
                  <tr className="bg-amber-500/5 font-extrabold text-amber-500 print:bg-gray-100 print:text-black">
                    <td className="py-2.5 px-3 sm:px-4 uppercase tracking-wide">
                      2.0 (-) CUSTOS OPERACIONAIS VEICULARES (OpEx Direto)
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right">
                      {formatCurrency(dreData.totalOpExpense)}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right">
                      {((dreData.totalOpExpense / (dreData.grossIncome || 1)) * 100).toFixed(1)}%
                    </td>
                  </tr>

                  {/* Subcategorias de OpEx */}
                  <tr className="text-muted-foreground hover:bg-muted/20 print:text-black">
                    <td className="py-2 px-3 sm:px-4 pl-6 sm:pl-8 text-[11px] font-sans flex items-center gap-1.5">
                      <Fuel className="w-3.5 h-3.5 text-orange-500 shrink-0" /> Combustível & Abastecimentos
                    </td>
                    <td className="py-2 px-3 sm:px-4 text-right">
                      {formatCurrency(dreData.opFuel)}
                    </td>
                    <td className="py-2 px-3 sm:px-4 text-right text-[10.5px]">
                      {((dreData.opFuel / (dreData.grossIncome || 1)) * 100).toFixed(1)}%
                    </td>
                  </tr>

                  <tr className="text-muted-foreground hover:bg-muted/20 print:text-black">
                    <td className="py-2 px-3 sm:px-4 pl-6 sm:pl-8 text-[11px] font-sans flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-yellow-500 shrink-0" /> Manutenção, Peças & Troca de Óleo
                    </td>
                    <td className="py-2 px-3 sm:px-4 text-right">
                      {formatCurrency(dreData.opMaint)}
                    </td>
                    <td className="py-2 px-3 sm:px-4 text-right text-[10.5px]">
                      {((dreData.opMaint / (dreData.grossIncome || 1)) * 100).toFixed(1)}%
                    </td>
                  </tr>

                  {dreData.opOther > 0 && (
                    <tr className="text-muted-foreground hover:bg-muted/20 print:text-black">
                      <td className="py-2 px-3 sm:px-4 pl-6 sm:pl-8 text-[11px] font-sans">
                        Outras Despesas Operacionais (Pedágios/Lava-jato/Acessórios)
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-right">
                        {formatCurrency(dreData.opOther)}
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-right text-[10.5px]">
                        {((dreData.opOther / (dreData.grossIncome || 1)) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  )}

                  {/* Resultado Operacional Bruto (EBITDA) */}
                  <tr className="bg-indigo-500/10 font-black text-indigo-500 text-sm print:bg-gray-200 print:text-black">
                    <td className="py-2.5 px-3 sm:px-4 uppercase tracking-wide">
                      3.0 (=) RESULTADO OPERACIONAL BRUTO (EBITDA VEICULAR)
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right">
                      {formatCurrency(dreData.opNetResult)}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right font-extrabold">
                      {dreData.opMargin.toFixed(1)}%
                    </td>
                  </tr>

                  {/* Despesas Pessoais / Pró-labore */}
                  <tr className="bg-blue-500/5 font-extrabold text-blue-500 print:bg-gray-100 print:text-black">
                    <td className="py-2.5 px-3 sm:px-4 uppercase tracking-wide">
                      4.0 (-) DESPESAS PESSOAIS & RETIRADAS (Pró-labore)
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right">
                      {formatCurrency(dreData.perExpense)}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right">
                      {((dreData.perExpense / (dreData.grossIncome || 1)) * 100).toFixed(1)}%
                    </td>
                  </tr>

                  {/* Subcategorias Pessoais */}
                  {Object.entries(dreData.perByCategory).map(([cat, val]) => {
                    const numVal = Number(val);
                    return (
                      <tr key={cat} className="text-muted-foreground hover:bg-muted/20 print:text-black">
                        <td className="py-2 px-3 sm:px-4 pl-6 sm:pl-8 text-[11px] font-sans">
                          (-) {cat}
                        </td>
                        <td className="py-2 px-3 sm:px-4 text-right">
                          {formatCurrency(numVal)}
                        </td>
                        <td className="py-2 px-3 sm:px-4 text-right text-[10.5px]">
                          {((numVal / (dreData.grossIncome || 1)) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}

                  {/* Lucro Líquido Real Consolidado */}
                  <tr className={`font-black text-sm print:bg-gray-300 print:text-black ${
                    dreData.netProfitReal >= 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                  }`}>
                    <td className="py-3 px-3 sm:px-4 uppercase tracking-wide">
                      5.0 (=) LUCRO LÍQUIDO REAL CONSOLIDADO DO PERÍODO
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right">
                      {formatCurrency(dreData.netProfitReal)}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right font-black">
                      {dreData.netMargin.toFixed(1)}%
                    </td>
                  </tr>

                  {/* Reservas & Aportes */}
                  {dreData.reserveAporte !== 0 && (
                    <tr className="text-muted-foreground text-[11px] italic print:text-black">
                      <td className="py-2 px-3 sm:px-4 pl-6 font-sans">
                        (±) Aportes e Movimentação de Reservas de Emergência
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-right">
                        {formatCurrency(dreData.reserveAporte)}
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-right">-</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Indicadores Gerenciais de Performance e Eficiência */}
          <div className="space-y-3 print:break-inside-avoid">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
              <Gauge className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-black uppercase tracking-wider text-foreground print:text-black">
                2. Indicadores Operacionais & Eficiência Estratégica
              </h3>
            </div>

            <div className="border border-border/70 rounded-2xl overflow-hidden shadow-2xs print:border-black bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-medium text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/60 font-black uppercase tracking-wider text-[10px] text-muted-foreground print:bg-gray-200 print:text-black">
                      <th className="py-3 px-4">Indicador / Descrição Técnica</th>
                      <th className="py-3 px-4 text-center">Unidade</th>
                      <th className="py-3 px-4 text-right">Valor Obtido</th>
                      <th className="py-3 px-4 text-center">Status / Avaliação de Performance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono print:divide-gray-300">
                    
                    {/* Quilometragem Rodada */}
                    <tr className="hover:bg-muted/10 transition-colors print:text-black">
                      <td className="py-2.5 px-4 font-sans flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
                          <Gauge className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-extrabold text-foreground block">Quilometragem Total Rodada</span>
                          <span className="text-[10px] text-muted-foreground font-normal">Soma das distâncias percorridas nas viagens registradas</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-muted-foreground">KM</td>
                      <td className="py-2.5 px-4 text-right font-black text-foreground">
                        {dreData.totalKm > 0 ? `${dreData.totalKm.toLocaleString('pt-BR')} km` : '0 km'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          Registro de Tráfego
                        </span>
                      </td>
                    </tr>

                    {/* RPK */}
                    <tr className="hover:bg-muted/10 transition-colors print:text-black">
                      <td className="py-2.5 px-4 font-sans flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-extrabold text-foreground block">RPK (Receita Bruta por KM)</span>
                          <span className="text-[10px] text-muted-foreground font-normal">Média de faturamento por quilômetro rodado</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-muted-foreground">R$/KM</td>
                      <td className="py-2.5 px-4 text-right font-black text-emerald-500">
                        {formatCurrency(dreData.rpk)}/km
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Rendimento Ativo
                        </span>
                      </td>
                    </tr>

                    {/* CPK */}
                    <tr className="hover:bg-muted/10 transition-colors print:text-black">
                      <td className="py-2.5 px-4 font-sans flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
                          <TrendingDown className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-extrabold text-foreground block">CPK (Custo Operacional por KM)</span>
                          <span className="text-[10px] text-muted-foreground font-normal">Média de despesas veiculares totais por quilômetro</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-muted-foreground">R$/KM</td>
                      <td className="py-2.5 px-4 text-right font-black text-amber-500">
                        {formatCurrency(dreData.cpk)}/km
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Eficiência de Custo
                        </span>
                      </td>
                    </tr>

                    {/* CPK Combustível */}
                    <tr className="hover:bg-muted/10 transition-colors print:text-black text-muted-foreground">
                      <td className="py-2 px-4 pl-12 font-sans flex items-center gap-2">
                        <Fuel className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        <div>
                          <span className="font-bold text-foreground block text-[11px]">• Parcela de Combustível</span>
                          <span className="text-[9.5px] font-normal">Fração do custo por KM gasta com abastecimentos</span>
                        </div>
                      </td>
                      <td className="py-2 px-4 text-center font-bold">R$/KM</td>
                      <td className="py-2 px-4 text-right font-bold">
                        {formatCurrency(dreData.cpkFuel)}/km
                      </td>
                      <td className="py-2 px-4 text-center text-[10px] font-sans">Combustível Direto</td>
                    </tr>

                    {/* CPK Manutenção */}
                    <tr className="hover:bg-muted/10 transition-colors print:text-black text-muted-foreground">
                      <td className="py-2 px-4 pl-12 font-sans flex items-center gap-2">
                        <Wrench className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                        <div>
                          <span className="font-bold text-foreground block text-[11px]">• Parcela de Manutenção</span>
                          <span className="text-[9.5px] font-normal">Fração do custo por KM gasta com oficinas e peças</span>
                        </div>
                      </td>
                      <td className="py-2 px-4 text-center font-bold">R$/KM</td>
                      <td className="py-2 px-4 text-right font-bold">
                        {formatCurrency(dreData.cpkMaint)}/km
                      </td>
                      <td className="py-2 px-4 text-center text-[10px] font-sans">Manutenção Geral</td>
                    </tr>

                    {/* LPK */}
                    <tr className="hover:bg-muted/10 transition-colors print:text-black">
                      <td className="py-2.5 px-4 font-sans flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 shrink-0">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-extrabold text-foreground block">LPK (Lucro Real por KM)</span>
                          <span className="text-[10px] text-muted-foreground font-normal">Retorno financeiro limpo (lucro líquido) por quilômetro rodado</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-muted-foreground">R$/KM</td>
                      <td className={`py-2.5 px-4 text-right font-black ${dreData.lpk >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {formatCurrency(dreData.lpk)}/km
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          dreData.lpk >= 0 
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}>
                          {dreData.lpk >= 0 ? 'Lucrativo' : 'Prejuízo p/ KM'}
                        </span>
                      </td>
                    </tr>

                    {/* MOE */}
                    <tr className="hover:bg-muted/10 transition-colors print:text-black">
                      <td className="py-2.5 px-4 font-sans flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500 shrink-0">
                          <Award className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-extrabold text-foreground block">Multiplicador de Eficiência (MOE)</span>
                          <span className="text-[10px] text-muted-foreground font-normal">Proporção de faturamento bruto gerado para cada R$ 1,00 de custo operacional</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-muted-foreground">fator (x)</td>
                      <td className="py-2.5 px-4 text-right font-black text-purple-400">
                        {dreData.moe.toFixed(2)}x
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          dreData.moe >= 1.5 
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        }`}>
                          {dreData.moe >= 1.5 ? 'Alta Eficiência' : 'Média/Baixa'}
                        </span>
                      </td>
                    </tr>

                    {/* Breakeven Financeiro */}
                    <tr className="hover:bg-muted/10 transition-colors print:text-black">
                      <td className="py-2.5 px-4 font-sans flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-500 shrink-0">
                          <Target className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-extrabold text-foreground block">Ponto de Equilíbrio Financeiro (Faturamento)</span>
                          <span className="text-[10px] text-muted-foreground font-normal">Faturamento bruto mínimo necessário para pagar todos os custos e despesas</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-muted-foreground">R$</td>
                      <td className="py-2.5 px-4 text-right font-black text-violet-400">
                        {formatCurrency(dreData.fatBreakeven)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          dreData.grossIncome >= dreData.fatBreakeven 
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}>
                          {dreData.grossIncome >= dreData.fatBreakeven ? 'Ponto Superado' : 'Abaixo do Equilíbrio'}
                        </span>
                      </td>
                    </tr>

                    {/* Breakeven Quilometragem */}
                    <tr className="hover:bg-muted/10 transition-colors print:text-black text-muted-foreground">
                      <td className="py-2 px-4 pl-12 font-sans flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <div>
                          <span className="font-bold text-foreground block text-[11px]">• Quilometragem Mínima de Breakeven</span>
                          <span className="text-[9.5px] font-normal">Distância que precisa rodar com a margem atual para equilibrar o caixa</span>
                        </div>
                      </td>
                      <td className="py-2 px-4 text-center font-bold">KM</td>
                      <td className="py-2 px-4 text-right font-bold text-violet-400">
                        {dreData.kmBreakeven > 0 ? `${Math.round(dreData.kmBreakeven).toLocaleString('pt-BR')} km` : 'N/A'}
                      </td>
                      <td className="py-2 px-4 text-center text-[10px] font-sans">Distância Mínima</td>
                    </tr>

                    {/* Margem de Segurança */}
                    <tr className="hover:bg-muted/10 transition-colors print:text-black">
                      <td className="py-2.5 px-4 font-sans flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-500 shrink-0">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-extrabold text-foreground block">Margem de Segurança Financeira</span>
                          <span className="text-[10px] text-muted-foreground font-normal">Percentual do faturamento obtido que excede o breakeven mínimo</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-muted-foreground">%</td>
                      <td className={`py-2.5 px-4 text-right font-black ${dreData.safetyMarginPct >= 20 ? 'text-teal-400' : 'text-rose-400'}`}>
                        {dreData.safetyMarginPct >= 0 ? '+' : ''}{dreData.safetyMarginPct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          dreData.safetyMarginPct >= 20 
                            ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' 
                            : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}>
                          {dreData.safetyMarginPct >= 20 ? 'Excelente' : 'Sensível'}
                        </span>
                      </td>
                    </tr>

                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 3: Gráficos Gerenciais */}
          <div className="space-y-3 print:block print:break-inside-avoid">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
              <PieIcon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                3. Visualização Gráfica do Desempenho
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Gráfico 1: DRE em Barras */}
              <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-2xs space-y-2">
                <span className="text-xs font-extrabold text-foreground uppercase tracking-wider block">
                  Composição DRE (Faturamento vs Custos)
                </span>
                <div className="h-[220px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dreChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa' }} tickFormatter={(val) => `R$ ${val}`} />
                      <RechartsTooltip 
                        formatter={(val: any) => [formatCurrency(Number(val)), 'Valor']}
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }}
                      />
                      <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                        {dreChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico 2: Pizza de Custos Operacionais */}
              <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-2xs space-y-2">
                <span className="text-xs font-extrabold text-foreground uppercase tracking-wider block">
                  Distribuição dos Custos Operacionais
                </span>
                <div className="h-[220px] w-full pt-2">
                  {opCostPieData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic font-medium">
                      Nenhum custo operacional registrado no período.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={opCostPieData}
                          dataKey="valor"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          innerRadius={35}
                          paddingAngle={3}
                        >
                          {opCostPieData.map((entry, index) => (
                            <Cell key={`pie-cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Gasto']} />
                        <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Assinatura e Notas do Relatório */}
          <div className="pt-4 border-t border-border/50 text-[10.5px] text-muted-foreground space-y-3 print:border-black print:text-black">
            <p className="leading-relaxed font-medium">
              <strong className="text-foreground print:text-black">Nota Metodológica:</strong> Este relatório gerencial consolida todas as corridas, entregas e gastos veiculares computados no sistema para o período de <span className="font-bold text-foreground print:text-black">{periodLabel}</span>. A margem de contribuição e o ponto de equilíbrio consideram os custos operacionais puros (combustível, manutenção e pedágios) agregados às despesas fixas e pessoais do motorista.
            </p>

            <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs font-bold border-t border-border/40 print:border-black">
              <div className="space-y-1">
                <div className="border-b border-foreground/40 w-48 mx-auto pb-1 print:border-black"></div>
                <span className="block text-foreground font-black print:text-black">{settings?.full_name || 'Motorista Responsável'}</span>
                <span className="text-[10px] text-muted-foreground font-normal print:text-black">Assinatura do Gestor / Operador</span>
              </div>
              <div className="space-y-1">
                <div className="border-b border-foreground/40 w-48 mx-auto pb-1 print:border-black"></div>
                <span className="block text-foreground font-black print:text-black">SISTEMA FINANCEIRO PRO</span>
                <span className="text-[10px] text-muted-foreground font-normal print:text-black">Autenticação e Auditoria Digital</span>
              </div>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};
