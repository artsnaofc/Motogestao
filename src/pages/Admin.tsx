import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useData } from '../contexts/DataContext';
import { 
  ShieldCheck, 
  Users, 
  Settings, 
  Activity,
  ServerCrash,
  Clock,
  Radio,
  FileText,
  Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { UserSettings } from '../types';
import { systemSettings } from '../lib/systemSettings';

import { UserList } from '../components/admin/UserList';
import { CreateUserModal } from '../components/admin/CreateUserModal';
import { UserDetailModal } from '../components/admin/UserDetailModal';
import { EditUserModal } from '../components/admin/EditUserModal';
import { AdminOverview } from '../components/admin/AdminOverview';
import { SystemSettingsTab } from '../components/admin/SystemSettingsTab';
import { DatabaseBackupSuite } from '../components/admin/DatabaseBackupSuite';
import { DebugConsoleModal } from '../components/DebugConsoleModal';

type AdminTab = 'overview' | 'users' | 'settings' | 'backup';

export default function Admin() {
  const { settings } = useData();
  const isAdmin = settings?.is_admin === true;
  
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [allUsers, setAllUsers] = useState<UserSettings[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingUserId, setLoadingUserId] = useState<string | undefined>();
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<UserSettings | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserSettings | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    if (isAdmin) {
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

      const targetUser = allUsers.find(u => u.user_id === userId);
      const actionName = !currentStatus ? 'Promoção para Admin' : 'Revogação de Admin';
      const details = `${targetUser?.full_name || userId} teve privilégios de administrador ${!currentStatus ? 'concedidos' : 'revogados'}.`;

      systemSettings.logAction('Administrador', actionName, details, 'user', 'warn');

      toast.success(currentStatus ? 'Privilégios de admin removidos.' : 'Privilégios de admin concedidos.');
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro ao alterar privilégios', { description: err.message });
    } finally {
      setLoadingUserId(undefined);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const targetUser = allUsers.find(u => u.user_id === userId);
    const userName = targetUser?.full_name || userId;

    if (!confirm(`Atenção: Tem certeza de que deseja excluir as configurações do usuário "${userName}"? Esta ação removerá os parâmetros deste membro.`)) {
      return;
    }

    setLoadingUserId(userId);
    try {
      const { error } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      systemSettings.logAction(
        'Administrador',
        'Exclusão de Membro',
        `Membro ${userName} (${userId}) foi excluído da base de configurações.`,
        'user',
        'error'
      );

      toast.success('Membro excluído com sucesso.');
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro ao excluir membro', { description: err.message });
    } finally {
      setLoadingUserId(undefined);
    }
  };

  const handleOpenDetails = (user: UserSettings) => {
    setDetailUser(user);
    setIsDetailModalOpen(true);
  };

  const handleOpenEdit = (user: UserSettings) => {
    setEditUser(user);
    setIsEditModalOpen(true);
  };

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4 min-h-[70vh]">
        <div className="w-20 h-20 bg-rose-500/10 rounded-[2rem] flex items-center justify-center border border-rose-500/20 shadow-sm">
          <ShieldCheck className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-2xl font-black text-center text-foreground">Acesso Restrito</h2>
        <p className="text-center text-muted-foreground text-sm max-w-sm">
          Você não possui privilégios de administrador para acessar o centro de controle e configurações do sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 sm:pb-8">
      {/* Admin Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-2xl border border-primary/20 text-primary shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black leading-none text-foreground">Painel Administrativo & Telemetria</h1>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-1">
              Controle Geral • Plataforma Finanças Pro
            </p>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-2xl border-border/50 text-muted-foreground hover:text-foreground cursor-pointer shadow-xs"
          onClick={() => setIsDebugModalOpen(true)}
          title="Abrir Console de Diagnóstico & Debug"
        >
          <ServerCrash className="w-4 h-4 text-primary" />
        </Button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-1">
          <Button
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            className={`rounded-2xl h-11 px-4 font-bold shrink-0 cursor-pointer transition-all ${
              activeTab !== 'overview' ? 'border-border/50 bg-background text-muted-foreground hover:text-foreground' : 'shadow-sm'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            <Activity className="w-4 h-4 mr-2" />
            Visão Geral
          </Button>

          <Button
            variant={activeTab === 'users' ? 'default' : 'outline'}
            className={`rounded-2xl h-11 px-4 font-bold shrink-0 cursor-pointer transition-all ${
              activeTab !== 'users' ? 'border-border/50 bg-background text-muted-foreground hover:text-foreground' : 'shadow-sm'
            }`}
            onClick={() => setActiveTab('users')}
          >
            <Users className="w-4 h-4 mr-2" />
            Membros ({allUsers.length})
          </Button>

          <Button
            variant={activeTab === 'settings' ? 'default' : 'outline'}
            className={`rounded-2xl h-11 px-4 font-bold shrink-0 cursor-pointer transition-all ${
              activeTab !== 'settings' ? 'border-border/50 bg-background text-muted-foreground hover:text-foreground' : 'shadow-sm'
            }`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings className="w-4 h-4 mr-2" />
            Configurações do Sistema
          </Button>

          <Button
            variant={activeTab === 'backup' ? 'default' : 'outline'}
            className={`rounded-2xl h-11 px-4 font-bold shrink-0 cursor-pointer transition-all ${
              activeTab !== 'backup' ? 'border-border/50 bg-background text-muted-foreground hover:text-foreground' : 'shadow-sm'
            }`}
            onClick={() => setActiveTab('backup')}
          >
            <Database className="w-4 h-4 mr-2 text-primary" />
            Backup & Database
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <AdminOverview 
                onNavigateToTab={(tab) => setActiveTab(tab)}
                onOpenCreateUser={() => setIsCreateModalOpen(true)}
              />
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <UserList 
                users={allUsers} 
                onToggleAdmin={handleToggleAdminStatus}
                onDeleteUser={handleDeleteUser}
                onEditUser={handleOpenEdit}
                onViewDetails={handleOpenDetails}
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
              transition={{ duration: 0.15 }}
            >
              <SystemSettingsTab />
            </motion.div>
          )}

          {activeTab === 'backup' && (
            <motion.div
              key="backup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <DatabaseBackupSuite />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Create User Modal */}
      <CreateUserModal 
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={() => {
          fetchUsers();
        }}
      />

      {/* User Ray-X Details Modal */}
      <UserDetailModal
        user={detailUser}
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        onEditClick={handleOpenEdit}
        onToggleAdmin={handleToggleAdminStatus}
        onDeleteClick={handleDeleteUser}
      />

      {/* Edit User Full Modal */}
      <EditUserModal
        user={editUser}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSuccess={() => {
          fetchUsers();
          if (detailUser && editUser && detailUser.user_id === editUser.user_id) {
            // Update detail view if open
            const updated = allUsers.find(u => u.user_id === editUser.user_id);
            if (updated) setDetailUser(updated);
          }
        }}
      />

      {/* Debug Console Modal */}
      <DebugConsoleModal
        open={isDebugModalOpen}
        onOpenChange={setIsDebugModalOpen}
      />
    </div>
  );
}
