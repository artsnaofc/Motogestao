import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  AlertOctagon,
  Layers,
  User,
  Settings,
  HardDrive
} from 'lucide-react';
import { systemSettings, AuditLog } from '../../lib/systemSettings';
import { toast } from 'sonner';

export function AdminAuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>(() => systemSettings.getAuditLogs());
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail) {
        setLogs(e.detail);
      } else {
        setLogs(systemSettings.getAuditLogs());
      }
    };

    window.addEventListener('system-audit-updated', handleUpdate);
    return () => window.removeEventListener('system-audit-updated', handleUpdate);
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesAction = log.action.toLowerCase().includes(term);
        const matchesDetails = log.details.toLowerCase().includes(term);
        const matchesAdmin = log.adminName.toLowerCase().includes(term);
        if (!matchesAction && !matchesDetails && !matchesAdmin) return false;
      }

      if (severityFilter !== 'all' && log.severity !== severityFilter) {
        return false;
      }

      if (categoryFilter !== 'all' && log.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [logs, searchTerm, severityFilter, categoryFilter]);

  const handleClearLogs = () => {
    if (confirm('Deseja realmente limpar todo o histórico de logs de auditoria? Esta ação não pode ser desfeita.')) {
      systemSettings.clearAuditLogs('Administrador');
      toast.success('Logs de auditoria foram limpos.');
    }
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('Nenhum log para exportar');
      return;
    }

    const headers = ['id', 'timestamp', 'admin_name', 'action', 'category', 'severity', 'details'];
    const rows = filteredLogs.map(l => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.adminName}"`,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.category}"`,
      `"${l.severity}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trilha_auditoria_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Logs exportados para CSV!');
  };

  const getSeverityBadge = (severity: AuditLog['severity']) => {
    switch (severity) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/20 uppercase">
            <CheckCircle2 className="w-3 h-3" /> Sucesso
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px] border border-amber-500/20 uppercase">
            <AlertTriangle className="w-3 h-3" /> Alerta
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-[10px] border border-rose-500/20 uppercase">
            <AlertOctagon className="w-3 h-3" /> Erro
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] border border-indigo-500/20 uppercase">
            <Info className="w-3 h-3" /> Info
          </span>
        );
    }
  };

  const getCategoryIcon = (category: AuditLog['category']) => {
    switch (category) {
      case 'user':
        return <User className="w-3.5 h-3.5 text-primary" />;
      case 'settings':
        return <Settings className="w-3.5 h-3.5 text-indigo-500" />;
      case 'cache':
        return <HardDrive className="w-3.5 h-3.5 text-amber-500" />;
      case 'security':
        return <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />;
      case 'system':
      default:
        return <Layers className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Trilha de Auditoria & Segurança
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registro imutável de ações administrativas, alterações em membros, limpezas de cache e configurações.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="rounded-xl h-10 font-bold text-xs border-border/60 hover:bg-muted gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearLogs}
            className="rounded-xl h-10 font-bold text-xs border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5 cursor-pointer shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar Logs
          </Button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar em ações, detalhes ou administrador..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-background border-border/60 text-xs font-medium focus-visible:ring-primary/40"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-background border border-border/60 text-xs font-bold text-foreground focus:outline-none cursor-pointer"
            >
              <option value="all">Todas as Severidades</option>
              <option value="info">Apenas Info</option>
              <option value="success">Apenas Sucesso</option>
              <option value="warn">Apenas Alertas</option>
              <option value="error">Apenas Erros</option>
            </select>

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-background border border-border/60 text-xs font-bold text-foreground focus:outline-none cursor-pointer"
            >
              <option value="all">Todas as Categorias</option>
              <option value="user">Usuários</option>
              <option value="settings">Configurações</option>
              <option value="cache">Cache</option>
              <option value="security">Segurança</option>
              <option value="system">Sistema</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-border/60 bg-background/60 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase text-[10px] font-black">
              <tr>
                <th className="p-3.5">Data / Hora</th>
                <th className="p-3.5">Ação</th>
                <th className="p-3.5">Categoria</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Autor</th>
                <th className="p-3.5">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-medium">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                  </td>

                  <td className="p-3.5 font-bold text-foreground whitespace-nowrap">
                    {log.action}
                  </td>

                  <td className="p-3.5 whitespace-nowrap">
                    <span className="flex items-center gap-1.5 capitalize text-muted-foreground">
                      {getCategoryIcon(log.category)}
                      {log.category}
                    </span>
                  </td>

                  <td className="p-3.5 whitespace-nowrap">
                    {getSeverityBadge(log.severity)}
                  </td>

                  <td className="p-3.5 font-semibold text-foreground whitespace-nowrap">
                    {log.adminName}
                  </td>

                  <td className="p-3.5 text-muted-foreground max-w-md truncate">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-xs font-medium">
            Nenhum registro de auditoria encontrado.
          </div>
        )}
      </div>
    </div>
  );
}
