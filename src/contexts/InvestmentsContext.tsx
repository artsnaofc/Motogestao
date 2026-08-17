import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { InvestmentTransaction, Dividend, UserSettings, ReserveTransaction, DividendAnalysisMode, ValuationTarget } from '../types';
import { toast } from 'sonner';

export interface InvestmentsContextType {
  investmentTransactions: InvestmentTransaction[];
  addInvestmentTransaction: (it: Omit<InvestmentTransaction, 'id' | 'user_id' | 'created_at'>) => Promise<string | undefined>;
  updateInvestmentTransaction: (id: string, it: Partial<InvestmentTransaction>) => Promise<void>;
  deleteInvestmentTransaction: (id: string) => Promise<void>;
  deleteInvestmentTransactionsByTicker: (ticker: string) => Promise<void>;
  dividends: Dividend[];
  addDividend: (div: Omit<Dividend, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  updateDividend: (id: string, div: Partial<Dividend>) => Promise<void>;
  deleteDividend: (id: string) => Promise<void>;
  updateAssetCnpj: (ticker: string, cnpj: string) => Promise<void>;
  dividendAnalysisMode: DividendAnalysisMode;
  setDividendAnalysisMode: (mode: DividendAnalysisMode) => void;
  valuationTargets: Record<string, ValuationTarget>;
  saveValuationTarget: (target: ValuationTarget) => Promise<void>;
  deleteValuationTarget: (ticker: string) => Promise<void>;
  setInvestmentTransactions: React.Dispatch<React.SetStateAction<InvestmentTransaction[]>>;
  setDividends: React.Dispatch<React.SetStateAction<Dividend[]>>;
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

const InvestmentsContext = createContext<InvestmentsContextType | undefined>(undefined);

export function InvestmentsProvider({
  children,
  initialInvestmentTransactions = [],
  initialDividends = [],
  settings = null,
  onDataChange,
  onUpdateSettings
}: {
  children: ReactNode;
  initialInvestmentTransactions?: InvestmentTransaction[];
  initialDividends?: Dividend[];
  settings?: UserSettings | null;
  onDataChange?: () => Promise<void>;
  onUpdateSettings?: (newSettings: UserSettings) => void;
}) {
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentTransaction[]>(initialInvestmentTransactions);
  const [dividends, setDividends] = useState<Dividend[]>(initialDividends);
  const [valuationTargets, setValuationTargets] = useState<Record<string, ValuationTarget>>(() => {
    try {
      const local = localStorage.getItem('valuation_targets_cache');
      if (local) {
        return JSON.parse(local);
      }
    } catch (e) {
      console.warn('Error loading local valuation cache in context', e);
    }
    return {};
  });
  const processingDividendsRef = useRef<Set<string>>(new Set());

  // Global Dividend Analysis Mode ('received_only' | 'include_provisioned')
  const [dividendAnalysisMode, setDividendAnalysisModeState] = useState<DividendAnalysisMode>(() => {
    try {
      const saved = localStorage.getItem('dividend_analysis_mode');
      if (saved === 'received_only' || saved === 'include_provisioned') {
        return saved;
      }
    } catch (e) {
      console.warn('Error loading dividend_analysis_mode:', e);
    }
    return 'received_only';
  });

  const setDividendAnalysisMode = useCallback((mode: DividendAnalysisMode) => {
    setDividendAnalysisModeState(mode);
    try {
      localStorage.setItem('dividend_analysis_mode', mode);
    } catch (e) {
      console.warn('Error saving dividend_analysis_mode:', e);
    }
  }, []);

  // Synchronize when initial props change
  useEffect(() => {
    setInvestmentTransactions(initialInvestmentTransactions);
  }, [initialInvestmentTransactions]);

  useEffect(() => {
    setDividends(initialDividends);
  }, [initialDividends]);

  // Automated Processing for Provisioned Dividends
  useEffect(() => {
    const processReadyDividends = async () => {
      if (dividends.length === 0 || !settings?.default_investment_reserve_id) return;

      const today = new Date().toISOString().split('T')[0];
      const currentReadyIds = new Set(
        dividends
          .filter(d => (d.status === 'provisioned' && d.data_ex && d.data_ex <= today) || (d.status === 'received' && !d.transaction_id))
          .map(d => d.id)
      );

      for (const id of Array.from(processingDividendsRef.current)) {
        if (!currentReadyIds.has(id)) {
          processingDividendsRef.current.delete(id);
        }
      }

      const readyToProcess = dividends.filter(d =>
        ((d.status === 'provisioned' && d.data_ex && d.data_ex <= today) ||
        (d.status === 'received' && !d.transaction_id)) &&
        !processingDividendsRef.current.has(d.id)
      );

      if (readyToProcess.length === 0) return;

      readyToProcess.forEach(d => processingDividendsRef.current.add(d.id));
      let processedAny = false;

      for (const div of readyToProcess) {
        try {
          const reserveTxId = generateUUID();
          const userId = div.user_id;

          const newReserveTx: ReserveTransaction = {
            id: reserveTxId,
            user_id: userId,
            reserve_id: settings.default_investment_reserve_id,
            type: 'rendimento',
            amount: div.amount,
            date: div.data_ex || today,
            description: `Provento: ${div.ticker} (${div.type})`,
            created_at: new Date().toISOString()
          };

          const { error: rtxError } = await supabase.from('reserve_transactions').insert(newReserveTx);
          if (rtxError) throw rtxError;

          const { error: divError } = await supabase
            .from('dividends')
            .update({
              status: 'received',
              transaction_id: reserveTxId,
              date: div.data_ex || today
            })
            .eq('id', div.id);

          if (divError) throw divError;
          processedAny = true;
        } catch (err) {
          console.error(`Error processing dividend for ${div.ticker}:`, err);
          processingDividendsRef.current.delete(div.id);
        }
      }

      if (processedAny && onDataChange) {
        await onDataChange();
      }
    };

    const timeout = setTimeout(processReadyDividends, 1500);
    return () => clearTimeout(timeout);
  }, [dividends, settings, onDataChange]);

  const addInvestmentTransaction = useCallback(async (newIt: Omit<InvestmentTransaction, 'id' | 'user_id' | 'created_at'>): Promise<string | undefined> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const userId = userData.user.id;
    const itObj: InvestmentTransaction = {
      id: generateUUID(),
      user_id: userId,
      ...newIt,
      created_at: new Date().toISOString(),
    };

    try {
      if (itObj.reserve_id) {
        const rtId = generateUUID();
        itObj.transaction_id = rtId;

        const isBuy = itObj.operation === 'buy';
        const subtotal = itObj.price * itObj.quantity;
        const txCosts = itObj.costs || 0;
        const isSubtotalOnly = Math.abs(itObj.amount - subtotal) < 0.01 && txCosts > 0;
        const reserveAmount = isSubtotalOnly 
          ? (isBuy ? itObj.amount + txCosts : Math.max(0, itObj.amount - txCosts))
          : itObj.amount;

        const rtObj: ReserveTransaction = {
          id: rtId,
          user_id: userId,
          reserve_id: itObj.reserve_id,
          type: isBuy ? 'utilizacao' : 'aporte',
          amount: reserveAmount,
          date: itObj.date,
          category: 'Investimentos',
          description: `Investimento: ${isBuy ? 'Compra' : 'Venda'} ${itObj.ticker}`,
          linked_investment_id: undefined,
          created_at: new Date().toISOString(),
        };

        const { error: rtError } = await supabase
          .from('reserve_transactions')
          .insert(rtObj);

        if (rtError) throw rtError;
      }

      const { error } = await supabase
        .from('investment_transactions')
        .insert(itObj);

      if (error) throw error;

      if (itObj.reserve_id && itObj.transaction_id) {
        await supabase
          .from('reserve_transactions')
          .update({ linked_investment_id: itObj.id })
          .eq('id', itObj.transaction_id);
      }

      if (onDataChange) await onDataChange();
      toast.success('Lançamento de investimento registrado!');
      return itObj.id;
    } catch (err: any) {
      console.warn('Supabase investment insert failed, adding to localStorage:', err);
      setInvestmentTransactions(prev => {
        const existing = [itObj, ...prev];
        localStorage.setItem(`investment_transactions_${userId}`, JSON.stringify(existing));
        return existing;
      });
      toast.success('Lançamento registrado localmente.');
      return itObj.id;
    }
  }, [onDataChange]);

  const deleteInvestmentTransaction = useCallback(async (id: string) => {
    toast.loading('Processando exclusão...', { id: 'del-inv' });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const userId = userData.user.id;

    const targetTx = investmentTransactions.find(it => it.id === id);

    setInvestmentTransactions(prev => {
      const newState = prev.filter(it => it.id !== id);
      localStorage.setItem(`investment_transactions_${userId}`, JSON.stringify(newState));
      return newState;
    });

    try {
      if (targetTx?.transaction_id) {
        await supabase.from('reserve_transactions').delete().eq('id', targetTx.transaction_id);
      }
      await supabase.from('reserve_transactions').delete().eq('linked_investment_id', id);

      const { error } = await supabase
        .from('investment_transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      if (onDataChange) await onDataChange();
      toast.success('Lançamento excluído!', { id: 'del-inv' });
    } catch (err) {
      console.warn('Supabase investment delete failed, already updated locally:', err);
      toast.success('Lançamento excluído (localmente)!', { id: 'del-inv' });
    }
  }, [investmentTransactions, onDataChange]);

  const updateInvestmentTransaction = useCallback(async (id: string, updatedFields: Partial<InvestmentTransaction>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const userId = userData.user.id;

    const targetTx = investmentTransactions.find(it => it.id === id);
    const merged = { ...targetTx, ...updatedFields } as InvestmentTransaction;

    setInvestmentTransactions(prev => {
      const newState = prev.map(it => it.id === id ? { ...it, ...updatedFields } : it);
      localStorage.setItem(`investment_transactions_${userId}`, JSON.stringify(newState));
      return newState;
    });

    try {
      const { error } = await supabase
        .from('investment_transactions')
        .update(updatedFields)
        .eq('id', id);

      if (error) throw error;

      // Sync linked reserve transaction
      if (merged.reserve_id) {
        const isBuy = merged.operation === 'buy';
        const rtAmount = isBuy ? (merged.amount + (merged.costs || 0)) : Math.max(0, merged.amount - (merged.costs || 0));
        const rtPayload = {
          reserve_id: merged.reserve_id,
          type: isBuy ? 'utilizacao' as const : 'aporte' as const,
          amount: rtAmount,
          date: merged.date,
          description: `Investimento: ${isBuy ? 'Compra' : 'Venda'} ${merged.ticker}`
        };

        if (targetTx?.transaction_id) {
          await supabase.from('reserve_transactions').update(rtPayload).eq('id', targetTx.transaction_id);
        } else {
          // Check if linked by linked_investment_id
          const { data: existingRt } = await supabase.from('reserve_transactions').select('id').eq('linked_investment_id', id).maybeSingle();
          if (existingRt) {
            await supabase.from('reserve_transactions').update(rtPayload).eq('id', existingRt.id);
          } else {
            // Create a new linked reserve transaction if none existed
            const newRtId = generateUUID();
            await supabase.from('reserve_transactions').insert({
              id: newRtId,
              user_id: userId,
              linked_investment_id: id,
              category: 'Investimentos',
              created_at: new Date().toISOString(),
              ...rtPayload
            });
            await supabase.from('investment_transactions').update({ transaction_id: newRtId }).eq('id', id);
          }
        }
      }

      if (onDataChange) await onDataChange();
      toast.success('Lançamento atualizado!');
    } catch (err) {
      console.warn('Supabase investment update failed, already updated locally:', err);
      toast.success('Lançamento atualizado (localmente)!');
    }
  }, [investmentTransactions, onDataChange]);

  const deleteInvestmentTransactionsByTicker = useCallback(async (ticker: string) => {
    toast.loading('Limpando posição de ' + ticker + '...', { id: 'del-ticker' });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const userId = userData.user.id;

    const txsToDelete = investmentTransactions.filter(it => it.ticker.toUpperCase() === ticker.toUpperCase());
    const txIds = txsToDelete.map(t => t.id);
    const rtIds = txsToDelete.map(t => t.transaction_id).filter(Boolean) as string[];

    setInvestmentTransactions(prev => {
      const newState = prev.filter(it => it.ticker.toUpperCase() !== ticker.toUpperCase());
      localStorage.setItem(`investment_transactions_${userId}`, JSON.stringify(newState));
      return newState;
    });

    try {
      if (rtIds.length > 0) {
        await supabase.from('reserve_transactions').delete().in('id', rtIds);
      }
      if (txIds.length > 0) {
        await supabase.from('reserve_transactions').delete().in('linked_investment_id', txIds);
      }

      const { error } = await supabase
        .from('investment_transactions')
        .delete()
        .eq('ticker', ticker)
        .eq('user_id', userId);

      if (error) throw error;

      if (onDataChange) await onDataChange();
      toast.success('Lançamentos excluídos!', { id: 'del-ticker' });
    } catch (err) {
      console.warn('Supabase investment delete failed, already updated locally:', err);
      toast.success('Lançamentos excluídos (localmente)!', { id: 'del-ticker' });
    }
  }, [investmentTransactions, onDataChange]);

  const addDividend = useCallback(async (newDiv: Omit<Dividend, 'id' | 'user_id' | 'created_at'>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const userId = userData.user.id;

    const divObj: Dividend = {
      id: generateUUID(),
      user_id: userId,
      ...newDiv,
      created_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('dividends').insert(divObj);
      if (error) throw error;
      if (onDataChange) await onDataChange();
      toast.success('Provento registrado!');
    } catch (err) {
      console.warn('Supabase dividend insert failed:', err);
      setDividends(prev => {
        const existing = [divObj, ...prev];
        localStorage.setItem(`dividends_${userId}`, JSON.stringify(existing));
        return existing;
      });
      toast.success('Provento registrado localmente.');
    }
  }, [onDataChange]);

  const updateDividend = useCallback(async (id: string, updatedFields: Partial<Dividend>) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const userId = userData.user.id;

    const currentDiv = dividends.find(d => d.id === id);
    const finalFields: Partial<Dividend> = { ...updatedFields };

    // If changing status from received to provisioned, remove linked reserve transaction if existing
    if (currentDiv && currentDiv.status === 'received' && updatedFields.status === 'provisioned') {
      if (currentDiv.transaction_id) {
        try {
          await supabase.from('reserve_transactions').delete().eq('id', currentDiv.transaction_id);
        } catch (rtErr) {
          console.warn('Error deleting linked reserve transaction:', rtErr);
        }
        finalFields.transaction_id = undefined;
      }
    }

    setDividends(prev => {
      const existing = prev.map(d => d.id === id ? { ...d, ...finalFields } : d);
      localStorage.setItem(`dividends_${userId}`, JSON.stringify(existing));
      return existing;
    });

    try {
      const { error } = await supabase.from('dividends').update(finalFields).eq('id', id);
      if (error) throw error;
      if (onDataChange) await onDataChange();
      toast.success('Provento atualizado!');
    } catch (err) {
      console.warn('Supabase dividend update failed:', err);
      toast.success('Provento atualizado localmente.');
    }
  }, [dividends, onDataChange]);

  const deleteDividend = useCallback(async (id: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const userId = userData.user.id;

    const currentDiv = dividends.find(d => d.id === id);
    if (currentDiv?.transaction_id) {
      try {
        await supabase.from('reserve_transactions').delete().eq('id', currentDiv.transaction_id);
      } catch (rtErr) {
        console.warn('Error deleting linked reserve transaction on delete:', rtErr);
      }
    }

    setDividends(prev => {
      const existing = prev.filter(d => d.id !== id);
      localStorage.setItem(`dividends_${userId}`, JSON.stringify(existing));
      return existing;
    });

    try {
      const { error } = await supabase.from('dividends').delete().eq('id', id);
      if (error) throw error;
      if (onDataChange) await onDataChange();
      toast.success('Provento removido!');
    } catch (err) {
      console.warn('Supabase dividend delete failed:', err);
      toast.success('Provento removido localmente.');
    }
  }, [dividends, onDataChange]);

  const updateAssetCnpj = useCallback(async (ticker: string, cnpj: string) => {
    const tk = ticker.toUpperCase().trim();
    if (!tk) return;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    const cleanCnpjVal = cnpj.trim();

    const newAssetCnpjs = {
      ...(settings?.asset_cnpjs || {}),
      [tk]: cleanCnpjVal
    };

    const newSettings: UserSettings = settings
      ? { ...settings, asset_cnpjs: newAssetCnpjs }
      : {
          user_id: userId || 'local',
          pizzaria_base_deliveries: 8,
          pizzaria_base_rate: 90,
          pizzaria_daily_rate_above_base: 50,
          pizzaria_delivery_rate: 5,
          pizzaria_out_of_neighborhood_rate: 4,
          asset_cnpjs: newAssetCnpjs
        };

    if (onUpdateSettings) {
      onUpdateSettings(newSettings);
    }

    if (userId) {
      try {
        await supabase
          .from('user_settings')
          .upsert({
            user_id: userId,
            asset_cnpjs: newAssetCnpjs
          });
      } catch (err) {
        console.warn('Error saving asset_cnpjs:', err);
      }
      localStorage.setItem(`asset_cnpjs_${userId}`, JSON.stringify(newAssetCnpjs));
    }
    toast.success(`CNPJ de ${tk} atualizado com sucesso!`);
  }, [settings, onUpdateSettings]);

  // Load Saved Valuations from Supabase & LocalStorage on Mount
  useEffect(() => {
    const loadValuations = async () => {
      // 1. Check local cache first
      try {
        const local = localStorage.getItem('valuation_targets_cache');
        if (local) {
          const parsed = JSON.parse(local);
          setValuationTargets(parsed);
        }
      } catch (e) {
        console.warn('Error loading local valuation cache:', e);
      }

      // 2. Fetch from Supabase
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('valuation_targets')
            .select('*')
            .eq('user_id', user.id);

          if (data && data.length > 0) {
            const valMap: Record<string, ValuationTarget> = {};
            data.forEach(item => {
              valMap[item.ticker.toUpperCase()] = item;
            });
            setValuationTargets(prev => ({ ...prev, ...valMap }));
            localStorage.setItem('valuation_targets_cache', JSON.stringify(valMap));
          }
        }
      } catch (err) {
        console.warn('Supabase valuation_targets fetch note:', err);
      }
    };

    loadValuations();
  }, []);

  // Save Valuation Target
  const saveValuationTarget = useCallback(async (target: ValuationTarget) => {
    const tk = target.ticker.toUpperCase().trim();
    if (!tk) return;

    const normalizedTarget: ValuationTarget = {
      ...target,
      ticker: tk,
      updated_at: new Date().toISOString()
    };

    setValuationTargets(prev => {
      const next = { ...prev, [tk]: normalizedTarget };
      try {
        localStorage.setItem('valuation_targets_cache', JSON.stringify(next));
      } catch (e) {
        console.warn('Error saving local valuation targets:', e);
      }
      return next;
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('valuation_targets')
          .upsert({
            user_id: user.id,
            ...normalizedTarget
          }, { onConflict: 'user_id,ticker' });

        if (error) {
          console.warn('Supabase valuation_targets upsert error:', error);
          toast.success(`Valuation de ${tk} salvo com sucesso!`);
        } else {
          toast.success(`Valuation de ${tk} salvo e sincronizado na nuvem!`);
        }
      } else {
        toast.success(`Valuation de ${tk} salvo com sucesso!`);
      }
    } catch (err) {
      console.warn('Error saving valuation target to database:', err);
      toast.success(`Valuation de ${tk} salvo localmente!`);
    }
  }, []);

  // Delete Valuation Target
  const deleteValuationTarget = useCallback(async (ticker: string) => {
    const tk = ticker.toUpperCase().trim();
    if (!tk) return;

    setValuationTargets(prev => {
      const next = { ...prev };
      delete next[tk];
      try {
        localStorage.setItem('valuation_targets_cache', JSON.stringify(next));
      } catch (e) {
        console.warn('Error saving local valuation targets:', e);
      }
      return next;
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('valuation_targets')
          .delete()
          .eq('user_id', user.id)
          .eq('ticker', tk);
      }
      toast.success(`Valuation de ${tk} removido com sucesso.`);
    } catch (err) {
      console.warn('Error deleting valuation target from database:', err);
      toast.success(`Valuation de ${tk} removido localmente.`);
    }
  }, []);

  const value = useMemo<InvestmentsContextType>(() => ({
    investmentTransactions,
    addInvestmentTransaction,
    updateInvestmentTransaction,
    deleteInvestmentTransaction,
    deleteInvestmentTransactionsByTicker,
    dividends,
    addDividend,
    updateDividend,
    deleteDividend,
    updateAssetCnpj,
    dividendAnalysisMode,
    setDividendAnalysisMode,
    valuationTargets,
    saveValuationTarget,
    deleteValuationTarget,
    setInvestmentTransactions,
    setDividends,
  }), [
    investmentTransactions,
    addInvestmentTransaction,
    updateInvestmentTransaction,
    deleteInvestmentTransaction,
    deleteInvestmentTransactionsByTicker,
    dividends,
    addDividend,
    updateDividend,
    deleteDividend,
    updateAssetCnpj,
    dividendAnalysisMode,
    setDividendAnalysisMode,
    valuationTargets,
    saveValuationTarget,
    deleteValuationTarget,
  ]);

  return (
    <InvestmentsContext.Provider value={value}>
      {children}
    </InvestmentsContext.Provider>
  );
}

export function useInvestments(): InvestmentsContextType {
  const context = useContext(InvestmentsContext);
  if (context === undefined) {
    throw new Error('useInvestments must be used within an InvestmentsProvider');
  }
  return context;
}
