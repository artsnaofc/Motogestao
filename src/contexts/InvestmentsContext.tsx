import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { InvestmentTransaction, Dividend, UserSettings, ReserveTransaction, DividendAnalysisMode, ValuationTarget } from '../types';
import { AssetAllocationTarget, RebalanceRulesConfig, DEFAULT_REBALANCE_RULES } from '../lib/rebalanceEngine';
import { B3AssetHistoryRecord, getAssetTypeForTicker } from '../lib/b3Fundamentals';
import { toast } from 'sonner';
import { cacheManager } from '../lib/cacheManager';
import { syncQueueManager } from '../lib/syncQueue';

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
  targetAllocations: Record<string, AssetAllocationTarget>;
  saveTargetAllocations: (targets: Record<string, AssetAllocationTarget>) => Promise<void>;
  rulesConfig: RebalanceRulesConfig;
  saveRulesConfig: (config: RebalanceRulesConfig) => Promise<void>;
  b3AssetsMetadata: Record<string, any>;
  saveAssetMetadata: (asset: any, source?: string) => Promise<void>;
  bulkUpsertAssetsMetadata: (assets: any[], source?: string) => Promise<{ created: number; updated: number; errors: number }>;
  deleteAssetMetadata: (ticker: string) => Promise<void>;
  loadAssetHistory: (ticker: string) => Promise<B3AssetHistoryRecord[]>;
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
    return cacheManager.get<Record<string, ValuationTarget>>('valuation_targets_cache') || {};
  });

  const [targetAllocations, setTargetAllocations] = useState<Record<string, AssetAllocationTarget>>(() => {
    return cacheManager.get<Record<string, AssetAllocationTarget>>('portfolio_target_allocations_cache') || {};
  });

  const [rulesConfig, setRulesConfig] = useState<RebalanceRulesConfig>(() => {
    return cacheManager.get<RebalanceRulesConfig>('portfolio_rules_config_cache') || DEFAULT_REBALANCE_RULES;
  });

  const [b3AssetsMetadata, setB3AssetsMetadata] = useState<Record<string, any>>(() => {
    return cacheManager.get<Record<string, any>>('b3_assets_metadata_cache') || {};
  });

  // Load from Supabase on mount
  useEffect(() => {
    const loadSupabaseData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        // Load b3_assets_metadata
        try {
          const { data: metadataRows, error: metaErr } = await supabase
            .from('b3_assets_metadata')
            .select('*');

          if (!metaErr && metadataRows && metadataRows.length > 0) {
            const metaMap: Record<string, any> = {};
            metadataRows.forEach((row: any) => {
              metaMap[row.ticker] = row;
            });
            setB3AssetsMetadata(prev => {
              const merged = { ...prev, ...metaMap };
              cacheManager.set('b3_assets_metadata_cache', merged, undefined, 'investments');
              return merged;
            });
          }
        } catch (mErr) {
          console.warn('Could not load b3_assets_metadata from supabase:', mErr);
        }

        if (!user) return;

        // 1. Target Allocations
        const { data: allocData } = await supabase
          .from('portfolio_target_allocations')
          .select('*')
          .eq('user_id', user.id);

        if (allocData && allocData.length > 0) {
          const map: Record<string, AssetAllocationTarget> = {};
          allocData.forEach((row: any) => {
            map[row.ticker] = {
              ticker: row.ticker,
              type: row.asset_type || 'Ação',
              minPct: Number(row.min_pct || 1),
              targetPct: Number(row.target_pct || 5),
              maxPct: Number(row.max_pct || 15),
              locked: Boolean(row.is_locked),
              notes: row.notes
            };
          });
          setTargetAllocations(map);
          cacheManager.set('portfolio_target_allocations_cache', map, undefined, 'investments');
        }

        // 2. Rules Config
        const { data: rulesData } = await supabase
          .from('portfolio_rules_config')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (rulesData) {
          const conf: RebalanceRulesConfig = {
            activeStrategy: rulesData.active_strategy || 'rebalance',
            customWeights: {
              gapWeight: rulesData.gap_weight ?? 40,
              qualityWeight: rulesData.quality_weight ?? 25,
              valuationWeight: rulesData.valuation_weight ?? 20,
              dividendWeight: rulesData.dividend_weight ?? 10,
              liquidityWeight: rulesData.liquidity_weight ?? 5,
            },
            maxAssetAllocationPct: Number(rulesData.max_asset_allocation_pct ?? 15),
            maxSectorAllocationPct: Number(rulesData.max_sector_allocation_pct ?? 25),
            minDailyLiquidity: Number(rulesData.min_daily_liquidity ?? 1000000),
            maxDebtEbitdaAllowed: Number(rulesData.max_debt_ebitda_allowed ?? 3.5),
            maxFiiPhysicalVacancyAllowed: Number(rulesData.max_fii_physical_vacancy_allowed ?? 15),
            maxFiiPvpAllowed: Number(rulesData.max_fii_pvp_allowed ?? 1.08),
            minScoreAllowed: Number(rulesData.min_score_allowed ?? 45),
            allowNewPositions: Boolean(rulesData.allow_new_positions ?? false),
          };
          setRulesConfig(conf);
          cacheManager.set('portfolio_rules_config_cache', conf, undefined, 'investments');
        }
      } catch (e) {
        console.warn('Silent fallback loading supabase investment tables:', e);
      }
    };
    loadSupabaseData();
  }, []);
  const processingDividendsRef = useRef<Set<string>>(new Set());

  // Global Dividend Analysis Mode ('received_only' | 'include_provisioned')
  const [dividendAnalysisMode, setDividendAnalysisModeState] = useState<DividendAnalysisMode>(() => {
    const saved = cacheManager.get<string>('dividend_analysis_mode');
    if (saved === 'received_only' || saved === 'include_provisioned') {
      return saved as DividendAnalysisMode;
    }
    return 'received_only';
  });

  const setDividendAnalysisMode = useCallback((mode: DividendAnalysisMode) => {
    setDividendAnalysisModeState(mode);
    cacheManager.set('dividend_analysis_mode', mode, undefined, 'investments');
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
    const userId = userData.user?.id || 'default';

    const itObj: InvestmentTransaction = {
      id: generateUUID(),
      user_id: userId,
      ...newIt,
      created_at: new Date().toISOString(),
    };

    try {
      let rtObj: ReserveTransaction | null = null;
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

        rtObj = {
          id: rtId,
          user_id: userId,
          reserve_id: itObj.reserve_id,
          type: isBuy ? 'utilizacao' : 'aporte',
          amount: reserveAmount,
          date: itObj.date,
          category: 'Investimentos',
          description: `Investimento: ${isBuy ? 'Compra' : 'Venda'} ${itObj.ticker}`,
          linked_investment_id: itObj.id,
          created_at: new Date().toISOString(),
        };

        const curRts = cacheManager.get<ReserveTransaction[]>(`reserve_transactions_${userId}`) || [];
        cacheManager.set(`reserve_transactions_${userId}`, [rtObj, ...curRts.filter(r => r.id !== rtId)], undefined, 'reserves');
      }

      setInvestmentTransactions(prev => {
        const existing = [itObj, ...prev];
        cacheManager.set(`investment_transactions_${userId}`, existing, undefined, 'investments');
        return existing;
      });

      const itSupabasePayload: Record<string, any> = {
        id: itObj.id,
        user_id: itObj.user_id,
        operation: itObj.operation,
        type: itObj.type || 'Ação',
        ticker: itObj.ticker,
        amount: Number(itObj.amount) || 0,
        price: Number(itObj.price) || 0,
        quantity: Number(itObj.quantity) || 0,
        costs: Number(itObj.costs) || 0,
        date: itObj.date,
        created_at: itObj.created_at,
      };
      if (itObj.cnpj) itSupabasePayload.cnpj = itObj.cnpj;
      if (itObj.reserve_id) itSupabasePayload.reserve_id = itObj.reserve_id;
      if (itObj.description) itSupabasePayload.description = itObj.description;
      if (itObj.asset_type) itSupabasePayload.asset_type = itObj.asset_type;

      // 1. Enqueue investment transaction first (without circular transaction_id to avoid FK lock)
      syncQueueManager.enqueue('investment_transactions', 'insert', itObj.id, itSupabasePayload);

      // 2. If linked to a reserve, enqueue reserve transaction (linked_investment_id now refers to valid itObj.id)
      if (rtObj) {
        const rtSupabasePayload: Record<string, any> = {
          id: rtObj.id,
          user_id: rtObj.user_id,
          reserve_id: rtObj.reserve_id,
          type: rtObj.type,
          amount: rtObj.amount,
          date: rtObj.date,
          category: rtObj.category,
          description: rtObj.description,
          linked_investment_id: rtObj.linked_investment_id,
          created_at: rtObj.created_at,
        };

        syncQueueManager.enqueue('reserve_transactions', 'insert', rtObj.id, rtSupabasePayload);

        // 3. Link reserve transaction back to investment transaction via update
        if (itObj.transaction_id) {
          syncQueueManager.enqueue('investment_transactions', 'update', itObj.id, { transaction_id: itObj.transaction_id });
        }
      }

      toast.success('Lançamento de investimento registrado!');
      return itObj.id;
    } catch (err: any) {
      console.warn('Error queuing investment transaction:', err);
      toast.error('Erro ao salvar lançamento localmente.');
      return itObj.id;
    }
  }, []);

  const deleteInvestmentTransaction = useCallback(async (id: string) => {
    toast.loading('Processando exclusão...', { id: 'del-inv' });
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id || 'default';

    const targetTx = investmentTransactions.find(it => it.id === id);

    setInvestmentTransactions(prev => {
      const newState = prev.filter(it => it.id !== id);
      cacheManager.set(`investment_transactions_${userId}`, newState, undefined, 'investments');
      return newState;
    });

    if (targetTx?.transaction_id) {
      const curRts = cacheManager.get<ReserveTransaction[]>(`reserve_transactions_${userId}`) || [];
      cacheManager.set(`reserve_transactions_${userId}`, curRts.filter(r => r.id !== targetTx.transaction_id), undefined, 'reserves');
      syncQueueManager.enqueue('reserve_transactions', 'delete', targetTx.transaction_id);
    }
    syncQueueManager.enqueue('investment_transactions', 'delete', id);
    toast.success('Lançamento excluído!', { id: 'del-inv' });
  }, [investmentTransactions]);

  const updateInvestmentTransaction = useCallback(async (id: string, updatedFields: Partial<InvestmentTransaction>) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id || 'default';

    const targetTx = investmentTransactions.find(it => it.id === id);
    const merged = { ...targetTx, ...updatedFields } as InvestmentTransaction;

    setInvestmentTransactions(prev => {
      const newState = prev.map(it => it.id === id ? { ...it, ...updatedFields } : it);
      cacheManager.set(`investment_transactions_${userId}`, newState, undefined, 'investments');
      return newState;
    });

    const cleanPayload: Record<string, any> = {};
    const allowedKeys: (keyof InvestmentTransaction)[] = [
      'operation', 'type', 'ticker', 'cnpj', 'amount', 'price', 'quantity', 
      'costs', 'reserve_id', 'transaction_id', 'date', 'description', 'asset_type'
    ];
    for (const k of allowedKeys) {
      if (updatedFields[k] !== undefined) {
        cleanPayload[k] = updatedFields[k];
      }
    }

    syncQueueManager.enqueue('investment_transactions', 'update', id, cleanPayload);

    // Sync linked reserve transaction
    if (merged.reserve_id && targetTx?.transaction_id) {
      const isBuy = merged.operation === 'buy';
      const rtAmount = isBuy ? (merged.amount + (merged.costs || 0)) : Math.max(0, merged.amount - (merged.costs || 0));
      const rtPayload = {
        reserve_id: merged.reserve_id,
        type: isBuy ? 'utilizacao' as const : 'aporte' as const,
        amount: rtAmount,
        date: merged.date,
        description: `Investimento: ${isBuy ? 'Compra' : 'Venda'} ${merged.ticker}`
      };

      const curRts = cacheManager.get<ReserveTransaction[]>(`reserve_transactions_${userId}`) || [];
      cacheManager.set(`reserve_transactions_${userId}`, curRts.map(r => r.id === targetTx.transaction_id ? { ...r, ...rtPayload } : r), undefined, 'reserves');
      syncQueueManager.enqueue('reserve_transactions', 'update', targetTx.transaction_id, rtPayload);
    }

    toast.success('Lançamento atualizado!');
  }, [investmentTransactions]);

  const deleteInvestmentTransactionsByTicker = useCallback(async (ticker: string) => {
    toast.loading('Limpando posição de ' + ticker + '...', { id: 'del-ticker' });
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id || 'default';

    const txsToDelete = investmentTransactions.filter(it => it.ticker.toUpperCase() === ticker.toUpperCase());
    const txIds = txsToDelete.map(t => t.id);
    const rtIds = txsToDelete.map(t => t.transaction_id).filter(Boolean) as string[];

    setInvestmentTransactions(prev => {
      const newState = prev.filter(it => it.ticker.toUpperCase() !== ticker.toUpperCase());
      cacheManager.set(`investment_transactions_${userId}`, newState, undefined, 'investments');
      return newState;
    });

    rtIds.forEach(rtId => {
      syncQueueManager.enqueue('reserve_transactions', 'delete', rtId);
    });

    txIds.forEach(txId => {
      syncQueueManager.enqueue('investment_transactions', 'delete', txId);
    });

    toast.success('Lançamentos excluídos!', { id: 'del-ticker' });
  }, [investmentTransactions]);

  const addDividend = useCallback(async (newDiv: Omit<Dividend, 'id' | 'user_id' | 'created_at'>) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id || 'default';

    const divObj: Dividend = {
      id: generateUUID(),
      user_id: userId,
      ...newDiv,
      created_at: new Date().toISOString(),
    };

    setDividends(prev => {
      const existing = [divObj, ...prev];
      cacheManager.set(`dividends_${userId}`, existing, undefined, 'investments');
      return existing;
    });

    const divSupabasePayload: Record<string, any> = {
      id: divObj.id,
      user_id: divObj.user_id,
      ticker: divObj.ticker,
      amount: Number(divObj.amount) || 0,
      unit_amount: Number(divObj.unit_amount) || 0,
      type: divObj.type,
      status: divObj.status,
      date: divObj.date,
      created_at: divObj.created_at,
    };
    if (divObj.data_com) divSupabasePayload.data_com = divObj.data_com;
    if (divObj.data_ex) divSupabasePayload.data_ex = divObj.data_ex;
    if (divObj.description) divSupabasePayload.description = divObj.description;
    if (divObj.transaction_id) divSupabasePayload.transaction_id = divObj.transaction_id;

    syncQueueManager.enqueue('dividends', 'insert', divObj.id, divSupabasePayload);
    toast.success('Provento registrado!');
  }, []);

  const updateDividend = useCallback(async (id: string, updatedFields: Partial<Dividend>) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id || 'default';

    const currentDiv = dividends.find(d => d.id === id);
    const finalFields: Partial<Dividend> = { ...updatedFields };

    // If changing status from received to provisioned, remove linked reserve transaction if existing
    if (currentDiv && currentDiv.status === 'received' && updatedFields.status === 'provisioned') {
      if (currentDiv.transaction_id) {
        syncQueueManager.enqueue('reserve_transactions', 'delete', currentDiv.transaction_id);
        finalFields.transaction_id = undefined;
      }
    }

    setDividends(prev => {
      const existing = prev.map(d => d.id === id ? { ...d, ...finalFields } : d);
      cacheManager.set(`dividends_${userId}`, existing, undefined, 'investments');
      return existing;
    });

    const cleanPayload: Record<string, any> = {};
    const allowedKeys: (keyof Dividend)[] = [
      'ticker', 'amount', 'unit_amount', 'type', 'status', 'date', 
      'data_com', 'data_ex', 'description', 'transaction_id'
    ];
    for (const k of allowedKeys) {
      if (finalFields[k] !== undefined) {
        cleanPayload[k] = finalFields[k];
      }
    }

    syncQueueManager.enqueue('dividends', 'update', id, cleanPayload);
    toast.success('Provento atualizado!');
  }, [dividends]);

  const deleteDividend = useCallback(async (id: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id || 'default';

    const currentDiv = dividends.find(d => d.id === id);
    if (currentDiv?.transaction_id) {
      syncQueueManager.enqueue('reserve_transactions', 'delete', currentDiv.transaction_id);
    }

    setDividends(prev => {
      const existing = prev.filter(d => d.id !== id);
      cacheManager.set(`dividends_${userId}`, existing, undefined, 'investments');
      return existing;
    });

    syncQueueManager.enqueue('dividends', 'delete', id);
    toast.success('Provento removido!');
  }, [dividends]);

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
      cacheManager.set(`asset_cnpjs_${userId}`, newAssetCnpjs, undefined, 'settings');
    }
    toast.success(`CNPJ de ${tk} atualizado com sucesso!`);
  }, [settings, onUpdateSettings]);

  // Load Saved Valuations from Supabase & Cache on Mount
  useEffect(() => {
    const loadValuations = async () => {
      // 1. Check cache first
      const local = cacheManager.get<Record<string, ValuationTarget>>('valuation_targets_cache');
      if (local) {
        setValuationTargets(local);
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
            cacheManager.set('valuation_targets_cache', valMap, undefined, 'investments');
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
      cacheManager.set('valuation_targets_cache', next, undefined, 'investments');
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
      cacheManager.set('valuation_targets_cache', next, undefined, 'investments');
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

  // Save Target Allocations
  const saveTargetAllocations = useCallback(async (newTargets: Record<string, AssetAllocationTarget>) => {
    setTargetAllocations(newTargets);
    cacheManager.set('portfolio_target_allocations_cache', newTargets, undefined, 'investments');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const remainingTickers = Object.keys(newTargets);
        if (remainingTickers.length > 0) {
          const { data: existingRows } = await supabase
            .from('portfolio_target_allocations')
            .select('ticker')
            .eq('user_id', user.id);

          if (existingRows && existingRows.length > 0) {
            const tickersToDelete = existingRows
              .map((r: any) => r.ticker)
              .filter((tk: string) => !newTargets[tk]);

            if (tickersToDelete.length > 0) {
              await supabase
                .from('portfolio_target_allocations')
                .delete()
                .eq('user_id', user.id)
                .in('ticker', tickersToDelete);
            }
          }
        } else {
          await supabase
            .from('portfolio_target_allocations')
            .delete()
            .eq('user_id', user.id);
        }

        const rows = Object.values(newTargets).map(t => ({
          user_id: user.id,
          ticker: t.ticker,
          asset_type: t.type,
          min_pct: t.minPct,
          target_pct: t.targetPct,
          max_pct: t.maxPct,
          is_locked: t.locked,
          notes: t.notes || null,
          updated_at: new Date().toISOString()
        }));

        if (rows.length > 0) {
          const { error } = await supabase
            .from('portfolio_target_allocations')
            .upsert(rows, { onConflict: 'user_id,ticker' });
          if (error) console.warn('Supabase target allocations upsert warning:', error);
        }
      }
    } catch (err) {
      console.warn('Error persisting target allocations to Supabase:', err);
    }
  }, []);

  // Save Rules Config
  const saveRulesConfig = useCallback(async (newConfig: RebalanceRulesConfig) => {
    setRulesConfig(newConfig);
    cacheManager.set('portfolio_rules_config_cache', newConfig, undefined, 'investments');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('portfolio_rules_config')
          .upsert({
            user_id: user.id,
            active_strategy: newConfig.activeStrategy,
            gap_weight: newConfig.customWeights?.gapWeight ?? 40,
            quality_weight: newConfig.customWeights?.qualityWeight ?? 25,
            valuation_weight: newConfig.customWeights?.valuationWeight ?? 20,
            dividend_weight: newConfig.customWeights?.dividendWeight ?? 10,
            liquidity_weight: newConfig.customWeights?.liquidityWeight ?? 5,
            max_asset_allocation_pct: newConfig.maxAssetAllocationPct,
            max_sector_allocation_pct: newConfig.maxSectorAllocationPct,
            min_daily_liquidity: newConfig.minDailyLiquidity,
            max_debt_ebitda_allowed: newConfig.maxDebtEbitdaAllowed,
            max_fii_physical_vacancy_allowed: newConfig.maxFiiPhysicalVacancyAllowed,
            max_fii_pvp_allowed: newConfig.maxFiiPvpAllowed,
            min_score_allowed: newConfig.minScoreAllowed,
            allow_new_positions: newConfig.allowNewPositions,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        if (error) console.warn('Supabase rules config upsert warning:', error);
      }
    } catch (err) {
      console.warn('Error persisting rules config to Supabase:', err);
    }
  }, []);

  // Helper to ensure clean numeric values (or null)
  const cleanNum = (val: any): number | null => {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'string') {
      let s = val.replace(/[R$\s%]/g, '');
      if (s.includes('.') && s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else if (s.includes(',') && !s.includes('.')) {
        s = s.replace(',', '.');
      }
      const n = Number(s);
      return isNaN(n) ? null : n;
    }
    const n = Number(val);
    return isNaN(n) ? null : n;
  };

  // Save Single Asset Metadata
  const saveAssetMetadata = useCallback(async (asset: any, source: string = 'Manual') => {
    const ticker = (asset.ticker || '').toUpperCase().trim();
    if (!ticker) return;

    let userId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userId = user.id;
    } catch (e) {
      // ignore
    }

    const row = {
      user_id: userId,
      ticker,
      asset_type: asset.asset_type || asset.type || getAssetTypeForTicker(ticker),
      name: asset.name || ticker,
      cnpj: asset.cnpj || null,
      sector: asset.sector || (asset.segment || 'Outros'),
      subsector: asset.subsector || null,
      segment: asset.segment || null,
      issuer: asset.issuer || null,
      administrator: asset.administrator || null,
      market_cap: cleanNum(asset.market_cap ?? asset.marketCap),
      daily_liquidity: cleanNum(asset.daily_liquidity ?? asset.dailyLiquidity),
      last_price: cleanNum(asset.last_price ?? asset.lastPrice),
      pl: cleanNum(asset.pl),
      pvp: cleanNum(asset.pvp),
      psr: cleanNum(asset.psr),
      dividend_yield: cleanNum(asset.dividend_yield ?? asset.dividendYield),
      p_ativo: cleanNum(asset.p_ativo ?? asset.pAtivo),
      p_cap_giro: cleanNum(asset.p_cap_giro ?? asset.pCapGiro),
      p_ebit: cleanNum(asset.p_ebit ?? asset.pEbit),
      p_ativ_circ_liq: cleanNum(asset.p_ativ_circ_liq ?? asset.pAtivCircLiq),
      ev_ebit: cleanNum(asset.ev_ebit ?? asset.evEbit),
      ev_ebitda: cleanNum(asset.ev_ebitda ?? asset.evEbitda),
      gross_margin: cleanNum(asset.gross_margin ?? asset.grossMargin),
      ebit_margin: cleanNum(asset.ebit_margin ?? asset.ebitMargin),
      net_margin: cleanNum(asset.net_margin ?? asset.netMargin),
      ebitda_margin: cleanNum(asset.ebitda_margin ?? asset.ebitdaMargin),
      current_liquidity: cleanNum(asset.current_liquidity ?? asset.currentLiquidity),
      roic: cleanNum(asset.roic),
      roe: cleanNum(asset.roe),
      net_worth: cleanNum(asset.net_worth ?? asset.netWorth),
      net_debt_over_equity: cleanNum(asset.net_debt_over_equity ?? asset.netDebtOverEquity),
      net_debt_over_ebitda: cleanNum(asset.net_debt_over_ebitda ?? asset.netDebtOverEbitda),
      revenue_cagr_5y: cleanNum(asset.revenue_cagr_5y ?? asset.revenueCagr5y),
      profit_cagr_5y: cleanNum(asset.profit_cagr_5y ?? asset.profitCagr5y),
      payout: cleanNum(asset.payout),
      lpa: cleanNum(asset.lpa),
      vpa: cleanNum(asset.vpa),
      fii_type: asset.fii_type ?? asset.fiiType ?? null,
      fii_segment: asset.fii_segment ?? asset.fiiSegment ?? asset.segment ?? asset.sector ?? null,
      ffo_yield: cleanNum(asset.ffo_yield ?? asset.ffoYield),
      physical_vacancy: cleanNum(asset.physical_vacancy ?? asset.physicalVacancy ?? asset.vacancia_media ?? asset.vacanciaMedia ?? asset.vacancia),
      financial_vacancy: cleanNum(asset.financial_vacancy ?? asset.financialVacancy),
      properties_count: cleanNum(asset.properties_count ?? asset.propertiesCount ?? asset.qtd_imoveis ?? asset.qtdImoveis ?? asset.imoveis),
      price_per_sqm: cleanNum(asset.price_per_sqm ?? asset.pricePerSqm),
      rent_per_sqm: cleanNum(asset.rent_per_sqm ?? asset.rentPerSqm),
      cap_rate: cleanNum(asset.cap_rate ?? asset.capRate ?? asset.caprate ?? asset.taxa_cap),
      gross_lettable_area: cleanNum(asset.gross_lettable_area ?? asset.grossLettableArea),
      top_tenants_share: cleanNum(asset.top_tenants_share ?? asset.topTenantsShare),
      description: asset.description || null,
      source,
      updated_at: new Date().toISOString()
    };

    // Update state & cache
    setB3AssetsMetadata(prev => {
      const next = { ...prev, [ticker]: row };
      cacheManager.set('b3_assets_metadata_cache', next, undefined, 'investments');
      return next;
    });

    // Sync to Supabase
    try {
      const { error: metaErr } = await supabase
        .from('b3_assets_metadata')
        .upsert(row, { onConflict: 'ticker' });
      if (metaErr) console.warn('Supabase metadata upsert error:', metaErr);

      // Record snapshot in history
      const histRow = {
        user_id: userId,
        ticker,
        asset_type: row.asset_type,
        recorded_at: new Date().toISOString(),
        source,
        price: row.last_price,
        dy: row.dividend_yield,
        pvp: row.pvp,
        pl: row.pl,
        roe: row.roe,
        roic: row.roic,
        vacancy: row.physical_vacancy,
        cap_rate: row.cap_rate,
        metrics_json: row
      };

      const { error: histErr } = await supabase
        .from('b3_assets_history')
        .insert(histRow);
      if (histErr) console.warn('Supabase history record error:', histErr);
    } catch (e) {
      console.warn('Silent fallback saving asset metadata:', e);
    }
  }, []);

  // Bulk Upsert Assets Metadata (from Fundamentus paste or multi-import)
  const bulkUpsertAssetsMetadata = useCallback(async (assets: any[], source: string = 'Fundamentus') => {
    if (!assets || assets.length === 0) return { created: 0, updated: 0, errors: 0 };

    let userId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userId = user.id;
    } catch (e) {
      // ignore
    }

    let created = 0;
    let updated = 0;
    let errors = 0;
    const nowIso = new Date().toISOString();

    const dbRows: any[] = [];
    const histRows: any[] = [];
    const newMetaMap: Record<string, any> = {};

    assets.forEach(asset => {
      const ticker = (asset.ticker || '').toUpperCase().trim();
      if (!ticker) {
        errors++;
        return;
      }

      const isExisting = Boolean(b3AssetsMetadata[ticker]);
      if (isExisting) updated++;
      else created++;

      const isFii = asset.assetType === 'FII' || asset.asset_type === 'FII' || asset.type === 'FII' || (asset.fiiData !== undefined);
      const data = asset.fiiData || asset.stockData || asset;

      const row = {
        user_id: userId,
        ticker,
        asset_type: isFii ? 'FII' : 'Ação',
        name: data.name || `${ticker} ${isFii ? 'FII' : 'S.A.'}`,
        cnpj: data.cnpj || null,
        sector: data.sector || (isFii ? (data.segment || data.fii_segment || data.fiiSegment || 'Imobiliário') : (data.sector || 'Outros')),
        subsector: data.subsector || null,
        segment: data.segment || data.fii_segment || data.fiiSegment || null,
        issuer: data.issuer || null,
        administrator: data.administrator || null,
        market_cap: cleanNum(data.market_cap ?? data.marketCap),
        daily_liquidity: cleanNum(data.daily_liquidity ?? data.dailyLiquidity),
        last_price: cleanNum(data.last_price ?? data.lastPrice),
        pl: cleanNum(data.pl),
        pvp: cleanNum(data.pvp),
        psr: cleanNum(data.psr),
        dividend_yield: cleanNum(data.dividend_yield ?? data.dividendYield),
        p_ativo: cleanNum(data.p_ativo ?? data.pAtivo),
        p_cap_giro: cleanNum(data.p_cap_giro ?? data.pCapGiro),
        p_ebit: cleanNum(data.p_ebit ?? data.pEbit),
        p_ativ_circ_liq: cleanNum(data.p_ativ_circ_liq ?? data.pAtivCircLiq),
        ev_ebit: cleanNum(data.ev_ebit ?? data.evEbit),
        ev_ebitda: cleanNum(data.ev_ebitda ?? data.evEbitda),
        gross_margin: cleanNum(data.gross_margin ?? data.grossMargin),
        ebit_margin: cleanNum(data.ebit_margin ?? data.ebitMargin),
        net_margin: cleanNum(data.net_margin ?? data.netMargin),
        ebitda_margin: cleanNum(data.ebitda_margin ?? data.ebitdaMargin),
        current_liquidity: cleanNum(data.current_liquidity ?? data.currentLiquidity),
        roic: cleanNum(data.roic),
        roe: cleanNum(data.roe),
        net_worth: cleanNum(data.net_worth ?? data.netWorth),
        net_debt_over_equity: cleanNum(data.net_debt_over_equity ?? data.netDebtOverEquity),
        net_debt_over_ebitda: cleanNum(data.net_debt_over_ebitda ?? data.netDebtOverEbitda),
        revenue_cagr_5y: cleanNum(data.revenue_cagr_5y ?? data.revenueCagr5y),
        profit_cagr_5y: cleanNum(data.profit_cagr_5y ?? data.profitCagr5y),
        payout: cleanNum(data.payout),
        lpa: cleanNum(data.lpa),
        vpa: cleanNum(data.vpa),
        fii_type: isFii ? (data.fii_type ?? data.fiiType ?? 'Tijolo') : null,
        fii_segment: isFii ? (data.fii_segment ?? data.fiiSegment ?? data.segment ?? data.sector ?? 'Outros') : null,
        ffo_yield: cleanNum(data.ffo_yield ?? data.ffoYield),
        physical_vacancy: cleanNum(data.physical_vacancy ?? data.physicalVacancy ?? data.vacancia_media ?? data.vacanciaMedia ?? data.vacancia),
        financial_vacancy: cleanNum(data.financial_vacancy ?? data.financialVacancy),
        properties_count: cleanNum(data.properties_count ?? data.propertiesCount ?? data.qtd_imoveis ?? data.qtdImoveis ?? data.imoveis),
        price_per_sqm: cleanNum(data.price_per_sqm ?? data.pricePerSqm),
        rent_per_sqm: cleanNum(data.rent_per_sqm ?? data.rentPerSqm),
        cap_rate: cleanNum(data.cap_rate ?? data.capRate ?? data.caprate ?? data.taxa_cap),
        gross_lettable_area: cleanNum(data.gross_lettable_area ?? data.grossLettableArea),
        top_tenants_share: cleanNum(data.top_tenants_share ?? data.topTenantsShare),
        description: data.description || (isFii ? 'Fundo Imobiliário listado na B3.' : 'Empresa listada na B3.'),
        source,
        updated_at: nowIso
      };

      dbRows.push(row);
      newMetaMap[ticker] = row;

      histRows.push({
        user_id: userId,
        ticker,
        asset_type: row.asset_type,
        recorded_at: nowIso,
        source,
        price: row.last_price,
        dy: row.dividend_yield,
        pvp: row.pvp,
        pl: row.pl,
        roe: row.roe,
        roic: row.roic,
        vacancy: row.physical_vacancy,
        cap_rate: row.cap_rate,
        metrics_json: row
      });
    });

    // Update state and cache immediately
    setB3AssetsMetadata(prev => {
      const merged = { ...prev, ...newMetaMap };
      cacheManager.set('b3_assets_metadata_cache', merged, undefined, 'investments');
      return merged;
    });

    let supabaseError: string | null = null;

    // Persist to Supabase in chunks of 50
    try {
      const chunkSize = 50;
      for (let i = 0; i < dbRows.length; i += chunkSize) {
        const chunk = dbRows.slice(i, i + chunkSize);
        const { error: batchErr } = await supabase
          .from('b3_assets_metadata')
          .upsert(chunk, { onConflict: 'ticker' });
        if (batchErr) {
          console.warn('Batch metadata upsert error:', batchErr);
          supabaseError = batchErr.message || 'Erro ao atualizar tabela b3_assets_metadata no Supabase.';
        }
      }

      for (let i = 0; i < histRows.length; i += chunkSize) {
        const chunk = histRows.slice(i, i + chunkSize);
        const { error: histBatchErr } = await supabase
          .from('b3_assets_history')
          .insert(chunk);
        if (histBatchErr) {
          console.warn('Batch history insert warning:', histBatchErr);
          // Don't overwrite metadata error if already present
          if (!supabaseError && histBatchErr.code !== '42P01') {
            supabaseError = histBatchErr.message;
          }
        }
      }
    } catch (e: any) {
      console.warn('Silent fallback in bulk metadata upsert:', e);
      supabaseError = e?.message || 'Falha de comunicação com o Supabase.';
    }

    return { created, updated, errors, supabaseError };
  }, [b3AssetsMetadata]);

  // Delete Asset Metadata
  const deleteAssetMetadata = useCallback(async (ticker: string) => {
    const clean = (ticker || '').toUpperCase().trim();
    if (!clean) return;

    setB3AssetsMetadata(prev => {
      const next = { ...prev };
      delete next[clean];
      cacheManager.set('b3_assets_metadata_cache', next, undefined, 'investments');
      return next;
    });

    try {
      await supabase.from('b3_assets_metadata').delete().eq('ticker', clean);
      await supabase.from('b3_assets_history').delete().eq('ticker', clean);
    } catch (e) {
      console.warn('Silent fallback deleting asset metadata:', e);
    }
  }, []);

  // Load Asset History for Raio-X
  const loadAssetHistory = useCallback(async (ticker: string): Promise<B3AssetHistoryRecord[]> => {
    const clean = (ticker || '').toUpperCase().trim();
    if (!clean) return [];

    try {
      const { data, error } = await supabase
        .from('b3_assets_history')
        .select('*')
        .eq('ticker', clean)
        .order('recorded_at', { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          ticker: d.ticker,
          assetType: d.asset_type,
          recordedAt: d.recorded_at,
          source: d.source || 'Fundamentus',
          price: d.price,
          dy: d.dy,
          pvp: d.pvp,
          pl: d.pl,
          roe: d.roe,
          roic: d.roic,
          vacancy: d.vacancy,
          capRate: d.cap_rate,
          metricsJson: d.metrics_json || {}
        }));
      }
    } catch (e) {
      console.warn('Error loading asset history from supabase:', e);
    }
    return [];
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
    targetAllocations,
    saveTargetAllocations,
    rulesConfig,
    saveRulesConfig,
    b3AssetsMetadata,
    saveAssetMetadata,
    bulkUpsertAssetsMetadata,
    deleteAssetMetadata,
    loadAssetHistory,
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
    targetAllocations,
    saveTargetAllocations,
    rulesConfig,
    saveRulesConfig,
    b3AssetsMetadata,
    saveAssetMetadata,
    bulkUpsertAssetsMetadata,
    deleteAssetMetadata,
    loadAssetHistory,
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
