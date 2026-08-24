import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { executeQuoteFetch, QuoteProvider, QuoteFetchResult } from '../lib/quoteService';
import { UserSettings } from '../types';
import { cacheManager } from '../lib/cacheManager';

export interface QuotesContextType {
  quotes: Record<string, number>;
  isFetchingQuotes: boolean;
  lastQuoteFetchResult: QuoteFetchResult | null;
  fetchQuotes: (
    tickers?: string[],
    overrideProvider?: QuoteProvider,
    settings?: UserSettings | null,
    overrideToken?: string
  ) => Promise<QuoteFetchResult | undefined>;
  setQuotes: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  updateQuoteCache: (newQuotes: Record<string, number>) => Promise<void>;
}

const QuotesContext = createContext<QuotesContextType | undefined>(undefined);

export function QuotesProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<Record<string, number>>(() => {
    return cacheManager.get<Record<string, number>>('cached_quotes') || {};
  });
  const [isFetchingQuotes, setIsFetchingQuotes] = useState(false);
  const [lastQuoteFetchResult, setLastQuoteFetchResult] = useState<QuoteFetchResult | null>(null);

  // Sync quotes cached in Supabase on load
  useEffect(() => {
    const syncQuotesFromDb = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const { data: settingsData } = await supabase
            .from('user_settings')
            .select('cached_quotes')
            .eq('user_id', userData.user.id)
            .maybeSingle();

          if (settingsData?.cached_quotes && Object.keys(settingsData.cached_quotes).length > 0) {
            setQuotes(prev => {
              const merged = { ...settingsData.cached_quotes, ...prev };
              cacheManager.set('cached_quotes', merged, undefined, 'quotes');
              return merged;
            });
          }
        }
      } catch (err) {
        console.warn('[QuotesContext] Erro ao carregar cotações salvas na nuvem:', err);
      }
    };

    syncQuotesFromDb();
  }, []);

  const updateQuoteCache = useCallback(async (newQuotes: Record<string, number>) => {
    setQuotes(prev => {
      const merged = { ...prev, ...newQuotes };
      cacheManager.set('cached_quotes', merged, undefined, 'quotes');
      return merged;
    });
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase
          .from('user_settings')
          .update({ cached_quotes: newQuotes })
          .eq('user_id', userData.user.id);
      }
    } catch (err) {
      console.warn('[QuotesContext] Falha ao sincronizar cache de cotações com Supabase:', err);
    }
  }, []);

  const fetchQuotes = useCallback(async (
    tickers: string[] = [],
    overrideProvider?: QuoteProvider,
    settings?: UserSettings | null,
    overrideToken?: string
  ): Promise<QuoteFetchResult | undefined> => {
    if (isFetchingQuotes || tickers.length === 0) return;
    
    setIsFetchingQuotes(true);
    try {
      const cleanTickers = Array.from(new Set(tickers.map(t => t.trim().toUpperCase()))).filter(Boolean);
      const providerToUse = overrideProvider || settings?.quote_provider || 'auto';
      const tokenToUse = overrideToken !== undefined ? overrideToken : settings?.brapi_token;

      const result = await executeQuoteFetch(cleanTickers, {
        provider: providerToUse,
        brapiToken: tokenToUse,
        existingQuotes: quotes,
      });

      setLastQuoteFetchResult(result);
      if (result && result.quotes) {
        setQuotes(prev => ({ ...prev, ...result.quotes }));
        // Asynchronously update cache in db
        updateQuoteCache(result.quotes);
      }

      return result;
    } catch (e) {
      console.error('[QuotesContext] Erro ao atualizar cotações:', e);
    } finally {
      setIsFetchingQuotes(false);
    }
  }, [isFetchingQuotes, quotes, updateQuoteCache]);

  const value = useMemo<QuotesContextType>(() => ({
    quotes,
    isFetchingQuotes,
    lastQuoteFetchResult,
    fetchQuotes,
    setQuotes,
    updateQuoteCache,
  }), [quotes, isFetchingQuotes, lastQuoteFetchResult, fetchQuotes, updateQuoteCache]);

  return (
    <QuotesContext.Provider value={value}>
      {children}
    </QuotesContext.Provider>
  );
}

export function useQuotes(): QuotesContextType {
  const context = useContext(QuotesContext);
  if (context === undefined) {
    throw new Error('useQuotes must be used within a QuotesProvider');
  }
  return context;
}
