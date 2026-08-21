-- =========================================================================
-- MOTO-GESTÃO: ATUALIZAÇÃO B3 FUNDAMENTALISTA E METADADOS
-- Execute este script no SQL Editor do seu projeto Supabase se necessário.
-- =========================================================================

-- 1. Habilita a extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Metadados de Ativos B3 (Ações e FIIs)
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
  market_cap NUMERIC(15, 2),
  daily_liquidity NUMERIC(15, 2),
  
  -- Indicadores Ações & Fundamentus
  pl NUMERIC(10, 2),
  pvp NUMERIC(10, 2),
  psr NUMERIC(10, 2),
  roe NUMERIC(10, 2),
  roic NUMERIC(10, 2),
  gross_margin NUMERIC(10, 2),
  ebit_margin NUMERIC(10, 2),
  net_margin NUMERIC(10, 2),
  ebitda_margin NUMERIC(10, 2),
  revenue_cagr_5y NUMERIC(10, 2),
  profit_cagr_5y NUMERIC(10, 2),
  current_liquidity NUMERIC(10, 2),
  net_debt_over_equity NUMERIC(10, 2),
  net_debt_over_ebitda NUMERIC(10, 2),
  dividend_yield NUMERIC(10, 2),
  payout NUMERIC(10, 2),
  lpa NUMERIC(10, 2),
  vpa NUMERIC(10, 2),
  p_ativo NUMERIC(10, 2),
  p_cap_giro NUMERIC(10, 2),
  p_ebit NUMERIC(10, 2),
  p_ativ_circ_liq NUMERIC(10, 2),
  ev_ebit NUMERIC(10, 2),
  ev_ebitda NUMERIC(10, 2),
  net_worth NUMERIC(15, 2),
  
  -- Indicadores FIIs
  fii_type TEXT,
  fii_segment TEXT,
  ffo_yield NUMERIC(10, 2),
  last_dividend NUMERIC(10, 4),
  physical_vacancy NUMERIC(10, 2),
  financial_vacancy NUMERIC(10, 2),
  properties_count INT,
  price_per_sqm NUMERIC(12, 2),
  rent_per_sqm NUMERIC(12, 2),
  cap_rate NUMERIC(10, 2),
  gross_lettable_area NUMERIC(15, 2),
  top_tenants_share NUMERIC(10, 2),
  
  description TEXT,
  last_price NUMERIC(12, 4),
  source TEXT DEFAULT 'Fundamentus',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adiciona colunas retroativamente caso a tabela já existisse com menos colunas
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS psr NUMERIC(10, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS p_ativo NUMERIC(10, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS p_cap_giro NUMERIC(10, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS p_ebit NUMERIC(10, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS p_ativ_circ_liq NUMERIC(10, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS ev_ebit NUMERIC(10, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS ev_ebitda NUMERIC(10, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS gross_margin NUMERIC(10, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS ebit_margin NUMERIC(10, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS current_liquidity NUMERIC(10, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS net_debt_over_equity NUMERIC(10, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS ffo_yield NUMERIC(10, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS price_per_sqm NUMERIC(12, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS rent_per_sqm NUMERIC(12, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS cap_rate NUMERIC(10, 2);
ALTER TABLE public.b3_assets_metadata ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Fundamentus';

-- 3. Habilita RLS e Permissões para Leitura/Escrita
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public modify for b3_assets_metadata') THEN
    CREATE POLICY "Public modify for b3_assets_metadata"
      ON public.b3_assets_metadata FOR ALL
      TO authenticated, anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 4. Tabela de Registros Históricos de Ativos B3
CREATE TABLE IF NOT EXISTS public.b3_assets_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ticker TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  source TEXT DEFAULT 'Fundamentus',
  price NUMERIC(12, 4),
  dy NUMERIC(10, 2),
  pvp NUMERIC(10, 2),
  pl NUMERIC(10, 2),
  roe NUMERIC(10, 2),
  roic NUMERIC(10, 2),
  vacancy NUMERIC(10, 2),
  cap_rate NUMERIC(10, 2),
  metrics_json JSONB
);

-- Adiciona colunas retroativamente em b3_assets_history caso a tabela já existisse
ALTER TABLE public.b3_assets_history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.b3_assets_history ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.b3_assets_history ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Fundamentus';
ALTER TABLE public.b3_assets_history ADD COLUMN IF NOT EXISTS price NUMERIC(12, 4);
ALTER TABLE public.b3_assets_history ADD COLUMN IF NOT EXISTS dy NUMERIC(10, 2);
ALTER TABLE public.b3_assets_history ADD COLUMN IF NOT EXISTS pvp NUMERIC(10, 2);
ALTER TABLE public.b3_assets_history ADD COLUMN IF NOT EXISTS pl NUMERIC(10, 2);
ALTER TABLE public.b3_assets_history ADD COLUMN IF NOT EXISTS roe NUMERIC(10, 2);
ALTER TABLE public.b3_assets_history ADD COLUMN IF NOT EXISTS roic NUMERIC(10, 2);
ALTER TABLE public.b3_assets_history ADD COLUMN IF NOT EXISTS vacancy NUMERIC(10, 2);
ALTER TABLE public.b3_assets_history ADD COLUMN IF NOT EXISTS cap_rate NUMERIC(10, 2);
ALTER TABLE public.b3_assets_history ADD COLUMN IF NOT EXISTS metrics_json JSONB;

ALTER TABLE public.b3_assets_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public access for b3_assets_history') THEN
    CREATE POLICY "Public access for b3_assets_history"
      ON public.b3_assets_history FOR ALL
      TO authenticated, anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_b3_history_ticker ON public.b3_assets_history(ticker);
CREATE INDEX IF NOT EXISTS idx_b3_history_date ON public.b3_assets_history(recorded_at DESC);
