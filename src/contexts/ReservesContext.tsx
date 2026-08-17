import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Reserve, ReserveTransaction } from '../types';
import { toast } from 'sonner';

export interface ReservesContextType {
  reserves: Reserve[];
  reserveTransactions: ReserveTransaction[];
  addReserve: (reserve: Omit<Reserve, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateReserve: (id: string, reserve: Partial<Reserve>) => Promise<void>;
  deleteReserve: (id: string) => Promise<void>;
  addReserveTransaction: (rt: Omit<ReserveTransaction, 'id' | 'user_id' | 'created_at'>) => Promise<string | undefined>;
  deleteReserveTransaction: (id: string) => Promise<void>;
  updateReserveTransaction: (id: string, rt: Partial<ReserveTransaction>) => Promise<void>;
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
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const userId = userData.user.id;
    const resObj: Reserve = {
      id: generateUUID(),
      user_id: userId,
      ...newRes,
      regra_inicio_validade: newRes.regra_inicio_validade || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { saldo_atual, ...supabasePayload } = resObj;
      const { error } = await supabase
        .from('reserves')
        .insert(supabasePayload)
        .select();

      if (error) throw error;

      setReserves(prev => {
        const existing = [...prev, resObj];
        localStorage.setItem(`reserves_${userId}`, JSON.stringify(existing));
        return existing;
      });

      if (onDataChange) await onDataChange();
      toast.success('Reserva criada com sucesso!');
    } catch (err) {
      console.warn('Supabase insert failed, adding reserve to localStorage:', err);
      setReserves(prev => {
        const existing = [...prev, resObj];
        localStorage.setItem(`reserves_${userId}`, JSON.stringify(existing));
        return existing;
      });
      toast.success('Reserva criada com sucesso (salva localmente)!');
    }
  }, [onDataChange]);

  const updateReserve = useCallback(async (id: string, updatedFields: Partial<Reserve>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const userId = userData.user.id;

    try {
      const { saldo_atual, ...supabasePayload } = updatedFields;
      const { error } = await supabase
        .from('reserves')
        .update({ ...supabasePayload, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setReserves(prev => {
        const existing = prev.map(r => r.id === id ? { ...r, ...updatedFields, updated_at: new Date().toISOString() } : r);
        localStorage.setItem(`reserves_${userId}`, JSON.stringify(existing));
        return existing;
      });

      if (onDataChange) await onDataChange();
      toast.success('Reserva atualizada com sucesso!');
    } catch (err) {
      console.warn('Supabase update failed, updating reserve in localStorage:', err);
      setReserves(prev => {
        const existing = prev.map(r => r.id === id ? { ...r, ...updatedFields, updated_at: new Date().toISOString() } : r);
        localStorage.setItem(`reserves_${userId}`, JSON.stringify(existing));
        return existing;
      });
      toast.success('Reserva atualizada com sucesso (salva localmente)!');
    }
  }, [onDataChange]);

  const deleteReserve = useCallback(async (id: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const userId = userData.user.id;

    try {
      // First try to delete related transactions
      const { error: rtError } = await supabase
        .from('reserve_transactions')
        .delete()
        .eq('reserve_id', id);
        
      if (rtError && rtError.code !== 'PGRST116' && rtError.code !== '42P01') {
        console.warn('Failed to delete reserve_transactions:', rtError);
      }

      // Then delete the reserve
      const { error } = await supabase
        .from('reserves')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (onDataChange) await onDataChange();
      toast.success('Reserva excluída com sucesso!');
    } catch (err) {
      console.warn('Supabase delete failed, removing reserve from localStorage:', err);
      setReserves(prev => {
        const existing = prev.filter(r => r.id !== id);
        localStorage.setItem(`reserves_${userId}`, JSON.stringify(existing));
        return existing;
      });
      
      setReserveTransactions(prev => {
        const existingRts = prev.filter(rt => rt.reserve_id !== id);
        localStorage.setItem(`reserve_transactions_${userId}`, JSON.stringify(existingRts));
        return existingRts;
      });

      toast.success('Reserva excluída com sucesso (localmente)!');
    }
  }, [onDataChange]);

  const addReserveTransaction = useCallback(async (newRt: Omit<ReserveTransaction, 'id' | 'user_id' | 'created_at'>): Promise<string | undefined> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const userId = userData.user.id;
    const rtObj: ReserveTransaction = {
      id: generateUUID(),
      user_id: userId,
      ...newRt,
      created_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('reserve_transactions')
        .insert(rtObj);

      if (error) throw error;

      if (onDataChange) await onDataChange();
      toast.success('Movimentação registrada com sucesso!');
      return rtObj.id;
    } catch (err) {
      console.warn('Supabase transaction insert failed, adding to localStorage:', err);
      setReserveTransactions(prev => {
        const existing = [rtObj, ...prev];
        localStorage.setItem(`reserve_transactions_${userId}`, JSON.stringify(existing));
        return existing;
      });
      toast.success('Movimentação registrada com sucesso (localmente)!');
      return rtObj.id;
    }
  }, [onDataChange]);

  const deleteReserveTransaction = useCallback(async (id: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const userId = userData.user.id;

    try {
      const rtToDelete = reserveTransactions.find(rt => rt.id === id);
      if (rtToDelete?.linked_investment_id) {
        await supabase.from('investment_transactions').delete().eq('id', rtToDelete.linked_investment_id);
      }

      const { error } = await supabase
        .from('reserve_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (onDataChange) await onDataChange();
      toast.success('Movimentação excluída com sucesso!');
    } catch (err) {
      console.warn('Supabase transaction delete failed, removing from localStorage:', err);
      setReserveTransactions(prev => {
        const existing = prev.filter(rt => rt.id !== id);
        localStorage.setItem(`reserve_transactions_${userId}`, JSON.stringify(existing));
        return existing;
      });
      toast.success('Movimentação excluída com sucesso (localmente)!');
    }
  }, [reserveTransactions, onDataChange]);

  const updateReserveTransaction = useCallback(async (id: string, updatedFields: Partial<ReserveTransaction>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const userId = userData.user.id;

    try {
      const { error } = await supabase
        .from('reserve_transactions')
        .update(updatedFields)
        .eq('id', id);

      if (error) throw error;

      if (onDataChange) await onDataChange();
      toast.success('Movimentação de reserva atualizada!');
    } catch (err) {
      console.warn('Supabase rt update failed, updating in localStorage:', err);
      setReserveTransactions(prev => {
        const existing = prev.map(rt => rt.id === id ? { ...rt, ...updatedFields } : rt);
        localStorage.setItem(`reserve_transactions_${userId}`, JSON.stringify(existing));
        return existing;
      });
      toast.success('Movimentação de reserva atualizada (localmente)!');
    }
  }, [onDataChange]);

  // Dynamically calculate computed balances for reserves
  const computedReserves = useMemo(() => {
    return reserves.map(r => {
      const rts = reserveTransactions.filter(rt => rt.reserve_id === r.id);
      const totalAporte = rts.filter(rt => rt.type === 'aporte').reduce((sum, rt) => sum + Number(rt.amount), 0);
      const totalRendimento = rts.filter(rt => rt.type === 'rendimento').reduce((sum, rt) => sum + Number(rt.amount), 0);
      const totalUtilizacao = rts.filter(rt => rt.type === 'utilizacao').reduce((sum, rt) => sum + Number(rt.amount), 0);
      return {
        ...r,
        saldo_atual: Number(r.saldo_inicial || 0) + totalAporte + totalRendimento - totalUtilizacao
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
