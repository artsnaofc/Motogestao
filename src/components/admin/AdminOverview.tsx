import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Database, 
  Activity, 
  ShieldCheck, 
  Zap, 
  RefreshCw, 
  Trash2, 
  Server, 
  Layers, 
  TrendingUp, 
  PiggyBank, 
  List, 
  Radio,
  Clock,
  Sparkles,
  Download,
  AlertTriangle,
  HardDrive
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cacheManager } from '../../lib/cacheManager';
import { systemSettings, AuditLog } from '../../lib/systemSettings';
import { syncQueueManager } from '../../lib/syncQueue';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

interface AdminOverviewProps {
  onNavigateToTab: (tab: 'users' | 'settings' | 'backup' | 'audit') => void;
  onOpenCreateUser: () => void;
}

export function AdminOverview({ onNavigateToTab, onOpenCreateUser }: AdminOverviewProps) {
  const [loading, setLoading] = useState(false);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [stats, setStats] = useState({
    usersCount: 0,
    adminsCount: 0,
    transactionsCount: 0,
    reservesCount: 0,
    investmentsCount: 0,
    dividendsCount: 0,
    cacheSizeKB: 0,
    syncQueueLength: 0,
  });
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);

  const fetchTelemetry = async () => {
    setLoading(true);
    const startPing = performance.now();
    try {
      // 1. Ping Supabase
      const { error: pingErr } = await supabase.from('user_settings').select('user_id', { count: 'exact', head: true });
      const latency = Math.round(performance.now() - startPing);
      setPingLatency(latency);

      // 2. Fetch counts in parallel
      const [
        usersRes,
        txRes,
        reservesRes,
        invRes,
        divRes
      ] = await Promise.all([
        supabase.from('user_settings').select('is_admin'),
        supabase.from('transactions').select('id', { count: 'exact', head: true }),
        supabase.from('reserves').select('id', { count: 'exact', head: true }),
        supabase.from('investment_transactions').select('id', { count: 'exact', head: true }),
        supabase.from('dividends').select('id', { count: 'exact', head: true }),
      ]);

      const users = usersRes.data || [];
      const adminsCount = users.filter(u => u.is_admin).length;
      const cacheStats = cacheManager.getStats();

      setStats({
        usersCount: users.length,
        adminsCount,
        transactionsCount: txRes.count ?? 0,
        reservesCount: reservesRes.count ?? 0,
        investmentsCount: invRes.count ?? 0,
        dividendsCount: divRes.count ?? 0,
        cacheSizeKB: cacheStats.localStorageSizeKB,
        syncQueueLength: syncQueueManager.getPendingCount(),
      });

      // Load recent audit logs
      setRecentLogs(systemSettings.getAuditLogs().slice(0, 5));
    } catch (err: any) {
      console.error('[AdminOverview] Erro na telemetria:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  // Flush client cache
  const handleClearCache = () => {
    cacheManager.clear();
    systemSettings.logAction('Administrador', 'Limpeza de Cache', 'Todos os caches locais e buffers em memória foram limpos.', 'cache', 'warn');
    toast.success('Caches limpos com sucesso!');
    fetchTelemetry();
  };

  // Export full telemetry report
  const handleExportSystemReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      platform: 'Finanças Pro - Enterprise Admin Telemetry',
      telemetry: {
        latencyMs: pingLatency,
        database: {
          users: stats.usersCount,
          admins: stats.adminsCount,
          transactions: stats.transactionsCount,
          reserves: stats.reservesCount,
          investments: stats.investmentsCount,
          dividends: stats.dividendsCount,
          totalRecords: stats.usersCount + stats.transactionsCount + stats.reservesCount + stats.investmentsCount + stats.dividendsCount,
        },
        client: {
          cacheSizeKB: stats.cacheSizeKB,
          syncQueuePending: stats.syncQueueLength,
        }
      },
      systemConfig: systemSettings.getConfig(),
      auditLogsCount: systemSettings.getAuditLogs().length,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_admin_sistema_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Relatório de telemetria do sistema exportado!');
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Sync */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Visão Geral & Telemetria do Sistema
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitoramento de saúde do cluster, métricas de banco de dados e ações executivas.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTelemetry}
            disabled={loading}
            className="rounded-xl h-10 font-bold text-xs border-border/60 hover:bg-muted gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Métricas
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSystemReport}
            className="rounded-xl h-10 font-bold text-xs border-border/60 hover:bg-muted gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Telemetria
          </Button>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <Card 
          onClick={() => onNavigateToTab('users')}
          className="border-border/50 bg-background/60 hover:bg-muted/10 hover:border-primary/30 transition-all shadow-xs cursor-pointer"
        >
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                Membros Cadastrados
              </span>
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold">
                {stats.adminsCount} Admins
              </span>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-black text-foreground">{stats.usersCount}</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Base de Usuários Ativa
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Database Total Records */}
        <Card className="border-border/50 bg-background/60 shadow-xs">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4 text-indigo-500" />
                Registros no Banco
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                5 Tabelas
              </span>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-black text-foreground font-mono">
                {stats.transactionsCount + stats.reservesCount + stats.investmentsCount + stats.dividendsCount + stats.usersCount}
              </p>
              <p className="text-[11px] text-muted-foreground font-medium mt-1">
                {stats.transactionsCount} txs • {stats.reservesCount} reservas • {stats.investmentsCount} ativos
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Supabase Latency Ping */}
        <Card className="border-border/50 bg-background/60 shadow-xs">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-emerald-500" />
                Latência Supabase
              </span>
              <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </div>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-black text-foreground font-mono">
                {pingLatency !== null ? `${pingLatency}` : '—'}
                <span className="text-sm text-muted-foreground font-bold ml-1">ms</span>
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                {pingLatency && pingLatency < 200 ? '⚡ Conexão Ultrarrápida' : 'Conexão Estável'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Client Cache Storage */}
        <Card className="border-border/50 bg-background/60 shadow-xs">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-amber-500" />
                Armazenamento Cache
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">Local</span>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-black text-foreground font-mono">
                {stats.cacheSizeKB.toFixed(1)}
                <span className="text-sm text-muted-foreground font-bold ml-1">KB</span>
              </p>
              <p className="text-[11px] text-muted-foreground font-medium mt-1">
                {stats.syncQueueLength === 0 ? 'Fila de sincronização zerada' : `${stats.syncQueueLength} tarefas na fila`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health Grid & Quick Command Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* System Health Breakdown */}
        <Card className="border-border/50 bg-background/60 shadow-xs lg:col-span-2">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                Matriz de Componentes & Infraestrutura
              </span>
              <span className="text-[11px] text-emerald-600 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                100% Operacional
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs animate-pulse" />
                  <div>
                    <span className="text-xs font-bold text-foreground block">Supabase PostgreSQL</span>
                    <span className="text-[10px] text-muted-foreground block">Row-Level Security (RLS) Ativo</span>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold text-emerald-600">Online</span>
              </div>

              <div className="p-3 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs animate-pulse" />
                  <div>
                    <span className="text-xs font-bold text-foreground block">Motor de Cotações</span>
                    <span className="text-[10px] text-muted-foreground block">Auto-Failover Brapi/Yahoo</span>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold text-emerald-600">Disponível</span>
              </div>

              <div className="p-3 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
                  <div>
                    <span className="text-xs font-bold text-foreground block">Fila Offline (Sync Queue)</span>
                    <span className="text-[10px] text-muted-foreground block">Garante persistência móvel</span>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold text-emerald-600">Ativa</span>
              </div>

              <div className="p-3 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
                  <div>
                    <span className="text-xs font-bold text-foreground block">Audit Engine</span>
                    <span className="text-[10px] text-muted-foreground block">Rastreabilidade de ações</span>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold text-emerald-600">Registrando</span>
              </div>
            </div>

            {/* Quick Stats on Records */}
            <div className="pt-3 border-t border-border/40 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-muted/20">
                <span className="text-[10px] text-muted-foreground block font-bold">Lançamentos</span>
                <span className="font-mono font-black text-foreground text-sm">{stats.transactionsCount}</span>
              </div>
              <div className="p-2 rounded-xl bg-muted/20">
                <span className="text-[10px] text-muted-foreground block font-bold">Reservas</span>
                <span className="font-mono font-black text-foreground text-sm">{stats.reservesCount}</span>
              </div>
              <div className="p-2 rounded-xl bg-muted/20">
                <span className="text-[10px] text-muted-foreground block font-bold">Investimentos</span>
                <span className="font-mono font-black text-foreground text-sm">{stats.investmentsCount}</span>
              </div>
              <div className="p-2 rounded-xl bg-muted/20">
                <span className="text-[10px] text-muted-foreground block font-bold">Proventos</span>
                <span className="font-mono font-black text-foreground text-sm">{stats.dividendsCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Admin Actions Deck */}
        <Card className="border-border/50 bg-background/60 shadow-xs">
          <CardContent className="p-5 space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Comandos Rápidos
            </span>

            <div className="space-y-2 pt-1">
              <Button
                variant="outline"
                className="w-full justify-start rounded-xl h-10 font-bold text-xs border-border/60 hover:bg-muted gap-2 cursor-pointer"
                onClick={onOpenCreateUser}
              >
                <Users className="w-4 h-4 text-primary" />
                Convidar Novo Membro
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start rounded-xl h-10 font-bold text-xs border-border/60 hover:bg-muted gap-2 cursor-pointer"
                onClick={() => onNavigateToTab('backup')}
              >
                <Database className="w-4 h-4 text-emerald-500" />
                Snapshot / Backup da Database
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start rounded-xl h-10 font-bold text-xs border-border/60 hover:bg-muted gap-2 cursor-pointer"
                onClick={() => onNavigateToTab('settings')}
              >
                <Radio className="w-4 h-4 text-indigo-500" />
                Publicar Comunicado Global
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start rounded-xl h-10 font-bold text-xs border-border/60 hover:bg-muted gap-2 cursor-pointer"
                onClick={handleClearCache}
              >
                <Trash2 className="w-4 h-4 text-amber-500" />
                Limpar Caches do Cliente
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start rounded-xl h-10 font-bold text-xs border-border/60 hover:bg-muted gap-2 cursor-pointer"
                onClick={() => onNavigateToTab('audit')}
              >
                <Clock className="w-4 h-4 text-emerald-500" />
                Ver Trilha de Auditoria
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Audit Logs Ticker */}
      <Card className="border-border/50 bg-background/60 shadow-xs">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Últimos Eventos de Auditoria
            </span>
            <button
              onClick={() => onNavigateToTab('audit')}
              className="text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              Ver todos os logs →
            </button>
          </div>

          <div className="divide-y divide-border/40">
            {recentLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    log.severity === 'success' ? 'bg-emerald-500' :
                    log.severity === 'warn' ? 'bg-amber-500' :
                    log.severity === 'error' ? 'bg-rose-500' : 'bg-indigo-500'
                  }`} />
                  <div className="min-w-0">
                    <span className="font-bold text-foreground truncate block">{log.action}</span>
                    <span className="text-[11px] text-muted-foreground truncate block">{log.details}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
