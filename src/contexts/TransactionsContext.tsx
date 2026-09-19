import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Transaction, UserSettings } from '../types';
import { toast } from '../lib/toast';
import { cacheManager } from '../lib/cacheManager';
import { syncQueueManager } from '../lib/syncQueue';
import { getTodayLocalDateStr } from '../lib/utils';
import { getEffectiveUserId } from '../lib/authUtils';

export interface TransactionsContextType {
  transactions: Transaction[];
  updateTransaction: (id: string, transaction: Partial<Transaction>, options?: { silent?: boolean }) => Promise<void>;
  deleteTransaction: (id: string, options?: { silent?: boolean }) => Promise<void>;
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
  const [hideValues, setHideValues] = useState(() => cacheManager.get<boolean>('privacyMode') === true);
  const [customDateRange, setCustomDateRange] = useState<{ start: string, end: string } | null>(() => {
    try {
      const now = new Date();
      const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const endStr = getTodayLocalDateStr(now);
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
    cacheManager.set('privacyMode', hideValues, undefined, 'settings');
  }, [hideValues]);

  const refreshData = useCallback(async (silent = false) => {
    if (onRefresh) {
      await onRefresh(silent);
    }
  }, [onRefresh]);

  const updateTransaction = useCallback(async (id: string, updatedFields: Partial<Transaction>, options?: { silent?: boolean }) => {
    const userId = await getEffectiveUserId();

    const { id: _id, user_id: _uid, created_at: _ca, ...cleanPayload } = updatedFields as any;

    setTransactions(prev => {
      const newState = prev.map(t => t.id === id ? { ...t, ...updatedFields } : t);
      if (userId) {
        cacheManager.set(`transactions_${userId}`, newState, undefined, 'transactions');
      }
      cacheManager.set('last_known_transactions', newState, undefined, 'transactions');
      return newState;
    });

    if (!options?.silent) {
      toast.success('Lançamento atualizado!', { id: 'tx-action' });
    }

    // Always push to sync queue
    syncQueueManager.enqueue('transactions', 'update', id, cleanPayload);
  }, []);

  const deleteTransaction = useCallback(async (id: string, options?: { silent?: boolean }) => {
    const userId = await getEffectiveUserId();

    setTransactions(prev => {
      const newState = prev.filter(t => t.id !== id);
      if (userId) {
        cacheManager.set(`transactions_${userId}`, newState, undefined, 'transactions');
      }
      cacheManager.set('last_known_transactions', newState, undefined, 'transactions');
      return newState;
    });

    if (!options?.silent) {
      toast.success('Lançamento excluído!', { id: 'tx-action' });
    }

    // Always push to sync queue
    syncQueueManager.enqueue('transactions', 'delete', id);
  }, []);

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
