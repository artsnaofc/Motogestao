-- ==============================================================================
-- MIGRAÇÃO: SUPORTE A HORA (HH:mm) E CAMPOS COMPLEMENTARES DE RESERVAS
-- Seguro e idempotente (pode ser executado múltiplas vezes sem apagar dados)
-- Execute no SQL Editor do Supabase.
-- ==============================================================================

BEGIN;

-- 1. Coluna de hora (HH:mm) em Lançamentos Financeiros
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS "time" TEXT;

-- 2. Coluna de hora (HH:mm) e flag de gráfico em Movimentações de Reservas
ALTER TABLE public.reserve_transactions
  ADD COLUMN IF NOT EXISTS "time" TEXT,
  ADD COLUMN IF NOT EXISTS ignore_in_charts BOOLEAN DEFAULT FALSE;

-- 3. Coluna de hora de vigência e configurações complementares em Reservas
ALTER TABLE public.reserves
  ADD COLUMN IF NOT EXISTS regra_inicio_hora TEXT,
  ADD COLUMN IF NOT EXISTS target_date DATE,
  ADD COLUMN IF NOT EXISTS boost_ativo BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS boost_tipo TEXT,
  ADD COLUMN IF NOT EXISTS boost_valor NUMERIC,
  ADD COLUMN IF NOT EXISTS reset_suggestion_on_withdraw BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS weekly_goal_mode TEXT,
  ADD COLUMN IF NOT EXISTS weekly_goal_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS weekly_goal_include_manual BOOLEAN DEFAULT FALSE;

-- 4. Índices para ordenação cronológica por data + hora
CREATE INDEX IF NOT EXISTS idx_transactions_user_date_time
  ON public.transactions(user_id, date DESC, "time" DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_reserve_tx_user_date_time
  ON public.reserve_transactions(user_id, reserve_id, date DESC, "time" DESC NULLS LAST);

COMMIT;
