import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { executeQuoteFetch, QuoteProvider, QuoteFetchResult } from '../lib/quoteService';
import { UserSettings } from '../types';

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
  const [quotes, setQuotes] = useState<Record<string, number>>({});
  const [isFetchingQuotes, setIsFetchingQuotes] = useState(false);
  const [lastQuoteFetchResult, setLastQuoteFetchResult] = useState<QuoteFetchResult | null>(null);

  const updateQuoteCache = useCallback(async (newQuotes: Record<string, number>) => {
    setQuotes(prev => ({ ...prev, ...newQuotes }));
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
