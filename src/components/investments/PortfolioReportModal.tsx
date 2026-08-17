import React from 'react';
import { toast } from 'sonner';
import { Share2, Copy, FileSpreadsheet, X, Check } from 'lucide-react';

interface Position {
  ticker: string;
  type: string;
  totalQuantity: number;
  totalInvested: number;
  averagePrice: number;
  currentPrice: number | null;
  currentValue: number | null;
  dividendsReceived: number;
  yieldOnCost: number;
}

interface PortfolioReportModalProps {
  positions: Position[];
  totalInvested: number;
  totalCurrent: number;
  totalCapitalGain: number;
  capitalGainPercent: number;
  dividendsReceived: number;
  totalReturnWithDividends: number;
  totalReturnPercent: number;
  onClose: () => void;
  formatCurrency: (val: number) => string;
  analysisMode?: 'received_only' | 'include_provisioned';
}

export function PortfolioReportModal({
  positions,
  totalInvested,
  totalCurrent,
  totalCapitalGain,
  capitalGainPercent,
  dividendsReceived,
  totalReturnWithDividends,
  totalReturnPercent,
  onClose,
  formatCurrency,
  analysisMode = 'received_only'
}: PortfolioReportModalProps) {
  const [copied, setCopied] = React.useState(false);

  const isIncProv = analysisMode === 'include_provisioned';

  const reportText = React.useMemo(() => {
    let text = `📊 RESUMO EXECUTIVO DA CARTEIRA DE INVESTIMENTOS\n`;
    text += `📅 Data do Relatório: ${new Date().toLocaleDateString('pt-BR')}\n`;
    text += `🔍 Modo de Análise: ${isIncProv ? 'Proventos Recebidos + Provisionados' : 'Apenas Proventos Efetivados/Recebidos'}\n\n`;
    text += `💵 Total Investido: ${formatCurrency(totalInvested)}\n`;
    text += `📈 Patrimônio Atual: ${formatCurrency(totalCurrent)}\n`;
    text += `⚡ Ganho de Capital: ${formatCurrency(totalCapitalGain)} (${capitalGainPercent.toFixed(2)}%)\n`;
    text += `🎁 Proventos (${isIncProv ? 'Recebidos + Provisionados' : 'Recebidos'}): ${formatCurrency(dividendsReceived)}\n`;
    text += `⭐ Lucro Total Combinado: ${formatCurrency(totalReturnWithDividends)} (${totalReturnPercent.toFixed(2)}%)\n\n`;
    text += `📌 POSIÇÕES ATIVAS (${positions.length}):\n`;
    positions.forEach(p => {
      const curVal = p.currentValue || p.totalInvested;
      const gain = p.currentValue ? ((p.currentValue - p.totalInvested) / p.totalInvested) * 100 : 0;
      text += `• ${p.ticker} (${p.type}): ${p.totalQuantity} cotas | PM: R$ ${p.averagePrice.toFixed(2)} | Atual: ${formatCurrency(curVal)} (${gain >= 0 ? '+' : ''}${gain.toFixed(2)}%)\n`;
    });
    return text;
  }, [positions, totalInvested, totalCurrent, totalCapitalGain, capitalGainPercent, dividendsReceived, totalReturnWithDividends, totalReturnPercent, isIncProv]);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    toast.success('Relatório da carteira copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    try {
      const headers = ['Ticker', 'Tipo', 'Quantidade', 'Preço Médio (R$)', 'Cotação Atual (R$)', 'Total Investido (R$)', 'Patrimônio Atual (R$)', 'Ganho Capital (R$)', 'Proventos Recebidos (R$)', 'Yield on Cost (%)'];
      const rows = positions.map(p => {
        const curVal = p.currentValue || p.totalInvested;
        const capitalGain = p.currentValue ? p.currentValue - p.totalInvested : 0;
        return [
          p.ticker,
          p.type,
          p.totalQuantity,
          p.averagePrice.toFixed(2),
          (p.currentPrice || p.averagePrice).toFixed(2),
          p.totalInvested.toFixed(2),
          curVal.toFixed(2),
          capitalGain.toFixed(2),
          p.dividendsReceived.toFixed(2),
          p.yieldOnCost.toFixed(2)
        ];
      });

      const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `carteira_investimentos_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Arquivo CSV exportado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar relatório CSV.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg p-6 rounded-3xl border border-border/60 bg-card shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <header className="flex justify-between items-center pb-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-500">
              <Share2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Relatório Executivo da Carteira</h2>
              <p className="text-xs text-muted-foreground font-medium">Exporte em CSV ou copie o resumo executivo.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 text-xs font-mono whitespace-pre-wrap leading-relaxed select-all text-muted-foreground max-h-60 overflow-y-auto">
          {reportText}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-border/40">
          <button
            onClick={handleExportCSV}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar CSV
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 transition-colors min-h-[44px]"
            >
              Fechar
            </button>
            <button
              onClick={handleCopy}
              className="px-5 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 shadow-sm min-h-[44px]"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar Texto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

