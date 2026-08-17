-- Script de Migração: Vinculação de Proventos e Investimentos a Transações de Reserva
-- Execute este script no SQL Editor do console do seu Supabase para atualizar a estrutura do banco de dados.

-- 1. Tabela public.dividends (Proventos)
-- Adiciona a coluna transaction_id se ela não existir e cria a chave estrangeira apontando para reserve_transactions
ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS transaction_id uuid;

-- Remove a restrição caso ela já exista para evitar erros de duplicidade ao reexecutar
ALTER TABLE public.dividends DROP CONSTRAINT IF EXISTS fk_dividend_reserve_transaction;

-- Adiciona a chave estrangeira com ON DELETE CASCADE para sincronizar a exclusão automática
ALTER TABLE public.dividends 
  ADD CONSTRAINT fk_dividend_reserve_transaction 
  FOREIGN KEY (transaction_id) 
  REFERENCES public.reserve_transactions(id) 
  ON DELETE CASCADE;

-- Comentário para documentação
COMMENT ON COLUMN public.dividends.transaction_id IS 'ID da transação de reserva associada (lançamento de rendimento)';


-- 2. Tabela public.investment_transactions (Transações de Investimento / Compra e Venda)
-- Adiciona a coluna transaction_id se ela não existir e cria a chave estrangeira apontando para reserve_transactions
ALTER TABLE public.investment_transactions ADD COLUMN IF NOT EXISTS transaction_id uuid;

-- Remove a restrição antiga caso exista
ALTER TABLE public.investment_transactions DROP CONSTRAINT IF EXISTS fk_investment_reserve_transaction;

-- Adiciona a chave estrangeira com ON DELETE CASCADE para sincronizar a exclusão automática
ALTER TABLE public.investment_transactions 
  ADD CONSTRAINT fk_investment_reserve_transaction 
  FOREIGN KEY (transaction_id) 
  REFERENCES public.reserve_transactions(id) 
  ON DELETE CASCADE;

-- Comentário para documentação
COMMENT ON COLUMN public.investment_transactions.transaction_id IS 'ID da transação de reserva associada (lançamento de utilização)';
