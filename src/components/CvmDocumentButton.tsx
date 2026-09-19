import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { getAssetCnpj, formatCnpj, getCvmDocumentUrl, fetchCnpjOnline } from '../lib/cnpjUtils';
import { FileText, ExternalLink, Edit3, X, Building2, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface CvmDocumentButtonProps {
  ticker: string;
  cnpj?: string;
  variant?: 'button' | 'icon' | 'badge' | 'full';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showCnpjBadge?: boolean;
}

export function CvmDocumentButton({
  ticker,
  cnpj: explicitCnpj,
  variant = 'button',
  size = 'sm',
  className = '',
  showCnpjBadge = false,
}: CvmDocumentButtonProps) {
  const { settings, updateAssetCnpj } = useData();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  const currentCnpj = explicitCnpj || getAssetCnpj(ticker, settings);
  const [inputCnpj, setInputCnpj] = useState(currentCnpj || '');

  const handleAutoSearchCnpj = async () => {
    if (!ticker) return;
    setIsSearching(true);
    toast.info(`Buscando CNPJ para ${ticker.toUpperCase()}...`);

    const foundCnpj = await fetchCnpjOnline(ticker);
    setIsSearching(false);

    if (foundCnpj) {
      setInputCnpj(foundCnpj);
      await updateAssetCnpj(ticker, foundCnpj);
      toast.success(`CNPJ localizado para ${ticker.toUpperCase()}: ${foundCnpj}`);
      return foundCnpj;
    } else {
      toast.error(`Não foi possível localizar automaticamente o CNPJ para ${ticker.toUpperCase()}. Por favor, insira manualmente.`);
      return null;
    }
  };

  const handleOpenCvmLink = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    let resolvedCnpj = currentCnpj;

    if (!resolvedCnpj) {
      // Try auto-fetching first
      setIsSearching(true);
      toast.info(`Buscando CNPJ de ${ticker.toUpperCase()}...`);
      const autoFound = await fetchCnpjOnline(ticker);
      setIsSearching(false);

      if (autoFound) {
        resolvedCnpj = autoFound;
        await updateAssetCnpj(ticker, autoFound);
        toast.success(`CNPJ de ${ticker.toUpperCase()} encontrado: ${autoFound}`);
      } else {
        // Open modal for manual input
        setInputCnpj('');
        setIsEditModalOpen(true);
        return;
      }
    }

    const cleanCnpj = resolvedCnpj.replace(/\D/g, '');
    if (!cleanCnpj || cleanCnpj.length < 8) {
      toast.error('CNPJ inválido registrado. Por favor, corrija o CNPJ.');
      setInputCnpj(resolvedCnpj);
      setIsEditModalOpen(true);
      return;
    }

    const cvmUrl = getCvmDocumentUrl(cleanCnpj);
    toast.info(`Abrindo gerenciador de documentos CVM (FNET) para ${ticker.toUpperCase()}...`);
    window.open(cvmUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSaveCnpj = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const clean = inputCnpj.replace(/\D/g, '');
    if (!clean || clean.length < 8) {
      toast.error('Por favor, digite um CNPJ válido com 14 dígitos.');
      return;
    }

    const formatted = formatCnpj(clean);
    await updateAssetCnpj(ticker, formatted);
    setIsEditModalOpen(false);

    // Open CVM link
    const cvmUrl = getCvmDocumentUrl(clean);
    toast.success(`CNPJ de ${ticker.toUpperCase()} salvo! Redirecionando para CVM (FNET)...`);
    window.open(cvmUrl, '_blank', 'noopener,noreferrer');
  };

  const openEditModalManual = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputCnpj(currentCnpj || '');
    setIsEditModalOpen(true);
  };

  // Button sizes styling
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px] gap-1 rounded-lg',
    sm: 'px-2.5 py-1 text-xs gap-1.5 rounded-xl',
    md: 'px-3 py-1.5 text-xs gap-2 rounded-xl',
    lg: 'px-4 py-2 text-sm gap-2 rounded-2xl',
  }[size];

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={handleOpenCvmLink}
          disabled={isSearching}
          className={`p-1.5 text-muted-foreground hover:text-sky-500 hover:bg-sky-500/10 rounded-lg transition-colors inline-flex items-center gap-1 ${className}`}
          title={`Consultar Documentos CVM (FNET) - ${ticker} ${currentCnpj ? `(${formatCnpj(currentCnpj)})` : '(Sem CNPJ - Busca auto)'}`}
        >
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-sky-500" /> : <FileText className="w-4 h-4" />}
        </button>
      ) : variant === 'badge' ? (
        <div className={`inline-flex items-center gap-1.5 ${className}`}>
          <button
            type="button"
            onClick={handleOpenCvmLink}
            disabled={isSearching}
            className={`font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-all flex items-center gap-1 ${className}`}
            title="Abrir Gerenciador de Documentos CVM (FNET)"
          >
            {isSearching ? <Loader2 className="w-3 h-3 animate-spin shrink-0 text-sky-500" /> : <Building2 className="w-3 h-3 shrink-0" />}
            <span>CNPJ: {currentCnpj ? formatCnpj(currentCnpj) : 'Buscando...'}</span>
            <ExternalLink className="w-2.5 h-2.5 shrink-0 ml-0.5" />
          </button>
          <button
            type="button"
            onClick={openEditModalManual}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
            title="Editar CNPJ do ativo"
          >
            <Edit3 className="w-3 h-3" />
          </button>
        </div>
      ) : variant === 'full' ? (
        <div className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3.5 rounded-2xl bg-sky-500/5 border border-sky-500/20 gap-3 ${className}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 shrink-0">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-foreground">Documentos CVM (FNET)</span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.25 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  B3 / FNET
                </span>
              </div>
              <p className="text-[10.5px] text-muted-foreground font-medium">
                {currentCnpj ? `CNPJ: ${formatCnpj(currentCnpj)}` : 'CNPJ não cadastrado'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={openEditModalManual}
              className="p-2 text-xs font-bold text-muted-foreground hover:text-foreground rounded-xl border border-border/50 bg-card transition-colors flex items-center gap-1"
              title="Editar ou Buscar CNPJ"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleOpenCvmLink}
              disabled={isSearching}
              className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-black rounded-xl bg-sky-500 text-white hover:bg-sky-600 transition-all shadow-sm shadow-sky-500/20 flex items-center justify-center gap-1.5"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <span>{currentCnpj ? 'Consultar Documentos' : 'Buscar CNPJ / Consultar'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Standard button */
        <button
          type="button"
          onClick={handleOpenCvmLink}
          disabled={isSearching}
          className={`font-extrabold rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-all flex items-center justify-center ${sizeClasses} ${className}`}
          title={`Buscar últimos documentos no FNET CVM ${currentCnpj ? `(${formatCnpj(currentCnpj)})` : ''}`}
        >
          {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-sky-500" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}
          <span>Documentos CVM</span>
          <ExternalLink className="w-3 h-3 shrink-0 opacity-80" />
        </button>
      )}

      {/* EDIT / INPUT CNPJ MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div 
            className="w-full max-w-md p-5 sm:p-6 rounded-3xl border border-border/50 bg-card shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-foreground">
                    CNPJ do Ativo: {ticker.toUpperCase()}
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Consulta do Gerenciador de Documentos CVM (FNET)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCnpj} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground">CNPJ do Fundo / Empresa</label>
                  <button
                    type="button"
                    onClick={handleAutoSearchCnpj}
                    disabled={isSearching}
                    className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                  >
                    {isSearching ? (
                      <Loader2 className="w-3 h-3 animate-spin text-sky-500" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-sky-500" />
                    )}
                    <span>Buscar Automático</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={inputCnpj}
                    onChange={e => setInputCnpj(formatCnpj(e.target.value))}
                    placeholder="00.000.000/0001-00"
                    maxLength={18}
                    className="w-full bg-muted/40 border border-border/60 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-all pr-20"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={handleAutoSearchCnpj}
                    disabled={isSearching}
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-2.5 text-[10.5px] font-extrabold rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-all flex items-center gap-1"
                    title="Buscar CNPJ via API B3/CVM"
                  >
                    {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    <span>Auto</span>
                  </button>
                </div>

                <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                  Ao salvar, o CNPJ ficará armazenado na sua carteira e você poderá consultar diretamente os informes periódicos e Fatos Relevantes na CVM.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[11px] font-medium text-sky-700 dark:text-sky-300 flex items-start gap-2">
                <ExternalLink className="w-4 h-4 shrink-0 mt-0.5 text-sky-500" />
                <span>
                  Ao confirmar, você será redirecionado para o link oficial do FNET da B3:
                  <br />
                  <code className="text-[9.5px] font-mono break-all opacity-80 mt-1 block">
                    fnet.bmfbovespa.com.br/fnet/publico/abrirGerenciadorDocumentosCVM?cnpjFundo=...
                  </code>
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-500 text-white hover:bg-sky-600 transition-colors shadow-sm shadow-sky-500/20 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Salvar e Consultar CVM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

