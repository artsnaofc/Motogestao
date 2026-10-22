import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Reserve, ReserveTransaction } from '../types';
import { toast } from '../lib/toast';
import { cacheManager } from '../lib/cacheManager';
import { syncQueueManager } from '../lib/syncQueue';
import { getEffectiveUserId } from '../lib/authUtils';

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

  // Synchronize when initial props change
  useEffect(() => {
    setReserves(initialReserves);
  }, [initialReserves]);

  useEffect(() => {
    setReserveTransactions(initialReserveTransactions);
  }, [initialReserveTransactions]);

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
    if (onDataChange) await onDataChange();
    if (!options?.silent) toast.success('Movimentação excluída com sucesso!', { id: 'reserve-action' });
  }, [reserveTransactions, onDataChange]);

  const updateReserveTransaction = useCallback(async (id: string, updatedFields: Partial<ReserveTransaction>, options?: { silent?: boolean }) => {
    const userId = await getEffectiveUserId();
    if (!userId) return;

    // Optimistically update local state
    setReserveTransactions(prev => {
      const existing = prev.map(rt => rt.id === id ? { ...rt, ...updatedFields } : rt);
      cacheManager.set(`reserve_transactions_${userId}`, existing, undefined, 'reserves');
      return existing;
    });

    // Sanitize payload for Supabase
    const { source, batch_id, ...supabasePayload } = updatedFields as any;

    syncQueueManager.enqueue('reserve_transactions', 'update', id, supabasePayload);
    if (!options?.silent) toast.success('Movimentação de reserva atualizada!', { id: 'reserve-action' });
  }, []);

  // Dynamically calculate computed balances for reserves:
  // saldo = saldo_inicial + aportes + proventos + rendimentos gerais + venda de ativos - resgates - compras de ativos (utilizacao)
  const computedReserves = useMemo(() => {
    return reserves.map(r => {
      const rts = reserveTransactions.filter(rt => rt.reserve_id === r.id);
      // Filter out pending items for actual liquid balance
      const settledRts = rts.filter(rt => rt.payment_status !== 'pending');
      
      const totalAportes = settledRts.filter(rt => rt.type === 'aporte' && rt.category !== 'Proventos').reduce((sum, rt) => sum + Number(rt.amount), 0);
      const totalProventos = settledRts.filter(rt => (rt.type === 'aporte' || rt.type === 'rendimento') && rt.category === 'Proventos').reduce((sum, rt) => sum + Number(rt.amount), 0);
      const totalRendimentosGerais = settledRts.filter(rt => rt.type === 'rendimento' && rt.category !== 'Proventos').reduce((sum, rt) => sum + Number(rt.amount), 0);
      const totalVendas = settledRts.filter(rt => rt.type === 'aporte' && rt.description?.toUpperCase().includes('VENDA')).reduce((sum, rt) => sum + Number(rt.amount), 0);
      const totalCompras = settledRts.filter(rt => rt.type === 'utilizacao' && (rt.description?.toUpperCase().includes('COMPRA') || rt.description?.toUpperCase().includes('INVESTIMENTO'))).reduce((sum, rt) => sum + Number(rt.amount), 0);
      const totalResgates = settledRts.filter(rt => rt.type === 'utilizacao' && !rt.description?.toUpperCase().includes('COMPRA') && !rt.description?.toUpperCase().includes('INVESTIMENTO')).reduce((sum, rt) => sum + Number(rt.amount), 0);

      const saldoCalculado = Number(r.saldo_inicial || 0) + totalAportes + totalProventos + totalRendimentosGerais + totalVendas - totalCompras - totalResgates;

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
