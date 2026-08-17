import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Detailed Production Debug Logs
    console.group('%c[Finanças Pro - Error Boundary Debug]', 'background: #ef4444; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;');
    console.error('📅 Timestamp:', new Date().toISOString());
    console.error('🌐 URL:', window.location.href);
    console.error('❌ Error Message:', error.message);
    console.error('📚 Error Stack:', error.stack);
    console.error('🧩 Component Stack:', errorInfo.componentStack);
    console.error('💻 User Agent:', navigator.userAgent);
    console.groupEnd();
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[70vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card/90 border border-destructive/30 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-xl text-center space-y-5">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-7 h-7 animate-bounce" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-[10px] font-extrabold uppercase tracking-widest border border-destructive/20 inline-flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> Falha de Renderização
              </span>
              <h2 className="text-xl font-black text-foreground tracking-tight">
                Oops! Algo deu errado
              </h2>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                Ocorreu uma falha inesperada ao carregar este módulo. Todos os detalhes foram registrados no console para investigação.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-muted/50 border border-border/60 rounded-xl text-left text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-28 break-words select-all">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-all cursor-pointer shadow-md shadow-primary/20 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Módulo
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="h-11 px-4 rounded-2xl bg-muted/60 hover:bg-muted text-foreground font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-border/50"
              >
                <Home className="w-4 h-4" />
                Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
