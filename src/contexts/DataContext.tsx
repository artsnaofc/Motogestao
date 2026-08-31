import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Transaction, UserSettings, Reserve, ReserveTransaction, InvestmentTransaction, Dividend, DividendAnalysisMode, ValuationTarget } from '../types';
import { QuoteProvider, QuoteFetchResult } from '../lib/quoteService';
import { cacheManager } from '../lib/cacheManager';
import { syncQueueManager } from '../lib/syncQueue';

// Segregated Contexts & Hooks
import { QuotesProvider, useQuotes } from './QuotesContext';
import { ReservesProvider, useReserves } from './ReservesContext';
import { InvestmentsProvider, useInvestments } from './InvestmentsContext';
import { TransactionsProvider, useTransactions } from './TransactionsContext';

export { useQuotes } from './QuotesContext';
export { useReserves } from './ReservesContext';
export { useInvestments } from './InvestmentsContext';
export { useTransactions } from './TransactionsContext';

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
  isFetchingQuotes: boolean;
  lastQuoteFetchResult: QuoteFetchResult | null;
  fetchQuotes: (
    overrideProvider?: QuoteProvider,
    overrideToken?: string,
    customTickers?: string[]
  ) => Promise<QuoteFetchResult | undefined>;
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
    customTickers?: string[]
  ) => {
    const portfolioTickers = invCtx.investmentTransactions.map(it => it.ticker);
    let tickersToUse = customTickers && customTickers.length > 0 
      ? customTickers 
      : portfolioTickers;
    
    // If portfolio is empty and testing, use sample benchmark tickers
    if (tickersToUse.length === 0) {
      tickersToUse = ['PETR4', 'MXRF11', 'VALE3', 'ITUB4'];
    }

    return quotesCtx.fetchQuotes(tickersToUse, overrideProvider, transCtx.settings, overrideToken);
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
    isFetchingQuotes: quotesCtx.isFetchingQuotes,
    lastQuoteFetchResult: quotesCtx.lastQuoteFetchResult,
    fetchQuotes: handleFetchQuotes,
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [reserveTransactions, setReserveTransactions] = useState<ReserveTransaction[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentTransaction[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        if (!silent) setLoading(false);
        return;
      }

      const userId = userData.user.id;

      // 1. Fetch user_settings
      try {
        const { data: settingsData } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (settingsData) {
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

          // Sync database cached quotes to local cache manager
          if (settingsData.cached_quotes && Object.keys(settingsData.cached_quotes).length > 0) {
            cacheManager.set('cached_quotes', settingsData.cached_quotes, undefined, 'quotes');
          }
        } else {
          const defaultSettings: UserSettings = {
            user_id: userId,
            pizzaria_base_deliveries: 8,
            pizzaria_base_rate: 90,
            pizzaria_daily_rate_above_base: 50,
            pizzaria_delivery_rate: 5,
            pizzaria_out_of_neighborhood_rate: 4,
            expense_categories: ['Combustível', 'Pedágio', 'Manutenção', 'Alimentação', 'Plano de Internet', 'Equipamento', 'Outras Despesas', 'Outros'],
            operational_expense_categories: ['Combustível', 'Pedágio', 'Manutenção'],
            personal_expense_categories: ['Alimentação', 'Plano de Internet', 'Equipamento', 'Outras Despesas', 'Outros'],
            income_categories: ['iFood', 'Uber', '99Moto', 'Particular', 'Gorjeta', 'Frete do Dia', 'Pizzaria', 'Outros'],
            vehicle_km_per_liter: 30,
            fuel_price: 6,
            initial_balance: 0,
            weekly_goal: 0,
            weekly_net_goal: 0,
            default_driver_labor: 100,
            brapi_token: '',
            quote_provider: 'auto',
            categories_with_km: ['iFood', 'Uber', '99Moto', 'Pizzaria', 'Frete do Dia'],
            asset_cnpjs: {},
            rebalance_targets: {},
            category_icons: {},
            cached_quotes: {},
          };
          setSettings(defaultSettings);
        }
      } catch (errSettings) {
        console.warn('Could not load settings from Supabase, loading from cache:', errSettings);
        const localSettings = cacheManager.get<UserSettings>(`user_settings_${userId}`);
        if (localSettings) {
          setSettings(localSettings);
        }
      }

      // Trigger sync queue immediately
      syncQueueManager.processQueue();

      // 2. Fetch transactions
      try {
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });

        if (txError) throw txError;
        if (txData) {
          const localTxs = cacheManager.get<Transaction[]>(`transactions_${userId}`);
          let mergedTxs = txData;
          if (localTxs && Array.isArray(localTxs)) {
            const supaIds = new Set(txData.map(item => item.id));
            const localOnly = localTxs.filter((item: any) => item && item.id && !supaIds.has(item.id));
            mergedTxs = [...txData, ...localOnly];
          }
          setTransactions(mergedTxs);
          cacheManager.set(`transactions_${userId}`, mergedTxs, undefined, 'transactions');
        }
      } catch (errTx) {
        console.warn('Could not load transactions from Supabase, loading from cache:', errTx);
        const localTxs = cacheManager.get<Transaction[]>(`transactions_${userId}`);
        if (localTxs) {
          setTransactions(localTxs);
        }
      }

      // 3. Fetch reserves
      try {
        const { data: rSupadata, error: rSupaerror } = await supabase
          .from('reserves')
          .select('*')
          .eq('user_id', userId)
          .order('name', { ascending: true });

        if (rSupaerror) throw rSupaerror;

        const hasSeededKey = `has_seeded_reserves_${userId}`;
        const hasSeeded = cacheManager.get<boolean>(hasSeededKey) === true;

        if (rSupadata && rSupadata.length > 0) {
          const localRes = cacheManager.get<Reserve[]>(`reserves_${userId}`);
          let finalReserves = rSupadata as Reserve[];
          if (localRes && Array.isArray(localRes)) {
            const supaIds = new Set(rSupadata.map(item => item.id));
            const localOnly = localRes.filter((item: any) => item && item.id && !supaIds.has(item.id));
            finalReserves = [...finalReserves, ...localOnly];
          }
          setReserves(finalReserves);
          cacheManager.set(`reserves_${userId}`, finalReserves, undefined, 'reserves');
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
        } else {
          const localRes = cacheManager.get<Reserve[]>(`reserves_${userId}`) || [];
          setReserves(localRes);
          cacheManager.set(`reserves_${userId}`, localRes, undefined, 'reserves');
        }
      } catch (errRes) {
        console.warn('Could not load reserves from Supabase, loading from cache:', errRes);
        const localRes = cacheManager.get<Reserve[]>(`reserves_${userId}`);
        if (localRes) {
          setReserves(localRes);
        } else {
          const defaults = getDefaultReserves(userId);
          setReserves(defaults);
          cacheManager.set(`reserves_${userId}`, defaults, undefined, 'reserves');
        }
      }

      // 4. Fetch reserve transactions
      try {
        const { data: rtSupadata, error: rtSupaerror } = await supabase
          .from('reserve_transactions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });

        if (rtSupaerror) throw rtSupaerror;
        if (rtSupadata) {
          const localRts = cacheManager.get<ReserveTransaction[]>(`reserve_transactions_${userId}`);
          let mergedRts = rtSupadata;
          if (localRts && Array.isArray(localRts)) {
            const supaIds = new Set(rtSupadata.map(item => item.id));
            const localOnly = localRts.filter((item: any) => item && item.id && !supaIds.has(item.id));
            mergedRts = [...rtSupadata, ...localOnly];
          }
          setReserveTransactions(mergedRts);
          cacheManager.set(`reserve_transactions_${userId}`, mergedRts, undefined, 'reserves');
        }
      } catch (errRt) {
        console.warn('Could not load reserve transactions from Supabase, loading from cache:', errRt);
        const localRts = cacheManager.get<ReserveTransaction[]>(`reserve_transactions_${userId}`);
        if (localRts) {
          setReserveTransactions(localRts);
        }
      }

      // 5. Fetch investment transactions
      try {
        const { data: itSupadata, error: itSupaerror } = await supabase
          .from('investment_transactions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });

        if (itSupaerror) throw itSupaerror;
        if (itSupadata) {
          const localIts = cacheManager.get<InvestmentTransaction[]>(`investment_transactions_${userId}`);
          let mergedIts = itSupadata;
          if (localIts && Array.isArray(localIts)) {
            const supaIds = new Set(itSupadata.map(item => item.id));
            const localOnly = localIts.filter((item: any) => item && item.id && !supaIds.has(item.id));
            mergedIts = [...itSupadata, ...localOnly];
            if (localOnly.length > 0) {
              localOnly.forEach(item => {
                syncQueueManager.enqueue('investment_transactions', 'insert', item.id, item);
              });
            }
          }
          setInvestmentTransactions(mergedIts);
          cacheManager.set(`investment_transactions_${userId}`, mergedIts, undefined, 'investments');
        }
      } catch (errIt) {
        console.warn('Supabase investment loading error, using cache:', errIt);
        const localIts = cacheManager.get<InvestmentTransaction[]>(`investment_transactions_${userId}`);
        if (localIts) {
          setInvestmentTransactions(localIts);
        }
      }

      // 6. Fetch dividends
      try {
        const { data: divData, error: divError } = await supabase
          .from('dividends')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false });

        if (divError) throw divError;
        if (divData) {
          const localDivs = cacheManager.get<Dividend[]>(`dividends_${userId}`);
          let mergedDivs = divData;
          if (localDivs && Array.isArray(localDivs)) {
            const supaIds = new Set(divData.map(item => item.id));
            const localOnly = localDivs.filter((item: any) => item && item.id && !supaIds.has(item.id));
            mergedDivs = [...divData, ...localOnly];
            if (localOnly.length > 0) {
              localOnly.forEach(item => {
                syncQueueManager.enqueue('dividends', 'insert', item.id, item);
              });
            }
          }
          setDividends(mergedDivs);
          cacheManager.set(`dividends_${userId}`, mergedDivs, undefined, 'investments');
        }
      } catch (errDiv) {
        console.warn('Supabase dividends loading error, using cache:', errDiv);
        const localDivs = cacheManager.get<Dividend[]>(`dividends_${userId}`);
        if (localDivs) {
          setDividends(localDivs);
        }
      }

    } catch (err) {
      console.error('Master data loading error:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
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
