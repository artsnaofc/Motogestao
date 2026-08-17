-- Script para adicionar colunas Data Com e Data Ex na tabela de proventos
-- Execute este script no SQL Editor do seu console Supabase

ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS data_com date;
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS data_ex date;

-- Comentários para documentação
COMMENT ON COLUMN public.dividends.data_com IS 'Data limite para ter o ativo e ter direito ao provento (Data Com)';
COMMENT ON COLUMN public.dividends.data_ex IS 'Data a partir da qual o ativo é negociado sem direito ao provento (Data Ex)';
