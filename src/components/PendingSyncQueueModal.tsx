import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Database,
  WifiOff,
  RefreshCw,
  PlusCircle,
  Edit3,
  Trash2,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  DollarSign,
  PiggyBank,
  TrendingUp,
  Settings,
  Layers,
  Search,
  Check,
  Copy,
} from 'lucide-react';
import { syncQueueManager, SyncTask } from '../lib/syncQueue';
import { formatCurrency } from '../lib/utils';
import { toast } from 'sonner';

interface PendingSyncQueueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PendingSyncQueueModal({ open, onOpenChange }: PendingSyncQueueModalProps) {
  const [queue, setQueue] = useState<SyncTask[]>([]);
  const [filterTable, setFilterTable] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Subscribe to sync queue in real-time
  useEffect(() => {
    const unsubscribe = syncQueueManager.subscribe((newQueue) => {
      setQueue([...newQueue]);
    });
    return () => unsubscribe();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Payload copiado para a área de transferência!');
  };

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      toast.error('Você ainda está desconectado da internet. A sincronização ocorrerá automaticamente assim que a conexão voltar.');
      return;
    }

    if (queue.length === 0) {
      toast.info('Não há movimentações pendentes para sincronizar.');
      return;
    }

    setIsSyncing(true);
    toast.loading('Iniciando sincronização com a nuvem...', { id: 'manual-sync' });
    try {
      await syncQueueManager.flushQueue(6000);
      toast.success('Sincronização concluída!', { id: 'manual-sync' });
    } catch (err) {
      toast.error('Falha ao sincronizar algumas movimentações. Tentando novamente em segundo plano.', { id: 'manual-sync' });
    } finally {
      setIsSyncing(false);
    }
  };

  const getTableMeta = (table: string) => {
    switch (table) {
      case 'transactions':
        return {
          label: 'Transação / Lançamento',
          category: 'transactions',
          icon: DollarSign,
          color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        };
      case 'reserves':
        return {
          label: 'Reserva Financeira',
          category: 'reserves',
          icon: PiggyBank,
          color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        };
      case 'reserve_transactions':
        return {
          label: 'Movimentação de Reserva',
          category: 'reserves',
          icon: PiggyBank,
          color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
        };
      case 'investment_transactions':
        return {
          label: 'Investimento (Aporte/Venda)',
          category: 'investments',
          icon: TrendingUp,
          color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        };
      case 'dividends':
        return {
          label: 'Provento / Dividendo',
          category: 'investments',
          icon: TrendingUp,
          color: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
        };
      case 'user_settings':
      case 'settings':
        return {
          label: 'Configurações do Usuário',
          category: 'settings',
          icon: Settings,
          color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        };
      default:
        return {
          label: table,
          category: 'other',
          icon: Database,
          color: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
        };
    }
  };

  const getActionBadge = (action: SyncTask['action']) => {
    switch (action) {
      case 'insert':
        return {
          label: 'Novo Registro',
          icon: PlusCircle,
          badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
        };
      case 'update':
        return {
          label: 'Atualização',
          icon: Edit3,
          badgeClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25',
        };
      case 'delete':
        return {
          label: 'Exclusão',
          icon: Trash2,
          badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25',
        };
    }
  };

  const formatTaskDetails = (task: SyncTask) => {
    const p = task.payload || {};

    if (task.action === 'delete') {
      return {
        title: `Exclusão de item na tabela ${task.table}`,
        subtitle: `Registro ID: ${task.targetId}`,
        amount: null,
      };
    }

    if (task.table === 'transactions') {
      const isExpense = p.type === 'expense';
      const isIncome = p.type === 'income';
      const amountStr = typeof p.amount === 'number' ? formatCurrency(p.amount) : null;
      return {
        title: p.description || 'Lançamento financeiro',
        subtitle: [
          p.date ? `Data: ${p.date}` : null,
          p.category ? `Categoria: ${p.category}` : null,
          p.installment_current ? `Parcela ${p.installment_current}/${p.installment_total || 1}` : null,
        ].filter(Boolean).join(' • '),
        amount: amountStr,
        amountPrefix: isIncome ? '+' : isExpense ? '-' : '',
        amountColor: isIncome ? 'text-emerald-500' : isExpense ? 'text-rose-500' : 'text-slate-200',
      };
    }

    if (task.table === 'reserve_transactions') {
      const isWithdrawal = p.type === 'withdrawal';
      const amountStr = typeof p.amount === 'number' ? formatCurrency(p.amount) : null;
      return {
        title: p.description || 'Movimentação em reserva',
        subtitle: p.date ? `Data: ${p.date}` : 'Reserva financeira',
        amount: amountStr,
        amountPrefix: isWithdrawal ? '-' : '+',
        amountColor: isWithdrawal ? 'text-rose-500' : 'text-emerald-500',
      };
    }

    if (task.table === 'reserves') {
      return {
        title: p.name || 'Nova Reserva Financeira',
        subtitle: p.target_amount ? `Meta: ${formatCurrency(p.target_amount)}` : 'Reserva de valor',
        amount: typeof p.current_amount === 'number' ? formatCurrency(p.current_amount) : null,
        amountColor: 'text-amber-500',
      };
    }

    if (task.table === 'investment_transactions') {
      const op = p.type || p.operation || 'Operação';
      const isBuy = String(op).toLowerCase().includes('buy') || String(op).toLowerCase().includes('compra');
      const val = p.total_amount || (p.quantity && p.price ? p.quantity * p.price : p.amount);
      return {
        title: `${p.ticker || 'Ativo'} (${op})`,
        subtitle: [
          p.quantity ? `${p.quantity} cotas` : null,
          p.price ? `Preço un: ${formatCurrency(p.price)}` : null,
          p.date ? `Data: ${p.date}` : null,
        ].filter(Boolean).join(' • '),
        amount: typeof val === 'number' ? formatCurrency(val) : null,
        amountColor: isBuy ? 'text-blue-500' : 'text-teal-500',
      };
    }

    if (task.table === 'dividends') {
      const amountStr = typeof p.net_amount === 'number' ? formatCurrency(p.net_amount) : (typeof p.amount === 'number' ? formatCurrency(p.amount) : null);
      return {
        title: `${p.ticker || 'Ativo'} - ${p.type || 'Provento'}`,
        subtitle: p.payment_date ? `Pagamento: ${p.payment_date}` : 'Rendimento / Dividendo',
        amount: amountStr,
        amountPrefix: '+',
        amountColor: 'text-emerald-500',
      };
    }

    if (task.table === 'user_settings' || task.table === 'settings') {
      const fields = Object.keys(p).filter(k => k !== 'user_id');
      return {
        title: 'Preferências e Metas',
        subtitle: `Campos modificados: ${fields.join(', ') || 'Configurações'}`,
        amount: null,
      };
    }

    return {
      title: `Operação em ${task.table}`,
      subtitle: `Registro ID: ${task.targetId}`,
      amount: null,
    };
  };

  const filteredQueue = useMemo(() => {
    return queue.filter((task) => {
      const meta = getTableMeta(task.table);
      if (filterTable !== 'all' && meta.category !== filterTable && task.table !== filterTable) {
        return false;
      }
      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      const details = formatTaskDetails(task);
      return (
        task.table.toLowerCase().includes(term) ||
        task.targetId.toLowerCase().includes(term) ||
        details.title.toLowerCase().includes(term) ||
        details.subtitle.toLowerCase().includes(term)
      );
    });
  }, [queue, filterTable, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[96vw] sm:max-w-2xl p-0 overflow-hidden rounded-3xl border-border bg-card max-h-[88vh] flex flex-col shadow-2xl"
        aria-describedby="pending-sync-description"
      >
        {/* Header */}
        <DialogHeader className="px-5 py-4 sm:px-6 sm:py-5 bg-muted/40 border-b border-border flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/25">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  Movimentações Pendentes da Database
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    {queue.length}
                  </span>
                </DialogTitle>
                <DialogDescription id="pending-sync-description" className="text-xs text-muted-foreground mt-0.5">
                  Alterações salvas localmente no navegador aguardando conexão com a internet.
                </DialogDescription>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <WifiOff className="w-3.5 h-3.5" />
                Modo Offline
              </span>
            </div>
          </div>

          {/* Quick status bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs border-t border-border/50 text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>
                {queue.length === 0
                  ? 'Nenhuma alteração pendente de envio'
                  : `${queue.length} ${queue.length === 1 ? 'operação acumulada' : 'operações acumuladas'} para envio`}
              </span>
            </div>
            <div className="text-[11px]">
              Os dados locais estão 100% seguros e persistidos no dispositivo.
            </div>
          </div>
        </DialogHeader>

        {/* Filter and Search */}
        {queue.length > 0 && (
          <div className="px-5 py-3 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row gap-2 sm:items-center justify-between shrink-0">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setFilterTable('all')}
                className={`px-3 py-1 rounded-xl font-medium transition-colors cursor-pointer shrink-0 ${
                  filterTable === 'all'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                Todas ({queue.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTable('transactions')}
                className={`px-3 py-1 rounded-xl font-medium transition-colors cursor-pointer shrink-0 ${
                  filterTable === 'transactions'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                Lançamentos
              </button>
              <button
                type="button"
                onClick={() => setFilterTable('reserves')}
                className={`px-3 py-1 rounded-xl font-medium transition-colors cursor-pointer shrink-0 ${
                  filterTable === 'reserves'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                Reservas
              </button>
              <button
                type="button"
                onClick={() => setFilterTable('investments')}
                className={`px-3 py-1 rounded-xl font-medium transition-colors cursor-pointer shrink-0 ${
                  filterTable === 'investments'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                Investimentos
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-48 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar operação..."
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-foreground">
                Tudo sincronizado com sucesso!
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Não há nenhuma movimentação ou alteração pendente na base de dados. Quando você criar ou editar lançamentos off-line, eles aparecerão listados aqui até que a internet retorne.
              </p>
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Nenhuma movimentação encontrada com os filtros selecionados.
            </div>
          ) : (
            filteredQueue.map((task, index) => {
              const meta = getTableMeta(task.table);
              const actionMeta = getActionBadge(task.action);
              const details = formatTaskDetails(task);
              const isExpanded = expandedItems[task.id] || false;
              const MetaIcon = meta.icon;
              const ActionIcon = actionMeta.icon;

              const createdAtDate = task.createdAt
                ? new Date(task.createdAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                  })
                : 'Recente';

              return (
                <div
                  key={task.id || index}
                  className="rounded-2xl border border-border/80 bg-card/60 hover:bg-muted/30 transition-all p-3.5 flex flex-col gap-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${meta.color}`}>
                        <MetaIcon className="w-4 h-4" />
                      </div>

                      {/* Main info */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${actionMeta.badgeClass}`}>
                            <ActionIcon className="w-3 h-3" />
                            {actionMeta.label}
                          </span>
                          <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-muted border border-border/50">
                            {meta.label}
                          </span>
                          {task.attempts > 0 && (
                            <span className="text-[10px] text-amber-500 font-medium px-1.5 py-0.2 rounded-full bg-amber-500/10 border border-amber-500/20">
                              {task.attempts} {task.attempts === 1 ? 'tentativa' : 'tentativas'}
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-semibold text-foreground leading-snug">
                          {details.title}
                        </h4>

                        {details.subtitle && (
                          <p className="text-xs text-muted-foreground">
                            {details.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Amount & Time */}
                    <div className="text-right shrink-0">
                      {details.amount && (
                        <div className={`text-sm font-bold tracking-tight ${details.amountColor}`}>
                          {details.amountPrefix} {details.amount}
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{createdAtDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer of card */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px]">
                    <div className="text-muted-foreground font-mono text-[10px] truncate max-w-[200px] sm:max-w-xs">
                      ID: {task.targetId}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpand(task.id)}
                      className="text-primary hover:text-primary/80 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      {isExpanded ? (
                        <>
                          Ocultar detalhes <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          Ver dados brutos <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Expanded JSON details */}
                  {isExpanded && (
                    <div className="relative mt-1 p-3 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 text-[11px] font-mono overflow-x-auto max-h-44">
                      <div className="flex items-center justify-between mb-1 text-[10px] text-slate-400">
                        <span>Payload JSON</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(JSON.stringify(task.payload, null, 2), task.id)}
                          className="flex items-center gap-1 hover:text-white cursor-pointer"
                        >
                          {copiedId === task.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" /> Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> Copiar
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap break-all">
                        {JSON.stringify(task.payload || {}, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 sm:px-6 bg-muted/40 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-muted-foreground hidden sm:block">
            {queue.length > 0
              ? 'A sincronização ocorre automaticamente assim que a conexão retornar.'
              : 'O aplicativo está pronto para uso off-line e on-line.'}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-semibold text-xs h-9 cursor-pointer"
            >
              Fechar
            </Button>

            <Button
              type="button"
              onClick={handleManualSync}
              disabled={queue.length === 0 || isSyncing}
              className="rounded-xl font-semibold text-xs h-9 cursor-pointer flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Tentar Sincronizar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
