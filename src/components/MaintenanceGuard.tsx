import React, { useState, useEffect } from 'react';
import { systemSettings, SystemConfig } from '../lib/systemSettings';
import { useData } from '../contexts/DataContext';
import { 
  Wrench, 
  RefreshCw, 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  Power,
  Server
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';

export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { settings, refreshData } = useData();
  const isAdmin = settings?.is_admin === true;

  const [config, setConfig] = useState<SystemConfig>(() => systemSettings.getConfig());
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const handleConfigChange = (e: any) => {
      if (e.detail) {
        setConfig(e.detail);
      }
    };
    window.addEventListener('system-config-changed', handleConfigChange);

    // Periodic check every 20 seconds
    const interval = setInterval(() => {
      setConfig(systemSettings.getConfig());
    }, 20000);

    return () => {
      window.removeEventListener('system-config-changed', handleConfigChange);
      clearInterval(interval);
    };
  }, []);

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      await refreshData(true);
      setConfig(systemSettings.getConfig());
      toast.info('Status verificado.', {
        description: systemSettings.getConfig().maintenanceMode 
          ? 'O sistema ainda está em manutenção preventiva.' 
          : 'Sistema operando normalmente!',
      });
    } catch (e: any) {
      toast.error('Erro ao verificar status', { description: e.message });
    } finally {
      setChecking(false);
    }
  };

  const handleDisableMaintenanceByAdmin = () => {
    systemSettings.updateConfig({ maintenanceMode: false }, 'Administrador');
    toast.success('Modo de manutenção desativado!', {
      description: 'O acesso foi liberado para todos os membros.',
    });
  };

  // If maintenance mode is ON and user is NOT admin -> Show full-screen Maintenance View
  if (config.maintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="max-w-md w-full p-8 rounded-3xl bg-card border border-border/60 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
            <Wrench className="w-10 h-10 animate-bounce" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              <Clock className="w-3.5 h-3.5" />
              Manutenção Preventiva
            </div>
            <h2 className="text-2xl font-black text-foreground">
              {config.appName} em Atualização
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {config.maintenanceMessage || 'Estamos realizando melhorias na infraestrutura para aprimorar sua experiência. Retornaremos em instantes.'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 text-xs text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <Server className="w-4 h-4 text-primary" />
              Status dos Servidores
            </span>
            <span className="font-bold text-amber-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              Atualizando
            </span>
          </div>

          <Button
            onClick={handleManualCheck}
            disabled={checking}
            className="w-full h-11 rounded-2xl font-bold text-sm shadow-md gap-2 cursor-pointer bg-primary text-primary-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Verificando Conexão...' : 'Tentar Conectar Novamente'}
          </Button>

          <p className="text-[11px] text-muted-foreground/60 font-medium">
            Se você for um administrador da plataforma, realize login com sua conta administrativa para continuar.
          </p>
        </div>
      </div>
    );
  }

  // If maintenance mode is ON and user IS admin -> Render children with a persistent Top Warning Banner
  return (
    <>
      {config.maintenanceMode && isAdmin && (
        <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 text-xs font-black flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>MODO DE MANUTENÇÃO ATIVO — O sistema está bloqueado para usuários não-administradores.</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDisableMaintenanceByAdmin}
            className="h-7 px-3 bg-amber-950 text-amber-100 hover:bg-amber-900 border-none text-[11px] font-bold rounded-xl cursor-pointer"
          >
            <Power className="w-3.5 h-3.5 mr-1" />
            Desativar Modo de Manutenção
          </Button>
        </div>
      )}
      {children}
    </>
  );
}
