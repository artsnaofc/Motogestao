import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, List, PlusCircle, User, PiggyBank, TrendingUp, Bike, Sparkles, LogOut, ChevronRight, ShieldCheck, Terminal, Cloud, RefreshCw, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { syncQueueManager, SyncTask } from '../lib/syncQueue';
import { useData } from '../contexts/DataContext';
import { BroadcastBanner } from './BroadcastBanner';
import { MaintenanceGuard } from './MaintenanceGuard';
import { useSessionInactivity } from '../lib/useSessionInactivity';
import { systemSettings } from '../lib/systemSettings';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [syncQueue, setSyncQueue] = React.useState<SyncTask[]>([]);
  const { settings } = useData();

  // Watch session inactivity according to system settings timeout
  useSessionInactivity();

  React.useEffect(() => {
    return syncQueueManager.subscribe((q) => setSyncQueue(q));
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { path: '/', label: 'Painel Geral', icon: Home, desc: 'Visão holística do caixa' },
    { path: '/freight', label: 'Orçamentos de Frete', icon: Truck, desc: 'Calculadora e propostas PDF' },
    { path: '/history', label: 'Extrato & Histórico', icon: List, desc: 'Corridas, fretes e despesas' },
    { path: '/reserves', label: 'Reservas Financeiras', icon: PiggyBank, desc: 'Fundos de emergência' },
    { path: '/investments', label: 'Carteira de Ativos', icon: TrendingUp, desc: 'Ações e FIIs' },
    ...(settings?.is_admin ? [{ path: '/admin', label: 'Modo Admin', icon: ShieldCheck, desc: 'Gestão e configurações' }] : []),
    { path: '/profile', label: 'Perfil & Ajustes', icon: User, desc: 'Categorias e parâmetros' },
  ];

  const handleLogoClick = () => {
    const config = systemSettings.getConfig();
    if (config.restrictDebugConsoleToSuperAdmin && !settings?.is_admin) {
      return;
    }

    const nextCount = (window as any).__logo_clicks = ((window as any).__logo_clicks || 0) + 1;
    if (nextCount >= 3) {
      window.dispatchEvent(new CustomEvent('toggle-debug-console'));
      (window as any).__logo_clicks = 0;
    } else {
      setTimeout(() => { (window as any).__logo_clicks = 0; }, 2000);
    }
  };

  const handleMobileLogoClick = () => {
    const config = systemSettings.getConfig();
    if (config.restrictDebugConsoleToSuperAdmin && !settings?.is_admin) {
      return;
    }

    const nextCount = (window as any).__logo_clicks_mobile = ((window as any).__logo_clicks_mobile || 0) + 1;
    if (nextCount >= 3) {
      window.dispatchEvent(new CustomEvent('toggle-debug-console'));
      (window as any).__logo_clicks_mobile = 0;
    } else {
      setTimeout(() => { (window as any).__logo_clicks_mobile = 0; }, 2000);
    }
  };

  return (
    <MaintenanceGuard>
      <div className="flex min-h-screen bg-background text-foreground font-sans">
        {/* Desktop & Tablet Sidebar (Hidden on Mobile) */}
        <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 lg:w-72 border-r border-border/70 bg-card/75 backdrop-blur-xl z-40 p-5 justify-between">
          <div className="space-y-6">
            {/* Logo & Brand Badge */}
            <div 
              onClick={handleLogoClick}
              className="flex items-center gap-3 px-2 pt-1 pb-2 border-b border-border/40 cursor-pointer select-none"
              title="Clique 3 vezes para abrir o console de debug"
            >
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 shrink-0">
                <Bike className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h2 className="text-base font-black tracking-tight text-foreground flex items-center gap-1.5 leading-none">
                  Finanças Pro
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                </h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  Gestão Executiva
                </p>
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="px-1">
              <Button
                onClick={() => navigate('/add')}
                className="w-full rounded-2xl h-11 font-extrabold text-xs bg-gradient-to-r from-primary via-indigo-600 to-indigo-700 hover:from-primary/90 hover:to-indigo-800 text-primary-foreground shadow-md shadow-primary/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Novo Lançamento
              </Button>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1.5">
              <p className="px-3 text-[10px] font-extrabold text-muted-foreground/70 uppercase tracking-widest mb-2">
                Menu Principal
              </p>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group relative flex items-center justify-between p-3 rounded-2xl transition-all duration-200 ${
                      isActive
                        ? 'bg-primary/10 text-primary font-black border border-primary/25 shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-2xs'
                            : 'bg-muted/50 group-hover:bg-muted text-muted-foreground group-hover:text-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden leading-tight">
                        <span className="text-xs truncate block">{item.label}</span>
                        <span className="text-[9.5px] text-muted-foreground/80 font-normal truncate block group-hover:text-muted-foreground">
                          {item.desc}
                        </span>
                      </div>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-primary shrink-0 ml-1" />}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer Card */}
          <div className="pt-4 border-t border-border/40 space-y-3">
            <div className="p-3.5 bg-muted/20 border border-border/50 rounded-2xl flex items-center gap-3">
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                syncQueue.length > 0 
                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' 
                  : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
              }`}>
                {syncQueue.length > 0 ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
              </div>
              <div className="overflow-hidden flex-1 leading-none">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                  {syncQueue.length > 0 ? 'Sincronizando' : 'Sistema Ativo'}
                </span>
                <span className={`text-xs font-bold truncate block mt-1 ${
                  syncQueue.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {syncQueue.length > 0 
                    ? `${syncQueue.length} pendente(s)` 
                    : 'Sincronizado na Nuvem'}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full rounded-xl h-9 text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-rose-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair da Conta
            </Button>
          </div>
        </aside>

        {/* Mobile Top Header (Sticky on Mobile) */}
        <header className="md:hidden fixed top-0 left-0 right-0 h-14 border-b border-border bg-background/80 backdrop-blur-md z-40 px-4 flex items-center justify-between">
          <div 
            onClick={handleMobileLogoClick}
            className="flex items-center gap-2 select-none cursor-pointer"
            title="Clique 3 vezes para abrir o console de debug"
          >
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-primary-foreground shadow-xs shrink-0">
              <Bike className="w-4 h-4" />
            </div>
            <span className="text-sm font-black tracking-tight text-foreground flex items-center gap-1">
              Finanças Pro
              <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
            </span>
          </div>

          {syncQueue.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] font-extrabold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0 select-none animate-pulse">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              <span>Sincronizando ({syncQueue.length})</span>
            </div>
          )}

          {settings?.is_admin && (
            <Link 
              to="/admin"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center border border-border/40"
              title="Painel Administrativo"
            >
              <ShieldCheck className="w-4 h-4 text-primary" />
            </Link>
          )}
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full md:pl-64 lg:pl-72 pt-14 md:pt-0 pb-24 md:pb-12 min-h-screen transition-all flex flex-col">
          <BroadcastBanner />
          <div className="flex-1">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation (Visible strictly on mobile < md) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background flex items-center justify-around p-2 z-40 pb-[max(0.5rem,safe-area-inset-bottom)]">
          <Link to="/" className={`flex flex-col items-center p-2 rounded-lg transition-colors min-w-[44px] ${location.pathname === '/' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Home className="w-5 h-5" />
            <span className="text-[9px] font-medium mt-0.5">Início</span>
          </Link>
          <Link to="/freight" className={`flex flex-col items-center p-2 rounded-lg transition-colors min-w-[44px] ${location.pathname === '/freight' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Truck className="w-5 h-5" />
            <span className="text-[9px] font-medium mt-0.5">Frete</span>
          </Link>
          <Link to="/history" className={`flex flex-col items-center p-2 rounded-lg transition-colors min-w-[44px] ${location.pathname === '/history' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <List className="w-5 h-5" />
            <span className="text-[9px] font-medium mt-0.5">Extrato</span>
          </Link>
          <Link to="/add" className={`flex flex-col items-center p-2 rounded-lg transition-colors min-w-[44px] ${location.pathname === '/add' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <PlusCircle className="w-5 h-5" />
            <span className="text-[9px] font-medium mt-0.5">Lançar</span>
          </Link>
          <Link to="/reserves" className={`flex flex-col items-center p-2 rounded-lg transition-colors min-w-[44px] ${location.pathname === '/reserves' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <PiggyBank className="w-5 h-5" />
            <span className="text-[9px] font-medium mt-0.5">Reservas</span>
          </Link>
          <Link to="/profile" className={`flex flex-col items-center p-2 rounded-lg transition-colors min-w-[44px] ${location.pathname === '/profile' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <User className="w-5 h-5" />
            <span className="text-[9px] font-medium mt-0.5">Perfil</span>
          </Link>
        </div>
      </div>
    </MaintenanceGuard>
  );
}


