import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Fingerprint, Lock, ShieldCheck, ArrowRight, LogOut, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { 
  authenticateWithBiometrics, 
  detectBiometricLabel, 
  getBiometricSettings, 
  isBiometricsConfiguredOnDevice,
  recordAppActivity,
  shouldTriggerAppLock 
} from '../lib/biometrics';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

interface BiometricAppLockProps {
  userId?: string;
  userEmail?: string;
  onUnlocked?: () => void;
}

export function BiometricAppLock({ userId, userEmail, onUnlocked }: BiometricAppLockProps) {
  const [isLocked, setIsLocked] = useState(() => {
    // Only lock if THIS specific browser/device has registered biometrics
    if (!isBiometricsConfiguredOnDevice(userId)) {
      return false;
    }
    const settings = getBiometricSettings(userId);
    if (settings.enabled) {
      if (settings.autoLockMinutes === 0) {
        return true;
      }
      const unlockedSession = sessionStorage.getItem('financas_pro_app_session_unlocked');
      return !unlockedSession;
    }
    return false;
  });

  const [verifying, setVerifying] = useState(false);
  const [bioInfo, setBioInfo] = useState({ name: 'Biometria', type: 'generic' });
  const [autoPrompted, setAutoPrompted] = useState(false);
  const promptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setBioInfo(detectBiometricLabel());
  }, []);

  // Update lock state if biometrics becomes enabled or userId resolves
  useEffect(() => {
    if (!isBiometricsConfiguredOnDevice(userId)) {
      setIsLocked(false);
      return;
    }
    const settings = getBiometricSettings(userId);
    if (settings.enabled) {
      const unlockedSession = sessionStorage.getItem('financas_pro_app_session_unlocked');
      if (settings.autoLockMinutes === 0 || !unlockedSession) {
        setIsLocked(true);
      }
    } else {
      setIsLocked(false);
    }
  }, [userId]);

  const handleUnlock = useCallback(async () => {
    if (verifying) return;
    setVerifying(true);
    try {
      const res = await authenticateWithBiometrics(userId);
      if (res.success) {
        setIsLocked(false);
        sessionStorage.setItem('financas_pro_app_session_unlocked', 'true');
        recordAppActivity();
        toast.success(`${bioInfo.name} reconhecido! Acesso liberado.`);
        if (onUnlocked) onUnlocked();
      } else {
        toast.error(res.error || 'Leitura não confirmada. Tente novamente.');
      }
    } catch (err: any) {
      toast.error('Erro na leitura biométrica: ' + (err?.message || err));
    } finally {
      setVerifying(false);
    }
  }, [userId, verifying, bioInfo.name, onUnlocked]);

  // Monitor visibility changes & app foregrounding (Mobile First)
  useEffect(() => {
    if (!isBiometricsConfiguredOnDevice(userId)) {
      return;
    }
    const settings = getBiometricSettings(userId);
    if (!settings.enabled || settings.autoLockMinutes === -1) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        recordAppActivity();
      } else if (document.visibilityState === 'visible') {
        // App reopened or brought back to foreground
        if (settings.autoLockMinutes === 0 || shouldTriggerAppLock(userId)) {
          setIsLocked(true);
          setAutoPrompted(false);
        }
      }
    };

    const handleFocus = () => {
      if (settings.autoLockMinutes === 0 && !sessionStorage.getItem('financas_pro_tab_focused')) {
        setIsLocked(true);
        setAutoPrompted(false);
      }
      sessionStorage.setItem('financas_pro_tab_focused', 'true');
    };

    // User interaction recorder
    const handleUserActivity = () => {
      if (!isLocked) {
        recordAppActivity();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('touchstart', handleUserActivity, { passive: true });
    window.addEventListener('mousedown', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
    };
  }, [userId, isLocked]);

  // Auto prompt sensor when locked
  useEffect(() => {
    if (isLocked && !autoPrompted && !verifying) {
      setAutoPrompted(true);
      if (promptTimeoutRef.current) clearTimeout(promptTimeoutRef.current);
      promptTimeoutRef.current = setTimeout(() => {
        handleUnlock();
      }, 400);
    }

    return () => {
      if (promptTimeoutRef.current) clearTimeout(promptTimeoutRef.current);
    };
  }, [isLocked, autoPrompted, verifying, handleUnlock]);

  const handleSignOut = async () => {
    try {
      sessionStorage.clear();
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-background/95 backdrop-blur-xl animate-in fade-in duration-300">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 -left-12 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-12 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6 relative z-10">
        {/* Animated Biometric Emblem */}
        <div className="relative group cursor-pointer" onClick={handleUnlock}>
          <div className="w-24 h-24 rounded-3xl bg-linear-to-tr from-indigo-500/20 via-indigo-600/10 to-emerald-500/20 border border-indigo-500/30 flex items-center justify-center shadow-2xl relative overflow-hidden transition-transform active:scale-95">
            <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />
            <Fingerprint className="w-12 h-12 text-indigo-500 dark:text-indigo-400 drop-shadow-md animate-in zoom-in duration-300" />
            <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-emerald-500 text-white shadow-md">
              <Lock className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* Text Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Proteção Ativa</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            Finanças Pro Bloqueado
          </h2>
          <p className="text-xs text-muted-foreground max-w-xs font-medium">
            Confirme sua identidade via <strong className="text-foreground">{bioInfo.name}</strong> para abrir o aplicativo.
          </p>
          {userEmail && (
            <p className="text-[11px] font-mono text-muted-foreground/80 pt-0.5">
              {userEmail}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-3 pt-2">
          <Button
            onClick={handleUnlock}
            disabled={verifying}
            className="w-full h-12 rounded-2xl font-extrabold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Aguardando Sensor...</span>
              </>
            ) : (
              <>
                <Fingerprint className="w-5 h-5" />
                <span>Desbloquear com {bioInfo.name}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={handleUnlock}
              className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer py-1"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
              <span>Tentar Novamente</span>
            </button>

            <span className="text-border">•</span>

            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs font-bold text-rose-500/80 hover:text-rose-600 dark:hover:text-rose-400 transition-colors flex items-center gap-1.5 cursor-pointer py-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
