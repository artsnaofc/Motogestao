import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Transaction, UserSettings } from '../types';
import { toast } from '../lib/toast';
import { cacheManager } from '../lib/cacheManager';
import { syncQueueManager } from '../lib/syncQueue';
import { getTodayLocalDateStr } from '../lib/utils';
import { getEffectiveUserId } from '../lib/authUtils';
import {
  isAutoRenewRecurring,
  calculateNextOccurrence,
  hasExistingNextOccurrence,
  buildNextRecurringTransaction,
  generateUUID,
  parseLocalDate,
} from '../lib/recurrenceUtils';
import { format } from 'date-fns';
import { planningStorage } from '../lib/planningStorage';

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
  const transactionsRef = useRef<Transaction[]>(initialTransactions);
  const [settings, setSettings] = useState<UserSettings | null>(initialSettings);
  const [loading, setLoading] = useState(initialLoading);
  const [globalPeriod, setGlobalPeriod] = useState<string>(() => {
    const cached = cacheManager.get<string>('global_period');
    if (cached && typeof cached === 'string') return cached;
    try {
      const stored = localStorage.getItem('financas_pro_raw_global_period');
      if (stored) return stored;
    } catch {}
    return 'last30Days';
  });
  const [hideValues, setHideValues] = useState(() => cacheManager.get<boolean>('privacyMode') === true);
  const [customDateRange, setCustomDateRange] = useState<{ start: string, end: string } | null>(() => {
    const cached = cacheManager.get<{ start: string, end: string }>('custom_date_range');
    if (cached && cached.start && cached.end) return cached;
    try {
      const stored = localStorage.getItem('financas_pro_raw_custom_date_range');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.start && parsed.end) return parsed;
      }
    } catch {}
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
    transactionsRef.current = transactions;
  }, [transactions]);

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

  useEffect(() => {
    cacheManager.set('global_period', globalPeriod, undefined, 'settings');
    try {
      localStorage.setItem('financas_pro_raw_global_period', globalPeriod);
    } catch {}
  }, [globalPeriod]);

  useEffect(() => {
    if (customDateRange && customDateRange.start && customDateRange.end) {
      cacheManager.set('custom_date_range', customDateRange, undefined, 'settings');
      try {
        localStorage.setItem('financas_pro_raw_custom_date_range', JSON.stringify(customDateRange));
      } catch {}
    }
  }, [customDateRange]);

  const refreshData = useCallback(async (silent = false) => {
    if (onRefresh) {
      await onRefresh(silent);
    }
  }, [onRefresh]);

  const updateTransaction = useCallback(async (id: string, updatedFields: Partial<Transaction>, options?: { silent?: boolean }) => {
    const userId = await getEffectiveUserId();
    const currentList = transactionsRef.current;
    const prevTx = currentList.find(t => t.id === id);

    let effectiveUpdatedFields = { ...updatedFields };
    let nextRecurringTx: Transaction | null = null;

    if (prevTx) {
      const mergedTx: Transaction = { ...prevTx, ...updatedFields };
      const transitionedToPaid = prevTx.payment_status === 'pending' && updatedFields.payment_status === 'paid';
      if (transitionedToPaid && isAutoRenewRecurring(mergedTx)) {
        const groupId = mergedTx.recurrence_group_id || generateUUID();
        if (!mergedTx.recurrence_group_id) {
          effectiveUpdatedFields.recurrence_group_id = groupId;
          mergedTx.recurrence_group_id = groupId;
        }
        const baseDate = ((mergedTx.due_date || mergedTx.date || getTodayLocalDateStr()) as string).split('T')[0];
        const nextDate = calculateNextOccurrence(baseDate, mergedTx.recurrence_frequency || 'monthly', 1);
        if (!hasExistingNextOccurrence(currentList, mergedTx, groupId, nextDate)) {
          nextRecurringTx = buildNextRecurringTransaction(mergedTx, nextDate, groupId, userId || mergedTx.user_id);
        }
      }
    }

    const { id: _id, user_id: _uid, created_at: _ca, ...cleanPayload } = effectiveUpdatedFields as any;

    setTransactions(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...effectiveUpdatedFields } : t);
      const newState = nextRecurringTx ? [nextRecurringTx, ...updated] : updated;
      transactionsRef.current = newState;
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

    if (nextRecurringTx) {
      syncQueueManager.enqueue('transactions', 'insert', nextRecurringTx.id, nextRecurringTx);
      const effectiveUidForMap = userId || nextRecurringTx.user_id;
      const linkedCardId =
        nextRecurringTx.card_id ||
        (effectiveUidForMap ? planningStorage.getTxCardMap(effectiveUidForMap)[id] : undefined);
      if (effectiveUidForMap && linkedCardId) {
        planningStorage.linkTxsToCard(effectiveUidForMap, [nextRecurringTx.id], linkedCardId);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('planning_data_synced', { detail: { userId: effectiveUidForMap } }));
        }
      }
      const nextLabel = format(parseLocalDate(nextRecurringTx.date), 'dd/MM/yyyy');
      toast.info(`Próxima conta recorrente agendada para ${nextLabel}!`, { id: 'recurring-next-bill' });
    }
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
