-- ==============================================================================
-- FINANÇAS PRO & MOTO GESTÃO - MIGRAÇÃO DE BANCO DE DADOS (NOVAS FEATURES)
-- Versão: 2.6 (Produção Supabase)
-- Data: Novembro 2026
-- Inclui:
--   1. Novas colunas em public.transactions (ignore_in_charts, card_id, card_name, card_installments)
--   2. Tabela public.credit_cards (Gerenciamento completo de cartões, faturas e limites)
--   3. Tabela public.tx_quick_templates (Modelos rápidos de lançamento com 1 clique)
--   4. Tabela public.category_budgets (Limites orçamentários mensais por categoria)
--   5. Tabela public.platform_reconciliations (Conciliação de repasses iFood, Uber, 99Moto e Pizzaria)
--   6. Índices otimizados, RLS e Permissões Universais
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. EXTENSÃO DAS TRANSAÇÕES (transactions)
-- ==============================================================================
-- Coluna para ocultar despesas/ganhos de gráficos gerenciais sem excluí-los
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS ignore_in_charts BOOLEAN DEFAULT FALSE;

-- Colunas para vínculo direto com cartão de crédito e controle de parcelas
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS card_id TEXT,
  ADD COLUMN IF NOT EXISTS card_name TEXT,
  ADD COLUMN IF NOT EXISTS card_installments INTEGER,
  ADD COLUMN IF NOT EXISTS card_installment_index INTEGER;

-- Índices para buscas rápidas por cartão e filtros de relatórios
CREATE INDEX IF NOT EXISTS idx_transactions_user_card_id ON public.transactions(user_id, card_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ignore_charts ON public.transactions(user_id, ignore_in_charts);
CREATE INDEX IF NOT EXISTS idx_transactions_due_payment_status ON public.transactions(user_id, due_date, payment_status);

-- ==============================================================================
-- 2. TABELA DE CARTÕES DE CRÉDITO (credit_cards)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.credit_cards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT 'outro',
    color TEXT NOT NULL DEFAULT '#820ad1',
    closing_day INTEGER NOT NULL DEFAULT 5 CHECK (closing_day BETWEEN 1 AND 31),
    due_day INTEGER NOT NULL DEFAULT 12 CHECK (due_day BETWEEN 1 AND 31),
    limit_amount NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_cards_user_created ON public.credit_cards(user_id, created_at DESC);

-- ==============================================================================
-- 3. MODELOS RÁPIDOS DE LANÇAMENTO (tx_quick_templates)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tx_quick_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    tab TEXT NOT NULL DEFAULT 'despesa',
    category TEXT NOT NULL,
    amount NUMERIC DEFAULT 0,
    description TEXT,
    deliveries INTEGER DEFAULT 0,
    out_of_neighborhood INTEGER DEFAULT 0,
    operational_expenses NUMERIC DEFAULT 0,
    payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending')),
    ignore_in_charts BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_quick_templates_user ON public.tx_quick_templates(user_id, created_at DESC);

-- ==============================================================================
-- 4. ORÇAMENTOS POR CATEGORIA (category_budgets)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.category_budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    category TEXT NOT NULL,
    monthly_limit NUMERIC NOT NULL DEFAULT 0,
    month TEXT, -- Opcional: ex '2026-11' ou geral
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_category_budgets_user_cat ON public.category_budgets(user_id, category);

-- ==============================================================================
-- 5. RECONCILIAÇÃO DE PLATAFORMAS (platform_reconciliations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.platform_reconciliations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    platform_category TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    expected_amount NUMERIC NOT NULL DEFAULT 0,
    actual_paid_amount NUMERIC NOT NULL DEFAULT 0,
    difference NUMERIC NOT NULL DEFAULT 0,
    reconciled_at DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    adjustment_tx_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_reconciliations_user ON public.platform_reconciliations(user_id, reconciled_at DESC);

-- ==============================================================================
-- 6. HABILITAR ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tx_quick_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_reconciliations ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 7. POLÍTICAS DE ACESSO UNIVERSAIS (Compatíveis com Modo Anônimo e Autenticado)
-- ==============================================================================
DROP POLICY IF EXISTS "Acesso Total Credit Cards" ON public.credit_cards;
CREATE POLICY "Acesso Total Credit Cards" ON public.credit_cards FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Quick Templates" ON public.tx_quick_templates;
CREATE POLICY "Acesso Total Quick Templates" ON public.tx_quick_templates FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Category Budgets" ON public.category_budgets;
CREATE POLICY "Acesso Total Category Budgets" ON public.category_budgets FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Platform Reconciliations" ON public.platform_reconciliations;
CREATE POLICY "Acesso Total Platform Reconciliations" ON public.platform_reconciliations FOR ALL TO public USING (true) WITH CHECK (true);

-- ==============================================================================
-- 8. CONCESSÃO DE PRIVILÉGIOS (GRANTS)
-- ==============================================================================
GRANT ALL ON TABLE public.credit_cards TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.tx_quick_templates TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.category_budgets TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.platform_reconciliations TO anon, authenticated, service_role, postgres;

COMMIT;

-- FIM DA MIGRAÇÃO
