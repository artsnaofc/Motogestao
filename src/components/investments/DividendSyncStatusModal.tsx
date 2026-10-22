import React from 'react';
import { DividendSyncStatus, DividendSyncResult } from '../../types';
import { 
  X, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Database, 
  Layers, 
  FileText, 
  ShieldCheck,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

interface DividendSyncStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: DividendSyncStatus | null;
  isSyncing: boolean;
  onTriggerSync: (provider?: string) => Promise<any>;
}

export function DividendSyncStatusModal({
  isOpen,
  onClose,
  syncStatus,
  isSyncing,
  onTriggerSync
}: DividendSyncStatusModalProps) {
  if (!isOpen) return null;

  const lastResult = syncStatus?.lastResult;
  const history = syncStatus?.history || [];

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return 'Nenhuma sincronização recente';
    try {
      const d = new Date(iso);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground">
                Sincronização Automática de Proventos
              </h2>
              <p className="text-xs text-muted-foreground">
                Descoberta oficial: CVM (Ações) e FNET/B3 (Fundos Imobiliários)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Status Banner */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-black text-foreground">
                  Provedores Oficiais Ativos
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Última consulta: <strong className="text-foreground">{formatTimestamp(syncStatus?.lastSyncAt)}</strong>
              </p>
            </div>

            <button
              onClick={() => onTriggerSync('all')}
              disabled={isSyncing}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
            </button>
          </div>

          {/* Last Result KPI Grid */}
          {lastResult && (
            <div>
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-3">
                Resultado do Último Escaneamento
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                  <span className="text-[10px] font-bold text-muted-foreground block">Descobertos</span>
                  <strong className="text-lg font-black text-foreground">{lastResult.discovered}</strong>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block">Novos Previstos</span>
                  <strong className="text-lg font-black text-emerald-600 dark:text-emerald-400">{lastResult.imported}</strong>
                </div>
                <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20">
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 block">Atualizados / Retificados</span>
                  <strong className="text-lg font-black text-sky-600 dark:text-sky-400">{lastResult.updated}</strong>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block">Ignorados / Já Sincronizados</span>
                  <strong className="text-lg font-black text-amber-600 dark:text-amber-400">{lastResult.ignored}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Sources Information */}
          <div className="space-y-2">
            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-wider">
              Fontes & Limitações
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-muted/20 border border-border/40">
                <div className="flex items-center gap-2 mb-1.5 font-bold text-foreground">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span>CVM IPE (Ações B3)</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Consulta relatórios oficiais IPE e Avisos aos Acionistas com identificação de dividendos, JCP, múltiplas parcelas e classes de ações (ON/PN).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/20 border border-border/40">
                <div className="flex items-center gap-2 mb-1.5 font-bold text-foreground">
                  <Layers className="w-3.5 h-3.5 text-purple-500" />
                  <span>FNET / B3 (Fundos Imobiliários)</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Extração estruturada de informes mensais de cotistas, distinguindo rendimentos isentos de amortizações de cotas com trava contra duplicidade.
                </p>
              </div>
            </div>
          </div>

          {/* Details Table from Last Execution */}
          {lastResult && lastResult.details && lastResult.details.length > 0 && (
            <div>
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-2">
                Eventos Analisados na Última Execução
              </h3>
              <div className="border border-border/50 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-[10px] uppercase font-black text-muted-foreground sticky top-0 border-b border-border/50">
                    <tr>
                      <th className="px-3 py-2">Ativo</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2 text-right">Unitário</th>
                      <th className="px-3 py-2">Pagamento</th>
                      <th className="px-3 py-2">Status / Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {lastResult.details.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 font-black text-foreground">{item.ticker}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.type}</td>
                        <td className="px-3 py-2 text-right font-mono font-medium">
                          R$ {item.unitAmount?.toFixed(4) || '0.0000'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{item.paymentDate}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'imported'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : item.status === 'updated'
                              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                              : item.status === 'cancelled'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {item.status === 'imported' ? 'Importado' : item.status === 'updated' ? 'Atualizado' : item.status === 'cancelled' ? 'Cancelado' : 'Ignorado'}
                          </span>
                          {item.reason && (
                            <span className="text-[10px] text-muted-foreground block truncate max-w-[180px]" title={item.reason}>
                              {item.reason}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Compliance Notice */}
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-[11px] text-muted-foreground flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p>
              Os proventos anunciados são importados como <strong>previstos (provisioned)</strong> e calculados pela posição que você detinha no fechamento da <strong>data-com</strong>. O crédito na sua carteira só ocorre no dia do pagamento.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-card border border-border text-xs font-bold text-foreground hover:bg-muted/80 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
