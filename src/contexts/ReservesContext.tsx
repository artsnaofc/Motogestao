import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Reserve, ReserveTransaction } from '../types';
import { toast } from '../lib/toast';
import { cacheManager } from '../lib/cacheManager';
import { syncQueueManager } from '../lib/syncQueue';
import { getEffectiveUserId } from '../lib/authUtils';
import { getTodayLocalDateStr } from '../lib/utils';
import {
  isAutoRenewRecurring,
  calculateNextOccurrence,
  hasExistingNextOccurrence,
  buildNextRecurringReserveTransaction,
  parseLocalDate,
} from '../lib/recurrenceUtils';
import { format } from 'date-fns';
import { planningStorage } from '../lib/planningStorage';

export interface ReservesContextType {
  reserves: Reserve[];
  reserveTransactions: ReserveTransaction[];
  addReserve: (reserve: Omit<Reserve, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateReserve: (id: string, reserve: Partial<Reserve>) => Promise<void>;
  deleteReserve: (id: string) => Promise<void>;
  addReserveTransaction: (rt: Omit<ReserveTransaction, 'id' | 'user_id' | 'created_at'>, options?: { silent?: boolean }) => Promise<string | undefined>;
  deleteReserveTransaction: (id: string, options?: { silent?: boolean }) => Promise<void>;
  updateReserveTransaction: (id: string, rt: Partial<ReserveTransaction>, options?: { silent?: boolean }) => Promise<void>;
  setReserves: React.Dispatch<React.SetStateAction<Reserve[]>>;
  setReserveTransactions: React.Dispatch<React.SetStateAction<ReserveTransaction[]>>;
}

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const ReservesContext = createContext<ReservesContextType | undefined>(undefined);

export function ReservesProvider({ 
  children,
  initialReserves = [],
  initialReserveTransactions = [],
  onDataChange
}: { 
  children: ReactNode;
  initialReserves?: Reserve[];
  initialReserveTransactions?: ReserveTransaction[];
  onDataChange?: () => Promise<void>;
}) {
  const [reserves, setReserves] = useState<Reserve[]>(initialReserves);
  const [reserveTransactions, setReserveTransactions] = useState<ReserveTransaction[]>(initialReserveTransactions);
  const reserveTransactionsRef = useRef<ReserveTransaction[]>(initialReserveTransactions);

  // Synchronize when initial props change
  useEffect(() => {
    setReserves(initialReserves);
  }, [initialReserves]);

  useEffect(() => {
    setReserveTransactions(initialReserveTransactions);
  }, [initialReserveTransactions]);

  useEffect(() => {
    reserveTransactionsRef.current = reserveTransactions;
  }, [reserveTransactions]);

  const persistBoostSetting = (userId: string, reserveId: string, fields: Partial<Reserve>) => {
    if (
      fields.boost_ativo === undefined &&
      fields.boost_tipo === undefined &&
      fields.boost_valor === undefined &&
      fields.reset_suggestion_on_withdraw === undefined
    ) {
      return;
    }
    try {
      const raw = localStorage.getItem(`reserve_boost_map_${userId}`);
      const currentMap: Record<string, {
        boost_ativo?: boolean;
        boost_tipo?: Reserve['boost_tipo'];
        boost_valor?: number | null;
        reset_suggestion_on_withdraw?: boolean;
      }> = raw ? JSON.parse(raw) : {};
      const prevEntry = currentMap[reserveId] || {};
      currentMap[reserveId] = {
        boost_ativo: fields.boost_ativo !== undefined ? fields.boost_ativo : prevEntry.boost_ativo,
        boost_tipo: fields.boost_tipo !== undefined ? fields.boost_tipo : prevEntry.boost_tipo,
        boost_valor: fields.boost_valor !== undefined ? fields.boost_valor : prevEntry.boost_valor,
        reset_suggestion_on_withdraw:
          fields.reset_suggestion_on_withdraw !== undefined
            ? fields.reset_suggestion_on_withdraw
            : prevEntry.reset_suggestion_on_withdraw,
      };
      localStorage.setItem(`reserve_boost_map_${userId}`, JSON.stringify(currentMap));
      cacheManager.set(`reserve_boost_map_${userId}`, currentMap, undefined, 'reserves');
    } catch {}
  };

  const persistBoostExtra = (userId: string, rtId: string, boostExtra?: number) => {
    if (boostExtra === undefined) return;
    try {
      const raw = localStorage.getItem(`boost_aporte_extras_map_${userId}`);
      const currentMap: Record<string, number> = raw ? JSON.parse(raw) : {};
      if (boostExtra > 0) {
        currentMap[rtId] = Math.round(boostExtra * 100) / 100;
      } else {
        delete currentMap[rtId];
      }
      localStorage.setItem(`boost_aporte_extras_map_${userId}`, JSON.stringify(currentMap));
      cacheManager.set(`boost_aporte_extras_map_${userId}`, currentMap, undefined, 'reserves');
    } catch {}
  };

  const addReserve = useCallback(async (newRes: Omit<Reserve, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const userId = await getEffectiveUserId();
    if (!userId) return;

    const resObj: Reserve = {
      id: generateUUID(),
      user_id: userId,
      ...newRes,
      regra_inicio_validade: newRes.regra_inicio_validade || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { saldo_atual, ...supabasePayload } = resObj;
    persistBoostSetting(userId, resObj.id, resObj);
    
    setReserves(prev => {
      const existing = [...prev, resObj];
      cacheManager.set(`reserves_${userId}`, existing, undefined, 'reserves');
      return existing;
    });

    syncQueueManager.enqueue('reserves', 'insert', resObj.id, supabasePayload);
    toast.success('Reserva criada com sucesso!', { id: 'reserve-action' });
  }, []);

  const updateReserve = useCallback(async (id: string, updatedFields: Partial<Reserve>) => {
    const userId = await getEffectiveUserId();
    if (!userId) return;

    const { saldo_atual, ...supabasePayload } = updatedFields;
    persistBoostSetting(userId, id, updatedFields);
    
    setReserves(prev => {
      const existing = prev.map(r => r.id === id ? { ...r, ...updatedFields, updated_at: new Date().toISOString() } : r);
      cacheManager.set(`reserves_${userId}`, existing, undefined, 'reserves');
      return existing;
    });

    syncQueueManager.enqueue('reserves', 'update', id, { ...supabasePayload, updated_at: new Date().toISOString() });
    toast.success('Reserva atualizada com sucesso!', { id: 'reserve-action' });
  }, []);

  const deleteReserve = useCallback(async (id: string) => {
    const userId = await getEffectiveUserId();
    if (!userId) return;

    const rtsToDelete = reserveTransactions.filter(rt => rt.reserve_id === id);

    try {
      const raw = localStorage.getItem(`reserve_boost_map_${userId}`);
      if (raw) {
        const currentMap = JSON.parse(raw);
        delete currentMap[id];
        localStorage.setItem(`reserve_boost_map_${userId}`, JSON.stringify(currentMap));
        cacheManager.set(`reserve_boost_map_${userId}`, currentMap, undefined, 'reserves');
      }
    } catch {}

    setReserves(prev => {
      const existing = prev.filter(r => r.id !== id);
      cacheManager.set(`reserves_${userId}`, existing, undefined, 'reserves');
      return existing;
    });
    
    setReserveTransactions(prev => {
      const existingRts = prev.filter(rt => rt.reserve_id !== id);
      cacheManager.set(`reserve_transactions_${userId}`, existingRts, undefined, 'reserves');
      return existingRts;
    });

    rtsToDelete.forEach(rt => {
      syncQueueManager.enqueue('reserve_transactions', 'delete', rt.id);
    });
    
    syncQueueManager.enqueue('reserves', 'delete', id);
    toast.success('Reserva excluída com sucesso!', { id: 'reserve-action' });
  }, [reserveTransactions]);

  const addReserveTransaction = useCallback(async (
    newRt: Omit<ReserveTransaction, 'id' | 'user_id' | 'created_at'>,
    options?: { silent?: boolean }
  ): Promise<string | undefined> => {
    const userId = await getEffectiveUserId();
    if (!userId) return;

    const rtObj: ReserveTransaction = {
      id: generateUUID(),
      user_id: userId,
      ...newRt,
      created_at: new Date().toISOString(),
    };

    // Sanitize payload specifically for Supabase table schema
    // PostgREST errors out if extra client-side keys (like source/batch_id) are present
    const supabasePayload: Record<string, any> = {
      id: rtObj.id,
      user_id: rtObj.user_id,
      reserve_id: rtObj.reserve_id,
      type: rtObj.type,
      amount: rtObj.amount,
      date: rtObj.date,
      created_at: rtObj.created_at,
    };
    if (rtObj.description) supabasePayload.description = rtObj.description;
    if (rtObj.category) supabasePayload.category = rtObj.category;
    if (rtObj.linked_investment_id) supabasePayload.linked_investment_id = rtObj.linked_investment_id;
    if (rtObj.transaction_id) supabasePayload.transaction_id = rtObj.transaction_id;
    if (rtObj.payment_status) supabasePayload.payment_status = rtObj.payment_status;
    if (rtObj.payment_date) supabasePayload.payment_date = rtObj.payment_date;
    if (rtObj.due_date) supabasePayload.due_date = rtObj.due_date;
    if (rtObj.is_recurring !== undefined) supabasePayload.is_recurring = rtObj.is_recurring;
    if (rtObj.recurrence_frequency) supabasePayload.recurrence_frequency = rtObj.recurrence_frequency;
    if (rtObj.recurrence_installments !== undefined) supabasePayload.recurrence_installments = rtObj.recurrence_installments;
    if (rtObj.recurrence_group_id) supabasePayload.recurrence_group_id = rtObj.recurrence_group_id;
    if (rtObj.installment_number !== undefined) supabasePayload.installment_number = rtObj.installment_number;
    if (rtObj.installment_total !== undefined) supabasePayload.installment_total = rtObj.installment_total;
    if (rtObj.ignore_in_charts !== undefined) supabasePayload.ignore_in_charts = rtObj.ignore_in_charts;

    if (rtObj.boost_extra && rtObj.boost_extra > 0) {
      persistBoostExtra(userId, rtObj.id, rtObj.boost_extra);
    }

    setReserveTransactions(prev => {
      const filtered = prev.filter(item => item.id !== rtObj.id);
      const existing = [rtObj, ...filtered];
      cacheManager.set(`reserve_transactions_${userId}`, existing, undefined, 'reserves');
      return existing;
    });

    syncQueueManager.enqueue('reserve_transactions', 'insert', rtObj.id, supabasePayload);
    if (!options?.silent) toast.success('Movimentação registrada com sucesso!', { id: 'reserve-action' });
    return rtObj.id;
  }, []);

  const deleteReserveTransaction = useCallback(async (id: string, options?: { silent?: boolean }) => {
    const userId = await getEffectiveUserId();
    if (!userId) return;

    const rtToDelete = reserveTransactions.find(rt => rt.id === id);

    // 1. Optimistically update local state & cache immediately
    setReserveTransactions(prev => {
      const existing = prev.filter(rt => rt.id !== id);
      cacheManager.set(`reserve_transactions_${userId}`, existing, undefined, 'reserves');
      return existing;
    });

    if (rtToDelete?.linked_investment_id) {
      syncQueueManager.enqueue('investment_transactions', 'delete', rtToDelete.linked_investment_id);
    }

    if (rtToDelete?.transaction_id) {
      syncQueueManager.enqueue('transactions', 'delete', rtToDelete.transaction_id);
    }

    // Check if this reserve transaction was generated from or linked to a dividend
    const localDivs = cacheManager.get<any[]>(`dividends_${userId}`) || [];
    const linkedDiv = localDivs.find(d => 
      d.transaction_id === id || 
      (rtToDelete?.transaction_id && d.id === rtToDelete.transaction_id) ||
      ((rtToDelete?.type === 'aporte' || rtToDelete?.type === 'rendimento') && 
       d.ticker && rtToDelete.description?.toUpperCase().includes(d.ticker.toUpperCase()) && 
       Math.abs(Number(d.amount) - Number(rtToDelete.amount)) < 0.001 &&
       (d.data_ex === rtToDelete.date || d.date === rtToDelete.date))
    );

    if (linkedDiv) {
      cacheManager.set(`dividends_${userId}`, localDivs.filter(d => d.id !== linkedDiv.id), undefined, 'investments');
      syncQueueManager.enqueue('dividends', 'delete', linkedDiv.id);
    }

    syncQueueManager.enqueue('reserve_transactions', 'delete', id);
    persistBoostExtra(userId, id, 0);
    if (onDataChange) await onDataChange();
    if (!options?.silent) toast.success('Movimentação excluída com sucesso!', { id: 'reserve-action' });
  }, [reserveTransactions, onDataChange]);

  const updateReserveTransaction = useCallback(async (id: string, updatedFields: Partial<ReserveTransaction>, options?: { silent?: boolean }) => {
    const userId = await getEffectiveUserId();
    if (!userId) return;

    const currentList = reserveTransactionsRef.current;
    const prevRt = currentList.find(rt => rt.id === id);

    let effectiveUpdatedFields = { ...updatedFields };
    let nextRecurringRt: ReserveTransaction | null = null;

    if (prevRt) {
      const mergedRt: ReserveTransaction = { ...prevRt, ...updatedFields };
      const transitionedToPaid = prevRt.payment_status === 'pending' && updatedFields.payment_status === 'paid';
      if (transitionedToPaid && isAutoRenewRecurring(mergedRt)) {
        const groupId = mergedRt.recurrence_group_id || generateUUID();
        if (!mergedRt.recurrence_group_id) {
          effectiveUpdatedFields.recurrence_group_id = groupId;
          mergedRt.recurrence_group_id = groupId;
        }
        const baseDate = ((mergedRt.due_date || mergedRt.date || getTodayLocalDateStr()) as string).split('T')[0];
        const nextDate = calculateNextOccurrence(baseDate, mergedRt.recurrence_frequency || 'monthly', 1);
        if (!hasExistingNextOccurrence(currentList, mergedRt, groupId, nextDate)) {
          nextRecurringRt = buildNextRecurringReserveTransaction(mergedRt, nextDate, groupId, userId);
        }
      }
    }

    if (effectiveUpdatedFields.boost_extra !== undefined) {
      persistBoostExtra(userId, id, effectiveUpdatedFields.boost_extra);
    }

    // Optimistically update local state
    setReserveTransactions(prev => {
      const updated = prev.map(rt => rt.id === id ? { ...rt, ...effectiveUpdatedFields } : rt);
      const existing = nextRecurringRt ? [nextRecurringRt, ...updated] : updated;
      reserveTransactionsRef.current = existing;
      cacheManager.set(`reserve_transactions_${userId}`, existing, undefined, 'reserves');
      return existing;
    });

    // Sanitize payload for Supabase
    const { source, batch_id, boost_extra, ...supabasePayload } = effectiveUpdatedFields as any;

    syncQueueManager.enqueue('reserve_transactions', 'update', id, supabasePayload);
    if (!options?.silent) toast.success('Movimentação de reserva atualizada!', { id: 'reserve-action' });

    if (nextRecurringRt) {
      const nextPayload: Record<string, any> = {
        id: nextRecurringRt.id,
        user_id: nextRecurringRt.user_id,
        reserve_id: nextRecurringRt.reserve_id,
        type: nextRecurringRt.type,
        amount: nextRecurringRt.amount,
        date: nextRecurringRt.date,
        created_at: nextRecurringRt.created_at,
        payment_status: nextRecurringRt.payment_status,
        payment_date: nextRecurringRt.payment_date,
        due_date: nextRecurringRt.due_date,
        is_recurring: nextRecurringRt.is_recurring,
        recurrence_frequency: nextRecurringRt.recurrence_frequency,
        recurrence_group_id: nextRecurringRt.recurrence_group_id,
        installment_number: nextRecurringRt.installment_number,
        ignore_in_charts: nextRecurringRt.ignore_in_charts,
      };
      if (nextRecurringRt.description) nextPayload.description = nextRecurringRt.description;
      if (nextRecurringRt.category) nextPayload.category = nextRecurringRt.category;
      if (nextRecurringRt.vehicle_id) nextPayload.vehicle_id = nextRecurringRt.vehicle_id;

      syncQueueManager.enqueue('reserve_transactions', 'insert', nextRecurringRt.id, nextPayload);
      const cardMap = planningStorage.getTxCardMap(userId);
      const linkedCardId = cardMap[id];
      if (linkedCardId) {
        planningStorage.linkTxsToCard(userId, [nextRecurringRt.id], linkedCardId);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('planning_data_synced', { detail: { userId } }));
        }
      }
      const nextLabel = format(parseLocalDate(nextRecurringRt.date), 'dd/MM/yyyy');
      toast.info(`Próxima conta recorrente (reserva) agendada para ${nextLabel}!`, { id: 'recurring-next-bill' });
    }
  }, []);

  // Dynamically calculate computed balances for reserves:
  // saldo = saldo_inicial + todas entradas liquidadas (aportes, proventos, vendas D+2, rendimentos) - todas saídas liquidadas (compras, resgates, usos)
  const computedReserves = useMemo(() => {
    return reserves.map(r => {
      const rts = reserveTransactions.filter(rt => rt.reserve_id === r.id);
      // Filter out pending items (including D+2 asset sales awaiting settlement) for actual liquid balance
      const settledRts = rts.filter(rt => rt.payment_status !== 'pending');

      const totalEntradas = settledRts
        .filter(rt => rt.type === 'aporte' || rt.type === 'rendimento')
        .reduce((sum, rt) => sum + Number(rt.amount || 0), 0);
      const totalSaidas = settledRts
        .filter(rt => rt.type === 'utilizacao')
        .reduce((sum, rt) => sum + Number(rt.amount || 0), 0);

      const saldoCalculado = Number(r.saldo_inicial || 0) + totalEntradas - totalSaidas;

      return {
        ...r,
        saldo_atual: Math.round(saldoCalculado * 100) / 100
      };
    });
  }, [reserves, reserveTransactions]);

  const value = useMemo<ReservesContextType>(() => ({
    reserves: computedReserves,
    reserveTransactions,
    addReserve,
    updateReserve,
    deleteReserve,
    addReserveTransaction,
    deleteReserveTransaction,
    updateReserveTransaction,
    setReserves,
    setReserveTransactions,
  }), [
    computedReserves,
    reserveTransactions,
    addReserve,
    updateReserve,
    deleteReserve,
    addReserveTransaction,
    deleteReserveTransaction,
    updateReserveTransaction,
  ]);

  return (
    <ReservesContext.Provider value={value}>
      {children}
    </ReservesContext.Provider>
  );
}

export function useReserves(): ReservesContextType {
  const context = useContext(ReservesContext);
  if (context === undefined) {
    throw new Error('useReserves must be used within a ReservesProvider');
  }
  return context;
}
