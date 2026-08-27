-- ==========================================================
-- FINANÇAS PRO - MIGRATION SUPABASE: ORÇAMENTOS DE FRETE PRO
-- Executar este SQL no Editor SQL do Supabase Dashboard
-- ==========================================================

-- 1. TABELA DE ORÇAMENTOS DE FRETE (freight_quotes)
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

-- Adicionar coluna de previsão de pagamento se a tabela já existir no Supabase
ALTER TABLE public.freight_quotes ADD COLUMN IF NOT EXISTS expected_payment_date DATE;

CREATE INDEX IF NOT EXISTS idx_freight_quotes_user_id ON public.freight_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_freight_quotes_code ON public.freight_quotes(code);
CREATE INDEX IF NOT EXISTS idx_freight_quotes_status ON public.freight_quotes(status);

ALTER TABLE public.freight_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso Total a Freight Quotes" ON public.freight_quotes;
CREATE POLICY "Acesso Total a Freight Quotes" 
ON public.freight_quotes FOR ALL 
USING (true) 
WITH CHECK (true);


-- 2. TABELA DE CONFIGURAÇÕES/PADRÕES DO MOTORISTA (freight_presets)
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

-- Adicionar coluna de veículos customizados se a tabela já existir
ALTER TABLE public.freight_presets ADD COLUMN IF NOT EXISTS vehicles JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.freight_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso Total a Freight Presets" ON public.freight_presets;
CREATE POLICY "Acesso Total a Freight Presets" 
ON public.freight_presets FOR ALL 
USING (true) 
WITH CHECK (true);


-- 3. TABELA DE CLIENTES PARA AUTOCOMPLETAR (freight_clients)
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

CREATE INDEX IF NOT EXISTS idx_freight_clients_user_id ON public.freight_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_freight_clients_name ON public.freight_clients(name);

ALTER TABLE public.freight_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso Total a Freight Clients" ON public.freight_clients;
CREATE POLICY "Acesso Total a Freight Clients" 
ON public.freight_clients FOR ALL 
USING (true) 
WITH CHECK (true);
