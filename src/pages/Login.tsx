import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { Bike, Fingerprint, Lock, Shield, ArrowRight, Loader2, Sparkles, KeyRound, Mail } from 'lucide-react';
import { 
  authenticateWithBiometrics, 
  detectBiometricLabel, 
  isBiometricsConfiguredOnDevice, 
  isPlatformAuthenticatorAvailable 
} from '@/lib/biometrics';

export function Login() {
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [isBioAvailable, setIsBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState({ name: 'Biometria', type: 'generic' });
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    const checkBio = async () => {
      const label = detectBiometricLabel();
      setBioLabel(label);

      const available = await isPlatformAuthenticatorAvailable();
      setIsBioAvailable(available);

      const configured = isBiometricsConfiguredOnDevice();
      setHasBiometrics(configured);

      // If configured on device, we can keep the password form collapsed by default
      if (configured) {
        setShowPasswordForm(false);
      } else {
        setShowPasswordForm(true);
      }
    };

    checkBio();
  }, []);

  const handleBiometricAuth = async () => {
    if (bioLoading) return;
    setBioLoading(true);
    try {
      const res = await authenticateWithBiometrics();
      if (res.success) {
        toast.success(`Autenticado com ${bioLabel.name}!`);
        // The cached user is set in authUtils, App.tsx will navigate or refresh
        setTimeout(() => {
          window.location.href = '/';
        }, 300);
      } else {
        toast.error(res.error || 'Validação biométrica não concluída.');
        setShowPasswordForm(true);
      }
    } catch (err: any) {
      toast.error('Erro ao ler biometria: ' + (err?.message || err));
      setShowPasswordForm(true);
    } finally {
      setBioLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success('Login bem-sucedido!');
    } catch (error: any) {
      toast.error(error.message || 'Ocorreu um erro durante a autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 min-h-[90vh] relative overflow-hidden">
      {/* Background ambient gradient glow */}
      <div className="absolute top-1/4 -left-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-16 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-3 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-sm">
          <Bike className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Finanças Pro
          </h1>
          <p className="text-xs font-semibold text-muted-foreground">
            Gestão Financeira & Operacional
          </p>
        </div>
      </div>

      <Card className="w-full max-w-sm border-border/80 shadow-xl rounded-3xl overflow-hidden backdrop-blur-sm bg-card/95 animate-in zoom-in-95 duration-300">
        <CardHeader className="p-5 sm:p-6 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-black tracking-tight">Acessar Conta</CardTitle>
            {hasBiometrics && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10.5px] font-extrabold">
                <Fingerprint className="w-3 h-3" />
                {bioLabel.name}
              </span>
            )}
          </div>
          <CardDescription className="text-xs text-muted-foreground pt-1">
            {hasBiometrics 
              ? 'Use sua biometria para acesso instantâneo ou entre com email e senha.'
              : 'Entre com seu email e senha para acessar o painel financeiro.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 pt-0 space-y-4">
          {/* Biometric One-Tap Quick Login Button */}
          {hasBiometrics && (
            <div className="space-y-3 p-4 rounded-2xl bg-linear-to-br from-indigo-500/10 via-indigo-600/5 to-emerald-500/10 border border-indigo-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
                  <Fingerprint className="w-5 h-5 animate-pulse" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <h4 className="text-xs font-extrabold text-foreground">Acesso Rápido Seguro</h4>
                  <p className="text-[11px] text-muted-foreground truncate">{bioLabel.name} vinculado</p>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleBiometricAuth}
                disabled={bioLoading}
                className="w-full h-11 rounded-xl font-black text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {bioLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Lendo Sensor...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4" />
                    <span>Entrar com {bioLabel.name}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Divider when biometrics is available */}
          {hasBiometrics && (
            <div className="relative flex items-center justify-center my-1">
              <div className="w-full border-t border-border/60" />
              <button
                type="button"
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="absolute px-3 bg-card text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>{showPasswordForm ? 'Ocultar Senha' : 'Ou entrar com Senha'}</span>
              </button>
            </div>
          )}

          {/* Standard Credentials Form */}
          {showPasswordForm && (
            <form onSubmit={handleAuth} className="space-y-4 pt-1 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5" htmlFor="email">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 rounded-xl font-semibold border-border/80 bg-background focus-visible:ring-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5" htmlFor="password">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Senha</span>
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 rounded-xl font-semibold border-border/80 bg-background focus-visible:ring-indigo-500"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 rounded-xl font-extrabold text-xs uppercase tracking-wider bg-foreground text-background hover:bg-foreground/90 transition-all cursor-pointer shadow-sm" 
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar na Conta'}
              </Button>
            </form>
          )}

          {/* Hint for devices that support biometrics but don't have it enabled yet */}
          {!hasBiometrics && isBioAvailable && (
            <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 text-[11px] text-muted-foreground flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>
                Seu aparelho suporta <strong>{bioLabel.name}</strong>. Ative a biometria no <strong>Perfil</strong> após fazer login!
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
