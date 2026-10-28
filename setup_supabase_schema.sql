-- ==============================================================================
-- FINANÇAS PRO & MOTO GESTÃO - SCHEMA COMPLETO DO SUPABASE (SETUP DO ZERO)
-- Versão: 2.5 (Produção)
-- Gerado para: Migração Zero Data Loss para novo servidor/conta Supabase
-- Inclui: 18 Tabelas, Colunas, Índices de Performance, RLS e Permissões Universais
-- ==============================================================================

BEGIN;

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. CONFIGURAÇÕES E PERFIS DE USUÁRIOS (user_settings)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id TEXT PRIMARY KEY,
    full_name TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    active_vehicle_id TEXT,
    
    -- Tarifas e Parâmetros Operacionais (Pizzaria / Moto)
    pizzaria_base_deliveries INTEGER DEFAULT 0,
    pizzaria_base_rate NUMERIC DEFAULT 0,
    pizzaria_daily_rate_above_base NUMERIC DEFAULT 0,
    pizzaria_delivery_rate NUMERIC DEFAULT 0,
    pizzaria_out_of_neighborhood_rate NUMERIC DEFAULT 0,
    
    -- Categorias Customizadas
    expense_categories JSONB DEFAULT '[]'::jsonb,
    operational_expense_categories JSONB DEFAULT '[]'::jsonb,
    personal_expense_categories JSONB DEFAULT '[]'::jsonb,
    income_categories JSONB DEFAULT '[]'::jsonb,
    vehicle_categories JSONB DEFAULT '[]'::jsonb,
    categories_with_km JSONB DEFAULT '[]'::jsonb,
    category_icons JSONB DEFAULT '{}'::jsonb,

    -- Parâmetros Veiculares e Metas
    vehicle_km_per_liter NUMERIC DEFAULT 35,
    fuel_price NUMERIC DEFAULT 5.89,
    initial_balance NUMERIC DEFAULT 0,
    weekly_goal NUMERIC DEFAULT 0,
    weekly_net_goal NUMERIC DEFAULT 0,
    default_driver_labor NUMERIC DEFAULT 0,

    -- Parâmetros de Investimentos e Cotações
    default_investment_reserve_id TEXT,
    cached_quotes JSONB DEFAULT '{}'::jsonb,
    quote_provider TEXT DEFAULT 'auto',
    brapi_token TEXT,
    asset_cnpjs JSONB DEFAULT '{}'::jsonb,
    rebalance_targets JSONB DEFAULT '{}'::jsonb,

    -- Biometria e Segurança de Sessão
    biometrics_enabled BOOLEAN DEFAULT FALSE,
    biometrics_auto_lock_minutes INTEGER DEFAULT 5,
    biometrics_device_info JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 2. TRANSAÇÕES FINANCEIRAS (transactions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    
    -- Dados Operacionais / Entregas
    start_km NUMERIC,
    end_km NUMERIC,
    deliveries INTEGER,
    out_of_neighborhood INTEGER,
    is_reserve_use BOOLEAN DEFAULT FALSE,
    dividend_id TEXT,
    is_investment_tx BOOLEAN DEFAULT FALSE,
    is_reserve_aporte BOOLEAN DEFAULT FALSE,
    is_dividend_tx BOOLEAN DEFAULT FALSE,

    -- Status de Pagamento / Vencimento
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending')),
    payment_date DATE,
    due_date DATE,

    -- Recorrência e Parcelamento
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_frequency TEXT,
    recurrence_installments INTEGER,
    recurrence_group_id TEXT,
    installment_number INTEGER,
    installment_total INTEGER,
    installment_index INTEGER,
    total_installments INTEGER,

    -- Vínculo com Veículo / Abastecimento
    vehicle_id TEXT,
    fuel_liters NUMERIC,
    fuel_price_per_liter NUMERIC,
    fuel_station TEXT,
    refuel_km NUMERIC,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON public.transactions(user_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_due_date ON public.transactions(due_date) WHERE payment_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_transactions_recurrence_group ON public.transactions(recurrence_group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_vehicle ON public.transactions(vehicle_id);

-- ==============================================================================
-- 3. RESERVAS FINANCEIRAS / COFRINHOS (reserves)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reserves (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#10b981',
    icon TEXT NOT NULL DEFAULT 'PiggyBank',
    saldo_inicial NUMERIC NOT NULL DEFAULT 0,
    saldo_atual NUMERIC DEFAULT 0,
    suggested_balance NUMERIC DEFAULT 0,
    meta_objetivo NUMERIC,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    
    -- Automações de Aporte
    regra_tipo TEXT,
    regra_valor NUMERIC,
    regra_categorias JSONB DEFAULT '[]'::jsonb,
    regra_base TEXT DEFAULT 'bruto',
    regra_ativa BOOLEAN DEFAULT TRUE,
    require_category_on_use BOOLEAN DEFAULT FALSE,
    default_use_category TEXT,
    rule_history JSONB DEFAULT '[]'::jsonb,
    is_paused BOOLEAN DEFAULT FALSE,
    regra_inicio_validade DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garantir adição de coluna se a tabela já existir no Supabase
ALTER TABLE public.reserves ADD COLUMN IF NOT EXISTS suggested_balance NUMERIC DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_reserves_user_status ON public.reserves(user_id, status);

-- ==============================================================================
-- 4. EXTRATO DE RESERVAS (reserve_transactions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reserve_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    reserve_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('aporte', 'utilizacao', 'rendimento')),
    amount NUMERIC NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    category TEXT,
    description TEXT,
    linked_investment_id TEXT,
    transaction_id TEXT,
    source TEXT DEFAULT 'manual',
    batch_id TEXT,

    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending')),
    payment_date DATE,
    due_date DATE,

    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_frequency TEXT,
    recurrence_installments INTEGER,
    recurrence_group_id TEXT,
    installment_number INTEGER,
    installment_total INTEGER,
    installment_index INTEGER,
    total_installments INTEGER,

    vehicle_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reserve_tx_user_reserve ON public.reserve_transactions(user_id, reserve_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_reserve_tx_payment_status ON public.reserve_transactions(payment_status);

-- ==============================================================================
-- 5. OPERAÇÕES DE INVESTIMENTOS (investment_transactions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.investment_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    operation TEXT NOT NULL CHECK (operation IN ('buy', 'sell')),
    type TEXT NOT NULL,
    ticker TEXT NOT NULL,
    cnpj TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    price NUMERIC NOT NULL DEFAULT 0,
    quantity NUMERIC NOT NULL DEFAULT 0,
    costs NUMERIC DEFAULT 0,
    reserve_id TEXT,
    transaction_id TEXT,
    date DATE NOT NULL,
    description TEXT,
    asset_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_user_ticker ON public.investment_transactions(user_id, ticker);
CREATE INDEX IF NOT EXISTS idx_investments_date ON public.investment_transactions(user_id, date DESC);

-- ==============================================================================
-- 6. PROVENTOS & DIVIDENDOS (dividends)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.dividends (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    unit_amount NUMERIC DEFAULT 0,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'provisioned', 'cancelled')),
    date DATE NOT NULL,
    data_com DATE,
    data_ex DATE,
    description TEXT,
    transaction_id TEXT,
    source_provider TEXT DEFAULT 'manual',
    source_event_id TEXT,
    source_document_id TEXT,
    source_document_version INTEGER,
    source_url TEXT,
    source_published_at TIMESTAMPTZ,
    source_updated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    eligible_quantity NUMERIC,
    validation_status TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dividends_user_ticker ON public.dividends(user_id, ticker);
CREATE INDEX IF NOT EXISTS idx_dividends_date ON public.dividends(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_dividends_status ON public.dividends(user_id, status);

-- ==============================================================================
-- 7. VALUATION E PREÇO TETO (valuation_targets)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.valuation_targets (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    asset_type TEXT DEFAULT 'Ação',
    cnpj TEXT,
    calc_current_price NUMERIC,
    target_price NUMERIC,
    notes TEXT,
    bazin_dpa NUMERIC,
    bazin_target_yield NUMERIC,
    graham_lpa NUMERIC,
    graham_vpa NUMERIC,
    gordon_d1 NUMERIC,
    gordon_k NUMERIC,
    gordon_g NUMERIC,
    pl_target NUMERIC,
    pvp_target NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_valuation_user_ticker ON public.valuation_targets(user_id, ticker);

-- ==============================================================================
-- 12. METAS DE ALOCAÇÃO DE CARTEIRA (portfolio_target_allocations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.portfolio_target_allocations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    asset_type TEXT DEFAULT 'Ação',
    min_pct NUMERIC DEFAULT 1,
    target_pct NUMERIC DEFAULT 5,
    max_pct NUMERIC DEFAULT 15,
    is_locked BOOLEAN DEFAULT FALSE,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_alloc_user_ticker ON public.portfolio_target_allocations(user_id, ticker);

-- ==============================================================================
-- 13. CONFIGURAÇÕES DE REBALANCEAMENTO (portfolio_rules_config)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.portfolio_rules_config (
    user_id TEXT PRIMARY KEY DEFAULT 'default',
    active_strategy TEXT DEFAULT 'rebalance',
    gap_weight NUMERIC DEFAULT 40,
    quality_weight NUMERIC DEFAULT 25,
    valuation_weight NUMERIC DEFAULT 20,
    dividend_weight NUMERIC DEFAULT 10,
    liquidity_weight NUMERIC DEFAULT 5,
    max_asset_allocation_pct NUMERIC DEFAULT 15,
    max_sector_allocation_pct NUMERIC DEFAULT 25,
    min_daily_liquidity NUMERIC DEFAULT 1000000,
    max_debt_ebitda_allowed NUMERIC DEFAULT 3.5,
    max_fii_physical_vacancy_allowed NUMERIC DEFAULT 15,
    max_fii_pvp_allowed NUMERIC DEFAULT 1.08,
    min_score_allowed NUMERIC DEFAULT 45,
    allow_new_positions BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 14. METADADOS E FUNDAMENTOS DE ATIVOS B3 (b3_assets_metadata)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.b3_assets_metadata (
    ticker TEXT PRIMARY KEY,
    user_id TEXT,
    asset_type TEXT NOT NULL DEFAULT 'Ação',
    name TEXT,
    cnpj TEXT,
    sector TEXT,
    subsector TEXT,
    segment TEXT,
    issuer TEXT,
    administrator TEXT,
    market_cap NUMERIC,
    daily_liquidity NUMERIC,
    last_price NUMERIC,
    pl NUMERIC,
    pvp NUMERIC,
    psr NUMERIC,
    dividend_yield NUMERIC,
    p_ativo NUMERIC,
    p_cap_giro NUMERIC,
    p_ebit NUMERIC,
    p_ativ_circ_liq NUMERIC,
    ev_ebit NUMERIC,
    ev_ebitda NUMERIC,
    gross_margin NUMERIC,
    ebit_margin NUMERIC,
    net_margin NUMERIC,
    ebitda_margin NUMERIC,
    current_liquidity NUMERIC,
    roic NUMERIC,
    roe NUMERIC,
    net_worth NUMERIC,
    net_debt_over_equity NUMERIC,
    net_debt_over_ebitda NUMERIC,
    revenue_cagr_5y NUMERIC,
    profit_cagr_5y NUMERIC,
    payout NUMERIC,
    lpa NUMERIC,
    vpa NUMERIC,
    fii_type TEXT,
    fii_segment TEXT,
    ffo_yield NUMERIC,
    physical_vacancy NUMERIC,
    financial_vacancy NUMERIC,
    properties_count NUMERIC,
    price_per_sqm NUMERIC,
    rent_per_sqm NUMERIC,
    cap_rate NUMERIC,
    gross_lettable_area NUMERIC,
    top_tenants_share NUMERIC,
    description TEXT,
    source TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b3_assets_metadata_ticker ON public.b3_assets_metadata(ticker);

-- ==============================================================================
-- 15. HISTÓRICO DE INDICADORES B3 / RAIO-X (b3_assets_history)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.b3_assets_history (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    ticker TEXT NOT NULL,
    asset_type TEXT DEFAULT 'Ação',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT DEFAULT 'Fundamentus',
    price NUMERIC,
    dy NUMERIC,
    pvp NUMERIC,
    pl NUMERIC,
    roe NUMERIC,
    roic NUMERIC,
    vacancy NUMERIC,
    cap_rate NUMERIC,
    metrics_json JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_b3_assets_history_ticker ON public.b3_assets_history(ticker, recorded_at DESC);

-- ==============================================================================
-- 16. ORÇAMENTOS DE FRETE (freight_quotes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.freight_quotes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',
    
    -- Cliente
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_company TEXT,
    client_document TEXT,
    client_email TEXT,

    -- Prestador / Emissor
    driver_name TEXT,
    driver_phone TEXT,
    driver_company TEXT,
    driver_document TEXT,
    pix_key TEXT,
    pix_key_type TEXT DEFAULT 'phone',

    -- Rota e Logística
    vehicle_type TEXT NOT NULL DEFAULT 'moto',
    service_type TEXT NOT NULL DEFAULT 'express',
    origin_address TEXT NOT NULL,
    origin_neighborhood TEXT,
    origin_city TEXT,
    destination_address TEXT NOT NULL,
    destination_neighborhood TEXT,
    destination_city TEXT,
    additional_stops JSONB DEFAULT '[]'::jsonb,
    distance_km NUMERIC NOT NULL DEFAULT 0,
    is_round_trip BOOLEAN NOT NULL DEFAULT FALSE,
    total_calculated_km NUMERIC NOT NULL DEFAULT 0,

    -- Carga
    cargo_description TEXT,
    cargo_weight_kg NUMERIC,
    cargo_volume TEXT,
    cargo_value NUMERIC,
    scheduled_date DATE,
    scheduled_time TEXT,
    expected_payment_date DATE,

    -- Precificação e Taxas
    base_fee NUMERIC NOT NULL DEFAULT 0,
    price_per_km NUMERIC NOT NULL DEFAULT 0,
    extra_stops_fee NUMERIC DEFAULT 0,
    heavy_cargo_fee NUMERIC DEFAULT 0,
    stairs_floor_fee NUMERIC DEFAULT 0,
    urgent_or_rain_fee NUMERIC DEFAULT 0,
    night_fee NUMERIC DEFAULT 0,
    tolls_fee NUMERIC DEFAULT 0,
    waiting_hours_fee NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    discount_type TEXT DEFAULT 'fixed',
    discount_value NUMERIC DEFAULT 0,

    -- Custos do Motorista
    fuel_price NUMERIC DEFAULT 0,
    km_per_liter NUMERIC DEFAULT 0,
    maintenance_cost_per_km NUMERIC DEFAULT 0,
    estimated_fuel_cost NUMERIC DEFAULT 0,
    estimated_maintenance_cost NUMERIC DEFAULT 0,
    total_driver_cost NUMERIC DEFAULT 0,

    -- Resultados
    total_price NUMERIC NOT NULL DEFAULT 0,
    driver_net_profit NUMERIC DEFAULT 0,
    profit_margin_percent NUMERIC DEFAULT 0,

    payment_method TEXT DEFAULT 'pix',
    observations TEXT,
    terms_and_conditions TEXT,
    converted_to_transaction_id TEXT,
    converted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_freight_quotes_user ON public.freight_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_freight_quotes_code ON public.freight_quotes(code);

-- ==============================================================================
-- 17. PARÂMETROS DE FRETE DO MOTORISTA (freight_presets)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.freight_presets (
    user_id TEXT PRIMARY KEY DEFAULT 'default',
    driver_name TEXT,
    driver_phone TEXT,
    driver_company TEXT,
    driver_document TEXT,
    pix_key TEXT,
    pix_key_type TEXT DEFAULT 'phone',
    default_vehicle TEXT DEFAULT 'moto',
    default_price_per_km NUMERIC DEFAULT 2.80,
    default_base_fee NUMERIC DEFAULT 12.00,
    default_maintenance_per_km NUMERIC DEFAULT 0.25,
    default_stop_fee NUMERIC DEFAULT 6.00,
    default_terms TEXT,
    default_payment_method TEXT DEFAULT 'pix',
    vehicles JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 18. CADASTRO DE CLIENTES FREQUENTES DE FRETE (freight_clients)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.freight_clients (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    document TEXT,
    email TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freight_clients_user ON public.freight_clients(user_id);

-- ==============================================================================
-- HABILITAÇÃO DE ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- ==============================================================================
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_target_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_rules_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b3_assets_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b3_assets_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_clients ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- POLÍTICAS DE ACESSO UNIVERSAL PERMISSIVO (RLS)
-- ==============================================================================
DROP POLICY IF EXISTS "Acesso Total User Settings" ON public.user_settings;
CREATE POLICY "Acesso Total User Settings" ON public.user_settings FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Transactions" ON public.transactions;
CREATE POLICY "Acesso Total Transactions" ON public.transactions FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Reserves" ON public.reserves;
CREATE POLICY "Acesso Total Reserves" ON public.reserves FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Reserve Transactions" ON public.reserve_transactions;
CREATE POLICY "Acesso Total Reserve Transactions" ON public.reserve_transactions FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Investments" ON public.investment_transactions;
CREATE POLICY "Acesso Total Investments" ON public.investment_transactions FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Dividends" ON public.dividends;
CREATE POLICY "Acesso Total Dividends" ON public.dividends FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Valuation" ON public.valuation_targets;
CREATE POLICY "Acesso Total Valuation" ON public.valuation_targets FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Portfolio Target Allocations" ON public.portfolio_target_allocations;
CREATE POLICY "Acesso Total Portfolio Target Allocations" ON public.portfolio_target_allocations FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Portfolio Rules Config" ON public.portfolio_rules_config;
CREATE POLICY "Acesso Total Portfolio Rules Config" ON public.portfolio_rules_config FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total B3 Assets Metadata" ON public.b3_assets_metadata;
CREATE POLICY "Acesso Total B3 Assets Metadata" ON public.b3_assets_metadata FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total B3 Assets History" ON public.b3_assets_history;
CREATE POLICY "Acesso Total B3 Assets History" ON public.b3_assets_history FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Freight Quotes" ON public.freight_quotes;
CREATE POLICY "Acesso Total Freight Quotes" ON public.freight_quotes FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Freight Presets" ON public.freight_presets;
CREATE POLICY "Acesso Total Freight Presets" ON public.freight_presets FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Freight Clients" ON public.freight_clients;
CREATE POLICY "Acesso Total Freight Clients" ON public.freight_clients FOR ALL TO public USING (true) WITH CHECK (true);

-- ==============================================================================
-- CONCESSÃO DE PRIVILÉGIOS (GRANTS)
-- ==============================================================================
GRANT ALL ON TABLE public.user_settings TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.transactions TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.reserves TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.reserve_transactions TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.investment_transactions TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.dividends TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.valuation_targets TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.portfolio_target_allocations TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.portfolio_rules_config TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.b3_assets_metadata TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.b3_assets_history TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.freight_quotes TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.freight_presets TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.freight_clients TO anon, authenticated, service_role, postgres;

COMMIT;

-- FIM DO SCRIPT DE SETUP SUPABASE
