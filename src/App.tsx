import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Login } from './pages/Login';
import { DataProvider } from './contexts/DataContext';
import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { MainLayout } from './components/MainLayout';
import { PageLoadingFallback } from './components/PageLoadingFallback';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScrollManager } from './components/ScrollManager';

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('[Finanças Pro - Auth Error] Error getting initial session:', error);
      }
      setSession(session);
      setLoading(false);
    }).catch(err => {
      console.error('[Finanças Pro - Auth Catch] Failed to check auth session:', err);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Finanças Pro Auth Change] Event: ${event}`, session?.user?.email);
      }
      setSession(prevSession => {
        if (prevSession?.access_token === session?.access_token && prevSession?.user?.id === session?.user?.id) {
          return prevSession;
        }
        return session;
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <PageLoadingFallback />;
  }

  return (
    <ErrorBoundary>
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
                          <Route path="/reserves" element={<Reserves />} />
                          <Route path="/investments" element={<Investments />} />
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
    </ErrorBoundary>
  );
}

