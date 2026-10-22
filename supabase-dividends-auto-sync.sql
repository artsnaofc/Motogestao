-- ==============================================================================
-- MIGRATION: IMPORTAÇÃO AUTOMÁTICA DE PROVENTOS (CVM / FNET / B3 / BRAPI)
-- Módulo: MotoGestão Investimentos
-- Data: 2026-10-22
-- Descrição:
--   1. Adiciona campos de rastreamento de proveniência de eventos corporativos na tabela dividends
--   2. Suporta novos tipos: Amortizacao e Outros
--   3. Suporta novo status: cancelled (para cancelamentos/retificações oficiais)
--   4. Cria índice único determinístico anti-duplicidade
--   5. Cria tabela de auditoria de sincronizações (dividend_sync_logs)
-- ==============================================================================

-- 1. ADICIONAR CAMPOS DE METADADOS NA TABELA DIVIDENDS
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS source_provider TEXT;
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS source_event_id TEXT;
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS source_document_id TEXT;
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS source_document_version INTEGER;
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ;
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ;
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS eligible_quantity NUMERIC;
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'valid';
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. ATUALIZAR RESTRIÇÕES DE TIPO E STATUS (SAFE UPDATE)
ALTER TABLE public.dividends DROP CONSTRAINT IF EXISTS dividends_type_check;
ALTER TABLE public.dividends ADD CONSTRAINT dividends_type_check 
  CHECK (type IN ('Dividendo', 'JCP', 'Rendimento', 'Amortizacao', 'Outros'));

ALTER TABLE public.dividends DROP CONSTRAINT IF EXISTS dividends_status_check;
ALTER TABLE public.dividends ADD CONSTRAINT dividends_status_check 
  CHECK (status IN ('received', 'provisioned', 'cancelled'));

-- 3. ÍNDICES DE PERFORMANCE E TRAVA DETERMINÍSTICA ANTI-DUPLICAÇÃO
-- Impede que uma mesma sincronização duplique o evento de um provedor para o mesmo usuário
CREATE UNIQUE INDEX IF NOT EXISTS idx_dividends_user_source_event 
ON public.dividends(user_id, source_provider, source_event_id) 
WHERE source_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dividends_provider ON public.dividends(source_provider);
CREATE INDEX IF NOT EXISTS idx_dividends_data_com ON public.dividends(data_com);
CREATE INDEX IF NOT EXISTS idx_dividends_status ON public.dividends(status);

-- 4. TABELA DE AUDITORIA E LOGS DE SINCRONIZAÇÃO (dividend_sync_logs)
CREATE TABLE IF NOT EXISTS public.dividend_sync_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    provider TEXT NOT NULL,
    discovered INTEGER NOT NULL DEFAULT 0,
    imported INTEGER NOT NULL DEFAULT 0,
    updated INTEGER NOT NULL DEFAULT 0,
    ignored INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    details JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dividend_sync_logs_user_date 
ON public.dividend_sync_logs(user_id, created_at DESC);

-- 5. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.dividend_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own dividend sync logs" ON public.dividend_sync_logs;
CREATE POLICY "Users can read own dividend sync logs"
ON public.dividend_sync_logs FOR SELECT
USING (auth.uid()::text = user_id OR user_id = 'default');

DROP POLICY IF EXISTS "Users can insert own dividend sync logs" ON public.dividend_sync_logs;
CREATE POLICY "Users can insert own dividend sync logs"
ON public.dividend_sync_logs FOR INSERT
WITH CHECK (auth.uid()::text = user_id OR user_id = 'default');
