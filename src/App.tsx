import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Login } from './pages/Login';
import { DataProvider } from './contexts/DataContext';
import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { setCachedUser, getEffectiveUser } from './lib/authUtils';
import { MainLayout } from './components/MainLayout';
import { PageLoadingFallback } from './components/PageLoadingFallback';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScrollManager } from './components/ScrollManager';
import { DebugConsoleModal } from './components/DebugConsoleModal';

// Helper function for lazy loading with detailed error logging and auto-retry on dynamic chunk failures
const lazyWithLogging = (importFn: () => Promise<any>, moduleExportName: string) =>
  React.lazy(async () => {
    try {
      const module = await importFn();
      return { default: module[moduleExportName] || module.default };
    } catch (error: any) {
      console.group('%c[Finanças Pro - Lazy Load Error]', 'background: #dc2626; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;');
      console.error(`❌ Falha ao carregar o módulo '${moduleExportName}'`);
      console.error('📅 Data/Hora:', new Date().toISOString());
      console.error('🌐 URL Atual:', window.location.href);
      console.error('⚠️ Mensagem de Erro:', error?.message || error);
      console.error('📚 Stack:', error?.stack);
      console.groupEnd();

      // Handle stale chunk reloading once if Vite hot re-build modified chunk paths
      const retryKey = `chunk_retry_${moduleExportName}`;
      const hasRetried = sessionStorage.getItem(retryKey);
      if (!hasRetried) {
        sessionStorage.setItem(retryKey, 'true');
        console.warn(`[Finanças Pro] Recarregando aplicação para recuperar o chunk do módulo '${moduleExportName}'...`);
        window.location.reload();
      }

      throw error;
    }
  });

const Dashboard = lazyWithLogging(() => import('./pages/Dashboard'), 'Dashboard');
const History = lazyWithLogging(() => import('./pages/History'), 'History');
const AddTransaction = lazyWithLogging(() => import('./pages/AddTransaction'), 'AddTransaction');
const Profile = lazyWithLogging(() => import('./pages/Profile'), 'Profile');
const Reserves = lazyWithLogging(() => import('./pages/Reserves'), 'Reserves');
const Investments = lazyWithLogging(() => import('./pages/Investments'), 'Investments');
const Admin = lazyWithLogging(() => import('./pages/Admin'), 'Admin');
const FreightQuotePage = lazyWithLogging(() => import('./pages/FreightQuote'), 'default');

// Auth guard outside App to prevent recreation
const PrivateRoute = ({ session, children }: { session: Session | null; children: React.ReactNode }) => {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDebugModal, setShowDebugModal] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[Finanças Pro - Auth Error] Error getting initial session:', error);
        }
        if (session?.user) {
          setCachedUser({ id: session.user.id, email: session.user.email });
          setSession(session);
        } else {
          // If offline or session returned null, check for cached effective user
          const effUser = await getEffectiveUser();
          if (effUser) {
            setCachedUser(effUser);
            // Construct a lightweight offline session object so PrivateRoute lets the user through
            setSession({
              user: {
                id: effUser.id,
                email: effUser.email,
                app_metadata: {},
                user_metadata: {},
                aud: 'authenticated',
                created_at: new Date().toISOString(),
              },
              access_token: 'offline_token',
              token_type: 'bearer',
              expires_in: 999999,
              refresh_token: 'offline_refresh',
            } as any);
          } else {
            setSession(null);
          }
        }
      } catch (err) {
        console.error('[Finanças Pro - Auth Catch] Failed to check auth session:', err);
        const effUser = await getEffectiveUser();
        if (effUser) {
          setSession({
            user: { id: effUser.id, email: effUser.email },
          } as any);
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Finanças Pro Auth Change] Event: ${event}`, newSession?.user?.email);
      }
      if (newSession?.user) {
        setCachedUser({ id: newSession.user.id, email: newSession.user.email });
      } else if (event === 'SIGNED_OUT') {
        setCachedUser(null);
      }

      setSession(prevSession => {
        if (!newSession && event !== 'SIGNED_OUT' && prevSession?.user) {
          // Keep offline cached session active unless explicit SIGNED_OUT
          return prevSession;
        }
        if (prevSession?.access_token === newSession?.access_token && prevSession?.user?.id === newSession?.user?.id) {
          return prevSession;
        }
        return newSession;
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  // Keyboard shortcut listener for devtools and debug console
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isDKey = e.key === 'd' || e.key === 'D';
      const isPeriodKey = e.key === '.';
      
      const matchShortcut = 
        ((e.ctrlKey || e.metaKey) && e.shiftKey && isDKey) || 
        (e.altKey && e.shiftKey && isDKey) ||
        ((e.ctrlKey || e.metaKey) && isPeriodKey);

      if (matchShortcut) {
        e.preventDefault();
        setShowDebugModal(prev => !prev);
        console.log('[Finanças Pro] Central de Debug ativada por atalho.');
      }
    };

    const handleCustomToggle = () => {
      setShowDebugModal(prev => !prev);
      console.log('[Finanças Pro] Central de Debug ativada por evento customizado.');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('toggle-debug-console', handleCustomToggle);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('toggle-debug-console', handleCustomToggle);
    };
  }, []);

  const renderContent = () => {
    if (loading) {
      return <PageLoadingFallback />;
    }

    return (
      <BrowserRouter>
        <ScrollManager />
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/" replace />} />
          <Route
            path="/*"
            element={
              <PrivateRoute session={session}>
                <DataProvider>
                  <MainLayout>
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoadingFallback />}>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/history" element={<History />} />
                          <Route path="/add" element={<AddTransaction />} />
                          <Route path="/add-transaction" element={<AddTransaction />} />
                          <Route path="/freight" element={<FreightQuotePage />} />
                          <Route path="/reserves" element={<Reserves />} />
                          <Route path="/investments" element={<Investments />} />
                          <Route path="/admin" element={<Admin />} />
                          <Route path="/profile" element={<Profile />} />
                        </Routes>
                      </Suspense>
                    </ErrorBoundary>
                  </MainLayout>
                </DataProvider>
              </PrivateRoute>
            }
          />
        </Routes>
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    );
  };

  return (
    <ErrorBoundary>
      {renderContent()}
      <DebugConsoleModal open={showDebugModal} onOpenChange={setShowDebugModal} />
    </ErrorBoundary>
  );
}

