import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  HelpCircle, 
  ArrowRight, 
  Check, 
  X, 
  Sparkles, 
  Table as TableIcon,
  RefreshCw
} from 'lucide-react';
import { parseFundamentusTable, FundamentusParseResult } from '../../lib/fundamentusParser';
import { toast } from 'sonner';

interface FundamentusImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: any[], source?: string) => Promise<{ created: number; updated: number; errors: number; supabaseError?: string | null }>;
}

export const FundamentusImportModal: React.FC<FundamentusImportModalProps> = ({
  isOpen,
  onClose,
  onImport
}) => {
  const [pastedText, setPastedText] = useState('');
  const [selectedTypeOverride, setSelectedTypeOverride] = useState<'auto' | 'Ação' | 'FII'>('auto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importReport, setImportReport] = useState<{ created: number; updated: number; errors: number; supabaseError?: string | null } | null>(null);

  // Real-time parsing of pasted text
  const parseResult: FundamentusParseResult = useMemo(() => {
    if (!pastedText.trim()) {
      return {
        detectedType: 'Unknown',
        totalLines: 0,
        validCount: 0,
        errorCount: 0,
        recognizedColumns: [],
        items: [],
        errors: []
      };
    }
    return parseFundamentusTable(pastedText);
  }, [pastedText]);

  const effectiveType = selectedTypeOverride === 'auto' ? parseResult.detectedType : selectedTypeOverride;

  const validItems = useMemo(() => {
    return parseResult.items.filter(item => item.isValid);
  }, [parseResult]);

  if (!isOpen) return null;

  const handlePasteSample = (type: 'Ação' | 'FII') => {
    if (type === 'Ação') {
      setPastedText(`Papel\tCotação\tP/L\tP/VP\tPSR\tDiv.Yield\tP/Ativo\tP/Cap.Giro\tP/EBIT\tP/Ativ Circ.Liq\tEV/EBIT\tEV/EBITDA\tMrg Bruta\tMrg Ebit\tMrg. Líq.\tLiq. Corr.\tROIC\tROE\tLiq.2meses\tPatrim. Líq\tDív.Líq/ Patrim.\tCresc. Rec.5a
PETR4\t38,40\t4,52\t1,12\t0,85\t14,20%\t0,45\t-3,20\t2,10\t-0,90\t2,80\t2,40\t51,20%\t42,10%\t24,80%\t1,45\t21,50%\t25,40%\t1.250.000.000,00\t390.000.000.000,00\t0,85\t12,40%
VALE3\t58,90\t5,80\t1,35\t1,40\t8,50%\t0,62\t4,10\t3,20\t-1,10\t3,90\t3,50\t44,10%\t38,20%\t23,10%\t1,62\t18,90%\t23,10%\t980.000.000,00\t210.000.000.000,00\t0,32\t6,80%
BBAS3\t27,50\t4,10\t0,82\t0,70\t9,80%\t0,12\t0,00\t0,00\t0,00\t0,00\t0,00\t0,00%\t0,00%\t16,50%\t0,00\t0,00%\t21,20%\t450.000.000,00\t180.000.000.000,00\t0,00\t14,20%
WEGE3\t52,10\t32,40\t10,50\t5,20\t1,80%\t4,80\t12,50\t24,10\t-8,50\t23,50\t21,20\t34,20%\t22,10%\t16,80%\t2,40\t28,50%\t33,20%\t380.000.000,00\t21.000.000.000,00\t-0,15\t22,40%`);
    } else {
      setPastedText(`Papel\tSegmento\tCotação\tFFO Yield\tDividend Yield\tP/VP\tValor de Mercado\tLiquidez\tQtd de imóveis\tPreço do m2\tAluguel por m2\tCap Rate\tVacância Média
HGLG11\tLogística\t162,50\t8,90%\t8,50%\t1,02\t5.400.000.000,00\t7.500.000,00\t25\t4.850,00\t38,50\t8,20%\t3,80%
KNCR11\tTítulos Imobiliários\t103,20\t12,80%\t12,40%\t1,01\t5.800.000.000,00\t9.200.000,00\t0\t0,00\t0,00\t0,00%\t0,00%
XPML11\tShoppings\t114,80\t9,10%\t8,90%\t0,98\t6.200.000.000,00\t11.000.000,00\t22\t14.200,00\t115,00\t8,60%\t4,20%
VISC11\tShoppings\t118,20\t8,80%\t8,60%\t0,96\t3.800.000.000,00\t4.800.000,00\t25\t12.800,00\t102,00\t8,40%\t5,10%`);
    }
  };

  const handleExecuteImport = async () => {
    if (validItems.length === 0) {
      toast.error('Nenhum ativo válido para importar.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await onImport(validItems, 'Fundamentus');
      setImportReport(result);
      toast.success(`Importação concluída! ${result.created} criados, ${result.updated} atualizados.`);
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Erro ao salvar os dados importados no banco de dados.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setPastedText('');
    setImportReport(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                Importador Inteligente Fundamentus
                <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  B3 Direto
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Copie a tabela inteira do Fundamentus (Ações ou FIIs) e cole aqui. Identificação 100% automática.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {importReport ? (
            /* SUCCESS REPORT VIEW */
            <div className="py-10 px-6 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-sm">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-foreground">Importação Finalizada com Sucesso!</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  A base de dados local e os registros foram atualizados. Os ativos já estão prontos para análise e rebalanceamento.
                </p>
              </div>

              {/* Supabase Status Banner */}
              {importReport.supabaseError ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl max-w-md mx-auto text-left text-xs space-y-1 text-amber-900 dark:text-amber-200">
                  <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Salvo no Cache Local (Aviso Supabase)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Os dados estão salvos e ativos no navegador. Para persistir diretamente no Supabase sem erros, execute o arquivo <code className="bg-amber-500/20 px-1 py-0.5 rounded text-[10px] font-mono">supabase_b3_metadata.sql</code> no seu SQL Editor.
                  </p>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl max-w-md mx-auto text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sincronizado e Salvo com Sucesso no Supabase (Nuvem)</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                  <div className="text-2xl font-black text-emerald-600">+{importReport.created}</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Novos Ativos</div>
                </div>
                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-center">
                  <div className="text-2xl font-black text-blue-600">↺ {importReport.updated}</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Atualizados</div>
                </div>
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-center">
                  <div className="text-2xl font-black text-amber-600">{importReport.errors}</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Erros/Ignorados</div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-xl border border-border/80 text-xs font-bold text-foreground hover:bg-muted/50 transition-colors"
                >
                  Importar Outra Tabela
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black shadow-md hover:bg-primary/90 transition-colors"
                >
                  Fechar e Ver Análise
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* TEXTAREA & HELPER CONTROLS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                    <TableIcon className="w-3.5 h-3.5 text-primary" />
                    Área de Colagem (Ctrl+V da tabela)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Exemplos rápidos:</span>
                    <button
                      type="button"
                      onClick={() => handlePasteSample('Ação')}
                      className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      + Ações
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePasteSample('FII')}
                      className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      + FIIs
                    </button>
                    {pastedText && (
                      <button
                        type="button"
                        onClick={handleReset}
                        className="text-[10px] font-bold text-rose-500 hover:underline ml-2"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Cole aqui o conteúdo copiado da tabela de busca avançada do Fundamentus (com cabeçalhos ou colunas tabuladas)..."
                  className="w-full h-44 bg-muted/20 border border-border/70 rounded-2xl p-4 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-y"
                />
              </div>

              {/* DETECTION METRICS BAR */}
              {pastedText.trim() && (
                <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-muted-foreground">Classe Detectada:</span>
                        <span className={`text-xs font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider ${
                          effectiveType === 'FII' 
                            ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                            : effectiveType === 'Ação'
                            ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {effectiveType === 'FII' ? '🏢 FIIs (Fundos Imobiliários)' : effectiveType === 'Ação' ? '📈 Ações B3' : 'Não identificado'}
                        </span>
                      </div>

                      <div className="text-xs font-medium text-muted-foreground">
                        <strong className="text-foreground">{parseResult.totalLines}</strong> linhas analisadas
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {parseResult.validCount} Ativos Prontos
                      </div>
                      {parseResult.errorCount > 0 && (
                        <div className="flex items-center gap-1 text-amber-600 text-xs font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {parseResult.errorCount} com aviso
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RECOGNIZED COLUMNS CHIPS */}
                  {parseResult.recognizedColumns.length > 0 && (
                    <div className="pt-2 border-t border-border/40">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
                        Colunas Reconhecidas ({parseResult.recognizedColumns.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                        {parseResult.recognizedColumns.map((col, idx) => (
                          <span key={idx} className="text-[10px] font-medium bg-muted/60 text-foreground px-2 py-0.5 rounded-md border border-border/40">
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PREVIEW TABLE */}
              {parseResult.items.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                      Prévia dos Dados Extraídos ({Math.min(parseResult.items.length, 15)} de {parseResult.items.length})
                    </h4>
                    <span className="text-[11px] text-muted-foreground">
                      Validação automática de tickers e números
                    </span>
                  </div>

                  <div className="rounded-2xl border border-border/70 overflow-hidden bg-card shadow-xs">
                    <div className="overflow-x-auto max-h-60">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/60 text-[10px] uppercase">
                          <tr>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Ticker</th>
                            <th className="px-3 py-2 text-right">Cotação</th>
                            {effectiveType === 'FII' ? (
                              <>
                                <th className="px-3 py-2">Segmento</th>
                                <th className="px-3 py-2 text-right">P/VP</th>
                                <th className="px-3 py-2 text-right">DY 12M</th>
                                <th className="px-3 py-2 text-right">FFO Yield</th>
                                <th className="px-3 py-2 text-right">Vacância</th>
                                <th className="px-3 py-2 text-right">Cap Rate</th>
                                <th className="px-3 py-2 text-right">Imóveis</th>
                              </>
                            ) : (
                              <>
                                <th className="px-3 py-2 text-right">P/L</th>
                                <th className="px-3 py-2 text-right">P/VP</th>
                                <th className="px-3 py-2 text-right">DY 12M</th>
                                <th className="px-3 py-2 text-right">ROE</th>
                                <th className="px-3 py-2 text-right">ROIC</th>
                                <th className="px-3 py-2 text-right">Margem Líq.</th>
                                <th className="px-3 py-2 text-right">Dív/PL</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-medium">
                          {parseResult.items.slice(0, 15).map((it, idx) => {
                            const data = it.fiiData || it.stockData;
                            return (
                              <tr key={idx} className={it.isValid ? 'hover:bg-muted/20' : 'bg-rose-500/5'}>
                                <td className="px-3 py-2">
                                  {it.isValid ? (
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                      <Check className="w-2.5 h-2.5" /> Válido
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1" title={it.errors.join(', ')}>
                                      <X className="w-2.5 h-2.5" /> Erro
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 font-black text-foreground">{it.ticker || it.rawTicker}</td>
                                <td className="px-3 py-2 text-right font-semibold">
                                  {data?.lastPrice !== null && data?.lastPrice !== undefined ? `R$ ${data.lastPrice.toFixed(2)}` : '-'}
                                </td>

                                {effectiveType === 'FII' ? (
                                  <>
                                    <td className="px-3 py-2 text-muted-foreground">{it.fiiData?.segment || '-'}</td>
                                    <td className="px-3 py-2 text-right font-bold text-foreground">
                                      {it.fiiData?.pvp !== null && it.fiiData?.pvp !== undefined ? it.fiiData.pvp.toFixed(2) : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-emerald-600 font-bold">
                                      {it.fiiData?.dividendYield !== null && it.fiiData?.dividendYield !== undefined ? `${it.fiiData.dividendYield.toFixed(1)}%` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-muted-foreground">
                                      {it.fiiData?.ffoYield !== null && it.fiiData?.ffoYield !== undefined ? `${it.fiiData.ffoYield.toFixed(1)}%` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-muted-foreground">
                                      {it.fiiData?.physicalVacancy !== null && it.fiiData?.physicalVacancy !== undefined ? `${it.fiiData.physicalVacancy.toFixed(1)}%` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-muted-foreground">
                                      {it.fiiData?.capRate !== null && it.fiiData?.capRate !== undefined ? `${it.fiiData.capRate.toFixed(1)}%` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-muted-foreground">
                                      {it.fiiData?.propertiesCount !== null && it.fiiData?.propertiesCount !== undefined ? it.fiiData.propertiesCount : '-'}
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-3 py-2 text-right font-bold text-foreground">
                                      {it.stockData?.pl !== null && it.stockData?.pl !== undefined ? it.stockData.pl.toFixed(1) : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-foreground">
                                      {it.stockData?.pvp !== null && it.stockData?.pvp !== undefined ? it.stockData.pvp.toFixed(2) : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-emerald-600 font-bold">
                                      {it.stockData?.dividendYield !== null && it.stockData?.dividendYield !== undefined ? `${it.stockData.dividendYield.toFixed(1)}%` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-muted-foreground">
                                      {it.stockData?.roe !== null && it.stockData?.roe !== undefined ? `${it.stockData.roe.toFixed(1)}%` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-muted-foreground">
                                      {it.stockData?.roic !== null && it.stockData?.roic !== undefined ? `${it.stockData.roic.toFixed(1)}%` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-muted-foreground">
                                      {it.stockData?.netMargin !== null && it.stockData?.netMargin !== undefined ? `${it.stockData.netMargin.toFixed(1)}%` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-muted-foreground">
                                      {it.stockData?.netDebtOverEquity !== null && it.stockData?.netDebtOverEquity !== undefined ? it.stockData.netDebtOverEquity.toFixed(2) : '-'}
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ERRORS BREAKDOWN IF ANY */}
              {parseResult.errors.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {parseResult.errors.length} linha(s) ignorada(s) ou com formato incorreto:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] max-h-24 overflow-y-auto">
                    {parseResult.errors.map((err, i) => (
                      <li key={i}>
                        Linha {err.line}: {err.message} <span className="opacity-70 font-mono">({err.rawText.slice(0, 40)}...)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        {!importReport && (
          <div className="px-6 py-4 border-t border-border/50 bg-muted/20 flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>

            <button
              onClick={handleExecuteImport}
              disabled={validItems.length === 0 || isProcessing}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black shadow-md hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Salvando dados no Supabase...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  Importar {validItems.length} Ativo(s)
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
