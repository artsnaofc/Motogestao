import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Transaction, UserSettings, Reserve, ReserveTransaction, InvestmentTransaction, Dividend, DividendAnalysisMode, ValuationTarget } from '../types';
import { QuoteProvider, QuoteFetchResult } from '../lib/quoteService';

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
  reserveTransactions: ReserveTransaction[];
  addReserve: (reserve: Omit<Reserve, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateReserve: (id: string, reserve: Partial<Reserve>) => Promise<void>;
  deleteReserve: (id: string) => Promise<void>;
  addReserveTransaction: (rt: Omit<ReserveTransaction, 'id' | 'user_id' | 'created_at'>) => Promise<string | undefined>;
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

const DataContext = createContext<DataContextType | undefined>(undefined);

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

  // Auto-fetch quotes when investment transactions change
  useEffect(() => {
    if (invCtx.investmentTransactions.length > 0) {
      const tickers = invCtx.investmentTransactions.map(it => it.ticker);
      quotesCtx.fetchQuotes(tickers, undefined, transCtx.settings);
    }
  }, [invCtx.investmentTransactions.length, transCtx.settings?.quote_provider]);

  const unifiedValue = useMemo<DataContextType>(() => ({
    // Transactions
    transactions: transCtx.transactions,
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
    reserveTransactions: resCtx.reserveTransactions,
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

          const finalSettings = {
            ...settingsData,
            operational_expense_categories: opCats,
            expense_categories: expCats,
          };
          setSettings(finalSettings);
          localStorage.setItem(`user_settings_${userId}`, JSON.stringify(finalSettings));
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
            categories_with_km: ['iFood', 'Uber', '99Moto', 'Pizzaria', 'Frete do Dia'],
          };
          setSettings(defaultSettings);
        }
      } catch (errSettings) {
        console.warn('Could not load settings from Supabase, loading from localStorage:', errSettings);
        const localSettings = localStorage.getItem(`user_settings_${userId}`);
        if (localSettings) {
          try {
            setSettings(JSON.parse(localSettings));
          } catch {}
        }
      }

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
          setTransactions(txData);
          localStorage.setItem(`transactions_${userId}`, JSON.stringify(txData));
        }
      } catch (errTx) {
        console.warn('Could not load transactions from Supabase, loading from localStorage:', errTx);
        const localTxs = localStorage.getItem(`transactions_${userId}`);
        if (localTxs) {
          try {
            setTransactions(JSON.parse(localTxs));
          } catch {}
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
        const hasSeeded = localStorage.getItem(hasSeededKey) === 'true';

        if (rSupadata && rSupadata.length > 0) {
          const finalReserves = rSupadata as Reserve[];
          setReserves(finalReserves);
          localStorage.setItem(`reserves_${userId}`, JSON.stringify(finalReserves));
          if (!hasSeeded) localStorage.setItem(hasSeededKey, 'true');
        } else if (!hasSeeded) {
          const defaults = getDefaultReserves(userId);
          const sanitizedDefaults = defaults.map(({ saldo_atual, ...rest }) => rest);
          const { data: rInserted, error: rInsertError } = await supabase
            .from('reserves')
            .insert(sanitizedDefaults)
            .select();

          if (!rInsertError && rInserted && rInserted.length > 0) {
            setReserves(rInserted);
            localStorage.setItem(`reserves_${userId}`, JSON.stringify(rInserted));
            localStorage.setItem(hasSeededKey, 'true');
          } else {
            setReserves(defaults);
            localStorage.setItem(`reserves_${userId}`, JSON.stringify(defaults));
            localStorage.setItem(hasSeededKey, 'true');
          }
        } else {
          setReserves([]);
          localStorage.setItem(`reserves_${userId}`, JSON.stringify([]));
        }
      } catch (errRes) {
        console.warn('Could not load reserves from Supabase, loading from localStorage:', errRes);
        const localRes = localStorage.getItem(`reserves_${userId}`);
        if (localRes) {
          try {
            setReserves(JSON.parse(localRes));
          } catch {
            const defaults = getDefaultReserves(userId);
            setReserves(defaults);
          }
        } else {
          const defaults = getDefaultReserves(userId);
          setReserves(defaults);
          localStorage.setItem(`reserves_${userId}`, JSON.stringify(defaults));
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
          setReserveTransactions(rtSupadata);
          localStorage.setItem(`reserve_transactions_${userId}`, JSON.stringify(rtSupadata));
        }
      } catch (errRt) {
        console.warn('Could not load reserve transactions from Supabase, loading from localStorage:', errRt);
        const localRts = localStorage.getItem(`reserve_transactions_${userId}`);
        if (localRts) {
          try {
            setReserveTransactions(JSON.parse(localRts));
          } catch {}
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
          setInvestmentTransactions(itSupadata);
          localStorage.setItem(`investment_transactions_${userId}`, JSON.stringify(itSupadata));
        }
      } catch (errIt) {
        console.warn('Supabase investment loading error:', errIt);
        const localIts = localStorage.getItem(`investment_transactions_${userId}`);
        if (localIts) {
          try {
            setInvestmentTransactions(JSON.parse(localIts));
          } catch {}
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
          setDividends(divData);
          localStorage.setItem(`dividends_${userId}`, JSON.stringify(divData));
        }
      } catch (errDiv) {
        console.warn('Supabase dividends loading error:', errDiv);
        const localDivs = localStorage.getItem(`dividends_${userId}`);
        if (localDivs) {
          try {
            setDividends(JSON.parse(localDivs));
          } catch {}
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
