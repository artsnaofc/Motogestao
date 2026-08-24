import React from 'react';
import { Bike, Sparkles, ShieldCheck, Loader2 } from 'lucide-react';

export function PageLoadingFallback() {
  const [clickCount, setClickCount] = React.useState(0);

  const handleLogoClick = () => {
    const nextCount = clickCount + 1;
    if (nextCount >= 3) {
      window.dispatchEvent(new CustomEvent('toggle-debug-console'));
      setClickCount(0);
    } else {
      setClickCount(nextCount);
      const timer = setTimeout(() => setClickCount(0), 2000);
      return () => clearTimeout(timer);
    }
  };

  return (
    <div className="min-h-[70vh] w-full flex flex-col items-center justify-center p-4 sm:p-6 transition-all duration-300">
      {/* Central Glassmorphic Executive Card */}
      <div className="max-w-sm w-full bg-card/85 border border-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl flex flex-col items-center text-center space-y-6 relative overflow-hidden">
        
        {/* Subtle Ambient Background Glows */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/15 rounded-full blur-2xl pointer-events-none animate-pulse" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none animate-pulse" />

        {/* Brand Animated Logo Badge */}
        <div className="relative cursor-pointer select-none" onClick={handleLogoClick} title="Clique 3 vezes para abrir o Debug">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary via-indigo-600 to-indigo-700 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30 relative z-10 animate-pulse">
            <Bike className="w-8 h-8" />
          </div>
          <div className="absolute -inset-2 bg-primary/20 rounded-3xl blur-md animate-ping -z-0" />
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1.5 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-spin" />
            <span>Finanças Pro</span>
          </div>
          <h3 className="text-base font-black tracking-tight text-foreground flex items-center justify-center gap-2">
            Carregando Módulo
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </h3>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            Sincronizando registros e compilando visões analíticas...
          </p>
        </div>

        {/* Shimmering Progress Bar */}
        <div className="w-full space-y-2 z-10">
          <div className="h-2 w-full bg-muted/80 rounded-full overflow-hidden p-0.5 border border-border/50 relative">
            <div className="h-full bg-gradient-to-r from-primary via-indigo-500 to-emerald-500 rounded-full animate-pulse w-full" />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-bold px-1">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-3 h-3" /> Sessão Protegida
            </span>
            <span className="animate-pulse text-primary font-mono">Processando...</span>
          </div>
        </div>

        {/* Skeleton Shimmer Preview Placeholders */}
        <div className="w-full space-y-2 pt-2 z-10 border-t border-border/40">
          <div className="h-2.5 w-3/4 bg-muted/60 rounded-full animate-pulse mx-auto" />
          <div className="h-2 w-1/2 bg-muted/40 rounded-full animate-pulse mx-auto" />
        </div>

      </div>
    </div>
  );
}
