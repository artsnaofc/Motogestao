import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieIcon, 
  Building2, 
  Coins, 
  Sparkles, 
  HelpCircle,
  Layers,
  BarChart3,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from 'recharts';
import { PortfolioDiagnosisResult, SmartAlert } from '../../lib/portfolioDiagnosis';

interface PortfolioDiagnosisDashboardProps {
  diagnosis: PortfolioDiagnosisResult;
  hideValues?: boolean;
  onNavigateToRebalance?: () => void;
  onOpenAssetRaioX?: (ticker: string) => void;
  onSelectTicker?: (ticker: string) => void;
}

const COLORS = [
  '#0284c7', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316',
  '#6366f1', '#14b8a6', '#d946ef', '#64748b'
];

export const PortfolioDiagnosisDashboard: React.FC<PortfolioDiagnosisDashboardProps> = ({
  diagnosis,
  hideValues = false,
  onNavigateToRebalance,
  onOpenAssetRaioX,
  onSelectTicker
}) => {
  const [activeConcentrationTab, setActiveConcentrationTab] = useState<'assets' | 'sectors' | 'segments' | 'issuers'>('assets');

  // Macro pie data (Ações vs FIIs)
  const macroPieData = [
    { name: 'Ações B3', value: diagnosis.stocksValue, count: diagnosis.stocksCount, color: '#0284c7' },
    { name: 'Fundos Imobiliários (FIIs)', value: diagnosis.fiisValue, count: diagnosis.fiisCount, color: '#10b981' },
  ].filter(d => d.value > 0);

  // Sector pie data
  const sectorPieData = diagnosis.sectorConcentrations.map((item, idx) => ({
    name: item.name,
    value: item.value,
    percentage: item.percentage,
    color: COLORS[idx % COLORS.length]
  }));

  return (
    <div className="space-y-6">
      {/* 1. Header & Overview KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portfolio */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Patrimônio Total</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            R$ {diagnosis.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className={`font-semibold flex items-center gap-0.5 ${diagnosis.totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {diagnosis.totalGain >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {diagnosis.totalGain >= 0 ? '+' : ''}R$ {diagnosis.totalGain.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({diagnosis.totalGainPct.toFixed(2)}%)
            </span>
            <span className="text-slate-500">lucro total</span>
          </div>
        </div>

        {/* Stocks Proportion */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Ações B3 ({diagnosis.stocksCount})</span>
            <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            R$ {diagnosis.stocksValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mr-2">
              <div 
                className="bg-sky-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, diagnosis.stocksPct)}%` }}
              />
            </div>
            <span className="text-sky-400 font-bold whitespace-nowrap">{diagnosis.stocksPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* FIIs Proportion */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>FIIs B3 ({diagnosis.fiisCount})</span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            R$ {diagnosis.fiisValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mr-2">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, diagnosis.fiisPct)}%` }}
              />
            </div>
            <span className="text-emerald-400 font-bold whitespace-nowrap">{diagnosis.fiisPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Diversification Score (HHI) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Score Diversificação</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {diagnosis.diversificationScore}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${
              diagnosis.diversificationLevel === 'Excelente' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
              diagnosis.diversificationLevel === 'Boa' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' :
              diagnosis.diversificationLevel === 'Moderada' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
              'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              {diagnosis.diversificationLevel}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Índice HHI: {diagnosis.herfindahlIndex} {diagnosis.herfindahlIndex < 1500 ? '(Baixa concentração)' : '(Atenção a concentração)'}
          </div>
        </div>
      </div>

      {/* 2. Executive Diagnosis Summary Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Diagnóstico Automático da Carteira
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-3xl">
                {diagnosis.summaryText}
              </p>
            </div>
          </div>
          {onNavigateToRebalance && (
            <button
              onClick={onNavigateToRebalance}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-indigo-600/20 whitespace-nowrap self-stretch md:self-auto"
            >
              Simular Rebalanceamento
            </button>
          )}
        </div>
      </div>

      {/* 3. Smart Alerts Section */}
      {diagnosis.alerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Pontos de Atenção & Alertas Inteligentes ({diagnosis.alerts.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {diagnosis.alerts.map((alert) => (
              <div 
                key={alert.id}
                className={`p-4 rounded-2xl border transition-all ${
                  alert.severity === 'high' 
                    ? 'bg-rose-950/30 border-rose-500/30 text-rose-100' 
                    : alert.severity === 'opportunity'
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-100'
                    : 'bg-amber-950/30 border-amber-500/30 text-amber-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${
                    alert.severity === 'high' 
                      ? 'bg-rose-500/20 text-rose-400' 
                      : alert.severity === 'opportunity'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {alert.severity === 'high' ? <AlertTriangle className="w-4 h-4" /> : 
                     alert.severity === 'opportunity' ? <Sparkles className="w-4 h-4" /> : 
                     <AlertCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-white truncate">{alert.title}</h4>
                      {alert.ticker && onOpenAssetRaioX && (
                        <button
                          onClick={() => onOpenAssetRaioX(alert.ticker!)}
                          className="text-[10px] text-sky-400 hover:text-sky-300 font-bold underline shrink-0"
                        >
                          Ver {alert.ticker}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {alert.message}
                    </p>
                    <div className="mt-2 text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <span className="font-semibold text-slate-200">Recomendação: </span>
                      {alert.actionRecommendation}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Visual Distribution & Concentration Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Macro Distribution Donut Chart */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <PieIcon className="w-4 h-4 text-sky-400" />
              Alocação Macro: Ações vs. FIIs
            </h4>
            <p className="text-xs text-slate-400">Distribuição patrimonial por classe de ativo</p>
          </div>

          <div className="h-56 w-full flex items-center justify-center my-2">
            {macroPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={macroPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {macroPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(val: number) => [`R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500">Sem ativos cadastrados</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-sky-500" />
              <div>
                <div className="text-slate-400 text-[11px]">Ações ({diagnosis.stocksCount})</div>
                <div className="font-bold text-white">{diagnosis.stocksPct.toFixed(1)}%</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <div>
                <div className="text-slate-400 text-[11px]">FIIs ({diagnosis.fiisCount})</div>
                <div className="font-bold text-white">{diagnosis.fiisPct.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Tabs (Assets, Sectors, Segments, Issuers) */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  Matriz de Concentração da Carteira
                </h4>
                <p className="text-xs text-slate-400">Acompanhe a exposição por múltiplos eixos</p>
              </div>

              {/* Concentration Switcher */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveConcentrationTab('assets')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    activeConcentrationTab === 'assets' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Por Ativo
                </button>
                <button
                  onClick={() => setActiveConcentrationTab('sectors')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    activeConcentrationTab === 'sectors' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Por Setor
                </button>
                <button
                  onClick={() => setActiveConcentrationTab('segments')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    activeConcentrationTab === 'segments' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Segmentos
                </button>
                <button
                  onClick={() => setActiveConcentrationTab('issuers')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    activeConcentrationTab === 'issuers' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Emissores/Gestoras
                </button>
              </div>
            </div>

            {/* List Table for Selected Concentration */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {activeConcentrationTab === 'assets' && diagnosis.topAssetConcentrations.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-white">{item.name}</span>
                    {item.status === 'danger' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                        Concentrado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-28 bg-slate-800 rounded-full h-2 overflow-hidden hidden sm:block">
                      <div 
                        className={`h-full rounded-full ${item.status === 'danger' ? 'bg-rose-500' : item.status === 'warning' ? 'bg-amber-500' : 'bg-sky-500'}`}
                        style={{ width: `${Math.min(100, item.percentage * 3)}%` }}
                      />
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-white">{item.percentage.toFixed(1)}%</span>
                      <span className="text-slate-500 text-[10px] block">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              ))}

              {activeConcentrationTab === 'sectors' && diagnosis.sectorConcentrations.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all text-xs">
                  <div>
                    <span className="font-bold text-white">{item.name}</span>
                    <span className="text-slate-500 text-[10px] block truncate max-w-xs">{item.tickers.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-bold text-white">{item.percentage.toFixed(1)}%</span>
                      <span className="text-slate-500 text-[10px] block">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              ))}

              {activeConcentrationTab === 'segments' && diagnosis.segmentConcentrations.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all text-xs">
                  <div>
                    <span className="font-bold text-white">{item.name}</span>
                    <span className="text-slate-500 text-[10px] block truncate max-w-xs">{item.tickers.join(', ')}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white">{item.percentage.toFixed(1)}%</span>
                    <span className="text-slate-500 text-[10px] block">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))}

              {activeConcentrationTab === 'issuers' && diagnosis.issuerConcentrations.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all text-xs">
                  <div>
                    <span className="font-bold text-white">{item.name}</span>
                    <span className="text-slate-500 text-[10px] block truncate max-w-xs">{item.tickers.join(', ')}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white">{item.percentage.toFixed(1)}%</span>
                    <span className="text-slate-500 text-[10px] block">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Highlights: Top Performers & High Yielders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top Gainers */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
            <TrendingUp className="w-4 h-4" />
            Maiores Valorizações
          </div>
          <div className="space-y-2">
            {diagnosis.topGainers.length > 0 ? (
              diagnosis.topGainers.map(item => (
                <div key={item.ticker} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-0">
                  <span className="font-bold text-white">{item.ticker}</span>
                  <span className="font-bold text-emerald-400">+{item.gainPct.toFixed(2)}%</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500">Nenhum ativo com valorização positiva</div>
            )}
          </div>
        </div>

        {/* Top Losers / Opportunities */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-3">
            <TrendingDown className="w-4 h-4" />
            Maiores Quedas / Descontos
          </div>
          <div className="space-y-2">
            {diagnosis.topLosers.length > 0 ? (
              diagnosis.topLosers.map(item => (
                <div key={item.ticker} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-0">
                  <span className="font-bold text-white">{item.ticker}</span>
                  <span className="font-bold text-rose-400">{item.gainPct.toFixed(2)}%</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500">Nenhum ativo em queda no momento</div>
            )}
          </div>
        </div>

        {/* Top Yield on Cost */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-3">
            <Coins className="w-4 h-4" />
            Maiores Yield on Cost (YoC)
          </div>
          <div className="space-y-2">
            {diagnosis.topDividendYielders.length > 0 ? (
              diagnosis.topDividendYielders.map(item => (
                <div key={item.ticker} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-0">
                  <span className="font-bold text-white">{item.ticker}</span>
                  <span className="font-bold text-indigo-300">{item.yieldOnCost.toFixed(2)}% YoC</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500">Sem proventos registrados ainda</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
