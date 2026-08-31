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
import { cacheManager } from '../lib/cacheManager';
import { DataContext } from '../contexts/DataContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { syncQueueManager, SyncTask } from '../lib/syncQueue';

interface DebugConsoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DebugConsoleModal({ open, onOpenChange }: DebugConsoleModalProps) {
  const context = React.useContext(DataContext);
  const investmentTransactions = context?.investmentTransactions || [];
  const quotes = context?.quotes || {};
  const settings = context?.settings || null;
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<'all' | 'error' | 'warn' | 'info' | 'log'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'quotes' | 'supabase' | 'auth' | 'app'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'console' | 'quoteTest' | 'system' | 'cache'>('console');
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

  // New Advanced diagnostics
  const [userSession, setUserSession] = useState<any>(null);
  const [localStorageSize, setLocalStorageSize] = useState<number>(0);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [copiedRlsSql, setCopiedRlsSql] = useState(false);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [perfMetrics, setPerfMetrics] = useState<any>(null);

  // Cache management state
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [cacheItems, setCacheItems] = useState<any[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncTask[]>([]);

  useEffect(() => {
    if (!open) return;
    return syncQueueManager.subscribe((q) => {
      setSyncQueue(q);
    });
  }, [open]);

  const loadCacheData = () => {
    try {
      const stats = cacheManager.getStats();
      setCacheStats(stats);

      const items: any[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('financas_pro_')) {
          const raw = localStorage.getItem(k);
          let size = k.length + (raw || '').length;
          let namespace = 'Geral';
          let expiresAt = null;
          let createdAt = Date.now();
          try {
            if (raw) {
              const env = JSON.parse(raw);
              if (env.meta) {
                namespace = env.meta.namespace || 'Geral';
                expiresAt = env.meta.expiresAt;
                createdAt = env.meta.createdAt || Date.now();
              }
            }
          } catch {}
          items.push({
            fullKey: k,
            cleanKey: k.replace('financas_pro_', ''),
            namespace,
            sizeBytes: size * 2, // approximation for UTF-16 characters
            expiresAt,
            createdAt
          });
        }
      }
      setCacheItems(items);
    } catch (e) {
      console.error('Erro ao ler cache no debug modal', e);
    }
  };

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
    loadAdvancedDiagnostics();
  }, [open, activeTab]);

  useEffect(() => {
    if (!open) return;
    if (activeTab === 'cache') {
      loadCacheData();
    }
  }, [open, activeTab]);

  const loadAdvancedDiagnostics = async () => {
    setLoadingDiagnostics(true);
    
    // 1. Session Info
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUserSession(session);
    } catch (e) {
      console.error('Erro ao ler sessão', e);
    }

    // 2. LocalStorage Size
    try {
      let totalChars = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          totalChars += key.length + (localStorage.getItem(key) || '').length;
        }
      }
      setLocalStorageSize(Math.round((totalChars * 2) / 1024)); // Roughly size in KB
    } catch (e) {
      console.error(e);
    }

    // 3. Supabase Table Counts (if authenticated)
    try {
      const counts: Record<string, number> = {};
      const tables = ['transactions', 'reserves', 'reserve_transactions', 'investment_transactions', 'dividends'];
      for (const table of tables) {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        if (!error && count !== null) {
          counts[table] = count;
        } else {
          counts[table] = -1; // Indicator of error / no access
        }
      }
      setTableCounts(counts);
    } catch (e) {
      console.error('Erro ao contar tabelas', e);
    }

    // 4. Performance Timing
    try {
      if (window.performance) {
        // Modern performance API navigation metric
        const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigationEntry) {
          const pageLoad = Math.round(navigationEntry.loadEventEnd);
          const dns = Math.round(navigationEntry.domainLookupEnd - navigationEntry.domainLookupStart);
          const tcp = Math.round(navigationEntry.connectEnd - navigationEntry.connectStart);
          const response = Math.round(navigationEntry.responseEnd - navigationEntry.requestStart);
          const domReady = Math.round(navigationEntry.domComplete - navigationEntry.domInteractive);
          setPerfMetrics({ pageLoad, dns, tcp, response, domReady });
        } else if (window.performance.timing) {
          // Fallback
          const t = window.performance.timing;
          const pageLoad = t.loadEventEnd - t.navigationStart;
          const dns = t.domainLookupEnd - t.domainLookupStart;
          const tcp = t.connectEnd - t.connectStart;
          const response = t.responseEnd - t.requestStart;
          const domReady = t.domComplete - t.domLoading;
          setPerfMetrics({ pageLoad, dns, tcp, response, domReady });
        }
      }
    } catch (e) {
      console.error(e);
    }

    setLoadingDiagnostics(false);
  };

  const handleExportLogs = () => {
    const filtered = getFilteredLogs();
    const text = filtered
      .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message} ${l.args ? l.args.join(' ') : ''}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financas_pro_debug_logs_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Arquivo de logs baixado com sucesso!');
  };

  const handleHardReset = () => {
    if (confirm('Atenção: Isso irá apagar todos os caches locais e sessões guardadas no navegador, forçando um recarregamento completo da aplicação. Deseja continuar?')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

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

          <button
            type="button"
            onClick={() => setActiveTab('cache')}
            className={`px-3.5 sm:px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'cache'
                ? 'bg-slate-950 text-pink-400 border-t-2 border-pink-500 font-black shadow-inner'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Layers className="w-4 h-4 text-pink-400" />
            <span>Gerenciador de Cache</span>
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
                    className="h-8 px-2 text-xs font-bold border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl cursor-pointer"
                    title="Copiar todos os logs filtrados"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="hidden lg:inline ml-1">Copiar</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportLogs}
                    className="h-8 px-2 text-xs font-bold border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl cursor-pointer"
                    title="Baixar arquivo de logs (.txt)"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden lg:inline ml-1">Baixar .TXT</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearLogs}
                    className="h-8 px-2 text-xs font-bold border-slate-800 bg-slate-950 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 rounded-xl cursor-pointer"
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-950 text-xs">
            
            {loadingDiagnostics && (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 text-center animate-pulse font-bold flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Atualizando telemetria e diagnósticos do sistema...
              </div>
            )}

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
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between items-center font-mono">
                    <span>Latência de Consulta:</span>
                    <span className="font-bold text-emerald-400">{supabaseLatency}ms</span>
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
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between items-center font-mono">
                  <span>Brapi Token Configurado:</span>
                  <span className="font-bold text-slate-300">{settings?.brapi_token ? 'Sim (Token Privado)' : 'Público'}</span>
                </div>
              </div>

              {/* System Environment & Performance */}
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-200 flex items-center gap-2 text-sm">
                    <Laptop className="w-4 h-4 text-indigo-400" /> Latência & Performance
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    {navigator.onLine ? 'Online 🌐' : 'Offline ⚠️'}
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[10px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Carga da Página:</span>
                    <span className="text-emerald-400 font-bold">{perfMetrics?.pageLoad ? `${perfMetrics.pageLoad}ms` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Resolução DNS:</span>
                    <span>{perfMetrics?.dns ? `${perfMetrics.dns}ms` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">DOM Prontidão:</span>
                    <span>{perfMetrics?.domReady ? `${perfMetrics.domReady}ms` : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Supabase Database Record Counts */}
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-extrabold text-slate-200 flex items-center gap-2 text-sm">
                    <Layers className="w-4 h-4 text-amber-400" /> Registro de Tabelas
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">Row Counts</span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/60 flex flex-col">
                    <span className="text-slate-500">Transações</span>
                    <span className="text-amber-400 font-bold mt-0.5">
                      {tableCounts['transactions'] !== undefined ? (tableCounts['transactions'] === -1 ? 'Sem Acesso' : tableCounts['transactions']) : '...'}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/60 flex flex-col">
                    <span className="text-slate-500">Investimentos</span>
                    <span className="text-cyan-400 font-bold mt-0.5">
                      {tableCounts['investment_transactions'] !== undefined ? (tableCounts['investment_transactions'] === -1 ? 'Sem Acesso' : tableCounts['investment_transactions']) : '...'}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/60 flex flex-col">
                    <span className="text-slate-500">Dividendos</span>
                    <span className="text-emerald-400 font-bold mt-0.5">
                      {tableCounts['dividends'] !== undefined ? (tableCounts['dividends'] === -1 ? 'Sem Acesso' : tableCounts['dividends']) : '...'}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/60 flex flex-col">
                    <span className="text-slate-500">Reservas</span>
                    <span className="text-indigo-400 font-bold mt-0.5">
                      {tableCounts['reserves'] !== undefined ? (tableCounts['reserves'] === -1 ? 'Sem Acesso' : tableCounts['reserves']) : '...'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Active User Session Info */}
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-extrabold text-slate-200 flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-violet-400" /> Autenticação & Sessão
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">JWT Payload</span>
                </div>
                <div className="space-y-1 text-[10px] font-mono text-slate-300">
                  <div className="truncate">
                    <span className="text-slate-500">Usuário ID:</span>{' '}
                    <span className="text-slate-200" title={userSession?.user?.id || 'Desconectado'}>
                      {userSession?.user?.id || 'Desconectado'}
                    </span>
                  </div>
                  <div className="truncate">
                    <span className="text-slate-500">Email:</span>{' '}
                    <span className="text-violet-400 font-bold">{userSession?.user?.email || 'Nenhum'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Criado em:</span>{' '}
                    <span className="text-slate-200">
                      {userSession?.user?.created_at ? new Date(userSession.user.created_at).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Local Storage Audit */}
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-extrabold text-slate-200 flex items-center gap-2 text-sm">
                    <Layers className="w-4 h-4 text-pink-400" /> Armazenamento Local
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">Web Storage</span>
                </div>
                <div className="space-y-1 text-[10px] font-mono text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tamanho Total Estimado:</span>
                    <span className="font-bold text-pink-400">{localStorageSize} KB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Chaves Gravadas:</span>
                    <span>{localStorage.length} chaves</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sessão Temporária:</span>
                    <span>{sessionStorage.length} chaves</span>
                  </div>
                </div>
              </div>

            </div>

            {/* RLS Policies & Database Permission Diagnostics */}
            <div className="p-4 sm:p-5 rounded-2xl border border-cyan-900/40 bg-cyan-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-cyan-400 flex items-center gap-2 text-sm">
                  <Database className="w-4 h-4 text-cyan-400" /> Correção de Políticas RLS no Supabase
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const rlsSql = `-- Script de Correção de RLS e Permissões para Finanças Pro
GRANT ALL ON TABLE public.investment_transactions TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.dividends TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.valuation_targets TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.reserves TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.reserve_transactions TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.transactions TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.user_settings TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.freight_quotes TO anon, authenticated, service_role, postgres;

ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Investments" ON public.investment_transactions;
DROP POLICY IF EXISTS "Users can manage their investments" ON public.investment_transactions;
DROP POLICY IF EXISTS "Allow All Investments" ON public.investment_transactions;
CREATE POLICY "Acesso Total Investments" ON public.investment_transactions FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.dividends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Dividends" ON public.dividends;
DROP POLICY IF EXISTS "Users can manage their dividends" ON public.dividends;
DROP POLICY IF EXISTS "Allow All Dividends" ON public.dividends;
CREATE POLICY "Acesso Total Dividends" ON public.dividends FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.valuation_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Valuation" ON public.valuation_targets;
CREATE POLICY "Acesso Total Valuation" ON public.valuation_targets FOR ALL TO public USING (true) WITH CHECK (true);`;
                    navigator.clipboard.writeText(rlsSql);
                    setCopiedRlsSql(true);
                    toast.success('SQL de Correção RLS copiado para a Área de Transferência!');
                    setTimeout(() => setCopiedRlsSql(false), 3000);
                  }}
                  className="bg-cyan-950/60 hover:bg-cyan-800 border-cyan-800 text-cyan-200 text-xs h-8 px-3 rounded-lg"
                >
                  {copiedRlsSql ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedRlsSql ? 'SQL Copiado!' : 'Copiar SQL de RLS'}
                </Button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Se os lançamentos de investimentos ou dividendos ficarem salvos apenas localmente com aviso de <code className="text-amber-300 font-mono">Sem Acesso</code> ou erro <code className="text-amber-300 font-mono">42501</code> (RLS violation), execute este script no <strong className="text-slate-200">Supabase SQL Editor</strong> para liberar as permissões de gravação.
              </p>
            </div>

            {/* Cache Controls & Repair Panel */}
            <div className="p-4 sm:p-5 rounded-2xl border border-rose-900/30 bg-rose-950/10 space-y-3">
              <h4 className="font-extrabold text-rose-400 flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4" /> Ações de Reparo e Limpeza de Cache
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-3xl">
                Se o sistema estiver travado no carregamento de módulos, corrompido devido a discrepâncias de dados locais ou com falhas de sincronização, execute as ações abaixo para redefinir as tabelas e forçar um novo download limpo do Supabase.
              </p>
              <div className="flex flex-wrap gap-2.5 pt-1.5">
                <Button
                  onClick={handleHardReset}
                  variant="outline"
                  className="bg-rose-950/20 hover:bg-rose-600 border-rose-800/80 text-rose-400 hover:text-white font-extrabold text-xs h-9 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" /> Forçar Limpeza Completa (Hard Reset)
                </Button>
                <Button
                  onClick={() => {
                    checkSupabaseStatus();
                    loadAdvancedDiagnostics();
                    toast.success('Diagnósticos e status de infraestrutura recarregados!');
                  }}
                  variant="outline"
                  className="bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200 font-extrabold text-xs h-9 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 mr-1.5" /> Atualizar Diagnósticos
                </Button>
              </div>
            </div>

            {/* System Diagnostic Payload Box */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/90 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-slate-400" /> Informações de Runtime & User Agent
                </h4>
                <span className="font-mono text-[9px] text-slate-500">Viewport: {window.innerWidth}x{window.innerHeight}px</span>
              </div>
              <div className="font-mono text-[10px] text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 break-all leading-relaxed">
                {navigator.userAgent}
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: CACHE & MEMORY MANAGEMENT */}
        {activeTab === 'cache' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col bg-slate-950 gap-6 min-h-0">
            {/* Cache Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Cache Hits</span>
                  <span className="text-2xl font-mono font-black text-emerald-400 block mt-1">{cacheStats?.hits ?? 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Cache Misses</span>
                  <span className="text-2xl font-mono font-black text-rose-400 block mt-1">{cacheStats?.misses ?? 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/10">
                  <XCircle className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Tamanho em Disco</span>
                  <span className="text-2xl font-mono font-black text-pink-400 block mt-1">{cacheStats?.localStorageSizeKB ?? 0} KB</span>
                </div>
                <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/10">
                  <Layers className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Evicções</span>
                  <span className="text-2xl font-mono font-black text-amber-400 block mt-1">{cacheStats?.evictions ?? 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/10">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Cache Actions */}
            <div className="bg-slate-900/95 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
              <div>
                <h4 className="text-xs font-black uppercase text-white tracking-wider">Ações de Cache Globais</h4>
                <p className="text-[11px] text-slate-400 mt-1">Limpe todos os itens do cache unificado ou atualize para recalcular as métricas.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    cacheManager.clear();
                    loadCacheData();
                    toast.success('Todos os caches de financas_pro_ foram limpos!');
                  }}
                  variant="destructive"
                  className="rounded-xl font-bold text-xs h-9 cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar Todo o Cache
                </Button>
                <Button
                  onClick={loadCacheData}
                  variant="outline"
                  className="bg-slate-850 border-slate-750 hover:bg-slate-800 text-white rounded-xl font-bold text-xs h-9 cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                </Button>
              </div>
            </div>

            {/* Background Sync Queue */}
            <div className="space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-300 tracking-wider">Fila de Sincronização em Segundo Plano ({syncQueue.length})</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Lançamentos criados ou alterados offline são salvos localmente e enviados quando houver conexão.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      syncQueueManager.processQueue();
                      toast.success('Forçando re-processamento da fila de sincronização...');
                    }}
                    variant="outline"
                    className="bg-slate-850 hover:bg-slate-800 text-white rounded-xl font-bold text-[10px] h-7 px-2.5 cursor-pointer flex items-center gap-1 shrink-0 border-slate-750"
                    disabled={syncQueue.length === 0}
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Forçar Sincronização
                  </Button>
                  <Button
                    onClick={() => {
                      syncQueueManager.clearQueue();
                      toast.success('Fila de sincronização descartada com sucesso!');
                    }}
                    variant="destructive"
                    className="rounded-xl font-bold text-[10px] h-7 px-2.5 cursor-pointer flex items-center gap-1 shrink-0"
                    disabled={syncQueue.length === 0}
                  >
                    <Trash2 className="w-2.5 h-2.5" /> Descartar Fila
                  </Button>
                </div>
              </div>
              
              <div className="border border-slate-800 bg-slate-900/50 rounded-2xl overflow-hidden max-h-[180px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-900 sticky top-0 z-10">
                      <th className="p-2.5">ID</th>
                      <th className="p-2.5">Tabela</th>
                      <th className="p-2.5">Ação</th>
                      <th className="p-2.5">Registro Alvo</th>
                      <th className="p-2.5">Tentativas</th>
                      <th className="p-2.5">Hora de Entrada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {syncQueue.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-500 font-sans text-xs">
                          Tudo sincronizado! Nenhuma alteração pendente de envio na fila.
                        </td>
                      </tr>
                    ) : (
                      syncQueue.map((task) => (
                        <tr key={task.id} className="hover:bg-slate-900/40 text-slate-300">
                          <td className="p-2.5 font-bold text-indigo-400">{task.id}</td>
                          <td className="p-2.5 text-slate-300">{task.table}</td>
                          <td className="p-2.5">
                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold ${
                              task.action === 'insert' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' :
                              task.action === 'update' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15' :
                              'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                            }`}>
                              {task.action.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-400 truncate max-w-[120px]" title={task.targetId}>{task.targetId}</td>
                          <td className="p-2.5">
                            <span className={task.attempts > 0 ? 'text-amber-500 font-bold' : 'text-slate-500'}>
                              {task.attempts}/5
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-400">{new Date(task.createdAt).toLocaleTimeString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cache Entries List */}
            <div className="space-y-3 min-h-0 flex-1 flex flex-col">
              <h4 className="text-xs font-black uppercase text-slate-300 tracking-wider shrink-0">Entradas Ativas ({cacheItems.length})</h4>
              <div className="border border-slate-800 bg-slate-900/50 rounded-2xl overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="overflow-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-900 z-10">
                      <tr className="border-b border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="p-3">Namespace</th>
                        <th className="p-3">Chave</th>
                        <th className="p-3">Tamanho</th>
                        <th className="p-3">Criado em</th>
                        <th className="p-3">Expira em</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                      {cacheItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500 font-sans text-xs">
                            Nenhum item ativo no cache unificado do sistema.
                          </td>
                        </tr>
                      ) : (
                        cacheItems.map((item) => (
                          <tr key={item.fullKey} className="hover:bg-slate-900/40 text-slate-300">
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] border border-indigo-500/15">
                                {item.namespace}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-white max-w-[200px] truncate" title={item.cleanKey}>
                              {item.cleanKey}
                            </td>
                            <td className="p-3 text-slate-400">
                              {(item.sizeBytes / 1024).toFixed(2)} KB
                            </td>
                            <td className="p-3 text-slate-400">
                              {new Date(item.createdAt).toLocaleTimeString()}
                            </td>
                            <td className="p-3">
                              {item.expiresAt ? (
                                <span className="text-amber-400">
                                  {new Date(item.expiresAt).toLocaleTimeString()}
                                </span>
                              ) : (
                                <span className="text-slate-500">Nunca</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => {
                                  cacheManager.remove(item.cleanKey);
                                  loadCacheData();
                                  toast.success(`Entrada '${item.cleanKey}' removida com sucesso.`);
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Remover este item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
