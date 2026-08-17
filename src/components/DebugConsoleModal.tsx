import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Terminal,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Bug,
  AlertTriangle,
  Info,
  XCircle,
  Database,
  Search,
  Activity,
  Layers,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  Laptop,
  Maximize2,
  Minimize2,
  TrendingUp,
  Cpu,
  ArrowRight,
  Filter
} from 'lucide-react';
import { LogEntry, getDebugLogs, clearDebugLogs, subscribeDebugLogs } from '../lib/debugLogger';
import { executeQuoteFetch, QuoteProvider, QuoteFetchResult } from '../lib/quoteService';
import { useData } from '../contexts/DataContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface DebugConsoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DebugConsoleModal({ open, onOpenChange }: DebugConsoleModalProps) {
  const { investmentTransactions, quotes, settings } = useData();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<'all' | 'error' | 'warn' | 'info' | 'log'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'quotes' | 'supabase' | 'auth' | 'app'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'console' | 'quoteTest' | 'system'>('console');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Quote testing states
  const [testTickers, setTestTickers] = useState('PETR4, VALE3, ITUB4, MXRF11, HGLG11');
  const [testProvider, setTestProvider] = useState<QuoteProvider>('auto');
  const [testToken, setTestToken] = useState('');
  const [testingQuotes, setTestingQuotes] = useState(false);
  const [testResult, setTestResult] = useState<QuoteFetchResult | null>(null);

  // System diagnostic state
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [supabaseLatency, setSupabaseLatency] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLogs(getDebugLogs());
    const unsubscribe = subscribeDebugLogs((updatedLogs) => {
      setLogs([...updatedLogs]);
    });
    return () => unsubscribe();
  }, [open]);

  useEffect(() => {
    if (!open || activeTab !== 'system') return;
    checkSupabaseStatus();
  }, [open, activeTab]);

  const checkSupabaseStatus = async () => {
    setSupabaseStatus('checking');
    const start = performance.now();
    try {
      const { error } = await supabase.from('user_settings').select('user_id').limit(1);
      const latency = Math.round(performance.now() - start);
      setSupabaseLatency(latency);
      if (error && error.code !== 'PGRST116') {
        setSupabaseStatus('error');
      } else {
        setSupabaseStatus('connected');
      }
    } catch {
      setSupabaseStatus('error');
      setSupabaseLatency(null);
    }
  };

  const handleClearLogs = () => {
    clearDebugLogs();
    setLogs([]);
    toast.success('Console limpo com sucesso.');
  };

  const handleCopyLogs = () => {
    const filtered = getFilteredLogs();
    const text = filtered
      .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message} ${l.args ? l.args.join(' ') : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Logs copiados para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTriggerTestError = () => {
    console.error('🧪 Erro de Teste Manual:', new Error('Simulação acionada pelo Painel de Debug'));
    toast.error('Erro de teste registrado no console!');
  };

  const handleRunQuoteTest = async (overrideTickers?: string, overrideProvider?: QuoteProvider) => {
    setTestingQuotes(true);
    setTestResult(null);

    const targetTickers = overrideTickers || testTickers;
    const targetProvider = overrideProvider || testProvider;

    const tickerList = targetTickers.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    console.log(`[Debug Quote Test] Testando cotação para ${tickerList.join(', ')} usando provedor "${targetProvider}"`);

    try {
      const result = await executeQuoteFetch(tickerList, {
        provider: targetProvider,
        brapiToken: testToken || settings?.brapi_token,
        timeoutMs: 8000,
      });
      setTestResult(result);
      if (result.successCount > 0) {
        toast.success(`${result.successCount} cotações testadas com sucesso em ${result.durationMs}ms!`);
      } else {
        toast.error('Nenhuma cotação retornada no teste.');
      }
    } catch (err: any) {
      console.error('[Debug Quote Test Error]', err);
      toast.error(`Falha no teste: ${err?.message || err}`);
    } finally {
      setTestingQuotes(false);
    }
  };

  const setTickerPreset = (preset: string) => {
    setTestTickers(preset);
  };

  const getFilteredLogs = () => {
    return logs.filter(l => {
      const matchesLevel = filterLevel === 'all' || l.level === filterLevel;
      
      let matchesCategory = true;
      const lowerMsg = (l.message + ' ' + (l.args?.join(' ') || '')).toLowerCase();
      if (filterCategory === 'quotes') {
        matchesCategory = lowerMsg.includes('quote') || lowerMsg.includes('cota') || lowerMsg.includes('brapi') || lowerMsg.includes('yahoo');
      } else if (filterCategory === 'supabase') {
        matchesCategory = lowerMsg.includes('supabase') || lowerMsg.includes('pgrst') || lowerMsg.includes('postgres');
      } else if (filterCategory === 'auth') {
        matchesCategory = lowerMsg.includes('auth') || lowerMsg.includes('session') || lowerMsg.includes('login') || lowerMsg.includes('jwt');
      }

      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || 
        l.message.toLowerCase().includes(term) ||
        (l.args && l.args.some(a => a.toLowerCase().includes(term)));

      return matchesLevel && matchesCategory && matchesSearch;
    });
  };

  const filteredLogs = getFilteredLogs();
  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl lg:max-w-6xl w-[96vw] h-[90vh] max-h-[880px] p-0 gap-0 rounded-3xl overflow-hidden bg-slate-950 text-slate-100 border border-slate-800 shadow-2xl flex flex-col z-50">
        
        {/* MODAL HEADER */}
        <DialogHeader className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Bug className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2 truncate">
                Central de Debug & Diagnóstico do Sistema
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 truncate">
                Logs em tempo real, telemetria, teste de cotações de ativos e conexão de banco
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 text-[10px] font-bold text-slate-300 border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Telemetry
            </span>
          </div>
        </DialogHeader>

        {/* TABS SELECTOR */}
        <div className="flex items-center border-b border-slate-800 bg-slate-900/60 px-3 sm:px-5 pt-2 gap-1.5 sm:gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('console')}
            className={`px-3.5 sm:px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'console'
                ? 'bg-slate-950 text-indigo-400 border-t-2 border-indigo-500 font-black shadow-inner'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Console em Tempo Real</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
              {logs.length}
            </span>
            {errorCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-black border border-rose-500/30 animate-pulse">
                {errorCount} {errorCount === 1 ? 'erro' : 'erros'}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quoteTest')}
            className={`px-3.5 sm:px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'quoteTest'
                ? 'bg-slate-950 text-cyan-400 border-t-2 border-cyan-500 font-black shadow-inner'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Testador de Cotações B3</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`px-3.5 sm:px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'system'
                ? 'bg-slate-950 text-emerald-400 border-t-2 border-emerald-500 font-black shadow-inner'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Status & Infraestrutura</span>
          </button>
        </div>

        {/* TAB 1: CONSOLE LOGS */}
        {activeTab === 'console' && (
          <div className="flex-1 overflow-hidden p-3 sm:p-5 flex flex-col bg-slate-950 gap-3 min-h-0">
            
            {/* TOOLBAR & CONTROLS (DESKTOP / TABLET GRID) */}
            <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
              
              {/* Level Buttons & Category Filters */}
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setFilterLevel('all')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                      filterLevel === 'all'
                        ? 'bg-slate-800 text-white shadow-2xs font-extrabold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todos ({logs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLevel('error')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      filterLevel === 'error'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 font-extrabold'
                        : 'text-slate-400 hover:text-rose-400'
                    }`}
                  >
                    <XCircle className="w-3 h-3" /> Erros ({errorCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLevel('warn')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      filterLevel === 'warn'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 font-extrabold'
                        : 'text-slate-400 hover:text-amber-400'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" /> Avisos ({warnCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLevel('log')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                      filterLevel === 'log'
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-extrabold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Logs
                  </button>
                </div>

                {/* Categories */}
                <div className="hidden sm:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setFilterCategory('all')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      filterCategory === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Geral
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterCategory('quotes')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      filterCategory === 'quotes' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-cyan-400'
                    }`}
                  >
                    Cotações
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterCategory('supabase')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      filterCategory === 'supabase' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-400'
                    }`}
                  >
                    Supabase
                  </button>
                </div>
              </div>

              {/* Search & Actions Bar */}
              <div className="flex items-center gap-2 flex-1 md:max-w-md justify-end">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <Input
                    placeholder="Filtrar mensagens ou erros..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 pl-8 pr-3 text-xs bg-slate-950 border-slate-800 text-slate-200 rounded-xl focus:border-indigo-500 w-full"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyLogs}
                    className="h-8 px-2.5 text-xs font-bold border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl cursor-pointer"
                    title="Copiar todos os logs filtrados"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="hidden lg:inline ml-1">Copiar</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearLogs}
                    className="h-8 px-2.5 text-xs font-bold border-slate-800 bg-slate-950 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 rounded-xl cursor-pointer"
                    title="Limpar todos os logs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline ml-1">Limpar</span>
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleTriggerTestError}
                    className="h-8 px-2.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl cursor-pointer shadow-xs"
                  >
                    Simular Erro
                  </Button>
                </div>

              </div>

            </div>

            {/* LOGS LIST VIEWER WITH PERFECT WRAP & LAYOUT */}
            <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/90 p-3 sm:p-4 font-mono text-[11px] space-y-2 select-text min-h-0">
              {filteredLogs.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-slate-500 py-12 space-y-2.5 text-center">
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <Terminal className="w-8 h-8 text-slate-400 stroke-1" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-300">Nenhum registro encontrado</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Nenhum log corresponde aos filtros aplicados.</p>
                  </div>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const isError = log.level === 'error';
                  const isWarn = log.level === 'warn';
                  const isInfo = log.level === 'info';

                  return (
                    <div
                      key={log.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isError
                          ? 'bg-rose-950/20 border-rose-900/50 text-rose-200'
                          : isWarn
                          ? 'bg-amber-950/20 border-amber-900/50 text-amber-200'
                          : isInfo
                          ? 'bg-indigo-950/20 border-indigo-900/50 text-indigo-200'
                          : 'bg-slate-900/70 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      {/* Meta header */}
                      <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                            isError
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : isWarn
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : isInfo
                              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {log.level}
                          </span>

                          <span className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {log.timestamp}
                          </span>
                        </div>
                      </div>

                      {/* Message Content */}
                      <div className="pt-2 font-semibold whitespace-pre-wrap break-words leading-relaxed">
                        {log.message}
                      </div>

                      {/* Args / Stack trace */}
                      {log.args && log.args.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-800/70 text-[10.5px] text-slate-400 whitespace-pre-wrap break-all bg-slate-950/60 p-2.5 rounded-lg font-mono">
                          {log.args.join('\n')}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* TAB 2: QUOTE TESTING (DESKTOP & TABLET ADAPTIVE) */}
        {activeTab === 'quoteTest' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-950">
            
            {/* CONFIG CARD */}
            <div className="bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-400" /> Diagnóstico e Benchmark de Cotações B3
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Teste a taxa de sucesso, tempo de latência e payload de resposta de cada API do mercado.
                  </p>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Presets:</span>
                  <button
                    type="button"
                    onClick={() => setTickerPreset('PETR4, VALE3, ITUB4, BBDC4, BBAS3')}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[10px] font-bold cursor-pointer"
                  >
                    Blue Chips
                  </button>
                  <button
                    type="button"
                    onClick={() => setTickerPreset('MXRF11, HGLG11, KNCR11, XPML11, VISC11')}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[10px] font-bold cursor-pointer"
                  >
                    FIIs Top
                  </button>
                  <button
                    type="button"
                    onClick={() => setTickerPreset('MGLU3, VIIA3, COGN3, CASH3, LWSA3')}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[10px] font-bold cursor-pointer"
                  >
                    Small Caps
                  </button>
                </div>
              </div>

              {/* INPUTS GRID (TABLET & DESKTOP FRIENDLY) */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                
                {/* Tickers */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Ativos para Teste (separados por vírgula)
                  </label>
                  <Input
                    value={testTickers}
                    onChange={(e) => setTestTickers(e.target.value)}
                    placeholder="PETR4, VALE3, ITUB4, MXRF11"
                    className="h-11 text-xs bg-slate-950 border-slate-800 text-white rounded-xl font-mono uppercase"
                  />
                </div>

                {/* Provider Select */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Provedor de Cotação
                  </label>
                  <select
                    value={testProvider}
                    onChange={(e) => setTestProvider(e.target.value as QuoteProvider)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl h-11 px-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="auto">⚡ Multi-Fonte Automático</option>
                    <option value="brapi">Brapi API (Lote Nativo)</option>
                    <option value="yahoo">Yahoo Finance (Proxy)</option>
                    <option value="hgbrasil">HG Brasil Finance</option>
                    <option value="mfinance">mFinance API</option>
                  </select>
                </div>

                {/* Action button */}
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={() => handleRunQuoteTest()}
                    disabled={testingQuotes}
                    className="w-full h-11 px-4 text-xs font-extrabold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-md"
                  >
                    {testingQuotes ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {testingQuotes ? 'Testando...' : 'Executar Teste'}
                  </Button>
                </div>

              </div>

            </div>

            {/* TEST RESULTS DISPLAY */}
            {testResult && (
              <div className="bg-slate-900/80 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-black text-white">Provedor Utilizado:</span>
                    <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-black">
                      {testResult.providerUsed}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="text-slate-400">Tempo Total:</span>
                    <span className="text-emerald-400 font-mono text-sm">{testResult.durationMs}ms</span>
                  </div>
                </div>

                {/* STATS TILES (GRID FOR TABLET/DESKTOP) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Sucessos</span>
                    <span className="text-lg font-black text-emerald-400">{testResult.successCount}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Falhas</span>
                    <span className="text-lg font-black text-rose-400">{testResult.failedCount}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Média / Ativo</span>
                    <span className="text-lg font-black text-indigo-400 font-mono">
                      {testResult.details.length > 0 ? Math.round(testResult.durationMs / testResult.details.length) : 0}ms
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Taxa de Sucesso</span>
                    <span className="text-lg font-black text-cyan-400 font-mono">
                      {testResult.details.length > 0 ? Math.round((testResult.successCount / testResult.details.length) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* DETAILS TABLE (CLEAN OVERFLOW HANDLING) */}
                <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden font-mono text-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[480px]">
                      <thead className="bg-slate-900 text-[10px] text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="p-3 font-extrabold">Ativo</th>
                          <th className="p-3 font-extrabold">Fonte Real</th>
                          <th className="p-3 font-extrabold text-right">Cotação Retornada</th>
                          <th className="p-3 font-extrabold text-right">Resultado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {testResult.details.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                            <td className="p-3 font-bold text-white flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-indigo-500" />
                              {item.ticker}
                            </td>
                            <td className="p-3 text-slate-400 text-[11px]">{item.provider}</td>
                            <td className="p-3 text-right font-black text-emerald-400 font-mono">
                              {item.price > 0 ? `R$ ${item.price.toFixed(2)}` : '—'}
                            </td>
                            <td className="p-3 text-right">
                              {item.price > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black border border-emerald-500/30">
                                  SUCESSO
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-black border border-rose-500/30" title={item.error}>
                                  FALHOU
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* TAB 3: SYSTEM STATUS & INFRASTRUCTURE */}
        {activeTab === 'system' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-950 text-xs">
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Supabase Status Card */}
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-200 flex items-center gap-2 text-sm">
                    <Database className="w-4 h-4 text-emerald-400" /> Supabase Database
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                    supabaseStatus === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : supabaseStatus === 'error'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {supabaseStatus === 'connected' ? 'Conectado' : supabaseStatus === 'error' ? 'Erro de Conexão' : 'Verificando...'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Conexão ativa para persistência em nuvem de transações, reservas e configurações.
                </p>
                {supabaseLatency !== null && (
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between items-center">
                    <span>Latência de Consulta:</span>
                    <span className="font-mono font-bold text-emerald-400">{supabaseLatency}ms</span>
                  </div>
                )}
              </div>

              {/* Cached Quotes Card */}
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-200 flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-cyan-400" /> Cotações em Cache
                  </span>
                  <span className="text-sm font-black text-cyan-400 font-mono">
                    {Object.keys(quotes || {}).length} ativos
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Provedor Padrão Configurado: <strong className="text-white">{settings?.quote_provider || 'auto (Multi-Fonte)'}</strong>
                </p>
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between items-center">
                  <span>Brapi Token Configurado:</span>
                  <span className="font-mono font-bold text-slate-300">{settings?.brapi_token ? 'Sim (Token Privado)' : 'Público'}</span>
                </div>
              </div>

              {/* System Environment */}
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-3 md:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-200 flex items-center gap-2 text-sm">
                    <Laptop className="w-4 h-4 text-indigo-400" /> Dispositivo & Rede
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    {navigator.onLine ? 'Online 🌐' : 'Offline ⚠️'}
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[10.5px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Resolução Viewport:</span>
                    <span>{window.innerWidth} × {window.innerHeight}px</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lançamentos Investimento:</span>
                    <span>{investmentTransactions.length}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* System Diagnostic Payload Box */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-slate-400" /> Informações de Runtime & User Agent
                </h4>
              </div>
              <div className="font-mono text-[10.5px] text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 break-all leading-relaxed">
                {navigator.userAgent}
              </div>
            </div>

          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
