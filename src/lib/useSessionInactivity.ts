import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { systemSettings } from './systemSettings';
import { toast } from 'sonner';

/**
 * Monitors user inactivity and triggers automatic session expiration / logout
 * when inactivity exceeds the configured timeout in System Settings.
 */
export function useSessionInactivity() {
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const config = systemSettings.getConfig();
    const timeoutMinutes = config.sessionTimeoutMinutes || 120;
    
    // If timeout is 0 or negative, inactivity timeout is disabled
    if (timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;

    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          systemSettings.logAction(
            'Sistema',
            'Expiração de Sessão',
            `Sessão encerrada automaticamente por inatividade (${timeoutMinutes} minutos sem interação).`,
            'security',
            'warn'
          );
          
          await supabase.auth.signOut();
          toast.warning('Sessão Expirada', {
            description: `Você foi desconectado por inatividade (${timeoutMinutes} min). Faça login novamente.`,
          });
        }
      }, timeoutMs);
    };

    // User activity events to listen to
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    
    // Throttle event handling
    let lastHandled = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastHandled > 2000) {
        lastHandled = now;
        resetTimer();
      }
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    resetTimer();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, []);
}
