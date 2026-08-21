-- Habilita a extensão UUID caso não esteja habilitada
create extension if not exists "uuid-ossp";

-- Cria a tabela transactions
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(10, 2) not null check (amount > 0),
  date date not null default current_date,
  category text not null,
  description text,
  start_km numeric(10, 2),
  end_km numeric(10, 2),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativa RLS (Row Level Security)
alter table transactions enable row level security;

-- Política de RLS: O usuário só pode ver as próprias transações
create policy "Users can view their own transactions"
  on transactions for select
  using (auth.uid() = user_id);

-- Política de RLS: O usuário só pode inserir as próprias transações
create policy "Users can insert their own transactions"
  on transactions for insert
  with check (auth.uid() = user_id);

-- Política de RLS: O usuário só pode atualizar as próprias transações
create policy "Users can update their own transactions"
  on transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Política de RLS: O usuário só pode deletar as próprias transações
create policy "Users can delete their own transactions"
  on transactions for delete
  using (auth.uid() = user_id);


-- Cria a tabela user_settings
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade not null,
  full_name text,
  pizzaria_base_deliveries int default 8,
  pizzaria_base_rate numeric(10, 2) default 90.00,
  pizzaria_daily_rate_above_base numeric(10, 2) default 50.00,
  pizzaria_delivery_rate numeric(10, 2) default 5.00,
  pizzaria_out_of_neighborhood_rate numeric(10, 2) default 4.00,
  expense_categories text[] default '{"Combustível", "Manutenção", "Alimentação", "Plano de Internet", "Equipamento", "Outras Despesas", "Outros"}'::text[],
  income_categories text[] default '{"iFood", "Uber", "99Moto", "Particular", "Gorjeta", "Frete do Dia", "Pizzaria", "Outros"}'::text[],
  vehicle_km_per_liter numeric(10, 2) default 30.00,
  fuel_price numeric(10, 2) default 6.00,
  default_driver_labor numeric(10, 2) default 100.00,
  initial_balance numeric(10, 2) default 0.00,
  categories_with_km text[] default '{"iFood", "Uber", "99Moto", "Pizzaria", "Frete do Dia"}'::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativa RLS (Row Level Security)
alter table user_settings enable row level security;

-- Políticas para user_settings
create policy "Users can view their own settings"
  on user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own settings"
  on user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings"
  on user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- Cria a tabela reserves
create table reserves (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  color text default '#e11d48' not null,
  icon text default 'PiggyBank' not null,
  saldo_inicial numeric(10, 2) default 0.00 not null,
  status text check (status in ('active', 'inactive')) default 'active' not null,
  regra_tipo text check (regra_tipo in ('km', 'bruto', 'liquido', 'fixo', 'personalizado')),
  regra_valor numeric(12, 4),
  regra_categorias text[],
  regra_base text check (regra_base in ('bruto', 'liquido', 'lucro')),
  regra_ativa boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativa RLS
alter table reserves enable row level security;

-- Políticas RLS para reserves
create policy "Users can view their own reserves"
  on reserves for select
  using (auth.uid() = user_id);

create policy "Users can insert their own reserves"
  on reserves for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own reserves"
  on reserves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own reserves"
  on reserves for delete
  using (auth.uid() = user_id);


-- Cria a tabela reserve_transactions
create table reserve_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  reserve_id uuid references reserves(id) on delete cascade not null,
  type text not null check (type in ('aporte', 'utilizacao')),
  amount numeric(10, 2) not null check (amount > 0),
  date date not null default current_date,
  category text,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativa RLS
alter table reserve_transactions enable row level security;

-- Políticas RLS para reserve_transactions
create policy "Users can view their own reserve transactions"
  on reserve_transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own reserve transactions"
  on reserve_transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own reserve transactions"
  on reserve_transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own reserve transactions"
  on reserve_transactions for delete
  using (auth.uid() = user_id);

-- Adiciona linked_investment_id em reserve_transactions
ALTER TABLE reserve_transactions ADD COLUMN IF NOT EXISTS linked_investment_id uuid REFERENCES public.investment_transactions(id) ON DELETE CASCADE;


-- Cria a tabela investment_transactions
CREATE TABLE IF NOT EXISTS investment_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('buy', 'sell')),
  type text NOT NULL CHECK (type IN ('Ação', 'FII', 'Outro')),
  ticker text NOT NULL,
  amount numeric NOT NULL,
  price numeric NOT NULL,
  quantity numeric NOT NULL,
  costs numeric DEFAULT 0,
  reserve_id uuid REFERENCES reserves(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES reserve_transactions(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own investment transactions"
  ON investment_transactions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS investment_transactions_user_id_idx ON investment_transactions (user_id);
CREATE INDEX IF NOT EXISTS investment_transactions_ticker_idx ON investment_transactions (ticker);


-- Cria a tabela dividends (proventos)
CREATE TABLE IF NOT EXISTS dividends (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  amount numeric NOT NULL,
  unit_amount numeric(10, 4),
  type text NOT NULL CHECK (type IN ('Dividendo', 'JCP', 'Rendimento')),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'provisioned')),
  date date NOT NULL,
  data_com date,
  data_ex date,
  description text,
  transaction_id uuid REFERENCES reserve_transactions(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE dividends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own dividends"
  ON dividends FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS dividends_user_id_idx ON dividends (user_id);
CREATE INDEX IF NOT EXISTS dividends_ticker_idx ON dividends (ticker);


-- Tabela de Metadados e Indicadores Fundamentalistas B3
CREATE TABLE IF NOT EXISTS b3_assets_metadata (
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

ALTER TABLE b3_assets_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for b3_assets_metadata"
  ON b3_assets_metadata FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Authenticated modify for b3_assets_metadata"
  ON b3_assets_metadata FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- Tabela de Metas de Alocação por Ativo
CREATE TABLE IF NOT EXISTS portfolio_target_allocations (
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

ALTER TABLE portfolio_target_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their target allocations"
  ON portfolio_target_allocations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_target_alloc_user ON portfolio_target_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_target_alloc_ticker ON portfolio_target_allocations(ticker);


-- Tabela de Configuração do Motor de Regras
CREATE TABLE IF NOT EXISTS portfolio_rules_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  active_strategy TEXT DEFAULT 'rebalance' NOT NULL,
  gap_weight INT DEFAULT 40 NOT NULL,
  quality_weight INT DEFAULT 25 NOT NULL,
  valuation_weight INT DEFAULT 20 NOT NULL,
  dividend_weight INT DEFAULT 10 NOT NULL,
  liquidity_weight INT DEFAULT 5 NOT NULL,
  max_asset_allocation_pct NUMERIC(5, 2) DEFAULT 15.00 NOT NULL,
  max_sector_allocation_pct NUMERIC(5, 2) DEFAULT 25.00 NOT NULL,
  min_daily_liquidity NUMERIC(15, 2) DEFAULT 1000000.00 NOT NULL,
  max_debt_ebitda_allowed NUMERIC(5, 2) DEFAULT 3.50 NOT NULL,
  max_fii_physical_vacancy_allowed NUMERIC(5, 2) DEFAULT 15.00 NOT NULL,
  max_fii_pvp_allowed NUMERIC(5, 2) DEFAULT 1.08 NOT NULL,
  min_score_allowed INT DEFAULT 45 NOT NULL,
  allow_new_positions BOOLEAN DEFAULT false NOT NULL,
  stocks_macro_target_pct NUMERIC(5, 2) DEFAULT 60.00 NOT NULL,
  fiis_macro_target_pct NUMERIC(5, 2) DEFAULT 40.00 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE portfolio_rules_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their portfolio rules config"
  ON portfolio_rules_config FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- Tabela de Valuation Targets
CREATE TABLE IF NOT EXISTS valuation_targets (
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

ALTER TABLE valuation_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their valuation targets"
  ON valuation_targets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_valuation_targets_user ON valuation_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_valuation_targets_ticker ON valuation_targets(ticker);


