import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert, Copy, Check, Bug, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: true,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Save error to sessionStorage for persistence across auto-reloads
    try {
      const errorReport = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        name: error?.name || 'Error',
        message: error?.message || String(error),
        stack: error?.stack || '',
        componentStack: errorInfo?.componentStack || '',
      };
      sessionStorage.setItem('last_app_error', JSON.stringify(errorReport));
    } catch {
      // Ignore storage errors
    }

    // Detailed Production Debug Logs
    console.group('%c[Finanças Pro - Error Boundary Debug]', 'background: #ef4444; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;');
    console.error('📅 Timestamp:', new Date().toISOString());
    console.error('🌐 URL:', window.location.href);
    console.error('❌ Error Name:', error?.name);
    console.error('❌ Error Message:', error?.message);
    console.error('📚 Error Stack:', error?.stack);
    console.error('🧩 Component Stack:', errorInfo?.componentStack);
    console.error('💻 User Agent:', navigator.userAgent);
    console.groupEnd();
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
    window.location.href = '/';
  };

  private handleTryAgain = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
  };

  private handleCopyReport = () => {
    const { error, errorInfo } = this.state;
    const reportText = [
      `=== RELATÓRIO DE ERRO - FINANÇAS PRO ===`,
      `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
      `URL: ${window.location.href}`,
      `Tipo de Erro: ${error?.name || 'Desconhecido'}`,
      `Mensagem: ${error?.message || String(error)}`,
      ``,
      `--- STACK TRACE ---`,
      error?.stack || 'Sem stack trace disponível',
      ``,
      `--- COMPONENT STACK ---`,
      errorInfo?.componentStack || 'Sem component stack disponível',
      `=======================================`
    ].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(reportText).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 3000);
      }).catch(() => {
        this.fallbackCopyTextToClipboard(reportText);
      });
    } else {
      this.fallbackCopyTextToClipboard(reportText);
    }
  };

  private fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 3000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
    document.body.removeChild(textArea);
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, copied, showDetails } = this.state;

      return (
        <div className="min-h-[85vh] flex items-center justify-center p-3 sm:p-6 bg-background">
          <div className="max-w-2xl w-full bg-card border border-destructive/30 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6">
            
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center shrink-0 shadow-inner">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10.5px] font-extrabold uppercase tracking-widest border border-destructive/20 inline-flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Falha na Aplicação
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {new Date().toLocaleTimeString('pt-BR')}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                  {error?.name || 'Erro Inesperado'}
                </h2>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                  Ocorreu uma exceção durante a navegação/renderização. Copie os detalhes abaixo para diagnóstico rápido.
                </p>
              </div>
            </div>

            {/* Main Error Box */}
            <div className="space-y-3">
              <div className="p-3.5 bg-destructive/5 border border-destructive/20 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-destructive">
                  <span className="flex items-center gap-1.5">
                    <Bug className="w-4 h-4" /> Mensagem de Erro:
                  </span>
                  <span className="text-[10px] font-mono bg-destructive/10 px-2 py-0.5 rounded-md border border-destructive/20">
                    {window.location.pathname}
                  </span>
                </div>
                <p className="text-xs font-mono font-bold text-foreground break-words leading-snug selection:bg-destructive/20">
                  {error?.message || String(error)}
                </p>
              </div>

              {/* Detailed Technical Stack */}
              <div className="border border-border/60 rounded-2xl overflow-hidden bg-muted/30">
                <button
                  type="button"
                  onClick={() => this.setState({ showDetails: !showDetails })}
                  className="w-full px-4 py-2.5 bg-muted/50 hover:bg-muted/80 flex items-center justify-between text-xs font-bold text-foreground transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span>Detalhes Técnicos & Pilha do Erro (Stack)</span>
                  </span>
                  {showDetails ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {showDetails && (
                  <div className="p-3.5 space-y-3 text-[11px] font-mono text-muted-foreground border-t border-border/40 max-h-64 overflow-y-auto selection:bg-primary/20">
                    {error?.stack && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-foreground/80 block">Stack Trace:</span>
                        <pre className="p-2.5 bg-background/80 border border-border/50 rounded-xl whitespace-pre-wrap break-all text-[10.5px] leading-relaxed text-rose-500/90 dark:text-rose-400">
                          {error.stack}
                        </pre>
                      </div>
                    )}

                    {errorInfo?.componentStack && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-foreground/80 block">Component Hierarchy:</span>
                        <pre className="p-2.5 bg-background/80 border border-border/50 rounded-xl whitespace-pre-wrap break-all text-[10px] leading-relaxed text-muted-foreground">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                type="button"
                onClick={this.handleCopyReport}
                className={`w-full sm:w-auto flex-1 h-11 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  copied
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" /> Relatório Copiado com Sucesso!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copiar Detalhes do Erro
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={this.handleTryAgain}
                className="w-full sm:w-auto h-11 px-4 rounded-2xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-border/60"
                title="Tentar recuperar sem recarregar a página"
              >
                <RotateCcw className="w-4 h-4" />
                Tentar Novamente
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto h-11 px-4 rounded-2xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-all cursor-pointer shadow-md shadow-primary/20"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto h-11 px-3 rounded-2xl bg-muted/40 hover:bg-muted text-foreground font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-border/40"
              >
                <Home className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

