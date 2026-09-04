import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { executeQuoteFetch, QuoteProvider, QuoteFetchResult } from '../lib/quoteService';
import { UserSettings } from '../types';
import { cacheManager } from '../lib/cacheManager';

export interface QuotesContextType {
  quotes: Record<string, number>;
  quoteVariations: Record<string, number>;
  quoteTimestamps: Record<string, string>;
  lastQuoteUpdatedAt: string | null;
  isFetchingQuotes: boolean;
  lastQuoteFetchResult: QuoteFetchResult | null;
  fetchQuotes: (
    tickers?: string[],
    overrideProvider?: QuoteProvider,
    settings?: UserSettings | null,
    overrideToken?: string,
    forceRefresh?: boolean
  ) => Promise<QuoteFetchResult | undefined>;
  setQuotes: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  updateQuoteCache: (
    newQuotes: Record<string, number>,
    newVariations?: Record<string, number>,
    newTimestamps?: Record<string, string>
  ) => Promise<void>;
  getQuoteAgeMinutes: (ticker: string) => number | null;
}

const QuotesContext = createContext<QuotesContextType | undefined>(undefined);

export function QuotesProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<Record<string, number>>(() => {
    return cacheManager.get<Record<string, number>>('cached_quotes') || {};
  });
  const [quoteVariations, setQuoteVariations] = useState<Record<string, number>>(() => {
    return cacheManager.get<Record<string, number>>('cached_quote_variations') || {};
  });
  const [quoteTimestamps, setQuoteTimestamps] = useState<Record<string, string>>(() => {
    return cacheManager.get<Record<string, string>>('cached_quote_timestamps') || {};
  });
  const [lastQuoteUpdatedAt, setLastQuoteUpdatedAt] = useState<string | null>(() => {
    return cacheManager.get<string>('last_quote_update_time') || null;
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

  const updateQuoteCache = useCallback(async (
    newQuotes: Record<string, number>,
    newVariations?: Record<string, number>,
    newTimestamps?: Record<string, string>
  ) => {
    const nowIso = new Date().toISOString();
    setLastQuoteUpdatedAt(nowIso);
    cacheManager.set('last_quote_update_time', nowIso, undefined, 'quotes');

    setQuotes(prev => {
      const merged = { ...prev, ...newQuotes };
      cacheManager.set('cached_quotes', merged, undefined, 'quotes');
      return merged;
    });

    if (newVariations && Object.keys(newVariations).length > 0) {
      setQuoteVariations(prev => {
        const merged = { ...prev, ...newVariations };
        cacheManager.set('cached_quote_variations', merged, undefined, 'quotes');
        return merged;
      });
    }

    if (newTimestamps && Object.keys(newTimestamps).length > 0) {
      setQuoteTimestamps(prev => {
        const merged = { ...prev, ...newTimestamps };
        cacheManager.set('cached_quote_timestamps', merged, undefined, 'quotes');
        return merged;
      });
    }

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

  const getQuoteAgeMinutes = useCallback((ticker: string): number | null => {
    const tk = ticker.trim().toUpperCase();
    const timeStr = quoteTimestamps[tk] || lastQuoteUpdatedAt;
    if (!timeStr) return null;
    const diffMs = Date.now() - new Date(timeStr).getTime();
    if (isNaN(diffMs) || diffMs < 0) return 0;
    return Math.round(diffMs / 60000);
  }, [quoteTimestamps, lastQuoteUpdatedAt]);

  const fetchQuotes = useCallback(async (
    tickers: string[] = [],
    overrideProvider?: QuoteProvider,
    settings?: UserSettings | null,
    overrideToken?: string,
    forceRefresh?: boolean
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
        existingQuotes: forceRefresh ? undefined : quotes,
        forceRefresh,
      });

      setLastQuoteFetchResult(result);
      if (result && result.quotes && Object.keys(result.quotes).length > 0) {
        setQuotes(prev => ({ ...prev, ...result.quotes }));
        if (result.variations) {
          setQuoteVariations(prev => ({ ...prev, ...result.variations }));
        }
        if (result.timestamps) {
          setQuoteTimestamps(prev => ({ ...prev, ...result.timestamps }));
        }
        // Asynchronously update cache in db & localStorage
        updateQuoteCache(result.quotes, result.variations, result.timestamps);
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
    quoteVariations,
    quoteTimestamps,
    lastQuoteUpdatedAt,
    isFetchingQuotes,
    lastQuoteFetchResult,
    fetchQuotes,
    setQuotes,
    updateQuoteCache,
    getQuoteAgeMinutes,
  }), [
    quotes,
    quoteVariations,
    quoteTimestamps,
    lastQuoteUpdatedAt,
    isFetchingQuotes,
    lastQuoteFetchResult,
    fetchQuotes,
    updateQuoteCache,
    getQuoteAgeMinutes,
  ]);

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
