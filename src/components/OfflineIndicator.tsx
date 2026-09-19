import React, { useState, useEffect } from 'react';
import { WifiOff, ChevronRight, Layers } from 'lucide-react';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { syncQueueManager, SyncTask } from '../lib/syncQueue';
import { PendingSyncQueueModal } from './PendingSyncQueueModal';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<SyncTask[]>([]);

  useEffect(() => {
    const unsubscribe = syncQueueManager.subscribe((queue) => {
      setPendingQueue([...queue]);
    });
    return () => unsubscribe();
  }, []);

  const pendingCount = pendingQueue.length;
  const isBadgeVisible = !isOnline && !isModalOpen;

  // If online and modal is closed, don't keep in DOM
  if (isOnline && !isModalOpen) return null;

  return (
    <>
      {isBadgeVisible && (
        <div
          id="pwa-offline-badge"
          role="button"
          tabIndex={0}
          onClick={() => setIsModalOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsModalOpen(true);
            }
          }}
          className="fixed bottom-20 md:bottom-6 left-4 right-4 md:right-auto md:max-w-md z-30 flex items-center justify-between gap-3 rounded-2xl bg-amber-600/95 hover:bg-amber-600 text-white px-4 py-3 shadow-xl backdrop-blur-md border border-amber-400/40 animate-in fade-in slide-in-from-bottom-3 cursor-pointer group select-none transition-all active:scale-[0.98] ring-1 ring-amber-300/30 touch-manipulation"
          title="Clique para ver a lista de movimentações pendentes da base de dados"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <WifiOff className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-black tracking-tight leading-tight">
                  Modo Offline Ativo
                </p>
                {pendingCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.2 rounded-full bg-black/25 text-amber-200 border border-amber-300/30">
                    <Layers className="w-2.5 h-2.5" />
                    {pendingCount} {pendingCount === 1 ? 'pendente' : 'pendentes'}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-amber-200/90">
                    (Sem pendências)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-amber-100/90 leading-tight mt-0.5">
                {pendingCount > 0
                  ? 'Toque para ver a lista de alterações pendentes da database.'
                  : 'Você pode continuar lançando. Toque para ver a fila de dados.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="h-2 w-2 rounded-full bg-white animate-ping shrink-0" />
            <div className="h-7 w-7 rounded-xl bg-white/15 flex items-center justify-center text-white/90 group-hover:bg-white/25 group-hover:translate-x-0.5 transition-all">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* Modal with list of pending database movements */}
      <PendingSyncQueueModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
};
