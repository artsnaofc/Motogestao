-- 1. Adiciona coluna reserve_id para vincular investimentos a reservas
ALTER TABLE public.investment_transactions ADD COLUMN IF NOT EXISTS reserve_id uuid REFERENCES public.reserves(id) ON DELETE SET NULL;

-- 2. Adiciona coluna default_investment_reserve_id em user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS default_investment_reserve_id uuid REFERENCES public.reserves(id) ON DELETE SET NULL;

-- 3. Adiciona coluna cached_quotes em user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS cached_quotes jsonb DEFAULT '{}'::jsonb;

-- 4. Adiciona coluna linked_investment_id em reserve_transactions
ALTER TABLE public.reserve_transactions ADD COLUMN IF NOT EXISTS linked_investment_id uuid REFERENCES public.investment_transactions(id) ON DELETE CASCADE;

-- 5. Adiciona coluna weekly_net_goal em user_settings para meta semanal de lucro líquido
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS weekly_net_goal numeric DEFAULT 0;

-- 6. Adiciona coluna default_driver_labor em user_settings para valor padrão da mão de obra do motorista no frete
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS default_driver_labor numeric(10, 2) DEFAULT 100.00;

-- 7. Altera precisão da coluna regra_valor em reserves para numeric(12, 4) para suportar taxas fracionárias como 0.085
ALTER TABLE public.reserves ALTER COLUMN regra_valor TYPE numeric(12, 4);

-- 8. Adiciona colunas para provedor de cotações e token da Brapi em user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS quote_provider text DEFAULT 'auto';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS brapi_token text;
