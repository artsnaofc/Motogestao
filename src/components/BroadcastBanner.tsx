import React, { useState, useEffect } from 'react';
import { systemSettings, SystemConfig } from '../lib/systemSettings';
import { 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  AlertOctagon, 
  X,
  Sparkles
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export function BroadcastBanner() {
  const [banner, setBanner] = useState<SystemConfig['broadcastBanner']>(() => {
    return systemSettings.getConfig().broadcastBanner;
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleConfigChange = (e: any) => {
      const newConfig = e.detail as SystemConfig;
      if (newConfig?.broadcastBanner) {
        setBanner(newConfig.broadcastBanner);
        // If message changed or newly enabled, reset dismissed state
        setDismissed(false);
      }
    };

    window.addEventListener('system-config-changed', handleConfigChange);
    return () => {
      window.removeEventListener('system-config-changed', handleConfigChange);
    };
  }, []);

  if (!banner.enabled || !banner.message?.trim() || dismissed) {
    return null;
  }

  const getTypeStyles = () => {
    switch (banner.type) {
      case 'warning':
        return {
          bg: 'bg-amber-500/15 dark:bg-amber-950/40',
          border: 'border-amber-500/30',
          text: 'text-amber-800 dark:text-amber-200',
          iconColor: 'text-amber-500',
          Icon: AlertTriangle,
        };
      case 'critical':
        return {
          bg: 'bg-rose-500/15 dark:bg-rose-950/40',
          border: 'border-rose-500/30',
          text: 'text-rose-800 dark:text-rose-200',
          iconColor: 'text-rose-500',
          Icon: AlertOctagon,
        };
      case 'success':
        return {
          bg: 'bg-emerald-500/15 dark:bg-emerald-950/40',
          border: 'border-emerald-500/30',
          text: 'text-emerald-800 dark:text-emerald-200',
          iconColor: 'text-emerald-500',
          Icon: CheckCircle2,
        };
      case 'info':
      default:
        return {
          bg: 'bg-indigo-500/15 dark:bg-indigo-950/40',
          border: 'border-indigo-500/30',
          text: 'text-indigo-800 dark:text-indigo-200',
          iconColor: 'text-indigo-500',
          Icon: Info,
        };
    }
  };

  const style = getTypeStyles();
  const Icon = style.Icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -8, height: 0 }}
        className={`w-full border-b ${style.border} ${style.bg} px-4 py-2.5 z-40 transition-all`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className={`p-1 rounded-lg bg-background/60 shrink-0 ${style.iconColor} shadow-2xs`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {banner.title && (
                <span className={`font-black uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-background/50 border border-current/20 ${style.text}`}>
                  {banner.title}
                </span>
              )}
              <span className={`font-medium ${style.text} leading-tight`}>
                {banner.message}
              </span>
            </div>
          </div>

          {banner.dismissible && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-lg hover:bg-background/40 text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
              title="Fechar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
