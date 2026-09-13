-- ==============================================================================
-- FINANÇAS PRO & MOTO GESTÃO - MIGRATION SUPABASE COMPLETA E ATUALIZADA
-- Data: 2026-08-30
-- Descrição:
--   1. Tabelas de Transações, Reservas, Configurações, Investimentos, Dividendos e Fretes
--   2. Novas Colunas: Despesas Pendentes (Contas a Pagar) e Sistema de Recorrência
--   3. Índices de Alta Performance para Extrato e Dashboard
--   4. Políticas de Segurança RLS (Row Level Security)
-- ==============================================================================

-- Habilitar extensão UUID caso necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. TABELA DE TRANSAÇÕES FINANCEIRAS (transactions)
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
    
    -- Dados Operacionais / Moto
    start_km NUMERIC,
    end_km NUMERIC,
    deliveries INTEGER,
    out_of_neighborhood INTEGER,
    is_reserve_use BOOLEAN DEFAULT FALSE,
    dividend_id TEXT,

    -- Status de Pagamento / Contas a Pagar
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending')),
    payment_date DATE,
    due_date DATE,

    -- Sistema de Recorrência e Parcelamento
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_frequency TEXT CHECK (recurrence_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly')),
    recurrence_installments INTEGER,
    recurrence_group_id TEXT,
    installment_number INTEGER,
    installment_total INTEGER,
    installment_index INTEGER,
    total_installments INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garantir adição de colunas caso a tabela já exista
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recurrence_installments INTEGER;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recurrence_group_id TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS installment_number INTEGER;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS installment_total INTEGER;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS installment_index INTEGER;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS total_installments INTEGER;

-- Índices otimizados para consultas do Extrato, Dashboard e Pendências
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON public.transactions(user_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_due_date ON public.transactions(due_date) WHERE payment_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_transactions_recurrence_group ON public.transactions(recurrence_group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(user_id, category);

-- ==============================================================================
-- 2. TABELA DE RESERVAS / COFRINHOS (reserves)
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
    meta_objetivo NUMERIC,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    
    -- Regras de Automação
    regra_tipo TEXT CHECK (regra_tipo IN ('km', 'bruto', 'liquido', 'fixo', 'personalizado')),
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

CREATE INDEX IF NOT EXISTS idx_reserves_user_status ON public.reserves(user_id, status);

-- ==============================================================================
-- 3. TABELA DE MOVIMENTAÇÕES DE RESERVA (reserve_transactions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reserve_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    reserve_id TEXT NOT NULL REFERENCES public.reserves(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('aporte', 'utilizacao', 'rendimento')),
    amount NUMERIC NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    category TEXT,
    description TEXT,
    linked_investment_id TEXT,
    transaction_id TEXT,
    source TEXT DEFAULT 'manual',
    batch_id TEXT,

    -- Status de Pagamento / Vencimento para Reservas
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending')),
    payment_date DATE,
    due_date DATE,

    -- Sistema de Recorrência e Parcelamento para Reservas
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_frequency TEXT CHECK (recurrence_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly')),
    recurrence_installments INTEGER,
    recurrence_group_id TEXT,
    installment_number INTEGER,
    installment_total INTEGER,
    installment_index INTEGER,
    total_installments INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garantir adição de colunas caso a tabela já exista
ALTER TABLE public.reserve_transactions ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid';
ALTER TABLE public.reserve_transactions ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE public.reserve_transactions ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.reserve_transactions ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE public.reserve_transactions ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT;
ALTER TABLE public.reserve_transactions ADD COLUMN IF NOT EXISTS recurrence_installments INTEGER;
ALTER TABLE public.reserve_transactions ADD COLUMN IF NOT EXISTS recurrence_group_id TEXT;
ALTER TABLE public.reserve_transactions ADD COLUMN IF NOT EXISTS installment_number INTEGER;
ALTER TABLE public.reserve_transactions ADD COLUMN IF NOT EXISTS installment_total INTEGER;
ALTER TABLE public.reserve_transactions ADD COLUMN IF NOT EXISTS installment_index INTEGER;
ALTER TABLE public.reserve_transactions ADD COLUMN IF NOT EXISTS total_installments INTEGER;

CREATE INDEX IF NOT EXISTS idx_reserve_tx_user_reserve ON public.reserve_transactions(user_id, reserve_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_reserve_tx_payment_status ON public.reserve_transactions(payment_status);

-- ==============================================================================
-- 4. TABELA DE CONFIGURAÇÕES DO USUÁRIO (user_settings)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id TEXT PRIMARY KEY,
    full_name TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    
    -- Tarifas e Parâmetros da Pizzaria / Moto
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

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. TABELA DE INVESTIMENTOS (investment_transactions)
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
-- 6. TABELA DE PROVENTOS / DIVIDENDOS (dividends)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.dividends (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    unit_amount NUMERIC DEFAULT 0,
    type TEXT NOT NULL CHECK (type IN ('Dividendo', 'JCP', 'Rendimento')),
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'provisioned')),
    date DATE NOT NULL,
    data_com DATE,
    data_ex DATE,
    description TEXT,
    transaction_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dividends_user_ticker ON public.dividends(user_id, ticker);
CREATE INDEX IF NOT EXISTS idx_dividends_date ON public.dividends(user_id, date DESC);

-- ==============================================================================
-- 7. TABELA DE VALUATION E METAS DE PREÇO TETO (valuation_targets)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.valuation_targets (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    asset_type TEXT DEFAULT 'Ação',
    cnpj TEXT,
    calc_current_price NUMERIC,
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
-- 7b. TABELA DE METADADOS DE ATIVOS B3 (b3_assets_metadata)
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
-- 8. TABELA DE ORÇAMENTOS DE FRETE (freight_quotes)
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

    -- Carga e Detalhes
    cargo_description TEXT,
    cargo_weight_kg NUMERIC,
    cargo_volume TEXT,
    cargo_value NUMERIC,
    scheduled_date DATE,
    scheduled_time TEXT,
    expected_payment_date DATE,

    -- Precificação e Parâmetros
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

    -- Custos Reais do Motorista
    fuel_price NUMERIC DEFAULT 0,
    km_per_liter NUMERIC DEFAULT 0,
    maintenance_cost_per_km NUMERIC DEFAULT 0,
    estimated_fuel_cost NUMERIC DEFAULT 0,
    estimated_maintenance_cost NUMERIC DEFAULT 0,
    total_driver_cost NUMERIC DEFAULT 0,

    -- Resultados Finais
    total_price NUMERIC NOT NULL DEFAULT 0,
    driver_net_profit NUMERIC DEFAULT 0,
    profit_margin_percent NUMERIC DEFAULT 0,

    -- Condições e Observações
    payment_method TEXT DEFAULT 'pix',
    observations TEXT,
    terms_and_conditions TEXT,

    -- Integração com Financeiro
    converted_to_transaction_id TEXT,
    converted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_freight_quotes_user ON public.freight_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_freight_quotes_code ON public.freight_quotes(code);

-- ==============================================================================
-- 8. OTIMIZAÇÃO DE CONSTRAINTS E RELACIONAMENTOS (Evitar Deadlock Circular)
-- ==============================================================================
ALTER TABLE public.reserve_transactions DROP CONSTRAINT IF EXISTS reserve_transactions_linked_investment_id_fkey;
ALTER TABLE public.reserve_transactions DROP CONSTRAINT IF EXISTS fk_reserve_tx_linked_investment;
ALTER TABLE public.investment_transactions DROP CONSTRAINT IF EXISTS fk_investment_reserve_transaction;
ALTER TABLE public.investment_transactions DROP CONSTRAINT IF EXISTS investment_transactions_transaction_id_fkey;
ALTER TABLE public.investment_transactions DROP CONSTRAINT IF EXISTS investment_transactions_reserve_id_fkey;
ALTER TABLE public.dividends DROP CONSTRAINT IF EXISTS dividends_transaction_id_fkey;

-- Recriar vínculos com ON DELETE SET NULL se desejar integridade referencial não-bloqueante
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'reserve_transactions_linked_investment_id_fkey'
    ) THEN
        ALTER TABLE public.reserve_transactions 
        ADD CONSTRAINT reserve_transactions_linked_investment_id_fkey 
        FOREIGN KEY (linked_investment_id) REFERENCES public.investment_transactions(id) ON DELETE SET NULL;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- 9. CONFIGURAÇÃO DE RLS (ROW LEVEL SECURITY) E PERMISSÕES
-- ==============================================================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b3_assets_metadata ENABLE ROW LEVEL SECURITY;

-- Concessão de permissões completas aos roles do Supabase
GRANT ALL ON TABLE public.transactions TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.reserves TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.reserve_transactions TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.user_settings TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.investment_transactions TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.dividends TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.valuation_targets TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.freight_quotes TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.b3_assets_metadata TO anon, authenticated, service_role, postgres;

-- 1. Transações
DROP POLICY IF EXISTS "Acesso Total Transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can manage their transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow All Transactions" ON public.transactions;
CREATE POLICY "Acesso Total Transactions" ON public.transactions FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. Reservas
DROP POLICY IF EXISTS "Acesso Total Reserves" ON public.reserves;
DROP POLICY IF EXISTS "Users can manage their reserves" ON public.reserves;
DROP POLICY IF EXISTS "Allow All Reserves" ON public.reserves;
CREATE POLICY "Acesso Total Reserves" ON public.reserves FOR ALL TO public USING (true) WITH CHECK (true);

-- 3. Transações de Reserva
DROP POLICY IF EXISTS "Acesso Total Reserve Transactions" ON public.reserve_transactions;
DROP POLICY IF EXISTS "Users can manage their reserve transactions" ON public.reserve_transactions;
DROP POLICY IF EXISTS "Allow All Reserve Transactions" ON public.reserve_transactions;
CREATE POLICY "Acesso Total Reserve Transactions" ON public.reserve_transactions FOR ALL TO public USING (true) WITH CHECK (true);

-- 4. Configurações de Usuário
DROP POLICY IF EXISTS "Acesso Total User Settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can manage their settings" ON public.user_settings;
DROP POLICY IF EXISTS "Allow All User Settings" ON public.user_settings;
CREATE POLICY "Acesso Total User Settings" ON public.user_settings FOR ALL TO public USING (true) WITH CHECK (true);

-- 5. Transações de Investimentos
DROP POLICY IF EXISTS "Acesso Total Investments" ON public.investment_transactions;
DROP POLICY IF EXISTS "Users can manage their investments" ON public.investment_transactions;
DROP POLICY IF EXISTS "Allow All Investments" ON public.investment_transactions;
CREATE POLICY "Acesso Total Investments" ON public.investment_transactions FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. Dividendos e Proventos
DROP POLICY IF EXISTS "Acesso Total Dividends" ON public.dividends;
DROP POLICY IF EXISTS "Users can manage their dividends" ON public.dividends;
DROP POLICY IF EXISTS "Allow All Dividends" ON public.dividends;
CREATE POLICY "Acesso Total Dividends" ON public.dividends FOR ALL TO public USING (true) WITH CHECK (true);

-- 7. Metas de Valuation / Preço Teto
DROP POLICY IF EXISTS "Acesso Total Valuation" ON public.valuation_targets;
DROP POLICY IF EXISTS "Users can manage their valuation targets" ON public.valuation_targets;
DROP POLICY IF EXISTS "Allow All Valuation" ON public.valuation_targets;
CREATE POLICY "Acesso Total Valuation" ON public.valuation_targets FOR ALL TO public USING (true) WITH CHECK (true);

-- 8. Cotações de Frete
DROP POLICY IF EXISTS "Acesso Total Freight Quotes" ON public.freight_quotes;
DROP POLICY IF EXISTS "Users can manage their freight quotes" ON public.freight_quotes;
DROP POLICY IF EXISTS "Allow All Freight Quotes" ON public.freight_quotes;
CREATE POLICY "Acesso Total Freight Quotes" ON public.freight_quotes FOR ALL TO public USING (true) WITH CHECK (true);

-- 9. Metadados de Ativos B3
DROP POLICY IF EXISTS "Acesso Total B3 Assets Metadata" ON public.b3_assets_metadata;
CREATE POLICY "Acesso Total B3 Assets Metadata" ON public.b3_assets_metadata FOR ALL TO public USING (true) WITH CHECK (true);
