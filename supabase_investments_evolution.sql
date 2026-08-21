-- =========================================================================
-- MOTO-GESTÃO: SISTEMA PROFISSIONAL DE INVESTIMENTOS B3 (AÇÕES E FIIS)
-- MIGRATION INCREMENTAL SUPABASE - SCHEMA COMPLETO E IDEMPOTENTE
-- =========================================================================

-- 1. Habilita extensão UUID se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Atualizações em tabelas existentes de usuários, reservas e investimentos
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS asset_cnpjs JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS quote_provider TEXT DEFAULT 'auto';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS brapi_token TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS default_investment_reserve_id UUID REFERENCES public.reserves(id) ON DELETE SET NULL;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS cached_quotes JSONB DEFAULT '{}'::jsonb;

-- Atualizações na tabela de transações de investimento
ALTER TABLE public.investment_transactions ADD COLUMN IF NOT EXISTS costs NUMERIC DEFAULT 0;
ALTER TABLE public.investment_transactions ADD COLUMN IF NOT EXISTS reserve_id UUID REFERENCES public.reserves(id) ON DELETE SET NULL;
ALTER TABLE public.investment_transactions ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.reserve_transactions(id) ON DELETE SET NULL;

-- Atualizações na tabela de proventos/dividendos
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS unit_amount NUMERIC(10, 4);
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'received';
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS data_com DATE;
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS data_ex DATE;
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.reserve_transactions(id) ON DELETE SET NULL;

-- Atualizações na tabela de transações de reservas (vínculo reverso)
ALTER TABLE public.reserve_transactions ADD COLUMN IF NOT EXISTS linked_investment_id UUID REFERENCES public.investment_transactions(id) ON DELETE CASCADE;


-- 3. Tabela de Metadados e Indicadores Fundamentalistas de Ativos B3
-- Armazena cache e enriquecimento de Ações e FIIs
CREATE TABLE IF NOT EXISTS public.b3_assets_metadata (
  ticker TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('Ação', 'FII', 'Outro')),
  name TEXT NOT NULL,
  cnpj TEXT,
  sector TEXT,
  subsector TEXT,
  segment TEXT,
  issuer TEXT,
  administrator TEXT,
  market_cap NUMERIC(15, 2), -- Valor de mercado em R$
  daily_liquidity NUMERIC(15, 2), -- Volume financeiro médio diário em R$
  
  -- Indicadores específicos de Ações
  pl NUMERIC(10, 2),
  pvp NUMERIC(10, 2),
  roe NUMERIC(10, 2),
  roic NUMERIC(10, 2),
  net_margin NUMERIC(10, 2),
  ebitda_margin NUMERIC(10, 2),
  revenue_cagr_5y NUMERIC(10, 2),
  profit_cagr_5y NUMERIC(10, 2),
  net_debt_over_ebitda NUMERIC(10, 2),
  dividend_yield NUMERIC(10, 2),
  payout NUMERIC(10, 2),
  lpa NUMERIC(10, 2),
  vpa NUMERIC(10, 2),
  
  -- Indicadores específicos de FIIs
  fii_type TEXT,
  fii_segment TEXT,
  net_worth NUMERIC(15, 2),
  last_dividend NUMERIC(10, 4),
  physical_vacancy NUMERIC(10, 2),
  financial_vacancy NUMERIC(10, 2),
  properties_count INT,
  gross_lettable_area NUMERIC(15, 2),
  top_tenants_share NUMERIC(10, 2),
  
  description TEXT,
  last_price NUMERIC(12, 4),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS para b3_assets_metadata (leitura pública autenticada)
ALTER TABLE public.b3_assets_metadata ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access for b3_assets_metadata') THEN
    CREATE POLICY "Public read access for b3_assets_metadata"
      ON public.b3_assets_metadata FOR SELECT
      TO authenticated, anon
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert or update b3_assets_metadata') THEN
    CREATE POLICY "Authenticated users can insert or update b3_assets_metadata"
      ON public.b3_assets_metadata FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;


-- 4. Tabela de Metas e Faixas de Alocação por Ativo
-- Armazena as metas percentuais e faixas de rebalanceamento do investidor
CREATE TABLE IF NOT EXISTS public.portfolio_target_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('Ação', 'FII', 'Outro')),
  min_pct NUMERIC(5, 2) DEFAULT 1.00 NOT NULL,
  target_pct NUMERIC(5, 2) NOT NULL,
  max_pct NUMERIC(5, 2) DEFAULT 15.00 NOT NULL,
  is_locked BOOLEAN DEFAULT false NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, ticker)
);

ALTER TABLE public.portfolio_target_allocations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their target allocations') THEN
    CREATE POLICY "Users can manage their target allocations"
      ON public.portfolio_target_allocations FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_target_alloc_user ON public.portfolio_target_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_target_alloc_ticker ON public.portfolio_target_allocations(ticker);


-- 5. Tabela de Configuração do Motor de Regras e Estratégia de Rebalanceamento
CREATE TABLE IF NOT EXISTS public.portfolio_rules_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  active_strategy TEXT DEFAULT 'rebalance' NOT NULL,
  
  -- Pesos de Estratégia Customizada
  gap_weight INT DEFAULT 40 NOT NULL,
  quality_weight INT DEFAULT 25 NOT NULL,
  valuation_weight INT DEFAULT 20 NOT NULL,
  dividend_weight INT DEFAULT 10 NOT NULL,
  liquidity_weight INT DEFAULT 5 NOT NULL,
  
  -- Travas Prudenciais de Risco
  max_asset_allocation_pct NUMERIC(5, 2) DEFAULT 15.00 NOT NULL,
  max_sector_allocation_pct NUMERIC(5, 2) DEFAULT 25.00 NOT NULL,
  min_daily_liquidity NUMERIC(15, 2) DEFAULT 1000000.00 NOT NULL,
  max_debt_ebitda_allowed NUMERIC(5, 2) DEFAULT 3.50 NOT NULL,
  max_fii_physical_vacancy_allowed NUMERIC(5, 2) DEFAULT 15.00 NOT NULL,
  max_fii_pvp_allowed NUMERIC(5, 2) DEFAULT 1.08 NOT NULL,
  min_score_allowed INT DEFAULT 45 NOT NULL,
  allow_new_positions BOOLEAN DEFAULT false NOT NULL,
  
  -- Metas Macro
  stocks_macro_target_pct NUMERIC(5, 2) DEFAULT 60.00 NOT NULL,
  fiis_macro_target_pct NUMERIC(5, 2) DEFAULT 40.00 NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.portfolio_rules_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their portfolio rules config') THEN
    CREATE POLICY "Users can manage their portfolio rules config"
      ON public.portfolio_rules_config FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- 6. Tabela de Metas de Valuation e Preço Teto Customizados por Ativo
CREATE TABLE IF NOT EXISTS public.valuation_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  asset_type TEXT DEFAULT 'Ação',
  cnpj TEXT,
  calc_current_price NUMERIC(12, 4),
  bazin_dpa NUMERIC(12, 4),
  bazin_target_yield NUMERIC(6, 2),
  graham_lpa NUMERIC(12, 4),
  graham_vpa NUMERIC(12, 4),
  gordon_d1 NUMERIC(12, 4),
  gordon_k NUMERIC(6, 2),
  gordon_g NUMERIC(6, 2),
  pl_target NUMERIC(8, 2),
  pvp_target NUMERIC(8, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, ticker)
);

ALTER TABLE public.valuation_targets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their valuation targets') THEN
    CREATE POLICY "Users can manage their valuation targets"
      ON public.valuation_targets FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_valuation_targets_user ON public.valuation_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_valuation_targets_ticker ON public.valuation_targets(ticker);


-- 7. Tabela de Histórico de Simulações e Execuções de Aporte
CREATE TABLE IF NOT EXISTS public.rebalance_simulations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contribution_amount NUMERIC(12, 2) NOT NULL,
  strategy_used TEXT NOT NULL,
  total_allocated NUMERIC(12, 2) NOT NULL,
  unallocated_remainder NUMERIC(12, 2) DEFAULT 0.00,
  total_before NUMERIC(12, 2) NOT NULL,
  total_after NUMERIC(12, 2) NOT NULL,
  deviation_reduction_pct INT NOT NULL,
  executed BOOLEAN DEFAULT false NOT NULL,
  orders_json JSONB NOT NULL,
  metrics_summary_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.rebalance_simulations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view and save their simulations') THEN
    CREATE POLICY "Users can view and save their simulations"
      ON public.rebalance_simulations FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rebalance_sim_user ON public.rebalance_simulations(user_id);
CREATE INDEX IF NOT EXISTS idx_rebalance_sim_date ON public.rebalance_simulations(created_at DESC);

