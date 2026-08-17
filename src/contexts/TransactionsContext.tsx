import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Transaction, UserSettings } from '../types';
import { toast } from 'sonner';

export interface TransactionsContextType {
  transactions: Transaction[];
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  settings: UserSettings | null;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings | null>>;
  loading: boolean;
  refreshData: (silent?: boolean) => Promise<void>;
  globalPeriod: string;
  setGlobalPeriod: (period: string) => void;
  customDateRange: { start: string, end: string } | null;
  setCustomDateRange: (range: { start: string, end: string } | null) => void;
  hideValues: boolean;
  setHideValues: (hide: boolean) => void;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
}

const TransactionsContext = createContext<TransactionsContextType | undefined>(undefined);

export function TransactionsProvider({
  children,
  initialTransactions = [],
  initialSettings = null,
  initialLoading = false,
  onRefresh
}: {
  children: ReactNode;
  initialTransactions?: Transaction[];
  initialSettings?: UserSettings | null;
  initialLoading?: boolean;
  onRefresh?: (silent?: boolean) => Promise<void>;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [settings, setSettings] = useState<UserSettings | null>(initialSettings);
  const [loading, setLoading] = useState(initialLoading);
  const [globalPeriod, setGlobalPeriod] = useState('last30Days');
  const [hideValues, setHideValues] = useState(() => localStorage.getItem('privacyMode') === 'true');
  const [customDateRange, setCustomDateRange] = useState<{ start: string, end: string } | null>(() => {
    try {
      const now = new Date();
      const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endStr = now.toISOString().split('T')[0];
      return { start: startStr, end: endStr };
    } catch {
      return null;
    }
  });

  useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    setLoading(initialLoading);
  }, [initialLoading]);

  useEffect(() => {
    localStorage.setItem('privacyMode', String(hideValues));
  }, [hideValues]);

  const refreshData = useCallback(async (silent = false) => {
    if (onRefresh) {
      await onRefresh(silent);
    }
  }, [onRefresh]);

  const updateTransaction = useCallback(async (id: string, updatedFields: Partial<Transaction>) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const { id: _id, user_id: _uid, created_at: _ca, ...cleanPayload } = updatedFields as any;

    setTransactions(prev => {
      const newState = prev.map(t => t.id === id ? { ...t, ...updatedFields } : t);
      if (userId) {
        localStorage.setItem(`transactions_${userId}`, JSON.stringify(newState));
      }
      return newState;
    });

    if (userId) {
      try {
        const { error } = await supabase
          .from('transactions')
          .update(cleanPayload)
          .eq('id', id);

        if (error) {
          console.warn('Supabase transaction update failed, updated locally:', error);
          toast.success('Lançamento atualizado (salvo localmente)!');
        } else {
          toast.success('Lançamento atualizado com sucesso!');
        }
        if (onRefresh) await onRefresh(true);
      } catch (err) {
        console.warn('Supabase transaction update failed:', err);
        toast.success('Lançamento atualizado (localmente)!');
      }
    } else {
      toast.success('Lançamento atualizado!');
    }
  }, [onRefresh]);

  const deleteTransaction = useCallback(async (id: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    setTransactions(prev => {
      const newState = prev.filter(t => t.id !== id);
      if (userId) {
        localStorage.setItem(`transactions_${userId}`, JSON.stringify(newState));
      }
      return newState;
    });

    if (userId) {
      try {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id);

        if (error) {
          console.warn('Supabase transaction delete failed, deleted locally:', error);
          toast.success('Lançamento excluído (localmente)!');
        } else {
          toast.success('Lançamento excluído com sucesso!');
        }
        if (onRefresh) await onRefresh(true);
      } catch (err) {
        console.warn('Supabase transaction delete failed:', err);
        toast.success('Lançamento excluído (localmente)!');
      }
    } else {
      toast.success('Lançamento excluído!');
    }
  }, [onRefresh]);

  const value = useMemo<TransactionsContextType>(() => ({
    transactions,
    updateTransaction,
    deleteTransaction,
    settings,
    setSettings,
    loading,
    refreshData,
    globalPeriod,
    setGlobalPeriod,
    customDateRange,
    setCustomDateRange,
    hideValues,
    setHideValues,
    setTransactions,
  }), [
    transactions,
    updateTransaction,
    deleteTransaction,
    settings,
    loading,
    refreshData,
    globalPeriod,
    customDateRange,
    hideValues,
  ]);

  return (
    <TransactionsContext.Provider value={value}>
      {children}
    </TransactionsContext.Provider>
  );
}

export function useTransactions(): TransactionsContextType {
  const context = useContext(TransactionsContext);
  if (context === undefined) {
    throw new Error('useTransactions must be used within a TransactionsProvider');
  }
  return context;
}
