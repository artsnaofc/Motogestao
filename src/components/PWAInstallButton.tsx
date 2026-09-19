import React, { useState } from 'react';
import { Download, Smartphone, X, Check, Share2, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../lib/usePWAInstall';
import { Button } from './ui/button';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'banner';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Neither installable (no prompt yet) nor iOS
  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    setInstalling(true);
    try {
      await install();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <>
      {variant === 'banner' ? (
        <div
          id="pwa-install-banner"
          className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-indigo-500/15 border border-emerald-500/30 text-foreground ${className}`}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black tracking-tight">Instalar MotoGestão no Celular</p>
              <p className="text-[10.5px] text-muted-foreground">
                Uso em tela cheia no guidão, acesso rápido e modo offline
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleInstallClick}
            disabled={installing}
            className="rounded-xl h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Instalar
          </Button>
        </div>
      ) : variant === 'sidebar' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`w-full flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer font-bold text-xs ${className}`}
        >
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-4 h-4" />
            <span>Instalar App no Celular</span>
          </div>
          <Download className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          title="Instalar MotoGestão como aplicativo no celular ou computador"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer select-none active:scale-95 ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Instalar App</span>
        </button>
      )}

      {/* Modal Tutorial para iPhone / iPad (iOS Safari) */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-sm rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">Instalar no iPhone / iPad</h3>
                  <p className="text-[11px] text-muted-foreground">Adicione ao seu guidão em 2 toques</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-foreground/90">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-muted/40 border border-border/40">
                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 font-black text-xs">
                  1
                </div>
                <div>
                  <p className="font-bold">Toque no botão Compartilhar do Safari</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    Procure pelo ícone <Share2 className="w-3 h-3 text-primary inline" /> na barra inferior do Safari.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-muted/40 border border-border/40">
                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 font-black text-xs">
                  2
                </div>
                <div>
                  <p className="font-bold">Role para baixo e selecione:</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-extrabold mt-0.5 flex items-center gap-1">
                    <PlusSquare className="w-3.5 h-3.5 inline" /> "Adicionar à Tela de Início"
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-muted/40 border border-border/40">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 font-black text-xs">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="font-bold">Pronto para a pista!</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    O MotoGestão abrirá em tela cheia, sem barra de navegação, perfeito para suporte de guidão.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setShowIOSModal(false)}
              className="w-full rounded-2xl font-bold text-xs h-10 bg-primary text-primary-foreground cursor-pointer"
            >
              Entendi
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
