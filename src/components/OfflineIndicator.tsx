import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../lib/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="pwa-offline-badge"
      className="fixed bottom-16 md:bottom-6 left-4 right-4 md:right-auto md:max-w-md z-50 flex items-center justify-between gap-3 rounded-2xl bg-amber-600/95 text-white px-4 py-3 shadow-xl backdrop-blur-md border border-amber-400/40 animate-in fade-in slide-in-from-bottom-3"
    >
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <WifiOff className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-black tracking-tight leading-tight">
            Modo Offline Ativo
          </p>
          <p className="text-[11px] text-amber-100/90 leading-tight mt-0.5">
            Você pode continuar lançando corridas e gastos. A sincronização ocorrerá ao reconectar.
          </p>
        </div>
      </div>
      <div className="h-2 w-2 rounded-full bg-white animate-ping shrink-0" />
    </div>
  );
};
