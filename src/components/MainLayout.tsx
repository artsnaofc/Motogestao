import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Home, List, PlusCircle, User, PiggyBank, TrendingUp, Bike, Sparkles, LogOut, ChevronRight, ShieldCheck, Terminal, Cloud, RefreshCw, Truck, Menu, X, Plus, ReceiptText, Scale, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { syncQueueManager, SyncTask } from '../lib/syncQueue';
import { useData } from '../contexts/DataContext';
import { BroadcastBanner } from './BroadcastBanner';
import { MaintenanceGuard } from './MaintenanceGuard';
import { useSessionInactivity } from '../lib/useSessionInactivity';
import { systemSettings } from '../lib/systemSettings';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';
import { toast } from '@/lib/toast';

export interface PageOption {
  path: string;
  label: string;
  shortLabel: string;
  iconName: string;
  desc: string;
}

const ALL_PAGE_OPTIONS: PageOption[] = [
  { path: '/', label: 'Painel Geral', shortLabel: 'Início', iconName: 'Home', desc: 'Visão holística do caixa e metas' },
  { path: '/history', label: 'Extrato & Histórico', shortLabel: 'Extrato', iconName: 'ReceiptText', desc: 'Corridas, fretes e lançamentos' },
  { path: '/freight', label: 'Orçamentos & Veículos', shortLabel: 'Fretes', iconName: 'Truck', desc: 'Calculadora de rotas, frota e propostas' },
  { path: '/reserves', label: 'Reservas Financeiras', shortLabel: 'Reservas', iconName: 'PiggyBank', desc: 'Fundo de emergência e manutenção' },
  { path: '/investments', label: 'Carteira de Ativos', shortLabel: 'Carteira', iconName: 'TrendingUp', desc: 'Ações, FIIs e rebalanceamento' },
  { path: '/profile', label: 'Perfil & Ajustes', shortLabel: 'Perfil', iconName: 'User', desc: 'Categorias e configurações da conta' },
];

const DEFAULT_SLOT_ASSIGNMENTS: Record<string, PageOption> = {
  slot1: ALL_PAGE_OPTIONS[0], // Início
  slot2: ALL_PAGE_OPTIONS[1], // Extrato
  slot4: ALL_PAGE_OPTIONS[2], // Fretes & Veículos
};

export function MainLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [syncQueue, setSyncQueue] = useState<SyncTask[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { settings } = useData();

  // Watch session inactivity according to system settings timeout
  useSessionInactivity();

  React.useEffect(() => {
    return syncQueueManager.subscribe((q) => setSyncQueue(q));
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Customizable Bottom Nav Slots State
  const [slotAssignments, setSlotAssignments] = useState<Record<string, PageOption>>(() => {
    try {
      const stored = localStorage.getItem('app_bottom_nav_slots_v2');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load bottom nav slots', e);
    }
    return DEFAULT_SLOT_ASSIGNMENTS;
  });

  const [clickTracker, setClickTracker] = useState<{ slotId: string; count: number }>({ slotId: '', count: 0 });
  const clickTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [targetSlotToCustomize, setTargetSlotToCustomize] = useState<string | null>(null);

  const getSlotConfig = (slotId: string): PageOption => {
    return slotAssignments[slotId] || DEFAULT_SLOT_ASSIGNMENTS[slotId] || ALL_PAGE_OPTIONS[0];
  };

  const handleSlotTripleClick = (slotId: string, e: React.MouseEvent) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    if (clickTracker.slotId === slotId) {
      const nextCount = clickTracker.count + 1;
      if (nextCount >= 3) {
        e.preventDefault();
        e.stopPropagation();
        setClickTracker({ slotId: '', count: 0 });
        setTargetSlotToCustomize(slotId);
        return;
      }
      setClickTracker({ slotId, count: nextCount });
    } else {
      setClickTracker({ slotId, count: 1 });
    }

    clickTimerRef.current = setTimeout(() => {
      setClickTracker({ slotId: '', count: 0 });
    }, 500);
  };

  const updateSlotAssignment = (slotId: string, option: PageOption) => {
    const updated = { ...slotAssignments, [slotId]: option };
    setSlotAssignments(updated);
    try {
      localStorage.setItem('app_bottom_nav_slots_v2', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save slot assignment', e);
    }
    toast.success(`Botão do slot configurado para "${option.label}"!`);
    setTargetSlotToCustomize(null);
  };

  const resetSlotAssignment = (slotId: string) => {
    const defaultOption = DEFAULT_SLOT_ASSIGNMENTS[slotId] || ALL_PAGE_OPTIONS[0];
    const updated = { ...slotAssignments, [slotId]: defaultOption };
    setSlotAssignments(updated);
    try {
      localStorage.setItem('app_bottom_nav_slots_v2', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to reset slot assignment', e);
    }
    toast.info(`Botão restaurado para o padrão ("${defaultOption.label}")`);
    setTargetSlotToCustomize(null);
  };

  const renderSlotIcon = (iconName: string, className: string = 'w-5 h-5') => {
    switch (iconName) {
      case 'Home': return <Home className={className} />;
      case 'ReceiptText': return <ReceiptText className={className} />;
      case 'Bike': return <Bike className={className} />;
      case 'Truck': return <Truck className={className} />;
      case 'PiggyBank': return <PiggyBank className={className} />;
      case 'TrendingUp': return <TrendingUp className={className} />;
      case 'User': return <User className={className} />;
      case 'ShieldCheck': return <ShieldCheck className={className} />;
      default: return <Sparkles className={className} />;
    }
  };

  const navItems = [
    { path: '/', label: 'Painel Geral', icon: Home, desc: 'Visão holística do caixa' },
    { path: '/history', label: 'Extrato & Histórico', icon: ReceiptText, desc: 'Corridas, fretes e despesas' },
    { path: '/freight', label: 'Orçamentos & Veículos', icon: Truck, desc: 'Calculadora, frota e propostas PDF' },
    { path: '/reserves', label: 'Reservas Financeiras', icon: PiggyBank, desc: 'Fundos de emergência' },
    { path: '/investments', label: 'Carteira de Ativos', icon: TrendingUp, desc: 'Ações e FIIs' },
    ...(settings?.is_admin ? [{ path: '/admin', label: 'Modo Admin', icon: ShieldCheck, desc: 'Gestão e configurações' }] : []),
    { path: '/profile', label: 'Perfil & Ajustes', icon: User, desc: 'Categorias e parâmetros' },
  ];

  const isMoreMenuActive = ['/reserves', '/investments', '/profile', '/admin'].some(p => location.pathname.startsWith(p));

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

  const handleNavigateMobile = (path: string) => {
    setIsMobileMenuOpen(false);
    navigate(path);
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
                const isGaragem = item.path === '/vehicles';
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={(e) => {
                      if (isGaragem) {
                        handleSlotTripleClick('slot4', e);
                      }
                    }}
                    className={`group relative flex items-center justify-between p-3 rounded-2xl transition-all duration-200 ${
                      isActive
                        ? 'bg-primary/10 text-primary font-black border border-primary/25 shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-semibold'
                    }`}
                    title={isGaragem ? "Garagem (Clique 3x para escolher o botão padrão deste slot)" : undefined}
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

            <PWAInstallButton variant="sidebar" />

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

          <div className="flex items-center gap-2">
            <PWAInstallButton variant="header" />

            {syncQueue.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] font-extrabold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0 select-none animate-pulse">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                <span>({syncQueue.length})</span>
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
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full md:pl-64 lg:pl-72 pt-14 md:pt-0 pb-20 md:pb-12 min-h-screen transition-all flex flex-col">
          <BroadcastBanner />
          <div className="flex-1">
            {children || <Outlet />}
          </div>
        </main>

        {/* REFINED MOBILE BOTTOM NAVIGATION (5 Primary Touch Targets) */}
        <nav 
          aria-label="Navegação inferior móvel"
          className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/80 bg-background/95 backdrop-blur-xl z-40 pb-[max(0.35rem,safe-area-inset-bottom)] px-3 py-1.5 shadow-lg select-none touch-manipulation"
        >
          <div className="flex items-center justify-around max-w-md mx-auto">
            {/* Slot 1 */}
            {(() => {
              const conf = getSlotConfig('slot1');
              const isActive = location.pathname === conf.path;
              return (
                <Link 
                  to={conf.path} 
                  onClick={(e) => {
                    setIsMobileMenuOpen(false);
                    handleSlotTripleClick('slot1', e);
                  }}
                  className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all active:scale-95 min-h-[48px] touch-manipulation ${
                    isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={`${conf.label} (Clique 3x para escolher o botão padrão deste slot)`}
                >
                  <div className={`transition-transform ${isActive ? 'scale-110' : ''}`}>
                    {renderSlotIcon(conf.iconName, "w-5 h-5")}
                  </div>
                  <span className="text-[10px] font-semibold mt-0.5 leading-none">{conf.shortLabel}</span>
                </Link>
              );
            })()}

            {/* Slot 2 */}
            {(() => {
              const conf = getSlotConfig('slot2');
              const isActive = location.pathname === conf.path;
              return (
                <Link 
                  to={conf.path} 
                  onClick={(e) => {
                    setIsMobileMenuOpen(false);
                    handleSlotTripleClick('slot2', e);
                  }}
                  className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all active:scale-95 min-h-[48px] touch-manipulation ${
                    isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={`${conf.label} (Clique 3x para escolher o botão padrão deste slot)`}
                >
                  <div className={`transition-transform ${isActive ? 'scale-110' : ''}`}>
                    {renderSlotIcon(conf.iconName, "w-5 h-5")}
                  </div>
                  <span className="text-[10px] font-semibold mt-0.5 leading-none">{conf.shortLabel}</span>
                </Link>
              );
            })()}

            {/* Slot 3 (Central CTA: Lançar) */}
            <div className="flex-1 flex flex-col items-center justify-center -mt-4">
              <Link
                to="/add"
                onClick={() => setIsMobileMenuOpen(false)}
                className="h-12 w-12 rounded-full bg-gradient-to-tr from-primary via-indigo-600 to-indigo-700 text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 active:scale-90 transition-transform ring-4 ring-background touch-manipulation"
                title="Novo Lançamento"
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </Link>
              <span className="text-[9.5px] font-extrabold text-foreground mt-0.5 leading-none">
                Lançar
              </span>
            </div>

            {/* Slot 4 */}
            {(() => {
              const conf = getSlotConfig('slot4');
              const isActive = conf.path === '/' ? location.pathname === '/' : location.pathname.startsWith(conf.path);
              return (
                <Link 
                  to={conf.path} 
                  onClick={(e) => {
                    setIsMobileMenuOpen(false);
                    handleSlotTripleClick('slot4', e);
                  }}
                  className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all active:scale-95 min-h-[48px] touch-manipulation ${
                    isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={`${conf.label} (Clique 3x para escolher o botão padrão deste slot)`}
                >
                  <div className={`transition-transform ${isActive ? 'scale-110' : ''}`}>
                    {renderSlotIcon(conf.iconName, "w-5 h-5")}
                  </div>
                  <span className="text-[10px] font-semibold mt-0.5 leading-none">{conf.shortLabel}</span>
                </Link>
              );
            })()}

            {/* Slot 5 (Mais / Menu Sheet) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
              className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all active:scale-95 min-h-[48px] cursor-pointer relative touch-manipulation ${
                isMoreMenuActive 
                  ? 'text-primary font-bold' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="relative">
                <Menu className={`w-5 h-5 transition-transform ${isMoreMenuActive ? 'scale-110' : ''}`} />
                {isMoreMenuActive && (
                  <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background animate-pulse" />
                )}
              </div>
              <span className="text-[10px] font-semibold mt-0.5 leading-none">Mais</span>
            </button>
          </div>
        </nav>

        {/* MOBILE "MAIS" DRAWER SHEET */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in-50">
            {/* Backdrop click to close */}
            <div className="flex-1 w-full" onClick={() => setIsMobileMenuOpen(false)} />

            {/* Bottom Sheet Modal */}
            <div className="bg-background border-t border-border/80 rounded-t-3xl shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-5 duration-200">
              {/* Handlebar & Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">Menu & Ferramentas</h3>
                    <p className="text-[11px] text-muted-foreground">Acesso rápido aos módulos financeiros</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Menu Options Grid / List using Instant Links */}
              <div className="grid grid-cols-1 gap-2.5">
                {/* Orçamentos de Frete & Frota */}
                <Link
                  to="/freight"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`w-full p-3.5 rounded-2xl border transition-all flex items-center justify-between text-left ${
                    location.pathname === '/freight'
                      ? 'bg-primary/10 border-primary/40 text-primary font-bold shadow-xs'
                      : 'bg-card hover:bg-muted/50 border-border/60 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-500 shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">Orçamentos & Veículos</div>
                      <div className="text-[10.5px] text-muted-foreground">Calculadora de rotas, frota de veículos e propostas PDF</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>

                {/* Reservas */}
                <Link
                  to="/reserves"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`w-full p-3.5 rounded-2xl border transition-all flex items-center justify-between text-left ${
                    location.pathname === '/reserves'
                      ? 'bg-primary/10 border-primary/40 text-primary font-bold shadow-xs'
                      : 'bg-card hover:bg-muted/50 border-border/60 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
                      <PiggyBank className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">Reservas Financeiras</div>
                      <div className="text-[10.5px] text-muted-foreground">Fundo de emergência, IPVA, manutenção e metas</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>

                {/* Ativos / Investimentos */}
                <Link
                  to="/investments"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`w-full p-3.5 rounded-2xl border transition-all flex items-center justify-between text-left ${
                    location.pathname === '/investments'
                      ? 'bg-primary/10 border-primary/40 text-primary font-bold shadow-xs'
                      : 'bg-card hover:bg-muted/50 border-border/60 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">Carteira de Ativos</div>
                      <div className="text-[10.5px] text-muted-foreground">Ações, FIIs, renda fixa e patrimônio líquido</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>

                {/* Perfil & Ajustes */}
                <Link
                  to="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`w-full p-3.5 rounded-2xl border transition-all flex items-center justify-between text-left ${
                    location.pathname === '/profile'
                      ? 'bg-primary/10 border-primary/40 text-primary font-bold shadow-xs'
                      : 'bg-card hover:bg-muted/50 border-border/60 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">Perfil & Preferências</div>
                      <div className="text-[10.5px] text-muted-foreground">Categorias de gastos, metas e dados da conta</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>

                {/* Admin (se admin) */}
                {settings?.is_admin && (
                  <Link
                    to="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`w-full p-3.5 rounded-2xl border transition-all flex items-center justify-between text-left ${
                      location.pathname === '/admin'
                        ? 'bg-primary/10 border-primary/40 text-primary font-bold shadow-xs'
                        : 'bg-card hover:bg-muted/50 border-border/60 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">Painel Administrativo</div>
                        <div className="text-[10.5px] text-muted-foreground">Gestão de usuários, alertas e configurações globais</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </Link>
                )}
                {/* Instalar App no Guidão / Celular */}
                <PWAInstallButton variant="banner" />
              </div>

              {/* Status e Logout */}
              <div className="pt-2 border-t border-border/40 space-y-2">
                <div className="p-3 bg-muted/20 border border-border/50 rounded-2xl flex items-center gap-3">
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
                      {syncQueue.length > 0 ? 'Sincronizando' : 'Sincronização Nuvem'}
                    </span>
                    <span className={`text-xs font-bold truncate block mt-1 ${
                      syncQueue.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {syncQueue.length > 0 ? `${syncQueue.length} registro(s) pendente(s)` : 'Banco Supabase 100% Sincronizado'}
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full rounded-2xl h-11 text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-rose-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da Conta
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* SLOT CUSTOMIZATION MODAL (ACTIVATED VIA TRIPLE CLICK ON ANY TAB SLOT) */}
        {targetSlotToCustomize && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in-50">
            <div className="relative w-full max-w-md bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-border/50 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-foreground">
                      Configurar Botão Padrão
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Escolha qual página será aberta por padrão neste slot da barra
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTargetSlotToCustomize(null)}
                  className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Page Options List */}
              <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2">
                {ALL_PAGE_OPTIONS.map((page) => {
                  const currentAssigned = getSlotConfig(targetSlotToCustomize);
                  const isSelected = currentAssigned.path === page.path;
                  return (
                    <button
                      key={page.path}
                      type="button"
                      onClick={() => updateSlotAssignment(targetSlotToCustomize, page)}
                      className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-primary/10 border-primary/50 text-primary font-black shadow-2xs'
                          : 'bg-card hover:bg-muted/60 border-border/70 text-foreground font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2.5 rounded-xl shrink-0 ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          {renderSlotIcon(page.iconName, 'w-4 h-4')}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold truncate flex items-center gap-2">
                            {page.label}
                            {isSelected && (
                              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[9px] font-extrabold">
                                Padrão Atual
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-muted-foreground truncate">{page.desc}</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                    </button>
                  );
                })}
              </div>

              {/* Modal Footer: Restore Default Button */}
              <div className="p-4 border-t border-border/40 bg-muted/10 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => resetSlotAssignment(targetSlotToCustomize)}
                  className="rounded-2xl text-xs font-bold gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar Padrão do Slot
                </Button>
                <Button
                  type="button"
                  onClick={() => setTargetSlotToCustomize(null)}
                  className="rounded-2xl text-xs font-bold px-4 h-9 cursor-pointer"
                >
                  Concluir
                </Button>
              </div>
            </div>
          </div>
        )}

        <OfflineIndicator />
      </div>
    </MaintenanceGuard>
  );
}


