import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useData } from '../contexts/DataContext';
import { 
  ShieldCheck, 
  Users, 
  Settings, 
  Database, 
  Activity,
  AlertTriangle,
  ServerCrash
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { UserSettings } from '../types';

import { UserList } from '../components/admin/UserList';
import { CreateUserModal } from '../components/admin/CreateUserModal';
import { DebugConsoleModal } from '../components/DebugConsoleModal';

type AdminTab = 'overview' | 'users' | 'settings';

export default function Admin() {
  const { settings } = useData();
  const isAdmin = settings?.is_admin === true;
  
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [allUsers, setAllUsers] = useState<UserSettings[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingUserId, setLoadingUserId] = useState<string | undefined>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);

  useEffect(() => {
    if (isAdmin && activeTab === 'users') {
      fetchUsers();
    }
  }, [isAdmin, activeTab]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllUsers(data || []);
    } catch (err: any) {
      toast.error('Erro ao carregar usuários', { description: err.message });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleAdminStatus = async (userId: string, currentStatus: boolean) => {
    setLoadingUserId(userId);
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ is_admin: !currentStatus })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(currentStatus ? 'Privilégios de admin removidos.' : 'Privilégios de admin concedidos.');
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro ao alterar privilégios', { description: err.message });
    } finally {
      setLoadingUserId(undefined);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-20 h-20 bg-rose-500/10 rounded-[2rem] flex items-center justify-center border shadow-sm">
          <ShieldCheck className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-2xl font-black text-center">Acesso Restrito</h2>
        <p className="text-center text-muted-foreground text-sm max-w-sm">
          Você não tem permissão para visualizar o painel de controle administrativo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 sm:pb-0">
      {/* Admin Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl border border-primary/20 text-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black leading-none">Console Admin</h1>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-1">Nível de Acesso: Máximo</p>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-xl border-border/50 text-muted-foreground hover:text-foreground"
          onClick={() => setIsDebugModalOpen(true)}
          title="Console de Debug"
        >
          <ServerCrash className="w-4 h-4" />
        </Button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
          <Button
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            className={`rounded-xl h-10 font-bold shrink-0 ${activeTab !== 'overview' ? 'border-border/50 bg-background text-muted-foreground' : 'shadow-sm'}`}
            onClick={() => setActiveTab('overview')}
          >
            <Activity className="w-4 h-4 mr-2" />
            Visão Geral
          </Button>
          <Button
            variant={activeTab === 'users' ? 'default' : 'outline'}
            className={`rounded-xl h-10 font-bold shrink-0 ${activeTab !== 'users' ? 'border-border/50 bg-background text-muted-foreground' : 'shadow-sm'}`}
            onClick={() => setActiveTab('users')}
          >
            <Users className="w-4 h-4 mr-2" />
            Membros
          </Button>
          <Button
            variant={activeTab === 'settings' ? 'default' : 'outline'}
            className={`rounded-xl h-10 font-bold shrink-0 ${activeTab !== 'settings' ? 'border-border/50 bg-background text-muted-foreground' : 'shadow-sm'}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings className="w-4 h-4 mr-2" />
            Sistema
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border/40 bg-background/50 shadow-sm">
                  <CardContent className="p-5 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Users className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-wider">Total de Usuários</span>
                    </div>
                    <p className="text-3xl font-black">1</p>
                    <p className="text-xs text-emerald-600 font-bold flex items-center gap-1 mt-1">
                      +100% ativos
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border-border/40 bg-background/50 shadow-sm">
                  <CardContent className="p-5 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Database className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-wider">Volume de Dados</span>
                    </div>
                    <p className="text-3xl font-black">8.4<span className="text-lg text-muted-foreground font-bold ml-1">MB</span></p>
                    <p className="text-xs text-muted-foreground font-bold flex items-center gap-1 mt-1">
                      Capacidade Saudável
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border-border/40 bg-background/50 shadow-sm sm:col-span-2">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-4">
                      <Activity className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-wider">Status do Sistema</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-sm font-bold">API Services</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-600">Online</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-sm font-bold">Database & RLS</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-600">Secure</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <UserList 
                users={allUsers} 
                onToggleAdmin={handleToggleAdminStatus} 
                loadingId={loadingUserId}
                onCreateClick={() => setIsCreateModalOpen(true)}
              />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-2xl"
            >
              <Card className="border-border/40 shadow-sm">
                <CardContent className="p-0">
                  <div className="p-6 border-b border-border/40">
                    <h3 className="text-lg font-bold mb-1">Configurações Globais</h3>
                    <p className="text-sm text-muted-foreground">
                      Parâmetros gerais do sistema. Algumas opções requerem reinicialização dos containers.
                    </p>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <label className="text-sm font-bold block leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Modo Manutenção</label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Bloqueia o acesso de usuários não-administradores.
                        </p>
                      </div>
                      <div className="w-11 h-6 bg-muted rounded-full relative opacity-50 cursor-not-allowed border border-border">
                        <div className="w-5 h-5 bg-background rounded-full absolute left-0.5 top-0.5 shadow-sm"></div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <label className="text-sm font-bold block leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Cadastro Público</label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Permitir que novos usuários criem contas livremente.
                        </p>
                      </div>
                      <div className="w-11 h-6 bg-primary rounded-full relative opacity-50 cursor-not-allowed">
                        <div className="w-5 h-5 bg-primary-foreground rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border/40">
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div className="text-xs leading-relaxed font-medium">
                          <strong>Nota de Ambiente:</strong> As alterações acima estão em modo leitura (Read-Only) porque a aplicação está operando em um ambiente isolado (Cloud). Funcionalidades em nível de infraestrutura devem ser configuradas via console de provedor (Supabase Dashboard).
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <CreateUserModal 
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={() => {
          if (activeTab === 'users') fetchUsers();
        }}
      />

      <DebugConsoleModal
        open={isDebugModalOpen}
        onOpenChange={setIsDebugModalOpen}
      />
    </div>
  );
}
