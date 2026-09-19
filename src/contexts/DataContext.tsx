import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Transaction, UserSettings, Reserve, ReserveTransaction, InvestmentTransaction, Dividend, DividendAnalysisMode, ValuationTarget } from '../types';
import { QuoteProvider, QuoteFetchResult } from '../lib/quoteService';
import { cacheManager } from '../lib/cacheManager';
import { syncQueueManager } from '../lib/syncQueue';
import { toast } from '../lib/toast';
import { getEffectiveUserId } from '../lib/authUtils';

// Segregated Contexts & Hooks
import { QuotesProvider, useQuotes } from './QuotesContext';
import { ReservesProvider, useReserves } from './ReservesContext';
import { InvestmentsProvider, useInvestments } from './InvestmentsContext';
import { TransactionsProvider, useTransactions } from './TransactionsContext';

export { useQuotes } from './QuotesContext';
export { useReserves } from './ReservesContext';
export { useInvestments } from './InvestmentsContext';
export { useTransactions } from './TransactionsContext';

// Global In-Flight Request Deduplicator for master data fetching
let activeRefreshPromise: Promise<void> | null = null;

export interface DataContextType {
  // Operational Transactions & Settings
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  settings: UserSettings | null;
  loading: boolean;
  refreshData: (silent?: boolean) => Promise<void>;
  globalPeriod: string;
  setGlobalPeriod: (period: string) => void;
  customDateRange: { start: string, end: string } | null;
  setCustomDateRange: (range: { start: string, end: string } | null) => void;
  hideValues: boolean;
  setHideValues: (hide: boolean) => void;

  // Reserves
  reserves: Reserve[];
  setReserves: React.Dispatch<React.SetStateAction<Reserve[]>>;
  reserveTransactions: ReserveTransaction[];
  setReserveTransactions: React.Dispatch<React.SetStateAction<ReserveTransaction[]>>;
  addReserve: (reserve: Omit<Reserve, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateReserve: (id: string, reserve: Partial<Reserve>) => Promise<void>;
  deleteReserve: (id: string) => Promise<void>;
  addReserveTransaction: (rt: Omit<ReserveTransaction, 'id' | 'user_id' | 'created_at'>, options?: { silent?: boolean }) => Promise<string | undefined>;
  deleteReserveTransaction: (id: string) => Promise<void>;
  updateReserveTransaction: (id: string, rt: Partial<ReserveTransaction>) => Promise<void>;

  // Investments & Dividends
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

  // Market Quotes
  quotes: Record<string, number>;
  quoteVariations: Record<string, number>;
  quoteTimestamps: Record<string, string>;
  lastQuoteUpdatedAt: string | null;
  isFetchingQuotes: boolean;
  lastQuoteFetchResult: QuoteFetchResult | null;
  fetchQuotes: (
    overrideProvider?: QuoteProvider,
    overrideToken?: string,
    customTickers?: string[],
    forceRefresh?: boolean
  ) => Promise<QuoteFetchResult | undefined>;
  getQuoteAgeMinutes: (ticker: string) => number | null;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

const getDefaultReserves = (userId: string): Reserve[] => [
  {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'res-manutencao',
    user_id: userId,
    name: 'Reserva de Manutenção',
    description: 'Fundo para manutenção preventiva e corretiva do veículo.',
    color: '#f59e0b',
    icon: 'Wrench',
    saldo_inicial: 0,
    status: 'active',
    regra_tipo: 'km',
    regra_valor: 0.15,
    regra_categorias: ['iFood', 'Uber', '99Moto', 'Pizzaria', 'Frete do Dia'],
    regra_ativa: true,
    regra_inicio_validade: new Date().toISOString(),
  },
  {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'res-emergencia',
    user_id: userId,
    name: 'Reserva de Emergência',
    description: 'Fundo para imprevistos e emergências pessoais ou do veículo.',
    color: '#ef4444',
    icon: 'ShieldAlert',
    saldo_inicial: 0,
    status: 'active',
    regra_tipo: 'bruto',
    regra_valor: 5,
    regra_categorias: ['iFood', 'Uber', '99Moto', 'Particular', 'Gorjeta', 'Frete do Dia', 'Pizzaria', 'Outros'],
    regra_ativa: true,
    regra_inicio_validade: new Date().toISOString(),
  }
];

// Inner Consumer that stitches together segregated contexts into the unified useData interface
function DataContextBridge({ children }: { children: ReactNode }) {
  const transCtx = useTransactions();
  const resCtx = useReserves();
  const invCtx = useInvestments();
  const quotesCtx = useQuotes();

  const handleFetchQuotes = useCallback(async (
    overrideProvider?: QuoteProvider,
    overrideToken?: string,
    customTickers?: string[],
    forceRefresh?: boolean
  ) => {
    const portfolioTickers = invCtx.investmentTransactions.map(it => it.ticker);
    let tickersToUse = customTickers && customTickers.length > 0 
      ? customTickers 
      : portfolioTickers;
    
    // If portfolio is empty and testing, use sample benchmark tickers
    if (tickersToUse.length === 0) {
      tickersToUse = ['PETR4', 'MXRF11', 'VALE3', 'ITUB4'];
    }

    return quotesCtx.fetchQuotes(tickersToUse, overrideProvider, transCtx.settings, overrideToken, forceRefresh);
  }, [invCtx.investmentTransactions, quotesCtx, transCtx.settings]);

  // Auto-fetch quotes on load has been removed to respect user request and save API calls.
  // Quotes will only be fetched when explicitly visiting the Investments page.
  useEffect(() => {
    // No-op to avoid automatic network requests on app load
  }, []);

  const unifiedValue = useMemo<DataContextType>(() => ({
    // Transactions
    transactions: transCtx.transactions,
    setTransactions: transCtx.setTransactions,
    updateTransaction: transCtx.updateTransaction,
    deleteTransaction: transCtx.deleteTransaction,
    settings: transCtx.settings,
    loading: transCtx.loading,
    refreshData: transCtx.refreshData,
    globalPeriod: transCtx.globalPeriod,
    setGlobalPeriod: transCtx.setGlobalPeriod,
    customDateRange: transCtx.customDateRange,
    setCustomDateRange: transCtx.setCustomDateRange,
    hideValues: transCtx.hideValues,
    setHideValues: transCtx.setHideValues,

    // Reserves
    reserves: resCtx.reserves,
    setReserves: resCtx.setReserves,
    reserveTransactions: resCtx.reserveTransactions,
    setReserveTransactions: resCtx.setReserveTransactions,
    addReserve: resCtx.addReserve,
    updateReserve: resCtx.updateReserve,
    deleteReserve: resCtx.deleteReserve,
    addReserveTransaction: resCtx.addReserveTransaction,
    deleteReserveTransaction: resCtx.deleteReserveTransaction,
    updateReserveTransaction: resCtx.updateReserveTransaction,

    // Investments
    investmentTransactions: invCtx.investmentTransactions,
    addInvestmentTransaction: invCtx.addInvestmentTransaction,
    updateInvestmentTransaction: invCtx.updateInvestmentTransaction,
    deleteInvestmentTransaction: invCtx.deleteInvestmentTransaction,
    deleteInvestmentTransactionsByTicker: invCtx.deleteInvestmentTransactionsByTicker,
    dividends: invCtx.dividends,
    addDividend: invCtx.addDividend,
    updateDividend: invCtx.updateDividend,
    deleteDividend: invCtx.deleteDividend,
    updateAssetCnpj: invCtx.updateAssetCnpj,
    dividendAnalysisMode: invCtx.dividendAnalysisMode,
    setDividendAnalysisMode: invCtx.setDividendAnalysisMode,
    valuationTargets: invCtx.valuationTargets,
    saveValuationTarget: invCtx.saveValuationTarget,
    deleteValuationTarget: invCtx.deleteValuationTarget,

    // Quotes
    quotes: quotesCtx.quotes,
    quoteVariations: quotesCtx.quoteVariations,
    quoteTimestamps: quotesCtx.quoteTimestamps,
    lastQuoteUpdatedAt: quotesCtx.lastQuoteUpdatedAt,
    isFetchingQuotes: quotesCtx.isFetchingQuotes,
    lastQuoteFetchResult: quotesCtx.lastQuoteFetchResult,
    fetchQuotes: handleFetchQuotes,
    getQuoteAgeMinutes: quotesCtx.getQuoteAgeMinutes,
  }), [
    transCtx,
    resCtx,
    invCtx,
    quotesCtx,
    handleFetchQuotes
  ]);

  return (
    <DataContext.Provider value={unifiedValue}>
      {children}
    </DataContext.Provider>
  );
}

// Master DataProvider that fetches data from backend and mounts segregated providers
export function DataProvider({ children }: { children: ReactNode }) {
  const getInitialCache = <T,>(keySuffix: string, fallback: T): T => {
    try {
      const uid = localStorage.getItem('financas_pro_last_user_id') || cacheManager.get<string>('current_user_id');
      if (uid) {
        const cached = cacheManager.get<T>(`${keySuffix}_${uid}`);
        if (cached !== null && cached !== undefined) return cached;
      }
      const generic = cacheManager.get<T>(`last_known_${keySuffix}`);
      if (generic !== null && generic !== undefined) return generic;
    } catch {}
    return fallback;
  };

  const [transactions, setTransactions] = useState<Transaction[]>(() => getInitialCache('transactions', []));
  const [settings, setSettings] = useState<UserSettings | null>(() => getInitialCache('user_settings', null));
  const [reserves, setReserves] = useState<Reserve[]>(() => getInitialCache('reserves', []));
  const [reserveTransactions, setReserveTransactions] = useState<ReserveTransaction[]>(() => getInitialCache('reserve_transactions', []));
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentTransaction[]>(() => getInitialCache('investment_transactions', []));
  const [dividends, setDividends] = useState<Dividend[]>(() => getInitialCache('dividends', []));
  const [loading, setLoading] = useState(false);

  const refreshData = useCallback(async (silent = false) => {
    // If a master refresh is already in-flight, reuse it rather than spamming duplicate queries!
    if (activeRefreshPromise) {
      return activeRefreshPromise;
    }

    activeRefreshPromise = (async () => {
      if (!silent && !settings) setLoading(true);
      try {
        const userId = await getEffectiveUserId();
        if (!userId) {
          if (!silent) setLoading(false);
          return;
        }

        // 1. Immediately hydrate all available data from cacheManager (0ms L1/L2)
        const localSettings = cacheManager.get<UserSettings>(`user_settings_${userId}`) || cacheManager.get<UserSettings>('last_known_user_settings');
        if (localSettings) setSettings(localSettings);

        const localTxs = cacheManager.get<Transaction[]>(`transactions_${userId}`) || cacheManager.get<Transaction[]>('last_known_transactions');
        if (localTxs) setTransactions(localTxs);

        const localRes = cacheManager.get<Reserve[]>(`reserves_${userId}`) || cacheManager.get<Reserve[]>('last_known_reserves');
        if (localRes) setReserves(localRes);

        const localRts = cacheManager.get<ReserveTransaction[]>(`reserve_transactions_${userId}`) || cacheManager.get<ReserveTransaction[]>('last_known_reserve_transactions');
        if (localRts) setReserveTransactions(localRts);

        const localIts = cacheManager.get<InvestmentTransaction[]>(`investment_transactions_${userId}`) || cacheManager.get<InvestmentTransaction[]>('last_known_investment_transactions');
        if (localIts) setInvestmentTransactions(localIts);

        const localDivs = cacheManager.get<Dividend[]>(`dividends_${userId}`) || cacheManager.get<Dividend[]>('last_known_dividends');
        if (localDivs) setDividends(localDivs);

        // If device is offline, stop right here! Cache is already loaded and UI is intact!
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.log('[Finanças Pro - DataContext] Dispositivo offline. Dados servidos do cache local.');
          if (!silent) setLoading(false);
          return;
        }

        // When online: first flush any pending sync queue items
        try {
          if (syncQueueManager.getPendingCount() > 0) {
            await syncQueueManager.flushQueue(4000);
          }
        } catch (qErr) {
          console.warn('[DataContext] Aviso na sincronização prévia da fila:', qErr);
        }

        // 2. Fetch all collections in parallel for maximum network speed!
        const [settingsResult, txResult, reservesResult, rtResult, itResult, divResult] = await Promise.allSettled([
          supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
          supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('reserves').select('*').eq('user_id', userId).order('name', { ascending: true }),
          supabase.from('reserve_transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('investment_transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('dividends').select('*').eq('user_id', userId).order('date', { ascending: false })
        ]);

        // Process Settings
        if (settingsResult.status === 'fulfilled' && settingsResult.value.data) {
          const settingsData = settingsResult.value.data;
          const opCats = settingsData.operational_expense_categories ? [...settingsData.operational_expense_categories] : [];
          if (!opCats.includes('Manutenção')) opCats.push('Manutenção');
          const expCats = settingsData.expense_categories ? [...settingsData.expense_categories] : [];
          if (!expCats.includes('Manutenção')) expCats.push('Manutenção');

          const finalSettings: UserSettings = {
            ...settingsData,
            pizzaria_base_deliveries: Number(settingsData.pizzaria_base_deliveries) || 8,
            pizzaria_base_rate: Number(settingsData.pizzaria_base_rate) || 90,
            pizzaria_daily_rate_above_base: Number(settingsData.pizzaria_daily_rate_above_base) || 50,
            pizzaria_delivery_rate: Number(settingsData.pizzaria_delivery_rate) || 5,
            pizzaria_out_of_neighborhood_rate: Number(settingsData.pizzaria_out_of_neighborhood_rate) || 4,
            vehicle_km_per_liter: Number(settingsData.vehicle_km_per_liter) || 30,
            fuel_price: Number(settingsData.fuel_price) || 6,
            initial_balance: Number(settingsData.initial_balance) || 0,
            weekly_goal: Number(settingsData.weekly_goal) || 0,
            weekly_net_goal: Number(settingsData.weekly_net_goal) || 0,
            default_driver_labor: Number(settingsData.default_driver_labor) || 100,
            brapi_token: settingsData.brapi_token || '',
            quote_provider: settingsData.quote_provider || 'auto',
            operational_expense_categories: opCats,
            expense_categories: expCats,
            asset_cnpjs: settingsData.asset_cnpjs || {},
            rebalance_targets: settingsData.rebalance_targets || {},
            category_icons: settingsData.category_icons || {},
            cached_quotes: settingsData.cached_quotes || {},
          };
          setSettings(finalSettings);
          cacheManager.set(`user_settings_${userId}`, finalSettings, undefined, 'settings');

          if (settingsData.cached_quotes && Object.keys(settingsData.cached_quotes).length > 0) {
            cacheManager.set('cached_quotes', settingsData.cached_quotes, undefined, 'quotes');
          }
        }

        // Process Transactions
        if (txResult.status === 'fulfilled' && txResult.value.data) {
          const txData = txResult.value.data;
          const localStored = cacheManager.get<Transaction[]>(`transactions_${userId}`) || [];
          const supaMap = new Map(txData.map(item => [item.id, item]));
          const merged: Transaction[] = [];
          const seenIds = new Set<string>();

          for (const localItem of localStored) {
            seenIds.add(localItem.id);
            if (syncQueueManager.hasPendingTaskFor('transactions', localItem.id)) {
              merged.push(localItem);
            } else if (supaMap.has(localItem.id)) {
              merged.push(supaMap.get(localItem.id)!);
            } else {
              merged.push(localItem);
            }
          }

          for (const remoteItem of txData) {
            if (!seenIds.has(remoteItem.id)) {
              merged.push(remoteItem);
            }
          }

          setTransactions(merged);
          cacheManager.set(`transactions_${userId}`, merged, undefined, 'transactions');
          cacheManager.set('last_known_transactions', merged, undefined, 'transactions');
        }

        // Process Reserves
        if (reservesResult.status === 'fulfilled') {
          const rSupadata = reservesResult.value.data;
          const hasSeededKey = `has_seeded_reserves_${userId}`;
          const hasSeeded = cacheManager.get<boolean>(hasSeededKey) === true;

          if (rSupadata && rSupadata.length > 0) {
            const localStored = cacheManager.get<Reserve[]>(`reserves_${userId}`) || [];
            const supaMap = new Map(rSupadata.map(item => [item.id, item]));
            const merged: Reserve[] = [];
            const seenIds = new Set<string>();

            for (const localItem of localStored) {
              seenIds.add(localItem.id);
              if (syncQueueManager.hasPendingTaskFor('reserves', localItem.id)) {
                merged.push(localItem);
              } else if (supaMap.has(localItem.id)) {
                merged.push(supaMap.get(localItem.id)!);
              } else {
                merged.push(localItem);
              }
            }

            for (const remoteItem of rSupadata) {
              if (!seenIds.has(remoteItem.id)) {
                merged.push(remoteItem as Reserve);
              }
            }

            setReserves(merged);
            cacheManager.set(`reserves_${userId}`, merged, undefined, 'reserves');
            if (!hasSeeded) cacheManager.set(hasSeededKey, true, undefined, 'reserves');
          } else if (!hasSeeded) {
            const defaults = getDefaultReserves(userId);
            const sanitizedDefaults = defaults.map(({ saldo_atual, ...rest }) => rest);
            const { data: rInserted, error: rInsertError } = await supabase
              .from('reserves')
              .insert(sanitizedDefaults)
              .select();

            if (!rInsertError && rInserted && rInserted.length > 0) {
              setReserves(rInserted);
              cacheManager.set(`reserves_${userId}`, rInserted, undefined, 'reserves');
              cacheManager.set(hasSeededKey, true, undefined, 'reserves');
            } else {
              setReserves(defaults);
              cacheManager.set(`reserves_${userId}`, defaults, undefined, 'reserves');
              cacheManager.set(hasSeededKey, true, undefined, 'reserves');
            }
          }
        }

        // Process Reserve Transactions
        if (rtResult.status === 'fulfilled' && rtResult.value.data) {
          const rtSupadata = rtResult.value.data;
          const localStored = cacheManager.get<ReserveTransaction[]>(`reserve_transactions_${userId}`) || [];
          const supaMap = new Map(rtSupadata.map(item => [item.id, item]));
          const merged: ReserveTransaction[] = [];
          const seenIds = new Set<string>();

          for (const localItem of localStored) {
            seenIds.add(localItem.id);
            if (syncQueueManager.hasPendingTaskFor('reserve_transactions', localItem.id)) {
              merged.push(localItem);
            } else if (supaMap.has(localItem.id)) {
              merged.push(supaMap.get(localItem.id)!);
            } else {
              merged.push(localItem);
            }
          }

          for (const remoteItem of rtSupadata) {
            if (!seenIds.has(remoteItem.id)) {
              merged.push(remoteItem);
            }
          }

          setReserveTransactions(merged);
          cacheManager.set(`reserve_transactions_${userId}`, merged, undefined, 'reserves');
        }

        // Process Investment Transactions
        if (itResult.status === 'fulfilled' && itResult.value.data) {
          const itSupadata = itResult.value.data;
          const localStored = cacheManager.get<InvestmentTransaction[]>(`investment_transactions_${userId}`) || [];
          const supaMap = new Map(itSupadata.map(item => [item.id, item]));
          const merged: InvestmentTransaction[] = [];
          const seenIds = new Set<string>();

          for (const localItem of localStored) {
            seenIds.add(localItem.id);
            if (syncQueueManager.hasPendingTaskFor('investment_transactions', localItem.id)) {
              merged.push(localItem);
            } else if (supaMap.has(localItem.id)) {
              merged.push(supaMap.get(localItem.id)!);
            } else {
              merged.push(localItem);
            }
          }

          for (const remoteItem of itSupadata) {
            if (!seenIds.has(remoteItem.id)) {
              merged.push(remoteItem);
            }
          }

          setInvestmentTransactions(merged);
          cacheManager.set(`investment_transactions_${userId}`, merged, undefined, 'investments');
        }

        // Process Dividends
        if (divResult.status === 'fulfilled' && divResult.value.data) {
          const divData = divResult.value.data;
          const localStored = cacheManager.get<Dividend[]>(`dividends_${userId}`) || [];
          const supaMap = new Map(divData.map(item => [item.id, item]));
          const merged: Dividend[] = [];
          const seenIds = new Set<string>();

          for (const localItem of localStored) {
            seenIds.add(localItem.id);
            if (syncQueueManager.hasPendingTaskFor('dividends', localItem.id)) {
              merged.push(localItem);
            } else if (supaMap.has(localItem.id)) {
              merged.push(supaMap.get(localItem.id)!);
            } else {
              merged.push(localItem);
            }
          }

          for (const remoteItem of divData) {
            if (!seenIds.has(remoteItem.id)) {
              merged.push(remoteItem);
            }
          }

          setDividends(merged);
          cacheManager.set(`dividends_${userId}`, merged, undefined, 'investments');
        }

        // Record last sync timestamp
        cacheManager.set(`last_sync_timestamp_${userId}`, Date.now(), undefined, 'system');

      } catch (err) {
        console.error('Master data loading error:', err);
      } finally {
        activeRefreshPromise = null;
        if (!silent) setLoading(false);
      }
    })();

    return activeRefreshPromise;
  }, [settings]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Automatic online synchronization: when internet reconnects, flush queue and refresh data automatically!
  useEffect(() => {
    const handleOnline = async () => {
      console.log('[Finanças Pro - DataContext] Internet reconectada! Sincronizando fila pendente e atualizando dados...');
      toast.info('Internet reconectada! Sincronizando dados com a nuvem...');
      await syncQueueManager.flushQueue(5000);
      await refreshData(true);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refreshData]);

  return (
    <TransactionsProvider
      initialTransactions={transactions}
      initialSettings={settings}
      initialLoading={loading}
      onRefresh={refreshData}
    >
      <ReservesProvider
        initialReserves={reserves}
        initialReserveTransactions={reserveTransactions}
        onDataChange={() => refreshData(true)}
      >
        <InvestmentsProvider
          initialInvestmentTransactions={investmentTransactions}
          initialDividends={dividends}
          settings={settings}
          onDataChange={() => refreshData(true)}
          onUpdateSettings={(newSettings) => setSettings(newSettings)}
        >
          <QuotesProvider>
            <DataContextBridge>
              {children}
            </DataContextBridge>
          </QuotesProvider>
        </InvestmentsProvider>
      </ReservesProvider>
    </TransactionsProvider>
  );
}

export function useData(): DataContextType {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
